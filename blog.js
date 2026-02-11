(() => {
  const t = (key, vars) => {
    try {
      if (globalThis.SCP_I18N && typeof globalThis.SCP_I18N.t === 'function') return globalThis.SCP_I18N.t(key, vars);
    } catch { /* ignore */ }
    return '';
  };

  const getClient = () => {
    try {
      return globalThis.scpSupabase || null;
    } catch {
      return null;
    }
  };

  const getLang = () => {
    try {
      const lang = String(globalThis.SCP_I18N && globalThis.SCP_I18N.lang || '').trim().toLowerCase();
      if (lang) return lang;
    } catch { /* ignore */ }
    return 'en';
  };

  const fmtDate = (iso, lang) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {
      return '';
    }
  };

  const normalize = (v) => String(v || '').trim();

  const safeText = (v) => normalize(v).replace(/\s+/g, ' ').trim();

  const BLOG_FAV_STORAGE_KEY = 'scp:blog_favourites:v1';

  const readLocalFavs = () => {
    try {
      if (!globalThis.localStorage) return [];
      const raw = globalThis.localStorage.getItem(BLOG_FAV_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((x) => safeText(x)).filter(Boolean).slice(0, 1000);
    } catch {
      return [];
    }
  };

  const writeLocalFavs = (ids) => {
    try {
      if (!globalThis.localStorage) return false;
      const arr = Array.isArray(ids) ? ids.map((x) => safeText(x)).filter(Boolean).slice(0, 1000) : [];
      globalThis.localStorage.setItem(BLOG_FAV_STORAGE_KEY, JSON.stringify(arr));
      return true;
    } catch {
      return false;
    }
  };

  const includesLoose = (haystack, needle) => {
    const h = safeText(haystack).toLowerCase();
    const n = safeText(needle).toLowerCase();
    if (!h || !n) return false;
    return h.includes(n);
  };

  const getBlogData = () => {
    const data = globalThis.SCP_BLOG;
    if (data && typeof data === 'object' && Array.isArray(data.posts)) return data;
    // Back-compat if we ever used a different name.
    const posts = globalThis.SCP_BLOG_POSTS;
    if (Array.isArray(posts)) return { updatedAt: '', posts };
    return { updatedAt: '', posts: [] };
  };

  const els = {
    grid: document.getElementById('blog-grid'),
    count: document.getElementById('blog-count'),
    updatedWrap: document.getElementById('blog-updated-wrap'),
    updated: document.getElementById('blog-updated'),
    query: document.getElementById('blog-query'),
    kind: document.getElementById('blog-kind'),
    lang: document.getElementById('blog-lang'),
    reload: document.getElementById('blog-reload'),
    savedToggle: document.getElementById('blog-saved-toggle'),
    modal: document.getElementById('blog-modal'),
    modalClose: document.getElementById('blog-modal-close'),
    modalBody: document.getElementById('blog-modal-body'),
  };

  if (!els.grid) return;

  const state = {
    all: [],
    updatedAt: '',
    filterQuery: '',
    filterKind: 'all',
    filterLang: 'auto',
    filterSavedOnly: false,
    savedIds: new Set(readLocalFavs()),
    userId: '',
    openId: ''
  };

  const isSaved = (postId) => {
    const id = safeText(postId);
    if (!id) return false;
    return state.savedIds.has(id);
  };

  const renderSaveButton = (postId, { compact = false } = {}) => {
    const id = safeText(postId);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'blog-save-btn';
    btn.dataset.savePostId = id;

    const apply = () => {
      const saved = isSaved(id);
      btn.classList.toggle('saved', saved);
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      if (compact) {
        btn.textContent = saved ? '★' : '☆';
        btn.title = saved ? (t('blog.actions.saved') || 'Saved') : (t('blog.actions.save') || 'Save');
      } else {
        btn.textContent = saved ? (t('blog.actions.saved') || 'Saved') : (t('blog.actions.save') || 'Save');
      }
    };

    apply();
    btn._applySavedState = apply;
    return btn;
  };

  const updateSaveButtonsInDom = () => {
    document.querySelectorAll('[data-save-post-id]').forEach((node) => {
      try {
        if (node && typeof node._applySavedState === 'function') {
          node._applySavedState();
          return;
        }
      } catch { /* ignore */ }
      const id = safeText(node && node.getAttribute ? node.getAttribute('data-save-post-id') : '');
      const saved = isSaved(id);
      try {
        node.classList.toggle('saved', saved);
        node.setAttribute('aria-pressed', saved ? 'true' : 'false');
      } catch { /* ignore */ }
    });
  };

  const updateSavedToggleUi = () => {
    if (!els.savedToggle) return;
    const on = !!state.filterSavedOnly;
    els.savedToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    els.savedToggle.classList.toggle('saved', on);
  };

  const closeModal = () => {
    if (!els.modal) return;
    els.modal.style.display = 'none';
    els.modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    state.openId = '';

    // Remove ?id=... from URL for clean navigation.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('id');
      window.history.replaceState({}, '', url.toString());
    } catch { /* ignore */ }
  };

  const withSession = async (client) => {
    if (!client) return null;
    try {
      const res = await client.auth.getSession();
      const session = res && res.data ? res.data.session : null;
      if (session && session.user && session.user.id) return session;
      return null;
    } catch {
      return null;
    }
  };

  const syncLocalToSupabase = async (client, userId) => {
    const ids = Array.from(state.savedIds || []);
    if (!client || !userId || !ids.length) return;
    try {
      const rows = ids.map((postId) => ({ user_id: userId, post_id: postId }));
      await client.from('blog_favourites').upsert(rows, { onConflict: 'user_id,post_id' });
    } catch { /* ignore */ }
  };

  const loadSavedFromSupabase = async () => {
    const client = getClient();
    if (!client) return;
    const session = await withSession(client);
    if (!session) return;
    state.userId = session.user.id || '';

    await syncLocalToSupabase(client, state.userId);

    try {
      const { data, error } = await client
        .from('blog_favourites')
        .select('post_id')
        .eq('user_id', state.userId);
      if (error) return;
      const ids = Array.isArray(data) ? data.map((r) => safeText(r && r.post_id)).filter(Boolean) : [];
      state.savedIds = new Set(ids);
      writeLocalFavs(ids);
      updateSaveButtonsInDom();
      render();
    } catch { /* ignore */ }
  };

  const setSavedFilterInUrl = (on) => {
    try {
      const url = new URL(window.location.href);
      if (on) url.searchParams.set('saved', '1');
      else url.searchParams.delete('saved');
      window.history.replaceState({}, '', url.toString());
    } catch { /* ignore */ }
  };

  const toggleSavedFilter = () => {
    state.filterSavedOnly = !state.filterSavedOnly;
    updateSavedToggleUi();
    setSavedFilterInUrl(state.filterSavedOnly);
    render();
  };

  const toggleSaved = async (post) => {
    const id = safeText(post && post.id);
    if (!id) return;

    const client = getClient();
    const session = client ? await withSession(client) : null;
    const userId = session && session.user ? session.user.id : '';

    const next = new Set(state.savedIds || []);
    const wasSaved = next.has(id);
    if (wasSaved) next.delete(id);
    else next.add(id);
    state.savedIds = next;
    writeLocalFavs(Array.from(next));
    updateSaveButtonsInDom();
    if (state.filterSavedOnly) render();

    if (!client || !userId) return;

    try {
      if (wasSaved) {
        await client.from('blog_favourites').delete().eq('user_id', userId).eq('post_id', id);
      } else {
        await client.from('blog_favourites').insert({ user_id: userId, post_id: id });
      }
    } catch {
      // ignore
    }
  };

  const openModalWithPost = (post) => {
    if (!els.modal || !els.modalBody) return;
    if (!post) return;

    const lang = getLang();
    state.openId = post.id || '';

    els.modalBody.textContent = '';

    const wrap = document.createElement('div');
    wrap.className = 'blog-post';

    const top = document.createElement('div');
    top.className = 'blog-post-top';

    const pill = document.createElement('span');
    pill.className = `blog-pill ${post.kind === 'trend' ? 'trend' : 'news'}`;
    pill.textContent = post.kind === 'trend' ? (t('blog.kind.trend') || 'Trends') : (t('blog.kind.news') || 'News');

    const date = document.createElement('div');
    date.className = 'blog-post-date';
    date.textContent = fmtDate(post.publishedAt, lang);

    top.appendChild(pill);
    top.appendChild(date);

    const title = document.createElement('h2');
    title.className = 'blog-post-title';
    title.textContent = safeText(post.title) || (t('blog.post.untitled') || 'Untitled');

    const excerpt = document.createElement('p');
    excerpt.className = 'blog-post-excerpt';
    excerpt.textContent = safeText(post.excerpt || '');

    const tagsWrap = document.createElement('div');
    tagsWrap.className = 'blog-tags';
    const tags = Array.isArray(post.tags) ? post.tags.slice(0, 12) : [];
    for (const tag of tags) {
      const span = document.createElement('span');
      span.className = 'blog-tag';
      span.textContent = safeText(tag);
      tagsWrap.appendChild(span);
    }

    wrap.appendChild(top);
    wrap.appendChild(title);
    if (excerpt.textContent) wrap.appendChild(excerpt);
    if (tagsWrap.childElementCount) wrap.appendChild(tagsWrap);

    const sections = Array.isArray(post.sections) ? post.sections : [];
    for (const section of sections) {
      if (!section || typeof section !== 'object') continue;
      const type = safeText(section.type).toLowerCase();
      if (type === 'h') {
        const h = document.createElement('h3');
        h.className = 'blog-post-h';
        h.textContent = safeText(section.text);
        if (h.textContent) wrap.appendChild(h);
      } else if (type === 'p') {
        const p = document.createElement('p');
        p.className = 'blog-post-p';
        p.textContent = safeText(section.text);
        if (p.textContent) wrap.appendChild(p);
      } else if (type === 'ul') {
        const items = Array.isArray(section.items) ? section.items : [];
        if (!items.length) continue;
        const ul = document.createElement('ul');
        ul.className = 'blog-post-ul';
        for (const item of items.slice(0, 12)) {
          const li = document.createElement('li');
          li.textContent = safeText(item);
          if (li.textContent) ul.appendChild(li);
        }
        if (ul.childElementCount) wrap.appendChild(ul);
      }
    }

    const sources = Array.isArray(post.sources) ? post.sources : [];
    if (sources.length) {
      const h = document.createElement('h3');
      h.className = 'blog-post-h';
      h.textContent = t('blog.post.sources') || 'Sources';
      wrap.appendChild(h);

      const ul = document.createElement('ul');
      ul.className = 'blog-post-ul';
      for (const s of sources.slice(0, 6)) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = String(s && s.url || '#');
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = safeText(s && (s.name || s.url) || '');
        li.appendChild(a);
        ul.appendChild(li);
      }
      wrap.appendChild(ul);
    }

    const footer = document.createElement('div');
    footer.className = 'blog-post-footer';

    const cta = document.createElement('div');
    cta.className = 'blog-post-cta';
    cta.textContent = safeText(post.cta || '');
    if (cta.textContent) footer.appendChild(cta);

    const actions = document.createElement('div');
    actions.className = 'blog-post-actions';

    const saveBtn = renderSaveButton(post.id, { compact: false });
    saveBtn.addEventListener('click', async (event) => {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      await toggleSaved(post);
    });

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'view-toggle-btn';
    copyBtn.textContent = t('blog.actions.copy_link') || 'Copy link';
    copyBtn.addEventListener('click', async () => {
      try {
        const shareUrl = new URL(`share/blog/${encodeURIComponent(post.id)}.html`, window.location.href);
        shareUrl.search = '';
        shareUrl.hash = '';
        await navigator.clipboard.writeText(shareUrl.toString());
        copyBtn.textContent = t('blog.actions.copied') || 'Copied';
        setTimeout(() => { copyBtn.textContent = t('blog.actions.copy_link') || 'Copy link'; }, 1200);
      } catch {
        // ignore
      }
    });

    actions.appendChild(saveBtn);
    actions.appendChild(copyBtn);
    footer.appendChild(actions);
    wrap.appendChild(footer);

    els.modalBody.appendChild(wrap);

    els.modal.style.display = 'block';
    els.modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    // Update URL with ?id=... so the post is shareable.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('id', post.id);
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
    h3.textContent = safeText(title) || t('blog.empty.title') || 'No posts yet';
    const p = document.createElement('div');
    p.className = 'catalog-meta';
    p.textContent = safeText(subtitle) || t('blog.empty.subtitle') || 'This section updates daily. If you just enabled it, the first posts will appear after the next sync.';
    content.appendChild(h3);
    content.appendChild(p);
    card.appendChild(content);
    els.grid.appendChild(card);
  };

  const render = () => {
    const lang = getLang();
    const q = safeText(state.filterQuery);
    const kind = state.filterKind;
    const langFilter = state.filterLang;
    const availableLangs = new Set(
      state.all
        .map((p) => safeText(p && p.lang))
        .filter(Boolean)
    );
    let desiredLang = (langFilter === 'auto') ? lang : langFilter;
    if (langFilter === 'auto' && desiredLang !== 'all' && !availableLangs.has(desiredLang)) {
      if (availableLangs.has('en')) desiredLang = 'en';
      else if (availableLangs.has('es')) desiredLang = 'es';
      else desiredLang = 'all';
    }

    const filtered = state.all
      .filter((p) => {
        if (!p || typeof p !== 'object') return false;
        if (kind !== 'all' && p.kind !== kind) return false;
        if (desiredLang !== 'all' && p.lang && p.lang !== desiredLang) return false;
        if (state.filterSavedOnly && !isSaved(p.id)) return false;
        if (!q) return true;
        if (includesLoose(p.title, q)) return true;
        if (includesLoose(p.excerpt, q)) return true;
        if (Array.isArray(p.tags) && p.tags.some((tag) => includesLoose(tag, q))) return true;
        return false;
      })
      .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));

    els.grid.textContent = '';

    if (els.count) {
      els.count.textContent = `${filtered.length} ${t('blog.count.posts') || 'posts'}`;
    }

    if (!filtered.length) {
      if (state.filterSavedOnly) {
        renderEmpty({
          title: t('blog.saved_empty.title') || 'No saved posts yet',
          subtitle: t('blog.saved_empty.subtitle') || 'Tap Save on any article to keep it here.'
        });
      } else {
        renderEmpty();
      }
      return;
    }

    for (const post of filtered.slice(0, 80)) {
      const card = document.createElement('div');
      card.className = 'catalog-card blog-card';
      card.dataset.postId = post.id || '';

      const content = document.createElement('div');
      content.className = 'catalog-content';

      const top = document.createElement('div');
      top.className = 'blog-card-top';

      const pill = document.createElement('span');
      pill.className = `blog-pill ${post.kind === 'trend' ? 'trend' : 'news'}`;
      pill.textContent = post.kind === 'trend' ? (t('blog.kind.trend') || 'Trends') : (t('blog.kind.news') || 'News');

      const date = document.createElement('span');
      date.className = 'blog-date';
      date.textContent = fmtDate(post.publishedAt, lang);

      const right = document.createElement('div');
      right.className = 'blog-card-right';

      const saveBtn = renderSaveButton(post.id, { compact: true });
      saveBtn.addEventListener('click', async (event) => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        await toggleSaved(post);
      });

      right.appendChild(date);
      right.appendChild(saveBtn);

      top.appendChild(pill);
      top.appendChild(right);

      const titleText = safeText(post.title) || (t('blog.post.untitled') || 'Untitled');

      const h3 = document.createElement('h3');
      h3.textContent = titleText;

      const meta = document.createElement('div');
      meta.className = 'catalog-meta';
      meta.textContent = safeText(post.excerpt || '');

      const tags = document.createElement('div');
      tags.className = 'blog-tags';
      const tagList = Array.isArray(post.tags) ? post.tags.slice(0, 6) : [];
      for (const tag of tagList) {
        const span = document.createElement('span');
        span.className = 'blog-tag';
        span.textContent = safeText(tag);
        tags.appendChild(span);
      }

      content.appendChild(top);
      content.appendChild(h3);
      if (meta.textContent) content.appendChild(meta);
      if (tags.childElementCount) content.appendChild(tags);

      const openHint = document.createElement('div');
      openHint.className = 'blog-card-hint';
      openHint.textContent = t('blog.card.open_hint') || (lang === 'es' ? 'Toca la tarjeta para abrir el articulo' : 'Tap card to open article');
      content.appendChild(openHint);
      card.appendChild(content);

      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${titleText} · ${openHint.textContent}`);
      card.addEventListener('click', () => openModalWithPost(post));
      card.addEventListener('keydown', (event) => {
        const k = event && event.key ? String(event.key) : '';
        if (k !== 'Enter' && k !== ' ') return;
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        openModalWithPost(post);
      });
      els.grid.appendChild(card);
    }
  };

  const init = async () => {
    // URL params: blog.html?saved=1 to show only saved posts.
    try {
      const url = new URL(window.location.href);
      state.filterSavedOnly = safeText(url.searchParams.get('saved') || '') === '1';
    } catch { /* ignore */ }

    const data = getBlogData();
    state.all = Array.isArray(data.posts) ? data.posts : [];
    state.updatedAt = safeText(data.updatedAt || '');

    // If posts are empty, try fetching JSON (useful if the JS file failed to load).
    if (!state.all.length) {
      try {
        const res = await fetch('blog-posts.json', { cache: 'no-store' });
        if (res && res.ok) {
          const json = await res.json();
          if (json && Array.isArray(json.posts)) {
            state.all = json.posts;
            state.updatedAt = safeText(json.updatedAt || '');
          }
        }
      } catch { /* ignore */ }
    }

    if (els.updated && els.updatedWrap && state.updatedAt) {
      const lang = getLang();
      const value = fmtDate(state.updatedAt, lang) || state.updatedAt;
      els.updated.textContent = value;
      els.updatedWrap.hidden = false;
    }

    if (els.savedToggle) {
      updateSavedToggleUi();
      els.savedToggle.addEventListener('click', toggleSavedFilter);
    }

    if (els.query) {
      els.query.addEventListener('input', () => {
        state.filterQuery = els.query.value || '';
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

    // Deep link support: blog.html?id=...
    try {
      const url = new URL(window.location.href);
      const id = safeText(url.searchParams.get('id') || '');
      if (id) {
        const post = state.all.find((p) => p && p.id === id) || null;
        if (post) {
          // Delay a tick so the modal doesn't fight translations/layout.
          setTimeout(() => openModalWithPost(post), 60);
        }
      }
    } catch { /* ignore */ }

    render();

    // Best-effort: load saved ids from Supabase when ready.
    const onReady = () => loadSavedFromSupabase();
    try {
      if (globalThis.scpSupabaseStatus && globalThis.scpSupabaseStatus.enabled) {
        onReady();
      } else {
        window.addEventListener('scp:supabase:ready', onReady, { once: true });
        window.setTimeout(onReady, 2500);
      }
    } catch { /* ignore */ }
  };

  init();
})();
