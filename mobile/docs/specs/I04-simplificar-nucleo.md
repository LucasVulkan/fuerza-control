# Spec — Simplificar el núcleo: menos estados, menos cruces

> Tema: integridad
> En corto: En vez de parchear uno a uno los fallos de conexión, cuentas y pagos que siguen apareciendo, quitar las situaciones que los provocan: decidir qué no se permite, que cada dato tenga un solo dueño, que restaurar una copia no traiga estado de conexión, que la cola solo reintente lo que el entrenador envió, y que cada regla de la app tenga su test.
> Inicio: 2026-10-29
> Fase I04-01 · pendiente · Decisiones del usuario: qué se permite y qué no · §3
> Fase I04-02 · aparcado · Restaurar una copia trae contenido, nunca estado de conexión: sustituida por C10-06 · §4
> Fase I04-03 · hecho · La cola solo reintenta lo que se envió y falló · §5
> Fase I04-04 · terminado · Escribir en una ficha solo si sigue existiendo · §6
> Fase I04-05 · hecho · Pago pendiente: no se compra otra vez y no cruza cuentas · §7
> Fase I04-06 · pendiente · Un solo traductor de errores para envíos y cuentas · §8
> Fase I04-07 · pendiente · Cada regla de I02 con su test de escenario · §9
> Fase I04-08 · pendiente · Estado de la ficha como un solo valor · §10
> Fase I04-09 · pendiente · El programa del cliente conectado se aplica solo · §11
> Fase I04-10 · aparcado · Deshacer al borrar un cliente: sustituida por C10-07 · §11
> Fase I04-11 · pendiente · Acciones de cuenta y conexión desactivadas sin red · §11
> Fase I04-12 · pendiente · «Enviar informe»: errores guardados y nota, a Supabase · §11
>
> Estado: **spec escrita, sin empezar** (28-oct-2026). Sale de una pregunta del
> usuario tras la revisión I03: cada pasada de búsqueda encuentra fallos nuevos,
> algunos graves, y buscar más no converge. La respuesta acordada es simplificar
> y limitar en vez de buscar. Sustituye al «arreglar E72-E84 uno a uno»: siete de
> los trece desaparecen por diseño (§2) y el resto se arregla dentro de estas
> fases. **I04-01 va primero y es del usuario**: el resto depende de lo que
> decida. Las decisiones viven en el mapa del núcleo,
> [`docs/nucleo.md`](../nucleo.md) (reglas N-01…N-17), que manda sobre esta
> spec. El informe y los tests de I03 están en las ramas
> `claude/serene-mahavira-ac8868` (59f4262) y `claude/adversaria-i03-ebe0b7`,
> sin fusionar.

---

## 1. Por qué los fallos no se acaban

Los trece fallos de I03 no están en una función suelta: están en los **cruces**
entre funciones. Restaurar Drive × conexión (E73, E78, E79), cola × borrar
(E74), cola × «cambios sin enviar» (E72, E80, E84), pago pendiente × otra compra
× otra cuenta (E75, E81, E82), cualquier error × la pantalla que lo enseña (E76,
E77). Cada función nueva no añade un caso: añade uno por cada cosa con la que se
cruza. Por eso cada pasada de búsqueda recorre caminos distintos de un espacio
que crece y siempre trae algo.

Dos causas de fondo en el código:

- **El estado de un cliente son muchas banderas sueltas** (`syncSlotId`,
  `syncLinked`, `syncOrphan`, `syncPending`, `syncCode`, `syncErrorAt`,
  `syncLeftAt`, `programDirty`, `overridesDirty`, `programUploadedSig`…). Cada
  combinación es un estado posible aunque casi ninguno tenga sentido, y cada
  función tiene que acertar con todas.
- **Hay cuatro sitios que se creen la verdad**: el móvil, el servidor
  (Supabase), la tienda (RevenueCat) y la copia de Drive, que reescribe el móvil
  entero con datos de otro momento.

La salida no es buscar más, sino **que haya menos estados posibles y menos
sitios que se crean la verdad**. Lo que no puede pasar no hace falta probarlo.

## 2. Qué fallos de I03 resuelve cada fase

| Fallo | Gravedad | Lo resuelve | Cómo |
|---|---|---|---|
| E73 restaurar reenvía lo viejo | rompe datos | I04-02 + I04-03 | la copia no trae marcas de envío; la cola no envía marcas |
| E78 recuperar + restaurar duplica | rompe datos | I04-02 | una ficha por hueco al restaurar |
| E79 restaurar no recupera un borrado | rompe datos | I04-02 | hueco borrado → entra sin app, con historial |
| E74 ficha fantasma tras borrar | rompe datos | I04-04 | nunca se crea una ficha al escribir |
| E80 la cola envía lo no enviado | rompe flujo | I04-03 | la cola tiene su propia lista |
| E72 abrir etapa sin red no llega | rompe flujo | I04-03 | el envío fallido entra en la cola, esté o no marcada la ficha |
| E75 comprar con pago pendiente | rompe flujo | I04-05 | el paywall no deja comprar con un pago en camino |
| E84 invitado + cola a la vez | menor | I04-03 | un solo camino de envío |
| E82 «PRO activado» de otra cuenta | menor | I04-05 | el pendiente es de una cuenta y se borra al cambiar |
| E81 «ya comprado» en otra cuenta | confunde | I04-05 | mensaje propio, sin restaurar a la vista |
| E76, E77 error técnico en pantalla | confunde | I04-06 | un solo traductor |
| E83 NetInfo no ve el corte | menor | I04-03 | el reintento no depende solo de NetInfo |

## 3. I04-01 — Decisiones del usuario

Las decisiones ya no se plantean aquí: están en el **mapa del núcleo**,
[`docs/nucleo.md`](../nucleo.md) §7, como reglas N-01…N-17 (las marcadas
DECIDIR esperan al usuario). Este es el reparto de las decisiones que antes
estaban aquí (D1-D8) y de las fases que las implementan:

| Antes | Regla del mapa | Fase |
|---|---|---|
| D1 restaurar | N-04 (reemplazar, no mezclar) + N-05 (volver a preguntar a los dueños) | I04-02 |
| D2 qué sale solo | N-02 + N-06 (solo sale lo que se mandó; cola propia) | I04-03 |
| D3 pago pendiente | N-11 (un pago a la vez) | I04-05 |
| D4 varias cuentas | N-09 (una cuenta a la vez; salir vacía lo de esa cuenta) | I04-03, I04-05 |
| D5 cuenta sin red | N-03 (lo que cambia quién es quién necesita red) | I04-11 |
| D6 varios móviles | N-10 (un móvil de trabajo) | I04-03 |
| D7 estado de la ficha | N-15 (después de la release) | I04-08 |
| D8 uso real | N-16 («Enviar informe») | I04-12 |
| — | N-07 (el programa del entrenador se aplica solo) | I04-09 |
| — | N-08 (un hueco, una ficha; el servidor no crea fichas) | I04-02, I04-04 |
| — | N-12 (congelado, también para la cola) | I04-03 |
| — | N-13 (deshacer al borrar) | I04-10 |
| — | N-14 (ningún texto técnico) | I04-06 |

I04-01 se cierra cuando el usuario ha decidido todas las DECIDIR del mapa; se
apunta la fecha en cada regla y las fases de abajo se ajustan a lo decidido
(p. ej. si N-04 queda en «mezclar», I04-02 sigue el texto de §4 tal cual; si
queda en «reemplazar», §4 se simplifica: restaurar vacía el móvil y carga la
copia).


## 4. I04-02 — Restaurar trae contenido, nunca estado de conexión

Según N-04, N-05 y N-08 del mapa. En `importData` (`store/useStore.js`, rama `sections.clients`) y en
`buildBackupPayload` (`src/utils/backupPayload.js`):

- **La copia deja de guardar** las marcas de envío: `programDirty`,
  `overridesDirty`, la cola de I04-03, `syncPending`, `syncErrorAt`. Las copias
  viejas que las traen: se ignoran al restaurar.
- **Una ficha por hueco.** Si una ficha del archivo trae un `syncSlotId` que ya
  tiene una ficha local, queda **una sola**: el contenido del archivo con el
  enlace de la local (E78). No se borra nada del servidor.
- **Hueco borrado por esta cuenta** (lápida): la ficha entra **sin app**, sin
  hueco, con su programa e historial (E79). Es lo que el entrenador quiere al
  restaurar para deshacer un borrado; volver a conectarla es invitarla otra vez.
- **Hueco desconocido en el móvil**: entra con su hueco y el siguiente
  `refreshTrainerSlots` decide (vivo, «de otra cuenta» o perdido), sin crear una
  segunda ficha.
- El PRO nunca viene de la copia (ya es así; se deja escrito con test).

Tests: los de E73, E78 (`i03.audit.sim.test.js`) y A2/E79 (rama adversaria) en
verde, más uno de «restaurar dos veces la misma copia no cambia nada».

## 5. I04-03 — La cola solo reintenta lo que se envió y falló

Según N-06 del mapa. Hoy `sendPendingPrograms` recorre `programDirty`/`overridesDirty`, que
significan «difiere de lo enviado», no «se pulsó Enviar» (E80).

- **Una marca propia en la ficha**: `sendPending: { program?: true,
  overrides?: true }` (guardada en disco con la ficha). Solo la pone un envío
  que falla **por red** (`uploadProgramToClient`, `sendOverrides`); la quita el
  envío que acaba bien. `programDirty` vuelve a ser solo el aviso. *(Cambiado el
  29-oct-2026: antes era una lista aparte, `outbox`. En la ficha, borrar el
  cliente se lleva su cola con él y nunca queda una entrada que apunte a una
  ficha que ya no existe.)*
- **Un solo camino**: la cola, el envío a mano y la subida del invitado pasan
  por la misma función con el mismo cerrojo (E84).
- **Al reintentar se manda lo de ahora**, no lo de cuando falló: el programa
  actual de ese cliente. Si entretanto se congeló, la marca se quita; si se
  borró, ya no hay marca.
- **Reintentos**: al volver la red (NetInfo), al volver a primer plano, al
  arrancar, y además un reintento con espera (30 s, 2 min, 10 min) mientras
  quede algo, para cuando NetInfo no ve el corte (E83). Sin red según NetInfo no
  se intenta solo; a mano, sí.
- Cambiar o salir de cuenta quita `sendPending` de todas las fichas (N-09).
- Las copias de Drive no llevan `sendPending` (I04-02, C10 §8.1).

Tests: E72, E80 (A3), E73 y E84 en verde, más «dos llamadas a la vez suben una
vez» (ya existe) y «sin pulsar Enviar, volver a primer plano no envía nada».

**Hecho (29-oct).** `_send(clientId, kind, programId?)` (`useStore.js`) es lo
único que sube programa o prescripciones a un hueco; `uploadProgramToClient` y
`sendOverrides` son su API pública. Va en cadena por cliente (nunca dos a la vez)
y marca/desmarca `sendPending[kind]`: la pone si falla por red y arma el
temporizador, la quita si acaba bien o falla por otra cosa. `sendPendingPrograms`
se parte en `sendAll()` («Enviar todo», acción del usuario: sin red todo queda
en cola) y `retrySendQueue()` (automática: NetInfo, primer plano, arranque y el
temporizador; solo fichas con `sendPending`, manda lo de ahora, quita la marca si
la ficha ya no admite envíos, una sola en vuelo, nunca lanza). El temporizador es
uno solo: 30 s, 2 min y luego cada 10 min mientras quede algo en cola. El
suscriptor del invitado pasa por `_send` (sin `invitedInFlight`). Salir o cambiar
de cuenta vacía la cola; las copias no la guardan ni la restauran. Las fichas
enseñan «En cola · se enviará al volver la conexión» en vez de «Cambios sin
enviar» (lista y ficha). «Enviar todo» y la insignia siguen contando las fichas
con cambios sin enviar, y las que están en cola cuentan también (siguen con
cambios): pulsarlo las reenvía al momento. Tests: `store/sendQueue.sim.test.js`.

**Probar I04-03**

- [ ] Sin red, abrir una etapa a un cliente con app: dice «Sin conexión. Se enviará cuando vuelva» y su ficha (lista y detalle) dice «En cola · se enviará al volver la conexión». Al volver la red, el cliente la ve abierta y la ficha ya no dice «En cola».
- [ ] Con red, editar el programa de un cliente con app sin pulsar «↑ Enviar», irse a otra app y volver (y cerrar y abrir la app): la ficha sigue en «Cambios sin enviar» y el cliente no recibe nada.
- [ ] «Enviar todo» en modo avión con dos o más clientes con cambios: todos quedan «En cola». Al quitar el modo avión, llegan a todos sin tocar nada.
- [ ] Con datos y mala cobertura (o desconectando el router con el wifi puesto), «↑ Enviar» falla: al volver la conexión llega solo en menos de un minuto.
- [ ] Un cliente en cola al que se le quita el programa o se congela (plan gratis): deja de decir «En cola» y no se le envía nada.
- [ ] Salir de la cuenta de entrenador con algo en cola y volver a entrar: ninguna ficha dice «En cola».

## 6. I04-04 — Escribir en una ficha solo si sigue existiendo

E74 y los tres sitios de A1: después de un `await`, el `set` hace
`[clientId]: { ...s.clients[clientId], … }` y, si la ficha se borró entretanto,
crea una ficha fantasma. Una sola función `patchClient(s, id, patch)` que
devuelve el estado sin cambios si la ficha no existe, y todos los `set` sobre
`clients[id]` que van detrás de un `await` pasan por ella. Un test por sitio, y
una regla de grep en el test de integridad: ningún `[clientId]: { ...s.clients[`
fuera de `patchClient`.

**Hecho (29-oct).** `patchClient(s, id, patch)` vive junto a `_clearPending` en
`useStore.js`; `patch` es un objeto o una función de la ficha actual. Por ella
pasan todos los `set` que actualizan una ficha existente (no solo los de detrás
de un `await`): una sola forma de escribir. Donde el `set` llevaba además otro
trozo de estado ligado a esa ficha (`pushTrainerLogToSlot`,
`downloadClientHistory`, `markHistoryViewed`), con la ficha borrada no se escribe
nada, tampoco `lastSeenSessionsCount` ni su historial. Tests y regla de grep:
`store/patchClient.sim.test.js`.

## 7. I04-05 — Pago pendiente: no se compra otra vez y no cruza cuentas

Según N-11 y N-09 del mapa:

- `_proPending` pasa a `{ userId }` (la cuenta de RevenueCat que pagó) y se
  guarda en disco.
- Con pendiente, `purchasePackage` no llama a la tienda y el paywall enseña el
  estado de pendiente con «Restaurar compras» (E75). El texto de
  `paywall.pending` dice «no hace falta volver a pagar».
- «PRO activado» solo si el PRO llega en la misma cuenta del pendiente (E82).
- Cambiar o salir de cuenta borra el pendiente.
- «Ya comprado» con la compra en otra cuenta de la tienda: restaurar en
  silencio y, si no trae PRO, el mensaje de «la compra está en otra cuenta de
  {{store}}» con «Entendido» (E81).

Tests: los de E75, A5, A6 en verde. Casilla de dispositivo: en la tienda de
pruebas de Play, comprobar qué pasa con un segundo producto con otro pendiente.

Decisión sin spec: el reintento silencioso de arranque (`restorePurchases({ silent })`)
no borra el pendiente aunque no encuentre nada, porque la tienda aún puede
confirmarlo; solo lo borra el «Restaurar» que pulsa el usuario. Si la compra
se hizo sin cuenta, el pendiente (`userId: null`) pasa a la cuenta al entrar en
ella (RevenueCat funde la compra anónima).

**Probar I04-05**

- [ ] Con un pago pendiente (tarjeta de pruebas «pago lento» de Play), abrir el paywall: en vez de los planes sale «Tu pago está pendiente de confirmar; no hace falta volver a pagar…» y el botón «Restaurar compra». No se puede volver a pagar.
- [ ] Cerrar la app del todo con el pago pendiente y abrir el paywall: sigue en estado pendiente.
- [ ] Cuando la tienda confirma el pago en la misma cuenta: aviso «PRO activado» una sola vez y el paywall vuelve a mostrar los planes.
- [ ] Pago pendiente, Mi cuenta → Salir de la cuenta, y abrir el paywall: ya ofrece los planes (el pendiente se borró).
- [ ] Pago pendiente, entrar en otra cuenta de entrenador: no sale «PRO activado» si el PRO llega luego, y el paywall ofrece los planes.
- [ ] Con pendiente y sin que la tienda haya cobrado nada, «Restaurar compra»: dice que no hay compras y el paywall ofrece de nuevo los planes.
- [ ] Comprar con una cuenta de la tienda que ya tiene el producto comprado para otra cuenta de la app: sale «La compra está en otra cuenta de Google Play/App Store…» con un único botón «Entendido».
- [ ] En la tienda de pruebas de Play: con un pendiente de un producto, comprobar qué pasa con un segundo producto (anual y pago único); no debe dejar pagar el segundo.

## 8. I04-06 — Un solo traductor de errores

`sendFailure` (`src/utils/networkError.js`) se amplía a todo error que llega a
pantalla: envíos, cuentas, conexión, Drive. Errores con código propio enseñan su
mensaje; los de red, «Sin conexión»; el resto, el texto de la pantalla, y
`err.message` al log. Todas las pantallas de E76 y E77 pasan por él. Regla de
grep en el test de integridad: ningún `err.message` / `err?.message` dentro de
`showToast(` o `showDialog(` en `src/`.

## 9. I04-07 — Cada regla de I02 con su test de escenario

El contrato ya existe: la tabla de reglas de
[I02](I02-conexion-pagos-pro.md) (R-A…R-F) y las reglas N-01…N-17 del
[mapa del núcleo](../nucleo.md). Esta fase:

- Añade a la tabla una columna **Test**: el test de escenario (en los
  `*.sim.test.js`, con el SQL real) que demuestra cada regla. Las que no tienen
  test se escriben, una por regla, recorriendo el camino de un usuario, no una
  función.
- Desde aquí, **toda tarea que toque conexión, cuentas o pagos dice en su spec
  qué reglas toca**, y se cierra con esos tests en verde.
- **El núcleo se toca de uno en uno**: conexión, cuentas y pagos nunca en
  subagentes paralelos. Pantallas y textos, sí.
- **Gravedad**: perder datos o cobrar mal, cero tolerancia antes de publicar;
  «confunde» y «menor» pueden salir y arreglarse después.

## 10. I04-08 — Estado de la ficha como un solo valor

Según N-15 del mapa, después de la release. Las banderas `sync*` de cada ficha pasan a un
solo campo `link` con cinco valores — `none` (sin app) · `invited` · `linked` ·
`otherAccount` · `lost` — y una función pura `nextLink(link, evento)` con los
cambios permitidos, en un solo archivo y con un test por transición. Lo que hoy
deduce `clientLink()` de las banderas se lee de ahí. Migración de las fichas
guardadas al arrancar, con test sobre fichas de cada versión.

## 11. Fases de las reglas nuevas del mapa

Se detallan al decidir su regla en el [mapa](../nucleo.md) §7.

- **I04-09 · N-07.** El programa nuevo del entrenador se aplica al empezar la
  siguiente sesión del cliente (nunca a mitad de un entreno), con
  `mergeProgressOnImport` como hoy, y un aviso de qué ha cambiado. Desaparecen
  `dismissPendingProgramUpdate` y el estado «por aplicar».
- **I04-10 · N-13.** Borrar un cliente enseña el toast «Deshacer» de P16-07; el
  hueco se apunta en `deletedSlotIds` solo cuando el toast se va. Deshacer
  devuelve la ficha, sus programas y su historial tal cual.
- **I04-11 · N-03.** Con `ui.online === false`, los botones de crear cuenta,
  entrar, recuperar, pasar a Google o Apple, borrar la cuenta, invitar,
  reemitir, cancelar la invitación, canjear un código y pasar a la app se
  desactivan con «Necesitas conexión para esto».
- **I04-12 · N-16.** «Enviar informe»: un registro de errores en el móvil que
  sobrevive a cerrar la app (tamaño fijo), una pantalla con nota y vista previa
  de lo que se envía, y una tabla `bug_reports` en Supabase que solo admite
  insertar (con tamaño máximo), también sin cuenta. Sin datos personales.
  «Volver a sincronizar» queda descartado (ver el mapa, N-16).

## Fases

| Fase | Qué | Depende de | Coste | Estado |
|---|---|---|---|---|
| I04-01 | Decidir las reglas DECIDIR del mapa del núcleo | — | 🟢 | pendiente |
| I04-02 | Restaurar sin estado de conexión (E73, E78, E79) | I04-01 | 🟡 | sustituida por [C10-06](C10-clientes-de-la-cuenta.md) (hecha 29-oct) |
| I04-03 | Cola propia (E72, E80, E83, E84) | I04-01 | 🟡 | hecho 29-oct — un solo camino `_send`, `sendAll` y `retrySendQueue` separados, reintento con espera; tests en `store/sendQueue.sim.test.js`; casillas por probar |
| I04-04 | `patchClient` (E74 + A1) | — | 🟢 | terminado 29-oct — todos los `set` sobre una ficha pasan por `patchClient`; tests en `store/patchClient.sim.test.js` (sin nada que probar a mano) |
| I04-05 | Pago pendiente (E75, E81, E82) | I04-01 | 🟡 | hecho 30-oct — `_proPending` es `{ userId }`, se guarda en disco y se borra al salir, borrar la cuenta, cambiar de cuenta o restaurar sin nada; tests en `store/purchases.audit.test.js`; casillas por probar |
| I04-06 | Traductor de errores (E76, E77) | — | 🟢 | pendiente |
| I04-07 | Reglas de I02 con test | I04-02…06 | 🟡 | pendiente |
| I04-08 | Estado de la ficha en un valor | I04-07, release | 🔴 | pendiente |
| I04-09 | Programa del entrenador se aplica solo (N-07) | I04-01 | 🟡 | pendiente |
| I04-10 | Deshacer al borrar (N-13) | I04-01 | 🟢 | sustituida por [C10-07](C10-clientes-de-la-cuenta.md) (hecha 29-oct) |
| I04-11 | Cuenta y conexión sin red, desactivadas (N-03) | I04-01 | 🟢 | pendiente |
| I04-12 | «Enviar informe» (N-16) | — | 🟡 | pendiente |

Orden (28-oct-2026): N-15 y N-17 (clientes de la cuenta, estado en un valor) van
**antes de la release** en una spec propia que se planifica primero, y
absorben I04-02 (restaurar) e I04-08 (estado de la ficha). Esa spec es
[C10](C10-clientes-de-la-cuenta.md) (28-oct-2026, por aprobar): I04-02 pasa a
C10-06, I04-08 a C10-01 y C10-04, e I04-10 (deshacer al borrar) a C10-07, y
pide I04-03 e I04-04 hechas antes de empezar. Lo que no depende del
modelo de cliente va antes, de una en una por tocar el núcleo: I04-04 (la más
pequeña), I04-05 (pagos), I04-03 (cola). I04-06 e I04-12 pueden ir en paralelo
porque son de pantallas y de una tabla nueva. Al cerrar cada una, sus fallos E-xx se dan de alta como resueltos en
[auditoria-tecnica.md](auditoria-tecnica.md).
