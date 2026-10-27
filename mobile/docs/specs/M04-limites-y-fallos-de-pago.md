# Spec — Límites que se explican y fallos de pago con salida

> Tema: monetización
> En corto: Al topar con un límite del plan gratis ya no salta el paywall de golpe: primero una hoja dice qué límite has alcanzado («3/3 clientes») y qué da PRO, con «Ahora no» y «Hazte PRO»; y cuando una compra falla, la app dice si te han cobrado y qué hacer, en vez de enseñar el error de la tienda en inglés.
> Inicio: 2026-10-27
> Fin: 2026-10-27
> Fase M04-01 · terminado · Maqueta de la hoja de límite · §3
> Fase M04-02 · hecho · Hoja de límite antes del paywall · §4
> Fase M04-03 · hecho · Errores de compra y restauración con siguiente paso · §5
>
> Estado: **implementada, por probar** (27-oct-2026; spec escrita el 18-oct-2026). Sale del análisis
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

Maqueta en `docs/mockups/limite-plan.html` (v3), cerrada con el usuario el
27-oct-2026. Lo decidido:

- **Hoja alta y centrada**, casi a pantalla completa (a partir de una
  referencia del usuario). En el centro, un bloque: círculo con tinte lima
  (`accent10`) y el icono del motivo a dos colores → etiqueta pastilla en
  Barlow mayúsculas con el contador («3/3 CLIENTES», «1/1 CON LA APP»,
  «1/1 PLANTILLAS», «EN PAUSA») → título → texto. Abajo, los botones.
- **Espacios por niveles**, no todo a la misma distancia: icono → pastilla 24,
  pastilla → título 12, título → texto 8; el bloque se centra en el hueco que
  dejan los botones. En la app, con el `spacing` del tema más cercano.
- **Título** «Límite de … alcanzado», sin «plan gratis»: «Límite de clientes
  alcanzado», «Límite de clientes con la app alcanzado», «Límite de plantillas
  alcanzado». `frozen` usa el de clientes.
- **Texto** «Has alcanzado el límite de **3 clientes** del plan gratis. Hazte
  PRO para añadir más.» (y equivalentes); `frozen`: «**Ana** está fuera de tus 3
  clientes activos. Puedes ver su historial, pero no cambiar nada.»
- **Botones**: «Ahora no» (texto) encima y «Hazte PRO» al fondo, a todo el
  ancho, con la línea de lo que desbloquea **dentro del botón**, debajo
  («Clientes ilimitados», «Todos tus clientes con la app», «Plantillas
  ilimitadas», «Todos tus clientes activos»).
- **Sin acciones secundarias** («Editar mi plantilla» y similares, fuera). Las
  salidas gratis que se pensaron no existen: archivar no libera hueco y la
  elección de clientes activos —y con ella quién va con la app— es fija
  (`lockedClientIds` en `freePlan.js`).
- **Sin degradado** arriba (la referencia lo lleva; en la app se descartó por
  «etéreo», P16 §2).

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

- [ ] Plan gratis con 3 clientes → Nuevo cliente → sale la hoja «Límite de clientes alcanzado» con «3/3 clientes»; «Ahora no» la cierra y no se crea nada
- [ ] En la hoja → «Hazte PRO» → paywall con «Sin límite de clientes» la primera
- [ ] Conectar un segundo cliente con la app → hoja «Límite de clientes con la app alcanzado» con «1/1 con la app»
- [ ] Crear una segunda plantilla de programa → hoja de plantillas
- [ ] Tocar un cliente congelado → hoja «fuera de tus 3 clientes activos» (con el nombre cuando la acción pasa por el store; desde un botón con candado, sin nombre)
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
| M04-01 | Maqueta de la hoja de límite | — | 🟢 | terminado |
| M04-02 | Hoja de límite y motivo en el paywall | M04-01 | 🟡 | hecho |
| M04-03 | Errores de compra traducidos | — | 🟢 | hecho |
