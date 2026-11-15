import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RasterInfo } from "../data/types";
import { CLASS_LABEL, CLASS_ORDER, CROP_COLOR, NON_AG_COLOR, type ClassId, type CropId } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { createRenderer, type CdlRenderer, type Frame } from "./cdlRenderer";
import type { Playback } from "./usePlayback";
import type { Rasters } from "./useRasters";

const NIGHT = [0x0f, 0x2a, 0x1d];
const MAX_ZOOM = 12;
/** Parte de la transición que dura el fundido de cada lote: 150 ms de los 800 ms. */
const BLOCK_FADE = 0.1875;

interface View {
  k: number;
  x: number;
  y: number;
}
const HOME: View = { k: 1, x: 0, y: 0 };

/** Zoom alrededor de un punto del marco, sin dejar que el mapa se despegue de los bordes. */
function zoomAt(v: View, mx: number, my: number, factor: number, w: number, h: number): View {
  const k = Math.min(MAX_ZOOM, Math.max(1, v.k * factor));
  return clampView({ k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) }, w, h);
}
function clampView(v: View, w: number, h: number): View {
  return { k: v.k, x: Math.min(0, Math.max(w - w * v.k, v.x)), y: Math.min(0, Math.max(h - h * v.k, v.y)) };
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Tabla clase -> color (ABGR, como lo espera ImageData). Lo no resaltado se funde con el fondo. */
export function buildLut(highlight: CropId | null): Uint32Array {
  const lut = new Uint32Array(256);
  CLASS_ORDER.forEach((cls, i) => {
    if (cls === "nodata") return; // transparente
    let [r, g, b] = rgb(cls === "non_ag" ? NON_AG_COLOR : CROP_COLOR[cls]);
    if (cls !== "non_ag" && highlight && cls !== highlight) {
      const k = 0.82;
      r = Math.round(r + (NIGHT[0] - r) * k);
      g = Math.round(g + (NIGHT[1] - g) * k);
      b = Math.round(b + (NIGHT[2] - b) * k);
    }
    lut[i] = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  });
  return lut;
}

interface Props {
  info: RasterInfo;
  /** Años del condado, en orden: `pb.pos` es un índice sobre esta lista. */
  years: number[];
  rasters: Rasters;
  pb: Playback;
  /** Año exacto que se está mostrando (o el de partida durante una transición). */
  index: number;
  playing: boolean;
  between: boolean;
  highlight: CropId | null;
  countyName: string;
  /** Controles extra sobre el mapa (la guía de lectura). */
  overlay?: React.ReactNode;
}

/**
 * El condado pintado píxel a píxel (30 m) con el CDL (F17). Entre dos años los lotes cambian de cultivo de a
 * poco: eso es animación, no un dato. Solo un año exacto muestra el CDL tal cual (ver cdlRenderer.ts).
 */
export function CdlMap({ info, years, rasters, pb, index, playing, between, highlight, countyName, overlay }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<CdlRenderer | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [broken, setBroken] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; cls: ClassId } | null>(null);
  const lut = useMemo(() => buildLut(highlight), [highlight]);
  const lutRef = useRef(lut);
  lutRef.current = lut;
  const frame = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(HOME);
  const [smooth, setSmooth] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  const year = years[index];
  const status = rasters.status[year];
  const classes = rasters.get(year);

  // Lo que hace falta en cada cuadro, sin volver a suscribirse en cada render.
  const live = useRef({ years, rasters });
  live.current = { years, rasters };

  const draw = useCallback(
    (pos: number) => {
      const r = renderer.current;
      if (!r) return;
      const { years: ys, rasters: rs } = live.current;
      const i = Math.min(ys.length - 1, Math.floor(pos));
      const f = pos - i;
      const at = (k: number): Frame | null => {
        const c = rs.get(ys[k]);
        return c ? { year: ys[k], classes: c } : null;
      };
      const a = at(i);
      // Un año sin ráster no se inventa: se muestra el de partida hasta llegar, y ahí "Missing data".
      const b = f > 0 && i + 1 < ys.length ? at(i + 1) : a;
      const blend = f > 0 && a && b && a !== b;
      r.draw(a, blend ? b : a, {
        f: blend ? f : 0,
        mode: pb.reduced ? "fade" : "blocks",
        fade: BLOCK_FADE,
        shift: (i * 0.618034) % 1,
      });
    },
    [pb],
  );

  useEffect(() => setView(HOME), [info]);

  // El dibujante vive mientras no cambie el ráster (otro condado) ni se pierda el contexto de la placa.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    let r: CdlRenderer;
    try {
      r = createRenderer(el, info.width, info.height);
    } catch {
      setBroken(true);
      return;
    }
    setBroken(false);
    renderer.current = r;
    const onLost = (e: Event) => e.preventDefault();
    const onRestored = () => setEpoch((n) => n + 1);
    el.addEventListener("webglcontextlost", onLost);
    el.addEventListener("webglcontextrestored", onRestored);
    const unsubscribe = pb.subscribe(draw);
    if (import.meta.env.DEV) {
      // Solo en desarrollo: comprueba que un año exacto coincide píxel a píxel con el CDL.
      (window as unknown as Record<string, unknown>).__fieldRewindCdl = {
        kind: r.kind,
        /** Milisegundos por cuadro de una transición completa entre los dos primeros años (dibujo incluido). */
        bench: (frames = 120) => {
          const { years: ys, rasters: rs } = live.current;
          const ca = rs.get(ys[0]);
          const cb = rs.get(ys[1]);
          if (!ca || !cb) return null;
          const a = { year: ys[0], classes: ca };
          const b = { year: ys[1], classes: cb };
          r.draw(a, b, { f: 0.5, mode: "blocks", fade: BLOCK_FADE, shift: 0 });
          r.read(); // sube las texturas y espera a la placa antes de medir
          const t0 = performance.now();
          for (let k = 0; k < frames; k++) r.draw(a, b, { f: k / frames, mode: "blocks", fade: BLOCK_FADE, shift: 0 });
          r.read();
          const ms = (performance.now() - t0) / frames;
          draw(pb.pos);
          return { frames, msPerFrame: Math.round(ms * 100) / 100 };
        },
        verify: (y: number) => {
          const c = live.current.rasters.get(y);
          if (!c) return null;
          const table = buildLut(null);
          r.setLut(table);
          r.draw({ year: y, classes: c }, { year: y, classes: c }, { f: 0, mode: "blocks", fade: BLOCK_FADE, shift: 0 });
          const px = new Uint32Array(r.read().buffer);
          let wrong = 0;
          for (let i = 0; i < c.length; i++) if (px[i] !== table[c[i]]) wrong++;
          r.setLut(lutRef.current);
          draw(pb.pos);
          return { year: y, pixels: c.length, wrong };
        },
      };
    }
    return () => {
      unsubscribe();
      el.removeEventListener("webglcontextlost", onLost);
      el.removeEventListener("webglcontextrestored", onRestored);
      r.dispose();
      renderer.current = null;
    };
  }, [info, pb, draw, epoch]);

  // Cambió el resaltado o terminó de cargar un año: se vuelve a dibujar donde está.
  const settled = rasters.settled;
  useEffect(() => {
    renderer.current?.setLut(lut);
    draw(pb.pos);
  }, [lut, settled, draw, pb, epoch]);

  const zoomBy = useCallback((factor: number, mx?: number, my?: number, animate = true) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    setSmooth(animate);
    setView((v) => zoomAt(v, mx ?? box.width / 2, my ?? box.height / 2, factor, box.width, box.height));
  }, []);

  // La rueda acerca y aleja. Con el mapa entero, alejar deja pasar el scroll de la página.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const box = el.getBoundingClientRect();
      const v = viewRef.current;
      if (v.k === 1 && e.deltaY > 0) return;
      e.preventDefault();
      setSmooth(false);
      setView(zoomAt(v, e.clientX - box.left, e.clientY - box.top, Math.exp(-e.deltaY * 0.0022), box.width, box.height));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // El cartel del píxel solo existe en un año exacto: en una transición no hay dato que nombrar.
  const still = !between && !playing;
  useEffect(() => {
    if (!still) setTip(null);
  }, [still]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (drag.current) {
      const d = drag.current;
      setTip(null);
      setView((v) => clampView({ k: v.k, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }, box.width, box.height));
      return;
    }
    if (!still || !classes || (e.target as HTMLElement).closest("button, .guide")) return setTip(null);
    const mx = e.clientX - box.left;
    const my = e.clientY - box.top;
    const px = Math.floor(((mx - view.x) / view.k / box.width) * info.width);
    const py = Math.floor(((my - view.y) / view.k / box.height) * info.height);
    if (px < 0 || py < 0 || px >= info.width || py >= info.height) return setTip(null);
    const cls = CLASS_ORDER[classes[py * info.width + px]] ?? "nodata";
    if (cls === "nodata") return setTip(null);
    setTip({ x: mx, y: my, cls });
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (view.k === 1 || (e.target as HTMLElement).closest("button, .guide")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSmooth(false);
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
  };
  const zoomed = view.k > 1;
  const viewStyle: React.CSSProperties = {
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
    transition: smooth ? "transform 0.25s cubic-bezier(0.3, 0.7, 0.2, 1)" : "none",
    imageRendering: view.k >= 3 ? "pixelated" : undefined,
  };
  const frameClass = ["cdl__frame", zoomed ? "cdl__frame--zoomed" : "", playing ? "cdl__frame--playing" : ""].filter(Boolean).join(" ");

  return (
    <figure className="cdl">
      <div
        ref={frame}
        className={frameClass}
        style={{ aspectRatio: `${info.width} / ${info.height}` }}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => setTip(null)}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("button, .guide")) return;
          const box = e.currentTarget.getBoundingClientRect();
          zoomBy(2, e.clientX - box.left, e.clientY - box.top);
        }}
      >
        <div className="cdl__clip">
          <div className="cdl__view" style={viewStyle}>
            <canvas
              key={epoch}
              ref={canvas}
              width={info.width}
              height={info.height}
              role="img"
              aria-label={`Map of ${countyName} County in ${year}, colored by the crop planted on each 30 meter square. The list next to it gives the same areas as text.`}
            />
          </div>
        </div>
        {broken ? (
          <div className="cdl__state">
            <Missing what="this browser can't draw the crop map" />
          </div>
        ) : status === "error" ? (
          <div className="cdl__state">
            <Missing what={`the ${year} crop map did not load`} />
          </div>
        ) : !classes ? (
          <div className="cdl__state cdl__state--loading">Loading the {year} crop map…</div>
        ) : null}
        {overlay}
        <div className="cdl__zoom">
          <button type="button" onClick={() => zoomBy(1.8)} disabled={view.k >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.8)} disabled={!zoomed} aria-label="Zoom out" title="Zoom out">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          {zoomed ? (
            <button
              type="button"
              className="cdl__zoom-reset"
              onClick={() => {
                setSmooth(true);
                setView(HOME);
              }}
            >
              Whole county
            </button>
          ) : null}
        </div>
        {tip ? (
          <div className="cdl__tip" style={{ left: tip.x, top: tip.y }}>
            <i
              style={{
                background: tip.cls === "non_ag" || tip.cls === "nodata" ? NON_AG_COLOR : CROP_COLOR[tip.cls],
              }}
            />
            {CLASS_LABEL[tip.cls]} in {year}
          </div>
        ) : null}
      </div>
    </figure>
  );
}
