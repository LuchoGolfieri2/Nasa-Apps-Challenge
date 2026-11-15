# Punto 5: condados gemelos

Notebook: [`punto5_vecinos.ipynb`](punto5_vecinos.ipynb). Corresponde al uso #5 del issue #6. No entrena un modelo ni es el modelo A o B del `CLAUDE.md`: es una búsqueda de vecinos (kNN) por suelo y clima.

## Qué le muestra al productor

> "Counties like yours that grow winter wheat: 5. Their winter wheat yield: 77–104 bu/ac (typical 90). Similar soil and weather doesn't guarantee the same result."

En la pantalla "Próxima campaña" (paso 4 de `docs/front-end-definido.md`), al lado de cada opción, de 3 a 5 condados con suelo y clima parecidos al suyo que **ya hicieron** esa opción, en un mapa con arcos. Le sirve para ver qué pasó de verdad en lugares como el suyo cuando prueba algo que en su condado casi no se hace.

## Cómo funciona, en simple

1. **Un perfil por condado.** 9 números: 5 de suelo (SSURGO) y 4 de clima típico (mediana 2009–2023). El calor viene de NASA POWER y la lluvia de GPM IMERG.
2. **Misma escala.** Cada número se pasa a "cuántos desvíos se aparta de lo típico", y suelo y clima pesan lo mismo.
3. **Distancia.** Para cada par de condados, qué tan distintos son. Solo cuentan los pares que están entre el 10 % más parecido de la región.
4. **Gemelos de cada opción.** De los parecidos, del más al menos parecido, los primeros 5 que hicieron la opción: repetir maíz, rotarlo, sembrar trigo, etc.
5. **Rango.** Con todos los años de esos gemelos (rinde llevado a la tecnología de 2025): p10, mediana y p90. Solo con 3 gemelos o más.
6. **Controles.** Que los gemelos le ganen a la alternativa simple, "los condados más cercanos en el mapa" (pasos 9 y 19), y que cuenten lo mismo que el modelo del punto 2 (paso 16).

## Partes de la notebook

### Parte 1: encontrar los parecidos (pasos 0 a 10), funciona

| Paso | Qué hace |
|---|---|
| 0–1 | Librerías y parámetros (`LLUVIA`, variables, pesos, umbral) |
| 2 | Carga de la entrega (`FUENTE_TABLA = "entrega"`) el suelo, el clima, el rinde y la rotación de los 9 estados, y nombres, centroides, lluvia IMERG y área sembrada por cultivo. Con `FUENTE_TABLA = "punto2"` usa `tabla_modelado.csv` |
| 3–5 | Perfil de cada condado, escala común y distancias |
| 6–8 | Los 15 más parecidos de cada uno, en qué se parecen y ejemplos |
| 9 | Primer control: parecidos contra los 5 más cercanos en el mapa y contra el azar |
| 10 | Guarda `gemelos_vecinos.csv` |

### Parte 2: los gemelos de cada opción (pasos 11 a 20), funciona

| Paso | Qué hace |
|---|---|
| 11 | Parámetros y cruce de ids con el front |
| 12 | Lleva cada rinde a la tecnología de 2025 (tendencia por estado) |
| 13–14 | Qué condados hacen cada opción y quiénes son los gemelos de cada una |
| 15 | Rango p10 / mediana / p90 y confianza |
| 16 | Chequeo contra el modelo del punto 2 |
| 17 | Ejemplo: Story (IA) |
| 18 | Trigo de invierno y avena |
| 19 | Segundo control: gemelos contra los vecinos del mapa **que hacen la opción** |
| 20 | Guarda los CSV y `front/gemelos.json` |

### Resultados (entrega `todo_20261115`: 9 estados, 790 condados con maíz y soja, años 2009–2023)

Los 9 estados son Iowa, Illinois, Indiana, Minnesota, Missouri, Nebraska, Ohio, Dakota del Sur y Wisconsin. Kansas y Dakota del Norte todavía no están en la entrega.

**Control del paso 9, todos los condados.** Diferencia media entre el rinde típico de maíz de un condado y el de sus 5 elegidos (bu/ac, más chico es mejor), en 779 condados con al menos 3 parecidos:

| Cómo se eligen los 5 | 9 estados (IMERG) | Antes: IA, IL e IN (IMERG) |
|---|---:|---:|
| Parecidos por suelo y clima | 9,5 | 6,2 |
| Los 5 más cercanos en el mapa | **8,1** | 6,2 |
| Al azar, mismo estado | 17,3 | 13,3 |
| Al azar, toda la región | 23,0 | 14,2 |

Con 9 estados, cuando compiten todos los condados, **el mapa le gana a los parecidos** (8,1 contra 9,5). En una región tan distinta (de Ohio a Dakota del Sur), estar cerca ya dice mucho del rinde: tecnología, riego y prácticas que no entran al parecido. Igual los parecidos le ganan por lejos al azar. La lluvia sigue siendo IMERG: con POWER, 226 de los 790 condados tienen exactamente la misma lluvia que otro condado todos los años; con IMERG, ninguno.

**Control del paso 19, la prueba que importa.** Solo condados que **no** hacen la opción, comparando sus gemelos con los condados más cercanos en el mapa que sí la hacen:

| Opción (id del front) | Condados | Gemelos | Mapa | km a los gemelos | km en el mapa |
|---|---:|---:|---:|---:|---:|
| `corn_after_soy` | 417 | 14,9 | 21,0 | 184 | 106 |
| `corn_after_corn` | 473 | 16,4 | 18,7 | 215 | 130 |
| `soy_after_corn` | 375 | 17,3 | 21,7 | 233 | 129 |
| `soy_after_soy` | 311 | 19,2 | 27,3 | 250 | 115 |
| `wheat` | 282 | 13,5 | 16,6 | 152 | 93 |
| `oats` | 422 | 12,3 | 13,3 | 202 | 144 |

Los gemelos ganan en las 6 opciones, y por más que con 3 estados. Es lo que necesita la app: los gemelos están más lejos que los vecinos del mapa (150 a 250 km, contra 95 a 145) y aun así se parecen más.

**Más condados que siembran trigo y avena.** Trigo de invierno: 446 condados (antes 162), de Illinois, Indiana, Missouri, Ohio, Nebraska, Wisconsin y Dakota del Sur. Avena: 251 (antes 61), sobre todo de Minnesota, Wisconsin, Iowa y Dakota del Sur. Ahora todos los condados que no siembran el cultivo tienen al menos un gemelo que sí lo siembra: en trigo, 65 % con confianza alta; en avena, 35 %. Por ejemplo, Story (Iowa) pasa de 1 gemelo con trigo (confianza baja) a 5 (alta).

**Chequeo del paso 16.** Se compara con el modelo del punto 2, que solo existe en IA, IL e IN. En soja coinciden: el continuo rinde menos (−8 con los gemelos y −10 con el modelo). En maíz apuntan al revés: con los gemelos, el continuo rinde **más** (+18 bu/ac) y con el modelo, menos (−29). Los condados que repiten mucho maíz son los más productivos por otras razones. Por eso, en `corn_after_soy` y `corn_after_corn` los gemelos se muestran como "quiénes lo hacen", con confianza baja y **sin rango**. En IA, IL e IN el rango de esas opciones sale del punto 2. En los otros 6 estados el texto dice que todavía no hay estimación del modelo para ese condado.

## Datos

**Entra:**

| Archivo | Qué tiene | De quién |
|---|---|---|
| `backend/Datos/tabla_modelado.csv` | Suelo, calor y rotación por condado y año | Punto 2 (ya está) |
| `backend/Datos/escenarios_rotacion_resumen.csv` | Rango del modelo por opción, para el chequeo del paso 16 | Punto 2 (ya está) |
| `backend/Datos/entregas/fieldshift_datos_todo_20261115/unido_9_estados/` | `tabla_anual.csv` (suelo, clima, rinde, rotación, superficie sembrada), `tabla_mensual.csv` (`prec_imerg_mm`, `prec_power_mm`), `referencia/condados.csv` (nombre, centroide) | Pipeline de datos (ya está; no va a Git) |

**Sale:**

| Archivo | Columnas | Para quién |
|---|---|---|
| `backend/Datos/gemelos_vecinos.csv` | `fips`, `orden`, `fips_vecino`, `distancia`, `mismo_estado`, `km`, `similar_on`, `similar_on_es` | Revisión |
| `backend/Datos/gemelos.csv` | `fips`, `cultivo`, `rotacion`, `orden`, `fips_gemelo`, `distancia`, `similar_on`, `pct_sobre_si_mismo`, `pct_area`, `rend_tipico_bu_ac` | Revisión |
| `backend/Datos/gemelos_rango.csv` | `fips`, `cultivo`, `rotacion`, `n_gemelos`, `n_anios`, `p10`, `mediana`, `p90`, `confianza`, `motivo`, `condado_ya_lo_hace`, `usar_como_rango` | Revisión |
| `backend/Datos/gemelos_control.csv` | Errores de los controles de los pasos 9 y 19 | Este documento |
| `backend/Datos/front/gemelos.json` | Ver abajo | El script que arma `web/public/data/next/<fips>.json` |

**`gemelos.json` (`version_contrato` 0.2)** sigue los tipos de `web/src/next/types.ts`:

- `counties[fips].twins[]` es un `Twin` del front, listo para copiar: `centroid` como `[lon, lat]`, `similar_on` como lista y `grew_crop_pct` por cultivo (`{"corn": 61, "soy": 39}`, % del área sembrada según NASS).
- `counties[fips].options[id]` trae, para cada opción, los fips de sus gemelos (`twins`, para `options[].twins` del front), `twins_range` (`{p10, median, p90}` o `null`), `use_as_range`, `confidence` (`high`, `medium` o `low`) y `text`.
- `options` (arriba de todo) cruza cada id con el punto 2: `corn` = maíz `actual`, `corn_after_soy` = maíz `rotado`, `corn_after_corn` = maíz `continuo`, `soy`, `soy_after_corn` y `soy_after_soy` igual con soja, y `wheat` y `oats` = `nuevo`.
- Los cultivos usan los ids de `web/src/ui/crops.ts`. La avena no tiene id propio y va como `other`.

## Depende de / lo usan

- **Depende de:** la entrega `todo_20261115`. Del punto 2 solo usa `escenarios_rotacion_resumen.csv`, para el chequeo del paso 16 y para saber qué condados tienen rango del modelo.
- **Lo usan:** la pantalla "Próxima campaña" del front (bloque "Counties like yours"), a través del script que arma `next/<fips>.json`. Ese script todavía no lee `gemelos.json`.

## Cómo se valida

- No hay split por años porque no se entrena nada. Solo se usan 2009–2023; 2024–2025 quedan para la prueba del punto 2.
- **Vara a superar:** los condados más cercanos en el mapa. Ganarle al azar es fácil. Los gemelos tienen que ganarle al mapa en el paso 19.
- **Métrica:** diferencia media de rinde típico de maíz en bu/ac. El rinde no entra al parecido, así que sirve de control.
- **Chequeo agronómico:** el paso 16 compara la dirección del efecto de rotar con el modelo del punto 2, que coincide con los experimentos de campo.

## Supuestos

- **Lluvia de IMERG y calor de POWER.** La entrega no trae otra temperatura.
- **Suelo y clima pesan lo mismo** (`PESO_SUELO = 0,5`), con 5 variables de suelo y 4 de clima elegidas para poder explicarse en una frase.
- **Umbral de parecido:** el 10 % de pares más cercanos de la región.
- **"Hace la opción":** estar en el 25 % de la región que más (o menos) repite el cultivo. Para trigo y avena, que NASS publique su rinde en al menos 5 años.
- **Rango solo con 3 gemelos o más.** Con 1 o 2 se muestran los gemelos, pero no se da rango.

## Probado

- **Corrida con la entrega `todo_20261115`** (9 estados), de punta a punta y sin errores, en unos 95 segundos.
- **`gemelos.json` cumple los tipos de `types.ts`** en sus 790 condados: centroides, listas, ids de cultivo y niveles de confianza.

## Qué falta

- [ ] Que el script que arma `next/<fips>.json` lea `gemelos.json`.
- [ ] Si el front quiere mostrar "Oats", sumar `oats` a `crops.ts`.
- [ ] Decidir con el equipo cómo se muestran los gemelos de maíz rotado y continuo, que no se usan como rango.
- [ ] Kansas (Sumner, el condado de demo del front) y Dakota del Norte no están en la entrega: sin gemelos hasta que lleguen.
- [ ] Pedir al pipeline el suelo de los 9 condados de Dakota del Sur que no lo tienen (el parecido usa solo el clima en esos casos).
- [ ] Probar sumar riego (`pct_riego` del censo) al parecido: con 9 estados, el mapa le gana a los parecidos cuando compiten todos los condados.
- [ ] Probar más variables de clima con IMERG y repetir los controles.

## Limitaciones (para el pitch)

- Son condados, no lotes: el rinde de NASS es del condado entero.
- En maíz, los condados que repiten mucho maíz rinden más por otras razones; sus gemelos no muestran el efecto de la rotación.
- Cuando compiten todos los condados, en 9 estados el mapa elige un poco mejor que el parecido (8,1 contra 9,5 bu/ac). El parecido gana cuando hay que buscar a los que hacen algo distinto.
- El rango del modelo (punto 2) solo existe en Iowa, Illinois e Indiana. En los otros estados los gemelos son la única evidencia.
