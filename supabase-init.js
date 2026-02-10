// Initialize a global Supabase client if configured.
// Exposes `window.scpSupabase` (or null when disabled).
(() => {
  const cfg = window.SCP_CONFIG || {};
  const url = (cfg.supabaseUrl || '').trim();
  const anonKey = (cfg.supabaseAnonKey || '').trim();
  let safeStorage;
  try {
    safeStorage = window.localStorage;
  } catch {
    safeStorage = undefined;
  }

  const ready = (enabled, error) => {
    try {
      window.scpSupabaseStatus = { enabled: Boolean(enabled), error: error || null };
      window.dispatchEvent(new CustomEvent('scp:supabase:ready', { detail: { enabled, error: error || null } }));
    } catch {
      // ignore
    }
  };

  if (!url || !anonKey) {
    window.scpSupabase = null;
    ready(false);
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    window.scpSupabase = null;
    ready(false, 'supabase-js not loaded');
    return;
  }

  try {
    const auth = {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    };
    // Be explicit about the storage we want so sessions persist across reloads.
    // (Some browsers can throw when accessing localStorage in strict/private modes.)
    if (safeStorage) auth.storage = safeStorage;

    window.scpSupabase = window.supabase.createClient(url, anonKey, { auth });
    ready(true);
  } catch (error) {
    window.scpSupabase = null;
    ready(false, error && error.message ? error.message : String(error));
  }
})();
