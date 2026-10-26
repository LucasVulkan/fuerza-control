# Mutantes supervivientes: progression.js y progressionForm.js (I01-01 §3.1)

Fuentes: `mutation.json` (321 mutantes: 286 + 35), código y tests de `mobile/src/utils/`, specs `P12-progresion-clara.md` (P12) y `P10-effort-progression.md` (P10).
Los números de línea son los del código actual. «B1» y similares son etiquetas para agrupar mutantes que mata el mismo test.

## 1. Recuento por clase y fichero

| Clase | progression.js | progressionForm.js | Total |
|---|---:|---:|---:|
| a · equivalente | 47 | 6 | 53 |
| n · nulo | 28 | 2 | 30 |
| s · texto | 90 | 0 | 90 |
| b · hueco real | 58 | 26 | 84 |
| b? · la spec no lo fija | 63 | 1 | 64 |
| c · fallo | 0 | 0 | 0 |
| **Total** | **286** | **35** | **321** |

Dos bloques inflan el recuento:
- `summarizeSets` (líneas 647-673) no tiene NINGÚN test en todo el repo (solo lo usa `ClientsScreen.jsx:171`). Son 61 mutantes NOCOV: 16 en b y 45 en b?.
- Las variantes `short` y `parts` de `progressionRule` en Por esfuerzo, Reps y Tiempo son NOCOV, o no tienen test que las pida.

Sin `summarizeSets`, b = 42 + 26 = 68 y b? = 18 + 1 = 19.

**c = 0.** Comprobé estos candidatos y los descarté: `baja = … y peso > 0` (§4.2, el código lo cumple), `type:'weight'` con meta = `minReps` (§4.1, lo cumple), Reps/Tiempo desde la serie más floja (§4.4, lo cumple), `reach` (§4.4, lo cumple) y la media de tres sesiones (§6.5, la cumple). Ver las observaciones del final.

---

## 2. Tabla de b (ordenada por importancia)

Primero lo que cambia peso, reps o tipo sugerido. Después guardado/lectura del editor, y al final textos de la regla y `summarizeSets`.

Convenciones: `BB = {equipment:['barbell']}`. `cfg3 = {sets:3,minReps:8,maxReps:12,progression:{type:'double'}}`. `tk = (k,o)=>k+JSON.stringify(o)`.

### 2.1 progression.js, lo que cambia el chip

| # | Línea · mutante | Entrada | Esperado | Cita |
|---|---|---|---|---|
| 1 | **B1 «series ✓ sin datos»**<br>247:12 y 247:13 (`!!s.done` → `!s.done` / `s.done`)<br>245:24 ×2 (`reps>0` → `true` / `>=0`)<br>245:9 (`&&` → `\|\|`, y la condición entera → `true`)<br>498:43 ×3 (el filtro de `doneSets` pierde las series solo ✓) | `getProgression(cfg3, BB, [{weight:'60',reps:'',done:true}×3], tk)` | `type:'up'`, `suggestedWeight:62.5`. Con los mutantes de 247 y 245: `down` 57.5 (hitGoal = 0). Con 498: `null`.<br>Además: `[{weight:'60',reps:'',done:false}×3]` NO cuenta como alcanzada (no está marcada). | P12 §4.2: «alMeta = series con reps ≥ G (o marcadas sin reps)». También la doc de `countQualifyingSets`. |
| 1b | **B1-tiempo**<br>244:9 (`&&` → `\|\|`)<br>244:24 ×2 (`time>0` → `true` / `>=0`) | `getProgression({sets:3,minTime:30,maxTime:60,inputType:'weight_time',progression:{type:'double'}}, BB, [{weight:'5',done:true}×3], tk)` | `up`, 7.5. Los mutantes dan `down` 2.5. | P12 §4.2 y §8.2 (mismo `verdict` en segundos). |
| 2 | 509:21 ×2 (`exConfig?.sets ?? def?.sets ?? doneSets.length` → `&&`). El `n` pasa a ser las series apuntadas y no las de la plantilla. Los tests solo usan sesiones completas, así que `n` coincide por casualidad. | `cfg(5)` (5 series de plantilla) con `[12,12,12,12]` a 60 kg, 4 series apuntadas | `hold` (4 < 5). El mutante da `up` 62.5. | P12 §4.2: «n = series de la plantilla»; §4.3: «con la n de la sesión». |
| 3 | 455:7 (`v.up && assistance === 0` → `v.up \|\| assistance === 0`) | Asistido (`{progressionDirection:'decrease',weightStep:2.5}`), `cfg3`, series `weight:'0'` con reps `[7,7,7]` | `type:'down'`, `suggestedWeight:2.5` (más ayuda). El mutante da `up` con 0 sin cumplir la meta. | P12 §4.2: «sube = todas a la meta». `chipDoubleDecrease` es «su espejo con la misma lógica». |
| 4 | 280:34 (`rpe > maxRpe` → `>=`) | `cfg3` con `evaluation:{mode:'rpe',maxRpe:8}`, 3×12 con `rpe:'8'` | `up` (RPE medio 8 ≤ 8). El mutante da `hold`. | P12 §4.2: «RPE medio ≤ maxRpe». |
| 5 | 321:34 (`x >= start` → `x > start`), Tiempo | `{sets:3,minTime:30,maxTime:30,inputType:'time',progression:{type:'time'}}`, tiempos `30,30,30` | `up`, `suggestedTime:35`, `from:30`. El mutante da `hold` 30. En Reps el límite sí está testeado (`[7,6,6]` con mín. 6). | P12 §4.4: «con las series ≥ inicio». |
| 6 | 252:16 y 252:69 (`true`) (quitar el `.filter(v>0)` de `avgRpe`). El `NaN` de las series sin RPE envenena la media y la puerta de RPE no se aplica. | `cfg3` con `mode:'rpe', maxRpe:8`, 3×12 con `rpe:['9','','']` | `hold` con `why:'progression.why_rpeAbove{"maxRpe":8}'` (media de las que tienen RPE = 9). El mutante da `up`.<br>Ojo: la spec solo fija «sin RPE apuntado» = ninguna serie (testeado). El caso parcial es lectura natural de «RPE medio», pero si quieres confirmarlo, pregúntalo. | P12 §4.2: «sin RPE apuntado o RPE medio ≤ maxRpe». |
| 6b | 252:69 (`v >= 0`) | Mismo, con `rpe:['0','9','9']` | La media ignora el 0 (si el RPE 0 puede existir). Muy bajo. | Igual. |
| 7 | 174:34 (`direction === 'increase'` → `true`) | `resolveProgressionConfig({}, LIB.pistol_squat_assisted)` (o `muscle_up_assisted`): asistidas con `weightStep:0` y equipo `[]` | `type:'double'`, `direction:'decrease'`. El mutante da `reps`. Los tests solo usan `pull_up_assisted` (`weightStep` 2.5), que no pasa por esa rama. | P12 §5.3-bis: «(los asistidos no cambian)». |
| 8 | 88:23 y 89:23 (`fixed:'none'` / `submax:'none'` → `""`) | `resolveProgressionConfig({}, {progressionModel:'fixed'})` y lo mismo con `'submax'`; y `getProgression` con esas | `type:'none'` y chip `null`. El mutante da `""`, o sea un chip de Peso en una Fija (p. ej. `push_up`, `burpee`). | P10 §3.1: «LEGACY_REVERSE_MAP gana `fixed:'none'` y conserva `submax:'none'`». |
| 9 | 462:186 ×3 (`assistance \|\| null` → `true` / `false` / `&&`) | Asistido, `cfg3`, 20 kg, reps `[12,10,9]` | `hold`, `suggestedWeight:20`. El mutante da `true`, `false` o `null`, y la tarjeta pinta la frase larga. La versión no asistida (60) sí está testeada (`P54 Todas`). | P12 §4.2 (espejo con la misma lógica) y §3.1.4 (mantener = lo de la última vez). |
| 10 | 192:77 (`d.weightStep === 'exact'` → `true`) | `resolveProgressionConfig({}, {weightStep:5, progression:{type:'effort'}})` | `exact:false`. El mutante da `true` y pasa a proponer pesos sin redondear. El test solo prueba `'exact'`. | P12 §5.4-bis: «Exacto: se guarda `weightStep:'exact'`»; §12.2 (`def.progression` como valor por defecto). |
| 11 | 436:13 (`effort:true` → `false`) en el chip principal de Por esfuerzo; 401:13 en `keep` | `getProgression(cfgEffort, lib, at('7'), tk)` y `at('')` → `chip.effort === true` | Con `false`, la tarjeta cambia «Peso objetivo» (`effortTo`) por «Subir a» y `planSet` deja de usar `minReps` (`setPlan.js:41`). Los tests usan `toMatchObject` sin `effort`. | P12 §4.5 («chip.effort → peso = suggestedWeight; reps = minReps»); P10 §5.2. |
| 12 | 74:32 y 76-80 (`LEGACY_TYPE_MAP`: `{}` y los valores `weight`, `reps`, `time`, `effort`, `none`). Lo usan `CustomExerciseScreen.jsx:195` y `onboardingBuilder.js:80`. | `expect(LEGACY_TYPE_MAP).toEqual({double:'double_progression',weight:'double_progression',reps:'double_progression',time:'time_progression',effort:'double_progression',none:'fixed'})` | El mutante pone `""` o `'double_progression'` en `progressionModel`: una plancha propia deja de ser de tiempo y una Fija nace en Auto. | P10 §2.1 («LEGACY_TYPE_MAP.effort = double_progression»), P10 §3.3 (Fija = `'fixed'`), P12 §12.2. |
| 13 | 283:14 (`reached && rpeOver` → `\|\|`) | `cfg3` con `mode:'rpe',maxRpe:8`, `[12,10,9]` con `rpe:'10'` | `hold` con `why:'progression.why_holdReps{}'`. El mutante dice `why_rpeAbove` sin haber llegado a la meta. | P12 §4.2: `why_rpeAbove` = «llegó a la meta pero con RPE medio > maxRpe». |

### 2.2 progression.js, texto de la regla (`progressionRule`) que usa datos equivocados

| # | Línea · mutante | Entrada | Esperado | Cita |
|---|---|---|---|---|
| 14 | 579:19 ×2 (`exConfig?.maxReps ?? def?.maxReps` → `&&`). Los tests usan maxReps 12, igual que `DEFAULT_TARGET`, así que coincide por casualidad. | `progressionRule({sets:3,minReps:6,maxReps:10,progression:{type:'double'}}, BB, tk)` | Meta 10: `...whenAll","goal":10}`. El mutante da 12. | P12 §5.2: «Sube 2.5 kg cuando todas las series lleguen a 12» (12 = el `maxReps`). |
| 15 | 582:19 ×2 (`exConfig?.sets ?? def?.sets ?? 3` → `&&`). Pasa lo mismo con `sets:3`. | `progressionRule({sets:5,...,progression:{type:'double'}}, BB, tk)` | `weightDown{"fails":3,"n":5}`. El mutante da `{"fails":2,"n":3}`. | P12 §5.2 / §4.3 (⌊n·0,4⌋+1 de n). |
| 16 | 618:18 y 618:50 (`legacy = type === 'weight'` → `false` / `""`) | `progressionRule({sets:3,minReps:4,maxReps:6,progression:{type:'weight'}}, BB, tk)` y la versión con tiempo | `goal` 4 (el mínimo). El mutante da 6. El chip sí está testeado (`rows([4,4,4])` sube), la frase no. | P12 §4.1 («type 'weight' → double con meta = minReps»); §8.4 («la meta es el mínimo de tiempo»). |

### 2.3 progressionForm.js (`ctx = {def:BB, sets:3, metric:'reps', range:true}`)

| # | Línea · mutante | Entrada | Esperado | Cita |
|---|---|---|---|---|
| 17 | **initProgForm up/how/down**<br>103:15, 103:26, 103:35 (NOCOV): Nada<br>103:45, 103:56: Reps<br>104:15 ×3, 104:26, 104:37: Por esfuerzo<br>111:15, 111:26, 111:36 (NOCOV): Nunca | `initProgForm` con progresión guardada `{type:'none'}`, `{type:'reps'}`, `{type:'effort'}` (con `range:false`) y `{type:'double',down:'never'}`. Los tests solo prueban el viaje de ida y vuelta con `double` + `fail`. | Se abren como `up:'none'`, `up:'reps'`, `how:'effort'` y `down:'never'`. Con los mutantes, Nada se abre como Peso, Reps como Peso, Por esfuerzo como Por reglas y Nunca como «si fallan N». Al guardar sin tocar, el ejercicio cambia de tipo o empieza a bajar el peso. | P12 §5.5, y casilla P12-04 «Guardar, salir y volver a entrar: la hoja recupera todo lo elegido». |
| 18 | 75:7 ×3, 75:16, 75:38 (`if (n.up !== 'weight') n.incType = 'fixed'`) | a) `init({progression:{type:'double',increment:{type:'pct',pct:5}}}).incType`<br>b) `normalizeProgForm({...init(),up:'reps',incType:'pct'}, ctx())` | a) `'pct'`; b) `'fixed'`. Los mutantes fuerzan siempre `fixed` (pierden el % en Peso) o no lo fuerzan en Reps/Tiempo (queda `''` o `pct`). | P12 §5.3: «Cuánto sube: Peso: Fijo · Porcentaje… Reps: entero. Tiempo: entero en pasos de 5 s»; §4.4. |
| 19 | 92:7 (`next.step ?? libraryStep(...)` → `&&`) | `patchProgForm({...init(),up:'reps',step:1.25},{up:'weight'},ctx())` | `incValue:1.25` (el escalón del ejercicio). El mutante pasa el de la librería. | P12 §4.1 («salto por defecto de Peso = escalón resuelto»), §3.1.12 («el escalón es por ejercicio»). |
| 20 | 92:41 (`libraryStep(ctx.def, false)` → `true`) | `ctx({def:{...BB,weightStep:5}})`, `step:null`, cambiar a Peso | `incValue:5`. El mutante pone 2,5 (el tope solo vale en Por esfuerzo). | P12 §4.4 (el tope 2,5 es solo de Por esfuerzo). |
| 21 | 29:18, 29:27 (`false`), 29:57 (`isAssist`) | `showHow({up:'weight'}, {def:{equipment:['machine'],progressionDirection:'decrease'}, metric:'reps'})` | `false`. El mutante ofrece Por esfuerzo a una asistida con máquina. Las 4 asistidas de la librería son de peso corporal y `isBodyweight` ya lo tapa, por eso el test no lo ve. | P12 §5.3, tabla: «Cómo… carga externa, no asistido»; P10 §2.4. |
| 22 | 77:7 (`n.when === 'part'` → `true`) | `normalizeProgForm({...init(),when:'rpe'}, ctx({sets:1})).when` | `'rpe'`. El mutante lo cambia a `all_complete`. Solo Parcial necesita ≥ 2 series. | P12 §5.3: «Parcial: de 1 a M−1»; comentario del código. |
| 23 | 77:28 (`ctx.sets < 2` → `<= 2`) | `normalizeProgForm({...init(),when:'part'}, ctx({sets:2}))` | `when:'part'`, `need:1` (1 de 2 es válido). El test solo prueba `sets:1`. | P12 §5.3: «de 1 a M−1» (M=2 → 1). |
| 24 | 134:7 (`if (effort)` → `true`) en `buildProgression` | `buildProgression(init(press), ctx).progression` | Sin las claves `targetRpe`/`effortWhen` en Peso por reglas. | P12 §5.5: «`targetRpe` + `effortWhen` en Por esfuerzo». Importancia baja (datos sucios). |

### 2.4 summarizeSets, 16 mutantes NOCOV (la función entera sin tests)

Mutantes: 652 (formato por defecto), 669-671 (rama de Peso/Reps/Por esfuerzo). Entrada y esperado:

- `summarizeSets({}, BB, [{weight:'80',reps:'5'},{weight:'80',reps:'5'},{weight:'80',reps:'5'}])` → `'80kg · 5/5/5'`.
- Firma antigua: `summarizeSets(def, done, fmt)`, igual que `ClientsScreen.jsx:171`.

Cita: P10 §4.2, «Por esfuerzo cae en la rama de doble: «80kg · 5/5/5»».
El resto de ramas (tiempo, Nada, vacío) son b?: ver §3.

---

## 3. b? (la spec no fija el resultado) y c

**c: ninguno.**

### b? con detalle

| Líneas | Qué pasa | Qué preguntar |
|---|---|---|
| 317:17, 317:76 ×2, 318:7 (4). `chipTime` devuelve `null` si ninguna serie tiene tiempo; los mutantes devuelven un `hold` con el inicio. | Entrada: Tiempo, series `[{done:true}×3]` sin `time` → hoy `null`. `chipReps` en el mismo caso no devuelve `null`, devuelve `hold`/`up` según `done`. | ¿Tiempo sin ningún tiempo apuntado: sin chip (hoy) o «mantener en el inicio» como Reps? La spec dice solo «el chip trae siempre la meta» (§4.4). |
| 498:20, 498:43 (`true`), 499:7 (3). | `lastSets = [{weight:'',reps:'',done:false}]` (filas en blanco) → hoy `null` («primera vez»). El mutante da un `hold` sin número. | ¿Una sesión anterior con todas las series en blanco cuenta como historial? P12 §6.3 habla de «sin historial». |
| 165:63 (1). Dirección por defecto `'increase'`. | `resolveProgressionConfig({}, {equipment:[], weightStep:0})` sin `progressionDirection` → hoy `direction:'increase'` y `type:'reps'`. Con el mutante, `""` y `double`. La librería siempre trae la dirección. | ¿Un `def` sin dirección es `increase`? (P12 §5.3-bis lo da por hecho, sin decirlo). |
| 168:97 (1, NOCOV). | `progressionModel` desconocido (`'foo'`) → hoy `type:'double'`. El mutante da `""`. | ¿Qué es un modelo desconocido? Hoy cae en Doble. |
| 380:57 `s.done && s.weight` (1). `loggedSets` de las sesiones anteriores (`earlier`) | Una serie con peso, reps y RPE pero sin ✓ cuenta en la sesión de hoy (`doneSets`) y en `earlier`. El mutante la quita de `earlier`. Entrada: `earlier:[[{weight:'60',reps:'5',rpe:'8'}×3]]` sin `done`. | ¿Las series sin ✓ cuentan para el 1RM de sesiones anteriores? (El log quizá guarda solo las hechas.) |
| 458:17 ×2 (`assistance < 999`). | El tope 999 no está en la spec. Con `assistance:999` el original no sube la ayuda. | ¿Existe un tope de ayuda? Si no, se puede borrar. |
| 585:9, 587:9 (2). Variantes `short` y `parts` de Por esfuerzo. | NOCOV. Hoy `short` → `effortShort{reps,rpe}`; `parts` → `{action: effortAction, when: effortWhenBeat/Reach}`. | La spec (P12 §12.1) dice que `short` se usa en la ficha, pero no fija el texto de Por esfuerzo. |
| 607:9 (1). `short` en Reps y Tiempo. | NOCOV. Hoy `weakestShort{inc}`. | Igual: P12 §5.2 solo da la frase larga. |
| 605:19, 605:32, 605:40 (3). `inc.type === 'pct'` en Reps/Tiempo, texto «N %». | El editor no ofrece % en Reps/Tiempo (`incType` forzado a `fixed`), pero el motor sí lo calcula (P12 §4.4) y la regla lo pinta. | ¿Debe la regla decir «+20 %» para un dato antiguo en Reps? |
| progressionForm 115:15 `>= 0` (1). | `initProgForm({weightStep:0}).step` hoy `null`. El mutante da 0. | Está en la misma línea que P12 §4.1 («Ausente → def.weightStep si > 0»), aunque no habla del 0 en el editor. |
| summarizeSets, ramas tiempo / Nada / vacío (45). | Formatos `'45/45/40s'`, `'N reps · kg'`, `'N reps tot.'`, `'—'`. | P10 solo fija el formato de la rama de Peso. Habría que preguntar si esos formatos son los buscados antes de fijarlos. |

---

## 4. a, n y s (lista compacta)

### a · equivalente (53)

| Línea | Motivo |
|---|---|
| progression 60 (6), 61:36, 62 (3) | `PROGRESSION_TYPES` e `INCREMENT_TYPES` no las importa nadie (grep vacío). En `EVALUATION_MODES`, `'all_complete'` ausente da el mismo resultado: cae al valor por defecto `all_complete`. |
| 101:19 (5) | Rama de `defaultIncrement` muerta: los dos llamadores (`resolveProgressionConfig` y `patchProgForm`) pasan siempre un número. |
| 122:97 | `'weight_reps'` → `""`: ambos dan «no es tiempo». |
| 168:72 | `?? 'double_progression'` → `""`: el `?? 'double'` posterior da lo mismo. |
| 196:15 | `inc.steps?.[0]?.value` sin `steps` da `undefined`, igual que el original. |
| 244:9 ×2, 245:9 ×2 | `minTime>0` → `true` / `>=0`, `minReps>0` → `true` / `>=0`. Solo cambian con una serie que tenga reps Y tiempo en una medida pura, que la UI no genera. |
| 280:19 | `rpe != null` → `true`: `null > maxRpe` es `false`. |
| 293:42, 353:70, 444:84, 398:67, 398:84 | Valores por defecto duplicados: `getProgression` siempre pasa `timed` y `{earlier, lastDeload}`. |
| 294:10 | `mode === 'part'` → `true` en `whyUp`: con Todas o RPE, `up` ya exige `hitGoal >= n`, así que `hitGoal < n` nunca se da. |
| 337:71 ×2 | `r>0` → `true` / `r>=0`: con `start ≥ 1` el `r >= start` ya excluye 0. |
| 380:30, 380:57 ×3 | `loggedSets`: las series sin peso no dan 1RM (`e1rmAtLeast` devuelve `null`), así que filtrar o no filtrar da lo mismo. |
| 401:39, 427:39, 437 (4), 453:32, 456:32, 460:34, 462:32, 519:45 (11) | Icono `'⬆'`/`'⬇'`/`'→'`: `chip.icon` no lo lee nadie (grep sin consumidores). |
| 455:15 | `assistance === 0` → `true`: lo que queda tras la rama `> 0` ya es 0. |
| progressionForm 33:71 | `libraryStep`: el tipo `""` solo cambia el tope de Por esfuerzo, y `step` sale igual. |
| progressionForm 74:7 | `how` solo vale `'rules'` o `'effort'`. |
| progressionForm 91:38, 91:50, 91:61 | `defaultIncrement` solo distingue `reps`/`time`, así que `'weight'` y `'double'` son lo mismo. |
| progressionForm 142:12 | `f.step != null` → `true`: con `null`, `null !== 2.5` da `weightStep = null`, igual que el valor inicial. |

### n · nulo (30)

| Línea | Motivo |
|---|---|
| progression 120:17, 122:10 | `exConfig?.` → `.` en `isTimed`. |
| 196:40 ×2 | `inc.steps?.` / `?.value` sin `steps`. |
| 380:39 | `sets ?? []` con `sets` nulo. |
| 477:37 | `recent ?? []` con `recent` nulo. |
| 496:7, 496:8 | `lastSets` nulo. |
| 505, 506 (4), 507:21, 508:21, 509:21 (`.`), 509:43 | `?.` sobre `exConfig`/`def` en los parámetros efectivos. 509:43: el *fallback* `def.sets` ni se ejercita; si interesa, un test con `exConfig` sin `sets` y `def.sets:4`. |
| 543:17 | `exConfig?.progression`. |
| 578:19, 578:40, 579:19/40 (OC), 580 (2), 581 (2), 582:19/37 (OC), 618:18 (OC) | Lo mismo en `progressionRule`. |
| progressionForm 29:27 (OC), 115:15 (OC) | `def?.` / `exConfig?.`. |

### s · texto (90), agrupados por función

El stub `t = () => ''` (o `tk`, que no mira estas claves) no ve el literal ni sus parámetros `{}`.

| Función · líneas | Qué es |
|---|---|
| `chipTime` 325 (5), 331 (5) | `time_allHitMax`, `why_timeAllHit`, `time_keep`, `why_timeHold` + parámetros. |
| `chipReps` 341 (4), 344 (4) | `reps_advance`, `why_repsUp`, `reps_hold`, `why_repsHold` + parámetros. |
| `chipDouble` 355 (7), 360 (3), 364 (3), 366 (4) | `withWeight`/`sameWeight` (el condicional `maxW>0` solo cambia el texto), `normal_allHit`, `normal_struggling${sfx}`, `normal_hold`, `why_hold${Reps}`. |
| `chipEffort` 401:51, 428:14, 438:12 | `effort_noWeight`. |
| `chipDoubleDecrease` 446 (7), 448 (2), 450 (3), 451 (2), 452 (2), 456:44, 460 (5), 462 (5) | `withAssist`/`noAssist`, `decrease_lastAssist` / `_allHit` / `_free` / `_struggling` / `_hold`, `why_belowMin${Time}`. El condicional `assistance>0` y `next===0` solo eligen entre dos frases, y `msg` no se pinta cuando hay número (`suggestedWeight:0` cuenta como número). |
| `getProgression` deload 517 (7), 520 (2) | `withWeight`/`sameWeight`, `deload_hold`, `why_deload`. |
| `progressionRule` 599:39, 585-589 (7, NOCOV), 606:66, 607:25/58, 609 (2), 610:25, 630:24, 633:20 (8) | Claves y parámetros de las variantes `short`/`parts` de la regla. |

---

## 5. Observaciones fuera de la clasificación

1. **Series no hechas cuentan como fallo.** `verdict` calcula `down` como `n − hitFloor ≥ fails` con `n` = series de la plantilla (§4.2: «n = series de la plantilla»). Si un cliente hace 2 de 5 series al mínimo, el motor puede decir `down`. Es lo que dice la spec literal, no un fallo. Antes de blindarlo con un test (mutantes 509:21 ×2), conviene confirmar que es lo deseado.
2. **Incoherencia entre `chipTime` y `chipReps`** con series solo ✓: `chipTime` devuelve `null`, `chipReps` devuelve un chip (ver b? de 317/318).
3. Los tests de `progression.test.js` fijan casi siempre `sets:3` y `maxReps:12`, que coinciden con los valores por defecto del propio código. Por eso sobreviven los `&&` de 509, 579 y 582. Un solo test con `sets:5` y `maxReps:10` mata seis mutantes.
4. Ningún test de `mobile/src/utils/` ejercita estas líneas NOCOV significativas: `summarizeSets` entera, `decrease_lastAssist` (451), la variante `short`/`parts` de Por esfuerzo (585-589) y Reps/Tiempo (607-610), `weightAction`/`assistAction` (630-633) y `initProgForm` con `none` y con `never` (103:35, 111:36).
