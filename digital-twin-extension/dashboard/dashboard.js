document.addEventListener('DOMContentLoaded', async () => {
  await loadAnalytics();
  setInterval(loadAnalytics, 5000); // Refresh every 5 seconds
});

async function loadAnalytics() {
  // Real data written by content-script.js -> chrome.storage.local (dt_analytics).
  // IndexedDB lives in the WhatsApp page origin and is unreachable from this
  // extension page, so the content script mirrors an aggregate snapshot here.
  let snap = null;
  try {
    const result = await chrome.storage.local.get(['dt_analytics']);
    snap = result.dt_analytics || null;
  } catch (e) {
    snap = null;
  }

  const stats = snap || {
    totalCustomers: 0,
    activeConversations: 0,
    conversionsToday: 0,
    estimatedRevenue: 0,
    byCountry: {},
    funnel: { greeted: 0, offered: 0, terms: 0, pipeline: 0, shipped: 0 },
    recentSessions: [],
  };

  document.getElementById('totalCustomers').textContent = stats.totalCustomers;
  document.getElementById('activeConversations').textContent = stats.activeConversations;
  document.getElementById('conversionsToday').textContent = stats.conversionsToday;
  document.getElementById('estimatedRevenue').textContent = `€${stats.estimatedRevenue}`;

  // Funnel visualization (real pipeline states)
  const f = stats.funnel;
  const funnel = document.getElementById('salesFunnel');
  funnel.innerHTML = `
    <div class="funnel-stage">Greetings: ${f.greeted}</div>
    <div class="funnel-stage">Offered Sample: ${f.offered}</div>
    <div class="funnel-stage">Terms Explained: ${f.terms}</div>
    <div class="funnel-stage">Paid Pipeline: ${f.pipeline}</div>
    <div class="funnel-stage">Shipped: ${f.shipped}</div>
  `;

  // Country breakdown (real session countries)
  const entries = Object.entries(stats.byCountry || {});
  document.getElementById('countryBreakdown').innerHTML = entries.length
    ? entries
        .sort((a, b) => b[1] - a[1])
        .map(([country, count]) => `<div>${escapeHtml(country)}: ${count}</div>`)
        .join('')
    : '<div style="color:#9ca3af">No customer data yet — automation will populate this.</div>';

  // Recent sessions table (real)
  const tbody = document.getElementById('sessionsTbody');
  if (tbody) {
    const rows = stats.recentSessions || [];
    tbody.innerHTML = rows.length
      ? rows
          .map(
            (s) => `<tr>
              <td>${escapeHtml(String(s.phone || ''))}</td>
              <td>${escapeHtml(String(s.country || ''))}</td>
              <td>${escapeHtml(String(s.doc || ''))}</td>
              <td>${escapeHtml(String(s.state || ''))}</td>
              <td>${s.time ? new Date(s.time).toLocaleString() : ''}</td>
            </tr>`
          )
          .join('')
      : '<tr><td colspan="5" style="color:#9ca3af">No sessions yet.</td></tr>';
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
