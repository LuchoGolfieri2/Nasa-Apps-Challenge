import { useEffect, useMemo, useRef, useState } from "react";
import { dataUrl } from "../data/load";
import { CropIcon } from "../ui/CropIcon";
import { CROP_LABEL, type CropId } from "../ui/crops";
import { PrototypeStamp } from "../ui/Missing";
import AVAILABLE from "./season-available.json";
import "./season.css";

/**
 * "This season, before USDA's map" (punto 6 de ML): qué cultivo hay en un lote de demo según el satélite, fecha por fecha.
 * Arriba el duelo (la regla de rotación contra el satélite) y abajo la curva que muestra cuándo el satélite se vuelve
 * confiable. Es por lote, no por condado: solo hay 10 lotes de demo en 5 condados (scripts/build_season_json.py).
 */
type Crop = "corn" | "soy";
interface AsOf {
  date: string;
  method: "rotation_rule" | "satellite";
  crop: Crop;
  prob: number | null;
  satellite_prob_corn: number | null;
  confidence: { level: "high" | "medium" | "low"; reason: string };
  text: string;
}
interface Field {
  id: string;
  rule_guess: Crop;
  usda_cdl: Crop;
  as_of: AsOf[];
}
interface Season {
  county: string;
  season: number;
  source: string;
  note: string;
  satellite_from: string;
  accuracy_by_date: Record<string, { rule: number; hybrid: number }>;
  prototype: boolean;
  fields: Field[];
}

const CONF = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" } as const;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const label = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function hasSeason(fips: string, year: number): boolean {
  return (AVAILABLE as string[]).includes(fips) && year === 2025;
}

/**
 * `compact`: para la columna de vidrio junto al mapa, que es baja. Muestra el duelo, las fechas y el resumen;
 * la curva y la exactitud quedan detrás del botón "See how the satellite decided".
 */
export function SeasonCard({ fips, compact = false }: { fips: string; compact?: boolean }) {
  const [data, setData] = useState<Season | null>(null);
  const [fieldIx, setFieldIx] = useState(0);
  const [dateIx, setDateIx] = useState(3);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLElement>(null);

  useEffect(() => {
    let off = false;
    fetch(dataUrl(`data/season/${fips}.json`))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Season) => {
        if (off) return;
        setData(d);
        setFieldIx(0);
        // Por defecto, el 15 de julio: la fecha en que el satélite empieza a decidir
        const i = d.fields[0].as_of.findIndex((a) => a.date.endsWith("07-15"));
        setDateIx(i >= 0 ? i : d.fields[0].as_of.length - 1);
      })
      .catch(() => !off && setData(null));
    return () => {
      off = true;
    };
  }, [fips]);

  const field = data?.fields[fieldIx];
  const at = field?.as_of[dateIx];

  // Curva: probabilidad de maíz en cada fecha. 0 % abajo (y = 100) y 100 % arriba (y = 20).
  const geo = useMemo(() => {
    if (!field) return null;
    const n = field.as_of.length;
    const x = (i: number) => 50 + i * ((440 - 100) / (n - 1));
    const y = (p: number) => 100 - p * 80;
    const firstSat = field.as_of.findIndex((a) => a.method === "satellite");
    return { x, y, firstSat: firstSat < 0 ? n : firstSat };
  }, [field]);

  if (!data || !field || !at || !geo) return null;

  const satSure = at.method === "satellite";
  const acc = data.accuracy_by_date[at.date.slice(5)];
  const chartLabel = `Chance this field is corn, by date: ${field.as_of.map((a) => `${label(a.date)} ${pct(a.satellite_prob_corn ?? 0)}`).join(", ")}`;

  return (
    <section className={compact ? "season season--compact" : "season"} aria-labelledby="season-title" ref={box}>
      <div className="season__head">
        <h2 id="season-title">This season, before USDA&apos;s map</h2>
        <span className="season__pill">Satellite · demo field</span>
        {data.prototype ? <PrototypeStamp /> : null}
      </div>
      <p className="season__sub" hidden={compact}>
        {data.county} County · {data.fields.length === 1 ? "one demo field" : `${data.fields.length} demo fields`} · Landsat and Sentinel-2 (NASA HLS)
      </p>
      {data.fields.length > 1 ? (
        <div className="season__fields" role="group" aria-label="Demo field">
          {data.fields.map((f, i) => (
            <button key={f.id} type="button" aria-pressed={i === fieldIx} className="season__chip" onClick={() => setFieldIx(i)}>
              Field {i + 1}
            </button>
          ))}
        </div>
      ) : null}

      <div className="season__dates" role="group" aria-label="Date of the satellite guess">
        {field.as_of.map((a, i) => (
          <button key={a.date} type="button" aria-pressed={i === dateIx} className="season__chip" onClick={() => setDateIx(i)}>
            {label(a.date)}
          </button>
        ))}
      </div>

      {/* B · el duelo */}
      <div className="season__duel" aria-live="polite">
        <div className={satSure ? "season__side" : "season__side season__side--on"}>
          <span className="season__k">Last year&apos;s rotation says</span>
          <b className="season__crop">
            <CropIcon crop={field.rule_guess as CropId} size={26} /> {CROP_LABEL[field.rule_guess as CropId]}
          </b>
        </div>
        <span className="season__vs" aria-hidden="true">
          vs.
        </span>
        <div className={satSure ? "season__side season__side--on season__side--sat" : "season__side"}>
          <span className="season__k">The satellite sees</span>
          {satSure ? (
            <b className="season__crop">
              <CropIcon crop={at.crop as CropId} size={26} /> {CROP_LABEL[at.crop as CropId]} · {pct(at.prob ?? 0)}
            </b>
          ) : (
            <b className="season__crop season__crop--wait">
              Not sure yet <small>{pct(at.satellite_prob_corn ?? 0)} corn</small>
            </b>
          )}
        </div>
      </div>
      <p className="season__verdict">
        {at.text}{" "}
        <span className={`season__conf season__conf--${at.confidence.level}`} title={at.confidence.reason}>
          {CONF[at.confidence.level]}
        </span>
      </p>

      {compact ? (
        <button
          type="button"
          className="season__more"
          aria-expanded={open}
          aria-controls="season-detail"
          onClick={() => {
            setOpen((o) => !o);
            if (!open) requestAnimationFrame(() => box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
          }}
        >
          {open ? "Hide the detail" : "See how the satellite decided"} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
      ) : null}

      <div id="season-detail" hidden={compact && !open}>
      <svg className="season__chart" viewBox="0 0 440 136" role="img" aria-label={chartLabel}>
        <rect x={geo.x(geo.firstSat) - 35} y="20" width={440 - (geo.x(geo.firstSat) - 35) - 8} height="16" rx="4" className="season__zone" />
        <rect x={geo.x(geo.firstSat) - 35} y="84" width={440 - (geo.x(geo.firstSat) - 35) - 8} height="16" rx="4" className="season__zone" />
        <text x={geo.x(geo.firstSat) - 30} y="13" className="season__zone-t">
          Satellite decides: corn
        </text>
        <text x={geo.x(geo.firstSat) - 30} y="113" className="season__zone-t">
          Satellite decides: soybeans
        </text>
        <text x="50" y="13" className="season__zone-t season__zone-t--rule">
          Going by last year&apos;s rotation
        </text>
        <line x1="40" y1="36" x2="432" y2="36" className="season__thr" />
        <line x1="40" y1="84" x2="432" y2="84" className="season__thr" />
        <g className="season__axis" textAnchor="end">
          <text x="34" y="24">100%</text>
          <text x="34" y="40">80%</text>
          <text x="34" y="88">20%</text>
          <text x="34" y="104">0%</text>
        </g>
        <polyline className="season__line" points={field.as_of.map((a, i) => `${geo.x(i)},${geo.y(a.satellite_prob_corn ?? 0)}`).join(" ")} />
        {field.as_of.map((a, i) => (
          <g
            key={a.date}
            role="button"
            tabIndex={0}
            aria-label={`${label(a.date)}: ${pct(a.satellite_prob_corn ?? 0)} corn`}
            aria-pressed={i === dateIx}
            className="season__pt"
            onClick={() => setDateIx(i)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setDateIx(i))}
          >
            <circle cx={geo.x(i)} cy={geo.y(a.satellite_prob_corn ?? 0)} r={i === dateIx ? 8 : 5} className={a.method === "satellite" ? "season__dot season__dot--sat" : "season__dot"} />
            <text x={geo.x(i)} y="130" textAnchor="middle" className={i === dateIx ? "season__x season__x--on" : "season__x"}>
              {label(a.date)}
            </text>
          </g>
        ))}
        <text x={geo.x(dateIx)} y={geo.y(at.satellite_prob_corn ?? 0) < 56 ? geo.y(at.satellite_prob_corn ?? 0) + 32 : geo.y(at.satellite_prob_corn ?? 0) - 13} textAnchor="middle" className="season__val">
          {pct(at.satellite_prob_corn ?? 0)} corn
        </text>
      </svg>
      <p className="season__note">Chance the field is corn, by date. Until {label(data.satellite_from)} the guess is last year&apos;s rotation; after that the satellite decides when it is at least 80% sure.</p>

      <p className="season__foot">
        {acc ? (
          <span>
            In 10 fields over 2016–2025, {label(at.date)}: <b>{Math.round(acc.hybrid * 100)}% right</b>, against {Math.round(acc.rule * 100)}% for the rotation rule alone.
          </span>
        ) : null}{" "}
        <span className={at.crop === field.usda_cdl ? "season__check season__check--ok" : "season__check"}>
          USDA&apos;s map, published later: {CROP_LABEL[field.usda_cdl as CropId]} {at.crop === field.usda_cdl ? "· matches this guess" : "· differs from this guess"}
        </span>
      </p>
      </div>
    </section>
  );
}
