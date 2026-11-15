"""Argentina en el globo, igual que los estados de EE. UU. (pedido del 15/11).

Las 5 provincias de la región pampeana entran como "estados" y sus 219 departamentos como "condados":
se encienden en el globo, al tocar una provincia la cámara baja y aparecen sus departamentos pintados con
la misma variable que los condados, y cada departamento abre su tarjeta y su ficha (#/depto/<id>).

Entradas (ya en el repo):
  web/public/data/argentina/departamentos.geojson  polígonos (scripts/build_argentina.py)
  web/public/data/argentina/depto/<id>.json        rindes del MAGyP en bu/ac
  data/fieldshift_final/argentina.zip              rendimiento_ar.csv: superficie sembrada por cultivo (MAGyP)

Salida: web/src/map/globe-argentina.json
  provinces    [{id (INDEC, 2 dígitos), postal, name, centroid, bounds, geometry}]
  departments  [{id (id_depto), name, state, centroid, bounds, geometry,
                 stat: {corn_bu_ac, corn_years, history: "ar", zone}}]
  density      {id_depto: {corn, soy, wheat}}  % de la superficie del departamento sembrada (MAGyP)

Mismas reglas que EE. UU.: el color del rinde es la media 2021–2025 (campañas 2020/21 a 2024/25) del maíz;
sin dato queda null ("Missing data"), nunca 0. Los ids INDEC (06, 14, 30, 42, 82) no chocan con los FIPS
de los 11 estados. Requiere shapely y pyproj.

Uso: python3 scripts/build_globe_argentina.py
"""
from __future__ import annotations

import csv
import io
import json
import zipfile
from collections import defaultdict
from pathlib import Path

from pyproj import Geod
from shapely.geometry import mapping, shape
from shapely.ops import unary_union

RAIZ = Path(__file__).resolve().parents[1]
AR = RAIZ / "web" / "public" / "data" / "argentina"
ZIP = RAIZ / "data" / "fieldshift_final" / "argentina.zip"
SALIDA = RAIZ / "web" / "src" / "map" / "globe-argentina.json"
ANIOS = range(2021, 2026)  # igual que el color de los condados de EE. UU. (media 2021–2025)
PROVINCIAS = {"06": ("BA", "Buenos Aires"), "14": ("CB", "Córdoba"), "30": ("ER", "Entre Ríos"),
              "42": ("LP", "La Pampa"), "82": ("SF", "Santa Fe")}
CULTIVO = {"maiz": "corn", "soja": "soy", "trigo": "wheat"}
GEOD = Geod(ellps="WGS84")


def r4(x: float) -> float:
    return round(x, 4)


def rnd(geom, nd=4):
    """Redondea coordenadas para que el JSON pese menos."""
    g = mapping(geom)

    def walk(c):
        return [walk(x) for x in c] if isinstance(c[0], (list, tuple)) else [round(c[0], nd), round(c[1], nd)]

    return {"type": g["type"], "coordinates": walk(g["coordinates"])}


def caja(geom):
    x0, y0, x1, y1 = geom.bounds
    return [[r4(x0), r4(y0)], [r4(x1), r4(y1)]]


def main() -> None:
    feats = json.loads((AR / "departamentos.geojson").read_text(encoding="utf-8"))["features"]

    # superficie sembrada (MAGyP), media de las campañas 2021–2025 con dato
    sembrada: dict[tuple[str, str], list[float]] = defaultdict(list)
    with zipfile.ZipFile(ZIP) as z:
        with z.open("argentina/datos/rendimiento_ar.csv") as f:
            for r in csv.DictReader(io.TextIOWrapper(f, encoding="utf-8")):
                if int(r["anio"]) in ANIOS and r["cultivo"] in CULTIVO and r["sup_sembrada_ha"]:
                    sembrada[(r["id_depto_indec"].zfill(5), CULTIVO[r["cultivo"]])].append(float(r["sup_sembrada_ha"]))

    deptos, density, por_prov = [], {}, defaultdict(list)
    for f in feats:
        p = f["properties"]
        idd = p["id_depto"]
        geom = shape(f["geometry"])
        prov = idd[:2]
        por_prov[prov].append(geom)
        ficha = json.loads((AR / "depto" / f"{idd}.json").read_text(encoding="utf-8"))
        maiz = [y["corn"]["bu_ac"] for y in (ficha["yields"] or []) if y["year"] in ANIOS and y.get("corn")]
        c = geom.representative_point() if not geom.centroid.within(geom) else geom.centroid
        deptos.append({
            "id": idd, "name": p["name"], "state": prov,
            "centroid": [r4(c.x), r4(c.y)], "bounds": caja(geom), "geometry": rnd(geom),
            "stat": {"corn_bu_ac": round(sum(maiz) / len(maiz)) if maiz else None,
                     "corn_years": len(maiz), "history": "ar", "zone": p["zone"]},
        })
        area_ha = abs(GEOD.geometry_area_perimeter(geom)[0]) / 10_000
        d = {}
        for cult in CULTIVO.values():
            v = sembrada.get((idd, cult))
            d[cult] = round(100 * (sum(v) / len(v)) / area_ha, 1) if v and area_ha else None
        if any(x is not None for x in d.values()):
            density[idd] = d

    provincias = []
    for prov, geoms in sorted(por_prov.items()):
        u = unary_union(geoms).buffer(0.002).buffer(-0.002).simplify(0.01, preserve_topology=True)
        postal, nombre = PROVINCIAS[prov]
        c = u.representative_point() if not u.centroid.within(u) else u.centroid
        provincias.append({"id": prov, "postal": postal, "name": nombre, "centroid": [r4(c.x), r4(c.y)],
                           "bounds": caja(u), "geometry": rnd(u, 3)})

    out = {
        "meta": {"source": "MAGyP (yield and planted area) · Georef API (boundaries)",
                 "yield": "Corn yield, mean of the 2020/21–2024/25 seasons, bu/acre (MAGyP)",
                 "density": "Share of the department's area planted to the crop, %, mean 2020/21–2024/25 (MAGyP)"},
        "provinces": provincias, "departments": deptos, "density": density,
    }
    SALIDA.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    con = sum(1 for d in deptos if d["stat"]["corn_bu_ac"] is not None)
    print(f"{len(provincias)} provincias, {len(deptos)} departamentos ({con} con rinde de maíz 2021–2025), "
          f"{len(density)} con superficie sembrada · {SALIDA.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
