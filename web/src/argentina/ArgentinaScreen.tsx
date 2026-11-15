import { useEffect, useMemo, useState } from "react";
import D from "../map/globe-data.json";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import { ArMap, type ArMode, ZONE_FILL, ratioFill } from "./ArMap";
import {
  type ArCrop,
  type ArDept,
  type ArFeature,
  type ArIndex,
  type YieldCompare,
  type Zone,
  CROP_LABEL,
  ZONE_SHORT,
  loadArDept,
  loadArIndex,
  loadArShapes,
} from "./data";
import "./argentina.css";

/**
 * F39 · Argentina (región pampeana), como prueba de extensión: no hay estimación del modelo acá.
 * Cada departamento se compara con los 3 condados de EE. UU. de clima más parecido y con su propio
 * rinde oficial (MAGyP). Reglas por zona en docs/argentina-front.md.
 */

const CROPS: ArCrop[] = ["corn", "soy", "wheat"];
const ZONES: Zone[] = ["dentro", "cerca", "fuera"];

// Condados de EE. UU. con historia cargada: los análogos llevan a su historia; si no, al mapa.
const WITH_HISTORY = new Set(
  (D as unknown as { counties: { id: string; stat: { history?: boolean } }[] }).counties
    .filter((c) => c.stat?.history)
    .map((c) => c.id),
);

export function ArgentinaScreen({ id }: { id: string | null }) {
  const [index, setIndex] = useState<ArIndex | null>(null);
  const [features, setFeatures] = useState<ArFeature[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<ArMode>("zone");

  useEffect(() => {
    Promise.all([loadArIndex(), loadArShapes()])
      .then(([i, g]) => {
        setIndex(i);
        setFeatures(g.features);
      })
      .catch(() => setFailed(true));
  }, []);

  const pick = (d: string) => {
    window.location.hash = `#/argentina/${d}`;
  };

  if (failed)
    return (
      <main className="ar">
        <Missing what="the Argentina files (data/argentina/) did not load" />
      </main>
    );
  if (!index || !features) return <main className="ar ar--loading" role="status">Loading the Pampas…</main>;

  return (
    <main className="ar">
      <header className="ar__head">
        <p className="ar__eyebrow">Extension test · Argentina, the Pampas</p>
        <h1>Same weather, half the yield?</h1>
        <p className="ar__lead">{index.headline}</p>
      </header>

      <div className="ar__grid">
        <section className="ar__mapcard" aria-labelledby="ar-map-title">
          <div className="ar__maphead">
            <h2 id="ar-map-title">{index.departments} departments</h2>
            <div className="ar-toggle" role="group" aria-label="Color the map by">
              <button type="button" aria-pressed={mode === "zone"} onClick={() => setMode("zone")}>
                Weather match
              </button>
              {CROPS.map((c) => (
                <button key={c} type="button" aria-pressed={mode === c} onClick={() => setMode(c)}>
                  {CROP_LABEL[c]} vs U.S.
                </button>
              ))}
            </div>
          </div>
          <ArMap features={features} mode={mode} selected={id} onPick={pick} />
          <MapLegend index={index} mode={mode} />
          <DeptPicker features={features} selected={id} onPick={pick} />
        </section>

        <section className="ar__panel" aria-live="polite">
          {id ? <DeptCard key={id} id={id} /> : <Overview index={index} features={features} onPick={pick} />}
        </section>
      </div>
    </main>
  );
}

function MapLegend({ index, mode }: { index: ArIndex; mode: ArMode }) {
  if (mode === "zone")
    return (
      <ul className="ar-legend" aria-label="Legend">
        {ZONES.map((z) => (
          <li key={z}>
            <i style={{ background: ZONE_FILL[z] }} /> {ZONE_SHORT[z]} <span>· {index.zones[z].departments}</span>
          </li>
        ))}
      </ul>
    );
  return (
    <div className="ar-legend ar-legend--ratio" aria-hidden="true">
      <span>Half</span>
      <i style={{ background: `linear-gradient(90deg, ${ratioFill(0.45)}, ${ratioFill(1)}, ${ratioFill(2.2)})` }} />
      <span>Same</span>
      <span className="ar-legend__right">Double</span>
      <span className="ar-legend__note">
        Median yield 2001–2024 ÷ its 3 U.S. weather analogs · <i className="ar-legend__hatch" /> no MAGyP yield
      </span>
    </div>
  );
}

function DeptPicker({ features, selected, onPick }: { features: ArFeature[]; selected: string | null; onPick: (id: string) => void }) {
  const byProvince = useMemo(() => {
    const m = new Map<string, ArFeature["properties"][]>();
    for (const f of features) {
      const list = m.get(f.properties.province) ?? [];
      list.push(f.properties);
      m.set(f.properties.province, list);
    }
    for (const l of m.values()) l.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [features]);
  return (
    <label className="ar-pick">
      <span>Department</span>
      <select value={selected ?? ""} onChange={(e) => e.target.value && onPick(e.target.value)}>
        <option value="">Choose a department…</option>
        {byProvince.map(([prov, list]) => (
          <optgroup key={prov} label={prov}>
            {list.map((p) => (
              <option key={p.id_depto} value={p.id_depto}>
                {p.name} · {ZONE_SHORT[p.zone]}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function Overview({ index, features, onPick }: { index: ArIndex; features: ArFeature[]; onPick: (id: string) => void }) {
  // Para empezar: los departamentos "dentro" con rinde, del que más se aleja de sus análogos.
  const starts = features
    .map((f) => f.properties)
    .filter((p) => p.zone === "dentro" && p.ratio_corn !== null)
    .sort((a, b) => (a.ratio_corn as number) - (b.ratio_corn as number))
    .slice(0, 3);
  return (
    <div className="ar-card">
      <h2 className="ar-card__title">How the Pampas compare</h2>
      <p className="ar-note">{index.note}</p>
      <table className="ar-table">
        <caption>Median yield ÷ its U.S. weather analogs, by weather match</caption>
        <thead>
          <tr>
            <th scope="col">Weather match</th>
            {CROPS.map((c) => (
              <th key={c} scope="col">
                {CROP_LABEL[c]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ZONES.map((z) => (
            <tr key={z}>
              <th scope="row">
                <i className="ar-dot" style={{ background: ZONE_FILL[z] }} /> {ZONE_SHORT[z]}{" "}
                <span className="ar-muted">({index.zones[z].departments})</span>
              </th>
              {CROPS.map((c) => {
                const r = index.median_ratio_ar_us_by_zone[z]?.[c];
                return <td key={c}>{r === null || r === undefined ? <Missing what="" inline /> : `${Math.round(r * 100)}%`}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ar-muted ar-small">
        100% = the same yield as its U.S. analogs. Only the “within range” departments have weather the U.S. data covers.
      </p>
      <h3 className="ar-card__sub">Start here</h3>
      <ul className="ar-starts">
        {starts.map((p) => (
          <li key={p.id_depto}>
            <button type="button" onClick={() => onPick(p.id_depto)}>
              <span className="ar-starts__name">
                <b>{p.name}</b>, {p.province}
              </span>
              <span>Corn {Math.round((p.ratio_corn as number) * 100)}% of its U.S. analogs →</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="ar-sources">
        {index.sources.map((s) => (
          <SourceChip key={s.id} source={`${s.name} · ${s.resolution} · ${s.period}`} />
        ))}
      </p>
    </div>
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
      <a className="ar-back" href="#/argentina">← All departments</a>
      <h2 id="ar-dept" className="ar-card__title">
        {d.name}
        <span>{d.province}, Argentina</span>
      </h2>
      <p className={`ar-zone ar-zone--${d.zone}`}>
        <i style={{ background: ZONE_FILL[d.zone] }} />
        <b>{d.zone_label}.</b> {d.zone_text}
      </p>
      <p className="ar-note">
        <b>No yield estimate.</b> {d.prediction_note}
      </p>

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

      <p className="ar-sources">
        {d.sources.map((s) => (
          <SourceChip key={s} source={s} />
        ))}
      </p>
    </article>
  );
}

function CompareRow({ crop, y }: { crop: ArCrop; y: YieldCompare }) {
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

function YieldSeries({ d, crop }: { d: ArDept; crop: ArCrop }) {
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

function ClimateTable({ rows }: { rows: NonNullable<ArDept["climate"]> }) {
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

function SoilTable({ d }: { d: ArDept }) {
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
