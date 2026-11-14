#!/usr/bin/env python3
"""
Genera web/public/data/next/20191.json con DATOS DE PRUEBA (inventados) para
la pantalla "Next season" de Sumner County, KS.

Sigue el contrato de la spec (front-back-connection-spec.md §3):
metric = yield_bu_ac, rango p10/median/p90, scores por prioridad, suggested_for,
confidence.reason, twins[], source y prototype en cada bloque.

Cuando ML / Datos entreguen lo real, este archivo se reemplaza y "prototype" pasa a false.
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "next" / "20191.json"
PRIORITIES = ["risk", "income", "soil", "water"]

# Rinde por cultivo en Sumner (bu/acre) — INVENTADO, con órdenes de magnitud razonables
CROPS = {
    "wheat": dict(label="Wheat", rng=(27, 41, 53), usual=40, risk=0.72, soil=0.30, water=0.74,
                  conf=("high", "Wheat grew on most Sumner fields in all 11 seasons."), twins=["20077", "20155", "20169"]),
    "soy": dict(label="Soybeans", rng=(14, 29, 43), usual=30, risk=0.44, soil=0.86, water=0.50,
                     conf=("medium", "Soybeans cover about 1 in 5 fields here, mostly after wheat."), twins=["20155", "19145", "17189"]),
    "sorghum": dict(label="Sorghum", rng=(47, 76, 98), usual=74, risk=0.80, soil=0.58, water=0.88,
                    conf=("medium", "Sorghum is common in counties like yours, less so in Sumner."), twins=["20077", "20169", "20155"]),
    "corn": dict(label="Corn", rng=(34, 88, 126), usual=92, risk=0.24, soil=0.48, water=0.18,
                 conf=("low", "Low confidence: few counties like yours grow dryland corn."), twins=["19145", "17189"]),
}

REASONS = {
    "wheat": [
        dict(priority="risk", kind="model", source="USDA NASS", years=[2018, 2022, 2023],
             text="In the 3 driest years, wheat held about 70% of its usual yield."),
        dict(priority="water", kind="rule", source="NASA POWER", years=[2022, 2023],
             text="Wheat grows before the July dry spell, when soil water is highest."),
        dict(priority="soil", kind="rule", source="USDA CDL", years=[2019, 2020, 2021], pro=False,
             text="Wheat after wheat again: 3+ years without a break crop wears soil down."),
        dict(priority="soil", kind="rule", source="USDA CDL", years=[2021, 2024], only_rotating=True,
             text="Wheat after a break crop keeps your rotation going."),
    ],
    "soy": [
        dict(priority="soil", kind="rule", source="USDA CDL", years=[2017, 2021],
             text="A legume after wheat breaks the cycle and adds nitrogen to the soil."),
        dict(priority="soil", kind="model", source="USDA NASS", years=[2018, 2022],
             text="On fields like yours, wheat did better the year after soybeans."),
        dict(priority="risk", kind="model", source="USDA NASS", years=[2022, 2023],
             pro=False,
             text="Soybeans lost about half their yield in the 2 driest summers."),
        dict(priority="water", kind="model", source="NASA SMAP", years=[2022],
             pro=False,
             text="Soybeans need soil water in August, when it is lowest here."),
    ],
    "sorghum": [
        dict(priority="risk", kind="model", source="USDA NASS", years=[2018, 2022, 2023],
             text="In dry years sorghum kept about 80% of its usual yield in twin counties."),
        dict(priority="water", kind="rule", source="NASA POWER", years=[2022, 2023],
             text="Sorghum needs the least water of the four crops in a dry July."),
        dict(priority="soil", kind="rule", source="USDA CDL", years=[2020],
             text="Sorghum breaks the wheat cycle and leaves residue that protects soil."),
    ],
    "corn": [
        dict(priority="risk", kind="model", source="USDA NASS", years=[2022, 2023],
             pro=False,
             text="Dryland corn dropped below 40% of its usual yield in dry years."),
        dict(priority="water", kind="rule", source="NASA POWER", years=[2022, 2023],
             pro=False,
             text="Corn needs the most water in July, the driest month here."),
        dict(priority="soil", kind="rule", source="USDA CDL", years=[2021],
             text="Corn breaks the wheat cycle but takes a lot of nitrogen."),
    ],
}

NOTES = {
    "wheat": (["Steady in dry years (Model · USDA NASS)", "Known crop, known equipment (Rule)"],
              ["Soil wears down without a break crop (Rule · USDA CDL)"]),
    "soy": (["Adds nitrogen for the next wheat (Rule)", "Breaks weed and disease cycles (Rule)"],
                 ["Yield swings with August rain (Model · NASA POWER)"]),
    "sorghum": (["Best yield floor in dry years (Model · USDA NASS)", "Lowest water need (Rule · NASA POWER)"],
                ["Fewer Sumner fields to compare with (Model)"]),
    "corn": (["Highest yield in a wet year (Model · USDA NASS)"],
             ["Big losses in a dry July (Model · NASA POWER)", "Seen mostly in distant twin counties (Model)"]),
}

ROTATIONS = [
    dict(id="wheat-wheat", sequence=["wheat", "wheat"], share_pct=38, next=["wheat", "soy", "corn"]),
    dict(id="wheat-soybeans", sequence=["wheat", "soy"], share_pct=24, next=["wheat", "sorghum", "corn"]),
    dict(id="wheat-sorghum", sequence=["wheat", "sorghum"], share_pct=14, next=["wheat", "soy", "corn"]),
]


def note(text):
    kind = "model" if "(Model" in text else "rule"
    source = text.split("·")[-1].strip(" )") if "·" in text else ""
    return dict(text=text.split(" (")[0], kind=kind, source=source)


def option(crop, rotation, is_current):
    c = CROPS[crop]
    # en rotaciones que ya alternan, seguir con trigo no castiga al suelo
    soil = c["soil"] + (0.35 if crop == "wheat" and rotation["id"] != "wheat-wheat" else 0)
    p10, med, p90 = c["rng"]
    return dict(
        id=f"{rotation['id']}__{crop}", crop=crop, label=c["label"], is_current=is_current,
        yield_bu_ac=dict(p10=p10, median=med, p90=p90), usual_bu_ac=c["usual"],
        income_usd_ac=None,  # falta el dataset de costos
        scores=dict(risk=c["risk"], income=None, soil=round(min(soil, 0.95), 2), water=c["water"]),
        suggested_for=[],
        confidence=dict(level=c["conf"][0], reason=c["conf"][1]),
        extrapolated=c["conf"][0] == "low",
        reasons=[
            {**{k: v for k, v in r.items() if k != "only_rotating"}, "pro": r.get("pro", True)}
            for r in REASONS[crop]
            if not (crop == "wheat" and r["priority"] == "soil" and (r.get("only_rotating", False) == (rotation["id"] == "wheat-wheat")))
        ],
        benefits=[note(t) for t in NOTES[crop][0]], risks=[note(t) for t in NOTES[crop][1]],
        twins=c["twins"], source="Field Rewind ML · USDA NASS", prototype=True,
    )


def main():
    rotations = []
    for r in ROTATIONS:
        opts = [option(crop, r, i == 0) for i, crop in enumerate(r["next"])]
        for p in PRIORITIES:
            scored = [o for o in opts if o["scores"][p] is not None]
            if scored:
                max(scored, key=lambda o: o["scores"][p])["suggested_for"].append(p)
        rotations.append(dict(id=r["id"], sequence=r["sequence"], share_pct=r["share_pct"], options=opts,
                              source="USDA CDL 2015–2025", prototype=True))
    data = dict(
        fips="20191", name="Sumner", state="KS", centroid=[-97.48, 37.24],
        metric="yield_bu_ac", prototype=True, source="Mock data generated by scripts/make_mock_next.py",
        default_rotation="wheat-wheat", rotations=rotations,
        twins=[
            dict(fips="20077", name="Harper", state="KS", centroid=[-98.08, 37.19], similar_on=["soil type", "July rainfall"], grew_crop_pct=dict(wheat=64, sorghum=12, soy=6), source="USDA CDL · NASA POWER", prototype=True),
            dict(fips="20155", name="Reno", state="KS", centroid=[-98.09, 37.95], similar_on=["growing season", "soil moisture"], grew_crop_pct=dict(wheat=41, sorghum=17, soy=14, corn=11), source="USDA CDL · NASA SMAP", prototype=True),
            dict(fips="20169", name="Saline", state="KS", centroid=[-97.65, 38.78], similar_on=["soil type", "growing season"], grew_crop_pct=dict(wheat=47, sorghum=19, soy=15), source="USDA CDL · NASA POWER", prototype=True),
            dict(fips="19145", name="Page", state="IA", centroid=[-95.15, 40.74], similar_on=["soil type"], grew_crop_pct=dict(corn=48, soy=41), source="USDA CDL", prototype=True),
            dict(fips="17189", name="Washington", state="IL", centroid=[-89.41, 38.35], similar_on=["July rainfall", "soil moisture"], grew_crop_pct=dict(corn=34, soy=38, wheat=17), source="USDA CDL · NASA SMAP", prototype=True),
        ],
        missing=[
            dict(what="Income ($/acre)", why="Costs dataset not loaded yet."),
            dict(what="Real yield model", why="All ranges on this screen are prototype data."),
        ],
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("escrito", OUT, OUT.stat().st_size, "bytes")
    for r in rotations:
        print(r["id"], {o["crop"]: o["suggested_for"] for o in r["options"]})


if __name__ == "__main__":
    main()
