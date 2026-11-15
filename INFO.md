# FRONT.md — Field Shift: interfaz

**Versión del contrato: 0.2** · 2026-11-14 · la mantiene el equipo de ML (carpeta `ML-NasaSpaceProgram`).

Este archivo es para que el equipo de front (y su Claude) pueda avanzar **ya**, sin esperar los datos
reales y sin construir cosas que después queden viejas. La regla es una sola:

> El front programa contra el **contrato de datos** (sección 4) y usa **datos de prueba** (sección 5)
> hasta que ML entregue los reales. Lo **FIRME** no cambia sin avisar en la sección 9. Lo
> **PROVISORIO** puede cambiar: dejalo fácil de tocar (un componente, una función, un archivo).

En el CLAUDE.md del repo del front poné: *"Antes de tocar pantallas o datos, leé FRONT.md y fijate que
la versión del contrato coincida con la del `manifest.json`."*

---

## 1. Qué es el producto

Proyecto para NASA Space Apps Challenge 2026, desafío **"Field Shift: Adapting Farms with NASA Data"**.
La herramienta ayuda a productores de **EE.UU.** (Iowa, Illinois y Kansas) a comparar
rotaciones de cultivos con datos de la NASA, para cuidar el suelo y aguantar mejor los años secos y
húmedos.

Lo que estamos armando ahora es la **idea 1: el lote dividido en sectores de colores** (loma seca,
bajo húmedo, zona media). Cada sector sale de agrupar los píxeles de 30 m del lote según:

- cómo creció el cultivo en cada año (vigor por satélite: Landsat y HLS);
- el terreno (NASADEM) y el suelo (SSURGO);
- cómo le fue a cada píxel en los años secos y en los húmedos, comparado con el resto del lote.

**El modelo no decide nada.** Estima y muestra evidencia con rangos. El productor decide.

---

## 2. Reglas para Claude

1. **No inventes datos.** Fuera de `mock/`, todo número que se muestra viene de un archivo del
   contrato. Si falta algo, la pantalla dice "No data", nunca un hueco ni un valor
   supuesto.
2. **No calcules en el navegador lo que es del modelo.** Ni sectores, ni umbrales, ni rangos, ni
   nombres de sector. El front lee y muestra. Puede ordenar, filtrar y formatear.
3. **Leé solo los campos del contrato.** Si necesitás uno nuevo, pedilo (sección 9). No dependas de un
   campo que "por ahora viene" en un archivo.
4. **Todo lo PROVISORIO, aislado:** detrás de una función o un componente propio, para cambiarlo en un
   solo lugar.
5. **El modelo no recomienda.** Nada de "recommended", "best option" ni "deberías". Se compara y se
   muestra el rango.
6. **Skills:** usá `field-shift-frontend` para las pantallas y `dataviz` para cualquier gráfico.
7. **La skill `field-shift-frontend` tiene restos de una versión argentina.** Para este proyecto:
   - donde dice "departamento", es **condado** (`fips`);
   - la franja del diagnóstico no va de julio a junio: va de **noviembre a octubre** (invierno previo
     de noviembre a marzo, temporada de abril a septiembre, cosecha en octubre);
   - la interfaz va en inglés, no en español (sección 6).

---

## 3. Pantallas (máximo 4)

Las cuatro de la skill, con la idea 1 adentro. Celular primero (375 px), después escritorio (1440 px).
El nombre en inglés de cada pantalla es el que va en la interfaz; el español es solo de referencia.

1. **My field / Mi campo.**
   - Mapa con los lotes de demo (`lotes.geojson`) y buscador por condado.
   - Al tocar un lote: contorno sobre un fondo satelital, condado y estado, superficie, y los cultivos
     de los últimos años (de `cultivos`).
   - Un lote de demo precargado, para que la demo nunca falle.
   - Prioridades y restricciones (de la skill): maquetar, pero son **PROVISORIO**. Todavía no hay
     ningún dato que las use.
2. **Your field by zones / Tu lote por sectores** (es el "Diagnóstico" de la skill).
   - El lote pintado por sector, con la leyenda y el nombre de cada sector (no solo el color).
   - Al tocar un sector, su ficha:
     - nombre y % del lote;
     - **por qué es así:** 2 o 3 rasgos en palabras simples, cada uno con su fuente;
     - **cómo le va según el año:** años secos, normales y húmedos, con mediana y rango, y los
       puntos de cada año;
     - **confianza:** alta, media o baja, escrita.
   - Estados especiales (sección 6): lote parejo, sin datos, año con pocas imágenes.
   - Debajo, la franja del clima del condado de noviembre a octubre: **PROVISORIO**, el formato todavía
     no está definido (sección 4.6).
3. **Compare rotations / Comparar rotaciones.** **PROVISORIO**: el modelo de rotaciones (modelo B)
   está en construcción.
   - La rotación actual y al menos dos alternativas lado a lado, con el rango de rinde del condado
     (p10, mediana, p90) para el clima de cada año histórico.
   - Notas por sector que salen de **reglas**, no del modelo (por ejemplo, riesgo de erosión en la
     loma o de encharcamiento en el bajo). Cada nota lleva la marca "Agronomic rule".
4. **Sources & limits / Fuentes y límites.**
   - Qué datos se usaron, con resolución y fechas (de `fuentes.json`).
   - Qué no hace la herramienta: el vigor no es rinde, una asociación no es una causa, no reemplaza al
     agrónomo.

---

## 4. Contrato de datos

**Dónde:** ML escribe todo en `backend/Datos/front/`. El front lo copia o lo sirve como archivos estáticos.
No hay API en vivo.

**Reglas de todos los archivos (FIRME):**

- JSON en UTF-8. Los mapas en GeoJSON (RFC 7946): longitud y latitud WGS84, hasta 6 decimales,
  polígonos simplificados. Menos de 300 KB por lote.
- Faltante = `null`. Nunca 0, −999 ni texto vacío.
- Los ids van en `snake_case` y en español (`bajo_humedo`). Lo que lee el usuario sale de
  `textos.json`, nunca del id.
- Cada archivo trae `version_contrato`.

| Archivo | Qué tiene | Estado |
|---|---|---|
| `manifest.json` | Versión, fecha, si son datos de prueba y la lista de lotes | FIRME |
| `lotes.geojson` | Contorno de cada lote de demo | FIRME |
| `sectores/<id_lote>.geojson` | Polígonos de los sectores de un lote | FIRME (los campos marcados PROVISORIO pueden cambiar) |
| `sectores/<id_lote>.json` | Ficha de cada sector: rasgos y comportamiento según el año | PROVISORIO |
| `fuentes.json` | Fuentes de datos con su etiqueta corta | FIRME |
| `textos.json` | Nombres y explicaciones para el usuario, en inglés | PROVISORIO |
| `escenarios_rotacion.json` | Rangos de rinde por rotación y condado (modelo B) | PROVISORIO |
| `clima_condado/<fips>.json` | Franja del diagnóstico | PROVISORIO, sin formato todavía |

### 4.1 `manifest.json`

| Campo | Tipo | Qué es |
|---|---|---|
| `version_contrato` | texto | Por ejemplo `"0.1"` |
| `generado` | texto | Fecha y hora en que ML generó los archivos (ISO 8601) |
| `es_prueba` | booleano | `true` = datos de prueba. El front muestra la franja "TEST DATA" |
| `lotes` | lista de texto | Los `id_lote` disponibles |
| `lote_demo` | texto | El lote que se abre por defecto |

El front compara `version_contrato` con la versión que soporta y, si no coincide, avisa en la consola.

### 4.2 `lotes.geojson`

Un `FeatureCollection` con un `Feature` por lote (geometría `Polygon` o `MultiPolygon`).

| Propiedad | Tipo | Qué es | Estado |
|---|---|---|---|
| `id_lote` | texto | `<fips>_<id del Crop Sequence Boundaries>` | FIRME |
| `fips` | texto | 5 dígitos (19 Iowa, 17 Illinois, 20 Kansas) | FIRME |
| `condado` | texto | Nombre del condado | FIRME |
| `estado` | texto | `IA`, `IL` o `KS` | FIRME |
| `area_ha` y `area_ac` | número | Superficie | FIRME |
| `cultivos` | objeto | Año → cultivo, por ejemplo `{"2024": "maiz", "2025": "soja"}` | FIRME |
| `estado_sectores` | texto | `con_sectores`, `lote_parejo` o `sin_datos` | FIRME |
| `n_sectores` | entero | De 2 a 4. `null` si no hay sectores | FIRME |

### 4.3 `sectores/<id_lote>.geojson`

Un `Feature` por sector. Un sector puede tener partes separadas (`MultiPolygon`).

| Propiedad | Tipo | Qué es | Estado |
|---|---|---|---|
| `id_lote` | texto | | FIRME |
| `sector_id` | entero | 1, 2, 3… dentro del lote | FIRME |
| `tipo` | texto | `loma_seca`, `bajo_humedo` o `zona_media` (pueden sumarse otros) | PROVISORIO |
| `area_ha` y `pct_lote` | número | Superficie y % del lote | FIRME |
| `confianza` | texto | `alta`, `media` o `baja` | FIRME (ML define cómo se calcula) |

Si llega un `tipo` que el front no conoce, se muestra con un estilo neutro y el nombre "Zone N". No se rompe.

### 4.4 `sectores/<id_lote>.json` (PROVISORIO)

Ejemplo de **forma**. Los valores son inventados, solo para mostrar la estructura:

```json
{
  "version_contrato": "0.1",
  "id_lote": "19169_000000",
  "estado_sectores": "con_sectores",
  "anios_usados": [2013, 2014, 2015],
  "sectores": [
    {
      "sector_id": 1,
      "tipo": "bajo_humedo",
      "pct_lote": 20.0,
      "confianza": "media",
      "rasgos": [
        {"id": "elev_rel_m", "valor": -1.0, "unidad": "m", "fuente": "nasadem"},
        {"id": "clase_drenaje", "valor": "poorly_drained", "unidad": null, "fuente": "ssurgo"}
      ],
      "por_tipo_de_anio": {
        "seco":   {"mediana": 0.0, "p10": -1.0, "p90": 1.0, "n_anios": 1},
        "normal": {"mediana": 0.0, "p10": -1.0, "p90": 1.0, "n_anios": 1},
        "humedo": {"mediana": 0.0, "p10": -1.0, "p90": 1.0, "n_anios": 1}
      },
      "serie": [
        {"anio": 2013, "clase_anio": "humedo", "vigor_rel_pct": 0.0, "n_obs": 5}
      ]
    }
  ],
  "fuentes": ["hls", "landsat", "nasadem", "ssurgo", "cdl", "csb", "imerg"]
}
```

- `vigor_rel_pct`: cuánto más o menos vigor tuvo el sector ese año respecto del promedio del lote, en
  %. **Es vigor del cultivo visto por satélite, no rinde.** En pantalla: "Crop vigor vs. field
  average".
- `clase_anio`: `seco`, `normal` o `humedo`. Sale del balance de agua del condado en la temporada.
- `n_obs`: imágenes despejadas de ese año. Con pocas (por ejemplo 2012, que solo tiene Landsat 7), el
  punto se muestra marcado como "few images".
- `rasgos[].id`: su nombre y su explicación están en `textos.json`.

### 4.5 `fuentes.json` (FIRME)

Lista de objetos con:

- `id`: por ejemplo `nasadem`;
- `nombre`;
- `organismo`: `NASA`, `USDA` o `USGS`;
- `resolucion`;
- `periodo`;
- `url`;
- `etiqueta`: la etiqueta corta que se muestra al lado de cada dato, por ejemplo
  `"NASA NASADEM · 30 m"`.

Fuentes previstas para la idea 1:

- **NASA:** HLS, NASADEM, GPM IMERG, NASA POWER y SMAP.
- **NASA y USGS:** Landsat.
- **USDA:** CDL, Crop Sequence Boundaries y SSURGO.

### 4.6 `escenarios_rotacion.json` y `clima_condado/` (PROVISORIO)

- `escenarios_rotacion.json`: una fila por `fips`, `rotacion`, `cultivo` y `anio_clima`, con `pred`,
  `p10` y `p90` en bu/ac. Son las mismas columnas que `backend/Datos/escenarios_rotacion.csv` del CLAUDE.md
  de ML. Los ids de `rotacion` todavía no están definidos.
- `clima_condado/<fips>.json`: sin formato todavía. Maquetá la franja con datos de prueba.

---

## 5. Datos de prueba

- Van en `mock/`, con la misma forma que el contrato y `"es_prueba": true` en el manifest.
- Mientras `es_prueba` sea `true`, toda pantalla muestra una franja visible: **"TEST DATA — not real
  results"**.
- No se mezclan con los reales. No se usan en el video ni en la demo final.
- Para que se vean creíbles al maquetar: de 2 a 4 sectores por lote, un lote `lote_parejo` y otro
  `sin_datos`, años con pocas imágenes y algún `null`. Así se diseñan también los casos difíciles.

---

## 6. Cómo mostrar cada cosa

**Idioma (FIRME):** la interfaz va en **inglés**: los usuarios son productores de EE.UU. y el jurado
también la lee en inglés. El equipo trabaja en español (código, comentarios y documentos). Todo texto
visible sale de `textos.json`.

**Nombres de los sectores** (los da ML en `textos.json`; esto es el borrador):

| `tipo` | En pantalla | Referencia del equipo |
|---|---|---|
| `loma_seca` | Dry knoll | Loma seca |
| `bajo_humedo` | Wet low spot | Bajo húmedo |
| `zona_media` | Typical ground | Zona media |

**Colores:**

- Una paleta fija por `tipo`, igual en todos los lotes: cálido (ocre) para loma seca, azul para bajo
  húmedo y neutro para zona media.
- Validala con la skill `dataviz` (apta para daltonismo, contraste AA).
- El color nunca va solo: leyenda con el nombre y etiqueta en el mapa o en la lista.
- La confianza baja no se muestra con otro color: va con rayado o transparencia, y escrita en la
  ficha.

**Incertidumbre:**

- Nunca un número solo: mediana con rango (p10 a p90), y cuántos años entran (`n_anios`).
- Con menos de 5 años, el rango va acompañado del texto "few years".
- Para los años: un punto por año. No uses curvas de densidad: con 13 a 25 años inventan una forma que
  no está en los datos.
- Precisión honesta: porcentajes sin decimales, metros con uno.

**Estados que hay que diseñar:**

| Estado | Qué dice la pantalla |
|---|---|
| `lote_parejo` | "This field is fairly uniform: no clear zones." No se pinta ningún sector. |
| `sin_datos` | "Not enough clear satellite images for this field." |
| Año con pocas imágenes | Se muestra el punto, marcado como "few images". |
| Dato `null` | "No data" escrito en su lugar. |
| `es_prueba: true` | La franja "TEST DATA". |

**Modelo o regla:**

- Cada bloque lleva su marca: "From NASA data + model" o "Agronomic rule".
- Los beneficios de suelo (nitrógeno, carbono, erosión) son siempre reglas.

**Textos:**

- Palabras simples: "water the soil can hold", no "AWS". NDVI, TWI y SSURGO solo con una explicación
  de una línea al tocarlos.
- Asociación, no causa: "in dry years this zone **tends to** do worse", nunca "**because** it is a
  knoll".
- Cada dato lleva su etiqueta de fuente (`fuentes.json`).

---

## 7. Qué está firme y qué no

| Tema | Estado | Qué puede cambiar |
|---|---|---|
| Principios (sección 2) y las 4 pantallas | FIRME | — |
| GeoJSON WGS84, `null` = faltante, `version_contrato` | FIRME | — |
| `lotes.geojson` y `sectores/<id_lote>.geojson` | FIRME | Se pueden sumar campos, no se sacan |
| De 2 a 4 sectores por lote | FIRME | La cantidad exacta varía por lote |
| `tipo` de sector | PROVISORIO | Pueden sumarse tipos o cambiar los nombres |
| Ficha del sector (`sectores/<id_lote>.json`) | PROVISORIO | Rasgos, métrica de vigor y cortes de `clase_anio` |
| Solo lotes de demo (de 8 a 12) | PROVISORIO | Más adelante, todos los lotes de un condado |
| Capa de confianza por píxel | NO EXISTE | Quizás más adelante |
| Comparar rotaciones (modelo B) | PROVISORIO | Formato e ids de rotación |
| Franja del clima del condado | PROVISORIO | Formato sin definir |
| Prioridades y restricciones del usuario | PROVISORIO | Todavía no las usa ningún modelo |
| Interfaz en inglés | FIRME | — |
| **Datos reales** | PENDIENTES | Se pidieron al pipeline. Hasta entonces, solo `mock/` |

---

## 8. Qué no hacer

- Un dashboard con 20 gráficos. Cada pantalla responde una pregunta.
- Mostrar "yield" o "rinde" por sector: es **vigor relativo**. El rinde solo aparece en la comparación
  de rotaciones y es del condado.
- Precisión falsa ("this zone yields 8.437 kg/ha").
- Recalcular, suavizar o renombrar sectores en el front.
- Usar el logo de la NASA como si el producto fuera oficial. Seguí las guías de marca de Space Apps.
- Depender de una API en vivo para la demo.

---

## 9. Cambios y pedidos

**Cómo se mantiene al día:**

- ML es dueño de este archivo. Cuando cambia algo del contrato, sube `version_contrato` y anota el
  cambio abajo.
- Cambiar un campo FIRME exige subir la versión principal (por ejemplo de 0.x a 1.0) y avisar al
  equipo de front.
- Si el front necesita un dato o un campo nuevo: escribilo abajo, en "Pedidos del front", o pasáselo
  al humano. No lo resuelvas inventando el dato.
- Si copian este archivo al repo del front, copien también el número de versión y revisen de vez en
  cuando que coincida con el de la carpeta de ML.

### Cambios del contrato

| Versión | Fecha | Cambio |
|---|---|---|
| 0.2 | 2026-11-14 | La interfaz va en inglés (firme). `textos.json` solo en inglés. |
| 0.1 | 2026-11-14 | Primera versión: lotes, sectores, fuentes y datos de prueba. Ficha del sector, escenarios y clima, provisorios. |

### Pedidos del front

| Fecha | Quién | Qué necesita | Para qué pantalla | Estado |
|---|---|---|---|---|
| | | | | |
