'use strict';
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.API_KEY;
const API_BASE = (process.env.API_BASE_URL || 'https://v1.formula-1.api-sports.io').replace(/\/$/, '');
const SEASON = process.env.SEASON || '2023';
const CACHE_MS = 10 * 60 * 1000; // el plan gratuito tiene pocas peticiones diarias
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TEAMS = ['Red Bull Racing', 'Ferrari', 'Mercedes', 'McLaren', 'Aston Martin',
  'Alpine', 'Williams', 'AlphaTauri', 'Haas', 'Alfa Romeo'];

if (!API_KEY || API_KEY === 'tu_api_key_aqui') {
  console.warn('⚠️  API_KEY no configurada: define tu clave en el archivo .env');
}

const app = express();
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ['https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({ limit: '10kb' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }));

// ---------- Cliente de la API externa (la clave vive solo aquí) ----------
const cache = new Map();
async function f1(endpoint, params = {}) {
  if (!API_KEY || API_KEY === 'tu_api_key_aqui') {
    throw Object.assign(new Error('El servidor no tiene API_KEY configurada.'), { status: 500 });
  }
  const url = `${API_BASE}/${endpoint}?${new URLSearchParams(params)}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < CACHE_MS) return hit.data;

  const res = await fetch(url, { headers: { 'x-apisports-key': API_KEY } });
  if (!res.ok) throw Object.assign(new Error(`La API externa respondió ${res.status}.`), { status: 502 });
  const body = await res.json();
  const errs = body.errors ? Object.values(body.errors) : [];
  if (errs.length) throw Object.assign(new Error(`API externa: ${errs.join(' ')}`), { status: 502 });
  cache.set(url, { t: Date.now(), data: body.response });
  return body.response;
}

const getDrivers = async () => (await f1('rankings/drivers', { season: SEASON })).map(x => ({
  pos: x.position, name: x.driver?.name, number: x.driver?.number,
  team: x.team?.name, points: x.points ?? 0, wins: x.wins ?? 0
}));
const getTeams = async () => (await f1('rankings/teams', { season: SEASON })).map(x => ({
  pos: x.position, name: x.team?.name, points: x.points ?? 0
}));
const getRaces = async () => (await f1('races', { season: SEASON, type: 'race' }))
  .map(x => ({
    name: x.competition?.name, circuit: x.circuit?.name,
    city: x.competition?.location?.city, country: x.competition?.location?.country, date: x.date
  }))
  .sort((a, b) => new Date(a.date) - new Date(b.date))
  .map((r, i) => ({ round: i + 1, ...r }));

const wrap = fn => (req, res) => fn(req, res).catch(err => {
  console.error('[error]', err.message);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno del servidor.' });
});

// ---------- Endpoints de datos ----------
app.get('/api/drivers', wrap(async (req, res) => res.json({ season: SEASON, data: await getDrivers() })));
app.get('/api/teams', wrap(async (req, res) => res.json({ season: SEASON, data: await getTeams() })));
app.get('/api/races', wrap(async (req, res) => res.json({ season: SEASON, data: await getRaces() })));
app.get('/api/summary', wrap(async (req, res) => {
  const [drivers, teams, races] = await Promise.all([getDrivers(), getTeams(), getRaces()]);
  const past = races.filter(r => new Date(r.date) <= new Date());
  res.json({
    season: SEASON,
    topDrivers: drivers.slice(0, 5),
    leaderTeam: teams[0] || null,
    rounds: races.length,
    lastRace: past[past.length - 1] || null
  });
}));
app.get('/api/teams-list', (req, res) => res.json({ data: TEAMS }));

// ---------- Registro (validación también en el servidor) ----------
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const PASS_RE = /^(?=.*[A-Z])(?=.*\d).{8,64}$/;
const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ .-]{2,50}$/;
const clean = v => String(v ?? '').replace(/[<>"'`\u0000-\u001f]/g, '').trim();

const readUsers = () => { try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; } };

app.post('/api/register',
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }),
  wrap(async (req, res) => {
    const name = clean(req.body.name);
    const email = clean(req.body.email).toLowerCase();
    const password = String(req.body.password ?? '');
    const team = clean(req.body.team);
    const errors = {};
    if (!NAME_RE.test(name)) errors.name = 'Nombre inválido.';
    if (!EMAIL_RE.test(email)) errors.email = 'Correo inválido.';
    if (!PASS_RE.test(password)) errors.password = 'Contraseña débil.';
    if (!TEAMS.includes(team)) errors.team = 'Escudería no válida.';
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Datos inválidos.', errors });

    const users = readUsers();
    if (users.some(u => u.email === email)) return res.status(409).json({ error: 'Ese correo ya está registrado.' });

    users.push({ name, email, team, passwordHash: await bcrypt.hash(password, 10), createdAt: new Date().toISOString() });
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.status(201).json({ ok: true, user: { name, team } });
  }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`Apex F1 en http://localhost:${PORT}`));
