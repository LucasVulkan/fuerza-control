# Spec — De ciclos a semanas

> Tema: programas
> En corto: La app deja de contar «ciclos» (vueltas completas a todas las sesiones) y pasa a contar semanas de calendario: entrenos por semana, etapas de N semanas y, al acabar una, una comprobación de si se entrenó lo que tocaba que propone alargarla.
> Fase P36 · hecho · Modelo puro: semanas, estado de etapa, sesión que toca · §4
> Fase P37 · hecho · Store, migración y sincronización cliente ↔ entrenador · §5
> Fase P38 · hecho · Pantallas del atleta · §6
> Fase P39 · hecho · Pantallas del entrenador · §7
> Fase P40 · hecho · Onboarding, Documentación, volumen semanal y textos · §8
>
> Estado: **✅ IMPLEMENTADA y fusionada a `main`** (P36-P40, merge `f7016d0`, 25-sep-2026). Las pruebas en los dos móviles son los bloques «Probar en dispositivo» de §5.4, §6.5, §7.1 y §8.5. Sustituye
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
4. **Las sesiones de una etapa SON los entrenos que se esperan cada semana. Punto.**
   Una etapa de 4 sesiones son 4 entrenos por semana; si la siguiente tiene 2, son
   2. Es lo que antes era «sesiones por ciclo», y **no hay un dato aparte** que
   configurar. (Corregido el 25-sep: la P36-P38 habían metido un
   `stage.daysPerWeek` independiente de las sesiones por una mala lectura de esta
   decisión; se quitó entero, ver §6.6.)
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
sesiones». Cierto en teoría e imposible de explicar. Además:

- el ritmo, que es sesiones por semana (`recentPerWeek`), se etiqueta «cic/sem»
  ([ProgramCard.jsx:239](../../src/components/ui/ProgramCard.jsx),
  [ClientsScreen.jsx:1700](../../src/screens/ClientsScreen.jsx)). Bug de etiqueta
  que ya existe hoy.

La razón de ser del ciclo era una sola: saber cuándo termina una etapa. Eso lo
resuelven las semanas más la comprobación de §3.4.

## 2. Vocabulario

| Término | Qué es | Dónde vive |
|---|---|---|
| **Sesiones de la etapa** | Las plantillas distintas (A, B, C…), y a la vez **los entrenos que se esperan cada semana** (§0.4) | `stage.days` (ya existe); se leen con `weeklySessions(stage)` |
| **Duración** | Semanas de la etapa, o `null` = sin límite | `stage.durationWeeks` (ya existe, cambia de significado: antes eran ciclos) |
| **Semana de la etapa** | 1, 2, 3… contadas desde la semana 1 (§0.3) | derivada, nunca se guarda |
| **Semana del programa** | Semanas desde que se empezó el programa | derivada, nunca se guarda |

La palabra «rotación» no se usa en la UI.

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
| `stageBannerSnooze[programId]` | `'YYYY-MM-DD'`: el aviso de etapa no se enseña antes de ese día (§6.1). Estado de primer nivel y **persistido**: `ui` no se persiste, y un «Una semana más» no puede olvidarse al cerrar la app (§5.5) |

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
`dpw = weeklySessions(stage)` (sus sesiones, §0.4):

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
repites A, sigue siendo C. Una etapa nueva tiene plantillas
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
weeklySessions(stage)                // sus sesiones (§0.4); nunca menos de 1

athleteProgress(program, client = null)
// → { currentStageIndex, stageStartedOn, stageSessionsDone, stageExtraWeeks, programStartedOn }
//   blob del cliente si es de ese programa; si no, los campos del programa. Índice clampado.

recordSession(progress, { inCurrentStage, today })   // PARCHE a esparcir; {} si no es de la etapa
stageReset(stageIndex)                               // parche; no toca programStartedOn

stageStatus(program, progress, today = localDay())
// → { stageIdx, stage, perWeek, started, weekInStage, lengthWeeks, expected, done,
//     missingWeeks, ended, earlyReady, endsOn, isLast, programWeek }

fromLegacyProgress(p, stageDaysCount, today)         // §5.4; idempotente
```

`fromLegacyProgress` ancla las fechas reconstruidas al **lunes de la semana de
hoy**, no a hoy: un viernes menos dos semanas es otro viernes, que `weekOne`
manda al lunes siguiente, y el atleta perdía una semana al migrar.

### 4.2 `sessionPlan.js`

**Cambio sobre la spec original:** en vez de un helper `lastDoneMap` aparte,
`sessionPlan` recibe el historial y lo recorre él. Quien llama solo le pasa
su log (el propio o `clientLogs[clientId]`):

```js
sessionPlan({ days, log, activeTemplateId, now, t })
```

- `heroTemplateId`: §3.5.
- `rows[].isDone`: hecha desde el lunes (`startOfWeek`, ahora exportado de
  `weekProgress.js`, que ya lo tenía).
- `subtitle`: `t('home.weekCount', { done, total: días.length })`, con
  `done` = entrenos de la semana, repeticiones incluidas. La clave `home.weekCount`
  ya está en los dos idiomas; `home.cycleCount` se borra en el barrido de §8.4.

### 4.3 `adherence.js`

`sessionsPerCycle` pasa a llamarse `perWeek` en las dos funciones. Quien llama le
pasa `weeklySessions` de la etapa **del atleta**.

### 4.4 Tests

- `stageProgress.weeks.test.js` (**nuevo**, 49 tests): fechas y cambio de hora;
  `weekOne` para los 7 días y cruzando mes y año; `weeklySessions`;
  `athleteProgress` (propio, blob, blob ajeno, índice recortado);
  `recordSession`/`stageReset`; `stageStatus` (sin empezar, semanas, jueves,
  fin, tabla de déficit con su tolerancia, alargada sin subir lo esperado,
  anticipado, etapas con distinto nº de sesiones, sin límite, última etapa, semana del
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
  (Hecho distinto: la conversión de lo viejo vive en `athleteProgress`, §5.5.)
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
| `advanceStage` (:1650) | resetea contadores | `stageReset(next)` + limpia `stageBannerSnooze[id]` |
| `setCurrentStage` (:1616) | resetea contadores + sello si es autor | igual, con `stageReset(idx)` |
| `dismissStageAdvance` (:1672) | baja el flag | **se borra** |
| `extendStage(programId, weeks)` | — | **nueva**: `stageExtraWeeks += weeks`. Solo en programas donde el móvil es el atleta; en el del entrenador, para un cliente, el entrenador cambia `durationWeeks` en el editor |
| `snoozeStageBanner(programId, until)` | — | **nueva**, local (§6.1) |
| `addStageToProgram` / peldaños (:1383, :1469) | `closeOpenStage` con ciclos + `stageAdvancePending` | `closeOpenStage` con el progreso de `athleteProgress(program, owner)` |
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
                 (definición: durationWeeks, sesiones,          (editor / planificador)
                  locked, stageActivatedAt)
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
  2. el entrenador ha cambiado la definición (p. ej. añadió una sesión) y aún no la ha
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
| Entrenador añade o quita sesiones a mitad de etapa | Lo esperado se recalcula en los dos lados en cuanto el cliente aplica la actualización |
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

### 5.5 Lo que la P37 hizo distinto de lo escrito

- **La conversión de progreso viejo vive en `athleteProgress`**, no en
  `progressFromBlob`. Es la puerta única de lectura, así que cubre sin código en
  cada sitio los tres caminos por los que entra un blob contado en ciclos: lo que
  el entrenador tenía guardado de sus clientes, el blob que se restaura al
  reinstalar y un `.fitdata` viejo. `progressFromBlob` queda como lectura
  estructural y solo la usan pantallas que la P39 reescribe.
- **`fromLegacyProgress` detecta lo viejo por los campos de ciclos**, no por la
  falta de `stageSessionsDone`. Con la regla de la spec, un programa recién creado
  al que solo se le había escrito `stageExtraWeeks` se «migraba» en cada lectura y
  las semanas añadidas volvían a 0 (lo cazó el test de `extendStage`). Con los dos
  juegos de campos a la vez, mandan los nuevos.
- **`stageBannerSnooze` es de primer nivel y persistido**, no `ui.*`: `ui` no se
  persiste.
- **`extendStage` se niega por `program.owner`**, no por `ownerClient`, que
  devuelve null si el cliente ya no está en la lista y dejaría pasar su programa.
- **Clonar un programa resetea su progreso** (`cloneProgramFromTemplate`). Con
  ciclos ya pasaba: la copia heredaba los contadores del origen.
- **`closeOpenStage` devuelve el array de etapas** (el mismo si no hay nada que
  cerrar), no `{ stages }`.
- Normalizan el progreso (`normalizeProgress`): la rehidratación y
  `normalizeIncomingProgram`, que es la puerta de `importData` e `importForClient`.

**Entre P37 y P39 la app no se puede probar en el móvil**: el store ya habla
semanas y las pantallas aún leen ciclos: la Home no enseña el aviso de fin de
etapa (lee un flag que ya no se escribe) y los contadores de etapa salen a cero.

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
- Adherencia con `perWeek = weeklySessions(stage)`.
- `StageList`: `home.stageMeta` → «4 semanas · 3 sesiones por semana».
- `confirmStage`: desaparece el «perderás las sesiones marcadas del ciclo»
  (`bodyReset_*`). Lo que se pierde ahora es la cuenta de la etapa en curso:
  «Empezarás Intensificación desde la semana 1» si `started`, y el texto sin aviso
  si no.
- La hoja de documentación del ciclo (`onCycleInfo`) pasa a explicar la semana y la
  comprobación (§8.2).

### 6.4 Editor de programa, planificador, visualizador, pestaña de programas

- ~~Editor de etapa y planificador: un `StepField` «Entrenos por semana»~~.
  **Retirado** (§0.4, §6.6): los entrenos por semana son las sesiones, que ya se
  editan añadiendo o quitando sesiones.
- Textos: `editor.cyclesQuestion` → «¿Cuántas semanas dura esta etapa?»,
  `cyclesExplain` → fuera, `cyclesShort` → «N semanas», `cyclesNoLimit` →
  «Sin límite — la etapa dura hasta que añadas la siguiente».
- **Totales** (ProgramEditor :138-139, ProgramScreen :54-55, ProgramDetail :399-401,
  StagePlanner :437): las sesiones del programa pasan de `Σ días.length × durationWeeks`
  se quedan en `Σ sesiones × durationWeeks` (§0.4), y «ciclos» pasa a «semanas».
- Planificador, progreso de la etapa en curso (`planner.cyclesProgress`, :146): lo
  saca de `stageStatus(program, athleteProgress(program, owner), hoy)` en vez de
  `stageWeeksCompleted` (:421).
- `ProgramScreen.jsx:14`: el comentario «dice CICLOS, no SEMANAS como el mock» se
  borra; el stat vuelve a ser SEMANAS, como en Figma.

### 6.5 Lo que la P38 hizo distinto de lo escrito

- **Dos helpers más en `stageProgress.js`**, porque la misma cuenta salía en
  varias pantallas: `programTotals(program)` (semanas y sesiones del programa,
  sesiones = Σ sesiones de la etapa × semanas; la usan editor, planificador y
  plantillas) y `stageWeekLabel(status, t)` («Semana 3 de 4», «(+1)», «Semana 7»,
  «Sin empezar»; la usan la tarjeta y el planificador, y la ficha de cliente en
  la P39). `t` entra como parámetro, como en `describeRx`: la regla de lint
  prohíbe exportar funciones desde un fichero de componente.
- **`ProgramCard` cambia de API**: `cycleNum` → `weekNum` (null pinta «—»),
  `onCycleInfo` → `onWeekInfo`, `stages[].cycles` → `stages[].weeks`, y `stage`
  gana `started` (sin empezar no enciende puntos) y `detail` (la línea
  «Semana 3 de 4 · 8 de 12 sesiones»). **La ficha de cliente aún pasa la API
  vieja** hasta la P39: sin número de semana y con la barra en tramos iguales.
- **Textos: cambia el VALOR, no la clave.** `editor.cyclesShort`,
  `cyclesQuestion`, `templates.statCycles`, `planner.summary`… ya dicen semanas
  (así la ficha de cliente también, desde ya), pero conservan el nombre. El
  renombrado de claves va con el barrido de la §8.4. `editor.cyclesExplain` se
  deja de pintar en la hoja de crear plantilla.
- ~~El editor de etapa gana un bloque «Frecuencia»~~ — retirado en §6.6.
- **La sesión que toca puede estar hecha esta semana** (semana completa): su
  botón dice REPETIR, que es lo que es. No se fuerza EMPEZAR.
- La hoja de documentación que abre «SEMANA» en la tarjeta sigue siendo la
  sección `cycle` del glosario: su contenido se reescribe en la P40.

**Probar en dispositivo.** Con un programa propio (sin entrenador), servido desde
el worktree de la rama: la Home dice «N de M esta semana» y marca solo lo hecho
esta semana; la sesión que toca es la que más tiempo llevas sin hacer. En la
tarjeta de Programa: «SEMANA 01» tras la primera sesión, «Semana 1 de 4 · 1 de 12
sesiones», ritmo en «ses/sem». Quitar una sesión a la etapa en el editor y ver
que la tarjeta pasa a «de 8 sesiones» (4 semanas × 2). Para ver el aviso de fin de etapa sin
esperar semanas: etapa de 1 semana y hacer todas sus sesiones (sale el anticipado,
con «Ahora no»).

### 6.6 Corrección: no hay «entrenos por semana» aparte de las sesiones

La P36-P38 metieron un `stage.daysPerWeek` distinto de las sesiones de la etapa
(con 3 sesiones y 4 días, 4 entrenos esperados), con su stepper en el editor y el
planificador, herencia entre etapas y escritura desde el generador. Fue una mala
lectura de §0.4: el usuario lo corrigió —«el número de sesiones de un programa o
etapa es el número de entrenos que se espera en una semana. Punto»— y se quitó
entero. `stageDaysPerWeek` pasó a `weeklySessions(stage)` (una línea: sus
sesiones), `stageStatus` devuelve `perWeek`, `sessionPlan` ya no recibe el dato y
no queda ningún `daysPerWeek` en etapas ni programas. El que sigue existiendo es
la RESPUESTA del onboarding (`answers.daysPerWeek`), ver §8.1.

## 7. P39 — Pantallas del entrenador

Todo pasa por `athleteProgress(program, client)` + `stageStatus` (§3.7).

- **Tarjeta del listado** ([ClientsScreen.jsx:1555-1710](../../src/screens/ClientsScreen.jsx)):
  «CICLO NN» → «SEMANA NN» (semana del programa); «x/y del ciclo» → «x/y esta
  semana» (del historial del cliente, §3.6); «cic/sem» → «ses/sem».
- **Ficha** (:310-352): `weeksDone`, `cycleNum`, `weekInStage` y `stageEnded` salen
  de `stageStatus`. `stageEnded` = `ended`. La siguiente sesión, de `sessionPlan`
  con `log: clientLogs[cid]`. Nuevo en la ficha: «9/12 sesiones» y, si
  hay semanas añadidas por el cliente, «(+1)».
- **`weeklyTarget`** (:59): se borra. La adherencia recibe `weeklySessions` de la
  etapa **del cliente**. Hoy lee `stageDays(program)`, o sea la etapa activa en la
  copia del entrenador: el mismo fallo de stage-locks §9, todavía vivo aquí.
- **Preparar sesión** ([NextSessionScreen.jsx:113](../../src/screens/NextSessionScreen.jsx)):
  `sessionPlan` con el historial del cliente.
- **Hoja de crear programa** (:766): «Sesiones por ciclo» → «Sesiones por semana»
  (son lo mismo, §0.4).

[client-triage.md](client-triage.md) (sin implementar) definía «bloque terminado»
con `stageWeeksCompleted`; su punto 4 ya dice `stageStatus(...).ended && isLast`.

### 7.1 Lo que la P39 hizo distinto de lo escrito

- **La ficha y la tarjeta del listado reciben el historial del cliente** (`log`,
  de `clientLogs`), que antes no tenían: lo necesitan la sesión que toca y «x/y
  esta semana». La ficha recibe además `client` en vez de `progress`.
- **`sessionPlan` devuelve también `weekDone`** (el número suelto), para que la
  tarjeta del listado componga su «2/3 esta semana» con la misma cuenta que la
  Home del cliente en vez de repetirla.
- **`stageDetail(status, t)`** en `stageProgress.js`: la línea «Semana 3 de 4 ·
  8 de 12 sesiones» que pintan la tarjeta del atleta y la ficha del cliente.
- **`weeklyTarget` no se borra**: se queda como helper de una línea que recibe
  el cliente (`weeklyTarget(program, client)`), porque la adherencia se calcula
  para todos los clientes en un bucle.
- **`progressFromBlob` se borra**: ya no la usaba nadie. Toda lectura del
  progreso pasa por `athleteProgress` (comprobado con `grep`: ninguna pantalla
  lee `client.progress` ni los campos de progreso directamente).
- Textos, mismo criterio que la P38 (valor sí, clave no): `clients.cycleLabel`
  → «Semana», `clients.cyclesPerWeek` → «ses/sem», `clients.ofCycle` → «esta
  semana», `onboarding.sessionsPerCycle` → «Sesiones por semana» (también lo lee
  la hoja de crear programa). La hoja deja de pintar `editor.cyclesExplain`.

**Probar en dispositivo.** Los dos móviles con la rama. Es la prueba de §5.4 más
lo que pinta el entrenador: tras la primera sesión del cliente, su tarjeta en
Clientes dice «SEMANA 01», «1/3 esta semana» y ritmo en ses/sem; la ficha, «Semana
1 de 4 · 1 de 12 sesiones» y la sesión que le toca es la que más tiempo lleva sin
hacer. Si el cliente alarga la etapa desde su aviso, la ficha lo enseña con «(+1)».

## 8. P40 — Onboarding, Documentación, volumen y textos

### 8.1 Onboarding

- **Decidido con el usuario (25-sep): el generador se queda como está, por
  ahora.** Con §0.4, el programa que sale del onboarding espera tantos entrenos
  por semana como sesiones tiene, y el generador elige plantillas de 3-4 sesiones
  para una respuesta de 1-7 días (`answers.daysPerWeek`): quien dice «4 días»
  puede recibir 3 sesiones (= 3 por semana). Se acepta; quien quiera otra cosa
  añade o quita sesiones en el editor. Descartadas de momento: que el generador
  saque tantas sesiones como días, y que el onboarding pregunte las sesiones por
  semana en vez de los días.
- Lo que SÍ toca la P40: que el onboarding no prometa una rotación que ya no
  existe. `onboarding.sessionsPerCycle` → «Sesiones por semana»; `cycleExplainer`,
  `stepDays.cycleHint`, `proposals.notes.slowCycle` y las claves `*CycleHint`
  («tus 3 sesiones rotan… entrenas 4 días») se reescriben o se quitan, y
  `CycleWeeks`/`weekPattern` (que dibujan esa rotación semana a semana) se
  revisan con el mismo criterio.
- `archetypes.js` y `rankArchetypes` usan `sessionsPerCycle` y `cycleSpeed`
  internamente; no salen a la UI y **no se tocan**.

### 8.2 Documentación

- Glosario (`es.json` :112-134 y su espejo en `en.json`): «Ciclo» desaparece. Queda
  sesión → etapa → programa, y la etapa se define como «N semanas; cada semana
  se hacen sus sesiones». Una línea explica la comprobación de fin de etapa.
- Ficha de métrica `stageProgress` (`es.json` :370-373, «una semana = una vuelta completa…»): se reescribe
  con §3.3 y §3.4.

### 8.3 Volumen

[ProgramDetailScreen.jsx:487](../../src/screens/ProgramDetailScreen.jsx):
«SERIES POR GRUPO Y CICLO» → «SERIES POR GRUPO Y SEMANA», calculado con
la misma suma de series de las sesiones de la etapa: con §0.4, una vuelta a las
sesiones ES una semana. El hint pierde la advertencia de «si haces más de un ciclo
por semana…»: ahora la referencia se aplica tal cual.

### 8.4 Barrido final

```
rg -i "cycle|ciclo" mobile/src/locales mobile/src/screens mobile/src/components mobile/store
```

Cada resultado que quede tiene que ser uno de estos: interno del generador (§8.1),
`UNIT_CYCLE` de `BlockEditorInline` (ciclar unidades, no tiene nada que ver) o un
comentario histórico que explica por qué algo es como es.

### 8.5 Lo que hizo la P40

- **Onboarding sin rotación.** Fuera «Cómo se reparte» (`CycleWeeks`, que dibujaba
  cómo rotan N sesiones en D días) junto con `weekPattern` y su test: con §0.4 una
  semana son las sesiones del programa y el dibujo no decía nada. Fuera también
  `cycleExplainer` («un ciclo es tu semana, con una diferencia…») en la vista
  previa y en el alta manual.
- **La tarjeta de propuesta avisa del desajuste** entre días elegidos y sesiones
  del programa (§8.1): «Son 3 sesiones por semana, menos que los 4 días que
  elegiste. Puedes añadir alguna en el editor» (`notes.moreSessions` /
  `fewerSessions`, con plural en los días). Se compara `sessionsPerCycle` del
  ranking contra `answers.daysPerWeek` directamente: las notas `slowCycle` y
  `rotates` del generador dependían de umbrales y no cubrían todos los casos (con
  5 días y 4 sesiones no avisaba ninguna). El generador no se toca: sigue
  emitiéndolas y el onboarding las ignora.
- La pregunta de días dice «Cada sesión del programa es un entreno a la semana.
  Si un programa no cuadra con tus días, te lo decimos» (`stepDays.daysHint`).
- **Glosario**: la sección «Ciclo» pasa a «Semana» (id `week`, que es la que abre
  «SEMANA» en la tarjeta de programa): sesión ⊂ semana ⊂ etapa ⊂ programa. La
  etapa explica la comprobación de fin, el alargar y el avance anticipado. La
  ficha de métrica `stageProgress` se reescribe con §3.3-§3.4.
- **Volumen**: «SERIES POR GRUPO Y SEMANA» y el hint sin la advertencia. El
  cálculo no cambia (§8.3).
- **Barrido de claves**: renombradas las que se usan (`editor.cycles*` →
  `editor.weeks*`, `clients.cyclesPerWeek`/`ofCycle`/`cycleLabel` →
  `sessionsPerWeek`/`thisWeek`/`weekLabel`, `templates`/`programView.statCycles`
  → `statWeeks`, `programView.cyclesOpen` → `weeksOpen`,
  `planner.summaryPerCycle` → `summaryPerWeek`, `onboarding.sessionsPerCycle` →
  `sessionsPerWeek`) y borradas 28 líneas: las que ya no leía nadie (restos de
  `home.cycle*`, de las pantallas viejas del onboarding, `editor.cyclesExplain`,
  `clients.cycleDays`, `planner.cyclesProgress`, un `cyclesShort` duplicado…) y
  las del dibujo retirado y su explicación (`cycleExplainer`,
  `preview.cycleSectionLabel`, `preview.weekLabel`). Comprobado con un script: toda
  clave literal que pide el código existe en `es` y en `en`, y los dos idiomas
  tienen exactamente las mismas claves.

**Resultado del barrido (§8.4).** Lo que queda con «cycle/ciclo» en `mobile/src` y
`mobile/store`: el interno del generador (`archetypes`, `archetypeAdapter`,
`weeklyVolume`, `exerciseLinks`, `entry.sessionsPerCycle`, las notas `slowCycle`/
`rotates`), la migración (`LEGACY_KEYS`, `fromLegacyProgress` y sus comentarios),
términos de entrenamiento («microciclo», «mesociclo», «macrociclo»), el «full
cycle» de los intervalos EMOM, un ciclo de imports en `useStore.js` y la mención
histórica a `CycleDots` en el onboarding.

Fallo previo encontrado de paso, NO arreglado aquí: `t('common.error')` en el
onboarding no existe en ningún idioma (ya faltaba en `main`).

**Probar en dispositivo.** Onboarding: elegir 4 días y abrir una propuesta de 3
sesiones → la tarjeta avisa «Son 3 sesiones por semana, menos que los 4 días…».
La vista previa ya no enseña «Cómo se reparte». Documentación: la sección
«Semana» existe y la de «Ciclo» no; en la tarjeta de programa, pulsar «SEMANA»
abre esa sección.

## 9. Orden y reparto

| Fase | Depende de | Coste | Notas |
|---|---|---|---|
| P36 | — | 🟢 | ✅ 4967dc6 — aditiva (§4): el modelo nuevo al lado del viejo, 1342 tests |
| P37 | P36 | 🟡 | ✅ 6d16c83 — circuito de §5.2 revisado contra el código; 5 mutaciones de la sincronización, todas cazadas por un test (§5.5) |
| P38 | P37 | 🟡 | ✅ 0003916 — Home, Programa, tarjeta, editor, planificador, visualizador y plantillas (§6.5) |
| P39 | P37 | 🟢 | ✅ 9aef98a — ficha y tarjeta de cliente, Preparar sesión, adherencia por la etapa del cliente (§7.1) |
| P40 | P36 | 🟢 | ✅ d16e8d3 — onboarding sin rotación, glosario, volumen y barrido de claves (§8.5) |

Rama propia (`feat/weeks-model`). Entre P37 y P39 la app queda a medias (el
entrenador aún lee campos que ya no existen): no se fusiona a `main` hasta P39.
