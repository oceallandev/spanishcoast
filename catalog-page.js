// Render Businesses/Vehicles catalogs without loading the heavy property app.
(() => {
  const businessGrid = document.getElementById('business-grid');
  const vehicleGrid = document.getElementById('vehicle-grid');

  const toText = (v, fb = '') => (typeof v === 'string' ? v : v == null ? fb : String(v));
  const esc = (s) => toText(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const businessItems = Array.isArray(window.businessData) ? window.businessData : [];
  const vehicleItems = Array.isArray(window.vehicleData) ? window.vehicleData : [];

  const card = (title, meta, body) => `
    <article class="catalog-card">
      <div class="catalog-content">
        <h3>${esc(title)}</h3>
        <div class="catalog-meta">${esc(meta)}</div>
        ${body ? `<div class="catalog-body">${esc(body)}</div>` : ''}
      </div>
    </article>
  `;

  if (businessGrid) {
    if (businessItems.length === 0) {
      businessGrid.innerHTML = card(
        'Businesses coming soon',
        'We are preparing the first curated opportunities.',
        'Contact us and we will shortlist options matched to your budget and sector.'
      );
    } else {
      businessGrid.innerHTML = businessItems.map((b) =>
        card(b.title || 'Business', b.location || 'Costa Blanca South', b.description || '')
      ).join('');
    }
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

