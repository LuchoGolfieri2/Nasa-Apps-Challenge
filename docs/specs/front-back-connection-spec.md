# Field Rewind — Spec del front-end y su conexión con el back

*Entrevista del 14/11/2026 · Responsable: front-end y video · Reemplaza las partes que choquen de `docs/front-end-plan.md`*

## 0. Concepto único (manda sobre INFO.md y cualquier otro doc)

*Decisión de la revisión de diseño del 14/11.*

- **Un solo producto:** Field Rewind trabaja **por condado** (IA, IL, KS), rebobina 2015–2025 y **sugiere** una opción para la próxima campaña según las prioridades del productor.
- **Fuera del MVP:** la "idea 1" de `INFO.md` (lote dividido en sectores: loma seca, bajo húmedo, zona media). No hay pantalla para mostrarla y no entra en el video.
- **Pedido a ML (ya):** actualizar `INFO.md` §1 (qué es el producto), §2 regla 5 ("el modelo no recomienda" → "la app sugiere según prioridades, con razones, rango y confianza") y §3 (las 4 pantallas de este spec). Subir `version_contrato` a 0.3 y anotarlo en §9.

## 1. Mensaje central (lo que el jurado se lleva en 10 s)

> El productor elige qué sembrar comparando con el pasado: el de su propio condado (rewind año por año) y el de **condados gemelos**, lejanos o no, con suelo y clima parecidos que ya probaron esa opción. La app **sugiere** una opción según sus prioridades, con el porqué, el rango y la confianza.

Cambio de regla: antes era "se compara, no se recomienda". **Ahora la app sugiere**, siempre con razones, fuente, rango p10/mediana/p90 y nivel de confianza. Sigue prohibido: "porcentaje de éxito", precisión falsa, inventar datos.

## 2. Alcance

| Tema                           | Decisión                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estados                        | **Iowa, Illinois, Kansas** (definitivo). Escalable a más estados: se dice en el pitch y en Fuentes y límites ("more regions as data is added").                         |
| Condados con historia completa | Story IA `19169`, McLean IL `17113`, Sumner KS `20191`.                                                                                                                 |
| Universo de gemelos            | Condados de los 3 estados.                                                                                                                                              |
| Años del rewind                | **2015–2025** (lo que hay del CDL). La voz del video cambia "18 años" por **"a decade"** → avisar a Luciano.                                                            |
| Idioma                         | Solo inglés.                                                                                                                                                            |
| Pantalla objetivo              | **Escritorio 1920×1080** primero (jueces y toma B). Celular funcional, secundario. Toma A a 960×1080; tomas B y C a 1920×1080.                                                              |
| Datos faltantes al cierre      | Si NDVI, SMAP o ML no llegan: **datos de prueba marcados** con sello visible "Prototype data" en cada bloque afectado. Lo real va sin sello. Nunca mezclados sin marca. |

## 3. Conexión front ↔ back

- La app lee **JSON estáticos** (contrato en `docs/front-end-plan.md` §7, con los cambios de abajo). `null` = "Missing data"; `"prototype": true` en un bloque = sello "Prototype data".
- **Quién genera los JSON: a confirmar con el equipo.** Propuesta por defecto: `scripts/build_front_data.py` del front, que lee CSV de `data/processed/`, el zip del CDL, `backend/Datos/` y el dataset de costos.
- Pedidos a otros equipos:
  - **ML:** el rango de cada opción es **rinde en bu/acre** (p10, mediana, p90), no NDVI. Además, para cada opción: confianza + motivo, y la lista de gemelos con en qué se parecen. Necesita NASS de rinde por condado.
  - **Datos:** NASS rinde y superficie de todos los condados de IA, IL, KS (gemelos y mapa de estado); POWER de los centroides; rasters CDL por año ya existen.
  - **Costos:** el equipo sube un dataset de costos "próximamente". Con eso se calcula ingreso $/acre = rinde × precio − costo. Hasta entonces la prioridad "Higher income" muestra "Missing data: costs not loaded yet".
- Cambios al contrato:
  - `county/<fips>.json` agrega `area_by_crop` por año (hectáreas/acres, para el bar race) y `raster_tiles` o PNG por año del CDL recortado al condado.
  - `next/<fips>.json`: `metric = yield_bu_ac`; cada opción lleva `scores` por prioridad (`risk`, `income`, `soil`, `water`) y `suggested_for` (lista de prioridades en las que gana); `confidence.reason`; `twins[]` con `fips`, `name`, `state`, `centroid`, `similar_on`, `grew_crop_pct`.
  - Cada bloque lleva `source` (para los chips) y `prototype` (bool).

## 4. Pantallas

### 4.1 Mapa (globo → estado)
- **Globo espectacular**, referencia visual: **MapTap**. Glow/atmósfera fuerte, giro lento, los 3 estados encendidos con latido.
- **Presupuesto de glow (decisión 14/11):** el glow va **solo** en la atmósfera del globo y en los arcos a gemelos. El latido va solo en los 3 estados y se apaga tras la primera interacción. Botones, tarjetas, la insignia "Suggested" y los textos van **sin glow**; la profundidad se da con sombra con offset, no con halo. Evita el look genérico "neón sobre oscuro".
- **Entrada para quien abre la URL sin guía (decisión 14/11):** la portada **es** el globo de la toma A, sin landing aparte. Botón principal **"Rewind Sumner County, KS"**: hace el mismo recorrido del video (vuelo → Sumner → play). Secundario: "Pick your county". Esto responde la pregunta 1 de Lucho (la "Start demo" es este botón) y la 6 (Sumner).
- Estado pintado por una variable (pendiente; propuesta: % de maíz NASS); condados sin datos rayados con "Missing data".

### 4.2 Historia del condado (el rewind)
- Protagonistas, sincronizados con un solo deslizador ⏪/▶ (play automático 2015→2025):
  1. **El condado pintado lote a lote** con el CDL de 30 m de ese año: se ve la rotación cambiar.
  2. **Bar chart race de cultivos por superficie**: las barras se reordenan año a año (en Sumner el trigo cae y el maíz sube).
- **Titular por año** generado desde los datos: "2023 — Dry July. Corn after soy on 46% of fields." Se lee sin mirar gráficos.
- **NASA marca el ritmo (decisión 14/11):** la línea de tiempo lleva marcas de año seco/húmedo calculadas con NASA POWER (SMAP desde 2015 si es real), y el titular de cada año **arranca con el dato NASA** y su chip: "2023 — Dry July (NASA POWER). Corn after soy on 46% of fields (USDA CDL)." El contador de la cabecera dice "N NASA & USDA datasets". POWER es prioridad de datos para hoy (sin login, 3 estados).
- **Ritmo (decisión 14/11):** la app reproduce a un ritmo legible para quien la usa (≈1,6 s por año, el titular se alcanza a leer). En el video, Lucho acelera esa parte ×2 (≈0,8 s por año) y la voz va encima a velocidad normal. Consecuencia: la toma B en bruto dura ≈18 s solo de rewind; avisar a Lucho.
- **Carga (decisión 14/11):** al entrar a Historia se precargan los 11 rasters del CDL. Mientras tanto el botón ▶ muestra "Loading 7/11 years" y está deshabilitado; se habilita al terminar. Si un año falla, ese cuadro muestra "Missing data" y el play sigue sin frenarse.
- Debajo: rinde del año contra lo habitual (palabras), verdor, clima, agua en el suelo; chips de fuente en cada dato.

### 4.3 Próxima campaña
- **Rotación actual precargada** (la más común del condado según CDL) y editable con chips. Cero tipeo.
- **Prioridades** (multi-selección): Lower risk in bad years · Higher income · Soil health · Save water. La opción sugerida cambia en vivo.
- Tres opciones (actual + 2). Una lleva **"Suggested for your priorities"** con 2 razones con fuente y su confianza. Las otras quedan visibles con sus rangos.
- Rango en **bu/acre** (p10 / mediana / p90). Ingreso $/acre cuando haya costos.
- **Origen del rango (decisión 14/11):** sale de ML, según el contrato de §3. Si ML no entrega antes del domingo a las 18:00, la sugerencia va con sello "Prototype data" visible también en el video (riesgo aceptado).
- **Jerarquía fija (decisión 14/11), se lee en 3 s:**

```
┌──────────────────────────────────────────────────────────────┬──────────────┐
│ You grow now: [Wheat]→[Wheat]→[Soy]   Priorities: (●Risk)(●Soil)(Water)(Income) │
├──────────────────────────────────────────────────────────────┤              │
│ 1 ▸ SUGGESTED FOR YOUR PRIORITIES                             │  mapa chico  │
│     Corn after wheat                     ◂ frase protagonista │  + arcos a   │
│     · razón 1 (chip de fuente)                                │  gemelos     │
│     · razón 2 (chip de fuente)                                │              │
│     Bad 118 · Typical 142 · Good 161 bu/ac   ▮▮▯ Medium — motivo            │
├──────────────────────────────────────────────────────────────┤              │
│ 2 ▸ Las 3 opciones como filas, barras p10–p90 en UN eje común │              │
│     Wheat after wheat (now)  |──●──|                          │              │
│     Corn after wheat ★       |───●───|                        │              │
│     Soy after corn           |──●─|                           │              │
├──────────────────────────────────────────────────────────────┤              │
│ 3 ▸ Beneficios / riesgos (Model · Rule), faltantes — tamaño secundario       │
└──────────────────────────────────────────────────────────────┴──────────────┘
```
- **Puente con el rewind (decisión 14/11):** cada razón de la sugerencia nombra años que el usuario acaba de rebobinar ("In the 3 dry years you just saw (2018, 2022, 2023), wheat after wheat fell below usual"). Tocar un año lleva a Historia en ese año. Contrato: cada razón en `next/<fips>.json` suma `years: [2018, 2022, 2023]` y `source`. Pedido a ML (o a las reglas, si la razón es "Rule").
- Extrapolación (opción que solo se ve en gemelos lejanos): **confianza baja + motivo** junto a la sugerencia: "Low confidence: few counties like yours grow wheat."
- Reglas agronómicas (Soil health, Save water) marcadas como "Rule"; lo del modelo como "Model".

### 4.4 Gemelos — **decidido el 14/11: opción A acotada**
- **Decisión:** los arcos salen solos en el **mapa chico de la derecha** de Próxima campaña (la cámara de la pantalla no se mueve), 1 s después de que aparece la frase sugerida. Así son el segundo "wow" del video sin tapar la sugerencia. Se construyen como componente aislado para poder pasar a B sin rehacer la pantalla. Esto responde la pregunta 5 de Lucho.

Opciones evaluadas:
- **Opción A (por defecto para el primer build):** al abrir Próxima campaña la cámara se aleja y salen **arcos brillantes** del condado hacia sus gemelos; cada tarjeta resalta los suyos; tocar un gemelo muestra en qué se parecen y qué sembró.
- **Opción B:** botón **"Counties like yours"** que muestra los arcos solo a pedido.
- Criterio para elegir: si en la prueba de 10 s alguien no entiende qué son los arcos, se pasa a B. Construir los arcos como componente independiente para cambiar sin rehacer la pantalla.

### 4.5 Fuentes y límites
- Chips de fuente en cada dato + contador de datasets en la cabecera.
- **Capa satelital opcional** (NASA GIBS, MODIS del condado en ese año) con un botón.
- Aviso: apoya la decisión, no reemplaza al agrónomo; no es producto oficial de la NASA ni del USDA; sin logo de la NASA.

## 5. Dirección visual — decidida

**La paleta y las tipografías están fijas** (decisión del equipo, confirmada el 14/11): las define `docs/specs/mockups-secciones.md` §Identidad y las repite `CLAUDE.md` §10. No se abre otra ronda de color. Los mockups de kie.ai (skill `imagegen`) exploran solo **composición y jerarquía**, en el orden 3 → 5 → 1 → 6 de mockups-secciones. Restricciones: paleta del equipo de `docs/specs/mockups-secciones.md` (Verde noche `#0F2A1D`, Verde campo `#2F7D4F`, Verde brote `#8ED081`, Oro trigo `#E9B949`, Papel `#F6F1E4`, Tierra `#6B4A2F`, Rojo alerta `#E5484D`), colores de cultivo aptos para daltonismo, contraste AA. Las imágenes generadas con IA llevan marca "AI-generated" si se usan en algo público.

## 6. Video

- Toma B: **Sumner, KS** (trigo → maíz, el bar race se luce). Recorrido: estado → Sumner → play del rewind → Próxima campaña con sugerencia (y arcos si se aprueban).
- Toma A a 960×1080 (globo con glow → Kansas → Sumner).
- **Toma C a 1920×1080 (decisión 14/11, sigue el guion de `docs/specs/Plan Demo`):** zoom out → giro a la Pampa, globo centrado y rótulo "Next: Argentina, as data is added". Sin datos ni lotes de Argentina.
- Modo grabación `?take=a|b|c` como en el plan.

## 7. Archivos a actualizar por el cambio de regla

`CLAUDE.md` §10, `docs/design.md`, `docs/front-end-definido.md`, `docs/front-end-plan.md`, `.claude/skills/field-shift-frontend/SKILL.md`: "se compara, no se recomienda" → "sugiere según prioridades, con razones, rango y confianza". Avisar al equipo del cambio.

## 8. Abierto

1. Quién genera los JSON (script del front o cada equipo).
2. ~~Gemelos: arcos automáticos o botón "Counties like yours" (§4.4).~~ → Arcos en el mapa chico (§4.4).
3. Variable del mapa de estado.
4. ~~Botón de entrada: Story o Sumner.~~ → Sumner, sin landing aparte (§4.1).
5. Formato y llegada del dataset de costos.
6. ~~Tema visual (mockups §5).~~ → Paleta fija (§5).

## 9. Respuestas para Lucho (`docs/specs/Plan Demo` §7)

1. **Landing:** no hace falta. La portada es el globo y el botón "Rewind Sumner County, KS" es el "Start demo".
2. `?take=a|b|c`: pendiente de build.
3. Toma C: **1920×1080**.
4. Sugerencia: datos de ML; si no llegan antes del domingo 18:00, va con sello "Prototype data" visible.
5. Gemelos: **arcos automáticos en el mapa chico**.
6. Botón de entrada: **Sumner**.
7. Versión estable: pendiente de build.
- Extra: el rewind de la app corre a ≈1,6 s por año; en edición va ×2 con la voz encima (toma B en bruto ≈18 s de rewind).
- Ojo (lo maneja Lucho): su guion no tiene la presentación "nombre y equipo" ni los subtítulos que su §2 marca como obligatorios.

## Implementation Tasks

Salen de la revisión de diseño del 14/11. Cada una deriva de un hallazgo concreto.

- [ ] **T1 (P1, humano: ~15 min / CC: ~2 min)** — Concepto — Pedir a ML que actualice `INFO.md` §1–3 a condados + sugerencia (v0.3)
  - Surfaced by: Pasada 1, `INFO.md` describe lotes por sector y "el modelo no recomienda"
  - Files: `INFO.md` (lo edita ML)
  - Verify: `INFO.md` §2 regla 5 ya no dice "no recomienda"
- [ ] **T2 (P1, humano: ~2 h / CC: ~20 min)** — Próxima campaña — Construir la jerarquía fija (frase sugerida → filas con eje común → beneficios/riesgos)
  - Surfaced by: Pasada 1, 9 elementos al mismo nivel en 6 s de video
  - Files: `web/src/next/*`
  - Verify: en 1920×1080, la frase sugerida y sus 2 razones se leen en 3 s
- [ ] **T3 (P1, humano: ~1 h / CC: ~10 min)** — Datos — Bajar NASA POWER de los centroides de IA/IL/KS y marcar años secos/húmedos
  - Surfaced by: Pasada 1, NASA casi invisible en el rewind
  - Files: `scripts/build_front_data.py`, `web/public/data/county/*.json`
  - Verify: la línea de tiempo de Sumner muestra marcas de año seco y el titular arranca con "(NASA POWER)"
- [ ] **T4 (P1, humano: ~1 h / CC: ~10 min)** — Historia — Precarga de los 11 rasters, ▶ con "Loading N/11 years", fallo de año como "Missing data"
  - Surfaced by: Pasada 2, rewind sin estado de carga
  - Files: `web/src/history/*`
  - Verify: con throttling "Slow 3G", el play no arranca hasta tener los 11 y nunca parpadea
- [ ] **T5 (P1, humano: ~30 min / CC: ~5 min)** — Contrato — Sumar `years[]` y `source` a cada razón de `next/<fips>.json` y pedirlo a ML
  - Surfaced by: Pasada 3, la sugerencia no se conecta con el rewind
  - Files: `docs/front-end-plan.md` §7, `web/src/data/types.ts`, `web/src/next/*`
  - Verify: tocar un año en una razón lleva a Historia en ese año
- [ ] **T6 (P2, humano: ~30 min / CC: ~5 min)** — Historia — Ritmo del play a ≈1,6 s por año
  - Surfaced by: Pasada 3, titulares ilegibles a 0,8 s
  - Files: `web/src/history/Timeline*`
  - Verify: el titular completo se alcanza a leer en cada año
- [ ] **T7 (P1, humano: ~1 h / CC: ~10 min)** — Mapa — Portada = globo con "Rewind Sumner County, KS" + "Pick your county"
  - Surfaced by: Pasada 3, la entrada del jurado no coincide con el video
  - Files: `web/prototype/globo/index.html` → `web/src/map/*`
  - Verify: desde la URL pública, un clic reproduce el recorrido de la toma B
- [ ] **T8 (P2, humano: ~20 min / CC: ~3 min)** — Estilo — Glow solo en la atmósfera del globo y los arcos; latido solo en estados, se apaga al interactuar
  - Surfaced by: Pasada 4, riesgo de look "neón sobre oscuro"
  - Files: `web/src/ui/*`, CSS
  - Verify: ningún botón, tarjeta ni insignia tiene halo
- [ ] **T9 (P2, humano: ~1,5 h / CC: ~15 min)** — Gemelos — Arcos en el mapa chico, 1 s después de la frase sugerida, como componente aislado
  - Surfaced by: Pasada 7, decisión A/B de gemelos
  - Files: `web/src/next/TwinArcs*`
  - Verify: los arcos no tapan la frase sugerida en 1920×1080
- [ ] **T10 (P2, humano: ~15 min / CC: ~2 min)** — Video — `?take=c` a 1920×1080 con rótulo "Next: Argentina, as data is added"
  - Surfaced by: Pasada 6, tamaño de toma C en conflicto
  - Files: modo grabación
  - Verify: grabación de prueba a 1920×1080 sin datos de Argentina

Supuesto de esfuerzo: humano ÷ CC ≈ 6–10× (features de UI con datos ya definidos).

## Design Review Completion Summary

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | sin DESIGN.md; tokens en mockups-secciones  |
  | Step 0               | 5/10; foco: concepto + pitch                |
  | Pass 1  (Info Arch)  |  4/10 →  7/10 after fixes                   |
  | Pass 2  (States)     |  6/10 →  8/10 after fixes                   |
  | Pass 3  (Journey)    |  4/10 →  7/10 after fixes                   |
  | Pass 4  (AI Slop)    |  7/10 →  8/10 after fixes                   |
  | Pass 5  (Design Sys) |  6/10 →  8/10 after fixes                   |
  | Pass 6  (Responsive) |  7/10 →  7/10 (fuera de foco)               |
  | Pass 7  (Decisions)  |  1 resolved, 3 deferred                     |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (4 items)                           |
  | What already exists  | written                                     |
  | TODOS.md updates     | 0 items (sin TODOS.md; diferidos abajo)     |
  | Approved Mockups     | 0 generated (sin clave de imágenes)         |
  | Decisions made       | 11 added to plan                            |
  | Decisions deferred   | 6 (listed below)                            |
  | Overall design score |  4/10 →  7/10                               |
  +====================================================================+
```

**Por qué no llega a 8:** la sugerencia puede salir con sello "Prototype data" (2B, riesgo aceptado), la presentación del equipo y los subtítulos del video quedan en manos de Lucho, y celular/a11y no se revisaron en profundidad.

**NOT in scope**
- Lotes divididos en sectores ("idea 1" de `INFO.md`): fuera del MVP por decisión 1A.
- Capa satelital GIBS en el video: no entra en 30 s (Plan Demo §5).
- "Higher income" en el video: solo si llega el dataset de costos.
- Revisión profunda de celular y accesibilidad: fuera del foco elegido (concepto + pitch).

**What already exists**
- `web/prototype/globo/index.html`: globo MapLibre con los tokens de la paleta como variables CSS y contraste documentado. Es la base de la portada (T7).
- `docs/specs/mockups-secciones.md`: identidad fija, colores de cultivo y lista de componentes.
- `docs/design.md`: terna de valores, barra de rango, medidor de confianza, chip de fuente, Model/Rule y caja de faltante, reutilizables.

**Unresolved Decisions**
- Quién genera los JSON del front (§8.1).
- Variable del mapa de estado (§8.3); ya no aparece en el video.
- Formato y llegada del dataset de costos (§8.5).
- Presentación "nombre y equipo" y subtítulos del video (los maneja Lucho, 9C).
- DESIGN.md formal (diferido por tiempo).
- Pasada de celular y accesibilidad (diferida por foco).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Outside Review | — | Independent 2nd opinion | 0 | skipped | no se corrió (foco en concepto + pitch, plazo) |
| Eng Review | `/autoplan` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | issues_open | score: 4/10 → 7/10, 11 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

- **OUTSIDE COVERAGE:** no se corrieron voces externas en esta revisión (skipped).
- **VERDICT:** ninguna revisión CLEAR todavía; Design Review con issues abiertos; eng review required.

**UNRESOLVED DECISIONS:**
- Quién genera los JSON del front
- Variable del mapa de estado
- Formato y llegada del dataset de costos
- Presentación del equipo y subtítulos del video (Lucho)
- DESIGN.md formal
- Pasada de celular y accesibilidad
