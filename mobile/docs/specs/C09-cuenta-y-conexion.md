# Spec — Cuenta de entrenador y conexión, a prueba de balas

> Tema: conexión
> En corto: Cambiar de forma de entrar (código, Google, Apple) en cualquier dirección se lleva a los clientes, ser entrenador y cliente en el mismo móvil ya no rompe nada, y nada se da por enviado sin que el servidor lo confirme. Con un banco de pruebas que mueve varios «móviles» contra el SQL real.
> Inicio: 2026-10-14
> Fin: 2026-10-16
> Fase C09-01 · hecho · Servidor: un solo esquema y toda escritura por funciones que fallan si no encuentran la fila · §2.2
> Fase C09-02 · hecho · Una sesión por papel y cuentas candidatas · §2.1
> Fase C09-03 · hecho · Entrenador: traspaso en cualquier dirección, refresco que recupera y «de otra cuenta» · §3
> Fase C09-04 · hecho · Cliente: un asiento, «te han desconectado» y Google/Apple sin tocar la sesión · §4
> Fase C09-05 · hecho · Banco de pruebas con varios móviles y auditoría del servidor · §5
> Fase C09-06 · hecho · El código siempre vale, tres motivos de desconexión y avisos del cliente · §4.6
>
> Estado: **implementado y en verde** (38 escenarios de simulación + 1940 tests).
> **`supabase/schema.sql` desplegado el 15-oct-2026** (`audit.sql` limpio). Falta
> la prueba en dispositivo. Sustituye a C01 en lo que se solapa; C01 sigue
> valiendo como historia de por qué el modelo de huecos es el que es.

## 1. Por qué

Revisión del 14-oct-2026, comprobada después ejecutando el código de entonces
contra su servidor reconstruido: **25 de 35 escenarios fallaban**. Las causas
eran tres, y casi todo lo demás colgaba de ellas:

1. **Una sola sesión de Supabase por móvil** para dos papeles. Conectarse como
   cliente echaba la cuenta de entrenador; entrar como entrenador perdía para
   siempre la identidad anónima del cliente (su asiento quedaba ocupado por un
   fantasma). Bastaba con escribir un código y cancelar.
2. **Escrituras que no confirmaban nada.** Un `update` que la RLS filtraba daba
   0 filas y ningún error: «Enviado» sin haber llegado, «Sincronizado» sin
   haber subido. El cliente nunca se enteraba de que lo habían desconectado.
3. **El traspaso de clientes solo funcionaba desde una cuenta de código.** De
   Google a Apple, de Google a código, etc., los clientes se quedaban en la
   cuenta vieja, y si el traspaso fallaba a medias se perdía el código viejo.

Lo que sí funcionaba (y sigue igual): el modelo de huecos de C01 (un código solo
abre asientos vacíos, reemitir, ceder solo lo propio), código → Google/Apple
(M03-01) y desconectarse soltando el hueco.

## 2. El diseño

### 2.1 Una sesión por papel, y cuentas candidatas

`src/config/supabase.js` crea **dos** clientes de Supabase con su propio sitio
en el almacenamiento: `trainerSupabase` (cuenta de entrenador) y
`clientSupabase` (cliente conectado a un entrenador). Ninguna acción de un papel
usa la sesión del otro, así que no se pueden pisar. La sesión única de la
versión anterior pasa al papel que le toca al arrancar (`migrateLegacySession`).

Entrar en una cuenta **nueva** (crear, cambiar de forma, «Ya tengo cuenta»,
volver a entrar, vincular Google como cliente) se hace con una **candidata**: se
entra en un cliente temporal sin persistencia (`createTempSupabase`), se decide
con ella, y solo al final se instala su sesión (`setSession`). Si algo falla
antes, se tira y no ha cambiado nada. «Ya tengo cuenta» con un Google sin cuenta
de entrenador ya no cierra ninguna sesión.

### 2.2 El servidor: `supabase/schema.sql`

Un solo archivo, idempotente, que es la verdad del servidor. Sustituye a los
cuatro SQL de antes (volver a ejecutar `secure_trainer_clients.sql` restauraba un
`link_client_to_slot` que desalojaba a cualquiera).

- **Nadie escribe la tabla directamente.** Sin políticas de escritura y sin
  permisos de `insert/update/delete`: toda escritura es una función
  `security definer` que comprueba de quién es la fila y lanza un código seco si
  no la encuentra (`SLOT_GONE`, `NO_SEAT`, `SLOT_OCCUPIED`…). De paso se cierra
  que un cliente pudiera cambiar `trainer_id` o `program_json` de su fila.
- **Un cliente, un asiento**: índice único parcial en `client_id`. Entrar con un
  código suelta el asiento que tuviera (cambiar de entrenador ya no deja un
  fantasma al anterior).
- **El código siempre vale** (§4.6): con él se entra aunque haya alguien dentro,
  que sale y se entera. Reemitirlo es lo que lo revoca.
- **Códigos únicos** por índice, generados siempre en el servidor.
- **Claves foráneas a `auth.users`**: borrar un usuario (incluso desde el panel)
  se lleva sus huecos de entrenador y suelta su asiento de cliente.
- Ceder (`transfer_my_slots_to`, `transfer_my_seat_to`) solo a una cuenta que
  existe y no es anónima.
- Reemitir deja el hueco en INVITADO (`disconnected_at` null); desconectarse lo
  deja en SE FUE (`disconnected_at` con fecha).
- Limpia antes los datos que dejaron los fallos (asientos dobles, fantasmas,
  códigos repetidos). La app no está publicada: son datos de prueba.

Errores en la app: `supabaseSync` los entrega en `err.code`. `SLOT_GONE` /
`NO_SEAT` son una **respuesta** del servidor (definitiva); `NETWORK`, que no la
hubo (se reintenta). Nunca se confunden.

## 3. Entrenador

### 3.1 Entrar y cambiar de forma: `_enterCandidate`

Crear, «Ya tengo cuenta», cambiar de forma y volver a entrar pasan todos por la
misma acción, en este orden:

1. Si hay cuenta anterior y es otra, **cede sus huecos con su propia sesión**
   (código: se rehace sola; Google/Apple: tiene que estar viva). Si falla, se
   lanza y el móvil sigue en la vieja, con su código.
2. Se instala la sesión nueva.
3. Solo entonces se apunta en `trainerSync`.

Si la app muere entre 1 y 3, los huecos ya son de la nueva: sus clientes salen
«de otra cuenta» (no se borra nada) y volver a entrar en la nueva lo arregla.
Con Google/Apple caducado y clientes en la nube, cambiar se niega
(`TRAINER_LOGIN_NEEDED`): primero volver a entrar, o se perderían. Sin clientes
en la nube no hay nada que perder y se deja.

### 3.2 Sesión de entrenador

`_ensureTrainerSession`: la sesión tiene que ser la de `trainerSync.userId`.
Código → se rehace sola. Google/Apple → `TRAINER_LOGIN_NEEDED`. Sin red con el
token caducado → error de red, **no** «vuelve a entrar».

### 3.3 Refresco de la lista (`refreshTrainerSlots`)

El servidor manda; la lista lo refleja sin borrar nada:

- Hueco que falta en local (reinstalar) → ficha nueva **con su programa** (el
  último enviado, sacado del hueco y marcado como ya enviado). Todos: también
  invitados, reemitidos y los que se fueron.
- Hueco conocido → contadores, «ha entrado», «se fue» (`syncLeftAt`) y su código
  (pudo reemitirse en otro móvil).
- Cliente cuyo hueco ya no está en esta cuenta → `syncOrphan` (§3.4).
- Si mientras preguntaba se cambió de cuenta, la respuesta se descarta.

### 3.4 «De otra cuenta»

Cliente con hueco en otra cuenta del entrenador (entró con otra tras
Desconectar, o un cambio a medias). `clientLink` lo trata como «sin app»: no se
le manda nada y no ocupa plaza del plan gratis. Su Info dice «En otra cuenta
tuya». Volver a la cuenta buena lo recupera solo; «Pasar a la app» le da hueco
nuevo en esta. Mandarle algo lanza `SLOT_GONE` con explicación.

### 3.5 Borrar un cliente

Se borra en local al momento; su hueco queda en `trainerSync.deletedSlotIds` y se
borra en el servidor en cuanto se puede (cada refresco lo reintenta). Uno solo se
olvida cuando el servidor confirma. Así no resucita tras un borrado sin red.

### 3.6 Mi cuenta

El correo se guarda al entrar (`trainerSync.email`). Si Google/Apple perdió la
sesión, una tarjeta lo dice con su botón para volver a entrar con la misma
cuenta. «Desconectar» avisa de que los clientes se quedan en la cuenta.

### 3.7 Borrar la cuenta

Borra las **dos** identidades del móvil, cada una con su sesión. No toca nada del
móvil: los clientes con app pasan a «sin app» con sus datos (es lo que promete la
hoja; antes se vaciaba la lista entera, incluidos los sin app). Con Google/Apple
caducado, pide volver a entrar antes de borrar nada.

## 4. Cliente

### 4.1 Identidad

`ensureClientSession` reutiliza la identidad que hubiera; solo crea un anónimo
si no hay ninguna. Consultar un código ya no abre un anónimo nuevo.

### 4.2 Conectar y cambiar de entrenador

`linkToTrainer` → `link_client_to_slot`, que suelta el asiento anterior. El
programa se lee del asiento propio (`seatOf`): lo que el cliente sube y baja ya no
lleva id de hueco, es «el mío».

### 4.3 «Tu entrenador te ha desconectado»

Si el servidor contesta que no tiene asiento, `clientSync.lostAt` y su motivo
(`lostReason`, §4.6): la pantalla Entrenador lo dice con su salida, el menú pone
«Reconectar» en naranja y la cabecera de todas las pantallas lleva una franja que
lleva allí. Se deja de subir. Un corte de red no cuenta.

### 4.4 Programa actualizado

`lastProgramImportedAt` guarda la hora del **servidor** del programa importado.
Antes guardaba la del móvil y la comparaba con la del servidor: con el reloj del
móvil adelantado se ignoraban los cambios del entrenador.

### 4.5 Google/Apple del cliente

- Vincular: la sesión anónima **cede** su asiento a la cuenta de Google
  (`transfer_my_seat_to`); si esa cuenta ocupaba otro asiento de antes, lo suelta
  ella misma con su sesión. Luego se instala. Sustituye a `transfer_client_slot`.
- Reconectar en otro móvil: se busca el asiento con la candidata, sin tocar
  nada; si no hay, no ha cambiado nada.

### 4.6 El código siempre vale (16-oct-2026)

**El caso real que lo motivó.** Una clienta actualizó a la versión de las dos
sesiones y salió «desconectada»: la app preguntó por su hueco antes de terminar
de traspasar su sesión vieja, vio «sin sesión» y lo apuntó para siempre (arreglo:
`sessionsReady`, §2.1). Y para volver le pedía un código nuevo al entrenador,
porque su hueco seguía ocupado por su propia identidad perdida.

**Por qué no se puede saber que alguien «perdió la conexión».** Al reinstalar,
la sesión del móvil sigue viva en el servidor: Supabase no se entera de que el
móvil la ha borrado. Para el servidor, «soy yo otra vez» y «soy otra persona
con tu código» son la misma petición. Lo ideal (el mismo código te vuelve a
meter solo si el de dentro ya no está) no es posible de forma fiable.

**Decisión del usuario: el código es la llave del cliente.** Con él se entra
siempre. Si había alguien dentro, sale, y el servidor apunta quién
(`displaced_client_id`) para decírselo. Reemitir el código sigue siendo la
forma de revocarlo. Sustituye a la decisión de C01 §9 («reinstalación anónima =
código nuevo del entrenador»).

Lo que cuesta: quien consiga el código puede quitarle el sitio al cliente y ver
su historial. Queda a la vista (el cliente desbancado lo ve) y se corta
reemitiendo.

**Tres motivos de desconexión** (`clientSync.lostReason`), cada uno con su texto
y su salida en la pantalla Entrenador:

| Motivo | Qué pasó | Salida |
|---|---|---|
| `identity` | Este móvil perdió su sesión (no tiene ninguna) | «Volver a entrar con mi código», con el código ya puesto |
| `taken` | Alguien entró con su código (`client_lost_reason()`) | El suyo si fue él en otro móvil, o uno nuevo del entrenador |
| `gone` | El entrenador lo borró, reemitió el código o borró su cuenta | Pedirle un código |

Con Google/Apple vinculado sale además «Reconectar con mi cuenta».

La hoja del código ya no bloquea un código en uso: avisa («si conectas aquí,
ese móvil se desconecta») y deja conectar, proponiendo fusionar el historial que
haya en el hueco. El onboarding igual: fuera la pantalla «Este código ya está en
uso».

**Servidor**: `link_client_to_slot` bloquea la fila (`for update`) y ocupa siempre;
`client_lost_reason()` nueva; columnas `displaced_client_id` y `displaced_at`
(reemitir las limpia). **Hay que volver a ejecutar `schema.sql`** y `audit.sql`.

**Probar C09-06**

- [ ] Volver a ejecutar `schema.sql` en Supabase sin errores; `audit.sql`, vacío.
- [ ] Cliente conectado → borrar los datos de la app → meter el MISMO código: la
  hoja avisa de que otro móvil lo usa, conecta, y el historial vuelve.
- [ ] Mismo código en dos móviles: el primero, al volver a abrir la app, ve la
  franja arriba y en Entrenador «Alguien ha entrado con tu código»; el menú dice
  «Reconectar» en naranja, no «Conectado».
- [ ] El entrenador reemite el código: el cliente ve «Tu entrenador te ha
  quitado…»; el código viejo da «Código no encontrado» y el nuevo entra.
- [ ] Abrir el enlace de invitación con la pantalla Entrenador ya abierta: lo
  primero que se ve es la hoja con el código puesto, sin otra hoja encima.

## 5. Banco de pruebas y auditoría

- **`test/supabaseSim.js`**: PGlite (Postgres real en WASM, sin Docker) con
  `schema.sql` cargado, y un doble de supabase-js que habla con él como
  PostgREST: RLS de verdad, sesiones por móvil y por `storageKey`, Edge Functions,
  y cortes de red simulables (`device.offline`, `server.failOnce('rpc:…')`).
- **`mobile/store/connection.sim.test.js`**: el store real importado una vez por
  «móvil». 38 escenarios: todas las direcciones de cambio de forma, corte a mitad
  del traspaso, app muerta a mitad, reinstalar con cada forma, Ya tengo cuenta,
  Desconectar y volver, otra cuenta, sesión de Google perdida, borrar sin red,
  desconexiones vistas por el cliente, cambiar de entrenador, Google del
  cliente, entrenador que también es cliente, borrar la cuenta y reglas del
  servidor. Correrlo tras tocar cualquier cosa de conexión:
  `npx vitest run mobile/store/connection.sim.test.js`.
- **`supabase/audit.sql`**: solo lee. En el SQL editor de Supabase, cuando se
  quiera: cada fila es un problema (fantasmas, asientos dobles, políticas de
  escritura, funciones que faltan…). Vacío = en orden.

Lo que el banco NO cubre: pantallas, Google/Apple de verdad, la Edge Function
desplegada y la carrera real de dos peticiones simultáneas (PGlite las ejecuta
de una en una). Eso es lo de las casillas.

## 6. Despliegue

1. SQL editor de Supabase → pegar `supabase/schema.sql` entero → ejecutar.
2. Ejecutar `supabase/audit.sql` → tiene que salir vacío.
3. Instalar la app nueva en los dos móviles **a la vez** (la vieja usa
   `get_slot_by_code` con otra forma y escribe la tabla directamente).
4. Edge Functions: sin cambios.

**Probar C09-01**

- [x] Ejecutar `schema.sql` en Supabase sin errores, y luego `audit.sql`: sale vacío.
- [x] Ejecutar `schema.sql` una segunda vez: tampoco da errores.

**Probar C09-02**

- [ ] Móvil con la versión anterior, entrenador con código y conectado como
  cliente de otro: tras instalar la nueva, siguen funcionando los dos lados sin
  volver a entrar (el cliente sube una sesión y le llega al entrenador). — ❌ 2026-10-15: con Google, Mi cuenta pidió volver a entrar (la sesión vieja no pasó a la nueva). Volver a entrar funcionó; aceptado como coste de actualizar una vez, no se toca.

**Probar C09-03**

- [ ] Entrenador con Google y un cliente conectado → Mi cuenta → Cambiar a
  Apple (o a código, en Android) → mandarle un programa: le llega.
- [ ] Lo mismo de código a Google y de Google a código.
- [ ] Modo avión justo al confirmar el cambio de forma: sale un error y Mi cuenta
  sigue en la forma de antes; sin modo avión, el cambio funciona.
- [ ] Borrar los datos de la app del entrenador → «Ya tengo cuenta» → vuelven
  todos los clientes, el conectado con su programa, y mandarle algo le llega.
- [ ] Desconectar → «Crear cuenta» con otro Google → el cliente sale «En otra
  cuenta tuya» en su Info y no se le puede mandar nada; Desconectar → entrar con
  el Google de antes → vuelve a estar conectado.
- [ ] Borrar un cliente conectado en modo avión → quitar el modo avión → tirar
  para refrescar: no vuelve a aparecer, y en el móvil del cliente sale
  «DESCONECTADO».

- [ ] Con la sesión de Google perdida: Clientes enseña «Reconecta tu cuenta de entrenador» encima de la lista y la nube tachada con punto naranja; entrar desde ese botón quita el aviso y la nube vuelve con punto verde. En Mi cuenta el aviso va dentro de la tarjeta de la cuenta.

**Probar C09-04**

- [ ] Cliente conectado → Cambiar de entrenador → escribir un código y cancelar
  → hacer una sesión: le llega a su entrenador.
- [ ] Cambiar de entrenador de verdad → en el entrenador anterior, su Info dice
  «Se desconectó» y la tarjeta del código «X se desconectó».
- [ ] El entrenador reemite el código de un cliente → en el cliente, al volver a
  abrir la app, «DESCONECTADO» con «Entrar con un código nuevo»; con el código
  nuevo vuelve y su historial sigue ahí.
- [ ] Cliente vincula Google → borrar datos de la app → entrar con Google →
  vuelve con su entrenador y su programa.

**Probar C09-05**

- [ ] Un mismo móvil entrenador (Google) y cliente de otro: mandar un programa a
  un cliente propio, hacer una sesión como cliente, cerrar y abrir la app,
  repetir: todo llega a su sitio y Mi cuenta no pide volver a entrar.
- [ ] Ese móvil → Eliminar cuenta → en el móvil de su entrenador, el cliente sale
  «Se desconectó»; sus clientes propios siguen en la lista como «sin app».
