/* Vehicles page: list + map + modal + swipeable gallery, fed by vehicles-data.js. */
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body || document.body.dataset.section !== 'vehicles') return;

  const listings = Array.isArray(window.vehicleListings) ? window.vehicleListings : [];
  const providers = Array.isArray(window.vehicleProviders) ? window.vehicleProviders : [];

  const filtersBar = document.getElementById('filters-bar');
  const toggleMapBtn = document.getElementById('toggle-map-btn');
  const openFiltersBtn = document.getElementById('open-filters-btn');
  const closeFiltersBtn = document.getElementById('close-filters-btn');
  const filtersBackdrop = document.getElementById('filters-backdrop');

  const gridEl = document.getElementById('vehicle-grid');
  const mapSection = document.getElementById('vehicle-map-section');
  const mapEl = document.getElementById('vehicle-map');
  const resultsCount = document.getElementById('vehicle-results-count');

  const categoryFilter = document.getElementById('vehicle-category-filter');
  const dealFilter = document.getElementById('vehicle-deal-filter');
  const providerFilter = document.getElementById('vehicle-provider-filter');
  const locationFilter = document.getElementById('vehicle-location-filter');
  const maxPriceFilter = document.getElementById('vehicle-price-filter');
  const sortFilter = document.getElementById('vehicle-sort-filter');
  const clearBtn = document.getElementById('clear-vehicle-filters');
  const applyBtn = document.getElementById('apply-vehicle-filters');

  const modal = document.getElementById('vehicle-modal');
  const modalDetails = document.getElementById('vehicle-modal-details');
  const closeModalBtn = document.querySelector('.close-vehicle-modal');

  const lightbox = document.getElementById('vehicle-lightbox');
  const lightboxImg = document.getElementById('vehicle-lightbox-img');
  const lightboxCaption = document.getElementById('vehicle-lightbox-caption');
  const closeLightbox = document.querySelector('.close-vehicle-lightbox');
  const lightboxPrevBtn = document.querySelector('.vehicle-lightbox-nav.prev');
  const lightboxNextBtn = document.querySelector('.vehicle-lightbox-nav.next');

  let map = null;
  let markersLayer = null;
  const markerById = new Map();
  let lightboxImages = [];
  let lightboxIndex = 0;
  let touchStartX = null;
  let touchStartY = null;
  let touchStartTime = 0;

  const toText = (v, fb = '') => (typeof v === 'string' ? v : v == null ? fb : String(v));
  const norm = (v) => toText(v).trim().toLowerCase();
  const forcedCategory = norm(document.body && document.body.dataset ? document.body.dataset.vehicleCategory : '');

  const esc = (s) =>
    toText(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const formatPrice = (item) => {
    const n = Number(item && item.price);
    const currency = toText(item && item.currency, 'EUR').toUpperCase();
    const period = norm(item && item.pricePeriod);
    if (!Number.isFinite(n) || n <= 0) return 'Price on request';
    const num = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 }).format(n);
    const base = currency === 'EUR' ? `€${num}` : `${num} ${currency}`;
    if (period === 'day') return `${base} / day`;
    if (period === 'week') return `${base} / week`;
    if (period === 'month') return `${base} / month`;
    return base;
  };

  const providerById = new Map(providers.map((p) => [toText(p.id), p]));

  function syncViewportHeightVar() {
    document.documentElement.style.setProperty('--app-vh', `${window.innerHeight}px`);
  }

  function applyInitialFiltersFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const category = norm(params.get('category'));
      const deal = norm(params.get('deal'));
      const provider = toText(params.get('provider')).trim();
      const location = toText(params.get('location')).trim();
      const maxPrice = toText(params.get('maxPrice') || params.get('price')).trim();
      const sort = norm(params.get('sort'));

      if (categoryFilter && (category === 'any' || category === 'car' || category === 'boat')) {
        categoryFilter.value = category;
      }
      if (dealFilter && (deal === 'any' || deal === 'sale' || deal === 'rent')) {
        dealFilter.value = deal;
      }
      if (providerFilter && provider) {
        providerFilter.value = provider;
      }
      if (locationFilter && location) {
        locationFilter.value = location;
      }
      if (maxPriceFilter && maxPrice) {
        maxPriceFilter.value = maxPrice;
      }
      if (sortFilter && (sort === 'featured' || sort === 'date_desc' || sort === 'price_asc' || sort === 'price_desc')) {
        sortFilter.value = sort;
      }
    } catch {}

    // Dedicated pages (cars/boats) should never be overridden by query params.
    if (categoryFilter && (forcedCategory === 'car' || forcedCategory === 'boat')) {
      categoryFilter.value = forcedCategory;
      categoryFilter.disabled = true;
      categoryFilter.setAttribute('aria-disabled', 'true');
      document.body.classList.add('vehicle-category-locked');
    }
  }

  function openFromHash() {
    const raw = (window.location.hash || '').replace(/^#/, '');
    if (!raw) return;
    let id = raw;
    try {
      id = decodeURIComponent(raw);
    } catch {}
    const it = listings.find((x) => String(x && x.id) === String(id));
    if (it) openModal(it);
  }

  function syncFiltersBarHeight() {
    if (!filtersBar) return;
    const height = Math.ceil(filtersBar.getBoundingClientRect().height);
    if (height > 0) document.documentElement.style.setProperty('--filters-bar-height', `${height}px`);
  }

  function openFilters() {
    document.body.classList.add('filters-open');
  }

  function closeFilters() {
    document.body.classList.remove('filters-open');
  }

  function hydrateProviderOptions() {
    if (!providerFilter) return;
    const opts = providers
      .slice()
      .sort((a, b) => toText(a.name).localeCompare(toText(b.name)))
      .map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`);
    providerFilter.innerHTML = `<option value="any">Any provider</option>${opts.join('')}`;
  }

  function getFilters() {
    return {
      category: forcedCategory === 'car' || forcedCategory === 'boat'
        ? forcedCategory
        : categoryFilter
          ? norm(categoryFilter.value)
          : 'any',
      deal: dealFilter ? norm(dealFilter.value) : 'any',
      provider: providerFilter ? toText(providerFilter.value) : 'any',
      location: locationFilter ? norm(locationFilter.value) : '',
      maxPrice: maxPriceFilter ? Number(maxPriceFilter.value) : NaN,
      sort: sortFilter ? norm(sortFilter.value) : 'featured'
    };
  }

  function matches(item, f) {
    if (f.category !== 'any' && norm(item.category) !== f.category) return false;
    if (f.deal !== 'any' && norm(item.deal) !== f.deal) return false;
    if (f.provider !== 'any' && toText(item.providerId) !== f.provider) return false;
    if (f.location) {
      const hay = `${norm(item.location)} ${norm(item.title)} ${norm(item.providerName)}`;
      if (!hay.includes(f.location)) return false;
    }
    if (Number.isFinite(f.maxPrice)) {
      const p = Number(item.price);
      if (!Number.isFinite(p) || p <= 0 || p > f.maxPrice) return false;
    }
    return true;
  }

  function sortItems(items, f) {
    const copy = items.slice();
    const byPrice = (a, b) => (Number(a.price) || 0) - (Number(b.price) || 0);
    const byDate = (a, b) => (Number(b.dateAdded) || 0) - (Number(a.dateAdded) || 0);
    if (f.sort === 'price_asc') copy.sort(byPrice);
    else if (f.sort === 'price_desc') copy.sort((a, b) => byPrice(b, a));
    else if (f.sort === 'date_desc') copy.sort(byDate);
    return copy;
  }

  function setCardActive(id, active) {
    if (!gridEl) return;
    const el = gridEl.querySelector(`[data-vehicle-id="${CSS.escape(String(id))}"]`);
    if (el) el.classList.toggle('linked-active', !!active);
  }

  function setMarkerActive(id, active) {
    const marker = markerById.get(String(id));
    if (!marker) return;
    try {
      const iconEl = marker.getElement && marker.getElement();
      if (iconEl) iconEl.style.transform = active ? 'scale(1.06)' : '';
    } catch {}
  }

  function ensureMap() {
    if (!mapEl || map) return;
    if (!window.L || typeof window.L.map !== 'function') return;

    map = window.L.map(mapEl, {
      zoomControl: true,
      scrollWheelZoom: false,
      tap: true
    });

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    markersLayer = window.L.layerGroup().addTo(map);
    map.setView([37.978, -0.683], 12);
  }

  function updateMap(items) {
    // Avoid loading map tiles until the user asks for the map.
    const wantsMap = !!mapSection && mapSection.classList.contains('active');
    if (!wantsMap && !map) return;

    ensureMap();
    if (!map || !markersLayer) return;

    markerById.clear();
    markersLayer.clearLayers();
    const bounds = [];

    items.forEach((it) => {
      const lat = Number(it.latitude);
      const lon = Number(it.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const title = toText(it.title, 'Vehicle');
      const price = formatPrice(it);
      const providerName = toText(it.providerName, '');
      const category = norm(it.category) === 'boat' ? '🛥️ Boat' : '🚗 Car';
      const deal = norm(it.deal) === 'rent' ? 'Rent' : norm(it.deal) === 'sale' ? 'Sale' : 'Offer';

      const marker = window.L.marker([lat, lon]);
      marker.bindPopup(`<strong>${esc(title)}</strong><br>${esc(category)} · ${esc(deal)}<br>${esc(price)}${providerName ? `<br>${esc(providerName)}` : ''}`);

      const id = String(it.id);
      marker.on('mouseover', () => {
        setMarkerActive(id, true);
        setCardActive(id, true);
      });
      marker.on('mouseout', () => {
        setMarkerActive(id, false);
        setCardActive(id, false);
      });
      marker.on('click', () => openModal(it));

      marker.addTo(markersLayer);
      markerById.set(id, marker);
      bounds.push([lat, lon]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 13 });
    }
  }

  function cardHtml(it) {
    const id = toText(it.id);
    const title = toText(it.title, 'Vehicle');
    const category = norm(it.category) === 'boat' ? 'Boat' : 'Car';
    const deal = norm(it.deal) === 'rent' ? 'For Rent' : norm(it.deal) === 'sale' ? 'For Sale' : 'Offer';
    const price = formatPrice(it);
    const loc = toText(it.location, 'Costa Blanca South');
    const imgs = Array.isArray(it.images) ? it.images : [];
    const img = imgs[0] || 'assets/placeholder.png';
    const providerName = toText(it.providerName, '');

    return `
      <article class="property-card" data-vehicle-id="${esc(id)}">
        <a class="business-card-link" href="#" data-vehicle-open="${esc(id)}" aria-label="View vehicle details">
          <div class="card-img-wrapper">
            <img src="${esc(img)}" alt="${esc(title)}" loading="lazy" referrerpolicy="no-referrer"
              onerror="this.onerror=null;this.closest('.property-card')?.classList.add('listing-removed')">
            <div class="card-badge">${esc(category)}</div>
            <div class="card-status">${esc(deal)}</div>
          </div>
          <div class="card-content">
            <div class="card-ref">${providerName ? esc(providerName) : 'Partner listing'}</div>
            <h3>${esc(title)}</h3>
            <div class="location">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              ${esc(loc)}
            </div>
            <div class="price">${esc(price)}</div>
            <div class="specs">
              <div class="spec-item">${category === 'Boat' ? '🛥️' : '🚗'} ${esc(category)}</div>
              <div class="spec-item">📌 ${esc(deal)}</div>
            </div>
          </div>
        </a>
      </article>
    `;
  }

  function render() {
    if (!gridEl) return;
    const f = getFilters();
    const filtered = sortItems(listings.filter((it) => matches(it, f)), f);

    if (resultsCount) resultsCount.textContent = String(filtered.length);

    if (filtered.length === 0) {
      gridEl.innerHTML = `
        <article class="catalog-card">
          <div class="catalog-content">
            <h3>No vehicles found</h3>
            <div class="catalog-meta">Add partner feeds to <code>feeds/vehicles/</code> and <code>feeds/boats/</code>, then run <code>python3 build_vehicles_data.py</code>.</div>
            <div class="catalog-body">If you want to list your vehicles for rent or sale, email us and we will onboard your feed.</div>
          </div>
        </article>
      `;
      updateMap([]);
      return;
    }

    gridEl.innerHTML = filtered.map(cardHtml).join('');
    updateMap(filtered);
  }

  function openModal(it) {
    if (!modal || !modalDetails) return;
    const title = toText(it.title, 'Vehicle');
    const price = formatPrice(it);
    const loc = toText(it.location, 'Costa Blanca South');
    const category = norm(it.category) === 'boat' ? 'Boat' : 'Car';
    const deal = norm(it.deal) === 'rent' ? 'Rent' : norm(it.deal) === 'sale' ? 'Sale' : 'Offer';
    const imgs = Array.isArray(it.images) ? it.images : [];
    const provider = providerById.get(toText(it.providerId)) || null;
    const providerName = provider ? toText(provider.name) : toText(it.providerName);
    const providerPhone = provider ? toText(provider.phone) : '';
    const providerEmail = provider ? toText(provider.email) : 'info@spanishcoastproperties.com';
    const providerWebsite = provider ? toText(provider.website) : '';

    const shareUrl = `${window.location.origin}${window.location.pathname}${window.location.search}#${encodeURIComponent(toText(it.id))}`;
    const mailBody = encodeURIComponent(
      `Hi Spanish Coast Properties,\n\nI am interested in this ${category.toLowerCase()} (${deal.toLowerCase()}):\n- ${title}\n- ${loc}\n- ${price}\n\nLink: ${shareUrl}\n\nMy phone:\nMy preferred dates (if rental):\n\nThank you.`
    );
    const mailTo = `mailto:${encodeURIComponent(providerEmail)}?subject=${encodeURIComponent(`Vehicle inquiry - ${title}`)}&body=${mailBody}`;

    modalDetails.innerHTML = `
      <div class="modal-body">
        <h2 style="margin-bottom:0.25rem">${esc(title)}</h2>
        <div class="price" style="margin: 0.4rem 0 0.8rem">${esc(price)}</div>
        <div class="specs" style="margin-bottom:0.9rem">
          <div class="spec-item">${category === 'Boat' ? '🛥️' : '🚗'} ${esc(category)}</div>
          <div class="spec-item">📌 ${esc(deal)}</div>
          <div class="spec-item">📍 ${esc(loc)}</div>
        </div>
        <div class="modal-actions" style="display:flex; flex-wrap:wrap; gap:0.6rem; margin-bottom:0.9rem">
          <a class="cta-button" href="${mailTo}">Request details</a>
          ${providerPhone ? `<a class="cta-button" href="tel:${esc(providerPhone)}">Call provider</a>` : ''}
          ${providerWebsite ? `<a class="cta-button" href="${esc(providerWebsite)}" target="_blank" rel="noreferrer">Website</a>` : ''}
          <button class="cta-button" type="button" id="vehicle-share-btn">Share</button>
        </div>
        ${imgs.length ? `
          <div class="gallery-grid">
            ${imgs.slice(0, 10).map((u, idx) => `
              <img src="${esc(u)}" alt="${esc(title)} photo ${idx + 1}" loading="lazy" data-vehicle-gallery-idx="${idx}"
                onerror="this.remove()">
            `).join('')}
          </div>
        ` : ''}
        ${it.description ? `<div class="catalog-meta" style="margin-top:1rem; line-height:1.7">${esc(it.description)}</div>` : ''}
      </div>
    `;

    // Hook gallery click to lightbox.
    lightboxImages = imgs.slice();
    modalDetails.querySelectorAll('[data-vehicle-gallery-idx]').forEach((imgEl) => {
      imgEl.addEventListener('click', () => {
        const idx = Number(imgEl.getAttribute('data-vehicle-gallery-idx') || '0');
        openLightbox(idx);
      });
    });

    const shareBtn = document.getElementById('vehicle-share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        try {
          if (navigator.share) {
            await navigator.share({ title, text: `${title} - ${price}`, url: shareUrl });
          } else {
            await navigator.clipboard.writeText(shareUrl);
            shareBtn.textContent = 'Copied';
            setTimeout(() => (shareBtn.textContent = 'Share'), 1200);
          }
        } catch {}
      });
    }

    modal.style.display = 'block';
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    if (!modal) return;
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
    if (modalDetails) modalDetails.innerHTML = '';
  }

  function openLightbox(idx) {
    if (!lightbox || !lightboxImg) return;
    if (!Array.isArray(lightboxImages) || lightboxImages.length === 0) return;
    lightboxIndex = Math.max(0, Math.min(lightboxImages.length - 1, Number(idx) || 0));
    lightboxImg.src = lightboxImages[lightboxIndex];
    if (lightboxCaption) {
      lightboxCaption.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
    }
    lightbox.style.display = 'flex';
    document.body.classList.add('lightbox-open');
  }

  function closeLightboxModal() {
    if (!lightbox) return;
    lightbox.style.display = 'none';
    document.body.classList.remove('lightbox-open');
    if (lightboxImg) lightboxImg.src = '';
  }

  function showNext(delta) {
    if (!Array.isArray(lightboxImages) || lightboxImages.length === 0) return;
    lightboxIndex = (lightboxIndex + delta + lightboxImages.length) % lightboxImages.length;
    if (lightboxImg) lightboxImg.src = lightboxImages[lightboxIndex];
    if (lightboxCaption) lightboxCaption.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;
  }

  // Events
  hydrateProviderOptions();
  applyInitialFiltersFromUrl();
  syncViewportHeightVar();
  syncFiltersBarHeight();
  render();
  openFromHash();

  window.addEventListener('resize', () => {
    syncViewportHeightVar();
    syncFiltersBarHeight();
    if (map && typeof map.invalidateSize === 'function') setTimeout(() => map.invalidateSize(), 60);
  });

  window.addEventListener('hashchange', () => {
    // Enable share links like vehicles.html#SCP-CAR-001.
    openFromHash();
  });

  if (openFiltersBtn) openFiltersBtn.addEventListener('click', openFilters);
  if (closeFiltersBtn) closeFiltersBtn.addEventListener('click', closeFilters);
  if (filtersBackdrop) filtersBackdrop.addEventListener('click', closeFilters);

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (categoryFilter) categoryFilter.value = 'any';
      if (dealFilter) dealFilter.value = 'any';
      if (providerFilter) providerFilter.value = 'any';
      if (locationFilter) locationFilter.value = '';
      if (maxPriceFilter) maxPriceFilter.value = '';
      if (sortFilter) sortFilter.value = 'featured';
      render();
      closeFilters();
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      render();
      closeFilters();
    });
  }

  [categoryFilter, dealFilter, providerFilter, sortFilter].forEach((el) => {
    if (!el) return;
    el.addEventListener('change', render);
  });
  [locationFilter, maxPriceFilter].forEach((el) => {
    if (!el) return;
    el.addEventListener('input', () => {
      render();
    });
  });

  if (toggleMapBtn && mapSection) {
    toggleMapBtn.style.display = 'inline-flex';
    toggleMapBtn.addEventListener('click', () => {
      const next = !mapSection.classList.contains('active');
      mapSection.classList.toggle('active', next);
      document.body.classList.toggle('map-open', next);
      toggleMapBtn.textContent = next ? 'List' : 'Map';
      if (next) {
        ensureMap();
        // Now that the map is visible, draw markers for the current filters.
        render();
        setTimeout(() => map && map.invalidateSize && map.invalidateSize(), 120);
        try {
          mapSection.scrollIntoView({ block: 'start', behavior: 'smooth' });
        } catch {}
      }
    });
  }

  if (gridEl) {
    gridEl.addEventListener('mouseover', (e) => {
      const card = e.target && e.target.closest && e.target.closest('[data-vehicle-id]');
      if (!card) return;
      const id = card.getAttribute('data-vehicle-id');
      if (!id) return;
      setCardActive(id, true);
      setMarkerActive(id, true);
    });
    gridEl.addEventListener('mouseout', (e) => {
      const card = e.target && e.target.closest && e.target.closest('[data-vehicle-id]');
      if (!card) return;
      const id = card.getAttribute('data-vehicle-id');
      if (!id) return;
      setCardActive(id, false);
      setMarkerActive(id, false);
    });
    gridEl.addEventListener('click', (e) => {
      const link = e.target && e.target.closest && e.target.closest('[data-vehicle-open]');
      if (!link) return;
      e.preventDefault();
      const id = link.getAttribute('data-vehicle-open');
      const it = listings.find((x) => String(x.id) === String(id));
      if (it) openModal(it);
    });
  }

  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (closeLightbox) closeLightbox.addEventListener('click', closeLightboxModal);
  if (lightboxPrevBtn) lightboxPrevBtn.addEventListener('click', () => showNext(-1));
  if (lightboxNextBtn) lightboxNextBtn.addEventListener('click', () => showNext(1));

  if (lightbox) {
    lightbox.addEventListener('touchstart', (e) => {
      const t = e.touches && e.touches[0];
      if (!t) return;
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = Date.now();
    }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
      if (touchStartX == null || touchStartY == null) return;
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const dt = Date.now() - touchStartTime;
      touchStartX = null;
      touchStartY = null;
      if (dt > 700) return;
      if (Math.abs(dx) < 30 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      showNext(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightboxModal();
      closeModal();
      closeFilters();
    }
    if (e.key === 'ArrowLeft' && document.body.classList.contains('lightbox-open')) showNext(-1);
    if (e.key === 'ArrowRight' && document.body.classList.contains('lightbox-open')) showNext(1);
  });
});
