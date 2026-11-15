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
| 3 | [`punto3_explicaciones.ipynb`](punto3_explicaciones.ipynb) | [`PUNTO3.md`](PUNTO3.md) | El "por qué" de los números, en frases simples (SHAP por grupo + efecto de rotar), con `benefits`, `risks` y confianza por opción | Corrida con la v1.2: 293 condados, 6 chequeos OK. Salida en `backend/Datos/explicaciones.csv` y `backend/Datos/front/explicaciones.json` |
| 4 | [`punto4_anomalias.ipynb`](punto4_anomalias.ipynb) | [`PUNTO4.md`](PUNTO4.md) | Años que rindieron distinto de lo esperado, con su causa más probable | Corrida con la v1.2 (maíz y soja). Reconoce 2012 y 2019. Falta acordar el formato con el front |
| 5 | [`punto5_vecinos.ipynb`](punto5_vecinos.ipynb) | [`PUNTO5.md`](PUNTO5.md) | Condados gemelos por suelo y clima que sí hicieron cada opción (kNN), con su rango de rinde | Corrida con la v1.3 y lluvia IMERG. Le gana a los vecinos del mapa en las 6 opciones. Salida en `backend/Datos/gemelos*.csv` y `backend/Datos/front/gemelos.json` (formato de `web/src/next/types.ts`) |

## Entradas

- `backend/Datos/entregas/fieldshift_datos_vX/` (fuera de Git): las entregas del pipeline de datos. Llegan como `fieldshift_datos_vX.zip`; descomprimilas en `backend/Datos/entregas/` para que quede, por ejemplo, `backend/Datos/entregas/fieldshift_datos_v1.3/condado/tabla_anual.csv`. `condado/` es para los puntos 2 a 5 y `lotes/` para el punto 1.
- **Si ya tenías las entregas en `data/`** (antes de que ML se mudara a `backend/`), movelas una vez desde la raíz del repo: `mkdir -p backend/Datos/entregas && mv data/fieldshift_datos_v* backend/Datos/entregas/`.

## Carpetas

| Carpeta | Qué va |
|---|---|
| `backend/ML/` | Las notebooks, sus `PUNTON.md`, este README y el `CLAUDE.md` de ML |
| `backend/ML/modelos/` | Modelos entrenados (`.joblib`). No van a Git |
| `backend/Datos/` | Todos los CSV que generan las notebooks |
| `backend/Datos/front/` | Los JSON que lee el front |
| `backend/Datos/entregas/` | Las entregas del pipeline de datos. No van a Git |

## Salidas

- `backend/Datos/`: `folds.csv`, `experimentos.csv`, `tabla_modelado.csv`, `efecto_rotacion.csv`, `escenarios_rotacion*.csv` (punto 2), `explicaciones*.csv` (punto 3), `anomalias_anio.csv` (punto 4), `gemelos*.csv` (punto 5) y, para el front, `backend/Datos/front/`.
- `backend/ML/modelos/`: modelos entrenados (`.joblib`). No se suben a Git: se regeneran corriendo la notebook.
- `docs/ml/`: `model_card.md` y `pedidos_datos.md`.
