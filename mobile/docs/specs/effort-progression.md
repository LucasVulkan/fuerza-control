# Spec — Progresión por esfuerzo

> Tema: programas
> En corto: Un tercer modo de progresión para avanzados: el entrenador pide reps y un RPE, y la app calcula el peso de cada sesión a partir del 1RM estimado con el RPE que apuntó el cliente. Sustituye a «submáx», que desaparece: sus ejercicios pasan a Fija.
> Fase P46 · hecho · Fuera «submáx»: sus ejercicios pasan a Fija · §3
> Fase P47 · hecho · Motor y editor del modo Por esfuerzo · §4
> Fase P48 · pendiente · El objetivo por esfuerzo en el Workout y las listas · §5
>
> Estado: **P46 y P47 probadas** (29-sep-2026, rama
> `feat/exercise-variants`); P48 sin implementar. Sale de una
> conversación de diseño con el usuario (opción «B»: RPE objetivo + peso
> sugerido por e1RM). Orden: P46 → P47 → P48. P46 va primero porque libera el
> tercer hueco del selector de modo y quita las ramas `'submax'` que P48
> tendría que tocar igualmente.

---

## 1. Contexto y decisiones cerradas

### 1.1 El problema

«Submáx» dice tres cosas distintas según dónde se mire:

- La ayuda de Progresión (`es.json`, `docs.sections` → `progression`): «Submáxima: un porcentaje de tu máximo».
- `exerciseEditor.progressionModels.submax`: «Submáximo — RIR / RPE».
- Lo que hace de verdad: `progression.type: 'none'` + la marca
  `progressionModel: 'submax'` = **sin objetivo de reps, solo registro**
  (`ExerciseEditorInline.jsx:139-143`). Lo usan 7 ejercicios de la librería,
  todos sin carga: flexiones, sentadilla con salto, subida de cuerda, mountain
  climber, burpee, zancada con salto, pull-apart con banda.

El entrenamiento submáximo de verdad (por RPE/RIR) no existe.

### 1.2 Decisiones del usuario

1. **Tres modos: Automática · Fija · Por esfuerzo.** «Submáx» desaparece.
2. **Por esfuerzo es avanzado y no es el modo por defecto de ningún ejercicio**:
   ni de la librería ni del alta de ejercicio propio (`CustomExerciseScreen`
   ofrece solo Automática y Fija).
3. **Los ejercicios sin carga no tienen Por esfuerzo**: pasan a Fija (los 7 de
   §1.1 incluidos).
4. **Reps objetivo, no rango.** En Por esfuerzo el editor enseña un solo campo
   de reps; se guarda como `minReps = maxReps`.
5. **Se pide un RPE objetivo**, y al cliente se le enseña también en
   repeticiones en recámara (RIR = 10 − RPE).
6. **«Registrar RPE» se activa solo y queda bloqueado** mientras el modo sea
   Por esfuerzo: sin RPE el modo no puede calcular nada.
7. **Aviso en naranja en el editor** cuando la combinación de reps y RPE deja
   de ser fiable para la fórmula (§2.3). Avisa, no bloquea.
8. El Workout tiene que dejar claro **el peso objetivo y cuántas reps dejar en
   recámara** (§5).

### 1.3 Descartado (con motivo)

- **Subir el RPE sesión a sesión** («progresión de RPE»): se acaba en 10. Lo
  que progresa es el 1RM estimado; el RPE es la constante. Una rampa de RPE por
  semanas dentro de una etapa (7 → 8 → 9 → descarga) es periodización y va a
  nivel de etapa (`stageRx`), no aquí. Queda como idea futura.
- **Rango de reps con RPE**: el peso no sale unívoco (¿para 8 o para 12?).
- **Top set + back-offs**: más adelante, si se pide.
- **Lastrados** (dominadas o fondos con lastre): `isBodyweight(def)` los
  considera peso corporal y el peso apuntado es solo el lastre, así que Epley
  sobre ese número no vale. Quedan fuera; se podrían añadir con
  `effectiveWeight` (peso corporal + lastre) si hace falta.
- **Ejercicios asistidos** (`progressionDirection: 'decrease'`): menos kilos es
  más difícil, la fórmula no aplica.

---

## 2. Modelo de datos y fórmula

### 2.1 Datos

Nada nuevo en el store. En `exConfig`:

```js
{
  minReps: 5, maxReps: 5,                 // reps objetivo (min = max)
  trackRpe: true,                         // forzado al guardar en este modo
  progressionModel: 'double_progression', // para que las listas lean «reps»
  progression: {
    type: 'effort',                       // NUEVO en PROGRESSION_TYPES
    targetRpe: 8,                         // NUEVO. Entero 6-10, default 8
    // direction, evaluation, increment, seed, hold: como siempre (ignorados
    // salvo `hold: 'deload'`)
  },
}
```

`resolveProgressionConfig` (`progression.js`) añade
`targetRpe: p.targetRpe ?? 8` en la rama del formato nuevo (y `8` en la
legacy, por forma). `LEGACY_TYPE_MAP.effort = 'double_progression'`.

### 2.2 Fórmula (Epley, la que ya usa la app)

`oneRm.js` ya sabe calcular el e1RM con RPE: `epley1RM(w, reps, rpe)` suma las
reps en recámara (`reps + 10 − rpe`) y devuelve `null` por encima de
`MAX_RELIABLE_REPS = 12`. Se añade **la inversa** en el mismo fichero:

```js
/** Peso para hacer `reps` a `rpe` con un 1RM `e1rm`. null si no es fiable. */
export function weightForReps(e1rm, reps, rpe) // r = reps + (10 − rpe); r > 12 → null; r === 1 → e1rm; si no e1rm / (1 + r/30)
```

Con las dos, el ciclo es:

1. **Después de entrenar**: e1RM = media de `epley1RM(weight, reps, rpe)` de
   las series de la última sesión con peso, reps y RPE (las que den `null` no
   cuentan).
2. **Para la siguiente**: peso = `weightForReps(e1RM, repsObjetivo, targetRpe)`,
   redondeado **al más cercano** múltiplo de `def.weightStep` (o 2,5 si es 0 o
   falta).

Ejemplo (verificado a mano): 80 kg × 5 @RPE 8 → e1RM 98,7 → objetivo 5 @8 →
80 kg (mantener). Si el cliente apuntó RPE 7 → e1RM 101,3 → **82,5 kg**. Si
apuntó 9 → e1RM 96 → **77,5 kg**. La app se corrige sola con el RPE que se
apunta. No hace falta tope de salto: `epley1RM` ignora RPE fuera de 5-10, y un
RPE 5 mal apuntado en 5 reps @8 sube un 8 %.

### 2.3 Cuándo deja de ser fiable

Epley pierde precisión según crecen las reps **equivalentes** (reps + recámara):
10 reps @RPE 7 equivalen a 13 al fallo. Regla única, compartida por el aviso
del editor y el motor:

- **reps + (10 − targetRpe) ≥ 12 → aviso naranja en el editor.** Así 10 reps
  @RPE 8 ya avisa (petición del usuario: «al pedir 10 reps que ya avise»);
  10 @RPE 9 no.
- **> 12 → el motor no puede calcular** (`weightForReps` da `null`): el chip
  mantiene el peso de la última sesión con su motivo (§4.2).

La constante es `MAX_RELIABLE_REPS`; no se escribe un 12 a mano en ningún sitio.

### 2.4 Quién puede usar el modo

```js
const canEffort = metric === 'reps' && !isBodyweight(def)
  && (def?.progressionDirection ?? 'increase') !== 'decrease';
```

`isBodyweight` ya existe en `trainingLoad.js` (equipo sin carga = peso
corporal). Si `canEffort` es falso, el selector no enseña la opción.

---

## 3. P46 — Fuera «submáx»: sus ejercicios pasan a Fija

Cambio de datos y borrado de ramas. Sin UI nueva.

### 3.1 Librería

Los 7 ejercicios con `progressionModel: 'submax'` (`exerciseLibrary.js`, ids
`push_up`, `jump_squat`, `rope_climb`, `mountain_climber`, `burpee`,
`jumping_lunge`, `band_pull_apart`) pasan a `progressionModel: 'fixed'`.
`LEGACY_REVERSE_MAP` gana `fixed: 'none'` y **conserva** `submax: 'none'`, así
lo que ya esté guardado con `'submax'` se lee como Fija sin migración.

Con `minReps: null` heredan `DEFAULT_TARGET` (8–12 reps). Es aceptable: la
revisión de cómo se miden estos ejercicios (tiempo, distancia) está apuntada
aparte y no entra aquí.

### 3.2 Código: cada rama `'submax'` desaparece

`grep -rn submax src` da la lista completa. A día de hoy:

| Fichero | Qué pasa |
|---|---|
| `components/editor/ExerciseEditorInline.jsx` | `initMode`: `type 'none'` → siempre `'fixed'`. Fuera `'submax'` de `PROG_MODES` (P47 mete `'effort'`), de `showRepsRange`, `rangeTxt`, `commitValues` (`progressionModel` de Fija = `'double_progression'`, como ya hace) y el `submaxHint` |
| `screens/CustomExerciseScreen.jsx` | Modos `['auto','fixed']`. Mismas ramas que el editor |
| `utils/prescription.js` | Fuera la rama `model === 'submax'` |
| `utils/sessionText.js` | Fuera la rama de `prescription()` |
| `screens/SessionEditorScreen.jsx` (`rowMeta`) | Sin min/max → `DEFAULT_TARGET`, no «submáx» |
| `screens/ProgramDetailScreen.jsx:60` | Fuera la rama |
| `components/stats/ProgressTab.jsx:92`, `utils/improvement.js:45` | Fuera: la métrica sale sola de si hay peso (`seriesMetric`) |
| `utils/sessionCompression.js:105` | Solo `time_progression` cuenta como de tiempo |
| `utils/stageRx.js:233` | Comentario |
| `progression.js` cabecera | Documentar `'fixed'` como valor de librería |

Locales (`es.json` y `en.json`, **editando por líneas, nunca con
`json.dump`**): fuera todas las claves `submax` (`workout.submax`,
`progModes.submax`, `progModeDesc.submax`, `summaryProg.submax`,
`progressionModels.submax`, `submaxHint`, `progression.submax_weight`,
`progression.submax_noweight`, `badges.submax` (~línea 1541) y el `submax`
de ~2370 —estas cuatro ya no las usa nadie: comprobado con grep el 29-sep). En la ayuda de
Progresión, «Submáxima: un porcentaje de tu máximo» se borra (P47 pone la
línea de Por esfuerzo).

Tests: `prescription.test.js`, `sessionText.test.js` y `useStore.test.js:1676`
usan `'submax'`: se reescriben al comportamiento nuevo (se lee como Fija).

### 3.3 Lo que salió al implementarla

- **Fallo arreglado de paso**: el alta de ejercicio propio guardaba Fija como
  `progressionModel: 'double_progression'`, así que el ejercicio nacía en
  Automática al añadirlo a una sesión. Ahora guarda `'fixed'`.
- `sessionText.sets_one/_other` solo servían a submáx: fuera también.
- `SessionEditorScreen` (`rowMeta`) sin reps cae a `DEFAULT_TARGET`. Sigue
  pintando «5–5» cuando min = max; P48 toca esa función igualmente.

**Probar P46**

- [x] Editor de un ejercicio: el selector de progresión enseña Automática y
  Fija, sin Submáx.
- [x] Añadir Burpee a una sesión: sale como Fija con 8–12 reps, en el editor, en
  la lista del editor de sesión, en Inicio y en el Workout.
- [x] Alta de ejercicio propio: la progresión ofrece Automática y Fija. Creado
  en Fija y añadido a una sesión, en el editor sale como Fija (antes salía
  Automática).
- [x] Un programa que ya tenía un ejercicio en Submáx lo enseña como Fija sin
  romper nada.

---

## 4. P47 — Motor y editor del modo Por esfuerzo

### 4.1 `oneRm.js`

`weightForReps(e1rm, reps, rpe)` de §2.2, con tests de ida y vuelta contra
`epley1RM` (los tres casos del ejemplo, `r === 1`, `r > 12`).

### 4.2 `progression.js` — `chipEffort`

`PROGRESSION_TYPES` gana `'effort'`. En `getProgression`, después del bloque de
descarga (que ya vale tal cual: mantener el peso) y antes de `time`:

```js
if (prog.type === 'effort') return chipEffort(prog, doneSets, def, minReps, t);
```

`chipEffort`:

| Caso | `type` | `suggestedWeight` | `why` |
|---|---|---|---|
| Ninguna serie con peso, reps y RPE válidos | `hold` | peso máx. de la última o `null` | `why_effortNoRpe` — «apunta el RPE de cada serie para ajustar el peso» |
| reps + recámara > 12 | `hold` | peso máx. de la última | `why_effortUnreliable` — «demasiadas reps para calcular el peso» |
| peso calculado > peso máx. de la última | `up` | calculado | `why_effortEasier` — «la última sesión salió más fácil de lo previsto» |
| < | `down` | calculado | `why_effortHarder` — «la última sesión salió más dura de lo previsto» |
| = | `hold` | calculado | `why_effortOnTarget` — «la última sesión salió según lo previsto» |

`msg` (solo se ve si no hay número): `progression.effort_noWeight` — «Apunta el
RPE de cada serie para calcular el peso». Los `why` no llevan números: así no
arrastran el problema de unidades de los mensajes con `{{kg}}`.

`summarizeSets` no cambia (Por esfuerzo cae en la rama de doble: «80kg · 5/5/5»).

Tests (`progression.test.js`): los cinco casos de la tabla, descarga, redondeo
con `weightStep` 2,5 y 1, `weightStep: 0` → 2,5, y un ejercicio con series de
pesos distintos (media de e1RM).

### 4.3 Editor (`ExerciseEditorInline.jsx`)

- **Selector de modo**: `['auto','fixed','effort']`, con `'effort'` solo si
  `canEffort` (§2.4). Etiqueta «Por esfuerzo». Descripción
  (`progModeDesc.effort`): «Pides reps y un RPE; la app calcula el peso de cada
  sesión con el 1RM estimado».
- **Paso 2 de la hoja en este modo**: un solo `StepField` horizontal «RPE
  objetivo» (reutiliza `maxRpeLabel`), 6-10, paso 1. Debajo, pista dinámica:
  «Dejar {{count}} en recámara» (con plural; RPE 10 → «Hasta el fallo»). Los
  pasos 2-4 de Automática no salen.
- **Al entrar en el modo**: `maxReps = minReps` (se queda el mínimo del rango
  que hubiera) y `trackRpe = true`.
- **Al cambiar la métrica a Tiempo** estando en Por esfuerzo: el modo vuelve a
  Automática (Por esfuerzo solo existe con reps).
- **VOLUMEN**: en este modo, en vez de la pareja Reps mín./máx., un
  `StepField` «Reps objetivo» (1-50) que escribe `minReps` y `maxReps` a la vez.
- **Aviso** (§2.3, `reps + 10 − targetRpe >= MAX_RELIABLE_REPS`): texto naranja
  debajo de Reps objetivo **y** debajo del RPE objetivo en la hoja (el RPE
  también mueve la cuenta y la hoja tapa VOLUMEN). Color: el mismo del aviso
  «fuera de rango» (`optRowWarn` de `EditorRows.jsx`). Texto
  (`exerciseEditor.effortUnreliable`): «A partir de 12 reps, contando las de
  recámara, el cálculo del peso deja de ser fiable». El 12 se interpola de
  `MAX_RELIABLE_REPS`.
- **Registrar RPE**: `ToggleRow` con `disabled` y `alwaysHint` mientras el modo
  sea Por esfuerzo; pista `exerciseEditor.trackRpeLocked`: «Necesario para la
  progresión por esfuerzo». `commitValues` guarda
  `trackRpe: s.progMode === 'effort' ? true : s.trackRpe`. Al salir del modo, el
  interruptor se queda como esté.
- **`commitValues`**: `progression.type = 'effort'` y `targetRpe`;
  `progressionModel: 'double_progression'`.
- **Resumen y fila**: `volumeLine` → «3 × 5 reps · RPE 8 · 120s descanso»;
  `progLine` (`summaryProg.effort`): «Peso calculado para RPE {{rpe}}, dejando
  {{rir}} en recámara»; `progRowSub`: «RPE 8 · 2 en recámara».
- `computeInitial` / `applyValues`: `progMode 'effort'` si
  `initProg.type === 'effort'`; nuevo estado `targetRpe`.

Ayuda de Progresión (`docs.sections` → `progression`): nueva línea «Por
esfuerzo: pides un RPE y la app calcula el peso con tu 1RM estimado».

`CustomExerciseScreen` **no** ofrece Por esfuerzo (§1.2.2).

### 4.4 Lo que salió al implementarla

- El paso 2 de la hoja se titula «Esfuerzo objetivo»; dentro, el `StepField`
  «RPE objetivo» y la pista «Dejar N en recámara» / «Hasta el fallo».
- `summaryProg.effort` quedó en «Peso calculado con el 1RM estimado para RPE
  {{rpe}}»: la recámara ya sale en la fila de Progresión («RPE 8 · Dejar 2 en
  recámara») y repetida en el resumen alargaba la línea.
- Si un ejercicio ya está en Por esfuerzo y deja de cumplir §2.4 (p. ej. se
  cambió el equipo de un ejercicio propio), la opción se sigue enseñando para
  no dejar el selector sin valor; el motor, sin peso, mantiene.
- QA: en la caja sola de «Reps objetivo» a todo el ancho, los ± se iban a las
  esquinas. `StepField` gana `tight` (solo Caja): ± pegados al número
  (`bb50b41`). El grid 2×2 no cambia.

**Probar P47**

- [x] Sentadilla con barra → Progresión → Por esfuerzo: sale «RPE objetivo» con
  «Dejar 2 en recámara», y en VOLUMEN un solo campo «Reps objetivo».
- [x] Al elegir Por esfuerzo, «Registrar RPE» se enciende solo, no se puede
  apagar y dice por qué. Al volver a Automática se puede apagar.
- [x] Reps objetivo 10 con RPE 8: aviso naranja bajo las reps y bajo el RPE en
  la hoja. 10 con RPE 9: sin aviso. 9 con RPE 7: aviso.
- [x] En Flexiones y en Dominadas asistidas no sale Por esfuerzo. En sentadilla,
  pasar la métrica a Tiempo lo devuelve a Automática.
- [x] El resumen del editor dice «3 × 5 reps · RPE 8 · …» y «Peso calculado con
  el 1RM estimado para RPE 8»; la fila de Progresión, «RPE 8 · Dejar 2 en
  recámara».
- [x] Alta de ejercicio propio: no ofrece Por esfuerzo.

---

## 5. P48 — El objetivo por esfuerzo en el Workout y las listas

### 5.1 La línea de objetivo (`prescription.js` → `targetLabel`)

Si `resolveProgressionConfig(exConfig, def).type === 'effort'`:

- Normal (Workout, `NextSessionScreen`):
  «3 × 5 reps · RPE 8 (2 en recámara)» (`workout.effortTarget`, con plural;
  RPE 10 → «RPE 10 (al fallo)»). Lleva los dos: el objetivo en recámara es lo
  fácil de entender, y el RPE es lo que el cliente tiene que apuntar en la
  columna, así que el objetivo le enseña la equivalencia.
- Compacto (Inicio): «3×5 @8».
- `sessionText.js` (compartir): «3x5 @RPE8». El peso ya lo pone `todayWeight`,
  que lee `chip.suggestedWeight` y funciona sin tocarlo.
- `SessionEditorScreen` (`rowMeta`) y `ProgramDetailScreen`: «3 × 5 @RPE 8».

### 5.2 El peso objetivo (`ExerciseCard.jsx`, ProgressionLine)

Misma anatomía que hoy (flecha + etiqueta + número + delta + `why`). Solo
cambia la etiqueta: en Por esfuerzo `progKey` es `'effortTo'` →
`workout.progression.effortTo` = **«Peso objetivo»**, sea cual sea la dirección
(el usuario pidió «peso objetivo»). La flecha y el delta siguen diciendo si
sube o baja. Descarga: se queda con su etiqueta de siempre.

Queda así:

```
3 × 5 reps · RPE 8 (2 en recámara)
↑ Peso objetivo  82,5 kg  (+2,5)
la última sesión salió más fácil de lo previsto
```

**Sin historial** (primera sesión): no hay chip, igual que en los otros modos.
La línea de objetivo ya dice cuánto dejar en recámara; el cliente elige el peso
y la sesión siguiente ya se calcula.

**Probar P48**

- [ ] Primera sesión de un ejercicio Por esfuerzo 3 × 5 @8: la tarjeta dice
  «3 × 5 reps · RPE 8 (2 en recámara)», sin peso objetivo, y la columna RPE
  está visible.
- [ ] Hacer 80 kg × 5 apuntando RPE 7 en las tres series. La sesión siguiente
  dice «↑ Peso objetivo 82,5 kg (+2,5)» y «la última sesión salió más fácil de
  lo previsto».
- [ ] Con RPE 9 en todas: «↓ Peso objetivo 77,5 kg». Con RPE 8: «→ Peso
  objetivo 80 kg», sin delta.
- [ ] Sesión hecha sin apuntar RPE: mantiene el peso y pide apuntar el RPE.
- [ ] En una etapa de descarga, el ejercicio Por esfuerzo dice Descarga y
  mantiene el peso.
- [ ] Inicio enseña «3×5 @8»; el editor de sesión, «3 × 5 @RPE 8»; compartir la
  sesión como texto, «3x5 @RPE8» con el peso calculado.

---

## 6. Fases

| Fase | Qué | Coste | Depende de | Hecho |
|---|---|---|---|---|
| P46 | Fuera «submáx» (§3) | 🟢 | — | ✅ — ver §3.3 |
| P47 | Motor + editor (§4) | 🟡 | P46 | ✅ — ver §4.4 |
| P48 | Workout y listas (§5) | 🟢 | P47 | |

## 7. Fuera de alcance (ideas apuntadas)

- Rampa de RPE por semanas en una regla de etapa (§1.3).
- Lastrados con peso corporal + lastre (§1.3).
- El redondeo es en kg: con libras, 82,5 kg sale como 181,9 lb. Es el mismo
  límite que ya tienen los incrementos de la progresión automática.
