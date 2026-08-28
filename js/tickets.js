// AMI Designs & Events — Ticketing: render available tickets, purchase flow, QR confirmation

function formatEventDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderBrandTickets(brand) {
  const wrap = document.getElementById('brand-modal-tickets');
  const hasLiveEvent = brand.event_active && brand.event_title && brand.event_date;

  if (!hasLiveEvent) {
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  document.getElementById('event-title').textContent = brand.event_title;
  document.getElementById('event-meta').textContent =
    `${formatEventDate(brand.event_date)}${brand.event_location ? ' · ' + brand.event_location : ''}`;
  document.getElementById('event-description').textContent = brand.event_description || '';

  loadTicketTypesForBrand(brand.id, brand.event_title, brand.name);
}

async function loadTicketTypesForBrand(brandId, eventTitle, brandName) {
  const list = document.getElementById('ticket-types-list');
  list.innerHTML = '<p class="admin-loading">Loading tickets…</p>';

  const { data, error } = await supabaseClient
    .from('ticket_types')
    .select('*')
    .eq('brand_id', brandId)
    .order('price', { ascending: true });

  if (error || !data || !data.length) {
    list.innerHTML = '<p class="admin-empty">Tickets are not on sale yet.</p>';
    return;
  }

  const now = new Date();

  list.innerHTML = data.map((t) => {
    const expired = t.expires_at && new Date(t.expires_at) < now;
    const soldOut = t.quantity_sold >= t.quantity_limit;
    const remaining = t.quantity_limit - t.quantity_sold;
    const unavailable = expired || soldOut;

    return `
      <div class="ticket-type-row glass-card ${unavailable ? 'ticket-unavailable' : ''}">
        <div>
          <p class="ticket-type-name">${escapeHtmlBrands(t.name)}</p>
          <p class="ticket-type-meta">KES ${Number(t.price).toLocaleString('en-KE')} · Admits ${t.people_count} ${t.people_count > 1 ? 'people' : 'person'}</p>
          ${expired ? '<p class="ticket-type-flag">Offer closed</p>' : soldOut ? '<p class="ticket-type-flag">Sold out</p>' : `<p class="ticket-type-flag ticket-type-remaining">${remaining} left</p>`}
        </div>
        ${unavailable
          ? `<button class="btn-secondary" disabled>Unavailable</button>`
          : `<button class="btn-primary buy-ticket-btn" data-id="${t.id}" data-name="${escapeHtmlBrands(t.name)}" data-event="${escapeHtmlBrands(eventTitle)}">Get Ticket</button>`
        }
      </div>
    `;
  }).join('');

  list.querySelectorAll('.buy-ticket-btn').forEach((btn) => {
    btn.addEventListener('click', () => openTicketPurchaseModal(btn.dataset.id, btn.dataset.name, btn.dataset.event));
  });
}

function openTicketPurchaseModal(ticketTypeId, ticketTypeName, eventTitle) {
  const form = document.getElementById('ticket-purchase-form');
  form.reset();
  document.getElementById('purchase-ticket-type-id').value = ticketTypeId;
  document.getElementById('purchase-ticket-type-name').textContent = `${ticketTypeName} — ${eventTitle}`;
  document.getElementById('ticket-purchase-error').hidden = true;
  closeBrandModal();
  document.getElementById('ticket-purchase-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

async function submitTicketPurchase(e) {
  e.preventDefault();
  const ticketTypeId = document.getElementById('purchase-ticket-type-id').value;
  const buyerName = document.getElementById('buyer-name').value.trim();
  const buyerWhatsapp = document.getElementById('buyer-whatsapp').value.trim();
  const errorEl = document.getElementById('ticket-purchase-error');
  errorEl.hidden = true;

  const submitBtn = document.querySelector('#ticket-purchase-form button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing…';

  const { data, error } = await supabaseClient.rpc('purchase_ticket', {
    p_ticket_type_id: ticketTypeId,
    p_buyer_name: buyerName,
    p_buyer_whatsapp: buyerWhatsapp,
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Get Ticket';

  if (error || !data || !data.length) {
    errorEl.textContent = (error && error.message) || 'Something went wrong. Please try again.';
    errorEl.hidden = false;
    return;
  }

  document.getElementById('ticket-purchase-modal').hidden = true;
  showTicketConfirmation(data[0], buyerWhatsapp);
}

function showTicketConfirmation(ticket, buyerWhatsapp) {
  document.getElementById('confirmation-event-title').textContent = `${ticket.brand_name} — ${ticket.event_title}`;
  document.getElementById('confirmation-code').textContent = `Ticket Code: ${ticket.ticket_code}`;
  document.getElementById('confirmation-details').textContent =
    `${ticket.ticket_type_name} · Admits ${ticket.people_count} · KES ${Number(ticket.price_paid).toLocaleString('en-KE')}` +
    (ticket.event_date ? ` · ${formatEventDate(ticket.event_date)}` : '') +
    (ticket.event_location ? ` · ${ticket.event_location}` : '');

  const qrContainer = document.getElementById('confirmation-qr');
  qrContainer.innerHTML = '<canvas id="confirmation-qr-canvas"></canvas>';
  QRCode.toCanvas(document.getElementById('confirmation-qr-canvas'), ticket.ticket_code, { width: 200, margin: 1 });

  const shareText = encodeURIComponent(
    `🎟️ AMI Designs & Events Ticket\n${ticket.brand_name} — ${ticket.event_title}\n${ticket.ticket_type_name}\nCode: ${ticket.ticket_code}\nAdmits: ${ticket.people_count}\n\nPresent this code/QR at entry.`
  );
  const digits = buyerWhatsapp.replace(/[^0-9]/g, '');
  document.getElementById('confirmation-whatsapp-btn').href = `https://wa.me/${digits}?text=${shareText}`;

  document.getElementById('ticket-confirmation-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('ticket-purchase-form').addEventListener('submit', submitTicketPurchase);

  document.querySelectorAll('.ticket-modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.modal).hidden = true;
      document.body.style.overflow = '';
    });
  });
});
