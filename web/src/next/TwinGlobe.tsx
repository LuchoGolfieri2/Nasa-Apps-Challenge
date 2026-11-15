/**
 * F24 — "Counties like yours" sobre el globo: el mismo globo de la pantalla 1 (deck.gl, NASA Blue Marble de GIBS)
 * de fondo, quieto (el usuario no lo mueve), con arcos en 3D del condado a sus condados gemelos.
 * Reemplaza al mapa plano que había antes (TwinArcs).
 * Los arcos se dibujan `delayMs` después de montarse o de cambiar `animateKey`.
 */
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Deck, _GlobeView as GlobeView, _GlobeViewport as GlobeViewport, COORDINATE_SYSTEM} from '@deck.gl/core';
import type {Layer} from '@deck.gl/core';
import {BitmapLayer, GeoJsonLayer, PathLayer, ScatterplotLayer, SolidPolygonLayer} from '@deck.gl/layers';
import {TileLayer} from '@deck.gl/geo-layers';
import D from '../map/globe-data.json';
import type {Twin} from './types';

export interface TwinGlobeProps {
  origin: {fips: string; name: string; centroid: [number, number]};
  twins: Twin[];
  /** fips de los gemelos que respaldan la opción activa; el resto queda atenuado y sin arco */
  highlight: string[];
  /** al cambiar, los arcos se vuelven a dibujar */
  animateKey: string;
  delayMs?: number;
  selected?: string | null;
  onSelect?: (fips: string | null) => void;
}

type RGB = [number, number, number];
type Pt = [number, number];
type Feature = {type: 'Feature'; id: string; properties: {name: string}; geometry: unknown};
type GeoFeatures = import('geojson').Feature[];

const TILE_URL =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';
const OCEAN: RGB = [14, 46, 92];
const NIGHT: RGB = [15, 42, 29];
const GLOW: RGB = [142, 208, 129];
const CREAM: RGB = [246, 241, 228];
const GOLD: RGB = [233, 185, 73];
const rad = Math.PI / 180;
const ARC_MS = 700;
const INTRO_MS = 1100;
const INTRO_ZOOM = 1.6;
const STAGGER_MS = 120;
const LABEL_FONT = '700 12px "DM Sans", system-ui, sans-serif';
// las capas no escriben profundidad: entre ellas manda el orden (ver la nota en map/globe.js)
const SURFACE = {depthWriteEnabled: false, depthCompare: 'always' as const};

const asFeature = (o: {id: string; name: string; geometry: unknown}): Feature => ({
  type: 'Feature',
  id: o.id,
  properties: {name: o.name},
  geometry: o.geometry,
});
const STATES = (D.states as Array<{id: string; name: string; geometry: unknown}>).map(asFeature);
const COUNTIES = (D.counties as Array<{id: string; name: string; geometry: unknown}>).map(asFeature);
const countyById = new Map(COUNTIES.map((f) => [f.id, f]));
// límites de cada estado (id = 2 dígitos del fips), para encuadrar los estados donde caen el condado y sus gemelos
const STATE_BOUNDS = new Map(
  (D.states as unknown as Array<{id: string; bounds: [Pt, Pt]}>).map((st) => [st.id, st.bounds] as const),
);
/** Márgenes del encuadre, en fracción del contenedor: arriba hay más lugar para los rótulos. */
const PAD = {x: 0.07, top: 0.12, bottom: 0.08};

/** Arco levantado sobre la esfera: 48 puntos [lon, lat, altura en m]; la altura crece con la distancia. */
function arcPath(a: Pt, b: Pt): number[][] {
  const km = Math.hypot((b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * rad), b[1] - a[1]) * 111.32;
  const top = Math.max(60, km * 0.28) * 1000;
  return Array.from({length: 48}, (_, i) => {
    const t = i / 47;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.sin(Math.PI * t) * top];
  });
}
/** El tramo inicial del arco hasta la fracción `p` (para dibujarlo de a poco). */
function partial(path: number[][], p: number): number[][] {
  if (p >= 1) return path;
  const n = Math.max(2, Math.ceil(p * (path.length - 1)) + 1);
  return path.slice(0, n);
}

/**
 * Vista quieta, proporcional a lo que hay que mostrar: entran enteros los estados donde caen el condado y sus
 * gemelos, y todos los arcos posibles (con su altura), dentro de los márgenes PAD. Así el encuadre no salta al
 * cambiar de opción y los arcos quedan centrados. Se mide con la proyección real del globo (varias pasadas:
 * cada una corrige centro y zoom).
 */
function fitView(w: number, h: number, origin: Pt, twins: Twin[], fipsList: string[]) {
  const probe: number[][] = [];
  for (const id of new Set(fipsList.map((f) => f.slice(0, 2)))) {
    const bounds = STATE_BOUNDS.get(id);
    if (!bounds) continue;
    const [[west, south], [east, north]] = bounds;
    for (let i = 0; i <= 6; i++) {
      const lon = west + ((east - west) * i) / 6;
      probe.push([lon, south], [lon, north]);
    }
    probe.push([west, (south + north) / 2], [east, (south + north) / 2]);
  }
  probe.push(origin);
  for (const t of twins) for (const p of arcPath(origin, t.centroid)) probe.push(p);

  const lons = probe.map((p) => p[0]);
  const lats = probe.map((p) => p[1]);
  let longitude = (Math.min(...lons) + Math.max(...lons)) / 2;
  let latitude = (Math.min(...lats) + Math.max(...lats)) / 2;
  let zoom = 4;
  const usableW = w * (1 - 2 * PAD.x);
  const usableH = h * (1 - PAD.top - PAD.bottom);
  const targetX = w / 2;
  const targetY = h * PAD.top + usableH / 2;
  for (let pass = 0; pass < 4; pass++) {
    const vp = new GlobeViewport({width: w, height: h, longitude, latitude, zoom});
    const xy = probe.map((p) => vp.project(p));
    const xs = xy.map((q) => q[0]);
    const ys = xy.map((q) => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // corre el centro para que el contenido quede en el medio del área útil
    const c = vp.unproject([w / 2 + ((x0 + x1) / 2 - targetX), h / 2 + ((y0 + y1) / 2 - targetY)]);
    if (Number.isFinite(c[0]) && Number.isFinite(c[1])) [longitude, latitude] = c;
    zoom += Math.log2(Math.min(usableW / Math.max(1, x1 - x0), usableH / Math.max(1, y1 - y0)));
  }
  return {longitude, latitude, zoom};
}

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 7;
  measureCtx.font = LABEL_FONT;
  return measureCtx.measureText(text).width;
}
type Box = [number, number, number, number];
const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
type Label = {fips: string; text: string; x: number; y: number; anchor: 'start' | 'end'; origin?: boolean; dim?: boolean};

export const TwinGlobe: React.FC<TwinGlobeProps> = ({origin, twins, highlight, animateKey, delayMs = 1000, selected, onSelect}) => {
  const host = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deckRef = useRef<Deck<any> | null>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const [progress, setProgress] = useState<number[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  /** 0 → 1: la cámara baja hacia los estados al aparecer (la mueve la app, no el usuario) */
  const [intro, setIntro] = useState(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const on = useMemo(() => twins.filter((t) => highlight.includes(t.fips)), [twins, highlight]);
  const arcs = useMemo(() => on.map((t) => ({twin: t, path: arcPath(origin.centroid, t.centroid)})), [on, origin.centroid]);

  // el deck se crea una vez; se suelta al desmontar
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const deck = new Deck({
      parent: el,
      views: new GlobeView({id: 'twin-globe', resolution: 5}),
      initialViewState: {longitude: -93, latitude: 40, zoom: 3},
      controller: false, // quieto: el usuario no lo mueve
      useDevicePixels: 2,
      style: {position: 'absolute', inset: '0'},
      getCursor: ({isHovering}) => (isHovering ? 'pointer' : 'default'),
      onError: (e) => console.error('twin globe', e),
      layers: [],
    });
    deckRef.current = deck;
    const observer = new ResizeObserver(([entry]) =>
      setSize([Math.round(entry.contentRect.width), Math.round(entry.contentRect.height)]),
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      deck.finalize();
      deckRef.current = null;
    };
  }, []);

  // arcos que se dibujan de a uno, `delayMs` después de cada cambio de opción
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !arcs.length) {
      setProgress(arcs.map(() => 1));
      return;
    }
    setProgress(arcs.map(() => 0));
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = arcs.map((_, i) => Math.max(0, Math.min(1, (now - start - delayMs - i * STAGGER_MS) / ARC_MS)));
      const eased = p.map((x) => 1 - Math.pow(1 - x, 3));
      setProgress(eased);
      if (p.some((x) => x < 1)) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [arcs, animateKey, delayMs]);

  const fit = useMemo(
    () =>
      size[0] && size[1]
        ? fitView(size[0], size[1], origin.centroid, twins, [origin.fips, ...twins.map((t) => t.fips)])
        : null,
    [size, origin.centroid, origin.fips, twins],
  );
  const hasFit = fit !== null;
  useEffect(() => {
    if (!hasFit) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIntro(1);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / INTRO_MS);
      setIntro(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // si el navegador frena los cuadros (pestaña oculta), la cámara igual termina en su lugar
    const done = window.setTimeout(() => setIntro(1), INTRO_MS + 300);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [hasFit]);
  const view = useMemo(() => {
    if (!fit) return null;
    const e = 1 - Math.pow(1 - intro, 3);
    return {...fit, zoom: fit.zoom - INTRO_ZOOM * (1 - e), longitude: fit.longitude + 6 * (1 - e)};
  }, [fit, intro]);
  const settled = intro >= 1;

  // capas
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !view) return;
    const hot = hover ?? selected ?? null;
    const originFeature = countyById.get(origin.fips) ?? null;
    const onFeatures = on.map((t) => countyById.get(t.fips)).filter(Boolean) as Feature[];
    const shown = arcs.map((a, i) => ({...a, path: partial(a.path, progress[i] ?? 0), done: (progress[i] ?? 0) >= 1}));
    const layers: Layer[] = [
      new SolidPolygonLayer({
        id: 'ocean',
        data: [[[-180, 90], [0, 90], [180, 90], [180, -90], [0, -90], [-180, -90]]],
        getPolygon: (d: number[][]) => d as unknown as number[],
        getFillColor: OCEAN,
        parameters: SURFACE,
      }),
      new TileLayer({
        id: 'bluemarble',
        data: TILE_URL,
        minZoom: 0,
        maxZoom: 8,
        tileSize: 256,
        maxRequests: 12,
        onTileError: () => {},
        renderSubLayers: (props) => {
          const [[w, s], [e, n]] = props.tile.boundingBox;
          return new BitmapLayer(props, {
            data: undefined,
            image: props.data,
            bounds: [w, s, e, n],
            _imageCoordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
            parameters: SURFACE,
          });
        },
      }),
      // velo oscuro: la imagen queda de fondo y los arcos mandan
      new SolidPolygonLayer({
        id: 'veil',
        data: [[[-180, 90], [0, 90], [180, 90], [180, -90], [0, -90], [-180, -90]]],
        getPolygon: (d: number[][]) => d as unknown as number[],
        getFillColor: [...NIGHT, 70],
        parameters: SURFACE,
      }),
      new GeoJsonLayer({
        id: 'counties',
        data: (COUNTIES) as unknown as GeoFeatures,
        filled: false,
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 0.6,
        getLineColor: [...CREAM, 55],
        parameters: SURFACE,
      }),
      new GeoJsonLayer({
        id: 'twin-counties',
        data: (onFeatures) as unknown as GeoFeatures,
        filled: true,
        stroked: true,
        lineWidthUnits: 'pixels',
        getFillColor: (f: GeoFeatures[number]) => [...(f.id === hot ? GOLD : CREAM), f.id === hot ? 150 : 95],
        getLineColor: (f: GeoFeatures[number]) => [...(f.id === hot ? GOLD : CREAM), 230],
        getLineWidth: (f: GeoFeatures[number]) => (f.id === hot ? 2 : 1.2),
        updateTriggers: {getFillColor: [hot], getLineColor: [hot], getLineWidth: [hot]},
        parameters: SURFACE,
      }),
      new GeoJsonLayer({
        id: 'origin-county',
        data: (originFeature ? [originFeature] : []) as unknown as GeoFeatures,
        filled: true,
        stroked: true,
        lineWidthUnits: 'pixels',
        getFillColor: [...GLOW, 170],
        getLineColor: [...GLOW, 255],
        getLineWidth: 2,
        parameters: SURFACE,
      }),
      new GeoJsonLayer({
        id: 'state-edge-dark',
        data: (STATES) as unknown as GeoFeatures,
        filled: false,
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 4,
        getLineColor: [...NIGHT, 200],
        parameters: SURFACE,
      }),
      new GeoJsonLayer({
        id: 'state-edge',
        data: (STATES) as unknown as GeoFeatures,
        filled: false,
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 1.8,
        getLineColor: CREAM,
        parameters: SURFACE,
      }),
      // brillo de los arcos (el glow va solo en la atmósfera y en los arcos: spec 4.1)
      new PathLayer({
        id: 'arc-glow',
        data: shown,
        getPath: (d: (typeof shown)[number]) => d.path as unknown as number[],
        getColor: (d: (typeof shown)[number]) => [...(d.twin.fips === hot ? GOLD : CREAM), d.twin.fips === hot ? 90 : 45],
        getWidth: (d: (typeof shown)[number]) => (d.twin.fips === hot ? 9 : 6),
        widthUnits: 'pixels',
        capRounded: true,
        jointRounded: true,
        updateTriggers: {getColor: [hot], getWidth: [hot]},
        parameters: SURFACE,
      }),
      new PathLayer({
        id: 'arcs',
        data: shown,
        getPath: (d: (typeof shown)[number]) => d.path as unknown as number[],
        getColor: (d: (typeof shown)[number]) => [...(d.twin.fips === hot ? GOLD : CREAM), 255],
        getWidth: (d: (typeof shown)[number]) => (d.twin.fips === hot ? 3.2 : 2.2),
        widthUnits: 'pixels',
        capRounded: true,
        jointRounded: true,
        updateTriggers: {getColor: [hot], getWidth: [hot]},
        parameters: SURFACE,
      }),
      new ScatterplotLayer({
        id: 'twin-dots',
        data: twins,
        pickable: true,
        getPosition: (t: Twin) => t.centroid,
        getRadius: (t: Twin) => (t.fips === hot ? 7 : highlight.includes(t.fips) ? 5 : 3.5),
        radiusUnits: 'pixels',
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 1.5,
        getLineColor: [...NIGHT, 255],
        getFillColor: (t: Twin) =>
          t.fips === hot ? [...GOLD, 255] : highlight.includes(t.fips) ? [...CREAM, 255] : [...CREAM, 110],
        updateTriggers: {getRadius: [hot, highlight], getFillColor: [hot, highlight]},
        parameters: SURFACE,
        onHover: ({object}) => setHover(object ? (object as Twin).fips : null),
        onClick: ({object}) => {
          if (!object) return;
          const f = (object as Twin).fips;
          onSelectRef.current?.(selected === f ? null : f);
        },
      }),
      new ScatterplotLayer({
        id: 'origin-dot',
        data: [origin],
        getPosition: (o: typeof origin) => o.centroid,
        getRadius: 6,
        radiusUnits: 'pixels',
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        getLineColor: [...NIGHT, 255],
        getFillColor: [...GLOW, 255],
        parameters: SURFACE,
      }),
    ];
    deck.setProps({viewState: view, layers});
  }, [view, arcs, progress, on, twins, highlight, hover, selected, origin]);

  // rótulos en HTML (nítidos y con la tipografía de la app), ubicados donde no pisan nada
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !view || !settled) return;
    const id = requestAnimationFrame(() => {
      const vp = deck.getViewports()[0];
      if (!vp) return;
      const at = (c: Pt) => vp.project(c) as [number, number];
      const [w] = size;
      const hot = hover ?? selected ?? null;
      const taken: Box[] = [];
      const out: Label[] = [];
      const place = (fips: string, text: string, c: Pt, extra: Partial<Label>, force: boolean) => {
        const [x, y] = at(c);
        const tw = textWidth(text) + (extra.origin ? 6 : 0);
        for (const anchor of ['start', 'end'] as const) {
          const box: Box = anchor === 'start' ? [x + 9, y - 9, x + 9 + tw, y + 9] : [x - 9 - tw, y - 9, x - 9, y + 9];
          const fits = box[0] >= 4 && box[2] <= w - 4;
          if (fits && (force || !taken.some((t) => overlaps(box, t)))) {
            taken.push(box);
            out.push({fips, text, x: anchor === 'start' ? x + 9 : x - 9, y, anchor, ...extra});
            return;
          }
        }
      };
      const [ox, oy] = at(origin.centroid);
      taken.push([ox - 8, oy - 8, ox + 8, oy + 8]);
      for (const t of on) {
        const [x, y] = at(t.centroid);
        taken.push([x - 6, y - 6, x + 6, y + 6]);
      }
      place('origin', origin.name, origin.centroid, {origin: true}, true);
      const order = [...on].sort((a, b) => Number(b.fips === hot) - Number(a.fips === hot));
      for (const t of order) place(t.fips, t.name, t.centroid, {}, t.fips === hot);
      const extra = hot && !on.some((t) => t.fips === hot) ? twins.find((t) => t.fips === hot) : null;
      if (extra) place(extra.fips, extra.name, extra.centroid, {dim: true}, true);
      setLabels(out);
    });
    return () => cancelAnimationFrame(id);
  }, [view, settled, size, on, twins, origin, hover, selected]);

  const shownLabels = !settled ? [] : labels.filter((l) => {
    if (l.origin) return true;
    const i = arcs.findIndex((a) => a.twin.fips === l.fips);
    return i < 0 || (progress[i] ?? 0) >= 1;
  });

  return (
    <div className="fr-twinglobe" role="img" aria-label={`Globe with arcs from ${origin.name} County to ${on.length} similar counties, listed below`}>
      <div ref={host} className="fr-twinglobe-canvas" />
      <div className="fr-twinglobe-labels" aria-hidden="true">
        {shownLabels.map((l) => (
          <span
            key={l.fips}
            className={`fr-twinglobe-label${l.origin ? ' is-origin' : ''}${l.fips === (hover ?? selected) ? ' is-hot' : ''}${l.dim ? ' is-dim' : ''}`}
            style={{left: l.x, top: l.y, transform: `translate(${l.anchor === 'end' ? '-100%' : '0'}, -50%)`}}
          >
            {l.text}
          </span>
        ))}
      </div>
    </div>
  );
};
