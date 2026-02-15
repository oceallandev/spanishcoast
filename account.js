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
  const dashVehiclesTile = document.getElementById('dash-vehicles-tile');
  const dashPropertiesTile = document.getElementById('dash-properties-tile');
  const dashCrmTile = document.getElementById('dash-crm-tile');
  const dashShopTile = document.getElementById('dash-shop-tile');
  const dashRefMapTile = document.getElementById('dash-refmap-tile');
  const partnerTile = document.getElementById('dash-partner-tile');
  const partnerK = document.getElementById('dash-partner-k');
  const partnerV = document.getElementById('dash-partner-v');
  const partnerDesc = document.getElementById('dash-partner-desc');
  const adminPanel = document.getElementById('admin-panel');
  const accountWorkspace = document.getElementById('account-workspace');
  const profileAvatar = document.getElementById('profile-avatar');
  const profileName = document.getElementById('profile-name');
  const profileEmail = document.getElementById('profile-email');
  const profileBadges = document.getElementById('profile-badges');
  const profileNote = document.getElementById('profile-note');
  const roleHubTitle = document.getElementById('role-hub-title');
  const roleHubActions = document.getElementById('role-hub-actions');
  const roleHubBody = document.getElementById('role-hub-body');
  const quicksharePanel = document.getElementById('quickshare-panel');
  const quickshareWl = document.getElementById('quickshare-wl');
  const quickshareRef = document.getElementById('quickshare-ref');
  const quickshareOpen = document.getElementById('quickshare-open');
  const quickshareBrochure = document.getElementById('quickshare-brochure');
  const quickshareReel = document.getElementById('quickshare-reel');
  const quickshareCopyLink = document.getElementById('quickshare-copy-link');
  const quickshareCopyBrochure = document.getElementById('quickshare-copy-brochure');
  const quickshareCopyReel = document.getElementById('quickshare-copy-reel');
  const quickshareHint = document.getElementById('quickshare-hint');
  const activityRefresh = document.getElementById('activity-refresh');
  const activityGrid = document.getElementById('activity-grid');
  const alertsPanel = document.getElementById('alerts-panel');
  const alertsRefreshBtn = document.getElementById('alerts-refresh');
  const alertsMarkSeenBtn = document.getElementById('alerts-mark-seen');
  const alertsSummary = document.getElementById('alerts-summary');
  const alertsStatus = document.getElementById('alerts-status');
  const alertsList = document.getElementById('alerts-list');
  const shopRefresh = document.getElementById('shop-refresh');
  const shopBasketList = document.getElementById('shop-basket-list');
  const shopBasketHint = document.getElementById('shop-basket-hint');
  const shopCheckoutBtn = document.getElementById('shop-checkout');
  const shopClearBasketBtn = document.getElementById('shop-clear-basket');
  const shopCheckoutStatus = document.getElementById('shop-checkout-status');
  const shopHistoryList = document.getElementById('shop-history-list');
  const shopDocsModal = document.getElementById('shop-docs-modal');
  const shopDocsModalClose = document.getElementById('shop-docs-modal-close');
  const shopDocsModalBody = document.getElementById('shop-docs-modal-body');
  const adminUserQ = document.getElementById('admin-user-q');
  const adminUserRefresh = document.getElementById('admin-user-refresh');
  const adminUserStatus = document.getElementById('admin-user-status');
  const adminUserList = document.getElementById('admin-user-list');
  const adminNetworkQ = document.getElementById('admin-network-q');
  const adminNetworkRefresh = document.getElementById('admin-network-refresh');
  const adminNetworkStatus = document.getElementById('admin-network-status');
  const adminNetworkList = document.getElementById('admin-network-list');
  const adminNewsletterForm = document.getElementById('admin-newsletter-form');
  const adminNewsletterAudience = document.getElementById('admin-newsletter-audience');
  const adminNewsletterRoleRow = document.getElementById('admin-newsletter-role-row');
  const adminNewsletterRole = document.getElementById('admin-newsletter-role');
  const adminNewsletterEmailsRow = document.getElementById('admin-newsletter-emails-row');
  const adminNewsletterEmails = document.getElementById('admin-newsletter-emails');
  const adminNewsletterSubject = document.getElementById('admin-newsletter-subject');
  const adminNewsletterBody = document.getElementById('admin-newsletter-body');
  const adminNewsletterTest = document.getElementById('admin-newsletter-test');
  const adminNewsletterStatus = document.getElementById('admin-newsletter-status');
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
  const getBasket = () => window.SCP_BASKET || null;
  const formatTemplate = (value, vars) => {
    const text = value == null ? '' : String(value);
    if (!vars || typeof vars !== 'object') return text;
    return text.replace(/\{(\w+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
    ));
  };

  const t = (key, fallback, vars) => {
    const k = String(key || '');
    try {
      if (window.SCP_I18N && typeof window.SCP_I18N.t === 'function') {
        const translated = window.SCP_I18N.t(k, vars);
        if (translated != null) {
          const out = String(translated);
          if (out && out !== k) return out;
        }
      }
    } catch {
      // ignore
    }
    if (fallback !== undefined) return formatTemplate(fallback, vars);
    return k;
  };

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
    admin: { partner: true },
    partner: { partner: true },
    agency_admin: { partner: true },
    agent: { partner: true },
    developer: { partner: true },
    collaborator: { partner: true },
    client: { partner: false }
  };

  const QUICKSHARE_REF_KEY = 'scp:quickshare:ref';
  const QUICKSHARE_WL_KEY = 'scp:quickshare:wl';

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

  const tryReadSessionFromStorage = () => {
    try {
      const cfg = window.SCP_CONFIG || {};
      const url = (cfg.supabaseUrl || '').trim();
      if (!url) return null;
      const host = new URL(url).hostname || '';
      const ref = host.split('.')[0] || '';
      if (!ref) return null;
      const key = `sb-${ref}-auth-token`;

      const readKey = (storage) => {
        if (!storage) return null;
        try {
          const raw = storage.getItem(key);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== 'object') return null;
          // Supabase versions can wrap the session; handle common shapes.
          const session = parsed.currentSession || parsed.session || parsed;
          if (!session || typeof session !== 'object') return null;
          if (session.user && session.access_token) return session;
          return null;
        } catch {
          return null;
        }
      };

      return readKey(window.localStorage) || readKey(window.sessionStorage);
    } catch {
      return null;
    }
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

  // If a browser/VPN/ad-block causes AbortError during auth init, don't lock the user out.
  // We'll retry a few times and keep the UI usable.
  let sessionAbortRetries = 0;
  let sessionAbortTimer = null;

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
    setStatus(
      t('account.status.clearing_cache_title', 'Clearing offline cache…'),
      t('account.status.clearing_cache_hint', 'This will refresh the page.')
    );
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
    setStatus(
      t('account.status.resetting_login_title', 'Resetting login…'),
      t('account.status.resetting_login_hint', 'Clearing saved session data and offline cache.')
    );
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
    if (!btn.dataset.defaultText) btn.dataset.defaultText = btn.textContent || t('account.magic.button', 'Send magic link');
    if (btn.dataset.busy === '1') return;

    const remaining = remainingMagicCooldownMs();
    if (remaining > 0) {
      btn.disabled = true;
      btn.textContent = t('account.status.wait_seconds', 'Wait {seconds}s', { seconds: Math.ceil(remaining / 1000) });
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
    if (!btn.dataset.defaultText) btn.dataset.defaultText = btn.textContent || t('account.reset.button', 'Send reset link');
    if (btn.dataset.busy === '1') return;

    const remaining = remainingResetCooldownMs();
    if (remaining > 0) {
      btn.disabled = true;
      btn.textContent = t('account.status.wait_seconds', 'Wait {seconds}s', { seconds: Math.ceil(remaining / 1000) });
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
      return { role: '', displayName: '', error: t('account.error.profiles_lookup_failed', 'Profiles lookup failed') };
    }
  }

  const normalizeRole = (role) => {
    const r = (role || '').toString().trim().toLowerCase();
    return r || 'client';
  };

  const roleLabel = (role) => {
    const r = normalizeRole(role);
    if (r === 'admin') return t('role.admin', 'Admin');
    if (r === 'partner') return t('role.partner', 'Partner');
    if (r === 'agency_admin') return t('role.agency_admin', 'Agency admin');
    if (r === 'agent') return t('role.agent', 'Agent');
    if (r === 'developer') return t('role.developer', 'Developer');
    if (r === 'collaborator') return t('role.collaborator', 'Collaborator');
    return t('role.client', 'Client');
  };

  const setRoleBadge = (role) => {
    const r = normalizeRole(role);
    const meta = ROLE_META[r] || { partner: false };
    const label = roleLabel(r || 'client');
    if (dashRole) dashRole.textContent = String(label || '').toUpperCase();
  };

  const initialsFor = (displayName, email) => {
    const name = String(displayName || '').trim();
    const fallback = String(email || '').trim().split('@')[0] || '';
    const src = name || fallback || 'SCP';
    const parts = src
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .split(/\s+/g)
      .filter(Boolean);
    const a = (parts[0] || '').slice(0, 1);
    const b = parts.length > 1 ? (parts[1] || '').slice(0, 1) : (parts[0] || '').slice(1, 2);
    const out = `${a}${b}`.toUpperCase();
    return out && out.trim() ? out : 'SC';
  };

  const normalizeRef = (value) => String(value || '').trim().toUpperCase();

  const isLoopbackHost = (hostname) => {
    const host = String(hostname || '').trim().toLowerCase();
    if (!host) return false;
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
    return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  };

  const ensureTrailingSlash = (value) => {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.endsWith('/') ? text : `${text}/`;
  };

  const configuredSiteBase = () => {
    try {
      const raw = String((window.SCP_CONFIG && window.SCP_CONFIG.siteUrl) || '').trim();
      if (!raw) return '';
      const parsed = new URL(raw, window.location.href);
      const path = parsed.pathname || '/';
      const basePath = /\/[^/]+\.[a-z0-9]+$/i.test(path)
        ? path.replace(/\/[^/]+\.[a-z0-9]+$/i, '/')
        : ensureTrailingSlash(path);
      return `${parsed.origin}${basePath}`;
    } catch {
      return '';
    }
  };

  const canonicalSiteBase = () => {
    try {
      const canonical = document.querySelector('link[rel="canonical"][href]');
      if (!canonical) return '';
      const href = String(canonical.getAttribute('href') || '').trim();
      if (!href) return '';
      const parsed = new URL(href, window.location.href);
      const path = parsed.pathname || '/';
      const basePath = /\/[^/]+\.[a-z0-9]+$/i.test(path)
        ? path.replace(/\/[^/]+\.[a-z0-9]+$/i, '/')
        : ensureTrailingSlash(path);
      return `${parsed.origin}${basePath}`;
    } catch {
      return '';
    }
  };

  const publicSiteBase = (() => {
    const configured = configuredSiteBase();
    if (configured) return configured;
    try {
      const isLoopback = window.location.protocol === 'file:' || isLoopbackHost(window.location.hostname);
      if (!isLoopback) return '';
    } catch {
      return '';
    }
    return canonicalSiteBase();
  })();

  const buildAbsUrl = (path, params = {}) => {
    const cleanPath = String(path || '').replace(/^\.?\//, '');
    const base = publicSiteBase || window.location.href;
    const url = new URL(cleanPath, base);
    Object.entries(params || {}).forEach(([k, v]) => {
      const val = v == null ? '' : String(v);
      if (!val) url.searchParams.delete(k);
      else url.searchParams.set(k, val);
    });
    return url.toString();
  };

  const setCtaDisabled = (el, yes) => {
    if (!el) return;
    el.classList.toggle('cta-button--disabled', !!yes);
    if (yes) el.setAttribute('aria-disabled', 'true');
    else el.removeAttribute('aria-disabled');
    if (el.tagName === 'BUTTON') {
      el.disabled = !!yes;
    }
  };

  const copyText = async (text) => {
    const value = String(text || '').trim();
    if (!value) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // ignore
    }
    try {
      window.prompt(t('account.copy_prompt', 'Copy:'), value);
      return true;
    } catch {
      return false;
    }
  };

  const readQuickshareWl = () => {
    try {
      if (!window.localStorage) return false;
      return window.localStorage.getItem(QUICKSHARE_WL_KEY) === '1';
    } catch {
      return false;
    }
  };

  const writeQuickshareWl = (next) => {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(QUICKSHARE_WL_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  };

  const readQuickshareRef = () => {
    try {
      if (!window.localStorage) return '';
      return normalizeRef(window.localStorage.getItem(QUICKSHARE_REF_KEY) || '');
    } catch {
      return '';
    }
  };

  const writeQuickshareRef = (ref) => {
    try {
      if (!window.localStorage) return;
      const val = normalizeRef(ref);
      if (!val) window.localStorage.removeItem(QUICKSHARE_REF_KEY);
      else window.localStorage.setItem(QUICKSHARE_REF_KEY, val);
    } catch {
      // ignore
    }
  };

  let quickshareWired = false;
  let activityWired = false;
  let alertsWired = false;
  let shopWired = false;
  let dashboardUser = null;
  let dashboardRole = 'client';

  let adminWired = false;
  let lastAdminRows = [];

  const rolesForAdminUi = () => ([
    { value: 'client', label: roleLabel('client') },
    { value: 'collaborator', label: roleLabel('collaborator') },
    { value: 'partner', label: roleLabel('partner') },
    { value: 'agent', label: roleLabel('agent') },
    { value: 'agency_admin', label: roleLabel('agency_admin') },
    { value: 'developer', label: roleLabel('developer') },
    { value: 'admin', label: roleLabel('admin') }
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
      const sub = `${uid}${createdAt ? ` · ${t('account.admin.created_prefix', 'created')} ${createdAt}` : ''}${name && email ? ` · ${name}` : ''}`;
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
            <button class="cta-button cta-button--outline" type="button" data-save>${escapeHtml(t('account.admin.save', 'Save'))}</button>
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
    adminUserStatus.textContent = t('account.admin.loading_users', 'Loading users…');
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
      if (adminUserStatus) adminUserStatus.textContent = t(
        'account.admin.email_column_missing',
        'Note: profiles.email column not found. Update `supabase.sql` to enable email search.'
      );
    }

    const { data, error } = out || {};
    if (error) {
      adminUserStatus.textContent = t(
        'account.admin.load_failed',
        'Failed to load users: {error}. Ensure admin policies exist (run updated supabase.sql).',
        { error: error.message || String(error) }
      );
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    adminUserStatus.textContent = rows.length
      ? t('account.admin.showing_users', 'Showing {count} users', { count: rows.length })
      : t('account.admin.no_users', 'No users found.');
    renderAdminUsers(rows);
  };

  let lastNetworkItems = [];
  let lastNetworkStates = {};

  const normalizeText = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const networkKindLabel = (kind) => {
    const k = String(kind || '').trim().toLowerCase();
    if (k === 'agency') return t('network.kind.agency', 'Agency');
    if (k === 'agent') return t('network.kind.agent', 'Agent');
    if (k === 'developer') return t('network.kind.developer', 'Developer');
    if (k === 'development') return t('network.kind.development', 'Development');
    if (k === 'collaborator') return t('network.kind.collaborator', 'Collaborator');
    return t('common.na', 'N/A');
  };

  const flattenNetworkData = () => {
    const d = window.scpNetworkData || null;
    if (!d || typeof d !== 'object') return [];
    const out = [];
    const push = (kind, list) => {
      (Array.isArray(list) ? list : []).forEach((x) => {
        if (!x) return;
        out.push({ kind, ...x });
      });
    };
    push('agency', d.agencies);
    push('agent', d.agents);
    push('developer', d.developers);
    push('development', d.developments);
    push('collaborator', d.collaborators);
    return out;
  };

  const networkKey = (kind, slug) => `${String(kind || '').trim().toLowerCase()}:${String(slug || '').trim()}`;

  const loadNetworkStates = async () => {
    const client = getClient();
    if (!client) return;
    const { data, error } = await withTimeout(
      client.from('network_profile_state').select('kind,slug,suspended,reason,updated_at,updated_by').limit(5000),
      AUTH_TIMEOUT_MS,
      'Load network states'
    );
    if (error) throw error;
    const map = {};
    (Array.isArray(data) ? data : []).forEach((r) => {
      const k = networkKey(r.kind, r.slug);
      if (!k || k === ':') return;
      map[k] = r;
    });
    lastNetworkStates = map;
  };

  const renderNetworkAdminList = () => {
    if (!adminNetworkList || !adminNetworkStatus) return;
    if (!lastNetworkItems.length) {
      adminNetworkList.innerHTML = '';
      adminNetworkStatus.textContent = t('account.admin.network.empty', 'No network profiles found (load network-data.js first).');
      return;
    }

    const q = normalizeText(adminNetworkQ && adminNetworkQ.value ? adminNetworkQ.value : '');
    const matches = lastNetworkItems.filter((it) => {
      if (!it) return false;
      if (!q) return true;
      const bag = [
        it.kind,
        networkKindLabel(it.kind),
        it.name,
        it.slug,
        it.id,
        it.headline,
        it.location && typeof it.location === 'object' ? `${it.location.town || ''} ${it.location.province || ''}` : ''
      ].map(normalizeText).filter(Boolean).join(' | ');
      return bag.includes(q);
    });

    adminNetworkStatus.textContent = matches.length
      ? t('account.admin.network.showing', 'Showing {count} profiles', { count: matches.length })
      : t('account.admin.network.no_match', 'No profiles match your search.');

    adminNetworkList.innerHTML = matches.slice(0, 200).map((it) => {
      const kind = String(it.kind || '').trim().toLowerCase();
      const slug = String(it.slug || it.id || '').trim();
      const key = networkKey(kind, slug);
      const st = lastNetworkStates[key] || null;
      const suspended = !!(st && st.suspended);
      const reason = suspended && st && st.reason ? String(st.reason) : '';
      const name = it.name ? String(it.name) : slug;
      const loc = it.location && typeof it.location === 'object'
        ? [it.location.town, it.location.province].map((x) => String(x || '').trim()).filter(Boolean).join(', ')
        : '';
      const badge = suspended ? `<span class="network-pill network-pill--danger">${escapeHtml(t('network.suspended', 'Suspended'))}</span>` : '';
      const sub = `${networkKindLabel(kind)} · ${slug}${loc ? ` · ${loc}` : ''}`;
      const href = `network-profile.html?type=${encodeURIComponent(kind)}&slug=${encodeURIComponent(slug)}`;

      return `
        <div class="admin-user-row" data-net-row data-kind="${escapeHtml(kind)}" data-slug="${escapeHtml(slug)}">
          <div class="admin-user-main">
            <div class="admin-user-title">${escapeHtml(name)} ${badge}</div>
            <div class="admin-user-sub">${escapeHtml(sub)}</div>
          </div>
          <div class="admin-user-actions">
            <label class="account-toggle">
              <input type="checkbox" data-net-suspended${suspended ? ' checked' : ''}>
              <span>${escapeHtml(t('network.suspended', 'Suspended'))}</span>
            </label>
            <input class="admin-input admin-input--compact" type="text" data-net-reason value="${escapeHtml(reason)}"
              placeholder="${escapeHtml(t('account.admin.network.reason_placeholder', 'Reason (optional)'))}">
            <a class="cta-button cta-button--outline" href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(t('account.admin.network.view', 'View'))}</a>
            <button class="cta-button cta-button--outline" type="button" data-net-save>${escapeHtml(t('account.admin.save', 'Save'))}</button>
          </div>
        </div>
      `;
    }).join('');
  };

  const loadNetworkAdmin = async () => {
    if (!adminNetworkStatus) return;
    lastNetworkItems = flattenNetworkData();
    if (!lastNetworkItems.length) {
      adminNetworkStatus.textContent = t('account.admin.network.missing_data', 'Network data not loaded yet.');
      if (adminNetworkList) adminNetworkList.innerHTML = '';
      return;
    }

    adminNetworkStatus.textContent = t('account.admin.network.loading', 'Loading network profile states…');
    if (adminNetworkList) adminNetworkList.innerHTML = '';
    try {
      await loadNetworkStates();
      renderNetworkAdminList();
    } catch (error) {
      const msg = error && error.message ? String(error.message) : String(error || '');
      adminNetworkStatus.textContent = t('account.admin.network.load_failed', 'Failed to load network states: {error}', { error: msg });
      lastNetworkStates = {};
      renderNetworkAdminList();
    }
  };

  const saveNetworkState = async (kind, slug, suspended, reason, btn) => {
    const client = getClient();
    if (!client) return;
    if (!kind || !slug) return;
    if (!dashboardUser || !dashboardUser.id) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = t('account.admin.saving', 'Saving…');
    }
    if (adminNetworkStatus) adminNetworkStatus.textContent = t('account.admin.network.saving', 'Saving network state…');

    try {
      const payload = {
        kind,
        slug,
        suspended: !!suspended,
        reason: suspended ? (String(reason || '').trim() || null) : null,
        updated_by: dashboardUser.id
      };
      const { error } = await withTimeout(
        client.from('network_profile_state').upsert(payload, { onConflict: 'kind,slug' }),
        AUTH_TIMEOUT_MS,
        'Save network state'
      );
      if (error) throw error;

      // Update local cache so UI reflects instantly.
      lastNetworkStates[networkKey(kind, slug)] = { ...payload };
      if (adminNetworkStatus) {
        adminNetworkStatus.textContent = t('account.admin.network.saved', 'Saved network state for {slug}', { slug });
      }
      renderNetworkAdminList();
      if (btn) btn.textContent = t('account.admin.saved_short', 'Saved');
    } catch (error) {
      const msg = error && error.message ? String(error.message) : String(error || '');
      if (adminNetworkStatus) {
        adminNetworkStatus.textContent = t('account.admin.network.save_failed', 'Save failed: {error}', { error: msg });
      }
      if (btn) btn.textContent = t('account.admin.failed_short', 'Failed');
    } finally {
      if (btn) {
        window.setTimeout(() => {
          btn.textContent = t('account.admin.save', 'Save');
          btn.disabled = false;
        }, 1000);
      }
    }
  };

  let newsletterWired = false;
  const wireNewsletterUi = () => {
    if (newsletterWired) return;
    if (!adminNewsletterForm || !adminNewsletterAudience || !adminNewsletterStatus) return;
    newsletterWired = true;

    // Populate role options using localized labels.
    if (adminNewsletterRole) {
      adminNewsletterRole.innerHTML = rolesForAdminUi()
        .map((r) => `<option value="${escapeHtml(r.value)}">${escapeHtml(r.label)}</option>`)
        .join('');
      adminNewsletterRole.value = 'client';
    }

    const syncAudience = () => {
      const mode = String(adminNewsletterAudience.value || 'all');
      setVisible(adminNewsletterRoleRow, mode === 'role', '');
      setVisible(adminNewsletterEmailsRow, mode === 'emails', '');
    };

    adminNewsletterAudience.addEventListener('change', syncAudience);
    syncAudience();

    const parseEmails = (raw) => {
      const text = String(raw || '');
      const parts = text.split(/[\s,;]+/g).map((x) => x.trim()).filter(Boolean);
      const uniq = new Set();
      parts.forEach((p) => {
        const lower = p.toLowerCase();
        if (!lower.includes('@')) return;
        uniq.add(lower);
      });
      return Array.from(uniq);
    };

    const send = async (mode, opts) => {
      const client = getClient();
      if (!client) return;

      const subject = adminNewsletterSubject ? String(adminNewsletterSubject.value || '').trim() : '';
      const body = adminNewsletterBody ? String(adminNewsletterBody.value || '').trim() : '';
      if (!subject || !body) {
        adminNewsletterStatus.textContent = t('account.admin.newsletter.missing_fields', 'Subject and message are required.');
        return;
      }

      adminNewsletterStatus.textContent = t('account.admin.newsletter.sending', 'Sending…');
      const payload = {
        audience: { type: mode },
        subject,
        body,
        language: (window.SCP_I18N && window.SCP_I18N.lang) ? String(window.SCP_I18N.lang) : 'en',
        ...(opts || {})
      };

      try {
        const out = await withTimeout(
          client.functions.invoke('send-newsletter', { body: payload }),
          AUTH_TIMEOUT_MS,
          'Send newsletter'
        );
        if (out && out.error) throw out.error;
        const res = out && out.data ? out.data : null;
        const sent = res && typeof res.sent === 'number' ? res.sent : null;
        const failed = res && typeof res.failed === 'number' ? res.failed : null;
        adminNewsletterStatus.textContent = t(
          'account.admin.newsletter.sent',
          'Sent. Success: {sent} · Failed: {failed}',
          { sent: sent == null ? '?' : sent, failed: failed == null ? '?' : failed }
        );
      } catch (error) {
        const msg = error && error.message ? String(error.message) : String(error || '');
        const hint = msg.toLowerCase().includes('404') || msg.toLowerCase().includes('not found')
          ? t('account.admin.newsletter.not_deployed', 'Newsletter backend not deployed yet. Deploy the Supabase Edge Function `send-newsletter`.')
          : '';
        adminNewsletterStatus.textContent = [t('account.admin.newsletter.failed', 'Send failed: {error}', { error: msg }), hint].filter(Boolean).join(' ');
      }
    };

    if (adminNewsletterTest) {
      adminNewsletterTest.addEventListener('click', async () => {
        if (!dashboardUser || !dashboardUser.email) {
          adminNewsletterStatus.textContent = t('account.admin.newsletter.no_user', 'Sign in first.');
          return;
        }
        await send('emails', { audience: { type: 'emails', emails: [String(dashboardUser.email)] } });
      });
    }

    adminNewsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const mode = String(adminNewsletterAudience.value || 'all');
      if (mode === 'role') {
        const role = adminNewsletterRole ? String(adminNewsletterRole.value || '').trim() : '';
        if (!role) {
          adminNewsletterStatus.textContent = t('account.admin.newsletter.pick_role', 'Pick a role.');
          return;
        }
        await send('role', { audience: { type: 'role', role } });
        return;
      }
      if (mode === 'emails') {
        const emails = parseEmails(adminNewsletterEmails ? adminNewsletterEmails.value : '');
        if (!emails.length) {
          adminNewsletterStatus.textContent = t('account.admin.newsletter.pick_emails', 'Add at least one email.');
          return;
        }
        await send('emails', { audience: { type: 'emails', emails } });
        return;
      }
      await send('all', { audience: { type: 'all' } });
    });
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
        btn.textContent = t('account.admin.saving', 'Saving…');
        try {
          const { error } = await withTimeout(
            client.from('profiles').update({ role }).eq('user_id', userId),
            AUTH_TIMEOUT_MS,
            'Update role'
          );
          if (error) {
            btn.textContent = t('account.admin.failed_short', 'Failed');
            if (adminUserStatus) {
              adminUserStatus.textContent = t('account.admin.role_update_failed', 'Role update failed: {error}', {
                error: error.message || String(error)
              });
            }
          } else {
            btn.textContent = t('account.admin.saved_short', 'Saved');
            if (adminUserStatus) {
              adminUserStatus.textContent = t('account.admin.role_updated', 'Updated role for {userId}', { userId });
            }
            window.setTimeout(() => { btn.textContent = t('account.admin.save', 'Save'); btn.disabled = false; }, 900);
            return;
          }
        } catch (error) {
          if (adminUserStatus) {
            adminUserStatus.textContent = t('account.admin.role_update_failed', 'Role update failed: {error}', {
              error: (error && error.message) ? error.message : String(error)
            });
          }
        }
        window.setTimeout(() => { btn.textContent = t('account.admin.save', 'Save'); btn.disabled = false; }, 1200);
      });
    }

    // Network profiles suspension tool.
    if (adminNetworkRefresh) adminNetworkRefresh.addEventListener('click', loadNetworkAdmin);
    if (adminNetworkQ) {
      adminNetworkQ.addEventListener('input', () => {
        renderNetworkAdminList();
      });
      adminNetworkQ.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          loadNetworkAdmin();
        }
      });
    }
    if (adminNetworkList) {
      adminNetworkList.addEventListener('click', async (e) => {
        const btn = e && e.target ? e.target.closest('[data-net-save]') : null;
        if (!btn) return;
        const row = btn.closest('[data-net-row]');
        if (!row) return;
        const kind = String(row.getAttribute('data-kind') || '').trim().toLowerCase();
        const slug = String(row.getAttribute('data-slug') || '').trim();
        const suspendedEl = row.querySelector('input[data-net-suspended]');
        const reasonEl = row.querySelector('input[data-net-reason]');
        const suspended = !!(suspendedEl && suspendedEl.checked);
        const reason = reasonEl && reasonEl.value ? String(reasonEl.value) : '';
        await saveNetworkState(kind, slug, suspended, reason, btn);
      });
    }

    // Newsletter tool.
    wireNewsletterUi();

    // Lazy-load network state list on first admin open.
    if (adminNetworkStatus && !lastNetworkItems.length) {
      loadNetworkAdmin().catch(() => {});
    }
  };

  const roleHubContentFor = (role) => {
    const r = normalizeRole(role);

    if (r === 'admin') {
      return {
        title: t('account.role.admin.title', 'Admin control center'),
        bullets: [
          t('account.role.admin.b1', 'Review favourites inbox and respond fast to high-intent clients.'),
          t('account.role.admin.b2', 'Approve new submissions (properties, vehicles, Street Scout).'),
          t('account.role.admin.b3', 'Assign roles for agencies, agents, developers and collaborators.')
        ],
        actions: [
          { href: 'admin-favourites.html', label: t('account.role.admin.a1', 'Favourites inbox') },
          { href: 'admin-crm.html', label: t('account.role.admin.a2', 'CRM') },
          { href: 'admin-scout.html', label: t('account.role.admin.a3', 'Street Scout') }
        ],
        note: t('account.role.admin.note', 'Tip: use “Quick share studio” to generate white-label brochure/reel links in one click.')
      };
    }

    if (r === 'developer') {
      return {
        title: t('account.role.developer.title', 'Developer workspace'),
        bullets: [
          t('account.role.developer.b1', 'Share new builds with clients using brochure + reel video.'),
          t('account.role.developer.b2', 'Use white-label links when sharing with partner agencies.'),
          t('account.role.developer.b3', 'Coordinate viewings and documentation with the SCP team.')
        ],
        actions: [
          { href: 'new-builds.html', label: t('account.role.developer.a1', 'New builds') },
          { href: 'collaborate.html', label: t('account.role.developer.a2', 'Collaboration') },
          { href: 'services.html', label: t('account.role.developer.a3', 'Services') }
        ],
        note: t('account.role.developer.note', 'Use Quick share studio for brochure/reel links by reference (SCP-XXXX).')
      };
    }

    if (r === 'agency_admin') {
      return {
        title: t('account.role.agency_admin.title', 'Agency workspace'),
        bullets: [
          t('account.role.agency_admin.b1', 'Share listings with your clients using your own branding (white-label).'),
          t('account.role.agency_admin.b2', 'Use reels to increase response on Instagram/TikTok.'),
          t('account.role.agency_admin.b3', 'Send shortlists and keep everything in one system.')
        ],
        actions: [
          { href: 'properties.html?saved=1', label: t('account.role.agency_admin.a1', 'Saved') },
          { href: 'collaborate.html', label: t('account.role.agency_admin.a2', 'Partner tools') },
          { href: 'guide.html', label: t('account.role.agency_admin.a3', 'Guide') }
        ],
        note: t('account.role.agency_admin.note', 'Use Quick share studio to generate brochure/reel links in seconds.')
      };
    }

    if (r === 'agent' || r === 'partner') {
      return {
        title: t('account.role.agent.title', 'Agent workspace'),
        bullets: [
          t('account.role.agent.b1', 'Save listings and share a clean shortlist to your client.'),
          t('account.role.agent.b2', 'Generate brochure PDFs and reel videos for social sharing.'),
          t('account.role.agent.b3', 'White-label mode removes SCP branding for your presentations.')
        ],
        actions: [
          { href: 'properties.html?saved=1', label: t('account.role.agent.a1', 'Saved') },
          { href: 'properties.html', label: t('account.role.agent.a2', 'Browse') },
          { href: 'viewing-trip.html', label: t('account.role.agent.a3', 'Viewing trip') }
        ],
        note: t('account.role.agent.note', 'Tip: open a listing modal and click Instagram/TikTok to generate a reel for sharing.')
      };
    }

    if (r === 'collaborator') {
      return {
        title: t('account.role.collaborator.title', 'Collaborator workspace'),
        bullets: [
          t('account.role.collaborator.b1', 'Street Scout: take a photo of a “For Sale” board and earn €200–€500.'),
          t('account.role.collaborator.b2', 'Your submissions are tracked and visible in your dashboard.'),
          t('account.role.collaborator.b3', 'You can also share listings with brochure PDFs and reels.')
        ],
        actions: [
          { href: 'street-scout.html', label: t('account.role.collaborator.a1', 'Street Scout') },
          { href: 'properties.html?saved=1', label: t('account.role.collaborator.a2', 'Saved') },
          { href: 'guide.html', label: t('account.role.collaborator.a3', 'Guide') }
        ],
        note: t('account.role.collaborator.note', 'Keep your location enabled when submitting Street Scout leads.')
      };
    }

    return {
      title: t('account.role.client.title', 'Client dashboard'),
      bullets: [
        t('account.role.client.b1', 'Save listings on mobile and desktop (sync enabled).'),
        t('account.role.client.b2', 'Request a visit and plan a viewing trip when you are ready.'),
        t('account.role.client.b3', 'Sell your property with admin approval for quality control.')
      ],
      actions: [
        { href: 'properties.html', label: t('account.role.client.a1', 'Browse') },
        { href: 'properties.html?saved=1', label: t('account.role.client.a2', 'Saved') },
        { href: 'property-add.html', label: t('account.role.client.a3', 'Sell') }
      ],
      note: t('account.role.client.note', 'If you are an agency/agent/developer, ask us to enable partner tools.')
    };
  };

  const renderRoleHub = (role) => {
    if (!roleHubTitle || !roleHubActions || !roleHubBody) return;
    const content = roleHubContentFor(role);
    roleHubTitle.textContent = content.title || '';

    const actions = Array.isArray(content.actions) ? content.actions : [];
    roleHubActions.innerHTML = actions.slice(0, 4).map((a, idx) => {
      const accent = idx === 0;
      const cls = accent ? 'account-badge account-badge--accent' : 'account-badge';
      return `<a class="${cls}" href="${escapeHtml(a.href || '#')}">${escapeHtml(a.label || '')}</a>`;
    }).join('');

    const bullets = Array.isArray(content.bullets) ? content.bullets : [];
    const note = content.note ? String(content.note) : '';
    roleHubBody.innerHTML = `
      <ul>
        ${bullets.slice(0, 5).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
      ${note ? `<div class="muted">${escapeHtml(note)}</div>` : ''}
    `;
  };

  const wireQuickshare = () => {
    if (quickshareWired) return;
    if (!quicksharePanel) return;
    quickshareWired = true;

    if (quickshareWl) {
      quickshareWl.checked = readQuickshareWl();
      quickshareWl.addEventListener('change', () => {
        writeQuickshareWl(!!quickshareWl.checked);
        updateQuickshare();
      });
    }
    if (quickshareRef) {
      const stored = readQuickshareRef();
      if (stored) quickshareRef.value = stored;
      quickshareRef.addEventListener('input', () => {
        writeQuickshareRef(quickshareRef.value);
        updateQuickshare();
      });
      quickshareRef.addEventListener('blur', () => {
        const next = normalizeRef(quickshareRef.value);
        quickshareRef.value = next;
        writeQuickshareRef(next);
        updateQuickshare();
      });
    }

    const flashHint = (msg) => {
      if (!quickshareHint) return;
      if (!quickshareHint.dataset.defaultText) quickshareHint.dataset.defaultText = quickshareHint.textContent || '';
      quickshareHint.textContent = msg;
      window.setTimeout(() => {
        quickshareHint.textContent = quickshareHint.dataset.defaultText || '';
      }, 1400);
    };

    const onCopy = async (getter) => {
      const text = typeof getter === 'function' ? getter() : '';
      const ok = await copyText(text);
      flashHint(ok ? t('account.quickshare.copied', 'Copied') : t('account.quickshare.copy_failed', 'Copy failed'));
    };

    if (quickshareCopyLink) quickshareCopyLink.addEventListener('click', () => onCopy(() => (quickshareOpen ? quickshareOpen.href : '')));
    if (quickshareCopyBrochure) quickshareCopyBrochure.addEventListener('click', () => onCopy(() => (quickshareBrochure ? quickshareBrochure.href : '')));
    if (quickshareCopyReel) quickshareCopyReel.addEventListener('click', () => onCopy(() => (quickshareReel ? quickshareReel.href : '')));

    updateQuickshare();
  };

  const updateQuickshare = () => {
    const ref = normalizeRef(quickshareRef && quickshareRef.value ? quickshareRef.value : '');
    const wl = quickshareWl ? !!quickshareWl.checked : false;
    const hasRef = !!ref;

    const listingUrl = buildAbsUrl('properties.html', hasRef ? { ref } : {});
    const brochureUrl = buildAbsUrl('brochure.html', hasRef ? { ref, wl: wl ? '1' : '' } : {});
    const reelUrl = buildAbsUrl('reel.html', hasRef ? { ref, wl: wl ? '1' : '' } : {});

    if (quickshareOpen) quickshareOpen.href = listingUrl;
    if (quickshareBrochure) quickshareBrochure.href = brochureUrl;
    if (quickshareReel) quickshareReel.href = reelUrl;

    setCtaDisabled(quickshareOpen, !hasRef);
    setCtaDisabled(quickshareBrochure, !hasRef);
    setCtaDisabled(quickshareReel, !hasRef);
    setCtaDisabled(quickshareCopyLink, !hasRef);
    setCtaDisabled(quickshareCopyBrochure, !hasRef);
    setCtaDisabled(quickshareCopyReel, !hasRef);
  };

  const safeCount = async (client, table, { filters = [] } = {}) => {
    try {
      let q = client.from(table).select('id', { count: 'exact', head: true });
      (filters || []).forEach((f) => {
        if (!f) return;
        if (f.op === 'eq') q = q.eq(f.col, f.val);
      });
      const { count, error } = await q;
      if (error) return null;
      return Number.isFinite(Number(count)) ? Number(count) : null;
    } catch {
      return null;
    }
  };

  const renderActivity = (items) => {
    if (!activityGrid) return;
    const rows = Array.isArray(items) ? items : [];
    activityGrid.innerHTML = rows.map((it) => {
      const href = it.href ? String(it.href) : '';
      const wrapOpen = href ? `<a class="activity-item" href="${escapeHtml(href)}">` : `<div class="activity-item">`;
      const wrapClose = href ? '</a>' : '</div>';
      return `
        ${wrapOpen}
          <div class="activity-k">${escapeHtml(it.k || '')}</div>
          <div class="activity-v">${escapeHtml(it.v == null ? '—' : String(it.v))}</div>
          ${it.note ? `<div class="activity-note">${escapeHtml(it.note)}</div>` : ''}
        ${wrapClose}
      `;
    }).join('');
  };

  const normalizeAlertCriteria = (raw) => {
    const c = raw && typeof raw === 'object' ? raw : {};
    const scope = String(c.scope || 'resales').trim();
    const around = c && c.spatial && c.spatial.around && typeof c.spatial.around === 'object' ? c.spatial.around : {};
    return {
      scope: ['resales', 'new_builds', 'all'].includes(scope) ? scope : 'resales',
      selectedCity: String(c.selectedCity || 'all').trim() || 'all',
      selectedType: String(c.selectedType || 'all').trim() || 'all',
      maxPrice: String(c.maxPrice || 'any').trim() || 'any',
      minBeds: Math.max(0, Number(c.minBeds) || 0),
      minBaths: Math.max(0, Number(c.minBaths) || 0),
      operationMode: String(c.operationMode || 'any').trim() || 'any',
      spatialMode: c && c.spatial && c.spatial.mode ? String(c.spatial.mode) : 'none',
      aroundRadiusKm: Number(around.radiusKm) || 0
    };
  };

  const cityLabelForAlert = (cityKey) => {
    const key = String(cityKey || '').trim().toLowerCase();
    if (!key || key === 'all') return t('city.all', 'All Destinations');
    const map = {
      torrevieja: 'Torrevieja',
      'orihuela-costa': 'Orihuela Costa',
      guardamar: 'Guardamar',
      quesada: 'Quesada'
    };
    return map[key] || key.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  };

  const alertScopeLabel = (scope) => {
    if (scope === 'new_builds') return t('alerts.scope.new_builds', 'New Builds');
    if (scope === 'all') return t('alerts.scope.all', 'All Listings');
    return t('alerts.scope.resales', 'Properties');
  };

  const summarizeAlertCriteria = (raw) => {
    const c = normalizeAlertCriteria(raw);
    const parts = [alertScopeLabel(c.scope)];
    if (c.selectedCity && c.selectedCity !== 'all') parts.push(cityLabelForAlert(c.selectedCity));
    if (c.selectedType && c.selectedType !== 'all') parts.push(c.selectedType);
    if (c.maxPrice !== 'any') {
      const p = Number(c.maxPrice);
      if (Number.isFinite(p) && p > 0) parts.push(`≤ €${new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 }).format(p)}`);
    }
    if (c.minBeds > 0) parts.push(`${c.minBeds}+ ${t('filters.beds', 'Beds')}`);
    if (c.minBaths > 0) parts.push(`${c.minBaths}+ ${t('filters.baths', 'Baths')}`);
    if (c.operationMode && c.operationMode !== 'any') {
      const opLabel = c.operationMode === 'sale'
        ? t('filters.sale', 'Sale')
        : c.operationMode === 'rent_longterm'
          ? t('filters.rent_long', 'Rent (long-term)')
          : c.operationMode === 'rent_vacation'
            ? t('filters.rent_vacation', 'Rent (vacation)')
            : c.operationMode;
      parts.push(opLabel);
    }
    if (c.spatialMode === 'around' && c.aroundRadiusKm > 0) parts.push(`${c.aroundRadiusKm} km radius`);
    if (c.spatialMode === 'polygon') parts.push(t('account.alerts.perimeter_on', 'Perimeter area'));
    return parts.slice(0, 7).join(' · ');
  };

  const setAlertsStatus = (text) => {
    if (!alertsStatus) return;
    alertsStatus.textContent = text ? String(text) : '';
  };

  const loadUserAlerts = async (client, user) => {
    if (!client || !user) return [];
    const { data, error } = await client
      .from('saved_search_alerts')
      .select('id,name,criteria,enabled,created_at,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(40);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  const loadUserAlertMatches = async (client, user) => {
    if (!client || !user) return [];
    const { data, error } = await client
      .from('saved_search_matches')
      .select('id,alert_id,property_id,property_ref,property_town,property_type,property_price,property_url,seen,matched_at')
      .eq('user_id', user.id)
      .order('matched_at', { ascending: false })
      .limit(240);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  const renderAlertsPanel = ({ alerts = [], matches = [] } = {}) => {
    if (!alertsList || !alertsSummary) return;

    const alertRows = Array.isArray(alerts) ? alerts : [];
    const matchRows = Array.isArray(matches) ? matches : [];

    const byAlert = new Map();
    matchRows.forEach((m) => {
      const aid = m && m.alert_id ? String(m.alert_id) : '';
      if (!aid) return;
      if (!byAlert.has(aid)) byAlert.set(aid, []);
      byAlert.get(aid).push(m);
    });

    const unseen = matchRows.filter((m) => !(m && m.seen)).length;
    alertsSummary.textContent = t('account.alerts.summary', '{alerts} alerts · {new} new matches', {
      alerts: alertRows.length,
      new: unseen
    });

    if (alertsMarkSeenBtn) alertsMarkSeenBtn.disabled = unseen === 0;

    if (!alertRows.length) {
      alertsList.innerHTML = `<div class="account-alert-empty">${escapeHtml(t('account.alerts.empty', 'No alerts yet. Save your requirements from Properties or New Builds.'))}</div>`;
      return;
    }

    alertsList.innerHTML = alertRows.map((alert) => {
      const id = alert && alert.id ? String(alert.id) : '';
      const enabled = !alert || alert.enabled !== false;
      const rows = byAlert.get(id) || [];
      const newCount = rows.filter((r) => !(r && r.seen)).length;
      const totalCount = rows.length;
      const criteriaSummary = summarizeAlertCriteria(alert && alert.criteria);
      const latest = rows.slice(0, 3);

      const latestHtml = latest.length
        ? `
          <div class="account-alert-match-list">
            ${latest.map((m) => {
              const ref = m && m.property_ref ? String(m.property_ref) : (m && m.property_id ? String(m.property_id) : '');
              const town = m && m.property_town ? String(m.property_town) : '';
              const url = m && m.property_url ? String(m.property_url) : 'properties.html';
              const txt = [ref, town].filter(Boolean).join(' · ');
              return `<a class="account-alert-match" href="${escapeHtml(url)}">${escapeHtml(txt || t('listing.item', 'Listing'))}</a>`;
            }).join('')}
          </div>
        `
        : `<div class="muted">${escapeHtml(t('account.alerts.no_matches', 'No matches yet for this alert.'))}</div>`;

      return `
        <div class="account-alert-item" data-alert-id="${escapeHtml(id)}">
          <div class="account-alert-head">
            <div class="account-alert-name">${escapeHtml(alert && alert.name ? String(alert.name) : t('alerts.default_name', 'Saved alert'))}</div>
            <div class="account-alert-metrics">
              <span class="account-alert-badge${newCount > 0 ? ' account-alert-badge--new' : ''}">
                ${escapeHtml(t('account.alerts.new_badge', '{count} new', { count: newCount }))}
              </span>
              <span class="account-alert-badge">
                ${escapeHtml(t('account.alerts.total_badge', '{count} total', { count: totalCount }))}
              </span>
              ${enabled ? '' : `<span class="account-alert-badge">${escapeHtml(t('account.alerts.paused', 'Paused'))}</span>`}
            </div>
          </div>
          <div class="account-alert-summary">${escapeHtml(criteriaSummary)}</div>
          <div class="account-alert-actions">
            <button class="cta-button cta-button--outline" type="button" data-alert-toggle="${escapeHtml(id)}" data-enabled="${enabled ? '1' : '0'}">
              ${escapeHtml(enabled ? t('account.alerts.pause', 'Pause') : t('account.alerts.resume', 'Resume'))}
            </button>
            <button class="cta-button cta-button--outline" type="button" data-alert-delete="${escapeHtml(id)}">${escapeHtml(t('account.alerts.delete', 'Delete'))}</button>
          </div>
          ${latestHtml}
        </div>
      `;
    }).join('');
  };

  const refreshAlertsPanel = async (client, user) => {
    if (!alertsPanel || !alertsList || !alertsSummary) return;
    if (!client || !user) {
      alertsSummary.textContent = t('account.alerts.auth', 'Sign in to load your alerts.');
      alertsList.innerHTML = '';
      setAlertsStatus('');
      if (alertsMarkSeenBtn) alertsMarkSeenBtn.disabled = true;
      return;
    }

    alertsSummary.textContent = t('account.alerts.loading', 'Loading alerts…');
    setAlertsStatus('');

    try {
      const [alerts, matches] = await Promise.all([
        loadUserAlerts(client, user),
        loadUserAlertMatches(client, user)
      ]);
      renderAlertsPanel({ alerts, matches });
    } catch (error) {
      const msg = error && error.message ? String(error.message) : String(error);
      if (/relation|saved_search/i.test(msg)) {
        alertsSummary.textContent = t('account.alerts.setup_required', 'Alerts table missing. Run the updated supabase.sql.');
      } else {
        alertsSummary.textContent = t('account.alerts.load_failed', 'Could not load alerts right now.');
      }
      alertsList.innerHTML = '';
    }
  };

  const wireAlertsUi = () => {
    if (alertsWired) return;
    if (!alertsPanel) return;
    alertsWired = true;

    if (alertsRefreshBtn) {
      alertsRefreshBtn.addEventListener('click', async () => {
        const client = getClient();
        const user = dashboardUser;
        await refreshAlertsPanel(client, user);
      });
    }

    if (alertsMarkSeenBtn) {
      alertsMarkSeenBtn.addEventListener('click', async () => {
        const client = getClient();
        const user = dashboardUser;
        if (!client || !user) return;
        alertsMarkSeenBtn.disabled = true;
        setAlertsStatus(t('account.alerts.marking', 'Marking as seen…'));
        try {
          const { error } = await client
            .from('saved_search_matches')
            .update({ seen: true })
            .eq('user_id', user.id)
            .eq('seen', false);
          if (error) {
            setAlertsStatus(t('account.alerts.mark_failed', 'Could not mark alerts as seen.'));
          } else {
            setAlertsStatus(t('account.alerts.mark_done', 'All alerts marked as seen.'));
          }
        } catch {
          setAlertsStatus(t('account.alerts.mark_failed', 'Could not mark alerts as seen.'));
        }
        await refreshAlertsPanel(client, user);
        window.setTimeout(() => setAlertsStatus(''), 2200);
      });
    }

    if (alertsList) {
      alertsList.addEventListener('click', async (event) => {
        const el = event && event.target ? event.target : null;
        if (!el) return;
        const client = getClient();
        const user = dashboardUser;
        if (!client || !user) return;

        const toggleBtn = el.closest('[data-alert-toggle]');
        if (toggleBtn) {
          const id = toggleBtn.getAttribute('data-alert-toggle') || '';
          const enabled = toggleBtn.getAttribute('data-enabled') === '1';
          if (!id) return;
          setAlertsStatus(t('account.alerts.updating', 'Updating alert…'));
          try {
            const { error } = await client
              .from('saved_search_alerts')
              .update({ enabled: !enabled })
              .eq('id', id)
              .eq('user_id', user.id);
            if (error) {
              setAlertsStatus(t('account.alerts.update_failed', 'Could not update alert.'));
            } else {
              setAlertsStatus(t('account.alerts.updated', 'Alert updated.'));
            }
          } catch {
            setAlertsStatus(t('account.alerts.update_failed', 'Could not update alert.'));
          }
          await refreshAlertsPanel(client, user);
          window.setTimeout(() => setAlertsStatus(''), 2200);
          return;
        }

        const deleteBtn = el.closest('[data-alert-delete]');
        if (deleteBtn) {
          const id = deleteBtn.getAttribute('data-alert-delete') || '';
          if (!id) return;
          const ok = window.confirm(t('account.alerts.delete_confirm', 'Delete this alert?'));
          if (!ok) return;
          setAlertsStatus(t('account.alerts.deleting', 'Deleting alert…'));
          try {
            const { error } = await client
              .from('saved_search_alerts')
              .delete()
              .eq('id', id)
              .eq('user_id', user.id);
            if (error) {
              setAlertsStatus(t('account.alerts.delete_failed', 'Could not delete alert.'));
            } else {
              setAlertsStatus(t('account.alerts.deleted', 'Alert deleted.'));
            }
          } catch {
            setAlertsStatus(t('account.alerts.delete_failed', 'Could not delete alert.'));
          }
          await refreshAlertsPanel(client, user);
          window.setTimeout(() => setAlertsStatus(''), 2200);
        }
      });
    }
  };

  const loadActivity = async (client, user, role) => {
    if (!client || !user) return;
    if (!activityGrid) return;

    renderActivity([
      { k: t('account.activity.loading', 'Loading'), v: '…', note: t('account.activity.loading_note', 'Fetching your latest stats…') }
    ]);

    const isAdmin = normalizeRole(role) === 'admin';

    if (isAdmin) {
      const [newScout, newProp, newVeh, favTotal] = await Promise.all([
        safeCount(client, 'collab_board_leads', { filters: [{ op: 'eq', col: 'status', val: 'new' }] }),
        safeCount(client, 'property_submissions', { filters: [{ op: 'eq', col: 'status', val: 'new' }] }),
        safeCount(client, 'vehicle_submissions', { filters: [{ op: 'eq', col: 'status', val: 'new' }] }),
        safeCount(client, 'favourites')
      ]);

      renderActivity([
        { k: t('account.activity.admin.fav', 'Favourites'), v: favTotal ?? '—', note: t('account.activity.admin.fav_note', 'Total saved across all users'), href: 'admin-favourites.html' },
        { k: t('account.activity.admin.scout', 'Street Scout'), v: newScout ?? '—', note: t('account.activity.admin.scout_note', 'New leads to review'), href: 'admin-scout.html' },
        { k: t('account.activity.admin.props', 'Property inbox'), v: newProp ?? '—', note: t('account.activity.admin.props_note', 'New owner submissions'), href: 'admin-properties.html' },
        { k: t('account.activity.admin.vehicles', 'Vehicle inbox'), v: newVeh ?? '—', note: t('account.activity.admin.vehicles_note', 'New vehicle submissions'), href: 'admin-vehicles.html' }
      ]);
      return;
    }

    const uid = user.id;
    const localSaved = readSavedCount();
    const [favCount, artCount, alertNewCount, scoutCount, propCount, vehCount] = await Promise.all([
      safeCount(client, 'favourites', { filters: [{ op: 'eq', col: 'user_id', val: uid }] }),
      safeCount(client, 'blog_favourites', { filters: [{ op: 'eq', col: 'user_id', val: uid }] }),
      safeCount(client, 'saved_search_matches', { filters: [{ op: 'eq', col: 'user_id', val: uid }, { op: 'eq', col: 'seen', val: false }] }),
      safeCount(client, 'collab_board_leads', { filters: [{ op: 'eq', col: 'user_id', val: uid }] }),
      safeCount(client, 'property_submissions', { filters: [{ op: 'eq', col: 'user_id', val: uid }] }),
      safeCount(client, 'vehicle_submissions', { filters: [{ op: 'eq', col: 'user_id', val: uid }] })
    ]);

    renderActivity([
      { k: t('account.activity.saved', 'Saved'), v: favCount ?? '—', note: t('account.activity.saved_note', `Synced favourites · ${localSaved} on this device`, { local: localSaved }), href: 'properties.html?saved=1' },
      { k: t('account.activity.articles', 'Articles'), v: artCount ?? '—', note: t('account.activity.articles_note', 'Saved blog posts'), href: 'blog.html?saved=1' },
      { k: t('account.activity.alerts', 'Alerts'), v: alertNewCount ?? '—', note: t('account.activity.alerts_note', 'New listing matches from your saved requirements'), href: '#alerts-panel' },
      { k: t('account.activity.scout', 'Street Scout'), v: scoutCount ?? '—', note: t('account.activity.scout_note', 'Board leads submitted'), href: 'street-scout.html' },
      { k: t('account.activity.props', 'Sell / Submit'), v: propCount ?? '—', note: t('account.activity.props_note', 'Property submissions'), href: 'property-add.html' },
      { k: t('account.activity.vehicles', 'Vehicles'), v: vehCount ?? '—', note: t('account.activity.vehicles_note', 'Vehicle submissions'), href: 'vehicle-add.html' }
    ]);
  };

  const fmtDateShort = (iso) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return '';
      const lang = (window.SCP_I18N && window.SCP_I18N.lang) ? String(window.SCP_I18N.lang) : 'en';
      return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-GB', { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {
      return '';
    }
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

  const basketItems = () => {
    const basket = getBasket();
    if (!basket || typeof basket.read !== 'function') return [];
    const items = basket.read();
    return Array.isArray(items) ? items : [];
  };

  const renderBasket = () => {
    if (!shopBasketList) return;
    const items = basketItems();
    if (!items.length) {
      shopBasketList.innerHTML = `
        <div class="muted">${escapeHtml(t('account.shop.basket_empty', 'Basket is empty. Open the shop to add devices.'))}</div>
      `;
      return;
    }

    shopBasketList.innerHTML = items
      .slice(0, 24)
      .map((it) => {
        const id = it && it.wc_id ? String(it.wc_id) : '';
        const name = it && it.name ? String(it.name) : `WC-${id}`;
        const sku = it && it.sku ? String(it.sku) : '';
        const img = it && it.image ? String(it.image) : 'assets/placeholder.png';
        const cur = it && it.currency ? String(it.currency) : 'EUR';
        const sym = it && it.currency_symbol ? String(it.currency_symbol) : '€';
        const price = it && it.price != null ? money(it.price, { currency: cur, symbol: sym }) : '';
        const meta = [sku ? `SKU: ${sku}` : '', price ? `Price: ${price}` : t('account.shop.price_on_request', 'Price on request')].filter(Boolean).join(' · ');

        return `
          <div class="account-shop-item" data-wc-id="${escapeHtml(id)}">
            <img class="account-shop-thumb" src="${escapeHtml(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/placeholder.png'">
            <div class="account-shop-main">
              <div class="account-shop-name">${escapeHtml(name)}</div>
              <div class="account-shop-meta">${escapeHtml(meta)}</div>
              <div class="account-shop-controls">
                <div class="account-shop-qty" aria-label="Quantity">
                  <button type="button" data-qty="minus" aria-label="Decrease">-</button>
                  <span>${escapeHtml(String(it.qty || 1))}</span>
                  <button type="button" data-qty="plus" aria-label="Increase">+</button>
                </div>
                <button class="account-shop-mini" type="button" data-remove="1">${escapeHtml(t('account.shop.remove', 'Remove'))}</button>
                ${it && it.url ? `<a class="account-shop-mini" href="${escapeHtml(String(it.url))}" target="_blank" rel="noopener">${escapeHtml(t('account.shop.open', 'Open'))}</a>` : ''}
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  };

  const badgeForStatus = (status) => {
    const s = String(status || 'requested').toLowerCase();
    const cls = s === 'paid' || s === 'fulfilled' || s === 'installed'
      ? `order-badge order-badge--${s}`
      : s === 'cancelled'
        ? 'order-badge order-badge--cancelled'
        : 'order-badge order-badge--requested';
    return `<span class="${cls}">${escapeHtml(t(`account.shop.status.${s}`, s.toUpperCase()))}</span>`;
  };

  const renderShopHistory = ({ orders = [], items = [] } = {}) => {
    if (!shopHistoryList) return;
    const ords = Array.isArray(orders) ? orders : [];
    if (!ords.length) {
      shopHistoryList.innerHTML = `
        <div class="muted">${escapeHtml(t('account.shop.history_empty', 'No purchases yet. Your requests and purchases will show here.'))}</div>
      `;
      return;
    }

    const itemRows = Array.isArray(items) ? items : [];
    const byOrder = new Map();
    itemRows.forEach((r) => {
      const oid = r && r.order_id ? String(r.order_id) : '';
      if (!oid) return;
      if (!byOrder.has(oid)) byOrder.set(oid, []);
      byOrder.get(oid).push(r);
    });

    shopHistoryList.innerHTML = ords
      .slice(0, 12)
      .map((o) => {
        const oid = o && o.id ? String(o.id) : '';
        const status = o && o.status ? String(o.status) : 'requested';
        const createdAt = o && o.created_at ? String(o.created_at) : '';
        const date = createdAt ? fmtDateShort(createdAt) : '';
        const lines = (byOrder.get(oid) || []).slice(0, 12);

        const itemsHtml = lines.length
          ? `
            <div class="account-order-lines">
              ${lines.map((it) => {
                const wcId = it && it.wc_id != null ? String(it.wc_id) : '';
                const img = it && it.image ? String(it.image) : 'assets/placeholder.png';
                const name = it && it.name ? String(it.name) : (wcId ? `WC-${wcId}` : 'Item');
                const qty = Number(it && it.qty) || 1;
                return `
                  <div class="account-order-line">
                    <img class="account-order-thumb" src="${escapeHtml(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/placeholder.png'">
                    <div class="account-order-line-name">${escapeHtml(name)} <span class="muted" style="font-weight:900;">x${escapeHtml(String(qty))}</span></div>
                    ${wcId ? `<button class="account-shop-mini" type="button" data-docs-wc="${escapeHtml(wcId)}" data-docs-status="${escapeHtml(status)}">${escapeHtml(t('account.shop.docs', 'Docs'))}</button>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `
          : `<div class="muted">${escapeHtml(t('account.shop.order_no_items', 'No items recorded.'))}</div>`;

        return `
          <div class="account-shop-item" data-order-id="${escapeHtml(oid)}">
            <div class="account-shop-main">
              <div class="account-order-head">
                <div class="account-shop-name">${escapeHtml(t('account.shop.order', 'Order'))} ${escapeHtml(oid ? `#${oid.slice(0, 8)}` : '')}</div>
                ${badgeForStatus(status)}
              </div>
              <div class="account-shop-meta">${escapeHtml([date ? `${t('account.shop.placed', 'Placed')} ${date}` : '', oid ? `ID: ${oid}` : ''].filter(Boolean).join(' · '))}</div>
              ${itemsHtml}
            </div>
          </div>
        `;
      })
      .join('');
  };

  const closeShopDocsModal = () => {
    if (!shopDocsModal) return;
    shopDocsModal.style.display = 'none';
    shopDocsModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (shopDocsModalBody) shopDocsModalBody.textContent = '';
  };

  const openShopDocsModal = (html) => {
    if (!shopDocsModal || !shopDocsModalBody) return;
    shopDocsModalBody.innerHTML = html || '';
    shopDocsModal.style.display = 'block';
    shopDocsModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const renderDocsHtml = ({ title = '', instructions = '', links = [] } = {}) => {
    const safeTitle = String(title || '').trim();
    const safeInstr = String(instructions || '').trim();
    const list = Array.isArray(links) ? links.map((x) => String(x || '').trim()).filter(Boolean) : [];

    const blocks = [];
    blocks.push(`<div class="blog-post">`);
    blocks.push(`<h2 class="blog-post-title" style="margin-top:0;">${escapeHtml(safeTitle || t('account.shop.docs_title', 'Installation instructions'))}</h2>`);
    blocks.push(`<p class="blog-post-excerpt">${escapeHtml(t('account.shop.docs_note', 'This content is available after purchase/approval.'))}</p>`);

    if (safeInstr) {
      const lines = safeInstr.split(/\\r?\\n/).map((l) => l.trim()).filter(Boolean);
      const looksLikeList = lines.length >= 2 && lines.filter((l) => /^[-*•]\\s+/.test(l)).length >= 2;
      if (looksLikeList) {
        blocks.push(`<ul class="blog-post-ul">`);
        lines.forEach((l) => {
          const item = l.replace(/^[-*•]\\s+/, '').trim();
          if (item) blocks.push(`<li>${escapeHtml(item)}</li>`);
        });
        blocks.push(`</ul>`);
      } else {
        lines.slice(0, 24).forEach((l) => blocks.push(`<p class="blog-post-p">${escapeHtml(l)}</p>`));
      }
    } else {
      blocks.push(`<p class="blog-post-p muted">${escapeHtml(t('account.shop.docs_empty', 'No instructions added yet.'))}</p>`);
    }

    if (list.length) {
      blocks.push(`<h3 class="blog-post-h">${escapeHtml(t('account.shop.docs_links', 'Links'))}</h3>`);
      blocks.push(`<ul class="blog-post-ul">`);
      list.slice(0, 10).forEach((url) => {
        const safe = url.startsWith('http://') || url.startsWith('https://') ? url : '';
        blocks.push(`<li>${safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safe)}</a>` : escapeHtml(url)}</li>`);
      });
      blocks.push(`</ul>`);
    }

    blocks.push(`</div>`);
    return blocks.join('');
  };

  const loadDocsForWc = async (client, wcId) => {
    if (!client) return null;
    const id = Number(wcId);
    if (!Number.isFinite(id) || id <= 0) return null;
    try {
      const { data, error } = await client
        .from('shop_product_docs')
        .select('wc_id,title,instructions,links,updated_at')
        .eq('wc_id', id)
        .maybeSingle();
      if (error) return null;
      if (!data) return null;
      return {
        title: data.title || '',
        instructions: data.instructions || '',
        links: Array.isArray(data.links) ? data.links : []
      };
    } catch {
      return null;
    }
  };

  const loadShopOrders = async (client, user) => {
    if (!client || !user) return { orders: [], items: [] };
    try {
      const { data: orders, error } = await client
        .from('shop_orders')
        .select('id,status,created_at,updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) return { orders: [], items: [] };
      const ords = Array.isArray(orders) ? orders : [];
      const ids = ords.map((o) => o && o.id).filter(Boolean);
      if (!ids.length) return { orders: ords, items: [] };

      const { data: items, error: itemsErr } = await client
        .from('shop_order_items')
        .select('order_id,wc_id,sku,name,qty,image,product_url,currency,currency_symbol,price')
        .in('order_id', ids);
      if (itemsErr) return { orders: ords, items: [] };
      return { orders: ords, items: Array.isArray(items) ? items : [] };
    } catch {
      return { orders: [], items: [] };
    }
  };

  const setShopStatus = (text) => {
    if (!shopCheckoutStatus) return;
    shopCheckoutStatus.textContent = text || '';
  };

  const refreshShopPanel = async (client, user) => {
    renderBasket();
    if (!shopHistoryList) return;
    if (!client || !user) {
      shopHistoryList.innerHTML = `<div class="muted">${escapeHtml(t('account.shop.history_auth', 'Sign in to see your purchase history.'))}</div>`;
      return;
    }
    renderShopHistory({ orders: [], items: [] });
    const res = await loadShopOrders(client, user);
    renderShopHistory(res);
  };

  const wireShopUi = () => {
    if (shopWired) return;
    shopWired = true;

    renderBasket();

    window.addEventListener('scp:basket:change', () => {
      renderBasket();
    });
    window.addEventListener('storage', (event) => {
      try {
        const basket = getBasket();
        const key = basket && basket.key ? String(basket.key) : '';
        if (key && event && event.key === key) renderBasket();
      } catch {
        // ignore
      }
    });

    if (shopBasketList) {
      shopBasketList.addEventListener('click', (event) => {
        const el = event && event.target ? event.target : null;
        if (!el) return;
        const row = el.closest('[data-wc-id]');
        const wcId = row ? row.getAttribute('data-wc-id') : '';
        const basket = getBasket();
        if (!basket || !wcId) return;

        if (el.closest('[data-remove]')) {
          basket.remove(wcId);
          return;
        }
        const qtyBtn = el.closest('[data-qty]');
        if (qtyBtn) {
          const dir = qtyBtn.getAttribute('data-qty');
          const items = basket.read();
          const cur = Array.isArray(items) ? items.find((it) => String(it.wc_id) === String(wcId)) : null;
          const q = Number(cur && cur.qty) || 1;
          basket.setQty(wcId, dir === 'minus' ? Math.max(1, q - 1) : Math.min(99, q + 1));
        }
      });
    }

    if (shopClearBasketBtn) {
      shopClearBasketBtn.addEventListener('click', () => {
        const basket = getBasket();
        if (!basket || typeof basket.clear !== 'function') return;
        basket.clear();
        setShopStatus(t('account.shop.cleared', 'Basket cleared.'));
        window.setTimeout(() => setShopStatus(''), 1600);
      });
    }

    if (shopDocsModalClose) shopDocsModalClose.addEventListener('click', closeShopDocsModal);
    if (shopDocsModal) {
      shopDocsModal.addEventListener('click', (event) => {
        if (event && event.target === shopDocsModal) closeShopDocsModal();
      });
    }
    window.addEventListener('keydown', (event) => {
      if (event && event.key === 'Escape') closeShopDocsModal();
    });

    if (shopHistoryList) {
      shopHistoryList.addEventListener('click', async (event) => {
        const el = event && event.target ? event.target : null;
        if (!el) return;
        const btn = el.closest('[data-docs-wc]');
        if (!btn) return;
        const wcId = btn.getAttribute('data-docs-wc') || '';
        const status = btn.getAttribute('data-docs-status') || 'requested';

        const client = getClient();
        if (!client) {
          openShopDocsModal(renderDocsHtml({ title: '', instructions: '', links: [] }));
          return;
        }

        openShopDocsModal(renderDocsHtml({
          title: '',
          instructions: status && String(status).toLowerCase() === 'requested'
            ? t('account.shop.docs_pending', 'Docs will appear here after payment/approval.')
            : '',
          links: []
        }));

        const docs = await loadDocsForWc(client, wcId);
        if (!docs) {
          openShopDocsModal(renderDocsHtml({
            title: '',
            instructions: status && String(status).toLowerCase() === 'requested'
              ? t('account.shop.docs_pending', 'Docs will appear here after payment/approval.')
              : t('account.shop.docs_empty', 'No instructions added yet.'),
            links: []
          }));
          return;
        }
        openShopDocsModal(renderDocsHtml(docs));
      });
    }

    if (shopCheckoutBtn) {
      shopCheckoutBtn.addEventListener('click', async () => {
        const client = getClient();
        const user = dashboardUser;
        if (!client || !user) return;

        const basket = getBasket();
        const items = basketItems();
        if (!basket || !items.length) {
          setShopStatus(t('account.shop.checkout_empty', 'Basket is empty.'));
          window.setTimeout(() => setShopStatus(''), 1800);
          return;
        }

        shopCheckoutBtn.disabled = true;
        setShopStatus(t('account.shop.checkout_sending', 'Sending request…'));

        try {
          const { data: orderRow, error } = await withTimeout(
            client
              .from('shop_orders')
              .insert({ user_id: user.id, user_email: user.email || null, status: 'requested' })
              .select('id')
              .single(),
            AUTH_TIMEOUT_MS,
            'Checkout'
          );
          if (error || !orderRow || !orderRow.id) {
            setShopStatus(`${t('account.shop.checkout_failed', 'Checkout failed')}: ${(error && error.message) ? error.message : 'unknown error'}`);
            return;
          }

          const orderId = String(orderRow.id);
          const payload = items.map((it) => ({
            order_id: orderId,
            wc_id: it && it.wc_id ? Number(it.wc_id) : null,
            sku: it && it.sku ? String(it.sku) : null,
            name: it && it.name ? String(it.name) : null,
            qty: Number(it && it.qty) || 1,
            image: it && it.image ? String(it.image) : null,
            product_url: it && it.url ? String(it.url) : null,
            currency: it && it.currency ? String(it.currency) : null,
            currency_symbol: it && it.currency_symbol ? String(it.currency_symbol) : null,
            price: it && it.price != null ? Number(it.price) : null
          }));

          const { error: itemsErr } = await withTimeout(
            client.from('shop_order_items').insert(payload),
            AUTH_TIMEOUT_MS,
            'Checkout items'
          );
          if (itemsErr) {
            setShopStatus(`${t('account.shop.checkout_failed', 'Checkout failed')}: ${itemsErr.message || 'items error'}`);
            return;
          }

          if (typeof basket.clear === 'function') basket.clear();
          setShopStatus(t('account.shop.checkout_sent', 'Request sent. We will contact you to confirm payment and installation.'));
          await refreshShopPanel(client, user);
        } catch (err) {
          setShopStatus(`${t('account.shop.checkout_failed', 'Checkout failed')}: ${err && err.message ? err.message : String(err)}`);
        } finally {
          shopCheckoutBtn.disabled = false;
          window.setTimeout(() => setShopStatus(''), 6000);
        }
      });
    }

    if (shopRefresh) {
      shopRefresh.addEventListener('click', async () => {
        const client = getClient();
        const user = dashboardUser;
        await refreshShopPanel(client, user);
      });
    }
  };

  async function refresh({ sessionOverride } = {}) {
    const client = getClient();

    if (recoveryPanel) {
      setVisible(recoveryPanel, recoveryMode);
      if (recoveryMode) {
        setStatus(
          t('account.status.recovery_title', 'Password recovery'),
          t('account.status.recovery_hint', 'Set a new password below.')
        );
        if (signOutBtn) signOutBtn.disabled = true;
        setVisible(dashboardPanels, false);
        setVisible(accountWorkspace, false);
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
        setStatus(
          t('account.status.supabase_not_configured_title', 'Supabase is not configured.'),
          t('account.status.supabase_not_configured_hint', 'Fill `config.js` with your Supabase URL + anon/publishable key.')
        );
      } else if (status && status.error) {
        setStatus(t('account.status.supabase_init_failed', 'Supabase init failed'), String(status.error));
      } else if (status && status.enabled === false) {
        setStatus(
          t('account.status.supabase_not_ready_title', 'Supabase is not ready'),
          t('account.status.supabase_not_ready_hint', 'The Supabase client did not initialise. Check the Diagnostics (?qa=1).')
        );
      } else {
        setStatus(t('account.status.connecting', 'Connecting...'), t('account.status.initializing_auth', 'Initialising authentication…'));
      }

      if (signOutBtn) signOutBtn.disabled = true;
      setVisible(dashboardPanels, false);
      setVisible(accountWorkspace, false);
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
        const abortLike = /abort/i.test(msg);
        const fallbackSession = abortLike ? tryReadSessionFromStorage() : null;
        if (fallbackSession && fallbackSession.user) {
          session = fallbackSession;
        } else if (abortLike) {
          sessionAbortRetries += 1;
          const delay = Math.min(4000, 250 * sessionAbortRetries);
          if (sessionAbortTimer) window.clearTimeout(sessionAbortTimer);
          if (sessionAbortRetries <= 12) {
            setStatus(
              t('account.status.connecting_ellipsis', 'Connecting…'),
              t('account.status.auth_session_retrying', 'Auth session check aborted (storage={storage}). Retrying in {seconds}s…', {
                storage,
                seconds: Math.ceil(delay / 1000)
              })
            );
            sessionAbortTimer = window.setTimeout(() => refresh(), delay);
          } else {
            const hint = t(
              'account.status.auth_session_failed_hint',
              'Session check aborted (storage={storage}). Try: Clear offline cache, then Reset login, then sign in again. If it persists, disable VPN/ad-block and open ?qa=1 for diagnostics.',
              { storage }
            );
            setStatus(t('account.status.auth_session_failed_title', 'Auth session failed'), hint);
          }
          if (signOutBtn) signOutBtn.disabled = true;
          setVisible(dashboardPanels, false);
          setVisible(accountWorkspace, false);
          setVisible(authPanels, true, 'grid');
          setVisible(authStatus, true, 'block');
          return;
        } else {
          const hint = t('account.status.auth_session_error_with_storage', '{message} (storage={storage})', {
            message: msg,
            storage
          });
          setStatus(t('account.status.auth_session_failed_title', 'Auth session failed'), hint);
          if (signOutBtn) signOutBtn.disabled = true;
          setVisible(dashboardPanels, false);
          setVisible(accountWorkspace, false);
          setVisible(authPanels, true, 'grid');
          setVisible(authStatus, true, 'block');
          return;
        }
        if (signOutBtn) signOutBtn.disabled = true;
        setVisible(dashboardPanels, false);
        setVisible(accountWorkspace, false);
        setVisible(authPanels, true, 'grid');
        setVisible(authStatus, true, 'block');
        return;
      }
      session = data && data.session ? data.session : null;
    }
    const user = session && session.user ? session.user : null;

    if (!user) {
      sessionAbortRetries = 0;
      setStatus(
        t('account.status.signed_out_title', 'Signed out'),
        t('account.status.signed_out_hint', 'Sign in to sync favourites across devices.')
      );
      dashboardUser = null;
      dashboardRole = 'client';
      if (signOutBtn) signOutBtn.disabled = true;
      setVisible(dashboardPanels, false);
      setVisible(accountWorkspace, false);
      setVisible(authPanels, true, 'grid');
      setVisible(authStatus, true, 'block');
      return;
    }

    sessionAbortRetries = 0;
    setVisible(authPanels, false);
    setVisible(dashboardPanels, true);
    setVisible(accountWorkspace, true, 'grid');
    setVisible(authStatus, false);

    const profileInfo = await getProfileInfo(client, user.id);
    const role = normalizeRole(profileInfo && profileInfo.role ? profileInfo.role : 'client');
    const roleHint = !profileInfo.role && profileInfo && profileInfo.error
      ? t('account.status.role_unavailable', ' Role unavailable: {error}', { error: profileInfo.error })
      : '';
    const who = (profileInfo && profileInfo.displayName) ? profileInfo.displayName : (user.email || t('account.common.user', 'user'));

    setStatus(
      t('account.status.welcome', 'Welcome, {name}', { name: who }),
      t('account.status.saved_sync_hint', 'Your saved listings will sync on the Properties page.{roleHint}', { roleHint })
    );
    if (signOutBtn) signOutBtn.disabled = false;

    setRoleBadge(role);
    if (dashSavedCount) dashSavedCount.textContent = String(readSavedCount());
    setVisible(dashAdminTile, role === 'admin', 'block');
    setVisible(dashVehiclesTile, role === 'admin', 'block');
    setVisible(dashPropertiesTile, role === 'admin', 'block');
    setVisible(dashCrmTile, role === 'admin', 'block');
    setVisible(dashShopTile, role === 'admin', 'block');
    setVisible(dashRefMapTile, role === 'admin', 'block');

    const meta = ROLE_META[role] || ROLE_META.client;

    dashboardUser = user;
    dashboardRole = role;

    if (profileAvatar) profileAvatar.textContent = initialsFor(profileInfo && profileInfo.displayName ? profileInfo.displayName : '', user.email || '');
    if (profileName) profileName.textContent = (profileInfo && profileInfo.displayName) ? String(profileInfo.displayName) : (user.email || t('account.common.user_title', 'User'));
    if (profileEmail) profileEmail.textContent = user.email || '';
    if (profileBadges) {
      const badges = [];
      badges.push(`<span class="account-badge account-badge--accent">${escapeHtml(roleLabel(role || 'client'))}</span>`);
      if (meta.partner) badges.push(`<span class="account-badge">${escapeHtml(t('account.badge.partner', 'Partner tools enabled'))}</span>`);
      if (normalizeRole(role) === 'collaborator') badges.push(`<span class="account-badge">${escapeHtml(t('account.badge.scout', 'Street Scout'))}</span>`);
      if (normalizeRole(role) === 'developer') badges.push(`<span class="account-badge">${escapeHtml(t('account.badge.newbuilds', 'New builds'))}</span>`);
      profileBadges.innerHTML = badges.join('');
    }
    if (profileNote) {
      const content = roleHubContentFor(role);
      profileNote.textContent = content && content.note ? String(content.note) : '';
    }

    renderRoleHub(role);

    if (quicksharePanel) {
      setVisible(quicksharePanel, !!(meta && meta.partner));
      if (meta && meta.partner) wireQuickshare();
    }

    if (!activityWired && activityRefresh) {
      activityWired = true;
      activityRefresh.addEventListener('click', async () => {
        const c = getClient();
        if (!c || !dashboardUser) return;
        await loadActivity(c, dashboardUser, dashboardRole);
      });
    }
    if (client && activityGrid) {
      loadActivity(client, user, role);
    }

    // Saved requirements + new-match notifications.
    wireAlertsUi();
    refreshAlertsPanel(client, user);

    // Shop basket + purchase history.
    wireShopUi();
    refreshShopPanel(client, user);

    if (partnerTile) {
      const isPartner = meta && meta.partner;
      partnerTile.classList.toggle('account-tile--disabled', !isPartner);
      if (partnerK && partnerV && partnerDesc) {
        if (role === 'developer') {
          partnerK.textContent = t('account.partner.developer.k', 'Developer tools');
          partnerV.textContent = t('account.partner.developer.v', 'Developments & collaboration');
          partnerDesc.textContent = t('account.partner.developer.d', 'Share projects, control branding, and coordinate viewings.');
        } else if (role === 'agency_admin' || role === 'agent') {
          partnerK.textContent = t('account.partner.agency.k', 'Agency tools');
          partnerV.textContent = t('account.partner.agency.v', 'White-label & collaboration');
          partnerDesc.textContent = t('account.partner.agency.d', 'Share listings with your clients and keep your branding.');
        } else if (role === 'collaborator' || role === 'partner') {
          partnerK.textContent = t('account.partner.partner.k', 'Partner tools');
          partnerV.textContent = t('account.partner.partner.v', 'White-label & collaboration');
          partnerDesc.textContent = t('account.partner.partner.d', 'Brochures, links, and collaboration tools for partners.');
        } else if (role === 'admin') {
          partnerK.textContent = t('account.partner.admin.k', 'Collaboration');
          partnerV.textContent = t('account.partner.admin.v', 'White-label & partners');
          partnerDesc.textContent = t('account.partner.admin.d', 'Tools and flows used by agencies, agents and developers.');
        } else {
          partnerK.textContent = t('account.partner.default.k', 'Partner access');
          partnerV.textContent = t('account.partner.default.v', 'Request collaboration');
          partnerDesc.textContent = t('account.partner.default.d', 'If you are an agency, agent or developer, ask us to enable partner tools.');
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
      setStatus(
        t('account.status.connecting', 'Connecting...'),
        t('account.status.loading_auth', 'Loading authentication…')
      );
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
    setStatus(
      t('account.status.connecting', 'Connecting...'),
      t('account.status.loading_auth', 'Loading authentication…')
    );
    await refresh();
    await runDiagnostics();
  }

  if (signInForm) {
    signInForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const client = getClient();
      if (!client) {
        setStatus(
          t('account.status.supabase_not_ready_title', 'Supabase not ready'),
          t('account.status.supabase_not_ready_reload', 'Reload the page. If it persists, click Clear offline cache or open ?qa=1 for diagnostics.')
        );
        return;
      }
      const email = (signInEmail && signInEmail.value ? signInEmail.value : '').trim();
      const password = (signInPassword && signInPassword.value ? signInPassword.value : '').trim();
      if (!email || !password) return;

      setStatus(t('account.status.signing_in', 'Signing in…'));
      const btn = signInForm.querySelector('button[type=\"submit\"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = t('account.status.signing_in', 'Signing in…');
      }
      try {
        const { data, error } = await withTimeout(client.auth.signInWithPassword({ email, password }), AUTH_TIMEOUT_MS, 'Sign-in');
        if (error) {
          setStatus(
            t('account.status.signin_failed_title', 'Sign-in failed'),
            error.message || t('account.status.try_again', 'Please try again.')
          );
          return;
        }
        await refresh({ sessionOverride: data && data.session ? data.session : undefined });
        await runDiagnostics();
      } catch (error) {
        const msg = (error && error.message) ? String(error.message) : String(error);
        const lower = msg.toLowerCase();
        if (lower.includes('timed out') || lower.includes('abort')) {
          setStatus(
            t('account.status.signin_failed_title', 'Sign-in failed'),
            t('account.status.signin_timeout', 'Sign-in timed out. This is usually a network/VPN/ad-block issue reaching Supabase. Try “Reset login”, or switch network, then try again (open ?qa=1 for diagnostics).')
          );
        } else {
          setStatus(t('account.status.signin_failed_title', 'Sign-in failed'), msg);
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev || t('account.signin.button', 'Sign in');
        }
      }
    });
  }

  if (signUpForm) {
    signUpForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const client = getClient();
      if (!client) {
        setStatus(
          t('account.status.supabase_not_ready_title', 'Supabase not ready'),
          t('account.status.supabase_not_ready_reload', 'Reload the page. If it persists, click Clear offline cache or open ?qa=1 for diagnostics.')
        );
        return;
      }
      const email = (signUpEmail && signUpEmail.value ? signUpEmail.value : '').trim();
      const password = (signUpPassword && signUpPassword.value ? signUpPassword.value : '').trim();
      if (!email || !password) return;

      setStatus(t('account.status.creating_account', 'Creating account…'));
      const btn = signUpForm.querySelector('button[type=\"submit\"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = t('account.status.creating_short', 'Creating…');
      }
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      try {
        const { error } = await withTimeout(client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo }
        }), AUTH_TIMEOUT_MS, 'Sign-up');
        if (error) {
          setStatus(
            t('account.status.signup_failed_title', 'Sign-up failed'),
            error.message || t('account.status.try_again', 'Please try again.')
          );
          return;
        }
        setStatus(
          t('account.status.check_email_title', 'Check your email'),
          t('account.status.check_email_hint', 'Confirm your email address to finish creating your account.')
        );
        await refresh();
        await runDiagnostics();
      } catch (error) {
        setStatus(
          t('account.status.signup_failed_title', 'Sign-up failed'),
          (error && error.message) ? error.message : String(error)
        );
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev || t('account.signup.button', 'Create account');
        }
      }
    });
  }

  if (magicForm) {
    magicForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const client = getClient();
      if (!client) {
        setStatus(
          t('account.status.supabase_not_ready_title', 'Supabase not ready'),
          t('account.status.supabase_not_ready_reload', 'Reload the page. If it persists, click Clear offline cache or open ?qa=1 for diagnostics.')
        );
        return;
      }
      const email = (magicEmail && magicEmail.value ? magicEmail.value : '').trim();
      if (!email) return;

      const remaining = remainingMagicCooldownMs();
      if (remaining > 0) {
        setStatus(
          t('account.status.please_wait', 'Please wait'),
          t('account.status.magic_rate_limited', 'Magic links are rate-limited. Try again in {seconds}s.', { seconds: Math.ceil(remaining / 1000) })
        );
        updateMagicCooldownUi();
        return;
      }

      setStatus(t('account.status.sending_magic', 'Sending magic link…'));
      const btn = magicForm.querySelector('button[type=\"submit\"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = t('account.status.sending_short', 'Sending…');
        btn.dataset.busy = '1';
      }
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      try {
        const { error } = await withTimeout(client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo }
        }), AUTH_TIMEOUT_MS, 'Magic link');
        if (error) {
          const msg = error && error.message ? String(error.message) : t('account.status.try_again', 'Please try again.');
          if (msg.toLowerCase().includes('rate limit')) {
            setMagicCooldown(MAGIC_RATE_LIMIT_COOLDOWN_MS);
            setStatus(
              t('account.status.failed_send_link_title', 'Failed to send link'),
              t('account.status.email_rate_limit', 'Email rate limit exceeded. Wait a few minutes and try again. (To remove strict limits and improve deliverability, set a custom SMTP provider in Supabase Auth settings.)')
            );
          } else {
            setStatus(t('account.status.failed_send_link_title', 'Failed to send link'), msg);
          }
          return;
        }
        setMagicCooldown(MAGIC_COOLDOWN_MS);
        setStatus(
          t('account.status.link_sent_title', 'Link sent'),
          t('account.status.link_sent_hint', 'Check your inbox and click the sign-in link. If it does not log you in, add this page to Supabase Auth Redirect URLs.')
        );
      } catch (error) {
        const msg = (error && error.message) ? String(error.message) : String(error);
        const lower = msg.toLowerCase();
        if (lower.includes('timed out') || lower.includes('abort')) {
          setStatus(
            t('account.status.failed_send_link_title', 'Failed to send link'),
            t('account.status.magic_timeout', 'Magic link timed out. This is usually a network/VPN/ad-block issue reaching Supabase. Try “Reset login”, or switch network, then try again.')
          );
        } else {
          setStatus(t('account.status.failed_send_link_title', 'Failed to send link'), msg);
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev || t('account.magic.button', 'Send magic link');
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
        setStatus(
          t('account.status.supabase_not_ready_title', 'Supabase not ready'),
          t('account.status.supabase_not_ready_reload', 'Reload the page. If it persists, click Clear offline cache or open ?qa=1 for diagnostics.')
        );
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
        setStatus(
          t('account.status.please_wait', 'Please wait'),
          t('account.status.reset_rate_limited', 'Password reset emails are rate-limited. Try again in {seconds}s.', { seconds: Math.ceil(remaining / 1000) })
        );
        updateResetCooldownUi();
        return;
      }

      setStatus(t('account.status.sending_reset', 'Sending reset link…'));
      const btn = resetPasswordForm.querySelector('button[type="submit"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = t('account.status.sending_short', 'Sending…');
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
          const msg = error && error.message ? String(error.message) : t('account.status.try_again', 'Please try again.');
          if (msg.toLowerCase().includes('rate limit')) {
            setResetCooldown(RESET_RATE_LIMIT_COOLDOWN_MS);
            setStatus(
              t('account.status.failed_reset_title', 'Failed to send reset link'),
              t('account.status.email_rate_limit', 'Email rate limit exceeded. Wait a few minutes and try again. (To remove strict limits and improve deliverability, set a custom SMTP provider in Supabase Auth settings.)')
            );
          } else {
            setStatus(t('account.status.failed_reset_title', 'Failed to send reset link'), msg);
          }
          return;
        }
        setResetCooldown(RESET_COOLDOWN_MS);
        setStatus(
          t('account.status.reset_link_sent_title', 'Reset link sent'),
          t('account.status.reset_link_sent_hint', 'Check your inbox and click the link to set a new password.')
        );
      } catch (error) {
        const msg = (error && error.message) ? String(error.message) : String(error);
        const lower = msg.toLowerCase();
        if (lower.includes('timed out') || lower.includes('abort')) {
          setStatus(
            t('account.status.failed_reset_title', 'Failed to send reset link'),
            t('account.status.reset_timeout', 'Password reset timed out. This is usually a network/VPN/ad-block issue reaching Supabase. Try “Reset login”, or switch network, then try again.')
          );
        } else {
          setStatus(t('account.status.failed_reset_title', 'Failed to send reset link'), msg);
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev || t('account.reset.button', 'Send reset link');
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
        setStatus(
          t('account.status.supabase_not_ready_title', 'Supabase not ready'),
          t('account.status.reload_and_try_again', 'Reload the page and try again.')
        );
        return;
      }
      const p1 = (recoveryPassword && recoveryPassword.value ? recoveryPassword.value : '').trim();
      const p2 = (recoveryPassword2 && recoveryPassword2.value ? recoveryPassword2.value : '').trim();
      if (!p1 || !p2) return;
      if (p1.length < 8) {
        setStatus(
          t('account.status.password_update_failed_title', 'Password update failed'),
          t('account.status.password_min_length', 'Password must be at least 8 characters.')
        );
        return;
      }
      if (p1 !== p2) {
        setStatus(
          t('account.status.password_update_failed_title', 'Password update failed'),
          t('account.status.password_mismatch', 'Passwords do not match.')
        );
        return;
      }

      setStatus(t('account.status.updating_password', 'Updating password…'));
      const btn = recoveryForm.querySelector('button[type="submit"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = t('account.status.updating_short', 'Updating…');
      }
      try {
        const { error } = await withTimeout(
          client.auth.updateUser({ password: p1 }),
          AUTH_TIMEOUT_MS,
          'Update password'
        );
        if (error) {
          setStatus(
            t('account.status.password_update_failed_title', 'Password update failed'),
            error.message || t('account.status.try_again', 'Please try again.')
          );
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
        setStatus(
          t('account.status.password_updated_title', 'Password updated'),
          t('account.status.password_updated_hint', 'You can now sign in with your new password on any device.')
        );
        await refresh();
        await runDiagnostics();
      } catch (error) {
        setStatus(
          t('account.status.password_update_failed_title', 'Password update failed'),
          (error && error.message) ? error.message : String(error)
        );
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev || t('account.recovery.update', 'Update password');
        }
      }
    });
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      const client = getClient();
      if (!client) return;
      setStatus(t('account.status.signing_out', 'Signing out…'));
      await client.auth.signOut();
      await refresh({ sessionOverride: null });
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
