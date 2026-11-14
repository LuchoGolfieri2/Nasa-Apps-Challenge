# Punto 2: vigor esperado por cultivo

Notebook: [`punto2_vigor.ipynb`](punto2_vigor.ipynb). Corresponde al uso #2 del issue #6 (y al #3, que usa el mismo modelo).

## Qué le muestra al productor

> "En este lugar de tu campo, el maíz tendría este vigor en un año normal, este en un año malo y este en un año muy bueno. La soja, este otro."

Con eso el productor compara cultivos y ve cuánto riesgo tiene cada uno. El modelo **estima**; la decisión es del productor.

## Cómo funciona, en simple

1. **El modelo aprende del pasado.** Ve miles de puntos de campos, año por año: qué se sembró antes, cómo era el clima y el suelo, y **qué tan bien creció el cultivo** (`ndvi_peak`, el pico de verdor medido por satélite).
2. **Le hacemos preguntas "¿y si…?".** Para un punto dado: "¿y si acá ponés maíz?", "¿y si ponés soja?". Cambiamos solo el cultivo y dejamos todo lo demás igual.
3. **Lo repetimos con muchos climas.** Probamos el clima de cada año histórico de ese lugar. Así sale un rango, no un solo número: año normal (`media`), año malo (`p10`) y año muy bueno (`p90`).

## Partes de la notebook

### Preparación (pasos 0 a 4), ya funciona

| Paso | Qué hace |
|---|---|
| 0 | Carga las librerías (pandas, LightGBM). Si no está LightGBM, usa un modelo equivalente de scikit-learn |
| 1 | Lee `cdl_puntos.csv` desde la raíz del repo: 9.000 puntos en 3 condados, 2017–2025 |
| 2 | Muestra qué se siembra en cada región. En Iowa e Illinois es casi todo maíz y soja; en Kansas hay mucho trigo |
| 3 | Junta los cultivos raros en `otros` y pasa los conteos a proporciones ("qué parte de los años hubo maíz") |
| 4 | Separa por años: aprende con 2017–2023, se evalúa con 2024 y 2025 queda para el examen final |

### Parte A: modelo de práctica (pasos 5 a 8), ya funciona

Predice **qué sembró el productor**. No es la recomendación: sirve para tener todo el código armado y probado mientras llegan los datos.

| Paso | Qué hace |
|---|---|
| 5 | Regla simple a superar: "lo contrario del año anterior" (maíz → soja, soja → maíz) |
| 6 | Entrena el modelo (`modelo_a.fit`) |
| 7 | Compara modelo contra regla, por región |
| 8 | Examen final con 2025. Está apagado: se activa con `MIRAR_TEST = True` una sola vez, al final |

Resultado en validación (2024), % de acierto:

| Región | Regla simple | Modelo |
|---|---|---|
| McLean (IL) | 94,2 | 94,9 |
| Story (IA) | 83,4 | 85,9 |
| Sumner (KS) | 34,7 | 55,0 |

### Parte B: el modelo de vigor (pasos 9 a 12), espera los datos de Diego

| Paso | Qué hace | Estado |
|---|---|---|
| 9 | Une NDVI, clima y suelo a la tabla de puntos | Faltan las rutas y los nombres de columnas |
| 10 | Entrena el modelo de vigor (`modelo_b.fit`) y lo compara con una regla simple: el NDVI promedio de ese cultivo en esa región | Escrito, probado con datos inventados |
| 11 | `recomendar`: para un punto, prueba cada cultivo y los ordena | Escrito, probado con datos inventados |
| 12 | `simular_escenarios`: repite con el clima de cada año y da `media`, `p10` y `p90` | Escrito, probado con datos inventados |

Cultivos que se comparan en cada región (solo los que tienen datos suficientes ahí):

- Story (IA) y McLean (IL): maíz y soja.
- Sumner (KS): maíz, soja, trigo, sorgo y doble trigo/soja.

## Datos

**Entra:**

| Archivo | Qué tiene | De quién |
|---|---|---|
| `cdl_puntos.csv` | Cultivo de cada punto en cada año y los dos anteriores | Lucho (ya está) |
| NDVI (MODIS) | `point_id, year, ndvi_peak`: es lo que el modelo aprende a predecir | Diego |
| Clima (POWER) | `point_id, year` + variables de clima | Diego |
| Suelo (SSURGO) | `point_id` + variables de suelo | Diego |

**Sale:**

- `data/ml/punto2_vigor.csv`: `point_id, cultivo, media, p10, p90`. Lo usa el front.
- `modelos/punto2_vigor.joblib`: el modelo entrenado. No se sube a Git.

## Depende de / lo usan

- **Depende de:** `cdl_puntos.csv` y los datos de NDVI, clima y suelo de Diego.
- **Lo usan:** el front (ranking de cultivos con banda de riesgo), el punto 3 (explicaciones, en esta misma notebook) y el punto 4 (años raros), que carga el modelo guardado.

## Cómo se valida

- **Separar por años, nunca filas al azar.** Cada punto aparece 9 veces; si se mezclan, el modelo reconoce el campo y parece mejor de lo que es.
- **Regla simple a superar.** En la Parte A, "lo contrario del año anterior". En la Parte B, el NDVI promedio de ese cultivo en esa región durante el entrenamiento.
- **Métrica:** % de acierto en la Parte A. En la Parte B, MAE, el error promedio en unidades de NDVI (más bajo es mejor).
- **Reportar por región.** Un buen promedio puede esconder que en Kansas anda mal.
- **El test 2025 se mira una sola vez.** Si después de verlo se ajusta el modelo, deja de ser un examen honesto.
- **Sin fugas:** como entrada, solo datos de antes de la siembra. El NDVI de la temporada es el resultado, nunca una entrada.
- **Chequeos agronómicos** (sección 6 de `ML_NOTAS_CDL.md`): por ejemplo, maíz después de soja tiene que dar mejor que maíz después de maíz.

## Supuestos

- Los cultivos con menos de ~1 % de las filas (`alfalfa`, `barbecho`, `otros_dobles`, `otros_cultivos`) se agrupan en `otros`: con tan pocos ejemplos el modelo no aprende nada confiable.
- Los conteos de cultivos previos se dividen por los años de historia disponibles, porque no todos los puntos tienen la misma cantidad.
- En Iowa e Illinois solo se comparan maíz y soja: casi no hay otros cultivos y el modelo estaría adivinando.
- `ndvi_peak` se usa como medida de vigor. Es una aproximación al rinde, no el rinde.

## Qué falta

- [ ] Recibir los archivos de Diego y completar el paso 9.
- [ ] Correr la Parte B con datos reales y ver que le gane a la regla simple.
- [ ] Chequeos agronómicos (sección 6 de `ML_NOTAS_CDL.md`). Por ejemplo, maíz después de soja tiene que dar mejor que maíz después de maíz.
- [ ] Probar alguna variante del modelo (uno más simple, menos o más variables) y quedarse con la mejor.
- [ ] Generar la tabla para la app con **todos** los puntos y guardarla en `data/ml/punto2_vigor.csv`.
- [ ] Guardar el modelo en `modelos/punto2_vigor.joblib`.
- [ ] Más escenarios de clima: POWER llega hasta 1981, no solo 2017–2025.
- [ ] Definir con quien haga el #1 cómo se pasa de puntos a sectores del lote.
- [ ] Cruzar las variables con el catálogo de Diego.
- [ ] Punto 3: explicaciones con SHAP sobre el mismo modelo, traducidas a frases con plantillas fijas.

## Limitaciones (para el pitch)

- Son 3 condados de muestra, no todo el Corn Belt.
- Las etiquetas de cultivo del USDA aciertan 75 % en general: bien en maíz y soja, menos en cultivos chicos.
- El NDVI mide verdor, no rinde. Es una aproximación.
- El modelo encuentra asociaciones, no causas: el productor elige el cultivo por razones que el modelo no ve.
