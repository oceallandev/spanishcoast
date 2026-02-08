(() => {
  const $ = (id) => document.getElementById(id);
  const refChip = $('brochure-ref');
  const refFoot = $('brochure-ref-foot');
  const typeEl = $('brochure-type');
  const locationEl = $('brochure-location');
  const priceEl = $('brochure-price');
  const heroImg = $('brochure-hero-img');
  const statsEl = $('brochure-stats');
  const highlightsEl = $('brochure-highlights');
  const descEl = $('brochure-description');
  const featuresEl = $('brochure-features');
  const galleryEl = $('brochure-gallery');
  const toggleBrandBtn = $('brochure-toggle-brand');
  const copyBtn = $('brochure-copy-link');
  const emailLink = $('brochure-email-link');
  const printBtn = $('brochure-print');
  const brandEl = $('brochure-brand');
  const footEl = $('brochure-foot');

  const toText = (v, fallback = '') => {
    if (v === null || v === undefined) return fallback;
    const s = String(v);
    return s.trim() ? s : fallback;
  };

  const escapeHtml = (value) =>
    toText(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const normalize = (value) =>
    toText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const parseEuroAmount = (text) => {
    const m = toText(text).match(/€\s*([\d.,]+)/);
    if (!m) return NaN;
    const raw = m[1].replace(/\./g, '').replace(/,/g, '.');
    const num = Number(raw);
    return Number.isFinite(num) ? num : NaN;
  };

  const rentPriceFromDescription = (description) => {
    const text = toText(description);
    const monthly = text.match(/Monthly\s+rent\s*:\s*€\s*[\d.,]+/i);
    if (monthly) return parseEuroAmount(monthly[0]);
    const rentAlt = text.match(/\bRent\b[^€]{0,24}€\s*[\d.,]+/i);
    if (rentAlt) return parseEuroAmount(rentAlt[0]);
    return null;
  };

  const listingModeFor = (property) => {
    const explicit = normalize(property && (property.listing_mode || property.listingMode || property.mode));
    if (explicit === 'sale' || explicit === 'rent' || explicit === 'traspaso' || explicit === 'business') return explicit;
    const salePrice = Number(property && property.price);
    if (Number.isFinite(salePrice) && salePrice > 0) return 'sale';
    const text = normalize(property && property.description);
    if (text.includes('traspaso') || text.includes('being transferred') || text.includes('is transferred')) return 'traspaso';
    if (text.includes('for rent') || text.includes('monthly rent')) return 'rent';
    return rentPriceFromDescription(property && property.description) ? 'rent' : 'sale';
  };

  const rentPeriodFor = (property) => {
    const explicit = normalize(property && (property.rent_period || property.rentPeriod));
    if (explicit === 'night' || explicit === 'day' || explicit === 'week' || explicit === 'month') return explicit;
    const text = normalize(property && property.description);
    if (text.includes('per night') || text.includes('/night') || text.includes('nightly')) return 'night';
    if (text.includes('per day') || text.includes('/day') || text.includes('daily rent') || text.includes('daily rate')) return 'day';
    if (text.includes('per week') || text.includes('/week') || text.includes('weekly')) return 'week';
    return 'month';
  };

  const listingPriceNumber = (property) => {
    const mode = listingModeFor(property);
    if (mode === 'rent') {
      const explicitRent = Number(property && (property.rent_price || property.rentPrice || property.price_rent));
      if (Number.isFinite(explicitRent) && explicitRent > 0) return explicitRent;
    }
    const salePrice = Number(property && property.price);
    if (Number.isFinite(salePrice) && salePrice > 0) return salePrice;
    const rentPrice = rentPriceFromDescription(property && property.description);
    return rentPrice ?? NaN;
  };

  const formatPrice = (price) => {
    const number = Number(price);
    if (!Number.isFinite(number) || number <= 0) return 'Price on request';
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number);
  };

  const formatListingPrice = (property) => {
    const mode = listingModeFor(property);
    const number = listingPriceNumber(property);
    if (!Number.isFinite(number)) return 'Price on request';
    const formatted = formatPrice(number);
    if (mode === 'rent') {
      const period = rentPeriodFor(property);
      if (period === 'night') return `${formatted} / night`;
      if (period === 'day') return `${formatted} / day`;
      if (period === 'week') return `${formatted} / week`;
      return `${formatted} / month`;
    }
    if (mode === 'traspaso') return `${formatted} (Traspaso)`;
    return formatted;
  };

  const builtAreaFor = (property) => {
    const built = Number(property && property.surface_area && property.surface_area.built);
    return Number.isFinite(built) ? built : 0;
  };

  const eurPerSqmFor = (property) => {
    const price = listingPriceNumber(property);
    const built = builtAreaFor(property);
    if (!Number.isFinite(price) || price <= 0) return '';
    if (!Number.isFinite(built) || built <= 0) return '';
    const n = Math.round(price / built);
    return `€${new Intl.NumberFormat('en-IE').format(n)} / m2`;
  };

  const imageUrlsFor = (property) => {
    const images = property && property.images;
    const candidates = [];
    if (Array.isArray(images)) {
      images.forEach((v) => candidates.push(v));
    } else if (typeof images === 'string') {
      images
        .split(/[,\n]/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((v) => candidates.push(v));
    }
    const seen = new Set();
    const unique = [];
    candidates.forEach((raw) => {
      const url = toText(raw).trim();
      if (!url) return;
      const httpsUrl = url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;
      const normalized = encodeURI(httpsUrl);
      if (seen.has(normalized)) return;
      seen.add(normalized);
      unique.push(normalized);
    });
    return unique;
  };

  const formatDescriptionHtml = (description) => {
    const text = toText(description);
    if (!text) return '<p class="muted">Details coming soon.</p>';

    // Split into clean paragraphs and simple bullet blocks.
    const lines = text
      .replace(/\r/g, '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const blocks = [];
    let list = [];
    const flush = () => {
      if (!list.length) return;
      blocks.push(`<ul>${list.join('')}</ul>`);
      list = [];
    };

    lines.forEach((line) => {
      const isBullet = /^[-*•]\s+/.test(line);
      const clean = line.replace(/^[-*•]\s+/, '');
      if (isBullet) {
        list.push(`<li>${escapeHtml(clean)}</li>`);
        return;
      }
      // Short "KEY: value" lines also look good as bullets.
      if (/^[A-Za-z][^:]{1,40}:\s+/.test(line) && line.length < 120) {
        list.push(`<li>${escapeHtml(line)}</li>`);
        return;
      }
      flush();
      blocks.push(`<p>${escapeHtml(line)}</p>`);
    });
    flush();
    return blocks.join('');
  };

  const setWhiteLabel = (wl) => {
    document.body.classList.toggle('brochure-wl', wl);
    if (toggleBrandBtn) toggleBrandBtn.textContent = `White-label: ${wl ? 'On' : 'Off'}`;
    if (brandEl) brandEl.style.display = wl ? 'none' : 'flex';
    if (footEl) footEl.style.display = wl ? 'none' : 'block';
  };

  const updateUrlWl = (wl) => {
    const url = new URL(window.location.href);
    url.searchParams.set('wl', wl ? '1' : '0');
    window.history.replaceState({}, '', url.toString());
  };

  const init = () => {
    const url = new URL(window.location.href);
    const ref = toText(url.searchParams.get('ref')).trim();
    const wl = url.searchParams.get('wl') === '1';
    setWhiteLabel(wl);

    if (!ref) {
      if (refChip) refChip.textContent = 'Missing ref';
      if (descEl) descEl.innerHTML = '<p class="muted">Open this page with <code>?ref=SCP-XXXX</code>.</p>';
      return;
    }

    const base = Array.isArray(window.propertyData) ? window.propertyData : [];
    const custom = Array.isArray(window.customPropertyData) ? window.customPropertyData : [];
    const all = base.concat(custom);
    const match = all.find((p) => normalize(p && p.ref) === normalize(ref));

    if (!match) {
      if (refChip) refChip.textContent = ref;
      if (descEl) descEl.innerHTML = '<p class="muted">Listing not found.</p>';
      return;
    }

    const type = toText(match.type, 'Property');
    const town = toText(match.town, 'Costa Blanca South');
    const province = toText(match.province, 'Alicante');
    const beds = Number(match.beds) || 0;
    const baths = Number(match.baths) || 0;
    const built = builtAreaFor(match);
    const eurSqm = eurPerSqmFor(match);
    const price = formatListingPrice(match);
    const images = imageUrlsFor(match);

    const brochureLink = (() => {
      const u = new URL(window.location.href);
      u.searchParams.set('ref', ref);
      return u.toString();
    })();

    if (refChip) refChip.textContent = ref;
    if (refFoot) refFoot.textContent = ref;
    if (typeEl) typeEl.textContent = type;
    if (locationEl) locationEl.textContent = `${town}, ${province}`;
    if (priceEl) priceEl.textContent = price;

    if (heroImg) {
      if (images.length) {
        heroImg.src = images[0];
        heroImg.loading = 'eager';
        heroImg.decoding = 'async';
        heroImg.referrerPolicy = 'no-referrer';
      } else {
        heroImg.alt = 'No image available';
      }
    }

    if (statsEl) {
      const parts = [
        `🛏️ ${beds} beds`,
        `🛁 ${baths} baths`,
        `📐 ${built} m2`,
        eurSqm ? `📊 ${eurSqm}` : ''
      ].filter(Boolean);
      statsEl.innerHTML = parts.map((p) => `<div class="brochure-stat">${escapeHtml(p)}</div>`).join('');
    }

    if (highlightsEl) {
      const mode = listingModeFor(match);
      const op = mode === 'rent' ? 'For rent' : mode === 'traspaso' ? 'Traspaso' : 'For sale';
      const highlights = [
        `✅ Reference: ${ref}`,
        `✅ Operation: ${op}`,
        `✅ Location: ${town}`,
        built ? `✅ Built area: ${built} m2` : ''
      ].filter(Boolean);
      highlightsEl.innerHTML = highlights.map((h) => `<div class="brochure-highlight">${escapeHtml(h)}</div>`).join('');
    }

    if (descEl) {
      descEl.innerHTML = formatDescriptionHtml(match.description);
    }

    if (featuresEl) {
      const feats = Array.isArray(match.features) ? match.features : [];
      const safe = feats.map((f) => toText(f).trim()).filter(Boolean);
      const list = safe.length ? safe : ['Air conditioning', 'Modern finishes', 'Great location'];
      featuresEl.innerHTML = list.slice(0, 16).map((f) => `<li>${escapeHtml(f)}</li>`).join('');
    }

    if (galleryEl) {
      const thumbs = images.slice(0, 12);
      if (!thumbs.length) {
        galleryEl.innerHTML = '<div class="muted">No gallery images available.</div>';
      } else {
        galleryEl.innerHTML = thumbs
          .map((src, idx) => `<div class="brochure-gallery-item"><img src="${src}" alt="Image ${idx + 1}" loading="lazy" referrerpolicy="no-referrer"></div>`)
          .join('');
      }
    }

    if (emailLink) {
      const subject = encodeURIComponent(`Property brochure - ${ref}`);
      const body = encodeURIComponent(`Hello,\n\nHere is the brochure link:\n${brochureLink}\n\nReference: ${ref}\nPrice: ${price}\nLocation: ${town}, ${province}\n\n(You can also click Download PDF on the brochure page to save it as a PDF.)`);
      emailLink.href = `mailto:?subject=${subject}&body=${body}`;
    }

    if (toggleBrandBtn) {
      toggleBrandBtn.addEventListener('click', () => {
        const next = !document.body.classList.contains('brochure-wl');
        setWhiteLabel(next);
        updateUrlWl(next);
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(brochureLink);
          copyBtn.textContent = 'Copied';
          window.setTimeout(() => (copyBtn.textContent = 'Copy link'), 900);
        } catch {
          window.prompt('Copy link:', brochureLink);
        }
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        // Uses browser "Save as PDF" which preserves vector text and print CSS.
        window.print();
      });
    }
  };

  window.addEventListener('DOMContentLoaded', init);
})();

