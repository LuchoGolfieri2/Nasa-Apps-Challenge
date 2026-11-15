# Pedido: mezcla esperada de cultivos, capa 3 (señal económica)

Pedido del equipo de front (15/11/2026) al equipo de ML. Todavía no hay notebook: este archivo explica qué hace falta y por qué. Cuando alguien lo tome, que lo pase a `PUNTO7.md` con la forma de [`PLANTILLA_PUNTO.md`](PLANTILLA_PUNTO.md).

## Qué le muestra la app

> "Expected crop mix next season: about 57% corn and 43% soybeans. 41% of the ground goes from soybeans to corn, 41% from corn to soybeans, 16% stays in corn and 2% stays in soybeans."

Va en la pantalla "Next season". Responde qué es lo más probable que se siembre en el condado el año que viene. No es una recomendación, y no es lo mismo que "la opción que más paga", que ya muestra la predicción del punto 2. Las cifras son del condado entero; la app no le habla al productor.

## Qué ya está hecho (capas 1 y 2, sin ML)

Lo arma `scripts/build_next_json.py` (función `crop_mix`) y queda en la clave `mix` de `web/public/data/next/<fips>.json`.

1. **Capa 1: la costumbre del condado.** De `backend/Datos/tabla_modelado.csv` salen dos números por año:
   - `a` = `pct_maiz_tras_maiz` / 100: qué parte del maíz de ese año se sembró sobre maíz.
   - `b` = `pct_soja_tras_soja` / 100: qué parte de la soja se sembró sobre soja.

   Se toma la mediana de los últimos 5 años con dato. Para pasar de `a` y `b` a las cuatro transiciones se supone que el área de maíz y soja no cambia de un año al otro y que solo hay maíz y soja. Con eso:
   - la parte de maíz es `c = (1 − b) / (2 − a − b)`;
   - maíz tras maíz = `c·a`, maíz tras soja = `c·(1 − a)`, soja tras soja = `(1 − c)·b`, soja tras maíz = `(1 − c)·(1 − b)`.
2. **Capa 2: los condados parecidos, solo para el rango.** El rango junta cuánto se apartó cada año de su costumbre el condado y sus 5 condados más parecidos (`backend/Datos/gemelos_vecinos.csv`, `orden` ≤ 5). Usa los percentiles 5 y 95 de esos desvíos. Si al condado le falta `a` o `b`, usa la mediana de los parecidos y baja la confianza.

**Cómo se probó.** Se predijeron 2024 y 2025 usando solo los años anteriores, en los 895 condados:

| Método | Error medio (puntos de %, promedio de las 4 transiciones) |
|---|---|
| Repetir el último año | 1,1 a 1,7 (pero muchas veces falta el último año) |
| **Capa 1: mediana de los últimos 5 años** | **1,4 a 1,65** |
| Mediana de 2010–2024 | 2,1 |
| Capa 1 corregida con los condados parecidos | 1,7 a 2,0 (peor, también en condados con pocos años) |

El valor real cae dentro del rango de la capa 2 en el 72 al 84 % de los condados. Si se usan solo los desvíos del propio condado, cae en el 55 al 66 %.

Resultado actual: 881 de 895 condados tienen mezcla (14 sin datos de rotación). La confianza queda así: 110 alta, 418 media y 353 baja.

## Qué pedimos (capa 3)

Un modelo que mueva `a` y `b` según cuánto más paga un cultivo que el otro. La idea: cuando el maíz deja más que la soja, más productores repiten maíz y la parte de maíz sube.

1. **La señal.** El ingreso del maíz menos el de la soja, por acre:
   - Predicción del modelo (`backend/Datos/escenarios_rotacion.csv`) × precio NASS − costo operativo ERS (`backend/Datos/precios_costos.csv`).
   - O, si es más honesto, la diferencia que se conocía el año anterior a la siembra. El productor decide con lo que sabe en invierno, no con el resultado de la cosecha.
2. **El target.** `a` y `b` de cada condado y año (o el cambio respecto de la mediana de los 5 años previos, que es lo que ya predice la capa 1).
3. **Datos.** Los 895 condados, 2010 a 2025.
4. **Validación.** Por años, como dice la regla 3 del [`CLAUDE.md`](CLAUDE.md): entrenar con años anteriores y probar con años posteriores, sin mezclar años. Comparar contra:
   - la capa 1 (1,4 a 1,65 puntos);
   - repetir el último año.

   Si no le gana a la capa 1, la app se queda con la capa 1 y lo decimos.
5. **Salida propuesta.** `backend/Datos/mezcla_esperada.csv` con `fips, anio, transicion, pct, p05, p95` (`transicion` = `soja_maiz`, `maiz_soja`, `maiz_maiz`, `soja_soja`). Una fila más por condado con `transicion = maiz_total` para la parte de maíz. El front la lee en `build_next_json.py` en lugar de la capa 1, sin cambiar la clave `mix`.

## Pedido al equipo de datos

La capa 1 supone que el área de maíz y soja es estable porque no tenemos lo sembrado por cultivo y año para todos los condados (hoy solo existe para Story, McLean y Sumner). Con `rotacion_anual.csv` (sección 6.2 del `CLAUDE.md` de la raíz) para los 895 condados se podría:

- calcular un paso real año a año, en lugar de suponer un área fija;
- mostrar el vaivén maíz-soja entre años.

Va a `docs/ml/pedidos_datos.md` por el humano (regla 6: los pedidos de datos no van directo a `ResearchAgent`).

## Aviso de esquema

Agregar `mix` (y antes `prediction`) a `web/public/data/next/<fips>.json` es un cambio de esquema. Según la regla 6 del `CLAUDE.md` de la raíz, hay que avisarlo al equipo antes de mergear.
