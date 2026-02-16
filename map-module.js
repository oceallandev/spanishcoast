/**
 * Spanish Coast Properties - Map Module
 * Extracted from app.js
 */
window.SCP_MAP = (() => {
    let map = null;
    let markersGroup = null;
    const markerMap = new Map();
    let mapDirty = true;
    let mapHasUserInteracted = false;
    let mapLastFitSignature = '';

    const getMap = () => map;

    const initMap = (containerId, options = {}) => {
        if (map) return map;
        if (!window.L) return null;

        map = L.map(containerId, {
            zoomControl: false,
            attributionControl: false,
            ...options
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        markersGroup = L.featureGroup().addTo(map);

        map.on('movestart', () => { mapHasUserInteracted = true; });

        return map;
    };

    const clearMarkers = () => {
        if (markersGroup) markersGroup.clearLayers();
        markerMap.clear();
    };

    const addMarker = (id, lat, lon, options = {}) => {
        if (!markersGroup || !window.L) return null;
        const marker = L.marker([lat, lon], options).addTo(markersGroup);
        markerMap.set(id, marker);
        return marker;
    };

    const fitBounds = (options = {}) => {
        if (!map || !markersGroup || markersGroup.getLayers().length === 0) return;
        const bounds = markersGroup.getBounds();
        const signature = `${bounds.getNorthWest().toString()}-${bounds.getSouthEast().toString()}`;

        if (signature === mapLastFitSignature && !options.force) return;
        mapLastFitSignature = signature;

        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15, ...options });
    };

    const invalidateSize = () => {
        if (map) map.invalidateSize();
    };

    return {
        init: initMap,
        getMap,
        clearMarkers,
        addMarker,
        fitBounds,
        invalidateSize,
        isDirty: () => mapDirty,
        setDirty: (v) => { mapDirty = v; },
        hasUserInteracted: () => mapHasUserInteracted
    };
})();
