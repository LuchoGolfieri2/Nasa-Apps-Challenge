# Field Rewind — Tareas del front-end

Lista única de tareas de la app. Sale de `docs/specs/front-back-connection-spec.md` (manda) y `docs/front-end-plan.md`. Si una tarea choca con la spec, manda la spec.

> **F34 resuelta el 15/11** con el mapa del estado por rinde (opción 6). Sitio publicado: https://field-rewind.vercel.app (F27). Lo urgente ahora: la prueba a mano con WebGL (F37).

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
- [x] ~~**F07** Bajar NASA POWER ...~~ · ✅ Lucho/Claude
  - Hecho: clima de NASA POWER por año en las fichas, marcas de julio seco, húmedo, caluroso o fresco, y titulares con "(NASA POWER)" (por ejemplo Sumner 2015 y 2022).
- [ ] **F07** Bajar NASA POWER ... · 🔨 Naim (14/11 21:30)
- [x] ~~**F07** Bajar NASA POWER ...~~ · ✅ Naim
```

`Bloquea: F01` = no se puede terminar sin esa otra tarea. Se puede empezar igual con datos de prueba marcados "Prototype data".

---

## Base

- [x] ~~**F01** Scaffold Vite + React + TypeScript en `web/`, rutas por hash (`#/`, `#/state/KS`, `#/county/20191?year=2021`, `#/county/20191/next`, `#/sources`)~~ · ✅ Walicki
  - Archivos: `web/package.json`, `web/src/app/` · Bloquea a casi todo: hacerla primero.
- [x] ~~**F02** Tokens de color y tipografía como variables CSS (paleta del equipo, Bricolage Grotesque + DM Sans, colores de cultivo aptos para daltonismo sobre fondo oscuro)~~ · ✅ Lucho/Claude
  - Hecho en `web/src/ui/tokens.css`. 15/11: `--ink-3` pasó de 0,56 a 0,64 de opacidad para llegar al contraste AA (F28).
  - Archivos: `web/src/ui/tokens.css` · Base: los tokens de `web/prototype/globo/index.html`.
- [x] ~~**F03** Tipos TS del contrato JSON y carga de datos (`null` → Missing data, `prototype`, `source`)~~ · ✅ Lucho/Claude
  - Hecho en `web/src/data/` (`types.ts`, `load.ts`, `states.ts`).
  - Archivos: `web/src/data/` · Contrato: front-end-plan §7 + cambios de spec §3.
- [x] ~~**F04** Componentes base: `Missing`, sello `PrototypeData`, `SourceChip`, `RangeBar`, `Triad`, `Confidence`, `ModelRuleTag`~~ · ✅ Lucho/Claude
  - Hecho en `web/src/ui/` y `web/src/next/bits.tsx`: `Missing`, `PrototypeStamp`, `SourceChip`, `Confidence`, `ModelRuleTag`. Los rangos p10–p90 y la tríada viven dentro de Próxima campaña, no como componentes sueltos.
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
- [x] ~~**F33** Estados nuevos en el globo y la historia (MN, MO, NE, OH, SD, WI y ND): polígonos, selector, historia y gemelos resaltados~~ · ✅ Walicki, Sebastian
  - Hecho (15/11): polígonos y selector de MN, MO, NE, OH, SD y WI (521 condados, del Census local `cb_2024_us_county_500k.zip`; `scripts/build_globe_geo.py`); Sebastian sumó Dakota del Norte, el color por cultivo de los estados nuevos (`crop-density.json` tiene los 11 estados) y regeneró las fichas con la entrega final. `web/src/data/states.ts` es la lista única. `python3 scripts/check_coverage.py` da 972 polígonos y 943 fichas de historia.
  - Queda: si llega `condados_eeuu.geojson` del equipo, compararlo con el Census; los condados fuera de la tabla del modelo (ej. St. Louis, Cuyahoga) se ven como "Missing data".
  - Pasos y cuidados (17 columnas solo para IA, IL e IN; Argentina fuera de alcance): `docs/datos-de-prueba.md`, sección E.
- [ ] **F36** (ML, punto 5) Que `area_por_cultivo` de `punto5_vecinos.ipynb` emita `oats` en `grew_crop_pct` en vez de `other`, y volver a correr el paso 20 (guardar `gemelos.json`) y `scripts/build_next_json.py` · Libre
  - Por qué: la avena no es una clase del CDL (cae en `other`), pero en Próxima campaña ya es un cultivo propio con ícono y color (`web/src/ui/crops.ts`, `CropIcon`). Hoy las barras "What they plant" de los gemelos la muestran como "Other crops". Con la entrega final del 15/11 `gemelos.json` sigue emitiendo solo `corn`, `soy`, `wheat` y `other`.
  - No hay que reentrenar nada: el punto 5 es una búsqueda de vecinos y el cambio es solo de nombres al guardar. Verificar antes que el área sembrada de avena por condado esté en la entrega.
- [ ] **F38** Verificar que se subieron los datos de todos los condados y lugares que se marcan en el globo (EE. UU. y Argentina) · Libre
  - Hecho EE. UU. (15/11): `python3 scripts/check_coverage.py` cruza globo, historia, Próxima campaña y modelo. Resultado: 919 polígonos (los 10 estados completos), 890 fichas, 895 de Próxima campaña, 0 gemelos rotos y 0 valores en 0. Los 29 condados sin historia los marca el globo con "Missing data": 24 no están en la tabla del modelo (ciudades y zonas de bosque, como St. Louis city o Vilas) y 5 tienen datos de modelo solo antes de 2015. Dakota del Norte sigue sin polígonos ni modelo.
  - Hecho Argentina, datos (15/11): `python3 scripts/build_argentina.py` arma `web/public/data/argentina/` con la entrega final: 219 departamentos (15 `dentro`, 102 `cerca`, 102 `fuera`), polígonos, condados análogos, rindes del MAGyP contra EE. UU. y clima de Buenos Aires. Sin predicción del modelo. Contrato: `docs/argentina-front.md`.
  - Falta Argentina en la interfaz (a decidir con el equipo) y sumarla a `scripts/check_coverage.py`.
  - EE. UU., cantidad de condados con polígono contra los de la entrega (según "Zonas de Field Shift", a confirmar con los archivos): IA 99, IL 102, IN 92, KS 105, MN 87, MO 115, NE 93, OH 88, SD 66, WI 72 y ND 53 (hoy ND no está). Total 972.
  - Para cada condado marcado: tiene ficha de historia (`web/public/data/county/`), archivo de Próxima campaña (`next/`, si su estado tiene modelo) y color del globo (`stat` en `globe-data.json`). Lo que no tenga dato se ve como "Missing data", nunca con 0 ni sin marcar.
  - Cruces a buscar: condados marcados sin datos, datos de condados que no están en el globo, y condados con gemelos que apuntan a un condado sin polígono.
  - Argentina (219 departamentos, a confirmar): Buenos Aires 135, La Pampa 22, Córdoba 26, Santa Fe 19, Entre Ríos 17; 15 en zona `dentro` (12 de Buenos Aires y 3 de La Pampa). Clima por campaña solo en Buenos Aires. Cuando lleguen `departamentos_argentina.geojson` y `.csv`, comprobar que cada departamento marcado tenga su `zona` y su dato, y no mostrar predicción en `fuera`.
  - Cuidado: los `id_depto` de Buenos Aires empiezan con `06`, igual que el FIPS de California; guardarlos en una capa aparte o con un campo de país para que no choquen.
  - Relacionada: F33 (estados nuevos) y `CLAUDE.md` sección 2.1 (Argentina).

## Pantalla 1 · Mapa

- [ ] **F39** Argentina en la interfaz: pantalla `#/argentina` con el mapa de los 219 departamentos por zona, la ficha de cada uno (rinde del MAGyP contra sus análogos de EE. UU., clima de Buenos Aires, suelo) y enlaces a los condados análogos. Sin predicción, según `docs/argentina-front.md` · 🔨 Lucho/Claude (15/11 20:15)
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
  - Hecho después: NASA HLS en la pantalla de Fuentes (el contador de la cabecera pasó a 8) y su límite ("Satellite guess").
  - Falta: más lotes (lo decide ML); decidir si el punto 6 también va en el pitch.
- [x] ~~**F34** ⭐ **TAREA PRINCIPAL** Definir cómo se ve "See more" en los condados sin PNG del mapa (hoy 291 de los 294 con historia más los 596 de los estados nuevos; ejemplo: Champaign, IL)~~ · ✅ Lucho/Claude
  - Hecho con la opción 6: debajo del rinde año a año, el estado entero pintado por rinde de maíz o soja del año, con la misma escala para los 11 años y el condado elegido remarcado (`web/src/history/StateRewind.tsx`, datos en `web/public/data/state/<ST>.json` de `scripts/build_state_yield.py`, sin descargas). Siguen abiertas como mejoras: la opción 2 (globo con el polígono) y la 5 (cuadritos con `GetCDLStat`, necesita correr la descarga en una compu con acceso a CropScape).
  - Hoy: sin mapa del CDL, "See more" abre la pantalla de rinde año a año con un aviso "Missing data" donde iría el mapa. El globo con el condado pegado solo existe en Story, McLean y Sumner.
  - Datos que sí hay para esos condados: polígono (919), rinde de NASS y clima de POWER por año. Faltan los % por cultivo y el mapa por año (solo hay 2025 en algunos estados).
  - Opciones (15/11), de menor a mayor trabajo:
    1. Dejarlo como hoy con un aviso más claro. Horas. Deja la pantalla coja.
    2. Condado resaltado sobre el globo con Landsat y la columna del año, sin capa de cultivos. ~1 día, sin datos nuevos; `CountyGlobe` hoy se encuadra con las esquinas del ráster y habría que usar el polígono. Necesita WebGL (sin WebGL cae a la opción 1). El mosaico Landsat es una imagen anual vieja: rotularla.
    3. Mapa real en baja resolución con play (CropScape WMS, ~160 m, rotulado "Lower detail"). ~10.000 pedidos, 100–200 MB, ~2 h en paralelo; 1–2 días. Necesita OK por la descarga. Se cruza con F31 y F32 (A).
    4. Celdas de ~1 km con el cultivo dominante (sale de la 3, ~25 MB). F32 (B).
    5. Retrato en cuadritos (1 cuadro = 1 % de la superficie) y la tendencia del % de maíz por año, de `GetCDLStat` por año (~2 MB, ~10.000 pedidos chicos). ~1 día. Además llena la carrera de barras, el titular y las cajitas, hoy en "Missing data". F32 (C).
    6. Mapa del estado que se "rebobina" por rinde, con el condado resaltado entre sus vecinos. Sin datos nuevos y sin WebGL, ~1 día; muchos años salen rayados (en Champaign faltan 2024 y 2025).
  - Recomendación: combinar 2 y 5 (misma pantalla que los condados con mapa y datos reales de cultivos). Sin descargas: 2 y 6.
  - Relacionada: F32 (vistas livianas A, B y C), F31 (cuántos condados tendrán mapa lote a lote) y F33 (estados nuevos).

## Pantalla 3 · Próxima campaña

- [x] ~~**F21** Rotación actual precargada y editable con chips + prioridades multiselección (Risk, Income, Soil, Water); la sugerida cambia en vivo~~ · ✅ Lucho/Claude
  - Hecho en `web/src/next/`, también con el plan de My Farm.
- [x] ~~**F22** Jerarquía fija: frase sugerida con 2 razones y confianza → 3 opciones en filas con barras p10–p90 en un eje común (bu/acre) → beneficios/riesgos (Model~~ · ✅ Lucho/Claude
  - Verificar: a 1920×1080 la frase y sus razones se leen en 3 s.
- [x] ~~**F23** Años de cada razón clickeables → llevan a Historia en ese año (`years[]` en `next/<fips>.json`)~~ · ✅ Lucho/Claude
  - Hecho: los años de cada razón son botones que llevan a la historia en ese año.
- [x] ~~**F24** Arcos a condados gemelos en el mapa chico de la derecha, 1 s después de la frase sugerida, como componente aislado~~ · ✅ Naim
  - Archivos: `web/src/next/TwinArcs*`

## Pantalla 4 · Fuentes y límites

- [x] ~~**F25** Pantalla de fuentes, contador "N NASA & USDA datasets" en la cabecera y avisos (no reemplaza al agrónomo, no es producto oficial de la NASA ni del USDA)~~ · ✅ Lucho/Claude
  - Hecho en `web/src/sources/`.

## My Farm (nueva, 15/11)

- [x] ~~**F29** My Farm: perfil del campo (condado, acres, cultivos de los últimos años, costo y precio propios, prioridades) guardado en el navegador; pantalla tipo dashboard con ilustraciones de cultivos, medidor y curva de rinde; Next season usa ese perfil~~ · ✅ Lucho

## Video y entrega

- [ ] **F26** Modo grabación `?take=a|b|c` (A 960×1080, B y C 1920×1080; C con rótulo "Next: Argentina, as data is added") · Libre
- [x] ~~**F27** Deploy en Vercel y pasar la URL pública a Lucho~~ · ✅ Lucho/Claude
  - ✅ **Listo (15/11): https://field-rewind.vercel.app** · proyecto `field-rewind` en Vercel (cuenta de Lucho), raíz `web/`, se republica solo en cada push a `main`. Probado en vivo: historia, mapa del estado y Próxima campaña cargan sus datos.
  - Respaldo: `.github/workflows/pages.yml` publica en GitHub Pages si se activa en Settings → Pages → Source: "GitHub Actions".
- [x] ~~**F28** Revisión final: 1920×1080, celular, teclado, contraste AA, `prefers-reduced-motion`~~ · ✅ Lucho/Claude
  - Revisado el 15/11 a 1920×1080 y 390×844 con `prefers-reduced-motion`, en las 7 pantallas: sin scroll horizontal, sin errores de JavaScript y axe (WCAG 2 A y AA) sin fallas. Se arregló el contraste del texto secundario (`--ink-3`, `--dark-3` de Próxima campaña y el rojo de "−22 bu/ac" sobre fondo claro). El globo y WebGL quedan para F37.
- [ ] **F37** Verificar a mano, en Chrome y en Firefox con WebGL (lo que no se pudo ver en el navegador de Claude: sin WebGL y con el panel oculto) · Libre
  - Barra de desplazamiento de la columna del año: arrastrar la píldora, clic en el riel, hover y difuminado de borde.
  - Tarjeta "This season, before USDA's map" (Champaign, Tippecanoe, Crawford, Hamilton, Shelby): chips de fecha y de lote, botón "See how the satellite decided", que la curva y las etiquetas no se pisen.
  - Animaciones de Próxima campaña y la historia: entrada escalonada de las tarjetas, números que cuentan, fundido entre pantallas (no debe actuar sobre el globo de la historia), hover y presión, brillo único de la sugerida, aro de la barra de tiempo.
  - Historia con globo (Story, McLean, Sumner): íconos de cultivo en la carrera de barras y la leyenda.
  - Globo: rótulo de la portada con los estados, selector de estado, y gemelos resaltados en los estados nuevos.
  - Portada con WebGL: botones Map y My Farm (movimiento al pasar el cursor y al tocar) y el nombre "Field Rewind" que cambia de color; cabecera sin el contador y con My Farm al final.
  - Contador "8 NASA & USDA datasets": que el informe y el formulario de Space Apps (`docs/entrega/informe-space-apps.md`) digan lo mismo.
  - Celular: tarjeta del satélite, chips y que no haya scroll horizontal.

---

## Decisiones abiertas (no son tareas: se resuelven en el grupo)

1. Quién genera los JSON: `scripts/build_front_data.py` del front o cada equipo.
2. Qué variable pinta el mapa de estado (propuesta: % de maíz NASS).
3. Formato y llegada del dataset de costos (sin eso, "Higher income" muestra "Missing data").
