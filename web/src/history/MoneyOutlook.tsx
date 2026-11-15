import type { County } from "../data/types";
import { CROP_COLOR, CROP_LABEL } from "../ui/crops";
import { Missing } from "../ui/Missing";
import { SourceChip } from "../ui/SourceChip";
import "./moneyOutlook.css";

const MONEY_CROPS = [
  { id: "corn", label: "Corn" },
  { id: "soy", label: "Soybeans" },
] as const;
const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

/**
 * Plata por acre, año por año (USDA ERS y NASS): lo que queda después de los costos operativos de maíz y soja.
 * Es un valor regional (ERS, región Heartland): no son las cuentas del condado. Tocar un año lo elige.
 */
export function MoneyCard({ county, year, onYear }: { county: County; year: number | null; onYear: (y: number) => void }) {
  const rows = MONEY_CROPS.map((c) => {
    const pts = county.years.map((y) => ({ year: y.year, e: y.economics?.crops[c.id] ?? null }));
    const vals = pts.flatMap((p) => (p.e?.margin_usd_ac != null ? [p.e.margin_usd_ac] : []));
    return { ...c, pts, max: Math.max(1, ...vals), has: vals.length > 0 };
  }).filter((r) => r.has);
  const cur = county.years.find((y) => y.year === year)?.economics ?? null;

  return (
    <div className="card money">
      <h3>Money left per acre, year by year</h3>
      {rows.length === 0 ? (
        <Missing what="prices and costs for this state" />
      ) : (
        <>
          {rows.map((r) => (
            <div key={r.id} className="money__row">
              <p className="money__crop">
                <i style={{ background: CROP_COLOR[r.id] }} aria-hidden="true" />
                {r.label} <span>$/acre after operating costs</span>
              </p>
              <ol className="money__bars">
                {r.pts.map((p) => {
                  const m = p.e?.margin_usd_ac ?? null;
                  return (
                    <li key={p.year}>
                      <button
                        type="button"
                        className={`money__bar${p.year === year ? " is-on" : ""}`}
                        onClick={() => onYear(p.year)}
                        aria-pressed={p.year === year}
                        aria-label={m != null ? `${p.year}: ${r.label} ${usd(m)} per acre` : `${p.year}: Missing data`}
                      >
                        <span className="money__v" aria-hidden="true">{m != null ? usd(m) : "—"}</span>
                        <span
                          className={`money__fill${m == null ? " is-missing" : m < 0 ? " is-neg" : ""}`}
                          style={m != null ? { height: `${(Math.max(0, m) / r.max) * 100}%`, background: m < 0 ? undefined : CROP_COLOR[r.id] } : undefined}
                          aria-hidden="true"
                        />
                        <span className="money__y" aria-hidden="true">’{String(p.year).slice(2)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          {cur ? (
            <p className="money__now">
              <b>{year}</b>{" "}
              {MONEY_CROPS.map((c) => {
                const e = cur.crops[c.id];
                return e?.price_usd_bu != null ? (
                  <span key={c.id}>
                    {c.label.toLowerCase()} paid ${e.price_usd_bu.toFixed(2)}/bu
                  </span>
                ) : null;
              })}
            </p>
          ) : null}
        </>
      )}
      <p className="history__small">
        Regional estimate: prices are the state average and costs are the USDA Heartland average, not this county's own books.{" "}
        <SourceChip source="USDA NASS · ERS · Heartland region" />
      </p>
    </div>
  );
}

const OUTLOOK_CROPS = ["corn", "soy", "wheat", "oats", "alfalfa"] as const;
const OUTLOOK_LABEL = { ...CROP_LABEL, oats: "Oats" } as Record<string, string>;
const OUTLOOK_COLOR: Record<string, string> = { ...CROP_COLOR };

/**
 * Clima futuro (FAO GAEZ v4): qué tan apto es el clima del condado para cada cultivo hoy y en 2041–2070 con el
 * escenario RCP8.5. Es un escenario con supuestos, no un pronóstico de rinde.
 */
export function OutlookCard({ county }: { county: County }) {
  const o = county.outlook;
  if (!o) {
    return (
      <div className="card outlook">
        <h3>Climate outlook, 2041–2070</h3>
        <Missing what="the climate scenario for this county" />
      </div>
    );
  }
  const rows = OUTLOOK_CROPS.flatMap((c) => (o.crops[c] ? [{ id: c, ...o.crops[c]! }] : []));
  return (
    <div className="card outlook">
      <h3>Climate outlook, {o.scenario}</h3>
      <ul className="outlook__rows">
        {rows.map((r) => {
          const d = Math.round(r.suit_future - r.suit_now);
          return (
            <li key={r.id}>
              <span className="outlook__name">{OUTLOOK_LABEL[r.id]}</span>
              <span className="outlook__tracks" role="img" aria-label={`${OUTLOOK_LABEL[r.id]}: suitability ${r.suit_now} now, ${r.suit_future} in ${o.scenario}`}>
                <span className="outlook__track"><i style={{ width: `${r.suit_now}%` }} className="is-now" /></span>
                <span className="outlook__track"><i style={{ width: `${r.suit_future}%`, background: OUTLOOK_COLOR[r.id] }} /></span>
              </span>
              <b className={d < -2 ? "is-down" : d > 2 ? "is-up" : ""}>{d > 0 ? "+" : d < 0 ? "−" : ""}{Math.abs(d)}</b>
              <small>
                {r.attainable_bu_ac_now != null && r.attainable_bu_ac_future != null
                  ? `${r.attainable_bu_ac_now} → ${r.attainable_bu_ac_future} bu/ac`
                  : ""}
              </small>
            </li>
          );
        })}
      </ul>
      <p className="outlook__key"><i className="is-now" />Climate {o.baseline} <i className="is-fut" />Scenario {o.scenario}</p>
      <p className="history__small">
        Climate suitability from 0 to 100 (high inputs, rain-fed). A scenario with assumptions, not a yield forecast. Bushels are the
        attainable yield in that scenario.{" "}
        <SourceChip source={o.source} />
      </p>
    </div>
  );
}
