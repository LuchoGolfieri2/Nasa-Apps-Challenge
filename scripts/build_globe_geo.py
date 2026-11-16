#!/usr/bin/env python3
"""
build_globe_geo.py — Suma estados y condados nuevos a web/src/map/globe-data.json (el globo y el mapa de gemelos).

Hoy el globo tiene polígonos solo de IA, IL, IN y KS. Los condados de los otros estados (MN, MO, NE, OH, SD, WI y,
cuando llegue, ND) ya tienen datos del modelo en public/data/next/, pero sin polígono no se pueden pintar en el globo,
resaltar como gemelos ni elegir desde el mapa.

Entrada (la entrega "para_front" del equipo de datos; ver docs/datos-de-prueba.md):
  --condados  condados_eeuu.geojson   un Feature por condado (Polygon o MultiPolygon, EPSG:4326)
              propiedades: se aceptan fips | FIPS | GEOID | geoid, y condado | county | NAME | name
  --estados   estados_eeuu.csv        (opcional) nombre, FIPS y centro de cada estado

Qué hace:
  - Agrega los condados que todavía no están en globe-data.json. Los que ya están NO se tocan (ni polígono ni "stat").
  - Agrega los estados que faltan: el contorno es la unión de sus condados (necesita `shapely`; si no está, avisa).
  - Los condados nuevos entran con "stat" vacío (null = "Missing data"). Para llenarlo, después:

        python3 scripts/build_front_data.py        # rinde, clima y "stat" de cada condado (usa los nombres de este archivo)
        python3 scripts/build_crop_density.py      # % de cada cultivo (Color by)
        python3 scripts/build_next_json.py         # Próxima campaña y gemelos

    El orden importa: build_front_data.py toma el nombre de cada condado de globe-data.json.

No inventa nada: sin polígono o sin nombre, el condado se salta y se lista en la salida.
Es idempotente: correrlo dos veces no cambia nada.

Uso:
  python3 scripts/build_globe_geo.py --condados <ruta>/condados_eeuu.geojson [--estados <ruta>/estados_eeuu.csv] [--dry-run]
"""
from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
GLOBO = RAIZ / "web" / "src" / "map" / "globe-data.json"

# Mismo orden y nombres que web/src/data/states.ts
ESTADOS = {
    "19": "Iowa", "17": "Illinois", "18": "Indiana", "20": "Kansas", "27": "Minnesota", "29": "Missouri",
    "31": "Nebraska", "39": "Ohio", "46": "South Dakota", "55": "Wisconsin", "38": "North Dakota",
}
STAT_VACIO = {"corn_bu_ac": None, "corn_years": 0, "season_rain_mm": None, "history": None}


def prop(props: dict, *nombres: str):
    bajos = {k.lower(): v for k, v in props.items()}
    for n in nombres:
        if n.lower() in bajos and bajos[n.lower()] not in (None, ""):
            return bajos[n.lower()]
    return None


def anillos(geom: dict):
    """Todos los puntos [lon, lat] de un Polygon o MultiPolygon."""
    if geom["type"] == "Polygon":
        polys = [geom["coordinates"]]
    elif geom["type"] == "MultiPolygon":
        polys = geom["coordinates"]
    else:
        raise ValueError(f"geometría {geom['type']} no soportada")
    return [pt for poly in polys for ring in poly for pt in ring]


def bounds(geom: dict):
    pts = anillos(geom)
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return [[round(min(xs), 4), round(min(ys), 4)], [round(max(xs), 4), round(max(ys), 4)]]


def centro(geom: dict, lat_lon: tuple[float, float] | None):
    """Centroide: el del CSV si hay; si no, el centro de la caja (alcanza para etiquetas)."""
    if lat_lon:
        return [round(lat_lon[1], 4), round(lat_lon[0], 4)]
    (x0, y0), (x1, y1) = bounds(geom)
    return [round((x0 + x1) / 2, 4), round((y0 + y1) / 2, 4)]


def redondear(geom: dict, nd: int = 4) -> dict:
    def r(c):
        return [round(c[0], nd), round(c[1], nd)] if isinstance(c[0], (int, float)) else [r(x) for x in c]

    return {"type": geom["type"], "coordinates": r(geom["coordinates"])}


def km2_anillo(anillo: list) -> float:
    """Área aproximada de un anillo en km² (grados a km a la latitud media)."""
    lat = sum(p[1] for p in anillo) / len(anillo)
    k = 111.32 * 111.32 * math.cos(math.radians(lat))
    a = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(anillo, anillo[1:] + anillo[:1]))
    return abs(a) / 2 * k


def limpiar_contorno(geom: dict, min_km2: float = 1.0) -> dict:
    """Saca lo que la unión de condados deja entre condado y condado: los huecos (ningún estado de la zona tiene
    enclaves) y las astillas de menos de min_km2. Sin esto, el globo dibuja el borde de cada uno y quedan trazos
    blancos sueltos adentro del estado. Las islas grandes (Madeline, WI; Kelleys, OH) se quedan."""
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    partes = [[p[0]] for p in polys if km2_anillo(p[0]) >= min_km2]
    if not partes:  # nunca vaciar un estado: queda la parte más grande
        partes = [[max(polys, key=lambda p: km2_anillo(p[0]))[0]]]
    if len(partes) == 1:
        return {"type": "Polygon", "coordinates": partes[0]}
    return {"type": "MultiPolygon", "coordinates": partes}


def contorno_estado(geoms: list[dict]) -> dict | None:
    try:
        from shapely.geometry import mapping, shape
        from shapely.ops import unary_union
    except ImportError:
        return None
    # buffer(0.0005) pega bordes que quedaron separados por la simplificación; el simplify devuelve un contorno liviano
    u = unary_union([shape(g).buffer(0.0005) for g in geoms]).buffer(-0.0005).simplify(0.003)
    return limpiar_contorno(redondear(mapping(u)))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--condados", type=Path, required=True)
    ap.add_argument("--estados", type=Path)
    ap.add_argument("--globe", type=Path, default=GLOBO)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    g = json.loads(a.globe.read_text(encoding="utf-8"))
    tiene_c = {c["id"] for c in g["counties"]}
    tiene_e = {s["id"] for s in g["states"]}

    # centros por condado, si el CSV de condados los trae (lat/lon)
    centros: dict[str, tuple[float, float]] = {}
    nombres_estado = dict(ESTADOS)
    if a.estados:
        with a.estados.open(encoding="utf-8-sig") as f:
            for r in csv.DictReader(f):
                fe = str(prop(r, "fips_estado", "fips", "estado_fips", "statefp") or "").zfill(2)
                nom = prop(r, "nombre", "name", "estado_nombre")
                if fe in ESTADOS and nom:
                    nombres_estado[fe] = str(nom)

    fc = json.loads(a.condados.read_text(encoding="utf-8"))
    nuevos, saltados, por_estado = [], [], {}
    for ft in fc["features"]:
        props, geom = ft.get("properties", {}), ft.get("geometry")
        fips = prop(props, "fips", "geoid")
        nombre = prop(props, "condado", "county", "name", "namelsad")
        if fips is None:
            saltados.append(("?", "sin fips"))
            continue
        fips = str(fips).zfill(5)
        if fips[:2] not in ESTADOS:
            continue  # estados fuera de la zona (por si el archivo trae de más)
        por_estado.setdefault(fips[:2], []).append(geom)
        if fips in tiene_c:
            continue
        if not geom or not nombre:
            saltados.append((fips, "sin polígono" if not geom else "sin nombre"))
            continue
        lat, lon = prop(props, "lat_centroide", "lat", "centroid_lat"), prop(props, "lon_centroide", "lon", "centroid_lon")
        cc = (float(lat), float(lon)) if lat is not None and lon is not None else None
        geom = redondear(geom)
        nuevos.append({
            "id": fips,
            "name": str(nombre).replace(" County", ""),
            "state": fips[:2],
            "centroid": centro(geom, cc),
            "bounds": bounds(geom),
            "geometry": geom,
            "stat": dict(STAT_VACIO),
        })

    estados_nuevos = []
    for fe, geoms in por_estado.items():
        if fe in tiene_e:
            continue
        geoms = [x for x in geoms if x]
        cont = contorno_estado(geoms)
        if cont is None:
            print(f"AVISO: falta `shapely` (pip install shapely) para armar el contorno de {nombres_estado[fe]}; se salta.")
            continue
        estados_nuevos.append({
            "id": fe, "name": nombres_estado[fe], "centroid": centro(cont, None), "bounds": bounds(cont), "geometry": cont,
        })

    por_est = {}
    for n in nuevos:
        por_est[n["state"]] = por_est.get(n["state"], 0) + 1
    detalle = ", ".join(f"{k}: {v}" for k, v in sorted(por_est.items()))
    print(f"Condados nuevos: {len(nuevos)} ({detalle})")
    print(f"Estados nuevos: {[s['name'] for s in estados_nuevos]}")
    for fips, motivo in saltados:
        print(f"  salteado {fips}: {motivo}")
    if a.dry_run or not (nuevos or estados_nuevos):
        print("Sin cambios escritos." if not (nuevos or estados_nuevos) else "--dry-run: no se escribió nada.")
        return
    g["counties"].extend(sorted(nuevos, key=lambda c: c["id"]))
    g["states"].extend(estados_nuevos)
    a.globe.write_text(json.dumps(g, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Listo: {a.globe.relative_to(RAIZ) if a.globe.is_relative_to(RAIZ) else a.globe}")


if __name__ == "__main__":
    main()
