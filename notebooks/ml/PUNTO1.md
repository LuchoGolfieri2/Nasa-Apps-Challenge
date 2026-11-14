# Punto 1: dividir el lote en sectores

Notebook: [`punto1_sectores.ipynb`](punto1_sectores.ipynb). Corresponde al uso #1 del issue #6.

## Qué le muestra al productor

> "Tu lote tiene tres sectores. En este, el bajo húmedo, el cultivo crece menos que en el resto del lote en los años húmedos y más en los secos."

Con eso el productor ve qué partes del lote se comportan distinto y qué esperar de cada una según el año. Si el lote es parejo, la app se lo dice y no pinta sectores. El modelo **muestra**; la decisión es del productor.

## Cómo funciona, en simple

1. **Vigor de cada año, píxel por píxel.** Para cada píxel de 30 m se mira qué tan verde estuvo el cultivo en julio–agosto (NDVI de Landsat), comparado con el resto del lote ese mismo año.
2. **Se agrupan los píxeles que se comportan parecido a lo largo de los años:** en promedio, en los años secos y en los húmedos. Se usa fuzzy c-means con 3 sectores y después un filtro de mayoría, para que queden sectores que una máquina pueda seguir.
3. **Prueba honesta.** Se arman los sectores sin mirar un año y se ve si explican el vigor de ese año. Si los sectores no se repiten en años nuevos, o la diferencia entre ellos es muy chica, el lote es **parejo**.
4. **Nombre de cada sector, por regla.** Con el terreno y con cómo le va en años secos y húmedos: `loma_seca`, `bajo_humedo`, o si no, `vigor_alto`, `zona_media` y `vigor_bajo`.

## Partes de la notebook

### Preparación (pasos 0 a 4), ya funciona

| Paso | Qué hace |
|---|---|
| 0 | Carga las librerías (pandas, numpy, scikit-learn, matplotlib). Fuzzy c-means y mean shift están programados en la notebook |
| 1 | Busca la entrega `fieldshift_datos_v1.2/lotes` (dentro del repo o en la carpeta de al lado) y lee los píxeles interiores de los 10 lotes |
| 2 | Tabla de los lotes y mapa de la elevación relativa de cada uno |
| 3 | Suelo por píxel, años que sirven, vigor relativo de cada año (`vigor_z`, `vigor_rel_pct`) y años secos, normales y húmedos |
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

Resultado en la validación (años hasta 2024): R² mediano con 3 sectores, es decir, qué parte de las diferencias de vigor de un año nuevo explican los sectores. Más alto es mejor.

| Paisaje | Regla elevación | Regla vigor histórico | FCM terreno + suelo | FCM todo | k-means vigor | BGMM vigor | **FCM vigor** |
|---|---|---|---|---|---|---|---|
| Depresiones (IA) | 0,02 | 0,10 | 0,04 | 0,05 | 0,17 | 0,19 | **0,19** |
| Indiana | 0,02 | 0,15 | 0,08 | 0,15 | 0,18 | 0,17 | **0,19** |
| Llanura de control (IL) | 0,04 | 0,08 | 0,03 | 0,07 | 0,06 | 0,03 | **0,07** |
| Lomas de loess (IA) | 0,11 | 0,14 | 0,10 | 0,14 | 0,26 | 0,18 | **0,27** |
| **Total** | 0,04 | 0,12 | 0,05 | 0,09 | 0,16 | 0,13 | **0,16** |

- **FCM vigor** le gana a la regla del vigor histórico en 8 de los 10 lotes; k-means, en 7.
- **Terreno y suelo** explican poco solos y, sumados al vigor, lo empeoran: NASADEM viene en metros enteros y SSURGO tiene de 3 a 10 unidades por lote. Por eso se usan para nombrar y explicar los sectores, no para armarlos.
- **Cantidad de sectores:** de 2 a 3 el R² sube 0,05 (0,11 → 0,16); de 3 a 4, solo 0,015.
- **El chequeo con KDE** encontró un solo pico en los 10 lotes, aun en los que tienen sectores claros. El vigor cambia de a poco a lo largo de la loma, sin grupos separados.

### Parte B: sectores para la app (pasos 10 a 15), ya funciona

| Paso | Qué hace |
|---|---|
| 10 | Arma los sectores finales con todos los años (2025 incluido) y guarda la pertenencia de cada píxel |
| 11 | Decide si cada lote tiene sectores o es parejo, con lo que midió la validación |
| 12 | Vigor de cada sector en cada año y resumen por tipo de año (mediana, p10, p90) |
| 13 | Nombre de cada sector (regla) y confianza |
| 14 | Mapas de los sectores y de la pertenencia, más la ficha año por año de un lote de ejemplo |
| 15 | Guarda las tres tablas en `data/ml/` |

Resultado: **6 lotes con sectores y 4 parejos**. Los parejos son los dos de la llanura de control, como se esperaba, uno de depresiones y uno de Indiana.

| Lote | Paisaje | R² validación | Diferencia de vigor | Estado |
|---|---|---|---|---|
| 19079_191825002094751 | depresiones | 0,29 | 9,5 % | con sectores: vigor alto, bajo húmedo, vigor bajo |
| 19079_191825001174693 | depresiones | 0,20 | 5,7 % | con sectores |
| 19079_191825000600003 | depresiones | 0,09 | 1,1 % | parejo |
| 18157_181825000203707 | indiana | 0,23 | 4,7 % | con sectores: incluye una loma seca |
| 18157_181825001116483 | indiana | 0,09 | 2,3 % | parejo |
| 17019_171825005060041 | llanura_control | 0,07 | 1,1 % | parejo |
| 17019_171825005511042 | llanura_control | 0,08 | 1,0 % | parejo |
| 19047_191825002083543 | lomas_loess | 0,27 | 7,4 % | con sectores: incluye una loma seca |
| 19165_191825001638480 | lomas_loess | 0,13 | 3,5 % | con sectores |
| 19165_191825002368896 | lomas_loess | 0,37 | 2,2 % | con sectores: incluye una loma seca |

## Datos

**Entra:** la entrega `fieldshift_datos_v1.2/lotes` del pipeline (ResearchAgent). Pesa 180 MB y **no está en Git**. La notebook la busca en `data/fieldshift_datos_v1.2/lotes/` dentro del repo o en la carpeta `data/` de al lado. Si la copiás al repo, no la subas.

| Archivo | Qué tiene | De quién |
|---|---|---|
| `lotes.csv`, `pixeles.csv` | Los 10 lotes y sus píxeles de 30 m (`id_lote`, `px_id`, `interior`) | Pipeline (ya está) |
| `vegetacion_px_anual.csv` | NDVI medio de julio–agosto y cantidad de imágenes, por píxel y año | Pipeline (ya está) |
| `lotes_anual.csv` | Cultivo del lote cada año y si estaba partido | Pipeline (ya está) |
| `clima_lote_anual.csv` | Déficit de agua de la temporada, para separar años secos y húmedos | Pipeline (ya está) |
| `terreno_px.csv` | Elevación, pendiente, TWI, TPI y profundidad de depresión (NASADEM) | Pipeline (ya está) |
| `suelo_px.csv`, `suelo_mukey.csv` | Unidades de SSURGO por píxel y sus atributos | Pipeline (ya está) |

**Sale** (CSV en `data/ml/`):

- `punto1_sectores.csv`: `fips, id_lote, px_id, estado_sectores, sector_id, tipo, pertenencia`. En los lotes parejos, `sector_id`, `tipo` y `pertenencia` van vacíos.
- `punto1_sectores_resumen.csv`: una fila por sector, con superficie, % del lote, confianza, rasgos de terreno y suelo, y el resultado de la validación del lote. Los lotes parejos tienen una sola fila, sin sector.
- `punto1_sectores_anual.csv`: `fips, id_lote, sector_id, anio, cultivo, clase_anio, vigor_rel_pct, n_px_con_dato, n_obs_jul_ago`.

Estas tablas todavía no tienen el formato del contrato del front (`INFO.md`, sección 4: `sectores/<id_lote>.geojson` y `.json`). Ese paso falta.

## Depende de / lo usan

- **Depende de:** la entrega de lotes v1.2. No depende del modelo del punto 2.
- **Lo usan:** el front, en la pantalla "Your field by zones".
- **Relación con el punto 2:** usan claves y condados distintos. El punto 2 trabaja con `point_id` en Story, McLean y Sumner; los lotes, con `id_lote` y `px_id` en Hamilton, Crawford, Shelby, Champaign y Tippecanoe. Falta definir cómo se cruzan.

## Cómo se valida

- **Dejar un año afuera:** se arman los sectores sin ese año y se mide el R² del vigor de ese año. Nunca se mezclan píxeles al azar: los vecinos se parecen y el resultado saldría inflado.
- **2025 queda guardado** para el examen final (`MIRAR_TEST = False`).
- **Reglas simples a superar:** tercios por elevación y tercios por vigor histórico.
- **Misma cantidad de sectores** para todos los métodos: más sectores siempre explican un poco más.
- **Por paisaje**, no solo el total.
- **Chequeos de sentido común:**
  - los lotes planos de control salen parejos;
  - la loma seca cae en las partes altas del mapa de elevación y el bajo húmedo en las bajas;
  - al bajo húmedo le va mejor que al resto del lote en los años secos y peor en los húmedos.
- Los chequeos agronómicos de la sección 6 de `ML_NOTAS_CDL.md` son sobre rotaciones y no aplican a este punto.

## Supuestos

- **Años:** solo desde 2008 (antes no hay cultivo por lote), con maíz o soja, el lote sin partir y al menos el 50 % de los píxeles con una imagen despejada de julio–agosto. Quedan de 11 a 18 años por lote.
- **Vigor:** NDVI medio de julio–agosto, comparado con el resto del lote ese mismo año. Maíz y soja van juntos.
- **Años secos, normales y húmedos:** tercios del déficit de agua de la temporada (POWER, abril–septiembre) entre los años de cada lote.
- **Método:** fuzzy c-means con `m = 2` sobre tres variables: vigor medio, vigor en años secos y vigor en años húmedos. 3 sectores. Filtro de mayoría de 3 × 3, una pasada.
- **Lote parejo:** R² de validación menor a 0,10 o diferencia de vigor entre el mejor y el peor sector menor a 2 %.
- **Nombres:**
  - `loma_seca`: al menos 0,5 m más alto que la mitad del lote y peor en los años secos (0,25 de puntaje z o más);
  - `bajo_humedo`: lo mismo, al revés.
- **Confianza:**
  - `alta`: el sector queda del mismo lado del promedio, dentro de cada tipo de año, en al menos el 80 % de los años, y el lote tiene R² de al menos 0,20;
  - `media`: al menos el 65 % de los años;
  - `baja`: el resto.
- Todos los umbrales se eligieron mirando estos 10 lotes.

## Qué falta

- [ ] Revisar los sectores con alguien que conozca la zona, junto con una imagen satelital. Los sectores chicos (2–6 % del lote) pueden ser vías de agua o bajos que se anegan.
- [ ] Sumar los tipos nuevos `vigor_alto` y `vigor_bajo` al contrato del front (`INFO.md`) y a `textos.json`.
- [ ] Generar `sectores/<id_lote>.geojson` y `sectores/<id_lote>.json` para el front.
- [ ] Repetir cuando lleguen más pasadas de Landsat y HLS: 2009 y 2024 tienen muchos lotes sin imagen de julio–agosto.
- [ ] Probar el terreno de 3DEP lidar cuando llegue.
- [ ] Probar maíz y soja por separado.
- [ ] Revisar los umbrales con más lotes.
- [ ] Prender `MIRAR_TEST` una sola vez, al final.
- [ ] Escribir `docs/ml/model_card_punto1.md`.
- [ ] Definir con el punto 2 cómo se cruzan sus puntos con estos lotes.

## Limitaciones (para el pitch)

- **El vigor no es rinde.** Es el verdor del cultivo visto por satélite.
- **Los sectores explican alrededor del 16 % de las diferencias de vigor de un año nuevo.** El resto cambia de un año a otro. Por eso se muestran rangos por tipo de año, no un número fijo.
- **Son 10 lotes de demostración** y los umbrales se eligieron mirándolos.
- **NASADEM viene en metros enteros:** lomas y bajos de menos de 1 m casi no se ven, y en los lotes planos los nombres por terreno pueden fallar.
- **La consistencia del sector** se mide con los mismos años con que se armó, así que es optimista. La medida honesta es el R² de la validación.
- **El examen 2025 no es del todo ciego:** en la exploración inicial se miraron todos los años.
- **Es una asociación, no una causa:** "a este sector le suele ir peor en los años secos", nunca "porque es una loma".
