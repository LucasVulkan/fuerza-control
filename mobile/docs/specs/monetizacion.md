# Spec — Monetización: freemium 2+2, pago dual e invitación de clientes

> Tema: monetización
> En corto: Freemium 2+2: el entrenador lleva dos clientes y dos plantillas gratis. Hoy el muro es todo o nada, así que no puede probar el producto con lo que hace a diario. Incluye el pago desde el móvil del cliente y la invitación.
> Fase M01 · pendiente · Identidad en RevenueCat (`logIn`/`logOut`, restore behavior) · §3
> Fase M02 · pendiente · Freemium 2+2: congelado por cliente y hoja de elección · §4
> Fase M03 · pendiente · Paywall dual + i18n + enlaces legales · §5
> Fase M04 · pendiente · Invitar cliente nivel 1 + página estática · §6
>
> Estado: **SIN IMPLEMENTAR** (sep 2026). 4 fases: 0 identidad · 1 freemium ·
> 2 paywall dual · 3 invitar cliente.
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
> Depende de: [client-connection.md](client-connection.md) para la fase 3 (el
> código de cliente y sus garantías ya existen; esta spec no toca el SQL).

---

## 1. Qué cambia

| | Hoy | Con esta spec |
|---|---|---|
| Clientes | 0 sin Pro | **2 gratis**, ilimitados con Pro; el resto **congelados**, no borrados (§4.5) |
| Plantillas | 0 sin Pro | **2 gratis**, ilimitadas con Pro |
| Precio | un pago único | **anual O pago único**, mismo entitlement |
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
| `RC_IOS_API_KEY = 'YOUR_IOS_API_KEY'` — iOS no existe en RevenueCat | `src/config/revenuecat.js:13` | 0 |
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

**Decisión:** tras una compra con éxito sin cuenta, crear la cuenta por código
con `setupTrainerCodeAccount()` y enseñar la pantalla `code_reveal` de
`TrainerSyncModal`, que **ya existe y ya dice lo correcto** — *"es la única
forma de recuperar la cuenta"*. Solo hay que añadirle *"y tu compra"*. Un toque,
sin correo, sin OAuth.

---

## 4. Fase 1 — Freemium 2+2

### 4.1 El límite

```js
const FREE_CLIENTS   = 2;
const FREE_TEMPLATES = 2;
```

Se cuentan los **actuales**, no los creados alguna vez:
`Object.keys(clients).length` y `templatesOf(programs).length`. Borrar y
recrear es un agujero, pero es un agujero que solo usa quien tiene 2 clientes de
verdad; contar el histórico obliga a un contador persistido que hay que migrar,
respaldar y explicar.

### 4.2 Dónde va la puerta

| Acción | Fichero | Qué hace si se pasa del límite |
|---|---|---|
| Crear cliente | `useStore.js:576` `createClient` / `ClientsScreen.jsx:2184` `handleCreateClient` | no crea, abre el paywall |
| Crear plantilla | `ProgramScreen.jsx:361` `handleCreateTemplate` | no crea, abre el paywall |
| Duplicar plantilla | `ProgramScreen.jsx:369` | igual |
| Invitar cliente (fase 3) | `ClientsScreen` | paywall **antes** de generar nada |

La comprobación vive en el store como un selector, no repartida por las
pantallas: `canCreateClient()` / `canCreateTemplate()`. Dos funciones de una
línea, un único sitio donde está escrita la regla.

### 4.3 Qué se borra

- `ClientsScreen.jsx:2319-2350` — el bloque `if (!isPro)` entero, con su
  `emptyState`, su botón "Ver planes PRO" y su "Ocultar tab".
- `ProgramScreen.jsx:394-414` — ídem, con las claves i18n `templates.proTitle`,
  `proBody`, `proCta` (`es.json:2043-2045`) y sus pares en `en.json`.
- `OnboardingScreen.jsx:902` — `isPro && templateList.length > 0` pasa a
  `templateList.length > 0`.
- `RootNavigator.jsx:62` — `showProTabs = isPro || !proTabsHidden` pasa a
  `!proTabsHidden`.
- `AppHeader.jsx:480` — el `!isPro &&` que envuelve la fila de ocultar tabs.

`proTabsHidden` **sobrevive** y se simplifica: deja de ser un parche del muro y
pasa a ser lo que siempre quiso ser, una preferencia — *"no soy entrenador,
quítame esos tabs"*. Los botones "Ocultar tab" de dentro de los muros
desaparecen con ellos; la fila del menú de ajustes se queda.

### 4.4 Qué se añade

- **Contador visible** en Clientes y en Plantillas cuando no hay Pro: `2/2`
  junto al botón de crear. Sin contador, el usuario descubre el límite chocando
  contra él, que es la peor forma de enterarse.
- El paywall se abre desde la acción bloqueada, y su copy cambia (§5.2).
- **Estado congelado en la tarjeta del cliente** (§4.5), con el contador de
  entrenos sin descargar, y la hoja de elección de los dos activos (§4.6).
- `profile.freeClientIds: []` en el estado persistido. No necesita migración: el
  valor por defecto es válido y solo se consulta con más de 2 clientes.

### 4.5 Qué pasa al caducar con más clientes de los gratis

**No se borra ni se oculta nada. Se congela la sincronización, cliente a
cliente.** Borrar datos de gente que pagó es la vía rápida a las reseñas de una
estrella, y ocultarlos es lo mismo con otro nombre: el entrenador sigue teniendo
a esos clientes en la vida real.

Un cliente está **activo** o **congelado**. Dos activos sin Pro; los demás,
congelados.

| | Cliente congelado | Dónde va el guard |
|---|---|---|
| Descargar historial | ❌ | `downloadClientHistory` (`useStore.js:3158`) |
| Asignar / subir programa | ❌ | `uploadProgramToClient` (`useStore.js:3065`) |
| Ajustes (overrides de la próxima sesión) | ❌ | `sendOverrides` (`useStore.js:3137`) |
| Editar su programa | ❌ | entrada al editor desde la ficha |
| "Enviar todo" masivo | salta los congelados | bucle de `ClientsScreen.jsx:1925` |
| Reemitir código | ❌ | es mantenimiento de la conexión |
| Ver historial y progreso | ✅ congelados en la fecha del corte | — |
| Ver su programa | ✅ solo lectura | — |
| Eliminar el cliente | ✅ | — |
| Facturación, notas, peso, ficha | ✅ | registros locales del entrenador, no sincronización |
| Contador de entrenos sin descargar | ✅ **sigue subiendo** | `refreshTrainerSlots` **no se toca** |

**Al cliente no se le dice nada.** Sigue entrenando y subiendo con normalidad.
*"Tu entrenador ha dejado de pagar"* es un mensaje que no beneficia a nadie, y
además el cliente conserva el último programa recibido porque su
`checkAndPullProgramUpdates` (`useStore.js:3512`) simplemente no encuentra nada
nuevo.

### 4.6 Cuáles son los dos activos

Campo nuevo, `profile.freeClientIds` (exactamente 2 ids), y un selector:

```js
isClientFrozen(clientId) =
  !isPro
  && Object.keys(clients).length > FREE_CLIENTS
  && !freeClientIds.includes(clientId)
```

La hoja de elección aparece cuando `!isPro && clientes > 2` y `freeClientIds` no
contiene 2 ids que sigan existiendo. Eso ocurre **solo tras una caducidad**: el
usuario gratis de toda la vida nunca la ve, porque con 2 clientes o menos el
array ni se consulta y el límite de §4.2 se encarga de que no haya un tercero.
Mientras no elija, todo está congelado — seguro por defecto en vez de
silenciosamente equivocado.

**Por qué lo elige el entrenador y no un criterio automático.** La regla obvia
—los 2 más antiguos— es determinista y gratis (el id es
`client_<Date.now()>_<rand>`, así que ordena solo por id), pero elige
exactamente mal: los 2 clientes más antiguos de un entrenador con 10 suelen ser
los que ya no entrena. Se quedaría con dos fantasmas vivos y sus 8 clientes
reales congelados, justo en el momento en que está decidiendo si vuelve a pagar.

### 4.7 Por qué esto sale casi gratis

Tres hechos del código que hacen que el modelo de §4.5 no necesite
infraestructura nueva:

1. **Las cuatro acciones ya son por cliente.** `uploadProgramToClient`,
   `sendOverrides`, `downloadClientHistory` y el borrado reciben todas el
   `clientId`. La distinción activo/congelado es un `if` al principio de tres
   funciones, más una condición en el bucle de "enviar todo".
2. **El backlog no hay que construirlo.** `uploadHistory`
   (`supabaseSync.js:124`) escribe el **log entero** en cada subida
   (`history_json: { entries }`, `sessions_count: entries.length`), no
   incrementos. El cliente congelado sigue sobrescribiendo su historial completo
   en su slot, así que el día que el entrenador vuelva a pagar **una sola
   descarga trae todo lo acumulado**. Sin cola, sin tabla de pendientes, sin
   nada.
3. **El contador de entrenos pendientes ya está calculado.**
   `refreshTrainerSlots` (`useStore.js:3246`) es un poll ligero que lee solo
   `sessions_count` sin bajarse el JSON del historial, y `ClientsScreen.jsx:1897`
   ya computa `remoteSessionsCount - lastSeenSessionsCount` por cliente. Ese poll
   **no se bloquea**: es metadato, no historial. Así que un cliente congelado
   enseña *"7 entrenos sin descargar"* y el número sube solo, sin escribir una
   línea.

El punto 3 es además el mejor gancho de reconversión que tiene el producto:
enseña el valor exacto de volver a pagar sin regalarlo.

---

## 5. Fase 2 — Paywall dual

### 5.1 Un entitlement, dos productos

`checkProStatus` solo mira `entitlements.active[RC_PRO_ENTITLEMENT]`
(`useStore.js:3847`). Dos productos apuntando al **mismo** entitlement funcionan
sin tocar una línea de la lógica de compra. El paywall ya itera sobre
`offering.availablePackages`, así que también pinta los dos sin cambios.

**Ahora o nunca:** el entitlement se llama `'Forma - Fit Pro'`, con espacios y
un guion. Funciona, pero si se va a renombrar a algo sano (`pro`), este es el
último momento: no hay compradores.

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
   la fase 1 **son gratis**. Pasa a vender *clientes ilimitados* y *plantillas
   ilimitadas*.

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

### Google Play

1. **Monetizar → Suscripciones**: `forma_pro`, plan base anual (P1Y),
   auto-renovable. Precio y países.
2. **Monetizar → Productos integrados**: `forma_pro_lifetime`, producto
   gestionado (no consumible).
3. **Service account** con acceso a la Google Play Developer API y su JSON
   subido **a RevenueCat** (ver datos financieros + gestionar pedidos y
   suscripciones). **No es** la `google-service-account.json` de `eas submit`:
   es otra.
4. **Real-time developer notifications**: topic de Pub/Sub apuntando al endpoint
   de RevenueCat. Sin esto, renovaciones y cancelaciones llegan tarde o no
   llegan.
5. App publicada al menos en track interno (✅ ya) y el probador como *licensed
   tester*, o las compras fallan sin explicación.

### App Store

Se parte de cero: no hay app iOS en RevenueCat.

1. **Contrato de Apps de Pago firmado + datos bancarios y fiscales completos.**
   Sin esto los productos se quedan en *Missing Metadata* y `getOfferings()`
   devuelve vacío. **Es lo más lento de todo**: empezar por aquí.
2. **Suscripción auto-renovable** de 1 año dentro de un Subscription Group.
3. **Compra No Consumible** para el pago único (no consumible es el que se
   restaura).
4. **In-App Purchase Key (.p8)** y **App-Specific Shared Secret** subidos a
   RevenueCat.
5. **App Store Server Notifications V2** apuntando a RevenueCat.
6. Rellenar `RC_IOS_API_KEY` (`src/config/revenuecat.js:13`).
7. Lo de §5.4.

### RevenueCat

1. Un proyecto, **dos apps** (iOS + Android) → dos claves públicas.
2. Importar los 4 productos (2 por plataforma).
3. Un **Offering** (`default`) con dos **Packages**: `$rc_annual` y
   `$rc_lifetime` — RevenueCat tiene identificadores nativos para estos dos
   casos exactos.
4. Los 4 productos apuntando **al mismo entitlement**.
5. **Restore Behavior → transferir al nuevo App User ID** (§3.3).

---

## 8. Decisiones tomadas

| Decisión | Motivo |
|---|---|
| Límite por conteo **actual**, no histórico | un contador persistido hay que migrar, respaldar y explicar |
| Al caducar: **congelar la sincronización, no borrar** | borrar datos de quien pagó es la vía rápida a la reseña de una estrella |
| Los 2 activos **los elige el entrenador**, no la antigüedad | los 2 clientes más antiguos de un entrenador con 10 suelen ser los que ya no entrena |
| El contador de entrenos pendientes **sigue subiendo** en los congelados | enseña el valor exacto de volver a pagar sin regalarlo, y ya está calculado |
| Al cliente no se le avisa de nada | *"tu entrenador ha dejado de pagar"* no beneficia a nadie |
| `trainerSync.userId` como App User ID | es el único id estable que sobrevive a reinstalar, y ya existe |
| Cuenta por código automática tras comprar sin cuenta | un toque, sin correo; la pantalla `code_reveal` ya existe y ya dice lo correcto |
| Los dos productos visibles siempre | perder conversión duele más que una línea de copy sobre cancelar |
| Renombrar el entitlement, si se hace, **ahora** | no hay compradores; después habría que migrarlos |

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
| **1** | Freemium 2+2 + congelado por cliente + hoja de elección | 2-3 días | — |
| **2** | Paywall dual + i18n + enlaces legales | ½ día | productos creados |
| **3** | Invitar cliente nivel 1 + página estática | 1 día | — |

Total de app: **~4 días**. El camino crítico real no es el código: es el
contrato de Apps de Pago de Apple, que es tiempo de espera puro. Empezarlo antes
que nada.
