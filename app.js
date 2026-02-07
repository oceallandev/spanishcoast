document.addEventListener('DOMContentLoaded', () => {
    const rawProperties = Array.isArray(propertyData) ? propertyData : [];
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
    let currentGalleryIndex = 0;
    let currentGalleryImages = [];
    let map;
    let markersGroup;
    const markerMap = new Map();
    let propertiesInitialized = false;
    let activeSection = 'home';
    let miniMap = null;
    let miniMapMarker = null;

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
    const priceFilter = document.getElementById('price-filter');
    const bedsFilter = document.getElementById('beds-filter');
    const bathsFilter = document.getElementById('baths-filter');
    const poolFilterEl = document.getElementById('pool-filter');
    const parkingFilterEl = document.getElementById('parking-filter');
    const applyBtn = document.getElementById('apply-filters');

    const toggleMapBtn = document.getElementById('toggle-map-btn');
    const mapSection = document.getElementById('map-section');

    const modal = document.getElementById('property-modal');
    const modalDetails = document.getElementById('modal-details');
    const closeModal = document.querySelector('.close-modal');

    const lightbox = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeLightbox = document.querySelector('.close-lightbox');

    const mainLogoImg = document.getElementById('main-logo-img');
    const searchPill = document.querySelector('.search-pill');
    const toggleAdvancedBtn = document.getElementById('toggle-advanced-btn');
    const openFiltersBtn = document.getElementById('open-filters-btn');
    const closeFiltersBtn = document.getElementById('close-filters-btn');
    const filtersBackdrop = document.getElementById('filters-backdrop');
    const footerYear = document.getElementById('footer-year');

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

    function priceNumber(property) {
        const number = Number(property && property.price);
        return Number.isFinite(number) ? number : NaN;
    }

    function formatPrice(price) {
        const number = Number(price);
        if (!Number.isFinite(number)) {
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
        const url = new URL(window.location.href);
        url.searchParams.set('section', 'properties');
        if (reference) {
            url.searchParams.set('ref', reference);
        }
        return url.toString();
    }

    function updateBrowserRefParam(reference) {
        if (!window.history || typeof window.history.replaceState !== 'function') {
            return;
        }
        const url = new URL(window.location.href);
        url.searchParams.set('section', 'properties');
        if (reference) {
            url.searchParams.set('ref', reference);
        } else {
            url.searchParams.delete('ref');
        }
        window.history.replaceState({}, '', url.toString());
    }

    function setActiveNavLink(sectionKey) {
        navLinks.forEach((button) => {
            button.classList.toggle('active', button.dataset.section === sectionKey);
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

        refQuery = reference;
        if (refSearchInput) {
            refSearchInput.value = reference;
        }
        filterProperties();

        const exactMatch = currentProperties.find((property) => normalize(property.ref) === normalize(reference));
        if (exactMatch) {
            openPropertyModal(exactMatch);
        }
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
        const price = priceNumber(property);
        if (!Number.isFinite(price) || price <= 0 || built <= 0) {
            return null;
        }
        const perSqm = Math.round(price / built);
        return `€${numberFormat.format(perSqm)}/m2`;
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

            const propertyPrice = priceNumber(property);
            const propertyBeds = Number(property.beds) || 0;
            const propertyBaths = Number(property.baths) || 0;

            const matchesRef = loweredRef === '' || ref.includes(loweredRef);
            const matchesCity = matchesDestination(property, selectedCity);
            const typeNorm = normalize(property.type);
            let matchesType = true;
            if (selectedType !== 'all') {
                const selectedNorm = normalize(selectedType);
                if (selectedNorm === 'apartment') {
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

            return matchesRef
                && matchesCity
                && matchesType
                && matchesSearch
                && matchesPrice
                && matchesBeds
                && matchesBaths
                && matchesPool
                && matchesParking;
        });

        renderProperties();
        updateMapMarkers();
    }

    function renderProperties() {
        if (!propertyGrid || !resultsCount) {
            return;
        }

        propertyGrid.innerHTML = '';
        resultsCount.textContent = String(currentProperties.length);

        if (currentProperties.length === 0) {
            propertyGrid.innerHTML = '<p style="color:#94a3b8">No properties found for these filters.</p>';
            return;
        }

        currentProperties.forEach((property, index) => {
            const card = document.createElement('div');
            card.className = 'property-card';
            card.style.animationDelay = `${(index % 6) * 0.08}s`;
            const propertyId = idKey(property.id);
            card.dataset.propertyId = propertyId;

            const imageUrl = Array.isArray(property.images) && property.images.length > 0
                ? property.images[0]
                : 'assets/placeholder.png';

            const type = toText(property.type, 'Property');
            const town = toText(property.town, 'Unknown Area');
            const province = toText(property.province, 'Alicante');
            const beds = Number(property.beds) || 0;
            const baths = Number(property.baths) || 0;
            const builtArea = builtAreaFor(property);
            const eurPerSqm = eurPerSqmFor(property);

            card.innerHTML = `
                <div class="card-img-wrapper">
                    <img src="${imageUrl}" alt="${type}" loading="lazy" onerror="this.src='assets/placeholder.png'">
                    <div class="card-badge">${type}</div>
                </div>
                <div class="card-content">
                    <div class="card-ref">${toText(property.ref)}</div>
                    <h3>${type} in ${town}</h3>
                    <div class="location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ${town}, ${province}
                    </div>
                    <div class="price">${formatPrice(property.price)}</div>
                    <div class="specs">
                        <div class="spec-item">🛏️ Beds ${beds}</div>
                        <div class="spec-item">🛁 Baths ${baths}</div>
                        <div class="spec-item">📐 Area ${builtArea}m2</div>
                        ${eurPerSqm ? `<div class="spec-item">📊 ${eurPerSqm}</div>` : ''}
                    </div>
                </div>
            `;

            card.addEventListener('click', () => {
                openPropertyModal(property);
            });

            card.addEventListener('mouseenter', () => {
                setCardActive(propertyId, true);
                setMarkerActive(propertyId, true);
            });

            card.addEventListener('mouseleave', () => {
                setCardActive(propertyId, false);
                setMarkerActive(propertyId, false);
            });

            propertyGrid.appendChild(card);
            animationObserver.observe(card);
        });
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

    function openPropertyModal(property) {
        if (!modal || !modalDetails) {
            return;
        }

        const images = Array.isArray(property.images) && property.images.length > 0
            ? property.images
            : ['assets/placeholder.png'];
        const features = featuresFor(property);

        currentGalleryImages = images;
        currentGalleryIndex = 0;

        const type = toText(property.type, 'Property');
        const reference = toText(property.ref).trim();
        const town = toText(property.town, 'Unknown Area');
        const province = toText(property.province, 'Alicante');
        const description = toText(property.description, 'Property details coming soon.');
        const beds = Number(property.beds) || 0;
        const baths = Number(property.baths) || 0;
        const builtArea = builtAreaFor(property);
        const eurPerSqm = eurPerSqmFor(property);
        const propertyLink = buildPropertyLink(reference);
        const dossierSubject = encodeURIComponent(`Request Dossier - ${reference || `${town} ${type}`}`);
        const shareTitle = `${reference || 'Property'} - ${town}, ${province}`;
        const shareTextRaw = `Check this ${type}${reference ? ` (${reference})` : ''} in ${town}: ${propertyLink}`;
        const shareText = encodeURIComponent(shareTextRaw);
        const shareUrl = encodeURIComponent(propertyLink);
        const whatsappShare = `https://wa.me/?text=${shareText}`;
        const telegramShare = `https://t.me/share/url?url=${shareUrl}&text=${shareText}`;
        const facebookShare = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
        const linkedInShare = `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`;
        const dossierBody = encodeURIComponent(
            `Hello Spanish Coast Properties,\n\nPlease send me full details for this property.\n\nReference: ${reference || 'N/A'}\nType: ${type}\nLocation: ${town}, ${province}\nPrice: ${formatPrice(property.price)}\nProperty link: ${propertyLink}\n\nThank you.`
        );
        const dossierMailto = `mailto:info@spanishcoastproperties.com?subject=${dossierSubject}&body=${dossierBody}`;
        const descriptionHtml = formatDescriptionHtml(description);
        updateBrowserRefParam(reference);

        modalDetails.innerHTML = `
            <div class="modal-body">
                <div class="modal-info">
                    <div class="card-badge">${type}</div>
                    <div class="modal-ref">${reference || 'Ref unavailable'}</div>
                    <h2>${town} Coastal Sanctuary</h2>
                    <div class="location">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ${town}, ${province}
                    </div>
                    <div class="price">${formatPrice(property.price)}</div>
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
                        <img id="main-gallery-img" src="${images[0]}" alt="Property View" onerror="this.src='assets/placeholder.png'">
                        <button class="nav-arrow next" id="next-img">❯</button>
                    </div>
                    <div class="gallery-thumbs-container">
                        <button class="thumb-nav prev" id="prev-thumbs">❮</button>
                        <div class="gallery-thumbs">
                            ${images.map((img, index) => `
                                <div class="thumb ${index === 0 ? 'active' : ''}" data-index="${index}">
                                    <img src="${img}" alt="Thumbnail ${index + 1}" onerror="this.src='assets/placeholder.png'">
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
                            <a class="mini-map-link" href="https://www.google.com/maps?q=${Number(property.latitude)},${Number(property.longitude)}" target="_blank" rel="noopener">Open in Google Maps</a>
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
                        <a href="${dossierMailto}" class="cta-button">Request Dossier</a>
                    </div>
                    <div class="share-row" aria-label="Share">
                        <button type="button" class="share-btn" data-share="native">📲 Share</button>
                        <button type="button" class="share-btn" data-share="copy">📋 Copy link</button>
                        <a class="share-btn" href="${whatsappShare}" target="_blank" rel="noopener">💬 WhatsApp</a>
                        <a class="share-btn" href="${telegramShare}" target="_blank" rel="noopener">✈️ Telegram</a>
                        <a class="share-btn" href="${facebookShare}" target="_blank" rel="noopener">📣 Facebook</a>
                        <a class="share-btn" href="${linkedInShare}" target="_blank" rel="noopener">🔗 LinkedIn</a>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

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
                lightboxImg.src = mainImg.src;
                lightbox.style.display = 'flex';
            });
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

    function createMarkerIcon(price) {
        if (typeof L === 'undefined' || typeof L.divIcon !== 'function') {
            return undefined;
        }

        return L.divIcon({
            className: 'marker-container',
            html: `<div class="branded-marker">${formatMarkerPrice(price)}</div>`,
            iconSize: [76, 28],
            iconAnchor: [38, 14]
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
    }

    function updateMapMarkers() {
        if (!map || !markersGroup || typeof L === 'undefined') {
            return;
        }

        if (typeof markersGroup.clearLayers === 'function') {
            markersGroup.clearLayers();
        }

        markerMap.clear();

        const bounds = [];

        currentProperties.forEach((property) => {
            const propertyId = idKey(property.id);
            const latitude = Number(property.latitude);
            const longitude = Number(property.longitude);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                return;
            }

            const marker = L.marker([latitude, longitude], {
                icon: createMarkerIcon(property.price),
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

        if (bounds.length > 0) {
            map.fitBounds(bounds, {
                padding: [24, 24],
                maxZoom: 13
            });
        }
    }

    // --- Event Listeners ---
    if (footerYear) {
        footerYear.textContent = String(new Date().getFullYear());
    }

    if (toggleAdvancedBtn && searchPill) {
        toggleAdvancedBtn.addEventListener('click', () => {
            const next = !searchPill.classList.contains('advanced-open');
            searchPill.classList.toggle('advanced-open', next);
            toggleAdvancedBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
            toggleAdvancedBtn.textContent = next ? 'Less' : 'More';
        });
    }

    const openFilters = () => {
        if (activeSection !== 'properties') return;
        document.body.classList.add('filters-open');
        if (searchPill) {
            searchPill.classList.add('advanced-open');
        }
        if (toggleAdvancedBtn) {
            toggleAdvancedBtn.setAttribute('aria-expanded', 'true');
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

    navLinks.forEach((button) => {
        button.addEventListener('click', () => {
            setActiveSection(button.dataset.section);
        });
    });

    sectionJumpButtons.forEach((button) => {
        button.addEventListener('click', () => {
            setActiveSection(button.dataset.sectionJump);
        });
    });

    window.addEventListener('popstate', () => {
        const url = new URL(window.location.href);
        const ref = toText(url.searchParams.get('ref')).trim();
        const section = toText(url.searchParams.get('section')).trim();
        const next = ref ? 'properties' : (section || 'home');
        setActiveSection(next, { pushUrl: false });
    });

    if (refSearchInput) {
        refSearchInput.addEventListener('input', (event) => {
            refQuery = toText(event.target.value).trim();
            filterProperties();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            searchQuery = toText(event.target.value).trim();
            filterProperties();
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            selectedType = typeFilter ? typeFilter.value : 'all';
            maxPrice = priceFilter ? priceFilter.value : 'any';
            minBeds = bedsFilter ? Number(bedsFilter.value) || 0 : 0;
            minBaths = bathsFilter ? Number(bathsFilter.value) || 0 : 0;
            poolFilter = poolFilterEl ? poolFilterEl.value : 'any';
            parkingFilter = parkingFilterEl ? parkingFilterEl.value : 'any';
            filterProperties();
            closeFilters();
        });
    }

    if (toggleMapBtn && mapSection) {
        toggleMapBtn.addEventListener('click', () => {
            mapSection.classList.toggle('active');
            const mapIsOpen = mapSection.classList.contains('active');
            toggleMapBtn.textContent = mapIsOpen ? '📋 List' : '🗺️ Map';

            if (map && typeof map.invalidateSize === 'function') {
                window.setTimeout(() => map.invalidateSize(), 240);
            }
        });
    }

    if (mainLogoImg) {
        mainLogoImg.addEventListener('click', () => {
            if (activeSection !== 'properties') {
                setActiveSection('home');
                return;
            }

            selectedCity = 'all';
            selectedType = 'all';
            searchQuery = '';
            refQuery = '';
            maxPrice = 'any';
            minBeds = 0;
            minBaths = 0;
            poolFilter = 'any';
            parkingFilter = 'any';

            if (refSearchInput) refSearchInput.value = '';
            if (searchInput) searchInput.value = '';
            if (typeFilter) typeFilter.value = 'all';
            if (priceFilter) priceFilter.value = 'any';
            if (bedsFilter) bedsFilter.value = '0';
            if (bathsFilter) bathsFilter.value = '0';
            if (poolFilterEl) poolFilterEl.value = 'any';
            if (parkingFilterEl) parkingFilterEl.value = 'any';

            const cityButtons = cityButtonsContainer
                ? cityButtonsContainer.querySelectorAll('.city-btn')
                : [];
            cityButtons.forEach((button) => {
                button.classList.toggle('active', button.dataset.city === 'all');
            });

            updateBrowserRefParam('');
            filterProperties();
        });
    }

    if (closeModal && modal) {
        closeModal.addEventListener('click', () => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    }

    if (closeLightbox && lightbox) {
        closeLightbox.addEventListener('click', () => {
            lightbox.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (modal && event.target === modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }

        if (lightbox && event.target === lightbox) {
            lightbox.style.display = 'none';
        }
    });

    const mesh = document.querySelector('.bg-mesh');
    document.addEventListener('mousemove', (event) => {
        if (!mesh) {
            return;
        }

        const x = event.clientX / window.innerWidth;
        const y = event.clientY / window.innerHeight;
        mesh.style.transform = `translate(${x * 20}px, ${y * 20}px) scale(1.1)`;
    });

    // --- Initialization ---
    renderCatalogs();

    const initialUrl = new URL(window.location.href);
    const initialRef = toText(initialUrl.searchParams.get('ref')).trim();
    const initialSection = toText(initialUrl.searchParams.get('section')).trim();
    const startSection = initialRef ? 'properties' : (initialSection || 'home');

    setActiveSection(startSection, { pushUrl: false });
});
