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

  const els = {
    refChip: $('reel-ref'),
    ref: $('reel-ref'),
    title: $('reel-title'),
    meta: $('reel-meta'),
    status: $('reel-status'),
    canvas: $('reel-canvas'),
    overlay: $('reel-canvas-overlay'),
    previewSub: $('reel-preview-sub'),
    toggleBrand: $('reel-toggle-brand'),
    play: $('reel-play'),
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
    shareFacebook: $('reel-share-facebook'),
    shareWhatsapp: $('reel-share-whatsapp'),
    shareTelegram: $('reel-share-telegram'),
    shareLinkedin: $('reel-share-linkedin')
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

  const isLoopbackHost = (hostname) => {
    const host = toText(hostname).trim().toLowerCase();
    if (!host) return false;
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
    return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  };

  const ensureTrailingSlash = (value) => {
    const text = toText(value).trim();
    if (!text) return '';
    return text.endsWith('/') ? text : `${text}/`;
  };

  const configuredSiteBase = () => {
    try {
      const raw = toText(window.SCP_CONFIG && window.SCP_CONFIG.siteUrl).trim();
      if (!raw) return '';
      const parsed = new URL(raw, window.location.href);
      const path = parsed.pathname || '/';
      const basePath = /\/[^/]+\.[a-z0-9]+$/i.test(path)
        ? path.replace(/\/[^/]+\.[a-z0-9]+$/i, '/')
        : ensureTrailingSlash(path);
      return `${parsed.origin}${basePath}`;
    } catch {
      return '';
    }
  };

  const canonicalSiteBase = () => {
    try {
      const canonical = document.querySelector('link[rel="canonical"][href]');
      if (!canonical) return '';
      const href = toText(canonical.getAttribute('href')).trim();
      if (!href) return '';
      const parsed = new URL(href, window.location.href);
      const path = parsed.pathname || '/';
      const basePath = /\/[^/]+\.[a-z0-9]+$/i.test(path)
        ? path.replace(/\/[^/]+\.[a-z0-9]+$/i, '/')
        : ensureTrailingSlash(path);
      return `${parsed.origin}${basePath}`;
    } catch {
      return '';
    }
  };

  const publicSiteBase = (() => {
    const configured = configuredSiteBase();
    if (configured) return configured;
    try {
      const isLoopback = window.location.protocol === 'file:' || isLoopbackHost(window.location.hostname);
      if (!isLoopback) return '';
    } catch {
      return '';
    }
    return canonicalSiteBase();
  })();

  const buildAppUrl = (path, params = {}) => {
    const cleanPath = toText(path).replace(/^\.?\//, '');
    const base = publicSiteBase || window.location.href;
    const url = new URL(cleanPath, base);
    Object.entries(params || {}).forEach(([key, rawValue]) => {
      const value = rawValue == null ? '' : String(rawValue).trim();
      if (!value) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    });
    return url.toString();
  };

  const REEL_AUDIO_MODES = [
    'none',
    'ambient',
    'upbeat',
    'chill',
    'cinematic',
    'tropical',
    'house',
    'lofi',
    'piano',
    'sunset',
    'corporate'
  ];
  const REEL_AUDIO_MODE_SET = new Set(REEL_AUDIO_MODES);
  const REEL_AUDIO_LABEL_FALLBACK = {
    none: 'No music',
    ambient: 'Ambient',
    upbeat: 'Upbeat',
    chill: 'Chill',
    cinematic: 'Cinematic',
    tropical: 'Tropical',
    house: 'House',
    lofi: 'Lo-fi',
    piano: 'Piano',
    sunset: 'Sunset',
    corporate: 'Corporate'
  };
  const normalizeAudioMode = (value, fallback = 'none') => {
    const mode = normalize(value);
    if (REEL_AUDIO_MODE_SET.has(mode)) return mode;
    return fallback;
  };

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

  const imageLoadCandidates = (rawUrl, opts = {}) => {
    const direct = toText(rawUrl).trim();
    if (!direct) return [];
    const httpsDirect = direct.startsWith('http://') ? `https://${direct.slice('http://'.length)}` : direct;
    const proxy = proxyImageUrl(httpsDirect, opts);
    const out = [];
    if (proxy) out.push(proxy);
    if (httpsDirect && !out.includes(httpsDirect)) out.push(httpsDirect);
    return out;
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

  const loadListingImage = async (rawUrl, opts = {}) => {
    const candidates = imageLoadCandidates(rawUrl, opts);
    for (let i = 0; i < candidates.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const img = await loadImage(candidates[i], { timeoutMs: opts.timeoutMs || 12000 });
      if (img) return img;
    }
    return null;
  };

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

  const estimateDurationForListing = (listing, durationOverride = NaN) => {
    if (Number.isFinite(Number(durationOverride))) {
      return Math.max(6, Math.min(30, Math.round(Number(durationOverride))));
    }
    const imageCount = imageUrlsFor(listing).length;
    if (imageCount >= 14) return 12;
    if (imageCount >= 9) return 11;
    if (imageCount >= 6) return 10;
    return 9;
  };

  const suggestAudioForListing = (listing, audioOverride = '') => {
    const forced = normalizeAudioMode(audioOverride, '');
    if (forced) return forced;
    const type = normalize((listing && (listing.businessType || listing.type)) || '');
    const mode = listingModeFor(listing);
    const tags = `${normalize(listing && listing.description)} ${normalize(Array.isArray(listing && listing.features) ? listing.features.join(' ') : '')}`;
    if (type.includes('business') || mode === 'business' || mode === 'traspaso') return 'corporate';
    if (type.includes('villa') || type.includes('luxury') || tags.includes('sea view')) return 'cinematic';
    if (mode === 'rent' || type.includes('apartment')) return 'chill';
    return 'ambient';
  };

  const createOptions = ({ listing = null, durationOverride = NaN, audioOverride = '', captionsOverride = '' } = {}) => {
    const durationSec = estimateDurationForListing(listing, durationOverride);
    const audioMode = suggestAudioForListing(listing, audioOverride);
    const captionsParam = normalize(captionsOverride);
    const showOverlayCaptions = !(captionsParam === '0' || captionsParam === 'false' || captionsParam === 'no');
    return { durationSec, audioMode, showOverlayCaptions };
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
      beds > 0 ? `${beds} ${beds === 1 ? t('reel.spec.bed', 'bed') : t('reel.spec.beds', 'beds')}` : '',
      baths > 0 ? `${baths} ${baths === 1 ? t('reel.spec.bath', 'bath') : t('reel.spec.baths', 'baths')}` : '',
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

  const scheduleChord = (ctx, output, {
    time = 0,
    duration = 0.8,
    root = 220,
    intervals = [1, 1.25, 1.5],
    type = 'sine',
    gain = 0.03,
    attack = 0.02,
    release = 0.16
  } = {}) => {
    const steps = Array.isArray(intervals) && intervals.length ? intervals : [1];
    steps.forEach((ratio, idx) => {
      const mult = Number(ratio);
      if (!Number.isFinite(mult) || mult <= 0) return;
      scheduleTone(ctx, output, {
        time,
        duration,
        frequency: root * mult,
        type,
        gain: gain / (idx === 0 ? 1 : 1.7 + idx * 0.2),
        attack,
        release
      });
    });
  };

  const primeMusicContext = async () => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    let ctx = null;
    try {
      ctx = new Ctx();
    } catch {
      return null;
    }
    try {
      if (ctx.state === 'suspended') await ctx.resume();
    } catch {
      // ignore
    }
    if (ctx.state !== 'running') {
      try {
        await ctx.close();
      } catch {
        // ignore
      }
      return null;
    }
    return ctx;
  };

  const startMusicBed = async ({ mode, durationSec, audioContext = null }) => {
    if (mode === 'none') return null;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;

    let ctx;
    if (audioContext) {
      ctx = audioContext;
    } else {
      try {
        ctx = new Ctx();
      } catch {
        return null;
      }
    }

    try {
      if (ctx.state === 'suspended') await ctx.resume();
    } catch {
      // ignore
    }
    if (ctx.state !== 'running') {
      try {
        await ctx.close();
      } catch {
        // ignore
      }
      return null;
    }

    const output = ctx.createMediaStreamDestination();
    const master = ctx.createGain();
    const masterGainByMode = {
      ambient: 0.82,
      upbeat: 0.96,
      chill: 0.78,
      cinematic: 0.88,
      tropical: 0.94,
      house: 0.96,
      lofi: 0.76,
      piano: 0.82,
      sunset: 0.84,
      corporate: 0.9
    };
    master.gain.value = masterGainByMode[mode] || 0.84;
    master.connect(output);

    // Keep the graph "alive" on mobile Safari while keeping playback silent for the user.
    let monitor = null;
    try {
      monitor = ctx.createGain();
      monitor.gain.value = 0.00001;
      master.connect(monitor);
      monitor.connect(ctx.destination);
    } catch {
      // ignore
    }

    const start = ctx.currentTime + 0.02;
    const end = start + Math.max(2, Number(durationSec) || 9);
    switch (mode) {
      case 'ambient': {
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
        break;
      }
      case 'upbeat': {
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
        break;
      }
      case 'chill': {
        const roots = [174.61, 196, 220, 246.94];
        let tSec = start;
        let idx = 0;
        while (tSec < end - 0.18) {
          const root = roots[idx % roots.length];
          scheduleChord(ctx, master, {
            time: tSec,
            duration: 0.86,
            root,
            intervals: [1, 1.25, 1.5],
            type: 'triangle',
            gain: 0.038,
            attack: 0.05,
            release: 0.24
          });
          scheduleTone(ctx, master, {
            time: tSec + 0.04,
            duration: 0.82,
            frequency: root / 2,
            type: 'sine',
            gain: 0.018,
            attack: 0.02,
            release: 0.2
          });
          if (idx % 2 === 0) {
            scheduleTone(ctx, master, {
              time: tSec + 0.48,
              duration: 0.18,
              frequency: root * 2,
              type: 'sine',
              gain: 0.012,
              attack: 0.01,
              release: 0.1
            });
          }
          idx += 1;
          tSec += 0.84;
        }
        break;
      }
      case 'cinematic': {
        const roots = [110, 123.47, 146.83, 164.81, 146.83, 123.47];
        let tSec = start;
        let idx = 0;
        while (tSec < end - 0.2) {
          const root = roots[idx % roots.length];
          scheduleChord(ctx, master, {
            time: tSec,
            duration: 1.25,
            root,
            intervals: [1, 1.5, 2],
            type: 'sawtooth',
            gain: 0.028,
            attack: 0.2,
            release: 0.42
          });
          scheduleTone(ctx, master, {
            time: tSec + 0.02,
            duration: 1.0,
            frequency: root / 2,
            type: 'sine',
            gain: 0.02,
            attack: 0.11,
            release: 0.28
          });
          if (idx % 2 === 0) {
            scheduleTone(ctx, master, {
              time: tSec + 0.56,
              duration: 0.42,
              frequency: root * 2.5,
              type: 'triangle',
              gain: 0.011,
              attack: 0.08,
              release: 0.2
            });
          }
          idx += 1;
          tSec += 1.05;
        }
        break;
      }
      case 'tropical': {
        const melody = [329.63, 392, 440, 523.25, 440, 392, 349.23, 392];
        const bass = [98, 110, 123.47, 110];
        let tSec = start;
        let step = 0;
        while (tSec < end - 0.12) {
          const lead = melody[step % melody.length];
          scheduleTone(ctx, master, {
            time: tSec,
            duration: 0.17,
            frequency: lead,
            type: 'triangle',
            gain: 0.03,
            attack: 0.01,
            release: 0.08
          });
          if (step % 2 === 0) {
            scheduleTone(ctx, master, {
              time: tSec,
              duration: 0.22,
              frequency: bass[Math.floor(step / 2) % bass.length],
              type: 'sine',
              gain: 0.018,
              attack: 0.008,
              release: 0.12
            });
          }
          if (step % 4 === 2) {
            scheduleTone(ctx, master, {
              time: tSec + 0.14,
              duration: 0.1,
              frequency: lead * 0.5,
              type: 'square',
              gain: 0.012,
              attack: 0.005,
              release: 0.06
            });
          }
          step += 1;
          tSec += 0.28;
        }
        break;
      }
      case 'house': {
        const bassline = [110, 110, 123.47, 98, 110, 123.47, 130.81, 123.47];
        const beat = 60 / 126;
        let tSec = start;
        let beatIdx = 0;
        while (tSec < end - 0.08) {
          scheduleTone(ctx, master, {
            time: tSec,
            duration: 0.12,
            frequency: 52,
            type: 'sine',
            gain: 0.06,
            attack: 0.004,
            release: 0.09
          });
          scheduleTone(ctx, master, {
            time: tSec,
            duration: 0.28,
            frequency: bassline[beatIdx % bassline.length],
            type: 'triangle',
            gain: 0.022,
            attack: 0.01,
            release: 0.16
          });
          if (beatIdx % 2 === 1) {
            scheduleTone(ctx, master, {
              time: tSec + beat * 0.52,
              duration: 0.08,
              frequency: 800,
              type: 'square',
              gain: 0.011,
              attack: 0.002,
              release: 0.05
            });
          }
          if (beatIdx % 4 === 0) {
            scheduleTone(ctx, master, {
              time: tSec + beat * 0.24,
              duration: 0.16,
              frequency: 440,
              type: 'sawtooth',
              gain: 0.015,
              attack: 0.01,
              release: 0.09
            });
          }
          beatIdx += 1;
          tSec += beat;
        }
        break;
      }
      case 'lofi': {
        const roots = [196, 174.61, 146.83, 164.81];
        let tSec = start;
        let idx = 0;
        while (tSec < end - 0.2) {
          const root = roots[idx % roots.length];
          scheduleChord(ctx, master, {
            time: tSec,
            duration: 0.72,
            root,
            intervals: [1, 1.2, 1.5],
            type: 'triangle',
            gain: 0.028,
            attack: 0.03,
            release: 0.2
          });
          scheduleTone(ctx, master, {
            time: tSec + 0.02,
            duration: 0.88,
            frequency: root / 2,
            type: 'sine',
            gain: 0.017,
            attack: 0.02,
            release: 0.28
          });
          scheduleTone(ctx, master, {
            time: tSec + 0.46,
            duration: 0.06,
            frequency: 520,
            type: 'triangle',
            gain: 0.006,
            attack: 0.002,
            release: 0.04
          });
          idx += 1;
          tSec += 0.92;
        }
        break;
      }
      case 'piano': {
        const notes = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 349.23];
        let tSec = start;
        let idx = 0;
        while (tSec < end - 0.1) {
          const note = notes[idx % notes.length];
          scheduleTone(ctx, master, {
            time: tSec,
            duration: 0.3,
            frequency: note,
            type: 'triangle',
            gain: 0.028,
            attack: 0.005,
            release: 0.18
          });
          scheduleTone(ctx, master, {
            time: tSec + 0.01,
            duration: 0.34,
            frequency: note * 2,
            type: 'sine',
            gain: 0.008,
            attack: 0.004,
            release: 0.16
          });
          if (idx % 2 === 0) {
            scheduleTone(ctx, master, {
              time: tSec,
              duration: 0.44,
              frequency: note / 2,
              type: 'sine',
              gain: 0.013,
              attack: 0.01,
              release: 0.22
            });
          }
          idx += 1;
          tSec += 0.38;
        }
        break;
      }
      case 'sunset': {
        const melody = [220, 246.94, 277.18, 329.63, 277.18, 246.94, 220, 196];
        let tSec = start;
        let step = 0;
        while (tSec < end - 0.12) {
          const note = melody[step % melody.length];
          scheduleTone(ctx, master, {
            time: tSec,
            duration: 0.42,
            frequency: note,
            type: 'sine',
            gain: 0.027,
            attack: 0.02,
            release: 0.2
          });
          scheduleTone(ctx, master, {
            time: tSec + 0.06,
            duration: 0.3,
            frequency: note * 1.5,
            type: 'triangle',
            gain: 0.012,
            attack: 0.014,
            release: 0.14
          });
          if (step % 2 === 0) {
            scheduleTone(ctx, master, {
              time: tSec,
              duration: 0.5,
              frequency: note / 2,
              type: 'sine',
              gain: 0.014,
              attack: 0.01,
              release: 0.24
            });
          }
          step += 1;
          tSec += 0.48;
        }
        break;
      }
      case 'corporate': {
        const motif = [261.63, 293.66, 329.63, 392, 349.23, 329.63];
        let tSec = start;
        let step = 0;
        while (tSec < end - 0.1) {
          const note = motif[step % motif.length];
          scheduleTone(ctx, master, {
            time: tSec,
            duration: 0.16,
            frequency: note,
            type: 'square',
            gain: 0.028,
            attack: 0.007,
            release: 0.08
          });
          scheduleTone(ctx, master, {
            time: tSec,
            duration: 0.28,
            frequency: note / 2,
            type: 'triangle',
            gain: 0.012,
            attack: 0.01,
            release: 0.16
          });
          if (step % 4 === 0) {
            scheduleChord(ctx, master, {
              time: tSec + 0.06,
              duration: 0.32,
              root: note / 2,
              intervals: [1, 1.25],
              type: 'sawtooth',
              gain: 0.011,
              attack: 0.01,
              release: 0.1
            });
          }
          step += 1;
          tSec += 0.3;
        }
        break;
      }
      default: {
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
          idx += 1;
          tSec += 0.96;
        }
      }
    }

    const tracks = output.stream.getAudioTracks();
    const track = tracks.length ? tracks[0] : null;
    if (track) {
      try {
        track.enabled = true;
      } catch {
        // ignore
      }
    }
    return {
      track,
      async stop() {
        try {
          tracks.forEach((track) => track.stop());
        } catch {
          // ignore
        }
        try {
          master.disconnect();
        } catch {
          // ignore
        }
        try {
          if (monitor) monitor.disconnect();
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
      type: businessType || t('reel.type.business', 'Business'),
      businessType: businessType || '',
      town: toText(b && (b.town || b.location), 'Costa Blanca South'),
      province: toText(b && b.province, 'Alicante'),
      beds: 0,
      baths: 0,
      description: toText(b && b.description, ''),
      images: b && b.image ? [toText(b.image)] : [],
      features: [
        businessType ? `${t('reel.feature.sector_prefix', 'Sector')}: ${businessType}` : '',
        kind === 'traspaso'
          ? t('reel.feature.deal_traspaso', 'Deal: Traspaso')
          : kind === 'business'
            ? t('reel.feature.deal_business', 'Deal: Business for sale')
            : ''
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
      type: toText(r.type, t('modal.type_default', 'Property')),
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
    if (els.play) els.play.disabled = busy;
    if (els.toggleBrand) els.toggleBrand.disabled = busy;
    if (els.share && busy) els.share.disabled = true;
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
    const url = buildAppUrl('properties.html', { ref });

    const lines = [
      `${type} • ${town}, ${province}`,
      price ? `${t('reel.caption.price_label', 'Price')}: ${price}` : '',
      ref ? `${t('reel.caption.ref_label', 'Ref')}: ${ref}` : '',
      '',
      url
    ].filter(Boolean);
    if (!whiteLabel) {
      lines.splice(3, 0, `📞 +34 624 867 866 (${t('reel.caption.whatsapp_available', 'WhatsApp available')})`);
    }
    return lines.join('\n');
  };

  const createVideo = async ({
    listing,
    whiteLabel,
    durationSec: durationSecRaw,
    audioMode: audioModeRaw,
    showOverlayCaptions = true,
    autoPlayPreview = false,
    primedAudioContext = null,
    allowAudioFallback = true
  } = {}) => {
    const closePrimedAudioContext = async () => {
      if (!primedAudioContext || typeof primedAudioContext.close !== 'function') return;
      try {
        await primedAudioContext.close();
      } catch {
        // ignore
      }
    };
    if (isBusy) {
      await closePrimedAudioContext();
      return;
    }
    if (!els.canvas) {
      await closePrimedAudioContext();
      return;
    }
    if (!listing) {
      await closePrimedAudioContext();
      return;
    }

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
    const audioMode = normalizeAudioMode(audioModeRaw, 'none');
    let musicContext = primedAudioContext;
    const closeUnusedMusicContext = async () => {
      if (!musicContext || typeof musicContext.close !== 'function') return;
      try {
        await musicContext.close();
      } catch {
        // ignore
      }
      musicContext = null;
    };

    const ctx = els.canvas.getContext('2d');
    if (!ctx) {
      await closeUnusedMusicContext();
      setBusy(false);
      setStatus(t('reel.status.no_canvas', 'Your browser does not support this feature.'), { tone: 'bad' });
      return;
    }

    const logo = whiteLabel ? null : await loadImage('assets/scp-isotipo.png', { timeoutMs: 8000 });

    const rawUrls = imageUrlsFor(listing);
    const maxSlidesByDuration = Math.max(3, Math.min(10, Math.round(durationSec / 1.45) + 2));
    const slideUrls = pickSlides(rawUrls, maxSlidesByDuration);

    if (!slideUrls.length) {
      await closeUnusedMusicContext();
      setStatus(t('reel.status.no_images', 'No images found for this listing.'), { tone: 'bad' });
      setBusy(false);
      return;
    }

    setStatus(t('reel.status.loading_images', 'Loading images…'));
    const images = [];
    for (let i = 0; i < slideUrls.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const img = await loadListingImage(slideUrls[i], { w: 1200, h: 2000, q: 82, timeoutMs: 14000 });
      if (img) images.push(img);
      setStatus(t('reel.status.loaded_n', `Loaded ${images.length} images`, { n: images.length }));
      if (images.length >= maxSlidesByDuration) break;
    }

    if (!images.length) {
      await closeUnusedMusicContext();
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
    let audioEnabled = false;
    if (audioMode !== 'none') {
      // best-effort synthetic audio bed generated locally in-browser
      audioSession = await startMusicBed({ mode: audioMode, durationSec: totalDur, audioContext: musicContext });
      musicContext = null;
      audioEnabled = !!(audioSession && audioSession.track);
    }
    const stream = audioEnabled
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
      await closeUnusedMusicContext();
      try {
        (stream.getTracks() || []).forEach((track) => track.stop());
      } catch {
        // ignore
      }
      if (audioMode !== 'none' && allowAudioFallback) {
        setStatus(t('reel.status.audio_fallback', 'Audio export is not supported here. Retrying without music.'), { tone: 'warn' });
        setBusy(false);
        return createVideo({
          listing,
          whiteLabel,
          durationSec: durationSecRaw,
          audioMode: 'none',
          showOverlayCaptions,
          autoPlayPreview,
          primedAudioContext: null,
          allowAudioFallback: false
        });
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
    await closeUnusedMusicContext();
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
    if (els.actions) els.actions.hidden = true;
    if (els.captionWrap) els.captionWrap.hidden = false;
    if (els.playWrap) els.playWrap.hidden = false;
    if (els.previewVideo) {
      els.previewVideo.src = currentObjectUrl;
      try {
        els.previewVideo.muted = !audioEnabled;
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
      : (audioEnabled
        ? t('reel.status.ready_with_audio', 'Video ready with audio.')
        : t('reel.status.ready_no_audio', 'Video ready. Audio is not available on this browser/device.'));
    setStatus(ready, { tone: 'good' });
  };

  const openWebShareFallbackForApp = ({ app, text, url } = {}) => {
    const appNorm = normalize(app);
    const shareUrl = encodeURIComponent(toText(url));
    const shareText = encodeURIComponent(toText(text));
    let target = '';
    if (appNorm === 'whatsapp') {
      target = `https://wa.me/?text=${shareText}%0A${shareUrl}`;
    } else if (appNorm === 'telegram') {
      target = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`;
    } else if (appNorm === 'facebook') {
      target = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
    } else if (appNorm === 'linkedin') {
      target = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;
    } else if (appNorm === 'x' || appNorm === 'twitter') {
      target = `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`;
    }
    if (!target) return false;
    try {
      window.open(target, '_blank', 'noopener,noreferrer');
      return true;
    } catch {
      return false;
    }
  };

  const shareVideo = async ({ listing, whiteLabel, preferredApp, ensureVideo } = {}) => {
    if (!lastVideoFile && typeof ensureVideo === 'function') {
      const ready = await ensureVideo();
      if (!ready) {
        setStatus(t('reel.status.no_video', 'Tap Play video first.'), { tone: 'warn' });
        return;
      }
    }
    if (!lastVideoFile) {
      setStatus(t('reel.status.no_video', 'Tap Play video first.'), { tone: 'warn' });
      return;
    }
    const captionText = (els.caption && toText(els.caption.value)) || buildCaption(listing, { whiteLabel });
    const ref = toText(listing && listing.ref).trim();
    const listingUrl = buildAppUrl('properties.html', { ref });

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
    void openWebShareFallbackForApp({ app: preferredApp, text: captionText, url: listingUrl });
  };

  const init = async () => {
    const url = new URL(window.location.href);
    const ref = toText(url.searchParams.get('ref')).trim();
    const wl = url.searchParams.get('wl') === '1';
    const preferredApp = toText(url.searchParams.get('app')).trim();
    const autoPlayParam = normalize(url.searchParams.get('autoplay') || url.searchParams.get('auto'));
    const autoCreateAndPlay = autoPlayParam === '1' || autoPlayParam === 'true' || autoPlayParam === 'yes';
    const openShareParam = normalize(url.searchParams.get('share') || url.searchParams.get('sharevideo'));
    const openSharePanelOnLoad = openShareParam === '1' || openShareParam === 'true' || openShareParam === 'yes';
    const durationRaw = url.searchParams.get('dur');
    const durationParam = durationRaw === null ? NaN : Number(durationRaw);
    const audioParam = normalize(url.searchParams.get('audio'));
    const captionsParam = toText(url.searchParams.get('captions'));

    setWhiteLabel(wl);

    if (!ref) {
      if (els.refChip) els.refChip.textContent = t('reel.missing_ref', 'Missing ref');
      setStatus(t('reel.missing_ref_help', 'Open this page with ?ref=SCP-XXXX'), { tone: 'warn' });
      if (els.overlay) els.overlay.style.display = 'flex';
      return;
    }

    if (els.refChip) els.refChip.textContent = ref;
    try {
      const backLink = document.querySelector('.brochure-toolbar-left a.brochure-pill[href="properties.html"]');
      if (backLink) backLink.href = buildAppUrl('properties.html', { ref });
    } catch {
      // ignore
    }

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
    const reelOptions = createOptions({
      listing,
      durationOverride: durationParam,
      audioOverride: audioParam,
      captionsOverride: captionsParam
    });

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
      const durationText = `${reelOptions.durationSec}s`;
      const audioText = t(
        `reel.audio.${reelOptions.audioMode}`,
        REEL_AUDIO_LABEL_FALLBACK[reelOptions.audioMode] || REEL_AUDIO_LABEL_FALLBACK.ambient
      );
      const captionsText = reelOptions.showOverlayCaptions ? t('reel.caption.on', 'Captions on') : t('reel.caption.off', 'Captions off');
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
      const hero = urls[0] || '';
      const heroImg = hero ? await loadListingImage(hero, { w: 1200, h: 2000, q: 80, timeoutMs: 14000 }) : null;
      const logo = wl ? null : await loadImage('assets/scp-isotipo.png', { timeoutMs: 8000 });
      renderPreview(ctx, els.canvas, heroImg, {
        whiteLabel: wl,
        listing,
        overlay: (c, canv, { whiteLabel }) => drawOverlay(c, canv, { whiteLabel, listing, logo, showCta: false })
      });
    }

    if (els.overlay) els.overlay.style.display = 'none';
    setStatus(t('reel.status.auto_generating', 'Generating your reel…'), { tone: 'normal' });

    let createTask = null;

    const playPreviewVideo = async () => {
      if (!els.previewVideo || !currentObjectUrl) return false;
      if (els.playWrap) els.playWrap.hidden = false;
      try {
        els.previewVideo.currentTime = 0;
      } catch {
        // ignore
      }
      try {
        await els.previewVideo.play();
        if (els.playWrap && typeof els.playWrap.scrollIntoView === 'function') {
          els.playWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        return true;
      } catch {
        return false;
      }
    };

    const triggerCreate = async (autoPlayPreview = false, { primeAudio = false } = {}) => {
      const primedAudioContext = (primeAudio && reelOptions.audioMode !== 'none') ? await primeMusicContext() : null;
      await createVideo({
        listing,
        whiteLabel: document.body.classList.contains('reel-wl'),
        durationSec: reelOptions.durationSec,
        audioMode: reelOptions.audioMode,
        showOverlayCaptions: reelOptions.showOverlayCaptions,
        autoPlayPreview,
        primedAudioContext,
        allowAudioFallback: true
      });
      return !!lastVideoFile;
    };

    const ensureVideoReady = async ({ autoPlayPreview = false, primeAudio = false } = {}) => {
      if (lastVideoFile) {
        if (autoPlayPreview) await playPreviewVideo();
        return true;
      }
      if (createTask) {
        const ok = await createTask;
        if (ok && autoPlayPreview) await playPreviewVideo();
        return !!ok;
      }
      createTask = (async () => {
        const ok = await triggerCreate(autoPlayPreview, { primeAudio });
        return !!ok;
      })().finally(() => {
        createTask = null;
      });
      const ok = await createTask;
      if (ok && autoPlayPreview) await playPreviewVideo();
      return !!ok;
    };

    const setSharePanel = (show) => {
      if (!els.actions) return;
      const shouldShow = !!show;
      els.actions.hidden = !shouldShow;
      if (shouldShow) {
        setStatus(t('reel.status.choose_platform', 'Choose a platform below.'), { tone: 'normal' });
      }
    };

    const toggleSharePanel = () => {
      if (!els.actions) return;
      setSharePanel(els.actions.hidden);
    };

    const onToggleBrand = () => {
      const next = !document.body.classList.contains('reel-wl');
      setWhiteLabel(next);
      updateUrlWl(next);
      clearVideo();
      setSharePanel(false);
      setStatus(t('reel.status.auto_generating', 'Generating your reel…'), { tone: 'normal' });
      // Re-render preview with/without logo.
      if (els.canvas) {
        const ctx = els.canvas.getContext('2d');
        const urls = imageUrlsFor(listing);
        const hero = urls[0] || '';
        (async () => {
          const heroImg = hero ? await loadListingImage(hero, { w: 1200, h: 2000, q: 80, timeoutMs: 12000 }) : null;
          const logo = next ? null : await loadImage('assets/scp-isotipo.png', { timeoutMs: 8000 });
          renderPreview(ctx, els.canvas, heroImg, {
            whiteLabel: next,
            listing,
            overlay: (c, canv, { whiteLabel }) => drawOverlay(c, canv, { whiteLabel, listing, logo, showCta: false })
          });
        })();
      }
      void ensureVideoReady({ autoPlayPreview: false, primeAudio: false });
    };

    if (els.toggleBrand) els.toggleBrand.addEventListener('click', onToggleBrand);
    if (els.play) {
      els.play.addEventListener('click', () => {
        void ensureVideoReady({ autoPlayPreview: true, primeAudio: true });
      });
    }
    if (els.share) {
      els.share.addEventListener('click', async () => {
        const ok = await ensureVideoReady({ autoPlayPreview: false, primeAudio: true });
        if (!ok) return;
        toggleSharePanel();
      });
    }

    const appShare = (btn, appName) => {
      if (!btn) return;
      btn.addEventListener('click', async () => {
        const ok = await ensureVideoReady({ autoPlayPreview: false, primeAudio: true });
        if (!ok) return;
        void shareVideo({
          listing,
          whiteLabel: document.body.classList.contains('reel-wl'),
          preferredApp: appName,
          ensureVideo: () => ensureVideoReady({ autoPlayPreview: false, primeAudio: true })
        });
      });
    };
    appShare(els.shareInstagram, 'Instagram');
    appShare(els.shareTiktok, 'TikTok');
    appShare(els.shareFacebook, 'Facebook');
    appShare(els.shareWhatsapp, 'WhatsApp');
    appShare(els.shareTelegram, 'Telegram');
    appShare(els.shareLinkedin, 'LinkedIn');

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
      setStatus(t('reel.status.preferred_app', `Tip: Tap Share video and choose ${preferredApp}.`, { app: preferredApp }), { tone: 'normal' });
    }

    const shouldAutoPlay = autoCreateAndPlay;
    void (async () => {
      const ok = await ensureVideoReady({ autoPlayPreview: shouldAutoPlay, primeAudio: false });
      if (!ok) return;
      if (openSharePanelOnLoad || !!preferredApp) {
        setSharePanel(true);
      }
    })();
  };

  init();
})();
