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
   - **Product ID: `formafit_pro_annual`**.
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

**Ya existe: `formafit_pro_permanent`.** No se crea otro; el precio se cambia en
el mismo producto: **In-App Purchases** → el producto → **Price Schedule** →
**Add Pricing** → precio nuevo con inicio **Today**. No pasa revisión. **No
borrarlo**: el Product ID no se podría volver a usar.

Comprobar que su tipo es **Non-Consumable** (es el que se restaura; un
consumible se gasta y no). El tipo no se puede cambiar después: si fuese
consumible, entonces sí habría que crear otro, con un id nuevo.

Para uno nuevo: **In-App Purchases** → **+** → **Non-Consumable**, con precio,
localización es/en, captura y nota, igual que en A5.

Precio: unas **2,5–3 veces el anual**. Si está más cerca, nadie compra la
suscripción.

### A7. Las claves para RevenueCat

App Store Connect → **Users and Access** → **Integrations**:
1. **In-App Purchase** → *Generate In-App Purchase Key* → nombre «RevenueCat».
   **Descargar el `.p8` en ese momento: solo se puede descargar una vez.**
   Se llama `SubscriptionKey_<KEYID>.p8`.
   Apuntar el **Key ID** y el **Issuer ID** (sale arriba en la misma página).
2. *(Opcional, recomendado)* **App Store Connect API** → Team Keys → **+** →
   rol *App Manager*. Otro `.p8` con su Key ID, que se llama
   `AuthKey_<KEYID>.p8`. **Son dos claves distintas y van en dos pestañas
   distintas de RevenueCat** (R1); si se cruzan, RevenueCat dice que el archivo
   no es válido. Con esta, RevenueCat importa
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
- Pestaña **In-app purchase key configuration** → el `SubscriptionKey_….p8`
  de A7.1 + Issuer ID.
- *(Si hiciste A7.2)* Pestaña **App Store Connect API** → el `AuthKey_….p8`,
  Issuer ID y **Vendor number** (App Store Connect → Payments and Financial
  Reports, arriba a la izquierda).

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
- iOS: **Import** (con A7.2) o **+ New** escribiendo `formafit_pro_annual` y
  `formafit_pro_permanent` exactamente igual.
- Android: los de G2 y G3. La suscripción de Google aparece como
  `formafit_pro:annual` (producto:plan base).

### R5. El entitlement `Forma - Fit Pro`

**Product catalog → Entitlements** → el que ya existe, `Forma - Fit Pro` → **Attach**
los productos nuevos para que estén los cuatro (2 iOS + 2 Android). No se crea
otro: el código ya lo busca por ese nombre (`RC_PRO_ENTITLEMENT`).

### R6. La oferta

**Product catalog → Offerings** → **+ New** → identifier `default` → marcarla
como **Current**. Dentro, dos packages:

| Package | Producto iOS | Producto Android |
|---|---|---|
| `$rc_annual` (Annual) | `formafit_pro_annual` | `formafit_pro:annual` |
| `$rc_lifetime` (Lifetime) | `formafit_pro_permanent` | el que ya existe (G3) |

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

### R9. Antes de publicar: que las compras de prueba no den Pro a cualquiera

TestFlight compra **siempre** en sandbox, gratis, y cualquier tester invitado
puede «comprar». RevenueCat no separa usuarios de prueba y de verdad: un mismo
App User ID junta compras de los dos entornos. Desde M01-01 ese id es la cuenta
del entrenador, así que un tester que «compra» el pago único en TestFlight y
luego instala la versión de la App Store con la misma cuenta **tiene Pro gratis
para siempre** (el pago único no caduca).

**Project settings → General → Sandbox access**:
- **Anybody** (por defecto): mientras se prueba.
- **Allowed App User IDs only**, con los ids de las cuentas de prueba propias:
  **antes de publicar**. Los demás pueden pasar por la compra en TestFlight, pero
  no reciben Pro.

Las compras de prueba se siguen registrando; solo dejan de dar Pro. Se arregla
en el panel, sin tocar la app (el SDK de React Native no deja filtrar por
entorno).

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
- **Product ID: `formafit_pro`**, nombre «Forma Pro».
- **Add base plan** → id **`annual`** → *Auto-renewing*, periodo **1 year** →
  precios → **Activate**.

En Google un producto de suscripción tiene planes base dentro: si algún día hay
mensual, es otro plan base (`monthly`) del mismo `formafit_pro`.

### G3. El pago único

**Monetize with Play → Products → One-time products** (antes «In-app
products»). Si el actual ya existe con otro id, **se usa ese** y se apunta en
M01 §7. Si no: `formafit_pro_permanent` (mismo id que en Apple), precio, activar.

### G4. Periodo de gracia

En el plan base `annual` → **Grace period** (y *Account hold*). Mismo papel que
A8.

### G5. Credenciales para RevenueCat

Todo en **el mismo proyecto de Google Cloud** (selector de proyecto, arriba a
la izquierda). Cualquiera vale; Play Console ya no exige vincularlo.

1. **APIs y servicios → Biblioteca** → activar **Google Play Android Developer
   API** y **Google Play Developer Reporting API**.
2. **IAM y administración → Cuentas de servicio → + Crear cuenta de servicio**
   («revenuecat»). En el paso de **roles**, añadir dos: **Pub/Sub Admin** (para
   los avisos de G6; RevenueCat dice *Pub/Sub Editor*, pero con él a veces
   falla) y **Monitoring Viewer**. Terminar. La cuenta tiene que aparecer en la
   lista con su correo `revenuecat@<proyecto>.iam.gserviceaccount.com`; si la
   lista sale vacía, se creó en otro proyecto o no se terminó el asistente.
3. En esa fila, **⋮ → Administrar claves → Agregar clave → Crear clave nueva →
   JSON**. Se descarga sola: guardarla fuera del repositorio.
4. Play Console → **Usuarios y permisos** (de la cuenta, no de la app) →
   **Invitar a nuevos usuarios** → el correo de la cuenta de servicio → en
   **Permisos de la aplicación**, Forma Fit, con: *Ver información de la app y
   descargar informes*, *Ver datos financieros, pedidos y respuestas de
   cancelación*, *Gestionar pedidos y suscripciones* y *Gestionar presencia en
   Play Store*. Invitar (no hace falta que «acepte» nada).
5. RevenueCat → app Android → **Service account credentials JSON** → subirlo.

Google tarda **hasta 36 h** en dar por buenas unas credenciales nuevas: hasta
entonces RevenueCat dice que no valen aunque estén bien. Truco que suele
acelerarlo: cambiar cualquier cosa de la descripción de un producto en
*Monetizar* y guardar.

### G6. Avisos de Google → RevenueCat

Requiere G5 funcionando (credenciales válidas, rol Pub/Sub Admin y la API de
Cloud Pub/Sub activa): es la cuenta de servicio la que crea el topic.

1. RevenueCat → app Android, debajo del JSON de G5 → desplegable **Google
   Cloud Pub/Sub Topic ID** → elegir la opción de **crear uno nuevo** (no hace
   falta tenerlo creado) → **Connect to Google**. Aparece el id del topic
   (`projects/<proyecto>/topics/…`); si no, refrescar. Copiarlo.
   - Si el desplegable sale vacío y sin opción de crear, las credenciales aún
     no valen (las 36 h de G5) o falta el rol de Pub/Sub.
   - A mano, si hace falta: Google Cloud → **Pub/Sub → Temas → Crear tema**;
     en sus **Permisos**, añadir `google-play-developer-notifications@system.gserviceaccount.com`
     con el rol **Publicador de Pub/Sub**; y elegir ese tema en el desplegable.
2. Play Console → la app → **Monetizar con Play → Configuración de la
   monetización** → **Notificaciones para desarrolladores en tiempo real** →
   pegar el id en **Nombre del tema** → en el contenido, **Suscripciones,
   compras anuladas y todos los productos únicos** (si no, el pago único no
   avisa de reembolsos) → guardar → **Enviar notificación de prueba**.
   RevenueCat debe marcarla como recibida.

Sin esto, las renovaciones y cancelaciones llegan tarde o no llegan.

### G7. Testers

Play Console → **Todas las aplicaciones → Configuración (engranaje, abajo del
menú) → License testing** (es de la cuenta, no de la app; no sale dentro del menú
de la app) → añadir tu Gmail. Con esa cuenta las
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
