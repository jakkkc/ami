// AMI Designs & Events — Gallery: fetch from Supabase, render, filter, lightbox

let galleryItems = [];
let activeFilter = 'All';

async function loadGallery() {
  const grid = document.getElementById('gallery-grid');
  const emptyMsg = document.getElementById('gallery-empty');

  const { data, error } = await supabaseClient
    .from('gallery_items')
    .select('id, title, category, image_url, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Gallery load error:', error.message);
    grid.innerHTML = '';
    emptyMsg.hidden = false;
    emptyMsg.textContent = 'Unable to load gallery right now. Please try again shortly.';
    return;
  }

  galleryItems = data || [];
  renderGallery();
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  const emptyMsg = document.getElementById('gallery-empty');

  const filtered = activeFilter === 'All'
    ? galleryItems
    : galleryItems.filter((item) => item.category === activeFilter);

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyMsg.hidden = false;
    emptyMsg.textContent = galleryItems.length === 0
      ? 'No gallery items yet — check back soon.'
      : `No items in "${activeFilter}" yet.`;
    return;
  }

  emptyMsg.hidden = true;
  grid.innerHTML = filtered.map((item, i) => `
    <div class="gallery-item fade-up-scroll in-view" style="--delay:${(i % 4) * 80}ms" data-id="${item.id}">
      <img src="${item.image_url}" alt="${escapeHtml(item.title || '')}" loading="lazy">
      <div class="gallery-overlay">
        <p class="gallery-item-title">${escapeHtml(item.title || '')}</p>
        <p class="gallery-item-category eyebrow">${escapeHtml(item.category || '')}</p>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.gallery-item').forEach((el) => {
    el.addEventListener('click', () => openLightbox(el.dataset.id));
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function openLightbox(id) {
  const item = galleryItems.find((g) => String(g.id) === String(id));
  if (!item) return;

  document.getElementById('lightbox-img').src = item.image_url;
  document.getElementById('lightbox-img').alt = item.title || '';
  document.getElementById('lightbox-title').textContent = item.title || '';
  document.getElementById('lightbox-category').textContent = item.category || '';
  document.getElementById('lightbox').hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  document.getElementById('lightbox').hidden = true;
  document.body.style.overflow = '';
}

document.addEventListener('DOMContentLoaded', () => {
  loadGallery();

  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeFilter = tab.dataset.filter;
      renderGallery();
    });
  });

  document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', (e) => {
    if (e.target.id === 'lightbox') closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
});
