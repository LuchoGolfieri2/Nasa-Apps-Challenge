---
tags: [field-rewind, mockups]
estado: esperando aprobación
actualizado: 2026-11-14
---

# Mockups por sección — Field Rewind

Qué se mockea, sección por sección, antes de generar 5 variaciones de cada una con kie.ai (skill `imagegen`). Sale de [[front-back-connection-spec]]. **La paleta y las tipografías son fijas:** las 5 variaciones exploran **composición, jerarquía y tratamiento visual**, no colores.

## Identidad (fija)

| Rol | Color | Uso |
|---|---|---|
| Verde noche | `#0F2A1D` | Fondo principal (globo, paneles oscuros) |
| Verde campo | `#2F7D4F` | Botones primarios, acentos sobre claro |
| Verde brote | `#8ED081` | Acento sobre oscuro, glow de los estados, "Suggested" |
| Oro trigo | `#E9B949` | Segundo acento: play ⏪/▶, año activo, resaltados |
| Papel | `#F6F1E4` | Texto sobre oscuro; fondo de paneles claros |
| Tierra | `#6B4A2F` | Suelo desnudo, barbecho, datos de suelo |
| Rojo alerta | `#E5484D` | Solo riesgo y confianza baja. Nunca como "malo" decorativo |

- **Bricolage Grotesque** para títulos; **DM Sans** para datos y texto (cifras tabulares).
- Logo: ícono de doble flecha rewind (verde + oro) + "Field **Rewind**".
- **Colores de cultivo (propuesta, a validar con daltonismo sobre verde noche):** maíz = Oro trigo, soja = Verde brote, trigo = `#D9A066` (trigo claro), sorgo = `#C2703D`, alfalfa/heno = `#56B4E9`, barbecho = Tierra. Se valida antes de construir; en los mockups se usan así.

## Reglas para todos los mockups

- 1920×1080, escritorio. Interfaz en inglés.
- Contenido realista de **Sumner County, Kansas** (salvo la sección 1). Números ilustrativos, rotulados en el mockup como prototipo.
- Cada dato lleva su chip de fuente ("NASA POWER", "USDA CDL"…). Sin logo de la NASA.
- Lo faltante se escribe "Missing data"; lo de prueba lleva sello "Prototype data".
- Marca "AI-generated" en la esquina (requisito de Space Apps para imágenes con IA).
- Evitar el look de dashboard genérico: poco texto, una cosa protagonista por pantalla.

---

## 1. Globo de entrada

**Objetivo:** en 3 s se entiende qué es y dónde funciona. Es la toma A del video.

- Globo 3D oscuro (verde noche) con **glow fuerte** de atmósfera, referencia MapTap. Continentes como siluetas apenas más claras.
- Iowa, Illinois y Kansas encendidos en verde brote, con halo que late.
- Arriba a la izquierda: logo. Arriba a la derecha: lupa "Search a county or place".
- Abajo, centrado: tagline *"Rewind your land before you decide."* + botón primario **"Try Story County"** + texto chico "Works in Iowa, Illinois and Kansas".
- Chip discreto: "Built with NASA POWER · SMAP · MODIS and USDA data".

**Variaciones a explorar:** encuadre del globo (centrado / desplazado a la derecha con texto a la izquierda / recortado abajo), intensidad del glow, cómo se marcan los estados (relleno, contorno brillante, pin).
**Extra:** una de las 5 a 960×1080 para verificar que se lee en la media pantalla del video.

## 2. Mapa de estado

**Objetivo:** ubicar el condado y ver la zona antes de entrar.

- Kansas ocupando la pantalla con sus 105 condados, pintados en escala de un color (verde) por **% de maíz en la superficie sembrada**; condados sin dato rayados con "Missing data".
- **Sumner resaltado** (contorno oro trigo) con tarjeta flotante: nombre, valor de la capa, chip "USDA NASS", botón **"See its history ⏪"**.
- Leyenda con unidad y fuente. Migas: Globe › Kansas. Aviso chico: "Results are for the whole county, not for a single field."

**Variaciones:** tarjeta flotante vs panel lateral fijo, leyenda vertical vs horizontal, estado plano vs inclinado en 3D.

## 3. Historia — Rewind (pantalla protagonista, toma B)

**Objetivo:** ver 2015–2025 pasar y entender qué cambió.

- **Condado pintado lote a lote** (raster del CDL de ese año, colores por cultivo). Ocupa ~mitad de la pantalla.
- **Bar chart race**: superficie por cultivo de ese año, barras ordenadas (wheat, corn, soy, sorghum…) con hectáreas/acres.
- **Titular del año**, grande: *"2022 — Wheat keeps shrinking. Corn now covers twice its 2015 area."*
- **Línea de tiempo** 2015–2025 con botones ⏪ y ▶, año activo en oro trigo, marcas en años destacados (año seco).
- Botón primario: **"Options for next season →"**.

**Variaciones:** mapa izquierda + barras derecha / mapa grande con barras superpuestas / barras arriba y mapa abajo; timeline abajo como barra de video vs timeline vertical; titular sobre el mapa vs en panel.

## 4. Historia — Detalle del año

**Objetivo:** el "por qué" de ese año, debajo del rewind (scroll) o en panel desplegable.

- **Rinde** de maíz/soja/trigo contra lo habitual, en palabras: "Above usual" / "Similar" / "Below usual", con el número entero en bu/acre.
- **Verdor**: curva de la temporada del año, resaltada sobre la banda de los demás años (NASA MODIS).
- **Clima** como etiquetas: "Dry July", "3 days over 95 °F", "Last frost Apr 22" (NASA POWER).
- **Agua en el suelo**: "Drier than usual" con una barra simple (NASA SMAP).
- **Rotaciones más comunes** del condado: "Wheat → Wheat 30%", "Soy → Soy 6%"…
- Uno de los bloques con sello "Prototype data" y otro con "Missing data", para ver cómo se ven.
- Máximo 3 gráficos visibles.

**Variaciones:** grilla de 4 tarjetas / una columna tipo informe / panel lateral que se abre sobre el rewind.

## 5. Próxima campaña — Opciones con sugerencia

**Objetivo:** comparar 3 opciones y ver cuál se sugiere y por qué.

- Arriba: **"You grow now"** con chips editables (Wheat → Wheat → Soy) precargados desde CDL.
- **Prioridades** como toggles: Lower risk in bad years · Higher income · Soil health · Save water.
- **3 tarjetas lado a lado**: la actual primero. Cada una: nombre de la rotación, rango de rinde en bu/acre (bad / typical / good year = p10 / mediana / p90), confianza (3 segmentos + palabra + motivo), 2 beneficios y 1 riesgo con etiqueta "Model" o "Rule", "Missing data: costs not loaded yet" en ingreso.
- Una tarjeta marcada **"Suggested for your priorities"** (verde brote) con 2 razones.
- Una alternativa con **"Low confidence: few counties like yours grow this"** en rojo alerta.
- Mapa chico con el condado.

**Variaciones:** tarjetas verticales vs filas horizontales con una barra de rango común; sugerencia como insignia vs tarjeta elevada/más grande; prioridades arriba vs columna izquierda.

## 6. Condados gemelos — EN REVISIÓN

**Objetivo:** mostrar que la evidencia viene de condados parecidos, aunque estén lejos.

- **Opción A:** globo/mapa alejado con **arcos brillantes** desde Sumner hacia 3–5 gemelos en IA, IL y KS; al lado, la tarjeta de la opción con sus gemelos resaltados.
- **Opción B:** botón "Counties like yours" que abre un panel con la lista y el mapa.
- Cada gemelo: nombre y estado, "Similar in: soil water, growing season heat", "Grew corn on 41% of fields", rinde típico.
- Frase: *"Counties like yours that grew corn: 4. Similar soil and weather doesn't guarantee the same result."*

**Variaciones:** 3 de la opción A (arcos sobre globo / sobre mapa plano / arcos + tabla) y 2 de la opción B. Sirve para decidir A o B.

## 7. Fuentes y límites

**Objetivo:** confianza para el jurado.

- Aviso arriba: "Field Rewind supports your decision. It doesn't replace your agronomist."
- Cómo leer: rango (bad / typical / good year), confianza, "Missing data", "Prototype data", "Model" vs "Rule".
- Tabla de fuentes: dataset, qué aporta, resolución, período (NASA POWER, SMAP, MODIS, GPM IMERG; USDA NASS, CDL, Census of Agriculture, gSSURGO).
- Qué no ve la herramienta. "Not an official NASA or USDA product." "More regions as data is added."
- Botón de la capa satelital NASA GIBS.

**Variaciones:** modal sobre la app vs página propia; tabla vs tarjetas por fuente.

## 8. Hoja de componentes

Una sola lámina (no 5 variaciones; 1 o 2 bastan) con: chip de fuente, sello "Prototype data", caja "Missing data", medidor de confianza, barra de rango p10–p90, etiquetas "Model"/"Rule", botón primario y secundario, toggle de prioridad, aviso fuera de cobertura (*"Field Rewind doesn't cover this area yet. It works in Iowa, Illinois and Kansas."*).

---

## Resumen de la generación

| # | Sección | Variaciones |
|---|---|---|
| 1 | Globo de entrada | 5 (una a 960×1080) |
| 2 | Mapa de estado | 5 |
| 3 | Historia — Rewind | 5 |
| 4 | Historia — Detalle del año | 5 |
| 5 | Próxima campaña | 5 |
| 6 | Condados gemelos (A/B) | 5 |
| 7 | Fuentes y límites | 5 |
| 8 | Hoja de componentes | 1–2 |

Total: ~37 imágenes. Orden sugerido si hay que priorizar: 3 → 5 → 1 → 6 (lo que sale en el video primero).
