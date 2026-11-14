# CLAUDE.md — Notebooks de ML (`notebooks/ml/`)

Guía para cualquier persona o agente que trabaje en esta carpeta. Vale para todos los puntos de ML del issue #6. **El modelo a seguir es el punto 2:** [`punto2_vigor.ipynb`](punto2_vigor.ipynb) y [`PUNTO2.md`](PUNTO2.md). Ante una duda de forma, hacé lo mismo que ahí.

El `CLAUDE.md` de la raíz dice que el repo no entrena modelos: eso vale para el pipeline de datos (`src/`, `data/`). Las notebooks de ML viven acá, en esta carpeta, con estas reglas.

---

## 1. Los puntos

| # | Notebook | Qué le muestra al productor | Técnica | Usa |
|---|---|---|---|---|
| 1 | `punto1_sectores.ipynb` | Su lote dividido en sectores (loma seca, bajo húmedo…) | k-means sobre NDVI, suelo y pendiente | HLS 30 m, SSURGO, SRTM |
| 2 | `punto2_vigor.ipynb` | Vigor esperado por cultivo, con banda de riesgo | LightGBM + Monte Carlo de climas | `cdl_puntos.csv`, NDVI, POWER, SSURGO |
| 3 | dentro de `punto2_vigor.ipynb` | El "por qué" de la recomendación | SHAP + frases con plantillas fijas | Modelo del punto 2 |
| 4 | `punto4_anomalias.ipynb` | "Ese año rindió menos de lo esperado: fue seco" | Real contra esperado por el modelo del punto 2 | Modelo del punto 2 + clima |
| 5 | `punto5_vecinos.ipynb` | Lugares parecidos que sí sembraron ese cultivo | kNN por suelo, clima e historial | `cdl_puntos.csv` + suelo y clima |
| 6 | — | Cultivo de la temporada en curso | Clasificación con Sentinel-2 | Solo para el pitch, no se hace |

Prioridad (comentario de Lucho en el issue #6): #1 imprescindible; #2 y #3 muy recomendables; #4 y #5 si sobra tiempo.

---

## 2. Archivos de cada punto

Cada punto N tiene exactamente dos archivos en esta carpeta:

- `puntoN_<tema>.ipynb`: la notebook. `<tema>` en minúsculas, una palabra (`sectores`, `vigor`, `anomalias`, `vecinos`).
- `PUNTON.md`: la explicación, copiando la estructura de [`PLANTILLA_PUNTO.md`](PLANTILLA_PUNTO.md).

Al crear o terminar un punto, actualizá su fila en [`README.md`](README.md).

---

## 3. Estructura de la notebook

Mismo orden que el punto 2:

1. **Celda de título (markdown):** `# Field Shift · Punto N: <qué hace>`, con:
   - **Objetivo final:** qué ve el productor, en una o dos frases.
   - **Problema:** qué dato falta todavía, si falta.
   - Partes de la notebook (qué corre hoy y qué está en espera).
   - Cómo usarla: correr de arriba hacia abajo.
2. **`## 0. Instalar y cargar librerías`:** qué es cada librería, en una línea. Si una librería puede faltar, `try/except ImportError` con un plan B (como LightGBM → scikit-learn en el punto 2).
3. **`## 1. Cargar los datos`:** rutas a partir de la raíz del repo (sección 4).
4. **`## 2. Mirar los datos antes de modelar`.**
5. **`## 3. Preparar las variables`.**
6. **`## 4. Split`** (si el punto entrena algo).
7. **Partes con `# Parte A · …`, `# Parte B · …`** si hay una parte que corre hoy y otra que espera datos.
8. **Cierre: `## Próximos pasos`** como checklist (`- [ ]`).

Reglas de forma:

- **Cada celda de código tiene antes una celda markdown** que explica en criollo qué hace y por qué. El equipo no es experto en ML: explicá los términos la primera vez (como "entrenar", "baseline", "MAE" en el punto 2).
- Pasos numerados `## N. Título`, en orden, sin saltos.
- Todo en español: textos, nombres de variables y comentarios. Constantes en mayúsculas (`RUTA_CSV`, `FEATURES_B`, `CANDIDATOS_POR_REGION`); funciones con verbos (`recomendar`, `simular_escenarios`, `unir`).
- **La notebook corre de punta a punta aunque falten datos.** Las rutas que todavía no existen quedan en `None` y las celdas que dependen de ellas imprimen "queda en espera" en vez de fallar (ver `HAY_TARGET` y `modelo_b is not None` en el punto 2).
- Antes de dar por terminado un cambio: **Kernel → Restart & Run All** sin errores.

---

## 4. Datos

- **Rutas desde la raíz del repo**, nunca relativas a la notebook:

  ```python
  from pathlib import Path
  RAIZ = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / ".git").exists())
  RUTA_CSV = RAIZ / "cdl_puntos.csv"
  ```

- Todas las rutas y listas de columnas de entrada van **juntas en una celda, arriba de la parte que las usa** (como el paso 9 del punto 2).
- Leé los IDs como texto: `dtype={"region": str, "point_id": str}`. Si no, se pierden ceros a la izquierda.
- **No modifiques los archivos de entrada** (`cdl_puntos.csv`, `data/raw/`, `data/processed/`). Toda transformación queda en memoria o en `data/ml/`.
- **No inventes datos.** Si un archivo no llegó, la celda queda en espera. Los datos inventados solo se usan para probar el código, nunca se guardan ni se presentan como resultados.
- Para unir archivos usá la función `unir()` del punto 2: trae solo las columnas pedidas y corta con error si hay claves repetidas.

  ```python
  def unir(base, ruta, claves, columnas):
      nuevo = pd.read_csv(ruta, dtype={"point_id": str}, usecols=claves + columnas)
      return base.merge(nuevo, on=claves, how="left", validate="many_to_one")
  ```

- Claves de unión: `point_id` + `year`. Suelo y otros datos fijos: solo `point_id`.
- Constantes compartidas: usá **los mismos valores** que el punto 2 para `NOMBRES_REGION`, `CLASES_RARAS` y `CANDIDATOS_POR_REGION`. Si cambian en un punto, cambialas en todos.

---

## 5. Validación (si el punto entrena o evalúa un modelo)

- **Split por años, nunca filas al azar:** train 2017–2023, validación 2024, test 2025. Cada punto aparece 9 veces; si se mezclan filas, el modelo reconoce el campo.
- **Baseline obligatorio:** una regla simple que el modelo tiene que superar, en la misma tabla que el modelo. Si no le gana, no aporta.
- **Métricas por región** (McLean, Story, Sumner) más una fila `TOTAL`.
- **Test 2025 apagado** con `MIRAR_TEST = False`. Se prende una sola vez, al final.
- **Sin fugas:** como entrada, solo datos de antes de la siembra. El NDVI y la ET de la temporada son resultado, nunca entrada.
- Chequeos agronómicos de la sección 6 de [`ML_NOTAS_CDL.md`](../../ML_NOTAS_CDL.md) cuando apliquen.
- Lo que no entrena (k-means del #1, kNN del #5) igual se revisa: que los sectores o vecinos tengan sentido mirando suelo, NDVI y mapa, y anotarlo en `PUNTON.md`.

---

## 6. Salidas

| Qué | Dónde | Nombre | En Git |
|---|---|---|---|
| Tablas para la app | `data/ml/` | `puntoN_<tema>.csv` | Sí |
| Modelos entrenados | `modelos/` (raíz) | `puntoN_<tema>.joblib` | No (está en `.gitignore`) |
| Ficha del modelo | `docs/ml/` | `model_card_puntoN.md` | Sí |

- CSV: UTF-8, separador `,`, decimal `.`. Las claves van primero (`point_id`, después `cultivo` o `year` si corresponde), y los faltantes quedan como celda vacía.
- Crear la carpeta antes de guardar: `(RAIZ / "data/ml").mkdir(parents=True, exist_ok=True)`.
- Los puntos que usan el modelo del #2 (el #3 y el #4) **lo cargan** de `modelos/punto2_vigor.joblib`. No lo reentrenan.
- Salida del punto 2 para la app: `point_id, cultivo, media, p10, p90`. Si otro punto necesita un formato distinto, documentalo en su `PUNTON.md` y avisá al equipo del front.

---

## 7. Git

- `main` está protegido. Cada punto en su rama `ml/puntoN`, con un pull request para que lo revise otra persona.
- Antes de crear la rama: `git pull` en `main`.
- Commits chicos, en español, que digan qué cambió.
- **No subas** modelos (`.joblib`), `.env` ni datos crudos pesados.
- Dos personas no editan la misma notebook a la vez: Git no sabe mezclar cambios de `.ipynb`.

---

## 8. Para agentes (Claude)

- Leé este archivo, [`PUNTO2.md`](PUNTO2.md) y [`ML_NOTAS_CDL.md`](../../ML_NOTAS_CDL.md) antes de empezar.
- Trabajá solo en los archivos de tu punto. Para tocar otra notebook, la función `unir()` o las constantes compartidas, preguntá antes.
- Para editar una notebook, modificá el JSON por celdas (o con NotebookEdit) y después corré la notebook entera para verificar.
- No hagas commit, push ni pull request sin que la persona lo pida.
- Explicá en lenguaje simple: quien te pide las cosas puede no saber ML.
