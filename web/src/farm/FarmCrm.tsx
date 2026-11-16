/**
 * My Farm (F40) · tablero de #/farm, versión 2 (Figma 31:2 "My Farm · v2"):
 *   cabecera · panel oscuro con el consejo, sus tres números y los años de clima ganados ·
 *   ingreso por año de clima + condados gemelos · quién ya lo hace (CDL) + rinde del condado (NASS) ·
 *   antes de decidir · fuentes. Entrada en cascada (sin movimiento si el sistema lo pide).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { dataUrl, loadCounty } from "../data/load";
import type { County } from "../data/types";
import { PRIORITY_LABEL, type NextData } from "../next/types";
import { CROP_LABEL, type CropId } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { wipeTo } from "../ui/wipe";
import {
  adoption,
  adviceBasis,
  baseTitle,
  optionName,
  compare,
  pickAdvice,
  optionStep,
  pct1,
  signed,
  stepPct,
  usd,
  loadTwins,
  type Comparison,
  type TwinRow,
} from "./crm";
import { ShareBars, WinPips, YieldBars, type ShareRow } from "./crmCharts";
import { IncomeTrend } from "./IncomeTrend";
import { COUNTY_BY_FIPS, FARM_CROP_LABEL, farmIncome, priceCost, type Farm } from "./farm";
import "./crm.css";

/** retraso de la entrada, en ms (variable CSS --d) */
const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/** "repeating corn", "your county's usual mix"…: con qué se compara el consejo, dentro de una frase */
function baseVs(c: Comparison, farm: Farm) {
  const crop = FARM_CROP_LABEL[farm.plan].toLowerCase();
  if (c.baseWhy === "usual" || c.base.option.rotation === "actual") return "your county's usual mix";
  if (c.baseWhy === "repeat" || c.base.option.rotation === "continuo") return `repeating ${crop}`;
  return c.base.option.label.toLowerCase();
}

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
      .then((x) => !off && setNext(x))
      .catch(() => !off && setFailed(true));
    loadCounty(farm.fips)
      .then((c) => !off && setHist(c))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [farm.fips]);

  // las filas de abajo entran cuando el usuario llega a ellas; las que ya se ven al cargar siguen la cascada de la portada
  const root = useRef<HTMLDivElement>(null);
  const ready = !!next && !!hist;
  // antes de pintar, para que las filas de abajo no arranquen su animación fuera de pantalla
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !ready) return;
    const rows = [...el.querySelectorAll<HTMLElement>(".crm-reveal")];
    if (!("IntersectionObserver" in window)) return;
    el.dataset.reveal = "";
    const t0 = performance.now();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const row = e.target as HTMLElement;
          row.style.setProperty("--base", performance.now() - t0 < 150 ? `${row.dataset.base ?? 0}ms` : "0ms");
          row.dataset.in = "";
          io.unobserve(row);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    rows.forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, [ready]);

  const cmp = useMemo(() => (next ? compare(next, farm) : null), [next, farm]);
  // sin comparación (el modelo tiene una sola opción en el condado) igual se muestra la opción y sus gemelos
  const advice = useMemo(() => cmp?.advice.option ?? (next ? pickAdvice(next, farm) : null), [cmp, next, farm]);
  const adviceRange = advice ? farmIncome(advice.yield_bu_ac, cmp?.pc ?? priceCost(farm, farm.plan)) : null;

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
  const acres = farm.acres;
  const acresTxt = acres ? acres.toLocaleString("en-US") : null;
  const countyName = county ? `${county.name} County` : farm.fips;
  const gap = cmp && cmp.adviceMedian != null && cmp.baseMedian != null ? cmp.adviceMedian - cmp.baseMedian : null;
  const bTitle = cmp ? baseTitle(cmp, farm) : "";
  const basis = next ? adviceBasis(next, farm, advice) : null;
  // lo que el productor planea ya es lo que se aconseja
  const keeps = !!cmp?.planMatches;

  // diferencia por acre entre el consejo y la base, año de clima por año de clima
  const gaps = cmp
    ? cmp.years
        .map((_, i) => {
          const a = cmp.advice.income[i];
          const b = cmp.base.income[i];
          return a != null && b != null ? a - b : null;
        })
        .filter((v): v is number => v != null)
    : [];

  // rinde del condado: las últimas 11 campañas; lo habitual = promedio 2015–19 (con 3 años o más)
  const yieldPts = (hist?.years ?? []).slice(-11).map((y) => {
    const v = y.yield?.crops[farm.plan];
    return {
      year: y.year,
      value: v?.bu_ac ?? null,
      flag: v?.vs_usual === "below" || v?.vs_usual === "above" ? v.vs_usual : null,
    };
  });
  const usualVals = (hist?.years ?? [])
    .filter((y) => y.year >= 2015 && y.year <= 2019)
    .map((y) => y.yield?.crops[farm.plan]?.bu_ac)
    .filter((v): v is number => v != null);
  const usual = usualVals.length >= 3 ? usualVals.reduce((s, v) => s + v, 0) / usualVals.length : null;
  const lowYear = yieldPts.filter((p) => p.flag === "below").map((p) => p.year);

  // quién ya lo hace: las cinco rotaciones con más superficie
  const shareRows: ShareRow[] = (adopt?.items ?? []).slice(0, 5).map((x) => {
    const on = !!step && x.from === step.from && x.to === step.to;
    return {
      key: `${x.from}-${x.to}`,
      label: x.label ?? `${CROP_LABEL[x.from as CropId] ?? x.from} → ${CROP_LABEL[x.to as CropId] ?? x.to}`,
      pct: x.pct,
      tone: on ? "on" : x.from === farm.plan && x.to === farm.plan ? "repeat" : "other",
      suggested: on,
    };
  });
  const adoptPct = adopt
    ? step
      ? stepPct(adopt.items, step)
      : adopt.items.filter((x) => x.from !== x.to).reduce((s, x) => s + x.pct, 0)
    : null;

  const used = basis && !basis.byIncome ? basis.used : [];

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
    <div className="crm" ref={root}>
      <header className="crm-top crm-in" style={d(50)}>
        <div className="crm-top-t">
          <h1>{farm.name || "My Farm"}</h1>
        </div>
        <div className="crm-top-a">
          <a className="crm-btn" href="#/farm/edit">
            Edit farm
          </a>
          <a className="crm-btn" href={`#/county/${farm.fips}/next`} onClick={(e) => wipeTo(e, "Next season")}>
            Compare options
          </a>
          <button
            type="button"
            className="crm-btn crm-btn--primary"
            onClick={exportPdf}
            disabled={!cmp || exporting === "busy"}
            title={!cmp && next ? "Needs two options to compare in this county" : undefined}
            aria-describedby="crm-export-note"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3v12m0 0-5-5m5 5 5-5M4 19h16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {exporting === "busy" ? "Building PDF…" : "Export PDF report"}
          </button>
          <span id="crm-export-note" className="crm-sr">
            Downloads a PDF with every number on this page, where it comes from and how it was calculated.
          </span>
        </div>
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
        <>
          {/* ------------------------------------------------ consejo */}
          {advice ? (
            <section className="crm-hero crm-in" style={d(120)} aria-labelledby="crm-hero-h">
              <div className="crm-hero-main">
                <span className="crm-hero-pill">
                  {used.length
                    ? `Suggested for your priorities: ${used.map((p) => PRIORITY_LABEL[p].toLowerCase()).join(", ")}`
                    : "Highest typical income"}
                </span>
                <h2 id="crm-hero-h">Plant {(next.crops[advice.crop]?.label ?? crop).toLowerCase()}</h2>
                <div className="crm-stats">
                  <div className="crm-stat crm-in" style={d(300)}>
                    <span className="crm-stat-k">Expected income</span>
                    <b className="crm-stat-v">
                      {cmp?.adviceMedian != null
                        ? `${usd(cmp.adviceMedian)}/ac`
                        : adviceRange
                          ? `${usd(adviceRange.median)}/ac`
                          : "Missing data"}
                    </b>
                    {adviceRange ? (
                      <span className="crm-stat-s">
                        Range {usd(adviceRange.p10)}–{usd(adviceRange.p90)} per acre
                      </span>
                    ) : null}
                  </div>
                  {cmp ? (
                    <>
                      <div className="crm-stat crm-in" style={d(380)}>
                        <span className="crm-stat-k">
                          {gap != null && gap < 0 ? "Less" : "More"} than {baseVs(cmp, farm)}
                        </span>
                        <b className="crm-stat-v">{gap != null ? `${signed(gap)}/ac` : "Missing data"}</b>
                        <span className="crm-stat-s">
                          {bTitle}: {cmp.baseMedian != null ? `${usd(cmp.baseMedian)} per acre` : "Missing data"}
                        </span>
                      </div>
                      <div className="crm-stat crm-in" style={d(460)}>
                        <span className="crm-stat-k">{acresTxt ? `Extra on your ${acresTxt} acres` : "Extra per acre"}</span>
                        <b className="crm-stat-v">
                          {gap == null ? "Missing data" : acres ? signed(gap * acres) : `${signed(gap)}/ac`}
                        </b>
                        <span className="crm-stat-s">
                          {acres ? "In a typical weather year" : <a href="#/farm/edit">Add your acres to see your whole farm</a>}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
                <p className="crm-conf crm-in" style={d(540)}>
                  <span className="crm-conf-pill">Confidence: {advice.confidence.level}</span>
                </p>
                <a className="crm-hero-link" href="#crm-income">
                  How we calculated this →
                </a>
              </div>
              {cmp ? (
                <div className="crm-won">
                  <span className="crm-won-k">Weather years won</span>
                  <b className="crm-won-v">
                    {cmp.wins} of {cmp.seasons}
                  </b>
                  <WinPips years={cmp.years} a={cmp.advice.income} b={cmp.base.income} />
                  <p className="crm-won-n">
                    {gaps.length
                      ? Math.min(...gaps) === Math.max(...gaps)
                        ? `The gap was ${signed(gaps[0])} per acre every year.`
                        : `The gap per acre went from ${signed(Math.min(...gaps))} to ${signed(Math.max(...gaps))}.`
                      : ""}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {/* ------------------------------------------------ ingreso + gemelos */}
          <div className="crm-row crm-row--a crm-reveal" data-base="300">
            <section
              className="crm-card crm-trend-card crm-in"
              style={d(0)}
              id="crm-income"
              aria-labelledby="crm-inc-h"
            >
              {cmp ? (
                <IncomeTrend
                  years={cmp.years}
                  income={{ a: cmp.advice.income, b: cmp.base.income }}
                  yields={{ a: cmp.advice.yield, b: cmp.base.yield }}
                  aLabel={`${keeps ? "Your plan, our advice" : "Our advice"} · ${optionName(next, cmp.advice.option)}`}
                  bLabel={bTitle}
                  csvName={`field-rewind-${farm.fips}-${farm.plan}-by-weather-year`}
                />
              ) : (
                <>
                  <h2 id="crm-inc-h">Income summary</h2>
                  <Missing what="income by season for this county" />
                </>
              )}
            </section>

            <section className="crm-card crm-in" style={d(80)} aria-labelledby="crm-tw-h">
              <h2 id="crm-tw-h">Twin counties that did it</h2>
              {!twins ? (
                <p role="status" className="crm-sub">
                  Loading…
                </p>
              ) : twins.length === 0 ? (
                <Missing what="twin counties for this option" />
              ) : (
                <ul className="crm-leads">
                  {twins.map((t, i) => (
                    <li key={t.fips} className="crm-in" style={d(250 + i * 40)}>
                      <a href={`#/county/${t.fips}`} className="crm-lead">
                        <span className="crm-lead-main">
                          <b>
                            {t.name} County, {t.state}
                          </b>
                          <span>
                            {t.pct != null ? `${pct1(t.pct)} ${t.pctLabel}` : "Missing data"}
                          </span>
                          {t.monthsAgo != null ? (
                            <span className="crm-lead-time">
                              {t.pctYear ? `${t.pctYear} crop map · ` : ""}
                              {t.monthsAgo} mo ago
                            </span>
                          ) : null}
                        </span>
                        <span className="crm-lead-g">
                          {t.change != null ? (
                            <b className={t.change >= 0 ? "crm-up" : "crm-down"}>
                              {t.change >= 0 ? "▲" : "▼"} {Math.abs(t.change).toFixed(1)}%
                            </b>
                          ) : (
                            <b className="crm-muted">—</b>
                          )}
                          <span>
                            {t.latest != null ? `${Math.round(t.latest)} bu/ac` : "Missing data"}
                            {t.year ? ` · ${t.year}` : ""}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* ------------------------------------------------ quién ya lo hace + rinde */}
          <div className="crm-row crm-row--b crm-reveal" data-base="450">
            <section className="crm-card crm-in" style={d(0)} aria-labelledby="crm-ad-h">
              <div className="crm-head">
                <h2 id="crm-ad-h">Who already does it</h2>
                {adopt ? <span className="crm-head-src">USDA CDL {adopt.year}</span> : null}
              </div>
              {!adopt ? (
                <Missing what="USDA crop maps for this county" />
              ) : (
                <>
                  <p className="crm-adopt">
                    <b>{adoptPct != null ? `${Math.round(adoptPct)}%` : "—"}</b>
                    <span>
                      of {countyName} cropland {step && advice ? `planted ${advice.label.toLowerCase()}` : "rotated crops"}{" "}
                      in {adopt.year}
                    </span>
                  </p>
                  <ShareBars rows={shareRows} />
                </>
              )}
            </section>

            <section className="crm-card crm-in" style={d(70)} aria-labelledby="crm-y-h">
              <div className="crm-head">
                <h2 id="crm-y-h">{crop} yield here</h2>
                {lowYear.length ? (
                  <span className="crm-chip crm-chip--red">{lowYear.join(", ")} below usual</span>
                ) : null}
              </div>
              <p className="crm-sub">
                {countyName}, bushels per acre (USDA NASS).
                {usual != null ? " Dashed line: the 2015–19 average." : ""}
              </p>
              {yieldPts.some((p) => p.value != null) ? (
                <YieldBars points={yieldPts} usual={usual} />
              ) : (
                <Missing what="county yield" />
              )}
              <p className="crm-src">
                Red: more than 10% below the usual year our model expects here. Outlined: the latest harvest.
              </p>
            </section>
          </div>

          <footer className="crm-foot">
            <span>Sources: NASA POWER · NASA IMERG · USDA NASS · USDA Cropland Data Layer · USDA ERS · SSURGO</span>
            <span>County figures, not field results</span>
          </footer>
        </>
      )}
    </div>
  );
}
