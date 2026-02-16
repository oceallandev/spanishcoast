/**
 * Spanish Coast Properties - Affiliate Tracking Module
 * Consolidated logic from site.js and supabase-init.js
 */
window.SCP_AFFILIATE = (() => {
    const sanitize = (raw) => String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    const STORAGE_KEYS = {
        code: 'scp:aff:code',
        ts: 'scp:aff:ts',
        landing: 'scp:aff:landing',
        claimedBy: 'scp:aff:claimed_by',
        claimedAt: 'scp:aff:claimed_at'
    };

    const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

    const storage = (() => {
        try {
            const s = window.localStorage;
            const k = '__scp_test__';
            s.setItem(k, '1');
            s.removeItem(k);
            return s;
        } catch {
            return null;
        }
    })();

    let mem = { code: '', ts: 0, landing: '', claimedBy: '', claimedAt: 0 };

    const read = () => {
        const now = Date.now();
        if (storage) {
            try {
                const code = sanitize(storage.getItem(STORAGE_KEYS.code));
                const ts = Number(storage.getItem(STORAGE_KEYS.ts) || 0);
                if (code && ts && (now - ts <= MAX_AGE_MS)) {
                    return {
                        code,
                        ts,
                        landing: storage.getItem(STORAGE_KEYS.landing) || '',
                        claimedBy: storage.getItem(STORAGE_KEYS.claimedBy) || '',
                        claimedAt: Number(storage.getItem(STORAGE_KEYS.claimedAt) || 0)
                    };
                }
            } catch { }
        }
        if (mem.code && (now - mem.ts <= MAX_AGE_MS)) return { ...mem };
        return null;
    };

    const write = (code, { landing = '' } = {}) => {
        const clean = sanitize(code);
        if (!clean || clean.length < 6 || clean.length > 16) return false;

        const now = Date.now();
        mem = { code: clean, ts: now, landing, claimedBy: '', claimedAt: 0 };

        if (storage) {
            try {
                storage.setItem(STORAGE_KEYS.code, clean);
                storage.setItem(STORAGE_KEYS.ts, String(now));
                if (landing) storage.setItem(STORAGE_KEYS.landing, landing);
                else storage.removeItem(STORAGE_KEYS.landing);
                storage.removeItem(STORAGE_KEYS.claimedBy);
                storage.removeItem(STORAGE_KEYS.claimedAt);
            } catch { }
        }
        return true;
    };

    const captureFromUrl = () => {
        try {
            const url = new URL(window.location.href);
            const code = sanitize(url.searchParams.get('aff'));
            if (code) {
                write(code, { landing: url.pathname + url.search });
                return code;
            }
        } catch { }
        return '';
    };

    // Initialize
    captureFromUrl();

    return {
        sanitizeCode: sanitize,
        captureFromUrl,
        getAttribution: read,
        getAttributionCode: () => {
            const info = read();
            return info ? info.code : '';
        },
        markClaimed: (userId) => {
            const uid = String(userId || '').trim();
            if (!uid) return;
            mem.claimedBy = uid;
            mem.claimedAt = Date.now();
            if (storage) {
                try {
                    storage.setItem(STORAGE_KEYS.claimedBy, uid);
                    storage.setItem(STORAGE_KEYS.claimedAt, String(Date.now()));
                } catch { }
            }
        },
        shouldAttemptClaim: (userId) => {
            const info = read();
            if (!info || !info.code || !userId) return false;
            return info.claimedBy !== String(userId);
        },
        appendToUrl: (href, code) => {
            const clean = sanitize(code);
            if (!clean) return href;
            try {
                const url = new URL(href, window.location.href);
                url.searchParams.set('aff', clean);
                return url.toString();
            } catch {
                return href;
            }
        }
    };
})();
