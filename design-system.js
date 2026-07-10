// ═══════════════════════════════════════════════
// STUDY GRID PREP — SHARED PAGE BEHAVIORS
// Identical on every page. Include verbatim after
// the header/footer markup on any new content page.
// ═══════════════════════════════════════════════

// ── FAQ ──
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

// ── HAMBURGER / MOBILE MENU ──
function toggleMenu() {
  document.getElementById('hamburger').classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
}
function closeMenu() {
  document.getElementById('hamburger').classList.remove('open');
  document.getElementById('mobileMenu').classList.remove('open');
}
document.addEventListener('click', (e) => {
  const hamburger = document.getElementById('hamburger');
  const menu = document.getElementById('mobileMenu');
  if (hamburger && menu && !hamburger.contains(e.target) && !menu.contains(e.target)) {
    hamburger.classList.remove('open');
    menu.classList.remove('open');
  }
});

// ── SCROLL REVEAL ──
document.addEventListener('DOMContentLoaded', () => {
  const revealEls = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => observer.observe(el));
});
