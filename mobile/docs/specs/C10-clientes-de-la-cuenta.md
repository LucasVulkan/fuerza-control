# Spec — Los clientes son de la cuenta, y su estado es un solo valor

> Tema: conexión
> En corto: Con cuenta de entrenador, todos los clientes (con app o sin ella) viven en la cuenta con un id para siempre, y recuperar la cuenta en un móvil nuevo los trae todos con su ficha, su programa y su historial. De paso, el estado de cada ficha deja de ser siete banderas sueltas y pasa a ser un solo valor con sus cambios escritos en un sitio.
> Fase C10-01 · pendiente · El estado de la ficha en un solo valor, solo en el móvil · §10.1
> Fase C10-02 · pendiente · Servidor: hueco sin código, tabla privada, ids que no se pierden · §10.2
> Fase C10-03 · pendiente · Un id para siempre: recuperar usa el de la ficha · §10.3
> Fase C10-04 · pendiente · Cada cliente con su hueco: subir, invitar y cancelar en el modelo nuevo · §10.4
> Fase C10-05 · pendiente · Guardar en la cuenta: ficha, programas y lo apuntado · §10.5
> Fase C10-06 · pendiente · Restaurar una copia con este modelo · §10.6
> Fase C10-07 · pendiente · Deshacer al borrar un cliente · §10.7
> Fase C10-08 · pendiente · De punta a punta: móvil nuevo, reglas con su test y prueba en dispositivo · §10.8
>
> Estado: **planificación para revisar, sin código** (28-oct-2026). Implementa
> las reglas N-15 y N-17 del [mapa del núcleo](../nucleo.md), que manda sobre
> esta spec, y absorbe tres fases de [I04](I04-simplificar-nucleo.md): I04-02
> (restaurar) pasa a C10-06, I04-08 (estado de la ficha) a C10-01 y C10-04, e
> I04-10 (deshacer al borrar) a C10-07. Va **antes de la primera release**. Las
> decisiones que esperan al usuario están en §11; las reglas nuevas que propone
> (N-18…N-20, §9.2) pasan al mapa cuando se aprueben.

---

## 1. Qué cambia, en una página

Hoy un cliente **sin app** solo existe en el móvil del entrenador: si pierde el
móvil y no tenía copia de Drive, lo pierde. Uno **con app** tiene hueco en el
servidor, pero al recuperar la cuenta vuelve con otro id, sin su ficha (notas,
cobros, peso, etiquetas) y solo con el último programa que se le envió. Y el
estado de cada ficha son siete banderas (`syncSlotId`, `syncCode`,
`syncLinked`, `syncOrphan`, `syncPending`, `syncLeftAt` y, en el envío,
`programDirty`…) que cada función tiene que combinar bien.

Con esta spec:

1. **Con cuenta, cada cliente tiene su hueco desde que existe.** «Sin app» es un
   hueco **sin código**; invitar es darle código; conectado, alguien sentado.
2. **Un id para siempre.** El id de la ficha (`client_…`) es el mismo en el
   móvil, en el hueco (`local_id`) y en las copias. Recuperar usa ese.
3. **La cuenta guarda la ficha, los programas y lo apuntado** en una tabla que
   el cliente no puede leer. Guardar no es enviar: lo que ve el cliente sigue
   siendo solo lo que el entrenador envía (N-06).
4. **El estado de la ficha es un solo campo**, `link`, con seis valores, y una
   función pura dice qué cambios se permiten.
5. **Sin cuenta, nada cambia**: los clientes viven en el móvil y la copia de
   Drive es su única copia.

Lo que **no** hace (y se queda fuera a propósito): juntar lo que el entrenador
haga en dos móviles a la vez (N-10), dejar que el cliente lea nada de lo privado,
ni cambiar nada del lado del cliente salvo restaurar (§8.1).

## 2. Modelo de datos

### 2.1 Servidor

Tres cambios en tablas y cinco en funciones. Todo en `supabase/schema.sql`, que
sigue siendo idempotente y **compatible con la app de hoy** (se puede desplegar
antes que la app nueva: C10-02).

```sql
-- ── El código pasa a ser opcional: «sin app» = hueco sin código ─────────────
-- El índice único trainer_clients_code_key ya admite varios null.
alter table public.trainer_clients alter column client_code drop not null;

-- ── Lo privado del entrenador (N-17) ────────────────────────────────────────
-- Una fila por hueco. El cliente NO tiene política de lectura: aunque esté
-- sentado en el hueco, esta tabla no la ve. Nadie escribe directamente (R-A2).
create table if not exists public.trainer_client_private (
  slot_id       uuid primary key references public.trainer_clients(id) on delete cascade,
  card_json     jsonb not null,   -- la ficha (§2.3)
  programs_json jsonb,            -- sus programas, sus sesiones y los ejercicios propios que usan
  saved_at      timestamptz not null default now()
);
alter table public.trainer_client_private enable row level security;
create policy trainer_reads_own_private on public.trainer_client_private
  for select to authenticated
  using (exists (select 1 from public.trainer_clients t
                  where t.id = slot_id and t.trainer_id = auth.uid()));
revoke all    on public.trainer_client_private from anon, authenticated;
grant  select on public.trainer_client_private to authenticated;

-- ── La cuenta conoce a sus borrados por id de cliente (N-04) ─────────────────
alter table public.deleted_slots add column if not exists local_id text;
```

Sin `trainer_id` en la tabla privada: cuelga del hueco, así que el traspaso de
cuenta (R-D1) y borrar la cuenta (cascada de `trainer_clients`) la arrastran sin
tocarla.

Funciones (todas `security definer`, comprueban dueño en la misma sentencia
que escriben, R-A3, y se añaden a la lista de §10 de `schema.sql`):

| Función | Qué hace | Error |
|---|---|---|
| `trainer_create_slot(name, local_id, p_with_code boolean default true)` | Como hoy; con `p_with_code = false` el hueco nace **sin código**. Con el mismo `local_id` devuelve el mismo hueco (E35). La app de hoy la sigue llamando con dos argumentos y le sale con código. | — |
| `trainer_reissue_client_code(slot)` | **Sin cambios.** Sobre un hueco sin código es **invitar**: código nuevo, asiento vacío, `disconnected_at` null. | `SLOT_GONE` |
| `trainer_clear_code(slot)` *(nueva)* | **Cancelar la invitación**: quita el código y lo enviado (`program_json`, `overrides_json` y sus fechas). El hueco, su historial y lo privado se quedan. Solo con el asiento vacío. | `SLOT_OCCUPIED`, `SLOT_GONE` |
| `trainer_save_client(slot, card, programs)` *(nueva)* | **Guardar en la cuenta**: inserta o pisa la fila privada y pone `client_name = card->>'name'` (es lo único de la ficha que ve el cliente: la pantalla de confirmar el código). | `SLOT_GONE` |
| `trainer_set_local_id(slot, local_id)` *(nueva)* | Fija el id de cliente de un hueco (migración, §4.2). Si otro hueco de la misma cuenta ya lo tiene, falla: nunca dos huecos para una ficha (N-08). | `DUPLICATE_CLIENT`, `SLOT_GONE` |
| `trainer_known_clients()` *(nueva)* | Los ids de cliente que la cuenta conoce: los de sus huecos (`alive = true`) y los de `deleted_slots` (`alive = false`). Para restaurar (§8.1). | — |
| `trainer_delete_slot(slot, kind)` | Como hoy, y además apunta el `local_id` en `deleted_slots`. | — |
| `accept_transfer('slots', from)` | **Conserva el `local_id`** (hoy lo pone a null y es la razón de que un cliente traspasado pierda su id). Si la cuenta nueva ya tiene un hueco con ese id, ese se queda null y la app lo vuelve a fijar (§4.2). Mueve también las filas de `deleted_slots`. | — |

```sql
-- accept_transfer, rama 'slots':
update public.trainer_clients t
   set trainer_id = v_me,
       local_id = case when exists (select 1 from public.trainer_clients d
                                     where d.trainer_id = v_me and d.local_id = t.local_id)
                       then null else t.local_id end
 where t.trainer_id = p_from;
get diagnostics v_count = row_count;
update public.deleted_slots set trainer_id = v_me where trainer_id = p_from;

-- trainer_clear_code:
update public.trainer_clients
   set client_code = null, disconnected_at = null,
       program_json = null, program_updated_at = null,
       overrides_json = null, overrides_updated_at = null
 where id = p_slot_id and trainer_id = public._trainer() and client_id is null;
if found then return; end if;
if exists (select 1 from public.trainer_clients where id = p_slot_id and trainer_id = public._trainer())
  then raise exception 'SLOT_OCCUPIED'; end if;
raise exception 'SLOT_GONE';

-- trainer_save_client:
update public.trainer_clients set client_name = p_card->>'name'
 where id = p_slot_id and trainer_id = public._trainer();
if not found then raise exception 'SLOT_GONE'; end if;
insert into public.trainer_client_private (slot_id, card_json, programs_json, saved_at)
values (p_slot_id, p_card, p_programs, now())
on conflict (slot_id) do update
  set card_json = excluded.card_json, programs_json = excluded.programs_json, saved_at = now();
```

Lo que **no** cambia: `link_client_to_slot` (un hueco sin código no se puede
canjear porque `client_code = null` no casa con nada), `get_slot_by_code`, las
funciones del cliente, `trainer_upload_log` (ya solo escribe con el asiento
vacío, que es justo el caso «sin app»), `_merge_history` (ya suma y respeta
lápidas) y la RLS de `trainer_clients`. El cliente sigue pudiendo leer su fila
entera, y ya no hay nada privado en ella.

`audit.sql` añade dos comprobaciones: filas privadas cuyo hueco es de otro
entrenador (no puede pasar por la FK, pero se mira) y huecos de una cuenta con el
mismo `local_id` (el índice lo impide; se mira por si alguien lo quita).

### 2.2 La ficha en el móvil

```js
clients[id] = {
  id: 'client_…',       // para siempre: móvil, hueco (local_id), copias
  link:   'local' | 'none' | 'invited' | 'linked' | 'left' | 'otherAccount',  // §3
  slotId: uuid | null,  // null ⇔ link === 'local'
  code:   string | null,// solo con invited · linked · left
  leftAt: ISO | null,   // solo con left
  savedSig: string | null, // firma de lo último guardado en la cuenta (§6); nunca viaja en copias
  // la ficha (§2.3), igual que hoy
  // el envío (I04-03), igual que hoy: programDirty, overridesDirty, programUploadedSig, programUploadedAt
  // espejos del servidor, igual que hoy: remoteSessionsCount, progress
}
```

| Hoy | Pasa a |
|---|---|
| `syncSlotId` | `slotId` |
| `syncCode` | `code` |
| `syncLinked`, `syncOrphan`, `syncLeftAt` (como estado) | `link` |
| `syncLeftAt` (la fecha) | `leftAt` |
| `syncPending` (alta en vuelo, persistida) | `ui.linking[clientId]`, **sin persistir**: es una reserva de segundos, y hoy hay un suscriptor solo para limpiarla al arrancar |
| `programMissing` | `recoverMissing`: lo mismo, ahora para ficha y programas (§8.2) |
| `syncErrorAt` | es del lado del cliente (`clientSync`), no de la ficha: no se toca |

Invariantes, comprobadas por una función `assertLink(c)` que usan los tests:
`slotId` es null si y solo si `link === 'local'`; `code` no es null solo en
`invited`, `linked` o `left`; `leftAt` solo en `left`.

### 2.3 Qué es «la ficha» y qué son «sus programas»

- **`card_json`** — todo lo que el entrenador escribe del cliente: `name`,
  `fullName`, `phone`, `email`, `notes`, `billing`, `bodyWeight`, `status`,
  `color`, `createdAt`, `activeProgramId`, `nextOverrides` (las prescripciones
  en preparación) y `tags` **con su nombre** (`[{ id, name }]`: el registro de
  etiquetas es del móvil, y una ficha recuperada sin él enseñaría
  `tag_a1b2c3d4`, fallo 25).
- **`programs_json`** — `{ programs, sessionTemplates, customExercises }`: los
  programas con `owner === id` (activo y archivados), sus sesiones, sus sesiones
  libres, y solo los ejercicios propios que usan. El mismo formato que el archivo
  de un programa, para reutilizar `importForClient`.
- **Lo apuntado** (historial de un cliente sin app) no va aquí: va al
  `history_json` del hueco con `trainer_upload_log`, que ya suma y respeta lo
  borrado. Es donde lo encuentra el cliente si un día entra (R-C6).

Nada de esto contiene el estado de conexión, el envío ni `savedSig`.

## 3. Estados y transiciones (N-15)

### 3.1 Los seis valores de `link`

| `link` | Qué es | Hueco | Código | Se le envía | Se guarda en la cuenta | Cuenta como «con app» |
|---|---|---|---|---|---|---|
| `local` | Sin hueco: entrenador sin cuenta, o con cuenta y aún por subir (§5) | no | — | no | no (está por subir) | no |
| `none` | **Sin app**, guardado en la cuenta | sí | no | no | sí | no |
| `invited` | Tiene código, nadie dentro | sí | sí | sí | sí | sí |
| `linked` | El cliente está dentro | sí | sí | sí | sí | sí |
| `left` | Se fue él (se desconectó); el código le sirve para volver | sí | sí | sí | sí | sí |
| `otherAccount` | Su hueco no es de la cuenta puesta (o no hay cuenta puesta) | sí | — | no | no | no |

Respecto a §4.1 del mapa: «sin app» se parte en `local` y `none` (con N-17 son
cosas distintas: una está a salvo en la cuenta y la otra no), y desaparece
«perdido» (I04-08 lo tenía como `lost`): para el entrenador, un hueco que ya no
está en su cuenta sin que él lo borrara es `otherAccount`, y la salida es la
misma (volver a la cuenta que lo tiene).

### 3.2 La función pura

Un archivo, `src/utils/clientLink.js` reescrito, sin imports del store:

- `linkFromSlot(slot)` → lo que dice una fila del servidor: sin código `none`;
  con `client_id` `linked`; con `disconnected_at` `left`; si no, `invited`.
- `nextLink(link, event)` → el valor nuevo, o **el mismo** si el cambio no está
  permitido (y lo deja en el registro). Nunca lanza: quien llama ya ha hablado
  con el servidor y no se puede deshacer eso.
- Lecturas, para que nadie compare cadenas sueltas: `hasSlot`, `withApp`
  (invited · linked · left), `canSend` (= `withApp`), `canSave` (none · invited
  · linked · left), `isReadOnly` (`otherAccount`).
- `clientLink(c)` se queda como lectura para las pantallas de hoy
  (`'none' | 'invited' | 'linked'`), calculada de `link`, para no tocar todas las
  pantallas en C10-01.

| Evento | Desde | A | Quién lo lanza |
|---|---|---|---|
| `uploaded` | local | none | subir a la cuenta (§5) |
| `codeGiven` | none · invited · linked · left | invited | invitar, reemitir, pasar a la app |
| `codeCleared` | invited · left | none | cancelar la invitación |
| `server(slot)` | none · invited · linked · left · otherAccount | `linkFromSlot(slot)` | refresco: el hueco está en esta cuenta |
| `slotMissing` | none · invited · linked · left | otherAccount | refresco: el hueco no está y esta cuenta no lo borró; o un envío recibe `SLOT_GONE` |
| `accountLeft` | none · invited · linked · left | otherAccount | salir de la cuenta (N-09) |
| `slotCancelled` | none · invited · linked · left · otherAccount | local | refresco: un móvil con la versión de hoy **canceló** su invitación borrando el hueco (`deleted_slots.kind = 'cancelled'`) |
| `accountDeleted` | todos | local | borrar la cuenta |

Borrar no es un estado: la ficha deja de existir (§8.3). Que otro móvil de la
cuenta la borrara (`kind = 'deleted'`) también la quita aquí (R-B10).

Un test por fila y uno por cada pareja **no** permitida (p. ej. `codeGiven`
desde `local` o desde `otherAccount` devuelve lo mismo).

### 3.3 Cada operación del mapa §5 en este modelo

| Operación | Red | Qué hace ahora | Evento |
|---|---|---|---|
| **Crear un cliente** *(no estaba en el mapa)* | no | Ficha `local`. Con cuenta, la subida (§5) le crea el hueco sin código en cuanto hay red. Sin cuenta se queda `local`. | — |
| Invitar | sí (N-03) | Si es `local`, primero se sube; luego `trainer_reissue_client_code`. Envía el programa de entrada (N-06, I04-03). | `uploaded`, `codeGiven` |
| Reemitir el código | sí | Igual que hoy. | `codeGiven` |
| Cancelar la invitación | sí | `trainer_clear_code`. Ya no borra el hueco: lo apuntado y lo privado se quedan. | `codeCleared` |
| Canjear el código (cliente) | sí | Sin cambios. El entrenador lo ve al refrescar. | `server` |
| Desconectarse (cliente) | cola | Sin cambios (R-B9). El entrenador lo ve al refrescar. | `server` |
| Borrar un cliente | cola | Deshacer unos segundos y luego como hoy (§8.3). | — |
| Pasar a la app | sí | Es **invitar**: lo apuntado ya está en el hueco (§6), así que desaparece `pushTrainerLogToSlot` como paso aparte. | `codeGiven` |
| Enviar programa o prescripciones | cola | Sin cambios (I04-03), solo si `canSend`. | — |
| Subir / bajar el historial | cola / sí | Sin cambios. | — |
| Refrescar los huecos | sí | Sube los `local` (§5), borra los pendientes, lee los huecos, aplica `server`/`slotMissing`/`slotCancelled`, recupera los que faltan **por su id** con su ficha (§8.2), fija ids que no cuadran (§4.2) y guarda lo pendiente (§6). | varios |
| Crear cuenta o entrar | sí | Como hoy (`_enterCandidate`) y, al final, el refresco, que sube los clientes de antes con su hoja (§5). | — |
| Recuperar la cuenta | sí | Igual: el refresco trae todos los huecos con su ficha, sus programas y su historial. | — |
| Pasar a Google o Apple | sí | Como hoy; el traspaso conserva los ids (§2.1). Los `link` no cambian. | — |
| Salir | no | Como hoy. Las fichas con hueco pasan a `otherAccount`; las `local` se quedan. | `accountLeft` |
| Borrar la cuenta | sí | Como hoy (R-D4). El servidor se lleva huecos y fichas privadas en cascada; en el móvil todas pasan a `local` con todo lo suyo. | `accountDeleted` |
| Copia en Drive | sí | Sin estado (§8.1). | — |
| Restaurar / importar copia | sí con cuenta | §8.1. | `uploaded` para los añadidos |
| Comprar, restaurar compras, caducar, elegir activos | — | Sin cambios; los límites cuentan con `withApp` (§7). | — |

## 4. Migración

### 4.1 Móviles con datos de hoy (al arrancar, sin red)

En `onRehydrateStorage`, como las otras migraciones previas a publicar, una
función pura `migrateClientLinks(clients, trainerSync)` en `clientLink.js`. Es
idempotente: una ficha que ya tiene `link` no se toca.

| Ficha de hoy | `link` |
|---|---|
| sin `syncSlotId` | `local` |
| con `syncSlotId` y la cuenta sin `userId` (salió de la cuenta) | `otherAccount` |
| `syncOrphan` | `otherAccount` |
| `syncLinked` | `linked` |
| `syncLeftAt` | `left` (y `leftAt`) |
| con `syncSlotId`, nada de lo anterior | `invited` |

`syncSlotId` → `slotId`, `syncCode` → `code`; las banderas viejas y `syncPending`
se borran; `savedSig` nace null. Nada más cambia en la ficha. El test lleva una
ficha de cada fila, guardada como la guarda la versión de hoy (sacada de los
`*.sim.test.js`), y comprueba `assertLink` sobre el resultado.

### 4.2 Lo que se arregla en el primer refresco con red

- **Fichas `local` con cuenta** (los clientes sin app de hoy): se suben con la
  hoja de §5. El entrenador ve «Subiendo tus N clientes a tu cuenta» una vez.
- **Huecos sin `local_id`** (creados por versiones viejas, o traspasados, porque
  `accept_transfer` lo borraba): si una ficha de este móvil tiene ese `slotId`,
  `trainer_set_local_id(slot, ficha.id)`.
- **Ficha cuyo id no coincide con el `local_id` de su hueco** (fue recuperada
  con un id nuevo por `refreshTrainerSlots`): **gana el id de la ficha**, y se
  fija en el hueco. Motivo: el id del móvil está en sus programas (`owner`), en
  `clientLogs`, `freeClientIds`, `lastSeenSessionsCount`, el entreno en curso y
  sus copias de Drive; reescribirlo en todos esos sitios es un cambio con muchas
  más formas de fallar que cambiar una columna. Lo que cuesta: una copia de
  Drive hecha **en el móvil antiguo** (con el id viejo) añadiría ese cliente otra
  vez al restaurarla (§8.1). Duplica, no pierde, y solo afecta a copias
  anteriores a esta versión de alguien que ya recuperó la cuenta en otro móvil:
  datos de prueba. Se dice en las notas de la versión.
- **Fichas que nunca se guardaron** (`savedSig` null y `canSave`): el primer
  pase de guardar (§6) las sube todas. Hasta entonces, recuperar en otro móvil
  las trae como hoy (con el último programa enviado).
- **`DUPLICATE_CLIENT`** al fijar un id (dos huecos de la cuenta para la misma
  ficha, solo posible con datos de antes de E35): la ficha se queda con el hueco
  que ya tenía y el otro se deja; `audit.sql` lo enseña. No se borra nada solo.

### 4.3 Filas del servidor

`schema.sql` se vuelve a ejecutar entero (como siempre). No mueve datos: el
código pasa a opcional, la tabla privada nace vacía y `deleted_slots.local_id`
nace null para lo ya borrado (esos borrados viejos no se reconocerán al
restaurar una copia: §8.1 los añadiría; es el mismo caso de datos de prueba que
arriba). La app de hoy sigue funcionando sobre el esquema nuevo: no usa las
funciones nuevas, `trainer_create_slot` con dos argumentos crea con código, y
nunca ve un hueco sin código porque no los crea. **Se despliega el SQL antes que
la app** (C10-02) y se prueba con el banco cargando el esquema de hoy, datos, y
encima el nuevo (`createServer({ schema })` ya lo permite).

### 4.4 Copias viejas de Drive

Traen las banderas `sync*`, `programDirty` y compañía. Restaurar las **ignora
todas** (§8.1): de una copia solo entra contenido. Con cuenta, sus clientes se
comparan por id con lo que la cuenta conoce; sin cuenta, entran `local`.

## 5. Subir los clientes de antes de la cuenta

**Cuándo.** En el refresco de los huecos, que ya corre al crear la cuenta, al
entrar o recuperarla, al abrir Clientes y al volver a primer plano. Cualquier
ficha `local` con la cuenta puesta se sube. Eso cubre los clientes de antes de
la cuenta, los creados sin red, los añadidos al restaurar (§8.1) y los de
fichas cuya invitación canceló un móvil viejo (`slotCancelled`).

**Cómo**, por cliente y en orden: `trainer_create_slot(name, id, false)` →
`trainer_save_client` (§6) → `trainer_upload_log` si tiene algo apuntado →
`uploaded`. Repetirlo no duplica nada: el hueco es el mismo por `local_id`
(E35), guardar pisa la misma fila y el historial suma (R-C3).

**Cómo se ve.** Si hay **más de uno** por subir y es justo después de crear la
cuenta o entrar, una hoja: «Subiendo tus N clientes a tu cuenta» con «3 de 8» y
sin botón de cancelar (no hay nada que deshacer: lo subido es copia). Al acabar,
«Tus N clientes están en tu cuenta». Un cliente suelto creado con cuenta se sube
sin decir nada. En el resto de momentos, en silencio.

**Sin red o si falla a medias** (N-03, R-C7). Crear la cuenta ya necesita red,
así que la subida empieza con red; si se corta, la hoja dice «Faltan N clientes
por subir. Se subirán solos cuando vuelva la conexión» con «Entendido». Los
subidos quedan `none`; los demás, `local`, y el siguiente refresco sigue por
donde iba. Mientras quede alguno `local`, Mi cuenta lo dice («N clientes aún no
están en tu cuenta») sin botón: se suben solos. Un fallo que no es de red (p.
ej. `NOT_A_TRAINER`) pasa por el traductor de errores (N-14) y se reintenta en
el siguiente refresco.

**Lo que no hace.** No pregunta cuáles subir: N-17 dice que con cuenta todos son
de la cuenta. No mira el plan gratis: los clientes ya existían (§7).

## 6. Guardar en la cuenta

**Qué.** Para cada ficha con `canSave` (none · invited · linked · left) y no
congelada: la ficha y sus programas con `trainer_save_client`, y, si nadie está
dentro del hueco (todo menos `linked`), lo apuntado con `trainer_upload_log`.
Si `trainer_upload_log` responde `SLOT_OCCUPIED`, el cliente acaba de entrar:
se deja lo apuntado y el refresco lo pondrá `linked`.

**Cuándo hay algo que guardar** (regla N-18, propuesta): **por firma, no por
marca.** `saveSig(state, id)` es la firma de lo que se guardaría ahora
(`card_json` + `programs_json` + ids y `updatedAt` de lo apuntado, con la
`programSignature` que ya existe). Hay algo pendiente si `saveSig !== savedSig`;
al confirmar el servidor, `savedSig` = la firma de lo que se subió (no la de
ahora: si cambió mientras viajaba, sigue pendiente, como E55). Sin cola que
vaciar ni que se desincronice: sale de comparar, sobrevive a cerrar la app, a
salir y volver a la cuenta, y una ficha recuperada nace con su `savedSig` y no
se vuelve a subir.

**Guardar no es enviar** (N-17, N-06). Guardar escribe en la tabla privada y en
`history_json` con el asiento vacío; nunca en `program_json` ni en
`overrides_json`, que son lo que lee el cliente. «Cambios sin enviar» y «En cola»
siguen siendo solo del envío.

**Lo que se ve.** Nada en la ficha. En Mi cuenta, una línea: «Tus clientes
están guardados en tu cuenta» o, si queda algo pendiente sin red, «Hay cambios
de N clientes por guardar; se guardarán al volver la conexión».

**Cuando no se puede guardar** (decidido por el usuario el 28-oct-2026). Lo
que falla al guardar (sin red, servidor caído, error) **no se pierde ni se
olvida: queda en la cola de cosas por subir** y se reintenta solo hasta que
entre: al volver la red, al volver a primer plano, al arrancar y con espera
creciente (como la cola de I04-03). La «cola» es la firma: un cliente está en
ella mientras `saveSig !== savedSig`, así que sobrevive a cerrar la app y no se
puede desincronizar. Si un error no es de red y se repite, se registra para
«Enviar informe» (N-16) y se sigue reintentando con espera; nunca se descarta
en silencio. Se ve en Mi cuenta con la línea de arriba.

**Cuándo se guarda — decidido (D1, §11): A, continuo.**

- **A · Continuo (recomendada).** Un suscriptor del store, como el del envío
  silencioso de hoy: tras un cambio en `clients`, `programs`, `sessionTemplates`
  o `clientLogs`, espera 5 s sin cambios y guarda los que tengan la firma
  distinta, uno detrás de otro y con un cerrojo (como `sendPendingPrograms`).
  Además al arrancar, al volver a primer plano, al volver la red y en cada
  refresco, con los mismos reintentos que la cola de I04-03.
- **B · En los mismos momentos que la copia de Drive.** Al terminar un entreno,
  a diario o a mano, según lo que el entrenador eligió para Drive.

Por qué A: la copia de Drive es **opcional** (hay que conectar Google y elegir
frecuencia) y puede estar apagada, así que con B un entrenador sin Drive no
tendría nunca sus clientes sin app en la cuenta, que es justo lo que promete
N-17. Además «al terminar un entreno» no cubre lo que más cambia en una ficha
(notas, cobros, programas editados), y B haría que un móvil perdido se lleve
hasta un día de cambios. Lo que cuesta A: un suscriptor más con su cerrojo, y
escrituras frecuentes al servidor (pocas: una por cliente cambiado cada vez que
el entrenador para de tocar, de unos KB). Con la firma, A y B usan el mismo
código; B solo cambia el disparador, así que pasar de una a otra después es
barato.

## 7. Plan gratis (R-E1…R-E4)

`FREE` no cambia: 3 clientes, 1 con app. Lo que cambia es **qué es «con app»**:

- `isConnected(c)` pasa a `withApp(c.link) || ui.linking[c.id]`: tiene código
  (invitado, dentro o se fue) o se le está dando ahora. **Tener hueco ya no
  cuenta**, porque con cuenta lo tienen todos. `none` y `local` son «sin app»;
  `otherAccount` sigue sin ocupar plaza con app (C09 §3.4) y sí cuenta en los 3.
- **R-E1.** La puerta de crear cuenta todos (`clientLimitReason` con un `local`
  nuevo). La de invitar mira `withApp`. Subir a la cuenta (§5) y recuperar no
  pasan por la puerta: no crean clientes, los guardan. Restaurar por encima del
  límite se acepta, como hoy (I02 decisión 1).
- **R-E2.** Un congelado es solo lectura: como no cambia, no hay nada que
  guardar, y la firma lo garantiza sin una comprobación más. El refresco le
  sigue actualizando `link`, el contador y nada más; la ficha recuperada de un
  congelado sí baja (es devolverle al entrenador lo suyo, como E39). Enviar a un
  congelado sigue prohibido (N-12, I04-03).
- **R-E3.** No se borra ni se oculta nada: los congelados siguen guardados en la
  cuenta tal como estaban.
- **R-E4.** Sin cambios: el suscriptor que fija la elección ya funciona por ids,
  y ahora los ids no cambian al recuperar, así que la elección guardada en un
  móvil sigue valiendo para los mismos clientes. Recuperar en un móvil nuevo sin
  elección guardada saca la hoja de elegir, como reinstalar hoy.
- **R-E7** (límites solo en la app): cuando se parchee, el servidor contará los
  huecos **con código**, no todos. Se anota en I02.

## 8. Restaurar, recuperar y deshacer

### 8.1 Restaurar una copia (absorbe I04-02; N-04, N-05, N-08)

**La copia deja de llevar estado.** `buildBackupPayload` quita de cada ficha
`link`, `slotId`, `code`, `leftAt`, `savedSig`, `programDirty`,
`overridesDirty`, `programUploadedSig`, `programUploadedAt` y
`remoteSessionsCount`, y no lleva `freeClientIds` (dentro de `profile`) ni la
cola de I04-03. Al restaurar se quitan otra vez (las copias viejas los traen) y
se quitan también las banderas `sync*`.

**Por partes** (N-04): mis programas y plantillas · mi historial · ejercicios y
ajustes · clientes. Cada parte reemplaza la suya, salvo el historial (suma, R-C3)
y las plantillas (suman; con el mismo id gana la del móvil).

**La parte de clientes:**

- **Sin cuenta: reemplaza.** Fuera todas las fichas del móvil con sus programas e
  historial; entran las de la copia, todas `local`. Se avisa antes de lo que se
  pierde.
- **Con cuenta: solo añade** lo que la cuenta no ha conocido nunca. Necesita red:
  sin ella, la casilla de clientes se desactiva con «Necesitas conexión para
  restaurar clientes» y el resto de partes se puede restaurar igual.
  1. `trainer_known_clients()`.
  2. Cliente de la copia cuyo id la cuenta **conoce**, vivo o borrado: no se
     toca, ni su ficha ni su historial. Borrado = borrado (N-13: para eso está
     Deshacer).
  3. Cliente cuyo id la cuenta **no conoce** y tampoco está en el móvil: entra
     `local` con su ficha, sus programas y su historial, y la subida (§5) lo
     sube.
  4. La hoja final lo dice: «Se han añadido N clientes; M ya estaban en tu cuenta
     y se han dejado como están».

**Después, en el acto (N-05):** refresco de huecos, PRO a la tienda, y en el
móvil de un cliente conectado, su programa a su hueco. Restaurar dos veces la
misma copia no cambia nada (test).

**Importar un programa suelto** sigue siendo contenido y se puede siempre, sin
red.

### 8.2 Recuperar la cuenta en un móvil nuevo

El refresco recupera **todo hueco de la cuenta que no tenga ficha aquí**:

1. La ficha nace con **`id = slot.local_id`** (si un hueco no tiene, que solo
   puede ser de datos viejos, uno nuevo que se fija con `trainer_set_local_id`),
   `link = linkFromSlot(slot)`, su `slotId`, su `code` y `recoverMissing: true`.
2. Se bajan las filas privadas de los recuperados (una consulta, `in(slot_id)`).
   Con fila: la ficha sale de `card_json` (con sus etiquetas, que se suman al
   registro por id), sus programas de `programs_json` con `importForClient` y
   `savedSig` = la firma de lo bajado. Sin fila (hueco que aún no se guardó): como
   hoy, el programa de `program_json`.
3. El historial: el del hueco (`history_json`), que es lo apuntado si no tiene
   app y lo del cliente si lo tiene, con `mergeClientLog`.
4. Si algo falla, `recoverMissing` se queda y el siguiente refresco lo
   reintenta (E39). Una ficha recuperada que ya tiene programa asignado no se
   pisa.

N-08: el refresco **solo** crea fichas en este paso, y la clave es el id:
nunca puede haber dos fichas con el mismo id, así que tampoco dos para un hueco.
Si llega un hueco cuyo `local_id` ya es una ficha `local` de este móvil (se
restauró sin cuenta la copia y luego se entró en ella), **la cuenta manda**: la
ficha se queda con el hueco y se sustituye por la de la cuenta; el historial
suma. La hoja de §5 lo cuenta («M ya estaban en tu cuenta»).

### 8.3 Deshacer al borrar (N-13, absorbe I04-10)

1. Borrar quita la ficha, sus programas, sesiones e historial del móvil al
   momento (como hoy) y guarda una foto de lo quitado **en memoria**.
2. Sale el toast con «Deshacer» de P16-07, con su misma duración.
3. **Deshacer** devuelve la foto tal cual (ficha, programas, sesiones,
   historial y su lugar en `freeClientIds`). Como el servidor no se enteró, no
   hay nada más que hacer.
4. **Al irse el toast**, el hueco entra en `deletedSlotIds` y sigue el camino de
   hoy (C09 §3.5): se borra en el servidor en cuanto se puede.
5. Mientras dura el toast, el refresco **no recupera** ese hueco (si no, lo
   resucitaría al instante): ignora los ids de la foto.
6. Si la app se cierra durante esos segundos, el servidor nunca se enteró y el
   siguiente refresco **recupera el cliente**. Se acepta: es el lado seguro (no
   se pierde nada) y se dice en la ayuda («Si cierras la app justo después de
   borrar, el cliente vuelve»).

Una ficha `local` no tiene hueco: el paso 4 no hace nada.

## 9. Los cruces

### 9.1 Los 18 del mapa (§6), con este modelo

| # | Cruce | Cómo queda |
|---|---|---|
| 1 | Restaurar × clientes con app | Con cuenta solo entran ids desconocidos, siempre `local`; sin cuenta reemplaza, todo `local`. Ninguna ficha entra con hueco desde una copia (§8.1). |
| 2 | Restaurar × envíos | La copia no lleva marcas de envío ni de guardado (§8.1). |
| 3 | Restaurar × cliente conectado | N-05 tras restaurar: su programa se vuelve a pedir a su hueco (C10-06). |
| 4 | Sin red × enviar | Es de I04-03, no cambia. Guardar es otro camino y no se mezcla. |
| 5 | Cola × «cambios sin enviar» | Es de I04-03, no cambia. `savedSig` no es ninguna de las dos cosas. |
| 6 | Envío en vuelo × borrar | `patchClient` (I04-04). Durante el Deshacer el hueco sigue vivo y el envío llega; después, `SLOT_GONE` y `patchClient` no crea nada. |
| 7 | Cola × programa del invitado | I04-03; invitar envía el programa de entrada por el único camino. |
| 8 | Cambiar de cuenta × cola y pago | N-09, I04-03, I04-05. Lo pendiente de guardar no es una cola: sale de la firma y se guarda al volver a esa cuenta. |
| 9 | Cambiar de cuenta × clientes | Con y sin app pasan a `otherAccount`, de solo lectura (N-19), y vuelven con `server(slot)` al volver. |
| 10 | Pago pendiente × comprar | I04-05, no cambia. |
| 11 | Compra × otra cuenta de la tienda | I04-05, no cambia. |
| 12 | Caducar el PRO × cola | N-12. Guardar: un congelado no cambia, no hay nada que guardar. |
| 13 | Dos móviles del entrenador | N-10. El viejo solo guarda si se edita en él (la firma); lo último guardado gana, sin juntar. El nuevo recupera todo con id y ficha. |
| 14 | Dos móviles del cliente | No cambia (R-B2, R-B3). |
| 15 | Programa nuevo × lo descarta | N-07 (I04-09), no cambia. |
| 16 | Sin red × acciones de cuenta | N-03. Crear un cliente funciona sin red (`local`); subirlo espera a la red. |
| 17 | Borrar sin querer × deshacer | §8.3. |
| 18 | Error × pantalla | N-14: la hoja de subida, guardar y restaurar pasan por el traductor. |

### 9.2 Cruces nuevos y sus reglas

| # | Cruce | Qué pasaría | Regla |
|---|---|---|---|
| 19 | Guardar × enviar | Guardar el programa del entrenador lo haría llegar al cliente sin enviarlo | N-17: lo guardado va a la tabla privada; el cliente solo lee lo enviado |
| 20 | Subir los de antes × corte a mitad | Clientes a medio subir o subidos dos veces | Idempotente por `local_id` (E35); lo que falta queda `local` y sigue solo (R-C7) |
| 21 | Deshacer × refresco o cerrar la app | El refresco resucita el cliente que se está borrando | El refresco ignora la foto del Deshacer; cerrar la app hace que vuelva, no que se pierda (§8.3) |
| 22 | Copia restaurada sin cuenta × entrar luego en la cuenta | Dos versiones del mismo cliente | La cuenta manda (N-04): mismo id, se queda la de la cuenta; el historial suma (§8.2) |
| 23 | Salir de la cuenta × cambios sin guardar | Al salir se pierden | **N-18 · Guardar va por firma**: lo pendiente sale de comparar, no de una cola, y se guarda al volver; mientras, la ficha es de solo lectura (N-19) y no cambia más |
| 24 | Uno «de otra cuenta» × editarlo aquí | Cambios que no se pueden guardar en ninguna cuenta y que se pisarían al volver | **N-19 · De otra cuenta es solo lectura**: se ve, no se edita, no se envía, no se guarda. Para tocarlo, volver a su cuenta |
| 25 | Id de la ficha × id del hueco (datos de hoy, traspasos) | La copia no reconoce a su cliente (E78) | **N-20 · El id del cliente lo pone la ficha**: el hueco lo sigue (`local_id`), el traspaso lo conserva, y si no cuadran gana la ficha (§4.2) |
| 26 | Cancelar la invitación × lo apuntado | Hoy se borraba con el hueco | El hueco se queda: lo apuntado y lo privado siguen en la cuenta. Si se invita a otra persona en ese hueco, verá lo apuntado (R-B4: un hueco es una persona) |
| 27 | Borrar la cuenta × los clientes en la cuenta | — | Se borran del servidor en cascada y se quedan en el móvil como `local`, con todo (R-D4, C09 §3.7) |

## 10. Fases

Una detrás de otra, nunca en paralelo (mapa §9.3). Cada una deja la app
funcionando y se cierra con `npx vitest run` entero en verde y sus escenarios
nuevos. **Antes de C10-01** tienen que estar I04-04 (`patchClient`) e I04-03 (la
cola): C10-05 reutiliza los disparadores de reintento de la cola, y todas las
escrituras tras un `await` de esta spec pasan por `patchClient`.

Los escenarios nuevos van en `mobile/store/account.clients.sim.test.js` (Postgres
real con PGlite, varios móviles), y los de la función pura en
`mobile/src/utils/clientLink.test.js`.

| Fase | Qué | Depende de | Coste | Reglas | Estado |
|---|---|---|---|---|---|
| C10-01 | Estado en un valor, solo móvil | I04-03, I04-04 | 🔴 | N-15 | pendiente |
| C10-02 | Servidor | C10-01 | 🟡 | N-17, R-A1…A3, R-A9, R-D1 | pendiente |
| C10-03 | Id para siempre | C10-02 | 🟡 | N-17, N-08, N-20 | pendiente |
| C10-04 | Cada cliente con hueco | C10-03 | 🔴 | N-17, N-03, N-09, N-19, R-E1, R-C7 | pendiente |
| C10-05 | Guardar en la cuenta | C10-04, D1 | 🟡 | N-17, N-18, N-06, R-E2 | pendiente |
| C10-06 | Restaurar | C10-05 | 🟡 | N-04, N-05, N-08 | pendiente |
| C10-07 | Deshacer al borrar | C10-01 | 🟢 | N-13, R-B6, R-B10 | pendiente |
| C10-08 | De punta a punta | todas | 🟡 | todas las de arriba | pendiente |

### 10.1 C10-01 — El estado de la ficha en un solo valor, solo en el móvil

**Qué.** `clientLink.js` reescrito (§3.2), la migración de §4.1 en
`onRehydrateStorage`, y todo el código que hoy lee o escribe `sync*` en una
ficha pasa a `link`/`slotId`/`code`/`leftAt` (57 usos en `useStore.js`, 17 en
`ClientsScreen.jsx`, y `freePlan.js`, onboarding y `NextSessionScreen`). Ningún
`set` escribe `link` a mano: siempre `nextLink`. `syncPending` pasa a
`ui.linking`. **El comportamiento no cambia**: ni el servidor, ni lo que ve el
usuario. Con cuenta, los «sin app» de hoy salen `local` (aún no hay subida), y
`invited`/`linked`/`left`/`otherAccount` como hoy.

Regla de grep en el test de integridad: ningún `syncSlotId`, `syncLinked`,
`syncOrphan`, `syncPending`, `syncLeftAt` ni `syncCode` en `src/` ni en `store/`
fuera de `migrateClientLinks`.

**Tests.** Uno por transición y por pareja prohibida; migración con una ficha de
cada fila de §4.1; todos los `*.sim.test.js` de hoy en verde sin cambiar lo que
comprueban (solo los nombres de campos).

**Probar C10-01**

- [ ] Con la app de antes instalada y clientes de los tres tipos (sin app,
  invitado, conectado), actualizar a esta versión: la lista y cada ficha se ven
  igual que antes, con el mismo código en el invitado.
- [ ] Invitar a un cliente sin app, que lo canjee en otro móvil, y abrir
  Clientes: pasa a conectado.
- [ ] El cliente se desconecta desde su móvil: el entrenador lo ve como «se
  fue» y el mismo código le vuelve a servir.
- [ ] Salir de la cuenta: los clientes con app salen «En otra cuenta tuya»;
  volver a entrar con la misma cuenta los devuelve.

### 10.2 C10-02 — Servidor: hueco sin código, tabla privada, ids que no se pierden

**Qué.** Todo §2.1 en `schema.sql` y las dos comprobaciones nuevas de
`audit.sql`. Las funciones nuevas en `supabaseSync.js` (sin usarlas aún desde
el store). **Se despliega en Supabase al cerrar la fase**, antes de la app de
C10-03: la app publicada en pruebas sigue funcionando sobre él.

**Tests (banco).**
- El cliente sentado en un hueco **no lee** su fila privada; otro entrenador
  tampoco; un anónimo tampoco (R-A1). Nadie la escribe directamente (R-A2).
- Un hueco sin código no se canjea con ningún código (`CODE_NOT_FOUND`).
- `trainer_clear_code` con alguien dentro → `SLOT_OCCUPIED` y no cambia nada.
- Traspaso de código a Google: los `local_id` y los borrados viajan; con un
  `local_id` repetido en la cuenta destino, ese queda null y el resto viaja
  (R-D1).
- Compatibilidad: cargar el `schema.sql` de hoy, crear huecos y asientos con la
  app de hoy, cargar encima el nuevo, y el recorrido básico de
  `connection.sim.test.js` sigue en verde.

**Probar C10-02**

- [ ] Ejecutar `schema.sql` en el editor SQL de Supabase: sin errores.
- [ ] Ejecutar `audit.sql`: sale vacío.
- [ ] Con la app de la fase anterior: crear un cliente con app, que lo canjee y
  que el entrenador le envíe el programa. Todo funciona como antes.

### 10.3 C10-03 — Un id para siempre: recuperar usa el de la ficha

**Qué.** `refreshTrainerSlots` recupera con `id = slot.local_id` (§8.2, paso 1,
aún sin ficha privada: el programa de `program_json` como hoy). El primer
refresco fija los ids que faltan o no cuadran (§4.2) con `trainer_set_local_id`.
`generateId('client')` solo se llama al crear un cliente.

**Tests.**
- Recuperar la cuenta en un móvil nuevo: cada ficha tiene el mismo id que en el
  móvil viejo.
- Un móvil con una ficha recuperada con id distinto (como lo deja la versión de
  hoy): tras el primer refresco el hueco tiene el id de la ficha, y recuperar en
  un tercer móvil da ese id.
- Pasar de código a Google y recuperar en otro móvil: mismos ids.
- E78: recuperar la cuenta y restaurar una copia del móvil viejo no duplica
  ningún cliente con app.

**Probar C10-03**

- [ ] En un móvil con cuenta y un cliente con app, apuntar su nombre. Borrar los
  datos de la app (o instalar en otro móvil), recuperar la cuenta: el cliente
  vuelve, y restaurar la copia de Drive del primer móvil no lo duplica.

### 10.4 C10-04 — Cada cliente con su hueco: subir, invitar y cancelar en el modelo nuevo

**Qué.**
- La **subida** de §5 en el refresco, con su hoja tras crear la cuenta o entrar
  y su línea en Mi cuenta. Crear un cliente con cuenta ya no crea el hueco al
  momento: la ficha nace `local` y la subida lo hace (funciona sin red).
- **Invitar / Pasar a la app** = subir si hace falta + `trainer_reissue_client_code`
  + programa de entrada. Desaparece `pushTrainerLogToSlot` como paso aparte
  (hasta C10-05, la subida ya manda lo apuntado una vez).
- **Cancelar la invitación** = `trainer_clear_code` → `none`.
- `slotCancelled` para los borrados con `kind = 'cancelled'` de móviles viejos.
- **Plan gratis** por `withApp` (§7) en `freePlan.js` y sus puertas.
- **`otherAccount` de solo lectura** (N-19): la ficha se ve con «En otra cuenta
  tuya», sin editar, sin enviar y sin «Pasar a la app en esta cuenta» (según D2,
  §11).
- Textos nuevos en `es.json` y `en.json`.

**Tests (banco).**
- Entrenador sin cuenta con 3 clientes (uno con historial apuntado) crea la
  cuenta: los 3 quedan `none` con hueco sin código y lo apuntado en el hueco.
- Corte de red a mitad de la subida: los subidos quedan, los otros `local`; al
  volver la red, el refresco termina sin duplicar ninguno (R-C7).
- Crear un cliente con cuenta sin red: queda `local`; con red, `none`.
- Invitar a uno `none` que tenía historial apuntado: el cliente canjea y ve su
  historial (R-C6); el plan gratis cuenta 1 con app.
- Cancelar la invitación: vuelve `none`, el código viejo ya no entra, lo
  apuntado sigue en el hueco.
- Gratis: 3 clientes `none` no ocupan la plaza con app; invitar a uno sí; a un
  segundo, hoja de límite (R-E1).
- Un móvil con la versión de hoy cancela una invitación: el de esta versión la
  ve `local` y la vuelve a subir.
- Salir y entrar en otra cuenta: los `none` también pasan a `otherAccount` y no
  se pueden editar (N-09, N-19).

**Probar C10-04**

- [ ] Sin cuenta, crear 3 clientes y apuntar un entreno a uno. Crear la cuenta:
  sale «Subiendo tus 3 clientes a tu cuenta» y termina.
- [ ] Repetir con el modo avión puesto justo al empezar la subida: dice cuántos
  faltan; al quitar el modo avión y abrir Clientes, Mi cuenta deja de decir que
  faltan.
- [ ] Con cuenta y sin red, crear un cliente: se crea, y Mi cuenta dice que 1
  cliente aún no está en tu cuenta; al volver la red y abrir Clientes, deja de
  decirlo.
- [ ] Pasar a la app al cliente con el entreno apuntado; canjear el código en
  otro móvil: el cliente ve ese entreno en su historial.
- [ ] Cancelar la invitación de otro cliente: vuelve a «sin app», su historial
  apuntado sigue en la ficha, y el código ya no sirve.
- [ ] Sin PRO: con 3 clientes sin app, invitar a uno funciona; invitar a un
  segundo saca la hoja de límite.

### 10.5 C10-05 — Guardar en la cuenta: ficha, programas y lo apuntado

**Qué.** §6 entero, con el disparador que decida D1; `saveSig` como función
pura (en `src/utils/clientSave.js`, junto a `buildClientCard` y
`buildClientPrograms`). La recuperación de §8.2 pasa a leer la tabla privada,
con su `savedSig`. La línea de Mi cuenta.

**Tests (banco).**
- **El escenario de N-17**: entrenador con cuenta y cinco clientes (dos sin app
  con notas, cobros, etiquetas, peso, un programa de dos etapas y entrenos
  apuntados; uno invitado; uno conectado con historial; uno archivado). Móvil
  nuevo, recuperar la cuenta: los cinco con el mismo id, la misma ficha, los
  mismos programas (activo y archivados, con su progreso) y el mismo historial.
- El cliente conectado **no** puede leer las notas ni los cobros (R-A1), y su
  programa **no** cambia porque el entrenador edite y se guarde (N-06): solo al
  enviar.
- Cambiar una nota, esperar el guardado, y la fila privada la tiene; cambiarla
  mientras viaja deja la firma distinta y se vuelve a guardar (E55).
- Sin red, cambiar dos fichas: nada se guarda; al volver la red, las dos.
- Salir de la cuenta con cambios sin guardar y volver: se guardan al volver.
- Un congelado no se guarda ni se envía (R-E2, N-12).
- Recuperar no vuelve a subir nada (la firma coincide).

**Probar C10-05**

- [ ] A un cliente sin app ponerle una nota, un cobro, una etiqueta y su peso, y
  asignarle un programa. En otro móvil (o tras borrar los datos), recuperar la
  cuenta: la ficha y el programa están tal cual, con la etiqueta con su nombre.
- [ ] Editar el programa de un cliente conectado sin pulsar Enviar y recuperar
  la cuenta en otro móvil: el cambio está en el entrenador, y el cliente sigue
  con el programa de antes hasta que se le envía.
- [ ] En modo avión, cambiar la nota de un cliente: Mi cuenta dice que hay
  cambios por guardar; al quitar el modo avión, dice que está todo guardado.

### 10.6 C10-06 — Restaurar una copia con este modelo

**Qué.** §8.1 entero, en `importData` y `buildBackupPayload`, y la hoja de
restaurar por partes con su casilla de clientes (activada sin red solo sin
cuenta). Sustituye a I04-02.

**Tests (banco).** Los de I04-02 (E73, E78 de `i03.audit.sim.test.js` y E79 de
la rama adversaria) reescritos a la regla nueva, más:
- Con cuenta, una copia con un cliente borrado después: no vuelve (N-04, N-13).
- Con cuenta, una copia con un cliente que la cuenta nunca conoció: entra y se
  sube.
- Con cuenta, una copia cuyos clientes están todos en la cuenta: no cambia nada
  de ninguno, aunque la copia tenga otra nota.
- Sin cuenta: la parte de clientes reemplaza a los del móvil.
- Una copia de la versión de hoy (con banderas `sync*` y `programDirty`):
  restaurarla no envía nada ni deja ninguna ficha con hueco (E73).
- Restaurar dos veces la misma copia no cambia nada.
- Cliente conectado que restaura: su programa vuelve a ser el de su hueco
  (N-05, cruce 3).

**Probar C10-06**

- [ ] Con cuenta: hacer copia, borrar un cliente (dejar que pase el Deshacer),
  restaurar la copia: el cliente no vuelve y la hoja dice cuántos ya estaban.
- [ ] Sin cuenta: hacer copia, crear un cliente nuevo, restaurar la parte de
  clientes: avisa antes, y queda exactamente lo de la copia.
- [ ] Con cuenta y modo avión: la casilla de clientes está desactivada con su
  texto; el resto de partes se restaura.

### 10.7 C10-07 — Deshacer al borrar un cliente

**Qué.** §8.3. Sustituye a I04-10. Puede ir en cualquier momento después de
C10-01, pero de una en una con las demás.

**Tests.**
- Borrar y deshacer: la ficha, sus programas, sesiones, historial y su sitio en
  `freeClientIds` vuelven iguales (comparación profunda), y el servidor no se
  enteró.
- Borrar y dejar pasar el toast: el hueco se borra en el servidor y no
  resucita (R-B6); el otro móvil de la cuenta lo borra también (R-B10).
- Un refresco durante el toast no recupera al cliente.
- Cerrar la app durante el toast: al volver, el cliente está (recuperado).

**Probar C10-07**

- [ ] Borrar un cliente y pulsar Deshacer: vuelve con su programa y su
  historial.
- [ ] Borrar un cliente con app y esperar: su móvil dice que el entrenador lo
  desconectó.

### 10.8 C10-08 — De punta a punta: móvil nuevo, reglas con su test y prueba en dispositivo

**Qué.**
- El escenario largo, de un solo usuario: empieza sin cuenta con clientes, crea
  la cuenta, invita a uno, pasa a Google, pierde el móvil, recupera en otro,
  restaura una copia vieja, borra y deshace, y comprueba en cada paso
  `assertLink` sobre todas las fichas y que nada se perdió.
- Las reglas N-15, N-17…N-20 y las R-xx de la tabla de §10 con su test en la
  columna **Test** de I02 (I04-07).
- Las reglas N-18…N-20 pasan al mapa del núcleo con su fecha, y N-15 y N-17 se
  marcan implementadas.
- `audit.sql` en producción, vacío.

**Probar C10-08**

- [ ] El recorrido entero en dos móviles reales: sin cuenta con 3 clientes →
  crear cuenta → invitar a uno y que entre → pasar a Google → instalar en el
  segundo móvil y entrar con Google: están los 3 con su ficha, programa e
  historial, y el conectado sigue entrenando sin notar nada.
- [ ] En el segundo móvil, borrar un cliente sin app y no deshacer; abrir la app
  en el primero: también ha desaparecido.

## 11. Decisiones

**Cerradas el 28-oct-2026 por el usuario:** D1 = **A, continuo** («los cambios
han de subirse»), y lo que no se pueda subir va a la cola de cosas por subir
(§6, «Cuando no se puede guardar»). D2 = **A, no se traen**: se quedan como «de
otra cuenta», solo lectura. Las reglas N-18…N-20 pasan al mapa al aprobar la
spec. Abajo, las opciones tal como se plantearon.

**D1 · Cuándo se guarda en la cuenta** (§6).
- **A · Continuo, a los pocos segundos de cada cambio (recomendada).** Gana: la
  promesa de N-17 se cumple aunque no haya Drive, y perder el móvil pierde como
  mucho unos segundos. Cuesta: un suscriptor más y más escrituras pequeñas al
  servidor.
- **B · En los mismos momentos que la copia de Drive.** Gana: un disparador que
  ya existe. Cuesta: sin Drive activado nunca se guarda, y con Drive diario se
  puede perder un día; cambiar notas o cobros no dispara nada.

**D2 · Uno «de otra cuenta» se puede traer a esta** (§10.4, N-19).
- **A · No: solo lectura; para tocarlo, volver a su cuenta (recomendada).** Hoy
  «Pasar a la app» le da hueco nuevo en la cuenta puesta. Con N-17 eso pondría
  el mismo id de cliente en dos cuentas, y al volver a la primera habría que
  decidir cuál de las dos fichas es la buena: un cruce nuevo para un caso raro
  (un entrenador con dos cuentas que no usó «Pasar a Google o Apple», que sí se
  lleva los clientes). Gana: ningún cliente está en dos cuentas. Cuesta: quien
  entró en otra cuenta por error tiene que volver a la suya, o borrar la ficha y
  crearla de nuevo.
- **B · Sí, como copia con id nuevo.** Gana: se mantiene lo de hoy. Cuesta: el
  cliente queda duplicado entre las dos cuentas, cada uno con su historial, y
  el viejo vuelve a aparecer al volver a la primera cuenta.
