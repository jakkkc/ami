// AMI Designs & Events — Admin auth & overlay trigger

let logoClickCount = 0;
let logoClickTimer = null;

function openAdminOverlay() {
  document.getElementById('admin-overlay').hidden = false;
  document.body.style.overflow = 'hidden';
  checkAdminSession();
}

function closeAdminOverlay() {
  document.getElementById('admin-overlay').hidden = true;
  document.body.style.overflow = '';
}

async function checkAdminSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    showAdminDashboard();
  } else {
    showAdminLogin();
  }
}

function showAdminLogin() {
  document.getElementById('admin-login').hidden = false;
  document.getElementById('admin-dashboard').hidden = true;
}

function showAdminDashboard() {
  document.getElementById('admin-login').hidden = true;
  document.getElementById('admin-dashboard').hidden = false;
  if (typeof initAdminDashboard === 'function') initAdminDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
  const logo = document.getElementById('logo-trigger');
  if (logo) {
    logo.addEventListener('click', (e) => {
      logoClickCount++;
      clearTimeout(logoClickTimer);
      logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1500);
      if (logoClickCount >= 5) {
        e.preventDefault();
        logoClickCount = 0;
        openAdminOverlay();
      }
    });
  }

  if (window.location.hash === '#admin') openAdminOverlay();
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#admin') openAdminOverlay();
  });

  document.getElementById('admin-close-btn').addEventListener('click', () => {
    closeAdminOverlay();
    if (window.location.hash === '#admin') history.replaceState(null, '', window.location.pathname);
  });

  document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const errorEl = document.getElementById('admin-login-error');
    errorEl.hidden = true;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = 'Invalid email or password.';
      errorEl.hidden = false;
      return;
    }
    showAdminDashboard();
  });

  document.getElementById('admin-logout-btn').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    showAdminLogin();
  });
});
