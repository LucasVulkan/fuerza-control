# Spec — Bloques de acondicionamiento (AMRAP / EMOM / For time)

> Estado: **spec cerrada, lista para implementar**. Mockups aprobados por el usuario
> (workout view AMRAP+EMOM, pantalla de setup). Decisiones de producto ya tomadas —
> no re-abrirlas sin consultar.
>
> Para el implementador: los patrones de código a imitar están en §13. Implementar
> por fases (§12), cada fase compila y pasa `npx vitest run` por sí sola.

---

## 1. Concepto y alcance

Un **bloque de acondicionamiento** es una unidad de entreno tipo metcon que vive
DENTRO de una sesión, en paralelo a los ejercicios de fuerza. Es una **capa
separada**: NO reutiliza `ExerciseCard`, NO participa en el motor de progresión
(`src/utils/progression.js`), NO cuenta series/volumen. Su centro es un reloj y
su resultado es un **score de bloque**, no un log de series.

### Formatos v1

| Formato | Fijo | Se mide | Reloj | Score |
|---|---|---|---|---|
| `amrap` | tiempo (`capSec`) | trabajo hecho | cuenta atrás | rondas + reps extra |
| `emom` | intervalos (`intervalSec` × `rounds`) | intervalos cumplidos | intervalo cíclico | n/N intervalos hechos |
| `for_time` | trabajo (`rounds` × movimientos) | tiempo | cuenta arriba | tiempo total (o cap) |

### Fuera de alcance v1 (NO implementar)

- Rep-schemes variables (21-15-9, escaleras, chippers) — las reps por ronda son constantes.
- Tabata / intervalos work:rest — `intervalSec` queda preparado pero sin campo de descanso.
- Progresión automática de bloques ("supera tus 7 rondas") — solo registro + comparación en recap.
- Bloques en sesiones libres.
- Gráficas de evolución de scores en Progreso.
- Pausa del reloj (el reloj es wall-clock, ver §4).

---

## 2. Modelo de datos

### 2.1 En la plantilla de sesión (`sessionTemplates[id]` / `userPrograms[id]`)

Campo nuevo **opcional** `blocks` (ausente = sin bloques; no migrar nada):

```js
template.blocks = [ConditioningBlock, ...]
```

```js
ConditioningBlock = {
  id: string,              // generateId('blk')
  format: 'amrap' | 'emom' | 'for_time',
  name: string | null,     // opcional ("Metcon final"); null → se muestra el formato
  capSec: number | null,   // amrap: duración (obligatorio, default 600)
                           // for_time: tope opcional (null = sin límite)
                           // emom: null (no aplica)
  intervalSec: number,     // emom: default 60. amrap/for_time: null
  rounds: number | null,   // emom: nº de intervalos (obligatorio, default 10)
                           // for_time: rondas del circuito (obligatorio, default 3)
                           // amrap: null (las rondas son el score)
  emomMode: 'rotate' | 'all', // solo emom con 2+ movimientos:
                           // 'rotate' (default): un movimiento por intervalo, rotando
                           // 'all': todos los movimientos en cada intervalo
  movements: [{
    exerciseId: string,    // referencia a la biblioteca (exerciseLibrary/customExercises)
    amount: number,        // cantidad prescrita (default 10)
    unit: 'reps' | 'cal' | 'm' | 'sec',  // default 'reps'. SOLO display, sin lógica
    weight: number | null, // kg, opcional (prescripción fija tipo Rx; null = bodyweight)
  }],
  notes: string | null,    // nota del entrenador, visible en workout
}
```

Reglas:
- ~~Los bloques se renderizan **después** de los ejercicios de fuerza, en su orden de array.~~
  **Superado** (rediseño FormaFit del editor de sesión): los bloques se mezclan con los
  ejercicios en el orden que decida el usuario. Cada bloque lleva un campo `order`
  **opcional** con su posición entre *huecos* (un hueco = un ejercicio suelto, una
  superserie entera o un bloque) — se indexa contra huecos y no contra ejercicios para
  que un bloque no pueda partir una superserie por la mitad. Los bloques **sin** `order`
  siguen yendo al final, así que los datos antiguos no necesitan migración. El orden lo
  resuelve `mobile/src/utils/sessionSlots.js`, que usan tanto el editor de sesión como
  `WorkoutScreen`.
- Al **duplicar sesión/etapa** (`duplicateSessionInProgram`/`duplicateStageInProgram`):
  copiar `blocks` con `id` nuevos (`generateId('blk')`) — mismo patrón que los templates.
- `removeSessionFromProgram` no necesita cambios (blocks viajan dentro del template).
- Sync a clientes: gratis — `uploadProgram` ya serializa el template entero.

### 2.2 Presets (globales del dispositivo)

```js
// store root, persistido (añadir 'blockPresets' a partialize)
blockPresets: [ { presetId: string /* generateId('bpre') */, ...ConditioningBlock sin id } ]
```

- Un preset es una **copia congelada** (SIN vínculo vivo — a diferencia de linkGroup).
  Insertar un preset en una sesión copia su contenido con `id` nuevo.
- No se sincronizan a clientes: viajan ya embebidos en el programa.

### 2.3 Estado en vivo (`activeSession`)

```js
activeSession.blockState = {
  [blockId]: {
    startedAt: number | null,   // Date.now() al pulsar EMPEZAR; null = no iniciado
    finishedAt: number | null,  // Date.now() al terminar; null = en curso o no iniciado
    // Resultado en construcción (se edita durante y tras el bloque):
    rounds: number,             // amrap: contador de rondas (default 0)
    extraReps: number,          // amrap: reps parciales al cierre (default 0)
    failed: number[],           // emom: índices (0-based) de intervalos marcados FALLO
    timeSec: number | null,     // for_time: tiempo final al pulsar TERMINAR
  }
}
```

- Añadir `blockState: {}` a `INITIAL_ACTIVE_SESSION` y a los resets existentes.
- Persiste con el resto de `activeSession` (sobrevive kill de la app).

### 2.4 En el log (`workoutLog[n]`)

`saveSession` añade al entry (solo si el template tiene bloques con `startedAt`):

```js
entry.blocks = [{
  blockId: string,
  format, name, capSec, intervalSec, rounds, emomMode,   // snapshot de config
  movements: [...],                                       // snapshot (el template puede cambiar después)
  result:
    // amrap:    { rounds: 7, extraReps: 12 }
    // emom:     { completed: 9, total: 10, failed: [4] }
    // for_time: { timeSec: 522, capped: false }   // capped=true si lo cortó el capSec
}]
```

- **Snapshot obligatorio**: el historial debe seguir siendo cierto aunque el
  entrenador edite el bloque después.
- Bloques **no iniciados** al guardar la sesión: NO se incluyen en el entry.
- Bloques iniciados pero sin terminar: se incluyen con el resultado que haya
  (amrap: rondas contadas; emom: intervalos transcurridos; for_time: `timeSec = elapsed`, `capped:false`).

---

## 3. Utils puros (nuevo archivo `src/utils/conditioningBlocks.js` + tests)

Todo lo derivable del reloj y del resultado va en funciones puras testeables:

```js
// Derivación de tiempo (todas reciben nowMs y startedAt — nada de setInterval dentro):
amrapRemaining(block, startedAt, now)   // → segundos restantes, clamp 0
amrapFinished(block, startedAt, now)    // → remaining === 0
emomPosition(block, startedAt, now)     // → { interval: idx 0-based clamp a rounds-1,
                                        //     intervalRemaining: s, finished: bool }
forTimeElapsed(block, startedAt, now)   // → segundos; si capSec y elapsed>=capSec → clamp + capped
currentMovement(block, intervalIdx)     // emom rotate: movements[idx % movements.length]

// Resultado:
buildBlockResult(block, blockState, now) // → el objeto result de §2.4 según formato
formatBlockScore(result, format)         // → string para UI: "7 + 12", "9/10", "8:42"
                                         // (sin i18n: números y separadores universales)

// Comparación para el recap (vs entry anterior de la MISMA sesión con mismo blockId):
compareBlockResults(format, now, prev)   // → { better: bool|null, delta: string } reglas §7.2

// Estimación para sessionStats:
blockEstimatedSec(block)  // amrap: capSec · emom: intervalSec*rounds
                          // for_time: capSec ?? 600
```

**Tests exigidos** (`src/utils/conditioningBlocks.test.js`, mínimo):
- emomPosition: intervalo correcto en t=0, t=59.9, t=60, último intervalo, finished tras rounds×interval, kill-recovery (now mucho mayor que startedAt → finished).
- amrapRemaining clamp a 0; forTimeElapsed con y sin cap (capped true/false).
- currentMovement rota y hace wrap.
- buildBlockResult por formato, incluido emom con failed[] y bloque a medio terminar.
- compareBlockResults: amrap más rondas / mismas rondas más reps / peor; for_time **menos tiempo = mejor** (¡inversión!); emom más completados; prev inexistente → better:null.

---

## 4. Reglas de tiempo (crítico — leer antes de tocar el workout)

- **Wall-clock siempre**: nunca acumular con `setInterval`. El estado es `startedAt`
  (Date.now persistido); cada render deriva con las utils de §3. Un tick de 1 s
  (`setInterval(() => setTick(n+1), 1000)`) solo REPINTA — igual que `ElapsedClock`
  en `WorkoutScreen.jsx`.
- **Kill/minimizado**: al volver, la derivación da el estado real. Si el tiempo ya
  venció (amrap/emom), la UI muestra el estado "terminado, introduce el score".
- **Notificación**: al empezar un bloque con fin conocido (amrap: capSec; emom:
  intervalSec×rounds) llamar a `showCountdownNotification(nombreBloque, endAt)` de
  `mobile/src/services/timerNotification.js` (el mismo servicio del rest timer:
  cronómetro nativo, cero updates). Cancelarla al terminar/cancelar el bloque.
  `for_time` sin cap: sin notificación.
- **Rest timer**: al pulsar EMPEZAR en un bloque → `stopRestTimer()`.
- Cambio de intervalo EMOM: `expo-haptics` (Haptics.notificationAsync) en el
  render que detecta cambio de `interval` — best effort, solo con app en foreground.

---

## 5. Store — acciones nuevas (`mobile/store/useStore.js`)

```js
// Editor (siguen el patrón inmutable de updateExerciseParams / addSessionToProgram):
addBlockToSession(templateId, block)            // push a template.blocks (crea el array si falta)
updateBlock(templateId, blockId, updates)       // merge shallow
removeBlockFromSession(templateId, blockId)
// Los tres escriben en userPrograms[templateId] (copia efectiva), igual que updateExerciseParams.

// Presets:
saveBlockPreset(block)                          // strip id → push a blockPresets con presetId
deleteBlockPreset(presetId)

// Workout:
startBlock(blockId)          // blockState[blockId] = { startedAt: Date.now(), rounds:0, extraReps:0, failed:[], ... } + stopRestTimer + notificación
updateBlockState(blockId, patch)                // rounds/extraReps/failed/timeSec
finishBlock(blockId)         // finishedAt = Date.now(); si for_time y sin timeSec → timeSec = elapsed; cancelar notificación
resetBlock(blockId)          // borra blockState[blockId] (con Alert de confirmación en la UI, no aquí)
```

`saveSession` (las dos ramas NO — solo la de template): tras construir `exercises`,
si `template.blocks?.length` → construir `entry.blocks` con `buildBlockResult` para
cada bloque con `startedAt`. `plannedSets` NO incluye bloques.

`sessionStats` (`mobile/src/utils/sessionStats.js`): sumar `blockEstimatedSec(block)`
a `seconds` por cada bloque (los bloques NO tocan `sets` ni `patternSets`).

---

## 6. UI — creación y edición

### 6.1 SessionEditorScreen

- Debajo de la lista de ejercicios, si hay bloques: **sección "BLOQUES"** con filas
  estilo ExerciseRow (sin drag, sin swipe v1): tag de formato como badge
  (`AMRAP` accent / `EMOM` blue / `FOR TIME` orange), nombre o formato, meta
  (`12 min · 3 movimientos` / `10 × 1:00 · 2 movimientos` / `3 rondas · 4 movimientos`),
  chevron → abre el editor de bloque. Botón ✕ a la derecha para borrar (Alert confirm).
- Botón **"＋ Añadir bloque"** (dashed, estilo `addExBtn` pero borde neutro) bajo
  "＋ Añadir ejercicio". Al pulsarlo, si hay presets → ActionSheet simple (Alert con
  botones o mini DragSheet): "Nuevo bloque | Desde preset…". Sin presets → directo al editor.
- "Desde preset…": DragSheet con lista de presets (nombre + meta); tocar uno lo
  inserta (copia, id nuevo) y abre el editor sobre él.
- `sessionStats` del resumen ya reflejará la duración estimada (§5).

### 6.2 BlockEditor (modal pageSheet, mismo patrón que el editor de ejercicio en SessionEditorScreen)

Contenido (ver mockup `conditioning_block_setup_amrap`):
1. **Formato**: SegPicker `AMRAP | EMOM | For time` — cambia los campos de abajo.
2. **Parámetros** (steppers estilo `StepField`):
   - amrap → "Tiempo límite" capSec en minutos (1–60, default 10).
   - emom → "Intervalo" (30/45/60/90/120 s — SegPicker) + "Rondas" (2–40, default 10).
     Si 2+ movimientos: toggle "Rotar movimientos por intervalo" (`emomMode`, default rotate).
   - for_time → "Rondas" (1–20, default 3) + "Tope de tiempo" opcional (stepper con
     opción "Sin tope" = null).
3. **Movimientos**: lista de filas `[nombre] [amount] [unit] [peso opcional] [✕]`.
   - "＋ Añadir movimiento" → `ExerciseSelector` existente (navigate con `blockPicker`
     mode nuevo: al seleccionar, en vez de `addExercise`, callback al editor.
     Implementación simple: pasar `onPickForBlock: true` + guardar la selección en un
     campo transitorio del store `ui._blockPickerResult` que el editor consume — o
     lo más simple que encaje con el patrón de navegación existente).
   - `unit`: mini-selector cíclico (tocar alterna reps→cal→m→sec).
   - `weight`: input numérico con la unidad de `useWeightUnit` (guardar SIEMPRE en kg vía `toKg`).
4. **Nombre** (opcional) + **nota del entrenador** (opcional, multiline).
5. Acciones: "Guardar como preset" (secundario) · "Eliminar bloque" (rojo, si edita uno existente).
- Guardado con **autosave debounced 400 ms** (mismo patrón `commitValues` de
  ExerciseEditorInline) — NO botón Guardar.

Validación mínima: un bloque sin movimientos se puede guardar (el editor lo permite),
pero el workout muestra la card con hint "Añade movimientos" y sin botón EMPEZAR.

---

## 7. UI — workout, recap e historial

### 7.1 ConditioningBlockCard (`mobile/src/components/workout/ConditioningBlockCard.jsx`)

Render en `WorkoutScreen` tras las `ExerciseCard`, uno por `template.blocks`.
Estados (ver mockup `workout_view_amrap_emom_blocks`):

**Idle** (sin `startedAt`): header (badge formato + params), lista de movimientos
(`amount unit — nombre — peso con fmt()`), nota si existe, botón accent **EMPEZAR**.

**Running**:
- Común: reloj gigante (tabular-nums, accent), derivado con utils §3 y tick de 1 s.
- amrap: cuenta atrás + "Por ronda" (movimientos) + contador de rondas (botones −/＋
  grandes) + stepper de "reps parciales" + botón "Finalizar · score X + Y".
  Al llegar a 0: el reloj se para, haptic, y queda el estado de edición del score
  con el botón Finalizar (el usuario ajusta rondas/parciales y confirma).
- emom: "Intervalo K / N" + cuenta atrás del intervalo + "Este intervalo" (movimiento
  según `emomMode`/`currentMovement`; con 'all', la lista completa) + "Siguiente" (el
  que viene) + rejilla de rounds (dots: verde=hecho, accent=en curso, rojo=fallo,
  gris=pendiente; **tocar un dot pasado alterna hecho/fallo**) + botón "Fallo" para
  el intervalo en curso. **Los intervalos no marcados cuentan como hechos** (default
  optimista: en un EMOM tienes las manos ocupadas). Al terminar el último intervalo
  → finished automático.
- for_time: cuenta ARRIBA + rondas/movimientos como checklist informativa (sin
  checks obligatorios v1) + botón accent **TERMINAR** (para el reloj → score).
  Si `capSec` y se alcanza: auto-finish con `capped: true`.
- Botón secundario "Cancelar bloque" (texto muted) → Alert → `resetBlock`.

**Finished** (colapsada — pregunta 3 del usuario): fila compacta estilo ExerciseCard
colapsada: ✓ verde + nombre/formato + **score en pill verde** (`formatBlockScore`):
`AMRAP 12′ — 7 + 12` / `EMOM 10 — 9/10` / `For time — 8:42 (cap)`. Tocar expande
resumen read-only (movimientos + score) con acción "Reabrir" (quita `finishedAt`,
vuelve a Running con el reloj real — si ya venció, al estado de edición de score).

### 7.2 Recap (`SessionRecapScreen`)

Sección nueva **"Bloques"** entre "Récords personales" y "Vs. última sesión"
(solo si `entry.blocks?.length`). Fila por bloque: badge formato + nombre + score
grande + chip delta vs la última entrada de la misma sesión que tenga el mismo
`blockId` (`compareBlockResults`):
- amrap: más rondas (o = rondas y más extraReps) → verde `+1 ronda` / `+5 rep`; peor → rojo; igual → `=`.
- emom: delta de `completed` → `+2` / `−1` / `=`.
- for_time: **menos tiempo = mejor** → verde `−0:18`; más → rojo `+0:12`. `capped` → mostrar `(cap)`.
- Sin entrada anterior con ese blockId → sin chip.
Los bloques NO tocan los tiles hero (volumen/series) ni los PRs.

### 7.3 Historial

Donde HistoryScreen renderiza el detalle de una sesión (lista de ejercicios),
añadir tras los ejercicios una línea por bloque: `[badge formato] nombre — score`.
Reutilizar `formatBlockScore`. Nada más en v1.

---

## 8. i18n (añadir a `src/locales/es.json` Y `en.json` — REGLA: nunca hardcodear)

Sección nueva `"blocks"`:

| Clave | es | en |
|---|---|---|
| formats.amrap / emom / for_time | AMRAP / EMOM / For time | AMRAP / EMOM / For time |
| sectionTitle | Bloques | Blocks |
| addBlock | ＋ Añadir bloque | ＋ Add block |
| newBlock / fromPreset | Nuevo bloque / Desde preset | New block / From preset |
| capLabel / intervalLabel / roundsLabel | Tiempo límite / Intervalo / Rondas | Time cap / Interval / Rounds |
| noCap | Sin tope | No cap |
| rotateLabel | Rotar movimientos por intervalo | Rotate movements per interval |
| movements / addMovement | Movimientos / ＋ Añadir movimiento | Movements / ＋ Add movement |
| units.reps/cal/m/sec | reps / cal / m / s | reps / cal / m / s |
| nameLabel / notePlaceholder | Nombre (opcional) / Nota para el atleta… | Name (optional) / Note for the athlete… |
| savePreset / deleteBlock / deletePreset | Guardar como preset / Eliminar bloque / Eliminar preset | Save as preset / Delete block / Delete preset |
| start / finish / fail / cancel / reopen | EMPEZAR / Finalizar / Fallo / Cancelar bloque / Reabrir | START / Finish / Fail / Cancel block / Reopen |
| perRound / thisInterval / nextUp / roundsDone / partialReps | Por ronda / Este intervalo / Siguiente / Rondas completadas / + reps parciales | Per round / This interval / Next up / Rounds completed / + partial reps |
| intervalOf | Intervalo {{k}} / {{n}} | Interval {{k}} / {{n}} |
| remaining / toClose | restante / para cerrar el intervalo | remaining / to close the interval |
| timeUp | ¡Tiempo! Ajusta tu score y finaliza | Time! Adjust your score and finish |
| addMovementsHint | Añade movimientos al bloque | Add movements to the block |
| cappedTag | (cap) | (cap) |
| recapSection | Bloques | Blocks |
| meta.amrap / emom / forTime | {{min}} min · {{moves}} movimientos / {{n}} × {{interval}} · {{moves}} movimientos / {{rounds}} rondas · {{moves}} movimientos | (equivalentes en) |

(Plurales con `_one`/`_other` donde aplique, patrón existente.)

---

## 9. Casos borde (checklist de QA)

1. Kill de la app en mitad de un AMRAP → reabrir → reloj correcto; si venció → estado "Time!" pidiendo score.
2. EMOM: dejar pasar 3 intervalos sin tocar nada → cuentan como hechos; marcar fallo retroactivo tocando el dot.
3. Guardar sesión con un bloque a medias → entry con resultado parcial; recap lo muestra.
4. Guardar sesión sin haber empezado el bloque → entry SIN `blocks`.
5. Editar el programa (quitar el bloque) con sesión activa → `blockState` huérfano se ignora (y se limpia en el próximo reset de sesión).
6. Bloque sin movimientos → card idle con hint, sin EMPEZAR.
7. Empezar bloque con rest timer corriendo → rest timer se detiene, notificación de bloque lo sustituye.
8. Duplicar sesión con bloques → ids nuevos, estado limpio.
9. Preset insertado dos veces en la misma sesión → dos bloques con ids distintos, estados independientes.
10. Cambio kg/lb → pesos de movimientos se muestran convertidos (`useWeightUnit`), se guardan en kg.
11. `for_time` sin cap → sin notificación, reloj indefinido hacia arriba.
12. Recap: bloque nuevo (blockId sin histórico) → score sin chip.

---

## 10. Qué NO tocar

- `src/utils/progression.js` — cero cambios.
- `ExerciseCard` / `SetRow` — cero cambios.
- `plannedSets`, `recapStats`, `detectPRs`, `compareToLast` — cero cambios
  (la sección Bloques del recap es aparte).
- Sistema de vínculos (`exerciseLinks`) — los bloques no se vinculan.

---

## 11. Definition of done global

- `npx vitest run` verde (tests existentes + nuevos de §3).
- `npx eslint` sobre archivos tocados: sin reglas nuevas violadas (las familias
  react-hooks/refs, set-state-in-effect, purity y los no-unused-vars listados en
  memoria del proyecto son PRE-EXISTENTES — comparar contra HEAD antes de "arreglar").
- Todas las strings por `t()` con claves en es Y en.
- Todo estilo vía `makeStyles(th)` + `useThemedStyles` (variable `th`, NUNCA `t`).

---

## 12. Fases de implementación (cada una = 1 commit)

**Fase 1 — datos + utils** 🟢
`conditioningBlocks.js` + tests completos de §3; acciones de editor del store
(add/update/removeBlock, presets + partialize); `duplicateSessionInProgram`/
`duplicateStageInProgram` copian blocks con id nuevo; `blockEstimatedSec` en
`sessionStats`. Criterio: tests verdes, ninguna UI tocada.

**Fase 2 — editor** 🟡
Sección BLOQUES + "＋ Añadir bloque" en SessionEditorScreen; BlockEditor modal
completo; flujo de presets; picker de movimientos vía ExerciseSelector. Criterio:
crear/editar/borrar/preset funciona end-to-end, la sesión guarda blocks en el store.

**Fase 3 — workout runtime** 🔴 (la fase delicada — §4 es ley)
`ConditioningBlockCard` con los 4 estados y 3 formatos; acciones startBlock/
updateBlockState/finishBlock/resetBlock; notificación + haptics + stopRestTimer;
`blockState` en activeSession con kill-recovery. Criterio: checklist §9 puntos 1-2,
5-7, 11.

**Fase 4 — persistencia + recap + historial** 🟡
`saveSession` construye `entry.blocks` (snapshot); sección Bloques en el recap con
`compareBlockResults`; línea de bloques en el detalle de historial. Criterio:
checklist §9 puntos 3-4, 12.

---

## 13. Patrones existentes a imitar (rutas exactas)

| Necesitas | Copia el patrón de |
|---|---|
| Modal pageSheet de edición | `SessionEditorScreen.jsx` → modal del exercise editor |
| Autosave debounced 400ms | `ExerciseEditorInline.jsx` → `commitValues` + `timerRef`/`dirtyRef` |
| SegPicker / StepField / ToggleRow | `ExerciseEditorInline.jsx` (componentes locales) |
| Bottom sheet con drag | `mobile/src/components/DragSheet.jsx` |
| Reloj wall-clock con tick | `WorkoutScreen.jsx` → `ElapsedClock` |
| Notificación countdown nativa | `mobile/src/services/timerNotification.js` → `showCountdownNotification` |
| Acción de store inmutable sobre template | `useStore.js` → `updateExerciseParams` (escribe en `userPrograms`) |
| Card colapsable con check verde | `mobile/src/components/workout/ExerciseCard.jsx` (versión colapsada — solo el aspecto, NO la maquinaria de animación) |
| Fila con badges | `SessionEditorScreen.jsx` → `ExerciseRow` |
| Conversión de peso | `mobile/src/hooks/useWeightUnit.js` (`fmt` INCLUYE unidad; `toDisplay` número pelado; guardar kg con `toKg`) |
| Utils puros + tests | `src/utils/sessionRecap.js` / `exerciseLinks.js` y sus `.test.js` |
