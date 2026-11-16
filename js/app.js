// AMI Designs & Events — core app script
// (Nav, animations, and Supabase wiring will be added in later steps)

document.addEventListener('DOMContentLoaded', () => {
  console.log('AMI Designs & Events — app initialized');
});

// Scroll-triggered fade-up animation for below-the-fold sections
const scrollObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        scrollObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

document.querySelectorAll('.fade-up-scroll').forEach((el) => {
  scrollObserver.observe(el);
});

// Mobile hamburger nav toggle
const hamburgerBtn = document.querySelector('.hamburger');
const mobileNav = document.querySelector('.mobile-nav');

if (hamburgerBtn && mobileNav) {
  hamburgerBtn.addEventListener('click', () => {
    const isOpen = hamburgerBtn.classList.toggle('open');
    mobileNav.hidden = !isOpen;
    hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      hamburgerBtn.classList.remove('open');
      mobileNav.hidden = true;
      hamburgerBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

// Luxury polish: header turns solid after the hero, and a thin gold scroll-progress line
(() => {
  const header = document.querySelector('.site-header');
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  let ticking = false;
  const update = () => {
    const y = window.scrollY || 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
    if (header) header.classList.toggle('scrolled', y > 40);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();
