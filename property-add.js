(() => {
  const qs = (id) => document.getElementById(id);
  const getClient = () => window.scpSupabase || null;

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
      if (window.SCP_I18N && typeof window.SCP_I18N.t === 'function') {
        const translated = window.SCP_I18N.t(k, vars);
        if (translated != null) {
          const out = String(translated);
          if (out && out !== k) return out;
        }
      }
    } catch {
      // ignore
    }
    return fallback != null ? formatTemplate(fallback, vars) : k;
  };

  const toText = (v, fb = '') => (typeof v === 'string' ? v : v == null ? fb : String(v));
  const norm = (v, fb = '') => toText(v, fb).trim();
  const normLower = (v, fb = '') => norm(v, fb).toLowerCase();

  const uuid = () => {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    } catch {
      // ignore
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const parseNum = (v) => {
    const n = Number(norm(v));
    return Number.isFinite(n) ? n : null;
  };

  const parseIntOrNull = (v) => {
    const n = parseNum(v);
    if (n == null) return null;
    return Number.isFinite(n) ? Math.trunc(n) : null;
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

      return { blob, meta: { srcW, srcH, outW, outH, outBytes: blob.size } };
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
        reject(new Error('Location timed out'));
      }, timeoutMs);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          resolve({
            lat: pos && pos.coords ? pos.coords.latitude : null,
            lon: pos && pos.coords ? pos.coords.longitude : null,
            acc: pos && pos.coords ? pos.coords.accuracy : null
          });
        },
        (err) => {
          if (done) return;
          done = true;
          window.clearTimeout(timer);
          reject(err || new Error('Location failed'));
        },
        { enableHighAccuracy: true, timeout: Math.min(timeoutMs, 15000), maximumAge: 0 }
      );
    });
  };

  const setDisabledLink = (a, disabled) => {
    if (!a) return;
    if (disabled) {
      a.setAttribute('aria-disabled', 'true');
      a.href = '#';
      a.style.pointerEvents = 'none';
      a.style.opacity = '0.6';
    } else {
      a.setAttribute('aria-disabled', 'false');
      a.style.pointerEvents = '';
      a.style.opacity = '';
    }
  };

  const buildMessage = (fields) => {
    const lines = [];
    lines.push('Property for sale submission');
    lines.push('');
    lines.push(`Type: ${fields.type}`);
    lines.push(`Town/Area: ${fields.town}`);
    lines.push(`Province: ${fields.province}`);

    if (fields.price != null && fields.price > 0) lines.push(`Expected price: €${fields.price}`);
    if (fields.beds != null) lines.push(`Beds: ${fields.beds}`);
    if (fields.baths != null) lines.push(`Baths: ${fields.baths}`);
    if (fields.built != null && fields.built > 0) lines.push(`Built area: ${fields.built} m2`);
    if (fields.plot != null && fields.plot > 0) lines.push(`Plot area: ${fields.plot} m2`);

    if (fields.latitude != null && fields.longitude != null) {
      lines.push(`Coordinates: ${fields.latitude}, ${fields.longitude}`);
    }

    if (fields.features && fields.features.length) {
      lines.push('Key features:');
      fields.features.forEach((f) => lines.push(`- ${f}`));
    }

    if (fields.description) {
      lines.push('');
      lines.push('Description:');
      lines.push(fields.description);
    }

    lines.push('');
    if (fields.photoCount > 0) {
      lines.push(`Photos: ${fields.photoCount} selected (I can send them by WhatsApp/email if needed).`);
    } else {
      lines.push('Photos: I can send photos via WhatsApp/email, or schedule a visit for a free photo shoot.');
    }

    lines.push('');
    lines.push('Contact (private):');
    lines.push(`- Name: ${fields.contactName}`);
    if (fields.contactEmail) lines.push(`- Email: ${fields.contactEmail}`);
    if (fields.contactPhone) lines.push(`- Phone/WhatsApp: ${fields.contactPhone}`);
    if (fields.address) lines.push(`- Address (private): ${fields.address}`);

    lines.push('');
    lines.push('Thank you.');
    return lines.join('\n');
  };

  const parseFeatures = (raw) => {
    const s = norm(raw);
    if (!s) return [];
    const parts = s.split(/\s*(?:,|\n)\s*/g).map((x) => x.trim()).filter(Boolean);
    const out = [];
    parts.forEach((p) => {
      if (!p) return;
      if (out.includes(p)) return;
      out.push(p);
    });
    return out.slice(0, 24);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const form = qs('property-add-form');
    if (!form) return;

    const elType = qs('pa-type');
    const elTown = qs('pa-town');
    const elProvince = qs('pa-province');
    const elPrice = qs('pa-price');
    const elBeds = qs('pa-beds');
    const elBaths = qs('pa-baths');
    const elBuilt = qs('pa-built');
    const elPlot = qs('pa-plot');
    const elDesc = qs('pa-desc');
    const elFeatures = qs('pa-features');

    const elPhotos = qs('pa-photos');
    const previewGrid = qs('pa-photo-preview');
    const photoMeta = qs('pa-photo-meta');

    const btnGetLocation = qs('pa-get-location');
    const locText = qs('pa-location-text');
    const elLat = qs('pa-lat');
    const elLon = qs('pa-lon');

    const elName = qs('pa-name');
    const elEmail = qs('pa-email');
    const elPhone = qs('pa-phone');
    const elAddress = qs('pa-address');

    const status = qs('pa-status');
    const out = qs('pa-output');
    const btnCopy = qs('pa-copy');
    const aMailto = qs('pa-mailto');
    const aWhatsapp = qs('pa-whatsapp');
    const btnSubmit = qs('pa-submit');

    setDisabledLink(aMailto, true);
    setDisabledLink(aWhatsapp, true);

    let lastMessage = '';
    let previewUrls = [];
    let selectedFiles = [];

    const setStatus = (msg) => {
      if (status) status.textContent = msg || '';
    };

    const updateActions = () => {
      const ready = Boolean(lastMessage);
      if (btnCopy) btnCopy.disabled = !ready;
      setDisabledLink(aMailto, !ready);
      setDisabledLink(aWhatsapp, !ready);
    };

    const clearPreview = () => {
      previewUrls.forEach((u) => {
        try { URL.revokeObjectURL(u); } catch { /* ignore */ }
      });
      previewUrls = [];
    };

    const renderPreview = () => {
      if (!previewGrid) return;
      if (!selectedFiles.length) {
        previewGrid.style.display = 'none';
        previewGrid.innerHTML = '';
        if (photoMeta) photoMeta.textContent = '';
        return;
      }

      clearPreview();
      const items = selectedFiles.slice(0, 12).map((f) => {
        const u = URL.createObjectURL(f);
        previewUrls.push(u);
        return `<div class="upload-thumb"><img src="${u}" alt="Photo preview"></div>`;
      });
      previewGrid.innerHTML = items.join('');
      previewGrid.style.display = 'grid';

      const totalMb = selectedFiles.reduce((acc, f) => acc + (f && f.size ? f.size : 0), 0) / (1024 * 1024);
      if (photoMeta) photoMeta.textContent = `${selectedFiles.length} photo(s) selected (~${totalMb.toFixed(1)} MB before compression).`;
    };

    const syncMailLinks = (msg, title) => {
      const subject = `Property for sale submission - ${title}`;
      if (aMailto) {
        aMailto.href = `mailto:info@spanishcoastproperties.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
      }
      if (aWhatsapp) {
        const waText = msg.length > 3500 ? msg.slice(0, 3500) + '\n…' : msg;
        aWhatsapp.href = `https://wa.me/34624867866?text=${encodeURIComponent(waText)}`;
      }
    };

    if (elPhotos) {
      elPhotos.addEventListener('change', () => {
        const files = elPhotos.files ? Array.from(elPhotos.files) : [];
        selectedFiles = files.filter((f) => f && f.type && f.type.startsWith('image/')).slice(0, 12);
        if (files.length > 12) {
          setStatus(t('property_add.photos.limit', 'Only the first 12 photos will be used.'));
        } else {
          setStatus('');
        }
        renderPreview();
      });
    }

    const setLocationText = (loc) => {
      if (!locText) return;
      if (!loc || loc.lat == null || loc.lon == null) {
        locText.textContent = t('property_add.location.none', 'No location yet.');
        return;
      }
      const acc = loc.acc != null ? ` (±${Math.round(loc.acc)}m)` : '';
      locText.textContent = `${Number(loc.lat).toFixed(6)}, ${Number(loc.lon).toFixed(6)}${acc}`;
    };

    if (btnGetLocation) {
      btnGetLocation.addEventListener('click', async () => {
        setStatus(t('property_add.location.getting', 'Getting location…'));
        btnGetLocation.disabled = true;
        try {
          const loc = await getLocation({ timeoutMs: 12000 });
          if (elLat) elLat.value = loc.lat != null ? String(loc.lat) : '';
          if (elLon) elLon.value = loc.lon != null ? String(loc.lon) : '';
          setLocationText(loc);
          setStatus(t('property_add.location.done', 'Location added.'));
        } catch (err) {
          setStatus(`${t('property_add.location.failed', 'Location failed')}: ${err && err.message ? err.message : String(err)}`);
        } finally {
          btnGetLocation.disabled = false;
        }
      });
    }

    async function submitToSupabase(fields) {
      const client = getClient();
      if (!client) return { ok: false, msg: 'Account submission unavailable (Supabase not configured).' };

      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData && sessionData.session ? sessionData.session.user : null;
      if (!user) {
        const needs = selectedFiles.length ? 'Sign in on the Account page to upload photos and submit instantly (pending review).' : 'Sign in on the Account page to submit instantly (pending review).';
        return { ok: false, msg: needs };
      }

      const submissionId = uuid();
      const bucket = 'owner-properties';

      // Upload photos first (if any), then insert the submission row.
      const photoPaths = [];
      for (let i = 0; i < selectedFiles.length; i += 1) {
        const file = selectedFiles[i];
        const compressed = await compressImageFile(file, { maxSide: 1600, quality: 0.82 });
        const path = `${user.id}/${submissionId}/${uuid()}.jpg`;
        const up = await client
          .storage
          .from(bucket)
          .upload(path, compressed.blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
        if (up && up.error) {
          throw new Error(up.error.message || 'Upload failed');
        }
        photoPaths.push(path);
      }

      const listing = {
        type: fields.type,
        town: fields.town,
        province: fields.province,
        price: fields.price,
        currency: 'EUR',
        beds: fields.beds,
        baths: fields.baths,
        builtArea: fields.built,
        plotArea: fields.plot,
        latitude: fields.latitude,
        longitude: fields.longitude,
        features: fields.features,
        description: fields.description
      };

      const payload = {
        id: submissionId,
        user_id: user.id,
        user_email: user.email || fields.contactEmail || null,
        source: 'owner',
        contact_name: fields.contactName || null,
        contact_email: fields.contactEmail || user.email || null,
        contact_phone: fields.contactPhone || null,
        listing,
        raw: { address: fields.address || null },
        photo_bucket: bucket,
        photo_paths: photoPaths
      };

      const out = await client
        .from('property_submissions')
        .insert(payload)
        .select('id')
        .single();

      if (out && out.error) {
        throw new Error(out.error.message || 'Submission failed');
      }

      const sid = out && out.data && out.data.id ? String(out.data.id) : submissionId;
      return { ok: true, msg: `Submitted (pending review). Submission ID: ${sid}` };
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const type = norm(elType && elType.value);
      const town = norm(elTown && elTown.value);
      const province = norm(elProvince && elProvince.value, 'Alicante') || 'Alicante';
      const price = parseIntOrNull(elPrice && elPrice.value);
      const beds = parseIntOrNull(elBeds && elBeds.value);
      const baths = parseIntOrNull(elBaths && elBaths.value);
      const built = parseIntOrNull(elBuilt && elBuilt.value);
      const plot = parseIntOrNull(elPlot && elPlot.value);
      const description = norm(elDesc && elDesc.value).slice(0, 2000);
      const features = parseFeatures(elFeatures && elFeatures.value);

      const latitude = parseNum(elLat && elLat.value);
      const longitude = parseNum(elLon && elLon.value);

      const contactName = norm(elName && elName.value);
      const contactEmail = norm(elEmail && elEmail.value);
      const contactPhone = norm(elPhone && elPhone.value);
      const address = norm(elAddress && elAddress.value);

      if (!type || !town || !contactName || !contactPhone) {
        setStatus(t('property_add.errors.required', 'Missing required fields: Type, Town/Area, Name, Phone.'));
        return;
      }

      const title = `${type} in ${town}`;
      const msg = buildMessage({
        type,
        town,
        province,
        price,
        beds,
        baths,
        built,
        plot,
        latitude,
        longitude,
        description,
        features,
        photoCount: selectedFiles.length,
        contactName,
        contactEmail,
        contactPhone,
        address
      });

      lastMessage = msg;
      if (out) {
        out.style.display = 'block';
        out.textContent = msg;
      }
      syncMailLinks(msg, title);
      updateActions();

      // Try instant submission when signed in.
      (async () => {
        if (btnSubmit) btnSubmit.disabled = true;
        try {
          setStatus(t('property_add.submitting', 'Submitting…'));
          const out = await submitToSupabase({
            type,
            town,
            province,
            price,
            beds,
            baths,
            built,
            plot,
            latitude,
            longitude,
            description,
            features,
            contactName,
            contactEmail,
            contactPhone,
            address
          });
          if (out && out.ok) {
            setStatus(out.msg);
          } else {
            setStatus(`Message generated. ${out && out.msg ? out.msg : ''}`.trim());
          }
        } catch (err) {
          setStatus(`Message generated. Submission failed: ${err && err.message ? err.message : String(err)}`);
        } finally {
          if (btnSubmit) btnSubmit.disabled = false;
        }
      })();
    });

    if (btnCopy) {
      btnCopy.addEventListener('click', async () => {
        if (!lastMessage) return;
        try {
          await navigator.clipboard.writeText(lastMessage);
          setStatus(t('property_add.copied', 'Copied to clipboard.'));
        } catch {
          setStatus(t('property_add.copy_failed', 'Copy failed (browser blocked). Use Email or WhatsApp instead.'));
        }
      });
    }

    updateActions();
    renderPreview();
    setLocationText({
      lat: parseNum(elLat && elLat.value),
      lon: parseNum(elLon && elLon.value),
      acc: null
    });
  });
})();
