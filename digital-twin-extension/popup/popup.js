document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('autoModeToggle');
  const status = document.getElementById('status');
  const dashboardBtn = document.getElementById('dashboardBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const lastUpdate = document.getElementById('lastUpdate');

  // Load current state
  const result = await chrome.storage.local.get(['autoMode']);
  toggle.checked = result.autoMode || false;
  updateStatus();

  // Toggle handler
  toggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ autoMode: toggle.checked });
    updateStatus();
    
    // Notify content script
    chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TOGGLE_AUTO',
          enabled: toggle.checked
        }).catch(() => {});
      });
    });
  });

  // Button handlers
  dashboardBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' }).catch(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') });
    });
  });

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Update stats every 2 seconds
  setInterval(updateStats, 2000);

  function updateStatus() {
    status.textContent = toggle.checked ? 'Auto Mode: ON ✓' : 'Auto Mode: OFF';
  }

  async function updateStats() {
    // Get stats written by the content script after every auto-reply
    chrome.storage.local.get(['rateLimiterStats'], (result) => {
      if (result.rateLimiterStats) {
        const stats = result.rateLimiterStats;
        document.getElementById('messagesPerHour').textContent =
          `${stats.hourly.count}/${stats.hourly.limit}`;
        document.getElementById('messagesPerTenMin').textContent =
          `${stats.tenMin.count}/${stats.tenMin.limit}`;
        const consec = document.getElementById('consecutiveReplies');
        if (consec) consec.textContent = `${stats.consecutiveAutoReplies || 0}`;
      }

      const time = new Date().toLocaleTimeString();
      lastUpdate.textContent = time;
    });
  }
});
