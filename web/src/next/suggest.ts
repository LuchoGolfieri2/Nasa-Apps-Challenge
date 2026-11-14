/** Lógica pura de la sugerencia: qué opción gana según las prioridades marcadas. */
import type {NextOption, Priority, Reason} from './types';

export interface Suggestion {
  /** null si no hay prioridades marcadas o no se puede puntuar ninguna */
  winner: NextOption | null;
  /** puntaje promedio 0..1 de cada opción en las prioridades que sí tienen dato */
  scores: Record<string, number | null>;
  /** prioridades marcadas que no se pudieron usar porque falta el dato (p. ej. income sin costos) */
  unscored: Priority[];
  /** las 2 razones a mostrar, primero las de las prioridades marcadas */
  reasons: Reason[];
}

export function suggest(options: NextOption[], priorities: Priority[]): Suggestion {
  const unscored = priorities.filter((p) => options.every((o) => o.scores[p] == null));
  const usable = priorities.filter((p) => !unscored.includes(p));
  const scores: Record<string, number | null> = {};
  for (const o of options) {
    const values = usable.map((p) => o.scores[p]).filter((v): v is number => v != null);
    scores[o.id] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  }
  let winner: NextOption | null = null;
  for (const o of options) {
    const s = scores[o.id];
    if (s == null) continue;
    if (!winner || s > (scores[winner.id] as number)) winner = o;
  }
  const reasons = winner
    ? winner.reasons
        .filter((r) => r.pro) // en la frase sugerida solo van razones a favor
        .sort((a, b) => Number(usable.includes(b.priority)) - Number(usable.includes(a.priority))).slice(0, 2)
    : [];
  return {winner, scores, unscored, reasons};
}

/** Rinde de una opción como % de un año habitual del condado (100 = lo de siempre). null = falta el dato */
export function asPercentOfUsual(o: NextOption): {p10: number; median: number; p90: number} | null {
  if (!o.yield_bu_ac || !o.usual_bu_ac) return null;
  const pct = (v: number) => Math.round((v / (o.usual_bu_ac as number)) * 100);
  return {p10: pct(o.yield_bu_ac.p10), median: pct(o.yield_bu_ac.median), p90: pct(o.yield_bu_ac.p90)};
}

/**
 * Eje común para las 3 barras, en % de un año habitual.
 * Se usa % y no bu/acre porque los cultivos no son comparables en bushels
 * (el maíz siempre da más bushels por acre que el trigo).
 */
export function commonAxis(options: NextOption[]): {max: number; ticks: number[]} {
  const top = Math.max(...options.map((o) => asPercentOfUsual(o)?.p90 ?? 0), 125);
  const max = Math.ceil(top / 25) * 25;
  const ticks: number[] = [];
  for (let v = 0; v <= max; v += 25) ticks.push(v);
  return {max, ticks};
}
