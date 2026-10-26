# Arqueología del historial: revisión de los 45 casos (I01-01 §3.2)

Revisado con `git show <sha>` (mensaje, diff del test y del fuente) y las specs. Las specs se renombraron después de los commits; cito el nombre actual (p. ej. `weeks-model.md` es hoy `P08-weeks-model.md`, `program-templates.md` es `P04`, `progresion-clara.md` es `P12`, `effort-progression.md` es `P10`, `trainer-logging.md` es `C05`, `stage-locks.md` es `C03`, `conditioning-blocks.md` es `T01`, `cabeceras.md` es `U03`, `pulido-ui.md` es `U09`, `home-sesiones-plegables.md` es `U04`, `stage-planner.md` es `P06`, `exercise-variants.md` es `P09`, `program-model.md` es `P03`, `free-sessions.md` es `T06`).

**Recuento: A = 34 · B = 6 · C = 5** (los C son de gravedad baja salvo uno, el de `bee36e2`). Ningún caso es un valor cambiado sin razón en la spec o el commit; los C son aserciones debilitadas o perdidas.

A = cambio de comportamiento pedido por la spec o por una decisión citada · B = solo forma · C = sospechoso (valor sin razón, o aserción debilitada o perdida).

## Tabla

| # | Fichero (`*.test.js` en `mobile/src/utils/`) | sha | fecha | Clase | Qué cambió | Spec / razón |
|---|---|---|---|---|---|---|
| 1 | adherence | 4967dc6 | 2026-09-25 | B | `sessionsPerCycle` pasa a `perWeek` en las llamadas; mismos valores esperados | P08 §4.3 «`sessionsPerCycle` pasa a llamarse `perWeek`» |
| 2 | backupPayload | 93ee875 | 2026-09-26 | A | `freeSessionPresets` ya no viaja (de `[{...}]` a `undefined`) | T06 §4.5 «Migración de `freeSessionPresets`»: la sesión libre es un `sessionTemplate` sin programa |
| 3 | backupPayload | a851a3c | 2026-09-02 | A | versión del fichero 3 a 4 | P03 (línea «Con v4 lo rechaza con "Versión 4 no compatible"»); el mensaje explica por qué se sube |
| 4 | backupPayload | 1f14327 | 2026-09-02 | A | versión 2 a 3 | P03 §3.2 (validador `['1','2','3']`), Fase 1 owner + kind |
| 5 | clientLogs | 1f14327 | 2026-09-02 | B | `splitClientLogEntries` pierde el parámetro `clients` (3 a 2 args) | Refactor de firma, P03 Fase 1; el resultado esperado no cambia |
| 6 | conditioningBlocks | 9286632 | 2026-09-28 | A | EMOM «rotar»: `rounds` = nº de intervalos (15 a 8, 900 s a 300 s, etc.) | T01 §3 «rounds … corregido en sep-2026 SIN migración (decisión del usuario)»; casilla T01-04 «EMOM rotar, 4 movimientos, 8 rondas: dura 8 × intervalo» |
| 7 | freePlan | 93256d6 | 2026-10-24 | A | una elección que no cabe deja de «no valer»: sigue el prefijo que cabe (`needsClientChoice` true a false) | I02 R-E4 «la elección persiste … se congela solo el nuevo» (24-oct) |
| 8 | names | cd007fc | 2026-09-09 | A | `NAME_MAX` 20 a 25; el ejemplo de `copyName` se cambia por entradas que sí truncan | U03 §7 «`NAME_MAX = 25`» |
| 9 | onboardingFlow | b5e9c39 | 2026-10-14 | A | `builderExit`/`skipTarget` desde la app exigen `programId`; nuevo `coachedExit` | O03 §25.4.2 y §25.4.3 (O03-11) |
| 10 | onboardingPreview | 3ed4070 | 2026-10-15 | A | cliente «le apuntas tú»: `['clients','templates','next','log']` a `[..,'log','text']` | O03 (Aprende): «ajustar la próxima sesión no le sirve, la apunta él», texto añadido en el mismo commit |
| 11 | prescription | 66a5719 | 2026-10-02 | A (+B) | `3 × 30–45 s` a `3 × 30+ s` con progresión Tiempo; `{}` a `BB` en los demás (fixture, mismos valores) | P12 §6.3 «Con progresión Reps o Tiempo y sin `today`, el inicio con «+» («3 × 30+ s»)» |
| 12 | prescription | 12f58cb | 2026-09-29 | A | fuera «submáx»: `3 × submáx` a `3 × 8–12 reps` | P10 §3 (P46) «Fuera submáx: sus ejercicios pasan a Fija» |
| 13 | prescription | 989e780 | 2026-09-29 | A | `isUnilateral` se lee del ejercicio, no de la sesión (`exConfig.isUnilateral` ya no cuenta) | P09 §6.4 «`exConfig.isUnilateral` desaparece»; el test lo dice en el comentario |
| 14 | prescription | 2b31670 | 2026-09-26 | **C (leve)** | `submáx` a `8–12 reps / 20–40 s` (A) **y se borra** `targetLabel({}, {sets:2, minReps:10})` → `2 × 10 reps` sin reemplazo | T06 (nota del commit): lo que falta sale de `DEFAULT_TARGET`. Ver detalle C1 |
| 15 | progression | b41b355 | 2026-10-02 | B | se añade `noRpe: true/false` al `toMatchObject` (más estricto) | Refinamiento del chip, P56 |
| 16 | progression | bf919ee | 2026-10-02 | A | fuera `canAddWeight`; sin `progression` guardada manda la librería, con Peso elegido se respeta | P12 §5.3-bis «Corregido en QA: todo ejercicio se puede lastrar» |
| 17 | progression | 400d1de | 2026-10-02 | B | `{}` a `BB` en ~25 `getProgression(...)`, mismos valores | Mensaje: «Los tests que pasaban un def vacío para Peso usan un ejercicio con carga» |
| 18 | progression | 6cfa324 | 2026-10-02 | A | Por esfuerzo con escalón 5: `80` a `82.5` | P12 §4.4 / §4.6.3 «Revertido en QA P54.3: como mucho 2,5» (revierte el 82.5 a 80 del #20, misma hora) |
| 19 | progression | 4df386a | 2026-10-02 | A | `why_partHit{need,n,goal}` a `{hit,n,goal}` (el valor en los ejemplos no cambia, 2) | P12 casilla QA P52 «2 de 3 series llegaron a 12». Nota: P12 §4.2 sigue diciendo `{{need}}` (spec desactualizada) |
| 20 | progression | 2fc2f19 | 2026-10-02 | A | RPE 10 en Doble: `down` a `hold`; Por esfuerzo escalón 5: `82.5` a `80` (luego revertido en #18); `why_partHit` | P12 §4.2 «Desaparece la bajada escondida por RPE > 9,5», §4.6.1; §4.4 «redondea al step resuelto» (en aquel momento) |
| 21 | progressionForm | d77ffd3 | 2026-10-02 | A | Tiempo ofrece `['time','weight','none']`; plancha como Doble se abre como Peso | P12 §8.2 «Tiempo + Peso (doble en segundos)», decidido en ae64383 antes |
| 22 | progressionForm | bf919ee | 2026-10-02 | A | `upOptions` de dominada supina: `['reps','none']` a `['weight','reps','none']` | P12 §5.3-bis (mismo QA que #16) |
| 23 | sessionCompression | 5ac7a79 | 2026-09-01 | **C (leve)** | `includesWarmup(45)` false a true (A) **y** `toHaveLength(4)` a `toBeLessThan(MIXED.length)` (aserción más laxa) | P04 «Regla 1 — por debajo de 45 min»; el mensaje justifica soltar el nº exacto. Ver C2 |
| 24 | sessionCompression | 1ee99a1 | 2026-08-29 | A | suelo de accesorios 2 a 1 (`>=2` a `>=1`) | P04 «El suelo de sesión bajó de 2 accesorios a 1 (ago 2026)» |
| 25 | sessionCompression | bcd8b43 | 2026-08-28 | A | `overTime` true a false (transición 3 a 2 min) | P04 «Regla −1 … (decisión del usuario)» |
| 26 | sessionCompression | e457d11 | 2026-08-09 | A | fixtures 4 a 5 series para seguir dando el mismo comportamiento con la tolerancia | P04 «Regla 0 — el presupuesto tiene tolerancia» (`TIME_TOLERANCE 0,15`); nuevos tests de tolerancia |
| 27 | sessionPlan | 5dfc125 | 2026-10-06 | B | `weekly: true` a `order: 'weekly'`; añade tests de `order: 'free'` | U13 §8.1 y §9 (U13-06) |
| 28 | sessionPlan | bf91f58 | 2026-10-01 | **C (leve)** | la sesión a medias ya no es el hero (A) **pero** `toBe('a')` a `not.toBe('a')` | U09 §16 (U52) «El hero vuelve a ser la que toca». Ver C3 |
| 29 | sessionPlan | 3fecd69 | 2026-09-25 | A | contador `weekCount` total 4 a 3 (fuera `daysPerWeek`) | P08 §0.4 «Las sesiones de una etapa SON los entrenos que se esperan cada semana. Punto.» |
| 30 | sessionPlan | 4967dc6 | 2026-09-25 | A | el hero pasa de «primera sin hacer del ciclo» a «la de última vez más antigua»; `cycleCount` a `weekCount` | P08 §3.5 y §3.6 |
| 31 | sessionPlan | f2f79f0 | 2026-09-08 | A | `rows` incluye la sesión hero (`['a','c']` a `['a','b','c']`) | U04 §4.4 «`sessionPlan()` deja de sacar el hero de la lista» |
| 32 | sessionText | 12f58cb | 2026-09-29 | A | burpee `3 series` a `3x8-12` | P10 §3 (fuera submáx) |
| 33 | sessionText | 615ba31 | 2026-09-28 | A | `100 100 95x5` de `[[100,12],[100,12],[95,5]]` a 5 reps en todas | C05 (tabla de lectura) «pegadas o no (QA 28-sep: es lo natural)»; la spec se cambia en el mismo commit |
| 34 | sessionText | f11d3ba | 2026-09-28 | A | `parseRx('3x8-12')` de `reps:null` a `reps:8`; `ok` con rango vale el de abajo | C05 «Con un rango vale el de abajo … (QA 28-sep)» |
| 35 | stageProgress | 9aef98a | 2026-09-25 | **C (leve)** | `progressFromBlob` (null si blob ajeno) a `athleteProgress` | P08 §3.7. Ver C4 |
| 36 | stageProgress | 6d16c83 | 2026-09-25 | A | el progreso pasa de ciclos a semanas (5 campos nuevos), `advanceCycle` y `stageAdvancePending` fuera | P08 §5 y §6 (P37) |
| 37 | stageProgress | 8d9af4d | 2026-09-02 | A | `p.days` ya no se espeja (`not.toHaveProperty('days')`) | P03 Fase 3 «muere el espejo `program.days`» |
| 38 | stageProgress | bee36e2 | 2026-07-31 | **C (media)** | `lastImportedStage` a sello `lastActivation` (A) **y se borra** «activar la etapa donde el cliente YA está no le borra las semanas» | C03 §9.1 y §9.2 para el sello; el test borrado lo exigía C03 §9 («Activar la etapa en la que el cliente ya está le borraba las semanas»). Ver C5 |
| 39 | stageProgress.weeks | 3fecd69 | 2026-09-25 | A | `stageDaysPerWeek` a `weeklySessions`; `daysPerWeek` suelto ignorado | P08 §0.4 (corrección del 25-sep) |
| 40 | stageProgress.weeks | 6d16c83 | 2026-09-25 | A | `fromLegacyProgress` detecta lo viejo por sus campos (la entrada del test cambia a propósito) | Mensaje del commit + P08 §5.4 |
| 41 | stageRx | 2fc2f19 | 2026-10-02 | A | `scaleIncrement` redondea al `step` y no baja de él (`5 a 2.5` pasa a `5`); no escribe `step` ni `direction` | P12 §4.1: «`stageRx.scaleIncrement` … pasa a redondear al `step` resuelto» |
| 42 | stageRx | a6752ec | 2026-09-11 | A | `buildRungs(id,n,withDeload)` a `buildRungs(id)` (2 de trabajo + descarga); nuevos `newRung`, `RX_FIELDS` | P06 fase 6 (§14, 14.2.4), cita en el comentario del test |
| 43 | stageRx | ee942a4 | 2026-08-03 | B | tabla `LADDERS` a función `buildRungs`; las aserciones se reescriben con equivalente (alguna más estricta) | Refactor, P06 «QA de la fase 4». Se pierde `out.length === SESSION.length`, trivial |
| 44 | trainingLoad | bcd8b43 | 2026-08-28 | A | `modelSec` 910 a 850 (transición 180 s a 120 s) | P04 «Regla −1 — la transición por ejercicio baja de 3 a 2 minutos (decisión del usuario)», las tres copias del modelo |
| 45 | weeklyVolume | dc57bbb | 2026-08-08 | A | el principal puede bajar a 3 series como último recurso (`4` a `3`); `overBudget` ya no deja la sesión intacta | P04 (mensaje: «Dos decisiones del usuario»), spec editada en el mismo commit |

Observaciones sin clase C que conviene saber:
- **#20 y #18 son un vaivén de 17 minutos el mismo día**: `2fc2f19` (11:40) cambió 82.5 a 80 siguiendo la spec de entonces, y `6cfa324` (11:57) lo revirtió tras QA. Hoy test y spec (P12 §4.4) coinciden.
- **#19**: el test fija `need` y `hit` con el mismo valor (2), así que no distingue «las que llegaron» de «las necesarias». La spec P12 §4.2 sigue escribiendo `{{need}}`.
- **#36**: se perdió «funciona con programas sin etapas» en `mergeProgressOnImport`; el caso lo cubre en parte `athleteProgress` (recorte del índice).

## Casos C

### C1 · prescription · 2b31670 (leve): aserción perdida, comportamiento cambió

- El commit unifica el objetivo por defecto en `DEFAULT_TARGET` (8–12 reps, 20–40 s). Es lo pedido: T06 nota «lo que falta sale de `DEFAULT_TARGET` … el mismo valor que ya enseñaba el editor».
- Pero el test viejo incluía `targetLabel({}, { sets: 2, minReps: 10 }, t)` → `'2 × 10 reps'` (solo mínimo, sin máximo). Se borró sin sustituirlo. Con el código nuevo, el mínimo viene de la sesión (10) y el máximo cae a `DEFAULT_TARGET.maxReps` (12), es decir `2 × 10–12 reps`. El valor cambió en silencio.
- Hoy (`git show HEAD:mobile/src/utils/prescription.js`): `maxReps = exConfig.maxReps ?? def.maxReps ?? DEFAULT_TARGET.maxReps`, así que sigue dando `10–12`. En `HEAD:mobile/src/utils/prescription.test.js` no hay ningún test de «solo `minReps`» ni de «solo `maxReps`».
- Riesgo: un caso mezclado (por ejemplo `minReps: 14` con `maxReps` por defecto 12, que daría `14–12`) no está cubierto. Pedir al autor del test que fije el comportamiento deseado.

### C2 · sessionCompression · 5ac7a79 (leve): `toHaveLength(4)` pasa a `toBeLessThan(MIXED.length)`

- Cambio A: `includesWarmup(45)` pasa a `true` (P04 Regla 1, umbral 60 a 45, tras QA del onboarding).
- Pero el test «por debajo del umbral borra ejercicios» pasó de `expect(exercises).toHaveLength(4)` a `expect(exercises.length).toBeLessThan(MIXED.length)`. El mensaje lo justifica («eso depende de la distancia al presupuesto»), pero la aserción nueva sigue verde si se quitan 1 o 4 ejercicios. Un mutante que borrase de más no se detectaría.
- Hoy (`HEAD:mobile/src/utils/sessionCompression.test.js` líneas 293–294) sigue igual: `toBeLessThan(MIXED.length)` y `every(sets === 5)`.
- Sugerencia: calcular el número esperado a partir de la estimación (el test ya la deriva) o fijar el literal con el umbral actual.

### C3 · sessionPlan · bf91f58 (leve): `toBe('a')` pasa a `not.toBe('a')`

- Cambio A: el hero deja de seguir a la sesión a medias (U09 §16 «El hero vuelve a ser la que toca»).
- La aserción nueva debía ser un literal: con el log del test (`a` hecha el 21-sep, `b` y `c` nunca) el hero es `b`. Se dejó `not.toBe('a')`.
- Además el test sigue pasando `activeTemplateId: 'a'`, un parámetro que `sessionPlan` ya no acepta (se ignora), y se quitó la comprobación de `rows[].isHero`.
- Hoy (`HEAD:mobile/src/utils/sessionPlan.test.js` líneas 56–60) está igual. Un hero erróneo `c` pasaría.

### C4 · stageProgress · 9aef98a (leve): «rechaza un blob ajeno» se comprueba con un solo campo

- Al borrar `progressFromBlob` (devolvía `null` con blob de otro programa o con blob nulo), el test pasó a `athleteProgress(...)` y a comprobar solo `.stageSessionsDone === 0`. Desaparece `progressFromBlob(null, 'prog_1')` → `null` sin sustituto.
- El título sigue diciendo «instead of adopting its stage», pero `currentStageIndex` (el valor 1 del blob de prueba) no se comprueba. Si el código adoptase solo la etapa del blob ajeno, el test seguiría verde.
- Hoy: `HEAD:mobile/src/utils/stageProgress.test.js` líneas 25–27 igual, y `stageProgress.weeks.test.js` (`un blob de otro programa no se adopta`) comprueba también un solo campo. Sugerencia: `toEqual` del objeto completo.

### C5 · stageProgress · bee36e2 (media): se borra el test «activar la etapa donde el cliente YA está no le borra las semanas»

- Cambio A: reemplazar la comparación de índices por el sello `stageActivatedAt` (C03 §9.1 y §9.2).
- Pero el commit borra, sin reemplazo, el test que fijaba un arreglo documentado: C03 §9 («Activar la etapa en la que el cliente ya está le borraba las semanas … Ahora un `incomingStage` que coincide con el del cliente no cuenta como movimiento»). Ese párrafo sigue en la spec hoy.
- Código de hoy (`HEAD:mobile/src/utils/stageProgress.js`, `mergeProgressOnImport`): `jump = !kept || (activation && activation !== lastActivation)` y en el salto `stageReset(idx)`. No compara `idx` con la etapa en la que el cliente ya está. Un sello nuevo sobre la misma etapa reinicia `stageSessionsDone` y `stageStartedOn`, justo el síntoma que la spec dice haber corregido.
- La spec C03 §9.2 también cita «repetir un bloque» como uso legítimo de activar a mano, que pediría el reinicio. Es decir: la spec se contradice y el test que lo resolvía ya no existe. El editor del entrenador marca «ACTIVA» la etapa real del cliente y no ofrece «Activar» sobre ella, lo que lo reduce a un caso raro (copia desfasada), pero ninguna prueba lo asegura (no hay tests con «ya está», ni en `useStore.test.js` ni en `clientSync.sim.test.js`).
- Acción: decidir cuál manda (reiniciar o conservar) y escribir el test.
