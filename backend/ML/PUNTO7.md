# Punto 7: ordenar las rotaciones según lo que le importa al productor

Notebook: todavía no existe (`punto7_decision.ipynb` cuando se arme). **Estado: propuesta.** No entrena un modelo
nuevo: es una capa de decisión arriba del modelo B del punto 2, que se usa tal cual.

## Qué le muestra al productor

> "With your priorities (less risk, more income), the rotated option comes first: in your 2 worst climate years it
> leaves $464/acre on average, against $410 if you keep your current rotation and $309 with continuous corn."

(Números reales de Story, Iowa, `19169`, maíz, con precio de $4,61/bu y costo de $474,71/acre: ver "Notas
verificadas".)

## La idea

No conviene meter las prioridades **dentro** del modelo de rinde. El modelo predice cuánto rinde el campo, y eso no
depende de lo que le importe al productor. Las prioridades van en una **capa de decisión** que se apoya en lo que
predice el ML. Hoy esa capa es un promedio simple de puntajes. Se puede hacer mucho más sólida, y eso suma en
"Aplicación de IA".

Ya tenemos lo necesario: `backend/Datos/escenarios_rotacion.csv` trae, para cada condado y opción, **hasta 15
escenarios de clima (2009–2023)** con su rinde predicho. No hay que suponer una distribución: se usa la que sale del
modelo.

### Cada prioridad se convierte en una métrica sobre esos escenarios

| Prioridad | Métrica sobre los escenarios | De dónde sale |
|---|---|---|
| Más ingreso | Ingreso medio = rinde × precio − costo | ML + precios NASS y costos ERS |
| Menos riesgo | Ingreso medio de los peores años (CVaR 10 %) y probabilidad de perder plata | ML |
| Salud del suelo | Diversidad de la rotación, o carbono del suelo (SSURGO) | Regla agronómica, o un modelo si hay datos |
| Ahorrar agua | Evapotranspiración (MODIS) frente a la lluvia (IMERG) | Faltan los datos de MODIS |

Después, las prioridades que marca el productor se vuelven pesos, y las opciones se ordenan por puntaje total:

```python
import math
import pandas as pd

esc = pd.read_csv("backend/Datos/escenarios_rotacion.csv", dtype={"fips": str})

def metricas(df, precio, costo):
    ing = df["pred"] * precio - costo                     # $/acre en cada año de clima
    peor = ing.nsmallest(max(1, math.ceil(len(ing) * 0.1)))  # el 10 % de años más malos (2 de 15)
    return pd.Series({
        "ingreso_medio": ing.mean(),
        "cvar10": peor.mean(),                            # cuánto queda en un año malo
        "p_perdida": (ing < 0).mean(),
        "n_escenarios": len(ing),
    })

def ordenar(fips, cultivo, precio, costo, pesos):
    m = (esc[(esc.fips == fips) & (esc.cultivo == cultivo)]
         .groupby("rotacion").apply(metricas, precio=precio, costo=costo))
    suelo = {"rotado": 0.9, "actual": 0.55, "continuo": 0.15}   # regla actual
    m["suelo"] = m.index.map(suelo)
    cols = ["ingreso_medio", "cvar10", "p_perdida", "suelo"]
    z = (m[cols] - m[cols].min()) / (m[cols].max() - m[cols].min()).replace(0, 1)  # 0..1 entre las opciones
    z["p_perdida"] = 1 - z["p_perdida"]                          # menos es mejor
    puntaje = (pesos["income"] * z["ingreso_medio"]
               + pesos["risk"] * (z["cvar10"] + z["p_perdida"]) / 2
               + pesos["soil"] * z["suelo"])
    return puntaje.sort_values(ascending=False), m

# productor que marcó "menos riesgo" e "ingreso"
ranking, detalle = ordenar("19169", "maiz", 4.61, 474.71, {"risk": 0.5, "income": 0.5, "soil": 0.0})
```

### Cómo pasar de "lo que le importa" a pesos

| Forma | Cómo se pregunta | Nivel |
|---|---|---|
| **Chips (lo de hoy)** | Cada prioridad marcada pesa lo mismo | Simple |
| **Ordenar** | El productor arrastra las prioridades de más a menos importante, y eso da pesos decrecientes (por ejemplo 0,5 / 0,3 / 0,2) | Simple, más fino |
| **Comparar de a pares** | "¿Preferís $40 más en un año típico o $40 menos de pérdida en un año malo?" Con 4 o 5 respuestas se ajustan los pesos con una regresión logística (análisis conjunto) | **El más "IA" y defendible ante el jurado** |

### Por qué este diseño es mejor para el pitch

- **Se puede explicar:** "La rotada queda primera porque en tus 2 peores años de clima te deja $464/acre contra
  $309 si hacés maíz continuo".
- **No mezcla preferencia con predicción:** el modelo sigue siendo el mismo para todos, y lo que cambia es la
  decisión. Un juez escéptico lo valora.
- **Arregla el problema que señaló ML** en su README: hoy riesgo, rinde e ingreso ordenan casi igual, así que las
  prioridades casi nunca cambian la opción que queda primera. Con CVaR y probabilidad de pérdida, sobre todo con el
  precio y el costo del productor, sí pueden cambiarla.
- En una opción que el condado casi no usa (por ejemplo maíz continuo, con pocos datos), conviene restarle puntos
  usando la confianza que ya viene en los datos.
- Cómo mostrarlo: como un **orden según sus prioridades**, no como una recomendación (regla 5 de `FRONT.md`: el
  modelo no recomienda).

## Notas verificadas (2026-11-15, contra `escenarios_rotacion.csv` de `main`)

- El archivo tiene 895 condados de 10 estados, 3 opciones (`actual`, `rotado`, `continuo`), maíz y soja, y clima
  de 2009 a 2023.
- **No todas las combinaciones tienen 15 escenarios:** 2.611 de las 4.197 combinaciones condado × cultivo × opción
  tienen menos de 15, y 368 tienen menos de 10 (el mínimo es 1). Con pocos escenarios el CVaR es un solo año:
  conviene mostrar `n_escenarios` o restar confianza.
- **El 10 % de 15 años:** con `len(ing) // 10`, como en la primera versión de esta propuesta, se toma 1 solo año (el
  peor). Para que sean 2 hay que redondear hacia arriba (`math.ceil`), como en el código de arriba.
- Story (`19169`), maíz, $4,61/bu y $474,71/acre, corrido con el código de arriba:

  | Opción | Ingreso medio | 2 peores años (CVaR 10 %) | Peor año | Prob. de pérdida | Puntaje (riesgo 0,5, ingreso 0,5) |
  |---|---|---|---|---|---|
  | rotado | $554 | $464 | $406 | 0 | 1,00 |
  | actual | $500 | $410 | $352 | 0 | 0,74 |
  | continuo | $399 | $309 | $251 | 0 | 0,25 |

  Con esos precios, ninguna opción pierde plata en ningún año de clima, así que en Story el riesgo entra solo por el
  CVaR. La probabilidad de pérdida va a pesar en condados de menor rinde o con costos más altos.
- El costo es el mismo para las tres opciones. Si hay costos por rotación (por ejemplo, más nitrógeno en maíz
  continuo), cambian el orden: conviene sumarlos.

## Qué falta y quién lo hace

- **Decisión pendiente:** si lo arma el front sobre los escenarios (agregar a `scripts/build_next_json.py` el
  ingreso por año de clima y cambiar `web/src/next/suggest.ts` para que use CVaR y pesos), o el equipo de ML como
  notebook `punto7_decision.ipynb` con su `PUNTO7.md` completo.
- "Ahorrar agua" espera ET de MODIS y lluvia de IMERG por condado (o usar `et_mm` de NLDAS-2, que ya viene en la
  tabla mensual de la entrega).
- Validación: no hay un "dato real" contra el que medir el orden. Lo que se puede mostrar es que el orden cambia
  cuando cambian los pesos o el precio, y en cuántos condados.
