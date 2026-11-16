import { useEffect, useRef, useState } from "react";
import D from "../map/globe-data.json";
import { ICON, Num, Tile } from "../history/YearTiles";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import { CropIcon } from "../ui/CropIcon";
import { CROP_COLOR } from "../ui/crops";
import { type ArCrop, type ArDept, type YieldCompare, CROP_LABEL, loadArDept } from "./data";
import { ClimateTable, CompareRow, SoilTable, YieldSeries } from "./DeptScreen";
import { DeptGlobe } from "./DeptGlobe";
import "../history/history.css";
import "../history/hero.css";
import "../history/globe-stage.css";
import "./argentina.css";
import "./argentina-glass.css";

/**
 * "See more" de un departamento de Argentina con el mismo diseño que el de un condado de EE. UU. (vidrio oscuro
 * sobre el globo de la NASA). Sin historia: en Argentina no hay mapa de cultivos por año ni estimación del modelo,
 * así que no hay línea de tiempo. Arriba va el resumen 2001–2024 (rinde contra los análogos de EE. UU. y medianas
 * del clima de la campaña); abajo, todo lo que ya mostraba la pantalla: rinde y clima por campaña, suelo y análogos.
 */

const CROPS: ArCrop[] = ["corn", "soy", "wheat"];
const WITH_HISTORY = new Set(
  (D as unknown as { counties: { id: string; stat: { history?: boolean | string } }[] }).counties
    .filter((c) => c.stat?.history)
    .map((c) => c.id),
);

function median(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function DeptGlass({ id }: { id: string }) {
  const [d, setD] = useState<ArDept | null>(null);
  const [failed, setFailed] = useState(false);
  const [crop, setCrop] = useState<ArCrop>("corn");
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let off = false;
    loadArDept(id)
      .then((x) => !off && setD(x))
      .catch(() => !off && setFailed(true));
    return () => {
      off = true;
    };
  }, [id]);
  if (failed) return <main className="history"><Missing what={`department ${id} is not in the Argentina data`} /></main>;
  if (!d) return <main className="history" role="status">Loading…</main>;

  const compare = d.yield_compare ?? {};
  const ranked = CROPS.filter((c) => compare[c]).sort((a, b) => compare[b]!.ratio_ar_us - compare[a]!.ratio_ar_us);
  const clim = (d.climate ?? []).filter((c) => c.year >= 2001 && c.year <= 2024);
  const med = {
    rain: median(clim.map((c) => c.season_rain_mm)),
    balance: median(clim.map((c) => c.season_water_balance_mm)),
    janRain: median(clim.map((c) => c.january_rain_mm)),
    janHigh: median(clim.map((c) => c.january_max_temp_c)),
  };
  const climMissing = d.climate_note ?? "season weather (NASA POWER) is not loaded for this department";
  const years = d.yields.length;

  return (
    <main className="history ar-glass">
      <nav className="history__eyebrow" aria-label="Department">
        <a className="history__back solid-btn" href={`#/map/${id}`} aria-label="Back to the map" title="Back to the map">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </a>
        <p className="history__where">
          {d.name}, {d.province} <span className="ar-glass__kind">· Argentina · department</span>
        </p>
      </nav>

      <div className="history__stage history__stage--globe">
        <div ref={slot} className="history__slot" aria-hidden="true" />
        <DeptGlobe id={id} slot={slot} />
        <p className={`ar-glass__zone ar-glass__zone--${d.zone}`} title={d.zone_text}>
          {d.zone_label}
        </p>

        <div className="history__story">
          <div className="headline">
            <h1>
              <span className="headline__year">2001–2024</span>
              <span className="visually-hidden"> in {d.name}:</span>
            </h1>
            <ul>
              {ranked.length ? (
                <li>
                  Yield here vs its U.S. weather analogs:{" "}
                  {ranked.map((c, i) => (
                    <span key={c}>
                      {i ? ", " : ""}
                      <b className="ar-glass__crop" style={{ color: CROP_COLOR[c] }}>{CROP_LABEL[c].toLowerCase()}</b>{" "}
                      {Math.round(compare[c]!.ratio_ar_us * 100)}%
                    </span>
                  ))}
                  .
                </li>
              ) : null}
              <li className="ar-glass__why">
                {d.zone_label}. {d.zone_text}
              </li>
              <li className="ar-glass__why">
                {/^no yield estimate/i.test(d.prediction_note) ? d.prediction_note : <><b>No yield estimate.</b> {d.prediction_note}</>}
              </li>
            </ul>
          </div>

          <div className="story-card ar-glass__cmp">
            <h2 className="ar-glass__h">Yield vs its U.S. weather analogs</h2>
            {ranked.length ? (
              <ul className="ar-cmp">
                {CROPS.map((c) => (compare[c] ? <CompareRow key={c} crop={c} y={compare[c] as YieldCompare} onDark /> : null))}
              </ul>
            ) : (
              <Missing what="MAGyP has no yields for this department" />
            )}
            <p className="ar-glass__small">
              Dot = median here. Line = analog median. Band = the analogs' usual range (p10–p90).{" "}
              <SourceChip source="MAGyP · USDA NASS" />
            </p>
          </div>

          <section className="tiles-block" aria-label="Season weather, medians 2001–2024">
            <ul className="tiles">
              <Tile icon={ICON.rain} label="Rain, Oct–Mar" value={med.rain === null ? null : <Num n={Math.round(med.rain)} unit="mm" />} missing={climMissing} />
              <Tile icon={ICON.soil} label="Water balance" value={med.balance === null ? null : <Num n={Math.round(med.balance)} unit="mm" />} missing={climMissing} />
              <Tile icon={ICON.heat} label="January highs" value={med.janHigh === null ? null : <Num n={Number(med.janHigh.toFixed(1))} unit="°C" />} missing={climMissing} />
              <Tile icon={ICON.rain} label="January rain" value={med.janRain === null ? null : <Num n={Math.round(med.janRain)} unit="mm" />} missing={climMissing} />
            </ul>
            <p className="ar-glass__small">
              Medians 2001–2024. {d.season_months}: January here is July in the Corn Belt.
            </p>
            <p className="tiles-block__sources">
              {d.sources.map((s) => (
                <SourceChip key={s} source={s} />
              ))}
            </p>
          </section>
        </div>
      </div>

      <section className="history__more" aria-labelledby="ar-more">
        <h2 id="ar-more">
          {years} seasons in {d.name}
        </h2>
        <div className="history__cards">
          <div className="card">
            <div className="ar-card__row">
              <h3>Yield by season</h3>
              <div className="ar-toggle ar-toggle--small" role="group" aria-label="Crop">
                {CROPS.map((c) => (
                  <button key={c} type="button" aria-pressed={crop === c} onClick={() => setCrop(c)}>
                    <CropIcon crop={c} size={16} />
                    {CROP_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
            <YieldSeries d={d} crop={crop} />
            <p className="history__small">
              <SourceChip source="MAGyP · department" />
            </p>
          </div>
          <div className="card">
            <h3>Weather by season</h3>
            <p className="history__small">{d.season_months}. January here is July in the Corn Belt.</p>
            {d.climate && d.climate.length ? <ClimateTable rows={d.climate} /> : <Missing what={climMissing} />}
          </div>
        </div>
        <div className="history__cards">
          <div className="card">
            <h3>Soil, 0–30 cm</h3>
            <SoilTable d={d} />
          </div>
          <div className="card">
            <h3>U.S. counties with the most similar weather</h3>
            <ol className="ar-analogs">
              {d.analogs.map((a) => (
                <li key={a.fips}>
                  <a href={WITH_HISTORY.has(a.fips) ? `#/county/${a.fips}` : `#/map/${a.fips}`}>
                    <b>
                      {a.name} County, {a.state}
                    </b>
                    <span>{WITH_HISTORY.has(a.fips) ? "Rewind its history →" : "See it on the map →"}</span>
                  </a>
                </li>
              ))}
            </ol>
            {d.radiation_diff_mj_m2_day !== null ? (
              <p className="history__small">
                This department gets about {Math.abs(d.radiation_diff_mj_m2_day)} MJ/m² per day{" "}
                {d.radiation_diff_mj_m2_day > 0 ? "more" : "less"} sunlight in its season than its closest analog.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
