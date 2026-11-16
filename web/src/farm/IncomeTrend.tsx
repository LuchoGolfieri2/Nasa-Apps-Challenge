/**
 * "Income summary" de My Farm (F40), con el formato del Metric Trend Chart de 21st (Figma 28:115 y 37:122):
 * selector de métrica (ingreso o rinde), lectura del año en foco, líneas por año de clima, franja con la
 * diferencia, anotaciones de eventos sobre el eje y botón para bajar los números en CSV.
 *
 * Año en foco: el último con las dos opciones; el que está bajo el cursor (o elegido con las flechas);
 * o el de la anotación abierta.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyEvent } from "react";
import { signed, usd } from "./crm";

type Metric = "income" | "yield";

/** Eventos de clima conocidos que se marcan sobre el eje cuando caen dentro de los años del modelo */
const WEATHER_EVENTS: Record<number, string> = { 2012: "2012 drought" };

const nice = (lo: number, hi: number) => {
  const span = Math.max(hi - lo, 1);
  const step = [10, 20, 25, 50, 100, 200, 250, 500].find((s) => span / s <= 5) ?? 1000;
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step };
};

const bu = (v: number) => `${Math.round(v * 10) / 10}`;

interface Props {
  years: number[];
  income: { a: Array<number | null>; b: Array<number | null> };
  yields: { a: Array<number | null>; b: Array<number | null> };
  /** "Our advice · corn after soybeans" */
  aLabel: string;
  /** "If you repeat corn" */
  bLabel: string;
  /** nombre del archivo CSV, sin extensión */
  csvName: string;
}

export function IncomeTrend({ years, income, yields, aLabel, bLabel, csvName }: Props) {
  const [metric, setMetric] = useState<Metric>("income");
  const [hover, setHover] = useState<number | null>(null);
  const [openEvent, setOpenEvent] = useState<number | null>(null);
  const popId = useId();

  // el ancho del SVG sigue al contenedor: así el texto del eje no se achica en el celular
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(756);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (openEvent == null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenEvent(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openEvent]);

  const { a, b } = metric === "income" ? income : yields;
  const fmt = (v: number) => (metric === "income" ? usd(v) : bu(v));
  const unit = metric === "income" ? "/ac" : " bu/ac";
  const diff = (v: number) =>
    metric === "income" ? `${signed(v)}/ac` : `${v > 0 ? "+" : v < 0 ? "−" : ""}${bu(Math.abs(v))} bu/ac`;
  const short = bLabel.replace(/^if you /i, "").toLowerCase();

  const both = (i: number) => a[i] != null && b[i] != null;
  const lastIdx = (() => {
    for (let i = years.length - 1; i >= 0; i--) if (both(i)) return i;
    return years.length - 1;
  })();
  const events = years
    .map((y, i) => (WEATHER_EVENTS[y] ? { i, year: y, label: WEATHER_EVENTS[y] } : null))
    .filter((e): e is { i: number; year: number; label: string } => e !== null);
  const focus = openEvent ?? hover ?? lastIdx;
  const fa = a[focus];
  const fb = b[focus];

  // geometría (Figma: área de 10 a 220, años debajo y las anotaciones en la última franja)
  const narrow = W < 520;
  const [t, r, l] = [10, 10, narrow ? 40 : 44];
  const yb = narrow ? 180 : 220;
  const H = yb + 48;
  const vals = [...a, ...b].filter((v): v is number => v != null);
  const { lo, hi, step } = vals.length ? nice(Math.min(...vals), Math.max(...vals)) : { lo: 0, hi: 1, step: 1 };
  const X = (i: number) => l + (i * (W - l - r)) / Math.max(years.length - 1, 1);
  const Y = (v: number) => t + (yb - t) * (1 - (v - lo) / (hi - lo));
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
  const every = Math.max(1, Math.ceil(years.length / Math.floor((W - l - r) / 60)));

  const line = (s: Array<number | null>) => {
    let d = "";
    let pen = false;
    s.forEach((v, i) => {
      if (v == null) return void (pen = false);
      d += `${pen ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  // franja entre las dos líneas, por tramos donde están las dos
  const bands: string[] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length > 1)
      bands.push(
        `M${run.map((i) => `${X(i).toFixed(1)},${Y(a[i]!).toFixed(1)}`).join("L")}L${[...run]
          .reverse()
          .map((i) => `${X(i).toFixed(1)},${Y(b[i]!).toFixed(1)}`)
          .join("L")}Z`,
      );
    run = [];
  };
  years.forEach((_, i) => (both(i) ? run.push(i) : flush()));
  flush();

  const colW = (W - l - r) / Math.max(years.length - 1, 1);
  const hx = hover != null ? X(hover) : 0;
  const tipW = 196;
  const tipLeft = hx + 16 + tipW > W;
  const tipY = hover != null && a[hover] != null ? Math.max(0, Y(a[hover]!) - 10) : t;

  const ev = openEvent != null ? events.find((e) => e.i === openEvent) ?? null : null;
  const evNote = (() => {
    if (!ev) return null;
    const worst = (s: Array<number | null>) => {
      const v = s.filter((x): x is number => x != null);
      return v.length > 0 && s[ev.i] === Math.min(...v);
    };
    const wa = worst(a);
    const wb = worst(b);
    if (wa && wb) return "The worst weather year in this record for both options.";
    if (wa) return "The worst weather year in this record for our advice.";
    if (wb) return `The worst weather year in this record for ${short}.`;
    return null;
  })();
  const popW = 236;
  const clampX = (x: number, w: number) => Math.max(0, Math.min(W - w, x));
  const popX = ev ? clampX(X(ev.i) + 16 + popW > W ? X(ev.i) - 16 - popW : X(ev.i) + 16, popW) : 0;
  const popY = ev && a[ev.i] != null ? Math.max(0, Y(a[ev.i]!) - 118) : t;

  function onKey(e: ReactKeyEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    setOpenEvent(null);
    const cur = hover ?? lastIdx;
    const n =
      e.key === "Home" ? 0 : e.key === "End" ? years.length - 1 : cur + (e.key === "ArrowLeft" ? -1 : 1);
    setHover(Math.min(years.length - 1, Math.max(0, n)));
  }

  function exportCsv() {
    const cell = (v: number | null | undefined) => (v == null ? "" : String(v));
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = [
      [
        "weather_year",
        q(`${aLabel} · income_usd_ac`),
        q(`${bLabel} · income_usd_ac`),
        "income_difference_usd_ac",
        q(`${aLabel} · yield_bu_ac`),
        q(`${bLabel} · yield_bu_ac`),
        "yield_difference_bu_ac",
      ].join(","),
      ...years.map((y, i) => {
        const ia = income.a[i];
        const ib = income.b[i];
        const ya = yields.a[i];
        const yb2 = yields.b[i];
        return [
          y,
          cell(ia),
          cell(ib),
          cell(ia != null && ib != null ? ia - ib : null),
          cell(ya),
          cell(yb2),
          cell(ya != null && yb2 != null ? Math.round((ya - yb2) * 10) / 10 : null),
        ].join(",");
      }),
    ];
    const url = URL.createObjectURL(new Blob([rows.join("\n") + "\n"], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${csvName}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <div className="crm-head crm-trend-head">
        <div className="crm-trend-titles">
          <h2 id="crm-inc-h">Income summary</h2>
        </div>
        <div className="crm-trend-ctl">
          <div className="crm-seg" role="group" aria-label="Metric">
            {(
              [
                ["income", "Income $/ac"],
                ["yield", "Yield bu/ac"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                aria-pressed={metric === m}
                className={metric === m ? "is-on" : undefined}
                onClick={() => setMetric(m)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="crm-btn crm-btn--sm" onClick={exportCsv}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M8 2v9M4.5 7.5 8 11l3.5-3.5M3 14h10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      <div className="crm-readout" aria-live="polite">
        <div>
          <span className="crm-readout-k">
            <i className="crm-swatch crm-swatch--a" />
            {aLabel} · {years[focus]} weather
          </span>
          <span className="crm-readout-v">
            <b className="crm-readout-big">{fa == null ? "Missing data" : `${fmt(fa)}${unit}`}</b>
            {fa != null && fb != null ? (
              <span className={`crm-delta${fa - fb < 0 ? " crm-delta--down" : ""}`}>
                {fa - fb < 0 ? "▼" : "▲"} {diff(fa - fb)} vs {short}
              </span>
            ) : null}
          </span>
        </div>
        <div>
          <span className="crm-readout-k">
            <i className="crm-swatch crm-swatch--b" />
            {bLabel} · {years[focus]} weather
          </span>
          <b className="crm-readout-mid">{fb == null ? "Missing data" : `${fmt(fb)}${unit}`}</b>
        </div>
      </div>

      <div className="crm-trend" ref={box}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          role="img"
          tabIndex={0}
          aria-label={`${aLabel} and ${bLabel}, ${metric === "income" ? "dollars" : "bushels"} per acre, under the weather of ${years[0]} to ${years[years.length - 1]}. Use the arrow keys to read each year.`}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={l} x2={W - r} y1={Y(v)} y2={Y(v)} className={v === lo ? "crm-trend-base" : "crm-gridline"} />
              <text x={0} y={Y(v) + 4} className="crm-axis">
                {metric === "income" ? usd(v) : v}
              </text>
            </g>
          ))}
          {years.map((y, i) =>
            (i % every === 0 && years.length - 1 - i >= every) || i === years.length - 1 ? (
              <text
                key={y}
                x={X(i)}
                y={yb + 22}
                textAnchor="middle"
                className={`crm-axis${i === focus && (hover != null || openEvent != null) ? " crm-axis--on" : ""}`}
              >
                {y}
              </text>
            ) : null,
          )}
          {bands.map((d) => (
            <path key={d} d={d} className="crm-band" />
          ))}
          {events.map((e) => (
            <g key={e.year} className="crm-event">
              <line x1={X(e.i)} x2={X(e.i)} y1={t} y2={yb} />
              <path d={`M${X(e.i) - 4},${yb + 1}L${X(e.i)},${yb - 5}L${X(e.i) + 4},${yb + 1}Z`} />
            </g>
          ))}
          <path d={line(b)} pathLength={1} className="crm-line crm-line--b" />
          <path d={line(a)} pathLength={1} className="crm-line crm-line--a" />
          {hover != null ? <line x1={hx} x2={hx} y1={t} y2={yb} className="crm-cross" /> : null}
          {[
            [focus, b, "b"],
            [focus, a, "a"],
          ].map(([i, s, k]) => {
            const v = (s as Array<number | null>)[i as number];
            const big = hover != null || openEvent != null;
            return v == null ? null : (
              <circle
                key={k as string}
                cx={X(i as number)}
                cy={Y(v)}
                r={big ? 6 : 3.5}
                className={`crm-dot crm-dot--${k}${big ? " crm-dot--big" : ""}`}
              />
            );
          })}
          {years.map((y, i) => (
            <rect
              key={y}
              x={X(i) - colW / 2}
              y={t}
              width={colW}
              height={yb - t}
              fill="transparent"
              onMouseEnter={() => {
                setOpenEvent(null);
                setHover(i);
              }}
              onClick={() => {
                setOpenEvent(null);
                setHover(i);
              }}
            />
          ))}
        </svg>

        {events.map((e) => (
          <button
            key={e.year}
            type="button"
            className={`crm-event-pill${openEvent === e.i ? " is-on" : ""}`}
            style={{ left: X(e.i), top: yb + 30 }}
            aria-expanded={openEvent === e.i}
            aria-controls={popId}
            onClick={() => {
              setHover(null);
              setOpenEvent(openEvent === e.i ? null : e.i);
            }}
          >
            <i aria-hidden="true" />
            {e.label}
          </button>
        ))}

        {hover != null && openEvent == null && (a[hover] != null || b[hover] != null) ? (
          <div
            className="crm-pop crm-pop--tip"
            style={{ width: tipW, top: tipY, left: clampX(tipLeft ? hx - 16 - tipW : hx + 16, tipW) }}
            aria-hidden="true"
          >
            <b className="crm-pop-t">Weather of {years[hover]}</b>
            <span className="crm-pop-row">
              <span>Our advice</span>
              <b>{a[hover] == null ? "Missing data" : fmt(a[hover]!)}</b>
            </span>
            <span className="crm-pop-row">
              <span>{bLabel.replace(/^if you /i, "").replace(/^./, (c) => c.toUpperCase())}</span>
              <b className="crm-b">{b[hover] == null ? "Missing data" : fmt(b[hover]!)}</b>
            </span>
            {a[hover] != null && b[hover] != null ? (
              <span className="crm-pop-row">
                <span>Difference</span>
                <b className={a[hover]! - b[hover]! < 0 ? "crm-down" : "crm-up"}>{diff(a[hover]! - b[hover]!)}</b>
              </span>
            ) : null}
          </div>
        ) : null}

        <div
          id={popId}
          className="crm-pop crm-pop--note"
          role="region"
          aria-label={ev ? ev.label : undefined}
          hidden={!ev}
          style={{ width: popW, top: popY, left: popX }}
        >
          {ev ? (
            <>
              <b className="crm-pop-t crm-pop-t--ev">
                <i aria-hidden="true" />
                {ev.label}
              </b>
              {evNote ? <p>{evNote}</p> : null}
              <span className="crm-pop-row">
                <span>Our advice</span>
                <b>{a[ev.i] == null ? "Missing data" : `${fmt(a[ev.i]!)}${unit}`}</b>
              </span>
              <span className="crm-pop-row">
                <span>{bLabel.replace(/^if you /i, "").replace(/^./, (c) => c.toUpperCase())}</span>
                <b className="crm-b">{b[ev.i] == null ? "Missing data" : `${fmt(b[ev.i]!)}${unit}`}</b>
              </span>
              {a[ev.i] != null && b[ev.i] != null ? (
                <span className="crm-pop-row">
                  <span>Difference</span>
                  <b className={a[ev.i]! - b[ev.i]! < 0 ? "crm-down" : "crm-up"}>{diff(a[ev.i]! - b[ev.i]!)}</b>
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
