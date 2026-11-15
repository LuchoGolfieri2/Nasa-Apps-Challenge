#!/usr/bin/env python3
"""
Arma los JSON de la pantalla 3 ("Next season") con datos reales:

  backend/Datos/escenarios_rotacion_resumen.csv  → rango p10 / mediana / p90 por opción (modelo del punto 2)
  backend/Datos/front/explicaciones.json         → razones, riesgos, confianza y años (punto 3)
  backend/Datos/front/gemelos.json               → condados gemelos por opción y cultivos nuevos (punto 5)
  backend/Datos/precios_costos.csv               → precio NASS y costo operativo ERS por estado (scripts/build_precios_costos.py)
  web/public/data/county/<fips>.json             → mezcla de rotaciones del CDL (si el condado tiene historia)

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
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ML = ROOT / "backend" / "Datos"
WEB = ROOT / "web"
OUT = WEB / "public" / "data" / "next"
STATES = {"19": "IA", "17": "IL", "18": "IN", "20": "KS", "27": "MN", "29": "MO", "31": "NE", "39": "OH", "46": "SD", "55": "WI"}  # estados que muestra el mapa

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
              "31": "Nebraska", "39": "Ohio", "46": "South Dakota", "55": "Wisconsin"}


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


def load_ranges():
    out = {}
    with open(ML / "escenarios_rotacion_resumen.csv", newline="") as f:
        for r in csv.DictReader(f):
            out[(r["fips"].zfill(5), CROP[r["cultivo"]], r["rotacion"])] = {
                "p10": round(float(r["p10_clima"]), 1),
                "median": round(float(r["mediana_clima"]), 1),
                "p90": round(float(r["p90_clima"]), 1),
            }
    return out


def reason(r, priority, pro):
    return {
        "priority": priority,
        "text": r["text"],
        "source": r.get("source_label") or "",
        "kind": "model" if r.get("basis") == "model" else "rule",
        "years": r.get("years") or [],
        "pro": pro,
    }


def cdl_context(fips, explic):
    """Mezcla de rotaciones del condado: del CDL de la pantalla 2 si existe; si no, la frase del modelo."""
    p = WEB / "public" / "data" / "county" / f"{fips}.json"
    if p.exists():
        c = json.loads(p.read_text())
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


def build_crop(fips, crop, ranges, explic_crop, twins_county, pc):
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

    # Riesgo: el piso en un año malo (p10), comparado entre las tres opciones
    p10s = [o["yield_bu_ac"]["p10"] for o in opts if o["yield_bu_ac"]]
    if len(p10s) >= 2:
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
            if o["income_usd_ac"]:
                o["scores"]["income"] = round(0.5 if hi == lo else (o["income_usd_ac"]["median"] - lo) / (hi - lo), 2)
        best = max((o for o in opts if o["income_usd_ac"]), key=lambda o: o["income_usd_ac"]["median"])
        inc = best["income_usd_ac"]
        best["reasons"].insert(0, {
            "priority": "income",
            "text": f"In a typical year, {best['label'].lower() if not best['is_current'] else 'your usual mix'} would leave about "
                    f"${inc['median']:,}/acre over operating costs (${inc['p10']:,} in a bad year), the most of the three. "
                    f"Uses the {pc['years']} median {STATE_NAME[fips[:2]]} price (${pc['price']:.2f}/bu) and the same "
                    f"${pc['cost']:.0f}/acre operating cost for every option.",
            "source": INCOME_SRC, "kind": "model", "years": [], "pro": True,
        })

    for p in ("risk", "income", "soil", "water"):
        scored = [o for o in opts if o["scores"][p] is not None]
        if scored:
            max(scored, key=lambda o: o["scores"][p])["suggested_for"].append(p)
    return {"crop": crop, "label": CROP_LABEL[crop], "options": opts}


def income_missing(fips, prices):
    st = STATE_NAME[fips[:2]]
    if not all((fips[:2], es) in prices for es in CROP):
        return [{"what": "Income ($/acre)", "why": f"No USDA NASS price or ERS cost for {st}."}]
    return [{"what": "Cost by rotation",
             "why": "USDA ERS gives one operating cost per crop, so every option uses the same cost. "
                    "Corn after corn usually needs more nitrogen, so its income here is likely too high."}]


def main():
    ranges = load_ranges()
    prices = load_prices()
    explic = json.loads((ML / "front" / "explicaciones.json").read_text())
    twins = json.loads((ML / "front" / "gemelos.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    written = []
    for fips, ex in explic["counties"].items():
        if fips[:2] not in STATES:
            continue
        tc = twins["counties"].get(fips)
        crops = {crop: build_crop(fips, crop, ranges, ex.get(es, {}), tc, prices.get((fips[:2], es)))
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
            "rotation_context": cdl_context(fips, ex),
            "crops": crops,
            "twins": [{**t, "source": t.get("source", ""), "prototype": bool(t.get("prototype"))} for t in (tc or {}).get("twins", [])],
            "explore": explore,
            "missing": income_missing(fips, prices) + [
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
