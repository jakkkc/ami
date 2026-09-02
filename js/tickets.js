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

const SUPABASE_PROJECT_URL = 'https://yfckrixgbzgyprmdcfte.supabase.co';

async function submitTicketPurchase(e) {
  e.preventDefault();
  const ticketTypeId = document.getElementById('purchase-ticket-type-id').value;
  const buyerName = document.getElementById('buyer-name').value.trim();
  const buyerWhatsapp = document.getElementById('buyer-whatsapp').value.trim();
  const errorEl = document.getElementById('ticket-purchase-error');
  errorEl.hidden = true;

  const submitBtn = document.querySelector('#ticket-purchase-form button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Starting payment…';

  try {
    const res = await fetch(`${SUPABASE_PROJECT_URL}/functions/v1/mpesa-stk-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ ticket_type_id: ticketTypeId, buyer_name: buyerName, buyer_whatsapp: buyerWhatsapp }),
    });
    const result = await res.json();

    submitBtn.disabled = false;
    submitBtn.textContent = 'Get Ticket';

    if (!res.ok || !result.checkout_request_id) {
      errorEl.textContent = result.error || 'Could not start payment. Please try again.';
      errorEl.hidden = false;
      return;
    }

    document.getElementById('ticket-purchase-modal').hidden = true;
    showPaymentWaiting(result.checkout_request_id, buyerWhatsapp);
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Get Ticket';
    errorEl.textContent = 'Network error. Please check your connection and try again.';
    errorEl.hidden = false;
  }
}

function showPaymentWaiting(checkoutRequestId, buyerWhatsapp) {
  const modal = document.getElementById('payment-waiting-modal');
  const textEl = document.getElementById('payment-waiting-text');
  const errorEl = document.getElementById('payment-waiting-error');
  const closeBtn = document.getElementById('payment-cancel-btn');

  textEl.textContent = 'Enter your M-Pesa PIN on the prompt sent to your phone to complete this purchase.';
  textEl.hidden = false;
  errorEl.hidden = true;
  closeBtn.hidden = true;
  modal.querySelector('.payment-spinner').hidden = false;

  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  let attempts = 0;
  const maxAttempts = 30; // ~90 seconds at 3s intervals

  const poll = setInterval(async () => {
    attempts++;

    const { data, error } = await supabaseClient.rpc('get_transaction_status', {
      p_checkout_request_id: checkoutRequestId,
    });

    if (error) {
      console.error('Status check error:', error.message);
    } else if (data && data.length) {
      const status = data[0].status;

      if (status === 'success') {
        clearInterval(poll);
        const { data: ticketData } = await supabaseClient.rpc('get_ticket_confirmation', {
          p_ticket_id: data[0].ticket_id,
        });
        modal.hidden = true;
        if (ticketData && ticketData.length) {
          showTicketConfirmation(ticketData[0], buyerWhatsapp);
        }
        return;
      }

      if (status === 'failed') {
        clearInterval(poll);
        modal.querySelector('.payment-spinner').hidden = true;
        textEl.hidden = true;
        errorEl.textContent = data[0].result_desc || 'Payment was not completed. No charge was made — please try again.';
        errorEl.hidden = false;
        closeBtn.hidden = false;
        return;
      }

      if (status === 'paid_no_ticket') {
        clearInterval(poll);
        modal.querySelector('.payment-spinner').hidden = true;
        textEl.hidden = true;
        errorEl.textContent = 'Payment was received, but we could not issue your ticket automatically. Please contact us on WhatsApp with your M-Pesa message so we can sort this out.';
        errorEl.hidden = false;
        closeBtn.hidden = false;
        return;
      }
    }

    if (attempts >= maxAttempts) {
      clearInterval(poll);
      modal.querySelector('.payment-spinner').hidden = true;
      textEl.hidden = true;
      errorEl.textContent = "This is taking longer than expected. If you completed the M-Pesa prompt, please contact us on WhatsApp with your confirmation message — otherwise no charge was made.";
      errorEl.hidden = false;
      closeBtn.hidden = false;
    }
  }, 3000);

  closeBtn.onclick = () => {
    clearInterval(poll);
    modal.hidden = true;
    document.body.style.overflow = '';
  };
}

function showTicketConfirmation(ticket, buyerWhatsapp) {
  document.getElementById('confirmation-event-title').textContent = `${ticket.brand_name} · ${ticket.event_title}`;
  document.getElementById('confirmation-code').textContent = `Ticket Code: ${ticket.ticket_code}`;
  document.getElementById('confirmation-details').textContent =
    `${ticket.ticket_type_name} · Admits ${ticket.people_count} · KES ${Number(ticket.price_paid).toLocaleString('en-KE')}` +
    (ticket.event_date ? ` · ${formatEventDate(ticket.event_date)}` : '') +
    (ticket.event_location ? ` · ${ticket.event_location}` : '');

  const qrContainer = document.getElementById('confirmation-qr');
  qrContainer.innerHTML = '';
  new QRCode(qrContainer, {
    text: ticket.ticket_code,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });

  const shareCaption =
    `AMI Designs & Events Ticket\n${ticket.brand_name} · ${ticket.event_title}\n${ticket.ticket_type_name}\nCode: ${ticket.ticket_code}\nAdmits: ${ticket.people_count}\n\nPresent this QR/code at entry.`;
  const digits = buyerWhatsapp.replace(/[^0-9]/g, '');
  const fileName = `AMI-Ticket-${ticket.ticket_code}.png`;

  const whatsappBtn = document.getElementById('confirmation-whatsapp-btn');
  const downloadBtn = document.getElementById('confirmation-download-btn');

  whatsappBtn.onclick = async () => {
    const canvas = qrContainer.querySelector('canvas');
    if (!canvas) {
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(shareCaption)}`, '_blank');
      return;
    }

    canvas.toBlob(async (blob) => {
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: shareCaption });
          return;
        } catch (err) {
          // User cancelled or share failed — fall through to text-link fallback below.
        }
      }

      // Fallback for browsers without file-sharing support (mostly desktop):
      // open the text-only WhatsApp link and prompt to attach the downloaded image.
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(shareCaption + '\n\n(Your ticket image has been downloaded — attach it in WhatsApp.)')}`, '_blank');
    }, 'image/png');
  };

  downloadBtn.onclick = () => {
    const canvas = qrContainer.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = fileName;
    link.click();
  };

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
