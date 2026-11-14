# Punto 5: condados gemelos

Notebook: [`punto5_vecinos.ipynb`](punto5_vecinos.ipynb). Corresponde al uso #5 del issue #6. No entrena un modelo ni es el modelo A o B del `CLAUDE.md`: es una búsqueda de vecinos (kNN) por suelo y clima.

## Qué le muestra al productor

> "Counties like yours that grow winter wheat: 5. Their winter wheat yield: 79–104 bu/ac (typical 91). Similar soil and weather doesn't guarantee the same result."

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
| 2 | Carga la tabla del punto 2 y, de la entrega v1.3, nombres, centroides, lluvia IMERG y área sembrada por cultivo |
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

### Resultados (entrega v1.3, años 2009–2023)

**Control del paso 9, todos los condados.** Diferencia media entre el rinde típico de maíz de un condado y el de sus 5 elegidos (bu/ac, más chico es mejor):

| Cómo se eligen los 5 | Lluvia IMERG | Lluvia POWER |
|---|---:|---:|
| Parecidos por suelo y clima | 6,2 | 6,8 |
| Los 5 más cercanos en el mapa | 6,2 | 6,2 |
| Al azar, mismo estado | 13,3 | 13,3 |
| Al azar, toda la región | 14,2 | 14,2 |

Con POWER, los parecidos perdían contra el mapa. La causa: POWER da la lluvia del centroide en una grilla de ~50 km, y 102 de los 293 condados tienen **exactamente** la misma lluvia que otro condado todos los años. Con IMERG (promedio del condado a ~10 km) no pasa en ninguno, y los parecidos empatan con el mapa. El empate es esperable: cuando compiten todos los condados, los parecidos y los vecinos muchas veces son los mismos.

**Control del paso 19, la prueba que importa.** Solo condados que **no** hacen la opción, comparando sus gemelos con los condados más cercanos en el mapa que sí la hacen:

| Opción (id del front) | Gemelos | Mapa | Gemelos con POWER | Mapa con POWER |
|---|---:|---:|---:|---:|
| `corn_after_soy` | 8,2 | 12,6 | 9,0 | 12,8 |
| `corn_after_corn` | 9,1 | 10,0 | 10,09 | 10,05 |
| `soy_after_corn` | 10,3 | 15,9 | 11,8 | 15,5 |
| `soy_after_soy` | 12,0 | 17,2 | 13,4 | 16,5 |
| `wheat` | 8,8 | 11,0 | 11,2 | 12,2 |
| `oats` | 8,6 | 9,2 | 8,6 | 8,4 |

Con IMERG, los gemelos ganan en las 6 opciones. Con POWER perdían en 2 (avena y maíz sobre maíz). Acá sí se cumple la promesa del front: los gemelos están más lejos que los vecinos del mapa (mediana de 120 a 225 km según la opción, contra 85 a 130) y aun así se parecen más.

**Chequeo del paso 16.** En soja, gemelos y modelo coinciden: el continuo rinde menos (−7 y −10 bu/ac). En maíz apuntan al revés: con los gemelos, el continuo rinde **más** (+13 bu/ac) y con el modelo, menos (−29). Los condados que repiten mucho maíz son los más productivos por otras razones. Por eso, en `corn_after_soy` y `corn_after_corn` los gemelos se muestran como "quiénes lo hacen", con confianza baja y **sin rango**: el rango de esas opciones sale del punto 2.

## Datos

**Entra:**

| Archivo | Qué tiene | De quién |
|---|---|---|
| `data/ml/tabla_modelado.csv` | Suelo, calor y rotación por condado y año | Punto 2 (ya está) |
| `data/ml/escenarios_rotacion_resumen.csv` | Rango del modelo por opción, para el chequeo del paso 16 | Punto 2 (ya está) |
| `data/fieldshift_datos_v1.3/condado/` | `referencia/condados.csv` (nombre, centroide), `tabla_mensual.csv` (`prec_imerg_mm`), `tabla_anual.csv` (rinde de trigo y avena, superficie sembrada) | Pipeline de datos (ya está; no va a Git) |

**Sale:**

| Archivo | Columnas | Para quién |
|---|---|---|
| `data/ml/gemelos_vecinos.csv` | `fips`, `orden`, `fips_vecino`, `distancia`, `mismo_estado`, `km`, `similar_on`, `similar_on_es` | Revisión |
| `data/ml/gemelos.csv` | `fips`, `cultivo`, `rotacion`, `orden`, `fips_gemelo`, `distancia`, `similar_on`, `pct_sobre_si_mismo`, `pct_area`, `rend_tipico_bu_ac` | Revisión |
| `data/ml/gemelos_rango.csv` | `fips`, `cultivo`, `rotacion`, `n_gemelos`, `n_anios`, `p10`, `mediana`, `p90`, `confianza`, `motivo`, `condado_ya_lo_hace`, `usar_como_rango` | Revisión |
| `data/ml/gemelos_control.csv` | Errores de los controles de los pasos 9 y 19 | Este documento |
| `data/ml/front/gemelos.json` | Ver abajo | El script que arma `web/public/data/next/<fips>.json` |

**`gemelos.json` (`version_contrato` 0.2)** sigue los tipos de `web/src/next/types.ts`:

- `counties[fips].twins[]` es un `Twin` del front, listo para copiar: `centroid` como `[lon, lat]`, `similar_on` como lista y `grew_crop_pct` por cultivo (`{"corn": 61, "soy": 39}`, % del área sembrada según NASS).
- `counties[fips].options[id]` trae, para cada opción, los fips de sus gemelos (`twins`, para `options[].twins` del front), `twins_range` (`{p10, median, p90}` o `null`), `use_as_range`, `confidence` (`high`, `medium` o `low`) y `text`.
- `options` (arriba de todo) cruza cada id con el punto 2: `corn` = maíz `actual`, `corn_after_soy` = maíz `rotado`, `corn_after_corn` = maíz `continuo`, `soy`, `soy_after_corn` y `soy_after_soy` igual con soja, y `wheat` y `oats` = `nuevo`.
- Los cultivos usan los ids de `web/src/ui/crops.ts`. La avena no tiene id propio y va como `other`.

## Depende de / lo usan

- **Depende de:** el punto 2 (`tabla_modelado.csv` y `escenarios_rotacion_resumen.csv`) y la entrega v1.3.
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

- **Corrida con la entrega v1.3** (las tablas de `condado/` son idénticas a las de la v1.2), de punta a punta y sin errores, en unos 25 segundos.
- **Con `LLUVIA = "power"`** reproduce los números de la versión anterior (6,8 contra 6,2 en el paso 9).
- **`gemelos.json` cumple los tipos de `types.ts`** en sus 293 condados: centroides, listas, ids de cultivo y niveles de confianza.

## Qué falta

- [ ] Que el script que arma `next/<fips>.json` lea `gemelos.json`.
- [ ] Si el front quiere mostrar "Oats", sumar `oats` a `crops.ts`.
- [ ] Decidir con el equipo cómo se muestran los gemelos de maíz rotado y continuo, que no se usan como rango.
- [ ] Kansas (Sumner, el condado de demo del front) no está en la entrega: sin gemelos hasta que llegue.
- [ ] Probar más variables de clima con IMERG y repetir los controles.

## Limitaciones (para el pitch)

- Son condados, no lotes: el rinde de NASS es del condado entero.
- En maíz, los condados que repiten mucho maíz rinden más por otras razones; sus gemelos no muestran el efecto de la rotación.
- Cuando compiten todos los condados, el parecido elige casi lo mismo que el mapa. Gana cuando hay que buscar a los que hacen algo distinto.
- Trigo y avena son escasos en estos tres estados: muchos condados tienen pocos gemelos (confianza baja).
