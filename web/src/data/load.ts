import type { County } from "./types";

/** Ruta de un archivo de datos estático, respetando la base del sitio. */
export function dataUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\//, "");
}

const countyCache = new Map<string, Promise<County>>();

/** Ficha del condado. Se guarda la promesa: si "See more" ya la pidió, la historia no espera de nuevo. */
export function loadCounty(fips: string): Promise<County> {
  let p = countyCache.get(fips);
  if (!p) {
    p = fetch(dataUrl(`data/county/${fips}.json`)).then((res) => {
      if (!res.ok) throw new Error(`No county file for ${fips} (${res.status})`);
      return res.json() as Promise<County>;
    });
    p.catch(() => countyCache.delete(fips)); // un error no queda guardado: se reintenta al volver
    countyCache.set(fips, p);
  }
  return p;
}

/** Empieza a bajar la ficha antes de abrir la historia (la usa "See more" del mapa). */
export function prefetchCounty(fips: string): void {
  loadCounty(fips).catch(() => {});
}
