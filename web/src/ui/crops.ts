/*
  Clases de cultivo del front y sus colores.

  El orden de CLASS_ORDER es el índice de clase de los PNG del CDL
  (scripts/build_front_data.py, CLASES). No cambiarlo sin regenerar los datos.

  COLORES PROVISORIOS (son parte de F02). Los cinco cultivos principales pasan el validador
  de la skill dataviz sobre Verde noche #0F2A1D, comparando todos los pares:
  visión normal ΔE 19,3; daltonismo ΔE 7,0 (banda mínima: exige etiqueta de texto, que
  siempre está). Alfalfa, barbecho y "otros" son clases chicas, sin validar, y también
  van siempre con etiqueta.
*/
export const CLASS_ORDER = [
  "nodata",
  "non_ag",
  "corn",
  "soy",
  "wheat",
  "sorghum",
  "double_wheat_soy",
  "alfalfa",
  "fallow",
  "other",
] as const;

export type ClassId = (typeof CLASS_ORDER)[number];
export type CropId = Exclude<ClassId, "nodata" | "non_ag">;

export const CROPS: CropId[] = ["corn", "soy", "wheat", "sorghum", "double_wheat_soy", "alfalfa", "fallow", "other"];

export const CROP_COLOR: Record<CropId, string> = {
  corn: "#c98500",
  soy: "#199e70",
  wheat: "#c2255c",
  sorghum: "#7048e8",
  double_wheat_soy: "#339af0",
  alfalfa: "#a3b18a",
  fallow: "#6b4a2f",
  other: "#8c8f84",
};

/** Tierra sin cultivo dentro del condado: apenas más clara que el fondo. */
export const NON_AG_COLOR = "#173826";

export const CROP_LABEL: Record<CropId, string> = {
  corn: "Corn",
  soy: "Soybeans",
  wheat: "Wheat",
  sorghum: "Sorghum",
  double_wheat_soy: "Wheat + soybeans",
  alfalfa: "Alfalfa",
  fallow: "Fallow",
  other: "Other crops",
};

export const CROP_NOTE: Partial<Record<CropId, string>> = {
  double_wheat_soy: "Two crops in one year: winter wheat, then soybeans.",
  fallow: "Cropland left unplanted that year.",
};

export const CLASS_LABEL: Record<ClassId, string> = {
  nodata: "Outside the county",
  non_ag: "Not cropland",
  ...CROP_LABEL,
};
