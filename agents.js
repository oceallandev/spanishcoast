// Agents page: fetch from WordPress API if available, otherwise show placeholders.
(() => {
  const grid = document.getElementById('agents-grid');
  if (!grid) return;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const apiBase = (window.SCP_CONFIG && window.SCP_CONFIG.wpApiBase) || '';
  const endpoint = apiBase ? `${apiBase.replace(/\/$/, '')}/wp-json/scp/v1/agents` : '';

  const card = (a) => {
    const name = esc(a.name || 'Agent');
    const role = esc(a.role || 'Property Advisor');
    const areas = esc(a.areas || 'Costa Blanca South');
    const langs = Array.isArray(a.languages) ? a.languages : (a.languages ? String(a.languages).split(',') : []);
    const languages = esc(langs.map((x) => String(x).trim()).filter(Boolean).join(' · ') || 'EN · ES');
    const img = esc(a.photo_url || 'assets/placeholder.png');
    const whatsapp = a.whatsapp ? String(a.whatsapp).replace(/[^\d+]/g, '') : '';
    const email = esc(a.email || 'info@spanishcoastproperties.com');

    return `
      <article class="agent-card">
        <div class="agent-photo">
          <img src="${img}" alt="${name}" loading="lazy" referrerpolicy="no-referrer"
            onerror="this.onerror=null;this.src='assets/placeholder.png'">
        </div>
        <div class="agent-body">
          <div class="agent-name">${name}</div>
          <div class="agent-role">${role}</div>
          <div class="agent-meta">📍 ${areas}</div>
          <div class="agent-meta">🗣️ ${languages}</div>
          <div class="agent-actions">
            ${whatsapp ? `<a class="share-btn" href="https://wa.me/${encodeURIComponent(whatsapp)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
            <a class="share-btn" href="mailto:${email}?subject=${encodeURIComponent('Inquiry - ' + name)}">✉️ Email</a>
          </div>
        </div>
      </article>
    `;
  };

  const render = (agents) => {
    if (!agents || agents.length === 0) {
      grid.innerHTML = `
        <article class="catalog-card">
          <div class="catalog-content">
            <h3>Agents coming soon</h3>
            <div class="catalog-meta">We are preparing the agent directory.</div>
          </div>
        </article>
      `;
      return;
    }
    grid.innerHTML = agents.map(card).join('');
  };

  const fallback = () => render([
    { name: 'Spanish Coast Properties', role: 'Concierge Team', areas: 'Torrevieja · Orihuela Costa · Guardamar', languages: ['EN', 'ES'], email: 'info@spanishcoastproperties.com' }
  ]);

  if (!endpoint) {
    fallback();
    return;
  }

  fetch(endpoint, { credentials: 'omit' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Fetch failed'))))
    .then((data) => render(Array.isArray(data) ? data : (data && data.items ? data.items : [])))
    .catch(() => fallback());
})();

