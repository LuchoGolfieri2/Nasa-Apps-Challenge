# CLAUDE.md — Field Shift: modelado (ML)

Proyecto del equipo para NASA Space Apps Challenge 2026, desafío **"Field Shift: Adapting Farms
with NASA Data"**. La herramienta final ayuda a productores del **Corn Belt de EE.UU.** a comparar
rotaciones de cultivos con datos de la NASA.

**Esta carpeta (`backend/ML/`) es la del modelado.** Los datos los arma otro repo (`ResearchAgent`)
y llegan como entregas versionadas a `backend/Datos/entregas/fieldshift_datos_vX/` (hoy, la v1.2). Se reciben como .zip y se descomprimen ahí; no van a Git. Acá no
se bajan ni se limpian datos: se modelan. El `CLAUDE.md` de la raíz (pipeline de datos, "este repo
no entrena modelos") no aplica a esta carpeta.

El modelo no decide qué rotación usar. Estima cómo el clima, el suelo y el cultivo antecesor
afectan el rendimiento y el riesgo, para que la comparación de rotaciones tenga evidencia y rangos
de incertidumbre. Desde el 14/11 la app marca una opción como "Suggested for your priorities"
según las prioridades del productor (con los `scores` que arma el front), pero el productor decide
y nuestras frases nunca dicen "recommended" ni "you should".

Basado en el CLAUDE.md de ML del equipo, con las rutas adaptadas a este repo (sección 7).
**La notebook modelo es [`punto2_rotaciones.ipynb`](punto2_rotaciones.ipynb), explicada en
[`PUNTO2.md`](PUNTO2.md).** Ante una duda de forma, hacé lo mismo que ahí.

---

## 1. Reglas

1. **No inventes datos.** No rellenes faltantes con valores supuestos. Si algo falta o se ve mal,
   anotalo en `docs/ml/pedidos_datos.md` y avisá al humano. Los datos inventados solo sirven para
   probar código en una carpeta temporal: nunca se guardan en el repo ni se presentan como resultados.
2. **`backend/Datos/entregas/fieldshift_datos_v1.2/` (y cualquier entrega) es de solo lectura** y no va a Git. Lo que derives va a `backend/Datos/`.
3. **Nunca uses un split aleatorio.** Siempre se separa por años (sección 4).
4. **Todo lo que aprende de los datos va dentro del fold**, en un `Pipeline` o en una función que
   recibe solo el train del fold: la tendencia del rendimiento, las anomalías y z-scores, la
   imputación, el escalado y la selección de features.
5. **Reproducible.** Semillas fijas y folds guardados en `backend/Datos/folds.csv`. Cada corrida suma una
   fila a `backend/Datos/experimentos.csv`: fecha, target, modelo, features, folds y métricas.
6. **No toques el repo `ResearchAgent`.** Ahí corre un agente autónomo que revierte los cambios
   ajenos. Los pedidos de datos van por el humano.
7. **Preguntá al humano antes de:**
   - cambiar el target o el esquema de validación ya acordado;
   - usar datos que no vengan en la entrega;
   - publicar resultados.
8. **Python 3.11** (también anda con 3.10). Librerías base: pandas, numpy, scikit-learn, lightgbm,
   statsmodels, shap, matplotlib (mapie si hace falta). En Windows: `uv venv --python 3.11` y correr
   con `python -X utf8`.
9. **Skills:** usá `field-shift-ml` para el modelado y `field-shift-data-qa` si tenés que auditar
   un dato.
10. **Instrucciones viejas:** si ves instrucciones o fuentes argentinas (MAGyP, INTA, `id_depto`,
    `campania`), están desactualizadas. La zona es el Corn Belt.

---

## 2. Qué se hizo hasta ahora (lado datos)

- **Pipeline:** está en el repo `ResearchAgent`. Un agente autónomo arma paquetes de datos por
  rondas, con checks que él no puede tocar. Paquetes listos:
  - `clima`: NASA POWER e IMERG.
  - `cultivos`: USDA NASS Quick Stats y Cropland Data Layer (CDL).
  - `vegetacion`: MODIS.
  - `agua`: SMAP L4 y GRACE-DA-DM.
  - `suelo_terreno`: SSURGO y NASADEM.

  `src/merge.py` los une en `tabla_anual.csv` y `tabla_mensual.csv`.
- **2026-11-14, entregas v1 y v1.1:** la v1 se congeló para ML y la v1.1 la reemplaza el mismo
  día. La v1.1 cambia solo el denominador de las cuatro transiciones de rotación
  (`pct_maiz_tras_soja`, `pct_maiz_tras_maiz`, `pct_soja_tras_maiz`, `pct_soja_tras_soja`).
  - Ahora cuentan solo los píxeles que el año anterior eran agrícolas.
  - El cambio corrige un sesgo de 2024–2025: ese año el CDL pasó de 30 m a 10 m.
  - Las cuatro columnas suben 0,7–2,8 puntos en promedio en 2009–2023, y más en 2024–2025. **No
    mezcles columnas de la v1 con las de la v1.1.**
- **Lo que viene en la v2** (el pipeline lo está armando):
  - precios y costos (NASS, USDA ERS);
  - aptitud de cultivos (FAO GAEZ);
  - cobertura del suelo (NLCD);
  - suelo desnudo y cobertura invernal a 30 m (Landsat, Sentinel-2);
  - validación de lluvia y temperatura (PRISM, CoCoRaHS);
  - ECOSTRESS, NLDAS;
  - napa y caudales (USGS).

  Cada entrega nueva va en su propia carpeta (`backend/Datos/entregas/fieldshift_datos_v2/`), al lado de la anterior.
- **Guía para humanos:** https://claude.ai/artifact/TyDqsds1bv69BsciWoXam4. Tiene el mismo
  diccionario, con filtros.

---

## 3. Los datos: `backend/Datos/entregas/fieldshift_datos_v1.2/`

La v1.2 trae dos carpetas: `condado/` (lo de abajo, para los modelos de rinde) y `lotes/` (píxeles de 30 m de 10 lotes, para el punto 1). Leé primero `GUIA.md`, después `condado/LEEME.md`, `condado/diccionario.csv` y, para el detalle de cada fuente, `condado/data_cards/`. Las tablas del condado son idénticas a las de la v1.1; la v1.2 solo suma `extras/teledeteccion_anual.csv`.

- **Cobertura:** 293 condados de Iowa (FIPS 19), Illinois (17) e Indiana (18), de 2000 a 2025.
- **Formato:**
  - UTF-8, separador `,`, decimal `.`.
  - **Celda vacía = faltante.** Nunca 0, −999 ni −9999.
  - `fips` se lee como texto: 5 dígitos, los 2 primeros son el estado.

| Archivo | Filas | Claves | Qué tiene |
|---|---:|---|---|
| `tabla_anual.csv` | 25.070 | `fips, anio, cultivo` | Rendimiento (target), clima del año, rotación, fenología, suelo y terreno. 73 columnas. |
| `tabla_mensual.csv` | 91.416 | `fips, anio, mes` | Clima, vegetación y humedad del suelo por mes. 48 columnas. |
| `extras/clima_diario.csv` | 2.782.621 | `fips, anio, fecha` | Clima diario (240 MB). |
| `extras/vegetacion_16d.csv` | 171.112 | `fips, anio, fecha` | NDVI y EVI cada 16 días. |
| `extras/agua_diario.csv` · `agua_semanal.csv` | | `fips, anio, fecha` | SMAP diario (desde abril de 2015) y percentiles de GRACE-DA-DM (desde 2003). |
| `extras/rotacion_secuencia.csv` | 3.223 | `fips, ventana` | Secuencias de 8 años del CDL (ventanas 2008–2015 a 2018–2025). |
| `extras/practicas_censo.csv` | 879 | `fips, anio_censo` | Cobertura, labranza cero, drenaje con caños y riego (censos 2012, 2017, 2022). |
| `referencia/condados.csv`, `anios.csv` | | | Condados (centroide, área) y ventanas de cada año. |

**Target y claves**

- `anio` es el año de la cosecha. En la tabla mensual es el año calendario del mes, así que el
  invierno previo (noviembre a marzo) del cultivo `t` cae en los meses 11–12 de `t − 1` y 1–3 de `t`.
- **Target:** `rend_bu_ac`, rendimiento por condado de NASS en bushels por acre. `rend_kgha` es el
  mismo dato en kg/ha: usá uno solo.
- **Filas con rendimiento:** maíz 7.029, soja 7.015, trigo de invierno 3.396 y avena 1.564.
  Alfalfa y heno no tienen rendimiento (NASS los da en toneladas).
- 2024 y 2025 tienen menos condados: unos 205 con maíz por año, contra 235–283 en 2018–2023.
- La tendencia del rendimiento **no** está removida. Se saca dentro de cada fold.

**El diccionario**

`diccionario.csv` tiene una fila por `archivo` y `columna`, y marca cada una con:

- `rol`: `clave`, `target`, `entrada`, `no_usar`, `metadato` o `vacia`.
- `momento`: cuándo se conoce el dato.

| `momento` | Se conoce |
|---|---|
| `fijo` | siempre (suelo y terreno) |
| `antes_de_sembrar` | al 1 de abril (invierno previo) |
| `temporada` | al cerrar el mes al que se refiere, entre abril y septiembre |
| `fin_de_temporada` | al terminar la temporada |
| `post_cosecha` | después de la cosecha (el CDL y los datos de condado de NASS salen a principios del año siguiente) |
| `año_completo` | al 31 de diciembre |
| `mensual`, `diario`, `16_dias`, `semanal` | al cerrar ese período |

```python
import pandas as pd
from pathlib import Path

RAIZ = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / ".git").exists())
D = RAIZ / "backend/Datos/entregas/fieldshift_datos_v1.2/condado"
anual = pd.read_csv(D / "tabla_anual.csv", dtype={"fips": str})
mensual = pd.read_csv(D / "tabla_mensual.csv", dtype={"fips": str})
dic = pd.read_csv(D / "diccionario.csv")

# meses de la temporada como columnas (ej. tmax_c_07); usar solo los meses que se conocen
# en el momento de la predicción
mensual["m"] = mensual["mes"].str[5:7].astype(int)
cols = ["prec_power_mm", "tmax_c", "deficit_mm", "dias_tmax_gt30"]
piv = mensual[mensual["m"].between(4, 9)].pivot_table(index=["fips", "anio"], columns="m", values=cols)
piv.columns = [f"{c}_{m:02d}" for c, m in piv.columns]
maiz = anual[(anual["cultivo"] == "maiz") & anual["rend_bu_ac"].notna()]
maiz = maiz.merge(piv.reset_index(), on=["fips", "anio"], how="left")
```

---

## 4. Validación y fugas (lo más importante)

**Pocos años, no pocas filas.** Hay miles de filas por cultivo, pero solo unos 25 años. Los
condados de un mismo año comparten el clima: no son independientes.

**Esquema recomendado**

- **Desarrollo con 2000–2023:**
  - dejar un año afuera (`LeaveOneGroupOut` con grupo `anio`), o `GroupKFold` por año;
  - además, dejar un estado entero afuera (`fips[:2]`) para ver si generaliza a zonas nuevas.
- **Prueba final con 2024–2025:** no se toca hasta el final y se reporta aparte. Esos años tienen
  menos condados y otro CDL (10 m). En las notebooks queda apagada con `MIRAR_PRUEBA = False`.
- **Hiperparámetros:** con validación anidada o con un bloque de años reservado dentro del
  desarrollo, nunca con los años de prueba.
- **Métricas:** MAE y RMSE en bu/ac y R², **por fold y por estado**, no solo el promedio.

**Columnas que no van como entrada**

- **No usar:** `produccion_bu`, `sup_cosechada_ac`, `ratio_cosechada`. Salen del resultado de la
  cosecha.
- **Rendimiento:** usá `rend_bu_ac` o `rend_kgha`, nunca los dos.
- **Columnas que miran el futuro:** recalculalas dentro del fold con las variables crudas, o no
  las uses.

| Columna | Referencia que usa | Variable cruda |
|---|---|---|
| `ndvi_anom_z`, `vci`, `tci`, `vhi` | 2000–2025 | `ndvi`, `lst_dia_c` |
| `sm_rootzone_anom_z` | 2015–2025 | `sm_rootzone_m3m3` |
| `spi1`, `spi3`, `spi6` | ajustados con 1981–2025 | `prec_power_mm` |
| `anom_tmed_c` | base fija 1991–2020 (incluye los años que quedan afuera en los folds) | `tmed_c` |
| `tend_prec_mm_decada`, `tend_tmed_c_decada` | el año en curso completo | — |

**Dos modelos distintos: no los mezcles**

| | A. Pronóstico en temporada | B. Escenarios de rotación (el que usa la herramienta) |
|---|---|---|
| Pregunta | ¿Cuánto va a rendir este año, con lo que se sabe en julio? | ¿Cómo cambia el rendimiento con la rotación, para cada clima histórico? |
| Entradas | Solo lo que se conoce en ese `momento`. Para julio: `fijo`, `antes_de_sembrar` y la tabla mensual hasta junio. | Solo lo que un escenario puede fijar: clima (cada año histórico es un escenario), suelo, rotación y tendencia. |
| Rotación | La del año es `post_cosecha`: usá la del año anterior o la ventana de `rotacion_secuencia.csv` que termina en `t − 1`. | El antecesor es una decisión que se conoce al sembrar, así que `pct_maiz_tras_soja` del mismo año es una entrada válida. |
| Vegetación | Sirve (NDVI de los meses ya cerrados). | **Sin NDVI ni EVI del año:** son consecuencia del cultivo y del clima, y en un escenario no existen. |

- Escribí en `docs/ml/model_card.md` cuál de los dos estás haciendo.
- `sup_sembrada_ac` también es `post_cosecha` por condado, aunque la decisión se conoce en
  primavera. En el modelo A usá la del año anterior.
- **Tendencia tecnológica:** el rendimiento sube año a año. Ajustá la tendencia (por condado o por
  estado) **solo con los años de entrenamiento del fold**, modelá la anomalía y sumá la tendencia
  al predecir.

---

## 5. Primer objetivo: modelo B (punto 2)

Maíz y soja por separado. Empezá por el modelo B al cierre de la temporada (todo abril–septiembre),
que es el que necesita la herramienta. Después, el A en julio. **Está implementado en
[`punto2_rotaciones.ipynb`](punto2_rotaciones.ipynb)**; los pasos de abajo son su guion.

1. **Tabla de modelado:** una fila por `fips × anio` con el target y las features, desde 2009 si
   usás las transiciones del CDL (2008 está vacío).
2. **Folds** (`backend/Datos/folds.csv`): por año y por estado, más el bloque de prueba 2024–2025.
3. **Baselines** que el modelo tiene que ganar, y el informe lo muestra:
   - media histórica del condado;
   - tendencia lineal del condado;
   - valor del año anterior.
4. **Modelos, en este orden:**
   1. Ridge o Lasso con 15–30 features.
   2. LightGBM poco profundo: `max_depth` 2–4, muchas muestras por hoja, early stopping dentro del
      fold.
   3. Si hay tiempo, un modelo mixto con efecto aleatorio por condado.

   Nada de deep learning.
5. **Features para arrancar**, elegidas por criterio agronómico. Sacá los pares con |r| > 0,9 y
   quedate con el más fácil de explicar.
   - **Floración del maíz (julio):** `prec_jul_mm`, `tmax_jul_c`, `dias_tmax_gt30_jul`; de la
     mensual, `dias_tmax_gt35` y `deficit_mm` de julio.
   - **Llenado de la soja (agosto):** `prec_ago_mm`; de la mensual, `tmax_c` y `deficit_mm` de
     agosto.
   - **Temporada:** `deficit_temporada_mm`, `prec_temporada_mm`, `gdd_temporada`.
   - **Exceso de agua en primavera**, que en el Corn Belt atrasa la siembra:
     - lluvia de abril y mayo (`prec_power_mm`, `dias_lluvia_gt50`);
     - `gwettop` y `gwetroot` de POWER (cubren todo el período);
     - `dias_sm_saturado`: solo desde 2015 y con umbral provisorio.
   - **Suelo:** `aws0_100_mm`, `nccpi_maiz` o `nccpi_soja`, `clase_drenaje`, `grupo_hidrologico`,
     `soc0_30_gm2`, `pendiente_media_pct`, `twi_medio`.
   - **Rotación:**
     - para maíz, `pct_maiz_tras_soja` y `pct_maiz_tras_maiz`;
     - para soja, `pct_soja_tras_maiz` y `pct_soja_tras_soja`;
     - de `practicas_censo.csv`, el último censo anterior o igual al año (2012 solo trae riego).
6. **Importancia:** por permutación, mirando si es estable entre folds. Una feature que sirve en un
   solo fold es ruido. Después, SHAP o dependencia parcial de las principales, cada hallazgo en una
   frase llana. Es una asociación, no una causa: decilo así.
7. **Incertidumbre:** regresión por cuantiles o conformal (MAPIE), calibrada dentro de la
   validación. Reportá la cobertura real: si el intervalo es del 80 %, ¿contiene al 80 % de los
   casos de prueba?
8. **Escenarios de rotación:** para cada rotación candidata, cambiá las features que la rotación
   modifica y evaluá con el clima de cada año histórico. Por rotación se reportan la mediana, el p10
   y el p90. Los beneficios de suelo (nitrógeno, carbono, erosión) no salen del modelo: son reglas,
   y la interfaz muestra qué parte es cada cosa.

**Entregables**

- `docs/ml/model_card.md`: datos, target, validación, métricas contra los baselines por fold,
  features, limitaciones y dónde no usarlo.
- `backend/Datos/escenarios_rotacion.csv` para el frontend: `fips, rotacion, cultivo, anio_clima, pred,
  p10, p90`. El front lo recibe como `backend/Datos/front/escenarios_rotacion.json` (contrato en
  `INFO.md`, sección 4.6).
- `backend/Datos/experimentos.csv`.

---

## 6. Problemas conocidos de los datos que pesan en el modelo

- **Clima de POWER:** viene del centroide del condado, en una grilla de ~0,5°. Condados vecinos
  comparten valores, así que hay menos información de la que parece. La lluvia IMERG
  (`prec_imerg_mm`) sí es el promedio del condado a 0,1°.
- **MODIS:** NDVI y EVI a ~927 m y LST a ~2 km, sin bandas de calidad. `ndvi_maiz` y `ndvi_soja`
  empiezan en 2008, con ~16 % de vacías.
- **Cobertura parcial:**
  - SMAP desde abril de 2015 (59 % de vacías en la mensual): o un modelo solo 2015+, o afuera;
  - GRACE-DA-DM desde 2003;
  - `et_mm`, `pet_mm` y `et_pet_ratio` están vacías.
- **Fenología de NASS (`doy_50_*`):** es por estado, igual para todos sus condados.
- **Maíz y silaje:** el rendimiento y la cosecha del maíz son de grano, y la siembra es para todos
  los usos. Por eso `ratio_cosechada` del maíz también baja por el silaje y no mide solo pérdidas.
  Si lo usás como target de riesgo, tenelo en cuenta.
- **Valores raros que son reales**, no se borran:
  - maíz de Marion, IL (17121) en 2012: 19 bu/ac, por la sequía;
  - `deficit_mm` de −99,99 en 18065 (julio de 2011);
  - en 280 condado-mes de invierno, `lst_noche_c` supera a `lst_dia_c`.
- **CDL de 10 m en 2024–2025:** los % de área de esos años pueden diferir algo de lo que daría un
  CDL de 30 m.
- **Ventanas fenológicas:** todavía no hay ventanas por cultivo. Hay mensual y ventanas fijas:
  temporada abril–septiembre, invierno previo noviembre–marzo, julio y agosto.
- **Sin QA formal por paquete:** todavía no existe `docs/qa/`. La entrega pasó `validar_csv`, los
  rangos y las reglas de coherencia del pipeline. Los únicos avisos son dos falsos positivos:
  Marion 2012 y el −99,99.

---

## 7. Dónde va cada cosa en este repo

```
backend/
  ML/                        # esta carpeta: notebooks, sus PUNTON.md y este CLAUDE.md
    modelos/                 # modelos entrenados (.joblib), no van a Git
  Datos/                     # todos los CSV de ML: folds.csv, experimentos.csv, escenarios_rotacion*.csv, gemelos*.csv…
    front/                   # archivos del contrato del front (INFO.md)
    entregas/
      fieldshift_datos_v1.3/ # entrega de datos (condado/ y lotes/): solo lectura, no va a Git
docs/ml/                     # model_card.md, pedidos_datos.md
```

- El `src/` del CLAUDE.md de ML original no existe acá: el código vive en las notebooks. Si una
  función se repite en dos notebooks, va a `backend/ML/comun.py` (preguntá antes de crearlo).
- **Rutas siempre desde la raíz del repo** con `RAIZ` (snippet de la sección 3), nunca relativas a
  la notebook.

### Los puntos del issue #6

| # | Notebook | Qué le muestra al productor | Técnica |
|---|---|---|---|
| 1 | `punto1_sectores.ipynb` | Su lote dividido en sectores, con vigor **relativo** por año (no rinde) | k-means sobre HLS/Landsat, NASADEM y SSURGO |
| 2 | [`punto2_rotaciones.ipynb`](punto2_rotaciones.ipynb) | Rango de rinde del condado por rotación y clima (modelo B) | Ridge / LightGBM sobre anomalías (clima y suelo) + efectos fijos (rotación) + escenarios |
| 3 | `punto3_explicaciones.ipynb` | El "por qué" de los números | SHAP del modelo del punto 2 (clima y suelo) + `efecto_rotacion.csv` (rotación), con frases de plantillas fijas. Arranque: `PUNTO2.md`, sección "Para el punto 3" |
| 4 | [`punto4_anomalias.ipynb`](punto4_anomalias.ipynb) | Años que rindieron distinto de lo esperado | Real contra un año normal según el modelo del punto 2; causa por grupos de clima (SHAP) |
| 5 | `punto5_vecinos.ipynb` | Condados o lotes parecidos que sí hicieron esa rotación | kNN por suelo, clima e historial |

Prioridad (comentario de Lucho en el issue #6): #1 imprescindible; #2 y #3 muy recomendables; #4 y
#5 si sobra tiempo. Qué ve el front de cada uno: `INFO.md` en la raíz.

---

## 8. Pedidos al equipo de datos

- **Cómo anotarlos:** en `docs/ml/pedidos_datos.md`, con archivo, columna, qué pasa, un ejemplo
  (`fips`, `anio`) y qué necesitarías. El humano lo pasa al pipeline.
- **Qué se hace acá:** solo transformaciones del modelado, como pivots, lags, o anomalías y
  tendencias dentro del fold. Los datos en sí no se arreglan en esta carpeta.

---

## 9. Forma de las notebooks

Cada punto N tiene dos archivos acá: `puntoN_<tema>.ipynb` y `PUNTON.md` (copiando
[`PLANTILLA_PUNTO.md`](PLANTILLA_PUNTO.md)). Al crear o terminar uno, actualizá su fila en
[`README.md`](README.md).

Orden de la notebook, igual que el punto 2:

1. **Celda de título (markdown):** `# Field Shift · Punto N: <qué hace>`, con el objetivo, qué
   modelo es (A o B) y cómo usarla.
2. **`## 0. Librerías`** y **`## 1. Parámetros`**: todo lo que se puede cambiar (cultivo, años,
   rutas, features) en una sola celda arriba.
3. Pasos numerados `## N. Título`, en orden, sin saltos. **Cada celda de código tiene antes una
   celda markdown** que explica en criollo qué hace y por qué. El equipo no es experto en ML:
   explicá los términos la primera vez.
4. Cierre: **`## Próximos pasos`** como checklist (`- [ ]`).

Reglas de forma:

- Todo en español: textos, variables y comentarios. Constantes en mayúsculas, funciones con verbos.
- **La notebook corre de punta a punta aunque falten los datos:** las celdas que los necesitan
  imprimen "en espera" en vez de fallar (ver `HAY_DATOS` en el punto 2).
- Si una feature pedida no está en la entrega, se avisa y se sigue sin ella. No se inventa.
- Antes de dar por terminado un cambio: **Kernel → Restart & Run All** sin errores.

---

## 10. Git y agentes

- `main` está protegido para los cambios grandes: cada punto en su rama `ml/puntoN`, con un pull
  request. Antes de crear la rama, `git pull` en `main`.
- **No subas** modelos (`.joblib`), la entrega de datos, `.env` ni datos crudos pesados.
- Dos personas no editan la misma notebook a la vez: Git no sabe mezclar cambios de `.ipynb`.
- **Agentes (Claude):** leé este archivo y [`PUNTO2.md`](PUNTO2.md) antes de empezar. Trabajá solo
  en los archivos de tu punto. Editá las notebooks por celdas y corré la notebook entera para
  verificar. No hagas commit, push ni pull request sin que la persona lo pida. Explicá en lenguaje
  simple.
