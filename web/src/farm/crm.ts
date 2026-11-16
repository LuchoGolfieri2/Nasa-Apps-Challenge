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
import type { NextData, NextOption, PlanCrop, RotationKind } from "../next/types";
import { FARM_CROP_LABEL, farmIncome, farmOption, priceCost, type Farm, type PriceCost } from "./farm";

export interface Series {
  option: NextOption;
  /** $/acre por año de clima; null = el modelo no tiene ese año */
  income: Array<number | null>;
}

export interface Comparison {
  years: number[];
  advice: Series;
  base: Series;
  /** por qué la base es esa */
  baseWhy: "yours" | "usual" | "repeat";
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
  const base = pickBase(plan.options, advice, farmOption(data, farm));
  if (!base) return null;
  const inc = (o: NextOption) =>
    (bw.yield_bu_ac[key(o)] ?? bw.years.map(() => null)).map((y) =>
      y == null ? null : Math.round(y * pc.price - pc.cost),
    );
  const a = inc(advice);
  const b = inc(base.option);
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
    advice: { option: advice, income: a },
    base: { option: base.option, income: b },
    baseWhy: base.why,
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
        monthsAgo: latest ? monthsSince(latest.year) : null,
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
