# Spec — Momentos difíciles: sin conexión, errores con salida y estados vacíos

> Tema: ui
> En corto: Cuando algo sale mal o no hay nada que enseñar, la app tiene que decir qué ha pasado y qué hacer: que no hay conexión y que se enviará luego, errores que nombran el siguiente paso y no solo «Error», todos los textos traducidos, y listas vacías que enseñan qué saldrá ahí y cómo empezar.
> Inicio: 2026-10-27
> Fin: 2026-10-27
> Fase U15-01 · hecho · Saber si hay conexión y dejar envíos en cola · §3
> Fase U15-02 · hecho · Errores con siguiente paso y textos sin traducir · §4
> Fase U15-03 · terminado · Maqueta de los estados vacíos · §5
> Fase U15-04 · hecho · Estados vacíos según la maqueta · §5
>
> Estado: **spec escrita, sin implementar** (18-oct-2026). Sale del análisis
> «qué hace que la app se sienta premium»: los peores momentos, bien
> resueltos, dan más confianza que si no hubiera pasado nada. U15-03 es diseño:
> los estados vacíos se maquetan antes de implementarlos (decisión del
> usuario). Los fallos de pago y los límites del plan van aparte, en
> [M04](M04-limites-y-fallos-de-pago.md); el Deshacer al borrar, en
> [P16-07](P16-editor-borrador.md).

---

## 1. Qué hay hoy

- **La app no sabe si hay conexión.** No hay `@react-native-community/netinfo`
  en `package.json`. Los fallos se descubren al intentar y fallar.
- **El cliente ya reintenta**: si una subida al entrenador falla,
  `clientSync.pendingUpload` queda a `true`, `AppHeader` enseña un aviso y
  `checkAndPullProgramUpdates` reintenta al arrancar y al volver a primer plano.
  `TrainerConnectionScreen` dice «Falló a las…». Es la pieza que hay que
  copiar.
- **El entrenador no**: «↑ Enviar» sin conexión acaba en «No se pudo subir el
  programa.» y ahí queda. Lo mismo al crear el código de un cliente
  (`slotCreateError`, que al menos dice qué hacer) o al conectar
  («No se pudo conectar.», `connectError`, y en `ClientsScreen.jsx:614` incluso
  `err?.message` crudo).
- **Textos en español escritos en el código**, que en inglés salen en
  español: en `store/useStore.js`, «El archivo no contiene ningún programa»
  (~1106), «Programa e historial actualizados» / «Programa actualizado»
  (~1129), «N sesiones importadas» (~1138), «¡Siguiente serie!» (~3008),
  «Error al exportar» (~3145), «Sin programa activo» (~3155), «Error al
  guardar» (~3261), «Error al compartir» (~3283). Los números son orientativos:
  el implementador hace `grep -n "showToast('" store/useStore.js`.
- **Errores que solo dicen «Error»**: los de arriba, y «Error al actualizar
  historial» (`errorUpdateHistory`).

## 2. Lo que sí se puede detectar y resolver en casa

| Momento | ¿Lo detectamos? | Solución propia |
|---|---|---|
| Sin conexión al enviar un programa o conectar un cliente | Sí, con NetInfo y con el tipo de error | Cola + aviso «Se enviará cuando vuelva la conexión» (U15-01) |
| Sin conexión del cliente al subir | Ya se detecta | Ya hay cola; solo falta que el aviso diga «se enviará solo» |
| Servidor caído o respuesta rara | Sí (respuesta con error, no fallo de red) | Mensaje distinto de «sin conexión»: «No hemos podido hablar con el servidor. Lo reintentamos solos.» |
| Pago fallido / pendiente | Sí (códigos de RevenueCat) | M04-03 |
| Límite del plan | Sí | M04-02 |
| Borrar sin querer | Sí | P16-07 (Deshacer) |
| Exportar / compartir / Drive que fallan | Sí | Errores con siguiente paso (U15-02) |
| Lista sin datos | Sí | Estados vacíos (U15-03) |

## 3. U15-01 — Saber si hay conexión y dejar envíos en cola

- Añadir `@react-native-community/netinfo` (está en el SDK de Expo; versión la
  que diga `npx expo install`). Sin hook propio: un valor en el store
  (`ui.online`) que se actualiza con el listener.
- **«↑ Enviar» del entrenador sin conexión**: no falla. El cliente queda
  marcado como pendiente (ya existe el marcado para «↑ Enviar»), y sale el
  toast «Sin conexión. Se enviará cuando vuelva.». Al volver la conexión (o a
  primer plano) se reintenta solo, como hace el cliente con `pendingUpload`.
  En la ficha del cliente, el estado dice «Pendiente de enviar · sin conexión».
- **Distinguir red de servidor** en los errores de Supabase: fallo de `fetch`
  / sin respuesta = sin conexión; respuesta con error = servidor. Mensajes
  distintos (§2).
- **Aviso fijo** solo donde la conexión importa (pestaña Clientes, conexión con
  entrenador): una línea «Sin conexión · los cambios se envían al volver»
  encima del contenido mientras `online === false`. En el resto de la app no
  sale nada: se puede entrenar sin conexión.
- El aviso del cliente (`AppHeader`, `pendingUpload`) añade «se enviará solo».

**Probar U15-01**

- [ ] Entrenador en modo avión → «↑ Enviar» a un cliente → toast «Sin conexión. Se enviará cuando vuelva.» y la ficha dice «Pendiente de enviar»
- [ ] Quitar el modo avión → el envío sale solo, sin tocar nada, y el cliente recibe el programa
- [ ] Pestaña Clientes en modo avión → línea «Sin conexión» arriba; al volver la conexión, desaparece
- [ ] Entrenar en modo avión → no sale ningún aviso de conexión en el Workout

## 4. U15-02 — Errores con siguiente paso y textos sin traducir

- Todos los textos de §1 pasan a `es.json` y `en.json` (sin reformatear el
  JSON: claves línea a línea).
- Cada error dice **qué ha pasado y qué hacer**, en una o dos frases y en
  afirmativo:
  - «Error al exportar» → «No se pudo crear el archivo. Comprueba que queda
    espacio en el móvil y vuelve a probar.»;
  - «Error al compartir» → «No se pudo abrir el menú de compartir. Vuelve a
    probar.»;
  - «Sin programa activo» → «Primero elige un programa en la pestaña Programa.»;
  - «No se pudo subir el programa.» → lo resuelve U15-01;
  - «No se pudo conectar.» → «No se pudo conectar con ese código. Revisa que
    esté bien escrito o pide uno nuevo a tu entrenador.»;
  - nunca `err.message` en pantalla (`ClientsScreen.jsx:614`): al log.
- Los errores que tienen acción usan `showDialog` con un botón de reintentar;
  los informativos, toast.

**Probar U15-02**

- [ ] Con el idioma en inglés, importar un archivo sin programa → mensaje en inglés
- [ ] Conectar con un código mal escrito → el mensaje dice que revises el código o pidas otro
- [ ] Ningún error en pantalla dice solo «Error»

## 5. U15-03 — Maqueta de los estados vacíos

Una maqueta (`docs/mockups/estados-vacios.html`) antes de tocar código. Hoy
los vacíos son correctos pero pasivos: «Sin clientes. Pulsa ＋ Nuevo para
añadir uno.», «Completa tu primera sesión para verla aquí.», «Sin plantillas
todavía…», «No hay programas archivados.». Un vacío bueno:

- enseña **qué se verá ahí** cuando haya datos (una silueta de la tarjeta o la
  gráfica en gris, no una ilustración genérica);
- dice **para qué sirve** en una frase;
- lleva **un botón directo** a la acción que lo llena.

Inventario de partida (el implementador lo completa con `grep -n "empty"
src/locales/es.json`): Clientes, Plantillas (programa y sesión), Historial,
Progreso, Carga, archivados, copias de Drive, Pegar entreno, sesión sin
ejercicios, circuito sin movimientos.

Maqueta `docs/mockups/estados-vacios.html` aprobada por el usuario el
27-oct-2026: silueta gris de lo que saldrá (tarjetas o gráfica, fundida hacia
abajo), título «qué verás», una frase «para qué sirve» y un botón lima a la
acción que lo llena; los vacíos de dentro (sesión sin ejercicios, circuito sin
movimientos) van en línea, con un hueco de borde discontinuo. En Clientes vacío,
solo «Crear mi primer cliente» (sin «Tengo un código»: sin clientes no hay
código). La implementación es U15-04.

**Probar U15-04**

- [ ] Clientes sin ningún cliente → silueta de tarjetas con avatar, «Aquí verás a tus clientes» y solo «Crear mi primer cliente» (abre el alta); con búsqueda sin resultados sigue el aviso de siempre
- [ ] Programa › Plantillas (programas) vacío → «Programas listos para asignar» y «Crear una plantilla» abre el alta (sin «Guardar un programa que ya tengo»: no hay esa acción)
- [ ] Programa › Plantillas de sesión vacío → «Sesiones para reutilizar» y «Crear una plantilla de sesión»
- [ ] Historial sin entrenos → «Tus entrenos, uno a uno» y «Empezar a entrenar» lleva a Entreno; con un filtro sin sesiones sigue el aviso de siempre
- [ ] Progreso sin entrenos → silueta de gráfica y «Empezar a entrenar»; con entrenos pero sin coincidencias en la búsqueda no cambia
- [ ] Carga sin entrenos → silueta de barras y «Empezar a entrenar»; con entrenos sin esfuerzo apuntado sigue el aviso de siempre
- [ ] Programas archivados propios (hoja de Mi cuenta) sin ninguno → «Programas que ya no usas», sin botón; la ficha de un cliente sin archivados conserva su frase
- [ ] Copias de Drive conectado y sin copias → «Tus copias de seguridad» y «Hacer una copia ahora» hace la copia
- [ ] Pegar entreno sin texto → ejemplo gris, «Pega el texto de un entreno» y «Pegar del portapapeles» rellena el cuadro
- [ ] Editor de sesión sin ejercicios → hueco discontinuo «Añadir el primer ejercicio» que abre el selector
- [ ] Editor de circuito sin movimientos → hueco discontinuo «Añadir un movimiento»; con movimientos vuelve el «+ Añadir ejercicio» de siempre
- [ ] En claro y en oscuro, y en inglés, textos y silueta se ven bien y la silueta se funde hacia el fondo

## Fases

| Fase | Qué | Depende de | Coste | Estado |
|---|---|---|---|---|
| U15-01 | NetInfo, cola de envíos del entrenador, aviso en Clientes | — | 🟡 | hecho |
| U15-02 | Errores con siguiente paso, textos traducidos | — | 🟢 | hecho |
| U15-03 | Maqueta de estados vacíos | — | 🟢 | terminado |
| U15-04 | Estados vacíos según la maqueta | U15-03 | 🟡 | hecho |
