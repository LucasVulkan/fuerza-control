# Spec — De ciclos a semanas

> Tema: programas
> En corto: La app deja de contar «ciclos» (vueltas completas a todas las sesiones) y pasa a contar semanas de calendario: entrenos por semana, etapas de N semanas y, al acabar una, una comprobación de si se entrenó lo que tocaba que propone alargarla.
> Fase P36 · pendiente · Modelo puro: semanas, estado de etapa, sesión que toca · §4
> Fase P37 · pendiente · Store, migración y sincronización cliente ↔ entrenador · §5
> Fase P38 · pendiente · Pantallas del atleta · §6
> Fase P39 · pendiente · Pantallas del entrenador · §7
> Fase P40 · pendiente · Onboarding, Documentación, volumen semanal y textos · §8
>
> Estado: **spec cerrada con el usuario, SIN implementar** (25-sep-2026). Sustituye
> la regla de progreso de [stage-locks.md](stage-locks.md) §0.6 y §3.2 (un ciclo =
> una vuelta a las sesiones distintas) y la regla del hero de
> [home-sessions.md](home-sessions.md) / `sessionPlan`. **Todo lo demás de
> stage-locks sigue vigente**: el progreso es del cliente, es un contador, viaja en
> el blob del historial, y el sello de activación del entrenador manda.
> Desbloquea la fase 6 de [training-load.md](training-load.md): las etapas pasan a
> tener fecha de inicio y "semana" deja de significar dos cosas.

## 0. Decisiones cerradas con el usuario

1. **Se habla de semanas en toda la app.** La palabra «ciclo» desaparece de la UI.
2. **La sesión que toca (hero) es la que más tiempo llevas sin hacer** de la etapa
   actual. Las nunca hechas van primero, en el orden del programa (A, B, C…). La
   sesión a medias manda sobre todo. Ya no hay rotación guardada.
3. **Las etapas duran semanas naturales** (lunes a domingo). La semana 1 es la del
   lunes más cercano al día en que se empieza la etapa: **de lunes a miércoles
   cuenta esa semana; de jueves a domingo, la semana 1 empieza el lunes
   siguiente** y las sesiones de esos días suman igualmente.
4. **Entrenos por semana es un dato DE CADA ETAPA** (`stage.daysPerWeek`), no del
   programa: una etapa puede ser de 3 días y la siguiente de 2.
5. **Al acabar una etapa se comprueba lo entrenado.** Si faltan sesiones por valor
   de al menos una semana, el aviso te deja avanzar pero **propone alargar la etapa**
   las semanas que falten.
6. **Se puede avanzar antes de tiempo**: en la última semana de la etapa, en cuanto
   se han hecho todas las sesiones esperadas, sale el aviso de etapa completada.
7. **Se mantienen las reglas de oro de stage-locks** (§0.7-§0.9): el progreso es un
   **contador** propiedad del cliente, no una lectura del historial; borrar
   sesiones no hace retroceder; reinstalar devuelve al cliente donde estaba; y
   cliente y entrenador **no pueden desincronizarse**.

## 1. Por qué

Un ciclo era «una semana que no avanza el lunes sino cuando completas todas sus
sesiones». Cierto en teoría, imposible de explicar, y además **mentía** en cuanto
los días de entreno no coincidían con las sesiones del programa: el generador crea
programas de 3 sesiones para quien entrena 4 días (`weekPattern.js`), y entonces:

- una etapa de «4 ciclos» dura 3 semanas de calendario;
- la adherencia se mide contra 3 sesiones/semana cuando el usuario eligió 4
  (`weeklyTarget` en [ClientsScreen.jsx:59](../../src/screens/ClientsScreen.jsx),
  `sessionsPerCycle` en [MyProgramScreen.jsx:184](../../src/screens/MyProgramScreen.jsx));
- el ritmo, que es sesiones por semana (`recentPerWeek`), se etiqueta «cic/sem»
  ([ProgramCard.jsx:239](../../src/components/ui/ProgramCard.jsx),
  [ClientsScreen.jsx:1700](../../src/screens/ClientsScreen.jsx)). Bug de etiqueta
  que ya existe hoy.

La razón de ser del ciclo era una sola: saber cuándo termina una etapa. Eso lo
resuelven las semanas más la comprobación de §3.4.

## 2. Vocabulario

| Término | Qué es | Dónde vive |
|---|---|---|
| **Sesiones de la etapa** | Las plantillas distintas (A, B, C…). El menú | `stage.days` (ya existe) |
| **Entrenos por semana** | Cuántas sesiones se esperan cada semana. Pueden ser menos o más que las sesiones de la etapa: con 3 sesiones y 2 días se van alternando | `stage.daysPerWeek` (**nuevo**) |
| **Duración** | Semanas de la etapa, o `null` = sin límite | `stage.durationWeeks` (ya existe, cambia de significado: antes eran ciclos) |
| **Semana de la etapa** | 1, 2, 3… contadas desde la semana 1 (§0.3) | derivada, nunca se guarda |
| **Semana del programa** | Semanas desde que se empezó el programa | derivada, nunca se guarda |

La palabra «rotación» no se usa en la UI. Que las sesiones se alternen es una
consecuencia del hero (§3.5), no un concepto que haya que enseñar.

## 3. El modelo

### 3.1 Qué se guarda y quién lo escribe

Esta tabla es **la** respuesta a «dónde está la cuenta». Cualquier cosa que no
esté aquí se deriva y no se guarda en ningún sitio.

**Definición del programa** — la escribe el AUTOR del programa (el entrenador, o el
propio usuario si el programa es suyo). Viaja al cliente dentro del `program_json`
cuando el entrenador pulsa Enviar, y el cliente la aplica en
`applyPendingProgramUpdate`. El cliente **nunca** la escribe en un programa del
entrenador (stage-locks §2.1).

| Campo | Tipo | Notas |
|---|---|---|
| `stage.durationWeeks` | `number \| null` | Semanas. `null` = sin límite |
| `stage.daysPerWeek` | `number` 1-7, o ausente | **Nuevo.** Ausente = tantos como sesiones, calculado al leer (`stageDaysPerWeek`), nunca guardado (§4.1) |
| `stage.locked` | `boolean` | Sin cambios |
| `program.stageActivatedAt` | ISO | Sin cambios: sello de «el autor movió la etapa a propósito» |

**Progreso** — lo escribe SOLO EL ATLETA en su móvil. Vive en su copia del programa
(`programs[id].<campo>`) y viaja al entrenador en el blob `progress` del
`history_json` (`uploadHistory`, [supabaseSync.js:125](../../src/services/supabaseSync.js)),
que dispara el suscriptor del store
([useStore.js:4418](../../store/useStore.js)) 2 s después de cualquier cambio. El
entrenador **lo lee y no lo recalcula**.

| Campo | Tipo | Qué es | Escritores |
|---|---|---|---|
| `currentStageIndex` | `number` | Etapa en la que está | avanzar, cambiar de etapa, import con salto |
| `stageStartedOn` | `'YYYY-MM-DD' \| null` | Día local de la **primera sesión guardada** de la etapa. `null` = aún no la ha empezado | `saveSession` (si es `null`); se pone a `null` al cambiar de etapa |
| `stageSessionsDone` | `number` | Sesiones de la etapa actual guardadas estando en ella. Repeticiones incluidas | `saveSession` (+1); a `0` al cambiar de etapa |
| `stageExtraWeeks` | `number` | Semanas que el atleta ha añadido a la etapa desde el aviso de fin | `extendStage`; a `0` al cambiar de etapa |
| `programStartedOn` | `'YYYY-MM-DD' \| null` | Día local de la primera sesión del programa | `saveSession` (si es `null`); nunca se reinicia |

Mueren: `cycleCompletedIds`, `stageWeeksCompleted`, `totalWeeksCompleted` y
`stageAdvancePending`. El último era un flag que había que descartar; ahora el
aviso se **deriva** de la fecha (§3.4).

**Estado local del móvil** — no viaja a ningún sitio:

| Campo | Qué es |
|---|---|
| `ui.stageBannerSnooze[programId]` | `'YYYY-MM-DD'`: el aviso de etapa no se enseña antes de ese día (§6.1) |

**Historial** (`workoutLog`, `entry.sessionTemplateId` + `entry.timestamp`). Del
historial se leen SOLO tres cosas de presentación, que pueden cambiar si se borra
una sesión sin que eso sea progreso: el hero (§3.5), «esta semana» (§3.6) y la
adherencia (ya era así). **Nada que decida en qué etapa estás o cuándo termina
sale del historial.**

### 3.2 Por qué `stageStartedOn` es la primera sesión y no el momento de avanzar

1. Hay **un solo escritor**: `saveSession`. Crear un programa, activarlo, importar
   uno del entrenador, avanzar desde el aviso o desde el selector: ninguno de esos
   caminos tiene que acordarse de poner una fecha. Solo la quitan.
2. Es lo que el usuario entiende por empezar. Si activas la etapa un sábado y
   entrenas el lunes, empezaste el lunes.
3. El entrenador ve «sin empezar» cuando el cliente aún no ha entrenado la etapa,
   que es la verdad.

Es una **fecha local en texto**, no un instante: la semana 1 la fija el calendario
del cliente, y el entrenador la lee tal cual. Si están en husos distintos, el
«hoy» del entrenador puede ir unas horas por delante o por detrás alrededor de la
medianoche del lunes. Se acepta.

### 3.3 La semana

```js
// Lunes de la semana 1, a partir del día de inicio (§0.3).
// lun-mié → el lunes de esa semana; jue-dom → el lunes siguiente.
weekOne('2026-09-24' /* jueves */) === '2026-09-28'
weekOne('2026-09-22' /* martes */) === '2026-09-21'

// Semana de la etapa: 1 mientras no haya empezado o antes de la semana 1.
weekInStage = max(1, floor(díasEntre(weekOne(stageStartedOn), hoy) / 7) + 1)
```

Todo en fechas locales `'YYYY-MM-DD'` con aritmética de calendario (sin
instantes), para que el cambio de hora de octubre y marzo no desplace nada.

La semana del programa es la misma cuenta sobre `programStartedOn`.

### 3.4 Fin de etapa y comprobación

Para la etapa actual, con `D = stage.durationWeeks`, `E = stageExtraWeeks` y
`dpw = stage.daysPerWeek`:

```js
lengthWeeks = D + E                         // null si D es null (sin límite)
endsOn      = weekOne(stageStartedOn) + 7 × lengthWeeks días   // el lunes siguiente a la última semana
expected    = D × dpw                       // ⚠️ SIN E: ver abajo
done        = stageSessionsDone
missing     = max(0, expected − done)
missingWeeks = round(missing / dpw)         // el redondeo es la tolerancia

ended       = started && hoy >= endsOn
earlyReady  = started && weekInStage === lengthWeeks && done >= expected
```

- **Las semanas añadidas no suben lo esperado.** Se alarga una etapa para
  recuperar lo que falta, no para exigir una semana más. Con `expected` contando
  `E`, alargar 1 semana y entrenarla entera dejaría el mismo déficit y el aviso
  volvería a proponer alargar.
- **Tolerancia**: 4 semanas × 3 = 12 esperadas. Con 11 hechas, `round(1/3) = 0` →
  no se propone nada. Con 10, `round(2/3) = 1` → se propone 1 semana.
- **Hacer de más no penaliza ni adelanta** nada, salvo lo del punto 6 de §0.
- **Sin límite** (`D = null`): no hay fin, ni aviso, ni comprobación. La semana
  sube sin tope.
- **Última etapa**: la etapa se sigue entrenando indefinidamente. Sin aviso en la
  Home del atleta (como hoy); el entrenador lo ve como «bloque terminado»
  (§7 y [client-triage.md](client-triage.md)).

### 3.5 La sesión que toca

```js
// Solo sesiones de la etapa actual. `lastDoneAt[tid]` = timestamp más reciente
// de ese sessionTemplateId en el historial del atleta, o undefined.
hero = sesiónAMedias
    ?? días.minBy(d => lastDoneAt[d.templateId] ?? -Infinity)   // empate → orden del programa
```

Reproduce la rotación en el uso normal: A B C A B, hero C. Si te saltas C y
repites A, sigue siendo C. Con 3 sesiones y 4 días reproduce exactamente
`weekPattern` (la segunda semana empieza por B). Una etapa nueva tiene plantillas
nuevas (`tpl_*` materializadas, stage-planner §4), así que empieza por A.

Como es una lectura del historial, borrar una sesión cambia la sugerencia. Es
aceptable: es una sugerencia, no progreso.

### 3.6 «Esta semana»

- **Contador de la Home**: sesiones de la etapa actual guardadas desde el lunes de
  hoy, frente a `dpw`. «2 de 3 esta semana».
- **Check de cada fila**: la sesión se ha hecho esta semana. Sustituye a «hecha en
  este ciclo».

### 3.7 Un solo camino para leer el progreso

El fallo que más se ha repetido en la conexión es que el móvil del entrenador lea
el progreso de **su** copia del programa, que no se mueve
([stage-locks.md](stage-locks.md) §9; `weeklyTarget` todavía lo hace). Regla dura:

> **Nadie fuera de `stageProgress.js` lee los campos de progreso del programa.**
> Toda pantalla pide `athleteProgress(program, client)` y se lo pasa a
> `stageStatus(...)`.

`athleteProgress` devuelve el blob del cliente si `client` viene y el blob es de
ese programa, y si no los campos del propio programa. Es la generalización de
`clientStageIndex`, que pasa a ser `athleteProgress(...).currentStageIndex`.

## 4. P36 — Modelo puro

Todo en `src/utils/`, sin store ni React, con tests en vitest.

**La P36 es ADITIVA.** Las funciones de sincronización que hablan de ciclos
(`advanceCycle`, el blob, `mergeProgressOnImport`, `closeOpenStage`) las llama el
store, y `useStore.test.js` y `clientSync.sim.test.js` las ejercitan a través de
él. Cambiarlas aquí dejaba la suite en rojo hasta la P37, así que se cambian
allí, en el mismo commit que el store (§5.0). La P36 deja el modelo nuevo entero
y probado al lado del viejo.

### 4.1 `stageProgress.js` — lo nuevo

Sección «Semanas» al final del fichero:

```js
localDay(ts = Date.now())            // 'YYYY-MM-DD' local
addDays(day, n) · daysBetween(a, b)  // aritmética de calendario en UTC: el cambio de hora no mueve nada
weekOne(startedOn)                   // §3.3; null → null
stageDaysPerWeek(stage)              // stage.daysPerWeek ?? nº de sesiones, entre 1 y 7

athleteProgress(program, client = null)
// → { currentStageIndex, stageStartedOn, stageSessionsDone, stageExtraWeeks, programStartedOn }
//   blob del cliente si es de ese programa; si no, los campos del programa. Índice clampado.

recordSession(progress, { inCurrentStage, today })   // PARCHE a esparcir; {} si no es de la etapa
stageReset(stageIndex)                               // parche; no toca programStartedOn

stageStatus(program, progress, today = localDay())
// → { stageIdx, stage, daysPerWeek, started, weekInStage, lengthWeeks, expected, done,
//     missingWeeks, ended, earlyReady, endsOn, isLast, programWeek }

fromLegacyProgress(p, stageDaysCount, today)         // §5.4; idempotente
```

**Cambio sobre la spec original: el valor por defecto de `daysPerWeek` NO se
guarda.** La spec pedía que `ensureStages` lo rellenara. Pero así quedaría
congelado en el momento de la primera escritura: una etapa creada con 3 sesiones
a la que luego se le añade una cuarta seguiría esperando 3 por semana sin que
nadie lo hubiera elegido. `stage.daysPerWeek` solo existe cuando alguien lo fija
(editor de etapa, generador), y todos los lectores pasan por `stageDaysPerWeek`.
`ensureStages` no se toca.

`fromLegacyProgress` ancla las fechas reconstruidas al **lunes de la semana de
hoy**, no a hoy: un viernes menos dos semanas es otro viernes, que `weekOne`
manda al lunes siguiente, y el atleta perdía una semana al migrar.

### 4.2 `sessionPlan.js`

**Cambio sobre la spec original:** en vez de un helper `lastDoneMap` aparte,
`sessionPlan` recibe el historial y lo recorre él. Quien llama solo le pasa
su log (el propio o `clientLogs[clientId]`):

```js
sessionPlan({ days, log, daysPerWeek, activeTemplateId, now, t })
```

- `heroTemplateId`: §3.5.
- `rows[].isDone`: hecha desde el lunes (`startOfWeek`, ahora exportado de
  `weekProgress.js`, que ya lo tenía).
- `subtitle`: `t('home.weekCount', { done, total: daysPerWeek ?? días })`, con
  `done` = entrenos de la semana, repeticiones incluidas. La clave `home.weekCount`
  ya está en los dos idiomas; `home.cycleCount` se borra en el barrido de §8.4.

### 4.3 `adherence.js`

`sessionsPerCycle` pasa a llamarse `perWeek` en las dos funciones. Quien llama le
pasa `stageStatus(...).daysPerWeek` de la etapa **del atleta**.

### 4.4 Tests

- `stageProgress.weeks.test.js` (**nuevo**, 49 tests): fechas y cambio de hora;
  `weekOne` para los 7 días y cruzando mes y año; `stageDaysPerWeek`;
  `athleteProgress` (propio, blob, blob ajeno, índice recortado);
  `recordSession`/`stageReset`; `stageStatus` (sin empezar, semanas, jueves,
  fin, tabla de déficit con su tolerancia, alargada sin subir lo esperado,
  anticipado, `daysPerWeek` ≠ sesiones, sin límite, última etapa, semana del
  programa, y **entrenador y cliente dan lo mismo con el mismo progreso**);
  `fromLegacyProgress`. Vive aparte para que la P37, al borrar los tests de
  ciclos de `stageProgress.test.js`, no lo toque.
- `sessionPlan.test.js` reescrito (13): nunca hechas por orden, la más antigua,
  saltarse la C, la sesión a medias, rotación continua cruzando el lunes, check
  y contador de esta semana.
- `adherence.test.js`: `perWeek`.

Comprobado que los tests muerden: con `expected` contando las semanas añadidas,
`ceil` en vez de `round` y `weekOne` sin el corte del jueves fallan 9.

**Entre P36 y P38/P39 la Home y la tarjeta de cliente no reciben aún `log` ni
`perWeek`**: el hero sale siempre A y la adherencia mide contra 1 por semana.
Es la rama; `main` no se toca hasta P39.

## 5. P37 — Store, migración y sincronización

### 5.0 Lo que la P36 dejó para aquí

Cambian en `stageProgress.js`, en el mismo commit que el store que las llama:

- **Se borra `advanceCycle`** (y sus tests en `stageProgress.test.js`).
- `closeOpenStage(stages, stageIndex, progress, today)`: al añadir una etapa detrás
  de una sin límite, esta se cierra en `max(1, weekInStage − 1)` semanas (las
  completas). Ya no devuelve `advancePending`: con `ended` derivado, el aviso sale
  solo si toca.
- `progressBlob`, `progressChanged`, `progressFromBlob`: los cinco campos de §3.1
  más `appliedActivation` y `updatedAt`, que se quedan como están.
  `progressFromBlob` pasa el blob por `fromLegacyProgress`.
- `mergeProgressOnImport`: misma lógica de salto por sello. Con salto →
  `stageReset(etapaEntrante)` y, si el programa es otro, además
  `programStartedOn: null`. Sin salto → los campos del cliente tal cual, índice
  clampado. Deja de calcular `stageAdvancePending`.
- `clientStageIndex` pasa a ser `athleteProgress(...).currentStageIndex`.
- Tests: `mergeProgressOnImport` (sin salto conserva; sello nuevo resetea; programa
  distinto resetea también `programStartedOn`; índice fuera de rango se recorta),
  `closeOpenStage` nuevo, y `clientSync.sim.test.js` (su `logSession` usa
  `recordSession`; las aserciones de ciclo pasan a `stageSessionsDone` y fechas).

### 5.1 Escrituras, una por una

| Acción ([useStore.js](../../store/useStore.js)) | Hoy | Pasa a |
|---|---|---|
| `saveSession` (:2283-2335) | `advanceCycle` sobre la etapa actual | `recordSession(athleteProgress(prog), { inCurrentStage, today: localDay() })`. Misma condición: la plantilla está en `stage.days` |
| `advanceStage` (:1650) | resetea contadores | `stageReset(next)` + limpia `ui.stageBannerSnooze[id]` |
| `setCurrentStage` (:1616) | resetea contadores + sello si es autor | igual, con `stageReset(idx)` |
| `dismissStageAdvance` (:1672) | baja el flag | **se borra** |
| `extendStage(programId, weeks)` | — | **nueva**: `stageExtraWeeks += weeks`. Solo en programas donde el móvil es el atleta; en el del entrenador, para un cliente, el entrenador cambia `durationWeeks` en el editor |
| `snoozeStageBanner(programId, until)` | — | **nueva**, local (§6.1) |
| `addStageToProgram` / peldaños (:1383, :1469) | `closeOpenStage` con ciclos + `stageAdvancePending` | `closeOpenStage` con el progreso de `athleteProgress(program, owner)`. La etapa nueva hereda `daysPerWeek` de la etapa de origen |
| duplicar etapa (:1580) | — | copia `daysPerWeek` |
| creación de programas (:849, :1209) y onboarding (:527) | `durationWeeks` | + `daysPerWeek`: el de las respuestas del onboarding en todas sus etapas; en los programas en blanco no se escribe (§4.1) |
| `applyPendingProgramUpdate` (:3734), `_restoreFromSlot` (:3547), import de fichero (:2814) | `mergeProgressOnImport` | igual, con la función nueva |
| upload (:3803) | `progressBlob` | igual, con los campos nuevos |
| suscriptor (:4418) | `progressChanged` | igual, con los campos nuevos |

`_writeProgress` tiene que **borrar** los campos viejos al escribir los nuevos,
para que no quede un `stageWeeksCompleted` fantasma que alguien lea.

`RootNavigator` ([:68](../../src/navigation/RootNavigator.jsx)): el punto del tab
pasa a ser el selector de §6.1 («hay aviso que enseñar»), no el flag.

### 5.2 El circuito entrenador ↔ cliente

```
 MÓVIL DEL CLIENTE                                  MÓVIL DEL ENTRENADOR
 ─────────────────                                  ────────────────────
 saveSession ─┐
 avanzar ─────┤→ programs[id].{progreso}            clients[cid].progress (blob)
 alargar ─────┤        │                                    ▲
 import ──────┘        │ suscriptor, 2 s                     │ descarga del history_json
                       ▼                                    │
                 uploadHistory({ entries, progress }) ──────┘
                                                            │
                 applyPendingProgramUpdate ◄── program_json ◄── Enviar programa
                 (definición: durationWeeks,                    (editor / planificador)
                  daysPerWeek, locked, stageActivatedAt)
```

- **Progreso: cliente → entrenador.** Una sola dirección, sin excepciones.
- **Definición: entrenador → cliente.** Una sola dirección. La única forma en que
  el entrenador mueve el progreso es el sello `stageActivatedAt`, que el cliente
  aplica como `stageReset` al importar (stage-locks §6.3, sin cambios).
- **Lo derivado se calcula en los dos lados con la misma función**
  (`stageStatus`), así que para un mismo progreso y una misma definición dan lo
  mismo. Pueden diferir un rato por dos motivos, y los dos se arreglan solos:
  1. el cliente ha entrenado y aún no ha subido (sin cobertura: reintenta con
     `pendingUpload`);
  2. el entrenador ha cambiado la definición (p. ej. `daysPerWeek`) y aún no la ha
     enviado, o el cliente aún no la ha aplicado. Mientras, cada uno calcula con su
     copia.
- **Alargar desde el cliente no toca la definición.** `durationWeeks` es del
  entrenador y `stageExtraWeeks` del cliente; la duración real es la suma. Si el
  entrenador cambia la duración después, la suma sigue siendo válida.

### 5.3 Casos límite

| Caso | Resultado |
|---|---|
| Cliente borra sesiones | `stageSessionsDone` no baja; la etapa no retrocede. Cambian el hero y «esta semana» |
| Cliente reinstala y reconecta | `_restoreFromSlot` devuelve los cinco campos. Sin historial fusionado, vuelve igual a su semana (las fechas no dependen del log) |
| Cliente repite la sesión A doce veces | Cuentan 12. La etapa **no** termina antes: la fecha manda, y `earlyReady` solo existe en la última semana |
| Cliente hace una sesión libre | No cuenta: no es plantilla de la etapa. Como hoy |
| Entrenador activa otra etapa | Sello → `stageReset` al importar. La etapa empieza en la primera sesión |
| Entrenador devuelve al cliente a una etapa anterior | Igual: empieza de cero (stage-locks §6.3) |
| Entrenador borra etapas por debajo de la del cliente | Índice clampado, contadores intactos. Como hoy |
| Entrenador cambia `daysPerWeek` a mitad de etapa | Lo esperado se recalcula en los dos lados en cuanto el cliente aplica la actualización |
| Etapa activada y sin entrenar tres semanas | `started: false`; el reloj no corre. El entrenador ve «sin empezar» y la adherencia en rojo |
| Cliente con la app vieja y entrenador con la nueva (o al revés) | **No soportado**: el blob cambia de forma. Actualizar los dos móviles a la vez. `progressFromBlob` convierte un blob viejo (§5.4) para no dejar a nadie en blanco, pero con el cliente subiendo el formato viejo la fecha de inicio se recalcularía cada día |

### 5.4 Migración

Retrocompatibilidad no necesaria (solo prueba el usuario), pero sus dos móviles
tienen progreso real y conservarlo cuesta una función. En la rehidratación
([useStore.js:4270](../../store/useStore.js)), después de `ensureStages`, y en
`progressFromBlob`:

```js
fromLegacyProgress(p, stageDaysCount, today):
  if (p.stageSessionsDone !== undefined) return p           // ya migrado
  weeks = p.stageWeeksCompleted ?? 0
  open  = p.cycleCompletedIds?.length ?? 0
  stageSessionsDone = weeks × stageDaysCount + open
  stageStartedOn    = stageSessionsDone > 0 ? today − 7 × weeks días : null
  programStartedOn  = (p.totalWeeksCompleted ?? 0) > 0 || stageSessionsDone > 0
                      ? today − 7 × (p.totalWeeksCompleted ?? 0) días : null
  stageExtraWeeks   = 0
  borrar cycleCompletedIds, stageWeeksCompleted, totalWeeksCompleted, stageAdvancePending
```

`durationWeeks` se queda con el número que tenga: los ciclos pasan a leerse como
semanas, que es lo que el usuario quería decir al ponerlos.

**Probar en dispositivo.** Con los dos móviles actualizados: el cliente entrena una
sesión y el entrenador ve «Semana 1 de 4 · 1/12» en la tarjeta y en la ficha. El
cliente borra esa sesión: en los dos sigue 1/12. El entrenador activa la etapa 2 y
la envía: el cliente pasa a «sin empezar», entrena, y los dos ven la semana 1 de la
etapa 2. Reinstalar el cliente y reconectar sin fusionar historial: vuelve a su
etapa y a su semana.

## 6. P38 — Pantallas del atleta

### 6.1 Home: aviso de fin de etapa

Selector único, que usan el aviso y el punto del tab:

```js
showStageBanner = !isLast && (ended || earlyReady) && !(snooze && hoy < snooze)
```

| Situación | Texto (idea, se afina en i18n) | Botones |
|---|---|---|
| Terminada, `missingWeeks ≥ 1`, siguiente abierta | «ETAPA TERMINADA · Has hecho 9 de 12 sesiones. Te proponemos 1 semana más de Acumulación antes de pasar a Intensificación.» | **Alargar 1 semana** → `extendStage(n)` · Pasar a Intensificación → `advanceStage` |
| Terminada sin déficit, siguiente abierta | «ETAPA COMPLETADA · Siguiente: Intensificación» | **Pasar a Intensificación** · Una semana más → `extendStage(1)` + `snooze(nuevo endsOn)` |
| `earlyReady` (última semana, todo hecho) | «ETAPA COMPLETADA · Ya has hecho las 12 sesiones. Puedes pasar a Intensificación ya o acabar la semana.» | **Pasar a Intensificación** · Ahora no → `snooze(endsOn)` |
| Siguiente bloqueada | Como hoy (`stageLockedTitle/Text/Hint`) | Entendido → `snooze(hoy + 7)`: se recuerda cada semana mientras siga bloqueada |

- Tras «Alargar N» no se pone snooze: si el atleta recupera las sesiones en la
  última semana alargada, `earlyReady` le deja avanzar ya.
- «Una semana más» sí necesita snooze: sin él, `earlyReady` se cumpliría al
  instante (última semana nueva y todo hecho) y el aviso volvería a salir.
- El texto con N semanas usa plurales de i18next (`_one` / `_other`).

### 6.2 Home: la lista de sesiones

`sessionPlan` nuevo (§4.2): contador «2 de 3 esta semana» en la cabecera de
sección (hoy `home.cycleCount`), check por «hecha esta semana», hero por
antigüedad. Estructura de la lista sin cambios
([home-sesiones-plegables.md](home-sesiones-plegables.md)).

### 6.3 Tab Programa (`MyProgramScreen`) y `ProgramCard`

- Número grande: **semana del programa** (`programWeek`), rotulada «SEMANA», con
  «—» sin empezar. Sustituye a «CICLO NN» (`computeWeekNum` se borra).
- Bloque de etapa: «Acumulación · semana 3 de 4», con «(+1)» si hay semanas
  añadidas, y «sin empezar» si no ha empezado. Los puntos pintan las semanas de la
  etapa (`lengthWeeks`), y además `done/expected` en texto pequeño.
- Ritmo: la unidad pasa a «ses/sem» (`programCard.sessionsPerWeek`). Arregla el bug
  de etiqueta de §1.
- Adherencia con `perWeek = stage.daysPerWeek`.
- `StageList`: `home.stageMeta` → «4 semanas · 3 días/semana».
- `confirmStage`: desaparece el «perderás las sesiones marcadas del ciclo»
  (`bodyReset_*`). Lo que se pierde ahora es la cuenta de la etapa en curso:
  «Empezarás Intensificación desde la semana 1» si `started`, y el texto sin aviso
  si no.
- La hoja de documentación del ciclo (`onCycleInfo`) pasa a explicar la semana y la
  comprobación (§8.2).

### 6.4 Editor de programa, planificador, visualizador, pestaña de programas

- **Editor de etapa** ([ProgramEditorScreen.jsx:389](../../src/screens/ProgramEditorScreen.jsx))
  y fila del planificador ([StagePlannerScreen.jsx:215](../../src/screens/StagePlannerScreen.jsx)):
  junto a la duración, un `StepField` nuevo **«Entrenos por semana»** (1-7). Las
  reglas del `StepField` de su cabecera se respetan.
- Textos: `editor.cyclesQuestion` → «¿Cuántas semanas dura esta etapa?»,
  `cyclesExplain` → fuera, `cyclesShort` → «N semanas», `cyclesNoLimit` →
  «Sin límite — la etapa dura hasta que añadas la siguiente».
- **Totales** (ProgramEditor :138-139, ProgramScreen :54-55, ProgramDetail :399-401,
  StagePlanner :437): las sesiones del programa pasan de `Σ días.length × durationWeeks`
  a **`Σ daysPerWeek × durationWeeks`**, y «ciclos» a «semanas».
- Planificador, progreso de la etapa en curso (`planner.cyclesProgress`, :146): lo
  saca de `stageStatus(program, athleteProgress(program, owner), hoy)` en vez de
  `stageWeeksCompleted` (:421).
- `ProgramScreen.jsx:14`: el comentario «dice CICLOS, no SEMANAS como el mock» se
  borra; el stat vuelve a ser SEMANAS, como en Figma.

## 7. P39 — Pantallas del entrenador

Todo pasa por `athleteProgress(program, client)` + `stageStatus` (§3.7).

- **Tarjeta del listado** ([ClientsScreen.jsx:1555-1710](../../src/screens/ClientsScreen.jsx)):
  «CICLO NN» → «SEMANA NN» (semana del programa); «x/y del ciclo» → «x/y esta
  semana» (del historial del cliente, §3.6); «cic/sem» → «ses/sem».
- **Ficha** (:310-352): `weeksDone`, `cycleNum`, `weekInStage` y `stageEnded` salen
  de `stageStatus`. `stageEnded` = `ended`. La siguiente sesión, de `sessionPlan`
  con `log: clientLogs[cid]`. Nuevo en la ficha: «9/12 sesiones» y, si
  hay semanas añadidas por el cliente, «(+1)».
- **`weeklyTarget`** (:59): se borra. La adherencia recibe el `daysPerWeek` de la
  etapa **del cliente**. Hoy lee `stageDays(program)`, o sea la etapa activa en la
  copia del entrenador: el mismo fallo de stage-locks §9, todavía vivo aquí.
- **Preparar sesión** ([NextSessionScreen.jsx:113](../../src/screens/NextSessionScreen.jsx)):
  `sessionPlan` con el historial del cliente.
- **Hoja de crear programa** (:766): «Sesiones por ciclo» → «Sesiones». Los
  entrenos por semana se quedan en el valor por defecto y se ajustan en el editor
  de etapa. No se añade otro control a la hoja.

[client-triage.md](client-triage.md) (sin implementar) define «bloque terminado»
con `stageWeeksCompleted`; al implementarlo, usar `stageStatus(...).ended && isLast`.

## 8. P40 — Onboarding, Documentación, volumen y textos

### 8.1 Onboarding

- El generador escribe `daysPerWeek = answers.daysPerWeek` en **todas** las etapas
  del programa generado.
- `onboarding.sessionsPerCycle` → «Sesiones distintas»; `cycleExplainer`,
  `stepDays.cycleHint`, `proposals.notes.slowCycle` y las claves `*CycleHint` se
  reescriben sin «ciclo»: «Tus 3 sesiones se van alternando: entrenas 4 días a la
  semana». `slowCycle` («el ciclo tarda más de una semana») pierde el sentido y se
  borra de `NOTE_PRIORITY` ([OnboardingScreen.jsx:251](../../src/screens/OnboardingScreen.jsx)).
- `CycleWeeks` / `weekPattern` se quedan: ya pintan semanas. No se renombran.
- `archetypes.js` y `rankArchetypes` usan `sessionsPerCycle` y `cycleSpeed`
  internamente; no salen a la UI y **no se tocan**.

### 8.2 Documentación

- Glosario (`es.json` :112-134 y su espejo en `en.json`): «Ciclo» desaparece. Queda
  sesión → etapa → programa, y la etapa se define como «N semanas, con X entrenos
  por semana». Una línea explica la comprobación de fin de etapa.
- Ficha de métrica `stageProgress` (`es.json` :370-373, «una semana = una vuelta completa…»): se reescribe
  con §3.3 y §3.4.

### 8.3 Volumen

[ProgramDetailScreen.jsx:487](../../src/screens/ProgramDetailScreen.jsx):
«SERIES POR GRUPO Y CICLO» → «SERIES POR GRUPO Y SEMANA», calculado con
`weeklySetsByGroup(sesiones, stage.daysPerWeek)`, que ya existe
([weeklyVolume.js:88](../../src/utils/weeklyVolume.js)). El hint pierde la
advertencia de «si haces más de un ciclo por semana…»: ahora la referencia se
aplica tal cual.

### 8.4 Barrido final

```
rg -i "cycle|ciclo" mobile/src/locales mobile/src/screens mobile/src/components mobile/store
```

Cada resultado que quede tiene que ser uno de estos: interno del generador (§8.1),
`UNIT_CYCLE` de `BlockEditorInline` (ciclar unidades, no tiene nada que ver) o un
comentario histórico que explica por qué algo es como es.

## 9. Orden y reparto

| Fase | Depende de | Coste | Notas |
|---|---|---|---|
| P36 | — | 🟢 | Pura y con tests. La puede hacer un subagente con esta spec |
| P37 | P36 | 🟡 | El punto delicado. Revisar línea a línea el circuito de §5.2 contra el código antes de dar la fase por buena |
| P38 | P37 | 🟡 | Muchas pantallas, poca lógica |
| P39 | P37 | 🟢 | Se puede hacer en paralelo con P38 |
| P40 | P36 | 🟢 | Casi todo textos |

Rama propia (`feat/weeks-model`). Entre P37 y P39 la app queda a medias (el
entrenador aún lee campos que ya no existen): no se fusiona a `main` hasta P39.
