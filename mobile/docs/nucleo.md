# El núcleo: mapa y reglas

> **Qué es esto.** El contrato de cómo funcionan la conexión entrenador ↔
> cliente, las cuentas, las copias y los pagos: qué datos hay, quién manda en
> cada uno, qué operaciones los mueven, dónde se cruzan y qué reglas lo hacen
> simple. **Manda sobre el código**: si el código hace otra cosa, el fallo es
> del código. Las reglas R-xx de [I02](specs/I02-conexion-pagos-pro.md) siguen
> valiendo; aquí se añaden las **N-xx**, que son las que simplifican.
>
> **Estado:** borrador para decidir (28-oct-2026). Sale de que cada pasada de
> búsqueda de fallos (I02, I03 y la adversaria) encontraba más, casi siempre en
> cruces entre funciones. Las reglas marcadas **DECIDIR** esperan al usuario;
> las **firmes** son consecuencia directa del propósito de la app o de reglas ya
> firmadas. Al decidir, se cambia la marca por la fecha y se ajusta
> [I04](specs/I04-simplificar-nucleo.md), que es donde se implementan.

---

## 1. Para qué es la app

Lo que no se negocia. Todo lo demás está al servicio de esto y, si complica, se
recorta.

1. El **entrenador** crea programas, gestiona a sus clientes y ve cómo entrenan.
2. El **cliente** entrena con el programa de su entrenador (o con uno propio si
   no tiene entrenador).
3. **Entrenar funciona siempre**, con o sin red, y **nada de lo entrenado se
   pierde**.
4. La conexión sirve para **dos cosas y solo dos**: el programa (y las
   prescripciones) va del entrenador al cliente; el historial va del cliente al
   entrenador.
5. **PRO amplía límites**; no cambia cómo funciona nada.

## 2. Quién hay

- **Entrenador.** Con cuenta (código, Google o Apple) o sin cuenta (todo en su
  móvil, sin clientes con app).
- **Cliente sin app.** Solo existe como ficha en el móvil del entrenador, que le
  apunta los entrenos.
- **Cliente con app.** Tiene un **hueco** en el servidor (creado por el
  entrenador) y, cuando entra con su código, se sienta en él: es su **asiento**.
- **Un mismo móvil puede tener los dos papeles**: entrenador de unos y cliente
  de otro, cada papel con su sesión (R-B7). Se mantiene, aislado: ningún dato
  pasa de un papel al otro.

## 3. Los datos y su dueño

El **dueño** es quien manda cuando dos copias no coinciden. Una copia nunca
pisa a su dueño (regla N-01).

| Dato | Dueño | Copias | Quién lo cambia |
|---|---|---|---|
| Programa de un cliente | móvil del entrenador | hueco, móvil del cliente | el entrenador; llega al cliente cuando lo **envía** |
| Prescripciones de la próxima sesión | móvil del entrenador | hueco, móvil del cliente | el entrenador, al enviarlas |
| Progreso en el programa (semana, etapa, pesos) | móvil del cliente | hueco (`progress`), espejo en la ficha del entrenador | el cliente entrenando; el entrenador solo al activar o reiniciar una etapa |
| Historial del cliente con app | móvil del cliente | hueco; `clientLogs` del entrenador (solo añade) | el cliente |
| Historial del cliente sin app | móvil del entrenador | hueco, si está invitado (R-C6) | el entrenador |
| Estado de conexión (invitado, conectado, se fue, borrado) y código | **servidor** | ficha del entrenador; `clientSync` del cliente | solo las funciones del servidor |
| Ficha del cliente (nombre, notas, cobros, peso, etiquetas) | móvil del entrenador | copia | el entrenador |
| Cuenta del entrenador | servidor (auth) | `trainerSync` | entrar, salir, borrar |
| PRO | **tienda** (RevenueCat) | `profile.isPro` con plazo sin red (R-E5) | comprar, restaurar, caducar |
| Pago pendiente | tienda | hoy solo en memoria | — |
| Elección de clientes activos | móvil del entrenador | — | el entrenador, una vez (R-E4) |
| Programas, plantillas, ejercicios, historial propio | móvil | copia | el usuario |
| Envíos por hacer | móvil | — | hoy no existe como dato: se deduce de «cambios sin enviar» |
| Copia (Drive o archivo) | **nadie: es una foto** | — | — |

**Dónde se rompe hoy:**
- **Restaurar** trata la foto como si fuera dueña: pisa estado que manda el
  servidor (E73, E78, E79).
- **El pago pendiente** vive en memoria, sin dueño (E75, E82).
- **Los envíos por hacer** no existen como dato y se deducen de otra cosa (E72,
  E80, E84).

## 4. Los estados

### 4.1 La ficha de un cliente, en el móvil del entrenador

```
sin app ──invitar──▶ invitado ──canjea el código──▶ conectado
   ▲                    │                              │
   └─cancelar invitación┘          se desconecta ──▶ se fue ──vuelve con el código──▶ conectado
cualquiera ──borrar──▶ (no existe)
cualquiera con hueco ──el hueco no es de la cuenta puesta──▶ de otra cuenta
```

Seis estados con sentido. Hoy se guardan en siete banderas sueltas
(`syncSlotId`, `syncLinked`, `syncOrphan`, `syncPending`, `syncLeftAt`,
`syncErrorAt`, `syncCode`), que dan más de cien combinaciones, y cada función
tiene que acertar con todas. A esto se suma el **envío**: al día, cambios sin
enviar o en cola.

### 4.2 El lado del cliente

```
sin entrenador ──código──▶ conectado ──el servidor dice que no──▶ perdido (le quitaron el código · el entrenador lo borró · perdió su sesión)
      ▲                        │                                     │
      └───── desconectarse ────┘◀──────────── aceptar ───────────────┘
```

Más dos cosas en espera: la **subida pendiente** del historial y el **programa
nuevo** que aún no ha aplicado.

### 4.3 La cuenta del entrenador

Sin cuenta → código → Google o Apple. Solo hacia arriba (R-D1).

### 4.4 PRO

Gratis → pago pendiente → PRO → caducado (con clientes congelados si sobran) →
PRO. El pago pendiente es hoy el único sin guardar.

## 5. Las operaciones

**Red**: «sí» = no tiene sentido sin servidor; «cola» = se hace en el móvil y
el servidor se entera después.

| Grupo | Operación | Red | Qué toca |
|---|---|---|---|
| Conexión | Invitar (crear hueco y código) | sí | ficha, hueco |
| | Reemitir el código | sí | hueco; el de dentro sale (R-B5) |
| | Cancelar la invitación | sí | hueco → ficha sin app |
| | Canjear el código (cliente) | sí | asiento, `clientSync`, programa |
| | Desconectarse (cliente) | cola (R-B9) | asiento, `clientSync` |
| | Borrar un cliente | cola (`deletedSlotIds`) | ficha, programas, historial, hueco |
| | Pasar a la app (cliente sin app → invitado) | sí | ficha, hueco, historial apuntado |
| | Enviar el programa o las prescripciones | cola | hueco |
| | Subir el historial (cliente) | cola, sola | hueco |
| | Bajar el historial (entrenador) | sí | `clientLogs` |
| | Refrescar los huecos (al abrir Clientes) | sí | fichas: estado, código, progreso, recupera y borra |
| Cuentas | Crear cuenta o entrar (código, Google, Apple) | sí | `trainerSync`, RevenueCat, fichas (refresco) |
| | Recuperar la cuenta en un móvil nuevo | sí | igual |
| | Pasar de código a Google o Apple | sí | traspaso de huecos (R-D1) |
| | Salir | no | `trainerSync`; fichas → de otra cuenta |
| | Borrar la cuenta | sí | servidor, RevenueCat, fichas |
| Copias | Copia en Drive (sola o a mano) | sí | Drive |
| | Restaurar una copia de Drive | sí (para bajarla) | **todo el móvil** |
| | Exportar o importar un archivo completo | no | todo el móvil |
| | Importar un programa | no | programas |
| Pagos | Comprar | sí | tienda → PRO |
| | Restaurar compras | sí | tienda → PRO |
| | Caducar el PRO | — | límites, congelados |
| | Elegir clientes activos | no | `freeClientIds` |

## 6. Los cruces

Donde dos operaciones o estados se encuentran. Es donde han salido casi todos
los fallos. Columna **Regla**: la que lo resuelve (§7).

| # | Cruce | Qué pasa hoy | Fallos | Regla |
|---|---|---|---|---|
| 1 | Restaurar × clientes con app | mezcla fichas por id, no por hueco; los huecos borrados se vuelven a borrar | E78, E79 | N-04, N-05, N-08 |
| 2 | Restaurar × envíos | la copia trae «cambios sin enviar» y la cola los manda | E73 | N-04, N-06 |
| 3 | Restaurar × cliente conectado (su móvil) | vuelve un programa viejo del entrenador | — | N-05 |
| 4 | Sin red × enviar | la cola reintenta, pero no todo entra en ella | E72, E83 | N-06 |
| 5 | Cola × «cambios sin enviar» | la cola manda lo que no se envió | E80 | N-06 |
| 6 | Envío en vuelo × borrar el cliente | queda una ficha fantasma | E74 | N-08 |
| 7 | Cola × programa del invitado | dos caminos de envío a la vez | E84 | N-06 |
| 8 | Cambiar de cuenta × cola y pago pendiente | lo de una cuenta sigue con otra puesta | E82 | N-09, N-11 |
| 9 | Cambiar de cuenta × clientes con app | pasan a «de otra cuenta» y vuelven al volver | — | N-09 |
| 10 | Pago pendiente × comprar | se puede pagar dos veces | E75 | N-11 |
| 11 | Compra × otra cuenta de la tienda | dos mensajes contrarios | E81 | N-11 |
| 12 | Caducar el PRO × cola | la cola puede enviar a un cliente justo antes de congelarse | sospecha | N-12 |
| 13 | Dos móviles del entrenador | solo se propagan los borrados (R-B10); el viejo enviaba lo suyo | E73 | N-06, N-10 |
| 14 | Dos móviles del cliente, código compartido | decidido: el código manda (R-B2, R-B3) | — | — |
| 15 | Programa nuevo × el cliente lo descarta | el entrenador cree que llegó y el cliente sigue con el viejo | — | N-07 |
| 16 | Sin red × acciones de cuenta | estados a medias y errores técnicos | E77 | N-03, N-14 |
| 17 | Borrar sin querer × deshacer | la única salida es restaurar, y no funciona | E79 | N-13 |
| 18 | Cualquier error × la pantalla | texto técnico en pantalla | E76, E77 | N-14 |

## 7. Las reglas

Cada regla dice qué quita. **Firme** = sale del propósito (§1) o de reglas ya
firmadas. **DECIDIR** = elección de producto, con la recomendada primero.

**N-01 · Cada dato tiene un dueño** (§3). Una copia nunca pisa a su dueño; si
discrepan, se vuelve a pedir al dueño. *Quita:* la familia de restaurar y la de
los envíos. **Firme.**

**N-02 · Dos direcciones y nada más.** El programa y las prescripciones van del
entrenador al cliente **solo cuando el entrenador los envía**. El historial va
del cliente al entrenador **siempre y solo**, sin botón. Nada más viaja.
**Firme.**

**N-03 · Lo que cambia quién es quién necesita red.** Crear cuenta, entrar,
recuperar, pasar a Google o Apple, borrar la cuenta, invitar, reemitir, cancelar
la invitación, canjear un código y pasar a la app: **sin red, el botón está
desactivado** y dice «Necesitas conexión para esto». Lo que es del móvil
funciona sin red y el servidor se entera después: entrenar, editar, borrar un
cliente, desconectarse (R-B9) y enviar (queda en cola). *Quita:* los estados a
medias de cuenta y conexión, y media E77. **Decidido el 28-oct-2026.**

**N-04 · Restaurar: lo que viene en la copia es lo que hay.** *(Decidido en lo
general el 28-oct-2026; el detalle de clientes depende de N-17.)*
- **Por partes.** Al restaurar se eligen las partes: mis programas y
  plantillas · mi historial · ejercicios y ajustes · clientes.
- **Cada parte reemplaza** lo que hay de esa parte. No hay mezclas. Lo que se
  hizo después se pierde, y se avisa antes.
- **Dos excepciones que se suman**, porque cada elemento tiene su id y sumar
  no puede pisar nada:
  - **El historial.** Nunca quita, no duplica y respeta lo borrado después
    (R-C3).
  - **Las plantillas.** Se traen las de la copia sin borrar las propias; si una
    plantilla con el mismo id está en los dos sitios, gana la del móvil. Pasarse
    del límite gratis al traerlas se acepta, como al caducar el PRO (R-E1).

  Si un día una de las dos da problemas, pasa a reemplazar como el resto.
- **Nunca viaja en una copia:** estado de conexión, envíos en cola, avisos de
  «sin enviar», PRO, pago pendiente ni elección de clientes activos.
- **Clientes, sin cuenta:** la copia es la única forma de salvarlos, así que la
  parte de clientes **reemplaza** a los del móvil, con sus programas e
  historial.
- **Clientes, con cuenta:** **la cuenta manda** (N-17). La copia **solo añade**
  los clientes que la cuenta no ha conocido nunca, que al entrar se suben a la
  cuenta. Los que la cuenta conoce (vivos o borrados) no se tocan.

Después se aplica N-05 en el acto, así que con cuenta necesita red. Importar
**un programa** suelto sigue siendo contenido y se puede siempre. *Quita:* E73,
E78 y E79 y los cruces futuros de restaurar, porque no hay nada con que
mezclarse. **Firme.**

**N-05 · Tras restaurar, entrar o reinstalar, se vuelve a preguntar a los
dueños.** Los enlaces de los clientes, al servidor (refresco); el PRO, a la
tienda; el programa del cliente conectado, a su hueco. Las fichas cuyo hueco
borró esta cuenta quedan **sin app**, con su historial: no se borran. *Quita:*
E79 y el cruce 3. **Firme.**

**N-06 · Solo sale solo lo que se mandó.** Del entrenador al cliente sale
únicamente lo que el entrenador envió: «↑ Enviar», «Enviar todo», abrir una
etapa, y el programa de entrada de un invitado. Si falla por red, entra en la
**cola** (un dato propio, guardado) y se reintenta solo, también con espera por
si la red no avisa. Todo envío pasa por **un solo camino**. Son dos cosas
distintas y se ven distintas:
- **Pendiente de decidir** («Cambios sin enviar»): esto se modificó o se creó y
  espera a que el entrenador decida enviarlo. Es un aviso; no sale solo nunca.
- **En cola** («Se enviará al volver la conexión»): el entrenador ya decidió
  enviarlo y no pudo salir. Sale solo.

*Quita:* E72, E80, E83, E84 y el móvil viejo que envía lo suyo. **Decidido el
28-oct-2026.**

**N-07 · El programa del cliente conectado es el que manda su entrenador.** El
cliente recibe el aviso y los cambios, sin opción de descartarlos. Si llega a
mitad de un entreno, se aplica al terminarlo, nunca en medio. Se respeta su
progreso (R-C5). *Quita:* el cruce 15 y el estado «programa por aplicar».
**Decidido el 28-oct-2026.**

**N-08 · Un hueco, una persona, una ficha.** Nunca hay dos fichas con el mismo
hueco, venga de donde venga. Lo que vuelve del servidor solo **actualiza**
fichas que existen: nunca crea ni resucita una. La excepción explícita es el
refresco que recupera clientes del servidor. Una sola función lo garantiza.
*Quita:* E74 y E78. **Firme.**

**N-09 · Una cuenta de entrenador a la vez.** Cambiar de cuenta es salir y
entrar. Al salir se vacía lo que es de esa cuenta: la cola, el pago pendiente y
la sesión. Las fichas con app quedan **de otra cuenta**: se ven y no se envían, y
vuelven si se vuelve a esa cuenta. No se borra nada del móvil. *Quita:* E82 y
lo de una cuenta ejecutado con otra. **Firme** (aceptado el 28-oct-2026; con
N-17, también los clientes sin app de esa cuenta pasan a «de otra cuenta»).

**N-10 · Un móvil de trabajo por entrenador.** Los demás móviles de la misma
cuenta solo reciben borrados (R-B10) y, con N-06, no envían nada solo. Lo que el
entrenador haga en dos móviles a la vez no se junta, y se dice en la ayuda.
Varios móviles sirven para **cambiar de móvil y recuperar lo que tenías**, no
para usarlos a la vez. **Firme** (confirmado el 28-oct-2026).

**N-11 · Un pago a la vez.** Con un pago pendiente, el paywall no ofrece comprar:
dice «Tu pago está pendiente de confirmar; no hace falta volver a pagar» y
ofrece «Restaurar compras». El pendiente es de una cuenta, se guarda, y se borra
al llegar el PRO, al salir de la cuenta o al restaurar sin encontrar nada.
«Comprado en otra cuenta de la tienda» se dice así, con «Entendido». *Quita:*
E75, E81 y E82; el cobro doble desde la app. **Firme** (confirmado el
28-oct-2026: en pagos, todo lo que quite variantes).

**N-17 · Con cuenta, los clientes son de la cuenta.** *(Propuesta del usuario,
28-oct-2026; el cómo está por decidir.)* Si el entrenador tiene cuenta, **todos
sus clientes**, con app o sin ella, viven en la cuenta: recuperar la cuenta en
un móvil nuevo los trae todos, con su ficha, su programa y su historial. La
cuenta es la copia definitiva de los clientes; la copia de Drive solo los salva
cuando no hay cuenta. Para que eso sea verdad:
- **Cada cliente tiene un id para siempre.** Hoy cada ficha tiene su id desde
  que se crea (`client_…`, `useStore.js` `createClient`), pero al recuperar
  clientes del servidor se les da **uno nuevo** (`refreshTrainerSlots`), aunque
  el hueco guarda el original (`local_id`, E35). Por eso una copia vieja no
  reconoce a su propio cliente (E78). Con N-17, el id de la ficha es el mismo en
  el móvil, en el hueco y en las copias, y recuperar usa ese. El nombre nunca
  identifica a nadie.
- **Cada cliente tiene su hueco desde que se crea.** «Sin app» pasa a ser un
  hueco sin código; invitar es darle un código; conectado, con alguien sentado.
  Ficha y hueco van siempre uno a uno, lo que simplifica §4.1.
- **Los clientes de antes de la cuenta** suben a la cuenta al crearla (o al
  entrar en ella desde un móvil con clientes sueltos), con su programa e
  historial. Es un paso visible: «Subiendo tus N clientes a tu cuenta».
- **Guardar no es enviar.** Para un cliente sin app, guardar su ficha, su
  programa y lo que el entrenador le apunta en la cuenta es copia de seguridad:
  sale solo, porque nadie lo recibe. Para uno con app, el programa sigue la
  regla N-06: solo llega al cliente lo que el entrenador envía.
- **Lo privado del entrenador no lo puede leer el cliente.** Notas, cobros,
  peso y etiquetas van en una tabla aparte, solo del entrenador: hoy el cliente
  puede leer su fila entera de `trainer_clients`.
- **El plan gratis cuenta «con app» por el código**, no por tener hueco: hoy
  `isConnected` mira `syncSlotId`, y con N-17 todos lo tendrían.
- **Antes de la primera release, junto con N-15** (decidido el 28-oct-2026: la
  release de Android espera al periodo de prueba externa). Es un cambio grande:
  se planifica en una spec propia antes de tocar código.
- **DECIDIR en esa spec:** si «guardar en la cuenta» es continuo (en cola, como
  un envío) o en los mismos momentos que la copia de Drive.

**N-12 · Congelado es solo lectura, también para la cola.** Antes de enviar nada
se mira si el cliente está congelado, y al arrancar se confirma el PRO antes de
vaciar la cola. *Quita:* el cruce 12. **Firme** (amplía R-E2).

**N-13 · Borrar se deshace en el momento, no restaurando.** Al borrar un cliente
sale «Deshacer» unos segundos (como en el editor, P16-07), y el servidor solo se
entera pasado ese rato. Restaurar no es la herramienta para deshacer. *Quita:*
el cruce 17, sin depender de copias. **Decidido el 28-oct-2026.**

**N-14 · Ningún texto técnico en pantalla.** Todo error pasa por un solo
traductor: los códigos propios enseñan su mensaje, la red dice «Sin conexión» y
el resto dice el texto de la pantalla. `err.message` va solo al registro.
**Firme.**

**N-15 · El estado de la ficha es un solo valor** (§4.1), con los cambios
permitidos escritos en un solo sitio. *Quita:* las cien combinaciones. Es la
que más simplifica a la larga y la más grande. **Antes de la primera release,
junto con N-17** (28-oct-2026): las dos reescriben los estados del cliente.

**N-16 · Lo que no se puede prevenir se puede contar.** *(Revisada el
28-oct-2026.)* Sin botón «Volver a sincronizar»: lo que haría ya ocurre solo al
abrir la app y al abrir Clientes, y el PRO ya tiene «Restaurar compras». En su
lugar, **«Enviar informe»**:
- La app guarda en el móvil los últimos errores (los de red, servidor, tienda y
  los fallos de pantalla), **también de sesiones anteriores**: sobreviven a
  cerrar la app. Tamaño fijo; los más viejos salen.
- «Enviar informe» (en Mi cuenta y en Ajustes) deja escribir una nota con lo
  que ha pasado, enseña qué se va a enviar, y lo sube a una tabla propia de
  Supabase con la versión de la app y el móvil. Sin cuenta, también.
- Nada personal en el informe: ni nombres de clientes ni contenido de
  programas; solo códigos de error, pantallas y momentos.
- Es nuestra base de datos de fallos. No ve los cierres de la parte nativa (eso
  sería Sentry); se añade si hace falta.

**Firme** en el qué; el detalle va en su spec.

## 8. Lo que la app no hace, a propósito

Cada «no» es un cruce que no hay que soportar:

- Sincronizar programas o clientes entre dos móviles del mismo entrenador
  (N-10).
- Mezclar una copia con lo que hay en el móvil (N-04).
- Deshacer restaurando (N-13).
- Tener dos cuentas de entrenador activas a la vez en un móvil (N-09).
- Que un cliente edite el programa de su entrenador o esté con dos entrenadores
  (R-B8, R-B1).
- Volver de Google o Apple a código (R-D1).
- Que un cambio del entrenador llegue al cliente sin que el entrenador lo
  envíe (N-02, N-06).

## 9. Cómo se usa este documento

1. **Manda sobre el código.** Toda tarea que toque conexión, cuentas, copias o
   pagos dice en su spec qué reglas toca (R-xx, N-xx), y se cierra con sus
   tests en verde.
2. **Cada regla tiene su test de escenario** en el banco de simulación (I04-07):
   el camino de un usuario, no una función.
3. **El núcleo se toca de uno en uno**: nunca dos cambios del núcleo en
   paralelo.
4. **Ante un fallo nuevo, primero: ¿qué regla rompe?** Si rompe una, se arregla
   el código. **Si no rompe ninguna, falta una regla**: se decide la regla, y el
   arreglo sale de ella. Así los fallos dejan de ser una lista infinita y se
   convierten en reglas que cierran familias enteras.
5. **Gravedad:** perder datos o cobrar mal, cero tolerancia antes de publicar;
   lo que confunde o es menor puede salir y arreglarse después.
