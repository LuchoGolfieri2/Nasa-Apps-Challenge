import type { County, CountyYear } from "../data/types";
import { Missing, PrototypeStamp } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import { Icon } from "../ui/Icon";
import type { IconName } from "../ui/icons";

const YIELD_NAME = { corn: "Corn", soy: "Soybeans", wheat: "Wheat" } as const;
const VS_USUAL = { above: "Above usual", similar: "Similar to usual", below: "Below usual" } as const;

function Fact({
  label,
  icon,
  source,
  prototype,
  children,
}: {
  label: string;
  icon: IconName;
  source?: string;
  prototype?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fact">
      <dt>
        <span className="fact__label">
          <Icon name={icon} size={18} />
          {label}
        </span>
        {prototype ? <PrototypeStamp /> : null}
      </dt>
      <dd>
        {children}
        {source ? <SourceChip source={source} /> : null}
      </dd>
    </div>
  );
}

/** Lo que pasó ese año además de qué se sembró (F20). Lo que no hay se escribe como faltante. */
export function YearFacts({ county, y }: { county: County; y: CountyYear }) {
  const hasYieldSomewhere = county.years.some((v) => v.yield);
  const hasWeatherSomewhere = county.years.some((v) => v.weather);

  return (
    <dl className="facts">
      <Fact label="Yield" icon="yield" source={y.yield?.source} prototype={y.yield?.prototype}>
        {y.yield ? (
          <>
            <span className="fact__value">
              {(Object.keys(YIELD_NAME) as (keyof typeof YIELD_NAME)[])
                .filter((c) => y.yield!.crops[c])
                .map((c) => {
                  const v = y.yield!.crops[c]!;
                  return (
                    <span key={c}>
                      {YIELD_NAME[c]} <b>{v.bu_ac}</b> bu/acre
                      {v.vs_usual ? <em> · {VS_USUAL[v.vs_usual]}</em> : null}
                    </span>
                  );
                })}
            </span>
            {Object.values(y.yield.crops).every((v) => !v?.vs_usual) ? (
              <Missing inline what="how this compares with a usual year" />
            ) : null}
          </>
        ) : (
          <Missing
            what={
              hasYieldSomewhere
                ? `no county yield for ${y.year}`
                : `county yield (USDA NASS) is not loaded for ${county.name} County yet`
            }
          />
        )}
      </Fact>

      <Fact label="Weather" icon="rain" source={y.weather?.source} prototype={y.weather?.prototype}>
        {y.weather ? (
          <span className="fact__value">
            {y.weather.tags.length ? (
              <span>
                {y.weather.tags.map((t) => (
                  <b key={t} className="fact__tag">
                    {t}
                  </b>
                ))}
              </span>
            ) : null}
            <span>
              <b>{y.weather.season_rain_in}</b> in of rain, April to September
            </span>
            <span>
              July highs averaged <b>{y.weather.july_tmax_f}</b> °F
            </span>
          </span>
        ) : (
          <Missing
            what={
              hasWeatherSomewhere
                ? `no weather record for ${y.year}`
                : `rain and temperature (NASA POWER) are not loaded for ${county.name} County yet`
            }
          />
        )}
      </Fact>

      <Fact
        label="Greenness and soil water"
        icon="greenness"
        source={y.greenness?.source ?? y.soil_water?.source}
        prototype={y.greenness?.prototype || y.soil_water?.prototype}
      >
        {y.greenness || y.soil_water ? (
          <span className="fact__value">
            {y.greenness ? (
              <span>
                Peak crop greenness <b>{y.greenness.peak.toFixed(2)}</b> (vigor, not yield)
              </span>
            ) : null}
            {y.soil_water ? <span>Soil water: {y.soil_water.label}</span> : null}
          </span>
        ) : (
          <Missing what="crop greenness (NASA MODIS) and water in the soil (NASA SMAP) are not loaded yet" />
        )}
      </Fact>
    </dl>
  );
}
