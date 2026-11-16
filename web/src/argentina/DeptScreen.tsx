import { useEffect, useState } from "react";
import D from "../map/globe-data.json";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import { type ArCrop, type ArDept, type YieldCompare, CROP_LABEL, loadArDept } from "./data";
import "./argentina.css";

/**
 * Departamento de Argentina (#/depto/<id_depto>): lo que abre "See more" en el globo, como la historia de un
 * condado. Argentina entra al globo igual que EE. UU. (provincias = estados, departamentos = condados; ver
 * scripts/build_globe_argentina.py). Sin estimación del modelo: se compara con los 3 condados de EE. UU. de
 * clima más parecido y con el rinde oficial (MAGyP). Reglas por zona en docs/argentina-front.md.
 */

const CROPS: ArCrop[] = ["corn", "soy", "wheat"];
const ZONE_FILL = { dentro: "#2f7d4f", cerca: "#e9b949", fuera: "#d9ddd5" } as const;

// Condados de EE. UU. con historia cargada: los análogos llevan a su historia; si no, al mapa.
const WITH_HISTORY = new Set(
  (D as unknown as { counties: { id: string; stat: { history?: boolean | string } }[] }).counties
    .filter((c) => c.stat?.history)
    .map((c) => c.id),
);

export function DeptScreen({ id }: { id: string }) {
  return (
    <main className="ar">
      <DeptCard id={id} />
    </main>
  );
}

function DeptCard({ id }: { id: string }) {
  const [d, setD] = useState<ArDept | null>(null);
  const [failed, setFailed] = useState(false);
  const [crop, setCrop] = useState<ArCrop>("corn");
  useEffect(() => {
    let off = false;
    loadArDept(id)
      .then((x) => !off && setD(x))
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, [id]);
  if (failed) return <div className="ar-card"><Missing what={`department ${id} is not in the Argentina data`} /></div>;
  if (!d) return <div className="ar-card ar--loading" role="status">Loading…</div>;

  const compare = d.yield_compare ?? {};
  return (
    <article className="ar-card" aria-labelledby="ar-dept">
      <a className="ar-back" href={`#/map/${id}`}>← Back to the map</a>
      <h1 id="ar-dept" className="ar-card__title">
        {d.name}
        <span>{d.province}, Argentina · department</span>
      </h1>
      <p className={`ar-zone ar-zone--${d.zone}`}>
        <i style={{ background: ZONE_FILL[d.zone] }} />
        <b>{d.zone_label}.</b> {d.zone_text}
      </p>
      <p className="ar-note">
        <b>No yield estimate.</b> {d.prediction_note}
      </p>

      <div className="ar-cols">
      <div className="ar-col">
      <section aria-labelledby="ar-cmp">
        <h3 id="ar-cmp" className="ar-card__sub">Yield vs. its U.S. weather analogs</h3>
        {CROPS.some((c) => compare[c]) ? (
          <ul className="ar-cmp">
            {CROPS.map((c) => (compare[c] ? <CompareRow key={c} crop={c} y={compare[c] as YieldCompare} /> : null))}
          </ul>
        ) : (
          <Missing what="MAGyP has no yields for this department" />
        )}
      </section>

      <section aria-labelledby="ar-ser">
        <div className="ar-card__row">
          <h3 id="ar-ser" className="ar-card__sub">Yield by season</h3>
          <div className="ar-toggle ar-toggle--small" role="group" aria-label="Crop">
            {CROPS.map((c) => (
              <button key={c} type="button" aria-pressed={crop === c} onClick={() => setCrop(c)}>
                {CROP_LABEL[c]}
              </button>
            ))}
          </div>
        </div>
        <YieldSeries d={d} crop={crop} />
      </section>

      </div>
      <div className="ar-col">
      <section aria-labelledby="ar-clim">
        <h3 id="ar-clim" className="ar-card__sub">Weather by season</h3>
        <p className="ar-muted ar-small">{d.season_months}. January here is July in the Corn Belt.</p>
        {d.climate && d.climate.length ? (
          <ClimateTable rows={d.climate} />
        ) : (
          <Missing what={d.climate_note ?? "season weather is loaded only for Buenos Aires"} />
        )}
      </section>

      <section aria-labelledby="ar-soil">
        <h3 id="ar-soil" className="ar-card__sub">Soil, 0–30 cm</h3>
        <SoilTable d={d} />
      </section>

      <section aria-labelledby="ar-an">
        <h3 id="ar-an" className="ar-card__sub">U.S. counties with the most similar weather</h3>
        <ol className="ar-analogs">
          {d.analogs.map((a) => (
            <li key={a.fips}>
              <a href={WITH_HISTORY.has(a.fips) ? `#/county/${a.fips}` : `#/map/${a.fips}`}>
                <b>{a.name} County, {a.state}</b>
                <span>{WITH_HISTORY.has(a.fips) ? "Rewind its history →" : "See it on the map →"}</span>
              </a>
            </li>
          ))}
        </ol>
        {d.radiation_diff_mj_m2_day !== null ? (
          <p className="ar-muted ar-small">
            This department gets {d.radiation_diff_mj_m2_day > 0 ? "about " + d.radiation_diff_mj_m2_day : Math.abs(d.radiation_diff_mj_m2_day)}{" "}
            MJ/m² per day {d.radiation_diff_mj_m2_day > 0 ? "more" : "less"} sunlight in its season than its closest analog.
          </p>
        ) : null}
      </section>

      </div>
      </div>

      <p className="ar-sources">
        {d.sources.map((s) => (
          <SourceChip key={s} source={s} />
        ))}
      </p>
    </article>
  );
}

export function CompareRow({ crop, y }: { crop: ArCrop; y: YieldCompare }) {
  const max = Math.max(y.us_analogs.p90, y.ar_median.bu_ac) * 1.12;
  const pct = (v: number) => `${(100 * v) / max}%`;
  return (
    <li className="ar-cmp__row">
      <div className="ar-cmp__label">
        <b>{CROP_LABEL[crop]}</b>
        <span>
          {Math.round(y.ar_median.bu_ac)} vs {Math.round(y.us_analogs.median)} bu/acre ·{" "}
          <b className={y.ratio_ar_us < 0.9 ? "ar-low" : y.ratio_ar_us > 1.1 ? "ar-high" : ""}>{Math.round(y.ratio_ar_us * 100)}%</b>
        </span>
      </div>
      <div
        className="ar-cmp__track"
        role="img"
        aria-label={`${CROP_LABEL[crop]}: Argentina median ${Math.round(y.ar_median.bu_ac)} bu/acre; U.S. analogs ${Math.round(y.us_analogs.p10)} to ${Math.round(y.us_analogs.p90)}, median ${Math.round(y.us_analogs.median)}.`}
      >
        <span className="ar-cmp__band" style={{ left: pct(y.us_analogs.p10), width: `calc(${pct(y.us_analogs.p90)} - ${pct(y.us_analogs.p10)})` }} />
        <span className="ar-cmp__us" style={{ left: pct(y.us_analogs.median) }} />
        <span className="ar-cmp__ar" style={{ left: pct(y.ar_median.bu_ac) }} />
      </div>
      <p className="ar-small ar-muted">{y.text}</p>
    </li>
  );
}

export function YieldSeries({ d, crop }: { d: ArDept; crop: ArCrop }) {
  const rows = d.yields.map((y) => ({ year: y.year, campaign: y.campaign, v: y[crop] ?? null }));
  const vals = rows.map((r) => r.v?.bu_ac ?? null).filter((v): v is number => v !== null);
  if (!vals.length) return <Missing what={`MAGyP has no ${CROP_LABEL[crop].toLowerCase()} yields for this department`} />;
  const us = d.yield_compare?.[crop]?.us_analogs.median ?? null;
  const max = Math.max(...vals, us ?? 0) * 1.08;
  return (
    <div className="ar-series">
      <div className="ar-series__bars" role="img" aria-label={`${CROP_LABEL[crop]} yield by season, ${rows[0].campaign} to ${rows[rows.length - 1].campaign}.`}>
        {us !== null ? (
          <span className="ar-series__us" style={{ bottom: `${(100 * us) / max}%` }}>
            <em>U.S. analogs {Math.round(us)}</em>
          </span>
        ) : null}
        {rows.map((r) => (
          <span key={r.year} className="ar-series__col" title={`${r.campaign}: ${r.v ? `${Math.round(r.v.bu_ac)} bu/acre (${Math.round(r.v.kg_ha).toLocaleString("en-US")} kg/ha)` : "Missing data"}`}>
            {r.v ? <i style={{ height: `${(100 * r.v.bu_ac) / max}%` }} /> : <i className="ar-series__none" />}
          </span>
        ))}
      </div>
      <div className="ar-series__axis" aria-hidden="true">
        <span>{rows[0].campaign}</span>
        <span>bu/acre · striped = no data</span>
        <span>{rows[rows.length - 1].campaign}</span>
      </div>
    </div>
  );
}

export function ClimateTable({ rows }: { rows: NonNullable<ArDept["climate"]> }) {
  const last = rows.slice(-6).reverse();
  const n = (v: number | null, u: string) => (v === null ? "—" : `${Math.round(v)}${u}`);
  return (
    <div className="ar-tablewrap">
      <table className="ar-table ar-table--num">
        <thead>
          <tr>
            <th scope="col">Season</th>
            <th scope="col">Rain, Oct–Mar</th>
            <th scope="col">Water balance</th>
            <th scope="col">Jan rain</th>
            <th scope="col">Jan highs</th>
          </tr>
        </thead>
        <tbody>
          {last.map((r) => (
            <tr key={r.year}>
              <th scope="row">{r.campaign}</th>
              <td>{n(r.season_rain_mm, " mm")}</td>
              <td>{n(r.season_water_balance_mm, " mm")}</td>
              <td>{n(r.january_rain_mm, " mm")}</td>
              <td>{r.january_max_temp_c === null ? "—" : `${r.january_max_temp_c.toFixed(1)} °C`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ar-small ar-muted">
        Last 6 seasons. Water balance = rain minus crop water demand. A dash is a season with no data. <SourceChip source="NASA POWER · 0.5°" />
      </p>
    </div>
  );
}

const SOIL_ROWS: { k: string; label: string; unit: string }[] = [
  { k: "clay_pct", label: "Clay", unit: "%" },
  { k: "sand_pct", label: "Sand", unit: "%" },
  { k: "organic_carbon_g_kg", label: "Organic carbon", unit: " g/kg" },
  { k: "ph", label: "pH", unit: "" },
];

export function SoilTable({ d }: { d: ArDept }) {
  if (!d.soil) return <Missing what="SoilGrids soil for this department" />;
  const an = d.analogs[0];
  const v = (s: Record<string, number | null> | null, k: string, u: string) =>
    s && s[k] !== null && s[k] !== undefined ? `${s[k]}${u}` : "Missing data";
  return (
    <>
      <table className="ar-table ar-table--num">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">{d.name}</th>
            <th scope="col">{an ? `${an.name}, ${an.state}` : "U.S. analog"}</th>
          </tr>
        </thead>
        <tbody>
          {SOIL_ROWS.map((r) => (
            <tr key={r.k}>
              <th scope="row">{r.label}</th>
              <td>{v(d.soil, r.k, r.unit)}</td>
              <td>{v(d.soil_analog, r.k, r.unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ar-small ar-muted">
        Same source on both sides, so they compare. <SourceChip source="ISRIC SoilGrids · 1 km" />
      </p>
    </>
  );
}
