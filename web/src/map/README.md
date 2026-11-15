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
| `#/map/20191` | Condado elegido en el mapa, con su tarjeta abierta |
| `#/county/20191` | Historia (pantalla 2) |
| `#/county/20191/next` | Next season (pantalla 3) |

Cada vista escribe su hash, así funcionan el "atrás" del navegador, las migas y los botones Back.
"Go to Story County, IA" vuela directo a Story y abre su tarjeta; desde ahí "See more" abre la historia con `?play=1`.
Grabación: `?take=a` y `?take=c`.

## Tarjeta del condado
Al tocar un condado nace una tarjeta de 320 px desde el punto del clic y queda al lado del condado (a la derecha si entra;
si no, a la izquierda), sin taparlo. La cámara encuadra condado + tarjeta como un grupo. La tarjeta viaja pegada al condado
durante el vuelo y al arrastrar el mapa. En el celular (≤ 760 px) se apoya abajo, a todo el ancho.

- Abrir y cerrar son transiciones de CSS (no keyframes): se pueden interrumpir. Entrada 450 ms, salida 220 ms hacia el condado;
  al pasar a otro condado la actual sale en 150 ms y recién ahí nace la nueva.
- Se cierra con ×, Escape o un clic en mapa vacío; la cámara se queda y la ruta pasa a `#/state/XX`. También se cierra sola si
  te alejás del nivel de condado.
- "Next season: what to plant →" aparece solo si el modelo cubre el condado (`next-available.json`); si no, se escribe el faltante.
- "See more": la tarjeta crece hasta cubrir la pantalla (450 ms) y se abre la historia. Al volver, la tarjeta ya está abierta.
- Con `prefers-reduced-motion` todo es un fundido, sin escala ni desplazamiento.
- La lógica está en `globe.js` ("tarjeta del condado"): `showCard`, `placeCard` (posición por cuadro), `closeCard`, `openHistory`.

Los condados parecidos ("Counties like yours") ya no están en el mapa: se ven al final de la historia del condado
(`history/CountyTwins.tsx`), con los datos reales de `data/next/<fips>.json`.
El clic en un estado solo vuela: ya no hay panel de estado.

## Transición portada → globo
La portada es un velo sobre el globo, que gira chico y lejos. Al tocar Start el velo se desvanece y la cámara vuela a EE. UU. en 1,9 s.
Con `prefers-reduced-motion` se acorta a casi nada.

## Datos de prueba
El color de los condados (% de maíz) y el % de maíz de la tarjeta son **inventados** y llevan el sello
"Prototype data". Están en `globe-data.json`; reemplazar por F08/F09 cuando estén.

## Imagen satelital
Las teselas de Blue Marble se piden en vivo a GIBS (`gibs.earthdata.nasa.gov`). Sin conexión se ve el océano liso con los estados encima.

`public/img/bluemarble-cornbelt.jpg` es un recorte fijo de la misma capa (`BlueMarble_ShadedRelief_Bathymetry`, WMS de GIBS,
EPSG:4326, bbox −102,64254 / 36,41186 / −84,05600 / 44,03898, 1680 × 900). Es el fondo del mapa de "Counties like yours" y
coincide con la proyección de `next/twinMapShapes.ts`.
