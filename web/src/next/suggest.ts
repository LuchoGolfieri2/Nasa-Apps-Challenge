/** Lógica pura de la sugerencia: qué opción gana según las prioridades marcadas. */
import type {NextOption, Priority, Reason} from './types';

export interface Suggestion {
  /** null si no hay prioridades marcadas o no se puede puntuar ninguna */
  winner: NextOption | null;
  /** puntaje promedio 0..1 de cada opción en las prioridades que sí tienen dato */
  scores: Record<string, number | null>;
  /** prioridades marcadas que no se pudieron usar porque falta el dato (ingreso sin costos, agua) */
  unscored: Priority[];
  /** las 2 razones a mostrar: solo a favor, primero las de las prioridades marcadas */
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
  const rank = (r: Reason) => (usable.includes(r.priority as Priority) ? 0 : r.priority === 'yield' ? 1 : 2);
  const reasons = winner ? winner.reasons.filter((r) => r.pro).sort((a, b) => rank(a) - rank(b)).slice(0, 2) : [];
  return {winner, scores, unscored, reasons};
}

/** Eje común en bu/acre para las tres opciones de un mismo cultivo */
export function commonAxis(options: NextOption[]): {min: number; max: number; ticks: number[]} {
  const lows = options.map((o) => o.yield_bu_ac?.p10).filter((v): v is number => v != null);
  const highs = options.map((o) => o.yield_bu_ac?.p90).filter((v): v is number => v != null);
  if (!lows.length) return {min: 0, max: 100, ticks: [0, 25, 50, 75, 100]};
  const span = Math.max(...highs) - Math.min(...lows);
  const step = span > 60 ? 20 : span > 25 ? 10 : 5;
  const min = Math.floor((Math.min(...lows) - step * 0.6) / step) * step;
  const max = Math.ceil((Math.max(...highs) + step * 0.6) / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max; v += step) ticks.push(v);
  return {min, max, ticks};
}
