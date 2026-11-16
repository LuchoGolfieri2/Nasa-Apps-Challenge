/**
 * Globo de fondo del "See more" de un departamento de Argentina, como CountyGlobe en EE. UU.: el mismo globo de la
 * NASA (Blue Marble) con la cámara encuadrando el departamento en el lugar que marca `slot`. No hay mapa del CDL en
 * Argentina: el departamento va resaltado con su contorno, y los vecinos y las provincias con líneas finas.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Deck, _GlobeView as GlobeView, _GlobeViewport as GlobeViewport, COORDINATE_SYSTEM } from "@deck.gl/core";
import type { Layer } from "@deck.gl/core";
import { BitmapLayer, GeoJsonLayer, SolidPolygonLayer } from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";
import A from "../map/globe-argentina.json";

type Pt = [number, number];
type RGB = [number, number, number];
type GeoFeatures = import("geojson").Feature[];
type Shape = { id: string; name: string; bounds?: [Pt, Pt]; geometry: unknown };

const BLUE_MARBLE =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
const OCEAN: RGB = [14, 46, 92];
const NIGHT: RGB = [15, 42, 29];
const CREAM: RGB = [246, 241, 228];
const SPROUT: RGB = [143, 209, 138];
const WORLD = [[[-180, 90], [0, 90], [180, 90], [180, -90], [0, -90], [-180, -90]]];
const SURFACE = { depthWriteEnabled: false, depthCompare: "always" as const };
const INTRO_MS = 1000;
const INTRO_ZOOM = 2.6;
const PAD = 0.06;

const feat = (o: Shape) => ({ type: "Feature", id: o.id, properties: { name: o.name }, geometry: o.geometry });
const DEPTS = (A.departments as unknown as Shape[]).map((d) => ({ ...d, f: feat(d) }));
const PROVINCES = (A.provinces as unknown as Shape[]).map(feat);

/** Cámara que pone la caja del departamento dentro del rectángulo `box` (px del contenedor). */
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

export function DeptGlobe({ id, slot }: { id: string; slot: React.RefObject<HTMLElement | null> }) {
  const host = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deckRef = useRef<Deck<any> | null>(null);
  const [size, setSize] = useState<{ w: number; h: number; box: { x: number; y: number; w: number; h: number } } | null>(
    null,
  );
  const [intro, setIntro] = useState(0);
  const dept = useMemo(() => DEPTS.find((d) => d.id === id) ?? null, [id]);
  const quad = useMemo<Pt[] | null>(() => {
    if (!dept?.bounds) return null;
    const [[w, s], [e, n]] = dept.bounds;
    return [[w, n], [e, n], [e, s], [w, s]];
  }, [dept]);
  const others = useMemo(() => DEPTS.filter((d) => d.id !== id).map((d) => d.f), [id]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const deck = new Deck({
      parent: el,
      views: new GlobeView({ id: "dept-globe", resolution: 5 }),
      initialViewState: { longitude: -61, latitude: -34, zoom: 3 },
      controller: false,
      useDevicePixels: 2,
      style: { position: "absolute", inset: "0" },
      onError: (e) => console.error("dept globe", e),
      layers: [],
    });
    deckRef.current = deck;
    const measure = () => {
      const s = slot.current;
      const hb = el.getBoundingClientRect();
      if (!s || !hb.width || !hb.height) return;
      const sb = s.getBoundingClientRect();
      setSize({
        w: Math.round(hb.width),
        h: Math.round(hb.height),
        box: { x: sb.left - hb.left, y: sb.top - hb.top, w: sb.width, h: sb.height },
      });
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
    const done = window.setTimeout(() => setIntro(1), INTRO_MS + 300);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(done);
    };
  }, [id]);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !size || !quad || !dept) return;
    const cam = fit(size.w, size.h, quad, size.box);
    const introK = Math.pow(2, -INTRO_ZOOM * (1 - intro));
    const viewState = { ...cam, zoom: cam.zoom + Math.log2(introK) };
    const lines = (lid: string, data: unknown[], color: RGB, alpha: number, width: number) =>
      new GeoJsonLayer({
        id: lid,
        data: data as GeoFeatures,
        filled: false,
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: width,
        getLineColor: [...color, alpha],
        lineJointRounded: true,
        parameters: SURFACE,
      });
    const layers: Layer[] = [
      new SolidPolygonLayer({
        id: "ocean",
        data: WORLD,
        getPolygon: (d: number[][]) => d as unknown as number[],
        getFillColor: OCEAN,
        parameters: SURFACE,
      }),
      new TileLayer({
        id: "bluemarble",
        data: BLUE_MARBLE,
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
      new SolidPolygonLayer({
        id: "veil",
        data: WORLD,
        getPolygon: (d: number[][]) => d as unknown as number[],
        getFillColor: [...NIGHT, 70],
        parameters: SURFACE,
      }),
      lines("depts", others, CREAM, 80, 0.8),
      lines("prov-dark", PROVINCES, NIGHT, 190, 4),
      lines("prov", PROVINCES, CREAM, 255, 1.6),
      new GeoJsonLayer({
        id: "dept",
        data: [dept.f] as unknown as GeoFeatures,
        filled: true,
        stroked: true,
        getFillColor: [...SPROUT, 70],
        lineWidthUnits: "pixels",
        getLineWidth: 3,
        getLineColor: [255, 255, 255, 255],
        lineJointRounded: true,
        parameters: SURFACE,
      }),
    ];
    deck.setProps({ viewState, layers });
  }, [size, quad, dept, others, intro]);

  return (
    <div className="cglobe">
      <div ref={host} className="cglobe__canvas" />
    </div>
  );
}
