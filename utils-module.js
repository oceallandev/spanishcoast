/**
 * Spanish Coast Properties - Utility Module
 * Extracted from app.js
 */
window.SCP_UTILS = (() => {
    const toText = (val, fallback = '') => {
        if (val == null) return fallback;
        const s = String(val).trim();
        return s || fallback;
    };

    const normalize = (val) => toText(val).toLowerCase();

    const escapeHtml = (value) => {
        return toText(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    const idKey = (id) => toText(id).toUpperCase().replace(/[^A-Z0-9-]/g, '');

    const imageUrlsFor = (property) => {
        if (!property) return [];
        const raw = property.images || property.image_urls || property.imageUrls || [];
        return (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
    };

    const featuresFor = (property) => {
        if (!property) return [];
        const raw = property.features || property.amenities || [];
        return (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
    };

    const builtAreaFor = (property) => {
        const built = Number(property.built_area || (property.surface_area && property.surface_area.built) || property.builtArea);
        return Number.isFinite(built) ? Math.trunc(built) : 0;
    };

    const t = (key, fallback, vars) => {
        try {
            if (window.SCP_I18N && typeof window.SCP_I18N.t === 'function') {
                return window.SCP_I18N.t(key, vars) || fallback;
            }
        } catch { }
        return fallback;
    };

    const formatPrice = (price) => {
        const number = Number(price);
        if (!Number.isFinite(number) || number <= 0) return t('common.price_on_request', 'Price on request');
        return new Intl.NumberFormat('en-IE', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0
        }).format(number);
    };

    const propertyIdFor = (property) => {
        if (!property) return '';
        return idKey(property.id || property.ref);
    };

    const formatListingPrice = (property) => {
        return formatPrice(property.price);
    };

    const toRadians = (v) => (Number(v) * Math.PI) / 180;

    const distanceKm = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const priceNumber = (property) => {
        return Number(property.price || 0);
    };

    const parseEuroAmount = (text) => {
        if (!text) return 0;
        const cleaned = String(text).replace(/[^\d]/g, '');
        return parseInt(cleaned, 10) || 0;
    };

    const listingModeFor = (property) => {
        const type = normalize(property.type);
        const ref = normalize(property.ref);
        if (ref.includes('rent') || type.includes('rent')) return 'rent';
        return 'sale';
    };

    const decodeHtmlEntities = (text) => {
        const textArea = document.createElement('textarea');
        textArea.innerHTML = toText(text);
        return textArea.value;
    };

    const isPropertyInDisplayArea = (property) => {
        if (!property) return false;
        const lat = Number(property.latitude);
        const lon = Number(property.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;

        const bounds = {
            minLat: 37.75,
            maxLat: 38.48,
            minLon: -1.10,
            maxLon: -0.25
        };

        if (lat < bounds.minLat || lat > bounds.maxLat || lon < bounds.minLon || lon > bounds.maxLon) {
            return false;
        }

        const torrevieja = { lat: 37.978, lon: -0.683 };
        const dist = distanceKm(lat, lon, torrevieja.lat, torrevieja.lon);
        return dist <= 100;
    };

    const STORAGE_KEY = 'scp:favourites:v1';

    const storageAvailable = (type = 'localStorage') => {
        try {
            const storage = window[type];
            const x = '__storage_test__';
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        } catch (e) {
            return false;
        }
    };

    const loadFavoriteIds = () => {
        if (!storageAvailable()) return new Set();
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return new Set();
            const arr = JSON.parse(saved);
            return new Set(Array.isArray(arr) ? arr : []);
        } catch (e) {
            return new Set();
        }
    };

    const persistFavoriteIds = (favSet) => {
        if (!storageAvailable()) return;
        try {
            const arr = Array.from(favSet || []);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        } catch (e) {
            // ignore
        }
    };

    const isLoopbackHost = (hostname) => {
        const host = toText(hostname).trim().toLowerCase();
        if (!host) return false;
        if (host === 'localhost' || host.endsWith('.localhost')) return true;
        if (host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
        return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
    };

    return {
        toText,
        normalize,
        escapeHtml,
        idKey,
        imageUrlsFor,
        featuresFor,
        builtAreaFor,
        t,
        formatPrice,
        propertyIdFor,
        formatListingPrice,
        decodeHtmlEntities,
        toRadians,
        distanceKm,
        priceNumber,
        parseEuroAmount,
        listingModeFor,
        isPropertyInDisplayArea,
        storageAvailable,
        loadFavoriteIds,
        persistFavoriteIds,
        isLoopbackHost
    };
})();
