---
name: "field-shift-video"
description: "Guion, grabación y edición del video demo de Field Shift para Space Apps: corto, con subtítulos en inglés y enfocado en los criterios de evaluación."
---

# Video demo — Field Shift

**Mandan las reglas oficiales del año.** Antes de empezar, confirmá en la guía de entrega de Space Apps la duración, el formato, el idioma y dónde se sube. Referencia de 2025: video de hasta 30 segundos o presentación de hasta 7 diapositivas, con subtítulos en inglés. Criterios de evaluación: Impacto, Creatividad, Validez, Relevancia y Presentación.

Para la parte técnica de edición, si está disponible, usá también el skill `video-making`.

## Estructura de 30 segundos

| Tiempo | Qué se ve | Qué se dice |
|---|---|---|
| 0–3 s | Nombre del equipo y del proyecto en pantalla | Quiénes somos |
| 3–8 s | Un dato real del problema, con su fuente | El problema, con un número |
| 8–22 s | Demo real: elegir campo → diagnóstico → comparar 3 rotaciones | Qué hace la herramienta |
| 22–27 s | Nombres de los datos de la NASA usados | Qué la hace distinta y confiable |
| 27–30 s | Cierre con link | Impacto, y que apoya al agrónomo sin reemplazarlo |

Para un pitch más largo (por ejemplo, la presentación local), es el mismo arco con más tiempo en la demo.

## Guion

- Unas 70 palabras de narración para 30 segundos. Si no entra, se corta texto, no se acelera la voz.
- Cada criterio aparece al menos una vez:
    - **Impacto:** a quién ayuda y en qué.
    - **Creatividad:** qué es nuevo.
    - **Validez:** datos reales de la NASA y un número de validación.
    - **Relevancia:** responde al desafío (3 rotaciones, salud del suelo, agua).
    - **Presentación:** prolijo, legible, en tiempo.

## Grabación

- Pantalla a 1920×1080 y 30 fps, con el campo de demo y datos reales. Nada de texto de relleno. Lo que sea prototipo, se dice.
- Hacé zoom en lo importante y mové el cursor despacio.
- Narración en inglés, o en español con subtítulos en inglés.

## Subtítulos y texto en pantalla

- Subtítulos en inglés quemados en el video y también como archivo `.srt`.
- Máximo 7 palabras por línea y al menos 2 segundos en pantalla.
- Quemarlos con ffmpeg:

```
ffmpeg -i demo.mp4 -vf subtitles=demo_en.srt -c:v libx264 -preset veryfast -crf 20 -c:a copy demo_final.mp4
```

## Derechos

- Música solo libre de derechos.
- Sin imágenes con copyright. Las imágenes de la NASA suelen ser de uso libre, pero verificá cada una y acreditá las fuentes en la descripción.

## Entrega

- MP4 (H.264), revisado completo en el celular antes de subir.
- Tener armada también la versión en diapositivas (hasta 7) con la misma historia, por si cambia el formato.