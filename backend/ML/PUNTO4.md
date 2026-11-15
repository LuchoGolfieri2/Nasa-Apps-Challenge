# Punto 4: años que rindieron distinto de lo esperado

Notebook: [`punto4_anomalias.ipynb`](punto4_anomalias.ipynb). Corresponde al uso #4 del issue #6. No entrena un modelo nuevo: usa el **modelo B** del punto 2 ([`PUNTO2.md`](PUNTO2.md)) para describir el pasado.

## Qué le muestra al productor

> "In 2012, corn in this county yielded about {X} % less than in a normal year. July heat tends to explain most of it."

En la historia de su condado, los años que se salieron de lo normal, para mejor o para peor, con el motivo más probable. Ayuda a entender el riesgo: qué tipo de año le pega y cuánto. Va junto a la pantalla "Compare rotations" del `INFO.md`; el formato para la app falta acordarlo (ver "Qué falta").

## Cómo funciona, en simple

1. **Rinde de un año normal.** Para cada condado y año, el modelo del punto 2 predice el rinde con el **clima típico** del condado (la mediana de 2009–2023) en vez del clima real de ese año. El suelo, la rotación y la tendencia de ese año quedan iguales.
2. **Diferencia.** Rinde real − rinde de un año normal. Si se aparta 10 % o más, el año se marca.
3. **Por qué.** Con los valores SHAP del modelo se calcula cuántos bu/ac le sumó o le restó cada grupo de clima (calor de julio, primavera húmeda, etc.) respecto de un año normal. El que más pesó es la causa principal.
4. **Lo que el modelo no ve.** Si la diferencia no se explica con el clima (granizo, viento, inundación, plagas), la causa queda como `no_explicado`.

## Partes de la notebook

| Paso | Qué hace | Estado |
|---|---|---|
| 0–1 | Librerías y parámetros (`CULTIVO`, `UMBRAL_PCT`, grupos de clima) | Funciona |
| 2 | Carga el modelo y la tabla del punto 2 | Funciona |
| 3 | Copias de las funciones del punto 2 (rotación, tendencia, contribuciones SHAP) | Funciona |
| 4 | Rinde de un año normal para cada condado y año | Funciona |
| 5 | Aporte de cada grupo de clima, causa principal y años marcados | Funciona |
| 6 | Chequeo: ¿reconoce 2012 (sequía) y 2019 (primavera húmeda)? | Funciona |
| 7 | Ejemplo: la historia de Story, Iowa | Funciona |
| 8 | Guarda `backend/Datos/anomalias_anio.csv` | Funciona |

Se corre **una vez por cultivo**; las salidas de maíz y soja se juntan en el mismo archivo.

## Datos

**Entra:**

| Archivo | Qué tiene | De quién |
|---|---|---|
| `backend/ML/modelos/punto2_rotaciones_<cultivo>.joblib` | Modelo, tendencia, promedios de rotación y features | Punto 2 (correr su notebook primero; no va a Git) |
| `backend/Datos/tabla_modelado.csv` | Rinde y features de cada condado y año | Punto 2 |

**Sale:**

| Archivo | Columnas | Para quién |
|---|---|---|
| `backend/Datos/anomalias_anio.csv` | `fips, anio, estado, cultivo, rend_bu_ac, rend_anio_normal_bu_ac, rend_predicho_bu_ac, diferencia_bu_ac, diferencia_pct, explicado_clima_bu_ac, no_explicado_bu_ac, causa_principal, efecto_causa_bu_ac, marcado, direccion, ef_<grupo>_bu_ac` | Front (línea de tiempo del condado) y punto 3 (frases). Detalle de cada columna en el paso 8 de la notebook |

**Grupos de clima** (`causa_principal`), los mismos que propone el punto 3:

| id | Columnas | Frase en la app (borrador) |
|---|---|---|
| `calor_julio` | `tmax_jul_c`, `dias_tmax_gt30_jul`, `dias_tmax_gt35_07` | "July heat (corn flowering)" |
| `agua_julio` | `prec_jul_mm`, `deficit_mm_07` | "July rain and water balance" |
| `calor_agosto` | `tmax_c_08` | "August heat (soybean pod filling)" |
| `agua_agosto` | `prec_ago_mm`, `deficit_mm_08` | "August rain and water balance" |
| `temporada` | `prec_temporada_mm`, `gdd_temporada`, `deficit_temporada_mm` | "Season rain, warmth and water balance (Apr–Sep)" |
| `primavera_humeda` | lluvia, lluvias fuertes y humedad del suelo de abril y mayo | "Wet spring (can delay planting)" |
| `no_explicado` | — | "Something the weather data doesn't capture (hail, wind, flooding, pests…)" |

## Depende de / lo usan

- **Depende de:** el punto 2 (modelo guardado y `tabla_modelado.csv`). Si el punto 2 cambia de modelo o de features, hay que volver a correr esta notebook.
- **Lo usan:** el front (línea de tiempo del condado) y el punto 3 (frases de cada causa en `textos.json`).

## Cómo se valida

- No se entrena nada: la validación del modelo está en el punto 2.
- **Chequeo con años conocidos:** 2012 (sequía y calor) tiene que salir marcado como `peor` en la mayoría de los condados, con causa de calor o falta de agua. 2019 (primavera muy húmeda) tiene que mostrar `primavera_humeda`. Si 2012 no aparece, la notebook avisa.
- La prueba 2024–2025 del punto 2 no se usa todavía.

## Supuestos

- **Año normal = mediana del clima del condado en 2009–2023.** La mediana, y no el promedio, para que 2012 no corra lo que se considera normal.
- **`UMBRAL_PCT = 10`:** en maíz son unos 18 bu/ac, parecido al error promedio del modelo del punto 2. Menos que eso no se distingue del ruido.
- **Causa principal:** el grupo de clima que más empuja en la dirección de la diferencia. Si lo no explicado pesa más que todo el clima junto, la causa es `no_explicado`.
- El aporte de cada grupo es SHAP(año real) − SHAP(año normal), sumado sobre las columnas del grupo.
- Suelo y rotación no entran en las causas: dentro de un condado casi no cambian de un año a otro.

## Probado

Con los datos reales (entrega v1.2, 2026-11-14), años 2009–2023:

| | Maíz | Soja |
|---|---:|---:|
| Condado-año marcados (±10 %) | 34 % | 28 % |
| 2012: condados marcados como `peor` | 93 % | 69 % |
| 2012: causa calor o falta de agua (entre los marcados) | 100 % | 71 % |
| Marcados con causa `no_explicado` | 50 % | 55 % |

- **Reconoce los años conocidos:** 2012 sale con calor de julio (maíz) y falta de agua de la temporada (soja); 2019 sale con `primavera_humeda` en soja; 2009 y 2014, veranos frescos, salen como `mejor` por `calor_julio` en maíz.
- **Ejemplo, Story (Iowa), maíz:** 2012 −38 bu/ac por calor de julio; 2020 −40 bu/ac `no_explicado`, el año del derecho (tormenta de viento del 10 de agosto de 2020), que el modelo no puede ver porque no tiene datos de viento.
- **La mitad de los años marcados quedan como `no_explicado`.** Es esperable: el modelo del punto 2 explica menos de la mitad de la variación del rinde (R² 0,44 en maíz).

## Qué falta

- [ ] Acordar con el front dónde va la línea de tiempo del condado (`INFO.md` no tiene un archivo para esto) y generarlo en `backend/Datos/front/`.
- [ ] Frases para cada `causa_principal` en `textos.json`, junto con el punto 3.
- [ ] Predicciones fuera del fold (reentrenando sin cada año), para que el año que se explica no esté en el entrenamiento del modelo.
- [ ] Sumar 2024 y 2025 cuando se mire la prueba del punto 2.
- [ ] Clasificar cada año como seco, normal o húmedo con la misma regla que el punto 1 (`clase_anio`), cuando esté definida.

## Limitaciones (para el pitch)

- Es **por condado**, no por lote.
- El modelo se entrenó con estos mismos años, así que puede atribuirle al clima un poco más de lo que corresponde.
- "Causa principal" es una **asociación**: "July heat tends to explain most of it", nunca "because of".
- Granizo, viento, inundaciones y plagas no están en los datos: quedan como `no_explicado`.
