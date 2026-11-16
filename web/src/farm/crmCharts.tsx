/** Gráficos SVG del tablero CRM de My Farm (F40). Sin librerías: líneas suaves, medio anillo y barras. */
import { useEffect, useRef, useState } from "react";
import { signed, usd } from "./crm";

const nice = (lo: number, hi: number) => {
  const span = Math.max(hi - lo, 1);
  const step = [10, 20, 25, 50, 100, 200, 250, 500].find((s) => span / s <= 5) ?? 1000;
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
};

function smooth(pts: Array<[number, number] | null>) {
  let d = "";
  let prev: [number, number] | null = null;
  for (const p of pts) {
    if (!p) {
      prev = null;
      continue;
    }
    if (!prev) d += `M${p[0]},${p[1]}`;
    else {
      const cx = (prev[0] + p[0]) / 2;
      d += `C${cx},${prev[1]} ${cx},${p[1]} ${p[0]},${p[1]}`;
    }
    prev = p;
  }
  return d;
}

/** Ingreso por año de clima: el consejo contra la base, con detalle del año elegido */
export function IncomeChart({
  years,
  a,
  b,
  aLabel,
  bLabel,
}: {
  years: number[];
  a: Array<number | null>;
  b: Array<number | null>;
  aLabel: string;
  bLabel: string;
}) {
  // el ancho del SVG sigue al contenedor: así el texto del eje no se achica en el celular
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(760);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 520 ? 230 : 280;
  const [t, r, bot, l] = [16, 16, 30, 52];
  const vals = [...a, ...b].filter((v): v is number => v != null);
  const { lo, hi, step } = nice(Math.min(...vals), Math.max(...vals));
  const X = (i: number) => l + (i * (W - l - r)) / Math.max(years.length - 1, 1);
  const Y = (v: number) => t + (H - t - bot) * (1 - (v - lo) / (hi - lo));
  const lastIdx = (() => {
    for (let i = years.length - 1; i >= 0; i--) if (a[i] != null && b[i] != null) return i;
    return 0;
  })();
  const [sel, setSel] = useState(lastIdx);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const pa = a.map((v, i) => (v == null ? null : ([X(i), Y(v)] as [number, number])));
  const pb = b.map((v, i) => (v == null ? null : ([X(i), Y(v)] as [number, number])));
  const da = smooth(pa);
  const firstA = pa.findIndex(Boolean);
  const lastA = pa.length - 1 - [...pa].reverse().findIndex(Boolean);
  const area = da ? `${da}L${X(lastA)},${Y(lo)}L${X(firstA)},${Y(lo)}Z` : "";
  const av = a[sel];
  const bv = b[sel];
  const tipLeft = X(sel) / W > 0.6;
  const every = Math.max(1, Math.ceil(years.length / Math.floor((W - l - r) / 46)));

  return (
    <div className="crm-chart" ref={box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`${aLabel} and ${bLabel}, dollars per acre, under the weather of ${years[0]} to ${years[years.length - 1]}`}
        onMouseLeave={() => setSel(lastIdx)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={l} x2={W - r} y1={Y(v)} y2={Y(v)} className="crm-gridline" />
            <text x={l - 8} y={Y(v) + 4} textAnchor="end" className="crm-axis">
              {usd(v)}
            </text>
          </g>
        ))}
        {years.map((y, i) =>
          i % every === 0 || i === years.length - 1 ? (
            <text key={y} x={X(i)} y={H - 8} textAnchor="middle" className="crm-axis">
              {y}
            </text>
          ) : null,
        )}
        <path d={area} className="crm-area" />
        <path d={smooth(pb)} className="crm-line crm-line--b" />
        <path d={da} className="crm-line crm-line--a" />
        <line x1={X(sel)} x2={X(sel)} y1={t} y2={Y(lo)} className="crm-cursor" />
        {bv != null ? <circle cx={X(sel)} cy={Y(bv)} r={5} className="crm-dot crm-dot--b" /> : null}
        {av != null ? <circle cx={X(sel)} cy={Y(av)} r={5.5} className="crm-dot crm-dot--a" /> : null}
        {years.map((y, i) => (
          <rect
            key={y}
            x={X(i) - (W - l - r) / years.length / 2}
            y={t}
            width={(W - l - r) / years.length}
            height={H - t - bot}
            fill="transparent"
            onMouseEnter={() => setSel(i)}
            onClick={() => setSel(i)}
          />
        ))}
      </svg>
      <div
        className="crm-tip"
        style={tipLeft ? { right: `${100 - (X(sel) / W) * 100 + 2}%` } : { left: `${(X(sel) / W) * 100 + 2}%` }}
        aria-live="polite"
      >
        <b>Weather of {years[sel]}</b>
        <span className="crm-tip-row">
          <span>{aLabel}</span>
          <b className="crm-a">{av == null ? "—" : usd(av)}</b>
        </span>
        <span className="crm-tip-row">
          <span>{bLabel}</span>
          <b className="crm-b">{bv == null ? "—" : usd(bv)}</b>
        </span>
        {av != null && bv != null ? (
          <span className="crm-tip-row crm-tip-diff">
            <span>Difference</span>
            <b className={av - bv >= 0 ? "crm-up" : "crm-down"}>{signed(av - bv)}/ac</b>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function Spark({ values, tone }: { values: Array<number | null>; tone: "a" | "b" }) {
  const v = values.filter((x): x is number => x != null);
  if (v.length < 2) return null;
  const w = 160;
  const h = 34;
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  const pts = values
    .map((x, i) =>
      x == null ? null : `${(i * w) / (values.length - 1)},${h - 3 - ((x - lo) / (hi - lo || 1)) * (h - 6)}`,
    )
    .filter(Boolean)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} aria-hidden="true" className="crm-spark">
      <polyline points={pts} className={`crm-spark-line crm-spark-line--${tone}`} />
    </svg>
  );
}

/** Una pastilla por año de clima: verde si el consejo dejó más */
export function WinPips({ years, a, b }: { years: number[]; a: Array<number | null>; b: Array<number | null> }) {
  return (
    <div className="crm-pips">
      <div className="crm-pips-row">
        {years.map((y, i) => {
          const won = a[i] != null && b[i] != null && (a[i] as number) > (b[i] as number);
          const none = a[i] == null || b[i] == null;
          return (
            <span
              key={y}
              className={none ? "crm-pip crm-pip--none" : won ? "crm-pip crm-pip--win" : "crm-pip"}
              title={`${y}: ${none ? "missing data" : won ? "advice paid more" : "advice paid less"}`}
            />
          );
        })}
      </div>
      <div className="crm-pips-ends">
        <span>{years[0]}</span>
        <span>{years[years.length - 1]}</span>
      </div>
    </div>
  );
}

/** Medio anillo por partes (quién ya hace cada rotación) */
export function HalfRing({ parts }: { parts: Array<{ pct: number; color: string; label: string }> }) {
  const w = 280;
  const cx = w / 2;
  const cy = w / 2;
  const R = w / 2 - 6;
  const rr = R - 36;
  const total = parts.reduce((s, p) => s + p.pct, 0) || 1;
  const pt = (a: number, rad: number) => [cx + rad * Math.cos(Math.PI - a), cy - rad * Math.sin(Math.PI - a)];
  const gap = 3 / R;
  let a0 = 0;
  return (
    <svg
      viewBox={`0 0 ${w} ${w / 2 + 4}`}
      width="100%"
      role="img"
      aria-label={parts.map((p) => `${p.label} ${p.pct}%`).join(", ")}
    >
      {parts.map((p) => {
        const a1 = a0 + (p.pct / total) * Math.PI;
        const s0 = a0 + (a0 > 0 ? gap / 2 : 0);
        const s1 = a1 - (a1 < Math.PI - 1e-6 ? gap / 2 : 0);
        a0 = a1;
        if (s1 <= s0) return null;
        const [x0, y0] = pt(s0, R);
        const [x1, y1] = pt(s1, R);
        const [x2, y2] = pt(s1, rr);
        const [x3, y3] = pt(s0, rr);
        return (
          <path
            key={p.label}
            d={`M${x0},${y0}A${R},${R} 0 0 1 ${x1},${y1}L${x2},${y2}A${rr},${rr} 0 0 0 ${x3},${y3}Z`}
            fill={p.color}
          />
        );
      })}
    </svg>
  );
}

export function YieldBars({
  points,
}: {
  points: Array<{ year: number; value: number | null; flag: "below" | "above" | null }>;
}) {
  const w = 540;
  const h = 220;
  const t = 20;
  const b = 24;
  const vals = points.map((p) => p.value).filter((v): v is number => v != null);
  if (!vals.length) return null;
  const hi = Math.max(...vals) * 1.06;
  const lo = Math.max(0, Math.floor((Math.min(...vals) * 0.6) / 10) * 10);
  const slot = w / points.length;
  const bw = slot * 0.62;
  const last = points.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="County yield by year">
      {points.map((p, i) => {
        const cx = slot * (i + 0.5);
        const label = `'${String(p.year).slice(2)}`;
        if (p.value == null)
          return (
            <g key={p.year}>
              <text x={cx} y={t + (h - t - b) - 4} textAnchor="middle" className="crm-axis">
                —
              </text>
              <text x={cx} y={h - 6} textAnchor="middle" className="crm-axis">
                {label}
              </text>
            </g>
          );
        const bh = ((p.value - lo) / (hi - lo)) * (h - t - b);
        const cls = p.flag === "below" ? "crm-bar crm-bar--low" : i === last ? "crm-bar crm-bar--last" : "crm-bar";
        return (
          <g key={p.year}>
            <rect x={cx - bw / 2} y={t + (h - t - b) - bh} width={bw} height={bh} rx={6} className={cls} />
            <text x={cx} y={t + (h - t - b) - bh - 5} textAnchor="middle" className="crm-axis crm-axis--val">
              {Math.round(p.value)}
            </text>
            <text x={cx} y={h - 6} textAnchor="middle" className="crm-axis">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
