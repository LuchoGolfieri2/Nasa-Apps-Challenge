import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RasterInfo } from "../data/types";
import { CLASS_LABEL, CLASS_ORDER, CROP_COLOR, NON_AG_COLOR, type ClassId, type CropId } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import type { RasterStatus } from "./useRasters";
import { Icon } from "../ui/Icon";

const NIGHT = [0x0f, 0x2a, 0x1d];
const MAX_ZOOM = 12;
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
function buildLut(highlight: CropId | null, dimAll = false): Uint32Array {
  const lut = new Uint32Array(256);
  CLASS_ORDER.forEach((cls, i) => {
    if (cls === "nodata") return; // transparente
    let [r, g, b] = rgb(cls === "non_ag" ? NON_AG_COLOR : CROP_COLOR[cls]);
    if (cls !== "non_ag" && (dimAll || (highlight && cls !== highlight))) {
      const k = 0.82;
      r = Math.round(r + (NIGHT[0] - r) * k);
      g = Math.round(g + (NIGHT[1] - g) * k);
      b = Math.round(b + (NIGHT[2] - b) * k);
    }
    lut[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  });
  return lut;
}

interface Props {
  info: RasterInfo;
  year: number;
  classes: Uint8Array | null;
  status: RasterStatus | undefined;
  highlight: CropId | null;
  countyName: string;
  /** Año anterior, para el modo "qué cambió". null en el primer año o si ese mapa no cargó. */
  prevYear: number | null;
  prevClasses: Uint8Array | null;
}

/** El condado pintado píxel a píxel (30 m) con el CDL del año (F17). */
export function CdlMap({ info, year, classes, status, highlight, countyName, prevYear, prevClasses }: Props) {
  const main = useRef<HTMLCanvasElement>(null);
  const fade = useRef<HTMLCanvasElement>(null);
  const drawnYear = useRef<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; cls: ClassId; was: ClassId | null } | null>(null);
  const lut = useMemo(() => buildLut(highlight), [highlight]);
  const dimLut = useMemo(() => buildLut(null, true), []);
  const frame = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(HOME);
  const [smooth, setSmooth] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [changesOn, setChangesOn] = useState(false);
  const showChanges = changesOn && !!prevClasses && !!classes;

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

  useEffect(() => setView(HOME), [info]);

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

  useEffect(() => {
    const canvas = main.current;
    const over = fade.current;
    if (!canvas || !over) return;
    const ctx = canvas.getContext("2d")!;

    // Fundido entre años: la capa de arriba conserva el año anterior y se desvanece.
    const yearChanged = drawnYear.current !== null && drawnYear.current !== year;
    if (yearChanged) {
      const octx = over.getContext("2d")!;
      octx.clearRect(0, 0, over.width, over.height);
      octx.drawImage(canvas, 0, 0);
      over.style.transition = "none";
      over.style.opacity = "1";
      void over.offsetWidth;
      over.style.transition = "";
      over.style.opacity = "0";
    }

    if (!classes) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      const img = ctx.createImageData(info.width, info.height);
      const px = new Uint32Array(img.data.buffer);
      if (showChanges) {
        // Solo queda a pleno color lo que cambió de cultivo respecto del año anterior.
        const prev = prevClasses!;
        for (let i = 0; i < classes.length; i++) {
          const c = classes[i];
          px[i] = c !== prev[i] && c >= FIRST_CROP ? lut[c] : dimLut[c];
        }
      } else {
        for (let i = 0; i < classes.length; i++) px[i] = lut[classes[i]];
      }
      ctx.putImageData(img, 0, 0);
    }
    drawnYear.current = year;
  }, [classes, lut, dimLut, showChanges, prevClasses, year, info.width, info.height]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (drag.current) {
      const d = drag.current;
      setTip(null);
      setView((v) => clampView({ k: v.k, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }, box.width, box.height));
      return;
    }
    if (!classes || (e.target as HTMLElement).closest("button")) return setTip(null);
    const mx = e.clientX - box.left;
    const my = e.clientY - box.top;
    const px = Math.floor(((mx - view.x) / view.k / box.width) * info.width);
    const py = Math.floor(((my - view.y) / view.k / box.height) * info.height);
    if (px < 0 || py < 0 || px >= info.width || py >= info.height) return setTip(null);
    const i = py * info.width + px;
    const cls = CLASS_ORDER[classes[i]] ?? "nodata";
    if (cls === "nodata") return setTip(null);
    const was = showChanges && prevClasses![i] !== classes[i] ? (CLASS_ORDER[prevClasses![i]] ?? null) : null;
    setTip({ x: mx, y: my, cls, was: was === "nodata" ? null : was });
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (view.k === 1 || (e.target as HTMLElement).closest("button")) return;
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

  return (
    <figure className="cdl">
      <div
        ref={frame}
        className={zoomed ? "cdl__frame cdl__frame--zoomed" : "cdl__frame"}
        style={{ aspectRatio: `${info.width} / ${info.height}` }}
        onPointerMove={onMove}
        onPointerDown={onDown}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerLeave={() => setTip(null)}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          const box = e.currentTarget.getBoundingClientRect();
          zoomBy(2, e.clientX - box.left, e.clientY - box.top);
        }}
      >
        <div className="cdl__clip">
          <div className="cdl__view" style={viewStyle}>
            <canvas
              ref={main}
              width={info.width}
              height={info.height}
              role="img"
              aria-label={`Map of ${countyName} County in ${year}, colored by the crop planted on each 30 meter square. The bar list next to it gives the same areas as text.`}
            />
            <canvas ref={fade} width={info.width} height={info.height} className="cdl__fade" aria-hidden="true" />
          </div>
        </div>
        {status === "error" ? (
          <div className="cdl__state">
            <Missing what={`the ${year} crop map did not load`} />
          </div>
        ) : !classes ? (
          <div className="cdl__state cdl__state--loading">Loading the {year} crop map…</div>
        ) : null}
        <div className="cdl__zoom">
          <button type="button" onClick={() => zoomBy(1.8)} disabled={view.k >= MAX_ZOOM} aria-label="Zoom in">
            <Icon name="plus" size={20} />
          </button>
          <button type="button" onClick={() => zoomBy(1 / 1.8)} disabled={!zoomed} aria-label="Zoom out">
            <Icon name="minus" size={20} />
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
            {tip.was ? <span className="cdl__was">{`, ${CLASS_LABEL[tip.was].toLowerCase()} in ${prevYear}`}</span> : null}
          </div>
        ) : null}
      </div>
      <figcaption>
        <span>
          {showChanges
            ? changedPct === null
              ? `Bright squares have a different crop than in ${prevYear}.`
              : `${changedPct}% of cropland has a different crop than in ${prevYear}. Those squares stay bright.`
            : `What was planted in ${year}, square by square (30 m).`}
        </span>
        <button
          type="button"
          className="cdl__toggle"
          aria-pressed={showChanges}
          disabled={!prevClasses || !classes}
          onClick={() => setChangesOn((on) => !on)}
          title={prevYear === null ? "There is no earlier year to compare with" : undefined}
        >
          {prevYear === null ? "No earlier year to compare" : `What changed since ${prevYear}`}
        </button>
        <SourceChip source={info.source} />
      </figcaption>
    </figure>
  );
}
