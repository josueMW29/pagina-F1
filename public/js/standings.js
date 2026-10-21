'use strict';
(() => {
  const { esc, paintTeams, api, getUser } = window.Apex;
  const fav = getUser()?.team;
  const out = document.getElementById('out');
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const memo = {};

  const fmtDate = iso => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const driverName = d => `<span class="bar" data-team="${esc(d.team)}"></span>${esc(d.name)}<span class="sub">#${esc(d.number ?? '–')} · ${esc(d.team)}</span>`;

  const views = {
    drivers: {
      url: '/api/drivers', head: ['Pos', 'Piloto', 'Victorias', 'Puntos'],
      row: d => [d.pos, driverName(d), d.wins, d.points],
      mine: d => fav && d.team === fav
    },
    teams: {
      url: '/api/teams', head: ['Pos', 'Escudería', 'Puntos'],
      row: t => [t.pos, `<span class="bar" data-team="${esc(t.name)}"></span>${esc(t.name)}`, t.points],
      mine: t => fav && t.name === fav
    },
    races: {
      url: '/api/races', head: ['Ronda', 'Gran Premio', 'Circuito', 'Fecha'],
      row: r => [r.round, esc(r.name), `${esc(r.circuit)}<span class="sub">${esc(r.city)}, ${esc(r.country)}</span>`, fmtDate(r.date)],
      mine: () => false
    }
  };

  async function show(key) {
    const v = views[key] || views.drivers;
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.view === key)));
    out.innerHTML = '<p class="msg">Cargando datos…</p>';
    try {
      memo[key] ??= await api(v.url);
      const { season, data } = memo[key];
      if (!data.length) { out.innerHTML = '<p class="msg">La API no devolvió datos para esta temporada.</p>'; return; }
      out.innerHTML = `<table><caption>Temporada ${esc(season)}</caption>
        <thead><tr>${v.head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${data.map(item => `<tr class="${v.mine(item) ? 'fav' : ''}">${
          v.row(item).map((c, i) => i === 0 ? `<td class="num">${esc(c)}</td>` : `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      paintTeams(out);
    } catch (err) {
      out.innerHTML = `<p class="msg error">${esc(err.message)}</p>`;
    }
  }

  tabs.forEach(t => t.addEventListener('click', () => { history.replaceState(null, '', `#${t.dataset.view}`); show(t.dataset.view); }));
  show(location.hash.slice(1) in views ? location.hash.slice(1) : 'drivers');
})();
