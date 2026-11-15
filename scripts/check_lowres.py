#!/usr/bin/env python3
"""Cuenta, por estado, cuántos condados tienen mapa del CDL (30 m o 150 m) y si les falta algún año o PNG.

Uso: python3 scripts/check_lowres.py [--estado 17]   (solo biblioteca estándar)
"""
import argparse, json
from pathlib import Path

DATOS = Path(__file__).resolve().parents[1] / "web" / "public" / "data"
ESTADOS = {"17": "IL", "18": "IN", "19": "IA", "20": "KS", "27": "MN", "29": "MO", "31": "NE",
           "38": "ND", "39": "OH", "46": "SD", "55": "WI"}

ap = argparse.ArgumentParser()
ap.add_argument("--estado")
a = ap.parse_args()
tot = [0, 0]
for cod, pos in ESTADOS.items():
    if a.estado and a.estado != cod:
        continue
    n = con = 0
    faltan = []
    for p in sorted((DATOS / "county").glob(f"{cod}*.json")):
        n += 1
        r = json.loads(p.read_text()).get("raster")
        if not r:
            faltan.append(p.stem)
            continue
        miss = [y for y in r["years"] if not (DATOS.parent / r["path"].replace("{year}", str(y))).exists()]
        if miss or len(r["years"]) < 11:
            faltan.append(f"{p.stem}(años {len(r['years'])}/11{', PNG faltan' if miss else ''})")
        con += 1
    tot[0] += con; tot[1] += n
    print(f"{pos} ({cod}): {con}/{n} con mapa" + (f" · revisar: {', '.join(faltan[:8])}{' …' if len(faltan) > 8 else ''}" if faltan else ""))
print(f"Total: {tot[0]}/{tot[1]}")
