# Model card: rinde de maíz y soja por condado (modelo B, punto 2)

Ficha del modelo que usa Field Rewind en "Next season". Respalda las cifras del formulario de Space Apps
(`docs/entrega/informe-space-apps.md`). Detalle técnico: [`backend/ML/PUNTO2.md`](../../backend/ML/PUNTO2.md) y
[`backend/ML/MEJORAS_15_11.md`](../../backend/ML/MEJORAS_15_11.md).

## Qué predice

- **Modelo B, escenarios de rotación** (`backend/ML/CLAUDE.md`, sección 4): el rinde de maíz y de soja de un
  **condado** (NASS, bu/acre) con el clima de cada año 2009–2023, el suelo del condado, su rotación y la tendencia
  tecnológica.
- Sirve para **comparar rotaciones**: seguir como siempre, rotar del todo o repetir el cultivo.
- **No es un pronóstico de temporada:** no dice cuánto va a rendir este año. Cada año de clima pasado es un
  escenario posible.
- No es causal: son asociaciones en los datos del condado. El efecto de rotar se estima aparte, con efectos fijos.

## Datos

- **Entrega:** `fieldshift_datos_final_20261115`, carpeta `unido_11_estados/`: 948 condados con rinde de 11 estados
  (IA, IL, IN, KS, MN, MO, ND, NE, OH, SD, WI).
- **Target:** `rend_bu_ac` de USDA NASS (rinde de grano por condado).
- **Desarrollo:** 2009–2023 (desde 2009 por la rotación del CDL). **Prueba:** 2024–2025, cerrada hasta el final.
- **Variables:** 25 en maíz y 23 en soja.

| Grupo | Variables | Fuente |
|---|---|---|
| Clima del cultivo | Maíz: lluvia y máxima de julio, días > 30 °C y > 35 °C, déficit de julio. Soja: lluvia, máxima y déficit de agosto | NASA POWER |
| Clima de la temporada | Lluvia, grados-día y déficit de abril a septiembre | NASA POWER |
| Primavera | Lluvia y días con > 50 mm en abril y mayo; humedad del suelo superficial y de raíces en abril y mayo | NASA POWER |
| Suelo y terreno (fijos) | Agua disponible 0–100 cm, NCCPI del cultivo, carbono orgánico, drenaje, grupo hidrológico; pendiente y TWI | USDA SSURGO, NASA NASADEM |
| Rotación | % del cultivo sobre sí mismo: lo normal del condado y el desvío del año | USDA CDL |

- **Tendencia:** recta por estado más el nivel propio de cada condado, ajustada solo con los años de entrenamiento
  de cada fold.

## Validación

Dejando un año afuera por vez (2009–2023). MAE en bu/acre; el mejor baseline es la **tendencia lineal de cada
condado**.

| Estado | Maíz: modelo | Maíz: tendencia | Soja: modelo | Soja: tendencia |
|---|---:|---:|---:|---:|
| Illinois | 15,6 | 20,0 | 3,7 | 4,2 |
| Indiana | 16,9 | 19,4 | 3,7 | 4,1 |
| Iowa | 14,0 | 17,4 | 3,6 | 4,4 |
| Kansas | 18,4 | 23,6 | 6,7 | 8,8 |
| Minnesota | 13,9 | 15,9 | 3,9 | 4,7 |
| Missouri | 20,7 | 26,8 | 5,2 | 6,2 |
| Nebraska | 13,3 | 15,7 | 4,7 | 5,6 |
| Dakota del Norte | 15,7 | 17,2 | 4,7 | 4,8 |
| Ohio | 13,4 | 15,1 | 3,4 | 3,6 |
| Dakota del Sur | 16,2 | 20,5 | 5,1 | 6,3 |
| Wisconsin | 10,8 | 12,7 | 4,2 | 4,8 |
| **Total** | **15,3** | **18,6** | **4,3** | **5,1** |

- Gana en los 11 estados; en maíz, en 14 de 15 años, y en soja en 13 de 15. Sin 2012 también gana en maíz (14,6
  contra 16,6).

**Prueba final 2024–2025** (abierta una sola vez, el 15/11 a las 19:00, con el modelo congelado):

| | Modelo | Tendencia | Estados en que gana |
|---|---:|---:|---|
| Maíz | 15,2 | 14,9 | 5 de 11 (MN, MO, NE, ND, SD); pierde en IL, IN, IA, KS, OH y WI |
| Soja | 4,5 | 5,6 | 11 de 11 |

En 2024–2025 el CDL pasa de 30 m a 10 m, y eso mueve las columnas de rotación que usa el modelo: es una causa
probable de que el maíz no le gane a la tendencia en el núcleo.

## Incertidumbre

- **Banda del error del modelo (p10–p90):** calibrada por estado con los errores fuera de muestra. Contiene al
  80 % de los casos en desarrollo y, en la prueba 2024–2025, al 83 % en maíz (Illinois 73 %) y al 79 % en soja
  (Ohio 61 %).
- **Rango que ve el productor ("bad year – typical – good year"):** sale solo del clima de 2009–2023 aplicado al
  rinde medio del modelo, sin sumar el error del modelo. Por eso es **angosto**: el 23 % de los años reales cae
  debajo del "bad year", cuando debería ser el 10 %. En Story, el año malo real está unos 29 bu/acre debajo del
  típico, y la app muestra 9. La app y el formulario lo dicen ("real single years swing about twice as much"). El
  arreglo (sumar el error del modelo) queda para después del cierre: con él, cae debajo del "bad year" el 7–10 %.

## Limitaciones

- **Por condado, no por lote:** dos productores del mismo condado ven el mismo rango.
- **Efecto de rotar:** se midió con cambios chicos del % del condado (unos 6 puntos) y se extiende a un cambio
  total. Maíz continuo −18,9 %, soja continua −12,1 %. En **Missouri** sale al revés (se repite maíz en los años
  buenos): esas opciones van con confianza baja.
- **Riesgo e ingreso eligen casi lo mismo** (difieren en 6 de 1.244 casos): rotar corre el rinde lo mismo en todos
  los climas.
- **En 25 condado-cultivo de Dakota del Sur (13) y Dakota del Norte (12)** todas las opciones dan ingreso medio
  negativo con el costo regional del ERS.
- **Años raros (punto 4):** "lo habitual" se calcula con el modelo final, que ya vio ese año; lo "no explicado" sí
  usa predicciones fuera de muestra. No se reentrenó dejando cada año afuera.
- **CDL de 10 m en 2024–2025** (ver "Prueba final").
- **LightGBM no es del todo determinista:** dos corridas difieren hasta 1,8 bu/acre en algunos folds (maíz 2013 y
  2020). No se cambió para no mover las cifras del cierre.
- El costo operativo del ERS es uno por cultivo y región: no separa rotaciones (el maíz continuo lleva más
  nitrógeno).

## Dónde no usarlo

- **Por lote:** el target es el rinde del condado.
- **Fuera del rango de clima de los 948 condados**, por ejemplo en **Argentina**: la mayoría de los departamentos
  quedan fuera del dominio climático y el sur bonaerense, que queda dentro, rinde la mitad que sus condados
  análogos. No se muestran predicciones en Argentina.
- **Como causa:** no dice por qué rinde un campo; dice qué se asocia con el rinde en los datos del condado.
- **Como pronóstico del año en curso.**

## Reproducir

- Notebook: `backend/ML/punto2_rotaciones.ipynb` (correr con `CULTIVO = "maiz"` y `"soja"`), con la entrega en
  `backend/Datos/entregas/`.
- Versiones: `backend/ML/requirements.txt`.
- Cada corrida suma una fila a `backend/Datos/experimentos.csv`.
