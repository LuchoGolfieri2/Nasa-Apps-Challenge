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

## Pantalla 1 · Mapa

- [ ] **F11** Globo girando con atmósfera, los 3 estados encendidos con latido que se apaga al interactuar · 🔨 Naim (14/11 15:58)
  - Archivos: `web/prototype/globo/` → `web/src/map/Globe*`
- [ ] **F12** Portada = globo con botón "Rewind Sumner County, KS" (vuelo → Sumner → play) y "Pick your county" · 🔨 Naim (14/11 15:58) · Bloquea: F11
- [ ] **F13** Vuelo al estado, condados pintados por la variable, rayado "Missing data", tooltip y botón "See its history" · 🔨 Naim (14/11 15:58) · Bloquea: F08, F11
- [ ] **F14** Buscador de condado, lista accesible de estados, aviso fuera de cobertura y mapa plano si no hay WebGL · 🔨 Naim (14/11 15:58)

## Pantalla 2 · Historia del condado

- [x] ~~**F15** Línea de tiempo ⏪/▶ 2015–2025, autoplay a ≈1,6 s por año, marcas de año seco/húmedo~~ · ✅ Walicki
  - Archivos: `web/src/history/Timeline*`
- [x] ~~**F16** Precarga de los 11 rasters: ▶ deshabilitado con "Loading 7/11 years"; año que falla = "Missing data" sin frenar el play~~ · ✅ Walicki · Bloquea: F06
- [x] ~~**F17** Condado pintado lote a lote con el CDL del año, sincronizado con la línea de tiempo~~ · ✅ Walicki · Bloquea: F06, F15
- [x] ~~**F18** Bar chart race de superficie por cultivo, sincronizado con la línea de tiempo~~ · ✅ Walicki · Bloquea: F05, F15
- [x] ~~**F19** Titular por año ("2023 — Dry July (NASA POWER). Corn after soy on 46% of fields (USDA CDL).")~~ · ✅ Walicki · Bloquea: F05, F07
- [x] ~~**F20** Bloque inferior: rinde vs. lo habitual en palabras, verdor (como vigor), clima, agua en el suelo, con chips de fuente~~ · ✅ Walicki

## Pantalla 3 · Próxima campaña

- [ ] **F21** Rotación actual precargada y editable con chips + prioridades multiselección (Risk, Income, Soil, Water); la sugerida cambia en vivo · Libre
- [ ] **F22** Jerarquía fija: frase sugerida con 2 razones y confianza → 3 opciones en filas con barras p10–p90 en un eje común (bu/acre) → beneficios/riesgos (Model · Rule) y faltantes · Libre
  - Verificar: a 1920×1080 la frase y sus razones se leen en 3 s.
- [ ] **F23** Años de cada razón clickeables → llevan a Historia en ese año (`years[]` en `next/<fips>.json`) · Libre · Bloquea: F15, F22
- [ ] **F24** Arcos a condados gemelos en el mapa chico de la derecha, 1 s después de la frase sugerida, como componente aislado · Libre
  - Archivos: `web/src/next/TwinArcs*`

## Pantalla 4 · Fuentes y límites

- [ ] **F25** Pantalla de fuentes, contador "N NASA & USDA datasets" en la cabecera y avisos (no reemplaza al agrónomo, no es producto oficial de la NASA ni del USDA) · Libre

## Video y entrega

- [ ] **F26** Modo grabación `?take=a|b|c` (A 960×1080, B y C 1920×1080; C con rótulo "Next: Argentina, as data is added") · Libre
- [ ] **F27** Deploy en Vercel y pasar la URL pública a Lucho · Libre · Bloquea: F01
- [ ] **F28** Revisión final: 1920×1080, celular, teclado, contraste AA, `prefers-reduced-motion` · Libre

---

## Decisiones abiertas (no son tareas: se resuelven en el grupo)

1. Quién genera los JSON: `scripts/build_front_data.py` del front o cada equipo.
2. Qué variable pinta el mapa de estado (propuesta: % de maíz NASS).
3. Formato y llegada del dataset de costos (sin eso, "Higher income" muestra "Missing data").
