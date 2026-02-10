document.addEventListener('DOMContentLoaded', () => {
    const baseProperties = Array.isArray(propertyData) ? propertyData : [];
    const customProperties = Array.isArray(window.customPropertyData) ? window.customPropertyData : [];
    const rawProperties = baseProperties.concat(customProperties);
    const businessItems = Array.isArray(window.businessData) ? window.businessData : [];
    const vehicleItems = Array.isArray(window.vehicleData) ? window.vehicleData : [];
    const TORREVIEJA_COORDS = { lat: 37.978, lon: -0.683 };
    const MAX_DISTANCE_FROM_TORREVIEJA_KM = 100;
    const DISPLAY_BOUNDS = {
        minLat: 37.84,
        maxLat: 38.13,
        minLon: -0.8,
        maxLon: -0.6
    };
    const MAIN_DESTINATIONS = [
        { value: 'all', label: 'All Destinations' },
        { value: 'torrevieja', label: 'Torrevieja' },
        { value: 'orihuela-costa', label: 'Orihuela Costa' },
        { value: 'guardamar', label: 'Guardamar' },
        { value: 'quesada', label: 'Quesada' }
    ];
    const EARTH_RADIUS_KM = 6371;
    const numberFormat = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 });
    const PLACEHOLDER_IMAGE = 'assets/placeholder.png';
	    const LISTING_OVERRIDES_BY_REF = {
	        // Feed correction: this is a "traspaso" (business transfer) with monthly rent.
	        'SCP-1424': { mode: 'traspaso', price: 50000, monthlyRent: 572 }
	    };
	    const FAVORITES_STORAGE_KEY = 'scp:favourites:v1';
	    const SHARE_ICON_BASE = 'class="share-icon-svg" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"';
	    const SHARE_ICON_SVG = {
	        native: `<svg ${SHARE_ICON_BASE}><path d="M13.5 1a.5.5 0 0 1 .5.5V2h.5a1.5 1.5 0 0 1 1.5 1.5V4a.5.5 0 0 1-1 0v-.5a.5.5 0 0 0-.5-.5H14v.5a.5.5 0 0 1-1 0v-2a.5.5 0 0 1 .5-.5"/><path d="M11 2.5a.5.5 0 0 1 .5-.5h.5V1.5a.5.5 0 0 1 1 0V2h.5a.5.5 0 0 1 0 1H13v.5a.5.5 0 0 1-1 0V3h-.5a.5.5 0 0 1-.5-.5"/><path d="M4 5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1H5v2.5H6a.5.5 0 0 1 0 1H5V12h2.5a.5.5 0 0 1 0 1H4.5A.5.5 0 0 1 4 12.5z"/><path d="M2 4a2 2 0 0 1 2-2h4.5a.5.5 0 0 1 0 1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V7.5a.5.5 0 0 1 1 0V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/></svg>`,
	        copy: `<svg ${SHARE_ICON_BASE}><path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/><path fill-rule="evenodd" d="M2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1z"/></svg>`,
	        instagram: `<svg ${SHARE_ICON_BASE}><path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.9 3.9 0 0 0-1.417.923A3.9 3.9 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.9 3.9 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942.038-.853.048-1.125.048-3.297 0-2.174-.01-2.446-.048-3.3-.04-.851-.175-1.433-.372-1.941a3.9 3.9 0 0 0-.923-1.417A3.9 3.9 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599s.453.546.598.92c.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.5 2.5 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.5 2.5 0 0 1-.92-.598 2.5 2.5 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.232s.008-2.388.046-3.231c.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.28-.11.704-.24 1.485-.275.738-.034 1.024-.044 2.515-.045zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92m-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217m0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334"/></svg>`,
	        tiktok: `<svg ${SHARE_ICON_BASE}><path d="M9.837 2.14a1.2 1.2 0 0 0-1.2 1.2v4.908a2.5 2.5 0 1 1-2-2.45V4.15a4 4 0 1 0 4.8 3.9V5.43a5.2 5.2 0 0 0 2.8.86V4.84a3.6 3.6 0 0 1-2.11-.67 3.6 3.6 0 0 1-1.09-2.03z"/></svg>`,
	        x: `<svg ${SHARE_ICON_BASE}><path d="M12.6 0h2.4l-5.3 6.06L16 16h-4.7L7.8 10.61 3.1 16H.7l5.8-6.63L0 0h4.8l3.2 4.89L12.6 0z"/></svg>`,
	        whatsapp: `<svg ${SHARE_ICON_BASE}><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.592 0 0 3.592 0 7.994c0 1.406.367 2.77 1.062 3.98L0 16l4.131-1.062a7.9 7.9 0 0 0 3.863 1.01h.003c4.402 0 7.994-3.592 7.994-7.994a7.9 7.9 0 0 0-2.39-5.628M7.994 14.521a6.56 6.56 0 0 1-3.347-.92l-.239-.144-2.452.63.654-2.386-.156-.244a6.6 6.6 0 0 1-1.007-3.46c0-3.667 2.984-6.654 6.647-6.654a6.62 6.62 0 0 1 4.708 1.953 6.6 6.6 0 0 1 1.947 4.703c0 3.667-2.984 6.654-6.655 6.654m3.546-4.854c-.193-.096-1.142-.564-1.32-.63-.178-.064-.307-.096-.435.096-.128.193-.5.63-.614.758-.114.128-.228.144-.421.048-.193-.096-.815-.3-1.553-.96-.574-.512-.96-1.142-1.073-1.335-.114-.193-.012-.297.085-.393.087-.086.193-.228.289-.342.096-.114.128-.193.193-.322.064-.128.032-.24-.016-.336-.048-.096-.435-1.044-.595-1.43-.156-.375-.315-.324-.435-.33l-.372-.007a.72.72 0 0 0-.521.24c-.178.193-.68.664-.68 1.62 0 .958.696 1.885.792 2.014.096.128 1.37 2.09 3.319 2.93.463.2.824.319 1.105.408.464.148.887.127 1.22.077.372-.056 1.142-.466 1.303-.916.16-.45.16-.837.112-.916-.048-.08-.176-.128-.37-.224"/></svg>`,
	        telegram: `<svg ${SHARE_ICON_BASE}><path d="M16 0 0 7l4 2 8-5-6 6 1 4 3-3 3 5z"/></svg>`,
	        facebook: `<svg ${SHARE_ICON_BASE}><path d="M16 8.049c0-4.446-3.582-8.05-8-8.05S0 3.603 0 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951"/></svg>`,
	        linkedin: `<svg ${SHARE_ICON_BASE}><path d="M0 1.146C0 .513.526 0 1.175 0h13.65C15.474 0 16 .513 16 1.146v13.708c0 .633-.526 1.146-1.175 1.146H1.175C.526 16 0 15.487 0 14.854zm4.943 12.248V6.169H2.542v7.225zm-1.2-8.212c.837 0 1.358-.554 1.358-1.248-.015-.709-.52-1.248-1.342-1.248S2.4 3.226 2.4 3.934c0 .694.521 1.248 1.327 1.248zm4.908 8.212V9.359c0-.216.016-.432.08-.586.173-.431.568-.878 1.232-.878.869 0 1.216.662 1.216 1.634v3.865h2.401V9.252c0-2.22-1.184-3.252-2.764-3.252-1.274 0-1.845.7-2.165 1.193v.025h-.016l.016-.025V6.169H6.542c.03.678 0 7.225 0 7.225z"/></svg>`,
	        report: `<svg ${SHARE_ICON_BASE}><path fill-rule="evenodd" d="M14.778.085A.5.5 0 0 1 15 .5V8a.5.5 0 0 1-.314.464L14 8.737V14.5a.5.5 0 0 1-1 0V9.151l-5.314 2.19A.5.5 0 0 1 7 10.88V10H3v5.5a.5.5 0 0 1-1 0V.5a.5.5 0 0 1 1 0V9h4V1.12a.5.5 0 0 1 .686-.464l7 2.889a.5.5 0 0 1 .092.02zM8 2.9v6.958l6-2.477V5.377z"/></svg>`
	    };

	    function storageAvailable() {
	        try {
	            if (!window.localStorage) return false;
            const testKey = '__scp_test__';
            window.localStorage.setItem(testKey, '1');
            window.localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    function loadFavoriteIds() {
        if (!storageAvailable()) return new Set();
        try {
            const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
            if (!raw) return new Set();
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return new Set();
            return new Set(parsed.map((v) => idKey(v)).filter(Boolean));
        } catch (error) {
            return new Set();
        }
    }

    function persistFavoriteIds(favSet) {
        if (!storageAvailable()) return;
        try {
            window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favSet)));
        } catch (error) {
            // ignore
        }
    }

    let favoriteIds = loadFavoriteIds();
    let favoritesOnly = false;
    let supabaseClient = null;
    let supabaseUser = null;
    let supabaseRole = '';

    // Allow deep-linking into "Saved" view from account.html.
    try {
        const p = new URLSearchParams(window.location.search);
        const saved = (p.get('saved') || p.get('favourites') || p.get('favorites') || '').trim();
        if (saved === '1' || saved.toLowerCase() === 'true' || saved.toLowerCase() === 'yes') {
            favoritesOnly = true;
        }
    } catch (error) {
        // ignore
    }

    function refKey(value) {
        return toText(value).trim().toUpperCase();
    }

    function listingOverrideFor(property) {
        const key = refKey(property && property.ref);
        if (!key) return null;
        return LISTING_OVERRIDES_BY_REF[key] || null;
    }

    function toRadians(value) {
        return value * (Math.PI / 180);
    }

    function distanceKm(lat1, lon1, lat2, lon2) {
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2))
            * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    function isPropertyInDisplayArea(property) {
        const latitude = Number(property && property.latitude);
        const longitude = Number(property && property.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return false;
        }

        const inBounds = latitude >= DISPLAY_BOUNDS.minLat
            && latitude <= DISPLAY_BOUNDS.maxLat
            && longitude >= DISPLAY_BOUNDS.minLon
            && longitude <= DISPLAY_BOUNDS.maxLon;

        if (!inBounds) {
            return false;
        }

        const kmFromTorrevieja = distanceKm(
            latitude,
            longitude,
            TORREVIEJA_COORDS.lat,
            TORREVIEJA_COORDS.lon
        );

        return kmFromTorrevieja <= MAX_DISTANCE_FROM_TORREVIEJA_KM;
    }

    const allProperties = rawProperties.filter(isPropertyInDisplayArea);
    const sourceIndexById = new Map();
    const propertyById = new Map();
    allProperties.forEach((property, index) => {
        const pid = idKey(property && property.id) || idKey(property && property.ref);
        if (pid && !sourceIndexById.has(pid)) {
            sourceIndexById.set(pid, index);
        }
        if (pid && !propertyById.has(pid)) {
            propertyById.set(pid, property);
        }
    });

    // --- State Management ---
    let currentProperties = [...allProperties];
    let selectedCity = 'all';
    let selectedType = 'all';
    let searchQuery = '';
    let refQuery = '';
    let maxPrice = 'any';
    let minBeds = 0;
    let minBaths = 0;
    let poolFilter = 'any';
    let parkingFilter = 'any';
    let maxBeachDistanceMeters = 'any';
    let seaViewFilter = 'any';
    let operationMode = 'any'; // any | sale | rent_longterm | rent_vacation
    // Default sort: newest first (matches "Date added (newest)" in the UI).
    let sortMode = 'date_desc';
    let currentGalleryIndex = 0;
    let currentGalleryImages = [];
    let map;
    let markersGroup;
    const markerMap = new Map();
    let propertiesInitialized = false;
    let activeSection = 'home';
    let miniMap = null;
    let miniMapMarker = null;
    let activeModalPropertyId = '';
    let preModalScrollY = 0;
    let lightboxIndex = 0;
    let lightboxTouchStartX = null;
    let lightboxTouchStartY = null;
    let lightboxTouchStartTime = 0;
    let renderLimit = 60;
    const RENDER_BATCH = 60;
    let mapDirty = true;
    let mapHasUserInteracted = false;
    let mapLastFitSignature = '';
    let filterTimer = null;
    let loadMoreObserver = null;
    let loadingMore = false;
    let renderSequence = 0;
    const renderedPropertyIds = new Set();

    // --- DOM Elements ---
    const homeSection = document.getElementById('home-section');
    const propertiesSection = document.getElementById('properties-section');
    const businessesSection = document.getElementById('businesses-section');
    const vehiclesSection = document.getElementById('vehicles-section');
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    const sectionJumpButtons = document.querySelectorAll('[data-section-jump]');
    const businessGrid = document.getElementById('business-grid');
    const vehicleGrid = document.getElementById('vehicle-grid');

    const propertyGrid = document.getElementById('property-grid');
    const cityButtonsContainer = document.getElementById('city-buttons');
    const resultsCount = document.getElementById('results-count');

    const refSearchInput = document.getElementById('ref-search');
    const searchInput = document.getElementById('search');
    const typeFilter = document.getElementById('type-filter');
    const dealFilterEl = document.getElementById('deal-filter');
    const priceFilter = document.getElementById('price-filter');
    const bedsFilter = document.getElementById('beds-filter');
    const bathsFilter = document.getElementById('baths-filter');
    const poolFilterEl = document.getElementById('pool-filter');
    const parkingFilterEl = document.getElementById('parking-filter');
    const beachFilterEl = document.getElementById('beach-filter');
    const seaViewFilterEl = document.getElementById('sea-view-filter');
    const sortFilterEl = document.getElementById('sort-filter');
    const applyBtn = document.getElementById('apply-filters');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    const toggleMapBtn = document.getElementById('toggle-map-btn');
    const mapSection = document.getElementById('map-section');

    const modal = document.getElementById('property-modal');
    const modalDetails = document.getElementById('modal-details');
    const closeModal = document.querySelector('.close-modal');

    const lightbox = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeLightbox = document.querySelector('.close-lightbox');
    const lightboxPrevBtn = document.querySelector('.lightbox-nav.prev');
    const lightboxNextBtn = document.querySelector('.lightbox-nav.next');
    const lightboxCaption = document.getElementById('lightbox-caption');

    const mainLogoImg = document.getElementById('main-logo-img');
    const filtersBar = document.getElementById('filters-bar');
    const searchPill = document.querySelector('.search-pill');
    const toggleAdvancedBtn = document.getElementById('toggle-advanced-btn');
    const openFiltersBtn = document.getElementById('open-filters-btn');
    const closeFiltersBtn = document.getElementById('close-filters-btn');
    const filtersBackdrop = document.getElementById('filters-backdrop');
    const favoritesToggleBtn = document.getElementById('favorites-toggle');
    const favoritesSendBtn = document.getElementById('favorites-send');
    const footerYear = document.getElementById('footer-year');
    let filtersBarResizeTimer = null;
    let uiCollapsed = false;
    let uiScrollEl = null;

    function setBodyOverflow(mode) {
        // Properties page uses a fixed app-layout with its own scroll container;
        // do not toggle body scrolling or the footer will "peek" into view.
        if (document.body && document.body.dataset.section === 'properties') {
            document.body.style.overflow = '';
            return;
        }
        document.body.style.overflow = mode;
    }

    function syncFiltersBarHeight() {
        if (!filtersBar) return;
        // Mobile layout uses an overlay filters modal; keep city bar pinned under the header.
        if (window.matchMedia && window.matchMedia('(max-width: 1024px)').matches) {
            document.documentElement.style.removeProperty('--filters-bar-height');
            return;
        }

        const height = Math.ceil(filtersBar.getBoundingClientRect().height);
        if (height > 0) {
            document.documentElement.style.setProperty('--filters-bar-height', `${height}px`);
        }
    }

    function syncViewportHeightVar() {
        document.documentElement.style.setProperty('--app-vh', `${window.innerHeight}px`);
    }

    function setUiCollapsed(next) {
        if (activeSection !== 'properties') return;
        if (uiCollapsed === next) return;
        uiCollapsed = next;
        document.body.classList.toggle('ui-collapsed', next);
        if (next && searchPill) {
            // Ensure the collapsed state never keeps an expanded filter row.
            searchPill.classList.remove('advanced-open');
            if (toggleAdvancedBtn) {
                toggleAdvancedBtn.setAttribute('aria-expanded', 'false');
                toggleAdvancedBtn.textContent = 'More';
            }
        }
        requestAnimationFrame(() => {
            syncFiltersBarHeight();
        });
    }

    const animationObserver = 'IntersectionObserver' in window
        ? new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.style.animation = 'fadeIn 0.45s ease forwards';
                    animationObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08 })
        : { observe: () => {}, unobserve: () => {} };

    function toText(value, fallback = '') {
        if (typeof value === 'string') {
            return value;
        }
        if (value === null || value === undefined) {
            return fallback;
        }
        return String(value);
    }

    function normalize(value) {
        // Make search/destination matching tolerant of accents (e.g. "Almoradí" vs "almoradi").
        return toText(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function builtAreaFor(property) {
        const built = Number(property && property.surface_area && property.surface_area.built);
        return Number.isFinite(built) ? built : 0;
    }

    function idKey(value) {
        return toText(value).trim();
    }

    function cssEscape(value) {
        const text = toText(value);
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(text);
        }
        // Fallback for simple ids.
        return text.replace(/"/g, '\\"');
    }

    function featuresFor(property) {
        return Array.isArray(property && property.features) ? property.features : [];
    }

    function normalizeImageUrl(value) {
        const url = toText(value).trim();
        if (!url) return '';
        // Avoid mixed-content blocks on https pages.
        const httpsUrl = url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;
        try {
            // Encode spaces and other unsafe characters while keeping the URL readable.
            return encodeURI(httpsUrl);
        } catch (error) {
            return httpsUrl;
        }
    }

    function imageUrlsFor(property) {
        const candidates = [];
        const images = property && property.images;
        if (Array.isArray(images)) {
            images.forEach((img) => candidates.push(img));
        } else if (typeof images === 'string') {
            images
                .split(/[,\n]/g)
                .map((item) => item.trim())
                .filter(Boolean)
                .forEach((img) => candidates.push(img));
        }

        // Some feeds use different keys; try a few common ones.
        ['image', 'image_url', 'imageUrl', 'main_image', 'mainImage', 'photo', 'photo_url', 'thumbnail'].forEach((key) => {
            const val = property && property[key];
            if (val) candidates.push(val);
        });

        const unique = [];
        const seen = new Set();
        candidates.forEach((raw) => {
            const normalized = normalizeImageUrl(raw);
            if (!normalized) return;
            if (seen.has(normalized)) return;
            seen.add(normalized);
            unique.push(normalized);
        });
        return unique;
    }

    function attachImageFallback(imgEl, urls, { onAllFailed, delayMs = 120, maxAttempts = null } = {}) {
        if (!imgEl) return;
        let candidates = Array.isArray(urls) ? urls.filter(Boolean) : [];
        if (Number.isFinite(maxAttempts) && maxAttempts > 0) {
            candidates = candidates.slice(0, Math.floor(maxAttempts));
        }
        let idx = 0;
        let scheduled = null;

        imgEl.setAttribute('referrerpolicy', 'no-referrer');
        imgEl.setAttribute('decoding', 'async');

        const tryNext = () => {
            scheduled = null;
            idx += 1;
            if (idx < candidates.length) {
                imgEl.src = candidates[idx];
                return;
            }
            imgEl.src = PLACEHOLDER_IMAGE;
            imgEl.removeEventListener('error', onError);
            if (typeof onAllFailed === 'function') {
                onAllFailed();
            }
        };

        const onError = () => {
            // Avoid tight error loops which cause visible flicker on mobile.
            if (scheduled) return;
            scheduled = window.setTimeout(tryNext, delayMs);
        };
        imgEl.addEventListener('error', onError);
    }

    const imageOkCache = new Map(); // propertyId -> boolean (only set to false on definitive failure)

    function propertyIdFor(property) {
        const id = idKey(property && property.id);
        return id || idKey(property && property.ref);
    }

    function setFavButtonState(btn, isFav, { compact = false } = {}) {
        if (!btn) return;
        btn.classList.toggle('is-fav', Boolean(isFav));
        btn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
        if (compact) {
            btn.textContent = isFav ? '♥' : '♡';
            btn.title = isFav ? 'Remove from saved' : 'Save listing';
        } else {
            btn.textContent = isFav ? '♥ Saved' : '♡ Save';
        }
    }

    function syncFavoriteUiForPid(pid) {
        if (!pid) return;
        const isFav = favoriteIds.has(pid);
        document.querySelectorAll(`[data-property-id="${cssEscape(pid)}"] .fav-btn`).forEach((btn) => {
            setFavButtonState(btn, isFav, { compact: true });
        });
        if (modalDetails && activeModalPropertyId === pid) {
            const modalFavBtn = modalDetails.querySelector('[data-fav-toggle]');
            if (modalFavBtn) {
                setFavButtonState(modalFavBtn, isFav, { compact: false });
            }
        }
    }

    function updateFavoritesControls() {
        const count = favoriteIds.size;
        if (favoritesToggleBtn) {
            favoritesToggleBtn.classList.toggle('active', favoritesOnly);
            favoritesToggleBtn.setAttribute('aria-pressed', favoritesOnly ? 'true' : 'false');
            favoritesToggleBtn.textContent = `Saved (${count})${favoritesOnly ? ' · Showing' : ''}`;
        }
        if (favoritesSendBtn) {
            favoritesSendBtn.disabled = count === 0;
            favoritesSendBtn.classList.toggle('disabled', count === 0);
        }
    }

    function markListingImagesBroken(property) {
        const pid = propertyIdFor(property);
        if (!pid) return;
        if (imageOkCache.get(pid) === false) {
            return;
        }
        imageOkCache.set(pid, false);

        // Prevent re-adding this listing when "Load more" is clicked.
        currentProperties = currentProperties.filter((item) => propertyIdFor(item) !== pid);
        if (resultsCount) {
            resultsCount.textContent = String(currentProperties.length);
        }

        // Remove marker immediately (no full re-render).
        const marker = markerMap.get(pid);
        if (marker && markersGroup && typeof markersGroup.removeLayer === 'function') {
            try {
                markersGroup.removeLayer(marker);
            } catch (error) {
                // ignore
            }
        }
        markerMap.delete(pid);
    }

    function priceNumber(property) {
        const number = Number(property && property.price);
        return Number.isFinite(number) ? number : NaN;
    }

    function parseEuroAmount(text) {
        const match = toText(text).match(/€\s*([\d.,]+)/);
        if (!match) return null;
        const raw = match[1];
        const normalized = raw.replace(/\./g, '').replace(/,/g, '');
        const number = Number(normalized);
        return Number.isFinite(number) ? number : null;
    }

    function parseDistanceToMeters(valueText) {
        const text = toText(valueText).trim();
        if (!text) return null;
        const match = text.match(/([\d.,]+)\s*(m|meter|meters|km)\b/i);
        if (!match) return null;
        const raw = match[1];
        const unit = match[2].toLowerCase();
        const number = Number(raw.replace(/\./g, '').replace(/,/g, '.'));
        if (!Number.isFinite(number)) return null;
        if (unit === 'km') return Math.round(number * 1000);
        return Math.round(number);
    }

    function beachDistanceMetersFor(property) {
        const features = featuresFor(property);
        for (const feature of features) {
            const text = toText(feature);
            const m = text.match(/\bBeach\s*:\s*([\d.,]+)\s*Meters?\b/i);
            if (m) {
                const number = Number(m[1].replace(/\./g, '').replace(/,/g, ''));
                if (Number.isFinite(number)) return Math.round(number);
            }
        }

        const description = toText(property && property.description);
        const seaMatch = description.match(/\bDISTANCE\s+TO\s+THE\s+SEA\s*:\s*([^\n\r<]+)\b/i);
        if (seaMatch) {
            const meters = parseDistanceToMeters(seaMatch[1]);
            if (meters !== null) return meters;
        }

        const alt = description.match(/\b(?:distance\s+to\s+(?:the\s+)?(?:sea|beach))\b[^0-9]{0,20}([\d.,]+\s*(?:m|km))\b/i);
        if (alt) {
            const meters = parseDistanceToMeters(alt[1]);
            if (meters !== null) return meters;
        }

        return null;
    }

    function hasSeaView(property) {
        const featuresText = normalize(featuresFor(property).join(' '));
        const descText = normalize(property && property.description);
        const combined = `${featuresText} ${descText}`;
        return combined.includes('sea view')
            || combined.includes('sea views')
            || combined.includes('ocean view')
            || combined.includes('vistas al mar')
            || combined.includes('distant sea views')
            || combined.includes('seaview');
    }

    function rentPriceFromDescription(description) {
        const text = toText(description);
        const monthly = text.match(/Monthly\s+rent\s*:\s*€\s*[\d.,]+/i);
        if (monthly) {
            return parseEuroAmount(monthly[0]);
        }
        const rentAlt = text.match(/\bRent\b[^€]{0,24}€\s*[\d.,]+/i);
        if (rentAlt) {
            return parseEuroAmount(rentAlt[0]);
        }
        return null;
    }

    function listingModeFor(property) {
        const override = listingOverrideFor(property);
        if (override && override.mode) {
            return override.mode;
        }

        const explicitMode = normalize(property && (property.listing_mode || property.listingMode || property.mode));
        if (explicitMode === 'sale' || explicitMode === 'rent' || explicitMode === 'traspaso' || explicitMode === 'business') {
            return explicitMode;
        }

        const text = normalize(property && property.description);
        const isTransfer = text.includes('traspaso')
            || text.includes('being transferred')
            || text.includes('is being transferred')
            || text.includes('is transferred');
        if (isTransfer) {
            return 'traspaso';
        }
        const salePrice = Number(property && property.price);
        if (Number.isFinite(salePrice) && salePrice > 0) {
            return 'sale';
        }
        if (text.includes('available for rent') || text.includes('for rent') || text.includes('monthly rent')) {
            return 'rent';
        }
        const rentPrice = rentPriceFromDescription(property && property.description);
        return rentPrice ? 'rent' : 'sale';
    }

    function rentPeriodFor(property) {
        const explicit = normalize(property && (property.rent_period || property.rentPeriod));
        if (explicit === 'night' || explicit === 'day' || explicit === 'week' || explicit === 'month') {
            return explicit;
        }

        const text = normalize(property && property.description);
        if (!text) return 'month';
        if (text.includes('per night') || text.includes('/night') || text.includes('nightly')) return 'night';
        // Avoid matching "opens daily" or similar phrases that are not about rental periods.
        if (text.includes('per day') || text.includes('/day') || text.includes('daily rent') || text.includes('daily rate')) return 'day';
        if (text.includes('per week') || text.includes('/week') || text.includes('weekly')) return 'week';
        // Spanish hints
        if (text.includes('alquiler vacacional') || text.includes('licencia turistica') || text.includes('turistic')) return 'week';
        if (text.includes('larga temporada') || text.includes('long term')) return 'month';
        return 'month';
    }

    function isVacationRental(property) {
        const text = normalize(property && property.description);
        return text.includes('vacation rental')
            || text.includes('holiday rental')
            || text.includes('short term')
            || text.includes('short-term')
            || text.includes('airbnb')
            || text.includes('alquiler vacacional')
            || text.includes('licencia turistica')
            || text.includes('tourist license')
            || rentPeriodFor(property) === 'night'
            || rentPeriodFor(property) === 'day'
            || rentPeriodFor(property) === 'week';
    }

    function isLongTermRental(property) {
        const text = normalize(property && property.description);
        if (!text) return false;
        if (text.includes('long term') || text.includes('long-term') || text.includes('larga temporada')) return true;
        // monthly rent phrasing usually implies long-term
        if (text.includes('monthly rent')) return true;
        // If it's rent but not vacation signals, treat as long-term
        return listingModeFor(property) === 'rent' && !isVacationRental(property);
    }

    function isNewBuild(property) {
        const text = normalize(property && property.description);
        if (!text) return false;

        // Strong negative signals for resale listings.
        if (text.includes('resale') || text.includes('resale property') || text.includes('second-hand') || text.includes('second hand')
            || text.includes('reventa') || text.includes('segunda mano')) {
            return false;
        }

        const positive = text.includes('new build')
            || text.includes('newbuild')
            || text.includes('obra nueva')
            || text.includes('off plan')
            || text.includes('off-plan')
            || text.includes('under construction')
            || text.includes('from the developer')
            || text.includes('direct from the developer')
            || text.includes('promotor');

        // If the description includes a build/completion year, ensure it is recent enough.
        const yearMatch = text.match(/\b(?:year built|built in|completed in|construction)\s*(?:in|:)?\s*(19\d{2}|20\d{2})\b/i);
        if (yearMatch) {
            const year = Number(yearMatch[1]);
            const currentYear = new Date().getFullYear();
            // "New build" generally means very recent stock; keep a conservative window.
            if (Number.isFinite(year) && year < currentYear - 4) {
                return false;
            }
            // If recent year is present and no resale flags, accept as new build.
            if (Number.isFinite(year) && year >= currentYear - 4) {
                return true;
            }
        }

        return positive;
    }

    function isInvestmentDeal(property) {
        const typeNorm = normalize(property && property.type);
        const text = normalize(property && property.description);
        if (typeNorm.includes('land') || typeNorm.includes('plot') || typeNorm.includes('parcel')) return true;
        return text.includes('investment')
            || text.includes('investor')
            || text.includes('roi')
            || text.includes('yield')
            || text.includes('hotel')
            || text.includes('hostel')
            || text.includes('opportunity to build')
            || text.includes('build your')
            || text.includes('building plot')
            || text.includes('plot')
            || text.includes('land');
    }

    function operationFor(property) {
        const mode = listingModeFor(property); // sale | rent
        if (mode === 'rent') {
            return isVacationRental(property) ? 'rent_vacation' : 'rent_longterm';
        }
        return 'sale';
    }

    function listingPriceNumber(property) {
        const override = listingOverrideFor(property);
        if (override && Number.isFinite(Number(override.price)) && Number(override.price) > 0) {
            return Number(override.price);
        }

        const mode = listingModeFor(property);
        if (mode === 'rent') {
            const explicitRent = Number(property && (property.rent_price || property.rentPrice || property.price_rent));
            if (Number.isFinite(explicitRent) && explicitRent > 0) {
                return explicitRent;
            }
        }

        const salePrice = Number(property && property.price);
        if (Number.isFinite(salePrice) && salePrice > 0) {
            return salePrice;
        }

        // Try to parse a traspaso/transfer price from description if present.
        const text = toText(property && property.description);
        const transferMatch = text.match(/\b(?:traspaso|transfer(?:red)?|being transferred)\b[^€\d]{0,40}€\s*([\d.,]+)/i);
        if (transferMatch) {
            const parsed = parseEuroAmount(`€ ${transferMatch[1]}`);
            if (Number.isFinite(parsed) && parsed > 0) {
                return parsed;
            }
        }

        const rentPrice = rentPriceFromDescription(property && property.description);
        return rentPrice ?? NaN;
    }

    function formatListingPrice(property) {
        const mode = listingModeFor(property);
        const number = listingPriceNumber(property);
        if (!Number.isFinite(number)) {
            return 'Price on request';
        }
        const formatted = formatPrice(number);
        if (mode === 'rent') {
            const period = rentPeriodFor(property);
            if (period === 'night') return `${formatted} / night`;
            if (period === 'day') return `${formatted} / day`;
            if (period === 'week') return `${formatted} / week`;
            return `${formatted} / month`;
        }
        if (mode === 'traspaso') {
            const override = listingOverrideFor(property);
            if (override && Number.isFinite(Number(override.monthlyRent)) && Number(override.monthlyRent) > 0) {
                return `${formatted} (Traspaso) + ${formatPrice(Number(override.monthlyRent))} / month rent`;
            }
            return `${formatted} (Traspaso)`;
        }
        return formatted;
    }

    function formatListingMarkerText(property) {
        const mode = listingModeFor(property);
        const number = listingPriceNumber(property);
        if (!Number.isFinite(number)) {
            return mode === 'rent' ? 'Rent' : 'N/A';
        }
        if (mode === 'rent') {
            const period = rentPeriodFor(property);
            const suffix = period === 'night' ? '/nt' : period === 'day' ? '/dy' : period === 'week' ? '/wk' : '/mo';
            if (number >= 1000) {
                return `${(number / 1000).toFixed(1).replace('.0', '')}k${suffix}`;
            }
            return `${Math.round(number)}€${suffix}`;
        }
        if (mode === 'traspaso') {
            return formatMarkerPrice(number);
        }
        return formatMarkerPrice(number);
    }

    function formatPrice(price) {
        const number = Number(price);
        if (!Number.isFinite(number) || number <= 0) {
            return 'Price on request';
        }
        return new Intl.NumberFormat('en-IE', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0
        }).format(number);
    }

    function formatMarkerPrice(price) {
        const number = Number(price);
        if (!Number.isFinite(number)) {
            return 'N/A';
        }
        if (number >= 1000000) {
            return `${(number / 1000000).toFixed(1).replace('.0', '')}M€`;
        }
        return `${Math.round(number / 1000)}k€`;
    }

    function decodeHtmlEntities(value) {
        const parser = document.createElement('textarea');
        parser.innerHTML = toText(value);
        return parser.value;
    }

    function escapeHtml(value) {
        return toText(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function isHeadingLine(line) {
        if (!line) {
            return false;
        }
        const compact = line.replace(/[^A-Za-z]/g, '');
        return compact.length > 2
            && compact.length <= 80
            && line === line.toUpperCase();
    }

    function headingEmoji(line) {
        const upperLine = line.toUpperCase();
        if (upperLine.includes('IMPORTANT')) return '🛠️';
        if (upperLine.includes('ECONOMY')) return '💶';
        if (upperLine.includes('AREA')) return '📍';
        if (upperLine.includes('DETAIL')) return '📌';
        if (upperLine.includes('INVEST')) return '📈';
        if (upperLine.includes('SEPARATE')) return '🏡';
        if (upperLine.includes('OUTDOOR') || upperLine.includes('POOL')) return '🌴';
        return '✨';
    }

    function splitSentenceChunks(line) {
        return line
            .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
            .map((chunk) => chunk.trim())
            .filter(Boolean);
    }

    function formatDescriptionHtml(rawDescription) {
        let text = decodeHtmlEntities(rawDescription)
            .replace(/&#13;/g, '\n')
            .replace(/\r\n?/g, '\n')
            .replace(/\u00a0/g, ' ')
            .trim();

        // Strip feed-injected "Read more/less" toggles and any embedded JS source.
        if (text) {
            // Some feeds append raw JS (document.getElementById / addEventListener) directly to the description.
            const jsStart = text.search(/(?:const\s+toggleBtn\s*=|document\.getElementById\(|toggleBtn\.addEventListener|readLessBtn\.addEventListener)/i);
            if (jsStart !== -1) {
                text = text.slice(0, jsStart).trim();
            }
            // Remove the literal tokens, but keep spacing sane.
            text = text
                .replace(/\bRead more\b/gi, '\n')
                .replace(/\bRead less\b/gi, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        if (!text) {
            return '<p>Property details coming soon.</p>';
        }

        const hardSections = [
            'IMPORTANT DETAILS',
            'ECONOMY',
            'AREA CIUDAD QUESADA',
            'Separate flat - perfect for guests or rentals',
            'Private outdoor area with pool and multiple zones'
        ];

        hardSections.forEach((section) => {
            const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            text = text.replace(new RegExp(`\\s*${escaped}\\s*`, 'g'), `\n\n${section}\n`);
        });

        // If a heading is followed immediately by a sentence without whitespace,
        // insert a newline so heading detection can pick it up.
        text = text.replace(/([A-Z][A-Z0-9\\s\\-]{12,})([A-Z][a-z])/g, '$1\n$2');

        text = text
            .replace(/([.!?])([A-Z])/g, '$1\n$2')
            .replace(/([a-z0-9])([A-Z][a-z])/g, '$1 $2')
            .replace(/:\s*(\d+\s*(?:m|km|GB))/g, ':\n$1')
            .replace(/(\d+\s*(?:m|km)\s+to\b)/g, '\n$1')
            .replace(/\n{3,}/g, '\n\n');

        const lines = text
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

        const blocks = [];
        let listItems = [];

        const flushList = () => {
            if (listItems.length === 0) {
                return;
            }
            blocks.push(`<ul class="desc-list">${listItems.join('')}</ul>`);
            listItems = [];
        };

        lines.forEach((line) => {
            if (line.includes('|') && (line.match(/\|/g) || []).length >= 2 && line.length < 200) {
                const parts = line.split('|').map((part) => part.trim()).filter(Boolean);
                if (parts.length > 1) {
                    parts.forEach((part) => listItems.push(`<li>${escapeHtml(part)}</li>`));
                    return;
                }
            }

            if (isHeadingLine(line)) {
                flushList();
                blocks.push(`<h4 class="desc-heading">${headingEmoji(line)} ${escapeHtml(line)}</h4>`);
                return;
            }

            if (/^[-•]\s*/.test(line)) {
                const item = line.replace(/^[-•]\s*/, '').trim();
                if (item) {
                    listItems.push(`<li>${escapeHtml(item)}</li>`);
                }
                return;
            }

            if (/^[A-Za-z][^:]{1,40}:/.test(line) && line.length < 120) {
                listItems.push(`<li>${escapeHtml(line)}</li>`);
                return;
            }

            const sentenceChunks = splitSentenceChunks(line);
            if (line.length > 180 && sentenceChunks.length >= 3) {
                sentenceChunks.forEach((chunk) => {
                    listItems.push(`<li>${escapeHtml(chunk)}</li>`);
                });
                return;
            }

            flushList();
            blocks.push(`<p>${escapeHtml(line)}</p>`);
        });

        flushList();
        return blocks.join('');
    }

    function buildPropertyLink(reference) {
        // Always generate a stable, shareable URL for this listing.
        const url = new URL('properties.html', window.location.href);
        if (reference) {
            url.searchParams.set('ref', reference);
        } else {
            url.searchParams.delete('ref');
        }
        return url.toString();
    }

    function favoriteIdFor(property) {
        return propertyIdFor(property);
    }

    function isFavorited(property) {
        const pid = favoriteIdFor(property);
        return Boolean(pid && favoriteIds.has(pid));
    }

    function setFavorited(property, nextValue) {
        const pid = favoriteIdFor(property);
        if (!pid) return false;
        const has = favoriteIds.has(pid);
        const shouldHave = Boolean(nextValue);
        if (has === shouldHave) return has;
        if (shouldHave) {
            favoriteIds.add(pid);
        } else {
            favoriteIds.delete(pid);
        }
        persistFavoriteIds(favoriteIds);
        return shouldHave;
    }

    function toggleFavorited(property) {
        return setFavorited(property, !isFavorited(property));
    }

    function buildFavoritesMailto() {
        const subject = encodeURIComponent('My saved listings');
        const lines = [];
        lines.push('Hello Spanish Coast Properties,');
        lines.push('');
        lines.push('Here are the listings I saved in the app:');
        lines.push('');

        const favIds = Array.from(favoriteIds);
        favIds.forEach((pid) => {
            const property = propertyById.get(pid);
            const reference = toText(property && property.ref).trim() || pid;
            const title = `${toText(property && property.type, 'Listing')} in ${toText(property && property.town, '')}`.trim();
            const link = buildPropertyLink(reference);
            lines.push(`- ${reference}${title ? ` (${title})` : ''}: ${link}`);
        });

        lines.push('');
        lines.push('My name:');
        lines.push('My phone/email:');
        lines.push('');
        lines.push('Thank you.');

        const body = encodeURIComponent(lines.join('\n'));
        return `mailto:info@spanishcoastproperties.com?subject=${subject}&body=${body}`;
    }

    function getSupabase() {
        return window.scpSupabase || null;
    }

    async function supabaseGetRole(client, userId) {
        try {
            const { data, error } = await client
                .from('profiles')
                .select('role')
                .eq('user_id', userId)
                .maybeSingle();
            if (error) return '';
            return toText(data && data.role).trim();
        } catch (error) {
            return '';
        }
    }

    const originalRefCache = new Map(); // scpRef -> { original_ref, source } | null

    function isPrivilegedRole(role) {
        const r = toText(role).trim().toLowerCase();
        return ['admin', 'partner', 'agency_admin', 'agent', 'developer', 'collaborator'].includes(r);
    }

    function originalRefSourceLabel(source) {
        const s = toText(source).trim().toLowerCase();
        if (!s) return '';
        if (s.includes('inmovilla')) return 'IMV';
        if (s.includes('idealista')) return 'IDE';
        if (s.includes('kyero')) return 'KYERO';
        if (s.includes('thinkspain')) return 'THINK';
        const up = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!up) return '';
        return up.length <= 8 ? up : up.slice(0, 8);
    }

    async function copyTextToClipboard(text) {
        const v = toText(text);
        if (!v.trim()) return false;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(v);
                return true;
            }
        } catch {
            // ignore
        }
        try {
            window.prompt('Copy:', v);
            return true;
        } catch {
            return false;
        }
    }

    async function supabaseMaybeGetOriginalRef(client, userId, scpRef) {
        const ref = toText(scpRef).trim();
        if (!ref) return null;
        if (originalRefCache.has(ref)) return originalRefCache.get(ref);

        let role = toText(supabaseRole).trim();
        if (!role && userId) {
            role = await supabaseGetRole(client, userId);
        }
        if (!isPrivilegedRole(role)) {
            originalRefCache.set(ref, null);
            return null;
        }

        try {
            const { data, error } = await client
                .from('listing_ref_map')
                .select('original_ref,source')
                .eq('scp_ref', ref)
                .maybeSingle();
            if (error || !data) {
                originalRefCache.set(ref, null);
                return null;
            }
            const original_ref = toText(data.original_ref).trim();
            if (!original_ref) {
                originalRefCache.set(ref, null);
                return null;
            }
            const mapped = { original_ref, source: toText(data.source).trim() };
            originalRefCache.set(ref, mapped);
            return mapped;
        } catch (error) {
            originalRefCache.set(ref, null);
            return null;
        }
    }

    async function supabaseFetchFavorites(client, userId) {
        try {
            const { data, error } = await client
                .from('favourites')
                .select('property_id')
                .eq('user_id', userId);
            if (error) return [];
            if (!Array.isArray(data)) return [];
            return data.map((row) => idKey(row && row.property_id)).filter(Boolean);
        } catch (error) {
            return [];
        }
    }

    async function supabaseUpsertFavorite(client, user, property) {
        const pid = propertyIdFor(property);
        if (!pid) return;
        const reference = toText(property && property.ref).trim();
        const town = toText(property && property.town).trim();
        const type = toText(property && property.type).trim();
        const price = listingPriceNumber(property);
        const image = (() => {
            const urls = imageUrlsFor(property);
            return Array.isArray(urls) && urls.length ? urls[0] : null;
        })();

        const payloadBase = {
            user_id: user.id,
            user_email: toText(user.email).trim() || null,
            property_id: pid,
            property_ref: reference || null,
            property_link: buildPropertyLink(reference || pid),
            town: town || null,
            type: type || null,
            price: Number.isFinite(price) ? price : null
        };

        try {
            const attempt = async (withImage) => {
                const payload = withImage
                    ? { ...payloadBase, property_image: image || null }
                    : payloadBase;
                return await client.from('favourites').upsert(payload, { onConflict: 'user_id,property_id' });
            };

            let out = await attempt(true);
            if (out && out.error) {
                const msg = String(out.error.message || '').toLowerCase();
                // Backwards compatible with older schemas that don't have the column yet.
                if (msg.includes('column') && msg.includes('property_image')) {
                    out = await attempt(false);
                }
            }
        } catch (error) {
            // ignore
        }
    }

	    async function supabaseDeleteFavorite(client, user, propertyId) {
	        if (!propertyId) return;
	        try {
	            await client
                .from('favourites')
                .delete()
                .eq('user_id', user.id)
                .eq('property_id', propertyId);
        } catch (error) {
            // ignore
	        }
	    }

	    const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
	    const isAbortLikeError = (error) => {
	        const msg = error && error.message ? String(error.message) : String(error || '');
	        const lower = msg.toLowerCase();
	        return lower.includes('abort') || lower.includes('aborted') || lower.includes('signal');
	    };

	    async function supabaseGetSessionSafe(client, { retries = 2 } = {}) {
	        if (!client) return { data: { session: null } };
	        let lastErr = null;
	        for (let i = 0; i <= retries; i++) {
	            try {
	                return await client.auth.getSession();
	            } catch (error) {
	                lastErr = error;
	                if (i < retries && isAbortLikeError(error)) {
	                    await sleep(140 * (i + 1));
	                    continue;
	                }
	                throw error;
	            }
	        }
	        throw lastErr || new Error('Failed to read session');
	    }

	    function refreshOriginalRefButtonsUi() {
	        const allowed = Boolean(supabaseClient && supabaseUser) && isPrivilegedRole(supabaseRole);
	        const buttons = document.querySelectorAll('button[data-action="show-original-ref"]');
	        buttons.forEach((btn) => {
	            const ref = toText(btn.dataset.scpRef).trim();
	            const ok = allowed && ref && !ref.toLowerCase().includes('unavailable');
	            btn.style.display = ok ? 'inline-flex' : 'none';
	        });
	        if (!allowed) {
	            document.querySelectorAll('[data-card-original-ref]').forEach((span) => {
	                span.style.display = 'none';
	                span.textContent = '';
	                span.dataset.originalRef = '';
	            });
	        }
	    }

	    async function initSupabaseFavoritesSync() {
	        const client = getSupabase();
	        supabaseClient = client;
	        if (!client) return;

	        try {
	            const { data } = await supabaseGetSessionSafe(client);
	            supabaseUser = data && data.session ? data.session.user : null;
	            supabaseRole = supabaseUser ? await supabaseGetRole(client, supabaseUser.id) : '';
	            refreshOriginalRefButtonsUi();

	            if (supabaseUser) {
                const localBefore = new Set(Array.from(favoriteIds));
                const backendIds = await supabaseFetchFavorites(client, supabaseUser.id);
                const backendSet = new Set(backendIds);
                const mergedAll = new Set([...backendSet, ...Array.from(localBefore)]);
                favoriteIds = mergedAll;
                persistFavoriteIds(favoriteIds);
                updateFavoritesControls();
                // Migrate any locally-saved favourites to the backend (best effort).
                Array.from(localBefore).filter((pid) => !backendSet.has(pid)).forEach((pid) => {
                    const property = propertyById.get(pid);
                    if (property) supabaseUpsertFavorite(client, supabaseUser, property);
                });
                // Refresh UI in case the user is currently in favourites-only mode.
                filterProperties();
            }
        } catch (error) {
            // ignore
        }

        try {
            client.auth.onAuthStateChange(async (event, session) => {
                supabaseUser = session && session.user ? session.user : null;
                supabaseRole = supabaseUser ? await supabaseGetRole(client, supabaseUser.id) : '';
                originalRefCache.clear();
                refreshOriginalRefButtonsUi();
                if (!supabaseUser) {
                    updateFavoritesControls();
                    return;
                }
                const backendIds = await supabaseFetchFavorites(client, supabaseUser.id);
                favoriteIds = new Set([...backendIds, ...Array.from(favoriteIds)]);
                persistFavoriteIds(favoriteIds);
                updateFavoritesControls();
                filterProperties();
            });
        } catch (error) {
            // ignore
        }
    }

    function sourceUrlFor(property) {
        const url = toText(property && (property.source_url || property.sourceUrl)).trim();
        return url || '';
    }

    function setBrowserRef(reference, { push = false, state = {} } = {}) {
        if (!window.history) return;
        const fn = push ? window.history.pushState : window.history.replaceState;
        if (typeof fn !== 'function') return;

        const url = new URL(window.location.href);
        if (reference) {
            url.searchParams.set('ref', reference);
        } else {
            url.searchParams.delete('ref');
        }
        fn.call(window.history, state || {}, '', url.toString());
    }

    let autoRefFromUrl = '';

    function setActiveNavLink(sectionKey) {
        navLinks.forEach((link) => {
            link.classList.toggle('active', link.dataset.section === sectionKey);
        });
    }

    function showSection(sectionKey) {
        const mapping = {
            home: homeSection,
            properties: propertiesSection,
            businesses: businessesSection,
            vehicles: vehiclesSection
        };

        Object.entries(mapping).forEach(([key, el]) => {
            if (!el) return;
            el.classList.toggle('active', key === sectionKey);
        });
    }

    function ensurePropertiesInitialized() {
        if (propertiesInitialized) {
            return;
        }
        initMap();
        generateCityButtons();
        filterProperties();
        applyOperationFromUrl();
        applyRefFromUrl();
        propertiesInitialized = true;
    }

    function setActiveSection(sectionKey, { pushUrl = true } = {}) {
        const next = ['home', 'properties', 'businesses', 'vehicles'].includes(sectionKey)
            ? sectionKey
            : 'home';

        activeSection = next;
        document.body.dataset.section = next;
        if (next !== 'properties') {
            document.body.classList.remove('filters-open');
        }
        setActiveNavLink(next);
        showSection(next);

        if (pushUrl && window.history && typeof window.history.pushState === 'function') {
            const url = new URL(window.location.href);
            url.searchParams.set('section', next);
            if (next !== 'properties') {
                url.searchParams.delete('ref');
            }
            window.history.pushState({}, '', url.toString());
        }

        if (next === 'properties') {
            ensurePropertiesInitialized();
            if (map && typeof map.invalidateSize === 'function') {
                window.setTimeout(() => map.invalidateSize(), 220);
            }
        }
    }

    function renderEmptyCard(message) {
        return `
            <div class="catalog-card">
                <div class="catalog-content">
                    <h3>Coming soon</h3>
                    <div class="catalog-meta">${escapeHtml(message)}</div>
                </div>
            </div>
        `;
    }

    function renderCatalogs() {
        if (businessGrid) {
            if (businessItems.length === 0) {
                businessGrid.innerHTML = renderEmptyCard('Add your business listings to window.businessData and they will appear here.');
            } else {
                businessGrid.innerHTML = businessItems.map((item) => `
                    <div class="catalog-card">
                        <div class="catalog-content">
                            <h3>${escapeHtml(toText(item.title, 'Business'))}</h3>
                            <div class="catalog-meta">${escapeHtml(toText(item.location, 'Costa Blanca South'))}</div>
                        </div>
                    </div>
                `).join('');
            }
        }

        if (vehicleGrid) {
            if (vehicleItems.length === 0) {
                vehicleGrid.innerHTML = renderEmptyCard('Add your vehicle inventory to window.vehicleData and it will appear here.');
            } else {
                vehicleGrid.innerHTML = vehicleItems.map((item) => `
                    <div class="catalog-card">
                        <div class="catalog-content">
                            <h3>${escapeHtml(toText(item.title, 'Vehicle'))}</h3>
                            <div class="catalog-meta">${escapeHtml(toText(item.category, 'Cars & Boats'))}</div>
                        </div>
                    </div>
                `).join('');
            }
        }
    }

    function applyRefFromUrl() {
        const urlRef = new URLSearchParams(window.location.search).get('ref');
        const reference = toText(urlRef).trim();
        if (!reference) {
            return;
        }

        autoRefFromUrl = reference;
        refQuery = reference;
        if (refSearchInput) {
            refSearchInput.value = reference;
        }
        filterProperties();

        const exactMatch = currentProperties.find((property) => normalize(property.ref) === normalize(reference));
        if (exactMatch) {
            const propertyId = propertyIdFor(exactMatch);
            if (!propertyId || imageOkCache.get(propertyId) !== false) {
                openPropertyModal(exactMatch, { syncUrl: false });
            }
        }
    }

    function applyOperationFromUrl() {
        const op = toText(new URLSearchParams(window.location.search).get('op')).trim();
        if (!op) return;
        const allowed = new Set(['any', 'sale', 'rent_longterm', 'rent_vacation']);
        if (!allowed.has(op)) return;
        operationMode = op;
        if (dealFilterEl) {
            dealFilterEl.value = op;
        }
        filterProperties();
    }

    function updateActiveCityButton(selectedValue) {
        if (!cityButtonsContainer) {
            return;
        }
        const allButtons = cityButtonsContainer.querySelectorAll('.city-btn');
        allButtons.forEach((item) => {
            item.classList.toggle('active', item.dataset.city === selectedValue);
        });
    }

    function selectCity(value) {
        selectedCity = value;
        updateActiveCityButton(value);
        filterProperties();
    }

    function matchesDestination(property, destinationKey) {
        const town = normalize(property.town);
        if (destinationKey === 'all') {
            return true;
        }
        if (destinationKey === 'torrevieja') {
            return town === 'torrevieja';
        }
        if (destinationKey === 'orihuela-costa') {
            return [
                'orihuela costa',
                'campoamor',
                'mil palmeras',
                'punta prima',
                'playa flamenca',
                'la zenia',
                'villamartin',
                'dehesa de campoamor'
            ].includes(town);
        }
        if (destinationKey === 'guardamar') {
            return town.includes('guardamar');
        }
        if (destinationKey === 'quesada') {
            return town === 'ciudad quesada' || town === 'rojales';
        }
        return true;
    }

    function setCardActive(propertyId, isActive) {
        const key = idKey(propertyId);
        if (!key) {
            return;
        }

        const card = document.querySelector(`[data-property-id="${cssEscape(key)}"]`);
        if (!card) {
            return;
        }

        if (isActive) {
            document.querySelectorAll('.property-card.linked-active').forEach((item) => {
                if (item !== card) {
                    item.classList.remove('linked-active');
                }
            });
        }

        card.classList.toggle('linked-active', isActive);
    }

    function setMarkerActive(propertyId, isActive) {
        const marker = markerMap.get(idKey(propertyId));
        if (!marker) {
            return;
        }
        const markerElement = typeof marker.getElement === 'function'
            ? marker.getElement()
            : marker._icon;
        if (markerElement) {
            markerElement.classList.toggle('marker-active', isActive);
        }
    }

    function eurPerSqmFor(property) {
        const built = builtAreaFor(property);
        const mode = listingModeFor(property);
        const price = listingPriceNumber(property);
        if (!Number.isFinite(price) || price <= 0 || built <= 0) {
            return null;
        }
        const perSqm = Math.round(price / built);
        if (mode === 'rent') {
            return `€${numberFormat.format(perSqm)}/m2/mo`;
        }
        return `€${numberFormat.format(perSqm)}/m2`;
    }

    function eurPerSqmNumberFor(property) {
        const built = builtAreaFor(property);
        const price = listingPriceNumber(property);
        if (!Number.isFinite(price) || price <= 0 || built <= 0) return NaN;
        return price / built;
    }

    function sourceIndexFor(property) {
        const pid = propertyIdFor(property);
        const idx = pid ? sourceIndexById.get(pid) : null;
        return Number.isFinite(idx) ? idx : 0;
    }

    function compareNullableNumbers(a, b, direction = 1) {
        const ax = Number.isFinite(a) ? a : Infinity;
        const bx = Number.isFinite(b) ? b : Infinity;
        return (ax - bx) * direction;
    }

    function sortProperties(list) {
        const mode = toText(sortMode, 'featured');
        if (mode === 'featured') {
            return list;
        }
        const sorted = list.slice();
        sorted.sort((pa, pb) => {
            if (mode === 'date_desc') return sourceIndexFor(pb) - sourceIndexFor(pa);
            if (mode === 'date_asc') return sourceIndexFor(pa) - sourceIndexFor(pb);

            if (mode === 'price_asc') return compareNullableNumbers(listingPriceNumber(pa), listingPriceNumber(pb), 1);
            if (mode === 'price_desc') return compareNullableNumbers(listingPriceNumber(pa), listingPriceNumber(pb), -1);

            if (mode === 'beds_desc') return (Number(pb && pb.beds) || 0) - (Number(pa && pa.beds) || 0);
            if (mode === 'area_desc') return builtAreaFor(pb) - builtAreaFor(pa);

            if (mode === 'eur_sqm_asc') return compareNullableNumbers(eurPerSqmNumberFor(pa), eurPerSqmNumberFor(pb), 1);

            if (mode === 'beach_asc') {
                const da = beachDistanceMetersFor(pa);
                const db = beachDistanceMetersFor(pb);
                return compareNullableNumbers(da, db, 1);
            }
            return 0;
        });
        return sorted;
    }

    function filterProperties() {
        const loweredSearch = normalize(searchQuery);
        const loweredRef = normalize(refQuery);

        currentProperties = allProperties.filter((property) => {
            const ref = normalize(property.ref);
            const town = normalize(property.town);
            const province = normalize(property.province);
            const type = normalize(property.type);
            const description = normalize(property.description);
            const features = featuresFor(property).join(' ').toLowerCase();

            const propertyPrice = listingPriceNumber(property);
            const propertyBeds = Number(property.beds) || 0;
            const propertyBaths = Number(property.baths) || 0;

            const matchesRef = loweredRef === '' || ref.includes(loweredRef);
            const matchesCity = matchesDestination(property, selectedCity);
            const typeNorm = normalize(property.type);
            let matchesType = true;
            if (selectedType !== 'all') {
                const selectedNorm = normalize(selectedType);
                if (selectedNorm === 'new build') {
                    matchesType = isNewBuild(property);
                } else if (selectedNorm === 'investment') {
                    matchesType = isInvestmentDeal(property);
                } else if (selectedNorm === 'apartment') {
                    matchesType = typeNorm.includes('apartment') || typeNorm.includes('apartamento');
                } else if (selectedNorm === 'penthouse') {
                    matchesType = typeNorm.includes('penthouse');
                } else if (selectedNorm === 'town house') {
                    matchesType = typeNorm.includes('town house') || typeNorm.includes('casa');
                } else {
                    matchesType = typeNorm === selectedNorm || typeNorm.includes(selectedNorm);
                }
            }

            const matchesSearch = loweredSearch === ''
                || town.includes(loweredSearch)
                || province.includes(loweredSearch)
                || type.includes(loweredSearch)
                || description.includes(loweredSearch);

            const matchesPrice = maxPrice === 'any'
                || (Number.isFinite(propertyPrice) && propertyPrice <= Number(maxPrice));
            const matchesBeds = propertyBeds >= minBeds;
            const matchesBaths = propertyBaths >= minBaths;

            let matchesPool = true;
            if (poolFilter !== 'any') {
                if (poolFilter === 'pool') {
                    matchesPool = features.includes('pool') || features.includes('swimming');
                }
                if (poolFilter === 'private') {
                    matchesPool = features.includes('private pool')
                        || (features.includes('pool') && features.includes('private'));
                }
                if (poolFilter === 'communal') {
                    matchesPool = features.includes('communal pool')
                        || features.includes('community pool')
                        || features.includes('shared pool');
                }
            }

            const matchesParking = parkingFilter !== 'parking'
                || features.includes('parking')
                || features.includes('garage')
                || features.includes('carport');

            const maxBeach = maxBeachDistanceMeters === 'any' ? null : Number(maxBeachDistanceMeters);
            const distanceMeters = maxBeach ? beachDistanceMetersFor(property) : null;
            const matchesBeach = maxBeach === null
                || (Number.isFinite(distanceMeters) && distanceMeters <= maxBeach);

            const matchesSeaView = seaViewFilter === 'any'
                || (seaViewFilter === 'yes' && hasSeaView(property));

            const op = operationFor(property); // sale | rent_longterm | rent_vacation
            const matchesOperation = operationMode === 'any' || op === operationMode;

            const passesCoreFilters = matchesRef
                && matchesCity
                && matchesType
                && matchesOperation
                && matchesSearch
                && matchesPrice
                && matchesBeds
                && matchesBaths
                && matchesPool
                && matchesParking
                && matchesBeach
                && matchesSeaView;

            if (!passesCoreFilters) {
                return false;
            }

            // Never show a listing with no image URLs at all.
            const imageCandidates = imageUrlsFor(property);
            if (!imageCandidates.length) {
                return false;
            }

            // Hide only when we know images are broken. Otherwise show immediately and verify in background.
            const propertyId = propertyIdFor(property);
            const cached = propertyId ? imageOkCache.get(propertyId) : undefined;
            if (cached === false) {
                return false;
            }

            if (favoritesOnly) {
                const favId = propertyIdFor(property);
                if (!favId || !favoriteIds.has(favId)) {
                    return false;
                }
            }

            return true;
        });

        renderLimit = 60;
        renderProperties({ reset: true });
        mapDirty = true;
        if (isMapVisible()) {
            updateMapMarkers();
            mapDirty = false;
        }
    }

    function scheduleFilter(delayMs = 180) {
        if (filterTimer) {
            window.clearTimeout(filterTimer);
        }
        filterTimer = window.setTimeout(() => {
            filterProperties();
            filterTimer = null;
        }, delayMs);
    }

    function renderProperties({ reset = false } = {}) {
        if (!propertyGrid || !resultsCount) {
            return;
        }

        if (reset) {
            propertyGrid.innerHTML = '';
            renderedPropertyIds.clear();
            renderSequence = 0;
            loadingMore = false;
            if (loadMoreObserver) {
                try {
                    loadMoreObserver.disconnect();
                } catch (error) {
                    // ignore
                }
                loadMoreObserver = null;
            }
        }
        resultsCount.textContent = String(currentProperties.length);

        if (currentProperties.length === 0) {
            const refExact = normalize(refQuery);
            if (refExact) {
                const candidate = allProperties.find((property) => normalize(property.ref) === refExact);
                const pid = candidate ? propertyIdFor(candidate) : '';
                const cached = pid ? imageOkCache.get(pid) : undefined;
                if (cached === false) {
                    propertyGrid.innerHTML = '<p style="color:#94a3b8">This listing is hidden because its images are unavailable.</p>';
                    return;
                }
            }

            propertyGrid.innerHTML = '<p style="color:#94a3b8">No properties found for these filters.</p>';
            return;
        }

        const sorted = sortProperties(currentProperties);
        const visible = sorted.slice(0, Math.min(renderLimit, sorted.length));

        // Remove any prior load-more control before appending cards.
        const existingLoadMore = propertyGrid.querySelector('.load-more-btn');
        if (existingLoadMore) {
            existingLoadMore.remove();
        }

        visible.forEach((property) => {
            const pid = propertyIdFor(property);
            if (!pid) {
                return;
            }
            if (renderedPropertyIds.has(pid)) {
                return;
            }
            const card = document.createElement('div');
            card.className = 'property-card';
            card.style.animationDelay = `${(renderSequence % 6) * 0.08}s`;
            renderSequence += 1;
            card.dataset.propertyId = pid;
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');

            const imageCandidates = imageUrlsFor(property);
            if (!imageCandidates.length) {
                return;
            }
            const imageUrl = imageCandidates[0];

            const type = toText(property.type, 'Property');
            const reference = toText(property.ref).trim();
            const town = toText(property.town, 'Unknown Area');
            const province = toText(property.province, 'Alicante');
            const beds = Number(property.beds) || 0;
            const baths = Number(property.baths) || 0;
            const builtArea = builtAreaFor(property);
            const eurPerSqm = eurPerSqmFor(property);
            const listingMode = listingModeFor(property);
            const listingLabel = listingMode === 'rent'
                ? 'For Rent'
                : listingMode === 'traspaso'
                    ? 'Traspaso'
                    : 'For Sale';
            const isFav = favoriteIds.has(pid);

            card.innerHTML = `
                <div class="card-img-wrapper">
                    <img src="${imageUrl}" alt="${type}" loading="lazy">
                    <div class="card-badge">${type}</div>
                    <div class="card-status ${listingMode}">${listingLabel}</div>
                    <button type="button" class="fav-btn ${isFav ? 'is-fav' : ''}" aria-label="Save listing" aria-pressed="${isFav ? 'true' : 'false'}">${isFav ? '♥' : '♡'}</button>
                </div>
                <div class="card-content">
                    <div class="card-ref-row">
                        <div class="card-ref">
                            ${reference || 'Reference unavailable'}
                            <span class="card-orig-ref muted" data-card-original-ref style="display:none"></span>
                        </div>
                        <button type="button" class="ref-chip ref-chip--small" data-action="show-original-ref" style="display:none" aria-label="Show original reference" title="Show original reference">Orig</button>
                    </div>
                    <h3>${type} in ${town}</h3>
                    <div class="location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ${town}, ${province}
                    </div>
                    <div class="price">${formatListingPrice(property)}</div>
                    <div class="specs">
                        <div class="spec-item">🛏️ Beds ${beds}</div>
                        <div class="spec-item">🛁 Baths ${baths}</div>
                        <div class="spec-item">📐 Area ${builtArea}m2</div>
                        ${eurPerSqm ? `<div class="spec-item">📊 ${eurPerSqm}</div>` : ''}
                    </div>
                </div>
            `;

            const favBtn = card.querySelector('.fav-btn');
            if (favBtn) {
                setFavButtonState(favBtn, isFav, { compact: true });
                favBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const nowFav = toggleFavorited(property);
                    updateFavoritesControls();
                    syncFavoriteUiForPid(pid);
                    if (supabaseClient && supabaseUser) {
                        if (nowFav) {
                            supabaseUpsertFavorite(supabaseClient, supabaseUser, property);
                        } else {
                            supabaseDeleteFavorite(supabaseClient, supabaseUser, pid);
                        }
                    }
                    if (!nowFav && favoritesOnly) {
                        filterProperties();
                    }
                });
            }

            const origBtn = card.querySelector('button[data-action="show-original-ref"]');
            const origSpan = card.querySelector('[data-card-original-ref]');
            const updateOrigBtnVisibility = () => {
                if (!origBtn) return;
                origBtn.dataset.scpRef = reference || '';
                const allowed = Boolean(reference)
                    && Boolean(supabaseClient && supabaseUser)
                    && isPrivilegedRole(supabaseRole);
                origBtn.style.display = allowed ? 'inline-flex' : 'none';
            };
            updateOrigBtnVisibility();

            if (origBtn && origSpan) {
                origBtn.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    const client = supabaseClient || getSupabase();
                    if (!client) return;

                    let user = supabaseUser;
                    if (!user) {
                        try {
                            const { data } = await client.auth.getSession();
                            user = data && data.session ? data.session.user : null;
                        } catch {
                            user = null;
                        }
                    }
                    if (!user) return;
                    if (!isPrivilegedRole(supabaseRole)) return;
                    if (!reference) return;

                    const already = (origSpan.dataset.originalRef || '').trim();
                    if (already) {
                        const prev = origBtn.textContent;
                        await copyTextToClipboard(already);
                        origBtn.textContent = 'Copied';
                        window.setTimeout(() => { origBtn.textContent = prev || 'Copy'; }, 1200);
                        return;
                    }

                    const prevText = origBtn.textContent;
                    origBtn.disabled = true;
                    origBtn.textContent = '…';
                    try {
                        const mapped = await supabaseMaybeGetOriginalRef(client, user.id, reference);
                        if (!mapped || !mapped.original_ref) {
                            origBtn.textContent = 'No ref';
                            window.setTimeout(() => { origBtn.textContent = prevText || 'Orig'; }, 1300);
                            return;
                        }

                        const src = originalRefSourceLabel(mapped.source);
                        const label = src ? `${src}: ` : '';
                        const value = toText(mapped.original_ref).trim();
                        origSpan.textContent = `· ${label}${value}`;
                        origSpan.dataset.originalRef = value;
                        origSpan.style.display = 'inline';

                        await copyTextToClipboard(value);
                        origBtn.textContent = 'Copied';
                        window.setTimeout(() => { origBtn.textContent = 'Copy'; }, 1200);
                    } finally {
                        origBtn.disabled = false;
                    }
                });
            }

            card.addEventListener('click', () => {
                if (pid && imageOkCache.get(pid) === false) {
                    return;
                }
                openPropertyModal(property);
            });

            card.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                card.click();
            });

            const cardImg = card.querySelector('.card-img-wrapper img');
            attachImageFallback(cardImg, imageCandidates, {
                maxAttempts: 3,
                onAllFailed: () => {
                    markListingImagesBroken(property);
                    card.classList.add('listing-removed');
                    window.setTimeout(() => {
                        if (card && card.parentNode) {
                            card.parentNode.removeChild(card);
                        }
                    }, 260);
                }
            });

            card.addEventListener('mouseenter', () => {
                setCardActive(pid, true);
                setMarkerActive(pid, true);
            });

            card.addEventListener('mouseleave', () => {
                setCardActive(pid, false);
                setMarkerActive(pid, false);
            });

            propertyGrid.appendChild(card);
            animationObserver.observe(card);
            renderedPropertyIds.add(pid);
        });

        if (sorted.length > visible.length) {
            const loadMore = document.createElement('button');
            loadMore.type = 'button';
            loadMore.className = 'load-more-btn';
            loadMore.textContent = `Load more (${visible.length} / ${sorted.length})`;
            loadMore.addEventListener('click', () => {
                if (loadingMore) return;
                loadingMore = true;
                renderLimit = Math.min(sorted.length, renderLimit + RENDER_BATCH);
                renderProperties({ reset: false });
                loadingMore = false;
            });
            propertyGrid.appendChild(loadMore);

            // Auto-load on scroll for mobile-first UX, but keep the button for accessibility.
            if (typeof IntersectionObserver !== 'undefined') {
                if (!loadMoreObserver) {
                    loadMoreObserver = new IntersectionObserver((entries) => {
                        entries.forEach((entry) => {
                            if (!entry.isIntersecting) return;
                            if (loadingMore) return;
                            // Avoid hammering the main thread; defer to next frame.
                            window.requestAnimationFrame(() => loadMore.click());
                        });
                    }, { rootMargin: '600px 0px' });
                }
                try {
                    loadMoreObserver.observe(loadMore);
                } catch (error) {
                    // ignore
                }
            }
        } else if (loadMoreObserver) {
            try {
                loadMoreObserver.disconnect();
            } catch (error) {
                // ignore
            }
        }
    }

    function scrollToProperty(propertyId) {
        const card = document.querySelector(`[data-property-id="${propertyId}"]`);
        if (!card) {
            return;
        }
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlighted');
        window.setTimeout(() => card.classList.remove('highlighted'), 1800);
    }

    function initNearbySnapshot(areaEl, statusEl, { pid = '', town = '', province = '', latitude, longitude } = {}) {
        if (!areaEl) {
            return;
        }

        const t = (key, fallback, vars) => {
            try {
                if (window.SCP_I18N && typeof window.SCP_I18N.t === 'function') {
                    return window.SCP_I18N.t(key, vars);
                }
            } catch (error) {
                // ignore
            }
            if (fallback !== undefined) return toText(fallback);
            return toText(key);
        };

        const pickAreaCopy = (twn) => {
            const k = normalize(twn);
            if (k.includes('torrevieja')) return t('nearby.copy.torrevieja', 'Coastal city with beaches, a marina promenade, and a wide choice of shops and restaurants.');
            if (k.includes('guardamar')) return t('nearby.copy.guardamar', 'Known for long sandy beaches and the pine forest, with an easygoing coastal lifestyle.');
            if (k.includes('orihuela')) return t('nearby.copy.orihuela', 'Popular coastal area with beaches, golf options, and year-round services.');
            if (k.includes('quesada') || k.includes('ciudad quesada')) return t('nearby.copy.quesada', 'Residential area with golf nearby and quick access to the coast and larger towns.');
            if (k.includes('pilar')) return t('nearby.copy.pilar', 'Authentic Spanish town close to the coast, with beaches and everyday services nearby.');
            return t('nearby.copy.default', 'Costa Blanca South lifestyle with year-round services, coastal atmosphere, and great connectivity across the area.');
        };

        const lat = Number(latitude);
        const lon = Number(longitude);
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
                { icon: '📍', label: t('nearby.area', 'Area'), value: `${town}, ${province}` }
            ];
            if (approxAirport) {
                base.push({
                    icon: '✈️',
                    label: t('nearby.airport', 'Airport (ALC)'),
                    value: `~${formatKm(approxAirport)} (${driveMins(approxAirport) || t('nearby.approx', 'approx.')})`
                });
            }

            const items = Array.isArray(nearby) ? nearby : [];
            base.push(...items);
            return base;
        };

        const render = (items, note, { loading = false } = {}) => {
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

            if (statusEl) {
                statusEl.textContent = loading ? t('nearby.loading_short', 'Loading…') : '';
            }
        };

        const fallbackItems = buildItems([
            { icon: '🛒', label: t('nearby.shops', 'Shops'), value: t('nearby.fallback_shops', 'Nearby supermarkets and daily services (varies by exact street)') },
            { icon: '🏫', label: t('nearby.schools', 'Schools'), value: t('nearby.fallback_schools', 'Local schools in the area (varies by exact street)') },
            { icon: '🌳', label: t('nearby.parks', 'Parks'), value: t('nearby.fallback_parks', 'Green spaces and promenades nearby (varies by exact street)') }
        ]);

        // Initial render: immediate, then enhance with OSM if possible.
        render(fallbackItems, t('nearby.loading', 'Loading nearby amenities…'), { loading: true });

        const cached = readCache();
        if (cached && Array.isArray(cached.items)) {
            render(buildItems(cached.items), cached.note || t('nearby.note', 'Distances are approximate (straight-line). Data: OpenStreetMap contributors.'), { loading: false });
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
            const timeout = window.setTimeout(() => { try { if (ctrl) ctrl.abort(); } catch { } }, 12000);
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
                window.clearTimeout(timeout);
            }
        };

        // Fetch and enhance in the background.
        (async () => {
            const out = await fetchOsmNearby();
            if (!out || !Array.isArray(out.items) || !out.items.length) {
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                    render(fallbackItems, t('nearby.unavailable', 'Nearby info may be limited for this listing.'), { loading: false });
                }
                return;
            }
            writeCache(out);
            if (activeModalPropertyId !== pid) return;
            if (!document.body.contains(areaEl)) return;
            render(buildItems(out.items), out.note, { loading: false });
        })();
    }

    function openPropertyModal(property, { syncUrl = true, pushUrl = true } = {}) {
        if (!modal || !modalDetails) {
            return;
        }

        const propertyId = propertyIdFor(property);
        if (propertyId && imageOkCache.get(propertyId) === false) {
            return;
        }

        const images = imageUrlsFor(property);
        if (!images.length) {
            return;
        }
        const galleryImages = images;
        const features = featuresFor(property);

        currentGalleryImages = galleryImages;
        currentGalleryIndex = 0;
        lightboxIndex = 0;

        const type = toText(property.type, 'Property');
        const reference = toText(property.ref).trim();
        const town = toText(property.town, 'Unknown Area');
        const province = toText(property.province, 'Alicante');
        const description = toText(property.description, 'Property details coming soon.');
        const beds = Number(property.beds) || 0;
        const baths = Number(property.baths) || 0;
        const builtArea = builtAreaFor(property);
        const eurPerSqm = eurPerSqmFor(property);
        const latitude = Number(property.latitude);
        const longitude = Number(property.longitude);
        const googleMapsUrl = Number.isFinite(latitude) && Number.isFinite(longitude)
            ? `https://www.google.com/maps?q=${latitude},${longitude}`
            : null;
        const sourceUrl = sourceUrlFor(property);
        const propertyLink = buildPropertyLink(reference);
        activeModalPropertyId = propertyId || '';
        const isFav = Boolean(propertyId && favoriteIds.has(propertyId));
        const dossierSubject = encodeURIComponent(`Request to visit - ${reference || `${town} ${type}`}`);
        const shareTitle = `${reference || 'Property'} - ${town}, ${province}`;
        const shareTextRaw = `Check this ${type}${reference ? ` (${reference})` : ''} in ${town}: ${propertyLink}`;
        const shareText = encodeURIComponent(shareTextRaw);
        const shareUrl = encodeURIComponent(propertyLink);
        const whatsappShare = `https://wa.me/?text=${shareText}`;
        const telegramShare = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`;
        const facebookShare = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
        const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;
        const xShare = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${shareUrl}`;
        const dossierBody = encodeURIComponent(
            `Hello Spanish Coast Properties,\n\nI would like to request a visit for this property.\n\nReference: ${reference || 'N/A'}\nType: ${type}\nLocation: ${town}, ${province}\nPrice: ${formatListingPrice(property)}\nApp link: ${propertyLink}${sourceUrl ? `\nOfficial page: ${sourceUrl}` : ''}\n\nPreferred dates/times:\n1) \n2) \n\nThank you.`
        );
        const dossierMailto = `mailto:info@spanishcoastproperties.com?subject=${dossierSubject}&body=${dossierBody}`;
        const reportSubject = encodeURIComponent(`Listing issue report - ${reference || `${town} ${type}`}`);
        const reportBody = encodeURIComponent(
            `Hello Spanish Coast Properties,\n\nI found an issue with this listing and would like to flag it.\n\nReference: ${reference || 'N/A'}\nLocation: ${town}, ${province}\nApp link: ${propertyLink}${sourceUrl ? `\nOfficial page: ${sourceUrl}` : ''}\n\nWhat seems wrong:\n- \n\n(If possible, add a screenshot or describe the problem.)\n\nThank you.`
        );
        const reportMailto = `mailto:info@spanishcoastproperties.com?subject=${reportSubject}&body=${reportBody}`;
        const descriptionHtml = formatDescriptionHtml(description);
        const t = (key, fallback, vars) => {
            try {
                if (window.SCP_I18N && typeof window.SCP_I18N.t === 'function') {
                    return window.SCP_I18N.t(key, vars);
                }
            } catch (error) {
                // ignore
            }
            if (fallback !== undefined) return toText(fallback);
            return toText(key);
        };
        if (syncUrl) {
            // Use pushState so browser Back closes the modal. If modal is already open, replace instead.
            const shouldPush = Boolean(pushUrl) && !isModalOpen();
            setBrowserRef(reference, { push: shouldPush, state: { modalRef: reference } });
        }

        const modalTitle = escapeHtml(`${type} in ${town}`);

        modalDetails.innerHTML = `
            <div class="modal-body">
                <div class="modal-info">
                    <div class="card-badge">${type}</div>
                    <div class="modal-ref-row">
                        <div class="modal-ref">${reference || 'Ref unavailable'}</div>
                        <button type="button" class="ref-chip ref-chip--small" data-action="copy-modal-original-ref" style="display:none" aria-label="Copy original reference" title="Copy original reference">Orig</button>
                    </div>
                    <div class="modal-ref-sub muted" data-original-ref style="display:none"></div>
                    <h2>${modalTitle}</h2>
                    <div class="location">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ${town}, ${province}
                    </div>
                    <div class="price">${formatListingPrice(property)}</div>
                    <div class="modal-specs">
                        <div class="modal-spec-item">🛏️ Beds ${beds}</div>
                        <div class="modal-spec-item">🛁 Baths ${baths}</div>
                        <div class="modal-spec-item">📐 Area ${builtArea}m2</div>
                        ${eurPerSqm ? `<div class="modal-spec-item">📊 ${eurPerSqm}</div>` : ''}
                    </div>
                </div>
                <div class="modal-gallery">
                    <div class="gallery-main">
                        <button class="nav-arrow prev" id="prev-img">❮</button>
                        <img id="main-gallery-img" src="${galleryImages[0]}" alt="Property View">
                        <button class="nav-arrow next" id="next-img">❯</button>
                    </div>
                    <div class="gallery-thumbs-container">
                        <button class="thumb-nav prev" id="prev-thumbs">❮</button>
                        <div class="gallery-thumbs">
                            ${galleryImages.map((img, index) => `
                                <div class="thumb ${index === 0 ? 'active' : ''}" data-index="${index}">
                                    <img src="${img}" alt="Thumbnail ${index + 1}" loading="lazy">
                                </div>
                            `).join('')}
                        </div>
                        <button class="thumb-nav next" id="next-thumbs">❯</button>
                    </div>
                </div>
                <div class="modal-details-section">
                    <div class="mini-map-card">
                        <div class="mini-map-head">
                            <h4>📍 Location</h4>
                            ${googleMapsUrl
                ? `<a class="mini-map-link" href="${googleMapsUrl}" target="_blank" rel="noopener">Open in Google Maps</a>`
                : `<span class="mini-map-link mini-map-link--disabled">Map unavailable</span>`}
                        </div>
                        <div id="property-mini-map" class="mini-map"></div>
                        <div class="mini-map-note">Quick view of the area. Zoom in to explore nearby beaches, golf, and amenities.</div>
                    </div>
                    <div class="mini-map-card" data-nearby-card>
                        <div class="mini-map-head">
                            <h4>🧭 ${escapeHtml(t('nearby.title', 'Area snapshot'))}</h4>
                            <span class="mini-map-link mini-map-link--disabled" data-nearby-status>${escapeHtml(t('nearby.loading_short', 'Loading…'))}</span>
                        </div>
                        <div data-nearby-area></div>
                    </div>
                    <div class="desc">${descriptionHtml}</div>
                    <div class="features-list">
                        <h4>Premium Amenities</h4>
                        <ul>
                            ${features.length > 0
                ? features.map((feature) => `<li>${feature}</li>`).join('')
                : '<li>Premium finishes throughout</li><li>Advanced climate control</li>'}
                        </ul>
                    </div>
                    <div class="modal-cta">
                        <button type="button" class="cta-button cta-button--outline" data-fav-toggle>${isFav ? '♥ Saved' : '♡ Save'}</button>
                        <a href="brochure.html?ref=${encodeURIComponent(reference || '')}" class="cta-button cta-button--outline" target="_blank" rel="noopener">Brochure (PDF)</a>
                        <a href="tel:+34624867866" class="cta-button">Call Now</a>
                        <a href="${dossierMailto}" class="cta-button">Request to visit</a>
                        ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" class="cta-button" target="_blank" rel="noopener">Official page</a>` : ''}
                    </div>
	                    <div class="share-row" aria-label="Share">
	                        <button type="button" class="share-btn" data-share="native">
	                            <span class="share-icon share-icon--native">${SHARE_ICON_SVG.native}</span>
	                            <span class="share-label">Share</span>
	                        </button>
	                        <button type="button" class="share-btn" data-share="copy">
	                            <span class="share-icon share-icon--copy">${SHARE_ICON_SVG.copy}</span>
	                            <span class="share-label">Copy link</span>
	                        </button>
	                        <button type="button" class="share-btn" data-share="instagram">
	                            <span class="share-icon share-icon--instagram">${SHARE_ICON_SVG.instagram}</span>
	                            <span class="share-label">Instagram</span>
	                        </button>
	                        <button type="button" class="share-btn" data-share="tiktok">
	                            <span class="share-icon share-icon--tiktok">${SHARE_ICON_SVG.tiktok}</span>
	                            <span class="share-label">TikTok</span>
	                        </button>
	                        <a class="share-btn" href="${xShare}" target="_blank" rel="noopener">
	                            <span class="share-icon share-icon--x">${SHARE_ICON_SVG.x}</span>
	                            <span class="share-label">X (Twitter)</span>
	                        </a>
	                        <a class="share-btn share-btn--warn" href="${reportMailto}">
	                            <span class="share-icon share-icon--report">${SHARE_ICON_SVG.report}</span>
	                            <span class="share-label">Report issue</span>
	                        </a>
	                        <a class="share-btn" href="${whatsappShare}" target="_blank" rel="noopener">
	                            <span class="share-icon share-icon--whatsapp">${SHARE_ICON_SVG.whatsapp}</span>
	                            <span class="share-label">WhatsApp</span>
	                        </a>
	                        <a class="share-btn" href="${telegramShare}" target="_blank" rel="noopener">
	                            <span class="share-icon share-icon--telegram">${SHARE_ICON_SVG.telegram}</span>
	                            <span class="share-label">Telegram</span>
	                        </a>
	                        <a class="share-btn" href="${facebookShare}" target="_blank" rel="noopener">
	                            <span class="share-icon share-icon--facebook">${SHARE_ICON_SVG.facebook}</span>
	                            <span class="share-label">Facebook</span>
	                        </a>
	                        <a class="share-btn" href="${linkedInShare}" target="_blank" rel="noopener">
	                            <span class="share-icon share-icon--linkedin">${SHARE_ICON_SVG.linkedin}</span>
	                            <span class="share-label">LinkedIn</span>
	                        </a>
	                    </div>
	                </div>
	            </div>
	        `;

        // Privileged users (via Supabase/RLS) can see the original system reference (e.g. Inmovilla ref).
        // Normal clients never receive this data because it's stored server-side behind RLS.
        const originalRefEl = modalDetails.querySelector('[data-original-ref]');
        const originalRefBtn = modalDetails.querySelector('button[data-action="copy-modal-original-ref"]');
        if (originalRefEl) {
            originalRefEl.style.display = 'none';
            originalRefEl.textContent = '';
            if (originalRefBtn) {
                originalRefBtn.style.display = 'none';
                originalRefBtn.dataset.originalRef = '';
            }
            const scpRef = toText(reference).trim();
            if (scpRef) {
                (async () => {
                    const client = getSupabase();
                    if (!client) return;
                    let user = supabaseUser;
                    if (!user) {
                        try {
                            const { data } = await client.auth.getSession();
                            user = data && data.session ? data.session.user : null;
                        } catch {
                            user = null;
                        }
                    }
                    if (!user) return;
                    const mapped = await supabaseMaybeGetOriginalRef(client, user.id, scpRef);
                    if (!mapped || !mapped.original_ref) return;
                    const label = mapped.source ? `Original ref (${mapped.source})` : 'Original ref';
                    originalRefEl.textContent = `${label}: ${mapped.original_ref}`;
                    originalRefEl.style.display = 'block';
                    if (originalRefBtn) {
                        originalRefBtn.style.display = 'inline-flex';
                        originalRefBtn.dataset.originalRef = toText(mapped.original_ref).trim();
                    }
                })();
            }
        }

        if (originalRefBtn) {
            originalRefBtn.addEventListener('click', async () => {
                const value = toText(originalRefBtn.dataset.originalRef).trim();
                if (!value) return;
                const prev = originalRefBtn.textContent;
                await copyTextToClipboard(value);
                originalRefBtn.textContent = 'Copied';
                window.setTimeout(() => { originalRefBtn.textContent = prev || 'Orig'; }, 1200);
            });
        }

        modal.style.display = 'block';
        preModalScrollY = window.scrollY || 0;
        setBodyOverflow('hidden');

        const modalFavBtn = modalDetails.querySelector('[data-fav-toggle]');
        if (modalFavBtn) {
            setFavButtonState(modalFavBtn, isFav, { compact: false });
            modalFavBtn.addEventListener('click', () => {
                const nowFav = toggleFavorited(property);
                updateFavoritesControls();
                syncFavoriteUiForPid(activeModalPropertyId);
                if (supabaseClient && supabaseUser) {
                    if (nowFav) {
                        supabaseUpsertFavorite(supabaseClient, supabaseUser, property);
                    } else {
                        supabaseDeleteFavorite(supabaseClient, supabaseUser, activeModalPropertyId);
                    }
                }
                if (!nowFav && favoritesOnly) {
                    filterProperties();
                }
            });
        }

        const miniMapContainer = document.getElementById('property-mini-map');
        if (miniMapContainer && typeof L !== 'undefined') {
            const latitude = Number(property.latitude);
            const longitude = Number(property.longitude);
            const canRender = Number.isFinite(latitude) && Number.isFinite(longitude);

            if (miniMap) {
                miniMap.remove();
                miniMap = null;
                miniMapMarker = null;
            }

            if (canRender) {
                miniMap = L.map(miniMapContainer, {
                    zoomControl: true,
                    scrollWheelZoom: false,
                    dragging: true,
                    attributionControl: false
                }).setView([latitude, longitude], 14);

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19
                }).addTo(miniMap);

                miniMapMarker = L.marker([latitude, longitude]).addTo(miniMap);
                window.setTimeout(() => miniMap.invalidateSize(), 250);
            } else {
                miniMapContainer.innerHTML = '<div style="padding:14px;color:#94a3b8">Map unavailable for this listing.</div>';
            }
        }

	        const shareNativeBtn = modalDetails.querySelector('[data-share="native"]');
	        const shareCopyBtn = modalDetails.querySelector('[data-share="copy"]');
	        const shareInstagramBtn = modalDetails.querySelector('[data-share="instagram"]');
	        const shareTiktokBtn = modalDetails.querySelector('[data-share="tiktok"]');

            const nearbyAreaEl = modalDetails.querySelector('[data-nearby-area]');
            const nearbyStatusEl = modalDetails.querySelector('[data-nearby-status]');
            initNearbySnapshot(nearbyAreaEl, nearbyStatusEl, { pid: activeModalPropertyId, town, province, latitude, longitude });

		        const shareBtnLabel = (btn) => {
		            if (!btn) return '';
		            const label = btn.querySelector('.share-label');
		            return label ? label.textContent : btn.textContent;
	        };

	        const setShareBtnLabel = (btn, text) => {
	            if (!btn) return;
	            const label = btn.querySelector('.share-label');
	            if (label) label.textContent = text;
	            else btn.textContent = text;
	        };

	        if (shareNativeBtn) {
	            shareNativeBtn.addEventListener('click', async () => {
	                if (navigator.share) {
	                    try {
                        await navigator.share({ title: shareTitle, text: shareTextRaw, url: propertyLink });
                        return;
                    } catch (error) {
                        // Fall back to copy.
                    }
                }
                if (shareCopyBtn) {
                    shareCopyBtn.click();
                }
            });
        }

	        const shareToSocialApp = (btn, appName) => {
	            if (!btn) return;
	            btn.addEventListener('click', async () => {
	                if (navigator.share) {
                    try {
                        await navigator.share({ title: shareTitle, text: shareTextRaw, url: propertyLink });
                        return;
                    } catch (error) {
                        // Fall through to copy.
                    }
                }
	                if (shareCopyBtn) {
	                    shareCopyBtn.click();
	                }
	                const original = shareBtnLabel(btn);
	                setShareBtnLabel(btn, `Copied. Open ${appName}`);
	                window.setTimeout(() => {
	                    setShareBtnLabel(btn, original);
	                }, 1800);
	            });
	        };

        shareToSocialApp(shareInstagramBtn, 'Instagram');
        shareToSocialApp(shareTiktokBtn, 'TikTok');

	        if (shareCopyBtn) {
	            shareCopyBtn.addEventListener('click', async () => {
	                const original = shareBtnLabel(shareCopyBtn);
	                try {
	                    if (navigator.clipboard && navigator.clipboard.writeText) {
	                        await navigator.clipboard.writeText(propertyLink);
	                    } else {
	                        window.prompt('Copy link:', propertyLink);
	                    }
	                    setShareBtnLabel(shareCopyBtn, 'Copied');
	                    window.setTimeout(() => {
	                        setShareBtnLabel(shareCopyBtn, original);
	                    }, 1400);
	                } catch (error) {
	                    window.prompt('Copy link:', propertyLink);
	                }
	            });
	        }

        const thumbs = document.querySelectorAll('.thumb');
        const mainImg = document.getElementById('main-gallery-img');
        const prevImgBtn = document.getElementById('prev-img');
        const nextImgBtn = document.getElementById('next-img');
        const prevThumbsBtn = document.getElementById('prev-thumbs');
        const nextThumbsBtn = document.getElementById('next-thumbs');
        const thumbsList = document.querySelector('.gallery-thumbs');

        if (mainImg) {
            mainImg.setAttribute('referrerpolicy', 'no-referrer');
            mainImg.setAttribute('decoding', 'async');
            mainImg.addEventListener('error', () => {
                // If a host blocks hotlinking, try the next image before giving up.
                if (currentGalleryImages.length > 1) {
                    updateGallery(currentGalleryIndex + 1);
                } else {
                    markListingImagesBroken(property);
                    modal.style.display = 'none';
                    setBodyOverflow('auto');
                }
            });
        }

        function updateGallery(index) {
            if (!mainImg || !thumbs.length || !currentGalleryImages.length) {
                return;
            }
            currentGalleryIndex = (index + currentGalleryImages.length) % currentGalleryImages.length;
            mainImg.src = currentGalleryImages[currentGalleryIndex];
            thumbs.forEach((thumb) => thumb.classList.remove('active'));
            if (thumbs[currentGalleryIndex]) {
                thumbs[currentGalleryIndex].classList.add('active');
                thumbs[currentGalleryIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }

        thumbs.forEach((thumb) => {
            thumb.addEventListener('click', () => {
                updateGallery(Number(thumb.dataset.index));
            });

            const img = thumb.querySelector('img');
            if (img) {
                img.setAttribute('referrerpolicy', 'no-referrer');
                img.setAttribute('decoding', 'async');
                attachImageFallback(img, [img.getAttribute('src')], {
                    onAllFailed: () => {
                        markListingImagesBroken(property);
                    }
                });
            }
        });

        if (prevImgBtn) {
            prevImgBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                updateGallery(currentGalleryIndex - 1);
            });
        }

        if (nextImgBtn) {
            nextImgBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                updateGallery(currentGalleryIndex + 1);
            });
        }

        if (prevThumbsBtn && thumbsList) {
            prevThumbsBtn.addEventListener('click', () => {
                thumbsList.scrollLeft -= 150;
            });
        }

        if (nextThumbsBtn && thumbsList) {
            nextThumbsBtn.addEventListener('click', () => {
                thumbsList.scrollLeft += 150;
            });
        }

        if (mainImg && lightbox && lightboxImg) {
            mainImg.addEventListener('click', () => {
                openLightboxAt(currentGalleryIndex);
            });
        }
    }

    function updateLightboxCaption() {
        if (!lightboxCaption) return;
        const total = Array.isArray(currentGalleryImages) ? currentGalleryImages.length : 0;
        if (!total) {
            lightboxCaption.textContent = '';
            return;
        }
        lightboxCaption.textContent = `${lightboxIndex + 1} / ${total}`;
    }

    function setLightboxImage(index) {
        if (!lightboxImg || !Array.isArray(currentGalleryImages) || currentGalleryImages.length === 0) return;
        const total = currentGalleryImages.length;
        lightboxIndex = ((index % total) + total) % total;
        lightboxImg.classList.add('lightbox-fade');
        window.setTimeout(() => {
            if (!lightboxImg) return;
            lightboxImg.src = currentGalleryImages[lightboxIndex];
            lightboxImg.classList.remove('lightbox-fade');
            updateLightboxCaption();
        }, 70);
    }

    function openLightboxAt(index) {
        if (!lightbox || !lightboxImg) return;
        if (!Array.isArray(currentGalleryImages) || currentGalleryImages.length === 0) return;
        lightbox.style.display = 'flex';
        setLightboxImage(index);
        // Keep scrolling stable.
        setBodyOverflow('hidden');
    }

    function closeLightboxModal() {
        if (!lightbox) return;
        lightbox.style.display = 'none';
        // Restore body scrolling unless property modal is still open.
        if (!isModalOpen()) {
            setBodyOverflow('auto');
        }
        lightboxTouchStartX = null;
        lightboxTouchStartY = null;
        lightboxTouchStartTime = 0;
    }

    function stepLightbox(delta) {
        if (!lightbox || lightbox.style.display !== 'flex') return;
        setLightboxImage(lightboxIndex + delta);
    }

    function isModalOpen() {
        return Boolean(modal && modal.style.display === 'block');
    }

    function closePropertyModal({ syncUrl = true } = {}) {
        if (!modal) return;
        if (!isModalOpen()) return;

        modal.style.display = 'none';
        setBodyOverflow('auto');
        activeModalPropertyId = '';
        // Keep the list position stable after closing (especially on mobile Safari).
        window.setTimeout(() => {
            try {
                window.scrollTo(0, preModalScrollY || 0);
            } catch (error) {
                // ignore
            }
        }, 0);

        if (syncUrl) {
            // If modal was opened via pushState (state.modalRef), go back one entry. Otherwise just clear ref.
            const currentState = window.history && window.history.state;
            const url = new URL(window.location.href);
            const hasRef = Boolean(toText(url.searchParams.get('ref')).trim());
            if (currentState && currentState.modalRef && hasRef) {
                window.history.back();
            } else {
                setBrowserRef('', { push: false, state: {} });
            }
        }

        // If the current ref filter was injected via URL deep link, clear it on close so the user sees all listings.
        if (autoRefFromUrl && normalize(refQuery) === normalize(autoRefFromUrl)) {
            refQuery = '';
            autoRefFromUrl = '';
            if (refSearchInput) refSearchInput.value = '';
            // Returning from a deep-linked single listing: snap back to a full-results map view.
            mapHasUserInteracted = false;
            mapLastFitSignature = '';
            filterProperties();
        }
    }

    function generateCityButtons() {
        if (!cityButtonsContainer) {
            return;
        }

        cityButtonsContainer.innerHTML = '';
        MAIN_DESTINATIONS.forEach(({ value, label }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `city-btn ${selectedCity === value ? 'active' : ''}`;
            button.textContent = label;
            button.dataset.city = value;

            button.addEventListener('click', () => {
                selectCity(value);
            });

            cityButtonsContainer.appendChild(button);
        });

        updateActiveCityButton(selectedCity);
    }

    function markerKindFor(property) {
        const mode = listingModeFor(property);
        if (mode === 'traspaso' || mode === 'business') {
            return 'business';
        }

        const type = normalize(property && property.type);
        if (!type) return 'property';

        if (type.includes('penthouse') || type.includes('atico')) return 'penthouse';
        if (type.includes('apartment') || type.includes('apartamento') || type.includes('flat') || type.includes('studio')) return 'apartment';

        if (type.includes('villa') || type.includes('chalet') || type.includes('detached') || type.includes('single family')) return 'villa';
        if (
            type.includes('town house')
            || type.includes('townhouse')
            || type.includes('duplex')
            || type.includes('triplex')
            || type.includes('bungalow')
            || type.includes('terraced')
            || type.includes('semi detached')
            || type.includes('semi-detached')
            || type.includes('house')
            || type.includes('casa')
        ) return 'house';

        if (type.includes('country') || type.includes('finca') || type.includes('rural') || type.includes('cortijo')) return 'country';
        if (type.includes('plot') || type.includes('land') || type.includes('parcel') || type.includes('terrain') || type.includes('solar') || type.includes('rustic')) return 'plot';

        if (
            type.includes('commercial')
            || type.includes('local')
            || type.includes('office')
            || type.includes('shop')
            || type.includes('industrial')
            || type.includes('warehouse')
            || type.includes('premises')
        ) return 'commercial';

        if (type.includes('garage') || type.includes('parking')) return 'parking';

        return 'property';
    }

    const MARKER_ICON_BASE = 'class="scp-marker-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    const MARKER_ICON_SVG = {
        apartment: `<svg ${MARKER_ICON_BASE}><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"/><path d="M9 6h.01"/><path d="M15 6h.01"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M9 14h.01"/><path d="M15 14h.01"/><path d="M9 18h.01"/><path d="M15 18h.01"/></svg>`,
        penthouse: `<svg ${MARKER_ICON_BASE}><path d="M5 22V9l7-6 7 6v13"/><path d="M9 22v-7h6v7"/><path d="M12 7l1 2 2 .3-1.6 1.4.5 2.3L12 12l-1.9 1 .5-2.3L9 9.3 11 9z"/></svg>`,
        villa: `<svg ${MARKER_ICON_BASE}><path d="M3 11l9-7 9 7"/><path d="M5 10v11a1 1 0 0 0 1 1h4v-7h4v7h4a1 1 0 0 0 1-1V10"/></svg>`,
        house: `<svg ${MARKER_ICON_BASE}><path d="M3 11l9-7 9 7"/><path d="M5 10v12h14V10"/><path d="M9 22v-7h6v7"/></svg>`,
        country: `<svg ${MARKER_ICON_BASE}><path d="M12 2c-3 2.4-4.8 5.2-5.3 8.3h10.6C16.8 7.2 15 4.4 12 2z"/><path d="M7 10.3c-2.2 1.8-3.6 4-4 6.7h18c-.4-2.7-1.8-4.9-4-6.7"/><path d="M12 17v5"/><path d="M8 22h8"/></svg>`,
        plot: `<svg ${MARKER_ICON_BASE}><path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"/><path d="M9 3v15"/><path d="M15 6v15"/></svg>`,
        commercial: `<svg ${MARKER_ICON_BASE}><path d="M3 9l1-5h16l1 5"/><path d="M4 9v12h16V9"/><path d="M9 21v-7h6v7"/><path d="M7 12h10"/></svg>`,
        parking: `<svg ${MARKER_ICON_BASE}><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/><path d="M10 16V8h3a2 2 0 0 1 0 4h-3"/></svg>`,
        business: `<svg ${MARKER_ICON_BASE}><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>`,
        property: `<svg ${MARKER_ICON_BASE}><path d="M3 11l9-7 9 7"/><path d="M5 10v12h14V10"/><path d="M9 22v-7h6v7"/></svg>`
    };

    function markerIconSvgFor(kind) {
        return MARKER_ICON_SVG[kind] || MARKER_ICON_SVG.property;
    }

    function createMarkerIcon(property) {
        if (typeof L === 'undefined' || typeof L.divIcon !== 'function') {
            return undefined;
        }

        const kind = markerKindFor(property);
        const markerText = escapeHtml(formatListingMarkerText(property));

        return L.divIcon({
            className: `marker-container marker-kind-${kind}`,
            html: `
                <div class="scp-marker" aria-hidden="true">
                    <div class="scp-marker-pin">
                        ${markerIconSvgFor(kind)}
                    </div>
                    <div class="scp-marker-tag">${markerText}</div>
                </div>
            `,
            // Include the tag width so clicks work on the full label.
            iconSize: [160, 48],
            // Anchor at the bottom of the pin.
            iconAnchor: [24, 48]
        });
    }

    function initMap() {
        if (typeof L === 'undefined') {
            return;
        }

        const mapElement = document.getElementById('map');
        if (!mapElement) {
            return;
        }

        map = L.map(mapElement, {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView([37.98, -0.69], 9);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        markersGroup = typeof L.markerClusterGroup === 'function'
            ? L.markerClusterGroup()
            : L.layerGroup();

        markersGroup.addTo(map);

        // Preserve user zoom/position: once the user pans/zooms, avoid auto-fit snapping back.
        map.on('movestart', (e) => {
            if (e && e.originalEvent) mapHasUserInteracted = true;
        });
        map.on('zoomstart', (e) => {
            if (e && e.originalEvent) mapHasUserInteracted = true;
        });
    }

    function isMapVisible() {
        if (!mapSection) {
            return false;
        }
        const isMobile = window.matchMedia && window.matchMedia('(max-width: 1024px)').matches;
        if (isMobile) {
            return mapSection.classList.contains('active');
        }
        return true;
    }

    function fitMapToResults() {
        if (!map || typeof L === 'undefined') return;
        const bounds = [];
        currentProperties.forEach((property) => {
            const latitude = Number(property.latitude);
            const longitude = Number(property.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
            bounds.push([latitude, longitude]);
        });
        if (!bounds.length) return;
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
    }

    function updateMapMarkers() {
        if (!map || !markersGroup || typeof L === 'undefined') {
            return;
        }

        if (typeof markersGroup.clearLayers === 'function') {
            markersGroup.clearLayers();
        }

        markerMap.clear();

        // Signature used to decide if we should auto-fit the map. We do NOT want to reset zoom/center
        // when the results did not change (or after the user has manually interacted with the map).
        let signatureHash = 0;
        let signatureCount = 0;
        const bounds = [];

        currentProperties.forEach((property) => {
            const propertyId = idKey(property.id);
            const latitude = Number(property.latitude);
            const longitude = Number(property.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return;
            }

            signatureCount += 1;
            const sigSeed = `${propertyId}:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
            for (let i = 0; i < sigSeed.length; i += 1) {
                signatureHash = ((signatureHash << 5) - signatureHash + sigSeed.charCodeAt(i)) | 0;
            }

            const marker = L.marker([latitude, longitude], {
                icon: createMarkerIcon(property),
                title: toText(property.ref, toText(property.town, 'Property'))
            });

            marker.on('click', () => {
                scrollToProperty(property.id);
                openPropertyModal(property);
            });

            marker.on('mouseover', () => {
                setMarkerActive(propertyId, true);
                setCardActive(propertyId, true);
            });
            marker.on('mouseout', () => {
                setMarkerActive(propertyId, false);
                setCardActive(propertyId, false);
            });

            markerMap.set(propertyId, marker);
            markersGroup.addLayer(marker);
            bounds.push([latitude, longitude]);
        });

        const signature = `${signatureCount}:${signatureHash}`;
        const canAutoFit = !mapHasUserInteracted && signature !== mapLastFitSignature;

        if (bounds.length > 0 && canAutoFit) {
            map.fitBounds(bounds, {
                padding: [40, 40],
                // Keep context: avoid zooming too far in when there are only a few results.
                maxZoom: 11
            });
            mapLastFitSignature = signature;
        }
    }

    // --- Event Listeners ---
    if (footerYear) {
        footerYear.textContent = String(new Date().getFullYear());
    }

    syncViewportHeightVar();
    syncFiltersBarHeight();

    window.addEventListener('resize', () => {
        if (filtersBarResizeTimer) {
            clearTimeout(filtersBarResizeTimer);
        }
        filtersBarResizeTimer = setTimeout(() => {
            syncViewportHeightVar();
            syncFiltersBarHeight();
            // On mobile rotation / viewport changes, Leaflet can render at an odd zoom.
            // Keep the map experience smooth by snapping back to a full-width "fit results" view.
            if (map && isMapVisible() && typeof map.invalidateSize === 'function') {
                window.setTimeout(() => {
                    try {
                        map.invalidateSize();
                    } catch (error) {
                        // ignore
                    }
                    mapHasUserInteracted = false;
                    mapLastFitSignature = '';
                    fitMapToResults();
                }, 180);
            }
        }, 60);
    });

    if (toggleAdvancedBtn && searchPill) {
        toggleAdvancedBtn.addEventListener('click', () => {
            const next = !searchPill.classList.contains('advanced-open');
            searchPill.classList.toggle('advanced-open', next);
            toggleAdvancedBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
            toggleAdvancedBtn.textContent = next ? 'Less' : 'More';
            const scrollEl = document.getElementById('pill-scroll');
            if (scrollEl) {
                scrollEl.scrollLeft = 0;
            }
            requestAnimationFrame(syncFiltersBarHeight);
        });
    }

    const openFilters = () => {
        if (activeSection !== 'properties') return;
        setUiCollapsed(false);
        // If map view is open on mobile, close it first. Otherwise the backdrop can appear without the filters.
        if (mapSection && mapSection.classList.contains('active')) {
            mapSection.classList.remove('active');
            document.body.classList.remove('map-open');
            if (toggleMapBtn) {
                toggleMapBtn.textContent = 'Map';
            }
        }
        document.body.classList.add('filters-open');
        if (searchPill) {
            // Keep filters compact on mobile: do not force "More" open.
            searchPill.classList.remove('advanced-open');
        }
        if (toggleAdvancedBtn) {
            toggleAdvancedBtn.setAttribute('aria-expanded', searchPill && searchPill.classList.contains('advanced-open') ? 'true' : 'false');
            toggleAdvancedBtn.textContent = (searchPill && searchPill.classList.contains('advanced-open')) ? 'Less' : 'More';
        }
    };

    const closeFilters = () => {
        document.body.classList.remove('filters-open');
    };

    if (openFiltersBtn) {
        openFiltersBtn.addEventListener('click', openFilters);
    }
    if (closeFiltersBtn) {
        closeFiltersBtn.addEventListener('click', closeFilters);
    }
    if (filtersBackdrop) {
        filtersBackdrop.addEventListener('click', closeFilters);
    }

    // Auto-collapse top UI on scroll so the results fill the screen.
    if (propertiesSection) {
        uiScrollEl = propertiesSection.querySelector('.content-section');
        if (uiScrollEl) {
            uiScrollEl.addEventListener('scroll', () => {
                // Avoid thrash: only toggle after a small threshold.
                setUiCollapsed(uiScrollEl.scrollTop > 48);
            }, { passive: true });
        }
    }

    // Navigation is handled by real links now (separate pages). Keep SPA fallback for
    // any elements that still use data-section-jump.
    sectionJumpButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            setActiveSection(button.dataset.sectionJump);
        });
    });

    window.addEventListener('popstate', () => {
        const url = new URL(window.location.href);
        const ref = toText(url.searchParams.get('ref')).trim();
        const section = toText(url.searchParams.get('section')).trim();
        const path = toText(window.location.pathname).toLowerCase();
        const inferredSection = path.endsWith('properties.html')
            ? 'properties'
            : path.endsWith('businesses.html')
                ? 'businesses'
                : path.endsWith('vehicles.html')
                    ? 'vehicles'
                    : path.endsWith('services.html')
                        ? 'services'
                        : 'home';
        const next = ref ? 'properties' : (section || inferredSection || 'home');
        setActiveSection(next, { pushUrl: false });

        if (next !== 'properties') {
            closePropertyModal({ syncUrl: false });
            return;
        }

        if (!ref) {
            closePropertyModal({ syncUrl: false });
            return;
        }

        // Open modal for this ref without forcing filter state unless it came from a deep link.
        const match = allProperties.find((property) => normalize(property.ref) === normalize(ref));
        if (match) {
            openPropertyModal(match, { syncUrl: false, pushUrl: false });
        }
    });

    if (refSearchInput) {
        refSearchInput.addEventListener('input', (event) => {
            const next = toText(event.target.value).trim();
            refQuery = next;
            if (autoRefFromUrl && normalize(next) !== normalize(autoRefFromUrl)) {
                autoRefFromUrl = '';
            }
            scheduleFilter();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            searchQuery = toText(event.target.value).trim();
            scheduleFilter();
        });
    }

    if (priceFilter) {
        priceFilter.addEventListener('input', (event) => {
            const raw = toText(event.target.value).trim();
            maxPrice = raw === '' ? 'any' : raw;
            scheduleFilter();
        });
    }

    if (sortFilterEl) {
        sortMode = toText(sortFilterEl.value, 'date_desc') || 'date_desc';
        sortFilterEl.addEventListener('change', (event) => {
            sortMode = toText(event.target.value, 'date_desc') || 'date_desc';
            renderLimit = 60;
            renderProperties({ reset: true });
        });
    }

    updateFavoritesControls();
    initSupabaseFavoritesSync();

    if (favoritesToggleBtn) {
        favoritesToggleBtn.addEventListener('click', () => {
            favoritesOnly = !favoritesOnly;
            updateFavoritesControls();
            filterProperties();
            if (uiScrollEl) {
                uiScrollEl.scrollTop = 0;
            }
        });
    }

    if (favoritesSendBtn) {
        favoritesSendBtn.addEventListener('click', () => {
            if (favoriteIds.size === 0) return;
            window.location.href = buildFavoritesMailto();
        });
    }

    function syncFiltersFromControls() {
        selectedType = typeFilter ? typeFilter.value : 'all';
        operationMode = dealFilterEl ? toText(dealFilterEl.value, 'any') : 'any';
        if (!priceFilter) {
            maxPrice = 'any';
        } else {
            const raw = toText(priceFilter.value).trim();
            maxPrice = raw === '' ? 'any' : raw;
        }
        minBeds = bedsFilter ? Number(bedsFilter.value) || 0 : 0;
        minBaths = bathsFilter ? Number(bathsFilter.value) || 0 : 0;
        poolFilter = poolFilterEl ? poolFilterEl.value : 'any';
        parkingFilter = parkingFilterEl ? parkingFilterEl.value : 'any';
        maxBeachDistanceMeters = beachFilterEl ? beachFilterEl.value : 'any';
        seaViewFilter = seaViewFilterEl ? seaViewFilterEl.value : 'any';
    }

    function resetAllFilters() {
        selectedCity = 'all';
        selectedType = 'all';
        searchQuery = '';
        refQuery = '';
        maxPrice = 'any';
        minBeds = 0;
        minBaths = 0;
        poolFilter = 'any';
        parkingFilter = 'any';
        maxBeachDistanceMeters = 'any';
        seaViewFilter = 'any';
        operationMode = 'any';
        sortMode = 'date_desc';
        favoritesOnly = false;
        autoRefFromUrl = '';

        if (refSearchInput) refSearchInput.value = '';
        if (searchInput) searchInput.value = '';
        if (typeFilter) typeFilter.value = 'all';
        if (dealFilterEl) dealFilterEl.value = 'any';
        if (priceFilter) priceFilter.value = '';
        if (bedsFilter) bedsFilter.value = '0';
        if (bathsFilter) bathsFilter.value = '0';
        if (poolFilterEl) poolFilterEl.value = 'any';
        if (parkingFilterEl) parkingFilterEl.value = 'any';
        if (beachFilterEl) beachFilterEl.value = 'any';
        if (seaViewFilterEl) seaViewFilterEl.value = 'any';
        if (sortFilterEl) sortFilterEl.value = 'date_desc';

        updateActiveCityButton('all');
        setBrowserRef('', { push: false, state: {} });

        if (mapSection && mapSection.classList.contains('active')) {
            mapSection.classList.remove('active');
            document.body.classList.remove('map-open');
            if (toggleMapBtn) toggleMapBtn.textContent = 'Map';
        }

        closeFilters();
        closePropertyModal({ syncUrl: false });
        mapHasUserInteracted = false;
        mapLastFitSignature = '';
        updateFavoritesControls();
        filterProperties();
    }

    [typeFilter, dealFilterEl, priceFilter, bedsFilter, bathsFilter, poolFilterEl, parkingFilterEl, beachFilterEl, seaViewFilterEl].forEach((el) => {
        if (!el) return;
        el.addEventListener('change', () => {
            syncFiltersFromControls();
            filterProperties();
        });
    });

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            syncFiltersFromControls();
            mapHasUserInteracted = false;
            mapLastFitSignature = '';
            filterProperties();
            closeFilters();
            if (uiScrollEl) {
                // Keep user focus on results after a search.
                uiScrollEl.scrollTop = 0;
            }
            setUiCollapsed(true);
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            resetAllFilters();
        });
    }

    if (toggleMapBtn && mapSection) {
        toggleMapBtn.addEventListener('click', () => {
            setUiCollapsed(false);
            // Ensure map reflects the current filter controls (even if user didn't press Apply).
            syncFiltersFromControls();
            filterProperties();
            closeFilters();

            mapSection.classList.toggle('active');
            const mapIsOpen = mapSection.classList.contains('active');
            document.body.classList.toggle('map-open', mapIsOpen);
            toggleMapBtn.textContent = mapIsOpen ? 'List' : 'Map';

            if (map && typeof map.invalidateSize === 'function') {
                window.setTimeout(() => {
                    map.invalidateSize();
                    if (mapIsOpen && mapDirty) {
                        updateMapMarkers();
                        mapDirty = false;
                    }
                }, 240);
            }
        });
    }

    if (mainLogoImg) {
        mainLogoImg.addEventListener('click', () => {
            if (activeSection !== 'properties') {
                setActiveSection('home');
                return;
            }
            resetAllFilters();
        });
    }

    if (closeModal && modal) {
        closeModal.addEventListener('click', () => {
            closePropertyModal();
        });
    }

    if (closeLightbox && lightbox) {
        closeLightbox.addEventListener('click', () => {
            closeLightboxModal();
        });
    }

    window.addEventListener('click', (event) => {
        if (modal && event.target === modal) {
            closePropertyModal();
        }

        if (lightbox && event.target === lightbox) {
            closeLightboxModal();
        }
    });

    if (lightboxPrevBtn) {
        lightboxPrevBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            stepLightbox(-1);
        });
    }

    if (lightboxNextBtn) {
        lightboxNextBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            stepLightbox(1);
        });
    }

    if (lightbox) {
        lightbox.addEventListener('touchstart', (event) => {
            if (!event.touches || event.touches.length !== 1) return;
            const t = event.touches[0];
            lightboxTouchStartX = t.clientX;
            lightboxTouchStartY = t.clientY;
            lightboxTouchStartTime = Date.now();
        }, { passive: true });

        lightbox.addEventListener('touchend', (event) => {
            if (lightboxTouchStartX === null || lightboxTouchStartY === null) return;
            const t = event.changedTouches && event.changedTouches[0];
            if (!t) return;
            const dx = t.clientX - lightboxTouchStartX;
            const dy = t.clientY - lightboxTouchStartY;
            const dt = Date.now() - lightboxTouchStartTime;

            lightboxTouchStartX = null;
            lightboxTouchStartY = null;
            lightboxTouchStartTime = 0;

            // Horizontal swipe to change photo.
            if (dt > 900) return;
            if (Math.abs(dx) < 42) return;
            if (Math.abs(dx) < Math.abs(dy)) return;

            if (dx < 0) stepLightbox(1);
            else stepLightbox(-1);
        }, { passive: true });
    }

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (lightbox && lightbox.style.display === 'flex') {
                closeLightboxModal();
            }
            return;
        }

        if (!lightbox || lightbox.style.display !== 'flex') return;
        if (event.key === 'ArrowLeft') stepLightbox(-1);
        if (event.key === 'ArrowRight') stepLightbox(1);
    });

    const mesh = document.querySelector('.bg-mesh');
    const prefersReducedMotion = typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;
    const hasFinePointer = typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: fine)').matches
        : false;
    if (mesh && !prefersReducedMotion && hasFinePointer) {
        document.addEventListener('mousemove', (event) => {
            const x = event.clientX / window.innerWidth;
            const y = event.clientY / window.innerHeight;
            mesh.style.transform = `translate(${x * 20}px, ${y * 20}px) scale(1.1)`;
        }, { passive: true });
    }

    // --- Initialization ---
    renderCatalogs();

    // Build price suggestions (10k increments starting at 50k).
    const priceSuggestions = document.getElementById('price-suggestions');
    if (priceSuggestions) {
        const frag = document.createDocumentFragment();
        for (let value = 50000; value <= 500000; value += 10000) {
            const opt = document.createElement('option');
            opt.value = String(value);
            frag.appendChild(opt);
        }
        [750000, 1000000, 1500000, 2000000].forEach((value) => {
            const opt = document.createElement('option');
            opt.value = String(value);
            frag.appendChild(opt);
        });
        priceSuggestions.appendChild(frag);
    }

    const initialUrl = new URL(window.location.href);
    const initialRef = toText(initialUrl.searchParams.get('ref')).trim();
    const initialSection = toText(initialUrl.searchParams.get('section')).trim();
    const path = toText(window.location.pathname).toLowerCase();
    const inferredSection = path.endsWith('properties.html')
        ? 'properties'
        : path.endsWith('businesses.html')
            ? 'businesses'
            : path.endsWith('vehicles.html')
                ? 'vehicles'
                : 'home';
    const startSection = initialRef ? 'properties' : (initialSection || inferredSection || 'home');

    setActiveSection(startSection, { pushUrl: false });

    // Lightweight in-browser smoke tester for mobile/webviews.
    // Run via `properties.html?qa=1` (or add `&qa=1`).
    if (initialUrl.searchParams.get('qa') === '1') {
        setActiveSection('properties', { pushUrl: false });
        ensurePropertiesInitialized();

        const qaPanel = document.createElement('div');
        qaPanel.style.cssText = [
            'position:fixed',
            'right:12px',
            'bottom:12px',
            'z-index:99999',
            'max-width:340px',
            'font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
            'color:#e2e8f0',
            'background:rgba(2,6,23,0.92)',
            'border:1px solid rgba(148,163,184,0.25)',
            'border-radius:12px',
            'padding:10px 12px',
            'box-shadow:0 20px 70px rgba(0,0,0,0.45)'
        ].join(';');
        qaPanel.innerHTML = '<div style="font-weight:800;margin-bottom:6px">SCP Smoke Test</div>';
        document.body.appendChild(qaPanel);

        const qaLine = (ok, msg) => {
            const row = document.createElement('div');
            row.textContent = `${ok ? 'PASS' : 'FAIL'}: ${msg}`;
            row.style.cssText = `margin:2px 0;color:${ok ? '#86efac' : '#fca5a5'}`;
            qaPanel.appendChild(row);
        };

        const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

        (async () => {
            try {
                qaLine(Boolean(toggleMapBtn), 'Map/List toggle exists');
                if (toggleMapBtn) {
                    const rect = toggleMapBtn.getBoundingClientRect();
                    qaLine(rect.left >= 0 && rect.right <= window.innerWidth, 'Map/List toggle fits viewport');
                }

                openFilters();
                await sleep(100);
                qaLine(document.body.classList.contains('filters-open'), 'Filters open');
                closeFilters();
                await sleep(50);
                qaLine(!document.body.classList.contains('filters-open'), 'Filters close');

                filterProperties();
                await sleep(180);
                const first = currentProperties.find((p) => {
                    const pid = propertyIdFor(p);
                    return imageUrlsFor(p).length > 0 && (!pid || imageOkCache.get(pid) !== false);
                });
                qaLine(Boolean(first), 'Has at least one viewable listing');
                if (!first) return;

                openPropertyModal(first, { syncUrl: true, pushUrl: true });
                await sleep(150);
                qaLine(isModalOpen(), 'Modal opens');

                closePropertyModal();
                await sleep(250);
                qaLine(!isModalOpen(), 'Modal closes');
                qaLine(Boolean(propertiesSection && propertiesSection.classList.contains('active')), 'Properties section visible');

                const urlNow = new URL(window.location.href);
                qaLine(!toText(urlNow.searchParams.get('ref')).trim(), 'Ref cleared after close');
            } catch (error) {
                qaLine(false, `Exception: ${error && error.message ? error.message : String(error)}`);
            }
        })();
    }
});
