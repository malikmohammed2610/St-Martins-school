/* ==========================================================================
   ST. MARTIN'S HIGH SCHOOL — INTERACTION ENGINE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Sticky Header Contrast Shift on Scroll
  const header = document.querySelector('.site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.style.padding = '0.25rem 0';
      header.style.background = 'rgba(7, 26, 43, 0.95)';
    } else {
      header.style.padding = '0';
      header.style.background = 'rgba(7, 26, 43, 0.85)';
    }
  });

  // Intersection Observer for Quiet Luxury Scroll Reveals
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
    observer.observe(section);
  });
});