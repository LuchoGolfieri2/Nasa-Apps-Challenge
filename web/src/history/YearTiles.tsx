import type { ReactNode } from "react";
import type { County, CountyYear } from "../data/types";
import { Missing, PrototypeStamp } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import "./hero.css";

type YieldCrop = "corn" | "soy" | "wheat";
const YIELD_CROPS: YieldCrop[] = ["corn", "soy", "wheat"];
const YIELD_LABEL: Record<YieldCrop, string> = { corn: "Corn yield", soy: "Soybean yield", wheat: "Wheat yield" };
const VS_USUAL = { above: "Above usual", similar: "Similar to usual", below: "Below usual" } as const;

/** Una fuente por producto (la más detallada), para los sellos debajo de las cajas. */
export function uniqueSources(sources: (string | undefined)[]): string[] {
  const byProduct = new Map<string, string>();
  for (const s of sources) {
    if (!s) continue;
    const product = s.split(" · ")[0];
    const seen = byProduct.get(product);
    if (!seen || s.length > seen.length) byProduct.set(product, s);
  }
  return [...byProduct.values()];
}

/* Íconos de línea dibujados a mano (24 × 24, trazo del color del texto). */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="tile__icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICON: Record<"corn" | "soy" | "wheat" | "rain" | "heat" | "leaf" | "soil", ReactNode> = {
  // Choclo: mazorca con granos y una chala
  corn: (
    <Icon>
      <path d="M12 3c2.6 0 4.2 3.4 4.2 7.6S14.6 20 12 20s-4.2-5.2-4.2-9.4S9.4 3 12 3z" />
      <path d="M12 5.5v12M9.4 9h5.2M9 12.5h6M9.6 16h4.8" />
      <path d="M7.8 13.5C5.6 14.6 4.6 17 4.5 20.5c2.7-.4 5.2-1.7 7.5-3.8" />
    </Icon>
  ),
  // Soja: vaina con tres porotos
  soy: (
    <Icon>
      <path d="M5 19C5.5 11 11 5 19 5c-.5 8-6 14-14 14z" />
      <circle cx="9.5" cy="14.5" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="14.5" cy="9.5" r="1.3" />
    </Icon>
  ),
  // Trigo: espiga con granos a los dos lados
  wheat: (
    <Icon>
      <path d="M12 21V6" />
      <path d="M12 6c-1.6-.6-2.4-1.9-2.4-3.5C11.2 3 12 4.3 12 6zM12 6c1.6-.6 2.4-1.9 2.4-3.5C12.8 3 12 4.3 12 6z" />
      <path d="M12 10.5c-2-.3-3.2-1.7-3.4-3.6 2 .3 3.2 1.7 3.4 3.6zM12 10.5c2-.3 3.2-1.7 3.4-3.6-2 .3-3.2 1.7-3.4 3.6z" />
      <path d="M12 15c-2-.3-3.2-1.7-3.4-3.6 2 .3 3.2 1.7 3.4 3.6zM12 15c2-.3 3.2-1.7 3.4-3.6-2 .3-3.2 1.7-3.4 3.6z" />
    </Icon>
  ),
  // Gota de lluvia
  rain: (
    <Icon>
      <path d="M12 3.5c3 4 6 7.3 6 10.5a6 6 0 0 1-12 0c0-3.2 3-6.5 6-10.5z" />
      <path d="M9.5 14.5a2.6 2.6 0 0 0 2.5 2.5" />
    </Icon>
  ),
  // Termómetro
  heat: (
    <Icon>
      <path d="M10 13.6V5a2 2 0 1 1 4 0v8.6a4 4 0 1 1-4 0z" />
      <path d="M12 9v7.5" />
      <path d="M17 5h2M17 8.5h2" />
    </Icon>
  ),
  // Hoja
  leaf: (
    <Icon>
      <path d="M5 19.5C5 11 10 5 19.5 4.5 19.5 14 14 19.5 6.5 19.5" />
      <path d="M5 19.5c2.8-4.3 6-7.3 10-9.5" />
    </Icon>
  ),
  // Agua en el suelo: ondas sobre la línea de la tierra
  soil: (
    <Icon>
      <path d="M3.5 7.5c1.4-1.2 2.8-1.2 4.2 0s2.8 1.2 4.3 0 2.8-1.2 4.3 0 2.8 1.2 4.2 0" />
      <path d="M3.5 12c1.4-1.2 2.8-1.2 4.2 0s2.8 1.2 4.3 0 2.8-1.2 4.3 0 2.8 1.2 4.2 0" />
      <path d="M3.5 17.5h17" />
      <path d="M7 20.5h2M12 20.5h2M16.5 20.5h1.5" />
    </Icon>
  ),
};

interface TileProps {
  icon: ReactNode;
  label: string;
  /** null = falta el dato: se escribe "Missing data" y el motivo va en el tooltip y para lectores de pantalla. */
  value: ReactNode | null;
  missing?: string;
  tag?: { text: string; tone: "above" | "similar" | "below" } | null;
  /** Lo que el tooltip agrega a un valor que sí está (p. ej. que falta la comparación con lo habitual). */
  note?: string;
  prototype?: boolean;
}

function Tile({ icon, label, value, missing, tag, note, prototype }: TileProps) {
  const title = value === null ? `${label}: Missing data${missing ? `. ${cap(missing)}.` : ""}` : note ? `${label}. ${note}` : undefined;
  return (
    <li className={value === null ? "tile tile--missing" : "tile"} title={title}>
      <div className="tile__top">
        {icon}
        {tag ? <span className={`tile__tag tile__tag--${tag.tone}`}>{tag.text}</span> : null}
      </div>
      <span className="tile__label">{label}</span>
      <span className="tile__value">
        {value === null ? (
          <>
            <Missing inline what="" />
            {missing ? <span className="visually-hidden">: {missing}</span> : null}
          </>
        ) : (
          value
        )}
        {note ? <span className="visually-hidden"> ({note})</span> : null}
      </span>
      {prototype ? (
        <div className="tile__stamp">
          <PrototypeStamp />
        </div>
      ) : null}
    </li>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Num({ n, unit }: { n: ReactNode; unit?: string }) {
  return (
    <>
      <b>{n}</b>
      {unit ? <small> {unit}</small> : null}
    </>
  );
}

/**
 * El año en cajas, como una tarjeta del tiempo: ícono, valor grande y etiqueta (reemplaza a YearLines en la
 * columna y a YearFacts debajo de la línea de tiempo). Lo que no hay se escribe "Missing data", nunca 0.
 * Las cajas son las mismas todos los años del condado (las define todo el período, no el año), así el play no
 * mueve el diseño.
 */
export function YearTiles({ county, y }: { county: County; y: CountyYear }) {
  const all = county.years;
  const yieldCrops = YIELD_CROPS.filter((c) => all.some((v) => v.yield?.crops[c]));
  const hasWeather = all.some((v) => v.weather);
  const hasGreen = all.some((v) => v.greenness);
  const hasSoil = all.some((v) => v.soil_water);
  const anyTags = all.some((v) => v.weather?.tags.length);
  const noCompare =
    y.yield && Object.values(y.yield.crops).every((v) => !v?.vs_usual)
      ? "Missing data: how this compares with a usual year"
      : undefined;

  const weatherMissing = hasWeather
    ? `no weather record for ${y.year}`
    : `rain and temperature (NASA POWER) are not loaded for ${county.name} County yet`;

  // Fuentes de todo el período, así los sellos no aparecen y desaparecen durante el play.
  const sources = uniqueSources(
    all.flatMap((v) => [v.yield?.source, v.weather?.source, v.greenness?.source, v.soil_water?.source]),
  );

  return (
    <section className="tiles-block" aria-label={`${y.year} in numbers`}>
      {anyTags ? (
        <p className="tiles-block__tags">
          {y.weather?.tags.map((t) => (
            <b key={t} className="tiles-block__tag" title={`Source: ${y.weather!.source}`}>
              {t}
            </b>
          ))}
        </p>
      ) : null}

      <ul className="tiles">
        {yieldCrops.length ? (
          yieldCrops.map((c) => {
            const v = y.yield?.crops[c];
            return (
              <Tile
                key={c}
                icon={ICON[c]}
                label={YIELD_LABEL[c]}
                value={v ? <Num n={v.bu_ac} unit="bu/acre" /> : null}
                missing={y.yield ? `no ${c === "soy" ? "soybean" : c} yield for ${y.year}` : `no county yield for ${y.year}`}
                tag={v?.vs_usual ? { text: VS_USUAL[v.vs_usual], tone: v.vs_usual } : null}
                note={v ? noCompare : undefined}
                prototype={y.yield?.prototype}
              />
            );
          })
        ) : (
          <Tile
            icon={ICON.corn}
            label="Yield"
            value={null}
            missing={`county yield (USDA NASS) is not loaded for ${county.name} County yet`}
          />
        )}

        <Tile
          icon={ICON.rain}
          label="Rain, Apr–Sep"
          value={y.weather ? <Num n={y.weather.season_rain_in} unit="in" /> : null}
          missing={weatherMissing}
          prototype={y.weather?.prototype}
        />
        <Tile
          icon={ICON.heat}
          label="July highs"
          value={y.weather ? <Num n={y.weather.july_tmax_f} unit="°F" /> : null}
          missing={weatherMissing}
          prototype={y.weather?.prototype}
        />

        {hasGreen || hasSoil ? (
          <>
            <Tile
              icon={ICON.leaf}
              label="Peak greenness (vigor, not yield)"
              value={y.greenness ? <Num n={y.greenness.peak.toFixed(2)} /> : null}
              missing={
                hasGreen ? `no crop greenness for ${y.year}` : "crop greenness (NASA MODIS) is not loaded yet"
              }
              prototype={y.greenness?.prototype}
            />
            <Tile
              icon={ICON.soil}
              label="Soil water"
              value={y.soil_water ? <b className="tile__word">{y.soil_water.label}</b> : null}
              missing={
                hasSoil ? `no soil water record for ${y.year}` : "water in the soil (NASA SMAP) is not loaded yet"
              }
              prototype={y.soil_water?.prototype}
            />
          </>
        ) : (
          <Tile
            icon={ICON.leaf}
            label="Greenness · soil water"
            value={null}
            missing="crop greenness (NASA MODIS) and water in the soil (NASA SMAP) are not loaded yet"
          />
        )}
      </ul>

      {sources.length ? (
        <p className="tiles-block__sources">
          {sources.map((s) => (
            <SourceChip key={s} source={s} />
          ))}
        </p>
      ) : null}
    </section>
  );
}
