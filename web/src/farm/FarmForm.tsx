/** My Farm · formulario del perfil del campo (ruta #/farm/edit, y #/farm la primera vez). */
import { useMemo, useState, type FormEvent } from "react";
import { Icon, PRIORITY_ICON } from "../next/icons";
import { PRIORITY_LABEL, type PlanCrop, type Priority } from "../next/types";
import { CropPhoto } from "./CropPhoto";
import { MODEL_STATES_TEXT, STATE_NAME } from "../data/states";
import {
  COUNTY_BY_FIPS,
  FARM_COUNTIES,
  FARM_CROPS,
  FARM_CROP_LABEL,
  FARM_YEARS,
  LIMITS,
  clearFarm,
  emptyFarm,
  saveFarm,
  usdaPriceCost,
  type Farm,
  type FarmCrop,
} from "./farm";

const PRIORITIES: Priority[] = ["risk", "income", "soil", "water"];

type Errors = Partial<Record<string, string>>;

/** Un número escrito por el productor: vacío = null; con coma decimal también vale */
const parseNum = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

export function FarmForm({
  initial,
  onSaved,
}: {
  initial: Farm | null;
  onSaved: () => void;
}) {
  const start = initial ?? emptyFarm();
  const [name, setName] = useState(start.name);
  const [fips, setFips] = useState(start.fips);
  const [acres, setAcres] = useState(
    start.acres === null ? "" : String(start.acres),
  );
  const [seasons, setSeasons] = useState<Record<string, FarmCrop | null>>(
    start.seasons,
  );
  const [plan, setPlan] = useState<PlanCrop>(start.plan);
  const [priorities, setPriorities] = useState<Priority[]>(start.priorities);
  const [price, setPrice] = useState({
    corn: start.price.corn?.toString() ?? "",
    soy: start.price.soy?.toString() ?? "",
  });
  const [cost, setCost] = useState({
    corn: start.cost.corn?.toString() ?? "",
    soy: start.cost.soy?.toString() ?? "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [storeFailed, setStoreFailed] = useState(false);

  const byState = useMemo(() => {
    const g: Record<string, typeof FARM_COUNTIES> = {};
    for (const c of FARM_COUNTIES) (g[c.state] ??= []).push(c);
    return g;
  }, []);

  const usda = {
    corn: usdaPriceCost(fips, "corn"),
    soy: usdaPriceCost(fips, "soy"),
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err: Errors = {};
    const a = parseNum(acres);
    if (
      a !== null &&
      (Number.isNaN(a) || a < LIMITS.acres[0] || a > LIMITS.acres[1])
    )
      err.acres = `Enter acres between ${LIMITS.acres[0]} and ${LIMITS.acres[1].toLocaleString("en-US")}.`;
    if (!COUNTY_BY_FIPS[fips]) err.fips = "Pick a county from the list.";
    const pr = { corn: parseNum(price.corn), soy: parseNum(price.soy) };
    const co = { corn: parseNum(cost.corn), soy: parseNum(cost.soy) };
    (["corn", "soy"] as PlanCrop[]).forEach((c) => {
      const [lo, hi] = LIMITS.price[c];
      if (
        pr[c] !== null &&
        (Number.isNaN(pr[c]) ||
          (pr[c] as number) < lo ||
          (pr[c] as number) > hi)
      )
        err[`price_${c}`] = `Between $${lo} and $${hi} per bushel.`;
      if (
        co[c] !== null &&
        (Number.isNaN(co[c]) ||
          (co[c] as number) < LIMITS.cost[0] ||
          (co[c] as number) > LIMITS.cost[1])
      )
        err[`cost_${c}`] =
          `Between $${LIMITS.cost[0]} and $${LIMITS.cost[1]} per acre.`;
    });
    setErrors(err);
    if (Object.keys(err).length) {
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(".fm-form [aria-invalid='true']")
          ?.focus(),
      );
      return;
    }
    const farm: Farm = {
      version: 1,
      name: name.trim().slice(0, LIMITS.name),
      fips,
      acres: a === null ? null : Math.round(a),
      seasons,
      plan,
      priorities,
      price: { corn: pr.corn, soy: pr.soy },
      cost: { corn: co.corn, soy: co.soy },
      saved_at: new Date().toISOString(),
    };
    if (!saveFarm(farm)) {
      setStoreFailed(true);
      return;
    }
    onSaved();
  };

  const togglePriority = (p: Priority) =>
    setPriorities((cur) =>
      cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p],
    );

  return (
    <form className="fm-form" onSubmit={submit} noValidate>
      <header className="fm-form-head">
        <p className="fm-kicker">My Farm</p>
        <h1>{initial ? "Edit your farm" : "Tell us about your farm"}</h1>
        <p className="fm-lede">
          Five quick answers. Field Rewind uses them to show your county's data
          through your own rotation, prices and priorities.
        </p>
        <p className="fm-privacy">
          <Icon name="shield" size={16} /> Saved only in this browser. Nothing
          is sent anywhere.
        </p>
      </header>

      <section className="fm-step" aria-labelledby="fm-s1">
        <h2 id="fm-s1">
          <span className="fm-num">1</span> Where is it?
        </h2>
        <div className="fm-grid2">
          <label className="fm-field">
            <span>Farm name (optional)</span>
            <input
              value={name}
              maxLength={LIMITS.name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Golfieri Farms"
              autoComplete="organization"
            />
          </label>
          <label className="fm-field">
            <span>County</span>
            <select
              value={fips}
              onChange={(e) => setFips(e.target.value)}
              aria-invalid={errors.fips ? true : undefined}
              aria-describedby="fm-fips-help"
            >
              {Object.keys(byState)
                .sort((a, b) => (STATE_NAME[a] ?? a).localeCompare(STATE_NAME[b] ?? b))
                .map((st) => (
                  <optgroup key={st} label={STATE_NAME[st] ?? st}>
                    {byState[st].map((c) => (
                      <option key={c.fips} value={c.fips}>
                        {c.name} County
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
            <small id="fm-fips-help">
              {errors.fips ??
                `${MODEL_STATES_TEXT}: the states our yield model covers.`}
            </small>
          </label>
          <label className="fm-field">
            <span>Cropland (acres)</span>
            <input
              inputMode="decimal"
              value={acres}
              onChange={(e) => setAcres(e.target.value)}
              placeholder="e.g. 640"
              aria-invalid={errors.acres ? true : undefined}
              aria-describedby="fm-acres-help"
            />
            <small
              id="fm-acres-help"
              className={errors.acres ? "fm-err" : undefined}
            >
              {errors.acres ??
                "Optional. With it, income is shown for your whole farm."}
            </small>
          </label>
        </div>
      </section>

      <section className="fm-step" aria-labelledby="fm-s2">
        <h2 id="fm-s2">
          <span className="fm-num">2</span> What did you plant?
        </h2>
        <div className="fm-seasons">
          {FARM_YEARS.map((y) => {
            const sel = seasons[String(y)];
            return (
              <fieldset key={y} className="fm-season">
                <legend>{y}</legend>
                <div className="fm-season-art">
                  {sel ? <CropPhoto crop={sel} /> : <span>Not set</span>}
                </div>
                <div className="fm-chips">
                  {FARM_CROPS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`fm-chip${sel === c ? " on" : ""}`}
                      aria-pressed={sel === c}
                      onClick={() =>
                        setSeasons((s) => ({
                          ...s,
                          [String(y)]: sel === c ? null : c,
                        }))
                      }
                    >
                      {FARM_CROP_LABEL[c]}
                    </button>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      </section>

      <section className="fm-step" aria-labelledby="fm-s3">
        <h2 id="fm-s3">
          <span className="fm-num">3</span> What are you thinking of planting
          next?
        </h2>
        <div className="fm-plan" role="radiogroup" aria-labelledby="fm-s3">
          {(["corn", "soy"] as PlanCrop[]).map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={plan === c}
              className={`fm-plan-card${plan === c ? " on" : ""}`}
              onClick={() => setPlan(c)}
            >
              <CropPhoto crop={c} />
              <span>{FARM_CROP_LABEL[c]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="fm-step" aria-labelledby="fm-s4">
        <h2 id="fm-s4">
          <span className="fm-num">4</span> What matters most?
        </h2>
        <div className="fm-chips" role="group" aria-labelledby="fm-s4">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              className={`fm-chip fm-chip--big${priorities.includes(p) ? " on" : ""}`}
              aria-pressed={priorities.includes(p)}
              onClick={() => togglePriority(p)}
            >
              <Icon name={PRIORITY_ICON[p]} size={16} /> {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
      </section>

      <section className="fm-step" aria-labelledby="fm-s5">
        <h2 id="fm-s5">
          <span className="fm-num">5</span> Your price and costs{" "}
          <em>(optional)</em>
        </h2>
        <p className="fm-help">
          Leave them empty to use your state's numbers from USDA (median of{" "}
          {usda.corn?.years ?? "recent years"}).
        </p>
        <div className="fm-money">
          {(["corn", "soy"] as PlanCrop[]).map((c) => (
            <div key={c} className="fm-money-row">
              <b>{FARM_CROP_LABEL[c]}</b>
              <label className="fm-field">
                <span>Price ($/bushel)</span>
                <input
                  inputMode="decimal"
                  value={price[c]}
                  onChange={(e) =>
                    setPrice((p) => ({ ...p, [c]: e.target.value }))
                  }
                  placeholder={
                    usda[c]
                      ? `USDA ${usda[c]!.price.toFixed(2)}`
                      : "Missing data"
                  }
                  aria-invalid={errors[`price_${c}`] ? true : undefined}
                  aria-describedby={`fm-p-${c}`}
                />
                <small
                  id={`fm-p-${c}`}
                  className={errors[`price_${c}`] ? "fm-err" : undefined}
                >
                  {errors[`price_${c}`] ?? "USDA NASS, price received"}
                </small>
              </label>
              <label className="fm-field">
                <span>Operating cost ($/acre)</span>
                <input
                  inputMode="decimal"
                  value={cost[c]}
                  onChange={(e) =>
                    setCost((p) => ({ ...p, [c]: e.target.value }))
                  }
                  placeholder={
                    usda[c]
                      ? `USDA ${Math.round(usda[c]!.cost)}`
                      : "Missing data"
                  }
                  aria-invalid={errors[`cost_${c}`] ? true : undefined}
                  aria-describedby={`fm-c-${c}`}
                />
                <small
                  id={`fm-c-${c}`}
                  className={errors[`cost_${c}`] ? "fm-err" : undefined}
                >
                  {errors[`cost_${c}`] ??
                    "USDA ERS: seed, fertilizer, chemicals, fuel"}
                </small>
              </label>
            </div>
          ))}
        </div>
      </section>

      {storeFailed ? (
        <p className="fm-err fm-err--box">
          This browser blocks saving (private mode?). Your farm can't be kept
          here.
        </p>
      ) : null}

      <footer className="fm-form-foot">
        <button type="submit" className="btn btn--primary fm-save">
          Save my farm →
        </button>
        {initial ? (
          <>
            <a className="btn" href="#/farm">
              Cancel
            </a>
            <button
              type="button"
              className="btn fm-delete"
              onClick={() => {
                clearFarm();
                window.location.hash = "#/farm";
              }}
            >
              Delete my farm
            </button>
          </>
        ) : null}
      </footer>
    </form>
  );
}
