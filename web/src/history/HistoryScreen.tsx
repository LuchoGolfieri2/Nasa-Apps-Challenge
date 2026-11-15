import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { replaceQuery } from "../app/router";
import { loadCounty } from "../data/load";
import type { County } from "../data/types";
import type { CropId } from "../ui/crops";
import { CROP_COLOR } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import { BarRace } from "./BarRace";
import { CdlMap } from "./CdlMap";
import { Timeline } from "./Timeline";
import { useRasters } from "./useRasters";
import { YearFacts } from "./YearFacts";
import "./history.css";

/** Segundos por año en el play automático. Se puede cambiar con ?speed=0.8 (tomas del video). */
const DEFAULT_STEP_S = 0.8; // 11 años ≈ 9 s (antes 1,6)

const DEMO = [
  { fips: "19169", label: "Story, IA" },
  { fips: "20191", label: "Sumner, KS" },
  { fips: "17113", label: "McLean, IL" },
];

export function HistoryScreen({ fips, query }: { fips: string; query: URLSearchParams }) {
  const [county, setCounty] = useState<County | null>(null);
  const [failed, setFailed] = useState(false);
  const [year, setYear] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [highlight, setHighlight] = useState<CropId | null>(null);
  const [pinned, setPinned] = useState<CropId | null>(null);
  const togglePlay = useRef<() => void>(() => {});
  const autoplay = useRef(query.get("play") === "1");
  const stepMs = useMemo(() => {
    const s = Number(query.get("speed"));
    return (s >= 0.2 && s <= 10 ? s : DEFAULT_STEP_S) * 1000;
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    loadCounty(fips)
      .then((c) => {
        if (cancelled) return;
        setCounty(c);
        const all = c.years.map((y) => y.year);
        const asked = Number(query.get("year"));
        // Con ?play=1 arranca en el primer año; si no, en el último (o el de la URL).
        setYear(all.includes(asked) ? asked : autoplay.current ? all[0] : all[all.length - 1]);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // Solo al cambiar de condado: el año después lo maneja el estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fips]);

  const rasters = useRasters(county?.raster ?? null);
  const years = useMemo(() => county?.years.map((y) => y.year) ?? [], [county]);
  const canPlay = county ? !county.raster || rasters.ready : false;

  const goTo = useCallback((y: number) => {
    setYear(y);
    replaceQuery("year", String(y));
  }, []);

  // Play automático pedido por la URL: arranca cuando terminaron de cargar los mapas.
  useEffect(() => {
    if (autoplay.current && canPlay) {
      autoplay.current = false;
      setPlaying(true);
    }
  }, [canPlay]);

  // Avanza un año por paso y se detiene en el último.
  useEffect(() => {
    if (!playing || year === null) return;
    const i = years.indexOf(year);
    if (i >= years.length - 1) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => goTo(years[i + 1]), stepMs);
    return () => window.clearTimeout(t);
  }, [playing, year, years, stepMs, goTo]);

  // Barra espaciadora: play o pausa, salvo que el foco esté en un control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || (e.target as HTMLElement).closest("button, a, input, summary, [role=slider]")) return;
      e.preventDefault();
      togglePlay.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (failed) {
    return (
      <main className="history history--empty">
        <h1>No history for this county yet</h1>
        <Missing what={`Field Rewind has no data file for county ${fips}. It works in Iowa, Illinois and Kansas.`} />
        <p>
          <a className="btn btn--primary" href="#/county/19169">
            Rewind Story County, IA
          </a>
        </p>
      </main>
    );
  }
  if (!county || year === null) {
    return (
      <main className="history history--empty" role="status">
        Loading the county…
      </main>
    );
  }

  const current = county.years.find((y) => y.year === year)!;
  const prevYear = years[years.indexOf(year) - 1] ?? null;
  const marks = Object.fromEntries(county.years.filter((y) => y.weather?.tags.length).map((y) => [y.year, y.weather!.tags]));

  const play = () => {
    if (playing) return setPlaying(false);
    if (year === years[years.length - 1]) goTo(years[0]);
    setPlaying(true);
  };
  togglePlay.current = canPlay ? play : () => {};
  const lit = highlight ?? pinned;
  const rewind = () => {
    goTo(years[0]);
    setPlaying(true);
  };
  const pickYear = (y: number) => {
    setPlaying(false);
    goTo(y);
  };

  return (
    <main className="history">
      <div className="history__stage">
        <div className="history__story">
          <p className="history__eyebrow">
            <a href={`#/map/${county.fips}`}>← Map</a>
            <span aria-hidden="true"> · </span>
            <a href={`#/state/${county.state}`}>{county.state_name}</a>
            <span aria-hidden="true"> › </span>
            {county.name} County
          </p>

          {/* aria-live apagado durante el play para no leer once titulares seguidos */}
          <div className="headline" aria-live={playing ? "off" : "polite"}>
            <h1>
              <span className="headline__year">{current.year}</span>
              <span className="visually-hidden"> in {county.name} County: </span>
            </h1>
            <ul>
              {current.headline.map((h) => (
                <li key={h.text}>
                  {h.text} <span className="headline__src">({h.source})</span>
                </li>
              ))}
            </ul>
          </div>

          <BarRace
            years={county.years}
            current={current}
            highlight={lit}
            onHighlight={setHighlight}
            pinned={pinned}
            onPin={(c) => setPinned((p) => (p === c ? null : c))}
            source={county.raster?.source ?? "USDA CDL"}
          />

          <YearFacts county={county} y={current} />
        </div>

        <div className="history__map">
          {county.raster ? (
            <CdlMap
              info={county.raster}
              year={year}
              classes={rasters.get(year)}
              status={rasters.status[year]}
              highlight={lit}
              countyName={county.name}
              prevYear={prevYear}
              prevClasses={prevYear === null ? null : rasters.get(prevYear)}
            />
          ) : (
            <Missing what="the crop map (USDA CDL) is not loaded for this county" />
          )}
          <details className="guide" open>
            <summary>How to read this</summary>
            <ul>
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4z" fill="currentColor" opacity=".45" />
                  <path d="M13 13h7v7h-7z" fill="currentColor" />
                </svg>
                <span>
                  <b>Each square is 30 meters of land</b>, colored by the crop the USDA satellite map found there that year.
                </span>
              </li>
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6l10-2 6 4-1 11-12 1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                <span>
                  <b>Numbers are for the whole county</b>, not for a single field.
                </span>
              </li>
              <li>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 13l5 5L20 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <b>The map is right about 9 times in 10</b> for corn and soybeans, and less often for minor crops.
                </span>
              </li>
            </ul>
            <p>Scroll or double-click the map to zoom in. Point at a year below to peek at it. Press space to play.</p>
          </details>
        </div>
      </div>

      <div className="history__bar">
        <Timeline
          years={years}
          year={year}
          playing={playing}
          loaded={county.raster ? rasters.settled : 1}
          total={county.raster ? rasters.total : 1}
          marks={marks}
          data={county.years}
          stepMs={stepMs}
          onYear={pickYear}
          onPlay={play}
          onRewind={rewind}
        />
        <a className="btn btn--primary history__next" href={`#/county/${county.fips}/next`}>
          Options for next season →
        </a>
      </div>

      <section className="history__more" aria-labelledby="more-title">
        <div>
          <h2 id="more-title">
            Most common sequences, {years[1] ?? years[0]}–{years[years.length - 1]}
          </h2>
          {county.common_rotations ? (
            <>
              <ol className="rotations">
                {county.common_rotations.items.map((t) => (
                  <li key={`${t.from}-${t.to}`}>
                    <span className="rotations__swatches" aria-hidden="true">
                      <i style={{ background: CROP_COLOR[t.from] }} />
                      <i style={{ background: CROP_COLOR[t.to] }} />
                    </span>
                    <span>{t.label}</span>
                    <b>{Math.round(t.pct)}%</b>
                  </li>
                ))}
              </ol>
              <p className="history__small">
                Share of cropland that went from the first crop one year to the second crop the next.{" "}
                <SourceChip source={county.common_rotations.source} />
              </p>
            </>
          ) : (
            <Missing what="crop sequences for this county" />
          )}
        </div>
        <div>
          <h2>See another county</h2>
          <p className="history__small">
            Counties with a full history:{" "}
            {DEMO.filter((d) => d.fips !== county.fips).map((d, i) => (
              <span key={d.fips}>
                {i ? " · " : ""}
                <a href={`#/county/${d.fips}`}>{d.label}</a>
              </span>
            ))}
          </p>
        </div>
      </section>
    </main>
  );
}
