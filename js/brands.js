// AMI Designs & Events — Our Experiences (sub-brands): fetch, render, expand modal

let brandItems = [];

function escapeHtmlBrands(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function loadBrands() {
  const grid = document.getElementById('brands-grid');
  const emptyMsg = document.getElementById('brands-empty');

  const { data, error } = await supabaseClient
    .from('brands')
    .select('id, name, tagline, description, highlights, image_url, created_at, event_title, event_date, event_location, event_description, event_active')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Brands load error:', error.message);
    grid.innerHTML = '';
    emptyMsg.hidden = false;
    emptyMsg.textContent = 'Unable to load experiences right now.';
    return;
  }

  brandItems = data || [];
  renderBrands();
}

function renderBrands() {
  const grid = document.getElementById('brands-grid');
  const emptyMsg = document.getElementById('brands-empty');

  if (!brandItems.length) {
    grid.innerHTML = '';
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  grid.innerHTML = brandItems.map((b, i) => {
    const excerpt = (b.description || '').split('\n').filter(Boolean)[0] || '';
    return `
      <div class="glass-card brand-card fade-up-scroll in-view" style="--delay:${i * 100}ms" data-id="${b.id}">
        ${b.image_url ? `<div class="brand-card-img"><img src="${b.image_url}" alt="${escapeHtmlBrands(b.name)}" loading="lazy"></div>` : '<div class="brand-card-img brand-card-img-placeholder"></div>'}
        <div class="brand-card-body">
          <p class="brand-card-tagline eyebrow">${escapeHtmlBrands(b.tagline || '')}</p>
          <h3 class="brand-card-name">${escapeHtmlBrands(b.name)}</h3>
          <p class="brand-card-excerpt">${escapeHtmlBrands(excerpt)}</p>
          ${b.event_active ? '<p class="ticket-type-remaining" style="margin-bottom:0.6rem;">🎟️ Tickets on sale</p>' : ''}
          <button class="btn-secondary brand-view-more" data-id="${b.id}">View More</button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.brand-view-more').forEach((btn) => {
    btn.addEventListener('click', () => openBrandModal(btn.dataset.id));
  });
}

function openBrandModal(id) {
  const brand = brandItems.find((b) => String(b.id) === String(id));
  if (!brand) return;

  const img = document.getElementById('brand-modal-img');
  if (brand.image_url) {
    img.src = brand.image_url;
    img.alt = brand.name;
    img.hidden = false;
  } else {
    img.hidden = true;
  }

  document.getElementById('brand-modal-tagline').textContent = brand.tagline || '';
  document.getElementById('brand-modal-name').textContent = brand.name || '';
  document.getElementById('brand-modal-description').innerHTML =
    (brand.description || '').split('\n').filter(Boolean).map((p) => `<p>${escapeHtmlBrands(p)}</p>`).join('');

  const highlightsList = document.getElementById('brand-modal-highlights');
  highlightsList.innerHTML = (brand.highlights || []).map((h) => `<li>${escapeHtmlBrands(h)}</li>`).join('');

  if (typeof renderBrandTickets === 'function') renderBrandTickets(brand);

  document.getElementById('brand-modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeBrandModal() {
  document.getElementById('brand-modal').hidden = true;
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
  loadBrands();

  document.querySelector('.brand-modal-close').addEventListener('click', closeBrandModal);
  document.getElementById('brand-modal').addEventListener('click', (e) => {
    if (e.target.id === 'brand-modal') closeBrandModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBrandModal();
  });
});
