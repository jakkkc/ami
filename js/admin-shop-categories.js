// AMI Designs & Events — Admin: Shop Categories management

let adminShopCategories = [];

function wireCategoryManager() {
  const formWrap = document.getElementById('admin-category-form-wrap');
  const form = document.getElementById('category-form');

  document.getElementById('admin-add-category-btn').addEventListener('click', () => {
    form.reset();
    document.getElementById('category-id').value = '';
    document.getElementById('category-image-preview').hidden = true;
    formWrap.hidden = false;
  });

  document.getElementById('category-cancel-btn').addEventListener('click', () => { formWrap.hidden = true; });

  document.getElementById('category-image-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = document.getElementById('category-image-preview');
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('category-id').value;
    const fileInput = document.getElementById('category-image-file');
    const file = fileInput.files[0];

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    let imageUrl;
    if (file) {
      const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const { error: uploadError } = await supabaseClient.storage.from('shop-categories').upload(path, file);
      if (uploadError) {
        alert('Image upload failed: ' + uploadError.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Category';
        return;
      }
      const { data: urlData } = supabaseClient.storage.from('shop-categories').getPublicUrl(path);
      imageUrl = urlData.publicUrl;
    }

    const payload = {
      name: document.getElementById('category-name').value.trim(),
      description: document.getElementById('category-description').value.trim(),
    };
    if (imageUrl) payload.image_url = imageUrl;

    let error;
    if (id) {
      ({ error } = await supabaseClient.from('shop_categories').update(payload).eq('id', id));
    } else {
      ({ error } = await supabaseClient.from('shop_categories').insert([payload]));
    }

    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Category';

    if (error) { alert('Save failed: ' + error.message); return; }

    formWrap.hidden = true;
    form.reset();
    document.getElementById('category-image-preview').hidden = true;
    loadAdminCategories();
    if (typeof loadShopCategories === 'function') loadShopCategories();
  });
}

async function loadAdminCategories() {
  const list = document.getElementById('admin-categories-list');
  list.innerHTML = '<p class="admin-loading">Loading…</p>';

  const { data, error } = await supabaseClient.from('shop_categories').select('*').order('created_at', { ascending: true });

  if (error) {
    list.innerHTML = `<p class="admin-error-msg">${escapeHtmlAdmin(error.message)}</p>`;
    adminShopCategories = [];
    populateProductCategorySelect();
    return;
  }

  adminShopCategories = data || [];
  populateProductCategorySelect();

  if (!data.length) { list.innerHTML = '<p class="admin-empty">No categories yet. Add one to start selling.</p>'; return; }

  list.innerHTML = data.map((c) => `
    <div class="admin-gallery-item glass-card" data-id="${c.id}">
      ${c.image_url ? `<img src="${c.image_url}" alt="${escapeHtmlAdmin(c.name)}">` : ''}
      <p class="admin-row-title">${escapeHtmlAdmin(c.name)}</p>
      <p class="admin-row-sub">${escapeHtmlAdmin(c.description || '')}</p>
      <div class="admin-form-actions" style="justify-content:center; margin-top:0.6rem;">
        <button class="btn-secondary admin-edit-category-btn" data-id="${c.id}">Edit</button>
        <button class="btn-danger admin-delete-category-btn" data-id="${c.id}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.admin-edit-category-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = data.find((item) => String(item.id) === btn.dataset.id);
      if (!c) return;
      document.getElementById('category-id').value = c.id;
      document.getElementById('category-name').value = c.name || '';
      document.getElementById('category-description').value = c.description || '';
      const preview = document.getElementById('category-image-preview');
      if (c.image_url) { preview.src = c.image_url; preview.hidden = false; } else { preview.hidden = true; }
      document.getElementById('admin-category-form-wrap').hidden = false;
    });
  });

  list.querySelectorAll('.admin-delete-category-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this category? Its products become uncategorized, not deleted.')) return;
      const { error } = await supabaseClient.from('shop_categories').delete().eq('id', btn.dataset.id);
      if (error) { alert('Delete failed: ' + error.message); return; }
      loadAdminCategories();
      loadAdminProducts();
      if (typeof loadShopCategories === 'function') loadShopCategories();
    });
  });
}

function populateProductCategorySelect(selectedId) {
  const select = document.getElementById('product-category');
  if (!select) return;

  if (!adminShopCategories.length) {
    select.innerHTML = '<option value="" disabled selected>No categories yet — add one above first</option>';
    return;
  }

  select.innerHTML =
    `<option value="" disabled ${selectedId ? '' : 'selected'}>Select a category</option>` +
    adminShopCategories.map((c) =>
      `<option value="${c.id}" ${String(c.id) === String(selectedId) ? 'selected' : ''}>${escapeHtmlAdmin(c.name)}</option>`
    ).join('');
}
