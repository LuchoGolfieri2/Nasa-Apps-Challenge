# Punto 1: dividir el lote en sectores

Notebook: [`punto1_sectores.ipynb`](punto1_sectores.ipynb). Corresponde al uso #1 del issue #6.

## Qué le muestra al productor

> "Tu lote tiene tres sectores. En este, el bajo húmedo, el cultivo crece menos que en el resto del lote en los años húmedos y más en los secos."

Con eso el productor ve qué partes del lote se comportan distinto y qué esperar de cada una según el año. Si el lote es parejo, la app se lo dice y no pinta sectores. El modelo **muestra**; la decisión es del productor.

## Cómo funciona, en simple

1. **Vigor de cada año, píxel por píxel.** Para cada píxel de 30 m se mira qué tan verde estuvo el cultivo en julio–agosto (NDVI de Landsat), comparado con el resto del lote ese mismo año. Si ese año el píxel tenía otro cultivo que el lote (según el CDL), no cuenta.
2. **Se agrupan los píxeles que se comportan parecido a lo largo de los años:** en promedio, en los años secos y en los húmedos. Se usa fuzzy c-means con 3 sectores y después un filtro de mayoría, para que queden sectores que una máquina pueda seguir.
3. **Prueba honesta.** Se arman los sectores sin mirar un año y se ve si explican el vigor de ese año. Según eso, el lote tiene **sectores**, **sectores débiles** o es **parejo**.
4. **Nombre de cada sector, por regla.** Con el terreno (3DEP) y con cómo le va en años secos y húmedos: `loma_seca`, `bajo_humedo`, o si no, `vigor_alto`, `zona_media` y `vigor_bajo`.
5. **Confianza, también fuera de muestra:** si lo que dice la ficha del sector se cumplió en años que no se usaron para armarlo.

## Partes de la notebook

### Preparación (pasos 0 a 4), ya funciona

| Paso | Qué hace |
|---|---|
| 0 | Carga las librerías (pandas, numpy, scikit-learn, matplotlib). Fuzzy c-means y mean shift están programados en la notebook |
| 1 | Busca la entrega `fieldshift_datos_v1.3/lotes` (dentro del repo o en la carpeta de al lado) y lee los píxeles interiores de los 10 lotes |
| 2 | Tabla de los lotes y mapa de la elevación relativa de cada uno (3DEP) |
| 3 | Suelo por píxel, años que sirven, píxel-años con otro cultivo (se sacan), vigor relativo de cada año (`vigor_z`, `vigor_rel_pct`) y años secos, normales y húmedos |
| 4 | Explica la validación: dejar un año afuera. Reserva 2025 para el examen final |

### Parte A: elegir el método (pasos 5 a 9), ya funciona

Compara siete formas de armar los sectores, con la misma cantidad de sectores para todas, dejando un año afuera cada vez.

| Paso | Qué hace |
|---|---|
| 5 | Dos reglas simples a superar: tercios por elevación y tercios por vigor histórico |
| 6 | Los métodos: k-means, fuzzy c-means (con tres juegos de variables) y mezcla gaussiana bayesiana (BGMM, ajustada con 1 de cada 4 píxeles) |
| 7 | Validación de todos los métodos con 2, 3 y 4 sectores. Elige `fcm_vigor` y 3 sectores |
| 8 | Prueba el chequeo previo con KDE (mean shift) y muestra por qué no sirve como filtro |
| 9 | Examen final con 2025. Está apagado: se activa con `MIRAR_TEST = True` una sola vez, al final |

Resultado en la validación (entrega v1.3, años hasta 2024): R² mediano con 3 sectores, es decir, qué parte de las diferencias de vigor de un año nuevo explican los sectores. Más alto es mejor.

| Paisaje | Regla elevación | Regla vigor histórico | FCM terreno + suelo | FCM todo | k-means vigor | BGMM vigor | **FCM vigor** |
|---|---|---|---|---|---|---|---|
| Depresiones (IA) | 0,07 | 0,13 | 0,05 | 0,11 | 0,17 | 0,20 | **0,19** |
| Indiana | 0,11 | 0,15 | 0,11 | 0,14 | 0,18 | 0,15 | **0,18** |
| Llanura de control (IL) | 0,05 | 0,06 | 0,08 | 0,07 | 0,07 | 0,03 | **0,07** |
| Lomas de loess (IA) | 0,13 | 0,15 | 0,09 | 0,13 | 0,21 | 0,14 | **0,18** |
| **Total** | 0,10 | 0,13 | 0,09 | 0,12 | 0,14 | 0,11 | **0,145** |

- **FCM vigor** le gana a la regla del vigor histórico en 7 de los 10 lotes; k-means, en 6. La ventaja es chica (0,145 contra 0,13).
- **Sacar los píxel-años con otro cultivo bajó el R²** de 0,16 (entrega v1.2) a 0,145. Parte de lo que "explicaban" los sectores era una franja con otro cultivo que se repetía año tras año, sobre todo en el lote de Crawford (19047). El número nuevo es el honesto.
- **Con el terreno de 3DEP, la elevación explica más que con NASADEM** (la regla de la elevación pasa de 0,04 a 0,10), pero sigue abajo del vigor, y sumada al vigor lo empeora. Terreno y suelo se usan para nombrar y explicar los sectores, no para armarlos.
- **Cantidad de sectores:** de 2 a 3 el R² sube 0,05 (0,09 → 0,145) y de 3 a 4, 0,04 (→ 0,18). Seguimos con 3 por ahora (ver "Qué falta").
- **El chequeo con KDE** encontró un solo pico en los 10 lotes, aun en los que tienen sectores claros. El vigor cambia de a poco a lo largo de la loma, sin grupos separados.

**Probado y descartado** (pruebas aparte del 14/11/2026, no están en la notebook):

| Qué se probó | Resultado | Por qué no se usa |
|---|---|---|
| Otras semillas de fuzzy c-means | ARI de 0,98 o más en los 10 lotes | Ya es estable: no hace falta nada |
| Maíz y soja por separado (sectores armados solo con años del mismo cultivo) | R² 0,14 contra 0,14 en maíz; 0,17 contra 0,20 en soja | Perder años pesa más que separar por cultivo |
| Sumar los años 2000–2007 (sin cultivo conocido) | R² 0,153 contra 0,162; mejora en 4 de 10 lotes | No mejora y no se sabe qué cultivo había |
| Llenar con Sentinel-2 los lote-años sin Landsat | Sumaría 13 lote-años, pero el vigor relativo de los dos sensores coincide poco (correlación mediana 0,53) | Mezclaría dos señales distintas |

### Parte B: sectores para la app (pasos 10 a 15), ya funciona

| Paso | Qué hace |
|---|---|
| 10 | Arma los sectores finales con todos los años (2025 incluido) y guarda la pertenencia de cada píxel |
| 11 | Decide si cada lote tiene sectores, sectores débiles o es parejo, con lo que midió la validación |
| 12 | Vigor de cada sector en cada año, resumen por tipo de año (mediana, p10, p90) y consistencia fuera de muestra |
| 13 | Nombre de cada sector (regla), drenaje con caños, % de otro cultivo y confianza |
| 14 | Mapas de los sectores y de la pertenencia, más la ficha año por año de un lote de ejemplo |
| 15 | Guarda las tres tablas en `data/ml/` |

Resultado: **5 lotes con sectores, 2 con sectores débiles y 3 parejos**. Los parejos son los dos de la llanura de control, como se esperaba, y uno de depresiones.

| Lote | Paisaje | R² validación | Diferencia de vigor | Estado | Sectores (confianza) |
|---|---|---|---|---|---|
| 19079_191825002094751 | depresiones | 0,28 | 9,5 % | con sectores | vigor alto 47 %, bajo húmedo 36 %, loma seca 17 % (todos alta) |
| 19079_191825001174693 | depresiones | 0,18 | 5,6 % | con sectores | vigor alto 60 %, zona media 38 %, bajo húmedo 2 % (todos media) |
| 19079_191825000600003 | depresiones | 0,09 | 1,1 % | parejo | — |
| 18157_181825000203707 | indiana | 0,23 | 4,7 % | con sectores | vigor alto 72 %, zona media 22 %, loma seca 6 % (todos alta) |
| 18157_181825001116483 | indiana | 0,097 | 2,1 % | sectores débiles | vigor alto 60 %, zona media 32 %, bajo húmedo 8 % (todos baja) |
| 17019_171825005060041 | llanura_control | 0,07 | 1,2 % | parejo | — |
| 17019_171825005511042 | llanura_control | 0,07 | 1,0 % | parejo | — |
| 19047_191825002083543 | lomas_loess | 0,09 | 3,5 % | sectores débiles | vigor alto 76 %, loma seca 21 %, vigor bajo 2 % con 72 % de otro cultivo (todos baja) |
| 19165_191825001638480 | lomas_loess | 0,12 | 3,5 % | con sectores | vigor alto 37 % y zona media 52 % (baja), vigor bajo 11 % (media) |
| 19165_191825002368896 | lomas_loess | 0,38 | 2,2 % | con sectores | vigor alto 49 % (alta), zona media 29 % (media), vigor bajo 22 % (alta) |

**Qué cambió respecto de la entrega v1.2** (commit `ef65099`):

- **19047 pasó de "con sectores" a "sectores débiles"** (R² de 0,27 a 0,09): lo que separaba sus sectores era sobre todo una franja con otro cultivo (soja, pasto, alfalfa) en la parte más alta.
- **18157_…116483 pasó de "parejo" a "sectores débiles"**: estaba justo debajo del corte (R² 0,097).
- **Con la elevación de 3DEP cambiaron dos nombres:** en 19079_…174693, el sector chico pasa de `vigor_bajo` a `bajo_humedo` (−1,2 m según 3DEP, contra −0,2 m con NASADEM); en 19079_…094751, el sector 3 pasa de `vigor_bajo` a `loma_seca` (+0,8 m, el TWI más bajo del lote y sin caños).
- **En 19165_…368896, la "loma seca" pasó a "zona media"**: sacar unos 8 píxel-años con otro cultivo cambió bastante la partición (ARI 0,60 contra la anterior). Ese nombre no era robusto.
- **La confianza bajó** donde la consistencia fuera de muestra es menor que la que se medía antes: 19079_…174693 pasa de alta a media y 19165_…638480 de media a baja en dos sectores.

## Datos

**Entra:** la entrega `fieldshift_datos_v1.3/lotes` del pipeline (ResearchAgent). Pesa unos 450 MB (casi todo es `vegetacion_px_obs.csv`, que no se usa) y **no está en Git**. La notebook la busca en `data/fieldshift_datos_v1.3/lotes/` dentro del repo o en la carpeta `data/` de al lado. Si la copiás al repo, no la subas.

| Archivo | Qué tiene | De quién |
|---|---|---|
| `lotes.csv`, `pixeles.csv` | Los 10 lotes y sus píxeles de 30 m (`id_lote`, `px_id`, `interior`) | Pipeline (ya está) |
| `vegetacion_px_anual.csv` | NDVI medio de julio–agosto y cantidad de imágenes, por píxel y año | Pipeline (ya está) |
| `cultivo_px_anual.csv` | Cultivo de cada píxel cada año (CDL), para sacar los píxel-años con otro cultivo | Pipeline (ya está) |
| `lotes_anual.csv` | Cultivo del lote cada año y si estaba partido | Pipeline (ya está) |
| `clima_lote_anual.csv` | Déficit de agua de la temporada, para separar años secos y húmedos | Pipeline (ya está) |
| `terreno_px.csv` | Elevación, pendiente, TWI, TPI y profundidad de depresión. Se usan las columnas `_3dep` (USGS 3DEP, DEM de 10 m) | Pipeline (ya está) |
| `drenaje_px.csv` | `drenado_canos`: si el píxel tiene drenaje con caños según el mapa AgTile-US (modelado, no relevado) | Pipeline (ya está) |
| `suelo_px.csv`, `suelo_mukey.csv` | Unidades de SSURGO por píxel y sus atributos | Pipeline (ya está) |

**Sale** (CSV en `data/ml/`):

- `punto1_sectores.csv`: `fips, id_lote, px_id, estado_sectores, sector_id, tipo, pertenencia`. En los lotes parejos, `sector_id`, `tipo` y `pertenencia` van vacíos.
- `punto1_sectores_resumen.csv`: una fila por sector, con superficie, % del lote, confianza, consistencia fuera de muestra, rasgos de terreno (3DEP) y suelo, `pct_drenaje_canos`, `pct_otro_cultivo` y el resultado de la validación del lote. Los lotes parejos tienen una sola fila, sin sector.
- `punto1_sectores_anual.csv`: `fips, id_lote, sector_id, anio, cultivo, clase_anio, vigor_rel_pct, n_px_con_dato, n_obs_jul_ago`.

`estado_sectores` puede valer `con_sectores`, `sectores_debiles` o `lote_parejo`. **`sectores_debiles` no está en el contrato del front** (`INFO.md`, donde `estado_sectores` es un campo firme): hay que acordarlo con el front antes de generar los archivos para la app.

Estas tablas todavía no tienen el formato del contrato del front (`INFO.md`, sección 4: `sectores/<id_lote>.geojson` y `.json`). Ese paso falta.

## Depende de / lo usan

- **Depende de:** la entrega de lotes v1.3. No depende del modelo del punto 2.
- **Lo usan:** el front, en la pantalla "Your field by zones".
- **Relación con el punto 2:** usan claves y condados distintos. El punto 2 trabaja con `point_id` en Story, McLean y Sumner; los lotes, con `id_lote` y `px_id` en Hamilton, Crawford, Shelby, Champaign y Tippecanoe. Falta definir cómo se cruzan.

## Cómo se valida

- **Dejar un año afuera:** se arman los sectores sin ese año y se mide el R² del vigor de ese año. Nunca se mezclan píxeles al azar: los vecinos se parecen y el resultado saldría inflado.
- **2025 queda guardado** para el examen final (`MIRAR_TEST = False`).
- **Reglas simples a superar:** tercios por elevación y tercios por vigor histórico.
- **Misma cantidad de sectores** para todos los métodos: más sectores siempre explican un poco más.
- **Por paisaje**, no solo el total.
- **Consistencia fuera de muestra:** para cada año se arman los sectores sin ese año y se mira si cada sector quedó del lado del promedio que decían los otros años del mismo tipo. Medida con los mismos años salía optimista.
- **Chequeos de sentido común:**
  - los lotes planos de control salen parejos;
  - la loma seca cae en las partes altas del mapa de elevación y el bajo húmedo en las bajas;
  - los bajos húmedos tienen más drenaje con caños (62–93 %) que las lomas secas (0–41 %);
  - al bajo húmedo le va mejor que al resto del lote en los años secos y peor en los húmedos.
- Los chequeos agronómicos de la sección 6 de `ML_NOTAS_CDL.md` son sobre rotaciones y no aplican a este punto.

## Supuestos

- **Años:** solo desde 2008 (antes no hay cultivo por lote), con maíz o soja, el lote sin partir y al menos el 50 % de los píxeles con una imagen despejada de julio–agosto. Quedan de 11 a 18 años por lote.
- **Otro cultivo:** un píxel-año con otro cultivo que el lote según el CDL no entra en el vigor. Si el CDL no tiene dato, se deja.
- **Vigor:** NDVI medio de julio–agosto, comparado con el resto del lote ese mismo año. Maíz y soja van juntos.
- **Años secos, normales y húmedos:** tercios del déficit de agua de la temporada (POWER, abril–septiembre) entre los años de cada lote.
- **Método:** fuzzy c-means con `m = 2` sobre tres variables: vigor medio, vigor en años secos y vigor en años húmedos. 3 sectores. Filtro de mayoría de 3 × 3, una pasada.
- **Estado del lote:**
  - `con_sectores`: R² de validación de al menos 0,10 y diferencia de vigor entre el mejor y el peor sector de al menos 2 %;
  - `sectores_debiles`: no llega a eso, pero tiene R² de al menos 0,05 y diferencia de al menos 1,5 %;
  - `lote_parejo`: el resto.
- **Nombres:**
  - `loma_seca`: al menos 0,5 m más alto que la mitad del lote (3DEP) y peor en los años secos (0,25 de puntaje z o más);
  - `bajo_humedo`: lo mismo, al revés.
- **Confianza** (con la consistencia fuera de muestra):
  - `alta`: el sector acertó en al menos el 80 % de los años, y el lote tiene R² de al menos 0,20;
  - `media`: al menos el 65 % de los años;
  - `baja`: el resto, y siempre si el lote tiene sectores débiles o si más del 25 % de los píxel-años del sector tenían otro cultivo.
- **Drenaje con caños:** solo se muestra como rasgo del sector. No entra en el nombre ni en los sectores.
- Todos los umbrales se eligieron mirando estos 10 lotes.

## Qué falta

- [ ] Revisar los sectores con alguien que conozca la zona, junto con una imagen satelital. Los sectores chicos (2–8 % del lote) pueden ser vías de agua o bajos que se anegan.
- [ ] Acordar con el front cómo se muestra `sectores_debiles`: `estado_sectores` es un campo firme del contrato (`INFO.md`), así que sumarlo sube la versión a 1.0. Sumar también los tipos nuevos `vigor_alto` y `vigor_bajo` y `textos.json`.
- [ ] Generar `sectores/<id_lote>.geojson` y `sectores/<id_lote>.json` para el front.
- [ ] Repetir cuando lleguen más pasadas de Landsat: 26 de los 260 lote-años no tienen ninguna de julio–agosto (7 en 2009, 6 en 2024).
- [ ] Probar el lidar de 1 m de 3DEP si llega (hoy se usa el DEM de 10 m).
- [ ] Revisar si conviene pasar a 4 sectores: con la v1.3, de 3 a 4 el R² sube 0,04.
- [ ] Mirar la estabilidad de los sectores ante cambios chicos en los datos (ver 19165_…368896).
- [ ] Revisar los umbrales con más lotes.
- [ ] Prender `MIRAR_TEST` una sola vez, al final.
- [ ] Escribir `docs/ml/model_card_punto1.md`.
- [ ] Definir con el punto 2 cómo se cruzan sus puntos con estos lotes.

## Limitaciones (para el pitch)

- **El vigor no es rinde.** Es el verdor del cultivo visto por satélite.
- **Los sectores explican alrededor del 15 % de las diferencias de vigor de un año nuevo.** El resto cambia de un año a otro. Por eso se muestran rangos por tipo de año, no un número fijo.
- **Son 10 lotes de demostración** y los umbrales se eligieron mirándolos.
- **3DEP es un DEM de 10 m, no el lidar de 1 m:** el microrrelieve más fino no se ve.
- **El drenaje con caños es un mapa modelado** (AgTile-US, a partir de suelo, pendiente y uso), no un relevamiento de cada lote.
- **En algunos lotes los sectores dependen de detalles de los datos:** en 19165_…368896, sacar 8 píxel-años cambió la partición y un nombre.
- **El examen 2025 no es del todo ciego:** en la exploración inicial se miraron todos los años.
- **Es una asociación, no una causa:** "a este sector le suele ir peor en los años secos", nunca "porque es una loma".
