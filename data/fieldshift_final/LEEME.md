# Datos finales de Field Shift (entrega del 2026-11-15)

Son los datos procesados de la entrega final `fieldshift_datos_final_20261115`: **11 estados, 972 condados,
2000–2025**, y los 219 departamentos de Argentina. Están partidos en zips de menos de 7 MB para que entren en
GitHub. Cada zip se abre solo; no hace falta juntarlos para usarlos.

Los archivos de adentro son **idénticos byte a byte** a los de la entrega (sha256 en `contenido.csv`). Ningún valor
se inventó: los faltantes son celdas vacías.

## Qué hay

| zip | qué tiene |
|---|---|
| `tabla_anual.zip` | `tabla_anual.csv`: una fila por `fips` × `anio` × `cultivo`, 83.204 filas y 110 columnas. Rinde, superficie, precios, costos, clima de la temporada, suelo y aptitud. |
| `tabla_mensual_<fips_estado>_<estado>.zip` | `tabla_mensual.csv` cortada por estado (11 zips): una fila por `fips` × `anio` × `mes`, 68 columnas, de 2000-01 a 2025-12. Las 11 partes juntas suman las 303.264 filas. |
| `referencia_y_mapas.zip` | `unido/diccionario.csv` (qué es cada columna, su unidad y su `rol`), `unido/columnas_vacias.csv`, `unido/referencia/condados.csv` y `anios.csv`, y `para_front/`: `condados_eeuu.geojson` y `.csv`, `estados_eeuu.csv`, `departamentos_argentina.geojson` y `.csv`. También el LEEME de la entrega completa. |
| `argentina.zip` | `argentina/`: análogos por departamento, clima por campaña de Buenos Aires, suelo de SoilGrids, rindes del MAGyP y su comparación con EE.UU., el informe y el código. |
| `contenido.csv` | Cada archivo de cada zip con su cantidad de filas, bytes y sha256. |

No están acá, porque son pesados y el front no los usa: el clima diario, los archivos por paquete de cada grupo de
estados y los 10 lotes por píxel. Están en la entrega completa (494 MB).

## Cómo leerlos

pandas lee un zip con un solo CSV adentro sin descomprimirlo. **Leé siempre `fips` como texto**, o se pierde el
cero de adelante.

```python
import glob
import pandas as pd

D = "data/fieldshift_final/"
anual = pd.read_csv(D + "tabla_anual.zip", dtype={"fips": str})
mensual = pd.concat([pd.read_csv(p, dtype={"fips": str})
                     for p in sorted(glob.glob(D + "tabla_mensual_*.zip"))], ignore_index=True)
iowa = pd.read_csv(D + "tabla_mensual_19_ia.zip", dtype={"fips": str})   # un solo estado
```

Para los archivos de `referencia_y_mapas.zip` y `argentina.zip`, descomprimilos:

```bash
python -m zipfile -e data/fieldshift_final/referencia_y_mapas.zip data/fieldshift_final/referencia
```

Si necesitás `tabla_mensual.csv` entera, igual a la de la entrega: `python data/fieldshift_final/unir.py`.

## Antes de usarlos

- `tabla_anual` repite el clima, el suelo y la aptitud en cada cultivo del mismo condado y año: para un mapa por
  condado, filtrá primero un cultivo.
- Alfalfa y heno no tienen rinde. Su precio viene en `precio_usd_ton`; el de los granos, en `precio_usd_bu`.
- 17 columnas tienen dato solo en IA, IL e IN (Landsat, CoCoRaHS, ECOSTRESS, napa y caudales). Mirá
  `columnas_vacias.csv`.
- MODIS no tiene julio a octubre de 2025: la fenología de 2025 está sesgada.
- En 2024 y 2025 hay menos condados con rinde de maíz (NASS publicó menos).
- El target del modelo es `rend_bu_ac` o `rend_kgha`. No usar como entrada `sup_cosechada_ac`, `produccion_bu` ni
  `ratio_cosechada` (columna `rol` = `no_usar` en el diccionario).
