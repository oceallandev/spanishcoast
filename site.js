// Small site-wide helpers: active nav, mobile menu, footer year.
(() => {
  const yearEl = document.getElementById('footer-year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const path = (window.location.pathname || '').toLowerCase();
  const section =
    path.endsWith('/properties.html') || path.endsWith('properties.html') ? 'properties' :
    path.endsWith('/businesses.html') || path.endsWith('businesses.html') ? 'businesses' :
    path.endsWith('/vehicles.html') || path.endsWith('vehicles.html') ? 'vehicles' :
    path.includes('/services') || path.endsWith('services.html') ? 'services' :
    'home';

  document.body.dataset.section = document.body.dataset.section || section;

  document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });

  const menuBtn = document.getElementById('mobile-menu-btn');
  const menuBackdrop = document.getElementById('mobile-menu-backdrop');
  const menuPanel = document.getElementById('mobile-menu');
  const closeBtn = document.getElementById('mobile-menu-close');

  const openMenu = () => {
    if (!menuPanel) return;
    document.body.classList.add('menu-open');
    menuPanel.setAttribute('aria-hidden', 'false');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
  };

  const closeMenu = () => {
    document.body.classList.remove('menu-open');
    if (menuPanel) menuPanel.setAttribute('aria-hidden', 'true');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  };

  if (menuBtn) menuBtn.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (menuBackdrop) menuBackdrop.addEventListener('click', closeMenu);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });
})();

