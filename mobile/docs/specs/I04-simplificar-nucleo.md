# Spec — Simplificar el núcleo: menos estados, menos cruces

> Tema: integridad
> En corto: En vez de parchear uno a uno los fallos de conexión, cuentas y pagos que siguen apareciendo, quitar las situaciones que los provocan: decidir qué no se permite, que cada dato tenga un solo dueño, que restaurar una copia no traiga estado de conexión, que la cola solo reintente lo que el entrenador envió, y que cada regla de la app tenga su test.
> Fase I04-01 · pendiente · Decisiones del usuario: qué se permite y qué no · §3
> Fase I04-02 · pendiente · Restaurar una copia trae contenido, nunca estado de conexión · §4
> Fase I04-03 · pendiente · La cola solo reintenta lo que se envió y falló · §5
> Fase I04-04 · pendiente · Escribir en una ficha solo si sigue existiendo · §6
> Fase I04-05 · pendiente · Pago pendiente: no se compra otra vez y no cruza cuentas · §7
> Fase I04-06 · pendiente · Un solo traductor de errores para envíos y cuentas · §8
> Fase I04-07 · pendiente · Cada regla de I02 con su test de escenario · §9
> Fase I04-08 · pendiente · Estado de la ficha como un solo valor · §10
>
> Estado: **spec escrita, sin empezar** (28-oct-2026). Sale de una pregunta del
> usuario tras la revisión I03: cada pasada de búsqueda encuentra fallos nuevos,
> algunos graves, y buscar más no converge. La respuesta acordada es simplificar
> y limitar en vez de buscar. Sustituye al «arreglar E72-E84 uno a uno»: siete de
> los trece desaparecen por diseño (§2) y el resto se arregla dentro de estas
> fases. **I04-01 va primero y es del usuario**: el resto depende de lo que
> decida. El informe y los tests de I03 están en las ramas
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

Cada decisión quita una familia de cruces. Son decisiones de producto, no
técnicas: las toma el usuario. Para cada una, la recomendación va primero.

**D1 · Qué trae restaurar una copia.**
- *Recomendada:* trae **contenido** (programas, plantillas, historial propio y
  de los clientes, fichas con nombre, notas, etiquetas y cobros) y **nunca
  estado de conexión ni de envío** (marcas de «sin enviar», cola, prescripciones
  sin enviar, PRO). Los clientes con app se reconcilian con el servidor (§4).
  Gana: E73, E78, E79 desaparecen. Cuesta: si algo estaba de verdad sin enviar
  cuando se hizo la copia, hay que volver a pulsar «Enviar».
- *Alternativa:* solo dejar restaurar en una app sin clientes con app (recién
  instalada). Más simple aún, pero quien restaura para deshacer un error con
  clientes conectados se queda sin salida.

**D2 · Qué sale solo sin pulsar nada.**
- *Recomendada:* **solo lo que el entrenador envió y falló por red.** Los
  «cambios sin enviar» se quedan como aviso hasta que pulse «Enviar». Gana: E80,
  E72, E84 y la mitad de E73. Cuesta: nada respecto a lo prometido en U15-01.
- *Alternativa:* todo cambio sale solo. Entonces sobran el botón «↑ Enviar» y el
  aviso de «cambios sin enviar», y un programa a medias puede llegar al cliente.

**D3 · Pago pendiente.**
- *Recomendada:* con un pago pendiente, el paywall **no enseña los planes**:
  enseña «Tu pago está pendiente de confirmar; no hace falta volver a pagar» y
  «Restaurar compras». El pendiente se guarda en disco y se borra al llegar el
  PRO, al cambiar o salir de cuenta, o al pulsar «Restaurar» sin encontrar nada
  (el pago se canceló). Gana: E75, E82, cobro doble imposible desde la app.
  Cuesta: si la tienda cancela el pago sin avisar, el usuario tiene que pulsar
  «Restaurar» para volver a ver los planes.

**D4 · Varias cuentas en el mismo móvil.**
- *Recomendada:* se sigue pudiendo cambiar de cuenta, pero **cambiar de cuenta
  vacía lo que es de la cuenta anterior**: la cola de envíos y el pago
  pendiente. Gana: nada de una cuenta se ejecuta con otra puesta.
- *Alternativa:* una cuenta por instalación (cambiar = borrar datos del móvil).
  Mucho más simple, pero rompe M03.

**D5 · Acciones de cuenta sin red.**
- *Recomendada:* entrar, pasar a Google/Apple, cambiar de cuenta, recuperar y
  eliminar la cuenta **se desactivan sin red**, con «Necesitas conexión para
  esto». Gana: no hay estados a medias de cuenta ni errores técnicos (media
  E77). Cuesta: nada real; sin red no podían salir bien.

**D6 · Varios móviles del mismo entrenador.**
- *Recomendada:* lo que ya dice R-B10: un móvil por entrenador para trabajar;
  los otros no sincronizan programas. Con D2, un móvil viejo ya no envía nada
  solo al abrirse. Solo hay que dejarlo escrito para el usuario final.

**D7 · Cuándo rehacer el estado de la ficha (I04-08).**
- *Recomendada:* **después de la primera release**, cuando I04-02 a I04-07 estén
  probadas. Es la fase que más reduce estados a largo plazo, pero también la más
  grande; hacerla antes retrasa la release y mezcla dos cambios grandes.

**D8 · Fallos que solo encuentra el uso real.**
- *Recomendada:* beta cerrada en Google Play antes de abrir, con un registro de
  errores (p. ej. Sentry, dependencia nueva, gratis para este volumen) y un
  botón «Volver a sincronizar con el servidor» en Mi cuenta que rehaga el enlace
  de los clientes sin perder nada. Para los casos límite, poder recuperarse vale
  más que prevenirlos todos.

Al cerrar I04-01 se apunta aquí lo decidido y las fases siguientes se ajustan.

## 4. I04-02 — Restaurar trae contenido, nunca estado de conexión

Según D1. En `importData` (`store/useStore.js`, rama `sections.clients`) y en
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

Según D2. Hoy `sendPendingPrograms` recorre `programDirty`/`overridesDirty`, que
significan «difiere de lo enviado», no «se pulsó Enviar» (E80).

- **Una lista propia**: `outbox` en el store (guardada en disco), con una
  entrada por cliente y tipo (`program` · `overrides`). Solo la añade un envío
  que falla **por red** (`uploadProgramToClient`, `sendOverrides`); la quita el
  envío que acaba bien. `programDirty` vuelve a ser solo el aviso.
- **Un solo camino**: la cola, el envío a mano y la subida del invitado pasan
  por la misma función con el mismo cerrojo (E84).
- **Al reintentar se manda lo de ahora**, no lo de cuando falló: el programa
  actual de ese cliente. Si entretanto se borró el cliente o se congeló, la
  entrada se descarta.
- **Reintentos**: al volver la red (NetInfo), al volver a primer plano, al
  arrancar, y además un reintento con espera (30 s, 2 min, 10 min) mientras
  quede algo, para cuando NetInfo no ve el corte (E83). Sin red según NetInfo no
  se intenta solo; a mano, sí.
- Cambiar o salir de cuenta vacía la `outbox` (D4).

Tests: E72, E80 (A3), E73 y E84 en verde, más «dos llamadas a la vez suben una
vez» (ya existe) y «sin pulsar Enviar, volver a primer plano no envía nada».

## 6. I04-04 — Escribir en una ficha solo si sigue existiendo

E74 y los tres sitios de A1: después de un `await`, el `set` hace
`[clientId]: { ...s.clients[clientId], … }` y, si la ficha se borró entretanto,
crea una ficha fantasma. Una sola función `patchClient(s, id, patch)` que
devuelve el estado sin cambios si la ficha no existe, y todos los `set` sobre
`clients[id]` que van detrás de un `await` pasan por ella. Un test por sitio, y
una regla de grep en el test de integridad: ningún `[clientId]: { ...s.clients[`
fuera de `patchClient`.

## 7. I04-05 — Pago pendiente: no se compra otra vez y no cruza cuentas

Según D3 y D4:

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

## 8. I04-06 — Un solo traductor de errores

`sendFailure` (`src/utils/networkError.js`) se amplía a todo error que llega a
pantalla: envíos, cuentas, conexión, Drive. Errores con código propio enseñan su
mensaje; los de red, «Sin conexión»; el resto, el texto de la pantalla, y
`err.message` al log. Todas las pantallas de E76 y E77 pasan por él. Regla de
grep en el test de integridad: ningún `err.message` / `err?.message` dentro de
`showToast(` o `showDialog(` en `src/`.

## 9. I04-07 — Cada regla de I02 con su test de escenario

El contrato ya existe: la tabla de reglas de
[I02](I02-conexion-pagos-pro.md) (R-A…R-F), más las reglas nuevas que salgan de
I04-01. Esta fase:

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

Según D7, después de la release. Las banderas `sync*` de cada ficha pasan a un
solo campo `link` con cinco valores — `none` (sin app) · `invited` · `linked` ·
`otherAccount` · `lost` — y una función pura `nextLink(link, evento)` con los
cambios permitidos, en un solo archivo y con un test por transición. Lo que hoy
deduce `clientLink()` de las banderas se lee de ahí. Migración de las fichas
guardadas al arrancar, con test sobre fichas de cada versión.

## Fases

| Fase | Qué | Depende de | Coste | Estado |
|---|---|---|---|---|
| I04-01 | Decisiones D1-D8 | — | 🟢 | pendiente |
| I04-02 | Restaurar sin estado de conexión (E73, E78, E79) | I04-01 | 🟡 | pendiente |
| I04-03 | Cola propia (E72, E80, E83, E84) | I04-01 | 🟡 | pendiente |
| I04-04 | `patchClient` (E74 + A1) | — | 🟢 | pendiente |
| I04-05 | Pago pendiente (E75, E81, E82) | I04-01 | 🟡 | pendiente |
| I04-06 | Traductor de errores (E76, E77) | — | 🟢 | pendiente |
| I04-07 | Reglas de I02 con test | I04-02…06 | 🟡 | pendiente |
| I04-08 | Estado de la ficha en un valor | I04-07, release | 🔴 | pendiente |

Orden: I04-01 primero. Después, de una en una por tocar el núcleo: I04-04 (la
más pequeña), I04-03, I04-02, I04-05; I04-06 puede ir en paralelo porque es de
pantallas. Al cerrar cada una, sus fallos E-xx se dan de alta como resueltos en
[auditoria-tecnica.md](auditoria-tecnica.md).
