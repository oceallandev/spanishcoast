(() => {
  const authEl = document.getElementById('refmap-auth');
  const fileInput = document.getElementById('refmap-file');
  const pasteEl = document.getElementById('refmap-paste');
  const parseBtn = document.getElementById('refmap-parse');
  const importBtn = document.getElementById('refmap-import');
  const countEl = document.getElementById('refmap-count');
  const statusEl = document.getElementById('refmap-status');
  const previewBody = document.getElementById('refmap-preview-body');
  const lookupRefEl = document.getElementById('refmap-lookup-ref');
  const lookupBtn = document.getElementById('refmap-lookup-btn');
  const lookupOut = document.getElementById('refmap-lookup-out');

  const formatTemplate = (value, vars) => {
    const text = value == null ? '' : String(value);
    if (!vars || typeof vars !== 'object') return text;
    return text.replace(/\{(\w+)\}/g, (match, key) => (
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
    ));
  };

  const t = (key, fallback, vars) => {
    const k = String(key || '');
    try {
      if (window.SCP_I18N && typeof window.SCP_I18N.t === 'function') {
        const translated = window.SCP_I18N.t(k, vars);
        if (translated != null) {
          const out = String(translated);
          if (out && out !== k) return out;
        }
      }
    } catch {
      // ignore
    }
    if (fallback !== undefined) return formatTemplate(fallback, vars);
    return k;
  };

  const escapeHtml = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  const isAbortLikeError = (error) => {
    const msg = error && error.message ? String(error.message) : String(error || '');
    const lower = msg.toLowerCase();
    return lower.includes('abort') || lower.includes('aborted') || lower.includes('signal');
  };

  async function getSessionSafe(client, { retries = 2 } = {}) {
    if (!client) return { data: { session: null } };
    let lastErr = null;
    for (let i = 0; i <= retries; i++) {
      try {
        return await client.auth.getSession();
      } catch (error) {
        lastErr = error;
        if (i < retries && isAbortLikeError(error)) {
          await sleep(140 * (i + 1));
          continue;
        }
        throw error;
      }
    }
    throw lastErr || new Error('Failed to read session');
  }

  const setStatus = (text, { kind = '' } = {}) => {
    if (!statusEl) return;
    statusEl.textContent = String(text || '');
    statusEl.classList.remove('is-ok', 'is-error', 'is-warn');
    if (kind === 'ok') statusEl.classList.add('is-ok');
    if (kind === 'error') statusEl.classList.add('is-error');
    if (kind === 'warn') statusEl.classList.add('is-warn');
  };

  const setAuth = (text) => {
    if (authEl) authEl.textContent = String(text || '');
  };

  const normalizeHeader = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

  const normalizeScpRef = (raw) => {
    // Normalize common copy/paste issues (unicode dashes, missing dash, stray whitespace).
    let s = String(raw || '').trim();
    if (!s) return '';
    s = s.replace(/[‐‑‒–—−]/g, '-'); // normalize unicode dashes
    s = s.replace(/\s+/g, '');
    s = s.toUpperCase();
    // Allow "SCP2932" -> "SCP-2932"
    if (/^SCP\d+$/.test(s)) s = s.replace(/^SCP(\d+)$/, 'SCP-$1');
    // Allow "SCP_2932" / "SCP 2932" -> "SCP-2932"
    if (/^SCP[-_]\d+$/.test(s)) s = s.replace(/^SCP[-_](\d+)$/, 'SCP-$1');
    return s;
  };

  const parseCsvLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
        continue;
      }
      if (ch === '"') {
        inQuotes = true;
        continue;
      }
      if (ch === ',') {
        out.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out.map((v) => (v == null ? '' : String(v)).trim());
  };

  const pickHeaderIndex = (headers, aliases) => {
    const set = new Set(aliases.map((v) => normalizeHeader(v)));
    for (let i = 0; i < headers.length; i++) {
      if (set.has(normalizeHeader(headers[i]))) return i;
    }
    return -1;
  };

  const detectDelimiter = (text) => {
    // If the first non-empty line contains no commas but has semicolons, treat as semicolon CSV.
    const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return ',';
    const sample = lines[0];
    if (!sample.includes(',') && sample.includes(';')) return ';';
    return ',';
  };

  const parseCsvText = (rawText) => {
    const text = String(rawText || '').replace(/^\uFEFF/, '');
    const delim = detectDelimiter(text);
    const splitLine = (line) => (delim === ',' ? parseCsvLine(line) : line.split(';').map((v) => String(v || '').trim()));

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
    if (!lines.length) return { rows: [], warnings: [t('refmap.warn.empty', 'No CSV rows found.')] };

    const first = splitLine(lines[0]);
    const firstNorm = first.map(normalizeHeader);
    const hasHeader = firstNorm.includes('scp_ref') || (firstNorm.includes('original_ref') && firstNorm.includes('source'));

    const headers = hasHeader ? first : [];
    const idxScp = hasHeader ? pickHeaderIndex(headers, ['scp_ref', 'scp ref', 'scp', 'ref']) : 0;
    const idxSource = hasHeader ? pickHeaderIndex(headers, ['source', 'provider', 'feed_source', 'feed']) : 1;
    const idxOrig = hasHeader ? pickHeaderIndex(headers, ['original_ref', 'original ref', 'external_ref', 'source_ref']) : 2;
    const idxOrigId = hasHeader ? pickHeaderIndex(headers, ['original_id', 'original id', 'external_id', 'source_id', 'feed_id']) : 3;

    const warnings = [];
    if (idxScp < 0 || idxOrig < 0) {
      warnings.push(t('refmap.warn.header', 'Header detected but required columns were not found. Expected scp_ref + original_ref.'));
    }

    const start = hasHeader ? 1 : 0;
    const byScp = new Map();
    for (let i = start; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      const scpRaw = idxScp >= 0 ? (cols[idxScp] || '') : (cols[0] || '');
      const origRaw = idxOrig >= 0 ? (cols[idxOrig] || '') : (cols[2] || '');
      if (!scpRaw || !origRaw) continue;
      const scp = normalizeScpRef(scpRaw);
      const original_ref = String(origRaw).trim();
      if (!scp || !original_ref) continue;

      const sourceRaw = idxSource >= 0 ? (cols[idxSource] || '') : (cols[1] || '');
      const originalIdRaw = idxOrigId >= 0 ? (cols[idxOrigId] || '') : (cols[3] || '');
      const source = String(sourceRaw || 'inmovilla').trim() || 'inmovilla';
      const original_id = String(originalIdRaw || '').trim() || null;

      // Validate refs like "SCP-2932". (Note: RegExp literals don't need \\d escaping.)
      if (!/^SCP-\d+$/i.test(scp)) {
        warnings.push(t('refmap.warn.scp_format', 'Skipping row with invalid SCP ref: {ref}', { ref: scp }));
        continue;
      }
      byScp.set(scp, { scp_ref: scp, source, original_ref, original_id });
    }

    return { rows: Array.from(byScp.values()), warnings };
  };

  const renderPreview = (rows) => {
    if (countEl) countEl.textContent = String(Array.isArray(rows) ? rows.length : 0);
    if (!previewBody) return;
    const safeRows = Array.isArray(rows) ? rows.slice(0, 20) : [];
    previewBody.innerHTML = safeRows.map((row) => `
      <tr>
        <td><code>${escapeHtml(row.scp_ref)}</code></td>
        <td>${escapeHtml(row.source || '')}</td>
        <td><code>${escapeHtml(row.original_ref || '')}</code></td>
        <td>${row.original_id ? `<code>${escapeHtml(row.original_id)}</code>` : '<span class="muted">—</span>'}</td>
      </tr>
    `).join('');
  };

  let parsedRows = [];
  let isAdmin = false;
  let sessionUser = null;

  const ensureAdmin = async (client) => {
    const { data } = await getSessionSafe(client);
    const session = data && data.session ? data.session : null;
    const user = session && session.user ? session.user : null;
    sessionUser = user;
    if (!user) {
      isAdmin = false;
      setAuth(t('refmap.auth.signed_out', 'Signed out. Sign in on the Account page first.'));
      if (importBtn) importBtn.disabled = true;
      return;
    }
    let role = '';
    try {
      const { data: profile, error } = await client
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!error && profile && profile.role) role = String(profile.role || '').trim();
    } catch {
      role = '';
    }
    const normalized = String(role || '').trim().toLowerCase();
    isAdmin = normalized === 'admin';
    setAuth(isAdmin
      ? t('refmap.auth.admin', 'Signed in as {email} (admin).', { email: user.email || 'admin' })
      : t('refmap.auth.not_admin', 'Signed in as {email}. Admin role required for import.', { email: user.email || 'user' })
    );
    if (importBtn) importBtn.disabled = !(isAdmin && parsedRows.length);
  };

  const readSelectedFile = async () => {
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!file) return '';
    try {
      return await file.text();
    } catch (error) {
      setStatus(t('refmap.error.read_failed', 'Failed to read file.'), { kind: 'error' });
      return '';
    }
  };

  const parseInput = async () => {
    const fileText = await readSelectedFile();
    const pasteText = pasteEl ? String(pasteEl.value || '') : '';
    const text = pasteText.trim() ? pasteText : fileText;
    const { rows, warnings } = parseCsvText(text);
    parsedRows = rows;
    renderPreview(parsedRows);
    if (warnings && warnings.length) {
      setStatus(warnings.slice(0, 4).join('\n'), { kind: 'warn' });
    } else {
      setStatus(t('refmap.status.parsed', 'Parsed {count} rows.', { count: rows.length }), { kind: rows.length ? 'ok' : 'warn' });
    }
    const client = window.scpSupabase || null;
    if (client) await ensureAdmin(client);
  };

  const importRows = async () => {
    const client = window.scpSupabase || null;
    if (!client) {
      setStatus(t('refmap.error.no_supabase', 'Supabase is not configured on this site.'), { kind: 'error' });
      return;
    }
    await ensureAdmin(client);
    if (!sessionUser || !isAdmin) {
      setStatus(t('refmap.error.admin_required', 'Admin session required.'), { kind: 'error' });
      return;
    }
    if (!parsedRows.length) {
      setStatus(t('refmap.error.no_rows', 'Nothing to import. Parse a CSV first.'), { kind: 'warn' });
      return;
    }

    const BATCH = 200;
    let imported = 0;
    if (importBtn) {
      importBtn.disabled = true;
      importBtn.textContent = t('refmap.import.running', 'Importing…');
    }
    try {
      for (let i = 0; i < parsedRows.length; i += BATCH) {
        const batch = parsedRows.slice(i, i + BATCH);
        const { error } = await client
          .from('listing_ref_map')
          .upsert(batch, { onConflict: 'scp_ref' });
        if (error) throw error;
        imported += batch.length;
        setStatus(t('refmap.status.progress', 'Imported {count}/{total}…', { count: imported, total: parsedRows.length }));
        await sleep(90);
      }
      setStatus(t('refmap.status.done', 'Import complete. {count} rows upserted.', { count: imported }), { kind: 'ok' });
    } catch (error) {
      setStatus(
        t('refmap.error.import_failed', 'Import failed: {error}', { error: (error && error.message) ? error.message : String(error) }),
        { kind: 'error' }
      );
    } finally {
      if (importBtn) {
        importBtn.textContent = t('refmap.import.btn', 'Import to Supabase');
        importBtn.disabled = !(isAdmin && parsedRows.length);
      }
    }
  };

  const lookup = async () => {
    const client = window.scpSupabase || null;
    if (!client) return;
    const ref = lookupRefEl ? normalizeScpRef(lookupRefEl.value || '') : '';
    if (!ref) return;
    if (lookupOut) lookupOut.textContent = t('refmap.lookup.loading', 'Looking up…');
    try {
      const { data, error } = await client
        .from('listing_ref_map')
        .select('scp_ref,source,original_ref,original_id')
        .eq('scp_ref', ref)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        if (lookupOut) lookupOut.textContent = t('refmap.lookup.not_found', 'Not found. (Did you import it yet?)');
        return;
      }
      if (lookupOut) {
        lookupOut.textContent = [
          `scp_ref: ${data.scp_ref || ''}`,
          `source: ${data.source || ''}`,
          `original_ref: ${data.original_ref || ''}`,
          `original_id: ${data.original_id || ''}`
        ].join('\n');
      }
    } catch (error) {
      if (lookupOut) lookupOut.textContent = t(
        'refmap.lookup.failed',
        'Lookup failed: {error}',
        { error: (error && error.message) ? error.message : String(error) }
      );
    }
  };

  if (parseBtn) parseBtn.addEventListener('click', () => { parseInput(); });
  if (importBtn) importBtn.addEventListener('click', () => { importRows(); });
  if (lookupBtn) lookupBtn.addEventListener('click', () => { lookup(); });

  if (lookupRefEl) {
    lookupRefEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        lookup();
      }
    });
  }

  const boot = async () => {
    const client = window.scpSupabase || null;
    if (!client) {
      setAuth(t('refmap.auth.no_supabase', 'Supabase not configured (config.js missing?).'));
      setStatus(t('refmap.error.no_supabase', 'Supabase is not configured on this site.'), { kind: 'error' });
      return;
    }
    setAuth(t('refmap.auth.checking', 'Checking session…'));
    try {
      await ensureAdmin(client);
      setStatus(t('refmap.status.ready', 'Ready. Upload or paste a CSV, then Parse.'), { kind: 'ok' });
    } catch (error) {
      setAuth(t('refmap.auth.failed', 'Failed to check session.'));
      setStatus(String(error && error.message ? error.message : error), { kind: 'error' });
    }

    try {
      client.auth.onAuthStateChange(() => {
        parsedRows = [];
        renderPreview([]);
        if (countEl) countEl.textContent = '0';
        ensureAdmin(client);
      });
    } catch {
      // ignore
    }
  };

  boot();
})();
