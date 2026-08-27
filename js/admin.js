// AMI Designs & Events — Admin dashboard: Inquiries, Gallery Manager, Products, Stats

let adminInitialized = false;

function initAdminDashboard() {
  if (!adminInitialized) {
    wireAdminTabs();
    wireGalleryManager();
    wireProductManager();
    adminInitialized = true;
  }
  loadAdminInquiries();
  loadAdminGallery();
  loadAdminProducts();
  loadAdminStats();
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

  list.innerHTML = data.map((inq) => {
    const waText = encodeURIComponent(`Hi ${inq.name}, thank you for reaching out to AMI Designs & Events regarding your ${inq.event_type || 'event'}. `);
    const digits = (inq.phone || '').replace(/[^0-9]/g, '');
    const waLink = digits ? `https://wa.me/${digits}?text=${waText}` : null;

    return `
      <div class="admin-row glass-card" data-id="${inq.id}">
        <div class="admin-row-main">
          <p class="admin-row-title">${escapeHtmlAdmin(inq.name)} — ${escapeHtmlAdmin(inq.event_type || 'N/A')}</p>
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
  }).join('');

  list.querySelectorAll('.inquiry-status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const { error } = await supabaseClient.from('inquiries').update({ status: sel.value }).eq('id', sel.dataset.id);
      if (error) console.error('Status update failed:', error.message);
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
      <button class="btn-secondary admin-delete-gallery-btn" data-id="${item.id}" data-url="${item.image_url}">Delete</button>
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
    formWrap.hidden = false;
  });

  document.getElementById('product-cancel-btn').addEventListener('click', () => { formWrap.hidden = true; });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('product-id').value;
    const payload = {
      name: document.getElementById('product-name').value.trim(),
      description: document.getElementById('product-description').value.trim(),
      price: parseFloat(document.getElementById('product-price').value) || null,
      category: document.getElementById('product-category').value,
      image_url: document.getElementById('product-image-url').value.trim(),
      in_stock: document.getElementById('product-in-stock').checked,
    };

    let error;
    if (id) {
      ({ error } = await supabaseClient.from('products').update(payload).eq('id', id));
    } else {
      ({ error } = await supabaseClient.from('products').insert([payload]));
    }

    if (error) { alert('Save failed: ' + error.message); return; }

    formWrap.hidden = true;
    form.reset();
    loadAdminProducts();
    loadAdminStats();
    if (typeof loadShop === 'function') loadShop();
  });
}

async function loadAdminProducts() {
  const list = document.getElementById('admin-products-list');
  list.innerHTML = '<p class="admin-loading">Loading…</p>';

  const { data, error } = await supabaseClient.from('products').select('*').order('created_at', { ascending: false });

  if (error) { list.innerHTML = `<p class="admin-error-msg">${escapeHtmlAdmin(error.message)}</p>`; return; }
  if (!data.length) { list.innerHTML = '<p class="admin-empty">No products yet.</p>'; return; }

  list.innerHTML = data.map((p) => `
    <div class="admin-row glass-card" data-id="${p.id}">
      <div class="admin-row-main">
        <p class="admin-row-title">${escapeHtmlAdmin(p.name)} ${p.in_stock ? '' : '<span class="admin-oos-tag">Out of Stock</span>'}</p>
        <p class="admin-row-sub">${escapeHtmlAdmin(p.category || '')} · KES ${p.price != null ? Number(p.price).toLocaleString('en-KE') : 'N/A'}</p>
      </div>
      <div class="admin-row-actions">
        <label class="admin-toggle">
          <input type="checkbox" class="product-stock-toggle" data-id="${p.id}" ${p.in_stock ? 'checked' : ''}> In Stock
        </label>
        <button class="btn-secondary admin-edit-btn" data-id="${p.id}">Edit</button>
        <button class="btn-secondary admin-delete-product-btn" data-id="${p.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.product-stock-toggle').forEach((toggle) => {
    toggle.addEventListener('change', async () => {
      const { error } = await supabaseClient.from('products').update({ in_stock: toggle.checked }).eq('id', toggle.dataset.id);
      if (error) console.error(error.message);
      loadAdminProducts();
      if (typeof loadShop === 'function') loadShop();
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
      document.getElementById('product-category').value = p.category || '';
      document.getElementById('product-image-url').value = p.image_url || '';
      document.getElementById('product-in-stock').checked = p.in_stock !== false;
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
      if (typeof loadShop === 'function') loadShop();
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
