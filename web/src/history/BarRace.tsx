import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { CountyYear } from "../data/types";
import { CHART_MIN_PCT, CROP_COLOR, CROP_LABEL, CROP_NOTE, splitChartCrops, type CropId } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import type { Playback } from "./usePlayback";

const ROW = 54;
const fmt = new Intl.NumberFormat("en-US");

interface Props {
  years: CountyYear[];
  pb: Playback;
  /** Año exacto que se está mostrando. */
  index: number;
  /** true durante una transición: las cifras que corren no son datos y van atenuadas. */
  between: boolean;
  highlight: CropId | null;
  onHighlight: (crop: CropId | null) => void;
  /** Cultivo que quedó fijo con un clic (sigue resaltado sin el cursor encima). */
  pinned: CropId | null;
  onPin: (crop: CropId) => void;
  source: string;
}

/**
 * Carrera de barras: superficie por cultivo, ordenada de mayor a menor (F18). La escala es fija para todo
 * el período, así el largo de una barra se compara entre años.
 *
 * Va con el mismo reloj que el mapa: entre dos años las barras y las cifras corren de un valor al otro.
 * Esos valores intermedios no son datos (por eso van atenuados y fuera de la lectura de pantalla); la
 * etiqueta accesible de cada fila siempre da el valor del año exacto.
 */
export function BarRace({ years, pb, index, between, highlight, onHighlight, pinned, onPin, source }: Props) {
  // Fila propia para los cultivos que alguna vez pasaron el 2 % de la superficie con cultivo; el resto
  // se suma en "Other crops", así las filas llegan al 100 %.
  const { crops, maxAc, grouped } = useMemo(() => {
    const { main, grouped: rest } = splitChartCrops(years);
    const hasRest = years.some((y) => rest.some((c) => (y.area_by_crop?.[c]?.ac ?? 0) > 0));
    const rows: CropId[] = hasRest ? [...main, "other"] : main;
    const max = Math.max(1, ...years.flatMap((y) => rows.map((c) => (y.area_by_crop ? acOf(y, c, rest) : 0))));
    return { crops: rows, maxAc: max, grouped: rest };
  }, [years]);

  const rows = useRef(new Map<CropId, { li: HTMLLIElement; bar: HTMLElement; value: HTMLElement; pct: HTMLElement }>());
  const shown = useRef(new Map<string, string>());
  const live = useRef({ years, crops, maxAc, grouped });
  live.current = { years, crops, maxAc, grouped };

  /** Escribe en cada fila el valor que corresponde a la posición del reloj. Solo toca lo que cambió. */
  const apply = useRef((pos: number) => {
    const { years: ys, crops: cs, maxAc: max, grouped: g } = live.current;
    const i = Math.min(ys.length - 1, Math.floor(pos));
    const from = ys[i];
    const next = ys[Math.min(ys.length - 1, i + 1)];
    // Las cifras corren entre años también con movimiento reducido (es conteo, no desplazamiento).
    // Si falta el dato de uno de los dos años no se interpola: queda el año de partida.
    const f = !from.area_by_crop || !next.area_by_crop ? 0 : pos - i;
    const a = from.area_by_crop && from.crops_pct ? from : next;
    const b = f > 0 ? next : a;
    if (!a.area_by_crop || !a.crops_pct || !b.area_by_crop || !b.crops_pct) return;
    const set = (key: string, value: string, write: () => void) => {
      if (shown.current.get(key) === value) return;
      shown.current.set(key, value);
      write();
    };
    const ac = cs.map((c) => acOf(a, c, g) + (acOf(b, c, g) - acOf(a, c, g)) * f);
    const order = cs.map((_, k) => k).sort((x, y) => ac[y] - ac[x]);
    cs.forEach((c, k) => {
      const row = rows.current.get(c);
      if (!row) return;
      const pct = pctOf(a, c, g) + (pctOf(b, c, g) - pctOf(a, c, g)) * f;
      set(`${c}|w`, ((100 * ac[k]) / max).toFixed(2), () => (row.bar.style.width = `${(100 * ac[k]) / max}%`));
      set(`${c}|v`, fmt.format(Math.round(ac[k])), () => (row.value.textContent = fmt.format(Math.round(ac[k]))));
      set(`${c}|p`, `${Math.round(pct)}%`, () => (row.pct.textContent = `${Math.round(pct)}%`));
      set(`${c}|y`, String(order.indexOf(k)), () => (row.li.style.transform = `translateY(${order.indexOf(k) * ROW}px)`));
    });
  }).current;

  useEffect(() => pb.subscribe(apply), [pb, apply]);
  // Después de cada render (otro condado, otras filas) se vuelve a escribir todo.
  useLayoutEffect(() => {
    shown.current.clear();
    apply(pb.pos);
  });

  const current = years[index];
  if (!current.area_by_crop || !current.crops_pct) {
    return <Missing what={`crop areas for ${current.year}`} />;
  }
  const area = (c: CropId) => acOf(current, c, grouped);
  const pct = (c: CropId) => pctOf(current, c, grouped);
  const rank = new Map([...crops].sort((a, b) => area(b) - area(a)).map((c, i) => [c, i]));
  const named = grouped.filter((c) => c !== "other").map((c) => CROP_LABEL[c]);
  const groupedNote = `${[...named, "smaller crops"].join(", ")}: each under ${CHART_MIN_PCT}% of cropland.`;

  return (
    <section className={between ? "race race--between" : "race"} aria-labelledby="race-title">
      <div className="race__head">
        <h2 id="race-title">Acres by crop, {current.year}</h2>
        <SourceChip source={source} />
      </div>
      <ol className="race__rows" style={{ height: crops.length * ROW }} onPointerLeave={() => onHighlight(null)}>
        {crops.map((c) => {
          const dim = highlight !== null && highlight !== c;
          return (
            <li
              key={c}
              ref={(li) => {
                if (!li) return void rows.current.delete(c);
                rows.current.set(c, {
                  li,
                  bar: li.querySelector<HTMLElement>(".race__bar")!,
                  value: li.querySelector<HTMLElement>(".race__num")!,
                  pct: li.querySelector<HTMLElement>(".race__pct")!,
                });
              }}
              className={dim ? "race__row race__row--dim" : "race__row"}
              onPointerEnter={() => onHighlight(c)}
            >
              <button
                type="button"
                className="race__hit"
                aria-pressed={pinned === c}
                aria-label={`${rank.get(c)! + 1}. ${CROP_LABEL[c]}: ${fmt.format(area(c))} acres, ${Math.round(pct(c))}% of cropland in ${current.year}. Keep it lit on the map.`}
                title={c === "other" ? groupedNote : CROP_NOTE[c]}
                onClick={() => onPin(c)}
              >
                <span className="race__label">{CROP_LABEL[c]}</span>
                <span className="race__track" aria-hidden="true">
                  <span className="race__bar" style={{ background: CROP_COLOR[c] }} />
                </span>
                <span className="race__value" aria-hidden="true">
                  <span className="race__num" /> <small>ac</small>
                </span>
                <span className="race__pct" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
      <p className="race__note">
        % of the county's cropland.{crops.includes("other") ? ` Other crops adds up every crop under ${CHART_MIN_PCT}%.` : ""} Tap
        a crop to keep it lit on the map; tap it again to show all.
      </p>
    </section>
  );
}

/** Acres de una fila: "other" suma todos los cultivos sin fila propia. */
function acOf(y: CountyYear, c: CropId, grouped: CropId[]): number {
  if (!y.area_by_crop) return 0;
  return c === "other" ? grouped.reduce((t, g) => t + (y.area_by_crop![g]?.ac ?? 0), 0) : y.area_by_crop[c].ac;
}

/** % de la superficie con cultivo de una fila, con la misma regla que acOf. */
function pctOf(y: CountyYear, c: CropId, grouped: CropId[]): number {
  if (!y.crops_pct) return 0;
  return c === "other" ? grouped.reduce((t, g) => t + (y.crops_pct![g] ?? 0), 0) : y.crops_pct[c];
}
