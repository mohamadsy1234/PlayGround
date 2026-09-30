/**
 * ============================================================================
 *  content-script.js — نقطة الربط داخل صفحة WhatsApp Web
 * ============================================================================
 *  يعمل هذا السكربت داخل web.whatsapp.com. يقرأ الرسائل، يمرّرها للنواة،
 *  ثم ينفذ ما تقرره النواة (إرسال نص / محاكاة كتابة / لصق قوالب).
 *
 *  يمكن تفعيله/إيقافه من زر عائم يظهر أسفل يمين الشاشة، أو من الـ popup.
 *
 *  ملاحظة معمارية: ملفات lib/‎ تعرّف أصنافاً عامة (Storage، DigitalTwinCore،
 *  Humanizer، MessageRateLimiter، MessageWatcher، WAAdapter) في النطاق
 *  العام لمحتوى الصفحة — يُستخدم هذا الملف تلك الأصناف مباشرة.
 * ============================================================================
 */

(async function main() {
  console.log("[Digital Twin] content script loaded on", location.href);

  // ─── تهيئة الطبقات ───
  const storage = new Storage();
  try {
    await storage.init();
  } catch (e) {
    console.error("[Digital Twin] IndexedDB init failed:", e);
  }

  const settings = await chrome.storage.local.get([
    "autoMode", "startHour", "endHour",
    "perHourLimit", "per10MinLimit",
    "template1", "template2", "pricing",
  ]);

  // أسعار قابلة للتحرير من صفحة الإعدادات (تتجاوز الافتراضي في النواة)
  if (settings.pricing && typeof settings.pricing === "object") {
    DigitalTwinCore.PRICING = { ...DigitalTwinCore.PRICING, ...settings.pricing };
  }

  const nucleus = new DigitalTwinCore();
  const rateLimiter = new MessageRateLimiter(
    settings.perHourLimit || 40,
    settings.per10MinLimit || 12
  );
  let workStartHour = settings.startHour ?? 8;
  let workEndHour = settings.endHour ?? 2;

  // حالة تفعيل الأتمتة (persistent)
  let autoMode = settings.autoMode === true;
  let consecutiveAutoReplies = 0;
  let lastAutoReplyAt = 0;

  // منع الرد على رسائلنا الصادرة (المراقب يرى كل الرسائل)
  const recentlySentTexts = []; // [{ text, at }]
  const seenMessageIds = new Set();
  const MAX_SEEN = 500;

  // ─── الزر العائم للتحكم السريع ───
  createFloatingButton();

  // ─── متصفح الرسائل (مع إعادة المحاولة — WhatsApp SPA) ───
  const watcher = new MessageWatcher(handleWatcherMessage);
  startWatcherWithRetry(watcher, 30);

  function startWatcherWithRetry(w, attemptsLeft) {
    try {
      w.start();
      const container = document.querySelector('[role="main"]');
      if (!container && attemptsLeft > 0) {
        setTimeout(() => startWatcherWithRetry(w, attemptsLeft - 1), 2000);
      }
    } catch (e) {
      if (attemptsLeft > 0) setTimeout(() => startWatcherWithRetry(w, attemptsLeft - 1), 2000);
    }
  }

  // ─── الاستماع لأوامر الـ popup / background ───
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "TOGGLE_AUTO") {
      autoMode = msg.enabled !== undefined ? !!msg.enabled : !autoMode;
      storage.setSetting("autoMode", autoMode).catch(() => {});
      consecutiveAutoReplies = 0;
      updateFloatingButton();
      sendResponse({ autoMode });
    }
    if (msg.type === "GET_STATE") {
      sendResponse({
        autoMode,
        rateStats: rateLimiter.getStats(),
        consecutiveAutoReplies,
      });
    }
    if (msg.type === "INSERT_TEMPLATE") {
      insertTemplate(msg.templateId).then((ok) => sendResponse({ ok }));
      return true;                                        // async response
    }
    return false;
  });

  // ─── إشعار فوري من المراقب ───
  function handleWatcherMessage(msg) {
    if (!msg || !msg.text || !msg.text.trim()) return;
    if (seenMessageIds.has(msg.id)) return;
    seenMessageIds.add(msg.id);
    if (seenMessageIds.size > MAX_SEEN) {
      const first = seenMessageIds.values().next().value;
      seenMessageIds.delete(first);
    }
    // تجاهل صدى رسائلنا الصادرة (نص مطابق أُرسل قبل < 90 ثانية)
    const now = Date.now();
    const isEcho = recentlySentTexts.some(
      (s) => s.text === msg.text.trim() && now - s.at < 90000
    );
    if (isEcho) return;

    const chatId = WAAdapter.getCurrentChatId() || "open-chat";
    handleIncoming({ chatId, text: msg.text.trim() }).catch((e) =>
      console.error("[Digital Twin] handle error:", e)
    );
  }

  // ─── معالج الرسائل الواردة ───
  async function handleIncoming({ chatId, text }) {
    if (!text) return;

    // سجل الحدث دائماً (للتحليلات) حتى لو الأتمتة مطفأة
    try {
      await storage.logEvent({ type: "incoming", phone: chatId, text: text.slice(0, 500) });
    } catch (e) { /* IndexedDB قد يكون معطلاً — تابع بدون تخزين */ }

    if (!autoMode) return;                                // "أنا تعبت" مطفي → لا نرد

    // كسر تتابع الردود الآلية بعد 5 دقائق خمول
    if (Date.now() - lastAutoReplyAt > 5 * 60 * 1000) consecutiveAutoReplies = 0;

    // فحوصات "الطابع البشري" (من الإعدادات)
    const withinHours = Humanizer.isWithinWorkingHours(workStartHour, workEndHour);
    if (!withinHours) {
      console.log("[Digital Twin] خارج ساعات العمل — تخطي الرد");
      return;
    }
    if (consecutiveAutoReplies >= 3 && Date.now() - lastAutoReplyAt < 60000) {
      console.log("[Digital Twin] كسر تتابع الردود — تخطي مؤقت");
      return;
    }
    if (!rateLimiter.shouldRespond()) {
      console.log("[Digital Twin] حد المعدل — تخطي الرد");
      return;
    }

    // الجلسة: إنشاء أو استرجاع
    let session = null;
    try {
      session = (await storage.getSession(chatId)) || {
        phone_number: chatId,
        state: DigitalTwinCore.STATES.INIT,
        createdAt: Date.now(),
      };
    } catch (e) {
      session = { phone_number: chatId, state: DigitalTwinCore.STATES.INIT, createdAt: Date.now() };
    }

    // النواة تقرر
    let reply;
    try {
      reply = nucleus.onTextMessage(session, text);
    } catch (e) {
      console.error("[Digital Twin] Nucleus error:", e);
      return;
    }

    session.updatedAt = Date.now();
    try { await storage.saveSession(session); } catch (e) { /* تابع */ }

    if (!reply || !reply.text) return;

    // تنفيذ الرد بتوقيت بشري
    const delay = Humanizer.calculateResponseDelay(text.length);
    const typingDur = Math.min(
      Humanizer.calculateTypingDuration(reply.text.length),
      15000
    );

    setTimeout(async () => {
      try {
        // محاكاة "يكتب..."
        await WAAdapter.simulateTyping(typingDur);

        // إرسال النص (الصوت والوسائط تحتاج إجراءات إضافية — مرحلة تالية)
        const ok = await WAAdapter.sendText(reply.text);
        if (ok) {
          rateLimiter.recordMessage();
          consecutiveAutoReplies++;
          lastAutoReplyAt = Date.now();
          recentlySentTexts.push({ text: reply.text.trim(), at: Date.now() });
          if (recentlySentTexts.length > 20) recentlySentTexts.shift();

          try {
            await storage.logEvent({
              type: "outgoing",
              phone: chatId,
              text: reply.text.slice(0, 500),
              state: session.state,
              replyType: reply.type,
            });
          } catch (e) { /* تابع */ }

          await syncStatsToStorage();
        }
      } catch (e) {
        console.error("[Digital Twin] send error:", e);
      }
    }, delay);
  }

  // ─── مزامنة الإحصائيات + لقطة التحليلات (للـ popup والداشبورد) ───
  async function syncStatsToStorage() {
    try {
      const stats = rateLimiter.getStats();
      await chrome.storage.local.set({
        rateLimiterStats: { ...stats, consecutiveAutoReplies },
      });
      await syncAnalyticsSnapshot();
    } catch (e) { /* مساحة التخزين قد تمتلئ — غير حرج */ }
  }

  async function syncAnalyticsSnapshot() {
    let sessions = [];
    try {
      sessions = await storage.allSessions();
    } catch (e) {
      return;
    }
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const byCountry = {};
    const funnel = { greeted: 0, offered: 0, terms: 0, pipeline: 0, shipped: 0 };
    let revenue = 0;
    let active = 0;

    for (const s of sessions) {
      const country = s.requested_country || "unknown";
      byCountry[country] = (byCountry[country] || 0) + 1;
      if (s.updatedAt && s.updatedAt >= dayAgo) active++;

      const st = s.state || "INIT";
      if (["GREETED"].includes(st)) funnel.greeted++;
      if (["OFFERED_SAMPLE", "SAMPLE_SENT"].includes(st)) funnel.offered++;
      if (["TERMS_EXPLAINED"].includes(st)) funnel.terms++;
      if (["AWAITING_DEPOSIT", "DEPOSIT_VERIFIED", "PREVIEW_SENT", "AWAITING_FINAL_PAY"].includes(st)) {
        funnel.pipeline++;
        const pricing = (settings.pricing || DigitalTwinCore.PRICING)[s.requested_doc];
        if (pricing) revenue += pricing.deposit;
      }
      if (["SHIPPED"].includes(st)) {
        funnel.shipped++;
        const pricing = (settings.pricing || DigitalTwinCore.PRICING)[s.requested_doc];
        if (pricing) revenue += pricing.total;
      }
    }

    const recentSessions = sessions
      .slice()
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, 10)
      .map((s) => ({
        phone: s.phone_number,
        country: s.requested_country || "-",
        doc: s.requested_doc || "-",
        state: s.state || "INIT",
        time: s.updatedAt || s.createdAt || now,
      }));

    await chrome.storage.local.set({
      dt_analytics: {
        totalCustomers: sessions.length,
        activeConversations: active,
        conversionsToday: funnel.pipeline + funnel.shipped,
        estimatedRevenue: revenue,
        byCountry,
        funnel,
        recentSessions,
        updatedAt: now,
      },
    });
  }

  // لقطة أولية عند التحميل حتى لو لم تصل رسائل بعد
  syncStatsToStorage().catch(() => {});
  setInterval(() => syncStatsToStorage().catch(() => {}), 30000);

  // ─── لصق قالب سريع (F1/F2 من الإعدادات أو مخزن القوالب) ───
  async function insertTemplate(templateId) {
    let text = null;
    try {
      const s = await chrome.storage.local.get(["template1", "template2"]);
      if (templateId === "F1") text = s.template1;
      else if (templateId === "F2") text = s.template2;
      if (!text) {
        const tpl = await storage.getTemplate(templateId);
        text = tpl && tpl.text;
      }
    } catch (e) { /* تابع */ }
    if (!text) return false;
    try {
      const ok = await WAAdapter.sendText(text);
      if (ok) {
        recentlySentTexts.push({ text: text.trim(), at: Date.now() });
        rateLimiter.recordMessage();
        await syncStatsToStorage();
      }
      return ok;
    } catch (e) {
      console.error("[Digital Twin] template insert error:", e);
      return false;
    }
  }

  // ─── الزر العائم (Toggle UI) ───
  function createFloatingButton() {
    if (document.getElementById("digital-twin-floating-btn")) return;
    const btn = document.createElement("div");
    btn.id = "digital-twin-floating-btn";
    btn.innerHTML = `
      <button id="dt-toggle" title="تشغيل/إيقاف الأتمتة">
        <span id="dt-status-dot"></span>
        <span id="dt-status-text">النسخة الرقمية</span>
      </button>
    `;
    document.body.appendChild(btn);
    document.getElementById("dt-toggle").addEventListener("click", () => {
      autoMode = !autoMode;
      storage.setSetting("autoMode", autoMode).catch(() => {});
      consecutiveAutoReplies = 0;
      updateFloatingButton();
    });
    updateFloatingButton();
  }

  function updateFloatingButton() {
    const btn = document.getElementById("dt-toggle");
    const dot = document.getElementById("dt-status-dot");
    const txt = document.getElementById("dt-status-text");
    if (!btn) return;
    if (autoMode) {
      btn.classList.add("dt-active");
      dot.classList.add("dt-active");
      txt.textContent = "الأتمتة تعمل";
    } else {
      btn.classList.remove("dt-active");
      dot.classList.remove("dt-active");
      txt.textContent = "الأتمتة موقوفة";
    }
  }
})();
