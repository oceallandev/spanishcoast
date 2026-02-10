// Initialize a global Supabase client if configured.
// Exposes `window.scpSupabase` (or null when disabled).
(() => {
  const cfg = window.SCP_CONFIG || {};
  const url = (cfg.supabaseUrl || '').trim();
  const anonKey = (cfg.supabaseAnonKey || '').trim();
  const REQUEST_TIMEOUT_MS = 25000;

  // Some browsers/networks can hang a fetch indefinitely. Provide a safety timeout so auth actions
  // fail fast and the UI can recover (instead of staying stuck on "Signing in…").
  const fetchWithTimeout = (input, init) => {
    const baseFetch = (typeof fetch === 'function') ? fetch : null;
    if (!baseFetch) {
      throw new Error('fetch is not available in this browser');
    }
    if (typeof AbortController === 'undefined') {
      return baseFetch(input, init);
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const opts = init ? { ...init } : {};

    if (opts.signal) {
      // Preserve caller cancellation; add our timeout when supported.
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
        opts.signal = AbortSignal.any([opts.signal, controller.signal]);
      } else {
        // Cannot merge signals in this browser; fall back to caller signal without our timeout.
        window.clearTimeout(timeoutId);
      }
    } else {
      opts.signal = controller.signal;
    }

    return baseFetch(input, opts).finally(() => window.clearTimeout(timeoutId));
  };

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
    window.scpSupabase = window.supabase.createClient(url, anonKey, {
      global: {
        fetch: fetchWithTimeout
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    ready(true);
  } catch (error) {
    window.scpSupabase = null;
    ready(false, error && error.message ? error.message : String(error));
  }
})();
