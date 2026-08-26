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
