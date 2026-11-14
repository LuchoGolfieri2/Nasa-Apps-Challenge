import { useState } from "react";
import type { CountyYear } from "../data/types";
import { CROPS, CROP_COLOR, CROP_LABEL } from "../ui/crops";

interface Props {
  years: number[];
  year: number;
  playing: boolean;
  /** Carga de los mapas: ▶ queda deshabilitado hasta que estén todos. */
  loaded: number;
  total: number;
  /** Años con una marca de clima (por ejemplo "Dry July"). */
  marks: Record<number, string[]>;
  onYear: (year: number) => void;
  onPlay: () => void;
  onRewind: () => void;
  /** Datos de cada año: dibujan la mezcla de cultivos de la columna y el cuadro al pasar el cursor. */
  data: CountyYear[];
  /** Duración de un año durante el play, para que la barra avance sin saltos. */
  stepMs: number;
}

const pctFmt = (v: number) => `${Math.round(v)}%`;

/** Cuadro translúcido con el resumen de un año. Aparece al pasar el cursor o al enfocar con el teclado. */
function YearPeek({ y, left }: { y: CountyYear; left: number }) {
  const top = y.crops_pct
    ? CROPS.map((c) => ({ c, v: y.crops_pct![c] ?? 0 }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 3)
    : [];
  const yields = y.yield ? Object.entries(y.yield.crops) : [];
  return (
    <div className="peek" style={{ left: `clamp(160px, ${left}%, calc(100% - 160px))` }} aria-hidden="true">
      <div className="peek__head">
        <span className="peek__year">{y.year}</span>
        {y.weather?.tags.map((t) => (
          <span key={t} className="peek__tag">
            {t}
          </span>
        ))}
      </div>
      {y.headline[0] ? <p className="peek__line">{y.headline[0].text}</p> : null}
      {top.length ? (
        <ul className="peek__crops">
          {top.map(({ c, v }) => (
            <li key={c}>
              <span>{CROP_LABEL[c]}</span>
              <span className="peek__track">
                <i style={{ width: `${v}%`, background: CROP_COLOR[c] }} />
              </span>
              <b>{pctFmt(v)}</b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="peek__small">Missing data: crop areas</p>
      )}
      <p className="peek__small">
        {yields.length
          ? yields.map(([c, v]) => `${CROP_LABEL[c as "corn"]} ${v!.bu_ac} bu/ac`).join(", ")
          : "Missing data: yield"}
        {y.weather ? `. Season rain ${y.weather.season_rain_in} in` : ". Missing data: weather"}
      </p>
    </div>
  );
}

/** Línea de tiempo con ⏪ y ▶ (F15). Flechas izquierda y derecha cambian de año. */
export function Timeline({ years, year, playing, loaded, total, marks, onYear, onPlay, onRewind, data, stepMs }: Props) {
  const [peek, setPeek] = useState<number | null>(null);
  const ready = loaded >= total;
  const idx = years.indexOf(year);
  const n = years.length;
  const center = (i: number) => ((i + 0.5) / n) * 100;
  // Durante el play la barra avanza de corrido hacia el año siguiente, en lo que dura el paso.
  const moving = playing && idx < n - 1;
  const peeked = peek === null ? null : (data.find((d) => d.year === peek) ?? null);

  const onKey = (e: React.KeyboardEvent) => {
    let next = idx;
    if (e.key === "ArrowLeft") next = Math.max(0, idx - 1);
    else if (e.key === "ArrowRight") next = Math.min(years.length - 1, idx + 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = years.length - 1;
    else return;
    e.preventDefault();
    onYear(years[next]);
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
    buttons[next]?.focus();
  };

  return (
    <div className="timeline">
      <div className="timeline__controls">
        <button
          type="button"
          className="timeline__btn"
          onClick={onRewind}
          disabled={!ready}
          aria-label={`Rewind: play again from ${years[0]}`}
          title={`Play again from ${years[0]}`}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M11 6v12L2.5 12zM21.5 6v12L13 12z" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          className="timeline__btn timeline__btn--play"
          onClick={onPlay}
          disabled={!ready}
          aria-label={playing ? "Pause" : "Play the years"}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            {playing ? (
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" />
            ) : (
              <path d="M7 4.5v15l13-7.5z" fill="currentColor" />
            )}
          </svg>
        </button>
      </div>

      {ready ? (
        <div className="timeline__years" role="group" aria-label="Year" onKeyDown={onKey}>
          <span className="timeline__rail" aria-hidden="true">
            <span
              className={playing ? "timeline__fill timeline__fill--playing" : "timeline__fill"}
              style={{
                width: `${center(moving ? idx + 1 : idx)}%`,
                transition: moving ? `width ${stepMs}ms linear` : undefined,
              }}
            />
          </span>
          {years.map((y, i) => {
            const mix = data[i]?.crops_pct;
            return (
              <button
                key={y}
                type="button"
                className={
                  y === year ? "timeline__year timeline__year--on" : i < idx ? "timeline__year timeline__year--past" : "timeline__year"
                }
                style={{ "--i": i } as React.CSSProperties}
                aria-pressed={y === year}
                tabIndex={y === year ? 0 : -1}
                onClick={() => onYear(y)}
                onPointerEnter={(e) => e.pointerType !== "touch" && setPeek(y)}
                onPointerLeave={() => setPeek(null)}
                onFocus={(e) => e.currentTarget.matches(":focus-visible") && setPeek(y)}
                onBlur={() => setPeek(null)}
              >
                {marks[y]?.length ? <span className="timeline__mark">{marks[y][0]}</span> : null}
                <span className="timeline__mix" aria-hidden="true">
                  {mix
                    ? CROPS.filter((c) => (mix[c] ?? 0) >= 1.5).map((c) => (
                        <i key={c} style={{ flexGrow: mix[c], background: CROP_COLOR[c] }} />
                      ))
                    : null}
                </span>
                <span className="timeline__label">{y}</span>
              </button>
            );
          })}
          {peeked ? <YearPeek y={peeked} left={center(years.indexOf(peeked.year))} /> : null}
        </div>
      ) : (
        <div className="timeline__loading" role="status">
          <span>
            Loading {loaded}/{total} years
          </span>
          <span className="timeline__progress" aria-hidden="true">
            <span style={{ width: `${total ? (100 * loaded) / total : 0}%` }} />
          </span>
        </div>
      )}
    </div>
  );
}
