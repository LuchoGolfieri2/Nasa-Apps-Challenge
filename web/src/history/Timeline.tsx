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
}

/** Línea de tiempo con ⏪ y ▶ (F15). Flechas izquierda y derecha cambian de año. */
export function Timeline({ years, year, playing, loaded, total, marks, onYear, onPlay, onRewind }: Props) {
  const ready = loaded >= total;
  const idx = years.indexOf(year);

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
          {years.map((y, i) => (
            <button
              key={y}
              type="button"
              className={
                y === year ? "timeline__year timeline__year--on" : i < idx ? "timeline__year timeline__year--past" : "timeline__year"
              }
              aria-pressed={y === year}
              tabIndex={y === year ? 0 : -1}
              onClick={() => onYear(y)}
              title={marks[y]?.join(", ")}
            >
              <span className="timeline__tick" aria-hidden="true" />
              <span className="timeline__label">{y}</span>
              {marks[y]?.length ? <span className="timeline__mark">{marks[y][0]}</span> : null}
            </button>
          ))}
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
