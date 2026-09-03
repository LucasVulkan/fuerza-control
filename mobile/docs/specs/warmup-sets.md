# Spec — Series de calentamiento

> Tema: entrenamiento
> En corto: Series de calentamiento calculadas a partir del peso de trabajo, como pills informativas que no se registran ni cuentan para el volumen.
> Fase T16 · hecho · `src/utils/warmup.js` + tests (`45a74ee`)
> Fase T17 · hecho · Editor: bloque Calentamiento con 3 modos (`f04a254`)
> Fase T18 · hecho · Workout: fila de pills no registradas (rediseño de la fase 3)
>
> Estado: **✅ IMPLEMENTADA, Fase 3 REDISEÑADA (jul 2026)**. Fase 1 — util puro
> `src/utils/warmup.js` (`45a74ee`). Fase 2 — bloque Calentamiento en
> `ExerciseEditorInline` + duración estimada en `sessionStats.js` (`f04a254`, SIN
> cambios en el rediseño). Fase 3 original (`8d7d187`) hacía el calentamiento
> interactivo — filas C1/C2/C3 editables DENTRO de `setsState`, con ✓ propio y
> timer — pero tras verlo en uso el usuario pidió que el calentamiento pierda
> protagonismo: pasa a ser una fila de **pills no-registradas** (§3), sin compartir
> estructura con las series de trabajo. Esto revierte toda la integración de la
> Fase 3 original en `setsState`/`toggleSetDone`/`saveSession` — ver §7.
>
> Ajuste sobre el texto original de esta spec, descubierto al implementar la Fase 1:
> §4 (ya retirada) asumía que `sessionRecap.js` ensambla el array que alimenta a
> `getProgression` — no es así, el filtro vivía dentro de `getProgression`
> (`src/utils/progression.js`). Con el rediseño de la Fase 3 este filtro (y el de
> `sessionRecap.js`) se retira por completo: el calentamiento nunca entra en
> `exercise.sets`, así que no hay nada que excluir.

## 1. Modelo de datos

```js
// exConfig (aditivo, sin migración; ausente = sin calentamiento)
exConfig.warmup = null
  | { mode: 'auto',   sets: 1|2|3|4, restSec: 60 }
  | { mode: 'custom', steps: [{ pct: number, reps: number }], restSec: 60 }
// restSec: descanso tras CADA serie de calentamiento. Default 60. 0 = sin temporizador.
// Un solo valor para todo el bloque — NO por paso (decisión cerrada).
```

Rampas del modo `auto` (constantes, no configurables):

| sets | pasos |
|---|---|
| 1 | 60%×5 |
| 2 | 45%×8 · 70%×4 |
| 3 | 40%×10 · 60%×6 · 80%×3 |
| 4 | 40%×10 · 55%×8 · 70%×5 · 85%×2 |

El calentamiento **NO se guarda en el log**. No hay fila `isWarmup` en
`exercise.sets` ni en ningún sitio persistido — es una capa puramente visual,
calculada en vivo a partir de `exConfig.warmup` y del peso de trabajo resuelto
(§2). Cerrar el ejercicio, cambiar de sesión o reabrir la app reinicia
cualquier marca de "hecho" sobre las pills — no hay nada que recordar.

## 2. Peso de referencia y cálculo

`pct` es **% del peso de trabajo del día**, resuelto en cascada:
1. Prescripción del entrenador (override `weight` de `pendingOverrides`).
2. Peso del top set de la última sesión — usando la MISMA referencia `lastExercise`
   que ya calcula el workout (o sea: si el ejercicio está vinculado (`linkGroup`),
   la del grupo).
3. Si no hay nada: los pesos quedan vacíos y se calculan en cuanto el usuario
   teclea el peso de su primera serie de trabajo (banner informativo, ver mockup).

Redondeo: al múltiplo de **2,5 kg** (unidad lb: 5 lb). Los valores calculados son
**pre-relleno editable** — el atleta puede sobrescribir el peso del día sin tocar
la prescripción.

Util puro nuevo `src/utils/warmup.js` + tests:
```js
warmupSteps(warmupConfig)                    // → steps efectivos (auto→rampa, custom→steps)
computeWarmupWeights(steps, workWeightKg)    // → [{weightKg|null, reps}] con redondeo
resolveWorkWeight(overrideEx, lastExercise, typedFirstWorkWeight) // cascada de arriba
```
Tests mínimos: rampas auto por tamaño; redondeo 2,5 (ej. 0.4×83=33.2→32.5);
workWeight null → weights null; custom steps arbitrarios; cascada de referencia.

## 3. UI

### Editor de ejercicio (`ExerciseEditorInline`, sección VOLUMEN, debajo del rango)
- Fila "Calentamiento": SegPicker `Ninguno | Auto | Personalizado`.
- Auto → StepField "Series de calentamiento" (1–4) + hint con la rampa resultante.
- Personalizado → lista de filas `C1 [pct %] × [reps]` con ✕ por fila y
  "＋ Añadir paso" (máx 6). Previa resuelta a la derecha ("→ 40 kg") usando el
  peso de referencia actual si existe.
- Campo "Descanso entre calentamientos" (stepper, 0–180, default 60; 0 muestra
  hint "sin temporizador").
- Entra en el autosave debounced existente (`commitValues`).
- La frase RESUMEN del editor no cambia (sigue describiendo el trabajo).

### Workout (`ExerciseCard`) — diseño vigente (Fase 3-bis)
Fila no-registrada ENCIMA de las series de trabajo, fuera de `setsState`:

```
Calentamiento ·············· 90s descanso
[ 40kg×10 ] → [ 55kg×8 ] → [ 70kg×5 ]
```

- Label "Calentamiento" + el `restSec` configurado como texto plano (SIN
  temporizador propio de fila — es informativo, salvo el tap descrito abajo).
- Una pill por paso, encadenadas con una flecha, con el peso×reps calculado
  **en vivo** por `computeWarmupWeights(warmupSteps(exConfig.warmup), workWeightKg)`.
  `workWeightKg` sale de la cascada de §2, SIEMPRE recalculada en cada render
  (si el atleta cambia el peso de su primera serie de trabajo después de haber
  tocado alguna pill, los números de las pills — tocadas o no — se actualizan
  igual; no hay snapshot congelado por pill).
- Estado por pill: **local al componente, NO persistido** — `useState` con el
  set de índices tocados, se reinicia en cada montaje (cambio de sesión,
  reapertura de la app). Gris por defecto → toca la pill → verde + dispara
  `startRestTimer(exConfig.warmup.restSec, nombreDelEjercicio)` (si `restSec >
  0`; si es 0, la pill solo cambia de color, sin timer). Tocar una pill ya
  verde la desmarca (vuelve a gris) sin efecto secundario.
- Sin referencia de peso (`workWeightKg == null`): las pills muestran el % y
  las reps pero sin kg (p. ej. "40% × 10") o un hint corto de que faltan datos
  — decisión de implementación, no bloqueante.
- Las pills NO participan en `allDone`/colapso de la card, ni en la meta line
  como conteo obligatorio (opcional mantener `· C×N` si aporta).
- Nunca aparece columna RPE aquí — no aplica a algo no registrado.

## 4. Consumidores — ya NO requieren filtrar nada

Al no entrar el calentamiento en `exercise.sets`, ningún consumidor necesita
excluirlo: `getProgression`, fantasmas "última vez", `saveSession`,
`plannedSets`, `recapStats`, `detectPRs`/`compareToLast` funcionan exactamente
como si el calentamiento no existiera como dato. La única pieza que SÍ conoce
el calentamiento fuera de la UI del workout es `sessionStats` (duración
estimada), que sigue sumando `nCalent × (35 + warmup.restSec)` por ejercicio a
partir de la CONFIG (`exConfig.warmup`), no de filas registradas — sin cambios
aquí.

## 5. i18n (es/en, sección `exerciseEditor.warmup` + `workout.warmup`)
`exerciseEditor.warmup.*` (Fase 2, editor) sin cambios. `workout.warmup.*`
(Fase 3-bis, fila de pills): label "Calentamiento", texto de descanso,
hint de "sin referencia" reescrito para el diseño de pills (ya no habla de
"C×N vacías", habla de peso pendiente). Repasar `metaSuffix`/`noReference`
existentes y ajustarlos o retirarlos según haga falta.

## 6. Fases
1. 🟢 `src/utils/warmup.js` + tests (reutilizado tal cual por la Fase 3-bis).
2. 🟢 Editor (bloque Calentamiento con 3 modos + restSec) — sin cambios en el rediseño.
3. 🟢→🔁 Workout — REDISEÑADO de sub-bloque C editable a fila de pills no-registradas (Fase 3-bis). Ver §7.

## 7. Fase 3-bis — qué se revierte y qué se construye

**Se retira** (todo lo que integraba el calentamiento en `setsState`):
- `startSession`: siembra de `warmupRows` con `isWarmup: true`.
- `syncSessionSets`: resize independiente del grupo warmup/work.
- `toggleSetDone`: branch `if (set_.isWarmup)` (rest timer propio por fila).
- `saveSession`: preservación de `isWarmup` en `resolveSet` y el emparejamiento
  C-con-C / trabajo-con-trabajo por grupo relativo — vuelve al emparejamiento
  posicional simple de antes.
- `ExerciseCard`: split `warmupEntries`/`workEntries`, el `useEffect` de
  "hornear" valores en filas C en blanco, y el sub-bloque `SetRow` C1/C2/C3.
- Filtro `!s.isWarmup &&` en `getProgression` (`src/utils/progression.js`) y en
  `doneSets` (`src/utils/sessionRecap.js`) — dead code una vez el calentamiento
  no entra nunca en `exercise.sets`.
- Import no usado de `warmupSteps` en `useStore.js` si queda huérfano.

**Se construye** (nuevo, dentro de `ExerciseCard`):
- Fila de pills descrita en §3, usando `warmupSteps`/`computeWarmupWeights`/
  `resolveWorkWeight` de `src/utils/warmup.js` (sin cambios en ese util — se
  reutiliza para cálculo en vivo en vez de para sembrar filas).
- Estado local `Set<number>` de pills tocadas + handler de tap que llama a
  `startRestTimer` (acción de store ya existente, independiente de
  `toggleSetDone`).

**No cambia**: `ExerciseEditorInline` (Fase 2), `sessionStats.js` (duración
estimada), el modelo de datos de `exConfig.warmup` (§1, salvo que ya no
describe cómo se guarda en el log — porque no se guarda).
