/**
 * Field Rewind — globo interactivo (pantalla 1: portada → globo → estado → condado)
 *
 * Canvas 2D + d3-geo (proyección ortográfica), sin WebGL ni tiles.
 * Lo monta src/map/MapLayer.tsx: initGlobe() una sola vez y setMapActive() al cambiar de pantalla.
 *
 * Rutas que maneja (las mismas del router de la app):
 *   #/            portada (logo + Start)
 *   #/map         globo
 *   #/state/KS    estado
 *   #/map/20191   condado elegido en el mapa (panel)
 * y manda a:  #/county/20191 (Historia, pantalla 2)  ·  #/county/20191/next (Next season, pantalla 3)
 * Grabación:  ?take=a (globo → Kansas → Sumner)   ?take=c (Kansas → la Pampa)
 *
 * DATOS DE PRUEBA: el color de los condados, las cifras del panel y los gemelos son inventados
 * (bloque "DATOS DE PRUEBA" más abajo) y se muestran con el sello "Prototype data".
 */
import {geoOrthographic, geoPath, geoGraticule10, geoCentroid, geoBounds, geoContains, geoDistance} from 'd3-geo';
import GEO from './geo.json';

let inited = false;
let active = true; // false mientras se ve otra pantalla (Historia, Next season…)

export function setMapActive(on) {
  active = on;
  document.body.classList.toggle('map-active', on);
}

export function initGlobe() {
  if (inited) return;
  inited = true;
  document.body.dataset.level = 'globe';
  document.body.classList.add('landing'); // arranca en la portada; applyHash() decide después

// ---------- Paleta de la app ----------
const C = {
  night: '#12281C',
  leaf: '#3C8C2D',
  glow: '#96DC6E',
  cream: '#F6F1E4',
};

// ---------- Configuración ----------
const FEATURED = {'19169': 'Story', '17113': 'McLean', '20191': 'Sumner'}; // condados con historia completa
const DEMO_COUNTY = '20191';
const NEXT_AVAILABLE = ['20191']; // condados con data/next/<fips>.json
const POSTAL = {'19': 'IA', '17': 'IL', '20': 'KS'};
const FIPS_OF = {IA: '19', IL: '17', KS: '20'};
const HOME = {lon: -93.5, lat: 36, k: 1};
const COUNTY_ZOOM_START = 3.2; // desde qué zoom se ven los condados

const states = GEO.states;
const counties = GEO.counties;
const stateById = Object.fromEntries(states.map((s) => [s.id, s]));
const countyById = Object.fromEntries(counties.map((c) => [c.id, c]));
for (const f of [...states, ...counties]) {
  f.centroid = geoCentroid(f);
  f.bounds = geoBounds(f);
}
const graticule = geoGraticule10();

// ---------- DATOS DE PRUEBA (inventados) ----------
// Todo lo que sale de acá se muestra con el sello "Prototype data".
// Reemplazar por los JSON reales: county.mock = {corn, rain, soil} y county.twins = [fips…].
const rnd = (seed) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
const clamp01 = (v) => Math.max(0, Math.min(1, v));
for (const c of counties) {
  const [lon, lat] = c.centroid;
  const id = +c.id;
  const west = Math.max(0, -89 - lon); // más al oeste = más seco = menos maíz
  c.mock = {
    corn: clamp01(0.6 - west * 0.036 - Math.max(0, 40 - lat) * 0.035 + (rnd(id) - 0.5) * 0.18), // % de superficie con maíz
    rain: Math.round(1010 - west * 42 + (rnd(id + 7) - 0.5) * 90), // mm por año
    soil: clamp01(0.45 + (rnd(id + 13) - 0.5) * 0.7), // índice de suelo 0..1
  };
  c.mock.top = c.mock.corn > 0.42 ? 'Corn' : c.mock.corn > 0.27 ? 'Soybeans' : 'Wheat';
}
const TRAITS = ['soil type', 'July rainfall', 'growing season', 'soil moisture'];
for (const c of counties) {
  // gemelos de prueba: el más parecido de cada estado (lejos del condado) + el siguiente mejor
  const ranked = counties
    .filter((o) => o !== c && geoDistance(o.centroid, c.centroid) > 0.035)
    .map((o) => ({o, d: Math.abs(o.mock.soil - c.mock.soil) + Math.abs(o.mock.rain - c.mock.rain) / 2500 + rnd(+o.id + +c.id) * 0.02}))
    .sort((x, y) => x.d - y.d);
  const picks = ['19', '17', '20'].map((st) => ranked.find((r) => r.o.properties.state === st).o);
  picks.push(ranked.find((r) => !picks.includes(r.o) && picks.every((q) => geoDistance(q.centroid, r.o.centroid) > 0.03)).o);
  c.twins = picks.map((o, i) => ({f: o, similar: [TRAITS[(+c.id + i) % 4], TRAITS[(+c.id + i + 1) % 4]]}));
}

// Escala de color del mapa (clara → oscura, apta para daltonismo): % de maíz
const RAMP = [
  // amarillo → naranja → marrón: contrasta con el azul del mapa y no se confunde con el verde de la marca
  [0.0, [255, 247, 188]],
  [0.25, [254, 217, 118]],
  [0.5, [254, 153, 41]],
  [0.75, [204, 76, 2]],
  [1.0, [102, 37, 6]],
];
const CORN_MAX = 0.7;
function ramp(v) {
  const t = clamp01(v / CORN_MAX);
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [t0, a] = RAMP[i - 1];
      const [t1, b] = RAMP[i];
      const u = (t - t0) / (t1 - t0);
      return a.map((n, j) => Math.round(n + (b[j] - n) * u));
    }
  }
  return RAMP[RAMP.length - 1][1];
}
for (const c of counties) c.rgb = ramp(c.mock.corn).join(',');

// ---------- Canvas ----------
const canvas = document.getElementById('globe');
const ctx = canvas.getContext('2d');
const projection = geoOrthographic().clipAngle(90).precision(0.3);
const path = geoPath(projection, ctx);
let W = 0;
let H = 0;
let R0 = 0; // radio del globo con k = 1
let dpr = 1;

const view = {...HOME, lon: -30}; // lon/lat del centro + zoom k
let anim = null;
let level = 'globe'; // globe | state | county
let selState = null;
let selCounty = null;
let hover = null; // {type:'state'|'county', f}
let userMoved = false;
let recording = null;
let twinsOn = false; // arcos hacia condados gemelos
const t0 = performance.now();

const stars = Array.from({length: 240}, (_, i) => {
  const r = (n) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  return {x: r(1), y: r(2), s: 0.4 + r(3) * 1.3, p: r(4) * 6.28};
});

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  R0 = Math.min(W, H) * 0.37;
}
window.addEventListener('resize', resize);

// ---------- Cámara ----------
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function flyTo(target, dur = 1500) {
  let dLon = target.lon - view.lon;
  dLon = ((((dLon + 180) % 360) + 360) % 360) - 180; // camino más corto
  anim = {from: {...view}, to: {lon: view.lon + dLon, lat: target.lat, k: target.k}, start: performance.now(), dur};
}

/** Zoom para que una forma entre en pantalla ocupando `fill` del lado menor */
function zoomFor(f, fill) {
  const [[w, s], [e, n]] = f.bounds;
  const lat = (s + n) / 2;
  const dx = (Math.abs(e - w) * Math.cos((lat * Math.PI) / 180) * Math.PI) / 180;
  const dy = (Math.abs(n - s) * Math.PI) / 180;
  return (Math.min(W, H) * fill) / (Math.max(dx, dy) * R0);
}

function applyProjection() {
  projection
    .translate([W / 2, H / 2 + (level === 'globe' && view.k < 1.6 ? H * 0.02 : 0)])
    .scale(R0 * view.k)
    .rotate([-view.lon, -view.lat]);
}

// ---------- Navegación ----------
function emit(name, detail) {
  window.dispatchEvent(new CustomEvent(`fieldrewind:${name}`, {detail}));
}

function selectState(fips, fly = true) {
  const s = stateById[fips];
  if (!s) return;
  selState = s;
  selCounty = null;
  twinsOn = false;
  level = 'state';
  if (fly) flyTo({lon: s.centroid[0], lat: s.centroid[1], k: zoomFor(s, 0.7)}, 1500);
  emit('state', {fips, name: s.properties.name});
  syncUI();
}

function selectCounty(fips, fly = true) {
  const c = countyById[fips];
  if (!c) return;
  selState = stateById[c.properties.state];
  selCounty = c;
  twinsOn = false;
  level = 'county';
  if (fly) {
    // el condado queda un poco a la izquierda para dejarle lugar al panel
    const k = Math.min(zoomFor(c, 0.3), 60);
    const shift = W > 900 ? ((W * 0.12) / (R0 * k)) * (180 / Math.PI) : 0;
    flyTo({lon: c.centroid[0] + shift / Math.cos((c.centroid[1] * Math.PI) / 180), lat: c.centroid[1], k}, 1500);
  }
  emit('county', {fips, name: c.properties.name, state: selState.properties.name, hasHistory: !!FEATURED[fips]});
  syncUI();
}

function reset() {
  selState = null;
  selCounty = null;
  twinsOn = false;
  level = 'globe';
  flyTo(HOME, 1400);
  syncUI();
}

function showTwins(on) {
  if (!selCounty) return;
  twinsOn = on;
  if (on) {
    // alejar la cámara para que entren los 3 estados
    const k = (Math.min(W, H) * 0.8) / (((15.5 * Math.PI) / 180) * R0);
    flyTo({lon: -94.4 + (W > 900 ? 2.2 : 0), lat: 39.9, k}, 1500);
  } else {
    selectCounty(selCounty.id);
  }
  syncUI();
}

/** Vuelve a la portada (logo + Start) */
function goHome() {
  location.hash = '#/';
}

// ---------- Rutas ----------
let applyingHash = false;

function routeOf(hash) {
  const h = hash.replace(/^#/, '').split('?')[0] || '/';
  let m;
  if (h === '/') return {kind: 'home'};
  if (h === '/map') return {kind: 'globe'};
  if ((m = h.match(/^\/map\/(\d{5})$/))) return {kind: 'county', fips: m[1]};
  if ((m = h.match(/^\/state\/([A-Za-z]{2})$/))) return {kind: 'state', fips: FIPS_OF[m[1].toUpperCase()]};
  return {kind: 'other'};
}

/** El mapa escribe en la URL dónde está, así "atrás" del navegador funciona */
function writeHash() {
  if (recording || applyingHash || !active || document.body.classList.contains('landing')) return;
  const target = level === 'globe' ? '#/map' : level === 'state' ? `#/state/${POSTAL[selState.id]}` : `#/map/${selCounty.id}`;
  if (location.hash !== target) location.hash = target;
}

/** Transición suave portada → globo: la portada se desvanece y el globo llega desde lejos */
function leaveLanding() {
  if (!document.body.classList.contains('landing')) return;
  document.body.classList.remove('landing');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  Object.assign(view, {lon: HOME.lon + 55, lat: 8, k: 0.55});
  flyTo(HOME, reduce ? 600 : 3000);
}

function applyHash() {
  if (recording) return;
  const r = routeOf(location.hash);
  if (r.kind === 'other') return; // otra pantalla: el mapa queda oculto
  applyingHash = true;
  if (r.kind === 'home') {
    if (!document.body.classList.contains('landing')) {
      document.body.classList.add('landing');
      selState = null;
      selCounty = null;
      twinsOn = false;
      level = 'globe';
      syncUI();
    }
  } else {
    leaveLanding();
    if (r.kind === 'globe') {
      if (level !== 'globe') reset();
    } else if (r.kind === 'state' && stateById[r.fips]) {
      if (!(level === 'state' && selState.id === r.fips)) selectState(r.fips);
    } else if (r.kind === 'county' && countyById[r.fips]) {
      if (!(level === 'county' && selCounty.id === r.fips && !twinsOn)) selectCounty(r.fips);
    }
  }
  applyingHash = false;
}
window.addEventListener('hashchange', applyHash);

function back() {
  if (twinsOn) showTwins(false);
  else if (level === 'county') selectState(selState.id);
  else if (level === 'state') reset();
  else goHome();
}

// ---------- Dibujo ----------
function draw(now) {
  if (!active) {
    requestAnimationFrame(draw);
    return;
  }
  const t = (now - t0) / 1000;

  if (anim) {
    const p = Math.min(1, (now - anim.start) / anim.dur);
    const e = ease(p);
    view.lon = anim.from.lon + (anim.to.lon - anim.from.lon) * e;
    view.lat = anim.from.lat + (anim.to.lat - anim.from.lat) * e;
    view.k = Math.exp(Math.log(anim.from.k) + (Math.log(anim.to.k) - Math.log(anim.from.k)) * e);
    if (p >= 1) anim = null;
  } else if (level === 'globe' && !userMoved && !recording) {
    view.lon = HOME.lon + Math.sin(t * 0.22) * 16; // vaivén lento: los 3 estados nunca se pierden de vista
  }
  applyProjection();

  const R = R0 * view.k;
  const [cx, cy] = projection.translate();
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  const countyAlpha = Math.max(0, Math.min(1, (view.k - COUNTY_ZOOM_START) / 2));
  const far = Math.max(0, Math.min(1, 1.6 - view.k * 0.35)); // 1 = vista de globo

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // fondo + estrellas
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.8);
  bg.addColorStop(0, '#0E2440');
  bg.addColorStop(1, '#050D18');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (far > 0.02) {
    ctx.fillStyle = C.cream;
    for (const s of stars) {
      ctx.globalAlpha = far * (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + s.p)));
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.s, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // atmósfera (glow)
  if (R < Math.max(W, H) * 1.2) {
    const g = ctx.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.32);
    g.addColorStop(0, 'rgba(110,190,255,0.60)');
    g.addColorStop(0.25, 'rgba(110,190,255,0.22)');
    g.addColorStop(1, 'rgba(110,190,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.32, 0, 6.2832);
    ctx.fill();
  }

  // océano
  const ocean = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
  ocean.addColorStop(0, '#1F5C99');
  ocean.addColorStop(1, '#0A2140');
  ctx.fillStyle = ocean;
  ctx.beginPath();
  path({type: 'Sphere'});
  ctx.fill();

  ctx.lineJoin = 'round';
  ctx.beginPath();
  path(graticule);
  ctx.strokeStyle = 'rgba(170,215,255,0.10)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // tierra
  ctx.beginPath();
  path(GEO.land);
  ctx.fillStyle = '#3D7BB5'; // tierra sin datos: azul, para que lo verde sea solo lo que tiene datos
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,230,255,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  path(GEO.borders);
  ctx.strokeStyle = 'rgba(200,230,255,0.16)';
  ctx.stroke();
  if (view.k > 1.4) {
    ctx.beginPath();
    path(GEO.stateMesh);
    ctx.strokeStyle = `rgba(200,230,255,${0.28 * Math.min(1, view.k - 1.4)})`;
    ctx.stroke();
  }

  // Argentina: solo contorno, como idea de expansión (toma C). No hay datos argentinos.
  if (recording === 'c') {
    ctx.beginPath();
    path(GEO.argentina);
    ctx.strokeStyle = C.glow;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // los 3 estados encendidos, con latido
  for (const s of states) {
    const isSel = selState === s;
    const isHover = hover && hover.type === 'state' && hover.f === s;
    const dim = selState && !isSel ? 0.45 : 1;
    ctx.beginPath();
    path(s);
    ctx.shadowColor = C.glow;
    ctx.shadowBlur = (10 + 16 * pulse) * (countyAlpha > 0.5 ? 0.3 : 1) * dim;
    ctx.fillStyle = isHover ? '#55A83F' : C.leaf;
    ctx.globalAlpha = dim * (0.82 + 0.18 * pulse);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = dim;
    ctx.strokeStyle = C.glow;
    ctx.lineWidth = isSel || isHover ? 2.4 : 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // condados pintados por % de maíz (DATOS DE PRUEBA)
  if (countyAlpha > 0.01) {
    const twinSet = twinsOn && selCounty ? new Set(selCounty.twins.map((t) => t.f)) : null;
    for (const c of counties) {
      const dimmed = twinSet && c !== selCounty && !twinSet.has(c);
      ctx.beginPath();
      path(c);
      ctx.fillStyle = `rgba(${c.rgb},${countyAlpha * (dimmed ? 0.35 : 1)})`;
      ctx.fill();
    }
    ctx.beginPath();
    for (const c of counties) path(c);
    ctx.strokeStyle = `rgba(60,30,10,${0.5 * countyAlpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (hover && hover.type === 'county' && hover.f !== selCounty) {
      ctx.beginPath();
      path(hover.f);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (twinSet) drawTwins(t);
    if (selCounty) {
      ctx.beginPath();
      path(selCounty);
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // sombra del borde: le da volumen a la esfera
  if (far > 0.02) {
    const limb = ctx.createRadialGradient(cx, cy, R * 0.55, cx, cy, R);
    limb.addColorStop(0, 'rgba(0,0,0,0)');
    limb.addColorStop(1, `rgba(2,8,20,${0.6 * far})`);
    ctx.fillStyle = limb;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 6.2832);
    ctx.fill();
  }

  drawLabels(pulse, countyAlpha);
  requestAnimationFrame(draw);
}

/** Arcos brillantes del condado elegido hacia sus gemelos */
function drawTwins(t) {
  for (const tw of selCounty.twins) {
    const a = projection(selCounty.centroid);
    const b = projection(tw.f.centroid);
    if (!a || !b) continue;
    // curva levantada: punto de control perpendicular a la línea
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const cxp = mx + ((b[1] - a[1]) / len) * len * 0.22 * (b[0] > a[0] ? 1 : -1);
    const cyp = my - Math.abs(((b[0] - a[0]) / len) * len * 0.22) - len * 0.08;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(cxp, cyp, b[0], b[1]);
    ctx.shadowColor = '#FFFFFF';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -t * 26;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    path(tw.f);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b[0], b[1], 5, 0, 6.2832);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }
}

function visible(lonlat) {
  return geoDistance(lonlat, [view.lon, view.lat]) < 1.45;
}

function label(text, x, y, size, color, weight = 700, font = 'DM Sans') {
  ctx.font = `${weight} ${size}px "${font}", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size * 0.28);
  ctx.strokeStyle = 'rgba(8,20,30,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawLabels(pulse, countyAlpha) {
  // nombres de los estados
  if (view.k > 1.7 && countyAlpha < 0.9) {
    for (const s of states) {
      if (!visible(s.centroid)) continue;
      const [x, y] = projection(s.centroid);
      ctx.globalAlpha = Math.min(1, view.k - 1.7) * (1 - countyAlpha * 0.6);
      label(s.properties.name.toUpperCase(), x, y, Math.min(26, 11 + view.k * 2), C.cream, 700);
    }
    ctx.globalAlpha = 1;
  } else if (view.k <= 1.7 && !recording && visible([-93.5, 40])) {
    // en la vista de globo: un solo rótulo con línea
    const [x, y] = projection([-93.4, 40.6]);
    const lx = x + R0 * 0.3;
    const ly = y - R0 * 0.3;
    ctx.globalAlpha = Math.max(0, 1.7 - view.k);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(lx - 8, ly + 8);
    ctx.strokeStyle = C.glow;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = '700 15px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = C.glow;
    ctx.fillText('IOWA · ILLINOIS · KANSAS', lx, ly - 6);
    ctx.font = '500 13px "DM Sans", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(246,241,228,0.75)';
    ctx.fillText('Click a state to explore', lx, ly + 13);
    ctx.globalAlpha = 1;
  }

  // condados con historia completa: anillo + nombre
  if (countyAlpha > 0.3) {
    for (const id of Object.keys(FEATURED)) {
      const c = countyById[id];
      if (!visible(c.centroid)) continue;
      const [x, y] = projection(c.centroid);
      ctx.globalAlpha = countyAlpha;
      if (c !== selCounty) {
        ctx.beginPath();
        ctx.arc(x, y, 9 + 9 * pulse, 0, 6.2832);
        ctx.strokeStyle = `rgba(246,241,228,${0.9 - 0.7 * pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const half = (Math.abs(projection([c.bounds[0][0], c.bounds[0][1]])[1] - projection([c.bounds[1][0], c.bounds[1][1]])[1])) / 2;
      label(c.properties.name, x, y - half - 16, view.k > 20 ? 22 : 15, C.cream, 800, 'Bricolage Grotesque');
      ctx.globalAlpha = 1;
    }
  }
  if (twinsOn && selCounty) {
    for (const tw of [{f: selCounty}, ...selCounty.twins]) {
      if (FEATURED[tw.f.id]) continue;
      const [x, y] = projection(tw.f.centroid);
      label(tw.f.properties.name, x, y - 18, 15, C.cream, 800, 'Bricolage Grotesque');
    }
  }
  if (hover && hover.type === 'county' && !FEATURED[hover.f.id] && visible(hover.f.centroid)) {
    const [x, y] = projection(hover.f.centroid);
    label(hover.f.properties.name, x, y, 13, C.cream, 700);
  }

  // toma C: rótulo de expansión
  if (recording === 'c' && visible([-64, -36])) {
    const [x, y] = projection([-64, -35]);
    ctx.globalAlpha = Math.max(0, Math.min(1, recordingProgress() * 3 - 1.9));
    label('Next: Argentina', x + R0 * 0.02, y - 14, 30, C.cream, 800, 'Bricolage Grotesque');
    label('as data is added', x + R0 * 0.02, y + 18, 18, C.glow, 500);
    ctx.globalAlpha = 1;
  }
}

// ---------- Interacción ----------
function inBounds(f, [lon, lat]) {
  const [[w, s], [e, n]] = f.bounds;
  return lon >= w && lon <= e && lat >= s && lat <= n;
}

function pick(x, y) {
  const [cx, cy] = projection.translate();
  if (Math.hypot(x - cx, y - cy) > R0 * view.k) return null;
  const ll = projection.invert([x, y]);
  if (!ll) return null;
  if (view.k > COUNTY_ZOOM_START + 0.6) {
    for (const c of counties) if (inBounds(c, ll) && geoContains(c, ll)) return {type: 'county', f: c};
  }
  for (const s of states) if (inBounds(s, ll) && geoContains(s, ll)) return {type: 'state', f: s};
  return null;
}

let drag = null;
const pointers = new Map();
let pinch = null;

canvas.addEventListener('pointerdown', (e) => {
  if (recording) return;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k};
    drag = null;
  } else {
    drag = {x: e.clientX, y: e.clientY, lon: view.lon, lat: view.lat, moved: 0};
  }
  anim = null;
});

canvas.addEventListener('pointermove', (e) => {
  if (recording) return;
  const rect = canvas.getBoundingClientRect();
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    view.k = clampZoom((pinch.k * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d);
    userMoved = true;
    return;
  }
  if (drag) {
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    if (drag.moved > 4) {
      const deg = 180 / Math.PI / (R0 * view.k);
      view.lon = drag.lon - (dx * deg) / Math.max(0.3, Math.cos((view.lat * Math.PI) / 180));
      view.lat = Math.max(-80, Math.min(80, drag.lat + dy * deg));
      userMoved = true;
      canvas.style.cursor = 'grabbing';
    }
    return;
  }
  hover = pick(e.clientX - rect.left, e.clientY - rect.top);
  canvas.style.cursor = hover ? 'pointer' : 'grab';
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (!drag) return;
  const wasClick = drag.moved <= 4;
  drag = null;
  canvas.style.cursor = 'grab';
  if (!wasClick || recording) return;
  const rect = canvas.getBoundingClientRect();
  const hit = pick(e.clientX - rect.left, e.clientY - rect.top);
  if (!hit) return;
  if (hit.type === 'state') selectState(hit.f.id);
  else selectCounty(hit.f.id);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => {
  hover = null;
});

const clampZoom = (k) => Math.max(0.75, Math.min(70, k));
canvas.addEventListener(
  'wheel',
  (e) => {
    if (recording) return;
    e.preventDefault();
    anim = null;
    userMoved = true;
    view.k = clampZoom(view.k * Math.exp(-e.deltaY * 0.0016));
  },
  {passive: false},
);

// ---------- Interfaz ----------
const $ = (id) => document.getElementById(id);

function syncUI() {
  document.body.dataset.level = level;
  writeHash();
  $('back').textContent = twinsOn ? '← Back to county' : level === 'county' ? `← Back to ${selState.properties.name}` : level === 'state' ? '← Back to globe' : '← Home';
  const crumbs = ['<button data-go="globe">Globe</button>'];
  if (selState) crumbs.push(`<button data-go="state">${selState.properties.name}</button>`);
  if (selCounty) crumbs.push(`<span>${selCounty.properties.name} County</span>`);
  $('crumbs').innerHTML = crumbs.join('<i>›</i>');

  const panel = $('panel');
  const pct = (v) => `${Math.round(v * 100)}%`;
  $('legend').hidden = level === 'globe';
  $('p-stats').hidden = !selCounty;
  $('p-twins').hidden = !selCounty;
  $('p-next').hidden = !selCounty;
  $('p-twinlist').hidden = !(selCounty && twinsOn);
  if (selCounty) {
    const has = !!FEATURED[selCounty.id];
    const m = selCounty.mock;
    $('p-name').textContent = `${selCounty.properties.name} County`;
    $('p-state').textContent = `${selState.properties.name} · FIPS ${selCounty.id}`;
    $('p-status').textContent = has ? 'Full history available · 2015–2025' : 'History not loaded for this county yet';
    $('p-status').className = has ? 'ok' : 'missing';
    $('p-open').disabled = !has;
    $('p-open').textContent = has ? '▶ Rewind 2015–2025' : 'Missing data';
    $('p-stats').innerHTML =
      `<span class="stamp">Prototype data</span>` +
      `<div><b>${pct(m.corn)}</b><small>Corn share of cropland</small></div>` +
      `<div><b>${m.top}</b><small>Most common crop</small></div>` +
      `<div><b>${m.rain} mm</b><small>Rain per year</small></div>`;
    $('p-twins').textContent = twinsOn ? '← Back to county' : 'Counties like yours';
    const hasNext = NEXT_AVAILABLE.includes(selCounty.id);
    $('p-next').disabled = !hasNext;
    $('p-next').textContent = hasNext ? 'Next season: what to plant →' : 'Next season: Missing data';
    $('p-twinlist').innerHTML =
      `<span class="stamp">Prototype data</span>` +
      selCounty.twins
        .map(
          (tw) =>
            `<button data-fips="${tw.f.id}"><b>${tw.f.properties.name}, ${stateById[tw.f.properties.state].properties.name}</b>` +
            `<small>Similar on ${tw.similar.join(' and ')} · ${tw.f.mock.top} on ${pct(tw.f.mock.corn > 0.42 ? tw.f.mock.corn : 0.3 + tw.f.mock.soil * 0.2)} of fields</small></button>`,
        )
        .join('');
    panel.hidden = false;
  } else if (selState) {
    const n = counties.filter((c) => c.properties.state === selState.id).length;
    const feat = Object.keys(FEATURED).find((id) => id.startsWith(selState.id));
    $('p-name').textContent = selState.properties.name;
    $('p-state').textContent = `${n} counties`;
    $('p-status').textContent = `Demo county: ${FEATURED[feat]}`;
    $('p-status').className = 'ok';
    $('p-open').disabled = false;
    $('p-open').textContent = `Go to ${FEATURED[feat]} County →`;
    panel.hidden = false;
  } else {
    panel.hidden = true;
  }
}

$('crumbs').addEventListener('click', (e) => {
  const go = e.target.dataset && e.target.dataset.go;
  if (go === 'globe') reset();
  if (go === 'state' && selState) selectState(selState.id);
});
$('back').addEventListener('click', back);
$('home').addEventListener('click', goHome);
$('p-twins').addEventListener('click', () => showTwins(!twinsOn));
$('p-next').addEventListener('click', () => {
  if (!selCounty) return;
  emit('next', {fips: selCounty.id, name: selCounty.properties.name, state: selState.properties.name});
  location.hash = `#/county/${selCounty.id}/next`;
});
$('p-twinlist').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-fips]');
  if (btn) selectCounty(btn.dataset.fips);
});
$('enter').addEventListener('click', () => {
  location.hash = '#/map';
});
// Botón de entrada: vuela directo al condado de demo y abre su panel en el mapa
$('cta').addEventListener('click', () => selectCounty(DEMO_COUNTY));
$('p-open').addEventListener('click', () => {
  if (selCounty) {
    emit('open', {fips: selCounty.id});
    location.hash = `#/county/${selCounty.id}?play=1`; // la historia arranca reproduciéndose
  } else if (selState) {
    selectCounty(Object.keys(FEATURED).find((id) => id.startsWith(selState.id)));
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && active && !document.body.classList.contains('landing')) back();
});

// ---------- Modos de grabación ----------
let recStart = 0;
let recDur = 1;
const recordingProgress = () => Math.min(1, (performance.now() - recStart) / recDur);

function startTake(which) {
  recording = which;
  document.body.classList.add('recording');
  recStart = performance.now();
  if (which === 'a') {
    // Toma A (6 s): globo → Kansas → Sumner
    recDur = 6000;
    Object.assign(view, {lon: -20, lat: 22, k: 1});
    flyTo({lon: -96, lat: 37, k: 1.15}, 2000);
    setTimeout(() => selectState('20'), 2000);
    setTimeout(() => selectCounty('20191'), 3900);
  } else {
    // Toma C (3 s): desde Kansas, zoom out y giro a la Pampa
    recDur = 3000;
    const ks = stateById['20'];
    Object.assign(view, {lon: ks.centroid[0], lat: ks.centroid[1], k: zoomFor(ks, 0.7)});
    flyTo({lon: -64, lat: -30, k: 1.25}, 2300);
  }
}

// ---------- Inicio ----------
resize();
syncUI();
const take = (new URLSearchParams(location.search).get('take') || (location.hash.match(/take-([ac])/) || [])[1] || '').toLowerCase();
if (take === 'a' || take === 'c') {
  document.body.classList.remove('landing');
  startTake(take);
} else {
  document.body.classList.add('landing');
  applyHash(); // entrar directo a una vista (#/map, #/state/KS, #/map/20191)
}
requestAnimationFrame(draw);

window.FieldRewindGlobe = {flyToState: selectState, flyToCounty: selectCounty, showTwins, reset, goHome};
}
