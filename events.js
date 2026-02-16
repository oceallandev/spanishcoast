(() => {
  const t = (key, vars) => {
    try {
      if (globalThis.SCP_I18N && typeof globalThis.SCP_I18N.t === 'function') return globalThis.SCP_I18N.t(key, vars);
    } catch { /* ignore */ }
    return '';
  };

  const getLang = () => {
    try {
      const lang = String(globalThis.SCP_I18N && globalThis.SCP_I18N.lang || '').trim().toLowerCase();
      if (lang) return lang;
    } catch { /* ignore */ }
    return 'en';
  };

  const safeText = (v) => String(v || '').replace(/\s+/g, ' ').trim();

  const includesLoose = (haystack, needle) => {
    const h = safeText(haystack).toLowerCase();
    const n = safeText(needle).toLowerCase();
    if (!h || !n) return false;
    return h.includes(n);
  };

  const fmtDate = (iso, lang) => {
    try {
      const d = new Date(String(iso || ''));
      if (Number.isNaN(d.getTime())) return '';
      const locale = lang === 'es' ? 'es-ES' : 'en-GB';
      return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {
      return '';
    }
  };

  const fmtDateRange = (item, lang) => {
    const startIso = safeText(item && item.startAt);
    const endIso = safeText(item && item.endAt);
    if (!startIso) return '';
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) return '';
    if (!endIso) return fmtDate(startIso, lang);

    const end = new Date(endIso);
    if (Number.isNaN(end.getTime())) return fmtDate(startIso, lang);

    // iCal all-day events typically have an exclusive DTEND (next day). Adjust for display.
    if (item && item.allDay) {
      const adj = new Date(end.getTime());
      adj.setDate(adj.getDate() - 1);
      if (!Number.isNaN(adj.getTime()) && adj.getTime() >= start.getTime()) {
        const sDay = fmtDate(startIso, lang);
        const eDay = fmtDate(adj.toISOString(), lang);
        return (sDay && eDay && sDay !== eDay) ? `${sDay} - ${eDay}` : (sDay || '');
      }
    }

    const sDay = fmtDate(startIso, lang);
    const eDay = fmtDate(endIso, lang);
    return (sDay && eDay && sDay !== eDay) ? `${sDay} - ${eDay}` : (sDay || '');
  };

  const getLocalIntelData = () => {
    const data = globalThis.SCP_LOCAL_INTEL;
    if (data && typeof data === 'object' && Array.isArray(data.items)) return data;
    return { updatedAt: '', items: [] };
  };

  const els = {
    grid: document.getElementById('events-grid'),
    count: document.getElementById('events-count'),
    updatedWrap: document.getElementById('events-updated-wrap'),
    updated: document.getElementById('events-updated'),
    query: document.getElementById('events-query'),
    range: document.getElementById('events-range'),
    kind: document.getElementById('events-kind'),
    lang: document.getElementById('events-lang'),
    reload: document.getElementById('events-reload'),
    modal: document.getElementById('events-modal'),
    modalClose: document.getElementById('events-modal-close'),
    modalBody: document.getElementById('events-modal-body'),
  };

  if (!els.grid) return;

  const state = {
    all: [],
    updatedAt: '',
    filterQuery: '',
    filterRange: 'upcoming',
    filterKind: 'all',
    filterLang: 'auto',
    openId: '',
  };

  const closeModal = () => {
    if (!els.modal) return;
    els.modal.style.display = 'none';
    els.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      window.history.replaceState({}, '', url.toString());
    } catch { /* ignore */ }
  };

  const openModalWithItem = (item) => {
    if (!els.modal || !els.modalBody) return;
    if (!item) return;

    const lang = getLang();
    state.openId = safeText(item.id);
    els.modalBody.textContent = '';

    const wrap = document.createElement('div');
    wrap.className = 'blog-post';

    const top = document.createElement('div');
    top.className = 'blog-post-top';

    const pill = document.createElement('span');
    const kindKey = safeText(item.kind).toLowerCase() || 'event';
    pill.className = `blog-pill ${kindKey}`;
    pill.textContent =
      kindKey === 'holiday' ? (t('events.kind.holiday') || 'Holidays')
        : (kindKey === 'fiesta' ? (t('events.kind.fiesta') || 'Fiestas')
          : (kindKey === 'update' ? (t('events.kind.update') || 'Local updates') : (t('events.kind.event') || 'Events')));

    const date = document.createElement('div');
    date.className = 'blog-post-date';
    date.textContent = fmtDateRange(item, lang);

    top.appendChild(pill);
    top.appendChild(date);

    const title = document.createElement('h2');
    title.className = 'blog-post-title';
    title.textContent = safeText(item.title) || 'Untitled';

    const summary = document.createElement('p');
    summary.className = 'blog-post-excerpt';
    summary.textContent = safeText(item.summary || '');

    const loc = safeText(item.location || '');
    const locEl = document.createElement('p');
    locEl.className = 'blog-post-p';
    locEl.textContent = loc ? `📍 ${loc}` : '';

    const tagsWrap = document.createElement('div');
    tagsWrap.className = 'blog-tags';
    const tags = Array.isArray(item.tags) ? item.tags.slice(0, 12) : [];
    for (const tag of tags) {
      const span = document.createElement('span');
      span.className = 'blog-tag';
      span.textContent = safeText(tag);
      tagsWrap.appendChild(span);
    }

    wrap.appendChild(top);
    wrap.appendChild(title);
    if (summary.textContent) wrap.appendChild(summary);
    if (locEl.textContent) wrap.appendChild(locEl);
    if (tagsWrap.childElementCount) wrap.appendChild(tagsWrap);

    const sources = Array.isArray(item.sources) ? item.sources : [];
    if (sources.length) {
      const h = document.createElement('h3');
      h.className = 'blog-post-h';
      h.textContent = t('events.modal.sources') || 'Sources';
      wrap.appendChild(h);

      const ul = document.createElement('ul');
      ul.className = 'blog-post-ul';
      for (const s of sources.slice(0, 10)) {
        const url = safeText(s && s.url);
        if (!url) continue;
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = safeText(s && (s.name || s.url) || url);
        li.appendChild(a);
        ul.appendChild(li);
      }
      if (ul.childElementCount) wrap.appendChild(ul);
    }

    const footer = document.createElement('div');
    footer.className = 'blog-post-footer';

    const cta = document.createElement('div');
    cta.className = 'blog-post-cta';
    cta.textContent = t('events.hero.disclaimer') || 'Always verify times and locations using the source links.';
    footer.appendChild(cta);

    const actions = document.createElement('div');
    actions.className = 'blog-post-actions';

    const openBtn = document.createElement('a');
    openBtn.className = 'view-toggle-btn';
    openBtn.textContent = t('events.card.open_source') || 'Open source';
    openBtn.target = '_blank';
    openBtn.rel = 'noopener noreferrer';
    openBtn.href = safeText((sources[0] || {}).url || '#');
    if (!safeText(openBtn.href) || openBtn.href === '#') openBtn.setAttribute('aria-disabled', 'true');

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'view-toggle-btn';
    copyBtn.textContent = t('blog.actions.copy_link') || 'Copy link';
    copyBtn.addEventListener('click', async () => {
      try {
        const shareUrl = new URL(window.location.href);
        shareUrl.searchParams.set('id', safeText(item.id));
        await navigator.clipboard.writeText(shareUrl.toString());
        copyBtn.textContent = t('blog.actions.copied') || 'Copied';
        setTimeout(() => { copyBtn.textContent = t('blog.actions.copy_link') || 'Copy link'; }, 1200);
      } catch {
        // ignore
      }
    });

    actions.appendChild(openBtn);
    actions.appendChild(copyBtn);
    footer.appendChild(actions);
    wrap.appendChild(footer);

    els.modalBody.appendChild(wrap);

    els.modal.style.display = 'block';
    els.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('id', safeText(item.id));
      window.history.replaceState({}, '', url.toString());
    } catch { /* ignore */ }
  };

  const renderEmpty = ({ title, subtitle } = {}) => {
    els.grid.textContent = '';
    const card = document.createElement('div');
    card.className = 'catalog-card blog-empty';
    const content = document.createElement('div');
    content.className = 'catalog-content';
    const h3 = document.createElement('h3');
    h3.textContent = safeText(title) || t('events.empty.title') || 'No local items yet';
    const p = document.createElement('div');
    p.className = 'catalog-meta';
    p.textContent = safeText(subtitle) || t('events.empty.subtitle') || 'This section updates daily.';
    content.appendChild(h3);
    content.appendChild(p);
    card.appendChild(content);
    els.grid.appendChild(card);
  };

  const inTimeRange = (item, range) => {
    const iso = safeText(item && item.startAt);
    if (!iso) return false;
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return false;
    const now = new Date();

    const startOfToday = new Date(now.getTime());
    startOfToday.setHours(0, 0, 0, 0);

    if (range === 'all') return true;
    if (range === 'last15') {
      const start = new Date(startOfToday.getTime());
      start.setDate(start.getDate() - 15);
      return dt >= start && dt < (startOfToday.getTime() + (24 * 60 * 60 * 1000));
    }
    if (range === 'year') {
      const end = new Date(startOfToday.getTime());
      end.setDate(end.getDate() + 365);
      return dt >= startOfToday && dt <= end;
    }
    // upcoming (default): next 30 days, including today.
    const end = new Date(startOfToday.getTime());
    end.setDate(end.getDate() + 30);
    return dt >= startOfToday && dt <= end;
  };

  const render = () => {
    const lang = getLang();
    const q = safeText(state.filterQuery);
    const kind = safeText(state.filterKind || 'all');
    const range = safeText(state.filterRange || 'upcoming');
    const langFilter = safeText(state.filterLang || 'auto');

    const availableLangs = new Set(state.all.map((x) => safeText(x && x.lang)).filter(Boolean));
    let desiredLang = (langFilter === 'auto') ? lang : langFilter;
    if (langFilter === 'auto' && desiredLang !== 'all' && !availableLangs.has(desiredLang)) {
      if (availableLangs.has('en')) desiredLang = 'en';
      else if (availableLangs.has('es')) desiredLang = 'es';
      else desiredLang = 'all';
    }

    const filtered = state.all
      .filter((it) => {
        if (!it || typeof it !== 'object') return false;
        if (!inTimeRange(it, range)) return false;
        if (kind !== 'all' && safeText(it.kind) !== kind) return false;
        if (desiredLang !== 'all' && it.lang && it.lang !== desiredLang) return false;
        if (!q) return true;
        if (includesLoose(it.title, q)) return true;
        if (includesLoose(it.summary, q)) return true;
        if (includesLoose(it.location, q)) return true;
        if (Array.isArray(it.tags) && it.tags.some((tag) => includesLoose(tag, q))) return true;
        return false;
      });

    const sortAsc = range !== 'last15';
    filtered.sort((a, b) => {
      const aa = safeText(a && a.startAt);
      const bb = safeText(b && b.startAt);
      return sortAsc ? aa.localeCompare(bb) : bb.localeCompare(aa);
    });

    els.grid.textContent = '';

    if (els.count) {
      els.count.textContent = `${filtered.length} ${t('events.count.items') || 'items'}`;
    }

    if (!filtered.length) {
      renderEmpty();
      return;
    }

    for (const item of filtered.slice(0, 140)) {
      const card = document.createElement('div');
      card.className = 'catalog-card blog-card';
      card.dataset.itemId = safeText(item.id || '');

      const content = document.createElement('div');
      content.className = 'catalog-content';

      const top = document.createElement('div');
      top.className = 'blog-card-top';

      const kindKey = safeText(item.kind).toLowerCase() || 'event';
      const pill = document.createElement('span');
      pill.className = `blog-pill ${kindKey}`;
      pill.textContent =
        kindKey === 'holiday' ? (t('events.kind.holiday') || 'Holidays')
          : (kindKey === 'fiesta' ? (t('events.kind.fiesta') || 'Fiestas')
            : (kindKey === 'update' ? (t('events.kind.update') || 'Local updates') : (t('events.kind.event') || 'Events')));

      const right = document.createElement('div');
      right.className = 'blog-card-right';

      const date = document.createElement('span');
      date.className = 'blog-date';
      date.textContent = fmtDateRange(item, lang);

      right.appendChild(date);
      top.appendChild(pill);
      top.appendChild(right);

      const titleText = safeText(item.title) || 'Untitled';
      const h3 = document.createElement('h3');
      h3.textContent = titleText;

      const meta = document.createElement('div');
      meta.className = 'catalog-meta';
      meta.textContent = safeText(item.summary || item.location || '');

      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'blog-tags';
      const tagList = Array.isArray(item.tags) ? item.tags.slice(0, 6) : [];
      for (const tag of tagList) {
        const span = document.createElement('span');
        span.className = 'blog-tag';
        span.textContent = safeText(tag);
        tagsWrap.appendChild(span);
      }

      content.appendChild(top);
      content.appendChild(h3);
      if (meta.textContent) content.appendChild(meta);
      if (tagsWrap.childElementCount) content.appendChild(tagsWrap);

      const openHint = document.createElement('div');
      openHint.className = 'blog-card-hint';
      openHint.textContent = t('blog.card.open_hint') || (lang === 'es' ? 'Toca la tarjeta para abrir el articulo' : 'Tap card to open article');
      content.appendChild(openHint);

      card.appendChild(content);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${titleText} · ${openHint.textContent}`);
      card.addEventListener('click', () => openModalWithItem(item));
      card.addEventListener('keydown', (event) => {
        const k = event && event.key ? String(event.key) : '';
        if (k !== 'Enter' && k !== ' ') return;
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        openModalWithItem(item);
      });

      els.grid.appendChild(card);
    }
  };

  const init = async () => {
    const data = getLocalIntelData();
    state.all = Array.isArray(data.items) ? data.items : [];
    state.updatedAt = safeText(data.updatedAt || '');

    if (!state.all.length) {
      try {
        const res = await fetch('local-intel.json', { cache: 'no-store' });
        if (res && res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.items)) {
            state.all = json.items;
            state.updatedAt = safeText(json.updatedAt || '');
          }
        }
      } catch { /* ignore */ }
    }

    if (els.updated && els.updatedWrap && state.updatedAt) {
      const lang = getLang();
      els.updated.textContent = fmtDate(state.updatedAt, lang) || state.updatedAt;
      els.updatedWrap.hidden = false;
    }

    if (els.query) {
      els.query.addEventListener('input', () => {
        state.filterQuery = els.query.value || '';
        render();
      });
    }

    if (els.range) {
      els.range.addEventListener('change', () => {
        state.filterRange = els.range.value || 'upcoming';
        render();
      });
    }

    if (els.kind) {
      els.kind.addEventListener('change', () => {
        state.filterKind = els.kind.value || 'all';
        render();
      });
    }

    if (els.lang) {
      els.lang.addEventListener('change', () => {
        state.filterLang = els.lang.value || 'auto';
        render();
      });
    }

    if (els.reload) {
      els.reload.addEventListener('click', () => window.location.reload());
    }

    if (els.modalClose) {
      els.modalClose.addEventListener('click', closeModal);
    }

    if (els.modal) {
      els.modal.addEventListener('click', (event) => {
        if (event.target === els.modal) closeModal();
      });
    }

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeModal();
    });

    window.addEventListener('scp:i18n-updated', () => {
      render();
      if (state.openId) {
        const item = state.all.find((x) => x && safeText(x.id) === state.openId) || null;
        if (item) openModalWithItem(item);
      }
    });

    // Deep link support: events.html?id=...
    try {
      const url = new URL(window.location.href);
      const id = safeText(url.searchParams.get('id') || '');
      if (id) {
        const item = state.all.find((x) => x && safeText(x.id) === id) || null;
        if (item) setTimeout(() => openModalWithItem(item), 60);
      }
    } catch { /* ignore */ }

    render();
  };

  init();
})();

