(() => {
  const qs = (id) => document.getElementById(id);
  const toText = (v, fb = '') => (typeof v === 'string' ? v : v == null ? fb : String(v));
  const norm = (v) => toText(v).trim();
  const normLower = (v) => norm(v).toLowerCase();

  const slug = (s) =>
    normLower(s)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 42);

  const parseNum = (v) => {
    const n = Number(toText(v).trim());
    return Number.isFinite(n) ? n : null;
  };

  const parseImages = (raw) => {
    const s = norm(raw);
    if (!s) return [];
    const parts = s.split(/\s*(?:,|\n)\s*/g).map((x) => x.trim()).filter(Boolean);
    const out = [];
    parts.forEach((u) => {
      if (!u) return;
      if (out.includes(u)) return;
      out.push(u);
    });
    return out.slice(0, 24);
  };

  const buildMessage = (fields) => {
    const lines = [];
    lines.push('Vehicle listing submission');
    lines.push('');
    lines.push(`Category: ${fields.category === 'boat' ? 'Boat' : 'Car'}`);
    lines.push(`Deal: ${fields.deal === 'rent' ? 'For rent' : 'For sale'}`);
    lines.push(`Title: ${fields.title}`);
    if (fields.brand) lines.push(`Brand: ${fields.brand}`);
    if (fields.model) lines.push(`Model: ${fields.model}`);
    if (fields.year) lines.push(`Year: ${fields.year}`);
    if (fields.price != null && fields.price > 0) {
      const p = fields.currency === 'EUR' ? `€${fields.price}` : `${fields.price} ${fields.currency}`;
      lines.push(`Price: ${p}${fields.deal === 'rent' && fields.pricePeriod ? ` / ${fields.pricePeriod}` : ''}`);
    } else {
      lines.push('Price: Price on request');
    }
    lines.push(`Location: ${fields.location}`);
    if (fields.latitude != null && fields.longitude != null) {
      lines.push(`Coordinates: ${fields.latitude}, ${fields.longitude}`);
    }
    if (fields.images.length) {
      lines.push('Photos/links:');
      fields.images.forEach((u) => lines.push(`- ${u}`));
    } else {
      lines.push('Photos: I will send photos via WhatsApp or email.');
    }
    if (fields.description) {
      lines.push('');
      lines.push('Description:');
      lines.push(fields.description);
    }
    lines.push('');
    lines.push('Contact (private):');
    lines.push(`- Name: ${fields.contactName}`);
    if (fields.contactEmail) lines.push(`- Email: ${fields.contactEmail}`);
    if (fields.contactPhone) lines.push(`- Phone/WhatsApp: ${fields.contactPhone}`);
    lines.push('');
    lines.push('Thank you.');
    return lines.join('\n');
  };

  document.addEventListener('DOMContentLoaded', () => {
    const form = qs('vehicle-add-form');
    if (!form) return;

    const elCategory = qs('va-category');
    const elDeal = qs('va-deal');
    const elTitle = qs('va-title');
    const elBrand = qs('va-brand');
    const elModel = qs('va-model');
    const elYear = qs('va-year');
    const elPrice = qs('va-price');
    const elPricePeriod = qs('va-price-period');
    const elLocation = qs('va-location');
    const elLat = qs('va-lat');
    const elLon = qs('va-lon');
    const elImages = qs('va-images');
    const elDesc = qs('va-desc');
    const elName = qs('va-name');
    const elEmail = qs('va-email');
    const elPhone = qs('va-phone');

    const out = qs('va-output');
    const status = qs('va-status');
    const btnCopy = qs('va-copy');
    const aMailto = qs('va-mailto');
    const aWhatsapp = qs('va-whatsapp');
    const btnDownload = qs('va-download');

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

    const readCategoryParam = () => {
      try {
        const params = new URLSearchParams(window.location.search || '');
        const c = normLower(params.get('category'));
        if (c === 'car' || c === 'boat') return c;
      } catch {}
      return '';
    };

    const syncPricePeriodEnabled = () => {
      const isRent = elDeal && normLower(elDeal.value) === 'rent';
      if (!elPricePeriod) return;
      elPricePeriod.disabled = !isRent;
      if (!isRent) elPricePeriod.value = '';
    };

    const initialCategory = readCategoryParam();
    if (elCategory && (initialCategory === 'car' || initialCategory === 'boat')) {
      elCategory.value = initialCategory;
    }

    syncPricePeriodEnabled();
    if (elDeal) {
      elDeal.addEventListener('change', () => {
        syncPricePeriodEnabled();
      });
    }

    setDisabledLink(aMailto, true);
    setDisabledLink(aWhatsapp, true);

    let lastJson = null;
    let lastFilename = '';
    let lastMessage = '';

    const updateActions = () => {
      const ready = Boolean(lastMessage);
      if (btnCopy) btnCopy.disabled = !ready;
      if (btnDownload) btnDownload.disabled = !lastJson;
      setDisabledLink(aMailto, !ready);
      setDisabledLink(aWhatsapp, !ready);
    };

    const buildJsonListing = (fields) => {
      // This is the file format the importer/build script accepts (JSON array of objects).
      // Contact details are intentionally excluded from the JSON to avoid publishing PII.
      return [
        {
          id: fields.id,
          title: fields.title,
          category: fields.category,
          deal: fields.deal,
          brand: fields.brand,
          model: fields.model,
          year: fields.year || null,
          price: fields.price,
          currency: fields.currency,
          pricePeriod: fields.pricePeriod,
          location: fields.location,
          latitude: fields.latitude,
          longitude: fields.longitude,
          images: fields.images,
          description: fields.description
        }
      ];
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (status) status.textContent = '';

      const category = elCategory ? normLower(elCategory.value) : 'car';
      const deal = elDeal ? normLower(elDeal.value) : 'sale';
      const title = norm(elTitle && elTitle.value);
      const brand = norm(elBrand && elBrand.value);
      const model = norm(elModel && elModel.value);
      const year = parseNum(elYear && elYear.value);
      const price = parseNum(elPrice && elPrice.value);
      const pricePeriod = elPricePeriod ? normLower(elPricePeriod.value) : '';
      const location = norm(elLocation && elLocation.value);
      const latitude = parseNum(elLat && elLat.value);
      const longitude = parseNum(elLon && elLon.value);
      const images = parseImages(elImages && elImages.value);
      const description = norm(elDesc && elDesc.value).slice(0, 1200);

      const contactName = norm(elName && elName.value);
      const contactEmail = norm(elEmail && elEmail.value);
      const contactPhone = norm(elPhone && elPhone.value);

      if (!title || !location || !contactName) {
        if (status) status.textContent = 'Missing required fields: Title, Location, Name.';
        return;
      }

      const id = `USR-${Date.now()}-${slug(title) || 'vehicle'}`;
      const currency = 'EUR';

      const fields = {
        id,
        category: category === 'boat' ? 'boat' : 'car',
        deal: deal === 'rent' ? 'rent' : 'sale',
        title,
        brand,
        model,
        year: year && year > 0 ? Math.round(year) : null,
        price: price && price > 0 ? price : null,
        currency,
        pricePeriod: '',
        location,
        latitude: latitude != null ? latitude : null,
        longitude: longitude != null ? longitude : null,
        images,
        description,
        contactName,
        contactEmail,
        contactPhone
      };

      // Fix circular reference from the inline initializer.
      fields.pricePeriod = deal === 'rent'
        ? (pricePeriod === 'day' || pricePeriod === 'week' || pricePeriod === 'month' ? pricePeriod : 'day')
        : '';

      const msg = buildMessage(fields);
      lastMessage = msg;
      lastJson = buildJsonListing(fields);
      lastFilename = `vehicle-${fields.category}-${slug(title) || 'listing'}.json`;

      if (out) {
        out.style.display = 'block';
        out.textContent = msg + `\n\nSuggested attachment: ${lastFilename}\n`;
      }

      // Mailto (cannot attach files via mailto; user attaches the downloaded JSON).
      const subject = `Vehicle listing submission - ${title}`;
      const body = msg + `\n\nAttachment: ${lastFilename}\n`;
      if (aMailto) {
        aMailto.href = `mailto:info@spanishcoastproperties.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      }

      // WhatsApp
      if (aWhatsapp) {
        const waText = msg.length > 3500 ? msg.slice(0, 3500) + '\n…' : msg;
        aWhatsapp.href = `https://wa.me/34624867866?text=${encodeURIComponent(waText)}`;
      }

      if (status) status.textContent = 'Message generated. Use Email/WhatsApp and attach the JSON if requested.';
      updateActions();
    });

    if (btnCopy) {
      btnCopy.addEventListener('click', async () => {
        if (!lastMessage) return;
        try {
          await navigator.clipboard.writeText(lastMessage);
          if (status) status.textContent = 'Copied to clipboard.';
        } catch {
          if (status) status.textContent = 'Copy failed (browser blocked). Use Email or WhatsApp instead.';
        }
      });
    }

    if (btnDownload) {
      btnDownload.addEventListener('click', () => {
        if (!lastJson || !lastFilename) return;
        try {
          const blob = new Blob([JSON.stringify(lastJson, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = lastFilename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 3000);
          if (status) status.textContent = `Downloaded ${lastFilename}. Attach it to your email if needed.`;
        } catch {
          if (status) status.textContent = 'Download failed in this browser.';
        }
      });
    }

    updateActions();
  });
})();
