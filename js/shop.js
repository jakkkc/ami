// AMI Designs & Events — Shop: fetch products from Supabase, filter, WhatsApp order

let shopItems = [];
let activeShopFilter = 'All';

const WHATSAPP_NUMBER = '254741063322';

async function loadShop() {
  const grid = document.getElementById('shop-grid');
  const emptyMsg = document.getElementById('shop-empty');

  const { data, error } = await supabaseClient
    .from('products')
    .select('id, name, description, price, category, image_url, in_stock, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Shop load error:', error.message);
    grid.innerHTML = '';
    emptyMsg.hidden = false;
    emptyMsg.textContent = 'Unable to load products right now. Please try again shortly.';
    return;
  }

  shopItems = data || [];
  renderShop();
}

function renderShop() {
  const grid = document.getElementById('shop-grid');
  const emptyMsg = document.getElementById('shop-empty');

  const filtered = activeShopFilter === 'All'
    ? shopItems
    : shopItems.filter((item) => item.category === activeShopFilter);

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyMsg.hidden = false;
    emptyMsg.textContent = shopItems.length === 0
      ? 'No products listed yet — check back soon.'
      : `No products in "${activeShopFilter}" yet.`;
    return;
  }

  emptyMsg.hidden = true;
  grid.innerHTML = filtered.map((item, i) => {
    const priceFormatted = item.price != null
      ? `KES ${Number(item.price).toLocaleString('en-KE')}`
      : '';
    const outOfStock = item.in_stock === false;
    const waMessage = encodeURIComponent(
      `Hi AMI Designs! I'd like to order: ${item.name} — ${priceFormatted}. Please confirm availability.`
    );

    return `
      <div class="glass-card product-card fade-up-scroll in-view ${outOfStock ? 'out-of-stock' : ''}" style="--delay:${(i % 4) * 80}ms">
        <div class="product-image-wrap">
          <img src="${item.image_url || ''}" alt="${escapeHtml(item.name || '')}" loading="lazy">
          ${outOfStock ? '<span class="oos-badge">Out of Stock</span>' : ''}
        </div>
        <div class="product-body">
          <h3 class="product-name">${escapeHtml(item.name || '')}</h3>
          ${priceFormatted ? `<p class="product-price">${priceFormatted}</p>` : ''}
          <p class="product-desc">${escapeHtml(item.description || '')}</p>
          ${outOfStock
            ? `<button class="btn-secondary product-order-btn" disabled>Currently Unavailable</button>`
            : `<a class="btn-primary product-order-btn" href="https://wa.me/${WHATSAPP_NUMBER}?text=${waMessage}" target="_blank" rel="noopener">
                 <svg width="18" height="18" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
                   <path d="M16.02 3C9.4 3 4 8.4 4 15.02c0 2.2.58 4.28 1.6 6.06L4 29l8.1-1.56a11.9 11.9 0 0 0 3.9.66C22.6 28.1 28 22.7 28 16.08 28 9.46 22.62 3 16.02 3zm0 21.6c-1.32 0-2.6-.28-3.78-.82l-.27-.14-4.8.92.94-4.68-.16-.28a9.4 9.4 0 0 1-1.42-4.98c0-5.2 4.24-9.4 9.5-9.4 5.24 0 9.48 4.2 9.48 9.4 0 5.2-4.24 9.4-9.5 9.4zm5.2-7.02c-.28-.14-1.66-.82-1.92-.9-.26-.1-.44-.14-.64.14-.18.28-.74.9-.9 1.08-.16.18-.34.2-.62.08-.28-.14-1.18-.44-2.24-1.4-.82-.74-1.38-1.66-1.54-1.94-.16-.28-.02-.44.12-.58.12-.12.28-.32.42-.48.14-.16.18-.28.28-.46.1-.18.04-.34-.02-.48-.06-.14-.64-1.56-.88-2.14-.24-.56-.48-.48-.64-.5h-.56c-.18 0-.48.08-.74.36-.26.28-1 .98-1 2.4 0 1.42 1.02 2.78 1.16 2.98.14.2 2.02 3.14 4.94 4.4.68.3 1.22.48 1.64.6.68.22 1.32.18 1.82.1.56-.08 1.66-.68 1.9-1.34.24-.66.24-1.22.16-1.34-.08-.12-.26-.18-.54-.32z"/>
                 </svg>
                 Order via WhatsApp
               </a>`
          }
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  loadShop();

  document.querySelectorAll('.shop-filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.shop-filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      activeShopFilter = tab.dataset.filter;
      renderShop();
    });
  });
});
