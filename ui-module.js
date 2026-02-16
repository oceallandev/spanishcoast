/**
 * Spanish Coast Properties - UI Module
 * Extracted from app.js
 */
window.SCP_UI = (() => {
    const { toText, escapeHtml, t, formatPrice, imageUrlsFor, builtAreaFor, propertyIdFor } = window.SCP_UTILS;

    const formatDescriptionHtml = (rawDescription) => {
        let text = (rawDescription || '').trim();
        if (!text) return '<p>' + t('modal.description_placeholder', 'Property details coming soon.') + '</p>';

        const isHeadingLine = (l) => l.length < 100 && /^[A-Z][A-Z0-9\s\-&]{3,}$/.test(l);
        const headingEmoji = (l) => {
            const u = l.toUpperCase();
            if (u.includes('IMPORTANT')) return '🛠️';
            if (u.includes('ECONOMY')) return '💶';
            if (u.includes('AREA')) return '📍';
            if (u.includes('DETAIL')) return '📌';
            return '✨';
        };

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const blocks = [];
        let listItems = [];

        const flushList = () => {
            if (listItems.length > 0) {
                blocks.push(`<ul class="desc-list">${listItems.join('')}</ul>`);
                listItems = [];
            }
        };

        lines.forEach(line => {
            if (isHeadingLine(line)) {
                flushList();
                blocks.push(`<h4 class="desc-heading">${headingEmoji(line)} ${escapeHtml(line)}</h4>`);
            } else if (line.startsWith('-') || line.startsWith('•')) {
                listItems.push(`<li>${escapeHtml(line.substring(1).trim())}</li>`);
            } else {
                flushList();
                blocks.push(`<p>${escapeHtml(line)}</p>`);
            }
        });
        flushList();
        return blocks.join('');
    };

    const renderPropertyCard = (property, isFav, options = {}) => {
        const type = toText(property.type, t('modal.type_default', 'Property'));
        const reference = toText(property.ref).trim();
        const town = toText(property.town, t('modal.town_unknown', 'Unknown Area'));
        const province = toText(property.province, 'Alicante');
        const price = options.priceText || '';

        return `
            <div class="property-card" data-property-id="${property.id}" role="button" tabindex="0">
                <div class="card-img-wrapper">
                    <img src="${imageUrlsFor(property)[0]}" alt="${escapeHtml(type)}" loading="lazy">
                    <div class="card-badge">${escapeHtml(type)}</div>
                    <button type="button" class="fav-btn ${isFav ? 'is-fav' : ''}">${isFav ? '♥' : '♡'}</button>
                </div>
                <div class="card-content">
                    <div class="card-ref">${reference || t('listing.reference_unavailable', 'Ref unavailable')}</div>
                    <h3>${escapeHtml(type)} in ${escapeHtml(town)}</h3>
                    <div class="location">${escapeHtml(town)}, ${escapeHtml(province)}</div>
                    <div class="price">${price}</div>
                </div>
            </div>
        `;
    };

    const openPropertyModal = (property, options = {}) => {
        const modal = document.getElementById('property-modal');
        const details = document.getElementById('modal-details');
        if (!modal || !details) return;

        const type = toText(property.type, t('modal.type_default', 'Property'));
        const ref = toText(property.ref).trim();
        const town = toText(property.town, t('modal.town_unknown', 'Unknown Area'));
        const price = formatPrice(property.price);
        const descHtml = formatDescriptionHtml(property.description);

        details.innerHTML = `
            <div class="modal-body">
                <div class="modal-info">
                    <div class="card-badge">${escapeHtml(type)}</div>
                    <div class="modal-ref">${ref || 'Ref unavailable'}</div>
                    <h2>${escapeHtml(type)} in ${escapeHtml(town)}</h2>
                    <div class="price">${price}</div>
                </div>
                <div class="modal-gallery">
                    <img src="${imageUrlsFor(property)[0]}" alt="Property">
                </div>
                <div class="desc">${descHtml}</div>
            </div>
        `;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    const closePropertyModal = () => {
        const modal = document.getElementById('property-modal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
    };

    const renderProperties = (container, countEl, state, options = {}) => {
        if (!container || !countEl) return;

        if (options.reset) {
            container.innerHTML = '';
            state.renderedPropertyIds.clear();
            state.renderSequence = 0;
        }

        const properties = state.currentProperties || [];
        countEl.textContent = String(properties.length);

        if (properties.length === 0) {
            container.innerHTML = `<p>${t('listing.no_results', 'No properties found.')}</p>`;
            return;
        }

        const visible = properties.slice(0, state.renderLimit || 60);
        visible.forEach(property => {
            const pid = window.SCP_UTILS.propertyIdFor(property);
            if (!pid || state.renderedPropertyIds.has(pid)) return;

            const isFav = state.favoriteIds.has(pid);
            const cardHtml = renderPropertyCard(property, isFav, { priceText: formatPrice(property.price) });
            const cardWrapper = document.createElement('div');
            cardWrapper.innerHTML = cardHtml.trim();
            const card = cardWrapper.firstChild;

            // Add animation delay
            card.style.animationDelay = `${(state.renderSequence % 6) * 0.08}s`;
            state.renderSequence += 1;

            container.appendChild(card);
            state.renderedPropertyIds.add(pid);

            // Add events
            card.addEventListener('click', () => openPropertyModal(property));
        });
    };

    const syncViewportHeightVar = () => {
        document.documentElement.style.setProperty('--app-vh', `${window.innerHeight}px`);
    };

    const setBodyOverflow = (mode, isPropertiesSection) => {
        if (isPropertiesSection) {
            document.body.style.overflow = '';
            return;
        }
        document.body.style.overflow = mode;
    };

    const setFavButtonState = (btn, isFav, { compact = false } = {}) => {
        if (!btn) return;
        btn.classList.toggle('is-fav', isFav);
        if (compact) {
            btn.innerHTML = isFav ? '♥' : '♡';
        } else {
            const label = btn.querySelector('.fav-label');
            if (label) {
                label.textContent = isFav ? t('fav.remove', 'Remove from Favorites') : t('fav.add', 'Add to Favorites');
            }
        }
    };

    const syncFiltersBarHeight = (filtersBar) => {
        if (!filtersBar) return;
        if (window.matchMedia && window.matchMedia('(max-width: 1024px)').matches) {
            document.documentElement.style.removeProperty('--filters-bar-height');
            return;
        }
        const height = Math.ceil(filtersBar.getBoundingClientRect().height);
        if (height > 0) {
            document.documentElement.style.setProperty('--filters-bar-height', `${height}px`);
        }
    };

    const setLoadingState = (container, isLoading) => {
        if (!container) return;
        if (isLoading) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>${t('ui.loading', 'Loading listings...')}</p>
                </div>
            `;
        } else {
            // Container will be cleared by renderProperties reset anyway, 
            // but we can clear it here if needed.
        }
    };

    return {
        renderPropertyCard,
        formatDescriptionHtml,
        openPropertyModal,
        closePropertyModal,
        renderProperties,
        setLoadingState,
        syncViewportHeightVar,
        setBodyOverflow,
        setFavButtonState,
        syncFiltersBarHeight
    };
})();
