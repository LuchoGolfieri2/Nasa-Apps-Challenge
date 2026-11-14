---
name: "field-shift-frontend"
description: "Diseñar y construir la interfaz de Field Shift para productores: mapa, diagnóstico, comparación de rotaciones con incertidumbre y fuentes NASA. Usar junto con frontend-design y dataviz en este proyecto."
---

# Frontend — Field Shift

Usá este skill junto con los skills `frontend-design` (dirección estética) y `dataviz` (gráficos). Si tenés Claude Design, prototipá las pantallas ahí antes de programar.

**Usuario:** productor o asesor con poca experiencia en mapas y datos, muchas veces desde el celular en el campo. Si una pantalla necesita explicación, está mal.

## Pantallas (máximo 4)

1. **Mi campo:** elegir el lote o condado en el mapa o con un buscador, cargar la rotación actual y marcar prioridades (ahorrar agua, mejorar el suelo, ingreso extra, forraje) y restricciones (riego, maquinaria).
2. **Diagnóstico:** una franja anual de enero a diciembre que muestra meses con suelo desnudo (sobre todo el invierno entre cosecha y siembra), riesgo de helada, calor en floración y falta o exceso de agua. Debajo, la tendencia de largo plazo en una línea.
3. **Comparar rotaciones:** la actual y al menos dos alternativas lado a lado. Cada una muestra por qué se sugiere, la evidencia (dato + fuente), beneficios, riesgos y qué información falta. El resultado es un rango (p10, mediana, p90), nunca un número solo.
4. **Fuentes y límites:** qué datos se usaron, resolución y fechas, y el aviso de que la herramienta apoya pero no reemplaza al agrónomo.

## Principios

- **Idioma:** inglés llano, porque los usuarios son productores del Corn Belt y el jurado es internacional; español como opción.
- **Palabras simples:** "agua disponible en el suelo", no "humedad volumétrica". Términos técnicos (ETo, NDVI) solo con una explicación de una línea al tocarlos.
- **Unidades de EE.UU.:** bushels por acre, acres, °F y pulgadas por defecto, con opción métrica.
- **Celular primero:** botones grandes, alto contraste para usar al sol, carga rápida con conexión mala.
- **Datos precalculados:** la app lee JSON estáticos que entregan los equipos de datos y ML. No depende de APIs en vivo.
- **Incertidumbre a la vista:** rangos, nivel de confianza (alta, media, baja) y "dato faltante" escrito, nunca un hueco silencioso.
- **Cada afirmación con su fuente:** una etiqueta tipo "NASA SMAP · 9 km · 2015–2025".
- **Accesible:** paleta apta para daltonismo, nunca información solo por color, contraste WCAG AA.
- **Mapa simple:** MapLibre o Leaflet con los polígonos de condados. Capas satelitales de NASA GIBS solo si suman.
- **Separar modelo y reglas:** mostrar qué sale del modelo de ML y qué de reglas agronómicas.

## Stack sugerido

Sitio estático (Vite + React o HTML simple) que lee los JSON de `data/ml/` y `data/processed/`, publicado gratis (GitHub Pages o Vercel). Incluí un "campo de demo" precargado para que la demo nunca falle.

## Antes de dar por terminado

- Capturá cada pantalla a 375 px y a 1440 px de ancho y revisalas.
- Prueba de 10 segundos con alguien que no sea del equipo: ¿puede decir qué rotación tiene menos riesgo?
- Ningún texto de relleno ni dato inventado. Lo que sea prototipo, se marca como prototipo.
- No uses el logo de la NASA como si el producto fuera oficial. Seguí las guías de marca de Space Apps.

## Errores a evitar

- Un dashboard con 20 gráficos.
- Jerga técnica.
- Precisión falsa ("rinde 187,34 bu/acre").
- Que la app sugiera sin razones, sin fuente, sin rango o sin confianza.