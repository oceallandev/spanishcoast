(() => {
  const statusEl = document.getElementById('crm-status');
  const qEl = document.getElementById('crm-q');
  const refreshBtn = document.getElementById('crm-refresh');
  const tabContacts = document.getElementById('tab-contacts');
  const tabDemands = document.getElementById('tab-demands');

  const contactsWrap = document.getElementById('crm-contacts-wrap');
  const demandsWrap = document.getElementById('crm-demands-wrap');

  const contactsTbody = document.querySelector('#crm-contacts-table tbody');
  const demandsTbody = document.querySelector('#crm-demands-table tbody');

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text || '';
  };

  const getClient = () => window.scpSupabase || null;

  const escape = (value) => {
    const s = value == null ? '' : String(value);
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  const normalize = (value) =>
    (value == null ? '' : String(value))
      .trim()
      .toLowerCase();

  const formatMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    try {
      return `€${Math.round(n).toLocaleString('en-IE')}`;
    } catch {
      return `€${Math.round(n)}`;
    }
  };

  async function roleFor(client, userId) {
    try {
      const { data } = await client.from('profiles').select('role').eq('user_id', userId).maybeSingle();
      return data && data.role ? String(data.role) : '';
    } catch {
      return '';
    }
  }

  let activeTab = 'contacts';

  const setTab = (tab) => {
    activeTab = tab === 'demands' ? 'demands' : 'contacts';
    if (tabContacts) tabContacts.classList.toggle('is-active', activeTab === 'contacts');
    if (tabDemands) tabDemands.classList.toggle('is-active', activeTab === 'demands');
    if (contactsWrap) contactsWrap.style.display = activeTab === 'contacts' ? 'block' : 'none';
    if (demandsWrap) demandsWrap.style.display = activeTab === 'demands' ? 'block' : 'none';
  };

  const safeOrQuery = (raw) => {
    const q = (raw || '').replace(/[,]/g, ' ').trim();
    if (!q) return '';
    // Supabase `or()` expects comma-separated filters; avoid accidental commas.
    return q;
  };

  async function loadContacts() {
    const client = getClient();
    if (!client) {
      setStatus('Supabase not configured.');
      return;
    }

    setStatus('Loading contacts…');
    if (contactsTbody) contactsTbody.innerHTML = '';

    const rawQ = qEl && qEl.value ? qEl.value : '';
    const q = safeOrQuery(rawQ);

    let query = client
      .from('crm_contacts')
      .select('external_client_code,email,first_name,last_name,phone1,locality,province,source_updated_at,source_created_at')
      .order('source_updated_at', { ascending: false })
      .limit(250);

    if (q) {
      query = query.or(
        `email.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone1.ilike.%${q}%,external_client_code.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      setStatus(`Failed to load contacts: ${error.message || 'unknown error'}`);
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    if (!contactsTbody) return;

    contactsTbody.innerHTML = rows.map((r) => {
      const name = `${r.first_name || ''} ${r.last_name || ''}`.trim();
      const email = r.email || '';
      const phone = r.phone1 || '';
      const area = [r.locality, r.province].filter(Boolean).join(', ');
      const updated = r.source_updated_at || r.source_created_at || '';
      const time = updated ? new Date(updated).toLocaleString() : '';
      const code = r.external_client_code || '';
      return `
        <tr>
          <td>${escape(time)}</td>
          <td>${escape(name || '(no name)')}</td>
          <td>${escape(email)}</td>
          <td>${escape(phone)}</td>
          <td>${escape(area)}</td>
          <td>${escape(code)}</td>
        </tr>
      `;
    }).join('');

    setStatus(`Loaded ${rows.length} contacts.`);
  }

  async function loadDemands() {
    const client = getClient();
    if (!client) {
      setStatus('Supabase not configured.');
      return;
    }

    setStatus('Loading leads…');
    if (demandsTbody) demandsTbody.innerHTML = '';

    const rawQ = qEl && qEl.value ? qEl.value : '';
    const q = safeOrQuery(rawQ);

    let query = client
      .from('crm_demands')
      .select('external_client_code,external_demand_number,operation,price_min,price_max,beds_min,baths_min,types,zones,source_updated_at,source_created_at')
      .order('source_updated_at', { ascending: false })
      .limit(250);

    if (q) {
      query = query.or(
        `external_client_code.ilike.%${q}%,zones.ilike.%${q}%,types.ilike.%${q}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      setStatus(`Failed to load leads: ${error.message || 'unknown error'}`);
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    if (!demandsTbody) return;

    const clip = (s, n) => {
      const t = (s == null ? '' : String(s)).trim();
      if (!t) return '';
      return t.length > n ? `${t.slice(0, n - 1)}…` : t;
    };

    demandsTbody.innerHTML = rows.map((r) => {
      const updated = r.source_updated_at || r.source_created_at || '';
      const time = updated ? new Date(updated).toLocaleString() : '';
      const code = r.external_client_code || '';
      const dn = r.external_demand_number ? `#${r.external_demand_number}` : '';
      const budget = [formatMoney(r.price_min), formatMoney(r.price_max)].filter(Boolean).join(' - ');
      const bb = `${Number(r.beds_min) || 0} / ${Number(r.baths_min) || 0}`;
      const zones = clip(r.zones, 64);
      const types = clip(r.types, 64);
      return `
        <tr>
          <td>${escape(time)}</td>
          <td>${escape(`${code} ${dn}`.trim())}</td>
          <td>${escape(budget)}</td>
          <td>${escape(bb)}</td>
          <td>${escape(zones)}</td>
          <td>${escape(types)}</td>
        </tr>
      `;
    }).join('');

    setStatus(`Loaded ${rows.length} leads.`);
  }

  async function loadActive() {
    if (activeTab === 'demands') {
      await loadDemands();
    } else {
      await loadContacts();
    }
  }

  async function init() {
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
    if (normalize(role) !== 'admin') {
      setStatus('Access denied (admin only).');
      return;
    }

    setTab('contacts');
    await loadContacts();
  }

  if (tabContacts) tabContacts.addEventListener('click', async () => { setTab('contacts'); await loadContacts(); });
  if (tabDemands) tabDemands.addEventListener('click', async () => { setTab('demands'); await loadDemands(); });
  if (refreshBtn) refreshBtn.addEventListener('click', loadActive);
  if (qEl) {
    qEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        loadActive();
      }
    });
  }

  window.addEventListener('scp:supabase:ready', () => init(), { once: true });
  window.setTimeout(init, 80);
})();

