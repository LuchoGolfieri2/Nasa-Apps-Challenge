#!/usr/bin/env python3
"""
build_lowres_cdl.py — Mapa del CDL en baja resolución (150 m) para los condados sin PNG lote a lote (F32 opción A).

Por cada condado de un estado y cada año 2015–2025:
  1. CropScape GetCDLFile devuelve la URL del GeoTIFF del condado (30 m, EPSG:5070). Se baja a memoria:
     NO se guarda en el repo (unos 2,5 MB por archivo) y se descarta al terminar.
  2. Con el ráster completo se calculan la superficie por cultivo, las transiciones (cultivo del año anterior
     -> cultivo del año) y las rotaciones comunes. Los porcentajes salen de los 30 m, no del mapa reducido.
  3. El ráster se reduce 5× (150 m) tomando la clase más frecuente de cada bloque de 5×5 píxeles, y se guarda
     como PNG con el mismo código de gris que el mapa de 30 m (índice de clase × 20).
  4. Se completan en web/public/data/county/<fips>.json: raster, crops_pct, area_by_crop, cropland_ac,
     transitions, headline y common_rotations. Lo que ya estaba (rinde, clima) no se toca.

Los condados que ya tienen el mapa de 30 m (Story, McLean, Sumner) se saltean.
Es idempotente: lo calculado queda en data/interim/cultivos/cdl_lowres/<fips>.json y no se vuelve a bajar.
Un año que falla queda fuera (el front lo muestra como "Missing data"); no se inventa nada.

Uso:  .venv/bin/python scripts/build_lowres_cdl.py --estado 17 [--workers 6] [--limite N]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.io import MemoryFile

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_front_data as bfd  # noqa: E402  (reusa clases, titulares y formato)

SALIDA = RAIZ / "web" / "public" / "data"
INTERIM = RAIZ / "data" / "interim" / "cultivos" / "cdl_lowres"
ANIOS = list(range(2015, 2026))
FACTOR = 5  # 30 m × 5 = 150 m
PIXEL_M = 30 * FACTOR
URL_ARCHIVO = "https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLFile?year={anio}&fips={fips}"
FUENTE = "USDA CDL · 150 m"
N_CLASES = len(bfd.CLASES)  # 0 nodata, 1 no agrícola, 2.. cultivos

# Código del CDL -> índice de clase del front (bfd.CLASES)
LUT = np.full(256, 1, dtype=np.uint8)  # por defecto: no agrícola (agua, urbano, pastizal, bosque…)
LUT[0] = 0
LUT[1:62] = 9  # cualquier otro cultivo (1–61)
for cdl, clase in {1: "corn", 5: "soy", 22: "wheat", 23: "wheat", 24: "wheat", 4: "sorghum",
                   26: "double_wheat_soy", 36: "alfalfa", 61: "fallow"}.items():
    LUT[cdl] = bfd.CLASES.index(clase)


def pedir(url: str, intentos: int = 3) -> bytes:
    for i in range(intentos):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                return r.read()
        except Exception:
            if i == intentos - 1:
                raise
            time.sleep(2 * (i + 1))
    raise RuntimeError("inalcanzable")


def bajar_anio(fips: str, anio: int) -> tuple[np.ndarray, list[float]]:
    xml = pedir(URL_ARCHIVO.format(anio=anio, fips=fips)).decode()
    m = re.search(r"<returnURL>(.*?)</returnURL>", xml)
    if not m:
        raise RuntimeError("CropScape no devolvió archivo")
    with MemoryFile(pedir(m.group(1))) as mf, mf.open() as r:
        return LUT[r.read(1)], [r.transform.c, r.transform.f]


def reducir(clases: np.ndarray) -> np.ndarray:
    """Clase más frecuente de cada bloque FACTOR×FACTOR. Sin dato si más de la mitad del bloque está fuera."""
    h, w = clases.shape
    ph, pw = -h % FACTOR, -w % FACTOR
    a = np.pad(clases, ((0, ph), (0, pw)), constant_values=0)
    bh, bw = a.shape[0] // FACTOR, a.shape[1] // FACTOR
    bloques = a.reshape(bh, FACTOR, bw, FACTOR).transpose(0, 2, 1, 3).reshape(bh, bw, FACTOR * FACTOR)
    cuentas = np.stack([(bloques == c).sum(-1) for c in range(N_CLASES)], axis=-1)
    out = cuentas[..., 1:].argmax(-1).astype(np.uint8) + 1
    out[cuentas[..., 0] * 2 > FACTOR * FACTOR] = 0
    return out


def procesar_condado(fips: str) -> dict | None:
    """Baja los años, escribe los PNG y devuelve lo que va a la ficha. Cacheado en interim."""
    cache = INTERIM / f"{fips}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    carpeta = SALIDA / "cdl" / fips
    carpeta.mkdir(parents=True, exist_ok=True)
    bajados: dict[int, tuple[np.ndarray, list[float]]] = {}
    for anio in ANIOS:
        try:
            bajados[anio] = bajar_anio(fips, anio)
        except Exception as e:  # año sin dato: queda afuera
            print(f"  {fips} {anio}: sin dato ({type(e).__name__})", flush=True)
    if not bajados:
        return None
    # CropScape recorta cada año a su propio rectángulo (cambia en uno o dos píxeles): todos los años se
    # ponen en el rectángulo que los contiene a todos; lo que queda afuera de un año es "sin dato".
    x0 = min(e[0] for _, e in bajados.values())
    y1 = max(e[1] for _, e in bajados.values())
    x_fin = max(e[0] + a.shape[1] * 30 for a, e in bajados.values())
    y_fin = min(e[1] - a.shape[0] * 30 for a, e in bajados.values())
    ancho, alto = int(round((x_fin - x0) / 30)), int(round((y1 - y_fin) / 30))
    por_anio, trans, previo = {}, {}, None
    tam = None
    for anio in sorted(bajados):
        a, (ex, ey) = bajados[anio]
        clases = np.zeros((alto, ancho), dtype=np.uint8)
        c0, r0 = int(round((ex - x0) / 30)), int(round((y1 - ey) / 30))
        clases[r0:r0 + a.shape[0], c0:c0 + a.shape[1]] = a
        peque = reducir(clases)
        tam = [peque.shape[1], peque.shape[0]]
        Image.fromarray(peque * bfd.PASO_GRIS, mode="L").save(carpeta / f"{anio}.png", optimize=True)
        por_anio[anio] = np.bincount(clases.ravel(), minlength=N_CLASES).tolist()
        if previo is not None and anio - 1 in por_anio:
            ambos = (previo >= 2) & (clases >= 2)
            par = np.bincount(previo[ambos].astype(np.int32) * N_CLASES + clases[ambos], minlength=N_CLASES**2)
            trans[anio] = par.tolist()
        previo = clases
    res = {"years": sorted(por_anio), "counts": por_anio, "pairs": trans, "size": tam, "origin": [x0, y1]}
    INTERIM.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(res))
    return res


def a_ficha(fips: str, res: dict, ficha: dict) -> dict:
    res = json.loads(json.dumps(res))  # claves de texto, igual que si vino del caché
    cultivos = bfd.CULTIVOS
    ids = {c: bfd.CLASES.index(c) for c in cultivos}
    anios = {}
    for a in res["years"]:
        cnt = res["counts"][str(a)]
        ha = {c: cnt[i] * 0.09 for c, i in ids.items()}
        total = sum(ha.values())
        if total <= 0:
            continue
        anios[a] = {
            "area_by_crop": {c: {"ha": int(round(ha[c])), "ac": int(round(ha[c] * bfd.HA_A_ACRES))} for c in cultivos},
            "crops_pct": {c: bfd.r1(100 * ha[c] / total) for c in cultivos},
            "cropland_ac": int(round(total * bfd.HA_A_ACRES)),
        }
    lista = sorted(anios)

    def pares(vec):
        m = np.array(vec).reshape(N_CLASES, N_CLASES)
        return {(bfd.CLASES[i], bfd.CLASES[j]): int(m[i, j]) for i in range(2, N_CLASES) for j in range(2, N_CLASES)}

    trans_anio, total_par = {}, {}
    for a, vec in res["pairs"].items():
        p = pares(vec)
        tot = sum(p.values())
        if tot == 0:
            continue
        top = sorted(p.items(), key=lambda kv: -kv[1])[:5]
        trans_anio[int(a)] = [{"from": f, "to": t, "pct": bfd.r1(100 * n / tot)} for (f, t), n in top]
        for k, n in p.items():
            total_par[k] = total_par.get(k, 0) + n
    gran = sum(total_par.values())
    comunes = [
        {"from": f, "to": t, "label": f"{bfd.ETIQUETAS[f].split(' (')[0]} → {bfd.ETIQUETAS[t].split(' (')[0]}",
         "pct": bfd.r1(100 * n / gran)}
        for (f, t), n in sorted(total_par.items(), key=lambda kv: -kv[1])[:5]
    ] if gran else []

    anom = bfd.leer_anomalias().get(fips)
    por_year = {y["year"]: y for y in ficha["years"]}
    for a in lista:
        y = por_year.get(a)
        if y is None:
            continue
        y.update(crops_pct=anios[a]["crops_pct"], area_by_crop=anios[a]["area_by_crop"],
                 cropland_ac=anios[a]["cropland_ac"], transitions=trans_anio.get(a))
        y["headline"] = bfd.titular(a, anios, trans_anio, y.get("weather"), anom)[:3] or y["headline"]
    ficha["raster"] = {
        "path": f"data/cdl/{fips}/{{year}}.png", "width": res["size"][0], "height": res["size"][1],
        "years": lista, "encoding": f"gray value = class index × {bfd.PASO_GRIS} (see meta.json classes)",
        "gray_step": bfd.PASO_GRIS, "crs": "EPSG:5070", "origin": res["origin"], "pixel_m": PIXEL_M,
        "source": FUENTE, "prototype": False,
    }
    ficha["common_rotations"] = {"items": comunes, "source": bfd.FUENTE_CDL, "prototype": False} if comunes else None
    fuente = f"{FUENTE} · {lista[0]}–{lista[-1]}"
    ficha["sources"] = [fuente] + [s for s in ficha["sources"] if not s.startswith("USDA CDL")]
    return ficha


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--estado", required=True, help="FIPS de 2 dígitos, p. ej. 17 = Illinois")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--limite", type=int, default=0, help="solo los primeros N condados (prueba)")
    args = ap.parse_args()

    fichas = sorted(p for p in (SALIDA / "county").glob(f"{args.estado}*.json"))
    pendientes = []
    for p in fichas:
        ficha = json.loads(p.read_text())
        if ficha.get("raster") and ficha["raster"].get("pixel_m") == 30:
            continue  # ya tiene el mapa lote a lote
        pendientes.append(p.stem)
    if args.limite:
        pendientes = pendientes[: args.limite]
    print(f"{len(pendientes)} condados del estado {args.estado}", flush=True)

    t0 = time.time()
    hechos = 0
    with ThreadPoolExecutor(args.workers) as ex:
        for fips, res in zip(pendientes, ex.map(procesar_condado, pendientes)):
            hechos += 1
            if res is None:
                print(f"{fips}: sin ningún año, queda como estaba", flush=True)
                continue
            ruta = SALIDA / "county" / f"{fips}.json"
            ficha = a_ficha(fips, res, json.loads(ruta.read_text()))
            ruta.write_text(json.dumps(ficha, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            print(f"[{hechos}/{len(pendientes)}] {fips} {ficha['name']}: {len(res['years'])} años, "
                  f"{res['size'][0]}×{res['size'][1]} px ({time.time() - t0:.0f} s)", flush=True)


if __name__ == "__main__":
    main()
