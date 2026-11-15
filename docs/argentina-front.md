# Argentina en el front: datos listos (F38, parte Argentina)

Datos de la región pampeana para el front. **Ya se usan en el globo** (15/11): capa por zona, ficha del departamento y arcos a los análogos; ver `web/src/map/globe.js`, bloque "Argentina".
Cómo mostrarla lo decide el equipo (`CLAUDE.md`, "Argentina en el front").

- **Script:** `python3 scripts/build_argentina.py` (lee la entrega `fieldshift_datos_final_20261115`, que no va a
  Git; es idempotente).
- **Salida:** `web/public/data/argentina/` (2,4 MB): `index.json`, `departamentos.geojson` y `depto/<id_depto>.json`.
- **Clave:** `id_depto` (INDEC, 5 dígitos). Los 135 de Buenos Aires empiezan con `06`, igual que el FIPS de
  California: por eso todo va en una carpeta aparte y cada archivo lleva `"country": "AR"`. No mezclar con
  `county/<fips>.json`.

## Qué hay

| | Departamentos |
|---|---:|
| Total (Buenos Aires 135, La Pampa 22, Córdoba 26, Santa Fe 19, Entre Ríos 17) | 219 |
| Zona `dentro` (12 de Buenos Aires y 3 de La Pampa) | 15 |
| Zona `cerca` | 102 |
| Zona `fuera` (toda Córdoba, Santa Fe y Entre Ríos, y parte de BA y La Pampa) | 102 |
| Con rindes del MAGyP y comparación con EE. UU. | 180 |
| Con clima por campaña (solo Buenos Aires) | 135 |

**No hay predicción del modelo en Argentina** (`"prediction": null` en todas las fichas): el modelo se entrenó con
condados de EE. UU. y Argentina no tiene CDL (rotación) ni SSURGO. Lo que se muestra es la **comparación** con los
condados de clima más parecido y el rinde real del MAGyP.

## `index.json`

| Campo | Qué es |
|---|---|
| `zones` | Por zona: `label` (en inglés), `color_hint` (`in` / `near` / `out`) y cantidad de departamentos |
| `by_province` | Departamentos por provincia y zona |
| `median_ratio_ar_us_by_zone` | Mediana de rinde argentino ÷ rinde de sus análogos, por zona y cultivo |
| `headline` | La frase para el pitch: el sur bonaerense, con clima parecido, rinde la mitad |
| `note` | Aviso general: no hay estimación, se compara con análogos |
| `rules` | Qué mostrar en cada zona (ver abajo) |
| `sources` | Fuentes, mismo formato que `meta.json` |

Mediana de la razón Argentina ÷ análogos de EE. UU.:

| Zona | Maíz | Soja | Trigo |
|---|---:|---:|---:|
| `dentro` | 0,49 | 0,47 | 0,73 |
| `cerca` | 0,78 | 0,87 | 0,98 |
| `fuera` | 0,92 | 1,16 | 0,92 |

## `departamentos.geojson` (para pintar el mapa)

Polígonos simplificados (EPSG:4326, de la API Georef). Propiedades de cada departamento:
`country`, `id_depto`, `name`, `province`, `zone`, `n_out_of_range`, `analog_fips`, `analog_name` ("Gasconade, MO"),
`has_climate`, `has_yield`, `has_soil`, `ratio_corn`, `ratio_soy`, `ratio_wheat`.

## `depto/<id_depto>.json` (la ficha, al tocar un departamento)

| Campo | Qué es |
|---|---|
| `zone`, `zone_label`, `zone_text` | Zona y frase lista para mostrar, con las medidas de clima fuera de rango ("October temperature, March rain") |
| `out_of_range` | Lista de `{id, label}` de las medidas fuera del rango de EE. UU. (de 16) |
| `radiation_diff_mj_m2_day` | Cuánta más radiación tiene en la temporada que su análogo |
| `prediction`, `prediction_note` | Siempre `null`, con el motivo (distinto en `fuera`) |
| `analogs` | Los 3 condados de EE. UU. con clima más parecido: `fips`, `name`, `state`, `centroid` `[lon, lat]`. Sirven para dibujar arcos hacia EE. UU., como los gemelos |
| `yield_compare` | Por `corn` / `soy` / `wheat`: mediana argentina 2001–2024 (`kg_ha` y `bu_ac`), p10 / mediana / p90 de los 3 análogos (bu/ac y kg/ha), `ratio_ar_us`, percentil en la distribución de EE. UU., años y `text` listo |
| `yields` | Rinde del MAGyP por campaña (`year` = segundo año: 2025 = 2024/25), por cultivo en `kg_ha` y `bu_ac`; `null` si no hay dato |
| `climate` | Solo Buenos Aires: por campaña, lluvia y grados-día de la temporada (octubre–marzo), balance de agua, lluvia y máxima de **enero** (floración del maíz) y lluvia de **febrero** (llenado de la soja). En el resto, `null` y `climate_note` |
| `soil`, `soil_analog` | SoilGrids 0–30 cm del departamento y del primer análogo (misma fuente en los dos lados): arcilla, arena, carbono orgánico y pH |
| `season_months`, `sources`, `prototype` | Aclaración de la temporada corrida, fuentes y `false` (es dato real) |

Conversión a bu/ac con los factores de `CLAUDE.md` (maíz 62,77 kg/ha por bu/ac; soja y trigo 67,25).

## Reglas para mostrarlo (de `CLAUDE.md`, sección 2.1)

- **`dentro`:** comparación sin aviso.
- **`cerca`:** comparación con las medidas fuera de rango (`zone_text`).
- **`fuera`:** decir que una estimación entrenada en EE. UU. no aplica (`zone_text` y `prediction_note` ya lo dicen).
- **MAGyP:** solo para comparar, nunca como entrada de un modelo.
- La "temporada" argentina es **octubre a marzo**: lo que en EE. UU. es julio, acá es enero.
- Interfaz en inglés; los textos de los JSON ya están en inglés y sin "recommend".

## Lo que falta (front)

- Probar a mano con WebGL (el navegador del agente no tiene): capa, ficha, arcos, búsqueda y rutas `#/ar` y `#/ar/<id>`.
- Sumar Argentina a `scripts/check_coverage.py` (F38).
- Usar lo que todavía no se muestra: `soil` contra `soil_analog`, `yields` año a año, `radiation_diff_mj_m2_day` y `out_of_range` como lista.
