# Privacidad — App Store Connect

Respuestas al cuestionario *App Privacy* y a qué corresponden en el código.

Cada respuesta lleva **de dónde sale**, para que cuando alguien cambie el
código se pueda comprobar si esto sigue siendo verdad. El cuestionario es una
declaración con consecuencias legales: revísalo antes de enviarlo, no lo
copies a ciegas.

Última revisión: 2026-10-08 (peso corporal en el historial, RevenueCat con
`logIn` desde M01-01, suscripción anual, región de Supabase).

La política pública que lo cuenta: <https://formafit-pro.github.io/privacidad/>
(inglés en `/privacy/`), repo `formafit-pro.github.io` (spec M02). **Si cambia
esto, cambia también la política.**

---

## Lo primero: ¿rastreas?

**No.**

En `mobile/package.json` no hay ningún SDK de analítica, publicidad, atribución
ni crash reporting: ni Firebase, ni Sentry, ni Facebook, ni AppsFlyer, ni
Amplitude. No se comparte nada con data brokers ni se cruza con datos de otras
apps.

Consecuencia: contestas **"No, we do not use data for tracking"** y la app **no
necesita el permiso de ATT** (`AppTrackingTransparency`). Si algún día se añade
cualquier SDK de esa lista, esto cambia y hay que volver aquí.

---

## Dónde acaban los datos

Tres destinos, y solo el primero es tuyo:

| Destino | Qué recibe | Cuándo |
|---|---|---|
| **Supabase** (backend propio, región **UE**) | Cuenta, programas, historial del alumno | Solo con sincronización activada o alumno conectado |
| **Google Drive del usuario** | Copia completa de sus datos | Solo si activa la copia de seguridad |
| **RevenueCat** (EE. UU.) | Compra y el id de usuario de Supabase del entrenador (M01-01) | Solo al comprar o restaurar Pro |

El caso de Drive tiene una particularidad que conviene entender: se usa el
scope `drive.file` (ver `SCOPES` en `mobile/src/screens/DriveBackupScreen.jsx`),
que da acceso **únicamente a los archivos que la propia app crea**. El archivo
vive en el Drive del usuario y tú no puedes leerlo ni listarlo. No es
almacenamiento tuyo, es suyo.

Aun así se declara la categoría, porque Supabase sí recibe datos de
entrenamiento y ahí no hay matiz posible.

---

## Respuestas del cuestionario

Para todas: **no se usan para rastrear**. Y "vinculado a la identidad" (*Linked
to You*) porque existe una cuenta a la que se atan.

### Contact Info → Email Address
**Sí, se recoge. Vinculado. Uso: App Functionality.**

Solo cuando el entrenador entra con Google o Apple: Supabase guarda el email de
esa cuenta (`loginTrainerWithIdToken`, `mobile/src/services/supabaseAuth.js`).

Dos matices que juegan a tu favor y conviene que estén en la política:
- Con "Ocultar mi correo" de Apple llega una dirección de reenvío, no la real.
- En modo **código personal** no hay email real: se fabrica uno sintético
  (`trainer-{código}@noreply.fuerzacontrol.com`, ver `codeToEmail`) que no
  existe ni recibe correo. Es un modo de uso sin dar ningún dato de contacto.

### Contact Info → Name
**Sí, se recoge. Vinculado. Uso: App Functionality.**

Dos sitios:
- El nombre que el entrenador se pone y que ven sus alumnos (`trainer_name`).
- **El nombre que el entrenador le pone a cada alumno** (`client_name` en
  `createClientSlot`). Es un dato de una tercera persona y por eso se declara,
  aunque sea una etiqueta escrita a mano y no un dato verificado.

### Health & Fitness → Fitness
**Sí, se recoge. Vinculado. Uso: App Functionality.**

El historial de entrenamiento del alumno sube al hueco de su entrenador
(`uploadHistory`). **Qué sube exactamente** está en `scopeFilterForUpload`
(`src/utils/clientLogs.js`): solo las sesiones de los programas de ese
entrenador, más las sesiones libres posteriores al enlace.

**El peso corporal sí sube**: cada entrada del historial guarda el peso de ese
día (`logEntry.bodyWeight`, que copia `profile.bodyWeight` al cerrar la sesión,
y `setSessionFeedback` en el resumen), y el historial viaja entero. Por eso
conviene declarar también **Health & Fitness → Health** (dato de salud que
escribe el usuario), no solo Fitness.

Lo que **no** sube: el nombre del perfil, los objetivos, las respuestas del
onboarding, ni el historial de programas ajenos al entrenador. Eso se queda en
el móvil, y en la copia de Drive si el usuario la activa.

### Identifiers → User ID
**Sí, se recoge. Vinculado. Uso: App Functionality.**

El `user.id` de Supabase. Desde M01-01 **también es el id de RevenueCat** del
entrenador: `App.js` configura con `appUserID = trainerSync.userId` y
`syncPurchaserId` hace `logIn` al cambiar de cuenta, para que el Pro cruce de
un móvil a otro. Sin cuenta (o en el móvil del cliente), RevenueCat usa su id
anónimo. Ninguno es un identificador de publicidad.

### Purchases → Purchase History
**Sí, se recoge. Vinculado. Uso: App Functionality.**

RevenueCat, para saber si tienes Pro: **suscripción anual o pago único**
(M01 §5), los dos sobre el mismo entitlement.

### User Content → Other User Content
**Sí, se recoge. Vinculado. Uso: App Functionality.**

Los programas que escribe el entrenador y las notas de sesión y de ejercicio
que escribe el alumno, que viajan dentro del historial.

### Lo que NO se recoge

Contesta **no** a todo esto, y es verdad hoy:

- Usage Data / Product Interaction — no hay analítica
- Diagnostics / Crash Data — no hay crash reporting
- Location — la app no pide ubicación
- Contacts, Photos, Audio, Browsing History, Search History
- Sensitive Info, Financial Info, Payment Info (el pago lo gestiona Apple; tú
  nunca ves una tarjeta)
- Advertising Data / identificadores de publicidad

---

## Borrado de cuenta

Guideline 5.1.1(v). Está resuelto: **Menú → CUENTA → "Eliminar mi cuenta"**.

En App Store Connect hay que marcar que la app ofrece borrado de cuenta y dar
la ruta. Descríbela tal cual, con esas palabras — el revisor la busca.

Qué hace, por si preguntan (`supabase/functions/delete-account/index.ts`):
borra el usuario de `auth.users`, su perfil, y sus huecos de cliente si es
entrenador. Si es alumno, **suelta** su hueco y borra su historial de él, pero
no destruye la fila: el programa y el código son del entrenador.

---

## Qué falta declarar fuera de este documento

- **Política de privacidad**: publicada en
  <https://formafit-pro.github.io/privacidad/>. Refleja lo de arriba, incluido
  el borrado de cuenta. **Falta un correo de contacto** (M02-07).
- Si publicas fuera de España y Latinoamérica, la política debería estar
  también en inglés.
