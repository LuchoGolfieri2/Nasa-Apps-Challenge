---
name: "field-shift-data-qa"
description: "Auditar un paquete de datos de Field Shift contra el contrato de CSV del CLAUDE.md antes de unirlo: claves, unidades, faltantes, rangos físicos, fugas de información y data card."
---

# QA de paquetes de datos — Field Shift

Revisa un paquete (`clima`, `cultivos`, `vegetacion`, `agua`, `suelo_terreno`) antes de que entre a `merge.py`. El contrato está en el CLAUDE.md del repo (secciones 4 y 7). Si algo de acá difiere del CLAUDE.md, manda el CLAUDE.md.

**QA reporta, no corrige.** El dueño del paquete arregla los problemas.

## 1. Leer el contexto

`config/config.yaml`, `data/reference/condados.csv`, `data/reference/anios.csv`, `docs/datasets/<paquete>.md` y las filas del paquete en `manifest.csv`.

## 2. Chequeos por cada CSV de `data/processed/<paquete>/`

Usá pandas y leé `fips` como texto (`dtype={"fips": str, "fips_estado": str}`).

**Estructura**
- Nombre: `<paquete>_{diario|16d|semanal|mensual|anual|estatico}.csv`.
- Las primeras columnas son las claves en orden: `fips`, `anio`, y `fecha` o `mes`. Los archivos por estado (Crop Progress) usan `fips_estado`.
- `fips` tiene 5 dígitos (no perdió ceros a la izquierda) y sus dos primeros son un estado de `config.yaml`.
- `anio` es un entero de 4 dígitos, coherente con `fecha` o `mes`.
- Columnas en snake_case, con la unidad al final cuando corresponde.
- UTF-8, separador coma, decimal punto.

**Claves y cobertura**
- Sin duplicados en la combinación de claves.
- Todos los `fips` existen en `condados.csv`. Listar los condados de la zona que faltan.
- No hay filas de "OTHER (COMBINED) COUNTIES" de NASS (`county_code` 998) tomadas como condado.
- Primera y última fecha por condado, y huecos de más de 2 períodos seguidos.

**Valores**
- % de faltantes por columna. Alertar si supera 20 %.
- Rellenos disfrazados: -999, -9999, 9999, códigos de NASS como `(D)` o `(Z)` dentro de columnas numéricas, o ceros repetidos en variables que no pueden ser 0 (temperatura, NDVI de verano).
- Columnas constantes (un solo valor).
- Rangos de sanidad (amplios, para cazar errores, no límites agronómicos):

| Variable | Rango |
|---|---|
| lluvia diaria (mm) | 0 a 300 |
| lluvia mensual (mm) | 0 a 800 |
| temperatura del aire (°C) | −45 a 50 |
| LST (°C) | −45 a 75 |
| radiación (MJ/m²/día) | 0 a 40 |
| humedad relativa (%) | 0 a 100 |
| viento (m/s) | 0 a 30 |
| NDVI, EVI | −1 a 1 |
| humedad volumétrica (m³/m³) | 0 a 0,6 |
| GWET*, fracciones | 0 a 1 |
| percentiles | 0 a 100 |
| arcilla, arena, limo (%) | 0 a 100, y suman cerca de 100 |
| pH | 3 a 10 |
| rendimiento (bu/acre) | maíz 20–300, soja 5–100, trigo 10–130, avena 20–200 |
| rendimiento (kg/ha) | maíz 0–19.000, soja 0–7.000, trigo 0–9.000 |

- Unidades sospechosas: Kelvin en vez de °C (valores > 200), lluvia en metros en vez de mm, humedad en % en vez de fracción, bu/acre guardados en una columna `_kgha` (maíz con valores menores a 300), acres en una columna `_ha`.
- Saltos implausibles entre períodos seguidos (ej. NDVI de 0,8 a 0,1 en 16 días fuera de época de cosecha): listarlos para revisar.

**Fugas de información (para el equipo de ML)**
- Anomalías, z-scores, percentiles o tendencias calculados con todo el período incluyen años que después pueden ser de test. No es bloqueante, pero el data card tiene que decir el período base de cada uno.
- El rendimiento no debe venir sin tendencia desde este pipeline (lo decide ML).

## 3. Data card y manifest

- El data card describe todas las columnas del CSV (nombre, descripción, unidad, fuente, ID del catálogo) y nada que no exista.
- Tiene cobertura real, % de faltantes, supuestos, versión del producto y fecha de descarga.
- Hay al menos una fila en `manifest.csv` por archivo bajado del paquete.

## 4. Reporte

Escribí `docs/qa/<paquete>_<AAAA-MM-DD>.md`:

```
# QA <paquete> — <fecha>
Veredicto: APTO | APTO CON OBSERVACIONES | NO APTO

## Bloqueantes
- archivo, columna, filas de ejemplo, qué pasa, sugerencia

## A revisar
- ...

## Menores
- ...

## Resumen por archivo
| archivo | filas | condados | desde | hasta | % faltantes máx. |
```

Es **NO APTO** si hay claves duplicadas, `fips` inválidos, unidades equivocadas o columnas sin documentar.