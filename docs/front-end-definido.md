# Field Shift: flujo del front-end

Qué ve y qué hace el productor en cada paso, de dónde sale cada dato y qué falta decidir. Es la referencia para construir la app.

NASA Space Apps Challenge 2026 · Iowa, Illinois y Kansas · Versión del 14 de noviembre de 2026

## El recorrido

Un solo camino hacia adentro: del mundo al condado, del pasado a la próxima campaña. El mapa se achica a medida que entran los números, pero no desaparece.

1. **Globo**Tres estados encendidos. Tocar uno.
2. **Estado**Condados pintados. Elegir el propio.
3. **Historia del condado**Línea de tiempo de lo que pasó ahí.
4. **Próxima campaña**Rotación actual y alternativas, con condados gemelos.
5. **Fuentes y límites**Siempre a un toque, desde cualquier paso.

Los pasos 1 y 2 son la misma pantalla (el mapa) en dos niveles de zoom, así que la app tiene cuatro pantallas.

Paso 1 · Pantalla Mapa

## Globo

Objetivo: que en tres segundos se entienda dónde funciona la herramienta y que puede crecer.

### Qué se ve

- Globo 3D que gira despacio y se detiene sobre Estados Unidos.
- Iowa, Illinois y Kansas encendidos, con un brillo que late suave. El resto del mundo, apagado.
- Lupa de búsqueda arriba.
- Una línea de texto: qué es Field Shift, en una frase.

### Qué puede hacer

- Girar y acercar el globo.
- Tocar un estado encendido: la cámara vuela hacia adentro (paso 2).
- Buscar un lugar. Si está en los tres estados, vuela directo al condado. Si está afuera, vuela hasta ahí y avisa que todavía no está disponible.

**Texto fuera de cobertura**"Field Rewind doesn't cover this area yet. It works in Iowa, Illinois and Kansas."

### Datos

- Contornos de países y de estados de EE. UU. (Natural Earth o Census), simplificados para que pesen poco.
- Lista de estados activos, leída de `config/config.yaml`. Sumar un estado no toca el código.

### Especificaciones

- MapLibre en proyección globo. El vuelo usa la animación de cámara de la librería.
- La animación de giro y el latido se apagan con `prefers-reduced-motion`.
- Los estados también se pueden elegir desde una lista con teclado, no solo tocando el mapa.
- Si el dispositivo no soporta WebGL, se muestra un mapa plano con los mismos tres estados.

Paso 2 · Pantalla Mapa

## Estado

Objetivo: que el productor ubique su condado y vea, antes de cargar nada, cómo está su zona frente a las vecinas.

### Qué se ve

- El estado ocupa la pantalla, con sus condados dibujados.
- Cada condado pintado según una sola variable (ver decisiones abiertas). Propuesta: meses al año con el suelo desnudo.
- Leyenda de la escala, con unidad y fuente.
- Al pasar o tocar un condado: nombre y valor.

### Qué puede hacer

- Tocar un condado: queda resaltado y aparece el botón para ver su historia.
- Buscar el condado por nombre con la lupa.
- Volver al globo.

### Datos

| Qué | Archivo | Columnas |
| --- | --- | --- |
| Polígonos y nombres | `data/reference/condados.gpkg`, `condados.csv` | `fips`, `condado`, `estado` |
| Suelo desnudo por condado | `vegetacion/fenologia_anual.csv` | `dias_ndvi_lt03_invierno`, `duracion_dias` |

### Especificaciones

- Escala de un solo color, de claro a oscuro, apta para daltonismo.
- Condado sin dato: rayado y con la leyenda "Missing data", nunca en blanco ni en cero.
- La unidad de trabajo es el condado. No se marca un lote: los datos no dan para decir algo distinto del promedio del condado.

**Texto que lo aclara**"Results are for the whole county, not for a single field."

Paso 3 · Pantalla Historia

## Historia del condado

Objetivo: que el productor tenga una idea general de cómo funcionó esa tierra, con datos reales y sin pedirle nada todavía.

### Qué se ve

- El mapa, chico y fijo (arriba en celular, al costado en escritorio), con el condado resaltado.
- Una línea de tiempo de 2008 a 2025 que el usuario recorre con un deslizador.
- Para el año elegido, una ficha con: qué se sembró, cuánto rindió, cómo vino el verdor en la temporada y el clima de ese año.
- Arriba de todo, un resumen de una frase para todo el período.
- Un bloque con las rotaciones más comunes del condado.

### Qué puede hacer

- Mover el deslizador o tocar un año. También con flechas del teclado.
- Cambiar de cultivo (maíz o soja) para el rendimiento.
- Tocar un término técnico y leer la explicación en una línea.
- Ir a las opciones para la próxima campaña (botón principal).

### Datos de la ficha del año

| En pantalla | Archivo | Columnas | Cobertura |
| --- | --- | --- | --- |
| Qué se sembró (% del área) | `cultivos/rotacion_anual.csv` | % de maíz, soja, trigo, alfalfa, heno, barbecho | 2008–2025 |
| Rendimiento | `cultivos/produccion_anual.csv` | `rend_bu_ac`, `flag_nass` | 2000–2025 |
| Verdor en la temporada | `vegetacion/vegetacion_16d.csv` | `ndvi`, `ndvi_maiz`, `ndvi_soja` | 2000–2025 |
| Lluvia, calor, heladas | `clima/clima_anual.csv`, `clima_mensual.csv` | `prec_temporada_mm`, `dias_tmax_gt35`, `doy_ultima_helada` | 1981–2025 |
| Agua en el suelo | `agua/agua_mensual.csv` | `sm_rootzone_m3m3`, `sm_rootzone_anom_z` | 2015–2025 |
| Rotaciones más comunes | `cultivos/rotacion_anual.csv`, `rotacion_secuencia.csv` | `pct_maiz_tras_soja`, `pct_maiz_tras_maiz`, … | 2008–2025 |

Nombres según el contrato del CLAUDE.md. Confirmar con el equipo de datos que los archivos entregados coinciden.

### Especificaciones

- El rendimiento de cada año se muestra contra lo habitual del condado, con palabras: por encima, parecido, por debajo.
- El verdor se dibuja como curva de la temporada, con la del año elegido resaltada sobre el rango de los demás años.
- El clima va como contexto del rendimiento, no como gráfico aparte: "año seco", "julio muy caluroso".
- Antes de 2015 no hay agua en el suelo: se escribe "Missing data: soil water starts in 2015".
- Años con rendimiento oculto por NASS (`flag_nass`): "Missing data", no un cero.
- Máximo tres gráficos visibles a la vez.

**Resumen del período, contable**"Corn yielded above its usual level here in 11 of the last 18 years."

**No decir "porcentaje de éxito".** Se cuentan años, y se dice contra qué se compara.

**No decir qué rotación rindió más.** El rendimiento existe solo por condado. Sí se puede decir cuáles son las más comunes y, como aproximación, qué tan verde estuvo el maíz después de soja frente al maíz después de maíz. Eso es vigor, no rendimiento, y se escribe así.

Paso 4 · Pantalla Próxima campaña

## Opciones para la próxima campaña

Objetivo: comparar la rotación actual con dos alternativas y mostrar la evidencia de cada una. La herramienta sugiere una opción según las prioridades, con razones, rango y confianza (cambio del 14/11).

### Antes de comparar: dos preguntas

- Qué sembrás hoy (rotación, año por año). Viene sugerida con la más común del condado.
- Qué te importa: ahorrar agua, mejorar el suelo, ingreso extra, forraje.
- El suelo no se carga: se muestra el del condado para que lo confirme o corrija.
- No se pregunta por maquinaria: no hay datos para usar esa respuesta.

### Qué se ve

- La rotación actual y al menos dos alternativas, lado a lado (apiladas en celular).
- Para cada una: por qué aparece, resultado como rango, nivel de confianza, beneficios, riesgos y qué dato falta.
- Dentro de cada alternativa, sus condados gemelos.

### Condados gemelos

- Para un cultivo que el condado casi no sembró, se buscan condados con suelo y clima parecidos que sí lo sembraron.
- Se muestran de tres a cinco: nombre, en qué se parecen, cuánta superficie tuvieron de ese cultivo, cómo les rindió y qué prácticas son comunes ahí.
- La comparación de suelo y clima va en una tabla corta, el condado propio contra cada gemelo.
- Si hay menos de tres gemelos, la confianza es baja y se dice.

### Qué puede hacer

- Cambiar prioridades y ver cómo cambian las alternativas.
- Abrir una alternativa para ver sus gemelos y su evidencia.
- Tocar un gemelo y verlo en el mapa.
- Ir a Fuentes y límites.

### Datos

| En pantalla | Archivo | Columnas |
| --- | --- | --- |
| Rangos de resultado | JSON del equipo de ML (`data/ml/`) | p10, mediana, p90 y confianza por rotación |
| Suelo para confirmar y para buscar gemelos | `suelo_terreno/suelo_terreno_estatico.csv` | agua disponible, drenaje, textura, NCCPI, pendiente |
| Clima para buscar gemelos | `clima/clima_anual.csv` | `gdd_temporada`, `prec_temporada_mm`, heladas |
| Dónde se sembró el cultivo y cómo rindió | `cultivos/rotacion_anual.csv`, `produccion_anual.csv` | % del área, `rend_bu_ac` |
| Prácticas de los gemelos | `cultivos/practicas_censo.csv` | `pct_cobertura`, `pct_labranza_cero`, `pct_drenaje_tile`, `pct_riego` |

### Especificaciones

- Todo resultado es un rango: año malo, año típico, año bueno (p10, mediana, p90). Nunca un número solo.
- Confianza alta, media o baja, con el motivo en una frase.
- Cada afirmación lleva su fuente y dice si sale del modelo o de una regla agronómica.
- Una opción lleva "Suggested for your priorities" con dos razones con fuente; la actual va primero.
- El ingreso por acre solo se muestra si hay precios y costos; si no, "Missing data".

**Cómo se presenta un gemelo**"Counties like yours that grew oats: 4. Similar soil and weather doesn't guarantee the same result."

**Límites de los gemelos.** Son condados, no lotes. Las prácticas son promedios del condado y solo de 2012, 2017 y 2022. Avena, trigo y alfalfa son escasos en estos tres estados.

Paso 5 · Pantalla Fuentes

## Fuentes y límites

Objetivo: que cualquiera pueda ver de dónde sale cada dato y qué no puede decir la herramienta. Se abre desde cualquier pantalla.

### Qué se ve

- Primero, el aviso: apoya la decisión, no reemplaza al agrónomo.
- Cómo leer los rangos, la confianza y "Missing data".
- Tabla de fuentes: qué dice cada una, resolución y fechas.
- Lista de lo que la herramienta no ve.
- Aclaración de que no es un producto oficial de la NASA ni del USDA. Sin logo de la NASA.

### Fuentes a listar

- NASA POWER: clima diario, 1981–2025.
- NASA SMAP: agua en el suelo, 9 km, 2015–2025.
- NASA MODIS: verdor, 250 m, cada 16 días, 2000–2025.
- NASA GPM IMERG: lluvia, 2000–2025.
- USDA NASS: rendimiento y superficie por condado.
- USDA Cropland Data Layer: qué se sembró, 30 m, 2008–2025.
- USDA Censo Agropecuario: prácticas, 2012, 2017, 2022.
- USDA gSSURGO: suelos.

## Reglas para todas las pantallas

**Idioma**Inglés llano por defecto, español como opción. "Water in the soil", no "volumetric moisture".

**Unidades**bu/acre, acres, °F y pulgadas por defecto, con opción métrica.

**Celular primero**Botones de 48 px o más, alto contraste para el sol, carga rápida con mala señal.

**Datos precalculados**La app lee JSON estáticos. Ninguna pantalla depende de una API en vivo.

**Dato faltante**Se escribe "Missing data" y qué falta. Nunca un hueco, un cero ni un guion.

**Sin precisión falsa**Enteros para bu/acre y días. "About 200", no "201,34".

**Accesible**Paleta apta para daltonismo, nada indicado solo por color, contraste AA, todo operable con teclado.

**Campo de demo**Un condado precargado, para que la demo funcione aunque falle la búsqueda.

## Decisiones abiertas

- **Gemelos:** ¿viven dentro de Próxima campaña, como está acá, o tienen pantalla propia?
- **Capa del mapa de estado:** ¿meses de suelo desnudo, agua en el suelo o rendimiento de maíz? Una sola por defecto.
- **"Lo habitual":** contra qué se compara el rendimiento de un año (promedio de los cinco anteriores, tendencia, mediana del período). Lo define el equipo de ML, para no mezclar información del futuro.
- **Parecido entre condados:** qué variables de suelo y clima entran y con qué peso. Tiene que poder explicarse en una frase.
- **Vigor por rotación:** comparar el verdor del maíz según el cultivo anterior necesita cruzar el NDVI con las transiciones por píxel. Ese cálculo no está en el contrato actual de datos.
- **Estilo del globo:** estilizado oscuro o imagen satelital.
- **Tema de los paneles:** claro (se lee mejor al sol) o todo oscuro como el globo.

## Orden de construcción sugerido

1. Historia del condado. Es el corazón, usa datos ya procesados y no necesita el modelo.
2. Próxima campaña con gemelos.
3. Globo y vuelo de entrada.
4. Mapa de estado pintado.
5. Fuentes y límites, y repaso de accesibilidad a 375 px y 1440 px.