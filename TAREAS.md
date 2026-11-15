# Field Rewind — Tareas del front-end

Lista única de tareas de la app. Sale de `docs/specs/front-back-connection-spec.md` (manda) y `docs/front-end-plan.md`. Si una tarea choca con la spec, manda la spec.

## Cómo trabajamos

1. **Antes de empezar, anotá tu nombre.** Hacé `git pull`, elegí una tarea libre (`- [ ]` sin nombre), cambiá `Libre` por `🔨 TuNombre (dd/mm hh:mm)` y pusheá ese cambio solo a `main` enseguida, con el mensaje `Tomo F07`. Así nadie agarra la misma.
2. **Si alguien ya la tomó, no la toques.** Si necesitás algo de esa tarea, hablalo con quien la tiene.
3. **Una rama por tarea:** `front/<id>-<nombre-corto>`, por ejemplo `front/F07-power`. Tocá solo los archivos de tu tarea; si necesitás cambiar algo compartido (`web/src/ui/`, `web/src/data/types.ts`, tokens), avisá en el grupo antes.
4. **Al terminar, tachá la tarea en el mismo PR:** cambiá `- [ ]` por `- [x]`, envolvé el título en `~~ ~~` y cambiá tu marca por `✅ TuNombre`. Al mergear el PR a `main`, la tarea queda tachada para todos.
5. **Antes de mergear:** `git pull origin main`, resolvé conflictos (en este archivo, conservá las marcas de los demás) y probá que la app levanta. Si el pull trajo cambios en `web/package.json` (por ejemplo deck.gl, que usa el globo), corré `npm install` en `web/` primero. Eso es solo para el equipo: los jueces abren el sitio publicado y no instalan nada.
6. **Si largás una tarea sin terminar**, volvé a poner `Libre` y escribí en una línea debajo qué quedó hecho.
7. **Tareas nuevas** van al final de su sección con el próximo número libre.

Ejemplo:

```
- [ ] **F07** Bajar NASA POWER ... · Libre
- [ ] **F07** Bajar NASA POWER ... · 🔨 Naim (14/11 21:30)
- [x] ~~**F07** Bajar NASA POWER ...~~ · ✅ Naim
```

`Bloquea: F01` = no se puede terminar sin esa otra tarea. Se puede empezar igual con datos de prueba marcados "Prototype data".

---

## Base

- [x] ~~**F01** Scaffold Vite + React + TypeScript en `web/`, rutas por hash (`#/`, `#/state/KS`, `#/county/20191?year=2021`, `#/county/20191/next`, `#/sources`)~~ · ✅ Walicki
  - Archivos: `web/package.json`, `web/src/app/` · Bloquea a casi todo: hacerla primero.
- [ ] **F02** Tokens de color y tipografía como variables CSS (paleta del equipo, Bricolage Grotesque + DM Sans, colores de cultivo aptos para daltonismo sobre fondo oscuro) · 🔨 Lucho
  - Archivos: `web/src/ui/tokens.css` · Base: los tokens de `web/prototype/globo/index.html`.
- [ ] **F03** Tipos TS del contrato JSON y carga de datos (`null` → Missing data, `prototype`, `source`) · Libre
  - Archivos: `web/src/data/` · Contrato: front-end-plan §7 + cambios de spec §3.
- [ ] **F04** Componentes base: `Missing`, sello `PrototypeData`, `SourceChip`, `RangeBar`, `Triad`, `Confidence`, `ModelRuleTag` · Libre
  - Archivos: `web/src/ui/` · Referencia: `docs/design.md`. Sin glow (spec §4.1).

## Datos para el front

- [x] ~~**F05** `scripts/build_front_data.py`: del zip del CDL arma `county/<fips>.json` (`crops_pct`, `area_by_crop`, `common_rotations`) para Story, McLean y Sumner; lo demás en `null`~~ · ✅ Walicki
- [x] ~~**F06** PNG del CDL por año (2015–2025) recortado a cada condado de demo, con la paleta de cultivos~~ · ✅ Walicki
  - Archivos: `web/public/data/cdl/<fips>/<anio>.png`
- [ ] **F07** NASA POWER en los centroides de IA, IL y KS: lluvia y temperatura por año, marcas de año seco/húmedo y titular que arranca con el dato NASA · Libre
  - Verificar: la línea de tiempo de Sumner muestra años secos y el titular dice "(NASA POWER)".
- [ ] **F08** Condados del Census (IA, IL, KS) simplificados → `geo/counties_<ST>.geojson` con `fips` y `name` · Libre
- [ ] **F09** `state_layer.json` con la variable del mapa de estado (propuesta: % de maíz NASS); sin dato → `null` · Libre · Bloquea: NASS, decisión abierta 2
- [ ] **F10** Meter NASS, MODIS, SMAP y ML a medida que lleguen (solo regenerar JSON, sacar el sello "Prototype data" donde haya dato real) · Libre
- [ ] **F31** Chequear: mapas lote a lote para 10 estados (viabilidad, peso y aprobación) · Libre
  - Medición (15/11, un condado-año en CropScape): unos 5 s y 2 MB por archivo del CDL a 30 m.
  - Volumen: unos 1.000 condados (supuesto, falta contar los 6 estados nuevos) por 11 años son unos 11.000 archivos y ~22 GB en bruto.
  - Tiempo: unas 15 h en serie, o 2–3 h con 8 descargas en paralelo, más 1 h de procesado.
  - Aprobación: ese volumen pasa el límite de 5 GB de `CLAUDE.md` (regla 6); hace falta el OK del equipo antes de empezar.
  - Peso en el sitio: a 30 m serían ~2,5 GB, demasiado para hospedarlos junto al repo; a 60 m, unos 0,7 GB; otra salida es alojarlos en un almacenamiento aparte.
  - Decisión actual: por ahora solo algunos condados llevan el mapa lote a lote (Story, McLean, Sumner); el resto usa una vista liviana (ver F32). Los datos de modelo y de los 10 estados los suben los de ML: no tocar acá.
- [ ] **F32** Vista liviana para los condados sin mapa lote a lote · Libre · En pausa (decisión 15/11: por ahora no se hace)
  - Hoy esos condados (ej. Perry, IL) muestran solo rinde, clima y "Missing data" donde iría el mapa.
  - Probado: CropScape devuelve un mapa real reducido (~160 m por píxel) en un PNG de ~18 KB y 3 s, con `GetMap` de `wms_cdlall.cgi` (capa `cdl_<año>`, bbox del condado, 256 px de ancho), sin bajar los 2 MB del original.
  - Opciones bocetadas (elegir una al retomar):
    - **A · Mapa real en baja resolución:** el mismo mapa con play, rotulado "Lower detail". ~100–200 MB para ~1.000 condados × 11 años, ~1,5 h de descarga liviana.
    - **B · Celdas de ~1 km:** grilla con el cultivo dominante por celda, calculada a partir de A. ~25 MB.
    - **C · Retrato en cuadritos:** 100 cuadritos (1 = 1 % de la superficie) más la tendencia del % de maíz por año; sin mapa. ~2 MB. Los datos salen de `GetCDLStat`, que ya se usa en `scripts/build_crop_density.py`.
  - Recomendación: A + C. Los 3 condados a 30 m llevan "Field-level" y los demás "Lower detail", para no mezclar calidades sin aviso.
- [ ] **F33** Estados nuevos en el globo y la historia (MN, MO, NE, OH, SD, WI y ND): polígonos, selector, historia y gemelos resaltados · Libre · Bloquea: entrega "para_front" de datos
  - Preparado (15/11): `scripts/build_globe_geo.py` (suma polígonos y estados a `globe-data.json`), `web/src/data/states.ts` (lista única de estados) y `build_front_data.py` con los 11 estados. Probado con datos sintéticos, falta con el archivo real.
  - Pasos y cuidados (17 columnas solo para IA, IL e IN; Argentina fuera de alcance): `docs/datos-de-prueba.md`, sección E.

## Pantalla 1 · Mapa

- [x] ~~**F11** Globo girando con atmósfera, los 3 estados encendidos con latido que se apaga al interactuar~~ · ✅ Naim
  - Archivos: `web/src/map/globe.js` (deck.gl + Blue Marble de GIBS)
  - Sin latido: el resaltado es fijo, porque un latido parece un dato en vivo y no lo es. Gira solo a 3°/s tras 3 s sin tocarlo.
- [x] ~~**F12** Portada = globo con botón "Rewind Sumner County, KS" (vuelo → Sumner → play) y "Pick your county"~~ · ✅ Naim · Bloquea: F11
- [x] ~~**F13** Vuelo al estado, condados pintados por la variable, rayado "Missing data", tooltip y botón "See its history"~~ · ✅ Naim · Bloquea: F08, F11
  - El rayado sale en los condados con el valor vacío: hoy ninguno (los valores son de prueba); aparece cuando F08 traiga huecos. Tooltip: "Butler County, KS · Corn 34%" o "Missing data".
- [x] ~~**F14** Buscador de condado, lista accesible de estados, aviso fuera de cobertura y mapa plano si no hay WebGL~~ · ✅ Naim
  - Buscador en la barra de arriba (estados y condados; fuera de cobertura dice "Not covered yet"). Lista de estados oculta para lectores de pantalla.
  - Sin mapa plano: el globo necesita WebGL (decisión del 14/11).

## Pantalla 2 · Historia del condado

- [x] ~~**F15** Línea de tiempo ⏪/▶ 2015–2025, autoplay a ≈1,6 s por año, marcas de año seco/húmedo~~ · ✅ Walicki
  - Archivos: `web/src/history/Timeline*`
- [x] ~~**F16** Precarga de los 11 rasters: ▶ deshabilitado con "Loading 7/11 years"; año que falla = "Missing data" sin frenar el play~~ · ✅ Walicki · Bloquea: F06
- [x] ~~**F17** Condado pintado lote a lote con el CDL del año, sincronizado con la línea de tiempo~~ · ✅ Walicki · Bloquea: F06, F15
- [x] ~~**F18** Bar chart race de superficie por cultivo, sincronizado con la línea de tiempo~~ · ✅ Walicki · Bloquea: F05, F15
- [x] ~~**F19** Titular por año ("2023 — Dry July (NASA POWER). Corn after soy on 46% of fields (USDA CDL).")~~ · ✅ Walicki · Bloquea: F05, F07
- [x] ~~**F20** Bloque inferior: rinde vs. lo habitual en palabras, verdor (como vigor), clima, agua en el suelo, con chips de fuente~~ · ✅ Walicki
- [x] ~~**F35** Tarjeta "This season, before USDA's map" (punto 6 de ML) en la historia: duelo regla de rotación contra satélite, fechas de corte y curva de probabilidad; barra de desplazamiento propia en la columna del año~~ · ✅ Walicki
  - Archivos: `web/src/history/SeasonCard.tsx`, `season.css`, `useScrollFade.ts`, `scripts/build_season_json.py` · Datos: `backend/Datos/front/cultivo_temporada.json`
  - Alcance: solo los 5 condados con lote de demo (Champaign IL, Tippecanoe IN, Crawford IA, Hamilton IA, Shelby IA) y solo con el año 2025; es la temporada 2025 repetida, no un pronóstico (ver fila C7 de `docs/datos-de-prueba.md`).
  - Falta: sumar NASA HLS a la pantalla de Fuentes; más lotes (lo decide ML); decidir si el punto 6 también va en el pitch.
- [ ] **F34** Definir cómo se ve "See more" en los condados sin PNG del mapa (hoy 291 de los 294 con historia; el resto de los estados no tiene historia) · Libre · A definir en el grupo
  - Hoy: sin mapa del CDL, "See more" abre la pantalla de rinde año a año con un aviso "Missing data" donde iría el mapa (ej. Shelby, IL). El globo con el condado pegado solo existe en Story, McLean y Sumner.
  - A decidir: qué muestra en lugar del globo con el mapa (el condado resaltado sobre el globo sin capa de cultivos, o una de las vistas livianas de F32), y qué texto acompaña.
  - Relacionada: F32 (opciones A, B y C de vista liviana) y F31 (cuántos condados tendrán mapa lote a lote).

## Pantalla 3 · Próxima campaña

- [ ] **F21** Rotación actual precargada y editable con chips + prioridades multiselección (Risk, Income, Soil, Water); la sugerida cambia en vivo · Libre
- [ ] **F22** Jerarquía fija: frase sugerida con 2 razones y confianza → 3 opciones en filas con barras p10–p90 en un eje común (bu/acre) → beneficios/riesgos (Model · Rule) y faltantes · Libre
  - Verificar: a 1920×1080 la frase y sus razones se leen en 3 s.
- [ ] **F23** Años de cada razón clickeables → llevan a Historia en ese año (`years[]` en `next/<fips>.json`) · Libre · Bloquea: F15, F22
- [x] ~~**F24** Arcos a condados gemelos en el mapa chico de la derecha, 1 s después de la frase sugerida, como componente aislado~~ · ✅ Naim
  - Archivos: `web/src/next/TwinArcs*`

## Pantalla 4 · Fuentes y límites

- [ ] **F25** Pantalla de fuentes, contador "N NASA & USDA datasets" en la cabecera y avisos (no reemplaza al agrónomo, no es producto oficial de la NASA ni del USDA) · Libre

## My Farm (nueva, 15/11)

- [x] ~~**F29** My Farm: perfil del campo (condado, acres, cultivos de los últimos años, costo y precio propios, prioridades) guardado en el navegador; pantalla tipo dashboard con ilustraciones de cultivos, medidor y curva de rinde; Next season usa ese perfil~~ · ✅ Lucho

## Video y entrega

- [ ] **F26** Modo grabación `?take=a|b|c` (A 960×1080, B y C 1920×1080; C con rótulo "Next: Argentina, as data is added") · Libre
- [ ] **F27** Deploy en Vercel y pasar la URL pública a Lucho · Libre · Bloquea: F01
- [ ] **F28** Revisión final: 1920×1080, celular, teclado, contraste AA, `prefers-reduced-motion` · Libre

---

## Decisiones abiertas (no son tareas: se resuelven en el grupo)

1. Quién genera los JSON: `scripts/build_front_data.py` del front o cada equipo.
2. Qué variable pinta el mapa de estado (propuesta: % de maíz NASS).
3. Formato y llegada del dataset de costos (sin eso, "Higher income" muestra "Missing data").
