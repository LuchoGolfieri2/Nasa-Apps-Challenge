# Punto 3: el "por qué" en lenguaje simple

Notebook: [`punto3_explicaciones.ipynb`](punto3_explicaciones.ipynb). Corresponde al uso #3 del issue #6. No entrena un modelo: explica el del punto 2 (modelo B, escenarios de rotación).

## Qué le muestra al productor

> "In years with a hot July (corn flowering), corn yields here tend to be about 11 bu/ac lower (NASA POWER)."
> "Corn after corn tends to yield about 17% less than corn after soybean (2009–2023). Rotating fully is linked to about +10 bu/ac here vs. the county's usual mix (USDA CDL + NASS)."

Son las razones que van debajo de cada opción de la pantalla **"Próxima campaña"**: dos o tres frases con su fuente, más la confianza de la opción. El front las usa para las listas `benefits` / `risks` y para las "2 razones con fuente" de la opción sugerida (`docs/specs/front-back-connection-spec.md`, sección 3).

## Cómo funciona, en simple

1. **Dos fuentes de explicación, que no se mezclan** (`PUNTO2.md`, "Para el punto 3"):
   - **Clima y suelo:** se le pide al LightGBM del punto 2 cuánto aportó cada variable a cada predicción (valores SHAP, en bu/ac). Positivo empujó el rinde para arriba, negativo para abajo.
   - **Rotación:** el efecto medido con efectos fijos en el punto 2 (`efecto_rotacion.csv`). La rotación **nunca** se explica con SHAP: en el modelo de ML esas columnas miden qué tipo de condado es, no el efecto de rotar.
2. **Agrupar.** Al productor no le sirve "`gwetroot_05`". Las variables se suman por grupo ("calor de julio", "agua del suelo", etc.).
3. **Resumir por condado.** El suelo es fijo: se toma el promedio. El clima cambia cada año: para cada factor se miran sus **años malos** (el 30 % de años en que más restó) y cuánto costó en promedio. Se mira la variable representativa para decir si fue seco o húmedo, caluroso o fresco.
4. **Frases fijas.** Una plantilla por grupo y signo, en inglés, con "tends to", nunca "because". Sin IA generativa: nada que declarar.
5. **Armar cada opción.** Primero la razón de rotación, después suelo y clima por tamaño, hasta 3. Las que suman son `benefits`, las que restan `risks`. Más una frase de "qué mueve más el rango" y la confianza.

## Partes de la notebook

### Preparación (pasos 0 a 3), funciona

| Paso | Qué hace |
|---|---|
| 0 | Librerías. No hace falta `shap`: LightGBM da los mismos valores con `pred_contrib=True` |
| 1 | Parámetros: grupos de variables, umbrales, fuentes, plantillas |
| 2 | Carga `tabla_modelado.csv`, `efecto_rotacion.csv`, `escenarios_rotacion_resumen.csv`, `experimentos.csv` |
| 3 | Carga `modelos/punto2_rotaciones_<cultivo>.joblib` o, si no está (no va a Git), **lo regenera con la receta exacta del paso 13 del punto 2** y lo avisa |

### Parte A: SHAP por grupo (pasos 4 a 6), funciona

| Paso | Qué hace | Estado |
|---|---|---|
| 4 | SHAP por condado y año; verifica base + suma = predicción | Funciona |
| 5 | Suma por grupo → `data/ml/explicaciones_shap_grupos.csv` | Funciona |
| 6 | Resumen por condado: suelo fijo, años malos por factor, qué mueve el rango | Funciona |

Resultado real (maíz, Story IA 2012, la sequía): calor de julio −39 bu/ac; es el grupo que más resta, como documenta `PUNTO2.md`.

### Parte B: frases y salida (pasos 7 a 10), funciona

| Paso | Qué hace | Estado |
|---|---|---|
| 7 | Plantillas fijas en inglés | Funciona |
| 8 | Razones por condado × cultivo × opción, confianza, guarda CSV y JSON | Funciona |
| 9 | Chequeos (palabras prohibidas, largo, sentido agronómico, cobertura) | 6 de 6 OK |
| 10 | Ejemplos: Story IA, McLean IL, Sumner KS (Missing data) | Funciona |

## Datos

**Entra:**

| Archivo | Qué tiene | De quién |
|---|---|---|
| `data/ml/tabla_modelado.csv` | La tabla que usó el modelo del punto 2 | Punto 2 (ya está) |
| `data/ml/efecto_rotacion.csv` | Efecto de rotar, efectos fijos | Punto 2 (ya está) |
| `data/ml/escenarios_rotacion_resumen.csv` | Mediana entre climas por opción | Punto 2 (ya está) |
| `data/ml/experimentos.csv` | Lista exacta de features del modelo elegido | Punto 2 (ya está) |
| `modelos/punto2_rotaciones_<cultivo>.joblib` | Modelo entrenado. Si no está, se regenera | Punto 2 (fuera de Git) |

**Sale:**

| Archivo | Columnas | Para quién |
|---|---|---|
| `data/ml/explicaciones.csv` | `fips, cultivo, rotacion, orden, tipo, grupo, valor_bu_ac, anios, texto_en, fuente, fuente_label, basis, confianza` | Front y revisión del equipo |
| `data/ml/front/explicaciones.json` | `counties[fips][cultivo][rotacion]` → `reasons[]`, `benefits[]`, `risks[]`, `range_driver`, `confidence{level, reason}`, `n_years` | El script del front, para `next/<fips>.json` |
| `data/ml/explicaciones_shap_grupos.csv` | `fips, cultivo, anio` + un SHAP por grupo (bu/ac) | Punto 4 (años raros) y línea de tiempo |

Cada razón trae: `type` (`rotation`, `soil`, `climate_bad_years`, `range_driver`), `group`, `text` (inglés), `value_bu_ac`, `years` (para F23: años clickeables), `basis: "model"`, `source` (id de `fuentes.json`) y `source_label`.

## Depende de / lo usan

- **Depende de:** las salidas del punto 2 en `data/ml/`.
- **Lo usan:** el front (pantalla "Próxima campaña") y el punto 4.

## Cómo se valida

- No hay modelo nuevo que validar: se explica el del punto 2, con sus mismos folds (solo años de desarrollo 2009–2023; la prueba 2024–2025 sigue sin tocarse).
- Se verifica que **base + suma de SHAP = predicción** en todas las filas.
- Chequeos de texto: sin "because", "recommend", "best option", "you should"; ninguna frase pasa de 40 palabras (mediana 19).
- Chequeos de sentido: Story 2012 manda el calor de julio; `rotado` suma y `continuo` resta en todos los condados; cada condado con escenario tiene explicación y cada opción tiene de 1 a 3 razones.

## Supuestos

- **Grupos de variables:** los de `PUNTO2.md`. `tipo_de_condado` (columnas de rotación del ML) no se muestra.
- **Años malos:** el 30 % de años con SHAP más negativo del grupo (mínimo 2). Si el grupo no restó en al menos 2 años, no hay frase.
- **Umbral para mostrar una razón:** 2 bu/ac en maíz, 1 en soja.
- **Seco/húmedo, caluroso/fresco:** se decide con una sola variable representativa del grupo (déficit del mes, lluvia de mayo, temperatura máxima) comparada con la media del condado.
- **Confianza (provisoria):** alta con ≥ 12 años de dato y efecto de rotación claro; `rotado` y `continuo` como máximo media, porque el efecto se midió con cambios chicos y se extiende a un cambio total; baja con < 6 años.
- **Rotación en bu/ac de este condado:** mediana entre climas de `rotado` o `continuo` menos la de `actual` (`escenarios_rotacion_resumen.csv`).
- Si no está el `.joblib`, el modelo se regenera con la receta del punto 2: misma tabla, features, hiperparámetros y semilla. Con la misma versión de LightGBM da el mismo modelo.

## Probado

- Con los datos reales de la entrega v1.2 (293 condados de Iowa, Illinois e Indiana, 2009–2023). 585 resúmenes condado × cultivo, 6.954 razones. Los 6 chequeos pasan.
- Los valores SHAP de Story 2012 coinciden con los que documenta `PUNTO2.md` (calor de julio −25 bu/ac por `tmax_jul_c`).

## Qué falta

- [ ] Acordar con el front cómo pegar `explicaciones.json` en `next/<fips>.json` y confirmar los ids `actual` / `rotado` / `continuo`.
- [ ] Acordar la regla de confianza con el equipo.
- [ ] Sumner, KS no está en la entrega v1.2: el front muestra "Missing data" hasta que el pipeline sume Kansas.
- [ ] Revisar con alguien de agronomía los calificativos seco/húmedo de `temporada` y `primavera_humeda`.
- [ ] Si el punto 2 pasa a Ridge, cambiar el cálculo de SHAP.

## Limitaciones (para el pitch)

- Son **asociaciones en los datos del condado**, no causas, y por condado, no por lote.
- SHAP explica al modelo, no al campo: dice qué miró el modelo.
- El clima de POWER es de ~0,5°: condados vecinos comparten frases parecidas.
- El efecto de rotar se midió con cambios chicos del % del condado y se extiende a un lote que rota del todo o nada.
