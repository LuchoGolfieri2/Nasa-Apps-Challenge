import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RasterInfo } from "../data/types";
import { CLASS_LABEL, CLASS_ORDER, CROP_COLOR, NON_AG_COLOR, type ClassId, type CropId } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import { createRenderer, type CdlRenderer, type Frame } from "./cdlRenderer";
import type { CdlView, Placement } from "./CountyGlobe";
import type { Playback } from "./usePlayback";
import type { Rasters } from "./useRasters";

const NIGHT = [0x0f, 0x2a, 0x1d];
const MAX_ZOOM = 12;
/** Parte de la transición que dura el fundido de cada lote: 150 ms de los 800 ms. */
const BLOCK_FADE = 0.1875;
/** Primer índice de clase que es un cultivo (0 = fuera del condado, 1 = sin cultivo). */
const FIRST_CROP = 2;

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
export function buildLut(highlight: CropId | readonly CropId[] | null, dimAll = false): Uint32Array {
  const lit = highlight === null ? null : typeof highlight === "string" ? [highlight] : highlight;
  const lut = new Uint32Array(256);
  CLASS_ORDER.forEach((cls, i) => {
    if (cls === "nodata") return; // transparente
    let [r, g, b] = rgb(cls === "non_ag" ? NON_AG_COLOR : CROP_COLOR[cls]);
    if (cls !== "non_ag" && (dimAll || (lit && !lit.includes(cls)))) {
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
  /** Cultivo (o grupo, como "Other crops") que queda encendido; el resto se funde con el fondo. */
  highlight: CropId | readonly CropId[] | null;
  countyName: string;
  /** Controles extra sobre el mapa (la guía de lectura). */
  overlay?: React.ReactNode;
  /**
   * Sobre el globo (CountyGlobe): el marco va justo sobre el condado, girado como el ráster, sin recorte; los
   * controles y el epígrafe quedan sobre el globo, y cada zoom se avisa con `onView` para mover la cámara.
   */
  placement?: Placement;
  onView?: (view: CdlView) => void;
}

/** Duración del zoom animado (botones, doble clic, "Whole county"). */
const ZOOM_MS = 250;

/**
 * El condado pintado píxel a píxel (30 m) con el CDL (F17). Entre dos años los lotes cambian de cultivo de a
 * poco: eso es animación, no un dato. Solo un año exacto muestra el CDL tal cual (ver cdlRenderer.ts).
 */
export function CdlMap({
  info,
  years,
  rasters,
  pb,
  index,
  playing,
  between,
  highlight,
  countyName,
  overlay,
  placement,
  onView,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<CdlRenderer | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [broken, setBroken] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; cls: ClassId; was: ClassId | null } | null>(null);
  const lut = useMemo(() => buildLut(highlight), [highlight]);
  const lutRef = useRef(lut);
  lutRef.current = lut;
  const frame = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(HOME);
  const [smooth, setSmooth] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const fig = useRef<HTMLElement>(null);
  const tween = useRef(0);
  const placementRef = useRef(placement);
  placementRef.current = placement;

  /**
   * Punto del puntero en px del marco sin zoom (x hacia la derecha del ráster, y hacia abajo) y tamaño del marco;
   * fx, fy: el mismo punto en px de la figura, para el cartel. Sobre el globo el marco está girado: se deshace el giro.
   */
  const local = useCallback((clientX: number, clientY: number) => {
    const p = placementRef.current;
    if (p && fig.current) {
      const box = fig.current.getBoundingClientRect();
      const dx = clientX - box.left - p.left;
      const dy = clientY - box.top - p.top;
      const cos = Math.cos(p.angle);
      const sin = Math.sin(p.angle);
      return {
        mx: cos * dx + sin * dy,
        my: -sin * dx + cos * dy,
        w: p.width,
        h: p.height,
        fx: clientX - box.left,
        fy: clientY - box.top,
      };
    }
    const box = frame.current!.getBoundingClientRect();
    const mx = clientX - box.left;
    const my = clientY - box.top;
    return { mx, my, w: box.width, h: box.height, fx: mx, fy: my };
  }, []);

  /** Cambia el zoom. Sobre el globo se anima cuadro a cuadro, así la cámara lo sigue sin despegarse. */
  const goTo = useCallback((next: View, animate: boolean) => {
    cancelAnimationFrame(tween.current);
    if (!placementRef.current || !animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSmooth(animate && !placementRef.current);
      setView(next);
      return;
    }
    setSmooth(false);
    const from = viewRef.current;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ZOOM_MS);
      const e = 1 - Math.pow(1 - t, 3);
      // el zoom avanza en escala logarítmica y el corrimiento lo acompaña, así el punto elegido queda quieto
      const k = from.k * Math.pow(next.k / from.k, e);
      const a = next.k === from.k ? e : (k - from.k) / (next.k - from.k);
      setView({ k, x: from.x + (next.x - from.x) * a, y: from.y + (next.y - from.y) * a });
      if (t < 1) tween.current = requestAnimationFrame(step);
    };
    tween.current = requestAnimationFrame(step);
  }, []);
  useEffect(() => () => cancelAnimationFrame(tween.current), []);
  useEffect(() => onView?.(view), [view, onView]);

  const year = years[index];
  const status = rasters.status[year];
  const classes = rasters.get(year);

  // Modo "qué cambió": solo en un año exacto, comparado con el año anterior.
  const still = !between && !playing;
  const prevYear = index > 0 ? years[index - 1] : null;
  const prevClasses = prevYear === null ? null : rasters.get(prevYear);
  const changes = useRef<HTMLCanvasElement>(null);
  const [changesOn, setChangesOn] = useState(false);
  const canCompare = !!prevClasses && !!classes;
  const showChanges = changesOn && canCompare && still;
  const dimLut = useMemo(() => buildLut(null, true), []);

  // Parte del área con cultivo que tiene otro cultivo que el año anterior.
  const changedPct = useMemo(() => {
    if (!showChanges) return null;
    let crop = 0;
    let changed = 0;
    for (let i = 0; i < classes!.length; i++) {
      if (classes![i] < FIRST_CROP) continue;
      crop++;
      if (classes![i] !== prevClasses![i]) changed++;
    }
    return crop ? Math.round((100 * changed) / crop) : null;
  }, [showChanges, classes, prevClasses]);

  // La capa tapa el mapa con el mismo año: a pleno color solo lo que cambió de cultivo.
  useEffect(() => {
    const el = changes.current;
    if (!el || !showChanges) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(info.width, info.height);
    const px = new Uint32Array(img.data.buffer);
    const prev = prevClasses!;
    for (let i = 0; i < classes!.length; i++) {
      const c = classes![i];
      px[i] = c !== prev[i] && c >= FIRST_CROP ? lut[c] : dimLut[c];
    }
    ctx.putImageData(img, 0, 0);
  }, [showChanges, classes, prevClasses, lut, dimLut, info.width, info.height]);

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

  useEffect(() => setView(HOME), [info, placement?.width, placement?.height]);

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

  const zoomBy = useCallback(
    (factor: number, mx?: number, my?: number, animate = true) => {
      const p = placementRef.current;
      const box = frame.current?.getBoundingClientRect();
      if (!box) return;
      const w = p ? p.width : box.width;
      const h = p ? p.height : box.height;
      goTo(zoomAt(viewRef.current, mx ?? w / 2, my ?? h / 2, factor, w, h), animate);
    },
    [goTo],
  );

  // La rueda acerca y aleja. Con el mapa entero, alejar deja pasar el scroll de la página.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const v = viewRef.current;
      if (v.k === 1 && e.deltaY > 0) return;
      e.preventDefault();
      const { mx, my, w, h } = local(e.clientX, e.clientY);
      goTo(zoomAt(v, mx, my, Math.exp(-e.deltaY * 0.0022), w, h), false);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [local, goTo]);

  // El cartel del píxel solo existe en un año exacto: en una transición no hay dato que nombrar.
  useEffect(() => {
    if (!still) setTip(null);
  }, [still]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { mx, my, w, h, fx, fy } = local(e.clientX, e.clientY);
    if (drag.current) {
      const d = drag.current;
      setTip(null);
      cancelAnimationFrame(tween.current);
      setView((v) => clampView({ k: v.k, x: d.x + mx - d.px, y: d.y + my - d.py }, w, h));
      return;
    }
    if (!still || !classes || (e.target as HTMLElement).closest("button, .guide")) return setTip(null);
    const px = Math.floor(((mx - view.x) / view.k / w) * info.width);
    const py = Math.floor(((my - view.y) / view.k / h) * info.height);
    if (px < 0 || py < 0 || px >= info.width || py >= info.height) return setTip(null);
    const i = py * info.width + px;
    const cls = CLASS_ORDER[classes[i]] ?? "nodata";
    if (cls === "nodata") return setTip(null);
    const was = showChanges && prevClasses![i] !== classes[i] ? (CLASS_ORDER[prevClasses![i]] ?? null) : null;
    setTip({ x: fx, y: fy, cls, was: was === "nodata" ? null : was });
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (view.k === 1 || (e.target as HTMLElement).closest("button, .guide")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSmooth(false);
    cancelAnimationFrame(tween.current);
    const { mx, my } = local(e.clientX, e.clientY);
    drag.current = { px: mx, py: my, x: view.x, y: view.y };
  };
  const zoomed = view.k > 1;
  const viewStyle: React.CSSProperties = {
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
    transition: smooth ? "transform 0.25s cubic-bezier(0.3, 0.7, 0.2, 1)" : "none",
    imageRendering: view.k >= 3 ? "pixelated" : undefined,
  };
  const frameClass = ["cdl__frame", zoomed ? "cdl__frame--zoomed" : "", playing ? "cdl__frame--playing" : ""].filter(Boolean).join(" ");

  const frameStyle: React.CSSProperties = placement
    ? {
        position: "absolute",
        left: placement.left,
        top: placement.top,
        width: placement.width,
        height: placement.height,
        transform: `rotate(${placement.angle}rad)`,
        transformOrigin: "0 0",
      }
    : { aspectRatio: `${info.width} / ${info.height}` };
  const controls = (
    <>
      {overlay}
      <div className="cdl__zoom">
        <button type="button" className="solid-btn" onClick={() => zoomBy(1.8)} disabled={view.k >= MAX_ZOOM} aria-label="Zoom in" title="Zoom in">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className="solid-btn" onClick={() => zoomBy(1 / 1.8)} disabled={!zoomed} aria-label="Zoom out" title="Zoom out">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        {zoomed ? (
          <button type="button" className="cdl__zoom-reset solid-btn" onClick={() => goTo(HOME, true)}>
            Whole county
          </button>
        ) : null}
      </div>
    </>
  );
  const tipEl = tip ? (
    <div className="cdl__tip" style={{ left: tip.x, top: tip.y }}>
      <i
        style={{
          background: tip.cls === "non_ag" || tip.cls === "nodata" ? NON_AG_COLOR : CROP_COLOR[tip.cls],
        }}
      />
      {CLASS_LABEL[tip.cls]} in {year}
      {tip.was ? <span className="cdl__was">{`, ${CLASS_LABEL[tip.was].toLowerCase()} in ${prevYear}`}</span> : null}
    </div>
  ) : null;

  return (
    <figure ref={fig} className={placement ? "cdl cdl--globe" : "cdl"}>
      <div
        ref={frame}
        className={frameClass}
        style={frameStyle}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => setTip(null)}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("button, .guide")) return;
          const { mx, my } = local(e.clientX, e.clientY);
          zoomBy(2, mx, my);
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
              aria-label={`Map of ${countyName} County in ${year}, colored by the crop planted on each ${info.pixel_m} meter square. The list next to it gives the same areas as text.`}
            />
            {showChanges ? (
              <canvas ref={changes} width={info.width} height={info.height} className="cdl__changes" aria-hidden="true" />
            ) : null}
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
        {placement ? null : controls}
        {placement ? null : tipEl}
      </div>
      {placement ? controls : null}
      {placement ? tipEl : null}
      {/* Sobre el globo no va epígrafe: la fuente ya figura en "Acres by crop" */}
      {placement ? null : (
      <figcaption>
        <span>
          {showChanges
            ? changedPct === null
              ? `Bright squares have a different crop than in ${prevYear}.`
              : `${changedPct}% of cropland has a different crop than in ${prevYear}. Those squares stay bright.`
            : `What was planted in ${year}, square by square (${info.pixel_m} m${info.pixel_m > 30 ? ", lower detail" : ""}).`}
        </span>
        <button
          type="button"
          className="cdl__toggle"
          aria-pressed={changesOn && canCompare}
          disabled={!canCompare}
          onClick={() => setChangesOn((on) => !on)}
          title={prevYear === null ? "There is no earlier year to compare with" : undefined}
        >
          {prevYear === null ? "No earlier year to compare" : `What changed since ${prevYear}`}
        </button>
        <SourceChip source={info.source} />
      </figcaption>
      )}
    </figure>
  );
}
