# Spec — Monetización: plan gratis, pago dual e invitación de clientes

> Tema: monetización
> En corto: Plan gratis: 3 clientes (como mucho 1 con app) y 1 plantilla de programa + 1 de sesión; Pro, anual o pago único, lo quita todo. Hoy el muro es todo o nada, así que no puede probar el producto con lo que hace a diario. Incluye el pago desde el móvil del cliente y la invitación.
> Inicio: 2026-10-06
> Fase M01-01 · hecho · Identidad en RevenueCat (`logIn`/`logOut`, restore behavior) · §3 · antes M01
> Fase M01-02 · hecho · Plan gratis 3 (1 con app) + 1 + 1: límites, congelado por cliente y hoja de elección · §4 · antes M02
> Fase M01-03 · pendiente · Paywall dual + i18n + enlaces legales · §5 · antes M03
> Fase M01-04 · pendiente · Invitar cliente nivel 1 + página estática · §6 · antes M04
> Fase M01-05 · pendiente · Montar App Store, Google Play y RevenueCat (guia-pagos.md) · §7
>
> Estado: **SIN IMPLEMENTAR**. §4 reescrita el 5-oct-2026 (antes era 2+2); queda
> §4.9 cerrada: el congelado no caduca, porque no cuesta dinero. Precios cerrados:
> anual + pago único, sin mensual.
>
> Origen: revisión del plan de marketing. El muro actual es **todo o nada** —
> sin Pro no hay ni un cliente ni una plantilla — y eso deja al entrenador sin
> forma de probar el producto con lo que hace todos los días.
>
> **Ventaja de partida:** la app no está publicada (Play, track interno; en App
> Store no existe todavía). **No hay ni un comprador real**, así que todas las
> decisiones irreversibles de este documento — el id del entitlement, el id de
> usuario de RevenueCat — se pueden tomar ahora sin migrar a nadie. Después de
> la primera venta, no.
>
> Depende de: [C01-client-connection.md](C01-client-connection.md) para la fase 3 (el
> código de cliente y sus garantías ya existen; esta spec no toca el SQL).

---

## 1. Qué cambia

| | Hoy | Con esta spec |
|---|---|---|
| Clientes | 0 sin Pro | **3 gratis, como mucho 1 con app**; ilimitados con Pro. Al caducar, el resto **congelados** en solo lectura, no borrados (§4.5) |
| Plantillas | 0 sin Pro | **1 de programa + 1 de sesión** gratis; ilimitadas con Pro. Al caducar se quedan, pero no se asignan (§4.8) |
| Precio | un pago único | **anual O pago único**, mismo entitlement. Sin mensual (decidido 5-oct-2026) |
| Compartir código | copiar al portapapeles | botón **Invitar** con enlace |
| Identidad en RevenueCat | anónima por instalación | el `userId` de Supabase |

Lo importante del cambio de muro es **dónde vive la puerta**: hoy está en la
pantalla (`if (!isPro) return <Upsell/>`), y pasa a estar en la acción
(`createClient`, crear plantilla). El diff de la fase 1 borra más líneas de las
que escribe.

---

## 2. Estado verificado del código (sep 2026)

Todo esto está comprobado contra el repositorio, no supuesto.

### Lo que ya existe y sirve

| Pieza | Dónde |
|---|---|
| `react-native-purchases@10.1.2` | `mobile/package.json` |
| `configure` + `checkProStatus` al arrancar | `App.js:162-183` |
| `checkProStatus` / `getOffering` / `purchasePackage` / `restorePurchases` | `store/useStore.js:3833-3901` |
| Paywall que itera sobre `offering.availablePackages` | `src/components/PaywallModal.jsx:139-177` |
| Botón "Restaurar compra anterior" | `PaywallModal.jsx:181` |
| Permiso `com.android.vending.BILLING` | `app.json` (android) |
| Deep links (`expo-linking`, scheme `forma`) | `App.js:115-119` |
| Código de cliente por slot | `createClientSlot` → `supabaseSync.js:53` |
| Tarjeta con el código + copiar + reemitir | `ClientsScreen.jsx:652-690` |

### Lo que falta o está mal

| Problema | Dónde | Fase |
|---|---|---|
| `configure` **sin `appUserID`** → anónimo por instalación | `App.js:178` | 0 |
| ~~`RC_IOS_API_KEY = 'YOUR_IOS_API_KEY'` — iOS no existe en RevenueCat~~ ✅ rellenada el 6-oct-2026 | `src/config/revenuecat.js` | 0 |
| Muro binario en Clientes | `ClientsScreen.jsx:2319-2350` | 1 |
| Muro binario en Plantillas | `ProgramScreen.jsx:394-414` | 1 |
| Cargar plantilla oculto sin Pro en el onboarding | `OnboardingScreen.jsx:902` | 1 |
| Tabs Pro atados a `isPro` | `RootNavigator.jsx:62` | 1 |
| `"· Pago único"` y el texto legal **hardcodeados** | `PaywallModal.jsx:151, 192` | 2 |
| El paywall entero **en español a pelo**, sin i18n | `PaywallModal.jsx` completo | 2 |
| Sin enlaces a EULA y privacidad en el paywall | `PaywallModal.jsx:191` | 2 |
| `isFileIntent` **rechaza** todo lo que no sea `.fitdata` | `App.js:91-95` | 3 |
| La política de privacidad no está publicada en ninguna URL | `docs/app-store-privacidad.md` | 2/3 |

### Lo que el servidor NO hace

`createClientSlot` es un `insert` directo sobre `trainer_clients`
(`supabaseSync.js:53`). **El servidor no cuenta slots y no sabe quién ha
pagado.** El límite de esta spec es del lado del cliente — ver §9.

---

## 3. Fase 0 — Identidad en RevenueCat

> **Esta fase va la primera y no se puede posponer.** Arreglar la identidad
> cuando ya hay compras significa reconciliar alias a mano en el dashboard.

### 3.1 El problema

`Purchases.configure({ apiKey })` se llama sin `appUserID`, así que cada
instalación es un usuario anónimo distinto. Consecuencias reales:

- El Pro **no cruza de Android a iPhone**. Nunca. Google Play no le habla a
  Apple, y sin un id común RevenueCat no tiene con qué unirlos.
- Al reinstalar, el usuario depende del botón *Restaurar*, que solo funciona con
  la **misma** cuenta de store.

Y al reinstalar no queda nada local: `trainerSync` (con `code` y `userId`) y la
sesión de Supabase viven las dos en AsyncStorage (`useStore.js:4016`,
`src/config/supabase.js:16`), que la desinstalación borra. El usuario llega con
las manos vacías y tiene que re-sincronizar con su código o su Google — que es
justo el gancho del que colgar el Pro.

### 3.2 Las dos capas, y por qué no sobra ninguna

**Capa 1 — el recibo de la store.** No necesita cuenta. Es el botón *Restaurar*.
**Capa 2 — el App User ID de RevenueCat** = `trainerSync.userId`.

| Escenario | Capa 1 | Capa 2 |
|---|---|---|
| Reinstala, mismo móvil | ✅ | ✅ automático |
| Móvil nuevo, misma cuenta de store | ✅ | ✅ |
| Móvil nuevo, **otra** cuenta de store | ❌ | ✅ |
| **Android → iPhone** | ❌ imposible | ✅ **único camino** |
| **Perdió el código y no tiene Google/Apple** | ✅ **único camino** | ❌ cuenta perdida (§4.3 de client-connection) |

Las dos últimas filas son la justificación entera: cada capa tapa exactamente el
agujero de la otra.

### 3.3 El cambio

Un efecto en `App.js`. `trainerSync.userId` ya es reactivo, así que cubre de
golpe **todos** los caminos que lo establecen — login social, alta por código,
recuperación, restauración de sesión, cambio de modo — sin tocar
`setTrainerSyncMode`, ni `TrainerSyncModal`, ni el store:

```js
const trainerUserId = useStore((s) => s.trainerSync.userId);

useEffect(() => {
  if (!trainerUserId) return;
  try {
    const Purchases = require('react-native-purchases').default;
    Purchases.logIn(trainerUserId).then(() => checkProStatus()).catch(() => {});
  } catch {} // Expo Go: sin módulo nativo
}, [trainerUserId]);
```

`trainerSync.userId` es el id correcto porque es **estable**: en modo código el
correo sintético es determinista, así que recuperar con el código devuelve el
mismo user id (client-connection §4.1); en Google/Apple es la cuenta.

Además:

- **`Purchases.logOut()`** en el borrado de cuenta y en `resetTrainerSync`
  (`useStore.js:3034`). Si no, el siguiente estado del dispositivo hereda el
  entitlement.
- **Nunca** `logIn` con `clientSync.supabaseUserId`: es anónimo por instalación,
  y el Pro es del entrenador, no del cliente.
- En el dashboard de RevenueCat, **Restore Behavior → transferir la compra al
  nuevo App User ID**. Sin eso, el cambio de modo de cuenta deja al usuario
  bloqueado. El precio es que dos personas compartiendo cuenta de Google Play se
  quitan el Pro la una a la otra: irrelevante en una app de entrenadores.

### 3.4 La trampa: anónimo → identificado sí, identificado A → identificado B no

RevenueCat funde **automáticamente** al anónimo con el identificado: compra sin
cuenta → crea cuenta → `logIn(uuid)` → la compra le sigue. Gratis.

Lo que **no** hace solo es mover una compra entre dos identificados. Es el
escenario §4.2 de client-connection: cuenta por código (uuid A) que se pasa a
Google (uuid B). `logIn(B)` le deja sin Pro porque la compra sigue en A. Hay que
llamar a **`restorePurchases()` justo después del `logIn`**, que es lo que
dispara la transferencia configurada en §3.3. Va donde ya está el baile de
sesiones de `TrainerSyncModal` — la misma forma que `transfer_my_slots_to`.

### 3.5 Decisión de producto: comprar sin cuenta

Quien compra en modo `offline` o sin modo solo tiene la capa 1: su Pro muere el
día que cambie de sistema operativo.

**Decisión (revisada el 6-oct-2026):** no se obliga a tener cuenta para pagar,
pero se **empuja a Google/Apple** justo después. Tras una compra con éxito sin
`trainerSync.userId`, el paywall cede el sitio a `TrainerSyncModal` en modo
`purpose="purchase"`:

> **Guarda tu compra** — para recuperarla en otro móvil, aunque cambies de
> Android a iPhone.
> [ Continuar con Apple ] [ Continuar con Google ]  ← preseleccionado
> Usar un código                                    ← secundario
> Ahora no                                          ← cerrar la hoja

- Sin la opción *Sin conexión*: no guarda nada, y para no guardar ya está
  *Ahora no*.
- Si elige código, el `code_reveal` lleva el aviso con *"y tu compra"*.
- Quien cierra con *Ahora no* se queda con la capa 1 (Restaurar), igual que hoy.

**Por qué no obligar.** Apple rechaza (5.1.1) exigir registro para comprar algo
que no depende de una cuenta, y parte de Pro no depende: más clientes manuales y
más plantillas funcionan sin servidor. La cuenta por código sí cumple —no pide
ningún dato personal—, así que queda como alternativa, no como camino por
defecto.

**Por qué el código no es un riesgo para el Pro.** Quien pierde su código pierde
su cuenta de entrenador (C01 §4.3), no la compra: crea otra cuenta y pulsa
Restaurar, y RevenueCat la mueve (Restore Behavior = transferir, §3.3). Solo
falla con otra cuenta de store **y** sin código; ahí el rescate es manual, con
el recibo de la store y *Grant entitlement* en RevenueCat (guía de pagos, R8).

### 3.6 Cómo quedó (6-oct-2026)

Cambios respecto a §3.3, al contrastarlo con el código:

- **`configure` espera a la hidratación y entra ya con `appUserID`** (`App.js`).
  Configurar anónimo y hacer `logIn` después dejaba una carrera: el
  `checkProStatus` del anónimo podía resolver tarde y pisar el Pro de la cuenta.
  El efecto de `logIn` (`syncPurchaserId`) queda para los cambios de cuenta.
- **`restorePurchases` tras el `logIn` solo en un cambio de cuenta real**
  (`switched`: había un id y es otro), y solo si el móvil tenía Pro y la cuenta
  nueva no lo trae. Al arrancar no: ahí «tenía Pro y ya no» es una suscripción
  caducada, y en iOS restaurar puede pedir la contraseña del Apple ID. Va en el
  store, no en `TrainerSyncModal`: cubre todos los caminos de cambio de cuenta.
- **`logOut` solo al borrar la cuenta** (`_purchasesLogOut` en `deleteAccount`).
  Pasar a *Sin conexión* **no** sale de RevenueCat: el Pro sigue en el móvil.
  `resetTrainerSync` no se llama desde ningún sitio, así que no se toca.
- §3.5: `TrainerSyncModal purpose="purchase"`, abierto desde `PaywallModal`
  cuando la compra acaba sin `trainerSync.userId`.
- Tests: `syncPurchaserId` en `store/useStore.test.js`.

**Pendiente fuera del código:** Restore Behavior en el dashboard (guía de pagos,
R7). Sin eso, la casilla M01-01.4 no puede pasar.

Se prueba con un build sin `EXPO_PUBLIC_FORCE_PRO` (no el perfil `preview`), en
Android, que es donde RevenueCat ya funciona.

**Probar M01-01**

- [ ] Entrenador con cuenta (código o Google) → RevenueCat › Customers: el
  cliente que aparece tiene como App User ID el `trainerSync.userId`, no un
  `$RCAnonymousID`.
- [ ] Comprar Pro sin cuenta (modo *Sin conexión*) → sale «Guarda tu compra»
  con Google preseleccionado y sin la opción *Sin conexión*; sin el campo del
  nombre. *Ahora no* cierra y el Pro se queda.
- [ ] Desde «Guarda tu compra», elegir código → el aviso del código menciona la
  compra. En RevenueCat, el anónimo de la compra queda fundido en la cuenta nueva.
- [ ] Con Pro y cuenta por código → pasar a Google → sigue con Pro (restaura y
  mueve la compra a la cuenta nueva).
- [ ] Desinstalar y reinstalar → entrar con la misma cuenta → Pro **sin** pulsar
  Restaurar.
- [ ] Borrar la cuenta → el Pro desaparece del móvil → *Restaurar compra
  anterior* lo devuelve.

---

## 4. Fase 1 — Plan gratis: 3 clientes (1 conectado) + 1 + 1 plantillas

> **Reescrita el 5-oct-2026.** Sustituye al 2+2 original. Cambian tres cosas: los
> clientes se cuentan en dos bolsas (conectados y manuales), las plantillas se
> cuentan por tipo (programa y sesión), y al caducar se congelan también los
> manuales.

### 4.1 El límite

```js
const FREE = { clients: 3, connected: 1, programTemplates: 1, sessionTemplates: 1 };
```

- **Conectado** = el cliente tiene `syncSlotId`: invitado (código emitido, sin
  canjear) o vinculado. Una invitación pendiente **ocupa** el hueco; cancelarla
  (`cancelClientInvitation`) lo libera.
- **Manual** = sin `syncSlotId`: le apuntas tú (C05).
- La regla son **dos comprobaciones, no dos bolsas fijas**: `total ≤ 3` y
  `conectados ≤ 1`. Tres manuales y ningún conectado vale.
- **Plantilla de programa** = `programs[*].kind === 'template'` (`templatesOf`).
- **Plantilla de sesión** = `sessionTemplates[*]` con `!programId && kind === 'template'`
  (la lista de la pestaña Plantillas, `ProgramScreen.jsx`). Las sesiones libres
  guardadas en Inicio (`onHome`) **no son plantillas** y no cuentan.

Se cuentan los **actuales**, no los creados alguna vez: borrar y recrear es un
agujero, pero contar el histórico obliga a un contador persistido que hay que
migrar, respaldar y explicar.

Una sola función pura, en `src/utils/freePlan.js`, con sus tests:

```js
// ¿Cabe este conjunto de clientes en el plan gratis?
export const fitsFree = (clients) =>
  clients.length <= FREE.clients
  && clients.filter((c) => c.syncSlotId).length <= FREE.connected;
```

Crear un cliente es `fitsFree([...todos, nuevo])`; conectar uno es
`fitsFree(todos con ese marcado como conectado)`; la hoja de elección de §4.6
valida la selección con **la misma función**. Un único sitio donde está escrita
la regla.

### 4.2 Dónde va la puerta

Todas las acciones pasan por el store, así que el guard va **dentro de la acción**
(no en las pantallas: el bucle de «enviar todo» y los atajos se lo saltarían).
Si se pasa del límite, la acción no hace nada, devuelve `null` y deja
`ui.paywallReason` puesto; un único `PaywallModal` montado en `App.js` lo lee.
Hoy el modal vive dentro de `AppHeader` con estado local.

| Acción del store | Llamada desde | Cuenta contra |
|---|---|---|
| `createClient` (`useStore.js:652`) | Clientes, onboarding | `clients`; con `withApp`, también `connected` |
| `connectClientToCloud` (`:3562`), y por tanto `moveClientToApp` (`:3587`) | ficha del cliente | `connected` |
| Invitar (M01-04) | Clientes | `connected`, **antes** de generar el slot |
| `createEmptyProgram(..., 'template')` (`:1474`) | `ProgramScreen` | `programTemplates` |
| `cloneProgramFromTemplate(..., { kind: 'template' })` (`:1945`) | duplicar (`ProgramScreen.jsx:454`), guardar como plantilla (`AppHeader.jsx:241`, `ClientsScreen.jsx:2221`, `MyProgramScreen.jsx:377`) | `programTemplates` |
| `createFreeTemplate(..., { asTemplate: true })` (`:1273`) | `ProgramScreen` | `sessionTemplates` |
| `copyFreeTemplate(..., { asTemplate: true })` (`:1366`) | duplicar (`ProgramScreen.jsx:650`) | `sessionTemplates` |

`ui.paywallReason` es uno de `'clients' | 'connected' | 'programTemplates' |
'sessionTemplates' | 'frozen'`, y elige el titular del paywall
(*«Conecta a más de un cliente con Pro»*…). El resto del paywall es el mismo.

**No se limita** importar un `.fitdata` con plantillas (`mergeFileSessions`): quien
importa ya tiene los datos en un archivo. Se apunta y se mira si aparece.

### 4.3 Qué se borra

Los muros de todo o nada, con su `emptyState`, su «Ver planes PRO» y su «Ocultar
tab»:

- `ClientsScreen.jsx:2291` — el bloque `if (!isPro)` entero. Revisar con él el
  efecto de `:2045`, que solo corre «como usuario PRO».
- `ProgramScreen.jsx:479` — ídem, con las claves `templates.proTitle`, `proBody`,
  `proCta` en `es.json` y `en.json`.
- `OnboardingScreen.jsx:906` — `isPro && templateList.length > 0` pasa a
  `templateList.length > 0`.
- `RootNavigator.jsx:69` — `showProTabs = isPro || !proTabsHidden` pasa a
  `!proTabsHidden`.
- `MyProgramScreen.jsx:175` — `hasTemplates` deja de mirar `isPro`.
- `AppHeader.jsx:240` — `onSaveTemplate={isPro ? … : undefined}` pasa a ser
  siempre la función; el límite lo pone el store.
- `AppHeader.jsx:497` — el `!isPro &&` que envuelve la fila de ocultar tabs.

`proTabsHidden` **sobrevive** como lo que siempre quiso ser: una preferencia
(*«no soy entrenador, quítame esos tabs»*).

**Las líneas son de oct-2026: comprobarlas antes de tocar nada.**

### 4.4 Qué se añade

- **Contador visible** sin Pro: en Clientes, `2/3 clientes · 1/1 con app`; en
  Plantillas, `1/1` en cada sección. Sin contador, el usuario descubre el límite
  chocando contra él.
- **Estado congelado** en la tarjeta y la ficha del cliente (§4.5), con el
  contador de entrenos sin descargar en los conectados.
- **Hoja de elección** (§4.6).
- `profile.freeClientIds: []` en el estado persistido. No necesita migración: el
  valor por defecto es válido y solo se consulta cuando hay más clientes de los
  que caben.

### 4.5 Al caducar: clientes

**No se borra ni se oculta nada.** Borrar datos de gente que pagó es la vía
rápida a las reseñas de una estrella, y ocultarlos es lo mismo con otro nombre.

Un cliente está **activo** o **congelado**. Si todos caben en el plan gratis
(`fitsFree`), todos están activos. Si no, solo los que el entrenador elige en
§4.6.

**Congelado = solo lectura, y sin sincronización.** Es la misma regla para los
dos tipos; al conectado se le suma lo de la red.

| | Manual | Conectado | Dónde va el guard |
|---|---|---|---|
| Ver ficha, historial y progreso | ✅ | ✅ (hasta la fecha del corte) | — |
| Ver su programa | ✅ solo lectura | ✅ solo lectura | — |
| Facturación, notas, peso, datos | ✅ | ✅ | registros locales del entrenador, no se tocan |
| Eliminar el cliente | ✅ | ✅ | — |
| Apuntarle una sesión (EMPEZAR) | ❌ | ❌ | `startSession` con `forClient` (`useStore.js:2034`) |
| Editar su programa / crearle uno / asignarle | ❌ | ❌ | entrada al editor, `createProgramForClient` (`:915`), `setClientActiveProgram` (`:752`), `importForClient` (`:856`) |
| Asignarle sesiones libres | ❌ | ❌ | `copyFreeTemplate` con `owner` = cliente (`:1366`) |
| **Enviarle** programa o ajustes | — | ❌ | `uploadProgramToClient` (`:3661`), `sendOverrides` (`:3740`) |
| **Recibir** su historial | — | ❌ | `downloadClientHistory` (`:3763`) |
| Reemitir código | — | ❌ | `reissueClientCode` (`:3956`) |
| «Enviar todo» masivo | — | salta los congelados | bucle de `ClientsScreen` (buscar `uploadProgramToClient` dentro de un bucle) |
| Contador de entrenos sin descargar | — | ✅ **sigue subiendo** | `refreshTrainerSlots` **no se toca** |

El guard es un selector, `isClientFrozen(clientId)`, al principio de cada
función de la tabla. La pantalla lo usa además para pintar el candado y
deshabilitar botones, pero la protección real es la del store.

**El lado del cliente conectado no cambia.** Sigue entrenando y **sigue subiendo**
su historial a su hueco: lo que se corta es el tramo hueco ↔ entrenador, no el
móvil del cliente. No se le avisa: *«tu entrenador ha dejado de pagar»* no
beneficia a nadie, y conserva el último programa recibido porque
`checkAndPullProgramUpdates` no encuentra nada nuevo. El día que el entrenador
vuelva a pagar, una sola descarga trae todo (§4.7).

### 4.6 Con quién sigues: la hoja de elección

Campo `profile.freeClientIds` y el selector:

```js
isClientFrozen(id) =
  !isPro
  && !fitsFree(todosLosClientes)
  && !freeClientIds.includes(id)
```

La hoja aparece cuando `!isPro`, los clientes no caben, y `freeClientIds` no es
una selección válida — ids que existen y que, juntos, cumplen `fitsFree`. Eso
ocurre **solo tras una caducidad**: el usuario gratis de toda la vida nunca la ve,
porque §4.2 no le deja pasarse. Mientras no elija, todo está congelado: seguro
por defecto en vez de silenciosamente equivocado.

La hoja deja marcar hasta 3 y, como mucho, 1 con app; el botón de confirmar se
habilita cuando `fitsFree(seleccionados)`. Se puede volver a abrir desde
Clientes para cambiar la elección (sin coste: no hay nada que mover).

**Lo elige el entrenador, no la antigüedad.** Los 3 clientes más antiguos de un
entrenador con 10 suelen ser los que ya no entrena.

### 4.7 Por qué esto sale casi gratis

1. **Todas las acciones ya son por cliente** (reciben `clientId`). Congelar es un
   `if` al principio de cada una.
2. **El backlog no hay que construirlo.** `uploadHistory` (`supabaseSync.js`)
   escribe el **log entero** en cada subida, no incrementos. El conectado
   congelado sigue sobrescribiendo su historial completo en el hueco, así que al
   volver a pagar **una descarga trae todo lo acumulado**.
3. **El contador de entrenos pendientes ya está calculado.** `refreshTrainerSlots`
   lee solo `sessions_count`, y `ClientsScreen` ya computa
   `remoteSessionsCount - lastSeenSessionsCount`. No se bloquea (es metadato, no
   historial), así que el congelado enseña *«7 entrenos sin descargar»* y el
   número sube solo. Es el mejor gancho de reconversión del producto: enseña el
   valor exacto de volver a pagar sin regalarlo.

### 4.8 Al caducar: plantillas

> **Revisado el 6-oct-2026 (QA).** La primera versión bloqueaba asignar
> cualquier plantilla de un tipo si había más de las gratis. Descartado: la
> plantilla la tienes, y asignarla a los clientes que el plan gratis te deja
> llevar no es un extra. El límite de clientes ya pone el techo.

**Se quedan, se ven, se editan y se asignan.** Lo único que choca con el plan es
**crear o duplicar** otra mientras se tengan las que da (§4.2). Asignar tiene
una sola restricción, que es la del cliente: a uno **fuera de plan** no se le
asigna nada (§4.5). En las hojas de asignar sale en gris, con «Fuera de plan»,
y no se puede marcar.

### 4.9 Límite de tiempo del congelado

**Qué pidió el usuario (5-oct-2026):** el conectado congelado sigue subiendo
sus entrenos —para que el entrenador vea cuántos no está pudiendo gestionar—,
pero si en 1-2 meses no se paga, se corta también eso, para no mantener en
Supabase nada que cueste dinero.

**Decisión: no se construye el corte, porque lo que cortaría no cuesta dinero.**
Se deja la cuenta escrita para que nadie lo vuelva a plantear por coste.

En Supabase **no se paga por llamada**. Las peticiones a la base de datos no se
cobran. Se paga por: GB guardados, GB *descargados* (egress), usuarios activos al
mes (MAU) y el tamaño de la máquina (§12.2). Un conectado congelado:

| Concepto | Qué hace el congelado | Coste al mes |
|---|---|---|
| Base de datos | su historial crece ~17 KB al mes (~0,5 MB al año, §12.3) | ~0,000002 $ |
| Egress | **subir es gratis** (es *ingress*); nadie descarga, el entrenador está congelado | 0 |
| Poll del contador | `refreshTrainerSlots` lee un número por cliente | 0 en la práctica |
| MAU anónimo | el cliente sigue usando la app con su sesión | 0 hasta 100.000 MAU; después 0,00325 $ |

**Peor caso: un tercio de céntimo al mes por cliente congelado**, y solo pasados
los 100.000 MAU del plan Pro de Supabase. Mil congelados cuestan, como mucho,
3 $ al mes.

Además, cortar no ahorraría ni eso:
- **El MAU no se ahorra parando la subida.** El cliente sigue entrando con su
  sesión. Habría que desvincularlo del todo, y eso es tocar su móvil.
- **Alguien tiene que ejecutarlo.** El servidor no sabe quién ha pagado (§9).
  Hacerlo bien pide el webhook de RevenueCat → Edge Function → `frozen_at` en
  los huecos → `pg_cron` que los vacíe → que el móvil del cliente entienda que
  su hueco ha muerto. Son unos dos días de trabajo con SQL y casos raros.
- **Se pierde el gancho.** Pasados los 2 meses el contador de entrenos sin
  descargar se para, y volver a pagar ya no trae el historial de una vez (§4.7).

**Lo que sí crece sin techo ya tiene su sitio:** los huecos abandonados se
limpian con la línea de §12.6 cuando la base de datos pase de ~4 GB.

**Si se reabre** (por otra razón que no sea el coste), el diseño mínimo es el
de arriba: `frozen_at` escrito por el webhook de expiración de RevenueCat,
cuyo `app_user_id` ya es el `trainerSync.userId` tras M01-01.

**Margen antes de congelar:** para los **fallos de cobro** ya existe sin código.
El *billing grace period* de las dos stores mantiene el entitlement activo
mientras reintentan cobrar; solo hay que activarlo (guía de pagos, pasos A8 y
G4). Para la cancelación voluntaria no se da margen: la propia suscripción ya
dura hasta el final del periodo pagado.

### 4.10 Cómo quedó (6-oct-2026)

- **La regla**, pura y con tests: `src/utils/freePlan.js` (`fitsFree`,
  `clientLimitReason`, `templateCounts`, `activeClientIds`, `isClientFrozen`,
  `needsClientChoice`).
- **Las puertas**, en el store (bloque «Plan gratis»): las de §4.2 y §4.8, más
  las de §4.5 para el congelado. Además de las de la tabla se guarda
  **`setEditingProgram`**: es la única entrada al editor, así que el programa
  de un congelado se ve pero no se edita, venga de donde venga.
- **Dos formas de decir que no**: crear, asignar y apuntar abren el paywall y
  devuelven `null`; las de sincronizar (`uploadProgramToClient`,
  `sendOverrides`, `downloadClientHistory`, `reissueClientCode`) **lanzan**
  `paywall.frozenError`. Sus llamadas automáticas ya eran silenciosas (la
  subida del invitado, la descarga al abrir la ficha) y así tampoco marcan el
  historial como visto: el contador de pendientes sigue subiendo.
- **El paywall global** no está en `App.js` sino en `RootNavigator`, junto al
  toast y los diálogos (`GlobalPaywall`). Entra con 250 ms de retraso, como
  las demás hojas que se abren al cerrar otra: en iOS un Modal no se presenta
  mientras otro se va. El motivo cambia solo el subtítulo (`paywall.reason.*`);
  la lista de ventajas se reescribe en M01-03.
- **Contadores**: Clientes enseña `n/3` en el título; Plantillas, `n/1` en el
  de cada segmento. El «con app» no lleva contador fijo en la cabecera: sale en
  la hoja de elección y en el paywall, que es cuando importa.
- **Congelado en la lista** (revisado tras QA, §4.11): van al final, bajo su
  título «CONGELADOS · N», con la tarjeta atenuada, «Congelado» y sin botón de
  acción. «Enviar todo» se los salta.
- **«Pestañas PRO» pasa a «Pestañas de entrenador»**, y la fila sale siempre.
- Al crear un cliente bloqueado, el nombre se queda escrito en el formulario.
- Tests: `freePlan.test.js` y «plan gratis — M01-02» en `useStore.test.js`.

Se prueba en desarrollo con el interruptor PRO/FREE del menú (sobrevive a los
reinicios: está en `profile`), o en un build sin `EXPO_PUBLIC_FORCE_PRO`.

### 4.11 QA del 6-oct-2026: elegir es para siempre, y PRO antes de tocar

**La elección no se rota.** Con el aviso siempre a la vista y la hoja dejando
desmarcar, se podía ir cambiando de clientes y acabar llevándolos a todos sin
pagar. Ahora:

- Lo elegido queda **fijo**: la hoja no deja desmarcarlo, y `setFreeClientIds`
  solo añade (y no guarda nada que no quepa). `lockedClientIds` en `freePlan.js`.
- El aviso naranja **desaparece** en cuanto hay una elección válida. Solo vuelve
  —«Te queda un hueco libre»— si se borra a uno de los elegidos y algún
  congelado cabe en el hueco (`canChooseMore`). Rotar cuesta borrar un cliente
  con su historial: no compensa.
- Volver a Pro **olvida** la elección (suscriptor en `useStore.js`). Si no, la
  siguiente caducidad la daría por buena y congelaría de oficio a los clientes
  nuevos de esa temporada.

**Lenguaje de una acción bloqueada.** Antes la puerta solo estaba en el store:
se entraba en la hoja (p. ej. elegir día al apuntar) y el paywall salía al
final. Ahora la acción se marca **antes** de tocarla, siempre igual:

- **No se apaga ni se esconde: pierde su color de acción y gana la etiqueta
  PRO** (la pastilla lima del PRO del menú ≡). Un botón en acento pasa a
  `surface2` con el texto normal y `ProBadge` al lado; una fila de hoja,
  `MenuRow badge="PRO"` con la etiqueta en gris.
- **Excepción: «+ Cliente» y «+ Plantilla» no llevan PRO** (QA: alargaba la
  cabecera). Se ven igual y al tope abren el paywall directamente.
- **Un cliente fuera de plan, como opción de una lista** (hojas de asignar), no
  lleva PRO: sale en gris, con «Fuera de plan» y sin poder marcarse.
- **Vocabulario**: en pantalla es «fuera de plan» (tarjeta, sección, aviso,
  hojas, paywall). «Congelado» queda solo en el código y en esta spec.
- **Tocarla abre el paywall directamente**, con su motivo, sin pasar por la
  hoja que abriría.
- La tarjeta del congelado sí se atenúa (opacidad 0,5): ahí no es una acción,
  es un cliente fuera de juego.

Piezas: `src/components/ui/ProBadge.jsx`; `freeGates()` en `freePlan.js` (el
motivo de cada acción, o null) y el hook `src/useFreeGates.js`, que añade
`gate(motivo, fn)`: con motivo, el toque abre el paywall; sin él, `fn`. La puerta
de verdad sigue en el store; esto solo la enseña.

Dónde se marca:

| Pantalla | Acciones con PRO |
|---|---|
| Clientes | «Con app» en el alta si ya hay uno · pulsación larga de un congelado: Empezar, Preparar, Editar programa |
| Ficha de un congelado | Editar · Preparar · Enviar cambios · Desbloquear etapa · Planificar · Asignar programa (botón y ⋯) · Importar historial · Reactivar archivado · EMPEZAR y Editar de sus sesiones · Apuntar sesión · + Sesión libre · Pasar a la app (si no cabe) · Reemitir código |
| Plantillas | Duplicar al tope · en las hojas de asignar, cada cliente fuera de plan en gris («Fuera de plan», sin PRO) |
| Guardar como plantilla | menú ⋯ del cliente, Mi programa y archivados (los dos) |

**Probar M01-02**

- [ ] En FREE: crear 3 clientes manuales → el cuarto abre el paywall con «El
  plan gratis llega hasta 3 clientes», y el nombre sigue escrito al volver al
  formulario. El título dice `3/3`.
- [ ] En FREE con 1 cliente con app: crear otro «con app», o «Pasar a la app» a
  uno manual → paywall de «1 cliente con app». El manual no cambia.
- [ ] En FREE: crear 1 plantilla de programa y 1 de sesión → la segunda de cada
  tipo (crear o duplicar, y «Guardar como plantilla» desde archivados o desde
  Mi programa) abre el paywall. Las cabeceras dicen `1/1`.
- [ ] Ya no hay muros: Clientes y Plantillas se abren en FREE; el onboarding
  ofrece cargar una plantilla si existe.
- [ ] En PRO: crear 5 clientes (2 con app) y 2 plantillas de cada → pasar a
  FREE → sale sola «Con quién sigues», sin poder confirmar más de 3 o más de 1
  con app.
- [ ] Elegir 3 → el aviso naranja desaparece; los otros 2 van al final bajo
  «FUERA DE PLAN · 2», atenuados, con «Fuera de plan» y sin botón. No hay
  forma de volver a abrir la hoja.
- [ ] Borrar a uno de los 3 elegidos → vuelve el aviso «Te queda un hueco
  libre»; en la hoja, los 2 que quedan salen marcados y no se pueden desmarcar.
- [ ] Ficha de un congelado: se ve historial, progreso e info. Todo lo de la
  tabla de §4.11 lleva PRO y abre el paywall al tocarlo, sin abrir antes su
  hoja (p. ej. Apuntar sesión no enseña los días).
- [ ] En FREE al tope: «+ Cliente» y «+ Plantilla» se ven igual (sin PRO) y
  abren el paywall; Duplicar y Guardar como plantilla llevan PRO y lo abren
  directamente.
- [ ] Congelado con app: su móvil sigue entrenando y subiendo; en la tarjeta del
  entrenador el número de entrenos pendientes sube, y abrir su ficha no lo pone
  a cero.
- [ ] Con 2 plantillas de programa en FREE: las dos se asignan sin paywall. En
  la hoja de asignar, los clientes fuera de plan salen en gris con «Fuera de
  plan» y no se pueden marcar.
- [ ] Volver a PRO → nada congelado, sin aviso ni contadores.

---

## 5. Fase 2 — Paywall dual

### 5.1 Un entitlement, dos productos

`checkProStatus` solo mira `entitlements.active[RC_PRO_ENTITLEMENT]`
(`useStore.js:3847`). Dos productos apuntando al **mismo** entitlement funcionan
sin tocar una línea de la lógica de compra. El paywall ya itera sobre
`offering.availablePackages`, así que también pinta los dos sin cambios.

El entitlement **se queda como está**, `'Forma - Fit Pro'` (decisión del
5-oct-2026): ya funciona, y renombrarlo obliga a crear uno nuevo y mover los
productos. Los productos nuevos se enganchan a este.

### 5.2 Lo que hay que cambiar en `PaywallModal.jsx`

1. **Línea 151** — `` `${pkg.product.priceString} · Pago único` `` ramifica por
   `pkg.packageType` (`ANNUAL` → precio/año + "se renueva sola";
   `LIFETIME` → "pago único, para siempre").
2. **Línea 192** — el texto legal *"Pago único. Sin suscripciones. El acceso a
   Forma Pro es permanente"* pasa a depender del paquete seleccionado. Tal como
   está, con una suscripción en el offering, **es mentira**.
3. **Línea 191** — añadir enlaces a **Términos de uso (EULA)** y **Política de
   privacidad**. Ver §5.4: es motivo de rechazo, no un detalle.
4. **i18n del fichero entero.** Es la única pantalla de la app con el texto a
   pelo en español, incluida la lista `PRO_FEATURES` de la línea 21. Si se toca,
   se toca entera.
5. **`PRO_FEATURES` reescrita** para el modelo nuevo: hoy vende "Gestión
   completa de clientes" y "Crear plantillas de entrenamiento", que a partir de
   la fase 1 **son gratis**. Pasa a vender *clientes ilimitados*, *todos los clientes con app* y
   *plantillas ilimitadas*.

### 5.3 El caso feo: anual → pago único

Ninguna de las dos stores convierte una suscripción en una compra única. Quien
tenga la anual y compre el lifetime paga el lifetime entero **y sigue pagando la
anual hasta que la cancele a mano**. RevenueCat no puede devolver la diferencia.

**Decisión:** se muestran los dos siempre, y si hay suscripción activa la tarjeta
del pago único lleva una línea — *"si ya tienes la suscripción, recuerda
cancelarla tras comprar"*. Es una línea de copy contra perder conversión.

Apunte de precio, no de código: el pago único debe estar sobre 2,5-3× la anual o
la anual no la compra nadie.

### 5.4 Lo que Apple rechaza

Motivo 3.1.2, y es de los rechazos más comunes:

- ✅ Botón de restaurar — ya está (`PaywallModal.jsx:181`).
- ❌ **Enlaces a EULA y a política de privacidad dentro del paywall.**
- ❌ **Precio, periodo y renovación automática visibles junto al botón de
  compra.** El texto actual dice literalmente "Sin suscripciones".
- ❌ La ficha de App Store tiene que mencionar la suscripción.

### 5.5 La política de privacidad no está publicada

`docs/app-store-privacidad.md` responde el cuestionario de Apple, pero **no hay
ninguna URL pública**. Las dos stores exigen una, y §5.4 exige además el EULA.
La misma página estática que necesita la fase 3 resuelve las tres cosas —
privacidad, EULA y redirección de invitación — en un solo sitio alojado.

---

## 6. Fase 3 — Invitar cliente

### 6.1 Lo que ya está puesto

`createClientSlot` genera el `client_code`; la tarjeta de código de
`ClientsScreen.jsx:652-690` ya lo enseña con copiar y reemitir; `App.js:115-119`
ya escucha URLs entrantes; el scheme `forma` ya está declarado en `app.json`.

### 6.2 El alcance: nivel 1

Botón **Invitar** junto al de copiar de esa misma tarjeta → `Share.share()` con
un mensaje y un enlace **https** a una página estática propia, que intenta abrir
`forma://join/CODIGO` y, si no hay app, redirige a la store correspondiente.

Cambios:

1. **`App.js:91`** — `isFileIntent` rechaza explícitamente todo lo que no sea
   `.fitdata`. Añadir una rama para `forma://join/<code>` **antes** de ese guard.
2. **`pendingInviteCode`** en el store, mismo patrón que `pendingExternalImport`
   (`useStore.js:447, 2459`).
3. `OnboardingScreen.jsx:931` y `TrainerConnectionScreen.jsx:284` abren
   `ClientCodeModal` con el código precargado cuando ese pendiente existe.
4. Si `trainerSync.mode` es `'offline'` o `null` **no hay código que compartir**:
   el botón lleva antes a conectar.
5. El botón respeta el límite de la fase 1: paywall **antes** de generar el slot,
   no después de que el cliente se haya descargado la app.

Resultado: cliente que ya tiene la app → toca y entra vinculado. Cliente que no
la tiene → instala y **pega el código a mano**, que va en el mismo mensaje.

### 6.3 Seguridad: no empeora nada

`supabase/connection_model.sql` ya garantiza que un código filtrado solo abre
asientos vacíos (client-connection §3.7). Mandar el código por WhatsApp no añade
riesgo nuevo, porque copiar y pegar el código ya hace exactamente eso hoy.

---

## 7. Configuración de las stores y de RevenueCat

Paso a paso, con el orden y cómo se hablan las piezas, en
[guia-pagos.md](../guia-pagos.md). Es la tarea M01-05: no es código, pero
bloquea probar la M01-03 y es lo más lento de todo (el contrato de Apple).

Los identificadores, fijados aquí para que la guía y el código no diverjan:

| Qué | Id |
|---|---|
| Entitlement | `Forma - Fit Pro` (el que ya existe, §5.1) |
| Suscripción anual | `formafit_pro_annual` (Apple, ya creado) · `formafit_pro` con plan base `annual` (Google) |
| Pago único | `formafit_pro_permanent` (Apple, ya creado) · Google: el que ya existe, **sin apuntar aún** |
| Offering | `default`, con los paquetes `$rc_annual` y `$rc_lifetime` |

---

## 8. Decisiones tomadas

| Decisión | Motivo |
|---|---|
| Límite por conteo **actual**, no histórico | un contador persistido hay que migrar, respaldar y explicar |
| Gratis: **3 clientes, como mucho 1 con app**, y 1 + 1 plantillas | conectar es lo que cuesta servidor y lo que más vale; manual no cuesta nada (5-oct-2026) |
| Dos comprobaciones (`total ≤ 3`, `con app ≤ 1`), no dos bolsas fijas | una sola función, `fitsFree`, sirve para crear, conectar y elegir |
| Al caducar: **congelar en solo lectura, no borrar**, manuales incluidos | borrar datos de quien pagó es la reseña de una estrella; sin congelar los manuales, pagar un año y crear 50 sale gratis después |
| Los activos **los elige el entrenador**, no la antigüedad | los clientes más antiguos de un entrenador con 10 suelen ser los que ya no entrena |
| Plantillas al caducar: se quedan **y se asignan**; solo crear otra choca | la plantilla ya es suya; el techo lo pone el límite de clientes (QA 6-oct) |
| Precios: **anual + pago único**, sin mensual | decisión del usuario, 5-oct-2026 |
| El contador de entrenos pendientes **sigue subiendo** en los congelados | enseña el valor exacto de volver a pagar sin regalarlo, y ya está calculado |
| Al cliente no se le avisa de nada | *"tu entrenador ha dejado de pagar"* no beneficia a nadie |
| `trainerSync.userId` como App User ID | es el único id estable que sobrevive a reinstalar, y ya existe |
| Cuenta por código automática tras comprar sin cuenta | un toque, sin correo; la pantalla `code_reveal` ya existe y ya dice lo correcto |
| Los dos productos visibles siempre | perder conversión duele más que una línea de copy sobre cancelar |
| El entitlement **se queda `Forma - Fit Pro`** | ya funciona; renombrarlo es crear otro y mover productos |
| Sin corte del congelado a los 1-2 meses | un congelado cuesta < 1/3 de céntimo al mes; cortar pide webhook + cron (§4.9) |

---

## 9. Descartado, con motivo

**Límite en el servidor.** Un trigger en Postgres que cuente filas de
`trainer_clients` es fácil; el problema es que para saber si el usuario ha
pagado el servidor necesita **webhooks de RevenueCat → tabla de entitlements en
Supabase**: endpoint, verificación de firma, reconciliación y un estado más que
puede desincronizarse. Hoy el límite es del lado del cliente y quien edite el
AsyncStorage tiene clientes infinitos. El perfil de usuario es un entrenador
personal, no alguien que recompila la app. Se añade el día que aparezca en los
números, no antes.

**Deferred deep linking** (que el cliente instale y ya salga vinculado, sin
teclear). Ningún sistema operativo lo da:

- **iOS**: los Universal Links no sobreviven a la instalación. Apple no ofrece
  ningún mecanismo.
- **Android**: la Play Install Referrer API sí pasa un parámetro a través de la
  instalación, pero es solo Android y es un módulo nativo más.
- **Terceros**: Branch.io (config plugin de Expo, gratis hasta 10k MAU) o
  AppsFlyer. **Firebase Dynamic Links está muerto desde 2025**, no es opción.

Coste: SDK nuevo, rebuild nativo y una dependencia de atribución con su propia
política de privacidad que declarar en las dos stores — lo que además obliga a
rehacer `docs/app-store-privacidad.md`, que hoy puede contestar *"no
rastreamos"* precisamente porque no hay ningún SDK de esa lista. Beneficio: que
el cliente no teclee 6 caracteres **una vez**. Y client-connection §3.3 ya asume
que el entrenador reenvía códigos como flujo normal. Se reconsidera solo si el
abandono en la invitación aparece medido.

---

## 10. Trampas

1. **`isFileIntent` rechaza el deep link de invitación** (`App.js:91`). La rama
   nueva va **antes** del guard, o la URL se descarta en silencio.
2. **`logIn` con un id que cambia** rompe la identidad. `trainerSync.userId` es
   estable; `clientSync.supabaseUserId` **no** — es anónimo por instalación.
3. **Identificado → identificado no transfiere solo** (§3.4). Sin el
   `restorePurchases()` tras el `logIn`, el entrenador que pasa de código a
   Google pierde el Pro.
4. **El texto legal del paywall miente** en cuanto exista la suscripción
   (`PaywallModal.jsx:192`). Es lo primero que mira la revisión de Apple.
5. **Sin contrato de Apps de Pago, `getOfferings()` devuelve vacío** y el paywall
   enseña "Forma Pro próximamente" (`PaywallModal.jsx:135`) sin ningún error que
   permita diagnosticarlo.
6. `EXPO_PUBLIC_FORCE_PRO=true` está puesto en el perfil `preview` de `eas.json`
   y **salta la comprobación entera** (`App.js:164`). Probar el freemium en un
   build preview no prueba nada: hace falta un build sin esa variable.
7. **"Congelar la sincronización" NO incluye `refreshTrainerSlots`**
   (`useStore.js:3246`). Es el poll ligero de `sessions_count`, y bloquearlo por
   coherencia mata el contador de entrenos pendientes, que es el gancho de
   reconversión de §4.7. Se congelan las tres acciones de §4.5, no el metadato.
8. **El bucle de "enviar todo"** (`ClientsScreen.jsx:1925`) llama a
   `uploadProgramToClient` y `sendOverrides` directamente. Si el guard vive solo
   en la UI de la ficha, este camino se lo salta — de ahí que el guard vaya
   dentro de las acciones del store, no en las pantallas.
9. El interruptor PRO/FREE del menú de desarrollador (`AppHeader.jsx:519-525`)
   está bien acotado con `__DEV__`, pero escribe `profile.isPro`, que es lo
   mismo que lee `checkProStatus`. Al probar la fase 1 en desarrollo, recordar
   que ese valor sobrevive a los reinicios porque está en el `partialize`.

---

## 11. Orden de trabajo y coste

| Fase | Qué | Coste | Bloquea a |
|---|---|---|---|
| **0** | Identidad en RevenueCat (`logIn`/`logOut`, restore behavior) | ½ día | la primera venta |
| **—** | Papeleo de stores, **en paralelo desde el día 1** | espera | fase 2 |
| **1** | Plan gratis 3 (1 con app) + 1 + 1, congelado por cliente + hoja de elección | 2-3 días | — |
| **2** | Paywall dual + i18n + enlaces legales | ½ día | productos creados |
| **3** | Invitar cliente nivel 1 + página estática | 1 día | — |

Total de app: **~4 días**. El camino crítico real no es el código: es el
contrato de Apps de Pago de Apple, que es tiempo de espera puro. Empezarlo antes
que nada.

---

## 12. Coste de infraestructura: qué pasa si el plan gratis lo usan miles

Regalar huecos significa gente usando tu Supabase sin pagar. La pregunta es
cuándo eso deja de ser gratis para ti. Números de septiembre de 2026, medidos
contra este repositorio.

### 12.1 Quién cuesta y quién no

**El usuario en solitario no toca Supabase.** No hay ningún `signIn` hasta que
alguien entra como entrenador o vincula un código
([supabaseAuth.js](../../src/services/supabaseAuth.js)). Miles de personas
usando la app sin la feature de clientes cuestan **cero**: ni MAU, ni filas, ni
egress. El coste empieza exactamente donde empieza la feature que se regala.

Y los asientos no valen lo mismo:

| Quién | Cómo entra | Qué cuota consume |
|---|---|---|
| Entrenador | Google/Apple o código → `signInWithPassword` | **MAU** |
| Cliente conectado | `signInAnonymously` ([supabaseAuth.js:143](../../src/services/supabaseAuth.js)) | **MAU anónimo** (bolsa aparte) |
| Usuario solo | no entra | nada |

Un trío gratis —entrenador + sus dos clientes— son 1 MAU, 2 MAU anónimos y dos
filas en `trainer_clients`.

### 12.2 Los planes

| | Free | Pro $25/mes | Exceso en Pro |
|---|---|---|---|
| Base de datos | 500 MB | 8 GB | **$0.125 / GB** |
| Egress | 5 GB | 250 GB | $0.09 / GB |
| MAU | 50.000 | 100.000 | $0.00325 / usuario |
| MAU anónimos | 50.000 | 100.000 | $0.00325 / usuario |
| Storage | 1 GB | 100 GB | $0.0213 / GB |
| Backups | **ninguno** | diarios, 7 días | — |
| Pausa por inactividad | **sí, a la semana** | no | — |

Pro incluye $10 de crédito de cómputo, que cubre la instancia micro. Las
consultas de esta app son lecturas de una fila por código: micro sobra.

### 12.3 Cuánto pesa un cliente

Medido sobre `fc-seed-carga.fitdata`: **969 bytes por sesión** en JSON compacto.
Un cliente que entrena cuatro días por semana genera ~200 sesiones al año, unos
**200 KB de historial anual**, más el `program_json` del hueco. Redondeando al
alza con el overhead de `jsonb`: **~0.5 MB por cliente y año**.

De ahí salen los techos:

- **500 MB gratis ≈ 1.000 clientes-año** — unos 500 entrenadores exprimiendo el
  regalo durante un año entero.
- **8 GB de Pro ≈ 16.000 clientes-año.**
- Los 100.000 MAU de Pro son 100.000 entrenadores; los 250 GB de egress,
  ~800.000 descargas de historial. Ninguno de los dos es el límite.

La sincronización juega a favor: **no hay polling**. `checkAndPullProgramUpdates`
va en el arranque y el entrenador tira del historial cuando quiere
([useStore.js:3279](../../store/useStore.js)).

### 12.4 El coste marginal de un entrenador gratis

Ya en Pro y pasados todos los incluidos, lo peor del caso:

```
3 MAU × $0.00325           = $0.0098
1 MB de BD × $0.125/GB     = $0.0001
~5 MB de egress × $0.09/GB = $0.0005
                            ─────────
                             ~$0.01 / mes
```

**Un céntimo al mes por entrenador gratis activo.** Diez mil entrenadores
gratis y activos son ~$100/mes; mil son ~$10, dentro del $25 que ya se paga.

### 12.5 Qué implica para el plan gratis

**Los huecos gratis no son un riesgo financiero.** No hay escenario
plausible en el que la generosidad del muro cueste más de lo que trae: para que
Supabase duela hace falta un volumen de entrenadores en el que la conversión a
Pro paga la factura veinte veces. El plan gratis de §4 es sostenible tal como está
escrito, y esta sección existe para que nadie lo recorte por miedo a una factura
que no llega.

**Pero se pagan los $25 el día de la publicación, y no por capacidad.** El plan
Free no tiene backups, y aquí se guarda el historial de entrenamiento de gente
real: perderlo por no pagar $25 no se arregla con una disculpa. La pausa por
inactividad y el límite de dos proyectos son la segunda razón. La capacidad es
la última.

### 12.6 Lo único que sí crece sin techo

No es el usuario gratis, es **el hueco muerto**: un cliente que se desconectó
hace un año deja su `history_json` ahí para siempre, y un entrenador que
abandonó deja sus dos huecos llenos. Eso engorda sin dar nada. Una línea cuando
la base de datos pase de ~4 GB, no antes:

```sql
update trainer_clients set history_json = null
where client_id is null and disconnected_at < now() - interval '12 months';
```

Los estados del hueco están en [connection_model.sql](../../../supabase/connection_model.sql):
`client_id` nulo con `disconnected_at` con fecha es VACANTE, y una vacante de un
año no va a volver.

**Y los anónimos:** cada reinstalación de un cliente crea un usuario nuevo en
`auth.users` que ya no se borra solo. No afecta al MAU —solo cuentan los activos
del mes— pero la tabla engorda igual. Mismo criterio: se purga cuando moleste.
