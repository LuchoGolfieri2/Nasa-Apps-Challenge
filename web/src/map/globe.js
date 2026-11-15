// Pantalla 1 · Mapa: globo 3D en deck.gl (GlobeView) con la imagen Blue Marble de la NASA (GIBS).
// Portada → globo → estado → condado (tarjeta al lado del condado). Maneja sus propias rutas (ver README.md).
// El color de los condados y el número de la tarjeta son reales: rinde de maíz del USDA NASS, media
// 2021–2025 ("stat" en globe-data.json, lo escribe scripts/build_front_data.py). Sin dato: "Missing data".
import {Deck, _GlobeView as GlobeView, COORDINATE_SYSTEM} from '@deck.gl/core';
import {BitmapLayer, SolidPolygonLayer, GeoJsonLayer} from '@deck.gl/layers';
import {TileLayer} from '@deck.gl/geo-layers';
import D from './globe-data.json';
import NEXT_LIST from './next-available.json'; // lo genera scripts/build_next_json.py

let active = true, onActive = null;
/** MapLayer avisa si el mapa está a la vista; oculto no dibuja */
export function setMapActive(on) {
  active = on;
  if (onActive) onActive(on);
}

export function initGlobe() {
const COL = {night: '#0F2A1D', leaf: '#2F7D4F', glow: '#8ED081', cream: '#F6F1E4'}; // identidad
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const LEAF = hex(COL.leaf), GLOW = hex(COL.glow), CREAM = hex(COL.cream), NIGHT = hex(COL.night);
const WHITE = [255, 255, 255], OCEAN = [14, 46, 92];
const TILE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';
const NEXT_AVAILABLE = NEXT_LIST; // condados con datos del modelo para la pantalla Next season
const POSTAL = {19: 'IA', 17: 'IL', 18: 'IN', 20: 'KS'};
const FIPS_OF = {IA: '19', IL: '17', IN: '18', KS: '20'};
// Estados sin salidas del modelo de rinde (hoy Kansas): se siguen mostrando, con el aviso escrito.
const hasModel = (stateId) => NEXT_AVAILABLE.some((id) => id.startsWith(stateId));
const NO_MODEL = 'Missing data: no yield model for this state yet';

const rad = Math.PI / 180, clamp01 = (x) => Math.max(0, Math.min(1, x));
const toFeature = (o) => ({type: 'Feature', id: o.id, properties: {name: o.name, state: o.state},
  geometry: o.geometry, centroid: o.centroid, bounds: o.bounds, stat: o.stat || {}});
// En el globo un tramo recto entre dos vértices es una cuerda: si es largo, corta camino y se despega del
// paralelo (el borde sur de Kansas mide casi 3°). Se le agregan vértices cada STEP° para que el borde del
// estado coincida con los bordes de sus condados.
const STEP = 0.25;
const densifyRing = (ring) => ring.flatMap((p, i) => {
  if (!i) return [p];
  const q = ring[i - 1], n = Math.ceil(Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1])) / STEP);
  return Array.from({length: n}, (_, j) => (j === n - 1 ? p : [q[0] + (p[0] - q[0]) * (j + 1) / n, q[1] + (p[1] - q[1]) * (j + 1) / n]));
});
const densify = (g) => ({...g, coordinates: g.type === 'Polygon' ? g.coordinates.map(densifyRing)
  : g.coordinates.map((poly) => poly.map(densifyRing))});
const STATES = D.states.map((o) => toFeature({...o, geometry: densify(o.geometry)})), COUNTIES = D.counties.map(toFeature);
const stateById = Object.fromEntries(STATES.map((f) => [f.id, f]));
const countyById = Object.fromEntries(COUNTIES.map((f) => [f.id, f]));
// Rampa del rinde de maíz: viridis (apta para daltonismo), de 150 a 230+ bu/acre
const CORN_MIN = 150, CORN_MAX = 230;
const RAMP = [[0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]]];
function rampColor(v) {
  const t = clamp01((v - CORN_MIN) / (CORN_MAX - CORN_MIN));
  for (let i = 1; i < RAMP.length; i++) if (t <= RAMP[i][0]) {
    const [a, ca] = RAMP[i - 1], [b, cb] = RAMP[i], u = (t - a) / (b - a);
    return ca.map((x, j) => Math.round(x + (cb[j] - x) * u));
  }
  return RAMP[RAMP.length - 1][1];
}
// sin dato = celda vacía (nunca 0): gris con rayado "Missing data"
const hasCorn = (c) => typeof c.stat.corn_bu_ac === 'number';
for (const c of COUNTIES) c.rgb = hasCorn(c) ? rampColor(c.stat.corn_bu_ac) : [70, 70, 70];
// Historia: completa (con el mapa del CDL) o solo rinde y clima; sin ficha, no se abre
const historyOf = (c) => c.stat.history || null;
const MISSING = COUNTIES.filter((c) => !hasCorn(c));
// lugar libre alrededor del centroide, en grados: hasta el borde por izquierda/derecha (a su latitud)
// y por abajo/arriba (a su longitud). Sirve para saber si el nombre entra adentro del condado.
function room(rings, [cx, cy], axis) {
  const hits = [], u = axis, v = 1 - axis, c0 = [cx, cy][v];
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if ((a[v] > c0) !== (b[v] > c0)) hits.push(a[u] + ((c0 - a[v]) / (b[v] - a[v])) * (b[u] - a[u]));
  }
  hits.sort((x, y) => x - y);
  const m = [cx, cy][u];
  for (let i = 0; i + 1 < hits.length; i += 2) if (m >= hits[i] && m <= hits[i + 1]) return Math.min(m - hits[i], hits[i + 1] - m);
  return 0; // el centroide cae afuera (forma muy irregular): no hay lugar
}
for (const c of COUNTIES) {
  const g = c.geometry, rings = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
  c.roomX = room(rings, c.centroid, 0); c.roomY = room(rings, c.centroid, 1);
}
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

let V = null, level = 'globe', selState = null, selCounty = null, hover = null, take = null;
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
// ---- tarjeta del condado: nace del punto del clic y queda pegada al condado (ver "tarjeta" más abajo)
const CARD_W = 320, CARD_GAP = 16, EDGE = 8;
const card = $('card'), cardBox = $('card-box'), grow = $('card-grow');
const isSheet = () => W <= 760; // en el celular la tarjeta se apoya abajo, a todo el ancho
// fases: hidden → waiting (espera a que el condado se vea) → open → closing | swapping (sale para dar paso a otra)
let cardCounty = null, cardPhase = 'hidden', cardSide = 1, cardPos = [0, 0], cardDx = 0;
let cardH = 0, topInset = 66; // medidas guardadas: con el mapa oculto offsetHeight da 0
let cardTimer = 0, cardOpenedAt = 0, cardNext = null, cardInstant = false, cardOff = null;
let cardFromSearch = false, restoreTo = null, growing = false, growTimer = 0;
// la cámara encuadra condado + tarjeta como un solo grupo centrado
const cardShift = (k, lat, side) => (take || isSheet() ? 0 : (side * (CARD_GAP + CARD_W)) / 2 / (base * k) / rad / Math.cos(lat * rad));
// en el celular la tarjeta tapa la parte de abajo: el condado sube al centro de lo que queda visible
const sheetLift = (k) => (!take && isSheet() ? Math.max(0, (cardH || 220) - topInset) / 2 / (base * k) / rad : 0);
function fitK(f, t) {
  const [[x0, y0], [x1, y1]] = f.bounds, lat = (y0 + y1) / 2;
  const u = Math.abs(x1 - x0) * Math.cos(lat * rad) * rad, v = Math.abs(y1 - y0) * rad;
  return (Math.min(W, H) * t) / (Math.max(u, v) * base);
}
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(`fieldrewind:${name}`, {detail}));

function flyToState(id, move = true) {
  const s = stateById[id]; if (!s) return;
  selState = s; selCounty = null; level = 'state';
  updateUI();
  if (move) flyTo({lon: s.centroid[0], lat: s.centroid[1], k: fitK(s, 0.7)}, 1500);
  emit('state', {fips: id, name: s.properties.name});
}
/**
 * Elige un condado: vuela a encuadrarlo junto con su tarjeta.
 * at = [x, y] del clic (la tarjeta nace de ahí); instant = sin vuelo ni animación (volver de otra pantalla).
 */
function flyToCounty(id, {dur = 1500, at = null, instant = false, fromSearch = false} = {}) {
  const c = countyById[id]; if (!c) return;
  selState = stateById[c.properties.state]; selCounty = c; level = 'county'; cardFromSearch = fromSearch;
  updateUI();
  // si la tarjeta de este condado ya está, se respeta su lado
  const side = cardCounty === c && cardPhase !== 'hidden' && cardPhase !== 'swapping' ? cardSide : pickSide(c, !!at);
  if (!take) {
    let off = null;
    if (at && viewport) { const [px, py] = viewport.project(c.centroid); off = [at[0] - px, at[1] - py]; }
    showCard(c, {off, instant, side});
  }
  const k = Math.min(fitK(c, 0.3), 60);
  const to = {lon: c.centroid[0] + cardShift(k, c.centroid[1], side), lat: c.centroid[1] - sheetLift(k), k};
  if (instant) { V = null; Object.assign(R, to); } else flyTo(to, reduceMotion.matches ? 600 : dur);
  emit('county', {fips: id, name: c.properties.name, state: selState.properties.name, hasHistory: !!historyOf(c)});
}
function reset() { selState = null; selCounty = null; level = 'globe'; flyTo(HOME, 1400); updateUI(); }
/** Vuelve a la portada (logo + Start) */
const goHome = () => { location.hash = '#/'; };
function goBack() {
  if (level === 'county') flyToState(selState.id);
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
let lastKind = null;
function applyHash() {
  if (take) return;
  const r = routeOf(location.hash), prev = lastKind;
  lastKind = r.kind;
  if (r.kind === 'other') return; // otra pantalla: el mapa queda oculto
  applyingHash = true;
  if (r.kind === 'home') {
    if (!isLanding()) {
      document.body.classList.add('landing');
      selState = null; selCounty = null; level = 'globe';
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
      if (!(level === 'county' && selCounty.id === r.fips)) {
        // al volver de otra pantalla la tarjeta ya está abierta: sin vuelo ni animación
        const instant = prev === 'other';
        if (instant) { document.body.classList.add('map-now'); setTimeout(() => document.body.classList.remove('map-now'), 100); }
        flyToCounty(r.fips, {instant});
      }
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

// Sin WebGL el globo no se puede dibujar (queda la esfera lisa): se avisa en vez de callar.
if (!document.createElement('canvas').getContext('webgl2')) {
  const note = document.createElement('p');
  note.className = 'no-gl';
  note.setAttribute('role', 'status');
  note.innerHTML = 'Missing data: this browser can\'t draw the 3D map (WebGL is off). ' +
    'Open a county directly: <a href="#/county/19169">Story, IA</a> · <a href="#/county/17113">McLean, IL</a> · <a href="#/county/20191">Sumner, KS</a>';
  $('globe').parentNode.appendChild(note);
}

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
  onHover: (info) => {
    hover = info.object && !take ? {type: info.layer.id === 'counties' ? 'county' : 'state', f: info.object} : null;
    showTip(hover && hover.type === 'county' ? hover.f : null, info.x, info.y);
  },
  onClick: (info) => {
    if (take || growing) return;
    if (!info.object) { if (selCounty) closeCard(); return; } // clic en mapa vacío: cierra la tarjeta
    if (info.layer.id === 'counties') flyToCounty(info.object.id, {at: [info.x, info.y]});
    else flyToState(info.object.id);
  },
  onError: (e) => console.error('deck', e && e.stack),
  layers: [],
});

const memo = new Map();
const one = (key, obj) => { if (!obj) return []; const m = memo.get(key); if (m && m[0] === obj) return m; const a = [obj]; memo.set(key, a); return a; };

// En el globo, cada capa (océano, teselas, estados, condados) es una malla de triángulos planos que solo toca la
// esfera en sus vértices. Cerca del vértice de una capa, esa capa queda más alta que el triángulo de la capa de
// encima, y la prueba de profundidad dejaba pasar lo de abajo (la imagen satelital sobre los condados).
// Arreglo: solo el océano escribe profundidad, hundido GROUND_SINK_M metros (el doble del peor desnivel, el de
// un triángulo de 5°, la resolution del GlobeView). Sirve para tapar la cara de atrás del globo. Las demás capas
// no escriben profundidad (SURFACE): entre ellas manda el orden en que se dibujan.
const GROUND_SINK_M = 25000;
const SURFACE = {depthWriteEnabled: false};
let groundBias = 0, depthUnit = 0;
const groundOffset = () => [0, groundBias];
function updateGroundBias() {
  if (!viewport) return;
  if (!depthUnit) { const gl = deckgl.device && deckgl.device.gl; depthUnit = 2 ** -((gl && gl.getParameter(gl.DEPTH_BITS)) || 24); }
  // project() devuelve z en [-1, 1]; el buffer de profundidad usa la mitad de ese rango
  const dz = viewport.project([R.lon, R.lat, -GROUND_SINK_M])[2] - viewport.project([R.lon, R.lat, 0])[2];
  groundBias = Number.isFinite(dz) && dz > 0 ? dz / 2 / depthUnit : 0;
}

let viewport = null, LABELS = [];
function buildLayers(a) {
  const centre = [R.lon, R.lat], front = (p) => angDist(p, centre) < 1.45;
  const hoverState = hover && hover.type === 'state' ? hover.f : null;
  const hoverCounty = hover && hover.type === 'county' && hover.f !== selCounty ? hover.f : null;
  const stateFade = 1 - a * 0.85;
  const layers = [
    new SolidPolygonLayer({id: 'ocean', data: [[[-180, 90], [0, 90], [180, 90], [180, -90], [0, -90], [-180, -90]]],
      getPolygon: (d) => d, getFillColor: OCEAN, getPolygonOffset: groundOffset}),
    new TileLayer({id: 'bluemarble', data: TILE_URL, minZoom: 0, maxZoom: 8, tileSize: 256, maxRequests: 12,
      onTileError: () => {},
      renderSubLayers: (props) => {
        const [[w, s], [e, n]] = props.tile.boundingBox;
        return new BitmapLayer(props, {data: null, image: props.data, bounds: [w, s, e, n],
          _imageCoordinateSystem: COORDINATE_SYSTEM.CARTESIAN, parameters: SURFACE});
      }}),
    // brillo fijo debajo de los estados con datos (no late: no es un dato en vivo)
    new GeoJsonLayer({id: 'states-glow', parameters: SURFACE, data: STATES, filled: false, stroked: true, lineWidthUnits: 'pixels',
      getLineWidth: 9, getLineColor: [...GLOW, Math.round(65 * stateFade)],
      updateTriggers: {getLineColor: [stateFade]}}),
    new GeoJsonLayer({id: 'states', parameters: SURFACE, data: STATES, filled: true, stroked: true, pickable: R.k <= COUNTY_K + 0.6,
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
    // con el mapa lejos los condados miden pocos px: el borde se afina para no tapar el color
    const countyPx = base * R.k * rad * 0.45, edge = Math.max(1.5, Math.min(3, countyPx / 12));
    layers.push(
      new GeoJsonLayer({id: 'counties', parameters: SURFACE, data: COUNTIES, opacity: a, filled: true, stroked: true,
        pickable: R.k > COUNTY_K + 0.6, lineWidthUnits: 'pixels', getLineWidth: edge, getLineColor: NIGHT,
        updateTriggers: {getLineWidth: edge}, getFillColor: (f) => [...f.rgb, 255]}),
      // borde doble: Papel fino sobre Verde noche, así siempre contrasta uno de los dos con la rampa
      new GeoJsonLayer({id: 'county-lines', parameters: SURFACE, data: COUNTIES, opacity: a, filled: false, stroked: true,
        lineWidthUnits: 'pixels', getLineWidth: edge / 3, getLineColor: CREAM, updateTriggers: {getLineWidth: edge}}),
      new GeoJsonLayer({id: 'state-edge-dark', parameters: SURFACE, data: STATES, opacity: a, filled: false, stroked: true,
        lineWidthUnits: 'pixels', getLineWidth: 5, getLineColor: NIGHT}),
      new GeoJsonLayer({id: 'state-edge', parameters: SURFACE, data: STATES, opacity: a, filled: false, stroked: true,
        lineWidthUnits: 'pixels', getLineWidth: 3, getLineColor: CREAM}),
      new GeoJsonLayer({id: 'county-hover', parameters: SURFACE, data: one('hover', hoverCounty), filled: true, stroked: true,
        lineWidthUnits: 'pixels', getFillColor: [255, 255, 255, 64], getLineColor: CREAM, getLineWidth: 1.5}),
      new GeoJsonLayer({id: 'county-selected', parameters: SURFACE, data: one('sel', selCounty), filled: false, stroked: true,
        lineWidthUnits: 'pixels', getLineColor: WHITE, getLineWidth: 3.5}));
  }
  if (take === 'c') layers.push(new GeoJsonLayer({id: 'argentina', parameters: SURFACE, data: ARGENTINA, filled: false, stroked: true,
    lineWidthUnits: 'pixels', getLineWidth: 1.6, getLineColor: GLOW}));

  // los rótulos se dibujan en el canvas de arriba (sombra suave), ver drawLabels()
  LABELS = [];
  // los nombres de estado le ceden el lugar a los de condado: nunca se ven los dos
  if (R.k > 1.7 && a < 0.3) {
    const al = Math.min(1, R.k - 1.7) * clamp01(1 - a / 0.3), size = Math.min(26, 11 + R.k * 2);
    for (const s of STATES) if (front(s.centroid))
      LABELS.push({p: s.centroid, text: s.properties.name.toUpperCase(), size, alpha: al, caps: true});
  }
  // nombres de condado centrados en su centroide. Prioridad: seleccionado, demo, el resto.
  // Seleccionado y demo se muestran siempre; el resto solo si entra adentro de su condado.
  if (a > 0.3) {
    const size = R.k > 20 ? 20 : 15, alpha = clamp01((a - 0.3) / 0.3);
    const add = (c, prio) => { if (front(c.centroid)) LABELS.push({p: c.centroid, text: c.properties.name, size, alpha, county: c, prio}); };
    if (selCounty) add(selCounty, 0);
    for (const id of Object.keys(DEMO)) if (countyById[id] !== selCounty) add(countyById[id], 2);
    for (const c of COUNTIES) if (c !== selCounty && !DEMO[c.id]) add(c, 3);
    LABELS.sort((x, y) => (x.prio ?? -1) - (y.prio ?? -1));
  }
  return layers;
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
const textW = new Map();
function measure(c, text, size) {
  const key = size + '|' + text;
  if (!textW.has(key)) textW.set(key, c.measureText(text).width);
  return textW.get(key);
}
function screenRect(f) { // caja del condado en pantalla
  const [[x0, y0], [x1, y1]] = f.bounds, [ax, ay] = viewport.project([x0, y0]), [bx, by] = viewport.project([x1, y1]);
  return [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)];
}
const overlaps = (r, s) => r[0] < s[2] && r[2] > s[0] && r[1] < s[3] && r[3] > s[1];
function drawLabels(c) {
  const placed = [], selBox = selCounty && R.k > COUNTY_K ? screenRect(selCounty) : null;
  // los nombres que quedarían debajo de la barra de arriba, la leyenda o la tarjeta no se dibujan
  const cover = ['top', 'legend'].map((id) => $(id)).filter((el) => el && !el.hidden && el.offsetWidth)
    .map((el) => { const q = el.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom]; });
  if (cardPhase !== 'hidden' && cardPhase !== 'waiting')
    cover.push(isSheet() ? [0, H - cardH, W, H] : [cardPos[0], cardPos[1], cardPos[0] + CARD_W, cardPos[1] + cardH]);
  for (const l of LABELS) {
    const [x, y] = viewport.project(l.p);
    c.font = `700 ${l.size}px "DM Sans", system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.letterSpacing = l.caps ? `${(l.size * 0.08).toFixed(1)}px` : '0px';
    if (l.county) {
      const w = measure(c, l.text, l.size), h = l.size * 1.1, f = l.county, [cx, cy] = f.centroid;
      if (l.prio === 3) { // el resto: solo si entra en el condado, con 15 % de aire
        const rx = Math.abs(viewport.project([cx + f.roomX, cy])[0] - viewport.project([cx - f.roomX, cy])[0]);
        const ry = Math.abs(viewport.project([cx, cy + f.roomY])[1] - viewport.project([cx, cy - f.roomY])[1]);
        if (w > rx * 0.85 || h > ry * 0.85) continue;
      }
      const r = [x - w / 2 - 2, y - h / 2, x + w / 2 + 2, y + h / 2];
      if (r[0] < 0 || r[2] > W || cover.some((s) => overlaps(r, s))) continue;
      if (placed.some((s) => overlaps(r, s))) continue; // choca con uno de más prioridad: se oculta
      if (selBox && f !== selCounty && overlaps(r, selBox)) continue; // no tapa el contorno del seleccionado
      placed.push(r);
    }
    c.globalAlpha = l.alpha;
    shadowText(c, l.text, x, y, COL.cream);
  }
  c.globalAlpha = 1; c.letterSpacing = '0px';
}
// rayado "Missing data": rayas a 45° en pantalla, recortadas a cada condado sin dato
function drawMissing(c, a) {
  if (!MISSING.length || a <= 0.01) return;
  const centre = [R.lon, R.lat];
  c.save(); c.globalAlpha = a; c.beginPath();
  let any = false;
  for (const f of MISSING) {
    if (angDist(f.centroid, centre) > 1.4) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) for (const ring of poly) {
      ring.forEach((p, i) => { const [x, y] = viewport.project(p); if (i) c.lineTo(x, y); else c.moveTo(x, y); });
      c.closePath(); any = true;
    }
  }
  if (any) {
    c.clip('evenodd');
    c.beginPath();
    for (let x = -H; x < W; x += 7) { c.moveTo(x, H); c.lineTo(x + H, 0); }
    c.strokeStyle = 'rgba(246,241,228,0.55)'; c.lineWidth = 1.5; c.stroke();
  }
  c.restore();
}
function drawHud(u, r, a) {
  const c = hctx, cx = W / 2, cy = H / 2;
  c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, W, H);
  if (u > 0.02) { // lado de noche: la luz viene de arriba a la izquierda
    const s = c.createRadialGradient(cx - r * 0.42, cy - r * 0.34, r * 0.2, cx - r * 0.42, cy - r * 0.34, r * 1.6);
    s.addColorStop(0, 'rgba(0,0,0,0)'); s.addColorStop(0.5, 'rgba(0,0,0,0)');
    s.addColorStop(0.82, `rgba(0,2,8,${0.55 * u})`); s.addColorStop(1, `rgba(0,0,4,${0.88 * u})`);
    c.fillStyle = s; c.beginPath(); c.arc(cx, cy, r, 0, 6.2832); c.fill();
  }
  if (!viewport) return;
  drawMissing(c, a);
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
  updateGroundBias();
  // alejarse del nivel de condado (o perderlo de vista) cierra la tarjeta
  if (selCounty && !V && !take && !growing && (R.k <= COUNTY_K || angDist(selCounty.centroid, [R.lon, R.lat]) > 1.2)) closeCard();
  placeCard(dt);
  const r = globeRadiusPx();
  drawSky(t, u, r); drawHud(u, r, a);
}

// ---- tarjeta del condado
// #card se mueve con el mapa (un transform por cuadro, en placeCard); #card-box es la superficie que escala y
// se desvanece con transiciones de CSS, así un clic a mitad de camino la da vuelta sin saltos.
function measureCard() {
  const h = cardBox.offsetHeight; if (h) cardH = h;
  const t = $('top').offsetHeight; if (t) topInset = Math.max(EDGE, t - 28);
}
window.addEventListener('resize', measureCard);
/** Lado de la tarjeta: a la derecha del condado si entra; si no, a la izquierda */
function pickSide(c, fromClick) {
  if (!fromClick || isSheet() || !viewport) return 1;
  const [x0, , x1] = screenRect(c);
  const fitsR = x1 + CARD_GAP + CARD_W <= W - EDGE, fitsL = x0 - CARD_GAP - CARD_W >= EDGE;
  return fitsR || !fitsL ? 1 : -1;
}
const setOrigin = (px, py) => { cardBox.style.transformOrigin = `${(px - cardPos[0]).toFixed(1)}px ${(py - cardPos[1]).toFixed(1)}px`; };
/** La salida se achica hacia el centro del condado (solo si la entrada ya terminó: cambiar el origen a mitad de escala salta) */
function exitOrigin() {
  if (!viewport || !cardCounty || performance.now() - cardOpenedAt < 450) return;
  const [x, y] = viewport.project(cardCounty.centroid); setOrigin(x, y);
}
function resetCard() {
  clearTimeout(cardTimer);
  card.hidden = true; card.className = 'ui';
  cardPhase = 'hidden'; cardCounty = null; cardNext = null; cardDx = 0;
}
function focusCard() { if (!take && active) $('c-name').focus({preventScroll: true}); }
function showCard(c, req) {
  req.c = c;
  if (cardPhase === 'swapping') { cardNext = req; return; }
  if (cardPhase === 'hidden' || cardPhase === 'waiting') {
    if (cardPhase === 'waiting' && cardCounty === c) return;
    resetCard(); startCard(req); return;
  }
  if (cardCounty === c) { // la misma tarjeta: si se estaba yendo, vuelve
    if (cardPhase === 'closing') { clearTimeout(cardTimer); card.classList.add('open'); cardPhase = 'open'; focusCard(); }
    return;
  }
  if (req.instant) { resetCard(); startCard(req); return; }
  // otro condado: la actual sale rápido y recién entonces nace la nueva
  const wasClosing = cardPhase === 'closing';
  clearTimeout(cardTimer);
  if (!wasClosing) { exitOrigin(); card.classList.add('swap'); card.classList.remove('open'); }
  cardNext = req; cardPhase = 'swapping';
  cardTimer = setTimeout(() => { const n = cardNext; resetCard(); if (n) startCard(n); }, wasClosing ? 220 : 150);
}
function startCard(req) {
  cardCounty = req.c; cardSide = req.side; cardInstant = req.instant; cardOff = req.off; cardPhase = 'waiting';
  if (cardOff && !cardInstant && viewport && active) { // clic: nace ya, desde el punto tocado
    const [x, y] = viewport.project(cardCounty.centroid);
    birthCard([x + cardOff[0], y + cardOff[1]]);
  }
}
/** Sin clic (buscador, botón, ruta): la tarjeta espera a que el condado se vea y nace de su centro */
function tryBirth() {
  if (!viewport || !active) return;
  const c = cardCounty;
  if (angDist(c.centroid, [R.lon, R.lat]) > 1.2) return;
  if (cardInstant) { birthCard(null, true); return; }
  const [x, y] = viewport.project(c.centroid);
  if (V) {
    const q = screenRect(c);
    if (x < 0 || x > W || y < 0 || y > H || q[2] - q[0] < 60) return;
  }
  birthCard([x, y]);
}
function birthCard(origin, instant = false) {
  const c = cardCounty, hist = historyOf(c), corn = hasCorn(c);
  $('c-name').textContent = `${c.properties.name} County`;
  $('c-state').textContent = `${stateById[c.properties.state].properties.name} · FIPS ${c.id}`;
  $('c-status').textContent = hist === 'full' ? `Full history · 2015–2025 · crop map${corn ? ', yield and weather' : ' (USDA CDL)'}`
    : hist ? 'Yield and weather history · crop map: Missing data' : 'Missing data: history not loaded for this county yet';
  $('c-status').className = hist === 'full' ? 'ok' : hist ? 'part' : 'missing';
  $('c-corn-v').textContent = corn ? `${c.stat.corn_bu_ac} bu/acre` : 'Missing data';
  $('c-corn').className = corn ? '' : 'missing';
  $('c-open').disabled = !hist;
  // Next season: botón solo si el modelo cubre el condado; si no, el faltante se escribe
  const hasNext = NEXT_AVAILABLE.includes(c.id);
  $('c-next').hidden = !hasNext;
  $('c-nonext').hidden = hasNext;
  $('c-nonext').textContent = hasModel(c.properties.state) ? 'Missing data: no next-season options for this county yet' : NO_MODEL;
  $('c-close').setAttribute('aria-label', `Close ${c.properties.name} County`);
  card.hidden = false; card.className = `ui ${instant ? 'now' : 'pre'}`;
  measureCard();
  cardDx = 0; cardPhase = 'open'; cardOpenedAt = instant ? 0 : performance.now();
  placeCard(0);
  if (origin) setOrigin(origin[0], origin[1]);
  void cardBox.offsetWidth; // fija el estado inicial antes de animar
  card.classList.add('open'); card.classList.remove('pre');
  if (instant) { void cardBox.offsetWidth; card.classList.remove('now'); }
  focusCard();
}
/** Cada cuadro: la tarjeta sigue al condado (viaja pegada durante el vuelo) */
function placeCard(dt) {
  if (cardPhase === 'hidden') return;
  if (cardPhase === 'waiting') { tryBirth(); return; }
  if (!viewport) return;
  if (isSheet()) { cardPos = [0, H - cardH]; return; } // en el celular la ubica el CSS (abajo)
  const [x0, y0, x1, y1] = screenRect(cardCounty);
  const xOf = (s) => (s > 0 ? x1 + CARD_GAP : x0 - CARD_GAP - CARD_W);
  if (!V && cardPhase === 'open') { // cambia de lado solo si el suyo ya no entra y el otro sí
    const fitsR = x1 + CARD_GAP + CARD_W <= W - EDGE, fitsL = x0 - CARD_GAP - CARD_W >= EDGE;
    const want = cardSide > 0 ? (!fitsR && fitsL ? -1 : 1) : (!fitsL && fitsR ? 1 : -1);
    if (want !== cardSide) {
      cardDx = reduceMotion.matches ? 0 : xOf(cardSide) + cardDx - xOf(want);
      cardSide = want;
    }
  }
  cardDx = Math.abs(cardDx) < 0.5 ? 0 : cardDx * Math.exp(-dt / 0.08);
  let x = Math.max(EDGE, Math.min(W - EDGE - CARD_W, xOf(cardSide) + cardDx));
  let y = Math.max(topInset, Math.min(H - EDGE - cardH, (y0 + y1) / 2 - cardH / 2));
  if (!V) { x = Math.round(x); y = Math.round(y); }
  cardPos = [x, y];
  card.style.transform = `translate3d(${x}px,${y}px,0)`;
}
function hideCard() {
  cardNext = null;
  if (cardPhase === 'hidden' || cardPhase === 'closing') return;
  const hadFocus = card.contains(document.activeElement);
  if (cardPhase === 'waiting') resetCard();
  else if (cardPhase === 'swapping') cardPhase = 'closing'; // ya está saliendo: su temporizador la oculta
  else {
    exitOrigin(); card.classList.remove('open'); cardPhase = 'closing';
    clearTimeout(cardTimer); cardTimer = setTimeout(resetCard, 220);
  }
  if (hadFocus) (restoreTo || $('globe')).focus({preventScroll: true});
  restoreTo = null;
}
/** Cierra la tarjeta: la cámara se queda y el condado deja de estar elegido (ruta del estado) */
function closeCard(viaKeyboard = false) {
  if (!selCounty || growing) return;
  restoreTo = viaKeyboard ? (cardFromSearch ? $('q') : $('back')) : $('globe');
  selCounty = null; level = 'state';
  updateUI();
}
/** "See more": la tarjeta crece hasta cubrir la pantalla y recién ahí se abre la historia */
function endGrow() { clearTimeout(growTimer); growing = false; grow.hidden = true; grow.className = ''; grow.style.clipPath = ''; }
function openHistory() {
  if (!selCounty || growing) return;
  const fips = selCounty.id, q = cardBox.getBoundingClientRect();
  emit('open', {fips});
  growing = true; grow.hidden = false;
  grow.style.clipPath = `inset(${q.top}px ${W - q.right}px ${H - q.bottom}px ${q.left}px round 12px)`;
  void grow.offsetWidth;
  grow.classList.add('on');
  grow.style.clipPath = 'inset(0px 0px 0px 0px round 0px)';
  growTimer = setTimeout(() => { location.hash = `#/county/${fips}?play=1`; }, reduceMotion.matches ? 200 : 450); // la historia arranca reproduciéndose
}
// al volver al mapa: se saca el velo y, si la tarjeta sigue abierta, el foco vuelve a ella
onActive = (on) => { if (!on) return; endGrow(); if (cardPhase === 'open') focusCard(); };

// ---- migas y botones
function updateUI() {
  document.body.dataset.level = level;
  writeHash();
  $('back').textContent = level === 'county' ? `← Back to ${selState.properties.name}` : level === 'state' ? '← Back to globe' : '← Back';
  const crumbs = ['<button type="button" data-go="globe">Globe</button>'];
  if (selState) crumbs.push(`<button type="button" data-go="state">${selState.properties.name}</button>`);
  if (selCounty) crumbs.push(`<span>${selCounty.properties.name} County</span>`);
  $('crumbs').innerHTML = crumbs.join('<i>›</i>');
  showTip(null);
  $('legend').hidden = level === 'globe';
  if (!selCounty) hideCard();
}
$('crumbs').addEventListener('click', (e) => {
  const go = e.target.dataset && e.target.dataset.go;
  if (go === 'globe') reset();
  if (go === 'state' && selState) flyToState(selState.id);
});
$('back').addEventListener('click', goBack);
$('home').addEventListener('click', goHome);
$('enter').addEventListener('click', () => { location.hash = '#/map'; });
// Botón de entrada: vuela directo al condado de demo y abre su tarjeta en el mapa
$('cta').addEventListener('click', () => flyToCounty(START));
$('c-open').addEventListener('click', openHistory);
$('c-next').addEventListener('click', () => {
  if (!selCounty || growing) return;
  emit('next', {fips: selCounty.id, name: selCounty.properties.name, state: selState.properties.name});
  location.hash = `#/county/${selCounty.id}/next`;
});
$('c-close').addEventListener('click', (e) => closeCard(e.detail === 0)); // detail 0 = activado con el teclado
card.addEventListener('pointerenter', () => { hover = null; showTip(null); });
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !active || isLanding() || growing || e.target === $('q')) return;
  if (selCounty) closeCard(true); else goBack();
});

// ---- tooltip del condado: nombre, estado y valor (o "Missing data")
function showTip(c, x, y) {
  const tip = $('tip');
  if (!c || take) { tip.hidden = true; return; }
  tip.innerHTML = `<b>${c.properties.name} County, ${POSTAL[c.properties.state]}</b> · ${hasCorn(c) ? `Corn ${c.stat.corn_bu_ac} bu/acre` : 'Missing data'}`;
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = `${Math.min(x + 14, W - w - 8)}px`;
  tip.style.top = `${y + 14 + h > H - 8 ? y - h - 10 : y + 14}px`;
}

// ---- buscador de estados y condados (combobox accesible)
const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\bcounty\b/g, '').replace(/\s+/g, ' ').trim();
const INDEX = [
  ...STATES.map((s) => ({kind: 'state', id: s.id, label: s.properties.name, sub: hasModel(s.id) ? 'State' : 'State · no yield model yet', key: norm(s.properties.name), alt: POSTAL[s.id].toLowerCase()})),
  ...COUNTIES.map((c) => ({kind: 'county', id: c.id, label: `${c.properties.name} County`, sub: stateById[c.properties.state].properties.name, key: norm(c.properties.name), alt: c.id})),
];
let results = [], activeIdx = -1;
function findPlaces(text) {
  const q = norm(text); if (!q) return [];
  const first = [], rest = [];
  for (const it of INDEX) {
    if (it.key.startsWith(q) || it.alt === q) first.push(it);
    else if (q.length > 2 && it.key.includes(q)) rest.push(it);
  }
  return [...first, ...rest].slice(0, 8);
}
function renderResults() {
  const q = $('q'), list = $('q-list'), text = q.value.trim();
  if (!text) { list.hidden = true; q.setAttribute('aria-expanded', 'false'); q.removeAttribute('aria-activedescendant'); return; }
  list.innerHTML = results.length
    ? results.map((r, i) => `<li id="q-opt-${i}" role="option" aria-selected="${i === activeIdx}" data-i="${i}"><span>${r.label}</span><small>${r.sub}</small></li>`).join('')
    : '<li class="none" role="option" aria-disabled="true" aria-selected="false">Not covered yet</li>';
  list.hidden = false; q.setAttribute('aria-expanded', 'true');
  if (activeIdx >= 0) q.setAttribute('aria-activedescendant', `q-opt-${activeIdx}`); else q.removeAttribute('aria-activedescendant');
}
function closeSearch(clear) {
  if (clear) $('q').value = '';
  results = []; activeIdx = -1; $('q-list').hidden = true; $('q').setAttribute('aria-expanded', 'false');
}
function choose(r) {
  if (!r) return;
  closeSearch(true); $('q').blur();
  if (r.kind === 'state') flyToState(r.id); else flyToCounty(r.id, {fromSearch: true});
}
$('q').addEventListener('input', () => { results = findPlaces($('q').value); activeIdx = results.length ? 0 : -1; renderResults(); });
$('q').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!results.length) return;
    e.preventDefault();
    activeIdx = (activeIdx + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
    renderResults();
    const el = $(`q-opt-${activeIdx}`); if (el) el.scrollIntoView({block: 'nearest'});
  } else if (e.key === 'Enter') {
    e.preventDefault(); choose(results[activeIdx]);
  } else if (e.key === 'Escape') {
    e.preventDefault(); closeSearch(true);
  }
});
$('q-list').addEventListener('mousedown', (e) => { // mousedown: antes de que el campo pierda el foco
  const li = e.target.closest('li[data-i]'); if (!li) return;
  e.preventDefault(); choose(results[+li.dataset.i]);
});
$('q').addEventListener('blur', () => closeSearch(false));

// ---- tomas para el video (?take=a o ?take=c)
let takeStart = 0, takeDur = 1;
const takeProgress = () => Math.min(1, (performance.now() - takeStart) / takeDur);
function startTake(name) {
  take = name; document.body.classList.add('recording'); takeStart = performance.now();
  if (name === 'a') {
    takeDur = 6000; Object.assign(R, {lon: -20, lat: 22, k: 1});
    flyTo({lon: -96, lat: 37, k: 1.15}, 2000);
    setTimeout(() => flyToState('19'), 2000); setTimeout(() => flyToCounty(START), 3900);
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
window.FieldRewindGlobe = {flyToState, flyToCounty, reset, goHome, view: () => ({...R, level})};
}
