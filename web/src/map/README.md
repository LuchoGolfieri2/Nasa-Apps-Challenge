# Pantalla 1 · Mapa (portada → globo → estado → condado)

- `MapLayer.tsx`: monta el mapa una sola vez y lo oculta cuando se ve otra pantalla.
- `globe.js`: el globo (Canvas 2D + d3-geo). `markup.ts`: su HTML. `map.css`: estilos, todos dentro de `.maplayer`.
- `geo.json`: límites de US Census / Natural Earth (world-atlas + us-atlas).

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
"Go to Sumner County, KS" vuela directo a Sumner y abre su panel; desde ahí "▶ Rewind 2015–2025" abre la historia con `?play=1`.
Grabación: `?take=a` y `?take=c`.

## Transición portada → globo
La portada se desvanece con un leve zoom y desenfoque; el globo aparece desde lejos y vuela a EE.UU. en 3 s.
Con `prefers-reduced-motion` se acorta a casi nada.

## Datos de prueba
El color de los condados (% de maíz), las cifras del panel y los gemelos son **inventados** y llevan el sello
"Prototype data". Están en el bloque `DATOS DE PRUEBA` de `globe.js`; reemplazar por F08/F09 cuando estén.

## Ojo: se pisa con F11–F14 (Naim)
Esta pantalla cubre lo mismo que las tareas de Naim. Coordinar antes de mergear.
