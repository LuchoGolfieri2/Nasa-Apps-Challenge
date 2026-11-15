# Punto 2: comparar rotaciones (modelo B)

Notebook: [`punto2_rotaciones.ipynb`](punto2_rotaciones.ipynb). Corresponde al uso #2 del issue #6 (y al #3, que usa el mismo modelo). Es el **modelo B, escenarios de rotación**, de la sección 4 del [`CLAUDE.md`](CLAUDE.md).

## Qué le muestra al productor

> "En tu condado, el maíz rotado (después de soja) rinde entre X e Y bu/ac según el clima del año; el maíz sobre maíz, entre Z y W."

Es la pantalla **"Compare rotations"** del `INFO.md`: la rotación actual y alternativas lado a lado, con el rango de rinde **del condado**. El rinde no se muestra por sector: eso es vigor relativo (punto 1). El modelo **estima**; la decisión es del productor.

## Cómo funciona, en simple

Son dos piezas, cada una para lo que hace bien:

1. **Un modelo de ML para el clima y el suelo.** Ve el rinde de maíz (o soja) de cada condado en cada año, junto con el clima de ese año y el suelo. Como el rinde sube año a año por la tecnología, aprende cuánto se aparta cada año de esa tendencia y después se la vuelve a sumar.
2. **Efectos fijos para la rotación.** Compara cada condado consigo mismo y contra sus vecinos del mismo año: "en los años en que este condado hizo más maíz sobre maíz que lo normal, ¿rindió más o menos?". Así mide cuánto cambia el rinde por rotar, sin confundirlo con que el condado sea bueno o con que ese año el maíz valiera caro.
3. **Las juntamos en escenarios.** Para cada condado: rinde con su rotación normal (modelo de ML), y cuánto sube o baja si rota del todo o hace todo continuo (efectos fijos).
4. **Con muchos climas.** Se prueba el clima de cada año de 2009 a 2023. Así sale un rango (año normal, malo y bueno), no un solo número.

## Partes de la notebook

| Paso | Qué hace |
|---|---|
| 0 | Librerías. Si no está LightGBM, usa uno equivalente de scikit-learn |
| 1 | **Parámetros:** cultivo (`maiz` o `soja`), años, features. Todo lo que se cambia está acá |
| 2 | Carga `tabla_anual`, `tabla_mensual` y el diccionario de la entrega |
| 3 | Cuántos condados tienen rinde por año y estado |
| 4 | Tabla de modelado: una fila por condado y año. Avisa qué features no vinieron |
| 5 | Folds: desarrollo 2009–2023 (un año afuera por vez) y prueba 2024–2025. Los guarda en `backend/Datos/folds.csv` |
| 6 | Tendencia por estado (dentro del fold) y los 3 baselines |
| 7 | Los dos modelos: Ridge y LightGBM poco profundo |
| 8 | Validación: deja cada año afuera, predice y mide importancias |
| 9 | Resultados por estado y por año contra los baselines. Elige el mejor modelo |
| 10 | ¿Sirve en un estado que no vio? |
| 11 | Qué variables pesan y si son estables entre años |
| 12 | Banda de incertidumbre p10–p90 y su cobertura por estado |
| 13 | Modelo final (se guarda en `backend/ML/modelos/`) y prueba 2024–2025, apagada con `MIRAR_PRUEBA` |
| 14 | **Efecto de la rotación con efectos fijos** (mismo condado + mismo estado y año + clima) |
| 15 | **Escenarios de rotación** (`actual`, `rotado`, `continuo`): la salida para la app |
| 16 | Chequeo agronómico: efecto negativo, cerca de los experimentos, y rotado > continuo |
| 17 | Registra la corrida en `backend/Datos/experimentos.csv` |

La notebook se corre **una vez por cultivo**. Las salidas de maíz y soja se juntan en los mismos archivos.

## Datos

**Entra:** la parte `condado/` de la entrega `backend/Datos/entregas/fieldshift_datos_v1.2/` (no va a Git; detalle en la sección 3 del `CLAUDE.md`). La v1.2 es igual a la v1.1 en las tablas del condado; solo suma `extras/teledeteccion_anual.csv`.

| Archivo | Qué se usa |
|---|---|
| `tabla_anual.csv` | `rend_bu_ac` (target), clima de julio, agosto y la temporada, suelo, `pct_<cultivo>_tras_<mismo cultivo>` |
| `tabla_mensual.csv` | Calor y déficit de julio o agosto, lluvia y humedad de abril y mayo |
| `diccionario.csv` | Chequea que cada feature figure como `entrada` |

**Features del modelo** (elegidas con la sección 5 del `CLAUDE.md`; descripciones, unidades y fuentes del `diccionario.csv` de la entrega). Maíz usa 25 y soja 23. Las columnas con `_MM` al final salen de la tabla mensual: `deficit_mm_07` es el déficit de julio.

| Columna | Qué es | Unidad | Fuente | Maíz | Soja |
|---|---|---|---|:-:|:-:|
| **Clima del cultivo** | | | | | |
| `prec_jul_mm` | Lluvia de julio (floración del maíz) | mm | NASA POWER | ✓ | |
| `tmax_jul_c` | Media de la temperatura máxima diaria de julio | °C | NASA POWER | ✓ | |
| `dias_tmax_gt30_jul` | Días de julio con máxima > 30 °C | días | NASA POWER | ✓ | |
| `dias_tmax_gt35_07` | Días de julio con máxima > 35 °C | días | NASA POWER (mensual) | ✓ | |
| `deficit_mm_07` | Lluvia − evapotranspiración de julio | mm | NASA POWER (mensual) | ✓ | |
| `prec_ago_mm` | Lluvia de agosto (llenado de la soja) | mm | NASA POWER | | ✓ |
| `tmax_c_08` | Media de la temperatura máxima de agosto | °C | NASA POWER (mensual) | | ✓ |
| `deficit_mm_08` | Lluvia − evapotranspiración de agosto | mm | NASA POWER (mensual) | | ✓ |
| **Clima de la temporada** | | | | | |
| `prec_temporada_mm` | Lluvia de abril a septiembre | mm | NASA POWER | ✓ | ✓ |
| `gdd_temporada` | Grados-día (base 10, tope 30 °C) de abril a septiembre | °C·día | NASA POWER | ✓ | ✓ |
| `deficit_temporada_mm` | Lluvia − evapotranspiración de abril a septiembre | mm | NASA POWER | ✓ | ✓ |
| **Primavera (exceso de agua, atrasa la siembra)** | | | | | |
| `prec_power_mm_04`, `prec_power_mm_05` | Lluvia de abril y de mayo | mm | NASA POWER (mensual) | ✓ | ✓ |
| `dias_lluvia_gt50_04`, `dias_lluvia_gt50_05` | Días con lluvia > 50 mm en abril y en mayo | días | NASA POWER (mensual) | ✓ | ✓ |
| `gwettop_04`, `gwettop_05` | Humedad del suelo superficial en abril y en mayo | 0–1 | NASA POWER (mensual) | ✓ | ✓ |
| `gwetroot_04`, `gwetroot_05` | Humedad de la zona de raíces en abril y en mayo | 0–1 | NASA POWER (mensual) | ✓ | ✓ |
| **Suelo y terreno (fijos)** | | | | | |
| `aws0_100_mm` | Agua que el suelo puede guardar, 0–100 cm | mm | SSURGO | ✓ | ✓ |
| `nccpi_maiz` / `nccpi_soja` | Índice de productividad del suelo para ese cultivo (NCCPI 3.0) | 0–1 | SSURGO | ✓ | ✓ |
| `soc0_30_gm2` | Carbono orgánico 0–30 cm | g C/m² | SSURGO | ✓ | ✓ |
| `pendiente_media_pct` | Pendiente media | % | NASADEM | ✓ | ✓ |
| `twi_medio` | Índice topográfico de humedad (dónde se junta el agua) | adim. | NASADEM | ✓ | ✓ |
| `clase_drenaje` | Clase de drenaje dominante (categórica) | clase | SSURGO | ✓ | ✓ |
| `grupo_hidrologico` | Grupo hidrológico dominante (categórica) | clase | SSURGO | ✓ | ✓ |
| **Rotación** (se calculan en la notebook) | | | | | |
| `pct_maiz_tras_maiz_media` / `pct_soja_tras_soja_media` | % del cultivo sembrado sobre sí mismo, **normal del condado** (promedio del train del fold) | % | CDL (USDA) | ✓ | ✓ |
| `pct_maiz_tras_maiz_desvio` / `pct_soja_tras_soja_desvio` | Cuánto se apartó **ese año** de lo normal del condado | puntos | CDL (USDA) | ✓ | ✓ |

- **Efectos fijos (paso 14):** usan el % crudo del cultivo sobre sí mismo (`pct_maiz_tras_maiz` o `pct_soja_tras_soja`) y, como controles de clima, las mismas columnas de clima de la tabla (sin suelo ni rotación).
- **Nunca se usan:** NDVI o EVI del año (son consecuencia del cultivo), `produccion_bu`, `sup_cosechada_ac` y `ratio_cosechada` (salen de la cosecha), `rend_kgha` (es el target en otra unidad).
- **Ojo con el `momento`:** el diccionario marca el clima como `temporada` y los `pct_*` como `post_cosecha`. Para el modelo B está bien: en un escenario el clima es el de un año histórico y la rotación es una decisión que el productor toma al sembrar. Para un pronóstico en temporada (modelo A) no se podrían usar así.

**Sale:**

| Archivo | Columnas | Para quién |
|---|---|---|
| `backend/Datos/escenarios_rotacion.csv` | `fips, rotacion, cultivo, anio_clima, pred, p10, p90` | Front (`INFO.md` 4.6). `p10`/`p90` = error del modelo + incertidumbre del efecto de rotar |
| `backend/Datos/escenarios_rotacion_resumen.csv` | `fips, rotacion, cultivo, mediana_clima, p10_clima, p90_clima` | Front. Cómo varía el rinde **entre climas** |
| `backend/Datos/folds.csv` | `fips, anio, estado, cultivo, bloque, fold_anio, fold_estado` | Repetir la validación |
| `backend/Datos/experimentos.csv` | Una fila por corrida | Comparar corridas |
| `backend/Datos/efecto_rotacion.csv` | `cultivo, columna, bu_ac_por_punto, ic95_bajo, ic95_alto, p, n, rinde_medio_bu_ac, continuo_vs_rotado_pct, version_datos` | Punto 3 y front: el efecto de rotar (paso 14) |
| `backend/Datos/tabla_modelado.csv` | `fips, anio, estado, cultivo, rend_bu_ac` + las features crudas | Puntos 3 y 4: la misma tabla que usó el modelo |
| `backend/ML/modelos/punto2_rotaciones_<cultivo>.joblib` | Modelo, tendencia, promedios de rotación, features y banda | Puntos 3 y 4. No va a Git: se regenera corriendo esta notebook |

## Depende de / lo usan

- **Depende de:** la entrega `fieldshift_datos_v1.2` (parte `condado/`) del pipeline de datos.
- **Lo usan:** el front (pantalla "Compare rotations"), el punto 3 (explicaciones, sección siguiente) y el punto 4 (años raros), que cargan el modelo guardado.

## Para el punto 3 (explicaciones)

Esta sección es todo lo que necesita quien haga el punto 3. No hace falta abrir la notebook del punto 2.

### Qué tiene que hacer el punto 3

Darle al productor el **"por qué"** de los números de la pantalla "Compare rotations", en frases simples y en inglés. Por ejemplo:

> "In years with a hot July, corn yields in this county tend to be about 25 bu/ac lower."
> "Corn after corn tends to yield about 17 % less than corn after soybeans."

Hay **dos fuentes de explicación distintas**, y no se mezclan:

| Qué explica | De dónde sale | Archivo |
|---|---|---|
| Cómo el **clima y el suelo** mueven el rinde de un condado en un año | Valores SHAP del modelo de ML | `backend/ML/modelos/punto2_rotaciones_<cultivo>.joblib` + `backend/Datos/tabla_modelado.csv` |
| Cuánto cambia el rinde por **rotar o no rotar** | Efectos fijos (paso 14) | `backend/Datos/efecto_rotacion.csv` |

**Importante: la rotación nunca se explica con SHAP.** Las columnas `pct_*_media` y `pct_*_desvio` del modelo de ML miden sobre todo qué tipo de condado es (los más productivos hacen más maíz sobre maíz), no el efecto de rotar. Para la rotación se usa solo `efecto_rotacion.csv`.

Va en su propia notebook (`punto3_explicaciones.ipynb`) con su `PUNTO3.md`, así no se pisa con quien edite la del punto 2.

### Qué hay que tener antes

1. La entrega descomprimida en `backend/Datos/entregas/fieldshift_datos_v1.2/` (ver `README.md`).
2. Haber corrido `punto2_rotaciones.ipynb` con `CULTIVO = "maiz"` y con `"soja"`. Eso crea los `.joblib` en `backend/ML/modelos/`, que no están en Git.
3. Nada más: no hace falta instalar `shap`. LightGBM calcula los mismos valores con `pred_contrib=True`.

### Qué tiene el modelo guardado

`joblib.load("backend/ML/modelos/punto2_rotaciones_maiz.joblib")` devuelve un diccionario:

| Clave | Qué es |
|---|---|
| `modelo` | Pipeline de scikit-learn: `prep` (prepara las columnas) + `modelo` (LightGBM). Predice la **anomalía**: cuánto se aparta el rinde de la tendencia |
| `tendencia` | Coeficientes de la recta rinde ~ año por estado (`{"por_estado": {"17": [pendiente, ordenada], ...}, "global": [...]}`) |
| `medias` | % normal de rotación de cada condado (índice `fips`) |
| `features` | Lista de columnas, en el orden que espera el modelo (ver la tabla de features) |
| `rotacion` | La columna de rotación cruda (`["pct_maiz_tras_maiz"]` o `["pct_soja_tras_soja"]`) |
| `cultivo`, `target`, `version_datos` | Cultivo, `rend_bu_ac` y la entrega usada |
| `q10`, `q90` | Banda de error del modelo, en bu/ac |

### Código de arranque (probado con los datos reales)

```python
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

RAIZ = next(p for p in [Path.cwd(), *Path.cwd().parents] if (p / ".git").exists())
CULTIVO = "maiz"   # o "soja"

# 1. Cargar el modelo y la tabla que guardó el punto 2
paquete = joblib.load(RAIZ / "backend" / "ML" / "modelos" / f"punto2_rotaciones_{CULTIVO}.joblib")
tabla = pd.read_csv(RAIZ / "backend" / "Datos" / "tabla_modelado.csv", dtype={"fips": str, "estado": str})
tabla = tabla[tabla["cultivo"] == CULTIVO].reset_index(drop=True)


# 2. Rearmar las columnas de rotación (copia de separar_rotacion del punto 2)
def separar_rotacion(datos, medias):
    d = datos.copy()
    for c in paquete["rotacion"]:
        media = d["fips"].map(medias[c]).fillna(d.groupby("fips")[c].transform("mean"))
        d[f"{c}_media"] = media
        d[f"{c}_desvio"] = d[c] - media
    return d


X = separar_rotacion(tabla, paquete["medias"])[paquete["features"]]

# 3. Contribución de cada variable (valores SHAP) con LightGBM, sin instalar shap
prep = paquete["modelo"].named_steps["prep"]
arboles = paquete["modelo"].named_steps["modelo"]
Xt = prep.transform(X)
nombres = [n.split("__", 1)[1] for n in prep.get_feature_names_out()]
contrib = arboles.predict(Xt, pred_contrib=True)          # una columna por variable + la base al final
shap = pd.DataFrame(contrib[:, :-1], columns=nombres, index=tabla.index)
base = contrib[0, -1]                                      # anomalía promedio (bu/ac)

# Chequeo: base + suma de contribuciones = lo que predice el modelo (la anomalía, sin tendencia)
assert np.allclose(base + shap.sum(axis=1), paquete["modelo"].predict(X))

# 4. Ejemplo: qué variables empujaron más el rinde de un condado en un año
fila = tabla.index[(tabla["fips"] == "19169") & (tabla["anio"] == 2012)][0]
print(shap.loc[fila].sort_values(key=abs, ascending=False).head(5).round(1))
```

Salida real (maíz, Story, Iowa, 2012, el año de la sequía):

```
tmax_jul_c           -25.2
dias_tmax_gt30_jul    -7.6
deficit_mm_07         -5.6
dias_tmax_gt35_07     -4.4
nccpi_maiz             4.4
```

### Cómo leer los valores SHAP

- Están en **bu/ac**. Positivo = empujó el rinde para arriba; negativo, para abajo.
- Explican la **anomalía** (rinde − tendencia del estado), no el rinde total. `base` es la anomalía promedio; `base + suma de las contribuciones` da la predicción del modelo.
- Son de **un condado en un año**. Para frases generales ("in hot Julys…"), promediá sobre los años o condados que correspondan.
- Las columnas categóricas (`clase_drenaje`, `grupo_hidrologico`) entran codificadas como números, pero su SHAP se lee igual.
- Si algún día el modelo elegido pasa a ser Ridge (paso 9 del punto 2), `pred_contrib` no existe. Revisá `type(arboles).__name__` y, para Ridge, usá coeficiente × valor escalado.

### Grupos de variables y frases (borrador)

Al productor no le sirve "`gwetroot_05`". Conviene **sumar el SHAP por grupo** y usar una frase fija por grupo. Los ids van en español y `snake_case`, y el texto visible en inglés va en `textos.json` (`INFO.md`, secciones 4 y 6). Las frases son un borrador para acordar con el front.

| id de grupo | Columnas (sumar su SHAP) | Frase en la app (borrador) | Fuente |
|---|---|---|---|
| `calor_julio` | `tmax_jul_c`, `dias_tmax_gt30_jul`, `dias_tmax_gt35_07` | "July heat (corn flowering)" | NASA POWER |
| `agua_julio` | `prec_jul_mm`, `deficit_mm_07` | "July rain and water balance" | NASA POWER |
| `calor_agosto` | `tmax_c_08` | "August heat (soybean pod filling)" | NASA POWER |
| `agua_agosto` | `prec_ago_mm`, `deficit_mm_08` | "August rain and water balance" | NASA POWER |
| `temporada` | `prec_temporada_mm`, `gdd_temporada`, `deficit_temporada_mm` | "Season rain, warmth and water balance (Apr–Sep)" | NASA POWER |
| `primavera_humeda` | `prec_power_mm_04`, `prec_power_mm_05`, `dias_lluvia_gt50_04`, `dias_lluvia_gt50_05`, `gwettop_04`, `gwettop_05`, `gwetroot_04`, `gwetroot_05` | "Wet spring (can delay planting)" | NASA POWER |
| `suelo_productivo` | `nccpi_maiz` o `nccpi_soja`, `soc0_30_gm2` | "How productive the soil is" | USDA SSURGO |
| `agua_del_suelo` | `aws0_100_mm`, `clase_drenaje`, `grupo_hidrologico` | "Water the soil can hold and how it drains" | USDA SSURGO |
| `terreno` | `pendiente_media_pct`, `twi_medio` | "Slope and where water collects" | NASA NASADEM |
| `tipo_de_condado` | `pct_*_media`, `pct_*_desvio` | **No mostrar.** Mide qué tipo de condado es, no el efecto de rotar | — |

Para la rotación, la frase sale de `efecto_rotacion.csv` (`continuo_vs_rotado_pct`), por ejemplo: *"Corn after corn tends to yield about 17 % less than corn after soybeans (USDA cropland data, 2009–2023)."*

### Reglas para los textos (`INFO.md`, sección 6)

- **En inglés**, con palabras simples ("water the soil can hold", no "AWS").
- **Asociación, no causa:** "tends to", nunca "because".
- **Los textos no recomiendan:** nada de "recommended", "best option" ni "you should". Desde el 14/11 la **app** sí marca una opción como "Suggested for your priorities", pero eso lo decide el front con los `scores`; nuestras frases solo dan razones.
- **Plantillas fijas**, sin IA generativa: así no se inventa nada y no hay texto generado que declarar en Space Apps.
- Cada frase lleva su **fuente** (`fuentes.json`) y su marca: "From NASA data + model" para SHAP y efectos fijos; "Agronomic rule" solo para lo que sale de reglas (nitrógeno, carbono, erosión).
- **Precisión honesta:** bu/ac y % sin decimales.

### Qué falta definir con el front

- ~~Dónde van las explicaciones por condado.~~ Resuelto: `backend/Datos/front/explicaciones.json` (punto 3), que lee el script del front.
- Cuántos grupos mostrar por condado (2 o 3, como los "rasgos" de los sectores).

## Cierre del modelo (15/11)

El modelo quedó **cerrado** el 15/11 con la entrega `fieldshift_datos_final_20261115` (11 estados, 948 condados).
Los números finales están en [`docs/ml/model_card.md`](../../docs/ml/model_card.md) y en `MEJORAS_15_11.md` §7.

| | Maíz | Soja |
|---|---:|---:|
| Desarrollo, un año afuera 2009–2023 (modelo vs. tendencia del condado) | 15,3 vs. 18,6 | 4,3 vs. 5,1 |
| **Prueba 2024–2025** (modelo vs. tendencia del condado) | **15,2 vs. 14,9** (gana en 5 de 11) | **4,5 vs. 5,6** (gana en 11 de 11) |
| Banda p10–p90 en la prueba (objetivo 80 %) | 83 % | 79 % |

- **Datos de cada parte:** entrenamiento y elección del modelo solo con 2009–2023, dejando un año afuera por vez.
  La prueba es 2024–2025 completa (todos los condados con rinde de NASS en esos años), que no se usó para nada antes.
- **La prueba se abrió una sola vez**, con el modelo congelado. Después no se cambió nada: ni features, ni
  hiperparámetros, ni la banda. Por eso `MIRAR_PRUEBA` vuelve a quedar en `False` en la notebook (correrla de nuevo
  no la reabre: da los mismos números, pero no se usa para decidir).
- **El modelo que usa la app es el entrenado con 2009–2023** (`backend/ML/modelos/punto2_rotaciones_*.joblib`), el
  mismo que se evaluó en la prueba. **No se reentrenó con 2024–2025**: esos años traen el CDL de 10 m, que corre las
  columnas de rotación, y reentrenar a último momento dejaría a la app con un modelo que nadie evaluó.
- Lectura honesta: en soja el modelo le gana a la tendencia también en años nuevos; en maíz empata en total y pierde
  en el núcleo (IL, IN, IA). Lo útil de la app es la comparación de rotaciones (efectos fijos) y el rango, no
  pronosticar el rinde de maíz de un año.

## Cómo se valida

- **Un año afuera por vez** (2009–2023), nunca filas al azar: los condados de un mismo año comparten el clima.
- **Prueba final 2024–2025**, apagada con `MIRAR_PRUEBA = False` hasta el final. Se mira una sola vez.
- **Baselines:** media del condado, tendencia lineal del condado y rinde del año anterior. Si el modelo no les gana, la notebook avisa.
- **Métricas:** MAE, RMSE (bu/ac) y R², por estado y por año.
- **Un estado afuera:** entrena con dos estados y evalúa en el tercero.
- **Tendencia dentro del fold:** se ajusta solo con los años de entrenamiento.
- **Banda p10–p90:** sale de los errores fuera del fold; se reporta qué % de casos cae adentro (objetivo 80 %).
- **Chequeo agronómico:** el efecto de la rotación tiene que ser negativo (intervalo de confianza sin tocar el cero), en maíz cerca del 11–28 % de los experimentos, y `rotado` tiene que rendir más que `continuo`. Si no, la notebook avisa.

## Supuestos

- Se arranca en 2009 porque las transiciones del CDL de 2008 están vacías.
- La tendencia es una recta por estado (si un estado no está en el train, la de todos).
- Ridge con `alpha = 10` y LightGBM con 300 árboles de 3 niveles y al menos 40 filas por hoja, fijos (sin ajustar todavía). Se elige el de menor MAE fuera del fold.
- Rotación: se usa solo el % del cultivo sobre sí mismo. La otra columna (`tras_soja` para maíz) es casi su espejo dentro de cada condado (correlación −0,91) y con las dos el modelo no separa los efectos.
- La rotación se parte en "normal del condado" (promedio en el train del fold) y "desvío del año", porque entre condados el % de rotación refleja sobre todo qué tan productivo es el condado.
- Efecto de la rotación: regresión con efectos fijos de condado y de estado × año, más el clima local, y errores agrupados por condado. Solo con los años de desarrollo.
- Escenarios: `actual` = modelo de ML con la rotación normal del condado; `rotado` (0 % sobre sí mismo) y `continuo` (100 %) = `actual` + efecto × cambio de %. El efecto se midió con cambios chicos (unos 6 puntos por condado) y **se extiende de forma proporcional a 0 % y 100 %**. **Los ids son provisorios** hasta acordarlos con el front.
- Los escenarios fijan la tendencia en 2025 (`ANIO_TENDENCIA`): comparan rotaciones para una campaña actual con los climas de 2009–2023.
- Si una feature pedida no viene en la entrega, se sigue sin ella y se avisa.

## Resultados con datos reales (entrega v1.2, 2026-11-14)

Validación dejando un año afuera, 2009–2023. MAE en bu/ac (más bajo es mejor). (Resultado viejo, con 3 estados; los finales están en "Cierre del modelo".)

| | Maíz | Soja |
|---|---:|---:|
| Media del condado | 22,6 | 5,7 |
| Tendencia del condado (mejor baseline) | 18,9 | 4,2 |
| Año anterior | 22,6 | 5,3 |
| Ridge | 18,4 | 4,6 |
| **LightGBM (elegido)** | **17,4** | **4,0** |
| R² del elegido | 0,44 | 0,60 |
| Años en que le gana al mejor baseline | 9 de 15 | 9 de 15 |
| Banda p10–p90 | −29 a +24 | −7 a +6 |

- **El modelo le gana a los baselines, pero por poco** (−8 % de error en maíz, −5 % en soja). El año que más falla es 2012 (sequía): error de ~51 bu/ac en maíz.
- **Con un estado afuera** generaliza mejor que la tendencia de los otros estados (maíz: 15–17 contra 20–23 bu/ac).
- **Lo que más pesa:** en maíz, el NCCPI (productividad del suelo), el déficit de agua de julio y la rotación normal del condado; en soja, la rotación normal del condado, el NCCPI y el TWI.
- **Lo que más pesa:** en maíz, el NCCPI (productividad del suelo) y el déficit de agua de julio; en soja, el NCCPI y el TWI. También la rotación normal del condado, que acá mide sobre todo qué tipo de condado es.

**Efecto de la rotación** (paso 14, efectos fijos):

| | Maíz | Soja |
|---|---:|---:|
| bu/ac por punto de % sobre sí mismo | −0,29 (IC95 −0,41 a −0,18) | −0,10 (IC95 −0,13 a −0,06) |
| Continuo (100 %) contra rotado (0 %) | **−17 %** | **−18 %** |
| Experimentos de campo | −11 a −28 % (Iowa State) | sin rango citado en el repo |
| Rotado − continuo, mediana de los condados | +29 bu/ac | +10 bu/ac |

- El chequeo agronómico **pasa** en los dos cultivos, y el maíz cae dentro del rango de los experimentos.
- El resultado depende de controlar bien: sin controles da que el maíz continuo rinde *más* (+3 %), y controlando solo por condado da un absurdo (−127 %). Con condado + estado y año + clima se estabiliza. Sacando la sequía de 2012 el efecto del maíz es algo mayor (−0,46 bu/ac por punto).

**Historia de este resultado:** las primeras versiones medían la rotación con el modelo de ML y daban que el maíz continuo rinde más. Era confusión: los condados que más lo hacen son los más productivos, y en los años de precios altos se siembra más maíz sobre maíz. Separar condado y año dentro del ML no alcanzó; los efectos fijos con estado × año sí.

Las primeras pruebas del código se hicieron con datos inventados (en una carpeta temporal, fuera del repo); esos números no son resultados.

## Qué falta

- [ ] Acordar con el front los ids de `rotacion` (`actual`, `rotado`, `continuo`) y generar `backend/Datos/front/escenarios_rotacion.json`.
- [ ] Cuando llegue la v2: repetir el paso 14 con la humedad del suelo de NLDAS como control extra, y pasar los escenarios a US$/acre con `economia` (rinde × precio − costos, en un paso aparte).
- [ ] Comprobar el efecto de la rotación a escala de lote con `lotes/` (NDVI por píxel según el cultivo anterior).
- [ ] Sacar pares de features con |r| > 0,9.
- [ ] Early stopping y ajuste de hiperparámetros con un bloque de años reservado (nunca la prueba).
- [ ] Sumar prácticas del censo.
- [ ] Punto 3: explicaciones (ver "Para el punto 3").
- [x] `docs/ml/model_card.md`.
- [x] Al final, una sola vez: `MIRAR_PRUEBA = True` (15/11; ver "Cierre del modelo").

## Limitaciones (para el pitch)

- El rinde es **por condado**, no por lote.
- El clima de POWER viene a ~0,5°: condados vecinos comparten valores.
- 2024–2025 tienen menos condados y otro CDL (10 m).
- El modelo encuentra **asociaciones, no causas**. Los efectos fijos sacan mucho de la confusión, pero no es un experimento.
- El efecto de rotar se midió con cambios chicos del % del condado y se extiende a un lote que rota del todo o nada.
- Los beneficios de suelo (nitrógeno, carbono, erosión) no salen del modelo: son reglas agronómicas.

## Historia

La primera versión (`punto2_vigor.ipynb`) predecía `ndvi_peak` por punto de 30 m con `cdl_puntos.csv`. Se reemplazó cuando el equipo definió el modelo B por condado con la entrega v1.1, porque el NDVI del año no puede ser entrada en un escenario. Sigue en el historial de Git (commit `6773162`).
