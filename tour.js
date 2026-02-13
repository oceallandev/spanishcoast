import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/controls/OrbitControls.js';

(() => {
  const $ = (id) => document.getElementById(id);
  const toText = (value, fallback = '') => {
    if (value === null || value === undefined) return fallback;
    const raw = String(value);
    if (!raw) return fallback;
    return raw
      .replace(/\[\s*amp\s*,?\s*\]/gi, '&')
      .replace(/&amp,/gi, '&')
      .replace(/&amp(?!;)/gi, '&');
  };

  const normalize = (value) => toText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const isLoopbackHost = (hostname) => {
    const host = toText(hostname).trim().toLowerCase();
    if (!host) return false;
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    if (host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') return true;
    return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  };

  const ensureTrailingSlash = (value) => {
    const text = toText(value).trim();
    if (!text) return '';
    return text.endsWith('/') ? text : `${text}/`;
  };

  const configuredSiteBase = () => {
    try {
      const raw = toText(window.SCP_CONFIG && window.SCP_CONFIG.siteUrl).trim();
      if (!raw) return '';
      const parsed = new URL(raw, window.location.href);
      const path = parsed.pathname || '/';
      const basePath = /\/[^/]+\.[a-z0-9]+$/i.test(path)
        ? path.replace(/\/[^/]+\.[a-z0-9]+$/i, '/')
        : ensureTrailingSlash(path);
      return `${parsed.origin}${basePath}`;
    } catch {
      return '';
    }
  };

  const canonicalSiteBase = () => {
    try {
      const canonical = document.querySelector('link[rel="canonical"][href]');
      if (!canonical) return '';
      const href = toText(canonical.getAttribute('href')).trim();
      if (!href) return '';
      const parsed = new URL(href, window.location.href);
      const path = parsed.pathname || '/';
      const basePath = /\/[^/]+\.[a-z0-9]+$/i.test(path)
        ? path.replace(/\/[^/]+\.[a-z0-9]+$/i, '/')
        : ensureTrailingSlash(path);
      return `${parsed.origin}${basePath}`;
    } catch {
      return '';
    }
  };

  const publicSiteBase = (() => {
    const configured = configuredSiteBase();
    if (configured) return configured;
    try {
      const isLoopback = window.location.protocol === 'file:' || isLoopbackHost(window.location.hostname);
      if (!isLoopback) return '';
    } catch {
      return '';
    }
    return canonicalSiteBase();
  })();

  const buildAppUrl = (path, params = {}) => {
    const cleanPath = toText(path).replace(/^\.?\//, '');
    const base = publicSiteBase || window.location.href;
    const url = new URL(cleanPath, base);
    Object.entries(params || {}).forEach(([key, rawValue]) => {
      const value = rawValue == null ? '' : String(rawValue).trim();
      if (!value) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    });
    return url.toString();
  };

  const escapeHtml = (value) => toText(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

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
    if (fallback !== undefined) return formatTemplate(fallback, vars);
    return k;
  };

  const els = {
    ref: $('tour-ref'),
    title: $('tour-title'),
    meta: $('tour-meta'),
    viewer: $('tour-viewer'),
    hotspots: $('tour-hotspots'),
    overlay: $('tour-viewer-overlay'),
    overlayTitle: $('tour-overlay-title'),
    overlaySub: $('tour-overlay-sub'),
    status: $('tour-status'),
    sceneCount: $('tour-scene-count'),
    sceneList: $('tour-scene-list'),
    prevBtn: $('tour-prev'),
    nextBtn: $('tour-next'),
    autoSpinBtn: $('tour-autospin'),
    brochureBtn: $('tour-open-brochure'),
    shareBtn: $('tour-share'),
    openStudioBtn: $('tour-open-studio'),
    dollhouse: $('tour-dollhouse'),

    studio: $('tour-studio'),
    urlInput: $('tour-url-input'),
    jsonInput: $('tour-json-input'),
    fileInput: $('tour-file-input'),
    generateUrlsBtn: $('tour-generate-urls'),
    saveDraftBtn: $('tour-save-draft'),
    loadDraftBtn: $('tour-load-draft'),
    clearDraftBtn: $('tour-clear-draft'),
    importJsonBtn: $('tour-import-json'),
    exportJsonBtn: $('tour-export-json'),
    previewFilesBtn: $('tour-preview-files')
  };

  const qs = new URLSearchParams(window.location.search || '');
  const queryRef = toText(qs.get('ref')).trim().toUpperCase();
  const studioFromQuery = qs.get('studio') === '1';
  const state = {
    ref: queryRef,
    property: null,
    tour: null,
    sceneIndex: 0,
    autoSpin: true,
    localObjectUrls: [],
    studioOpen: studioFromQuery
  };

  const DRAFT_KEY = (ref) => `scp:tour:draft:${(toText(ref).trim().toUpperCase() || 'UNKNOWN')}`;

  const listSources = () => {
    const pools = [
      window.propertyData,
      window.customPropertyData,
      window.businessData,
      window.businessListings,
      window.vehicleData,
      window.vehicleListings
    ];
    const out = [];
    const seen = new Set();
    pools.forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((row) => {
        if (!row || typeof row !== 'object') return;
        const ref = toText(row.ref).trim().toUpperCase();
        if (!ref || seen.has(ref)) return;
        seen.add(ref);
        out.push(row);
      });
    });
    return out;
  };

  const findPropertyByRef = (ref) => {
    const target = toText(ref).trim().toUpperCase();
    if (!target) return null;
    return listSources().find((row) => toText(row.ref).trim().toUpperCase() === target) || null;
  };

  const listingPriceNumber = (property) => {
    const n = Number(property && property.price);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  };

  const formatListingPrice = (property) => {
    const number = listingPriceNumber(property);
    if (!Number.isFinite(number)) return t('pricing.on_request', 'Price on request');
    const formatted = new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(number);
    const desc = normalize(property && property.description);
    if (desc.includes('traspaso')) return t('pricing.traspaso_suffix', `${formatted} (Traspaso)`, { price: formatted });
    return formatted;
  };

  const builtAreaFor = (property) => {
    const built = Number(property && property.surface_area && property.surface_area.built);
    if (Number.isFinite(built) && built > 0) return Math.trunc(built);
    const fallback = Number(property && (property.built_area || property.builtArea));
    return Number.isFinite(fallback) && fallback > 0 ? Math.trunc(fallback) : 0;
  };

  const imageUrlsFor = (property) => {
    const images = property && property.images;
    const list = [];
    if (Array.isArray(images)) list.push(...images);
    else if (typeof images === 'string') {
      images
        .split(/[\n,]/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((url) => list.push(url));
    }
    if (property && property.image) list.push(property.image);
    const seen = new Set();
    return list
      .map((u) => toText(u).trim())
      .filter(Boolean)
      .filter((u) => {
        const key = u.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const parsePosition = (value, fallbackIndex = 0, total = 1) => {
    const fallbackRadius = Math.max(4, total * 1.2);
    const angle = (fallbackIndex / Math.max(1, total)) * Math.PI * 2;
    const fallback = {
      x: Number((Math.sin(angle) * fallbackRadius).toFixed(2)),
      y: 0,
      z: Number((Math.cos(angle) * fallbackRadius).toFixed(2))
    };

    if (Array.isArray(value)) {
      const x = Number(value[0]);
      const y = Number(value[1]);
      const z = Number(value[2]);
      if ([x, y, z].every((n) => Number.isFinite(n))) return { x, y, z };
      return fallback;
    }
    if (value && typeof value === 'object') {
      const x = Number(value.x);
      const y = Number(value.y);
      const z = Number(value.z);
      if ([x, y, z].every((n) => Number.isFinite(n))) return { x, y, z };
    }
    return fallback;
  };

  const ensureAngleLinks = (tour) => {
    if (!tour || !Array.isArray(tour.scenes)) return;
    const byId = new Map(tour.scenes.map((scene) => [scene.id, scene]));
    tour.scenes.forEach((scene) => {
      scene.links.forEach((link) => {
        if (!byId.has(link.to)) return;
        if (Number.isFinite(link.yaw) && Number.isFinite(link.pitch)) return;
        const target = byId.get(link.to);
        const dx = target.position.x - scene.position.x;
        const dy = target.position.y - scene.position.y;
        const dz = target.position.z - scene.position.z;
        const horizontal = Math.sqrt((dx * dx) + (dz * dz)) || 0.0001;
        link.yaw = THREE.MathUtils.radToDeg(Math.atan2(dx, dz));
        link.pitch = THREE.MathUtils.radToDeg(Math.atan2(dy, horizontal));
      });
    });
  };

  const normalizeTour = (rawTour, property) => {
    if (!rawTour || typeof rawTour !== 'object') return null;
    const rawScenes = Array.isArray(rawTour.scenes) ? rawTour.scenes : [];
    if (!rawScenes.length) return null;

    const scenes = rawScenes.map((row, idx) => {
      const id = toText(row.id).trim() || `scene-${idx + 1}`;
      const name = toText(row.name || row.label).trim() || `${t('tour.scene', 'Scene')} ${idx + 1}`;
      const pano = toText(row.pano || row.image || row.url).trim();
      const yaw = Number(row.yaw);
      const pitch = Number(row.pitch);
      const links = Array.isArray(row.links)
        ? row.links.map((link) => ({
          to: toText(link && link.to).trim(),
          label: toText(link && link.label).trim(),
          yaw: Number(link && link.yaw),
          pitch: Number(link && link.pitch)
        }))
        : [];

      return {
        id,
        name,
        pano,
        position: parsePosition(row.position, idx, rawScenes.length),
        yaw: Number.isFinite(yaw) ? yaw : 0,
        pitch: Number.isFinite(pitch) ? pitch : 0,
        links
      };
    }).filter((scene) => !!scene.pano);

    if (!scenes.length) return null;

    const validIds = new Set(scenes.map((scene) => scene.id));
    scenes.forEach((scene, idx) => {
      scene.links = scene.links.filter((link) => validIds.has(link.to));
      if (!scene.links.length && scenes.length > 1) {
        const next = scenes[(idx + 1) % scenes.length];
        if (next && next.id !== scene.id) scene.links.push({ to: next.id, label: next.name, yaw: NaN, pitch: NaN });
      }
    });

    const byId = new Map(scenes.map((scene) => [scene.id, scene]));
    scenes.forEach((scene) => {
      scene.links.forEach((link) => {
        if (!link.label && byId.has(link.to)) link.label = byId.get(link.to).name;
      });
    });

    const title = toText(rawTour.title).trim() || `${toText(property && property.type, t('modal.type_default', 'Property'))} ${t('tour.title_suffix', 'Tour')}`;
    const output = {
      title,
      scenes
    };
    ensureAngleLinks(output);
    return output;
  };

  const buildTourFromPanoramaUrls = (urls, property) => {
    const clean = (Array.isArray(urls) ? urls : [])
      .map((url) => toText(url).trim())
      .filter(Boolean);
    if (!clean.length) return null;
    const scenes = clean.map((pano, idx) => ({
      id: `scene-${idx + 1}`,
      name: `${t('tour.scene', 'Scene')} ${idx + 1}`,
      pano,
      position: parsePosition(null, idx, clean.length),
      yaw: 0,
      pitch: 0,
      links: []
    }));

    scenes.forEach((scene, idx) => {
      const next = scenes[idx + 1] || null;
      const prev = scenes[idx - 1] || null;
      if (next) scene.links.push({ to: next.id, label: `${t('tour.next', 'Next')}: ${next.name}`, yaw: NaN, pitch: NaN });
      if (prev) scene.links.push({ to: prev.id, label: `${t('tour.back', 'Back')}: ${prev.name}`, yaw: NaN, pitch: NaN });
    });

    const tour = {
      title: `${toText(property && property.type, t('modal.type_default', 'Property'))} ${t('tour.title_suffix', 'Tour')}`,
      scenes
    };
    ensureAngleLinks(tour);
    return tour;
  };

  const buildFallbackTourFromProperty = (property) => {
    const urls = imageUrlsFor(property).slice(0, 8);
    return buildTourFromPanoramaUrls(urls, property);
  };

  class PanoramaStage {
    constructor(container, hotspots, onLinkPress) {
      this.container = container;
      this.hotspots = hotspots;
      this.onLinkPress = onLinkPress;
      this.width = 1;
      this.height = 1;
      this.lon = 0;
      this.lat = 0;
      this.fov = 72;
      this.dragging = false;
      this.autoSpin = true;
      this.linkItems = [];
      this.currentTexture = null;
      this.flatMode = false;
      this.activePano = '';
      this.webglAvailable = true;
      this.webglError = '';
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.mesh = null;
      this.viewDirection = null;
      this.projectTmp = null;

      try {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setClearColor(0x020617, 1);
        this.container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(this.fov, 1, 0.1, 2000);

        const geometry = new THREE.SphereGeometry(500, 64, 48);
        geometry.scale(-1, 1, 1);
        this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x0f172a }));
        this.scene.add(this.mesh);
        this.viewDirection = new THREE.Vector3();
        this.projectTmp = new THREE.Vector3();
      } catch (err) {
        this.webglAvailable = false;
        this.webglError = toText(err && err.message, 'webgl unavailable');
      }

      this.fallbackImage = document.createElement('img');
      this.fallbackImage.className = 'tour-fallback-image';
      this.fallbackImage.alt = t('tour.fallback.alt', 'Tour scene');
      this.fallbackImage.decoding = 'async';
      this.fallbackImage.loading = 'eager';
      this.fallbackImage.draggable = false;
      this.fallbackImage.style.display = 'none';
      this.container.appendChild(this.fallbackImage);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);

      this.bindEvents();
      if (!this.webglAvailable) this.useFlatMode(true);
      this.resize();
      this.animate = this.animate.bind(this);
      this.animate();
    }

    bindEvents() {
      const surface = this.container;
      surface.addEventListener('pointerdown', (ev) => {
        this.dragging = true;
        this.lastX = ev.clientX;
        this.lastY = ev.clientY;
        if (typeof surface.setPointerCapture === 'function') {
          try {
            surface.setPointerCapture(ev.pointerId);
          } catch {
            // ignore
          }
        }
      });

      surface.addEventListener('pointermove', (ev) => {
        if (!this.dragging) return;
        const dx = ev.clientX - this.lastX;
        const dy = ev.clientY - this.lastY;
        this.lastX = ev.clientX;
        this.lastY = ev.clientY;
        this.lon -= dx * 0.11;
        this.lat += dy * 0.11;
      });

      const release = () => { this.dragging = false; };
      surface.addEventListener('pointerup', release);
      surface.addEventListener('pointercancel', release);
      surface.addEventListener('pointerleave', release);

      surface.addEventListener('wheel', (ev) => {
        ev.preventDefault();
        const delta = ev.deltaY > 0 ? 1 : -1;
        this.fov = Math.min(95, Math.max(38, this.fov + delta * 2.6));
      }, { passive: false });
    }

    resize() {
      const box = this.container.getBoundingClientRect();
      this.width = Math.max(1, Math.round(box.width));
      this.height = Math.max(1, Math.round(box.height));
      if (this.camera) {
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
      }
      if (this.renderer) {
        this.renderer.setSize(this.width, this.height, false);
      }
      this.updateHotspotPositions();
    }

    useFlatMode(enabled) {
      this.flatMode = !!enabled;
      if (this.renderer && this.renderer.domElement) {
        this.renderer.domElement.style.display = this.flatMode ? 'none' : 'block';
      }
      if (this.fallbackImage) {
        this.fallbackImage.style.display = this.flatMode ? 'block' : 'none';
      }
    }

    async loadFallbackImage(src) {
      const url = toText(src).trim();
      if (!url || !this.fallbackImage) return false;
      return new Promise((resolve) => {
        let settled = false;
        const done = (value) => {
          if (settled) return;
          settled = true;
          this.fallbackImage.onload = null;
          this.fallbackImage.onerror = null;
          resolve(value);
        };
        this.fallbackImage.onload = () => done(true);
        this.fallbackImage.onerror = () => done(false);
        this.fallbackImage.src = url;
      });
    }

    async loadScene(scene) {
      if (!scene || !scene.pano) return { ok: false, warning: '' };
      this.activePano = toText(scene.pano).trim();
      this.lon = Number.isFinite(scene.yaw) ? scene.yaw : 0;
      this.lat = Number.isFinite(scene.pitch) ? scene.pitch : 0;
      this.setHotspots(scene.links || []);

      const noWebgl = !this.webglAvailable || !this.renderer || !this.scene || !this.camera || !this.mesh;
      if (noWebgl) {
        const fallbackOk = await this.loadFallbackImage(scene.pano);
        if (!fallbackOk) return { ok: false, warning: t('tour.error.scene_failed', 'Scene failed to load') };
        this.useFlatMode(true);
        this.updateFallbackFrame();
        return {
          ok: true,
          warning: t('tour.warning.no_webgl', 'Compatibility mode active: this device/browser does not provide WebGL, so we show scene images with interactive hotspots.')
        };
      }

      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');

      let texture = null;
      try {
        texture = await new Promise((resolve, reject) => {
          loader.load(scene.pano, resolve, undefined, reject);
        });
      } catch {
        texture = null;
      }

      if (!texture) {
        const fallbackOk = await this.loadFallbackImage(scene.pano);
        if (!fallbackOk) {
          return { ok: false, warning: t('tour.error.scene_failed', 'Scene failed to load') };
        }
        this.useFlatMode(true);
        this.updateFallbackFrame();
        return {
          ok: true,
          warning: t('tour.warning.compat_mode', 'Compatibility mode active: showing scene image because this host blocks secure 360 texture loading.')
        };
      }

      this.useFlatMode(false);

      if (this.currentTexture && typeof this.currentTexture.dispose === 'function') {
        this.currentTexture.dispose();
      }
      this.currentTexture = texture;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;

      this.mesh.material.map = texture;
      this.mesh.material.needsUpdate = true;

      const img = texture && texture.image ? texture.image : null;
      const w = Number(img && img.width);
      const h = Number(img && img.height);
      const ratio = (Number.isFinite(w) && Number.isFinite(h) && h > 0) ? (w / h) : 0;
      const isPanoLike = ratio > 1.75 && ratio < 2.25;

      return {
        ok: true,
        warning: isPanoLike ? '' : t('tour.warning.non_pano', 'This image is not 2:1 panorama. For Matterport-style view use Insta360 equirectangular export.')
      };
    }

    setHotspots(links) {
      this.linkItems = [];
      this.hotspots.innerHTML = '';

      (Array.isArray(links) ? links : []).forEach((link) => {
        const yaw = Number(link && link.yaw);
        const pitch = Number(link && link.pitch);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tour-hotspot';
        btn.textContent = toText(link && link.label, t('tour.jump', 'Jump'));
        btn.addEventListener('click', () => {
          if (typeof this.onLinkPress === 'function') this.onLinkPress(link);
        });
        this.hotspots.appendChild(btn);
        this.linkItems.push({
          button: btn,
          yaw: Number.isFinite(yaw) ? yaw : 0,
          pitch: Number.isFinite(pitch) ? pitch : 0
        });
      });

      this.updateHotspotPositions();
    }

    updateHotspotPositions() {
      const halfW = this.width * 0.5;
      const halfH = this.height * 0.5;
      if (this.flatMode) {
        const halfFov = Math.max(25, this.fov * 0.5);
        this.linkItems.forEach((item) => {
          const yawDiff = ((((item.yaw - this.lon) % 360) + 540) % 360) - 180;
          const pitchDiff = item.pitch - this.lat;
          const visible = Math.abs(yawDiff) <= (halfFov * 1.12) && Math.abs(pitchDiff) <= 72;
          if (!visible) {
            item.button.style.display = 'none';
            return;
          }
          const x = halfW + ((yawDiff / halfFov) * halfW * 0.88);
          const y = halfH - ((pitchDiff / halfFov) * halfH * 0.9);
          if (x < -24 || y < -24 || x > this.width + 24 || y > this.height + 24) {
            item.button.style.display = 'none';
            return;
          }
          item.button.style.display = 'inline-flex';
          item.button.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        });
        return;
      }
      if (!this.camera || !this.viewDirection || !this.projectTmp) return;

      this.camera.getWorldDirection(this.viewDirection);

      this.linkItems.forEach((item) => {
        const yawRad = THREE.MathUtils.degToRad(item.yaw);
        const pitchRad = THREE.MathUtils.degToRad(item.pitch);

        this.projectTmp.set(
          500 * Math.sin(yawRad) * Math.cos(pitchRad),
          500 * Math.sin(pitchRad),
          500 * Math.cos(yawRad) * Math.cos(pitchRad)
        );

        const facing = this.viewDirection.dot(this.projectTmp.clone().normalize()) > 0.08;
        if (!facing) {
          item.button.style.display = 'none';
          return;
        }

        this.projectTmp.project(this.camera);
        const x = (this.projectTmp.x * halfW) + halfW;
        const y = (-this.projectTmp.y * halfH) + halfH;

        if (x < -24 || y < -24 || x > this.width + 24 || y > this.height + 24) {
          item.button.style.display = 'none';
          return;
        }

        item.button.style.display = 'inline-flex';
        item.button.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      });
    }

    updateFallbackFrame() {
      if (!this.flatMode || !this.fallbackImage) return;
      const wrapped = (((this.lon % 360) + 360) % 360);
      const x = wrapped / 360;
      const y = Math.max(0, Math.min(1, 0.5 - (this.lat / 170)));
      this.fallbackImage.style.objectPosition = `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`;
    }

    animate() {
      if (this.autoSpin && !this.dragging) {
        this.lon += 0.02;
      }

      this.lat = Math.max(-80, Math.min(80, this.lat));
      if (this.camera) {
        this.camera.fov = this.fov;
        this.camera.updateProjectionMatrix();
      }

      if (this.flatMode || !this.renderer || !this.scene || !this.camera) {
        this.updateFallbackFrame();
        this.updateHotspotPositions();
        this.animId = window.requestAnimationFrame(this.animate);
        return;
      }

      const phi = THREE.MathUtils.degToRad(90 - this.lat);
      const theta = THREE.MathUtils.degToRad(this.lon);
      const target = new THREE.Vector3(
        500 * Math.sin(phi) * Math.sin(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.cos(theta)
      );
      this.camera.lookAt(target);

      this.updateHotspotPositions();
      this.renderer.render(this.scene, this.camera);
      this.animId = window.requestAnimationFrame(this.animate);
    }

    dispose() {
      if (this.animId) window.cancelAnimationFrame(this.animId);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      if (this.fallbackImage && this.fallbackImage.parentNode) {
        this.fallbackImage.parentNode.removeChild(this.fallbackImage);
      }
      if (this.currentTexture && typeof this.currentTexture.dispose === 'function') this.currentTexture.dispose();
      if (this.mesh && this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh && this.mesh.material) this.mesh.material.dispose();
      if (this.renderer) this.renderer.dispose();
      this.hotspots.innerHTML = '';
    }
  }

  class DollhouseStage {
    constructor(container, onSelect) {
      this.container = container;
      this.onSelect = onSelect;
      this.nodeMeshes = [];
      this.linksMesh = null;
      this.nodesGroup = new THREE.Group();
      this.currentSceneId = '';
      this.raycaster = new THREE.Raycaster();
      this.pointer = new THREE.Vector2();

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x020617, 1);
      this.container.appendChild(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.68));
      const dir = new THREE.DirectionalLight(0xffffff, 0.64);
      dir.position.set(8, 14, 9);
      this.scene.add(dir);

      this.floor = new THREE.Mesh(
        new THREE.CircleGeometry(16, 64),
        new THREE.MeshStandardMaterial({
          color: 0x0b1220,
          metalness: 0.1,
          roughness: 0.96,
          transparent: true,
          opacity: 0.78
        })
      );
      this.floor.rotation.x = -Math.PI / 2;
      this.scene.add(this.floor);
      this.scene.add(new THREE.GridHelper(32, 32, 0x1e3a8a, 0x1e293b));
      this.scene.add(this.nodesGroup);

      this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 400);
      this.camera.position.set(12, 12, 12);
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.minDistance = 6;
      this.controls.maxDistance = 90;
      this.controls.target.set(0, 0, 0);

      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
      this.resize();

      this.renderer.domElement.addEventListener('pointerup', (ev) => this.onPointerUp(ev));

      this.animate = this.animate.bind(this);
      this.animate();
    }

    resize() {
      const box = this.container.getBoundingClientRect();
      const width = Math.max(1, Math.round(box.width));
      const height = Math.max(1, Math.round(box.height));
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
    }

    clearMeshes() {
      this.nodeMeshes.forEach((mesh) => {
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) mesh.material.dispose();
      });
      this.nodeMeshes = [];
      while (this.nodesGroup.children.length) {
        this.nodesGroup.remove(this.nodesGroup.children[0]);
      }
      if (this.linksMesh) {
        if (this.linksMesh.geometry) this.linksMesh.geometry.dispose();
        if (this.linksMesh.material) this.linksMesh.material.dispose();
        this.scene.remove(this.linksMesh);
        this.linksMesh = null;
      }
    }

    setTour(tour, currentSceneId) {
      this.clearMeshes();
      if (!tour || !Array.isArray(tour.scenes) || !tour.scenes.length) return;
      const byId = new Map(tour.scenes.map((scene) => [scene.id, scene]));

      const linePositions = [];
      const seenLines = new Set();
      tour.scenes.forEach((scene) => {
        const geometry = new THREE.SphereGeometry(0.48, 24, 18);
        const material = new THREE.MeshStandardMaterial({
          color: scene.id === currentSceneId ? 0x0ea5e9 : 0x60a5fa,
          emissive: scene.id === currentSceneId ? 0x0b5a8a : 0x0c2446,
          emissiveIntensity: scene.id === currentSceneId ? 0.65 : 0.2,
          roughness: 0.42,
          metalness: 0.2
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(scene.position.x, scene.position.y + 0.45, scene.position.z);
        mesh.userData.sceneId = scene.id;
        this.nodesGroup.add(mesh);
        this.nodeMeshes.push(mesh);

        scene.links.forEach((link) => {
          const target = byId.get(link.to);
          if (!target) return;
          const key = [scene.id, target.id].sort().join('::');
          if (seenLines.has(key)) return;
          seenLines.add(key);
          linePositions.push(scene.position.x, scene.position.y + 0.2, scene.position.z);
          linePositions.push(target.position.x, target.position.y + 0.2, target.position.z);
        });
      });

      if (linePositions.length) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const material = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.72 });
        this.linksMesh = new THREE.LineSegments(geometry, material);
        this.scene.add(this.linksMesh);
      }

      this.setCurrent(currentSceneId);
    }

    setCurrent(sceneId) {
      this.currentSceneId = sceneId;
      this.nodeMeshes.forEach((mesh) => {
        const active = mesh.userData.sceneId === sceneId;
        mesh.material.color.set(active ? 0x0ea5e9 : 0x60a5fa);
        mesh.material.emissive.set(active ? 0x0b5a8a : 0x0c2446);
        mesh.material.emissiveIntensity = active ? 0.68 : 0.2;
      });
    }

    onPointerUp(ev) {
      if (!this.nodeMeshes.length) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      this.pointer.set(x, y);

      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.nodeMeshes, false);
      if (!hits.length) return;
      const hit = hits[0].object;
      const sceneId = toText(hit && hit.userData && hit.userData.sceneId).trim();
      if (!sceneId) return;
      if (typeof this.onSelect === 'function') this.onSelect(sceneId);
    }

    animate() {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.animId = window.requestAnimationFrame(this.animate);
    }

    dispose() {
      if (this.animId) window.cancelAnimationFrame(this.animId);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.clearMeshes();
      if (this.floor) {
        this.floor.geometry.dispose();
        this.floor.material.dispose();
      }
      this.controls.dispose();
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }

  let panoStage = null;
  let dollhouseStage = null;

  const setStatus = (message, tone = 'info') => {
    if (!els.status) return;
    els.status.textContent = toText(message);
    els.status.dataset.tone = tone;
  };

  const sceneById = (sceneId) => {
    if (!state.tour || !Array.isArray(state.tour.scenes)) return null;
    return state.tour.scenes.find((scene) => scene.id === sceneId) || null;
  };

  const currentScene = () => {
    if (!state.tour || !Array.isArray(state.tour.scenes) || !state.tour.scenes.length) return null;
    return state.tour.scenes[state.sceneIndex] || state.tour.scenes[0] || null;
  };

  const sceneDisplayName = (scene) => toText(scene && scene.name, t('tour.scene', 'Scene'));

  const renderSceneList = () => {
    if (!els.sceneList) return;
    els.sceneList.innerHTML = '';
    if (!state.tour || !Array.isArray(state.tour.scenes) || !state.tour.scenes.length) return;

    state.tour.scenes.forEach((scene, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `tour-scene-btn${idx === state.sceneIndex ? ' is-active' : ''}`;
      btn.innerHTML = `<span class="tour-scene-dot"></span><span>${escapeHtml(sceneDisplayName(scene))}</span>`;
      btn.addEventListener('click', () => {
        gotoSceneByIndex(idx);
      });
      els.sceneList.appendChild(btn);
    });
  };

  const updateMeta = () => {
    if (!els.meta) return;
    els.meta.innerHTML = '';

    const property = state.property;
    const pills = [];
    const type = toText(property && property.type, t('modal.type_default', 'Property'));
    const location = `${toText(property && property.town, t('modal.town_unknown', 'Unknown Area'))}, ${toText(property && property.province, 'Alicante')}`;
    pills.push(type);
    pills.push(location);

    const price = formatListingPrice(property);
    if (price) pills.push(price);

    const builtArea = builtAreaFor(property);
    if (builtArea > 0) pills.push(`${builtArea} m2`);

    pills.forEach((label) => {
      const span = document.createElement('span');
      span.className = 'reel-pill';
      span.textContent = label;
      els.meta.appendChild(span);
    });
  };

  const showOverlay = (title, subtitle) => {
    if (!els.overlay) return;
    if (els.overlayTitle) els.overlayTitle.textContent = toText(title);
    if (els.overlaySub) els.overlaySub.textContent = toText(subtitle);
    els.overlay.classList.remove('is-hidden');
  };

  const hideOverlay = () => {
    if (!els.overlay) return;
    els.overlay.classList.add('is-hidden');
  };

  const setSceneCountText = () => {
    const count = state.tour && Array.isArray(state.tour.scenes) ? state.tour.scenes.length : 0;
    if (els.sceneCount) {
      els.sceneCount.textContent = t('tour.scenes_count', '{count} scenes', { count });
    }
  };

  const gotoSceneById = async (sceneId) => {
    if (!state.tour || !Array.isArray(state.tour.scenes)) return;
    const index = state.tour.scenes.findIndex((scene) => scene.id === sceneId);
    if (index < 0) return;
    await gotoSceneByIndex(index);
  };

  const gotoSceneByIndex = async (index) => {
    if (!state.tour || !Array.isArray(state.tour.scenes) || !state.tour.scenes.length) return;
    const safeIndex = Math.max(0, Math.min(state.tour.scenes.length - 1, index));
    state.sceneIndex = safeIndex;
    const scene = currentScene();
    if (!scene || !panoStage) return;

    showOverlay(t('tour.loading_scene', 'Loading scene…'), sceneDisplayName(scene));
    try {
      const result = await panoStage.loadScene(scene);
      if (!result || result.ok === false) {
        const failureText = (result && result.warning)
          ? result.warning
          : t('tour.error.scene_failed', 'Scene failed to load');
        showOverlay(t('tour.error.scene_failed', 'Scene failed to load'), t('tour.error.check_url', 'Check panorama URL and CORS/public access.'));
        setStatus(failureText, 'bad');
      } else {
        hideOverlay();
        if (result.warning) setStatus(result.warning, 'warn');
        else setStatus(t('tour.ready', 'Ready. Drag to look around, tap hotspots to move.'), 'good');
      }
    } catch {
      showOverlay(t('tour.error.scene_failed', 'Scene failed to load'), t('tour.error.check_url', 'Check panorama URL and CORS/public access.'));
      setStatus(t('tour.error.scene_failed', 'Scene failed to load'), 'bad');
    }

    renderSceneList();
    if (dollhouseStage && scene) dollhouseStage.setCurrent(scene.id);
  };

  const toggleAutoSpin = () => {
    state.autoSpin = !state.autoSpin;
    if (panoStage) panoStage.autoSpin = state.autoSpin;
    if (els.autoSpinBtn) {
      els.autoSpinBtn.textContent = state.autoSpin
        ? t('tour.auto_spin_on', 'Auto-spin on')
        : t('tour.auto_spin_off', 'Auto-spin off');
    }
  };

  const applyTourModel = async (tourModel, { sourceLabel = '' } = {}) => {
    const normalizedTour = normalizeTour(tourModel, state.property);
    if (!normalizedTour || !normalizedTour.scenes.length) {
      setStatus(t('tour.error.no_scenes', 'No valid scenes found for this listing.'), 'bad');
      return false;
    }

    state.tour = normalizedTour;
    state.sceneIndex = 0;

    if (els.title) {
      els.title.textContent = toText(normalizedTour.title, t('tour.title', 'Virtual Tour'));
    }

    setSceneCountText();
    renderSceneList();

    if (dollhouseStage) {
      dollhouseStage.setTour(state.tour, state.tour.scenes[0].id);
    }

    await gotoSceneByIndex(0);
    if (sourceLabel) {
      setStatus(`${t('tour.loaded_from', 'Loaded from')}: ${sourceLabel}`, 'good');
    }
    return true;
  };

  const loadStaticTourForRef = (ref) => {
    const map = (window.SCP_VIRTUAL_TOURS && typeof window.SCP_VIRTUAL_TOURS === 'object') ? window.SCP_VIRTUAL_TOURS : {};
    const key = toText(ref).trim().toUpperCase();
    if (!key) return null;
    if (Object.prototype.hasOwnProperty.call(map, key)) return map[key];
    return map[toText(ref).trim()] || null;
  };

  const loadDraftTour = () => {
    const key = DRAFT_KEY(state.ref);
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  };

  const saveDraftTour = () => {
    if (!state.tour) {
      setStatus(t('tour.studio.no_tour_to_save', 'No tour loaded to save.'), 'warn');
      return;
    }
    try {
      window.localStorage.setItem(DRAFT_KEY(state.ref), JSON.stringify(state.tour));
      setStatus(t('tour.studio.saved', 'Draft tour saved on this device.'), 'good');
    } catch {
      setStatus(t('tour.studio.save_failed', 'Could not save draft (storage full or blocked).'), 'bad');
    }
  };

  const clearDraftTour = () => {
    try {
      window.localStorage.removeItem(DRAFT_KEY(state.ref));
      setStatus(t('tour.studio.cleared', 'Draft removed for this listing.'), 'good');
    } catch {
      setStatus(t('tour.studio.clear_failed', 'Could not clear draft.'), 'bad');
    }
  };

  const exportTourJson = () => {
    if (!state.tour) {
      setStatus(t('tour.studio.no_tour_to_export', 'No tour loaded to export.'), 'warn');
      return;
    }
    const payload = JSON.stringify(state.tour, null, 2);
    if (els.jsonInput) els.jsonInput.value = payload;

    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${toText(state.ref || 'listing').toLowerCase()}-tour.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus(t('tour.studio.exported', 'Tour JSON exported.'), 'good');
  };

  const importTourJson = async () => {
    const raw = toText(els.jsonInput && els.jsonInput.value).trim();
    if (!raw) {
      setStatus(t('tour.studio.json_empty', 'Paste tour JSON first.'), 'warn');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const ok = await applyTourModel(parsed, { sourceLabel: t('tour.studio.json_import', 'JSON import') });
      if (!ok) throw new Error('invalid');
      setStatus(t('tour.studio.imported', 'Tour JSON imported.'), 'good');
    } catch {
      setStatus(t('tour.studio.import_failed', 'Invalid JSON or scene format.'), 'bad');
    }
  };

  const readUrlsFromTextarea = () => {
    const raw = toText(els.urlInput && els.urlInput.value).trim();
    if (!raw) return [];
    return raw
      .split(/\n+/g)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /^(https?:\/\/|data:image\/)/i.test(line));
  };

  const generateFromUrls = async () => {
    const urls = readUrlsFromTextarea();
    if (!urls.length) {
      setStatus(t('tour.studio.no_urls', 'Add one panorama URL per line first.'), 'warn');
      return;
    }
    const model = buildTourFromPanoramaUrls(urls, state.property);
    const ok = await applyTourModel(model, { sourceLabel: t('tour.studio.url_builder', 'URL builder') });
    if (ok) setStatus(t('tour.studio.generated', 'Virtual tour generated from URLs.'), 'good');
  };

  const revokeLocalObjectUrls = () => {
    state.localObjectUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    state.localObjectUrls = [];
  };

  const previewLocalFiles = async () => {
    const files = (els.fileInput && els.fileInput.files) ? Array.from(els.fileInput.files) : [];
    if (!files.length) {
      setStatus(t('tour.studio.no_files', 'Choose local panorama files first.'), 'warn');
      return;
    }
    revokeLocalObjectUrls();
    const urls = files
      .filter((file) => file && /^image\//i.test(file.type || ''))
      .map((file) => URL.createObjectURL(file));
    state.localObjectUrls = urls.slice();
    const model = buildTourFromPanoramaUrls(urls, state.property);
    const ok = await applyTourModel(model, { sourceLabel: t('tour.studio.local_preview', 'Local preview') });
    if (ok) setStatus(t('tour.studio.preview_ready', 'Local preview ready. Export JSON and replace URLs with hosted files before publishing.'), 'warn');
  };

  const updateStudioVisibility = () => {
    if (!els.studio) return;
    els.studio.hidden = !state.studioOpen;
    if (els.openStudioBtn) {
      els.openStudioBtn.textContent = state.studioOpen
        ? t('tour.close_studio', 'Close Studio')
        : t('tour.open_studio', 'Tour Studio');
    }
  };

  const toggleStudio = () => {
    state.studioOpen = !state.studioOpen;
    updateStudioVisibility();
  };

  const shareTour = async () => {
    const ref = toText(state.ref).trim();
    const url = buildAppUrl('tour.html', { ref });
    const text = `${toText(state.ref)} · ${toText(els.title && els.title.textContent, t('tour.title', 'Virtual Tour'))}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
        setStatus(t('tour.shared', 'Tour shared.'), 'good');
        return;
      }
    } catch {
      // continue to clipboard fallback
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        setStatus(t('tour.copy_link_done', 'Link copied to clipboard.'), 'good');
        return;
      }
    } catch {
      // ignore
    }

    window.prompt(t('modal.share.copy_prompt', 'Copy link:'), url);
    setStatus(t('tour.copy_link_done', 'Link copied to clipboard.'), 'good');
  };

  const setRefChip = () => {
    if (!els.ref) return;
    els.ref.textContent = state.ref || t('modal.ref_unavailable', 'Ref unavailable');
    try {
      const backLink = document.querySelector('.brochure-toolbar-left a.brochure-pill[href="properties.html"]');
      if (backLink) backLink.href = buildAppUrl('properties.html', { ref: state.ref || '' });
    } catch {
      // ignore
    }
  };

  const bindUi = () => {
    if (els.prevBtn) {
      els.prevBtn.addEventListener('click', () => {
        if (!state.tour || !Array.isArray(state.tour.scenes) || !state.tour.scenes.length) return;
        const nextIndex = (state.sceneIndex - 1 + state.tour.scenes.length) % state.tour.scenes.length;
        gotoSceneByIndex(nextIndex);
      });
    }
    if (els.nextBtn) {
      els.nextBtn.addEventListener('click', () => {
        if (!state.tour || !Array.isArray(state.tour.scenes) || !state.tour.scenes.length) return;
        const nextIndex = (state.sceneIndex + 1) % state.tour.scenes.length;
        gotoSceneByIndex(nextIndex);
      });
    }
    if (els.autoSpinBtn) els.autoSpinBtn.addEventListener('click', toggleAutoSpin);
    if (els.shareBtn) els.shareBtn.addEventListener('click', shareTour);
    if (els.openStudioBtn) els.openStudioBtn.addEventListener('click', toggleStudio);

    if (els.brochureBtn) {
      els.brochureBtn.addEventListener('click', () => {
        const ref = toText(state.ref).trim();
        const url = buildAppUrl('brochure.html', { ref });
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    }

    if (els.generateUrlsBtn) els.generateUrlsBtn.addEventListener('click', generateFromUrls);
    if (els.saveDraftBtn) els.saveDraftBtn.addEventListener('click', saveDraftTour);
    if (els.loadDraftBtn) {
      els.loadDraftBtn.addEventListener('click', async () => {
        const draft = loadDraftTour();
        if (!draft) {
          setStatus(t('tour.studio.no_draft', 'No saved draft found for this listing.'), 'warn');
          return;
        }
        const ok = await applyTourModel(draft, { sourceLabel: t('tour.studio.saved_draft', 'Saved draft') });
        if (ok) setStatus(t('tour.studio.draft_loaded', 'Draft loaded.'), 'good');
      });
    }
    if (els.clearDraftBtn) els.clearDraftBtn.addEventListener('click', clearDraftTour);
    if (els.importJsonBtn) els.importJsonBtn.addEventListener('click', importTourJson);
    if (els.exportJsonBtn) els.exportJsonBtn.addEventListener('click', exportTourJson);
    if (els.previewFilesBtn) els.previewFilesBtn.addEventListener('click', previewLocalFiles);

    window.addEventListener('beforeunload', () => {
      revokeLocalObjectUrls();
      if (panoStage) panoStage.dispose();
      if (dollhouseStage) dollhouseStage.dispose();
    });
  };

  const hydrateFromQueryRef = () => {
    const ref = toText(state.ref).trim().toUpperCase();
    if (!ref) return false;
    const property = findPropertyByRef(ref);
    if (!property) return false;
    state.property = property;
    return true;
  };

  const waitForListingData = async (maxMs = 4500) => {
    const start = Date.now();
    while ((Date.now() - start) < maxMs) {
      if (hydrateFromQueryRef()) return true;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return hydrateFromQueryRef();
  };

  const initPropertyContext = () => {
    if (!state.property) {
      const any = listSources();
      if (any.length) {
        state.property = any[0];
        if (!state.ref) state.ref = toText(state.property.ref).trim().toUpperCase();
      }
    }

    setRefChip();
    updateMeta();

    if (!state.property) {
      if (els.title) els.title.textContent = t('tour.error.no_listing_title', 'Listing not found');
      showOverlay(t('tour.error.no_listing_title', 'Listing not found'), t('tour.error.no_listing_sub', 'Open this page with ?ref=SCP-XXXX from a property card.'));
      setStatus(t('tour.error.no_listing_sub', 'Open this page with ?ref=SCP-XXXX from a property card.'), 'bad');
      return false;
    }

    const type = toText(state.property.type, t('modal.type_default', 'Property'));
    const town = toText(state.property.town, t('modal.town_unknown', 'Unknown Area'));
    if (els.title) els.title.textContent = `${type} ${t('common.in', 'in')} ${town}`;
    return true;
  };

  const initStages = () => {
    if (!els.viewer || !els.hotspots || !els.dollhouse) return false;

    try {
      panoStage = new PanoramaStage(els.viewer, els.hotspots, (link) => {
        const toId = toText(link && link.to).trim();
        if (!toId) return;
        gotoSceneById(toId);
      });
    } catch {
      panoStage = null;
      return false;
    }
    panoStage.autoSpin = state.autoSpin;

    try {
      dollhouseStage = new DollhouseStage(els.dollhouse, (sceneId) => {
        gotoSceneById(sceneId);
      });
    } catch {
      dollhouseStage = null;
      els.dollhouse.innerHTML = `<div class="tour-dollhouse-fallback">${escapeHtml(t('tour.warning.dollhouse_unavailable', 'Dollhouse preview unavailable on this device. Scene list remains active.'))}</div>`;
    }

    return true;
  };

  const chooseInitialTour = () => {
    const draft = loadDraftTour();
    if (draft) return { model: draft, source: t('tour.studio.saved_draft', 'Saved draft') };

    const staticTour = loadStaticTourForRef(state.ref);
    if (staticTour) return { model: staticTour, source: t('tour.config.public', 'Published tour config') };

    const fallback = buildFallbackTourFromProperty(state.property);
    if (fallback) return { model: fallback, source: t('tour.config.fallback', 'Listing photos (fallback)') };

    return { model: null, source: '' };
  };

  const boot = async () => {
    bindUi();
    updateStudioVisibility();
    showOverlay(t('tour.overlay.title', 'Preparing 3D walkthrough…'), t('tour.overlay.subtitle', 'Loading panorama and interactive hotspots.'));
    setStatus(t('tour.loading', 'Loading…'));

    await waitForListingData();

    const hasProperty = initPropertyContext();
    if (!hasProperty) return;

    const stagesReady = initStages();
    if (!stagesReady) {
      setStatus(t('tour.error.init_failed', 'Could not initialize 3D viewer.'), 'bad');
      return;
    }

    const initial = chooseInitialTour();
    if (!initial.model) {
      setStatus(t('tour.error.no_tour', 'No tour found. Open Tour Studio and paste Insta360 panorama URLs.'), 'warn');
      showOverlay(t('tour.error.no_tour_title', 'Tour not configured yet'), t('tour.error.no_tour_sub', 'Open Tour Studio and paste Insta360 panorama URLs.'));
      return;
    }

    if (els.jsonInput && initial.model) {
      try {
        els.jsonInput.value = JSON.stringify(initial.model, null, 2);
      } catch {
        // ignore
      }
    }

    const ok = await applyTourModel(initial.model, { sourceLabel: initial.source });
    if (!ok) return;

    if (initial.source === t('tour.config.fallback', 'Listing photos (fallback)')) {
      setStatus(t('tour.warning.fallback_photos', 'Fallback mode from listing photos. For full Matterport-style result, use Insta360 2:1 panoramas in Tour Studio.'), 'warn');
    }
  };

  boot();
})();
