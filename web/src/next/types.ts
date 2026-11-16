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
  twins_note: {text: string | null; range: Range | null; confidence: Confidence} | null;
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
  /** rango de los gemelos × precio NASS del estado − costo operativo ERS; null si el estado no tiene precio */
  income_usd_ac?: Range | null;
}

/**
 * Predicción de la próxima campaña (15/11): una sola opción, sin elecciones del usuario. Para cada clima pasado
 * (2009–2023) gana la opción que más deja por acre; probability = años ganados / años con dato.
 */
export interface Prediction {
  option_id: string;
  crop: PlanCrop;
  probability: number;
  wins: number;
  seasons: number;
  years: number[];
  best_years: number[];
  others: Array<{option_id: string; wins: number; best_years: number[]}>;
  basis: 'income';
  method: string;
  source: string;
  prototype: boolean;
}

/** Mezcla esperada de cultivos (capas 1 y 2): % del terreno de maíz y soja, con rango (low/high = la mayoría de los años) */
export interface MixValue {
  pct: number;
  low: number | null;
  high: number | null;
}
export interface CropMix {
  season: number;
  basis: 'corn_soy_ground';
  years: number[];
  items: Array<{from: PlanCrop; to: PlanCrop} & MixValue>;
  corn_pct: MixValue;
  neighbors: string[];
  filled_from_neighbors: string[];
  confidence: {level: ConfidenceLevel; reason: string};
  method: string;
  source: string;
  prototype: boolean;
}
export interface ByWeather {
  years: number[];
  /** "<cultivo>_<rotación>" → rinde predicho por año de clima; null = el modelo no tiene ese año */
  yield_bu_ac: Record<string, Array<number | null>>;
  source: string;
  prototype: boolean;
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
  /** null = no se puede predecir (sin precio del estado para comparar maíz con soja) */
  prediction?: Prediction | null;
  /** Rinde de cada opción con el clima de cada año (My Farm, F40). Claves "corn_rotado"… alineadas con years */
  by_weather?: ByWeather | null;
  /** null = sin mapas del CDL recientes ni condados parecidos que los tengan */
  mix?: CropMix | null;
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
