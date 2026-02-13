(() => {
  const statusBox = document.getElementById('scout-status');
  const authGate = document.getElementById('scout-auth-gate');
  const joinPanel = document.getElementById('scout-join');
  const joinBtn = document.getElementById('scout-join-btn');
  const formPanel = document.getElementById('scout-form-panel');
  const adminLink = document.getElementById('scout-admin-link');
  const form = document.getElementById('scout-form');
  const submitBtn = document.getElementById('scout-submit');
  const photoInput = document.getElementById('scout-photo');
  const previewWrap = document.getElementById('scout-preview-wrap');
  const previewImg = document.getElementById('scout-preview');
  const previewMeta = document.getElementById('scout-preview-meta');
  const locationBtn = document.getElementById('scout-location-btn');
  const locationText = document.getElementById('scout-location-text');
  const phoneInput = document.getElementById('scout-phone');
  const tierSelect = document.getElementById('scout-tier');
  const notesInput = document.getElementById('scout-notes');
  const confirmCheck = document.getElementById('scout-confirm');
  const myPanel = document.getElementById('scout-my-panel');
  const myStatus = document.getElementById('scout-my-status');
  const myTbody = document.querySelector('#scout-my-table tbody');
  const myRefresh = document.getElementById('scout-refresh');

  const getClient = () => window.scpSupabase || null;
  const i18n = window.SCP_I18N || null;
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
      if (i18n && typeof i18n.t === 'function') {
        const translated = i18n.t(k, vars);
        if (translated != null) {
          const out = String(translated);
          if (out && out !== k) return out;
        }
      }
    } catch {
      // ignore
    }
    return fallback == null ? k : formatTemplate(fallback, vars);
  };

  const escapeHtml = (value) => {
    const s = value == null ? '' : String(value);
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  const fmtBytes = (bytes) => {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i += 1;
    }
    const dec = i === 0 ? 0 : 1;
    return `${v.toFixed(dec)} ${units[i]}`;
  };

  const setVisible = (el, yes, display = 'block') => {
    if (!el) return;
    el.style.display = yes ? display : 'none';
  };

  const setStatus = (text, { kind = 'info' } = {}) => {
    if (!statusBox) return;
    const msg = String(text || '').trim();
    if (!msg) {
      statusBox.style.display = 'none';
      statusBox.textContent = '';
      statusBox.className = 'glass panel';
      return;
    }
    statusBox.style.display = 'block';
    statusBox.textContent = msg;
    statusBox.className = `glass panel scout-status scout-status--${kind}`;
  };

  async function roleFor(client, userId) {
    try {
      const { data, error } = await client.from('profiles').select('role').eq('user_id', userId).maybeSingle();
      if (error) return '';
      return data && data.role ? String(data.role) : '';
    } catch {
      return '';
    }
  }

  const isPrivileged = (role) => {
    const r = String(role || '').trim().toLowerCase();
    return ['admin', 'partner', 'agency_admin', 'agent', 'developer', 'collaborator'].includes(r);
  };

  const isAdmin = (role) => String(role || '').trim().toLowerCase() === 'admin';

  const uuid = () => {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch {
      // ignore
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  const compressImageFile = async (file, { maxSide = 1600, quality = 0.82 } = {}) => {
    if (!file) throw new Error('Missing file');
    if (!file.type || !file.type.startsWith('image/')) throw new Error('Not an image');

    const img = new Image();
    const url = URL.createObjectURL(file);
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to read image'));
        img.src = url;
      });

      const srcW = img.naturalWidth || img.width || 0;
      const srcH = img.naturalHeight || img.height || 0;
      if (!srcW || !srcH) throw new Error('Invalid image dimensions');

      const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
      const outW = Math.max(1, Math.round(srcW * scale));
      const outH = Math.max(1, Math.round(srcH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.drawImage(img, 0, 0, outW, outH);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) throw new Error('Failed to encode JPEG');

      return {
        blob,
        meta: { srcW, srcH, outW, outH, outBytes: blob.size }
      };
    } finally {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    }
  };

  const getLocation = async ({ timeoutMs = 12000 } = {}) => {
    if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== 'function') {
      throw new Error('Geolocation is not available in this browser.');
    }
    return await new Promise((resolve, reject) => {
      let done = false;
      const timer = window.setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error('Location timed out. Please try again.'));
      }, Math.max(1000, Number(timeoutMs) || 12000));

      navigator.geolocation.getCurrentPosition((pos) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        resolve(pos);
      }, (err) => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        reject(new Error(err && err.message ? String(err.message) : 'Failed to get location.'));
      }, { enableHighAccuracy: true, timeout: Math.max(1000, Number(timeoutMs) || 12000), maximumAge: 0 });
    });
  };

  let currentUser = null;
  let currentRole = '';
  let photoBlob = null;
  let photoMeta = null;
  let location = null; // { lat, lon, acc }

  const updateLocationText = () => {
    if (!locationText) return;
    if (!location) {
      locationText.textContent = t('page.scout.location.none', 'No location yet.');
      return;
    }
    const acc = Number.isFinite(location.acc) ? `${Math.round(location.acc)} m` : '';
    const coords = `${location.lat.toFixed(6)}, ${location.lon.toFixed(6)}`;
    const maps = `https://www.google.com/maps?q=${location.lat},${location.lon}`;
    locationText.innerHTML = `${escapeHtml(coords)}${acc ? ` · ${escapeHtml(acc)}` : ''} · <a class="admin-link" href="${escapeHtml(maps)}" target="_blank" rel="noopener">${escapeHtml(t('page.scout.location.open_maps', 'Open'))}</a>`;
  };

  const setMyStatus = (text) => {
    if (!myStatus) return;
    myStatus.textContent = String(text || '');
  };

  async function loadMine() {
    const client = getClient();
    if (!client || !currentUser) return;
    if (!myTbody) return;

    setMyStatus(t('page.scout.mine.loading', 'Loading…'));
    const { data, error } = await client
      .from('collab_board_leads')
      .select('created_at,status,commission_eur,latitude,longitude,paid_at,sold_at')
      .order('created_at', { ascending: false })
      .limit(120);

    if (error) {
      setMyStatus(`${t('page.scout.mine.failed', 'Failed to load')}: ${error.message || 'unknown error'}`);
      myTbody.innerHTML = '';
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    myTbody.innerHTML = rows.map((row) => {
      const time = row.created_at ? new Date(row.created_at).toLocaleString() : '';
      const status = String(row.status || '').trim() || 'new';
      const reward = row.commission_eur != null && row.commission_eur !== '' ? `€${Number(row.commission_eur).toLocaleString('en-IE')}` : '';
      const lat = toNumber(row.latitude);
      const lon = toNumber(row.longitude);
      const maps = Number.isFinite(lat) && Number.isFinite(lon) ? `https://www.google.com/maps?q=${lat},${lon}` : '';
      const loc = maps ? `<a class="admin-link" href="${escapeHtml(maps)}" target="_blank" rel="noopener">${escapeHtml(t('page.scout.location.open_maps', 'Open'))}</a>` : '';
      const paid = row.paid_at ? ` · ${escapeHtml(t('page.scout.mine.paid', 'Paid'))}` : '';
      const sold = row.sold_at ? ` · ${escapeHtml(t('page.scout.mine.sold', 'Sold'))}` : '';
      return `
        <tr>
          <td>${escapeHtml(time)}</td>
          <td>${escapeHtml(status)}${sold}${paid}</td>
          <td>${escapeHtml(reward)}</td>
          <td>${loc}</td>
        </tr>
      `;
    }).join('');

    setMyStatus(t('page.scout.mine.loaded', `Loaded ${rows.length} submissions.`, { count: rows.length }));
  }

  async function refreshAuthState() {
    const client = getClient();
    if (!client) {
      setStatus(t('page.scout.errors.no_supabase', 'Supabase is not configured.'), { kind: 'bad' });
      setVisible(authGate, true);
      setVisible(joinPanel, false);
      setVisible(formPanel, false);
      setVisible(myPanel, false);
      return;
    }

    let session = null;
    try {
      const { data } = await client.auth.getSession();
      session = data && data.session ? data.session : null;
    } catch (error) {
      setStatus(`${t('page.scout.errors.session', 'Auth session failed')}: ${error && error.message ? error.message : String(error)}`, { kind: 'bad' });
      setVisible(authGate, true);
      setVisible(joinPanel, false);
      setVisible(formPanel, false);
      setVisible(myPanel, false);
      return;
    }

    currentUser = session && session.user ? session.user : null;
    if (!currentUser) {
      setVisible(authGate, true);
      setVisible(joinPanel, false);
      setVisible(formPanel, false);
      setVisible(myPanel, false);
      setStatus('');
      return;
    }

    currentRole = await roleFor(client, currentUser.id);
    setVisible(authGate, false);
    setVisible(myPanel, true);

    if (isAdmin(currentRole) && adminLink) {
      setVisible(adminLink, true, 'inline-flex');
    } else if (adminLink) {
      setVisible(adminLink, false);
    }

    if (isPrivileged(currentRole)) {
      setVisible(joinPanel, false);
      setVisible(formPanel, true);
    } else {
      // Client role: show "become collaborator" one-click.
      setVisible(joinPanel, true);
      setVisible(formPanel, false);
    }

    await loadMine();
  }

  async function becomeCollaborator() {
    const client = getClient();
    if (!client) return;
    if (!currentUser) return;

    setStatus(t('page.scout.join.working', 'Enabling Street Scout…'));
    if (joinBtn) joinBtn.disabled = true;
    try {
      const { data, error } = await client.rpc('become_collaborator');
      if (error) {
        throw new Error(error.message || 'RPC failed');
      }
      const next = data ? String(data) : 'collaborator';
      setStatus(t('page.scout.join.done', 'Street Scout enabled. You can submit now.'), { kind: 'ok' });
      currentRole = next;
      await refreshAuthState();
    } catch (error) {
      setStatus(`${t('page.scout.join.failed', 'Failed to enable')}: ${error && error.message ? error.message : String(error)}`, { kind: 'bad' });
    } finally {
      if (joinBtn) joinBtn.disabled = false;
    }
  }

  async function uploadPhotoAndInsert() {
    const client = getClient();
    if (!client) throw new Error('Supabase not configured');
    if (!currentUser) throw new Error('Signed out');
    if (!photoBlob) throw new Error('Missing photo');
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lon)) {
      throw new Error('Missing location');
    }

    const tier = tierSelect ? String(tierSelect.value || 'standard') : 'standard';
    const commission = tier === 'premium' ? 500 : 200;
    const phone = phoneInput ? String(phoneInput.value || '').trim() : '';
    const notes = notesInput ? String(notesInput.value || '').trim() : '';

    const path = `${currentUser.id}/${uuid()}.jpg`;
    const bucket = 'collab-boards';

    const { error: upErr } = await client
      .storage
      .from(bucket)
      .upload(path, photoBlob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
    if (upErr) {
      throw new Error(upErr.message || 'Upload failed');
    }

    const payload = {
      user_id: currentUser.id,
      user_email: currentUser.email || null,
      photo_bucket: bucket,
      photo_path: path,
      latitude: location.lat,
      longitude: location.lon,
      accuracy_m: Number.isFinite(location.acc) ? Math.round(location.acc) : null,
      phone: phone || null,
      notes: notes || null,
      commission_tier: tier,
      commission_eur: commission,
      status: 'new',
      captured_at: new Date().toISOString()
    };

    const { error: insErr } = await client.from('collab_board_leads').insert(payload);
    if (insErr) {
      throw new Error(insErr.message || 'Insert failed');
    }
  }

  async function handleSubmit(event) {
    if (event) event.preventDefault();
    if (!currentUser) {
      setStatus(t('page.scout.errors.signin_first', 'Please sign in first.'), { kind: 'warn' });
      return;
    }
    if (!isPrivileged(currentRole) && !isAdmin(currentRole)) {
      setStatus(t('page.scout.errors.enable_first', 'Enable Street Scout first.'), { kind: 'warn' });
      return;
    }
    if (!photoBlob) {
      setStatus(t('page.scout.errors.photo_required', 'Please add a photo.'), { kind: 'warn' });
      return;
    }
    if (!location) {
      setStatus(t('page.scout.errors.location_required', 'Please get your location (GPS) to submit.'), { kind: 'warn' });
      return;
    }
    if (confirmCheck && !confirmCheck.checked) {
      setStatus(t('page.scout.errors.confirm_required', 'Please confirm the checkbox.'), { kind: 'warn' });
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setStatus(t('page.scout.form.sending', 'Sending…'));

    try {
      await uploadPhotoAndInsert();
      setStatus(t('page.scout.form.sent', 'Sent. Thank you. We will review and contact the owner/agency.'), { kind: 'ok' });

      // Reset form state.
      photoBlob = null;
      photoMeta = null;
      location = null;
      if (photoInput) photoInput.value = '';
      if (phoneInput) phoneInput.value = '';
      if (notesInput) notesInput.value = '';
      if (confirmCheck) confirmCheck.checked = false;
      if (previewImg) previewImg.removeAttribute('src');
      if (previewMeta) previewMeta.textContent = '';
      setVisible(previewWrap, false);
      updateLocationText();

      await loadMine();
    } catch (error) {
      setStatus(`${t('page.scout.form.failed', 'Failed')}: ${error && error.message ? error.message : String(error)}`, { kind: 'bad' });
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function handlePickPhoto() {
    const file = photoInput && photoInput.files ? photoInput.files[0] : null;
    if (!file) return;

    setStatus(t('page.scout.form.processing', 'Processing photo…'));
    try {
      const out = await compressImageFile(file);
      photoBlob = out.blob;
      photoMeta = out.meta;
      if (previewWrap && previewImg && photoBlob) {
        const url = URL.createObjectURL(photoBlob);
        previewImg.src = url;
        previewImg.onload = () => {
          try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        };
        setVisible(previewWrap, true);
      }
      if (previewMeta && photoMeta) {
        previewMeta.textContent = `${photoMeta.outW}×${photoMeta.outH} · ${fmtBytes(photoMeta.outBytes)}`;
      }
      setStatus('');

      // If we don't have a location yet, try to get one automatically after photo selection.
      if (!location) {
        await handleGetLocation({ silent: true });
      }
    } catch (error) {
      photoBlob = null;
      photoMeta = null;
      setVisible(previewWrap, false);
      setStatus(`${t('page.scout.errors.photo_invalid', 'Invalid photo')}: ${error && error.message ? error.message : String(error)}`, { kind: 'bad' });
    }
  }

  async function handleGetLocation({ silent = false } = {}) {
    if (locationBtn) locationBtn.disabled = true;
    if (!silent) setStatus(t('page.scout.location.working', 'Getting location…'));
    try {
      const pos = await getLocation();
      const coords = pos && pos.coords ? pos.coords : null;
      const lat = coords ? Number(coords.latitude) : NaN;
      const lon = coords ? Number(coords.longitude) : NaN;
      const acc = coords ? Number(coords.accuracy) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('Invalid coordinates');
      location = { lat, lon, acc: Number.isFinite(acc) ? acc : NaN };
      updateLocationText();
      if (!silent) setStatus(t('page.scout.location.ok', 'Location captured.'), { kind: 'ok' });
      if (!silent) {
        window.setTimeout(() => setStatus(''), 1200);
      }
    } catch (error) {
      location = null;
      updateLocationText();
      if (!silent) {
        setStatus(`${t('page.scout.location.failed', 'Failed to get location')}: ${error && error.message ? error.message : String(error)}`, { kind: 'bad' });
      }
    } finally {
      if (locationBtn) locationBtn.disabled = false;
    }
  }

  if (locationBtn) locationBtn.addEventListener('click', () => handleGetLocation());
  if (photoInput) photoInput.addEventListener('change', handlePickPhoto);
  if (form) form.addEventListener('submit', handleSubmit);
  if (joinBtn) joinBtn.addEventListener('click', becomeCollaborator);
  if (myRefresh) myRefresh.addEventListener('click', loadMine);

  updateLocationText();

  window.addEventListener('scp:supabase:ready', () => refreshAuthState(), { once: true });
  window.setTimeout(refreshAuthState, 60);
})();
