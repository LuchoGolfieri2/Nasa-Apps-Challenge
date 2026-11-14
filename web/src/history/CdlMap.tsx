import { useEffect, useMemo, useRef, useState } from "react";
import type { RasterInfo } from "../data/types";
import { CLASS_LABEL, CLASS_ORDER, CROP_COLOR, NON_AG_COLOR, type ClassId, type CropId } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import type { RasterStatus } from "./useRasters";

const NIGHT = [0x0f, 0x2a, 0x1d];

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Tabla clase -> color (ABGR, como lo espera ImageData). Lo no resaltado se funde con el fondo. */
function buildLut(highlight: CropId | null): Uint32Array {
  const lut = new Uint32Array(256);
  CLASS_ORDER.forEach((cls, i) => {
    if (cls === "nodata") return; // transparente
    let [r, g, b] = rgb(cls === "non_ag" ? NON_AG_COLOR : CROP_COLOR[cls]);
    if (highlight && cls !== "non_ag" && cls !== highlight) {
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
}

/** El condado pintado píxel a píxel (30 m) con el CDL del año (F17). */
export function CdlMap({ info, year, classes, status, highlight, countyName }: Props) {
  const main = useRef<HTMLCanvasElement>(null);
  const fade = useRef<HTMLCanvasElement>(null);
  const drawnYear = useRef<number | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; cls: ClassId } | null>(null);
  const lut = useMemo(() => buildLut(highlight), [highlight]);

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
      for (let i = 0; i < classes.length; i++) px[i] = lut[classes[i]];
      ctx.putImageData(img, 0, 0);
    }
    drawnYear.current = year;
  }, [classes, lut, year, info.width, info.height]);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!classes) return;
    const box = e.currentTarget.getBoundingClientRect();
    const px = Math.floor(((e.clientX - box.left) / box.width) * info.width);
    const py = Math.floor(((e.clientY - box.top) / box.height) * info.height);
    if (px < 0 || py < 0 || px >= info.width || py >= info.height) return setTip(null);
    const cls = CLASS_ORDER[classes[py * info.width + px]] ?? "nodata";
    if (cls === "nodata") return setTip(null);
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, cls });
  };

  return (
    <figure className="cdl">
      <div
        className="cdl__frame"
        style={{ aspectRatio: `${info.width} / ${info.height}` }}
        onPointerMove={onMove}
        onPointerLeave={() => setTip(null)}
      >
        <canvas
          ref={main}
          width={info.width}
          height={info.height}
          role="img"
          aria-label={`Map of ${countyName} County in ${year}, colored by the crop planted on each 30 meter square. The bar list next to it gives the same areas as text.`}
        />
        <canvas ref={fade} width={info.width} height={info.height} className="cdl__fade" aria-hidden="true" />
        {status === "error" ? (
          <div className="cdl__state">
            <Missing what={`the ${year} crop map did not load`} />
          </div>
        ) : !classes ? (
          <div className="cdl__state cdl__state--loading">Loading the {year} crop map…</div>
        ) : null}
        {tip ? (
          <div className="cdl__tip" style={{ left: tip.x, top: tip.y }}>
            <i
              style={{
                background: tip.cls === "non_ag" || tip.cls === "nodata" ? NON_AG_COLOR : CROP_COLOR[tip.cls],
              }}
            />
            {CLASS_LABEL[tip.cls]} · {year}
          </div>
        ) : null}
      </div>
      <figcaption>
        <span>What was planted in {year}, square by square (30 m).</span>
        <SourceChip source={info.source} />
      </figcaption>
    </figure>
  );
}
