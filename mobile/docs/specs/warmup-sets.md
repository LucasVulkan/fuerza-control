# Spec — Series de calentamiento

> Estado: **spec cerrada, lista para implementar**. Mockups aprobados
> (`warmup_sets_editor_workout_mockup`). Decisión clave del usuario: granularidad
> SOLO en el bloque de calentamiento — NO convertir las series de trabajo en
> editables una a una (rompería evaluador de progresión, stats, plannedSets y sync;
> pirámides/top-set serán una feature futura aparte).

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

En el log, las series de calentamiento se guardan DENTRO de `exercise.sets` con
flag: `{ weight, reps, time:'', done, isWarmup: true }`, ANTES de las de trabajo.

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

### Workout (`ExerciseCard`)
- Sub-bloque visualmente hundido (fondo más oscuro, valores atenuados, índices
  C1/C2/C3) ENCIMA de las series de trabajo. Ver mockup.
- Pre-relleno de peso/reps por `computeWarmupWeights`; inputs editables normales.
- ✓ de una C → si `restSec > 0`, dispara el rest timer con ESE valor (no el del
  ejercicio); si 0, no dispara nada.
- La meta line del header añade `· C×3`.
- `allDone` (colapso de la card) INCLUYE las C.
- Sin columna RPE en las C aunque `trackRpe` esté activo.
- Sin referencia de peso: banner "las C se calculan al escribir tu primer peso de
  trabajo" (mockup) — al teclear el primer peso de trabajo se rellenan las C vacías.

## 4. Exclusiones (dónde filtrar `isWarmup`)

| Consumidor | Regla |
|---|---|
| Progresión (`getProgression` — el array `lastSets` que se le pasa) | filtrar isWarmup al ensamblar |
| Fantasmas "última vez" (SetRow prev*) | solo series de trabajo |
| Autofill del ✓ en `saveSession` | mapear C con C y trabajo con trabajo (las C se autofillan de las C previas) |
| `plannedSets` | solo trabajo (`ex.sets`) — las C no suman |
| `recapStats` (volumen y series) | filtrar isWarmup |
| `detectPRs` / `compareToLast` | filtrar isWarmup (en `doneSets` de sessionRecap: excluir isWarmup) |
| `sessionStats` (duración estimada) | SÍ contar las C: `nCalent × (35 + warmup.restSec)` |

## 5. i18n (es/en, sección `exerciseEditor.warmup` + `workout.warmup`)
Ninguno/Auto/Personalizado, "Calentamiento", "Series de calentamiento",
"＋ Añadir paso", "Descanso entre calentamientos", "sin temporizador",
hint de rampa, banner de referencia pendiente. (Definir claves al implementar,
patrón `_one/_other` si hay plurales.)

## 6. Fases
1. 🟢 `src/utils/warmup.js` + tests + filtros `isWarmup` en sessionRecap (con tests).
2. 🟡 Editor (bloque Calentamiento con 3 modos + restSec).
3. 🟡 Workout (sub-bloque C, pre-relleno, timer propio, autofill/save con flag) + exclusiones de §4 restantes.
