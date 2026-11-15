#!/usr/bin/env python3
"""
Precio y costo por acre para pasar el rango de rinde a ingreso ($/acre) en "Next season".

Entrada (de la entrega, fuera de Git):
  <entrega>/condado/extras/economia_anual.csv
    precio_usd_bu           precio recibido por el productor, NASS, por estado y año comercial
    costo_operativo_usd_ac  costos operativos por acre sembrado, USDA ERS, región Heartland
                            (el mismo valor para IA, IL e IN)

Salida (va a Git, es chica):
  backend/Datos/precios_costos.csv   una fila por estado y cultivo:
    fips_estado, cultivo, precio_usd_bu, costo_operativo_usd_ac, anios, n_anios_precio, n_anios_costo

Qué hace: la mediana de 2021–2025 de cada columna, por estado y cultivo. No completa nada: si un
estado no tiene precio de un cultivo (Iowa no tiene trigo de invierno desde 2019), queda vacío y el
front muestra "Missing data".

Por qué una mediana de varios años: el ingreso de la próxima campaña depende de un precio que todavía
no se conoce. Con un solo año, el resultado cambia mucho según cuál se elija (el maíz pasó de 6,62
a 4,10 USD/bu entre 2022 y 2025). La mediana de 5 años no lo predice: es un precio de referencia,
y el front lo dice así.

Límites (se muestran en el front):
  - ERS no separa costos por rotación: el costo es el mismo para maíz tras soja y maíz tras maíz.
    En la realidad el maíz tras maíz lleva más nitrógeno, así que su ingreso queda sobreestimado.
  - Es ingreso menos costos operativos (semilla, fertilizante, químicos, combustible, etc.). No resta
    tierra, mano de obra propia ni amortizaciones.
  - El rango p10–p90 del ingreso refleja solo el clima (el rango de rinde), con el precio fijo.

Uso (desde la raíz del repo):
  python -X utf8 scripts/build_precios_costos.py [ruta/a/economia_anual.csv]
"""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
ENTREGAS = ROOT / "backend" / "Datos" / "entregas"
SALIDA = ROOT / "backend" / "Datos" / "precios_costos.csv"
ANIOS = list(range(2021, 2026))
ESTADOS = ["17", "18", "19"]  # IL, IN, IA: los del modelo
CULTIVOS = ["maiz", "soja", "trigo_invierno", "avena"]


def buscar_entrada():
    if len(sys.argv) > 1:
        return Path(sys.argv[1])
    for v in ("fieldshift_datos_v3", "fieldshift_datos_v2"):  # el archivo es idéntico en las dos
        p = ENTREGAS / v / "condado" / "extras" / "economia_anual.csv"
        if p.exists():
            return p
    sys.exit(f"No encontré economia_anual.csv en {ENTREGAS}/fieldshift_datos_v3 ni v2. Pasá la ruta como argumento.")


def main():
    entrada = buscar_entrada()
    eco = pd.read_csv(entrada, dtype={"fips_estado": str})
    eco = eco[eco["anio"].isin(ANIOS) & eco["fips_estado"].isin(ESTADOS) & eco["cultivo"].isin(CULTIVOS)]

    filas = []
    for (est, cult), g in eco.groupby(["fips_estado", "cultivo"]):
        precio = g["precio_usd_bu"].dropna()
        costo = g["costo_operativo_usd_ac"].dropna()
        filas.append({
            "fips_estado": est,
            "cultivo": cult,
            # con menos de 3 años no hay referencia: queda vacío
            "precio_usd_bu": round(precio.median(), 2) if len(precio) >= 3 else None,
            "costo_operativo_usd_ac": round(costo.median(), 2) if len(costo) >= 3 else None,
            "anios": f"{ANIOS[0]}-{ANIOS[-1]}",
            "n_anios_precio": len(precio),
            "n_anios_costo": len(costo),
        })
    # estados y cultivos sin ninguna fila en esos años también van, vacíos
    hay = {(f["fips_estado"], f["cultivo"]) for f in filas}
    for est in ESTADOS:
        for cult in CULTIVOS:
            if (est, cult) not in hay:
                filas.append({"fips_estado": est, "cultivo": cult, "precio_usd_bu": None, "costo_operativo_usd_ac": None,
                              "anios": f"{ANIOS[0]}-{ANIOS[-1]}", "n_anios_precio": 0, "n_anios_costo": 0})

    out = pd.DataFrame(filas).sort_values(["fips_estado", "cultivo"])
    out.to_csv(SALIDA, index=False)
    print(f"Leído {entrada}")
    print(out.to_string(index=False))
    print(f"Guardado {SALIDA.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
