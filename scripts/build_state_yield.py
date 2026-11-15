"""F34 (opción 6): rinde de maíz y soja de todos los condados de cada estado, año por año.

Lo usa la historia de los condados sin mapa del CDL: el mapa del estado "se rebobina" con la línea de
tiempo y el condado queda resaltado entre sus vecinos. Sale de los mismos datos que las fichas
(backend/Datos/tabla_modelado.csv, rinde USDA NASS de condado); no baja nada.

Salida: web/public/data/state/<ST>.json
  {"state": "IL", "years": [2015, …, 2025], "source": "USDA NASS · county",
   "scale": {"corn": [p5, p95], "soy": [p5, p95]},          # escala fija del estado para los 11 años
   "median": {"corn": [… por año …], "soy": [...]},         # mediana del estado por año (null sin datos)
   "counties": {"17001": {"corn": [176, …, null], "soy": [...]}, …}}
Un año sin rinde publicado queda null, nunca 0.

Uso: python3 scripts/build_state_yield.py
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
TABLA = RAIZ / "backend" / "Datos" / "tabla_modelado.csv"
SALIDA = RAIZ / "web" / "public" / "data" / "state"
ANIOS = list(range(2015, 2026))
POSTAL = {"19": "IA", "17": "IL", "18": "IN", "20": "KS", "27": "MN", "29": "MO", "31": "NE",
          "39": "OH", "46": "SD", "55": "WI", "38": "ND"}
CULTIVO = {"maiz": "corn", "soja": "soy"}


def main() -> None:
    t = pd.read_csv(TABLA, dtype={"fips": str}, usecols=["fips", "anio", "cultivo", "rend_bu_ac"])
    t["fips"] = t.fips.str.zfill(5)
    t = t[t.anio.isin(ANIOS) & t.cultivo.isin(CULTIVO) & t.rend_bu_ac.notna()]
    SALIDA.mkdir(parents=True, exist_ok=True)
    for est, s in t.groupby(t.fips.str[:2]):
        postal = POSTAL[est]
        piv = {c: s[s.cultivo == m].pivot_table(index="fips", columns="anio", values="rend_bu_ac") for m, c in CULTIVO.items()}
        condados = sorted(set().union(*(p.index for p in piv.values())))
        val = lambda p, f, a: (None if f not in p.index or a not in p.columns or pd.isna(p.at[f, a]) else int(round(p.at[f, a])))
        out = {
            "state": postal,
            "years": ANIOS,
            "source": "USDA NASS · county",
            "scale": {c: [int(p.stack().quantile(0.05)), int(p.stack().quantile(0.95))] if p.size else None for c, p in piv.items()},
            "median": {c: [None if a not in p.columns or p[a].isna().all() else int(round(p[a].median())) for a in ANIOS] for c, p in piv.items()},
            "counties": {f: {c: [val(p, f, a) for a in ANIOS] for c, p in piv.items()} for f in condados},
        }
        destino = SALIDA / f"{postal}.json"
        destino.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
        print(f"{postal}: {len(condados)} condados, {destino.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
