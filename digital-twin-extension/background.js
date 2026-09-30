/**
 * ============================================================================
 *  background.js — Service Worker (خلفية الإضافة)
 * ============================================================================
 *  المسؤوليات:
 *  - إدارة اختصارات لوحة المفاتيح (Ctrl+Shift+A لتشغيل/إيقاف)
 *  - فتح لوحة التحكم عند الطلب
 *  - إشعارات النظام
 * ============================================================================
 */

// ─── تثبيت أول مرة ───
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[Digital Twin BG] installed:", details.reason);
  if (details.reason === "install") {
    // فتح صفحة الترحيب
    chrome.tabs.create({ url: chrome.runtime.getURL("options/options.html?welcome=1") });
  }
});

// ─── اختصارات لوحة المفاتيح ───
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url?.includes("web.whatsapp.com")) {
    notify("Digital Twin", "الاختصارات تعمل فقط على WhatsApp Web");
    return;
  }

  if (command === "toggle-automation") {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_AUTO" }, (res) => {
      if (res?.autoMode) {
        notify("النسخة الرقمية", "الأتمتة تعمل الآن ✅");
      } else {
        notify("النسخة الرقمية", "الأتمتة موقوفة ⏸");
      }
    });
  }

  if (command === "insert-template-1") {
    chrome.tabs.sendMessage(tab.id, { type: "INSERT_TEMPLATE", templateId: "F1" });
  }

  if (command === "open-dashboard") {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
  }
});

// ─── إشعار سريع ───
function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title,
    message,
  });
}

// ─── جسر لطلبات من الـ popup ───
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "OPEN_DASHBOARD") {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
    sendResponse({ ok: true });
  }
  if (msg.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
  }
});
