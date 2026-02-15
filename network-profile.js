// Network profile page renderer.
(() => {
  const data = window.scpNetworkDataMerged || window.scpNetworkData || null;
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
    const profileRefRaw = String(entity.ref || entity.scp_ref || '').trim();

    try {
      document.title = `${entity.name || label} | Spanish Coast Properties`;
    } catch { /* ignore */ }

    const refRow = `
      <div class="network-kv">
        <div class="network-kv__k" data-i18n="network.profile.ref">Reference</div>
        <div class="network-kv__v">
          ${profileRefRaw
    ? `<span class="network-pill" data-i18n-dynamic-ignore>${esc(profileRefRaw)}</span>`
    : `<span class="muted">${esc(t('common.na', 'N/A'))}</span>`}
        </div>
      </div>
    `;

    const adminSourceRow = isAdmin ? `
      <div class="network-kv">
        <div class="network-kv__k" data-i18n="network.profile.source_ref">Source ref</div>
        <div class="network-kv__v" style="display:flex; flex-wrap:wrap; gap:0.45rem; align-items:center;">
          <button class="ref-chip ref-chip--small" type="button" id="network-source-ref-btn">${esc(t('network.profile.source_ref_btn', 'Show'))}</button>
          <span class="network-pill" id="network-source-ref-out" style="display:none" data-i18n-dynamic-ignore></span>
        </div>
      </div>
    ` : '';

    const suspendedBanner = suspended && isAdmin ? `
      <div class="network-suspend-banner" role="status">
        <span class="network-pill network-pill--danger">${esc(t('network.suspended', 'Suspended'))}</span>
        <span class="network-suspend-banner__text">${esc(reason || t('network.suspended_reason_unknown', 'No reason provided.'))}</span>
      </div>
    ` : '';

    const claimMailto = (() => {
      const subj = encodeURIComponent(`Profile claim: ${kind}:${slug}`);
      const body = encodeURIComponent(
        `Hello Spanish Coast Properties,\n\n` +
        `I would like to request control over this public Network profile:\n` +
        `${profileRefRaw ? `- Reference: ${profileRefRaw}\n` : ''}` +
        `- Type: ${kind}\n` +
        `- Slug: ${slug}\n` +
        `- Name: ${entity.name || ''}\n\n` +
        `Please include your contact details, proof of ownership/representation, and whether you want to edit or delete the profile.\n`
      );
      return `mailto:info@spanishcoastproperties.com?subject=${subj}&body=${body}`;
    })();

    const claimCard = entity && entity.claimable ? `
      <div class="network-sidecard">
        <div class="network-sidecard__title" data-i18n="network.profile.claim.title">Own this profile?</div>
        <div class="muted" style="margin-top:0.35rem" data-i18n="network.profile.claim.subtitle">
          If you represent this profile, you can request to edit or delete it.
        </div>
        <div class="form-actions" style="margin-top:0.75rem">
          <button class="cta-button cta-button--outline" type="button" id="profile-claim-open" data-i18n="network.profile.claim.open_btn">Request control</button>
          <a class="cta-button cta-button--outline" href="${esc(claimMailto)}" data-i18n="network.profile.claim.email_btn">Email us</a>
        </div>
        <form id="profile-claim-form" class="form-grid" style="display:none; margin-top:0.85rem">
          <label>
            <span data-i18n="network.profile.claim.action">Action</span>
            <select id="profile-claim-action" class="admin-select">
              <option value="edit" data-i18n="network.profile.claim.action_edit">Edit this profile</option>
              <option value="delete" data-i18n="network.profile.claim.action_delete">Delete this profile</option>
            </select>
          </label>
          <label>
            <span data-i18n="network.profile.claim.name">Your name</span>
            <input id="profile-claim-name" type="text" placeholder="Your full name" data-i18n-placeholder="network.profile.claim.name_placeholder">
          </label>
          <label>
            <span data-i18n="network.profile.claim.email">Your email</span>
            <input id="profile-claim-email" type="email" placeholder="you@company.com" data-i18n-placeholder="network.profile.claim.email_placeholder" required>
          </label>
          <label>
            <span data-i18n="network.profile.claim.message">Message</span>
            <textarea id="profile-claim-message" placeholder="Add proof (website, phone, role) and what you want to change…" data-i18n-placeholder="network.profile.claim.message_placeholder"></textarea>
          </label>
          <div class="form-actions">
            <button class="cta-button" type="submit" id="profile-claim-submit" data-i18n="network.profile.claim.submit">Send request</button>
          </div>
          <div id="profile-claim-status" class="muted" aria-live="polite"></div>
        </form>
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
            ${claimCard}
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
              ${refRow}
              ${adminSourceRow}
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

    const copyTextToClipboard = async (text) => {
      const v = String(text == null ? '' : text);
      if (!v.trim()) return false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(v);
          return true;
        }
      } catch { /* ignore */ }
      try {
        window.prompt('Copy:', v);
        return true;
      } catch {
        return false;
      }
    };

    const sourceLabel = (source) => {
      const s = String(source || '').trim().toLowerCase();
      if (!s) return '';
      if (s.includes('redsp')) return 'REDSP';
      const up = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!up) return '';
      return up.length <= 8 ? up : up.slice(0, 8);
    };

    // Admin-only: fetch and reveal external/source references on demand.
    const wireSourceRefUi = () => {
      if (!isAdmin) return;
      const btn = document.getElementById('network-source-ref-btn');
      const out = document.getElementById('network-source-ref-out');
      if (!btn || !out) return;
      if (!profileRefRaw) {
        btn.style.display = 'none';
        return;
      }

      btn.addEventListener('click', async () => {
        const cached = String(out.dataset.originalRef || '').trim();
        if (cached) {
          const prev = btn.textContent;
          await copyTextToClipboard(cached);
          btn.textContent = t('network.profile.source_ref_copied', 'Copied');
          window.setTimeout(() => { btn.textContent = prev || t('network.profile.source_ref_copy', 'Copy'); }, 1100);
          return;
        }

        if (!client) return;

        const prevText = btn.textContent;
        btn.disabled = true;
        btn.textContent = t('network.profile.source_ref_loading', 'Loading…');
        try {
          const { data, error } = await withTimeout(
            client.from('network_profile_ref_map')
              .select('kind,source,original_ref,original_id')
              .eq('scp_ref', profileRefRaw)
              .maybeSingle(),
            AUTH_TIMEOUT_MS,
            'Load source ref'
          );
          if (error) throw error;

          const originalRef = data && data.original_ref ? String(data.original_ref).trim() : '';
          if (!originalRef) {
            btn.textContent = t('network.profile.source_ref_not_found', 'Not found');
            window.setTimeout(() => { btn.textContent = prevText || t('network.profile.source_ref_btn', 'Show'); }, 1400);
            return;
          }

          const src = sourceLabel(data && data.source);
          const label = src ? `${src}: ` : '';
          const originalId = data && data.original_id ? String(data.original_id).trim() : '';
          const suffix = originalId ? ` · ${originalId}` : '';
          out.textContent = `${label}${originalRef}${suffix}`;
          out.dataset.originalRef = originalRef;
          out.dataset.originalId = originalId;
          out.style.display = 'inline-flex';

          await copyTextToClipboard(originalRef);
          btn.textContent = t('network.profile.source_ref_copied', 'Copied');
          window.setTimeout(() => { btn.textContent = t('network.profile.source_ref_copy', 'Copy'); }, 1100);
        } catch (error) {
          const msg = error && error.message ? String(error.message) : String(error || '');
          const lower = msg.toLowerCase();
          if (lower.includes('relation') && lower.includes('network_profile_ref_map')) {
            btn.textContent = t(
              'network.profile.source_ref_table_missing',
              'Missing table'
            );
          } else if (lower.includes('permission') || lower.includes('rls')) {
            btn.textContent = t('network.profile.source_ref_admin_only', 'Admin only');
          } else {
            btn.textContent = t('network.profile.source_ref_failed', 'Failed');
          }
          window.setTimeout(() => { btn.textContent = prevText || t('network.profile.source_ref_btn', 'Show'); }, 1600);
        } finally {
          btn.disabled = false;
        }
      });
    };

    wireSourceRefUi();

    // Claim request UI (optional, only for claimable imported profiles).
    const wireClaimUi = () => {
      if (!entity || !entity.claimable) return;
      const openBtn = document.getElementById('profile-claim-open');
      const form = document.getElementById('profile-claim-form');
      const statusEl = document.getElementById('profile-claim-status');
      const actionEl = document.getElementById('profile-claim-action');
      const nameEl = document.getElementById('profile-claim-name');
      const emailEl = document.getElementById('profile-claim-email');
      const msgEl = document.getElementById('profile-claim-message');
      const submitBtn = document.getElementById('profile-claim-submit');
      if (!openBtn || !form || !statusEl || !emailEl || !submitBtn || !actionEl) return;

      const loadUser = async () => {
        if (!client || !client.auth) return null;
        try {
          const out = await withTimeout(client.auth.getSession(), AUTH_TIMEOUT_MS, 'Session check');
          const session = out && out.data ? out.data.session : null;
          const user = session && session.user ? session.user : null;
          return user && user.id ? user : null;
        } catch {
          return null;
        }
      };

      const prefill = async () => {
        const user = await loadUser();
        if (user && user.email && !String(emailEl.value || '').trim()) {
          emailEl.value = String(user.email);
        }
        return user;
      };

      openBtn.addEventListener('click', async () => {
        const isOpen = form.style.display !== 'none';
        form.style.display = isOpen ? 'none' : 'grid';
        if (!isOpen) {
          statusEl.textContent = '';
          await prefill();
        }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!client) {
          statusEl.textContent = t('network.profile.claim.no_client', 'Supabase client not available on this page.');
          return;
        }

        const email = String(emailEl.value || '').trim().toLowerCase();
        if (!email || !email.includes('@')) {
          statusEl.textContent = t('network.profile.claim.invalid_email', 'Please enter a valid email.');
          return;
        }

        const user = await prefill();
        if (!user) {
          statusEl.innerHTML = esc(t('network.profile.claim.sign_in_required', 'Sign in first on Account, then submit again.'));
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = t('network.profile.claim.sending', 'Sending…');
        statusEl.textContent = t('network.profile.claim.sending', 'Sending…');

        try {
          const payload = {
            kind,
            slug,
            requester_user_id: user.id,
            requester_email: email,
            requester_name: String(nameEl && nameEl.value ? nameEl.value : '').trim() || null,
            requested_action: String(actionEl.value || 'edit'),
            message: String(msgEl && msgEl.value ? msgEl.value : '').trim() || null,
            status: 'new'
          };

          const { error } = await withTimeout(
            client.from('network_profile_claims').insert(payload),
            AUTH_TIMEOUT_MS,
            'Submit claim'
          );
          if (error) throw error;

          statusEl.textContent = t('network.profile.claim.sent', 'Request sent. Our team will reply by email.');
          form.reset();
          form.style.display = 'none';
        } catch (error) {
          const msg = error && error.message ? String(error.message) : String(error || '');
          if (msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('network_profile_claims')) {
            statusEl.textContent = t(
              'network.profile.claim.table_missing',
              'Claim requests table is missing. Admin: run `supabase_network_claims.sql` in Supabase SQL editor.'
            );
          } else {
            statusEl.textContent = t('network.profile.claim.failed', 'Failed to send: {error}', { error: msg });
          }
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = t('network.profile.claim.submit', 'Send request');
        }
      });
    };

    wireClaimUi();
  })();
})();
