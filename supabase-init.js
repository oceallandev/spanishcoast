// Initialize a global Supabase client if configured.
// Exposes `window.scpSupabase` (or null when disabled).
(() => {
  const cfg = window.SCP_CONFIG || {};
  const url = (cfg.supabaseUrl || '').trim();
  const anonKey = (cfg.supabaseAnonKey || '').trim();
  const getStorage = (key) => {
    try {
      return window && window[key] ? window[key] : null;
    } catch {
      return null;
    }
  };

  const storageWritable = (storage) => {
    if (!storage) return false;
    try {
      const k = '__scp_storage_test__';
      storage.setItem(k, '1');
      storage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  };

  let safeStorage = null;
  let safeStorageType = '';
  const ls = getStorage('localStorage');
  if (storageWritable(ls)) {
    safeStorage = ls;
    safeStorageType = 'localStorage';
  } else {
    const ss = getStorage('sessionStorage');
    if (storageWritable(ss)) {
      safeStorage = ss;
      safeStorageType = 'sessionStorage';
    }
  }

  const ready = (enabled, error) => {
    try {
      const status = {
        enabled: Boolean(enabled),
        error: error || null,
        storage: safeStorageType || 'none',
        persistSession: Boolean(safeStorage),
        idb: null
      };
      window.scpSupabaseStatus = status;
      window.dispatchEvent(new CustomEvent('scp:supabase:ready', { detail: status }));
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
      persistSession: Boolean(safeStorage),
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
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
