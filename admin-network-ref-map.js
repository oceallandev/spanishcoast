(() => {
  const authEl = document.getElementById('netrefmap-auth');
  const fileInput = document.getElementById('netrefmap-file');
  const pasteEl = document.getElementById('netrefmap-paste');
  const parseBtn = document.getElementById('netrefmap-parse');
  const importBtn = document.getElementById('netrefmap-import');
  const countEl = document.getElementById('netrefmap-count');
  const statusEl = document.getElementById('netrefmap-status');
  const previewBody = document.getElementById('netrefmap-preview-body');
  const lookupRefEl = document.getElementById('netrefmap-lookup-ref');
  const lookupBtn = document.getElementById('netrefmap-lookup-btn');
  const lookupOut = document.getElementById('netrefmap-lookup-out');

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

  const titleCase = (value) => {
    const s = String(value || '').trim().toLowerCase();
    if (!s) return '';
    return s.slice(0, 1).toUpperCase() + s.slice(1);
  };

  const normalizeNetworkScpRef = (raw) => {
    // Canonicalize "scp-dev-5" => "SCP-Dev-0005" so it matches what the UI expects.
    let s = String(raw || '').trim();
    if (!s) return '';
    s = s.replace(/[‐‑‒–—−]/g, '-'); // normalize unicode dashes
    s = s.replace(/\s+/g, '');
    const m = s.match(/^scp[-_]?([a-z]{3})[-_]?(\d+)$/i) || s.match(/^scp-([a-z]{3})-(\d+)$/i);
    if (m) {
      const pref = titleCase(m[1]);
      const num = String(m[2] || '').replace(/[^\d]/g, '');
      if (!num) return '';
      return `SCP-${pref}-${num.padStart(4, '0')}`;
    }
    const m2 = s.match(/^scp-([a-z]{3})-(\d{1,6})$/i);
    if (m2) {
      const pref = titleCase(m2[1]);
      const num = String(m2[2] || '').replace(/[^\d]/g, '');
      if (!num) return '';
      return `SCP-${pref}-${num.padStart(4, '0')}`;
    }
    // If it's already in canonical-ish form, normalize prefix case and pad.
    const m3 = s.match(/^SCP-([A-Za-z]{3})-(\d{1,6})$/);
    if (m3) {
      const pref = titleCase(m3[1]);
      const num = String(m3[2] || '').replace(/[^\d]/g, '');
      if (!num) return '';
      return `SCP-${pref}-${num.padStart(4, '0')}`;
    }
    return String(raw || '').trim();
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
    const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return ',';
    const sample = lines[0];
    if (!sample.includes(',') && sample.includes(';')) return ';';
    return ',';
  };

  const normalizeKind = (raw) => String(raw || '').trim().toLowerCase();
  const allowedKinds = new Set(['agency', 'agent', 'developer', 'development', 'collaborator']);

  const parseCsvText = (rawText) => {
    const text = String(rawText || '').replace(/^\uFEFF/, '');
    const delim = detectDelimiter(text);
    const splitLine = (line) => (delim === ',' ? parseCsvLine(line) : line.split(';').map((v) => String(v || '').trim()));

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
    if (!lines.length) return { rows: [], warnings: [t('netrefmap.warn.empty', 'No CSV rows found.')] };

    const first = splitLine(lines[0]);
    const firstNorm = first.map(normalizeHeader);
    const hasHeader = firstNorm.includes('scp_ref') || (firstNorm.includes('original_ref') && firstNorm.includes('kind'));

    const headers = hasHeader ? first : [];
    const idxScp = hasHeader ? pickHeaderIndex(headers, ['scp_ref', 'scp ref', 'scp', 'ref']) : 0;
    const idxKind = hasHeader ? pickHeaderIndex(headers, ['kind', 'type']) : 1;
    const idxSource = hasHeader ? pickHeaderIndex(headers, ['source', 'provider', 'feed_source', 'feed']) : 2;
    const idxOrig = hasHeader ? pickHeaderIndex(headers, ['original_ref', 'original ref', 'external_ref', 'source_ref']) : 3;
    const idxOrigId = hasHeader ? pickHeaderIndex(headers, ['original_id', 'original id', 'external_id', 'source_id', 'feed_id']) : 4;

    const warnings = [];
    if (idxScp < 0 || idxOrig < 0 || idxKind < 0) {
      warnings.push(t('netrefmap.warn.header', 'Header detected but required columns were not found. Expected scp_ref + kind + original_ref.'));
    }

    const start = hasHeader ? 1 : 0;
    const byScp = new Map();
    for (let i = start; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      const scpRaw = idxScp >= 0 ? (cols[idxScp] || '') : (cols[0] || '');
      const kindRaw = idxKind >= 0 ? (cols[idxKind] || '') : (cols[1] || '');
      const origRaw = idxOrig >= 0 ? (cols[idxOrig] || '') : (cols[3] || '');
      if (!scpRaw || !kindRaw || !origRaw) continue;

      const scp_ref = normalizeNetworkScpRef(scpRaw);
      const kind = normalizeKind(kindRaw);
      const original_ref = String(origRaw).trim();
      if (!scp_ref || !kind || !original_ref) continue;

      const sourceRaw = idxSource >= 0 ? (cols[idxSource] || '') : (cols[2] || '');
      const originalIdRaw = idxOrigId >= 0 ? (cols[idxOrigId] || '') : (cols[4] || '');
      const source = String(sourceRaw || 'redsp1').trim() || 'redsp1';
      const original_id = String(originalIdRaw || '').trim() || null;

      if (!/^SCP-[A-Za-z]{3}-\d{4}$/i.test(scp_ref)) {
        warnings.push(t('netrefmap.warn.scp_format', 'Skipping row with invalid SCP ref: {ref}', { ref: scp_ref }));
        continue;
      }
      if (!allowedKinds.has(kind)) {
        warnings.push(t('netrefmap.warn.kind_format', 'Skipping row with invalid kind: {kind}', { kind }));
        continue;
      }
      byScp.set(scp_ref, { scp_ref, kind, source, original_ref, original_id });
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
        <td>${escapeHtml(row.kind || '')}</td>
        <td>${escapeHtml(row.source || '')}</td>
        <td><code>${escapeHtml(row.original_ref || '')}</code></td>
        <td>${row.original_id ? `<code>${escapeHtml(row.original_id)}</code>` : '<span class="muted">—</span>'}</td>
      </tr>
    `).join('');
  };

  let parsedRows = [];
  let isAdmin = false;

  const ensureAdmin = async (client) => {
    const { data } = await getSessionSafe(client);
    const session = data && data.session ? data.session : null;
    const user = session && session.user ? session.user : null;
    if (!user) {
      isAdmin = false;
      setAuth(t('netrefmap.auth.signed_out', 'Signed out. Sign in on the Account page first.'));
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
    isAdmin = String(role || '').trim().toLowerCase() === 'admin';
    setAuth(isAdmin
      ? t('netrefmap.auth.admin', 'Signed in as {email} (admin).', { email: user.email || 'admin' })
      : t('netrefmap.auth.not_admin', 'Signed in as {email}. Admin role required for import.', { email: user.email || 'user' })
    );
    if (importBtn) importBtn.disabled = !(isAdmin && parsedRows.length);
  };

  const readSelectedFile = async () => {
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!file) return '';
    try {
      return await file.text();
    } catch {
      setStatus(t('netrefmap.error.read_failed', 'Failed to read file.'), { kind: 'error' });
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
      setStatus(t('netrefmap.status.parsed', 'Parsed {count} rows. Ready to import.', { count: rows.length }), { kind: 'ok' });
    }
    if (importBtn) importBtn.disabled = !(isAdmin && parsedRows.length);
  };

  const importRows = async () => {
    const client = window.scpSupabase || null;
    if (!client) return;
    if (!isAdmin) {
      setStatus(t('netrefmap.error.not_admin', 'Admin role required.'), { kind: 'error' });
      return;
    }
    const rows = Array.isArray(parsedRows) ? parsedRows : [];
    if (!rows.length) return;

    if (importBtn) {
      importBtn.disabled = true;
      importBtn.textContent = t('netrefmap.importing', 'Importing…');
    }
    setStatus(t('netrefmap.status.importing', 'Importing {count} rows…', { count: rows.length }));

    try {
      const chunkSize = 250;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await client
          .from('network_profile_ref_map')
          .upsert(chunk, { onConflict: 'scp_ref' });
        if (error) throw error;
      }
      setStatus(t('netrefmap.status.done', 'Imported {count} rows.', { count: rows.length }), { kind: 'ok' });
    } catch (error) {
      setStatus(
        t('netrefmap.error.import_failed', 'Import failed: {error}', { error: (error && error.message) ? error.message : String(error) }),
        { kind: 'error' }
      );
    } finally {
      if (importBtn) {
        importBtn.textContent = t('netrefmap.import', 'Import to Supabase');
        importBtn.disabled = !(isAdmin && parsedRows.length);
      }
    }
  };

  const lookup = async () => {
    const client = window.scpSupabase || null;
    if (!client) return;
    const ref = lookupRefEl ? normalizeNetworkScpRef(lookupRefEl.value || '') : '';
    if (!ref) return;
    if (lookupOut) lookupOut.textContent = t('netrefmap.lookup.loading', 'Loading…');

    try {
      const { data, error } = await client
        .from('network_profile_ref_map')
        .select('scp_ref,kind,source,original_ref,original_id')
        .eq('scp_ref', ref)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        if (lookupOut) lookupOut.textContent = t('netrefmap.lookup.not_found', 'Not found. (Did you import it yet?)');
        return;
      }
      if (lookupOut) {
        lookupOut.textContent = [
          `scp_ref: ${data.scp_ref || ''}`,
          `kind: ${data.kind || ''}`,
          `source: ${data.source || ''}`,
          `original_ref: ${data.original_ref || ''}`,
          `original_id: ${data.original_id || ''}`
        ].join('\n');
      }
    } catch (error) {
      if (lookupOut) lookupOut.textContent = t(
        'netrefmap.lookup.failed',
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
      setAuth(t('netrefmap.auth.no_supabase', 'Supabase not configured (config.js missing?).'));
      setStatus(t('netrefmap.error.no_supabase', 'Supabase is not configured on this site.'), { kind: 'error' });
      return;
    }
    setAuth(t('netrefmap.auth.checking', 'Checking session…'));
    try {
      await ensureAdmin(client);
      setStatus(t('netrefmap.status.ready', 'Ready. Upload or paste a CSV, then Parse.'), { kind: 'ok' });
    } catch (error) {
      setAuth(t('netrefmap.auth.failed', 'Failed to check session.'));
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

