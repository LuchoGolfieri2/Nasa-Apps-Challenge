/**
 * "U.S. counties with the most similar weather" de un departamento de Argentina, como los gemelos de Next season:
 * el globo de la NASA con arcos en líneas cortadas que van del departamento a sus análogos de EE. UU. Quieto (sin
 * arrastrar); al pasar por un condado (en el globo o en su botón) se pinta de dorado, y al tocarlo se abre su
 * historia (o el mapa si no tiene). Usa las mismas funciones de arco que TwinGlobe.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Deck, _GlobeView as GlobeView, _GlobeViewport as GlobeViewport, COORDINATE_SYSTEM } from "@deck.gl/core";
import type { Layer } from "@deck.gl/core";
import { BitmapLayer, GeoJsonLayer, PathLayer, ScatterplotLayer, SolidPolygonLayer } from "@deck.gl/layers";
import { TileLayer } from "@deck.gl/geo-layers";
import D from "../map/globe-data.json";
import A from "../map/globe-argentina.json";
import { arcPath, dashes, groundKm, slice } from "../next/TwinGlobe";

type Pt = [number, number];
type RGB = [number, number, number];
type GeoFeatures = import("geojson").Feature[];
type Shape = { id: string; name: string; geometry: unknown };
export type Analog = { fips: string; name: string; state: string; centroid: Pt };

const TILE_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg";
const OCEAN: RGB = [14, 46, 92];
const NIGHT: RGB = [15, 42, 29];
const GLOW: RGB = [142, 208, 129];
const CREAM: RGB = [246, 241, 228];
const GOLD: RGB = [233, 185, 73];
const WORLD = [[[-180, 90], [0, 90], [180, 90], [180, -90], [0, -90], [-180, -90]]];
const SURFACE = { depthWriteEnabled: false, depthCompare: "always" as const };
/** Los arcos cruzan medio continente: trazos 20 veces más largos que en Next season (sino son puntitos). */
const SCALE = 20;
const FLOW_KM_S = 90;
const ARC_MS = 1100;
const DELAY_MS = 500;
const STAGGER_MS = 150;
const PULSE_MS = 1800;
const PAD = { left: 0.08, right: 0.08, top: 0.12, bottom: 0.1 };

const feat = (o: Shape) => ({ type: "Feature", id: o.id, properties: { name: o.name }, geometry: o.geometry });
const COUNTY = new Map((D.counties as unknown as Shape[]).map((c) => [c.id, feat(c)]));
const STATES = (D.states as unknown as Shape[]).map(feat);
const DEPT = new Map((A.departments as unknown as Shape[]).map((d) => [d.id, feat(d)]));
const PROVINCES = (A.provinces as unknown as Shape[]).map(feat);

/** Cámara que encuadra el departamento, los análogos y la altura de los arcos (varias pasadas con la proyección real). */
function fitView(w: number, h: number, probe: number[][]) {
  const lons = probe.map((p) => p[0]);
  const lats = probe.map((p) => p[1]);
  let longitude = (Math.min(...lons) + Math.max(...lons)) / 2;
  let latitude = (Math.min(...lats) + Math.max(...lats)) / 2;
  let zoom = 1.5;
  const uw = w * (1 - PAD.left - PAD.right);
  const uh = h * (1 - PAD.top - PAD.bottom);
  const tx = w * PAD.left + uw / 2;
  const ty = h * PAD.top + uh / 2;
  for (let pass = 0; pass < 5; pass++) {
    const vp = new GlobeViewport({ width: w, height: h, longitude, latitude, zoom });
    const xy = probe.map((p) => vp.project(p));
    const xs = xy.map((q) => q[0]).filter(Number.isFinite);
    const ys = xy.map((q) => q[1]).filter(Number.isFinite);
    if (!xs.length) break;
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const c = vp.unproject([w / 2 + ((x0 + x1) / 2 - tx), h / 2 + ((y0 + y1) / 2 - ty)]);
    if (Number.isFinite(c[0]) && Number.isFinite(c[1])) [longitude, latitude] = c as Pt;
    zoom += Math.log2(Math.min(uw / Math.max(1, x1 - x0), uh / Math.max(1, y1 - y0)));
    zoom = Math.max(0.5, Math.min(6, zoom));
  }
  return { longitude, latitude, zoom };
}

type Label = { key: string; text: string; x: number; y: number; end: boolean; origin?: boolean };

export function AnalogGlobe({
  id,
  name,
  centroid,
  analogs,
  hot,
  onHot,
  hrefOf,
}: {
  id: string;
  name: string;
  centroid: Pt;
  analogs: Analog[];
  hot: string | null;
  onHot: (fips: string | null) => void;
  hrefOf: (fips: string) => string;
}) {
  const host = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deckRef = useRef<Deck<any> | null>(null);
  const [size, setSize] = useState<[number, number]>([0, 0]);
  const [clock, setClock] = useState(0);
  const [labels, setLabels] = useState<Label[]>([]);
  const onHotRef = useRef(onHot);
  onHotRef.current = onHot;
  const hrefRef = useRef(hrefOf);
  hrefRef.current = hrefOf;

  const arcs = useMemo(
    () => analogs.map((a) => ({ a, path: arcPath(centroid, a.centroid), km: Math.max(1, groundKm(centroid, a.centroid)) })),
    [analogs, centroid],
  );
  const view = useMemo(() => {
    if (!size[0] || !size[1]) return null;
    const probe: number[][] = [centroid, ...analogs.map((a) => a.centroid)];
    for (const r of arcs) for (const p of r.path) probe.push(p);
    return fitView(size[0], size[1], probe);
  }, [size, centroid, analogs, arcs]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const deck = new Deck({
      parent: el,
      views: new GlobeView({ id: "analog-globe", resolution: 5 }),
      initialViewState: { longitude: -75, latitude: 0, zoom: 1 },
      controller: false,
      useDevicePixels: 2,
      style: { position: "absolute", inset: "0" },
      getCursor: ({ isHovering }) => (isHovering ? "pointer" : "default"),
      onError: (e) => console.error("analog globe", e),
      layers: [],
    });
    deckRef.current = deck;
    const observer = new ResizeObserver(([e]) => setSize([Math.round(e.contentRect.width), Math.round(e.contentRect.height)]));
    observer.observe(el);
    return () => {
      observer.disconnect();
      deck.finalize();
      deckRef.current = null;
    };
  }, []);

  // un solo reloj: entrada de los arcos, latido de los recuadros y avance de los trazos
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setClock(1e9);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setClock(now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id]);

  const reduce = clock >= 1e9;
  const progress = arcs.map((_, i) => {
    const x = Math.max(0, Math.min(1, (clock - DELAY_MS - i * STAGGER_MS) / ARC_MS));
    return 1 - Math.pow(1 - x, 3);
  });
  const drawn = progress.every((p) => p >= 1);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !view) return;
    const pulse = reduce ? 0.5 : (1 - Math.cos((2 * Math.PI * clock) / PULSE_MS)) / 2;
    const shift = ((reduce ? 0 : clock) / 1000) * FLOW_KM_S;
    type Dash = { fips: string; path: number[][] };
    const track: Dash[] = arcs
      .map((r, i) => ({ fips: r.a.fips, path: progress[i] > 0 ? slice(r.path, 0, progress[i]) : [] }))
      .filter((d) => d.path.length > 1);
    // del departamento hacia cada condado: los trazos avanzan hacia EE. UU.
    const dashed: Dash[] = arcs.flatMap((r, i) =>
      dashes(r.path, r.km / SCALE, shift / SCALE, progress[i]).map((path) => ({ fips: r.a.fips, path })),
    );
    const dept = DEPT.get(id);
    const deptList = dept ? [dept] : [];
    const usList = analogs.map((a) => COUNTY.get(a.fips)).filter(Boolean) as ReturnType<typeof feat>[];
    const usStates = new Set(analogs.map((a) => a.fips.slice(0, 2)));
    const near = (D.counties as unknown as Shape[]).filter((c) => usStates.has(c.id.slice(0, 2))).map(feat);
    const lines = (lid: string, data: unknown[], color: RGB, alpha: number, width: number, opacity = 1) =>
      new GeoJsonLayer({
        id: lid,
        data: data as GeoFeatures,
        filled: false,
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: width,
        getLineColor: [...color, alpha],
        lineJointRounded: true,
        opacity,
        parameters: SURFACE,
      });
    const layers: Layer[] = [
      new SolidPolygonLayer({ id: "ocean", data: WORLD, getPolygon: (d: number[][]) => d as unknown as number[], getFillColor: OCEAN, parameters: SURFACE }),
      new TileLayer({
        id: "bluemarble",
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
      new SolidPolygonLayer({ id: "veil", data: WORLD, getPolygon: (d: number[][]) => d as unknown as number[], getFillColor: [...NIGHT, 110], parameters: SURFACE }),
      lines("us-counties", near, CREAM, 50, 0.6),
      lines("states", STATES, CREAM, 200, 1),
      lines("provinces", PROVINCES, CREAM, 200, 1),
      new GeoJsonLayer({
        id: "us-fill",
        data: usList as unknown as GeoFeatures,
        filled: true,
        stroked: false,
        getFillColor: (f: GeoFeatures[number]) => [...(f.id === hot ? GOLD : CREAM), f.id === hot ? 170 : 90],
        updateTriggers: { getFillColor: [hot] },
        parameters: SURFACE,
      }),
      new GeoJsonLayer({ id: "dept-fill", data: deptList as unknown as GeoFeatures, filled: true, stroked: false, getFillColor: [...GLOW, 170], parameters: SURFACE }),
      lines("us-halo", usList, CREAM, 255, 8, 0.12 + 0.3 * pulse),
      lines("dept-halo", deptList, GLOW, 255, 10, 0.2 + 0.5 * pulse),
      lines("dept-edge", deptList, GLOW, 255, 2.4),
      new PathLayer({
        id: "arc-track",
        data: track,
        getPath: (d: Dash) => d.path as unknown as number[],
        getColor: (d: Dash) => [...(d.fips === hot ? GOLD : CREAM), d.fips === hot ? 80 : 40],
        getWidth: 4,
        widthUnits: "pixels",
        capRounded: true,
        jointRounded: true,
        updateTriggers: { getColor: [hot] },
        parameters: SURFACE,
      }),
      new PathLayer({
        id: "arc-dashes",
        data: dashed,
        getPath: (d: Dash) => d.path as unknown as number[],
        getColor: (d: Dash) => [...(d.fips === hot ? GOLD : CREAM), 255],
        getWidth: (d: Dash) => (d.fips === hot ? 3.2 : 2.4),
        widthUnits: "pixels",
        capRounded: true,
        jointRounded: true,
        updateTriggers: { getColor: [hot], getWidth: [hot] },
        parameters: SURFACE,
      }),
      new ScatterplotLayer({
        id: "us-dots",
        data: analogs,
        pickable: true,
        getPosition: (a: Analog) => a.centroid,
        getRadius: (a: Analog) => (a.fips === hot ? 7 : 5),
        radiusUnits: "pixels",
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 1.5,
        getLineColor: [...NIGHT, 255],
        getFillColor: (a: Analog) => [...(a.fips === hot ? GOLD : CREAM), 255],
        updateTriggers: { getRadius: [hot], getFillColor: [hot] },
        parameters: SURFACE,
        onHover: ({ object }) => onHotRef.current(object ? (object as Analog).fips : null),
        onClick: ({ object }) => {
          if (object) window.location.hash = hrefRef.current((object as Analog).fips).replace(/^#/, "");
        },
      }),
      new ScatterplotLayer({
        id: "dept-dot",
        data: [centroid],
        getPosition: (p: Pt) => p,
        getRadius: 6,
        radiusUnits: "pixels",
        stroked: true,
        lineWidthUnits: "pixels",
        getLineWidth: 2,
        getLineColor: [...NIGHT, 255],
        getFillColor: [...GLOW, 255],
        parameters: SURFACE,
      }),
    ];
    deck.setProps({ viewState: view, layers });
  }, [view, clock, arcs, analogs, hot, id, centroid, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  // rótulos en HTML: el departamento siempre; los condados si no se pisan (están juntos)
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !view || !drawn) return;
    const raf = requestAnimationFrame(() => {
      const vp = deck.getViewports()[0];
      if (!vp) return;
      const w = size[0];
      const taken: [number, number, number, number][] = [];
      const out: Label[] = [];
      const width = (t: string, big?: boolean) => t.length * (big ? 8.6 : 7.4) + 4;
      const place = (key: string, text: string, c: Pt, origin: boolean, force: boolean) => {
        const [x, y] = vp.project(c) as [number, number];
        const tw = width(text, origin);
        for (const end of [false, true]) {
          const box: [number, number, number, number] = end ? [x - 9 - tw, y - 9, x - 9, y + 9] : [x + 9, y - 9, x + 9 + tw, y + 9];
          if (box[0] < 4 || box[2] > w - 4) continue;
          if (force || !taken.some((t) => t[0] < box[2] && t[2] > box[0] && t[1] < box[3] && t[3] > box[1])) {
            taken.push(box);
            out.push({ key, text, x: end ? x - 9 : x + 9, y, end, origin });
            return;
          }
        }
      };
      for (const a of analogs) {
        const [x, y] = vp.project(a.centroid) as [number, number];
        taken.push([x - 6, y - 6, x + 6, y + 6]);
      }
      place("origin", name, centroid, true, true);
      const order = [...analogs].sort((p, q) => Number(q.fips === hot) - Number(p.fips === hot));
      for (const a of order) place(a.fips, a.name, a.centroid, false, a.fips === hot);
      setLabels(out);
    });
    return () => cancelAnimationFrame(raf);
  }, [view, drawn, size, analogs, centroid, name, hot]);

  return (
    <div
      className="ar-aglobe"
      role="img"
      aria-label={`Globe with arcs from ${name} to its ${analogs.length} most similar U.S. counties: ${analogs.map((a) => `${a.name}, ${a.state}`).join("; ")}`}
    >
      <div ref={host} className="ar-aglobe__canvas" />
      <div className="ar-aglobe__labels" aria-hidden="true">
        {(drawn ? labels : []).map((l) => (
          <span
            key={l.key}
            className={`ar-aglobe__label${l.origin ? " is-origin" : ""}${l.key === hot ? " is-hot" : ""}`}
            style={{ left: l.x, top: l.y, transform: `translate(${l.end ? "-100%" : "0"}, -50%)` }}
          >
            {l.text}
          </span>
        ))}
      </div>
    </div>
  );
}
