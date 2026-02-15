// Small site-wide helpers: active nav, mobile menu, footer year.
(() => {
  const i18n = window.SCP_I18N || null;
  const t = (key, vars) => (i18n && typeof i18n.t === 'function') ? i18n.t(key, vars) : '';
  const tr = (key, fallback, vars) => {
    const translated = t(key, vars);
    if (!translated || translated === key) return fallback;
    return translated;
  };

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
    path.endsWith('/blog.html') || path.endsWith('blog.html') ? 'blog' :
    path.endsWith('/account.html') || path.endsWith('account.html') ? 'account' :
    path.endsWith('/admin-favourites.html') || path.endsWith('admin-favourites.html') ? 'account' :
    path.endsWith('/admin-crm.html') || path.endsWith('admin-crm.html') ? 'account' :
    'home';

  // Most pages set body[data-section] explicitly; prefer that for nav highlighting.
  // Exception: new-builds.html intentionally uses body[data-section="properties"] to reuse the app layout,
  // but we still want the New Builds nav link to be active.
  const section = inferredSection === 'newbuilds' ? 'newbuilds' : (bodySection || inferredSection);

  document.body.dataset.section = bodySection || section;

  document.querySelectorAll('.nav-link[data-section]').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });

  const ensureNavLink = (containerSelector, { href, text, section, afterHref }) => {
    document.querySelectorAll(containerSelector).forEach((nav) => {
      if (!nav) return;
      const existing = Array.from(nav.querySelectorAll('a')).find((a) => (a.getAttribute('href') || '').includes(href));
      if (existing) return;
      const a = document.createElement('a');
      a.href = href;
      a.textContent = text;
      if (nav.classList.contains('primary-nav')) {
        a.className = 'nav-link';
        if (section) a.dataset.section = section;
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
          <a href="index.html">Home</a>
          <a href="properties.html">Properties</a>
          <a href="new-builds.html">New Builds</a>
          <a href="businesses.html">Businesses</a>
          <a href="vehicles.html">Vehicles</a>
          <a href="services.html">Services</a>
          <a href="blog.html">Blog</a>
          <a href="account.html">Account</a>
        </nav>
        <div class="mobile-menu-foot">
          <a class="cta-button" href="mailto:info@spanishcoastproperties.com">Email</a>
          <a class="cta-button" href="tel:+34624867866">Call</a>
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
  ensureNavLink('.primary-nav', { href: 'new-builds.html', text: t('nav.new_builds') || 'New Builds', section: 'newbuilds', afterHref: 'properties.html' });
  ensureNavLink('.mobile-menu-links', { href: 'new-builds.html', text: t('nav.new_builds') || 'New Builds', afterHref: 'properties.html' });

  // Make Account discoverable without having to update every page header/footer manually.
  ensureNavLink('.primary-nav', { href: 'account.html', text: t('nav.account') || 'Account', section: 'account' });
  ensureNavLink('.mobile-menu-links', { href: 'account.html', text: t('nav.account') || 'Account' });

  // Make Blog discoverable without having to update every page header/footer manually.
  ensureNavLink('.primary-nav', { href: 'blog.html', text: t('nav.blog') || 'Blog', section: 'blog', afterHref: 'services.html' });
  ensureNavLink('.mobile-menu-links', { href: 'blog.html', text: t('nav.blog') || 'Blog', afterHref: 'services.html' });

  // Add "New Builds" to footer explore lists (only when a Properties link exists in that list).
  (() => {
    const label = t('nav.new_builds') || 'New Builds';
    document.querySelectorAll('.site-footer .footer-links').forEach((ul) => {
      if (!ul) return;
      const propsLink = ul.querySelector('a[href="properties.html"]');
      if (!propsLink) return;
      const already = Array.from(ul.querySelectorAll('a')).some((a) => (a.getAttribute('href') || '').includes('new-builds.html'));
      if (already) return;

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = 'new-builds.html';
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
    const label = t('nav.blog') || 'Blog';
    document.querySelectorAll('.site-footer .footer-links').forEach((ul) => {
      if (!ul) return;
      const servicesLink = ul.querySelector('a[href="services.html"]');
      if (!servicesLink) return;
      const already = Array.from(ul.querySelectorAll('a')).some((a) => (a.getAttribute('href') || '').includes('blog.html'));
      if (already) return;

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = 'blog.html';
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
  const setLinkText = (selector, text) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (!el) return;
      el.textContent = text;
    });
  };

  const setAriaLabel = (selector, text) => {
    document.querySelectorAll(selector).forEach((el) => {
      if (!el || !text) return;
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

    setLinkText('.primary-nav .nav-link[data-section=\"home\"]', tr('nav.home', 'Home'));
    setLinkText('.primary-nav .nav-link[data-section=\"properties\"]', tr('nav.properties', 'Properties'));
    setLinkText('.primary-nav .nav-link[data-section=\"newbuilds\"]', tr('nav.new_builds', 'New Builds'));
    setLinkText('.primary-nav .nav-link[data-section=\"businesses\"]', tr('nav.businesses', 'Businesses'));
    setLinkText('.primary-nav .nav-link[data-section=\"vehicles\"]', tr('nav.vehicles', 'Vehicles'));
    setLinkText('.primary-nav .nav-link[data-section=\"services\"]', tr('nav.services', 'Services'));
    setLinkText('.primary-nav .nav-link[data-section=\"blog\"]', tr('nav.blog', 'Blog'));
    setLinkText('.primary-nav .nav-link[data-section=\"account\"]', tr('nav.account', 'Account'));

    // Mobile menu uses plain <a> tags.
    setLinkText('.mobile-menu-links a[href=\"index.html\"]', tr('nav.home', 'Home'));
    setLinkText('.mobile-menu-links a[href=\"properties.html\"]', tr('nav.properties', 'Properties'));
    setLinkText('.mobile-menu-links a[href=\"new-builds.html\"]', tr('nav.new_builds', 'New Builds'));
    setLinkText('.mobile-menu-links a[href=\"businesses.html\"]', tr('nav.businesses', 'Businesses'));
    setLinkText('.mobile-menu-links a[href=\"vehicles.html\"]', tr('nav.vehicles', 'Vehicles'));
    setLinkText('.mobile-menu-links a[href=\"services.html\"]', tr('nav.services', 'Services'));
    setLinkText('.mobile-menu-links a[href=\"blog.html\"]', tr('nav.blog', 'Blog'));
    setLinkText('.mobile-menu-links a[href=\"account.html\"]', tr('nav.account', 'Account'));

    // Common CTA labels.
    setLinkText('.mobile-menu-foot a[href^=\"mailto:\"]', tr('nav.email', 'Email'));
    setLinkText('.contact-label', tr('nav.contact_us', 'Contact Us'));

    // Common button labels and aria-labels across pages.
    setAriaLabel('#mobile-menu-btn', tr('ui.menu', 'Menu'));
    setAriaLabel('#open-filters-btn', tr('ui.open_filters', 'Open filters'));
    setAriaLabel('#open-catalog-builder-btn', tr('properties.send_saved', 'Create catalog'));
    setAriaLabel('#toggle-map-btn', tr('ui.toggle_map', 'Toggle map'));
    setAriaLabel('#clear-filters-btn', tr('ui.clear_all_filters', 'Clear all filters'));
    setAriaLabel('#apply-filters', tr('ui.apply_filters', 'Apply filters'));
    setAriaLabel('#close-filters-btn', tr('ui.close_filters', 'Close filters'));
    setAriaLabel('.lightbox-nav.prev', tr('ui.previous_image', 'Previous image'));
    setAriaLabel('.lightbox-nav.next', tr('ui.next_image', 'Next image'));
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
