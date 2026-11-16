import type { County, VsUsual } from "../data/types";
import { CROP_COLOR } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";

/**
 * Condados sin mapa del CDL: en lugar del mapa y la carrera de barras, el rinde de cada año (USDA NASS),
 * maíz y soja con su propia escala. Los años que el modelo marca fuera de lo habitual llevan ↑ o ↓.
 * Tocar un año lo elige en la línea de tiempo.
 */
const ROWS = [
  { id: "corn", label: "Corn", color: CROP_COLOR.corn },
  { id: "soy", label: "Soybeans", color: CROP_COLOR.soy },
] as const;
const MARK: Record<VsUsual, string> = { above: "↑", similar: "", below: "↓" };
const MARK_LABEL: Record<VsUsual, string> = {
  above: "above a usual year",
  similar: "similar to a usual year",
  below: "below a usual year",
};

export function YieldHistory({
  county,
  year,
  onYear,
}: {
  county: County;
  year: number | null;
  onYear: (y: number) => void;
}) {
  const rows = ROWS.map((r) => {
    const pts = county.years.map((y) => ({
      year: y.year,
      v: y.yield?.crops[r.id] ?? null,
    }));
    const vals = pts.flatMap((p) => (p.v ? [p.v.bu_ac] : []));
    return { ...r, pts, max: Math.max(1, ...vals), has: vals.length > 0 };
  }).filter((r) => r.has);

  return (
    <section
      className="yh"
      aria-label={`Yield by year in ${county.name} County`}
    >
      <h2 className="yh__title">Yield, year by year</h2>
      {rows.length === 0 ? (
        <Missing what={`county yield (USDA NASS) for ${county.name} County`} />
      ) : (
        rows.map((r) => (
          <div key={r.id} className="yh__row">
            <p className="yh__crop">
              <i style={{ background: r.color }} aria-hidden="true" />
              {r.label} <span>bu/acre</span>
            </p>
            <ol className="yh__bars">
              {r.pts.map((p) => {
                const on = p.year === year;
                const vs = p.v?.vs_usual ?? null;
                return (
                  <li key={p.year}>
                    <button
                      type="button"
                      className={`yh__bar${on ? " is-on" : ""}${vs === "below" ? " is-below" : ""}`}
                      onClick={() => onYear(p.year)}
                      aria-pressed={on}
                      aria-label={
                        p.v
                          ? `${p.year}: ${r.label} ${p.v.bu_ac} bu/acre${vs ? `, ${MARK_LABEL[vs]}` : ""}`
                          : `${p.year}: Missing data`
                      }
                    >
                      <span className="yh__v" aria-hidden="true">
                        {p.v ? (
                          <>
                            {vs ? <b className="yh__mark">{MARK[vs]}</b> : null}
                            {p.v.bu_ac}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                      <span
                        className={`yh__fill${p.v ? "" : " is-missing"}`}
                        style={{
                          height: p.v
                            ? `${(p.v.bu_ac / r.max) * 100}%`
                            : "100%",
                          background: p.v ? r.color : undefined,
                        }}
                        aria-hidden="true"
                      />
                      <span className="yh__y" aria-hidden="true">
                        ’{String(p.year).slice(2)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))
      )}
      <p className="yh__note">
        ↑ ↓ more than 10% above or below a usual year for this county (Field
        Rewind yield model). A dash is a year with no published county yield.{" "}
        <SourceChip source="USDA NASS · county" />
      </p>
      <Missing
        inline
        what="the field-by-field crop map (USDA CDL) for this county"
      />
    </section>
  );
}
