(() => {
  const statusText = document.getElementById('status-text');
  const statusHint = document.getElementById('status-hint');
  const authStatus = document.getElementById('auth-status');
  const clearCacheAuthBtn = document.getElementById('clear-offline-cache-auth');
  const resetAuthBtn = document.getElementById('reset-auth-storage');
  const signOutBtn = document.getElementById('sign-out-btn');
  const authPanels = document.getElementById('auth-panels');
  const dashboardPanels = document.getElementById('dashboard-panels');
  const dashRole = document.getElementById('dash-role');
  const dashSavedCount = document.getElementById('dash-saved-count');
  const dashAdminTile = document.getElementById('dash-admin-tile');
  const dashCrmTile = document.getElementById('dash-crm-tile');
  const dashShopTile = document.getElementById('dash-shop-tile');
  const partnerTile = document.getElementById('dash-partner-tile');
  const partnerK = document.getElementById('dash-partner-k');
  const partnerV = document.getElementById('dash-partner-v');
  const partnerDesc = document.getElementById('dash-partner-desc');
  const adminPanel = document.getElementById('admin-panel');
  const adminUserQ = document.getElementById('admin-user-q');
  const adminUserRefresh = document.getElementById('admin-user-refresh');
  const adminUserStatus = document.getElementById('admin-user-status');
  const adminUserList = document.getElementById('admin-user-list');
  const diagnosticsPanel = document.getElementById('diagnostics');
  const diagLines = document.getElementById('diag-lines');
  const clearCacheBtn = document.getElementById('clear-offline-cache');

  const signInForm = document.getElementById('sign-in-form');
  const signInEmail = document.getElementById('sign-in-email');
  const signInPassword = document.getElementById('sign-in-password');

  const signUpForm = document.getElementById('sign-up-form');
  const signUpEmail = document.getElementById('sign-up-email');
  const signUpPassword = document.getElementById('sign-up-password');

  const magicForm = document.getElementById('magic-link-form');
  const magicEmail = document.getElementById('magic-email');

  const resetPasswordForm = document.getElementById('reset-password-form');
  const resetPasswordEmail = document.getElementById('reset-email');

  const recoveryPanel = document.getElementById('password-recovery-panel');
  const recoveryForm = document.getElementById('password-recovery-form');
  const recoveryPassword = document.getElementById('recovery-password');
  const recoveryPassword2 = document.getElementById('recovery-password2');
  const recoveryCancel = document.getElementById('recovery-cancel');

  const setStatus = (text, hint) => {
    if (statusText) statusText.textContent = text;
    if (statusHint) statusHint.textContent = hint || '';
    if (authStatus) {
      const msg = [text, hint].filter((v) => v != null && String(v).trim()).join('\n');
      authStatus.textContent = msg;
      authStatus.style.display = msg ? 'block' : 'none';
    }
  };

  const getClient = () => window.scpSupabase || null;

  const setVisible = (el, yes, display = 'block') => {
    if (!el) return;
    el.style.display = yes ? display : 'none';
  };

  const FAVORITES_STORAGE_KEY = 'scp:favourites:v1';
  const readSavedCount = () => {
    try {
      if (!window.localStorage) return 0;
      const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  const ROLE_META = {
    admin: { label: 'Admin', partner: true },
    partner: { label: 'Partner', partner: true },
    agency_admin: { label: 'Agency admin', partner: true },
    agent: { label: 'Agent', partner: true },
    developer: { label: 'Developer', partner: true },
    collaborator: { label: 'Collaborator', partner: true },
    client: { label: 'Client', partner: false }
  };

  const addDiag = (level, title, detail) => {
    if (!diagLines) return;
    const row = document.createElement('div');
    row.className = `diag-line ${level === 'ok' ? 'diag-ok' : level === 'warn' ? 'diag-warn' : 'diag-bad'}`;
    row.innerHTML = `<div><b>${title}</b><div class="muted">${detail || ''}</div></div><div><b>${level.toUpperCase()}</b></div>`;
    diagLines.appendChild(row);
  };

  const clearDiag = () => {
    if (diagLines) diagLines.innerHTML = '';
  };

  const withTimeout = async (promise, ms, label) => {
    let t;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          t = window.setTimeout(() => reject(new Error(`${label || 'Request'} timed out after ${ms}ms`)), ms);
        })
      ]);
    } finally {
      if (t) window.clearTimeout(t);
    }
  };

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));

  const isAbortLikeError = (error) => {
    const msg = error && error.message ? String(error.message) : String(error || '');
    const lower = msg.toLowerCase();
    return lower.includes('abort') || lower.includes('aborted') || lower.includes('signal');
  };

  const getSessionSafe = async (client, { retries = 2 } = {}) => {
    if (!client) return { data: { session: null } };
    let lastErr = null;
    for (let i = 0; i <= retries; i++) {
      try {
        return await client.auth.getSession();
      } catch (error) {
        lastErr = error;
        // Some browsers can throw AbortError during auth init; retry a couple times before surfacing.
        if (i < retries && isAbortLikeError(error)) {
          await sleep(140 * (i + 1));
          continue;
        }
        throw error;
      }
    }
    throw lastErr || new Error('Failed to read session');
  };

  // Supabase can be slow to respond on some networks, and free-tier projects can "wake up" after
  // a period of inactivity. Keep this fairly generous so users don't get logged out / stuck.
  const AUTH_TIMEOUT_MS = 60000;

  const MAGIC_COOLDOWN_KEY = 'scp:magic_link:cooldown_until';
  const MAGIC_COOLDOWN_MS = 60 * 1000;
  const MAGIC_RATE_LIMIT_COOLDOWN_MS = 3 * 60 * 1000;
  let magicCooldownTimer = null;

  const RESET_COOLDOWN_KEY = 'scp:password_reset:cooldown_until';
  const RESET_COOLDOWN_MS = 60 * 1000;
  const RESET_RATE_LIMIT_COOLDOWN_MS = 3 * 60 * 1000;
  let resetCooldownTimer = null;

  let recoveryMode = false;
  let sawAuthEvent = false;

  const clearOfflineCacheAndReload = async () => {
    setStatus('Clearing offline cache…', 'This will refresh the page.');
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      // ignore
    }
    try {
      if (window.caches && caches.keys) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k.startsWith('scp-cache-')).map((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('v', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  const clearAuthStorage = () => {
    try {
      const cfg = window.SCP_CONFIG || {};
      const url = (cfg.supabaseUrl || '').trim();
      if (!url) return;
      const host = new URL(url).hostname || '';
      const ref = host.split('.')[0] || '';
      if (!ref) return;
      const prefix = `sb-${ref}-`;

      const clearPrefix = (storage) => {
        if (!storage) return;
        const toDelete = [];
        for (let i = 0; i < storage.length; i += 1) {
          const k = storage.key(i);
          if (!k) continue;
          if (k.startsWith(prefix)) toDelete.push(k);
        }
        toDelete.forEach((k) => storage.removeItem(k));
      };

      try { clearPrefix(window.localStorage); } catch { /* ignore */ }
      try { clearPrefix(window.sessionStorage); } catch { /* ignore */ }

      // IndexedDB fallback storage (used in strict/private modes). Best effort.
      try {
        const st = window.scpSupabaseStatus || {};
        const dbName = st && st.idb && st.idb.dbName ? String(st.idb.dbName) : '';
        if (dbName && window.indexedDB && typeof window.indexedDB.deleteDatabase === 'function') {
          window.indexedDB.deleteDatabase(dbName);
        }
      } catch {
        // ignore
      }

      // Also clear local cooldowns so the user isn't locked out by mistake.
      try { window.localStorage && window.localStorage.removeItem(MAGIC_COOLDOWN_KEY); } catch { /* ignore */ }
      try { window.sessionStorage && window.sessionStorage.removeItem(MAGIC_COOLDOWN_KEY); } catch { /* ignore */ }
    } catch {
      // ignore
    }
  };

  const resetAuthStorageAndReload = async () => {
    setStatus('Resetting login…', 'Clearing saved session data and offline cache.');
    clearAuthStorage();
    await clearOfflineCacheAndReload();
  };

  const readMagicCooldownUntil = () => {
    try {
      if (!window.localStorage) return 0;
      const raw = window.localStorage.getItem(MAGIC_COOLDOWN_KEY);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  };

  const setMagicCooldown = (ms) => {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(MAGIC_COOLDOWN_KEY, String(Date.now() + Math.max(0, Number(ms) || 0)));
    } catch {
      // ignore
    }
  };

  const remainingMagicCooldownMs = () => Math.max(0, readMagicCooldownUntil() - Date.now());

  const updateMagicCooldownUi = () => {
    if (!magicForm) return;
    const btn = magicForm.querySelector('button[type="submit"]');
    if (!btn) return;
    if (!btn.dataset.defaultText) btn.dataset.defaultText = btn.textContent || 'Send magic link';
    if (btn.dataset.busy === '1') return;

    const remaining = remainingMagicCooldownMs();
    if (remaining > 0) {
      btn.disabled = true;
      btn.textContent = `Wait ${Math.ceil(remaining / 1000)}s`;
      if (!magicCooldownTimer) {
        magicCooldownTimer = window.setInterval(updateMagicCooldownUi, 1000);
      }
      return;
    }

    if (magicCooldownTimer) {
      window.clearInterval(magicCooldownTimer);
      magicCooldownTimer = null;
    }
    btn.disabled = false;
    btn.textContent = btn.dataset.defaultText;
  };

  const readResetCooldownUntil = () => {
    try {
      if (!window.localStorage) return 0;
      const raw = window.localStorage.getItem(RESET_COOLDOWN_KEY);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  };

  const setResetCooldown = (ms) => {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(RESET_COOLDOWN_KEY, String(Date.now() + Math.max(0, Number(ms) || 0)));
    } catch {
      // ignore
    }
  };

  const remainingResetCooldownMs = () => Math.max(0, readResetCooldownUntil() - Date.now());

  const updateResetCooldownUi = () => {
    if (!resetPasswordForm) return;
    const btn = resetPasswordForm.querySelector('button[type="submit"]');
    if (!btn) return;
    if (!btn.dataset.defaultText) btn.dataset.defaultText = btn.textContent || 'Send reset link';
    if (btn.dataset.busy === '1') return;

    const remaining = remainingResetCooldownMs();
    if (remaining > 0) {
      btn.disabled = true;
      btn.textContent = `Wait ${Math.ceil(remaining / 1000)}s`;
      if (!resetCooldownTimer) {
        resetCooldownTimer = window.setInterval(updateResetCooldownUi, 1000);
      }
      return;
    }

    if (resetCooldownTimer) {
      window.clearInterval(resetCooldownTimer);
      resetCooldownTimer = null;
    }
    btn.disabled = false;
    btn.textContent = btn.dataset.defaultText;
  };

  const stripAuthParamsFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      ['code', 'type', 'access_token', 'refresh_token', 'expires_in', 'token_type', 'error', 'error_description'].forEach((k) => {
        url.searchParams.delete(k);
      });
      if (url.hash) {
        const hash = new URLSearchParams(String(url.hash).replace(/^#/, ''));
        ['type', 'access_token', 'refresh_token', 'expires_in', 'token_type', 'error', 'error_description'].forEach((k) => {
          hash.delete(k);
        });
        const next = hash.toString();
        url.hash = next ? `#${next}` : '';
      }
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

  async function getProfileInfo(client, userId) {
    try {
      const { data, error } = await client
        .from('profiles')
        .select('role,display_name')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) return { role: '', displayName: '', error: error.message || String(error) };
      return {
        role: (data && data.role) ? String(data.role) : '',
        displayName: (data && data.display_name) ? String(data.display_name) : '',
        error: ''
      };
    } catch {
      return { role: '', displayName: '', error: 'profiles lookup failed' };
    }
  }

  const normalizeRole = (role) => {
    const r = (role || '').toString().trim().toLowerCase();
    return r || 'client';
  };

  const setRoleBadge = (role) => {
    const r = normalizeRole(role);
    const meta = ROLE_META[r] || { label: r || 'Client', partner: false };
    if (dashRole) dashRole.textContent = meta.label.toUpperCase();
  };

  let adminWired = false;
  let lastAdminRows = [];

  const rolesForAdminUi = () => ([
    { value: 'client', label: 'Client' },
    { value: 'collaborator', label: 'Collaborator' },
    { value: 'partner', label: 'Partner' },
    { value: 'agent', label: 'Agent' },
    { value: 'agency_admin', label: 'Agency admin' },
    { value: 'developer', label: 'Developer' },
    { value: 'admin', label: 'Admin' }
  ]);

  const escapeHtml = (value) => {
    const s = value == null ? '' : String(value);
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  const isUuidLike = (text) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((text || '').trim());

  const renderAdminUsers = (rows) => {
    if (!adminUserList) return;
    lastAdminRows = Array.isArray(rows) ? rows : [];
    if (!lastAdminRows.length) {
      adminUserList.innerHTML = '';
      return;
    }

    adminUserList.innerHTML = lastAdminRows.map((r) => {
      const uid = r.user_id ? String(r.user_id) : '';
      const email = r.email ? String(r.email) : '';
      const name = r.display_name ? String(r.display_name) : '';
      const role = r.role ? String(r.role) : 'client';
      const createdAt = r.created_at ? new Date(r.created_at).toLocaleString() : '';
      const title = email || name || uid;
      const sub = `${uid}${createdAt ? ` · created ${createdAt}` : ''}${name && email ? ` · ${name}` : ''}`;
      const options = rolesForAdminUi().map((o) => `<option value="${escapeHtml(o.value)}"${o.value === role ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('');

      return `
        <div class="admin-user-row" data-user-id="${escapeHtml(uid)}">
          <div class="admin-user-main">
            <div class="admin-user-title">${escapeHtml(title)}</div>
            <div class="admin-user-sub">${escapeHtml(sub)}</div>
          </div>
          <div class="admin-user-actions">
            <select class="admin-select" data-role>
              ${options}
            </select>
            <button class="cta-button cta-button--outline" type="button" data-save>Save</button>
          </div>
        </div>
      `;
    }).join('');
  };

  const loadAdminUsers = async () => {
    if (!adminUserStatus || !adminUserList) return;
    const client = getClient();
    if (!client) return;

    const q = (adminUserQ && adminUserQ.value ? adminUserQ.value : '').trim();
    adminUserStatus.textContent = 'Loading users…';
    adminUserList.innerHTML = '';

    // Try selecting email if present; otherwise retry without it.
    const attempt = async (withEmail) => {
      const cols = withEmail ? 'user_id,role,display_name,email,created_at' : 'user_id,role,display_name,created_at';
      let query = client.from('profiles').select(cols).order('created_at', { ascending: false }).limit(60);

      if (q) {
        if (isUuidLike(q)) {
          query = query.eq('user_id', q);
        } else if (withEmail) {
          // Search by email or display name when email exists.
          const safe = q.replace(/[,]/g, ' ').trim();
          query = query.or(`email.ilike.%${safe}%,display_name.ilike.%${safe}%`);
        } else {
          const safe = q.replace(/[,]/g, ' ').trim();
          query = query.ilike('display_name', `%${safe}%`);
        }
      }

      return await query;
    };

    let out = await attempt(true);
    if (out && out.error && String(out.error.message || '').toLowerCase().includes('column') && String(out.error.message || '').toLowerCase().includes('email')) {
      out = await attempt(false);
      if (adminUserStatus) adminUserStatus.textContent = 'Note: profiles.email column not found. Update `supabase.sql` to enable email search.';
    }

    const { data, error } = out || {};
    if (error) {
      adminUserStatus.textContent = `Failed to load users: ${error.message || String(error)}. Ensure admin policies exist (run updated supabase.sql).`;
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    adminUserStatus.textContent = rows.length ? `Showing ${rows.length} users` : 'No users found.';
    renderAdminUsers(rows);
  };

  const wireAdminUi = () => {
    if (adminWired) return;
    if (!adminPanel) return;
    adminWired = true;

    if (adminUserRefresh) adminUserRefresh.addEventListener('click', loadAdminUsers);
    if (adminUserQ) {
      adminUserQ.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          loadAdminUsers();
        }
      });
    }

    if (adminUserList) {
      adminUserList.addEventListener('click', async (e) => {
        const btn = e && e.target ? e.target.closest('[data-save]') : null;
        if (!btn) return;
        const row = btn.closest('.admin-user-row');
        if (!row) return;
        const userId = row.getAttribute('data-user-id') || '';
        const select = row.querySelector('select[data-role]');
        const role = select && select.value ? select.value : '';
        if (!userId || !role) return;

        const client = getClient();
        if (!client) return;

        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
          const { error } = await withTimeout(
            client.from('profiles').update({ role }).eq('user_id', userId),
            AUTH_TIMEOUT_MS,
            'Update role'
          );
          if (error) {
            btn.textContent = 'Failed';
            if (adminUserStatus) adminUserStatus.textContent = `Role update failed: ${error.message || String(error)}`;
          } else {
            btn.textContent = 'Saved';
            if (adminUserStatus) adminUserStatus.textContent = `Updated role for ${userId}`;
            window.setTimeout(() => { btn.textContent = 'Save'; btn.disabled = false; }, 900);
            return;
          }
        } catch (error) {
          if (adminUserStatus) adminUserStatus.textContent = `Role update failed: ${(error && error.message) ? error.message : String(error)}`;
        }
        window.setTimeout(() => { btn.textContent = 'Save'; btn.disabled = false; }, 1200);
      });
    }
  };

  async function refresh({ sessionOverride } = {}) {
    const client = getClient();

    if (recoveryPanel) {
      setVisible(recoveryPanel, recoveryMode);
      if (recoveryMode) {
        setStatus('Password recovery', 'Set a new password below.');
        if (signOutBtn) signOutBtn.disabled = true;
        setVisible(dashboardPanels, false);
        setVisible(authPanels, false);
        setVisible(authStatus, true, 'block');
        try {
          if (recoveryPassword && typeof recoveryPassword.focus === 'function') recoveryPassword.focus();
        } catch {
          // ignore
        }
        return;
      }
    }

    if (!client) {
      const cfg = window.SCP_CONFIG || {};
      const url = (cfg.supabaseUrl || '').trim();
      const key = (cfg.supabaseAnonKey || '').trim();
      const status = window.scpSupabaseStatus || null;

      if (!url || !key) {
        setStatus('Supabase is not configured.', 'Fill `config.js` with your Supabase URL + anon/publishable key.');
      } else if (status && status.error) {
        setStatus('Supabase init failed', String(status.error));
      } else if (status && status.enabled === false) {
        setStatus('Supabase is not ready', 'The Supabase client did not initialise. Check the Diagnostics (?qa=1).');
      } else {
        setStatus('Connecting...', 'Initialising authentication…');
      }

      if (signOutBtn) signOutBtn.disabled = true;
      setVisible(dashboardPanels, false);
      setVisible(authPanels, true, 'grid');
      setVisible(authStatus, true, 'block');
      return;
    }

    // Ensure the recovery panel is hidden during normal signed-in/out flows.
    setVisible(recoveryPanel, false);

    let session = sessionOverride;
    if (typeof sessionOverride === 'undefined') {
      let data;
      try {
        ({ data } = await getSessionSafe(client));
      } catch (error) {
        const msg = error && error.message ? String(error.message) : String(error);
        const status = window.scpSupabaseStatus || null;
        const storage = status && status.storage ? String(status.storage) : 'unknown';
        const hint = /abort/i.test(msg)
          ? `Session check aborted (storage=${storage}). Try: Clear offline cache, then Reset login, then sign in again. If it persists, disable VPN/ad-block and open ?qa=1 for diagnostics.`
          : `${msg} (storage=${storage})`;
        setStatus('Auth session failed', hint);
        if (signOutBtn) signOutBtn.disabled = true;
        setVisible(dashboardPanels, false);
        setVisible(authPanels, true, 'grid');
        setVisible(authStatus, true, 'block');
        return;
      }
      session = data && data.session ? data.session : null;
    }
    const user = session && session.user ? session.user : null;

    if (!user) {
      setStatus('Signed out', 'Sign in to sync favourites across devices.');
      if (signOutBtn) signOutBtn.disabled = true;
      setVisible(dashboardPanels, false);
      setVisible(authPanels, true, 'grid');
      setVisible(authStatus, true, 'block');
      return;
    }

    setVisible(authPanels, false);
    setVisible(dashboardPanels, true);
    setVisible(authStatus, false);

    const profileInfo = await getProfileInfo(client, user.id);
    const role = normalizeRole(profileInfo && profileInfo.role ? profileInfo.role : 'client');
    const roleHint = !profileInfo.role && profileInfo && profileInfo.error ? ` Role unavailable: ${profileInfo.error}` : '';
    const who = (profileInfo && profileInfo.displayName) ? profileInfo.displayName : (user.email || 'user');

    setStatus(
      `Welcome, ${who}`,
      `Your saved listings will sync on the Properties page.${roleHint}`
    );
    if (signOutBtn) signOutBtn.disabled = false;

    setRoleBadge(role);
    if (dashSavedCount) dashSavedCount.textContent = String(readSavedCount());
    setVisible(dashAdminTile, role === 'admin', 'block');
    setVisible(dashCrmTile, role === 'admin', 'block');
    setVisible(dashShopTile, role === 'admin', 'block');

    const meta = ROLE_META[role] || ROLE_META.client;
    if (partnerTile) {
      const isPartner = meta && meta.partner;
      partnerTile.classList.toggle('account-tile--disabled', !isPartner);
      if (partnerK && partnerV && partnerDesc) {
        if (role === 'developer') {
          partnerK.textContent = 'Developer tools';
          partnerV.textContent = 'Developments & collaboration';
          partnerDesc.textContent = 'Share projects, control branding, and coordinate viewings.';
        } else if (role === 'agency_admin' || role === 'agent') {
          partnerK.textContent = 'Agency tools';
          partnerV.textContent = 'White-label & collaboration';
          partnerDesc.textContent = 'Share listings with your clients and keep your branding.';
        } else if (role === 'collaborator' || role === 'partner') {
          partnerK.textContent = 'Partner tools';
          partnerV.textContent = 'White-label & collaboration';
          partnerDesc.textContent = 'Brochures, links, and collaboration tools for partners.';
        } else if (role === 'admin') {
          partnerK.textContent = 'Collaboration';
          partnerV.textContent = 'White-label & partners';
          partnerDesc.textContent = 'Tools and flows used by agencies, agents and developers.';
        } else {
          partnerK.textContent = 'Partner access';
          partnerV.textContent = 'Request collaboration';
          partnerDesc.textContent = 'If you are an agency, agent or developer, ask us to enable partner tools.';
        }
      }
    }

    if (adminPanel) {
      setVisible(adminPanel, role === 'admin');
      if (role === 'admin') {
        wireAdminUi();
        // Lazy-load first time.
        if (!lastAdminRows.length) loadAdminUsers();
      }
    }
  }

  async function runDiagnostics() {
    if (!diagnosticsPanel) return;
    const url = new URL(window.location.href);
    const qa = url.searchParams.get('qa') === '1';
    if (!qa) return;

    diagnosticsPanel.style.display = 'block';
    clearDiag();

    const cfg = window.SCP_CONFIG || {};
    const supabaseJsLoaded = Boolean(window.supabase && window.supabase.createClient);
    addDiag(supabaseJsLoaded ? 'ok' : 'bad', 'supabase-js loaded', supabaseJsLoaded ? 'CDN script is available.' : 'The supabase-js CDN did not load.');

    const urlOk = Boolean((cfg.supabaseUrl || '').trim());
    const keyOk = Boolean((cfg.supabaseAnonKey || '').trim());
    addDiag(urlOk ? 'ok' : 'bad', 'config: supabaseUrl', urlOk ? cfg.supabaseUrl : 'Missing. Set it in config.js.');
    addDiag(keyOk ? 'ok' : 'bad', 'config: anon/publishable key', keyOk ? `${String(cfg.supabaseAnonKey).slice(0, 16)}…` : 'Missing. Set it in config.js.');

    const online = (typeof navigator !== 'undefined') ? navigator.onLine : null;
    addDiag(online === false ? 'warn' : 'ok', 'navigator.onLine', online === false ? 'Offline (auth requests will fail).' : 'Online');

    const client = getClient();
    addDiag(client ? 'ok' : 'bad', 'client init', client ? 'window.scpSupabase created.' : 'Supabase client not initialised (check config + CDN).');
    if (!client) return;

    try {
      const st = window.scpSupabaseStatus || {};
      const storage = st && st.storage ? String(st.storage) : 'unknown';
      const persist = st && st.persistSession === true;
      const detail = `storage=${storage} · persistSession=${persist ? 'true' : 'false'}`;
      const level = (storage && storage !== 'none') ? 'ok' : 'warn';
      const extra = storage === 'none'
        ? ' Your browser is blocking website storage, so you will be signed out when you change pages. Turn off Private mode / allow website data, then use Reset login.'
        : '';
      addDiag(level, 'Auth storage', `${detail}.${extra}`);
    } catch {
      // ignore
    }

    // Direct ping: helps identify blocked/slow networks (VPN/ad-block) without needing a login.
    try {
      if (typeof fetch === 'function' && typeof AbortController !== 'undefined' && urlOk && keyOk) {
        const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const baseUrl = String(cfg.supabaseUrl).replace(/\/+$/, '');
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 8000);
        let resp;
        try {
          resp = await fetch(`${baseUrl}/auth/v1/health`, {
            method: 'GET',
            headers: {
              apikey: cfg.supabaseAnonKey,
              Authorization: `Bearer ${cfg.supabaseAnonKey}`
            },
            signal: controller.signal
          });
        } finally {
          window.clearTimeout(timeoutId);
        }
        const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const ms = Math.round(Math.max(0, t1 - t0));
        addDiag(resp.ok ? 'ok' : 'warn', 'Supabase auth ping', resp.ok ? `OK (${ms}ms)` : `HTTP ${resp.status} (${ms}ms)`);
      } else {
        addDiag('warn', 'Supabase auth ping', 'Skipped (browser lacks fetch/AbortController).');
      }
    } catch (error) {
      addDiag('bad', 'Supabase auth ping', (error && error.message) ? error.message : String(error));
    }

    let session;
    try {
      const { data } = await getSessionSafe(client);
      session = data && data.session ? data.session : null;
      addDiag('ok', 'auth.getSession()', session ? 'Session found.' : 'No session (signed out).');
    } catch (error) {
      addDiag('bad', 'auth.getSession()', error && error.message ? error.message : String(error));
      return;
    }

    if (!session || !session.user) {
      addDiag('warn', 'DB checks', 'Sign in first to test database tables and RLS policies.');
      return;
    }

    // Check profiles table + trigger.
    try {
      const { data, error } = await client.from('profiles').select('role').eq('user_id', session.user.id).maybeSingle();
      if (error) {
        addDiag('bad', 'profiles table / RLS', `${error.message || 'Error reading profiles'}. Run supabase.sql and ensure RLS policies exist.`);
      } else if (!data) {
        addDiag('warn', 'profile row missing', 'The signup trigger may not have been created. Re-run supabase.sql.');
      } else {
        addDiag('ok', 'profiles row', `role=${data.role || ''}`);
      }
    } catch (error) {
      addDiag('bad', 'profiles query exception', error && error.message ? error.message : String(error));
    }

    // Check favourites table.
    try {
      const { error } = await client.from('favourites').select('property_id').limit(1);
      if (error) {
        addDiag('bad', 'favourites table / RLS', `${error.message || 'Error reading favourites'}. Run supabase.sql.`);
      } else {
        addDiag('ok', 'favourites table', 'Readable for current user.');
      }
    } catch (error) {
      addDiag('bad', 'favourites query exception', error && error.message ? error.message : String(error));
    }

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    addDiag('ok', 'Auth redirect URL', `Add ${redirectTo} to Supabase Auth Redirect URLs (needed for email confirm + magic links).`);
  }

  async function ensureLoaded() {
    // Prefer immediate refresh if the client is already initialised.
    if (window.scpSupabase) {
      setStatus('Connecting...', 'Loading authentication…');
      await runDiagnostics();
      // Let Supabase emit INITIAL_SESSION first (more reliable than racing getSession on some browsers).
      await sleep(900);
      if (!sawAuthEvent) {
        await refresh();
        await runDiagnostics();
      }
      return;
    }

    // Otherwise, listen for the init event (it may fire after this script runs).
    window.addEventListener('scp:supabase:ready', async () => {
      await refresh();
      await runDiagnostics();
    }, { once: true });

    // Also run once now to show a useful status even if init already failed.
    setStatus('Connecting...', 'Loading authentication…');
    await refresh();
    await runDiagnostics();
  }

  if (signInForm) {
    signInForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const client = getClient();
      if (!client) {
        setStatus('Supabase not ready', 'Reload the page. If it persists, click Clear offline cache or open ?qa=1 for diagnostics.');
        return;
      }
      const email = (signInEmail && signInEmail.value ? signInEmail.value : '').trim();
      const password = (signInPassword && signInPassword.value ? signInPassword.value : '').trim();
      if (!email || !password) return;

      setStatus('Signing in…');
      const btn = signInForm.querySelector('button[type=\"submit\"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Signing in…';
      }
      try {
        const { error } = await withTimeout(client.auth.signInWithPassword({ email, password }), AUTH_TIMEOUT_MS, 'Sign-in');
        if (error) {
          setStatus('Sign-in failed', error.message || 'Please try again.');
          return;
        }
        await refresh();
        await runDiagnostics();
      } catch (error) {
        const msg = (error && error.message) ? String(error.message) : String(error);
        const lower = msg.toLowerCase();
        if (lower.includes('timed out') || lower.includes('abort')) {
          setStatus('Sign-in failed', 'Sign-in timed out. This is usually a network/VPN/ad-block issue reaching Supabase. Try “Reset login”, or switch network, then try again (open ?qa=1 for diagnostics).');
        } else {
          setStatus('Sign-in failed', msg);
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev || 'Sign in';
        }
      }
    });
  }

  if (signUpForm) {
    signUpForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const client = getClient();
      if (!client) {
        setStatus('Supabase not ready', 'Reload the page. If it persists, click Clear offline cache or open ?qa=1 for diagnostics.');
        return;
      }
      const email = (signUpEmail && signUpEmail.value ? signUpEmail.value : '').trim();
      const password = (signUpPassword && signUpPassword.value ? signUpPassword.value : '').trim();
      if (!email || !password) return;

      setStatus('Creating account…');
      const btn = signUpForm.querySelector('button[type=\"submit\"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Creating…';
      }
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      try {
        const { error } = await withTimeout(client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo }
        }), AUTH_TIMEOUT_MS, 'Sign-up');
        if (error) {
          setStatus('Sign-up failed', error.message || 'Please try again.');
          return;
        }
        setStatus('Check your email', 'Confirm your email address to finish creating your account.');
        await refresh();
        await runDiagnostics();
      } catch (error) {
        setStatus('Sign-up failed', (error && error.message) ? error.message : String(error));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev || 'Create account';
        }
      }
    });
  }

  if (magicForm) {
    magicForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const client = getClient();
      if (!client) {
        setStatus('Supabase not ready', 'Reload the page. If it persists, click Clear offline cache or open ?qa=1 for diagnostics.');
        return;
      }
      const email = (magicEmail && magicEmail.value ? magicEmail.value : '').trim();
      if (!email) return;

      const remaining = remainingMagicCooldownMs();
      if (remaining > 0) {
        setStatus('Please wait', `Magic links are rate-limited. Try again in ${Math.ceil(remaining / 1000)}s.`);
        updateMagicCooldownUi();
        return;
      }

      setStatus('Sending magic link…');
      const btn = magicForm.querySelector('button[type=\"submit\"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending…';
        btn.dataset.busy = '1';
      }
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      try {
        const { error } = await withTimeout(client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo }
        }), AUTH_TIMEOUT_MS, 'Magic link');
        if (error) {
          const msg = error && error.message ? String(error.message) : 'Please try again.';
          if (msg.toLowerCase().includes('rate limit')) {
            setMagicCooldown(MAGIC_RATE_LIMIT_COOLDOWN_MS);
            setStatus('Failed to send link', 'Email rate limit exceeded. Wait a few minutes and try again. (To remove strict limits and improve deliverability, set a custom SMTP provider in Supabase Auth settings.)');
          } else {
            setStatus('Failed to send link', msg);
          }
          return;
        }
        setMagicCooldown(MAGIC_COOLDOWN_MS);
        setStatus('Link sent', 'Check your inbox and click the sign-in link. If it does not log you in, add this page to Supabase Auth Redirect URLs.');
      } catch (error) {
        const msg = (error && error.message) ? String(error.message) : String(error);
        const lower = msg.toLowerCase();
        if (lower.includes('timed out') || lower.includes('abort')) {
          setStatus('Failed to send link', 'Magic link timed out. This is usually a network/VPN/ad-block issue reaching Supabase. Try “Reset login”, or switch network, then try again.');
        } else {
          setStatus('Failed to send link', msg);
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev || 'Send magic link';
          delete btn.dataset.busy;
        }
        updateMagicCooldownUi();
      }
    });
  }

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const client = getClient();
      if (!client) {
        setStatus('Supabase not ready', 'Reload the page. If it persists, click Clear offline cache or open ?qa=1 for diagnostics.');
        return;
      }

      // Help users by reusing the sign-in email when possible.
      if (resetPasswordEmail && !resetPasswordEmail.value && signInEmail && signInEmail.value) {
        resetPasswordEmail.value = signInEmail.value;
      }

      const email = (resetPasswordEmail && resetPasswordEmail.value ? resetPasswordEmail.value : '').trim();
      if (!email) return;

      const remaining = remainingResetCooldownMs();
      if (remaining > 0) {
        setStatus('Please wait', `Password reset emails are rate-limited. Try again in ${Math.ceil(remaining / 1000)}s.`);
        updateResetCooldownUi();
        return;
      }

      setStatus('Sending reset link…');
      const btn = resetPasswordForm.querySelector('button[type="submit"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending…';
        btn.dataset.busy = '1';
      }
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      try {
        const { error } = await withTimeout(
          client.auth.resetPasswordForEmail(email, { redirectTo }),
          AUTH_TIMEOUT_MS,
          'Password reset'
        );
        if (error) {
          const msg = error && error.message ? String(error.message) : 'Please try again.';
          if (msg.toLowerCase().includes('rate limit')) {
            setResetCooldown(RESET_RATE_LIMIT_COOLDOWN_MS);
            setStatus('Failed to send reset link', 'Email rate limit exceeded. Wait a few minutes and try again. (To remove strict limits and improve deliverability, set a custom SMTP provider in Supabase Auth settings.)');
          } else {
            setStatus('Failed to send reset link', msg);
          }
          return;
        }
        setResetCooldown(RESET_COOLDOWN_MS);
        setStatus('Reset link sent', 'Check your inbox and click the link to set a new password.');
      } catch (error) {
        const msg = (error && error.message) ? String(error.message) : String(error);
        const lower = msg.toLowerCase();
        if (lower.includes('timed out') || lower.includes('abort')) {
          setStatus('Failed to send reset link', 'Password reset timed out. This is usually a network/VPN/ad-block issue reaching Supabase. Try “Reset login”, or switch network, then try again.');
        } else {
          setStatus('Failed to send reset link', msg);
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev || 'Send reset link';
          delete btn.dataset.busy;
        }
        updateResetCooldownUi();
      }
    });
  }

  if (recoveryCancel) {
    recoveryCancel.addEventListener('click', async () => {
      recoveryMode = false;
      try {
        if (recoveryPassword) recoveryPassword.value = '';
        if (recoveryPassword2) recoveryPassword2.value = '';
      } catch {
        // ignore
      }
      stripAuthParamsFromUrl();
      await refresh();
    });
  }

  if (recoveryForm) {
    recoveryForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const client = getClient();
      if (!client) {
        setStatus('Supabase not ready', 'Reload the page and try again.');
        return;
      }
      const p1 = (recoveryPassword && recoveryPassword.value ? recoveryPassword.value : '').trim();
      const p2 = (recoveryPassword2 && recoveryPassword2.value ? recoveryPassword2.value : '').trim();
      if (!p1 || !p2) return;
      if (p1.length < 8) {
        setStatus('Password update failed', 'Password must be at least 8 characters.');
        return;
      }
      if (p1 !== p2) {
        setStatus('Password update failed', 'Passwords do not match.');
        return;
      }

      setStatus('Updating password…');
      const btn = recoveryForm.querySelector('button[type="submit"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Updating…';
      }
      try {
        const { error } = await withTimeout(
          client.auth.updateUser({ password: p1 }),
          AUTH_TIMEOUT_MS,
          'Update password'
        );
        if (error) {
          setStatus('Password update failed', error.message || 'Please try again.');
          return;
        }
        recoveryMode = false;
        stripAuthParamsFromUrl();
        try {
          if (recoveryPassword) recoveryPassword.value = '';
          if (recoveryPassword2) recoveryPassword2.value = '';
        } catch {
          // ignore
        }
        setStatus('Password updated', 'You can now sign in with your new password on any device.');
        await refresh();
        await runDiagnostics();
      } catch (error) {
        setStatus('Password update failed', (error && error.message) ? error.message : String(error));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev || 'Update password';
        }
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      const client = getClient();
      if (!client) return;
      setStatus('Signing out…');
      await client.auth.signOut();
      await refresh();
    });
  }

  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', clearOfflineCacheAndReload);
  }

  if (clearCacheAuthBtn) {
    clearCacheAuthBtn.addEventListener('click', clearOfflineCacheAndReload);
  }

  if (resetAuthBtn) {
    resetAuthBtn.addEventListener('click', resetAuthStorageAndReload);
  }

  const client = getClient();
  if (client) {
    client.auth.onAuthStateChange(async (event, session) => {
      sawAuthEvent = true;
      if (event === 'PASSWORD_RECOVERY') {
        recoveryMode = true;
        stripAuthParamsFromUrl();
        await refresh({ sessionOverride: session || null });
        await runDiagnostics();
        return;
      }
      if (event === 'SIGNED_IN') {
        stripAuthParamsFromUrl();
      }
      await refresh({ sessionOverride: session || null });
      await runDiagnostics(); // keep ?qa=1 panel in sync after signing in/out
    });
  } else {
    window.addEventListener('scp:supabase:ready', () => {
      const c = getClient();
      if (c) c.auth.onAuthStateChange(async (event, session) => {
        sawAuthEvent = true;
        if (event === 'PASSWORD_RECOVERY') {
          recoveryMode = true;
          stripAuthParamsFromUrl();
          await refresh({ sessionOverride: session || null });
          await runDiagnostics();
          return;
        }
        if (event === 'SIGNED_IN') {
          stripAuthParamsFromUrl();
        }
        await refresh({ sessionOverride: session || null });
        await runDiagnostics();
      });
    }, { once: true });
  }

  // Some Supabase flows set type=recovery in the URL/hash; ensure the UI shows the recovery form.
  try {
    const url = new URL(window.location.href);
    const typeFromSearch = (url.searchParams.get('type') || '').toLowerCase();
    const typeFromHash = (() => {
      const raw = String(url.hash || '').replace(/^#/, '');
      if (!raw) return '';
      try {
        return (new URLSearchParams(raw).get('type') || '').toLowerCase();
      } catch {
        return '';
      }
    })();
    if (typeFromSearch === 'recovery' || typeFromHash === 'recovery') {
      recoveryMode = true;
    }
  } catch {
    // ignore
  }

  ensureLoaded();
  updateMagicCooldownUi();
  updateResetCooldownUi();
})();
