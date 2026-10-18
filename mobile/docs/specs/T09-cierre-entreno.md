# Spec — Cierre del entreno: un solo Terminar, con lo hecho a la vista

> Tema: entrenamiento
> En corto: Al final del Workout, en vez de tres botones seguidos (añadir, guardar, descartar), añadir pasa a ser parte de la lista y debajo queda una tarjeta con cuántas series llevas, «Terminar sesión» y una papelera que pide confirmación; terminar a medias abre una hoja que dice qué se guarda y qué queda sin hacer.
> Inicio: 2026-10-18
> Fin: 2026-10-18
> Fase T09-01 · hecho · Tarjeta de cierre, añadir en la lista y descartar con aviso · §3
> Fase T09-02 · hecho · Hoja «Terminar sesión» a medias · §4
>
> Estado: **implementada, por probar** (18-oct-2026, sin commit). La hoja se
> cierra con el «Cerrar» de arriba que llevan todas las `DragSheet` y no con una
> X propia (§4): mismo sitio y mismo efecto, y no inventa un cierre distinto para
> una sola hoja. Maqueta que manda:
> [`workout-cierre-2.html`](../mockups/workout-cierre-2.html). La v1
> ([`workout-cierre.html`](../mockups/workout-cierre.html)) tenía además la
> versión «barra fija», descartada (§2).

---

## 1. Por qué

Al final de la lista de `WorkoutScreen.jsx` (líneas ~680-708) hay tres botones
apilados con tres pesos distintos: el enlace «+ Añadir ejercicio», el botón lima
«GUARDAR SESIÓN» y el texto rojo «DESCARTAR SESIÓN». Además:

- **«Descartar sesión» borra el entreno de un toque, sin preguntar**
  (`handleDiscard` → `discardSession()`). El aviso que sí sale en Inicio,
  Clientes y Pegar entreno (`confirmDiscardActive` de
  `src/components/ui/confirmDiscard.js`) no se usa aquí, justo debajo del botón
  de guardar.
- Guardar a medias no dice qué se guarda ni qué se queda sin hacer.

## 2. Decisiones cerradas con el usuario (18-oct-2026)

| # | Decisión | Descartado y por qué |
|---|---|---|
| D1 | «Añadir ejercicio» es una **tarjeta punteada dentro de la lista** | Enlace suelto en el pie |
| D2 | Debajo, una **tarjeta de cierre compacta, sin ceja**: «13 de 20 series · 48 min», barra y «Terminar sesión» | Barra fija abajo (quita ~90 px durante todo el entreno, y la cabecera ya lleva la regla de progreso); tarjeta con ceja «Esta sesión» (más alta) |
| D3 | **Papelera al lado de Terminar**, en la misma fila: se puede descartar siempre, también con todo hecho | Descartar solo dentro de la hoja (no existía con todo hecho) |
| D4 | Descartar **siempre pide confirmación** | Lo de hoy |
| D5 | Terminar **a medias** abre una hoja; con **todo hecho** va directo al resumen | Hoja siempre |
| D6 | La hoja se cierra con una **X arriba**, no con un tercer botón «Seguir entrenando» | Tres botones apilados en la hoja (el mismo problema de hoy) |
| D7 | Descartar no ofrece guardar a medias: eso ya lo hace Terminar | — |

## 3. T09-01 — Tarjeta de cierre, añadir en la lista y descartar con aviso

### 3.1 Añadir en la lista

El botón de hoy (`styles.addBtn`) pasa a tarjeta: borde punteado 1.5 px
(`#3a3a3a`), radio de tarjeta (16), padding 14, texto centrado «+ Añadir
ejercicio» (o el título de la hoja en la sesión libre, como hoy) en el tinte de
hoy (`accent50`, el «+» en `accent`). Mismo `onPress` que hoy. Va justo
después del último ejercicio o bloque, con el mismo hueco que entre tarjetas.

### 3.2 Tarjeta de cierre

Después de añadir, con 18 px de aire. Caja `surface`, radio 16, padding
14/15/15.

- **Línea 1**: número de series hechas en Barlow cursiva (~26, rol de
  `textStyles`) + «de 20 series» (`body`, `mutedLight`); a la derecha, los
  minutos (`label`, `mutedLight`). En modo registro (`activeSession.logOnly`)
  sin minutos.
- **Barra** de 5 px, radio 3, fondo `surface2`, relleno `accent` con la
  proporción hecha.
- **Fila de botones**:
  - «Terminar sesión» a lo ancho (`flex: 1`, radio 10, padding 14, `button`).
    A medias: fondo `surface2` y texto `text`. Con todo hecho: fondo `accent` y
    texto `onAccent`. Así terminar antes de tiempo no parece la acción
    esperada, pero no se esconde.
  - Papelera: 48 de ancho, mismo alto, fondo `surface2`, radio 10, icono rojo
    (`redText`). `accessibilityLabel` «Descartar sesión».

**Qué se cuenta** — una función pura nueva en `src/utils/activeSession.js`
(con test), `activeSessionProgress(state)`, que devuelva
`{ setsDone, setsTotal, blocksDone, blocksTotal, exercisesDone, exercisesTotal }`:

- series de trabajo de los ejercicios de la plantilla y de los añadidos
  (`adHocExercises`); las de calentamiento no cuentan;
- una serie cuenta como hecha con el mismo criterio que ya usa
  `isExerciseDone`;
- los bloques de acondicionamiento cuentan por separado (hecho =
  `blockState[id].finishedAt`). Si la sesión **solo** tiene bloques, la línea 1
  dice «2 de 3 bloques». Si tiene las dos cosas, las series mandan y los bloques
  entran en «todo hecho».

**«Todo hecho»** = todas las series y todos los bloques hechos.

### 3.3 Descartar

La papelera llama a `confirmDiscardActive(t, handleDiscard)`: el mismo diálogo
que ya sale en Inicio, con el resumen de la sesión como subtítulo
(«Torso pesado · 4 de 6»). Se quita el botón «DESCARTAR SESIÓN» del pie.

**Probar T09-01**

- [ ] Al final del Workout: tarjeta punteada «+ Añadir ejercicio» y debajo la tarjeta de cierre; ya no están los tres botones de antes
- [ ] Marcar series → el número y la barra de la tarjeta suben al momento
- [ ] A medias, «Terminar sesión» sale en gris; al marcar la última serie se pone en lima
- [ ] Papelera → pide confirmación con el nombre y lo que llevas; «Cancelar» vuelve al entreno sin perder nada; confirmar descarta y vuelve a Inicio
- [ ] Papelera con todo hecho → también pide confirmación
- [ ] Sesión solo con bloques (AMRAP/EMOM) → la tarjeta cuenta bloques
- [ ] Sesión libre → la tarjeta punteada abre la hoja de añadir, como hoy

## 4. T09-02 — Hoja «Terminar sesión» a medias

Con todo hecho, Terminar llama a `handleSave` como hoy (va al resumen). A
medias abre un `DragSheet`:

- **Cabecera de la hoja**: «Terminar sesión» (`title`) a la izquierda y una
  **X** a la derecha (32×32, círculo `surface2`). Se cierra también con el velo
  y deslizando, como cualquier `DragSheet`.
- Frase (`body`, `mutedLight`): «Se guarda lo que has marcado. Las series sin
  marcar no cuentan.»
- **Cifras** en una caja `bg`, radio 10, tres columnas separadas por una línea:
  series hechas, minutos, kg movidos (el volumen que ya calcula el recap; si no
  hay peso, se quita esa columna).
- **Sin terminar** (`caps`, `mutedLight`) y una fila por ejercicio o bloque
  incompleto: nombre (`bodyStrong`) a la izquierda; a la derecha «2 de 3»
  (`label`, `mutedLight`) o «sin empezar» en rojo claro (`redText` al tono de
  la maqueta).
- **Un solo botón**: «Guardar sesión» (lima, a lo ancho) → `handleSave`.
- Descartar **no está en la hoja**: vive en la papelera de la tarjeta.

**Probar T09-02**

- [ ] A medias → Terminar → hoja con las cifras y la lista de lo que falta; cada ejercicio incompleto dice cuántas lleva o «sin empezar»
- [ ] La X, el velo y deslizar hacia abajo cierran la hoja sin guardar
- [ ] «Guardar sesión» → va al resumen y el historial solo tiene las series marcadas
- [ ] Con todo hecho → Terminar va directo al resumen, sin hoja

## Fases

| Fase | Qué | Depende de | Coste | Estado |
|---|---|---|---|---|
| T09-01 | Tarjeta de cierre, añadir en la lista, papelera con aviso | — | 🟢 | ✅ sin commit — `activeSessionProgress` en `utils/activeSession.js` (con test) y `WorkoutScreen.jsx` |
| T09-02 | Hoja «Terminar sesión» | T09-01 | 🟢 | ✅ sin commit — `DragSheet` en `WorkoutScreen.jsx` |
