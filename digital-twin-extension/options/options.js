const PRICING = {
  'driving_license': { total: 250, deposit: 100 },
  'residency_card': { total: 280, deposit: 100 },
  'passport': { total: 350, deposit: 150 },
  'visa': { total: 400, deposit: 150 },
  'id_card': { total: 200, deposit: 100 }
};

document.addEventListener('DOMContentLoaded', async () => {
  // Load settings
  const settings = await chrome.storage.local.get([
    'startHour', 'endHour', 'perHourLimit', 'per10MinLimit',
    'template1', 'template2', 'pricing'
  ]);

  document.getElementById('startHour').value = settings.startHour || 8;
  document.getElementById('endHour').value = settings.endHour || 2;
  document.getElementById('perHourLimit').value = settings.perHourLimit || 40;
  document.getElementById('per10MinLimit').value = settings.per10MinLimit || 12;
  document.getElementById('template1').value = settings.template1 || '';
  document.getElementById('template2').value = settings.template2 || '';

  // Populate pricing table (editable — saved to storage, used by the core)
  const effectivePricing = { ...PRICING, ...(settings.pricing || {}) };
  const table = document.getElementById('pricingTable');
  table.innerHTML = '<table style="width: 100%;"><tr><th>Document</th><th>Total (€)</th><th>Deposit (€)</th></tr>';

  for (const [doc, price] of Object.entries(effectivePricing)) {
    const row = `<tr>
      <td>${doc.replace(/_/g, ' ')}</td>
      <td><input type="number" min="0" data-doc="${doc}" data-field="total" value="${price.total}" style="width:80px"></td>
      <td><input type="number" min="0" data-doc="${doc}" data-field="deposit" value="${price.deposit}" style="width:80px"></td>
    </tr>`;
    table.innerHTML += row;
  }
  table.innerHTML += '</table>';

  // Save button
  document.getElementById('saveBtn').addEventListener('click', async () => {
    const pricing = {};
    document.querySelectorAll('#pricingTable input[data-doc]').forEach((input) => {
      const doc = input.dataset.doc;
      const field = input.dataset.field;
      pricing[doc] = pricing[doc] || {};
      pricing[doc][field] = parseInt(input.value) || 0;
    });

    const settings = {
      startHour: parseInt(document.getElementById('startHour').value),
      endHour: parseInt(document.getElementById('endHour').value),
      perHourLimit: parseInt(document.getElementById('perHourLimit').value),
      per10MinLimit: parseInt(document.getElementById('per10MinLimit').value),
      template1: document.getElementById('template1').value,
      template2: document.getElementById('template2').value,
      pricing
    };

    await chrome.storage.local.set(settings);

    const status = document.getElementById('status');
    status.textContent = '✓ Settings saved!';
    status.classList.remove('error');
    setTimeout(() => { status.textContent = ''; }, 3000);
  });
});
