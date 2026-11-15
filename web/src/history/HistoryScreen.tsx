import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { replaceQuery } from "../app/router";
import { loadCounty } from "../data/load";
import type { County, CountyYear } from "../data/types";
import type { CropId } from "../ui/crops";
import { CROPS, CROP_COLOR, CROP_LABEL } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import { BarRace } from "./BarRace";
import { CdlMap } from "./CdlMap";
import { CountyTwins } from "./CountyTwins";
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
  const [guideOpen, setGuideOpen] = useState(false);
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

  const guide = (
    <div className={guideOpen ? "guide guide--open" : "guide"}>
      <button type="button" className="guide__btn" aria-expanded={guideOpen} onClick={() => setGuideOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1.2" fill="currentColor" />
        </svg>
        How to read
      </button>
      {guideOpen ? (
        <div className="guide__panel">
          <ul>
            <li>
              <b>Each square is 30 meters of land</b>, colored by the crop the USDA satellite map found there that year.
            </li>
            <li>
              <b>Numbers are for the whole county</b>, not for a single field.
            </li>
            <li>
              <b>The map is right about 9 times in 10</b> for corn and soybeans, and less often for minor crops.
            </li>
          </ul>
          <p>Scroll or double-click to zoom in. Point at a year to peek at it. Press space to play.</p>
        </div>
      ) : null}
    </div>
  );
  const switcher = DEMO.some((d) => d.fips === county.fips)
    ? DEMO
    : [{ fips: county.fips, label: `${county.name}, ${county.state}` }, ...DEMO];
  const maxSeq = Math.max(1, ...(county.common_rotations?.items.map((t) => t.pct) ?? []));

  return (
    <main className="history">
      <p className="history__eyebrow">
        <a href={`#/map/${county.fips}`}>← Map</a>
        <span aria-hidden="true"> · </span>
        <a href={`#/state/${county.state}`}>{county.state_name}</a>
        <span aria-hidden="true"> › </span>
        <label className="history__switch">
          <span className="visually-hidden">County</span>
          <select value={county.fips} onChange={(e) => (window.location.hash = `#/county/${e.target.value}`)}>
            {switcher.map((d) => (
              <option key={d.fips} value={d.fips}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </p>

      <div className="history__stage">
        <BarRace
          years={county.years}
          current={current}
          highlight={lit}
          onHighlight={setHighlight}
          pinned={pinned}
          onPin={(c) => setPinned((p) => (p === c ? null : c))}
          source={county.raster?.source ?? "USDA CDL"}
        />

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
              overlay={guide}
            />
          ) : (
            <Missing what="the crop map (USDA CDL) is not loaded for this county" />
          )}
        </div>

        <div className="history__story">
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
          <YearFacts county={county} y={current} />
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
        <h2 id="more-title">
          {years.length} years in {county.name} County
        </h2>
        <div className="history__cards">
          <div className="card">
            <h3>
              Most common sequences, {years[1] ?? years[0]}–{years[years.length - 1]}
            </h3>
            {county.common_rotations ? (
              <>
                <ol className="rotations">
                  {county.common_rotations.items.map((t) => (
                    <li key={`${t.from}-${t.to}`}>
                      <span>{t.label}</span>
                      <span className="rotations__track" aria-hidden="true">
                        <span className="rotations__bar" style={{ width: `${(100 * t.pct) / maxSeq}%` }}>
                          <i style={{ background: CROP_COLOR[t.from] }} />
                          <i style={{ background: CROP_COLOR[t.to] }} />
                        </span>
                      </span>
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
          <div className="card">
            <h3>Crop mix, year by year</h3>
            <DecadeMix years={county.years} year={year} lit={lit} onYear={pickYear} />
            <p className="history__small">
              Share of the county's cropland each year. Tap a year to rewind to it.{" "}
              <SourceChip source={county.raster?.source ?? "USDA CDL"} />
            </p>
          </div>
        </div>
        <CountyTwins fips={county.fips} name={county.name} />
        {/* En pantallas angostas el botón sale de la barra fija, que si no tapa media pantalla. */}
        <a className="btn btn--primary history__next history__next--end" href={`#/county/${county.fips}/next`}>
          Options for next season →
        </a>
      </section>
    </main>
  );
}

/** Mezcla de cultivos de todos los años, lado a lado: una columna apilada por año. */
function DecadeMix({
  years,
  year,
  lit,
  onYear,
}: {
  years: CountyYear[];
  year: number;
  lit: CropId | null;
  onYear: (y: number) => void;
}) {
  const shown = CROPS.filter((c) => years.some((y) => (y.crops_pct?.[c] ?? 0) >= 2));
  if (!years.some((y) => y.crops_pct)) return <Missing what="crop areas for this county" />;
  return (
    <>
      <div className="mix">
        {years.map((y) => {
          const pct = y.crops_pct;
          const top = pct ? [...shown].sort((a, b) => pct[b] - pct[a]).slice(0, 3) : [];
          return (
            <button
              key={y.year}
              type="button"
              className={y.year === year ? "mix__col mix__col--on" : "mix__col"}
              aria-pressed={y.year === year}
              aria-label={
                pct
                  ? `${y.year}: ${top.map((c) => `${CROP_LABEL[c]} ${Math.round(pct[c])}%`).join(", ")}`
                  : `${y.year}: missing data`
              }
              title={pct ? top.map((c) => `${CROP_LABEL[c]} ${Math.round(pct[c])}%`).join(" · ") : "Missing data"}
              onClick={() => onYear(y.year)}
            >
              <span className="mix__stack" aria-hidden="true">
                {pct ? (
                  shown
                    .filter((c) => pct[c] >= 1)
                    .map((c) => (
                      <i
                        key={c}
                        style={{ flexGrow: pct[c], background: CROP_COLOR[c], opacity: lit && lit !== c ? 0.25 : 1 }}
                      />
                    ))
                ) : (
                  <em>Missing data</em>
                )}
              </span>
              <span className="mix__year">
                <span className="mix__century">{String(y.year).slice(0, 2)}</span>
                {String(y.year).slice(2)}
              </span>
            </button>
          );
        })}
      </div>
      <ul className="mix__legend">
        {shown.map((c) => (
          <li key={c}>
            <i style={{ background: CROP_COLOR[c] }} />
            {CROP_LABEL[c]}
          </li>
        ))}
      </ul>
    </>
  );
}
