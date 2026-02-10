// Lightweight client-side i18n (no build step).
// - Auto-detects language (URL param, saved preference, browser language).
// - Optional language switcher can call `SCP_I18N.setLang(...)`.
// - Translate elements via data attributes:
//   - data-i18n="key" (textContent)
//   - data-i18n-html="key" (innerHTML)
//   - data-i18n-placeholder="key" (placeholder attribute)
//   - data-i18n-title="key" (title attribute)
//   - data-i18n-aria-label="key" (aria-label attribute)
(() => {
  const SUPPORTED = ['en', 'es'];
  const DEFAULT_LANG = 'en';
  const STORAGE_KEY = 'scp:lang';

  const normalizeLang = (raw) => {
    const v = String(raw || '').trim().toLowerCase();
    if (!v) return '';
    // Accept `es-ES` / `en-US` / `es_ES`.
    const base = v.split(/[-_]/)[0] || '';
    return base;
  };

  const getSavedLang = () => {
    try {
      if (!window.localStorage) return '';
      return normalizeLang(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      return '';
    }
  };

  const saveLang = (lang) => {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(STORAGE_KEY, String(lang));
    } catch {
      // ignore
    }
  };

  const detectLang = () => {
    try {
      const url = new URL(window.location.href);
      const fromQuery = normalizeLang(url.searchParams.get('lang'));
      if (SUPPORTED.includes(fromQuery)) {
        saveLang(fromQuery);
        return fromQuery;
      }
    } catch {
      // ignore
    }

    const saved = getSavedLang();
    if (SUPPORTED.includes(saved)) return saved;

    try {
      const langs = Array.isArray(navigator.languages) ? navigator.languages : [];
      for (const l of langs) {
        const norm = normalizeLang(l);
        if (SUPPORTED.includes(norm)) return norm;
      }
    } catch {
      // ignore
    }

    try {
      const nav = normalizeLang(navigator.language);
      if (SUPPORTED.includes(nav)) return nav;
    } catch {
      // ignore
    }

    return DEFAULT_LANG;
  };

  const DICT = {
    en: {
      'lang.label': 'Language',
      'lang.en': 'English',
      'lang.es': 'Spanish',
      'lang.en_short': 'EN',
      'lang.es_short': 'ES',

      'nav.home': 'Home',
      'nav.properties': 'Properties',
      'nav.new_builds': 'New Builds',
      'nav.businesses': 'Businesses',
      'nav.vehicles': 'Vehicles',
      'nav.services': 'Services',
      'nav.account': 'Account',
      'nav.contact_us': 'Contact Us',
      'nav.email': 'Email',
      'nav.call': 'Call',

      'home.hero.title': 'Property, Business, and Vehicle Deals, Managed Like a Concierge.',
      'home.hero.subtitle': 'Buy, sell, rent, manage, and maintain. One trusted team for resale homes, new-build developments, commercial spaces, businesses for sale, and vehicles.',
      'home.hero.browse_properties': 'Browse Properties',
      'home.hero.new_builds': 'New Builds',
      'home.hero.businesses_for_sale': 'Businesses for Sale',
      'home.hero.vehicles': 'Vehicles',
      'home.hero.viewing_trip': 'Viewing Trip Package',

      'filters.more': 'More',
      'filters.clear': 'Clear',
      'filters.search': 'Search',
      'filters.ref': 'Ref',
      'filters.location': 'Location',
      'filters.location_placeholder': 'Search locations',
      'filters.any': 'Any',
      'filters.type': 'Type',
      'filters.any_type': 'Any Type',
      'filters.operation': 'Operation',
      'filters.sale': 'Sale',
      'filters.rent_long': 'Rent (long-term)',
      'filters.rent_vacation': 'Rent (vacation)',
      'filters.max_price': 'Max Price',
      'filters.max_price_placeholder': 'Any (e.g. 50000)',
      'filters.beds': 'Beds',
      'filters.baths': 'Baths',
      'filters.pool': 'Pool',
      'filters.parking': 'Parking',
      'filters.with_pool': 'With Pool',
      'filters.private_pool': 'Private Pool',
      'filters.communal_pool': 'Communal Pool',
      'filters.with_parking': 'With Parking',
      'filters.beach': 'Beach',
      'filters.sea_view': 'Sea View',
      'filters.sea_view_yes': 'Sea view',

      'account.hero.title': 'Your Account',
      'account.hero.subtitle': 'Sign in to sync favourites across devices and unlock partner tools.',

      'nearby.title': 'Area snapshot',
      'nearby.loading_short': 'Loading…',
      'nearby.loading': 'Loading nearby amenities…',
      'nearby.note': 'Distances are approximate (straight-line). Data: OpenStreetMap contributors.',
      'nearby.approx': 'approx.',
      'nearby.unavailable': 'Nearby info may be limited for this listing.',

      'nearby.area': 'Area',
      'nearby.airport': 'Airport (ALC)',
      'nearby.shops': 'Shops',
      'nearby.schools': 'Schools',
      'nearby.parks': 'Parks',
      'nearby.beach': 'Beach',
      'nearby.supermarket': 'Supermarket',
      'nearby.pharmacy': 'Pharmacy',
      'nearby.park': 'Park',
      'nearby.school': 'School',
      'nearby.bus': 'Bus stop',
      'nearby.golf': 'Golf',

      'nearby.fallback_shops': 'Nearby supermarkets and daily services (varies by exact street)',
      'nearby.fallback_schools': 'Local schools in the area (varies by exact street)',
      'nearby.fallback_parks': 'Green spaces and promenades nearby (varies by exact street)',

      'nearby.copy.torrevieja': 'Coastal city with beaches, a marina promenade, and a wide choice of shops and restaurants.',
      'nearby.copy.guardamar': 'Known for long sandy beaches and the pine forest, with an easygoing coastal lifestyle.',
      'nearby.copy.orihuela': 'Popular coastal area with beaches, golf options, and year-round services.',
      'nearby.copy.quesada': 'Residential area with golf nearby and quick access to the coast and larger towns.',
      'nearby.copy.pilar': 'Authentic Spanish town close to the coast, with beaches and everyday services nearby.',
      'nearby.copy.default': 'Costa Blanca South lifestyle with year-round services, coastal atmosphere, and great connectivity across the area.'
    },
    es: {
      'lang.label': 'Idioma',
      'lang.en': 'English',
      'lang.es': 'Español',
      'lang.en_short': 'EN',
      'lang.es_short': 'ES',

      'nav.home': 'Inicio',
      'nav.properties': 'Propiedades',
      'nav.new_builds': 'Obra Nueva',
      'nav.businesses': 'Negocios',
      'nav.vehicles': 'Vehículos',
      'nav.services': 'Servicios',
      'nav.account': 'Cuenta',
      'nav.contact_us': 'Contacto',
      'nav.email': 'Correo',
      'nav.call': 'Llamar',

      'home.hero.title': 'Ofertas de propiedades, negocios y vehículos, gestionadas como un concierge.',
      'home.hero.subtitle': 'Compra, vende, alquila, gestiona y mantén. Un solo equipo de confianza para viviendas de reventa, obra nueva, locales comerciales, negocios en venta y vehículos.',
      'home.hero.browse_properties': 'Ver propiedades',
      'home.hero.new_builds': 'Obra Nueva',
      'home.hero.businesses_for_sale': 'Negocios en venta',
      'home.hero.vehicles': 'Vehículos',
      'home.hero.viewing_trip': 'Paquete de viaje de visitas',

      'filters.more': 'Más',
      'filters.clear': 'Borrar',
      'filters.search': 'Buscar',
      'filters.ref': 'Ref',
      'filters.location': 'Ubicación',
      'filters.location_placeholder': 'Buscar ubicaciones',
      'filters.any': 'Cualquiera',
      'filters.type': 'Tipo',
      'filters.any_type': 'Cualquier tipo',
      'filters.operation': 'Operación',
      'filters.sale': 'Venta',
      'filters.rent_long': 'Alquiler (larga temporada)',
      'filters.rent_vacation': 'Alquiler (vacacional)',
      'filters.max_price': 'Precio máximo',
      'filters.max_price_placeholder': 'Cualquiera (p.ej. 50000)',
      'filters.beds': 'Dorms',
      'filters.baths': 'Baños',
      'filters.pool': 'Piscina',
      'filters.parking': 'Aparcamiento',
      'filters.with_pool': 'Con piscina',
      'filters.private_pool': 'Piscina privada',
      'filters.communal_pool': 'Piscina comunitaria',
      'filters.with_parking': 'Con aparcamiento',
      'filters.beach': 'Playa',
      'filters.sea_view': 'Vistas al mar',
      'filters.sea_view_yes': 'Vistas al mar',

      'account.hero.title': 'Tu cuenta',
      'account.hero.subtitle': 'Inicia sesión para sincronizar favoritos y desbloquear herramientas de colaboración.',

      'nearby.title': 'Resumen de zona',
      'nearby.loading_short': 'Cargando…',
      'nearby.loading': 'Cargando servicios cercanos…',
      'nearby.note': 'Las distancias son aproximadas (en linea recta). Datos: colaboradores de OpenStreetMap.',
      'nearby.approx': 'aprox.',
      'nearby.unavailable': 'La informacion cercana puede ser limitada para este anuncio.',

      'nearby.area': 'Zona',
      'nearby.airport': 'Aeropuerto (ALC)',
      'nearby.shops': 'Tiendas',
      'nearby.schools': 'Escuelas',
      'nearby.parks': 'Parques',
      'nearby.beach': 'Playa',
      'nearby.supermarket': 'Supermercado',
      'nearby.pharmacy': 'Farmacia',
      'nearby.park': 'Parque',
      'nearby.school': 'Escuela',
      'nearby.bus': 'Parada de bus',
      'nearby.golf': 'Golf',

      'nearby.fallback_shops': 'Supermercados y servicios diarios cerca (varia segun la calle exacta)',
      'nearby.fallback_schools': 'Escuelas locales en la zona (varia segun la calle exacta)',
      'nearby.fallback_parks': 'Zonas verdes y paseos cercanos (varia segun la calle exacta)',

      'nearby.copy.torrevieja': 'Ciudad costera con playas, paseo maritimo y una amplia oferta de tiendas y restaurantes.',
      'nearby.copy.guardamar': 'Conocida por sus largas playas de arena y el pinar, con un estilo de vida costero relajado.',
      'nearby.copy.orihuela': 'Zona costera popular con playas, opciones de golf y servicios todo el ano.',
      'nearby.copy.quesada': 'Zona residencial con golf cerca y acceso rapido a la costa y a pueblos mas grandes.',
      'nearby.copy.pilar': 'Pueblo autentico cerca de la costa, con playas y servicios diarios cerca.',
      'nearby.copy.default': 'Estilo de vida en Costa Blanca Sur con servicios todo el ano, ambiente costero y buena conectividad en la zona.'
    }
  };

  let lang = detectLang();

  const format = (text, vars) => {
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, (m, k) => {
      if (!Object.prototype.hasOwnProperty.call(vars, k)) return m;
      return String(vars[k]);
    });
  };

  const t = (key, vars) => {
    const k = String(key || '');
    const dict = DICT[lang] || DICT[DEFAULT_LANG] || {};
    const fallback = DICT[DEFAULT_LANG] || {};
    const val = Object.prototype.hasOwnProperty.call(dict, k)
      ? dict[k]
      : (Object.prototype.hasOwnProperty.call(fallback, k) ? fallback[k] : k);
    return format(val, vars);
  };

  const setHtmlLang = () => {
    try {
      document.documentElement.lang = lang;
    } catch {
      // ignore
    }
  };

  const applyTranslations = (root = document) => {
    if (!root || !root.querySelectorAll) return;

    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });

    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (!key) return;
      el.innerHTML = t(key);
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      el.setAttribute('placeholder', t(key));
    });

    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (!key) return;
      el.setAttribute('title', t(key));
    });

    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (!key) return;
      el.setAttribute('aria-label', t(key));
    });
  };

  const setLang = (next, { persist = true, reload = true } = {}) => {
    const n = normalizeLang(next);
    if (!SUPPORTED.includes(n)) return;
    lang = n;
    if (persist) saveLang(lang);
    setHtmlLang();
    if (reload) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('lang');
        window.location.href = url.toString();
        return;
      } catch {
        window.location.reload();
      }
    }
  };

  const init = () => {
    setHtmlLang();
    applyTranslations(document);
  };

  window.SCP_I18N = {
    SUPPORTED,
    DEFAULT_LANG,
    get lang() { return lang; },
    detectLang,
    t,
    setLang,
    applyTranslations
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
