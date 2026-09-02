# Spec — Modelo de programas: un dueño, un diccionario, sin espejo

> Estado: **LAS TRES FASES IMPLEMENTADAS** (2-sep-2026), pendientes de prueba
> en dispositivo. Tres fases **independientes**, cada una
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
>
> **Revisada contra el código el 2-sep-2026.** El diagnóstico se confirmó
> entero, punto por punto. Lo que la revisión añadió va marcado en su sitio:
> §3.1 bis (nuevo), §3.2, §3.3, §3.4, §3.5, §4.2, §4.3 y §5. Estado de partida:
> 1134 tests en 37 ficheros, verdes en 1,3 s.

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

/** Sin activo. No borra nada más: ya no queda ninguna lista que mantener. */
export function deassignProgram(client) {
  return { ...client, activeProgramId: null, programDirty: false };
}
```

`clientPrograms.js` exporta **tres** funciones, no una. `deassignProgram` se muda
con `assignActiveProgram` ([useStore.js:590](../../store/useStore.js)), y
`archivedProgramIds(client)` **desaparece**: su sustituto es `archivedOf(...)`,
que mira `programs` en vez de la lista del cliente. Las tres las importa
`clientSync.sim.test.js`.

**Cambio de orden, y es el único visible:** `client.programIds` guardaba orden de
inserción (el más nuevo delante); la lista derivada ordena por `createdAt` desc.
`ClientsScreen` ya reordenaba por `createdAt` desc antes de pintar
([ClientsScreen.jsx:2014](../../src/screens/ClientsScreen.jsx)), así que **no
cambia nada en pantalla**. Si algún día se quisiera un orden manual, sería un
campo propio (`sortIndex`), no un efecto de la estructura.

---

## 3. Fase 1 — `owner` + `kind` sustituyen a `mode`, `clientId` y las listas

> **IMPLEMENTADA** el 2-sep-2026, con todo lo de esta seccion dentro, incluido
> el vaciado de la semilla de §4.3 adelantado. 1149 tests verdes (eran 1134;
> se fueron los 8 de `clientPrograms.test.js` y entraron 23 nuevos). Sin
> errores de lint nuevos: 30 problemas antes y despues.

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

### 3.1 bis El filtro deja de ser negativo, y eso obliga a todo el que crea

Hoy los filtros son **negativos** (`p.mode !== 'template'`), así que un programa
**sin** `mode` pasa por todos. Y los hay: `adaptArchetype` y `generateProgram`
no escriben `mode` en ningún sitio
([archetypeAdapter.js:344](../../../src/utils/archetypeAdapter.js)), de modo que
todo programa nacido del onboarding vive hoy con `mode: undefined` y aparece
donde debe **por accidente**.

`p.owner === 'me'` es un test **positivo**. Un programa sin `owner` no aparece en
ninguna pantalla: sin error, sin aviso y sin nada que mirar. Los cinco caminos de
creación tienen que escribirlo, y el cuarto es el que no estaba en la lista:

| Camino | Qué escribe |
|---|---|
| `createEmptyProgram` | `owner: 'me'` o el cliente según el parámetro, `kind: 'program'` |
| `createProgramForClient` | `owner: clientId`, `kind: 'program'` |
| `cloneProgramFromTemplate` | el dueño del destino; `kind: 'template'` sólo al duplicar una plantilla |
| **`generateAndActivateProgram`** ([useStore.js:366](../../store/useStore.js)) | `owner: 'me'`, `kind: 'program'` — **en el `set()` del store, no en el generador**: el motor de plantillas no sabe de dueños y no tiene por qué aprender |
| `importForClient` | `owner: clientId`, después de normalizar (§3.2) |

### 3.2 Migración del formato de fichero (`.fitdata` v3)

El `.fitdata` es el formato canónico: lo escriben la exportación, la copia a
Drive y el protocolo con el cliente. Cambia la forma de `program`, así que
**sube a `version: '3'`** y hay que poder leer los v1/v2 que ya existen (tu
propio [fc-seed-carga.fitdata](../../../fc-seed-carga.fitdata) y cualquier
backup de pruebas).

**Escritura** — `_buildProgramJson` ([useStore.js:2477](../../store/useStore.js))
y `buildBackupPayload` ([src/utils/backupPayload.js:28](../../../src/utils/backupPayload.js))
suben a `'3'`. Y hay un **tercer escritor escondido**: `exportProgramWithLog`
([useStore.js:2410](../../store/useStore.js)) es una copia literal de
`_buildProgramJson` —las mismas ~60 líneas de `tplIds`, `relTpl`, `usedExIds` y
el mismo `version: '2'`— que nadie actualizó cuando se extrajo el helper. Si no
se toca, esa ruta exporta v2 para siempre. **No la migres: bórrala** y déjala en
`_buildProgramJson(activeProgramId, true)` + la escritura del fichero.

**Y de paso se arregla un fallo que lleva ahí desde siempre.** `_buildProgramJson`
arma el historial así:

```js
const log = withLog ? workoutLog.filter((e) => tplIds.has(e.sessionTemplateId)) : [];
```

Sólo mira `workoutLog`, **nunca `clientLogs`**. Y la ficha del cliente ofrece
"Exportar con historial" tanto en el programa activo
([ClientsScreen.jsx:2515](../../src/screens/ClientsScreen.jsx)) como en cada
archivado ([:2557](../../src/screens/ClientsScreen.jsx)), las dos con `true`.
O sea: **exportar el programa de un cliente "con historial" produce un fichero
con `workoutLog: []`, siempre, y sin decir nada.** Mover un programa de un cliente
a otro pierde el historial en silencio.

Con `owner`, elegir el cajón es una expresión y no una negociación entre dos
campos — es el argumento de esta spec en miniatura:

```js
const src = program.owner === 'me' ? workoutLog : (clientLogs[program.owner] ?? []);
const log = withLog ? src.filter((e) => tplIds.has(e.sessionTemplateId)) : [];
```

**`kind` sí se fuerza a `'program'`**, y no es descuido: `ImportModal` decide si
enseña la casilla "Plantillas" mirando `parsedData.programs`
([ImportModal.jsx:142](../../src/components/ImportModal.jsx)), y un fichero de
programa suelto trae `data.program`, no `data.programs`. Un fichero con
`kind: 'template'` no tendría casilla por la que entrar y el predicado `mine` lo
descartaría: se perdería en silencio. Exportar una plantilla da un programa, como
hoy. `_buildProgramJson` ya normaliza lo que envía
(`{ ...program, mode: 'personal', status: 'active' }`) para que el cliente no
reciba un programa marcado como de otro; pasa a `owner: 'me', kind: 'program'`.
El cliente recibe siempre un programa suyo — **`owner` es semántica del
dispositivo, no una identidad global**, y esa es la propiedad que hace que el
protocolo no necesite ningún cambio más.

**Lectura** — un solo normalizador. Pero cuidado con la premisa: "el único sitio
por el que entran los programas de fuera" **es falsa**, y más vale saberlo antes
de escribirlo. Hay **dos puertas**:

1. `importData` ([useStore.js:2588](../../store/useStore.js)), donde ya vive
   `ensureStages`.
2. `importForClient` ([useStore.js:705](../../store/useStore.js)) — la ruta del
   entrenador que importa el `.fitdata` de un cliente. Mete
   `{ ...data.program, mode: 'managed', clientId }` **a pelo**: ni pasa por
   `importData` ni llama a `ensureStages`.

Las dos llaman a `normalizeIncomingProgram`; la segunda, además, fija
`owner: clientId` después de normalizar. Que la puerta 2 no llame a
`ensureStages` es un fallo **latente hoy** —lo tapan los ternarios
`hasStages ? … : p.days`— y es justo lo que **bloquea la fase 3**.

El normalizador:

```js
function normalizeIncomingProgram(p) {
  const staged = ensureStages(p);
  if (staged.owner) return staged;                  // v3
  const { mode, clientId, ...rest } = staged;       // v1 / v2
  return {
    ...rest,
    // `mode: 'personal'` es una AFIRMACIÓN del emisor y gana sobre `clientId`.
    owner: mode === 'personal' ? 'me' : (clientId ?? 'me'),
    kind:  mode === 'template' ? 'template' : 'program',
  };
}
```

⚠️ **La precedencia de `mode` sobre `clientId` no es cosmética.** El exportador
viejo escribía `mode: 'personal'` en cada programa suelto pero **se dejaba el
`clientId` dentro** — la fuga del §3.2. Con `owner: clientId ?? 'me'` a secas,
todo `.fitdata` v2 que un entrenador ya mandó a un cliente entraría en el móvil
de ese cliente como programa de un cliente **que ahí no existe**: no lo recoge
`mine`, no lo recoge nada, y no salta ni un error. Lo mismo vale para el
`program_json` que ahora mismo esté esperando en un slot de Supabase escrito por
la versión anterior.

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

**Lo que NO desaparece de esa rama:** el `status: 'active'` forzado. Lo que se va
es la reescritura del **`mode`**, no la del estado. Sin `status: 'active'`, un
programa archivado dentro del fichero entra archivado y no aparece por ninguna
parte — y de esta rama cuelga `applyPendingProgramUpdate`, que es por donde el
cliente recibe el programa de su entrenador.

**Y hay que añadirle dos reglas**, las de §3.4 bis: cuándo el import es una copia
y cómo sobrevive el progreso. Sin ellas, la rama `mine` le roba el programa a un
cliente y el cliente de WhatsApp pierde su ciclo en cada actualización.

### 3.4 El borrado único

Cierra la fuga del punto 4 de §1. Un helper privado del store, y los tres
caminos cuelgan de él:

```js
/** Devuelve el trozo de estado con el programa, sus sesiones y (opcional) su log fuera. */
function purgeProgram(s, programId, { deleteHistory = false } = {}) {
  const program = s.programs[programId];
  if (!program) return {};
  const tplIds = new Set(programTemplateIds(program));   // ya existe, recorre TODAS las etapas
  // OJO: hay DOS `programTemplateIds`. El de `clientLogs.js` devuelve un Set; el
  // de `exerciseLinks.js` devuelve un Array. Aquí va el de clientLogs.

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

⚠️ **Un cambio de comportamiento que hay que tomar a propósito.** Hoy
`deleteClient` filtra `workoutLog` **siempre**, sin que nadie lo pida
([useStore.js:568](../../store/useStore.js)): resto de cuando el historial de los
clientes vivía mezclado con el del entrenador. `purgeProgram` sólo lo filtra con
`deleteHistory && isMine`, así que al encadenar **deja de tocarse el log
personal**. Es lo correcto —las entradas de un cliente viven en `clientLogs`—
pero en un dispositivo con datos anteriores a `clientLogs` puede dejar entradas
huérfanas visibles en el historial personal. Si molesta, esa limpieza va **una
vez en la migración**, no en cada borrado.

⚠️ **`purgeProgram` compone.** Encadenar purgas requiere ir pasando el estado
resultante, no llamar tres veces sobre `s`. En `deleteClient`, un `reduce`.

### 3.4 bis Identidad al importar: cuándo es copia y cómo sobrevive el progreso

Con la lista del cliente derivada, **sobrescribir un programa cambia de dueño a
quien lo tenía**. Hoy eso ya pasa —exportar el programa de un cliente e
importarlo como propio deja un solo objeto con `mode:'personal'` **y**
`clientId` puesto, listado en los dos sitios a la vez— pero como la ficha del
cliente lee su lista guardada, no se nota. Con `programsOf` se notaría: el
programa desaparece de la ficha y `activeProgramId` se queda colgando, contra el
invariante 4.

#### Regla 1 — el import es una copia sólo si el id ya es de OTRO dueño

```js
// En la rama `mine` de importData, por cada programa entrante:
const local = s.programs[incoming.id];
if (local && local.owner !== incoming.owner) data = reidProgramFile(data);
```

`reidProgramFile` ya existe ([clientLogs.js:122](../../../src/utils/clientLogs.js)),
lo usa `importForClient` para lo mismo, y remapea el id del programa, los de las
sesiones, los días de **todas** las etapas y las entradas de log que van dentro
del fichero.

La condición es `local && distinto dueño`, no "id repetido", y las dos mitades
importan:

- **`local &&`** — en un móvil nuevo no hay nada con qué chocar, así que **no hay
  re-ID**. La restauración conserva ids, historial y contadores. Es el caso que
  más duele si se hace mal.
- **`distinto dueño`** — mismo dueño significa "esto es el mismo programa, más
  nuevo": se sobrescribe en el sitio, que es el camino de actualización del
  cliente y el de restaurar un backup.

#### Regla 2 — sobrescribir NO pisa los contadores

Los contadores (`currentStageIndex`, `cycleCompletedIds`, `stageWeeksCompleted`,
`totalWeeksCompleted`) viven **dentro del objeto programa**, así que un
`{ ...incoming }` los reemplaza por los del emisor. `applyPendingProgramUpdate`
ya lo resuelve con `mergeProgressOnImport`
([useStore.js:3446](../../store/useStore.js)) — **pero sólo en el camino
conectado**. Un cliente que recibe su programa por WhatsApp importa por
`AppHeader` → `importData` directo, sin merge: **pierde su ciclo y su etapa en
cada actualización**. Es un fallo de hoy, y el que hace que sobrescribir sea
seguro o no.

La corrección va en `importData`, que es por donde pasan los dos caminos:

```js
// El programa local con ESE id es el que se está actualizando: su posición es
// del atleta, no del emisor.
const kept = mergeProgressOnImport({
  blob:           progressBlob(local),
  program:        incoming,
  lastActivation: local?.stageActivatedAt ?? null,
});
```

`progressFromBlob` ya rechaza un blob cuyo `programId` no coincide, así que tras
un re-ID no hay nada que conservar y se adoptan los contadores entrantes — que es
lo correcto: un programa distinto, no una actualización. Las dos reglas encajan
sin condiciones extra.

#### Regla 3 — sustituir el activo archiva al anterior

`importData` sólo cambiaba `profile.activeProgramId`. El programa que dejaba de
ser el activo se quedaba con `status: 'active'` **sin serlo**, y eso es
invisible: fuera de Home, que sólo pinta el activo, y fuera del modal de
archivados, que filtra por `status === 'archived'`. No se archivaba: se perdía.

```js
// Un entrante que SUSTITUYE al activo archiva al anterior. Con el MISMO id no
// hay nada que archivar: es una actualización en el sitio.
const prevId = s.profile.activeProgramId;
const prev   = prevId && prevId !== firstId ? merged[prevId] : null;
if (prev && prev.status !== 'archived') {
  merged[prevId] = { ...prev, status: 'archived', archivedAt: hoy() };
}
```

No es una regla nueva: es la de `restoreProgram`
([useStore.js:499](../../store/useStore.js)), que ya archivaba el activo al
restaurar otro. Un solo programa activo, y nada se pierde en silencio. La
distinción por id es lo que la hace correcta en los dos lados: el programa que
llega del entrenador trae **el mismo id**, así que actualiza en el sitio y no
archiva nada.

#### Los seis escenarios reales

| Escenario | ¿Existe el id? | Dueño local vs entrante | Qué hace | Resultado |
|---|---|---|---|---|
| Móvil nuevo o reinstalación, backup completo | no | — | nada | restauración exacta: mismos ids, historial enganchado, contadores intactos |
| Reimportar el backup en el mismo móvil | sí | `me` / `me` | sobrescribe + regla 2 | actualización |
| Entrenador exporta el programa de un cliente y lo importa como suyo | sí | `cli_X` / `me` | **copia (re-ID)** | dos programas; el cliente conserva el suyo, su activo y su historial |
| Cliente **sin** conexión recibe la v2 por WhatsApp | sí | `me` / `me` | sobrescribe + regla 2 | programa actualizado, ciclo y etapa donde estaban |
| Cliente **con** conexión recibe ese mismo fichero por WhatsApp | sí | `me` / `me` | igual que el anterior | no hay re-ID: el id es el mismo que le llegó por el canal conectado |
| Cliente nuevo recibe el programa por primera vez | no | — | nada | programa nuevo con los contadores del fichero (los del entrenador, a cero) |

La regla 3 corre por encima de todos: en los que el entrante **sustituye** al
activo (columnas 1, 3 y 6 cuando ya había uno), el anterior queda archivado y a
la vista; en los que **actualiza** (mismo id: 2, 4 y 5), no hay nada que
archivar.

El id del programa **nunca** delata al cliente: es un `prog_*` aleatorio, y quien
lleva el dueño es `owner`, que la exportación fuerza a `'me'` (§3.2). Del
`clientId` que hoy se cuela dentro de cada `.fitdata` exportado no queda rastro.

Una arruga menor, ya existente y que no bloquea nada: importar a mano no toca
`clientSync.lastProgramImportedAt`, así que un cliente conectado que aplique el
fichero por WhatsApp volverá a ver el aviso del canal conectado. Aplicarlo dos
veces es idempotente con la regla 2, así que como mucho es un aviso de más.

### 3.5 Checklist de ficheros — fase 1

| Fichero | Qué cambia |
|---|---|
| `mobile/store/useStore.js` | migración §3.1; los **cinco** caminos de creación de §3.1 bis escriben `owner`/`kind` (`generateAndActivateProgram` incluido); `archiveProgram`, `restoreProgram`, `deleteProgram`, `deleteClient`, `setClientActiveProgram`, `importForClient` (+ el `ensureStages` que le falta, §3.2), `importData` (+ las dos reglas de §3.4 bis), `_buildProgramJson` (+ el cajón de historial por `owner`, §3.2); **se borra `exportProgramWithLog`** (§3.2); fuera `secondaryProgramIds`; el estado inicial pasa a `programs: {}` / `sessionTemplates: {}` (§4.3, adelantado a esta fase) |
| `src/utils/clientPrograms.js` (+ su test) | **se borra**, sustituido por `programOwnership.js` |
| `mobile/src/utils/programOwnership.js` | nuevo (§2.3) + su test |
| `mobile/src/utils/importFile.js` | nuevo — el `parseImportFile` único, con `['1','2','3']`. Las tres copias llevan los mensajes de error **en español a pelo**; al unificarlas devuelve una clave (`errors.importNoVersion`, `errors.importBadVersion`, `errors.importBadJson`) y traduce la pantalla, que es la regla del repo |
| `mobile/src/screens/ClientsScreen.jsx` | `clientPrograms` pasa a `programsOf(programs, clientId)`; fuera el `filter(Boolean)`; `parseImportFile` importado |
| `mobile/src/screens/ProgramScreen.jsx` | `templatesOf(programs)`; `mode: 'template'` / `'managed'` al crear |
| `mobile/src/screens/OnboardingScreen.jsx` | `kind === 'template'` al listar; `parseImportFile` importado |
| `mobile/src/components/AppHeader.jsx` | el filtro del modal de archivados (**2 sitios**: [226](../../src/components/AppHeader.jsx) y [337](../../src/components/AppHeader.jsx)) pasa a `programsOf(programs, 'me')` + `status === 'archived'` — **no** a `p.owner === 'me'` a secas: eso dejaría pasar las plantillas archivadas y `restoreProgram` convertiría una plantilla en el programa activo. `programsOf` ya excluye `kind: 'template'`. `parseImportFile` importado |
| `mobile/src/components/ImportModal.jsx` | `hasTemplates` mira `(p.kind ?? p.mode)` (2 sitios) — sólo `kind` deja **sin casilla "Plantillas"** a todo backup v1/v2, que es donde están las plantillas de hoy |
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
- **Nuevo, barato y cierra §3.1 bis:** cada camino de creación deja un `owner`.
  Un test que llame a los cinco y afirme `expect(prog.owner).toBeDefined()`
  bastaría; hoy `generateAndActivateProgram` lo suspendería.
- **Nuevos, de §3.4 bis** — los tres que describen el modelo entero de identidad:
  1. importar como propio el programa de un cliente deja **dos** programas, y el
     cliente conserva el suyo, su `activeProgramId` y su historial;
  2. importar un backup en un store **vacío** no re-ID nada: el id del programa
     y los `sessionTemplateId` del log salen idénticos (móvil nuevo);
  3. reimportar el mismo programa con contadores a cero **no** mueve la etapa ni
     el ciclo del que ya estaba (cliente de WhatsApp).

---

## 4. Fase 2 — Un solo diccionario de sesiones

> **IMPLEMENTADA** el 2-sep-2026. **Dos decisiones cambiaron respecto a lo
> escrito abajo**, y el texto original se conserva por el razonamiento:
>
> 1. **El diccionario NO se renombra a `sessions`.** Se queda `sessionTemplates`
>    y lo que desaparece es `userPrograms`. Renombrar costaba ~40 sitios más y
>    cambiaba las DOS claves del fichero en vez de una; y `sessions` se confunde
>    con las sesiones registradas del historial, que es como las llama la app en
>    pantalla. El precio es que el nombre sigue diciendo "template" sin capa que
>    lo justifique.
> 2. **El fichero sube a `version: '4'.`** Sin subirlo, una build anterior a esta
>    fase pasa el validador, importa el programa y se queda **sin sesiones** en
>    silencio. Con v4 lo rechaza con "Versión 4 no compatible". La build nueva
>    sigue leyendo v1/v2/v3 y fusiona sus dos claves (gana `userPrograms`).
>
> Y una trampa que casi cuesta cara: `HomeScreen` y `ClientsScreen` tenían
> suscripciones a `sessionTemplates` que **parecen muertas** —lint incluido— y no
> lo son. Los datos se leen con `getEffectiveTemplate`, que es una función
> estable y por sí sola no dispara ni un render: sin esa suscripción, la pantalla
> no se repinta al editar una sesión. Van documentadas con su `eslint-disable`.
>
> `editor.toastReset` **no se borra** de los locales: la sigue usando la app web
> (`src/components/editor/DayEditor.jsx`). Sólo se va `editor.sessionRestoreBtn`.
> 1161 tests verdes (eran 1153), y dos errores de lint MENOS que antes.

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
- **Seis pantallas reimplementan el `??` a mano**, porque `getEffectiveTemplate`
  es un getter del store y a un getter no te puedes suscribir:
  `SessionEditorScreen` (x2), `WorkoutScreen` (x2), `ExerciseEditorInline`,
  `ProgramDetailScreen` (un `useMemo` que fusiona los dos diccionarios) y
  `ClientsScreen`. Cada una está suscrita a **los dos** y se repinta si cambia
  cualquiera. Pasan a una sola suscripción, `s.sessions`. Es la mitad del valor
  de esta fase y no estaba contada.
- El **editor de programa** guarda y compara los dos: `beginEditSession` clona
  `{ programs, sessionTemplates, userPrograms }`
  ([useStore.js:812](../../store/useStore.js)), `restoreSnapshot` los restaura y
  `hasUnsavedChanges` compara `JSON.stringify(st.userPrograms)`
  ([ProgramEditorScreen.jsx:149](../../src/screens/ProgramEditorScreen.jsx)).
  Con un diccionario, esa comparación deja de mirar sólo la capa de ediciones y
  serializa **todas** las sesiones: sigue siendo correcta y sólo corre al salir,
  pero el comentario de al lado ("las base no cambian mientras editas") deja de
  ser verdad. Bórralo.

### 4.3 La semilla se vacía

`programs: PROGRAMS` y `sessionTemplates: SESSION_TEMPLATES`
([useStore.js:309](../../store/useStore.js)) son las **únicas** referencias a
[src/data/programs.js](../../../src/data/programs.js) en todo el código de
producción — comprobado. Es decir: cada instalación arranca con dos programas de
demostración y seis sesiones que no son del usuario, viajan en cada backup y hoy
sólo están medio ocultos porque ningún listado los pide.

**Corrección (2-sep-2026, comprobado en el código):** este párrafo decía que con
`owner: 'me'` aparecerían en "mis programas". **Esa pantalla no existe.** Los
únicos listados de programas son el modal de archivados de `AppHeader`
(`owner: 'me'` **y** `status === 'archived'`, y la semilla está `active`), las
plantillas (`kind === 'template'`) y la ficha de un cliente. La semilla sigue
invisible después de migrar, igual que antes.

Lo que sí es cierto —y basta para vaciarla— es que viaja en cada backup y ocupa
sitio en el estado persistido de todo el mundo desde el primer arranque. El
vaciado **se adelanta a la fase 1** de todos modos: cuesta las mismas dos líneas
allí y así una instalación nueva arranca limpia desde el primer despliegue.

```js
programs: {},
sessions: {},
```

(En la fase 1 la clave todavía se llama `sessionTemplates`; en la 2 pasa a
`sessions`.)

`src/data/programs.js` **se borró** con la app web (sep-2026, fase 1 de
[rediseno.md](rediseno.md) §2): aquí se dijo que "lo usan tests" y era falso —
su único importador era el store web. Si hiciera falta una demo, se carga
importando un `.fitdata`, que es el camino que ya existe.

⚠️ **Vaciar el estado inicial no limpia tu dispositivo.** `programs` y
`sessionTemplates` están en el `partialize`, así que la semilla lleva persistida
desde el primer arranque y seguirá ahí después de la migración, ahora con
`owner: 'me'`. No hay que hacer nada: no se ve en ninguna pantalla (ver la
corrección de arriba). Si molesta que siga viajando en los backups de ESE
dispositivo, se limpian los datos de la app. No merece código de migración.

---

## 5. Fase 3 — Muere el espejo `program.days`

> **IMPLEMENTADA** el 2-sep-2026. La regla que la hizo segura, y que conviene
> entender antes de tocar nada de esto:
>
> **Se deja de MANTENER el espejo, pero no de saber LEER un `days` que venga de
> fuera.** Son dos cosas distintas y confundirlas rompe el protocolo.
>
> Siguen leyendo `program.days`, a propósito y con comentario que lo dice:
> `ensureStages` (es de ahí de donde saca los días para armar la etapa de un
> programa antiguo), los **dos** `programTemplateIds` (`clientLogs.js` y
> `exerciseLinks.js`, que se llaman también sobre programas de fichero),
> `reidProgramFile` y el `getStages` de `buildProgramDiff` (compara contra el
> programa ENTRANTE). Borrar cualquiera de esas cinco lecturas dejaría sin
> sesiones a los `.fitdata` v1/v2 que ya existen.
>
> **Tres lectores, no uno**, y viven en `stageProgress.js` junto a `withStages`,
> que es donde está el modelo de etapas:
>
> - `stageDays(program)` — la etapa activa del programa.
> - `stageDaysAt(program, idx)` — **hace falta**: en el móvil del entrenador
>   `currentStageIndex` es la etapa que él activó, no donde está el cliente. Lo
>   usan `ClientsScreen` y `NextSessionScreen` con `clientStageIndex`.
> - `allProgramDays(program)` — todas las etapas: el alcance del programa entero.
>
> **La trampa que encontró esta fase**, y es la que justificaba el miedo: en
> `saveSession` había una segunda rama del contador de ciclo para programas SIN
> etapas, que leía el espejo. Era inalcanzable —todo programa del store tiene
> etapas— pero con el espejo borrado habría dejado de contar ciclos **en
> silencio**: el cliente clavado en la semana 1 para siempre. Se borró la rama.
>
> **Lo que NO dependía del espejo, comprobado:** las analíticas de carga.
> `trainingLoad.js`, `LoadTab` y `getWeekStatuses` trabajan sobre `workoutLog`,
> no sobre el programa. Del programa sólo sale el ALCANCE ("qué cuenta como del
> programa"), y eso ya lo calculaba `programTemplateIds` desde las etapas.
>
> De propina: `StatsScreen` e `HistoryScreen` tenían cada una su copia de
> `programTemplateIds` (8 líneas idénticas). Ahora las dos usan la compartida —
> la misma que decide qué sube el cliente a su entrenador y qué se borra al
> purgar, así que las tres respuestas ya no pueden discrepar.
>
> **Queda un rabo, a propósito:** 14 guardas `hasStages` en `ClientsScreen`,
> `HistoryScreen` y `HomeScreen`. Ya son siempre ciertas, pero no leen el espejo
> —sólo miran `stages.length`— y reescribir condiciones de render en tres
> pantallas por cero ganancia funcional es justo el riesgo que esta fase
> desaconseja. Se quedan.
>
> 1174 tests verdes (eran 1166) y **exactamente los mismos 173 errores de lint
> que antes**: ni uno nuevo, ni uno menos.

Toda escritura de etapas pasa hoy por `withStages`, cuyo único trabajo extra es
mantener `program.days = stages[idx].days` para los lectores que leen el espejo
directamente.

- **Un solo lector, puro**, en `mobile/src/utils/programOwnership.js` (o junto a
  `stageProgress`):

  ```js
  export const stageDays = (p) => p?.stages?.[p?.currentStageIndex ?? 0]?.days ?? [];
  ```

- Se sustituyen las lecturas de `p.days` y los ternarios
  `hasStages ? stages[idx].days : p.days` por `stageDays(p)`. Recuento real
  (sep-2026, sin tests): `useStore.js` 29, `HomeScreen` 8, `ClientsScreen` 7,
  `OnboardingScreen` 6, `clientLogs.js` 4 — y de ésos, buena parte son
  `stage.days` legítimos que se quedan. La fase es **más pequeña** de lo que
  decía este párrafo.
- `withStages` pierde la línea del espejo y se queda en "asigna etapas y
  clampa el índice"; `ensureStages` no cambia (sigue envolviendo programas
  antiguos en una etapa).
- Migración: `delete p.days` en cada programa. Sin más — y **después** del
  `ensureStages` que ya corre ahí, no antes: es de `p.days` de donde
  `ensureStages` saca los días de un programa antiguo.

**Y es más barata todavía, por algo que no se ve leyendo las pantallas:** el
bloque de `onRehydrateStorage` **ya pasa `ensureStages` por todos los programas**
([useStore.js:3962](../../store/useStore.js)). O sea que, para el estado
persistido, la rama `: p.days` de cada ternario `hasStages ? … : p.days` es
**código muerto desde que se implantaron las etapas**. Esta fase no cambia
comportamiento: borra ~15 ramas que ya no se ejecutaban.

**Requisito previo, y no es opcional:** cerrar antes la puerta 2 de §3.2
(`importForClient` sin `ensureStages`). Es el único sitio por el que hoy entra al
estado en caliente un programa sin etapas; con el espejo borrado, ese programa se
pintaría **vacío** hasta el siguiente arranque.

**Sigue yendo la última**, ahora por dependencia y no por tamaño: necesita la
puerta 2 cerrada. Es la de menos beneficio inmediato —no arregla ningún fallo
conocido, sólo quita la posibilidad de que vuelva a aparecer uno como el que
motivó `withStages`— así que si hay que dejar una sin hacer, sigue siendo ésta.

---

## 6. Orden, coste y lo que no se toca

| Fase | Qué se lleva por delante | Coste | Riesgo |
|---|---|---|---|
| 1 — `owner` + `kind` | la fuga de sesiones huérfanas, el robo de programa al restaurar, las cuatro ramas de `importData`, `clientPrograms.js`, `secondaryProgramIds`, dos de las tres copias de `parseImportFile`, las ~60 líneas de `exportProgramWithLog` y los dos programas fantasma de la semilla | 1-2 sesiones | medio: toca el protocolo con el cliente. `clientSync.sim.test.js` es la red |
| 2 — `sessions` | un diccionario, `resetTemplate`, `restoreSession`, el `??` de cada lectura **y las seis suscripciones dobles de las pantallas** | 1 sesión | bajo: `getEffectiveTemplate` absorbe el cambio |
| 3 — sin espejo | `withStages` a la mitad, ~15 ternarios que ya no se ejecutaban, y una clase entera de deriva | 1 sesión | bajo. **Depende de** cerrar la puerta 2 de §3.2 |

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
| Semilla | `PROGRAMS` / `SESSION_TEMPLATES` | `{}` / `{}` | estado inicial §4.3 — **adelantado a la fase 1** |
| Espejo de etapa | `program.days` | `stageDays(p)` | `delete p.days` §5 |
| Fichero | `version: '2'` | `version: '3'` | escritura en `_buildProgramJson` + `buildBackupPayload`; lectura v1/v2 en `normalizeIncomingProgram` |
| Validador de versión | 3 copias con `['1','2']` | `mobile/src/utils/importFile.js` con `['1','2','3']` | §3.2 |

Las tres migraciones de estado son **idempotentes** y viven juntas en el bloque
de `onRehydrateStorage`, con las de etapas, tags y colores. Como la app no está
publicada, se pueden borrar todas de golpe antes de la primera versión pública:
déjalas marcadas con un comentario `// migración pre-publicación` para que se
vayan juntas y no queden ahí de por vida.
