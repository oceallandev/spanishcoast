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
  const areaEl = $('brochure-area');
  const descEl = $('brochure-description');
  const featuresEl = $('brochure-features');
  const galleryEl = $('brochure-gallery');
  const toggleBrandBtn = $('brochure-toggle-brand');
  const copyBtn = $('brochure-copy-link');
  const whatsappLink = $('brochure-whatsapp-link');
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

    // data.js defines `const propertyData = [...]` (global lexical binding), which is not on `window`.
    // custom-listings.js uses `window.customPropertyData`.
    const base = (() => {
      try {
        // Prefer explicit window binding if it exists.
        if (Array.isArray(window.propertyData)) return window.propertyData;
        // Fallback to global lexical binding.
        // eslint-disable-next-line no-undef
        if (typeof propertyData !== 'undefined' && Array.isArray(propertyData)) return propertyData;
      } catch {
        // ignore
      }
      return [];
    })();

    const custom = (() => {
      try {
        if (Array.isArray(window.customPropertyData)) return window.customPropertyData;
        // eslint-disable-next-line no-undef
        if (typeof customPropertyData !== 'undefined' && Array.isArray(customPropertyData)) return customPropertyData;
      } catch {
        // ignore
      }
      return [];
    })();
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

    // Helps browsers suggest a good PDF filename (varies by browser).
    try {
      document.title = `Brochure ${ref} - ${town}`;
    } catch {
      // ignore
    }

    const shareLink = () => {
      const u = new URL(window.location.href);
      u.searchParams.set('ref', ref);
      return u.toString();
    };

    const updateShareLinks = () => {
      const link = shareLink();

      if (emailLink) {
        const subject = encodeURIComponent(`Property brochure - ${ref}`);
        const body = encodeURIComponent(
          `Hello,\n\nHere is the brochure link:\n${link}\n\nReference: ${ref}\nPrice: ${price}\nLocation: ${town}, ${province}\n\n(You can also click Download PDF on the brochure page to save it as a PDF.)`
        );
        emailLink.href = `mailto:?subject=${subject}&body=${body}`;
      }

      if (whatsappLink) {
        const text = encodeURIComponent(
          `Property brochure: ${ref}\n${price}\n${town}, ${province}\n\n${link}`
        );
        whatsappLink.href = `https://wa.me/?text=${text}`;
      }
    };

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

    if (areaEl) {
      const pickAreaCopy = (t) => {
        const k = normalize(t);
        if (k.includes('torrevieja')) return 'Coastal city with beaches, a marina promenade, and a wide choice of shops and restaurants.';
        if (k.includes('guardamar')) return 'Known for long sandy beaches and the pine forest, with an easygoing coastal lifestyle.';
        if (k.includes('orihuela')) return 'Popular coastal area with beaches, golf options, and year-round services.';
        if (k.includes('quesada') || k.includes('ciudad quesada')) return 'Residential area with golf nearby and quick access to the coast and larger towns.';
        if (k.includes('pilar')) return 'Authentic Spanish town close to the coast, with beaches and everyday services nearby.';
        return 'Costa Blanca South lifestyle with year-round services, coastal atmosphere, and great connectivity across the area.';
      };

      const distanceKm = (lat1, lon1, lat2, lon2) => {
        const toRad = (v) => (v * Math.PI) / 180;
        const R = 6371;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
          * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const lat = Number(match && match.latitude);
      const lon = Number(match && match.longitude);
      const alc = { name: 'Alicante Airport (ALC)', lat: 38.2822, lon: -0.5582 };
      const approxAirport = (Number.isFinite(lat) && Number.isFinite(lon))
        ? Math.round(distanceKm(lat, lon, alc.lat, alc.lon))
        : 0;

      const formatKm = (km) => {
        const n = Number(km);
        if (!Number.isFinite(n) || n <= 0) return '';
        if (n < 1) return `${Math.round(n * 1000)} m`;
        if (n < 10) return `${n.toFixed(1)} km`;
        return `${Math.round(n)} km`;
      };

      const walkMins = (km) => {
        const n = Number(km);
        if (!Number.isFinite(n) || n <= 0) return '';
        // 4.8 km/h walking speed.
        const mins = Math.round((n / 4.8) * 60);
        if (mins < 3) return '';
        if (mins > 60) return '';
        return `${mins} min walk`;
      };

      const driveMins = (km) => {
        const n = Number(km);
        if (!Number.isFinite(n) || n <= 0) return '';
        // Very rough urban average; avoid showing for tiny distances.
        const mins = Math.round((n / 35) * 60);
        if (mins < 5) return '';
        if (mins > 90) return '';
        return `${mins} min drive`;
      };

      const nearbyCacheKey = (() => {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
        const latKey = (Math.round(lat * 1000) / 1000).toFixed(3);
        const lonKey = (Math.round(lon * 1000) / 1000).toFixed(3);
        return `scp:area:v2:${latKey},${lonKey}`;
      })();

      const readCache = () => {
        try {
          if (!nearbyCacheKey || !window.localStorage) return null;
          const raw = window.localStorage.getItem(nearbyCacheKey);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object') return null;
          // 7 days.
          if (!parsed.ts || (Date.now() - Number(parsed.ts)) > (7 * 24 * 60 * 60 * 1000)) return null;
          return parsed;
        } catch {
          return null;
        }
      };

      const writeCache = (payload) => {
        try {
          if (!nearbyCacheKey || !window.localStorage) return;
          window.localStorage.setItem(nearbyCacheKey, JSON.stringify({ ...payload, ts: Date.now() }));
        } catch {
          // ignore
        }
      };

      const haversineKm = (aLat, aLon, bLat, bLon) => {
        if (!Number.isFinite(aLat) || !Number.isFinite(aLon) || !Number.isFinite(bLat) || !Number.isFinite(bLon)) return NaN;
        return distanceKm(aLat, aLon, bLat, bLon);
      };

      const elCenter = (el) => {
        if (!el) return null;
        if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) return { lat: el.lat, lon: el.lon };
        if (el.center && Number.isFinite(el.center.lat) && Number.isFinite(el.center.lon)) return { lat: el.center.lat, lon: el.center.lon };
        return null;
      };

      const nearestOf = (elements, predicate) => {
        let best = null;
        let bestKm = Infinity;
        (elements || []).forEach((el) => {
          if (!predicate(el)) return;
          const c = elCenter(el);
          if (!c) return;
          const km = haversineKm(lat, lon, c.lat, c.lon);
          if (!Number.isFinite(km)) return;
          if (km < bestKm) {
            bestKm = km;
            best = el;
          }
        });
        return best ? { el: best, km: bestKm } : null;
      };

      const buildItems = (nearby) => {
        const base = [
          { icon: '📍', label: 'Area', value: `${town}, ${province}` },
          approxAirport ? { icon: '✈️', label: 'Airport (ALC)', value: `~${formatKm(approxAirport)} (${driveMins(approxAirport) || 'approx.'})` } : null
        ].filter(Boolean);

        const items = Array.isArray(nearby) ? nearby : [];
        base.push(...items);

        return base;
      };

      const render = (items, note) => {
        const lead = pickAreaCopy(town);
        const list = (items || []).map((it) => {
          const v = toText(it.value);
          const meta = toText(it.meta);
          return `
            <li class="brochure-area-item">
              <span class="brochure-area-ic" aria-hidden="true">${escapeHtml(it.icon || '•')}</span>
              <span class="brochure-area-txt">
                <span class="brochure-area-label">${escapeHtml(it.label || '')}</span>
                <span class="brochure-area-val">${escapeHtml(v)}</span>
                ${meta ? `<span class="brochure-area-meta">${escapeHtml(meta)}</span>` : ``}
              </span>
            </li>
          `;
        }).join('');

        areaEl.innerHTML = `
          <div class="brochure-area-lead">${escapeHtml(lead)}</div>
          <ul class="brochure-area-list">${list}</ul>
          <div class="brochure-area-footnote">${escapeHtml(note || 'Distances are approximate (straight-line). Sources: OpenStreetMap contributors.')}</div>
        `;
      };

      const fallbackItems = buildItems([
        { icon: '🛒', label: 'Shops', value: 'Nearby supermarkets and daily services (varies by exact street)' },
        { icon: '🏫', label: 'Schools', value: 'Local schools in the area (varies by exact street)' },
        { icon: '🌳', label: 'Parks', value: 'Green spaces and promenades nearby (varies by exact street)' }
      ]);

      // Initial render: immediate, then enhance with OSM if possible.
      render(fallbackItems, 'Loading nearby amenities…');

      const cached = readCache();
      if (cached && Array.isArray(cached.items)) {
        render(buildItems(cached.items), cached.note || 'Distances are approximate (straight-line). Sources: OpenStreetMap contributors.');
      }

      const fetchOsmNearby = async () => {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        if (!window.fetch) return null;

        // Overpass API: may be slow/unavailable. We keep this best-effort.
        const query = [
          '[out:json][timeout:20];',
          '(',
          `nwr(around:5000,${lat},${lon})["amenity"="school"];`,
          `nwr(around:3000,${lat},${lon})["leisure"="park"];`,
          `nwr(around:3000,${lat},${lon})["shop"="supermarket"];`,
          `nwr(around:3000,${lat},${lon})["amenity"="pharmacy"];`,
          `nwr(around:8000,${lat},${lon})["natural"="beach"];`,
          `nwr(around:2000,${lat},${lon})["highway"="bus_stop"];`,
          `nwr(around:15000,${lat},${lon})["leisure"="golf_course"];`,
          ');',
          'out center tags;'
        ].join('\n');

        const ctrl = window.AbortController ? new AbortController() : null;
        const t = window.setTimeout(() => { try { if (ctrl) ctrl.abort(); } catch { } }, 12000);
        try {
          const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body: `data=${encodeURIComponent(query)}`,
            signal: ctrl ? ctrl.signal : undefined
          });
          if (!res.ok) return null;
          const json = await res.json();
          const elements = json && Array.isArray(json.elements) ? json.elements : [];

          const school = nearestOf(elements, (el) => el.tags && el.tags.amenity === 'school');
          const park = nearestOf(elements, (el) => el.tags && el.tags.leisure === 'park');
          const supermarket = nearestOf(elements, (el) => el.tags && el.tags.shop === 'supermarket');
          const pharmacy = nearestOf(elements, (el) => el.tags && el.tags.amenity === 'pharmacy');
          const beach = nearestOf(elements, (el) => el.tags && (el.tags.natural === 'beach' || el.tags.place === 'beach'));
          const bus = nearestOf(elements, (el) => el.tags && el.tags.highway === 'bus_stop');
          const golf = nearestOf(elements, (el) => el.tags && el.tags.leisure === 'golf_course');

          const mk = (icon, label, hit) => {
            if (!hit) return null;
            const km = hit.km;
            const dist = formatKm(km);
            const meta = km <= 3 ? (walkMins(km) || '') : (driveMins(km) || '');
            const name = hit.el && hit.el.tags && hit.el.tags.name ? String(hit.el.tags.name) : '';
            return { icon, label, value: `~${dist}`, meta: name ? name : meta };
          };

          const items = [
            mk('🏖️', 'Beach', beach),
            mk('🛒', 'Supermarket', supermarket),
            mk('💊', 'Pharmacy', pharmacy),
            mk('🌳', 'Park', park),
            mk('🏫', 'School', school),
            mk('🚌', 'Bus stop', bus),
            mk('⛳', 'Golf', golf)
          ].filter(Boolean);

          return { items, note: 'Distances are approximate (straight-line). Data: OpenStreetMap contributors.' };
        } catch {
          return null;
        } finally {
          window.clearTimeout(t);
        }
      };

      // Fetch and enhance in the background.
      (async () => {
        const out = await fetchOsmNearby();
        if (!out || !Array.isArray(out.items) || !out.items.length) return;
        writeCache(out);
        render(buildItems(out.items), out.note);
      })();
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

    updateShareLinks();

    if (toggleBrandBtn) {
      toggleBrandBtn.addEventListener('click', () => {
        const next = !document.body.classList.contains('brochure-wl');
        setWhiteLabel(next);
        updateUrlWl(next);
        updateShareLinks();
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const link = shareLink();
        try {
          await navigator.clipboard.writeText(link);
          copyBtn.textContent = 'Copied';
          window.setTimeout(() => (copyBtn.textContent = 'Copy link'), 900);
        } catch {
          window.prompt('Copy link:', link);
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
