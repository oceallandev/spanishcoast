(() => {
  const statusText = document.getElementById('status-text');
  const statusHint = document.getElementById('status-hint');
  const authStatus = document.getElementById('auth-status');
  const clearCacheAuthBtn = document.getElementById('clear-offline-cache-auth');
  const signOutBtn = document.getElementById('sign-out-btn');
  const authPanels = document.getElementById('auth-panels');
  const dashboardPanels = document.getElementById('dashboard-panels');
  const dashRole = document.getElementById('dash-role');
  const dashSavedCount = document.getElementById('dash-saved-count');
  const dashAdminTile = document.getElementById('dash-admin-tile');
  const dashCrmTile = document.getElementById('dash-crm-tile');
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

  const setStatus = (text, hint) => {
    if (statusText) statusText.textContent = text;
    if (statusHint) statusHint.textContent = hint || '';
    if (authStatus) {
      const msg = [text, hint].filter((v) => v != null && String(v).trim()).join('  ');
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
            15000,
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

  async function refresh() {
    const client = getClient();
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

    let data;
    try {
      ({ data } = await client.auth.getSession());
    } catch (error) {
      setStatus('Auth session failed', error && error.message ? error.message : String(error));
      if (signOutBtn) signOutBtn.disabled = true;
      return;
    }
    const session = data && data.session ? data.session : null;
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

    const client = getClient();
    addDiag(client ? 'ok' : 'bad', 'client init', client ? 'window.scpSupabase created.' : 'Supabase client not initialised (check config + CDN).');
    if (!client) return;

    let session;
    try {
      const { data } = await client.auth.getSession();
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
      await refresh();
      await runDiagnostics();
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
        const { error } = await withTimeout(client.auth.signInWithPassword({ email, password }), 15000, 'Sign-in');
        if (error) {
          setStatus('Sign-in failed', error.message || 'Please try again.');
          return;
        }
        await refresh();
        await runDiagnostics();
      } catch (error) {
        setStatus('Sign-in failed', (error && error.message) ? error.message : String(error));
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
        }), 15000, 'Sign-up');
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
      setStatus('Sending magic link…');
      const btn = magicForm.querySelector('button[type=\"submit\"]');
      const prev = btn ? btn.textContent : '';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Sending…';
      }
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      try {
        const { error } = await withTimeout(client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo }
        }), 15000, 'Magic link');
        if (error) {
          setStatus('Failed to send link', error.message || 'Please try again.');
          return;
        }
        setStatus('Link sent', 'Check your inbox and click the sign-in link. If it does not log you in, add this page to Supabase Auth Redirect URLs.');
      } catch (error) {
        setStatus('Failed to send link', (error && error.message) ? error.message : String(error));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prev || 'Send magic link';
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

  const client = getClient();
  if (client) {
    client.auth.onAuthStateChange(async () => {
      await refresh();
      await runDiagnostics(); // keep ?qa=1 panel in sync after signing in/out
    });
  } else {
    window.addEventListener('scp:supabase:ready', () => {
      const c = getClient();
      if (c) c.auth.onAuthStateChange(async () => {
        await refresh();
        await runDiagnostics();
      });
    }, { once: true });
  }

  ensureLoaded();
})();
