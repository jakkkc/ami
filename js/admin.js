// AMI Designs & Events — Admin dashboard: Inquiries, Gallery Manager, Products, Stats

let adminInitialized = false;

function safeInit(fn, label) {
  try {
    if (typeof fn === 'function') fn();
  } catch (err) {
    console.error(`Admin init error in ${label}:`, err);
  }
}

function initAdminDashboard() {
  if (!adminInitialized) {
    safeInit(wireAdminTabs, 'wireAdminTabs');
    safeInit(wireBrandManager, 'wireBrandManager');
    safeInit(typeof wireCategoryManager === 'function' ? wireCategoryManager : null, 'wireCategoryManager');
    safeInit(wireGalleryManager, 'wireGalleryManager');
    safeInit(wireProductManager, 'wireProductManager');
    safeInit(typeof wireAdminEventModal === 'function' ? wireAdminEventModal : null, 'wireAdminEventModal');
    safeInit(typeof wireTicketScanner === 'function' ? wireTicketScanner : null, 'wireTicketScanner');
    safeInit(typeof wireTicketingSubtabs === 'function' ? wireTicketingSubtabs : null, 'wireTicketingSubtabs');
    adminInitialized = true;
  }
  safeInit(loadAdminInquiries, 'loadAdminInquiries');
  safeInit(loadAdminBrands, 'loadAdminBrands');
  safeInit(typeof loadAdminCategories === 'function' ? loadAdminCategories : null, 'loadAdminCategories');
  safeInit(loadAdminGallery, 'loadAdminGallery');
  safeInit(loadAdminProducts, 'loadAdminProducts');
  safeInit(loadAdminStats, 'loadAdminStats');
}

function escapeHtmlAdmin(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function wireAdminTabs() {
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.admin-tab-content').forEach((c) => { c.hidden = true; });
      document.getElementById(`admin-tab-${tab.dataset.tab}`).hidden = false;
    });
  });
}

/* ---------- INQUIRIES ---------- */
function renderInquiryRow(inq) {
  const waText = encodeURIComponent(`Hi ${inq.name}, thank you for reaching out to AMI Designs & Events regarding your ${inq.event_type || 'event'}. `);
  const digits = (inq.phone || '').replace(/[^0-9]/g, '');
  const waLink = digits ? `https://wa.me/${digits}?text=${waText}` : null;

  return `
    <div class="admin-row glass-card" data-id="${inq.id}">
      <div class="admin-row-main">
        <p class="admin-row-title">${escapeHtmlAdmin(inq.name)} · ${escapeHtmlAdmin(inq.event_type || 'N/A')}</p>
        <p class="admin-row-sub">${escapeHtmlAdmin(inq.email)} · ${escapeHtmlAdmin(inq.phone)}</p>
        <p class="admin-row-sub">Date: ${inq.event_date || 'N/A'} · Budget: ${escapeHtmlAdmin(inq.budget || 'N/A')}</p>
        <p class="admin-row-message">${escapeHtmlAdmin(inq.message || '')}</p>
      </div>
      <div class="admin-row-actions">
        <select class="inquiry-status-select" data-id="${inq.id}">
          <option value="new" ${inq.status === 'new' ? 'selected' : ''}>New</option>
          <option value="in_progress" ${inq.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
          <option value="closed" ${inq.status === 'closed' ? 'selected' : ''}>Closed</option>
        </select>
        ${waLink ? `<a class="btn-secondary admin-wa-btn" href="${waLink}" target="_blank" rel="noopener">WhatsApp Reply</a>` : ''}
      </div>
    </div>
  `;
}

async function loadAdminInquiries() {
  const list = document.getElementById('admin-inquiries-list');
  list.innerHTML = '<p class="admin-loading">Loading inquiries…</p>';

  const { data, error } = await supabaseClient
    .from('inquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = `<p class="admin-error-msg">Failed to load: ${escapeHtmlAdmin(error.message)}</p>`;
    return;
  }
  if (!data.length) {
    list.innerHTML = '<p class="admin-empty">No inquiries yet.</p>';
    return;
  }

  const groups = [
    { key: 'new', label: 'New' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'closed', label: 'Closed' },
  ];

  list.innerHTML = groups.map((g) => {
    const rows = data.filter((inq) => (inq.status || 'new') === g.key);
    return `
      <div class="admin-group">
        <div class="admin-group-header">
          <span>${g.label}</span>
          <span class="admin-group-count">${rows.length}</span>
        </div>
        ${rows.length ? rows.map(renderInquiryRow).join('') : '<p class="admin-empty admin-group-empty">None here.</p>'}
      </div>
    `;
  }).join('');

  list.querySelectorAll('.inquiry-status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const { error } = await supabaseClient.from('inquiries').update({ status: sel.value }).eq('id', sel.dataset.id);
      if (error) { console.error('Status update failed:', error.message); return; }
      loadAdminInquiries();
      loadAdminStats();
    });
  });
}

/* ---------- GALLERY MANAGER ---------- */
function wireGalleryManager() {
  document.getElementById('gallery-upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('gallery-file');
    const title = document.getElementById('gallery-title').value.trim();
    const category = document.getElementById('gallery-category').value;
    const file = fileInput.files[0];
    if (!file) return;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading…';

    const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const { error: uploadError } = await supabaseClient.storage.from('gallery').upload(path, file);

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload';
      return;
    }

    const { data: urlData } = supabaseClient.storage.from('gallery').getPublicUrl(path);
    const { error: insertError } = await supabaseClient
      .from('gallery_items')
      .insert([{ title, category, image_url: urlData.publicUrl }]);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Upload';

    if (insertError) { alert('Save failed: ' + insertError.message); return; }

    e.target.reset();
    loadAdminGallery();
    loadAdminStats();
    if (typeof loadGallery === 'function') loadGallery();
  });
}

async function loadAdminGallery() {
  const list = document.getElementById('admin-gallery-list');
  list.innerHTML = '<p class="admin-loading">Loading…</p>';

  const { data, error } = await supabaseClient.from('gallery_items').select('*').order('created_at', { ascending: false });

  if (error) { list.innerHTML = `<p class="admin-error-msg">${escapeHtmlAdmin(error.message)}</p>`; return; }
  if (!data.length) { list.innerHTML = '<p class="admin-empty">No gallery items yet.</p>'; return; }

  list.innerHTML = data.map((item) => `
    <div class="admin-gallery-item glass-card" data-id="${item.id}">
      <img src="${item.image_url}" alt="${escapeHtmlAdmin(item.title || '')}">
      <p class="admin-row-title">${escapeHtmlAdmin(item.title || '')}</p>
      <p class="admin-row-sub">${escapeHtmlAdmin(item.category || '')}</p>
      <button class="btn-danger admin-delete-gallery-btn" data-id="${item.id}" data-url="${item.image_url}">Delete</button>
    </div>
  `).join('');

  list.querySelectorAll('.admin-delete-gallery-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this gallery item?')) return;
      const path = (btn.dataset.url || '').split('/gallery/')[1];
      if (path) await supabaseClient.storage.from('gallery').remove([decodeURIComponent(path)]);
      const { error } = await supabaseClient.from('gallery_items').delete().eq('id', btn.dataset.id);
      if (error) { alert('Delete failed: ' + error.message); return; }
      loadAdminGallery();
      loadAdminStats();
      if (typeof loadGallery === 'function') loadGallery();
    });
  });
}

/* ---------- PRODUCTS ---------- */
function wireProductManager() {
  const formWrap = document.getElementById('admin-product-form-wrap');
  const form = document.getElementById('product-form');

  document.getElementById('admin-add-product-btn').addEventListener('click', () => {
    form.reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-image-preview').hidden = true;
    populateProductCategorySelect();
    formWrap.hidden = false;
  });

  document.getElementById('product-cancel-btn').addEventListener('click', () => { formWrap.hidden = true; });

  document.getElementById('product-image-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('product-image-preview');
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const fileInput = document.getElementById('product-image-file');
    const file = fileInput.files[0];
    let imageUrl = document.getElementById('product-image-url').value.trim();

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    if (file) {
      const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const { error: uploadError } = await supabaseClient.storage.from('products').upload(path, file);
      if (uploadError) {
        alert('Image upload failed: ' + uploadError.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Product';
        return;
      }
      const { data: urlData } = supabaseClient.storage.from('products').getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const payload = {
      name: document.getElementById('product-name').value.trim(),
      description: document.getElementById('product-description').value.trim(),
      price: parseFloat(document.getElementById('product-price').value) || null,
      category_id: document.getElementById('product-category').value || null,
      image_url: imageUrl,
      in_stock: document.getElementById('product-in-stock').checked,
    };

    let error;
    if (id) {
      ({ error } = await supabaseClient.from('products').update(payload).eq('id', id));
    } else {
      ({ error } = await supabaseClient.from('products').insert([payload]));
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Product';

    if (error) { alert('Save failed: ' + error.message); return; }

    formWrap.hidden = true;
    form.reset();
    document.getElementById('product-image-preview').hidden = true;
    loadAdminProducts();
    loadAdminStats();
    if (typeof loadShopCategories === 'function') loadShopCategories();
  });
}

async function loadAdminProducts() {
  const list = document.getElementById('admin-products-list');
  list.innerHTML = '<p class="admin-loading">Loading…</p>';

  const { data, error } = await supabaseClient.from('products').select('*, shop_categories(name)').order('created_at', { ascending: false });

  if (error) { list.innerHTML = `<p class="admin-error-msg">${escapeHtmlAdmin(error.message)}</p>`; return; }
  if (!data.length) { list.innerHTML = '<p class="admin-empty">No products yet.</p>'; return; }

  list.innerHTML = data.map((p) => `
    <div class="admin-row glass-card" data-id="${p.id}">
      <div class="admin-row-main">
        <p class="admin-row-title">${escapeHtmlAdmin(p.name)} ${p.in_stock ? '' : '<span class="admin-oos-tag">Out of Stock</span>'}</p>
        <p class="admin-row-sub">${escapeHtmlAdmin((p.shop_categories && p.shop_categories.name) || 'Uncategorized')} · KES ${p.price != null ? Number(p.price).toLocaleString('en-KE') : 'N/A'}</p>
      </div>
      <div class="admin-row-actions">
        <label class="admin-toggle">
          <input type="checkbox" class="product-stock-toggle" data-id="${p.id}" ${p.in_stock ? 'checked' : ''}> In Stock
        </label>
        <button class="btn-secondary admin-edit-btn" data-id="${p.id}">Edit</button>
        <button class="btn-danger admin-delete-product-btn" data-id="${p.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.product-stock-toggle').forEach((toggle) => {
    toggle.addEventListener('change', async () => {
      const { error } = await supabaseClient.from('products').update({ in_stock: toggle.checked }).eq('id', toggle.dataset.id);
      if (error) console.error(error.message);
      loadAdminProducts();
      if (typeof loadShopCategories === 'function') loadShopCategories();
    });
  });

  list.querySelectorAll('.admin-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = data.find((item) => String(item.id) === btn.dataset.id);
      if (!p) return;
      document.getElementById('product-id').value = p.id;
      document.getElementById('product-name').value = p.name || '';
      document.getElementById('product-description').value = p.description || '';
      document.getElementById('product-price').value = p.price ?? '';
      populateProductCategorySelect(p.category_id);
      document.getElementById('product-image-url').value = p.image_url || '';
      document.getElementById('product-in-stock').checked = p.in_stock !== false;
      const preview = document.getElementById('product-image-preview');
      if (p.image_url) { preview.src = p.image_url; preview.hidden = false; } else { preview.hidden = true; }
      document.getElementById('admin-product-form-wrap').hidden = false;
    });
  });

  list.querySelectorAll('.admin-delete-product-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this product?')) return;
      const { error } = await supabaseClient.from('products').delete().eq('id', btn.dataset.id);
      if (error) { alert('Delete failed: ' + error.message); return; }
      loadAdminProducts();
      loadAdminStats();
      if (typeof loadShopCategories === 'function') loadShopCategories();
    });
  });
}

/* ---------- STATS ---------- */
async function loadAdminStats() {
  const [inqRes, galRes, prodRes] = await Promise.all([
    supabaseClient.from('inquiries').select('*', { count: 'exact', head: true }),
    supabaseClient.from('gallery_items').select('*', { count: 'exact', head: true }),
    supabaseClient.from('products').select('*', { count: 'exact', head: true }),
  ]);

  document.getElementById('stat-inquiries').textContent = inqRes.count ?? 0;
  document.getElementById('stat-gallery').textContent = galRes.count ?? 0;
  document.getElementById('stat-products').textContent = prodRes.count ?? 0;

  const { data: inquiries } = await supabaseClient.from('inquiries').select('status');
  const counts = { new: 0, in_progress: 0, closed: 0 };
  (inquiries || []).forEach((i) => { if (counts[i.status] !== undefined) counts[i.status]++; });

  const max = Math.max(1, counts.new, counts.in_progress, counts.closed);
  const chart = document.getElementById('stats-bar-chart');
  chart.innerHTML = ['new', 'in_progress', 'closed'].map((key) => {
    const label = key === 'in_progress' ? 'In Progress' : key.charAt(0).toUpperCase() + key.slice(1);
    const height = Math.round((counts[key] / max) * 100);
    return `
      <div class="bar-col">
        <div class="bar-fill" style="height:${height}%"></div>
        <p class="bar-count">${counts[key]}</p>
        <p class="bar-label">${label}</p>
      </div>
    `;
  }).join('');
}

/* ---------- EXPERIENCES / BRANDS ---------- */
function wireBrandManager() {
  const formWrap = document.getElementById('admin-brand-form-wrap');
  const form = document.getElementById('brand-form');

  document.getElementById('admin-add-brand-btn').addEventListener('click', () => {
    form.reset();
    document.getElementById('brand-id').value = '';
    document.getElementById('brand-image-preview').hidden = true;
    formWrap.hidden = false;
  });

  document.getElementById('brand-cancel-btn').addEventListener('click', () => { formWrap.hidden = true; });

  document.getElementById('brand-image-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('brand-image-preview');
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('brand-id').value;
    const fileInput = document.getElementById('brand-image-file');
    const file = fileInput.files[0];

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    let imageUrl;
    if (file) {
      const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const { error: uploadError } = await supabaseClient.storage.from('brands').upload(path, file);
      if (uploadError) {
        alert('Image upload failed: ' + uploadError.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Experience';
        return;
      }
      const { data: urlData } = supabaseClient.storage.from('brands').getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const highlights = document.getElementById('brand-highlights').value
      .split('\n').map((h) => h.trim()).filter(Boolean);

    const payload = {
      name: document.getElementById('brand-name').value.trim(),
      tagline: document.getElementById('brand-tagline').value.trim(),
      description: document.getElementById('brand-description').value.trim(),
      highlights,
    };
    if (imageUrl) payload.image_url = imageUrl;

    let error;
    if (id) {
      ({ error } = await supabaseClient.from('brands').update(payload).eq('id', id));
    } else {
      ({ error } = await supabaseClient.from('brands').insert([payload]));
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Experience';

    if (error) { alert('Save failed: ' + error.message); return; }

    formWrap.hidden = true;
    form.reset();
    document.getElementById('brand-image-preview').hidden = true;
    loadAdminBrands();
    loadAdminStats();
    if (typeof loadBrands === 'function') loadBrands();
  });
}

async function loadAdminBrands() {
  const list = document.getElementById('admin-brands-list');
  list.innerHTML = '<p class="admin-loading">Loading…</p>';

  const { data, error } = await supabaseClient.from('brands').select('*').order('created_at', { ascending: true });

  if (error) { list.innerHTML = `<p class="admin-error-msg">${escapeHtmlAdmin(error.message)}</p>`; return; }
  if (!data.length) { list.innerHTML = '<p class="admin-empty">No experiences yet.</p>'; return; }

  list.innerHTML = data.map((b) => `
    <div class="admin-gallery-item glass-card" data-id="${b.id}">
      ${b.image_url ? `<img src="${b.image_url}" alt="${escapeHtmlAdmin(b.name)}">` : ''}
      <p class="admin-row-title">${escapeHtmlAdmin(b.name)}</p>
      <p class="admin-row-sub">${escapeHtmlAdmin(b.tagline || '')}</p>
      <div class="admin-form-actions" style="justify-content:center; margin-top:0.6rem;">
        <button class="btn-secondary admin-edit-brand-btn" data-id="${b.id}">Edit</button>
        <button class="btn-secondary admin-event-btn" data-id="${b.id}">Event & Tickets</button>
        <button class="btn-danger admin-delete-brand-btn" data-id="${b.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.admin-edit-brand-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const b = data.find((item) => String(item.id) === btn.dataset.id);
      if (!b) return;
      document.getElementById('brand-id').value = b.id;
      document.getElementById('brand-name').value = b.name || '';
      document.getElementById('brand-tagline').value = b.tagline || '';
      document.getElementById('brand-description').value = b.description || '';
      document.getElementById('brand-highlights').value = (b.highlights || []).join('\n');
      const preview = document.getElementById('brand-image-preview');
      if (b.image_url) { preview.src = b.image_url; preview.hidden = false; } else { preview.hidden = true; }
      document.getElementById('admin-brand-form-wrap').hidden = false;
    });
  });

  list.querySelectorAll('.admin-delete-brand-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this experience?')) return;
      const { error } = await supabaseClient.from('brands').delete().eq('id', btn.dataset.id);
      if (error) { alert('Delete failed: ' + error.message); return; }
      loadAdminBrands();
      loadAdminStats();
      if (typeof loadBrands === 'function') loadBrands();
    });
  });

  list.querySelectorAll('.admin-event-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const b = data.find((item) => String(item.id) === btn.dataset.id);
      if (b && typeof openAdminEventModal === 'function') openAdminEventModal(b);
    });
  });
}
