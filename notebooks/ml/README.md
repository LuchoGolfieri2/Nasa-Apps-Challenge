# Notebooks de ML — Field Shift

Una notebook por cada uso de ML del issue #6. Cada una se corre de arriba hacia abajo y busca los archivos a partir de la raíz del repo.

**Antes de empezar un punto, leé:**

1. [`CLAUDE.md`](CLAUDE.md): reglas comunes (estructura de la notebook, datos, validación, salidas, Git). También lo lee Claude automáticamente al trabajar en esta carpeta.
2. [`PUNTO2.md`](PUNTO2.md): el punto que sirve de ejemplo para todos.
3. [`PLANTILLA_PUNTO.md`](PLANTILLA_PUNTO.md): copiala como `PUNTON.md` para documentar tu punto.

## Puntos

| # | Notebook | Explicación | Qué hace | Estado |
|---|---|---|---|---|
| 1 | `punto1_sectores.ipynb` | `PUNTO1.md` | Divide el lote en sectores (k-means sobre NDVI, suelo y pendiente) | Sin empezar. Falta definir quién baja HLS 30 m |
| 2 | [`punto2_vigor.ipynb`](punto2_vigor.ipynb) | [`PUNTO2.md`](PUNTO2.md) | Vigor esperado por cultivo, con banda de riesgo (Monte Carlo) | Parte A (práctica) anda. Parte B espera NDVI, clima y suelo |
| 3 | dentro de `punto2_vigor.ipynb` | [`PUNTO2.md`](PUNTO2.md) | El "por qué" de la recomendación (SHAP) | Espera el modelo del punto 2 |
| 4 | `punto4_anomalias.ipynb` | `PUNTO4.md` | Años que rindieron distinto de lo esperado | Si sobra tiempo |
| 5 | `punto5_vecinos.ipynb` | `PUNTO5.md` | Lugares parecidos que sí sembraron ese cultivo (kNN) | Si sobra tiempo |

## Entradas

- `cdl_puntos.csv` (raíz del repo): historial de cultivos por punto, 2017–2025. Detalles en `ML_NOTAS_CDL.md`.
- NDVI (MODIS), clima (POWER) y suelo (SSURGO) por `point_id`: los trae Diego.

## Salidas

- `data/ml/puntoN_<tema>.csv`: tablas para la app.
- `modelos/puntoN_<tema>.joblib`: modelos entrenados. No se suben a Git: se regeneran corriendo la notebook.
- `docs/ml/model_card_puntoN.md`: datos, métricas contra el baseline y limitaciones.
