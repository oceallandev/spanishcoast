(() => {
  const statusEl = document.getElementById('admin-status');
  const tbody = document.querySelector('#sub-table tbody');
  const refreshBtn = document.getElementById('refresh-btn');
  const csvBtn = document.getElementById('csv-btn');
  const statusFilter = document.getElementById('status-filter');
  const qInput = document.getElementById('q');

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text || '';
  };

  const getClient = () => window.scpSupabase || null;

  const escape = (value) => {
    const s = value == null ? '' : String(value);
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  const toText = (v, fb = '') => (typeof v === 'string' ? v : v == null ? fb : String(v));
  const normLower = (v) => toText(v).trim().toLowerCase();

  const toCsvCell = (v) => {
    const s = v == null ? '' : String(v);
    const q = s.replace(/"/g, '""');
    return `"${q}"`;
  };

  const formatPrice = (it) => {
    const n = Number(it && it.price);
    const currency = toText(it && it.currency, 'EUR').toUpperCase();
    const period = normLower(it && (it.pricePeriod || it.price_period));
    if (!Number.isFinite(n) || n <= 0) return 'Price on request';
    const num = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 }).format(n);
    const base = currency === 'EUR' ? `€${num}` : `${num} ${currency}`;
    if (period === 'day') return `${base} / day`;
    if (period === 'week') return `${base} / week`;
    if (period === 'month') return `${base} / month`;
    return base;
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

  const getListing = (row) => {
    const it = row && row.listing ? row.listing : null;
    if (it && typeof it === 'object') return it;
    try {
      const parsed = JSON.parse(toText(it, ''));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  function filteredRows() {
    let rows = Array.isArray(lastRows) ? lastRows.slice() : [];
    const status = statusFilter ? normLower(statusFilter.value) : 'pending';
    if (status && status !== 'all') rows = rows.filter((r) => normLower(r && r.status) === status);

    const q = qInput ? normLower(qInput.value) : '';
    if (q) {
      rows = rows.filter((r) => {
        const it = getListing(r);
        const blob = [
          r && r.id,
          r && r.status,
          r && r.source,
          r && r.company_name,
          r && r.contact_name,
          r && r.contact_email,
          r && r.contact_phone,
          r && r.admin_notes,
          it && it.title,
          it && it.location,
          it && it.description
        ].map((x) => normLower(x)).join(' ');
        return blob.includes(q);
      });
    }

    return rows;
  }

  function render() {
    if (!tbody) return;
    const rows = filteredRows();

    tbody.innerHTML = rows.map((row) => {
      const it = getListing(row);
      const time = row && row.created_at ? new Date(row.created_at).toLocaleString() : '';
      const status = normLower(row && row.status) || 'pending';
      const source = normLower(row && row.source) || 'owner';
      const company = toText(row && row.company_name);

      const category = normLower(it && it.category) === 'boat' ? 'Boat' : 'Car';
      const deal = normLower(it && it.deal) === 'rent' ? 'Rent' : 'Sale';
      const title = toText(it && it.title, 'Vehicle');
      const location = toText(it && it.location, '');
      const price = formatPrice(it);

      const contactBits = [
        company ? `Company: ${company}` : '',
        row && row.contact_name ? `Name: ${toText(row.contact_name)}` : '',
        row && row.contact_email ? `Email: ${toText(row.contact_email)}` : '',
        row && row.contact_phone ? `Phone: ${toText(row.contact_phone)}` : ''
      ].filter(Boolean);
      const contact = contactBits.length ? contactBits.join('<br>') : '—';

      const actions = (() => {
        if (status !== 'pending') return '<span class="muted">—</span>';
        const id = escape(row && row.id);
        return `
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button class="cta-button" type="button" data-action="approve" data-id="${id}">Approve</button>
            <button class="cta-button cta-button--outline" type="button" data-action="reject" data-id="${id}">Reject</button>
          </div>
        `;
      })();

      const statusLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending';
      const sourceLabel = source === 'dealer_import' ? 'Dealer import' : 'Owner';

      return `
        <tr data-submission-id="${escape(row && row.id)}">
          <td>${escape(time)}</td>
          <td>${escape(statusLabel)}</td>
          <td>${escape(sourceLabel)}</td>
          <td>${escape(category)}</td>
          <td>${escape(deal)}</td>
          <td>${escape(title)}</td>
          <td>${escape(location)}</td>
          <td>${escape(price)}</td>
          <td>${contact}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');

    setStatus(`Showing ${rows.length} submission(s).`);
  }

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

    const st = statusFilter ? normLower(statusFilter.value) : 'pending';
    setStatus(`Loading ${st === 'all' ? 'submissions' : st}…`);

    let q = client
      .from('vehicle_submissions')
      .select('id,created_at,status,source,company_name,contact_name,contact_email,contact_phone,admin_notes,listing')
      .order('created_at', { ascending: false })
      .limit(250);
    if (st && st !== 'all') q = q.eq('status', st);

    const { data, error } = await q;
    if (error) {
      setStatus(`Failed to load: ${error.message || 'unknown error'}`);
      return;
    }

    lastRows = Array.isArray(data) ? data : [];
    render();
  }

  async function approveSubmission(id) {
    const client = getClient();
    if (!client) return;

    const row = (Array.isArray(lastRows) ? lastRows : []).find((r) => String(r && r.id) === String(id));
    if (!row) {
      setStatus('Submission not found.');
      return;
    }

    const it = getListing(row);
    const category = normLower(it && it.category) === 'boat' ? 'boat' : 'car';
    let deal = normLower(it && it.deal);
    if (deal !== 'rent' && deal !== 'sale') deal = 'sale';

    const providerName = (normLower(row.source) === 'dealer_import' && toText(row.company_name).trim())
      ? toText(row.company_name).trim()
      : 'Owner listing';

    const pricePeriod = (() => {
      const p = normLower(it && it.pricePeriod);
      return (p === 'day' || p === 'week' || p === 'month') ? p : null;
    })();

    const payload = {
      submission_id: row.id,
      published: true,
      source: normLower(row.source) === 'dealer_import' ? 'dealer_import' : 'owner',
      provider_name: providerName,
      category,
      deal,
      title: toText(it && it.title, 'Vehicle'),
      brand: toText(it && it.brand, '') || null,
      model: toText(it && it.model, '') || null,
      year: Number.isFinite(Number(it && it.year)) ? Math.trunc(Number(it.year)) : null,
      price: Number.isFinite(Number(it && it.price)) ? Number(it.price) : null,
      currency: toText(it && it.currency, 'EUR').toUpperCase() || 'EUR',
      price_period: pricePeriod,
      location: toText(it && it.location, '') || null,
      latitude: Number.isFinite(Number(it && it.latitude)) ? Number(it.latitude) : null,
      longitude: Number.isFinite(Number(it && it.longitude)) ? Number(it.longitude) : null,
      images: Array.isArray(it && it.images) ? it.images : [],
      description: toText(it && it.description, '') || null
    };

    setStatus('Publishing…');

    const out = await client
      .from('vehicle_listings')
      .insert(payload)
      .select('id')
      .single();

    const insertedId = out && out.data && out.data.id ? out.data.id : null;
    if (out && out.error) {
      setStatus(`Publish failed: ${out.error.message || 'unknown error'}`);
      return;
    }

    const patch = await client
      .from('vehicle_submissions')
      .update({
        status: 'approved',
        approved_listing_id: insertedId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', row.id);

    if (patch && patch.error) {
      setStatus(`Approved but failed to update submission: ${patch.error.message || 'unknown error'}`);
      return;
    }

    await loadRows();
  }

  async function rejectSubmission(id) {
    const client = getClient();
    if (!client) return;

    const reason = (() => {
      try {
        const r = window.prompt('Reject reason (optional):', '');
        return (r == null) ? '' : String(r).trim();
      } catch {
        return '';
      }
    })();

    setStatus('Rejecting…');
    const patch = await client
      .from('vehicle_submissions')
      .update({
        status: 'rejected',
        admin_notes: reason || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id);

    if (patch && patch.error) {
      setStatus(`Reject failed: ${patch.error.message || 'unknown error'}`);
      return;
    }

    await loadRows();
  }

  function exportCsv() {
    const rows = filteredRows();
    const headers = [
      'created_at',
      'status',
      'source',
      'company_name',
      'category',
      'deal',
      'title',
      'location',
      'price',
      'currency',
      'pricePeriod',
      'contact_name',
      'contact_email',
      'contact_phone',
      'admin_notes',
      'id'
    ];
    const lines = [headers.map(toCsvCell).join(',')];
    rows.forEach((r) => {
      const it = getListing(r);
      const rowOut = {
        created_at: r && r.created_at,
        status: r && r.status,
        source: r && r.source,
        company_name: r && r.company_name,
        category: it && it.category,
        deal: it && it.deal,
        title: it && it.title,
        location: it && it.location,
        price: it && it.price,
        currency: it && it.currency,
        pricePeriod: it && it.pricePeriod,
        contact_name: r && r.contact_name,
        contact_email: r && r.contact_email,
        contact_phone: r && r.contact_phone,
        admin_notes: r && r.admin_notes,
        id: r && r.id
      };
      lines.push(headers.map((h) => toCsvCell(rowOut[h])).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicle-submissions-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (refreshBtn) refreshBtn.addEventListener('click', loadRows);
  if (statusFilter) statusFilter.addEventListener('change', loadRows);
  if (qInput) qInput.addEventListener('input', () => render());
  if (csvBtn) csvBtn.addEventListener('click', exportCsv);

  if (tbody) {
    tbody.addEventListener('click', async (e) => {
      const btn = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (!action || !id) return;
      btn.disabled = true;
      try {
        if (action === 'approve') await approveSubmission(id);
        if (action === 'reject') await rejectSubmission(id);
      } finally {
        btn.disabled = false;
      }
    });
  }

  window.addEventListener('scp:supabase:ready', () => loadRows(), { once: true });
  window.setTimeout(loadRows, 60);
})();

