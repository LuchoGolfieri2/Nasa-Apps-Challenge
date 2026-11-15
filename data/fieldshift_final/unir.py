"""Rearma tabla_mensual.csv (igual byte a byte a la de la entrega) con las 11 partes por estado.

Uso: python data/fieldshift_final/unir.py [carpeta_salida]
"""
import hashlib
import sys
import zipfile
from pathlib import Path

D = Path(__file__).resolve().parent
salida = Path(sys.argv[1]) if len(sys.argv) > 1 else D
salida.mkdir(parents=True, exist_ok=True)

partes = sorted(D.glob("tabla_mensual_*.zip"))
assert len(partes) == 11, f"faltan partes: hay {len(partes)} de 11"
destino = salida / "tabla_mensual.csv"
h = hashlib.sha256()
with open(destino, "wb") as f:
    for i, p in enumerate(partes):
        with zipfile.ZipFile(p) as z:
            datos = z.read(z.namelist()[0])
        if i:
            datos = datos.split(b"\n", 1)[1]  # el encabezado va una sola vez
        f.write(datos)
        h.update(datos)

esperado = next(l.split(",")[-1] for l in (D / "contenido.csv").read_text(encoding="utf-8").splitlines()
                if l.startswith("_completo,tabla_mensual.csv"))
print(destino, "OK" if h.hexdigest() == esperado else "NO COINCIDE el sha256")
