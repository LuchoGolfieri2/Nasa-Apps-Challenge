/**
 * Tipos de next/<fips>.json (pantalla "Next season").
 * Contrato: front-back-connection-spec.md §3 (con los agregados del README de esta carpeta).
 * Los cultivos usan los ids de src/ui/crops.ts (corn, soy, wheat, sorghum…).
 */
export type Priority = 'risk' | 'income' | 'soil' | 'water';
import type {CropId} from '../ui/crops';
export type {CropId};
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Range {
  p10: number;
  median: number;
  p90: number;
}

/** Todo bloque de datos dice de dónde viene y si es de prueba */
export interface Sourced {
  source: string;
  prototype: boolean;
}

export interface Reason {
  priority: Priority;
  text: string;
  source: string;
  kind: 'model' | 'rule';
  /** true = habla a favor de la opción; false = es una advertencia */
  pro: boolean;
  /** Años que respaldan la razón: clickeables, llevan a Historia en ese año (F23) */
  years: number[];
}

export interface Note {
  text: string;
  kind: 'model' | 'rule';
  source: string;
}

export interface NextOption extends Sourced {
  id: string;
  crop: CropId;
  label: string;
  is_current: boolean;
  /** null = "Missing data" */
  yield_bu_ac: Range | null;
  usual_bu_ac: number | null;
  income_usd_ac: Range | null;
  /** 0..1 por prioridad; null = no se puede puntuar (falta el dato) */
  scores: Record<Priority, number | null>;
  suggested_for: Priority[];
  confidence: {level: ConfidenceLevel; reason: string};
  /** true = solo se ve en gemelos lejanos */
  extrapolated: boolean;
  reasons: Reason[];
  benefits: Note[];
  risks: Note[];
  /** fips de los gemelos que respaldan esta opción */
  twins: string[];
}

export interface Rotation extends Sourced {
  id: string;
  sequence: CropId[];
  /** % de lotes del condado con esta rotación (CDL) */
  share_pct: number;
  options: NextOption[];
}

export interface Twin extends Sourced {
  fips: string;
  name: string;
  state: string;
  centroid: [number, number];
  similar_on: string[];
  grew_crop_pct: Partial<Record<CropId, number>>;
}

export interface NextData extends Sourced {
  fips: string;
  name: string;
  state: string;
  centroid: [number, number];
  metric: 'yield_bu_ac';
  default_rotation: string;
  rotations: Rotation[];
  twins: Twin[];
  missing: Array<{what: string; why: string}>;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  risk: 'Lower risk in bad years',
  income: 'Higher income',
  soil: 'Soil health',
  water: 'Save water',
};
