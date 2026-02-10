// Small site-wide helpers: active nav, mobile menu, footer year.
(() => {
  const i18n = window.SCP_I18N || null;
  const t = (key, vars) => (i18n && typeof i18n.t === 'function') ? i18n.t(key, vars) : '';

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
  ensureNavLink('.primary-nav', { href: 'account.html', text: t('nav.account') || 'Account' });
  ensureNavLink('.mobile-menu-links', { href: 'account.html', text: t('nav.account') || 'Account' });

  // Apply translations for nav labels without requiring every page to be edited.
  const setLinkText = (selector, text) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (!el) return;
      el.textContent = text;
    });
  };

  setLinkText('.primary-nav .nav-link[data-section=\"home\"]', t('nav.home') || 'Home');
  setLinkText('.primary-nav .nav-link[data-section=\"properties\"]', t('nav.properties') || 'Properties');
  setLinkText('.primary-nav .nav-link[data-section=\"businesses\"]', t('nav.businesses') || 'Businesses');
  setLinkText('.primary-nav .nav-link[data-section=\"vehicles\"]', t('nav.vehicles') || 'Vehicles');
  setLinkText('.primary-nav .nav-link[data-section=\"services\"]', t('nav.services') || 'Services');
  setLinkText('.primary-nav .nav-link[data-section=\"account\"]', t('nav.account') || 'Account');

  // Mobile menu uses plain <a> tags.
  setLinkText('.mobile-menu-links a[href=\"index.html\"]', t('nav.home') || 'Home');
  setLinkText('.mobile-menu-links a[href=\"properties.html\"]', t('nav.properties') || 'Properties');
  setLinkText('.mobile-menu-links a[href=\"businesses.html\"]', t('nav.businesses') || 'Businesses');
  setLinkText('.mobile-menu-links a[href=\"vehicles.html\"]', t('nav.vehicles') || 'Vehicles');
  setLinkText('.mobile-menu-links a[href=\"services.html\"]', t('nav.services') || 'Services');
  setLinkText('.mobile-menu-links a[href=\"account.html\"]', t('nav.account') || 'Account');

  // Common CTA labels.
  setLinkText('.header-cta[href^=\"tel:\"]', t('nav.call') || 'Call');
  setLinkText('.mobile-menu-foot a[href^=\"mailto:\"]', t('nav.email') || 'Email');
  setLinkText('.mobile-menu-foot a[href^=\"tel:\"]', t('nav.call') || 'Call');
  setLinkText('.contact-label', t('nav.contact_us') || 'Contact Us');

  const injectLangSwitcher = () => {
    if (!i18n || typeof i18n.setLang !== 'function') return;
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) return;
    if (document.getElementById('lang-switch')) return;

    const select = document.createElement('select');
    select.id = 'lang-switch';
    select.className = 'lang-switch';
    select.setAttribute('aria-label', t('lang.label') || 'Language');

    const opt = (value, label) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      return o;
    };

    select.appendChild(opt('en', t('lang.en') || 'English'));
    select.appendChild(opt('es', t('lang.es') || 'Spanish'));
    try { select.value = i18n.lang || 'en'; } catch { /* ignore */ }

    select.addEventListener('change', () => {
      i18n.setLang(select.value, { persist: true, reload: true });
    });

    const beforeEl = headerRight.querySelector('#mobile-menu-btn') || null;
    if (beforeEl) headerRight.insertBefore(select, beforeEl);
    else headerRight.appendChild(select);
  };

  injectLangSwitcher();

  // Translate any page content that uses data-i18n attributes.
  if (i18n && typeof i18n.applyTranslations === 'function') {
    i18n.applyTranslations(document);
  }

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
      navigator.serviceWorker.register('sw.js')
        .then((reg) => {
          // Force an update check every load so GitHub Pages/CDN caching doesn't leave users on an old SW.
          try { reg.update(); } catch { /* ignore */ }
        })
        .catch(() => {
          // Ignore registration failures (e.g. file://).
        });
    });
  }
})();
