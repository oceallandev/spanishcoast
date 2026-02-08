(() => {
  const statusEl = document.getElementById('admin-status');
  const tbody = document.querySelector('#fav-table tbody');
  const refreshBtn = document.getElementById('refresh-btn');
  const csvBtn = document.getElementById('csv-btn');

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text || '';
  };

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

  async function roleFor(client, userId) {
    try {
      const { data } = await client.from('profiles').select('role').eq('user_id', userId).maybeSingle();
      return data && data.role ? String(data.role) : '';
    } catch {
      return '';
    }
  }

  let lastRows = [];

  async function loadRows() {
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

    setStatus('Loading favourites…');
    const { data, error } = await client
      .from('favourites')
      .select('created_at,user_email,property_ref,property_link,town,type,price')
      .order('created_at', { ascending: false })
      .limit(250);

    if (error) {
      setStatus(`Failed to load: ${error.message || 'unknown error'}`);
      return;
    }

    lastRows = Array.isArray(data) ? data : [];
    if (!tbody) return;
    tbody.innerHTML = lastRows.map((row) => {
      const time = row.created_at ? new Date(row.created_at).toLocaleString() : '';
      const link = row.property_link ? `<a class="admin-link" href="${escape(row.property_link)}" target="_blank" rel="noopener">Open</a>` : '';
      const price = row.price != null && row.price !== '' ? `€${Number(row.price).toLocaleString('en-IE')}` : '';
      return `
        <tr>
          <td>${escape(time)}</td>
          <td>${escape(row.user_email || '')}</td>
          <td>${escape(row.property_ref || '')}</td>
          <td>${escape(row.town || '')}</td>
          <td>${escape(row.type || '')}</td>
          <td>${escape(price)}</td>
          <td>${link}</td>
        </tr>
      `;
    }).join('');

    setStatus(`Loaded ${lastRows.length} favourites.`);
  }

  function exportCsv() {
    const headers = ['created_at', 'user_email', 'property_ref', 'town', 'type', 'price', 'property_link'];
    const lines = [headers.map(toCsvCell).join(',')];
    lastRows.forEach((r) => {
      lines.push(headers.map((h) => toCsvCell(r[h])).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scp-favourites.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (refreshBtn) refreshBtn.addEventListener('click', loadRows);
  if (csvBtn) csvBtn.addEventListener('click', exportCsv);

  window.addEventListener('scp:supabase:ready', () => loadRows(), { once: true });
  window.setTimeout(loadRows, 60);
})();

