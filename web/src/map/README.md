# Pantalla 1 · Mapa (portada → globo → estado → condado)

- `MapLayer.tsx`: monta el mapa una sola vez y lo oculta cuando se ve otra pantalla.
- `globe.js`: el globo en deck.gl (`_GlobeView`) con la imagen Blue Marble de la NASA (GIBS, teselas WMTS). `markup.ts`: su HTML. `map.css`: estilos, todos dentro de `.maplayer`.
- `globe-data.json`: límites de estados y condados (US Census) y los valores de prueba.
- Cuando nadie toca el mapa, el globo gira solo a 3°/s después de 3 s (en la portada, enseguida). Con `prefers-reduced-motion` no gira.

## Rutas
| Hash | Qué se ve |
|---|---|
| `#/` | Portada: logo + Start |
| `#/map` | Globo |
| `#/state/KS` | Estado con sus condados |
| `#/map/20191` | Condado elegido en el mapa (panel) |
| `#/county/20191` | Historia (pantalla 2) |
| `#/county/20191/next` | Next season (pantalla 3) |

Cada vista escribe su hash, así funcionan el "atrás" del navegador, las migas y los botones Back.
"Go to Story County, IA" vuela directo a Story y abre su panel; desde ahí "▶ Rewind 2015–2025" abre la historia con `?play=1`.
Grabación: `?take=a` y `?take=c`.

## Transición portada → globo
La portada es un velo sobre el globo, que gira chico y lejos. Al tocar Start el velo se desvanece y la cámara vuela a EE. UU. en 1,9 s.
Con `prefers-reduced-motion` se acorta a casi nada.

## Datos de prueba
El color de los condados (% de maíz), las cifras del panel y los gemelos son **inventados** y llevan el sello
"Prototype data". Están en `globe-data.json`; reemplazar por F08/F09 cuando estén.

## Imagen satelital
Las teselas de Blue Marble se piden en vivo a GIBS (`gibs.earthdata.nasa.gov`). Sin conexión se ve el océano liso con los estados encima.
