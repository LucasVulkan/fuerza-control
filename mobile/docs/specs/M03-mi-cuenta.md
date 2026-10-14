# Spec — Mi cuenta: una página y una sola puerta para la cuenta del entrenador

> Tema: monetización
> En corto: La cuenta de entrenador y el plan se ven y se gestionan en una página propia («Mi cuenta»), y entrar, cambiar de forma de entrar y salir pasan por un único sitio del código que se encarga de Supabase, de los clientes y del PRO a la vez.
> Fase M03-01 · hecho · Una sola puerta: acciones de cuenta en el store y hook `useTrainerAccount` · §5
> Fase M03-02 · hecho · Página Mi cuenta y su fila en el menú · §6
> Fase M03-03 · hecho · Hoja de entrada simplificada y entradas desde Clientes · §7
> Inicio: 2026-10-14
> Fin: 2026-10-14
>
> Estado: **spec escrita el 14-oct-2026; M03-01 hecha (87c3be8), M03-03 hecha (e204f19), M03-02 hecha (3777486).** Sale del mapa
> [`docs/mapa-cuenta-pro.md`](../mapa-cuenta-pro.md) y de la maqueta
> [`docs/mockups/account.html`](../mockups/account.html), aprobada el 14-oct.
> **M03-01 va antes que O03-08**: O03-08 §24 paso 3 pensaba sacar el mismo hook
> (`src/hooks/useTrainerAccount.js`); aquí se fija su contrato y O03-08 solo lo usa.

---

## 1. Por qué

Hoy la cuenta del entrenador y el PRO están repartidos y no los ve nadie entero
(mapa, §2-§5):

- **Siete entradas** a la cuenta (cuatro en Clientes y el menú, dos en el paywall,
  una en el onboarding) y **cuatro nombres** para lo mismo: «Sincronización con
  clientes», «código personal», «Guarda tu compra», «Ya tengo cuenta».
- **Entrar y salir está en tres sitios**: `TrainerSyncModal` hace el login y el
  traspaso de clientes; un efecto de `App.js` cambia el usuario de RevenueCat al
  ver cambiar `trainerSync.userId`; el store guarda el estado.
- La fila «Sincronización con clientes» del menú **solo sale con PRO**, aunque el
  plan gratis permite un cliente conectado, que necesita cuenta.
- Tres fallos que salen de ese reparto (mapa §5 y revisión del 14-oct):
  - **Pasar de código a Google/Apple no traspasa los clientes en el servidor.**
    `finishSocialLogin` llama a `setTrainerSyncMode(provider, { userId })`, que
    pone `code = null`, y *después* lee el código guardado para el traspaso:
    siempre `null`. Desde `802eb3f` (13-ago). Los clientes siguen en la lista
    (son locales), pero sus huecos siguen siendo de la cuenta del código y
    mandarles programas choca con `trainer_id = auth.uid()`.
  - **A → Sin conexión → B deja a B sin PRO.** Al pasar por *Sin conexión* el id
    anterior queda `null`, el efecto de `App.js` cree que no es un cambio de
    cuenta y no restaura.
  - **Recuperar con código no refresca los clientes** (`handleRecover`), cuando
    reconectar y el login social sí lo hacen.
- No hay ningún sitio donde ver **qué plan tengo** (anual, para siempre, cuándo
  se renueva) ni **cuánto me queda** del plan gratis.

## 2. La maqueta

[`docs/mockups/account.html`](../mockups/account.html) es la referencia visual y
**manda sobre esta spec en todo lo visual**: medidas, colores, orden y tipografía.
Está hecha solo con tokens de la app (`textStyles`, colores y radios de
`formaFit`, `spacing`) y la cabecera es `ScreenHeader`. Se abre en el navegador y
tiene botones para recorrer los estados (sin cuenta / código / Google / Apple ×
Free / PRO anual / PRO para siempre) y las hojas.

Una diferencia con la maqueta, decidida antes por el usuario: **la fila del menú
no lleva avatar** (el `IdentityBlock` actual ya lo dice: «no hay icono de
perfil»). La maqueta lo pinta; en la app no va.

## 3. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Página propia** («Mi cuenta», ruta `Account`), abierta desde **una fila fija arriba del menú**, con o sin PRO | Demasiados estados y acciones para una sección del menú |
| D2 | Dos bloques, en este orden: **Cuenta de entrenador** (con todas sus acciones dentro) y **Plan** (solo las suyas) | Con las acciones de la cuenta debajo del plan, parecían del plan |
| D3 | Cuatro estilos y nada más: `caps` = título · `heading`/`code`/`heroName` = **lo que tengo** · `button` = **lo que puedo hacer** · `body` con barra a la izquierda = **explicación**, una por bloque como mucho | El usuario: en las pantallas de conexión «no se sabe qué es explicación y qué es texto» |
| D4 | **Google y Apple llevan siempre la etiqueta «Recomendado»** (en la página, en «Más opciones» y en la hoja de entrada) | No hay que guardar ningún código |
| D5 | Con código: la tarjeta es **compacta** (código + copiar a la derecha) y fuera solo salen **«Usar Google» (o Apple en iPhone) con Recomendado** y **«Más opciones»**. Las otras formas, salir y borrar van en «Más opciones» | Cinco filas ocupaban demasiado |
| D6 | **«Sin conexión» desaparece de la interfaz**; su papel lo hace **«Salir de la cuenta»**. Por dentro el valor `trainerSync.mode = 'offline'` **se queda** con el mismo significado («sin cuenta, y ya lo decidió»), así que no hay migración | Lo leen 15 sitios (`clientLink`, Clientes, store…); cambiarlo no aporta nada |
| D7 | **«Sincronización con clientes» sale del menú.** La cuenta **es** la sincronización | Cuatro nombres para lo mismo |
| D8 | Las confirmaciones dicen **una sola línea** de por qué, no una tabla de consecuencias | El usuario: «tus clientes pasan a Google» parecía que eran ellos los que se pasaban |
| D9 | **Salir de la cuenta no saca de RevenueCat**: el PRO se queda en el móvil (va con la cuenta de la tienda). Solo **borrar la cuenta** hace `logOut`, como hoy | Ya era así con *Sin conexión*; la compra se recupera con Restaurar en cualquier móvil con esa cuenta de tienda |
| D10 | PRO sin cuenta se presenta como **«Guardado en tu cuenta de Google Play / App Store»**, no como riesgo. Lo que añade la cuenta: llevarlo a la otra plataforma y que vuelva solo | Restaurar lo recupera sin cuenta en la app |
| D11 | **Borrar la cuenta** se muda a la página, dentro de «Más opciones». También lo necesita quien **solo es cliente** (Apple 5.1.1(v)): sin cuenta de entrenador pero con `hasRemoteAccount()`, la página enseña igualmente «Más opciones» con solo «Borrar la cuenta» | `DeleteAccountModal` cubre entrenador **y** cliente; no puede quedar escondido tras el bloque del entrenador |
| D12 | **Una sola puerta**: todo lo que entra, cambia o sale de la cuenta pasa por cuatro acciones del store (§5). Fuera de ellas nadie llama a `supabaseAuth` para entrar/salir, ni a `setTrainerSyncMode`, ni a `syncPurchaserId` | Hoy está en el modal, en `App.js` y en el store |
| D13 | **Una compra nunca queda en dos cuentas**: se apoya en RevenueCat con *Restore Behavior = Transfer to new App User ID* (**confirmado en el dashboard el 14-oct**). Al entrar en B con PRO en el móvil, se restaura y la compra **se mueve** de A a B. Ninguna tabla de Supabase interviene (`transfer_my_slots_to` solo mueve clientes) | El usuario pidió asegurarlo |

## 4. Lo que hay hoy (para quien implemente)

Todo verificado el 14-oct-2026 en `feat/onboarding-caminos`. Los números de
línea se mueven; buscar por nombre.

- **Estado:** `trainerSync = { mode, code, userId, trainerName, lastSeenSessionsCount }`
  (`store/useStore.js`, `mode`: `null | 'offline' | 'code' | 'google' | 'apple'`).
  `profile.isPro` es una copia local del entitlement; si RevenueCat no contesta,
  se queda el último valor.
- **Store:** `setTrainerSyncMode(mode, { code, userId })`, `setTrainerSyncUserId`,
  `setTrainerName`, `resetTrainerSync`, `hasRemoteAccount()`, `deleteAccount()`,
  `refreshTrainerSlots()`, `syncPurchaserId(userId, { switched })`,
  `_purchasesLogOut()`, `checkProStatus()`, `restorePurchases()`, `getOffering()`.
- **`App.js`:** un efecto configura RevenueCat al hidratar con
  `appUserID = trainerSync.userId` (**se queda**). Otro efecto mira
  `trainerSync.userId` con un `useRef` del anterior y llama a
  `syncPurchaserId(id, { switched })` (**se va**, §5.3).
- **`src/services/supabaseAuth.js`:** `setupTrainerCodeAccount()`,
  `recoverWithTrainerCode(code)`, `loginTrainerWithIdToken({ provider, idToken, accessToken })`,
  `signOut()`, `deleteAccount()`. El código es usuario y contraseña a la vez
  (correo sintético `trainer-<código>@noreply.fuerzacontrol.com`).
- **`src/components/TrainerSyncModal.jsx`:** pantallas `select` / `code_status` /
  `code_reveal` / `recovery`; props `visible`, `onClose`, `isFirstTime`,
  `purpose` (`'sync' | 'purchase'`), `initialScreen`. Dentro: el
  `AuthSession.useAuthRequest` de Google y el efecto de su respuesta,
  `handleApple`, `finishSocialLogin` (login + traspaso de clientes desde el
  código anterior + `refreshTrainerSlots`), `doSwitch` (offline / google /
  apple / code con traspaso), `handleReconnect`, `handleRecover`, `NameField`,
  `CodeBox`.
- **Quién abre `TrainerSyncModal`:** `AppHeader` (fila «Sincronización con
  clientes», solo PRO), `ClientsScreen` (primera visita con `mode === null`;
  icono de la cabecera; conectar un cliente sin cuenta), `PaywallModal`
  («Guarda tu compra» con `purpose="purchase"`; «Ya tengo cuenta» con
  `initialScreen="recovery"`), y el onboarding (`screens/onboarding/screens/recover.jsx`).
- **Menú (`AppHeader.jsx`, `SettingsSheet`):** `IdentityBlock` arriba (solo PRO,
  nombre editable), sección CONEXIONES (Mi entrenador · Drive · Sincronización con
  clientes [PRO]), DATOS, PREFERENCIAS, CUENTA (Plan con chapa FREE/PRO →
  paywall · Documentación · Borrar cuenta), DESARROLLO (`__DEV__`).
- **Plan gratis:** `src/utils/freePlan.js` (`FREE`, `templateCounts`,
  `isConnected`, `clientLimitReason`).

## 5. M03-01 — Una sola puerta

**Depende de**: nada. **Va antes que O03-08.** Sin cambios visibles: mismo
comportamiento para el usuario, salvo los dos fallos de §1, que quedan
arreglados.

### 5.1 Las acciones del store

Una sección nueva en `store/useStore.js`, **«CUENTA DE ENTRENADOR»**, junto a
`trainerSync`. Las cuatro acciones son las únicas que cambian de cuenta:

| Acción | Hace | Devuelve |
|---|---|---|
Las tres de entrar empiezan **leyendo `trainerSync` anterior** (`prevCode`,
`prevUserId`) **antes** de tocar nada: `setTrainerSyncMode` pone `code = null`, y
leerlo después es el fallo de §1.

| Acción | Hace | Devuelve |
|---|---|---|
| `enterTrainerAccount({ provider, idToken, accessToken, fullName })` | leer `prevCode`/`prevUserId` → `loginTrainerWithIdToken` → si `fullName` y no hay `trainerName`: `setTrainerName(fullName)` (Apple, solo la primera vez) → `setTrainerSyncMode(provider, { userId })` → si había `prevCode`: entra con él, `transferMySlotsTo(userId)` y vuelve a la sesión social → `refreshTrainerSlots()` → `syncPurchaserId(userId, { switched })` | `{ userId }` |
| `createTrainerCodeAccount()` | leer `prev*` → `signOut` → `setupTrainerCodeAccount()` → `setTrainerSyncMode('code', { code, userId })` → si había `prevCode` distinto: traspaso desde él y vuelta a la nueva → `refreshTrainerSlots()` → `syncPurchaserId(userId, { switched })` | `{ code, userId }` |
| `recoverTrainerAccount(code)` | leer `prev*` → `recoverWithTrainerCode(code)` → `setTrainerSyncMode('code', { code: CÓDIGO_EN_MAYÚSCULAS, userId })` → **`refreshTrainerSlots()`** (fallo de §1) → `syncPurchaserId(userId, { switched })` | `{ userId }` |
| `leaveTrainerAccount()` | `signOut` de Supabase → `setTrainerSyncMode('offline')` (conserva `trainerName`). **No** toca RevenueCat (D9) | — |

Con **`switched = userId !== prevUserId`**, que sustituye al efecto de `App.js`:

- Cambio de cuenta de verdad (A → B, sin cuenta → B y **A → salir → B**, donde
  `prevUserId` es `null`): «el móvil tenía PRO y la cuenta nueva no» restaura y
  RevenueCat **mueve** la compra (D13). Arregla el fallo de §1.
- **Reconectar** con el código guardado (`handleReconnect` →
  `recoverTrainerAccount(trainerSync.code)`) es el mismo usuario: `switched`
  falso, no restaura. Si no, una suscripción caducada llamaría a
  `restorePurchases` y en iOS podría pedir la contraseña del Apple ID sin motivo.

No hace falta una acción privada `_enterPurchases`: es esa línea.

Los errores **se lanzan**, no se tragan: la interfaz los enseña. Los traspasos de
clientes siguen igual que hoy (si fallan, `console.error` y se sigue), porque
ya era así y no es lo que arregla esta spec.

### 5.2 El hook `useTrainerAccount`

`src/hooks/useTrainerAccount.js`. Es **la parte que no puede vivir en el store**:
la petición de Google (`AuthSession.useAuthRequest` es un hook) y la hoja nativa
de Apple. Consigue el `id_token` y llama a las acciones de §5.1; **no importa
nada de `supabaseAuth`**:

```js
const acct = useTrainerAccount();
acct.isExpoGo               // bool: en Expo Go Google no puede (URI no registrable)
acct.loading                // bool: hay una operación en curso
acct.signInWithGoogle()     // Promise<{ userId }>: abre el navegador; resuelve al volver
acct.signInWithApple()      // Promise<{ userId }>
acct.createCode()           // Promise<{ code, userId }>
acct.recover(code)          // Promise<{ userId }>
acct.leave()                // Promise<void>
```

- `signInWithGoogle` hace `await promptAsync()`, que ya **devuelve** la respuesta
  del navegador: sobran el efecto de `googleResponse` y el `googleRequestRef`.
  Si el usuario cancela (Google o Apple), rechaza con `{ cancelled: true }` y
  quien llama no enseña error.
- Apple: lo que hoy hace `apple()`; el `fullName` va a `enterTrainerAccount`.
  Sale `onAppleName`: tras entrar, el modal se cierra y el onboarding termina,
  así que nadie veía ese nombre en pantalla. Disponibilidad de Apple: la
  constante `APPLE_AUTH_AVAILABLE` de siempre, no un campo del hook.
- El hook **no** pinta nada ni cierra nada: devuelve resultados. Cerrar la hoja,
  enseñar el código o navegar es cosa de quien lo usa.
- O03-08 (§24 paso 3) usa este mismo hook en `t_account`; no hay que hacer otro.
- **Ya existe una primera versión** (14-oct, O03-13, commit `3d26ba9`), con
  callbacks en vez de promesas: `useTrainerAccount({ onDone, onError(title,
  message), onAppleName })` → `{ loading, setLoading, isExpoGo, google(), apple(),
  recover(code), createWithCode() }`. La usan `TrainerSyncModal` y las pantallas
  `r_trainer`/`r_code` del onboarding (`screens/onboarding/screens/recover.jsx`).
  M03-01 la **sustituye** por este contrato y adapta esos dos usos.

### 5.3 Lo que se quita

- El **segundo efecto de `App.js`** (el del `prevTrainerUserIdRef`). El primero
  (configurar RevenueCat al hidratar) se queda.
- En `TrainerSyncModal`, toda la lógica de §5.2 y las llamadas directas a
  `supabaseAuth` y a `setTrainerSyncMode`: pasa a usar el hook. Para el usuario
  el modal **no cambia** en esta tarea (lo cambia M03-03).
- `PaywallModal` no cambia: abre `TrainerSyncModal` como hoy.

### 5.4 Tests

En `store/useStore.test.js` (ya mockea RevenueCat para `syncPurchaserId`):

- `enterTrainerAccount` / `createTrainerCodeAccount` / `recoverTrainerAccount`
  llaman a `logIn(userId)`; con `isPro` antes y sin entitlement después, llaman a
  `restorePurchases`; sin `isPro` antes, no.
- **A → `leaveTrainerAccount` → B con PRO en el móvil restaura** (el fallo de §1).
- **Reconectar** (`recoverTrainerAccount` con el mismo código y usuario) con
  `isPro` y sin entitlement **no** llama a `restorePurchases`.
- **Código → Google traspasa:** con un código guardado, `enterTrainerAccount`
  llama a `recoverWithTrainerCode(códigoViejo)` y a `transferMySlotsTo(userIdNuevo)`
  (el fallo de §1).
- `leaveTrainerAccount` no llama a `logOut` y deja `isPro` como estaba;
  `trainerSync` queda `{ mode: 'offline', code: null, userId: null }` con el
  `trainerName` intacto.
- `recoverTrainerAccount` llama a `refreshTrainerSlots`.
- **Frontera** (test nuevo, al estilo de `src/theme.test.js`): ningún archivo de
  `src/` importa `setupTrainerCodeAccount`, `recoverWithTrainerCode` ni
  `loginTrainerWithIdToken`, ni llama a `setTrainerSyncMode(`. Solo `store/`.
  Es lo que impide que vuelva a repartirse.

**Probar M03-01**

- [ ] Con cuenta por código, PRO y un cliente conectado → Menú → Sincronización
  → pasar a Google → sigue con PRO, y **mandar un programa a ese cliente le
  llega** (antes los huecos se quedaban en la cuenta del código).
- [ ] Con cuenta A y PRO → «Sin conexión» → entrar con el código de otra cuenta B
  → B tiene PRO (antes se quedaba sin él). En RevenueCat › Customers, la compra
  está en B y no en A.
- [ ] Reinstalar → «Ya tengo cuenta» en el paywall → código → vuelven los
  clientes **sin** entrar antes en Clientes.
- [ ] Login con Google y cancelar en el navegador → no sale ningún error.
- [ ] Onboarding → «Ya tengo cuenta» → «Mi cuenta de entrenador» con código →
  termina el recorrido como antes.

## 6. M03-02 — Página Mi cuenta y su fila en el menú

**Depende de**: M03-01 (usa el hook y las acciones). Puede ir en paralelo con
M03-03 (archivos distintos salvo los locales).

### 6.1 La ruta

`src/screens/AccountScreen.jsx`, registrada en `RootNavigator.jsx` como
`<Stack.Screen name="Account" …>` junto a `DriveBackup` y `TrainerConnection`.
Cabecera `ScreenHeader` con ceja `t('account.eyebrow')` («AJUSTES») y título
`t('account.title')` («Mi cuenta»), con atrás.

### 6.2 La fila del menú

En `SettingsSheet` (`AppHeader.jsx`), **arriba del todo y siempre** (no solo con
PRO). Sustituye a `IdentityBlock`, que se borra.

- Sin avatar (§2). Una `MenuRow`-like de tarjeta: título `itemTitleQuiet` = el
  `trainerName` o, sin cuenta de entrenador, `t('account.rowTitleNone')` («Mi
  cuenta»); debajo `label` en `mutedLight`: `t('account.rowSubTrainer', { how })`
  («Entrenador · Código personal / Google / Apple») o
  `t('account.rowSubNone')` («Sin cuenta de entrenador»); a la derecha la chapa
  FREE/PRO (la misma de la fila «Plan» actual: `badge` / `badgeMuted` de
  `MenuRow`) y el chevron.
- Al pulsar: cerrar el menú y `navigation.navigate('Account')`.

Y se **quitan** del menú: `IdentityBlock`, la fila «Sincronización con clientes»
(D7), la fila «Plan» de CUENTA y la fila «Borrar cuenta» (D11). En CUENTA queda
«Documentación». «Mi entrenador» (lado cliente) y Drive siguen en CONEXIONES. El
interruptor PRO/FREE de desarrollo se queda.

`DeleteAccountModal` no cambia; ahora lo abre la página.

### 6.3 Bloque «Cuenta de entrenador»

Título de sección `caps` `t('account.sectionTrainer')` («CUENTA DE ENTRENADOR»).

**Con cuenta** (`mode` es `code`, `google` o `apple`):

1. **Tarjeta** (`surface`, radio `lg`, padding `lg`):
   - `caps` en `mutedLight` con el icono de la forma: `t('account.enteredWith', { how })`
     («ENTRAS CON CÓDIGO / GOOGLE / APPLE»).
   - **Código:** el código en `textStyles.code` a **18** (como `codeTextSm` de
     `TrainerSyncModal`), `accent`, una línea; a la derecha un botón de icono de
     40×40 (`surface2`, radio `md`) que copia (`expo-clipboard`) y pasa a ✓ en
     `accent` sobre `tint.accent10` dos segundos. Debajo, explicación (`body`,
     `mutedLight`, barra de 2 px `surface3` a la izquierda):
     `t('account.codeWhy', { social })` — «Código obligatorio para recuperar la
     cuenta de entrenador si cambias de móvil. Se recomienda usar {{social}}.»,
     con `social` = «Google» en Android y «Google o Apple» en iOS.
   - **Google / Apple:** el correo de la sesión en `heading`. De dónde sale: la
     sesión de Supabase (`supabase.auth.getSession()` → `user.email`). Si no hay
     (correo oculto de Apple sin dato), `t('account.emailHidden')`.
2. **Nombre para tus clientes:** campo (`surface`, radio `lg`) con `caps`
   `t('account.nameLabel')` y un `TextInput` en `itemTitleQuiet`, editable ahí
   mismo; al terminar (`onEndEditing`) `setTrainerName`. Borde de 2 px `accent`
   mientras tiene el foco. `maxLength` 40, como el `IdentityBlock` actual.
3. **Grupo de filas** (`surface`, radio `lg`, separador 1 px `surface2`):
   - Solo si `mode === 'code'`: **«Usar Google»** (en iOS, la fila es Apple y
     debajo otra de Google, las dos con la etiqueta) con icono, etiqueta
     **Recomendado** y chevron → hoja de confirmación §6.5.
   - **«Más opciones»** → hoja §6.6.

**Sin cuenta** (`mode` `null` u `'offline'`):

1. Tarjeta: `caps` `t('account.thisPhone')` («ESTE MÓVIL»), `heading` en
   `mutedLight` `t('account.none')` («Sin cuenta»), explicación
   `t('account.noneWhy')` («Todo se guarda solo en este móvil.»), y dos botones
   (`button`, radio `md`): **Crear cuenta** (`accent`) y **Ya tengo cuenta**
   (`surface2`). Abren `TrainerSyncModal` (`initialScreen` `'select'` y
   `'recovery'`).
2. Si `hasRemoteAccount()` (es cliente de alguien): debajo, el grupo con solo
   **«Más opciones»**, cuya hoja tiene solo «Borrar la cuenta» (D11).

### 6.4 Bloque «Plan»

Título `caps` `t('account.sectionPlan')` («PLAN»).

**FREE:** tarjeta `surface`. Arriba `heroName` en mayúsculas «FREE» y, a la
derecha, `label` `mutedLight` `t('account.freeNoExpiry')` («Sin caducidad»).
Debajo, cuatro medidores en dos columnas: `caps` con la cifra `n/máx` en
`labelStrong` y una barra de `máx` segmentos (6 px, `accent` los usados,
`surface3` los libres):

| Medidor | `n` | `máx` |
|---|---|---|
| `t('account.meter.clients')` | clientes totales | `FREE.clients` |
| `t('account.meter.connected')` | clientes con `isConnected` | `FREE.connected` |
| `t('account.meter.programs')` | `templateCounts(...).programTemplates` | `FREE.programTemplates` |
| `t('account.meter.sessions')` | `templateCounts(...).sessionTemplates` | `FREE.sessionTemplates` |

(Las claves de `FREE` y de `templateCounts` son las de `freePlan.js`; si alguna
se llama distinto, se usa la que haya, no se renombra.) Botón **Pasar a PRO**
(`accent`, ancho entero) → `PaywallModal` (estado local, como hacía la fila
«Plan»). Debajo, enlace **Restaurar compra** (`button`, `accent`) →
`restorePurchases()`.

**PRO:** la misma tarjeta con el degradado del panel del paywall
(`accent` → `green`) y todo el texto en `onAccent`. Arriba `heroName` «PRO» y, a
la derecha, `labelStrong`: `t('account.proAnnual', { date })` («Anual · se
renueva el {{date}}»), `t('account.proLifetime')` («Para siempre») o, si es un
entitlement regalado desde RevenueCat, `t('account.proGift')` («Regalado»).
Debajo, chapa `labelStrong` sobre negro al 14 %:

- Con cuenta: `t('account.savedInAccount')` («✓ Guardado en tu cuenta»).
- Sin cuenta: `t('account.savedInStore', { store })` («✓ Guardado en tu cuenta
  de Google Play / App Store») y una explicación
  `t('account.otherPlatformWhy', { other })` («Con una cuenta, también en
  iPhone / Android.»).

Si es anual y hay `managementURL`: botón negro con texto `accent`
`t('account.manage', { store })` («Gestionar en Google Play ↗») →
`Linking.openURL(managementURL)`. Fuera de la tarjeta, **Restaurar compra**.

**De dónde salen los datos del PRO:** una acción nueva y **sin persistir**,
`getProDetails()` en el store, que llama a `getCustomerInfo()` y devuelve
`{ kind: 'annual' | 'lifetime' | 'gift', expiresAt, store, managementURL }`
leyendo `entitlements.active[RC_PRO_ENTITLEMENT]` (`expirationDate` nulo =
para siempre; `store === 'PROMOTIONAL'` = regalo). La página la pide al montar.
Sin módulo nativo (Expo Go) o con error devuelve `null` y la tarjeta PRO enseña
solo «PRO», sin tipo ni gestionar. **No** se guarda en `profile`: el plan se
mira al abrir la página, no hace falta llevarlo encima.

### 6.5 Confirmar cambio de forma

`DragSheet` con título `t('account.useGoogle')` / `useApple` / `useCode`, **una
línea** de explicación (D8) y dos botones apilados:

- A Google / Apple: `t('account.switchSocialWhy', { how })` — «Con {{how}} no
  tendrás que guardar ningún código. Tus clientes y tu PRO siguen contigo.» →
  **Continuar con {{how}}** (`accent`) → `acct.signInWithGoogle()` /
  `signInWithApple()`.
- A código: `t('account.switchCodeWhy')` — «Entrarás con un código de 12
  caracteres. Guárdalo: sin él no podrás recuperar la cuenta.» → **Crear el
  código** → `acct.createCode()` y la hoja pasa a enseñar el código con el mismo
  bloqueo que O03-08 pone en `code_reveal` («Ya lo he guardado» apagado hasta
  Copiar o Enviármelo). Si O03-08 ya sacó ese bloque a un componente, se usa; si
  no, se saca aquí a `src/components/CodeReveal.jsx` y lo usan los dos.
- **Cancelar** (`button` en `mutedLight`, sin fondo).

Mientras `acct.loading`, el botón principal enseña un `ActivityIndicator`. Si
falla: `showDialog` con el mensaje.

### 6.6 Más opciones

`DragSheet` titulado `t('account.more')` («Más opciones»):

1. Grupo con las **formas de entrar que no están fuera** (con cuenta por código,
   las que no sean la recomendada que ya sale fuera; con Google, «Usar un código
   personal» y, en iOS, Apple; con Apple, Google y código). Google y Apple con
   **Recomendado**. Cada una → §6.5.
2. Grupo: **Salir de la cuenta** → confirmación: `t('account.leaveWhy', { back })`
   — «Tus programas se quedan en este móvil y tus clientes dejan de
   sincronizar. Para volver, {{back}}.» (`back` = «necesitarás tu código» o
   «entra con Google / Apple») → botón **Salir** (texto `redText` sobre
   `surface2`) → `acct.leave()`. **Borrar la cuenta** (texto `redText`) →
   `DeleteAccountModal`.

Sin cuenta de entrenador pero con `hasRemoteAccount()`: solo «Borrar la cuenta».

### 6.7 Textos

Todo en `src/locales/es.json` y `en.json`, bajo `account.*`, añadiendo claves
línea a línea (sin reformatear el JSON). Los de arriba son los textos en
castellano; el tono, el de la app (amigable, no coloquial; acciones del usuario en
primera persona). Las claves de `header.*` que dejan de usarse
(`syncSub*`, `clientSyncRow`, `identityRole`, `planRow`, `deleteAccountRow`,
`deleteAccountSub`…) se borran **solo si `grep` confirma que nadie más las usa**.

### 6.8 Movimiento

Como el resto de pantallas: entrada por partes (`Rise` o lo que use
`ProgramScreen` en U14), botones con `scale` al pulsar, hojas con `DragSheet`,
cambios de estado con Reanimated (memoria: nada de `Animated` de RN core en lo
nuevo).

**Probar M03-02**

- [ ] Menú, sin PRO y sin cuenta: arriba sale «Mi cuenta · Sin cuenta de
  entrenador · FREE», sin avatar. Ya no están «Sincronización con clientes»,
  «Plan» ni «Borrar cuenta». La sección de Documentación se llama «SOPORTE».
- [ ] Mi cuenta sin cuenta: tarjeta «SIN CONECTAR» con su explicación y Crear
  cuenta / Ya tengo cuenta; cada uno abre la hoja donde toca.
- [ ] Con código: la tarjeta dice «CONECTADO CON CÓDIGO», el código en una línea;
  copiar → ✓ y se pega bien en otra app. Debajo, «CAMBIAR A» (Google ·
  RECOMENDADO, y Apple en iPhone) y «MÁS OPCIONES». No hay «Más opciones».
- [ ] «CAMBIAR A» → Google → una línea de explicación y el botón blanco de
  Google → la tarjeta pasa a «CONECTADO CON GOOGLE» con el correo; los clientes
  y el PRO siguen. En iPhone, Apple confirma con el botón oficial de Apple.
- [ ] Con Google → «CAMBIAR A» → Código personal → Crear el código → «Ya lo he
  guardado» gris hasta copiar o enviar.
- [ ] Nombre: está en un hueco más oscuro con borde (lima al tocarlo); cambiarlo
  → volver a la página → se ha guardado; un cliente conectado ve el nombre nuevo
  en su próxima sincronización.
- [ ] Desconectar con PRO → aviso de una línea → Desconectar → «SIN CONECTAR», y
  el plan sigue PRO con «Guardado en tu cuenta de Google Play».
- [ ] Solo cliente (conectado con un entrenador, sin cuenta propia) → Mi cuenta →
  sección «BORRAR» → Borrar la cuenta abre el modal de siempre.
- [ ] FREE con 2 clientes y 1 conectado: los medidores dicen 2/3 y 1/1.
- [ ] PRO anual: «Anual · se renueva el …» y «Gestionar en Google Play» abre la
  suscripción en la tienda. Cuenta demo con entitlement regalado: «Regalado», sin
  gestionar.
- [ ] Sin PRO: «Pasar a PRO» abre el paywall y «Restaurar compra» restaura (toast
  de siempre). Con PRO, «Restaurar compra» sigue ahí, fuera de la tarjeta.
- [ ] Clientes (primera vez) o paywall → crear un código personal: «Ya lo he
  guardado» gris hasta Copiar o Enviármelo, igual que en la página.
- [ ] Arrastrar el menú ≡ para cerrarlo: la fila «Mi cuenta» sale con las demás.

## 7. M03-03 — Hoja de entrada simplificada y entradas desde Clientes

**Depende de**: M03-01. En paralelo con M03-02.

### 7.1 `TrainerSyncModal`

Queda como **la hoja para entrar o crear la cuenta**, y nada más:

- **Fuera `code_status`.** Ver el código, copiarlo y reconectar está en la
  página. Si se abre con una cuenta ya puesta, enseña `select` igual (para
  cambiar), sin saltar a `code_status`.
- **Fuera «Sin conexión»** de `MODES` (D6).
- **`select` pasa de lista con radio + botón confirmar a filas que actúan
  directamente**, como la hoja de la maqueta: Google (y Apple en iOS) con
  **Recomendado**, «Crear un código personal», y debajo el enlace «Ya tengo un
  código» → `recovery`. Título `t('sync.createTitle')` («Crea tu cuenta de
  entrenador»), o el de `purpose="purchase"` como hoy.
- El campo del **nombre** se queda en `select` solo si todavía no hay cuenta
  (`!trainerSync.userId`): al crearla es cuando más falta. Con cuenta, el nombre
  se cambia en la página.
- Los avisos largos de `warnFor` y de confirmación de cambio (`sync.switch*`) se
  van: cambiar de forma con cuenta puesta se hace desde la página (§6.5).
- `code_reveal` y `recovery` se quedan, ya con el hook.
- Props que se quedan: `visible`, `onClose`, `isFirstTime`, `purpose`,
  `initialScreen` (`'select' | 'recovery'`). O03 las usa.

### 7.2 Primera visita a Clientes

Hoy se abre sola con `mode === null` y, si se cierra sin elegir, vuelve a abrirse
en cada visita (el «no» era elegir *Sin conexión*). Ahora: **cerrar la hoja de la
primera visita sin crear cuenta pone `mode = 'offline'`** (vía
`leaveTrainerAccount`, que con `mode` nulo solo fija el valor). El botón de cierre
dice `t('sync.notNow')` («Ahora no»).

### 7.3 Clientes

- **Icono de conexión de la cabecera** → `navigation.navigate('Account')` (ya no
  abre la hoja).
- **Conectar un cliente sin cuenta** (`connectLock` → `setShowSyncModal`): sigue
  abriendo la hoja `TrainerSyncModal` ahí mismo, para no sacarle de lo que hacía.
- Primera visita: §7.2.

### 7.4 «Ya tengo cuenta» con Google o Apple: que la cuenta exista

**El problema** (visto el 14-oct): entrar con Google o Apple nunca dice «no
existe». `signInWithIdToken` crea el usuario si no lo hay y
`loginTrainerWithIdToken` le hace la fila de `profiles` con `role: 'trainer'`.
Quien reinstala, va a «Ya tengo cuenta» y elige el Gmail que no era (el
personal en vez del de trabajo) entra **sin aviso** en una cuenta nueva y vacía,
y cree que ha perdido a sus clientes.

**La regla:** desde **«Ya tengo cuenta»** Google y Apple solo **entran**; desde
**«Crear cuenta»** (y al cambiar de forma desde la página, §6.5) siguen
entrando o creando como hoy.

**Dónde está «Ya tengo cuenta» con Google/Apple:**
- La pantalla `recovery` de `TrainerSyncModal` pasa a ser «¿Cómo entrabas?»: el
  campo del código como hoy y, debajo, filas de Google (y Apple en iOS) con
  **Recomendado**. Es la que abren «Ya tengo cuenta» del paywall y de la página.
- El onboarding: `r_trainer` (`screens/onboarding/screens/recover.jsx`), que ya
  tiene Google y Apple.

**Cómo** (de abajo arriba):

1. `loginTrainerWithIdToken({ provider, idToken, accessToken, mustExist })`
   (`supabaseAuth.js`): tras `signInWithIdToken`, **antes** del `upsert`, lee la
   fila propia de `profiles` (`select('role').eq('id', user.id).maybeSingle()`).
   `existed = role === 'trainer'`. Si `mustExist && !existed`: `signOut()` y
   devuelve `{ existed: false }` **sin** hacer el `upsert`. Si no, como hoy, y
   devuelve también `existed`.
   - `profiles` no está en `supabase/*.sql` (se creó en el panel): **comprobar
     en el panel** que la RLS deja a cada usuario leer su propia fila.
     **Comprobado el 14-oct:** política «Users manage their own profile»,
     `ALL` con `auth.uid() = id`; vale. Si no,
     añadir la política `select … using (id = auth.uid())` y guardarla en un
     `.sql` nuevo de `supabase/`.
   - Un cliente que entró con ese Google (`loginClientWithIdToken`) no tiene
     fila de entrenador: cuenta como «no existe», que es lo correcto.
   - ponytail: el usuario de `auth.users` que crea `signInWithIdToken` se queda
     aunque se descarte. Sin fila de `profiles` no pesa ni se ve; si algún día
     estorban, un borrado periódico de usuarios sin perfil.
2. `enterTrainerAccount({ …, mustExist })` (store): si el login devuelve
   `existed: false`, **lanza `{ notFound: true }` sin haber tocado
   `trainerSync`** ni RevenueCat (el login es lo primero que hace, así que basta
   con salir antes del `setTrainerSyncMode`).
3. Hook: `signInWithGoogle({ mustExist })` / `signInWithApple({ mustExist })`.
   Con `notFound`, rechaza con `{ notFound: true, createInstead }`, donde
   `createInstead()` repite `enterTrainerAccount` con **los mismos tokens** y
   `mustExist: false` (reusar el `id_token` ya se hace hoy al volver a la sesión
   social tras el traspaso), sin abrir otra vez Google ni Apple.
4. Interfaz (la hoja y `r_trainer`): con `notFound`, `showDialog` de una línea
   (D8): título `t('sync.notFoundTitle', { how })` — «No hay ninguna cuenta de
   entrenador con este {{how}}» — y dos botones: **Probar con otro**
   (`cancel`, no hace nada: el usuario vuelve a pulsar Google y elige otra
   cuenta, gracias a `prompt: 'select_account'`) y **Crear una nueva** →
   `createInstead()`, y sigue como si hubiera creado la cuenta.

**Tests** (`store/useStore.test.js`): con `mustExist` y
`loginTrainerWithIdToken` → `{ existed: false }`, `enterTrainerAccount` rechaza
con `notFound`, `trainerSync` queda igual y no se llama a `logIn` de
RevenueCat. Sin `mustExist`, entra aunque `existed` sea `false`.

### 7.5 Textos

Los nuevos en `sync.*` (es/en). Los que dejan de usarse (`sync.modeOffline*`,
`sync.ctaOffline`, `sync.switch*`, `sync.status*`, `sync.reauth*`,
`sync.changeModeLink`…) se borran tras `grep`.

**Probar M03-03**

- [ ] Clientes, primera vez: «Conecta con tus clientes», una línea de para qué
  es, «CREA TU CUENTA» con los botones de Apple (iPhone) y Google a juego, «o»,
  «Usar un código personal» con su aviso y el enlace «Ya tengo cuenta». Sin
  campo de nombre ni «Sin conexión».
- [ ] Crear la cuenta con Google → en Mi cuenta el nombre ya viene relleno con el
  de Google.
- [ ] «Ahora no» → volver a Clientes otro día → no vuelve a salir sola.
- [ ] Icono de conexión de Clientes → abre Mi cuenta.
- [ ] Conectar un cliente sin cuenta → la hoja sale en Clientes; al crear la
  cuenta se sigue conectando ese cliente (se abre la hoja de conexión de ese cliente).
- [ ] Paywall → comprar sin cuenta → «Guarda tu compra» con la misma hoja y su
  propia explicación.
- [ ] Paywall → «Ya tengo cuenta» → la hoja se titula «Ya tengo cuenta», con
  Google/Apple y el código.
- [ ] En Android no sale Apple en ningún sitio.
- [ ] Reinstalar → «Ya tengo cuenta» → Google → elegir un Gmail que **nunca** se
  usó en la app → sale «No hay ninguna cuenta de entrenador con este Google».
  «Probar con otro» → Google otra vez → elegir el bueno → vuelven los clientes.
- [ ] Lo mismo, pero «Crear una nueva» → conecta con una cuenta vacía sin volver
  a abrir Google.
- [ ] Onboarding → «Ya tengo cuenta» → «Mi cuenta de entrenador» → Google con un
  Gmail sin cuenta → el mismo aviso.
- [ ] «Crear cuenta» → Google con un Gmail nuevo → crea la cuenta sin preguntar.

## 7b. Ajustes tras la primera revisión (14-oct)

El usuario revisó M03-02 y M03-03 y pidió estos cambios, que **mandan sobre §6,
§7 y la maqueta** donde choquen:

- **Nada de «entrar» ni «salir» para el estado.** Ya estás dentro: la tarjeta
  dice **«CONECTADO CON CÓDIGO / GOOGLE / APPLE»** (estado + elemento), la fila
  del menú «Conectado con …», y la acción es **«Desconectar»** (confirmación con
  `showDialog`, una línea). Sin cuenta: «SIN CONECTAR».
- **Fuera «Más opciones»** (ocultaba acciones tras un grupo sin título). La
  página enseña las acciones en secciones de `MenuList` con título, como el
  resto de la app: **«CAMBIAR A»** (las formas que no son la actual, Google y
  Apple con la chapa RECOMENDADO; el código con su aviso) y **«MÁS OPCIONES»**. Solo cliente: sección «BORRAR».
- **Nombre para los clientes:** tarjeta con un hueco más oscuro (`bg`) y con
  borde, para que se vea que se escribe ahí.
- **Botones de marca:** Apple vuelve al **botón oficial** (`AppleSignInButton`)
  y Google tiene uno a juego (`ui/GoogleSignInButton`: blanco, 44 de alto, el
  mismo radio, la «G» a color). Los usan la hoja de entrada y la confirmación de
  cambiar de forma.
- **Hoja de entrada (`select`):** título «Conecta con tus clientes», una línea
  de para qué sirve la cuenta, «CREA TU CUENTA» con los dos botones de marca,
  una raya con «o» y debajo «Usar un código personal» con su aviso («Guarda el código…», sin «Sin Google ni Apple»). Enlace «Ya
  tengo cuenta». **El campo del nombre sale de la hoja**: el nombre se toma de
  Apple o de Google (`user_metadata` de Supabase) si el entrenador no tenía uno,
  y se cambia en Mi cuenta.
- **«Ya tengo cuenta»** vuelve a ser el título de `recovery` (no «¿Cómo
  entrabas?»): «CON GOOGLE O APPLE» (solo conectan, §7.4), «o», «CON TU CÓDIGO
  PERSONAL».
- Menú: la sección de «Documentación» se llama **«SOPORTE»**.

## 8. Fuera de esta spec

- Los **otros 11 avisos del store escritos a mano** en castellano (exportar,
  importar, compartir, «¡Siguiente serie!»…). No son de la cuenta; van aparte.
- **Cuenta del cliente** («Mi entrenador», `ClientCodeModal`): no cambia.
- **O03-09** (recuperar todo con un solo login): aparcada en O03; cuando se
  retome, entra por `useTrainerAccount`.

## 9. Reparto entre subagentes

| Ola | Tareas | Paralelo | Choques |
|---|---|---|---|
| 1 | M03-01 | sola | toca `TrainerSyncModal`, `App.js`, store: **antes que O03-08** |
| 2 | M03-02 · M03-03 | sí, 2 worktrees | los dos añaden claves a `es.json`/`en.json` (líneas distintas). M03-02 toca `AppHeader`, `RootNavigator` y crea `AccountScreen`; M03-03 toca `TrainerSyncModal`, `ClientsScreen`, `recover.jsx`, el hook, `supabaseAuth.js` y `enterTrainerAccount` del store (M03-02 también toca el store, `getProDetails`: secciones distintas) |

Cada encargo lleva esta spec entera, la maqueta y las reglas de siempre
(`mobile/AGENTS.md`: tokens y `textStyles`, i18n en los dos idiomas, eslint sin
errores nuevos frente a HEAD, `npx vitest run` desde la raíz).

## Fases

| Fase | Qué | Estado |
|---|---|---|
| M03-01 | Acciones del store + `useTrainerAccount`; fuera el efecto de `App.js`; test de frontera | ✅ 87c3be8 — también arregla el traspaso código → Google (§1) |
| M03-02 | `AccountScreen`, fila del menú, `getProDetails` | ✅ 3777486 — la hoja de «Mi cuenta» se queda en una sola `DragSheet` que cambia de contenido; `CodeReveal` y `ui/AccountIcons` salen de `TrainerSyncModal`, que ya usa el bloqueo de «Ya lo he guardado»; la chapa FREE/PRO de la fila del menú es la de la maqueta (PRO en `accent` sólido), no `badge` de `MenuRow` |
| M03-03 | `TrainerSyncModal` simplificado, primera visita, icono de Clientes, «Ya tengo cuenta» con Google/Apple solo entra (§7.4) | ✅ e204f19 — el icono de Clientes navega a `Account`, que crea M03-02; comprobar la RLS de `profiles` |
