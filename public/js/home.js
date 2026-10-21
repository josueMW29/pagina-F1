'use strict';
(async () => {
  const { esc, paintTeams, api, getUser } = window.Apex;
  const user = getUser();
  const fav = user?.team;

  if (user) {
    document.getElementById('welcome').textContent = `Hola, ${user.name}`;
    document.getElementById('welcomeSub').textContent =
      `Tu escudería favorita es ${user.team}. Aparece resaltada en la clasificación.`;
  }

  const tower = document.getElementById('tower');
  const stats = document.getElementById('stats');
  try {
    const s = await api('/api/summary');
    document.getElementById('season').textContent = s.season;
    tower.innerHTML = s.topDrivers.map(d => `
      <li class="${fav && d.team === fav ? 'fav' : ''}">
        <span class="pos">${esc(d.pos)}</span>
        <span class="bar" data-team="${esc(d.team)}"></span>
        <span>${esc(d.name)}<span class="sub">${esc(d.team)}</span></span>
        <span class="pts">${esc(d.points)}</span>
      </li>`).join('');
    const top = s.topDrivers[0];
    const last = s.lastRace;
    stats.innerHTML = `
      <div class="stat"><b>${esc(top?.name ?? '—')}</b><span>Líder de pilotos (${esc(top?.points ?? 0)} pts)</span></div>
      <div class="stat"><b>${esc(s.leaderTeam?.name ?? '—')}</b><span>Líder de constructores</span></div>
      <div class="stat"><b>${esc(s.rounds)}</b><span>Carreras en la temporada ${esc(s.season)}</span></div>
      <div class="stat"><b>${esc(last?.name ?? '—')}</b><span>Última carrera disputada</span></div>`;
    paintTeams(tower);
  } catch (err) {
    tower.innerHTML = `<li class="msg error">${esc(err.message)}</li>`;
    stats.innerHTML = '';
  }
})();
