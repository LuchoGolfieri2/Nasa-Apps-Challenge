# Pasar ML a 9 estados: cambios en los puntos 3, 4, 5 y el front

El **punto 2 ya está adaptado** y probado (`punto2_rotaciones.ipynb`, rama `ml/punto2-9-estados`). Corre de punta a
punta sin errores con la entrega del 15/11. Las salidas de `backend/Datos/` **no** se regeneraron en ese commit: si se
corre el punto 2 antes de adaptar los puntos 3 a 5, quedan inconsistentes (ver abajo).

Este archivo lista lo que hay que cambiar en **las otras partes** para que sigan andando con el punto 2 nuevo. No
toqué esas notebooks. Lo marcado **Obligatorio** rompe algo o da números mal si no se hace.

---

## 0. Datos

Descomprimir `fieldshift_datos_todo_20261115.zip` en `backend/Datos/entregas/`. Tiene que quedar:

```
backend/Datos/entregas/fieldshift_datos_todo_20261115/unido_9_estados/tabla_anual.csv
```

`unido_9_estados/` trae `tabla_anual.csv`, `tabla_mensual.csv`, `diccionario.csv` y `referencia/condados.csv` de
los 9 estados (IA, IL, IN, MN, MO, NE, OH, SD, WI). No trae `extras/` ni la carpeta `condado/`.

---

## 1. Qué cambió en el punto 2 (lo que leen los demás)

| Qué | Antes | Ahora |
|---|---|---|
| Estados | IA, IL, IN | los 9 (`NOMBRES_ESTADO`) |
| Tendencia | una recta por estado | `TENDENCIA = "condado"`: recta del estado **+ nivel propio de cada condado** |
| `.joblib` | `tendencia = {"por_estado", "global"}` | suma `tendencia["nivel_condado"]` (dict `fips` → bu/ac) |
| Efecto de rotar | cada condado pesa igual, todos los condados | ponderado por superficie sembrada, solo condados con ≥ 70 % de maíz + soja |
| `efecto_rotacion.csv` | 10 columnas | + `condados`, `ponderado_por_area`, `umbral_maiz_soja` |
| `escenarios_rotacion*.csv` | `actual`, `rotado`, `continuo` en todos los condados | **fuera de la zona maíz-soja solo hay `actual`** (200 condados de maíz, 176 de soja) |

Resultados con 9 estados (validación dejando un año afuera, 2009–2023):

| | Maíz | Soja |
|---|---|---|
| Error del modelo (MAE, bu/ac) | **15,3** (antes 17,1) | **4,1** (antes 4,74) |
| Mejor baseline (tendencia del condado) | 18,2 | 4,8 |
| Estados en que le gana al baseline | **9 de 9** (antes 5) | **9 de 9** (antes 3) |
| Años en que le gana | 13 de 15 | 15 de 15 |
| Continuo contra rotado | **−18,9 %** (IC95 −24,5 a −13,3) | **−9,9 %** (IC95 −16,1 a −3,6) |
| Chequeo agronómico (paso 16) | pasa | pasa |

Lo que empeora: con un estado entero afuera (paso 10), el modelo sigue ganándole a la tendencia de los otros
estados, pero por menos que antes. Un condado sin historia de rinde no tiene nivel propio. Para la app no importa:
solo muestra condados con historia.

Si necesitan correr los puntos 3 y 4 **antes** de aplicar los cambios de abajo, pongan `TENDENCIA = "estado"` en
el punto 2 y vuelvan a correrlo. Si no, los puntos 3 y 4 calculan mal sin avisar (ver 2.a y 3.a).

---

## 2. Punto 3 (`punto3_explicaciones.ipynb`)

### 2.a Obligatorio: la tendencia por condado

En la celda de funciones (la que dice "copia del punto 2"), reemplazar `ajustar_tendencia` y `aplicar_tendencia`
por las del punto 2. Si no, cualquier cálculo que sume la tendencia ignora el nivel de cada condado:

```python
TENDENCIA = "condado"
ENCOGER_NIVEL = 2


def ajustar_tendencia(tr, modo=None):
    """Recta rinde ~ año por estado, solo con el train. Con modo "condado" suma el nivel propio de cada condado
    (cuánto rinde por encima o por debajo de la recta de su estado), achicado hacia 0 si tiene pocos años."""
    modo = modo or TENDENCIA
    por_estado = {e: np.polyfit(g["anio"], g[TARGET], 1) for e, g in tr.groupby("estado")}
    coefs = {"por_estado": por_estado, "global": np.polyfit(tr["anio"], tr[TARGET], 1)}
    if modo == "condado":
        resto = (tr[TARGET] - aplicar_tendencia(coefs, tr)).groupby(tr["fips"])
        coefs["nivel_condado"] = (resto.sum() / (resto.size() + ENCOGER_NIVEL)).to_dict()
    return coefs


def aplicar_tendencia(coefs, datos, anio=None):
    """Valor de la tendencia para cada fila. Un condado sin nivel propio usa solo la recta de su estado."""
    anios = datos["anio"] if anio is None else pd.Series(anio, index=datos.index)
    valor = np.array([np.polyval(coefs["por_estado"].get(e, coefs["global"]), a)
                      for e, a in zip(datos["estado"], anios)])
    if "nivel_condado" in coefs:
        valor = valor + datos["fips"].map(coefs["nivel_condado"]).fillna(0).to_numpy()
    return valor
```

### 2.b Obligatorio: condados con una sola opción

En el paso 8 (armar las razones), el loop arma siempre las tres opciones. Fuera de la zona maíz-soja no hay
`rotado` ni `continuo`: el valor queda vacío y `bu()` falla al redondearlo (`int(round(nan))`). Cambiar:

```python
        for rotacion in ("actual", "rotado", "continuo"):
```

por:

```python
        for rotacion in [r for r in ("actual", "rotado", "continuo") if r in med.index]:   # fuera de la zona maíz-soja solo hay "actual"
```

Probado: con ese cambio corre y quedan 790 condados en `explicaciones.json`.

### 2.c Obligatorio: los 9 estados

En la celda de parámetros:

```python
NOMBRES_ESTADO = {"17": "Illinois", "18": "Indiana", "19": "Iowa", "20": "Kansas", "27": "Minnesota",
                  "29": "Missouri", "31": "Nebraska", "39": "Ohio", "46": "South Dakota", "55": "Wisconsin"}
```

### 2.d Recomendado: la frase "+0 bu/ac"

En 2 condados de soja de Nebraska (`31047` Dawson y `31111` Lincoln) casi no se siembra soja sobre soja, así que
rotar del todo suma 0,0 bu/ac. La frase dice "Rotating fully is linked to about +0 bu/ac", y por eso falla el
chequeo `rotado_suma_y_continuo_resta`. Opciones:

- en `frase_rotacion`, si `abs(delta_bu) < 0.5`: "This county already grows almost no {c} after {c}, so rotating
  fully changes little here.";
- en el chequeo, aceptar `>= 0` en `rotado` (y `<= 0` en `continuo`).

### 2.e Recomendado: Missouri con confianza baja

Missouri da el efecto al revés (el maíz continuo rinde **más**) con y sin los arreglos. Sin Missouri, el efecto da
−20,4 % en maíz y −11,8 % en soja. Propuesta: que `confianza()` reciba el `fips` y devuelva confianza baja para
`rotado` y `continuo` en el estado 29:

```python
    if fips[:2] == "29" and rotacion in ("rotado", "continuo"):
        return {"level": "low", "reason": "In this state the county data don't show the usual rotation effect."}
```

Es una decisión del equipo. La otra opción es sacar Missouri de la zona en el punto 2.

### 2.f Para saber: el suelo casi no va a aparecer

Con la tendencia por condado, el nivel de cada condado absorbe lo que antes explicaba el suelo. En el modelo, las
variables de suelo pasan a pesar casi cero (paso 11 del punto 2). Las razones `suelo_productivo`,
`agua_del_suelo` y `terreno` van a salir mucho menos. Si se quiere seguir mostrando el suelo, hay que decirlo con
el nivel del condado ("this county yields about X bu/ac above its state's trend") o como regla.

---

## 3. Punto 4 (`punto4_anomalias.ipynb`)

### 3.a Obligatorio: la tendencia por condado

`aplicar_tendencia` (paso 3, "Funciones del punto 2") tiene que sumar el nivel del condado. Si no, el "año normal"
queda corrido en cada condado, en lo que rinde por encima o por debajo de su estado:

```python
def aplicar_tendencia(coefs, datos):
    valor = np.array([np.polyval(coefs["por_estado"].get(e, coefs["global"]), a)
                      for e, a in zip(datos["estado"], datos["anio"])])
    if "nivel_condado" in coefs:
        valor = valor + datos["fips"].map(coefs["nivel_condado"]).fillna(0).to_numpy()
    return valor
```

### 3.b Obligatorio: los 9 estados

`NOMBRES_ESTADO` igual que en 2.c.

### 3.c Para saber

Con 9 estados y la tendencia por estado, el 74 % de los años marcados en maíz quedaba "no explicado por el clima".
Con la tendencia por condado, el modelo aprende sobre todo el clima (paso 11 del punto 2), así que debería bajar.
**No lo probamos**: hay que correrlo después de 3.a.

---

## 4. Punto 5 (`punto5_vecinos.ipynb`)

### 4.a Obligatorio: los datos y los estados

En la celda de parámetros:

```python
VERSION_ENTREGA = "todo_20261115"
RUTA_ENTREGA = RAIZ / "backend" / "Datos" / "entregas" / f"fieldshift_datos_{VERSION_ENTREGA}" / "unido_9_estados"
NOMBRES_ESTADO = {"17": "Illinois", "18": "Indiana", "19": "Iowa", "20": "Kansas", "27": "Minnesota",
                  "29": "Missouri", "31": "Nebraska", "39": "Ohio", "46": "South Dakota", "55": "Wisconsin"}
SIGLAS_ESTADO = {"17": "IL", "18": "IN", "19": "IA", "20": "KS", "27": "MN", "29": "MO", "31": "NE",
                 "39": "OH", "46": "SD", "55": "WI"}
```

Sin `SIGLAS_ESTADO`, `gemelos.json` muestra el código del estado en vez de la sigla.

### 4.b Recomendado: el texto de los condados fuera de la zona

En el paso 16 (chequeo contra el punto 2), en maíz los gemelos apuntan al revés que el modelo, y a las opciones
`rotado` y `continuo` les pone "The range comes from the model". Pero en los 200 condados de maíz fuera de la zona
maíz-soja **el modelo no tiene rango** para esas opciones: son 326 filas con un texto que no se cumple. Propuesta,
dentro de `if not mismo_lado:`:

```python
                tiene_modelo = (rango.merge(modelo_p2[["fips", "cultivo", "rotacion"]], how="left", indicator=True)
                                ["_merge"].eq("both").to_numpy())
                cambiar = (rango["cultivo"] == cultivo) & (rango["rotacion"] != "actual") & (rango["n_gemelos"] > 0)
                rango.loc[cambiar, "usar_como_rango"] = False
                rango.loc[cambiar, "confianza"] = "low"
                rango.loc[cambiar & tiene_modelo, "motivo"] = ("Low confidence: these counties differ from yours in more than "
                                                               "this rotation, so their yield doesn't show its effect. The range comes from the model.")
                rango.loc[cambiar & ~tiene_modelo, "motivo"] = ("Low confidence: these counties differ from yours in more than "
                                                                "this rotation, and the model has no range for this option here.")
```

### 4.c Para saber

Con 9 estados, el control importante (paso 19) sigue pasando: los gemelos le ganan a los vecinos del mapa en las 6
opciones. En el paso 9, con todos los condados, los parecidos pierden contra el mapa por 1,3 bu/ac (antes
empataban).

---

## 5. Front (`scripts/`)

### 5.a `scripts/build_next_json.py`: sumar los estados

Hoy arma los JSON solo de IA, IL, IN y KS. Sumar los otros 6 en `STATES` y `STATE_NAME`:

```python
STATES = {"19": "IA", "17": "IL", "18": "IN", "20": "KS", "27": "MN", "29": "MO", "31": "NE", "39": "OH", "46": "SD", "55": "WI"}
STATE_NAME = {"19": "Iowa", "17": "Illinois", "18": "Indiana", "20": "Kansas", "27": "Minnesota", "29": "Missouri",
              "31": "Nebraska", "39": "Ohio", "46": "South Dakota", "55": "Wisconsin"}
```

Las opciones sin rango (fuera de la zona maíz-soja) **ya las soporta**: quedan con `yield_bu_ac: null` y confianza
baja ("Missing data: no model explanation for this option.").

### 5.b `scripts/build_precios_costos.py`: precios de los estados nuevos

`ESTADOS = ["17", "18", "19"]` y lee `economia_anual.csv` de la v3, que solo trae IA, IL e IN. Los precios de los
otros 6 están en el zip:

- `oh_ne_mn/economia/data/processed/economia/economia_anual.csv`
- `mo_wi_sd/economia/data/processed/economia/economia_anual.csv`

Sin eso, el ingreso por acre de esos estados sale "Missing data".

---

## 6. Orden para correr

1. `punto2_rotaciones.ipynb` con `CULTIVO = "maiz"` y después con `"soja"`
2. `punto3_explicaciones.ipynb` (después de 2.a, 2.b y 2.c)
3. `punto4_anomalias.ipynb` con maíz y con soja (después de 3.a y 3.b)
4. `punto5_vecinos.ipynb` (después de 4.a)
5. `scripts/build_precios_costos.py` y `scripts/build_next_json.py`

El punto 6 no cambia: usa `lotes/`, y el zip no trae lotes nuevos.

## 7. Lo que sigue pendiente

- La prueba 2024–2025 sigue sin mirar (`MIRAR_PRUEBA = False`).
- Faltan Kansas y Dakota del Norte en la entrega.
- Los suelos de 9 condados de Dakota del Sur vienen vacíos (Brule, Buffalo, Custer, Hanson, Hutchinson, Jackson,
  Meade, Oglala Lakota y Pennington). Hay que pedirlos al pipeline.
