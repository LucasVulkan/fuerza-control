# Spec — Editor masivo de sesión/etapa + sustitución de ejercicios

> Tema: programas
> Progreso: sin-empezar
> En corto: Cambiar muchas filas del editor de una vez: el descanso de las 24 filas de un bloque, una serie más a todos los accesorios, o press banca por inclinado en las siete sesiones donde aparece. Lo que en Excel es arrastrar una columna.
> Falta: Entera.
>
> Estado: **spec cerrada, sin implementar** (ago 2026).
>
> Qué resuelve: lo que un entrenador hace en Excel arrastrando una columna.
> Cambiar el descanso de las 24 filas de un bloque, subir una serie a todos los
> accesorios, o cambiar press banca por press inclinado en las siete sesiones
> donde aparece porque el cliente se ha lesionado el hombro. Hoy las tres cosas
> son ediciones de una en una.
>
> Sale de la conversación sobre exportar a Excel. **La parte de exportación
> sigue sin definir y no es esta spec.**

---

## 1. Concepto

La única edición en masa que existe hoy es
[`applyRx`](../../../src/utils/stageRx.js), y solo se puede usar **al crear una
etapa** — sus dos únicas llamadas están en `addStageToProgram`
([useStore.js:1209](../../store/useStore.js) y :1288). Eso deja tres muros:

| Muro | Consecuencia |
|---|---|
| Solo al **crear** | Sobre una etapa que ya existe no hay edición masiva ninguna |
| Alcance = trío fijo `all`/`keys`/`accessories` | No existe "estos tres que he elegido" |
| El eje son **parámetros** | Sustituir un ejercicio en todas las sesiones no es expresable (`applyRx` nunca toca `exerciseId`, a propósito) |

Esta spec quita los tres, con dos entregables:

- **Editor masivo** — N ejercicios seleccionados, cambio de parámetros, en modo
  absoluto o relativo.
- **Sustitución masiva** — un ejercicio por otro, en todas las sesiones del
  alcance.

---

## 2. Decisiones cerradas con el usuario (no re-litigar)

1. **Un solo editor, no dos.** El alcance (sesión / etapa) es un **parámetro**
   de la pantalla y se puede cambiar **dentro** de ella. La puerta de entrada
   solo lo prefija. Precedente en este mismo repo: `addClientBilling` se invoca
   desde el detalle del cliente (cliente implícito) y desde
   `GlobalAddBillingSheet` (cliente elegido en un desplegable) — misma
   operación, dos puertas, una sola implementación.

2. **La lista se agrupa por `exerciseId`, no por fila.** Una etapa de 4 sesiones
   × 6 ejercicios no son 24 entradas: son ~14 ejercicios distintos, porque el
   press banca aparece en dos sesiones. El entrenador piensa "press banca", no
   "press banca de la sesión A". Seleccionar una entrada selecciona **todas sus
   instancias dentro del alcance**. En alcance sesión el contador es siempre 1 y
   no se pinta: **el mismo componente, sin ninguna rama**.

3. **El modo absoluto/relativo va POR CAMPO, no global.** Dos razones, las dos
   dirimentes: solo los campos numéricos tienen las dos lecturas (la progresión
   es un interruptor, ni absoluto ni relativo), y **mezclar es un caso real**
   —"ponlos todos a 4 series **y** súbeles 30 s de descanso"— que con un toggle
   global exige dos pasadas.

4. **Esto NO es un `rx` y nunca escribe `stage.rx`.** `rx` es una regla de
   **derivación**: se guarda como procedencia de la etapa y `describeRx` la
   pinta en [ProgramEditorScreen:504](../../src/screens/ProgramEditorScreen.jsx).
   "Poner 4 series" es una **asignación**, no un delta contra una base: no cabe
   en el modelo y meterla a la fuerza haría mentir a esa fila.

5. **El descanso se edita en SEGUNDOS en los dos modos.** `rx.restPct` es
   porcentual porque una regla de etapa **escala** un bloque entero; una edición
   puntual no. Un entrenador dice "dos minutos" o "+30 segundos", nunca "+25 %".

6. **v1 abre solo desde el ⋯ de la sesión.** Con el selector de alcance dentro
   de la pantalla, la segunda puerta es redundante hasta saber si alguien usa el
   alcance de etapa. Ver §7, que además explica por qué la puerta de etapa no es
   gratis.

7. **El modo absoluto se confirma con los valores de origen, no con un
   contador.** §4.5. Es la única red que hay.

---

## 3. Lo que YA existe (no reconstruir)

| Pieza | Dónde | Qué aporta |
|---|---|---|
| `applyRx` + suelos `MIN_SETS`/`MIN_REPS`/`MIN_REST` | [stageRx.js:199](../../../src/utils/stageRx.js) | La aritmética del modo **relativo** ya está escrita y probada |
| `updateExerciseParams(templateId, exerciseId, updates)` | [useStore.js:772](../../store/useStore.js) | Escribe la config **y propaga a los miembros de `linkGroup`** por todo el programa. Salta escrituras no-op para no crear copias "editadas" de hermanos intactos |
| `replaceExercise(templateId, old, new)` | [useStore.js:837](../../store/useStore.js) | La sustitución de 1 plantilla ya existe: mapea `exerciseId` y resetea `progressionOverride`. **No** mira `linkGroup` ni colisiones |
| `getEffectiveTemplate` = `userPrograms[id] ?? sessionTemplates[id]` | [useStore.js:727](../../store/useStore.js) | Copy-on-write: se lee la efectiva, se escribe siempre en `userPrograms` |
| `linkGroupTemplateIds` / `pickLinkedConfig` | [exerciseLinks.js](../../../src/utils/exerciseLinks.js) | Resolución de grupos vinculados |
| `programTemplateIds(program)` | [exerciseLinks.js:33](../../../src/utils/exerciseLinks.js) | Todas las plantillas de un programa, etapas incluidas |
| ⋯ del editor de sesión (`DragSheet` + `SheetRow`) | [SessionEditorScreen:584](../../src/screens/SessionEditorScreen.jsx) | La puerta ya está puesta: hoy lleva Duplicar / Restaurar / Eliminar |
| `ExerciseSelector` con `currentExerciseId` | [SessionEditorScreen:359](../../src/screens/SessionEditorScreen.jsx) | El paso "elige el ejercicio nuevo" de la sustitución ya está construido |
| `sessionSlots` | [utils/sessionSlots.js](../../src/utils/sessionSlots.js) | Agrupación de superseries, si la lista necesita respetarla |

### 3.1 El hallazgo que hace la feature barata

**`SessionEditorScreen` solo se alcanza desde `ProgramEditorScreen`**
([:419](../../src/screens/ProgramEditorScreen.jsx)). Y ese flujo ya hace, sin
que nadie más tenga que enterarse:

- toma `_editSnapshot` al entrar (`beginEditSession(editingId)`,
  [:111](../../src/screens/ProgramEditorScreen.jsx)) — acotado al programa que se
  edita, más el diccionario de sesiones entero;
- revierte con `restoreSnapshot()` ([:127](../../src/screens/ProgramEditorScreen.jsx))
  y avisa al salir con `hasUnsavedChanges()` ([:141](../../src/screens/ProgramEditorScreen.jsx));
- llama a `markProgramDirtyForClients(editingId)` al guardar ([:273](../../src/screens/ProgramEditorScreen.jsx)).

Con **una** salvedad, del [§12 de la auditoría](auditoria-tecnica.md#12):
`importData` invalida la foto, así que si entra una actualización del entrenador
mientras el editor está abierto, cancelar deja de revertir y simplemente sale.
Es lo correcto —el import ya había reemplazado el programa entero— pero significa
que el deshacer del editor masivo no está garantizado si se importa por debajo.

Por tanto la edición masiva **no necesita deshacer propio, ni una confirmación
de "esto no tiene vuelta atrás", ni marcar los programas de los clientes**: se
confirma con Guardar y se descarta con el guard de cambios sin guardar, igual
que cualquier otra edición del editor.

⚠️ **Esto es un requisito de dónde vive, no una casualidad.** Si algún día el
editor masivo se abre desde fuera de ese flujo (por ejemplo desde el
planificador de etapas, que es pantalla propia), hay que resolver el deshacer
**antes** de abrir esa puerta. Ver §7.

---

## 4. FASE 1 — Editor masivo

### 4.1 `src/utils/bulkEdit.js` (nuevo, puro, con tests)

Vive en `src/utils/` —compartido, tests vitest desde la raíz— como `stageRx.js`
y `stageProgress.js`.

```js
/**
 * Op: { mode: 'set' | 'add', value }
 *   'set' → asignación (todos a 4 series)
 *   'add' → delta      (una serie más a cada uno)
 *
 * ops: {
 *   sets?:        Op,                          // value: number
 *   reps?:        Op,                          // 'set' → { min, max } · 'add' → number
 *   restSec?:     Op,                          // value: segundos
 *   progression?: 'half' | 'deload' | null,    // interruptor, sin modo
 * }
 */
export function applyBulkEdit(exercises, ops, allExercises = {})

/** Diff legible para la confirmación. Ver §4.5. */
export function previewBulkEdit(exercises, ops, allExercises = {})

/** True si `ops` no cambia nada. Mismo papel que `isNoopRx`. */
export function isNoopOps(ops)
```

**Los suelos se reutilizan, no se duplican.** `MIN_SETS`, `MIN_REPS` y
`MIN_REST` son hoy constantes privadas de `stageRx.js`: **exportarlas** (cambio
de una línea) y consumirlas desde aquí. Dos tablas de suelos que se pueden
desincronizar es exactamente el fallo que esta spec no quiere introducir.

`progression: 'half'` y `'deload'` **materializan igual que `applyRx`**:
`resolveProgressionConfig(ex, allExercises[ex.exerciseId])` y luego escribir
`exConfig.progression` con `increment` escalado y/o `hold`. No inventar un
camino nuevo — copiar el de `applyRx` (y si acaba idéntico, extraerlo).

> `progressionOverride` es un campo vestigial: se crea a `null` en `addExercise`
> y nadie lo lee. El campo vivo es `exConfig.progression`.

### 4.2 Los campos y los dos modos

| Campo | `set` (absoluto) | `add` (relativo) | Notas |
|---|---|---|---|
| **Series** | `sets = v` | `sets += v` | Suelo `MIN_SETS`. Si `sets == null`, se salta |
| **Reps** | `minReps = v.min`, `maxReps = v.max` | los dos `+= v` | **Dos controles distintos según el modo**: absoluto pide un rango, relativo un solo desplazamiento (que es el `repsShift` de hoy) |
| **Descanso** | `restSec = v` | `restSec += v` | En **segundos**, §2.5. Suelo `MIN_REST` |
| **Progresión** | — interruptor, sin modo — | | `sin cambios` / `incremento a la mitad` / `descarga` |

**Los ejercicios de tiempo se saltan en el campo Reps.** `time_progression` y
`submax` no llevan `minReps`/`maxReps` — `buildExConfig` los deja fuera a
propósito — así que el campo no les aplica, **exactamente igual que hace
`applyRx`**. El resto de campos sí. La previsualización tiene que decirlo:
"Reps: 2 ejercicios sin rango, se omiten".

Invariante que hereda de `applyRx` y **no se relaja**: nunca se tocan
`exerciseId`, `order`, `linkGroup`, `supersetWithNext`, `dropset`, `warmup`,
`trainerNote` ni `limitationNote`. La sustitución (fase 2) es la única
operación que toca `exerciseId`, y es otra función.

### 4.3 El alcance

Arriba de la pantalla, y **cambiable ahí mismo**:

```
Alcance   [ Esta sesión · Push A ▾ ]      → Esta sesión / Toda la etapa (4 sesiones)
```

- `sesión` → las plantillas = `[templateId]`
- `etapa`  → `program.stages[stageIdx].days.map(d => d.sessionTemplateId)`

`stageIdx` ya llega como parámetro de ruta a `SessionEditorScreen`. En un
programa sin etapa seleccionada (`stageIdx == null`) el alcance de etapa se cae
a `program.days` — el mismo patrón de `days = stage?.days ?? program?.days ?? []`
que la pantalla ya usa.

### 4.4 La lista

Agrupada por `exerciseId` (§2.2), con filtros rápidos encima:

```
[ Todos ]  [ Básicos ]  [ Accesorios ]          ← isKey, el mismo eje que rx.scope

☑ Press banca            en 2 sesiones     4×6-8 · 150s
☐ Remo con barra         en 2 sesiones     4×8-10 · 120s
☑ Curl bíceps                              3×10-12 · 60s
```

- Los chips **no son exclusivos del alcance de etapa**: "sube una serie a los
  accesorios del día push" los usa en alcance sesión.
- La línea de la derecha muestra la config actual. Si las instancias difieren
  entre sesiones (posible: el vínculo es opcional), se muestra la de la primera
  con un `·` de aviso — el detalle real ya lo da la previsualización.
- El mismo ejercicio dos veces en **una** sesión es raro pero legal: agrupa
  igual, contador 2.

### 4.5 La previsualización — obligatoria, no un extra

El modo absoluto **aplana la variedad deliberada**: la sentadilla a 5 series y
el curl a 3 acaban los dos en 4. Es útil (homogeneizar tras importar, "todos los
accesorios a 3×12") pero destruye información, y es la razón por la que el `rx`
de hoy es solo relativo.

La confirmación **no puede ser un contador**:

```
❌   12 ejercicios afectados

✅   Series      3, 4, 5   →   4          12 ejercicios
     Descanso    90–150s   →   120s       12 ejercicios
     Reps        —                        2 sin rango, se omiten
```

Los valores de origen **distintos, ordenados y deduplicados** son lo único que
frena el error antes de cometerlo. Y sale gratis: `applyBulkEdit` es pura, se
corre sobre una copia y se diffea (`previewBulkEdit`).

### 4.6 Cómo se escribe en el store

**Recorrer `updateExerciseParams` en bucle, una llamada por
(plantilla × ejercicio).** No escribir una acción masiva nueva.

Motivo: `updateExerciseParams` **ya propaga a los miembros de `linkGroup`**
([useStore.js:781](../../store/useStore.js)), y esa propagación no es opcional
—la regla cerrada es "config del grupo vinculado 100 % idéntica, sin
excepciones"—. Una acción masiva nueva tendría que reimplementarla, que es
justo el error que esta spec quiere evitar. Además cada llamada relee la
plantilla efectiva con `get()`, así que las escrituras secuenciales componen
bien.

⚠️ El riesgo es `N` llamadas a `set()`. React 18 agrupa las actualizaciones
dentro de un manejador de eventos, así que deberían colapsar en un render.
**Medir con el caso peor realista** (etapa de 5 sesiones × 8 ejercicios = 40
llamadas) antes de dar la fase por buena. Si tirita, **entonces** se extrae una
acción `bulkUpdateExercises` que haga un solo `set()` — y que tendrá que
replicar la propagación de vínculos, con sus tests.

### 4.7 La pantalla

Pantalla propia registrada en `RootNavigator`, no una hoja: hay lista
seleccionable, filtros, campos y previsualización, y `DragSheet` no da para
tanto. Parámetros de ruta: `{ programId, stageIdx, templateId, mode: 'params' }`
(ver §5.2 para `mode: 'replace'`).

El botón Aplicar se deshabilita si la selección está vacía **o** si
`isNoopOps(ops)`.

---

## 5. FASE 2 — Sustitución masiva

### 5.1 Las cuatro decisiones

`replaceExercise` ya existe y ya hace lo correcto para **una** plantilla. La
sustitución masiva es un bucle sobre las plantillas del alcance donde aparezca
el ejercicio de origen. Lo que no está resuelto:

**1. Colisión.** Si el ejercicio nuevo **ya está** en esa plantilla, quedan dos
filas del mismo ejercicio; `replaceExercise` no lo comprueba.
→ **Se omite esa plantilla y se dice en el resumen**: *"2 sesiones omitidas: ya
tienen Press inclinado"*. Fusionar las dos filas automáticamente sería adivinar
qué configuración gana.

**2. `linkGroup`.** El grupo se resuelve por `exerciseId + linkGroup`
(`linkGroupTemplateIds`). Sustituir unas instancias y no otras parte el grupo en
dos mitades que comparten `linkGroup` y ya no comparten ejercicio.
→ **Si el ejercicio está vinculado, se sustituye el grupo entero o no se
sustituye.** Coherente con la regla cerrada del vínculo, y el aviso tiene que
decirlo antes de aplicar (*"vinculado en 3 sesiones, se sustituyen las 3"*).

**3. `supersetWithNext`.** La cadena es por adyacencia y `replaceExercise`
conserva `order`, así que sobrevive sin trabajo. **No hay código que escribir,
pero sí un caso de QA** (§9): no darlo por bueno sin verlo.

**4. Los parámetros se conservan.** `replaceExercise` solo cambia el id y
resetea `progressionOverride`. Es lo correcto para el caso real —lesión o
material ausente: quieres el mismo volumen en el sustituto—. Si el ejercicio
nuevo es de otra naturaleza (uno de tiempo por uno de reps), `minReps`/`maxReps`
quedan colgando sin efecto. **Se acepta**: es exactamente lo que ya pasa hoy al
sustituir una fila, y el editor de ejercicio lo resuelve si hace falta.

### 5.2 Flujo

Misma puerta, otra fila del ⋯:

1. **Sustituir ejercicio** → la misma pantalla de §4.7 con `mode: 'replace'`.
2. Alcance (§4.3) y **la misma lista de §4.4**, pero de selección única.
3. Elegido el de origen → `ExerciseSelector` con `currentExerciseId`, que ya
   existe y ya se usa para sustituir una fila ([SessionEditorScreen:359](../../src/screens/SessionEditorScreen.jsx)).
4. Vuelta con el destino → **resumen** con lo de §5.1 (cuántas sesiones, cuántas
   omitidas y por qué, si arrastra un grupo vinculado) → Confirmar.

La lista y el alcance se comparten con la fase 1; lo único propio es el paso 3 y
el resumen.

---

## 6. Puntos de entrada

Dos filas nuevas en el ⋯ que ya existe
([SessionEditorScreen:584](../../src/screens/SessionEditorScreen.jsx)), junto a
Duplicar / Restaurar / Eliminar:

```
Editar ejercicios en grupo
Sustituir ejercicio
```

**La puerta de etapa NO entra en v1** (§2.6), y no solo por prudencia de
producto: el ⋯ de `ProgramEditorScreen` **lo quitó el usuario** —el comentario
de [:349](../../src/screens/ProgramEditorScreen.jsx) dice que tenía una sola
acción y se movió a la hoja del "+" del selector de etapas—, y esa hoja es para
**añadir**, no para editar. Resucitar el ⋯ reabre una decisión ya cerrada.

Si tras usarlo se ve que el alcance de etapa se cambia a menudo, la puerta
natural es la **hoja de etapa** que ya existe en ese editor, no un ⋯ nuevo.

---

## 7. i18n

Namespace `bulk.*` en `src/locales/es.json` **y** `en.json`: título, las dos
filas del ⋯, etiquetas de alcance, los tres chips de filtro, los cuatro campos,
las etiquetas de modo (`=` / `±` necesitan nombre accesible), el contador "en N
sesiones", las líneas de la previsualización y los mensajes de omisión de la
sustitución.

Reutilizar `planner.fields.*` **no** vale: allí las etiquetas están redactadas
como regla de derivación ("Series en accesorios"), aquí son campos.

---

## 8. Qué NO tocar

- **`stageRx.js`**, salvo exportar los tres suelos (§4.1). `applyRx` y las
  escaleras siguen siendo el camino de *creación* de etapas y no cambian.
- **`stage.rx` y `describeRx`.** Una edición masiva no reescribe la procedencia.
  Si la etapa venía de una escalera, `stage.rx` sigue describiendo su origen
  correctamente; lo que deja de ser cierto es que la etapa sea *exactamente*
  eso. Si algún día molesta, se arregla con un `stage.edited = true` y una
  coletilla en la fila de procedencia — **no** metiendo la edición en `rx`.
- **`updateExerciseParams`** y su propagación de vínculos: se consume, no se
  modifica.
- **`replaceExercise`**: se consume tal cual. Las comprobaciones de colisión y
  vínculo viven en la capa de arriba, no dentro.
- **El circuito de guardado del editor de programa** (`_editSnapshot`,
  `hasUnsavedChanges`, `markProgramDirtyForClients`). La feature depende de él
  íntegro (§3.1).

---

## 9. Casos borde (checklist de QA)

| Caso | Resultado esperado |
|---|---|
| Etapa de 4 sesiones con el mismo ejercicio en 3 | **Una** entrada, "en 3 sesiones", se editan las 3 |
| Alcance sesión, ejercicio **vinculado** a otras sesiones | Las instancias del grupo **fuera del alcance también cambian** (invariante del vínculo) |
| Plancha (ejercicio de tiempo) + campo Reps | Se salta; la previsualización lo declara. No se le inventa `minReps` |
| Absoluto sobre series 3, 4 y 5 | La previsualización dice `3, 4, 5 → 4`, no "12 afectados" |
| Relativo −2 series sobre un ejercicio de 1 serie | Queda en 1 (`MIN_SETS`), nunca 0 ni negativo |
| Relativo −120 s sobre un descanso de 90 s | Queda en 15 (`MIN_REST`) |
| Cambiar de alcance sesión→etapa con selección hecha | La selección se conserva por `exerciseId`; los que ya no existan en el alcance nuevo se caen sin avisar |
| Aplicar y salir **sin guardar** | El guard de `ProgramEditorScreen` avisa; descartar revierte **todo**, incluida la edición masiva |
| Selección vacía, u `ops` sin cambios | Aplicar deshabilitado |
| Sustituir por un ejercicio ya presente en esa sesión | Esa sesión se omite; el resumen dice cuántas y por qué |
| Sustituir un ejercicio vinculado | Se sustituye el grupo entero, avisado antes de aplicar |
| Sustituir un miembro de una superserie | La cadena sobrevive intacta (`order` no cambia) |
| Etapa bloqueada (`isStageLocked`) | **No aplica.** El candado impide que el *cliente* avance, no que el entrenador edite |
| Sesión libre (`__free__`) | No alcanzable: el editor masivo vive en el editor de programa |
| Etapa de 5 sesiones × 8 ejercicios | Un solo render (§4.6). Medir antes de dar la fase por buena |

---

## 10. Descartado, con motivo (no re-litigar)

- **Un editor tipo rejilla** (sesiones × ejercicios, celdas editables). Es la
  trampa evidente de esta línea de trabajo: sería el peor Excel del mercado en
  la peor pantalla posible.
- **Alcance por grupo muscular** (`scope: 'group:back'`). Queda subsumido por la
  selección manual: marcar los 4 de espalda es igual de rápido y evita un cuarto
  concepto en el modelo.
- **Ampliar `rx` con `progression.type` / `direction`.** Ya descartado en
  [stage-planner.md](stage-planner.md) §2.7 y sigue valiendo: eso es física del
  ejercicio, no agresividad del bloque. El editor masivo tampoco los toca.
- **Un toggle absoluto/relativo global.** §2.3.
- **Aplicar a varios clientes a la vez.** Cada cliente tiene su **copia** del
  programa con ids propios (`reidProgramFile`), y nada relaciona las copias. Es
  una feature con techo alto pero exige antes un campo de linaje
  (`program.originId`, mismo patrón que `tpl.derivedFrom`) y su migración. Fuera
  de esta spec, anotado por si algún día se retoma.

---

## 11. Fases

| # | Alcance | Coste |
|---|---|---|
| 1 | `bulkEdit.js` + pantalla + alcance sesión/etapa + campos Series/Reps/Descanso + previsualización | 🟡 |
| 2 | Sustitución masiva (§5) reutilizando lista y alcance de la fase 1 | 🟡 |
| 3 | Campo Progresión (incremento a la mitad / descarga) en el mismo editor | 🟢 |

La 1 y la 2 son las que resuelven los dos casos que un entrenador vive cada
semana (ajustar un bloque en marcha, sustituir por lesión). La 3 es una cuarta
fila en una pantalla que ya existe, y su lógica es un copiar de `applyRx`.
