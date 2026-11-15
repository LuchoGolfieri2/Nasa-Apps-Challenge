import { CropIcon } from "../ui/CropIcon";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { CountyYear } from "../data/types";
import { CROPS, CROP_COLOR, CROP_LABEL, CROP_NOTE, type CropId } from "../ui/crops";
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
  // Entran los cultivos que alguna vez pasaron el 2 % de la superficie con cultivo.
  const { crops, maxAc } = useMemo(() => {
    const shown = CROPS.filter((c) => years.some((y) => (y.crops_pct?.[c] ?? 0) >= 2));
    const max = Math.max(1, ...years.flatMap((y) => shown.map((c) => y.area_by_crop?.[c]?.ac ?? 0)));
    return { crops: shown, maxAc: max };
  }, [years]);

  const rows = useRef(new Map<CropId, { li: HTMLLIElement; bar: HTMLElement; value: HTMLElement; pct: HTMLElement }>());
  const shown = useRef(new Map<string, string>());
  const live = useRef({ years, crops, maxAc });
  live.current = { years, crops, maxAc };

  /** Escribe en cada fila el valor que corresponde a la posición del reloj. Solo toca lo que cambió. */
  const apply = useRef((pos: number) => {
    const { years: ys, crops: cs, maxAc: max } = live.current;
    const i = Math.min(ys.length - 1, Math.floor(pos));
    const from = ys[i];
    const next = ys[Math.min(ys.length - 1, i + 1)];
    // Con movimiento reducido, o si falta el dato de uno de los dos años, no se interpola: queda el año de partida.
    const f = pb.reduced || !from.area_by_crop || !next.area_by_crop ? 0 : pos - i;
    const a = from.area_by_crop && from.crops_pct ? from : next;
    const b = f > 0 ? next : a;
    if (!a.area_by_crop || !a.crops_pct || !b.area_by_crop || !b.crops_pct) return;
    const set = (key: string, value: string, write: () => void) => {
      if (shown.current.get(key) === value) return;
      shown.current.set(key, value);
      write();
    };
    const ac = cs.map((c) => a.area_by_crop![c].ac + (b.area_by_crop![c].ac - a.area_by_crop![c].ac) * f);
    const order = cs.map((_, k) => k).sort((x, y) => ac[y] - ac[x]);
    cs.forEach((c, k) => {
      const row = rows.current.get(c);
      if (!row) return;
      const pct = a.crops_pct![c] + (b.crops_pct![c] - a.crops_pct![c]) * f;
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
  const area = current.area_by_crop;
  const pct = current.crops_pct;
  const rank = new Map([...crops].sort((a, b) => area[b].ac - area[a].ac).map((c, i) => [c, i]));

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
                aria-label={`${rank.get(c)! + 1}. ${CROP_LABEL[c]}: ${fmt.format(area[c].ac)} acres, ${Math.round(pct[c])}% of cropland in ${current.year}. Keep it lit on the map.`}
                title={CROP_NOTE[c]}
                onClick={() => onPin(c)}
              >
                <span className="race__label">
                  <CropIcon crop={c} size={18} onDark />
                  {CROP_LABEL[c]}
                </span>
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
      <p className="race__note">% of the county's cropland. Tap a crop to keep it lit on the map; tap it again to show all.</p>
    </section>
  );
}
