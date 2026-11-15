# Field Rewind — Contexto para el equipo de Front-end

*De: Luciano (pitch y video) · 14/11/2026*

## TL;DR

- **Nombre final del proyecto: Field Rewind.** Equipo: **Pepers**. Frase: *"Rewind your land before you decide."* Hay que cambiar "Field Shift" por "Field Rewind" en toda la interfaz. Field Shift es el nombre del desafío, no de la app.
- Para el video necesito **3 grabaciones de pantalla** de la app. La más importante dura 10 segundos y muestra el recorrido principal (sección 3).
- Necesito una **primera versión grabada el sábado a la noche**, aunque sea con datos de prueba, y la **final el domingo antes de las 18:00**. El envío cierra el domingo 15 a las 23:59 y hay que editar.
- Hay que **definir el tercer estado** (sección 5).

---

## 1. Cómo es el video (30 s, obligatorio en Space Apps)

| Seg. | Pantalla | Qué se ve de la app |
|---|---|---|
| 0:00–0:02 | Completa | Logo del equipo (no es de ustedes) |
| 0:02–0:10 | **Dividida** | Izquierda: animación del productor (ya está). **Derecha: toma A** |
| 0:10–0:20 | **App a pantalla completa** | **Toma B**: el recorrido principal |
| 0:20–0:30 | **Dividida** | Izquierda: animación de cierre (ya está). **Derecha: toma C** |

La guía oficial 2026 pide que la demo **muestre el software funcionando**. Por eso la toma B es lo que más pesa del video.

---

## 2. Especificaciones de grabación

| | Tomas A y C (media pantalla) | Toma B (pantalla completa) |
|---|---|---|
| Tamaño | **960×1080** (ventana vertical, o la vista angosta / celular de la app) | **1920×1080** |
| Cuadros por segundo | 30 o 60 | 30 o 60 |
| Duración bruta | ~12 s (yo recorto) | ~15 s (yo recorto a 10) |

- **Sin barras del navegador:** pantalla completa (F11) o modo kiosco.
- **Grabación:** OBS o el grabador del sistema. Exporten en MP4.
- **Cursor:** movimientos lentos y en línea recta. Nada de dar vueltas buscando el botón: ensayen el recorrido 2 o 3 veces antes de grabar.
- Si existe `prefers-reduced-motion`, que esté apagado al grabar, así se ven el giro del globo y las animaciones.
- **Grabación limpia:** sin notificaciones, sin pestañas personales y sin datos personales en pantalla.

---

## 3. Lista de tomas

### Toma A — derecha de 0:02 a 0:10 (8 s útiles)

1. El globo gira despacio.
2. Se detiene sobre EE.UU., con los 3 estados encendidos y latiendo.
3. *(Opcional)* Toque en un estado y la cámara empieza a volar hacia adentro.

**Tiene que leerse en la mitad vertical:** que lo importante quede en el centro.

### Toma B — pantalla completa de 0:10 a 0:20 (10 s útiles)

La voz dice: *"Elegís tu condado y rebobinás una década: qué se sembró, cómo rindió y qué clima hubo, con datos de la NASA. Después comparás tu rotación con otras y la app te sugiere una según tus prioridades, con lo que pasó en el pasado."*

> Actualizado el 14/11: el CDL limpio cubre 2015–2025, así que la voz dice "una década" (en inglés, "a decade"), no "18 años". El condado de la toma B es **Story, IA** (cambio del 14/11 a la noche: Kansas no está en el modelo de ML, así que Sumner no tiene "Next season").

| Seg. aprox. | Acción en pantalla |
|---|---|
| 0–2 | Estado con los condados pintados. Toque en un condado: queda resaltado |
| 2–3 | Botón para ver su historia |
| 3–7 | Pantalla de historia: **el deslizador corre de 2015 a 2025**, el condado se pinta lote a lote y las barras de cultivos se reordenan. Es el momento "rewind" del video |
| 7–10 | Botón de opciones para la próxima campaña: **rotación actual frente a 2 alternativas**, con sus rangos y una marcada "Suggested for your priorities" |

- Si pueden, que el deslizador tenga una animación de "play" o arrastre suave. Un ícono ⏪ en la línea de tiempo conecta con el nombre.
- Usen un condado con historia interesante: años con cambios visibles y algún año seco marcado.
- Las fuentes (NASA, USDA) tienen que verse en algún momento. Sirve el pie de la ficha o la pantalla de fuentes.

### Toma C — derecha de 0:20 a 0:30 (10 s útiles)

1. Desde un condado, zoom out hasta el globo completo.
2. El globo gira hasta Sudamérica / la Pampa. Termina ahí, **sin tocar nada**.

No busquen un lugar de Argentina en la app: saldría el cartel de zona sin cobertura. La idea es solo la imagen de "puede llegar acá", y la voz dice "mañana puede llegar a la Pampa".

---

## 4. Identidad visual (para que la app y las animaciones combinen)

Paleta del equipo (actualizada el 14/11, reemplaza a `#12281C`, `#96DC6E`, `#3C8C2D` y `#D71E1E`). La usan la app, el logo y las animaciones, para que todo parezca la misma pieza.

| Rol | Color | Uso |
|---|---|---|
| Verde noche | `#0F2A1D` | Fondo principal (fondo del logo, globo, paneles oscuros) |
| Verde campo | `#2F7D4F` | Botones primarios, acentos sobre claro |
| Verde brote | `#8ED081` | Acento sobre oscuro ("REWIND" del logo, glow de los estados, "Suggested") |
| Oro trigo | `#E9B949` | Segundo acento: ícono ⏪/▶, año activo, resaltados |
| Papel | `#F6F1E4` | Texto sobre oscuro ("FIELD" del logo); fondo de paneles claros |
| Tierra | `#6B4A2F` | Suelo desnudo, barbecho, datos de suelo |
| Rojo alerta | `#E5484D` | Solo riesgo, pérdida y confianza baja. Nunca como "malo" decorativo |

- Tipografías: **Bricolage Grotesque** (títulos y logo) y **DM Sans** (datos y texto).
- Logo de texto: **FIELD** (papel) / **REWIND** (verde brote) + ícono ⏪ (verde brote y oro trigo), en Bricolage Grotesque en negrita.
- **No usen el logo de la NASA**, insignias de misiones ni nada que los imite. Lo prohíben las reglas. Mencionar "NASA SMAP", "NASA POWER" como fuente está bien.
- Si alguna imagen de la interfaz se generó con IA, necesita una marca de agua visible ("AI-generated").

---

## 5. Decisiones abiertas

1. ~~**Tercer estado**~~ → **Resuelto (14/11): Kansas.** Estados: Iowa, Illinois y Kansas. Condados con historia completa: Story (IA), McLean (IL) y Sumner (KS). Sumner tiene el mejor dato para el pitch: el trigo bajó de 122.000 a 84.000 ha entre 2015 y 2025, mientras el maíz se duplicó.
2. ~~**Textos que mencionan "Field Shift"**~~ → **Resuelto:** pasan a *"Field Rewind doesn't cover this area yet. It works in Iowa, Illinois and Kansas."*

---

## 6. Reglas de contenido (ya están en su documento; las repito porque se ven en el video)

- La unidad es el **condado**: *"Results are for the whole county, not for a single field."*
- La app **sugiere** una opción según las prioridades del productor (cambio del 14/11), siempre con razones, fuente, rango (año malo / típico / bueno) y nivel de confianza. Nada de "porcentaje de éxito" ni precisión falsa.
- Rinde ≠ verdor: el rango de cada opción es de rinde (bu/acre) y sale del modelo. Si se habla de verdor, se aclara que es vigor, no rinde.
- Datos faltantes como *"Missing data"*, nunca como cero.
- **Toda la interfaz en inglés:** lo exige Space Apps para todo lo que ven los jueces.

---

## 7. Para la página del proyecto

- **"Link to Final Project":** necesito una URL **pública, sin login**: GitHub Pages, Vercel o Netlify. Pásenmela apenas esté desplegada, aunque no sea la versión final.
- Opcional, recomendado por la guía: pedir la clasificación de FortiGuard Web Filter para el dominio, así los jueces no tienen problemas para abrirla.
- Necesito también una lista corta del stack (librerías, mapa, hosting) y de cualquier recurso de terceros (íconos, tipografías, mapas base) para el campo de referencias.

## 8. Qué necesito, en orden

- [x] Confirmación del tercer estado: Kansas
- [ ] Toma B en borrador, aunque sea con datos falsos (sábado a la noche)
- [ ] URL pública desplegada (sábado a la noche o domingo temprano)
- [ ] Tomas A, B y C finales con datos reales (domingo antes de las 18:00)
- [ ] Lista del stack y de los recursos de terceros
