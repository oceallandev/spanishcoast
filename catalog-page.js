// Render Businesses/Vehicles catalogs without loading the heavy property app.
(() => {
  const businessGrid = document.getElementById('business-grid');
  const vehicleGrid = document.getElementById('vehicle-grid');
  const businessKindFilter = document.getElementById('business-kind-filter');
  const businessTypeFilter = document.getElementById('business-type-filter');
  const businessCountEl = document.getElementById('business-count');
  const businessMapToggleBtn = document.getElementById('business-map-toggle');
  const businessHeaderMapToggleBtn = document.getElementById('toggle-map-btn');
  const businessMapWrap = document.getElementById('business-map-wrap');
  const businessMapCountEl = document.getElementById('business-map-count');
  const businessMapEl = document.getElementById('business-map');
  let businessMap = null;
  let businessMarkersLayer = null;

  const toText = (v, fb = '') => (typeof v === 'string' ? v : v == null ? fb : String(v));
  const esc = (s) => toText(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => esc(s).replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
  const norm = (v) => toText(v).trim().toLowerCase();

  const businessItems = Array.isArray(window.businessData) ? window.businessData : [];
  const vehicleItems = Array.isArray(window.vehicleData) ? window.vehicleData : [];
  const businessListings = Array.isArray(window.businessListings) ? window.businessListings : [];

  const card = (title, meta, body) => `
    <article class="catalog-card">
      <div class="catalog-content">
        <h3>${esc(title)}</h3>
        <div class="catalog-meta">${esc(meta)}</div>
        ${body ? `<div class="catalog-body">${esc(body)}</div>` : ''}
      </div>
    </article>
  `;

  const formatPrice = (price, currency = 'EUR') => {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return 'Price on request';
    const num = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 }).format(n);
    return currency === 'EUR' ? `€${num}` : `${num} ${currency}`;
  };

  const formatPriceCompact = (price, currency = 'EUR') => {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (currency !== 'EUR') return formatPrice(price, currency);
    if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1).replace(/\\.0$/, '')}M`;
    if (n >= 10_000) return `€${Math.round(n / 1000)}k`;
    return `€${new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 }).format(n)}`;
  };

  const businessCard = (b) => {
    const ref = toText(b.ref).trim();
    const kind = toText(b.kind, 'business');
    const kindLabel = kind === 'traspaso' ? 'Traspaso' : 'Business';
    const bizType = toText(b.businessType || b.title, 'Business');
    const title = bizType;
    const town = toText(b.town, 'Costa Blanca South');
    const province = toText(b.province, 'Alicante');
    const img = toText(b.image, '');
    const href = ref ? `properties.html?ref=${encodeURIComponent(ref)}` : 'properties.html';
    const price = formatPrice(b.price, b.currency);
    const desc = toText(b.description, '');

    return `
      <article class="property-card">
        <a class="business-card-link" href="${href}">
          <div class="card-img-wrapper">
            <img src="${esc(img)}" alt="${esc(title)}" loading="lazy" referrerpolicy="no-referrer"
              onerror="this.onerror=null;this.src='assets/placeholder.png'">
            <div class="card-badge">${esc(bizType)}</div>
            <div class="card-status ${esc(kind)}">${esc(kindLabel)}</div>
          </div>
          <div class="card-content">
            <div class="card-ref">${esc(ref || kindLabel)}</div>
            <h3>${esc(title)}</h3>
            <div class="location">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              ${esc(town)}, ${esc(province)}
            </div>
            <div class="price">${esc(price)}</div>
            <div class="specs">
              <div class="spec-item">🏷️ ${esc(kindLabel)}</div>
              <div class="spec-item">🏪 ${esc(bizType)}</div>
            </div>
            ${desc ? `<div class="catalog-meta" style="margin-top:0.65rem">${esc(desc)}</div>` : ''}
          </div>
        </a>
      </article>
    `;
  };

  const ensureBusinessMap = () => {
    if (!businessMapEl || businessMap) return;
    if (!window.L || typeof window.L.map !== 'function') return;

    businessMap = window.L.map(businessMapEl, {
      zoomControl: true,
      scrollWheelZoom: false,
      tap: true
    });

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(businessMap);

    businessMarkersLayer = window.L.layerGroup().addTo(businessMap);
    businessMap.setView([37.978, -0.683], 12);
  };

  const updateBusinessMap = (items) => {
    // Avoid loading map tiles until the user asks for the map.
    const wantsMap = !!businessMapWrap && !businessMapWrap.hidden;
    if (!wantsMap && !businessMap) {
      if (businessMapCountEl) {
        businessMapCountEl.textContent = '';
      }
      return;
    }

    ensureBusinessMap();
    if (!businessMap || !businessMarkersLayer) return;

    businessMarkersLayer.clearLayers();
    const bounds = [];

    items.forEach((b) => {
      const lat = Number(b.latitude ?? b.lat);
      const lon = Number(b.longitude ?? b.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const ref = toText(b.ref).trim();
      const label = toText(b.businessType || b.title || 'Business');
      const price = formatPrice(b.price, b.currency);
      const priceCompact = formatPriceCompact(b.price, b.currency);
      const tag = `${label}${priceCompact ? ` · ${priceCompact}` : ''}`;

      const icon = window.L.divIcon({
        className: 'biz-marker-icon',
        html: `
          <div class="biz-marker">
            <div class="biz-marker-pin">
              <img class="biz-marker-logo" src="assets/header-logo.png" alt="">
            </div>
            <div class="biz-marker-tag">${esc(tag)}</div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 44],
        popupAnchor: [0, -44]
      });

      const marker = window.L.marker([lat, lon], { icon });
      marker.bindPopup(`<strong>${esc(label)}</strong><br>${esc(ref)}<br>${esc(price)}`);
      marker.on('click', () => {
        if (ref) window.location.href = `properties.html?ref=${encodeURIComponent(ref)}`;
      });
      marker.addTo(businessMarkersLayer);
      bounds.push([lat, lon]);
    });

    if (businessMapCountEl) {
      businessMapCountEl.textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;
    }

    if (bounds.length > 0) {
      businessMap.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    }
  };

  const setBusinessMapMode = (next) => {
    if (!businessMapWrap) return;
    businessMapWrap.hidden = !next;
    if (businessMapToggleBtn) businessMapToggleBtn.textContent = next ? 'List' : 'Map';
    if (businessHeaderMapToggleBtn) businessHeaderMapToggleBtn.textContent = next ? 'List' : 'Map';
    if (next) {
      // Leaflet needs a layout pass when a hidden container becomes visible.
      setTimeout(() => {
        if (businessMap) businessMap.invalidateSize();
      }, 50);
    }
  };

  if (businessGrid) {
    const merged = [
      ...businessListings,
      ...businessItems.map((b) => ({
        id: toText(b.id || b.ref || b.title || Math.random()),
        ref: toText(b.ref || ''),
        kind: toText(b.kind || 'business'),
        title: toText(b.title || 'Business'),
        businessType: toText(b.businessType || b.category || b.title || 'Business'),
        town: toText(b.location || 'Costa Blanca South'),
        province: 'Alicante',
        price: b.price || null,
        currency: b.currency || 'EUR',
        image: toText(b.image || ''),
        description: toText(b.description || ''),
        latitude: b.latitude ?? b.lat ?? null,
        longitude: b.longitude ?? b.lon ?? null
      }))
    ];

    const uniqueBusinessTypes = () => {
      const seen = new Set();
      merged.forEach((b) => {
        const t = toText(b.businessType || b.title).trim();
        if (t) seen.add(t);
      });
      return Array.from(seen).sort((a, b) => a.localeCompare(b));
    };

    const hydrateBusinessTypeOptions = () => {
      if (!businessTypeFilter) return;
      const current = toText(businessTypeFilter.value || 'all', 'all');
      const options = uniqueBusinessTypes();
      businessTypeFilter.innerHTML = [
        `<option value="all">All</option>`,
        ...options.map((t) => `<option value="${escAttr(t)}">${esc(t)}</option>`)
      ].join('');
      businessTypeFilter.value = options.includes(current) ? current : 'all';
    };

    const renderBusinesses = () => {
      const kind = businessKindFilter ? toText(businessKindFilter.value, 'all') : 'all';
      const type = businessTypeFilter ? toText(businessTypeFilter.value, 'all') : 'all';
      // Treat "business" and "traspaso" as the same operation for most users; keep internal "kind"
      // but do not force filtering by it unless the old select exists.
      const filteredByKind = businessKindFilter
        ? (kind === 'all' ? merged : merged.filter((b) => toText(b.kind, 'business') === kind))
        : merged;
      const filtered = type === 'all'
        ? filteredByKind
        : filteredByKind.filter((b) => norm(b.businessType || b.title) === norm(type));

      if (businessCountEl) {
        businessCountEl.textContent = `${filtered.length} listing${filtered.length === 1 ? '' : 's'}`;
      }

      if (filtered.length === 0) {
        businessGrid.innerHTML = card(
          'No businesses found',
          'Try switching the filter to All.',
          'If you tell us your budget and preferred sector, we will shortlist the best opportunities.'
        );
        updateBusinessMap([]);
        return;
      }

      businessGrid.innerHTML = filtered.map((b) => businessCard(b)).join('');
      updateBusinessMap(filtered);
    };

    if (businessKindFilter) {
      businessKindFilter.addEventListener('change', renderBusinesses);
    }
    if (businessTypeFilter) {
      hydrateBusinessTypeOptions();
      businessTypeFilter.addEventListener('change', renderBusinesses);
    }
	    if (businessMapToggleBtn) {
	      businessMapToggleBtn.addEventListener('click', () => {
	        const next = !!businessMapWrap && businessMapWrap.hidden;
	        setBusinessMapMode(next);
	        if (next) {
	          // Ensure the map is rendered with current results.
	          renderBusinesses();
	        }
	      });
	    }
	    if (businessHeaderMapToggleBtn) {
	      businessHeaderMapToggleBtn.addEventListener('click', () => {
	        const next = !!businessMapWrap && businessMapWrap.hidden;
	        setBusinessMapMode(next);
	        if (next) {
	          renderBusinesses();
	        }
	      });
	    }

	    // Desktop: show the map by default so users immediately see it exists.
	    // Mobile: keep list-first (map is available via the header toggle).
	    const openByDefault = window.matchMedia && window.matchMedia('(min-width: 1024px)').matches;
	    setBusinessMapMode(!!openByDefault);
	    renderBusinesses();
	  }

  if (vehicleGrid) {
    if (vehicleItems.length === 0) {
      vehicleGrid.innerHTML = card(
        'Vehicles coming soon',
        'Cars and boats for sale or rent.',
        'Tell us what you need and we will source options and manage the process.'
      );
    } else {
      vehicleGrid.innerHTML = vehicleItems.map((v) =>
        card(v.title || 'Vehicle', v.category || 'Car / Boat', v.description || '')
      ).join('');
    }
  }
})();
