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
  const toLangArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  };

  const SUPPORTED = Array.from(new Set([
    'en',
    'es',
    'ro',
    'sv',
    ...toLangArray(window.SCP_I18N_EXTRA_LANGS)
  ]));
  const DEFAULT_LANG = 'en';
  const STORAGE_KEY = 'scp:lang';
  const AUTO_CACHE_VERSION = '20260211b';
  const AUTO_CACHE_KEY_PREFIX = `scp:i18n:auto:${AUTO_CACHE_VERSION}:`;
  const AUTO_ERROR_KEY_PREFIX = `scp:i18n:auto:error:${AUTO_CACHE_VERSION}:`;
  const AUTO_RETRY_AFTER_MS = 12 * 60 * 60 * 1000;
  const AUTO_TRANSLATE_LANGS = Array.from(new Set([
    'ro',
    'sv',
    ...toLangArray(window.SCP_I18N_AUTO_TRANSLATE_LANGS)
  ]));
  const AUTO_TRANSLATE_BATCH_SIZE = 24;
  const AUTO_TRANSLATE_ENABLED = true;
  const AUTO_TRANSLATE_DELIMITER = '___SCP_SEGMENT___';
  const LANG_FALLBACKS = {
    ro: ['en', 'es'],
    sv: ['en', 'es']
  };

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
      'lang.ro': 'Romanian',
      'lang.sv': 'Swedish',
      'lang.en_short': 'EN',
      'lang.es_short': 'ES',
      'lang.ro_short': 'RO',
      'lang.sv_short': 'SV',

      'common.in': 'in',
      'common.all': 'All',

      'nav.home': 'Home',
      'nav.properties': 'Properties',
      'nav.new_builds': 'New Builds',
      'nav.businesses': 'Businesses',
      'nav.vehicles': 'Vehicles',
      'nav.services': 'Services',
      'nav.blog': 'Blog',
      'nav.account': 'Account',
      'nav.contact_us': 'Contact Us',
      'nav.email': 'Email',
      'nav.call': 'Call',

      'blog.hero.title': 'Blog & Market Pulse',
      'blog.hero.subtitle': 'Short, useful updates generated from public headlines and Google Trends, with practical takeaways for Costa Blanca South.',
      'blog.hero.disclaimer': 'We do not copy full articles. Each post is an original summary/commentary and includes source links so you can verify details.',
      'blog.tag.updated_daily': 'Updated daily',
      'blog.tag.news': 'News',
      'blog.tag.trends': 'Trends',
      'blog.filters.search': 'Search',
      'blog.filters.search_placeholder': 'Search topics…',
      'blog.filters.type': 'Type',
      'blog.filters.language': 'Language',
      'blog.lang.auto': 'My language',
      'blog.lang.all': 'All languages',
      'blog.kind.news': 'News',
      'blog.kind.trend': 'Trends',
      'blog.actions.reload': 'Reload',
      'blog.actions.copy_link': 'Copy link',
      'blog.actions.copied': 'Copied',
      'blog.actions.save': 'Save',
      'blog.actions.saved': 'Saved',
      'blog.actions.saved_filter': 'Saved',
      'blog.count.posts': 'posts',
      'blog.empty.title': 'No posts yet',
      'blog.empty.subtitle': 'This section updates daily. If you just enabled it, the first posts will appear after the next sync.',
      'blog.saved_empty.title': 'No saved posts yet',
      'blog.saved_empty.subtitle': 'Tap Save on any article to keep it here.',
      'blog.updated.label': 'Last updated',
      'blog.post.untitled': 'Untitled',
      'blog.post.sources': 'Sources',
      'blog.card.open_hint': 'Tap card to open article',
      'blog.footer.p': 'Daily updates for Costa Blanca South: property, business, vehicles, and practical advice.',
      'blog.footer.explore': 'Explore',
      'blog.footer.contact': 'Contact',

      'shop.actions.add_to_basket': 'Add to basket',
      'shop.basket.added': 'Added to basket',
      'shop.basket.added_short': 'Added',

      'home.hero.title': 'Property, Business, and Vehicle Deals, Managed Like a Concierge.',
      'home.hero.subtitle': 'Buy, sell, rent, manage, and maintain. One trusted team for resale homes, new-build developments, commercial spaces, businesses for sale, and vehicles.',
      'home.hero.browse_properties': 'Browse Properties',
      'home.hero.new_builds': 'New Builds',
      'home.hero.businesses_for_sale': 'Businesses for Sale',
      'home.hero.vehicles': 'Vehicles',
      'home.hero.viewing_trip': 'Viewing Trip Package',

      'home.cards.properties.title': 'Properties',
      'home.cards.properties.desc': 'Resale homes and new build developments, plus commercial listings, with local-only map precision.',
      'home.cards.businesses.title': 'Businesses',
      'home.cards.businesses.desc': 'Buy and sell businesses, plus hands-on management and documentation support.',
      'home.cards.vehicles.title': 'Vehicles',
      'home.cards.vehicles.desc': 'Cars and boats, for sale or rent, with practical support from start to finish.',
      'home.footer.title': 'Need help choosing?',
      'home.footer.subtitle': 'Send us what you want (resale or new build) and we will shortlist the best options, fast.',
      'home.footer.viewing_trip': 'Plan a viewing trip',

      'filters.more': 'More',
      'filters.less': 'Less',
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

      'ui.menu': 'Menu',
      'ui.map': 'Map',
      'ui.list': 'List',
      'ui.open_filters': 'Open filters',
      'ui.toggle_map': 'Toggle map',
      'ui.clear_all_filters': 'Clear all filters',
      'ui.apply_filters': 'Apply filters',
      'ui.close_filters': 'Close filters',
      'ui.previous_image': 'Previous image',
      'ui.next_image': 'Next image',

      'map.tools.aria': 'Map search tools',
      'map.tools.draw': 'Draw area',
      'map.tools.around': 'Around me',
      'map.tools.clear': 'Clear',
      'map.tools.radius': 'Radius',
      'map.tools.status_none': 'Tip: Draw an area on the map, or search around you.',
      'map.tools.status_drawing': 'Drawing perimeter: click to add points, double-click to finish.',
      'map.tools.status_polygon': 'Perimeter filter is ON. Only listings inside the drawn area are shown.',
      'map.tools.status_around': 'Around me filter is ON ({km} km).',
      'map.tools.draw_unavailable': 'Perimeter tool is not available right now.',
      'map.tools.geo_unavailable': 'Geolocation is not available on this device.',
      'map.tools.geo_getting': 'Getting your location…',
      'map.tools.geo_failed': 'Location request failed. Try again.',
      'map.tools.geo_denied': 'Location permission denied.',
      'map.tools.geo_timeout': 'Location request timed out. Try again.',

      'properties.results.found_prefix': 'Found',
      'properties.results.found_suffix': 'listings in Costa Blanca South',
      'properties.results.subtitle': 'Filter resale and new build listings and switch to map view to see only the exact results.',
      'properties.sort.label': 'Sort',
      'properties.sort.featured': 'Featured',
      'properties.sort.date_desc': 'Date added (newest)',
      'properties.sort.date_asc': 'Date added (oldest)',
      'properties.sort.price_asc': 'Price (low to high)',
      'properties.sort.price_desc': 'Price (high to low)',
      'properties.sort.beds_desc': 'Beds (high to low)',
      'properties.sort.area_desc': 'Area (high to low)',
      'properties.sort.eur_sqm_asc': '€/m2 (low to high)',
      'properties.sort.beach_asc': 'Beach distance (near to far)',
      'properties.saved': 'Saved',
      'properties.showing': 'Showing',
      'properties.send_saved': 'Create catalog',
      'properties.save_alert': 'Save alert',
      'properties.save_alert_hint': 'Save these requirements and get notified when new matches arrive.',
      'properties.save_alert_signin_hint': 'Sign in first to save requirements and receive match alerts.',
      'properties.save_alert_signin': 'Sign in first to save alerts',
      'properties.save_alert_saving': 'Saving…',
      'properties.save_alert_saved': 'Alert saved',
      'properties.save_alert_setup': 'Run Supabase SQL update',
      'properties.save_alert_error': 'Could not save alert',
      'properties.cta.sell_property': 'Sell your property',
      'properties.cta.new_builds': 'New Builds',
      'properties.cta.viewing_trip': 'Plan a viewing trip (2-7 days)',

      'newbuilds.results.found_prefix': 'Found',
      'newbuilds.results.found_suffix': 'new build listings in Costa Blanca South',
      'newbuilds.results.subtitle': 'Filter new build listings and switch to map view to see only the exact results.',
      'newbuilds.cta.how_it_works': 'How New Builds Work',
      'newbuilds.cta.all_properties': 'All Properties',

      'city.all': 'All Destinations',
      'alerts.scope.resales': 'Properties',
      'alerts.scope.new_builds': 'New Builds',
      'alerts.scope.all': 'All Listings',
      'alerts.default_name': 'Saved alert',

      'listing.for_rent': 'For Rent',
      'listing.for_sale': 'For Sale',
      'listing.traspaso': 'Traspaso',
      'listing.business_for_sale': 'Business for sale',
      'listing.business': 'Business',
      'listing.vehicle': 'Vehicle',
      'listing.save_aria': 'Save listing',
      'listing.reference_unavailable': 'Reference unavailable',
      'listing.original_ref_show': 'Show original reference',
      'listing.original_ref_copy': 'Copy',
      'listing.original_ref_no_ref': 'No ref',
      'listing.item': 'Listing',
      'listing.load_more': 'Load more ({shown} / {total})',
      'listing.play_reel': 'Play reel',

      'modal.ref_unavailable': 'Ref unavailable',
      'modal.type_default': 'Property',
      'modal.town_unknown': 'Unknown Area',
      'modal.description_placeholder': 'Property details coming soon.',
      'modal.original_ref': 'Original ref',
      'modal.original_ref_short': 'Orig',
      'modal.copy_original_ref': 'Copy original reference',
      'modal.original_id': 'Feed ID',
      'modal.original_id_short': 'ID',
      'modal.copy_original_id': 'Copy feed ID',
      'modal.copied': 'Copied',
      'modal.location_title': 'Location',
      'modal.open_google_maps': 'Open in Google Maps',
      'modal.map_unavailable': 'Map unavailable',
      'modal.map_unavailable_listing': 'Map unavailable for this listing.',
      'modal.quick_view_note': 'Quick view of the area. Zoom in to explore nearby beaches, golf, and amenities.',
      'modal.amenities_title': 'Premium Amenities',
      'modal.amenities_fallback_1': 'Premium finishes throughout',
      'modal.amenities_fallback_2': 'Advanced climate control',
      'modal.fav_save': '♡ Save',
      'modal.fav_saved': '♥ Saved',
      'modal.brochure_pdf': 'Brochure (PDF)',
      'modal.reel_play': 'Play Reel',
      'modal.reel_video': 'Reel Studio',
      'modal.reel_tiktok': 'TikTok Video',
      'modal.call_now': 'Call Now',
      'modal.request_visit': 'Request to visit',
      'modal.official_page': 'Official page',
      'modal.share': 'Share',
      'modal.share.native': 'Share',
      'modal.share.copy_link': 'Copy link',
      'modal.share.copy_caption': 'Copy caption',
      'modal.share.x_twitter': 'X (Twitter)',
      'modal.share.report_issue': 'Report issue',
      'modal.share.copy_prompt': 'Copy link:',
      'modal.share.copied_open_app': 'Copied. Open {app}',
      'modal.spec.beds': 'Beds',
      'modal.spec.baths': 'Baths',
      'modal.spec.area': 'Area',

      'properties.fav.save_title': 'Save listing',
      'properties.fav.remove_title': 'Remove from saved',

      'catalog.builder.title': 'Create client catalog',
      'catalog.builder.subtitle': 'Use your filtered search or saved listings to generate a shareable catalog link.',
      'catalog.builder.source': 'Source',
      'catalog.builder.source_filtered': 'Current search results',
      'catalog.builder.source_saved': 'Saved listings',
      'catalog.builder.limit': 'Listings to include',
      'catalog.builder.client_name': 'Client name (optional)',
      'catalog.builder.client_name_placeholder': 'Client name',
      'catalog.builder.whitelabel': 'White-label',
      'catalog.builder.open': 'Open catalog',
      'catalog.builder.copy': 'Copy link',
      'catalog.builder.status_none': 'No listings available for this selection. Try changing source or filters.',
      'catalog.builder.status_ready': 'Ready: {selected} listings.',
      'catalog.builder.status_ready_limited': 'Ready: {selected} of {total} listings (limited to {limit}).',
      'catalog.builder.copied': 'Catalog link copied',
      'catalog.builder.copy_failed': 'Copy failed',
      'catalog.builder.opened': 'Catalog opened in a new tab',

      'catalog.page.title': 'Client Catalog',
      'catalog.page.subtitle': 'A clean shortlist generated from your search.',
      'catalog.page.subtitle_wl': 'White-label view enabled. Branding is hidden.',
      'catalog.page.back': 'Back to search',
      'catalog.page.copy': 'Copy link',
      'catalog.page.print': 'Print / Save PDF',
      'catalog.page.whitelabel': 'White-label',
      'catalog.page.for_client': 'For',
      'catalog.page.listings': 'listings',
      'catalog.page.not_found': 'not found',
      'catalog.page.empty_title': 'No listings selected',
      'catalog.page.empty_help': 'Open Properties, filter listings, then use Create catalog.',

      'brochure.print_pdf': 'Print / Save as PDF',
      'brochure.share_whatsapp': 'Send by WhatsApp',
      'brochure.back': 'Back',
      'brochure.loading': 'Loading…',
      'brochure.tools_label': 'Brochure tools',
      'brochure.white_label': 'White-label',
      'brochure.on': 'On',
      'brochure.off': 'Off',
      'brochure.copy_link': 'Copy link',
      'brochure.email_link': 'Email link',
      'brochure.section.highlights': 'Highlights',
      'brochure.section.area_snapshot': 'Area snapshot',
      'brochure.section.description': 'Description',
      'brochure.section.features': 'Features',
      'brochure.section.gallery': 'Gallery',
      'brochure.footer.book_viewing': 'Book a viewing',
      'brochure.footer.phone': 'Phone',
      'brochure.footer.email': 'Email',
      'brochure.footer.reference': 'Reference',
      'brochure.missing_ref': 'Missing ref',
      'brochure.missing_ref_help_html': 'Open this page with <code>?ref=SCP-XXXX</code>.',
      'brochure.listing_not_found': 'Listing not found.',
      'brochure.no_image': 'No image available',
      'brochure.no_gallery_images': 'No gallery images available.',
      'brochure.details_soon': 'Details coming soon.',
      'brochure.copied': 'Copied',
      'brochure.type_default': 'Listing',
      'brochure.stat.beds': '{n} beds',
      'brochure.stat.baths': '{n} baths',
      'brochure.stat.built': '{n} m2',
      'brochure.highlight.reference': 'Reference',
      'brochure.highlight.operation': 'Operation',
      'brochure.highlight.location': 'Location',
      'brochure.highlight.built_area': 'Built area',

      'reel.back': 'Back',
      'reel.loading': 'Loading…',
      'reel.tools_label': 'Reel tools',
      'reel.white_label': 'White-label',
      'reel.on': 'On',
      'reel.off': 'Off',
      'reel.create_video': 'Create video',
      'reel.share': 'Share',
      'reel.download': 'Download',
      'reel.download_captions': 'Download captions',
      'reel.copy_caption': 'Copy caption',
      'reel.preview.title': 'Reel preview',
      'reel.preview.subtitle': 'Creating a short social video with logo + key details.',
      'reel.preview.subtitle_dynamic': 'Creating a {duration} social video with {audio} and {captions}.',
      'reel.caption.label': 'Caption',
      'reel.caption.note': 'Paste into Instagram/TikTok if needed.',
      'reel.caption.on': 'Captions on',
      'reel.caption.off': 'Captions off',
      'reel.caption.more_info': 'Ask for more details',
      'reel.caption.contact': 'Message us on WhatsApp',
      'reel.controls.duration': 'Duration',
      'reel.controls.audio': 'Audio',
      'reel.controls.overlay_caption': 'Show on-screen captions',
      'reel.duration.quick': '7s (Quick)',
      'reel.duration.recommended': '9s (Recommended)',
      'reel.duration.standard': '12s',
      'reel.duration.detailed': '15s (Detailed)',
      'reel.playback.label': 'Playback',
      'reel.playback.note': 'Use this player to preview before sharing.',
      'reel.audio.none': 'No music',
      'reel.audio.ambient': 'Ambient',
      'reel.audio.upbeat': 'Upbeat',
      'reel.disclaimer': 'Video export runs in your browser. If sharing a file is not supported on your device, use Download then upload in your app.',
      'reel.missing_ref': 'Missing ref',
      'reel.missing_ref_help': 'Open this page with ?ref=SCP-XXXX',
      'reel.listing_not_found': 'Listing not found.',
      'reel.copy_prompt': 'Copy caption:',
      'reel.status.prep': 'Preparing…',
      'reel.status.no_canvas': 'Your browser does not support this feature.',
      'reel.status.no_images': 'No images found for this listing.',
      'reel.status.loading_images': 'Loading images…',
      'reel.status.loaded_n': 'Loaded {n} images',
      'reel.status.images_failed': 'Images failed to load. Try again.',
      'reel.status.recording': 'Recording…',
      'reel.status.recorder_failed': 'Video export is not supported on this browser.',
      'reel.status.ready': 'Video ready.',
      'reel.status.ready_with_audio': 'Video ready with audio.',
      'reel.status.shared': 'Shared.',
      'reel.status.fallback_shared': 'Downloaded. Paste caption in {app}.',
      'reel.status.no_video': 'Create the video first.',
      'reel.status.loading_listing': 'Loading listing…',
      'reel.status.ready_to_create': 'Ready. Tap “Create video”.',
      'reel.status.caption_copied': 'Caption copied.',
      'reel.status.preferred_app': 'Tip: Generate, then Share and choose {app}.',
      'pricing.on_request': 'Price on request',
      'time.month': 'month',
      'pricing.per_night': '{price} / night',
      'pricing.per_day': '{price} / day',
      'pricing.per_week': '{price} / week',
      'pricing.per_month': '{price} / month',
      'pricing.traspaso_suffix': '{price} (Traspaso)',

      'account.actions.clear_offline_cache': 'Clear offline cache',
      'account.actions.reset_login': 'Reset login',
      'account.signin.title': 'Sign in',
      'account.signin.button': 'Sign in',
      'account.signup.title': 'Create account',
      'account.signup.button': 'Create account',
      'account.signup.note': 'We use your email only for login and service updates you request.',
      'account.magic.title': 'Or sign in with a magic link',
      'account.magic.button': 'Send magic link',
      'account.magic.note': 'Check your inbox and click the link to sign in.',
      'account.reset.title': 'Reset your password',
      'account.reset.button': 'Send reset link',
      'account.reset.note': 'We will email you a secure link to choose a new password.',
      'account.recovery.title': 'Set a new password',
      'account.recovery.subtitle': 'Choose a strong password (minimum 8 characters). You will stay signed in after updating.',
      'account.recovery.new_password': 'New password',
      'account.recovery.confirm_password': 'Confirm new password',
      'account.recovery.update': 'Update password',
      'account.recovery.cancel': 'Cancel',
      'account.field.email': 'Email',
      'account.placeholder.email': 'you@email.com',
      'account.field.password': 'Password',
      'account.field.password_min': 'Minimum 8 characters',
      'account.field.password_current': 'Your password',
      'account.field.password_repeat': 'Repeat the password',
      'account.dashboard.title': 'Dashboard',
      'account.dashboard.connecting': 'Connecting…',
      'account.dashboard.browse': 'Browse',
      'account.dashboard.saved': 'Saved',
      'account.dashboard.manual_pdf': 'Manual PDF',
      'account.dashboard.sign_out': 'Sign out',
      'account.tiles.saved_listings': 'Saved listings',
      'account.tiles.saved_word': 'saved',
      'account.tiles.saved_count': '{count} saved',
      'account.tiles.saved_desc': 'Open your shortlist and share it instantly.',
      'account.tiles.sell_property': 'Sell',
      'account.tiles.sell_property_title': 'List your property',
      'account.tiles.sell_property_desc': 'Upload photos and submit for admin review. We publish verified listings.',
      'account.tiles.browse': 'Browse',
      'account.tiles.browse_desc_title': 'Find your next place',
      'account.tiles.browse_desc': 'Fast filters, accurate map, and shareable refs.',
      'account.tiles.guide': 'Guide',
      'account.tiles.guide_title': 'How to use the app',
      'account.tiles.guide_desc': 'All features, benefits, and quick tips in one place.',
      'account.tiles.scout': 'Earn',
      'account.tiles.scout_title': 'Street Scout (€200–€500)',
      'account.tiles.scout_desc': 'Snap a For Sale board and earn when it closes.',
      'account.tiles.admin': 'Admin',
      'account.tiles.admin_fav_title': 'Favourites inbox',
      'account.tiles.admin_fav_desc': 'See saved listings from all users (admin only).',
      'account.tiles.admin_crm_title': 'Leads & contacts',
      'account.tiles.admin_crm_desc': 'Private CRM data (admin only).',
      'account.tiles.admin_shop_title': 'Shop editor',
      'account.tiles.admin_shop_desc': 'Curate smart device products shown in the app.',
      'account.tiles.partner_tools': 'Partner tools',
      'account.tiles.partner_tools_title': 'White-label & collaboration',
      'account.tiles.partner_tools_desc': 'For agencies, agents, developers and partners.',
      'account.admin.title': 'Admin Dashboard',
      'account.admin.subtitle': 'Manage favourites inbox, roles, and collaborators.',
      'account.admin.btn.fav_inbox': 'Favourites Inbox',
      'account.admin.btn.crm': 'CRM',
      'account.admin.btn.shop': 'Shop Editor',
      'account.admin.btn.scout': 'Street Scout Inbox',
      'account.admin.user_roles': 'User roles',
      'account.admin.user_roles_help': 'Users create their own account first. Then assign a role here.',
      'account.admin.search_placeholder': 'Search by email or display name (e.g. john@agency.com)',
      'account.admin.search': 'Search',
      'account.diagnostics.title': 'Diagnostics',
      'account.diagnostics.subtitle': 'Open this page with <code>?qa=1</code> to see setup checks.',
      'account.copy_prompt': 'Copy:',
      'account.badge.partner': 'Partner tools enabled',
      'account.badge.scout': 'Street Scout',
      'account.badge.newbuilds': 'New builds',

      'account.role.title': 'Your workspace',
      'account.role.admin.title': 'Admin control center',
      'account.role.admin.b1': 'Review favourites inbox and respond fast to high-intent clients.',
      'account.role.admin.b2': 'Approve new submissions (properties, vehicles, Street Scout).',
      'account.role.admin.b3': 'Assign roles for agencies, agents, developers and collaborators.',
      'account.role.admin.a1': 'Favourites inbox',
      'account.role.admin.a2': 'CRM',
      'account.role.admin.a3': 'Street Scout',
      'account.role.admin.note': 'Tip: use “Quick share studio” to generate white-label brochure/reel links in one click.',

      'account.role.developer.title': 'Developer workspace',
      'account.role.developer.b1': 'Share new builds with clients using brochure + reel video.',
      'account.role.developer.b2': 'Use white-label links when sharing with partner agencies.',
      'account.role.developer.b3': 'Coordinate viewings and documentation with the SCP team.',
      'account.role.developer.a1': 'New builds',
      'account.role.developer.a2': 'Collaboration',
      'account.role.developer.a3': 'Services',
      'account.role.developer.note': 'Use Quick share studio for brochure/reel links by reference (SCP-XXXX).',

      'account.role.agency_admin.title': 'Agency workspace',
      'account.role.agency_admin.b1': 'Share listings with your clients using your own branding (white-label).',
      'account.role.agency_admin.b2': 'Use reels to increase response on Instagram/TikTok.',
      'account.role.agency_admin.b3': 'Send shortlists and keep everything in one system.',
      'account.role.agency_admin.a1': 'Saved',
      'account.role.agency_admin.a2': 'Partner tools',
      'account.role.agency_admin.a3': 'Guide',
      'account.role.agency_admin.note': 'Use Quick share studio to generate brochure/reel links in seconds.',

      'account.role.agent.title': 'Agent workspace',
      'account.role.agent.b1': 'Save listings and share a clean shortlist to your client.',
      'account.role.agent.b2': 'Generate brochure PDFs and reel videos for social sharing.',
      'account.role.agent.b3': 'White-label mode removes SCP branding for your presentations.',
      'account.role.agent.a1': 'Saved',
      'account.role.agent.a2': 'Browse',
      'account.role.agent.a3': 'Viewing trip',
      'account.role.agent.note': 'Tip: open a listing modal and click Instagram/TikTok to generate a reel for sharing.',

      'account.role.collaborator.title': 'Collaborator workspace',
      'account.role.collaborator.b1': 'Street Scout: take a photo of a “For Sale” board and earn €200–€500.',
      'account.role.collaborator.b2': 'Your submissions are tracked and visible in your dashboard.',
      'account.role.collaborator.b3': 'You can also share listings with brochure PDFs and reels.',
      'account.role.collaborator.a1': 'Street Scout',
      'account.role.collaborator.a2': 'Saved',
      'account.role.collaborator.a3': 'Guide',
      'account.role.collaborator.note': 'Keep your location enabled when submitting Street Scout leads.',

      'account.role.client.title': 'Client dashboard',
      'account.role.client.b1': 'Save listings on mobile and desktop (sync enabled).',
      'account.role.client.b2': 'Request a visit and plan a viewing trip when you are ready.',
      'account.role.client.b3': 'Sell your property with admin approval for quality control.',
      'account.role.client.a1': 'Browse',
      'account.role.client.a2': 'Saved',
      'account.role.client.a3': 'Sell',
      'account.role.client.note': 'If you are an agency/agent/developer, ask us to enable partner tools.',

      'account.quickshare.kicker': 'Partner tools',
      'account.quickshare.title': 'Quick share studio',
      'account.quickshare.whitelabel': 'White-label',
      'account.quickshare.ref_label': 'Reference',
      'account.quickshare.open_listing': 'Open listing',
      'account.quickshare.open_brochure': 'Brochure (PDF)',
      'account.quickshare.open_reel': 'Reel (Video)',
      'account.quickshare.copy_link': 'Copy link',
      'account.quickshare.copy_brochure': 'Copy brochure',
      'account.quickshare.copy_reel': 'Copy reel',
      'account.quickshare.hint': 'Tip: open a listing modal and click Instagram/TikTok to generate a reel video for sharing.',
      'account.quickshare.copied': 'Copied',
      'account.quickshare.copy_failed': 'Copy failed',

      'account.activity.kicker': 'Your activity',
      'account.activity.title': 'Sync & submissions',
      'account.activity.refresh': 'Refresh',
      'account.activity.loading': 'Loading',
      'account.activity.loading_note': 'Fetching your latest stats…',
      'account.activity.admin.fav': 'Favourites',
      'account.activity.admin.fav_note': 'Total saved across all users',
      'account.activity.admin.scout': 'Street Scout',
      'account.activity.admin.scout_note': 'New leads to review',
      'account.activity.admin.props': 'Property inbox',
      'account.activity.admin.props_note': 'New owner submissions',
      'account.activity.admin.vehicles': 'Vehicle inbox',
      'account.activity.admin.vehicles_note': 'New vehicle submissions',
      'account.activity.saved': 'Saved',
      'account.activity.saved_note': 'Synced favourites · {local} on this device',
      'account.activity.articles': 'Articles',
      'account.activity.articles_note': 'Saved blog posts',
      'account.activity.alerts': 'Alerts',
      'account.activity.alerts_note': 'New listing matches from your saved requirements',
      'account.activity.scout': 'Street Scout',
      'account.activity.scout_note': 'Board leads submitted',
      'account.activity.props': 'Sell / Submit',
      'account.activity.props_note': 'Property submissions',
      'account.activity.vehicles': 'Vehicles',
      'account.activity.vehicles_note': 'Vehicle submissions',

      'account.alerts.kicker': 'Property alerts',
      'account.alerts.title': 'Saved requirements & new matches',
      'account.alerts.refresh': 'Refresh',
      'account.alerts.mark_seen': 'Mark all seen',
      'account.alerts.auth': 'Sign in to load your alerts.',
      'account.alerts.loading': 'Loading alerts…',
      'account.alerts.summary': '{alerts} alerts · {new} new matches',
      'account.alerts.empty': 'No alerts yet. Save your requirements from Properties or New Builds.',
      'account.alerts.no_matches': 'No matches yet for this alert.',
      'account.alerts.new_badge': '{count} new',
      'account.alerts.total_badge': '{count} total',
      'account.alerts.paused': 'Paused',
      'account.alerts.pause': 'Pause',
      'account.alerts.resume': 'Resume',
      'account.alerts.delete': 'Delete',
      'account.alerts.marking': 'Marking as seen…',
      'account.alerts.mark_failed': 'Could not mark alerts as seen.',
      'account.alerts.mark_done': 'All alerts marked as seen.',
      'account.alerts.updating': 'Updating alert…',
      'account.alerts.update_failed': 'Could not update alert.',
      'account.alerts.updated': 'Alert updated.',
      'account.alerts.delete_confirm': 'Delete this alert?',
      'account.alerts.deleting': 'Deleting alert…',
      'account.alerts.delete_failed': 'Could not delete alert.',
      'account.alerts.deleted': 'Alert deleted.',
      'account.alerts.setup_required': 'Alerts table missing. Run the updated supabase.sql.',
      'account.alerts.load_failed': 'Could not load alerts right now.',
      'account.alerts.perimeter_on': 'Perimeter area',

      'account.shop.kicker': 'Smart Devices',
      'account.shop.title': 'Basket & Purchases',
      'account.shop.open_shop': 'Open shop',
      'account.shop.refresh': 'Refresh',
      'account.shop.basket_title': 'Your basket',
      'account.shop.basket_hint': 'Add devices from the shop and request installation help.',
      'account.shop.basket_empty': 'Basket is empty. Open the shop to add devices.',
      'account.shop.checkout': 'Request checkout',
      'account.shop.checkout_empty': 'Basket is empty.',
      'account.shop.checkout_sending': 'Sending request…',
      'account.shop.checkout_failed': 'Checkout failed',
      'account.shop.checkout_sent': 'Request sent. We will contact you to confirm payment and installation.',
      'account.shop.clear_basket': 'Clear basket',
      'account.shop.cleared': 'Basket cleared.',
      'account.shop.remove': 'Remove',
      'account.shop.open': 'Open',
      'account.shop.price_on_request': 'Price on request',
      'account.shop.history_title': 'Purchase history',
      'account.shop.history_hint': 'After payment/approval, installation instructions will appear here.',
      'account.shop.history_empty': 'No purchases yet. Your requests and purchases will show here.',
      'account.shop.history_auth': 'Sign in to see your purchase history.',
      'account.shop.order': 'Order',
      'account.shop.placed': 'Placed',
      'account.shop.order_no_items': 'No items recorded.',
      'account.shop.docs': 'Docs',
      'account.shop.docs_title': 'Installation instructions',
      'account.shop.docs_note': 'This content is available after purchase/approval.',
      'account.shop.docs_pending': 'Docs will appear here after payment/approval.',
      'account.shop.docs_empty': 'No instructions added yet.',
      'account.shop.docs_links': 'Links',
      'account.shop.status.requested': 'Requested',
      'account.shop.status.paid': 'Paid',
      'account.shop.status.fulfilled': 'Fulfilled',
      'account.shop.status.installed': 'Installed',
      'account.shop.status.cancelled': 'Cancelled',

      'services.hero.title': 'Services That Remove Friction',
      'services.hero.subtitle': 'Buyers and sellers do not need more listings, they need a reliable process. We provide clear next steps, local coordination, and the paperwork support that makes deals actually happen.',
      'services.property.title': '🏡 Property Services',
      'services.property.subtitle': 'Most people do not need “more listings”. They need fewer options, better comparisons, and a clear sequence of next steps. We support both resale properties and new build developments. Pick the service that matches your stage and we will keep it structured.',
      'services.property.buy_sell.title': 'Buy & Sell',
      'services.property.buy_sell.desc': 'Shortlists, viewings, negotiation support, and smooth handover.',
      'services.property.new_builds.title': 'New Builds',
      'services.property.new_builds.desc': 'Developments and off-plan options, from selection to snagging and handover.',
      'services.property.rent.title': 'Rent',
      'services.property.rent.desc': 'Find rentals, validate terms, and keep expectations clear.',
      'services.property.viewing_trips.title': 'Viewing Trips',
      'services.property.viewing_trips.desc': '2-7 day packages: shortlist first, then transfers, accommodation, car rental, and viewings.',
      'services.property.management.title': 'Management',
      'services.property.management.desc': 'Owners stay calm. We coordinate keys, check-ins, and upkeep.',
      'services.property.maintenance.title': 'Maintenance',
      'services.property.maintenance.desc': 'Trusted trades, fast response, and transparent updates.',
      'services.business.title': '🏪 Business Services',
      'services.business.subtitle': 'Business transfers in Spain are won or lost on clarity: what is included, what transfers, and what happens after you agree. We keep the process moving, coordinate specialists when required, and work with architects on licences and permits so you can operate legally.',
      'services.business.buy_sell.title': 'Buy & Sell',
      'services.business.buy_sell.desc': 'Opportunity screening and practical guidance on next steps.',
      'services.business.management.title': 'Management',
      'services.business.management.desc': 'Handovers, supplier transitions, and practical support after purchase.',
      'services.business.legal.title': 'Legal Advice',
      'services.business.legal.desc': 'In-house basic legal support + coordination with specialists when needed.',
      'services.business.contracts.title': 'Contracts',
      'services.business.contracts.desc': 'Clarity on leases, handovers, and operational obligations.',
      'services.business.documentation.title': 'Documentation',
      'services.business.documentation.desc': 'Changes of documentation and smooth transfer coordination.',
      'services.business.licenses.title': 'Licences & permits',
      'services.business.licenses.desc': 'Architect coordination for apertura/activity licences and the steps to operate legally.',
      'services.smart.title': '🔒 Smart Devices (IoT / Domotica)',
      'services.smart.subtitle': 'We help owners and operators select, install, and manage smart devices that actually improve day-to-day operations: smart locks and access codes, sensors, cameras, automation, and reliable connectivity. We are comfortable across software and hardware, so the setup is practical, secure, and maintainable.',
      'services.smart.guide.title': 'Smart Devices Guide',
      'services.smart.guide.desc': 'Use cases, device choices, and how we plan and install reliably.',
      'services.smart.shop.title': 'Shop (Devices)',
      'services.smart.shop.desc': 'Browse our WooCommerce products inside the app and open the official shop page to buy.',
      'services.smart.consult.title': 'Consult & Plan',
      'services.smart.consult.desc': 'Define the goal (access, energy, security), device list, and a realistic rollout plan.',
      'services.smart.install.title': 'Install',
      'services.smart.install.desc': 'Smart locks, sensors, and network basics with clean handover and documentation.',
      'services.smart.manage.title': 'Manage',
      'services.smart.manage.desc': 'Ongoing changes, troubleshooting, and operational support for rentals and businesses.',
      'services.vehicles.title': '🚗 Vehicles (Cars & Boats)',
      'services.vehicles.subtitle': 'Whether you are buying, renting, or managing a vehicle, the goal is the same: clear pricing, smooth handovers, and a process that does not waste your time.',
      'services.vehicles.buy_sell.title': 'Buy & Sell',
      'services.vehicles.buy_sell.desc': 'Find suitable options and manage the steps end-to-end.',
      'services.vehicles.rent.title': 'Rent',
      'services.vehicles.rent.desc': 'Clear pricing and expectations, easy customer handover.',
      'services.vehicles.management.title': 'Management',
      'services.vehicles.management.desc': 'Support for bookings, handovers, and practical admin.',
      'services.ready.title': 'Ready to Start?',
      'services.ready.subtitle': 'Tell us what you are looking for and your budget, and we will come back with a short list and clear next steps within 24 hours.',

      'services.collab.title': 'Work With Us',
      'services.collab.subtitle': 'Two collaboration paths: verified partners (agencies, developers, providers) and Street Scouts who discover “For Sale” boards.',
      'services.collab.partners.title': 'Verified Collaborators',
      'services.collab.partners.desc': 'Agencies, developers, and providers. XML import and professional presentation inside the app.',
      'services.collab.scout.title': 'Street Scout (Earn €200–€500)',
      'services.collab.scout.desc': 'Snap a For Sale board + location. We onboard the listing. You get rewarded when it sells.',

      'page.scout.hero.title': 'Street Scout (Earn €200–€500)',
      'page.scout.hero.subtitle': 'Walking around and saw a “For Sale” sign? Snap a photo, capture the location, and send it to us. If we onboard the property and it sells, you get rewarded.',
      'page.scout.tag.photo': 'Photo',
      'page.scout.tag.location': 'Location',
      'page.scout.tag.tracking': 'Tracking',
      'page.scout.tag.payout': 'Payout',
      'page.scout.cta.submit': 'Submit a board',
      'page.scout.cta.account': 'Sign in / Create account',
      'page.scout.how.title': 'How It Works',
      'page.scout.how.1.title': '1) Take a photo',
      'page.scout.how.1.p': 'Capture the “For Sale” board clearly (phone number visible).',
      'page.scout.how.2.title': '2) Send location',
      'page.scout.how.2.p': 'We attach GPS so we know the exact street and can react fast.',
      'page.scout.how.3.title': '3) We call and onboard',
      'page.scout.how.3.p': 'We contact the owner/agency, verify details, and add it to our portfolio.',
      'page.scout.how.4.title': '4) You get rewarded',
      'page.scout.how.4.p': 'When the deal closes, you receive a minimum €200 or €500 depending on the property tier.',
      'page.scout.disclaimer': 'Note: payouts are subject to verification (duplicate submissions, fake boards, wrong location, or non-onboarded listings are not eligible).',
      'page.scout.submit.title': 'Submit a For Sale Board',
      'page.scout.auth.title': 'Sign in first',
      'page.scout.auth.p': 'To submit boards and track your rewards, sign in (or create a free account).',
      'page.scout.auth.cta': 'Open Account',
      'page.scout.join.title': 'Become a collaborator',
      'page.scout.join.p': 'Enable Street Scout mode to submit boards. It takes one click.',
      'page.scout.join.cta': 'Enable Street Scout',
      'page.scout.join.learn_more': 'Learn about collaborations',
      'page.scout.form.title': 'New submission',
      'page.scout.form.subtitle': 'Photo + location. Optional phone and notes help us move faster.',
      'page.scout.form.admin_link': 'Admin inbox',
      'page.scout.form.photo': 'Board photo',
      'page.scout.form.location': 'Location',
      'page.scout.form.get_location': 'Get location',
      'page.scout.form.phone': 'Phone (optional)',
      'page.scout.form.phone_ph': '+34 …',
      'page.scout.form.tier': 'Property tier (sets minimum reward)',
      'page.scout.form.tier.standard': 'Standard (min €200)',
      'page.scout.form.tier.premium': 'Premium / Commercial (min €500)',
      'page.scout.form.notes': 'Notes (optional)',
      'page.scout.form.notes_ph': 'Street name, best time to call, anything useful…',
      'page.scout.form.confirm': 'I took this photo myself and the location is correct.',
      'page.scout.form.submit': 'Send to Spanish Coast Properties',
      'page.scout.form.processing': 'Processing photo…',
      'page.scout.form.sending': 'Sending…',
      'page.scout.form.sent': 'Sent. Thank you. We will review and contact the owner/agency.',
      'page.scout.form.failed': 'Failed',
      'page.scout.mine.title': 'My submissions',
      'page.scout.mine.subtitle': 'Track status and rewards.',
      'page.scout.mine.refresh': 'Refresh',
      'page.scout.mine.th.time': 'Time',
      'page.scout.mine.th.status': 'Status',
      'page.scout.mine.th.reward': 'Reward',
      'page.scout.mine.th.location': 'Location',
      'page.scout.mine.loading': 'Loading…',
      'page.scout.mine.failed': 'Failed to load',
      'page.scout.mine.loaded': 'Loaded {count} submissions.',
      'page.scout.mine.sold': 'Sold',
      'page.scout.mine.paid': 'Paid',
      'page.scout.location.none': 'No location yet.',
      'page.scout.location.open_maps': 'Open',
      'page.scout.location.working': 'Getting location…',
      'page.scout.location.ok': 'Location captured.',
      'page.scout.location.failed': 'Failed to get location',
      'page.scout.errors.no_supabase': 'Supabase is not configured.',
      'page.scout.errors.session': 'Auth session failed',
      'page.scout.errors.signin_first': 'Please sign in first.',
      'page.scout.errors.enable_first': 'Enable Street Scout first.',
      'page.scout.errors.photo_required': 'Please add a photo.',
      'page.scout.errors.location_required': 'Please get your location (GPS) to submit.',
      'page.scout.errors.confirm_required': 'Please confirm the checkbox.',
      'page.scout.errors.photo_invalid': 'Invalid photo',
      'page.scout.join.working': 'Enabling Street Scout…',
      'page.scout.join.done': 'Street Scout enabled. You can submit now.',
      'page.scout.join.failed': 'Failed to enable',
      'page.scout.footer.p': 'Street Scout: grow the portfolio, reward locals who help us discover listings.',

      'catalog.details': 'Details',
      'catalog.count.results': '{count} results',
      'catalog.count.listings': '{count} listings',
      'catalog.businesses.none_title': 'No businesses found',
      'catalog.businesses.none_meta': 'Try switching the filter to All.',
      'catalog.businesses.none_body': 'If you tell us your budget and preferred sector, we will shortlist the best opportunities.',
      'catalog.vehicles.soon_title': 'Vehicles coming soon',
      'catalog.vehicles.soon_meta': 'Cars and boats for sale or rent.',
      'catalog.vehicles.soon_body': 'Tell us what you need and we will source options and manage the process.',

      'page.new_builds_guide.hero.title': 'New Build Properties (Off-plan & Key Ready)',
      'page.new_builds_guide.hero.p1': 'New builds are about clarity: which developments are real options, what the payment schedule looks like, what is included, and how you move from reservation to keys without surprises.',
      'page.new_builds_guide.hero.p2': 'We shortlist the best developments for your criteria, organise viewings, and coordinate the moving parts around the purchase so you can decide fast and proceed safely.',
      'page.new_builds_guide.cta.browse': 'Browse new builds',
      'page.new_builds_guide.section.what_you_get': 'What You Get',
      'page.new_builds_guide.section.what_you_get.p': 'The goal is to reduce the noise and keep the decision focused on facts: build quality, location reality, delivery timing, and the total cost of ownership.',
      'page.new_builds_guide.card.shortlist.title': 'Shortlist (developments)',
      'page.new_builds_guide.card.shortlist.p': 'Filter by budget, delivery date, towns, and non-negotiables. We focus only on realistic options.',
      'page.new_builds_guide.card.payment.title': 'Payment plan clarity',
      'page.new_builds_guide.card.payment.p': 'Reservation, stage payments, completion date, and a clean view of fees and expected extras.',
      'page.new_builds_guide.card.viewings.title': 'Viewings that matter',
      'page.new_builds_guide.card.viewings.p': 'Show homes, surrounding streets, orientation, parking, noise, and comparisons across developments.',
      'page.new_builds_guide.card.snagging.title': 'Snagging & handover',
      'page.new_builds_guide.card.snagging.p': 'Punch-list checks at delivery, practical coordination, and a smoother path to getting the keys.',
      'page.new_builds_guide.section.process': 'How The Process Works',
      'page.new_builds_guide.section.process.p': 'New builds are often faster than resale once you have the right development, but they have extra “hidden” steps. We make the sequence explicit so nothing gets missed.',
      'page.new_builds_guide.process.1.title': '1) Requirements',
      'page.new_builds_guide.process.1.p': 'Budget, towns, delivery timing, and must-haves (terrace, pool, walk-to-beach, parking).',
      'page.new_builds_guide.process.2.title': '2) Shortlist + comparisons',
      'page.new_builds_guide.process.2.p': 'We compare developments side-by-side: location, build spec, and what is included.',
      'page.new_builds_guide.process.3.title': '3) Viewings',
      'page.new_builds_guide.process.3.p': 'We plan viewings so you can compare properly and avoid “sales-tour fatigue”.',
      'page.new_builds_guide.process.4.title': '4) Reservation',
      'page.new_builds_guide.process.4.p': 'Support on next steps and coordination with the right licensed professionals when required.',
      'page.new_builds_guide.process.5.title': '5) Build timeline',
      'page.new_builds_guide.process.5.p': 'Milestones, handover expectations, and any practical planning you need around completion.',
      'page.new_builds_guide.process.6.title': '6) Snagging & keys',
      'page.new_builds_guide.process.6.p': 'Final checks, punch list, and a clean handover so you can start using the property.',
      'page.new_builds_guide.process.note': 'Note: we are not a law firm. Where formal legal representation is required, we coordinate with licensed professionals.',
      'page.new_builds_guide.section.what_to_send': 'What To Send (To Get A Fast Shortlist)',
      'page.new_builds_guide.section.what_to_send.p': 'Send the basics and we can move quickly with a development shortlist that matches real availability.',
      'page.new_builds_guide.tag.budget': 'Budget (max)',
      'page.new_builds_guide.tag.towns': 'Towns / areas',
      'page.new_builds_guide.tag.delivery': 'Delivery date',
      'page.new_builds_guide.tag.beds': 'Beds (min)',
      'page.new_builds_guide.tag.walk_beach': 'Walk to beach?',
      'page.new_builds_guide.tag.pool_parking': 'Pool / parking',
      'page.new_builds_guide.tag.finance': 'Cash / mortgage',
      'page.new_builds_guide.section.faq': 'FAQ',
      'page.new_builds_guide.faq.1.q': 'Can you start remotely?',
      'page.new_builds_guide.faq.1.a': 'Yes. We can shortlist first, then structure viewings when you are ready to travel.',
      'page.new_builds_guide.faq.2.q': 'Do you help with furniture and setup?',
      'page.new_builds_guide.faq.2.a': 'We can advise and coordinate practical steps after purchase (handover, setup, and day-one basics).',
      'page.new_builds_guide.faq.3.q': 'What is the first step?',
      'page.new_builds_guide.faq.3.a': 'Send your budget, towns, and must-haves. We reply with a shortlist and the next step.',

      'page.viewing_trip.hero.title': 'Property Viewing Trip Package',
      'page.viewing_trip.hero.p': 'Most buyers we help are abroad. A short trip is the fastest way to make a confident decision, but only if the trip is structured. We build a plan that combines shortlisting, travel logistics, and viewings.',
      'page.viewing_trip.tag.days': '2-7 days',
      'page.viewing_trip.tag.transfer': 'Airport transfer',
      'page.viewing_trip.tag.accommodation': 'Accommodation',
      'page.viewing_trip.tag.car_rental': 'Car rental',
      'page.viewing_trip.tag.schedule': 'Viewing schedule',
      'page.viewing_trip.cta.start_email': 'Start by email',
      'page.viewing_trip.cta.browse_listings': 'Browse listings',
      'page.viewing_trip.cta.browse_new_builds': 'Browse new builds',
      'page.viewing_trip.section.how': 'How It Works',
      'page.viewing_trip.how.1.title': '1. Requirements call',
      'page.viewing_trip.how.1.p': 'We confirm location, budget, must-haves, timing, and what you can realistically view per day.',
      'page.viewing_trip.how.2.title': '2. Shortlist before you fly',
      'page.viewing_trip.how.2.p': 'We curate a small list worth visiting, then validate basics so you do not waste the trip.',
      'page.viewing_trip.how.3.title': '3. Trip logistics',
      'page.viewing_trip.how.3.p': 'We coordinate airport transfer, a place to stay, and a car option that fits your schedule.',
      'page.viewing_trip.how.4.title': '4. Viewings + next steps',
      'page.viewing_trip.how.4.p': 'We run a tight viewing plan and guide you on offers, reservations, and the purchase process.',
      'page.viewing_trip.section.included': 'What’s Included',
      'page.viewing_trip.included.1.title': '✈️ Flights options',
      'page.viewing_trip.included.1.p': 'We suggest realistic routes and times. You book directly, we align the schedule.',
      'page.viewing_trip.included.2.title': '🚐 Airport transfer',
      'page.viewing_trip.included.2.p': 'Pickup and dropoff so you arrive relaxed and on time for viewings.',
      'page.viewing_trip.included.3.title': '🏠 Accommodation',
      'page.viewing_trip.included.3.p': 'Short stays from trusted local partners and homes we help manage (when available).',
      'page.viewing_trip.included.4.title': '🚗 Car rental',
      'page.viewing_trip.included.4.p': 'We coordinate a car that matches your area and agenda. After purchase, we can also help with a car sale.',
      'page.viewing_trip.included.note': 'The goal is simple: fewer surprises, less time wasted, and a clear path from “maybe” to “decision”.',
      'page.viewing_trip.section.offer_stay': 'Want To Offer A Stay To Buyers?',
      'page.viewing_trip.offer_stay.p': 'If you own a property in Costa Blanca South and want it rented as a short stay for viewing trips, contact us. We can manage handovers and keep standards high so everyone wins.',

      'page.businesses.hero.title': 'Businesses for Sale',
      'page.businesses.hero.p1': 'Explore business opportunities across Costa Blanca South. We support your transaction with contracts, documentation changes, and licences/permits coordination (in collaboration with architects) so you can operate legally.',
      'page.businesses.hero.p2': 'Perfect for entrepreneurs relocating to Spain, investors looking for proven cash-flow, or owners who want a clean exit. We focus on clarity: what is included, what transfers, and what the next step is.',
      'page.businesses.filters.deal': 'Deal',
      'page.businesses.filters.deal_value': 'Business for sale / Traspaso',
      'page.businesses.filters.business_type': 'Business Type',
      'page.businesses.map_toggle': 'Map',
      'page.businesses.map.title': 'Businesses on the map',
      'page.businesses.how_help.title': 'How We Help',
      'page.businesses.how_help.p': 'Want a shortlist? Email your budget, preferred area, and sector.',
      'page.businesses.cta.sell_business': 'I want to sell my business',
      'page.businesses.collab.title': 'Work With Us (Verified Collaborators)',
      'page.businesses.collab.p': 'Are you an agent, broker, lawyer, or local operator who wants to collaborate? We onboard verified partners and can import your XML feed so your listings look consistent and professional inside our app.',
      'page.businesses.collab.cta.options': 'Collaboration options',
      'page.businesses.collab.cta.email': 'Email us',

      'account.hero.title': 'Your Account',
      'account.hero.subtitle': 'Sign in to sync favourites across devices and unlock partner tools.',

      'nearby.title': 'Area snapshot',
      'nearby.loading_short': 'Loading…',
      'nearby.loading': 'Loading nearby amenities…',
      'nearby.note': 'Distances are approximate (straight-line). Data: OpenStreetMap contributors.',
      'nearby.approx': 'approx.',
      'nearby.unavailable': 'Nearby info may be limited for this listing.',
      'nearby.min_walk': '{mins} min walk',
      'nearby.min_drive': '{mins} min drive',

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
      'lang.ro': 'Rumano',
      'lang.sv': 'Sueco',
      'lang.en_short': 'EN',
      'lang.es_short': 'ES',
      'lang.ro_short': 'RO',
      'lang.sv_short': 'SV',

      'common.in': 'en',
      'common.all': 'Todos',

      'nav.home': 'Inicio',
      'nav.properties': 'Propiedades',
      'nav.new_builds': 'Obra Nueva',
      'nav.businesses': 'Negocios',
      'nav.vehicles': 'Vehículos',
      'nav.services': 'Servicios',
      'nav.blog': 'Blog',
      'nav.account': 'Cuenta',
      'nav.contact_us': 'Contacto',
      'nav.email': 'Correo',
      'nav.call': 'Llamar',

      'blog.hero.title': 'Blog y Actualizaciones',
      'blog.hero.subtitle': 'Actualizaciones cortas y útiles generadas a partir de titulares públicos y Google Trends, con conclusiones prácticas para Costa Blanca Sur.',
      'blog.hero.disclaimer': 'No copiamos artículos completos. Cada publicación es un resumen/comentario original e incluye enlaces a fuentes para que puedas verificar los detalles.',
      'blog.tag.updated_daily': 'Actualizado a diario',
      'blog.tag.news': 'Noticias',
      'blog.tag.trends': 'Tendencias',
      'blog.filters.search': 'Buscar',
      'blog.filters.search_placeholder': 'Buscar temas…',
      'blog.filters.type': 'Tipo',
      'blog.filters.language': 'Idioma',
      'blog.lang.auto': 'Mi idioma',
      'blog.lang.all': 'Todos los idiomas',
      'blog.kind.news': 'Noticias',
      'blog.kind.trend': 'Tendencias',
      'blog.actions.reload': 'Recargar',
      'blog.actions.copy_link': 'Copiar enlace',
      'blog.actions.copied': 'Copiado',
      'blog.actions.save': 'Guardar',
      'blog.actions.saved': 'Guardado',
      'blog.actions.saved_filter': 'Guardados',
      'blog.count.posts': 'publicaciones',
      'blog.empty.title': 'Aún no hay publicaciones',
      'blog.empty.subtitle': 'Esta sección se actualiza a diario. Si la acabas de activar, las primeras publicaciones aparecerán después de la próxima sincronización.',
      'blog.saved_empty.title': 'Aún no tienes guardados',
      'blog.saved_empty.subtitle': 'Pulsa Guardar en cualquier artículo para verlo aquí.',
      'blog.updated.label': 'Última actualización',
      'blog.post.untitled': 'Sin título',
      'blog.post.sources': 'Fuentes',
      'blog.card.open_hint': 'Toca la tarjeta para abrir el articulo',
      'blog.footer.p': 'Actualizaciones diarias para Costa Blanca Sur: propiedades, negocios, vehículos y consejos prácticos.',
      'blog.footer.explore': 'Explorar',
      'blog.footer.contact': 'Contacto',

      'shop.actions.add_to_basket': 'Añadir a la cesta',
      'shop.basket.added': 'Añadido a la cesta',
      'shop.basket.added_short': 'Añadido',

      'home.hero.title': 'Ofertas de propiedades, negocios y vehículos, gestionadas como un concierge.',
      'home.hero.subtitle': 'Compra, vende, alquila, gestiona y mantén. Un solo equipo de confianza para viviendas de reventa, obra nueva, locales comerciales, negocios en venta y vehículos.',
      'home.hero.browse_properties': 'Ver propiedades',
      'home.hero.new_builds': 'Obra Nueva',
      'home.hero.businesses_for_sale': 'Negocios en venta',
      'home.hero.vehicles': 'Vehículos',
      'home.hero.viewing_trip': 'Paquete de viaje de visitas',

      'home.cards.properties.title': 'Propiedades',
      'home.cards.properties.desc': 'Viviendas de reventa y obra nueva, ademas de anuncios comerciales, con precision local en el mapa.',
      'home.cards.businesses.title': 'Negocios',
      'home.cards.businesses.desc': 'Compra y venta de negocios, con gestion y soporte documental.',
      'home.cards.vehicles.title': 'Vehiculos',
      'home.cards.vehicles.desc': 'Coches y barcos, en venta o alquiler, con soporte practico de principio a fin.',
      'home.footer.title': '¿Necesitas ayuda para elegir?',
      'home.footer.subtitle': 'Dinos lo que quieres (reventa u obra nueva) y te haremos una seleccion de las mejores opciones, rapido.',
      'home.footer.viewing_trip': 'Planificar viaje de visitas',

      'filters.more': 'Más',
      'filters.less': 'Menos',
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

      'ui.menu': 'Menú',
      'ui.map': 'Mapa',
      'ui.list': 'Lista',
      'ui.open_filters': 'Abrir filtros',
      'ui.toggle_map': 'Alternar mapa',
      'ui.clear_all_filters': 'Borrar filtros',
      'ui.apply_filters': 'Aplicar filtros',
      'ui.close_filters': 'Cerrar filtros',
      'ui.previous_image': 'Imagen anterior',
      'ui.next_image': 'Siguiente imagen',

      'map.tools.aria': 'Herramientas de busqueda en el mapa',
      'map.tools.draw': 'Dibujar area',
      'map.tools.around': 'Cerca de mi',
      'map.tools.clear': 'Borrar',
      'map.tools.radius': 'Radio',
      'map.tools.status_none': 'Consejo: dibuja un area en el mapa o busca cerca de ti.',
      'map.tools.status_drawing': 'Dibujando perimetro: toca para anadir puntos, doble toque para terminar.',
      'map.tools.status_polygon': 'Filtro de perimetro activado. Solo se muestran anuncios dentro del area.',
      'map.tools.status_around': 'Filtro \"cerca de mi\" activado ({km} km).',
      'map.tools.draw_unavailable': 'La herramienta de perimetro no esta disponible ahora.',
      'map.tools.geo_unavailable': 'La geolocalizacion no esta disponible en este dispositivo.',
      'map.tools.geo_getting': 'Obteniendo tu ubicacion…',
      'map.tools.geo_failed': 'La solicitud de ubicacion fallo. Intentalo de nuevo.',
      'map.tools.geo_denied': 'Permiso de ubicacion denegado.',
      'map.tools.geo_timeout': 'La ubicacion tardo demasiado. Intentalo de nuevo.',

      'properties.results.found_prefix': 'Encontradas',
      'properties.results.found_suffix': 'propiedades en Costa Blanca Sur',
      'properties.results.subtitle': 'Filtra viviendas de reventa y obra nueva y cambia a vista de mapa para ver solo los resultados exactos.',
      'properties.sort.label': 'Ordenar',
      'properties.sort.featured': 'Destacadas',
      'properties.sort.date_desc': 'Fecha (mas nuevas)',
      'properties.sort.date_asc': 'Fecha (mas antiguas)',
      'properties.sort.price_asc': 'Precio (de menor a mayor)',
      'properties.sort.price_desc': 'Precio (de mayor a menor)',
      'properties.sort.beds_desc': 'Dorms (de mas a menos)',
      'properties.sort.area_desc': 'Superficie (de mayor a menor)',
      'properties.sort.eur_sqm_asc': '€/m2 (de menor a mayor)',
      'properties.sort.beach_asc': 'Distancia a playa (cerca a lejos)',
      'properties.saved': 'Guardadas',
      'properties.showing': 'Mostrando',
      'properties.send_saved': 'Crear catalogo',
      'properties.save_alert': 'Guardar alerta',
      'properties.save_alert_hint': 'Guarda estos requisitos y te avisaremos cuando entren nuevas coincidencias.',
      'properties.save_alert_signin_hint': 'Inicia sesion para guardar requisitos y recibir alertas de nuevas coincidencias.',
      'properties.save_alert_signin': 'Inicia sesion para guardar alertas',
      'properties.save_alert_saving': 'Guardando…',
      'properties.save_alert_saved': 'Alerta guardada',
      'properties.save_alert_setup': 'Ejecuta la actualizacion SQL de Supabase',
      'properties.save_alert_error': 'No se pudo guardar la alerta',
      'properties.cta.sell_property': 'Vender tu propiedad',
      'properties.cta.new_builds': 'Obra Nueva',
      'properties.cta.viewing_trip': 'Planificar viaje de visitas (2-7 dias)',

      'newbuilds.results.found_prefix': 'Encontradas',
      'newbuilds.results.found_suffix': 'propiedades de obra nueva en Costa Blanca Sur',
      'newbuilds.results.subtitle': 'Filtra propiedades de obra nueva y cambia a vista de mapa para ver solo los resultados exactos.',
      'newbuilds.cta.how_it_works': 'Como funciona la obra nueva',
      'newbuilds.cta.all_properties': 'Todas las propiedades',

      'city.all': 'Todas las zonas',
      'alerts.scope.resales': 'Propiedades',
      'alerts.scope.new_builds': 'Obra Nueva',
      'alerts.scope.all': 'Todos los anuncios',
      'alerts.default_name': 'Alerta guardada',

      'listing.for_rent': 'En alquiler',
      'listing.for_sale': 'En venta',
      'listing.traspaso': 'Traspaso',
      'listing.business_for_sale': 'Negocio en venta',
      'listing.business': 'Negocio',
      'listing.vehicle': 'Vehiculo',
      'listing.save_aria': 'Guardar anuncio',
      'listing.reference_unavailable': 'Referencia no disponible',
      'listing.original_ref_show': 'Ver referencia original',
      'listing.original_ref_copy': 'Copiar',
      'listing.original_ref_no_ref': 'Sin ref',
      'listing.item': 'Anuncio',
      'listing.load_more': 'Cargar mas ({shown} / {total})',
      'listing.play_reel': 'Ver reel',

      'modal.ref_unavailable': 'Ref no disponible',
      'modal.type_default': 'Propiedad',
      'modal.town_unknown': 'Zona desconocida',
      'modal.description_placeholder': 'Detalles de la propiedad proximamente.',
      'modal.original_ref': 'Ref original',
      'modal.original_ref_short': 'Orig',
      'modal.copy_original_ref': 'Copiar referencia original',
      'modal.original_id': 'ID de feed',
      'modal.original_id_short': 'ID',
      'modal.copy_original_id': 'Copiar ID de feed',
      'modal.copied': 'Copiado',
      'modal.location_title': 'Ubicacion',
      'modal.open_google_maps': 'Abrir en Google Maps',
      'modal.map_unavailable': 'Mapa no disponible',
      'modal.map_unavailable_listing': 'Mapa no disponible para este anuncio.',
      'modal.quick_view_note': 'Vista rapida de la zona. Acerca para explorar playas, golf y servicios cercanos.',
      'modal.amenities_title': 'Comodidades premium',
      'modal.amenities_fallback_1': 'Acabados premium en toda la vivienda',
      'modal.amenities_fallback_2': 'Climatizacion avanzada',
      'modal.fav_save': '♡ Guardar',
      'modal.fav_saved': '♥ Guardada',
      'modal.brochure_pdf': 'Folleto (PDF)',
      'modal.reel_play': 'Ver Reel',
      'modal.reel_video': 'Estudio Reel',
      'modal.reel_tiktok': 'Video TikTok',
      'modal.call_now': 'Llamar',
      'modal.request_visit': 'Solicitar visita',
      'modal.official_page': 'Pagina oficial',
      'modal.share': 'Compartir',
      'modal.share.native': 'Compartir',
      'modal.share.copy_link': 'Copiar enlace',
      'modal.share.copy_caption': 'Copiar texto',
      'modal.share.x_twitter': 'X (Twitter)',
      'modal.share.report_issue': 'Reportar problema',
      'modal.share.copy_prompt': 'Copiar enlace:',
      'modal.share.copied_open_app': 'Copiado. Abre {app}',
      'modal.spec.beds': 'Dorms',
      'modal.spec.baths': 'Baños',
      'modal.spec.area': 'Superficie',

      'properties.fav.save_title': 'Guardar anuncio',
      'properties.fav.remove_title': 'Quitar de guardadas',

      'catalog.builder.title': 'Crear catalogo para cliente',
      'catalog.builder.subtitle': 'Usa tu busqueda filtrada o guardadas para generar un enlace de catalogo para compartir.',
      'catalog.builder.source': 'Origen',
      'catalog.builder.source_filtered': 'Resultados actuales',
      'catalog.builder.source_saved': 'Guardadas',
      'catalog.builder.limit': 'Anuncios a incluir',
      'catalog.builder.client_name': 'Nombre del cliente (opcional)',
      'catalog.builder.client_name_placeholder': 'Nombre del cliente',
      'catalog.builder.whitelabel': 'Marca blanca',
      'catalog.builder.open': 'Abrir catalogo',
      'catalog.builder.copy': 'Copiar enlace',
      'catalog.builder.status_none': 'No hay anuncios disponibles para esta seleccion. Cambia origen o filtros.',
      'catalog.builder.status_ready': 'Listo: {selected} anuncios.',
      'catalog.builder.status_ready_limited': 'Listo: {selected} de {total} anuncios (limite {limit}).',
      'catalog.builder.copied': 'Enlace del catalogo copiado',
      'catalog.builder.copy_failed': 'Error al copiar',
      'catalog.builder.opened': 'Catalogo abierto en una nueva pestaña',

      'catalog.page.title': 'Catalogo de cliente',
      'catalog.page.subtitle': 'Una seleccion limpia generada desde tu busqueda.',
      'catalog.page.subtitle_wl': 'Modo marca blanca activado. La marca queda oculta.',
      'catalog.page.back': 'Volver a buscar',
      'catalog.page.copy': 'Copiar enlace',
      'catalog.page.print': 'Imprimir / Guardar PDF',
      'catalog.page.whitelabel': 'Marca blanca',
      'catalog.page.for_client': 'Para',
      'catalog.page.listings': 'anuncios',
      'catalog.page.not_found': 'no encontrados',
      'catalog.page.empty_title': 'No hay anuncios seleccionados',
      'catalog.page.empty_help': 'Abre Propiedades, filtra resultados y usa Crear catalogo.',

      'brochure.print_pdf': 'Imprimir / Guardar en PDF',
      'brochure.share_whatsapp': 'Enviar por WhatsApp',
      'brochure.back': 'Volver',
      'brochure.loading': 'Cargando…',
      'brochure.tools_label': 'Herramientas del folleto',
      'brochure.white_label': 'Marca blanca',
      'brochure.on': 'Activada',
      'brochure.off': 'Desactivada',
      'brochure.copy_link': 'Copiar enlace',
      'brochure.email_link': 'Enviar enlace',
      'brochure.section.highlights': 'Destacados',
      'brochure.section.area_snapshot': 'Resumen de zona',
      'brochure.section.description': 'Descripcion',
      'brochure.section.features': 'Caracteristicas',
      'brochure.section.gallery': 'Galeria',
      'brochure.footer.book_viewing': 'Reservar visita',
      'brochure.footer.phone': 'Telefono',
      'brochure.footer.email': 'Correo',
      'brochure.footer.reference': 'Referencia',
      'brochure.missing_ref': 'Falta referencia',
      'brochure.missing_ref_help_html': 'Abre esta pagina con <code>?ref=SCP-XXXX</code>.',
      'brochure.listing_not_found': 'Anuncio no encontrado.',
      'brochure.no_image': 'Sin imagen disponible',
      'brochure.no_gallery_images': 'No hay imagenes en la galeria.',
      'brochure.details_soon': 'Detalles proximamente.',
      'brochure.copied': 'Copiado',
      'brochure.type_default': 'Anuncio',
      'brochure.stat.beds': '{n} dorms',
      'brochure.stat.baths': '{n} baños',
      'brochure.stat.built': '{n} m2',
      'brochure.highlight.reference': 'Referencia',
      'brochure.highlight.operation': 'Operacion',
      'brochure.highlight.location': 'Ubicacion',
      'brochure.highlight.built_area': 'Superficie construida',

      'reel.back': 'Volver',
      'reel.loading': 'Cargando…',
      'reel.tools_label': 'Herramientas del video',
      'reel.white_label': 'Marca blanca',
      'reel.on': 'Activada',
      'reel.off': 'Desactivada',
      'reel.create_video': 'Crear video',
      'reel.share': 'Compartir',
      'reel.download': 'Descargar',
      'reel.download_captions': 'Descargar subtitulos',
      'reel.copy_caption': 'Copiar texto',
      'reel.preview.title': 'Vista previa',
      'reel.preview.subtitle': 'Creando un video corto con logo y detalles clave.',
      'reel.preview.subtitle_dynamic': 'Creando un video social de {duration} con {audio} y {captions}.',
      'reel.caption.label': 'Texto',
      'reel.caption.note': 'Pega en Instagram/TikTok si hace falta.',
      'reel.caption.on': 'Subtitulos activos',
      'reel.caption.off': 'Sin subtitulos',
      'reel.caption.more_info': 'Pide mas detalles',
      'reel.caption.contact': 'Escribenos por WhatsApp',
      'reel.controls.duration': 'Duracion',
      'reel.controls.audio': 'Audio',
      'reel.controls.overlay_caption': 'Mostrar subtitulos en pantalla',
      'reel.duration.quick': '7s (Rapido)',
      'reel.duration.recommended': '9s (Recomendado)',
      'reel.duration.standard': '12s',
      'reel.duration.detailed': '15s (Detallado)',
      'reel.playback.label': 'Reproduccion',
      'reel.playback.note': 'Usa este reproductor para previsualizar antes de compartir.',
      'reel.audio.none': 'Sin musica',
      'reel.audio.ambient': 'Ambiental',
      'reel.audio.upbeat': 'Ritmico',
      'reel.disclaimer': 'La exportacion del video se hace en tu navegador. Si tu dispositivo no permite compartir el archivo, usa Descargar y subelo en tu app.',
      'reel.missing_ref': 'Falta referencia',
      'reel.missing_ref_help': 'Abre esta pagina con ?ref=SCP-XXXX',
      'reel.listing_not_found': 'Anuncio no encontrado.',
      'reel.copy_prompt': 'Copiar texto:',
      'reel.status.prep': 'Preparando…',
      'reel.status.no_canvas': 'Tu navegador no soporta esta funcion.',
      'reel.status.no_images': 'No se encontraron imagenes para este anuncio.',
      'reel.status.loading_images': 'Cargando imagenes…',
      'reel.status.loaded_n': 'Cargadas {n} imagenes',
      'reel.status.images_failed': 'No se pudieron cargar las imagenes. Intentalo de nuevo.',
      'reel.status.recording': 'Grabando…',
      'reel.status.recorder_failed': 'La exportacion de video no esta soportada en este navegador.',
      'reel.status.ready': 'Video listo.',
      'reel.status.ready_with_audio': 'Video listo con audio.',
      'reel.status.shared': 'Compartido.',
      'reel.status.fallback_shared': 'Descargado. Pega el texto en {app}.',
      'reel.status.no_video': 'Primero crea el video.',
      'reel.status.loading_listing': 'Cargando anuncio…',
      'reel.status.ready_to_create': 'Listo. Pulsa “Crear video”.',
      'reel.status.caption_copied': 'Texto copiado.',
      'reel.status.preferred_app': 'Consejo: genera y luego comparte y elige {app}.',
      'pricing.on_request': 'Precio a consultar',
      'time.month': 'mes',
      'pricing.per_night': '{price} / noche',
      'pricing.per_day': '{price} / dia',
      'pricing.per_week': '{price} / semana',
      'pricing.per_month': '{price} / mes',
      'pricing.traspaso_suffix': '{price} (Traspaso)',

      'account.actions.clear_offline_cache': 'Borrar cache offline',
      'account.actions.reset_login': 'Reiniciar login',
      'account.signin.title': 'Iniciar sesion',
      'account.signin.button': 'Iniciar sesion',
      'account.signup.title': 'Crear cuenta',
      'account.signup.button': 'Crear cuenta',
      'account.signup.note': 'Usamos tu correo solo para el acceso y actualizaciones del servicio que solicites.',
      'account.magic.title': 'O entra con un enlace magico',
      'account.magic.button': 'Enviar enlace magico',
      'account.magic.note': 'Mira tu correo y haz clic en el enlace para iniciar sesion.',
      'account.reset.title': 'Restablecer contraseña',
      'account.reset.button': 'Enviar enlace de restablecimiento',
      'account.reset.note': 'Te enviaremos un enlace seguro para elegir una nueva contraseña.',
      'account.recovery.title': 'Elegir nueva contraseña',
      'account.recovery.subtitle': 'Elige una contraseña segura (minimo 8 caracteres). Seguiras conectado despues de actualizar.',
      'account.recovery.new_password': 'Nueva contraseña',
      'account.recovery.confirm_password': 'Confirmar contraseña',
      'account.recovery.update': 'Actualizar contraseña',
      'account.recovery.cancel': 'Cancelar',
      'account.field.email': 'Correo',
      'account.placeholder.email': 'tu@correo.com',
      'account.field.password': 'Contraseña',
      'account.field.password_min': 'Minimo 8 caracteres',
      'account.field.password_current': 'Tu contraseña',
      'account.field.password_repeat': 'Repite la contraseña',
      'account.dashboard.title': 'Panel',
      'account.dashboard.connecting': 'Conectando…',
      'account.dashboard.browse': 'Ver',
      'account.dashboard.saved': 'Guardadas',
      'account.dashboard.manual_pdf': 'Manual PDF',
      'account.dashboard.sign_out': 'Cerrar sesion',
      'account.tiles.saved_listings': 'Propiedades guardadas',
      'account.tiles.saved_word': 'guardadas',
      'account.tiles.saved_count': '{count} guardadas',
      'account.tiles.saved_desc': 'Abre tu seleccion y compartela al instante.',
      'account.tiles.sell_property': 'Vender',
      'account.tiles.sell_property_title': 'Publica tu propiedad',
      'account.tiles.sell_property_desc': 'Sube fotos y envia para revision del admin. Publicamos anuncios verificados.',
      'account.tiles.browse': 'Ver',
      'account.tiles.browse_desc_title': 'Encuentra tu proximo lugar',
      'account.tiles.browse_desc': 'Filtros rapidos, mapa preciso y referencias compartibles.',
      'account.tiles.guide': 'Guia',
      'account.tiles.guide_title': 'Como usar la app',
      'account.tiles.guide_desc': 'Todas las funciones, beneficios y consejos rapidos en un solo lugar.',
      'account.tiles.scout': 'Gana',
      'account.tiles.scout_title': 'Street Scout (200€–500€)',
      'account.tiles.scout_desc': 'Haz una foto de un cartel de venta y gana cuando se cierre.',
      'account.tiles.admin': 'Admin',
      'account.tiles.admin_fav_title': 'Bandeja de favoritos',
      'account.tiles.admin_fav_desc': 'Ver guardadas de todos los usuarios (solo admin).',
      'account.tiles.admin_crm_title': 'Leads y contactos',
      'account.tiles.admin_crm_desc': 'Datos privados de CRM (solo admin).',
      'account.tiles.admin_shop_title': 'Editor de tienda',
      'account.tiles.admin_shop_desc': 'Edita los productos de domotica mostrados en la app.',
      'account.tiles.partner_tools': 'Herramientas partner',
      'account.tiles.partner_tools_title': 'Marca blanca y colaboracion',
      'account.tiles.partner_tools_desc': 'Para agencias, agentes, promotores y colaboradores.',
      'account.admin.title': 'Panel de admin',
      'account.admin.subtitle': 'Gestiona favoritos, roles y colaboradores.',
      'account.admin.btn.fav_inbox': 'Bandeja de favoritos',
      'account.admin.btn.crm': 'CRM',
      'account.admin.btn.shop': 'Editor de tienda',
      'account.admin.btn.scout': 'Bandeja Street Scout',
      'account.admin.user_roles': 'Roles de usuario',
      'account.admin.user_roles_help': 'El usuario crea su cuenta primero. Luego asigna un rol aqui.',
      'account.admin.search_placeholder': 'Buscar por correo o nombre (p.ej. john@agency.com)',
      'account.admin.search': 'Buscar',
      'account.diagnostics.title': 'Diagnosticos',
      'account.diagnostics.subtitle': 'Abre esta pagina con <code>?qa=1</code> para ver comprobaciones.',
      'account.copy_prompt': 'Copiar:',
      'account.badge.partner': 'Herramientas partner activas',
      'account.badge.scout': 'Street Scout',
      'account.badge.newbuilds': 'Obra nueva',

      'account.role.title': 'Tu espacio',
      'account.role.admin.title': 'Centro de administracion',
      'account.role.admin.b1': 'Revisa la bandeja de favoritos y responde rapido a clientes con alta intencion.',
      'account.role.admin.b2': 'Aprueba nuevas solicitudes (propiedades, vehiculos, Street Scout).',
      'account.role.admin.b3': 'Asigna roles a agencias, agentes, promotores y colaboradores.',
      'account.role.admin.a1': 'Bandeja de favoritos',
      'account.role.admin.a2': 'CRM',
      'account.role.admin.a3': 'Street Scout',
      'account.role.admin.note': 'Consejo: usa “Estudio rapido” para generar enlaces en marca blanca en un clic.',

      'account.role.developer.title': 'Espacio de promotor',
      'account.role.developer.b1': 'Comparte obra nueva con clientes usando folleto y reel.',
      'account.role.developer.b2': 'Usa enlaces en marca blanca al compartir con agencias partner.',
      'account.role.developer.b3': 'Coordina visitas y documentacion con el equipo de SCP.',
      'account.role.developer.a1': 'Obra nueva',
      'account.role.developer.a2': 'Colaboracion',
      'account.role.developer.a3': 'Servicios',
      'account.role.developer.note': 'Usa el estudio rapido para enlaces de folleto/reel por referencia (SCP-XXXX).',

      'account.role.agency_admin.title': 'Espacio de agencia',
      'account.role.agency_admin.b1': 'Comparte anuncios con tus clientes con tu marca (marca blanca).',
      'account.role.agency_admin.b2': 'Usa reels para mejorar respuesta en Instagram/TikTok.',
      'account.role.agency_admin.b3': 'Envia shortlists y manten todo en un solo sistema.',
      'account.role.agency_admin.a1': 'Guardadas',
      'account.role.agency_admin.a2': 'Herramientas partner',
      'account.role.agency_admin.a3': 'Guia',
      'account.role.agency_admin.note': 'Usa el estudio rapido para generar enlaces de folleto/reel en segundos.',

      'account.role.agent.title': 'Espacio de agente',
      'account.role.agent.b1': 'Guarda anuncios y comparte una shortlist limpia con tu cliente.',
      'account.role.agent.b2': 'Genera folletos PDF y reels para redes sociales.',
      'account.role.agent.b3': 'La marca blanca elimina la marca de SCP en tus presentaciones.',
      'account.role.agent.a1': 'Guardadas',
      'account.role.agent.a2': 'Ver',
      'account.role.agent.a3': 'Viaje de visitas',
      'account.role.agent.note': 'Consejo: abre un anuncio y pulsa Instagram/TikTok para generar un reel.',

      'account.role.collaborator.title': 'Espacio de colaborador',
      'account.role.collaborator.b1': 'Street Scout: haz una foto de un cartel “Se vende” y gana €200–€500.',
      'account.role.collaborator.b2': 'Tus envios se guardan y se ven en tu panel.',
      'account.role.collaborator.b3': 'Tambien puedes compartir anuncios con folletos y reels.',
      'account.role.collaborator.a1': 'Street Scout',
      'account.role.collaborator.a2': 'Guardadas',
      'account.role.collaborator.a3': 'Guia',
      'account.role.collaborator.note': 'Mantén la ubicacion activada al enviar leads.',

      'account.role.client.title': 'Panel de cliente',
      'account.role.client.b1': 'Guarda anuncios en movil y escritorio (sincronizacion activa).',
      'account.role.client.b2': 'Solicita visita y planifica un viaje de visitas cuando estes listo.',
      'account.role.client.b3': 'Vende tu propiedad con aprobacion admin para control de calidad.',
      'account.role.client.a1': 'Ver',
      'account.role.client.a2': 'Guardadas',
      'account.role.client.a3': 'Vender',
      'account.role.client.note': 'Si eres agencia/agente/promotor, pide que activemos herramientas partner.',

      'account.quickshare.kicker': 'Herramientas partner',
      'account.quickshare.title': 'Estudio rapido',
      'account.quickshare.whitelabel': 'Marca blanca',
      'account.quickshare.ref_label': 'Referencia',
      'account.quickshare.open_listing': 'Abrir anuncio',
      'account.quickshare.open_brochure': 'Folleto (PDF)',
      'account.quickshare.open_reel': 'Reel (Video)',
      'account.quickshare.copy_link': 'Copiar enlace',
      'account.quickshare.copy_brochure': 'Copiar folleto',
      'account.quickshare.copy_reel': 'Copiar reel',
      'account.quickshare.hint': 'Consejo: abre un anuncio y pulsa Instagram/TikTok para generar un reel para compartir.',
      'account.quickshare.copied': 'Copiado',
      'account.quickshare.copy_failed': 'No se pudo copiar',

      'account.activity.kicker': 'Tu actividad',
      'account.activity.title': 'Sync y envios',
      'account.activity.refresh': 'Actualizar',
      'account.activity.loading': 'Cargando',
      'account.activity.loading_note': 'Obteniendo tus estadisticas…',
      'account.activity.admin.fav': 'Favoritos',
      'account.activity.admin.fav_note': 'Total guardadas de todos los usuarios',
      'account.activity.admin.scout': 'Street Scout',
      'account.activity.admin.scout_note': 'Nuevos leads para revisar',
      'account.activity.admin.props': 'Bandeja propiedades',
      'account.activity.admin.props_note': 'Nuevas solicitudes de propietarios',
      'account.activity.admin.vehicles': 'Bandeja vehiculos',
      'account.activity.admin.vehicles_note': 'Nuevas solicitudes de vehiculos',
      'account.activity.saved': 'Guardadas',
      'account.activity.saved_note': 'Favoritos sincronizados · {local} en este dispositivo',
      'account.activity.articles': 'Artículos',
      'account.activity.articles_note': 'Publicaciones del blog guardadas',
      'account.activity.alerts': 'Alertas',
      'account.activity.alerts_note': 'Nuevas coincidencias segun tus requisitos guardados',
      'account.activity.scout': 'Street Scout',
      'account.activity.scout_note': 'Leads enviados',
      'account.activity.props': 'Vender / Enviar',
      'account.activity.props_note': 'Solicitudes de propiedades',
      'account.activity.vehicles': 'Vehiculos',
      'account.activity.vehicles_note': 'Solicitudes de vehiculos',

      'account.alerts.kicker': 'Alertas de propiedades',
      'account.alerts.title': 'Requisitos guardados y nuevas coincidencias',
      'account.alerts.refresh': 'Actualizar',
      'account.alerts.mark_seen': 'Marcar todo como visto',
      'account.alerts.auth': 'Inicia sesion para cargar tus alertas.',
      'account.alerts.loading': 'Cargando alertas…',
      'account.alerts.summary': '{alerts} alertas · {new} nuevas coincidencias',
      'account.alerts.empty': 'Aun no hay alertas. Guarda tus requisitos desde Propiedades u Obra Nueva.',
      'account.alerts.no_matches': 'Aun no hay coincidencias para esta alerta.',
      'account.alerts.new_badge': '{count} nuevas',
      'account.alerts.total_badge': '{count} total',
      'account.alerts.paused': 'Pausada',
      'account.alerts.pause': 'Pausar',
      'account.alerts.resume': 'Reanudar',
      'account.alerts.delete': 'Eliminar',
      'account.alerts.marking': 'Marcando como vistas…',
      'account.alerts.mark_failed': 'No se pudieron marcar las alertas como vistas.',
      'account.alerts.mark_done': 'Todas las alertas marcadas como vistas.',
      'account.alerts.updating': 'Actualizando alerta…',
      'account.alerts.update_failed': 'No se pudo actualizar la alerta.',
      'account.alerts.updated': 'Alerta actualizada.',
      'account.alerts.delete_confirm': '¿Eliminar esta alerta?',
      'account.alerts.deleting': 'Eliminando alerta…',
      'account.alerts.delete_failed': 'No se pudo eliminar la alerta.',
      'account.alerts.deleted': 'Alerta eliminada.',
      'account.alerts.setup_required': 'Falta la tabla de alertas. Ejecuta el supabase.sql actualizado.',
      'account.alerts.load_failed': 'No se pudieron cargar las alertas ahora.',
      'account.alerts.perimeter_on': 'Area por perimetro',

      'account.shop.kicker': 'Dispositivos inteligentes',
      'account.shop.title': 'Cesta y compras',
      'account.shop.open_shop': 'Abrir tienda',
      'account.shop.refresh': 'Actualizar',
      'account.shop.basket_title': 'Tu cesta',
      'account.shop.basket_hint': 'Añade dispositivos desde la tienda y solicita ayuda de instalación.',
      'account.shop.basket_empty': 'La cesta está vacía. Abre la tienda para añadir dispositivos.',
      'account.shop.checkout': 'Solicitar compra',
      'account.shop.checkout_empty': 'La cesta está vacía.',
      'account.shop.checkout_sending': 'Enviando solicitud…',
      'account.shop.checkout_failed': 'Fallo en la solicitud',
      'account.shop.checkout_sent': 'Solicitud enviada. Te contactaremos para confirmar pago e instalación.',
      'account.shop.clear_basket': 'Vaciar cesta',
      'account.shop.cleared': 'Cesta vaciada.',
      'account.shop.remove': 'Eliminar',
      'account.shop.open': 'Abrir',
      'account.shop.price_on_request': 'Precio bajo consulta',
      'account.shop.history_title': 'Historial de compras',
      'account.shop.history_hint': 'Tras el pago/aprobación, las instrucciones de instalación aparecerán aquí.',
      'account.shop.history_empty': 'Aún no hay compras. Tus solicitudes y compras aparecerán aquí.',
      'account.shop.history_auth': 'Inicia sesión para ver tu historial de compras.',
      'account.shop.order': 'Pedido',
      'account.shop.placed': 'Realizado',
      'account.shop.order_no_items': 'No hay artículos registrados.',
      'account.shop.docs': 'Docs',
      'account.shop.docs_title': 'Instrucciones de instalación',
      'account.shop.docs_note': 'Este contenido está disponible tras la compra/aprobación.',
      'account.shop.docs_pending': 'Las instrucciones aparecerán aquí tras el pago/aprobación.',
      'account.shop.docs_empty': 'Aún no hay instrucciones.',
      'account.shop.docs_links': 'Enlaces',
      'account.shop.status.requested': 'Solicitado',
      'account.shop.status.paid': 'Pagado',
      'account.shop.status.fulfilled': 'Confirmado',
      'account.shop.status.installed': 'Instalado',
      'account.shop.status.cancelled': 'Cancelado',

      'services.hero.title': 'Servicios que eliminan friccion',
      'services.hero.subtitle': 'Los compradores y vendedores no necesitan mas anuncios, necesitan un proceso fiable. Damos pasos claros, coordinacion local y soporte documental para que los acuerdos se cierren.',
      'services.property.title': '🏡 Servicios de propiedades',
      'services.property.subtitle': 'La mayoria de la gente no necesita “mas anuncios”. Necesita menos opciones, mejores comparaciones y una secuencia clara de siguientes pasos. Apoyamos tanto propiedades de reventa como promociones de obra nueva. Elige el servicio que encaja con tu momento y lo mantendremos estructurado.',
      'services.property.buy_sell.title': 'Comprar y vender',
      'services.property.buy_sell.desc': 'Selecciones cortas, visitas, apoyo en negociacion y una entrega fluida.',
      'services.property.new_builds.title': 'Obra Nueva',
      'services.property.new_builds.desc': 'Promociones y opciones sobre plano, desde la seleccion hasta el snagging y la entrega.',
      'services.property.rent.title': 'Alquiler',
      'services.property.rent.desc': 'Buscar alquileres, validar condiciones y mantener expectativas claras.',
      'services.property.viewing_trips.title': 'Viajes de visitas',
      'services.property.viewing_trips.desc': 'Paquetes de 2-7 dias: seleccion primero, luego traslados, alojamiento, alquiler de coche y visitas.',
      'services.property.management.title': 'Gestion',
      'services.property.management.desc': 'Propietarios tranquilos. Coordinamos llaves, entradas y mantenimiento.',
      'services.property.maintenance.title': 'Mantenimiento',
      'services.property.maintenance.desc': 'Profesionales de confianza, respuesta rapida y actualizaciones transparentes.',
      'services.business.title': '🏪 Servicios de negocios',
      'services.business.subtitle': 'Los traspasos en España se ganan o se pierden por la claridad: que incluye, que se transfiere y que pasa despues de acordar. Mantenemos el proceso en marcha, coordinamos especialistas cuando hace falta y trabajamos con arquitectos en licencias y permisos para que puedas operar legalmente.',
      'services.business.buy_sell.title': 'Comprar y vender',
      'services.business.buy_sell.desc': 'Filtrado de oportunidades y guia practica de siguientes pasos.',
      'services.business.management.title': 'Gestion',
      'services.business.management.desc': 'Entregas, transicion de proveedores y soporte practico tras la compra.',
      'services.business.legal.title': 'Asesoria legal',
      'services.business.legal.desc': 'Soporte legal basico interno y coordinacion con especialistas cuando sea necesario.',
      'services.business.contracts.title': 'Contratos',
      'services.business.contracts.desc': 'Claridad en alquileres, entregas y obligaciones operativas.',
      'services.business.documentation.title': 'Documentacion',
      'services.business.documentation.desc': 'Cambios de documentacion y coordinacion de transferencias.',
      'services.business.licenses.title': 'Licencias y permisos',
      'services.business.licenses.desc': 'Coordinacion con arquitectos para licencias de apertura/actividad y pasos para operar legalmente.',
      'services.smart.title': '🔒 Dispositivos inteligentes (IoT / Domotica)',
      'services.smart.subtitle': 'Ayudamos a propietarios y operadores a seleccionar, instalar y gestionar dispositivos inteligentes que realmente mejoran el dia a dia: cerraduras inteligentes y codigos de acceso, sensores, camaras, automatizacion y conectividad fiable. Nos movemos bien entre software y hardware, asi que la instalacion es practica, segura y mantenible.',
      'services.smart.guide.title': 'Guia de dispositivos',
      'services.smart.guide.desc': 'Casos de uso, seleccion de dispositivos y como planificamos e instalamos de forma fiable.',
      'services.smart.shop.title': 'Tienda (dispositivos)',
      'services.smart.shop.desc': 'Ver productos de WooCommerce dentro de la app y abrir la tienda oficial para comprar.',
      'services.smart.consult.title': 'Consulta y plan',
      'services.smart.consult.desc': 'Definir el objetivo (acceso, energia, seguridad), lista de dispositivos y plan de implementacion realista.',
      'services.smart.install.title': 'Instalar',
      'services.smart.install.desc': 'Cerraduras inteligentes, sensores y red basica con entrega y documentacion.',
      'services.smart.manage.title': 'Gestionar',
      'services.smart.manage.desc': 'Cambios continuos, soporte y ayuda operativa para alquileres y negocios.',
      'services.vehicles.title': '🚗 Vehiculos (coches y barcos)',
      'services.vehicles.subtitle': 'Tanto si compras, alquilas o gestionas un vehiculo, el objetivo es el mismo: precios claros, entregas fluidas y un proceso que no te haga perder tiempo.',
      'services.vehicles.buy_sell.title': 'Comprar y vender',
      'services.vehicles.buy_sell.desc': 'Encontrar opciones adecuadas y gestionar los pasos de principio a fin.',
      'services.vehicles.rent.title': 'Alquilar',
      'services.vehicles.rent.desc': 'Precios y expectativas claras, entrega sencilla al cliente.',
      'services.vehicles.management.title': 'Gestion',
      'services.vehicles.management.desc': 'Soporte para reservas, entregas y gestion practica.',
      'services.ready.title': '¿Empezamos?',
      'services.ready.subtitle': 'Dinos que buscas y tu presupuesto, y te responderemos con una lista corta y los siguientes pasos en 24 horas.',

      'services.collab.title': 'Colabora con nosotros',
      'services.collab.subtitle': 'Dos vias: colaboradores verificados (agencias, promotores, proveedores) y Street Scouts que encuentran carteles de venta.',
      'services.collab.partners.title': 'Colaboradores verificados',
      'services.collab.partners.desc': 'Agencias, promotores y proveedores. Importacion XML y presentacion profesional dentro de la app.',
      'services.collab.scout.title': 'Street Scout (200€–500€)',
      'services.collab.scout.desc': 'Foto de cartel + ubicacion. Nosotros incorporamos el anuncio. Tu ganas cuando se vende.',

      'page.scout.hero.title': 'Street Scout (200€–500€)',
      'page.scout.hero.subtitle': '¿Vas andando y ves un cartel de “Se vende”? Haz una foto, captura la ubicacion y envianoslo. Si incorporamos la propiedad y se vende, ganas una recompensa.',
      'page.scout.tag.photo': 'Foto',
      'page.scout.tag.location': 'Ubicacion',
      'page.scout.tag.tracking': 'Seguimiento',
      'page.scout.tag.payout': 'Pago',
      'page.scout.cta.submit': 'Enviar cartel',
      'page.scout.cta.account': 'Iniciar sesion / Crear cuenta',
      'page.scout.how.title': 'Como funciona',
      'page.scout.how.1.title': '1) Haz una foto',
      'page.scout.how.1.p': 'Captura el cartel de “Se vende” claramente (telefono visible).',
      'page.scout.how.2.title': '2) Envia ubicacion',
      'page.scout.how.2.p': 'Adjuntamos GPS para saber la calle exacta y reaccionar rapido.',
      'page.scout.how.3.title': '3) Llamamos e incorporamos',
      'page.scout.how.3.p': 'Contactamos al propietario/agencia, verificamos y lo anadimos a nuestro portafolio.',
      'page.scout.how.4.title': '4) Recibes recompensa',
      'page.scout.how.4.p': 'Cuando se cierra la venta, recibes un minimo de 200€ o 500€ segun el nivel.',
      'page.scout.disclaimer': 'Nota: pagos sujetos a verificacion (duplicados, carteles falsos, ubicacion incorrecta o anuncios no incorporados no son elegibles).',
      'page.scout.submit.title': 'Enviar un cartel de venta',
      'page.scout.auth.title': 'Primero inicia sesion',
      'page.scout.auth.p': 'Para enviar carteles y seguir tus recompensas, inicia sesion (o crea una cuenta gratis).',
      'page.scout.auth.cta': 'Abrir Cuenta',
      'page.scout.join.title': 'Hazte colaborador',
      'page.scout.join.p': 'Activa Street Scout para enviar carteles. Es un clic.',
      'page.scout.join.cta': 'Activar Street Scout',
      'page.scout.join.learn_more': 'Ver colaboraciones',
      'page.scout.form.title': 'Nuevo envio',
      'page.scout.form.subtitle': 'Foto + ubicacion. Telefono y notas opcionales nos ayudan a ir mas rapido.',
      'page.scout.form.admin_link': 'Bandeja admin',
      'page.scout.form.photo': 'Foto del cartel',
      'page.scout.form.location': 'Ubicacion',
      'page.scout.form.get_location': 'Obtener ubicacion',
      'page.scout.form.phone': 'Telefono (opcional)',
      'page.scout.form.phone_ph': '+34 …',
      'page.scout.form.tier': 'Nivel de propiedad (minimo de recompensa)',
      'page.scout.form.tier.standard': 'Estandar (min 200€)',
      'page.scout.form.tier.premium': 'Premium / Comercial (min 500€)',
      'page.scout.form.notes': 'Notas (opcional)',
      'page.scout.form.notes_ph': 'Calle, mejor hora para llamar, cualquier detalle util…',
      'page.scout.form.confirm': 'Hice esta foto yo mismo y la ubicacion es correcta.',
      'page.scout.form.submit': 'Enviar a Spanish Coast Properties',
      'page.scout.form.processing': 'Procesando foto…',
      'page.scout.form.sending': 'Enviando…',
      'page.scout.form.sent': 'Enviado. Gracias. Revisaremos y contactaremos al propietario/agencia.',
      'page.scout.form.failed': 'Fallo',
      'page.scout.mine.title': 'Mis envios',
      'page.scout.mine.subtitle': 'Sigue el estado y las recompensas.',
      'page.scout.mine.refresh': 'Actualizar',
      'page.scout.mine.th.time': 'Hora',
      'page.scout.mine.th.status': 'Estado',
      'page.scout.mine.th.reward': 'Recompensa',
      'page.scout.mine.th.location': 'Ubicacion',
      'page.scout.mine.loading': 'Cargando…',
      'page.scout.mine.failed': 'Fallo al cargar',
      'page.scout.mine.loaded': 'Cargados {count} envios.',
      'page.scout.mine.sold': 'Vendido',
      'page.scout.mine.paid': 'Pagado',
      'page.scout.location.none': 'Sin ubicacion aun.',
      'page.scout.location.open_maps': 'Abrir',
      'page.scout.location.working': 'Obteniendo ubicacion…',
      'page.scout.location.ok': 'Ubicacion capturada.',
      'page.scout.location.failed': 'Fallo al obtener ubicacion',
      'page.scout.errors.no_supabase': 'Supabase no esta configurado.',
      'page.scout.errors.session': 'Fallo de sesion',
      'page.scout.errors.signin_first': 'Inicia sesion primero.',
      'page.scout.errors.enable_first': 'Activa Street Scout primero.',
      'page.scout.errors.photo_required': 'Anade una foto.',
      'page.scout.errors.location_required': 'Obten la ubicacion (GPS) para enviar.',
      'page.scout.errors.confirm_required': 'Confirma la casilla.',
      'page.scout.errors.photo_invalid': 'Foto invalida',
      'page.scout.join.working': 'Activando Street Scout…',
      'page.scout.join.done': 'Street Scout activado. Ya puedes enviar.',
      'page.scout.join.failed': 'Fallo al activar',
      'page.scout.footer.p': 'Street Scout: ampliar el portafolio y recompensar a quienes nos ayudan a descubrir anuncios.',

      'catalog.details': 'Detalles',
      'catalog.count.results': '{count} resultados',
      'catalog.count.listings': '{count} anuncios',
      'catalog.businesses.none_title': 'No se encontraron negocios',
      'catalog.businesses.none_meta': 'Prueba cambiando el filtro a Todos.',
      'catalog.businesses.none_body': 'Si nos dices tu presupuesto y sector, te haremos una seleccion de las mejores oportunidades.',
      'catalog.vehicles.soon_title': 'Vehiculos pronto',
      'catalog.vehicles.soon_meta': 'Coches y barcos en venta o alquiler.',
      'catalog.vehicles.soon_body': 'Dinos lo que necesitas y buscaremos opciones y gestionaremos el proceso.',

      'page.new_builds_guide.hero.title': 'Propiedades de Obra Nueva (Sobre plano y Llave en mano)',
      'page.new_builds_guide.hero.p1': 'La obra nueva va de claridad: que promociones son opciones reales, como es el calendario de pagos, que incluye, y como pasas de la reserva a las llaves sin sorpresas.',
      'page.new_builds_guide.hero.p2': 'Hacemos una seleccion de las mejores promociones segun tus criterios, organizamos visitas y coordinamos las piezas del proceso para que decidas rapido y avances con seguridad.',
      'page.new_builds_guide.cta.browse': 'Ver obra nueva',
      'page.new_builds_guide.section.what_you_get': 'Lo que obtienes',
      'page.new_builds_guide.section.what_you_get.p': 'El objetivo es reducir el ruido y mantener la decision centrada en hechos: calidad de construccion, realidad de ubicacion, plazos de entrega y coste total.',
      'page.new_builds_guide.card.shortlist.title': 'Seleccion (promociones)',
      'page.new_builds_guide.card.shortlist.p': 'Filtramos por presupuesto, fecha de entrega, zonas y no negociables. Solo opciones realistas.',
      'page.new_builds_guide.card.payment.title': 'Claridad del plan de pagos',
      'page.new_builds_guide.card.payment.p': 'Reserva, pagos por fases, fecha de finalizacion y una vista clara de tasas y extras esperados.',
      'page.new_builds_guide.card.viewings.title': 'Visitas que importan',
      'page.new_builds_guide.card.viewings.p': 'Viviendas, calles alrededor, orientacion, parking, ruido y comparaciones entre promociones.',
      'page.new_builds_guide.card.snagging.title': 'Snagging y entrega',
      'page.new_builds_guide.card.snagging.p': 'Revision de defectos en entrega, coordinacion practica y un camino mas facil a las llaves.',
      'page.new_builds_guide.section.process': 'Como funciona el proceso',
      'page.new_builds_guide.section.process.p': 'La obra nueva suele ser mas rapida que la reventa cuando tienes la promocion correcta, pero tiene pasos “ocultos”. Hacemos la secuencia explicita para que no se escape nada.',
      'page.new_builds_guide.process.1.title': '1) Requisitos',
      'page.new_builds_guide.process.1.p': 'Presupuesto, zonas, plazos y imprescindibles (terraza, piscina, cerca de playa, parking).',
      'page.new_builds_guide.process.2.title': '2) Seleccion y comparaciones',
      'page.new_builds_guide.process.2.p': 'Comparamos promociones: ubicacion, calidades y que incluye.',
      'page.new_builds_guide.process.3.title': '3) Visitas',
      'page.new_builds_guide.process.3.p': 'Planificamos visitas para comparar bien y evitar “fatiga de tour comercial”.',
      'page.new_builds_guide.process.4.title': '4) Reserva',
      'page.new_builds_guide.process.4.p': 'Soporte en siguientes pasos y coordinacion con profesionales licenciados cuando sea necesario.',
      'page.new_builds_guide.process.5.title': '5) Calendario de obra',
      'page.new_builds_guide.process.5.p': 'Hitos, expectativas de entrega y planificacion practica alrededor de la finalizacion.',
      'page.new_builds_guide.process.6.title': '6) Snagging y llaves',
      'page.new_builds_guide.process.6.p': 'Revision final, lista de defectos y una entrega limpia para empezar a usar la propiedad.',
      'page.new_builds_guide.process.note': 'Nota: no somos un despacho de abogados. Cuando se requiera representacion legal formal, coordinamos con profesionales licenciados.',
      'page.new_builds_guide.section.what_to_send': 'Que enviar (para una seleccion rapida)',
      'page.new_builds_guide.section.what_to_send.p': 'Envia lo basico y avanzamos rapido con una seleccion que refleje disponibilidad real.',
      'page.new_builds_guide.tag.budget': 'Presupuesto (max)',
      'page.new_builds_guide.tag.towns': 'Zonas / areas',
      'page.new_builds_guide.tag.delivery': 'Fecha de entrega',
      'page.new_builds_guide.tag.beds': 'Dorms (min)',
      'page.new_builds_guide.tag.walk_beach': '¿A pie a la playa?',
      'page.new_builds_guide.tag.pool_parking': 'Piscina / parking',
      'page.new_builds_guide.tag.finance': 'Efectivo / hipoteca',
      'page.new_builds_guide.section.faq': 'FAQ',
      'page.new_builds_guide.faq.1.q': '¿Podeis empezar a distancia?',
      'page.new_builds_guide.faq.1.a': 'Si. Podemos hacer la seleccion primero y organizar visitas cuando estes listo para viajar.',
      'page.new_builds_guide.faq.2.q': '¿Ayudais con muebles y puesta a punto?',
      'page.new_builds_guide.faq.2.a': 'Podemos asesorar y coordinar pasos practicos tras la compra (entrega, puesta a punto y basicos).',
      'page.new_builds_guide.faq.3.q': '¿Cual es el primer paso?',
      'page.new_builds_guide.faq.3.a': 'Envia presupuesto, zonas e imprescindibles. Respondemos con una seleccion y el siguiente paso.',

      'page.viewing_trip.hero.title': 'Paquete de viaje de visitas',
      'page.viewing_trip.hero.p': 'La mayoria de compradores a los que ayudamos estan en el extranjero. Un viaje corto es la forma mas rapida de decidir con confianza, pero solo si esta estructurado. Creamos un plan que combina seleccion, logistica de viaje y visitas.',
      'page.viewing_trip.tag.days': '2-7 dias',
      'page.viewing_trip.tag.transfer': 'Traslado aeropuerto',
      'page.viewing_trip.tag.accommodation': 'Alojamiento',
      'page.viewing_trip.tag.car_rental': 'Alquiler de coche',
      'page.viewing_trip.tag.schedule': 'Agenda de visitas',
      'page.viewing_trip.cta.start_email': 'Empezar por correo',
      'page.viewing_trip.cta.browse_listings': 'Ver anuncios',
      'page.viewing_trip.cta.browse_new_builds': 'Ver obra nueva',
      'page.viewing_trip.section.how': 'Como funciona',
      'page.viewing_trip.how.1.title': '1. Llamada de requisitos',
      'page.viewing_trip.how.1.p': 'Confirmamos zona, presupuesto, imprescindibles, plazos y cuantas visitas son realistas por dia.',
      'page.viewing_trip.how.2.title': '2. Seleccion antes de volar',
      'page.viewing_trip.how.2.p': 'Creamos una lista corta que merece la visita y validamos lo basico para no perder el viaje.',
      'page.viewing_trip.how.3.title': '3. Logistica del viaje',
      'page.viewing_trip.how.3.p': 'Coordinamos traslado aeropuerto, alojamiento y una opcion de coche que encaje con tu agenda.',
      'page.viewing_trip.how.4.title': '4. Visitas y siguientes pasos',
      'page.viewing_trip.how.4.p': 'Ejecutamos un plan de visitas eficiente y te guiamos en ofertas, reservas y proceso de compra.',
      'page.viewing_trip.section.included': 'Que incluye',
      'page.viewing_trip.included.1.title': '✈️ Opciones de vuelos',
      'page.viewing_trip.included.1.p': 'Sugerimos rutas y horarios realistas. Tu reservas, nosotros alineamos la agenda.',
      'page.viewing_trip.included.2.title': '🚐 Traslado aeropuerto',
      'page.viewing_trip.included.2.p': 'Recogida y regreso para llegar relajado y a tiempo a las visitas.',
      'page.viewing_trip.included.3.title': '🏠 Alojamiento',
      'page.viewing_trip.included.3.p': 'Estancias cortas con partners locales y viviendas que ayudamos a gestionar (cuando haya disponibilidad).',
      'page.viewing_trip.included.4.title': '🚗 Alquiler de coche',
      'page.viewing_trip.included.4.p': 'Coordinamos un coche acorde a la zona y agenda. Tras la compra tambien podemos ayudarte con una venta de coche.',
      'page.viewing_trip.included.note': 'El objetivo es simple: menos sorpresas, menos tiempo perdido y un camino claro de “quizas” a “decision”.',
      'page.viewing_trip.section.offer_stay': '¿Quieres ofrecer estancias a compradores?',
      'page.viewing_trip.offer_stay.p': 'Si tienes una propiedad en Costa Blanca Sur y quieres alquilarla como estancia corta para viajes de visitas, contactanos. Podemos gestionar entregas y mantener un estandar alto.',

      'page.businesses.hero.title': 'Negocios en venta',
      'page.businesses.hero.p1': 'Explora oportunidades de negocios en Costa Blanca Sur. Apoyamos la operacion con contratos, cambios de documentacion y coordinacion de licencias/permisos (en colaboracion con arquitectos) para que puedas operar legalmente.',
      'page.businesses.hero.p2': 'Ideal para emprendedores que se mudan a España, inversores que buscan flujo de caja, o propietarios que quieren una salida limpia. Nos centramos en claridad: que incluye, que se transfiere y cual es el siguiente paso.',
      'page.businesses.filters.deal': 'Operacion',
      'page.businesses.filters.deal_value': 'Negocio en venta / Traspaso',
      'page.businesses.filters.business_type': 'Tipo de negocio',
      'page.businesses.map_toggle': 'Mapa',
      'page.businesses.map.title': 'Negocios en el mapa',
      'page.businesses.how_help.title': 'Como ayudamos',
      'page.businesses.how_help.p': '¿Quieres una seleccion? Envia por correo tu presupuesto, zona y sector.',
      'page.businesses.cta.sell_business': 'Quiero vender mi negocio',
      'page.businesses.collab.title': 'Colabora con nosotros (verificados)',
      'page.businesses.collab.p': '¿Eres agente, broker, abogado u operador local y quieres colaborar? Damos de alta partners verificados y podemos importar tu feed XML para que tus anuncios se vean consistentes y profesionales en la app.',
      'page.businesses.collab.cta.options': 'Opciones de colaboracion',
      'page.businesses.collab.cta.email': 'Escribenos',

      'account.hero.title': 'Tu cuenta',
      'account.hero.subtitle': 'Inicia sesión para sincronizar favoritos y desbloquear herramientas de colaboración.',

      'nearby.title': 'Resumen de zona',
      'nearby.loading_short': 'Cargando…',
      'nearby.loading': 'Cargando servicios cercanos…',
      'nearby.note': 'Las distancias son aproximadas (en linea recta). Datos: colaboradores de OpenStreetMap.',
      'nearby.approx': 'aprox.',
      'nearby.unavailable': 'La informacion cercana puede ser limitada para este anuncio.',
      'nearby.min_walk': '{mins} min a pie',
      'nearby.min_drive': '{mins} min en coche',

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

  const MANUAL_LOCALES = {
    ro: {
      'lang.label': 'Limbă',
      'lang.en': 'Engleză',
      'lang.es': 'Spaniolă',
      'lang.ro': 'Română',
      'lang.sv': 'Suedeză',
      'lang.en_short': 'EN',
      'lang.es_short': 'ES',
      'lang.ro_short': 'RO',
      'lang.sv_short': 'SV',
      'common.in': 'în',
      'common.all': 'Toate',
      'nav.home': 'Acasă',
      'nav.properties': 'Proprietăți',
      'nav.new_builds': 'Construcții noi',
      'nav.businesses': 'Afaceri',
      'nav.vehicles': 'Vehicule',
      'nav.services': 'Servicii',
      'nav.blog': 'Blog',
      'nav.account': 'Cont',
      'nav.contact_us': 'Contact',
      'nav.email': 'Email',
      'nav.call': 'Sună',
      'ui.menu': 'Meniu',
      'ui.map': 'Hartă',
      'ui.list': 'Listă',
      'ui.open_filters': 'Deschide filtrele',
      'ui.toggle_map': 'Comută harta',
      'ui.clear_all_filters': 'Șterge toate filtrele',
      'ui.apply_filters': 'Aplică filtrele',
      'ui.close_filters': 'Închide filtrele',
      'pricing.on_request': 'Preț la cerere'
    },
    sv: {
      'lang.label': 'Språk',
      'lang.en': 'Engelska',
      'lang.es': 'Spanska',
      'lang.ro': 'Rumänska',
      'lang.sv': 'Svenska',
      'lang.en_short': 'EN',
      'lang.es_short': 'ES',
      'lang.ro_short': 'RO',
      'lang.sv_short': 'SV',
      'common.in': 'i',
      'common.all': 'Alla',
      'nav.home': 'Hem',
      'nav.properties': 'Bostäder',
      'nav.new_builds': 'Nyproduktion',
      'nav.businesses': 'Företag',
      'nav.vehicles': 'Fordon',
      'nav.services': 'Tjänster',
      'nav.blog': 'Blogg',
      'nav.account': 'Konto',
      'nav.contact_us': 'Kontakt',
      'nav.email': 'E-post',
      'nav.call': 'Ring',
      'ui.menu': 'Meny',
      'ui.map': 'Karta',
      'ui.list': 'Lista',
      'ui.open_filters': 'Öppna filter',
      'ui.toggle_map': 'Växla karta',
      'ui.clear_all_filters': 'Rensa alla filter',
      'ui.apply_filters': 'Använd filter',
      'ui.close_filters': 'Stäng filter',
      'pricing.on_request': 'Pris på begäran'
    }
  };

  const AUTO_TRANSLATION_GLOSSARY = {
    ro: {
      'Spanish Coast Properties': 'Spanish Coast Properties',
      'Costa Blanca South': 'Costa Blanca Sud',
      'Traspaso': 'Traspaso',
      'WhatsApp': 'WhatsApp',
      'TikTok': 'TikTok',
      'Instagram': 'Instagram'
    },
    sv: {
      'Spanish Coast Properties': 'Spanish Coast Properties',
      'Costa Blanca South': 'Costa Blanca Syd',
      'Traspaso': 'Traspaso',
      'WhatsApp': 'WhatsApp',
      'TikTok': 'TikTok',
      'Instagram': 'Instagram'
    }
  };

  const localeReadyPromises = Object.create(null);

  const mergeLocaleObjects = (base, patch) => {
    const out = { ...(base || {}) };
    Object.keys(patch || {}).forEach((k) => {
      const v = patch[k];
      if (typeof v === 'string') out[k] = v;
    });
    return out;
  };

  const ensureSupportedLang = (code) => {
    const c = normalizeLang(code);
    if (!c) return;
    if (!SUPPORTED.includes(c)) SUPPORTED.push(c);
  };

  const registerLocale = (code, locale, { includeInSupported = true } = {}) => {
    const c = normalizeLang(code);
    if (!c || !locale || typeof locale !== 'object') return;
    DICT[c] = mergeLocaleObjects(DICT[c], locale);
    if (includeInSupported) ensureSupportedLang(c);
  };

  Object.keys(MANUAL_LOCALES).forEach((code) => {
    registerLocale(code, MANUAL_LOCALES[code], { includeInSupported: true });
  });

  const autoCacheKey = (code) => `${AUTO_CACHE_KEY_PREFIX}${normalizeLang(code)}`;
  const autoErrorKey = (code) => `${AUTO_ERROR_KEY_PREFIX}${normalizeLang(code)}`;

  const loadAutoCache = (code) => {
    try {
      if (!window.localStorage) return null;
      const raw = window.localStorage.getItem(autoCacheKey(code));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const saveAutoCache = (code, dict) => {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(autoCacheKey(code), JSON.stringify(dict || {}));
    } catch {
      // ignore storage quota and private mode errors
    }
  };

  const readAutoErrorTs = (code) => {
    try {
      if (!window.localStorage) return 0;
      const raw = Number(window.localStorage.getItem(autoErrorKey(code)) || 0);
      return Number.isFinite(raw) ? raw : 0;
    } catch {
      return 0;
    }
  };

  const markAutoError = (code) => {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(autoErrorKey(code), String(Date.now()));
    } catch {
      // ignore
    }
  };

  const clearAutoError = (code) => {
    try {
      if (!window.localStorage) return;
      window.localStorage.removeItem(autoErrorKey(code));
    } catch {
      // ignore
    }
  };

  const preserveVars = (text) => {
    const tokens = [];
    const prepared = String(text || '').replace(/\{[\w]+\}/g, (m) => {
      const token = `__SCP_VAR_${tokens.length}__`;
      tokens.push({ token, value: m });
      return token;
    });
    return { prepared, tokens };
  };

  const restoreVars = (text, tokens) => {
    let out = String(text || '');
    (tokens || []).forEach(({ token, value }) => {
      out = out.split(token).join(value);
    });
    return out;
  };

  const applyGlossary = (text, code) => {
    const glossary = AUTO_TRANSLATION_GLOSSARY[normalizeLang(code)] || {};
    let out = String(text || '');
    Object.keys(glossary).forEach((source) => {
      out = out.split(source).join(glossary[source]);
    });
    return out;
  };

  const isAutoTranslatable = (value) => {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    // Keep HTML snippets untouched to avoid broken markup.
    if (/[<>]/.test(trimmed)) return false;
    return true;
  };

  const readGoogleTranslatedText = (payload) => {
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) return '';
    return payload[0].map((part) => (Array.isArray(part) ? String(part[0] || '') : '')).join('');
  };

  const translateChunkGoogle = async (texts, targetCode) => {
    if (!Array.isArray(texts) || !texts.length) return [];

    const prepared = texts.map((text) => preserveVars(text));
    const joined = prepared.map((item) => item.prepared).join(AUTO_TRANSLATE_DELIMITER);
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', DEFAULT_LANG);
    url.searchParams.set('tl', normalizeLang(targetCode));
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', joined);

    const res = await fetch(url.toString(), { method: 'GET', mode: 'cors', cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`translate_failed_${res.status}`);
    }
    const payload = await res.json();
    const translatedJoined = readGoogleTranslatedText(payload);
    if (!translatedJoined) throw new Error('translate_empty');

    let segments = translatedJoined.split(AUTO_TRANSLATE_DELIMITER);
    if (segments.length !== texts.length) {
      const rx = new RegExp(`\\s*${AUTO_TRANSLATE_DELIMITER}\\s*`, 'g');
      segments = translatedJoined.split(rx);
    }
    if (segments.length !== texts.length) {
      throw new Error('translate_segment_mismatch');
    }

    return segments.map((value, idx) => {
      const restored = restoreVars(value, prepared[idx].tokens);
      return applyGlossary(restored, targetCode);
    });
  };

  const translationChainFor = (targetLang) => {
    const chain = [];
    const add = (code) => {
      const c = normalizeLang(code);
      if (!c) return;
      if (!chain.includes(c)) chain.push(c);
    };
    add(targetLang);
    (LANG_FALLBACKS[normalizeLang(targetLang)] || []).forEach(add);
    add(DEFAULT_LANG);
    return chain;
  };

  const ensureLocaleReady = (code) => {
    const targetCode = normalizeLang(code);
    if (!AUTO_TRANSLATE_ENABLED || !AUTO_TRANSLATE_LANGS.includes(targetCode)) {
      return Promise.resolve(false);
    }
    if (localeReadyPromises[targetCode]) return localeReadyPromises[targetCode];

    localeReadyPromises[targetCode] = (async () => {
      const cached = loadAutoCache(targetCode);
      if (cached && typeof cached === 'object') {
        registerLocale(targetCode, cached, { includeInSupported: true });
      }

      const lastErrorAt = readAutoErrorTs(targetCode);
      if (lastErrorAt && (Date.now() - lastErrorAt) < AUTO_RETRY_AFTER_MS) {
        return false;
      }

      const base = DICT[DEFAULT_LANG] || {};
      const target = mergeLocaleObjects(DICT[targetCode], {});
      const missingKeys = Object.keys(base).filter((key) => {
        if (Object.prototype.hasOwnProperty.call(target, key)) return false;
        return isAutoTranslatable(base[key]);
      });

      if (!missingKeys.length) return false;

      let translatedAny = false;
      for (let i = 0; i < missingKeys.length; i += AUTO_TRANSLATE_BATCH_SIZE) {
        const batchKeys = missingKeys.slice(i, i + AUTO_TRANSLATE_BATCH_SIZE);
        const batchTexts = batchKeys.map((key) => String(base[key]));

        let translated = [];
        try {
          // Free endpoint, cached locally after first success.
          translated = await translateChunkGoogle(batchTexts, targetCode);
        } catch {
          markAutoError(targetCode);
          break;
        }

        if (!Array.isArray(translated) || translated.length !== batchKeys.length) break;
        batchKeys.forEach((key, idx) => {
          const text = String(translated[idx] || '').trim();
          if (text) target[key] = text;
        });
        translatedAny = true;

        if (i + AUTO_TRANSLATE_BATCH_SIZE < missingKeys.length) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      if (!translatedAny) return false;
      registerLocale(targetCode, target, { includeInSupported: true });
      saveAutoCache(targetCode, target);
      clearAutoError(targetCode);
      return true;
    })();

    return localeReadyPromises[targetCode];
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
    const chain = translationChainFor(lang);
    let val = k;
    for (let i = 0; i < chain.length; i += 1) {
      const dict = DICT[chain[i]] || null;
      if (!dict) continue;
      if (Object.prototype.hasOwnProperty.call(dict, k)) {
        val = dict[k];
        break;
      }
    }
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

  const emitUpdated = () => {
    try {
      window.dispatchEvent(new CustomEvent('scp:i18n-updated', { detail: { lang } }));
    } catch {
      // ignore environments without CustomEvent
    }
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
      return;
    }
    applyTranslations(document);
    emitUpdated();
    ensureLocaleReady(lang).then((changed) => {
      if (!changed) return;
      applyTranslations(document);
      emitUpdated();
    });
  };

  const init = () => {
    setHtmlLang();
    applyTranslations(document);
    emitUpdated();
    ensureLocaleReady(lang).then((changed) => {
      if (!changed) return;
      applyTranslations(document);
      emitUpdated();
    });
  };

  window.SCP_I18N = {
    SUPPORTED,
    DEFAULT_LANG,
    get lang() { return lang; },
    detectLang,
    t,
    setLang,
    applyTranslations,
    registerLocale: (code, locale, options = {}) => {
      registerLocale(code, locale, options);
      if (normalizeLang(code) !== lang) return;
      applyTranslations(document);
      emitUpdated();
    },
    ensureLocaleReady
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
