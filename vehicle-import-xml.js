(() => {
  const qs = (id) => document.getElementById(id);
  const toText = (v, fb = '') => (typeof v === 'string' ? v : v == null ? fb : String(v));
  const norm = (v) => toText(v).trim();
  const normLower = (v) => norm(v).toLowerCase();
  const getClient = () => window.scpSupabase || null;

  const slug = (s) =>
    normLower(s)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42);

  const parseFloatLoose = (v) => {
    const s = norm(v).replace(',', '.');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const parseIntLoose = (v) => {
    const s = norm(v).replace(/[^\d\-]/g, '');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  const parsePrice = (v) => {
    let s = norm(v);
    if (!s) return null;
    s = s.replace(/€/g, '').replace(/\bEUR\b/gi, '').trim();
    s = s.replace(/\./g, '').replace(/,/g, '.');
    s = s.replace(/[^\d.]/g, '');
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const firstTextXml = (el, names) => {
    if (!el) return '';
    for (const name of names) {
      try {
        const nodes = el.getElementsByTagName(name);
        if (nodes && nodes.length) {
          for (let i = 0; i < nodes.length; i++) {
            const t = norm(nodes[i] && nodes[i].textContent);
            if (t) return t;
          }
        }
      } catch {}
    }
    return '';
  };

  const firstAttrXml = (el, names) => {
    if (!el || !el.getAttribute) return '';
    for (const name of names) {
      const v = el.getAttribute(name);
      const t = norm(v);
      if (t) return t;
    }
    return '';
  };

  const extractImagesXml = (el) => {
    const out = [];
    const add = (u) => {
      const s = norm(u);
      if (!s) return;
      if (out.includes(s)) return;
      out.push(s);
    };
    const tags = ['image', 'img', 'photo', 'picture', 'url'];
    tags.forEach((tag) => {
      try {
        const nodes = el.getElementsByTagName(tag);
        if (!nodes) return;
        for (let i = 0; i < nodes.length; i++) {
          const t = norm(nodes[i] && nodes[i].textContent);
          if (!t) continue;
          // Try to keep only likely image URLs.
          if (/\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(t) || /^https?:\/\//i.test(t) || t.startsWith('/')) {
            add(t);
          }
        }
      } catch {}
    });
    return out.slice(0, 24);
  };

  const guessDeal = (blob) => {
    const low = normLower(blob);
    if (!low) return 'any';
    if (/(^|\b)(rent|rental|for rent|per day|\/day|daily|alquiler)(\b|$)/i.test(low)) return 'rent';
    if (/(^|\b)(sale|for sale|sell|venta|se vende)(\b|$)/i.test(low)) return 'sale';
    return 'any';
  };

  const guessCategory = (blob) => {
    const low = normLower(blob);
    if (/(^|\b)(boat|yacht|rib|catamaran|sail|marina)(\b|$)/i.test(low)) return 'boat';
    return 'car';
  };

  const pickXmlItemNodes = (doc) => {
    const candidates = ['vehicle', 'car', 'boat', 'listing', 'item', 'ad', 'offer', 'entry'];
    let best = [];
    candidates.forEach((name) => {
      try {
        const nodes = Array.from(doc.getElementsByTagName(name) || []);
        if (nodes.length > best.length) best = nodes;
      } catch {}
    });
    if (best.length) return best;

    try {
      const root = doc.documentElement;
      if (root && root.children && root.children.length) return Array.from(root.children);
    } catch {}
    return [];
  };

  const parseJsonItems = (text) => {
    const data = JSON.parse(text);
    if (Array.isArray(data)) return data.filter((x) => x && typeof x === 'object');
    if (data && typeof data === 'object') {
      for (const key of ['items', 'listings', 'vehicles', 'results', 'data']) {
        if (Array.isArray(data[key])) return data[key].filter((x) => x && typeof x === 'object');
      }
    }
    return [];
  };

  const normalizeJsonItem = (it, idx, chosenCategory) => {
    const title = norm(it.title || it.name || 'Vehicle') || 'Vehicle';
    const desc = norm(it.description || it.desc || it.body || it.details || '').slice(0, 800);
    const brand = norm(it.brand || it.make || it.manufacturer || '');
    const model = norm(it.model || '');
    const year = parseIntLoose(it.year || it.registration_year || '');
    const ref = norm(it.ref || it.id || it.code || '');

    const location = norm(it.location || it.town || it.city || it.pickup || it.area || it.marina || '');
    const latitude = parseFloatLoose(it.latitude || it.lat || '');
    const longitude = parseFloatLoose(it.longitude || it.lon || it.lng || '');

    const currency = norm(it.currency || 'EUR').toUpperCase() || 'EUR';
    const price = typeof it.price === 'number' ? it.price : parsePrice(it.price);
    const pricePeriod = (() => {
      const p = normLower(it.pricePeriod || it.period || it.price_period || it.rent_period || '');
      return p === 'day' || p === 'week' || p === 'month' ? p : '';
    })();

    const imagesRaw = it.images || it.photos || [];
    const images = (() => {
      const out = [];
      const add = (u) => {
        const s = norm(u);
        if (!s) return;
        if (out.includes(s)) return;
        out.push(s);
      };
      if (Array.isArray(imagesRaw)) imagesRaw.forEach(add);
      else if (typeof imagesRaw === 'string') imagesRaw.split(/[,\n]+/g).forEach(add);
      return out.slice(0, 24);
    })();

    let deal = normLower(it.deal || it.status || it.type || '');
    if (deal !== 'rent' && deal !== 'sale') deal = guessDeal(`${title} ${desc} ${deal}`);
    if (deal !== 'rent' && deal !== 'sale') deal = 'sale';

    let category = chosenCategory;
    if (category === 'mixed') category = guessCategory(`${title} ${desc} ${brand} ${model}`);

    const id = ref || `IMP-${Date.now()}-${idx + 1}-${slug(title) || 'vehicle'}`;

    return {
      id,
      title,
      category: category === 'boat' ? 'boat' : 'car',
      deal: deal === 'rent' ? 'rent' : 'sale',
      brand,
      model,
      year: year || null,
      price: price != null ? price : null,
      currency,
      pricePeriod,
      location,
      latitude,
      longitude,
      images,
      description: desc
    };
  };

  const normalizeXmlItem = (el, idx, chosenCategory) => {
    const title = firstTextXml(el, ['title', 'name', 'headline']) || 'Vehicle';
    const desc = firstTextXml(el, ['description', 'desc', 'body', 'details']).slice(0, 800);
    const brand = firstTextXml(el, ['brand', 'make', 'manufacturer']);
    const model = firstTextXml(el, ['model']);
    const year = parseIntLoose(firstTextXml(el, ['year', 'registration_year']));
    const ref = firstTextXml(el, ['ref', 'reference', 'id', 'code']) || firstAttrXml(el, ['id', 'ref']);

    const location = firstTextXml(el, ['town', 'city', 'location', 'pickup', 'area', 'marina']);
    const latitude = parseFloatLoose(
      firstTextXml(el, ['latitude', 'lat']) || firstAttrXml(el, ['lat', 'latitude'])
    );
    const longitude = parseFloatLoose(
      firstTextXml(el, ['longitude', 'lon', 'lng']) || firstAttrXml(el, ['lon', 'lng', 'longitude'])
    );

    const currency = (firstTextXml(el, ['currency']) || 'EUR').toUpperCase();
    const price = parsePrice(firstTextXml(el, ['price', 'sale_price', 'rent', 'rental_price']));
    const pricePeriodRaw = normLower(firstTextXml(el, ['price_period', 'period', 'rent_period']));
    const pricePeriod = pricePeriodRaw === 'day' || pricePeriodRaw === 'week' || pricePeriodRaw === 'month' ? pricePeriodRaw : '';

    const images = extractImagesXml(el);
    let deal = normLower(firstTextXml(el, ['deal', 'status', 'type']));
    if (deal !== 'rent' && deal !== 'sale') deal = guessDeal(`${title} ${desc} ${deal}`);
    if (deal !== 'rent' && deal !== 'sale') deal = 'sale';

    let category = chosenCategory;
    if (category === 'mixed') category = guessCategory(`${title} ${desc} ${brand} ${model}`);

    const id = ref || `IMP-${Date.now()}-${idx + 1}-${slug(title) || 'vehicle'}`;

    return {
      id,
      title,
      category: category === 'boat' ? 'boat' : 'car',
      deal: deal === 'rent' ? 'rent' : 'sale',
      brand,
      model,
      year: year || null,
      price: price != null ? price : null,
      currency: currency || 'EUR',
      pricePeriod,
      location,
      latitude,
      longitude,
      images,
      description: desc
    };
  };

  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.onload = () => resolve(toText(reader.result));
      reader.readAsText(file);
    });

  const fetchUrlText = async (url) => {
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
    return await res.text();
  };

  const downloadJson = (filename, items) => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const form = qs('vx-form');
    if (!form) return;

    const elCompany = qs('vx-company');
    const elEmail = qs('vx-email');
    const elPhone = qs('vx-phone');
    const elCategory = qs('vx-category');
    const elFile = qs('vx-file');
    const elUrl = qs('vx-url');

    const btnCars = qs('vx-download-cars');
    const btnBoats = qs('vx-download-boats');
    const btnSubmit = qs('vx-submit');
    const aMailto = qs('vx-mailto');
    const status = qs('vx-status');
    const summary = qs('vx-summary');
    const preview = qs('vx-preview');

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

    setDisabledLink(aMailto, true);

    const readCategoryParam = () => {
      try {
        const params = new URLSearchParams(window.location.search || '');
        const c = normLower(params.get('category'));
        if (c === 'car' || c === 'boat') return c;
      } catch {}
      return '';
    };
    const initialCategory = readCategoryParam();
    if (elCategory && (initialCategory === 'car' || initialCategory === 'boat')) {
      elCategory.value = initialCategory;
    }

    let carsOut = [];
    let boatsOut = [];
    let lastMsg = '';

    const updateButtons = () => {
      if (btnCars) btnCars.disabled = carsOut.length === 0;
      if (btnBoats) btnBoats.disabled = boatsOut.length === 0;
      if (btnSubmit) btnSubmit.disabled = (carsOut.length + boatsOut.length) === 0;
      setDisabledLink(aMailto, !lastMsg);
    };

    const renderPreview = (items) => {
      if (!preview) return;
      if (!items.length) {
        preview.innerHTML = '<div class="muted">No listings found.</div>';
        return;
      }

      const rows = items.slice(0, 20).map((it) => {
        const price = it.price != null ? `${it.currency === 'EUR' ? '€' : ''}${toText(it.price)}${it.currency !== 'EUR' ? ` ${it.currency}` : ''}${it.deal === 'rent' && it.pricePeriod ? ` / ${it.pricePeriod}` : ''}` : '—';
        const cat = it.category === 'boat' ? 'Boat' : 'Car';
        const deal = it.deal === 'rent' ? 'Rent' : it.deal === 'sale' ? 'Sale' : 'Any';
        const coords = it.latitude != null && it.longitude != null ? 'Yes' : '—';
        const imgs = Array.isArray(it.images) && it.images.length ? String(it.images.length) : '—';
        return `
          <tr>
            <td>${cat}</td>
            <td>${deal}</td>
            <td>${toText(it.title).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            <td>${toText(it.location).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            <td>${price}</td>
            <td>${coords}</td>
            <td>${imgs}</td>
          </tr>
        `;
      }).join('');

      preview.innerHTML = `
        <table class="admin-table">
          <thead>
            <tr>
              <th>Cat</th>
              <th>Deal</th>
              <th>Title</th>
              <th>Location</th>
              <th>Price</th>
              <th>Coords</th>
              <th>Images</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="muted" style="margin-top:0.6rem;">Showing first ${Math.min(20, items.length)} of ${items.length}.</div>
      `;
    };

    const buildEmailMessage = (meta, counts, warnings, filenames) => {
      const lines = [];
      lines.push('Vehicle feed onboarding request');
      lines.push('');
      if (meta.company) lines.push(`Company: ${meta.company}`);
      if (meta.email) lines.push(`Email: ${meta.email}`);
      if (meta.phone) lines.push(`Phone/WhatsApp: ${meta.phone}`);
      if (meta.url) lines.push(`Feed URL: ${meta.url}`);
      lines.push(`Category: ${meta.category}`);
      lines.push('');
      lines.push('Counts:');
      lines.push(`- Total parsed: ${counts.total}`);
      lines.push(`- Cars: ${counts.cars}`);
      lines.push(`- Boats: ${counts.boats}`);
      lines.push(`- With coordinates: ${counts.coords}`);
      lines.push(`- With images: ${counts.images}`);
      if (warnings.length) {
        lines.push('');
        lines.push('Warnings:');
        warnings.forEach((w) => lines.push(`- ${w}`));
      }
      if (filenames.length) {
        lines.push('');
        lines.push('Attachments:');
        filenames.forEach((f) => lines.push(`- ${f}`));
      }
      lines.push('');
      lines.push('Thank you.');
      return lines.join('\n');
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (status) status.textContent = '';
      carsOut = [];
      boatsOut = [];
      lastMsg = '';
      updateButtons();
      if (summary) summary.textContent = 'Parsing…';
      if (preview) preview.innerHTML = '';

      const chosenCategory = elCategory ? normLower(elCategory.value) : 'car';
      const company = norm(elCompany && elCompany.value);
      const email = norm(elEmail && elEmail.value);
      const phone = norm(elPhone && elPhone.value);
      const url = norm(elUrl && elUrl.value);

      let text = '';
      let kind = '';

      try {
        const file = elFile && elFile.files && elFile.files[0] ? elFile.files[0] : null;
        if (file) {
          text = await readFileAsText(file);
          kind = (file.name || '').toLowerCase().endsWith('.json') ? 'json' : 'xml';
        } else if (url) {
          text = await fetchUrlText(url);
          kind = url.toLowerCase().includes('.json') ? 'json' : 'xml';
        } else {
          throw new Error('Select a file or provide a feed URL.');
        }

        const normalized = [];
        if (kind === 'json') {
          const items = parseJsonItems(text);
          items.forEach((it, idx) => normalized.push(normalizeJsonItem(it, idx, chosenCategory)));
        } else {
          const doc = new DOMParser().parseFromString(text, 'application/xml');
          const err = doc.querySelector && doc.querySelector('parsererror');
          if (err) throw new Error('Invalid XML (parser error).');
          const nodes = pickXmlItemNodes(doc);
          nodes.forEach((el, idx) => normalized.push(normalizeXmlItem(el, idx, chosenCategory)));
        }

        // Split by category for existing import pipeline (feeds/vehicles vs feeds/boats).
        carsOut = normalized.filter((x) => x.category === 'car');
        boatsOut = normalized.filter((x) => x.category === 'boat');

        const all = [...carsOut, ...boatsOut];
        const counts = {
          total: all.length,
          cars: carsOut.length,
          boats: boatsOut.length,
          coords: all.filter((x) => x.latitude != null && x.longitude != null).length,
          images: all.filter((x) => Array.isArray(x.images) && x.images.length > 0).length
        };

        const warnings = [];
        const missingTitle = all.filter((x) => !norm(x.title)).length;
        const missingLoc = all.filter((x) => !norm(x.location)).length;
        const missingPrice = all.filter((x) => x.price == null).length;
        if (missingTitle) warnings.push(`${missingTitle} listing(s) missing title.`);
        if (missingLoc) warnings.push(`${missingLoc} listing(s) missing location.`);
        if (missingPrice) warnings.push(`${missingPrice} listing(s) missing price.`);
        if (counts.coords === 0) warnings.push('No coordinates detected (map pins will not show).');
        if (counts.images === 0) warnings.push('No images detected (cards will show placeholders).');

        const fileCars = carsOut.length ? `dealer-cars-${Date.now()}.json` : '';
        const fileBoats = boatsOut.length ? `dealer-boats-${Date.now()}.json` : '';
        const filenames = [fileCars, fileBoats].filter(Boolean);

        lastMsg = buildEmailMessage(
          { company, email, phone, url, category: chosenCategory },
          counts,
          warnings,
          filenames
        );

        if (aMailto) {
          aMailto.href = `mailto:info@spanishcoastproperties.com?subject=${encodeURIComponent('Vehicle feed onboarding - dealer import')}&body=${encodeURIComponent(lastMsg)}`;
        }

        if (summary) {
          summary.textContent = `Parsed ${counts.total} listing(s): ${counts.cars} car(s), ${counts.boats} boat(s).`;
        }

        // Preview: show combined list.
        renderPreview(all);
        if (status) status.textContent = 'Parsed. Download the JSON file(s) and email the summary.';

        // Wire downloads with stable filenames for this parse result.
        if (btnCars) {
          btnCars.onclick = () => {
            if (!carsOut.length) return;
            downloadJson(fileCars || `dealer-cars-${Date.now()}.json`, carsOut);
          };
        }
        if (btnBoats) {
          btnBoats.onclick = () => {
            if (!boatsOut.length) return;
            downloadJson(fileBoats || `dealer-boats-${Date.now()}.json`, boatsOut);
          };
        }
      } catch (err) {
        const msg = err && err.message ? err.message : String(err);
        if (status) status.textContent = msg;
        if (summary) summary.textContent = 'No feed parsed.';
        if (preview) preview.innerHTML = '';
      } finally {
        updateButtons();
      }
    });

    const submitForReview = async () => {
      const all = [...carsOut, ...boatsOut];
      if (!all.length) return;

      const client = getClient();
      if (!client) {
        if (status) status.textContent = 'Account submission unavailable (Supabase not configured). Use Email summary instead.';
        return;
      }

      const { data: sessionData } = await client.auth.getSession();
      const user = sessionData && sessionData.session ? sessionData.session.user : null;
      if (!user) {
        if (status) status.textContent = 'Signed out. Open Account and sign in to submit for review.';
        return;
      }

      const company = norm(elCompany && elCompany.value);
      const email = norm(elEmail && elEmail.value);
      const phone = norm(elPhone && elPhone.value);

      let ok = true;
      try {
        ok = window.confirm(`Submit ${all.length} listing(s) for admin review? They will not be published until approved.`);
      } catch {
        ok = true;
      }
      if (!ok) return;

      const base = {
        user_id: user.id,
        user_email: user.email || email || null,
        source: 'dealer_import',
        company_name: company || null,
        contact_name: company || null,
        contact_email: email || user.email || null,
        contact_phone: phone || null
      };

      const chunkSize = 25;
      let sent = 0;

      for (let i = 0; i < all.length; i += chunkSize) {
        const chunk = all.slice(i, i + chunkSize).map((it) => ({
          ...base,
          listing: it
        }));

        if (status) status.textContent = `Submitting ${Math.min(i + chunk.length, all.length)} / ${all.length}…`;

        const out = await client.from('vehicle_submissions').insert(chunk);
        if (out && out.error) {
          if (status) status.textContent = `Submit failed: ${out.error.message || 'unknown error'}`;
          return;
        }
        sent += chunk.length;
      }

      if (status) status.textContent = `Submitted ${sent} listing(s) for review (pending admin approval).`;
    };

    if (btnSubmit) btnSubmit.addEventListener('click', submitForReview);

    updateButtons();
  });
})();
