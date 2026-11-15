/**
 * Tipos de data/next/<fips>.json (pantalla 3, "Next season").
 * Lo arma scripts/build_next_json.py con las salidas reales de ML (backend/Datos) y el CDL.
 * Los cultivos usan los ids de src/ui/crops.ts.
 */
import type {CropId} from '../ui/crops';
export type {CropId};

export type Priority = 'risk' | 'income' | 'soil' | 'water';
/** Las razones de rinde no son una prioridad del productor, pero sí entran en la frase sugerida */
export type ReasonTopic = Priority | 'yield';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type PlanCrop = 'corn' | 'soy';
export type RotationKind = 'actual' | 'rotado' | 'continuo';

export interface Range {
  p10: number;
  median: number;
  p90: number;
}

export interface Confidence {
  level: ConfidenceLevel;
  reason: string;
}

export interface Reason {
  priority: ReasonTopic;
  text: string;
  source: string;
  kind: 'model' | 'rule';
  /** Años que respaldan la razón: clickeables, llevan a la Historia en ese año (F23) */
  years: number[];
  /** true = habla a favor de la opción; false = es un riesgo */
  pro: boolean;
}

export interface NextOption {
  id: string;
  crop: PlanCrop;
  rotation: RotationKind;
  label: string;
  sublabel: string;
  is_current: boolean;
  /** Rango del modelo (punto 2) con el clima de 2009–2023. null = "Missing data" */
  yield_bu_ac: Range | null;
  income_usd_ac: Range | null;
  /** 0..1 por prioridad; null = no se puede puntuar (falta el dato) */
  scores: Record<Priority, number | null>;
  suggested_for: Priority[];
  confidence: Confidence;
  extrapolated: boolean;
  reasons: Reason[];
  range_driver: {text: string; years: number[] | null; source_label?: string} | null;
  /** fips de los gemelos de esta opción */
  twins: string[];
  twins_note: {text: string; range: Range | null; confidence: Confidence} | null;
  source: string;
  prototype: boolean;
}

export interface CropPlan {
  crop: PlanCrop;
  label: string;
  options: NextOption[];
}

export interface Twin {
  fips: string;
  name: string;
  state: string;
  centroid: [number, number];
  similar_on: string[];
  grew_crop_pct: Partial<Record<CropId, number>>;
  source: string;
  prototype: boolean;
}

export interface ExploreCrop {
  id: string;
  crop: CropId;
  label: string;
  twins: string[];
  range: Range;
  confidence: Confidence;
  text: string;
}

export interface NextData {
  fips: string;
  name: string;
  state: string;
  centroid: [number, number] | null;
  metric: 'yield_bu_ac';
  source: string;
  prototype: boolean;
  note: string | null;
  default_crop: PlanCrop;
  rotation_context: {
    items: Array<{from: CropId; to: CropId; label: string; pct: number}>;
    text?: Partial<Record<PlanCrop, string>>;
    source: string;
    prototype: boolean;
  };
  crops: Record<PlanCrop, CropPlan>;
  twins: Twin[];
  explore: ExploreCrop[];
  missing: Array<{what: string; why: string}>;
}

export const PRIORITY_LABEL: Record<Priority, string> = {
  risk: 'Lower risk in bad years',
  income: 'Higher income',
  soil: 'Soil health',
  water: 'Save water',
};
