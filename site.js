// Small site-wide helpers: active nav, mobile menu, footer year.
(() => {
  const i18n = window.SCP_I18N || null;
  const t = (key, vars) => (i18n && typeof i18n.t === 'function') ? i18n.t(key, vars) : '';
  const tr = (key, fallback, vars) => {
    const translated = t(key, vars);
    if (!translated || translated === key) return fallback;
    return translated;
  };

  const MANIFEST_VERSION = '20260216a';

  // Avoid Chrome console CORS errors when pages are opened via file:// (origin "null"):
  // - HTML pages no longer include <link rel="manifest"> directly
  // - We inject it only for http(s) where PWA features are supported.
  const ensureManifestLink = () => {
    try {
      const proto = String(window.location && window.location.protocol || '');
      if (proto !== 'http:' && proto !== 'https:') return;
      if (!document || !document.head) return;
      const existing = document.querySelector('link[rel=\"manifest\"]');
      if (existing) return;
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = `manifest.webmanifest?v=${MANIFEST_VERSION}`;
      document.head.appendChild(link);
    } catch {
      // ignore
    }
  };

  ensureManifestLink();

  // Affiliate/referral tracking: delegate to the shared scp-affiliate.js module.
  const affiliate = window.SCP_AFFILIATE || null;


  // Best-effort: keep ?aff=CODE propagating through key on-site links when storage is blocked.
  (() => {
    const code = affiliate && typeof affiliate.getAttributionCode === 'function' ? affiliate.getAttributionCode() : '';
    if (!code) return;

    const shouldRewriteHref = (href) => {
      if (!href) return false;
      if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return false;
      return true;
    };

    const rewriteAnchor = (a) => {
      if (!a || typeof a.getAttribute !== 'function') return;
      const href = String(a.getAttribute('href') || '');
      if (!shouldRewriteHref(href)) return;
      if (href.includes('aff=')) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Only rewrite our navigational HTML pages.
        if (!/\\.html$/i.test(url.pathname)) return;
        url.searchParams.set('aff', code);
        a.setAttribute('href', url.toString());
      } catch {
        // ignore
      }
    };

    // Limit rewriting to nav and obvious CTAs so we don't unexpectedly touch huge grids.
    const selectors = [
      '.primary-nav a[href]',
      '.mobile-menu-links a[href]',
      '.header-cta[href]',
      '.simple-cta a[href]',
      '.card-actions a[href]',
      '.footer-links a[href]'
    ];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((a) => rewriteAnchor(a));
    });
  })();

  const yearEl = document.getElementById('footer-year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const path = (window.location.pathname || '').toLowerCase();
  const bodySection = (() => {
    try {
      return (document.body && document.body.dataset && document.body.dataset.section) ? String(document.body.dataset.section) : '';
    } catch {
      return '';
    }
  })();
  const inferredSection =
    path.endsWith('/new-builds.html') || path.endsWith('new-builds.html') ? 'newbuilds' :
      path.endsWith('/properties.html') || path.endsWith('properties.html') ? 'properties' :
        path.endsWith('/businesses.html') || path.endsWith('businesses.html') ? 'businesses' :
          path.endsWith('/vehicles.html') || path.endsWith('vehicles.html') ? 'vehicles' :
            path.includes('/services') || path.endsWith('services.html') ? 'services' :
              path.endsWith('/network.html') || path.endsWith('network.html') || path.endsWith('/network-profile.html') || path.endsWith('network-profile.html') ? 'network' :
                path.endsWith('/blog.html') || path.endsWith('blog.html') ? 'blog' :
                  path.endsWith('/account.html') || path.endsWith('account.html') ? 'account' :
                    path.endsWith('/admin-favourites.html') || path.endsWith('admin-favourites.html') ? 'account' :
                      path.endsWith('/admin-crm.html') || path.endsWith('admin-crm.html') ? 'account' :
                        'home';

  // Most pages set body[data-section] explicitly; prefer that for nav highlighting.
  // Exception: new-builds.html intentionally uses body[data-section="properties"] to reuse the app layout,
  // but we still want the New Builds nav link to be active.
  const section = inferredSection === 'newbuilds' ? 'newbuilds' : (bodySection || inferredSection);
  const activeSection = section;

  document.body.dataset.section = bodySection || section;

  document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });

  const ensureNavLink = (containerSelector, { href, text, i18nKey, section: linkSection, afterHref }) => {
    document.querySelectorAll(containerSelector).forEach((nav) => {
      if (!nav) return;
      const existing = Array.from(nav.querySelectorAll('a')).find((a) => (a.getAttribute('href') || '').includes(href));
      if (existing) return;
      const a = document.createElement('a');
      a.href = href;
      if (i18nKey) {
        try { a.setAttribute('data-i18n', i18nKey); } catch { /* ignore */ }
        a.textContent = tr(i18nKey, String(text || ''));
      } else {
        a.textContent = String(text || '');
      }
      if (nav.classList.contains('primary-nav')) {
        a.className = 'nav-link';
        if (linkSection) a.dataset.section = linkSection;
        // Highlight newly-inserted links when they represent the current page section.
        if (a.dataset.section) a.classList.toggle('active', a.dataset.section === activeSection);
      }
      if (afterHref) {
        const anchors = Array.from(nav.querySelectorAll('a'));
        const after = anchors.find((el) => (el.getAttribute('href') || '').includes(afterHref)) || null;
        if (after && after.nextSibling) {
          nav.insertBefore(a, after.nextSibling);
        } else if (after) {
          nav.appendChild(a);
        } else {
          nav.appendChild(a);
        }
      } else {
        nav.appendChild(a);
      }
    });
  };

  const ensureMobileMenuShell = () => {
    const existingPanel = document.getElementById('mobile-menu');
    const existingBackdrop = document.getElementById('mobile-menu-backdrop');
    const existingBtn = document.getElementById('mobile-menu-btn');

    // Some pages (admin tools, catalog, brochure/reel/tour pages) don't include the mobile menu markup.
    // When primary-nav is hidden on small screens, that makes navigation disappear. Inject a consistent menu.
    if (!existingBackdrop) {
      const backdrop = document.createElement('div');
      backdrop.id = 'mobile-menu-backdrop';
      backdrop.className = 'mobile-menu-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      document.body.appendChild(backdrop);
    }

    if (!existingPanel) {
      const panel = document.createElement('aside');
      panel.id = 'mobile-menu';
      panel.className = 'mobile-menu';
      panel.setAttribute('aria-hidden', 'true');
      panel.innerHTML = `
        <div class="mobile-menu-head">
          <div class="mobile-menu-title">Spanish Coast Properties</div>
          <button id="mobile-menu-close" class="mobile-menu-close" type="button">✕</button>
        </div>
        <nav class="mobile-menu-links" aria-label="Mobile menu">
          <a href="index.html" data-i18n="nav.home">Home</a>
          <a href="properties.html" data-i18n="nav.properties">Properties</a>
          <a href="new-builds.html" data-i18n="nav.new_builds">New Builds</a>
          <a href="businesses.html" data-i18n="nav.businesses">Businesses</a>
          <a href="vehicles.html" data-i18n="nav.vehicles">Vehicles</a>
          <a href="services.html" data-i18n="nav.services">Services</a>
          <a href="blog.html" data-i18n="nav.blog">Blog</a>
          <a href="network.html" data-i18n="nav.network">Network</a>
          <a href="account.html" data-i18n="nav.account">Account</a>
        </nav>
        <div class="mobile-menu-foot">
          <a class="cta-button" href="mailto:info@spanishcoastproperties.com" data-i18n="nav.email">Email</a>
          <a class="cta-button" href="tel:+34624867866" data-i18n="nav.call">Call</a>
        </div>
      `;
      document.body.appendChild(panel);
    }

    if (!existingBtn) {
      const btn = document.createElement('button');
      btn.id = 'mobile-menu-btn';
      btn.className = 'mobile-menu-btn no-print';
      btn.type = 'button';
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', tr('ui.menu', 'Menu'));
      btn.setAttribute('data-i18n-aria-label', 'ui.menu');
      btn.textContent = '☰';

      const container =
        document.querySelector('.header-right')
        || document.querySelector('.brochure-toolbar-right')
        || document.querySelector('.brochure-toolbar-left')
        || null;
      if (container) {
        container.insertBefore(btn, container.firstChild);
      } else {
        // Safety fallback for rare pages without a header/toolbar.
        btn.style.position = 'fixed';
        btn.style.top = '12px';
        btn.style.right = '12px';
        btn.style.zIndex = '5200';
        document.body.appendChild(btn);
      }
    }
  };

  ensureMobileMenuShell();

  // Make New Builds discoverable without having to update every page header/footer manually.
  ensureNavLink('.primary-nav', { href: 'new-builds.html', text: 'New Builds', i18nKey: 'nav.new_builds', section: 'newbuilds', afterHref: 'properties.html' });
  ensureNavLink('.mobile-menu-links', { href: 'new-builds.html', text: 'New Builds', i18nKey: 'nav.new_builds', afterHref: 'properties.html' });

  // Make Account discoverable without having to update every page header/footer manually.
  ensureNavLink('.primary-nav', { href: 'account.html', text: 'Account', i18nKey: 'nav.account', section: 'account' });
  ensureNavLink('.mobile-menu-links', { href: 'account.html', text: 'Account', i18nKey: 'nav.account' });

  // Make Blog discoverable without having to update every page header/footer manually.
  ensureNavLink('.primary-nav', { href: 'blog.html', text: 'Blog', i18nKey: 'nav.blog', section: 'blog', afterHref: 'services.html' });
  ensureNavLink('.mobile-menu-links', { href: 'blog.html', text: 'Blog', i18nKey: 'nav.blog', afterHref: 'services.html' });

  // Make Network discoverable without having to update every page header/footer manually.
  // Put it after Blog so consumer navigation stays familiar.
  ensureNavLink('.primary-nav', { href: 'network.html', text: 'Network', i18nKey: 'nav.network', section: 'network', afterHref: 'blog.html' });
  ensureNavLink('.mobile-menu-links', { href: 'network.html', text: 'Network', i18nKey: 'nav.network', afterHref: 'blog.html' });

  // Add "New Builds" to footer explore lists (only when a Properties link exists in that list).
  (() => {
    const label = tr('nav.new_builds', 'New Builds');
    document.querySelectorAll('.site-footer .footer-links').forEach((ul) => {
      if (!ul) return;
      const propsLink = ul.querySelector('a[href="properties.html"]');
      if (!propsLink) return;
      const already = Array.from(ul.querySelectorAll('a')).some((a) => (a.getAttribute('href') || '').includes('new-builds.html'));
      if (already) return;

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = 'new-builds.html';
      a.setAttribute('data-i18n', 'nav.new_builds');
      a.textContent = label;
      li.appendChild(a);

      const propsLi = propsLink.closest('li');
      if (propsLi && propsLi.parentElement === ul) {
        if (propsLi.nextSibling) ul.insertBefore(li, propsLi.nextSibling);
        else ul.appendChild(li);
      } else {
        ul.appendChild(li);
      }
    });
  })();

  // Add "Blog" to footer explore lists (only when a Services link exists in that list).
  (() => {
    const label = tr('nav.blog', 'Blog');
    document.querySelectorAll('.site-footer .footer-links').forEach((ul) => {
      if (!ul) return;
      const servicesLink = ul.querySelector('a[href="services.html"]');
      if (!servicesLink) return;
      const already = Array.from(ul.querySelectorAll('a')).some((a) => (a.getAttribute('href') || '').includes('blog.html'));
      if (already) return;

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = 'blog.html';
      a.setAttribute('data-i18n', 'nav.blog');
      a.textContent = label;
      li.appendChild(a);

      const servicesLi = servicesLink.closest('li');
      if (servicesLi && servicesLi.parentElement === ul) {
        if (servicesLi.nextSibling) ul.insertBefore(li, servicesLi.nextSibling);
        else ul.appendChild(li);
      } else {
        ul.appendChild(li);
      }
    });
  })();

  // Apply translations for nav labels without requiring every page to be edited.
  const setI18nText = (selector, key, fallback) => {
    const text = tr(key, fallback);
    document.querySelectorAll(selector).forEach((el) => {
      if (!el) return;
      try { el.setAttribute('data-i18n', key); } catch { /* ignore */ }
      el.textContent = text;
    });
  };

  const setI18nAriaLabel = (selector, key, fallback) => {
    const text = tr(key, fallback);
    document.querySelectorAll(selector).forEach((el) => {
      if (!el || !text) return;
      try { el.setAttribute('data-i18n-aria-label', key); } catch { /* ignore */ }
      try { el.setAttribute('aria-label', text); } catch { /* ignore */ }
    });
  };

  const removeHeaderCallButtons = () => {
    const selectors = [
      '.site-header .header-right a[href^="tel:"]',
      '.site-header .header-right .cta-button[href^="tel:"]',
      '.main-header .header-right a[href^="tel:"]',
      '.main-header .header-right .cta-button[href^="tel:"]'
    ];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (!el) return;
        try { el.remove(); } catch { /* ignore */ }
      });
    });
  };

  const refreshStaticLabels = () => {
    removeHeaderCallButtons();

    setI18nText('.primary-nav .nav-link[data-section=\"home\"]', 'nav.home', 'Home');
    setI18nText('.primary-nav .nav-link[data-section=\"properties\"]', 'nav.properties', 'Properties');
    setI18nText('.primary-nav .nav-link[data-section=\"newbuilds\"]', 'nav.new_builds', 'New Builds');
    setI18nText('.primary-nav .nav-link[data-section=\"businesses\"]', 'nav.businesses', 'Businesses');
    setI18nText('.primary-nav .nav-link[data-section=\"vehicles\"]', 'nav.vehicles', 'Vehicles');
    setI18nText('.primary-nav .nav-link[data-section=\"services\"]', 'nav.services', 'Services');
    setI18nText('.primary-nav .nav-link[data-section=\"blog\"]', 'nav.blog', 'Blog');
    setI18nText('.primary-nav .nav-link[data-section=\"network\"]', 'nav.network', 'Network');
    setI18nText('.primary-nav .nav-link[data-section=\"account\"]', 'nav.account', 'Account');

    // Mobile menu uses plain <a> tags.
    setI18nText('.mobile-menu-links a[href=\"index.html\"]', 'nav.home', 'Home');
    setI18nText('.mobile-menu-links a[href=\"properties.html\"]', 'nav.properties', 'Properties');
    setI18nText('.mobile-menu-links a[href=\"new-builds.html\"]', 'nav.new_builds', 'New Builds');
    setI18nText('.mobile-menu-links a[href=\"businesses.html\"]', 'nav.businesses', 'Businesses');
    setI18nText('.mobile-menu-links a[href=\"vehicles.html\"]', 'nav.vehicles', 'Vehicles');
    setI18nText('.mobile-menu-links a[href=\"services.html\"]', 'nav.services', 'Services');
    setI18nText('.mobile-menu-links a[href=\"blog.html\"]', 'nav.blog', 'Blog');
    setI18nText('.mobile-menu-links a[href=\"network.html\"]', 'nav.network', 'Network');
    setI18nText('.mobile-menu-links a[href=\"account.html\"]', 'nav.account', 'Account');

    // Common CTA labels.
    setI18nText('.mobile-menu-foot a[href^=\"mailto:\"]', 'nav.email', 'Email');
    setI18nText('.contact-label', 'nav.contact_us', 'Contact Us');

    // Common button labels and aria-labels across pages.
    setI18nAriaLabel('#mobile-menu-btn', 'ui.menu', 'Menu');
    setI18nAriaLabel('#open-filters-btn', 'ui.open_filters', 'Open filters');
    setI18nAriaLabel('#open-catalog-builder-btn', 'properties.send_saved', 'Create catalog');
    setI18nAriaLabel('#toggle-map-btn', 'ui.toggle_map', 'Toggle map');
    setI18nAriaLabel('#clear-filters-btn', 'ui.clear_all_filters', 'Clear all filters');
    setI18nAriaLabel('#apply-filters', 'ui.apply_filters', 'Apply filters');
    setI18nAriaLabel('#close-filters-btn', 'ui.close_filters', 'Close filters');
    setI18nAriaLabel('.lightbox-nav.prev', 'ui.previous_image', 'Previous image');
    setI18nAriaLabel('.lightbox-nav.next', 'ui.next_image', 'Next image');
  };

  refreshStaticLabels();

  const fallbackSetLang = (nextCode) => {
    const code = String(nextCode || 'en').trim().toLowerCase() || 'en';
    try {
      window.localStorage.setItem('scp:lang', code);
    } catch {
      // ignore
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', code);
      window.location.href = url.toString();
      return;
    } catch {
      // ignore
    }
    window.location.reload();
  };

  const injectLangSwitcher = () => {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) return;
    let select = document.getElementById('lang-switch');
    if (!select) {
      select = document.createElement('select');
      select.id = 'lang-switch';
      select.className = 'lang-switch';
      const beforeEl = headerRight.querySelector('#mobile-menu-btn') || null;
      if (beforeEl) headerRight.insertBefore(select, beforeEl);
      else headerRight.appendChild(select);
    }
    if (!select.dataset.bound) {
      select.addEventListener('change', () => {
        if (i18n && typeof i18n.setLang === 'function') {
          i18n.setLang(select.value, { persist: true, reload: true });
          return;
        }
        fallbackSetLang(select.value);
      });
      select.dataset.bound = '1';
    }
    select.setAttribute('data-i18n-aria-label', 'lang.label');
    select.setAttribute('aria-label', tr('lang.label', 'Language'));
    select.innerHTML = '';

    const opt = (value, label) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      return o;
    };

    // Use short labels so the switcher never pushes important header buttons (Filters/Map) off-screen.
    const supported = (i18n && Array.isArray(i18n.SUPPORTED) && i18n.SUPPORTED.length)
      ? i18n.SUPPORTED
      : ['en', 'es', 'ro', 'sv'];
    supported.forEach((code) => {
      const safeCode = String(code || '').trim().toLowerCase();
      if (!safeCode) return;
      const shortKey = `lang.${safeCode}_short`;
      const longKey = `lang.${safeCode}`;
      const label = tr(shortKey, tr(longKey, safeCode.toUpperCase()));
      select.appendChild(opt(safeCode, label));
    });
    try {
      const local = window.localStorage ? String(window.localStorage.getItem('scp:lang') || '').trim().toLowerCase() : '';
      select.value = (i18n && i18n.lang) || local || 'en';
    } catch {
      select.value = 'en';
    }
  };

  injectLangSwitcher();

  // Translate any page content that uses data-i18n attributes.
  if (i18n && typeof i18n.applyTranslations === 'function') {
    i18n.applyTranslations(document);
  }

  window.addEventListener('scp:i18n-updated', () => {
    injectLangSwitcher();
    refreshStaticLabels();
    if (i18n && typeof i18n.applyTranslations === 'function') {
      i18n.applyTranslations(document);
    }
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
