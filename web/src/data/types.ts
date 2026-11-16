/*
  Tipos del contrato JSON del front (docs/front-end-plan.md §7 + spec §3).
  Regla: null = "Missing data". Un bloque con prototype: true lleva el sello "Prototype data".
  Mínimo necesario para la pantalla 2; quien tome F03 lo completa (next/<fips>.json, etc.).
*/
import type { CropId } from "../ui/crops";

export interface Sourced {
  source: string;
  prototype: boolean;
}

export interface Area {
  ha: number;
  ac: number;
}

export interface Transition {
  from: CropId;
  to: CropId;
  pct: number;
  label?: string;
}

export interface HeadlinePart {
  text: string;
  source: string;
}

export type VsUsual = "above" | "similar" | "below";

export interface YieldBlock extends Sourced {
  crops: Partial<Record<"corn" | "soy" | "wheat", { bu_ac: number; vs_usual: VsUsual | null; flag_nass: string | null }>>;
}

export interface WeatherBlock extends Sourced {
  season_rain_in: number;
  season_rain_mm: number;
  july_rain_in: number;
  july_rain_mm: number;
  july_tmax_f: number;
  july_tmax_c: number;
  days_over_86f_july: number;
  tags: string[];
  baseline_years: string;
}

export interface GreennessBlock extends Sourced {
  curve: [number, number][];
  peak: number;
}

export interface SoilWaterBlock extends Sourced {
  rootzone_anom_z: number;
  label: string;
}

export interface EconomicsBlock extends Sourced {
  /** Por cultivo: precio recibido (por estado), margen sobre costos operativos y costo total por acre (región Heartland del ERS). */
  crops: Partial<Record<"corn" | "soy" | "wheat", { price_usd_bu: number | null; margin_usd_ac: number | null; cost_usd_ac: number | null }>>;
}

/** Aptitud del clima (FAO GAEZ v4, 0 a 100): con el clima de 1981–2010 y con el escenario de 2041–2070. No es un pronóstico. */
export interface OutlookBlock extends Sourced {
  baseline: string;
  scenario: string;
  crops: Partial<
    Record<
      "corn" | "soy" | "wheat" | "oats" | "alfalfa",
      { suit_now: number; suit_future: number; attainable_bu_ac_now?: number; attainable_bu_ac_future?: number }
    >
  >;
}

export interface CountyYear {
  year: number;
  headline: HeadlinePart[];
  crops_pct: Record<CropId, number> | null;
  area_by_crop: Record<CropId, Area> | null;
  cropland_ac: number | null;
  transitions: Transition[] | null;
  yield: YieldBlock | null;
  greenness: GreennessBlock | null;
  weather: WeatherBlock | null;
  soil_water: SoilWaterBlock | null;
  economics?: EconomicsBlock | null;
}

export interface RasterInfo extends Sourced {
  /** Ruta con {year}, relativa a la raíz del sitio. */
  path: string;
  width: number;
  height: number;
  years: number[];
  gray_step: number;
  pixel_m: number;
  /** Esquina de arriba a la izquierda del ráster, en metros (EPSG:5070). Ubica el mapa sobre el globo. */
  origin?: [number, number];
}

export interface County {
  fips: string;
  name: string;
  state: string;
  state_name: string;
  summary: { text: string; basis: string } | null;
  raster: RasterInfo | null;
  years: CountyYear[];
  common_rotations: (Sourced & { items: Transition[] }) | null;
  outlook?: OutlookBlock | null;
  sources: string[];
}
