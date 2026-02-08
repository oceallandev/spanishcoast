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
    allProperties.forEach((property, index) => {
        const pid = idKey(property && property.id) || idKey(property && property.ref);
        if (pid && !sourceIndexById.has(pid)) {
            sourceIndexById.set(pid, index);
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
    let sortMode = 'featured';
    let currentGalleryIndex = 0;
    let currentGalleryImages = [];
    let map;
    let markersGroup;
    const markerMap = new Map();
    let propertiesInitialized = false;
    let activeSection = 'home';
    let miniMap = null;
    let miniMapMarker = null;
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

        const salePrice = Number(property && property.price);
        if (Number.isFinite(salePrice) && salePrice > 0) {
            return 'sale';
        }
        const text = normalize(property && property.description);
        const isTransfer = text.includes('traspaso')
            || text.includes('being transferred')
            || text.includes('is being transferred')
            || text.includes('is transferred');
        if (isTransfer) {
            return 'traspaso';
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

            card.innerHTML = `
                <div class="card-img-wrapper">
                    <img src="${imageUrl}" alt="${type}" loading="lazy">
                    <div class="card-badge">${type}</div>
                    <div class="card-status ${listingMode}">${listingLabel}</div>
                </div>
                <div class="card-content">
                    <div class="card-ref">${reference || 'Reference unavailable'}</div>
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
        const propertyLink = sourceUrl || buildPropertyLink(reference);
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
            `Hello Spanish Coast Properties,\n\nI would like to request a visit for this property.\n\nReference: ${reference || 'N/A'}\nType: ${type}\nLocation: ${town}, ${province}\nPrice: ${formatListingPrice(property)}\nProperty link: ${propertyLink}\n\nPreferred dates/times:\n1) \n2) \n\nThank you.`
        );
        const dossierMailto = `mailto:info@spanishcoastproperties.com?subject=${dossierSubject}&body=${dossierBody}`;
        const reportSubject = encodeURIComponent(`Listing issue report - ${reference || `${town} ${type}`}`);
        const reportBody = encodeURIComponent(
            `Hello Spanish Coast Properties,\n\nI found an issue with this listing and would like to flag it.\n\nReference: ${reference || 'N/A'}\nLocation: ${town}, ${province}\nProperty link: ${propertyLink}\n\nWhat seems wrong:\n- \n\n(If possible, add a screenshot or describe the problem.)\n\nThank you.`
        );
        const reportMailto = `mailto:info@spanishcoastproperties.com?subject=${reportSubject}&body=${reportBody}`;
        const descriptionHtml = formatDescriptionHtml(description);
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
                    <div class="modal-ref">${reference || 'Ref unavailable'}</div>
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
                        <a href="tel:+34624867866" class="cta-button">Call Now</a>
                        <a href="${dossierMailto}" class="cta-button">Request to visit</a>
                    </div>
                    <div class="share-row" aria-label="Share">
                        <button type="button" class="share-btn" data-share="native">📲 Share</button>
                        <button type="button" class="share-btn" data-share="copy">📋 Copy link</button>
                        <button type="button" class="share-btn" data-share="instagram">📸 Instagram</button>
                        <button type="button" class="share-btn" data-share="tiktok">🎵 TikTok</button>
                        <a class="share-btn" href="${xShare}" target="_blank" rel="noopener">𝕏 X</a>
                        <a class="share-btn share-btn--warn" href="${reportMailto}">🚩 Report issue</a>
                        <a class="share-btn" href="${whatsappShare}" target="_blank" rel="noopener">💬 WhatsApp</a>
                        <a class="share-btn" href="${telegramShare}" target="_blank" rel="noopener">✈️ Telegram</a>
                        <a class="share-btn" href="${facebookShare}" target="_blank" rel="noopener">📣 Facebook</a>
                        <a class="share-btn" href="${linkedInShare}" target="_blank" rel="noopener">🔗 LinkedIn</a>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'block';
        preModalScrollY = window.scrollY || 0;
        setBodyOverflow('hidden');

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
                const original = btn.textContent;
                btn.textContent = `✅ Copied. Open ${appName}`;
                window.setTimeout(() => {
                    btn.textContent = original;
                }, 1800);
            });
        };

        shareToSocialApp(shareInstagramBtn, 'Instagram');
        shareToSocialApp(shareTiktokBtn, 'TikTok');

        if (shareCopyBtn) {
            shareCopyBtn.addEventListener('click', async () => {
                const original = shareCopyBtn.textContent;
                try {
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        await navigator.clipboard.writeText(propertyLink);
                    } else {
                        window.prompt('Copy link:', propertyLink);
                    }
                    shareCopyBtn.textContent = '✅ Copied';
                    window.setTimeout(() => {
                        shareCopyBtn.textContent = original;
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

    function createMarkerIcon(property) {
        if (typeof L === 'undefined' || typeof L.divIcon !== 'function') {
            return undefined;
        }

        const markerText = escapeHtml(formatListingMarkerText(property));

        return L.divIcon({
            className: 'marker-container',
            html: `
                <div class="scp-marker" aria-hidden="true">
                    <div class="scp-marker-pin">
                        <img class="scp-marker-logo" src="assets/scp-isotipo.png" alt="">
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
        sortMode = toText(sortFilterEl.value, 'featured') || 'featured';
        sortFilterEl.addEventListener('change', (event) => {
            sortMode = toText(event.target.value, 'featured') || 'featured';
            renderLimit = 60;
            renderProperties({ reset: true });
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
        sortMode = 'featured';
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
        if (sortFilterEl) sortFilterEl.value = 'featured';

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
