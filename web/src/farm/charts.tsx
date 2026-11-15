/**
 * Gráficos de My Farm, en el estilo de las referencias: medidor semicircular y curva de área suave.
 * El rojo solo marca el lado del riesgo (año malo); el resto es verde y oro trigo.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { Range } from "../next/types";

// ------------------------------------------------------------------ medidor

export interface GaugeProps {
  range: Range;
  /** extremos del arco (mismo eje para las tres opciones) */
  min: number;
  max: number;
  unit: string;
  label: string;
  /** lo habitual del condado, como marca fina */
  usual?: number | null;
}

const polar = (cx: number, cy: number, r: number, a: number) =>
  [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;

export function Gauge({
  range,
  min,
  max,
  unit,
  label,
  usual = null,
}: GaugeProps) {
  const id = useId().replace(/:/g, "");
  const cx = 120;
  const cy = 112;
  const r = 92;
  const ang = (v: number) =>
    Math.PI * (1 - Math.min(1, Math.max(0, (v - min) / (max - min))));
  const arc = (a0: number, a1: number, rr: number) => {
    const [x0, y0] = polar(cx, cy, rr, a0);
    const [x1, y1] = polar(cx, cy, rr, a1);
    return `M${x0} ${y0} A${rr} ${rr} 0 0 1 ${x1} ${y1}`;
  };
  const [nx, ny] = polar(cx, cy, r - 40, ang(range.median));
  const ticks = [range.p10, range.p90];
  return (
    <figure className="fm-gauge">
      <svg
        viewBox="0 -16 240 148"
        role="img"
        aria-label={`${label}: typical ${Math.round(range.median)} ${unit}, bad year ${Math.round(range.p10)}, good year ${Math.round(range.p90)}`}
      >
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#e5484d" />
            <stop offset="0.35" stopColor="#e9b949" />
            <stop offset="0.7" stopColor="#8ed081" />
            <stop offset="1" stopColor="#2f7d4f" />
          </linearGradient>
        </defs>
        <path
          d={arc(Math.PI, 0, r)}
          stroke="#e7ece4"
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={arc(ang(range.p10), ang(range.p90), r)}
          stroke={`url(#g${id})`}
          strokeWidth="16"
          fill="none"
          strokeLinecap="round"
        />
        {/* rayitas del medidor */}
        {Array.from({ length: 31 }, (_, i) => {
          const a = Math.PI * (1 - i / 30);
          const [x0, y0] = polar(cx, cy, r - 14, a);
          const [x1, y1] = polar(cx, cy, r - (i % 5 === 0 ? 22 : 18), a);
          return (
            <line
              key={i}
              x1={x0}
              y1={y0}
              x2={x1}
              y2={y1}
              stroke="#12271b"
              strokeOpacity={i % 5 === 0 ? 0.35 : 0.15}
              strokeWidth="1"
            />
          );
        })}
        {usual !== null
          ? (() => {
              const [x0, y0] = polar(cx, cy, r - 10, ang(usual));
              const [x1, y1] = polar(cx, cy, r + 10, ang(usual));
              return (
                <line
                  x1={x0}
                  y1={y0}
                  x2={x1}
                  y2={y1}
                  stroke="#12271b"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                />
              );
            })()
          : null}
        {ticks.map((v, i) => {
          const [x, y] = polar(cx, cy, r + 18, ang(v));
          return (
            <text
              key={i}
              x={x}
              y={y + 4}
              textAnchor="middle"
              className="fm-gauge-tick"
            >
              {Math.round(v)}
            </text>
          );
        })}
        <line
          x1={cx}
          y1={cy}
          x2={nx}
          y2={ny}
          stroke="#12271b"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="6" fill="#12271b" />
      </svg>
      <figcaption>
        <b>{Math.round(range.median)}</b> <span>{unit}</span>
        <span className="fm-gauge-label">{label}</span>
      </figcaption>
    </figure>
  );
}

// ------------------------------------------------------------------ curva de área

export interface AreaPoint {
  year: number;
  value: number | null;
  /** año marcado por el modelo como fuera de lo habitual */
  flag?: "above" | "below" | null;
}

export function YieldArea({
  points,
  color,
  unit,
  label,
}: {
  points: AreaPoint[];
  color: string;
  unit: string;
  label: string;
}) {
  const id = useId().replace(/:/g, "");
  // el ancho sigue al de la tarjeta: el texto queda del mismo tamaño en el celular y en la compu
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.max(280, Math.round(e.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 500 ? 200 : 240;
  const pad = { l: 24, r: 24, t: 34, b: 28 };
  const vals = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  if (vals.length < 2) return <div ref={box} />;
  const lo = Math.min(...vals) * 0.92;
  const hi = Math.max(...vals) * 1.03;
  const x = (i: number) =>
    pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) =>
    pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  // tramos sin huecos: un año sin dato corta la curva
  const segs: { i: number; v: number }[][] = [];
  points.forEach((p, i) => {
    if (p.value === null) segs.push([]);
    else {
      if (!segs.length) segs.push([]);
      segs[segs.length - 1].push({ i, v: p.value });
    }
  });
  const smooth = (s: { i: number; v: number }[]) =>
    s
      .map((p, k) => {
        if (k === 0) return `M${x(p.i)} ${y(p.v)}`;
        const prev = s[k - 1];
        const mx = (x(prev.i) + x(p.i)) / 2;
        return `C${mx} ${y(prev.v)} ${mx} ${y(p.v)} ${x(p.i)} ${y(p.v)}`;
      })
      .join(" ");
  const best = points.reduce(
    (b, p) =>
      p.value !== null && (b === null || p.value > (b.value ?? 0)) ? p : b,
    null as AreaPoint | null,
  );
  return (
    <div ref={box} className="fm-area-box">
      <svg
        className="fm-area"
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${label}, ${points[0].year} to ${points[points.length - 1].year}`}
      >
        <defs>
          <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.32" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad.l}
            x2={W - pad.r}
            y1={pad.t + f * (H - pad.t - pad.b)}
            y2={pad.t + f * (H - pad.t - pad.b)}
            stroke="#12271b"
            strokeOpacity="0.06"
          />
        ))}
        {segs
          .filter((s) => s.length > 1)
          .map((s, n) => (
            <g key={n}>
              <path
                d={`${smooth(s)} L${x(s[s.length - 1].i)} ${H - pad.b} L${x(s[0].i)} ${H - pad.b}Z`}
                fill={`url(#a${id})`}
              />
              <path
                d={smooth(s)}
                stroke={color}
                strokeWidth="2.5"
                fill="none"
              />
            </g>
          ))}
        {points.map((p, i) =>
          p.value === null ? (
            <text
              key={p.year}
              x={x(i)}
              y={H - pad.b - 6}
              textAnchor="middle"
              className="fm-area-missing"
            >
              —
            </text>
          ) : (
            <g key={p.year}>
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r={p.flag ? 5 : 3}
                fill={
                  p.flag === "below"
                    ? "#e5484d"
                    : p.flag === "above"
                      ? "#2f7d4f"
                      : "#fff"
                }
                stroke={color}
                strokeWidth="2"
              />
              {p.flag ? (
                <text
                  x={x(i)}
                  y={y(p.value) - 11}
                  textAnchor="middle"
                  className="fm-area-flag"
                >
                  {p.flag === "below" ? "↓" : "↑"}
                </text>
              ) : null}
            </g>
          ),
        )}
        {best && best.value !== null ? (
          <g>
            <rect
              x={x(points.indexOf(best)) - 30}
              y={y(best.value) - 32}
              width="60"
              height="20"
              rx="10"
              fill="#12271b"
            />
            <text
              x={x(points.indexOf(best))}
              y={y(best.value) - 18}
              textAnchor="middle"
              className="fm-area-best"
            >
              {Math.round(best.value)} {unit}
            </text>
          </g>
        ) : null}
        {points.map((p, i) => (
          <text
            key={p.year}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            className="fm-area-year"
          >
            {W < 500 ? `’${String(p.year).slice(2)}` : p.year}
          </text>
        ))}
      </svg>
    </div>
  );
}
