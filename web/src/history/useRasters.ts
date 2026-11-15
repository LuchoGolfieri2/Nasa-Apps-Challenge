import { useEffect, useRef, useState } from "react";
import { dataUrl } from "../data/load";
import type { RasterInfo } from "../data/types";

export type RasterStatus = "loading" | "ok" | "error";

export interface Rasters {
  status: Record<number, RasterStatus>;
  /** Años ya resueltos (cargados o fallados). */
  settled: number;
  total: number;
  ready: boolean;
  /** Índice de clase de cada píxel del año, o null si no cargó. */
  get: (year: number) => Uint8Array | null;
}

/** Lee un PNG del CDL y devuelve el índice de clase de cada píxel (gris / gray_step). */
async function decode(url: string, info: RasterInfo): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: "none" });
  if (bmp.width !== info.width || bmp.height !== info.height) throw new Error(`Unexpected raster size: ${url}`);
  const canvas = document.createElement("canvas");
  canvas.width = info.width;
  canvas.height = info.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const rgba = ctx.getImageData(0, 0, info.width, info.height).data;
  const out = new Uint8Array(info.width * info.height);
  const step = info.gray_step;
  for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = Math.round(rgba[p] / step);
  return out;
}

/**
 * Precarga los rasters de todos los años (F16). Un año que falla queda en "error" y no
 * frena a los demás: la pantalla lo muestra como "Missing data".
 */
export function useRasters(info: RasterInfo | null): Rasters {
  const store = useRef(new Map<number, Uint8Array>());
  const [status, setStatus] = useState<Record<number, RasterStatus>>({});

  useEffect(() => {
    store.current = new Map();
    if (!info) {
      setStatus({});
      return;
    }
    let cancelled = false;
    setStatus(Object.fromEntries(info.years.map((y) => [y, "loading" as RasterStatus])));
    for (const year of info.years) {
      decode(dataUrl(info.path.replace("{year}", String(year))), info)
        .then((classes) => {
          if (cancelled) return;
          store.current.set(year, classes);
          setStatus((s) => ({ ...s, [year]: "ok" }));
        })
        .catch(() => {
          if (!cancelled) setStatus((s) => ({ ...s, [year]: "error" }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [info]);

  const total = info ? info.years.length : 0;
  const settled = Object.values(status).filter((s) => s !== "loading").length;
  return {
    status,
    settled,
    total,
    ready: total > 0 && settled === total,
    get: (year) => store.current.get(year) ?? null,
  };
}
