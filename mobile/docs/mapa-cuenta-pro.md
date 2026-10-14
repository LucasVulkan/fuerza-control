# Mapa: PRO y cuenta del entrenador

Foto del código a 13-oct-2026 (commit `02ac235`). Responde a tres preguntas:
**qué variables mandan**, **por dónde se entra** y **qué pasa al combinarlas**.
Al final, los huecos encontrados. Es la base para una spec de limpieza; aún no lo es.

---

## 1. Las variables

### PRO

| Variable | Dónde | Quién la escribe | Persiste |
|---|---|---|---|
| `profile.isPro` | store, `INITIAL_PROFILE` (`false`) | `checkProStatus`, `purchasePackage`, `restorePurchases`, `syncPurchaserId` (useStore.js ~4700-4797) · interruptor PRO/FREE del menú (solo `__DEV__`, AppHeader.jsx:555) | sí (AsyncStorage) |
| `profile.freeClientIds` | store | hoja «Con quién sigues» · se vacía sola al pasar a Pro (suscriptor, useStore.js:5156) | sí |
| `ui.paywallReason` | store | `_paywall(reason)` / `closePaywall` | no |
| Entitlement `RC_PRO_ENTITLEMENT` | **RevenueCat** (la verdad) | compras, restaurar, entitlements promocionales del dashboard | servidor |
| App User ID de RevenueCat | RevenueCat | `configure({ appUserID })` al arrancar (App.js:195) · `logIn` / `logOut` | servidor |
| `EXPO_PUBLIC_FORCE_PRO` | env de la build | — | build |

**La regla real:** `isPro` es una copia local del entitlement. Si RevenueCat no
responde (Expo Go, sin red, sin clave), **se queda el último valor guardado**. Por eso
en Expo Go el PRO es lo que diga el interruptor de desarrollo.

### Cuenta del entrenador

| Variable | Valores | Notas |
|---|---|---|
| `trainerSync.mode` | `null` · `'offline'` · `'code'` · `'google'` · `'apple'` | `null` = nunca ha elegido; abre el modal solo en Clientes |
| `trainerSync.code` | `XXXX-XXXX-XXXX` o `null` | solo en modo código; es a la vez usuario y contraseña |
| `trainerSync.userId` | uuid de Supabase o `null` | **es también el App User ID de RevenueCat** |
| `trainerSync.trainerName` | texto | sobrevive a `resetTrainerSync`, no a `deleteAccount` |
| sesión de Supabase | — | `_ensureTrainerSession` la rehace sola con el código; con Google/Apple, error «vuelve a iniciar sesión» |

Las copias de seguridad (`.fitdata`) **no** llevan `trainerSync` ni el PRO (backupPayload.js:17).

---

## 2. Entradas a PRO

| # | Desde | Qué abre | Archivo |
|---|---|---|---|
| P1 | Chapa **FREE** de la cabecera | `PaywallModal` | AppHeader.jsx:532 |
| P2 | Acción que choca con el plan gratis: `clients`, `connected`, `frozen`, `programTemplates`, `sessionTemplates` | `GlobalPaywall` (250 ms de retraso) | RootNavigator.jsx:329 · `_paywall` en el store · `useFreeGates` |
| P3 | Hoja «Con quién sigues» → enlace PRO | `_paywall('frozen')` | FreeClientsSheet.jsx:101 |

Dentro del paywall:

| Acción | Qué hace | Después |
|---|---|---|
| Comprar | `purchasePackage` | con cuenta → cierra · **sin cuenta → «Guarda tu compra»** (`TrainerSyncModal purpose="purchase"`) |
| Restaurar compra | `restorePurchases` (transfiere la compra al ID actual) | si hay PRO, cierra |
| Ya tengo cuenta *(nuevo)* | `TrainerSyncModal initialScreen="recovery"` — solo sin cuenta | si la cuenta trae PRO, cierra |

Fuera del paywall también se gana PRO **sin pulsar nada**: al arrancar (`checkProStatus`)
y al cambiar `trainerSync.userId` (`syncPurchaserId`, App.js:208).

---

## 3. Entradas a la cuenta del entrenador

| # | Desde | Condición | Abre en |
|---|---|---|---|
| A1 | Entrar en **Clientes** | `mode === null` | `select` (o `code_status` si hay código) |
| A2 | Clientes → icono de la cabecera | siempre | ídem |
| A3 | Clientes → tocar un cliente para conectarlo | `mode` null u `offline` | ídem |
| A4 | Menú → «Sincronización con clientes» | **solo si `isPro`** | ídem |
| A5 | Paywall → comprar sin cuenta | `!userId` tras comprar | `select`, sin «Sin conexión», Apple/Google preseleccionado |
| A6 | Paywall → «Ya tengo cuenta» | `!userId` | `recovery` |
| A7 | Onboarding O03 («Ya tengo cuenta», camino del entrenador) | — | **por hacer** (O03-07, O03-08) |

Dentro del modal, cómo se cambia de estado:

```
select ──Google/Apple──▶ loginTrainerWithIdToken ─▶ mode=google|apple, userId
   │                       └ si había código: traspasa los huecos del código viejo
   ├──Crear código──────▶ setupTrainerCodeAccount ─▶ mode=code, code, userId ─▶ code_reveal
   │                       └ si había código: traspasa los huecos del código viejo
   ├──Sin conexión──────▶ signOut de Supabase ─▶ mode=offline, userId=null   (RevenueCat NO sale)
   └──Recuperar─▶ recovery ─▶ recoverWithTrainerCode ─▶ mode=code, code, userId   (sin traspaso, sin refrescar huecos)

code_status ──Reconectar──▶ recoverWithTrainerCode + refreshTrainerSlots
Menú ▸ Borrar cuenta ──▶ borra en servidor + signOut + logOut de RevenueCat ─▶ mode=offline, clientes fuera
```

---

## 4. Cruces cuenta × PRO

| Situación | Qué pasa hoy | ¿Bien? |
|---|---|---|
| Compra sin cuenta, luego crea cuenta | RevenueCat funde anónimo → cuenta | ✅ |
| Compra con cuenta, reinstala, recupera con código | `logIn` trae el PRO | ✅ |
| Compra en Android, entra en iPhone con la misma cuenta | `logIn` trae el PRO | ✅ |
| Cuenta A (PRO) → **cambia** a cuenta B | `syncPurchaserId(switched)` restaura y mueve la compra a B | ✅ (por diseño, M01 §3.4) |
| Cuenta A (PRO) → **Sin conexión** → cuenta B | al pasar por `offline` el id previo queda `null`, `switched=false`, no se restaura: **B entra sin PRO** aunque la tienda tenga la compra | ⚠️ a comprobar; «Restaurar» lo arregla |
| Cuenta A (PRO) → Sin conexión | sigue PRO (RevenueCat no hace `logOut`) | ✅ por diseño |
| Borrar cuenta | `logOut` → PRO fuera; vuelve con «Restaurar» | ✅ por diseño (M01 §3.3) |
| ¿Dos cuentas con PRO a la vez? | No, si el dashboard tiene **Restore Behavior = Transfer** (guía de pagos R7): restaurar *mueve* la compra, A la pierde al pasar a B. Nada de Supabase interviene; `transfer_my_slots_to` solo mueve clientes. Sin verificar: casilla M01-01.4 sin marcar | ⚠️ comprobar el ajuste |
| Revisor de la tienda | paywall → Ya tengo cuenta → código demo con entitlement promocional | ✅ desde `02ac235` |

---

## 5. Huecos encontrados

1. **Textos sin traducir.** Los toasts de `restorePurchases` están escritos en castellano en
   el store («Compra restaurada», «No se encontraron compras anteriores», «Error al
   restaurar compras», useStore.js:4791-4794), y también los errores de `purchasePackage`.
   En inglés salen en castellano.
2. **«Sincronización con clientes» solo con PRO (A4)**, pero el plan gratis permite 1
   cliente conectado, que necesita cuenta. Un usuario gratis solo puede llegar desde Clientes.
3. **Recuperar no refresca los huecos** (`handleRecover`), mientras que reconectar y el
   login social sí lo hacen. Depende de que Clientes los refresque al entrar.
4. **Recuperar no traspasa los huecos** de un código anterior (crear código y el login
   social sí). Hoy apenas importa porque A6 solo sale sin cuenta, pero A1-A4 permiten
   recuperar con otra cuenta ya puesta.
5. **El caso A → Sin conexión → B** del §4.
6. **Tres fuentes de «es PRO» en desarrollo** (interruptor, `FORCE_PRO`, valor guardado),
   y ninguna indica cuál está mandando.
7. **Dos sitios deciden a quién pertenece la compra**: el `configure` de App.js al arrancar
   y el efecto que llama a `syncPurchaserId`. La lógica está bien, pero no está en un solo sitio.
8. **«Cuenta» se dice de cuatro formas** en la interfaz: Sincronización, código personal,
   Guarda tu compra y Ya tengo cuenta. Son el mismo concepto.

---

## 6. Siguiente paso propuesto

Antes de tocar código, decidir el **modelo**:

- ¿La «cuenta» deja de llamarse «sincronización» y pasa a ser **una sola cosa** (Mi cuenta),
  con un solo sitio fijo en el menú, visible con y sin PRO?
- ¿«Sin conexión» debe seguir existiendo como modo, o ser simplemente «no tener cuenta»?
- ¿Un solo punto en el código (`accountService` o una porción del store) que haga
  `entrar(cuenta)` / `salir()` y se encargue de Supabase + RevenueCat + huecos, en lugar
  de repartirlo entre el modal, App.js y el store?

Con esas tres respuestas sale la spec (tema **M**, junto a M01).
