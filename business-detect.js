/**
 * business-detect.js
 *
 * Scans all loaded property feeds (propertyData + customPropertyData) and
 * detects listings that are actually businesses for sale: commercial premises,
 * traspasos, shops, offices, etc.
 *
 * Detected items are appended to `window.businessListings` in the format
 * expected by catalog-page.js (businessCard renderer).
 *
 * Load AFTER all feed data scripts and BEFORE catalog-page.js.
 */
(function () {
    'use strict';

    /* ── helpers ─────────────────────────────────────────────────────────── */

    function norm(v) {
        return v == null ? '' : String(v).trim().toLowerCase();
    }

    function toText(v, fb) {
        if (typeof v === 'string') return v;
        if (v == null) return fb || '';
        return String(v);
    }

    /* ── business-type keywords (matched against property.type) ────────── */

    const BUSINESS_TYPES = [
        'commercial',
        'comercial',
        'local comercial',
        'local',              // Spanish "local" = commercial premises
        'business',
        'business premise',
        'business premises',
        'office',
        'oficina',
        'shop',
        'tienda',
        'industrial',
        'warehouse',
        'nave',
        'bar ',                // space after to avoid matching "barn"
        'restaurant',
        'restaurante',
        'salon',
        'clinic',
        'clinica',
        'premises',
    ];

    /* ── description keywords (matched against description text) ───────── */

    const BUSINESS_DESC_KEYWORDS = [
        'traspaso',
        'se traspasa',
        'business for sale',
        'negocio en venta',
        'venta de negocio',
        'business opportunity',
        'oportunidad de negocio',
        'operating business',
        'negocio en funcionamiento',
        'business transfer',
        'being transferred',
        'is transferred',
        'bar for sale',
        'restaurant for sale',
        'shop for sale',
        'salon for sale',
        'clinic for sale',
        'local en traspaso',
        'key money',
    ];

    /* ── detection function ─────────────────────────────────────────────── */

    function isBusiness(property) {
        if (!property) return false;

        const type = norm(property.type);
        const desc = norm(property.description);

        // 1. Type-based detection (high confidence)
        for (let i = 0; i < BUSINESS_TYPES.length; i++) {
            const kw = BUSINESS_TYPES[i];
            if (type.includes(kw.trim())) {
                // Special case: "premises" in type is ambiguous for new builds
                // (e.g. "Ground Floor Apartment" with "premises" in description).
                // Only match if the type itself clearly says "premises" (not in desc).
                if (kw.trim() === 'premises' && property.new_build === true) {
                    continue;
                }
                // "local" alone is too broad — only match if it's exactly "local"
                // or part of "local comercial", not "local area" etc.
                if (kw.trim() === 'local') {
                    if (type === 'local' || type.includes('local comercial')) {
                        return true;
                    }
                    continue;
                }
                return true;
            }
        }

        // 2. Description-based detection (keyword match)
        if (desc) {
            for (let i = 0; i < BUSINESS_DESC_KEYWORDS.length; i++) {
                if (desc.includes(BUSINESS_DESC_KEYWORDS[i])) {
                    // Skip false positives: new-build properties mentioning "premises"
                    // in their descriptions (they're residential with commercial ground floors)
                    if (property.new_build === true) {
                        // Only allow explicit business keywords for new builds
                        const kw = BUSINESS_DESC_KEYWORDS[i];
                        if (kw === 'business transfer' || kw === 'being transferred' || kw === 'is transferred') {
                            continue; // too generic for new builds
                        }
                    }
                    return true;
                }
            }
        }

        // 3. Listing mode / explicit kind
        const mode = norm(property.listing_mode || property.listingMode || property.mode);
        if (mode === 'traspaso' || mode === 'business') {
            return true;
        }

        return false;
    }

    /* ── determine kind (traspaso vs business) ──────────────────────────── */

    function detectKind(property) {
        const desc = norm(property.description);
        const mode = norm(property.listing_mode || property.listingMode || property.mode);
        if (mode === 'traspaso') return 'traspaso';
        if (desc.includes('traspaso') || desc.includes('se traspasa') || desc.includes('local en traspaso')) {
            return 'traspaso';
        }
        return 'business';
    }

    /* ── determine businessType label ───────────────────────────────────── */

    function detectBusinessType(property) {
        const type = norm(property.type);
        const desc = norm(property.description);

        // Try to extract a meaningful business type from the property type field
        if (type.includes('restaurant') || type.includes('restaurante')) return 'Restaurant';
        if (type.includes('bar ') || type === 'bar') return 'Bar';
        if (type.includes('salon') || type.includes('beauty')) return 'Beauty Salon';
        if (type.includes('clinic') || type.includes('clinica')) return 'Clinic';
        if (type.includes('shop') || type.includes('tienda')) return 'Shop';
        if (type.includes('office') || type.includes('oficina')) return 'Office';
        if (type.includes('warehouse') || type.includes('nave') || type.includes('industrial')) return 'Industrial';

        // Check description for clues
        if (desc.includes('restaurant') || desc.includes('restaurante')) return 'Restaurant';
        if (desc.includes('bar ') || desc.includes('bar,') || desc.includes('bar.')) return 'Bar / Restaurant';
        if (desc.includes('salon') || desc.includes('beauty') || desc.includes('peluqueria')) return 'Beauty Salon';
        if (desc.includes('supermarket') || desc.includes('supermercado')) return 'Supermarket';
        if (desc.includes('school') || desc.includes('escuela') || desc.includes('academia')) return 'School / Academy';
        if (desc.includes('hotel')) return 'Hotel';
        if (desc.includes('gym') || desc.includes('gimnasio')) return 'Gym';
        if (desc.includes('pharmacy') || desc.includes('farmacia')) return 'Pharmacy';
        if (desc.includes('bakery') || desc.includes('panaderia')) return 'Bakery';
        if (desc.includes('laundry') || desc.includes('lavanderia')) return 'Laundry';

        // Fallback: use the property type itself or generic label
        const rawType = toText(property.type, '').trim();
        if (rawType && rawType.toLowerCase() !== 'commercial' && rawType.toLowerCase() !== 'property' && rawType.toLowerCase() !== 'other') {
            return rawType;
        }

        return 'Commercial Premises';
    }

    /* ── get first image URL ────────────────────────────────────────────── */

    function getImage(property) {
        // Try images array first
        if (Array.isArray(property.images) && property.images.length > 0) {
            const first = property.images[0];
            if (typeof first === 'string') return first;
            if (first && first.url) return first.url;
        }
        // Try image property
        if (property.image) return toText(property.image);
        // Try img
        if (property.img) return toText(property.img);
        return '';
    }

    /* ── truncate description for card display ──────────────────────────── */

    function truncateDesc(desc, maxLen) {
        if (!desc) return '';
        const clean = desc.replace(/\s+/g, ' ').trim();
        if (clean.length <= maxLen) return clean;
        return clean.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
    }

    /* ── main: scan feeds and populate businessListings ─────────────────── */

    var allProps = [];

    // Collect from propertyData.
    // data.js uses `const propertyData = [...]` which is NOT on `window`,
    // so we must access it as a top-level variable via eval or try/catch.
    try {
        /* eslint-disable no-eval */
        var _pd = (typeof propertyData !== 'undefined') ? propertyData : null;
        /* eslint-enable no-eval */
        if (Array.isArray(_pd)) {
            allProps = allProps.concat(_pd);
        }
    } catch (e) {
        // propertyData not in scope — data.js may not have loaded
    }
    // Also check window.propertyData (in case it's explicitly set)
    if (Array.isArray(window.propertyData) && allProps.length === 0) {
        allProps = allProps.concat(window.propertyData);
    }
    // Collect from customPropertyData (inmovilla, summertime, newbuilds, custom feeds)
    if (Array.isArray(window.customPropertyData)) {
        allProps = allProps.concat(window.customPropertyData);
    }

    // Existing businessListings (from businesses-data.js)
    const existing = Array.isArray(window.businessListings) ? window.businessListings : [];
    const existingIds = new Set(existing.map(function (b) { return b && b.id; }).filter(Boolean));
    const existingRefs = new Set(existing.map(function (b) { return b && b.ref; }).filter(Boolean));

    const detected = [];

    for (let i = 0; i < allProps.length; i++) {
        var p = allProps[i];
        if (!p || !p.id) continue;

        // Skip if already in businessListings
        if (existingIds.has(p.id) || existingRefs.has(toText(p.ref))) continue;

        if (!isBusiness(p)) continue;

        detected.push({
            id: toText(p.id),
            ref: toText(p.ref, ''),
            kind: detectKind(p),
            title: detectBusinessType(p),
            businessType: detectBusinessType(p),
            town: toText(p.town, 'Costa Blanca South'),
            province: toText(p.province, 'Alicante'),
            price: p.price || null,
            currency: p.currency || 'EUR',
            image: getImage(p),
            description: truncateDesc(toText(p.description, ''), 400),
            latitude: p.latitude ?? p.lat ?? null,
            longitude: p.longitude ?? p.lon ?? null
        });
    }

    // Append to existing businessListings (don't overwrite manual entries)
    window.businessListings = existing.concat(detected);

    console.log(
        '[business-detect] Detected ' + detected.length +
        ' business properties from feeds. Total businessListings: ' +
        window.businessListings.length
    );
})();
