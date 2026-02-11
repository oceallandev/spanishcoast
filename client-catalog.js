document.addEventListener('DOMContentLoaded', () => {
  const t = (key, fallback, vars) => {
    try {
      if (window.SCP_I18N && typeof window.SCP_I18N.t === 'function') {
        return window.SCP_I18N.t(key, vars);
      }
    } catch {
      // ignore
    }
    if (fallback !== undefined) {
      return String(fallback);
    }
    return String(key || '');
  };

  const titleEl = document.getElementById('client-catalog-title');
  const subtitleEl = document.getElementById('client-catalog-subtitle');
  const summaryEl = document.getElementById('client-catalog-summary');
  const gridEl = document.getElementById('client-catalog-grid');
  const copyBtn = document.getElementById('client-catalog-copy');
  const printBtn = document.getElementById('client-catalog-print');
  const wlCheckbox = document.getElementById('client-catalog-wl');
  const footerYear = document.getElementById('footer-year');

  if (footerYear) {
    footerYear.textContent = String(new Date().getFullYear());
  }

  const normalizeFeedText = (value) => {
    const raw = value == null ? '' : String(value);
    if (!raw) return raw;
    return raw
      .replace(/\[\s*amp\s*,?\s*\]/gi, '&')
      .replace(/&amp,/gi, '&')
      .replace(/&amp(?!;)/gi, '&');
  };
  const toText = (v, fb = '') => (typeof v === 'string' ? normalizeFeedText(v) : (v == null ? fb : normalizeFeedText(v)));
  const escapeHtml = (s) => toText(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const normalizeRef = (v) => toText(v).trim().toUpperCase();
  const numberFormat = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 });

  const parseRefs = (raw) => {
    const text = toText(raw);
    const out = [];
    const seen = new Set();
    text.split(/[,\s]+/g).forEach((item) => {
      const ref = normalizeRef(item);
      if (!ref || seen.has(ref)) return;
      seen.add(ref);
      out.push(ref);
    });
    return out.slice(0, 120);
  };

  const imageUrlsFor = (property) => {
    const candidates = [];
    const images = property && property.images;
    if (Array.isArray(images)) {
      images.forEach((img) => candidates.push(img));
    } else if (typeof images === 'string') {
      images.split(/[,\n]/g).map((v) => v.trim()).filter(Boolean).forEach((img) => candidates.push(img));
    }
    ['image', 'image_url', 'imageUrl', 'main_image', 'photo', 'thumbnail'].forEach((k) => {
      const val = property && property[k];
      if (val) candidates.push(val);
    });
    const uniq = [];
    const seen = new Set();
    candidates.forEach((raw) => {
      const value = toText(raw).trim();
      if (!value) return;
      const safe = value.startsWith('http://') ? `https://${value.slice('http://'.length)}` : value;
      if (seen.has(safe)) return;
      seen.add(safe);
      uniq.push(safe);
    });
    return uniq;
  };

  const listingPriceNumber = (property) => {
    const p = Number(property && property.price);
    if (Number.isFinite(p) && p > 0) return p;
    const rent = Number(property && property.rent_price);
    if (Number.isFinite(rent) && rent > 0) return rent;
    return NaN;
  };

  const listingModeFor = (property) => {
    const mode = toText(property && property.listing_mode).trim().toLowerCase();
    if (mode === 'rent' || mode === 'rent_longterm' || mode === 'rent_vacation') return 'rent';
    if (mode === 'traspaso') return 'traspaso';
    return 'sale';
  };

  const formatPrice = (property) => {
    const amount = listingPriceNumber(property);
    if (!Number.isFinite(amount) || amount <= 0) return t('pricing.on_request', 'Price on request');
    const mode = listingModeFor(property);
    if (mode === 'rent') return `€${numberFormat.format(amount)} / ${t('time.month', 'month')}`;
    if (mode === 'traspaso') return `€${numberFormat.format(amount)} (${t('listing.traspaso', 'Traspaso')})`;
    return `€${numberFormat.format(amount)}`;
  };

  const builtAreaFor = (property) => {
    const built = Number(property && property.surface_area && property.surface_area.built);
    return Number.isFinite(built) ? Math.round(built) : 0;
  };

  const params = new URLSearchParams(window.location.search);
  const refs = parseRefs(params.get('refs'));
  const clientName = toText(params.get('client')).trim();
  let whiteLabel = params.get('wl') === '1';
  if (wlCheckbox) wlCheckbox.checked = whiteLabel;

  const allProperties = []
    .concat(Array.isArray(window.propertyData) ? window.propertyData : [])
    .concat(Array.isArray(window.customPropertyData) ? window.customPropertyData : []);

  const byRef = new Map();
  allProperties.forEach((p) => {
    const ref = normalizeRef(p && p.ref);
    if (!ref || byRef.has(ref)) return;
    byRef.set(ref, p);
  });

  const toggleWhiteLabelClass = () => {
    document.body.classList.toggle('catalog-wl', !!whiteLabel);
  };

  const buildCatalogUrl = () => {
    const url = new URL(window.location.href);
    if (refs.length) url.searchParams.set('refs', refs.join(','));
    else url.searchParams.delete('refs');
    if (clientName) url.searchParams.set('client', clientName);
    else url.searchParams.delete('client');
    if (whiteLabel) url.searchParams.set('wl', '1');
    else url.searchParams.delete('wl');
    return url.toString();
  };

  const listingCard = (property) => {
    const ref = normalizeRef(property && property.ref);
    const type = toText(property && property.type, t('modal.type_default', 'Property'));
    const town = toText(property && property.town, t('modal.town_unknown', 'Unknown Area'));
    const province = toText(property && property.province, 'Alicante');
    const beds = Number(property && property.beds) || 0;
    const baths = Number(property && property.baths) || 0;
    const built = builtAreaFor(property);
    const image = imageUrlsFor(property)[0] || 'assets/placeholder.png';
    const listingUrl = `properties.html?ref=${encodeURIComponent(ref)}`;
    const brochureParams = new URLSearchParams({ ref });
    if (whiteLabel) brochureParams.set('wl', '1');
    const brochureUrl = `brochure.html?${brochureParams.toString()}`;

    return `
      <article class="client-catalog-card property-card">
        <div class="card-img-wrapper">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(type)}" loading="lazy" referrerpolicy="no-referrer"
            onerror="this.onerror=null;this.src='assets/placeholder.png'">
          <div class="card-badge">${escapeHtml(type)}</div>
        </div>
        <div class="card-content">
          <div class="card-ref">${escapeHtml(ref)}</div>
          <h3>${escapeHtml(type)} ${escapeHtml(t('common.in', 'in'))} ${escapeHtml(town)}</h3>
          <div class="location">${escapeHtml(town)}, ${escapeHtml(province)}</div>
          <div class="price">${escapeHtml(formatPrice(property))}</div>
          <div class="specs">
            <div class="spec-item">🛏️ ${escapeHtml(t('modal.spec.beds', 'Beds'))} ${beds}</div>
            <div class="spec-item">🛁 ${escapeHtml(t('modal.spec.baths', 'Baths'))} ${baths}</div>
            <div class="spec-item">📐 ${escapeHtml(t('modal.spec.area', 'Area'))} ${built} m2</div>
          </div>
          <div class="card-actions">
            <a class="card-action" href="${escapeHtml(listingUrl)}" target="_blank" rel="noopener">${escapeHtml(t('catalog.details', 'Details'))}</a>
            <a class="card-action" href="${escapeHtml(brochureUrl)}" target="_blank" rel="noopener">${escapeHtml(t('modal.brochure_pdf', 'Brochure (PDF)'))}</a>
          </div>
        </div>
      </article>
    `;
  };

  const setSummary = (count, missing) => {
    if (!summaryEl) return;
    const client = clientName ? `${t('catalog.page.for_client', 'For')}: ${clientName} · ` : '';
    const missingPart = missing > 0 ? ` · ${missing} ${t('catalog.page.not_found', 'not found')}` : '';
    summaryEl.textContent = `${client}${count} ${t('catalog.page.listings', 'listings')}${missingPart}`;
  };

  const render = () => {
    toggleWhiteLabelClass();

    if (titleEl && clientName) {
      titleEl.textContent = `${t('catalog.page.title', 'Client Catalog')} · ${clientName}`;
    }
    if (subtitleEl) {
      subtitleEl.textContent = whiteLabel
        ? t('catalog.page.subtitle_wl', 'White-label view enabled. Branding is hidden.')
        : t('catalog.page.subtitle', 'A clean shortlist generated from your search.');
    }

    if (!gridEl) return;

    if (!refs.length) {
      gridEl.innerHTML = `
        <div class="catalog-hero client-catalog-empty">
          <h3>${escapeHtml(t('catalog.page.empty_title', 'No listings selected'))}</h3>
          <p class="muted">${escapeHtml(t('catalog.page.empty_help', 'Open Properties, filter listings, then use Create catalog.'))}</p>
        </div>
      `;
      setSummary(0, 0);
      return;
    }

    const selected = refs.map((ref) => byRef.get(ref)).filter(Boolean);
    const missing = Math.max(0, refs.length - selected.length);
    setSummary(selected.length, missing);

    if (!selected.length) {
      gridEl.innerHTML = `
        <div class="catalog-hero client-catalog-empty">
          <h3>${escapeHtml(t('catalog.page.empty_title', 'No listings selected'))}</h3>
          <p class="muted">${escapeHtml(t('catalog.page.empty_help', 'Open Properties, filter listings, then use Create catalog.'))}</p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = selected.map((p) => listingCard(p)).join('');
  };

  const flashButton = (btn, text) => {
    if (!btn) return;
    const prev = btn.textContent;
    btn.textContent = text;
    window.setTimeout(() => {
      btn.textContent = prev || '';
    }, 1300);
  };

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const url = buildCatalogUrl();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          flashButton(copyBtn, t('modal.copied', 'Copied'));
          return;
        }
      } catch {
        // fallback
      }
      window.prompt(t('modal.share.copy_prompt', 'Copy link:'), url);
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }

  if (wlCheckbox) {
    wlCheckbox.addEventListener('change', () => {
      whiteLabel = !!wlCheckbox.checked;
      const url = new URL(window.location.href);
      if (whiteLabel) url.searchParams.set('wl', '1');
      else url.searchParams.delete('wl');
      window.history.replaceState({}, '', url.toString());
      render();
    });
  }

  render();
});
