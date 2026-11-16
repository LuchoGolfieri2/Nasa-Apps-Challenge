/**
 * My Farm como CRM (F40): lo que se calcula para el tablero y el PDF, sin React.
 *
 * - "advice": la opción sugerida para las prioridades del productor (misma lógica que Next season).
 * - "base": lo que haría si sigue igual (según lo que sembró el año pasado). Si ya coincide con el consejo,
 *   se compara con el mix habitual del condado (o, si el consejo es ese, con repetir el cultivo).
 * - Ingreso por año de clima = rinde del modelo con ese clima × precio − costo (los del productor o los del USDA).
 *   Mismo precio y costo todos los años: solo cambia el clima.
 */
import { loadCounty } from "../data/load";
import type { County, CountyYear, Transition } from "../data/types";
import { suggest } from "../next/suggest";
import { PRIORITY_LABEL, type NextData, type NextOption, type PlanCrop, type Priority, type RotationKind } from "../next/types";
import { FARM_CROP_LABEL, farmIncome, farmOption, priceCost, type Farm, type PriceCost } from "./farm";

export interface Series {
  option: NextOption;
  /** $/acre por año de clima; null = el modelo no tiene ese año */
  income: Array<number | null>;
  /** bu/acre del modelo por año de clima; null = el modelo no tiene ese año */
  yield: Array<number | null>;
}

export interface Comparison {
  years: number[];
  advice: Series;
  base: Series;
  /** por qué la base es esa */
  baseWhy: "yours" | "usual" | "repeat";
  /** lo que planea (su cultivo después del de la última campaña) ya es lo que se aconseja */
  planMatches: boolean;
  pc: PriceCost;
  /** años de clima en que el consejo deja más que la base */
  wins: number;
  seasons: number;
  adviceMedian: number | null;
  baseMedian: number | null;
}

const key = (o: NextOption) => `${o.crop}_${o.rotation}`;

export function pickBase(options: NextOption[], advice: NextOption, mine: NextOption | null) {
  if (mine && mine.id !== advice.id) return { option: mine, why: "yours" as const };
  const want: RotationKind = advice.rotation === "actual" ? "continuo" : "actual";
  const o = options.find((x) => x.rotation === want);
  return o ? { option: o, why: (want === "actual" ? "usual" : "repeat") as "usual" | "repeat" } : null;
}

/** El consejo: la sugerida por sus prioridades; sin prioridades, la que más deja en un año típico */
export function pickAdvice(data: NextData, farm: Farm): NextOption | null {
  const plan = data.crops[farm.plan];
  if (!plan) return null;
  const w = suggest(plan.options, farm.priorities).winner;
  if (w) return w;
  return (
    [...plan.options]
      .filter((o) => o.income_usd_ac)
      .sort((a, b) => b.income_usd_ac!.median - a.income_usd_ac!.median)[0] ?? null
  );
}

export function compare(data: NextData, farm: Farm): Comparison | null {
  const plan = data.crops[farm.plan];
  const bw = data.by_weather;
  const pc = priceCost(farm, farm.plan);
  if (!plan || !bw || !pc) return null;
  const advice = pickAdvice(data, farm);
  if (!advice) return null;
  const mine = farmOption(data, farm);
  const base = pickBase(plan.options, advice, mine);
  if (!base) return null;
  const raw = (o: NextOption) => bw.yield_bu_ac[key(o)] ?? bw.years.map(() => null);
  const yld = (ys: Array<number | null>) => ys.map((y) => (y == null ? null : Math.round(y * 10) / 10));
  const inc = (ys: Array<number | null>) => ys.map((y) => (y == null ? null : Math.round(y * pc.price - pc.cost)));
  const ra = raw(advice);
  const rb = raw(base.option);
  const ya = yld(ra);
  const yb = yld(rb);
  const a = inc(ra);
  const b = inc(rb);
  let wins = 0;
  let seasons = 0;
  a.forEach((v, i) => {
    const w = b[i];
    if (v == null || w == null) return;
    seasons++;
    if (v > w) wins++;
  });
  if (!seasons) return null;
  return {
    years: bw.years,
    advice: { option: advice, income: a, yield: ya },
    base: { option: base.option, income: b, yield: yb },
    baseWhy: base.why,
    // solo si cargó la última campaña con maíz o soja: si no, "lo suyo" es el mix del condado por descarte
    planMatches: !!mine && mine.id === advice.id && mine.rotation !== "actual",
    pc,
    wins,
    seasons,
    adviceMedian: farmIncome(advice.yield_bu_ac, pc)?.median ?? null,
    baseMedian: farmIncome(base.option.yield_bu_ac, pc)?.median ?? null,
  };
}

export function baseTitle(c: Comparison, farm: Farm): string {
  const crop = FARM_CROP_LABEL[farm.plan].toLowerCase();
  if (c.baseWhy === "usual") return "Your county's usual mix";
  if (c.baseWhy === "repeat") return `Repeat ${crop}`;
  return c.base.option.rotation === "continuo"
    ? `If you repeat ${crop}`
    : c.base.option.rotation === "actual"
      ? "If you keep the usual mix"
      : `If you keep ${c.base.option.label.toLowerCase()}`;
}


// ------------------------------------------------------------------ en qué se basa el consejo

export interface AdviceBasis {
  /** prioridades marcadas que sí tienen dato y decidieron el consejo */
  used: Priority[];
  /** prioridades marcadas sin dato en este condado (quedaron afuera) */
  unscored: Priority[];
  /** true = ninguna prioridad usable: el consejo es la opción con más ingreso típico */
  byIncome: boolean;
  /** true = en este condado todas las prioridades con dato eligen la misma opción */
  sameForAll: boolean;
}

export function adviceBasis(data: NextData, farm: Farm, advice: NextOption | null): AdviceBasis | null {
  const plan = data.crops[farm.plan];
  if (!plan || !advice) return null;
  const s = suggest(plan.options, farm.priorities);
  const singles = (["risk", "income", "soil", "water"] as Priority[])
    .map((p) => suggest(plan.options, [p]).winner?.id)
    .filter((id): id is string => !!id);
  return {
    used: farm.priorities.filter((p) => !s.unscored.includes(p)),
    unscored: s.unscored,
    byIncome: !s.winner,
    sameForAll: singles.length > 1 && singles.every((id) => id === advice.id),
  };
}

/** La frase que explica por qué ese es el consejo (tablero y PDF) */
export function basisText(b: AdviceBasis | null): string {
  if (!b) return "";
  const list = (ps: Priority[]) => ps.map((p) => PRIORITY_LABEL[p].toLowerCase()).join(", ");
  const left = b.unscored.length ? ` No data separates the options on ${list(b.unscored)}, so it was left out.` : "";
  if (b.byIncome) return `${left} Advice is the option with the highest typical income.`.trim();
  const same = b.sameForAll ? " In this county every priority points to this same option." : "";
  return `Advice picked for: ${list(b.used)}.${left}${same}`;
}

export interface CropWinner {
  option: NextOption;
  /** años de clima en que esa opción dejó más que las otras cinco */
  wins: number;
  seasons: number;
  /** años en que ganó alguna opción del cultivo que planea el productor */
  planWins: number;
  /** precio y costo de cada cultivo: del productor si los cargó, si no del USDA */
  from: Record<PlanCrop, "you" | "usda">;
}

/** Maíz o soja: qué opción de las seis deja más por acre en cada año de clima, con los precios del productor */
export function cropWinner(data: NextData, farm: Farm): CropWinner | null {
  const bw = data.by_weather;
  if (!bw) return null;
  const crops: PlanCrop[] = ["corn", "soy"];
  const pcs = Object.fromEntries(crops.map((c) => [c, priceCost(farm, c)])) as Record<PlanCrop, PriceCost | null>;
  if (crops.some((c) => !pcs[c] || !data.crops[c])) return null;
  const opts = crops.flatMap((c) => data.crops[c].options);
  const wins = new Map<string, number>();
  let seasons = 0;
  bw.years.forEach((_, i) => {
    let best: NextOption | null = null;
    let bestV = -Infinity;
    for (const o of opts) {
      const y = bw.yield_bu_ac[key(o)]?.[i];
      if (y == null) continue;
      const v = y * pcs[o.crop]!.price - pcs[o.crop]!.cost;
      if (v > bestV) {
        bestV = v;
        best = o;
      }
    }
    if (!best) return;
    seasons++;
    wins.set(best.id, (wins.get(best.id) ?? 0) + 1);
  });
  if (!seasons) return null;
  const top = [...wins.entries()].sort((a, b) => b[1] - a[1])[0];
  const option = opts.find((o) => o.id === top[0])!;
  const planWins = [...wins.entries()]
    .filter(([id]) => opts.find((o) => o.id === id)?.crop === farm.plan)
    .reduce((n, [, w]) => n + w, 0);
  return {
    option,
    wins: top[1],
    seasons,
    planWins,
    from: { corn: pcs.corn!.priceFrom === "you" || pcs.corn!.costFrom === "you" ? "you" : "usda", soy: pcs.soy!.priceFrom === "you" || pcs.soy!.costFrom === "you" ? "you" : "usda" },
  };
}

export function optionName(data: NextData, o: NextOption) {
  return o.is_current ? `${data.crops[o.crop].label.toLowerCase()} in your county's usual mix` : o.label.toLowerCase();
}

// ------------------------------------------------------------------ quién ya lo hace

/** Qué paso de cultivo es la opción: "rotado" de maíz = soja → maíz; "continuo" = maíz → maíz; "actual" = ninguno */
export function optionStep(o: NextOption): { from: PlanCrop; to: PlanCrop } | null {
  const other: PlanCrop = o.crop === "corn" ? "soy" : "corn";
  if (o.rotation === "rotado") return { from: other, to: o.crop };
  if (o.rotation === "continuo") return { from: o.crop, to: o.crop };
  return null;
}

export function lastWith<T>(years: CountyYear[], pick: (y: CountyYear) => T | null | undefined) {
  for (let i = years.length - 1; i >= 0; i--) {
    const v = pick(years[i]);
    if (v != null) return { year: years[i].year, value: v };
  }
  return null;
}

export function adoption(hist: County | null) {
  if (!hist) return null;
  const t = lastWith(hist.years, (y) => (y.transitions?.length ? y.transitions : null));
  if (!t) return null;
  const items = [...t.value].sort((a, b) => b.pct - a.pct);
  return { year: t.year, items };
}

export function stepPct(items: Transition[], step: { from: string; to: string } | null) {
  if (!step) return null;
  return items.find((x) => x.from === step.from && x.to === step.to)?.pct ?? 0;
}

// ------------------------------------------------------------------ gemelos

export interface TwinRow {
  fips: string;
  name: string;
  state: string;
  /** % del terreno con el mismo paso de cultivo (o % del cultivo, si la opción es el mix habitual) */
  pct: number | null;
  pctLabel: string;
  year: number | null;
  /** año del mapa de cultivos (CDL) del que sale pct */
  pctYear: number | null;
  /** meses desde la cosecha del año de pct (o del rinde, si no hay mapa) */
  monthsAgo: number | null;
  baseAvg: number | null;
  latest: number | null;
  change: number | null;
}

const BASE_YEARS = [2015, 2016, 2017, 2018, 2019];
const CROP_WORD: Record<PlanCrop, string> = { corn: "corn", soy: "soybeans" };

/** Meses desde la cosecha de ese año (se toma el 1 de octubre) hasta hoy */
export function monthsSince(year: number, now = new Date()) {
  return Math.max(0, (now.getFullYear() - year) * 12 + now.getMonth() - 9);
}

export async function loadTwins(data: NextData, advice: NextOption): Promise<TwinRow[]> {
  const info = new Map(data.twins.map((t) => [t.fips, t]));
  const step = optionStep(advice);
  const crop = advice.crop;
  const rows = await Promise.all(
    advice.twins.map(async (fips): Promise<TwinRow | null> => {
      const c = await loadCounty(fips).catch(() => null);
      const t = info.get(fips);
      if (!c && !t) return null;
      const years = c?.years ?? [];
      const yv = (y: CountyYear) => y.yield?.crops[crop]?.bu_ac ?? null;
      const base = years
        .filter((y) => BASE_YEARS.includes(y.year))
        .map(yv)
        .filter((v): v is number => v != null);
      const latest = lastWith(years, yv);
      const baseAvg = base.length >= 3 ? base.reduce((a, b) => a + b, 0) / base.length : null;
      let pct: number | null = null;
      let year: number | null = null;
      if (step) {
        const tr = lastWith(years, (y) => (y.transitions?.length ? y.transitions : null));
        if (tr) {
          pct = stepPct(tr.value, step);
          year = tr.year;
        }
      } else {
        const cp = lastWith(years, (y) => y.crops_pct?.[crop] ?? null);
        if (cp) {
          pct = cp.value;
          year = cp.year;
        }
      }
      return {
        fips,
        name: c?.name ?? t?.name ?? fips,
        state: c?.state ?? t?.state ?? "",
        pct,
        pctLabel: step ? `${CROP_WORD[step.to]} after ${CROP_WORD[step.from]}` : `${CROP_WORD[crop]}`,
        year: latest?.year ?? year,
        pctYear: year,
        monthsAgo: year != null ? monthsSince(year) : latest ? monthsSince(latest.year) : null,
        baseAvg,
        latest: latest?.value ?? null,
        change: baseAvg && latest ? ((latest.value - baseAvg) / baseAvg) * 100 : null,
      };
    }),
  );
  return rows.filter((r): r is TwinRow => r !== null).sort((a, b) => (b.change ?? -1e9) - (a.change ?? -1e9));
}

// ------------------------------------------------------------------ formato

export const usd = (v: number) => `${v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
export const signed = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
export const pct1 = (v: number) => `${Math.round(v * 10) / 10}%`;
