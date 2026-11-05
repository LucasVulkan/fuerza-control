# Spec — Explicaciones de pantalla: recorrido la primera vez y avisos puntuales

> Tema: ui
> En corto: La primera vez que se abre cada pantalla principal se oscurece y se resaltan dos o tres elementos de uno en uno, con una frase cada uno; y algunas cosas que no se entienden solas (la burbuja de diferencia, por ejemplo) se explican con un globo la primera vez que aparecen. Sustituye a las tarjetas explicativas del tramo «Aprende» del onboarding, que se quitan; las dos elecciones de ese tramo (Lista/Pestañas y regla) se quedan.
> Fase U17-01 · pendiente · Componentes: recorrido, aviso puntual y «visto» · §3
> Fase U17-02 · pendiente · Recorridos de Entreno, Programa y Progreso · §4
> Fase U17-03 · pendiente · Recorridos de Editar programa y del editor de sesión · §5
> Fase U17-04 · pendiente · Recorridos de Clientes, ficha del cliente y Plantillas · §6
> Fase U17-05 · pendiente · Avisos puntuales · §7
> Fase U17-06 · pendiente · Quitar las tarjetas explicativas del onboarding · §8
>
> Estado: **spec escrita, sin implementar** (3-nov-2026). Sale de la idea U17
> de `ideas.md` («mensajes de pantalla la primera vez»). Maqueta:
> [`docs/mockups/recorrido-pantallas.html`](../mockups/recorrido-pantallas.html).
> Los elementos de la maqueta son orientativos (no copian la pantalla real):
> **cada tarea precisa sobre la pantalla de verdad qué elementos se resaltan** y
> con qué texto, y se los enseña al usuario antes de cerrar. U17-06 va la última:
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

Un paso puede llevar además:

- `scrollRef`: el `ScrollView`/`FlatList` donde está el elemento. Si el elemento no
  está entero en pantalla, antes de medirlo se desplaza la lista hasta él
  (`measureLayout` respecto al contenido → `scrollTo`) y se mide al terminar. Hace
  falta en Editar programa y en el editor de sesión, donde lo de abajo no se ve al
  abrir.
- `figure`: un elemento que se pinta dentro del globo, encima del texto (el
  ejemplo de clientes en distintos estados, §6). Sin `ref` el paso no tiene hueco:
  solo velo y globo centrado.
- `finger`: el dedo de `Spot` sobre el hueco para enseñar un gesto (deslizar,
  arrastrar el asa).

El texto de un paso puede depender del estado (con o sin etapas, con o sin
clientes, cliente vinculado): lo decide la pantalla al montar los pasos, y un paso
que no aplica (p. ej. etapas en un programa sin etapas) simplemente no se pasa.

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

## 4. U17-02 · Recorridos de Entreno, Programa y Progreso

Decisión del usuario (5-nov). Orientativo, a precisar sobre la pantalla real:

| Pantalla | Paso | Qué explica |
|---|---|---|
| Entreno (`HomeScreen`) | 1 | La sesión que toca (la tarjeta grande): la elige el orden del programa (rotación, semana o libre) y se pulsa para empezar |
| Entreno | 2 | Las otras sesiones: puedes hacer cualquiera en vez de la que toca |
| Entreno | 3 | La sesión libre: entrenar sin seguir el programa |
| Programa (`MyProgramScreen`) | 1 | Ver el programa: tocar para verlo entero |
| Programa | 2 | Editar: cambiar ejercicios, sesiones y etapas |
| Programa | 3 | Solo si hay etapas: cómo se ven las etapas ahí y cuánto llevas de la actual |
| Progreso (`StatsScreen`) | 1 | El segmentado Ejercicios · Carga · Historial: qué hay en cada uno (un paso, no uno por segmento) |
| Progreso | 2 | Un ejercicio de la lista: al tocarlo se abre su ficha |

- `today` de las tarjetas de «Aprende» → Entreno, paso 1; `free` → Entreno, paso 3.
- `edit` / `sees` → Programa, paso 2. Con entrenador vinculado el texto cambia: el
  programa lo lleva tu entrenador y ve tus entrenos.
- Sin programa activo no hay recorrido de Entreno ni de Programa: su estado vacío
  ya explica qué hacer (U15-04); sale la primera vez que se abran con programa.
- Progreso sin ningún ejercicio entrenado: sin paso 2 (no hay fila que señalar).
- El menú ··· de Programa no lleva paso (decisión del usuario, 5-nov).

**Probar U17-02**

- [ ] Usuario nuevo con programa → Entreno: los tres pasos resaltan el elemento correcto, también tras desplazar la lista
- [ ] Entreno en vista Pestañas (U13) → los pasos siguen cayendo en su sitio
- [ ] Programa sin etapas → dos pasos; con etapas → tres, y el tercero señala las etapas
- [ ] Cliente vinculado → el texto de Programa dice que lo lleva su entrenador
- [ ] Progreso → el segmentado y un ejercicio; sin entrenos, solo el segmentado
- [ ] Sin programa → Entreno y Programa no enseñan recorrido; al tener uno, sí
- [ ] Inglés → textos traducidos y el globo no se corta

## 5. U17-03 · Recorridos de Editar programa y del editor de sesión

| Pantalla | Paso | Qué explica |
|---|---|---|
| Editar programa (`ProgramEditorScreen`) | 1 | La ficha y la etapa: datos del programa y, si hay etapas, cuál estás editando |
| Editar programa | 2 | Las sesiones: son las de la etapa seleccionada (si hay etapas), lo que se espera cada semana; se entra para editar los ejercicios y se reordenan arrastrando |
| Editor de sesión (`SessionEditorScreen`) | 1 | El selector de etapas: cambia qué etapa de la sesión editas (solo si hay etapas) |
| Editor de sesión | 2 | La lista de ejercicios: deslizar una fila para sus acciones y arrastrar el asa para reordenar (hueco en la primera fila, con `finger`) |

- La sección de sesiones y la lista quedan a menudo por debajo de la pantalla: estos
  pasos usan `scrollRef` (§3.2).
- Sin etapas, el texto de las sesiones no las nombra y el editor de sesión tiene un
  solo paso.
- Sesión sin ejercicios: sin paso de la lista; sale la primera vez que tenga uno.

**Probar U17-03**

- [ ] Editar programa con etapas → la ficha con la etapa y luego las sesiones, aunque estén por debajo (la lista baja sola)
- [ ] Editar programa sin etapas → el texto de sesiones no habla de etapas
- [ ] Editor de sesión con etapas → selector y lista; el dedo enseña deslizar y el asa
- [ ] Editor de sesión sin etapas → solo la lista
- [ ] Al cerrar el recorrido la lista se queda donde la dejó y se puede usar

## 6. U17-04 · Recorridos de Clientes, ficha del cliente y Plantillas

Lo que enseñaban las tarjetas del entrenador (`clients`, `templates`, `next`,
`log`, `text`) pasa aquí y a §7. Orientativo:

| Pantalla | Paso | Qué explica |
|---|---|---|
| Clientes (`ClientsScreen`) | 1 | Añadir tu primer cliente y los dos iconos de arriba |
| Clientes | 2 | Las tarjetas: tocar una para entrar en el cliente; reordenarlas |
| Clientes | 3 | Qué significa cada estado: paso con `figure` = un ejemplo con varios clientes en distintos estados (al día, sin entrenar, cambios sin enviar, sesiones sin revisar) y una frase por estado |
| Ficha del cliente | 1 | El control segmentado de arriba: qué hay en cada parte |
| Ficha del cliente | 2 | La sección de programa |
| Ficha del cliente | 3 | La próxima sesión: ajustas lo que hará la próxima vez |
| Plantillas (`ProgramScreen`) | 1-2 | Programas y sesiones guardadas; asignar a un cliente o a mí (precisar sobre la pantalla) |

- El ejemplo de estados reutiliza `ClientsMini` del onboarding (filas `ClientRow` de
  verdad con datos fijos, sin tocar el store): pasa a un sitio común y **no se
  borra** en U17-06. Precisar con el usuario qué estados salen.
- Sin clientes, el paso 2 no tiene tarjeta que señalar: va sin hueco, solo con el
  ejemplo (o se junta con el 3).
- Ficha del cliente: si alguna de sus partes vive en una hoja o un modal, el
  recorrido sale sobre la pantalla limpia (regla 7).

**Probar U17-04**

- [ ] Entrenador nuevo sin clientes → Clientes: añadir e iconos, y el ejemplo de estados
- [ ] Con clientes → la tarjeta real resaltada y luego el ejemplo
- [ ] Ficha del cliente → segmentado, programa y próxima sesión
- [ ] Plantillas → recorrido una vez, elementos correctos
- [ ] Atleta sin pestañas de entrenador → no ve ninguno

## 7. U17-05 · Avisos puntuales

Candidatos (precisar en la tarea; uno por cosa, nunca dos a la vez en pantalla):

- **Burbuja de diferencia** del entreno (U10-01): por qué sube o baja el peso y que
  la cifra se toca para cambiarla.
- **La regla** bajo la cifra, si no se usó nunca: que se arrastra.
- **Apuntar o pegar** el entreno del cliente sin app (entrenador, `clientMode: self`).

La sesión libre y la próxima sesión del cliente ya van en los recorridos (§4, §6).

**Probar U17-05**

- [ ] Primer entreno en que sale la burbuja → aparece el globo; «Vale» lo cierra y no vuelve
- [ ] Con el globo abierto se puede seguir apuntando series
- [ ] Cada aviso sale una sola vez, también en entrenos siguientes

## 8. U17-06 · Quitar las tarjetas explicativas del onboarding

Va la última, cuando U17-02…05 cubren lo que enseñaban. Decisión del usuario
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
  `TabBarMini.jsx`, `learnCards` de `onboardingPreview.js` (y su
  test) y las claves `onboardingFlow.learn.cards.*` de los locales. Antes de borrar,
  `grep` de cada uno: `HomeViewPreview`, `ScrubDemo`, `Scaled`, `Spot` y
  `newClientRow` (lo importa `trainer.jsx`) **se quedan**, y `ClientsMini` también
  (lo usa el recorrido de Clientes, §6).
- Tests: `onboardingFlow.test.js` (rutas y tramos del entrenador que no entrena) y
  `onboardingPreview.test.js`. `builderProgram.test.js` sigue esperando `'a_home'`.
- Dejar una nota en O03 §11.4 de que las tarjetas se quitaron en U17-06.

**Probar U17-06**

- [ ] Onboarding «por mi cuenta» de principio a fin → tras el programa salen Lista/Pestañas y la regla, y de ahí a «Listo», sin tarjetas
- [ ] Onboarding con entrenador (código) → Lista/Pestañas, regla y «Listo»
- [ ] Onboarding de entrenador que no entrena → termina en «Listo» sin pasar por el último tramo, y abre en Clientes
- [ ] Entrenador que también entrena → Lista/Pestañas, regla y «Listo»
- [ ] La barra: el último tramo se llena con las dos pantallas y su nombre ya no es «Aprende»
- [ ] «Saltar» en Lista/Pestañas o en la regla lleva a «Listo»
- [ ] Nuevo programa desde la app (constructor) → sigue terminando como antes
