// Initialize a global Supabase client if configured.
// Exposes `window.scpSupabase` (or null when disabled).
(() => {
  const cfg = window.SCP_CONFIG || {};
  const url = (cfg.supabaseUrl || '').trim();
  const anonKey = (cfg.supabaseAnonKey || '').trim();
  const nativeFetch = (() => {
    try {
      return (window && typeof window.fetch === 'function') ? window.fetch.bind(window) : null;
    } catch {
      return null;
    }
  })();
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
    // Some browsers/extensions can cause AbortSignal-related failures inside Supabase auth
    // initialisation (e.g. Web Locks timing out). Use an in-page lock and a safe fetch wrapper
    // to avoid aborting the whole session check.
    let lockChain = Promise.resolve();
    const pageLock = async (...args) => {
      const fn = args && args.length ? args[args.length - 1] : null;
      if (typeof fn !== 'function') return null;
      const run = async () => await fn();
      const p = lockChain.then(run, run);
      lockChain = p.catch(() => {});
      return p;
    };

    const safeFetch = nativeFetch
      ? (input, init) => {
        try {
          const opts = init && typeof init === 'object' ? init : undefined;
          if (opts && opts.signal && opts.signal.aborted) {
            // If the signal is already aborted, drop it instead of failing immediately.
            const { signal, ...rest } = opts;
            return nativeFetch(input, rest);
          }
          return nativeFetch(input, opts);
        } catch {
          return nativeFetch(input, init);
        }
      }
      : undefined;

    const auth = {
      persistSession: Boolean(safeStorage),
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      lock: pageLock
    };
    // Be explicit about the storage we want so sessions persist across reloads.
    // (Some browsers can throw when accessing localStorage in strict/private modes.)
    if (safeStorage) auth.storage = safeStorage;

    const opts = safeFetch ? { auth, global: { fetch: safeFetch } } : { auth };
    window.scpSupabase = window.supabase.createClient(url, anonKey, opts);
    ready(true);
  } catch (error) {
    window.scpSupabase = null;
    ready(false, error && error.message ? error.message : String(error));
  }
})();
