(() => {
  const KEY = 'scp:shop:basket:v1';

  const toText = (v) => (v == null ? '' : String(v));
  const nowIso = () => {
    try {
      return new Date().toISOString();
    } catch {
      return '';
    }
  };

  const safeJsonParse = (raw) => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const normalizeId = (v) => {
    const s = toText(v).trim();
    if (!s) return '';
    const n = Number(s);
    if (Number.isFinite(n) && n > 0) return String(Math.trunc(n));
    return s;
  };

  const normalizeQty = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    const q = Math.round(n);
    return Math.min(99, Math.max(1, q));
  };

  const normalizeItem = (it) => {
    if (!it || typeof it !== 'object') return null;
    const wcId = normalizeId(it.wc_id);
    if (!wcId) return null;
    const qty = normalizeQty(it.qty);
    const name = toText(it.name).trim();
    const sku = toText(it.sku).trim();
    const url = toText(it.url || it.product_url).trim();
    const image = toText(it.image).trim();
    const currency = toText(it.currency).trim() || 'EUR';
    const currencySymbol = toText(it.currency_symbol).trim() || '€';
    const price = it.price == null || it.price === '' ? null : Number(it.price);
    const addedAt = toText(it.added_at).trim() || nowIso();

    return {
      wc_id: wcId,
      qty,
      name,
      sku,
      url,
      image,
      currency,
      currency_symbol: currencySymbol,
      price: Number.isFinite(price) ? price : null,
      added_at: addedAt
    };
  };

  const read = () => {
    try {
      if (!window.localStorage) return [];
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = safeJsonParse(raw);
      if (!Array.isArray(parsed)) return [];
      const out = [];
      parsed.forEach((it) => {
        const norm = normalizeItem(it);
        if (norm) out.push(norm);
      });
      return out;
    } catch {
      return [];
    }
  };

  const write = (items) => {
    try {
      if (!window.localStorage) return false;
      const arr = Array.isArray(items) ? items.map(normalizeItem).filter(Boolean) : [];
      window.localStorage.setItem(KEY, JSON.stringify(arr));
      notify(arr);
      return true;
    } catch {
      return false;
    }
  };

  const count = (items) => {
    const arr = Array.isArray(items) ? items : read();
    return arr.reduce((sum, it) => sum + (Number(it && it.qty) || 0), 0);
  };

  const add = (item, { qty = 1 } = {}) => {
    const it = normalizeItem({ ...(item || {}), qty });
    if (!it) return { ok: false, items: read(), count: count() };

    const cur = read();
    const idx = cur.findIndex((x) => normalizeId(x && x.wc_id) === it.wc_id);
    if (idx >= 0) {
      const merged = normalizeItem({
        ...cur[idx],
        ...it,
        qty: normalizeQty((Number(cur[idx] && cur[idx].qty) || 1) + it.qty),
        added_at: cur[idx] && cur[idx].added_at ? cur[idx].added_at : it.added_at
      });
      cur[idx] = merged || it;
    } else {
      cur.push(it);
    }
    write(cur);
    return { ok: true, items: cur, count: count(cur) };
  };

  const remove = (wcId) => {
    const id = normalizeId(wcId);
    if (!id) return { ok: false, items: read(), count: count() };
    const next = read().filter((it) => normalizeId(it && it.wc_id) !== id);
    write(next);
    return { ok: true, items: next, count: count(next) };
  };

  const setQty = (wcId, qty) => {
    const id = normalizeId(wcId);
    if (!id) return { ok: false, items: read(), count: count() };
    const q = normalizeQty(qty);
    const cur = read();
    const idx = cur.findIndex((it) => normalizeId(it && it.wc_id) === id);
    if (idx < 0) return { ok: false, items: cur, count: count(cur) };
    cur[idx] = normalizeItem({ ...cur[idx], qty: q }) || cur[idx];
    write(cur);
    return { ok: true, items: cur, count: count(cur) };
  };

  const clear = () => {
    write([]);
    return { ok: true, items: [], count: 0 };
  };

  function notify(items) {
    const arr = Array.isArray(items) ? items : read();
    try {
      window.dispatchEvent(new CustomEvent('scp:basket:change', { detail: { count: count(arr), items: arr } }));
    } catch {
      // ignore
    }
  }

  window.SCP_BASKET = { read, write, add, remove, setQty, clear, count, key: KEY };
})();
