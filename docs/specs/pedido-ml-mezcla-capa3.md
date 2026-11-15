# Pedido al equipo de ML: mezcla de cultivos que responde a la plata (capa 3)

Del front (pantalla "Next season"), 15/11/2026. Es un pedido, no una decisión: el modelo, el target y la validación los define ML.

## Qué cambió en la pantalla

"Next season" ya no deja elegir cultivo ni prioridades (eso pasó a My Farm). Muestra dos cosas del **condado entero**:

1. **Mezcla esperada de cultivos** (lo nuevo, arriba de todo): qué parte del terreno de maíz y soja va a cada cambio de cultivo la próxima temporada (maíz tras soja, soja tras maíz, maíz tras maíz, soja tras soja), con rango.
2. **Lo que paga más por acre** (`prediction`): la opción que más dejó por acre con el clima de cada año 2009–2023, usando `escenarios_rotacion.csv` × precio NASS − costo ERS. Ejemplo: en Story, maíz tras soja en 14 de 15 temporadas (93 %).

Hoy la mezcla (1) **no usa ni precios ni el modelo**: es pura costumbre del condado. Eso es lo que pedimos sumar.

## Lo que ya está (capas 1 y 2, en `scripts/build_next_json.py`, función `crop_mix`)

- **Capa 1, la costumbre:** de `tabla_modelado.csv`, por año, `a` = % del maíz sembrado sobre maíz (`pct_maiz_tras_maiz`) y `b` = % de la soja sembrada sobre soja (`pct_soja_tras_soja`). Se toma la mediana de los últimos 5 años. Suponiendo que el área de maíz y soja se mantiene de un año al otro (solo maíz y soja), la parte de maíz es `c = (1 − b) / (2 − a − b)`, y las cuatro transiciones son `c·a`, `c·(1−a)`, `(1−c)·b` y `(1−c)·(1−b)`.
- **Capa 2, los condados parecidos:** el rango (percentiles 5 y 95) sale de cuánto se apartaron de su propia costumbre, año a año, el condado y sus 5 vecinos de `gemelos_vecinos.csv`. Si al condado le falta `a` o `b`, se usa la mediana de los vecinos.
- **Cobertura:** 881 de 895 condados (14 sin mapas recientes ni vecinos con datos).

**Prueba (predecir un año solo con los anteriores), error medio de las cuatro transiciones en puntos de %:**

| Método | 2023 | 2024 | 2025 |
|---|---|---|---|
| Igual que el año anterior | 1,14 | 1,72 | 1,13 (solo 364 condados con dato el año anterior) |
| Mediana de los últimos 5 años (lo que usamos) | 1,61 | 1,65 | 1,44 |
| Últimos 5 años corridos hacia los vecinos | 1,85 | 1,80 | 1,74 |

El valor real cae dentro del rango 5–95 en el 72–78 % de los condados (transición maíz tras maíz) y en el 77–84 % (parte de maíz). Sin los vecinos, solo en el 55–66 %. Los vecinos empeoran la cifra central, por eso solo entran en el rango.

## Qué pedimos (capa 3)

Que la mezcla se mueva con la señal económica, de forma medida y no supuesta:

1. **Medir** en los 895 condados, 2010–2025, cuánto cambian `a` y `b` (o la parte de maíz) según la diferencia de plata entre maíz y soja **del año anterior a la siembra**: por ejemplo, el ingreso por acre de maíz menos el de soja, con precios NASS del estado y costos ERS. Esa señal no puede usar información del año que se predice.
2. **Aplicar** esa relación a la próxima temporada con la diferencia que da el modelo (`escenarios_rotacion.csv` × precios), para mover la cifra central y, si corresponde, el rango.
3. **Validar** como en el resto del repo: por años, nunca al azar, y contra la capa 1 como baseline (tabla de arriba). Si no le gana a la capa 1, el front sigue con la capa 1 y lo dice.

## Formato de salida que nos sirve

`backend/Datos/mezcla_cultivos.csv`, una fila por condado y transición:

| Columna | Ejemplo |
|---|---|
| `fips` | `19169` |
| `temporada` | `2026` |
| `desde`, `hacia` | `soja`, `maiz` |
| `pct`, `p05`, `p95` | `41.3`, `39.2`, `46.2` (% del terreno de maíz y soja) |
| `efecto_precio_pts` | cuántos puntos movió la señal económica la cifra central |

El front lo agrega a `mix` en `web/public/data/next/<fips>.json` (agregar campos al JSON se consulta, regla 6 del CLAUDE.md raíz).

## Preguntas abiertas

- **Área sembrada por cultivo en 2025:** el front solo la tiene para 3 condados de demo. Con el área real de 2025 (y no la supuesta estable) la mezcla podría captar el "rebote" maíz/soja de un año al otro. ¿Viene en la entrega (`rotacion_anual.csv` del pipeline) para los 895?
- **Qué temporada es "la próxima":** el último mapa del CDL es 2025, así que hoy mostramos 2026. Si el CDL 2026 sale antes de la demo, ¿se actualiza?
- La diferencia de plata por clima (`prediction.others`) ya está en el JSON: ¿sirve como señal o prefieren usar solo precios?
