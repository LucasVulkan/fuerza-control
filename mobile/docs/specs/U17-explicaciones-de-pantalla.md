# Spec — Explicaciones de pantalla: recorrido la primera vez y avisos puntuales

> Tema: ui
> En corto: La primera vez que se abre cada pantalla principal se oscurece y se resaltan dos o tres elementos de uno en uno, con una frase cada uno; y algunas cosas que no se entienden solas (la burbuja de diferencia, por ejemplo) se explican con un globo la primera vez que aparecen. Sustituye a las tarjetas explicativas del tramo «Aprende» del onboarding, que se quitan; las dos elecciones de ese tramo (Lista/Pestañas y regla) se quedan.
> Fase U17-01 · pendiente · Componentes: recorrido, aviso puntual y «visto» · §3
> Fase U17-02 · pendiente · Recorridos de Entreno y Programa · §4
> Fase U17-03 · pendiente · Recorridos de Clientes y Plantillas · §5
> Fase U17-04 · pendiente · Avisos puntuales · §6
> Fase U17-05 · pendiente · Quitar las tarjetas explicativas del onboarding · §7
>
> Estado: **spec escrita, sin implementar** (3-nov-2026). Sale de la idea U17
> de `ideas.md` («mensajes de pantalla la primera vez»). Maqueta:
> [`docs/mockups/recorrido-pantallas.html`](../mockups/recorrido-pantallas.html).
> Los elementos de la maqueta son orientativos (no copian la pantalla real):
> **cada tarea precisa sobre la pantalla de verdad qué elementos se resaltan** y
> con qué texto, y se los enseña al usuario antes de cerrar. U17-05 va la última:
> las tarjetas no se quitan hasta que lo que enseñaban está en las pantallas.
> Decisión del usuario (3-nov): en el onboarding se quedan **Lista/Pestañas y la
> regla** (son elecciones); sale **todo lo explicativo** (las tarjetas, `a_cards`).

---

## 1. Por qué

- Las tarjetas del tramo «Aprende» del onboarding (O03 §11.4, `a_cards` en
  `screens/onboarding/screens/learn.jsx`) explican la app **antes** de que el
  usuario la haya visto: miniaturas de pantallas que todavía no conoce. Se olvidan
  en cuanto se cierran y alargan la entrada.
- Explicar cada pantalla **cuando se abre**, sobre sus elementos reales, enseña en el
  momento en que importa y no cuesta nada a quien ya lo sabe (se salta o no sale).
- Una imagen explicativa por pantalla se descartó: una por idioma y se queda
  desfasada con cada rediseño.

## 2. Reglas del recorrido (todas las tareas)

1. **Dos o tres pasos por pantalla, nunca más.** Si una pantalla necesita más, el
   problema es la pantalla. Si no hay nada que no se entienda solo, la pantalla
   no lleva recorrido.
2. **Una vez por pantalla.** Al terminar o al pulsar «Saltar» se guarda «visto» y no
   vuelve a salir. Los usuarios que ya tenían la app también lo ven una vez, la
   primera vez que abren cada pantalla tras actualizar.
3. **Se puede volver a ver** con el botón **?** de la cabecera de esa pantalla.
4. **Señala el elemento real.** El hueco se mide sobre el componente de la pantalla
   (no coordenadas fijas), así que si el diseño cambia el recorrido no se rompe. El
   globo va debajo del elemento, o encima si no cabe.
5. Mientras está abierto la pantalla de debajo no responde, y tocar fuera no lo
   cierra (no se pierde sin querer). Se cierra con «Saltar» o con el último paso.
6. **Textos en los locales** (`es` y `en`), con el tono de la app: amigable sin ser
   coloquial; una frase, dos como mucho, por paso.
7. No sale encima de otra cosa: si la pantalla abre con una hoja, un diálogo o el
   paywall, espera a la siguiente vez que se abra limpia. Tampoco con el lector de
   pantalla activo: ahí se anuncia el texto del primer paso y nada más (§3.4).

## 3. U17-01 · Componentes: recorrido, aviso puntual y «visto»

### 3.1 Dónde se guarda «visto»

En el perfil, junto al resto de preferencias persistidas:
`profile.tipsSeen: { [id]: true }`, con `id` = `'tour.home'`, `'tour.program'`,
`'hint.diffBubble'`… Un mapa y no un campo por pantalla: añadir una pantalla no
toca el store. Acciones: `markTipSeen(id)` y `resetTip(id)` (la usa el **?**).
No viaja al entrenador ni a Supabase: es de este móvil.

### 3.2 El recorrido

Un componente que recibe una lista de pasos `{ ref, title, text }` y el `id` del
recorrido. Para cada paso:

- mide el elemento con `measureInWindow` sobre su `ref`;
- oscurece la pantalla dejando un hueco con el radio del elemento y un aro lima
  (como la maqueta: el velo y el hueco son una sola pieza y se mueven juntos de un
  paso al siguiente, con Reanimated);
- pinta el globo: puntos de progreso, «Saltar», título, texto, botón «‹» (desde el
  segundo paso) y «Siguiente» / «Entendido» en el último.

Las pantallas lo montan con un hook (`useScreenTour(id, steps)`) que decide si toca
(no visto, pantalla en foco, nada encima) y devuelve la función para el **?**.
Antes de escribirlo, **buscar en el código** lo que ya hay: `Spot.jsx` (el aro que
late de «Aprende»), `Rise`, `DragSheet`. Si `Spot` sirve para el aro se reutiliza
desde donde está (la miniatura de Lista/Pestañas, que se queda, también lo usa).
Sin librerías nuevas.

### 3.3 El aviso puntual

Un globo sin velo, pegado a un elemento, con una frase y «Vale». Sale la primera
vez que ese elemento aparece en pantalla y guarda su `hint.*` en `tipsSeen`. No
bloquea la pantalla: el usuario puede seguir usándola con el globo abierto, y se
cierra solo si el elemento desaparece.

### 3.4 Accesibilidad

El globo es un `accessibilityViewIsModal` con el foco en el título. Con el lector
de pantalla activo no se dibuja el hueco: se anuncia el texto de cada paso en el
globo y los botones siguen funcionando. Respeta `useReducedMotion` (sin animación
del hueco, cambio directo).

### 3.5 El botón **?**

Un icono en la cabecera de las pantallas que tienen recorrido (`AppHeader`, al lado
de los que ya hay). Con los iconos a dos colores de la app. Solo en las pantallas
con recorrido.

**Probar U17-01**

- [ ] Pantalla con recorrido, primera vez → sale el recorrido; «Saltar» lo cierra y al volver a la pestaña no sale
- [ ] **?** de la cabecera → vuelve a salir desde el primer paso
- [ ] Cerrar la app a mitad del recorrido y volver a abrir → sale otra vez (no se marcó visto)
- [ ] Tocar fuera del globo no lo cierra ni toca lo de debajo
- [ ] Con VoiceOver/TalkBack: se lee el texto del paso y se puede avanzar
- [ ] Con «Reducir movimiento» → sin animación, todo funciona igual

## 4. U17-02 · Recorridos de Entreno y Programa

Referencia de la maqueta (a precisar sobre la pantalla real):

| Pantalla | Paso | Qué explica |
|---|---|---|
| Entreno | 1 | La tarjeta del programa: en qué etapa y semana vas, y que se toca para ver el programa |
| Entreno | 2 | La semana: los días entrenados |
| Entreno | 3 | La sesión que toca: la elige el orden del programa (rotación, semana o libre) |
| Programa | 1 | Las etapas y cuánto llevas de la actual |
| Programa | 2 | Las sesiones: lo que se espera **cada semana** en esta etapa |
| Programa | 3 | El menú ···: compartir, exportar, guardar como plantilla, nuevo programa |

Lo que enseñaban las tarjetas de «Aprende» para el que entrena (`learnCards`:
`today`, `edit` / `sees`, `free`) tiene que quedar cubierto aquí o en §6:

- `today` → Entreno, paso 3.
- `free` (sesión libre) → un paso en Entreno si cabe en los tres; si no, aviso
  puntual en §6.
- `edit` (puedes cambiar tu programa) / `sees` (tu entrenador ve lo que haces) →
  Programa. Con entrenador vinculado el texto cambia: el programa lo lleva tu
  entrenador y ve tus entrenos.

Sin programa activo no hay recorrido de Entreno: su estado vacío ya explica qué
hacer (U15-04), y el recorrido sale la primera vez que se abra con programa.

**Probar U17-02**

- [ ] Usuario nuevo con programa → Entreno: los tres pasos resaltan el elemento correcto, también tras desplazar la lista
- [ ] Entreno en vista Pestañas (U13) → los pasos siguen cayendo en su sitio
- [ ] Programa → los tres pasos; el texto de las sesiones habla de cada semana
- [ ] Cliente vinculado → el texto de Programa dice que lo lleva su entrenador
- [ ] Sin programa → Entreno no enseña recorrido; al tener uno, sí
- [ ] Inglés → textos traducidos y el globo no se corta

## 5. U17-03 · Recorridos de Clientes y Plantillas

Lo que enseñaban las tarjetas del entrenador (`clients`, `templates`, `next`,
`log`, `text`) pasa aquí y a §6. Precisar sobre la pantalla real; orientativo:

| Pantalla | Qué explica |
|---|---|
| Clientes | La fila de un cliente y lo que dice su estado; cómo se añade uno |
| Plantillas | Programas y sesiones guardadas; asignar a un cliente o a mí |

Si al mirar la pantalla real alguna no tiene nada que no se entienda solo, se queda
sin recorrido y se anota aquí.

**Probar U17-03**

- [ ] Entrenador nuevo → Clientes: recorrido una vez, elementos correctos
- [ ] Plantillas → recorrido una vez, elementos correctos
- [ ] Atleta sin pestañas de entrenador → no ve ninguno de los dos

## 6. U17-04 · Avisos puntuales

Candidatos (precisar en la tarea; uno por cosa, nunca dos a la vez en pantalla):

- **Burbuja de diferencia** del entreno (U10-01): por qué sube o baja el peso y que
  la cifra se toca para cambiarla.
- **La regla** bajo la cifra, si no se usó nunca: que se arrastra.
- **Próxima sesión** del cliente (entrenador): que ajustas lo que hará la próxima vez.
- **Apuntar o pegar** el entreno del cliente sin app (entrenador, `clientMode: self`).
- **Sesión libre**, si no cupo en el recorrido de Entreno (§4).

**Probar U17-04**

- [ ] Primer entreno en que sale la burbuja → aparece el globo; «Vale» lo cierra y no vuelve
- [ ] Con el globo abierto se puede seguir apuntando series
- [ ] Cada aviso sale una sola vez, también en entrenos siguientes

## 7. U17-05 · Quitar las tarjetas explicativas del onboarding

Va la última, cuando U17-02…04 cubren lo que enseñaban. Decisión del usuario
(3-nov): **se quedan las dos elecciones** del tramo — `a_home` (Lista o Pestañas,
guarda `profile.homeView`) y `a_input` (regla o solo deslizar, guarda
`profile.scrubRuler`) — y **sale todo lo explicativo**: las tarjetas `a_cards`.

- Rutas (`utils/onboardingFlow.js`):
  - `a_input` lleva a `'done'` en vez de a `'a_cards'` (`learn.jsx`, `Input`).
  - El entrenador que no entrena solo veía las tarjetas: ahora termina directamente.
    `learnStart` devuelve `'done'` para él y `'a_home'` para el resto, y
    `skipTarget('t_self')` lleva a `'done'`.
  - Fuera `a_cards` de `SECTION_OF` y de `skipTarget`.
  - `sectionTotal` del último tramo pasa a 2 (Lista/Pestañas y regla).
- El tramo deja de enseñar: su nombre en la barra, «Aprende»
  (`onboardingFlow.common.sections.learn`), ya no encaja. Se cambia por uno que diga
  que se elige cómo se ve la app (p. ej. «Personaliza»); el texto se cierra con el
  usuario en la tarea. La clave interna `learn` puede quedarse.
- Fuera `Cards` de `learn.jsx` y lo que solo usaba ella: `CardMinis.jsx`,
  `ClientsMini.jsx`, `TabBarMini.jsx`, `learnCards` de `onboardingPreview.js` (y su
  test) y las claves `onboardingFlow.learn.cards.*` de los locales. Antes de borrar,
  `grep` de cada uno: `HomeViewPreview`, `ScrubDemo`, `Scaled`, `Spot` y
  `newClientRow` (lo importa `trainer.jsx`) **se quedan**.
- Tests: `onboardingFlow.test.js` (rutas y tramos del entrenador que no entrena) y
  `onboardingPreview.test.js`. `builderProgram.test.js` sigue esperando `'a_home'`.
- Dejar una nota en O03 §11.4 de que las tarjetas se quitaron en U17-05.

**Probar U17-05**

- [ ] Onboarding «por mi cuenta» de principio a fin → tras el programa salen Lista/Pestañas y la regla, y de ahí a «Listo», sin tarjetas
- [ ] Onboarding con entrenador (código) → Lista/Pestañas, regla y «Listo»
- [ ] Onboarding de entrenador que no entrena → termina en «Listo» sin pasar por el último tramo, y abre en Clientes
- [ ] Entrenador que también entrena → Lista/Pestañas, regla y «Listo»
- [ ] La barra: el último tramo se llena con las dos pantallas y su nombre ya no es «Aprende»
- [ ] «Saltar» en Lista/Pestañas o en la regla lleva a «Listo»
- [ ] Nuevo programa desde la app (constructor) → sigue terminando como antes
