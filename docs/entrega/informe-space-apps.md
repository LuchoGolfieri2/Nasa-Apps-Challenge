# Informe de entrega — Field Rewind (NASA Space Apps Challenge 2026)

Equipo **Pepers** · Desafío **Field Shift: Adapting Farms with NASA Data** · Actualizado el 15/11/2026 a la noche: 11 estados (943 condados con historia, 948 con Next season), Argentina en el globo, MODIS y SMAP cargados, video v6.

Este archivo tiene dos partes: lo que pide Space Apps y en qué estamos (en español), y el texto de cada campo del formulario, listo para copiar (en inglés, como lo leen los jueces). La versión editable está en el doc "Field Rewind — Space Apps project page (draft)".

---

## 1. Qué pide Space Apps

Fuente: [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) y [Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide). Confirmar antes de enviar por si cambiaron.

| # | Campo | Qué piden | Estado |
|---|---|---|---|
| 1 | Project Name | Nombre corto que diga el problema o lo que gana la gente | Listo (sección 3) |
| 2 | High-Level Project Summary | Qué hicieron, cómo responde al desafío y por qué importa | Listo |
| 3 | Link to Project Demo | Link público (YouTube, Drive, GitHub…), sin contraseña ni registro | **Falta subir el video v6** |
| 4 | Link to Final Project | Link público al sitio, archivos o repositorio | Listo: https://field-rewind.vercel.app y el repo |
| 5 | Detailed Project Description | Qué hace, cómo funciona, beneficios, objetivos y herramientas | Listo |
| 6 | NASA Data | Qué datos de la NASA y cómo; hacen falta para competir por un premio global | Listo |
| 7 | Space Agency Partner & Other Data | Todo dato, herramienta, código o imagen usado, aunque sea abierto | Listo (sin datos de agencias socias) |
| 8 | Use of Artificial Intelligence | Qué IA y cómo; imágenes y video con marca de agua visible, audio, código y datos aclarados en el texto; la IA no puede usar la marca de la NASA | Listo; el video ya tiene la marca |
| 9 | Verificación | Marcar "Terms and Conditions" y "Confirm All Work is Original" y enviar | Al final |

**Demo:** video de hasta 30 segundos con subtítulos en inglés (o hasta 7 slides). Si se pasa, queda fuera del juzgamiento global. No se sube al sitio de Space Apps: va por link externo. El nuestro: `docs/video/field-rewind-demo-30s-en-v6.mp4` (30,0 s, con `.srt`; clips por escena en `docs/video/clips-v6/`).

**Página del proyecto:** acepta imágenes JPG, PNG o GIF de hasta 10 MB; no acepta videos ni documentos.

**Equipo:** máximo 6 integrantes; no se pueden sumar después del cierre.

### Lo que falta antes de enviar

- [ ] Nombres de los 6 integrantes en la página del equipo.
- [ ] Subir el video v6 a YouTube ("No listado") o a Drive con acceso público, probar el link en incógnito y pegarlo.
- [x] Publicar la app (tarea F27): **https://field-rewind.vercel.app** (Vercel, se actualiza en cada push a `main`). Pegar este link en el formulario.
- [ ] Subir 2 o 3 capturas: globo (EE. UU. y Argentina), Next season con los gemelos y My Farm.
- [ ] Confirmar las cifras de Story contra la app publicada.
- [ ] Datos de agencias socias: Argentina (CONAE) es agencia socia; hoy no usamos ninguno y así lo dice el texto.
- [ ] Marcar las dos casillas y tocar "Submit for Judging".

---

## 2. Cifras que usa el texto (verificadas el 15/11 a la noche contra el repo)

| Dato | Valor | De dónde |
|---|---|---|
| Condados con historia | 943 en 11 estados; mapa del CDL en todos (30 m en Story, McLean y Sumner; 150 m en el resto) | `web/public/data/county/` |
| Condados con Next season | 948, en 11 estados (IA, IL, IN, KS, MN, MO, ND, NE, OH, SD, WI) | `web/public/data/next/` |
| Verdor MODIS / agua SMAP | 934 / 943 condados con datos por año | `county/<fips>.json` |
| Error del modelo de rinde | Maíz 15,3 bu/ac (baseline 18,6); soja 4,3 (baseline 5,1); gana en los 11 estados | `backend/ML/README.md` |
| Efecto de no rotar | Maíz continuo −18,9 %; soja continua −12,1 % | `backend/ML/README.md` |
| Story, maíz | Habitual 213 bu/ac ($509/ac); tras soja 225 (216–233), $562; tras maíz 192, $409. Tras soja deja más por acre en 13 de 15 campañas (2009–2023) | `web/public/data/next/19169.json` |
| Story, mezcla esperada 2026 | ~57 % maíz (52–60 %), confianza media | `web/public/data/next/19169.json` |
| Argentina | 5 provincias, 219 departamentos (15 dentro del rango de clima de EE. UU., 102 cerca, 102 fuera). Los "dentro" rinden 49 % en maíz y 47 % en soja de sus análogos | `web/public/data/argentina/index.json` |

---

## 3. Texto del formulario (copiar campo por campo)

### Project name

Field Rewind: rewind your land before you decide

### High-Level Project Summary

Every season a farmer bets the year on one decision: what to plant, and after what. Field Rewind turns NASA and USDA open data into that decision for 943 counties in 11 Corn Belt states, and extends the comparison to 219 departments of Argentina's Pampas. First it rewinds a decade (2015–2025): the county painted field by field with the USDA Cropland Data Layer, each year's yield, NASA POWER weather, MODIS greenness, SMAP soil water, and the years that came out above or below usual, with their likely cause. Then it looks at next season: the crop mix the county is likely to plant, which rotation has left the most money per acre across 15 past seasons' weather, and a yield and income range for a bad, typical and good year, with reasons, sources, a confidence level and twin counties with the same soil and weather that already farm that way. With My Farm, a farmer adds their own rotation, acres, prices, costs and priorities and gets the same answer for their farm. It addresses Field Shift by showing, at county scale, how a change would have played out, and it says plainly what it doesn't know.

### Links

| Field | Link |
| --- | --- |
| Link to Project Demo | Pending: public YouTube link to the 30-second video (v6) |
| Link to Final Project | https://field-rewind.vercel.app · Code: https://github.com/LuchoGolfieri2/Nasa-Apps-Challenge |

### Detailed Project Description

**What it does.** Field Rewind is a web app that helps a farmer decide next season's rotation by first looking back at their own county. It works in six screens:

1. **Map.** A 3D globe with NASA Blue Marble imagery. Eleven Corn Belt states and five Argentine provinces light up. Tapping a state or province lowers the camera and paints its counties (or departments) by real corn yield (2021–2025 average) or by the share of land in each crop. The farmer searches or taps a county; a card shows its yield and opens its history or next season.
2. **County history (the rewind).** A play button runs 2015–2025 in all 943 counties. The map repaints field by field with each year's USDA Cropland Data Layer (30 m in the three demo counties, 150 m elsewhere) while a bar race shows acres by crop. Each year shows yield, NASA POWER weather (season rain, July heat), MODIS greenness (crop vigor, not yield), SMAP root-zone water against a usual year, crop prices and margins, and a headline when the yield fell outside the model's usual range for that year's weather, with its likely cause (Story County 2020: corn 27% below a usual year, not explained by weather data). In five counties an in-season crop guess from Landsat and Sentinel-2 (HLS) shows this year's crop months before the USDA map. A climate outlook card shows how suited the county stays for each crop in a 2041–2070 scenario.
3. **Next season.** The crop mix the county is likely to plant next season, as a range with its confidence. Then which rotation has left the most money per acre across the weather of 15 past seasons (2009–2023), with the same prices and costs every year. Its numbers: typical yield, a bad-year and good-year range, the change against the county's usual mix and income per acre after operating costs. Then why the model picks it and what could go wrong, each reason tagged as model or agronomic rule, with its source and the years behind it (tap a year to jump to it in the history). "Similar counties" draws arcs on a globe to the twin counties with the same soil and weather that already grow it. A last block lists what we don't know yet.
4. **My Farm.** A five-step profile: county, acres, crops of the last three seasons, next season's plan, priorities (lower risk, higher income, soil health), and optional own price and operating cost. It is saved only in the browser. The dashboard shows the farmer's plan on a yield gauge, whether it matches the suggestion, income for the whole farm, their last seasons, last year's weather and the county's yield curve.
5. **Argentina.** Each department of the Pampas has a card on the globe with its weather match and its official yields (MAGyP). Its page compares it with the three U.S. counties with the most similar weather, drawn as arcs on a globe: yield, soil and weather side by side, with links to rewind those counties. There is no yield prediction in Argentina: the model learned from U.S. counties, and the app says so.
6. **Sources and limits.** Every dataset, what it gives and where it is used, plus what the app can't tell you.

**Example, Story County, Iowa (corn).** Keeping the usual mix: 213 bu/acre typical, $509/acre. Corn after soybeans: 225 bu/acre typical (216 in a bad year, 233 in a good one), $562/acre, and it left the most per acre in 13 of the 15 past seasons. Corn after corn: 192 bu/acre, $409/acre.

**How it works.**

- **Data pipeline (Python):** downloads and cleans each source into county-year tables keyed by FIPS code for 11 states (Iowa, Illinois, Indiana, Kansas, Minnesota, Missouri, Nebraska, North Dakota, Ohio, South Dakota and Wisconsin), and by INDEC code for Argentina, with missing values left empty, never filled.
- **Yield model:** a shallow LightGBM model learns how each year's weather and the county's soil move corn and soybean yield away from its technology trend. Validation leaves one year out at a time (2009–2023): typical error 15.3 bu/acre for corn against 18.6 for the best baseline (each county's own linear trend), and 4.3 against 5.1 for soybeans, better in all 11 states.
- **Rotation effect:** estimated separately with fixed effects (same county, same state and year, local weather): continuous corn yields 18.9% less than corn after soybeans, and continuous soybeans 12.1% less.
- **What pays best:** for each of the 15 past seasons' weather, the model's yield for every option times the state price, minus the ERS operating cost; the app counts in how many seasons each option left the most per acre.
- **Explanations:** SHAP values grouped into plain phrases (July heat, dry July, wet spring) give the reasons and the risks of each option.
- **Unusual years:** each year's yield is compared with what the model expected, and the most likely weather cause is named, or the app says weather doesn't explain it.
- **Twin counties:** a nearest-neighbor search on soil, weather and irrigation values finds, among the most similar counties, the first 5 that actually used each rotation.
- **Argentina analogs:** each department is matched to the U.S. counties with the closest weather on 16 measures; departments with 3 or more measures outside the U.S. range are marked as outside it.
- **Front end:** React and TypeScript with deck.gl for the globes. It reads static JSON built by scripts from the pipeline and model outputs, calls no live API with private data and needs nothing installed to view.

**Benefits.** The decision is shown at the scale the data supports (the county), as a range instead of a promise, and every number carries its source. A farmer sees how a change would have played out in their own county's good and bad years, not in a national average. Missing data is written as "Missing data", never shown as zero.

**What we hope to achieve.** A tool a farmer or an extension agent can open before buying seed, and that any team can extend as data is added. It already covers 11 U.S. states and compares Argentina's Pampas, our home, where the same rotation question drives every season. Similar weather is not enough: the southern Buenos Aires departments whose weather falls inside the U.S. range yield about half of their U.S. analogs, which is exactly why local data matters before predicting there.

**Limits we show in the app.** Results are for the whole county, not a single field; My Farm changes the option, the priorities and the money, not the prediction. They are associations, not causes. Income uses one operating cost per crop and region (ERS doesn't split by rotation). The bad-to-good-year range shows how past weather moves the model's average yield for the county; real single years swing about twice as much, as in the 2012 drought. The climate outlook is one scenario, not a forecast.

**Tools and languages.** Python (pandas, NumPy, GeoPandas, rasterio, shapely, scikit-learn, LightGBM), Jupyter, TypeScript, React, Vite, deck.gl, GitHub, Vercel. The demo video was captured with Playwright and edited with Python (Pillow) and FFmpeg.

### NASA Data

NASA data is what lets Field Rewind explain why a year went well or badly and how risky each option is.

| NASA data | How we use it |
| --- | --- |
| NASA POWER (daily weather, AG community, 0.5°) | Season rain, July and August heat, water deficit and spring rain per county and year. Main weather inputs of the yield model, the risks of each option ("In years with a dry July, corn yields here tend to be about 5 bu/ac lower", Story County), the weather in the county history, and the October–March season weather of Buenos Aires departments. |
| GPM IMERG (daily rainfall, 0.1°) | Typical rainfall per county in the soil and climate profile that finds twin counties. |
| MODIS NDVI (MOD13Q1) | Crop greenness curve and peak per county and season in the history, shown as vigor, not yield. |
| SMAP L4 soil moisture | Root-zone water from April to September against a usual year, in the history. |
| Harmonized Landsat Sentinel-2 (HLS) | A model that tells corn from soybeans in-season, from July 15, months before the USDA crop map comes out (99 of 100 field-years right by July 15, against 95 for "the opposite of last year"; 10 demo fields, a small sample). Shown in five counties. |
| Blue Marble imagery (NASA GIBS) | The 3D globe on the map screen and the globes of twin counties and Argentine analogs. |

### Space Agency Partner & Other Data

We used no space agency partner data. Argentina's CONAE is our planned partner source for the Argentina expansion.

| Data or tool | Provider | How we use it |
| --- | --- | --- |
| Cropland Data Layer (CDL), 2015–2025 | USDA NASS | What was planted, field by field; crop areas, rotations and transitions per county |
| Quick Stats: county yield, prices received | USDA NASS | Yield the model learns from; state crop prices for income |
| Commodity Costs and Returns | USDA ERS | Operating cost per acre (Heartland region) for income |
| gSSURGO soil survey | USDA NRCS | Soil drainage, productivity (NCCPI), water storage and organic carbon |
| County boundaries | US Census Bureau | County shapes, FIPS codes and centroids |
| GAEZ v4 crop suitability | FAO and IIASA | Climate outlook card (1981–2010 against 2041–2070, RCP8.5 scenario) |
| Estimaciones agrícolas (department yield and area) | Argentina's Ministry of Agriculture (MAGyP) | Argentine yields and planted area, used only to compare, never as model input |
| SoilGrids v2.0 | ISRIC | Soil of Argentine departments and their U.S. analogs (same source on both sides) |
| Georef API | Argentina's government (datos.gob.ar) | Department boundaries and INDEC codes |
| Python, pandas, NumPy, GeoPandas, rasterio, shapely, scikit-learn, LightGBM | Open source | Data pipeline and models |
| React, TypeScript, Vite, deck.gl | Open source | Web app and globes |
| Playwright, Pillow, FFmpeg | Open source | Demo video capture and editing |
| Bricolage Grotesque, DM Sans | Google Fonts (Open Font License) | Typography |

All code, images and music in the app and the video were made by the team (see Use of Artificial Intelligence). The globe imagery in the video is NASA's Blue Marble. No copyrighted material was used, and no NASA logo or branding appears in the app or the video.

### Use of Artificial Intelligence

Yes. We used Anthropic's Claude (Claude Code) as a coding and writing assistant throughout the project. The team chose the data, the methods and the design, and reviewed and tested what Claude produced.

- **Code and data:** Claude helped write parts of the data pipeline, the machine learning notebooks, the scripts that build the app's data files, and the web app. Commits it helped with carry a "Co-Authored-By: Claude" line in the repository history. No data values were generated by AI: every number comes from the sources listed above, and gaps are shown as "Missing data".
- **Images and video:** the demo video's intro, phone and farmer scenes, "How it works" diagram, world scene and crop illustrations, and the crop illustrations in the app, were drawn with code written with Claude's help; the app screens in the video are real captures of the site. The video carries a visible "Made with AI assistance" watermark.
- **Audio:** the music and sound effects in the demo video were synthesized with Python code written with Claude's help. No voice or third-party audio was used.
- **Text:** Claude helped draft and edit the in-app text and this project description.

No AI-generated content uses or modifies NASA branding.
