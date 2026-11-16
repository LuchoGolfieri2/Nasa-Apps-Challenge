import { dataUrl } from "../data/load";

/** Contrato de docs/argentina-front.md (salida de scripts/build_argentina.py). Clave: id_depto (INDEC). */

export type Zone = "dentro" | "cerca" | "fuera";
export type ArCrop = "corn" | "soy" | "wheat";

export interface ArIndex {
  departments: number;
  zones: Record<Zone, { label: string; color_hint: "in" | "near" | "out"; departments: number }>;
  by_province: Record<string, Partial<Record<Zone, number>>>;
  median_ratio_ar_us_by_zone: Record<Zone, Record<ArCrop, number | null>>;
  headline: string;
  note: string;
  sources: { id: string; name: string; gives: string; resolution: string; period: string }[];
}

export interface ArFeature {
  type: "Feature";
  properties: {
    id_depto: string;
    name: string;
    province: string;
    zone: Zone;
    n_out_of_range: number;
    analog_name: string | null;
    has_climate: boolean;
    has_yield: boolean;
    ratio_corn: number | null;
    ratio_soy: number | null;
    ratio_wheat: number | null;
  };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
}

export interface YieldCompare {
  ar_median: { kg_ha: number; bu_ac: number };
  us_analogs: { p10: number; median: number; p90: number };
  us_analogs_kg_ha: { p10: number; median: number; p90: number };
  ratio_ar_us: number;
  percentile_in_us: number;
  n_years_ar: number;
  n_obs_us: number;
  text: string;
  source: string;
}

type KgBu = { kg_ha: number; bu_ac: number } | null;

export interface ArDept {
  id_depto: string;
  name: string;
  province: string;
  zone: Zone;
  zone_label: string;
  zone_text: string;
  out_of_range: { id: string; label: string }[];
  radiation_diff_mj_m2_day: number | null;
  prediction: null;
  prediction_note: string;
  analogs: { fips: string; name: string; state: string; centroid: [number, number] }[];
  yield_compare: Partial<Record<ArCrop, YieldCompare>> | null;
  yields: ({ year: number; campaign: string } & Partial<Record<ArCrop, KgBu>>)[] | null;
  climate:
    | {
        year: number;
        campaign: string;
        season_rain_mm: number | null;
        season_gdd: number | null;
        season_water_balance_mm: number | null;
        january_rain_mm: number | null;
        january_max_temp_c: number | null;
        february_rain_mm: number | null;
      }[]
    | null;
  climate_note: string | null;
  soil: Record<string, number | null> | null;
  soil_analog: Record<string, number | null> | null;
  season_months: string;
  sources: string[];
}

const cache = new Map<string, Promise<unknown>>();
function getJson<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(dataUrl(path)).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export const loadArIndex = () => getJson<ArIndex>("data/argentina/index.json");
export const loadArShapes = () =>
  getJson<{ type: "FeatureCollection"; features: ArFeature[] }>("data/argentina/departamentos.geojson");
export const loadArDept = (id: string) => getJson<ArDept>(`data/argentina/depto/${id}.json`);

export const CROP_LABEL: Record<ArCrop, string> = { corn: "Corn", soy: "Soybeans", wheat: "Wheat" };
export const ZONE_SHORT: Record<Zone, string> = {
  dentro: "Within U.S. range",
  cerca: "Close to U.S. range",
  fuera: "Outside U.S. range",
};
