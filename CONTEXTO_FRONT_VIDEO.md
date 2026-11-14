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

La voz dice: *"Elegís tu condado y rebobinás 18 años: qué se sembró, cómo rindió y qué clima hubo, con datos de la NASA. Después comparás tu rotación con otras, según cómo funcionaron en el pasado."*

| Seg. aprox. | Acción en pantalla |
|---|---|
| 0–2 | Estado con los condados pintados. Toque en un condado: queda resaltado |
| 2–3 | Botón para ver su historia |
| 3–7 | Pantalla de historia: **el deslizador corre de 2008 a 2025** y la ficha del año cambia (cultivo, rinde, verdor, clima). Es el momento "rewind" del video |
| 7–10 | Botón de opciones para la próxima campaña: **rotación actual frente a 2 alternativas**, con sus rangos |

- Si pueden, que el deslizador tenga una animación de "play" o arrastre suave. Un ícono ⏪ en la línea de tiempo conecta con el nombre.
- Usen un condado con historia interesante: años con cambios visibles y algún año seco marcado.
- Las fuentes (NASA, USDA) tienen que verse en algún momento. Sirve el pie de la ficha o la pantalla de fuentes.

### Toma C — derecha de 0:20 a 0:30 (10 s útiles)

1. Desde un condado, zoom out hasta el globo completo.
2. El globo gira hasta Sudamérica / la Pampa. Termina ahí, **sin tocar nada**.

No busquen un lugar de Argentina en la app: saldría el cartel de zona sin cobertura. La idea es solo la imagen de "puede llegar acá", y la voz dice "mañana puede llegar a la Pampa".

---

## 4. Identidad visual (para que la app y las animaciones combinen)

| Uso | Color |
|---|---|
| Verde oscuro (fondo del logo) | `#12281C` |
| Verde claro (acento, "REWIND") | `#96DC6E` |
| Verde cultivo | `#3C8C2D` |
| Rojo de "pérdida" (solo en la animación del problema) | `#D71E1E` |

- Logo de texto: **FIELD** (blanco) / **REWIND** (verde claro) + ícono ⏪, en tipografía sans en negrita.
- **No usen el logo de la NASA**, insignias de misiones ni nada que los imite. Lo prohíben las reglas. Mencionar "NASA SMAP", "NASA POWER" como fuente está bien.
- Si alguna imagen de la interfaz se generó con IA, necesita una marca de agua visible ("AI-generated").

---

## 5. Decisiones abiertas

1. **Tercer estado:** el documento del front dice Iowa, Illinois e **Indiana**, pero los datos del CDL que ya están limpios son Story (IA), McLean (IL) y **Sumner (Kansas)**.
   - Si se quedan con Indiana, aviso y bajo un condado de Indiana en unos minutos (el script ya está).
   - Sumner tiene el mejor dato para el pitch: el trigo bajó de 122.000 a 84.000 ha entre 2015 y 2025, mientras el maíz se duplicó.
2. **Textos que mencionan "Field Shift"** (por ejemplo, *"Field Shift doesn't cover this area yet"*): pasan a *"Field Rewind doesn't cover this area yet. It works in …"*.

---

## 6. Reglas de contenido (ya están en su documento; las repito porque se ven en el video)

- La unidad es el **condado**: *"Results are for the whole county, not for a single field."*
- La app **compara, no recomienda**. Nada de "porcentaje de éxito".
- Rinde ≠ verdor: **no decir "esta rotación rindió más"**. Sí: "el maíz después de soja estuvo más verde que el maíz después de maíz (vigor, no rinde)".
- Datos faltantes como *"Missing data"*, nunca como cero.
- **Toda la interfaz en inglés:** lo exige Space Apps para todo lo que ven los jueces.

---

## 7. Para la página del proyecto

- **"Link to Final Project":** necesito una URL **pública, sin login**: GitHub Pages, Vercel o Netlify. Pásenmela apenas esté desplegada, aunque no sea la versión final.
- Opcional, recomendado por la guía: pedir la clasificación de FortiGuard Web Filter para el dominio, así los jueces no tienen problemas para abrirla.
- Necesito también una lista corta del stack (librerías, mapa, hosting) y de cualquier recurso de terceros (íconos, tipografías, mapas base) para el campo de referencias.

## 8. Qué necesito, en orden

- [ ] Confirmación del tercer estado (lo antes posible)
- [ ] Toma B en borrador, aunque sea con datos falsos (sábado a la noche)
- [ ] URL pública desplegada (sábado a la noche o domingo temprano)
- [ ] Tomas A, B y C finales con datos reales (domingo antes de las 18:00)
- [ ] Lista del stack y de los recursos de terceros
