# Field Rewind: plan de construcción del front-end

*14/11/2026 · Responsable: front-end y edición de video · Equipo Pepers*

Une en un solo plan lo que dicen `CLAUDE.md`, `docs/design.md`, `docs/front-end-definido.md`, `CONTEXTO_FRONT_VIDEO.md`, `ML_NOTAS_CDL.md` y las skills `field-shift-*`. Cuando dos documentos chocan, manda esta jerarquía:

1. `CONTEXTO_FRONT_VIDEO.md` (lo más nuevo): nombre, estados de demo, tomas y plazos.
2. `docs/front-end-definido.md`: flujo y reglas por pantalla.
3. `docs/design.md`: decisiones de diseño y componentes.
4. `.claude/skills/field-shift-frontend`: principios generales. Sus "4 pantallas" (Mi campo / Diagnóstico / Comparar / Fuentes) **están desactualizadas**: valen las del flujo nuevo.

---

## 1. La app en una frase

**Field Rewind** — *"Rewind your land before you decide."* El productor elige su condado en un globo, rebobina lo que pasó ahí año por año (cultivo, rinde, verdor, clima, agua en el suelo, con datos de la NASA y el USDA) y después compara su rotación actual con dos alternativas, como rangos y con condados gemelos. Sugiere una opción según las prioridades del productor, con razones, rango y confianza. Toda la interfaz en inglés.

## 2. Plazos (mandan sobre todo lo demás)

| Cuándo | Entrega | Para quién |
|---|---|---|
| **Sáb 14, noche** | Toma B en borrador (datos de prueba sirven) + URL pública | Luciano |
| **Dom 15, mañana** | URL pública definitiva desplegada | Luciano (página del proyecto) |
| **Dom 15, antes de 18:00** | Tomas A, B y C finales con datos reales + lista del stack y recursos de terceros | Luciano |
| Dom 15, 18:00–23:59 | Edición del video (vos) y envío | Space Apps |

Consecuencia: la app se construye **para la demo de 3 condados**, no para los ~290 del contrato. Todo lo que no llegue a tiempo se muestra como "Missing data", nunca inventado.

## 3. Qué datos hay de verdad hoy

| Dato | Estado | Detalle |
|---|---|---|
| CDL (qué se sembró) | **Listo** | `cdl_fieldshift.zip`: superficie por cultivo y año (2015–2025) y transiciones por píxel (2016–2025) para Story IA `19169`, McLean IL `17113`, Sumner KS `20191`. Rasters de grupos 30 m. |
| Puntos CDL para ML | Listo | `cdl_puntos.csv`, 81.000 filas, 2017–2025 |
| NASS rendimiento | Falta | Necesita `NASS_API_KEY`. |
| NASA POWER (clima) | Falta | API sin login: se baja en minutos para 3 centroides. |
| MODIS NDVI | Falta | Lo trae "Datos B" por AppEEARS (cola). |
| SMAP agua en el suelo | Falta | AppEEARS, desde 2015. |
| Suelo (gSSURGO) | Falta | |
| Salida de ML | Falta | Las notas de ML prometen `point_id, cultivo, media, p10, p90` de `ndvi_peak` (vigor), **no** rendimiento por rotación. |
| Polígonos de condados | Falta | Se bajan del Census (Cartographic Boundary 1:500k o 1:20m), dominio público. |

No existe todavía `data/processed/` ni `config/config.yaml` en el repo.

## 4. Conflictos que hay que resolver (con recomendación)

| # | Conflicto | Recomendación |
|---|---|---|
| 1 | **Tercer estado:** docs dicen Indiana; el CDL limpio es Sumner, **Kansas**. | **Kansas (Sumner).** Ya está procesado y tiene la mejor historia del pitch (trigo de 122.000 a 84.000 ha, maíz duplicado). Avisar a Luciano ya. Kansas no es Corn Belt núcleo: el texto dice "Iowa, Illinois and Kansas" sin llamarlo Corn Belt en esa línea. |
| 2 | **"Rebobinás 18 años" vs CDL desde 2015** (11 años). | Pedir a Luciano que extienda el CDL a **2008** para los 3 condados (el script ya existe, es correrlo). Si no llega, el deslizador va 2015–2025 y la voz dice "a decade". Hay que decidirlo antes de grabar la toma B. |
| 3 | **Mapa de estado pintado** necesita un valor para **todos** los condados del estado; solo hay 3. | Capa por defecto: **% de maíz sobre lo sembrado, de NASS** (una consulta por estado, todos los condados). Si NASS no llega: los 3 condados de demo encendidos y el resto rayado con "Missing data" y no clickeables. |
| 4 | **Salida de ML = vigor (NDVI pico) por punto y cultivo**, la pantalla pide rotaciones con rangos. | El front muestra el **siguiente cultivo** dado el anterior (maíz tras soja, maíz tras maíz, soja tras maíz, trigo…) con p10/mediana/p90 de **vigor**, rotulado "Crop vigor (greenness), not yield". Le paso a ML el contrato JSON de la sección 7 para que agregue por condado. |
| 5 | **Gemelos** necesitan suelo + clima de muchos condados. | Clima de POWER para los centroides de los 3 estados (sin login) y superficie NASS. Si no llega: el bloque de gemelos dice "Missing data: twin counties need soil and weather for every county" y la confianza baja. No se inventan gemelos. |
| 6 | Textos con "Field Shift". | Todo pasa a "Field Rewind". Fuera de cobertura: *"Field Rewind doesn't cover this area yet. It works in Iowa, Illinois and Kansas."* |

## 5. Dirección visual (propuesta para cerrar en la fase 2)

Recomiendo **todo oscuro, con la identidad del logo**, porque la app aparece pegada a las animaciones del video y tiene que parecer la misma pieza:

- Fondo `#12281C` (verde oscuro), acento `#96DC6E` (verde claro, "REWIND"), verde cultivo `#3C8C2D`. El rojo `#D71E1E` es solo de la animación: en la app no se usa para "malo".
- **Globo estilizado oscuro**, sin teselas satelitales: países y estados como polígonos (Natural Earth + Census), atmósfera suave de MapLibre. Sin claves de API, pesa poco y se ve bien en 960×1080.
- Colores de cultivo ya validados (`#E69F00` maíz, `#009E73` soja, `#56B4E9` cobertura/forraje, `#D98BB5` cereal fino) **hay que revalidarlos sobre fondo oscuro** antes de usarlos (skill `better-colors` / `dataviz`).
- Tipografía sans en negrita para títulos, como el logo; texto de cuerpo legible. Se elige en la fase 2 con `frontend-design` y `no-ai-design-slop`.
- Ícono ⏪ en la línea de tiempo y en el botón de play: conecta con el nombre.
- Se pierde algo de lectura al sol: se compensa con contraste AA alto y tamaños grandes.

## 6. Arquitectura

**Stack**

- **Vite + React + TypeScript.** Sitio estático, sin backend.
- **MapLibre GL JS v5** con `projection: globe` y `flyTo` para el vuelo de cámara. Sin react-map-gl: un componente propio que envuelve el mapa.
- **Gráficos en SVG propio** con `d3-scale` y `d3-shape` (curva de verdor, barras de rango, franja de cultivos). Nada de librerías de dashboards.
- Estado de la app en la URL (`#/`, `#/state/IA`, `#/county/19169?year=2021`, `#/county/19169/next`, `#/sources`) para poder abrir cualquier toma directo.
- **Deploy: Vercel** desde tu cuenta (URL pública sin login, sin tocar la configuración del repo de Luciano). GitHub Pages como alternativa.

**Carpetas** (fuera de los paquetes de datos, para no pisar a nadie)

```
web/
  index.html
  src/
    app/          # rutas, estado, layout
    map/          # globo, capa de estado, vuelo
    history/      # línea de tiempo, ficha del año, curva de verdor
    next/         # opciones, rangos, gemelos
    sources/
    ui/           # Missing, RangeBar, Triad, Confidence, SourceTag, ModelRuleTag
    data/         # tipos TS y carga de JSON
  public/data/    # JSON estáticos generados (sección 7)
scripts/
  build_front_data.py   # CSV de data/processed + zip CDL + data/ml -> web/public/data
```

`build_front_data.py` lee lo que exista y escribe `null` donde falte. La app nunca calcula nada pesado: solo lee y dibuja.

## 7. Contrato de datos del front (JSON)

Regla: **`null` = "Missing data"**. El componente `<Missing what="…">` lo escribe con texto y borde punteado; nunca 0, hueco o guion.

| Archivo | Qué tiene | De dónde sale |
|---|---|---|
| `meta.json` | estados activos, condados de demo, condado precargado, años, lista de fuentes con resolución y período, fecha de generación | config + data cards |
| `geo/world.geojson`, `geo/states.geojson` | contornos simplificados | Natural Earth, Census |
| `geo/counties_<ST>.geojson` | condados de cada estado activo, con `fips` y `name` | Census Cartographic Boundary |
| `state_layer.json` | `{fips: {value, unit, label, source} \| null}` | NASS (o null) |
| `county/<fips>.json` | ficha completa (abajo) | CDL, NASS, POWER, MODIS, SMAP |
| `next/<fips>.json` | opciones de la próxima campaña (abajo) | ML + reglas + gemelos |

`county/<fips>.json`

```jsonc
{
  "fips": "19169", "name": "Story", "state": "IA",
  "centroid": [-93.46, 42.04],
  "summary": { "text": "Corn yielded above its usual level here in 7 of the last 10 years.", "basis": "NASS" } | null,
  "years": [{
    "year": 2021,
    "crops_pct": { "corn": 58, "soy": 41, "wheat": 0, "other": 1 } | null,       // CDL
    "yield": { "corn": { "bu_ac": 202, "vs_usual": "above|similar|below" | null, "flag_nass": null } } | null,
    "greenness": { "curve": [[doy, ndvi], ...], "peak": 0.86 } | null,         // MODIS
    "weather": { "season_rain_in": 18, "days_over_95f": 3, "last_frost_doy": 112,
                 "tags": ["dry year", "hot July"] } | null,                    // POWER
    "soil_water": { "rootzone_anom_z": -1.2, "label": "drier than usual" } | null  // SMAP, null antes de 2015
  }],
  "greenness_band": { "doy": [...], "p10": [...], "p90": [...] } | null,       // rango de los demás años
  "common_rotations": [{ "label": "Corn → Soy", "pct": 46 }],                   // transiciones CDL
  "sources": ["USDA CDL 30 m 2015–2025", "..."]
}
```

`next/<fips>.json`

```jsonc
{
  "fips": "19169",
  "metric": { "name": "crop vigor (peak greenness)", "note": "Vigor, not yield." },
  "options": [{
    "id": "current", "kind": "current",                  // orden fijo: primero la actual
    "label": "Corn after soybean", "sequence": ["soy", "corn"],
    "why": "Most common rotation in this county (46% of fields).",
    "outcome": { "p10": 0.78, "p50": 0.84, "p90": 0.88 } | null,
    "confidence": { "level": "high|medium|low", "reason": "..." },
    "benefits": [{ "text": "...", "basis": "model|rule", "source": "..." }],
    "risks":    [{ "text": "...", "basis": "model|rule", "source": "..." }],
    "missing":  ["Income per acre: no prices yet"],
    "twins": [{ "fips": "...", "name": "...", "similar_on": ["soil water", "growing degree days"], "crop_area_ac": 1200 }] | null
  }]
}
```

Este contrato se le pasa a ML y a datos tal cual. Si cambian algo, cambia el contrato, no el componente.

## 8. Pantallas → componentes → datos

| Pantalla | Qué tiene que lograr | Componentes | Datos |
|---|---|---|---|
| **Mapa · globo** | En 3 s se entiende dónde funciona | `Globe` (giro lento, se frena en EE. UU.), estados activos que laten, buscador, lista accesible de estados, aviso fuera de cobertura, fallback plano sin WebGL | `meta.json`, `geo/*` |
| **Mapa · estado** | Ubicar el condado | `StateLayer` (escala de un color + rayado "Missing data"), leyenda con unidad y fuente, tooltip, condado resaltado, botón "See its history" | `geo/counties_*`, `state_layer.json` |
| **Historia** | Rebobinar la tierra | Mapa chico fijo, resumen de una frase, **`Timeline` con ⏪/▶ play** (autoplay año por año), `YearCard` (cultivo, rinde con palabras, verdor, clima como etiquetas, agua en el suelo), `GreennessChart` (año resaltado sobre la banda), `CropStrip`, rotaciones comunes, máx. 3 gráficos | `county/<fips>.json` |
| **Próxima campaña** | Comparar sin recomendar | Dos preguntas (rotación actual sugerida, prioridades), 3 `OptionCard` lado a lado (apiladas en celular): `Triad`/`RangeBar`, `Confidence`, `ModelRuleTag`, beneficios/riesgos, faltantes, `Twins` | `next/<fips>.json` |
| **Fuentes y límites** | Confianza | Aviso "supports, doesn't replace your agronomist", cómo leer rangos, tabla de fuentes, qué no ve, "not an official NASA or USDA product" | `meta.json` |

Reglas transversales: unidades de EE. UU. por defecto (bu/acre, °F, pulgadas) con opción métrica, enteros en bu/acre y días, "Results are for the whole county, not for a single field.", nada indicado solo por color, teclado completo, áreas táctiles ≥ 48 px, `prefers-reduced-motion` apaga giro, latido y vuelo.

## 9. Video: cómo sale cada toma de la app

Se agrega un **modo grabación** por URL para que las tomas salgan iguales en cada intento (sin buscar botones con el mouse):

| Toma | Tamaño | URL | Qué hace la app |
|---|---|---|---|
| A | 960×1080 | `/?take=a` | Globo gira despacio, se frena en EE. UU., los 3 estados laten; a los ~6 s vuela al estado de demo. Todo centrado en la mitad vertical. |
| B | 1920×1080 | `/#/state/IA?take=b` | Recorrido real con el mouse: tocar Story → "See its history" → **▶ play**: el deslizador corre solo los años (≈0,3 s por año) y la ficha cambia → "Options for next season". Fuentes visibles en el pie de la ficha. |
| C | 960×1080 | `/#/county/19169?take=c` | Zoom out del condado al globo y giro hasta la Pampa, sin tocar nada. Sin abrir ningún lugar de Argentina. |

- `take=*` oculta cosas que distraen (tooltips de ayuda, banners), fija la semilla de cualquier animación y no cambia ningún dato.
- Condado de la toma B: el que tenga la historia más visible. Hoy, por datos de CDL, **Story** (maíz tras maíz 17,8 %, años con cambios) o **Sumner** (trigo que cae, maíz que sube). Se elige cuando estén clima y verdor, buscando un año seco marcado.
- Grabar con OBS a 60 fps, F11 o `--kiosk`, sin notificaciones. Como vos editás el video, guardá los brutos en una carpeta fuera del repo (los MP4 no van a git).

## 10. Orden de construcción (hasta el sábado a la noche y el domingo)

| Bloque | Qué | Sale |
|---|---|---|
| 1 | Scaffold Vite + TS, tokens de color y tipografía, rutas, `<Missing>` y tipos del contrato | App vacía navegable |
| 2 | `build_front_data.py` con CDL real + POWER de 3 centroides + condados del Census; NASS/MODIS/SMAP/ML en `null` | JSON reales con huecos honestos |
| 3 | **Historia** con timeline y play (el corazón de la toma B) | Toma B parcial |
| 4 | Globo + vuelo + estado pintado | Tomas A y C |
| 5 | Próxima campaña con el contrato (`null` → Missing data hasta que llegue ML) | Toma B completa |
| 6 | Deploy en Vercel → **URL a Luciano** · grabar borrador de toma B | **Entrega del sábado** |
| 7 | Dom: meter NASS, MODIS, SMAP y ML a medida que lleguen (solo regenerar JSON) | Datos reales |
| 8 | Fuentes y límites, revisión a 375 px y 1440 px, accesibilidad, contraste en oscuro | — |
| 9 | Grabar A, B y C finales antes de las 18:00 · lista de stack y recursos | **Entrega final** |

## 11. Para pasarle a Luciano y al resto

- **Ya:** tercer estado (recomiendo Kansas/Sumner) y si se extiende el CDL a 2008.
- A ML: el contrato `next/<fips>.json` (sección 7) y que el valor es vigor, no rinde.
- A datos: quién baja NASS (necesita la clave) y POWER; si no hay quien, POWER lo bajo yo desde `build_front_data.py`.
- Stack y recursos de terceros (para el campo de referencias): Vite, React, TypeScript, MapLibre GL JS (BSD-3), d3-scale/d3-shape (ISC), Natural Earth (dominio público), US Census Cartographic Boundary (dominio público), tipografía de Google Fonts (OFL, a definir), hosting Vercel.
