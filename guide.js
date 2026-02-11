(() => {
  const versionEl = document.getElementById('guide-version');
  const updatedEl = document.getElementById('guide-updated');
  const printBtn = document.getElementById('manual-print-btn');

  const pickVersion = () => {
    const link = document.querySelector('link[href*="style.css"][href*="?v="]');
    const href = link ? link.getAttribute('href') : '';
    if (!href) return '';
    try {
      const u = new URL(href, window.location.href);
      return (u.searchParams.get('v') || '').trim();
    } catch {
      const m = String(href).match(/[?&]v=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    }
  };

  const formatUpdatedFromVersion = (v) => {
    const m = String(v || '').match(/(\d{4})(\d{2})(\d{2})/);
    if (!m) return '';
    return `${m[1]}-${m[2]}-${m[3]}`; // ISO date for clarity
  };

  const v = pickVersion();
  if (versionEl) {
    versionEl.textContent = v || 'unknown';
  }
  if (updatedEl) {
    updatedEl.textContent = v ? (formatUpdatedFromVersion(v) || v) : 'unknown';
  }

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
})();
