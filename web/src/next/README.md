# Pantalla 3 — Next season (F21, F22, F23, F24)

Estado: funciona con **datos reales** del equipo de ML y del CDL. Los JSON los arma `scripts/build_next_json.py`
(201 condados de Iowa e Illinois; Kansas todavía no está en el modelo → "Missing data").

## Archivos
| Archivo | Qué es |
|---|---|
| `NextSeason.tsx` | La pantalla. `<NextSeason data={json} onYearClick={(y) => …} />` |
| `suggest.ts` | Lógica pura: qué opción gana según las prioridades, y el eje común de las barras |
| `TwinGlobe.tsx` | F24. El globo de la pantalla 1 de fondo (deck.gl, Blue Marble de GIBS), quieto: el usuario no lo mueve. Arcos en 3D del condado a sus gemelos, 1 s después de cambiar `animateKey`; el gemelo elegido va en oro. Al aparecer, la cámara baja hacia los estados (1,1 s; sin animación con `prefers-reduced-motion`) |
| `NextScreen.tsx` | Ruta `#/county/<fips>/next`: carga `data/next/<fips>.json`, migas y "Missing data" si no hay archivo |
| `bits.tsx` | Usa `Missing`, `PrototypeStamp` y `SourceChip` de `src/ui`; suma `Confidence` y `ModelRuleTag` (mover a `src/ui` con F04) |
| `types.ts` | Tipos de `next/<fips>.json`. Los cultivos usan los ids de `src/ui/crops.ts` |
| `twinMapShapes.ts` | Contornos de IA, IL, KS ya proyectados (generado) |
| `next.css` | Estilos; usa los tokens de `web/src/ui/tokens.css` |
| `scripts/build_next_json.py` (raíz del repo) | Cruza `backend/Datos` (rangos del punto 2, explicaciones del punto 3, gemelos del punto 5) con el CDL y escribe `web/public/data/next/<fips>.json` y `web/src/map/next-available.json` |

## Colores
Los cultivos usan `CROP_COLOR` de `src/ui/crops.ts` (los mismos del mapa del CDL). Para el texto grande sobre la tarjeta clara
se usan versiones más oscuras (`CROP_INK` en `NextSeason.tsx`) para que pase contraste AA.

## Reglas que ya cumple
- La sugerida cambia en vivo con las prioridades (promedio de `scores` de las marcadas).
- "Higher income" sin costos → "Missing data: costs not loaded yet" y no entra en el cálculo.
- Sin prioridades → no sugiere nada; las 3 opciones siguen visibles.
- En la frase sugerida solo van razones a favor (`reason.pro`); máximo 2.
- Opción extrapolada → confianza baja + motivo al lado.
- Sello "Prototype data" mientras `prototype` sea true. Sin "porcentaje de éxito".
- Teclado, `aria-pressed`, `prefers-reduced-motion`, confianza con puntos además de color.

## Cambios al contrato que propone este prototipo (avisar a ML / Datos)
- `rotations[]` con `options[]` adentro (las 3 opciones dependen de la rotación elegida).
- `reasons[].pro` (bool) y `reasons[].priority`.
- `options[].usual_bu_ac` (rinde habitual del condado, la marca punteada de la barra).
- `options[].twins` = fips de los gemelos que respaldan esa opción.

## Pendiente / a decidir
- Las barras van en **% de un año habitual del condado** (`asPercentOfUsual` en `suggest.ts`), con bu/acre como dato secundario. La spec decía bu/acre: avisar al equipo.
- Rotación editable cultivo por cultivo (hoy se elige entre las 3 más comunes del CDL).
- F23 queda listo del lado de esta pantalla; falta la línea de tiempo (F15) del otro lado.

## De dónde sale cada cosa (datos reales)
| En pantalla | Fuente |
|---|---|
| Rango p10 / mediana / p90 de cada opción | `backend/Datos/escenarios_rotacion_resumen.csv` (modelo del punto 2) |
| Razones, riesgos con años, confianza, "qué mueve el rango" | `backend/Datos/front/explicaciones.json` (punto 3) |
| Gemelos por opción y "Something new nearby" (trigo, avena) | `backend/Datos/front/gemelos.json` (punto 5) |
| "Most common sequences here" | `web/public/data/county/<fips>.json` (CDL, pantalla 2); si no hay, la frase del modelo |
| Puntaje de riesgo | p10 de cada opción, comparado entre las tres (Model) |
| Puntaje de suelo | Regla fija: rotar > habitual > repetir (Rule) |
| Ingreso y agua | "Missing data": no hay costos ni dato que separe las opciones |

Para regenerar después de un cambio en `backend/Datos`: `python3 scripts/build_next_json.py`.
