# Spec — Auditoría técnica (agosto 2026)

> Estado: **🔍 DIAGNÓSTICO. Fallo 1 implementado** (ago 2026), 23 pendientes.
> Los arreglos se van aplicando de uno en uno; cada fallo resuelto lleva su
> bloque **Implementado** al final de la sección.
>
> Barrido de corrección sobre el móvil siguiendo el flujo real
> (`index.js → App.js → RootNavigator → screens → store → services → utils`) y
> las dos direcciones del protocolo entrenador↔cliente. No es una revisión de
> estilo: solo entran fallos que producen un comportamiento incorrecto, y cada
> uno lleva la condición exacta que lo dispara.
>
> **Alcance.** Todo lo de aquí afecta a la app móvil. `src/utils`, `src/data` y
> `src/locales` cuentan como código del móvil: Metro los resuelve vía
> `watchFolders` (`mobile/metro.config.js`) y el store los importa
> directamente. La app web (`src/store`, `src/components`, `src/hooks`) queda
> **fuera**: tiene los mismos bugs en su copia del store, y no se tocan.
>
> **Verificación.** `npx eslint <archivo>` (comparar el recuento contra HEAD) y
> `npx vitest run` desde la raíz. Los fallos con test propuesto lo indican.

## 0. Índice por severidad

| # | Severidad | Título | Archivo principal |
|---|-----------|--------|-------------------|
| [1](#1) | 🔴 Crítica | ✅ Pantalla negra permanente si falla la rehidratación | `store/useStore.js:3757` |
| [2](#2) | 🔴 Crítica | Restaurar un backup pierde los programas de clientes | `store/useStore.js:2555` |
| [3](#3) | 🟠 Alta | La copia programada a Drive no se ejecuta nunca | `store/useStore.js:2069` |
| [4](#4) | 🟠 Alta | El backup se guarda en SecureStore (límite 2048 B) | `store/useStore.js:2754` |
| [5](#5) | 🟠 Alta | Carrera en `refreshTrainerSlots` → clientes duplicados | `store/useStore.js:3049` |
| [6](#6) | 🟠 Alta | `getProgressionRecommendation` siempre devuelve `null` | `store/useStore.js:1891` |
| [7](#7) | 🟠 Alta | El código de cliente permite desalojar al cliente real | `supabase/secure_trainer_clients.sql` |
| [8](#8) | 🟠 Alta | `create-trainer-account` sin validación ni rate limit | `supabase/functions/create-trainer-account` |
| [9](#9) | 🟠 Alta | En iOS todo el mundo es Pro | `src/config/revenuecat.js:13` |
| [10](#10) | 🟡 Media | "Reemplazar plantillas" se degrada a "combinar" | `store/useStore.js:2583` |
| [11](#11) | 🟡 Media | Un `.fitdata` abre varios modales de importación | `src/components/AppHeader.jsx:597` |
| [12](#12) | 🟡 Media | Cancelar el editor revierte cambios ajenos | `src/screens/ProgramEditorScreen.jsx:126` |
| [13](#13) | 🟡 Media | Listar/restaurar backups no refresca el token | `src/screens/DriveBackupScreen.jsx:147` |
| [14](#14) | 🟡 Media | `advanceCycle` cierra ciclos antes de tiempo | `src/utils/stageProgress.js` |
| [15](#15) | 🟡 Media | Ejercicio duplicado en una sesión comparte estado | `store/useStore.js:943` |
| [16](#16) | 🟡 Media | `st.days.forEach` sin guard en 4 sitios | `store/useStore.js:345` |
| [17](#17) | 🟢 Baja | `drive_needs_reconnect` se escribe y nadie lo lee | `src/tasks/driveBackupTask.js:50` |
| [18](#18) | 🟢 Baja | `clearWorkoutLog` borra todo ante un scope desconocido | `store/useStore.js:2132` |
| [19](#19) | 🟢 Baja | El reintento de Drive re-ejecuta lo ya hecho | `store/useStore.js:2709` |
| [20](#20) | 🟢 Baja | Boundary multipart fijo en la subida a Drive | `src/services/driveService.js:34` |
| [21](#21) | 🟢 Baja | `dailySeries` sin cota superior de días | `src/utils/trainingLoad.js:339` |
| [22](#22) | 🟢 Baja | `ownerProgram` leído fuera de la suscripción | `src/screens/WorkoutScreen.jsx:390` |
| [23](#23) | 🟢 Baja | EMOM con `rounds: 0` produce índice `-1` | `src/utils/conditioningBlocks.js` |
| [24](#24) | 🟢 Baja | Semana de calendario con milisegundos fijos | `src/utils/weekProgress.js:20` |

Rutas relativas a `mobile/` salvo las que empiezan por `supabase/` o `src/utils/`
(estas últimas están en la raíz del repo, compartidas).

---

## 1. Pantalla negra permanente si falla la rehidratación 🔴 ✅ {#1}

**Dónde.** `store/useStore.js:3757` (`onRehydrateStorage`) y
`src/navigation/RootNavigator.jsx:130`.

**Por qué falla.** El callback empieza con `if (!state) return;`. Zustand lo
invoca como `postRehydrationCallback(undefined, error)` cuando la lectura del
storage falla — verificado en `node_modules/zustand/middleware.js:439`. Por ese
camino nunca se llega a la última línea:

```js
useStore.setState({ _hasHydrated: true, _initialRoute: initialRoute });
```

Y `RootNavigator` bloquea el render hasta que `_hasHydrated` sea `true`:

```js
if (!hasHydrated) return <View style={styles.hydrating} />;
```

Resultado: vista vacía indefinida, sin ningún camino de recuperación desde
dentro de la app.

**Qué lo dispara.** JSON persistido corrupto (escritura truncada por un kill del
SO a mitad de guardado), fallo de la base SQLite de AsyncStorage, o **cualquier
excepción dentro del propio callback** — que hoy no tiene `try`: `ensureStages`,
la migración de tags o la de colores lanzan si el estado guardado trae una forma
inesperada, y el resultado es idéntico.

**Reproducción.**
```js
await AsyncStorage.setItem('fc_tracker_v1', '{"state":{');
```
Relanzar la app. Pantalla del color de fondo, para siempre.

**Arreglo.** Que `_hasHydrated` se ponga a `true` pase lo que pase:

```js
onRehydrateStorage: () => (state, error) => {
  let initialRoute = 'Main';
  try {
    if (error) console.warn('[rehydrate] fallo al leer AsyncStorage:', error);
    if (state) {
      // … todas las migraciones actuales, sin cambios …
      const hasProgram     = state.profile?.activeProgramId && state.programs?.[state.profile.activeProgramId];
      const setupDone      = state.profile?.setupComplete;
      const onboardingDone = state.profile?.onboardingCompleted;
      if (!setupDone && !onboardingDone && !hasProgram)   initialRoute = 'Setup';
      else if (!onboardingDone && !hasProgram)            initialRoute = 'Onboarding';
      else if (state.activeSession?.templateId)           initialRoute = 'Workout';
    }
  } catch (e) {
    console.warn('[rehydrate] migración fallida, arrancando con lo que haya:', e);
  } finally {
    useStore.setState({ _hasHydrated: true, _initialRoute: initialRoute });
  }
}
```

Con `state` a `undefined` la app arranca en `Setup` con estado inicial, que es
recuperable; hoy no arranca.

**Test.** `store/useStore.test.js` nuevo: invocar el callback devuelto por
`onRehydrateStorage()` con `(undefined, new Error('boom'))` y comprobar que
`useStore.getState()._hasHydrated === true`.

### ✅ Implementado (ago 2026)

En `store/useStore.js:3757`. El cuerpo entero del callback pasa a `try /
catch / finally`; el `if (!state) return;` se mantiene tal cual — `finally`
corre igual — así que el diff sobre las migraciones es solo indentación.

Dos desviaciones respecto al arreglo propuesto arriba:

1. **La ruta se calcula sobre `useStore.getState()`, no sobre `state`.** El
   código propuesto dejaba `initialRoute = 'Main'` por defecto, lo que
   contradice su propio texto ("con `state` a `undefined` la app arranca en
   `Setup`"): tal cual, un arranque con storage ilegible habría caído en la
   pantalla principal vacía. Leyendo el store en vivo sale una sola rama para
   los tres casos — en el camino bueno `state === get()` (`middleware.js:431`),
   en el de lectura fallida el store tiene el estado inicial y enruta a `Setup`
   igual que una instalación nueva, y si lo que petó fue una migración tras un
   rehidratado correcto la ruta sale del estado ya cargado en vez de un
   fallback ciego.

2. **Se rescata el blob ilegible.** Al desbloquear el arranque con estado
   vacío, el primer `set()` sobrescribe lo que hubiera en `fc_tracker_v1`. Si
   estaba roto solo por un lado, se pierde la cartera de clientes de un
   entrenador sin posibilidad de rescate. Con `error` informado se copia el
   crudo a `fc_tracker_v1_corrupt` antes de que eso pase. Lleva comentario
   `ponytail:` en el código: depende de que AsyncStorage despache en orden de
   llamada (el `getItem` antes del `setItem` que dispara el `setState` del
   `finally`) — cierto en ambas plataformas por cola serie, pero no garantizado
   por contrato.

**Sin test.** Importar el store en vitest exige mockear `react-native`, seis
módulos de `expo-*`, notifee y supabase — más código de andamiaje que el
arreglo, y hoy no hay ni un test que importe el store. Verificado con
`npx eslint store/useStore.js` (15 errores, los mismos 15 que en HEAD) y
`npx vitest run` (44 archivos, 1902 tests, verde). Pendiente de comprobar en
dispositivo con la reproducción de arriba: debe abrir en `Setup`.

---

## 2. Restaurar un backup completo pierde los programas de clientes 🔴 {#2}

**Dónde.** `store/useStore.js:2555-2587` (`importData`), contra
`store/useStore.js:2325` (`exportFullBackup`) y `:2739` (`performDriveBackup`).

**Por qué falla.** La exportación escribe `programs: s.programs` **entero**,
incluidos los `mode: 'managed'` (el programa de cada cliente). La importación
no tiene ninguna rama que los acepte:

```js
if (sections.program) {
  Object.entries(allFilePrograms).forEach(([id, p]) => {
    if (p.mode === 'template' || p.mode === 'managed') return;   // ← descartados
    personalPrograms[id] = { ...p, mode: 'personal', status: 'active' };
  });
}
if (sections.templates) {
  Object.entries(allFilePrograms).forEach(([id, p]) => {
    if (p.mode !== 'template') return;                            // ← tampoco
    templatePrograms[id] = p;
  });
}
```

Mientras tanto `sections.clients` **sí** restaura `clients`, cuyos `programIds`
y `activeProgramId` apuntan a programas que ya no existen. La ficha del cliente
lee `programs[client.activeProgramId]` → `undefined` en toda la pantalla.

**Qué lo dispara.** Cualquier restauración de backup completo en el móvil del
entrenador, venga de archivo (`AppHeader`) o de Drive (`DriveBackupScreen:202`).

**Reproducción.** Entrenador con 3 clientes con programa asignado → Exportar
backup completo → borrar datos de la app → Importar con todas las secciones
activas. Los clientes vuelven, sus programas no.

**Arreglo.** Los programas `managed` viajan con sus clientes:

```js
if (sections.clients) {
  updates.clients = { ...s.clients, ...(data.clients ?? {}) };

  // Un programa managed es propiedad de un cliente: si el cliente entra, su
  // programa entra con él. Sin esto la ficha queda apuntando al vacío.
  const managed = Object.fromEntries(
    Object.entries(allFilePrograms).filter(([, p]) => p.mode === 'managed'),
  );
  updates.programs = { ...(updates.programs ?? s.programs), ...managed };

  if (data.clientLogs && Object.keys(data.clientLogs).length) {
    // … sin cambios …
  }
}
```

`needsTemplateData` ya incluye `sections.clients`, así que las
`sessionTemplates` de esos programas ya se importan. No hace falta tocarlo.

**Test.** `src/utils/clientPrograms.test.js` o uno nuevo de import/export:
construir un estado con 1 cliente + 1 programa managed, serializar con la misma
forma que `exportFullBackup`, pasar por `importData` con todas las secciones, y
comprobar que `programs[client.activeProgramId]` existe.

---

## 3. La copia programada a Drive no se ejecuta nunca 🟠 {#3}

**Dónde.** `store/useStore.js:2069` y `:2754`; `src/tasks/driveBackupTask.js:55`.

**Por qué falla.** Dos fallos encadenados.

1. La tarea de background lee el JSON del backup de SecureStore y aborta si no
   está:
   ```js
   const backupJson = await SecureStore.getItemAsync('drive_backup_json');
   if (!backupJson) return BackgroundFetch.BackgroundFetchResult.NoData;
   ```
   Esa clave **solo la escribe `performDriveBackup()`** (`:2754`). Y
   `performDriveBackup` solo se llama desde dos sitios: el botón manual
   (`DriveBackupScreen:171`) y `saveSession`, con una condición:
   ```js
   if (driveState.enabled && driveState.frequency === 'session') { … }
   ```
   Si el usuario elige "Diario", `setDriveFrequency` (`:2684`) escribe la config
   y registra la tarea, pero **nunca el JSON**. La clave no existe → la tarea
   devuelve `NoData` en cada ejecución, para siempre.

2. Aunque existiera (porque en algún momento hubo frecuencia `'session'` o se
   pulsó el botón), sería un snapshot congelado en ese instante: la copia
   "diaria" subiría los mismos datos viejos cada día.

**Reproducción.** Conectar Drive → frecuencia "Diario" → no tocar nada más →
esperar. Cero archivos nuevos en Drive.

**Arreglo.** Extraer la serialización a un helper y llamarlo en los tres puntos
donde el estado puede haber cambiado:

```js
/** Serializa el estado actual al formato de backup. Único sitio que lo define. */
_backupJson: () => {
  const s = get();
  return JSON.stringify({
    version: '2', exportType: 'full',
    exportDate: new Date().toISOString().split('T')[0],
    appName: 'Forma Fit',
    profile: s.profile, workoutLog: s.workoutLog, clientLogs: s.clientLogs ?? {},
    userPrograms: s.userPrograms, programs: s.programs,
    sessionTemplates: s.sessionTemplates, customExercises: s.customExercises,
    clients: s.clients ?? {},
  }, null, 2);
},

/** Deja el snapshot listo para que la tarea de background lo suba. */
_stageBackupForTask: async () => {
  if (!get().driveBackup.enabled) return;
  await writeBackupSnapshot(get()._backupJson());   // ver §4: fichero, no SecureStore
},
```

Llamarlo desde:
- `setDriveFrequency` — al pasar a diario/semanal/mensual;
- `connectDrive` — para que la primera ejecución tenga algo;
- `saveSession`, en la rama que hoy no hace nada:
  ```js
  const driveState = get().driveBackup;
  if (driveState.enabled) {
    if (driveState.frequency === 'session') get().performDriveBackup().catch(() => {});
    else                                    get()._stageBackupForTask().catch(() => {});
  }
  ```

`performDriveBackup` pasa a usar `get()._backupJson()` en lugar de repetir el
objeto (hoy está duplicado literal entre `:2328` y `:2739`).

---

## 4. El backup se guarda en SecureStore, que limita a 2048 bytes 🟠 {#4}

**Dónde.** `store/useStore.js:2754`.

**Por qué falla.**

```js
await SecureStore.setItemAsync('drive_backup_json', json);
```

`json` es el backup completo: programas, plantillas, historial entero y
`clientLogs`. Cientos de KB. `expo-secure-store` avisa y no garantiza el
guardado — verificado en `node_modules/expo-secure-store/build/SecureStore.js:158`:

> *Value being stored in SecureStore is larger than 2048 bytes and it may not be
> stored successfully. In a future SDK version, this call may throw an error.*

En Android el backend es SharedPreferences + AES; el valor puede no llegar a
persistirse. Y cuando Expo cumpla el aviso, esto pasará de fallo silencioso a
excepción.

**Reproducción.** Backup manual con cualquier historial → mirar la consola de
Metro.

**Arreglo.** El contenido no es un secreto — son exactamente los mismos bytes
que se suben a Drive. Va a fichero:

```js
// src/services/backupSnapshot.js
import * as FileSystem from 'expo-file-system/legacy';

const SNAPSHOT_URI = FileSystem.documentDirectory + 'drive_backup_snapshot.json';

export async function writeBackupSnapshot(json) {
  await FileSystem.writeAsStringAsync(SNAPSHOT_URI, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function readBackupSnapshot() {
  const info = await FileSystem.getInfoAsync(SNAPSHOT_URI);
  if (!info.exists) return null;
  return FileSystem.readAsStringAsync(SNAPSHOT_URI, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function deleteBackupSnapshot() {
  await FileSystem.deleteAsync(SNAPSHOT_URI, { idempotent: true });
}
```

- `performDriveBackup` y `_stageBackupForTask` (§3) escriben ahí.
- `driveBackupTask.js:55` lee de ahí.
- `disconnectDrive` (`:2672`) borra el fichero en lugar de la clave.

En SecureStore se quedan solo `drive_access_token`, `drive_refresh_token` y
`drive_backup_config`, que sí son pequeños y sí son secretos.

---

## 5. Carrera en `refreshTrainerSlots` → clientes locales duplicados 🟠 {#5}

**Dónde.** `store/useStore.js:3049-3096`.

**Por qué falla.** La función captura el estado **antes** de las dos esperas de
red:

```js
const { trainerSync, clients } = get();          // ← snapshot
await _ensureTrainerSession(trainerSync);        // ← red
const slots = await getTrainerSlots(...);        // ← red
…
const knownSlotIds = new Set(                    // ← calculado sobre el snapshot viejo
  Object.values(clients).map((c) => c.syncSlotId).filter(Boolean),
);
const missingSlots = slots.filter((s) => !knownSlotIds.has(s.id) && !s.disconnected_at);
if (missingSlots.length > 0) {
  set((s) => { … restored[generateId('client')] = { … } … });   // ← inserta
}
```

Dos invocaciones solapadas ven el mismo `clients` vacío y **ambas insertan**, con
`generateId` distintos, para el mismo `syncSlotId`. El duplicado no es cosmético:
las dos fichas apuntan al mismo slot, así que `uploadProgramToClient` desde una
pisa lo que envió la otra.

**Qué lo dispara.** Dos llamadas dentro de la ventana de red (~1-2 s). Hay dos
disparadores reales y ninguno se coordina con el otro:
- efecto de montaje: `src/screens/ClientsScreen.jsx:2062`;
- pull-to-refresh: `src/screens/ClientsScreen.jsx:2147`.

**Reproducción.** Reinstalar con slots vivos en el servidor → abrir la pestaña
Clientes y tirar del pull-to-refresh inmediatamente. Cada cliente aparece dos
veces.

**Arreglo.** Guard de reentrada + leer dentro del `set`, que sí es atómico:

```js
refreshTrainerSlots: async () => {
  const { trainerSync } = get();
  if (!trainerSync.userId) return;
  if (get()._refreshingSlots) return;            // ponytail: un flag, no una cola
  set({ _refreshingSlots: true });
  try {
    await _ensureTrainerSession(trainerSync);
    const slots = await getTrainerSlots(trainerSync.userId);

    set((s) => {
      const known = new Set(
        Object.values(s.clients).map((c) => c.syncSlotId).filter(Boolean),
      );
      const next = { ...s.clients };
      for (const slot of slots) {
        if (!known.has(slot.id) && !slot.disconnected_at) {
          const id = generateId('client');
          next[id] = { id, name: slot.client_name ?? 'Cliente', /* … */
                       syncCode: slot.client_code ?? null, syncSlotId: slot.id };
        }
      }
      // El refresco de contadores, en el MISMO set: dos writes separados
      // vuelven a abrir la ventana que estamos cerrando.
      for (const cid of Object.keys(next)) {
        const slot = slots.find((sl) => sl.id === next[cid].syncSlotId);
        if (slot) next[cid] = { ...next[cid],
          remoteSessionsCount: slot.sessions_count ?? 0,
          syncLinked:          !!slot.client_id };
      }
      return { clients: next };
    });
  } finally {
    set({ _refreshingSlots: false });
  }
},
```

`_refreshingSlots` fuera de `partialize` (como `_restInterval`).

**Nota de patrón.** `const {x} = get(); await …; set(…)` aparece en ~15 acciones
asíncronas del store. Esta es la única que hoy corrompe datos; el resto
(`uploadProgramToClient`, `downloadClientHistory`, `sendOverrides`) se salvan
porque escriben campos que nadie más toca en paralelo. Conviene adoptar la regla
general: **leer siempre dentro del updater de `set`**.

---

## 6. `getProgressionRecommendation` siempre devuelve `null` 🟠 {#6}

**Dónde.** `store/useStore.js:1891`.

**Por qué falla.** La firma real es
`getProgression(exConfig, def, lastSets, t)` (`src/utils/progression.js:407`).
La llamada pasa tres argumentos, todos desplazados:

```js
return getProgression(effectiveDef, lastExercise.sets, exConfig.sets);
//                    ↑ exConfig    ↑ def              ↑ lastSets (¡un número!)
```

`lastSets` recibe `exConfig.sets` (p. ej. `3`) y la primera línea de la función
es `if (!lastSets?.length) return null;` — un número no tiene `.length`, así que
devuelve `null` **siempre**. La función es efectivamente código muerto que
parece funcionar.

Añadido: `t` llega `undefined`. Si se arreglaran solo las posiciones, los
constructores de chip (`chipDouble`, `chipWeight`…) lanzarían `TypeError` al
invocar `t(...)`. Hay que arreglar las dos cosas a la vez.

La única llamada correcta del proyecto es
`src/components/workout/ExerciseCard.jsx:378`, que sí pasa los cuatro.

**Reproducción.**
```js
useStore.getState().getProgressionRecommendation(templateId, exerciseId)  // → null
```
con historial de sobra para ese ejercicio.

**Arreglo.**

```js
getProgressionRecommendation: (templateId, exerciseId) => {
  const { getEffectiveTemplate, exerciseLibrary, customExercises } = get();
  const template = getEffectiveTemplate(templateId);
  const exConfig = template?.exercises.find((e) => e.exerciseId === exerciseId);
  const baseDef  = exerciseLibrary[exerciseId] ?? customExercises[exerciseId];
  if (!template || !exConfig || !baseDef) return null;

  const effectiveDef = exConfig.progressionModel
    ? { ...baseDef, progressionModel: exConfig.progressionModel } : baseDef;

  const lastExercise = lastExerciseRef({
    workoutLog: get().workoutLog,
    program:    get().programs[template.programId],
    templateId, exConfig, getTemplate: getEffectiveTemplate,
  });
  if (!lastExercise) return null;

  return getProgression(exConfig, effectiveDef, lastExercise.sets, i18n.t.bind(i18n));
},
```

`i18n` ya está importado en el store (`store/useStore.js:52`).

**Test.** Ampliar `src/utils/progression.test.js` con un caso que llame a través
del store y espere un chip, no `null`.

---

## 7. El código de cliente permite desalojar al cliente real 🟠 {#7}

**Dónde.** `supabase/secure_trainer_clients.sql`, función `link_client_to_slot`.

**Por qué falla.** El `UPDATE` no mira quién ocupa el hueco:

```sql
update public.trainer_clients
   set client_id = auth.uid(),
       disconnected_at = null
 where client_code = upper(trim(p_code))
returning id into v_slot_id;
```

Cualquiera que conozca el código de 8 caracteres se vincula: obtiene el
`program_json` completo y, por la política `client_id = auth.uid()`, **el cliente
legítimo deja de poder subir su historial**. `uploadHistoryToTrainer`
(`store/useStore.js:3365`) falla en silencio y solo deja `pendingUpload: true`,
que el usuario lee como "problema de red".

El re-enlace está documentado como intencional (reinstalar, cambiar de móvil), y
`validateClientCode` (`:3120`) incluso devuelve `alreadyLinked`. Pero el servidor
no lo usa para nada: la decisión queda en manos del cliente que llama.

Añadido: `get_slot_by_code` devuelve `program_json`, `trainer_id` y `client_id`
a cualquier usuario autenticado que acierte un código, y no hay rate limiting
visible.

**Reproducción.** Cliente A conectado y entrenando. En otro dispositivo,
introducir el mismo código y confirmar. A queda desvinculado sin aviso de ningún
tipo; su historial ya no llega al entrenador.

**Arreglo.** Que el desalojo sea explícito, no un efecto colateral:

```sql
create or replace function public.link_client_to_slot(p_code text, p_takeover boolean default false)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_slot_id uuid; v_owner uuid;
begin
  select id, client_id into v_slot_id, v_owner
    from public.trainer_clients where client_code = upper(trim(p_code));

  if v_slot_id is null then raise exception 'Código no encontrado'; end if;

  -- Reconectarse uno mismo o entrar en un hueco libre: siempre permitido.
  -- Echar a OTRO cliente exige confirmación explícita desde la app.
  if v_owner is not null and v_owner <> auth.uid() and not p_takeover then
    raise exception 'SLOT_OCCUPIED';
  end if;

  update public.trainer_clients
     set client_id = auth.uid(), disconnected_at = null
   where id = v_slot_id;
  return v_slot_id;
end;
$$;
```

En el móvil, `linkClientToSlot` (`src/services/supabaseSync.js:198`) acepta el
flag, y `ClientCodeModal` ya tiene `alreadyLinked` para pedir la confirmación
antes de reenviar con `p_takeover: true`. Complementario: rate limiting sobre
`get_slot_by_code`.

---

## 8. `create-trainer-account` sin validación ni rate limit 🟠 {#8}

**Dónde.** `supabase/functions/create-trainer-account/index.ts:22-24`.

**Por qué falla.** Cuatro problemas en tres líneas:

```ts
Deno.serve(async (req) => {
  const { code } = await req.json()                        // sin try → 500 con body inválido
  const email = `trainer-${code.toLowerCase()…}`           // TypeError si code no es string
  const { data, error } = await supabase.auth.admin.createUser({
    email, password: code, email_confirm: true,            // contraseña = código
  })
```

1. `await req.json()` fuera de cualquier `try` → petición sin body ⇒ excepción
   no controlada ⇒ 500.
2. `code.toLowerCase()` sin comprobar tipo → `{"code": 123}` o `{}` ⇒ `TypeError`.
3. Sin validación de formato ni rate limit: la anon key es extraíble del APK, así
   que cualquiera puede crear usuarios en `auth.users` en masa con
   `email_confirm: true`.
4. `password: code`, y `recoverWithTrainerCode`
   (`src/services/supabaseAuth.js:106`) entra con ese mismo código.
   **Conocer el código de entrenador = acceso total a la cuenta y a los datos de
   todos sus clientes.** El código se persiste en claro: `trainerSync.code` está
   dentro de `partialize` (`store/useStore.js:3753`) y por tanto en AsyncStorage.

**Arreglo (función).**

```ts
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => null);
    const code = body?.code;
    if (typeof code !== 'string' || !CODE_RE.test(code)) {
      return new Response(JSON.stringify({ error: 'Código inválido' }), { status: 400 });
    }
    const email = `trainer-${code.toLowerCase().replace(/-/g, '')}@noreply.fuerzacontrol.com`;
    const { data, error } = await supabase.auth.admin.createUser({
      email, password: code, email_confirm: true,
    });
    if (error) {
      if (error.message.includes('already')) {
        return new Response(JSON.stringify({ exists: true }), { status: 200 });
      }
      // No devolver error.message al cliente: filtra detalle interno.
      console.error('[create-trainer-account]', error);
      return new Response(JSON.stringify({ error: 'No se pudo crear la cuenta' }), { status: 400 });
    }
    return new Response(JSON.stringify({ userId: data.user.id }), { status: 200 });
  } catch (e) {
    console.error('[create-trainer-account]', e);
    return new Response(JSON.stringify({ error: 'Petición inválida' }), { status: 400 });
  }
});
```

`delete-account/index.ts` ya tiene esta forma (try + `json()` helper); esta
función se quedó atrás.

**Arreglo (almacenamiento del código).** Sacar `trainerSync.code` de
`partialize` y guardarlo en `expo-secure-store`, que es donde ya viven los
tokens de Drive. `_ensureTrainerSession` (`:66`) y `unlinkFromTrainer` (`:3445`)
son los dos únicos consumidores; pasan a leerlo con `await`.

**Ámbito.** Ambos arreglos son de superficie. La decisión de fondo —"la
contraseña es el código que el usuario ve y comparte"— es de diseño y no se
toca aquí.

---

## 9. En iOS todo el mundo es Pro 🟠 {#9}

**Dónde.** `src/config/revenuecat.js:13`, `App.js:163-175`,
`store/useStore.js:107` y `:3655`.

**Por qué falla.** La clave de iOS es un marcador de posición:

```js
export const RC_IOS_API_KEY = 'YOUR_IOS_API_KEY';
```

`App.js` la usa tal cual y se traga cualquier fallo:

```js
const apiKey = Platform.OS === 'ios' ? RC_IOS_API_KEY : RC_ANDROID_API_KEY;
Purchases.configure({ apiKey });
checkProStatus();
```

Y `checkProStatus` deja `isPro` intacto si algo falla:

```js
catch { return get().profile.isPro; }   // ← no llama a set()
```

El valor intacto es el de `INITIAL_PROFILE`, que es **`isPro: true`**
(`:107`). Encadenado: en iOS `getCustomerInfo()` nunca resuelve con una clave
inválida ⇒ `isPro` se queda en `true` ⇒ todas las funciones Pro abiertas.

iOS es un objetivo real: `app.json` tiene `bundleIdentifier`,
`usesAppleSignIn: true`, y hay flujo de Sign in with Apple implementado
(`src/services/appleAuth.js`).

**Reproducción.** Build de iOS, instalación limpia, sin comprar nada → las
pestañas Clientes y Plantillas están disponibles.

**Arreglo.** Dos partes, las dos necesarias:

1. Rellenar `RC_IOS_API_KEY` con la Public SDK key de iOS de RevenueCat.
2. Que un fallo de comprobación **no** conceda Pro. El default seguro es `false`,
   y la clave sin configurar se detecta antes de configurar:

```js
// App.js
const apiKey = Platform.OS === 'ios' ? RC_IOS_API_KEY : RC_ANDROID_API_KEY;
if (!apiKey || apiKey.startsWith('YOUR_')) {
  console.warn('[RC] clave sin configurar para', Platform.OS);
  return;                       // isPro se queda como esté; no se finge Pro
}
```

```js
// store/useStore.js — INITIAL_PROFILE
isPro: false,
```

Con `isPro: false` de partida, Expo Go y los builds sin módulo nativo dejan de
ser Pro por accidente. Para desarrollo ya existe la vía explícita:
`EXPO_PUBLIC_FORCE_PRO=true`, que `mobile/eas.json` activa en el perfil
`preview`.

---

## 10. "Reemplazar plantillas" se degrada a "combinar" 🟡 {#10}

**Dónde.** `store/useStore.js:2565` y `:2583`.

**Por qué falla.** La rama de programas asigna `updates.programs` primero:

```js
if (sections.program) {
  updates.programs = { ...(updates.programs ?? s.programs), ...personalPrograms };
}
```

y la de plantillas usa `nonTemplates` (el conjunto sin plantillas antiguas) solo
si `updates.programs` **no existía**:

```js
if (mode === 'replace') {
  const nonTemplates = { … };                                   // se calcula
  updates.programs = { ...(updates.programs ?? nonTemplates), ...templatePrograms };
  //                     ↑ ya existe → nonTemplates se descarta
}
```

El "reemplazar" se convierte en "combinar" sin decir nada.

**Qué lo dispara.** Un backup con programas y plantillas, ambas secciones
activas —que es el **estado por defecto** de `ImportModal`
(`src/components/ImportModal.jsx:258-266`)— y el usuario eligiendo "Reemplazar".

**Reproducción.** Tener 3 plantillas → importar un backup que trae 1, secciones
por defecto, modo Reemplazar → quedan 4.

**Arreglo.** Decidir el conjunto base una sola vez, antes de las ramas:

```js
set((s) => {
  const updates = {};
  const replacingTemplates = sections.templates && (sections.templatesMode ?? 'merge') === 'replace';
  // El "reemplazar" de plantillas define sobre qué se construye TODO el mapa de
  // programas; decidirlo dentro de una rama lo hace depender del orden.
  const basePrograms = replacingTemplates
    ? Object.fromEntries(Object.entries(s.programs ?? {}).filter(([, p]) => p.mode !== 'template'))
    : s.programs;

  if (sections.program)  updates.programs = { ...(updates.programs ?? basePrograms), ...personalPrograms };
  if (sections.templates) updates.programs = { ...(updates.programs ?? basePrograms), ...templatePrograms };
  // … resto igual …
});
```

Compatible con el arreglo de §2: la rama `sections.clients` usa el mismo
`basePrograms`.

---

## 11. Un `.fitdata` abre varios modales de importación 🟡 {#11}

**Dónde.** `src/components/AppHeader.jsx:597-608`.

**Por qué falla.** `AppHeader` está montado en cinco pantallas —`HomeScreen:676`,
`HistoryScreen:526`, `StatsScreen:40`, `ProgramScreen:403` y `:427`,
`ClientsScreen:2300`, `:2335`, `:2377`, `:2903`— todas dentro del Tab navigator,
que **mantiene montadas** las pestañas ya visitadas. El efecto corre en cada
instancia:

```js
useEffect(() => {
  if (!pendingExternalImport) return;
  const { rawContent, fileName } = pendingExternalImport;
  clearPendingExternalImport();                    // no llega a tiempo
  setImportState({ fileName, parsedData: parsed.data });   // estado LOCAL de esta instancia
}, [pendingExternalImport]);
```

`clearPendingExternalImport()` no cancela los efectos ya encolados del mismo
commit: todos leyeron el mismo valor capturado. Cada instancia abre su propio
modal, con su propio `importState`.

**Reproducción.** Home → Historial → Clientes → abrir un `.fitdata` desde el
explorador. Al cerrar el modal aparece otro debajo, uno por pestaña montada.

**Arreglo.** El modal es global: sube a `RootNavigator`, donde ya vive `<Toast />`
por la misma razón. `AppHeader` conserva `handlePickFile` (el modal desde el
menú, que sí es local a una interacción) y pierde el efecto de
`pendingExternalImport`.

```jsx
// src/navigation/RootNavigator.jsx
      </Stack.Navigator>
      <Toast />
      <ExternalImportModal />   {/* nuevo: consume pendingExternalImport, una sola instancia */}
    </View>
```

Efecto secundario: hoy también hay cinco `setInterval` de reloj simultáneos
(`AppHeader.jsx:582`), uno por instancia, repintando cada 10 s. Ese sigue
existiendo — es aceptable, pero conviene saberlo.

---

## 12. Cancelar el editor de programa revierte cambios ajenos 🟡 {#12}

**Dónde.** `src/screens/ProgramEditorScreen.jsx:126-138` y
`store/useStore.js:751-756`.

**Por qué falla.** El snapshot es global y la restauración también:

```js
beginEditSession: () => {
  const { programs, sessionTemplates, userPrograms } = get();
  set({ _editSnapshot: JSON.parse(JSON.stringify({ programs, sessionTemplates, userPrograms })) });
},
```

```js
function restoreSnapshot() {
  useStore.setState({
    programs: snapshot.programs,          // ← TODOS los programas
    sessionTemplates: snapshot.sessionTemplates,
    userPrograms: snapshot.userPrograms,
  });
}
```

Cualquier escritura sobre **otro** programa ocurrida mientras el editor estaba
abierto se pierde al cancelar.

**Qué lo dispara.** Una escritura concurrente sobre `programs`. La ruta real:
`App.js:150` lanza `checkAndPullProgramUpdates()` cada vez que la app vuelve a
primer plano; si el usuario acepta la actualización, `applyPendingProgramUpdate`
(`store/useStore.js:3316`) escribe `programs` **y** avanza
`clientSync.lastProgramImportedAt`. Al cancelar el editor, el programa vuelve
atrás pero el timestamp no: `checkAndPullProgramUpdates` ya no volverá a ofrecer
esa actualización nunca.

**Reproducción.** Abrir el editor → minimizar → volver → aceptar la actualización
del entrenador → volver al editor → Cancelar. El programa queda en la versión
vieja y la actualización no se vuelve a ofrecer.

**Arreglo.** Acotar el snapshot al programa que se edita:

```js
beginEditSession: (programId) => {
  const { programs, userPrograms } = get();
  set({
    _editSnapshot: {
      programId,
      program:      structuredClone(programs[programId]),
      // Las sesiones editadas viven aquí y solo las toca este editor.
      userPrograms: structuredClone(userPrograms),
    },
  });
},
```

```js
function restoreSnapshot() {
  const snap = useStore.getState()._editSnapshot;
  if (snap) {
    useStore.setState((s) => ({
      programs:     { ...s.programs, [snap.programId]: snap.program },
      userPrograms: snap.userPrograms,
      _editSnapshot: null,
    }));
  }
  useStore.setState((s) => ({ ui: { ...s.ui, _editingProgramId: null } }));
}
```

`hasUnsavedChanges` (`:141`) ya compara solo `programs[editingId]` y
`userPrograms`, así que se adapta con un cambio de ruta (`snap.program` en vez
de `snap.programs[editingId]`).

Beneficio adicional: `beginEditSession` deja de hacer un
`JSON.parse(JSON.stringify(...))` de **todos** los programas, plantillas y
sesiones editadas en cada apertura del editor — un bloqueo del hilo JS
proporcional al tamaño de la base del entrenador.

`bulk-edit.md` §5 y §16 documentan este circuito y hay que actualizarlos.

---

## 13. Listar y restaurar backups no refresca el token expirado 🟡 {#13}

**Dónde.** `src/screens/DriveBackupScreen.jsx:147` (`loadFiles`) y `:200`
(`handleRestoreFile`).

**Por qué falla.** Los dos leen el token a pelo, saltándose `_withDriveToken`
(`store/useStore.js:2703`), que es el único punto del proyecto que refresca en
401:

```js
const token = await SecureStore.getItemAsync('drive_access_token');
const data  = await downloadBackup(token, file.id);
```

Los access tokens de Google caducan en ~1 h. Y si el token es `null`, se envía
literalmente `Bearer null`.

Peor aún, `loadFiles` traga el error:

```js
catch { setFiles([]); }
```

así que la pantalla dice "no hay copias" cuando en realidad hay 30 y el token
está caducado.

**Reproducción.** Conectar Drive → esperar una hora → pestaña "Copias" → lista
vacía.

**Arreglo.** Exponer las dos operaciones como acciones del store, dentro de
`_withDriveToken`:

```js
listDriveBackups: async () => get()._withDriveToken(async (token) => {
  const folderId = get().driveBackup.folderId ?? await findOrCreateFolder(token);
  return listBackups(token, folderId);
}),

downloadDriveBackup: async (fileId) =>
  get()._withDriveToken((token) => downloadBackup(token, fileId)),
```

y que la pantalla distinga "sin copias" de "no se pudo consultar" — si el error
es `'Token expirado'`, mostrar el aviso de reconexión que ya existe para
`needsReconnect`, no una lista vacía.

---

## 14. `advanceCycle` cierra ciclos antes de tiempo 🟡 {#14}

**Dónde.** `src/utils/stageProgress.js`, funciones `advanceCycle` y
`mergeProgressOnImport`.

**Por qué falla.** El cierre se decide comparando **tamaños**, no pertenencia:

```js
const cycleIds = new Set(program.cycleCompletedIds ?? []);
cycleIds.add(templateId);
const cycleClosed = cycleIds.size >= new Set(cycleTplIds).size;
```

`mergeProgressOnImport` conserva `kept.cycleCompletedIds` cuando no hay salto de
etapa. Si el entrenador reestructura la etapa activa, los `tpl_*` guardados ya no
pertenecen al ciclo, pero siguen contando para el tamaño.

El comentario de cabecera del módulo afirma que *"un ciclo nunca puede contener
la misma plantilla dos veces… así que las comparaciones de `size` son exactas"*.
Eso es cierto **dentro** de un ciclo; no cubre ids sobrevivientes de otro.

**Reproducción (confianza ~65%).** Cliente con etapa A/B/C, registra A y B
(`cycleCompletedIds = [A, B]`). El entrenador sustituye las 3 sesiones por 5
nuevas y publica sin mover `stageActivatedAt` (una edición normal, que por diseño
no debe mover a nadie de etapa). El cliente registra 3 de las 5 →
`cycleIds = {A, B, X, Y, Z}` → `5 >= 5` → semana cerrada habiendo hecho 3 de 5.

**Arreglo.** Intersectar antes de contar:

```js
export function advanceCycle(program, templateId, cycleTplIds, { durationWeeks, isLastStage = false } = {}) {
  const valid = new Set(cycleTplIds);
  // Filtrado, no confiado: `cycleCompletedIds` sobrevive a los reajustes de
  // etapa del entrenador, y un id que ya no está en el ciclo no puede cerrarlo.
  const cycleIds = new Set((program.cycleCompletedIds ?? []).filter((id) => valid.has(id)));
  cycleIds.add(templateId);
  const cycleClosed = cycleIds.size >= valid.size;
  // … resto igual …
}
```

**Test.** `src/utils/stageProgress.test.js`: `cycleCompletedIds: ['tpl_viejo_a',
'tpl_viejo_b']` con `cycleTplIds: ['x','y','z','w','v']`, registrar `x` → el
ciclo NO debe cerrarse.

---

## 15. Un ejercicio duplicado en la misma sesión comparte estado 🟡 {#15}

**Dónde.** `store/useStore.js:943` (`addExercise`), `:1538` (`startSession`),
`src/screens/ExerciseSelectorScreen.jsx`.

**Por qué falla.** `setsState` está indexado por `exerciseId`, no por posición:

```js
template.exercises.forEach(({ exerciseId, sets }) => {
  setsState[exerciseId] = Array.from({ length: sets }, () => ({ … }));
});
```

`addExercise` no comprueba duplicados, y el selector tampoco filtra lo que ya
está en la sesión — el comentario de `ExerciseSelectorScreen.jsx:16` confirma que
el filtro por patrón se eliminó. Con dos instancias del mismo ejercicio:

- comparten series y estado "hecho";
- `activeSetIndex` (`WorkoutScreen.jsx:677`) marca las dos a la vez;
- `removeExercise` (`:837`) borra las dos (`filter` por `exerciseId`);
- `updateExerciseParams` (`:758`) edita las dos;
- `saveSession` escribe dos entradas idénticas en el log;
- React recibe `key` duplicada en `ExerciseCard` (`WorkoutScreen.jsx:661`).

**Reproducción.** Editor de sesión → añadir "Press banca" dos veces → entrenar.

**Arreglo inmediato (el barato).** Rechazar el duplicado donde se crea:

```js
addExercise: (templateId, exerciseId) => {
  const template = get().getEffectiveTemplate(templateId);
  const exDef = get().exerciseLibrary[exerciseId] ?? get().customExercises[exerciseId];
  if (!template || !exDef) return;
  // ponytail: se rechaza en vez de soportarse. `setsState` va indexado por
  // exerciseId; dos instancias comparten series, "hecho" y borrado. Si algún día
  // hacen falta (circuitos), la salida es `instanceId`, no relajar esto.
  if (template.exercises.some((ex) => ex.exerciseId === exerciseId)) {
    get().showToast(i18n.t('editor.exerciseAlreadyInSession'), 2200, 'neutral');
    return;
  }
  // … resto igual …
}
```

Con la clave nueva en `src/locales/{es,en}.json`.

**Arreglo de fondo (fuera de alcance).** Dar `instanceId` a cada `exConfig` y
reindexar `setsState`, `exerciseNotes`, `blockState` y el puntero de serie activa
por él. Es la deuda estructural más cara del móvil: bloquea circuitos y
supersets con repetición, y cada consumidor nuevo de `setsState[exerciseId]`
encarece el cambio.

---

## 16. `st.days.forEach` sin guard en cuatro sitios 🟡 {#16}

**Dónde.** `store/useStore.js:345` (`archiveProgram`), `:501` (`deleteClient`),
`:2371` (`exportProgramWithLog`), `:2438` (`_buildProgramJson`).

**Por qué falla.** El resto del proyecto usa `(st.days ?? [])` —
`src/utils/clientLogs.js:17`, `src/utils/exerciseLinks.js` — pero estos cuatro
acceden directo:

```js
program.stages.forEach((st) => st.days.forEach((d) => templateIds.add(d.sessionTemplateId)));
```

Una etapa sin `days` produce
`TypeError: Cannot read property 'forEach' of undefined`.

**Qué lo dispara.** `stage.days === undefined`. Llega por `updateStage(programId,
idx, updates)` (`:1302`), que acepta un patch arbitrario, o desde un
`program_json` generado por una versión distinta de la app.

**Arreglo.** Reutilizar el helper que ya existe y hace lo correcto, en vez de
repetir el recorrido cuatro veces:

```js
import { programTemplateIds } from '../../src/utils/clientLogs';

// archiveProgram
const templateIds = programTemplateIds(program);        // Set<string>, con los ?? dentro

// _buildProgramJson / exportProgramWithLog
const tplIds = programTemplateIds(program);
```

`programTemplateIds` ya cubre las dos formas (con y sin `stages`), así que
desaparecen también los cuatro `if (program.stages?.length > 0) … else …`.

---

## 17. `drive_needs_reconnect` se escribe y nadie lo lee 🟢 {#17}

**Dónde.** `src/tasks/driveBackupTask.js:50`.

```js
await SecureStore.setItemAsync('drive_needs_reconnect', 'true');
```

`grep` sobre todo el proyecto: **cero lectores**. El aviso que la tarea pretende
dar nunca llega al usuario; `driveBackup.needsReconnect` solo lo pone el camino
en primer plano (`store/useStore.js:2706`, `:2716`, `:2724`).

**Arreglo.** O leerla al montar `DriveBackupScreen` y volcarla al store, o
borrar la escritura. Dado que §3 hará que la tarea sí se ejecute, leerla:

```js
useEffect(() => {
  SecureStore.getItemAsync('drive_needs_reconnect').then((v) => {
    if (v === 'true') {
      useStore.setState((s) => ({ driveBackup: { ...s.driveBackup, needsReconnect: true } }));
      SecureStore.deleteItemAsync('drive_needs_reconnect');
    }
  });
}, []);
```

---

## 18. `clearWorkoutLog` borra todo ante un scope desconocido 🟢 {#18}

**Dónde.** `store/useStore.js:2132`.

```js
clearWorkoutLog: (scope) => {
  let keep = [];                          // ← el default es "no conservar nada"
  if (scope === 'off_program') { … keep = … }
  const removed = workoutLog.length - keep.length;
  if (removed > 0) set({ workoutLog: keep });
```

Cualquier scope que no sea `'off_program'` —un typo, `undefined`, un id nuevo
añadido más adelante— borra el historial completo. Es una operación destructiva
sin deshacer. Hoy los callers (`src/screens/HistoryScreen.jsx:434`) pasan valores
correctos; el riesgo es el próximo caller.

**Arreglo.**

```js
clearWorkoutLog: (scope) => {
  if (scope !== 'all' && scope !== 'off_program') return 0;   // scope desconocido: no borrar
  // … resto igual …
}
```

---

## 19. El reintento de Drive re-ejecuta lo ya hecho 🟢 {#19}

**Dónde.** `store/useStore.js:2709-2722` (`_withDriveToken`).

En un 401 se reintenta `fn` **entera**. Si el 401 llegó en `pruneOldBackups`
después de que `uploadBackup` ya hubiera subido el archivo, se sube dos veces.

Además la detección va por substring del mensaje:

```js
if (!e?.message?.includes('401')) throw e;
```

acoplada al formato exacto de `src/services/driveService.js` (`Drive GET error
401`, `Upload error 401`). Cualquier reformulación del mensaje rompe el refresco
en silencio.

**Arreglo.** Propagar el código numérico:

```js
// driveService.js
if (!res.ok) {
  const err = new Error(`Drive GET error ${res.status}`);
  err.status = res.status;
  throw err;
}
```
```js
// useStore.js
if (e?.status !== 401) throw e;
```

La doble subida es aceptable (`pruneOldBackups` limpia), pero conviene dejarlo
anotado con un `ponytail:` en `performDriveBackup`.

---

## 20. Boundary multipart fijo en la subida a Drive 🟢 {#20}

**Dónde.** `src/services/driveService.js:34`.

```js
const boundary = 'fc_backup_bound';
```

El cuerpo incluye texto libre del usuario: nombres de programa, notas de sesión,
notas por ejercicio, nombres y notas de cliente. Si alguien escribe
`--fc_backup_bound` en una nota, la petición multipart se corrompe.

**Arreglo.**

```js
const boundary = 'fc_' + Math.random().toString(36).slice(2);
```

---

## 21. `dailySeries` sin cota superior de días 🟢 {#21}

**Dónde.** `src/utils/trainingLoad.js:339`.

```js
const cursor = new Date(startOfDay(loads[0].timestamp));
while (cursor.getTime() <= last) { … cursor.setDate(cursor.getDate() + 1); }
```

Un punto por día de calendario desde la primera sesión. Una entrada importada
con `timestamp: 0` (o cualquier valor corrupto) genera ~20 700 puntos, y todo lo
encadenado después —`rollingMean`, `monotony`, `weeklySeries`, `indexTo100`—
recorre esa serie. La pantalla de Estadísticas se congela.

**Arreglo.** Acotar el inicio y validar en la entrada:

```js
const MAX_SERIES_DAYS = 730;   // 2 años: más allá, la gráfica no dice nada
const first = Math.max(
  startOfDay(loads[0].timestamp),
  startOfDay(now - MAX_SERIES_DAYS * 86400000),
);
const cursor = new Date(first);
```

Complementario: filtrar timestamps imposibles en `importData` (`< 2015` o
futuros).

---

## 22. `ownerProgram` leído fuera de la suscripción del store 🟢 {#22}

**Dónde.** `src/screens/WorkoutScreen.jsx:390`.

```js
const ownerProgram = template?.programId ? useStore.getState().programs[template.programId] : null;
```

`getState()` no es reactivo. Si el programa cambia mientras la pantalla de
entreno está abierta —`checkAndPullProgramUpdates` corre al volver a primer
plano— las referencias de ejercicios vinculados (`lastExerciseRef`) quedan
obsoletas hasta que la pantalla se remonte.

**Arreglo.**

```js
const ownerProgram = useStore((s) => (template?.programId ? s.programs[template.programId] : null));
```

Ojo: el hook debe llamarse incondicionalmente (el ternario va dentro del
selector, no fuera), y `template` se deriva antes en el render, así que el orden
de hooks se mantiene estable.

---

## 23. EMOM con `rounds: 0` produce índice `-1` 🟢 {#23}

**Dónde.** `src/utils/conditioningBlocks.js`, `emomTotalIntervals` y
`emomPosition`.

```js
const rounds = block.rounds ?? 1;     // `0` NO es nullish → total = 0
```

Con `total === 0`, `emomPosition` calcula `totalSec = 0`, entra siempre en la
rama de terminado y devuelve `{ interval: total - 1 }` = `-1`. Después,
`currentMovement(block, -1)` hace `movements[-1 % len]` → `movements[-1]` →
`undefined`, y el consumidor lee `.exerciseId` de `undefined`.

**Depende de** si `BlockEditorInline` permite bajar el stepper de rondas a 0 —
hay que comprobarlo. El arreglo es barato en cualquier caso.

**Arreglo.**

```js
export function emomTotalIntervals(block) {
  const rounds = Math.max(1, block.rounds ?? 1);   // un EMOM de 0 rondas no existe
  const moves  = block.movements?.length ?? 0;
  if (block.emomMode === 'all' || moves <= 1) return rounds;
  return rounds * moves;
}
```

---

## 24. Semana de calendario con milisegundos fijos 🟢 {#24}

**Dónde.** `src/utils/weekProgress.js:20`.

```js
const monday = today - ((new Date(today).getDay() + 6) % 7) * DAY_MS;
```

Restar múltiplos fijos de 86 400 000 ms cruza los cambios de hora. En Europa y
EE. UU. el cambio es a las 02:00 de un domingo, así que ninguna medianoche de la
semana lo atraviesa y **hoy no falla**. En zonas donde el cambio es a medianoche
(Brasil histórico, Chile, Lord Howe) la semana entera se desalinea y ningún día
coincide con `startOfDay(e.timestamp)`: la tira semanal muestra todo sin entrenar.

**Posible problema (confianza 40 %** de que afecte a usuarios reales, según dónde
se distribuya la app**).**

`src/utils/trainingLoad.js:338` ya usa el patrón correcto y explica por qué en un
comentario. Aplicar el mismo aquí:

```js
function startOfWeek(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // setDate respeta el cambio de hora
  return d.getTime();
}

export function getWeekStatuses(workoutLog, now = Date.now()) {
  const today  = startOfDay(now);
  const monday = startOfWeek(now);
  const trainedDays = new Set(workoutLog.map((e) => startOfDay(e.timestamp)));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const date = d.getTime();
    // … resto igual …
  });
}
```

`src/utils/adherence.js:16` ya lo hace bien; solo `weekProgress` se quedó atrás.

---

## 25. Orden de trabajo sugerido

Agrupado por lo que se toca, no por severidad, para que cada tanda sea un PR
verificable:

| Tanda | Fallos | Superficie |
|-------|--------|-----------|
| **A — arranque y datos** | ✅ [1](#1), [2](#2), [10](#10) | `store/useStore.js` (`onRehydrateStorage`, `importData`) |
| **B — Drive** | [3](#3), [4](#4), [13](#13), [17](#17), [19](#19), [20](#20) | store + `driveBackupTask` + `driveService` + `DriveBackupScreen` |
| **C — sincronización** | [5](#5), [7](#7), [8](#8) | store + SQL + Edge Function |
| **D — monetización** | [9](#9) | `config/revenuecat.js`, `App.js`, `INITIAL_PROFILE` |
| **E — lógica de entreno** | [6](#6), [14](#14), [15](#15), [23](#23) | `src/utils/*` + store, todo con test |
| **F — UI y limpieza** | [11](#11), [12](#12), [16](#16), [18](#18), [21](#21), [22](#22), [24](#24) | pantallas + guards |

La tanda A es la que hay que hacer antes de publicar: [1](#1) deja la app
inservible y [2](#2) destruye datos del entrenador en la operación que
precisamente existe para no perderlos.

## 26. Lo que NO entra en esta spec

Cosas que aparecieron en la auditoría y se dejan fuera a propósito:

1. **La app web** (`src/store`, `src/components`, `src/hooks`). Tiene su propia
   copia del store con el mismo fallo de [§6](#6) (`src/hooks/useWorkout.js:65`,
   `src/store/useStore.js:1456`). No se usa.
2. **El diseño "la contraseña del entrenador es su código"**. [§8](#8) arregla la
   validación y el almacenamiento en claro, no el modelo.
3. **`setsState` indexado por `exerciseId`**. [§15](#15) pone un guard; la
   reindexación por instancia es un cambio de modelo con su propia spec.
4. **Los cinco `AppHeader` montados a la vez.** [§11](#11) arregla el modal
   duplicado, que es el bug; los cinco relojes de 10 s son coste asumido.
5. **La duplicación entre `exportFullBackup` y `performDriveBackup`.** [§3](#3)
   la elimina de paso al extraer `_backupJson`, pero no es el objetivo.
