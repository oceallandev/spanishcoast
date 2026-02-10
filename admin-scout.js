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
        <tr data-id="${escape(row.id)}">
          <td>${imgTag}</td>
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
          <td><input class="admin-input" data-field="phone" style="min-width:150px" value="${escape(row.phone || '')}" aria-label="Phone"></td>
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
