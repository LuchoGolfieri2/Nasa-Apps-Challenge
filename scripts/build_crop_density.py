"""Densidad de cada cultivo por condado para el globo (pantalla 1): % de la superficie del condado.

Fuente: USDA NASS Cropland Data Layer (CDL), estadísticas por condado del servicio CropScape
(GetCDLStat, sin clave). Una consulta por condado de globe-data.json.

- Lo bajado queda tal cual en data/raw/cultivos/cdl_stat/<anio>/CDL_<anio>_<fips>.csv; si ya está, no se vuelve a bajar.
- Salida: web/src/map/crop-density.json → {"year", "source", "crops", "counties": {fips: {crop: pct}}}.
- pct = acres de la clase / acres de todas las clases del condado × 100 (incluye agua y zonas urbanas).
- Doble cultivo trigo de invierno/soja (clase 26) suma a trigo y a soja: ese lote tiene los dos cultivos en el año.
- Sin archivo o sin acres: el condado no aparece (el globo escribe "Missing data"). Nunca 0 inventado.

Uso: python scripts/build_crop_density.py [--year 2025]
Solo biblioteca estándar.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
GLOBO = RAIZ / "web" / "src" / "map" / "globe-data.json"
SALIDA = RAIZ / "web" / "src" / "map" / "crop-density.json"
SERVICIO = "https://nassgeodata.gmu.edu/axis2/services/CDLService/GetCDLStat?year={anio}&fips={fips}&format=csv"

# id del front (src/ui/crops.ts) → clases del CDL que suman a ese cultivo
CLASES = {
    "corn": [1],
    "soy": [5, 26],
    "wheat": [24, 26],
    "oats": [28],
    "alfalfa": [36],
    "hay": [37],
}
NOMBRES = {
    "corn": "Corn",
    "soy": "Soybeans",
    "wheat": "Winter wheat",
    "oats": "Oats",
    "alfalfa": "Alfalfa",
    "hay": "Other hay",
}


def bajar(url: str, intentos: int = 4) -> bytes:
    for i in range(intentos):
        try:
            with urllib.request.urlopen(url, timeout=90) as r:
                return r.read()
        except Exception:  # el servidor de CropScape a veces corta: se reintenta con espera
            if i == intentos - 1:
                raise
            time.sleep(2 * (i + 1))
    raise RuntimeError("sin respuesta")


def archivo_condado(anio: int, fips: str, carpeta: Path) -> Path | None:
    destino = carpeta / f"CDL_{anio}_{fips}.csv"
    if destino.exists() and destino.stat().st_size > 0:
        return destino
    try:
        xml = bajar(SERVICIO.format(anio=anio, fips=fips)).decode("utf-8", "replace")
        m = re.search(r"<returnURL>(.*?)</returnURL>", xml)
        if not m:
            print(f"  {fips}: el servicio no devolvió archivo", file=sys.stderr)
            return None
        destino.write_bytes(bajar(m.group(1)))
        return destino
    except Exception as e:
        print(f"  {fips}: falló la descarga ({e})", file=sys.stderr)
        return None


def porcentajes(ruta: Path) -> dict[str, float] | None:
    texto = ruta.read_text(encoding="utf-8", errors="replace")
    acres: dict[int, float] = {}
    for fila in csv.reader(io.StringIO(texto)):
        if len(fila) < 4 or not fila[0].strip().isdigit():
            continue
        acres[int(fila[0])] = acres.get(int(fila[0]), 0.0) + float(fila[3])
    total = sum(acres.values())
    if total <= 0:
        return None
    return {c: round(sum(acres.get(k, 0.0) for k in ks) / total * 100, 1) for c, ks in CLASES.items()}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2025)
    anio = ap.parse_args().year

    globo = json.loads(GLOBO.read_text(encoding="utf-8"))
    fips = sorted(c["id"] for c in globo["counties"])
    carpeta = RAIZ / "data" / "raw" / "cultivos" / "cdl_stat" / str(anio)
    carpeta.mkdir(parents=True, exist_ok=True)

    with ThreadPoolExecutor(max_workers=6) as pool:
        rutas = dict(zip(fips, pool.map(lambda f: archivo_condado(anio, f, carpeta), fips)))

    condados: dict[str, dict[str, float]] = {}
    for f, ruta in rutas.items():
        p = porcentajes(ruta) if ruta else None
        if p:
            condados[f] = p
    faltan = [f for f in fips if f not in condados]

    SALIDA.write_text(
        json.dumps(
            {
                "year": anio,
                "source": f"USDA NASS Cropland Data Layer {anio} (CropScape county statistics)",
                "measure": "Share of the county's area planted to the crop, %",
                "crops": NOMBRES,
                "counties": condados,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"Densidad de cultivos {anio}: {len(condados)} de {len(fips)} condados -> {SALIDA.relative_to(RAIZ)}")
    if faltan:
        print(f"Sin dato ({len(faltan)}): {', '.join(faltan)}")


if __name__ == "__main__":
    main()
