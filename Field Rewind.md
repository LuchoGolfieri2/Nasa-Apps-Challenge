---
tags: [field-rewind, indice]
actualizado: 2026-11-14
---

# Field Rewind — índice del front-end

*"Rewind your land before you decide."* · Equipo Pepers · NASA Space Apps 2026

## Empezá por acá

0. [[TAREAS]] — **lista de tareas del front**: anotá tu nombre antes de empezar, tachala al mergear.
1. [[front-back-connection-spec]] — **spec vigente** (entrevista del 14/11). Manda sobre todo lo demás.
2. [[front-end-plan]] — arquitectura, contrato de JSON, tomas del video y orden de construcción.
3. [[mockups-secciones]] — **secciones a mockear** y paleta elegida (esperando aprobación).
4. [[CONTEXTO_FRONT_VIDEO]] — lo que pide Luciano para el video y los plazos.

## Referencia

- [[front-end-definido]] — flujo pantalla por pantalla (versión del 14/11, antes de la spec).
- [[design]] — decisiones de diseño y componentes reutilizables.
- [[ML_NOTAS_CDL]] — qué hay en los datos del CDL y qué entrega ML.
- [[CLAUDE]] — reglas del repo y contrato de los CSV (§10: front-end).

## Cambios del 14/11

- La app **sugiere** una opción según las prioridades, con razones, rango y confianza (antes: "compara, no recomienda").
- Estados: **Iowa, Illinois, Kansas**. Rewind **2015–2025** → la voz dice "a decade".
- Historia: condado pintado lote a lote (CDL) + bar chart race de cultivos + titular por año.
- Rango de cada opción en **bu/acre**. Ingreso $/acre cuando lleguen los costos.
- Toma B con **Sumner, KS**. Datos faltantes como "Prototype data" marcado.

## Decisiones abiertas

- [ ] Gemelos: arcos al abrir Próxima campaña o botón "Counties like yours"
- [ ] Quién genera los JSON (script del front o cada equipo)
- [ ] Variable que pinta el mapa de estado
- [ ] Botón de entrada: Story o Sumner
- [ ] Formato del dataset de costos
- [x] Paleta y tipografías: Verde noche, campo, brote, Oro trigo, Papel, Tierra, Rojo alerta · Bricolage Grotesque + DM Sans
- [ ] Aprobar secciones de [[mockups-secciones]] y generar 5 variaciones con kie.ai

## Avisar al equipo

- [ ] Luciano: Kansas confirmado y "a decade" en la voz
- [ ] ML: rango en bu/acre, no NDVI
- [ ] Datos: NASS de todos los condados de IA, IL, KS
