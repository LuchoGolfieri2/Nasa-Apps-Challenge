---
name: "field-shift-research"
description: "Investigación verificada para el proyecto Field Shift (NASA Space Apps): datasets NASA, parámetros de cultivos y fuentes del USDA para el Corn Belt. Usar en vez de deep-research para preguntas de este proyecto."
---

# Research verificado — Field Shift

Sirve para responder preguntas del proyecto Field Shift (NASA Space Apps 2026): productos y variables de la NASA, parámetros de cultivos del Corn Belt de EE.UU. y fuentes del USDA (NASS, NRCS, ERS) y de extensión universitaria. Lo que encontrás alimenta un pipeline de datos: un número mal citado termina siendo un error en el modelo.

**Regla central: ningún valor entra sin una página primaria que lo diga.**

## 1. Encuadrar la pregunta (antes de buscar)

Escribí tres líneas:
- **Pregunta exacta**, que se responda con un valor, un nombre o un sí/no. Ejemplo: "¿Cuál es el short name y la fecha de inicio del producto GRACE-DA-DM global en GES DISC?"
- **Qué cuenta como respuesta:** unidad, formato, región, período.
- **Qué archivo cambia:** `config/cultivos.csv`, un paquete de `src/`, el catálogo de variables.

Si la pregunta es amplia ("¿qué cultivos de cobertura sirven?"), partila en sub-preguntas antes de buscar.

## 2. Jerarquía de fuentes

| Nivel | Qué | Uso |
|---|---|---|
| 1 — primarias | Páginas de producto de los DAAC (LP DAAC, NSIDC, GES DISC, PO.DAAC), CMR de Earthdata, documentación de NASA POWER, FAO-56, USDA NASS (Quick Stats, CDL, Crop Progress), USDA NRCS (gSSURGO), USDA ERS, USDA Agricultural Handbook 628, papers revisados | Pueden sostener un valor solas |
| 2 — secundarias confiables | Catálogo de Google Earth Engine, extensión universitaria (Iowa State, Illinois farmdoc, Purdue), Midwest Cover Crops Council, SARE, informes técnicos | Sostienen un valor si coinciden con otra fuente o si no hay primaria |
| 3 — pistas | Foros (Earthdata Forum), blogs, repos de GitHub, respuestas de otras IA | Solo para encontrar una fuente de nivel 1 o 2. Nunca se citan como evidencia |

Nunca uses como evidencia: repos de otros equipos de la hackathon, la memoria de un modelo (incluida la tuya) ni snippets de buscador sin abrir la página.

## 3. Buscar

- Productos NASA: en inglés, por short name o DOI (`SPL4SMGP`, `GPM_3IMERGDF`).
- Agronomía del Corn Belt: en inglés y nombrando el estado ("corn planting date Iowa extension", "soybean critical period Illinois").
- Abrí la página y leé el dato ahí. El snippet del buscador no alcanza.
- Variá las consultas en vez de repetir la misma con otras palabras.
- Tope: unas 15 búsquedas o 20 minutos por sub-pregunta. Si no aparece, pará y reportalo (sección 6).

## 4. Verificar contra la API cuando se pueda

Si podés ejecutar código o hacer pedidos HTTP, comprobá contra la fuente en vez de confiar en una página:

- **Producto NASA (existencia, versión, fecha de inicio):** `https://cmr.earthdata.nasa.gov/search/collections.json?short_name=<SHORT_NAME>` (público, sin login). Mirá `time_start`, `version_id` y `data_center`.
- **Parámetros de NASA POWER:** `https://power.larc.nasa.gov/api/system/manager/parameters?community=ag&temporal=daily`.
- **Productos disponibles en AppEEARS:** `https://appeears.earthdatacloud.nasa.gov/api/product`.
- **Valores de NASS Quick Stats:** `https://quickstats.nass.usda.gov/api/get_param_values/?key=<CLAVE>&param=short_desc&commodity_desc=CORN` (pide la clave gratuita; nunca la pegues en el informe).
- **IDs de Earth Engine:** `https://developers.google.com/earth-engine/datasets/catalog/<ID>`.

Anotá en el informe la consulta exacta que usaste.

## 5. Reglas para valores numéricos

- Cada valor lleva fuente (URL), región y año de la fuente.
- Parámetros que cambian con la zona (fechas de siembra, período crítico, rendimientos): al menos **dos fuentes independientes**. Si no coinciden, reportá el **rango** y cuál proponés usar y por qué.
- Kc y duración de etapas: FAO-56 da valores generales. Si hay ajuste local de extensión universitaria o del USDA, preferilo y anotá los dos.
- Hemisferio norte: descartá fechas de Argentina u otros países del sur. Las fechas van como MM-DD del año de la cosecha; el trigo de invierno se siembra en otoño del año anterior.
- Unidades: clima en mm y °C. Rendimientos y superficies del USDA se guardan en bu/acre y acres y se convierten en otra columna (maíz 1 bu/ac = 62,77 kg/ha; soja y trigo 67,25). Anotá la conversión.
- No copies párrafos de las fuentes: parafraseá y citá.

## 6. Entregar

Escribí `docs/research/<tema>.md` con este formato:

```
# <Tema>
Estado: RESUELTO | PARCIAL | SIN RESPUESTA
Pregunta: ...
Respuesta corta: ...
Detalle: ...
Fuentes: [título](URL), consultado AAAA-MM-DD
Verificación: consulta a API o página usada
Confianza: alta | media | baja
Impacto: archivo o paquete que cambia
```

Si la respuesta obliga a cambiar algo del pipeline (un nombre de producto, una fecha de inicio, un supuesto), poné **REQUIERE ACCIÓN** en la primera línea y decí qué hay que cambiar.

**Confianza**
- **alta:** fuente de nivel 1 que lo dice explícitamente y aplica a la zona o al producto.
- **media:** fuente de nivel 1 genérica (otra región) o dos fuentes de nivel 2 que coinciden.
- **baja:** una sola fuente de nivel 2, o un valor deducido.

**Si no encontrás la respuesta:** Estado SIN RESPUESTA, qué buscaste (consultas y sitios) y alternativas: otra fuente, un supuesto razonable marcado como tal, o consultar a un agrónomo.

### Tabla de cultivos (`config/cultivos.csv`)

Formato largo, una fila por cultivo y parámetro:

`cultivo, parametro, valor_min, valor_max, valor_usado, unidad, zona, fuente_titulo, fuente_url, confianza, notas`

Parámetros esperados: `fecha_siembra`, `fecha_cosecha`, `periodo_critico_inicio`, `periodo_critico_fin`, `kc_ini`, `kc_mid`, `kc_end`, `dur_ini_dias`, `dur_des_dias`, `dur_mid_dias`, `dur_fin_dias`, `t_base_c`, `t_dano_calor_c`, `t_dano_helada_c`, `prof_raices_m`, `fija_n`, `aporte_n_kgha`, `rastrojo_tms_ha`, `relacion_cn`, `familia`, `tol_sequia`, `tol_anegamiento`, `valor_forrajero`. Fechas como `MM-DD`.

## 7. Varios agentes o varias IA

- Una sub-pregunta por agente. Cada uno recibe la pregunta exacta, este skill y el formato de salida.
- Un agente **revisor**, que no hizo la búsqueda, controla cada informe: abre las URLs, confirma que el valor está ahí y baja la confianza si no está.
- Si usás otras IA (ChatGPT, Gemini, Perplexity, etc.) para acelerar, su respuesta cuenta como fuente de nivel 3: te dice dónde buscar, pero el valor entra recién cuando una fuente de nivel 1 o 2 lo confirma.
- Si dos informes se contradicen, gana el de fuente de nivel más alto. Si empatan, se reporta el rango.