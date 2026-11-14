// Pantalla 1 · Mapa: globo 3D en deck.gl (GlobeView) con la imagen Blue Marble de la NASA (GIBS).
// Portada → globo → estado → condado → gemelos. Maneja sus propias rutas (ver README.md).
// Los valores marcados "Prototype data" (color de los condados, cifras del panel, gemelos) son
// inventados y vienen de globe-data.json; reemplazar por F08/F09 cuando estén.
import {Deck, _GlobeView as GlobeView, COORDINATE_SYSTEM} from '@deck.gl/core';
import {BitmapLayer, SolidPolygonLayer, GeoJsonLayer, ArcLayer, ScatterplotLayer} from '@deck.gl/layers';
import {TileLayer} from '@deck.gl/geo-layers';
import D from './globe-data.json';

let active = true;
/** MapLayer avisa si el mapa está a la vista; oculto no dibuja */
export function setMapActive(on) {
  active = on;
}

export function initGlobe() {
const COL = {night: '#0F2A1D', leaf: '#2F7D4F', glow: '#8ED081', cream: '#F6F1E4'}; // identidad
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const LEAF = hex(COL.leaf), GLOW = hex(COL.glow), CREAM = hex(COL.cream);
const WHITE = [255, 255, 255], OCEAN = [14, 46, 92];
const TILE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';
const NEXT_AVAILABLE = ['20191']; // condados con pantalla Next season
const POSTAL = {19: 'IA', 17: 'IL', 20: 'KS'};
const FIPS_OF = {IA: '19', IL: '17', KS: '20'};

const rad = Math.PI / 180, clamp01 = (x) => Math.max(0, Math.min(1, x));
const toFeature = (o) => ({type: 'Feature', id: o.id, properties: {name: o.name, state: o.state},
  geometry: o.geometry, centroid: o.centroid, bounds: o.bounds, mock: o.mock, _twins: o.twins});
const STATES = D.states.map(toFeature), COUNTIES = D.counties.map(toFeature);
const stateById = Object.fromEntries(STATES.map((f) => [f.id, f]));
const countyById = Object.fromEntries(COUNTIES.map((f) => [f.id, f]));
// Rampa del % de maíz: viridis (apta para daltonismo), de 0 % a 70 %+
const RAMP = [[0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]]];
function rampColor(v) {
  const t = clamp01(v / 0.7);
  for (let i = 1; i < RAMP.length; i++) if (t <= RAMP[i][0]) {
    const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i], u = (t - a) / (b - a);
    return ca.map((x, j) => Math.round(x + (cb[j] - x) * u));
  }
  return RAMP[RAMP.length - 1][1];
}
for (const c of COUNTIES) c.rgb = rampColor(c.mock.corn);
for (const c of COUNTIES) c.twins = c._twins.map((t) => ({f: countyById[t.id], similar: t.similar}));
const DEMO = D.demo, START = D.start, HOME = D.home;
const ARGENTINA = [{type: 'Feature', properties: {}, geometry: D.argentina}];
const COUNTY_K = 3.2;
const FAR = {lat: 8, k: 0.55}; // portada: el globo chico y lejos, girando detrás del velo

function angDist([a, b], [c, d]) { // distancia sobre la esfera, en radianes
  const s = Math.sin(((d - b) * rad) / 2) ** 2 + Math.cos(b * rad) * Math.cos(d * rad) * Math.sin(((c - a) * rad) / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(s)));
}
function dest([lon, lat], brg, d) {
  const p1 = lat * rad, l1 = lon * rad, t = brg * rad;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [l2 / rad, p2 / rad];
}

// ---- vista: R = {lon, lat, k}; k = 1 es el globo de inicio (radio = 43 % del lado corto)
const R0 = 512 / (2 * Math.PI);
let W = 0, H = 0, DPR = 1, base = 1;
const R = {lon: HOME.lon + 55, ...FAR};
const zoomOfK = (k) => Math.log2((base * k) / R0);
const kOfZoom = (z) => (R0 * 2 ** z) / base;
const K_MIN = 0.5, K_MAX = 70;

let V = null, level = 'globe', selState = null, selCounty = null, hover = null, twinMode = false, take = null;
let lastInput = performance.now(), spinV = 0, lastT = 0;
const SPIN_SPEED = 3; // grados por segundo cuando nadie toca el mapa
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const T0 = performance.now();
const $ = (id) => document.getElementById(id);
const isLanding = () => document.body.classList.contains('landing');

const sky = $('globe-sky'), hud = $('globe-hud');
const sctx = sky.getContext('2d'), hctx = hud.getContext('2d');
const STARS = Array.from({length: 520}, (_, i) => {
  const r = (n) => { const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); };
  const b = r(5);
  return {x: r(1), y: r(2), s: 0.3 + Math.pow(r(3), 3) * 1.4, p: r(4) * 6.28, b: 0.25 + b * b * 0.75};
});

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight; base = Math.min(W, H) * 0.43;
  for (const c of [sky, hud]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
}
window.addEventListener('resize', resize);

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function flyTo(to, dur = 1500) {
  let d = to.lon - R.lon; d = (((d + 180) % 360) + 360) % 360 - 180;
  V = {from: {...R}, to: {lon: R.lon + d, lat: to.lat, k: to.k}, start: performance.now(), dur};
}
const PANEL_HALF = 186; // medio panel lateral: el destino queda centrado en la parte visible del mapa
const panelOffset = (k, lat) => (W > 900 ? PANEL_HALF / (base * k) / rad / Math.cos(lat * rad) : 0);
// en el celular la hoja tapa la parte de abajo: subir el destino al centro de lo que queda visible
// (se mide la hoja ya llena, por eso updateUI() va antes del vuelo)
const sheetLift = (k) => (W <= 760 ? Math.max(0, $('panel').offsetHeight - 56) / 2 / (base * k) / rad : 0);
function fitK(f, t) {
  const [[x0, y0], [x1, y1]] = f.bounds, lat = (y0 + y1) / 2;
  const u = Math.abs(x1 - x0) * Math.cos(lat * rad) * rad, v = Math.abs(y1 - y0) * rad;
  return (Math.min(W, H) * t) / (Math.max(u, v) * base);
}
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(`fieldrewind:${name}`, {detail}));

function flyToState(id, move = true) {
  const s = stateById[id]; if (!s) return;
  selState = s; selCounty = null; twinMode = false; level = 'state';
  updateUI();
  if (move) { const k = fitK(s, W > 900 ? 0.62 : 0.7); flyTo({lon: s.centroid[0] + panelOffset(k, s.centroid[1]), lat: s.centroid[1] - sheetLift(k), k}, 1500); }
  emit('state', {fips: id, name: s.properties.name});
}
function flyToCounty(id, move = true, dur = 1500) {
  const c = countyById[id]; if (!c) return;
  selState = stateById[c.properties.state]; selCounty = c; twinMode = false; level = 'county';
  updateUI();
  if (move) {
    const k = Math.min(fitK(c, 0.3), 60);
    flyTo({lon: c.centroid[0] + panelOffset(k, c.centroid[1]), lat: c.centroid[1] - sheetLift(k), k}, dur);
  }
  emit('county', {fips: id, name: c.properties.name, state: selState.properties.name, hasHistory: !!DEMO[id]});
}
function reset() { selState = null; selCounty = null; twinMode = false; level = 'globe'; flyTo(HOME, 1400); updateUI(); }
function showTwins(on) {
  if (!selCounty) return;
  twinMode = on;
  if (on) flyTo({lon: -94.4 + (W > 900 ? 2.2 : 0), lat: 39.9, k: (Math.min(W, H) * 0.8) / (15.5 * rad * base)}, 1500);
  else flyToCounty(selCounty.id);
  updateUI();
}
/** Vuelve a la portada (logo + Start) */
const goHome = () => { location.hash = '#/'; };
function goBack() {
  if (twinMode) showTwins(false);
  else if (level === 'county') flyToState(selState.id);
  else if (level === 'state') reset();
  else goHome();
}

// ---- rutas: el mapa escribe en la URL dónde está, así el "atrás" del navegador funciona
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
function writeHash() {
  if (take || applyingHash || !active || isLanding()) return;
  const target = level === 'globe' ? '#/map' : level === 'state' ? `#/state/${POSTAL[selState.id]}` : `#/map/${selCounty.id}`;
  if (location.hash !== target) location.hash = target;
}
/** Portada → globo: el velo se desvanece y la cámara vuela a EE. UU. */
function leaveLanding() {
  if (!isLanding()) return;
  document.body.classList.remove('landing');
  flyTo(HOME, reduceMotion.matches ? 600 : 1900);
}
function applyHash() {
  if (take) return;
  const r = routeOf(location.hash);
  if (r.kind === 'other') return; // otra pantalla: el mapa queda oculto
  applyingHash = true;
  if (r.kind === 'home') {
    if (!isLanding()) {
      document.body.classList.add('landing');
      selState = null; selCounty = null; twinMode = false; level = 'globe';
      flyTo({lon: R.lon + 40, ...FAR}, reduceMotion.matches ? 600 : 1400);
      updateUI();
    }
  } else {
    leaveLanding();
    if (r.kind === 'globe') {
      if (level !== 'globe') reset();
    } else if (r.kind === 'state' && stateById[r.fips]) {
      if (!(level === 'state' && selState.id === r.fips)) flyToState(r.fips);
    } else if (r.kind === 'county' && countyById[r.fips]) {
      if (!(level === 'county' && selCounty.id === r.fips && !twinMode)) flyToCounty(r.fips);
    }
  }
  applyingHash = false;
}
window.addEventListener('hashchange', applyHash);

// ---- deck.gl
const markInput = () => { lastInput = performance.now(); spinV = 0; };
['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((e) =>
  window.addEventListener(e, markInput, {capture: true, passive: true}));
window.addEventListener('pointermove', (e) => { if (e.buttons) lastInput = performance.now(); }, {capture: true, passive: true});

const viewState = () => ({longitude: R.lon, latitude: R.lat, zoom: zoomOfK(R.k),
  minZoom: zoomOfK(K_MIN), maxZoom: zoomOfK(K_MAX)});
const CONTROLLER = {inertia: 400, scrollZoom: {speed: 0.01, smooth: true}, keyboard: false, dragRotate: false};

const deckgl = new Deck({
  parent: $('globe'),
  views: new GlobeView({id: 'globe', resolution: 5}),
  viewState: viewState(),
  controller: CONTROLLER,
  useDevicePixels: 2,
  onViewStateChange: ({viewState: vs, interactionState: is}) => {
    if (take || isLanding()) return;
    if (is && (is.isDragging || is.isZooming || is.isPanning || is.inTransition)) { V = null; lastInput = performance.now(); }
    R.lon = vs.longitude; R.lat = Math.max(-80, Math.min(80, vs.latitude)); R.k = kOfZoom(vs.zoom);
  },
  getCursor: ({isDragging, isHovering}) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'),
  onHover: (info) => { hover = info.object && !take ? {type: info.layer.id === 'counties' ? 'county' : 'state', f: info.object} : null; },
  onClick: (info) => {
    if (take || !info.object) return;
    if (info.layer.id === 'counties') flyToCounty(info.object.id);
    else flyToState(info.object.id);
  },
  onError: (e) => console.error('deck', e && e.stack),
  layers: [],
});

const memo = new Map();
const one = (key, obj) => { if (!obj) return []; const m = memo.get(key); if (m && m[0] === obj) return m; const a = [obj]; memo.set(key, a); return a; };

let viewport = null, LABELS = [];
function buildLayers(a) {
  const twinSet = twinMode && selCounty ? new Set(selCounty.twins.map((x) => x.f)) : null;
  const centre = [R.lon, R.lat], front = (p) => angDist(p, centre) < 1.45;
  const hoverState = hover && hover.type === 'state' ? hover.f : null;
  const hoverCounty = hover && hover.type === 'county' && hover.f !== selCounty ? hover.f : null;
  const stateFade = 1 - a * 0.85;
  const layers = [
    new SolidPolygonLayer({id: 'ocean', data: [[[-180, 90], [0, 90], [180, 90], [180, -90], [0, -90], [-180, -90]]],
      getPolygon: (d) => d, getFillColor: OCEAN, parameters: {depthWriteEnabled: false}}),
    new TileLayer({id: 'bluemarble', data: TILE_URL, minZoom: 0, maxZoom: 8, tileSize: 256, maxRequests: 12,
      onTileError: () => {},
      renderSubLayers: (props) => {
        const [[w, s], [e, n]] = props.tile.boundingBox;
        return new BitmapLayer(props, {data: null, image: props.data, bounds: [w, s, e, n],
          _imageCoordinateSystem: COORDINATE_SYSTEM.CARTESIAN});
      }}),
    // brillo fijo debajo de los estados con datos (no late: no es un dato en vivo)
    new GeoJsonLayer({id: 'states-glow', data: STATES, filled: false, stroked: true, lineWidthUnits: 'pixels',
      getLineWidth: 9, getLineColor: [...GLOW, Math.round(65 * stateFade)],
      updateTriggers: {getLineColor: [stateFade]}}),
    new GeoJsonLayer({id: 'states', data: STATES, filled: true, stroked: true, pickable: R.k <= COUNTY_K + 0.6,
      lineWidthUnits: 'pixels',
      getFillColor: (f) => {
        const dim = selState && selState !== f ? 0.45 : 1;
        const c = f === hoverState ? GLOW : LEAF;
        return [...c, Math.round(255 * dim * 0.56 * stateFade)];
      },
      getLineColor: (f) => [...GLOW, Math.round(255 * (selState && selState !== f ? 0.45 : 1))],
      getLineWidth: (f) => (f === selState || f === hoverState ? 2.4 : 1.5),
      updateTriggers: {getFillColor: [selState && selState.id, hoverState && hoverState.id, stateFade],
        getLineColor: [selState && selState.id], getLineWidth: [selState && selState.id, hoverState && hoverState.id]}}),
  ];
  if (a > 0.01) {
    layers.push(
      new GeoJsonLayer({id: 'counties', data: COUNTIES, opacity: a, filled: true, stroked: true,
        pickable: R.k > COUNTY_K + 0.6, lineWidthUnits: 'pixels', getLineWidth: 1, getLineColor: [...CREAM, 150],
        getFillColor: (f) => [...f.rgb, twinSet && f !== selCounty && !twinSet.has(f) ? 70 : 255],
        updateTriggers: {getFillColor: [twinMode, selCounty && selCounty.id]}}),
      new GeoJsonLayer({id: 'county-hover', data: one('hover', hoverCounty), filled: true, stroked: true,
        lineWidthUnits: 'pixels', getFillColor: [255, 255, 255, 64], getLineColor: CREAM, getLineWidth: 1.5}),
      new GeoJsonLayer({id: 'county-selected', data: one('sel', selCounty), filled: false, stroked: true,
        lineWidthUnits: 'pixels', getLineColor: WHITE, getLineWidth: 3.5}));
    if (twinSet) layers.push(
      new GeoJsonLayer({id: 'twin-outlines', data: one('twins', selCounty.twins.map((x) => x.f)), filled: false, stroked: true,
        lineWidthUnits: 'pixels', getLineColor: WHITE, getLineWidth: 2.5}),
      new ArcLayer({id: 'twin-arcs', data: selCounty.twins, getSourcePosition: () => selCounty.centroid,
        getTargetPosition: (d) => d.f.centroid, getSourceColor: WHITE, getTargetColor: [...WHITE, 200],
        getWidth: 2.6, widthUnits: 'pixels', getHeight: 0.35, greatCircle: false,
        updateTriggers: {getSourcePosition: selCounty.id}}),
      new ScatterplotLayer({id: 'twin-dots', data: selCounty.twins, getPosition: (d) => d.f.centroid,
        radiusUnits: 'pixels', getRadius: 5, getFillColor: WHITE}));
  }
  if (take === 'c') layers.push(new GeoJsonLayer({id: 'argentina', data: ARGENTINA, filled: false, stroked: true,
    lineWidthUnits: 'pixels', getLineWidth: 1.6, getLineColor: GLOW}));

  // los rótulos se dibujan en el canvas de arriba (sombra suave), ver drawLabels()
  LABELS = [];
  // los nombres de estado le ceden el lugar a los de condado: nunca se ven los dos
  if (R.k > 1.7 && a < 0.3) {
    const al = Math.min(1, R.k - 1.7) * clamp01(1 - a / 0.3), size = Math.min(26, 11 + R.k * 2);
    for (const s of STATES) if (front(s.centroid))
      LABELS.push({p: s.centroid, text: s.properties.name.toUpperCase(), size, alpha: al, caps: true});
  }
  if (a > 0.3) for (const id of Object.keys(DEMO)) {
    const c = countyById[id]; if (!front(c.centroid)) continue;
    LABELS.push({p: c.centroid, text: c.properties.name, size: R.k > 20 ? 20 : 15, alpha: clamp01((a - 0.3) / 0.3), county: c});
  }
  if (twinMode && selCounty) for (const x of [{f: selCounty}, ...selCounty.twins])
    if (!DEMO[x.f.id]) LABELS.push({p: x.f.centroid, text: x.f.properties.name, size: 15, alpha: 1, dy: -18});
  if (hoverCounty && !DEMO[hoverCounty.id] && front(hoverCounty.centroid))
    LABELS.push({p: hoverCounty.centroid, text: hoverCounty.properties.name, size: 13, alpha: 1});
  return layers;
}

function halfHeightPx(c) {
  if (!viewport) return 10;
  const [[x0, y0], [x1, y1]] = c.bounds;
  return Math.abs(viewport.project([x0, y0])[1] - viewport.project([x1, y1])[1]) / 2;
}
function globeRadiusPx() {
  if (!viewport || R.k > 8) return base * R.k;
  let best = 0;
  for (let d = 0.9; d <= 1.5708; d += 0.015) {
    const [x, y] = viewport.project(dest([R.lon, R.lat], 90, d));
    best = Math.max(best, Math.hypot(x - W / 2, y - H / 2));
  }
  return best;
}

function drawSky(t, u, r) {
  const c = sctx, cx = W / 2, cy = H / 2;
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.8);
  g.addColorStop(0, '#03070D'); g.addColorStop(1, '#000000');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  if (u > 0.02) {
    c.fillStyle = '#FFFFFF';
    for (const s of STARS) {
      c.globalAlpha = u * s.b * (0.7 + 0.3 * Math.sin(t * 0.9 + s.p));
      c.beginPath(); c.arc(s.x * W, s.y * H, s.s, 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
  }
  if (r < Math.max(W, H) * 1.2) { // borde fino de atmósfera
    const a = c.createRadialGradient(cx, cy, r * 0.985, cx, cy, r * 1.11);
    a.addColorStop(0, 'rgba(150,205,255,0.55)'); a.addColorStop(0.3, 'rgba(90,160,255,0.18)'); a.addColorStop(1, 'rgba(60,130,255,0)');
    c.fillStyle = a; c.beginPath(); c.arc(cx, cy, r * 1.11, 0, 6.2832); c.fill();
  }
}

function shadowText(c, text, x, y, fill) { // sombra oscura suave, dos pasadas para que se lea sobre la imagen
  c.shadowColor = 'rgba(0,0,0,0.9)'; c.shadowOffsetX = 0; c.shadowOffsetY = 1;
  c.fillStyle = fill; c.shadowBlur = 8; c.fillText(text, x, y); c.shadowBlur = 3; c.fillText(text, x, y);
  c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetY = 0;
}
function label(c, text, x, y, size, fill, weight = 700, family = 'DM Sans') {
  c.font = `${weight} ${size}px "${family}", system-ui, sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.letterSpacing = '0px';
  shadowText(c, text, x, y, fill);
}
function drawLabels(c) {
  for (const l of LABELS) {
    const [x, y] = viewport.project(l.p);
    const dy = l.county ? -(halfHeightPx(l.county) + 16) : l.dy || 0;
    c.globalAlpha = l.alpha;
    c.font = `700 ${l.size}px "DM Sans", system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.letterSpacing = l.caps ? `${(l.size * 0.08).toFixed(1)}px` : '0px';
    shadowText(c, l.text, x, y + dy, COL.cream);
  }
  c.globalAlpha = 1; c.letterSpacing = '0px';
}
function drawHud(u, r) {
  const c = hctx, cx = W / 2, cy = H / 2;
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
  if (u > 0.02) { // lado de noche: la luz viene de arriba a la izquierda
    const s = c.createRadialGradient(cx - r * 0.42, cy - r * 0.34, r * 0.2, cx - r * 0.42, cy - r * 0.34, r * 1.6);
    s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.5, 'rgba(0,0,0,0)');
    s.addColorStop(0.82, `rgba(0,2,8,${0.55 * u})`); s.addColorStop(1, `rgba(0,0,4,${0.88 * u})`);
    c.fillStyle = s; c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.fill();
  }
  if (!viewport) return;
  drawLabels(c);
  if (R.k <= 1.7 && !take && !isLanding() && angDist([-93.5, 40], [R.lon, R.lat]) < 1.45) { // rótulo con línea
    const [x, y] = viewport.project([-93.4, 40.6]), x2 = x + base * 0.3, y2 = y - base * 0.3;
    c.globalAlpha = Math.max(0, Math.min(1, 1.7 - R.k));
    c.beginPath(); c.moveTo(x, y); c.lineTo(x2 - 8, y2 + 8); c.strokeStyle = COL.glow; c.lineWidth = 1.5; c.stroke();
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.font = '700 15px "DM Sans", system-ui, sans-serif'; c.letterSpacing = '1.2px'; shadowText(c, 'IOWA · ILLINOIS · KANSAS', x2, y2 - 6, COL.glow);
    c.font = '500 13px "DM Sans", system-ui, sans-serif'; c.letterSpacing = '0px'; shadowText(c, 'Click a state to explore', x2, y2 + 13, 'rgba(246,241,228,0.85)');
    c.globalAlpha = 1;
  }
  if (take === 'c' && angDist([-64, -36], [R.lon, R.lat]) < 1.45) {
    const [x, y] = viewport.project([-64, -35]);
    c.globalAlpha = Math.max(0, Math.min(1, takeProgress() * 3 - 1.9));
    label(c, 'Next: Argentina', x + base * 0.02, y - 14, 30, COL.cream, 800, 'Bricolage Grotesque');
    label(c, 'as data is added', x + base * 0.02, y + 18, 18, COL.glow, 500);
    c.globalAlpha = 1;
  }
}

function frame(now) {
  try { if (active) step(now); else lastT = 0; } catch (e) { if (!frame.err) console.error('frame', e.stack); frame.err = 1; }
  requestAnimationFrame(frame);
}
function step(now) {
  const t = (now - T0) / 1000, dt = lastT ? Math.min(0.1, (now - lastT) / 1000) : 0; lastT = now;
  if (V) {
    lastInput = now; spinV = 0;
    const s = Math.min(1, (now - V.start) / V.dur), l = ease(s);
    R.lon = V.from.lon + (V.to.lon - V.from.lon) * l;
    R.lat = V.from.lat + (V.to.lat - V.from.lat) * l;
    R.k = Math.exp(Math.log(V.from.k) + (Math.log(V.to.k) - Math.log(V.from.k)) * l);
    if (s >= 1) V = null;
  } else { // giro: arranca 3 s después del último toque (en la portada, enseguida), entra suave y frena al tocar
    const idle = level === 'globe' && !take && !reduceMotion.matches && (isLanding() || now - lastInput > 3000);
    spinV += ((idle ? SPIN_SPEED : 0) - spinV) * (1 - Math.exp(-dt / (idle ? 1.2 : 0.25)));
    if (spinV > 0.001) R.lon = ((((R.lon - spinV * dt + 180) % 360) + 360) % 360) - 180;
  }
  const a = Math.round(clamp01((R.k - COUNTY_K) / 2) * 50) / 50;
  const u = clamp01(1.6 - R.k * 0.35);
  deckgl.setProps({viewState: viewState(), layers: buildLayers(a), controller: take || isLanding() ? false : CONTROLLER});
  if (deckgl.isInitialized) viewport = deckgl.getViewports()[0] || viewport;
  const r = globeRadiusPx();
  drawSky(t, u, r); drawHud(u, r);
}

// ---- panel, migas y botones
let rainUnit = 'in';
try { if (localStorage.getItem('fieldrewind:rain-unit') === 'mm') rainUnit = 'mm'; } catch (e) { /* sin almacenamiento */ }
const rainText = (mm) => (rainUnit === 'mm' ? `${Math.round(mm)} mm` : `${(mm / 25.4).toFixed(1)} in`);
function updateUI() {
  document.body.dataset.level = level;
  writeHash();
  $('back').textContent = twinMode ? '← Back to county' : level === 'county' ? `← Back to ${selState.properties.name}` : level === 'state' ? '← Back to globe' : '← Back';
  const crumbs = ['<button type="button" data-go="globe">Globe</button>'];
  if (selState) crumbs.push(`<button type="button" data-go="state">${selState.properties.name}</button>`);
  if (selCounty) crumbs.push(`<span>${selCounty.properties.name} County</span>`);
  $('crumbs').innerHTML = crumbs.join('<i>›</i>');
  const panel = $('panel'), pct = (n) => `${Math.round(n * 100)}%`;
  $('legend').hidden = level === 'globe';
  $('p-stats').hidden = !selCounty; $('p-twins').hidden = !selCounty; $('p-next').hidden = !selCounty;
  $('p-twinlist').hidden = !(selCounty && twinMode);
  if (selCounty) {
    const full = !!DEMO[selCounty.id], m = selCounty.mock;
    $('p-name').textContent = `${selCounty.properties.name} County`;
    $('p-state').textContent = `${selState.properties.name} · FIPS ${selCounty.id}`;
    $('p-status').textContent = full ? 'Full history · 2015–2025' : 'Missing data: history not loaded for this county yet';
    $('p-status').className = full ? 'ok' : 'missing';
    $('p-open').disabled = !full;
    $('p-open').textContent = full ? '▶ Rewind 2015–2025' : 'Open county history →';
    const hasNext = NEXT_AVAILABLE.includes(selCounty.id);
    $('p-next').disabled = !hasNext;
    $('p-next').textContent = hasNext ? 'Next season: what to plant →' : 'Next season: Missing data';
    $('p-stats').innerHTML = `<div class="proto"><span class="tag">Prototype data</span>Invented placeholder values</div><div class="stats"><div><b>${pct(m.corn)}</b><small>Corn share of cropland</small></div><div><b>${m.top}</b><small>Most common crop</small></div><div><b>${rainText(m.rain)}</b><small>Rain per year</small><span class="seg" role="group" aria-label="Rain units"><button type="button" data-unit="in" aria-pressed="${rainUnit === 'in'}">in</button><button type="button" data-unit="mm" aria-pressed="${rainUnit === 'mm'}">mm</button></span></div></div>`;
    $('p-twins').textContent = twinMode ? '← Back to county' : 'Counties like yours';
    $('p-twinlist').innerHTML = '<div class="proto"><span class="tag">Prototype data</span>Similar soil and climate</div><div class="twins">' + selCounty.twins.map((x) =>
      `<button type="button" data-fips="${x.f.id}"><b>${x.f.properties.name}, ${stateById[x.f.properties.state].properties.name}</b><small>Similar on ${x.similar.join(' and ')} · ${x.f.mock.top} on ${pct(x.f.mock.corn > 0.42 ? x.f.mock.corn : 0.3 + x.f.mock.soil * 0.2)} of fields</small></button>`).join('') + '</div>';
    panel.hidden = false;
  } else if (selState) {
    const n = COUNTIES.filter((c) => c.properties.state === selState.id).length;
    const demo = Object.keys(DEMO).find((id) => id.startsWith(selState.id));
    $('p-name').textContent = selState.properties.name;
    $('p-state').textContent = `${n} counties`;
    $('p-status').textContent = `Demo county: ${DEMO[demo]}`; $('p-status').className = 'ok';
    $('p-open').disabled = false; $('p-open').textContent = `Go to ${DEMO[demo]} County →`;
    panel.hidden = false;
  } else panel.hidden = true;
}
$('crumbs').addEventListener('click', (e) => {
  const go = e.target.dataset && e.target.dataset.go;
  if (go === 'globe') reset();
  if (go === 'state' && selState) flyToState(selState.id);
});
$('p-stats').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-unit]'); if (!b || b.dataset.unit === rainUnit) return;
  rainUnit = b.dataset.unit;
  try { localStorage.setItem('fieldrewind:rain-unit', rainUnit); } catch (err) { /* sin almacenamiento */ }
  updateUI();
  const again = $('p-stats').querySelector(`button[data-unit="${rainUnit}"]`); if (again) again.focus();
});
$('back').addEventListener('click', goBack);
$('home').addEventListener('click', goHome);
$('p-twins').addEventListener('click', () => showTwins(!twinMode));
$('p-twinlist').addEventListener('click', (e) => { const b = e.target.closest('button[data-fips]'); if (b) flyToCounty(b.dataset.fips); });
$('enter').addEventListener('click', () => { location.hash = '#/map'; });
// Botón de entrada: vuela directo al condado de demo y abre su panel en el mapa
$('cta').addEventListener('click', () => flyToCounty(START));
$('p-open').addEventListener('click', () => {
  if (selCounty) {
    emit('open', {fips: selCounty.id});
    location.hash = `#/county/${selCounty.id}?play=1`; // la historia arranca reproduciéndose
  } else if (selState) flyToCounty(Object.keys(DEMO).find((id) => id.startsWith(selState.id)));
});
$('p-next').addEventListener('click', () => {
  if (!selCounty) return;
  emit('next', {fips: selCounty.id, name: selCounty.properties.name, state: selState.properties.name});
  location.hash = `#/county/${selCounty.id}/next`;
});
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && active && !isLanding()) goBack(); });

// ---- tomas para el video (?take=a o ?take=c)
let takeStart = 0, takeDur = 1;
const takeProgress = () => Math.min(1, (performance.now() - takeStart) / takeDur);
function startTake(name) {
  take = name; document.body.classList.add('recording'); takeStart = performance.now();
  if (name === 'a') {
    takeDur = 6000; Object.assign(R, {lon: -20, lat: 22, k: 1});
    flyTo({lon: -96, lat: 37, k: 1.15}, 2000);
    setTimeout(() => flyToState('20'), 2000); setTimeout(() => flyToCounty('20191'), 3900);
  } else {
    takeDur = 3000; const ks = stateById['20'];
    Object.assign(R, {lon: ks.centroid[0], lat: ks.centroid[1], k: fitK(ks, 0.7)});
    flyTo({lon: -64, lat: -30, k: 1.25}, 2300);
  }
}

// ---- inicio
resize();
const takeParam = (new URLSearchParams(location.search).get('take') || (location.hash.match(/take-([ac])/) || [])[1] || '').toLowerCase();
if (takeParam === 'a' || takeParam === 'c') {
  document.body.classList.remove('landing');
  updateUI();
  startTake(takeParam);
} else {
  document.body.classList.add('landing');
  updateUI();
  applyHash(); // entrar directo a una vista (#/map, #/state/KS, #/map/20191)
}
requestAnimationFrame(frame);
window.FieldRewindGlobe = {flyToState, flyToCounty, showTwins, reset, goHome, view: () => ({...R, level})};
}
