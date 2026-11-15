import { useEffect, useRef } from "react";
import type { Playback } from "./usePlayback";

interface Props {
  years: number[];
  pb: Playback;
  /** Año exacto que se está mostrando. */
  index: number;
  playing: boolean;
  /** Carga de los mapas: el reproductor queda deshabilitado hasta que estén todos. */
  loaded: number;
  total: number;
  /** Años con una marca de clima (por ejemplo "Hot July"). */
  marks: Record<number, string[]>;
}

/**
 * Controles de video de la historia (F15): play/pausa y una barra de progreso que se arrastra, con una
 * marca por año. La barra y el cursor se mueven en cada cuadro con el reloj (`pb`), sin pasar por React.
 * Teclado: flechas = año anterior/siguiente, Inicio/Fin = primer/último año. Espacio lo maneja la pantalla.
 */
export function Player({ years, pb, index, playing, loaded, total, marks }: Props) {
  const rail = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  const ready = loaded >= total;
  const n = years.length;
  const year = years[index];

  // La parte dorada y el cursor siguen la posición del reloj, cuadro a cuadro.
  useEffect(() => {
    if (!ready) return;
    const last = Math.max(1, n - 1);
    return pb.subscribe((pos) => {
      const frac = pos / last;
      if (fill.current) fill.current.style.transform = `scaleX(${frac})`;
      if (thumb.current) thumb.current.style.left = `${frac * 100}%`;
    });
  }, [pb, n, ready]);

  const seekTo = (clientX: number) => {
    const box = rail.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    pb.seek(((clientX - box.left) / box.width) * (n - 1));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown" || e.key === "PageDown") pb.step(-1);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "PageUp") pb.step(1);
    else if (e.key === "Home") pb.goTo(0);
    else if (e.key === "End") pb.goTo(n - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="player">
      <button
        type="button"
        className="player__play"
        onClick={() => pb.toggle()}
        disabled={!ready || n < 2}
        aria-label={playing ? "Pause" : `Play the years from ${years[0]} to ${years[n - 1]}`}
        title={playing ? "Pause" : "Play"}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          {playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" /> : <path d="M8 4.5v15l12-7.5z" fill="currentColor" />}
        </svg>
      </button>

      {ready ? (
        <div
          className="player__track"
          role="slider"
          tabIndex={0}
          aria-label="Year"
          aria-valuemin={years[0]}
          aria-valuemax={years[n - 1]}
          aria-valuenow={year}
          aria-valuetext={marks[year]?.length ? `${year}, ${marks[year].join(", ")}` : String(year)}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            dragging.current = true;
            seekTo(e.clientX);
          }}
          onPointerMove={(e) => dragging.current && seekTo(e.clientX)}
          onPointerUp={() => {
            if (!dragging.current) return;
            dragging.current = false;
            pb.release();
          }}
          onPointerCancel={() => {
            if (!dragging.current) return;
            dragging.current = false;
            pb.release();
          }}
        >
          <span className="player__rail" ref={rail}>
            <span className="player__fill" ref={fill} />
            {years.map((y, i) => {
              const mark = marks[y]?.[0];
              return (
                <span
                  key={y}
                  className={[
                    "player__tick",
                    i === index ? "player__tick--on" : "",
                    mark ? "player__tick--mark" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ left: `${n > 1 ? (i / (n - 1)) * 100 : 0}%` }}
                  title={mark ? `${y}: ${mark}` : undefined}
                >
                  <i aria-hidden="true" />
                  <span className="player__label">{y}</span>
                </span>
              );
            })}
            <span className="player__thumb" ref={thumb} aria-hidden="true" />
          </span>
        </div>
      ) : null}
      {ready ? (
        <span className="player__year" aria-hidden="true">
          {year}
        </span>
      ) : (
        <div className="player__loading" role="status">
          <span>
            Loading {loaded}/{total} years
          </span>
          <span className="player__progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${total ? loaded / total : 0})` }} />
          </span>
        </div>
      )}
    </div>
  );
}
