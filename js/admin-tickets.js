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
        <button class="btn-danger admin-delete-ticket-type-btn" data-id="${t.id}">Delete</button>
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
let adminTicketRows = [];

function renderTicketRow(t) {
  const tag = t.status === 'used' ? '<span class="admin-oos-tag">Used</span>'
    : t.status === 'pending' ? '<span class="admin-oos-tag">Pending</span>'
    : t.status === 'rejected' ? '<span class="admin-oos-tag">Rejected</span>'
    : '';
  const mpesa = t.mpesa_code ? ` · M-Pesa ${escapeHtmlAdmin(t.mpesa_code)}` : '';

  // Rejected buyers should hear from us: give admin a ready-made WhatsApp message
  let actions = '';
  if (t.status === 'rejected') {
    const digits = String(t.buyer_whatsapp || '').replace(/[^0-9]/g, '');
    const typeName = (t.ticket_types && t.ticket_types.name) || 'your ticket';
    const msg = `Hello ${t.buyer_name}, we could not confirm your payment for ${typeName}. Please reply here so we can sort it out.`;
    actions = `
      <div class="admin-row-actions">
        <a class="btn-secondary" target="_blank" rel="noopener" href="https://wa.me/${encodeURIComponent(digits)}?text=${encodeURIComponent(msg)}">Message buyer</a>
      </div>`;
  }

  return `
    <div class="admin-row glass-card">
      <div class="admin-row-main">
        <p class="admin-row-title">${escapeHtmlAdmin(t.buyer_name)} · ${escapeHtmlAdmin(t.code)} ${tag}</p>
        <p class="admin-row-sub">${escapeHtmlAdmin((t.brands && t.brands.name) || '')} · ${escapeHtmlAdmin((t.ticket_types && t.ticket_types.name) || '')} · KES ${Number(t.price_paid).toLocaleString('en-KE')} · ${escapeHtmlAdmin(t.buyer_whatsapp)}${mpesa}</p>
      </div>${actions}
    </div>
  `;
}

function renderTicketSummary(rows) {
  const el = document.getElementById('admin-tickets-summary');
  if (!el) return;
  const sold = rows.filter((t) => t.status === 'valid' || t.status === 'used');
  const revenue = sold.reduce((sum, t) => sum + (Number(t.price_paid) || 0), 0);
  const cards = [
    { value: `KES ${revenue.toLocaleString('en-KE')}`, label: 'Revenue' },
    { value: sold.length, label: 'Tickets Sold' },
    { value: rows.filter((t) => t.status === 'used').length, label: 'Checked In' },
    { value: rows.filter((t) => t.status === 'pending').length, label: 'Pending' },
  ];
  el.innerHTML = cards.map((c) => `
    <div class="glass-card stats-card"><p class="stats-number">${escapeHtmlAdmin(String(c.value))}</p><p class="stats-label">${c.label}</p></div>
  `).join('');
}

/* ---------- CSV EXPORT ---------- */
function csvCell(value) {
  let s = value == null ? '' : String(value);
  // Neutralise spreadsheet formulas (CSV injection) in buyer-supplied text
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function buildTicketsCsv(rows) {
  const header = ['Code', 'Buyer', 'WhatsApp', 'Event', 'Ticket Type', 'Price (KES)', 'Status', 'Payment Method', 'M-Pesa Code', 'Created'];
  const lines = rows.map((t) => [
    t.code,
    t.buyer_name,
    t.buyer_whatsapp,
    t.brands && t.brands.name,
    t.ticket_types && t.ticket_types.name,
    t.price_paid,
    t.status,
    t.payment_method,
    t.mpesa_code,
    t.created_at ? new Date(t.created_at).toISOString() : '',
  ].map(csvCell).join(','));
  return [header.map(csvCell).join(','), ...lines].join('\r\n');
}

function exportTicketsCsv() {
  if (!adminTicketRows.length) { alert('There are no tickets to export yet.'); return; }
  // BOM so Excel reads UTF-8 names correctly
  const blob = new Blob(['﻿' + buildTicketsCsv(adminTicketRows)], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `ami-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function loadAdminTicketSales() {
  const list = document.getElementById('admin-tickets-list');
  list.innerHTML = '<p class="admin-loading">Loading…</p>';

  const { data, error } = await supabaseClient
    .from('tickets')
    .select('*, brands(name), ticket_types(name)')
    .order('created_at', { ascending: false });

  if (error) { list.innerHTML = `<p class="admin-error-msg">${escapeHtmlAdmin(error.message)}</p>`; return; }
  adminTicketRows = data;
  renderTicketSummary(data);
  if (!data.length) { list.innerHTML = '<p class="admin-empty">No tickets sold yet.</p>'; return; }

  const pending = data.filter((t) => t.status === 'pending');
  const valid = data.filter((t) => t.status === 'valid');
  const used = data.filter((t) => t.status === 'used');
  const rejected = data.filter((t) => t.status === 'rejected');

  const groups = [
    { rows: pending, label: 'Pending Approval' },
    { rows: valid, label: 'Valid — Not Yet Used' },
    { rows: used, label: 'Used — Checked In' },
    { rows: rejected, label: 'Rejected' },
  ];

  list.innerHTML = groups.map((g) => `
    <div class="admin-group">
      <div class="admin-group-header">
        <span>${g.label}</span>
        <span class="admin-group-count">${g.rows.length}</span>
      </div>
      ${g.rows.length ? g.rows.map(renderTicketRow).join('') : '<p class="admin-empty admin-group-empty">None here.</p>'}
    </div>
  `).join('');
}

function wireTicketingSubtabs() {
  const exportBtn = document.getElementById('export-tickets-csv-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportTicketsCsv);

  document.querySelectorAll('.admin-subtab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-subtab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.admin-subtab-content').forEach((c) => { c.hidden = true; });
      document.getElementById(`admin-subtab-${tab.dataset.subtab}`).hidden = false;
      if (tab.dataset.subtab === 'sales') loadAdminTicketSales();
      if (tab.dataset.subtab === 'pending') loadAdminPendingTickets();
      if (tab.dataset.subtab === 'issue') loadIssueTicketTypes();
    });
  });
  updatePendingBadge();
}

/* ---------- PENDING APPROVALS ---------- */
async function updatePendingBadge() {
  const badge = document.getElementById('pending-count-badge');
  if (!badge) return;
  const { count, error } = await supabaseClient
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return;
  badge.textContent = count || 0;
  badge.hidden = !count;
}

async function loadAdminPendingTickets() {
  const list = document.getElementById('admin-pending-list');
  list.innerHTML = '<p class="admin-loading">Loading…</p>';

  const { data, error } = await supabaseClient
    .from('tickets')
    .select('*, brands(name), ticket_types(name)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) { list.innerHTML = `<p class="admin-error-msg">${escapeHtmlAdmin(error.message)}</p>`; return; }
  updatePendingBadge();
  if (!data.length) { list.innerHTML = '<p class="admin-empty">No pending orders.</p>'; return; }

  list.innerHTML = data.map((t) => `
    <div class="admin-row glass-card pending-row" data-id="${t.id}">
      <div class="admin-row-main">
        <p class="admin-row-title">${escapeHtmlAdmin(t.buyer_name)} · KES ${Number(t.price_paid).toLocaleString('en-KE')}</p>
        <p class="admin-row-sub">M-Pesa code: <strong>${escapeHtmlAdmin(t.mpesa_code || '')}</strong> · ${escapeHtmlAdmin((t.brands && t.brands.name) || '')} · ${escapeHtmlAdmin((t.ticket_types && t.ticket_types.name) || '')}</p>
        <p class="admin-row-sub">${escapeHtmlAdmin(t.buyer_whatsapp)} · ${new Date(t.created_at).toLocaleString('en-KE')}</p>
      </div>
      <div class="admin-row-actions">
        <button class="btn-primary pending-approve-btn" data-id="${t.id}">Approve</button>
        <button class="btn-danger pending-reject-btn" data-id="${t.id}">Reject</button>
        <a class="btn-secondary" target="_blank" rel="noopener" href="https://wa.me/${encodeURIComponent(String(t.buyer_whatsapp).replace(/[^0-9]/g, ''))}?text=${encodeURIComponent('Hello ' + t.buyer_name + ', your AMI ticket is ready. Open the site, tap My Ticket and enter your WhatsApp number and M-Pesa code ' + (t.mpesa_code || '') + ' to get your QR ticket.')}">Message buyer</a>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.pending-approve-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Approve this ticket? Only do this after confirming the code and amount on your Till statement.')) return;
      btn.disabled = true;
      const { error: err } = await supabaseClient.rpc('approve_ticket', { p_ticket_id: btn.dataset.id });
      if (err) { alert('Approve failed: ' + err.message); btn.disabled = false; return; }
      loadAdminPendingTickets();
    });
  });

  list.querySelectorAll('.pending-reject-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Reject this order? The buyer will not receive a ticket.')) return;
      btn.disabled = true;
      const { error: err } = await supabaseClient.rpc('reject_ticket', { p_ticket_id: btn.dataset.id });
      if (err) { alert('Reject failed: ' + err.message); btn.disabled = false; return; }
      loadAdminPendingTickets();
    });
  });
}

/* ---------- ISSUE TICKET (cash / WhatsApp sales) ---------- */
async function loadIssueTicketTypes() {
  const select = document.getElementById('issue-ticket-type');
  const { data, error } = await supabaseClient
    .from('ticket_types')
    .select('id, name, price, quantity_limit, quantity_sold, brands(name)')
    .order('name', { ascending: true });

  if (error || !data || !data.length) {
    select.innerHTML = '<option value="">No ticket types available</option>';
    return;
  }

  select.innerHTML = '<option value="">Select ticket type</option>' + data.map((t) => {
    const left = t.quantity_limit - t.quantity_sold;
    const label = `${(t.brands && t.brands.name) || ''} · ${t.name} · KES ${Number(t.price).toLocaleString('en-KE')} (${left} left)`;
    return `<option value="${t.id}" ${left <= 0 ? 'disabled' : ''}>${escapeHtmlAdmin(label)}</option>`;
  }).join('');
}

function wireAdminIssueTicket() {
  const form = document.getElementById('admin-issue-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('issue-error');
    errorEl.hidden = true;

    const whatsapp = document.getElementById('issue-buyer-whatsapp').value.trim();
    const { data, error } = await supabaseClient.rpc('admin_issue_ticket', {
      p_ticket_type_id: document.getElementById('issue-ticket-type').value,
      p_buyer_name: document.getElementById('issue-buyer-name').value.trim(),
      p_buyer_whatsapp: whatsapp,
      p_method: document.getElementById('issue-method').value,
      p_note: document.getElementById('issue-note').value.trim(),
    });

    if (error || !data || !data.length) {
      errorEl.textContent = (error && error.message) || 'Could not issue ticket.';
      errorEl.hidden = false;
      return;
    }

    form.reset();
    loadIssueTicketTypes();
    showTicketConfirmation(data[0], whatsapp);
  });
}
