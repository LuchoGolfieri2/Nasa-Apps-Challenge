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
  { name: "NASS prices and ERS costs", agency: "USDA", gives: "Crop prices and operating costs per acre", where: "Income in Next season", detail: "State price · Heartland costs · median 2021–2025" },
  { name: "SSURGO soil survey (NRCS)", agency: "USDA", gives: "Soil drainage, productivity and organic carbon", where: "Counties like yours", detail: "Soil map units, averaged per county" },
  { name: "POWER", agency: "NASA", gives: "Heat and rain by year", where: "Yield model, risks in bad years, county history", detail: "0.5° · 2009–2025" },
  { name: "GPM IMERG", agency: "NASA", gives: "Rain averaged over each county", where: "Counties like yours", detail: "0.1° · median 2009–2023" },
  { name: "HLS Landsat and Sentinel-2", agency: "NASA", gives: "In-season crop guess, before USDA's map", where: "County history, demo fields", detail: "30 m · 2025 season · 10 demo fields" },
  { name: "MODIS greenness (NDVI)", agency: "NASA", gives: "How green the crops got each season", where: "County history (vigor, not yield)", detail: "MOD13Q1 · ~1 km · 2015–2024 · 2025 left out" },
  { name: "SMAP soil water", agency: "NASA", gives: "Water in the root zone, against a usual year", where: "County history", detail: "L4 · 9 km · April–September · 2015–2025" },
  { name: "FAO GAEZ climate scenario", agency: "Other", gives: "How suited each county's climate is for each crop, now and in 2041–2070", where: "County history (climate outlook)", detail: "RCP8.5 scenario, not a forecast" },
  { name: "Blue Marble (GIBS)", agency: "NASA", gives: "Satellite image of the Earth", where: "Globe", detail: "Background imagery" },
  { name: "Census county boundaries", agency: "Other", gives: "County and state outlines", where: "Globe, maps", detail: "US Census Bureau" },
];

export const NOT_YET: Array<{ name: string; why: string }> = [];

export const NASA_USDA_COUNT = DATASETS.filter((d) => d.agency !== "Other").length;
