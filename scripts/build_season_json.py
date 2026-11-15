#!/usr/bin/env python3
"""
build_season_json.py — "Qué está sembrado este año, antes del mapa del USDA" (punto 6 de ML) para la historia del condado.

Entrada:  backend/Datos/front/cultivo_temporada.json   (lo escribe punto6_cultivo_temporada.ipynb; un lote por clave)
Salida:   web/public/data/season/<fips>.json           un archivo por condado con sus lotes de demo
          web/src/history/season-available.json        lista de condados con tarjeta (la historia la consulta antes de pedir el archivo)

No inventa nada: copia los campos del JSON de ML. Es por lote (10 lotes de demo en 5 condados), no por condado.
Es idempotente.

Uso:  python3 scripts/build_season_json.py
"""
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / "backend" / "Datos" / "front" / "cultivo_temporada.json"
SALIDA = RAIZ / "web" / "public" / "data" / "season"
LISTA = RAIZ / "web" / "src" / "history" / "season-available.json"


def main() -> None:
    d = json.loads(ENTRADA.read_text(encoding="utf-8"))
    por_condado: dict[str, list] = {}
    for id_lote, lote in d["fields"].items():
        por_condado.setdefault(lote["fips"], []).append({"id": id_lote, **lote})
    SALIDA.mkdir(parents=True, exist_ok=True)
    for fips, lotes in por_condado.items():
        # primero el lote donde la regla de rotación falla (el interesante); después el orden de ML
        lotes.sort(key=lambda x: x["rule_guess"] == x["usda_cdl"])
        out = {
            "fips": fips,
            "county": lotes[0]["county"],
            "season": lotes[0]["season"],
            "source": d["source"],
            "note": d["note"],
            "satellite_from": d["satellite_from"],
            "accuracy_by_date": d["accuracy_by_date"],
            "prototype": d.get("prototype", False),
            "fields": lotes,
        }
        (SALIDA / f"{fips}.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    LISTA.write_text(json.dumps(sorted(por_condado)), encoding="utf-8")
    print(f"Listo: {len(por_condado)} condados, {sum(len(v) for v in por_condado.values())} lotes → {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
