/**
 * My Farm (F29) · rutas #/farm (tablero, o el formulario si todavía no hay campo) y #/farm/edit.
 *
 * El tablero cruza lo que cargó el productor con los datos del condado:
 *   - su opción para la próxima campaña (según lo que sembró el año pasado) y la sugerida por sus prioridades
 *   - medidor con el rinde de un año malo, típico y bueno (modelo de ML)
 *   - ingreso con su precio y su costo (o los del USDA), por acre y para todo el campo
 *   - sus últimas campañas, el clima del último año (NASA POWER) y la curva de rinde del condado (USDA NASS)
 */
import { useEffect, useMemo, useState } from "react";
import { dataUrl, loadCounty } from "../data/load";
import type { County } from "../data/types";
import { Icon, PRIORITY_ICON } from "../next/icons";
import { commonAxis, suggest } from "../next/suggest";
import { PRIORITY_LABEL, type NextData } from "../next/types";
import { CROP_COLOR } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import { Gauge, YieldArea } from "./charts";
import { CropArt } from "./CropArt";
import {
  COUNTY_BY_FIPS,
  FARM_CROP_LABEL,
  FARM_YEARS,
  farmIncome,
  farmOption,
  loadFarm,
  priceCost,
  rotationSummary,
  type Farm,
} from "./farm";
import { FarmForm } from "./FarmForm";
import "./farm.css";

const usd = (v: number) =>
  `${v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
const big = (v: number) => {
  const a = Math.abs(v);
  const s =
    a >= 1e6
      ? `$${(a / 1e6).toFixed(2)}M`
      : a >= 1e4
        ? `$${Math.round(a / 1e3)}k`
        : `$${Math.round(a).toLocaleString("en-US")}`;
  return v < 0 ? `−${s}` : s;
};

function useFarm(): Farm | null {
  const [farm, setFarm] = useState(loadFarm);
  useEffect(() => {
    const on = () => setFarm(loadFarm());
    window.addEventListener("fieldrewind:farm", on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener("fieldrewind:farm", on);
      window.removeEventListener("storage", on);
    };
  }, []);
  return farm;
}

export function FarmScreen({ edit }: { edit: boolean }) {
  const farm = useFarm();
  // con llaves: en Chrome nuevo scrollTo devuelve una Promise, y React la tomaría como función de limpieza
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [edit]);
  if (edit || !farm) {
    return (
      <main className="fm">
        <FarmForm
          initial={farm}
          onSaved={() => (window.location.hash = "#/farm")}
        />
      </main>
    );
  }
  return (
    <main className="fm">
      <FarmDashboard farm={farm} />
    </main>
  );
}

function FarmDashboard({ farm }: { farm: Farm }) {
  const county = COUNTY_BY_FIPS[farm.fips];
  const [next, setNext] = useState<NextData | null>(null);
  const [hist, setHist] = useState<County | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let off = false;
    setNext(null);
    setHist(null);
    setFailed(false);
    fetch(dataUrl(`data/next/${farm.fips}.json`))
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<NextData>;
      })
      .then((d) => !off && setNext(d))
      .catch(() => !off && setFailed(true));
    loadCounty(farm.fips)
      .then((c) => !off && setHist(c))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [farm.fips]);

  const plan = next?.crops[farm.plan] ?? null;
  const mine = next ? farmOption(next, farm) : null;
  const result = useMemo(
    () => (plan ? suggest(plan.options, farm.priorities) : null),
    [plan, farm.priorities],
  );
  const axis = useMemo(() => (plan ? commonAxis(plan.options) : null), [plan]);
  const usual =
    plan?.options.find((o) => o.is_current)?.yield_bu_ac?.median ?? null;
  const pc = priceCost(farm, farm.plan);
  const perAcre = farmIncome(mine?.yield_bu_ac ?? null, pc);
  const winner = result?.winner ?? null;
  const winnerIncome = farmIncome(winner?.yield_bu_ac ?? null, pc);
  const last = hist?.years.filter((y) => y.weather).slice(-1)[0] ?? null;

  const area = (hist?.years ?? []).map((y) => {
    const v = y.yield?.crops[farm.plan === "soy" ? "soy" : "corn"];
    return {
      year: y.year,
      value: v?.bu_ac ?? null,
      flag:
        v?.vs_usual === "below" || v?.vs_usual === "above" ? v.vs_usual : null,
    };
  });

  const title = farm.name || `Your farm in ${county?.name ?? farm.fips} County`;

  return (
    <div className="fm-dash">
      <header className="fm-dash-head">
        <div>
          <p className="fm-kicker">My Farm</p>
          <h1>{title}</h1>
        </div>
        <div className="fm-dash-actions">
          <a className="btn" href="#/farm/edit">
            Edit my farm
          </a>
          <a className="btn btn--primary" href={`#/county/${farm.fips}/next`}>
            All options for next season →
          </a>
        </div>
      </header>

      <div className="fm-bento">
        {/* Portada: la ilustración del cultivo que piensa sembrar, con vidrio encima */}
        <section className="fm-card fm-hero" aria-label="Your farm">
          <CropArt
            crop={farm.plan}
            scene
            className="fm-hero-art"
            label={`Illustration of a ${FARM_CROP_LABEL[farm.plan].toLowerCase()} field`}
          />
          <div className="fm-glass fm-hero-where">
            <Icon name="pin" size={16} />
            {county?.label ?? farm.fips}
          </div>
          <div className="fm-hero-stats">
            <div className="fm-glass">
              <span>Cropland</span>
              <b>
                {farm.acres
                  ? `${farm.acres.toLocaleString("en-US")} ac`
                  : "Not set"}
              </b>
            </div>
            <div className="fm-glass">
              <span>Next season</span>
              <b>{FARM_CROP_LABEL[farm.plan]}</b>
            </div>
            <div className="fm-glass">
              <span>You care about</span>
              <b className="fm-hero-prio">
                {farm.priorities.length
                  ? farm.priorities.map((p) => (
                      <span
                        key={p}
                        className="fm-prio-ico"
                        role="img"
                        aria-label={PRIORITY_LABEL[p]}
                        title={PRIORITY_LABEL[p]}
                      >
                        <Icon name={PRIORITY_ICON[p]} size={18} />
                      </span>
                    ))
                  : "Nothing set"}
              </b>
            </div>
          </div>
        </section>

        {/* La opción del productor frente a la sugerida */}
        <section className="fm-card fm-plan-now" aria-labelledby="fm-plan-h">
          <h2 id="fm-plan-h">Your plan for next season</h2>
          {failed ? (
            <Missing what="the yield model for this county" />
          ) : !plan || !mine || !axis ? (
            <p role="status">Loading your county…</p>
          ) : (
            <>
              <p className="fm-plan-name">
                {mine.label}
                <small>{mine.sublabel}</small>
              </p>
              {mine.yield_bu_ac ? (
                <Gauge
                  range={mine.yield_bu_ac}
                  min={axis.min}
                  max={axis.max}
                  unit="bu/acre"
                  label="Typical yield"
                  usual={usual}
                />
              ) : (
                <Missing what="a yield range for this option" />
              )}
              <p className="fm-gauge-legend">
                <span>
                  Bad year{" "}
                  <b>
                    {mine.yield_bu_ac ? Math.round(mine.yield_bu_ac.p10) : "—"}
                  </b>
                </span>
                <span>
                  Good year{" "}
                  <b>
                    {mine.yield_bu_ac ? Math.round(mine.yield_bu_ac.p90) : "—"}
                  </b>
                </span>
                {usual !== null ? (
                  <span className="fm-dash-key">county usual</span>
                ) : null}
              </p>
              <div
                className={`fm-verdict${winner && winner.id === mine.id ? " fm-verdict--match" : ""}`}
              >
                {!winner ? (
                  <p>Pick a priority to get a suggestion.</p>
                ) : winner.id === mine.id ? (
                  <p>
                    <Icon name="check" size={16} />{" "}
                    <b>That's also what we'd suggest</b> for your priorities.
                  </p>
                ) : (
                  <p>
                    For your priorities we'd suggest{" "}
                    <b>{winner.label.toLowerCase()}</b>
                    {winner.yield_bu_ac && mine.yield_bu_ac ? (
                      <>
                        {" "}
                        (
                        {Math.round(
                          winner.yield_bu_ac.median - mine.yield_bu_ac.median,
                        ) > 0
                          ? "+"
                          : ""}
                        {Math.round(
                          winner.yield_bu_ac.median - mine.yield_bu_ac.median,
                        )}{" "}
                        bu/acre typical)
                      </>
                    ) : null}
                    .
                  </p>
                )}
                {result?.reasons[0] ? (
                  <p className="fm-reason">{result.reasons[0].text}</p>
                ) : null}
              </div>
              <SourceChip source={mine.source} />
            </>
          )}
        </section>

        {/* Ingreso */}
        <section className="fm-card fm-income" aria-labelledby="fm-inc-h">
          <h2 id="fm-inc-h">Left after operating costs</h2>
          {!perAcre || !pc ? (
            <Missing what="price or cost for this crop" />
          ) : (
            <>
              <p className="fm-income-big">
                {farm.acres
                  ? big(perAcre.median * farm.acres)
                  : usd(perAcre.median)}
                <small>
                  {farm.acres
                    ? `for ${farm.acres.toLocaleString("en-US")} acres, typical year`
                    : "per acre, typical year"}
                </small>
              </p>
              <div className="fm-income-range" aria-label="Bad and good year">
                <span>
                  Bad year{" "}
                  <b>
                    {farm.acres
                      ? big(perAcre.p10 * farm.acres)
                      : usd(perAcre.p10)}
                  </b>
                </span>
                <span>
                  Good year{" "}
                  <b>
                    {farm.acres
                      ? big(perAcre.p90 * farm.acres)
                      : usd(perAcre.p90)}
                  </b>
                </span>
              </div>
              {winner && winnerIncome && winner.id !== mine?.id ? (
                <p className="fm-income-alt">
                  With {winner.label.toLowerCase()}:{" "}
                  <b>
                    {farm.acres
                      ? big(winnerIncome.median * farm.acres)
                      : usd(winnerIncome.median)}
                  </b>
                </p>
              ) : null}
              <ul className="fm-inputs">
                <li>
                  Price <b>${pc.price.toFixed(2)}/bu</b>{" "}
                  <em className={pc.priceFrom === "you" ? "you" : ""}>
                    {pc.priceFrom === "you" ? "your data" : "USDA NASS"}
                  </em>
                </li>
                <li>
                  Cost <b>{usd(pc.cost)}/acre</b>{" "}
                  <em className={pc.costFrom === "you" ? "you" : ""}>
                    {pc.costFrom === "you" ? "your data" : "USDA ERS"}
                  </em>
                </li>
              </ul>
              {!farm.acres ? (
                <a className="fm-link" href="#/farm/edit">
                  Add your acres to see your whole farm →
                </a>
              ) : null}
            </>
          )}
        </section>

        {/* Últimas campañas, con su ilustración */}
        <section
          className="fm-card fm-seasons-card"
          aria-labelledby="fm-seas-h"
        >
          <div className="fm-card-head">
            <h2 id="fm-seas-h">Your last seasons</h2>
            <span className="fm-you">Your data</span>
          </div>
          <ol className="fm-season-list">
            {FARM_YEARS.map((y) => {
              const c = farm.seasons[String(y)];
              return (
                <li key={y} className="fm-season-tile">
                  {c ? (
                    <CropArt crop={c} />
                  ) : (
                    <div className="fm-season-empty" />
                  )}
                  <span className="fm-glass fm-season-tag">
                    <b>{y}</b> {c ? FARM_CROP_LABEL[c] : "Not set"}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="fm-rot">{rotationSummary(farm)}</p>
        </section>

        {/* Clima del último año */}
        <section className="fm-card fm-weather" aria-labelledby="fm-w-h">
          <div className="fm-card-head">
            <h2 id="fm-w-h">{last ? `${last.year} weather` : "Weather"}</h2>
            <SourceChip source="NASA POWER" />
          </div>
          {!hist ? (
            <p role="status">Loading…</p>
          ) : !last?.weather ? (
            <Missing what="weather for this county" />
          ) : (
            <>
              <div className="fm-weather-grid">
                <div>
                  <Icon name="drop" size={18} />
                  <b>{last.weather.season_rain_in.toFixed(1)} in</b>
                  <span>Rain, April–September</span>
                </div>
                <div>
                  <Icon name="thermo" size={18} />
                  <b>{Math.round(last.weather.july_tmax_f)} °F</b>
                  <span>July highs</span>
                </div>
                <div>
                  <Icon name="bars" size={18} />
                  <b>{last.weather.days_over_86f_july}</b>
                  <span>July days over 86 °F</span>
                </div>
              </div>
              {last.weather.tags.length ? (
                <p className="fm-tags">
                  {last.weather.tags.map((t) => (
                    <span key={t}>
                      {t.replace(/^./, (c) => c.toUpperCase())}
                    </span>
                  ))}
                </p>
              ) : null}
            </>
          )}
        </section>

        {/* Curva del rinde del condado */}
        <section className="fm-card fm-yield" aria-labelledby="fm-y-h">
          <div className="fm-card-head">
            <h2 id="fm-y-h">
              {FARM_CROP_LABEL[farm.plan]} yield in {county?.name} County
            </h2>
            <SourceChip source="USDA NASS · county" />
          </div>
          {area.some((p) => p.value !== null) ? (
            <YieldArea
              points={area}
              color={CROP_COLOR[farm.plan]}
              unit="bu"
              label={`${FARM_CROP_LABEL[farm.plan]} yield by year`}
            />
          ) : hist ? (
            <Missing what="county yield" />
          ) : (
            <p role="status">Loading…</p>
          )}
          <p className="fm-note">
            ↑ ↓ years more than 10% above or below a usual year here (Field
            Rewind yield model). — no published yield.
          </p>
          <a className="fm-link" href={`#/county/${farm.fips}`}>
            Rewind your county, year by year →
          </a>
        </section>
      </div>
    </div>
  );
}
