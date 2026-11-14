# Diseño de la interfaz — Field Shift

Estado al 14 de noviembre de 2026. **El flujo está definido; la dirección visual todavía no.**

- Flujo acordado, con el detalle por pantalla: https://claude.ai/artifact/LhqJ6Gnq1W9USxEXsHyuy9
- Primer prototipo (dirección "Crop calendar", descartada como estética general): https://claude.ai/artifact/YM1kyawGtAcziJY9JRRmin

Los dos enlaces son privados hasta que se compartan desde el menú Share.

## Qué cambió

El primer prototipo eran cuatro pantallas tipo formulario, sobrias y pensadas para leerse al sol. Se descartó porque no destaca. La idea nueva pone un mapa como protagonista y ordena todo como un recorrido hacia adentro: del mundo al condado, y del pasado a la próxima campaña.

## Flujo

| Paso | Pantalla | Qué pasa |
|---|---|---|
| 1 | Mapa | Globo 3D enfocado en EE. UU., con Iowa, Illinois y Kansas encendidos y una lupa de búsqueda. Tocar un estado dispara el vuelo de entrada. |
| 2 | Mapa | El estado con sus condados pintados según una variable. Se elige el condado. |
| 3 | Historia del condado | Línea de tiempo 2015–2025 que el usuario recorre: qué se sembró, cuánto rindió, verdor (NDVI), clima (POWER) y agua en el suelo (SMAP, desde 2015). Rotaciones más comunes. |
| 4 | Próxima campaña | Dos preguntas (rotación actual y prioridades), y después la rotación actual frente a dos alternativas, con condados gemelos como evidencia. |
| 5 | Fuentes y límites | Accesible desde cualquier paso. |

Los pasos 1 y 2 son la misma pantalla en dos niveles de zoom: la app tiene cuatro pantallas.

## Decisiones tomadas

- **La unidad es el condado, no el lote.** Todos los datos son por condado y se dice en pantalla.
- **Sugiere, con razones.** (Cambio del 14/11, ver [[front-back-connection-spec]].) Una opción lleva "Suggested for your priorities" con dos razones con fuente, su rango y su confianza; las demás siguen visibles.
- **No se habla de "porcentaje de éxito".** Se cuentan años: "en 11 de los últimos 18 el maíz rindió por encima de lo habitual".
- **No se dice qué rotación rindió más.** El rendimiento existe solo por condado. Se puede decir cuáles son las más comunes y, como aproximación, comparar el verdor; eso es vigor, no rendimiento.
- **Gemelos son condados, no terrenos.** Suelo y clima parecidos que sí sembraron el cultivo. Con menos de tres gemelos, confianza baja.
- **No se pregunta por maquinaria.** No hay datos para usar esa respuesta.
- **El suelo no se carga.** Se muestra el del condado para confirmar o corregir.
- **Mapa con MapLibre en proyección globo.** Es la librería prevista para la app y trae el vuelo de cámara.

## Reglas que se mantienen

Valen para cualquier dirección visual que se elija.

- Inglés llano por defecto, español como opción. Términos técnicos solo con explicación de una línea.
- Unidades de EE. UU. por defecto (bu/acre, acres, °F, pulgadas), con opción métrica.
- Celular primero: áreas táctiles de 48 px o más, carga rápida con mala señal.
- La app lee JSON estáticos; ninguna pantalla depende de una API en vivo.
- Todo resultado es un rango: año malo, típico, bueno (p10, mediana, p90). Nunca un número solo.
- Confianza alta, media o baja, con el motivo en una frase.
- Dato faltante escrito ("Missing data" y qué falta). Nunca un hueco, un cero ni un guion.
- Cada afirmación con su fuente, y marcado si sale del modelo o de una regla agronómica.
- Sin precisión falsa: enteros para bu/acre y días.
- Paleta apta para daltonismo, nada indicado solo por color, contraste WCAG AA, todo operable con teclado.
- Animaciones (giro del globo, latido, vuelo) apagadas con `prefers-reduced-motion`.
- Sin logo de la NASA; se aclara que no es un producto oficial.
- Un condado de demo precargado, para que la demo nunca falle.

## Componentes que se pueden reutilizar del primer prototipo

Están dibujados en el lienzo anterior y siguen sirviendo, con la estética que se defina:

- **Terna de valores:** tres celdas (bajo, típico, alto) con la del medio resaltada y un título que dice qué se mide.
- **Barra de rango:** de p10 a p90 con marca en la mediana, solo cuando hay varias filas sobre un mismo eje.
- **Medidor de confianza:** tres segmentos más la palabra.
- **Etiqueta de fuente:** producto en negrita, después resolución y período.
- **Etiquetas "Model" y "Rule".**
- **Caja de dato faltante:** borde punteado y muestra rayada.
- **Franja de calendario:** bandas de cultivo sobre fondo rayado de suelo desnudo. Puede servir dentro de Historia y de Próxima campaña para mostrar las rotaciones.

### Colores de cultivo ya validados

`#E69F00` maíz, `#009E73` soja, `#56B4E9` cobertura y forraje, `#D98BB5` cereal fino. Pasan la validación de daltonismo sobre fondo blanco (peor par ΔE 8,9) y llevan texto en tinta `#14232B` con contraste de 4,70 o más. **Sobre un fondo oscuro hay que volver a validarlos**: la verificación se hizo solo sobre blanco.

## Sin definir

- ~~**Dirección visual:** paleta, tipografía y tema.~~ **Paleta y tipografías definidas el 14/11** en `docs/specs/mockups-secciones.md`: Verde noche `#0F2A1D`, Verde campo `#2F7D4F`, Verde brote `#8ED081`, Oro trigo `#E9B949`, Papel `#F6F1E4`, Tierra `#6B4A2F`, Rojo alerta `#E5484D`; Bricolage Grotesque + DM Sans. Falta la composición (mockups).
- **Estilo del globo:** estilizado oscuro o imagen satelital.
- **Tema de los paneles:** claro (se lee mejor al sol) o todo oscuro como el globo.
- **Capa del mapa de estado:** meses de suelo desnudo, agua en el suelo o rendimiento de maíz.
- **Gemelos:** dentro de Próxima campaña o con pantalla propia.
- **"Lo habitual" en el rendimiento:** contra qué se compara cada año. Lo define el equipo de ML.
- **Parecido entre condados:** qué variables entran y con qué peso.
- **Vigor por rotación:** necesita cruzar NDVI con las transiciones por píxel, un cálculo que no está en el contrato de datos.

## Pendiente de verificar

Los nombres de archivos y columnas del documento de flujo salen del contrato del CLAUDE.md. Falta confirmarlos contra los CSV procesados.
