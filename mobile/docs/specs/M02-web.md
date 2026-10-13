# Spec — Web pública: privacidad, invitación y landing

> Tema: monetización
> En corto: Una web estática gratis (GitHub Pages) con la política de privacidad que exigen las stores, la página a la que lleva el enlace de invitar cliente y la landing de la app; el dominio propio, más adelante.
> Inicio: 2026-10-08
> Fase M02-01 · hecho · Sitio en GitHub Pages + `/privacidad` · §3
> Fase M02-02 · hecho · Página de invitación `/join` · §4
> Fase M02-03 · pendiente · Landing + soporte · §5
> Fase M02-04 · aparcado · Dominio propio · §6
> Fase M02-05 · aparcado · Enlaces directos a la app (App Links / Universal Links) · §7
> Fase M02-06 · hecho · Consentimiento al conectar, en la app · §10
> Fase M02-07 · pendiente · Correo de contacto en la web · §11
>
> Estado: **M02-01 y M02-02 publicadas** el 8-oct-2026 (repo
> `formafit-pro.github.io`, commit `eb5c32d`). Sin correo de contacto por
> decisión del usuario hasta tener dominio (M02-07). Decidido el 8-oct-2026: GitHub Pages bajo una
> organización `formafit-pro` (`https://formafit-pro.github.io/`, creada por el usuario el
> 8-oct-2026), una sola web para
> las tres cosas, y dominio propio cuando se empiece a promocionar.
>
> Origen: M01 §5.5 (no hay URL de privacidad, y sin ella Apple rechaza) y M01
> §6.2 (la invitación necesita una página https a la que apuntar).
>
> Depende de: nada. **Bloquea a** M01-04 (la app necesita la URL de `/join`) y a
> la revisión de Apple (`PRIVACY_URL` en `src/config/legal.js`, ya apuntado).

---

## 1. Qué es

| Ruta | Para qué | Tarea |
|---|---|---|
| `/privacidad` | URL de privacidad de las dos stores y del paywall | M02-01 |
| `/join?c=CODIGO` | destino del enlace de **Invitar** de la ficha de cliente | M02-02 |
| `/` | landing de la app; vale de URL de marketing | M02-03 |
| `/soporte` | URL de soporte, **obligatoria** en App Store Connect | M02-03 |

Todo HTML + CSS a mano, sin framework ni paso de compilación: son cuatro
páginas que cambian poco. Bilingüe es/en como la app (en la misma página con
`lang` detectado, o `/en/…`; lo que sea más corto al hacerlo).

Estilo: el **«D · pago separado»** del rediseño del paywall (cabecera lima
inclinada, zona con tinte lima, inclinaciones paralelas), con la tipografía y
los colores del tema `formaFit` de la app. Que las cuatro páginas se vean de la
misma familia que el paywall.

---

## 2. Alojamiento

**GitHub Pages, bajo una organización gratis**, en el repo raíz de esa
organización:

- Organización `formafit-pro` → repo
  `formafit-pro.github.io` → la web sale en `https://formafit-pro.github.io/`.
- **Organización y no la cuenta personal**: con la cuenta, la URL lleva
  `lucasvulkan`, y es lo que lee cada cliente en el WhatsApp de la invitación.
- **Repo raíz y no repo de proyecto** (`formafit-pro.github.io/forma`): los ficheros
  de verificación de §7 tienen que estar en la raíz del dominio. Elegirlo ahora
  evita una mudanza que rompería enlaces ya enviados.
- **Repo aparte y público**: Pages gratis exige repo público. El de la app no
  se toca; en el de la web solo hay HTML.
- Fichero **`.nojekyll`** en la raíz desde el día 1: sin él, GitHub ignora las
  carpetas que empiezan por punto (`.well-known`, §7).
- HTTPS: casilla *Enforce HTTPS* en *Settings → Pages*.

Límites de Pages (1 GB, ~100 GB/mes de tráfico): irrelevantes para esto.

El repo está clonado junto a este: `C:\Users\lucas\formafit-pro.github.io`.
Para verlo en local, la configuración `web` de `.claude/launch.json` lo sirve
en `http://localhost:8765` (las rutas son absolutas, `/site.css`, así que
abrir el HTML como fichero no carga el estilo).

---

## 3. M02-01 — Sitio + `/privacidad`

1. Esqueleto del sitio: `index.html` provisional (nombre de la app y
   «Próximamente»), CSS común, `.nojekyll`, favicon con el icono de la app.
2. `/privacidad`: política de privacidad **redactada a partir de
   [`docs/app-store-privacidad.md`](../app-store-privacidad.md)**, que ya dice
   qué datos se recogen, dónde acaban y de qué código sale cada respuesta. No
   inventar nada que no esté ahí. Responsable, contacto (un correo), datos,
   finalidad, terceros (Supabase, RevenueCat, las stores), conservación,
   derechos RGPD y cómo borrar la cuenta.
3. En la app: `PRIVACY_URL` en `src/config/legal.js` apunta a la página. El
   paywall ya enseña el enlace en cuanto deja de ser `null`.
4. En las stores: *App Privacy → Privacy Policy URL* (Apple) y *Contenido de la
   app → Política de privacidad* (Play). Va en
   [guia-pagos.md](../guia-pagos.md), que ya lo tiene como paso.

La política es un texto con consecuencias legales: el usuario la revisa antes
de publicarla, igual que el cuestionario de Apple.

### 3.1 Cómo quedó (8-oct-2026)

- `/privacidad/` y `/privacy/` (inglés), responsable **Lucas Gómez Alonso**.
  Supabase en la **UE**; RevenueCat en EE. UU. (DPF o cláusulas tipo).
- **Sin correo de contacto** (decisión del usuario): los derechos se ejercen
  desde la app (exportar `.fitdata`, eliminar cuenta). El RGPD pide un medio de
  contacto del responsable → M02-07.
- Al redactarla, `app-store-privacidad.md` estaba desfasado y se corrigió: el
  **peso corporal sí sube** con el historial (`logEntry.bodyWeight`),
  RevenueCat usa el id de Supabase desde M01-01 y hay suscripción anual.
- La política dice que el cliente **consiente** compartir sus entrenos al meter
  el código (art. 9.2.a RGPD): la app tiene que decirlo → M02-06.
- `PRIVACY_URL` apuntado en `src/config/legal.js`; el paywall ya enseña el
  enlace.
- Logo: «Forma» a 30 px y FIT a la altura de mayúscula de Inter (0.727 em),
  apoyado en la misma base (flex `baseline`; comprobado al píxel).

**Probar M02-01**

- [x] <https://formafit-pro.github.io/privacidad/> en el móvil: carga con su
  estilo y el enlace «English» lleva a `/privacy/`.
- [x] Paywall → «Privacidad» abre esa página (pide un build con el `legal.js`
  nuevo).
- [x] <https://formafit-pro.github.io/> carga; con el móvil en inglés sale en
  inglés.

---

## 4. M02-02 — Página de invitación `/join`

El enlace que manda el botón **Invitar** (M01-04) es
`https://formafit-pro.github.io/join?c=XK7M-2P4T`. La página lee `c` de la URL con JS
y enseña:

1. Botón grande **«Abrir en Forma Fit»** → `forma://join/XK7M-2P4T`.
2. Los dos botones de store, el del sistema del visitante primero
   (`navigator.userAgent`).
3. **El código, grande y copiable**, con una línea: «Si acabas de instalar la
   app, pégalo al entrar».

**Botón, no redirección automática.** Los navegadores internos de WhatsApp,
Instagram o Gmail suelen bloquear que una página abra un esquema propio
(`forma://`) sin que el usuario toque nada. Un toque del usuario sí lo dejan
pasar. En Android Chrome, el botón puede usar
`intent://join/XK7M-2P4T#Intent;scheme=forma;package=com.formastudio.formafit;S.browser_fallback_url=<Play>;end`,
que si no está la app cae solo en Play.

Sin `c`, o con un `c` que no parece un código: la página sigue sirviendo, sin el
bloque del código.

El contrato con la app es **`forma://join/<código>`**. La parte de la app (la
rama en `App.js`, `pendingInviteCode`, el modal con el código puesto y el
mensaje compartido) es **M01-04**, no esta tarea.

Mientras la app no esté publicada, los botones de store llevan a la ficha
cuando exista; hasta entonces el de Play puede ir al enlace de pruebas internas.

### 4.1 Cómo quedó (8-oct-2026)

Como se describe arriba. El código se valida con el formato de la app
(`XXXX-XXXX`, `generateClientCode`), con o sin guion y en minúsculas. El botón
de App Store sale como «próximamente» (`APP_STORE = null` en la página) hasta
que exista la ficha. En el ordenador, «Abrir en Forma Fit» no sale. El botón
de Play apunta a la ficha pública: hasta publicar, solo la ve quien está en las
pruebas internas.

**Probar M02-02**

- [x] <https://formafit-pro.github.io/join/?c=XK7M2P4T> en Android: sale
  `XK7M-2P4T` y «Copiar código» lo copia.
- [x] Android sin la app: «Abrir en Forma Fit» lleva a Google Play.
- [x] Android con la app: «Abrir en Forma Fit» abre la app (no hace nada más
  hasta M01-04).
- [x] El mismo enlace mandado por WhatsApp y abierto desde el chat: el botón
  funciona dentro del navegador de WhatsApp.
- [x] `/join/` sin código: solo los botones de las stores.

---

## 5. M02-03 — Landing + soporte

### 5.1 Dos modos: Forma Fit y Forma Fit Pro

La landing tiene **dos modos con un interruptor**, y cambiar de modo cambia la
página entera: el texto y el color.

| | **Forma Fit** (por defecto) | **Forma Fit Pro** |
|---|---|---|
| Corte de arriba (nombre + frase) | **negro** | **accent (lima)**, como en el paywall D |
| Frase | *«Gratis, sin anuncios, sin tonterías.»* | *«Conecta con todos tus clientes»* y debajo, más pequeña, *«Una app para entrenarlos a todos»* (las del paywall) |
| Debajo | lo que hace la app gratis | lo que añade Pro: clientes y plantillas sin límite, conexión con cada cliente (cifras de M01 §4) y precio (anual o pago único, M01 §5) |

La estructura es la del paywall **D** en los dos modos (corte de arriba
inclinado, zona inferior con tinte, inclinaciones paralelas); lo único que
distingue los modos es el color del corte y el contenido. En Forma Fit la zona
con tinte es neutra; en Pro, tinte lima como en D.

**El cambio de color se rellena, no salta**, igual que la tarjeta de Inicio en
modo pestañas (U13 §4) y las tarjetas del paywall: un círculo del color nuevo
sale **del interruptor** y crece hasta cubrir el corte (y la página), 450 ms,
*ease-out* cúbico. Si se vuelve a pulsar a medias, el círculo **se recoge**
desde donde iba, no salta. En web: una capa con
`clip-path: circle(r at x y)` animada por transición CSS, con el centro en el
interruptor; el texto cambia a la vez con un fundido corto. Con
`prefers-reduced-motion`, cambio directo.

- El modo va en la URL (`/#pro` o `?pro`), para poder enlazar directamente a
  la página Pro (desde el paywall, desde redes).
- El interruptor es un control de verdad (`role="switch"`, `aria-checked`) y
  se usa con teclado.
- El contenido de los dos modos está en el HTML desde el principio (el modo
  oculto, con `hidden`); el JS solo alterna. Sin JS se ve Forma Fit.

### 5.2 Resto

- Qué es la app, para quién (entrenadores y sus clientes) y botones de store,
  comunes a los dos modos.
- Contenido: capturas reales de la app (las da el usuario) y textos redactados
  desde las specs, que el usuario revisa.
- Insignias de las stores: **las oficiales tal cual**, y solo cuando haya
  ficha publicada (Apple tiene normas de uso). Antes, «Próximamente».
- `/soporte`: correo de contacto y 4-5 preguntas frecuentes (restaurar compras,
  cancelar la suscripción, conectar con el entrenador, borrar la cuenta).

### 5.3 Cómo va (8-oct-2026)

Hecha la landing básica en `index.html`, **sin publicar** todavía:

- Dos capas en la misma celda de una rejilla; la de Pro, encima, recortada
  con `clip-path: circle()` desde el centro del interruptor. La transición CSS
  hace sola lo de U13-02: invertida a medias, se recoge desde donde iba. Al
  terminar, `settled` quita el recorte (lo que queda fuera de la pantalla
  cambia sin verse); al volver se repone el círculo lleno y se recoge.
- Interruptor **fijo** arriba a la derecha (GRATIS · PRO), `role="switch"`.
  La capa inactiva va con `inert` + `aria-hidden`. `#pro` en la URL.
- Sin la pastilla PRO del logo en el modo Pro: chocaba con el interruptor en
  móvil, y el interruptor ya dice PRO.
- Textos del usuario (8-oct): gratis = crear programas, periodización,
  registro rápido; de regalo, métricas; con entrenador, él programa y sigue.
  Pro = clientes sin límite, conexión y sincronización, todos de un vistazo,
  plantillas; «pruébalo antes de pagar» con los límites de M01 §4. **Sin
  precios** (decisión del usuario, 8-oct): cambian en las stores, no aquí.
- **Marca de fondo en el corte**, como en el diseño original del paywall (la
  marca de agua que se quedó fuera, M01 §5.7): grande, horizontal, sin trama y
  cortada por la derecha. En Pro, «PRO» en la Barlow del titular, negro al
  9 %; en Gratis, una mancuerna en lima al 10 %. Detrás del texto. (Se probó
  con trama de puntos tipo serigrafía y el usuario la descartó.)
- «Todos tus clientes de un vistazo» está escrito sin prometer el dashboard
  de C08, que aún no existe.

- **Cuerpo**: Gratis en gris (`#171717`), Pro en **negro puro** (`#000`),
  decidido por el usuario el 8-oct (se probó el tinte lima apagado y el gris).
- Publicada el 8-oct-2026 (repo de la web, `a242511` y siguientes).

Validada como base el 8-oct-2026. Falta:

- **Diseño y sitio de la mancuerna**: lo dará el usuario (la de ahora es
  provisional).
- **Textos**: se reescribirán; los de ahora son un primer paso.
- **Capturas reales** de la app.
- Los botones de store cuando haya fichas (hoy «Próximamente»).

**`/soporte` y `/support`, hechas el 13-oct-2026** (sin publicar): correo
provisional `formastudio.main@gmail.com` para la revisión (se cambia al de
dominio en M02-07; la URL de soporte de App Store Connect no cambia) y 14
preguntas con la ruta exacta en la app, sacada del código. Enlace «Soporte» en
el pie de todas las páginas.

---

## 6. M02-04 — Dominio propio (aparcado)

Hasta que se empiece a promocionar la app (bio de Instagram, decirlo en voz
alta), `formafit-pro.github.io` sirve. Cuando toque:

1. Comprarlo en un registrador (Cloudflare Registrar, Porkbun…) con
   **renovación automática** activada: si caduca, todos los enlaces de
   invitación y la URL de privacidad de las stores mueren, y cualquiera puede
   quedárselo.
2. DNS: los cuatro registros `A` de GitHub Pages en el dominio raíz y un
   `CNAME` de `www` a `formafit-pro.github.io`.
3. *Settings → Pages → Custom domain* con el dominio, y *Enforce HTTPS*.
   GitHub redirige solo desde `formafit-pro.github.io`, así que los enlaces ya
   enviados siguen funcionando.
4. Cambiar la URL en `legal.js`, en el mensaje de Invitar y en las dos stores.
5. Opcional: correo `hola@<dominio>` con reenvío gratis a Gmail (Cloudflare
   Email Routing), para el contacto de privacidad y soporte.

---

## 7. M02-05 — Enlaces directos a la app (aparcado)

Con App Links (Android) y Universal Links (iOS), tocar el enlace https abre la
app directamente si está instalada, sin pasar por la página. Pide:

- `/.well-known/assetlinks.json` (Android, con la huella SHA-256 de la firma de
  Play) y `/.well-known/apple-app-site-association` (iOS) en la raíz del sitio
  — de ahí el repo raíz y el `.nojekyll` de §2.
- `android.intentFilters` con `autoVerify` y `ios.associatedDomains` en
  `app.json`, y rebuild nativo.

Ojo: se verifica contra un dominio. Si se hace antes de M02-04, al pasar al
dominio propio hay que repetirlo y volver a compilar. **Hacerlo después del
dominio.** No hace falta para M01-04: la página de §4 ya cubre el caso.

---

## 8. Decisiones tomadas

| Decisión | Motivo |
|---|---|
| GitHub Pages bajo una organización | gratis, HTTPS, sin el usuario personal en la URL (8-oct-2026) |
| Una sola web para privacidad, invitación y landing | un sitio que mantener; M01 §5.5 ya lo proponía |
| HTML a mano, sin framework | cuatro páginas; un generador es una dependencia más que actualizar |
| Botón en `/join`, no redirección sola | los navegadores internos de las apps bloquean la redirección |
| **Sin Google Analytics** ni nada con cookies | pediría banner de cookies (UE), complicaría la privacidad y rompería el *«no rastreamos»* de `app-store-privacidad.md`. Si hace falta contar visitas: GoatCounter o Cloudflare Web Analytics, sin cookies |
| Dominio propio, después | no bloquea nada; la redirección de GitHub hace la migración gratis |

---

## 9. Trampas

1. **Una URL enviada es para siempre.** No renombrar la organización ni el repo,
   ni mover `/join`, una vez se hayan mandado invitaciones.
2. Sin **`.nojekyll`**, `.well-known` no se publica y la verificación de §7
   falla sin decir por qué.
3. La política de privacidad tiene que **cuadrar con `app-store-privacidad.md`**.
   Si un día se añade un SDK de los que esa página lista, cambian las dos.
4. Las insignias de las stores no se dibujan ni se recolorean.

---

## 10. M02-06 — Consentimiento al conectar (app)

La política (§3.1) apoya el envío de entrenos y peso corporal al entrenador en
el **consentimiento explícito** del cliente (art. 9.2.a RGPD), dado al
conectar. Para que eso se sostenga, la hoja del código (`ClientCodeModal`) lo
dice antes del botón «Conectar», con enlace a la política (`PRIVACY_URL`).
Sin casilla que marcar: conectar, con eso a la vista, es el consentimiento.

### 10.1 Cómo quedó (8-oct-2026)

No hizo falta una línea nueva: el paso de confirmar ya tenía «QUÉ PASA AL
CONECTAR», y su segunda viñeta (`trainer.codeImplies2`) decía solo la mitad.
Ahora: *«Tu entrenador verá las sesiones que completes de sus programas y las
libres a partir de hoy, con el peso que anotes. Puedes desconectarte cuando
quieras.»* (es y en). Debajo de las viñetas, «Privacidad» abre la política.
Rama `feat/invitacion`, con M01-04.

**Probar M02-06**

- [ ] Paso de confirmar del código: la segunda viñeta habla de las sesiones
  libres y del peso, y «Privacidad» abre la política.

---

## 11. M02-07 — Correo de contacto en la web

La web se publicó **sin correo** por decisión del usuario: el que usa para las
cuentas de las stores no debe quedar público, y prefiere el del dominio
(`hola@<dominio>`, M02-04). Cuando exista:

- `/privacidad/` y `/privacy/`: el correo en el apartado 1 y en el 8 (para
  ejercer derechos). El RGPD (art. 13.1.a) pide un medio de contacto del
  responsable.
- Enlace «Contacto» en el pie de las cuatro páginas.
- `/soporte` (M02-03) lo necesita; App Store Connect exige URL de soporte.
