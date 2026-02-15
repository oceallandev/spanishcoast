// Network profile page renderer.
(() => {
  const data = window.scpNetworkData || null;
  const root = document.getElementById('network-profile');
  if (!data || !root) return;

  const i18n = window.SCP_I18N || null;
  const client = window.scpSupabase || null;

  const t = (key, fallback, vars) => {
    try {
      if (i18n && typeof i18n.t === 'function') {
        const out = i18n.t(key, vars);
        if (out && out !== key) return out;
      }
    } catch { /* ignore */ }
    return fallback;
  };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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

  const params = (() => {
    try { return new URLSearchParams(window.location.search || ''); } catch { return new URLSearchParams(); }
  })();

  const kind = String(params.get('type') || '').trim().toLowerCase();
  const slug = String(params.get('slug') || '').trim();

  const getListForKind = (k) => {
    switch (k) {
      case 'agency': return data.agencies || [];
      case 'agent': return data.agents || [];
      case 'developer': return data.developers || [];
      case 'development': return data.developments || [];
      case 'collaborator': return data.collaborators || [];
      default: return [];
    }
  };

  const findByIdOrSlug = (list, value) => {
    if (!Array.isArray(list) || !value) return null;
    const v = String(value || '').trim().toLowerCase();
    return list.find((x) => x && (String(x.slug || '').toLowerCase() === v || String(x.id || '').toLowerCase() === v)) || null;
  };

  const entity = findByIdOrSlug(getListForKind(kind), slug);

  const loadViewerIsAdmin = async () => {
    if (!client || !client.auth) return false;
    try {
      const out = await withTimeout(client.auth.getSession(), AUTH_TIMEOUT_MS, 'Session check');
      const session = out && out.data ? out.data.session : null;
      const user = session && session.user ? session.user : null;
      if (!user || !user.id) return false;
      const { data: profile, error } = await withTimeout(
        client.from('profiles').select('role').eq('user_id', user.id).maybeSingle(),
        AUTH_TIMEOUT_MS,
        'Load role'
      );
      if (error) return false;
      return profile && String(profile.role || '') === 'admin';
    } catch {
      return false;
    }
  };

  const loadCurrentState = async () => {
    if (!client || !kind || !slug) return null;
    try {
      const { data, error } = await withTimeout(
        client.from('network_profile_state')
          .select('kind,slug,suspended,reason,updated_at')
          .eq('kind', kind)
          .eq('slug', slug)
          .maybeSingle(),
        AUTH_TIMEOUT_MS,
        'Load suspension'
      );
      if (error) return null;
      return data || null;
    } catch {
      return null;
    }
  };

  const kindLabel = (k) => {
    switch (k) {
      case 'agency': return t('network.kind.agency', 'Agency');
      case 'agent': return t('network.kind.agent', 'Agent');
      case 'developer': return t('network.kind.developer', 'Developer');
      case 'development': return t('network.kind.development', 'Development');
      case 'collaborator': return t('network.kind.collaborator', 'Collaborator');
      default: return t('network.profile.unknown', 'Profile');
    }
  };

  const fmtLocation = (loc) => {
    if (!loc || typeof loc !== 'object') return '';
    const parts = [loc.town, loc.province].map((x) => String(x || '').trim()).filter(Boolean);
    return parts.join(', ');
  };

  const fmtLangs = (langs) => {
    const arr = Array.isArray(langs) ? langs : [];
    if (!arr.length) return '';
    const toShort = (code) => {
      const c = String(code || '').trim().toLowerCase();
      if (i18n && i18n.t) return i18n.t(`lang.${c}_short`) || c.toUpperCase();
      return c.toUpperCase();
    };
    return arr.map(toShort).filter(Boolean).join(' · ');
  };

  const renderActions = (contacts) => {
    const c = (contacts && typeof contacts === 'object') ? contacts : {};
    const phone = String(c.phone || '').trim();
    const whatsapp = String(c.whatsapp || '').trim();
    const email = String(c.email || '').trim();
    const website = String(c.website || '').trim();

    const out = [];
    if (phone) out.push(`<a class="cta-button" href="tel:${esc(phone.replace(/[\\s()-]/g, ''))}">${esc(t('nav.call', 'Call'))}</a>`);
    if (whatsapp) {
      const w = whatsapp.replace(/[\\s()-]/g, '').replace(/^00/, '+');
      const digits = w.replace(/[^\u002b\\d]/g, '');
      out.push(`<a class="cta-button" href="https://wa.me/${encodeURIComponent(digits.replace(/^\\+/, ''))}" target="_blank" rel="noopener">${esc(t('network.cta.whatsapp', 'WhatsApp'))}</a>`);
    }
    if (email) out.push(`<a class="cta-button cta-button--outline" href="mailto:${esc(email)}">${esc(t('nav.email', 'Email'))}</a>`);
    if (website) out.push(`<a class="cta-button cta-button--outline" href="${esc(website)}" target="_blank" rel="noopener">${esc(t('network.cta.website', 'Website'))}</a>`);
    return out.join('');
  };

  const smallCard = (k, x) => {
    const name = esc(x.name || '');
    const label = esc(kindLabel(k));
    const loc = esc(fmtLocation(x.location) || '');
    const img = esc(x.photo_url || x.logo_url || x.hero_url || x.cover_url || 'assets/placeholder.png');
    const href = `network-profile.html?type=${encodeURIComponent(k)}&slug=${encodeURIComponent(x.slug || x.id || '')}`;
    return `
      <a class="network-mini" href="${esc(href)}" aria-label="${esc(t('network.card.open_aria', 'Open profile', { name: x.name || '' }))}">
        <div class="network-mini__img">
          <img src="${img}" alt="${name}" loading="lazy" referrerpolicy="no-referrer"
            onerror="this.onerror=null;this.src='assets/placeholder.png'">
        </div>
        <div class="network-mini__body">
          <div class="network-mini__name" data-i18n-dynamic-ignore>${name}</div>
          <div class="network-mini__meta">
            <span class="network-mini__kind">${label}</span>
            ${loc ? `<span class="network-mini__loc" data-i18n-dynamic-ignore> · ${loc}</span>` : ''}
          </div>
        </div>
      </a>
    `;
  };

  const notFound = () => {
    root.innerHTML = `
      <div class="catalog-hero">
        <h2>${esc(t('network.profile.not_found_title', 'Profile not found'))}</h2>
        <p class="muted">${esc(t('network.profile.not_found_subtitle', 'Go back to the Network directory to pick a profile.'))}</p>
        <div class="simple-cta">
          <a class="cta-button" href="network.html">${esc(t('network.profile.back', 'Back to Network'))}</a>
        </div>
      </div>
    `;
  };

  // Load suspension state first so suspended profiles never flash for public users.
  root.innerHTML = `
    <div class="catalog-hero">
      <h2>${esc(t('network.profile.loading', 'Loading…'))}</h2>
      <p class="muted">${esc(t('network.profile.loading_subtitle', 'Preparing profile…'))}</p>
    </div>
  `;

  (async () => {
    const [isAdmin, state] = await Promise.all([loadViewerIsAdmin(), loadCurrentState()]);

    if (!entity) {
      notFound();
      return;
    }

    const suspended = !!(state && state.suspended);
    const reason = state && state.reason ? String(state.reason) : '';
    if (suspended && !isAdmin) {
      root.innerHTML = `
        <div class="catalog-hero">
          <h2>${esc(t('network.profile.suspended_title', 'Profile unavailable'))}</h2>
          <p class="muted">${esc(t('network.profile.suspended_subtitle', 'This profile is currently unavailable.'))}</p>
          <div class="simple-cta">
            <a class="cta-button" href="network.html">${esc(t('network.profile.back', '← Back to Network'))}</a>
          </div>
        </div>
      `;
      return;
    }

    // Relationships:
    const agency = kind === 'agent' && entity.agency_id ? findByIdOrSlug(data.agencies || [], entity.agency_id) : null;
    const developerFromAgent = kind === 'agent' && entity.developer_id ? findByIdOrSlug(data.developers || [], entity.developer_id) : null;
    const developerFromDevelopment = kind === 'development' && entity.developer_id ? findByIdOrSlug(data.developers || [], entity.developer_id) : null;
    const developer = developerFromDevelopment || developerFromAgent || (kind === 'developer' ? entity : null);

    const agentsInAgency = kind === 'agency'
      ? (data.agents || []).filter((a) => a && String(a.agency_id || '') === String(entity.id))
      : [];

    const agentsInDeveloper = kind === 'developer'
      ? (data.agents || []).filter((a) => a && String(a.developer_id || '') === String(entity.id))
      : [];

    const devsDevelopments = kind === 'developer'
      ? (data.developments || []).filter((d) => d && String(d.developer_id || '') === String(entity.id))
      : [];

    const label = kindLabel(kind);
    const name = esc(entity.name || '');
    const headline = esc(entity.headline || '');
    const loc = esc(fmtLocation(entity.location) || '');
    const langs = esc(fmtLangs(entity.languages) || '');
    const tags = Array.isArray(entity.tags) ? entity.tags.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 10) : [];
    const img = esc(entity.photo_url || entity.logo_url || entity.hero_url || entity.cover_url || 'assets/placeholder.png');
    const verified = !!entity.verified;
    const bio = esc(entity.bio || '');

    try {
      document.title = `${entity.name || label} | Spanish Coast Properties`;
    } catch { /* ignore */ }

    const sources = (() => {
      if (!entity.source_refs || typeof entity.source_refs !== 'object') return '';
      const redspRef = entity.source_refs.redsp && entity.source_refs.redsp.development_ref ? String(entity.source_refs.redsp.development_ref) : '';
      if (!redspRef) return '';
      return `
        <div class="network-kv">
          <div class="network-kv__k">${esc(t('network.profile.source_refs', 'Source refs'))}</div>
          <div class="network-kv__v">
            <span class="network-pill" data-i18n-dynamic-ignore>REDSP: ${esc(redspRef)}</span>
          </div>
        </div>
      `;
    })();

    const suspendedBanner = suspended && isAdmin ? `
      <div class="network-suspend-banner" role="status">
        <span class="network-pill network-pill--danger">${esc(t('network.suspended', 'Suspended'))}</span>
        <span class="network-suspend-banner__text">${esc(reason || t('network.suspended_reason_unknown', 'No reason provided.'))}</span>
      </div>
    ` : '';

    root.innerHTML = `
      ${suspendedBanner}
      <div class="catalog-hero network-hero">
        <div class="network-hero__grid">
          <div class="network-hero__left">
            <div class="network-hero__top">
              <div class="network-avatar network-avatar--lg">
                <img src="${img}" alt="${name}" loading="lazy" referrerpolicy="no-referrer"
                  onerror="this.onerror=null;this.src='assets/placeholder.png'">
              </div>
              <div class="network-hero__titles">
                <div class="network-hero__kind">${esc(label)}${verified ? ` <span class="network-verified" aria-label="${esc(t('network.verified', 'Verified'))}">✓</span>` : ''}</div>
                <h2 class="network-hero__name" data-i18n-dynamic-ignore>${name}</h2>
                ${headline ? `<div class="network-hero__headline">${headline}</div>` : ''}
              </div>
            </div>

            <div class="network-hero__meta">
              ${loc ? `<div class="network-meta">📍 <span data-i18n-dynamic-ignore>${loc}</span></div>` : ''}
              ${langs ? `<div class="network-meta">🗣️ <span data-i18n-dynamic-ignore>${langs}</span></div>` : ''}
            </div>

            ${tags.length ? `<div class="network-tags">${tags.map((tag) => `<span class="network-tag" data-i18n-dynamic-ignore>${esc(tag)}</span>`).join('')}</div>` : ''}
          </div>

          <aside class="network-hero__right">
            <div class="network-sidecard">
              <div class="network-sidecard__title" data-i18n="network.profile.contact">Contact</div>
              <div class="network-sidecard__actions">
                ${renderActions(entity.contacts)}
              </div>
            </div>
            <div class="network-sidecard">
              <div class="network-sidecard__title" data-i18n="network.profile.quick_facts">Quick facts</div>
              <div class="network-kv">
                <div class="network-kv__k" data-i18n="network.profile.location">Location</div>
                <div class="network-kv__v" data-i18n-dynamic-ignore>${loc || esc(t('common.na', 'N/A'))}</div>
              </div>
              <div class="network-kv">
                <div class="network-kv__k" data-i18n="network.profile.languages">Languages</div>
                <div class="network-kv__v" data-i18n-dynamic-ignore>${langs || esc(t('common.na', 'N/A'))}</div>
              </div>
              ${sources}
            </div>
          </aside>
        </div>
      </div>

      <div class="network-profile__grid">
        <section class="simple-section">
          <h2 data-i18n="network.profile.about">About</h2>
          ${bio ? `<p>${bio}</p>` : `<p class="muted">${esc(t('network.profile.no_bio', 'No bio yet.'))}</p>`}
        </section>

        <section class="simple-section">
          <h2 data-i18n="network.profile.relationships">Relationships</h2>
          <div class="network-rel-grid">
            ${agency ? `
              <div class="network-rel">
                <div class="network-rel__k" data-i18n="network.profile.agent_of_agency">Agency</div>
                <div class="network-rel__v">${smallCard('agency', agency)}</div>
              </div>
            ` : ''}
            ${(developerFromAgent || developerFromDevelopment) ? `
              <div class="network-rel">
                <div class="network-rel__k" data-i18n="network.profile.agent_of_developer">Developer</div>
                <div class="network-rel__v">${smallCard('developer', (developerFromDevelopment || developerFromAgent))}</div>
              </div>
            ` : ''}
            ${kind === 'development' && developer ? `
              <div class="network-rel">
                <div class="network-rel__k" data-i18n="network.profile.development_developer">Developer</div>
                <div class="network-rel__v">${smallCard('developer', developer)}</div>
              </div>
            ` : ''}
            ${kind === 'agency' && agentsInAgency.length ? `
              <div class="network-rel">
                <div class="network-rel__k" data-i18n="network.profile.agency_agents">Agents in this agency</div>
                <div class="network-mini-grid">
                  ${agentsInAgency.slice(0, 12).map((a) => smallCard('agent', a)).join('')}
                </div>
              </div>
            ` : ''}
            ${kind === 'developer' && devsDevelopments.length ? `
              <div class="network-rel">
                <div class="network-rel__k" data-i18n="network.profile.developer_developments">Developments</div>
                <div class="network-mini-grid">
                  ${devsDevelopments.slice(0, 12).map((d) => smallCard('development', d)).join('')}
                </div>
              </div>
            ` : ''}
            ${kind === 'developer' && agentsInDeveloper.length ? `
              <div class="network-rel">
                <div class="network-rel__k" data-i18n="network.profile.developer_agents">Developer agents</div>
                <div class="network-mini-grid">
                  ${agentsInDeveloper.slice(0, 12).map((a) => smallCard('agent', a)).join('')}
                </div>
              </div>
            ` : ''}
            ${(!agency && !developerFromAgent && !developerFromDevelopment && kind !== 'agency' && kind !== 'developer' && kind !== 'development') ? `
              <p class="muted">${esc(t('network.profile.no_relationships', 'No relationships defined yet.'))}</p>
            ` : ''}
          </div>
        </section>
      </div>
    `;
  })();
})();
