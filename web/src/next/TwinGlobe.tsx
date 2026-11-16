/**
 * F24 — "Counties like yours" sobre el globo: el mismo globo de la pantalla 1 (deck.gl, NASA Blue Marble de GIBS)
 * de fondo, con arcos en 3D del condado a sus condados gemelos. Quieto por defecto; con `interactive` el usuario lo
 * gira arrastrando y lo acerca con la rueda (pantalla completa de Next season), y `recenterKey` lo devuelve al encuadre.
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
  /** Márgenes del encuadre en fracción del contenedor (para dejar libre el lugar de paneles que flotan encima) */
  frame?: Frame;
  /** true: se arrastra y se hace zoom libremente (pantalla completa) */
  interactive?: boolean;
  /** al cambiar, la cámara vuelve al encuadre del condado y sus gemelos */
  recenterKey?: number;
}
export type Frame = {left: number; right: number; top: number; bottom: number};

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
/** Al cambiar de opción la cámara viaja al nuevo encuadre en este tiempo */
const MOVE_MS = 800;
const STAGGER_MS = 120;
const LABEL_FONT = '700 14px "DM Sans", system-ui, sans-serif';
/** Líneas cortadas de los arcos: largo del trazo y del hueco (km sobre el suelo) y velocidad hacia tu condado */
const DASH_KM = 34;
const GAP_KM = 22;
const FLOW_KM_S = 90;
/** Latido de los recuadros: un ciclo cada PULSE_MS */
const PULSE_MS = 1800;
/** Encuadre mínimo (km de ancho): con gemelos muy cerca, el zoom no se pasa de largo */
const MIN_SPAN_KM = 260;
/** Límites del zoom cuando el usuario mueve el globo */
const ZOOM_MIN = 1.2;
const ZOOM_MAX = 9;
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
// límites de cada condado, para encuadrar de cerca el condado y los gemelos de la opción abierta
const COUNTY_BOUNDS = new Map(
  (D.counties as unknown as Array<{id: string; bounds: [Pt, Pt]}>).map((c) => [c.id, c.bounds] as const),
);
/** Márgenes del encuadre, en fracción del contenedor: arriba hay más lugar para los rótulos. */
const PAD: Frame = {left: 0.1, right: 0.1, top: 0.16, bottom: 0.1};

export const groundKm = (a: Pt, b: Pt) => Math.hypot((b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * rad), b[1] - a[1]) * 111.32;

/** Arco levantado sobre la esfera: 48 puntos [lon, lat, altura en m]; la altura crece con la distancia. */
export function arcPath(a: Pt, b: Pt): number[][] {
  const top = Math.max(40, groundKm(a, b) * 0.22) * 1000;
  return Array.from({length: 48}, (_, i) => {
    const t = i / 47;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.sin(Math.PI * t) * top];
  });
}
/** Punto del arco en la fracción `t` (0 = gemelo, 1 = tu condado), interpolando entre los puntos guardados. */
function pointAt(path: number[][], t: number): number[] {
  const x = Math.max(0, Math.min(1, t)) * (path.length - 1);
  const i = Math.min(path.length - 2, Math.floor(x));
  const f = x - i;
  const [a, b] = [path[i], path[i + 1]];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
/** Tramo del arco entre las fracciones a y b. */
export function slice(path: number[][], a: number, b: number): number[][] {
  const n = path.length - 1;
  const out = [pointAt(path, a)];
  for (let i = Math.ceil(a * n); i < b * n; i++) if (i / n > a) out.push(path[i]);
  out.push(pointAt(path, b));
  return out;
}
/**
 * Arco en líneas cortadas que avanzan hacia tu condado: `shift` (km) corre los trazos; `reach` (0..1) es cuánto
 * del arco ya se dibujó (entra de a poco desde el gemelo).
 */
export function dashes(path: number[][], km: number, shift: number, reach: number): number[][][] {
  const period = (DASH_KM + GAP_KM) / km;
  const dash = DASH_KM / km;
  const out: number[][][] = [];
  const phase = ((shift / km) % period + period) % period;
  for (let s = phase - period; s < reach; s += period) {
    const a = Math.max(0, s);
    const b = Math.min(reach, s + dash);
    if (b - a > 0.002) out.push(slice(path, a, b));
  }
  return out;
}

/**
 * Vista quieta y cercana: entran el condado y los gemelos de la opción abierta (sus contornos y sus arcos, con la
 * altura) dentro de los márgenes PAD. Al cambiar de opción, la cámara viaja al encuadre nuevo. Se mide con la
 * proyección real del globo (varias pasadas: cada una corrige centro y zoom).
 */
function fitView(w: number, h: number, origin: Pt, twins: Twin[], fipsList: string[], pad: Frame = PAD) {
  const probe: number[][] = [];
  for (const id of fipsList) {
    const bounds = COUNTY_BOUNDS.get(id);
    if (!bounds) continue;
    const [[west, south], [east, north]] = bounds;
    probe.push([west, south], [east, south], [west, north], [east, north]);
  }
  probe.push(origin);
  for (const t of twins) for (const p of arcPath(t.centroid, origin)) probe.push(p);
  // ancho mínimo alrededor del centro, para no acercarse de más cuando todo está en dos o tres condados
  const lonsAll = probe.map((p) => p[0]);
  const latsAll = probe.map((p) => p[1]);
  const cLon = (Math.min(...lonsAll) + Math.max(...lonsAll)) / 2;
  const cLat = (Math.min(...latsAll) + Math.max(...latsAll)) / 2;
  const halfLon = MIN_SPAN_KM / 2 / (111.32 * Math.cos(cLat * rad));
  const halfLat = (MIN_SPAN_KM * 0.6) / 2 / 111.32;
  probe.push([cLon - halfLon, cLat], [cLon + halfLon, cLat], [cLon, cLat - halfLat], [cLon, cLat + halfLat]);

  const lons = probe.map((p) => p[0]);
  const lats = probe.map((p) => p[1]);
  let longitude = (Math.min(...lons) + Math.max(...lons)) / 2;
  let latitude = (Math.min(...lats) + Math.max(...lats)) / 2;
  let zoom = 4;
  const usableW = w * (1 - pad.left - pad.right);
  const usableH = h * (1 - pad.top - pad.bottom);
  const targetX = w * pad.left + usableW / 2;
  const targetY = h * pad.top + usableH / 2;
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

export const TwinGlobe: React.FC<TwinGlobeProps> = ({origin, twins, highlight, animateKey, delayMs = 1000, selected, onSelect, frame, interactive = false, recenterKey = 0}) => {
  const host = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deckRef = useRef<Deck<any> | null>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const [progress, setProgress] = useState<number[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  /** Cámara: la mueve la app, no el usuario. `settled` = llegó al encuadre (recién ahí van los rótulos). */
  const [view, setView] = useState<{longitude: number; latitude: number; zoom: number} | null>(null);
  const viewRef = useRef<{longitude: number; latitude: number; zoom: number} | null>(null);
  const [settled, setSettled] = useState(false);
  /** ms desde que se montó: mueve el latido y los trazos */
  const [clock, setClock] = useState(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const on = useMemo(() => twins.filter((t) => highlight.includes(t.fips)), [twins, highlight]);
  // del gemelo hacia tu condado: los trazos avanzan en ese sentido
  const arcs = useMemo(
    () => on.map((t) => ({twin: t, path: arcPath(t.centroid, origin.centroid), km: Math.max(1, groundKm(t.centroid, origin.centroid))})),
    [on, origin.centroid],
  );
  // solo se dibujan los condados de los estados que entran en juego: el resto del mapa queda limpio
  const stateKey = useMemo(
    () => [...new Set([origin.fips, ...on.map((t) => t.fips)].map((f) => f.slice(0, 2)))].sort().join(','),
    [origin.fips, on],
  );
  const localCounties = useMemo(() => {
    const ids = new Set(stateKey.split(','));
    return COUNTIES.filter((f) => ids.has(f.id.slice(0, 2)));
  }, [stateKey]);

  // el deck se crea una vez; se suelta al desmontar
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const deck = new Deck({
      parent: el,
      views: new GlobeView({id: 'twin-globe', resolution: 5}),
      initialViewState: {longitude: -93, latitude: 40, zoom: 3},
      controller: false, // quieto hasta que `interactive` lo habilita
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

  // con `interactive`, el usuario gira (arrastrando) y acerca (rueda o pellizco); la cámara queda donde la deja
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    deck.setProps({
      controller: interactive ? {inertia: 300, scrollZoom: {speed: 0.01, smooth: true}, dragRotate: false, touchRotate: false, keyboard: true} : false,
      onViewStateChange: interactive
        ? ({viewState, interactionState}) => {
            // la vista la controla este componente (viewState en las capas): acá solo se guarda, acotada
            const vs = viewState as unknown as {longitude: number; latitude: number; zoom: number};
            const v = {
              longitude: vs.longitude,
              latitude: Math.max(-80, Math.min(80, vs.latitude)),
              zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, vs.zoom)),
            };
            setDragging(Boolean(interactionState?.isDragging || interactionState?.isPanning));
            viewRef.current = v;
            setView(v);
            setSettled(true);
          }
        : // deck llama a esta función en cada rueda o arrastre: con undefined tira "onViewStateChange is not a function"
          () => null,
      getCursor: ({isHovering, isDragging}) => (isHovering ? 'pointer' : interactive ? (isDragging ? 'grabbing' : 'grab') : 'default'),
    });
  }, [interactive]);

  // reloj continuo para el latido de los recuadros y el avance de los trazos; quieto con movimiento reducido
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setClock(now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // arcos que entran de a uno desde el gemelo, `delayMs` después de cada cambio de opción
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
        ? fitView(size[0], size[1], origin.centroid, on, [origin.fips, ...on.map((t) => t.fips)], frame)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [size, origin.centroid, origin.fips, on, frame && `${frame.left},${frame.right},${frame.top},${frame.bottom}`, recenterKey],
  );
  // cámara: la primera vez baja hacia el encuadre; después viaja de un encuadre al otro
  useEffect(() => {
    if (!fit) return;
    const first = viewRef.current === null;
    const from = viewRef.current ?? {...fit, zoom: fit.zoom - INTRO_ZOOM, longitude: fit.longitude + 6};
    const land = () => {
      viewRef.current = fit;
      setView(fit);
      setSettled(true);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      land();
      return;
    }
    const ms = first ? INTRO_MS : MOVE_MS;
    setSettled(false);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      if (t >= 1) {
        land();
        return;
      }
      const e = 1 - Math.pow(1 - t, 3);
      const v = {
        longitude: from.longitude + (fit.longitude - from.longitude) * e,
        latitude: from.latitude + (fit.latitude - from.latitude) * e,
        zoom: from.zoom + (fit.zoom - from.zoom) * e,
      };
      viewRef.current = v;
      setView(v);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // si el navegador frena los cuadros (pestaña oculta), la cámara igual termina en su lugar
    const done = window.setTimeout(land, ms + 300);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [fit]);

  // capas
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !view) return;
    const hot = hover ?? selected ?? null;
    const originFeature = countyById.get(origin.fips) ?? null;
    const originList = originFeature ? [originFeature] : [];
    const onFeatures = on.map((t) => countyById.get(t.fips)).filter(Boolean) as Feature[];
    // latido 0 → 1 → 0
    const pulse = (1 - Math.cos((2 * Math.PI * clock) / PULSE_MS)) / 2;
    const shift = (clock / 1000) * FLOW_KM_S;
    type Dash = {fips: string; path: number[][]};
    const track: Dash[] = arcs
      .map((a, i) => ({fips: a.twin.fips, path: (progress[i] ?? 0) > 0 ? slice(a.path, 0, progress[i] ?? 0) : []}))
      .filter((d) => d.path.length > 1);
    const dashed: Dash[] = arcs.flatMap((a, i) =>
      dashes(a.path, a.km, shift, progress[i] ?? 0).map((path) => ({fips: a.twin.fips, path})),
    );
    const outline = (id: string, data: Feature[], color: RGB, width: number, opacity: number) =>
      new GeoJsonLayer({
        id,
        data: data as unknown as GeoFeatures,
        filled: false,
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: width,
        getLineColor: [...color, 255],
        lineJointRounded: true,
        opacity,
        parameters: SURFACE,
      });
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
        getFillColor: [...NIGHT, 90],
        parameters: SURFACE,
      }),
      new GeoJsonLayer({
        id: 'counties',
        data: localCounties as unknown as GeoFeatures,
        filled: false,
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 0.7,
        getLineColor: [...CREAM, 60],
        parameters: SURFACE,
      }),
      new GeoJsonLayer({
        id: 'twin-counties',
        data: onFeatures as unknown as GeoFeatures,
        filled: true,
        stroked: false,
        getFillColor: (f: GeoFeatures[number]) => [...(f.id === hot ? GOLD : CREAM), f.id === hot ? 130 : 70],
        updateTriggers: {getFillColor: [hot]},
        parameters: SURFACE,
      }),
      new GeoJsonLayer({
        id: 'origin-county',
        data: originList as unknown as GeoFeatures,
        filled: true,
        stroked: false,
        getFillColor: [...GLOW, 120],
        parameters: SURFACE,
      }),
      new GeoJsonLayer({
        id: 'state-edge-dark',
        data: STATES as unknown as GeoFeatures,
        filled: false,
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 4,
        getLineColor: [...NIGHT, 200],
        parameters: SURFACE,
      }),
      new GeoJsonLayer({
        id: 'state-edge',
        data: STATES as unknown as GeoFeatures,
        filled: false,
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 1.8,
        getLineColor: CREAM,
        parameters: SURFACE,
      }),
      // recuadros que laten: blancos en los parecidos, verde en el tuyo (el halo late, el borde queda fijo)
      outline('twin-halo', onFeatures, CREAM, 9, 0.12 + 0.3 * pulse),
      outline('twin-edge', onFeatures, CREAM, 2, 0.95),
      outline('origin-halo', originList, GLOW, 12, 0.2 + 0.5 * pulse),
      outline('origin-edge', originList, GLOW, 2.6, 1),
      // huella tenue del arco entero, para que las líneas cortadas se lean como un solo camino
      new PathLayer({
        id: 'arc-track',
        data: track,
        getPath: (d: Dash) => d.path as unknown as number[],
        getColor: (d: Dash) => [...(d.fips === hot ? GOLD : CREAM), d.fips === hot ? 70 : 38],
        getWidth: (d: Dash) => (d.fips === hot ? 5 : 4),
        widthUnits: 'pixels',
        capRounded: true,
        jointRounded: true,
        updateTriggers: {getColor: [hot], getWidth: [hot]},
        parameters: SURFACE,
      }),
      new PathLayer({
        id: 'arc-dashes',
        data: dashed,
        getPath: (d: Dash) => d.path as unknown as number[],
        getColor: (d: Dash) => [...(d.fips === hot ? GOLD : CREAM), 255],
        getWidth: (d: Dash) => (d.fips === hot ? 3.4 : 2.6),
        widthUnits: 'pixels',
        capRounded: true,
        jointRounded: true,
        updateTriggers: {getColor: [hot], getWidth: [hot]},
        parameters: SURFACE,
      }),
      new ScatterplotLayer({
        id: 'twin-dots',
        data: on,
        pickable: true,
        getPosition: (t: Twin) => t.centroid,
        getRadius: (t: Twin) => (t.fips === hot ? 7 : 5),
        radiusUnits: 'pixels',
        stroked: true,
        lineWidthUnits: 'pixels',
        getLineWidth: 1.5,
        getLineColor: [...NIGHT, 255],
        getFillColor: (t: Twin) => (t.fips === hot ? [...GOLD, 255] : [...CREAM, 255]),
        updateTriggers: {getRadius: [hot], getFillColor: [hot]},
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
        getRadius: 7,
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
  }, [view, arcs, progress, on, localCounties, hover, selected, origin, clock]);

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
    <div
      className={`fr-twinglobe${interactive ? ' is-interactive' : ''}${dragging ? ' is-dragging' : ''}`}
      role="img"
      aria-label={`Globe with arcs from ${origin.name} County to ${on.length} similar counties${interactive ? '. Drag to turn it, scroll or pinch to zoom' : ', listed below'}`}
    >
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
