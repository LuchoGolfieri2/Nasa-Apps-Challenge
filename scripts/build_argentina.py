#!/usr/bin/env python3
"""
build_argentina.py — Arma los datos de Argentina (región pampeana) para el front. Tarea F38, parte Argentina.

Entrada (entrega final del 15/11, fuera de Git):
  backend/Datos/entregas/fieldshift_datos_final_20261115/
    para_front/departamentos_argentina.geojson  219 departamentos (BA, La Pampa, Córdoba, Santa Fe, Entre Ríos), EPSG:4326
    para_front/condados_eeuu.csv                nombre y centroide de los condados análogos
    argentina/datos/analogos_departamento.csv   condados análogos, variables fuera de rango, radiación
    argentina/datos/rendimiento_ar.csv          MAGyP: rinde por departamento, campañas 2000/01–2024/25
    argentina/datos/rendimiento_comparacion.csv mediana argentina contra p10/mediana/p90 de los 3 condados análogos
    argentina/datos/clima_anual_ba.csv          clima por campaña, solo Buenos Aires (columnas de EE. UU., meses corridos)
    argentina/datos/suelo_sg.csv                SoilGrids 0–30 cm, de los dos países

Salida (va a Git), en web/public/data/argentina/:
  index.json                 resumen: zonas, leyenda, totales, fuentes y reglas para mostrar
  departamentos.geojson      polígonos con las propiedades para pintar el mapa (zona, análogo, qué datos hay)
  depto/<id_depto>.json      ficha de cada departamento (análogos, rindes del MAGyP, comparación, clima, suelo)

Reglas (CLAUDE.md, sección 2.1 y "Argentina en el front"):
  - La clave es `id_depto` (INDEC, 5 dígitos). Los de Buenos Aires empiezan con 06, como el FIPS de California:
    por eso todo va en una carpeta aparte y cada archivo lleva "country": "AR".
  - No hay predicción del modelo en Argentina: el modelo se entrenó con condados de EE. UU. Lo que se muestra es la
    comparación con los condados análogos y el rinde real del MAGyP. En zona "fuera" el texto dice que un modelo de
    EE. UU. no aplica.
  - El MAGyP sirve para comparar, nunca como entrada de un modelo.
  - Clima por campaña solo en Buenos Aires; en el resto, null ("Missing data").
  - Interfaz en inglés. Nada inventado: lo que falta va en null.

Uso:  python3 scripts/build_argentina.py [--entrega <carpeta>]
Es idempotente: borra y vuelve a escribir web/public/data/argentina/.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
from datetime import date
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parent.parent
ENTREGA = RAIZ / "backend" / "Datos" / "entregas" / "fieldshift_datos_final_20261115"
SALIDA = RAIZ / "web" / "public" / "data" / "argentina"

PAIS = "AR"
CULTIVO = {"maiz": "corn", "soja": "soy", "trigo": "wheat"}
# kg/ha por bu/ac (CLAUDE.md sección 4): maíz bushel de 56 lb; soja y trigo de 60 lb
KGHA_POR_BU_AC = {"corn": 62.77, "soy": 67.25, "wheat": 67.25}
CULTIVO_EN = {"corn": "corn", "soy": "soybeans", "wheat": "wheat"}

# Meses de la temporada argentina (octubre a marzo), alineados con abril a septiembre en EE. UU.
MES_T = {"t1": "October", "t2": "November", "t3": "December", "t4": "January", "t5": "February", "t6": "March"}
VARIABLE_EN = {
    **{f"tmed_{t}": f"{m} temperature" for t, m in MES_T.items()},
    **{f"prec_{t}": f"{m} rain" for t, m in MES_T.items()},
    "tmax_abs_t4": "January peak heat (corn flowering)",
    "prec_temp_sd": "year-to-year season rain swings",
    "tmax_temp_sd": "year-to-year season heat swings",
    "prec_invierno": "winter rain (May–September)",
}
N_VARIABLES = 16

ZONA = {
    "dentro": {"label": "Within the Corn Belt weather range",
               "color_hint": "in",
               "text": "This department's weather falls within the range of the Corn Belt counties."},
    "cerca": {"label": "Close to the Corn Belt weather range",
              "color_hint": "near",
              "text": "This department's weather is close to the Corn Belt: {n} of 16 weather measures fall outside "
                      "the U.S. range ({vars})."},
    "fuera": {"label": "Outside the Corn Belt weather range",
              "color_hint": "out",
              "text": "This department's weather is outside the Corn Belt range ({n} of 16 measures, such as {vars}). "
                      "Estimates trained on U.S. counties would not apply here."},
}

FUENTES = [
    {"id": "magyp", "name": "MAGyP Estimaciones agrícolas (Argentina)", "gives": "Department yield and area",
     "resolution": "department", "period": "2000/01–2024/25"},
    {"id": "power", "name": "NASA POWER", "gives": "Weather by growing season (October–March)",
     "resolution": "0.5°", "period": "2001–2024 (Buenos Aires: 2000–2025)"},
    {"id": "soilgrids", "name": "ISRIC SoilGrids v2.0", "gives": "Soil texture, organic carbon and pH, 0–30 cm",
     "resolution": "1 km", "period": "static"},
    {"id": "nass", "name": "USDA NASS Quick Stats", "gives": "Yield of the U.S. analog counties",
     "resolution": "county", "period": "2001–2024"},
    {"id": "georef", "name": "Argentina Georef API (datos.gob.ar)", "gives": "Department boundaries and INDEC codes",
     "resolution": "department", "period": "current"},
]
NOTA = ("Argentina is shown as an extension test: there is no yield estimate here yet, because the model was trained "
        "on U.S. counties. Each department is compared with the U.S. counties that have the most similar weather, "
        "and with its own official yields (MAGyP). Similar weather does not mean similar yield.")


def numero(v, dec=1):
    if v is None or (isinstance(v, float) and math.isnan(v)) or pd.isna(v):
        return None
    return round(float(v), dec)


def a_bu_ac(kgha, crop):
    return None if kgha is None else round(kgha / KGHA_POR_BU_AC[crop], 1)


def variables_fuera(texto):
    if not isinstance(texto, str) or not texto:
        return []
    return [{"id": v, "label": VARIABLE_EN.get(v, v)} for v in texto.split(";")]


def texto_zona(zona, fuera):
    plantilla = ZONA[zona]["text"]
    nombres = [v["label"] for v in fuera]
    lista = ", ".join(nombres[:2]) + (" and others" if len(nombres) > 2 else "")
    return plantilla.format(n=len(fuera), vars=lista)


def texto_comparacion(crop, ar_kgha, us_med_kgha, ratio, anios):
    if ar_kgha is None or us_med_kgha is None or ratio is None:
        return None
    return (f"In {anios}, {CULTIVO_EN[crop]} here yielded about {a_bu_ac(ar_kgha, crop):.0f} bu/ac "
            f"({ar_kgha:,.0f} kg/ha) at the median, about {ratio * 100:.0f}% of its 3 U.S. weather analogs "
            f"({a_bu_ac(us_med_kgha, crop):.0f} bu/ac).")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrega", type=Path, default=ENTREGA)
    args = ap.parse_args()
    E = args.entrega
    D = E / "argentina" / "datos"

    geo = json.loads((E / "para_front" / "departamentos_argentina.geojson").read_text(encoding="utf-8"))
    analogos = pd.read_csv(D / "analogos_departamento.csv", dtype={"id_depto": str, "fips_analogo": str,
                                                                    "fips_analogo_2": str, "fips_analogo_3": str})
    analogos = analogos.set_index("id_depto")
    condados = pd.read_csv(E / "para_front" / "condados_eeuu.csv", dtype={"fips": str}).set_index("fips")
    rinde = pd.read_csv(D / "rendimiento_ar.csv", dtype={"id_depto_indec": str})
    comp = pd.read_csv(D / "rendimiento_comparacion.csv", dtype={"id_depto_indec": str})
    clima = pd.read_csv(D / "clima_anual_ba.csv", dtype={"id_depto_indec": str})
    suelo = pd.read_csv(D / "suelo_sg.csv", dtype={"id": str})
    suelo_ar = suelo[suelo["lado"] == "ar"].set_index("id")
    suelo_us = suelo[suelo["lado"] == "us"].set_index("id")

    if SALIDA.exists():
        shutil.rmtree(SALIDA)
    (SALIDA / "depto").mkdir(parents=True)

    def condado(fips):
        if not isinstance(fips, str) or fips not in condados.index:
            return None
        c = condados.loc[fips]
        return {"fips": fips, "name": c["condado"], "state": c["estado"],
                "centroid": [round(float(c["lon_centroide"]), 4), round(float(c["lat_centroide"]), 4)]}

    def suelo_de(tabla, clave):
        if clave not in tabla.index:
            return None
        s = tabla.loc[clave]
        return {"clay_pct": numero(s["arcilla_sg_pct"]), "sand_pct": numero(s["arena_sg_pct"]),
                "organic_carbon_g_kg": numero(s["soc_sg_g_kg"]), "ph": numero(s["ph_sg"], 2)}

    features, filas_indice = [], []
    for f in geo["features"]:
        p = f["properties"]
        idd = p["id_depto"]
        zona = p["zona"]
        a = analogos.loc[idd] if idd in analogos.index else None
        fuera = variables_fuera(a["vars_fuera_rango"]) if a is not None else []
        analogos_lista = [x for x in (condado(a[c]) for c in ("fips_analogo", "fips_analogo_2", "fips_analogo_3"))
                          if x] if a is not None else []

        # Rinde del MAGyP por campaña (kg/ha y bu/ac), y la comparación con los análogos
        r = rinde[rinde["id_depto_indec"] == idd]
        campanias = []
        for (anio, camp), g in r.groupby(["anio", "campania"]):
            fila = {"year": int(anio), "campaign": camp}
            for es, crop in CULTIVO.items():
                v = g.loc[g["cultivo"] == es, "rend_kgha"]
                kg = numero(v.iloc[0], 0) if len(v) else None
                fila[crop] = None if kg is None else {"kg_ha": kg, "bu_ac": a_bu_ac(kg, crop)}
            campanias.append(fila)

        comparacion = {}
        for _, c in comp[comp["id_depto_indec"] == idd].iterrows():
            crop = CULTIVO[c["cultivo"]]
            ar, us_med = numero(c["rend_ar_mediana_kgha"], 0), numero(c["rend_us_mediana_kgha"], 0)
            us = {k: numero(c[f"rend_us_{k}_kgha"], 0) for k in ("p10", "mediana", "p90")}
            ratio = numero(c["ratio_ar_us"], 3)
            comparacion[crop] = {
                "ar_median": None if ar is None else {"kg_ha": ar, "bu_ac": a_bu_ac(ar, crop)},
                "us_analogs": {"p10": us["p10"] and a_bu_ac(us["p10"], crop),
                               "median": us["mediana"] and a_bu_ac(us["mediana"], crop),
                               "p90": us["p90"] and a_bu_ac(us["p90"], crop)},
                "us_analogs_kg_ha": {"p10": us["p10"], "median": us["mediana"], "p90": us["p90"]},
                "ratio_ar_us": ratio,
                "percentile_in_us": numero(c["pctl_ar_en_us"], 1),
                "n_years_ar": int(c["n_anios_ar"]) if not pd.isna(c["n_anios_ar"]) else None,
                "n_obs_us": int(c["n_obs_us"]) if not pd.isna(c["n_obs_us"]) else None,
                "text": texto_comparacion(crop, ar, us_med, ratio, "2001–2024"),
                "source": "MAGyP · USDA NASS",
            }

        # Clima por campaña: solo Buenos Aires (meses del hemisferio sur)
        cl = clima[clima["id_depto_indec"] == idd].sort_values("anio")
        clima_lista = [{
            "year": int(x["anio"]), "campaign": f"{int(x['anio']) - 1}/{int(x['anio'])}",
            "season_rain_mm": numero(x["prec_temporada_mm"], 0),
            "season_gdd": numero(x["gdd_temporada"], 0),
            "season_water_balance_mm": numero(x["deficit_temporada_mm"], 0),
            "january_rain_mm": numero(x["prec_jul_mm"], 0),
            "january_max_temp_c": numero(x["tmax_jul_c"], 1),
            "february_rain_mm": numero(x["prec_ago_mm"], 0),
        } for _, x in cl.iterrows()] or None

        primero = analogos_lista[0] if analogos_lista else None
        ficha = {
            "country": PAIS, "id_depto": idd, "name": p["departamento"], "province": p["provincia"],
            "centroid": [round(float(p["lon_centroide"]), 4), round(float(p["lat_centroide"]), 4)],
            "zone": zona, "zone_label": ZONA[zona]["label"], "zone_text": texto_zona(zona, fuera),
            "out_of_range": fuera,
            "radiation_diff_mj_m2_day": numero(a["dif_rad_temporada"], 1) if a is not None else None,
            "prediction": None,
            "prediction_note": ("No yield estimate here yet: the model was trained on U.S. counties."
                                if zona != "fuera" else
                                "No yield estimate: this weather is outside the range the U.S. model learned from."),
            "analogs": analogos_lista,
            "yield_compare": comparacion or None,
            "yields": campanias or None,
            "climate": clima_lista,
            "climate_note": None if clima_lista else "Missing data: season weather is only processed for Buenos Aires.",
            "soil": suelo_de(suelo_ar, idd),
            "soil_analog": suelo_de(suelo_us, primero["fips"]) if primero else None,
            "season_months": "October–March (the U.S. April–September season, shifted 6 months)",
            "sources": ["MAGyP · department · 2000/01–2024/25", "NASA POWER · 0.5° · 2001–2024",
                        "ISRIC SoilGrids · 1 km", "USDA NASS · analog counties · 2001–2024"],
            "prototype": False,
        }
        (SALIDA / "depto" / f"{idd}.json").write_text(json.dumps(ficha, ensure_ascii=False, separators=(",", ":")) + "\n",
                                                      encoding="utf-8")

        resumen = {c: comparacion[c]["ratio_ar_us"] for c in comparacion}
        features.append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "country": PAIS, "id_depto": idd, "name": p["departamento"], "province": p["provincia"],
            "zone": zona, "n_out_of_range": int(p["n_fuera_rango"]),
            "analog_fips": primero["fips"] if primero else None,
            "analog_name": f"{primero['name']}, {primero['state']}" if primero else None,
            "has_climate": bool(clima_lista), "has_yield": bool(campanias), "has_soil": ficha["soil"] is not None,
            "ratio_corn": resumen.get("corn"), "ratio_soy": resumen.get("soy"), "ratio_wheat": resumen.get("wheat"),
        }})
        filas_indice.append({"province": p["provincia"], "zone": zona, **{f"ratio_{k}": v for k, v in resumen.items()}})

    (SALIDA / "departamentos.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features},
                                                             ensure_ascii=False, separators=(",", ":")) + "\n",
                                                  encoding="utf-8")

    idx = pd.DataFrame(filas_indice)
    zonas = {z: {"label": ZONA[z]["label"], "color_hint": ZONA[z]["color_hint"], "departments": int((idx["zone"] == z).sum())}
             for z in ("dentro", "cerca", "fuera")}
    por_provincia = {prov: {z: int(n) for z, n in g["zone"].value_counts().items()} for prov, g in idx.groupby("province")}
    ratio_zona = {z: {c: numero(g[f"ratio_{c}"].median(), 2) for c in ("corn", "soy", "wheat") if f"ratio_{c}" in g}
                  for z, g in idx.groupby("zone")}
    indice = {
        "country": PAIS, "generated": date.today().isoformat(), "departments": len(features),
        "zones": zonas, "by_province": por_provincia,
        "median_ratio_ar_us_by_zone": ratio_zona,
        "headline": ("Similar weather is not enough for similar yields: the southern Buenos Aires departments whose "
                     "weather falls within the Corn Belt range yield about half of their U.S. analogs."),
        "note": NOTA,
        "rules": {"prediction": "none in Argentina yet",
                  "zone_dentro": "comparison shown without warning",
                  "zone_cerca": "comparison shown with the out-of-range measures",
                  "zone_fuera": "say that U.S.-trained estimates would not apply",
                  "magyp": "comparison only, never a model input"},
        "sources": FUENTES,
        "prototype": False,
    }
    (SALIDA / "index.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(features)} departamentos → {SALIDA.relative_to(RAIZ)} | zonas: "
          f"{ {z: v['departments'] for z, v in zonas.items()} } | con clima: "
          f"{sum(1 for x in features if x['properties']['has_climate'])} | con rinde: "
          f"{sum(1 for x in features if x['properties']['has_yield'])}")


if __name__ == "__main__":
    main()
