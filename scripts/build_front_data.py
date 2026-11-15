#!/usr/bin/env python3
"""
build_front_data.py — Arma los JSON y PNG estáticos que lee el front (tareas F05 y F06).

Entradas (lee lo que exista; lo que falta queda en null = "Missing data"):
  cdl_fieldshift.zip           superficie, transiciones y rasters del CDL (2015–2025)
  backend/Datos/tabla_modelado.csv   rinde NASS y clima POWER por condado y año (opcional)

Salidas, en web/public/data/:
  meta.json                    años, condados de demo, clases de cultivo y fuentes
  county/<fips>.json           ficha del condado (contrato: docs/front-end-plan.md §7 + spec §3)
  cdl/<fips>/<anio>.png        raster del CDL del año; el valor de gris de cada píxel es el
                               índice de clase × 20 (ver CLASES). El front lo colorea con sus tokens.

Uso:
  python scripts/build_front_data.py

No inventa datos: sin fuente, el bloque va en null. Es idempotente.
"""
from __future__ import annotations

import io
import json
import zipfile
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
import rasterio
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ZIP_CDL = RAIZ / "cdl_fieldshift.zip"
TABLA_ML = RAIZ / "backend" / "Datos" / "tabla_modelado.csv"
SALIDA = RAIZ / "web" / "public" / "data"

CONDADOS = {
    "19169": {"name": "Story", "state": "IA", "state_name": "Iowa"},
    "17113": {"name": "McLean", "state": "IL", "state_name": "Illinois"},
    "20191": {"name": "Sumner", "state": "KS", "state_name": "Kansas"},
}
CONDADO_DEMO = "20191"

# Clases que muestra el front. El índice es el valor de gris del PNG.
# 0 = sin dato (fuera del condado), 1 = no agrícola.
CLASES = ["nodata", "non_ag", "corn", "soy", "wheat", "sorghum", "double_wheat_soy", "alfalfa", "fallow", "other"]
ETIQUETAS = {
    "corn": "Corn",
    "soy": "Soybeans",
    "wheat": "Wheat",
    "sorghum": "Sorghum",
    "double_wheat_soy": "Wheat + soybeans (double crop)",
    "alfalfa": "Alfalfa",
    "fallow": "Fallow",
    "other": "Other crops",
}
CORTAS = {
    "corn": "corn",
    "soy": "soybeans",
    "wheat": "wheat",
    "sorghum": "sorghum",
    "double_wheat_soy": "double-crop wheat and soybeans",
    "alfalfa": "alfalfa",
    "fallow": "fallow",
    "other": "other crops",
}
# Grupo de cdl_clean.py -> clase del front.
GRUPO_A_CLASE = {
    "maiz": "corn",
    "soja": "soy",
    "trigo": "wheat",
    "sorgo": "sorghum",
    "doble_trigo_soja": "double_wheat_soy",
    "alfalfa": "alfalfa",
    "barbecho": "fallow",
    "otros_dobles": "other",
    "otros_cultivos": "other",
}
# Id de grupo en el raster (cdl_clean.py) -> índice de CLASES.
ID_GRUPO_A_INDICE = {0: 0, 1: 1, 10: 2, 11: 3, 12: 4, 13: 5, 15: 6, 14: 7, 17: 8, 16: 9, 18: 9}
CULTIVOS = [c for c in CLASES if c not in ("nodata", "non_ag")]

# El gris del PNG es índice × PASO_GRIS, para que un corrimiento de 1 o 2 niveles al
# decodificar en el navegador no cambie la clase.
PASO_GRIS = 20

# Nombre del cultivo como adjetivo, para frases del tipo "Soybean area is up...".
ADJETIVO = {
    "corn": "Corn",
    "soy": "Soybean",
    "wheat": "Wheat",
    "sorghum": "Sorghum",
    "double_wheat_soy": "Double-crop wheat and soybean",
    "alfalfa": "Alfalfa",
    "fallow": "Fallow",
    "other": "Other-crop",
}

HA_A_ACRES = 2.47105
MM_A_IN = 1 / 25.4

FUENTE_CDL = "USDA CDL · 30 m"
FUENTE_NASS = "USDA NASS · county"
FUENTE_POWER = "NASA POWER · 0.5°"


def r1(x: float) -> float:
    return round(float(x), 1)


def c_a_f(c: float) -> int:
    return int(round(c * 9 / 5 + 32))


# ------------------------------------------------------------------ CDL
def leer_cdl(z: zipfile.ZipFile) -> tuple[pd.DataFrame, pd.DataFrame]:
    sup = pd.read_csv(z.open("processed/cdl_superficie.csv"), dtype={"region": str})
    tra = pd.read_csv(z.open("processed/cdl_transiciones.csv"), dtype={"region": str})
    sup = sup[sup.grupo != "no_agricola"].copy()
    sup["clase"] = sup.grupo.map(GRUPO_A_CLASE)
    tra["de"] = tra.crop_t1.map(GRUPO_A_CLASE)
    tra["a"] = tra.crop_t.map(GRUPO_A_CLASE)
    if sup.clase.isna().any() or tra.de.isna().any() or tra.a.isna().any():
        raise ValueError("Hay grupos del CDL sin clase del front: revisar GRUPO_A_CLASE")
    return sup, tra


def superficie_por_anio(sup: pd.DataFrame, fips: str) -> dict[int, dict]:
    """Superficie por clase (ha y acres) y % sobre la superficie con cultivo."""
    out = {}
    s = sup[sup.region == fips].groupby(["year", "clase"]).sup_ha.sum().unstack(fill_value=0.0)
    for anio, fila in s.iterrows():
        total = float(fila.sum())
        out[int(anio)] = {
            "area_by_crop": {
                c: {"ha": int(round(fila.get(c, 0.0))), "ac": int(round(fila.get(c, 0.0) * HA_A_ACRES))}
                for c in CULTIVOS
            },
            "crops_pct": {c: r1(100 * fila.get(c, 0.0) / total) for c in CULTIVOS},
            "cropland_ac": int(round(total * HA_A_ACRES)),
        }
    return out


def transiciones(tra: pd.DataFrame, fips: str) -> tuple[dict[int, list], list]:
    """Transiciones cultivo anterior -> cultivo, por año y en el promedio del período."""
    t = tra[tra.region == fips].groupby(["year", "de", "a"]).pixeles.sum().reset_index()
    por_anio = {}
    for anio, g in t.groupby("year"):
        total = g.pixeles.sum()
        g = g.sort_values("pixeles", ascending=False).head(5)
        por_anio[int(anio)] = [
            {"from": f.de, "to": f.a, "pct": r1(100 * f.pixeles / total)} for f in g.itertuples()
        ]
    g = t.groupby(["de", "a"]).pixeles.sum().reset_index()
    total = g.pixeles.sum()
    g = g.sort_values("pixeles", ascending=False).head(5)
    comunes = [
        {
            "from": f.de,
            "to": f.a,
            "label": f"{ETIQUETAS[f.de].split(' (')[0]} → {ETIQUETAS[f.a].split(' (')[0]}",
            "pct": r1(100 * f.pixeles / total),
        }
        for f in g.itertuples()
    ]
    return por_anio, comunes


def escribir_png(z: zipfile.ZipFile, fips: str, anios: list[int]) -> dict | None:
    """Un PNG por año con el índice de clase como valor de gris. Devuelve tamaño y años escritos."""
    lut = np.zeros(256, dtype=np.uint8)
    for k, v in ID_GRUPO_A_INDICE.items():
        lut[k] = v * PASO_GRIS
    carpeta = SALIDA / "cdl" / fips
    carpeta.mkdir(parents=True, exist_ok=True)
    escritos, tam = [], None
    for anio in anios:
        nombre = f"interim/{fips}/cdl_grupos_{anio}.tif"
        if nombre not in z.namelist():
            continue
        with rasterio.open(io.BytesIO(z.read(nombre))) as r:
            a = r.read(1)
        desconocidos = set(np.unique(a).tolist()) - set(ID_GRUPO_A_INDICE)
        if desconocidos:
            raise ValueError(f"{nombre}: ids de grupo sin mapear {desconocidos}")
        img = Image.fromarray(lut[a], mode="L")
        img.save(carpeta / f"{anio}.png", optimize=True)
        if tam is None:
            tam = [img.width, img.height]
        elif tam != [img.width, img.height]:
            raise ValueError(f"{nombre}: tamaño distinto al del primer año")
        escritos.append(anio)
    if not escritos:
        return None
    return {
        "path": f"data/cdl/{fips}/{{year}}.png",
        "width": tam[0],
        "height": tam[1],
        "years": escritos,
        "encoding": f"gray value = class index × {PASO_GRIS} (see meta.json classes)",
        "gray_step": PASO_GRIS,
        "crs": "EPSG:5070",
        "pixel_m": 30,
        "source": FUENTE_CDL,
        "prototype": False,
    }


# ------------------------------------------------------- rinde y clima
def leer_tabla_ml() -> pd.DataFrame | None:
    if not TABLA_ML.exists():
        return None
    return pd.read_csv(TABLA_ML, dtype={"fips": str})


def rinde_y_clima(tabla: pd.DataFrame | None, fips: str) -> tuple[dict[int, dict], dict[int, dict]]:
    """Rinde (NASS) y clima (POWER) por año, si el condado está en la tabla de ML."""
    rinde: dict[int, dict] = {}
    clima: dict[int, dict] = {}
    if tabla is None:
        return rinde, clima
    t = tabla[tabla.fips == fips]
    if t.empty:
        return rinde, clima
    nombres = {"maiz": "corn", "soja": "soy"}
    for f in t.itertuples():
        if f.cultivo in nombres and pd.notna(f.rend_bu_ac):
            rinde.setdefault(int(f.anio), {})[nombres[f.cultivo]] = {
                "bu_ac": int(round(f.rend_bu_ac)),
                # "Lo habitual" lo define el equipo de ML: hasta entonces, sin comparar.
                "vs_usual": None,
                "flag_nass": None,
            }
    # El clima es del condado, no del cultivo: se toma una fila por año.
    cols = ["prec_temporada_mm", "prec_jul_mm", "tmax_jul_c", "dias_tmax_gt30_jul"]
    c = t.dropna(subset=["prec_jul_mm", "tmax_jul_c"]).groupby("anio")[cols].first()
    if c.empty:
        return rinde, clima
    z_lluvia = (c.prec_jul_mm - c.prec_jul_mm.mean()) / c.prec_jul_mm.std()
    z_tmax = (c.tmax_jul_c - c.tmax_jul_c.mean()) / c.tmax_jul_c.std()
    for anio, f in c.iterrows():
        # Supuesto: una etiqueta se pone si julio se aleja más de 1 desvío de la media
        # del propio condado en los años disponibles de la tabla.
        tags = []
        if z_lluvia[anio] <= -1:
            tags.append("Dry July")
        elif z_lluvia[anio] >= 1:
            tags.append("Wet July")
        if z_tmax[anio] >= 1:
            tags.append("Hot July")
        elif z_tmax[anio] <= -1:
            tags.append("Cool July")
        clima[int(anio)] = {
            "season_rain_in": r1(f.prec_temporada_mm * MM_A_IN),
            "season_rain_mm": int(round(f.prec_temporada_mm)),
            "july_rain_in": r1(f.prec_jul_mm * MM_A_IN),
            "july_rain_mm": int(round(f.prec_jul_mm)),
            "july_tmax_f": c_a_f(f.tmax_jul_c),
            "july_tmax_c": r1(f.tmax_jul_c),
            "days_over_86f_july": int(round(f.dias_tmax_gt30_jul)),
            "tags": tags,
            "baseline_years": f"{int(c.index.min())}–{int(c.index.max())}",
            "source": FUENTE_POWER,
            "prototype": False,
        }
    return rinde, clima


# ------------------------------------------------------------ titular
def titular(anio: int, anios: dict[int, dict], trans: dict[int, list], clima: dict | None) -> list[dict]:
    """Frases del año, cada una con su fuente. Primero el dato NASA, si existe."""
    frases = []
    if clima and clima.get("tags"):
        frases.append({"text": " and ".join(clima["tags"]).capitalize().replace("july", "July") + ".", "source": "NASA POWER"})
    primero = min(anios)
    actual, base = anios[anio]["area_by_crop"], anios[primero]["area_by_crop"]
    if anio == primero:
        top = max(CULTIVOS, key=lambda c: actual[c]["ac"])
        frases.append({
            "text": f"{ETIQUETAS[top].split(' (')[0]} covers {round(anios[anio]['crops_pct'][top])}% of cropland.",
            "source": "USDA CDL",
        })
    else:
        # El cultivo que más superficie ganó o perdió desde el primer año.
        c = max(CULTIVOS, key=lambda k: abs(actual[k]["ac"] - base[k]["ac"]))
        antes, ahora = base[c]["ac"], actual[c]["ac"]
        nombre = ADJETIVO[c]
        if antes > 0 and ahora >= 1.8 * antes:
            txt = f"{nombre} area is {ahora / antes:.1f}× its {primero} level."
        elif antes > 0:
            cambio = round(100 * (ahora - antes) / antes)
            txt = f"{nombre} area is {'up' if cambio > 0 else 'down'} {abs(cambio)}% since {primero}."
        else:
            txt = f"{nombre} now covers {round(anios[anio]['crops_pct'][c])}% of cropland."
        frases.append({"text": txt, "source": "USDA CDL"})
    if anio in trans and trans[anio]:
        t = trans[anio][0]
        frases.append({
            "text": f"{CORTAS[t['to']].capitalize()} after {CORTAS[t['from']]} on {round(t['pct'])}% of cropland.",
            "source": "USDA CDL",
        })
    return frases


# --------------------------------------------------------------- main
def main() -> None:
    if not ZIP_CDL.exists():
        raise SystemExit(f"Falta {ZIP_CDL.name}: sin el CDL no hay ficha de condado.")
    tabla = leer_tabla_ml()
    (SALIDA / "county").mkdir(parents=True, exist_ok=True)
    todos_los_anios: set[int] = set()

    with zipfile.ZipFile(ZIP_CDL) as z:
        sup, tra = leer_cdl(z)
        for fips, info in CONDADOS.items():
            anios = superficie_por_anio(sup, fips)
            trans_anio, comunes = transiciones(tra, fips)
            rinde, clima = rinde_y_clima(tabla, fips)
            lista = sorted(anios)
            todos_los_anios.update(lista)
            raster = escribir_png(z, fips, lista)

            fuentes = [f"{FUENTE_CDL} · {lista[0]}–{lista[-1]}"]
            if rinde:
                fuentes.append(f"{FUENTE_NASS} · {min(rinde)}–{max(rinde)}")
            if clima:
                fuentes.append(f"{FUENTE_POWER} · {min(clima)}–{max(clima)}")

            ficha = {
                "fips": fips,
                **info,
                "summary": None,
                "raster": raster,
                "years": [
                    {
                        "year": a,
                        "headline": titular(a, anios, trans_anio, clima.get(a)),
                        "crops_pct": anios[a]["crops_pct"],
                        "area_by_crop": anios[a]["area_by_crop"],
                        "cropland_ac": anios[a]["cropland_ac"],
                        "transitions": trans_anio.get(a),
                        "yield": (
                            {"crops": rinde[a], "source": FUENTE_NASS, "prototype": False} if a in rinde else None
                        ),
                        "greenness": None,
                        "weather": clima.get(a),
                        "soil_water": None,
                    }
                    for a in lista
                ],
                "greenness_band": None,
                "common_rotations": {"items": comunes, "source": FUENTE_CDL, "prototype": False},
                "sources": fuentes,
            }
            (SALIDA / "county" / f"{fips}.json").write_text(
                json.dumps(ficha, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
            )
            print(
                f"{fips} {info['name']}: {len(lista)} años, {len(raster['years']) if raster else 0} PNG, "
                f"rinde en {len(rinde)} años, clima en {len(clima)} años"
            )

    meta = {
        "app": "Field Rewind",
        "generated": date.today().isoformat(),
        "states": ["IA", "IL", "KS"],
        "demo_counties": list(CONDADOS),
        "default_county": CONDADO_DEMO,
        "years": sorted(todos_los_anios),
        "classes": CLASES,
        "crop_labels": ETIQUETAS,
        "sources": [
            {"id": "cdl", "name": "USDA Cropland Data Layer", "gives": "What was planted, field by field", "resolution": "30 m", "period": "2015–2025"},
            {"id": "nass", "name": "USDA NASS Quick Stats", "gives": "County yield", "resolution": "county", "period": "see each county"},
            {"id": "power", "name": "NASA POWER", "gives": "Rain and temperature", "resolution": "0.5°", "period": "see each county"},
        ],
    }
    (SALIDA / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Listo: {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
