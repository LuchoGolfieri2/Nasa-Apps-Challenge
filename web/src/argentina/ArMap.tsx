import { useMemo, useState } from "react";
import type { ArCrop, ArFeature, Zone } from "./data";
import { CROP_LABEL, ZONE_SHORT } from "./data";

/**
 * Mapa plano de los 219 departamentos (SVG, sin WebGL). Dos lecturas:
 *  - "zone": qué tan parecido es el clima al del Corn Belt (dentro / cerca / fuera).
 *  - un cultivo: rinde real (MAGyP) ÷ rinde de sus condados análogos de EE. UU.
 */
export type ArMode = "zone" | ArCrop;

export const ZONE_FILL: Record<Zone, string> = { dentro: "#2f7d4f", cerca: "#e9b949", fuera: "#d9ddd5" };

// Divergente: marrón (rinde menos que sus análogos) → blanco (igual) → verde (rinde más).
const LOW = [107, 74, 47];
const MID = [246, 241, 228];
const HIGH = [31, 91, 58];
export function ratioFill(r: number) {
  const t = Math.max(-1, Math.min(1, Math.log2(r) / Math.log2(2.2)));
  const to = t < 0 ? LOW : HIGH;
  const f = Math.abs(t);
  return `rgb(${MID.map((m, i) => Math.round(m + (to[i] - m) * f)).join(",")})`;
}

const W = 520;

function project(features: ArFeature[]) {
  const rings = (g: ArFeature["geometry"]) =>
    g.type === "Polygon" ? (g.coordinates as number[][][]) : (g.coordinates as number[][][][]).flat();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const f of features)
    for (const r of rings(f.geometry))
      for (const [lon, lat] of r) {
        x0 = Math.min(x0, lon); x1 = Math.max(x1, lon); y0 = Math.min(y0, lat); y1 = Math.max(y1, lat);
      }
  const k = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const s = (W - 4) / ((x1 - x0) * k);
  const h = Math.round((y1 - y0) * s + 4);
  const shapes = features.map((f) => {
    let cx = 0, cy = 0, n = 0;
    const d = rings(f.geometry)
      .map(
        (r) =>
          r
            .map(([lon, lat], i) => {
              const X = 2 + (lon - x0) * k * s;
              const Y = 2 + (y1 - lat) * s;
              cx += X; cy += Y; n++;
              return `${i ? "L" : "M"}${X.toFixed(1)} ${Y.toFixed(1)}`;
            })
            .join("") + "Z",
      )
      .join("");
    return { p: f.properties, d, cx: cx / n, cy: cy / n };
  });
  return { shapes, h };
}

export function ArMap({
  features,
  mode,
  selected,
  onPick,
}: {
  features: ArFeature[];
  mode: ArMode;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  const geo = useMemo(() => project(features), [features]);
  const [hover, setHover] = useState<string | null>(null);
  const fill = (p: ArFeature["properties"]) => {
    if (mode === "zone") return ZONE_FILL[p.zone];
    const r = p[`ratio_${mode}` as const];
    return r === null ? "url(#ar-hatch)" : ratioFill(r);
  };
  const sel = geo.shapes.find((s) => s.p.id_depto === selected);
  const hv = geo.shapes.find((s) => s.p.id_depto === hover);
  const label = (p: ArFeature["properties"]) => {
    if (mode === "zone") return ZONE_SHORT[p.zone];
    const r = p[`ratio_${mode}` as const];
    return r === null ? "Missing data" : `${CROP_LABEL[mode]}: ${Math.round(r * 100)}% of its U.S. analogs`;
  };

  return (
    <div className="ar-map">
      <svg
        viewBox={`0 0 ${W} ${geo.h}`}
        role="img"
        aria-label={
          mode === "zone"
            ? "Map of the Pampas departments colored by how close their weather is to the U.S. Corn Belt."
            : `Map of the Pampas departments colored by ${CROP_LABEL[mode].toLowerCase()} yield compared with their U.S. weather analogs.`
        }
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <pattern id="ar-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="#eef0eb" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="#c9cec5" strokeWidth="2" />
          </pattern>
        </defs>
        {geo.shapes.map((s) => (
          <path
            key={s.p.id_depto}
            d={s.d}
            className="ar-map__dep"
            style={{ fill: fill(s.p) }}
            onMouseEnter={() => setHover(s.p.id_depto)}
            onClick={() => onPick(s.p.id_depto)}
          />
        ))}
        {sel ? <path d={sel.d} className="ar-map__sel-halo" /> : null}
        {sel ? <path d={sel.d} className="ar-map__sel" /> : null}
        {hv && hv !== sel ? <path d={hv.d} className="ar-map__hover" /> : null}
      </svg>
      {hv ? (
        <p className="ar-map__tip" style={{ left: `${(100 * hv.cx) / W}%`, top: `${(100 * hv.cy) / geo.h}%` }} aria-hidden="true">
          <b>{hv.p.name}</b> <span>{hv.p.province}</span>
          <br />
          {label(hv.p)}
        </p>
      ) : null}
    </div>
  );
}
