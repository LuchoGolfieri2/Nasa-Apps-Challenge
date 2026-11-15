import { useEffect, useMemo, useRef, useState } from "react";
import { dataUrl } from "../data/load";
import { STATE_PATHS, projectTwinMap } from "../next/twinMapShapes";
import type { NextData, Twin } from "../next/types";
import { Missing, PrototypeStamp } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";

/**
 * "Counties like yours": imagen fija de esa parte del globo (NASA Blue Marble) con arcos del condado
 * a sus condados parecidos, y debajo en qué se parece cada uno. Usa los mismos datos reales que
 * "Next season" (data/next/<fips>.json). Antes vivía en el mapa, con datos de prueba.
 */

/** La imagen y los contornos comparten la proyección de twinMapShapes (420 × 225). */
const MAP_W = 420;
const MAP_H = 225;
const LABEL_FONT = '600 13px "DM Sans", system-ui, sans-serif';

type Box = [number, number, number, number];
type Label = { x: number; y: number; anchor: "start" | "end" };
type Dot = { twin: Twin; x: number; y: number; arc: string; label: Label | null };
type State = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; data: NextData; origin: [number, number] };

const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
/** "a", "a and b", "a, b and c" */
const joinList = (items: string[]) =>
  items.length < 2 ? items.join("") : items.slice(0, -1).join(", ") + " and " + items[items.length - 1];

let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string): number {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * 7;
  measureCtx.font = LABEL_FONT;
  return measureCtx.measureText(text).width;
}

/** Caja de un rótulo de 13 px a la derecha (o a la izquierda) de un punto. */
function labelBox(x: number, y: number, width: number, gap: number, anchor: "start" | "end"): Box {
  return anchor === "start" ? [x + gap, y - 9, x + gap + width, y + 9] : [x - gap - width, y - 9, x - gap, y + 9];
}

/**
 * Posiciones en píxeles del mapa a `width` de ancho. Los nombres tienen tamaño fijo, así que con muchos
 * condados juntos no entran todos: se ubican de a uno donde no pisan nada (el resaltado va primero) y
 * el resto queda solo en la lista.
 */
function layout(origin: [number, number], name: string, twins: Twin[], width: number, hot: string | null) {
  const s = width / MAP_W;
  const at = (c: [number, number]): [number, number] => {
    const [x, y] = projectTwinMap(c[0], c[1]);
    return [x * s, y * s];
  };
  const [ox, oy] = at(origin);
  const points = twins.map((twin) => ({ twin, p: at(twin.centroid) }));

  const taken: Box[] = [[ox - 12, oy - 12, ox + 12, oy + 12]];
  const nameWidth = textWidth(name) + 8; // el nombre del condado va en negrita
  const originAnchor: "start" | "end" = ox + 16 + nameWidth > width ? "end" : "start";
  const originLabel: Label = { x: originAnchor === "start" ? ox + 16 : ox - 16, y: oy, anchor: originAnchor };
  taken.push(labelBox(ox, oy, nameWidth, 16, originAnchor));
  const dotBox = (p: [number, number]): Box => [p[0] - 6, p[1] - 6, p[0] + 6, p[1] + 6];

  const labels = new Map<string, Label>();
  const order = [...points].sort((a, b) => Number(b.twin.fips === hot) - Number(a.twin.fips === hot));
  for (const { twin, p } of order) {
    const w = textWidth(twin.name);
    for (const anchor of ["start", "end"] as const) {
      const box = labelBox(p[0], p[1], w, 9, anchor);
      const fits = box[0] >= 4 && box[2] <= width - 4;
      const free =
        !taken.some((t) => overlaps(box, t)) &&
        !points.some((o) => o.twin !== twin && overlaps(box, dotBox(o.p)));
      if (fits && (free || twin.fips === hot)) {
        labels.set(twin.fips, { x: anchor === "start" ? p[0] + 9 : p[0] - 9, y: p[1], anchor });
        taken.push(box);
        break;
      }
    }
  }

  const dots: Dot[] = points.map(({ twin, p }) => {
    const dist = Math.hypot(p[0] - ox, p[1] - oy);
    // arco levantado: el punto de control queda por encima de la línea recta
    const cx = (ox + p[0]) / 2;
    const cy = (oy + p[1]) / 2 - Math.max(18 * s, dist * 0.32);
    const arc = `M${ox.toFixed(1)},${oy.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    return { twin, x: p[0], y: p[1], arc, label: labels.get(twin.fips) ?? null };
  });
  return { s, ox, oy, originLabel, dots };
}

export function CountyTwins({ fips, name }: { fips: string; name: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [hot, setHot] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const figure = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    setHot(null);
    fetch(dataUrl(`data/next/${fips}.json`))
      .then((res) => {
        if (!res.ok) throw new Error(`No next-season file for ${fips} (${res.status})`);
        return res.json() as Promise<NextData>;
      })
      .then((data) => {
        if (cancelled) return;
        // sin centroide o sin condados parecidos no hay nada que dibujar: se dice, no se inventa
        if (data.centroid && data.twins?.length) setState({ kind: "ready", data, origin: data.centroid });
        else setState({ kind: "missing" });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [fips]);

  const ready = state.kind === "ready";
  useEffect(() => {
    const el = figure.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  const map = useMemo(
    () => (state.kind === "ready" && width > 0 ? layout(state.origin, name, state.data.twins, width, hot) : null),
    [state, name, width, hot],
  );

  if (state.kind === "missing") {
    return (
      <div className="card twins">
        <h3>Counties like yours</h3>
        <Missing what="similar counties for this county (covered in Iowa and Illinois so far)" />
      </div>
    );
  }

  const twins = state.kind === "ready" ? state.data.twins : [];
  const sources = [...new Set(twins.map((t) => t.source))];

  return (
    <div className="card twins" aria-busy={state.kind === "loading"}>
      <h3>
        Counties like yours {twins.some((t) => t.prototype) ? <PrototypeStamp /> : null}
      </h3>
      {ready ? (
        <p className="twins__intro">
          {twins.length} {twins.length === 1 ? "county" : "counties"} with soil and weather close to {name} County's.
          Similar soil and weather doesn't guarantee the same result.
        </p>
      ) : null}
      <div className="twins__body">
        <figure className="twins__map" ref={figure}>
          <img src={dataUrl("img/bluemarble-cornbelt.jpg")} alt="" width={1680} height={900} loading="lazy" />
          {map ? (
            <svg
              width={width}
              height={(width * MAP_H) / MAP_W}
              role="img"
              aria-label={`Map with arcs from ${name} County to its ${twins.length} similar counties, listed below`}
            >
              <g transform={`scale(${map.s})`}>
                {Object.entries(STATE_PATHS).map(([id, d]) => (
                  <path key={id} d={d} className="twins__state" vectorEffect="non-scaling-stroke" />
                ))}
              </g>
              {map.dots.map((d) => (
                <path key={d.twin.fips} d={d.arc} className={d.twin.fips === hot ? "twins__arc is-hot" : "twins__arc"} />
              ))}
              {map.dots.map((d) => (
                <g
                  key={d.twin.fips}
                  className={d.twin.fips === hot ? "twins__dot is-hot" : "twins__dot"}
                  onMouseEnter={() => setHot(d.twin.fips)}
                  onMouseLeave={() => setHot(null)}
                >
                  <circle cx={d.x} cy={d.y} r={12} fill="transparent" />
                  <circle cx={d.x} cy={d.y} r={d.twin.fips === hot ? 6 : 4} />
                </g>
              ))}
              <circle className="twins__origin-ring" cx={map.ox} cy={map.oy} r={10} />
              <circle className="twins__origin" cx={map.ox} cy={map.oy} r={5} />
              {map.dots.map((d) =>
                d.label ? (
                  <text
                    key={d.twin.fips}
                    className={d.twin.fips === hot ? "twins__label is-hot" : "twins__label"}
                    x={d.label.x}
                    y={d.label.y}
                    textAnchor={d.label.anchor}
                    dominantBaseline="central"
                  >
                    {d.twin.name}
                  </text>
                ) : null,
              )}
              <text
                className="twins__label twins__label--origin"
                x={map.originLabel.x}
                y={map.originLabel.y}
                textAnchor={map.originLabel.anchor}
                dominantBaseline="central"
              >
                {name}
              </text>
            </svg>
          ) : null}
        </figure>
        {ready ? (
          <div className="twins__side">
            <p className="twins__caption">What each county is most similar on</p>
            <ul className="twins__list">
              {twins.map((t) => (
                <li
                  key={t.fips}
                  className={t.fips === hot ? "is-hot" : undefined}
                  onMouseEnter={() => setHot(t.fips)}
                  onMouseLeave={() => setHot(null)}
                >
                  <b>
                    {t.name}, {t.state}
                  </b>
                  <span>{t.similar_on.length ? joinList(t.similar_on) : "Missing data"}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {ready ? (
        <p className="history__small twins__sources">
          {sources.map((source) => (
            <SourceChip key={source} source={source} />
          ))}
          <SourceChip source="NASA Blue Marble · GIBS imagery" />
        </p>
      ) : null}
    </div>
  );
}
