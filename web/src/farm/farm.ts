/**
 * My Farm (F29): el perfil del campo que carga el productor.
 *
 * Se guarda solo en este navegador (localStorage). No sale a ningún servidor.
 * Lo que carga el productor se muestra siempre como "Your data"; lo que sale de la NASA y el USDA, con su fuente.
 */
import NEXT_AVAILABLE from "../map/next-available.json";
import GLOBE from "../map/globe-data.json";
import USDA from "./usda-prices.json";
import { POSTAL_BY_FIPS } from "../data/states";
import type {
  NextData,
  NextOption,
  PlanCrop,
  Priority,
  Range,
  RotationKind,
} from "../next/types";

export type FarmCrop =
  "corn" | "soy" | "wheat" | "oats" | "alfalfa" | "hay" | "other";

export const FARM_CROPS: FarmCrop[] = [
  "corn",
  "soy",
  "wheat",
  "oats",
  "alfalfa",
  "hay",
  "other",
];
export const FARM_CROP_LABEL: Record<FarmCrop, string> = {
  corn: "Corn",
  soy: "Soybeans",
  wheat: "Wheat",
  oats: "Oats",
  alfalfa: "Alfalfa",
  hay: "Hay",
  other: "Other",
};

/** Las tres campañas que se piden: la última cosechada y las dos anteriores */
export const FARM_YEARS = [2023, 2024, 2025];

export interface Farm {
  version: 1;
  name: string;
  fips: string;
  acres: number | null;
  /** cultivo de cada campaña (FARM_YEARS); null = no lo cargó */
  seasons: Record<string, FarmCrop | null>;
  plan: PlanCrop;
  priorities: Priority[];
  /** precio ($/bu) y costo operativo ($/acre) propios; null = se usa el del USDA */
  price: Record<PlanCrop, number | null>;
  cost: Record<PlanCrop, number | null>;
  saved_at: string;
}

const KEY = "fieldrewind.farm.v1";

/** Límites para no guardar valores imposibles */
export const LIMITS = {
  acres: [1, 200000] as const,
  price: { corn: [1, 20], soy: [3, 40] } as Record<
    PlanCrop,
    readonly [number, number]
  >,
  cost: [20, 2000] as const,
  name: 60,
};

export function loadFarm(): Farm | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const f = JSON.parse(raw) as Farm;
    return f && f.version === 1 && COUNTY_BY_FIPS[f.fips] ? f : null;
  } catch {
    return null;
  }
}

export function saveFarm(f: Farm): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(f));
    window.dispatchEvent(new Event("fieldrewind:farm"));
    return true;
  } catch {
    return false;
  }
}

export function clearFarm(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("fieldrewind:farm"));
  } catch {
    /* sin almacenamiento: no hay nada que borrar */
  }
}

// ------------------------------------------------------------------ condados con modelo

export interface CountyOption {
  fips: string;
  name: string;
  state: string;
  label: string;
}

const names = Object.fromEntries(
  (GLOBE as { counties: { id: string; name: string }[] }).counties.map((c) => [
    c.id,
    c.name,
  ]),
);

/** Solo los condados que tienen Next season (el modelo de rinde), en los estados con `model: true` */
export const FARM_COUNTIES: CountyOption[] = (NEXT_AVAILABLE as string[])
  .map((fips) => {
    const name = names[fips] ?? fips;
    const state = POSTAL_BY_FIPS[fips.slice(0, 2)] ?? "";
    return { fips, name, state, label: `${name} County, ${state}` };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

export const COUNTY_BY_FIPS: Record<string, CountyOption> = Object.fromEntries(
  FARM_COUNTIES.map((c) => [c.fips, c]),
);

// ------------------------------------------------------------------ precio y costo

export interface PriceCost {
  price: number;
  cost: number;
  /** de dónde salió cada uno */
  priceFrom: "you" | "usda";
  costFrom: "you" | "usda";
  years: string | null;
}

type UsdaTable = Record<
  string,
  Partial<Record<PlanCrop, { price: number; cost: number; years: string }>>
>;

export function usdaPriceCost(fips: string, crop: PlanCrop) {
  return (USDA as UsdaTable)[fips.slice(0, 2)]?.[crop] ?? null;
}

export function priceCost(farm: Farm, crop: PlanCrop): PriceCost | null {
  const u = usdaPriceCost(farm.fips, crop);
  const price = farm.price[crop] ?? u?.price ?? null;
  const cost = farm.cost[crop] ?? u?.cost ?? null;
  if (price === null || cost === null) return null;
  return {
    price,
    cost,
    priceFrom: farm.price[crop] !== null ? "you" : "usda",
    costFrom: farm.cost[crop] !== null ? "you" : "usda",
    years: u?.years ?? null,
  };
}

/** Ingreso sobre costos operativos por acre con el precio y el costo del productor (o del USDA) */
export function farmIncome(
  yieldRange: Range | null,
  pc: PriceCost | null,
): Range | null {
  if (!yieldRange || !pc) return null;
  const f = (v: number) => Math.round(v * pc.price - pc.cost);
  return {
    p10: f(yieldRange.p10),
    median: f(yieldRange.median),
    p90: f(yieldRange.p90),
  };
}

// ------------------------------------------------------------------ lo que el campo hace

/** La campaña más reciente cargada */
export function lastSeason(
  farm: Farm,
): { year: number; crop: FarmCrop } | null {
  for (const y of [...FARM_YEARS].reverse()) {
    const c = farm.seasons[String(y)];
    if (c) return { year: y, crop: c };
  }
  return null;
}

/** Qué opción del modelo es la del productor: sembrar lo mismo que el año pasado, rotar maíz/soja o su mezcla */
export function farmRotation(farm: Farm): RotationKind {
  const last = lastSeason(farm)?.crop;
  if (!last) return "actual";
  if (last === farm.plan) return "continuo";
  if (
    (last === "corn" && farm.plan === "soy") ||
    (last === "soy" && farm.plan === "corn")
  )
    return "rotado";
  return "actual";
}

export function farmOption(data: NextData, farm: Farm): NextOption | null {
  const kind = farmRotation(farm);
  return (
    data.crops[farm.plan]?.options.find((o) => o.rotation === kind) ?? null
  );
}

/** Cómo viene rotando, en palabras */
export function rotationSummary(farm: Farm): string {
  const seq = FARM_YEARS.map((y) => farm.seasons[String(y)]).filter(
    Boolean,
  ) as FarmCrop[];
  if (seq.length < 2) return "Add your last seasons to see your rotation.";
  const alternates = seq.every(
    (c, i) =>
      i === 0 ||
      (c !== seq[i - 1] &&
        (c === "corn" || c === "soy") &&
        (seq[i - 1] === "corn" || seq[i - 1] === "soy")),
  );
  if (alternates) return "You alternate corn and soybeans.";
  if (seq.every((c) => c === seq[0]))
    return `${FARM_CROP_LABEL[seq[0]]} every year.`;
  return `${seq.map((c) => FARM_CROP_LABEL[c]).join(", then ")}.`;
}

export const ROTATION_LABEL: Record<RotationKind, string> = {
  actual: "Your county's usual mix",
  rotado: "Rotate",
  continuo: "Repeat the crop",
};

export function emptyFarm(): Farm {
  return {
    version: 1,
    name: "",
    fips: "19169",
    acres: null,
    seasons: Object.fromEntries(FARM_YEARS.map((y) => [String(y), null])),
    plan: "corn",
    priorities: ["risk"],
    price: { corn: null, soy: null },
    cost: { corn: null, soy: null },
    saved_at: "",
  };
}
