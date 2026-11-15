#!/usr/bin/env python3
"""
Arma los JSON de la pantalla 3 ("Next season") con datos reales:

  backend/Datos/escenarios_rotacion_resumen.csv  → rango p10 / mediana / p90 por opción (modelo del punto 2)
  backend/Datos/escenarios_rotacion.csv          → predicción por clima de cada año (2009–2023): la "prediction" de la pantalla
  backend/Datos/front/explicaciones.json         → razones, riesgos, confianza y años (punto 3)
  backend/Datos/front/gemelos.json               → condados gemelos por opción y cultivos nuevos (punto 5)
  backend/Datos/precios_costos.csv               → precio NASS y costo operativo ERS por estado (scripts/build_precios_costos.py)
  backend/Datos/decision_opciones.csv            → puntajes por prioridad y métricas en $/acre (punto 7)
  web/public/data/county/<fips>.json             → mezcla de rotaciones del CDL (si el condado tiene historia)
  backend/Datos/tabla_modelado.csv               → % del maíz sobre maíz y % de la soja sobre soja por año (CDL): la "mix"
  backend/Datos/gemelos_vecinos.csv              → los 5 condados más parecidos por suelo y clima, para el rango de la "mix"

Salida:
  web/public/data/next/<fips>.json   uno por condado de IA, IL y KS que tenga datos del modelo
  web/src/map/next-available.json    lista de esos condados (el mapa la usa para el botón "Next season")
  web/src/farm/usda-prices.json      precio NASS y costo ERS de maíz y soja por estado (valores por defecto de My Farm)

No inventa datos: lo que falta va en null y se muestra como "Missing data".
Las reglas agronómicas (salud del suelo) van marcadas kind="rule".

Uso:  python3 scripts/build_next_json.py
"""
import csv
import json
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ML = ROOT / "backend" / "Datos"
WEB = ROOT / "web"
OUT = WEB / "public" / "data" / "next"
STATES = {"19": "IA", "17": "IL", "18": "IN", "20": "KS", "27": "MN", "29": "MO", "31": "NE", "38": "ND", "39": "OH", "46": "SD", "55": "WI"}  # estados que muestra el mapa

CROP = {"maiz": "corn", "soja": "soy"}
CROP_LABEL = {"corn": "Corn", "soy": "Soybeans", "wheat": "Winter wheat", "other": "Oats"}
OTHER = {"corn": "soy", "soy": "corn"}
# id de opción en gemelos.json
TWIN_OPT = {
    ("corn", "actual"): "corn", ("corn", "rotado"): "corn_after_soy", ("corn", "continuo"): "corn_after_corn",
    ("soy", "actual"): "soy", ("soy", "rotado"): "soy_after_corn", ("soy", "continuo"): "soy_after_soy",
}
LABEL = {
    ("corn", "actual"): ("Your usual mix", "Corn the way this county usually grows it"),
    ("corn", "rotado"): ("Corn after soybeans", "Rotate fully"),
    ("corn", "continuo"): ("Corn after corn", "Repeat corn"),
    ("soy", "actual"): ("Your usual mix", "Soybeans the way this county usually grows them"),
    ("soy", "rotado"): ("Soybeans after corn", "Rotate fully"),
    ("soy", "continuo"): ("Soybeans after soybeans", "Repeat soybeans"),
}
# Reglas agronómicas generales (no salen del modelo): se muestran como "Rule"
SOIL_RULE = {
    ("corn", "rotado"): ("Alternating with soybeans breaks the corn rootworm and disease cycle, and soybeans leave nitrogen for the next corn.", True),
    ("corn", "continuo"): ("Corn after corn builds up rootworm and residue diseases and needs more nitrogen.", False),
    ("soy", "rotado"): ("Alternating with corn breaks the soybean cyst nematode and disease cycle.", True),
    ("soy", "continuo"): ("Soybeans after soybeans build up cyst nematode and diseases in the soil.", False),
}
SOIL_SCORE = {"rotado": 0.9, "actual": 0.55, "continuo": 0.15}
MODEL_SRC = "Field Rewind model · USDA NASS · NASA POWER"
INCOME_SRC = "Field Rewind model · USDA NASS prices · USDA ERS costs"
PRICE_CROP = {"corn": "maiz", "soy": "soja", "wheat": "trigo_invierno", "oats": "avena"}
STATE_NAME = {"19": "Iowa", "17": "Illinois", "18": "Indiana", "20": "Kansas", "27": "Minnesota", "29": "Missouri",
              "31": "Nebraska", "38": "North Dakota", "39": "Ohio", "46": "South Dakota", "55": "Wisconsin"}


def load_prices():
    """{(fips_estado, cultivo): {"price", "cost", "years"}}; sin precio o sin costo, no entra."""
    out = {}
    p = ML / "precios_costos.csv"
    if not p.exists():
        return out
    with open(p, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["precio_usd_bu"] and r["costo_operativo_usd_ac"]:
                out[(r["fips_estado"].zfill(2), r["cultivo"])] = {
                    "price": float(r["precio_usd_bu"]),
                    "cost": float(r["costo_operativo_usd_ac"]),
                    "years": r["anios"].replace("-", "–"),
                }
    return out


def income(rng, pc):
    """Ingreso sobre costos operativos ($/acre) = rinde × precio − costo. El precio queda fijo: el rango es el del clima."""
    if not rng or not pc:
        return None
    return {k: round(rng[k] * pc["price"] - pc["cost"]) for k in ("p10", "median", "p90")}


def load_decision():
    """Punto 7 (backend/Datos/decision_opciones.csv): puntajes 0..1 por prioridad y métricas en $/acre de cada opción,
    calculados sobre los 15 escenarios de clima. Si no está el archivo, el script puntúa como antes."""
    out = {}
    p = ML / "decision_opciones.csv"
    if not p.exists():
        return out
    with open(p, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            out[(r["fips"].zfill(5), CROP[r["cultivo"]], r["rotacion"])] = r
    return out


def load_ranges():
    out = {}
    with open(ML / "escenarios_rotacion_resumen.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            out[(r["fips"].zfill(5), CROP[r["cultivo"]], r["rotacion"])] = {
                "p10": round(float(r["p10_clima"]), 1),
                "median": round(float(r["mediana_clima"]), 1),
                "p90": round(float(r["p90_clima"]), 1),
            }
    return out


def load_scenarios():
    """{fips: {año_clima: {(cultivo, rotación): rinde predicho}}} del modelo del punto 2."""
    out = {}
    with open(ML / "escenarios_rotacion.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            out.setdefault(r["fips"].zfill(5), {}).setdefault(int(r["anio_clima"]), {})[(CROP[r["cultivo"]], r["rotacion"])] = float(r["pred"])
    return out


def predict(fips, scen, prices):
    """
    Predicción de la pantalla (15/11): una sola opción para la próxima campaña, sin elecciones del usuario.
    Para cada clima pasado (2009–2023) el modelo predice el rinde de las 6 opciones (maíz y soja × habitual, rotado,
    continuo); se pasa a ingreso sobre costos operativos (precio NASS − costo ERS del estado) para poder comparar maíz con
    soja, y gana la que más deja ese año. Probabilidad = años en que ganó / años con dato. Sin precio del estado no se puede
    comparar maíz con soja: queda null ("Missing data").
    """
    by_year = scen.get(fips)
    pcs = {crop: prices.get((fips[:2], PRICE_CROP[crop])) for crop in CROP.values()}
    if not by_year or not all(pcs.values()):
        return None
    wins = {}
    for year in sorted(by_year):
        best = None
        for (crop, rot), y in by_year[year].items():
            v = y * pcs[crop]["price"] - pcs[crop]["cost"]
            if best is None or v > best[0]:
                best = (v, f"{crop}_{rot}")
        if best:
            wins.setdefault(best[1], []).append(year)
    seasons = sum(len(v) for v in wins.values())
    if not seasons:
        return None
    ranked = sorted(wins.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    top, years = ranked[0]
    years_all = sorted(by_year)
    return {
        "option_id": top,
        "crop": top.split("_")[0],
        "probability": round(len(years) / seasons, 2),
        "wins": len(years),
        "seasons": seasons,
        "years": years_all,
        "best_years": years,
        "others": [{"option_id": k, "wins": len(v), "best_years": v} for k, v in ranked[1:]],
        "basis": "income",
        "method": "Share of past seasons' weather (2009–2023) in which this option leaves the most per acre over operating costs, "
                  "among corn and soybeans in three rotations. Same price and cost every year: only the weather changes.",
        "source": f"{MODEL_SRC} · USDA ERS costs",
        "prototype": False,
    }


def reason(r, priority, pro):
    return {
        "priority": priority,
        "text": r["text"],
        "source": r.get("source_label") or "",
        "kind": "model" if r.get("basis") == "model" else "rule",
        "years": r.get("years") or [],
        "pro": pro,
    }


# ---------------------------------------------------------------- mezcla esperada de cultivos (capas 1 y 2)
# Capa 1: la costumbre del condado. Del CDL salen, por año, a = % del maíz sembrado sobre maíz y b = % de la soja
#   sembrada sobre soja. Con la mediana de sus últimos MIX_YEARS años y suponiendo que el área de maíz y de soja se
#   mantiene estable de un año al otro (solo maíz y soja), la parte de maíz es c = (1 - b) / (2 - a - b) y las cuatro
#   transiciones son: maíz tras maíz c·a, maíz tras soja c·(1-a), soja tras soja (1-c)·b, soja tras maíz (1-c)·(1-b).
# Capa 2: los condados parecidos. El rango sale de cuánto se apartaron de su propia costumbre, año a año, el condado
#   y sus 5 condados más parecidos (percentiles 5 y 95 de esos desvíos). Si al condado le falta a o b, usa la mediana
#   de los parecidos. Probado prediciendo 2024 y 2025 solo con los años anteriores: error medio de 1,4 a 1,6 puntos;
#   el valor real cae dentro del rango en el 72 al 84 % de los condados. Usar a los parecidos para mover la cifra
#   central lo empeoró (1,7 a 2,0 puntos), por eso solo entran en el rango.
# No es un modelo de ML: no usa precios ni la predicción. Eso es la capa 3 (docs/specs/pedido-ml-mezcla-capa3.md).
MIX_YEARS = 5
MIX_KEYS = (("soy", "corn"), ("corn", "soy"), ("corn", "corn"), ("soy", "soy"))
MIX_SRC = "USDA CDL · 30 m · similar counties (Field Rewind)"


def load_rotation_rates():
    rates = {}
    with open(ML / "tabla_modelado.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            y = int(r["anio"])
            if r["cultivo"] == "maiz" and r["pct_maiz_tras_maiz"]:
                rates.setdefault(r["fips"], {}).setdefault(y, {})["a"] = float(r["pct_maiz_tras_maiz"]) / 100
            if r["cultivo"] == "soja" and r["pct_soja_tras_soja"]:
                rates.setdefault(r["fips"], {}).setdefault(y, {})["b"] = float(r["pct_soja_tras_soja"]) / 100
    return rates


def load_neighbors(n=5):
    nb = {}
    with open(ML / "gemelos_vecinos.csv", newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if int(r["orden"]) <= n:
                nb.setdefault(r["fips"], []).append(r["fips_vecino"])
    return nb


def _shares(a, b):
    if a + b >= 2:
        return None
    c = (1 - b) / (2 - a - b)
    return {("corn", "corn"): c * a, ("soy", "corn"): c * (1 - a), ("soy", "soy"): (1 - c) * b,
            ("corn", "soy"): (1 - c) * (1 - b), "corn": c}


def _pctl(v, q):
    v = sorted(v)
    i = q * (len(v) - 1)
    lo = int(i)
    return v[lo] + (v[min(lo + 1, len(v) - 1)] - v[lo]) * (i - lo)


def _habit(rates, fips, year):
    """Mediana de a y de b en los MIX_YEARS años anteriores a `year` (los que haya), y cuántos años hubo."""
    r = rates.get(fips, {})
    a = [r[y]["a"] for y in range(year - MIX_YEARS, year) if "a" in r.get(y, {})]
    b = [r[y]["b"] for y in range(year - MIX_YEARS, year) if "b" in r.get(y, {})]
    return (statistics.median(a) if a else None, statistics.median(b) if b else None, len(a), len(b))


def _deviations(rates, fips):
    """Cuánto se apartó cada año de la costumbre de sus 5 años anteriores, por transición."""
    out = {}
    r = rates.get(fips, {})
    for y in sorted(r):
        if "a" in r[y] and "b" in r[y]:
            a, b, _, _ = _habit(rates, fips, y)
            if a is None or b is None:
                continue
            p, act = _shares(a, b), _shares(r[y]["a"], r[y]["b"])
            if p and act:
                for k in p:
                    out.setdefault(k, []).append(act[k] - p[k])
    return out


def crop_mix(fips, rates, neighbors, nxt):
    """Mezcla esperada para la temporada `nxt` (la siguiente al último mapa del CDL, igual para todos los condados)."""
    a, b, na, nb_ = _habit(rates, fips, nxt)
    near = [g for g in neighbors.get(fips, []) if g in rates]
    filled = []
    if a is None or b is None:
        ta = [x for x in (_habit(rates, g, nxt)[0] for g in near) if x is not None]
        tb = [x for x in (_habit(rates, g, nxt)[1] for g in near) if x is not None]
        if a is None and ta:
            a = statistics.median(ta)
            filled.append("corn after corn")
        if b is None and tb:
            b = statistics.median(tb)
            filled.append("soybeans after soybeans")
    if a is None or b is None:
        return None
    mid = _shares(a, b)
    if not mid:
        return None
    dev = {}
    for g in [fips] + near:
        for k, v in _deviations(rates, g).items():
            dev.setdefault(k, []).extend(v)

    def pct(x):
        return round(100 * min(1, max(0, x)), 1)

    def rng(k):
        v = dev.get(k, [])
        if len(v) < 4:
            return {"pct": pct(mid[k]), "low": None, "high": None}
        return {"pct": pct(mid[k]), "low": pct(mid[k] + _pctl(v, 0.05)), "high": pct(mid[k] + _pctl(v, 0.95))}

    corn = rng("corn")
    width = (corn["high"] - corn["low"]) if corn["low"] is not None else None
    years = sorted(y for y in range(nxt - MIX_YEARS, nxt) if y in rates.get(fips, {}))
    if filled or width is None or min(na, nb_) < 3 or width > 10:
        level = "low"
    elif width <= 6:
        level = "high"
    else:
        level = "medium"
    if filled:
        reason = f"Filled from similar counties: {', '.join(filled)}."
    elif width is None:
        reason = "Too few past years to know how much it moves."
    else:
        reason = (f"From {min(na, nb_)} of the last {MIX_YEARS} USDA crop maps. In most years the corn share here and in "
                  f"similar counties moved within about {width:.0f} points.")
    return {
        "season": nxt,
        "basis": "corn_soy_ground",
        "years": years,
        "items": [{"from": f, "to": t, **rng((f, t))} for f, t in MIX_KEYS],
        "corn_pct": corn,
        "neighbors": near,
        "filled_from_neighbors": filled,
        "confidence": {"level": level, "reason": reason},
        "method": (f"This county's usual crop changes over its last {MIX_YEARS} USDA crop maps, assuming its corn and soybean "
                   "area stays about the same. The range is how far this county and its 5 most similar counties moved away "
                   "from their own habit in past years (most years fall inside). It does not use prices or the yield model yet."),
        "source": MIX_SRC,
        "prototype": False,
    }


def cdl_context(fips, explic):
    """Mezcla de rotaciones del condado: del CDL de la pantalla 2 si existe; si no, la frase del modelo."""
    p = WEB / "public" / "data" / "county" / f"{fips}.json"
    if p.exists():
        c = json.loads(p.read_text(encoding="utf-8"))
        rot = c.get("common_rotations")
        if rot and rot.get("items"):
            items = [{"from": i["from"], "to": i["to"], "label": i["label"], "pct": round(i["pct"], 1)}
                     for i in rot["items"] if i["from"] in ("corn", "soy") and i["to"] in ("corn", "soy")]
            return {"items": items, "source": rot.get("source", "USDA CDL"), "prototype": bool(rot.get("prototype"))}
    texts = {}
    for es, crop in CROP.items():
        r = next((x for x in explic.get(es, {}).get("actual", {}).get("reasons", []) if x["type"] == "rotation"), None)
        if r:
            texts[crop] = r["text"].split(". ")[0] + "."
    return {"items": [], "text": texts, "source": "USDA CDL + NASS", "prototype": False}


def score_from_decision(opts, fips, crop, decision):
    """Llena scores (risk, income, soil) con el punto 7 y agrega la razón de riesgo en plata (CVaR de los peores años).
    Devuelve False si falta el punto 7 para alguna opción con rango (entonces se puntúa como antes)."""
    rows = {o["rotation"]: decision.get((fips, crop, o["rotation"])) for o in opts if o["yield_bu_ac"]}
    if not rows or any(r is None for r in rows.values()):
        return False
    for o in opts:
        r = rows.get(o["rotation"])
        if r:
            for p in ("risk", "income", "soil"):
                v = r.get(f"score_{p}")
                o["scores"][p] = round(float(v), 2) if v not in (None, "") else None
    if len(rows) >= 2:
        best = max((o for o in opts if o["rotation"] in rows), key=lambda o: float(rows[o["rotation"]]["cvar10_usd_ac"]))
        rb = rows[best["rotation"]]
        years = [int(a) for a in rb["anios_peores"].split(";") if a]
        others = [o for o in opts if o["rotation"] in rows and o is not best]
        ref = next((o for o in others if o["is_current"]), others[0])
        name = "your usual mix" if best["is_current"] else best["label"].lower()
        ref_name = "your usual mix" if ref["is_current"] else ref["label"].lower()
        best["reasons"].insert(0, {
            "priority": "risk",
            "text": f"In the {len(years)} worst climate years ({', '.join(map(str, years))}), {name} leaves about "
                    f"${float(rb['cvar10_usd_ac']):,.0f}/acre over operating costs, against "
                    f"${float(rows[ref['rotation']]['cvar10_usd_ac']):,.0f} with {ref_name}.",
            "source": INCOME_SRC, "kind": "model", "years": years, "pro": True,
        })
    return True


def build_crop(fips, crop, ranges, explic_crop, twins_county, pc, decision=None):
    opts = []
    for rot in ("actual", "rotado", "continuo"):
        rng = ranges.get((fips, crop, rot))
        ex = explic_crop.get(rot, {})
        tw = (twins_county or {}).get("options", {}).get(TWIN_OPT[(crop, rot)])
        label, sub = LABEL[(crop, rot)]
        reasons = []
        for r in ex.get("reasons", []):
            if r["type"] == "rotation":
                v = r.get("value_bu_ac")
                if v is None:  # opción "habitual": la frase dice cuánto se repite el cultivo
                    reasons.append(reason(r, "yield", True))
                else:
                    reasons.append(reason(r, "yield", v > 0))
            elif r["type"] == "climate_bad_years":
                reasons.append(reason(r, "risk", False))
            elif r["type"] in ("county_level", "soil"):
                # Nivel propio del condado (suelo y manejo) o grupo de suelo del modelo: habla del rinde
                reasons.append(reason(r, "yield", (r.get("value_bu_ac") or 0) > 0))
            elif r["type"] == "soil_rule":
                # Regla de SSURGO: cuánta agua retiene el suelo; pesa en los años secos
                reasons.append(reason(r, "risk", r.get("sign", 0) > 0))
        if (crop, rot) in SOIL_RULE:
            text, pro = SOIL_RULE[(crop, rot)]
            reasons.append({"priority": "soil", "text": text, "source": "Agronomic rule", "kind": "rule", "years": [], "pro": pro})
        opts.append({
            "id": f"{crop}_{rot}",
            "crop": crop,
            "rotation": rot,
            "label": label,
            "sublabel": sub,
            "is_current": rot == "actual",
            "yield_bu_ac": rng,
            "income_usd_ac": income(rng, pc),
            "scores": {"risk": None, "income": None, "soil": SOIL_SCORE[rot], "water": None},
            "suggested_for": [],
            "confidence": ex.get("confidence") or {"level": "low", "reason": "Missing data: no model explanation for this option."},
            "extrapolated": False,
            "reasons": reasons,
            "range_driver": ex.get("range_driver"),
            "twins": tw["twins"] if tw else [],
            "twins_note": {
                "text": tw["text"],
                "range": tw["twins_range"] if tw.get("use_as_range") else None,
                "confidence": tw["confidence"],
            } if tw else None,
            "source": MODEL_SRC,
            "prototype": False,
        })

    # Punto 7: si están sus puntajes, mandan (riesgo con el CVaR de los peores años, ingreso medio y regla de suelo)
    del_punto7 = bool(decision) and score_from_decision(opts, fips, crop, decision)

    # Riesgo: el piso en un año malo (p10), comparado entre las tres opciones (sin el punto 7)
    p10s = [o["yield_bu_ac"]["p10"] for o in opts if o["yield_bu_ac"]]
    if len(p10s) >= 2 and not del_punto7:
        lo, hi = min(p10s), max(p10s)
        for o in opts:
            if o["yield_bu_ac"]:
                o["scores"]["risk"] = round(0.5 if hi == lo else (o["yield_bu_ac"]["p10"] - lo) / (hi - lo), 2)
        best = max((o for o in opts if o["yield_bu_ac"]), key=lambda o: o["yield_bu_ac"]["p10"])
        bad_years = next((r["years"] for r in best["reasons"] if r["priority"] == "risk" and r["years"]), [])
        best["reasons"].insert(0, {
            "priority": "risk",
            "text": f"In a bad-weather year (the low 10%), {best['label'].lower() if not best['is_current'] else 'your usual mix'} "
                    f"still gives about {best['yield_bu_ac']['p10']:.0f} bu/ac here, the best floor of the three options.",
            "source": MODEL_SRC, "kind": "model", "years": bad_years[:3], "pro": True,
        })

    # Ingreso: lo que deja un año típico (mediana), comparado entre las tres opciones.
    # El precio y el costo son los mismos para las tres (ERS no separa rotaciones), así que el orden
    # es el del rinde mediano; lo que suma es pasarlo a dólares.
    meds = [o["income_usd_ac"]["median"] for o in opts if o["income_usd_ac"]]
    if len(meds) >= 2:
        lo, hi = min(meds), max(meds)
        for o in opts:
            if o["income_usd_ac"] and not del_punto7:
                o["scores"]["income"] = round(0.5 if hi == lo else (o["income_usd_ac"]["median"] - lo) / (hi - lo), 2)
        best = max((o for o in opts if o["income_usd_ac"]), key=lambda o: o["income_usd_ac"]["median"])
        inc = best["income_usd_ac"]
        nombre = best['label'].lower() if not best['is_current'] else 'your usual mix'
        fila7 = decision.get((fips, crop, best["rotation"])) if del_punto7 else None
        if fila7:
            # Con el punto 7: el promedio de los 15 años de clima; el "año malo" lo cuenta la razón de riesgo (CVaR)
            cuanto = (f"On average over {fila7['n_escenarios']} climate years, {nombre} would leave about "
                      f"${float(fila7['ingreso_medio_usd_ac']):,.0f}/acre over operating costs, the most of the three. ")
        else:
            cuanto = (f"In a typical year, {nombre} would leave about "
                      f"${inc['median']:,}/acre over operating costs (${inc['p10']:,} in a bad year), the most of the three. ")
        best["reasons"].insert(0, {
            "priority": "income",
            "text": cuanto +
                    f"Uses the {pc['years']} median {STATE_NAME[fips[:2]]} price (${pc['price']:.2f}/bu) and the same "
                    f"${pc['cost']:.0f}/acre operating cost for every option.",
            "source": INCOME_SRC, "kind": "model", "years": [], "pro": True,
        })

    for p in ("risk", "income", "soil", "water"):
        scored = [o for o in opts if o["scores"][p] is not None]
        if scored:
            max(scored, key=lambda o: o["scores"][p])["suggested_for"].append(p)
    return {"crop": crop, "label": CROP_LABEL[crop], "options": opts}


def income_missing(fips, prices, crops=None):
    st = STATE_NAME[fips[:2]]
    if not all((fips[:2], es) in prices for es in CROP):
        return [{"what": "Income ($/acre)", "why": f"No USDA NASS price or ERS cost for {st}."}]
    out = [{"what": "Cost by rotation",
            "why": "USDA ERS gives one operating cost per crop, so every option uses the same cost. "
                   "Corn after corn usually needs more nitrogen, so its income here is likely too high."},
           {"what": "Cost for this county",
            "why": f"Operating costs are the USDA ERS average for {st}'s farm region, not this county's. "
                   "Your own costs may be higher or lower."}]
    negativas = sorted({o["label"] for c in (crops or {}).values() for o in c["options"]
                        if o["income_usd_ac"] and o["income_usd_ac"]["median"] < 0})
    if negativas:
        out.append({"what": "Income below zero",
                    "why": "At the regional average cost, a typical year leaves less than the operating cost here "
                           f"({', '.join(negativas)}). With lower local costs the result can be positive."})
    return out


def main():
    ranges = load_ranges()
    prices = load_prices()
    scen = load_scenarios()
    rates = load_rotation_rates()
    neighbors = load_neighbors()
    mix_season = max(y for r in rates.values() for y in r) + 1
    decision = load_decision()
    explic = json.loads((ML / "front" / "explicaciones.json").read_text(encoding="utf-8"))
    twins = json.loads((ML / "front" / "gemelos.json").read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    written = []
    for fips, ex in explic["counties"].items():
        if fips[:2] not in STATES:
            continue
        tc = twins["counties"].get(fips)
        crops = {crop: build_crop(fips, crop, ranges, ex.get(es, {}), tc, prices.get((fips[:2], es)), decision)
                 for es, crop in CROP.items()}
        explore = []
        for key in ("wheat", "oats"):
            o = (tc or {}).get("options", {}).get(key)
            if o and o.get("use_as_range") and not o.get("county_does_it"):
                explore.append({"id": key, "crop": o["crop"], "label": CROP_LABEL.get(o["crop"], key.title()),
                                "twins": o["twins"], "range": o["twins_range"], "confidence": o["confidence"], "text": o["text"],
                                "income_usd_ac": income(o["twins_range"], prices.get((fips[:2], PRICE_CROP[key])))})
        data = {
            "fips": fips,
            "name": tc["name"] if tc else fips,
            "state": STATES[fips[:2]],
            "centroid": tc["centroid"] if tc else None,
            "metric": "yield_bu_ac",
            "source": "Field Rewind ML (2009–2023) · USDA NASS · USDA CDL · NASA POWER · NASA IMERG · SSURGO",
            "prototype": False,
            "note": explic.get("note"),
            "default_crop": "corn",
            "prediction": predict(fips, scen, prices),
            "mix": crop_mix(fips, rates, neighbors, mix_season),
            "rotation_context": cdl_context(fips, ex),
            "crops": crops,
            "twins": [{**t, "source": t.get("source", ""), "prototype": bool(t.get("prototype"))} for t in (tc or {}).get("twins", [])],
            "explore": explore,
            "missing": income_missing(fips, prices, crops) + [
                {"what": "Water use", "why": "No data separates these options for water."},
            ],
            "contract": {"explicaciones": explic.get("version_contrato"), "gemelos": twins.get("version_contrato")},
        }
        (OUT / f"{fips}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        written.append(fips)
    written.sort()
    (WEB / "src" / "map" / "next-available.json").write_text(json.dumps(written) + "\n")
    # My Farm: el productor puede usar su precio y su costo; si no, estos (USDA)
    prices = load_prices()
    farm = {}
    for (st, cult), v in sorted(prices.items()):
        crop = {"maiz": "corn", "soja": "soy"}.get(cult)
        if crop:
            farm.setdefault(st, {})[crop] = {"price": v["price"], "cost": v["cost"], "years": v["years"]}
    (WEB / "src" / "farm").mkdir(exist_ok=True)
    (WEB / "src" / "farm" / "usda-prices.json").write_text(json.dumps(farm, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(written)} condados →", OUT)


if __name__ == "__main__":
    main()
