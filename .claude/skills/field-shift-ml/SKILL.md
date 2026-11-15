---
name: "field-shift-ml"
description: "Modelado de ML para Field Shift: entrenar y validar modelos de rendimiento y riesgo con pocos datos, sin fugas, explicables y conectados a la comparación de rotaciones."
---

# Machine Learning — Field Shift

El modelo no decide qué rotación usar. Estima cómo el clima, el suelo y el cultivo antecesor afectan el rendimiento y el riesgo, para que la comparación de rotaciones tenga evidencia y rangos de incertidumbre.

**Entrada:** `data/processed/tabla_anual.csv` (y `tabla_mensual.csv`), una fila por condado × año en Iowa, Illinois y Kansas. Son unos 306 condados, así que hay miles de filas por cultivo, pero solo unos 25 años: lo que limita es la cantidad de años, no de filas. Todo lo de abajo está pensado para eso.

## 1. Antes de modelar

- Confirmá que cada paquete tiene QA "APTO" en `docs/qa/`.
- Escribí en una línea la pregunta y el target. Recomendado: anomalía de rendimiento por cultivo. Alternativa de riesgo: superficie cosechada / sembrada.
- Contá filas reales por cultivo y años con dato. Los condados de un mismo año comparten el clima, así que no son independientes: arrancá con 15 a 30 features aunque haya miles de filas.

## 2. Validación (lo más importante)

- **Dejar años enteros afuera:** `GroupKFold` o `LeaveOneGroupOut` con grupo = `anio`, o ventanas que avanzan en el tiempo. Nunca KFold aleatorio: un año seco (como 2012) afecta a todos los condados a la vez.
- Probá también dejar un estado entero afuera, para saber si generaliza a zonas nuevas.
- **Todo lo que aprende de los datos va dentro del fold** (un `Pipeline`): sacar la tendencia del rendimiento, anomalías y z-scores, imputación, escalado, selección de features.
- Los hiperparámetros se ajustan con validación anidada o con un bloque de años reservado. Nunca con los años de test.

## 3. Baselines obligatorios

El modelo tiene que ganarles y el informe lo muestra:
- media histórica del condado,
- tendencia lineal del condado,
- valor del año anterior.

## 4. Modelos, en este orden

1. Ridge o Lasso.
2. Random Forest o gradient boosting (LightGBM / XGBoost) poco profundo: `max_depth` 2 a 4, muchas muestras por hoja, early stopping dentro del fold.
3. Si hay tiempo: modelo mixto con efecto aleatorio por condado (y por estado).

Nada de deep learning: con unos 25 años, la muestra efectiva es chica aunque haya miles de filas.

## 5. Features

- Arrancá con una lista corta elegida por criterio agronómico: lluvia y calor de julio (floración del maíz) y agosto (llenado de la soja), días > 30 °C en floración, déficit hídrico, exceso de agua en primavera, NDVI máximo, agua disponible del suelo (AWS), NCCPI, drenaje, cultivo antecesor (maíz tras soja o tras maíz).
- Sacá pares muy correlacionados (|r| > 0,9) quedándote con el más fácil de explicar.
- Medila con importancia por permutación y mirá si es estable entre folds. Una feature que solo sirve en un fold es ruido.

## 6. Incertidumbre

- Intervalos con regresión por cuantiles o con conformal prediction (por ejemplo MAPIE), calibrados dentro de la validación.
- Reportá la cobertura real: si el intervalo es del 80 %, ¿contiene al 80 % de los casos de test?

## 7. Explicación

- SHAP o dependencia parcial para las features principales.
- Traducí cada hallazgo a una frase llana: "en estos datos, cada 5 días extra de calor en floración se asocian a X % menos de rendimiento".
- Es una asociación, no una causa. Decilo así.

## 8. Conexión con las rotaciones

- Para cada rotación candidata, cambiá las features que la rotación modifica (antecesor, cobertura invernal, demanda de agua) y evaluá el modelo con el clima de cada año histórico como escenario.
- Resultado por rotación: mediana, p10 y p90 de rendimiento o riesgo.
- Los beneficios de suelo (nitrógeno, carbono, erosión) no los predice el modelo: salen de reglas basadas en la tabla de cultivos. La interfaz tiene que mostrar qué parte es modelo y qué parte son reglas.

## 9. Entregables

- `docs/ml/model_card.md`: datos, target, validación, métricas contra los baselines (MAE y R² por fold, no solo el promedio), features, limitaciones y dónde no usarlo.
- `backend/Datos/escenarios_rotacion.csv` para el frontend: `fips, rotacion, cultivo, anio_clima, pred, p10, p90`.

## 10. Errores a evitar

- Split aleatorio.
- Sacar la tendencia o calcular anomalías con todo el período antes de separar.
- Reportar el mejor fold.
- Esconder que n es chico.
- Decir que el modelo "recomienda". El modelo estima; el productor decide.