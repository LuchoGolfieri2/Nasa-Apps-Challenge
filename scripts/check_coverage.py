"""F38: verifica que cada condado marcado en el globo tenga sus datos, y al revés.

Cruza, por estado:
  - polígonos del globo        web/src/map/globe-data.json  (counties[].id)
  - fichas de historia         web/public/data/county/<fips>.json
  - Próxima campaña            web/public/data/next/<fips>.json
  - condados del modelo        backend/Datos/tabla_modelado.csv
  - cantidad oficial           página "Zonas de Field Shift" (15/11)

y busca: fichas o predicciones sin polígono, gemelos que apuntan a un condado sin polígono,
valores 0 en el color del globo (un faltante tiene que ser null) y estados con modelo sin polígonos.

Uso: python3 scripts/check_coverage.py   (sale con código 1 si encuentra un error)
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
GLOBO = RAIZ / "web" / "src" / "map" / "globe-data.json"
FICHAS = RAIZ / "web" / "public" / "data" / "county"
NEXT = RAIZ / "web" / "public" / "data" / "next"
TABLA = RAIZ / "backend" / "Datos" / "tabla_modelado.csv"

# Cantidad de condados por estado según "Zonas de Field Shift" (15/11); coincide con el Census 2024.
OFICIAL = {"19": ("IA", 99), "17": ("IL", 102), "18": ("IN", 92), "20": ("KS", 105), "27": ("MN", 87),
           "29": ("MO", 115), "31": ("NE", 93), "39": ("OH", 88), "46": ("SD", 66), "55": ("WI", 72),
           "38": ("ND", 53)}


def fips_de(carpeta: Path) -> set[str]:
    return {p.stem for p in carpeta.glob("*.json") if re.fullmatch(r"\d{5}", p.stem)}


def main() -> int:
    globo = json.loads(GLOBO.read_text(encoding="utf-8"))
    poly = {c["id"]: c for c in globo["counties"]}
    fichas, nexts = fips_de(FICHAS), fips_de(NEXT)
    with TABLA.open(encoding="utf-8") as f:
        modelo = {r["fips"].zfill(5) for r in csv.DictReader(f)}

    errores: list[str] = []
    print(f"{'estado':<7}{'oficial':>8}{'globo':>7}{'historia':>10}{'próxima':>9}{'modelo':>8}")
    for e, (postal, n) in OFICIAL.items():
        cuenta = [len({x for x in s if x[:2] == e}) for s in (poly, fichas, nexts, modelo)]
        print(f"{postal:<7}{n:>8}" + "".join(f"{c:>{w}}" for c, w in zip(cuenta, (7, 10, 9, 8))))
        if cuenta[0] not in (0, n):
            errores.append(f"{postal}: {cuenta[0]} polígonos, la cantidad oficial es {n}")
    total = [len(s) for s in (poly, fichas, nexts, modelo)]
    print(f"{'total':<7}{sum(n for _, n in OFICIAL.values()):>8}" + "".join(f"{c:>{w}}" for c, w in zip(total, (7, 10, 9, 8))))

    for nombre, conjunto in (("historia", fichas), ("Próxima campaña", nexts), ("modelo", modelo)):
        sin = sorted(conjunto - set(poly))
        if sin:
            errores.append(f"{len(sin)} condados con {nombre} sin polígono en el globo: {sin[:10]}")
    sin_next = sorted(modelo - nexts)
    if sin_next:
        errores.append(f"{len(sin_next)} condados del modelo sin archivo de Próxima campaña: {sin_next[:10]}")

    gemelos_rotos = set()
    for f in nexts:
        for g in re.findall(r'"fips":\s*"(\d{5})"', (NEXT / f"{f}.json").read_text(encoding="utf-8")):
            if g not in poly:
                gemelos_rotos.add(g)
    if gemelos_rotos:
        errores.append(f"gemelos que apuntan a condados sin polígono: {sorted(gemelos_rotos)[:10]}")

    ceros = [k for k, c in poly.items() for v in (c["stat"].get("corn_bu_ac"), c["stat"].get("season_rain_mm")) if v == 0]
    if ceros:
        errores.append(f"color del globo en 0 (tiene que ser null): {ceros[:10]}")

    sin_historia = sorted(k for k, c in poly.items() if not c["stat"].get("history"))
    # Avisos: no son errores, la app los muestra como "Missing data"
    print(f"\nEn el globo sin historia ({len(sin_historia)}; el globo dice 'Missing data: history not loaded'):")
    for k in sin_historia:
        motivo = "con modelo, pero sin datos de 2015–2025" if k in modelo else "fuera de la tabla del modelo"
        print(f"  {k} {poly[k]['name']} · {motivo}")
    nd = [e for e, (p, _) in OFICIAL.items() if p == "ND"]
    if not any(k[:2] in nd for k in poly):
        print("\nDakota del Norte: sin polígonos ni modelo (la entrega todavía no la trae).")

    print("\n" + ("Sin errores." if not errores else "Errores:\n  - " + "\n  - ".join(errores)))
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main())
