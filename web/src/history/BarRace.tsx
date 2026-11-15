import { useMemo } from "react";
import type { CountyYear } from "../data/types";
import { CROPS, CROP_COLOR, CROP_LABEL, CROP_NOTE, type CropId } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import { Icon } from "../ui/Icon";
import { CROP_ICON } from "../ui/icons";

const ROW = 42;
const fmt = new Intl.NumberFormat("en-US");

interface Props {
  years: CountyYear[];
  current: CountyYear;
  highlight: CropId | null;
  onHighlight: (crop: CropId | null) => void;
  /** Cultivo que quedó fijo con un clic (sigue resaltado sin el cursor encima). */
  pinned: CropId | null;
  onPin: (crop: CropId) => void;
  source: string;
}

/**
 * Carrera de barras: superficie por cultivo del año, ordenada de mayor a menor (F18).
 * La escala es fija para todo el período, así el largo de una barra se compara entre años.
 */
export function BarRace({ years, current, highlight, onHighlight, pinned, onPin, source }: Props) {
  // Entran los cultivos que alguna vez pasaron el 2 % de la superficie con cultivo.
  const { crops, maxAc } = useMemo(() => {
    const shown = CROPS.filter((c) => years.some((y) => (y.crops_pct?.[c] ?? 0) >= 2));
    const max = Math.max(1, ...years.flatMap((y) => shown.map((c) => y.area_by_crop?.[c]?.ac ?? 0)));
    return { crops: shown, maxAc: max };
  }, [years]);

  if (!current.area_by_crop || !current.crops_pct) {
    return <Missing what={`crop areas for ${current.year}`} />;
  }
  const area = current.area_by_crop;
  const pct = current.crops_pct;
  const rank = new Map([...crops].sort((a, b) => area[b].ac - area[a].ac).map((c, i) => [c, i]));

  return (
    <section className="race" aria-labelledby="race-title">
      <div className="race__head">
        <h2 id="race-title">Acres by crop, {current.year}</h2>
        <SourceChip source={source} />
      </div>
      <ol className="race__rows" style={{ height: crops.length * ROW }} onPointerLeave={() => onHighlight(null)}>
        {crops.map((c) => {
          const r = rank.get(c)!;
          const dim = highlight !== null && highlight !== c;
          return (
            <li
              key={c}
              className={dim ? "race__row race__row--dim" : "race__row"}
              style={{ transform: `translateY(${r * ROW}px)` }}
              onPointerEnter={() => onHighlight(c)}
            >
              <button
                type="button"
                className="race__hit"
                aria-pressed={pinned === c}
                aria-label={`${r + 1}. ${CROP_LABEL[c]}: ${fmt.format(area[c].ac)} acres, ${Math.round(pct[c])}% of cropland. Keep it lit on the map.`}
                title={CROP_NOTE[c]}
                onClick={() => onPin(c)}
              >
              <span className="race__label">
                {CROP_ICON[c] ? <Icon name={CROP_ICON[c]!} size={16} /> : <span className="race__noicon" aria-hidden="true" />}
                {CROP_LABEL[c]}
              </span>
              <span className="race__track" aria-hidden="true">
                <span
                  className="race__bar"
                  style={{ width: `${(100 * area[c].ac) / maxAc}%`, background: CROP_COLOR[c] }}
                />
              </span>
              <span className="race__value" aria-hidden="true">
                {fmt.format(area[c].ac)} <small>ac</small>
              </span>
              <span className="race__pct" aria-hidden="true">
                {Math.round(pct[c])}%
              </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="race__note">% of the county's cropland. Tap a crop to keep it lit on the map; tap it again to show all.</p>
    </section>
  );
}
