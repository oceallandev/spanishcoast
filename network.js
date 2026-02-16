// Network directory page: Agencies, Agents, Developers, Developments, Collaborators.
(() => {
  const data = window.scpNetworkDataMerged || window.scpNetworkData || null;
  const grid = document.getElementById('network-grid');
  const queryEl = document.getElementById('network-query');
  const kindEl = document.getElementById('network-kind');
  const countEl = document.getElementById('network-count');
  const chips = Array.from(document.querySelectorAll('[data-network-kind]'));

  if (!data || !grid || !queryEl || !kindEl || !countEl) return;

  const i18n = window.SCP_I18N || null;
  const client = window.scpSupabase || null;

  let viewerRole = 'client';
  let isAdmin = false;
  let stateByKey = {};

  const t = (key, fallback, vars) => {
    try {
      if (i18n && typeof i18n.t === 'function') {
        const out = i18n.t(key, vars);
        if (out && out !== key) return out;
      }
    } catch { /* ignore */ }
    return fallback;
  };

  const withTimeout = async (promise, ms, label) => {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = window.setTimeout(() => reject(new Error(`${label || 'Request'} timed out after ${ms}ms`)), ms);
        })
      ]);
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  };

  const AUTH_TIMEOUT_MS = 6000;

  const loadViewerRole = async () => {
    if (!client || !client.auth) return;
    try {
      const out = await withTimeout(client.auth.getSession(), AUTH_TIMEOUT_MS, 'Session check');
      const session = out && out.data ? out.data.session : null;
      const user = session && session.user ? session.user : null;
      if (!user || !user.id) return;

      const { data: profile, error } = await withTimeout(
        client.from('profiles').select('role').eq('user_id', user.id).maybeSingle(),
        AUTH_TIMEOUT_MS,
        'Load role'
      );
      if (!error && profile && profile.role) viewerRole = String(profile.role);
      isAdmin = viewerRole === 'admin';
    } catch {
      // ignore
    }
  };

  const loadProfileStates = async () => {
    if (!client) return;
    try {
      const { data: rows, error } = await withTimeout(
        client.from('network_profile_state').select('kind,slug,suspended,reason,updated_at').limit(5000),
        AUTH_TIMEOUT_MS,
        'Load network state'
      );
      if (error) return;
      const map = {};
      (Array.isArray(rows) ? rows : []).forEach((r) => {
        const kind = String(r && r.kind ? r.kind : '').trim().toLowerCase();
        const slug = String(r && r.slug ? r.slug : '').trim();
        if (!kind || !slug) return;
        map[`${kind}:${slug}`] = r;
      });
      stateByKey = map;
    } catch {
      // ignore
    }
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const normalize = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const kindLabel = (kind) => {
    switch (kind) {
      case 'agency': return t('network.kind.agency', 'Agency');
      case 'agent': return t('network.kind.agent', 'Agent');
      case 'developer': return t('network.kind.developer', 'Developer');
      case 'development': return t('network.kind.development', 'Development');
      case 'collaborator': return t('network.kind.collaborator', 'Collaborator');
      default: return t('common.all', 'All');
    }
  };

  const flatten = () => {
    const out = [];
    (data.agencies || []).forEach((x) => out.push({ kind: 'agency', ...x }));
    (data.agents || []).forEach((x) => out.push({ kind: 'agent', ...x }));
    (data.developers || []).forEach((x) => out.push({ kind: 'developer', ...x }));
    (data.developments || []).forEach((x) => out.push({ kind: 'development', ...x }));
    (data.collaborators || []).forEach((x) => out.push({ kind: 'collaborator', ...x }));
    return out;
  };

  const items = flatten();

  const stateFor = (item) => {
    if (!item) return null;
    const kind = String(item.kind || '').trim().toLowerCase();
    const slug = String(item.slug || item.id || '').trim();
    if (!kind || !slug) return null;
    return stateByKey[`${kind}:${slug}`] || null;
  };

  const isSuspended = (item) => {
    const st = stateFor(item);
    return !!(st && st.suspended);
  };

  const getLocationText = (item) => {
    const loc = item && item.location ? item.location : null;
    if (!loc || typeof loc !== 'object') return '';
    const parts = [loc.town, loc.province].map((x) => String(x || '').trim()).filter(Boolean);
    return parts.join(', ');
  };

  const getLanguagesText = (item) => {
    const langs = Array.isArray(item.languages) ? item.languages : [];
    if (!langs.length) return '';
    const toShort = (code) => {
      const c = String(code || '').trim().toLowerCase();
      if (i18n && i18n.t) return i18n.t(`lang.${c}_short`) || c.toUpperCase();
      return c.toUpperCase();
    };
    return langs.map(toShort).filter(Boolean).join(' · ');
  };

  const getTags = (item) => {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return tags.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 4);
  };

  const cardHtml = (item) => {
    const name = esc(item.name || '');
    const headline = esc(item.headline || '');
    const locText = esc(getLocationText(item) || '');
    const langText = esc(getLanguagesText(item) || '');
    const label = esc(kindLabel(item.kind));
    const verified = !!item.verified;
    const suspended = isSuspended(item);
    const suspendedTag = suspended && isAdmin ? `<span class="network-tag network-tag--danger">${esc(t('network.suspended', 'Suspended'))}</span>` : '';
    const tags = getTags(item);
    const img =
      esc(item.photo_url || item.logo_url || item.hero_url || item.cover_url || 'assets/placeholder.png');

    const href = `network-profile.html?type=${encodeURIComponent(item.kind)}&slug=${encodeURIComponent(item.slug || item.id || '')}`;
    const aria = esc(t('network.card.open_aria', 'Open profile', { name: item.name || '' }));

    return `
      <article class="catalog-card network-card" role="link" tabindex="0" aria-label="${aria}" data-href="${esc(href)}">
        <div class="catalog-content network-card__content">
          <div class="network-card__top">
            <div class="network-avatar">
              <img src="${img}" alt="${name}" loading="lazy" referrerpolicy="no-referrer"
                onerror="this.onerror=null;this.src='assets/placeholder.png'">
            </div>
            <div class="network-card__title">
              <div class="network-name" data-i18n-dynamic-ignore>${name}</div>
              <div class="network-type">${label}${verified ? ` <span class="network-verified" aria-label="${esc(t('network.verified', 'Verified'))}">✓</span>` : ''}</div>
            </div>
          </div>

          ${headline ? `<div class="network-headline">${headline}</div>` : ''}

          <div class="network-meta-row">
            ${locText ? `<div class="network-meta">📍 <span data-i18n-dynamic-ignore>${locText}</span></div>` : ''}
            ${langText ? `<div class="network-meta">🗣️ <span data-i18n-dynamic-ignore>${langText}</span></div>` : ''}
          </div>

          ${(suspendedTag || tags.length)
            ? `<div class="network-tags">${suspendedTag}${tags.map((tag) => `<span class="network-tag" data-i18n-dynamic-ignore>${esc(tag)}</span>`).join('')}</div>`
            : ''}

          <div class="network-open-hint" data-i18n="network.card.open_hint">Tap card to open profile</div>
        </div>
      </article>
    `;
  };

  const setChipPressed = (activeKind) => {
    chips.forEach((btn) => {
      const isActive = String(btn.getAttribute('data-network-kind') || '') === String(activeKind || '');
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      btn.classList.toggle('active', isActive);
    });
  };

  const render = () => {
    const query = normalize(queryEl.value || '');
    const kind = String(kindEl.value || 'all');

    setChipPressed(kind);

    const matches = items.filter((item) => {
      if (!item) return false;
      if (kind !== 'all' && item.kind !== kind) return false;
      if (isSuspended(item) && !isAdmin) return false;
      if (!query) return true;

      const bag = [
        item.name,
        item.headline,
        item.bio,
        getLocationText(item),
        ...(Array.isArray(item.tags) ? item.tags : []),
        ...(Array.isArray(item.service_areas) ? item.service_areas : []),
        ...(Array.isArray(item.languages) ? item.languages : [])
      ].map((x) => normalize(x)).filter(Boolean).join(' | ');
      return bag.includes(query);
    });

    countEl.textContent = t('network.count', `${matches.length} profiles`, { n: matches.length });
    grid.innerHTML = matches.map(cardHtml).join('') || `
      <article class="catalog-card">
        <div class="catalog-content">
          <h3>${esc(t('network.empty.title', 'No profiles yet'))}</h3>
          <div class="catalog-meta">${esc(t('network.empty.subtitle', 'Add profiles in network-data.js.'))}</div>
        </div>
      </article>
    `;
  };

  const openCard = (el) => {
    if (!el) return;
    const href = el.getAttribute('data-href') || '';
    if (!href) return;
    window.location.href = href;
  };

  grid.addEventListener('click', (e) => {
    const card = e.target && e.target.closest ? e.target.closest('.network-card') : null;
    if (!card) return;
    openCard(card);
  });

  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target && e.target.closest ? e.target.closest('.network-card') : null;
    if (!card) return;
    e.preventDefault();
    openCard(card);
  });

  chips.forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = String(btn.getAttribute('data-network-kind') || 'all');
      kindEl.value = kind;
      render();
    });
  });

  queryEl.addEventListener('input', render);
  kindEl.addEventListener('change', render);

  // Support deep links like network.html?kind=developer&q=... (optional).
  try {
    const url = new URL(window.location.href);
    const k = url.searchParams.get('kind');
    const q = url.searchParams.get('q');
    if (k && ['all', 'agency', 'agent', 'developer', 'development', 'collaborator'].includes(k)) {
      kindEl.value = k;
    }
    if (q) queryEl.value = q;
  } catch { /* ignore */ }

  // Render immediately, then refresh after loading suspensions + viewer role.
  render();
  (async () => {
    await Promise.all([loadViewerRole(), loadProfileStates()]);
    render();
  })();
})();
