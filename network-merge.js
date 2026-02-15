/* Merge manual network profiles (network-data.js) with imported feeds (e.g. network-redsp.js). */
(() => {
  const base = (window.scpNetworkData && typeof window.scpNetworkData === 'object') ? window.scpNetworkData : null;
  const redsp = (window.scpNetworkDataRedsp && typeof window.scpNetworkDataRedsp === 'object') ? window.scpNetworkDataRedsp : null;

  if (!base && !redsp) return;
  if (base && !redsp) {
    window.scpNetworkDataMerged = base;
    return;
  }

  const normKey = (x) => String(x || '').trim().toLowerCase();
  const pickKey = (item) => {
    if (!item || typeof item !== 'object') return '';
    return normKey(item.slug || item.id);
  };

  const mergeList = (a, b) => {
    const out = [];
    const seen = new Set();
    const push = (arr) => {
      (Array.isArray(arr) ? arr : []).forEach((it) => {
        const k = pickKey(it);
        if (!k || seen.has(k)) return;
        seen.add(k);
        out.push(it);
      });
    };
    push(a);
    push(b);
    return out;
  };

  const merged = {
    ...(base || {}),
    version: `${(base && base.version) ? String(base.version) : ''}${(redsp && redsp.version) ? ` + ${String(redsp.version)}` : ''}`.trim(),
    agencies: mergeList(base && base.agencies, redsp && redsp.agencies),
    agents: mergeList(base && base.agents, redsp && redsp.agents),
    developers: mergeList(base && base.developers, redsp && redsp.developers),
    developments: mergeList(base && base.developments, redsp && redsp.developments),
    collaborators: mergeList(base && base.collaborators, redsp && redsp.collaborators)
  };

  window.scpNetworkDataMerged = merged;
})();

