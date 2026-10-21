'use strict';
(() => {
  const COLORS = { 'red bull': '#3671C6', ferrari: '#E8002D', mercedes: '#27F4D2', mclaren: '#FF8000',
    aston: '#229971', alpine: '#FF87BC', williams: '#64C4FF', alphatauri: '#6692FF',
    haas: '#B6BABD', alfa: '#C92D4B', sauber: '#52E252' };

  const teamColor = (name = '') => {
    const k = String(name).toLowerCase();
    const hit = Object.keys(COLORS).find(key => k.includes(key));
    return hit ? COLORS[hit] : '#8d93a1';
  };

  // Escapa texto antes de insertarlo con innerHTML (previene XSS)
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // La CSP bloquea style="" en el HTML; se asigna desde JS (CSSOM sí está permitido)
  const paintTeams = root => root.querySelectorAll('[data-team]').forEach(el =>
    el.style.setProperty('--team', teamColor(el.dataset.team)));

  async function api(url, options) {
    const res = await fetch(url, options);
    let data = {};
    try { data = await res.json(); } catch { /* respuesta sin JSON */ }
    if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { data });
    return data;
  }

  const getUser = () => {
    try { return JSON.parse(localStorage.getItem('apex_user')); } catch { return null; }
  };
  const setUser = u => { try { localStorage.setItem('apex_user', JSON.stringify(u)); } catch { /* sin storage */ } };

  window.Apex = { teamColor, esc, paintTeams, api, getUser, setUser };
})();
