/**
 * Fuentes que usa la app hoy. Solo lo que de verdad está cargado; lo que falta va en NOT_YET.
 * Si se suma un dataset, agregalo acá: el contador de la cabecera se actualiza solo.
 */
export interface Dataset {
  name: string;
  agency: "NASA" | "USDA" | "Other";
  gives: string;
  where: string;
  detail: string;
}

export const DATASETS: Dataset[] = [
  { name: "Cropland Data Layer (CDL)", agency: "USDA", gives: "What was planted, field by field", where: "County history map, crop race, rotations", detail: "30 m · 2015–2025" },
  { name: "NASS Quick Stats", agency: "USDA", gives: "County yield", where: "Yield model, county history", detail: "County · 2009–2023" },
  { name: "SSURGO soil survey (NRCS)", agency: "USDA", gives: "Soil drainage, productivity and organic carbon", where: "Counties like yours", detail: "Soil map units, averaged per county" },
  { name: "POWER", agency: "NASA", gives: "Heat and rain by year", where: "Yield model, risks in bad years, county history", detail: "0.5° · 2009–2025" },
  { name: "GPM IMERG", agency: "NASA", gives: "Rain averaged over each county", where: "Counties like yours", detail: "0.1° · median 2009–2023" },
  { name: "Blue Marble (GIBS)", agency: "NASA", gives: "Satellite image of the Earth", where: "Globe", detail: "Background imagery" },
  { name: "Census county boundaries", agency: "Other", gives: "County and state outlines", where: "Globe, maps", detail: "US Census Bureau" },
];

export const NOT_YET: Array<{ name: string; why: string }> = [
  { name: "NASA MODIS greenness (NDVI)", why: "Not loaded yet. The county history shows \"Missing data\" in its place." },
  { name: "NASA SMAP soil water", why: "Not loaded yet. The county history shows \"Missing data\" in its place." },
  { name: "Production costs and prices", why: "Not loaded yet, so \"Higher income\" can't be scored." },
];

export const NASA_USDA_COUNT = DATASETS.filter((d) => d.agency !== "Other").length;
