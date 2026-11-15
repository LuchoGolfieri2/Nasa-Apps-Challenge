# Punto 7: ordenar las rotaciones según lo que le importa al productor

Notebook: [`punto7_decision.ipynb`](punto7_decision.ipynb). Issue #41; propuesta original de Diego en el PR #37. No
entrena un modelo nuevo y no toca el rinde: es una **capa de decisión** arriba del modelo B del punto 2
(escenarios de rotación), que se usa tal cual.

## Qué le muestra al productor

> "In the 2 worst climate years (2012, 2020), corn after soybeans leaves about $464/acre over operating costs,
> against $410 with your usual mix."
>
> "On average over 15 climate years, corn after soybeans would leave about $554/acre over operating costs, the most
> of the three."

(Story, Iowa, maíz, con el precio de Iowa de NASS, $4,61/bu, y el costo operativo del ERS, $475/acre.)

Va en la pantalla 3 ("Next season"): las opciones se ordenan según las prioridades que marca el productor (menos
riesgo, más ingreso, salud del suelo, ahorrar agua), y la sugerida muestra estas razones en plata. Se presenta como
**orden según sus prioridades**, nunca como recomendación.

## Cómo funciona, en simple

1. **Cada opción, en plata, año por año.** El punto 2 da el rinde de cada opción con el clima de cada año 2009–2023
   (15 escenarios). Cada año se pasa a $/acre: rinde × precio − costo operativo.
2. **Cada prioridad es una cuenta sobre esos 15 años.**
   - Más ingreso: el promedio.
   - Menos riesgo: lo que queda en los peores años (el 10 %, o sea 2 de 15: **CVaR**) y en cuántos años no se cubre
     el costo.
   - Salud del suelo: la regla agronómica que ya usaba el front (rotar 0,9; seguir igual 0,55; repetir 0,15).
   - Ahorrar agua: sin dato que separe las opciones.
3. **Puntajes de 0 a 1** comparando las opciones del mismo condado y cultivo (la mejor 1, la peor 0). Es el formato
   que ya lee el front.
4. **Las prioridades se vuelven pesos** y el orden sale del puntaje total. Hoy el front usa pesos iguales para las
   prioridades marcadas; la notebook trae también "ordenar" y "comparar de a pares".
5. **Confianza:** a una opción con confianza baja (pocos años de rinde, o Missouri en rotado y continuo) se le
   achica el puntaje de ingreso y riesgo (× 0,75).

## Partes de la notebook

### Preparación (pasos 0 a 2), funciona

| Paso | Qué hace |
|---|---|
| 0 | Librerías |
| 1 | Parámetros: fracción de años malos, regla de suelo, factor de confianza, pesos de ejemplo, variación de precio |
| 2 | Carga los escenarios del punto 2, los precios y costos, y la confianza de cada opción (punto 3) |

### Parte A: métricas y puntajes (pasos 3 a 5), funciona

| Paso | Qué hace | Estado |
|---|---|---|
| 3 | Ingreso por año de clima; promedio, CVaR 10 %, peor año, probabilidad de pérdida y cuáles son los peores años | Funciona |
| 4 | Puntajes 0–1 por prioridad entre las opciones del condado, con el factor de confianza | Funciona |
| 5 | Ejemplo: Story, maíz, con "menos riesgo" y "más ingreso" | Funciona |

Story (`19169`), maíz, $4,61/bu y $474,71/acre:

| Opción | Ingreso medio | 2 peores años (CVaR) | Peor año | Prob. de pérdida | Puntaje (riesgo 0,5, ingreso 0,5) |
|---|---:|---:|---:|---:|---:|
| Maíz rotado | $554 | $464 | $406 | 0 | 1,00 |
| Como siempre | $500 | $410 | $352 | 0 | 0,65 |
| Maíz continuo | $399 | $309 | $251 | 0 | 0,00 |

Los dos peores años son 2012 (sequía) y 2020 (derecho de agosto).

### Parte B: pesos y validación (pasos 6 a 8), funciona

| Paso | Qué hace | Estado |
|---|---|---|
| 6 | Tres formas de pasar prioridades a pesos: chips, ordenar (pesos por suma de rangos: 0,50 / 0,33 / 0,17) y comparar de a pares (regresión logística sobre las diferencias en $/acre) | Funciona; el ejemplo de a pares usa respuestas de un productor imaginario |
| 7 | Qué opción queda primera con distintos pesos y con el precio ±20 % | Funciona |
| 8 | Guarda los CSV | Funciona |

**Resultados del paso 7** (1.224 condado × cultivo con más de una opción):

| Pesos | Queda primera "como siempre" | Queda primera "rotado" |
|---|---:|---:|
| Solo ingreso | 116 | 1.108 |
| Solo riesgo | 111 | 1.113 |
| Solo suelo | 0 | 1.224 |
| Chips: las tres | 41 | 1.183 |
| Ordenar: riesgo > ingreso > suelo | 93 | 1.131 |
| Solo riesgo, precio −20 % | 120 | 1.104 |
| Solo riesgo, precio +20 % | 115 | 1.109 |

- **Las prioridades cambian la opción primera en 118 casos (10 %).** Con la forma vieja del front (riesgo según el
  p10 del rinde e ingreso según la mediana) eran 0.
- Casi todo ese cambio viene del suelo contra el ingreso (116 casos): en los condados donde rotar del todo rinde
  menos que la mezcla de siempre, el ingreso pide seguir igual y el suelo pide rotar.
- **Riesgo e ingreso eligen distinto solo en 9 casos (1 %).** No es un error de esta capa: en el punto 2 rotar
  corre el rinde la misma cantidad en todos los climas, así que la opción que deja más en un año promedio también
  deja más en los años malos. Ver "Qué falta".
- El "maíz continuo" no queda primero con ningún peso: rinde menos y es peor para el suelo.
- Mover el precio ±20 % cambia la primera en 9 casos: el costo es el mismo para las tres opciones, así que el precio
  casi no cambia el orden.
- Hay pérdida (algún año que no cubre el costo) en 414 de las 4.197 opciones, casi todas en Kansas, Missouri y
  Dakota del Sur. Ahí la probabilidad de pérdida entra al riesgo; en el resto empata en 0 y el riesgo se mide solo con
  el CVaR.

## Datos

**Entra:**

| Archivo | Qué tiene | De quién |
|---|---|---|
| `backend/Datos/escenarios_rotacion.csv` | `fips, rotacion, cultivo, anio_clima, pred`: rinde de cada opción con el clima de cada año | Punto 2 (ya está) |
| `backend/Datos/precios_costos.csv` | `fips_estado, cultivo, precio_usd_bu, costo_operativo_usd_ac` (mediana 2021–2025) | `scripts/build_precios_costos.py` (ya está) |
| `backend/Datos/front/explicaciones.json` | La confianza de cada opción | Punto 3 (ya está) |

**Sale:**

| Archivo | Columnas | Para quién |
|---|---|---|
| `backend/Datos/decision_opciones.csv` | `fips, cultivo, rotacion, precio_usd_bu, costo_usd_ac, n_escenarios, ingreso_medio_usd_ac, cvar10_usd_ac, peor_anio_usd_ac, p_perdida, anios_peores, score_income, score_risk, score_soil, score_water, confianza, factor_confianza` | `scripts/build_next_json.py` |
| `backend/Datos/decision_sensibilidad.csv` | `fips, cultivo` + la opción primera con cada combinación de pesos y precio | Revisión y pitch |

## Qué lee el front (ya conectado)

`scripts/build_next_json.py` lee `decision_opciones.csv` y, para cada opción con rango:

- llena `scores.risk`, `scores.income` y `scores.soil` con `score_risk`, `score_income` y `score_soil` (0–1);
- en la opción con el mejor CVaR agrega la razón de riesgo en plata, con `anios_peores` en `years` (clickeables, F23);
- la razón de ingreso pasa a usar `ingreso_medio_usd_ac` (el promedio de los 15 años).

El formato de `next/<fips>.json` **no cambia** (`web/src/next/types.ts`). Si falta el archivo, el script puntúa como
antes.

**Para usar pesos distintos de los iguales**, el cambio va en `web/src/next/suggest.ts`, que hoy promedia las
prioridades marcadas:

```ts
// hoy:   scores[o.id] = promedio de o.scores[p] para las prioridades marcadas
// con orden: peso de la prioridad en la posición i (de n) = (n − i) / (n·(n+1)/2)
const peso = (i: number, n: number) => (n - i) / ((n * (n + 1)) / 2);
scores[o.id] = usable.reduce((s, p, i) => s + peso(i, usable.length) * (o.scores[p] ?? 0), 0);
```

Para "comparar de a pares", el front haría 4 o 5 preguntas y ajustaría los pesos con la misma regresión logística del
paso 6 (o se precalculan perfiles).

## Depende de / lo usan

- **Depende de:** el punto 2 (`escenarios_rotacion.csv`), el punto 3 (`explicaciones.json`) y
  `scripts/build_precios_costos.py`.
- **Lo usan:** `scripts/build_next_json.py` → `web/public/data/next/<fips>.json` → `web/src/next/suggest.ts`.

## Cómo se valida

- No se entrena nada: el rinde es el del punto 2, con su validación por años.
- No hay un "dato real" del orden correcto (cada productor pesa distinto). Se valida que la capa **responda** a las
  prioridades y al precio (paso 7), y que el formato del front no cambie (se compararon los 895 `next/<fips>.json`
  contra la versión anterior: mismas claves, puntajes entre 0 y 1).

## Supuestos

- **Años malos = el 10 % de los escenarios, redondeado hacia arriba** (2 de 15). Con `// 10` sería 1 solo año.
- **Precio y costo fijos:** la mediana 2021–2025 del estado. El costo es el mismo para las tres opciones (el ERS no
  separa por rotación).
- **Riesgo = promedio de dos partes** (CVaR y probabilidad de pérdida), cada una escalada 0–1 entre las opciones; si
  una empata, cuenta solo la otra.
- **Factor de confianza 0,75 solo para confianza baja.** La media no se castiga porque es la de todas las opciones
  rotado y continuo: castigarla favorecería siempre a seguir igual.
- **Suelo con la regla fija** de `scripts/build_next_json.py` (no sale de datos).

## Probado

- Con las salidas del punto 2 de la rama `ml/mejoras` (10 estados, 15 escenarios por condado en la mediana; 25
  combinaciones con menos de 10). Corre de punta a punta en unos 15 segundos, sin errores.
- `build_next_json.py` con el punto 7: 895 condados, mismo contrato.

## Qué falta

- [ ] **Que el riesgo ordene distinto que el ingreso.** Hace falta que el efecto de rotar dependa del clima en el
      punto 2 (por ejemplo, una interacción rotación × déficit de agua en los efectos fijos: en los ensayos, rotar
      ayuda más en años secos). Es un cambio del modelo: decidirlo con Seba.
- [ ] Costo por rotación (el maíz continuo lleva más nitrógeno).
- [ ] Pesos por orden o de a pares en `suggest.ts` (front).
- [ ] "Ahorrar agua": un dato que separe las opciones.

## Limitaciones (para el pitch)

- Es un orden según las prioridades de cada productor, no una recomendación: el modelo de rinde es el mismo para
  todos.
- Precio y costo son referencias (medianas de 5 años y costo regional), no los del productor.
- Con el modelo actual, "menos riesgo" y "más ingreso" casi siempre ordenan igual; lo que más cambia el orden es la
  salud del suelo.
