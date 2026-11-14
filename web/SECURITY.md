# Seguridad de la web de Field Rewind

La app es un **sitio estático**: HTML, JS y archivos JSON/PNG propios. No tiene servidor, base de datos,
login, cookies ni formularios, y no llama a APIs de datos en vivo (spec §3: lee JSON derivados de `data/processed/` y `data/ml/`). La única conexión externa son las teselas de imagen Blue Marble del globo (NASA GIBS), que no llevan clave.
Por eso varias recomendaciones típicas no aplican. Estado de cada una:

| Recomendación | Estado | Detalle |
|---|---|---|
| Ocultar API keys | ✅ No hay claves en el front | La clave de NASS y la de Earthdata solo se usan en el pipeline de datos, desde `.env` y `~/.netrc` (ignorados por git). El front nunca debe recibir una clave: todo lo que está en `web/` es público. |
| Eliminar secretos de Git | ✅ Revisado el 14/11/2026 | Se revisó todo el historial (37 commits): sin claves, tokens ni archivos `.env`/`.netrc`. Si alguien sube una clave por error: **revocarla primero** en el sitio que la emitió, después limpiar el historial. |
| Restringir el acceso | — No aplica | La app es pública a propósito (la ve el jurado). El repo: dar permiso de escritura solo al equipo. |
| Proteger cookies de sesión | — No aplica | No hay sesiones ni cookies. |
| Rate limiting / protección contra bots | — Lo cubre el hosting | Sin servidor propio no hay nada que saturar; Vercel tiene protección contra DDoS en su CDN. |
| Validar inputs | ✅ | Lo único que entra es la URL: el router acepta solo FIPS de 5 dígitos y códigos de estado de 2 letras; `?year` tiene que estar entre los años del condado y `?speed` está acotado entre 0,2 y 10. Los datos se leen solo del mismo sitio. |
| Devolver solo los datos necesarios | ✅ | Los JSON del front son por condado y solo con lo que se muestra. No publicar en `web/public/` tablas crudas ni datos personales. |
| Restringir archivos | ✅ | Solo se publica `web/dist/` (lo que arma `npm run build`). El resto del repo no se sube al hosting. |
| Security headers | ✅ `web/vercel.json` | CSP (solo scripts propios; fuentes de Google Fonts; imágenes de NASA GIBS), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `COOP`. Probado sin violaciones de CSP. |
| Forzar HTTPS | ✅ | Vercel redirige a HTTPS siempre; además `Strict-Transport-Security` y `upgrade-insecure-requests`. |

## Deploy (F27)
En Vercel: **Root Directory = `web`**. El `vercel.json` ya trae el comando de build, la carpeta de salida y los encabezados.

## Si en el futuro hay backend
Si la app pasa a tener servidor (cuentas, guardar campos del productor), ahí sí hacen falta: claves solo en variables
de entorno del servidor, cookies `HttpOnly; Secure; SameSite`, rate limiting, validación de todo lo que llega y
devolver solo los campos necesarios.
