// AMI Designs & Events — Admin: Event & Ticket management, QR scanner, ticket sales list

let currentEventBrandId = null;
let ticketScanner = null;

function wireAdminEventModal() {
  document.getElementById('admin-event-modal-close').addEventListener('click', closeAdminEventModal);

  document.getElementById('admin-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const brandId = document.getElementById('admin-event-brand-id').value;
    const payload = {
      event_title: document.getElementById('admin-event-title').value.trim() || null,
      event_date: document.getElementById('admin-event-date').value || null,
      event_location: document.getElementById('admin-event-location').value.trim() || null,
      event_description: document.getElementById('admin-event-description').value.trim() || null,
      event_active: document.getElementById('admin-event-active').checked,
    };

    const { error } = await supabaseClient.from('brands').update(payload).eq('id', brandId);
    if (error) { alert('Save failed: ' + error.message); return; }

    alert('Event details saved.');
    loadAdminBrands();
    if (typeof loadBrands === 'function') loadBrands();
  });

  document.getElementById('admin-add-ticket-type-btn').addEventListener('click', () => {
    document.getElementById('admin-ticket-type-form').reset();
    document.getElementById('ticket-type-id').value = '';
    document.getElementById('admin-ticket-type-form-wrap').hidden = false;
  });

  document.getElementById('ticket-type-cancel-btn').addEventListener('click', () => {
    document.getElementById('admin-ticket-type-form-wrap').hidden = true;
  });

  document.getElementById('admin-ticket-type-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('ticket-type-id').value;
    const payload = {
      name: document.getElementById('ticket-type-name').value.trim(),
      price: parseFloat(document.getElementById('ticket-type-price').value) || 0,
      people_count: parseInt(document.getElementById('ticket-type-people').value, 10) || 1,
      quantity_limit: parseInt(document.getElementById('ticket-type-quantity').value, 10) || 0,
      expires_at: document.getElementById('ticket-type-expires').value || null,
    };

    let error;
    if (id) {
      ({ error } = await supabaseClient.from('ticket_types').update(payload).eq('id', id));
    } else {
      payload.brand_id = currentEventBrandId;
      ({ error } = await supabaseClient.from('ticket_types').insert([payload]));
    }

    if (error) { alert('Save failed: ' + error.message); return; }

    document.getElementById('admin-ticket-type-form-wrap').hidden = true;
    loadAdminTicketTypes(currentEventBrandId);
    if (typeof loadBrands === 'function') loadBrands();
  });
}

async function openAdminEventModal(brand) {
  currentEventBrandId = brand.id;
  document.getElementById('admin-event-brand-name').textContent = brand.name;
  document.getElementById('admin-event-brand-id').value = brand.id;
  document.getElementById('admin-event-title').value = brand.event_title || '';
  document.getElementById('admin-event-date').value = brand.event_date ? toLocalDatetimeInput(brand.event_date) : '';
  document.getElementById('admin-event-location').value = brand.event_location || '';
  document.getElementById('admin-event-description').value = brand.event_description || '';
  document.getElementById('admin-event-active').checked = !!brand.event_active;
  document.getElementById('admin-ticket-type-form-wrap').hidden = true;

  document.getElementById('admin-event-modal').hidden = false;
  document.body.style.overflow = 'hidden';

  loadAdminTicketTypes(brand.id);
}

function closeAdminEventModal() {
  document.getElementById('admin-event-modal').hidden = true;
  document.body.style.overflow = '';
}

function toLocalDatetimeInput(isoString) {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function loadAdminTicketTypes(brandId) {
  const list = document.getElementById('admin-ticket-types-list');
  list.innerHTML = '<p class="admin-loading">Loading…</p>';

  const { data, error } = await supabaseClient.from('ticket_types').select('*').eq('brand_id', brandId).order('price', { ascending: true });

  if (error) { list.innerHTML = `<p class="admin-error-msg">${escapeHtmlAdmin(error.message)}</p>`; return; }
  if (!data.length) { list.innerHTML = '<p class="admin-empty">No ticket types yet.</p>'; return; }

  list.innerHTML = data.map((t) => `
    <div class="admin-row glass-card" data-id="${t.id}">
      <div class="admin-row-main">
        <p class="admin-row-title">${escapeHtmlAdmin(t.name)}</p>
        <p class="admin-row-sub">KES ${Number(t.price).toLocaleString('en-KE')} · Admits ${t.people_count} · ${t.quantity_sold}/${t.quantity_limit} sold${t.expires_at ? ' · Cutoff: ' + new Date(t.expires_at).toLocaleString('en-KE') : ''}</p>
      </div>
      <div class="admin-row-actions">
        <button class="btn-secondary admin-edit-ticket-type-btn" data-id="${t.id}">Edit</button>
        <button class="btn-secondary admin-delete-ticket-type-btn" data-id="${t.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.admin-edit-ticket-type-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = data.find((item) => String(item.id) === btn.dataset.id);
      if (!t) return;
      document.getElementById('ticket-type-id').value = t.id;
      document.getElementById('ticket-type-name').value = t.name || '';
      document.getElementById('ticket-type-price').value = t.price ?? '';
      document.getElementById('ticket-type-people').value = t.people_count ?? 1;
      document.getElementById('ticket-type-quantity').value = t.quantity_limit ?? '';
      document.getElementById('ticket-type-expires').value = t.expires_at ? toLocalDatetimeInput(t.expires_at) : '';
      document.getElementById('admin-ticket-type-form-wrap').hidden = false;
    });
  });

  list.querySelectorAll('.admin-delete-ticket-type-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this ticket type? Already-purchased tickets stay valid.')) return;
      const { error } = await supabaseClient.from('ticket_types').delete().eq('id', btn.dataset.id);
      if (error) { alert('Delete failed: ' + error.message); return; }
      loadAdminTicketTypes(currentEventBrandId);
    });
  });
}

/* ---------- QR SCANNER ---------- */
function wireTicketScanner() {
  document.getElementById('start-scanner-btn').addEventListener('click', async () => {
    const resultEl = document.getElementById('scan-result');
    resultEl.innerHTML = '';
    if (ticketScanner) return;

    ticketScanner = new Html5Qrcode('qr-reader');
    try {
      await ticketScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        async (decodedText) => { await handleScannedCode(decodedText); },
        () => {}
      );
      document.getElementById('start-scanner-btn').textContent = 'Scanning…';
      document.getElementById('start-scanner-btn').disabled = true;
    } catch (err) {
      resultEl.innerHTML = `<p class="admin-error-msg">Camera error: ${escapeHtmlAdmin((err && err.message) || String(err))}</p>`;
      ticketScanner = null;
    }
  });
}

async function handleScannedCode(code) {
  const resultEl = document.getElementById('scan-result');
  const { data, error } = await supabaseClient.rpc('scan_ticket', { p_code: code });

  if (error || !data || !data.length) {
    resultEl.innerHTML = `<div class="scan-result-card scan-error">Scan failed: ${escapeHtmlAdmin((error && error.message) || 'Unknown error')}</div>`;
    return;
  }

  const r = data[0];
  if (r.result === 'not_found') {
    resultEl.innerHTML = `<div class="scan-result-card scan-error">❌ Ticket not found: ${escapeHtmlAdmin(r.ticket_code)}</div>`;
  } else if (r.result === 'already_used') {
    resultEl.innerHTML = `<div class="scan-result-card scan-warning">⚠️ Already used<br>${escapeHtmlAdmin(r.buyer_name)} · ${escapeHtmlAdmin(r.ticket_type_name)}<br>Used at: ${new Date(r.used_at).toLocaleString('en-KE')}</div>`;
  } else {
    resultEl.innerHTML = `<div class="scan-result-card scan-success">✅ Valid — checked in<br>${escapeHtmlAdmin(r.buyer_name)} (${escapeHtmlAdmin(r.buyer_whatsapp)})<br>${escapeHtmlAdmin(r.ticket_type_name)} · ${escapeHtmlAdmin(r.event_title || '')}</div>`;
  }
}

/* ---------- SALES LIST ---------- */
async function loadAdminTicketSales() {
  const list = document.getElementById('admin-tickets-list');
  list.innerHTML = '<p class="admin-loading">Loading…</p>';

  const { data, error } = await supabaseClient
    .from('tickets')
    .select('*, brands(name), ticket_types(name)')
    .order('created_at', { ascending: false });

  if (error) { list.innerHTML = `<p class="admin-error-msg">${escapeHtmlAdmin(error.message)}</p>`; return; }
  if (!data.length) { list.innerHTML = '<p class="admin-empty">No tickets sold yet.</p>'; return; }

  list.innerHTML = data.map((t) => `
    <div class="admin-row glass-card">
      <div class="admin-row-main">
        <p class="admin-row-title">${escapeHtmlAdmin(t.buyer_name)} — ${escapeHtmlAdmin(t.code)} ${t.status === 'used' ? '<span class="admin-oos-tag">Used</span>' : ''}</p>
        <p class="admin-row-sub">${escapeHtmlAdmin((t.brands && t.brands.name) || '')} · ${escapeHtmlAdmin((t.ticket_types && t.ticket_types.name) || '')} · KES ${Number(t.price_paid).toLocaleString('en-KE')} · ${escapeHtmlAdmin(t.buyer_whatsapp)}</p>
      </div>
    </div>
  `).join('');
}

function wireTicketingSubtabs() {
  document.querySelectorAll('.admin-subtab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-subtab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.admin-subtab-content').forEach((c) => { c.hidden = true; });
      document.getElementById(`admin-subtab-${tab.dataset.subtab}`).hidden = false;
      if (tab.dataset.subtab === 'sales') loadAdminTicketSales();
    });
  });
}
