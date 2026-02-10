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
    // (commonly surfaced as: "signal is aborted without reason"). This most often comes from
    // Web Locks / AbortSignal timeouts. We patch defensively so auth.getSession() stays stable.

    // Best-effort patch: strip AbortSignal from Web Locks requests.
    try {
      const locks = (typeof navigator !== 'undefined' && navigator && navigator.locks) ? navigator.locks : null;
      if (locks && typeof locks.request === 'function' && !locks.request.__scpPatched) {
        const origRequest = locks.request.bind(locks);
        const wrapped = (name, options, callback) => {
          // Signature overloads:
          // - request(name, callback)
          // - request(name, options, callback)
          if (typeof options === 'function') {
            return origRequest(name, options);
          }
          const opts = (options && Object.prototype.toString.call(options) === '[object Object]')
            ? { ...options }
            : options;
          if (opts && typeof opts === 'object' && 'signal' in opts) {
            try { delete opts.signal; } catch { /* ignore */ }
          }
          return origRequest(name, opts, callback);
        };
        wrapped.__scpPatched = true;
        locks.request = wrapped;
      }
    } catch {
      // ignore
    }

    // Use an in-page lock as a fallback when the SDK supports it.
    let lockChain = Promise.resolve();
    const pageLock = async (...args) => {
      const fn = args && args.length ? args[args.length - 1] : null;
      if (typeof fn !== 'function') return null;
      const run = async () => await fn();
      const p = lockChain.then(run, run);
      lockChain = p.catch(() => {});
      return p;
    };

    // Strip AbortSignal from fetch requests used by Supabase. If a browser/extension aborts the
    // signal incorrectly, dropping it is safer than hard-failing auth/session checks.
    const safeFetch = nativeFetch
      ? (input, init) => {
        try {
          const isPlain = init && Object.prototype.toString.call(init) === '[object Object]';
          const opts = isPlain ? { ...init } : init;
          if (opts && typeof opts === 'object' && 'signal' in opts) {
            try { delete opts.signal; } catch { /* ignore */ }
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
