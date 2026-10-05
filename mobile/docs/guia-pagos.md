# Guía — Montar los pagos: App Store, Google Play y RevenueCat

Tarea **M01-05** de [M01-monetizacion.md](specs/M01-monetizacion.md). No es código:
es configuración en tres paneles web. Escrita el 5-oct-2026; los menús de Apple y
Google cambian de nombre cada poco, así que si algo no está donde dice, buscar
por el nombre de la pieza (p. ej. «In-App Purchase key»).

Lo que se vende: **Pro anual** (suscripción que se renueva sola) y **Pro de por
vida** (pago único). Los dos dan exactamente lo mismo: el entitlement `Forma - Fit Pro` (en esta guía, «Pro»).

---

## 0. El mapa: quién habla con quién

```
                 ① ¿qué vendo? / compra / ¿tiene Pro?
      App  ─────────────────────────────────────────►  RevenueCat
       │            (clave PÚBLICA appl_… / goog_…)        │   ▲
       │                                                   │   │
       │ ② se abre la hoja de pago                ③ valida │   │ ④ avisos de servidor:
       │    NATIVA (Face ID, tarjeta)        el recibo con │   │    renovó, canceló,
       ▼                                     la clave .p8  │   │    reembolso, cobro fallido
  Apple / Google  ◄────────────────────────────────────────┘   │
       └───────────────────────────────────────────────────────┘
```

1. La app pide a RevenueCat la **oferta** (los dos productos con su precio en la
   moneda del usuario).
2. Al pulsar comprar, el SDK abre la hoja **de Apple o Google**. La app nunca ve
   la tarjeta; el cobro, los impuestos y las facturas son cosa de la store.
3. La store devuelve un recibo; el SDK se lo pasa a RevenueCat, que lo **valida
   con Apple/Google** usando las credenciales secretas que le subes tú (pasos A7,
   G5). Responde a la app: «tiene Pro».
4. Todo lo que pasa después —renovar cada año, cancelar, reembolsar, fallar la
   tarjeta— lo avisa la store **directamente a RevenueCat** (pasos R3, G6), sin
   la app. La app se entera la próxima vez que pregunta.

El dinero va de la store a tu banco (una vez al mes, menos su 15 %). RevenueCat
no toca el dinero; cobra aparte cuando pasas de cierto volumen.

### Las claves y dónde vive cada una

| Clave | Quién la genera | Dónde se pone | ¿Secreta? |
|---|---|---|---|
| `appl_…` / `goog_…` | RevenueCat | `src/config/revenuecat.js` (en la app) | **No**, va dentro de la app |
| `.p8` In-App Purchase key | App Store Connect | RevenueCat, app iOS | **Sí**, solo en RevenueCat |
| `.p8` App Store Connect API key | App Store Connect | RevenueCat, app iOS (opcional) | **Sí** |
| JSON de service account | Google Cloud | RevenueCat, app Android | **Sí**. **No** es `google-service-account.json` de `eas submit` |

Ninguna clave secreta entra en el repositorio.

---

## 1. El orden

```
Día 1   A1 cuenta de desarrollador ─► A2 contrato y banco (espera de días) ─┐
        G1 comprobar perfil de pagos de Google                              │
                                                                            │
Mientras se espera:                                                         │
        A3-A6 app y productos en Apple (se quedan en «Missing Metadata»)    │
        G2-G4 productos en Google                                           │
        R1-R7 RevenueCat                                                    │
                                                                            ▼
Cuando A2 está «Active»:  los productos de Apple pasan a «Ready to Submit»
                          → la app ya ve la oferta en sandbox → T (probar)
```

**Empezar por A2.** Es lo único que no depende de ti: Apple tarda días en
validar banco e impuestos, y hasta entonces la oferta de iOS llega **vacía sin
ningún error** (el paywall enseña «Forma Pro próximamente»).

---

## A. Apple

### A1. Apple Developer Program

[developer.apple.com/programs](https://developer.apple.com/programs) → Enroll.
99 $/año.
- **Individual**: en la App Store sale tu nombre como vendedor.
- **Organización**: sale el nombre de la empresa, pero pide número D-U-N-S y
  tarda más.

Saltar si ya tienes cuenta.

### A2. Contrato, impuestos y banco — EMPEZAR AQUÍ

App Store Connect → **Business** (antes «Agreements, Tax, and Banking»):
1. **Paid Apps Agreement** → aceptar.
2. **Tax** → formularios fiscales. Desde España, persona física: **W-8BEN**,
   marcando el convenio España–EE. UU. (retención reducida).
3. **Banking** → IBAN. Esperar a que el estado sea **Clear** / **Active**.

Y además, una vez: pedir el **App Store Small Business Program**
([developer.apple.com/app-store/small-business-program](https://developer.apple.com/app-store/small-business-program/)).
Baja la comisión del 30 % al 15 %. No es automático.

### A3. El identificador de la app

Bundle id: `com.formastudio.formafit` (está en `app.json`).

La primera vez que corras `eas build -p ios`, EAS te pide iniciar sesión con tu
Apple ID y **crea solo** el identificador, los certificados y los perfiles.
La capacidad *In-App Purchase* viene activada por defecto. No hace falta tocar
*Certificates, Identifiers & Profiles* a mano.

### A4. La app en App Store Connect

App Store Connect → **Apps** → **+** → **New App**:
- Platform: iOS.
- Name: «Forma Fit» (tiene que estar libre en toda la App Store).
- Primary language: Spanish (Spain).
- Bundle ID: el de A3 (aparece en el desplegable si A3 ya está hecho).
- SKU: lo que quieras, interno (`formafit`).

### A5. La suscripción anual

Dentro de la app → **Subscriptions** (barra lateral, sección Monetization):
1. **+** Subscription Group → Reference name `Forma Pro`.
   - Las suscripciones del mismo grupo se excluyen entre sí. Si algún día hay
     mensual, va en este mismo grupo y Apple gestiona el cambio.
2. Dentro del grupo, **+** →
   - Reference name: `Pro anual` (interno).
   - **Product ID: `forma_pro_annual`**.
   - Duration: **1 year**.
3. **Subscription Prices** → país base España, precio. Apple convierte al resto
   de países (se puede retocar país a país).
4. **Localization** → español e inglés: display name («Forma Pro») y descripción.
5. **Review Information** → una captura del paywall + nota para el revisor
   («Pro desbloquea clientes ilimitados…»).
6. Volver al grupo → **Localization del grupo** (nombre que ve el usuario en
   Ajustes → Suscripciones).

⚠️ **Un Product ID no se puede reutilizar nunca**, ni borrando el producto.
Escribirlo bien a la primera.

### A6. El pago único

Dentro de la app → **In-App Purchases** → **+** → tipo **Non-Consumable**.
(Non-consumable es el que se restaura; un consumible se gasta y no.)
- Reference name: `Pro de por vida`.
- **Product ID: `forma_pro_lifetime`**.
- Precio, localización es/en, captura y nota, igual que en A5.

Precio: unas **2,5–3 veces el anual**. Si está más cerca, nadie compra la
suscripción.

### A7. Las claves para RevenueCat

App Store Connect → **Users and Access** → **Integrations**:
1. **In-App Purchase** → *Generate In-App Purchase Key* → nombre «RevenueCat».
   **Descargar el `.p8` en ese momento: solo se puede descargar una vez.**
   Apuntar el **Key ID** y el **Issuer ID** (sale arriba en la misma página).
2. *(Opcional, recomendado)* **App Store Connect API** → Team Keys → **+** →
   rol *App Manager*. Otro `.p8` con su Key ID. Con esta, RevenueCat importa
   los productos solo y configura los avisos de R3 con un botón.

Guardar los `.p8` fuera del repositorio (un gestor de contraseñas).

### A8. Periodo de gracia

Dentro de la app → Subscriptions → **Billing Grace Period** → activar.
Si falla el cobro de la renovación, Apple reintenta y el usuario **sigue con
Pro** mientras tanto. Sin código: RevenueCat mantiene el entitlement activo.
Ver M01 §4.9.

### A9. Usuario de pruebas (sandbox)

**Users and Access** → **Sandbox** → **Test Accounts** → **+**.
- Correo que **no** sea un Apple ID existente. Vale un alias:
  `tucorreo+sandbox1@gmail.com`.
- En el iPhone: **Ajustes → App Store → Cuenta de sandbox** (abajo del todo).
  Al comprar en un build de TestFlight o de desarrollo, se cobra a esa cuenta,
  gratis.

En sandbox **1 año dura 1 hora**: la caducidad y el congelado se prueban en una
tarde.

### A10. Antes de mandar a revisión

- La **primera** suscripción y la primera compra se revisan **junto con una
  versión de la app**: en la página de la versión, sección *In-App Purchases
  and Subscriptions*, marcarlas.
- App Information → **Privacy Policy URL** (M01 §5.5: hoy no hay ninguna).
- El paywall tiene que cumplir M01 §5.4: enlaces a EULA y privacidad, y precio,
  periodo y renovación visibles.
- La descripción de la ficha menciona la suscripción y que se renueva sola.

---

## R. RevenueCat

Ya hay proyecto y app Android (la clave `goog_…` está en el código).

### R1. La app iOS

[app.revenuecat.com](https://app.revenuecat.com) → el proyecto → **Apps** →
**+ New** → **App Store**:
- Bundle ID: `com.formastudio.formafit`.
- Pestaña **In-app purchase key configuration** → subir el `.p8` de A7.1 +
  Issuer ID.
- *(Si hiciste A7.2)* App Store Connect API → subir ese `.p8`, Key ID e Issuer
  ID.

### R2. La clave pública

En esa app iOS → **API keys** → la pública empieza por `appl_`. Va a
`RC_IOS_API_KEY` en `src/config/revenuecat.js`. Es un cambio de código (fase
M01-01), pero se apunta aquí.

### R3. Avisos de Apple → RevenueCat

En la página de la app iOS, sección **Apple Server to Server notification
settings**:
- Con A7.2 hecho: botón **Apply in App Store Connect**, y listo.
- Sin él: copiar la URL → App Store Connect → la app → **App Information** →
  **App Store Server Notifications** → pegarla en **Production** y **Sandbox**.
  **Version 2**.

### R4. Productos

**Product catalog → Products**:
- iOS: **Import** (con A7.2) o **+ New** escribiendo `forma_pro_annual` y
  `forma_pro_lifetime` exactamente igual.
- Android: los de G2 y G3. La suscripción de Google aparece como
  `forma_pro:annual` (producto:plan base).

### R5. El entitlement `Forma - Fit Pro`

**Product catalog → Entitlements** → el que ya existe, `Forma - Fit Pro` → **Attach**
los productos nuevos para que estén los cuatro (2 iOS + 2 Android). No se crea
otro: el código ya lo busca por ese nombre (`RC_PRO_ENTITLEMENT`).

### R6. La oferta

**Product catalog → Offerings** → **+ New** → identifier `default` → marcarla
como **Current**. Dentro, dos packages:

| Package | Producto iOS | Producto Android |
|---|---|---|
| `$rc_annual` (Annual) | `forma_pro_annual` | `forma_pro:annual` |
| `$rc_lifetime` (Lifetime) | `forma_pro_lifetime` | `forma_pro_lifetime` |

Es lo que pinta el paywall: `getOfferings()` devuelve la *Current*, y la app
recorre sus paquetes. Si mañana se cambia de precio o se añade una opción, se
cambia aquí sin publicar versión.

### R7. Restore behavior

**Project settings** → **Restore Behavior** → **Transfer to new App User ID**.
Si una compra aparece en otra cuenta de la app (cambiar de código a Google),
se mueve a la nueva. Ver M01 §3.3–3.4.

### R8. Dar Pro a mano (testers, colaboradores)

**Customers** → buscar al usuario (por su App User ID, que tras la fase M01-01
es su `trainerSync.userId`) → **Grant entitlement** → `Forma - Fit Pro` → duración. Sin
pasar por la store y sin código.

---

## G. Google Play

Ya hay app en track interno y algún producto (el pago único actual). Comprobar
cada paso en vez de rehacerlo.

### G1. Perfil de pagos

Play Console → **Setup → Payments profile**. Si ya vendes el pago único, existe.
Las suscripciones ya pagan el 15 % a Google sin pedir nada. Para que el pago
único también vaya al 15 % (en el primer millón al año) hay que inscribirse una
vez en el programa de comisión del 15 % desde la Play Console.

### G2. La suscripción anual

Play Console → la app → **Monetize with Play → Products → Subscriptions** →
**Create subscription**:
- **Product ID: `forma_pro`**, nombre «Forma Pro».
- **Add base plan** → id **`annual`** → *Auto-renewing*, periodo **1 year** →
  precios → **Activate**.

En Google un producto de suscripción tiene planes base dentro: si algún día hay
mensual, es otro plan base (`monthly`) del mismo `forma_pro`.

### G3. El pago único

**Monetize with Play → Products → One-time products** (antes «In-app
products»). Si el actual ya existe con otro id, **se usa ese** y se apunta en
M01 §7. Si no: `forma_pro_lifetime`, precio, activar.

### G4. Periodo de gracia

En el plan base `annual` → **Grace period** (y *Account hold*). Mismo papel que
A8.

### G5. Credenciales para RevenueCat

1. Google Cloud Console (proyecto vinculado a Play) → **IAM → Service
   accounts** → crear una nueva («revenuecat») → **Keys → Add key → JSON** →
   descargar.
2. Play Console → **Users and permissions** → **Invite new users** → el correo
   de esa service account → permisos de app: *View financial data*,
   *Manage orders and subscriptions*.
3. RevenueCat → app Android → **Service account credentials JSON** → subirlo.

Google tarda **hasta 36 h** en dar por buenas unas credenciales nuevas: hasta
entonces RevenueCat dice que no valen aunque estén bien.

### G6. Avisos de Google → RevenueCat

1. RevenueCat → app Android → **Google developer notifications** → *Connect to
   Google* → crea el topic de Pub/Sub. Copiar el nombre del topic.
2. Play Console → **Monetize with Play → Monetization setup** → **Real-time
   developer notifications** → pegar el topic → **Send test notification**.
   RevenueCat debe marcarla como recibida.

Sin esto, las renovaciones y cancelaciones llegan tarde o no llegan.

### G7. Testers

Play Console → **Setup → License testing** → añadir tu Gmail. Con esa cuenta las
compras no se cobran y **1 año dura 30 minutos**. La cuenta además tiene que
estar en el track interno.

---

## T. Probar de punta a punta

1. **Build sin `EXPO_PUBLIC_FORCE_PRO`.** El perfil `preview` de `eas.json` la
   lleva y salta la comprobación entera: ahí no se prueba nada. Usar
   `development` o `production`.
2. iOS: `eas build -p ios` + `eas submit -p ios` → TestFlight (las compras de
   TestFlight van siempre a sandbox).
3. Abrir el paywall: deben salir los dos productos con precio. Si sale «Forma
   Pro próximamente», la oferta llega vacía: casi siempre es A2 sin terminar o
   un Product ID que no coincide.
4. Comprar el anual con la cuenta sandbox / tester.
5. RevenueCat → **Customers** (activar el interruptor *Sandbox data*): el
   cliente aparece con `Forma - Fit Pro` activo.
6. Cancelar en Ajustes → Suscripciones (iOS) o Play Store → Suscripciones
   (Android) y esperar a la caducidad (1 h / 30 min) → la app debe pasar a gratis
   y aplicar M01 §4.5–4.8.
7. Comprar el pago único → Pro sin fecha de caducidad.
8. Desinstalar, reinstalar, **Restaurar** → vuelve el Pro.
