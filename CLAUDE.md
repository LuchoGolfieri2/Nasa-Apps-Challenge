# CLAUDE.md — Field Rewind: pipeline de datos

Proyecto del equipo **Pepers** para NASA Space Apps Challenge 2026, desafío **"Field Shift: Adapting Farms with NASA Data"**. La app se llama **Field Rewind** (*"Rewind your land before you decide."*): ayuda a productores a comparar rotaciones de cultivos con datos de la NASA y el USDA y sugiere una según sus prioridades. "Field Shift" es el nombre del desafío, no de la app.

**Zona de estudio: Iowa, Illinois y Kansas (Estados Unidos).** Reemplaza a la zona núcleo argentina de versiones anteriores. Si encontrás instrucciones, nombres o fuentes argentinas (MAGyP, INTA, IGN, INDEC, `id_depto`, `campania`), están desactualizadas: avisá al humano.

**Este repo NO entrena modelos.** Su único objetivo es bajar, limpiar y estructurar datos en CSV listos para que otro equipo arme el modelo de machine learning.

Referencia de variables: planilla "Catálogo de variables – Field Shift" (IDs como C01, M01, Y04). Este archivo resume lo necesario para trabajar sin ella.

---

## 1. Reglas para cualquier agente

1. **No inventes datos.** Si una descarga falla o un producto no existe con ese nombre, registralo en el data card y seguí con lo demás. Nunca rellenes con valores supuestos.
2. **`data/raw/` no se modifica.** Lo que se baja queda tal cual. Toda transformación va a `interim/` o `processed/`.
3. **Scripts reproducibles e idempotentes.** Correr dos veces da el mismo resultado; si el archivo ya está en `raw/`, no se vuelve a bajar.
4. **Trabajá solo en tu paquete.** Cada agente toca `src/<paquete>/`, `data/*/<paquete>/` y `docs/datasets/<paquete>.md`, en la rama `data/<paquete>`. Cambios en `src/common/` o `config/` se consultan antes con el humano.
5. **Credenciales fuera del repo.** Earthdata en `~/.netrc`; la clave de NASS Quick Stats (`NASS_API_KEY`) y el resto en `.env` (incluido en `.gitignore`). Nunca imprimas tokens ni claves.
6. **Preguntá al humano antes de:** cambiar estados o período, bajar más de 5 GB, o cambiar el esquema de los CSV.
7. **Todo supuesto se escribe** en el data card del paquete (sección "Supuestos").
8. Python 3.11. Librerías base: pandas, numpy, geopandas, rasterio, rasterstats, xarray, requests, pyyaml. Si necesitás otra, agregala a `requirements.txt`.

---

## 2. Parámetros del proyecto (`config/config.yaml`)

Valores por defecto. **Estados confirmados por el equipo el 14/11/2026** (Kansas reemplaza a Indiana).

- **Zona:** Iowa (`IA`, FIPS 19), Illinois (`IL`, 17) y Kansas (`KS`, 20), todos sus condados (≈ 306: 99 + 102 + 105). Iowa e Illinois son Corn Belt núcleo; Kansas suma el trigo de invierno. Condados de demo con historia completa: Story IA `19169`, McLean IL `17113` y Sumner KS `20191`. Escalable a más estados a medida que haya datos.
- **Unidad espacial:** condado (county).
- **Unidad temporal:** año. `anio` es el año calendario de la cosecha. Los archivos mensuales llevan el mes real; las ventanas de cada año se definen en la sección 4.
- **Período:** 2000 a 2025. Rotaciones desde 2008 (desde ese año el Cropland Data Layer cubre todo el país). POWER puede ir desde 1981 para climatologías y SPI.
- **Cultivos:** maíz, soja, trigo de invierno, avena, alfalfa y heno. Cultivos de cobertura (centeno) solo como práctica, desde el Censo Agropecuario.
- **CRS:** guardar vectores en EPSG:4326. Para áreas y rasters del USDA (CDL, gSSURGO), usar EPSG:5070 (Albers CONUS, equivalente).

Leé siempre estos valores de `config/config.yaml`; no los escribas fijos en el código.

---

## 3. Estructura del repo

```
config/
  config.yaml            # estados, período, cultivos
  cultivos.csv           # parámetros por cultivo (la completa research)
data/
  reference/             # condados, años, máscaras, tablas de clases
  raw/<paquete>/         # tal cual se bajó
  interim/<paquete>/
  processed/<paquete>/   # CSV finales
docs/
  datasets/<paquete>.md  # data card de cada paquete
  research/<tema>.md     # respuestas de los agentes de research
src/
  common/                # claves, años, estadísticas zonales, conversiones, validación
  <paquete>/download.py
  <paquete>/process.py
  merge.py
manifest.csv             # una fila por archivo bajado
```

---

## 4. Contrato de los CSV procesados

Todos los paquetes entregan en el mismo formato para poder unirlos sin trabajo extra.

**Formato:** UTF-8, separador `,`, decimal `.`, encabezado en la primera fila.

**Claves (siempre las primeras columnas):**

| Columna | Tipo | Ejemplo |
|---|---|---|
| `fips` | texto, 5 dígitos: 2 del estado + 3 del condado, con ceros a la izquierda | `19169` (Story, Iowa) |
| `anio` | entero, año de la cosecha | `2023` |
| `fecha` | `YYYY-MM-DD` (solo archivos diarios o de 8/16 días) | `2023-07-15` |
| `mes` | `YYYY-MM` (solo archivos mensuales) | `2023-07` |

Excepción: los datos que solo existen por estado (Crop Progress) usan `fips_estado` (2 dígitos) en lugar de `fips`.

**Archivos por paquete, según corresponda:**

- `<paquete>_diario.csv` → `fips, anio, fecha, ...`
- `<paquete>_mensual.csv` → `fips, anio, mes, ...` (acá `anio` = año calendario del mes)
- `<paquete>_anual.csv` → `fips, anio, ...`
- `<paquete>_estatico.csv` → `fips, ...`

**Ventanas para los archivos anuales** (las mismas en todos los paquetes):

- Temporada de crecimiento: abril a septiembre del `anio`.
- Invierno previo: noviembre del `anio − 1` a marzo del `anio`.
- Meses críticos: julio (floración del maíz) y agosto (llenado de la soja).

**Nombres de columna:** `snake_case`, con la unidad al final: `prec_imerg_mm`, `tmax_c`, `ndvi`, `sm_rootzone_m3m3`, `dias_tmax_gt35`.

**Unidades de EE.UU.:** guardá siempre el valor original con su unidad (`rend_bu_ac`, `sup_sembrada_ac`, `produccion_bu`) y, si convertís, hacelo en otra columna con la función de `src/common/`:
- Maíz: 1 bu/ac = 62,77 kg/ha (bushel de 56 lb).
- Soja y trigo: 1 bu/ac = 67,25 kg/ha (bushel de 60 lb).
- Avena: 1 bu/ac = 35,87 kg/ha (bushel de 32 lb).
- 1 acre = 0,4047 ha.

**Faltantes:** celda vacía. Nunca 0, -999 ni -9999. Convertir los valores de relleno de cada fuente a vacío. En NASS, `(D)` (dato oculto para no revelar productores) y `(Z)` (menos de la mitad de la unidad) también van vacíos, con una columna `flag_nass` que guarde el código original.

**Agregación espacial:** media sobre el condado. Si existe la máscara agrícola (`data/reference/mascara_agricola.tif`), usar solo píxeles agrícolas y agregar la columna `frac_pixeles_validos`.

**Ventanas fenológicas por cultivo:** todavía no. Entregar mensual y las ventanas fijas de arriba. Las ventanas por cultivo se arman después, cuando `config/cultivos.csv` esté completo.

---

## 5. Paquete 0 — Base (primero: bloquea a todos)

Responsable: Persona 1. Tiempo estimado: 1 h.

1. Condados del US Census TIGER/Line (o Cartographic Boundary 1:500k) → `data/reference/condados.gpkg`, filtrado a los estados de `config.yaml`.
2. `data/reference/condados.csv` → `fips, estado, condado, lat_centroide, lon_centroide, area_km2`.
3. `data/reference/anios.csv` → `anio, inicio_temporada, fin_temporada, inicio_invierno_previo, fin_invierno_previo`.
4. `src/common/` → `fecha_a_anio()`, `zonal_mean()`, `bu_ac_a_kgha(cultivo)`, `acres_a_ha()`, `validar_csv()`.

---

## 6. Paquetes y reparto

| Paquete | Fuentes | Persona | Por qué juntos |
|---|---|---|---|
| `clima` | NASA POWER, GPM IMERG (PRISM opcional, para validar) | 1 (____) | APIs simples, series diarias |
| `cultivos` | USDA NASS Quick Stats, Cropland Data Layer (CDL), Crop Sequence Boundaries (CSB) | 1 (____) | Target y rotaciones; todo del USDA y con FIPS |
| `vegetacion` | MODIS (MOD13Q1, MOD11A2, MOD16A2, MCD12Q1) | 2 (____) | Todo por AppEEARS |
| `agua` | SMAP L4, GRACE-DA-DM | 2 (____) | SMAP también va por AppEEARS: lanzar todos los pedidos juntos |
| `suelo_terreno` | gSSURGO (USDA NRCS), SRTM / NASADEM | 3 (____) | Estático, se baja una vez por estado, no bloquea a nadie |

Reparto propuesto, ajustable. Persona 3 tiene un solo paquete porque cubre otra área.

### 6.1 `clima` (Persona 1)

**Bajar**
- NASA POWER, comunidad `AG`, API diaria por punto (centroide de cada condado), sin login. Parámetros: `T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, RH2M, WS2M, ALLSKY_SFC_SW_DWN, GWETTOP, GWETROOT, GWETPROF`. Máximo 20 parámetros por consulta. Meteorología desde 1981; radiación desde 1984.
- GPM IMERG Final diario (`GPM_3IMERGDF`, 0,1°), 2000 en adelante, media por condado. Vía GES DISC (login Earthdata) o Google Earth Engine (verificar el ID de la colección).
- Opcional: PRISM diario (4 km, gratuito) para comparar lluvia y temperatura con POWER e IMERG. No es de la NASA: solo para validar.

**Procesar**
- `clima_diario.csv`: variables crudas renombradas + `eto_pm_mm` (FAO-56 Penman-Monteith).
- `clima_mensual.csv`: `prec_imerg_mm`, `prec_power_mm`, `tmax_c`, `tmin_c`, `tmed_c`, `rad_mj_m2`, `eto_pm_mm`, `deficit_mm` (prec − ETo), `dias_tmax_gt30`, `dias_tmax_gt35`, `dias_tmin_le0`, `dias_tmin_le_m2`, `gdd_10_30` (método del maíz: base 10 °C y tope 30 °C, equivalente a 50/86 °F), `gdd_base0`, `dias_lluvia_ge1`, `prec_max1d_mm`, `prec_max5d_mm`, `dias_lluvia_gt50`, `racha_seca_max_dias`, `spi1`, `spi3`, `spi6` (base POWER desde 1981), `anom_tmed_c` (vs 1991–2020), medias de `gwettop`, `gwetroot`, `gwetprof`.
- `clima_anual.csv`: `doy_ultima_helada` (primavera), `doy_primera_helada` (otoño), `periodo_libre_heladas_dias`, `prec_temporada_mm` y `gdd_temporada` (abril–septiembre), `prec_invierno_previo_mm` (noviembre–marzo), `prec_jul_mm`, `tmax_jul_c`, `dias_tmax_gt30_jul`, `prec_ago_mm`, `deficit_temporada_mm`, tendencias por década de lluvia y temperatura.
- Ojo: en la API mensual de POWER la lluvia viene como media en mm/día, no como total.

### 6.2 `cultivos` (Persona 1)

**Bajar**
- **USDA NASS Quick Stats API** (clave gratuita en https://quickstats.nass.usda.gov/api; guardala en `.env` como `NASS_API_KEY`). Máximo 50.000 filas por consulta: pedir por estado y cultivo, y usar `get_counts` antes. Filtros base: `source_desc=SURVEY`, `agg_level_desc=COUNTY`, `state_alpha`, `commodity_desc`, `year__GE=2000`. Variables: rendimiento (bu/acre), superficie sembrada y cosechada (acres) y producción (bu), con `prodn_practice_desc=ALL PRODUCTION PRACTICES`.
- **NASS Crop Progress** (Quick Stats, nivel estado, semanal): % sembrado, emergido, en floración (silking / blooming) y cosechado de maíz y soja. Sirve para fechas reales de siembra por año.
- **Censo Agropecuario** (Quick Stats, `source_desc=CENSUS`, por condado, años 2012, 2017 y 2022): superficie con cultivos de cobertura, labranza cero, drenaje con caños (tile) y riego. Research confirma los `short_desc` exactos.
- **Cropland Data Layer (CDL)**, 30 m, por estado y año, 2008–2025 (CropScape o descarga nacional). Viene en EPSG:5070.
- **Crop Sequence Boundaries (CSB)**: lotes sintéticos con su secuencia de cultivos de 8 años, derivados del CDL. Ventanas de 2008–2015 a 2018–2025. Dominio público.

**Procesar**
- `produccion_anual.csv` (formato largo): `fips, anio, cultivo, sup_sembrada_ac, sup_cosechada_ac, produccion_bu, rend_bu_ac, rend_kgha, sup_sembrada_ha, ratio_cosechada, flag_nass`.
- Las filas "OTHER (COMBINED) COUNTIES" de NASS (`county_code` 998) no son un condado: dejarlas afuera y anotarlo en el data card.
- Los rendimientos de condado de 2024 se publicaron tarde (NASS los suspendió y después los repuso); verificar que estén y si ya salió 2025.
- **No sacar la tendencia del rendimiento acá.** Eso lo decide el equipo de ML, para no filtrar información del futuro al entrenar.
- `rotacion_anual.csv`: por condado y año, % del área agrícola con maíz, soja, trigo, alfalfa y heno, doble cultivo (trigo/soja) y barbecho; y transiciones calculadas por píxel entre el CDL del año anterior y el actual: `pct_maiz_tras_soja`, `pct_maiz_tras_maiz`, `pct_soja_tras_maiz`, `pct_soja_tras_soja`.
- `rotacion_secuencia.csv` (desde CSB): por condado y ventana de 8 años, % del área en maíz-soja alternado, maíz continuo, soja continua, rotaciones con trigo o alfalfa; cultivos por año y diversidad (Shannon).
- `practicas_censo.csv`: `fips, anio_censo, pct_cobertura, pct_labranza_cero, pct_drenaje_tile, pct_riego`.
- `fenologia_estado.csv`: `fips_estado, anio, cultivo, doy_50_sembrado, doy_50_emergido, doy_50_floracion, doy_50_cosechado` (interpolar el día en que se cruza el 50 %).
- `data/reference/mascara_agricola.tif`: píxeles con cultivo agrícola en al menos un año del CDL. Además, `mascara_maiz_<anio>.tif` y `mascara_soja_<anio>.tif`. **Avisar a Persona 2 cuando estén.**
- `data/reference/clases_cdl.csv`: código, nombre y grupo (maíz 1, soja 5, trigo de invierno 24, doble trigo/soja 26, avena 28, alfalfa 36, otro heno 37, barbecho 61, pastizal 176). Verificar contra la tabla oficial.

### 6.3 `vegetacion` (Persona 2)

**Bajar** (AppEEARS, pedido por área con los polígonos de `condados.gpkg`; lanzar los pedidos cuanto antes porque van en cola)
- MOD13Q1: NDVI, EVI, pixel reliability. 250 m, 16 días, 2000 en adelante.
- MOD11A2: LST día y noche. 1 km, 8 días.
- MOD16A2: ET y PET. 500 m, 8 días, 2001 en adelante.
- MCD12Q1: cobertura del suelo anual (máscara provisoria hasta tener la del CDL).

**Procesar**
- Filtrar por calidad de píxel antes de promediar.
- Con las máscaras del CDL, calcular también NDVI solo de píxeles de maíz y solo de soja de ese año. Un píxel de 250 m cuenta si al menos 75 % de su área es de ese cultivo (documentar el umbral).
- `vegetacion_16d.csv`: `fips, anio, fecha, ndvi, evi, ndvi_maiz, ndvi_soja, frac_pixeles_validos`.
- `vegetacion_mensual.csv`: `ndvi`, `evi`, `ndvi_maiz`, `ndvi_soja`, `lst_dia_c`, `lst_noche_c`, `et_mm`, `pet_mm`, `et_pet_ratio`, `ndvi_anom_z` (por mes), `vci`, `tci`, `vhi`.
- `fenologia_anual.csv`: `doy_inicio`, `doy_pico`, `doy_fin`, `ndvi_max`, `duracion_dias`, `ndvi_integral`, `n_ciclos` (detecta doble cultivo), `ndvi_max_maiz`, `ndvi_max_soja`, `dias_ndvi_lt03_invierno` (cobertura en el invierno previo). Suavizar con Savitzky-Golay y documentar los umbrales.

### 6.4 `agua` (Persona 2)

**Bajar**
- SMAP L4 (`SPL4SMGP`): `sm_surface`, `sm_rootzone`. 9 km, cada 3 h, desde 2015-03. Por AppEEARS, junto con los pedidos de MODIS.
- GRACE-DA-DM global (`GRACEDADM_CLSM025GL_7D`, GES DISC): percentiles de agua subterránea, zona radicular y superficie. 0,25°, semanal. Verificar fecha de inicio y nombres de variables. Existe también una versión solo para EE.UU.; research confirma cuál conviene.

**Procesar**
- `agua_diario.csv`: medias diarias de SMAP.
- `agua_mensual.csv`: medias, mínimos, `sm_rootzone_anom_z` (por mes), días sobre umbral de saturación (documentar el umbral). En el Corn Belt el exceso de agua en primavera retrasa la siembra: importa tanto como la sequía.
- `agua_semanal.csv`: percentiles de GRACE-DA-DM.

### 6.5 `suelo_terreno` (Persona 3)

**Bajar**
- gSSURGO por estado (USDA NRCS): file geodatabase con el raster de unidades cartográficas de 10 m (`MUKEY`) y las tablas `Valu1`, `muaggatt`, `component` y `chorizon`. Viene en EPSG:5070. Alternativa: gNATSGO (cobertura completa) o Soil Data Access para consultas tabulares.
- SRTM GL1 o NASADEM, 30 m.
- Alternativa global, solo si gSSURGO falla: SoilGrids v2.0.

**Procesar**
- Los atributos se unen al raster por `MUKEY`. Para cada condado: contar píxeles por `MUKEY` dentro de la máscara agrícola y hacer el promedio ponderado.
- `suelo_terreno_estatico.csv`, una fila por condado: de `Valu1`, agua disponible (`aws0_100`, `aws0_150`, mm), carbono orgánico (`soc0_30`, `soc0_100`, g C/m²), índice de productividad NCCPI (maíz/soja y general), profundidad de raíces; de `muaggatt`, clase de drenaje y grupo hidrológico dominantes, profundidad mínima de la napa; de `chorizon`, arena, limo, arcilla, materia orgánica y pH ponderados 0–30 cm, y clase textural USDA; factor K de RUSLE. Del DEM: elevación media y desvío, pendiente media, % del área con pendiente > 2 %, TWI medio, % del área en el decil superior de TWI.
- Verificar los nombres exactos de las columnas de `Valu1` y `muaggatt` en la documentación del NRCS antes de usarlos.

---

## 7. Definición de terminado (cada paquete)

- [ ] `download.py` y `process.py` corren de punta a punta sin intervención.
- [ ] Una fila en `manifest.csv` por archivo bajado: `paquete, archivo, fuente, producto, version, fecha_descarga, consulta_o_url` (sin la clave de la API).
- [ ] CSV en `data/processed/<paquete>/` que cumplen la sección 4.
- [ ] `validar_csv()` pasa: sin claves duplicadas, todos los `fips` existen en `condados.csv`, valores dentro de rangos físicos (lluvia ≥ 0, NDVI entre −1 y 1, humedad volumétrica entre 0 y 0,6, rendimiento de maíz entre 20 y 300 bu/ac, de soja entre 5 y 100 bu/ac, etc.).
- [ ] `docs/datasets/<paquete>.md` con: diccionario de columnas (nombre, descripción, unidad, fuente, ID del catálogo), cobertura real (desde/hasta), % de faltantes por columna, supuestos y problemas conocidos.

Con los cinco paquetes terminados, `src/merge.py` une:
- todos los `*_anual.csv` y `*_estatico.csv` → `data/processed/tabla_anual.csv` (los archivos por estado se unen por los dos primeros dígitos de `fips`)
- todos los `*_mensual.csv` → `data/processed/tabla_mensual.csv`

---

## 8. Agentes de research

No bajan datasets ni tocan `src/` ni `data/`. Responden preguntas y escriben en `docs/research/<tema>.md`.

**Formato de cada respuesta:**

```
# <Tema>
Pregunta: ...
Respuesta corta: ...
Detalle: ...
Fuentes: [título](URL), consultado AAAA-MM-DD
Confianza: alta / media / baja
Impacto: qué archivo de config o qué paquete cambia
```

Si no encuentran algo, lo dicen. No completan con valores supuestos.

**Cola inicial** (sale de los "Verificar" del catálogo):

1. **Tabla de cultivos para el Corn Belt** → completar `config/cultivos.csv`: fechas habituales de siembra y cosecha por estado (USDA Agricultural Handbook 628 y Crop Progress), ventana de período crítico, Kc inicial/medio/final y duración de etapas (FAO-56), temperatura base y método de GDD, umbral de daño por calor, sensibilidad a helada, profundidad de raíces, fijación de N, rastrojo y C:N, familia botánica, tolerancia a sequía y a anegamiento, valor forrajero. Incluir cultivos de cobertura (centeno, avena, trébol). **Prioridad máxima.**
2. **NASS Quick Stats:** `short_desc` exactos de rendimiento, superficie y producción por cultivo; cómo vienen los condados combinados y los valores `(D)`; si están publicados los datos de condado de 2024 y 2025.
3. **CDL y CSB:** tabla oficial de clases, forma más rápida de bajar por estado (servicio de CropScape), precisión por estado y estructura de los campos del CSB.
4. **Nombres exactos de productos y capas:** SMAP L4, GRACE-DA-DM (global o EE.UU.; variables y fecha de inicio), IDs de IMERG en Earth Engine.
5. **gSSURGO:** nombres de columnas de `Valu1` y `muaggatt` (NCCPI, agua disponible, drenaje), y si conviene el file geodatabase por estado o Soil Data Access.
6. **Censo Agropecuario:** `short_desc` de cultivos de cobertura, labranza cero, drenaje con caños y riego por condado (2012, 2017, 2022).
7. **Precios y márgenes:** precios recibidos de NASS por estado, costos y retornos del USDA ERS, y presupuestos por cultivo de Iowa State (Ag Decision Maker) o Illinois (farmdoc).

---

## 9. Orden sugerido

1. Paquete 0 y credenciales (Earthdata, clave de NASS Quick Stats; Earth Engine si se usa).
2. Lanzar todos los pedidos de AppEEARS (vegetación + agua) y arrancar research 1.
3. Mientras AppEEARS procesa: `clima`, NASS de `cultivos` y `suelo_terreno`.
4. CDL → máscaras agrícola, de maíz y de soja → reprocesar vegetación con las máscaras. CSB al final de `cultivos`.
5. Validación, data cards y `merge.py`.

---

## 10. Front-end (qué va a consumir estos datos)

El pipeline sigue siendo el objetivo de este repo; esta sección resume para qué se usan los CSV, así cada paquete sabe qué no puede faltar.

**Documentos del front, en orden de prioridad** (si chocan, manda el primero): `docs/specs/front-back-connection-spec.md` (spec vigente) → `docs/specs/mockups-secciones.md` (identidad y secciones) → `docs/front-end-plan.md` (arquitectura, contrato JSON, tomas del video) → `docs/design.md`. Índice en `Field Rewind.md`. Al diseñar o programar la interfaz, usar la skill `field-shift-frontend` para los principios generales; sus "4 pantallas" están desactualizadas y valen las de abajo.

**Tareas del front: `TAREAS.md`.** Antes de agarrar una tarea, anotá tu nombre en ella y pusheá ese cambio a `main`; trabajá en la rama `front/<id>-<nombre>`; al terminar, tachá la tarea en el mismo PR, así queda tachada al mergear. No tomes una tarea que ya tiene nombre. Detalle en `TAREAS.md` §"Cómo trabajamos".

**Dependencias del front (aviso para agentes):** el globo de la pantalla 1 usa **deck.gl** (desde el 14/11; antes era d3-geo). Después de cada `git pull`, si cambió `web/package.json`, corré `npm install` dentro de `web/` antes de `npm run dev` o `npm run build`; sin eso la app no levanta (`Failed to resolve import "@deck.gl/core"`). **Apenas termine la instalación, decile a la persona con la que trabajás:** "Instalé deck.gl. Esto lo instalamos solo nosotros, para programar: los jueces no tienen que instalar nada, abren el sitio ya publicado (`npm run build` mete deck.gl dentro de `web/dist/`)."

**Identidad visual (fija):** Verde noche `#0F2A1D` (fondo), Verde campo `#2F7D4F`, Verde brote `#8ED081`, Oro trigo `#E9B949`, Papel `#F6F1E4`, Tierra `#6B4A2F` y Rojo alerta `#E5484D` (solo riesgo y confianza baja). Tipografías: Bricolage Grotesque (títulos) y DM Sans (datos y texto). Interfaz solo en inglés.

**Flujo acordado (4 pantallas):**

1. **Mapa.** Globo 3D enfocado en EE. UU. con Iowa, Illinois y Kansas encendidos y un buscador. Al tocar un estado, la cámara baja y aparecen sus condados pintados según una variable. Se elige el condado.
2. **Historia del condado (rewind).** Línea de tiempo 2015–2025 con play: el condado pintado lote a lote con el CDL de cada año, carrera de barras de superficie por cultivo y un titular por año. Debajo: rendimiento, verdor (NDVI), clima (POWER), agua en el suelo (SMAP) y las rotaciones más comunes.
3. **Próxima campaña.** La rotación actual frente a dos alternativas, con rango de rinde en bu/acre (p10 / mediana / p90), confianza con su motivo y dato faltante. Según las prioridades del productor (menos riesgo, más ingreso, salud del suelo, ahorro de agua), una opción se marca **"Suggested for your priorities"** con dos razones con fuente. Cada opción muestra **condados gemelos**: condados con suelo y clima parecidos que sí sembraron ese cultivo.
4. **Fuentes y límites.**

**Reglas que afectan a los datos:**

- La unidad es el condado. Las cifras son siempre del condado (el mapa del CDL se ve lote a lote, pero no da resultados por lote).
- La app sugiere una opción según las prioridades del productor, siempre con razones con fuente, rango (p10/mediana/p90) y confianza (cambio del 14/11; antes "se compara, no se recomienda").
- No se muestra "porcentaje de éxito": se cuentan años contra lo habitual del condado. Qué es "lo habitual" lo define el equipo de ML (ver 6.2: no sacar la tendencia en el pipeline).
- El rango de rinde por opción sale del modelo de ML. El verdor se presenta como vigor, no como rinde.
- Un dato de prueba se muestra con el sello "Prototype data"; nunca se mezcla con datos reales sin marca.
- Un faltante se muestra escrito como "Missing data". Por eso los faltantes van como celda vacía, nunca 0 (sección 4).
- No se le pregunta maquinaria al productor. El suelo sale de `suelo_terreno_estatico.csv` y el usuario solo lo confirma.
- La app lee JSON estáticos derivados de `data/processed/` y de `data/ml/`. No llama a APIs en vivo.

**Qué archivo usa cada pantalla:**

| Pantalla | Archivos |
|---|---|
| Mapa | `data/reference/condados.gpkg`, `condados.csv`, `vegetacion/fenologia_anual.csv` |
| Historia del condado | `cultivos/rotacion_anual.csv`, `rotacion_secuencia.csv`, `produccion_anual.csv`, `vegetacion/vegetacion_16d.csv`, `clima/clima_anual.csv`, `clima_mensual.csv`, `agua/agua_mensual.csv` |
| Próxima campaña y gemelos | `suelo_terreno/suelo_terreno_estatico.csv`, `clima/clima_anual.csv`, `cultivos/rotacion_anual.csv`, `produccion_anual.csv`, `practicas_censo.csv`, salidas del modelo en `data/ml/` |

**Pendiente para el equipo de datos:** comparar el verdor del maíz según el cultivo anterior (maíz tras soja frente a maíz tras maíz) necesita cruzar el NDVI con las transiciones por píxel del CDL. Ese cálculo no está en el contrato de la sección 4; agregarlo cambia el esquema, así que se consulta antes (regla 6).

**Sin definir:** qué variable pinta el mapa de estado (propuesta: % de maíz de NASS), qué variables definen que dos condados se parezcan, cómo se muestran los gemelos (arcos o botón) y quién genera los JSON del front.
