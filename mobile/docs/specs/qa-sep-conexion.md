# Spec — QA sep-2026: lo que no viaja entre cliente y entrenador

> Tema: conexión
> En corto: Cuatro arreglos de la ronda de QA del 22-sep-2026 en la conexión entrenador↔cliente: el RPE, las sesiones libres y el cambio de etapa no llegaban al entrenador; el aviso "sin revisar" no se apagaba al mirar; "subir cambios" salía sin cambios; y "Preparar sesión" abría siempre la A.
> Fase C15 · hecho · Un solo disparador de envío del cliente + fusión por id en el entrenador (bugs 2, 12, 14) · §3
> Fase C16 · hecho · "Sin revisar" se apaga al mirar y el aviso lleva al historial (bugs 5, 13) · §4
> Fase C17 · pendiente · "Cambios sin subir" solo cuando hay cambios (bug 11) · §5
> Fase C18 · pendiente · "Preparar sesión" abre la que toca (bug 4) · §6
>
> Estado: **spec cerrada, SIN implementar** (22-sep-2026). Diagnóstico hecho
> contra el código; cada fase dice el origen con fichero y línea. Las cuatro son
> independientes entre sí y pueden ir en paralelo, salvo que C16 debe ir **después**
> de C15 si se hacen en la misma rama (las dos tocan `downloadClientHistory`).
> Los bugs 8 (recap bajo los botones de Android) y 10 (historial del cliente con
> el segmentado de Progreso) quedan **fuera** por decisión del usuario.

## 0. Contexto para quien implemente

- La app vive en `mobile/`. Store Zustand en `mobile/store/useStore.js`, utils
  puros en `mobile/src/utils/`. Leer `mobile/AGENTS.md` antes de tocar pantallas.
- **Tests**: `npx vitest run` desde la **raíz del repo**. El store SÍ se puede
  probar: `mobile/store/useStore.test.js` enseña cómo (dobles de
  `supabaseSync`/`supabaseAuth`/`config/supabase` con `vi.mock`, e import
  dinámico del store después). Los tests de protocolo cliente↔entrenador viven en
  `mobile/src/utils/clientSync.sim.test.js`.
- **Lint**: `npx eslint <fichero>` y comparar el número de errores contra `HEAD`
  (hay errores previos; no añadir ninguno).
- i18n: toda cadena visible en `src/locales/es.json` y `en.json`, añadiendo
  líneas a mano (nunca reescribir el JSON con un volcado).
- **Regla de oro del progreso** (`stage-locks.md` §3.1): el progreso es un
  contador propiedad del cliente que el entrenador ESPEJA (`client.progress`), no
  se deriva del log. Nada de esta spec la cambia.
- Cambio grande pendiente que va DESPUÉS de esto: pasar de ciclos a semanas
  naturales. Por eso C18 enruta por `sessionPlan()` en vez de copiar la regla:
  cuando cambie el modelo, cambiará en un solo sitio.

## 1. Origen

QA en dispositivo del usuario, 22-sep-2026. Numeración de bugs de esa ronda:

| Bug | Síntoma | Fase |
|---|---|---|
| 2 | El RPE casi nunca llega del cliente al entrenador | C15 |
| 12 | Tras "Avanzar" de etapa en el cliente, el entrenador sigue viendo la vieja hasta la primera sesión | C15 |
| 14 | Las sesiones libres no se mandan al entrenador | C15 |
| 5 | Ver una sesión nueva del cliente sin pasar por el aviso sigue marcando "sin revisar" | C16 |
| 13 | Pulsar "sin revisar" debería ir a Historial y descargar | C16 |
| 11 | Editar el programa de un cliente sin cambiar nada siempre pide "subir cambios" | C17 |
| 4 | "Preparar sesión" siempre abre la sesión A | C18 |

## 2. Causa común de C15

Lo único que manda historial y progreso al entrenador es **una** llamada a
`uploadHistoryToTrainer()` al final de la rama de programa de `saveSession`
(`store/useStore.js`, ~l. 2328-2331). Todo lo que cambia fuera de ese instante no
viaja. Y en el lado del entrenador, `mergeClientLog` (`src/utils/clientLogs.js`
~l. 111) solo AÑADE ids nuevos: una copia corregida de una entrada que ya tiene se
descarta.

## 3. C15 — Un solo disparador de envío + fusión por id

### 3.1 Qué falla, bug a bug

- **Bug 2 (RPE)**, dos capas:
  1. El RPE se escribe en el recap con `setSessionFeedback` (~l. 2362),
     **después** del envío de `saveSession`, y no dispara otro.
  2. Aunque la sesión siguiente suba el log entero con el RPE dentro,
     `mergeClientLog` descarta la entrada porque el entrenador ya tiene ese id.
     Solo llega si el entrenador no descargó entre la sesión N y la N+1: "casi nunca".
- **Bug 12**: `advanceStage` (botón "Avanzar" del banner, `HomeScreen.jsx` ~l. 527)
  mueve los contadores en el móvil del cliente, pero el blob `progress` solo sube
  con el siguiente `saveSession`. Mismo caso: aplicar un programa del entrenador
  (`applyPendingProgramUpdate`), `setCurrentStage` desde Mi programa, o que el
  entrenador desbloquee y el cliente avance. Además, en el lado del entrenador la
  lista de clientes solo actualiza `client.progress` en `downloadClientHistory`,
  que no corre al abrir la lista (`refreshTrainerSlots` solo lee `sessions_count`).
- **Bug 14**: la rama `__free__` de `saveSession` hace `return` (~l. 2186) antes
  del final común. Se salta **tres** cosas: el envío al entrenador, la copia de
  Drive por sesión y `stopRestTimer()` — el temporizador de descanso **sigue
  corriendo** tras guardar una sesión libre.

### 3.2 Cambios

**a) Disparador único en el store (cliente).** Al final de `useStore.js`, junto al
`useStore.subscribe` que persiste `activeSession`, un segundo suscriptor:

```js
// Lo que el entrenador espeja del cliente —historial y progreso— sube cuando
// CAMBIA, no solo al guardar una sesión (docs/specs/qa-sep-conexion.md §3).
// ponytail: si la app muere dentro de la espera, lo cubre el siguiente cambio
// (sube el log entero) o el reintento de `pendingUpload` al volver a primer plano.
const UPLOAD_DEBOUNCE_MS = 2000;
let uploadTimer = null;
useStore.subscribe((s, prev) => {
  if (!s.clientSync?.slotId || !prev._hasHydrated) return;
  const pid = s.profile?.activeProgramId;
  const changed = s.workoutLog !== prev.workoutLog
    || pid !== prev.profile?.activeProgramId
    || s.clientSync.lastAppliedStageActivation !== prev.clientSync?.lastAppliedStageActivation
    || progressChanged(s.programs?.[pid], prev.programs?.[pid]);
  if (!changed) return;
  clearTimeout(uploadTimer);
  uploadTimer = setTimeout(() => {
    useStore.getState().uploadHistoryToTrainer().catch(() => {});
  }, UPLOAD_DEBOUNCE_MS);
});
```

- `progressChanged(a, b)`: compara los campos que lee `progressBlob`
  (`currentStageIndex`, `cycleCompletedIds`, `stageWeeksCompleted`,
  `totalWeeksCompleted`). Referencia para el array, valor para los números. Va en
  `src/utils/stageProgress.js` junto a `progressBlob`, exportada y con test.
- `!prev._hasHydrated`: la rehidratación cambia `workoutLog` de `[]` al persistido;
  sin este guard cada arranque subiría el log.
- En el móvil del entrenador `clientSync.slotId` es `null`: no hace nada.
- **Borrar** la llamada suelta de `saveSession` (~l. 2328-2331). Ahora la cubre
  el suscriptor.

**b) Reintento de un envío fallido.** Al principio de `checkAndPullProgramUpdates`
(corre al arrancar y al volver a primer plano): si `clientSync.pendingUpload`,
lanzar `get().uploadHistoryToTrainer().catch(() => {})`. Hoy `pendingUpload` solo
lo reintenta un botón manual de `AppHeader`.

**c) Final común de `saveSession`.** La rama libre deja de hacer `return`
temprano: las dos ramas construyen su `logEntry` y su `set(...)`, y comparten un
final con `stopRestTimer()` + copia de Drive por sesión + `return { ok: true, entryId }`.
Forma sugerida: una función local `finish(entryId)` dentro de `saveSession`,
llamada desde las dos ramas. No cambia nada más de la rama libre.

**d) Fusión por id en el entrenador.** `mergeClientLog(existing, incoming, { update = false } = {})`:

- Sin `update`: exactamente como hoy (lo usan las importaciones de fichero, que
  NO deben pisar la copia del entrenador).
- Con `update: true`: una entrada entrante cuyo id ya existe **sustituye** a la
  existente si su contenido difiere (`JSON.stringify` distinto). Las entradas que
  no vienen se conservan (la regla append-only de "el cliente borró y el
  entrenador lo guarda" no cambia).
- Sigue devolviendo **la misma referencia** si no hay nada nuevo ni cambiado (hay
  test que lo exige: evita re-render).
- `downloadClientHistory` (~l. 3324) la llama con `{ update: true }`. El cálculo
  de `newCount` no cambia.

**e) La lista del entrenador espeja el progreso sin descargar el historial.** En
`getTrainerSlots` (`src/services/supabaseSync.js` ~l. 341) añadir al `select` la
ruta JSON `progress:history_json->progress` (PostgREST la admite; el entrenador
ya lee `history_json` entero en `downloadHistory`, así que no cambia permisos).
En `refreshTrainerSlots` (~l. 3430), al copiar contadores del hueco:
`progress: slot.progress ?? next[clientId].progress`. Así la etapa que pinta la
lista sigue al cliente en cuanto él sube, sin abrir su ficha.

> ⚠️ Verificar (e) contra el Supabase real antes de dar la fase por cerrada: si
> la ruta JSON diera error, el `select` entero falla y la lista de clientes deja
> de refrescarse. Probarlo con un `console.log(slots[0])` en dispositivo.

### 3.2-bis Lo que cambió al implementar (23-sep-2026)

- El suscriptor tampoco sube en la transición que **crea** el vínculo
  (`slotId` pasa de `null` a un valor). Hoy vincularse no sube, y si lo hiciera,
  un cliente que rechazó fusionar su historial pisaría la copia del hueco con su
  log local nada más entrar.
- El `ponytail:` del suscriptor citaba el reintento de `pendingUpload` como red
  para "la app muere dentro de la espera". No lo es: ese flag solo se enciende
  cuando la subida falla, no mientras espera. Lo cubre el siguiente cambio.
  Encenderlo al programar la subida cerraría el hueco, pero hoy ese flag pinta
  el aviso de error de `AppHeader`.
- `progressChanged` compara también `id`, para que un programa que aparece o
  desaparece cuente como cambio.
- El filtro "Programa activo" del historial del cliente (lado entrenador,
  `ClientsScreen` `filteredLog`) incluye también las sesiones libres. Sin esto,
  el bug 14 seguía pareciendo abierto: la sesión libre llegaba al entrenador pero
  el filtro por defecto la escondía. El cliente solo sube las posteriores a
  vincularse, así que pertenecen a su etapa con el entrenador.
- `getTrainerSlots` con `progress:history_json->progress` verificado contra el
  Supabase real (23-sep): sin error, y el blob llega a la lista.

### 3.2-ter No soportado: el mismo móvil como entrenador y como su propio cliente

Visto en el QA de C15 (23-sep-2026). Si un móvil que ya tiene al cliente X como
entrenador se vincula como X, las sesiones del cliente **nunca suben**.
Reproducido con un test del store:

1. La copia del entrenador tiene el id `P` y dueño X. El programa llega con el
   mismo `P` y dueño `me`. `importData` (regla §3.4 bis) ve el choque y hace una
   copia con `reidProgramFile`: programa `P'` y plantillas nuevas.
2. `linkToTrainer` guarda `trainerProgramIds: [programJson.program.id]`, que es
   `P`, la copia del entrenador, no `P'`.
3. `scopeFilterForUpload` solo sube las sesiones de las plantillas de `P`. Las
   del cliente son de `P'` y se suben 0.
4. El blob de progreso lleva `programId: P'`, así que en el lado del entrenador
   `progressFromBlob` no lo adopta. Además, `_restoreFromSlot` escribe los
   contadores sobre `P`, la copia del entrenador.

Guardar el id efectivo al vincular solo arregla la primera subida: cada
actualización del programa (`applyPendingProgramUpdate`) vuelve a chocar y crea
otra copia. Soportarlo exige rediseñar a quién pertenece cada copia en un mismo
store. **Decisión del usuario: no soportado.** Con dos móviles no choca nada. Las
pruebas de conexión se hacen siempre con dos dispositivos.

### 3.3 Fuera de alcance

- Que el panel del entrenador anticipe la etapa que él mismo acaba de activar
  (antes de que el cliente abra la app). Se descartó por ahora: el modelo de
  progreso se reescribe con el cambio a semanas.
- Que un borrado local del entrenador en `clientLogs` resucite en la siguiente
  descarga: comportamiento previo, no lo cambia esta fase.

### 3.4 Tests

- `stageProgress.test.js`: `progressChanged` (igual → false; cambia cada uno de
  los cuatro campos → true; `undefined` vs programa → true).
- `clientLogs.test.js`: `mergeClientLog` con `update: true` sustituye una entrada
  con contenido distinto, conserva la referencia si todo es idéntico, conserva
  las ausentes; sin `update` el comportamiento de hoy (los tests actuales pasan
  sin tocarse).
- `clientSync.sim.test.js`: el simulador de descarga del entrenador (~l. 196) pasa
  a `{ update: true }` como el store. Test nuevo: el cliente sube la sesión, el
  entrenador descarga, el cliente añade `sessionRpe` y vuelve a subir, el
  entrenador descarga → la entrada del entrenador tiene el RPE.
- `useStore.test.js` con `vi.useFakeTimers()`:
  - cliente vinculado + `setSessionFeedback` → `uploadHistory` llamado **una vez**
    tras 2 s, aunque se llame tres veces seguidas (debounce);
  - `advanceStage` en cliente vinculado → `uploadHistory` con el blob nuevo;
  - `saveSession` de una sesión libre → `uploadHistory` llamado y
    `ui.restTimer.active === false`;
  - sin `clientSync.slotId` → nunca se llama.

**Probar en dispositivo.** Con cliente y entrenador vinculados: (1) terminar una
sesión en el cliente, poner RPE en el recap, esperar 3 s; en el entrenador tirar
para refrescar el historial → la sesión tiene el RPE. (2) Guardar una sesión libre
con el temporizador de descanso en marcha → el temporizador se para y la sesión
aparece en el entrenador. (3) En el cliente pulsar "Avanzar" en el banner de fin
de etapa; en el entrenador tirar para refrescar la lista → la tarjeta del cliente
muestra la etapa nueva sin que el cliente haya entrenado.

## 4. C16 — "Sin revisar" se apaga al mirar

### 4.1 Qué falla

- **Bug 5**, dos causas:
  1. Solo se marca como visto en `openClientHistoryTab` (`ClientsScreen.jsx`
     ~l. 2193), al que se llega por los atajos de la tarjeta. Entrar en el cliente
     tocando la tarjeta (`handleSelectClient`) y abrir la pestaña Historial o
     Progreso ni descarga ni marca.
  2. `markHistoryViewed` (`useStore.js` ~l. 3357) guarda como visto
     `remoteSessionsCount`, que solo se refresca en `refreshTrainerSlots` (al montar
     Clientes o al tirar de la lista). Suele estar desfasado: se marca visto un
     número viejo y, al refrescar la lista, el aviso **se vuelve a encender** por
     sesiones que ya viste.
- **Bug 13**: el aviso de la tarjeta llama a `onViewProgress`
  (`ClientsScreen.jsx` ~l. 1707 → ~l. 3244 → `handleSelectClientProgress`) y lleva
  a Progreso, no a Historial.

### 4.2 Cambios

1. `downloadClientHistory`: en el mismo `set` donde espeja `progress` (se ejecuta
   aunque no haya historial nuevo), escribir también
   `remoteSessionsCount: history.length`. Es el mismo número que `sessions_count`
   del servidor: los dos los escribe `uploadHistory` a partir de la misma lista.
2. En la ficha (`ClientsScreen`, componente principal): un `useEffect` sobre
   `[view, selectedClientId, activeTab]`. Si `view === 'detail'`:
   descargar (`downloadClientHistory`, solo si `syncSlotId`) y, **después** de la
   descarga y solo si terminó bien, si `activeTab` es `'history'` o `'progress'`,
   `markHistoryViewed(selectedClientId)`. Si falla, silencioso y el aviso se queda.
   Descargar al abrir la ficha en cualquier pestaña hace además que el hero de
   Programas enseñe la etapa real del cliente.
   `// ponytail: una descarga por cambio de pestaña; cachear por cliente si se nota.`
3. `openClientHistoryTab` pierde su bloque `async` (lo hace ya el efecto): se
   queda en poner la pestaña y la vista.
4. Bug 13: en la tarjeta de la lista, el aviso "sin revisar" pasa a
   `handleSelectClientHistory(client.id)`. Renombrar la prop `onViewProgress` →
   `onViewUnreviewed` (solo la usa ese aviso) para que el nombre diga lo que hace.
   La hoja de acciones (`ClientActionsSheet`, fila "Progreso") no cambia.

### 4.2-bis Lo que cambió al implementar (23-sep-2026)

- El efecto no descarga con el entrenador en modo `offline` (el mismo guard que
  usa la ficha para `syncEnabled`). Sin eso, cada apertura de ficha sin
  sincronización encendía `syncErrorAt` en el cliente.
- Si la pestaña cambia antes de que acabe la descarga, esa descarga ya no marca
  como visto (flag `cancelled` en la limpieza del efecto).

### 4.3 Tests

`useStore.test.js`: tras `downloadClientHistory` con 5 entradas y
`remoteSessionsCount` previo de 3, `markHistoryViewed` deja
`trainerSync.lastSeenSessionsCount[id] === 5`.

**Probar en dispositivo.** (1) El cliente entrena. En el entrenador, entrar al
cliente tocando la tarjeta (no el aviso), abrir Historial → volver a la lista y
tirar para refrescar → el aviso "sin revisar" NO vuelve. (2) Con una sesión nueva,
tocar el aviso "sin revisar" → abre la pestaña Historial ya con la sesión.

## 5. C17 — "Cambios sin subir" solo cuando hay cambios

### 5.1 Qué falla

`useEditorExit.commit()` (`src/hooks/useEditorExit.js` ~l. 30) llama a
`markProgramDirtyForClients` en **cada** salida del editor (chevron y check),
haya cambios o no. La foto para comparar (`beginEditSession`) ya no la llama
nadie. Caso contrario del mismo fallo: `StagePlannerScreen`, abierto desde la
ficha del cliente, **nunca** marca, así que las etapas añadidas ahí no se ofrecen
para subir.

### 5.2 Cambios

Que "sucio" signifique **lo que enviaría ahora ≠ lo último que envié**:

1. Util pura `programSignature(payload)` en `src/utils/programSignature.js`: hash
   corto (djb2 sobre `JSON.stringify`) del objeto que se sube, **sin**
   `exportDate`. Con test (mismo contenido → misma firma; cambia un ejercicio →
   distinta; cambia solo `exportDate` → igual).
2. Store, helper `_programSig(programId)`: `JSON.parse(get()._buildProgramJson(programId, false).json)`,
   quitar `exportDate`, `programSignature(...)`. `null` si el programa no existe.
3. `uploadProgramToClient` (~l. 3195): en el `set` que limpia `programDirty`,
   guardar también `programUploadedSig: get()._programSig(programId)`. La firma
   se calcula ANTES de sellar `trainerName` en las plantillas (el sello no es un
   cambio del programa).
4. `markProgramDirtyForClients` (~l. 705): para cada cliente con ese programa
   activo y `syncSlotId`, `programDirty = sig !== c.programUploadedSig`. Un cliente
   sin firma guardada (nunca subido) queda sucio, igual que hoy. Deshacer lo que se
   tocó deja el programa limpio.
5. `StagePlannerScreen`: `useEffect(() => () => markProgramDirtyForClients(programId), [programId])`,
   declarado **antes** del `return null` temprano (~l. 411).

`commit()` sigue llamando a `markProgramDirtyForClients` en cada salida: ahora es
seguro, porque la acción compara en vez de marcar a ciegas.

### 5.3 Tests

`useStore.test.js`: programa de cliente con `syncSlotId`; `uploadProgramToClient`
(con `uploadProgram` doblado) → `markProgramDirtyForClients` sin cambios deja
`programDirty === false`; tras `updateExerciseParams` → `true`; tras deshacer el
cambio → `false`.

**Probar en dispositivo.** Subir el programa a un cliente, abrir su editor, salir
con el check sin tocar nada → no aparece "subir cambios". Cambiar series de un
ejercicio y salir → sí aparece. Añadir una etapa desde "Planificar etapas" de la
ficha → aparece.

## 6. C18 — "Preparar sesión" abre la que toca

### 6.1 Qué falla

`NextSessionScreen.jsx` ~l. 88: la sesión elegida por defecto es
`templateIds[0]`, siempre la A. Además `ClientsScreen.jsx` ~l. 320-326 recalcula a
mano "la siguiente del ciclo", copiando la regla de `sessionPlan()`
(`src/utils/sessionPlan.js`).

### 6.2 Cambios

1. `NextSessionScreen`: el valor por defecto de `selectedId` es
   `sessionPlan({ days, cycleCompletedIds, t }).heroTemplateId`, con
   - `days` = los días de la etapa del cliente que ya calcula la pantalla,
     mapeados a `{ templateId, label }` (label de `getEffectiveTemplate`);
   - `cycleCompletedIds` = `progressFromBlob(client.progress, activeProgram.id)?.cycleCompletedIds ?? activeProgram.cycleCompletedIds`
     (el mismo respaldo que la tarjeta de `ClientsScreen`).
   Si `heroTemplateId` es `null`, se cae a `templateIds[0]`. El usuario puede
   seguir cambiando de sesión con el selector.
2. `ClientsScreen.jsx` ~l. 320-326: sustituir el `findIndex` a mano por
   `sessionPlan(...).heroTemplateId` con los mismos datos. El resto de la
   tarjeta (letra, nombre, stats) sale igual a partir de ese id.

Sin test nuevo: `sessionPlan` ya tiene los suyos.

**Probar en dispositivo.** Cliente que ha hecho A y B del ciclo en curso: en el
entrenador, "Preparar sesión" abre C, y la tarjeta del cliente dice que toca C.

## Fases

| Fase | Qué | Estado | Coste |
|---|---|---|---|
| C15 | Disparador único + reintento + final común de `saveSession` + fusión por id + progreso en la lista | ✅ `8f8de70` — progreso en la lista verificado en Supabase real; resto pendiente de probar en dispositivo (con dos móviles, §3.2-ter) | 🟡 medio: store + 3 utils + tests |
| C16 | Recuento fresco al descargar + efecto de la ficha + aviso → Historial | ✅ `b7646ec` — pendiente de probar en dispositivo | 🟢 |
| C17 | Firma de lo subido, `markProgramDirtyForClients` compara, StagePlanner marca | pendiente | 🟢 |
| C18 | `NextSession` y tarjeta por `sessionPlan()` | pendiente | 🟢 |
