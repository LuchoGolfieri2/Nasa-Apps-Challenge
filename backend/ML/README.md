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
| 4 | [`punto4_anomalias.ipynb`](punto4_anomalias.ipynb) | [`PUNTO4.md`](PUNTO4.md) | Años que rindieron distinto de lo esperado, con su causa más probable | Corrida con la v1.2 (maíz y soja). Reconoce 2012 y 2019. Salida para el front en `backend/Datos/front/anomalias.json` |
| 5 | [`punto5_vecinos.ipynb`](punto5_vecinos.ipynb) | [`PUNTO5.md`](PUNTO5.md) | Condados gemelos por suelo y clima que sí hicieron cada opción (kNN), con su rango de rinde | Corrida con la v1.3 y lluvia IMERG. Le gana a los vecinos del mapa en las 6 opciones. Salida en `backend/Datos/gemelos*.csv` y `backend/Datos/front/gemelos.json` (formato de `web/src/next/types.ts`) |
| 6 | [`punto6_cultivo_temporada.ipynb`](punto6_cultivo_temporada.ipynb) | [`PUNTO6.md`](PUNTO6.md) | Qué está sembrado este año (maíz o soja) antes del mapa del USDA, con Landsat y Sentinel-2 por píxel | Corrida con la v1.3 (`lotes/`, 10 lotes). Desde el 15 de julio le gana a la regla de rotación (99 % contra 95 % por lote) y detecta los 5 años sin rotar. Salida en `backend/Datos/cultivo_temporada*.csv` y `backend/Datos/front/cultivo_temporada.json`. Falta acordar dónde lo muestra el front |

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

## Avisos para el front (revisión del 2026-11-14)

Revisión de los puntos 2, 3 y 4 contra lo que el front ya tiene (`scripts/build_front_data.py`, `web/src/next/types.ts`, `docs/specs/front-back-connection-spec.md`). El punto 5 (gemelos) no se revisó acá: lo tiene su autor.

### Ya arreglado del lado de ML

- `backend/Datos/front/explicaciones.json` pasó a `version_contrato: "0.2"`, igual que `INFO.md`. También se cambió en `punto3_explicaciones.ipynb`.
- Nuevo `backend/Datos/front/anomalias.json` (punto 4, paso 9) con el formato acordado: `counties[fips][corn|soy][anio]` → rinde, rinde de un año normal (`usual_bu_ac`), `vs_usual` (`above` / `similar` / `below`), causa y `headline`. El titular depende de si el año fue mejor o peor (un julio fresco es "Mild July", no "Hot July"). Columnas en `PUNTO4.md`.
- La regla "la app sugiere, los textos no recomiendan" quedó escrita en `INFO.md` (regla 5 y cambios del contrato), `CLAUDE.md` y `PUNTO2.md`.

### Lo que tiene que hacer el front

| # | Qué | Dónde | Detalle |
|---|---|---|---|
| 1 | Leer `anomalias.json` | `scripts/build_front_data.py` | Hoy pone `vs_usual: None` ("lo habitual lo define ML"): ya está definido, sacarlo de `anomalias.json`. El `headline` va como una frase más del titular del año, con `source`. Años sin dato (2024, 2025 y los condados fuera del modelo) → `null` = "Missing data". |
| 2 | No contradecir las etiquetas de clima | `rinde_y_clima()` | El script pone "Hot July" / "Dry July" si julio se aleja 1 desvío de la media. Nuestro `headline` explica el **rinde**. Las dos cosas pueden no coincidir: por ejemplo, Story 2020 no tiene etiqueta de clima y su maíz rindió 28 % menos con `Not explained by weather data` (el derecho del 10/8). Mostrarlas como dos datos distintos (clima del año y por qué rindió distinto), no como una sola frase. |
| 3 | Condado de demo | `CONDADO_DEMO = "20191"` y `meta.json` | Sumner (KS) no está en el modelo: la entrega v1.2 trae Iowa, Illinois e **Indiana**. Para el video, Story (`19169`). Sumner: historia con CDL real y Next season en "Missing data". `next/20191.json` es de prueba (`prototype: true`) y no puede ir al video. |
| 4 | Armar `next/<fips>.json` | script nuevo del front | Las opciones son `actual` / `rotado` / `continuo`, por cultivo (`maiz` → `corn`, `soja` → `soy`). Rango: `escenarios_rotacion_resumen.csv` (`p10_clima`, `mediana_clima`, `p90_clima`). `usual_bu_ac` = `mediana_clima` de `actual`. Razones: `explicaciones.json` (`benefits` → `pro: true`, `risks` → `pro: false`, `basis: "model"` → `kind: "model"`, `source_label` es el texto de la fuente). `priority` de cada razón no viene: lo asigna el front. |
| 5 | Puntaje de riesgo | `scores.risk` | Con p10 ordena **igual que el rinde**: el rango de las tres opciones tiene el mismo ancho, solo se corre. Resultado: `rotado` gana en riesgo, rinde y suelo, y se sugiere casi siempre. Es lo que dicen los datos, pero que no parezca que las prioridades cambian la sugerencia cuando no la cambian. Ingreso y agua: "Missing data". |
| 6 | Un solo número por año | pantalla 3 | El `range_driver` de `explicaciones.json` dice "−39 (2012)" para Story; la historia (punto 4) dice −38. Se acordó que la pantalla 3 no repite el número del año: no mostrar los bu/ac del `range_driver` ahí, o avisarnos para sacarlos. |
| 7 | 2012 no está en el rewind | `meta.json` (años 2015–2025) | El año más conocido (sequía de 2012: Story −12 %, 93 % de los condados de maíz por debajo) queda fuera de la línea de tiempo. `anomalias.json` trae 2009–2023 por si quieren arrancar antes o mencionarlo en el video. Decisión del front. |
| 8 | Eje de las barras | `web/src/next/README.md` | Las tres opciones son del mismo cultivo, así que bu/acre es comparable (lo que pedía la spec). El % de un año habitual también funciona con `usual_bu_ac`. Decisión del front. |

### Pendiente del lado de ML (no bloquea al front)

- Sumar 2024 y 2025 solo cuando se abra la prueba final del punto 2 (`MIRAR_PRUEBA`). Hasta entonces, "Missing data".
- Kansas: no está en la entrega. Sumarlo implica pedirlo al pipeline y reentrenar los puntos 2 a 4.
- Predicciones fuera del fold para el punto 4 (ver `PUNTO4.md`).
