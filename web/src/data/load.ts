import type { County } from "./types";

/** Ruta de un archivo de datos estático, respetando la base del sitio. */
export function dataUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}

export async function loadCounty(fips: string): Promise<County> {
  const res = await fetch(dataUrl(`data/county/${fips}.json`));
  if (!res.ok) throw new Error(`No county file for ${fips} (${res.status})`);
  return (await res.json()) as County;
}
