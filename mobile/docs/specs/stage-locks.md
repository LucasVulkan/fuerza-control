# Spec — Bloqueo de etapas (entrenador → cliente)

> Tema: conexión
> En corto: El entrenador puede cerrar una etapa con candado: el cliente sigue entrenando la suya y no entra en la siguiente hasta que se la abran. Desde sep-2026 incluye que el programa del entrenador sea de solo lectura en el móvil del cliente.
> Fase C07 · hecho · `stageWeeksCompleted` sustituye a `stageSessionsCompleted` (`0884d09`)
> Fase C08 · hecho · Blob `progress` en el historial; el entrenador lo espeja (`8d63d9a`)
> Fase C09 · hecho · Reglas de import + poda del modal de actualización (`e1a4d21`)
> Fase C10 · hecho · `stage.locked` + `isStageLocked` + guards en el store
> Fase C11 · hecho · UI cliente: candados en modal y editor (`43b9bab`)
> Fase C12 · hecho · UI entrenador: los tres estados del hero + desbloquear
> Fase C13 · hecho · Pull al volver a primer plano + línea de diff de desbloqueo
> Fase C14 · hecho · El programa del entrenador es de solo lectura en el móvil del cliente
>
> Estado: **✅ IMPLEMENTADA, en testeo en dispositivo** (jul 2026). Las 7 fases
> están en `main`; ver la tabla de §7 para el commit de cada una.
>
> **Ronda 1 de QA en dispositivo** (§9) — tres fallos encontrados por el usuario,
> los tres del mismo origen: el lado del entrenador leía `currentStageIndex` de su
> propia copia del programa en vez de la posición real del cliente.
>
> El entrenador puede marcar una etapa como bloqueada. El cliente entrena
> normalmente, pero no puede entrar en una etapa bloqueada: cuando termina la
> suya y la siguiente está cerrada, ve un aviso y sigue repitiendo la etapa
> actual hasta que el entrenador la abra.
>
> La spec arrastra cuatro arreglos de bugs **preexistentes** que esta feature
> deja al descubierto y sin los cuales no se sostiene (§3, §6): el umbral de fin
> de etapa cuenta sesiones repetidas, el progreso del cliente nunca llega al
> entrenador, activar una etapa desde el entrenador no le llega al cliente, y
> reinstalar pierde la posición en el programa.

## 0. Decisiones cerradas con el usuario

1. Con la siguiente etapa bloqueada, el cliente **sigue entrenando la actual**.
   No se le corta nada; solo no puede cambiar de etapa.
2. Las etapas nuevas **nacen desbloqueadas**. Bloquear es la excepción.
3. Sin notificación push. Basta con que el cliente se entere al abrir la app
   (§6.1, refresco al volver a primer plano).
4. Reimportar un programa **no devuelve al cliente a la etapa 1**, salvo que el
   entrenador haya activado otra etapa a propósito — eso **sí** manda (§6.3).
5. El cliente **tampoco puede saltar a una etapa bloqueada desde el editor de
   programas** (no solo desde el modal de Home). **Superado en sep-2026**: el
   cliente ya no entra al editor de los programas del entrenador (§2.1), así que
   ese camino desaparece. El guard del store se queda igualmente.
6. **Un ciclo se cierra al completar las sesiones DISTINTAS del ciclo**
   (A→B→C→D). Repetir una sesión no lo cierra, y **no** se le pregunta nada al
   cliente en el recap (§3.2).
7. **Borrar logs no hace retroceder el programa.** El progreso es un contador,
   no una lectura del historial.
8. **Reinstalar y reconectar devuelve al cliente donde lo dejó**, incluida la
   etapa (§6.4).
9. Requisito duro: la progresión del cliente y la que ve el entrenador **no
   pueden desincronizarse** — ni con sesiones libres, ni repitiendo sesiones, ni
   reimportando el programa.

## 1. Por qué el candado viaja dentro del programa

Cada cliente tiene su **propio** programa: toda vía de asignación clona antes de
asignar (`createProgramForClient` [useStore.js:642], `cloneProgramFromTemplate`
con `mode:'managed'` [useStore.js:1351], `reidProgramFile` al importar — fix
`42f2bcd`). Ids `prog_*` y `tpl_*` frescos, más `program.clientId` marcando al
dueño.

Como el programa es exclusivo, un flag dentro de él **ya es estado por cliente**.
No hace falta columna nueva en Supabase, ni canal nuevo, ni tocar
`overrides_json`: el candado viaja gratis dentro de `program_json` por la
tubería de actualización de programa que ya existe.

```js
// stage (aditivo, sin migración; ausente = desbloqueada)
stage.locked = true | false | undefined
```

## 2. Regla de bloqueo

Una sola función pura, usada por Home, el editor y el store:

```js
// src/utils/stageLocks.js
export function isStageLocked(program, idx, clientSync) {
  if (!clientSync?.slotId) return false;                                 // no conectado
  if (!clientSync.trainerProgramIds?.includes(program.id)) return false; // programa propio
  if (idx <= (program.currentStageIndex ?? 0)) return false;             // la actual y las pasadas, nunca
  return !!program.stages?.[idx]?.locked;
}
```

`idx <= currentStageIndex` da gratis "volver a una etapa ya hecha": si estuviste
ahí es porque estaba abierta. No hay que guardar historial de desbloqueos.

El entrenador nunca ve candados en sus propios programas (`slotId` nulo), así que
la misma pantalla sirve a los dos roles sin ramificar.

**Guarda en el store, no en las pantallas.** `setCurrentStage` y `advanceStage`
([useStore.js:1285](../../store/useStore.js) y :1306) hacen `return` temprano si
`isStageLocked`. Es el punto por el que pasan todos los llamantes (Home, editor,
banner de fin de etapa) — un guard, no cuatro.

### 2.1 El programa del entrenador no se edita en el móvil del cliente (sep 2026)

Misma regla, mismo predicado, un escalón más arriba: **`isTrainerProgram` es
ahora la base de `isStageLocked`** y de esconder el botón "Editar" de Home
([HomeScreen.jsx:875](../../src/screens/HomeScreen.jsx)).

```js
export function isTrainerProgram(program, clientSync) {
  if (!clientSync?.slotId) return false;                                  // no conectado
  return !!clientSync.trainerProgramIds?.includes(program?.id);           // y es SUYO
}
```

**Por qué.** Editar el programa del entrenador prometía algo que no ocurría:

1. **No sube.** El canal cliente→entrenador lleva historial y contadores de
   progreso, nunca la estructura del programa
   ([useStore.js:3611](../../store/useStore.js), `uploadHistoryToTrainer`).
2. **No dura.** La siguiente actualización del entrenador hace `importData` y
   reemplaza el programa entero — ver el [§12 de la auditoría](auditoria-tecnica.md#12).
3. **Y ensuciaba la lectura del entrenador**, que es lo peor de los tres: el
   historial que sube va etiquetado con los ids de plantilla **del entrenador**.
   Si el cliente reescribía la sesión A y la entrenaba, el entrenador leía "hizo
   la sesión A" sobre un plan que no era el ejecutado.

**Alcance.** Se esconde el botón, no se blinda la pantalla — misma filosofía de
barandilla que el resto del módulo. `SessionEditor` y `StagePlanner` solo se
alcanzan desde el editor de programa, así que cerrar la puerta cierra los tres.

**Lo que sigue permitido**, porque es progreso y no plan: avanzar de etapa,
registrar sesiones, `setCurrentStage`, sesión libre, añadir series, saltarse
ejercicios y añadir ejercicios ad-hoc durante el entreno.

**Lo que se pierde:** sustituir un ejercicio, que vivía solo en
`SessionEditorScreen`. Queda apuntado en
[README.md](README.md#pendientes-menores-sin-spec-definir-al-arrancar) moverla al
workout como **sustitución puntual de esa sesión** —reflejada en el historial y
sin tocar el programa—, que es donde debió estar siempre: adaptar es del momento
del entreno, no del plan.

**Probar en dispositivo.** Cliente conectado: en Inicio no aparece "Editar" y sí
"Ver programa"; entrenar, avanzar de etapa y añadir un ejercicio ad-hoc siguen
funcionando. Con un programa propio del mismo cliente, "Editar" vuelve a salir.

**Acota por programa, no por usuario.** Un cliente conectado puede tener
programas propios (de antes de conectarse, o plantillas suyas) y esos se siguen
editando. Por eso el predicado mira `trainerProgramIds` y no solo `slotId`.

**Cabo suelto conocido:** `trainerProgramIds` no existió siempre. En enlaces
antiguos la lista está vacía y ni el candado ni este bloqueo se aplican. Es el
mismo agujero que arrastran los candados desde el principio; el día que se tape,
se tapa para los dos (la subida de historial ya tiene su propio fallback,
`fallbackProgramId`, en [clientLogs.js:80](../../src/utils/clientLogs.js)).

## 3. Progreso: propiedad del cliente, replicado al entrenador

### 3.1 El modelo

El progreso **no se deriva del historial**. Se deriva bien mientras nadie borre
nada, pero rompe los puntos §0.7 y §0.8: si el progreso es una función del log,
borrar una entrada **es** retroceder de semana, y reinstalar sin historial es
volver a cero.

Es estado del cliente, incremental y monótono. Vive en su programa:

```js
program.currentStageIndex   // en qué etapa está — decisión suya (§0.4)
program.cycleCompletedIds   // plantillas hechas en la rotación abierta
program.stageWeeksCompleted // ciclos CERRADOS de la etapa actual   ← sustituye a stageSessionsCompleted
program.totalWeeksCompleted // ciclos cerrados en todo el programa
```

Y se replica al entrenador pegado al historial, que ya sube en cada
`saveSession`:

```js
// uploadHistory: { entries, customExercises }  →  + progress
{ entries, customExercises, progress: {
    currentStageIndex, cycleCompletedIds, stageWeeksCompleted, totalWeeksCompleted,
    updatedAt,
} }
```

`downloadHistory` ya tolera formas distintas del blob
([supabaseSync.js:165](../../src/services/supabaseSync.js)). El entrenador lo
guarda en `clients[clientId].progress` y **lo muestra tal cual**: no recalcula
nada, así que no puede discrepar. `computeCycleDoneIds`
([cycleProgress.js](../../../src/utils/cycleProgress.js)) deja de tener sentido y
se borra junto con su llamada en
[ClientsScreen.jsx:445](../../src/screens/ClientsScreen.jsx).

Desfase máximo: lo que el cliente lleve sin subir. La subida dispara en cada
sesión guardada y reintenta con `pendingUpload`. No hay otra fuente de verdad.

### 3.2 El bug del umbral

Hoy conviven tres contadores que miden cosas distintas y el fin de etapa usa el
equivocado ([useStore.js:1927-1941](../../store/useStore.js)):
`stageSessionsCompleted` suma **+1 por sesión guardada, repeticiones incluidas**,
y el umbral es `stageSessionsCompleted >= durationWeeks × días`. Repetir la
sesión A doce veces en una etapa de 4×3 la da por terminada sin haber hecho B ni
C, y pinta "semana 4 de 4"
([HomeScreen.jsx:109](../../src/screens/HomeScreen.jsx)) mientras
`totalWeeksCompleted` dice 0 semanas.

Arreglo mínimo — **una semana = una rotación completa**, la definición que
`cycleCompletedIds` y `totalWeeksCompleted` ya usaban:

```js
// saveSession, sustituyendo el bloque de stageSessionsCompleted
cycleIds.add(templateId);                       // Set: repetir no añade nada
const cycleClosed = cycleIds.size >= stageTplIds.size;
stageWeeksCompleted += cycleClosed ? 1 : 0;
stageAdvancePending = stageWeeksCompleted >= stage.durationWeeks && !esÚltima;
```

`stageSessionsCompleted` se borra del programa y de sus tres lectores
([HomeScreen.jsx:109](../../src/screens/HomeScreen.jsx),
[ClientsScreen.jsx:440](../../src/screens/ClientsScreen.jsx), los resets de
`setCurrentStage`/`advanceStage`). `weekInStage` pasa a ser
`stageWeeksCompleted + 1`.

**Nada de preguntar en el recap si una repetición cuenta.** Es una decisión
post-entreno sobre la aritmética del mesociclo del entrenador, y sería un "esta
sí cuenta" que solo existe en la respuesta del cliente — justo la
desincronización que §0.9 prohíbe. Si el entrenador quiere dos sesiones de
piernas por ciclo, duplica la sesión en el ciclo (ya se puede).

Contar plantillas distintas es seguro porque **un ciclo no puede repetir
plantilla**: toda vía de añadir un día genera un `tpl_*` nuevo
([useStore.js:1007](../../store/useStore.js), :1020, y `duplicateSessionInProgram`
:1065). Duplicar la sesión A produce una B que es copia de A, nunca un segundo A.

Consecuencias asumidas:

- Si el cliente nunca hace la sesión C, el ciclo no cierra y la etapa no termina.
  La salida es que el entrenador active la etapa siguiente (§6.3).
- Un guardado por error cuenta, y si era la sesión que cerraba el ciclo, el ciclo
  avanza. Repetirla después no vuelve a contar. La solución no es preguntar nada
  al guardar, sino un **"deshacer sesión"** (feature futura, fuera de esta spec):
  con el progreso en contadores (§3.1) deshacer es restar; con progreso derivado
  del log habría sido ambiguo.

## 4. Flujo del entrenador

**Autoría** — fila nueva en el `DragSheet` de etapa
([ProgramEditorScreen.jsx:618](../../src/screens/ProgramEditorScreen.jsx), junto a
"Estado"):

```
ACCESO
  ( ) Libre — el cliente entra cuando termina la anterior
  (•) Bloqueada — necesita que tú la abras
```
→ `updateStage(programId, idx, { locked })`. Etapa nueva: `locked` ausente (§0.2).

**Aviso y desbloqueo** — en `ActiveProgramHero`
([ClientsScreen.jsx:494](../../src/screens/ClientsScreen.jsx)), leyendo
`clients[cid].progress`:

| Estado del cliente | Qué ve el entrenador |
|---|---|
| Entrenando normal | Etapa N · semana X de Y (del blob, ya no de su copia local) |
| Terminó la etapa, no ha avanzado, siguiente libre | "Terminó *Acumulación* · sigue en ella" |
| Terminó la etapa, siguiente **bloqueada** | ⚠ ETAPA BLOQUEADA + `[ Desbloquear y enviar ]` |

La distinción entre "no ha avanzado porque no quiere / se lo dijiste tú" y "no
puede porque está bloqueada" sale de comparar `stageWeeksCompleted >=
durationWeeks` con `stages[idx+1].locked`. El botón hace
`updateStage(..., {locked:false})` + `uploadProgramToClient` en un toque;
arrastra cualquier edición pendiente de ese programa, que es el comportamiento
actual de "Enviar programa" y no se cambia.

Mismo aviso, en versión punto naranja, en la fila del cliente en la lista
([ClientsScreen.jsx:1293](../../src/screens/ClientsScreen.jsx)), junto al
indicador `showDirty` que ya existe.

## 5. Flujo del cliente

1. **Modal de etapas** (`StagePickerModal`,
   [HomeScreen.jsx:542](../../src/screens/HomeScreen.jsx)): las bloqueadas salen con
   candado, en `muted`, sin `TouchableOpacity` activo. Subtítulo "La abre tu
   entrenador".
2. **Editor de programas** (§0.5): mismo candado en `StageSelector`
   ([StageSelector.jsx](../../src/components/ui/StageSelector.jsx)) y el botón
   "Activar etapa" del sheet oculto para etapas bloqueadas. El guard de §2 en el
   store lo respalda aunque se cuele un camino nuevo.
3. **Fin de etapa**: donde hoy va el botón "Avanzar a X"
   ([HomeScreen.jsx:750](../../src/screens/HomeScreen.jsx)):

   > **ETAPA COMPLETADA**
   > Has terminado *Acumulación*. La siguiente, *Intensificación*, está
   > bloqueada — tu entrenador tiene que abrirla.
   > Mientras tanto puedes seguir entrenando esta etapa.
   > [ Entendido ]

4. **Al desbloquearse**: el pull (§6.1) trae el programa, el modal de
   actualización lo explica (§6.2) y al aplicarlo salta un `showToast` "Etapa
   Intensificación desbloqueada". El banner recupera su botón "Avanzar a X".

Esto es una barrera de UX, no de seguridad: un cliente decidido puede editar el
programa en su móvil. No se blinda.

## 6. Sincronización

### 6.1 Latencia

`checkAndPullProgramUpdates` solo corre al arrancar la app
([App.js:140](../../App.js)). Se añade un listener de `AppState` que lo repite al
volver a primer plano, con guarda de 60 s (`clientSync.lastPullAt`) para no
disparar en cada alt-tab. Coste: un `SELECT` de una fila por PK. Arregla también
la entrega de prescripciones, que hoy sufre lo mismo.

### 6.2 El modal de actualización

- `buildProgramDiff` ([useStore.js:133](../../store/useStore.js)) gana una línea
  "Etapa X desbloqueada" comparando los `locked` de las etapas, para que el
  cliente no vea un genérico "tu entrenador ha modificado el programa".
- **`ProgramUpdateModal` pierde el botón "Actualizar desde cero"**
  ([ProgramUpdateModal.jsx:60](../../src/components/ProgramUpdateModal.jsx)):
  resetea a semana 1 y etapa 0, que es exactamente lo que §0.4 prohíbe. Quedan
  "Actualizar" y "Ahora no".

### 6.3 Quién manda sobre la etapa activa

Hoy **la activación del entrenador no llega**: `applyPendingProgramUpdate(true)`
restaura el `currentStageIndex` del propio cliente por encima del entrante
([useStore.js:3098-3121](../../store/useStore.js)), y la rama `false` lo pone a 0.
En las dos se descarta lo que el entrenador activó. Además `setCurrentStage` en
el móvil del entrenador pone a 0 sus contadores
([useStore.js:1298](../../store/useStore.js)) y esos ceros viajan dentro del
`program_json`.

Reglas al importar un programa del entrenador:

1. Los campos de progreso del `program_json` entrante (`cycleCompletedIds`,
   `stageWeeksCompleted`, `totalWeeksCompleted`) **se ignoran siempre**. El
   progreso es del cliente (§3.1).
2. `currentStageIndex`: manda el del cliente **salvo que el entrenador haya
   activado una etapa a propósito**, y eso se sabe por un sello, no comparando
   índices: `setCurrentStage` escribe `program.stageActivatedAt` (ISO) y el
   cliente lo compara con `clientSync.lastAppliedStageActivation`. Si es nuevo,
   **salta a esa etapa como si hubiera terminado todo lo anterior**:
   `cycleCompletedIds` y `stageWeeksCompleted` a 0.

   El sello es necesario, no adorno: la copia del entrenador se queda atrás en
   cuanto el cliente avanza solo, así que devolverle a una etapa que el entrenador
   ya tenía marcada no cambia **ningún** índice, y comparando números eso parecía
   "no ha pasado nada". Ver §9.

   (Decisión explícita: no se guarda progreso por etapa. Si el entrenador devuelve
   al cliente a una etapa anterior, esa etapa empieza de cero.)

### 6.4 Reinstalar y reconectar

La reconexión ya descarga `history_json` (`mergeHistory` en `linkToTrainer`
[useStore.js:2997](../../store/useStore.js) y `confirmGoogleReconnect`
[:3263](../../store/useStore.js)), pero solo restaura las entradas. Como el blob
de progreso (§3.1) viaja dentro de ese mismo JSON, restaurarlo es leer un campo
más y escribirlo en el programa recién importado — **después** de `importData`,
para que gane sobre lo que traiga el `program_json` del entrenador.

Con `mergeHistory` desactivado el cliente empieza sin historial pero **con su
progreso**: coherente con §0.7 (el progreso no se lee del log).

## 7. Fases

| # | Alcance | Estado |
|---|---|---|
| 1 | `stageWeeksCompleted` sustituye a `stageSessionsCompleted` (§3.2) y sus 3 lectores | ✅ `0884d09` — `advanceCycle` en `src/utils/stageProgress.js` |
| 2 | Blob `progress` en el payload de historial; entrenador lo espeja; borrar `computeCycleDoneIds` (§3.1) + restore al reconectar (§6.4) | ✅ `8d63d9a` — 5 tests de invariante en la simulación de protocolo |
| 3 | Reglas de import (§6.3) + poda de `ProgramUpdateModal` (§6.2) | ✅ `e1a4d21` — `mergeProgressOnImport`, puro |
| 4 | `stage.locked` + `isStageLocked` + guards en el store + UI de autoría (§2, §4) | ✅ `src/utils/stageLocks.js`; guards en `setCurrentStage`/`advanceStage`; fila ACCESO en el sheet de etapa |
| 5 | UI cliente: candados en modal y editor, mensaje de etapa bloqueada (§5) | ✅ `43b9bab` — `LockIcon` dibujado a mano (no existe en Figma) |
| 6 | UI entrenador: los tres estados del hero + botón desbloquear (§4) | ✅ desbloquear+enviar en un toque, con revert si falla el envío |
| 7 | `AppState` pull (§6.1) + línea de diff "Etapa X desbloqueada" | ✅ throttle de 60 s en un ref de `App.js`, no en el store: la acción sigue haciendo lo que se le pide y el freno vive en el llamante ruidoso |

Las fases 1-3 son arreglos de bugs vivos y aportan solas; se pueden entregar
antes de tocar nada de bloqueos.

## 8. Casos límite

| Caso | Resultado esperado |
|---|---|
| Etapa 1 bloqueada | Imposible por §2 (`idx <= currentStageIndex`). El cliente nunca queda encerrado fuera del programa |
| Cliente repite la sesión A doce veces | La etapa **no** se da por terminada, ni en el cliente ni en el entrenador |
| Cliente borra entradas de su historial | El progreso **no retrocede** (es un contador, §3.1). Cliente y entrenador siguen coincidiendo |
| Cliente reinstala y reconecta | Vuelve a su etapa y su progreso (§6.4). El historial vuelve si acepta `mergeHistory` |
| Cliente termina la etapa y no avanza | El entrenador lo ve explícitamente ("sigue en ella"), distinto de "está bloqueada" (§4) |
| Cliente entrena sin cobertura | El entrenador ve el progreso de la última subida. Se reintenta con `pendingUpload` |
| Cliente hace sesiones libres | No cuentan para el ciclo. Ya funcionaba así |
| Cliente nunca hace la sesión C | El ciclo no cierra nunca. Salida: el entrenador activa la etapa siguiente (§6.3) |
| Última etapa terminada | No hay siguiente: ni banner de avance ni aviso de bloqueo |
| Entrenador desbloquea con ediciones a medias | Se envían también. Comportamiento actual de "Enviar programa" |
| Programa sin etapas | `isStageLocked` devuelve `false` siempre; el ciclo opera sobre `program.days` |

## 9. QA en dispositivo — ronda 1

Tres fallos, un origen común: en el móvil del entrenador,
`program.currentStageIndex` significa **"la etapa que yo he activado"**, no "donde
está el cliente". Solo se mueve cuando el entrenador la mueve, así que en cuanto
el cliente avanza por su cuenta, todo lo que lo leyera como posición del cliente
mentía. `clientStageIndex(client, program)` (en `stageProgress.js`) es ahora la
única forma correcta de preguntarlo desde ese lado.

| # | Síntoma | Causa | Arreglo |
|---|---|---|---|
| 1 | El cliente podía abrir la hoja de una etapa bloqueada desde el editor | El candado de `StageSelector` era decorativo: el `onPress` seguía vivo | `disabled={stage.locked}` en el segmento |
| 2 | "Preparar siguiente sesión" cargaba las sesiones de la etapa equivocada | `NextSessionScreen` leía `activeProgram.currentStageIndex` | Usa `clientStageIndex` |
| 3 | Volver a bloquear una etapa no hacía nada en el cliente | La etapa re-bloqueada era la que el cliente ya estaba entrenando, y `isStageLocked` nunca cierra la actual (§2) | El editor ya no ofrece bloquear la etapa activa del cliente, así que la acción imposible desaparece de la UI |

Dos fallos latentes cerrados de camino:

- **Activar la etapa en la que el cliente ya está le borraba las semanas.** Como
  la copia del entrenador se queda atrás, "activar la etapa 2" para alguien que ya
  está en la 2 entraba por la rama de salto de `mergeProgressOnImport` y reseteaba
  sus contadores. Ahora un `incomingStage` que coincide con el del cliente no
  cuenta como movimiento.
- **El control ACCESO aparecía en el móvil del cliente** para las etapas por
  delante de la suya — podía abrirse las suyas. Solo se muestra si el programa no
  viene de un entrenador.

`buildProgramDiff` anuncia también el re-bloqueo ("X bloqueada"), no solo el
desbloqueo.

**Asimetría deliberada**: desbloquear es un toque desde Clientes (abre y envía);
volver a bloquear se hace en el editor y necesita Guardar + Enviar, como cualquier
otra edición del programa. Bloquear no es urgente y no merece un camino propio.

### 9.1 El sello de activación (ronda 1, segunda tanda)

Mostrar en el editor la etapa REAL del cliente destapó que la regla de §6.3 no se
sostenía. Escenario: la copia del entrenador dice etapa 1, el cliente va por la 2.
El editor ahora marca "Etapa 2 ACTIVA", así que la etapa 1 ofrece **Activar esta
etapa**; el entrenador la pulsa para devolverle → `setCurrentStage` escribe el
índice 0, que es **el que ya había** → el cliente comparaba "índice entrante vs
último importado", 0 contra 0, y no se movía. Botón muerto y en silencio.

Deducir la intención de un diff de índices solo funciona mientras los dos lados
coinciden, y desde que el cliente puede avanzar solo, no coinciden casi nunca. La
intención pasa a ser explícita: `stageActivatedAt`.

Esto **no** es un bucle: `activeStageIdx` en el editor es un valor de pantalla, no
se escribe en el programa, así que la posición del cliente no genera ninguna
edición que subir.

### 9.2 Para qué sirve activar una etapa a mano

Es la única vía para: saltarse una etapa, repetir un bloque, sacar a alguien de un
ciclo que no cierra nunca (§8, "el cliente nunca hace la sesión C") y arreglar un
salto por accidente. Se queda.

Lo que **no** hace: cambiarle la etapa al cliente sin que se entere. Viaja dentro
del programa como cualquier otro cambio, así que el cliente ve el
`ProgramUpdateModal` y decide. Lo que faltaba era que el modal lo dijera — pasaba
como "Cambios menores en el programa" mientras por debajo le reiniciaba los
contadores de la etapa. Ahora `buildProgramDiff` abre con **"Tu entrenador te pasa
a {etapa}"**.

### 9.3 Repaso completo del circuito (Fable) + activar ⇒ desbloquear

Decisión nueva del usuario: **activar una etapa implica desbloquearla**.
`setCurrentStage` limpia `locked` en la etapa destino — un candado sobre la etapa
en la que ya estás solo puede confundir. En el móvil del cliente es un no-op (el
guard le impide llegar a una bloqueada).

Dos fallos encontrados en el repaso línea a línea, ambos del sello:

1. **El cliente también sellaba.** `setCurrentStage` es compartida: un cliente
   cambiando de etapa en su móvil escribía `stageActivatedAt` en su copia local,
   dándole al campo dos significados según el dispositivo — la misma ambigüedad
   que causó §9.1. Ahora solo sella el **autor** del programa (en el móvil del
   cliente, para un programa del entrenador, no se sella). El gate cubre también
   el caso entrenador-que-además-es-cliente.
2. **Reinstalar se tragaba una activación pendiente.** Si el entrenador movía al
   cliente mientras este tenía la app desinstalada, `_restoreFromSlot` restauraba
   el blob (posición vieja) sin mirar el sello y luego lo marcaba como aplicado.
   El blob ahora lleva `appliedActivation` (el sello bajo el que se calculó, leído
   de `clientSync`, no del programa) y la reconexión usa **la misma
   `mergeProgressOnImport` que una actualización en vivo**: el blob gana salvo
   sello más nuevo. Reconectar ya no tiene lógica propia.

Menor: `clientStageIndex` recorta al rango de etapas existente (el entrenador
puede borrar etapas por debajo de donde el blob dice que está el cliente); el
hero y la fila de Clientes pasan a usarla en vez de leer el blob a pelo.

Verificado sin cambios necesarios: `_buildProgramJson` y `reidProgramFile`
serializan el programa entero con spread (candados y sello viajan);
`addStageToProgram` y `duplicateStageInProgram` crean el objeto etapa desde cero
(las nuevas y las copias nacen desbloqueadas, §0.2); el revert de `unlockStage`
si falla el envío; los guards del store; el caso "el entrenador borra la etapa
donde estaba el cliente" (clamp en ambos lados).
