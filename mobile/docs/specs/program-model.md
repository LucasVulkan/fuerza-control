# Spec — Modelo de programas: un dueño, un diccionario, sin espejo

> Estado: **NO IMPLEMENTADA** (sep 2026). Tres fases **independientes**, cada una
> desplegable por su cuenta y en este orden. Origen: el §6.1 de
> [rediseno.md](rediseno.md), extraído a documento propio porque —a diferencia de
> las fases 1 y 2 de aquella— **esto sí toca pantallas**.
>
> **Ventaja de partida, y es la razón de hacerlo ahora:** la app no está
> publicada. La migración de estado persistido se escribe una vez, se ejecuta en
> tu dispositivo de pruebas y se puede borrar antes de publicar. Con usuarios
> reales, cada una de estas tres fases cuesta el triple.
>
> **Depende de** la fase 1 de [rediseno.md](rediseno.md) sólo por comodidad: sin
> la app web hay una copia menos del store que tocar. Si no se ha hecho, esta
> spec **ignora `src/store/useStore.js`** igual que hace la auditoría.
>
> **Verificación:** `npx vitest run` desde la raíz y `npx eslint <fichero>`
> comparando el recuento contra HEAD. Los tests que cambian están listados en
> cada fase; `src/utils/clientSync.sim.test.js` (647 líneas, simula el protocolo
> entrenador↔cliente entero) es el que más avisa si algo se rompe.

---

## 1. El diagnóstico: un solo hecho guardado en cuatro sitios

"De quién es este programa" está escrito en cuatro lugares que nadie obliga a
estar de acuerdo:

| Dónde | Qué afirma |
|---|---|
| `program.mode` (`personal` / `managed` / `template`) | de quién es **y** para qué sirve, mezclados |
| `program.clientId` | de qué cliente, cuando `mode === 'managed'` |
| `client.programIds[]` + `client.activeProgramId` | qué programas tiene el cliente |
| `profile.activeProgramId` + `profile.secondaryProgramIds[]` | cuáles son los míos |

Ninguno es la autoridad. **El invariante lo sostiene quien lee**, y eso se ve en
el código, no en la teoría:

1. **La misma pregunta, con dos campos.**
   [useStore.js:693](../../store/useStore.js) —
   `existing.mode === 'managed' && existing.clientId === clientId`. Dos campos
   para responder "¿este programa es de este cliente?".

2. **Una acción que se roba un programa, contenida por un filtro de UI.**
   `restoreProgram` pone `mode: 'personal'` sin mirar de quién era
   ([useStore.js:437](../../store/useStore.js)). Lo único que impide que un
   programa de cliente pase por ahí es el `.filter((p) => … p.mode !== 'managed')`
   del modal que lo lista ([AppHeader.jsx:226](../../src/components/AppHeader.jsx)).
   La regla vive en la pantalla, no en el dato.

3. **Lectores que se defienden solos.**
   `(selectedClient.programIds ?? []).map((id) => programs[id]).filter(Boolean)`
   ([ClientsScreen.jsx:2013](../../src/screens/ClientsScreen.jsx)). El
   `filter(Boolean)` existe porque la lista puede contener ids de programas que
   ya no existen. Es cierto: pueden.

4. **Una fuga real y sin techo.**
   `removeSessionFromProgram` borra la sesión de **los dos** diccionarios
   ([useStore.js:1169](../../store/useStore.js)). `deleteProgram`
   ([useStore.js:447](../../store/useStore.js)) y `deleteClient`
   ([useStore.js:543](../../store/useStore.js)) **no borran ninguno**, ni quitan
   el id de `client.programIds`. Cada programa o cliente borrado deja sus `tpl_*`
   huérfanos para siempre en el estado persistido **y en cada `.fitdata`**. Tres
   caminos para la misma operación, uno correcto.

5. **`importData` es la factura completa.** Sus cuatro ramas
   ([useStore.js:2584](../../store/useStore.js)) existen sólo porque un
   diccionario plano mezcla tres clases de programa, y cada rama tiene que
   reescribir el `mode` de lo que deja entrar (`{ ...p, mode: 'personal' }`) para
   que no se cuele en la de al lado.

6. **`profile.secondaryProgramIds` está muerto.** Declarado en
   [useStore.js:124](../../store/useStore.js) y en ningún otro sitio del repo.

Y hay un quinto sitio que no es de propiedad pero sí de la misma familia:
`program.days` es un **espejo desnormalizado** de
`stages[currentStageIndex].days`, sostenido por un helper (`withStages`) que
existe únicamente para que el espejo no derive —y cuyo propio comentario dice
que seis escrituras se lo saltaban.

---

## 2. El modelo objetivo

### 2.1 Los campos

| Antes | Después | Por qué |
|---|---|---|
| `program.mode: 'personal'\|'managed'\|'template'` | `program.owner: 'me' \| <clientId>`<br>`program.kind: 'program' \| 'template'` | `mode` mezclaba dos ejes ortogonales: **de quién es** y **para qué sirve**. Una plantilla del entrenador es suya (`owner: 'me'`) y es plantilla (`kind: 'template'`) |
| `program.clientId` | — | lo dice `owner` |
| `client.programIds[]` | — (derivado) | `Object.values(programs).filter(p => p.owner === clientId)` |
| `profile.secondaryProgramIds[]` | — (borrado) | muerto |
| `program.status: 'active'\|'archived'` | igual | es un eje propio y correcto |
| `client.activeProgramId` | igual | es una **elección**, no una relación: no se puede derivar |
| `profile.activeProgramId` | igual | ídem |
| `sessionTemplates{}` + `userPrograms{}` | `sessions{}` | fase 2 |
| `program.days` (espejo) | — | fase 3 |

### 2.2 Los invariantes, ahora enunciables

1. Un programa tiene **exactamente un** `owner`. Cambiar de dueño es una
   operación explícita, no un efecto secundario de restaurar o importar.
2. La lista de programas de un cliente **se calcula**, no se guarda. No puede
   contener ids muertos porque no contiene ids.
3. Borrar un programa borra sus sesiones y —si se pide— sus entradas de log.
   **Una sola función**, de la que cuelgan los tres caminos de borrado.
4. `client.activeProgramId` sólo puede apuntar a un programa cuyo `owner` sea ese
   cliente. Lo garantiza el borrado único, que lo limpia.

### 2.3 Los selectores derivados

Nuevo fichero `mobile/src/utils/programOwnership.js` — puro, testeable, y el
sustituto de `src/utils/clientPrograms.js`, que **se borra**:

```js
/** Programas de un dueño ('me' o un clientId), sin plantillas. Recientes primero. */
export function programsOf(programs, owner) {
  return Object.values(programs ?? {})
    .filter((p) => p.owner === owner && p.kind !== 'template')
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** La biblioteca de plantillas del entrenador. */
export function templatesOf(programs) {
  return Object.values(programs ?? {}).filter((p) => p.kind === 'template');
}

/** Los no activos de un dueño — lo que la ficha enseña bajo "Anteriores". */
export function archivedOf(programs, owner, activeProgramId) {
  return programsOf(programs, owner).filter((p) => p.id !== activeProgramId);
}
```

`assignActiveProgram` sobrevive, pero adelgaza: ya no mantiene ninguna lista.

```js
export function assignActiveProgram(client, programId) {
  return { ...client, activeProgramId: programId, programDirty: true };
}
```

**Cambio de orden, y es el único visible:** `client.programIds` guardaba orden de
inserción (el más nuevo delante); la lista derivada ordena por `createdAt` desc.
`ClientsScreen` ya reordenaba por `createdAt` desc antes de pintar
([ClientsScreen.jsx:2014](../../src/screens/ClientsScreen.jsx)), así que **no
cambia nada en pantalla**. Si algún día se quisiera un orden manual, sería un
campo propio (`sortIndex`), no un efecto de la estructura.

---

## 3. Fase 1 — `owner` + `kind` sustituyen a `mode`, `clientId` y las listas

### 3.1 Migración del estado persistido

En el bloque de migraciones de `onRehydrateStorage`
([useStore.js:3902](../../store/useStore.js)), junto a las de etapas, tags y
colores. **Idempotente**, como las demás:

```js
// programIds sigue existiendo AQUÍ, y es la autoridad de reserva: un programa
// con `mode:'managed'` y sin `clientId` (los hubo) sólo se puede atribuir por
// la lista de su cliente.
const ownerByProgram = {};
Object.values(state.clients ?? {}).forEach((c) => {
  (c.programIds ?? []).forEach((pid) => { ownerByProgram[pid] ??= c.id; });
});

Object.values(state.programs ?? {}).forEach((p) => {
  if (p.owner) return;                                  // ya migrado
  p.owner = p.clientId ?? ownerByProgram[p.id] ?? 'me';
  p.kind  = p.mode === 'template' ? 'template' : 'program';
  delete p.mode;
  delete p.clientId;
});

Object.values(state.clients ?? {}).forEach((c) => { delete c.programIds; });
delete state.profile?.secondaryProgramIds;
```

**Dos desviaciones que son arreglos, no regresiones**, y conviene saberlas antes
de ver el resultado en el dispositivo:

- Un programa con `clientId` que **no** estaba en `programIds` de ese cliente
  hoy es invisible en su ficha; después aparece. Era la fuga del punto 3 de §1.
- Un id en `programIds` sin programa detrás desaparece sin dejar rastro, en vez
  de ser filtrado por cada lector.

### 3.2 Migración del formato de fichero (`.fitdata` v3)

El `.fitdata` es el formato canónico: lo escriben la exportación, la copia a
Drive y el protocolo con el cliente. Cambia la forma de `program`, así que
**sube a `version: '3'`** y hay que poder leer los v1/v2 que ya existen (tu
propio [fc-seed-carga.fitdata](../../../fc-seed-carga.fitdata) y cualquier
backup de pruebas).

**Escritura** — `_buildProgramJson` ([useStore.js:2477](../../store/useStore.js))
y `buildBackupPayload` ([src/utils/backupPayload.js:28](../../../src/utils/backupPayload.js))
suben a `'3'`. `_buildProgramJson` ya normaliza lo que envía
(`{ ...program, mode: 'personal', status: 'active' }`) para que el cliente no
reciba un programa marcado como de otro; pasa a `owner: 'me', kind: 'program'`.
El cliente recibe siempre un programa suyo — **`owner` es semántica del
dispositivo, no una identidad global**, y esa es la propiedad que hace que el
protocolo no necesite ningún cambio más.

**Lectura** — un solo normalizador, en el único sitio por el que entran los
programas de fuera, donde ya vive `ensureStages`
([useStore.js:2588](../../store/useStore.js)):

```js
function normalizeIncomingProgram(p) {
  const staged = ensureStages(p);
  if (staged.owner) return staged;                  // v3
  const { mode, clientId, ...rest } = staged;       // v1 / v2
  return {
    ...rest,
    owner: clientId ?? 'me',
    kind:  mode === 'template' ? 'template' : 'program',
  };
}
```

**Las tres copias del validador de versión.** `parseImportFile` está duplicado
literalmente en [AppHeader.jsx:58](../../src/components/AppHeader.jsx),
[ClientsScreen.jsx:70](../../src/screens/ClientsScreen.jsx) y
[OnboardingScreen.jsx:93](../../src/screens/OnboardingScreen.jsx), las tres con
`['1', '2']` a mano. Esta fase las obliga a cambiar a la vez, así que **se
extraen a `mobile/src/utils/importFile.js`** y las tres pantallas la importan.
Es el momento barato de hacerlo: cambiar tres copias es el trabajo, extraerlas
es gratis.

### 3.3 `importData`, después

Las tres secciones siguen siendo tres porque son **tres casillas que ve el
usuario** (Programa / Plantillas / Clientes). Lo que desaparece es que cada rama
reescriba el `mode` de lo que deja pasar para que no se cuele en la de al lado:

```js
const filePrograms = Object.fromEntries(
  Object.entries({ ...(data.programs ?? {}), ...(data.program ? { [data.program.id]: data.program } : {}) })
    .map(([id, p]) => [id, normalizeIncomingProgram(p)]),
);
const mine      = (p) => p.owner === 'me' && p.kind !== 'template';
const templates = (p) => p.kind === 'template';
const clients   = (p) => p.owner !== 'me';
```

Tres predicados de un campo, mutuamente excluyentes por construcción. Hoy no lo
son: un programa puede satisfacer dos ramas y la última en escribir gana — es
exactamente la forma del fallo 10 de la auditoría ("reemplazar plantillas" se
degradaba a "combinar").

### 3.4 El borrado único

Cierra la fuga del punto 4 de §1. Un helper privado del store, y los tres
caminos cuelgan de él:

```js
/** Devuelve el trozo de estado con el programa, sus sesiones y (opcional) su log fuera. */
function purgeProgram(s, programId, { deleteHistory = false } = {}) {
  const program = s.programs[programId];
  if (!program) return {};
  const tplIds = new Set(programTemplateIds(program));   // ya existe, recorre TODAS las etapas

  const programs = { ...s.programs };  delete programs[programId];
  const sessions = { ...s.sessions };  tplIds.forEach((id) => delete sessions[id]);

  const ownerId  = program.owner;
  const isMine   = ownerId === 'me';
  const clientLog = !isMine ? s.clientLogs[ownerId] : null;

  return {
    programs,
    sessions,
    ...(deleteHistory && isMine
      ? { workoutLog: s.workoutLog.filter((e) => !tplIds.has(e.sessionTemplateId)) } : {}),
    ...(deleteHistory && clientLog
      ? { clientLogs: { ...s.clientLogs, [ownerId]: clientLog.filter((e) => !tplIds.has(e.sessionTemplateId)) } } : {}),
    // Invariante 4: nadie se queda apuntando a un programa que ya no existe.
    ...(!isMine && s.clients[ownerId]?.activeProgramId === programId
      ? { clients: { ...s.clients, [ownerId]: { ...s.clients[ownerId], activeProgramId: null, programDirty: false } } } : {}),
    ...(isMine && s.profile.activeProgramId === programId
      ? { profile: { ...s.profile, activeProgramId: null } } : {}),
  };
}
```

- `deleteProgram(id, deleteHistory)` → `set((s) => purgeProgram(s, id, { deleteHistory }))`.
- `deleteClient(clientId)` → purga en cadena `programsOf(s.programs, clientId)`,
  borra el cliente y su `clientLogs`, y sigue borrando el slot de Supabase como
  hoy.
- `removeSessionFromProgram` no cambia: ya limpiaba bien.

⚠️ **`purgeProgram` compone.** Encadenar purgas requiere ir pasando el estado
resultante, no llamar tres veces sobre `s`. En `deleteClient`, un `reduce`.

### 3.5 Checklist de ficheros — fase 1

| Fichero | Qué cambia |
|---|---|
| `mobile/store/useStore.js` | migración §3.1; `createEmptyProgram`, `createProgramForClient`, `cloneProgramFromTemplate` escriben `owner`/`kind`; `archiveProgram`, `restoreProgram`, `deleteProgram`, `deleteClient`, `setClientActiveProgram`, `importForClient`, `importData`, `_buildProgramJson`; fuera `secondaryProgramIds` |
| `src/utils/clientPrograms.js` (+ su test) | **se borra**, sustituido por `programOwnership.js` |
| `mobile/src/utils/programOwnership.js` | nuevo (§2.3) + su test |
| `mobile/src/utils/importFile.js` | nuevo — el `parseImportFile` único |
| `mobile/src/screens/ClientsScreen.jsx` | `clientPrograms` pasa a `programsOf(programs, clientId)`; fuera el `filter(Boolean)`; `parseImportFile` importado |
| `mobile/src/screens/ProgramScreen.jsx` | `templatesOf(programs)`; `mode: 'template'` / `'managed'` al crear |
| `mobile/src/screens/OnboardingScreen.jsx` | `kind === 'template'` al listar; `parseImportFile` importado |
| `mobile/src/components/AppHeader.jsx` | el filtro del modal de archivados pasa a `p.owner === 'me'`; `parseImportFile` importado |
| `mobile/src/components/ImportModal.jsx` | `hasTemplates` mira `kind` (2 sitios) |
| `src/utils/clientLogs.js` | `splitClientLogEntries` deja de recibir `clients`: los dueños salen de `programs` |
| `src/utils/backupPayload.js` | `version: '3'` |

### 3.6 Tests

- `clientPrograms.test.js` → se reescribe como `programOwnership.test.js`.
- `clientLogs.test.js` → `splitClientLogEntries` cambia de firma.
- `clientSync.sim.test.js` → construye programas con `mode`/`programIds`; pasa a
  `owner`. **Es la red de seguridad del protocolo: si esta pasa, la fase está bien.**
- `useStore.test.js` (fallo 2, "restaurar un backup pierde los programas de
  clientes") → el escenario es el mismo, la forma del fixture cambia.
- **Nuevo, y es el que da valor a la fase:** borrar un programa de cliente no
  deja ni una sesión huérfana en `sessions` ni el `activeProgramId` apuntando al
  vacío. Es el fallo que hoy no cubre nadie.

---

## 4. Fase 2 — Un solo diccionario de sesiones

### 4.1 Por qué había dos, y por qué ya no vale

`sessionTemplates` eran los originales de semilla y `userPrograms` la capa de
ediciones encima; `getEffectiveTemplate` resuelve `userPrograms[id] ?? sessionTemplates[id]`
y `restoreSession` borra la capa para "volver al original".

Eso dejó de ser cierto: `createEmptyProgram`, `addSessionToProgram`,
`createProgramForClient` y `cloneProgramFromTemplate` escriben sesiones **nuevas
en `sessionTemplates`**. Para todo lo que crea el usuario, "Restaurar sesión
original" ([SessionEditorScreen.jsx:602](../../src/screens/SessionEditorScreen.jsx))
no restaura un original: **devuelve la sesión al estado en que se creó, que
normalmente es vacía.** La capa sólo significa algo para las seis sesiones de
semilla de [src/data/programs.js](../../../src/data/programs.js).

**Decisión: se borra la capa y con ella el botón.** Lo que un usuario quiere
cuando dice "deshacer" es deshacer, y para eso está el snapshot del editor
(`beginEditSession` / `_editSnapshot`), que ya funciona y sí tiene el "antes"
correcto.

### 4.2 El cambio

- `sessionTemplates` + `userPrograms` → **`sessions`**. Un `Object.assign` en la
  migración, con `userPrograms` ganando (es el estado que el usuario ve hoy):

  ```js
  if (!state.sessions) {
    state.sessions = { ...(state.sessionTemplates ?? {}), ...(state.userPrograms ?? {}) };
    delete state.sessionTemplates;
    delete state.userPrograms;
  }
  ```

- `getEffectiveTemplate` **se conserva con el mismo nombre** y pasa a ser
  `sessions[id]`. Es la costura: ningún llamante cambia. Los ~55 sitios del
  store que escribían en `userPrograms` escriben en `sessions`.
- `resetTemplate` se borra (sólo lo usaba la app web). `restoreSession` y su
  `SheetRow` se borran; las claves `editor.sessionRestoreBtn` y
  `editor.toastReset` salen de **los dos** locales.
- `_buildProgramJson` y `buildBackupPayload` emiten `sessions`. El lector de v1/v2
  fusiona `sessionTemplates` y `userPrograms` del fichero igual que la migración.
- `isEdited` ([SessionEditorScreen.jsx:254](../../src/screens/SessionEditorScreen.jsx))
  desaparece con el botón.

### 4.3 La semilla se vacía

`programs: PROGRAMS` y `sessionTemplates: SESSION_TEMPLATES`
([useStore.js:309](../../store/useStore.js)) son las **únicas** referencias a
[src/data/programs.js](../../../src/data/programs.js) en todo el código de
producción — comprobado. Es decir: cada instalación arranca con dos programas de
demostración y seis sesiones que no son del usuario, viajan en cada backup y hoy
sólo están medio ocultos porque ningún listado los pide.

Con `owner: 'me'` **sí aparecerían** en "mis programas". Así que la fase los
vacía:

```js
programs: {},
sessions: {},
```

`src/data/programs.js` queda como dato de desarrollo (lo usan tests); no se
importa desde el store. Si hiciera falta una demo, se carga importando un
`.fitdata`, que es el camino que ya existe.

---

## 5. Fase 3 — Muere el espejo `program.days`

Toda escritura de etapas pasa hoy por `withStages`, cuyo único trabajo extra es
mantener `program.days = stages[idx].days` para los lectores que leen el espejo
directamente.

- **Un solo lector, puro**, en `mobile/src/utils/programOwnership.js` (o junto a
  `stageProgress`):

  ```js
  export const stageDays = (p) => p?.stages?.[p?.currentStageIndex ?? 0]?.days ?? [];
  ```

- Se sustituyen las lecturas de `p.days` y los ternarios
  `hasStages ? stages[idx].days : p.days` por `stageDays(p)`. Concentradas en
  `useStore.js` (29), `OnboardingScreen` (13), `ClientsScreen` (10),
  `HomeScreen` (9) y `clientLogs.js` (4).
- `withStages` pierde la línea del espejo y se queda en "asigna etapas y
  clampa el índice"; `ensureStages` no cambia (sigue envolviendo programas
  antiguos en una etapa).
- Migración: `delete p.days` en cada programa. Sin más.

**Esta fase va la última a propósito.** Es la de más sitios tocados y la de menos
beneficio inmediato: no arregla ningún fallo conocido, sólo quita la posibilidad
de que vuelva a aparecer uno como el que motivó `withStages`. Si hay que dejar
una sin hacer, es ésta.

---

## 6. Orden, coste y lo que no se toca

| Fase | Qué se lleva por delante | Coste | Riesgo |
|---|---|---|---|
| 1 — `owner` + `kind` | la fuga de sesiones huérfanas, el robo de programa al restaurar, las cuatro ramas de `importData`, `clientPrograms.js`, `secondaryProgramIds`, dos de las tres copias de `parseImportFile` | 1-2 sesiones | medio: toca el protocolo con el cliente. `clientSync.sim.test.js` es la red |
| 2 — `sessions` | un diccionario, `resetTemplate`, `restoreSession`, el `??` de cada lectura, dos programas fantasma en cada backup | 1 sesión | bajo: `getEffectiveTemplate` absorbe el cambio |
| 3 — sin espejo | `withStages` a la mitad, y una clase entera de deriva | 1-2 sesiones | bajo, pero muchos sitios |

**Fuera de alcance, a propósito:**

- **Las etapas y sus contadores.** Seis campos derivables de dos
  (`cyclesCompleted`, `stageStartCycle`) y dos definiciones de "semana" en
  conflicto — el problema que ya bloqueó la fase 6 de
  [training-load.md](training-load.md). Merece su propia spec y **no** se puede
  hacer a la vez que ésta: las dos tocan `withStages`.
- **Los tres roles con un flag** (`isPro` + `proTabsHidden`). Es producto, no
  estructura.
- **La app web.** Si sigue en el repo cuando se ejecute esto, se ignora — igual
  que hace [auditoria-tecnica.md](auditoria-tecnica.md).

---

## 7. Mapa de migración, en una tabla

Todo lo que hay que transformar, y dónde vive cada transformación.

| Dato | Antes | Después | Dónde se migra |
|---|---|---|---|
| Programa propio | `mode: 'personal'` | `owner: 'me'`, `kind: 'program'` | `onRehydrateStorage` §3.1 · `normalizeIncomingProgram` §3.2 |
| Programa de cliente | `mode: 'managed'` + `clientId` | `owner: <clientId>`, `kind: 'program'` | ídem, con `programIds` como autoridad de reserva |
| Plantilla | `mode: 'template'` | `owner: 'me'`, `kind: 'template'` | ídem |
| Lista del cliente | `client.programIds[]` | derivada (`programsOf`) | se borra en la migración |
| Programas secundarios | `profile.secondaryProgramIds[]` | — | se borra (muerto) |
| Sesiones | `sessionTemplates` + `userPrograms` | `sessions` | migración §4.2 (gana `userPrograms`) |
| Semilla | `PROGRAMS` / `SESSION_TEMPLATES` | `{}` / `{}` | estado inicial §4.3 |
| Espejo de etapa | `program.days` | `stageDays(p)` | `delete p.days` §5 |
| Fichero | `version: '2'` | `version: '3'` | escritura en `_buildProgramJson` + `buildBackupPayload`; lectura v1/v2 en `normalizeIncomingProgram` |
| Validador de versión | 3 copias con `['1','2']` | `mobile/src/utils/importFile.js` con `['1','2','3']` | §3.2 |

Las tres migraciones de estado son **idempotentes** y viven juntas en el bloque
de `onRehydrateStorage`, con las de etapas, tags y colores. Como la app no está
publicada, se pueden borrar todas de golpe antes de la primera versión pública:
déjalas marcadas con un comentario `// migración pre-publicación` para que se
vayan juntas y no queden ahí de por vida.
