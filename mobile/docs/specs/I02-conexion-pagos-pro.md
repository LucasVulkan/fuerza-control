# Spec — Auditoría de conexión, pagos y PRO

> Tema: integridad
> En corto: Escribir lo que la conexión entrenador ↔ cliente, los pagos y el plan PRO tienen que cumplir siempre, comprobarlo regla a regla contra el servidor y la app, y decir de cada hallazgo cuánto de seguro es, en vez de pedir "busca fallos".
> Inicio: 2026-10-23
> Fin: 2026-10-26
> Fase I02-01 · terminado · Revisar y firmar las reglas · §3
> Fase I02-02 · terminado · Servidor: el SQL y las Edge Functions contra un cliente hostil · §5.1
> Fase I02-03 · terminado · App: conexión y sincronización · §5.2
> Fase I02-04 · terminado · App: PRO, límites y congelado · §5.3
> Fase I02-05 · terminado · App: compra, restauración e identidad en RevenueCat · §5.4
> Fase I02-06 · hecho · Pruebas en dispositivo de lo que el banco no ve · §5.5
>
> Estado: **spec escrita, sin empezar** (23-oct-2026). **I02-01 terminada**: reglas
> revisadas y firmadas por el usuario el mismo día, decisiones en §7. Ya se sabe
> que tres reglas firmadas no se cumplen hoy (§3.7).
> **I02-02 terminada** (23-oct-2026): dos pasadas (por reglas y adversaria, Opus
> con esfuerzo máximo) y 48 tests nuevos en el banco
> (`mobile/store/server.hostile.sim.test.js`, `connection.audit.sim.test.js`).
> Salen 11 fallos confirmados, de E27 a E37 en `auditoria-tecnica.md`. Ninguno
> está arreglado.
> **I02-04 e I02-05 terminadas** (24-oct-2026): pasada por reglas con Opus alto
> (la de I02-05 con máximo) y adversaria con Sonnet; 60 tests en
> `freeplan.audit.test.js` y `purchases.audit.test.js`. Salen los fallos E38 a E48.
> **E27-E29, E32, E33 y E38-E48 arreglados** y fusionados en develop (24-oct-2026);
> E45-d (compra de otra plataforma o regalada) queda abierto.
> **I02-03 terminada** (26-oct-2026): pasada por reglas (Opus alto) y adversaria
> (Sonnet alto) sobre el código ya arreglado; 18 hallazgos confirmados en
> `sync.audit.sim.test.js`, que pasan a ser los fallos E49 a E60. Falta
> volver a ejecutar `schema.sql` en Supabase y redesplegar `delete-account`. Sale de la conversación
> del 23-oct: ¿un modelo con más esfuerzo encontraría más fallos en conexión,
> pagos y PRO? Respuesta: algo más sí, pero lo que más cuenta es el método.
> Hacen falta reglas escritas, cada una con su forma de comprobarla, y
> hallazgos con su nivel de certeza. Esta spec es ese método.
>
> Hermana de [I01-integridad-y-tests.md](I01-integridad-y-tests.md): I01 cubre
> las **fórmulas** (progresión, carga, etapas) y los datos del móvil; I02 cubre
> **quién puede hacer qué** con datos que salen del móvil (servidor, otro
> móvil, la tienda). No se pisan, y comparten principios (§2).
>
> Depende de: nada. I02-01 va primero; I02-02 a I02-05 son independientes
> entre sí y pueden ir en paralelo; I02-06 va al final. No toca pantallas.

---

## 1. Alcance

**Entra:**

- Conexión entrenador ↔ cliente: `supabase/schema.sql`, `supabase/functions/*`,
  `mobile/src/services/supabaseSync.js`, `supabaseAuth.js`, las acciones de
  conexión del store (`mobile/store/useStore.js`), `src/utils/clientLink.js`,
  `clientLogs.js`, `programOwnership.js`. Specs que mandan:
  [C01](C01-client-connection.md), [C09](C09-cuenta-y-conexion.md).
- PRO y plan gratis: `src/utils/freePlan.js`, los guards `isClientFrozen` y
  `_templateLimitReached` del store, `checkProStatus`. Spec:
  [M01](M01-monetizacion.md) §4.
- Compra y cuenta: `purchasePackage`, `restorePurchases`, el `logIn` de
  RevenueCat, `useTrainerAccount`, `PaywallModal`. Specs:
  [M01](M01-monetizacion.md) §3 y §5, [M03](M03-mi-cuenta.md),
  [M04](M04-limites-y-fallos-de-pago.md) (sin implementar: sus reglas se
  auditan cuando exista).

**No entra:** fórmulas y datos del entreno (I01), pantallas y textos, Drive
(`driveService.js`) salvo como puerta de datos de I01-05.

## 2. Principios

Los de I01 §2 valen aquí. Además:

1. **Se audita contra reglas, no contra el código.** Cada regla de §3 dice lo
   que tiene que pasar en el idioma del producto. El auditor la persigue por
   el código de principio a fin. Nunca se trabaja con un "a ver qué encuentro".
2. **El servidor se audita como si la app no existiera.** Cualquiera con la
   clave pública de Supabase (va dentro del APK) puede llamar a cualquier RPC
   con los argumentos que quiera. Si una regla solo la protege la app, es una
   regla de la app y se anota así (§4.3).
3. **Cada hallazgo lleva su nivel de certeza** (§4.1). Nada pasa a "fallo"
   sin un test rojo o una prueba en dispositivo que lo reproduzca.
4. **Dos pasadas que no se miran.** Por zona, una pasada parte de las reglas
   (§3 → código) y otra parte del código buscando cómo romperlo (adversario,
   sin ver §3). Lo que salga en las dos es casi seguro. Lo que salga en una
   sola se reproduce antes de creérselo (§4.2).
5. **Los fallos van a [auditoria-tecnica.md](auditoria-tecnica.md)** como
   `E27+` (numeración compartida con I01), con test que falla antes y pasa
   después. Esta spec no lleva lista de bugs propia, solo el registro de
   reglas comprobadas (§6).

---

## 3. El comportamiento deseado

Cada regla tiene un código estable (`R-A1`…), que no se reutiliza. **Cómo** dice
con qué se comprueba: **L** lectura dirigida · **B** banco
(`test/supabaseSim.js` + `connection.sim.test.js`, Postgres real con RLS) ·
**U** test unitario · **S** `supabase/audit.sql` contra producción · **D**
dispositivo · **T** tienda en modo de prueba (sandbox de Apple / test de Google
Play).

**Revisada por el usuario el 23-oct-2026.** Lo firmado manda sobre el código y
sobre las specs anteriores: donde el código hace otra cosa, es un fallo (§3.7).
Las reglas técnicas que el usuario no conocía (A2, A5, A7, A8, A9, C6) llevan
la explicación en llano y el usuario las dio por buenas. No queda nada abierto
(§7).

Tres palabras que salen mucho:

- **Hueco** o **asiento**: una fila de la tabla `trainer_clients` del servidor.
  Es «el cliente X del entrenador Y»: su nombre, su código, el programa que le
  manda el entrenador y el historial que sube el cliente. El hueco es del
  entrenador. El cliente **se sienta** en él al entrar con el código.
- **Sesión del servidor** (o token, o JWT): el pase que la app enseña en cada
  petición para decir quién es. Lo firma Supabase y no se puede falsificar ni
  copiar de otro usuario. Todas las reglas de «solo lo tuyo» se apoyan en él.
- **Fantasma**: un hueco que dice «aquí está sentado el usuario X» cuando X ya
  no existe (borró su cuenta, por ejemplo). El entrenador lo vería «conectado»
  para siempre y nadie podría usar el código.

### A. Quién ve qué (servidor)

| Código | Regla | Cómo |
|---|---|---|
| R-A1 | Un usuario solo lee los huecos donde es el entrenador o el cliente sentado. Nadie lee los de otro, tampoco un anónimo ni alguien sin sesión. | B · S |
| R-A2 | Nadie escribe en la tabla directamente: todo cambio pasa por las funciones de `schema.sql` §7-8, que comprueban quién eres antes de escribir. *En llano:* la alternativa sería dejar que la app escriba la fila con unas reglas de permiso, que es como estaba antes y dejaba a un cliente cambiarse de entrenador o reescribir su programa (`schema.sql` §5). No hay nada que decidir: la regla es que siga así y que nadie lo deshaga. | B · S |
| R-A3 | Cada función que escribe comprueba que quien llama es el dueño (entrenador del hueco o cliente sentado) **en la misma operación** que escribe, y falla si no lo es. Es la protección contra un tercero que intente tocar lo que no es suyo, incluso con una app modificada. | L · B |
| R-A4 | Un anónimo nunca actúa como entrenador. | B |
| R-A5 | Al escribir un código, la pantalla de confirmar recibe solo el nombre del cliente, el del entrenador y el del programa, y cuatro sí/no: si ya está dentro alguien, si soy yo, si está protegido con Google/Apple y si hay historial. Ni ids, ni horas, ni el programa entero ni el historial. *(Ampliada el 26-oct-2026, E30.)* *En llano:* teclear un código para «ver qué hay» no enseña los datos; para verlos hay que entrar de verdad (y eso ya lo cubre R-B2). | L · B |
| R-A6 | Adivinar un código no es viable: 32⁸ ≈ 1,1·10¹² combinaciones. Si la app pasa a pedir menos caracteres, esta regla se revisa. | L |
| R-A7 | `profiles` es una tabla pequeña del servidor con una sola cosa por usuario: si es entrenador. Cada uno puede escribir la suya, así que no puede servir para dar permisos. Hoy solo la usa la app para saber si una cuenta de Google ya era de entrenador (`supabaseAuth.js:80`). La regla es que nada dé acceso ni PRO por lo que diga esa tabla. | L |
| R-A8 | Las dos funciones del servidor que crean y borran cuentas (`create-trainer-account`, `delete-account`) solo actúan sobre la cuenta que las llama, la de su pase (JWT), nunca sobre una que venga escrita en la petición. | L · B |
| R-A9 | El servidor de producción tiene el mismo SQL que el repositorio. Se comprueba con `supabase/audit.sql`, una consulta que solo lee y que devuelve una fila por cada problema que encuentra (fantasmas, clientes en dos asientos, permisos de más, funciones que faltan). **«Sale vacío» = cero filas = ningún problema.** Se pega en el editor SQL de Supabase y se ejecuta. | S |

### B. El asiento y el vínculo

| Código | Regla | Cómo |
|---|---|---|
| R-B1 | Un cliente ocupa como mucho un asiento, en todo momento, también a mitad de un cambio de entrenador. | B · S |
| R-B2 | **El código es la contraseña del hueco: quien lo sabe es su dueño, y siempre vale** (C09 §4.6). La excepción es un cliente que ha entrado con una cuenta que no sea solo el código: Google, Apple o, llamando al servidor a mano, una cuenta de código. A ese cliente el código no lo echa (§4.7). Ratificado el 23-oct-2026; se descartó el código de un solo uso porque obligaría a pedir un código nuevo en cada reinstalación. | B |
| R-B3 | Quien pierde el asiento porque otro entró con su código lo sabe al abrir la app, y lo distingue de que el entrenador lo desconectara. Al entrenador **no** se le avisa (decidido el 23-oct-2026): si el cliente cree que le han echado, es él quien se lo pregunta a su entrenador. *Futuro:* si da problemas, el código deja de poder echar a nadie. | B · D |
| R-B4 | Quien entra con el código ve el historial que hay en el hueco: quien sabe el código es el dueño. Si el código se filtra, el entrenador lo reemite. **Un hueco es una persona**: para una persona distinta, el entrenador crea un cliente nuevo y no reemite el código de otro (si lo hace, la persona nueva ve el historial del anterior, y se acepta; 23-oct-2026). | B |
| R-B5 | Reemitir el código deja fuera al de dentro y el código viejo deja de valer. | B |
| R-B6 | **Borrar un cliente** (el entrenador) lo borra entero, en el servidor y en el móvil del entrenador, como si nunca hubiera existido. **Desconectarse** (el cliente) deja el hueco libre, el entrenador lo ve libre y **no se pierde nada** de lo que había en él: programa, nombre, código e historial. El mismo código vuelve a servir para entrar. No queda ningún fantasma. | B · S |
| R-B7 | Un móvil que es entrenador y cliente a la vez no mezcla sesiones: cada papel con la suya (C09 §2.1). | B |
| R-B8 | Un cliente conectado sigue el programa de su entrenador. Para usar otro (crear, importar, restaurar o reactivar uno propio) la app avisa antes y le ofrece desconectarse; no hay desconexiones implícitas. *(26-oct-2026, E67.)* | B |
| R-B9 | Desconectarse se hace en el móvil al momento, también sin red; el servidor se entera en cuanto hay red. Un móvil solo puede soltar el asiento que tiene. *(26-oct-2026, E52, E66.)* | B · S |
| R-B10 | Lo que el entrenador borra o cancela en un móvil se refleja en sus otros móviles de la misma cuenta; nada más se borra solo. No hay sincronización de programas ni registros entre móviles del entrenador (irá en una spec aparte). *(26-oct-2026, E60-E63.)* | B · S |

### C. Sincronización: no perder ni duplicar

| Código | Regla | Cómo |
|---|---|---|
| R-C1 | Nada se da por enviado sin que el servidor lo confirme. Un fallo de red deja la acción pendiente y visible, nunca "hecho". | B |
| R-C2 | Una sesión que el cliente entrena llega al entrenador una vez: ni se pierde ni se duplica, aunque se suba dos veces, desde dos móviles o tras reinstalar. | U · B |
| R-C3 | Mezclar historiales solo añade (`mergeClientLog`): conmutativa e idempotente. Comparte la propiedad con I01-04, que se escribe una sola vez. | U |
| R-C4 | El entrenador recibe **todas** las sesiones que se subieron a un hueco, aunque el cliente ya no esté (se desconectó o se fue con otro entrenador). Nada de lo subido se borra antes de que el entrenador lo descargue. **Excepción (23-oct-2026): borrar la cuenta** borra los datos del cliente en el hueco que ocupa **en ese momento**: historial y contador. No toca los huecos donde estuvo antes, que pueden ser ya de otra persona, ni los ajustes que puso el entrenador (`overrides_json`), que no son del cliente. | L · B |
| R-C5 | Un programa nuevo del entrenador llega al cliente sin pisar lo que el cliente ha entrenado, y el cliente sabe que ha cambiado. | B |
| R-C6 | *En llano:* el entrenador puede apuntar sesiones a un cliente que todavía no ha entrado, y se suben a su hueco para que el cliente las encuentre al entrar. En cuanto el cliente está dentro, el historial lo sube él y el entrenador ya no puede sobrescribirlo desde su móvil. | B |
| R-C7 | Un corte a mitad de cualquier traspaso (cuenta, asiento, huecos) deja un estado del que la app sale sola al reintentar. | B |

### D. Identidad y cuentas

| Código | Regla | Cómo |
|---|---|---|
| R-D1 | Cambiar de forma de entrar se lleva todos los clientes y no deja ninguno en la cuenta vieja. **Solo hacia una forma mejor** (26-oct-2026): de código a Google o Apple, y entre Google y Apple. De Google o Apple a código **no se ofrece**: lo que se quiere es empujar del código a una cuenta, y volver atrás no tiene sentido. Hoy los huecos cambian de dueño a la cuenta nueva (`offer_transfer`/`accept_transfer`); `linkIdentity` solo se reconsidera si el traspaso falla. | B |
| R-D2 | Cambiar de forma de entrar no pierde el PRO (M01 §3.4, trampa 3). | U · T |
| R-D3 | **Cerrar sesión no quita el PRO.** La compra va con la cuenta de la tienda (Google Play / App Store), no con la de la app: el PRO sigue en el móvil y Restaurar lo recupera en cualquier caso. Solo borrar la cuenta sale de RevenueCat (M01 §3.6). | U · D |
| R-D4 | Borrar la cuenta borra sus huecos y su usuario en el servidor; sus clientes ven que el entrenador los desconectó; no queda nada que se pueda leer. | B · D |

### E. PRO, límites y congelado

| Código | Regla | Cómo |
|---|---|---|
| R-E1 | Sin PRO: como mucho 3 clientes (1 conectado), 1 plantilla de programa y 1 de sesión. **Todos** los caminos que crean uno pasan por la misma puerta del store: pantallas, onboarding, importar, duplicar, invitación, "Enviar todo". | L · U |
| R-E2 | Un cliente congelado es solo lectura y no sincroniza en ninguna dirección, por ningún camino (tabla de M01 §4.5), salvo el contador de `refreshTrainerSlots`. | L · U |
| R-E3 | Al caducar el PRO, lo que necesita PRO deja de funcionar, pero no se borra ni se oculta ningún dato. Al volver a pagar se recupera todo. | U |
| R-E4 | La elección de qué clientes siguen activos es para siempre (M01 §4.11) y **persiste**: si entra un cliente que no cabe (vuelve de otra cuenta, se importa, se recupera del servidor), se congela **solo el nuevo** y la elección sigue igual (24-oct-2026). Reinstalar o restaurar un backup sí deja volver a elegir: se acepta, porque es mucha fricción para saltarse el PRO y sin servidor no se puede impedir (R-E7). | U |
| R-E5 | **Sin red, el PRO dura hasta el final del periodo pagado y 20 días más** (revisado el 24-oct-2026). El final del periodo es la fecha de caducidad que la tienda dio en la última confirmación. Si llevas sin red desde antes de que caduque, cuenta igual: el periodo que pagaste más 20 días. Pasado ese plazo, el móvil pasa a gratis hasta que la tienda lo vuelva a confirmar. Al volver la red, si la suscripción caducó, pasa a gratis en ese momento. **El pago único no caduca nunca**: garantiza la app de por vida. Las versiones de prueba (Expo Go, preview) quedan fuera. Para un PRO que ya existía sin fecha guardada, el plazo empieza al abrir la versión nueva. Si el reloj del móvil marca una fecha anterior a la última confirmación, el plazo se da por gastado. | U |
| R-E6 | Ningún build que llegue a la tienda trae `EXPO_PUBLIC_FORCE_PRO` ni el interruptor de desarrollo activo (`eas.json`: hoy solo el perfil `preview`). | L |
| R-E7 | **Decidido (23-oct-2026): por ahora, los límites solo en la app.** Se sabe lo que eso expone: con un APK modificado, un entrenador gratis tendría más de 1 cliente **conectado** usando el servidor. Lo que vive en el móvil (clientes manuales, plantillas) no importa: es suyo. **Si la app crece, se parchea:** que el servidor sepa quién es PRO por una tabla que el usuario no pueda escribir (la rellena RevenueCat con un webhook) y que `trainer_create_slot` y `link_client_to_slot` se nieguen a pasar del límite sin PRO. Señal para hacerlo: una consulta en Supabase que cuente entrenadores con más de un hueco ocupado y sin PRO (§7). | L |

### F. Compra y restauración

| Código | Regla | Cómo |
|---|---|---|
| R-F1 | Si la tienda confirma la compra, la app pasa a PRO, aunque la confirmación llegue con retraso. | U · T |
| R-F2 | Una compra cancelada no cambia nada y no enseña un error. Las pantallas y los textos son de [M04](M04-limites-y-fallos-de-pago.md) §5 (M04-03); aquí solo se audita la lógica que hay debajo. | U · T |
| R-F3 | Si la compra ya estaba hecha, la app la restaura en vez de fallar. Textos: M04-03. | U · T |
| R-F4 | Una compra vale para **una cuenta de la app a la vez**. Restaurar desde otra cuenta (otro móvil o una cuenta nueva) se lleva el PRO a esa cuenta, y la anterior lo pierde. Es el comportamiento «transferir» de RevenueCat (M01 §3.3). | T · D |
| R-F5 | Pasar de anual a pago único cobra lo que tiene que cobrar y no deja de ser PRO en ningún momento (M01 §5.3). | T |
| R-F6 | Un error de la tienda dice si te han cobrado y qué hacer. Pantallas y textos: M04-03 y [U15](U15-momentos-dificiles.md) §4 (U15-02). Se audita cuando existan. | U · T |

### 3.7 Lo que ya se sabe que no cumple

Al leer el código para escribir esta spec salió que **hoy no se cumplen tres
reglas firmadas**. Siguen el camino normal: test rojo en su fase, alta como
`E27+` y arreglo.

1. **R-B6 y R-C4: desconectarse y cambiar de entrenador borran el historial
   del hueco.** `release_client_slot` y `link_client_to_slot` (al soltar el
   asiento viejo) ponen `history_json` a `null`. Las sesiones que el entrenador
   no había descargado se pierden. Arreglo previsto: no borrar el historial al
   soltar el asiento. Es coherente con R-B4: el hueco es del entrenador y lo que
   hay dentro, también. Se confirma en I02-02.
2. **R-E5: no hay plazo sin red.** `isPro` se guarda y `checkProStatus` mantiene
   el último valor si falla, sin límite de tiempo. Arreglo previsto: guardar la
   fecha de la última confirmación y aplicar los 20 días. Se confirma en I02-05.

Cambiar el comportamiento del servidor obliga a volver a ejecutar `schema.sql`
en Supabase, y C09 §6 dice el orden.

---

## 4. Cómo se mitiga la incertidumbre

### 4.1 Niveles de certeza de un hallazgo

| Nivel | Qué hace falta | Qué se hace con él |
|---|---|---|
| **Confirmado** | Un test rojo en el banco o en unitario, o una casilla de dispositivo que falla | Se da de alta como `E27+` y se arregla |
| **Probable** | Camino concreto en el código (archivo:línea → archivo:línea), sin reproducir todavía | Se escribe el test que lo reproduciría; si sale verde, se baja a descartado con el motivo |
| **Sospecha** | Patrón o duda sin camino concreto | Se apunta en §6 con qué haría falta para salir de dudas; no se arregla nada |
| **Descartado** | Se buscó y la regla se cumple | Se apunta en §6 con la prueba (test, línea o razonamiento), para no volver a buscarlo |

Un informe que solo trae "confirmados" y "descartados" es el objetivo. Las
sospechas que quedan son la incertidumbre que queda, con nombre.

### 4.2 Las dos pasadas

Por cada zona (I02-02 a I02-05):

1. **Pasada por reglas.** Un agente recibe §3 y la zona. Para cada regla de la
   zona, la sigue por el código y la marca con un nivel de §4.1.
2. **Pasada adversaria.** Otro agente recibe solo el código de la zona, sin §3,
   con el encargo de romperlo. Por ejemplo: "eres un cliente con la clave
   pública y un JWT; ¿qué puedes leer o cambiar que no sea tuyo?" o "eres un
   entrenador gratis; ¿cómo tienes 4 clientes?". Devuelve ataques concretos y
   las suposiciones del código que no están escritas en ningún sitio.
3. **Cruce.** Lo que encontraron las dos pasadas es casi seguro. Lo que solo
   encontró la adversaria señala una regla que falta en §3, y se propone
   añadirla. Lo que solo encontró la de reglas se reproduce. Los desacuerdos no
   se resuelven discutiendo: se resuelven con un test.

Las pasadas las hace el modelo más fuerte disponible y con esfuerzo alto, que
es donde el esfuerzo rinde (seguir caminos largos entre archivos). Los tests
que confirman los puede escribir otro.

### 4.3 Lo que se protege solo en la app

Para cada regla, la pasada anota **dónde vive la protección**: servidor, store
o pantalla. Si vive en la pantalla, no protege: otro camino del store se la
salta (es la trampa 8 de M01 con "Enviar todo"). Si vive en el store, la
protección es real para la app pero no ante un cliente modificado; se acepta
o no regla a regla, como R-E7. Si vive en el servidor, es la única que
aguanta a un cliente hostil.

### 4.4 Puntos ciegos conocidos y cómo se cubren

| Punto ciego | Por qué no lo ve el banco | Cómo se cubre |
|---|---|---|
| Dos peticiones a la vez de verdad | PGlite las ejecuta de una en una | Lectura de `for update` y de que cada check va en la misma sentencia que escribe (R-A3), más casilla en dispositivo con dos móviles |
| Google/Apple reales | El banco usa `id_token` de mentira | Casillas D |
| RevenueCat y las tiendas | No hay SDK en Node | Doble de RevenueCat en los tests (§5.4) para la lógica de la app; sandbox para la tienda (T) |
| Que producción tenga el SQL del repo | El banco carga el del repo | `audit.sql` en producción (R-A9), al empezar y al acabar |
| Reloj y caducidad | El banco no espera un año | `vi.setSystemTime` en unitarios; caducidad acelerada del sandbox (las suscripciones de prueba caducan en minutos) |
| Builds | Los tests no ven `eas.json` | Lectura (R-E6) |

### 4.5 Lo que no se va a saber

Un hallazgo "descartado" lo está con lo que se probó, nada más. Esta auditoría
no demuestra que no haya fallos: deja escrito qué reglas se comprobaron, con
qué y con qué certeza. La próxima vez que se toque una zona, se vuelve a pasar
su trozo de §3 (y `/code-review` sobre la rama antes de fusionar).

---

## 5. Fases

### 5.1 I02-02 — Servidor contra un cliente hostil

Reglas A, B y C del lado del servidor. **Solo lectura y tests nuevos: no
cambia `schema.sql`.**

- Un fichero nuevo `mobile/store/server.hostile.sim.test.js` sobre
  `test/supabaseSim.js`: el atacante **no usa el store**, llama a `rpc` y
  `from()` a mano con el JWT de un anónimo, de otro entrenador o de un cliente
  ajeno. Un caso por cada regla A/B/C que lo admita.
- Cada función de §7-8 de `schema.sql` probada con un id de hueco ajeno, con
  `null`, con un código en minúsculas o con espacios, y dos veces seguidas.
- Las dos Edge Functions por lectura (R-A8): de dónde sacan el usuario, qué
  borran y si un id del cuerpo de la petición puede apuntar a otro usuario.
- `audit.sql` ejecutado en producción por el usuario al empezar: resultado
  pegado en §6.

**Aceptación:** cada regla A/B/C de servidor con nivel en §6, y cada
"confirmado" con su `E27+` y su test rojo.

### 5.2 I02-03 — App: conexión y sincronización

Reglas B, C y D en el store. Sobre `connection.sim.test.js` y
`clientSync.sim.test.js`, que ya existen: primero se mapea qué regla cubre
cada uno de sus 38 escenarios, y después solo se escriben los que falten.

- Matriz de cortes: para cada traspaso (R-C7, R-D1), un fallo en **cada**
  llamada al servidor (`server.failOnce`) y la app muerta entre dos llamadas.
  Hoy hay cortes sueltos, no la matriz.
- R-C2 con el mismo entreno subido dos veces, desde dos móviles y tras
  reinstalar.
- R-B4, R-B6 y R-C4 tal como quedaron firmadas: desconectarse, volver con el
  mismo código y cambiar de entrenador sin que el entrenador pierda sesiones
  (hoy fallan, §3.7).

### 5.3 I02-04 — App: PRO, límites y congelado

Reglas E.

- Inventario de **todos** los caminos que crean un cliente o una plantilla, o
  que tocan un cliente: `grep` de cada acción del store que escribe `clients`,
  `programs` o `sessionTemplates`, más las llamadas a `uploadProgramToClient`,
  `sendOverrides`, `downloadClientHistory` y `reissueClientCode`. Por cada
  uno: ¿pasa por la puerta? Tabla en §6.
- Test por camino que no pase por la puerta. El que pase queda descartado.
- R-E4 contra cambiar de cuenta, reinstalar con backup e `importData`.

### 5.4 I02-05 — App: compra, restauración e identidad

Reglas D2-D3 y F.

- Un doble de `react-native-purchases` para vitest que mueva el `customerInfo`
  por estados: sin compra, comprado, `customerInfo` tardío, cancelado, "ya
  comprado", caducado, otra cuenta. Con él, tests de `purchasePackage`,
  `restorePurchases`, `checkProStatus` y del `logIn` al cambiar de forma de
  entrar (`useStore.js` ~4920-5040).
- Lo que depende de la tienda de verdad pasa a casillas T de I02-06.

### 5.5 I02-06 — Dispositivo y tienda

Lo que el banco no ve: red real, tienda real y dos móviles de verdad. Solo el
uso normal de la app (26-oct-2026: los casos raros ya los fijan los tests).
Antes: `schema.sql` ejecutado en Supabase y una build desde `develop`. Hacen
falta dos móviles; el 10 necesita además la build publicada.

**Probar I02-06**

- [ ] I02-06.1 — Cliente. Entrar con el código de un cliente nuevo: llega el programa; entrenar una sesión y el entrenador la ve al refrescar su ficha.
- [ ] I02-06.2 — Cliente. Corregir en el resumen el RPE o la nota de un entreno ya enviado: el entrenador ve el cambio.
- [ ] I02-06.3 — Cliente. Borrar un entreno en el cliente: no vuelve al reabrir la app ni tras un rato.
- [ ] I02-06.4 — Cliente. Entrenar en modo avión y guardar: al quitarlo y abrir la app, el entrenador recibe la sesión.
- [ ] I02-06.5 — Cliente. El entrenador cambia el programa y lo envía: al cliente le sale el aviso, lo aplica y sigue en la etapa y sesión donde iba.
- [ ] I02-06.6 — Cliente. El entrenador prescribe pesos para la próxima sesión: el cliente los ve al empezarla.
- [ ] I02-06.7 — Cliente. Estando conectado, «Nuevo programa» (o importar uno): sale el aviso de que hay que desconectarse; «Desconectarme» y se crea el programa. El entrenador lo ve como «se fue».
- [ ] I02-06.8 — Cliente. Desconectarse en modo avión: la app queda desconectada al momento; al quitar el modo avión y abrir la app, el entrenador lo ve como «se fue».
- [ ] I02-06.9 — Cliente. Cambiar de móvil: con Google en el móvil nuevo vuelve a su entrenador con su historial; sin Google, con el código y «traer el historial».
- [ ] I02-06.10 — Cliente. Con la build publicada (anterior a hoy), entrar con un código que tiene historial sigue ofreciendo traerlo.
- [ ] I02-06.11 — Entrenador. Crear un cliente con app y mandarle el código: entra y aparece como conectado.
- [ ] I02-06.12 — Entrenador. Cambiar de móvil: recuperar la cuenta en el móvil nuevo y aparecen todos los clientes con su programa.
- [ ] I02-06.13 — Entrenador. Con la cuenta en dos móviles: borrar un cliente en uno y en el otro desaparece al refrescar; cancelar una invitación y en el otro queda «sin app».
- [ ] I02-06.14 — Entrenador. Pasar de código a Google con PRO: sigue PRO y con todos sus clientes.
- [ ] I02-06.15 — Pagos. Compra anual en sandbox: PRO al momento; al caducar (minutos en sandbox), al abrir vuelve a gratis sin perder nada.
- [ ] I02-06.16 — Pagos. Restaurar la compra en un segundo móvil con la misma cuenta: PRO.
- [ ] I02-06.17 — Pagos. Build de producción: sin interruptor PRO/FREE y sin PRO forzado.

---

## 6. Registro

Lo rellena cada fase: una fila por regla y por hallazgo de la pasada
adversaria. Es el entregable. Los fallos se describen en `auditoria-tecnica.md`
y aquí solo se enlazan.

| Regla / hallazgo | Fase | Nivel | Dónde vive la protección | Prueba | Fallo |
|---|---|---|---|---|---|
| R-A1 · A2 · A3 · A4 · A7 · A8 · B1 · C5 · C6 | I02-02 | Descartado | Servidor | Fijados por test: `server.hostile.sim.test.js` › «Descartados» (T-A1…T-C6) | — |
| R-A5 | I02-02 | Confirmado | Servidor | H2: 9 campos en vez de 3 | [E30](auditoria-tecnica.md#30) |
| R-A6 | — | Descartado (2 sospechas) | Servidor | 32⁸ códigos; sin límite de ritmo y `random()` no criptográfico: falta saber la versión de Postgres en producción | — |
| R-A9 | I02-02 | Confirmado | Revisión manual | H3: diez derivas graves y `audit.sql` sale vacío; el resultado vacío de producción (23-oct) no demuestra nada | [E31](auditoria-tecnica.md#31) |
| R-B2 | I02-02 | Descartado (fijado) | Servidor | H4: bloquea cualquier cuenta que no sea solo el código; la regla se ajustó a eso el 23-oct | — |
| R-B3 | I02-02 | Confirmado | Servidor | H5a, H5b | [E34](auditoria-tecnica.md#34) |
| R-B4 | I02-02 | Descartado (fijado) | Servidor | H1: quien entra ve el historial. H1b: tras reemitir, también lo ve otra persona; aceptado («un hueco = una persona») | — |
| R-B6 · R-C4 | I02-02 | Confirmado | Servidor | H6: tres caminos vacían el hueco; H15 | [E27](auditoria-tecnica.md#27), [E36](auditoria-tecnica.md#36) |
| R-C1 · R-C7 | I02-02 | Confirmado | Servidor y store | H7, H9 | [E32](auditoria-tecnica.md#32) |
| R-C2 | I02-02 | Confirmado | Servidor | H8a, H8b | [E28](auditoria-tecnica.md#28) |
| R-D4 | I02-02 | Confirmado | Store | H12 | [E33](auditoria-tecnica.md#33) |
| Adversaria: traspasos sin consentimiento | I02-02 | Confirmado | Ninguna | H10, H11 | [E29](auditoria-tecnica.md#29) |
| Crear hueco no idempotente | I02-02 | Confirmado | — | H13 | [E35](auditoria-tecnica.md#35) |
| Subida en vuelo al cambiar de entrenador | I02-02 | Confirmado en el SQL; en la app, sospecha | — | H14 | [E37](auditoria-tecnica.md#37) |
| Endurecimiento: límite de ritmo, tamaño de datos, error interno de `delete-account`, el banco no imita los permisos por defecto de Supabase | I02-02 | Sospecha | — | Solo lectura | — |
| R-A7 | — | Descartado | — | `profiles.role` solo lo lee `isTrainer` (`supabaseAuth.js:80`) para elegir pantalla; ninguna función SQL lo mira | — |
| R-E1 | I02-04 | Confirmado (en parte aceptado) | Store | Importar y restaurar meten plantillas y clientes por encima del límite: **aceptado** (decisión 1, como al caducar). Pulsar rápido: 2 con app (P16-P18) | [E42](auditoria-tecnica.md#42) |
| R-E2 | I02-04 | Confirmado | Pantalla | El store deja escribir sobre un congelado: ficha, programa, prescripciones, importar, entreno en curso, etapa que llega del servidor (P7-P11) | [E43](auditoria-tecnica.md#43) |
| R-E3 | I02-04 | Confirmado | Store | Drive pierde las plantillas de programa (P3); reinstalar sin PRO deja los clientes recuperados sin programa para siempre (P12) | [E38](auditoria-tecnica.md#38), [E39](auditoria-tecnica.md#39) |
| R-E4 | I02-04 | Confirmado | Store | Cuando la elección deja de valer se congela todo y se vuelve a elegir (P14, P15, P21, P22). Reinstalar (P13) aceptado | [E40](auditoria-tecnica.md#40) |
| Honrado: conectar un activo | I02-04 | Confirmado | Store | Con congelados no se puede pasar a la app un activo, porque cuentan todos (P19) | [E41](auditoria-tecnica.md#41) |
| R-E6 · R-E7 | I02-04 | Descartado | — | Producción sin `FORCE_PRO`; interruptor solo con `__DEV__`. Ojo: `FORCE_PRO` no fuerza PRO, solo se salta RevenueCat | — |
| R-F3 | I02-05 | Confirmado | Store | «Ya comprado» espera un código que el SDK no manda (`'6'`) | [E44](auditoria-tecnica.md#44) |
| R-D2 | I02-05 | Confirmado | Ninguna | Cuatro caminos pierden el PRO al cambiar de cuenta (D2-a…d) | [E45](auditoria-tecnica.md#45) |
| R-E5 | I02-05 | Confirmado | Store | Sin plazo; la caché del SDK sin red escribe PRO; un backup de Android al reinstalar devuelve PRO (X4) | [E46](auditoria-tecnica.md#46) |
| R-F1 | I02-05 | Confirmado (un caso) | Store | Cobrado y la segunda mirada sin red: «compra hecha» sin PRO (F1b) | [E47](auditoria-tecnica.md#47) |
| R-D4 / R-D3 | I02-05 | Confirmado | Store | Borrar la cuenta con `logOut` caído, o a medias, deja el PRO de la cuenta borrada (D3-b, D3-c) | [E48](auditoria-tecnica.md#48) |
| R-F2 · R-F4 · R-D3 · importar `isPro` | I02-05 | Descartado (fijado) | Store | `purchases.audit.test.js`: cancelar, restaurar, cerrar sesión; `importData` ignora `isPro` y `freeClientIds` | — |
| R-F5 | I02-05 | Sin camino | — | Con PRO el paywall no se abre: no hay forma de pasar de anual a pago único. Idea, no fallo (§7) | — |
| R-D3 | — | Descartado | Store | `RC.logOut` solo en `deleteAccount` (M01 §3.6) | — |

## 7. Decisiones

Cerradas el 23-oct-2026: borrar la cuenta (excepción de R-C4), modelo del código (R-B2, R-B3), R-B4 (lo ve, es la misma persona), R-C4 (el
entrenador lo recibe todo), R-E5 (20 días sin red), R-E7 (A por ahora, B
cuando crezca), R-D1 (se queda el traspaso de hoy).

1. **R-E7 — decidido A; B cuando la app crezca.** Hoy el
   servidor no sabe quién ha pagado: crea todos los huecos que se le pidan. La
   app es la que dice «3 de 3». Quien modifique el APK (hace falta saber
   hacerlo, no es tocar un ajuste) tendría PRO gratis: clientes y plantillas
   sin límite. No puede tocar datos de nadie más (eso lo protege el servidor,
   reglas A), así que el daño es dinero que no entra, no datos.
   - **A (hoy, recomendada por ahora):** aceptarlo. Es lo que se decidió en M01
     §9, y con pocos usuarios lo que se pierde es casi nada.
   - **B:** que RevenueCat avise al servidor de quién paga (webhook → una
     tabla) y que `trainer_create_slot` se niegue a pasar de 3 sin PRO. Cuesta
     una Edge Function, una tabla y casos nuevos en el banco, y aun así solo
     protege los clientes conectados: las plantillas y los clientes manuales
     viven en el móvil y no pasan por el servidor.
   Decisión del usuario: A por ahora. Cuando la app crezca, B, con el PRO en
   una tabla que el usuario no pueda tocar. Lo que importa proteger es el uso
   del servidor (clientes conectados), no lo que vive en el móvil.
2. **R-D1 — se queda el traspaso de hoy.** `linkIdentity` (la cuenta «se
   transforma» en vez de mudarse) solo se reconsidera si I02-03 encuentra
   fallos en el traspaso.
3. **Cerradas tras I02-02** (23-oct-2026):
   - Borrar la cuenta solo vacía el hueco que el cliente ocupa en ese momento
     (excepción de R-C4).
   - El código sigue siendo la contraseña que siempre vale. No se hace de un
     solo uso y no se avisa al entrenador (R-B2, R-B3).
   - Reemitir el código y dárselo a otra persona se acepta, con la norma «un
     hueco = una persona» (R-B4).
   - R-B2 se ajusta a lo que hace el servidor (H4).
   - **Sale una tarea nueva, fuera de esta auditoría:** recomendar más que el
     cliente vincule Google o Apple al entrar con el código. Con eso el código
     ya no puede echarle y, al reinstalar, entra sin pedir nada. Va a una spec
     `C` (o a `docs/ideas.md`, que escribe el usuario).
4. **Cerradas tras I02-04 e I02-05** (24-oct-2026):
   - Importar o restaurar por encima del límite gratis se acepta (como al
     caducar: lo que tienes se queda).
   - Rehacer la elección reinstalando o con un backup se acepta (R-E4, R-E7).
   - La elección persiste: lo nuevo que no cabe se congela solo (R-E4).
   - Los clientes inactivos cuentan para el límite.
   - R-E5 reescrita: periodo pagado + 20 días; el pago único no caduca.
   - **Sale una idea, sin prisa:** pasar de anual a pago único (R-F5), como
     recordatorio cuando quede un mes para renovar. Es conversión.
   - **Sale otra idea, más grande:** clientes de otra cuenta y copia en la
     nube del trabajo del entrenador. Va a una spec `C` propia.
5. **Cerradas tras I02-03** (26-oct-2026):
   - E58: gana la última edición. Cada entreno lleva su fecha de edición
     (`updatedAt`).
   - E59: lo que se borra se marca (`deletedAt`) en vez de quitarse, y la
     fusión respeta la marca.
   - E51: antes de soltar el asiento se intenta subir lo pendiente. Si no se
     puede, la app avisa de cuántos entrenos no llegarán y el usuario decide.
   - R-D1: se quita el paso de Google o Apple a código (E49 deja de tener
     camino).
6. **Cerradas en la tanda C** (26-oct-2026):
   - R-A5 se amplía a los tres nombres y cuatro sí/no (E30).
   - E60: si el entrenador borra un cliente en un móvil, el otro móvil también
     lo borra (R-B6). Si el hueco pasó a otra cuenta, sigue «de otra cuenta».
   - E31: `audit.sql` guarda una huella de cada función; al cambiar una en
     `schema.sql` se actualiza su huella (lo avisa «H3 montaje»).
7. **Cerradas en la tanda D** (26-oct-2026): R-B8, R-B9 y R-B10 nuevas;
   E52 cambia (desconectarse sin red se permite, con cola). Regla de
   compatibilidad: lo que lee una build publicada no se cambia; lo nuevo va en
   campos nuevos. E45-d aparcado.
4. **¿Quién hace las pasadas?** *Revisado el 23-oct-2026 por coste:* una
   pasada de Opus con esfuerzo máximo agotó el uso. A partir de ahora, Opus
   con esfuerzo alto solo para la pasada por reglas de cada zona, y la
   adversaria y los tests con Sonnet (alto). Nunca varias pasadas máximas a la
   vez. Antes decía: Recomendado: el modelo más fuerte con esfuerzo
   alto para las pasadas (§4.2), y Sonnet en subagentes para escribir los
   tests que confirman.
