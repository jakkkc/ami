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
          : `<button class="btn-primary buy-ticket-btn" data-id="${t.id}" data-name="${escapeHtmlBrands(t.name)}" data-event="${escapeHtmlBrands(eventTitle)}" data-price="${Number(t.price)}">Get Ticket</button>`
        }
      </div>
    `;
  }).join('');

  list.querySelectorAll('.buy-ticket-btn').forEach((btn) => {
    btn.addEventListener('click', () => openTicketPurchaseModal(btn.dataset.id, btn.dataset.name, btn.dataset.event, btn.dataset.price));
  });
}

function openTicketPurchaseModal(ticketTypeId, ticketTypeName, eventTitle, price) {
  const form = document.getElementById('ticket-purchase-form');
  form.reset();
  applyPaymentModeToPurchaseModal(price);
  document.getElementById('purchase-ticket-type-id').value = ticketTypeId;
  document.getElementById('purchase-ticket-type-name').textContent = `${ticketTypeName} — ${eventTitle}`;
  document.getElementById('ticket-purchase-error').hidden = true;
  closeBrandModal();
  document.getElementById('ticket-purchase-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

const SUPABASE_PROJECT_URL = 'https://yfckrixgbzgyprmdcfte.supabase.co';

// 'manual' = buyer pays the Till and an admin approves the ticket.
// 'stk'    = automatic M-Pesa STK Push (needs Daraja production go-live).
const PAYMENT_MODE = 'manual';
const MPESA_TILL_NUMBER = '633139';
const MPESA_TILL_NAME = 'MADE IT LIMITED';
const TICKET_WHATSAPP_NUMBER = '254741063322';

function applyPaymentModeToPurchaseModal(price) {
  const manual = PAYMENT_MODE === 'manual';
  document.getElementById('manual-pay-instructions').hidden = !manual;
  document.getElementById('mpesa-code-row').hidden = !manual;
  document.getElementById('buyer-mpesa-code').required = manual;
  document.querySelector('#ticket-purchase-form button[type="submit"]').textContent = manual ? 'Submit Payment Details' : 'Get Ticket';
  if (manual) {
    document.getElementById('pay-till-number').textContent = MPESA_TILL_NUMBER;
    document.getElementById('pay-till-name').textContent = MPESA_TILL_NAME;
    document.getElementById('pay-amount').textContent = `KES ${Number(price).toLocaleString('en-KE')}`;
  }
}

async function submitManualTicketOrder(ticketTypeId, buyerName, buyerWhatsapp) {
  const errorEl = document.getElementById('ticket-purchase-error');
  const submitBtn = document.querySelector('#ticket-purchase-form button[type="submit"]');
  const mpesaCode = document.getElementById('buyer-mpesa-code').value.trim().toUpperCase();

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  const { data, error } = await supabaseClient.rpc('submit_manual_ticket_order', {
    p_ticket_type_id: ticketTypeId,
    p_buyer_name: buyerName,
    p_buyer_whatsapp: buyerWhatsapp,
    p_mpesa_code: mpesaCode,
  });

  submitBtn.disabled = false;
  submitBtn.textContent = 'Submit Payment Details';

  if (error || !data || !data.length) {
    errorEl.textContent = (error && error.message) || 'Could not submit your order. Please try again.';
    errorEl.hidden = false;
    return;
  }

  document.getElementById('ticket-purchase-modal').hidden = true;
  showOrderReceived(buyerName, buyerWhatsapp, mpesaCode);
}

function showOrderReceived(buyerName, buyerWhatsapp, mpesaCode) {
  const typeLabel = document.getElementById('purchase-ticket-type-name').textContent;
  const msg = `Hello, I have paid for a ticket (${typeLabel}). Name: ${buyerName}. M-Pesa code: ${mpesaCode}. Please confirm.`;
  document.getElementById('order-received-whatsapp').href =
    `https://wa.me/${TICKET_WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;

  document.getElementById('order-received-lookup-btn').onclick = () => {
    document.getElementById('order-received-modal').hidden = true;
    openMyTicketLookup(buyerWhatsapp, mpesaCode);
  };

  document.getElementById('order-received-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function openMyTicketLookup(whatsapp, mpesaCode) {
  document.getElementById('lookup-whatsapp').value = whatsapp || '';
  document.getElementById('lookup-mpesa-code').value = mpesaCode || '';
  const msgEl = document.getElementById('my-ticket-message');
  msgEl.hidden = true;
  document.getElementById('my-ticket-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

async function lookupMyTicket(e) {
  e.preventDefault();
  const msgEl = document.getElementById('my-ticket-message');
  const whatsapp = document.getElementById('lookup-whatsapp').value.trim();
  const code = document.getElementById('lookup-mpesa-code').value.trim();

  const { data, error } = await supabaseClient.rpc('lookup_manual_ticket', {
    p_whatsapp: whatsapp,
    p_mpesa_code: code,
  });

  msgEl.hidden = false;
  if (error) { msgEl.textContent = 'Something went wrong. Please try again.'; return; }
  if (!data || !data.length) { msgEl.textContent = 'No order found. Check the number and code you used.'; return; }

  const t = data[0];
  if (t.status === 'pending') { msgEl.textContent = 'Your payment is still being confirmed. Please check again shortly.'; return; }
  if (t.status === 'rejected') { msgEl.textContent = 'We could not confirm this payment. Please contact us on WhatsApp.'; return; }

  document.getElementById('my-ticket-modal').hidden = true;
  showTicketConfirmation(t, whatsapp);
}

async function submitTicketPurchase(e) {
  e.preventDefault();
  const ticketTypeId = document.getElementById('purchase-ticket-type-id').value;
  const buyerName = document.getElementById('buyer-name').value.trim();
  const buyerWhatsapp = document.getElementById('buyer-whatsapp').value.trim();
  const errorEl = document.getElementById('ticket-purchase-error');
  errorEl.hidden = true;

  if (PAYMENT_MODE === 'manual') {
    return submitManualTicketOrder(ticketTypeId, buyerName, buyerWhatsapp);
  }

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

/* ---------- TICKET ARTWORK (canvas) ----------
   The whole ticket is drawn on one canvas so the card shown on screen is
   exactly the image that gets downloaded or shared. */
const TICKET_GOLD = '#D4AF37';
const TICKET_GOLD_LIGHT = '#FCF6BA';

function loadTicketImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrapTicketText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function ticketRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function ticketSpacedText(ctx, text, x, y, spacing) {
  ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(text, x + spacing / 2, y); // offset so trailing spacing stays centred
  ctx.letterSpacing = '0px';
}

function ticketDivider(ctx, cx, y, halfWidth) {
  const grad = ctx.createLinearGradient(cx - halfWidth, 0, cx + halfWidth, 0);
  grad.addColorStop(0, 'rgba(212,175,55,0)');
  grad.addColorStop(0.5, TICKET_GOLD);
  grad.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - halfWidth, y);
  ctx.lineTo(cx - 22, y);
  ctx.moveTo(cx + 22, y);
  ctx.lineTo(cx + halfWidth, y);
  ctx.stroke();
  ctx.fillStyle = TICKET_GOLD;
  ctx.beginPath();
  ctx.moveTo(cx, y - 9);
  ctx.lineTo(cx + 9, y);
  ctx.lineTo(cx, y + 9);
  ctx.lineTo(cx - 9, y);
  ctx.closePath();
  ctx.fill();
}

async function renderTicketCanvas(ticket) {
  try {
    await Promise.all([
      document.fonts.load('700 64px "Playfair Display"'),
      document.fonts.load('600 28px "Inter"'),
      document.fonts.load('400 28px "Inter"'),
    ]);
  } catch (err) { /* fall back to system fonts */ }

  const W = 1000;
  const cx = W / 2;
  const heading = '"Playfair Display", "Cormorant Garamond", Georgia, serif';
  const body = '"Inter", "DM Sans", Arial, sans-serif';

  // QR code (generated off-screen, then drawn into the ticket)
  const holder = document.createElement('div');
  new QRCode(holder, {
    text: ticket.ticket_code,
    width: 440,
    height: 440,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H,
  });
  const qrSource = holder.querySelector('canvas') || holder.querySelector('img');
  const logo = await loadTicketImage('/assets/logo.png');

  // Measure the title so the ticket height fits the content
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `700 70px ${heading}`;
  const titleLines = wrapTicketText(measure, ticket.event_title || '', 760).slice(0, 3);

  const dateObj = ticket.event_date ? new Date(ticket.event_date) : null;
  const dateLine = dateObj
    ? dateObj.toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
    : '';
  const timeLine = dateObj
    ? dateObj.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
    : '';

  // Vertical layout
  const logoBox = { w: 300, h: 130 };
  let y = 110;
  const logoY = y;
  y += logoBox.h + 70;
  const brandY = y;
  y += 90;
  const titleY = y;
  y += titleLines.length * 84;
  y += 20;
  const dividerY = y;
  y += 70;
  const dateY = y;
  if (dateLine) y += 48;
  const timeY = y;
  if (timeLine) y += 48;
  const locationY = y;
  if (ticket.event_location) y += 48;
  y += 50;
  const perfY = y;
  y += 80;
  const qrBoxSize = 500;
  const qrBoxY = y;
  y += qrBoxSize + 70;
  const codeY = y;
  y += 70;
  const typeY = y;
  y += 52;
  const metaY = y;
  y += 80;
  const footY = y;
  const H = footY + 90;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Card body
  ticketRoundRect(ctx, 0, 0, W, H, 40);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d0d0d');
  bg.addColorStop(1, '#000000');
  ctx.fillStyle = bg;
  ctx.fill();

  // Soft gold glow behind the header
  ctx.save();
  ticketRoundRect(ctx, 0, 0, W, H, 40);
  ctx.clip();
  const glow = ctx.createRadialGradient(cx, 160, 20, cx, 160, 560);
  glow.addColorStop(0, 'rgba(212,175,55,0.22)');
  glow.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, perfY);
  ctx.restore();

  // Double gold frame
  const frame = ctx.createLinearGradient(0, 0, W, H);
  frame.addColorStop(0, '#BF953F');
  frame.addColorStop(0.35, TICKET_GOLD_LIGHT);
  frame.addColorStop(0.65, '#B38728');
  frame.addColorStop(1, '#AA771C');
  ctx.strokeStyle = frame;
  ctx.lineWidth = 4;
  ticketRoundRect(ctx, 4, 4, W - 8, H - 8, 38);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.55;
  ticketRoundRect(ctx, 30, 30, W - 60, H - 60, 26);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Logo
  if (logo) {
    const scale = Math.min(logoBox.w / logo.width, logoBox.h / logo.height);
    const lw = logo.width * scale;
    const lh = logo.height * scale;
    ctx.drawImage(logo, cx - lw / 2, logoY + (logoBox.h - lh) / 2, lw, lh);
  }

  // Brand and event
  ctx.fillStyle = TICKET_GOLD;
  ctx.font = `600 28px ${body}`;
  ticketSpacedText(ctx, String(ticket.brand_name || '').toUpperCase(), cx, brandY, 9);

  ctx.fillStyle = '#ffffff';
  ctx.font = `700 70px ${heading}`;
  titleLines.forEach((line, i) => ctx.fillText(line, cx, titleY + i * 84));

  ticketDivider(ctx, cx, dividerY, 280);

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `500 28px ${body}`;
  if (dateLine) ticketSpacedText(ctx, dateLine, cx, dateY, 4);
  if (timeLine) {
    ctx.fillStyle = TICKET_GOLD;
    ticketSpacedText(ctx, timeLine, cx, timeY, 4);
  }
  if (ticket.event_location) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `400 26px ${body}`;
    ticketSpacedText(ctx, String(ticket.event_location).toUpperCase(), cx, locationY, 3);
  }

  // Perforation with side notches
  ctx.strokeStyle = 'rgba(212,175,55,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(70, perfY);
  ctx.lineTo(W - 70, perfY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  [0, W].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, perfY, 34, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  ctx.strokeStyle = frame;
  ctx.lineWidth = 4;
  [0, W].forEach((x) => {
    ctx.beginPath();
    ctx.arc(x, perfY, 34, 0, Math.PI * 2);
    ctx.stroke();
  });

  // QR card
  const qrBoxX = cx - qrBoxSize / 2;
  ticketRoundRect(ctx, qrBoxX - 6, qrBoxY - 6, qrBoxSize + 12, qrBoxSize + 12, 28);
  ctx.fillStyle = frame;
  ctx.fill();
  ticketRoundRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 24);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  if (qrSource) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrSource, cx - 220, qrBoxY + 30, 440, 440);
  }

  // Code, type and details
  ctx.fillStyle = TICKET_GOLD;
  ctx.font = `700 54px ${heading}`;
  ticketSpacedText(ctx, String(ticket.ticket_code || ''), cx, codeY, 8);

  ctx.fillStyle = '#ffffff';
  ctx.font = `600 34px ${heading}`;
  ctx.fillText(String(ticket.ticket_type_name || ''), cx, typeY);

  const people = Number(ticket.people_count) || 1;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `500 24px ${body}`;
  ticketSpacedText(ctx, `ADMITS ${people}  ·  KES ${Number(ticket.price_paid).toLocaleString('en-KE')}`, cx, metaY, 4);

  ctx.fillStyle = 'rgba(212,175,55,0.8)';
  ctx.font = `500 20px ${body}`;
  ticketSpacedText(ctx, 'PRESENT THIS TICKET AT ENTRY', cx, footY, 5);

  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Ticket ${ticket.ticket_code} for ${ticket.event_title || 'the event'}`);
  return canvas;
}

async function showTicketConfirmation(ticket, buyerWhatsapp) {
  const qrContainer = document.getElementById('confirmation-qr');
  qrContainer.innerHTML = '';
  qrContainer.appendChild(await renderTicketCanvas(ticket));

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
  document.getElementById('my-ticket-form').addEventListener('submit', lookupMyTicket);

  const openLookupFromHash = () => {
    if (location.hash === '#ticket') openMyTicketLookup();
  };
  document.getElementById('footer-my-ticket-link').addEventListener('click', (e) => {
    e.preventDefault();
    openMyTicketLookup();
  });
  window.addEventListener('hashchange', openLookupFromHash);
  openLookupFromHash();

  document.querySelectorAll('.ticket-modal-close').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.modal).hidden = true;
      document.body.style.overflow = '';
    });
  });
});
