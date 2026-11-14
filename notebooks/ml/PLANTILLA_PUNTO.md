# Punto N: <qué hace, en pocas palabras>

<!--
Plantilla para el PUNTON.md de cada punto. Copiala, reemplazá lo que está entre < > y borrá estos comentarios.
Ejemplo completo: PUNTO2.md. Reglas generales: CLAUDE.md de esta carpeta.
Escribí para alguien del equipo que no sabe ML: frases cortas, sin jerga sin explicar.
-->

Notebook: [`puntoN_<tema>.ipynb`](puntoN_<tema>.ipynb). Corresponde al uso #N del issue #6. <Si entrena un modelo: aclarar si es el modelo A (pronóstico en temporada) o B (escenarios), sección 4 del CLAUDE.md.>

## Qué le muestra al productor

> "<La frase que vería el productor en la app.>"

<Una o dos frases sobre para qué le sirve. Nombrá la pantalla del `INFO.md` donde aparece.>

## Cómo funciona, en simple

1. **<Paso 1>.** <Explicación sin jerga.>
2. **<Paso 2>.** <…>
3. **<Paso 3>.** <…>

## Partes de la notebook

### Preparación (pasos 0 a X), <ya funciona / espera datos>

| Paso | Qué hace |
|---|---|
| 0 | <…> |
| 1 | <…> |

### Parte A: <nombre> (pasos X a Y), <ya funciona / espera datos>

<Qué hace esta parte y para qué sirve.>

| Paso | Qué hace | Estado |
|---|---|---|
| X | <…> | <Funciona / Escrito, falta X / Probado con datos inventados> |

<Resultados reales, si los hay: tabla del baseline contra el modelo, por región. Nunca números inventados.>

### Parte B: <nombre> (pasos Y a Z), <estado>

<Igual que la Parte A. Borrá esta sección si no hay Parte B.>

## Datos

**Entra:**

| Archivo | Qué tiene | De quién |
|---|---|---|
| <`archivo.csv`> | <columnas clave y qué representan> | <persona> (<ya está / pendiente>) |

**Sale:**

| Archivo | Columnas | Para quién |
|---|---|---|
| `data/ml/<archivo>.csv` | <columnas, claves primero> | <el front (`INFO.md` sección X) / el punto M> |
| `modelos/puntoN_<tema>.joblib` | <si aplica> | <quién lo carga>. No va a Git |

## Depende de / lo usan

- **Depende de:** <otros puntos o datos, por ejemplo "el modelo del punto 2">.
- **Lo usan:** <quién consume la salida>.

## Cómo se valida

- <Cómo se separan los datos: por año, nunca filas al azar. Qué queda como prueba final (`MIRAR_PRUEBA`).>
- <Baseline o regla simple a superar.>
- <Métrica y por qué esa, por estado y por año.>
- <Chequeos de sentido común o agronómicos.>

## Supuestos

- <Cada decisión que no viene de los datos: umbrales, cantidad de grupos, cultivos candidatos, etc., con el motivo.>

## Probado

- <Con qué datos se corrió (reales o inventados para probar código) y qué salió. Nunca presentar resultados de datos inventados como reales.>

## Qué falta

- [ ] <Tarea concreta.>

## Limitaciones (para el pitch)

- <Lo que el resultado no puede decir, en una línea cada una.>
