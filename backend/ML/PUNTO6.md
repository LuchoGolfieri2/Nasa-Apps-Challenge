# Punto 6: qué está sembrado este año, antes del mapa del USDA

Notebook: [`punto6_cultivo_temporada.ipynb`](punto6_cultivo_temporada.ipynb). Corresponde al uso #6 del issue #6 ("Alta: no da para el fin de semana"). No es el modelo A ni el B del `CLAUDE.md`: no predice rinde, clasifica el cultivo de la temporada en curso.

## Qué le muestra al productor

> "As of July 15, this field looks like corn (88% likely), from Sentinel-2 and Landsat passes. That's not the usual switch from last year's crop. USDA's crop map for 2025 comes out months later."

El mapa de cultivos del USDA (Cropland Data Layer, CDL) de un año sale recién a principios del año siguiente. Con esto, desde mediados de julio se sabe qué hay sembrado en el lote, y sobre todo si el productor **cambió el plan** respecto de la rotación de siempre. Todavía no tiene pantalla en el front (ver "Qué falta").

## Cómo funciona, en simple

1. **Etiquetas.** El CDL de cada píxel de 30 m dice qué se sembró cada año. Solo maíz y soja: lo demás son píxeles sueltos.
2. **Lo que ve el satélite.** Cada pasada despejada de Landsat y Sentinel-2 (HLS) se resume por quincena, de abril a septiembre, con cuatro índices de vegetación (NDVI, EVI2, GCVI y NDMI). El maíz reverdece unas semanas antes que la soja: en la segunda quincena de junio, el NDVI mediano es de 0,81 en maíz y de 0,46 en soja.
3. **Clasificador.** Un LightGBM aprende de los años anteriores cómo se ve cada cultivo con las pasadas **hasta una fecha de corte** (del 1 de junio al 15 de agosto).
4. **La vara: la regla de rotación.** "Este año va lo contrario del año pasado" acierta el 95 % de las veces en estos lotes y se sabe antes de sembrar. El satélite solo sirve si le gana.
5. **Híbrido.** Se usa la regla, salvo que el satélite esté seguro (80 % o más) de otra cosa. Así se aprovecha que el año anterior ya es muy buen dato, y el satélite solo avisa cuando el lote no rotó.

## Partes de la notebook

| Paso | Qué hace |
|---|---|
| 0–1 | Librerías y parámetros (años, fechas de corte, umbral del híbrido) |
| 2 | Píxeles interiores, cultivo del CDL y cultivo del año anterior |
| 3 | Pasadas de Landsat y Sentinel-2 resumidas por quincena |
| 4 | Gráfico: el NDVI del maíz y de la soja a lo largo de la temporada |
| 5 | Qué ve el modelo en cada fecha y los cuatro métodos |
| 6 | Validación hacia adelante: para cada año de 2016 a 2025, entrenar con los anteriores y probar en ese año |
| 7 | Exactitud por fecha de corte, por píxel y por lote, con gráfico |
| 8 | Los lote-años en que la regla falla: quién los detecta |
| 9 | Control: un lote que el modelo nunca vio |
| 10 | La temporada de demo (2025), fecha por fecha |
| 11 | Guarda los CSV y `front/cultivo_temporada.json` |

### Resultados (entrega v1.3, 10 lotes, años de prueba 2016–2025)

**Exactitud por lote** (100 lote-años; el lote se clasifica con la probabilidad media de sus píxeles):

| Fecha de corte | Regla de rotación | Solo satélite | Satélite + año anterior | **Híbrido** |
|---|---:|---:|---:|---:|
| 1 jun | 95 % | 65 % | 92 % | 87 % |
| 15 jun | 95 % | 68 % | 95 % | 92 % |
| 1 jul | 95 % | 84 % | 97 % | 94 % |
| **15 jul** | 95 % | 96 % | 97 % | **99 %** |
| 1 ago | 95 % | 98 % | 99 % | 99 % |
| 15 ago | 95 % | 98 % | 99 % | 100 % |

- **Antes del 15 de julio, la regla de rotación es lo mejor.** El maíz y la soja recién se separan en la segunda quincena de junio, y con pocas pasadas el satélite se equivoca seguido.
- **Desde el 15 de julio, el híbrido le gana a la regla:** 99 % contra 95 %.
- **El valor está en los 5 lote-años en que el productor no rotó.** Ahí la regla falla seguro. Al 15 de julio, el híbrido los detecta a los 5. "Satélite + año anterior" en un mismo modelo detecta solo 3, porque se apoya tanto en el año anterior que no ve el cambio. Por eso quedó el híbrido, aunque por píxel "satélite + año anterior" da un poco más (97,8 % contra 96,7 % al 15 de julio).
- **Con un lote que el modelo nunca vio (paso 9), el híbrido sigue en 99 %** al 15 de julio. "Satélite + año anterior" baja a 95 % y empata con la regla.
- **Temporada 2025 (la demo):** al 15 de julio, el híbrido acierta los 10 lotes. Entre ellos está uno de Shelby (IA) que repitió maíz: la regla decía soja y el satélite vio maíz (88 %).

## Datos

**Entra:**

| Archivo | Qué tiene | De quién |
|---|---|---|
| `backend/Datos/entregas/fieldshift_datos_v1.3/lotes/pixeles.csv` | Píxeles de los 10 lotes, `interior`, lat/lon | Pipeline de datos (ya está; no va a Git) |
| `…/lotes/cultivo_px_anual.csv` | Clase del CDL por píxel y año, 2008–2025 | Ídem |
| `…/lotes/vegetacion_px_obs.csv` | Cada pasada despejada de Landsat y Sentinel-2 (HLS) por píxel, con NDVI, EVI2, GCVI y NDMI (410 MB) | Ídem |
| `…/lotes/lotes.csv` y `…/condado/referencia/condados.csv` | Centroide del lote y nombre del condado, para el JSON | Ídem |

**Sale:**

| Archivo | Columnas | Para quién |
|---|---|---|
| `backend/Datos/cultivo_temporada_validacion.csv` | `corte, anio, nivel, metodo, exactitud` | Este documento |
| `backend/Datos/cultivo_temporada_lotes.csv` | `fips, id_lote, anio, corte, y, regla, prob_sat, prob_mix, maiz_hibrido` | Revisión |
| `backend/Datos/cultivo_temporada_pixeles.csv` | `fips, id_lote, px_id, lat, lon, prob_maiz_satelite, maiz_hibrido, maiz_segun_cdl` (2025 al 15 de julio) | Un mapa del lote, si el front lo quiere |
| `backend/Datos/front/cultivo_temporada.json` | Ver abajo | El front |

**`cultivo_temporada.json`** (`version_contrato` 0.2):

- `satellite_from`: desde qué fecha el satélite le gana a la regla (`2025-07-15`). Antes de esa fecha se muestra la regla.
- `accuracy_by_date`: exactitud por lote de cada método en cada fecha, para "Sources & limits".
- `fields[id_lote]`: `fips`, `county`, `centroid` (`[lon, lat]`), `season`, `rule_guess`, `usda_cdl` (la respuesta publicada, solo para comprobar) y `as_of[]`. Cada elemento de `as_of[]` es una fecha con `method` (`rotation_rule` o `satellite`), `crop` (`corn` o `soy`), `prob`, `satellite_prob_corn`, `confidence` (`high`, `medium` o `low`, con su motivo) y `text`.

## Depende de / lo usan

- **Depende de:** la parte `lotes/` de la entrega v1.3. No usa los puntos 2 a 5.
- **Lo usa:** todavía nadie. Ver "Qué falta".

## Cómo se valida

- **Hacia adelante, por año:** para probar un año se entrena solo con los anteriores (desde 2009). Nunca se mezclan píxeles de un mismo año entre entrenamiento y prueba, porque los píxeles de un lote en un año son casi copias entre sí.
- **Años de prueba:** 2016–2025, los que tienen Sentinel-2.
- **Vara a superar:** la regla de rotación, que se conoce antes de sembrar.
- **Métrica:** exactitud por píxel y por lote, en cada fecha de corte, y aparte en los años en que el lote no rotó.
- **Control:** se repite al 15 de julio sacando además el lote de prueba del entrenamiento (paso 9).

## Supuestos

- **Solo maíz y soja.** Las otras clases son 583 píxel-año sueltos (trigo en un lote en 2013, pastizal, alfalfa) y quedan afuera.
- **Pasadas por quincena, con la mediana.** Las quincenas sin pasadas quedan vacías y no se rellenan.
- **Landsat y Sentinel-2 se mezclan.** HLS está armonizado con Landsat, y los índices son cocientes de bandas.
- **Umbral del híbrido: 0,8.** Se eligió mirando los años de prueba entre 0,7, 0,8 y 0,9 (al 15 de julio dan 98 %, 99 % y 97 % por lote). Por eso el 99 % puede estar un poco inflado.
- **Fechas del front:** antes de `satellite_from` se muestra la regla, con confianza `medium`. Desde esa fecha, el satélite cuando está seguro (`high` con 90 % o más, `medium` con 80 a 90 %).

## Probado

- **Corrida con la entrega v1.3,** de punta a punta y sin errores, en unos 3 minutos.
- **Sin datos inventados:** las etiquetas y las imágenes son las de la entrega.

## Qué falta

- [ ] Acordar con el front dónde se muestra: la app trabaja por condado y esto es por lote. Puede ir en la historia del condado ("this season, before USDA's map") o en la pantalla del lote del punto 1.
- [ ] Para hacerlo por condado entero hacen falta las pasadas de Sentinel-2 de todo el condado, no solo de los 10 lotes de demo: pedirlo al pipeline (`docs/ml/pedidos_datos.md`).
- [ ] Confirmar el umbral del híbrido con una temporada nueva (2026) antes de dar el 99 % como firme.
- [ ] Sumar columnas de clasificación (exactitud) a `experimentos.csv`, o acordar un registro aparte. Hoy sus columnas son de regresión de rinde.
- [ ] Probar con más clases (trigo, alfalfa) cuando haya lotes con esos cultivos.

## Limitaciones (para el pitch)

- Son 10 lotes de demostración con rotación maíz-soja: 100 lote-años de prueba, 5 de ellos sin rotar. Con tan pocos casos, cada acierto o error mueve la exactitud un punto.
- Antes del 15 de julio el satélite no le gana a la regla de rotación: la app no sabe "antes de sembrar" más que la historia del lote.
- Solo distingue maíz de soja.
- El CDL es a su vez una clasificación del USDA, con su propio error. Acá se toma como la verdad.
