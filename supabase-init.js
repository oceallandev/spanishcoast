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

  const makeIdbStorage = (dbName, storeName) => {
    const openDb = () => new Promise((resolve, reject) => {
      try {
        if (!window.indexedDB || typeof window.indexedDB.open !== 'function') {
          reject(new Error('indexedDB not available'));
          return;
        }
        const req = window.indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => {
          try {
            const db = req.result;
            if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
          } catch {
            // ignore
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('indexedDB open failed'));
      } catch (e) {
        reject(e);
      }
    });

    // Cache the open promise so we don't open a new connection per operation.
    let dbP = null;
    const db = () => {
      if (!dbP) dbP = openDb();
      return dbP;
    };

    const withStore = async (mode, fn) => {
      try {
        const d = await db();
        const tx = d.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        return await fn(store);
      } catch {
        return null;
      }
    };

    const reqToPromise = (req) => new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });

    return {
      getItem: async (key) =>
        await withStore('readonly', async (store) => {
          const req = store.get(key);
          const res = await reqToPromise(req);
          return res == null ? null : String(res);
        }),
      setItem: async (key, value) => {
        await withStore('readwrite', async (store) => {
          const req = store.put(String(value), key);
          await reqToPromise(req);
          return null;
        });
      },
      removeItem: async (key) => {
        await withStore('readwrite', async (store) => {
          const req = store.delete(key);
          await reqToPromise(req);
          return null;
        });
      }
    };
  };

  const IDB_DB_NAME = 'scp-supabase-auth';
  const IDB_STORE_NAME = 'kv';

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
    } else if (typeof window !== 'undefined' && window.indexedDB) {
      // Final fallback: IndexedDB. Useful for browsers that block local/session storage in strict/private modes.
      safeStorage = makeIdbStorage(IDB_DB_NAME, IDB_STORE_NAME);
      safeStorageType = 'indexedDB';
    }
  }

  const ready = (enabled, error) => {
    try {
      const status = {
        enabled: Boolean(enabled),
        error: error || null,
        storage: safeStorageType || 'none',
        persistSession: Boolean(safeStorage),
        idb: safeStorageType === 'indexedDB'
          ? { dbName: IDB_DB_NAME, storeName: IDB_STORE_NAME }
          : null
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
