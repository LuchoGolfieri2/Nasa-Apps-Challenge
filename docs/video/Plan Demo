# Field Rewind — Plan del video demo (para el equipo de front)

*14/11/2026 · Luciano (video y pitch) · Basado en `front-back-connection-spec.md`*

## 1. Qué necesito de ustedes

1. Completar la columna **"¿Listo?"** de la sección 5.
2. Responder las **preguntas de la sección 7**.
3. Decirme **para cuándo congelan una versión estable** para grabar.

## 2. Reglas del video (de la guía oficial de Space Apps)

- **Máximo 30 segundos.**
- **Subtítulos en inglés** obligatorios.
- Al principio hay que presentarse: nombre y equipo.

Cambios que ya aplico, según la spec:
- La voz dice **"a decade"** (2015–2025), no "18 años".
- La app **sugiere** según prioridades, con razones, rango y confianza. Nunca "porcentaje de éxito".
- Sin logo de la NASA.

## 3. Guion (30 s)

| Tiempo | Pantalla | Qué se ve | Toma del front |
|---|---|---|---|
| 0–3 s | Completa | Logo de Field Rewind + clic en "Start demo" | Landing (ver pregunta 1) |
| 3–9 s | **Dividida** | Izquierda: globo con glow → Kansas → Sumner. Derecha: intro animada (la hago yo en Remotion) | **Toma A** a 960×1080 |
| 9–18 s | Completa | Rewind 2015→2025 de Sumner: titular, panel lateral, bar race | **Toma B** a 1920×1080 |
| 18–24 s | Completa | Botón "Next season" → sugerencia + arcos a los gemelos | **Toma B** (continúa) |
| 24–27 s | Completa | Zoom out → giro a la Pampa | **Toma C** |
| 27–30 s | Completa | Logo + tagline + aviso | Lo hago yo |

Si llega el dataset de costos, "Higher income" reemplaza 2–3 s de la sugerencia; no se suma tiempo.

## 4. Qué tiene que pasar en cada toma

### Toma A — Globo → Sumner (6 s, 960×1080)
- Globo girando lento, glow fuerte, los 3 estados encendidos con latido.
- La cámara va directo a Kansas y entra a **Sumner, KS (20191)**.
- Sin tocar nada a mano: que lo haga sola con `?take=a`.

### Toma B — Rewind + sugerencia (15 s, 1920×1080)
**Rewind (9 s):**
- Play automático 2015→2025, aprox. **0.8 s por año**.
- Condado pintado lote a lote con el CDL de cada año.
- **Arriba a la izquierda:** titular del año ("2023 — Dry July. Corn after soy on 46% of fields.").
- **Bar chart race** de cultivos por superficie (en Sumner, el trigo cae y el maíz sube).
- **Panel a la derecha, máximo 3 datos** que cambien con el año:
  1. Rinde del año vs. lo habitual, en palabras ("Below usual").
  2. Clima del año (POWER): "Dry July · +2 °C".
  3. Agua en el suelo (SMAP) o verdor (NDVI), **solo si son datos reales**.
- Arriba: contador de datasets ("6 NASA & USDA datasets").

**Sugerencia (6 s):**
- Se toca **"Next season"**.
- Rotación actual precargada + prioridades marcadas.
- Una opción con **"Suggested for your priorities"**: 2 razones con fuente, rango en bu/acre (p10 / mediana / p90) y confianza.
- Arcos brillantes hacia 3–5 condados gemelos (si se aprueba la opción A de la spec).

### Toma C — Zoom a Argentina (3 s)
- Zoom out desde Kansas, giro del globo, llega a la Pampa.
- **Sin lotes pintados ni datos inventados.** Solo un rótulo: "Next: Argentina, as data is added".

## 5. Checklist de features

| Feature | ¿Va en el video? | ¿Listo? | Notas |
|---|---|---|---|
| Landing con logo + botón | Sí | | Ver pregunta 1 |
| Globo con glow + 3 estados | Sí | | |
| Mapa del estado → Sumner | Sí | | |
| Modo grabación `?take=a\|b\|c` | Sí | | Clave para grabar limpio |
| CDL lote a lote por año | Sí | | |
| Bar chart race | Sí | | |
| Titular por año | Sí | | |
| Panel: rinde vs. lo habitual | Sí | | Necesita NASS |
| Panel: clima (POWER) | Sí | | |
| Panel: SMAP / NDVI | Solo si son reales | | Si son prototipo, no lo muestro |
| Contador de datasets | Sí | | |
| Botón "Next season" | Sí | | |
| Sugerencia con razones, rango y confianza | Sí | | ¿Real o "Prototype data"? |
| Arcos a gemelos | Si se aprueba | | Opción A o B de la spec |
| "Higher income" | Solo si llegan los costos | | Si no, no aparece |
| Zoom a la Pampa (concepto) | Sí | | Sin datos falsos |
| Capa satelital GIBS | No | | No entra en 30 s |

## 6. Qué NO se muestra

- "Missing data" de costos (la prioridad "Higher income" sin datos).
- Bloques con sello "Prototype data", salvo la sugerencia si no hay otra opción. En ese caso el sello **tiene que verse**.
- Lotes o rindes de Argentina.
- Beneficio "por sector del campo": el rinde de NASS es por condado. Lo correcto es "cultivo más rentable por año en el condado".
- Logo de la NASA.

## 7. Preguntas

1. **Landing:** ¿pueden hacer una pantalla con el logo de Field Rewind y un botón "Start demo"? Si no, la armo yo en Remotion y empalmo con la toma A.
2. ¿El modo `?take=a|b|c` ya funciona? ¿Puede ir **sin cursor** o con un cursor prolijo para el clic en "Next season"?
3. La spec dice que la toma C va a 960×1080. En este guion va a **pantalla completa**: ¿pueden grabarla a 1920×1080?
4. ¿La sugerencia va a tener datos reales de ML o va con sello "Prototype data"?
5. Gemelos: ¿arcos automáticos (A) o botón "Counties like yours" (B)?
6. ¿El botón de entrada queda en Story o en Sumner? Para el video conviene **Sumner**.
7. ¿Para qué fecha tienen una versión estable para grabar?

## 8. Formato de entrega de las grabaciones

- MP4, **30 fps**, sin compresión fuerte (o grabación de pantalla en máxima calidad).
- Toma A: 960×1080 · Tomas B y C: 1920×1080.
- 1–2 s de margen antes y después de cada toma (para cortar limpio).
- Sin audio (la música y los efectos los pongo yo).
- Pasarlas por Drive o por el canal del equipo.
