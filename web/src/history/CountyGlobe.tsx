/**
 * Pantalla 2 sobre el globo: el mismo globo de la pantalla 1 (deck.gl, imágenes de la NASA) de fondo, con la cámara
 * centrada en el condado. El mapa del CDL (CdlMap) va encima, ubicado justo sobre el condado: las esquinas del
 * ráster (EPSG:5070) se pasan a grados y se proyectan con la cámara. El usuario no mueve el globo: lo mueve el zoom
 * del mapa del CDL, así los dos quedan siempre pegados.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Deck, _GlobeView as GlobeView, _GlobeViewport as GlobeViewport, COORDINATE_SYSTEM } from "@deck.gl/core";
import type { Layer } from "@deck.gl/core";
import { BitmapLayer, GeoJsonLayer, SolidPolygonLayer } from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";
import D from "../map/globe-data.json";
import type { RasterInfo } from "../data/types";
import { albersToLonLat } from "./albers";

/** Dónde queda el mapa del CDL sobre el globo, en px del contenedor: esquina de arriba a la izquierda, tamaño y giro. */
export interface Placement {
  left: number;
  top: number;
  width: number;
  height: number;
  /** radianes: el norte del ráster (Albers) no coincide del todo con el norte de la cámara */
  angle: number;
}
export interface CdlView {
  k: number;
  x: number;
  y: number;
}

type Pt = [number, number];
type RGB = [number, number, number];
type GeoFeatures = import("geojson").Feature[];

/** Fondo lejano: Blue Marble (hasta nivel 8, ~500 m). */
const BLUE_MARBLE =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
/** De cerca: mosaico Landsat (WELD, 30 m), así alrededor del condado se ven los lotes y no una mancha. */
const LANDSAT =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/2000-01-01/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpeg";
const OCEAN: RGB = [14, 46, 92];
const NIGHT: RGB = [15, 42, 29];
const CREAM: RGB = [246, 241, 228];
const WORLD = [[[-180, 90], [0, 90], [180, 90], [180, -90], [0, -90], [-180, -90]]];
// las capas no escriben profundidad: entre ellas manda el orden (ver la nota en map/globe.js)
const SURFACE = { depthWriteEnabled: false, depthCompare: "always" as const };
/** Entrada: la cámara baja desde 2^INTRO_ZOOM veces más lejos. */
const INTRO_MS = 1000;
const INTRO_ZOOM = 2.6;
/** Margen alrededor del condado dentro de su lugar (fracción del lado). */
const PAD = 0.03;

type Feature = { type: "Feature"; id: string; properties: { name: string }; geometry: unknown };
const asFeature = (o: { id: string; name: string; geometry: unknown }): Feature => ({
  type: "Feature",
  id: o.id,
  properties: { name: o.name },
  geometry: o.geometry,
});
const STATES = (D.states as Array<{ id: string; name: string; geometry: unknown }>).map(asFeature);
const COUNTIES = (D.counties as Array<{ id: string; name: string; geometry: unknown }>).map(asFeature);

/** Esquinas del ráster en grados: arriba-izq., arriba-der., abajo-der., abajo-izq. */
function corners(info: RasterInfo & { origin: Pt }): Pt[] {
  const [x0, y0] = info.origin;
  const x1 = x0 + info.width * info.pixel_m;
  const y1 = y0 - info.height * info.pixel_m;
  return [albersToLonLat(x0, y0), albersToLonLat(x1, y0), albersToLonLat(x1, y1), albersToLonLat(x0, y1)];
}

/** Cámara que pone las cuatro esquinas dentro del rectángulo `box` (px del contenedor). Varias pasadas. */
function fit(w: number, h: number, quad: Pt[], box: { x: number; y: number; w: number; h: number }) {
  let longitude = quad.reduce((s, p) => s + p[0], 0) / quad.length;
  let latitude = quad.reduce((s, p) => s + p[1], 0) / quad.length;
  let zoom = 8;
  const uw = box.w * (1 - 2 * PAD);
  const uh = box.h * (1 - 2 * PAD);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  for (let pass = 0; pass < 5; pass++) {
    const vp = new GlobeViewport({ width: w, height: h, longitude, latitude, zoom });
    const xy = quad.map((p) => vp.project(p));
    const xs = xy.map((q) => q[0]);
    const ys = xy.map((q) => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const c = vp.unproject([w / 2 + ((x0 + x1) / 2 - cx), h / 2 + ((y0 + y1) / 2 - cy)]);
    if (Number.isFinite(c[0]) && Number.isFinite(c[1])) [longitude, latitude] = c as Pt;
    zoom += Math.log2(Math.min(uw / Math.max(1, x1 - x0), uh / Math.max(1, y1 - y0)));
  }
  return { longitude, latitude, zoom };
}

export function CountyGlobe({
  info,
  fips,
  view,
  slot,
  children,
}: {
  info: RasterInfo & { origin: Pt };
  fips: string;
  /** zoom y paneo del mapa del CDL (en px del mapa, como los guarda CdlMap) */
  view: CdlView;
  /** elemento invisible que marca dónde va el condado (lo ubica el CSS) */
  slot: React.RefObject<HTMLElement | null>;
  /** el mapa del CDL, que recibe dónde ubicarse */
  children: (placement: Placement) => ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deckRef = useRef<Deck<any> | null>(null);
  const [size, setSize] = useState<{ w: number; h: number; box: { x: number; y: number; w: number; h: number } } | null>(
    null,
  );
  /** 0 → 1: la cámara llega desde lejos al entrar */
  const [intro, setIntro] = useState(0);
  const quad = useMemo(() => corners(info), [info]);
  const localCounties = useMemo(() => COUNTIES.filter((f) => f.id !== fips), [fips]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const deck = new Deck({
      parent: el,
      views: new GlobeView({ id: "county-globe", resolution: 5 }),
      initialViewState: { longitude: -93, latitude: 40, zoom: 3 },
      controller: false,
      useDevicePixels: 2,
      style: { position: "absolute", inset: "0" },
      onError: (e) => console.error("county globe", e),
      layers: [],
    });
    deckRef.current = deck;
    const measure = () => {
      const s = slot.current;
      const hb = el.getBoundingClientRect();
      if (!s || !hb.width || !hb.height) return;
      const sb = s.getBoundingClientRect();
      const next = {
        w: Math.round(hb.width),
        h: Math.round(hb.height),
        box: { x: sb.left - hb.left, y: sb.top - hb.top, w: sb.width, h: sb.height },
      };
      setSize((prev) =>
        prev &&
        prev.w === next.w &&
        prev.h === next.h &&
        Math.abs(prev.box.x - next.box.x) < 0.5 &&
        Math.abs(prev.box.y - next.box.y) < 0.5 &&
        Math.abs(prev.box.w - next.box.w) < 0.5 &&
        Math.abs(prev.box.h - next.box.h) < 0.5
          ? prev
          : next,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (slot.current) observer.observe(slot.current);
    measure();
    return () => {
      observer.disconnect();
      deck.finalize();
      deckRef.current = null;
    };
  }, [slot]);

  // entrada: una sola vez por condado
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIntro(1);
      return;
    }
    setIntro(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / INTRO_MS);
      setIntro(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // con la pestaña oculta los cuadros se frenan: igual termina en su lugar
    const done = window.setTimeout(() => setIntro(1), INTRO_MS + 300);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [fips]);

  // cámara del condado entero y lugar del mapa del CDL en esa cámara
  const home = useMemo(() => {
    if (!size) return null;
    const cam = fit(size.w, size.h, quad, size.box);
    const vp = new GlobeViewport({ width: size.w, height: size.h, ...cam });
    const [tl, tr, , bl] = quad.map((p) => vp.project(p) as Pt);
    const placement: Placement = {
      left: tl[0],
      top: tl[1],
      width: Math.hypot(tr[0] - tl[0], tr[1] - tl[1]),
      height: Math.hypot(bl[0] - tl[0], bl[1] - tl[1]),
      angle: Math.atan2(tr[1] - tl[1], tr[0] - tl[0]),
    };
    return { cam, vp, placement };
  }, [size, quad]);

  /** Escala de la entrada, alrededor del centro del contenedor (el mapa del CDL se escala igual por CSS). */
  const introK = Math.pow(2, -INTRO_ZOOM * (1 - intro));

  // cámara actual: la del condado entero, con el zoom y el paneo del mapa del CDL y la entrada
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !home || !size) return;
    const { placement: p, cam, vp } = home;
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);
    // corrimiento del mapa del CDL, girado como su marco
    const tx = cos * view.x - sin * view.y;
    const ty = sin * view.x + cos * view.y;
    // punto de la cámara del condado entero que ahora queda en el centro del contenedor
    const sx = p.left + (size.w / 2 - p.left - tx) / view.k;
    const sy = p.top + (size.h / 2 - p.top - ty) / view.k;
    const c = vp.unproject([sx, sy]) as Pt;
    const viewState = {
      longitude: Number.isFinite(c[0]) ? c[0] : cam.longitude,
      latitude: Number.isFinite(c[1]) ? c[1] : cam.latitude,
      zoom: cam.zoom + Math.log2(view.k * introK),
    };
    const lines = (id: string, data: Feature[], color: RGB, alpha: number, width: number) =>
      new GeoJsonLayer({
        id,
        data: data as unknown as GeoFeatures,
        filled: false,
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: width,
        getLineColor: [...color, alpha],
        lineJointRounded: true,
        parameters: SURFACE,
      });
    const tiles = (id: string, url: string, minZoom: number, maxZoom: number) =>
      new TileLayer({
        id,
        data: url,
        minZoom,
        maxZoom,
        tileSize: 256,
        maxRequests: 12,
        extent: id === "landsat" ? [-126, 23, -65, 51] : undefined,
        // el globo pide teselas un nivel más gruesas de lo que muestra: de cerca, un nivel más de detalle
        zoomOffset: id === "landsat" ? 1 : 0,
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
      });
    const layers: Layer[] = [
      new SolidPolygonLayer({
        id: "ocean",
        data: WORLD,
        getPolygon: (d: number[][]) => d as unknown as number[],
        getFillColor: OCEAN,
        parameters: SURFACE,
      }),
      tiles("bluemarble", BLUE_MARBLE, 0, 8),
      tiles("landsat", LANDSAT, 7, 12),
      // velo oscuro: la imagen queda de fondo, el condado y los cuadros mandan
      new SolidPolygonLayer({
        id: "veil",
        data: WORLD,
        getPolygon: (d: number[][]) => d as unknown as number[],
        getFillColor: [...NIGHT, 60],
        parameters: SURFACE,
      }),
      lines("counties", localCounties, CREAM, 70, 0.8),
      lines("state-edge-dark", STATES, NIGHT, 190, 4),
      lines("state-edge", STATES, CREAM, 255, 1.6),
    ];
    deck.setProps({ viewState, layers });
    if (import.meta.env.DEV) {
      // Solo en desarrollo: dónde caen las esquinas del ráster con la cámara actual, para comprobar que el mapa
      // del CDL queda pegado al globo.
      const now = new GlobeViewport({ width: size.w, height: size.h, ...viewState });
      (window as unknown as Record<string, unknown>).__countyGlobe = { corners: quad.map((q) => now.project(q)) };
    }
  }, [home, size, view, introK, localCounties]);

  const p = home?.placement;
  return (
    <div className="cglobe">
      <div ref={host} className="cglobe__canvas" />
      {p ? (
        <div
          className="cglobe__over"
          style={{
            transform: introK < 1 ? `scale(${introK})` : undefined,
            transformOrigin: size ? `${size.w / 2}px ${size.h / 2}px` : undefined,
            opacity: Math.min(1, intro * 1.6),
          }}
        >
          {children(p)}
        </div>
      ) : null}
    </div>
  );
}
