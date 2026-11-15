# Field Shift — Notas para el equipo de ML

*Datos de cultivos (USDA CDL) · actualizado 14/11/2026*

## TL;DR

- `data/cdl/cdl_puntos.csv` está listo: **81.000 filas** (3 condados × 3.000 puntos × 9 años, 2017–2025), sin celdas vacías.
- El **target de vigor (`ndvi_peak`) todavía no está**: lo trae Datos B (MODIS vía AppEEARS). Hasta entonces, entrenen sobre esquema/sintético o usen la tarea auxiliar de la sección 5.
- **Tres riesgos grandes:** desbalance de clases fuerte, autocorrelación espacial/temporal (no hagan split aleatorio de filas) y ruido en las etiquetas de cultivos menores.
- El modelo tiene que **reproducir efectos agronómicos conocidos** (sección 6). Si no los reproduce, algo está mal en los datos o en el split.

---

## 1. Qué hay en la tabla

| Columna | Tipo | Descripción |
|---|---|---|
| `region` | str | FIPS del condado: `19169` Story (IA), `17113` McLean (IL), `20191` Sumner (KS). **Leer como string.** |
| `point_id` | str | ID del punto, único global (`<fips>_pNNNNN`) |
| `lat`, `lon` | float | Centro del píxel de 30 m (WGS84) |
| `year` | int | Campaña (2017–2025) |
| `crop_t` | cat | Cultivo de ese año |
| `crop_t1`, `crop_t2` | cat | Cultivo 1 y 2 años antes |
| `n_maiz_prev`, `n_soja_prev`, `n_trigo_prev` | int | Veces que se sembró cada cultivo **antes** de `year` (desde 2015). Un doble cultivo suma en los dos cultivos, igual que los Crop Frequency Layers de NASS |
| `n_anios_prev` | int | Años de historia disponibles (2 a 10). Normaliza los `n_*_prev`: usen `n_maiz_prev / n_anios_prev` |

**Clases de cultivo:** `maiz`, `soja`, `trigo`, `sorgo`, `alfalfa`, `doble_trigo_soja`, `otros_dobles`, `barbecho`, `otros_cultivos`.

**Muestreo:** solo puntos que fueron cultivo los 11 años (2015–2025). Quedan afuera pasturas, campos que entran o salen de producción y zonas no agrícolas. **El modelo no aplica a lotes que alternan con pastura.**

Archivos complementarios (en `data/cdl/cdl_fieldshift.zip`):

- `cdl_transiciones.csv`: cantidad de píxeles por par cultivo_año_anterior → cultivo, por año y región, sobre **todos** los píxeles agrícolas, no solo la muestra. Sirve como prior y para chequear sesgo de muestreo.
- `cdl_superficie.csv`: hectáreas por cultivo, año y región.
- `interim/<fips>/cdl_grupos_<año>.tif`: rasters ya agrupados (30 m, EPSG:5070).

---

## 2. Distribución: desbalance fuerte

`crop_t`, % de filas por región:

| Región | maíz | soja | trigo | doble trigo/soja | sorgo | otros |
|---|---|---|---|---|---|---|
| McLean, IL | 50,4 | 49,2 | 0,2 | 0,0 | 0,0 | 0,2 |
| Story, IA | 57,9 | 41,6 | 0,0 | 0,0 | 0,0 | 0,4 |
| Sumner, KS | 10,0 | 20,9 | 40,4 | 14,6 | 4,8 | 9,3 |

Transiciones más frecuentes (`crop_t1 → crop_t`):

- **McLean:** soja→maíz 46,2% · maíz→soja 46,2% · maíz→maíz 3,9%
- **Story:** maíz→soja 40,2% · soja→maíz 39,9% · **maíz→maíz 17,8%**
- **Sumner:** **trigo→trigo 29,9%** · soja→soja 5,6% · soja→trigo 5,3% · doble→soja 5,3%

**Implicancias:**

- Todo lo que no sea maíz o soja sale casi exclusivamente de Sumner. Un modelo que recomiende trigo, sorgo o doble cultivo en Iowa o Illinois está **extrapolando**.
- Incluyan `region` (o las variables de clima y suelo que la expliquen) y reporten métricas **por región**, no solo globales.
- Clases con menos de ~1% de las filas (`alfalfa`, `barbecho`, `otros_dobles`): agrúpenlas en `otros` para el modelo, o exclúyanlas del set de cultivos a recomendar.

---

## 3. Calidad de las etiquetas (metadata oficial NASS 2025)

| Código / clase | Producer's acc. | User's acc. | Uso recomendado |
|---|---|---|---|
| Maíz (1) | 92,2% | 91,2% | Confiable |
| Soja (5) | 91,0% | 89,6% | Confiable |
| Trigo de invierno (24) | 85,5% | 82,6% | Confiable |
| Doble trigo/soja (26) | 75,0% | 83,0% | Usable con cuidado |
| Sorgo (4) | 76,4% | 78,7% | Usable con cuidado |
| Alfalfa (36) | 67,3% | 67,7% | Ruidoso |
| Otros dobles (225–254) | ~45–75% | ~50–75% | Ruidoso |

- Precisión global del CDL 2025: **75,4%**. En maíz y soja el error es bajo; en las clases menores no.
- Opciones: ponderar las muestras por la *user's accuracy* de su clase, o usar una pérdida robusta (label smoothing).
- Los Crop Frequency Layers de NASS dan 86% de precisión en maíz, 86% en soja y 90% en trigo: los conteos `n_*_prev` heredan ese nivel de error.

---

## 4. Splits: NO hacer split aleatorio de filas

Cada punto aparece 9 veces y los puntos vecinos se parecen entre sí. Un split aleatorio de filas mete información del test en el entrenamiento y **infla las métricas**.

Esquema recomendado:

1. **Split temporal:** entrenamiento 2017–2023, validación 2024, test 2025.
2. **Agrupado por punto:** `GroupKFold(groups=point_id)` dentro del entrenamiento. Un punto nunca aparece en dos folds.
3. **Bloques espaciales (opcional, más estricto):** agrupar por celdas de ~5 km (por ejemplo `round(lat/0.05), round(lon/0.05)`) en lugar de `point_id`.
4. **Generalización entre regiones:** entrenar con 2 condados y evaluar en el tercero (sobre todo IA↔IL). Es la prueba del argumento de que el modelo sirve en otras zonas.

**Ojo con 2025:** el CDL 2025 viene de origen a 10 m y nosotros lo llevamos a 30 m. Puede haber un pequeño corrimiento de distribución en el año de test: compárenlo contra 2024.

---

## 5. Qué entrenar

### Tarea principal: rendimiento esperado por cultivo (necesita `ndvi_peak`)

```
f(cultivo_candidato, crop_t1, crop_t2, n_*_prev/n_anios_prev, suelo, clima_temporada, humedad_siembra) -> ndvi_peak
```

- Para recomendar, se evalúa `f` reemplazando `crop_t` por cada cultivo candidato, con el resto de las variables fijas.
- **Riesgo de sesgo:** el productor elige el cultivo según condiciones que no vemos, así que la relación cultivo→NDVI no es puramente causal. En el pitch hablen de "rendimiento esperado según el historial", no de "efecto causal".
- NDVI no es lo mismo que rinde. Validen contra los rindes por condado de NASS QuickStats si llega a tiempo.

### Simulación de escenarios (Monte Carlo)

- Para cada punto y cultivo candidato, recorran los años históricos de clima de NASA POWER y obtengan una distribución de `f`.
- Rankeen los cultivos por media y por un percentil bajo (p10). La salida para el front es un ranking con bandas de riesgo.

### Tarea auxiliar, disponible ya: predecir el próximo cultivo

```
g(crop_t1, crop_t2, n_*_prev, region, lat, lon) -> crop_t
```

- Sirve para armar el pipeline, probar los splits y tener un baseline.
- **No es la recomendación:** predice lo que el productor *hace*, no lo que *conviene*.
- Baseline trivial a superar: "lo contrario del año anterior" en IA/IL (aprox. 80–92% de acierto).

---

## 6. Chequeos agronómicos obligatorios

Si el modelo no reproduce estos efectos documentados, revisen los datos y el split antes de seguir.

| Efecto esperado | Evidencia | Cómo verificarlo |
|---|---|---|
| Maíz después de soja > maíz después de maíz | Iowa State, 10 años en 7 sitios: el maíz continuo rindió 11–28% menos que en rotación ([Farm Progress](https://www.farmprogress.com/farming-equipment/tillage-study-corn-soybean-rotation-wins-0)) | PDP o ICE de `crop_t1` con `crop_t = maiz` |
| La soja rinde más después de 2 años de maíz que de 1 | +5% de rinde en 5 de 7 sitios (misma fuente) | Comparar `crop_t1 = crop_t2 = maiz` contra `crop_t1 = maiz, crop_t2 = soja` |
| Más soja seguida → peor soja | El nematodo de la soja baja 50–75% por año con maíz ([AgWeb](https://www.agweb.com/news/crops/scn-crop-rotation)) | Efecto de `n_soja_prev / n_anios_prev` sobre soja |
| En Kansas, el agua es el factor limitante | La soja de segunda tras trigo varía mucho según la lluvia ([K-State](https://eupdate.agronomy.ksu.edu/article/double-crop-options-after-wheat-645-1)) | Importancia de SMAP y precipitación mayor en Sumner que en IA/IL |
| Las rotaciones largas con leguminosas suben el rinde de soja | Marsden (Iowa State): 47 → 52 → 55 bu/ac ([Ontario Grain Farmer](https://ontariograinfarmer.ca/?p=1140)) | Hay poca alfalfa en los datos: tomarlo como prior, no como algo que el modelo pueda aprender |

---

## 7. Unión con los otros datasets

- **Clave de unión:** `point_id` + `year`. Clima y vegetación se agregan por **temporada de crecimiento** (abril a octubre) del mismo `year`.
- **Suelo (SSURGO):** variable estática por punto, se une solo por `point_id`.
- **Fuga de información:** las variables de vegetación de la temporada `year` (NDVI, ET) describen al cultivo que ya está sembrado. **No se usan como input** para recomendar el cultivo de `year`; solo como target. Como input, usen solo datos hasta el momento de la siembra (humedad de abril–mayo, clima de años previos).

---

## 8. Checklist antes de presentar

- [ ] Split temporal + agrupado por `point_id` (nunca filas aleatorias)
- [ ] Métricas reportadas por región
- [ ] Los 4 chequeos agronómicos de la sección 6 pasan
- [ ] Clases raras agrupadas o fuera del set de cultivos recomendables
- [ ] Salida para el front: `point_id, cultivo, media, p10, p90`
- [ ] Una frase de limitaciones en el pitch: muestra de 3 condados, etiquetas con 75% de precisión global, NDVI como proxy de rinde

## Fuentes

- USDA NASS — metadata del CDL, Cultivated Layer y Crop Frequency Layers 2025 (precisiones y códigos de la sección 3)
- [Iowa State / Farm Progress — rotación maíz-soja, 10 años](https://www.farmprogress.com/farming-equipment/tillage-study-corn-soybean-rotation-wins-0)
- [Ontario Grain Farmer — resultados de la granja Marsden](https://ontariograinfarmer.ca/?p=1140)
- [AgWeb — nematodo de la soja y rotación](https://www.agweb.com/news/crops/scn-crop-rotation)
- [K-State — opciones de segunda tras trigo](https://eupdate.agronomy.ksu.edu/article/double-crop-options-after-wheat-645-1)
