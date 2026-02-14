(() => {
  const $ = (id) => document.getElementById(id);
  const formatTemplate = (value, vars) => {
    const text = value == null ? '' : String(value);
    if (!vars || typeof vars !== 'object') return text;
    return text.replace(/\{(\w+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
    ));
  };

  const t = (key, fallback, vars) => {
    const k = String(key || '');
    try {
      if (window.SCP_I18N && typeof window.SCP_I18N.t === 'function') {
        const translated = window.SCP_I18N.t(k, vars);
        if (translated != null) {
          const out = String(translated);
          if (out && out !== k) return out;
        }
      }
    } catch {
      // ignore
    }
    if (fallback !== undefined) return formatTemplate(fallback, vars);
    return k;
  };

  const refChip = $('brochure-ref');
  const refFoot = $('brochure-ref-foot');
  const pageEl = $('brochure-page');
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

  let dynamicTranslateTimer = null;
  let dynamicTranslateBusy = false;
  const dynamicTranslateRoots = new Set();

  const flushDynamicTranslateQueue = async () => {
    if (dynamicTranslateBusy) return;
    dynamicTranslateBusy = true;
    if (dynamicTranslateTimer) {
      clearTimeout(dynamicTranslateTimer);
      dynamicTranslateTimer = null;
    }
    try {
      const i18n = window.SCP_I18N;
      if (!i18n || typeof i18n.translateDynamicDom !== 'function') return;
      const roots = Array.from(dynamicTranslateRoots);
      dynamicTranslateRoots.clear();
      for (let i = 0; i < roots.length; i += 1) {
        const root = roots[i];
        if (!root || !root.querySelectorAll) continue;
        if (root !== document && !document.contains(root)) continue;
        try {
          // eslint-disable-next-line no-await-in-loop
          await i18n.translateDynamicDom(root);
        } catch {
          // ignore
        }
      }
    } finally {
      dynamicTranslateBusy = false;
      if (dynamicTranslateRoots.size) {
        dynamicTranslateTimer = setTimeout(() => { flushDynamicTranslateQueue(); }, 50);
      }
    }
  };

  const queueDynamicTranslate = (root) => {
    const target = root && root.querySelectorAll ? root : document;
    dynamicTranslateRoots.add(target);
    if (dynamicTranslateTimer || dynamicTranslateBusy) return;
    dynamicTranslateTimer = setTimeout(() => { flushDynamicTranslateQueue(); }, 50);
  };

  const normalizeFeedText = (value) => {
    const raw = value === null || value === undefined ? '' : String(value);
    if (!raw) return raw;
    return raw
      .replace(/\[\s*amp\s*,?\s*\]/gi, '&')
      .replace(/&amp,/gi, '&')
      .replace(/&amp(?!;)/gi, '&');
  };

  const toText = (v, fallback = '') => {
    if (v === null || v === undefined) return fallback;
    const s = normalizeFeedText(v);
    return s.trim() ? s : fallback;
  };

  const normalizeLangCode = (raw) => {
    const v = toText(raw).trim().toLowerCase();
    if (!v) return 'en';
    return (v.split(/[-_]/)[0] || 'en').trim() || 'en';
  };

  const currentLangCode = () => {
    try {
      return normalizeLangCode(window.SCP_I18N && window.SCP_I18N.lang);
    } catch {
      return 'en';
    }
  };

  const localizedDescriptionFor = (listing) => {
    const lang = currentLangCode();
    try {
      const map = listing && listing.i18n && listing.i18n.description;
      if (map && typeof map === 'object') {
        const direct = toText(map[lang]).trim();
        if (direct) return { text: direct, localized: true };
      }
    } catch {
      // ignore
    }
    return { text: toText(listing && listing.description, ''), localized: false };
  };

  const descriptionNeedsEnglishTranslation = (text) => {
    const sourceText = toText(text).trim();
    if (!sourceText) return false;
    const lower = sourceText.toLowerCase();
    const looksEnglish = /\b(the|and|with|for|sale|rent|beach|apartment|villa|bath|bedroom|property|new build|commercial|garage|terrace)\b/i.test(lower);
    if (looksEnglish) return false;

    const looksSpanish = /[áéíóúñ¿¡]/i.test(sourceText)
      || /\b(de|la|el|con|para|venta|alquiler|playa|piso|apartamento|villa|bañ(?:o|os)|habitaci(?:o|ó)n(?:es)?|terraza|garaje|ascensor|obra nueva|trastero|piscina|dormitorio|dormitorios)\b/i.test(lower);
    const looksRomanian = /[ăâîșşțţ]/i.test(sourceText)
      || /\b(și|pentru|vânzare|vanzare|închiriere|inchiriere|apartament|terasă|terasa|garaj|mobilat)\b/i.test(lower);
    const looksSwedish = /[åäö]/i.test(sourceText)
      || /\b(och|för|till salu|uthyrning|lagenhet|lägenhet|bostad|terrass|hiss)\b/i.test(lower);

    return looksSpanish || looksRomanian || looksSwedish;
  };

  const translateDynamicText = (value) => {
    const text = toText(value).trim();
    if (!text) return Promise.resolve(text);
    try {
      const i18n = window.SCP_I18N;
      if (!i18n || typeof i18n.translateDynamicText !== 'function') {
        return Promise.resolve(text);
      }
      return i18n.translateDynamicText(text, {
        targetLang: i18n.lang || '',
        sourceLang: 'auto'
      }).then((translated) => toText(translated, text));
    } catch {
      return Promise.resolve(text);
    }
  };

  const escapeHtml = (value) =>
    toText(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const decodeHtmlEntities = (value) => {
    const parser = document.createElement('textarea');
    parser.innerHTML = toText(value);
    return parser.value;
  };

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
    const kind = normalize(property && property.kind);
    if (kind === 'traspaso' || kind === 'business') return kind;
    const text = normalize(property && property.description);
    if (text.includes('traspaso') || text.includes('being transferred') || text.includes('is transferred')) return 'traspaso';
    if (text.includes('for rent') || text.includes('monthly rent')) return 'rent';
    const salePrice = Number(property && property.price);
    if (Number.isFinite(salePrice) && salePrice > 0) return 'sale';
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
    if (!Number.isFinite(number) || number <= 0) return t('pricing.on_request', 'Price on request');
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(number);
  };

  const formatListingPrice = (property) => {
    const mode = listingModeFor(property);
    const number = listingPriceNumber(property);
    if (!Number.isFinite(number)) return t('pricing.on_request', 'Price on request');
    const formatted = formatPrice(number);
    if (mode === 'rent') {
      const period = rentPeriodFor(property);
      if (period === 'night') return t('pricing.per_night', `${formatted} / night`, { price: formatted });
      if (period === 'day') return t('pricing.per_day', `${formatted} / day`, { price: formatted });
      if (period === 'week') return t('pricing.per_week', `${formatted} / week`, { price: formatted });
      return t('pricing.per_month', `${formatted} / month`, { price: formatted });
    }
    if (mode === 'traspaso') return t('pricing.traspaso_suffix', `${formatted} (Traspaso)`, { price: formatted });
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
    const text = decodeHtmlEntities(description)
      .replace(/&#13;/g, '\n')
      .replace(/\r\n?/g, '\n')
      .trim();
    if (!text) return `<p class="muted">${escapeHtml(t('brochure.details_soon', 'Details coming soon.'))}</p>`;

    // Split into clean paragraphs and simple bullet blocks.
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // Some Kyero/RedSp feeds append a numeric supplier/account ID as a final line (e.g. "1073").
    while (lines.length > 0) {
      const last = lines[lines.length - 1];
      if (!/^\d{3,6}$/.test(last)) break;
      const n = Number(last);
      if (!Number.isFinite(n) || n >= 1900) break;
      lines.pop();
    }

    if (!lines.length) {
      return `<p class="muted">${escapeHtml(t('brochure.details_soon', 'Details coming soon.'))}</p>`;
    }

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
    if (toggleBrandBtn) {
      toggleBrandBtn.textContent = `${t('brochure.white_label', 'White-label')}: ${wl ? t('brochure.on', 'On') : t('brochure.off', 'Off')}`;
    }
    if (brandEl) brandEl.style.display = wl ? 'none' : 'flex';
    if (footEl) footEl.style.display = wl ? 'none' : 'block';
  };

  const updateUrlWl = (wl) => {
    const url = new URL(window.location.href);
    url.searchParams.set('wl', wl ? '1' : '0');
    window.history.replaceState({}, '', url.toString());
  };

  const init = async () => {
    if (pageEl) {
      pageEl.setAttribute('data-i18n-dynamic-scope', '');
    }
    const url = new URL(window.location.href);
    const ref = toText(url.searchParams.get('ref')).trim();
    const refUpper = ref.toUpperCase();
    const wl = url.searchParams.get('wl') === '1';
    setWhiteLabel(wl);

    if (!ref) {
      if (refChip) refChip.textContent = t('brochure.missing_ref', 'Missing ref');
      if (descEl) descEl.innerHTML = `<p class="muted">${t('brochure.missing_ref_help_html', 'Open this page with <code>?ref=SCP-XXXX</code>.')}</p>`;
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
    const normRef = normalize(ref);

    const bizListings = Array.isArray(window.businessListings) ? window.businessListings : [];
    const businessMeta = bizListings.find((b) => normalize(b && b.ref) === normRef) || null;

    const toPropertyLikeBusiness = (b) => {
      const kind = normalize(b && b.kind);
      const businessType = toText(b && (b.businessType || b.title || b.category), '');
      const price = Number(b && b.price);
      const lat = Number(b && (b.latitude ?? b.lat));
      const lon = Number(b && (b.longitude ?? b.lon));

      const obj = {
        id: toText(b && (b.id || b.ref || businessType || 'business')),
        ref: toText(b && b.ref),
        price: Number.isFinite(price) ? price : 0,
        currency: toText(b && b.currency, 'EUR'),
        type: businessType || 'Business',
        businessType: businessType || '',
        town: toText(b && (b.town || b.location), 'Costa Blanca South'),
        province: toText(b && b.province, 'Alicante'),
        beds: 0,
        baths: 0,
        description: toText(b && b.description, ''),
        images: b && b.image ? [toText(b.image)] : [],
        features: [
          businessType ? `Sector: ${businessType}` : '',
          kind === 'traspaso' ? 'Deal: Traspaso' : kind === 'business' ? 'Deal: Business for sale' : ''
        ].filter(Boolean),
        kind: kind || '',
        listing_mode: kind === 'traspaso' || kind === 'business' ? kind : ''
      };

      if (Number.isFinite(lat)) obj.latitude = lat;
      if (Number.isFinite(lon)) obj.longitude = lon;
      return obj;
    };

    const mergeBusinessMeta = (property, meta) => {
      if (!property || !meta) return property;
      const out = { ...property };

      const bizType = toText(meta && (meta.businessType || meta.title || meta.category), '');
      if (bizType) out.businessType = bizType;

      const kind = normalize(meta && meta.kind);
      if (kind === 'traspaso' || kind === 'business') {
        out.kind = kind;
        out.listing_mode = kind;
      }

      if (!toText(out.description) && toText(meta.description)) out.description = toText(meta.description);
      if (!toText(out.town) && toText(meta.town)) out.town = toText(meta.town);
      if (!toText(out.province) && toText(meta.province)) out.province = toText(meta.province);

      const outPrice = Number(out.price);
      const metaPrice = Number(meta.price);
      if ((!Number.isFinite(outPrice) || outPrice <= 0) && Number.isFinite(metaPrice) && metaPrice > 0) out.price = metaPrice;

      const outLat = Number(out.latitude);
      const outLon = Number(out.longitude);
      const metaLat = Number(meta.latitude ?? meta.lat);
      const metaLon = Number(meta.longitude ?? meta.lon);
      if (!Number.isFinite(outLat) && Number.isFinite(metaLat)) out.latitude = metaLat;
      if (!Number.isFinite(outLon) && Number.isFinite(metaLon)) out.longitude = metaLon;

      const hasImages = Array.isArray(out.images) && out.images.length;
      if (!hasImages && meta.image) out.images = [toText(meta.image)];
      return out;
    };

    const propertyMatch = all.find((p) => normalize(p && p.ref) === normRef) || null;
    let match = propertyMatch ? mergeBusinessMeta(propertyMatch, businessMeta) : (businessMeta ? toPropertyLikeBusiness(businessMeta) : null);

    const mapDbPropertyListing = (r) => {
      if (!r) return null;
      const images = Array.isArray(r.images) ? r.images : [];
      const features = Array.isArray(r.features) ? r.features : [];
      const built = Number(r.built_area);
      const plot = Number(r.plot_area);
      return {
        id: toText(r.id),
        ref: toText(r.ref),
        price: Number.isFinite(Number(r.price)) ? Number(r.price) : 0,
        currency: toText(r.currency, 'EUR'),
        type: toText(r.type, 'Property'),
        town: toText(r.town, 'Costa Blanca South'),
        province: toText(r.province, 'Alicante'),
        beds: Number.isFinite(Number(r.beds)) ? Math.trunc(Number(r.beds)) : 0,
        baths: Number.isFinite(Number(r.baths)) ? Math.trunc(Number(r.baths)) : 0,
        surface_area: { built: Number.isFinite(built) ? Math.trunc(built) : 0, plot: Number.isFinite(plot) ? Math.trunc(plot) : 0 },
        latitude: Number.isFinite(Number(r.latitude)) ? Number(r.latitude) : null,
        longitude: Number.isFinite(Number(r.longitude)) ? Number(r.longitude) : null,
        description: toText(r.description, ''),
        features,
        images
      };
    };

    if (!match) {
      // Approved owner-submitted listings live in Supabase; fetch by ref when not found in local feeds.
      try {
        const client = window.scpSupabase || null;
        if (client) {
          const { data, error } = await client
            .from('property_listings')
            .select('id,ref,type,town,province,price,currency,beds,baths,built_area,plot_area,latitude,longitude,images,features,description')
            .eq('published', true)
            .eq('ref', refUpper)
            .maybeSingle();
          if (!error && data) {
            match = mapDbPropertyListing(data);
          }
        }
      } catch {
        // ignore
      }
    }

    if (!match) {
      if (refChip) refChip.textContent = ref;
      if (descEl) descEl.innerHTML = `<p class="muted">${escapeHtml(t('brochure.listing_not_found', 'Listing not found.'))}</p>`;
      return;
    }

    const type = toText(match.businessType || match.type, t('brochure.type_default', 'Listing'));
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
        const subject = encodeURIComponent(`Brochure - ${ref}`);
        const body = encodeURIComponent(
          `Hello,\n\nHere is the brochure link:\n${link}\n\nReference: ${ref}\nType: ${type}\nPrice: ${price}\nLocation: ${town}, ${province}\n\n(You can click Print to PDF on the brochure page to save it as a PDF.)`
        );
        emailLink.href = `mailto:?subject=${subject}&body=${body}`;
      }

      if (whatsappLink) {
        const text = encodeURIComponent(
          `Brochure: ${ref}\n${type}\n${price}\n${town}, ${province}\n\n${link}`
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
        heroImg.alt = t('brochure.no_image', 'No image available');
      }
    }

    if (statsEl) {
      const mode = listingModeFor(match);
      const parts = [
        beds > 0 ? `🛏️ ${t('brochure.stat.beds', `${beds} beds`, { n: beds })}` : '',
        baths > 0 ? `🛁 ${t('brochure.stat.baths', `${baths} baths`, { n: baths })}` : '',
        built > 0 ? `📐 ${t('brochure.stat.built', `${built} m2`, { n: built })}` : '',
        eurSqm ? `📊 ${eurSqm}` : '',
        beds === 0 && baths === 0 && mode === 'traspaso' ? `🏷️ ${t('listing.traspaso', 'Traspaso')}` : '',
        beds === 0 && baths === 0 && mode === 'business' ? `🏷️ ${t('listing.business_for_sale', 'Business for sale')}` : ''
      ].filter(Boolean);
      statsEl.innerHTML = parts.map((p) => `<div class="brochure-stat">${escapeHtml(p)}</div>`).join('');
    }

    if (highlightsEl) {
      const mode = listingModeFor(match);
      const op = mode === 'rent'
        ? t('listing.for_rent', 'For Rent')
        : mode === 'traspaso'
          ? t('listing.traspaso', 'Traspaso')
          : mode === 'business'
            ? t('listing.business_for_sale', 'Business for sale')
            : t('listing.for_sale', 'For Sale');
      const highlights = [
        `✅ ${t('brochure.highlight.reference', 'Reference')}: ${ref}`,
        `✅ ${t('brochure.highlight.operation', 'Operation')}: ${op}`,
        `✅ ${t('brochure.highlight.location', 'Location')}: ${town}`,
        built ? `✅ ${t('brochure.highlight.built_area', 'Built area')}: ${built} m2` : ''
      ].filter(Boolean);
      highlightsEl.innerHTML = highlights.map((h) => `<div class="brochure-highlight">${escapeHtml(h)}</div>`).join('');
    }

    if (areaEl) {
      const pickAreaCopy = (townName) => {
        const k = normalize(townName);
        if (k.includes('torrevieja')) return t('nearby.copy.torrevieja', 'Coastal city with beaches, a marina promenade, and a wide choice of shops and restaurants.');
        if (k.includes('guardamar')) return t('nearby.copy.guardamar', 'Known for long sandy beaches and the pine forest, with an easygoing coastal lifestyle.');
        if (k.includes('orihuela')) return t('nearby.copy.orihuela', 'Popular coastal area with beaches, golf options, and year-round services.');
        if (k.includes('quesada') || k.includes('ciudad quesada')) return t('nearby.copy.quesada', 'Residential area with golf nearby and quick access to the coast and larger towns.');
        if (k.includes('pilar')) return t('nearby.copy.pilar', 'Authentic Spanish town close to the coast, with beaches and everyday services nearby.');
        return t('nearby.copy.default', 'Costa Blanca South lifestyle with year-round services, coastal atmosphere, and great connectivity across the area.');
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
        return t('nearby.min_walk', `${mins} min walk`, { mins });
      };

      const driveMins = (km) => {
        const n = Number(km);
        if (!Number.isFinite(n) || n <= 0) return '';
        // Very rough urban average; avoid showing for tiny distances.
        const mins = Math.round((n / 35) * 60);
        if (mins < 5) return '';
        if (mins > 90) return '';
        return t('nearby.min_drive', `${mins} min drive`, { mins });
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
          { icon: '📍', label: t('nearby.area', 'Area'), value: `${town}, ${province}` },
          approxAirport ? { icon: '✈️', label: t('nearby.airport', 'Airport (ALC)'), value: `~${formatKm(approxAirport)} (${driveMins(approxAirport) || t('nearby.approx', 'approx.')})` } : null
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
          <div class="brochure-area-footnote">${escapeHtml(note || t('nearby.note', 'Distances are approximate (straight-line). Data: OpenStreetMap contributors.'))}</div>
        `;
        areaEl.setAttribute('data-i18n-dynamic-scope', '');
        queueDynamicTranslate(areaEl);
      };

      const fallbackItems = buildItems([
        { icon: '🛒', label: t('nearby.shops', 'Shops'), value: t('nearby.fallback_shops', 'Nearby supermarkets and daily services (varies by exact street)') },
        { icon: '🏫', label: t('nearby.schools', 'Schools'), value: t('nearby.fallback_schools', 'Local schools in the area (varies by exact street)') },
        { icon: '🌳', label: t('nearby.parks', 'Parks'), value: t('nearby.fallback_parks', 'Green spaces and promenades nearby (varies by exact street)') }
      ]);

      // Initial render: immediate, then enhance with OSM if possible.
      render(fallbackItems, t('nearby.loading', 'Loading nearby amenities…'));

      const cached = readCache();
      if (cached && Array.isArray(cached.items)) {
        render(buildItems(cached.items), cached.note || t('nearby.note', 'Distances are approximate (straight-line). Data: OpenStreetMap contributors.'));
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
        const timeoutId = window.setTimeout(() => { try { if (ctrl) ctrl.abort(); } catch { } }, 12000);
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
            mk('🏖️', t('nearby.beach', 'Beach'), beach),
            mk('🛒', t('nearby.supermarket', 'Supermarket'), supermarket),
            mk('💊', t('nearby.pharmacy', 'Pharmacy'), pharmacy),
            mk('🌳', t('nearby.park', 'Park'), park),
            mk('🏫', t('nearby.school', 'School'), school),
            mk('🚌', t('nearby.bus', 'Bus stop'), bus),
            mk('⛳', t('nearby.golf', 'Golf'), golf)
          ].filter(Boolean);

          return { items, note: t('nearby.note', 'Distances are approximate (straight-line). Data: OpenStreetMap contributors.') };
        } catch {
          return null;
        } finally {
          window.clearTimeout(timeoutId);
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
      const lang = currentLangCode();
      const descInfo = localizedDescriptionFor(match);
      const baseDescription = toText(descInfo.text, '');
      descEl.innerHTML = formatDescriptionHtml(baseDescription);
      descEl.setAttribute('data-i18n-dynamic-scope', '');

      if (descInfo.localized) {
        // Exact feed language version (RedSp v4) — keep it as-is.
        descEl.setAttribute('data-i18n-dynamic-ignore', '');
      } else if (baseDescription && (lang !== 'en' || descriptionNeedsEnglishTranslation(baseDescription))) {
        // Translate whole description string for consistency (fallback to per-node translation).
        descEl.setAttribute('data-i18n-dynamic-ignore', '');
        translateDynamicText(baseDescription).then((translated) => {
          if (!translated || translated === baseDescription) {
            descEl.removeAttribute('data-i18n-dynamic-ignore');
            queueDynamicTranslate(descEl);
            return;
          }
          descEl.innerHTML = formatDescriptionHtml(translated);
        });
      } else {
        descEl.removeAttribute('data-i18n-dynamic-ignore');
        queueDynamicTranslate(descEl);
      }
    }

    if (featuresEl) {
      const feats = Array.isArray(match.features) ? match.features : [];
      const safe = feats.map((f) => toText(f).trim()).filter(Boolean);
      const mode = listingModeFor(match);
      const fallback = (beds === 0 && baths === 0 && (mode === 'traspaso' || mode === 'business' || normalize(type).includes('commercial')))
        ? [
          'Key deal points (inventory, fixtures, licenses)',
          'Lease terms / rent review (if applicable)',
          'Handover plan and training period (if offered)',
          'Business due diligence checklist (recommended)',
          'Local services and foot traffic vary by exact street'
        ]
        : ['Air conditioning', 'Modern finishes', 'Great location'];

      const list = safe.length ? safe : fallback;
      featuresEl.innerHTML = list.slice(0, 18).map((f) => `<li>${escapeHtml(f)}</li>`).join('');
      featuresEl.setAttribute('data-i18n-dynamic-scope', '');
      queueDynamicTranslate(featuresEl);
    }

    if (galleryEl) {
      const thumbs = images.slice(0, 12);
      if (!thumbs.length) {
        galleryEl.innerHTML = `<div class="muted">${escapeHtml(t('brochure.no_gallery_images', 'No gallery images available.'))}</div>`;
      } else {
        galleryEl.innerHTML = thumbs
          .map((src, idx) => `<div class="brochure-gallery-item"><img src="${src}" alt="Image ${idx + 1}" loading="lazy" referrerpolicy="no-referrer"></div>`)
          .join('');
      }
      galleryEl.setAttribute('data-i18n-dynamic-scope', '');
      queueDynamicTranslate(galleryEl);
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
          copyBtn.textContent = t('brochure.copied', 'Copied');
          window.setTimeout(() => (copyBtn.textContent = t('brochure.copy_link', 'Copy link')), 900);
        } catch {
          window.prompt(t('modal.share.copy_prompt', 'Copy link:'), link);
        }
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        // Uses browser "Save as PDF" which preserves vector text and print CSS.
        window.print();
      });
    }

    if (pageEl) {
      queueDynamicTranslate(pageEl);
    }
  };

  window.addEventListener('scp:i18n-updated', () => {
    if (pageEl) queueDynamicTranslate(pageEl);
  });

  window.addEventListener('DOMContentLoaded', init);
})();
