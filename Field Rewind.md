---
tags: [field-rewind, indice]
actualizado: 2026-11-15
---

# Field Rewind — índice del front-end

*"Rewind your land before you decide."* · Equipo Pepers · NASA Space Apps 2026

## Empezá por acá

0. [[TAREAS]] — **lista de tareas del front**: anotá tu nombre antes de empezar, tachala al mergear.
1. [[front-back-connection-spec]] — **spec vigente** (entrevista del 14/11). Manda sobre todo lo demás.
2. [[front-end-plan]] — arquitectura, contrato de JSON, tomas del video y orden de construcción.
3. [[mockups-secciones]] — **secciones a mockear** y paleta elegida (esperando aprobación).
4. [[CONTEXTO_FRONT_VIDEO]] — lo que pide Luciano para el video y los plazos (en `docs/video/`).

## Referencia

- [[front-end-definido]] — flujo pantalla por pantalla (versión del 14/11, antes de la spec).
- [[design]] — decisiones de diseño y componentes reutilizables.
- [[ML_NOTAS_CDL]] — qué hay en los datos del CDL y qué entrega ML.
- [[CLAUDE]] — reglas del repo y contrato de los CSV (§10: front-end).

## Dónde está cada cosa

| Carpeta | Qué hay |
|---|---|
| `web/` | La app (Vite + React). `web/public/data/` son los JSON que lee; no se editan a mano |
| `scripts/` | Generan esos JSON: `build_front_data.py` (historia de cada condado + color del globo) y `build_next_json.py` (Next season) |
| `backend/ML/` · `backend/Datos/` | Notebooks y salidas del equipo de ML (`Datos/front/` = JSON para el front) |
| `data/cdl/` | Entrega del CDL: `cdl_fieldshift.zip` (superficies, transiciones, rasters) y `cdl_puntos.csv` |
| `docs/specs/` | Spec vigente y mockups · `docs/video/` contexto, plan y clips del video · `docs/prototipos/` el globo viejo en HTML |

Regenerar los datos del front después de un cambio de ML o del CDL:
`python3 scripts/build_front_data.py && python3 scripts/build_next_json.py`

## Cambios del 15/11

- **Datos reales en todo el front:** el globo se pinta con el rinde de maíz del USDA NASS (media 2021–2025), sin datos de prueba.
- **Historia para los 293 condados de IA, IL e IN:** rinde por año, clima de NASA POWER y años fuera de lo habitual (modelo de ML). El mapa del CDL sigue para Story, McLean y Sumner.
- Botón de entrada: **Story, IA** (Kansas no está en el modelo).

## Cambios del 14/11

- La app **sugiere** una opción según las prioridades, con razones, rango y confianza (antes: "compara, no recomienda").
- Estados: **Iowa, Illinois, Kansas**. Rewind **2015–2025** → la voz dice "a decade".
- Historia: condado pintado lote a lote (CDL) + bar chart race de cultivos + titular por año.
- Rango de cada opción en **bu/acre**. Ingreso $/acre cuando lleguen los costos.
- Toma B con **Sumner, KS**. Datos faltantes como "Prototype data" marcado.

## Decisiones abiertas

- [ ] Gemelos: arcos al abrir Próxima campaña o botón "Counties like yours"
- [x] Quién genera los JSON: los scripts de `scripts/`, a partir de lo que entrega cada equipo
- [x] Variable que pinta el mapa de estado: rinde de maíz NASS, media 2021–2025
- [x] Botón de entrada: Story
- [ ] Formato del dataset de costos
- [x] Paleta y tipografías: Verde noche, campo, brote, Oro trigo, Papel, Tierra, Rojo alerta · Bricolage Grotesque + DM Sans
- [ ] Aprobar secciones de [[mockups-secciones]] y generar 5 variaciones con kie.ai

## Avisar al equipo

- [ ] Luciano: Kansas confirmado y "a decade" en la voz
- [ ] ML: rango en bu/acre, no NDVI
- [ ] Datos: NASS de todos los condados de IA, IL, KS
