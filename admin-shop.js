(() => {
  const statusEl = document.getElementById('shop-admin-status');
  const showingEl = document.getElementById('shop-admin-showing');
  const qEl = document.getElementById('shop-admin-q');
  const catEl = document.getElementById('shop-admin-category');
  const viewEl = document.getElementById('shop-admin-view');
  const refreshBtn = document.getElementById('shop-admin-refresh');
  const tbody = document.querySelector('#shop-admin-table tbody');

  const drawerBackdrop = document.getElementById('shop-drawer-backdrop');
  const drawer = document.getElementById('shop-drawer');
  const drawerTitle = document.getElementById('shop-drawer-title');
  const drawerSubtitle = document.getElementById('shop-drawer-subtitle');
  const drawerBody = document.getElementById('shop-drawer-body');
  const drawerClose = document.getElementById('shop-drawer-close');

  const getClient = () => window.scpSupabase || null;

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text || '';
  };

  const setShowing = (text) => {
    if (showingEl) showingEl.textContent = text || '';
  };

  const escape = (value) => {
    const s = value == null ? '' : String(value);
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  const toText = (value) => (value == null ? '' : String(value));
  const norm = (value) => toText(value).trim().toLowerCase();

  const nullIfEmpty = (value) => {
    const s = toText(value).trim();
    return s ? s : null;
  };

  const numOrNull = (value) => {
    const s = toText(value).trim();
    if (!s) return null;
    const n = Number(s.replace(/[, ]+/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  const intOrZero = (value) => {
    const n = numOrNull(value);
    if (n == null) return 0;
    const i = Math.round(n);
    return Number.isFinite(i) ? i : 0;
  };

  const parseDate = (v) => {
    const t = Date.parse(toText(v));
    return Number.isFinite(t) ? t : 0;
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

  async function roleFor(client, userId) {
    try {
      const { data } = await client.from('profiles').select('role').eq('user_id', userId).maybeSingle();
      return data && data.role ? String(data.role) : '';
    } catch {
      return '';
    }
  }

  const baseProducts = Array.isArray(window.shopProducts) ? window.shopProducts : [];
  const baseMeta = window.shopProductsMeta || null;
  const baseStoreUrl = baseMeta && baseMeta.store_url ? toText(baseMeta.store_url).trim() : '';

  const state = {
    ready: false,
    role: '',
    overrides: new Map(), // wc_id -> row
    docs: new Map(), // wc_id -> docs row
    activeId: '',
    drawerOpen: false
  };

  const safeList = (value) =>
    (toText(value) || '')
      .split(/[\n,]+/g)
      .map((x) => toText(x).trim())
      .filter(Boolean);

  const asArrayOrNull = (arr) => {
    const out = Array.isArray(arr) ? arr.map((x) => toText(x).trim()).filter(Boolean) : [];
    return out.length ? out : null;
  };

  const effective = (p) => {
    const id = toText(p && p.id).trim();
    const o = id ? state.overrides.get(id) : null;
    const merged = { ...(p || {}) };
    merged._override = o || null;

    if (!o) {
      merged._published = true;
      merged._app_visible = true;
      merged.sort_boost = Number(merged.sort_boost) || 0;
      return merged;
    }

    merged._published = o.published !== false;
    merged._app_visible = o.app_visible !== false;
    merged.sort_boost = Number(o.sort_boost) || 0;

    if (toText(o.name).trim()) merged.name = toText(o.name).trim();
    if (toText(o.sku).trim()) merged.sku = toText(o.sku).trim();
    if (toText(o.url).trim()) merged.url = toText(o.url).trim();
    if (toText(o.currency).trim()) merged.currency = toText(o.currency).trim();
    if (toText(o.currency_symbol).trim()) merged.currency_symbol = toText(o.currency_symbol).trim();

    if (o.price != null && o.price !== '') merged.price = Number(o.price);
    if (o.regular_price != null && o.regular_price !== '') merged.regular_price = Number(o.regular_price);
    if (o.sale_price != null && o.sale_price !== '') merged.sale_price = Number(o.sale_price);

    if (toText(o.short_text).trim()) merged.short_text = toText(o.short_text).trim();
    if (toText(o.desc_text).trim()) merged.desc_text = toText(o.desc_text).trim();

    const cats = Array.isArray(o.categories) ? o.categories : [];
    const catNames = cats.map((x) => toText(x).trim()).filter(Boolean);
    if (catNames.length) merged.categories = catNames.map((name) => ({ id: null, name, slug: '' }));

    const imgs = Array.isArray(o.images) ? o.images : [];
    const imgUrls = imgs.map((x) => toText(x).trim()).filter(Boolean);
    if (imgUrls.length) merged.images = imgUrls;

    return merged;
  };

  const computeCategories = (items) => {
    const set = new Map();
    (Array.isArray(items) ? items : []).forEach((p) => {
      categoriesFor(p).forEach((c) => {
        const k = norm(c);
        if (!k) return;
        if (!set.has(k)) set.set(k, c);
      });
    });
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  };

  let categories = [];

  const populateCategorySelect = () => {
    if (!catEl) return;
    const cur = norm(catEl.value);
    catEl.innerHTML = '<option value="all">All</option>';
    categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = norm(c);
      opt.textContent = c;
      catEl.appendChild(opt);
    });
    if (cur) catEl.value = cur;
  };

  const getFilters = () => ({
    q: norm(qEl && qEl.value),
    cat: norm(catEl && catEl.value),
    view: norm(viewEl && viewEl.value) || 'all'
  });

  const matches = (p, { q, cat, view }) => {
    const o = p && p._override ? p._override : null;
    const hasOverride = Boolean(o);
    const isDraft = hasOverride && o.published === false;
    const isHidden = hasOverride && o.app_visible === false;

    if (view === 'visible' && isHidden) return false;
    if (view === 'hidden' && !isHidden) return false;
    if (view === 'overridden' && !hasOverride) return false;
    if (view === 'draft' && !isDraft) return false;

    if (cat && cat !== 'all') {
      const cats = categoriesFor(p).map(norm);
      if (!cats.includes(cat)) return false;
    }

    if (!q) return true;

    const hay = [
      toText(p && p.name),
      toText(p && p.sku),
      toText(p && p.id),
      categoriesFor(p).join(' '),
      toText(p && p.short_text),
      toText(p && p.desc_text)
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  };

  const boostFor = (p) => {
    const n = Number(p && p.sort_boost);
    return Number.isFinite(n) ? n : 0;
  };

  const sortItems = (items) =>
    items.slice().sort((a, b) => {
      const ba = boostFor(a);
      const bb = boostFor(b);
      if (bb !== ba) return bb - ba;
      return parseDate(b && b.date_created) - parseDate(a && a.date_created);
    });

  const statusBadges = (p) => {
    const out = [];
    if (p && p._override) out.push('<span class="crm-badge crm-badge--good">OVERRIDE</span>');
    if (p && p._published === false) out.push('<span class="crm-badge crm-badge--warn">DRAFT</span>');
    if (p && p._app_visible === false) out.push('<span class="crm-badge crm-badge--warn">HIDDEN</span>');
    if (boostFor(p) > 0) out.push(`<span class="crm-badge">BOOST ${escape(boostFor(p))}</span>`);
    return out.length ? `<div class="crm-badges">${out.join('')}</div>` : '<span class="muted">—</span>';
  };

  function render() {
    if (!tbody) return;
    const filters = getFilters();
    const merged = baseProducts.map((p) => effective(p));
    categories = computeCategories(merged);
    populateCategorySelect();

    const filtered = merged.filter((p) => matches(p, filters));
    const sorted = sortItems(filtered);

    setShowing(`Showing ${sorted.length} of ${merged.length} products.`);

    tbody.innerHTML = sorted
      .map((p) => {
        const id = toText(p && p.id).trim();
        const name = toText(p && p.name, 'Product');
        const sku = toText(p && p.sku).trim();
        const cat = primaryCategoryFor(p);
        const img = imageFor(p) || 'assets/placeholder.png';
        const cur = toText(p && p.currency, 'EUR') || 'EUR';
        const sym = toText(p && p.currency_symbol, '€') || '€';
        const price = p && p.price ? money(p.price, { currency: cur, symbol: sym }) : '';
        const url = productUrlFor(p);

        const subtitle = [sku ? `SKU: ${escape(sku)}` : '', id ? `WC-${escape(id)}` : ''].filter(Boolean).join(' · ');
        const titleHtml = `
          <div class="crm-cell">
            <div class="crm-primary">${escape(name)}</div>
            <div class="crm-secondary">${subtitle || '&nbsp;'}</div>
          </div>
        `;

        const openLink = url
          ? `<a class="crm-icon-btn" href="${escape(url)}" target="_blank" rel="noopener" title="Open in shop">Open</a>`
          : (baseStoreUrl && id
              ? `<a class="crm-icon-btn" href="${escape(baseStoreUrl)}/?p=${escape(id)}" target="_blank" rel="noopener" title="Open in shop">Open</a>`
              : '');

        return `
          <tr data-id="${escape(id)}">
            <td><img class="admin-thumb" src="${escape(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/placeholder.png'"></td>
            <td>${titleHtml}</td>
            <td>${escape(cat)}</td>
            <td>${escape(price || '—')}</td>
            <td>${statusBadges(p)}</td>
            <td style="text-align:right;">
              <div class="crm-actions">
                ${openLink}
                <button class="crm-icon-btn" type="button" data-action="edit" data-id="${escape(id)}" aria-label="Edit">Edit</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  function openDrawer(id) {
    if (!drawer || !drawerBody || !id) return;
    state.activeId = id;

    const base = baseProducts.find((p) => toText(p && p.id).trim() === id) || null;
    const merged = base ? effective(base) : null;
    const o = merged && merged._override ? merged._override : null;

    const name = merged ? toText(merged.name, 'Product') : 'Product';
    const sku = merged ? toText(merged.sku).trim() : '';
    const catLine = merged ? categoriesFor(merged).join(', ') : '';
    const img = merged ? (imageFor(merged) || 'assets/placeholder.png') : 'assets/placeholder.png';
    const cur = merged ? toText(merged.currency, 'EUR') || 'EUR' : 'EUR';
    const sym = merged ? toText(merged.currency_symbol, '€') || '€' : '€';
    const price = merged && merged.price ? money(merged.price, { currency: cur, symbol: sym }) : '';

    if (drawerTitle) drawerTitle.textContent = name;
    if (drawerSubtitle) drawerSubtitle.textContent = [sku ? `SKU: ${sku}` : '', id ? `WC-${id}` : '', price ? `Price: ${price}` : ''].filter(Boolean).join(' · ');

    const published = o ? o.published !== false : true;
    const visible = o ? o.app_visible !== false : true;
    const boost = o ? Number(o.sort_boost) || 0 : 0;

    const ovName = o && o.name != null ? toText(o.name) : '';
    const ovSku = o && o.sku != null ? toText(o.sku) : '';
    const ovUrl = o && o.url != null ? toText(o.url) : '';
    const ovPrice = o && o.price != null ? toText(o.price) : '';
    const ovReg = o && o.regular_price != null ? toText(o.regular_price) : '';
    const ovSale = o && o.sale_price != null ? toText(o.sale_price) : '';
    const ovCats = o && Array.isArray(o.categories) ? o.categories.map((x) => toText(x).trim()).filter(Boolean).join(', ') : '';
    const ovImgs = o && Array.isArray(o.images) ? o.images.map((x) => toText(x).trim()).filter(Boolean).join('\n') : '';
    const ovShort = o && o.short_text != null ? toText(o.short_text) : '';
    const ovDesc = o && o.desc_text != null ? toText(o.desc_text) : '';

    const d = state.docs.get(id) || null;
    const docTitle = d && d.title != null ? toText(d.title) : '';
    const docInstr = d && d.instructions != null ? toText(d.instructions) : '';
    const docLinks = d && Array.isArray(d.links) ? d.links.map((x) => toText(x).trim()).filter(Boolean).join('\n') : '';

    drawerBody.innerHTML = `
      <div class="features-list" style="margin-top:0;">
        <h4 style="margin-top:0;">Preview</h4>
        <div style="display:flex; gap:0.9rem; align-items:flex-start;">
          <img class="admin-thumb" src="${escape(img)}" alt="" style="width:92px; height:72px;" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/placeholder.png'">
          <div style="min-width:0;">
            <div style="font-weight:900;">${escape(name)}</div>
            <div class="muted">${escape(catLine || '—')}</div>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <form id="shop-override-form" class="form-grid crm-form-grid">
        <label class="crm-check crm-span-2">
          <input id="shop-ov-published" type="checkbox" ${published ? 'checked' : ''}>
          <span>Published (visible to public shop page)</span>
        </label>
        <label class="crm-check crm-span-2">
          <input id="shop-ov-visible" type="checkbox" ${visible ? 'checked' : ''}>
          <span>Visible in app</span>
        </label>

        <label>
          <span>Boost (higher = featured)</span>
          <input id="shop-ov-boost" type="number" inputmode="numeric" value="${escape(boost)}" placeholder="0">
        </label>
        <label>
          <span>Category override</span>
          <input id="shop-ov-categories" type="text" value="${escape(ovCats)}" placeholder="e.g. Security, Networking">
        </label>

        <label class="crm-span-2">
          <span>Title override</span>
          <input id="shop-ov-name" type="text" value="${escape(ovName)}" placeholder="${escape(toText(base && base.name))}">
        </label>

        <label>
          <span>SKU override</span>
          <input id="shop-ov-sku" type="text" value="${escape(ovSku)}" placeholder="${escape(toText(base && base.sku))}">
        </label>
        <label>
          <span>Shop link override</span>
          <input id="shop-ov-url" type="text" value="${escape(ovUrl)}" placeholder="${escape(productUrlFor(base) || (baseStoreUrl && id ? `${baseStoreUrl}/?p=${id}` : ''))}">
        </label>

        <label>
          <span>Price override</span>
          <input id="shop-ov-price" type="text" inputmode="decimal" value="${escape(ovPrice)}" placeholder="${escape(toText(base && base.price))}">
        </label>
        <label>
          <span>Regular price override</span>
          <input id="shop-ov-regular" type="text" inputmode="decimal" value="${escape(ovReg)}" placeholder="${escape(toText(base && base.regular_price))}">
        </label>

        <label class="crm-span-2">
          <span>Sale price override</span>
          <input id="shop-ov-sale" type="text" inputmode="decimal" value="${escape(ovSale)}" placeholder="${escape(toText(base && base.sale_price))}">
        </label>

        <label class="crm-span-2">
          <span>Images override (one URL per line)</span>
          <textarea id="shop-ov-images" placeholder="https://...">${escape(ovImgs)}</textarea>
        </label>

        <label class="crm-span-2">
          <span>Short text override</span>
          <textarea id="shop-ov-short" placeholder="Short summary…">${escape(ovShort)}</textarea>
        </label>

        <label class="crm-span-2">
          <span>Description override</span>
          <textarea id="shop-ov-desc" placeholder="Clean description…">${escape(ovDesc)}</textarea>
        </label>

        <div class="crm-form-actions crm-span-2">
          <button class="cta-button" type="submit">Save overrides</button>
          <button class="cta-button cta-button--outline" id="shop-ov-delete" type="button" ${o ? '' : 'disabled'}>Remove overrides</button>
        </div>
      </form>

      <div class="divider"></div>

      <form id="shop-docs-form" class="form-grid crm-form-grid">
        <div class="crm-span-2">
          <h4 style="margin:0;">Post-purchase docs</h4>
          <div class="muted" style="margin-top:0.35rem;">
            These instructions are visible to buyers only after the order is marked as <b>paid/fulfilled/installed</b>.
          </div>
        </div>

        <label class="crm-span-2">
          <span>Docs title</span>
          <input id="shop-doc-title" type="text" value="${escape(docTitle)}" placeholder="Installation instructions">
        </label>

        <label class="crm-span-2">
          <span>Instructions (one step per line)</span>
          <textarea id="shop-doc-instructions" placeholder="1) What to do...">${escape(docInstr)}</textarea>
        </label>

        <label class="crm-span-2">
          <span>Links (one URL per line)</span>
          <textarea id="shop-doc-links" placeholder="https://...">${escape(docLinks)}</textarea>
        </label>

        <div class="crm-form-actions crm-span-2">
          <button class="cta-button" type="submit">Save docs</button>
          <button class="cta-button cta-button--outline" id="shop-doc-delete" type="button" ${d ? '' : 'disabled'}>Remove docs</button>
        </div>
        <div class="muted crm-span-2" id="shop-doc-status"></div>
      </form>
    `;

    const form = document.getElementById('shop-override-form');
    const delBtn = document.getElementById('shop-ov-delete');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveActiveOverride();
      });
    }
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        await deleteActiveOverride();
      });
    }

    const docsForm = document.getElementById('shop-docs-form');
    const docsDel = document.getElementById('shop-doc-delete');

    if (docsForm) {
      docsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveActiveDocs();
      });
    }
    if (docsDel) {
      docsDel.addEventListener('click', async () => {
        await deleteActiveDocs();
      });
    }

    loadDocsForActive();

    state.drawerOpen = true;
    document.body.classList.add('crm-open');
    if (drawerBackdrop) drawerBackdrop.setAttribute('aria-hidden', 'false');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    if (!drawer) return;
    state.drawerOpen = false;
    document.body.classList.remove('crm-open');
    if (drawerBackdrop) drawerBackdrop.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('aria-hidden', 'true');
  }

  async function saveActiveOverride() {
    const client = getClient();
    if (!client) {
      setStatus('Supabase not configured.');
      return;
    }
    if (state.role !== 'admin') {
      setStatus('Access denied (admin only).');
      return;
    }
    const id = toText(state.activeId).trim();
    if (!id) return;

    const published = Boolean(document.getElementById('shop-ov-published') && document.getElementById('shop-ov-published').checked);
    const visible = Boolean(document.getElementById('shop-ov-visible') && document.getElementById('shop-ov-visible').checked);
    const boost = intOrZero(document.getElementById('shop-ov-boost') && document.getElementById('shop-ov-boost').value);

    const payload = {
      wc_id: Number(id),
      published,
      app_visible: visible,
      sort_boost: boost,
      name: nullIfEmpty(document.getElementById('shop-ov-name') && document.getElementById('shop-ov-name').value),
      sku: nullIfEmpty(document.getElementById('shop-ov-sku') && document.getElementById('shop-ov-sku').value),
      url: nullIfEmpty(document.getElementById('shop-ov-url') && document.getElementById('shop-ov-url').value),
      price: numOrNull(document.getElementById('shop-ov-price') && document.getElementById('shop-ov-price').value),
      regular_price: numOrNull(document.getElementById('shop-ov-regular') && document.getElementById('shop-ov-regular').value),
      sale_price: numOrNull(document.getElementById('shop-ov-sale') && document.getElementById('shop-ov-sale').value),
      categories: asArrayOrNull(safeList(document.getElementById('shop-ov-categories') && document.getElementById('shop-ov-categories').value)),
      images: asArrayOrNull(safeList(document.getElementById('shop-ov-images') && document.getElementById('shop-ov-images').value)),
      short_text: nullIfEmpty(document.getElementById('shop-ov-short') && document.getElementById('shop-ov-short').value),
      desc_text: nullIfEmpty(document.getElementById('shop-ov-desc') && document.getElementById('shop-ov-desc').value)
    };

    setStatus('Saving overrides…');
    const { data, error } = await client.from('shop_product_overrides').upsert(payload, { onConflict: 'wc_id' }).select('*');
    if (error) {
      setStatus(`Save failed: ${error.message || 'unknown error'}`);
      return;
    }

    const row = Array.isArray(data) && data[0] ? data[0] : payload;
    state.overrides.set(id, row);
    setStatus('Saved.');
    render();
    openDrawer(id);
  }

  async function deleteActiveOverride() {
    const client = getClient();
    if (!client) {
      setStatus('Supabase not configured.');
      return;
    }
    if (state.role !== 'admin') {
      setStatus('Access denied (admin only).');
      return;
    }
    const id = toText(state.activeId).trim();
    if (!id) return;
    setStatus('Removing overrides…');
    const { error } = await client.from('shop_product_overrides').delete().eq('wc_id', Number(id));
    if (error) {
      setStatus(`Delete failed: ${error.message || 'unknown error'}`);
      return;
    }
    state.overrides.delete(id);
    setStatus('Overrides removed.');
    render();
    openDrawer(id);
  }

  const setDocsStatus = (text) => {
    const el = document.getElementById('shop-doc-status');
    if (el) el.textContent = text || '';
  };

  const loadDocsForActive = async () => {
    const client = getClient();
    const id = toText(state.activeId).trim();
    if (!client || !id) return;
    if (state.role !== 'admin') return;
    setDocsStatus('Loading docs…');
    try {
      const { data, error } = await client
        .from('shop_product_docs')
        .select('wc_id,title,instructions,links,updated_at')
        .eq('wc_id', Number(id))
        .maybeSingle();
      if (error) {
        setDocsStatus(`Docs not available: ${error.message || 'unknown error'}`);
        return;
      }
      if (!data) {
        setDocsStatus('No docs saved yet.');
        return;
      }
      state.docs.set(id, data);
      if (toText(state.activeId).trim() !== id) return;

      const titleEl = document.getElementById('shop-doc-title');
      const instrEl = document.getElementById('shop-doc-instructions');
      const linksEl = document.getElementById('shop-doc-links');
      const delEl = document.getElementById('shop-doc-delete');

      if (titleEl) titleEl.value = toText(data.title);
      if (instrEl) instrEl.value = toText(data.instructions);
      if (linksEl) linksEl.value = Array.isArray(data.links) ? data.links.map((x) => toText(x).trim()).filter(Boolean).join('\n') : '';
      if (delEl) delEl.disabled = false;

      setDocsStatus('Docs loaded.');
    } catch (e) {
      setDocsStatus(`Docs load failed: ${e && e.message ? e.message : String(e)}`);
    }
  };

  async function saveActiveDocs() {
    const client = getClient();
    if (!client) {
      setDocsStatus('Supabase not configured.');
      return;
    }
    if (state.role !== 'admin') {
      setDocsStatus('Access denied (admin only).');
      return;
    }
    const id = toText(state.activeId).trim();
    if (!id) return;

    const title = nullIfEmpty(document.getElementById('shop-doc-title') && document.getElementById('shop-doc-title').value);
    const instructions = nullIfEmpty(document.getElementById('shop-doc-instructions') && document.getElementById('shop-doc-instructions').value);
    const linksRaw = document.getElementById('shop-doc-links') && document.getElementById('shop-doc-links').value;
    const links = asArrayOrNull(safeList(linksRaw));

    const payload = {
      wc_id: Number(id),
      title,
      instructions,
      links
    };

    setDocsStatus('Saving docs…');
    const { data, error } = await client.from('shop_product_docs').upsert(payload, { onConflict: 'wc_id' }).select('*');
    if (error) {
      setDocsStatus(`Save failed: ${error.message || 'unknown error'}`);
      return;
    }
    const row = Array.isArray(data) && data[0] ? data[0] : payload;
    state.docs.set(id, row);
    setDocsStatus('Docs saved.');

    const delEl = document.getElementById('shop-doc-delete');
    if (delEl) delEl.disabled = false;
  }

  async function deleteActiveDocs() {
    const client = getClient();
    if (!client) {
      setDocsStatus('Supabase not configured.');
      return;
    }
    if (state.role !== 'admin') {
      setDocsStatus('Access denied (admin only).');
      return;
    }
    const id = toText(state.activeId).trim();
    if (!id) return;
    setDocsStatus('Removing docs…');
    try {
      const { error } = await client.from('shop_product_docs').delete().eq('wc_id', Number(id));
      if (error) {
        setDocsStatus(`Delete failed: ${error.message || 'unknown error'}`);
        return;
      }
      state.docs.delete(id);
      const titleEl = document.getElementById('shop-doc-title');
      const instrEl = document.getElementById('shop-doc-instructions');
      const linksEl = document.getElementById('shop-doc-links');
      const delEl = document.getElementById('shop-doc-delete');
      if (titleEl) titleEl.value = '';
      if (instrEl) instrEl.value = '';
      if (linksEl) linksEl.value = '';
      if (delEl) delEl.disabled = true;
      setDocsStatus('Docs removed.');
    } catch (e) {
      setDocsStatus(`Delete failed: ${e && e.message ? e.message : String(e)}`);
    }
  }

  async function loadOverrides() {
    const client = getClient();
    if (!client) {
      setStatus('Supabase not configured.');
      return;
    }

    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData && sessionData.session ? sessionData.session.user : null;
    if (!user) {
      setStatus('Signed out. Open Account and sign in as an admin.');
      return;
    }

    const role = await roleFor(client, user.id);
    state.role = role;
    if (role !== 'admin') {
      setStatus('Access denied (admin only).');
      return;
    }

    setStatus('Loading overrides…');
    const out = await client
      .from('shop_product_overrides')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(2000);

    if (out && out.error) {
      setStatus(`Failed to load overrides: ${out.error.message || 'unknown error'}`);
      return;
    }

    const rows = Array.isArray(out && out.data) ? out.data : [];
    state.overrides = new Map(rows.map((r) => [toText(r && r.wc_id).trim(), r]));
    setStatus(`Loaded ${rows.length} override${rows.length === 1 ? '' : 's'}.`);
    render();
  }

  function wireUi() {
    if (refreshBtn) refreshBtn.addEventListener('click', loadOverrides);
    if (qEl) qEl.addEventListener('input', () => render());
    if (catEl) catEl.addEventListener('change', () => render());
    if (viewEl) viewEl.addEventListener('change', () => render());

    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const el = e && e.target ? e.target : null;
        if (!el) return;
        const btn = el.closest('[data-action="edit"]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        if (id) openDrawer(id);
      });
    }

    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  wireUi();
  window.addEventListener('scp:supabase:ready', () => loadOverrides(), { once: true });
  window.setTimeout(loadOverrides, 80);
})();
