// Render Businesses/Vehicles catalogs without loading the heavy property app.
(() => {
  const businessGrid = document.getElementById('business-grid');
  const vehicleGrid = document.getElementById('vehicle-grid');
  const businessKindFilter = document.getElementById('business-kind-filter');
  const businessCountEl = document.getElementById('business-count');

  const toText = (v, fb = '') => (typeof v === 'string' ? v : v == null ? fb : String(v));
  const esc = (s) => toText(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

  const businessCard = (b) => {
    const ref = toText(b.ref).trim();
    const kind = toText(b.kind, 'business');
    const kindLabel = kind === 'traspaso' ? 'Traspaso' : 'Business';
    const title = toText(b.title, 'Business');
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
            <div class="card-badge">Business</div>
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
              <div class="spec-item">🔎 View details</div>
            </div>
            ${desc ? `<div class="catalog-meta" style="margin-top:0.65rem">${esc(desc)}</div>` : ''}
          </div>
        </a>
      </article>
    `;
  };

  if (businessGrid) {
    const merged = [
      ...businessListings,
      ...businessItems.map((b) => ({
        id: toText(b.id || b.ref || b.title || Math.random()),
        ref: toText(b.ref || ''),
        kind: toText(b.kind || 'business'),
        title: toText(b.title || 'Business'),
        town: toText(b.location || 'Costa Blanca South'),
        province: 'Alicante',
        price: b.price || null,
        currency: b.currency || 'EUR',
        image: toText(b.image || ''),
        description: toText(b.description || '')
      }))
    ];

    const renderBusinesses = () => {
      const kind = businessKindFilter ? toText(businessKindFilter.value, 'all') : 'all';
      const filtered = kind === 'all' ? merged : merged.filter((b) => toText(b.kind, 'business') === kind);

      if (businessCountEl) {
        businessCountEl.textContent = `${filtered.length} listing${filtered.length === 1 ? '' : 's'}`;
      }

      if (filtered.length === 0) {
        businessGrid.innerHTML = card(
          'No businesses found',
          'Try switching the filter to All.',
          'If you tell us your budget and preferred sector, we will shortlist the best opportunities.'
        );
        return;
      }

      businessGrid.innerHTML = filtered.map((b) => businessCard(b)).join('');
    };

    if (businessKindFilter) {
      businessKindFilter.addEventListener('change', renderBusinesses);
    }
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
