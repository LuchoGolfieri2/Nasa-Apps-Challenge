# Informe de entrega — Field Rewind (NASA Space Apps Challenge 2026)

Equipo **Pepers** · Desafío **Field Shift: Adapting Farms with NASA Data** · Borrador del 15/11/2026, con el modelo de 10 estados.

Este archivo tiene dos partes: lo que pide Space Apps y en qué estamos (en español), y el texto de cada campo del formulario, listo para copiar (en inglés, como lo leen los jueces). La versión editable está en el doc "Field Rewind — Space Apps project page (draft)".

---

## 1. Qué pide Space Apps

Fuente: [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) y [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide). Confirmar antes de enviar por si cambiaron.

| # | Campo | Qué piden | Estado |
|---|---|---|---|
| 1 | Project Name | Nombre corto que diga el problema o lo que gana la gente | Listo (sección 3) |
| 2 | High-Level Project Summary | Qué hicieron, cómo responde al desafío y por qué importa | Listo |
| 3 | Link to Project Demo | Link público (YouTube, Drive, GitHub…), sin contraseña ni registro | **Falta subir el video** |
| 4 | Link to Final Project | Link público al sitio, archivos o repositorio | Repo público; **falta publicar el sitio** |
| 5 | Detailed Project Description | Qué hace, cómo funciona, beneficios, objetivos y herramientas | Listo |
| 6 | NASA Data | Qué datos de la NASA y cómo; hacen falta para competir por un premio global | Listo |
| 7 | Space Agency Partner & Other Data | Todo dato, herramienta, código o imagen usado, aunque sea abierto | Listo (sin datos de agencias socias) |
| 8 | Use of Artificial Intelligence | Qué IA y cómo; imágenes y video con marca de agua visible, audio, código y datos aclarados en el texto; la IA no puede usar la marca de la NASA | Listo; el video ya tiene la marca |
| 9 | Verificación | Marcar "Terms and Conditions" y "Confirm All Work is Original" y enviar | Al final |

**Demo:** video de hasta 30 segundos con subtítulos en inglés (o hasta 7 slides). Si se pasa, queda fuera del juzgamiento global. No se sube al sitio de Space Apps: va por link externo. El nuestro: `docs/video/field-rewind-demo-30s-en-v3.mp4` (30,0 s, con `.srt`).

**Página del proyecto:** acepta imágenes JPG, PNG o GIF de hasta 10 MB; no acepta videos ni documentos.

**Equipo:** máximo 6 integrantes; no se pueden sumar después del cierre.

### Lo que falta antes de enviar

- [ ] Nombres de los 6 integrantes en la página del equipo.
- [ ] Subir el video v3 a YouTube ("No listado") o a Drive con acceso público, probar el link en incógnito y pegarlo.
- [ ] Publicar la app (tarea F27, Vercel; ya está `web/vercel.json`) y pegar el link.
- [ ] Subir 2 o 3 capturas: globo, Next season y My Farm.
- [ ] Confirmar las cifras de Story contra la app publicada.
- [ ] Datos de agencias socias: Argentina (CONAE) es agencia socia; hoy no usamos ninguno y así lo dice el texto.
- [ ] Marcar las dos casillas y tocar "Submit for Judging".

---

## 2. Cifras que usa el texto (verificadas el 15/11 contra el repo)

| Dato | Valor | De dónde |
|---|---|---|
| Condados con Next season | 948, en 11 estados (IA, IL, IN, KS, MN, MO, ND, NE, OH, SD, WI) | `web/public/data/next/` |
| Condados con historia | 294 (Iowa, Illinois, Indiana y Sumner, KS); mapa del CDL en Story, McLean y Sumner | `web/public/data/county/` |
| Error del modelo de rinde | Maíz 15,3 bu/ac (baseline 18,6); soja 4,3 (baseline 5,1); gana en los 11 estados | rama `ml/datos-finales-11-estados` (entrega final del 15/11) |
| Efecto de no rotar | Maíz continuo −18,9 %; soja continua −12,1 % | rama `ml/datos-finales-11-estados` |
| Story, maíz | Habitual 213 bu/ac ($509/ac); tras soja 225 ($562), piso en año malo 216; tras maíz 192 ($409) | `web/public/data/next/19169.json` |

---

## 3. Texto del formulario (copiar campo por campo)

### Project name

Field Rewind: rewind your land before you decide

### High-Level Project Summary

Every season a farmer bets the year on one decision: what to plant, and after what. Field Rewind turns NASA and USDA open data into that decision for 948 counties in 11 Corn Belt states. First it rewinds a decade (2015–2025): the county painted field by field with the USDA Cropland Data Layer, each year's yield, NASA POWER weather, and the years that came out above or below usual, with their likely cause. Then it compares next season's options (keep the usual mix, rotate fully, or repeat the crop) as a yield range for a bad, typical and good year, in bu/acre and $/acre. Based on the farmer's priorities (lower risk, higher income, soil health), it suggests one, with two reasons, each with its source, a confidence level and counties like yours that already farm that way. With My Farm, the farmer adds their own rotation, acres, prices and costs, and sees the same answer for their whole farm. It addresses Field Shift by showing farmers, at the scale of their county, how a change would have played out, and it says plainly what it doesn't know.

### Links

| Field | Link |
| --- | --- |
| Link to Project Demo | Pending: public YouTube link to the 30-second video |
| Link to Final Project | Pending: live site. Code: [github.com/LuchoGolfieri2/Nasa-Apps-Challenge](https://github.com/LuchoGolfieri2/Nasa-Apps-Challenge) |

### Detailed Project Description

**What it does.** Field Rewind is a web app that helps a farmer decide next season's rotation by first looking back at their own county. It answers three questions in five screens:

1. **Map.** A 3D globe with NASA Blue Marble imagery. The Corn Belt lights up and each county is colored by its real corn yield (USDA NASS, 2021–2025 average). The farmer searches or taps a county.
2. **County history (the rewind).** A play button runs 2015–2025. In the three demo counties (Story IA, McLean IL, Sumner KS) the map repaints field by field with each year's Cropland Data Layer, while a bar race shows acres by crop. In every county with a history, each year shows its yield, NASA POWER weather (season rain, July heat) and a headline when the year was more than 10% above or below usual, with its likely cause (for example, Story County 2020: corn 28% below a usual year, not explained by weather data).
3. **Next season.** Three options for the crop the farmer plans: the usual mix, rotate fully, or repeat the crop. Each shows a yield range for a bad, typical and good year (10th percentile, median, 90th percentile) on one shared bu/acre axis, plus income per acre after operating costs. The farmer picks priorities; the app suggests one option with two reasons, each tagged as model or agronomic rule and linked to its source, a confidence level, and the years behind it (tap a year to jump to it in the history). Below, "Counties like yours" draws arcs on a globe to counties with similar soil and weather that already farm that way.
4. **My Farm.** A five-step profile: county, acres, crops of the last three seasons, next season's plan, priorities, and optional own price and operating cost. It is saved only in the browser. The dashboard shows the farmer's own option on a yield gauge, whether it matches the suggestion, income for the whole farm, their last seasons, last year's weather and the county's yield curve. Next season then opens with their crop and priorities and marks "Your farm's plan".
5. **Sources and limits.** Every dataset, what it gives and where it is used, plus what the app can't tell you.

**Example, Story County, Iowa (corn).** Keeping the usual mix: 213 bu/acre typical, $509/acre. Corn after soybeans: 225 bu/acre typical, $562/acre, and the best bad-year floor (216 bu/acre). Corn after corn: 192 bu/acre, $409/acre. With "lower risk in bad years" selected, the app suggests corn after soybeans, with medium confidence.

**How it works.**

- **Data pipeline (Python):** downloads and cleans each source into county-year tables keyed by FIPS code for 11 states (Iowa, Illinois, Indiana, Kansas, Minnesota, Missouri, Nebraska, North Dakota, Ohio, South Dakota and Wisconsin), with missing values left empty, never filled.
- **Yield model:** a shallow LightGBM model learns how each year's weather and the county's soil move corn and soybean yield away from its technology trend. Validation leaves one year out at a time. Typical error: 15.3 bu/acre for corn against 18.6 for the best baseline, and 4.3 against 5.1 for soybeans; it beats the baselines in all 11 states.
- **Rotation effect:** estimated separately with fixed effects, not inferred from the model: continuous corn yields 18.9% less than corn after soybeans, and continuous soybeans 12.1% less.
- **Explanations:** SHAP values grouped into plain phrases (July heat, dry July, wet spring) give the reasons and the risks of each option.
- **Unusual years:** each year's yield is compared with what the model expected, and the most likely weather cause is named, or the app says weather doesn't explain it.
- **Counties like yours:** a nearest-neighbor search on 5 soil and 4 climate values finds, among the most similar counties, the first 5 that actually used each rotation, as a second, independent range.
- **Front end:** React and TypeScript with deck.gl for the globes. It reads static JSON built by scripts from the pipeline and model outputs, so it calls no live API with private data and needs nothing installed to view.

**Benefits.** The decision is shown at the scale the data supports (the county), as a range instead of a promise, and every number carries its source. A farmer sees how a change would have played out in their own county's good and bad years, not in a national average. Missing data is written as "Missing data", never shown as zero.

**What we hope to achieve.** A tool a farmer or an extension agent can open before buying seed, and that any team can extend as data is added. The model already covers 11 states. Next is Argentina, our home: the data team has prepared 219 departments of the Pampas, where the same rotation question drives every season, and the app will only predict where the climate falls inside the range the model learned from.

**Limits we show in the app.** Results are for the whole county, not a single field, so two farmers in the same county see the same yield range; My Farm changes the option, the priorities and the money, not the prediction. They are associations, not causes. Income uses one operating cost per crop (ERS doesn't split by rotation), so corn after corn likely looks a little better than it is. Yield comparisons for 2024 and 2025 are not shown yet.

**Tools and languages.** Python (pandas, NumPy, GeoPandas, rasterio, scikit-learn, LightGBM), Jupyter, TypeScript, React, Vite, deck.gl, NASA GIBS map tiles, GitHub. The demo video was edited with Remotion and FFmpeg.

### NASA Data

NASA data is what lets Field Rewind explain why a year went well or badly and how risky each option is.

| NASA data | How we use it |
| --- | --- |
| NASA POWER (daily weather, AG community, 0.5°) | Season rain, July and August heat, water deficit and spring rain per county and year. Main weather inputs of the yield model, the risks of each option ("in years with a hot July, corn here yields about 11 bu/acre less") and the weather shown in the county history. |
| GPM IMERG (daily rainfall, 0.1°) | Typical rainfall per county (median 2009–2023) in the soil and climate profile that finds "counties like yours". |
| Blue Marble imagery through NASA GIBS | The 3D globe on the map screen and the globe of counties like yours. |
| Harmonized Landsat Sentinel-2 (HLS) | A model that tells corn from soybeans in-season, from July 15, months before the USDA crop map comes out (99% accurate on 10 demo fields). Built and validated, not yet shown in the app. |

Not loaded yet, and the app says so where they would go: MODIS greenness (NDVI) and SMAP soil water.

### Space Agency Partner & Other Data

We used no space agency partner data. Argentina's CONAE is our planned partner source for the Argentina expansion.

| Data or tool | Provider | How we use it |
| --- | --- | --- |
| Cropland Data Layer (CDL), 30 m, 2015–2025 | USDA NASS | What was planted, field by field; crop areas, rotations and transitions per county |
| Quick Stats: county yield, prices received | USDA NASS | Yield the model learns from; state crop prices for income |
| Commodity Costs and Returns | USDA ERS | Operating cost per acre (Heartland region) for income |
| gSSURGO soil survey | USDA NRCS | Soil drainage, productivity (NCCPI), water storage and organic carbon |
| County boundaries (TIGER/Line, Cartographic Boundary) | US Census Bureau | County shapes, FIPS codes and centroids |
| Python, pandas, NumPy, GeoPandas, rasterio, scikit-learn, LightGBM | Open source | Data pipeline and models |
| React, TypeScript, Vite, deck.gl | Open source | Web app and globes |
| Remotion, FFmpeg | Open source | Demo video editing |
| Bricolage Grotesque, DM Sans | Google Fonts (Open Font License) | Typography |

All code, images and music in the app and the video were made by the team (see Use of Artificial Intelligence). No copyrighted material was used, and no NASA logo or branding appears in the app or the video.

### Use of Artificial Intelligence

Yes. We used Anthropic's Claude (Claude Code) as a coding and writing assistant throughout the project. The team chose the data, the methods and the design, and reviewed and tested what Claude produced.

- **Code and data:** Claude helped write parts of the data pipeline, the machine learning notebooks, the scripts that build the app's data files, and the web app. Commits it helped with carry a "Co-Authored-By: Claude" line in the repository history. No data values were generated by AI: every number comes from the sources listed above, and gaps are shown as "Missing data".
- **Images and video:** the intro animation, logo, "How it works" diagram, crop illustrations and world scene in the demo video, and the crop illustrations in the app, were drawn with code written with Claude's help. The video carries a visible "Made with AI assistance" watermark.
- **Audio:** the music and sound effects in the demo video were synthesized with Python code written with Claude's help. No voice or third-party audio was used.
- **Text:** Claude helped draft and edit the in-app text and this project description.

No AI-generated content uses or modifies NASA branding.
