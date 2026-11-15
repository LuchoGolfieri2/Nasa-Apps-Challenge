# Mapa del CDL en baja resolución: qué hacer y quién hace qué

**Objetivo:** que los ~940 condados que no tienen el mapa lote a lote (30 m) tengan uno a 150 m ("Lower detail"),
con sus porcentajes por cultivo, transiciones y titulares. Sale de CropScape (USDA CDL) y no se inventa nada.
Es la opción A de F32 (ver `TAREAS.md`). Cada persona procesa sus estados y sube una rama; los archivos son por
condado, así que los PR no chocan.

Illinois ya está hecho (101 condados, ~20 MB). Faltan 10 estados.

## Reparto

| Persona | Estados (código FIPS) | Condados |
|---|---|---:|
| **Walicki** | Indiana `18`, Dakota del Norte `38`, Wisconsin `55` | 211 |
| **Seba** | Iowa `19`, Minnesota `27` | ~182 |
| **Loubet** | Missouri `29`, Kansas `20` | ~204 |
| **Diego** | Nebraska `31`, Ohio `39`, Dakota del Sur `46` | ~242 |

Los condados de demo (Story IA, McLean IL, Sumner KS) ya tienen 30 m y el script los saltea solo.
Estimación: 1,5 a 3 horas por persona, según cuánto responda CropScape (cada archivo de ~3 MB tarda 20–40 s).

## Antes de empezar (una vez)

1. Esperar a que Walicki avise que el script y Illinois están en `main`; después:
   ```bash
   git checkout main && git pull
   ```
2. Crear tu rama (con tus estados):
   ```bash
   git checkout -b front/lowres-<tu-nombre>
   ```
3. Entorno de Python con `numpy`, `pillow` y `rasterio` (el repo usa `.venv`):
   ```bash
   python3 -m venv .venv && .venv/bin/pip install numpy pillow rasterio pandas
   ```
   No hace falta ninguna clave: CropScape es público. Si ya tenés `.venv` con esas librerías, saltear este paso.

## Correr (un comando por estado)

```bash
.venv/bin/python scripts/build_lowres_cdl.py --estado 18 --workers 8
```

- Cambiá `18` por el código de cada uno de tus estados, de a uno.
- Es **idempotente**: si se corta (Ctrl+C, internet, servidor caído), volvé a correr el mismo comando y retoma;
  lo ya calculado queda en `data/interim/cultivos/cdl_lowres/` y no se vuelve a bajar.
- Si CropScape falla o se pone muy lento, bajá `--workers` a 4. Un año que falla queda afuera y la app lo muestra
  como "Missing data": no hay que arreglarlo a mano.
- Para probar antes de lanzar todo: agregá `--limite 2` (solo 2 condados).

## Verificar

```bash
python3 scripts/check_lowres.py --estado 18
```

Tiene que decir `N/N con mapa`. Si lista condados para revisar, volvé a correr el script del estado.
Después abrí 2 o 3 condados en la app (`npm --prefix web run dev`):

```
http://localhost:5173/#/county/<fips>?year=2023
```

Se tiene que ver el mapa pintado, la etiqueta "lower detail" abajo, la carrera de barras con cultivos y el
titular del año. Un condado con muy poca tierra de cultivo puede verse casi vacío: es normal.

## Subir

Solo estos archivos (de tus estados):

```bash
git add web/public/data/cdl/18* web/public/data/county/18*.json
git commit -m "CDL baja resolución: Indiana"
git push -u origin front/lowres-<tu-nombre>
```

- **No** subas `data/interim/` ni nada de `scripts/` (el script ya está en `main`).
- **No** toques fichas de condados de otros estados.
- Abrí un PR a `main` con título "CDL baja resolución: <estados>". Como cada uno toca archivos distintos, se
  pueden mergear en cualquier orden.

## Si alguien termina antes

Que tome los condados de otra persona que vaya atrás (avisen en el chat para no duplicar) con el mismo comando
y `--estado`. Lo ya calculado se retoma. Lo que no llegue a tiempo queda con la pantalla actual (mapa del estado
por rinde), que ya funciona.

## Qué hace el script (para quien quiera revisarlo)

Por condado y año (2015–2025): pide a CropScape la URL del GeoTIFF de 30 m, lo baja a memoria (no se guarda),
calcula superficie por cultivo, transiciones y rotaciones comunes sobre los 30 m, reduce 5× (150 m, clase más
frecuente por bloque) y escribe `web/public/data/cdl/<fips>/<año>.png` (gris = clase × 20). Completa
`county/<fips>.json` sin tocar el rinde ni el clima. Código: `scripts/build_lowres_cdl.py`.

## Regla del repo

El tráfico total de descarga (~30 GB entre todos) pasa el límite de 5 GB de la regla 6 de `CLAUDE.md`:
**confirmar con el equipo antes de lanzar.**
