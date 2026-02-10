(() => {
  const statusEl = document.getElementById('crm-status');
  const showingEl = document.getElementById('crm-showing');
  const qEl = document.getElementById('crm-q');
  const refreshBtn = document.getElementById('crm-refresh');
  const loadMoreBtn = document.getElementById('crm-load-more');
  const exportBtn = document.getElementById('crm-export');
  const tabContacts = document.getElementById('tab-contacts');
  const tabDemands = document.getElementById('tab-demands');

  const contactsWrap = document.getElementById('crm-contacts-wrap');
  const demandsWrap = document.getElementById('crm-demands-wrap');

  const contactsTbody = document.querySelector('#crm-contacts-table tbody');
  const demandsTbody = document.querySelector('#crm-demands-table tbody');

  const drawerBackdrop = document.getElementById('crm-drawer-backdrop');
  const drawer = document.getElementById('crm-drawer');
  const drawerKicker = document.getElementById('crm-drawer-kicker');
  const drawerTitle = document.getElementById('crm-drawer-title');
  const drawerSubtitle = document.getElementById('crm-drawer-subtitle');
  const drawerBody = document.getElementById('crm-drawer-body');
  const drawerClose = document.getElementById('crm-drawer-close');

  const getClient = () => window.scpSupabase || null;

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text || '';
  };

  const setShowing = (text) => {
    if (showingEl) showingEl.textContent = text || '';
  };

  const escape = (value) => {
    const s = value == null ? '' : String(value);
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  const toText = (value) => (value == null ? '' : String(value));

  const normalize = (value) =>
    toText(value)
      .trim()
      .toLowerCase();

  const nullIfEmpty = (value) => {
    const s = toText(value).trim();
    return s ? s : null;
  };

  const numOrNull = (value) => {
    const s = toText(value).trim();
    if (!s) return null;
    const n = Number(s.replace(/[, ]+/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  const intOrNull = (value) => {
    const n = numOrNull(value);
    if (n == null) return null;
    const i = Math.round(n);
    return Number.isFinite(i) ? i : null;
  };

  const formatMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '';
    try {
      return `€${Math.round(n).toLocaleString('en-IE')}`;
    } catch {
      return `€${Math.round(n)}`;
    }
  };

  const formatTime = (value) => {
    const raw = value ? new Date(value) : null;
    if (!raw || Number.isNaN(raw.getTime())) return '';
    try {
      return raw.toLocaleString();
    } catch {
      return raw.toISOString();
    }
  };

  const cleanPhoneForWa = (value) => toText(value).replace(/[^\d+]/g, '').replace(/^\+/, '');

  const iconSvg = (path) =>
    `<svg class="crm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

  const ICON = {
    edit: iconSvg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    email: iconSvg('<path d="M4 4h16v16H4z" stroke="none"/><path d="M4 6l8 6 8-6"/><path d="M4 18h16"/>'),
    phone: iconSvg('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.11 4.18 2 2 0 0 1 4.09 2h3a2 2 0 0 1 2 1.72c.12.86.31 1.7.57 2.5a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.58-1.12a2 2 0 0 1 2.11-.45c.8.26 1.64.45 2.5.57A2 2 0 0 1 22 16.92z"/>'),
    user: iconSvg('<path d="M20 21v-2a4 4 0 0 0-3-3.87"/><path d="M4 21v-2a4 4 0 0 1 3-3.87"/><path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4z"/>'),
    link: iconSvg('<path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1"/><path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1"/>'),
    copy: iconSvg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    close: iconSvg('<path d="M18 6 6 18"/><path d="M6 6l12 12"/>'),
    search: iconSvg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>')
  };

  async function roleFor(client, userId) {
    try {
      const { data } = await client.from('profiles').select('role').eq('user_id', userId).maybeSingle();
      return data && data.role ? String(data.role) : '';
    } catch {
      return '';
    }
  }

  const safeOrQuery = (raw) => {
    const q = (raw || '').replace(/[,]/g, ' ').trim();
    if (!q) return '';
    // Supabase `or()` expects comma-separated filters; avoid accidental commas.
    return q;
  };

  const PAGE_SIZE = 1000;

  const state = {
    contacts: { rows: [], offset: 0, total: null, done: false, loading: false, q: '' },
    demands: { rows: [], offset: 0, total: null, done: false, loading: false, q: '' }
  };

  let activeTab = 'contacts';
  let drawerOpen = false;
  let drawerKind = '';
  let drawerId = '';

  const activeState = () => (activeTab === 'demands' ? state.demands : state.contacts);

  function showLoadMore(show) {
    if (!loadMoreBtn) return;
    loadMoreBtn.style.display = show ? 'inline-flex' : 'none';
  }

  function updateShowingLine() {
    const st = activeState();
    const total = typeof st.total === 'number' ? st.total : null;
    const loaded = Array.isArray(st.rows) ? st.rows.length : 0;
    const base = activeTab === 'demands' ? 'leads' : 'contacts';
    const q = safeOrQuery(qEl && qEl.value ? qEl.value : '');
    const suffix = q ? ` for "${q}"` : '';
    if (total != null) {
      setShowing(`Showing ${loaded} of ${total} ${base}${suffix}.`);
      showLoadMore(!st.done && loaded < total);
    } else {
      setShowing(`Showing ${loaded} ${base}${suffix}.`);
      showLoadMore(!st.done && loaded > 0);
    }
  }

  function setTab(tab) {
    activeTab = tab === 'demands' ? 'demands' : 'contacts';
    if (tabContacts) tabContacts.classList.toggle('is-active', activeTab === 'contacts');
    if (tabDemands) tabDemands.classList.toggle('is-active', activeTab === 'demands');
    if (contactsWrap) contactsWrap.style.display = activeTab === 'contacts' ? 'block' : 'none';
    if (demandsWrap) demandsWrap.style.display = activeTab === 'demands' ? 'block' : 'none';
    updateShowingLine();
  }

  const buildContactsQuery = (client, q) => {
    let query = client
      .from('crm_contacts')
      .select('id,external_client_code,email,first_name,last_name,phone1,locality,province,source_updated_at,source_created_at', { count: 'exact' })
      .order('source_updated_at', { ascending: false })
      .order('source_created_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (q) {
      query = query.or(
        [
          `email.ilike.%${q}%`,
          `first_name.ilike.%${q}%`,
          `last_name.ilike.%${q}%`,
          `phone1.ilike.%${q}%`,
          `phone2.ilike.%${q}%`,
          `phone3.ilike.%${q}%`,
          `external_client_code.ilike.%${q}%`,
          `locality.ilike.%${q}%`,
          `province.ilike.%${q}%`
        ].join(',')
      );
    }
    return query;
  };

  const buildDemandsQuery = (client, q) => {
    let query = client
      .from('crm_demands')
      .select(
        'id,external_client_code,external_demand_number,title,operation,price_min,price_max,beds_min,baths_min,types,zones,want_pool,want_terrace,want_garage,want_lift,source_updated_at,source_created_at',
        { count: 'exact' }
      )
      .order('source_updated_at', { ascending: false })
      .order('source_created_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (q) {
      query = query.or(
        [
          `external_client_code.ilike.%${q}%`,
          `external_demand_number.ilike.%${q}%`,
          `title.ilike.%${q}%`,
          `zones.ilike.%${q}%`,
          `types.ilike.%${q}%`
        ].join(',')
      );
    }
    return query;
  };

  function renderContacts() {
    if (!contactsTbody) return;
    const rows = state.contacts.rows || [];
    contactsTbody.innerHTML = rows.map((r) => {
      const name = `${toText(r.first_name).trim()} ${toText(r.last_name).trim()}`.trim() || '(no name)';
      const email = toText(r.email).trim();
      const phone = toText(r.phone1).trim();
      const area = [toText(r.locality).trim(), toText(r.province).trim()].filter(Boolean).join(', ');
      const updated = r.source_updated_at || r.source_created_at || '';
      const time = updated ? formatTime(updated) : '';
      const code = toText(r.external_client_code).trim();

      const emailBtn = email
        ? `<a class="crm-icon-btn" href="mailto:${escape(email)}" title="Email" aria-label="Email">${ICON.email}</a>`
        : '';
      const phoneBtn = phone
        ? `<a class="crm-icon-btn" href="tel:${escape(phone)}" title="Call" aria-label="Call">${ICON.phone}</a>`
        : '';
      const editBtn = `<button class="crm-icon-btn" type="button" data-action="edit" data-kind="contact" data-id="${escape(r.id)}" title="Edit" aria-label="Edit">${ICON.edit}</button>`;

      const codeBadge = code ? `<span class="crm-badge">${escape(code)}</span>` : '';

      return `
        <tr data-kind="contact" data-id="${escape(r.id)}">
          <td class="crm-col-updated">${escape(time)}</td>
          <td class="crm-col-contact">
            <div class="crm-cell">
              <div class="crm-primary">${escape(name)}</div>
              ${codeBadge ? `<div class="crm-badges">${codeBadge}</div>` : ''}
            </div>
          </td>
          <td class="crm-col-email">
            <div class="crm-cell">
              <div class="crm-primary">${email ? `<a class="admin-link" href="mailto:${escape(email)}">${escape(email)}</a>` : '<span class="muted">—</span>'}</div>
            </div>
          </td>
          <td class="crm-col-phone">
            <div class="crm-cell">
              <div class="crm-primary">${phone ? `<a class="admin-link" href="tel:${escape(phone)}">${escape(phone)}</a>` : '<span class="muted">—</span>'}</div>
            </div>
          </td>
          <td class="crm-col-area">
            <div class="crm-cell">
              <div class="crm-primary">${area ? escape(area) : '<span class="muted">—</span>'}</div>
            </div>
          </td>
          <td class="crm-col-actions">
            <div class="crm-actions">
              ${emailBtn}
              ${phoneBtn}
              ${editBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderDemands() {
    if (!demandsTbody) return;
    const rows = state.demands.rows || [];

    const clip = (s, n) => {
      const t = (s == null ? '' : String(s)).trim();
      if (!t) return '';
      return t.length > n ? `${t.slice(0, n - 1)}…` : t;
    };

    const opLabel = (op) => {
      const v = normalize(op);
      if (v === 'rent') return 'Rent';
      if (v === 'sale') return 'Sale';
      return v ? v : 'Lead';
    };

    demandsTbody.innerHTML = rows.map((r) => {
      const updated = r.source_updated_at || r.source_created_at || '';
      const time = updated ? formatTime(updated) : '';
      const code = toText(r.external_client_code).trim();
      const dn = r.external_demand_number ? `#${r.external_demand_number}` : '';
      const title = toText(r.title).trim();
      const header = title || `${code} ${dn}`.trim() || '(lead)';
      const budget = [formatMoney(r.price_min), formatMoney(r.price_max)].filter(Boolean).join(' - ');
      const bb = `${Number(r.beds_min) || 0} / ${Number(r.baths_min) || 0}`;
      const zones = clip(r.zones, 84);
      const types = clip(r.types, 84);
      const op = opLabel(r.operation);

      const badges = [];
      if (code || dn) badges.push(`<span class="crm-badge">${escape(`${code} ${dn}`.trim())}</span>`);
      if (op) badges.push(`<span class="crm-badge crm-badge--good">${escape(op)}</span>`);
      if (r.want_pool) badges.push(`<span class="crm-badge">Pool</span>`);
      if (r.want_terrace) badges.push(`<span class="crm-badge">Terrace</span>`);
      if (r.want_garage) badges.push(`<span class="crm-badge">Garage</span>`);
      if (r.want_lift) badges.push(`<span class="crm-badge">Lift</span>`);

      const editBtn = `<button class="crm-icon-btn" type="button" data-action="edit" data-kind="demand" data-id="${escape(r.id)}" title="Edit lead" aria-label="Edit lead">${ICON.edit}</button>`;
      const jumpBtn = code
        ? `<button class="crm-icon-btn" type="button" data-action="jump-contact" data-client="${escape(code)}" title="Open contact" aria-label="Open contact">${ICON.user}</button>`
        : '';

      return `
        <tr data-kind="demand" data-id="${escape(r.id)}">
          <td class="crm-col-updated">${escape(time)}</td>
          <td class="crm-col-lead">
            <div class="crm-cell">
              <div class="crm-primary">${escape(header)}</div>
              ${badges.length ? `<div class="crm-badges">${badges.join('')}</div>` : ''}
            </div>
          </td>
          <td class="crm-col-budget">${budget ? escape(budget) : '<span class="muted">—</span>'}</td>
          <td class="crm-col-criteria">${escape(bb)}</td>
          <td class="crm-col-zones">${zones ? escape(zones) : '<span class="muted">—</span>'}</td>
          <td class="crm-col-types">${types ? escape(types) : '<span class="muted">—</span>'}</td>
          <td class="crm-col-actions">
            <div class="crm-actions">
              ${jumpBtn}
              ${editBtn}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async function loadContacts({ reset = false } = {}) {
    const client = getClient();
    if (!client) {
      setStatus('Supabase not configured.');
      return;
    }

    const st = state.contacts;
    if (st.loading) return;

    const rawQ = qEl && qEl.value ? qEl.value : '';
    const q = safeOrQuery(rawQ);

    if (reset || st.q !== q) {
      st.rows = [];
      st.offset = 0;
      st.total = null;
      st.done = false;
      st.q = q;
      renderContacts();
    }

    if (st.done) {
      updateShowingLine();
      return;
    }

    st.loading = true;
    setStatus(st.offset === 0 ? 'Loading contacts…' : 'Loading more contacts…');

    const from = st.offset;
    const to = st.offset + PAGE_SIZE - 1;
    const query = buildContactsQuery(client, q).range(from, to);
    const { data, error, count } = await query;

    st.loading = false;

    if (error) {
      setStatus(`Failed to load contacts: ${error.message || 'unknown error'}`);
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    st.rows = st.rows.concat(rows);
    st.offset += rows.length;
    if (typeof count === 'number') st.total = count;
    if (!rows.length || rows.length < PAGE_SIZE) st.done = true;

    renderContacts();
    setStatus('');
    updateShowingLine();
  }

  async function loadDemands({ reset = false } = {}) {
    const client = getClient();
    if (!client) {
      setStatus('Supabase not configured.');
      return;
    }

    const st = state.demands;
    if (st.loading) return;

    const rawQ = qEl && qEl.value ? qEl.value : '';
    const q = safeOrQuery(rawQ);

    if (reset || st.q !== q) {
      st.rows = [];
      st.offset = 0;
      st.total = null;
      st.done = false;
      st.q = q;
      renderDemands();
    }

    if (st.done) {
      updateShowingLine();
      return;
    }

    st.loading = true;
    setStatus(st.offset === 0 ? 'Loading leads…' : 'Loading more leads…');

    const from = st.offset;
    const to = st.offset + PAGE_SIZE - 1;
    const query = buildDemandsQuery(client, q).range(from, to);
    const { data, error, count } = await query;

    st.loading = false;

    if (error) {
      setStatus(`Failed to load leads: ${error.message || 'unknown error'}`);
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    st.rows = st.rows.concat(rows);
    st.offset += rows.length;
    if (typeof count === 'number') st.total = count;
    if (!rows.length || rows.length < PAGE_SIZE) st.done = true;

    renderDemands();
    setStatus('');
    updateShowingLine();
  }

  async function loadActive({ reset = false } = {}) {
    if (activeTab === 'demands') {
      await loadDemands({ reset });
    } else {
      await loadContacts({ reset });
    }
  }

  function openDrawer() {
    if (!drawer || !drawerBackdrop) return;
    drawerOpen = true;
    drawer.setAttribute('aria-hidden', 'false');
    drawerBackdrop.setAttribute('aria-hidden', 'false');
    document.body.classList.add('crm-open');
  }

  function closeDrawer() {
    if (!drawer || !drawerBackdrop) return;
    drawerOpen = false;
    drawerKind = '';
    drawerId = '';
    drawer.setAttribute('aria-hidden', 'true');
    drawerBackdrop.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('crm-open');
    if (drawerBody) drawerBody.innerHTML = '';
  }

  async function fetchContactDetail(client, id) {
    const { data, error } = await client
      .from('crm_contacts')
      .select('id,source,external_client_code,email,first_name,last_name,phone1,phone2,phone3,locality,province,nationality,client_type,notes,source_created_at,source_updated_at,created_at,updated_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Contact not found');
    return data;
  }

  async function fetchDemandDetail(client, id) {
    const { data, error } = await client
      .from('crm_demands')
      .select('id,source,external_client_code,external_demand_number,title,operation,price_min,price_max,beds_min,baths_min,types,zones,want_terrace,want_pool,want_garage,want_lift,notes,source_created_at,source_updated_at,created_at,updated_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Lead not found');
    return data;
  }

  const renderDrawerHeader = ({ kicker, title, subtitle }) => {
    if (drawerKicker) drawerKicker.textContent = kicker || 'CRM';
    if (drawerTitle) drawerTitle.textContent = title || 'Details';
    if (drawerSubtitle) drawerSubtitle.textContent = subtitle || '';
  };

  const rowBadgeLine = (label, value) => {
    const v = toText(value).trim();
    if (!v) return '';
    return `<span class="crm-badge">${escape(label)}: ${escape(v)}</span>`;
  };

  function renderContactDrawer(row) {
    const code = toText(row.external_client_code).trim();
    const email = toText(row.email).trim();
    const phone = toText(row.phone1).trim();
    const name = `${toText(row.first_name).trim()} ${toText(row.last_name).trim()}`.trim() || '(no name)';
    const subtitle = [email, phone].filter(Boolean).join(' · ');

    renderDrawerHeader({
      kicker: 'Contact',
      title: name,
      subtitle
    });

    const badges = [
      rowBadgeLine('Source', row.source),
      rowBadgeLine('Code', code),
      row.source_updated_at ? rowBadgeLine('Source updated', formatTime(row.source_updated_at)) : '',
      row.source_created_at ? rowBadgeLine('Source created', formatTime(row.source_created_at)) : ''
    ].filter(Boolean);

    const wa = phone ? `https://wa.me/${escape(cleanPhoneForWa(phone))}` : '';
    const emailLink = email ? `mailto:${escape(email)}` : '';
    const phoneLink = phone ? `tel:${escape(phone)}` : '';

    drawerBody.innerHTML = `
      ${badges.length ? `<div class="crm-badges" style="margin-bottom:0.9rem;">${badges.join('')}</div>` : ''}

      <div class="crm-actions" style="justify-content:flex-start; margin-bottom:0.9rem;">
        ${email ? `<a class="crm-icon-btn" href="${emailLink}" target="_blank" rel="noopener" aria-label="Email">${ICON.email}<span>Email</span></a>` : ''}
        ${phone ? `<a class="crm-icon-btn" href="${phoneLink}" aria-label="Call">${ICON.phone}<span>Call</span></a>` : ''}
        ${phone ? `<a class="crm-icon-btn" href="${wa}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICON.link}<span>WhatsApp</span></a>` : ''}
        ${code ? `<button class="crm-icon-btn" type="button" data-action="jump-leads" data-client="${escape(code)}">${ICON.link}<span>View leads</span></button>` : ''}
      </div>

      <form class="form-grid crm-form-grid" data-form="contact" data-id="${escape(row.id)}">
        <label>
          <span>First name</span>
          <input name="first_name" type="text" value="${escape(row.first_name || '')}">
        </label>
        <label>
          <span>Last name</span>
          <input name="last_name" type="text" value="${escape(row.last_name || '')}">
        </label>
        <label class="crm-span-2">
          <span>Email</span>
          <input name="email" type="email" autocomplete="email" value="${escape(row.email || '')}">
        </label>
        <label>
          <span>Phone 1</span>
          <input name="phone1" type="tel" value="${escape(row.phone1 || '')}">
        </label>
        <label>
          <span>Phone 2</span>
          <input name="phone2" type="tel" value="${escape(row.phone2 || '')}">
        </label>
        <label>
          <span>Phone 3</span>
          <input name="phone3" type="tel" value="${escape(row.phone3 || '')}">
        </label>
        <label>
          <span>Locality</span>
          <input name="locality" type="text" value="${escape(row.locality || '')}">
        </label>
        <label>
          <span>Province</span>
          <input name="province" type="text" value="${escape(row.province || '')}">
        </label>
        <label>
          <span>Nationality</span>
          <input name="nationality" type="text" value="${escape(row.nationality || '')}">
        </label>
        <label class="crm-span-2">
          <span>Client type</span>
          <input name="client_type" type="text" value="${escape(row.client_type || '')}">
        </label>
        <label class="crm-span-2">
          <span>Notes</span>
          <textarea name="notes" rows="4" placeholder="Add internal notes…">${escape(row.notes || '')}</textarea>
        </label>

        <div class="crm-form-actions crm-span-2">
          <button class="cta-button" type="submit">Save changes</button>
          <button class="cta-button cta-button--outline" type="button" data-action="close-drawer">Close</button>
        </div>
      </form>
    `;
  }

  function renderDemandDrawer(row) {
    const code = toText(row.external_client_code).trim();
    const dn = toText(row.external_demand_number).trim();
    const title = toText(row.title).trim();
    const kicker = 'Lead';
    const header = title || `${code}${dn ? ` #${dn}` : ''}`.trim() || '(lead)';
    const subtitle = [code ? `Client ${code}` : '', dn ? `Demand #${dn}` : ''].filter(Boolean).join(' · ');

    renderDrawerHeader({
      kicker,
      title: header,
      subtitle
    });

    const badges = [
      rowBadgeLine('Source', row.source),
      code ? rowBadgeLine('Client', code) : '',
      dn ? rowBadgeLine('Demand', dn) : '',
      row.operation ? rowBadgeLine('Operation', row.operation) : '',
      row.source_updated_at ? rowBadgeLine('Source updated', formatTime(row.source_updated_at)) : '',
      row.source_created_at ? rowBadgeLine('Source created', formatTime(row.source_created_at)) : ''
    ].filter(Boolean);

    drawerBody.innerHTML = `
      ${badges.length ? `<div class="crm-badges" style="margin-bottom:0.9rem;">${badges.join('')}</div>` : ''}

      <div class="crm-actions" style="justify-content:flex-start; margin-bottom:0.9rem;">
        ${code ? `<button class="crm-icon-btn" type="button" data-action="jump-contact" data-client="${escape(code)}">${ICON.user}<span>Open contact</span></button>` : ''}
        ${code ? `<button class="crm-icon-btn" type="button" data-action="jump-leads" data-client="${escape(code)}">${ICON.link}<span>Find similar</span></button>` : ''}
      </div>

      <form class="form-grid crm-form-grid" data-form="demand" data-id="${escape(row.id)}">
        <label class="crm-span-2">
          <span>Title</span>
          <input name="title" type="text" value="${escape(row.title || '')}" placeholder="Short summary (e.g. 2 bed in Torrevieja)">
        </label>
        <label>
          <span>Operation</span>
          <select name="operation" class="admin-select">
            ${['', 'sale', 'rent'].map((v) => `<option value="${escape(v)}"${normalize(row.operation) === v ? ' selected' : ''}>${v ? v.toUpperCase() : '—'}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Beds min</span>
          <input name="beds_min" type="number" min="0" step="1" value="${escape(row.beds_min ?? '')}">
        </label>
        <label>
          <span>Baths min</span>
          <input name="baths_min" type="number" min="0" step="1" value="${escape(row.baths_min ?? '')}">
        </label>
        <label>
          <span>Budget min (EUR)</span>
          <input name="price_min" type="number" min="0" step="1" value="${escape(row.price_min ?? '')}">
        </label>
        <label>
          <span>Budget max (EUR)</span>
          <input name="price_max" type="number" min="0" step="1" value="${escape(row.price_max ?? '')}">
        </label>
        <label class="crm-span-2">
          <span>Zones</span>
          <input name="zones" type="text" value="${escape(row.zones || '')}" placeholder="Comma separated (e.g. Torrevieja, Orihuela Costa)">
        </label>
        <label class="crm-span-2">
          <span>Types</span>
          <input name="types" type="text" value="${escape(row.types || '')}" placeholder="Comma separated (e.g. Apartment, Villa)">
        </label>
        <label class="crm-check">
          <input name="want_pool" type="checkbox" ${row.want_pool ? 'checked' : ''}>
          <span>Pool</span>
        </label>
        <label class="crm-check">
          <input name="want_terrace" type="checkbox" ${row.want_terrace ? 'checked' : ''}>
          <span>Terrace</span>
        </label>
        <label class="crm-check">
          <input name="want_garage" type="checkbox" ${row.want_garage ? 'checked' : ''}>
          <span>Garage</span>
        </label>
        <label class="crm-check">
          <input name="want_lift" type="checkbox" ${row.want_lift ? 'checked' : ''}>
          <span>Lift</span>
        </label>
        <label class="crm-span-2">
          <span>Notes</span>
          <textarea name="notes" rows="4" placeholder="Add internal notes…">${escape(row.notes || '')}</textarea>
        </label>

        <div class="crm-form-actions crm-span-2">
          <button class="cta-button" type="submit">Save changes</button>
          <button class="cta-button cta-button--outline" type="button" data-action="close-drawer">Close</button>
        </div>
      </form>
    `;
  }

  async function openEditor(kind, id) {
    const client = getClient();
    if (!client) return;
    if (!drawerBody) return;
    drawerKind = kind;
    drawerId = id;
    openDrawer();
    renderDrawerHeader({ kicker: 'Loading…', title: 'Please wait', subtitle: '' });
    drawerBody.innerHTML = '<div class="muted">Loading details…</div>';

    try {
      if (kind === 'demand') {
        const row = await fetchDemandDetail(client, id);
        renderDemandDrawer(row);
      } else {
        const row = await fetchContactDetail(client, id);
        renderContactDrawer(row);
      }
    } catch (error) {
      const msg = error && error.message ? String(error.message) : String(error);
      drawerBody.innerHTML = `<div class="muted">Failed to load: ${escape(msg)}</div>`;
    }
  }

  async function saveContact(client, form, id) {
    const fd = new FormData(form);
    const payload = {
      first_name: nullIfEmpty(fd.get('first_name')),
      last_name: nullIfEmpty(fd.get('last_name')),
      email: nullIfEmpty(fd.get('email')),
      phone1: nullIfEmpty(fd.get('phone1')),
      phone2: nullIfEmpty(fd.get('phone2')),
      phone3: nullIfEmpty(fd.get('phone3')),
      locality: nullIfEmpty(fd.get('locality')),
      province: nullIfEmpty(fd.get('province')),
      nationality: nullIfEmpty(fd.get('nationality')),
      client_type: nullIfEmpty(fd.get('client_type')),
      notes: nullIfEmpty(fd.get('notes'))
    };

    const { error } = await client.from('crm_contacts').update(payload).eq('id', id);
    if (error) throw error;

    // Patch the list row (best-effort).
    const idx = state.contacts.rows.findIndex((r) => r && r.id === id);
    if (idx >= 0) {
      state.contacts.rows[idx] = { ...state.contacts.rows[idx], ...payload };
      renderContacts();
    }
  }

  async function saveDemand(client, form, id) {
    const fd = new FormData(form);
    const payload = {
      title: nullIfEmpty(fd.get('title')),
      operation: nullIfEmpty(fd.get('operation')),
      beds_min: intOrNull(fd.get('beds_min')),
      baths_min: intOrNull(fd.get('baths_min')),
      price_min: intOrNull(fd.get('price_min')),
      price_max: intOrNull(fd.get('price_max')),
      zones: nullIfEmpty(fd.get('zones')),
      types: nullIfEmpty(fd.get('types')),
      want_pool: fd.get('want_pool') === 'on',
      want_terrace: fd.get('want_terrace') === 'on',
      want_garage: fd.get('want_garage') === 'on',
      want_lift: fd.get('want_lift') === 'on',
      notes: nullIfEmpty(fd.get('notes'))
    };

    const { error } = await client.from('crm_demands').update(payload).eq('id', id);
    if (error) throw error;

    const idx = state.demands.rows.findIndex((r) => r && r.id === id);
    if (idx >= 0) {
      state.demands.rows[idx] = { ...state.demands.rows[idx], ...payload };
      renderDemands();
    }
  }

  async function exportCsv() {
    const client = getClient();
    if (!client) return;
    const q = safeOrQuery(qEl && qEl.value ? qEl.value : '');
    const table = activeTab === 'demands' ? 'crm_demands' : 'crm_contacts';
    const filename = activeTab === 'demands' ? 'scp-crm-leads.csv' : 'scp-crm-contacts.csv';
    const columns = activeTab === 'demands'
      ? [
        'external_client_code', 'external_demand_number', 'title', 'operation',
        'price_min', 'price_max', 'beds_min', 'baths_min',
        'zones', 'types',
        'want_pool', 'want_terrace', 'want_garage', 'want_lift',
        'notes', 'source', 'source_created_at', 'source_updated_at'
      ]
      : [
        'external_client_code', 'first_name', 'last_name', 'email',
        'phone1', 'phone2', 'phone3',
        'locality', 'province', 'nationality', 'client_type',
        'notes', 'source', 'source_created_at', 'source_updated_at'
      ];

    const toCsvCell = (v) => {
      const s = v == null ? '' : String(v);
      const q2 = s.replace(/"/g, '""');
      return `"${q2}"`;
    };

    const fetchAll = async () => {
      const rows = [];
      let offset = 0;
      while (true) {
        let query = client.from(table).select(columns.join(','), { count: 'exact' }).order('source_updated_at', { ascending: false }).order('created_at', { ascending: false });
        if (q) {
          if (table === 'crm_contacts') {
            query = query.or(
              [
                `email.ilike.%${q}%`,
                `first_name.ilike.%${q}%`,
                `last_name.ilike.%${q}%`,
                `phone1.ilike.%${q}%`,
                `external_client_code.ilike.%${q}%`
              ].join(',')
            );
          } else {
            query = query.or(
              [
                `external_client_code.ilike.%${q}%`,
                `external_demand_number.ilike.%${q}%`,
                `title.ilike.%${q}%`,
                `zones.ilike.%${q}%`,
                `types.ilike.%${q}%`
              ].join(',')
            );
          }
        }
        const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        const chunk = Array.isArray(data) ? data : [];
        rows.push(...chunk);
        if (!chunk.length || chunk.length < PAGE_SIZE) break;
        offset += chunk.length;
        if (offset > 20000) break; // safety cap
      }
      return rows;
    };

    try {
      setStatus('Exporting…');
      const rows = await fetchAll();
      const header = columns.map(toCsvCell).join(',');
      const lines = [header];
      rows.forEach((r) => {
        lines.push(columns.map((c) => toCsvCell(r && r[c])).join(','));
      });
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus(`Exported ${rows.length} rows.`);
      window.setTimeout(() => setStatus(''), 1200);
    } catch (error) {
      setStatus(`Export failed: ${(error && error.message) ? error.message : String(error)}`);
    }
  }

  async function init() {
    const client = getClient();
    if (!client) {
      setStatus('Supabase not configured.');
      return;
    }

    setStatus('Checking session…');
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

    setStatus('');
    setTab('contacts');
    await loadContacts({ reset: true });
  }

  if (tabContacts) tabContacts.addEventListener('click', async () => { setTab('contacts'); await loadContacts({ reset: false }); });
  if (tabDemands) tabDemands.addEventListener('click', async () => { setTab('demands'); await loadDemands({ reset: false }); });
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadActive({ reset: true }));
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', () => loadActive({ reset: false }));
  if (exportBtn) exportBtn.addEventListener('click', exportCsv);

  if (qEl) {
    qEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        loadActive({ reset: true });
      }
    });
  }

  const handleTableClick = async (e) => {
    const btn = e && e.target ? e.target.closest('[data-action]') : null;
    if (btn) {
      const action = btn.getAttribute('data-action') || '';
      if (action === 'edit') {
        const kind = btn.getAttribute('data-kind') || '';
        const id = btn.getAttribute('data-id') || '';
        if (!id) return;
        await openEditor(kind === 'demand' ? 'demand' : 'contact', id);
        return;
      }
      if (action === 'jump-contact') {
        const clientCode = btn.getAttribute('data-client') || '';
        if (qEl && clientCode) qEl.value = clientCode;
        setTab('contacts');
        await loadContacts({ reset: true });
        return;
      }
    }

    // Allow normal link navigation (mailto/tel/etc) without opening the editor.
    const a = e && e.target ? e.target.closest('a') : null;
    if (a) return;

    const row = e && e.target ? e.target.closest('tr[data-id]') : null;
    if (!row) return;
    const id = row.getAttribute('data-id') || '';
    const kind = row.getAttribute('data-kind') || '';
    if (!id) return;
    await openEditor(kind === 'demand' ? 'demand' : 'contact', id);
  };

  if (contactsTbody) contactsTbody.addEventListener('click', handleTableClick);
  if (demandsTbody) demandsTbody.addEventListener('click', handleTableClick);

  if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
  if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawerOpen) closeDrawer();
  });

  if (drawerBody) {
    drawerBody.addEventListener('click', async (e) => {
      const btn = e && e.target ? e.target.closest('[data-action]') : null;
      if (!btn) return;
      const action = btn.getAttribute('data-action') || '';
      if (action === 'close-drawer') {
        closeDrawer();
        return;
      }
      if (action === 'jump-leads') {
        const clientCode = btn.getAttribute('data-client') || '';
        closeDrawer();
        if (qEl && clientCode) qEl.value = clientCode;
        setTab('demands');
        await loadDemands({ reset: true });
        return;
      }
      if (action === 'jump-contact') {
        const clientCode = btn.getAttribute('data-client') || '';
        closeDrawer();
        if (qEl && clientCode) qEl.value = clientCode;
        setTab('contacts');
        await loadContacts({ reset: true });
        return;
      }
    });

    drawerBody.addEventListener('submit', async (e) => {
      const form = e && e.target ? e.target.closest('form[data-form]') : null;
      if (!form) return;
      e.preventDefault();
      const client = getClient();
      if (!client) return;
      const kind = form.getAttribute('data-form') || '';
      const id = form.getAttribute('data-id') || '';
      if (!id) return;

      const submitBtn = form.querySelector('button[type="submit"]');
      const prev = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
      }

      try {
        if (kind === 'demand') {
          await saveDemand(client, form, id);
        } else {
          await saveContact(client, form, id);
        }
        setStatus('Saved.');
        window.setTimeout(() => setStatus(''), 900);
        closeDrawer();
        updateShowingLine();
      } catch (error) {
        setStatus(`Save failed: ${(error && error.message) ? error.message : String(error)}`);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = prev || 'Save changes';
        }
      }
    });
  }

  window.addEventListener('scp:supabase:ready', () => init(), { once: true });
  window.setTimeout(init, 80);
})();
