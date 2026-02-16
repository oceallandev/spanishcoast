(() => {
  const statusEl = document.getElementById('aff-admin-status');
  const refreshBtn = document.getElementById('aff-admin-refresh');
  const exportEventsBtn = document.getElementById('aff-admin-export-events');
  const exportAffiliatesBtn = document.getElementById('aff-admin-export-affiliates');

  const createForm = document.getElementById('aff-admin-create');
  const createCode = document.getElementById('aff-admin-code');
  const createEmail = document.getElementById('aff-admin-email');
  const createAmount = document.getElementById('aff-admin-amount');
  const createType = document.getElementById('aff-admin-type');
  const createSourceRef = document.getElementById('aff-admin-source-ref');
  const createNote = document.getElementById('aff-admin-note');
  const createBtn = document.getElementById('aff-admin-create-btn');
  const createStatus = document.getElementById('aff-admin-create-status');

  const eventsTbody = document.querySelector('#aff-admin-events tbody');
  const affiliatesTbody = document.querySelector('#aff-admin-affiliates tbody');

  const getClient = () => window.scpSupabase || null;

  const toText = (v) => (v == null ? '' : String(v));
  const norm = (v) => toText(v).trim();
  const normLower = (v) => norm(v).toLowerCase();

  const escape = (value) => {
    const s = value == null ? '' : String(value);
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  const setStatus = (text) => {
    if (statusEl) statusEl.textContent = text || '';
  };

  const setCreateStatus = (text) => {
    if (createStatus) createStatus.textContent = text || '';
  };

  const fmtTime = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    try {
      return d.toLocaleString();
    } catch {
      return d.toISOString();
    }
  };

  const fmtMoney = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    try {
      return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
    } catch {
      return `€${n.toFixed(2)}`;
    }
  };

  const csvEscape = (value) => {
    const s = value == null ? '' : String(value);
    if (!/[,"\n]/.test(s)) return s;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const downloadCsv = (filename, rows) => {
    try {
      const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  const withTimeout = async (promise, ms, label) => {
    let t;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          t = window.setTimeout(() => reject(new Error(`${label || 'Request'} timed out after ${ms}ms`)), ms);
        })
      ]);
    } finally {
      if (t) window.clearTimeout(t);
    }
  };

  const AUTH_TIMEOUT_MS = 60000;

  async function requireAdmin(client) {
    const out = await withTimeout(client.auth.getSession(), AUTH_TIMEOUT_MS, 'Session');
    const session = out && out.data ? out.data.session : null;
    const user = session && session.user ? session.user : null;
    if (!user || !user.id) throw new Error('Not signed in.');

    const prof = await withTimeout(
      client.from('profiles').select('role').eq('user_id', user.id).maybeSingle(),
      AUTH_TIMEOUT_MS,
      'Load role'
    );
    const role = prof && prof.data && prof.data.role ? String(prof.data.role) : '';
    if (String(role) !== 'admin') throw new Error('Admin only.');
    return user;
  }

  let cachedEvents = [];
  let cachedAffiliates = [];
  let cachedProfilesById = {};

  const loadProfilesForUserIds = async (client, userIds) => {
    const ids = Array.from(new Set((userIds || []).map((x) => String(x || '').trim()).filter(Boolean)));
    if (!ids.length) return {};
    const out = await withTimeout(
      client.from('profiles').select('user_id,email,display_name').in('user_id', ids).limit(5000),
      AUTH_TIMEOUT_MS,
      'Load profiles'
    );
    const rows = Array.isArray(out && out.data) ? out.data : [];
    const map = {};
    rows.forEach((r) => {
      const id = r && r.user_id ? String(r.user_id) : '';
      if (!id) return;
      map[id] = r;
    });
    return map;
  };

  const renderEvents = () => {
    if (!eventsTbody) return;
    const rows = Array.isArray(cachedEvents) ? cachedEvents : [];

    eventsTbody.innerHTML = rows.map((r) => {
      const id = norm(r && r.id);
      const created = fmtTime(r && r.created_at);
      const code = norm(r && r.affiliate_code);
      const email = norm(r && r.customer_email);
      const type = norm(r && r.source_type) || 'manual';
      const ref = norm(r && r.source_ref);
      const amount = fmtMoney(r && r.amount_eur);
      const commission = fmtMoney(r && r.commission_eur);
      const status = normLower(r && r.status) || 'approved';
      const payoutMethod = normLower(r && r.payout_method);
      const payoutRef = norm(r && r.payout_ref);
      const note = norm(r && r.note);

      const statusOpts = ['pending', 'approved', 'paid', 'rejected']
        .map((v) => `<option value="${escape(v)}"${v === status ? ' selected' : ''}>${escape(v)}</option>`)
        .join('');
      const payoutOpts = ['', 'cash', 'goods_services']
        .map((v) => `<option value="${escape(v)}"${v === payoutMethod ? ' selected' : ''}>${escape(v || '—')}</option>`)
        .join('');

      return `
        <tr data-event-id="${escape(id)}">
          <td>${escape(created)}</td>
          <td><span class="crm-badge">${escape(code)}</span></td>
          <td>${email ? `<a class="admin-link" href="mailto:${escape(email)}">${escape(email)}</a>` : '<span class="muted">—</span>'}</td>
          <td>${escape(type)}</td>
          <td>${ref ? `<span class="muted">${escape(ref)}</span>` : '<span class="muted">—</span>'}</td>
          <td><span class="muted">${escape(amount)}</span></td>
          <td><span class="muted">${escape(commission)}</span></td>
          <td>
            <select class="admin-select" data-field="status" style="min-width:140px">
              ${statusOpts}
            </select>
          </td>
          <td>
            <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
              <select class="admin-select" data-field="payout_method" style="min-width:150px">
                ${payoutOpts}
              </select>
              <input class="admin-input" data-field="payout_ref" style="min-width:180px" placeholder="ref" value="${escape(payoutRef)}">
            </div>
          </td>
          <td><input class="admin-input" data-field="note" style="min-width:220px" value="${escape(note)}"></td>
          <td><button class="cta-button cta-button--outline" type="button" data-save-event>Save</button></td>
        </tr>
      `;
    }).join('');
  };

  const renderAffiliates = () => {
    if (!affiliatesTbody) return;
    const rows = Array.isArray(cachedAffiliates) ? cachedAffiliates : [];

    affiliatesTbody.innerHTML = rows.map((r) => {
      const uid = norm(r && r.user_id);
      const p = uid && cachedProfilesById ? cachedProfilesById[uid] : null;
      const email = norm(p && p.email);
      const name = norm(p && p.display_name);

      const created = fmtTime(r && r.created_at);
      const code = norm(r && r.code);
      const status = normLower(r && r.status) || 'active';
      const rate = r && r.commission_rate != null ? String(r.commission_rate) : '0.10';
      const terms = r && r.terms_accepted_at ? fmtTime(r.terms_accepted_at) : '';
      const pref = normLower(r && r.payout_preference) || 'cash';
      const note = norm(r && r.payout_note);

      const statusOpts = ['active', 'paused', 'banned']
        .map((v) => `<option value="${escape(v)}"${v === status ? ' selected' : ''}>${escape(v)}</option>`)
        .join('');

      return `
        <tr data-affiliate-id="${escape(uid)}">
          <td>${escape(created)}</td>
          <td>
            <div class="crm-cell">
              <div class="crm-primary">${escape(email || uid.slice(0, 8))}</div>
              <div class="muted">${escape(name || uid)}</div>
            </div>
          </td>
          <td><span class="crm-badge">${escape(code)}</span></td>
          <td>
            <select class="admin-select" data-field="status" style="min-width:140px">
              ${statusOpts}
            </select>
          </td>
          <td><input class="admin-input" data-field="commission_rate" style="min-width:120px" value="${escape(rate)}"></td>
          <td>${terms ? `<span class="muted">${escape(terms)}</span>` : '<span class="muted">—</span>'}</td>
          <td><span class="muted">${escape(pref)}</span></td>
          <td><span class="muted" title="${escape(note)}">${escape(note.length > 48 ? `${note.slice(0, 48)}…` : note) || '—'}</span></td>
          <td><button class="cta-button cta-button--outline" type="button" data-save-affiliate>Save</button></td>
        </tr>
      `;
    }).join('');
  };

  const loadAll = async () => {
    const client = getClient();
    if (!client) return;
    setStatus('Loading…');

    await requireAdmin(client);

    const [eventsOut, affiliatesOut] = await Promise.all([
      withTimeout(
        client.from('affiliate_revenue_events')
          .select('id,created_at,affiliate_code,customer_email,source_type,source_ref,amount_eur,commission_rate,commission_eur,status,payout_method,payout_ref,paid_at,note,updated_at')
          .order('created_at', { ascending: false })
          .limit(250),
        AUTH_TIMEOUT_MS,
        'Load events'
      ),
      withTimeout(
        client.from('affiliate_accounts')
          .select('user_id,code,status,commission_rate,terms_accepted_at,payout_preference,payout_note,created_at,updated_at')
          .order('created_at', { ascending: false })
          .limit(250),
        AUTH_TIMEOUT_MS,
        'Load affiliates'
      )
    ]);

    if (eventsOut && eventsOut.error) throw eventsOut.error;
    if (affiliatesOut && affiliatesOut.error) throw affiliatesOut.error;

    cachedEvents = Array.isArray(eventsOut && eventsOut.data) ? eventsOut.data : [];
    cachedAffiliates = Array.isArray(affiliatesOut && affiliatesOut.data) ? affiliatesOut.data : [];

    const ids = cachedAffiliates.map((r) => r && r.user_id).filter(Boolean);
    cachedProfilesById = await loadProfilesForUserIds(client, ids);

    renderEvents();
    renderAffiliates();
    setStatus(`Loaded ${cachedEvents.length} event(s) and ${cachedAffiliates.length} affiliate(s).`);
  };

  const wire = () => {
    if (refreshBtn) refreshBtn.addEventListener('click', () => loadAll().catch((e) => setStatus(String(e && e.message ? e.message : e))));

    if (createForm) {
      createForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const client = getClient();
        if (!client) return;
        setCreateStatus('Creating…');
        if (createBtn) createBtn.disabled = true;
        try {
          await requireAdmin(client);
          const payload = {
            affiliate_code: norm(createCode && createCode.value),
            amount_eur: Number(createAmount && createAmount.value),
            source_type: norm(createType && createType.value) || 'manual',
            source_ref: norm(createSourceRef && createSourceRef.value) || null,
            note: norm(createNote && createNote.value) || null,
            customer_email: norm(createEmail && createEmail.value) || null
          };
          const out = await withTimeout(client.rpc('admin_affiliate_create_event', payload), AUTH_TIMEOUT_MS, 'Create event');
          if (out && out.error) throw out.error;
          setCreateStatus('Created.');
          if (createForm) createForm.reset();
          await loadAll();
        } catch (err) {
          setCreateStatus(`Create failed: ${err && err.message ? err.message : String(err)}`);
        } finally {
          if (createBtn) createBtn.disabled = false;
          window.setTimeout(() => setCreateStatus(''), 6000);
        }
      });
    }

    if (eventsTbody) {
      eventsTbody.addEventListener('click', async (event) => {
        const el = event && event.target ? event.target : null;
        const btn = el && el.closest ? el.closest('[data-save-event]') : null;
        if (!btn) return;
        const row = btn.closest('tr[data-event-id]');
        if (!row) return;
        const id = row.getAttribute('data-event-id') || '';
        if (!id) return;

        const client = getClient();
        if (!client) return;

        btn.disabled = true;
        setStatus('Saving event…');
        try {
          await requireAdmin(client);
          const read = (field) => {
            const input = row.querySelector(`[data-field="${field}"]`);
            return input ? norm(input.value) : '';
          };
          const patch = {
            status: read('status') || 'approved',
            payout_method: read('payout_method') || null,
            payout_ref: read('payout_ref') || null,
            note: read('note') || null
          };
          const out = await withTimeout(
            client.from('affiliate_revenue_events').update(patch).eq('id', id),
            AUTH_TIMEOUT_MS,
            'Save event'
          );
          if (out && out.error) throw out.error;
          await loadAll();
        } catch (err) {
          setStatus(`Save failed: ${err && err.message ? err.message : String(err)}`);
        } finally {
          btn.disabled = false;
          window.setTimeout(() => setStatus(''), 5000);
        }
      });
    }

    if (affiliatesTbody) {
      affiliatesTbody.addEventListener('click', async (event) => {
        const el = event && event.target ? event.target : null;
        const btn = el && el.closest ? el.closest('[data-save-affiliate]') : null;
        if (!btn) return;
        const row = btn.closest('tr[data-affiliate-id]');
        if (!row) return;
        const id = row.getAttribute('data-affiliate-id') || '';
        if (!id) return;

        const client = getClient();
        if (!client) return;

        btn.disabled = true;
        setStatus('Saving affiliate…');
        try {
          await requireAdmin(client);
          const read = (field) => {
            const input = row.querySelector(`[data-field="${field}"]`);
            return input ? norm(input.value) : '';
          };
          const status = read('status') || 'active';
          const rateRaw = read('commission_rate');
          const rate = rateRaw ? Number(rateRaw) : null;
          const patch = {
            status,
            commission_rate: (rate != null && Number.isFinite(rate)) ? rate : null
          };
          // Do not set commission_rate null unless admin intentionally clears it.
          if (patch.commission_rate == null) delete patch.commission_rate;

          const out = await withTimeout(
            client.from('affiliate_accounts').update(patch).eq('user_id', id),
            AUTH_TIMEOUT_MS,
            'Save affiliate'
          );
          if (out && out.error) throw out.error;
          await loadAll();
        } catch (err) {
          setStatus(`Save failed: ${err && err.message ? err.message : String(err)}`);
        } finally {
          btn.disabled = false;
          window.setTimeout(() => setStatus(''), 5000);
        }
      });
    }

    if (exportEventsBtn) {
      exportEventsBtn.addEventListener('click', () => {
        const rows = Array.isArray(cachedEvents) ? cachedEvents : [];
        const header = ['id', 'created_at', 'affiliate_code', 'customer_email', 'source_type', 'source_ref', 'amount_eur', 'commission_rate', 'commission_eur', 'status', 'payout_method', 'payout_ref', 'paid_at', 'note'];
        const out = [header];
        rows.forEach((r) => {
          out.push(header.map((k) => toText(r && r[k])));
        });
        downloadCsv('scp-affiliate-events.csv', out);
      });
    }

    if (exportAffiliatesBtn) {
      exportAffiliatesBtn.addEventListener('click', () => {
        const rows = Array.isArray(cachedAffiliates) ? cachedAffiliates : [];
        const header = ['user_id', 'email', 'display_name', 'code', 'status', 'commission_rate', 'terms_accepted_at', 'payout_preference', 'payout_note', 'created_at', 'updated_at'];
        const out = [header];
        rows.forEach((r) => {
          const uid = norm(r && r.user_id);
          const p = uid && cachedProfilesById ? cachedProfilesById[uid] : null;
          out.push([
            uid,
            toText(p && p.email),
            toText(p && p.display_name),
            toText(r && r.code),
            toText(r && r.status),
            toText(r && r.commission_rate),
            toText(r && r.terms_accepted_at),
            toText(r && r.payout_preference),
            toText(r && r.payout_note),
            toText(r && r.created_at),
            toText(r && r.updated_at)
          ]);
        });
        downloadCsv('scp-affiliates.csv', out);
      });
    }
  };

  wire();
  loadAll().catch((err) => {
    setStatus(err && err.message ? err.message : String(err));
  });
})();

