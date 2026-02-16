(() => {
  const statusEl = document.getElementById('aff-status');
  const authGate = document.getElementById('aff-auth-gate');
  const dash = document.getElementById('aff-dashboard');

  const codeEl = document.getElementById('aff-code');
  const codeMetaEl = document.getElementById('aff-code-meta');
  const copyCodeBtn = document.getElementById('aff-copy-code');

  const linkBuy = document.getElementById('aff-link-buy');
  const linkSell = document.getElementById('aff-link-sell');
  const linkServices = document.getElementById('aff-link-services');
  const linkViewingPrivileges = document.getElementById('aff-link-viewing-privileges');
  const refInput = document.getElementById('aff-ref');
  const linkListing = document.getElementById('aff-link-listing');
  const linkBrochure = document.getElementById('aff-link-brochure');
  const linkReel = document.getElementById('aff-link-reel');
  const openListingBtn = document.getElementById('aff-open-listing');
  const openViewingPrivilegesBtn = document.getElementById('aff-open-viewing-privileges');

  const payoutPref = document.getElementById('aff-payout-pref');
  const payoutNote = document.getElementById('aff-payout-note');
  const payoutSave = document.getElementById('aff-payout-save');
  const acceptTermsBtn = document.getElementById('aff-accept-terms');
  const settingsStatus = document.getElementById('aff-settings-status');

  const refreshBtn = document.getElementById('aff-refresh');
  const exportBtn = document.getElementById('aff-export');
  const summaryEl = document.getElementById('aff-summary');
  const eventsTbody = document.querySelector('#aff-events-table tbody');

  const getClient = () => window.scpSupabase || null;

  const setVisible = (el, yes, display = 'block') => {
    if (!el) return;
    el.style.display = yes ? display : 'none';
  };

  const setStatus = (text) => {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.style.display = text ? 'block' : 'none';
  };

  const setSettingsStatus = (text) => {
    if (!settingsStatus) return;
    settingsStatus.textContent = text || '';
  };

  const esc = (value) => {
    const s = value == null ? '' : String(value);
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  const toText = (v) => (v == null ? '' : String(v));

  const t = (key, fallback) => {
    try {
      if (window.SCP_I18N && typeof window.SCP_I18N.t === 'function') {
        const out = window.SCP_I18N.t(key);
        if (out && out !== key) return out;
      }
    } catch {
      // ignore
    }
    return fallback;
  };

  const normalizeRef = (raw) => toText(raw).trim().toUpperCase().replace(/\s+/g, '');

  const buildUrl = (path, params = {}) => {
    const cleanPath = toText(path).replace(/^\.?\//, '');
    const url = new URL(cleanPath, window.location.href);
    Object.entries(params || {}).forEach(([k, v]) => {
      const val = toText(v).trim();
      if (!val) url.searchParams.delete(k);
      else url.searchParams.set(k, val);
    });
    return url.toString();
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

  const fmtTime = (value) => {
    const d = value ? new Date(value) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    try {
      return d.toLocaleString();
    } catch {
      return d.toISOString();
    }
  };

  const copyToClipboard = async (text) => {
    const v = toText(text).trim();
    if (!v) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(v);
        return true;
      }
    } catch {
      // ignore
    }
    try {
      window.prompt(t('common.copy_prompt', 'Copy:'), v);
      return true;
    } catch {
      return false;
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

  let currentUser = null;
  let currentCode = '';
  let currentAccount = null;
  let lastEvents = [];

  const renderLinks = () => {
    const code = toText(currentCode).trim();
    if (!code) return;

    const buy = buildUrl('properties.html', { aff: code });
    const sell = buildUrl('property-add.html', { aff: code });
    const services = buildUrl('services.html', { aff: code });
    const viewingPrivileges = buildUrl('viewing-privileges.html', { aff: code });

    if (linkBuy) linkBuy.value = buy;
    if (linkSell) linkSell.value = sell;
    if (linkServices) linkServices.value = services;
    if (linkViewingPrivileges) linkViewingPrivileges.value = viewingPrivileges;
    if (openViewingPrivilegesBtn) openViewingPrivilegesBtn.href = viewingPrivileges;

    const ref = normalizeRef(refInput ? refInput.value : '');
    const sharePage = (/^SCP-\d+$/.test(ref))
      ? buildUrl(`share/listing/${encodeURIComponent(ref)}.html`, { aff: code })
      : (ref ? buildUrl('properties.html', { ref, aff: code }) : '');

    const brochure = ref ? buildUrl('brochure.html', { ref, aff: code }) : '';
    const reel = ref ? buildUrl('reel.html', { ref, aff: code }) : '';

    if (linkListing) linkListing.value = sharePage;
    if (linkBrochure) linkBrochure.value = brochure;
    if (linkReel) linkReel.value = reel;
    if (openListingBtn) openListingBtn.href = sharePage || (ref ? buildUrl('properties.html', { ref, aff: code }) : buildUrl('properties.html', { aff: code }));
  };

  const renderAccount = () => {
    const acct = currentAccount || {};
    const code = toText(acct.code).trim();
    const status = toText(acct.status).trim() || 'active';
    const termsAt = acct.terms_accepted_at ? String(acct.terms_accepted_at) : '';
    const payout = toText(acct.payout_preference).trim() || 'cash';
    const note = toText(acct.payout_note).trim();

    currentCode = code;
    if (codeEl) codeEl.textContent = code || '—';
    if (codeMetaEl) {
      const meta = [];
      meta.push(status ? `${t('affiliate.meta.status', 'Status')}: ${status}` : '');
      meta.push(termsAt ? t('affiliate.meta.terms_ok', 'Terms: accepted') : t('affiliate.meta.terms_missing', 'Terms: not accepted yet'));
      codeMetaEl.textContent = meta.filter(Boolean).join(' · ');
    }

    if (payoutPref) payoutPref.value = payout === 'goods_services' ? 'goods_services' : 'cash';
    if (payoutNote) payoutNote.value = note;

    renderLinks();
  };

  const renderEvents = () => {
    const rows = Array.isArray(lastEvents) ? lastEvents : [];
    if (!eventsTbody) return;

    const totals = { pending: 0, approved: 0, paid: 0, rejected: 0 };
    rows.forEach((r) => {
      const st = toText(r && r.status).trim().toLowerCase();
      const val = Number(r && r.commission_eur);
      if (!Number.isFinite(val)) return;
      if (st === 'paid') totals.paid += val;
      else if (st === 'pending') totals.pending += val;
      else if (st === 'rejected') totals.rejected += val;
      else totals.approved += val;
    });

    if (summaryEl) {
      summaryEl.textContent = [
        `${t('affiliate.summary.approved', 'Approved')}: ${fmtMoney(totals.approved)}`,
        `${t('affiliate.summary.pending', 'Pending')}: ${fmtMoney(totals.pending)}`,
        `${t('affiliate.summary.paid', 'Paid')}: ${fmtMoney(totals.paid)}`
      ].join(' · ');
    }

    eventsTbody.innerHTML = rows.map((r) => {
      const created = fmtTime(r && r.created_at);
      const sourceType = toText(r && r.source_type).trim();
      const sourceRef = toText(r && r.source_ref).trim();
      const amount = fmtMoney(r && r.amount_eur);
      const commission = fmtMoney(r && r.commission_eur);
      const status = toText(r && r.status).trim();
      const paid = r && r.paid_at ? fmtTime(r.paid_at) : '';
      const note = toText(r && r.note).trim();
      return `
        <tr>
          <td>${esc(created)}</td>
          <td>${esc(sourceType || 'manual')}</td>
          <td>${sourceRef ? `<span class="muted">${esc(sourceRef)}</span>` : '<span class="muted">—</span>'}</td>
          <td>${esc(amount)}</td>
          <td>${esc(commission)}</td>
          <td>${esc(status || 'approved')}</td>
          <td>${paid ? `<span class="muted">${esc(paid)}</span>` : '<span class="muted">—</span>'}</td>
          <td>${note ? `<span class="muted" title="${esc(note)}">${esc(note.length > 52 ? `${note.slice(0, 52)}…` : note)}</span>` : '<span class="muted">—</span>'}</td>
        </tr>
      `;
    }).join('');
  };

  const loadAccount = async (client) => {
    const out = await client.rpc('affiliate_get_or_create');
    const data = out && out.data ? out.data : null;
    const row = Array.isArray(data) && data.length ? data[0] : (data && typeof data === 'object' ? data : null);
    currentAccount = row;
    renderAccount();
  };

  const loadEvents = async (client, user) => {
    const out = await client
      .from('affiliate_revenue_events')
      .select('id,created_at,source_type,source_ref,amount_eur,commission_rate,commission_eur,status,paid_at,note')
      .eq('affiliate_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(250);
    if (out && out.error) throw out.error;
    lastEvents = Array.isArray(out && out.data) ? out.data : [];
    renderEvents();
  };

  const refresh = async () => {
    const client = getClient();
    if (!client) {
      setStatus(t('affiliate.status.supabase_missing', 'Affiliate dashboard unavailable (Supabase not configured).'));
      setVisible(authGate, false);
      setVisible(dash, false);
      return;
    }

    setStatus('');
    const { data } = await client.auth.getSession();
    const session = data && data.session ? data.session : null;
    const user = session && session.user ? session.user : null;
    currentUser = user;

    if (!user) {
      setVisible(authGate, true);
      setVisible(dash, false);
      return;
    }

    setVisible(authGate, false);
    setVisible(dash, true);

    try {
      await loadAccount(client);
    } catch (err) {
      const msg = err && err.message ? String(err.message) : String(err);
      setStatus(`${t('affiliate.status.load_failed', 'Failed to load affiliate account')}: ${msg}`);
    }

    try {
      await loadEvents(client, user);
    } catch (err) {
      const msg = err && err.message ? String(err.message) : String(err);
      if (summaryEl) summaryEl.textContent = `${t('affiliate.status.earnings_failed', 'Failed to load earnings')}: ${msg}`;
      if (eventsTbody) eventsTbody.innerHTML = '';
    }
  };

  const wireUi = () => {
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', async () => {
        const ok = await copyToClipboard(currentCode);
        setStatus(ok ? t('affiliate.status.code_copied', 'Code copied.') : t('affiliate.status.copy_failed', 'Copy failed.'));
        window.setTimeout(() => setStatus(''), 1400);
      });
    }

    document.addEventListener('click', async (event) => {
      const el = event && event.target ? event.target : null;
      if (!el) return;
      const btn = el.closest('[data-copy-target]');
      if (!btn) return;
      const id = btn.getAttribute('data-copy-target') || '';
      const input = id ? document.getElementById(id) : null;
      const value = input && 'value' in input ? String(input.value || '') : '';
      const ok = await copyToClipboard(value);
      setStatus(ok ? t('affiliate.status.link_copied', 'Link copied.') : t('affiliate.status.copy_failed', 'Copy failed.'));
      window.setTimeout(() => setStatus(''), 1400);
    });

    if (refInput) {
      refInput.addEventListener('input', () => {
        renderLinks();
      });
      refInput.addEventListener('change', () => renderLinks());
    }

    if (payoutSave) {
      payoutSave.addEventListener('click', async () => {
        const client = getClient();
        if (!client || !currentUser) return;
        const pref = payoutPref ? String(payoutPref.value || 'cash') : 'cash';
        const note = payoutNote ? String(payoutNote.value || '') : '';
        setSettingsStatus(t('common.saving', 'Saving…'));
        try {
          const out = await client.rpc('affiliate_set_payout', { preference: pref, note });
          if (out && out.error) throw out.error;
          setSettingsStatus(t('common.saved', 'Saved.'));
          await loadAccount(client);
        } catch (err) {
          const msg = err && err.message ? String(err.message) : String(err);
          setSettingsStatus(`${t('common.save_failed', 'Save failed')}: ${msg}`);
        }
        window.setTimeout(() => setSettingsStatus(''), 4500);
      });
    }

    if (acceptTermsBtn) {
      acceptTermsBtn.addEventListener('click', async () => {
        const client = getClient();
        if (!client || !currentUser) return;
        setSettingsStatus(t('affiliate.settings.accepting', 'Accepting terms…'));
        try {
          const out = await client.rpc('affiliate_accept_terms', { version: '2026-02-15' });
          if (out && out.error) throw out.error;
          setSettingsStatus(t('affiliate.settings.accepted', 'Terms accepted.'));
          await loadAccount(client);
        } catch (err) {
          const msg = err && err.message ? String(err.message) : String(err);
          setSettingsStatus(`${t('affiliate.settings.accept_failed', 'Accept failed')}: ${msg}`);
        }
        window.setTimeout(() => setSettingsStatus(''), 4500);
      });
    }

    if (refreshBtn) refreshBtn.addEventListener('click', () => refresh());

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const rows = Array.isArray(lastEvents) ? lastEvents : [];
        const header = ['created_at', 'source_type', 'source_ref', 'amount_eur', 'commission_rate', 'commission_eur', 'status', 'paid_at', 'note'];
        const out = [header];
        rows.forEach((r) => {
          out.push([
            toText(r && r.created_at),
            toText(r && r.source_type),
            toText(r && r.source_ref),
            toText(r && r.amount_eur),
            toText(r && r.commission_rate),
            toText(r && r.commission_eur),
            toText(r && r.status),
            toText(r && r.paid_at),
            toText(r && r.note)
          ]);
        });
        downloadCsv('scp-affiliate-earnings.csv', out);
      });
    }
  };

  wireUi();
  refresh();

  // Auto-refresh after sign-in/out.
  window.addEventListener('scp:supabase:ready', () => refresh());
})();
