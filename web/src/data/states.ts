/**
 * Los estados de Field Rewind, en un solo lugar. Para sumar uno (por ejemplo Dakota del Norte cuando llegue
 * su entrega) se agrega una fila acá, con `model: true` cuando ya tiene salidas del modelo de rinde.
 * Lo usan el globo (globe.js), la ficha de Próxima campaña y los avisos de cobertura.
 * Los polígonos viven en `map/globe-data.json` (los arma scripts/build_globe_geo.py).
 */
export interface StateInfo {
  fips: string;
  postal: string;
  name: string;
  /** Tiene rango de rinde del modelo de ML y gemelos en `public/data/next/`. */
  model: boolean;
}

export const STATES: StateInfo[] = [
  { fips: "19", postal: "IA", name: "Iowa", model: true },
  { fips: "17", postal: "IL", name: "Illinois", model: true },
  { fips: "18", postal: "IN", name: "Indiana", model: true },
  { fips: "20", postal: "KS", name: "Kansas", model: true },
  { fips: "27", postal: "MN", name: "Minnesota", model: true },
  { fips: "29", postal: "MO", name: "Missouri", model: true },
  { fips: "31", postal: "NE", name: "Nebraska", model: true },
  { fips: "39", postal: "OH", name: "Ohio", model: true },
  { fips: "46", postal: "SD", name: "South Dakota", model: true },
  { fips: "55", postal: "WI", name: "Wisconsin", model: true },
  { fips: "38", postal: "ND", name: "North Dakota", model: false }, // 11.º estado: la entrega todavía no lo trae
];

export const POSTAL_BY_FIPS: Record<string, string> = Object.fromEntries(STATES.map((s) => [s.fips, s.postal]));
export const FIPS_BY_POSTAL: Record<string, string> = Object.fromEntries(STATES.map((s) => [s.postal, s.fips]));
export const STATE_NAME: Record<string, string> = Object.fromEntries(STATES.map((s) => [s.postal, s.name]));

const MODEL_NAMES = STATES.filter((s) => s.model).map((s) => s.name);
/** "Iowa, Illinois, … and Wisconsin": para los avisos de cobertura. */
export const MODEL_STATES_TEXT = MODEL_NAMES.slice(0, -1).join(", ") + " and " + MODEL_NAMES[MODEL_NAMES.length - 1];
