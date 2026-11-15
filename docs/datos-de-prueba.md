# Registro de datos de prueba, supuestos y reglas

Qué parte de lo que muestra la app **no es una medición real** y hay que revisar, reemplazar o aclarar antes de la entrega final.
Es un registro vivo: **quien reemplaza algo por dato real lo anota en la columna "Reemplazo"** (fecha, quién, de dónde salió el dato) y deja la fila, no la borra.

Auditoría inicial: 15/11/2026, sobre `main` (53cdc21).

Estados: `PENDIENTE` (sigue siendo de prueba o faltante) · `REEMPLAZADO` (ya es dato real) · `REGLA` (no es dato, es una regla del equipo, hay que decirlo) · `DECIDIR` (el equipo tiene que resolverlo).

## A. Datos inventados o de prueba

| # | Qué es | Dónde está | Estado | Reemplazo (fecha · quién · fuente) |
|---|---|---|---|---|
| A1 | Números de los bocetos de la pantalla Próxima campaña (rindes, barras, textos de ejemplo). Son maquetas, no se publican, pero no deben copiarse al sitio. | `docs/mockups/next/*.html`, `docs/mockups/timeline/` | PENDIENTE (no usar como fuente) | |

**Estado de los JSON del sitio:** ningún bloque de `web/public/data/` lleva `prototype: true`. Las pruebas viejas del globo se reemplazaron por datos reales en el commit `6dda5c3` ("Datos reales en todo el front"). Si alguien vuelve a poner un dato de prueba, tiene que llevar `prototype: true` (el front pone el sello "Prototype data") y **agregarse acá**.

## B. Reglas y cálculos del equipo (no son medición directa)

| # | Qué es | Dónde está | Estado | Qué hacer |
|---|---|---|---|---|
| B1 | Puntaje de suelo: regla fija "rotar > habitual > repetir" (valores como 0,15 / 0,55). Los textos con fuente "Agronomic rule" también. | `scripts/build_next_json.py` → `scores.soil` y `reasons[].kind = "rule"` en `web/public/data/next/*.json` | REGLA | Mostrarla siempre como "Rule", nunca como modelo. Reemplazar si hay dato de suelo real (gSSURGO). |
| B2 | Puntajes de riesgo e ingreso: salen del p10 y la mediana del modelo, comparados entre las 3 opciones. Es una escala relativa, no un valor medido. | mismo script → `scores.risk`, `scores.income` | REGLA | Explicarlo en Fuentes y límites. |
| B3 | Precio de referencia = mediana 2021–2025 por estado; costo operativo ERS igual para todas las rotaciones y estados (región Heartland). No es pronóstico. | `backend/Datos/precios_costos.csv` | REGLA | Ya aclarado en el front; revisar si se pueden separar costos por rotación. |
| B4 | Rangos p10/mediana/p90 de rinde por opción: salen del modelo de ML (2009–2023), no de ensayos. | `backend/Datos/escenarios_rotacion_resumen.csv` | REGLA | Mantener la nota "associations, not causes". |

## C. Faltantes (se muestran como "Missing data")

| # | Qué falta | Dónde se nota | Estado | Reemplazo |
|---|---|---|---|---|
| C1 | Verdor (NDVI / MODIS) y agua en el suelo (SMAP): `greenness`, `soil_water` en `null` | `web/public/data/county/*.json` | PENDIENTE | |
| C2 | Puntaje de agua (`scores.water`) en `null`: ninguna opción se separa por agua | `web/public/data/next/*.json` | PENDIENTE | |
| C3 | **Kansas (105 condados).** Hay en el repo: superficie por cultivo del CDL 2025 (`data/raw/cultivos/cdl_stat/2025/`, alimenta "Color by" del globo) y mapa lote a lote solo de Sumner (20191). **No hay:** rinde NASS, clima POWER, modelo de ML ni gemelos. Por eso el globo (variable por defecto: rinde) muestra los 105 condados sin dato. Falta: clave `NASS_API_KEY` en `.env` (no existe hoy), bajar POWER, y que ML sume Kansas al modelo. | `county/`, `next/`, `globe-data.json` | PENDIENTE | |
| C4 | Mapa del CDL lote a lote solo para Story IA, McLean IL y Sumner KS; el resto de los condados muestra "Missing data" en vez del mapa | `web/public/data/cdl/` | PENDIENTE | |
| C5 | Condados donde ninguno se parece a la opción (p. ej. maíz tras maíz en Polk IA): sin gemelos | `next/*.json` → `twins: []`, `twins_note.text: null` | PENDIENTE | |

## D. Textos y archivos desactualizados (revisar)

| # | Qué | Dónde | Estado |
|---|---|---|---|
| D1 | La pantalla Fuentes decía que los colores y números del globo son "placeholders". Hoy son datos reales. | `web/src/sources/SourcesScreen.tsx` | REEMPLAZADO (15/11, texto genérico: "todo lo que sea un reemplazo y no una medición lleva la marca") |
| D2 | Indiana sí tiene datos completos (92 condados: rinde, clima, modelo y gemelos). Kansas no (ver C3). La pantalla Fuentes y `meta.json` hablan de Indiana (`IN`, 92 condados con código 18xxx en `web/public/data/county/`), pero `CLAUDE.md` dice que Kansas reemplazó a Indiana (14/11). | `SourcesScreen.tsx`, `web/public/data/meta.json`, `scripts/build_front_data.py` | DECIDIR (consultar al equipo) |
| D3 | `web/src/next/README.md` dice 201 condados de IA e IL; hoy hay 293 archivos en `next/` (incluye Indiana). | `web/src/next/README.md` | PENDIENTE |

## Cómo se usa

1. Si metés un dato de prueba: ponele `prototype: true` en su JSON y agregá una fila en A.
2. Si reemplazás uno por dato real: cambiá el estado a `REEMPLAZADO` y completá la última columna (fecha, nombre, fuente, archivo). No borres la fila.
3. Antes de la entrega: ninguna fila de A en `PENDIENTE`; las de B explicadas en Fuentes y límites; las de C, con "Missing data" visible y no con ceros.
