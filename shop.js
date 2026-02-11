(() => {
  const grid = document.getElementById('shop-grid');
  const qEl = document.getElementById('shop-q');
  const catEl = document.getElementById('shop-category');
  const sortEl = document.getElementById('shop-sort');
  const countEl = document.getElementById('shop-count');
  const metaEl = document.getElementById('shop-meta');

  const modal = document.getElementById('shop-modal');
  const modalBody = document.getElementById('shop-modal-body');
  const modalClose = document.getElementById('shop-modal-close');

  const toText = (v, fb = '') => (typeof v === 'string' ? v : v == null ? fb : String(v));
  const norm = (v) => toText(v).trim().toLowerCase();
  const getClient = () => window.scpSupabase || null;
  const getBasket = () => window.SCP_BASKET || null;

  const t = (key, fallback, vars) => {
    try {
      if (window.SCP_I18N && typeof window.SCP_I18N.t === 'function') return window.SCP_I18N.t(key, vars);
    } catch {
      // ignore
    }
    return fallback !== undefined ? String(fallback) : String(key || '');
  };

  const esc = (s) => toText(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const decodeHtmlEntities = (value) => {
    try {
      const parser = document.createElement('textarea');
      parser.innerHTML = toText(value);
      return parser.value;
    } catch {
      return toText(value);
    }
  };

  const splitSentenceChunks = (line) => {
    return toText(line)
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
  };

  const formatProductDescriptionHtml = (rawDescription) => {
    let text = decodeHtmlEntities(rawDescription)
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n?/g, '\n')
      // Some imports include literal "\n" sequences rather than actual newlines.
      .replace(/\\r\\n/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, ' ')
      .replace(/\t/g, ' ')
      // Recover structure from "spacer" formatting commonly found in dropship imports.
      .replace(/[ ]{3,}/g, '\n')
      .replace(/[ ]+\n/g, '\n')
      .replace(/\n[ ]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!text) return '';

    // Remove leading/trailing wrapper quotes that appear in some feeds.
    text = text.replace(/^[`"'“”]+/, '').replace(/[`"'“”]+$/, '').trim();

    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return '';

    const blocks = [];
    let listItems = [];

    const flushList = () => {
      if (!listItems.length) return;
      blocks.push(`<ul class="desc-list">${listItems.join('')}</ul>`);
      listItems = [];
    };

    lines.forEach((line) => {
      const safe = toText(line).trim();
      if (!safe) return;

      // Headings like "Main Features:" or "Specification:".
      if (safe.length <= 64 && /:$/.test(safe) && !/\bhttps?:\/\//i.test(safe)) {
        flushList();
        blocks.push(`<h4 class="desc-heading">${esc(safe.replace(/:\s*$/, ''))}</h4>`);
        return;
      }

      if (/^[-•*]\s+/.test(safe)) {
        const item = safe.replace(/^[-•*]\s+/, '').trim();
        if (item) listItems.push(`<li>${esc(item)}</li>`);
        return;
      }

      if (/^\d+\s*[.)]\s+/.test(safe)) {
        const item = safe.replace(/^\d+\s*[.)]\s+/, '').trim();
        if (item) listItems.push(`<li>${esc(item)}</li>`);
        return;
      }

      // Short key-value lines ("Brand: X", "Voltage: 220V").
      if (/^[A-Za-zÀ-ÖØ-öø-ÿ0-9][^:]{1,48}:\s*\S+/.test(safe) && safe.length < 160) {
        listItems.push(`<li>${esc(safe)}</li>`);
        return;
      }

      const chunks = splitSentenceChunks(safe);
      if (safe.length > 220 && chunks.length >= 3) {
        chunks.forEach((chunk) => listItems.push(`<li>${esc(chunk)}</li>`));
        return;
      }

      flushList();
      blocks.push(`<p>${esc(safe)}</p>`);
    });

    flushList();
    return blocks.join('');
  };

  const money = (amount, { currency = 'EUR', symbol = '€' } = {}) => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return '';
    try {
      return new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2
      }).format(n);
    } catch {
      return `${symbol}${n.toFixed(2).replace(/\\.00$/, '')}`;
    }
  };

  const categoriesFor = (p) => {
    const cats = Array.isArray(p && p.categories) ? p.categories : [];
    return cats.map((c) => toText(c && c.name).trim()).filter(Boolean);
  };

  const primaryCategoryFor = (p) => categoriesFor(p)[0] || 'Device';

  const imageFor = (p) => {
    const imgs = Array.isArray(p && p.images) ? p.images : [];
    return toText(imgs[0] || '').trim();
  };

  const productUrlFor = (p) => toText(p && (p.url || p.permalink || p.link)).trim();

  const addToBasket = (p, { qty = 1 } = {}) => {
    const basket = getBasket();
    if (!basket || typeof basket.add !== 'function') return { ok: false, count: 0 };

    const name = toText(p && p.name, 'Product');
    const sku = toText(p && p.sku).trim();
    const img = imageFor(p) || 'assets/placeholder.png';
    const url = productUrlFor(p);
    const cur = toText(p && p.currency, 'EUR') || 'EUR';
    const sym = toText(p && p.currency_symbol, '€') || '€';

    const res = basket.add({
      wc_id: p && p.id != null ? p.id : '',
      qty,
      name,
      sku,
      url,
      image: img,
      currency: cur,
      currency_symbol: sym,
      price: p && p.price != null && p.price !== '' ? Number(p.price) : null
    }, { qty });

    if (metaEl && res && res.ok) {
      const prev = metaEl.textContent || '';
      metaEl.textContent = t('shop.basket.added', 'Added to basket', { count: res.count }) + ` (${res.count})`;
      window.setTimeout(() => {
        try {
          metaEl.textContent = prev;
        } catch {
          // ignore
        }
      }, 1400);
    }

    return res;
  };

  const whatsappHrefFor = (p) => {
    const url = productUrlFor(p);
    const title = toText(p && p.name, 'Product');
    const sku = toText(p && p.sku).trim();
    const cur = toText(p && p.currency, 'EUR') || 'EUR';
    const sym = toText(p && p.currency_symbol, '€') || '€';
    const priceLine = p && p.price ? money(p.price, { currency: cur, symbol: sym }) : '';

    const lines = [
      'Smart Devices inquiry',
      sku ? `SKU: ${sku}` : '',
      title,
      priceLine ? `Price: ${priceLine}` : '',
      url ? `Link: ${url}` : ''
    ].filter(Boolean);

    const text = encodeURIComponent(lines.join('\n'));
    return `https://wa.me/?text=${text}`;
  };

  const emailHrefFor = (p) => {
    const url = productUrlFor(p);
    const title = toText(p && p.name, 'Product');
    const sku = toText(p && p.sku).trim();
    const subject = encodeURIComponent(`Smart Devices - ${title}`);
    const bodyLines = [
      'Hello Spanish Coast Properties,',
      '',
      'I am interested in this smart device:',
      sku ? `SKU: ${sku}` : '',
      `Product: ${title}`,
      url ? `Link: ${url}` : '',
      '',
      'I would like help with:',
      '- Installation / setup',
      '- Connectivity/networking (if needed)',
      '- Ongoing management (optional)',
      '',
      'Town / address:',
      'Timeline:',
      '',
      'Thank you.'
    ].filter(Boolean);
    const body = encodeURIComponent(bodyLines.join('\n'));
    return `mailto:info@spanishcoastproperties.com?subject=${subject}&body=${body}`;
  };

  const parseDate = (v) => {
    const t = Date.parse(toText(v));
    return Number.isFinite(t) ? t : 0;
  };

  const baseProducts = Array.isArray(window.shopProducts) ? window.shopProducts : [];
  let allProducts = baseProducts.slice();
  const meta = window.shopProductsMeta || null;

  const setMeta = () => {
    if (!metaEl) return;
    const src = meta && meta.source ? toText(meta.source) : 'woocommerce';
    const storeUrl = meta && meta.store_url ? toText(meta.store_url) : '';
    const gen = meta && meta.generated_at ? toText(meta.generated_at) : '';

    const parts = [];
    if (src) parts.push(`Source: ${src}`);
    if (gen) parts.push(`Synced: ${gen}`);
    if (storeUrl) parts.push(`Store: ${storeUrl}`);
    metaEl.textContent = parts.length ? parts.join(' · ') : '';
  };

  const computeCategories = (items) => {
    const set = new Map();
    (Array.isArray(items) ? items : []).forEach((p) => {
      categoriesFor(p).forEach((name) => {
        const key = norm(name);
        if (!key) return;
        if (!set.has(key)) set.set(key, name);
      });
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  };

  let categories = computeCategories(allProducts);

  const populateCategorySelect = () => {
    if (!catEl) return;
    const existing = new Set(Array.from(catEl.querySelectorAll('option')).map((o) => o.value));
    categories.forEach((c) => {
      const key = norm(c);
      if (!key || existing.has(key)) return;
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = c;
      catEl.appendChild(opt);
    });
  };

  const getFilters = () => ({
    q: norm(qEl && qEl.value),
    cat: norm(catEl && catEl.value),
    sort: norm(sortEl && sortEl.value) || 'newest'
  });

  const matches = (p, { q, cat }) => {
    if (cat && cat !== 'all') {
      const cats = categoriesFor(p).map(norm);
      if (!cats.includes(cat)) return false;
    }
    if (!q) return true;

    const hay = [
      toText(p && p.name),
      toText(p && p.sku),
      categoriesFor(p).join(' '),
      toText(p && p.short_text),
      toText(p && p.desc_text)
    ].join(' ').toLowerCase();
    return hay.includes(q);
  };

  const boostFor = (p) => {
    const n = Number(p && p.sort_boost);
    return Number.isFinite(n) ? n : 0;
  };

  const sortProducts = (items, sortMode) => {
    const out = items.slice();
    if (sortMode === 'price_asc') {
      out.sort((a, b) => {
        const ba = boostFor(a);
        const bb = boostFor(b);
        if (bb !== ba) return bb - ba;
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      });
      return out;
    }
    if (sortMode === 'price_desc') {
      out.sort((a, b) => {
        const ba = boostFor(a);
        const bb = boostFor(b);
        if (bb !== ba) return bb - ba;
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      });
      return out;
    }
    if (sortMode === 'sale') {
      out.sort((a, b) => {
        const ba = boostFor(a);
        const bb = boostFor(b);
        if (bb !== ba) return bb - ba;
        const sa = a && a.on_sale ? 1 : 0;
        const sb = b && b.on_sale ? 1 : 0;
        if (sb !== sa) return sb - sa;
        return parseDate(b && b.date_created) - parseDate(a && a.date_created);
      });
      return out;
    }
    // newest
    out.sort((a, b) => {
      const ba = boostFor(a);
      const bb = boostFor(b);
      if (bb !== ba) return bb - ba;
      return parseDate(b && b.date_created) - parseDate(a && a.date_created);
    });
    return out;
  };

  const mapOverrideCategories = (v) => {
    if (Array.isArray(v)) {
      return v.map((x) => toText(x).trim()).filter(Boolean);
    }
    if (typeof v === 'string') {
      return v
        .split(',')
        .map((x) => toText(x).trim())
        .filter(Boolean);
    }
    return [];
  };

  const mapOverrideImages = (v) => {
    if (Array.isArray(v)) {
      return v.map((x) => toText(x).trim()).filter(Boolean);
    }
    if (typeof v === 'string') {
      return v
        .split(/[\n,]+/g)
        .map((x) => toText(x).trim())
        .filter(Boolean);
    }
    return [];
  };

  const mergeOverrides = (base, overridesRows) => {
    const map = new Map();
    (Array.isArray(overridesRows) ? overridesRows : []).forEach((r) => {
      const id = toText(r && r.wc_id).trim();
      if (id) map.set(id, r);
    });

    const out = [];
    (Array.isArray(base) ? base : []).forEach((p) => {
      if (!p || p.id == null) return;
      const key = toText(p.id).trim();
      const o = map.get(key) || null;
      if (!o) {
        out.push(p);
        return;
      }
      if (o.app_visible === false) return;

      const merged = { ...p };
      merged.sort_boost = Number(o.sort_boost) || 0;

      if (toText(o.name).trim()) merged.name = toText(o.name).trim();
      if (toText(o.sku).trim()) merged.sku = toText(o.sku).trim();
      if (toText(o.url).trim()) merged.url = toText(o.url).trim();
      if (toText(o.currency).trim()) merged.currency = toText(o.currency).trim();
      if (toText(o.currency_symbol).trim()) merged.currency_symbol = toText(o.currency_symbol).trim();

      if (o.price != null && o.price !== '') merged.price = Number(o.price);
      if (o.regular_price != null && o.regular_price !== '') merged.regular_price = Number(o.regular_price);
      if (o.sale_price != null && o.sale_price !== '') merged.sale_price = Number(o.sale_price);

      // Derive on_sale from prices (keeps UI consistent).
      const sale = Number(merged.sale_price);
      const reg = Number(merged.regular_price);
      merged.on_sale = Number.isFinite(sale) && Number.isFinite(reg) && sale > 0 && reg > 0 && sale < reg;

      if (toText(o.short_text).trim()) merged.short_text = toText(o.short_text).trim();
      if (toText(o.desc_text).trim()) merged.desc_text = toText(o.desc_text).trim();

      const catNames = mapOverrideCategories(o.categories);
      if (catNames.length) merged.categories = catNames.map((name) => ({ id: null, name, slug: '' }));

      const imgs = mapOverrideImages(o.images);
      if (imgs.length) merged.images = imgs;

      out.push(merged);
    });
    return out;
  };

  const fetchOverrides = async () => {
    const client = getClient();
    if (!client) return [];
    try {
      const { data, error } = await client
        .from('shop_product_overrides')
        .select('wc_id,published,app_visible,sort_boost,name,sku,url,price,regular_price,sale_price,currency,currency_symbol,categories,images,short_text,desc_text')
        .eq('published', true);
      if (error) return [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  const applyOverridesFromSupabase = async () => {
    const rows = await fetchOverrides();
    if (!rows.length) return;
    allProducts = mergeOverrides(baseProducts, rows);
    categories = computeCategories(allProducts);
    populateCategorySelect();
    renderGrid();
  };

  const renderGrid = () => {
    if (!grid || !countEl) return;
    if (!allProducts.length) {
      grid.innerHTML = `
        <div class="glass panel" style="grid-column:1/-1;">
          <h3 style="margin-top:0;">No products loaded yet</h3>
          <p class="muted" style="margin-bottom:0;">
            The shop page is ready, but <code>shop-products.js</code> is empty. Sync from WooCommerce to populate it.
          </p>
        </div>
      `;
      countEl.textContent = '';
      return;
    }

    const filters = getFilters();
    const filtered = allProducts.filter((p) => matches(p, filters));
    const sorted = sortProducts(filtered, filters.sort);

    countEl.textContent = `${sorted.length} product${sorted.length === 1 ? '' : 's'}`;

    grid.innerHTML = sorted.map((p) => {
      const name = toText(p && p.name, 'Product');
      const sku = toText(p && p.sku).trim();
      const cat = primaryCategoryFor(p);
      const img = imageFor(p) || 'assets/placeholder.png';
      const cur = toText(p && p.currency, 'EUR') || 'EUR';
      const sym = toText(p && p.currency_symbol, '€') || '€';
      const price = p && p.price ? money(p.price, { currency: cur, symbol: sym }) : '';
      const reg = p && p.regular_price ? money(p.regular_price, { currency: cur, symbol: sym }) : '';
      const isSale = Boolean(p && p.on_sale);
      const url = productUrlFor(p);
      const wa = whatsappHrefFor(p);

      const badge = esc(cat);
      const status = isSale ? `<div class="card-status sale">On sale</div>` : `<div class="card-status sale" style="opacity:0.0; pointer-events:none"> </div>`;
      const ref = sku ? esc(sku) : (p && p.id != null ? `WC-${esc(p.id)}` : 'WC');
      const priceHtml = isSale && reg
        ? `<div class="price">${esc(price)} <span class="muted" style="text-decoration:line-through; font-weight:800; margin-left:0.35rem">${esc(reg)}</span></div>`
        : `<div class="price">${esc(price) || 'Price on request'}</div>`;

      return `
        <article class="property-card shop-card" data-wc-id="${esc(p && p.id)}" tabindex="0" role="button" aria-label="Open ${esc(name)} details">
          <div class="card-img-wrapper">
            <img src="${esc(img)}" alt="${esc(name)}" loading="lazy" referrerpolicy="no-referrer"
              onerror="this.onerror=null;this.src='assets/placeholder.png'">
            <div class="card-badge">${badge}</div>
            ${status}
          </div>
          <div class="card-content">
            <div class="card-ref">${ref}</div>
            <h3>${esc(name)}</h3>
            ${priceHtml}
            <div class="specs">
              <div class="spec-item">🛠️ Install support</div>
              <div class="spec-item">🔒 Secure handover</div>
            </div>
            <div class="card-actions">
              <button type="button" class="card-action" data-open-details="1">Details</button>
              <button type="button" class="card-action card-action--basket" data-add-basket="1">${esc(t('shop.actions.add_to_basket', 'Add to basket'))}</button>
              ${url ? `<a class="card-action" href="${esc(url)}" target="_blank" rel="noopener">Open in shop</a>` : `<span class="card-action card-action--disabled">Open in shop</span>`}
              <a class="card-action card-action--whatsapp" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>
            </div>
          </div>
        </article>
      `;
    }).join('');
  };

  const findById = (id) => {
    const needle = toText(id).trim();
    if (!needle) return null;
    return allProducts.find((p) => toText(p && p.id).trim() === needle) || null;
  };

  const openModal = (p) => {
    if (!modal || !modalBody || !p) return;
    const name = toText(p.name, 'Product');
    const sku = toText(p.sku).trim();
    const cats = categoriesFor(p);
    const catLine = cats.length ? cats.join(' · ') : 'Smart device';
    const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    const imgMain = toText(imgs[0] || 'assets/placeholder.png');
    const cur = toText(p.currency, 'EUR') || 'EUR';
    const sym = toText(p.currency_symbol, '€') || '€';
    const price = p.price ? money(p.price, { currency: cur, symbol: sym }) : '';
    const reg = p.regular_price ? money(p.regular_price, { currency: cur, symbol: sym }) : '';
    const isSale = Boolean(p.on_sale);
    const priceHtml = isSale && reg
      ? `<div class="price">${esc(price)} <span class="muted" style="text-decoration:line-through; font-weight:800; margin-left:0.35rem">${esc(reg)}</span></div>`
      : `<div class="price">${esc(price) || 'Price on request'}</div>`;

    const url = productUrlFor(p);
    const wa = whatsappHrefFor(p);
    const mail = emailHrefFor(p);

    const shortText = toText(p.short_text).trim();
    const descText = toText(p.desc_text).trim();
    const descHtml = formatProductDescriptionHtml(descText || shortText);

    const thumbs = imgs.slice(0, 10);
    const thumbHtml = thumbs.length > 1
      ? `
        <div class="gallery-thumbs-container">
          <div class="gallery-thumbs shop-thumbs">
            ${thumbs.map((src, idx) => `
              <div class="thumb ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
                <img src="${esc(src)}" alt="Thumbnail ${idx + 1}" loading="lazy" referrerpolicy="no-referrer">
              </div>
            `).join('')}
          </div>
        </div>
      `
      : '';

    modalBody.innerHTML = `
      <div class="modal-info">
        <div class="card-badge">${esc(primaryCategoryFor(p))}</div>
        <div class="modal-ref">${sku ? `SKU: ${esc(sku)}` : (p.id != null ? `WC-${esc(p.id)}` : '')}</div>
        <h2>${esc(name)}</h2>
        <div class="location">${esc(catLine)}</div>
        ${priceHtml}
        <div class="modal-specs">
          <div class="modal-spec-item">🛠️ Installation available</div>
          <div class="modal-spec-item">🔒 Secure setup & handover</div>
          <div class="modal-spec-item">📄 Documentation included</div>
        </div>
        <div class="modal-cta">
          <button class="cta-button" id="shop-add-basket-btn" type="button">${esc(t('shop.actions.add_to_basket', 'Add to basket'))}</button>
          ${url ? `<a class="cta-button" href="${esc(url)}" target="_blank" rel="noopener">Open in shop</a>` : `<span class="cta-button cta-button--outline" style="opacity:0.65;">No shop link</span>`}
          <a class="cta-button cta-button--outline" href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>
          <a class="cta-button cta-button--outline" href="${esc(mail)}">Email</a>
        </div>
      </div>
      <div class="modal-gallery">
        <div class="gallery-main">
          <img id="shop-main-img" src="${esc(imgMain)}" alt="${esc(name)}" loading="lazy" referrerpolicy="no-referrer"
            onerror="this.onerror=null;this.src='assets/placeholder.png'">
        </div>
        ${thumbHtml}
      </div>
      <div class="modal-details-section">
        ${descHtml ? `<div class="desc">${descHtml}</div>` : `<div class="muted">No description available.</div>`}
        <div class="features-list" style="margin-top:1.25rem;">
          <h4>Why this matters</h4>
          <ul>
            <li>Reduce operational friction (rentals, staff, suppliers)</li>
            <li>Keep access controlled and auditable</li>
            <li>Improve reliability with a clean network foundation</li>
            <li>Less confusion at handover time</li>
          </ul>
        </div>
      </div>
    `;

    // Thumb click -> swap main image.
    const mainImg = document.getElementById('shop-main-img');
    modalBody.querySelectorAll('.shop-thumbs .thumb').forEach((t) => {
      t.addEventListener('click', () => {
        const idx = Number(t.getAttribute('data-idx'));
        if (!Number.isFinite(idx) || !thumbs[idx] || !mainImg) return;
        modalBody.querySelectorAll('.shop-thumbs .thumb').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        mainImg.src = thumbs[idx];
      });
    });

    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';

    const addBtn = document.getElementById('shop-add-basket-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const res = addToBasket(p, { qty: 1 });
        if (res && res.ok) {
          addBtn.textContent = t('shop.basket.added_short', 'Added');
          window.setTimeout(() => {
            try {
              addBtn.textContent = t('shop.actions.add_to_basket', 'Add to basket');
            } catch {
              // ignore
            }
          }, 1200);
        }
      });
    }
  };

  const closeModal = () => {
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event && event.target === modal) closeModal();
    });
  }
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  const wireGridClicks = () => {
    if (!grid) return;
    grid.addEventListener('click', (event) => {
      const el = event && event.target ? event.target : null;
      if (!el) return;
      if (el.closest('a')) return;

      const addBtn = el.closest('[data-add-basket]');
      if (addBtn) {
        const card = addBtn.closest('.shop-card');
        const id = card ? card.getAttribute('data-wc-id') : '';
        const p = findById(id);
        if (p) addToBasket(p, { qty: 1 });
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const card = el.closest('.shop-card');
      if (!card) return;
      const id = card.getAttribute('data-wc-id');
      const p = findById(id);
      if (p) openModal(p);
    });

    grid.addEventListener('keydown', (event) => {
      const key = event && event.key ? event.key : '';
      if (key !== 'Enter' && key !== ' ') return;
      const el = event && event.target ? event.target : null;
      if (!el) return;
      if (el.closest('a') || el.closest('button') || el.closest('[data-add-basket]')) return;
      const card = el.closest('.shop-card');
      if (!card) return;
      event.preventDefault();
      const id = card.getAttribute('data-wc-id');
      const p = findById(id);
      if (p) openModal(p);
    });
  };

  const wireControls = () => {
    if (qEl) qEl.addEventListener('input', () => renderGrid());
    if (catEl) catEl.addEventListener('change', () => renderGrid());
    if (sortEl) sortEl.addEventListener('change', () => renderGrid());
  };

  const init = () => {
    setMeta();
    populateCategorySelect();
    renderGrid();
    wireGridClicks();
    wireControls();

    // Apply admin curation (published overrides) without blocking initial paint.
    const onReady = () => applyOverridesFromSupabase();
    if (window.scpSupabaseStatus && window.scpSupabaseStatus.enabled) {
      onReady();
    } else {
      window.addEventListener('scp:supabase:ready', onReady, { once: true });
      // Fallback: if the event never fires, do nothing.
      window.setTimeout(() => {
        try {
          onReady();
        } catch {
          // ignore
        }
      }, 2500);
    }
  };

  window.addEventListener('DOMContentLoaded', init);
})();
