# Mejoras de ML del 15/11 (rama `ml/mejoras`)

Arreglos y pruebas después de pasar a 10 estados (`CAMBIOS_9_ESTADOS.md`). Todo corre de punta a punta con la
entrega `fieldshift_datos_todo_10estados_20261115`. El formato de los JSON del front no cambia: se verificó
`web/public/data/next/` contra `web/src/next/types.ts` (mismas claves, prioridades y niveles de confianza).

## 1. Errores corregidos

| Problema | Antes | Arreglo | Ahora |
|---|---|---|---|
| Rangos de ancho cero (punto 2) | 26 condado-cultivo con 1 solo año de clima; Pulaski (MO), maíz: 77–77–77 bu/ac | Los escenarios usan el clima de **los 15 años** (2009–2023) aunque NASS no haya publicado el rinde ese año (`CLIMAS_TODOS_LOS_ANIOS`). El clima se toma de cualquier fila del condado | 15 climas por condado (mediana), 0 rangos de ancho cero. Pulaski: 88–133–139 |
| Banda p10–p90 angosta en algunos estados (punto 2) | Cobertura: Kansas 71 % (maíz) y 56 % (soja), Missouri 63 % y 70 % | Banda calibrada **por estado** con los residuos fuera de muestra (`BANDA_POR_ESTADO`). El `.joblib` suma `q_por_estado` | 80 % en cada estado (en la prueba 2024–2025: 80,5 % maíz, 78,2 % soja) |
| Demasiados años "raros" (punto 4) | 36 % de los condado-año marcados con un umbral fijo de 10 % | Se marca si el rinde cae **fuera de la banda p10–p90** del modelo alrededor de un año normal (`MARCAR = "banda"`) | 20 % (maíz) y 21 % (soja) |
| "No explicado" subestimado (punto 4) | Se medía con el modelo final, que ya vio ese año | Usa las predicciones **fuera de muestra** del punto 2 (`predicciones_oof.csv`, nuevo). La causa es un grupo de clima si el clima explica **al menos la mitad** de la diferencia con un año normal (`FRACCION_CAUSA = 0.5`): la frase "tends to explain most of it" queda literal | 2012: 72 % de los condados marcados (maíz), 90 % de ellos por calor o falta de agua |
| El suelo desapareció de las razones (punto 3) | 32 razones de suelo en 16.300 | Dos razones nuevas: `county_level` (modelo: cuánto rinde el condado por encima o por debajo de la recta de su estado, "its soil and how it is farmed") y `soil_rule` (regla de SSURGO: el suelo retiene más o menos agua que el 75 % / 25 % de la región) | 2.917 razones `county_level` y 67 `soil_rule` |
| Ingreso negativo sin aviso (front) | 23 opciones con ingreso típico negativo, sin explicación | `build_next_json.py` suma a `missing` que el costo es el promedio de la región ERS, y avisa cuando una opción queda por debajo del costo | — |
| Confianza con pocos años (punto 3) | "Only N years with yield data" | El motivo agrega que el rango se apoya en la tendencia del estado | — |

`build_next_json.py` lleva las razones nuevas al front: `county_level` → prioridad `yield`; `soil_rule` → `risk`
con `kind: "rule"`.

## 2. Pruebas para mejorar el modelo (punto 2, maíz, validación dejando un año afuera)

| Variante | MAE total (bu/ac) | Decisión |
|---|---:|---|
| Modelo actual | **15,3** | Se queda |
| + riego del censo (`MANEJO = ["pct_riego"]`) | 15,3 | No: gana 0,1–0,2 en KS, NE y MO y pierde en SD. Queda como opción |
| Humedad del suelo de NLDAS en vez de POWER (abril y mayo) | 15,6 | No |
| Un modelo por zona (este: IA, IL, IN, MN, MO, OH, WI / oeste: KS, NE, SD) | peor en 9 de 10 estados | No: la tendencia por condado ya separa las zonas. Queda la opción `ESTADOS_INCLUIDOS` |

**Punto 5, el riego en el parecido** (`MANEJO = ["pct_riego"]`, sumado al grupo del suelo): **sí**. Los gemelos
mejoran en las 6 opciones del control del paso 19 (por ejemplo, maíz continuo 20,3 → 16,4 bu/ac) y el control con
todos los condados pasa de 10,6 a 9,4 (el mapa da 8,7). Sumar también labranza cero y cultivos de cobertura empeora.

## 3. Missouri

El efecto de repetir maíz da positivo en **todas** las divisiones probadas (norte y sur, más o menos silaje, más o
menos heno, más o menos maíz + soja), así que no lo explican el silaje ni la ganadería. Dos pistas:

- Dentro de cada condado de Missouri, el % de maíz sobre maíz varía poco (desvío mediano 3,1 puntos, contra 5,1 en
  Iowa): hay poca información para medir el efecto.
- Los años con más maíz repetido son los años con más maíz sembrado (correlación 0,35 dentro del condado),
  probablemente los de buena primavera o buen precio: el productor decide según las condiciones.

Es confusión, no agronomía. Se mantiene la confianza baja para `rotado` y `continuo` en Missouri (punto 3).

## 4. Prueba final 2024–2025 (mirada una sola vez, con el modelo cerrado)

MAE en bu/ac. "Tendencia" es la tendencia lineal de cada condado, el mejor baseline.

| | IL | IN | IA | KS | MN | MO | NE | OH | SD | WI | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Maíz, modelo | 18,9 | 14,0 | 12,7 | 19,6 | **14,9** | **14,6** | **9,8** | 17,8 | **13,0** | 13,4 | 15,0 |
| Maíz, tendencia | 13,9 | 10,7 | 9,7 | 19,1 | 16,4 | 18,1 | 12,6 | 16,9 | 20,6 | 13,0 | **14,7** |
| Soja, modelo | 5,1 | **3,9** | **2,4** | **6,8** | **4,7** | **4,4** | **4,6** | **5,7** | **3,8** | **4,6** | **4,5** |
| Soja, tendencia | 6,1 | 4,2 | 3,5 | 9,1 | 5,9 | 5,3 | 6,6 | 7,2 | 4,9 | 5,0 | 5,7 |

- **Soja:** el modelo le gana a la tendencia en 9 de 10 estados. Banda: 78,2 % (objetivo 80).
- **Maíz:** empata en total (15,0 contra 14,7) y pierde en el núcleo (IL, IN, IA). Una causa conocida: en 2024–2025
  el CDL pasó de 30 m a 10 m y eso corre las columnas de rotación (`pct_maiz_tras_maiz`) que usa el modelo. Banda:
  80,5 %. Para el pitch: el rango (p10–p90) está bien calibrado; el valor central del maíz no le gana a la
  tendencia en años nuevos.
- No se cambió nada del modelo después de mirar la prueba.

## 5. Qué queda

- [ ] Escenario de clima futuro con FAO GAEZ (2041–2070): solo hay datos para IA, IL e IN. Falta decidir con el
      front dónde se muestra.
- [ ] Maíz en la prueba: recalcular la rotación de 2024–2025 con el CDL llevado a 30 m (pedido al pipeline).
- [ ] Dakota del Norte y el suelo de 9 condados de Dakota del Sur (pipeline).
- [ ] Punto 6: confirmar el umbral del híbrido con una temporada nueva.
