(() => {
  const statusText = document.getElementById('status-text');
  const statusHint = document.getElementById('status-hint');
  const signOutBtn = document.getElementById('sign-out-btn');
  const adminLinks = document.getElementById('admin-links');
  const diagnosticsPanel = document.getElementById('diagnostics');
  const diagLines = document.getElementById('diag-lines');

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
  };

  const getClient = () => window.scpSupabase || null;

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

  async function getRoleInfo(client, userId) {
    try {
      const { data, error } = await client.from('profiles').select('role').eq('user_id', userId).maybeSingle();
      if (error) return { role: '', error: error.message || String(error) };
      return { role: (data && data.role) ? String(data.role) : '', error: '' };
    } catch {
      return { role: '', error: 'profiles lookup failed' };
    }
  }

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
      if (adminLinks) adminLinks.style.display = 'none';
      return;
    }

    const roleInfo = await getRoleInfo(client, user.id);
    const role = roleInfo && roleInfo.role ? roleInfo.role : '';
    const roleSuffix = role ? ` (${role})` : '';
    const roleHint = !role && roleInfo && roleInfo.error ? ` Role unavailable: ${roleInfo.error}` : '';
    setStatus(
      `Signed in as ${user.email || 'user'}${roleSuffix}`,
      `Your favourites will sync to this account on the Properties page.${roleHint}`
    );
    if (signOutBtn) signOutBtn.disabled = false;
    if (adminLinks) adminLinks.style.display = role === 'admin' ? 'block' : 'none';
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
      if (!client) return;
      const email = (signInEmail && signInEmail.value ? signInEmail.value : '').trim();
      const password = (signInPassword && signInPassword.value ? signInPassword.value : '').trim();
      if (!email || !password) return;

      setStatus('Signing in…');
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
      }
    });
  }

  if (signUpForm) {
    signUpForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const client = getClient();
      if (!client) return;
      const email = (signUpEmail && signUpEmail.value ? signUpEmail.value : '').trim();
      const password = (signUpPassword && signUpPassword.value ? signUpPassword.value : '').trim();
      if (!email || !password) return;

      setStatus('Creating account…');
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
      }
    });
  }

  if (magicForm) {
    magicForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const client = getClient();
      if (!client) return;
      const email = (magicEmail && magicEmail.value ? magicEmail.value : '').trim();
      if (!email) return;
      setStatus('Sending magic link…');
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
        setStatus('Link sent', 'Check your inbox and click the sign-in link.');
      } catch (error) {
        setStatus('Failed to send link', (error && error.message) ? error.message : String(error));
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
