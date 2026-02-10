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
    path.endsWith('/account.html') || path.endsWith('account.html') ? 'account' :
    path.endsWith('/admin-favourites.html') || path.endsWith('admin-favourites.html') ? 'account' :
    path.endsWith('/admin-crm.html') || path.endsWith('admin-crm.html') ? 'account' :
    'home';

  document.body.dataset.section = document.body.dataset.section || section;

  document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });

  const ensureNavLink = (containerSelector, { href, text }) => {
    document.querySelectorAll(containerSelector).forEach((nav) => {
      if (!nav) return;
      const existing = Array.from(nav.querySelectorAll('a')).find((a) => (a.getAttribute('href') || '').includes(href));
      if (existing) return;
      const a = document.createElement('a');
      a.href = href;
      a.textContent = text;
      if (nav.classList.contains('primary-nav')) {
        a.className = 'nav-link';
        a.dataset.section = 'account';
      }
      nav.appendChild(a);
    });
  };

  // Make Account discoverable without having to update every page header/footer manually.
  ensureNavLink('.primary-nav', { href: 'account.html', text: 'Account' });
  ensureNavLink('.mobile-menu-links', { href: 'account.html', text: 'Account' });

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

  // PWA: cache static assets for instant repeat loads on mobile WebKit/Android.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {
        // Ignore registration failures (e.g. file://).
      });
    });
  }
})();
