(() => {
  const statusEl = document.getElementById('admin-status');
  const tbody = document.querySelector('#scout-table tbody');
  const refreshBtn = document.getElementById('refresh-btn');
  const csvBtn = document.getElementById('csv-btn');
  const statusFilter = document.getElementById('status-filter');

  const getClient = () => window.scpSupabase || null;

  const escape = (value) => {
    const s = value == null ? '' : String(value);
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  const debounce = (fn, delayMs) => {
    let t = 0;
    return (...args) => {
      try { window.clearTimeout(t); } catch { /* ignore */ }
      t = window.setTimeout(() => fn(...args), Math.max(0, Number(delayMs) || 0));
    };
  };

  const toCsvCell = (v) => {
    const s = v == null ? '' : String(v);
    const q = s.replace(/"/g, '""');
    return `"${q}"`;
  };

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text || '';
  };

  async function roleFor(client, userId) {
    try {
      const { data } = await client.from('profiles').select('role').eq('user_id', userId).maybeSingle();
      return data && data.role ? String(data.role) : '';
    } catch {
      return '';
    }
  }

  const formatEur = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '';
    return `€${v.toLocaleString('en-IE')}`;
  };

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  const mapUrl = (lat, lon) => `https://www.google.com/maps?q=${lat},${lon}`;

  let lastRows = [];
  let realtimeChannel = null;
  let lastSeenNewest = '';

  // --- Lightbox (photo preview) ---
  let scoutLightbox = null;
  let scoutLightboxImg = null;
  let scoutLightboxCaption = null;
  let scoutLightboxClose = null;
  let scoutLightboxUrl = '';

  function ensureLightbox() {
    if (scoutLightbox && scoutLightboxImg) return;

    scoutLightbox = document.createElement('div');
    scoutLightbox.className = 'lightbox';
    scoutLightbox.id = 'scout-lightbox';
    scoutLightbox.setAttribute('role', 'dialog');
    scoutLightbox.setAttribute('aria-modal', 'true');
    scoutLightbox.setAttribute('aria-label', 'Street Scout photo preview');

    scoutLightboxImg = document.createElement('img');
    scoutLightboxImg.id = 'scout-lightbox-img';
    scoutLightboxImg.alt = '';
    scoutLightboxImg.loading = 'eager';
    scoutLightboxImg.decoding = 'async';
    scoutLightboxImg.referrerPolicy = 'no-referrer';

    scoutLightboxCaption = document.createElement('div');
    scoutLightboxCaption.className = 'lightbox-caption';
    scoutLightboxCaption.id = 'scout-lightbox-caption';

    scoutLightboxClose = document.createElement('button');
    scoutLightboxClose.type = 'button';
    scoutLightboxClose.className = 'close-lightbox';
    scoutLightboxClose.setAttribute('aria-label', 'Close');
    scoutLightboxClose.textContent = '×';

    scoutLightbox.appendChild(scoutLightboxImg);
    document.body.appendChild(scoutLightbox);
    document.body.appendChild(scoutLightboxClose);
    document.body.appendChild(scoutLightboxCaption);

    const close = () => {
      if (!scoutLightbox) return;
      scoutLightbox.style.display = 'none';
      document.body.classList.remove('lightbox-open');
      scoutLightboxUrl = '';
      if (scoutLightboxImg) scoutLightboxImg.src = '';
      if (scoutLightboxCaption) scoutLightboxCaption.textContent = '';
    };

    scoutLightboxClose.addEventListener('click', close);
    scoutLightbox.addEventListener('click', (event) => {
      if (event.target === scoutLightbox) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('lightbox-open')) close();
    });
    scoutLightboxImg.addEventListener('click', () => {
      if (!scoutLightboxUrl) return;
      try { window.open(scoutLightboxUrl, '_blank', 'noopener'); } catch { /* ignore */ }
    });
  }

  function openScoutPhoto(url, caption) {
    const src = String(url || '').trim();
    if (!src || src.includes('assets/placeholder.png')) {
      setStatus('No photo available for this lead.');
      return;
    }
    ensureLightbox();
    if (!scoutLightbox || !scoutLightboxImg) return;
    scoutLightboxUrl = src;
    scoutLightboxImg.src = src;
    scoutLightbox.style.display = 'flex';
    document.body.classList.add('lightbox-open');
    if (scoutLightboxCaption) {
      scoutLightboxCaption.textContent = caption ? String(caption) : 'Tip: click the photo to open full-size in a new tab.';
    }
  }

  // --- OCR (phone extraction) ---
  let ocrReadyPromise = null;
  let ocrWorker = null;
  const scanningIds = new Set();

  function ensureTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (ocrReadyPromise) return ocrReadyPromise;
    ocrReadyPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/tesseract.min.js';
      s.async = true;
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => reject(new Error('Failed to load OCR library'));
      document.head.appendChild(s);
    });
    return ocrReadyPromise;
  }

  async function ensureOcrWorker({ onProgress } = {}) {
    if (ocrWorker) return ocrWorker;
    const Tesseract = await ensureTesseract();
    if (!Tesseract || typeof Tesseract.createWorker !== 'function') {
      throw new Error('OCR library unavailable');
    }
    ocrWorker = Tesseract.createWorker({
      logger: (m) => {
        if (!m || !onProgress) return;
        try { onProgress(m); } catch { /* ignore */ }
      }
    });
    await ocrWorker.load();
    await ocrWorker.loadLanguage('eng');
    await ocrWorker.initialize('eng');
    try {
      await ocrWorker.setParameters({
        tessedit_char_whitelist: '0123456789+() -./',
        preserve_interword_spaces: '1'
      });
    } catch {
      // Not critical; keep defaults.
    }
    return ocrWorker;
  }

  async function fetchAsBlobUrl(url) {
    const res = await fetch(url, { mode: 'cors', cache: 'no-store' });
    if (!res.ok) throw new Error(`Image fetch failed (${res.status})`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    return { blobUrl, revoke: () => URL.revokeObjectURL(blobUrl) };
  }

  async function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.src = src;
    });
  }

  function preprocessForOcr(img) {
    const maxW = 1600;
    const w0 = img.naturalWidth || img.width || 1;
    const h0 = img.naturalHeight || img.height || 1;
    const scale = Math.min(1, maxW / w0);
    const w = Math.max(1, Math.round(w0 * scale));
    const h = Math.max(1, Math.round(h0 * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return canvas;
    ctx.drawImage(img, 0, 0, w, h);
    try {
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      const contrast = 1.18;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        y = (y - 128) * contrast + 128;
        y = Math.max(0, Math.min(255, y));
        d[i] = y;
        d[i + 1] = y;
        d[i + 2] = y;
      }
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // Ignore preprocessing errors; OCR can still run on the raw canvas.
    }
    return canvas;
  }

  function uniq(arr) {
    const seen = new Set();
    return arr.filter((v) => {
      const key = String(v || '').trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function normalizePhoneCandidate(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    s = s.replace(/[^\d+]/g, '');
    if (s.startsWith('00')) s = `+${s.slice(2)}`;
    if (s.includes('+')) {
      s = s[0] === '+' ? `+${s.slice(1).replace(/\+/g, '')}` : s.replace(/\+/g, '');
    }
    const digits = s.replace(/\D/g, '');
    if (!s.startsWith('+') && digits.startsWith('34') && digits.length === 11) s = `+${digits}`;
    if (!s.startsWith('+') && digits.length === 9) s = `+34${digits}`;
    return s;
  }

  function scorePhoneCandidate(phone) {
    const s = String(phone || '');
    const digits = s.replace(/\D/g, '');
    let score = digits.length;
    if (s.startsWith('+34')) score += 10;
    if (digits.length === 11 && digits.startsWith('34')) score += 8;
    if (digits.length === 9 && /^[6789]/.test(digits)) score += 6;
    return score;
  }

  function extractPhoneCandidates(text) {
    const t = String(text || '').replace(/[\u200B-\u200D\uFEFF]/g, '');
    const matches = t.match(/(?:\+|00)?\s*\d[\d\s().\-\/]{6,}\d/g) || [];
    const cleaned = matches.map((m) => normalizePhoneCandidate(m)).filter(Boolean);
    const filtered = cleaned.filter((c) => {
      const digits = c.replace(/\D/g, '');
      return digits.length >= 8 && digits.length <= 15;
    });
    const unique = uniq(filtered);
    unique.sort((a, b) => scorePhoneCandidate(b) - scorePhoneCandidate(a));
    return unique;
  }

  async function scanPhoneFromRow(rowEl) {
    const id = rowEl ? rowEl.getAttribute('data-id') : '';
    if (!id) return;
    if (scanningIds.has(id)) return;
    const btn = rowEl.querySelector('button[data-action="scan-phone"]');
    const hint = rowEl.querySelector('[data-role="phone-hint"]');
    const phoneInput = rowEl.querySelector('[data-field="phone"]');
    const photoUrl = String(rowEl.getAttribute('data-photo-url') || '').trim();
    if (!photoUrl) {
      setStatus('No photo URL to scan.');
      return;
    }

    const updateHintProgress = debounce((text) => {
      if (hint) hint.textContent = text || '';
    }, 120);

    scanningIds.add(id);
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Scanning…';
    }
    if (hint) hint.textContent = 'Scanning photo for phone number…';
    setStatus('OCR: preparing…');

    let revoke = null;
    try {
      const worker = await ensureOcrWorker({
        onProgress: (m) => {
          if (!m || m.status !== 'recognizing text') return;
          const p = Math.round((Number(m.progress) || 0) * 100);
          if (p > 0) updateHintProgress(`Scanning… ${p}%`);
        }
      });

      const blob = await fetchAsBlobUrl(photoUrl);
      revoke = blob.revoke;
      const img = await loadImage(blob.blobUrl);
      const canvas = preprocessForOcr(img);
      const result = await worker.recognize(canvas);
      const text = result && result.data && result.data.text ? String(result.data.text) : '';

      const candidates = extractPhoneCandidates(text);
      if (!candidates.length) {
        if (hint) hint.textContent = 'No phone detected. Open the photo and enter it manually.';
        setStatus('OCR finished: no phone detected.');
        return;
      }

      const best = candidates[0];
      if (phoneInput) phoneInput.value = best;
      if (hint) hint.textContent = candidates.length > 1 ? `Detected: ${candidates.join('  •  ')}` : `Detected: ${best}`;
      setStatus(`OCR finished: detected ${best} (please verify).`);
    } catch (err) {
      const msg = err && err.message ? String(err.message) : 'Unknown error';
      if (hint) hint.textContent = 'OCR failed. Open the photo and enter the phone manually.';
      setStatus(`OCR failed: ${msg}`);
    } finally {
      try { if (revoke) revoke(); } catch { /* ignore */ }
      scanningIds.delete(id);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Scan';
      }
    }
  }

  async function loadRows({ silent = false } = {}) {
    const client = getClient();
    if (!client) {
      setStatus('Supabase not configured.');
      return;
    }

    const { data: sessionData } = await client.auth.getSession();
    const user = sessionData && sessionData.session ? sessionData.session.user : null;
    if (!user) {
      setStatus('Signed out. Open Account and sign in as an admin.');
      return;
    }

    const role = await roleFor(client, user.id);
    if (role !== 'admin') {
      setStatus('Access denied (admin only).');
      return;
    }

    if (!silent) setStatus('Loading Street Scout inbox…');

    let query = client
      .from('collab_board_leads')
      .select('id,created_at,user_email,status,commission_eur,commission_tier,latitude,longitude,accuracy_m,phone,notes,admin_notes,scp_ref,sold_at,paid_at,photo_bucket,photo_path')
      .order('created_at', { ascending: false })
      .limit(500);

    const filter = statusFilter ? String(statusFilter.value || '').trim() : '';
    if (filter) query = query.eq('status', filter);

    const { data, error } = await query;
    if (error) {
      setStatus(`Failed to load: ${error.message || 'unknown error'}`);
      return;
    }

    lastRows = Array.isArray(data) ? data : [];
    if (!lastRows.length) {
      if (tbody) tbody.innerHTML = '';
      setStatus('No leads yet.');
      return;
    }

    const newest = lastRows[0] && lastRows[0].created_at ? String(lastRows[0].created_at) : '';
    if (!lastSeenNewest) lastSeenNewest = newest;

    // Create signed URLs for thumbnails (best-effort).
    const withUrls = await Promise.all(lastRows.map(async (row) => {
      const bucket = row.photo_bucket ? String(row.photo_bucket) : 'collab-boards';
      const path = row.photo_path ? String(row.photo_path) : '';
      if (!path) return { ...row, _photoUrl: '' };
      try {
        const { data: urlData, error: urlErr } = await client.storage.from(bucket).createSignedUrl(path, 60 * 60);
        if (urlErr || !urlData || !urlData.signedUrl) return { ...row, _photoUrl: '' };
        return { ...row, _photoUrl: String(urlData.signedUrl) };
      } catch {
        return { ...row, _photoUrl: '' };
      }
    }));

    if (!tbody) return;
    tbody.innerHTML = withUrls.map((row) => {
      const time = row.created_at ? new Date(row.created_at).toLocaleString() : '';
      const lat = toNum(row.latitude);
      const lon = toNum(row.longitude);
      const hasLoc = Number.isFinite(lat) && Number.isFinite(lon);
      const locLink = hasLoc ? `<a class="admin-link" href="${escape(mapUrl(lat, lon))}" target="_blank" rel="noopener">Open</a>` : '';
      const reward = formatEur(row.commission_eur);
      const imgSrc = row._photoUrl ? escape(row._photoUrl) : 'assets/placeholder.png';
      const imgTag = `<img class="admin-thumb" src="${imgSrc}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/placeholder.png'">`;
      const payout = row.paid_at ? 'Paid' : (row.sold_at ? 'Sold (unpaid)' : '');
      const tier = String(row.commission_tier || '').trim();
      const scoutNotes = String(row.notes || '').trim();
      const scoutNotesShort = scoutNotes.length > 60 ? `${scoutNotes.slice(0, 60)}…` : scoutNotes;

      const statusOptions = ['new', 'called', 'contacted', 'signed', 'sold', 'rejected'].map((s) => {
        const sel = String(row.status || '') === s ? 'selected' : '';
        return `<option value="${escape(s)}" ${sel}>${escape(s)}</option>`;
      }).join('');

      return `
        <tr data-id="${escape(row.id)}" data-photo-url="${escape(row._photoUrl || '')}">
          <td><button class="admin-thumb-btn" type="button" data-action="open-photo" aria-label="Open photo">${imgTag}</button></td>
          <td>${escape(time)}</td>
          <td>${escape(row.user_email || '')}</td>
          <td>
            <select class="admin-select" data-field="status" aria-label="Status">
              ${statusOptions}
            </select>
          </td>
          <td>${escape(tier)}</td>
          <td>
            <input class="admin-input" data-field="commission_eur" style="min-width:120px" value="${escape(row.commission_eur != null ? row.commission_eur : '')}" aria-label="Commission">
          </td>
          <td>${locLink}</td>
          <td>
            <div class="admin-phone-row">
              <input class="admin-input" data-field="phone" style="min-width:150px" value="${escape(row.phone || '')}" aria-label="Phone">
              <button class="admin-ocr-btn" type="button" data-action="scan-phone">Scan</button>
            </div>
            <div class="muted admin-ocr-hint" data-role="phone-hint"></div>
          </td>
          <td><input class="admin-input" data-field="scp_ref" style="min-width:140px" value="${escape(row.scp_ref || '')}" aria-label="SCP ref"></td>
          <td><span class="muted" title="${escape(scoutNotes)}">${escape(scoutNotesShort)}</span></td>
          <td><input class="admin-input" data-field="admin_notes" style="min-width:240px" value="${escape(row.admin_notes || '')}" aria-label="Admin notes"></td>
          <td><button class="cta-button cta-button--outline" data-action="save">Save</button></td>
          <td>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;justify-content:flex-start">
              <span class="muted">${escape(payout)}</span>
              <button class="cta-button cta-button--outline" data-action="mark-paid" ${row.paid_at ? 'disabled' : ''}>Mark paid</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    setStatus(`Loaded ${lastRows.length} leads.`);

    // Notify if new rows arrived while the page is open.
    if (newest && newest !== lastSeenNewest) {
      lastSeenNewest = newest;
      try {
        if (typeof Notification !== 'undefined' && Notification && Notification.permission === 'granted') {
          new Notification('New Street Scout lead', { body: 'A new board photo was submitted.' });
        }
      } catch {
        // ignore
      }
    }
  }

  async function saveRow(rowEl) {
    const client = getClient();
    if (!client) return;
    const id = rowEl ? rowEl.getAttribute('data-id') : '';
    if (!id) return;

    const readField = (name) => {
      const el = rowEl.querySelector(`[data-field="${name}"]`);
      if (!el) return '';
      return String(el.value || '').trim();
    };

    const status = readField('status') || 'new';
    const commissionRaw = readField('commission_eur');
    const commission = commissionRaw === '' ? null : Number(commissionRaw);
    const phone = readField('phone') || null;
    const scpRef = readField('scp_ref') || null;
    const adminNotes = readField('admin_notes') || null;

    const patch = {
      status,
      commission_eur: Number.isFinite(commission) ? commission : null,
      phone,
      scp_ref: scpRef,
      admin_notes: adminNotes
    };
    if (status === 'sold') {
      patch.sold_at = new Date().toISOString();
    }

    setStatus('Saving…');
    const { error } = await client.from('collab_board_leads').update(patch).eq('id', id);
    if (error) {
      setStatus(`Save failed: ${error.message || 'unknown error'}`);
      return;
    }
    setStatus('Saved.');
    window.setTimeout(() => loadRows({ silent: true }), 250);
  }

  async function markPaid(rowEl) {
    const client = getClient();
    if (!client) return;
    const id = rowEl ? rowEl.getAttribute('data-id') : '';
    if (!id) return;

    setStatus('Marking paid…');
    const { error } = await client
      .from('collab_board_leads')
      .update({ paid_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setStatus(`Failed: ${error.message || 'unknown error'}`);
      return;
    }
    setStatus('Marked as paid.');
    window.setTimeout(() => loadRows({ silent: true }), 250);
  }

  function exportCsv() {
    const headers = [
      'id', 'created_at', 'user_email', 'status', 'commission_tier', 'commission_eur',
      'latitude', 'longitude', 'accuracy_m', 'phone', 'scp_ref', 'notes', 'sold_at', 'paid_at',
      'admin_notes',
      'photo_bucket', 'photo_path'
    ];
    const lines = [headers.map(toCsvCell).join(',')];
    lastRows.forEach((r) => {
      lines.push(headers.map((h) => toCsvCell(r[h])).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scp-street-scout.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function ensureNotifications() {
    try {
      if (typeof Notification === 'undefined' || !Notification) return;
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      // ignore
    }
  }

  async function setupRealtime() {
    const client = getClient();
    if (!client) return;
    try {
      if (realtimeChannel) {
        await realtimeChannel.unsubscribe();
        realtimeChannel = null;
      }
    } catch {
      // ignore
    }
    try {
      realtimeChannel = client
        .channel('scp-street-scout-inbox')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'collab_board_leads' }, () => {
          // Lightweight refresh on new inserts.
          loadRows({ silent: true });
        })
        .subscribe();
    } catch {
      // ignore
    }
  }

  if (refreshBtn) refreshBtn.addEventListener('click', () => loadRows());
  if (csvBtn) csvBtn.addEventListener('click', exportCsv);
  if (statusFilter) statusFilter.addEventListener('change', () => loadRows());

  if (tbody) {
    tbody.addEventListener('click', (event) => {
      const btn = event.target && event.target.closest ? event.target.closest('button[data-action]') : null;
      if (!btn) return;
      const action = btn.getAttribute('data-action') || '';
      const row = btn.closest('tr');
      if (!row) return;
      if (action === 'open-photo') {
        const id = row.getAttribute('data-id') || '';
        const url = row.getAttribute('data-photo-url') || '';
        openScoutPhoto(url, id ? `Lead ${id} (click photo to open full-size)` : '');
      }
      if (action === 'scan-phone') scanPhoneFromRow(row);
      if (action === 'save') saveRow(row);
      if (action === 'mark-paid') markPaid(row);
    });
  }

  window.addEventListener('scp:supabase:ready', () => {
    ensureNotifications();
    loadRows();
    setupRealtime();
  }, { once: true });
  window.setTimeout(() => {
    ensureNotifications();
    loadRows();
    setupRealtime();
  }, 80);
})();
