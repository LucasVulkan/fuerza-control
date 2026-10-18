# Spec — Límites que se explican y fallos de pago con salida

> Tema: monetización
> En corto: Al topar con un límite del plan gratis ya no salta el paywall de golpe: primero una hoja dice qué límite es («3 de 3 clientes»), qué puedes hacer sin pagar y, como opción, hacerte PRO; y cuando una compra falla, la app dice si te han cobrado y qué hacer, en vez de enseñar el error de la tienda en inglés.
> Fase M04-01 · pendiente · Maqueta de la hoja de límite · §3
> Fase M04-02 · pendiente · Hoja de límite antes del paywall · §4
> Fase M04-03 · pendiente · Errores de compra y restauración con siguiente paso · §5
>
> Estado: **spec escrita, sin implementar** (18-oct-2026). Sale del análisis
> «qué hace que la app se sienta premium»: los peores momentos (un límite, un
> pago que falla) son donde más confianza se gana o se pierde. M04-01 es
> diseño: la hoja se maqueta antes de implementarla.

---

## 1. Por qué

### 1.1 El límite salta directo al paywall

Toda acción bloqueada por el plan gratis llama a `_paywall(reason)`
(`store/useStore.js`, ~l. 859), que guarda `ui.paywallReason`, y
`GlobalPaywall` (`src/navigation/RootNavigator.jsx`) abre `PaywallModal`. Dos
problemas:

- **No se explica nada antes**: el usuario pulsa «Nuevo cliente» y le sale una
  pantalla de venta. No sabe qué límite ha tocado, cuántos lleva ni si tiene
  otra salida.
- **El paywall no sabe el motivo**: `GlobalPaywall` lee `reason` pero monta
  `<PaywallModal onClose={close} />` sin pasárselo. Sale igual se toque lo que
  se toque.

Motivos que existen hoy (`src/utils/freePlan.js`, `FREE = { clients: 3,
connected: 1, programTemplates: 1, sessionTemplates: 1 }`):

| `reason` | Cuándo | Contador |
|---|---|---|
| `clients` | crear un cliente pasando de 3 | `n de 3 clientes` |
| `connected` | conectar un segundo cliente con la app | `n de 1 con la app` |
| `programTemplates` | crear una plantilla de programa pasando de 1 | `n de 1 plantilla de programa` |
| `sessionTemplates` | crear una plantilla de sesión pasando de 1 | `n de 1 plantilla de sesión` |
| `frozen` | tocar algo de un cliente que se quedó fuera del plan | — (cliente congelado) |

### 1.2 Los fallos de compra enseñan el error crudo

`purchasePackage` (`store/useStore.js`, ~l. 4999) trata bien la cancelación y
«ya comprado», pero en cualquier otro caso devuelve `e?.message`: el texto de
RevenueCat o de la tienda, normalmente en inglés y técnico, en un diálogo
«No se pudo completar la compra». No dice si se ha cobrado ni qué hacer.
`restorePurchases` enseña «Error al restaurar la compra» sin más.

## 2. Decisiones cerradas con el usuario (18-oct-2026)

- Entre la acción bloqueada y el paywall va **una hoja de límite**: el
  contador (p. ej. «3 de 3»), un texto claro y un CTA «Hazte PRO» (estilo «si
  quieres clientes ilimitados, hazte PRO»).
- Se **maqueta antes** de implementarla (M04-01).

## 3. M04-01 — Maqueta de la hoja de límite

Una maqueta en `docs/mockups/limite-plan.html` con los cinco motivos de §1.1.
Lo que tiene que resolver, como punto de partida:

- **Contador grande**: «3 de 3» en Barlow con una barra o casillas llenas
  (como los medidores de Mi cuenta: `Meter` de `AccountScreen.jsx`).
- **Qué significa**, en una frase y en positivo: «El plan gratis incluye 3
  clientes. Ya los tienes.»
- **Qué puedes hacer sin pagar**, cuando lo hay. Es lo que convierte el muro en
  ayuda:
  - `clients`: archivar o borrar un cliente que ya no entrenas;
  - `connected`: elegir qué cliente va con la app (`FreeClientsSheet`);
  - plantillas: reutilizar o editar la que ya tienes;
  - `frozen`: elegir qué clientes siguen activos (`FreeClientsSheet`).
- **CTA principal**: «Hazte PRO» con lo que da para este motivo («Clientes
  ilimitados»), que abre el paywall **ya con el motivo** (§4).
- **Secundario**: «Ahora no».

Ronda de diseño con el usuario; al cerrarla se apunta aquí lo decidido y se
pasa a M04-02.

## 4. M04-02 — Hoja de límite antes del paywall

- `_paywall(reason)` deja de abrir el paywall: abre la hoja de límite
  (`ui.limitReason`). Desde la hoja, «Hazte PRO» abre el paywall con
  `ui.paywallReason`. El resto de puntos que abren el paywall a propósito (Mi
  cuenta, onboarding, «Hazte PRO» del menú) siguen yendo directos.
- `GlobalPaywall` **pasa el motivo** a `PaywallModal` (`reason` prop), y el
  paywall pone primero la ventaja que corresponde (`features.clients`,
  `features.connected`, `features.templates`).
- Las cifras salen de las mismas funciones que deciden el límite
  (`templateCounts`, `isConnected`, `FREE`): la hoja no puede decir «3 de 3» si
  el límite real es otro.
- Textos en `es.json` y `en.json`, con plurales.

**Probar M04-02**

- [ ] Plan gratis con 3 clientes → Nuevo cliente → sale la hoja «3 de 3 clientes» con lo que puedes hacer; «Ahora no» la cierra y no se crea nada
- [ ] En la hoja → «Hazte PRO» → paywall con «Sin límite de clientes» la primera
- [ ] Conectar un segundo cliente con la app → hoja «1 de 1 con la app» con la opción de elegir cuál
- [ ] Crear una segunda plantilla de programa → hoja de plantillas
- [ ] Tocar un cliente congelado → hoja con la opción de elegir clientes activos
- [ ] «Hazte PRO» desde Mi cuenta → va directo al paywall, sin hoja

## 5. M04-03 — Errores de compra y restauración con siguiente paso

`purchasePackage` y `restorePurchases` dejan de devolver `e.message` y
traducen el código de error de RevenueCat (`e.code`, `PURCHASES_ERROR_CODE`) a
un mensaje propio. Cada mensaje dice **qué ha pasado, si hay cargo y qué
hacer**:

| Código (RevenueCat) | Mensaje (es) | Acción en el diálogo |
|---|---|---|
| `NETWORK_ERROR` | «Sin conexión. No se ha hecho ningún cargo.» | Reintentar |
| `PAYMENT_PENDING_ERROR` | «El pago está pendiente de confirmar. Te activamos PRO en cuanto llegue; no hace falta volver a pagar.» | Entendido |
| `STORE_PROBLEM_ERROR` | «La tienda no responde ahora mismo. No se ha hecho ningún cargo.» | Reintentar |
| `PURCHASE_NOT_ALLOWED_ERROR` | «Este dispositivo o cuenta no permite compras. Revisa las restricciones en {{store}}.» | Entendido |
| `PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR` | «Este plan no está disponible en tu país o cuenta.» | Entendido |
| `RECEIPT_ALREADY_IN_USE_ERROR` | «Esta compra ya está en otra cuenta de la app.» | Restaurar |
| cualquier otro | «No se pudo completar la compra. No se ha hecho ningún cargo.» | Reintentar · Contactar |

- Que el texto diga «No se ha hecho ningún cargo» solo donde es verdad (en los
  fallos antes de cobrar). El implementador comprueba la lista contra la
  documentación de `react-native-purchases` de la versión instalada.
- **Pago pendiente**: el listener de `customerInfo` que ya hay (commit
  `b6eab45`, «el plan sigue a RevenueCat en vivo») activa PRO cuando se
  confirma; al activarse, toast «PRO activado».
- **Restaurar sin compras** («No se encontraron compras anteriores») añade qué
  hacer: «¿Compraste con otra cuenta de {{store}}? Entra con ella y vuelve a
  probar.»
- «Contactar» abre el correo de soporte (el de M02-07).
- `e.message` se sigue mandando al log de depuración, nunca a la pantalla.

**Probar M04-03**

- [ ] Modo avión → comprar → «Sin conexión. No se ha hecho ningún cargo.» con Reintentar; con conexión, Reintentar compra
- [ ] Tarjeta de pruebas que deja el pago pendiente (Google Play) → mensaje de pendiente; al confirmarse, se activa PRO sin volver a pagar
- [ ] Restaurar con una cuenta sin compras → el mensaje dice qué probar
- [ ] En ningún caso sale un texto en inglés de la tienda

## Fases

| Fase | Qué | Depende de | Coste | Estado |
|---|---|---|---|---|
| M04-01 | Maqueta de la hoja de límite | — | 🟢 | pendiente |
| M04-02 | Hoja de límite y motivo en el paywall | M04-01 | 🟡 | pendiente |
| M04-03 | Errores de compra traducidos | — | 🟢 | pendiente |
