(() => {
  const statusText = document.getElementById('status-text');
  const statusHint = document.getElementById('status-hint');
  const signOutBtn = document.getElementById('sign-out-btn');
  const adminLinks = document.getElementById('admin-links');

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

  async function getRole(client, userId) {
    try {
      const { data, error } = await client.from('profiles').select('role').eq('user_id', userId).maybeSingle();
      if (error) return '';
      return (data && data.role) ? String(data.role) : '';
    } catch {
      return '';
    }
  }

  async function refresh() {
    const client = getClient();
    if (!client) {
      setStatus('Supabase is not configured.', 'Fill `config.js` with your Supabase URL + anon key.');
      if (signOutBtn) signOutBtn.disabled = true;
      return;
    }

    const { data } = await client.auth.getSession();
    const session = data && data.session ? data.session : null;
    const user = session && session.user ? session.user : null;

    if (!user) {
      setStatus('Signed out', 'Sign in to sync favourites across devices.');
      if (signOutBtn) signOutBtn.disabled = true;
      if (adminLinks) adminLinks.style.display = 'none';
      return;
    }

    const role = await getRole(client, user.id);
    setStatus(`Signed in as ${user.email || 'user'}${role ? ` (${role})` : ''}`, 'Your favourites will sync to this account on the Properties page.');
    if (signOutBtn) signOutBtn.disabled = false;
    if (adminLinks) adminLinks.style.display = role === 'admin' ? 'block' : 'none';
  }

  async function ensureLoaded() {
    // Wait briefly for supabase-init.js.
    if (window.scpSupabase || (window.SCP_CONFIG && window.SCP_CONFIG.supabaseUrl)) {
      await refresh();
      return;
    }
    window.addEventListener('scp:supabase:ready', () => refresh(), { once: true });
    setStatus('Connecting...', 'Loading authentication…');
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
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus('Sign-in failed', error.message || 'Please try again.');
        return;
      }
      await refresh();
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
      const { error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo }
      });
      if (error) {
        setStatus('Sign-up failed', error.message || 'Please try again.');
        return;
      }
      setStatus('Check your email', 'Confirm your email address to finish creating your account.');
      await refresh();
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
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo }
      });
      if (error) {
        setStatus('Failed to send link', error.message || 'Please try again.');
        return;
      }
      setStatus('Link sent', 'Check your inbox and click the sign-in link.');
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
    client.auth.onAuthStateChange(() => refresh());
  } else {
    window.addEventListener('scp:supabase:ready', () => {
      const c = getClient();
      if (c) c.auth.onAuthStateChange(() => refresh());
    }, { once: true });
  }

  ensureLoaded();
})();

