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

  const uuid = () => {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch {
      // ignore
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const toIntOrNull = (v) => {
    const n = Number(toText(v).trim());
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  };

  const toNumOrNull = (v) => {
    const n = Number(toText(v).trim());
    return Number.isFinite(n) ? n : null;
  };

  const formatPrice = (it) => {
    const n = Number(it && (it.price ?? it.expectedPrice ?? it.expected_price));
    if (!Number.isFinite(n) || n <= 0) return 'Price on request';
    const num = new Intl.NumberFormat('en-IE', { maximumFractionDigits: 0 }).format(n);
    return `€${num}`;
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

  const getRaw = (row) => {
    const it = row && row.raw ? row.raw : null;
    if (it && typeof it === 'object') return it;
    try {
      const parsed = JSON.parse(toText(it, ''));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const getPhotoPaths = (row) => {
    const raw = row && row.photo_paths != null ? row.photo_paths : row && row.photoPaths != null ? row.photoPaths : null;
    if (Array.isArray(raw)) return raw.map((x) => toText(x).trim()).filter(Boolean);
    if (!raw) return [];
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((x) => toText(x).trim()).filter(Boolean);
      } catch {
        // ignore
      }
    }
    return [];
  };

  function filteredRows() {
    let rows = Array.isArray(lastRows) ? lastRows.slice() : [];
    const st = statusFilter ? normLower(statusFilter.value) : 'pending';
    if (st && st !== 'all') rows = rows.filter((r) => normLower(r && r.status) === st);

    const q = qInput ? normLower(qInput.value) : '';
    if (q) {
      rows = rows.filter((r) => {
        const it = getListing(r);
        const blob = [
          r && r.id,
          r && r.status,
          r && r.source,
          r && r.contact_name,
          r && r.contact_email,
          r && r.contact_phone,
          it && it.type,
          it && it.town,
          it && it.province,
          it && it.description
        ].map((x) => normLower(x)).join(' ');
        return blob.includes(q);
      });
    }

    return rows;
  }

  async function hydrateThumbs() {
    const client = getClient();
    if (!client) return;
    const imgs = Array.from(document.querySelectorAll('img[data-photo-path][data-photo-bucket]'));
    if (!imgs.length) return;

    // Deduplicate by bucket+path to avoid hammering the Storage API.
    const uniq = new Map();
    imgs.forEach((img) => {
      const bucket = toText(img.dataset.photoBucket).trim();
      const path = toText(img.dataset.photoPath).trim();
      const key = `${bucket}::${path}`;
      if (!bucket || !path) return;
      if (!uniq.has(key)) uniq.set(key, { bucket, path, nodes: [] });
      uniq.get(key).nodes.push(img);
    });

    const jobs = Array.from(uniq.values()).slice(0, 80);
    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      try {
        const { data, error } = await client.storage.from(job.bucket).createSignedUrl(job.path, 3600);
        if (error) continue;
        const url = data && data.signedUrl ? String(data.signedUrl) : '';
        if (!url) continue;
        job.nodes.forEach((img) => { img.src = url; });
      } catch {
        // ignore
      }
    }
  }

  function render() {
    if (!tbody) return;
    const rows = filteredRows();

    tbody.innerHTML = rows.map((row) => {
      const it = getListing(row);
      const raw = getRaw(row);
      const time = row && row.created_at ? new Date(row.created_at).toLocaleString() : '';
      const status = normLower(row && row.status) || 'pending';
      const type = toText(it && it.type, '');
      const town = toText(it && it.town, '');
      const beds = toIntOrNull(it && it.beds);
      const baths = toIntOrNull(it && it.baths);
      const built = toIntOrNull(it && (it.builtArea ?? it.built_area ?? it.built));

      const paths = getPhotoPaths(row);
      const bucket = toText(row && row.photo_bucket, 'owner-properties').trim() || 'owner-properties';
      const thumbPath = paths.length ? paths[0] : '';
      const imgTag = thumbPath
        ? `<img class="admin-thumb" data-photo-bucket="${escape(bucket)}" data-photo-path="${escape(thumbPath)}" src="assets/placeholder.png" alt="" loading="lazy">`
        : `<img class="admin-thumb" src="assets/placeholder.png" alt="" loading="lazy">`;

      const contactBits = [
        row && row.contact_name ? `Name: ${escape(row.contact_name)}` : '',
        row && row.contact_phone ? `Phone: ${escape(row.contact_phone)}` : '',
        row && row.contact_email ? `Email: ${escape(row.contact_email)}` : '',
        raw && raw.address ? `Address: ${escape(raw.address)}` : ''
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

      return `
        <tr data-submission-id="${escape(row && row.id)}">
          <td>${imgTag}</td>
          <td>${escape(time)}</td>
          <td>${escape(statusLabel)}</td>
          <td>${escape(type)}</td>
          <td>${escape(town)}</td>
          <td>${escape(formatPrice(it))}</td>
          <td>${escape(beds == null ? '' : beds)}</td>
          <td>${escape(baths == null ? '' : baths)}</td>
          <td>${escape(built == null ? '' : `${built} m2`)}</td>
          <td>${escape(paths.length)}</td>
          <td>${contact}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');

    setStatus(`Showing ${rows.length} submission(s).`);
    hydrateThumbs();
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
      .from('property_submissions')
      .select('id,created_at,status,source,contact_name,contact_email,contact_phone,admin_notes,listing,raw,photo_bucket,photo_paths')
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
    const type = toText(it && it.type, '').trim() || 'Property';
    const town = toText(it && it.town, '').trim() || '';
    const province = toText(it && it.province, '').trim() || 'Alicante';
    const currency = toText(it && it.currency, 'EUR').trim().toUpperCase() || 'EUR';

    const payload = {
      submission_id: row.id,
      published: true,
      source: 'owner',
      type,
      town,
      province,
      price: toNumOrNull(it && it.price),
      currency,
      beds: toIntOrNull(it && it.beds),
      baths: toIntOrNull(it && it.baths),
      built_area: toIntOrNull(it && (it.builtArea ?? it.built_area ?? it.built)),
      plot_area: toIntOrNull(it && (it.plotArea ?? it.plot_area ?? it.plot)),
      latitude: toNumOrNull(it && (it.latitude ?? it.lat)),
      longitude: toNumOrNull(it && (it.longitude ?? it.lon)),
      images: [],
      features: Array.isArray(it && it.features) ? it.features : [],
      description: toText(it && it.description, '') || null
    };

    setStatus('Publishing…');

    const inserted = await client
      .from('property_listings')
      .insert(payload)
      .select('id,ref')
      .single();

    if (inserted && inserted.error) {
      setStatus(`Publish failed: ${inserted.error.message || 'unknown error'}`);
      return;
    }

    const listingId = inserted && inserted.data && inserted.data.id ? inserted.data.id : null;
    const listingRef = inserted && inserted.data && inserted.data.ref ? String(inserted.data.ref) : '';

    // Move photos into a public bucket so the listing works for anonymous visitors.
    const ownerBucket = toText(row && row.photo_bucket, 'owner-properties').trim() || 'owner-properties';
    const publicBucket = 'property-listings';
    const photoPaths = getPhotoPaths(row);
    const publicUrls = [];

    if (listingRef && photoPaths.length) {
      for (let i = 0; i < photoPaths.length; i += 1) {
        const path = toText(photoPaths[i]).trim();
        if (!path) continue;
        try {
          const dl = await client.storage.from(ownerBucket).download(path);
          if (dl && dl.error) throw new Error(dl.error.message || 'Download failed');
          const blob = dl && dl.data ? dl.data : null;
          if (!blob) continue;

          let destPath = `${listingRef}/${uuid()}.jpg`;
          const up = await client.storage.from(publicBucket).upload(destPath, blob, {
            contentType: blob.type || 'image/jpeg',
            upsert: false,
            cacheControl: '604800'
          });
          if (up && up.error) {
            // Retry once with a different name.
            destPath = `${listingRef}/${uuid()}.jpg`;
            const up2 = await client.storage.from(publicBucket).upload(destPath, blob, {
              contentType: blob.type || 'image/jpeg',
              upsert: false,
              cacheControl: '604800'
            });
            if (up2 && up2.error) throw new Error(up2.error.message || 'Upload failed');
          }

          const pub = client.storage.from(publicBucket).getPublicUrl(destPath);
          const url = pub && pub.data && pub.data.publicUrl ? String(pub.data.publicUrl) : '';
          if (url) publicUrls.push(url);
        } catch (error) {
          // ignore individual photo failures; listing can still publish.
        }
      }
    }

    if (listingId) {
      try {
        await client.from('property_listings').update({ images: publicUrls }).eq('id', listingId);
      } catch {
        // ignore
      }
    }

    const patch = await client
      .from('property_submissions')
      .update({
        status: 'approved',
        approved_listing_id: listingId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', row.id);

    if (patch && patch.error) {
      setStatus(`Approved but failed to update submission: ${patch.error.message || 'unknown error'}`);
      return;
    }

    setStatus(listingRef ? `Approved and published as ${listingRef}.` : 'Approved and published.');
    await loadRows();
  }

  async function rejectSubmission(id) {
    const client = getClient();
    if (!client) return;

    const row = (Array.isArray(lastRows) ? lastRows : []).find((r) => String(r && r.id) === String(id));
    if (!row) {
      setStatus('Submission not found.');
      return;
    }

    const reason = window.prompt('Reject this submission? Optional note for your admin inbox:', '') || '';
    setStatus('Rejecting…');

    const patch = await client
      .from('property_submissions')
      .update({
        status: 'rejected',
        admin_notes: reason || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', row.id);

    if (patch && patch.error) {
      setStatus(`Reject failed: ${patch.error.message || 'unknown error'}`);
      return;
    }

    setStatus('Rejected.');
    await loadRows();
  }

  function exportCsv() {
    const headers = [
      'created_at',
      'status',
      'type',
      'town',
      'province',
      'price',
      'beds',
      'baths',
      'built_area',
      'photos',
      'contact_name',
      'contact_email',
      'contact_phone',
      'submission_id'
    ];
    const lines = [headers.map(toCsvCell).join(',')];
    filteredRows().forEach((r) => {
      const it = getListing(r);
      const paths = getPhotoPaths(r);
      const row = {
        created_at: r && r.created_at ? r.created_at : '',
        status: r && r.status ? r.status : '',
        type: it && it.type ? it.type : '',
        town: it && it.town ? it.town : '',
        province: it && it.province ? it.province : '',
        price: it && it.price != null ? it.price : '',
        beds: it && it.beds != null ? it.beds : '',
        baths: it && it.baths != null ? it.baths : '',
        built_area: it && (it.builtArea ?? it.built_area ?? it.built) != null ? (it.builtArea ?? it.built_area ?? it.built) : '',
        photos: paths.length,
        contact_name: r && r.contact_name ? r.contact_name : '',
        contact_email: r && r.contact_email ? r.contact_email : '',
        contact_phone: r && r.contact_phone ? r.contact_phone : '',
        submission_id: r && r.id ? r.id : ''
      };
      lines.push(headers.map((h) => toCsvCell(row[h])).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scp-property-submissions.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (refreshBtn) refreshBtn.addEventListener('click', loadRows);
  if (csvBtn) csvBtn.addEventListener('click', exportCsv);
  if (statusFilter) statusFilter.addEventListener('change', loadRows);
  if (qInput) qInput.addEventListener('input', () => render());

  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('button[data-action][data-id]') : null;
    if (!btn) return;
    const action = toText(btn.dataset.action).trim();
    const id = toText(btn.dataset.id).trim();
    if (!action || !id) return;

    if (action === 'approve') approveSubmission(id);
    if (action === 'reject') rejectSubmission(id);
  });

  window.addEventListener('scp:supabase:ready', () => loadRows(), { once: true });
  window.setTimeout(loadRows, 80);
})();

