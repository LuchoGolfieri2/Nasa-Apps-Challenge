# Pantalla 1 · Mapa (portada → globo → estado → condado)

- `MapLayer.tsx`: monta el mapa una sola vez y lo oculta cuando se ve otra pantalla.
- `globe.js`: el globo en deck.gl (`_GlobeView`) con la imagen Blue Marble de la NASA (GIBS, teselas WMTS). `markup.ts`: su HTML. `map.css`: estilos, todos dentro de `.maplayer`.
- `globe-data.json`: límites de estados y condados (US Census) y `stat` de cada condado (rinde de maíz y si tiene historia), que escribe `scripts/build_front_data.py`.
- El globo no gira solo: se mueve únicamente con los vuelos de cámara o cuando lo arrastra la persona.

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
- "See more": la tarjeta crece hasta cubrir la pantalla (260 ms) y se abre la historia; la ficha del condado empieza a bajar al tocar el botón. Al volver, la tarjeta ya está abierta.
- Con `prefers-reduced-motion` todo es un fundido, sin escala ni desplazamiento.
- La lógica está en `globe.js` ("tarjeta del condado"): `showCard`, `placeCard` (posición por cuadro), `closeCard`, `openHistory`.

Los condados parecidos ("Counties like yours") ya no están en el mapa: se ven al final de la historia del condado
(`history/CountyTwins.tsx`), con los datos reales de `data/next/<fips>.json`.
El clic en un estado solo vuela: ya no hay panel de estado.

## Transición portada → globo
La portada es un velo sobre el globo, quieto, chico y lejos (centrado en EE. UU.). Al tocar Start el velo se desvanece y la cámara vuela a EE. UU. en 1,9 s.
Con `prefers-reduced-motion` se acorta a casi nada.

## Datos del mapa
El color de los condados y el número de la tarjeta son **reales**: rinde de maíz del condado (USDA NASS), media 2021–2025,
en bu/acre. Sin dato (Kansas, y dos condados sin rinde publicado): gris rayado y "Missing data".
"See more" se habilita en los 294 condados con ficha: los 3 con mapa del CDL ("Full history") y el resto de IA, IL e IN
con rinde y clima. Lo genera `scripts/build_front_data.py` (`stat` en `globe-data.json`).

### "Color by": densidad de cada cultivo
Abajo a la izquierda, el botón **Color by** (con el ícono del cultivo elegido) abre la lista de capas: rinde de maíz
(por defecto) o el **% de la superficie del condado sembrado** con maíz, soja, trigo de invierno, avena, alfalfa u otro heno.
- Dato real: USDA NASS Cropland Data Layer 2025, estadísticas por condado de CropScape (`GetCDLStat`, sin clave).
  `scripts/build_crop_density.py` baja un CSV por condado a `data/raw/cultivos/cdl_stat/2025/` (si ya está, no lo vuelve a bajar)
  y escribe `crop-density.json`. El doble cultivo trigo/soja (clase 26) suma a los dos.
- Al elegir un cultivo los condados se pintan en todo el globo, también de lejos. La rampa va de casi Verde noche (0 %) al color
  del cultivo; el tope es el percentil 95 de ese cultivo, redondeado, para que la avena o el heno no queden todos oscuros.
- Sin dato: gris rayado y "Missing data", como en el rinde. El tooltip dice el valor ("Corn 61% of county area").
- Íconos: `src/ui/icons/crops/*.svg`, dibujados para el proyecto (24 px, trazo 1,75, `currentColor`).

## Imagen satelital
Las teselas de Blue Marble se piden en vivo a GIBS (`gibs.earthdata.nasa.gov`). Sin conexión se ve el océano liso con los estados encima.

`public/img/bluemarble-cornbelt.jpg` es un recorte fijo de la misma capa (`BlueMarble_ShadedRelief_Bathymetry`, WMS de GIBS,
EPSG:4326, bbox −102,64254 / 36,41186 / −84,05600 / 44,03898, 1680 × 900). Es el fondo del mapa de "Counties like yours" y
coincide con la proyección de `next/twinMapShapes.ts`.
