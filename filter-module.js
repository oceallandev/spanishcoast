/**
 * Spanish Coast Properties - Filter Module
 * Extracted and refined from app.js
 */
window.SCP_FILTERS = (() => {
    const normalize = (val) => String(val || '').trim().toLowerCase();

    const applyFilters = (properties, criteria) => {
        if (!properties || !Array.isArray(properties)) return [];
        if (!criteria) return properties;

        return properties.filter(p => {
            // City / Destination
            if (criteria.selectedCity && criteria.selectedCity !== 'all') {
                const town = normalize(p.town);
                if (town !== normalize(criteria.selectedCity)) return false;
            }

            // Property Type
            if (criteria.selectedType && criteria.selectedType !== 'all') {
                const type = normalize(p.type);
                if (type !== normalize(criteria.selectedType)) return false;
            }

            // Price Range
            const price = Number(p.price);
            if (criteria.minPrice && criteria.minPrice !== 'any') {
                if (price < Number(criteria.minPrice)) return false;
            }
            if (criteria.maxPrice && criteria.maxPrice !== 'any') {
                if (price > Number(criteria.maxPrice)) return false;
            }

            // Rooms
            if (criteria.minBeds && criteria.minBeds > 0) {
                if (Number(p.beds) < criteria.minBeds) return false;
            }
            if (criteria.minBaths && criteria.minBaths > 0) {
                if (Number(p.baths) < criteria.minBaths) return false;
            }

            // Features (any | yes | no)
            if (criteria.poolFilter && criteria.poolFilter !== 'any') {
                const hasPool = p.has_pool === true || p.pool === true || normalize(p.features).includes('pool');
                if (criteria.poolFilter === 'yes' && !hasPool) return false;
                if (criteria.poolFilter === 'no' && hasPool) return false;
            }

            if (criteria.parkingFilter && criteria.parkingFilter !== 'any') {
                const hasParking = p.has_parking === true || p.parking === true || normalize(p.features).includes('parking');
                if (criteria.parkingFilter === 'yes' && !hasParking) return false;
                if (criteria.parkingFilter === 'no' && hasParking) return false;
            }

            // Operation Mode (sale | rent)
            if (criteria.operationMode && criteria.operationMode !== 'any') {
                const mode = (normalize(p.ref).includes('rent') || normalize(p.type).includes('rent')) ? 'rent' : 'sale';
                if (mode !== criteria.operationMode) return false;
            }

            // Search Query
            if (criteria.searchQuery && criteria.searchQuery.length > 2) {
                const q = normalize(criteria.searchQuery);
                const searchTxt = normalize(`${p.ref} ${p.town} ${p.type} ${p.description}`);
                if (!searchTxt.includes(q)) return false;
            }

            // Ref Query
            if (criteria.refQuery && criteria.refQuery.length > 0) {
                const q = normalize(criteria.refQuery);
                if (!normalize(p.ref).includes(q)) return false;
            }

            return true;
        });
    };

    const sortProperties = (properties, mode) => {
        if (!properties || !Array.isArray(properties)) return [];
        const sorted = [...properties];
        switch (mode) {
            case 'price_asc':
                return sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
            case 'price_desc':
                return sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
            case 'date_desc':
            default:
                // Fallback to ID comparison if date is missing
                return sorted.sort((a, b) => {
                    const dateA = a.created_at || a.date_added || 0;
                    const dateB = b.created_at || b.date_added || 0;
                    if (dateA && dateB) return new Date(dateB) - new Date(dateA);
                    return String(b.ref).localeCompare(String(a.ref));
                });
        }
    };

    return {
        applyFilters,
        sortProperties
    };
})();
