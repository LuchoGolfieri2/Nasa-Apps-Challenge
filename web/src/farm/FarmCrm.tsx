/**
 * My Farm como CRM (F40) · tablero de #/farm. Diseño "Paper CRM" (mockup A elegido el 15/11):
 *   fila de 3 números · ingreso por año de clima (consejo contra seguir igual) · condados gemelos · antes de decidir ·
 *   quién ya lo hace en el condado (CDL) · rinde del condado (NASS). Botón para bajar el informe en PDF.
 */
import { useEffect, useMemo, useState } from "react";
import { dataUrl, loadCounty } from "../data/load";
import type { County } from "../data/types";
import { PRIORITY_LABEL, type NextData } from "../next/types";
import { CROP_LABEL, type CropId } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { wipeTo } from "../ui/wipe";
import {
  adoption,
  baseTitle,
  compare,
  pickAdvice,
  optionStep,
  pct1,
  signed,
  stepPct,
  usd,
  loadTwins,
  type TwinRow,
} from "./crm";
import { HalfRing, IncomeChart, Spark, WinPips, YieldBars } from "./crmCharts";
import { COUNTY_BY_FIPS, FARM_CROP_LABEL, farmIncome, priceCost, type Farm } from "./farm";
import "./crm.css";

const rangeText = (r: { p10: number; p90: number } | null) => (r ? `Range ${usd(r.p10)}–${usd(r.p90)} · ` : "");

const RING = ["var(--field)", "var(--sprout)", "var(--wheat-gold)", "var(--soil)", "#b9b2a0"];

export function FarmCrm({ farm }: { farm: Farm }) {
  const county = COUNTY_BY_FIPS[farm.fips];
  const [next, setNext] = useState<NextData | null>(null);
  const [hist, setHist] = useState<County | null>(null);
  const [twins, setTwins] = useState<TwinRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState<"idle" | "busy" | "error">("idle");

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

  const cmp = useMemo(() => (next ? compare(next, farm) : null), [next, farm]);
  // sin comparación (el modelo tiene una sola opción en el condado) igual se muestra la opción y sus gemelos
  const advice = useMemo(() => cmp?.advice.option ?? (next ? pickAdvice(next, farm) : null), [cmp, next, farm]);
  const soloIncome = !cmp && advice ? farmIncome(advice.yield_bu_ac, priceCost(farm, farm.plan)) : null;

  useEffect(() => {
    let off = false;
    setTwins(null);
    if (next && advice) loadTwins(next, advice).then((r) => !off && setTwins(r));
    else if (next) setTwins([]);
    return () => {
      off = true;
    };
  }, [next, advice]);

  const adopt = useMemo(() => adoption(hist), [hist]);
  const step = advice ? optionStep(advice) : null;
  const crop = FARM_CROP_LABEL[farm.plan];
  const lastHarvest = hist?.years.filter((y) => y.yield).slice(-1)[0]?.year ?? null;
  const season = next?.mix?.season ?? (lastHarvest ? lastHarvest + 1 : null);
  const acres = farm.acres;
  const gap = cmp && cmp.adviceMedian != null && cmp.baseMedian != null ? cmp.adviceMedian - cmp.baseMedian : null;
  const rel = (a: number | null, b: number | null) =>
    a != null && b != null && b !== 0 ? Math.round(((a - b) / Math.abs(b)) * 100) : null;
  const upPct = cmp ? rel(cmp.adviceMedian, cmp.baseMedian) : null;
  const downPct = cmp ? rel(cmp.baseMedian, cmp.adviceMedian) : null;
  const bTitle = cmp ? baseTitle(cmp, farm) : "";
  const yieldPts = (hist?.years ?? []).map((y) => {
    const v = y.yield?.crops[farm.plan];
    return {
      year: y.year,
      value: v?.bu_ac ?? null,
      flag: v?.vs_usual === "below" || v?.vs_usual === "above" ? v.vs_usual : null,
    };
  });
  const lowYear = yieldPts.filter((p) => p.flag === "below").map((p) => p.year);

  async function exportPdf() {
    if (!next || !cmp) return;
    setExporting("busy");
    try {
      const { buildReport } = await import("./exportPdf");
      await buildReport({ farm, next, hist, cmp, twins: twins ?? [], adoption: adopt });
      setExporting("idle");
    } catch {
      setExporting("error");
    }
  }

  return (
    <div className="crm">
      <header className="crm-top">
        <h1>{farm.name || "My Farm"}</h1>
        <span className="crm-pill">
          {county?.label ?? farm.fips}
          {acres ? ` · ${acres.toLocaleString("en-US")} ac` : ""}
          {lastHarvest ? (
            <>
              {" "}
              · Data through <b>{lastHarvest} harvest</b>
            </>
          ) : null}
        </span>
        <span className="crm-sp" />
        <span className="crm-pill">
          {crop}
          {season ? ` · Next season ${season}` : ""}
        </span>
        <a className="crm-btn" href="#/farm/edit">
          Edit farm
        </a>
        <a className="crm-btn" href={`#/county/${farm.fips}/next`} onClick={(e) => wipeTo(e, "Next season")}>
          All options
        </a>
        <button
          type="button"
          className="crm-btn crm-btn--primary"
          onClick={exportPdf}
          disabled={!cmp || exporting === "busy"}
          title={!cmp && next ? "Needs two options to compare in this county" : undefined}
          aria-describedby="crm-export-note"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {exporting === "busy" ? "Building PDF…" : "Export report (PDF)"}
        </button>
        <span id="crm-export-note" className="crm-sr">
          Downloads a PDF with every number on this page, where it comes from and how it was calculated.
        </span>
        {exporting === "error" ? (
          <p className="crm-error" role="alert">
            The PDF could not be built. Try again.
          </p>
        ) : null}
      </header>

      {failed ? (
        <div className="crm-card">
          <Missing what="the yield model for this county" />
        </div>
      ) : !next || !hist ? (
        <p className="crm-loading" role="status">
          Loading your county…
        </p>
      ) : (
        <div className="crm-grid">
          <div className="crm-main">
            {/* ------------------------------------------------ números */}
            {cmp ? (
              <>
                <section className="crm-card crm-kpi" aria-label="Expected income with our advice">
                  <div className="crm-kpi-lbl">
                    <span>Income · our advice</span>
                    {upPct != null ? <span className="crm-up">▲ {Math.abs(upPct)}%</span> : null}
                  </div>
                  <p className="crm-kpi-v">
                    {cmp.adviceMedian != null ? usd(cmp.adviceMedian) : "—"}
                    <small>/ac</small>
                  </p>
                  <p className="crm-kpi-s">
                    {rangeText(farmIncome(advice?.yield_bu_ac ?? null, cmp.pc))}
                    {advice?.label.toLowerCase()}
                  </p>
                  <Spark values={cmp.advice.income} tone="a" />
                  <a className="crm-more" href="#crm-income">
                    See how it's calculated ›
                  </a>
                </section>
                <section className="crm-card crm-kpi" aria-label={bTitle}>
                  <div className="crm-kpi-lbl">
                    <span>{bTitle}</span>
                    {downPct != null && downPct < 0 ? <span className="crm-down">▼ {Math.abs(downPct)}%</span> : null}
                  </div>
                  <p className="crm-kpi-v">
                    {cmp.baseMedian != null ? usd(cmp.baseMedian) : "—"}
                    <small>/ac</small>
                  </p>
                  <p className="crm-kpi-s">
                    {rangeText(farmIncome(cmp.base.option.yield_bu_ac, cmp.pc))}
                    {cmp.base.option.label.toLowerCase()}
                  </p>
                  <Spark values={cmp.base.income} tone="b" />
                  <a className="crm-more" href="#crm-income">
                    See how it's calculated ›
                  </a>
                </section>
                <section className="crm-card crm-kpi" aria-label="Extra income on your farm">
                  <div className="crm-kpi-lbl">
                    <span>{acres ? `Extra on your ${acres.toLocaleString("en-US")} acres` : "Extra per acre"}</span>
                    <span className="crm-up">
                      {cmp.wins} of {cmp.seasons} yrs
                    </span>
                  </div>
                  <p className="crm-kpi-v">{gap == null ? "—" : acres ? signed(gap * acres) : signed(gap)}</p>
                  <p className="crm-kpi-s">
                    Our advice paid more in {cmp.wins} of the last {cmp.seasons} seasons' weather
                  </p>
                  <WinPips years={cmp.years} a={cmp.advice.income} b={cmp.base.income} />
                  {!acres ? (
                    <a className="crm-more" href="#/farm/edit">
                      Add your acres to see your whole farm ›
                    </a>
                  ) : (
                    <a className="crm-more" href="#crm-income">
                      See the {cmp.seasons} seasons ›
                    </a>
                  )}
                </section>
              </>
            ) : (
              <>
                {advice && soloIncome ? (
                  <section className="crm-card crm-kpi" aria-label={`Income · ${advice.label}`}>
                    <div className="crm-kpi-lbl">
                      <span>Income · {advice.label.toLowerCase()}</span>
                    </div>
                    <p className="crm-kpi-v">
                      {usd(soloIncome.median)}
                      <small>/ac</small>
                    </p>
                    <p className="crm-kpi-s">{rangeText(soloIncome)}typical year</p>
                  </section>
                ) : null}
                <section className={`crm-card ${advice && soloIncome ? "crm-span2" : "crm-span3"}`}>
                  <Missing
                    what={
                      advice && soloIncome
                        ? "a second option to compare. For this county the yield model only covers the usual mix, so it cannot say what rotating or repeating the crop would change."
                        : "income by season for this county (price, cost or model years)"
                    }
                  />
                </section>
              </>
            )}

            {/* ------------------------------------------------ gráfico principal */}
            <section className="crm-card crm-span3" id="crm-income" aria-labelledby="crm-inc-h">
              <div className="crm-head">
                <div>
                  <h2 id="crm-inc-h">Income summary</h2>
                  <p className="crm-sub">
                    $/acre left after operating costs, if next season had the weather of each past year
                  </p>
                </div>
                <span className="crm-sp" />
                {cmp ? (
                  <div className="crm-legend">
                    <span>
                      <i className="crm-key crm-key--a" />
                      Our advice
                    </span>
                    <span>
                      <i className="crm-key crm-key--b" />
                      {bTitle}
                    </span>
                  </div>
                ) : null}
                {cmp ? (
                  <span className="crm-pill">
                    Weather years:{" "}
                    <b>
                      {cmp.years[0]} – {cmp.years[cmp.years.length - 1]}
                    </b>
                  </span>
                ) : null}
              </div>
              {cmp ? (
                <>
                  <IncomeChart
                    years={cmp.years}
                    a={cmp.advice.income}
                    b={cmp.base.income}
                    aLabel="Our advice"
                    bLabel={bTitle}
                  />
                  <p className="crm-src">
                    Field Rewind yield model × price ${cmp.pc.price.toFixed(2)}/bu (
                    {cmp.pc.priceFrom === "you" ? "your data" : "USDA NASS"}) − operating cost {usd(cmp.pc.cost)}/ac (
                    {cmp.pc.costFrom === "you" ? "your data" : "USDA ERS"}
                    {cmp.pc.years && (cmp.pc.priceFrom === "usda" || cmp.pc.costFrom === "usda")
                      ? `, ${cmp.pc.years}`
                      : ""}
                    ). Same price and cost every year: only the weather changes.
                    {farm.priorities.length
                      ? ` Advice picked for: ${farm.priorities.map((p) => PRIORITY_LABEL[p].toLowerCase()).join(", ")}.`
                      : " No priorities set: advice is the option with the highest typical income."}
                  </p>
                </>
              ) : (
                <Missing what="income by season for this county" />
              )}
            </section>

            {/* ------------------------------------------------ abajo */}
            <div className="crm-span3 crm-bottom">
              <section className="crm-card" aria-labelledby="crm-ad-h">
                <div className="crm-head">
                  <h2 id="crm-ad-h">Who already does it</h2>
                  <span className="crm-sp" />
                  {adopt ? <span className="crm-chip">CDL {adopt.year}</span> : null}
                </div>
                <p className="crm-sub">{county?.name} County cropland by rotation</p>
                {!adopt ? (
                  <Missing what="USDA crop maps for this county" />
                ) : (
                  <>
                    <div className="crm-ring">
                      <HalfRing
                        parts={adopt.items.slice(0, 5).map((x, i) => ({
                          pct: x.pct,
                          color: RING[i],
                          label: x.label ?? `${x.from} → ${x.to}`,
                        }))}
                      />
                      <div className="crm-ring-c">
                        {step ? (
                          <>
                            <b>{Math.round(stepPct(adopt.items, step) ?? 0)}%</b>
                            <span>{advice?.label.toLowerCase()}</span>
                          </>
                        ) : (
                          <>
                            <b>
                              {Math.round(adopt.items.filter((x) => x.from !== x.to).reduce((s, x) => s + x.pct, 0))}%
                            </b>
                            <span>rotates crops</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ul className="crm-ring-legend">
                      {adopt.items.slice(0, 5).map((x, i) => (
                        <li key={`${x.from}-${x.to}`}>
                          <i style={{ background: RING[i] }} />
                          {x.label ??
                            `${CROP_LABEL[x.from as CropId] ?? x.from} → ${CROP_LABEL[x.to as CropId] ?? x.to}`}{" "}
                          {pct1(x.pct)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="crm-src">
                  USDA Cropland Data Layer, 30 m · share of cropland by last year's and this year's crop
                </p>
              </section>

              <section className="crm-card" aria-labelledby="crm-y-h">
                <div className="crm-head">
                  <h2 id="crm-y-h">{crop} yield in your county</h2>
                  <span className="crm-sp" />
                  {lowYear.length ? (
                    <span className="crm-chip crm-chip--red">{lowYear.join(", ")} · below usual</span>
                  ) : null}
                </div>
                <p className="crm-sub">
                  bu/acre · {yieldPts[0]?.year}–{yieldPts[yieldPts.length - 1]?.year} · USDA NASS
                </p>
                {yieldPts.some((p) => p.value != null) ? (
                  <YieldBars points={yieldPts} />
                ) : (
                  <Missing what="county yield" />
                )}
                <p className="crm-src">
                  Red: more than 10% below a usual year here (Field Rewind model).{" "}
                  <a href={`#/county/${farm.fips}`}>Rewind your county ›</a>
                </p>
              </section>
            </div>
          </div>
          {/* ------------------------------------------------ columna derecha */}
          <aside className="crm-side">
            <section className="crm-card" aria-labelledby="crm-tw-h">
              <h2 id="crm-tw-h">Twin counties that did it</h2>
              <p className="crm-sub">
                Same soil &amp; climate · planted {advice ? advice.label.toLowerCase() : crop.toLowerCase()}
              </p>
              {!twins ? (
                <p role="status" className="crm-sub">
                  Loading…
                </p>
              ) : twins.length === 0 ? (
                <Missing what="twin counties for this option" />
              ) : (
                <ul className="crm-leads">
                  {twins.map((t) => (
                    <li key={t.fips}>
                      <a href={`#/county/${t.fips}`} className="crm-lead">
                        <span className="crm-av" aria-hidden="true">
                          {t.state}
                        </span>
                        <span className="crm-lead-main">
                          <b>
                            {t.name} County, {t.state}
                          </b>
                          <span>
                            {t.pct != null ? `${pct1(t.pct)} ${t.pctLabel}` : "Missing data"}
                            {t.monthsAgo != null ? ` · ${t.monthsAgo} mo ago` : ""}
                          </span>
                        </span>
                        <span className="crm-lead-g">
                          {t.change != null ? (
                            <b className={t.change >= 0 ? "crm-up" : "crm-down"}>
                              {t.change >= 0 ? "▲" : "▼"} {Math.abs(Math.round(t.change * 10) / 10)}%
                            </b>
                          ) : (
                            <b className="crm-muted">—</b>
                          )}
                          <span>{t.latest != null ? `${Math.round(t.latest)} bu/ac` : "Missing data"}</span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <p className="crm-src">
                {crop} yield {twins?.[0]?.year ?? "latest"} vs their own 2015–19 average · USDA NASS, CDL. The rise
                includes the yield trend, not only the rotation.
              </p>
            </section>

            <section className="crm-card" aria-labelledby="crm-w-h">
              <h2 id="crm-w-h">Before you decide</h2>
              <ul className="crm-tasks">
                {advice ? (
                  <li>
                    <b>
                      Confidence: {advice.confidence.level}{" "}
                      <span
                        className={`crm-chip ${advice.confidence.level === "low" ? "crm-chip--red" : "crm-chip--gold"}`}
                      >
                        Model
                      </span>
                    </b>
                    <span>{advice.confidence.reason}</span>
                  </li>
                ) : null}
                {next.missing.map((m) => {
                  const miss = /no data|no usda/i.test(m.why);
                  return (
                    <li key={m.what}>
                      <b>
                        {m.what}{" "}
                        <span className={`crm-chip ${miss ? "crm-chip--red" : "crm-chip--gold"}`}>
                          {miss ? "Missing data" : "Estimate"}
                        </span>
                      </b>
                      <span>{m.why}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
