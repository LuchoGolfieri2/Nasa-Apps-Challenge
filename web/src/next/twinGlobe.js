// Pantalla 3 · globo chico de "Counties like yours": el mismo globo deck.gl del mapa (GlobeView + Blue Marble
// de la NASA), enfocado en el condado y sus condados parecidos, con un arco hacia cada uno.
// Es una instancia aparte del globo de la pantalla 1 (src/map/globe.js no se toca). La geometría de los
// condados sale de src/map/globe-data.json; de ese archivo NO se usan los valores de prueba (color, gemelos):
// los condados parecidos son los reales de data/next/<fips>.json y llegan por update().
import {Deck, _GlobeView as GlobeView, COORDINATE_SYSTEM} from '@deck.gl/core';
import {ArcLayer, BitmapLayer, GeoJsonLayer, SolidPolygonLayer} from '@deck.gl/layers';
import {TileLayer} from '@deck.gl/geo-layers';
import D from '../map/globe-data.json';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const NIGHT = hex('#0F2A1D'), FIELD = hex('#2F7D4F'), SPROUT = hex('#8ED081'), GOLD = hex('#E9B949'), PAPER = hex('#F6F1E4');
const OCEAN = [14, 46, 92];
const TILE_URL = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';

const feature = (o, extra) => ({type: 'Feature', id: o.id, properties: {name: o.name, ...extra}, geometry: o.geometry});
const STATES = D.states.map((s) => feature(s));
const COUNTIES = D.counties.map((c) => feature(c, {state: c.state}));
const COUNTY_BY_ID = Object.fromEntries(COUNTIES.map((c) => [c.id, c]));

export const hasWebGL = () => {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
};

// Igual que en globe.js: solo el océano escribe profundidad, hundido, para tapar la cara de atrás del globo.
// Las demás capas no escriben profundidad: entre ellas manda el orden en que se dibujan.
const GROUND_SINK_M = 25000;
const SURFACE = {depthWriteEnabled: false};

/** Encuadre que deja a la vista el condado y todos sus parecidos. */
function fit(points, width, height) {
  const lons = points.map((p) => p[0]), lats = points.map((p) => p[1]);
  const lon = (Math.min(...lons) + Math.max(...lons)) / 2, lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const spanX = Math.max(0.8, (Math.max(...lons) - Math.min(...lons)) * Math.cos((lat * Math.PI) / 180));
  const spanY = Math.max(0.8, Math.max(...lats) - Math.min(...lats));
  // En GlobeView, a zoom z y latitud φ, un grado de arco mide 512·2^z / (360·cos φ) px (GlobeViewport: scaleAdjust).
  // El conjunto ocupa cerca de la mitad del cuadro, así entran los nombres y la curva de los arcos.
  const pxPerDeg = (512 / 360) / Math.cos((lat * Math.PI) / 180);
  const z = Math.min(Math.log2((width * 0.5) / (pxPerDeg * spanX)), Math.log2((height * 0.36) / (pxPerDeg * spanY)));
  return {longitude: lon, latitude: lat, zoom: Math.max(2.5, Math.min(7, z))};
}

/**
 * @param parent  elemento que contiene el canvas
 * @param opts    {onSelect(fips|null), onFrame(project)}  project([lon, lat]) → [x, y] en px del cuadro, o null
 */
export function createTwinGlobe(parent, opts) {
  let props = {origin: null, twins: [], selected: null};
  let view = {longitude: -93, latitude: 41, zoom: 4.5}, hover = null;
  let groundBias = 0, depthUnit = 0;
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  const deck = new Deck({
    parent,
    views: new GlobeView({id: 'twins', resolution: 5}),
    viewState: {...view, minZoom: 2, maxZoom: 8},
    // La rueda no hace zoom (la página tiene que poder scrollear) y en pantallas táctiles no se arrastra
    // con un dedo, por lo mismo: ahí se usan los botones + y −.
    controller: {scrollZoom: false, dragRotate: false, keyboard: false, doubleClickZoom: true, touchRotate: false, dragPan: !coarse, inertia: 300},
    touchAction: 'pan-y',
    useDevicePixels: Math.min(2, window.devicePixelRatio || 1),
    onViewStateChange: ({viewState}) => {
      view = {longitude: viewState.longitude, latitude: Math.max(-80, Math.min(80, viewState.latitude)), zoom: viewState.zoom};
      render();
    },
    getCursor: ({isDragging, isHovering}) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'),
    onHover: (info) => {
      const next = info.object && info.layer.id === 'twin-fill' ? info.object.id : null;
      if (next !== hover) { hover = next; render(); }
    },
    onClick: (info) => {
      if (info.object && info.layer.id === 'twin-fill') opts.onSelect(info.object.id === props.selected ? null : info.object.id);
      else opts.onSelect(null);
    },
    onAfterRender: () => {
      const vp = deck.getViewports()[0];
      if (!vp) return;
      if (!depthUnit) {
        const gl = deck.device && deck.device.gl;
        depthUnit = 2 ** -((gl && gl.getParameter(gl.DEPTH_BITS)) || 24);
      }
      const dz = vp.project([view.longitude, view.latitude, -GROUND_SINK_M])[2] - vp.project([view.longitude, view.latitude, 0])[2];
      const bias = Number.isFinite(dz) && dz > 0 ? dz / 2 / depthUnit : 0;
      if (Math.abs(bias - groundBias) > 1) { groundBias = bias; render(); }
      opts.onFrame((p) => {
        const q = vp.project([p[0], p[1], 0]);
        return Number.isFinite(q[0]) && Number.isFinite(q[1]) ? [q[0], q[1]] : null;
      });
    },
    onError: (e) => console.error('twin globe', e && e.stack),
    layers: [],
  });

  function layers() {
    const {origin, twins, selected} = props;
    const twinFeatures = twins.map((t) => COUNTY_BY_ID[t.fips]).filter(Boolean);
    const me = origin ? COUNTY_BY_ID[origin.fips] : null;
    const ids = twins.map((t) => t.fips).join();
    return [
      new SolidPolygonLayer({id: 'ocean', data: [[[-180, 90], [0, 90], [180, 90], [180, -90], [0, -90], [-180, -90]]],
        getPolygon: (d) => d, getFillColor: OCEAN, getPolygonOffset: () => [0, groundBias], updateTriggers: {getPolygonOffset: groundBias}}),
      new TileLayer({id: 'bluemarble', data: TILE_URL, minZoom: 0, maxZoom: 8, tileSize: 256, maxRequests: 12,
        onTileError: () => {},
        renderSubLayers: (p) => {
          const [[w, s], [e, n]] = p.tile.boundingBox;
          return new BitmapLayer(p, {data: null, image: p.data, bounds: [w, s, e, n],
            _imageCoordinateSystem: COORDINATE_SYSTEM.CARTESIAN, parameters: SURFACE});
        }}),
      new GeoJsonLayer({id: 'counties', parameters: SURFACE, data: COUNTIES, filled: true, stroked: true,
        lineWidthUnits: 'pixels', getLineWidth: 0.7, getLineColor: [...NIGHT, 190], getFillColor: [...FIELD, 215]}),
      new GeoJsonLayer({id: 'state-edge', parameters: SURFACE, data: STATES, filled: false, stroked: true,
        lineWidthUnits: 'pixels', getLineWidth: 2.2, getLineColor: NIGHT}),
      new GeoJsonLayer({id: 'twin-fill', parameters: SURFACE, data: twinFeatures, filled: true, stroked: true, pickable: true,
        lineWidthUnits: 'pixels',
        getFillColor: (f) => (f.id === selected || f.id === hover ? PAPER : GOLD),
        getLineColor: PAPER, getLineWidth: (f) => (f.id === selected ? 3 : 1.6),
        updateTriggers: {getFillColor: [selected, hover], getLineWidth: [selected]}}),
      new GeoJsonLayer({id: 'origin', parameters: SURFACE, data: me ? [me] : [], filled: true, stroked: true,
        lineWidthUnits: 'pixels', getFillColor: SPROUT, getLineColor: PAPER, getLineWidth: 2.5}),
      new ArcLayer({id: 'arcs', parameters: SURFACE, data: origin ? twins : [],
        getSourcePosition: () => origin.centroid, getTargetPosition: (t) => t.centroid,
        getSourceColor: SPROUT, getTargetColor: GOLD,
        getWidth: (t) => (t.fips === selected ? 4.5 : 2.6), widthUnits: 'pixels', getHeight: 0.35, greatCircle: false,
        updateTriggers: {getSourcePosition: [origin && origin.fips, ids], getTargetPosition: ids, getWidth: [selected]}}),
    ];
  }

  function render() {
    deck.setProps({viewState: {...view, minZoom: 2, maxZoom: 8}, layers: layers()});
  }

  return {
    /** origin: {fips, centroid}; twins: [{fips, centroid}]; selected: fips | null. Con refit vuelve a encuadrar. */
    update(next, refit) {
      props = {...props, ...next};
      if (refit && props.origin) {
        const r = parent.getBoundingClientRect();
        view = fit([props.origin.centroid, ...props.twins.map((t) => t.centroid)], r.width || 800, r.height || 500);
      }
      render();
    },
    zoom(delta) {
      view = {...view, zoom: Math.max(2, Math.min(8, view.zoom + delta))};
      render();
    },
    destroy() {
      deck.finalize();
      // finalize() puede dejar el canvas si el dispositivo WebGL todavía no terminó de crearse (pasa en desarrollo,
      // donde React monta dos veces): un canvas huérfano empuja al siguiente fuera de lugar.
      parent.querySelectorAll('canvas').forEach((c) => c.remove());
    },
  };
}
