# Notebooks de ML — Field Shift

Una notebook por cada uso de ML del issue #6. Cada una se corre de arriba hacia abajo y busca los archivos a partir de la raíz del repo.

**Antes de empezar un punto, leé:**

1. [`CLAUDE.md`](CLAUDE.md): reglas de modelado del equipo (datos, validación, fugas, modelos A y B) y la forma de las notebooks. Claude lo lee solo al trabajar en esta carpeta.
2. [`PUNTO2.md`](PUNTO2.md): el punto que sirve de ejemplo para todos.
3. [`PLANTILLA_PUNTO.md`](PLANTILLA_PUNTO.md): copiala como `PUNTON.md` para documentar tu punto.
4. `INFO.md` (raíz del repo): qué muestra el front y en qué formato lo espera.

## Puntos

| # | Notebook | Explicación | Qué hace | Estado |
|---|---|---|---|---|
| 1 | `punto1_sectores.ipynb` | `PUNTO1.md` | Divide el lote en sectores con vigor relativo (k-means sobre HLS/Landsat, NASADEM y SSURGO) | Sin empezar |
| 2 | [`punto2_rotaciones.ipynb`](punto2_rotaciones.ipynb) | [`PUNTO2.md`](PUNTO2.md) | Rango de rinde del condado por rotación y clima (modelo B) | Corrida con la v1.2. Le gana a los baselines; efecto de la rotación con efectos fijos (maíz continuo −17 %), pasa el chequeo |
| 3 | [`punto3_explicaciones.ipynb`](punto3_explicaciones.ipynb) | [`PUNTO3.md`](PUNTO3.md) | El "por qué" de los números, en frases simples (SHAP por grupo + efecto de rotar), con `benefits`, `risks` y confianza por opción | Corrida con la v1.2: 293 condados, 6 chequeos OK. Salida en `data/ml/explicaciones.csv` y `data/ml/front/explicaciones.json` |
| 4 | [`punto4_anomalias.ipynb`](punto4_anomalias.ipynb) | [`PUNTO4.md`](PUNTO4.md) | Años que rindieron distinto de lo esperado, con su causa más probable | Corrida con la v1.2 (maíz y soja). Reconoce 2012 y 2019. Falta acordar el formato con el front |
| 5 | `punto5_vecinos.ipynb` | `PUNTO5.md` | Condados o lotes parecidos que sí hicieron esa rotación (kNN) | Si sobra tiempo |

## Entradas

- `data/fieldshift_datos_v1.2/` (raíz del repo, fuera de Git): la entrega del pipeline de datos. Llega como `fieldshift_datos_v1.2.zip`; descomprimilo en `data/` para que quede `data/fieldshift_datos_v1.2/condado/tabla_anual.csv`. `condado/` es para los puntos 2 a 5 y `lotes/` para el punto 1.

## Salidas

- `data/ml/`: `folds.csv`, `experimentos.csv`, `tabla_modelado.csv`, `efecto_rotacion.csv`, `escenarios_rotacion*.csv` (punto 2), `explicaciones*.csv` (punto 3), `anomalias_anio.csv` (punto 4) y, para el front, `data/ml/front/`.
- `modelos/`: modelos entrenados (`.joblib`). No se suben a Git: se regeneran corriendo la notebook.
- `docs/ml/`: `model_card.md` y `pedidos_datos.md`.
