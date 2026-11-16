#!/usr/bin/env python3
"""
build_final_into_front.py — Mete en las fichas del front los datos finales del 15/11 (`data/fieldshift_final/`).

Lee `tabla_anual.zip` y los `tabla_mensual_*.zip` y completa `web/public/data/county/<fips>.json`
(solo los años que la ficha ya tiene; lo que ya estaba —rinde, clima, mapa del CDL— no se pisa):

  greenness    por año: curva mensual de NDVI de abril a octubre y el máximo (MODIS MOD13Q1). 2025 queda en null:
               MODIS no tiene julio a octubre de 2025 y el máximo saldría sesgado.
  soil_water   por año: anomalía de la humedad de la zona radicular de abril a septiembre (SMAP L4) y su palabra.
  economics    por año (nuevo): precio recibido (NASS, por estado) y margen operativo / costo por acre (ERS, región
               Heartland: el mismo valor para todo el estado) de maíz, soja y trigo de invierno.
  outlook      del condado (nuevo): aptitud y rinde alcanzable (FAO GAEZ v4, en materia seca → grano comercial) con el clima 1981–2010 y con el escenario
               RCP8.5 de 2041–2070, para cinco cultivos. Es un escenario, no un pronóstico.
  crops_pct, transitions y common_rotations: solo en condados SIN mapa del CDL (raster null), a partir de las columnas
               pct_* de tabla_anual (CDL, % del área agrícola). Los que tienen mapa conservan lo calculado del ráster.

Celda vacía = no se escribe (queda null): nunca 0. Es idempotente.

Uso:  .venv/bin/python scripts/build_final_into_front.py
"""
from __future__ import annotations

import glob
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_front_data as bfd  # noqa: E402

D = RAIZ / "data" / "fieldshift_final"
FICHAS = RAIZ / "web" / "public" / "data" / "county"
KGHA_A_BUAC = {"corn": 62.77, "soy": 67.25, "wheat": 67.25}  # CLAUDE.md: bushel de 56 y 60 lb
# El rinde alcanzable de GAEZ viene en kg de MATERIA SECA por ha (diccionario.csv): para pasarlo a grano comercial
# se divide por la fracción seca a la humedad estándar (maíz 15,5 %, soja y trigo 13 %). Sin esto queda 13–15 % bajo.
MATERIA_SECA = {"corn": 0.845, "soy": 0.87, "wheat": 0.87}

FUENTE_NDVI = "NASA MODIS · MOD13Q1 · ~1 km"
FUENTE_SMAP = "NASA SMAP · L4 · 9 km"
FUENTE_ECO = "USDA NASS · ERS · Heartland region"
FUENTE_GAEZ = "FAO GAEZ v4 · RCP8.5 scenario"
FUENTE_CDL = "USDA CDL · 30 m"
CULTIVO_A_FRONT = {"maiz": "corn", "soja": "soy", "trigo_invierno": "wheat"}
APTITUD = {"maiz": "corn", "soja": "soy", "trigo": "wheat", "avena": "oats", "alfalfa": "alfalfa"}


def num(x, nd=1):
    return None if pd.isna(x) else round(float(x), nd)


def palabra_agua(z: float) -> str:
    if z <= -1.0:
        return "Much drier than usual"
    if z <= -0.4:
        return "Drier than usual"
    if z < 0.4:
        return "About usual"
    if z < 1.0:
        return "Wetter than usual"
    return "Much wetter than usual"


def leer() -> tuple[pd.DataFrame, pd.DataFrame]:
    anual = pd.read_csv(D / "tabla_anual.zip", dtype={"fips": str})
    cols = ["fips", "anio", "mes", "ndvi", "sm_rootzone_anom_z"]
    mensual = pd.concat(
        [pd.read_csv(p, dtype={"fips": str}, usecols=cols) for p in sorted(glob.glob(str(D / "tabla_mensual_*.zip")))],
        ignore_index=True,
    )
    mensual["mes_n"] = mensual["mes"].str[5:7].astype(int)
    return anual, mensual


def main() -> None:
    anual, mensual = leer()
    maiz = anual[anual.cultivo == "maiz"].set_index(["fips", "anio"])  # una fila por condado y año: clima, suelo, NDVI, CDL
    por_cultivo = {c: anual[anual.cultivo == c].set_index(["fips", "anio"]) for c in CULTIVO_A_FRONT}
    estatico = anual.drop_duplicates("fips").set_index("fips")
    ndvi = mensual[mensual.mes_n.between(4, 10)].groupby(["fips", "anio"])
    sm = mensual[mensual.mes_n.between(4, 9)].groupby(["fips", "anio"]).sm_rootzone_anom_z.mean()

    resumen = dict(verdor=0, agua=0, economia=0, clima_futuro=0, mezcla=0, condados=0)
    for ruta in sorted(FICHAS.glob("*.json")):
        fips = ruta.stem
        ficha = json.loads(ruta.read_text(encoding="utf-8"))
        sin_mapa = ficha.get("raster") is None
        trans_total: dict[tuple[str, str], list[float]] = {}
        for y in ficha["years"]:
            a = y["year"]
            clave = (fips, a)
            # --- verdor
            y["greenness"] = None
            if a != 2025 and clave in ndvi.groups and clave in maiz.index and pd.notna(maiz.at[clave, "ndvi_max"]):
                g = ndvi.get_group(clave).dropna(subset=["ndvi"]).sort_values("mes_n")
                if len(g) >= 4:
                    y["greenness"] = {
                        "curve": [[int(m), round(float(v), 3)] for m, v in zip(g.mes_n, g.ndvi)],
                        "peak": round(float(maiz.at[clave, "ndvi_max"]), 2),
                        "source": FUENTE_NDVI,
                        "prototype": False,
                    }
                    resumen["verdor"] += 1
            # --- agua en el suelo
            y["soil_water"] = None
            if clave in sm.index and pd.notna(sm[clave]):
                z = float(sm[clave])
                y["soil_water"] = {"rootzone_anom_z": round(z, 2), "label": palabra_agua(z), "source": FUENTE_SMAP, "prototype": False}
                resumen["agua"] += 1
            # --- economía (maíz, soja y trigo de invierno)
            eco = {}
            for cultivo, c in CULTIVO_A_FRONT.items():
                tab = por_cultivo[cultivo]
                if clave in tab.index:
                    r = tab.loc[clave]
                    fila = {"price_usd_bu": num(r.precio_usd_bu, 2), "margin_usd_ac": num(r.margen_operativo_usd_ac, 0),
                            "cost_usd_ac": num(r.costo_total_usd_ac, 0)}
                    if any(v is not None for v in fila.values()):
                        eco[c] = fila
            y["economics"] = {"crops": eco, "source": FUENTE_ECO, "prototype": False} if eco else None
            resumen["economia"] += bool(eco)
            # --- mezcla de cultivos y transiciones, solo sin mapa del CDL
            if sin_mapa and clave in maiz.index:
                r = maiz.loc[clave]
                if pd.notna(r.pct_maiz) and pd.notna(r.pct_soja):
                    # Sin pct_doble_trigo_soja no se sabe cuánto del trigo es doble cultivo: ni el trigo ni el doble se
                    # escriben (la regla del repo: vacío, nunca 0).
                    doble = None if pd.isna(r.pct_doble_trigo_soja) else float(r.pct_doble_trigo_soja)
                    trigo = None if doble is None or pd.isna(r.pct_trigo) else max(0.0, float(r.pct_trigo) - doble)
                    mezcla = {"corn": r.pct_maiz, "soy": r.pct_soja, "double_wheat_soy": doble, "wheat": trigo,
                              "alfalfa": r.pct_alfalfa, "fallow": r.pct_barbecho, "other": r.pct_heno}
                    y["crops_pct"] = {k: round(float(v), 1) for k, v in mezcla.items() if v is not None and not pd.isna(v)}
                    y["area_by_crop"] = None
                    pares = {("soy", "corn"): (r.pct_maiz, r.pct_maiz_tras_soja), ("corn", "corn"): (r.pct_maiz, r.pct_maiz_tras_maiz),
                             ("corn", "soy"): (r.pct_soja, r.pct_soja_tras_maiz), ("soy", "soy"): (r.pct_soja, r.pct_soja_tras_soja)}
                    t = []
                    for (de, a_), (base, tras) in pares.items():
                        if pd.notna(base) and pd.notna(tras):  # % del cultivo del año que venía de otro -> % del área agrícola
                            p = float(base) * float(tras) / 100
                            t.append({"from": de, "to": a_, "pct": bfd.r1(p)})
                            trans_total.setdefault((de, a_), []).append(p)
                    t.sort(key=lambda d: -d["pct"])
                    y["transitions"] = t[:5] or None
                    resumen["mezcla"] += 1
                    # frase del año, con la fuente: la más fuerte de las transiciones
                    if t:
                        top = t[0]
                        frase = {"text": f"{bfd.CORTAS[top['to']].capitalize()} after {bfd.CORTAS[top['from']]} on {round(top['pct'])}% of cropland.",
                                 "source": "USDA CDL"}
                        y["headline"] = [h for h in y["headline"] if h.get("source") != "USDA CDL"] + [frase]
                        y["headline"] = y["headline"][:3]
        if sin_mapa and trans_total:
            tot = {k: float(np.mean(v)) for k, v in trans_total.items()}
            ficha["common_rotations"] = {
                "items": [{"from": de, "to": a_, "label": f"{bfd.ETIQUETAS[de].split(' (')[0]} → {bfd.ETIQUETAS[a_].split(' (')[0]}",
                           "pct": bfd.r1(p)} for (de, a_), p in sorted(tot.items(), key=lambda kv: -kv[1])[:4]],
                "source": FUENTE_CDL, "prototype": False}
        # --- clima futuro (estático por condado)
        ficha["outlook"] = None
        if fips in estatico.index:
            e = estatico.loc[fips]
            cult = {}
            for col, c in APTITUD.items():
                ahora, futuro = e.get(f"aptitud_{col}_1981_2010"), e.get(f"aptitud_{col}_2041_2070")
                if pd.notna(ahora) and pd.notna(futuro):
                    fila = {"suit_now": num(ahora, 0), "suit_future": num(futuro, 0)}
                    kg0, kg1 = e.get(f"rend_alcanzable_{col}_kgha_1981_2010"), e.get(f"rend_alcanzable_{col}_kgha_2041_2070")
                    if c in KGHA_A_BUAC and pd.notna(kg0) and pd.notna(kg1):
                        fila["attainable_bu_ac_now"] = num(kg0 / MATERIA_SECA[c] / KGHA_A_BUAC[c], 0)
                        fila["attainable_bu_ac_future"] = num(kg1 / MATERIA_SECA[c] / KGHA_A_BUAC[c], 0)
                    cult[c] = fila
            if cult:
                ficha["outlook"] = {"crops": cult, "baseline": "1981–2010", "scenario": "2041–2070 (RCP8.5)",
                                    "source": FUENTE_GAEZ, "prototype": False}
                resumen["clima_futuro"] += 1
        # fuentes de la ficha
        anios = [y["year"] for y in ficha["years"]]
        extra = []
        if any(y.get("greenness") for y in ficha["years"]):
            extra.append(f"{FUENTE_NDVI} · 2015–2024")
        if any(y.get("soil_water") for y in ficha["years"]):
            extra.append(f"{FUENTE_SMAP} · 2015–{max(anios)}")
        if any(y.get("economics") for y in ficha["years"]):
            extra.append(FUENTE_ECO)
        if ficha["outlook"]:
            extra.append(FUENTE_GAEZ)
        if sin_mapa and any(y.get("crops_pct") for y in ficha["years"]):
            extra.append(f"{FUENTE_CDL} · county summary")
        ficha["sources"] = [s for s in ficha["sources"] if s.split(" · ")[0] not in {e.split(" · ")[0] for e in extra}] + extra
        ruta.write_text(json.dumps(ficha, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        resumen["condados"] += 1
    print(resumen)


if __name__ == "__main__":
    main()
