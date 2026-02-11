(() => {
  const $ = (id) => document.getElementById(id);

  const t = (key, fallback, vars) => {
    try {
      if (window.SCP_I18N && typeof window.SCP_I18N.t === 'function') {
        return window.SCP_I18N.t(key, vars);
      }
    } catch {
      // ignore
    }
    if (fallback !== undefined) return String(fallback);
    return String(key || '');
  };

  const els = {
    refChip: $('reel-ref'),
    ref: $('reel-ref'),
    title: $('reel-title'),
    meta: $('reel-meta'),
    status: $('reel-status'),
    controls: $('reel-controls'),
    duration: $('reel-duration'),
    audio: $('reel-audio'),
    captionOverlay: $('reel-caption-overlay'),
    canvas: $('reel-canvas'),
    overlay: $('reel-canvas-overlay'),
    previewSub: $('reel-preview-sub'),
    toggleBrand: $('reel-toggle-brand'),
    generate: $('reel-generate'),
    share: $('reel-share'),
    download: $('reel-download'),
    actions: $('reel-actions'),
    captionWrap: $('reel-caption-wrap'),
    caption: $('reel-caption'),
    copyCaption: $('reel-copy-caption'),
    captionsDownload: $('reel-captions-download'),
    playWrap: $('reel-play-wrap'),
    previewVideo: $('reel-preview-video'),
    shareInstagram: $('reel-share-instagram'),
    shareTiktok: $('reel-share-tiktok'),
    shareFacebook: $('reel-share-facebook')
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

  const normalize = (value) =>
    toText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const safeInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  };

  const escapeHtml = (value) =>
    toText(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const decodeHtmlEntities = (value) => {
    const parser = document.createElement('textarea');
    parser.innerHTML = toText(value);
    return parser.value;
  };

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
    if (Number.isFinite(built) && built > 0) return Math.trunc(built);
    const fallback = Number(property && (property.built_area || property.builtArea));
    return Number.isFinite(fallback) && fallback > 0 ? Math.trunc(fallback) : 0;
  };

  const imageUrlsFor = (property) => {
    const images = property && property.images;
    const candidates = [];
    if (Array.isArray(images)) {
      images.forEach((v) => candidates.push(v));
    } else if (typeof images === "string") {
      images
        .split(/[,\n]/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((v) => candidates.push(v));
    }
    if (property && property.image) candidates.push(property.image);
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

  const pickSlides = (urls, max) => {
    if (!Array.isArray(urls)) return [];
    return urls.filter(Boolean).slice(0, Math.max(0, max));
  };

  const proxyImageUrl = (rawUrl, { w = 1200, h = 2000, q = 82 } = {}) => {
    const u = toText(rawUrl).trim();
    if (!u) return '';
    if (u.startsWith('data:') || u.startsWith('blob:')) return u;
    try {
      const parsed = new URL(u, window.location.href);
      if (parsed.origin === window.location.origin) return parsed.toString();
    } catch {
      // ignore
    }
    // images.weserv.nl expects url without scheme for most hosts. Use URLSearchParams for safe encoding.
    const stripped = u.replace(/^https?:\/\//i, '');
    const params = new URLSearchParams();
    params.set('url', stripped);
    params.set('w', String(w));
    params.set('h', String(h));
    params.set('fit', 'cover');
    params.set('q', String(q));
    params.set('we', '1'); // enable "without enlargement" style behavior (keeps small images cleaner)
    return `https://images.weserv.nl/?${params.toString()}`;
  };

  const loadImage = (url, { timeoutMs = 12000 } = {}) =>
    new Promise((resolve) => {
      const src = toText(url).trim();
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      let done = false;

      const finish = (value) => {
        if (done) return;
        done = true;
        resolve(value);
      };

      const timer = window.setTimeout(() => finish(null), timeoutMs);
      img.onload = () => {
        window.clearTimeout(timer);
        finish(img);
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        finish(null);
      };
      img.src = src;
    });

  const drawRoundedRectPath = (ctx, x, y, w, h, r) => {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  const lerp = (a, b, t01) => a + (b - a) * t01;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const setStatus = (msg, { tone = 'normal' } = {}) => {
    if (!els.status) return;
    els.status.textContent = toText(msg);
    els.status.dataset.tone = tone;
  };

  const setWhiteLabel = (wl) => {
    document.body.classList.toggle('reel-wl', wl);
    if (els.toggleBrand) {
      els.toggleBrand.textContent = `${t('reel.white_label', 'White-label')}: ${wl ? t('reel.on', 'On') : t('reel.off', 'Off')}`;
    }
  };

  const updateUrlWl = (wl) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('wl', wl ? '1' : '0');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

  const createOptions = () => {
    const duration = Number(els.duration && els.duration.value);
    const durationSec = Number.isFinite(duration) && duration >= 6 && duration <= 30 ? Math.round(duration) : 9;
    const audioMode = normalize(els.audio && els.audio.value);
    const showOverlayCaptions = !els.captionOverlay || Boolean(els.captionOverlay.checked);
    return {
      durationSec,
      audioMode: audioMode || 'none',
      showOverlayCaptions
    };
  };

  const listingFacts = (listing) => {
    const type = toText((listing && (listing.businessType || listing.type)) || '', t('modal.type_default', 'Property'));
    const town = toText(listing && listing.town, 'Costa Blanca South');
    const province = toText(listing && listing.province, 'Alicante');
    const price = listing ? formatListingPrice(listing) : t('pricing.on_request', 'Price on request');
    const ref = toText(listing && listing.ref).trim();
    const beds = safeInt(listing && listing.beds);
    const baths = safeInt(listing && listing.baths);
    const built = builtAreaFor(listing);
    const specs = [
      beds > 0 ? `${beds} ${beds === 1 ? 'bed' : 'beds'}` : '',
      baths > 0 ? `${baths} ${baths === 1 ? 'bath' : 'baths'}` : '',
      built > 0 ? `${built} m2` : ''
    ].filter(Boolean).join(' • ');
    return { type, town, province, price, ref, specs };
  };

  const buildOverlayCaptionTimeline = (listing, totalDur, { whiteLabel } = {}) => {
    const { type, town, province, price, ref, specs } = listingFacts(listing);
    const lines = [
      `${type} • ${town}`,
      `${price} • ${province}`,
      specs || '',
      ref ? `Ref: ${ref}` : '',
      whiteLabel ? t('reel.caption.more_info', 'Ask for more details') : t('reel.caption.contact', 'Message us on WhatsApp')
    ].filter(Boolean);
    const maxLines = totalDur <= 8 ? 3 : totalDur <= 12 ? 4 : 5;
    const selected = lines.slice(0, maxLines);
    if (!selected.length) return [];
    const introPad = 0.35;
    const outroPad = 0.35;
    const usable = Math.max(1, totalDur - introPad - outroPad);
    const each = usable / selected.length;
    return selected.map((text, i) => {
      const start = introPad + each * i;
      const end = Math.min(totalDur - outroPad, start + each);
      return { text, start, end };
    });
  };

  const activeCaptionAt = (segments, tSec) => {
    if (!Array.isArray(segments) || !segments.length) return null;
    return segments.find((seg) => tSec >= seg.start && tSec <= seg.end) || null;
  };

  const drawStoryCaption = (ctx, canvas, segment, tSec) => {
    if (!segment || !segment.text) return;
    const W = canvas.width;
    const boxW = Math.min(W - 80, 620);
    const boxH = 74;
    const x = (W - boxW) / 2;
    const y = 120;
    const fadeIn = clamp01((tSec - segment.start) / 0.22);
    const fadeOut = clamp01((segment.end - tSec) / 0.22);
    const alpha = clamp01(Math.min(fadeIn, fadeOut));
    if (alpha <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = 0.92 * alpha;
    drawRoundedRectPath(ctx, x, y, boxW, boxH, 22);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.62)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
    ctx.font = '900 30px Outfit, system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(segment.text, x + boxW / 2, y + boxH / 2);
    ctx.restore();
  };

  const formatVttTime = (seconds) => {
    const totalMs = Math.max(0, Math.round(Number(seconds || 0) * 1000));
    const ms = totalMs % 1000;
    const totalSec = Math.floor(totalMs / 1000);
    const s = totalSec % 60;
    const totalMin = Math.floor(totalSec / 60);
    const m = totalMin % 60;
    const h = Math.floor(totalMin / 60);
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
  };

  const buildVttFromTimeline = (segments) => {
    const rows = ['WEBVTT', ''];
    (Array.isArray(segments) ? segments : []).forEach((seg, i) => {
      if (!seg || !seg.text) return;
      const start = formatVttTime(seg.start);
      const end = formatVttTime(seg.end);
      rows.push(String(i + 1));
      rows.push(`${start} --> ${end}`);
      rows.push(String(seg.text));
      rows.push('');
    });
    return rows.join('\n');
  };

  const scheduleTone = (ctx, output, {
    time = 0,
    duration = 0.35,
    frequency = 220,
    type = 'sine',
    gain = 0.045,
    attack = 0.016,
    release = 0.12
  } = {}) => {
    try {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(40, frequency), time);
      amp.gain.setValueAtTime(0.00001, time);
      amp.gain.linearRampToValueAtTime(gain, time + Math.max(0.001, attack));
      amp.gain.linearRampToValueAtTime(0.00001, time + Math.max(0.05, duration - release));
      osc.connect(amp);
      amp.connect(output);
      osc.start(time);
      osc.stop(time + duration);
    } catch {
      // ignore tone scheduling failures
    }
  };

  const startMusicBed = async ({ mode, durationSec }) => {
    if (mode === 'none') return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    let ctx;
    try {
      ctx = new Ctx();
    } catch {
      return null;
    }
    const output = ctx.createMediaStreamDestination();
    const master = ctx.createGain();
    master.gain.value = mode === 'upbeat' ? 0.95 : 0.78;
    master.connect(output);

    try {
      if (ctx.state === 'suspended') await ctx.resume();
    } catch {
      // ignore
    }

    const start = ctx.currentTime + 0.02;
    const end = start + Math.max(2, Number(durationSec) || 9);

    if (mode === 'ambient') {
      const progression = [196, 220, 247, 262, 247, 220];
      let tSec = start;
      let idx = 0;
      while (tSec < end - 0.2) {
        scheduleTone(ctx, master, {
          time: tSec,
          duration: 1.1,
          frequency: progression[idx % progression.length],
          type: 'sine',
          gain: 0.05,
          attack: 0.05,
          release: 0.24
        });
        scheduleTone(ctx, master, {
          time: tSec + 0.06,
          duration: 0.75,
          frequency: progression[idx % progression.length] * 2,
          type: 'triangle',
          gain: 0.022,
          attack: 0.03,
          release: 0.18
        });
        idx += 1;
        tSec += 0.96;
      }
    } else if (mode === 'upbeat') {
      const melody = [220, 247, 262, 294, 330, 294, 262, 247];
      let tSec = start;
      let step = 0;
      while (tSec < end - 0.15) {
        scheduleTone(ctx, master, {
          time: tSec,
          duration: 0.19,
          frequency: melody[step % melody.length],
          type: 'square',
          gain: 0.038,
          attack: 0.01,
          release: 0.08
        });
        if (step % 2 === 0) {
          scheduleTone(ctx, master, {
            time: tSec,
            duration: 0.3,
            frequency: melody[step % melody.length] / 2,
            type: 'triangle',
            gain: 0.018,
            attack: 0.01,
            release: 0.14
          });
        }
        step += 1;
        tSec += 0.32;
      }
    }

    const tracks = output.stream.getAudioTracks();
    return {
      track: tracks.length ? tracks[0] : null,
      async stop() {
        try {
          tracks.forEach((track) => track.stop());
        } catch {
          // ignore
        }
        try {
          await ctx.close();
        } catch {
          // ignore
        }
      }
    };
  };

  const baseListings = () => {
    try {
      if (Array.isArray(window.propertyData)) return window.propertyData;
      // eslint-disable-next-line no-undef
      if (typeof propertyData !== 'undefined' && Array.isArray(propertyData)) return propertyData;
    } catch {
      // ignore
    }
    return [];
  };

  const customListings = () => {
    try {
      if (Array.isArray(window.customPropertyData)) return window.customPropertyData;
      // eslint-disable-next-line no-undef
      if (typeof customPropertyData !== 'undefined' && Array.isArray(customPropertyData)) return customPropertyData;
    } catch {
      // ignore
    }
    return [];
  };

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

  const resolveListingByRef = async (ref) => {
    const refUpper = toText(ref).trim().toUpperCase();
    const refNorm = normalize(refUpper);
    if (!refUpper) return null;

    const all = baseListings().concat(customListings());
    const bizListings = Array.isArray(window.businessListings) ? window.businessListings : [];
    const businessMeta = bizListings.find((b) => normalize(b && b.ref) === refNorm) || null;

    const propertyMatch = all.find((p) => normalize(p && p.ref) === refNorm) || null;
    let match = propertyMatch ? mergeBusinessMeta(propertyMatch, businessMeta) : (businessMeta ? toPropertyLikeBusiness(businessMeta) : null);

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
          if (!error && data) match = mapDbPropertyListing(data);
        }
      } catch {
        // ignore
      }
    }
    return match;
  };

  const recorderMimeCandidates = () => {
    if (!window.MediaRecorder || typeof window.MediaRecorder.isTypeSupported !== 'function') return [''];
    const candidates = [
      'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    const out = [];
    candidates.forEach((c) => {
      try {
        if (window.MediaRecorder.isTypeSupported(c)) out.push(c);
      } catch {
        // ignore
      }
    });
    out.push('');
    return out;
  };

  const canShareFiles = (file) => {
    try {
      if (!navigator.share) return false;
      if (typeof navigator.canShare !== 'function') return false;
      return navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  };

  const downloadFileName = ({ ref, town, ext }) => {
    const safeTown = toText(town).replace(/[^\w\s-]+/g, '').trim().replace(/\s+/g, ' ');
    const safeRef = toText(ref).replace(/[^\w-]+/g, '').trim();
    const base = safeRef && safeTown ? `Reel ${safeRef} - ${safeTown}` : safeRef ? `Reel ${safeRef}` : 'Reel video';
    return `${base}.${ext}`;
  };

  const renderPreview = (ctx, canvas, img, { overlay, whiteLabel, listing } = {}) => {
    const W = canvas.width;
    const H = canvas.height;

    // Background.
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0b1220');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    if (img) {
      const iw = img.naturalWidth || img.width || 1;
      const ih = img.naturalHeight || img.height || 1;
      const s = Math.max(W / iw, H / ih);
      const dw = iw * s;
      const dh = ih * s;
      const x = (W - dw) / 2;
      const y = (H - dh) / 2;
      ctx.globalAlpha = 1;
      ctx.drawImage(img, x, y, dw, dh);
    }

    if (overlay) {
      overlay(ctx, canvas, { whiteLabel, listing });
    }
  };

  const drawOverlay = (ctx, canvas, { whiteLabel, listing, logo, showCta = false } = {}) => {
    const W = canvas.width;
    const H = canvas.height;
    const pad = 46;

    // Bottom fade.
    const fade = ctx.createLinearGradient(0, H * 0.54, 0, H);
    fade.addColorStop(0, 'rgba(0,0,0,0.00)');
    fade.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, H * 0.54, W, H * 0.46);

    const type = toText((listing && (listing.businessType || listing.type)) || '', t('modal.type_default', 'Property')).toUpperCase();
    const ref = toText(listing && listing.ref);
    const town = toText(listing && listing.town, 'Costa Blanca South');
    const province = toText(listing && listing.province, 'Alicante');
    const price = listing ? formatListingPrice(listing) : '';
    const beds = safeInt(listing && listing.beds);
    const baths = safeInt(listing && listing.baths);
    const built = builtAreaFor(listing);

    // Top brand row.
    if (!whiteLabel) {
      const topY = 30;
      const brandX = 28;
      const brandH = 54;
      const brandW = 350;
      ctx.save();
      ctx.globalAlpha = 0.86;
      drawRoundedRectPath(ctx, brandX, topY, brandW, brandH, 20);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
      ctx.fill();
      ctx.restore();

      if (logo) {
        const s = 40;
        ctx.save();
        ctx.globalAlpha = 0.96;
        ctx.drawImage(logo, brandX + 14, topY + (brandH - s) / 2, s, s);
        ctx.restore();
      }
      ctx.save();
      ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
      ctx.font = '800 26px Outfit, system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('Spanish Coast Properties', brandX + 14 + 46, topY + 20);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.96)';
      ctx.font = '700 18px Outfit, system-ui, -apple-system, Segoe UI, sans-serif';
      ctx.fillText('Costa Blanca South', brandX + 14 + 46, topY + 40);
      ctx.restore();
    }

    // Right ref chip.
    if (ref) {
      const chipY = 30;
      const chipH = 54;
      ctx.save();
      ctx.font = '900 22px Outfit, system-ui, -apple-system, Segoe UI, sans-serif';
      const textW = ctx.measureText(ref).width;
      const chipW = Math.min(W - 40, Math.max(140, textW + 44));
      const chipX = W - 28 - chipW;
      ctx.globalAlpha = 0.86;
      drawRoundedRectPath(ctx, chipX, chipY, chipW, chipH, 20);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
      ctx.textBaseline = 'middle';
      ctx.fillText(ref, chipX + 22, chipY + chipH / 2);
      ctx.restore();
    }

    // Bottom text block.
    const bottomY = H - pad - 240;
    ctx.save();
    ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
    ctx.font = '900 26px Outfit, system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(type, pad, bottomY);

    ctx.font = '900 46px Outfit, system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(125, 211, 252, 0.96)';
    const priceY = bottomY + 62;
    ctx.fillText(price, pad, priceY);

    ctx.font = '800 28px Outfit, system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillStyle = 'rgba(226, 232, 240, 0.94)';
    ctx.fillText(`${town}, ${province}`, pad, priceY + 40);

    // Stat chips.
    const chips = [];
    if (beds > 0) chips.push(`🛏 ${beds}`);
    if (baths > 0) chips.push(`🛁 ${baths}`);
    if (built > 0) chips.push(`📐 ${built} m2`);
    if (listing && (listingModeFor(listing) === 'traspaso' || listingModeFor(listing) === 'business') && beds === 0 && baths === 0) {
      chips.push(`🏷️ ${listingModeFor(listing) === 'traspaso' ? t('listing.traspaso', 'Traspaso') : t('listing.business_for_sale', 'Business for sale')}`);
    }

    let chipX = pad;
    const chipY = priceY + 64;
    ctx.font = '900 24px Outfit, system-ui, -apple-system, Segoe UI, sans-serif';
    chips.slice(0, 4).forEach((text) => {
      const w = ctx.measureText(text).width + 40;
      const h = 46;
      ctx.save();
      ctx.globalAlpha = 0.88;
      drawRoundedRectPath(ctx, chipX, chipY, w, h, 18);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(248, 250, 252, 0.96)';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, chipX + 20, chipY + h / 2);
      chipX += w + 14;
    });

    if (showCta && !whiteLabel) {
      ctx.fillStyle = 'rgba(226, 232, 240, 0.94)';
      ctx.font = '800 22px Outfit, system-ui, -apple-system, Segoe UI, sans-serif';
      const cta = `📞 +34 624 867 866   WhatsApp   spanishcoastproperties.com`;
      ctx.fillText(cta, pad, H - 62);
    }
    ctx.restore();
  };

  const buildMotion = (img, canvas) => {
    const W = canvas.width;
    const H = canvas.height;
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const baseScale = Math.max(W / iw, H / ih);

    const rand = () => Math.random();
    return {
      baseScale,
      z0: 1.03 + rand() * 0.03,
      z1: 1.10 + rand() * 0.06,
      fx0: rand(),
      fy0: rand(),
      fx1: rand(),
      fy1: rand()
    };
  };

  const drawKenBurns = (ctx, canvas, img, motion, p01) => {
    const W = canvas.width;
    const H = canvas.height;
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const z = lerp(motion.z0, motion.z1, p01);
    const scale = motion.baseScale * z;
    const dw = iw * scale;
    const dh = ih * scale;
    const overflowX = Math.max(0, dw - W);
    const overflowY = Math.max(0, dh - H);
    const fx = lerp(motion.fx0, motion.fx1, p01);
    const fy = lerp(motion.fy0, motion.fy1, p01);
    const x = -overflowX * fx;
    const y = -overflowY * fy;
    ctx.drawImage(img, x, y, dw, dh);
  };

  let currentObjectUrl = '';
  let currentCaptionsUrl = '';
  let lastVideoBlob = null;
  let lastVideoFile = null;
  let lastCaptionsBlob = null;
  let isBusy = false;

  const setBusy = (busy) => {
    isBusy = busy;
    if (els.generate) els.generate.disabled = busy;
    if (els.toggleBrand) els.toggleBrand.disabled = busy;
    if (els.duration) els.duration.disabled = busy;
    if (els.audio) els.audio.disabled = busy;
    if (els.captionOverlay) els.captionOverlay.disabled = busy;
  };

  const clearVideo = () => {
    lastVideoBlob = null;
    lastVideoFile = null;
    lastCaptionsBlob = null;
    if (currentObjectUrl) {
      try {
        URL.revokeObjectURL(currentObjectUrl);
      } catch {
        // ignore
      }
      currentObjectUrl = '';
    }
    if (currentCaptionsUrl) {
      try {
        URL.revokeObjectURL(currentCaptionsUrl);
      } catch {
        // ignore
      }
      currentCaptionsUrl = '';
    }
    if (els.download) {
      els.download.hidden = true;
      els.download.href = '#';
      els.download.removeAttribute('download');
    }
    if (els.captionsDownload) {
      els.captionsDownload.hidden = true;
      els.captionsDownload.href = '#';
      els.captionsDownload.removeAttribute('download');
    }
    if (els.previewVideo) {
      try {
        els.previewVideo.pause();
      } catch {
        // ignore
      }
      els.previewVideo.removeAttribute('src');
      els.previewVideo.load();
    }
    if (els.playWrap) els.playWrap.hidden = true;
    if (els.share) els.share.disabled = true;
    if (els.actions) els.actions.hidden = true;
    if (els.captionWrap) els.captionWrap.hidden = true;
  };

  const buildCaption = (listing, { whiteLabel } = {}) => {
    const ref = toText(listing && listing.ref);
    const type = toText((listing && (listing.businessType || listing.type)) || '', t('modal.type_default', 'Property'));
    const town = toText(listing && listing.town, 'Costa Blanca South');
    const province = toText(listing && listing.province, 'Alicante');
    const price = listing ? formatListingPrice(listing) : '';
    const url = (() => {
      const u = new URL('properties.html', window.location.href);
      if (ref) u.searchParams.set('ref', ref);
      return u.toString();
    })();

    const lines = [
      `${type} • ${town}, ${province}`,
      price ? `Price: ${price}` : '',
      ref ? `Ref: ${ref}` : '',
      '',
      url
    ].filter(Boolean);
    if (!whiteLabel) {
      lines.splice(3, 0, '📞 +34 624 867 866 (WhatsApp available)');
    }
    return lines.join('\n');
  };

  const createVideo = async ({
    listing,
    whiteLabel,
    durationSec: durationSecRaw,
    audioMode: audioModeRaw,
    showOverlayCaptions = true,
    autoPlayPreview = false
  } = {}) => {
    if (isBusy) return;
    if (!els.canvas) return;
    if (!listing) return;

    clearVideo();
    setBusy(true);
    setStatus(t('reel.status.prep', 'Preparing…'));
    if (els.overlay) els.overlay.style.display = 'none';

    // Fonts can arrive after DOMContentLoaded.
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
    } catch {
      // ignore
    }

    const ref = toText(listing.ref).trim();
    const town = toText(listing.town, 'Costa Blanca South');
    const durationSec = Number.isFinite(Number(durationSecRaw)) ? Math.max(6, Math.min(30, Number(durationSecRaw))) : 9;
    const audioMode = ['none', 'ambient', 'upbeat'].includes(normalize(audioModeRaw)) ? normalize(audioModeRaw) : 'none';

    const ctx = els.canvas.getContext('2d');
    if (!ctx) {
      setBusy(false);
      setStatus(t('reel.status.no_canvas', 'Your browser does not support this feature.'), { tone: 'bad' });
      return;
    }

    const logo = whiteLabel ? null : await loadImage('assets/scp-isotipo.png', { timeoutMs: 8000 });

    const rawUrls = imageUrlsFor(listing);
    const maxSlidesByDuration = Math.max(3, Math.min(10, Math.round(durationSec / 1.45) + 2));
    const slideUrls = pickSlides(rawUrls, maxSlidesByDuration).map((u) => proxyImageUrl(u, { w: 1200, h: 2000, q: 82 }));

    if (!slideUrls.length) {
      setStatus(t('reel.status.no_images', 'No images found for this listing.'), { tone: 'bad' });
      setBusy(false);
      return;
    }

    setStatus(t('reel.status.loading_images', 'Loading images…'));
    const images = [];
    for (let i = 0; i < slideUrls.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const img = await loadImage(slideUrls[i], { timeoutMs: 14000 });
      if (img) images.push(img);
      setStatus(t('reel.status.loaded_n', `Loaded ${images.length} images`, { n: images.length }));
      if (images.length >= maxSlidesByDuration) break;
    }

    if (!images.length) {
      setStatus(t('reel.status.images_failed', 'Images failed to load. Try again.'), { tone: 'bad' });
      setBusy(false);
      return;
    }

    const fps = 30;
    const introDur = durationSec <= 8 ? 0.9 : 1.2;
    const outroDur = durationSec <= 8 ? 0.9 : 1.1;
    const bodyDur = Math.max(2.4, durationSec - introDur - outroDur);
    const totalSlides = Math.max(2, Math.min(images.length, Math.round(bodyDur / 1.5)));
    const usedImages = images.slice(0, totalSlides);
    const slideDur = bodyDur / totalSlides;
    const fadeDur = 0.45;
    const motions = usedImages.map((img) => buildMotion(img, els.canvas));
    const totalDur = introDur + totalSlides * slideDur + outroDur;
    const captionSegments = showOverlayCaptions ? buildOverlayCaptionTimeline(listing, totalDur, { whiteLabel }) : [];
    const canvasStream = els.canvas.captureStream(fps);
    let audioSession = null;
    if (audioMode !== 'none') {
      // best-effort synthetic audio bed generated locally in-browser
      audioSession = await startMusicBed({ mode: audioMode, durationSec: totalDur });
    }
    const stream = audioSession && audioSession.track
      ? new MediaStream([...(canvasStream.getVideoTracks() || []), audioSession.track])
      : canvasStream;
    const mimeCandidates = recorderMimeCandidates();
    let mimeType = '';
    let ext = 'webm';

    setStatus(t('reel.status.recording', 'Recording…'));
    const chunks = [];
    let recorder;
    for (const candidate of mimeCandidates) {
      try {
        recorder = candidate
          ? new MediaRecorder(stream, { mimeType: candidate, bitsPerSecond: 4_500_000 })
          : new MediaRecorder(stream);
        mimeType = candidate || '';
        ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
        break;
      } catch {
        recorder = null;
      }
    }
    if (!recorder) {
      if (audioSession) {
        try {
          await audioSession.stop();
        } catch {
          // ignore
        }
      }
      setBusy(false);
      setStatus(t('reel.status.recorder_failed', 'Video export is not supported on this browser.'), { tone: 'bad' });
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e && e.data && e.data.size > 0) chunks.push(e.data);
    };

    const done = new Promise((resolve) => {
      recorder.onstop = () => resolve(true);
      recorder.onerror = () => resolve(false);
    });

    const startedAt = performance.now();
    recorder.start(250);

    const drawFrame = (tSec) => {
      const W = els.canvas.width;
      const H = els.canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Timeline:
      // 0..introDur -> intro (title card)
      // introDur..introDur+slides -> images
      // end.. -> outro
      const introEnd = introDur;
      const slidesEnd = introDur + totalSlides * slideDur;

      const drawTitleCard = (alpha = 1, { cta = false } = {}) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        // Subtle background.
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0b1220');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Decorative glow.
        ctx.save();
        ctx.globalAlpha = 0.55 * alpha;
        const g2 = ctx.createRadialGradient(W * 0.45, H * 0.35, 30, W * 0.45, H * 0.35, H * 0.9);
        g2.addColorStop(0, 'rgba(14,165,233,0.35)');
        g2.addColorStop(1, 'rgba(14,165,233,0.0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();

        drawOverlay(ctx, els.canvas, { whiteLabel, listing, logo, showCta: cta });
        ctx.restore();
      };

      const drawImageSlide = (idx, p01, alpha = 1) => {
        const img = usedImages[idx];
        const motion = motions[idx];
        ctx.save();
        ctx.globalAlpha = alpha;
        drawKenBurns(ctx, els.canvas, img, motion, p01);
        drawOverlay(ctx, els.canvas, { whiteLabel, listing, logo, showCta: false });
        ctx.restore();
      };

      if (tSec <= introEnd) {
        drawTitleCard(1, { cta: false });
        if (showOverlayCaptions) drawStoryCaption(ctx, els.canvas, activeCaptionAt(captionSegments, tSec), tSec);
        return;
      }

      if (tSec >= slidesEnd) {
        drawTitleCard(1, { cta: true });
        if (showOverlayCaptions) drawStoryCaption(ctx, els.canvas, activeCaptionAt(captionSegments, tSec), tSec);
        return;
      }

      const slideT = tSec - introDur;
      const idx = Math.floor(slideT / slideDur);
      const within = slideT - idx * slideDur;
      const p = clamp01(within / slideDur);

      const inFade = within >= (slideDur - fadeDur) && idx + 1 < totalSlides;
      if (!inFade) {
        drawImageSlide(idx, p, 1);
        if (showOverlayCaptions) drawStoryCaption(ctx, els.canvas, activeCaptionAt(captionSegments, tSec), tSec);
        return;
      }

      const fadeP = clamp01((within - (slideDur - fadeDur)) / fadeDur);
      // Current fades out.
      drawImageSlide(idx, p, 1 - fadeP);
      // Next fades in.
      drawImageSlide(idx + 1, 0, fadeP);
      if (showOverlayCaptions) drawStoryCaption(ctx, els.canvas, activeCaptionAt(captionSegments, tSec), tSec);
    };

    // Drive frames.
    await new Promise((resolve) => {
      const loop = () => {
        const elapsed = (performance.now() - startedAt) / 1000;
        drawFrame(Math.min(elapsed, totalDur));
        if (elapsed >= totalDur) return resolve(true);
        window.requestAnimationFrame(loop);
      };
      window.requestAnimationFrame(loop);
    });

    recorder.stop();
    const ok = await done;
    if (audioSession) {
      try {
        await audioSession.stop();
      } catch {
        // ignore
      }
    }
    try {
      (stream.getTracks() || []).forEach((track) => track.stop());
    } catch {
      // ignore
    }
    if (!ok) {
      setBusy(false);
      setStatus(t('reel.status.recorder_failed', 'Video export is not supported on this browser.'), { tone: 'bad' });
      return;
    }

    lastVideoBlob = new Blob(chunks, { type: mimeType || (chunks[0] && chunks[0].type) || 'video/webm' });
    lastVideoFile = new File([lastVideoBlob], downloadFileName({ ref, town, ext }), { type: lastVideoBlob.type });
    currentObjectUrl = URL.createObjectURL(lastVideoBlob);

    if (els.download) {
      els.download.hidden = false;
      els.download.href = currentObjectUrl;
      els.download.download = downloadFileName({ ref, town, ext });
      els.download.textContent = t('reel.download', 'Download');
    }

    if (captionSegments.length) {
      const vtt = buildVttFromTimeline(captionSegments);
      lastCaptionsBlob = new Blob([vtt], { type: 'text/vtt;charset=utf-8' });
      currentCaptionsUrl = URL.createObjectURL(lastCaptionsBlob);
      if (els.captionsDownload) {
        els.captionsDownload.hidden = false;
        els.captionsDownload.href = currentCaptionsUrl;
        els.captionsDownload.download = downloadFileName({ ref, town, ext: 'vtt' }).replace(/\.mp4$|\.webm$/i, '.vtt');
      }
    }

    if (els.share) els.share.disabled = false;
    if (els.actions) els.actions.hidden = false;
    if (els.captionWrap) els.captionWrap.hidden = false;
    if (els.playWrap) els.playWrap.hidden = false;
    if (els.previewVideo) {
      els.previewVideo.src = currentObjectUrl;
      try {
        els.previewVideo.muted = audioMode === 'none';
      } catch {
        // ignore
      }
      if (autoPlayPreview) {
        try {
          await els.previewVideo.play();
        } catch {
          // ignore autoplay restrictions
        }
      }
    }

    const captionText = buildCaption(listing, { whiteLabel });
    if (els.caption) els.caption.value = captionText;

    setBusy(false);
    const ready = audioMode === 'none'
      ? t('reel.status.ready', 'Video ready.')
      : t('reel.status.ready_with_audio', 'Video ready with audio.');
    setStatus(ready, { tone: 'good' });
  };

  const shareVideo = async ({ listing, whiteLabel, preferredApp } = {}) => {
    if (!lastVideoFile) {
      setStatus(t('reel.status.no_video', 'Create the video first.'), { tone: 'warn' });
      return;
    }
    const captionText = (els.caption && toText(els.caption.value)) || buildCaption(listing, { whiteLabel });

    if (navigator.share && canShareFiles(lastVideoFile)) {
      try {
        await navigator.share({
          files: [lastVideoFile],
          title: toText(listing && listing.ref, 'Spanish Coast Properties'),
          text: captionText
        });
        setStatus(t('reel.status.shared', 'Shared.'), { tone: 'good' });
        return;
      } catch {
        // Fall back.
      }
    }

    // Fallback: download + copy caption.
    if (els.download && !els.download.hidden) {
      els.download.click();
    }
    if (els.caption && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(captionText);
      } catch {
        // ignore
      }
    }
    const appHint = preferredApp ? ` ${preferredApp}` : '';
    setStatus(
      t('reel.status.fallback_shared', `Downloaded. Paste caption in${appHint}.`, { app: preferredApp || '' }),
      { tone: 'warn' }
    );
  };

  const init = async () => {
    const url = new URL(window.location.href);
    const ref = toText(url.searchParams.get('ref')).trim();
    const wl = url.searchParams.get('wl') === '1';
    const preferredApp = toText(url.searchParams.get('app')).trim();
    const autoPlayParam = normalize(url.searchParams.get('autoplay') || url.searchParams.get('auto'));
    const autoCreateAndPlay = autoPlayParam === '1' || autoPlayParam === 'true' || autoPlayParam === 'yes';
    const durationParam = Number(url.searchParams.get('dur'));
    const audioParam = normalize(url.searchParams.get('audio'));
    const captionsParam = normalize(url.searchParams.get('captions'));

    setWhiteLabel(wl);

    if (els.duration && Number.isFinite(durationParam)) {
      const d = Math.max(6, Math.min(30, Math.round(durationParam)));
      const match = Array.from(els.duration.options || []).find((opt) => Number(opt.value) === d);
      if (match) els.duration.value = String(d);
    }
    if (els.audio && ['none', 'ambient', 'upbeat'].includes(audioParam)) {
      els.audio.value = audioParam;
    }
    if (els.captionOverlay && (captionsParam === '0' || captionsParam === 'false' || captionsParam === 'no')) {
      els.captionOverlay.checked = false;
    }

    if (!ref) {
      if (els.refChip) els.refChip.textContent = t('reel.missing_ref', 'Missing ref');
      setStatus(t('reel.missing_ref_help', 'Open this page with ?ref=SCP-XXXX'), { tone: 'warn' });
      if (els.overlay) els.overlay.style.display = 'flex';
      return;
    }

    if (els.refChip) els.refChip.textContent = ref;

    setStatus(t('reel.status.loading_listing', 'Loading listing…'));
    const listing = await resolveListingByRef(ref);
    if (!listing) {
      setStatus(t('reel.listing_not_found', 'Listing not found.'), { tone: 'bad' });
      if (els.overlay) els.overlay.style.display = 'flex';
      return;
    }

    // Page title helps users save/share a useful filename.
    try {
      document.title = `Reel ${toText(listing.ref, ref)} - ${toText(listing.town, 'Costa Blanca South')}`;
    } catch {
      // ignore
    }

    const type = toText((listing.businessType || listing.type) || '', t('modal.type_default', 'Property'));
    const town = toText(listing.town, 'Costa Blanca South');
    const province = toText(listing.province, 'Alicante');
    const price = formatListingPrice(listing);
    const beds = safeInt(listing.beds);
    const baths = safeInt(listing.baths);
    const built = builtAreaFor(listing);

    if (els.title) els.title.textContent = `${type} · ${town}`;
    if (els.meta) {
      els.meta.innerHTML = `
        <div class="reel-meta-pills">
          <span class="reel-pill">${escapeHtml(price)}</span>
          <span class="reel-pill">${escapeHtml(`${town}, ${province}`)}</span>
          ${beds ? `<span class="reel-pill">🛏 ${beds}</span>` : ''}
          ${baths ? `<span class="reel-pill">🛁 ${baths}</span>` : ''}
          ${built ? `<span class="reel-pill">📐 ${built} m2</span>` : ''}
        </div>
      `;
    }

    const updatePreviewSub = () => {
      if (!els.previewSub) return;
      const opts = createOptions();
      const durationText = `${opts.durationSec}s`;
      const audioText = opts.audioMode === 'none'
        ? t('reel.audio.none', 'No music')
        : opts.audioMode === 'upbeat'
          ? t('reel.audio.upbeat', 'Upbeat')
          : t('reel.audio.ambient', 'Ambient');
      const captionsText = opts.showOverlayCaptions ? t('reel.caption.on', 'Captions on') : t('reel.caption.off', 'Captions off');
      els.previewSub.textContent = t(
        'reel.preview.subtitle_dynamic',
        `Creating a ${durationText} social video with ${audioText} and ${captionsText}.`,
        { duration: durationText, audio: audioText, captions: captionsText }
      );
    };

    if (els.previewSub) {
      updatePreviewSub();
    }

    // First-frame preview.
    if (els.canvas) {
      const ctx = els.canvas.getContext('2d');
      const urls = imageUrlsFor(listing);
      const hero = urls[0] ? proxyImageUrl(urls[0], { w: 1200, h: 2000, q: 80 }) : '';
      const heroImg = hero ? await loadImage(hero, { timeoutMs: 14000 }) : null;
      const logo = wl ? null : await loadImage('assets/scp-isotipo.png', { timeoutMs: 8000 });
      renderPreview(ctx, els.canvas, heroImg, {
        whiteLabel: wl,
        listing,
        overlay: (c, canv, { whiteLabel }) => drawOverlay(c, canv, { whiteLabel, listing, logo, showCta: false })
      });
    }

    if (els.overlay) els.overlay.style.display = 'none';
    setStatus(t('reel.status.ready_to_create', 'Ready. Tap “Create video”.'), { tone: 'good' });

    const onToggleBrand = () => {
      const next = !document.body.classList.contains('reel-wl');
      setWhiteLabel(next);
      updateUrlWl(next);
      clearVideo();
      // Re-render preview with/without logo.
      if (els.canvas) {
        const ctx = els.canvas.getContext('2d');
        const urls = imageUrlsFor(listing);
        const hero = urls[0] ? proxyImageUrl(urls[0], { w: 1200, h: 2000, q: 80 }) : '';
        (async () => {
          const heroImg = hero ? await loadImage(hero, { timeoutMs: 12000 }) : null;
          const logo = next ? null : await loadImage('assets/scp-isotipo.png', { timeoutMs: 8000 });
          renderPreview(ctx, els.canvas, heroImg, {
            whiteLabel: next,
            listing,
            overlay: (c, canv, { whiteLabel }) => drawOverlay(c, canv, { whiteLabel, listing, logo, showCta: false })
          });
        })();
      }
    };

    const triggerCreate = (autoPlayPreview = false) => {
      const opts = createOptions();
      return createVideo({
        listing,
        whiteLabel: document.body.classList.contains('reel-wl'),
        durationSec: opts.durationSec,
        audioMode: opts.audioMode,
        showOverlayCaptions: opts.showOverlayCaptions,
        autoPlayPreview
      });
    };

    if (els.toggleBrand) els.toggleBrand.addEventListener('click', onToggleBrand);
    if (els.generate) els.generate.addEventListener('click', () => triggerCreate(false));
    if (els.share) els.share.addEventListener('click', () => shareVideo({ listing, whiteLabel: document.body.classList.contains('reel-wl') }));
    if (els.duration) els.duration.addEventListener('change', updatePreviewSub);
    if (els.audio) els.audio.addEventListener('change', updatePreviewSub);
    if (els.captionOverlay) els.captionOverlay.addEventListener('change', updatePreviewSub);

    const appShare = (btn, appName) => {
      if (!btn) return;
      btn.addEventListener('click', () => shareVideo({ listing, whiteLabel: document.body.classList.contains('reel-wl'), preferredApp: appName }));
    };
    appShare(els.shareInstagram, 'Instagram');
    appShare(els.shareTiktok, 'TikTok');
    appShare(els.shareFacebook, 'Facebook');

    if (els.copyCaption) {
      els.copyCaption.addEventListener('click', async () => {
        const text = (els.caption && toText(els.caption.value)) || buildCaption(listing, { whiteLabel: document.body.classList.contains('reel-wl') });
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            setStatus(t('reel.status.caption_copied', 'Caption copied.'), { tone: 'good' });
          } else {
            window.prompt(t('reel.copy_prompt', 'Copy caption:'), text);
          }
        } catch {
          window.prompt(t('reel.copy_prompt', 'Copy caption:'), text);
        }
      });
    }

    // Preferred app hint.
    if (preferredApp) {
      setStatus(t('reel.status.preferred_app', `Tip: Generate, then Share and choose ${preferredApp}.`, { app: preferredApp }), { tone: 'normal' });
    }

    if (autoCreateAndPlay) {
      triggerCreate(true);
    }
  };

  init();
})();
