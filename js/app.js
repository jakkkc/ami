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
