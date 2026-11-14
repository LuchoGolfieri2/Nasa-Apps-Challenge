# Field Rewind — Spec del front-end y su conexión con el back

*Entrevista del 14/11/2026 · Responsable: front-end y video · Reemplaza las partes que choquen de `docs/front-end-plan.md`*

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
| Pantalla objetivo              | **Escritorio 1920×1080** primero (jueces y toma B). Celular funcional, secundario. Tomas A y C a 960×1080.                                                              |
| Datos faltantes al cierre      | Si NDVI, SMAP o ML no llegan: **datos de prueba marcados** con sello visible "Prototype data" en cada bloque afectado. Lo real va sin sello. Nunca mezclados sin marca. |

## 3. Conexión front ↔ back

- La app lee **JSON estáticos** (contrato en `docs/front-end-plan.md` §7, con los cambios de abajo). `null` = "Missing data"; `"prototype": true` en un bloque = sello "Prototype data".
- **Quién genera los JSON: a confirmar con el equipo.** Propuesta por defecto: `scripts/build_front_data.py` del front, que lee CSV de `data/processed/`, el zip del CDL, `data/ml/` y el dataset de costos.
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
- Entrada para quien abre la URL sin guía: globo + botón **"Try Story County"** que lleva directo al condado de demo. *(Revisar: la toma B usa Sumner; evaluar cambiar el botón a Sumner para que el jurado vea lo mismo que el video.)*
- Estado pintado por una variable (pendiente; propuesta: % de maíz NASS); condados sin datos rayados con "Missing data".

### 4.2 Historia del condado (el rewind)
- Protagonistas, sincronizados con un solo deslizador ⏪/▶ (play automático 2015→2025):
  1. **El condado pintado lote a lote** con el CDL de 30 m de ese año: se ve la rotación cambiar.
  2. **Bar chart race de cultivos por superficie**: las barras se reordenan año a año (en Sumner el trigo cae y el maíz sube).
- **Titular por año** generado desde los datos: "2023 — Dry July. Corn after soy on 46% of fields." Se lee sin mirar gráficos.
- Debajo: rinde del año contra lo habitual (palabras), verdor, clima, agua en el suelo; chips de fuente en cada dato.

### 4.3 Próxima campaña
- **Rotación actual precargada** (la más común del condado según CDL) y editable con chips. Cero tipeo.
- **Prioridades** (multi-selección): Lower risk in bad years · Higher income · Soil health · Save water. La opción sugerida cambia en vivo.
- Tres opciones (actual + 2). Una lleva **"Suggested for your priorities"** con 2 razones con fuente y su confianza. Las otras quedan visibles con sus rangos.
- Rango en **bu/acre** (p10 / mediana / p90). Ingreso $/acre cuando haya costos.
- Extrapolación (opción que solo se ve en gemelos lejanos): **confianza baja + motivo** junto a la sugerencia: "Low confidence: few counties like yours grow wheat."
- Reglas agronómicas (Soil health, Save water) marcadas como "Rule"; lo del modelo como "Model".

### 4.4 Gemelos — **EN REVISIÓN, a definir por el equipo**
- **Opción A (por defecto para el primer build):** al abrir Próxima campaña la cámara se aleja y salen **arcos brillantes** del condado hacia sus gemelos; cada tarjeta resalta los suyos; tocar un gemelo muestra en qué se parecen y qué sembró.
- **Opción B:** botón **"Counties like yours"** que muestra los arcos solo a pedido.
- Criterio para elegir: si en la prueba de 10 s alguien no entiende qué son los arcos, se pasa a B. Construir los arcos como componente independiente para cambiar sin rehacer la pantalla.

### 4.5 Fuentes y límites
- Chips de fuente en cada dato + contador de datasets en la cabecera.
- **Capa satelital opcional** (NASA GIBS, MODIS del condado en ese año) con un botón.
- Aviso: apoya la decisión, no reemplaza al agrónomo; no es producto oficial de la NASA ni del USDA; sin logo de la NASA.

## 5. Dirección visual — pendiente

Se define con **mockups de 5 variaciones de color/tema** generados con kie.ai (skill `imagegen`; el usuario la llamó `/kie-image`). Cada mockup muestra la misma pantalla (Historia de Sumner a 1920×1080) para comparar solo color y tema. Restricciones: paleta del equipo de `docs/specs/mockups-secciones.md` (Verde noche `#0F2A1D`, Verde campo `#2F7D4F`, Verde brote `#8ED081`, Oro trigo `#E9B949`, Papel `#F6F1E4`, Tierra `#6B4A2F`, Rojo alerta `#E5484D`), colores de cultivo aptos para daltonismo, contraste AA. Las imágenes generadas con IA llevan marca "AI-generated" si se usan en algo público.

## 6. Video

- Toma B: **Sumner, KS** (trigo → maíz, el bar race se luce). Recorrido: estado → Sumner → play del rewind → Próxima campaña con sugerencia (y arcos si se aprueban).
- Tomas A y C sin cambios (globo con glow; zoom out y giro a la Pampa).
- Modo grabación `?take=a|b|c` como en el plan.

## 7. Archivos a actualizar por el cambio de regla

`CLAUDE.md` §10, `docs/design.md`, `docs/front-end-definido.md`, `docs/front-end-plan.md`, `.claude/skills/field-shift-frontend/SKILL.md`: "se compara, no se recomienda" → "sugiere según prioridades, con razones, rango y confianza". Avisar al equipo del cambio.

## 8. Abierto

1. Quién genera los JSON (script del front o cada equipo).
2. Gemelos: arcos automáticos o botón "Counties like yours" (§4.4).
3. Variable del mapa de estado.
4. Botón de entrada: Story o Sumner.
5. Formato y llegada del dataset de costos.
6. Tema visual (mockups §5).
