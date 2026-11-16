/** Gráficos del tablero My Farm v2 (Figma 31:2). Sin librerías: cuadros por año, barras de rotación y barras de rinde. */
import type { CSSProperties } from "react";

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** Un cuadro por año de clima: lleno si el consejo dejó más que la base */
export function WinPips({ years, a, b }: { years: number[]; a: Array<number | null>; b: Array<number | null> }) {
  return (
    <div className="crm-pips">
      <div className="crm-pips-row">
        {years.map((y, i) => {
          const none = a[i] == null || b[i] == null;
          const won = !none && (a[i] as number) > (b[i] as number);
          return (
            <span
              key={y}
              className={`crm-pip crm-in-pip${none ? " crm-pip--none" : won ? " crm-pip--win" : ""}`}
              style={delay(500 + i * 30)}
              title={`${y}: ${none ? "missing data" : won ? "advice paid more" : "advice paid less"}`}
            />
          );
        })}
      </div>
      <div className="crm-pips-ends" aria-hidden="true">
        <span>{years[0]}</span>
        <span>{years[years.length - 1]}</span>
      </div>
    </div>
  );
}

export interface ShareRow {
  key: string;
  label: string;
  pct: number;
  tone: "on" | "repeat" | "other";
  suggested: boolean;
}

/** Parte de las tierras agrícolas del condado por paso de cultivo (CDL) */
export function ShareBars({ rows }: { rows: ShareRow[] }) {
  return (
    <ul className="crm-shares">
      {rows.map((r, i) => (
        <li key={r.key} className="crm-in" style={delay(200 + i * 40)}>
          <div className="crm-share-t">
            <span className={r.suggested ? "crm-share-on" : undefined}>
              {r.label}
              {r.suggested ? <span className="crm-tag">Suggested</span> : null}
            </span>
            <b>{Math.round(r.pct * 10) / 10}%</b>
          </div>
          <span className="crm-share-track" aria-hidden="true">
            <span className={`crm-share-bar crm-share-bar--${r.tone}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface YieldPoint {
  year: number;
  value: number | null;
  flag: "below" | "above" | null;
}

/** Rinde del condado por año: rojo si quedó por debajo de lo habitual, borde en la última cosecha, línea del promedio */
export function YieldBars({ points, usual }: { points: YieldPoint[]; usual: number | null }) {
  const w = 540;
  const h = 214;
  const top = 22;
  const base = 186;
  const right = usual != null ? 64 : 0;
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  if (!vals.length) return null;
  const hi = Math.max(...vals, usual ?? 0) * 1.04;
  const lo = Math.max(0, Math.floor((Math.min(...vals) * 0.55) / 10) * 10);
  const Y = (v: number) => base - ((v - lo) / (hi - lo)) * (base - top);
  const slot = (w - right) / points.length;
  const bw = Math.min(28, slot * 0.66);
  const last = points.length - 1;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      role="img"
      aria-label={`County yield by year, bushels per acre: ${points
        .map((p) => `${p.year} ${p.value == null ? "missing data" : Math.round(p.value)}`)
        .join(", ")}`}
      className="crm-ybars"
    >
      {points.map((p, i) => {
        const cx = slot * (i + 0.5);
        const label = i === last ? String(p.year) : `’${String(p.year).slice(2)}`;
        const yl = (
          <text x={cx} y={h - 6} textAnchor="middle" className={`crm-axis${i === last ? " crm-axis--last" : ""}`}>
            {label}
          </text>
        );
        if (p.value == null)
          return (
            <g key={p.year}>
              <text x={cx} y={base - 6} textAnchor="middle" className="crm-axis">
                —
              </text>
              {yl}
            </g>
          );
        const y = Y(p.value);
        const low = p.flag === "below";
        const cls = `crm-ybar crm-in-bar${low ? " crm-ybar--low" : ""}${i === last ? " crm-ybar--last" : ""}`;
        return (
          <g key={p.year}>
            <path
              d={`M${cx - bw / 2},${base}V${y + 4}q0,-4 4,-4h${bw - 8}q4,0 4,4V${base}Z`}
              className={cls}
              style={delay(300 + i * 35)}
            />
            <text
              x={cx}
              y={y - 6}
              textAnchor="middle"
              className={`crm-yval${low ? " crm-yval--low" : ""}${i === last ? " crm-yval--last" : ""}`}
            >
              {Math.round(p.value)}
            </text>
            {yl}
          </g>
        );
      })}
      {usual != null ? (
        <g className="crm-usual crm-in-fade" style={delay(750)}>
          <line x1={0} x2={w - right + 4} y1={Y(usual)} y2={Y(usual)} />
          <text x={w - right + 10} y={Y(usual) + 4}>
            Usual {Math.round(usual)}
          </text>
        </g>
      ) : null}
      <line x1={0} x2={w - right} y1={base} y2={base} className="crm-trend-base" />
    </svg>
  );
}
