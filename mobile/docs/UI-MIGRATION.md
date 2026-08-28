# Migración de UI "FormaFit" — guía de trabajo

> **Empieza por aquí** si vas a tocar cualquier pantalla del rediseño.
> Este documento es el estado vivo de la migración. `figma-extraction/RACIONALIZACION.md`
> es el plan ORIGINAL (previo a implementar) y ya no refleja lo hecho — úsalo solo como
> catálogo de decisiones de producto (§5) y de nombres confusos de Figma (§4).

La app se está rediseñando entera contra un archivo de Figma llamado **FormaFit**.
No es un retoque de colores: es un refactor completo de interfaz, pantalla por pantalla.

---

## 1. Estado de la migración

| Pantalla / pieza | Estado | Fichero principal |
|---|---|---|
| Tokens (spacing, textStyles, tema formaFit) | ✅ | `src/theme.js`, `src/themes.js` |
| Fuentes Inter (todas las variantes de Figma) | ✅ | `App.js` |
| SegmentedControl (primitiva, animado) | ✅ | `src/components/ui/SegmentedControl.jsx` |
| History | ✅ | `src/screens/HistoryScreen.jsx` |
| Progress (cards, lista agrupada, dropdown) | ✅ | `src/components/stats/ProgressTab.jsx` |
| Modal de detalle de ejercicio | ✅ | `src/components/stats/ProgressTab.jsx` (mismo fichero) |
| AppHeader + tab bar | ✅ | `src/components/AppHeader.jsx`, `src/navigation/RootNavigator.jsx` |
| **Menú principal (≡)** + Documentación | ✅ | `src/components/AppHeader.jsx`, `src/screens/DocsScreen.jsx` |
| **Entrenador (lado cliente)** | ✅ | `src/screens/TrainerConnectionScreen.jsx` |
| **Copia en Drive** | ✅ | `src/screens/DriveBackupScreen.jsx` |
| **Modales de conexión** (código / Google / modo sync) | ✅ | `ClientCodeModal.jsx`, `ClientGoogleLinkModal.jsx`, `TrainerSyncModal.jsx` |
| Clientes (tarjeta, header, modal de filtros) | ✅ (tarjeta **rehecha**, ver desglose) | `src/screens/ClientsScreen.jsx` |
| **Ficha de cliente** (header + tabs + tab de Programa) | ✅ (Historial/Progreso/Info **sin migrar**, ver desglose) | `src/screens/ClientsScreen.jsx` |
| Modal de sincronización | ✅ (solo colores) | `src/components/TrainerSyncModal.jsx` |
| **HomeView** | ✅ | `src/screens/HomeScreen.jsx` |
| **Recap de sesión** | ✅ (sin nodo en Figma — ver desglose) | `src/screens/SessionRecapScreen.jsx` |
| **Progreso › pestaña Carga** | ✅ (pantalla NUEVA, sin nodo en Figma — ver desglose) | `src/components/stats/LoadTab.jsx`, `ProgressPanel.jsx` |
| **Plantillas / ProgramScreen** | ✅ | `src/screens/ProgramScreen.jsx` |
| **Program Editor** | ✅ | `src/screens/ProgramEditorScreen.jsx`, `src/components/ui/StageSelector.jsx` |
| **Sesion Editor** (+ modal "···" nuevo) | ✅ | `src/screens/SessionEditorScreen.jsx` |
| **Exercice Editor** (+ botones eliminar/sustituir) | ✅ | `src/components/editor/ExerciseEditorInline.jsx` |
| **Bloques AMRAP / EMOM / For time** | ✅ | `src/components/editor/BlockEditorInline.jsx` |
| **Buscador de ejercicios** | ✅ | `src/screens/ExerciseSelectorScreen.jsx` |
| **Alta de ejercicio nuevo** | ✅ | `src/screens/CustomExerciseScreen.jsx` |
| **Onboarding** (preguntas, propuestas, detalle, preview) | 🟡 sin nodo en Figma — hecho con tokens y patrones ya migrados, revisar cuando exista el nodo. Spec: [`specs/onboarding-proposals.md`](specs/onboarding-proposals.md) | `src/screens/OnboardingScreen.jsx` |
| **Workout Screen (el último)** | ⬜ | `src/screens/WorkoutScreen.jsx`, `ExerciseCard.jsx` — **guía dedicada: [`workout-screen-migration.md`](workout-screen-migration.md)** |

### HomeView — desglose (completo, 4/4 partes)

1. ✅ **Banner** — tarjeta accent con nombre de programa, "by entrenador", etapa
   (nombre + `ETAPA n/total`), barra de progreso segmentada por ciclo, `Ciclo X de Y` + %,
   y bloque derecho `CICLO` / nº / puntos de ciclo. Dos variantes (con y sin etapa).
   Pulsar el banner abre el selector de etapa.
2. ✅ **Selector semanal** (`L M X J V S D` + 7 puntos) — **funcionalidad nueva**: los
   puntos reflejan días REALMENTE entrenados, vía `getWeekStatuses()` en
   `src/utils/weekProgress.js` (semana Lun→Dom; "entrenó" = cualquier entrada de
   `workoutLog`, incluidas sesiones libres, sin filtrar por programa). Colores exactos
   extraídos del SVG de Figma (nodo `102:292`): entrenado = relleno lima `#b8ff00`
   (literal, no token — igual caso que el `#81a71e` del banner); pasado sin entrenar =
   relleno gris `muted`; futuro = anillo gris `mutedLight`. El día de hoy tiene un
   matiz **no documentado en Figma, decidido en la conversación**: sin entrenar = anillo
   lima hueco; entrenado = mismo anillo + punto central lima, más pequeño que un relleno
   completo. Esa transición (anillo → anillo+punto) se anima con Reanimated
   (`withTiming`, 200ms ease-in-out) al volver del recap tras guardar sesión — no anima
   en el montaje inicial de la pantalla, solo en cambios posteriores (mismo patrón que
   `SegmentedControl`).
3. ✅ **Lista de sesiones** (⚠️ animación de completado sin resolver, ver más abajo) —
   **cambio de comportamiento**: orden fijo A→E, sin reorder (antes había "hero +
   compactas" con orden rotatorio: la sesión siguiente saltaba al principio). Un único
   componente `SessionCard` (sustituye a `HeroSessionCard`/`CompactSessionCard`) con 3
   tratamientos: completada = check lima + fondo/borde `tint.accent10`/`accent50`;
   siguiente/en curso = botón `EMPEZAR`/`CONTINUAR` (fondo lima literal, texto+chevron
   `onAccent`); futura = chevron gris `#d9d9d9` (`FutureChevronIcon`, path exacto del
   SVG de Figma). Coordenadas verificadas con `get_metadata` sobre las instancias reales
   dentro de `HomeView` (`104:74`–`104:78`), no sobre el componente aislado — los tres
   estados de la zona de acción comparten el mismo borde derecho (343 de 363px), solo
   cambia el ancho de su contenido. Se conservan los avisos de "empezar fuera de orden".
   Subtítulo: `Completada {tiempo}` solo cuando el tiempo es "hoy"/"ayer" (con el
   fragmento de tiempo en accent); a partir de "hace N días" el texto va solo, sin
   prefijo (pedido explícito en QA, aunque siga en accent). Tag "SESIÓN X" usa
   `textStyles.spacingTag` (no `cardType`). Padding vertical de la tarjeta y del botón
   EMPEZAR ajustados a ojo en QA por debajo del valor literal de Figma (`space/lg`→
   `space/sm2` en la tarjeta, `space/sm`→`space/md` en el botón) — ya se vio dos veces
   en esta migración que un valor exacto de Figma no siempre lee bien en dispositivo;
   cuando eso pase, manda el ajuste de QA y déjalo anotado, no repliques el número de
   Figma a ciegas. `Buttons` "Sesión libre" (mismo frame de Figma que la lista)
   restyleado en el mismo cambio: borde `tint.accent50`, texto `accent` sólido (no el
   tint, corregido en QA).
4. ✅ **Programa + Conexiones** — `EDITAR | VER | //` con variante `Secondary` real
   del componente Buttons de Figma (`102:2079`): fondo `color/surface-2` sólido, sin
   borde, `radius/md`, texto `textStyles.cardType`. Orden corregido a EDITAR→VER
   (el código tenía VER→EDITAR, invertido respecto a Figma). Conexiones (Drive +
   Entrenador): pasan de fila `flex:1`+`flex:1` a columna con cada tarjeta a ancho
   completo (`102:356` en Figma ya las modela así, apiladas); icono de estado deja
   de ser un icono outline (nube/persona) y pasa a ser un círculo relleno de 12px
   (la caja de Figma es 26px pero el punto visible dentro mide ~12px, mismo patrón
   de "caja de icono ≠ icono visible" que en Clientes). Color del círculo reutiliza
   la lógica de estado ya existente en el código (no la del mock estático de
   Figma, que solo tiene verde/gris): verde = Drive conectado, azul = Entrenador
   conectado (regla ya establecida: azul siempre es entrenador/externo), naranja =
   warn, `muted` = desconectado. El chevron final (no existe en el componente de
   Figma) se sustituye por un texto de estado `CONECTADO`/`CONECTAR`
   (`textStyles.spacingTag`), **no** la variante Secondary (decisión explícita del
   usuario) — usa la variante real de Figma para esa pieza (texto sin fondo,
   `tint/accent-50` si conectado, `color/accent` si no). No es un `TouchableOpacity`
   propio: la tarjeta entera sigue siendo el único área pulsable. En estado warn se
   muestra "CONECTAR" (Figma no modela warn, solo conectado/desconectado; el
   subtítulo sigue distinguiendo warn con su propio texto/color, sin cambios).

   **Ajuste posterior en QA**: las 3 etiquetas de sección (SESIONES/PROGRAMA/
   CONEXIONES) usaban dos estilos distintos sin base en Figma — SESIONES a 11px/
   semibold/`muted`, PROGRAMA y CONEXIONES a 10px/regular/`muted2` (prop `muted`
   en `SectionHeader`). Verificado contra Figma (nodo `109:390`, texto "sesiones"
   dentro de `104:73`): las 3 comparten el mismo `text/spacing-tag` (ExtraBold
   10/2, `mutedLight`) — no hay dos estilos. Unificadas a `textStyles.spacingTag`
   + `mutedLight`, se eliminó la prop `muted` de `SectionHeader` (quedaba sin uso).
   También se quitó el icono de barra (`BarbellIcon`) que iba delante de
   "SESIONES": no está en el componente de Figma, era un añadido de la app previo
   a esta migración.

### Tarjeta de cliente — desglose (2ª pasada, sustituye a la primera)

El usuario rehizo el componente en Figma: pantalla `150:1165` ("Clients", página
**Pages**) y 3 variantes nuevas dentro del set `Sesion Card` (`98:123`, página
Components): `429:935` *no avisos*, `430:958` *sin revisar*, `417:2691` *con CTA y
avisos*. La variante vieja sigue ahí como `150:1292` (*Old*) — no la mires.

La tarjeta pasa a **3 líneas** dentro de `surface` / `radius/md` / px `space/lg` /
py `space/md`:

1. **nombre** (`text/card-title` en `color/text`, ya **no** en accent) · racha ·
   `Ciclo NN` a la derecha (`Ciclo` en `text/subtitle` `mutedLight` + el número en
   `text/card-type` `color/text`).
2. **programa · etapa** (`text/card-type` + `text/subtitle`, los dos en
   `mutedLight`) **o** una línea de aviso (punto de 6px + texto, los dos naranjas).
3. **ritmo + puntos de ciclo + hueco derecho**: `1.2` (`card-type`, `text`) +
   `cic/sem` (`subtitle`, `mutedLight`), gap `space/lg`; puntos de 6px con gap
   `space/sm` (hechos = `accent`, pendientes = `muted` **relleno**, ya no anillo).

El `space/md` de aire va **entre la línea 1 y el bloque 2+3**, no repartido entre
las tres: la línea de programa se lee pegada al ritmo, no colgando del nombre
(en pruebas — el usuario dijo que puede revertirlo).

Decisiones de producto que manda el usuario (no están dibujadas, §10):

- **Jerarquía del hueco derecho de la línea 3**: por defecto la fecha de última
  actividad → `En pausa` / `Inactivo` si el estado manual del cliente no es
  `active` (ahí la fecha no dice nada: la adherencia está silenciada) → si hay
  sesiones sin ver, `N sin revisar` (punto lima + `card-type`) → si hay algo
  urgente, el **CTA**, que se come toda la columna derecha.
- **El botón constante de `Progreso` desaparece.** Solo hay botón cuando hay una
  acción urgente: `+ Programa` (sin programa, accent) · `↑ Subir cambios`
  (`programDirty`, naranja) · `Desbloquear` (etapa siguiente bloqueada, naranja) ·
  `↑ Enviar` (prescripción pendiente, azul). Ese orden es el de prioridad.
- **`N sin revisar` no es un botón** pero sí es pulsable, y lleva a Progreso.
- **Dos líneas cuando coinciden dos avisos**: el aviso sustituye a la línea de
  programa, salvo si además hay cambios sin enviar — entonces se pintan las dos
  (la de programa en naranja).
- **Fuera las etiquetas** (ya no tienen representación visual en la tarjeta) y
  **fuera el `···`**: el menú de acciones se abre con **pulsación larga**.
- El aviso de etapa bloqueada **gana CTA**: `unlockClientStage` sube del detalle a
  la pantalla para que la tarjeta y el hero compartan el rollback (si el envío
  falla se vuelve a cerrar la etapa).

Dos cosas que NO son estilo y conviene no volver a romper:

- **`Ciclo NN` = vueltas completas al ciclo + 1** (`totalWeeksCompleted` del blob
  espejado del cliente, con la copia local de respaldo) — el mismo contador que el
  banner de Home. Antes la tarjeta pintaba **semanas de calendario** calculadas
  desde el log, que es otro número.
- **Entrar en Progreso descarga el historial** (`openClientHistoryTab`): las
  sesiones "sin revisar" viven en el slot, no en `clientLogs`, así que entrar
  desde el aviso enseñaba el progreso viejo hasta que alguien tiraba del refresh.
  `markHistoryViewed` se llama **después** de la descarga: si falla, el aviso se
  queda. Aplica igual al historial, que tenía el mismo fallo.

De paso, en la misma pantalla:

- **El filtro de estado (Todos / Inactivos) ya no pinta pill** bajo el buscador:
  es una vista del segmentado de la hoja de filtros, igual que el orden, que
  tampoco la pintaba. Sí sigue contando en el badge del botón de filtros. Las
  pills de **etiqueta** pasan al lenguaje nuevo (relleno `accent` sólido,
  `radius/sm`, `text/card-type` en `onAccent`) y pierden la variante "inactiva":
  si están en esa fila, están aplicadas. Las de **aviso** (En riesgo / Sin
  revisar) comparten esa geometría y tipografía; lo único propio es el color.
- **Aviso de envíos pendientes**: al ancho del resto de la pantalla (`space/lg`,
  antes `space/xl`, que lo dejaba más estrecho), más aire respecto al buscador,
  sin borde (§4.6) y con `textStyles` + la geometría de CTA de la tarjeta. El
  titular pasa a ser corto y fijo (`Cambios sin enviar`): la frase larga no cabía
  en la columna que deja el botón, y el detalle (`3 clientes · 2 prescripciones`)
  se lee mejor en el subtítulo, que ahora admite 2 líneas.

Divergencias conscientes respecto al mock:

| Pieza | Decisión |
|---|---|
| Naranja de aviso | El `orange` del tema (`#fb923c`), **no** el `#ff9900` del mock — decisión explícita del usuario: el naranja de aviso ya existe en la app y no se duplica |
| Icono del CTA | Figma dibuja el icono de barras (Progreso) en un botón que es placeholder; nuestros CTA usan el prefijo `↑` / `+` que ya tenía la app |
| CTA centrado | Figma lo ancla arriba dentro de un bloque de 40px; aquí el bloque crece cuando hay 2 avisos, así que va centrado contra el alto real |

### Ficha de cliente — desglose (header, tabs y tab de Programa)

**No hay frame de Figma**: la referencia es un HTML que mandó el usuario
(`formfit-v21-Clienteficha.html`) más su lista de 8 puntos. Solo entran la vista
general y el **tab de Programa** — Historial, Progreso e Info se quedan como
estaban (Info se rehará entero después, y ahí es donde vive ya el código).

- **Cabecera, en UNA línea**: `‹` en caja 34×34 `surface2` + nombre a
  `text/hero` + la última actividad (`hace 2 días`, `text/subtitle` `muted`) a la
  derecha del todo. Fuera el botón "Importar" y el `＋` (ambos pasan al `⋯` del
  programa), y fuera también el `2/4 esta semana` y los puntos del HTML: ese dato
  ya lo dan la adherencia y los puntos de ciclo de la tarjeta. El día sale de
  `adherence.daysSince`, que ya está memoizado (no `Date.now()` en render).
- **Tabs** = `SegmentedControl` sin tocar (la píldora `radius/full` de Figma, no
  el rectángulo del HTML). Pasan de 5 a **4** con etiquetas cortas: el tab
  **Clave desaparece** y `Progresión` → `Progreso`, para que quepan a 12px.
- **Tarjeta de programa asignado** — dos colores, como la tarjeta de ejercicio
  del workout: cabecera `surface2` (padding 14/16, los del spec v6 de
  `ExerciseCard`, sin token) y cuerpo `surface`, todo en `radius/lg`.
  - **Misma tipografía que el banner de Home**, que es el mismo bloque de
    información sobre otro fondo: eyebrows `text/spacing-tag` en `mutedLight` y
    uppercase (`bnEyebrow`), nombre y nº de ciclo a `text/hero` con el
    `marginTop: -space/xs` que los pega a su etiqueta.
  - **Sin puntos de sesión** (el HTML los dibuja bajo el número): apilados
    añadían una fila entera de alto a la cabecera para muy poca tinta, y el
    segmento en curso de la barra de etapas ya se rellena con esa fracción.
  - El eyebrow de la derecha necesita `paddingRight` + `marginRight` negativo:
    el tracking de `spacing-tag` deja hueco DETRÁS de la última letra que RN no
    mete en el ancho medido, y alineado a la derecha se comía la "O" de CICLO.
  - Barra de etapas: **`StageSegBar` extraída de `HomeScreen` a
    `ui/StageSegBar.jsx`** y compartida. Aquí sobre oscuro (fill `accent`, track
    **`#545454` literal**, `STAGE_TRACK` — `surface2` no se veía y `mutedLight`
    competía con el relleno, así que es el punto medio entre los dos; mismo caso
    de "color sin token" que el `#b8ff00`/`#81a71e` del banner). En el banner el
    track sigue en `onAccent` al 16%. Solo se pinta con **más de
    una etapa y con techo de ciclos** — con una sola etapa mediría el programa
    contra sí mismo. Su línea de etiquetas sigue a `bnStageLabels` pero con dos
    ajustes de QA: `ETAPA 1` se queda en `mutedLight` y el **nombre propio de la
    etapa pasa a `color/text`** (es el dato, no la etiqueta), y la posición de la
    derecha sube de `small-bold` a `text/subtitle`, que a 8px no se leía.
  - 3 datos en cajas `bg` / `radius/md`: **Adherencia · Ritmo · Carga**. Se
    reparten el ancho a tercios, así que en un móvil estrecho quedan ~86px de
    contenido: valor y etiqueta llevan `adjustsFontSizeToFit` (mismo recurso que
    las Progress cards) para que ninguna se parta ni se trunque.
- **Los 3 datos** (decisiones del usuario, no había número para dos de ellos):
  - `adherencePct()` **nuevo** en `src/utils/adherence.js` (con test): sesiones
    hechas vs esperadas en una ventana móvil de **28 días**. Ventana de días y
    no de semanas de calendario para que un lunes no hunda el número; un cliente
    con menos historia que la ventana se mide contra lo que lleva, no contra 4
    semanas que no ha vivido. Capado al 100%. Es el único de los tres que se
    colorea cuando pide atención — los otros dos describen, no juzgan.
  - Ritmo: el `recentPerWeek` que ya existía.
  - Carga media: media de carga externa de **7d vs 28d** en %, el mismo par de
    medias del que sale `loadState` en el panel de Carga. Necesita ≥14 días.
- **Los avisos van ENCIMA de la tarjeta** (etapa bloqueada, bloque terminado y,
  nuevo aquí, **cambios sin enviar** — que antes era un botón naranja en la fila
  de acciones). Así la tarjeta tiene siempre la misma forma. El aviso suave de
  "terminó la etapa y sigue en ella" se queda dentro, bajo la barra.
- **Acciones**: `[Editar programa] [Ver programa] [⋯]` con la variante Secondary
  real (`surface2` sólido, sin borde, `radius/md`, h44). **Todo lo demás está en
  el `⋯`**, que ahora es un `DragSheet` (antes un `Modal` propio con menú
  contextual): nuevo programa · subir a cliente · importar · compartir ·
  exportar · programas anteriores · quitar asignación · eliminar.
  - **Programas anteriores dejan de ser un acordeón** en la pantalla y pasan a
    su propia hoja. Se abre con 250 ms de retardo: dos `Modal` de RN no se
    relevan bien en el mismo tick y el segundo se queda sin presentar.
- **Próxima sesión** en sección propia (etiqueta con el tratamiento de
  `SectionHeader` de HomeView — `text/spacing-tag` `mutedLight` **en mayúsculas**
  — y tarjeta `surface` con letra accent, nombre y `6 ejercicios · 55 min aprox`
  de `sessionStats`; el botón `Preparar` conserva la **diana** que ya tenía y va
  en `tint/accent-10` + texto accent, porque el `surface2` del Secondary no se
  separaba del `surface` de la tarjeta) y
  **una línea de explicación debajo, fuera de la tarjeta**: es un ajuste puntual,
  el programa no cambia. Sustituye a la caja azul `heroNext`.
- **Tarjeta de código de conexión** (`ClientCodeBlock`, un componente, dos sitios):
  en el tab de Programa **mientras el cliente no ha canjeado el código**, y
  siempre en Info. La señal de "conectado" es nueva: `slot.client_id` ya venía en
  `getTrainerSlots` y ahora `refreshTrainerSlots` lo vuelca a `client.syncLinked`
  — tener slot solo significa que lo creaste tú, no que el cliente esté dentro.
  Además lleva un **`Entendido`** terciario (solo texto) que la retira del tab de
  Programa para siempre (`client.codeHintDismissed`): si a ese cliente no vas a
  conectarlo, la tarjeta se quedaría ahí sin nada que hacer. En Info sigue.
- De paso: 137 claves de estilo muertas fuera del `makeStyles` (49 las dejó sin
  uso este cambio, 88 ya lo estaban), y `allExercises` memoizado porque ahora
  alimenta el cálculo de carga.

Pendiente: el `⋯` de la cabecera que dibuja el HTML se ha dejado **fuera** —
todas sus acciones son ya pestañas o están en el `⋯` del programa.

### Progreso › pestaña Carga — desglose

Pantalla **nueva**, no un restyle: no existe en Figma porque la feature es
posterior al diseño. Spec funcional completa en
[`specs/training-load.md`](specs/training-load.md); aquí solo lo visual.

- **Entrada**: `SegmentedControl` `EJERCICIOS | CARGA` en `ProgressPanel.jsx`,
  que consumen tanto `StatsScreen` como el detalle de cliente de `ClientsScreen`.
  El conmutador va FUERA del scroll de cada pestaña: cada una trae su propia
  `ScrollView` con su padding de página.
- **Reutiliza sin cambios**: la anatomía de las Progress cards (`surface`,
  `radius/lg`, valor `text/hero`, label `text/spacingTag`) y el
  `SegmentedControl` de período.
- **Gráficos propios**, no el `MiniLineChart` de `ProgressTab`: aquel guarda las
  posiciones en un array FIJO de 80 `Animated.Value` y aquí las series son un
  punto por día. Dos componentes locales, `LoadChart` (barras + 2 medias) e
  `IndexChart` (líneas indexadas). Los tramos sin dato **parten la polilínea**
  en vez de cruzarla con una recta que inventaría carga.
  - Trampa pisada: el punto que remata cada línea se recortaba a la mitad porque
    el eje llegaba al borde exacto del SVG. Se insetea el radio del punto.
- **Sin toggle de "Programa actual"** y período `1M/3M/6M/Todo` (no `7D`): ver
  las reglas §4 de la spec, no son decisiones estéticas.
- **Iconos ⓘ solo en los títulos de gráfico.** Las tarjetas pequeñas son
  pulsables enteras y sin icono: en una caja de 108 px con un número grande y dos
  etiquetas el aro era ruido. Ver [`specs/metric-transparency.md`](specs/metric-transparency.md).

### Recap de sesión — desglose

**No tiene nodo en Figma** (no aparece en la extracción de Pages). Por tanto NO se
extrajo nada: hereda anatomías ya cerradas en otras pantallas, que es la única
forma de restylear sin inventar. Si algún día el usuario dibuja el recap en Figma,
esta pantalla se re-verifica contra ese nodo como cualquier otra.

- **Página**: `paddingHorizontal: space/lg`, `gap: space/md` — igual que History/Progress.
- **Cabecera**: tag `text/spacingTag` accent + nombre `text/hero` + etapa `text/subtitle`.
- **3 cards de cabecera** (duración/volumen/series): anatomía EXACTA de las Progress
  cards (`surface`, `radius/lg`, valor `text/hero`, label `text/spacingTag`), con
  `adjustsFontSizeToFit` como allí. Sin la 3ª línea de subtítulo (aquí no hay delta).
- **Series**: pasan de una cadena de texto (`setsLine()`) a las **pills compartidas**
  de `src/utils/setDisplay.js` — las mismas de History y del detalle de ejercicio, con
  su anatomía real (sin borde, `radius/xs`, padding `space/sm`, "@" en tint-50). El
  `exConfig` que necesita `getPillVariant` sale del propio log: la entrada guarda
  `minReps`/`maxReps` por ejercicio.
  - **Dropset**: se conserva el encadenado con "→", ahora como pills neutras con la
    flecha DELANTE (es continuación de la serie anterior — al revés que las pills de
    calentamiento de `ExerciseCard`, donde la flecha va detrás).
- **Lista de ejercicios y de bloques**: lista agrupada con `getCardRadii`, gap
  `space/xs`, en vez de una card con divisores.
- **PRs**: relleno `tint/accent-10` **sin borde** — mismo tratamiento que las tarjetas
  "Resumen" de los editores. Antes tenía borde accent.
- **Desviación vs sesión anterior**: **texto suelto alineado a la derecha, SIN pill** —
  mismo tratamiento que `sesDelta` en el detalle de ejercicio de Progreso
  (`textStyles.cardType` coloreado). Las pills quedan reservadas a los datos de serie y
  al badge de PR, que allí también es pill. Aplicado igual a los deltas de bloque (misma
  función en una lista contigua). Color: `accent` para mejora — en este tema no hay
  verde semántico — y **rojo apagado** (`tint/red-50`) para retroceso, decisión
  explícita del usuario para el recap ("motivación honesta"), aunque el detalle de
  ejercicio use naranja. Son dos decisiones distintas para dos pantallas distintas.
- **Escala de sRPE**: botones propios, **NO `SegmentedControl`**. Regla del usuario:
  el segmented sirve para *alternar entre opciones/vistas existentes*, no para puntuar
  en una escala. Aun así el cambio de estado no puede ser en seco (§4.10), así que cada
  botón interpola su color de fondo y de texto con Reanimated (`interpolateColor`,
  160 ms) — ver `RpeButton` en el propio fichero.
- **Sin bordes en ninguna card** (§4.6) y `typography` genérica retirada por completo:
  la pantalla usa sólo `textStyles`.

### Plantillas — desglose

Nodo de Figma: **`235:4471`**, que en el archivo se llama "Clients" — se duplicó
de la pantalla de clientes y nadie la renombró. El contenido es la lista de
plantillas (ya avisaba `figma-extraction/pages/clients-2.md`). La tarjeta es la
variante *Plantillas* del set `Sesion Card` (`204:1901`).

- **Cabecera calcada de Clientes**: `PLANTILLAS · N` a `text/hero` (contador en
  accent) + `+ Plantilla` accent a 42 de alto, `radius/md`, `text/card-type` en
  `onAccent`. Fuera la divisoria inferior y el título trackeado en `muted` que
  tenía. **Sin buscador ni filtros** (decisión del usuario): Figma no los dibuja
  aquí y con pocas plantillas serían ruido. Página a `space/lg` (antes `xl`),
  lista con gap `space/sm`.
- **Tarjeta de tres piezas** — `surface`, `radius/md`, px `space/lg`, py
  `space/md`, y **gap 18** entre el bloque de info y la fila de acciones (el mock
  usa el token `radius/lg` como gap: vale el número, no el nombre, §4.3):
  1. nombre a `text/card-title`;
  2. **3 stats** `N ETAPAS · N CICLOS · N SESIONES` — número en `accent` con
     `text/spacing-tag`, etiqueta en `mutedLight` con `text/SmallBold`,
     `space/xs` entre los dos y 9 entre stats. Sustituyen a la línea de texto
     `editor.programSummary` que pintaba antes;
  3. fila de acciones con los dos botones `color/muted` de Figma en
     `justify-between`.
- **Cambios de contenido pedidos por el usuario** (mandan sobre el mock, §10):
  - **Fuera el eyebrow "PLANTILLA"**: en esta pantalla todo es una plantilla.
  - **De 4 botones + icono de compartir a UNO**: `Asignar`, solo, en columna a
    la derecha (en QA la fila inferior de Figma dejaba la tarjeta demasiado alta
    para lo poco que dice). El botón de `···` **no existe**: pulsar la tarjeta
    abre su hoja de opciones, que es un área de toque enorme comparada con la
    caja de 26 px del icono.
  - Etiquetas de los stats a **10 px** (Figma pide `text/SmallBold`, 8) y los
    textos de apoyo de las hojas a `text/subtitle` (12, antes `text/tag`): a 8 y
    10 px no se leían en dispositivo. Misma familia y tracking, solo el tamaño.
- **CICLOS, no "SEMANAS"**: el mock dice semanas pero `durationWeeks` cuenta
  vueltas al ciclo — misma decisión ya cerrada en el editor de programa y en el
  banner de Home, y así lo dice ya `editor.programSummary`. Con alguna etapa sin
  límite de ciclos, ciclos y sesiones se pintan con `+`.
- **Los tres modales propios pasan a `DragSheet`** (§9), y con ellos los dos
  `Alert.alert`:
  - `···` → hoja con el patrón `SheetRow`: ver · editar · duplicar · compartir ·
    exportar · eliminar (rojo).
  - **Nueva plantilla** → hoja con `StepField` horizontales (sesiones y ciclos)
    en vez de los dos pickers de cifras sueltas. "Sin límite de ciclos" es el
    `Switch` compartido de `ui/EditorRows`, no una fila-botón: es un estado del
    propio ajuste, y con él activo el stepper desaparece porque no hay número que
    contar. La explicación del ciclo va DEBAJO del control, no entre el título y
    él. CTA accent abajo, y el botón derecho del encabezado pasa de "Aceptar" a
    "Cancelar" (`action`) para que no lea como un segundo submit.
  - **Asignar a cliente** → hoja donde cada fila de cliente dice qué programa
    tiene. **El Alert de "ya tiene programa activo" desaparece**: el aviso
    (`Reemplaza: X`, en `orange`) se lee en la propia fila ANTES de elegir, que
    es donde sirve de algo. Se monta solo mientras hay destino, para que la
    selección arranque en blanco en cada plantilla.
  - **Eliminar** → hoja de confirmación con el par `surface2` / `tint-red-30`
    que ya cierra el editor de ejercicio.
- **Estado vacío y gate PRO**: sus cadenas estaban **hardcodeadas en español**
  dentro del JSX; ahora están en i18n (`templates.proTitle/proBody/proCta/
  hideTab`) y usan `textStyles`. Fuera los emoji 📐 de cabecera.
- Las claves i18n que sigue usando la app web legada (`templates.badge`,
  `contextUseWithClient`, `assignModal.clientLabel`/`programNameLabel`) **no se
  borran** aunque el móvil ya no las lea — mismo precedente que el buscador de
  ejercicios.

### Program Editor — desglose

Nodo de Figma: `210:2864`. Cambios de **comportamiento** pedidos por el usuario que
no están dibujados en Figma (mandan sobre el mock, §10):

- **Guardar y cerrar**: desaparece el botón `Guardar`/`Guardado` del header. El botón
  grande del final (`388:2676`, h44, `#b8ff00` literal) guarda y hace `goBack()`. Salir
  por la flecha sigue disparando el aviso de cambios sin guardar (`beforeRemove`, ya
  existía).
- **Nombre del programa**: se edita pulsando el título dentro de la cabecera accent
  (o el lápiz de al lado), no en un input aparte. `nameValue` solo es fuente de verdad
  mientras `editingName` está activo — fuera de ahí manda el store.
- **Etapas**: el `+` va dentro del propio control segmentado (a partir de 4 etapas los
  segmentos dejan de repartirse el ancho y la fila scrollea en horizontal, con el `+`
  siempre fijo fuera del scroll). Se eliminan la fila-tarjeta "Etapa N" y el botón
  "+ Añadir etapa": el modal de etapa se abre **volviendo a pulsar la etapa ya
  seleccionada**, y en su sitio queda el texto `editor.stageTapHint`.
- **Sesiones reordenables**: asa de arrastre (`Icons/Arrastre` `184:2371` — 2×3 puntos
  de 3px `mutedLight`) + la letra delante del nombre, en lugar del eyebrow "SESIÓN A".
  El orden vive en `dragOrder` solo mientras dura el gesto y se vuelca al soltar con
  `reorderSessionsInStage`. La letra significa **posición en el ciclo**, no identidad:
  al reordenar se reasignan A/B/C… por posición (misma convención que
  `addSessionToProgram`); el `name` de la sesión no se toca.

Decisiones de extracción que conviene no volver a re-litigar:

- La cabecera pinta el eyebrow en `color/muted` (#4d4d4d) **sobre el lima**, no en
  `onAccent` — es lo que dice Figma y lee bien.
- El `Resumen` de esta pantalla **no lleva borde**: solo relleno `tint/accent-10`.
  El código anterior le había puesto uno.
- El segmented de etapas es la variante `Etapas` (`210:3344`): contenedor `radius/md`
  (no `full`, como el de 1 línea), y en el segmento activo la 2ª línea va en
  `color/surface2`, no en `onAccent`. Por eso vive en `StageSelector.jsx` y no como
  una prop más de `SegmentedControl` (que usan otras 4 pantallas).
- `durationWeeks` se muestra como **ciclos**, no semanas: el campo tiene nombre
  legado pero `threshold = durationWeeks * days.length` confirma que cuenta vueltas
  al ciclo, y así lo llaman Figma y el banner de Home.

Divergencias resueltas contra la imagen que mandó el usuario (Figma perdió en 2 de 3):

| Pieza | Decisión |
|---|---|
| Botón guardar | Figma: `GUARDAR PROGRAMA` en mayúsculas, `text/card-type`, h44 |
| `+ Añadir sesión a X` | Imagen: texto plano centrado, **sin** la caja outline de Figma |
| `+` de etapas | Imagen: glifo accent sobre `surface2`, **no** el cuadrado relleno `#b8ff00` de 37×37 del nodo oculto `210:3274` |

### Sesion Editor — desglose

Nodo de Figma: `208:1932` (**re-extraído**: el usuario lo rehízo después de la primera
lectura, y los ids de nodo y el layout cambiaron respecto a
`figma-extraction/pages/sesion-editor.md`, que ya no vale). Comparte cabecera, tarjeta
Resumen y botón de añadir con el editor de programa — los iconos comunes viven ahora en
`src/components/ui/EditorIcons.jsx`.

- **Una sola lista** para ejercicios y bloques, con la misma fila (`surface`,
  `radius/sm`, px `space/md`, py `space/sm2`, gap 12 literal entre número y contenido).
  Numeración corrida `01`, `02`… Una **superserie es UN número con letras** (`03A`,
  `03B`): sus filas van a 2px con los radios interiores a `radius/xxs` y el grupo
  envuelto en una barra `accent` de 2px a la izquierda (`209:2479`).
- **Bloques mezclados con los ejercicios**, como en el mock. Esto **supera** la regla de
  `docs/specs/conditioning-blocks.md` que los mandaba siempre al final (la spec queda
  anotada). Cualquier hueco puede ir a cualquier posición y ese orden es también el que
  se entrena: `WorkoutScreen` pinta la lista con el mismo helper
  (`src/utils/sessionSlots.js`), bloques incluidos, y sus puntos de progreso siguen ese
  orden. La numeración va por hueco en las dos pantallas, así que un bloque **consume su
  número** y lo pinta: `ConditioningBlockCard` recibe `orderNumber` y lo dibuja con el
  mismo tratamiento que el `num` de `ExerciseCard` (Inter Black 17, accent,
  tabular-nums). En el estado terminado no se pinta, porque ahí manda el ✓ — igual que
  en la tarjeta de ejercicio colapsada.
  El campo nuevo es `block.order` = índice **entre huecos**, no entre ejercicios: así un
  bloque no puede colarse en mitad de una superserie y partirla. Sin `order` (datos
  viejos) el bloque va al final, o sea que no hay migración. Cubierto por
  `src/utils/sessionSlots.test.js`, ida y vuelta incluida.
- **Se arrastra el hueco entero**, así que una superserie se mueve como una pieza y no
  se puede romper por accidente. Entrar/salir de una superserie sigue siendo cosa del
  editor de ejercicio.
- **Solo queda una pill**, la del formato de bloque (EMOM / AMRAP / On-Time). Todo lo
  que antes eran badges (progresión, vinculación, UNI, RPE) pasa al subtítulo separado
  por puntos medios: `3 × 12-14 · 60s · prog. auto. · Vinculado A, B`. Unilateral y RPE
  dejan de verse en la lista (decisión explícita) y solo existen dentro del editor de
  ejercicio. La progresión solo se nombra cuando es automática.
- **Etiqueta de sección** sobre la lista (`Ejercicios · 7`), mismo tratamiento que las
  del editor de programa: `text/spacing-tag` en `mutedLight` con `paddingTop: space/md`.
  El número cuenta **huecos**, no ejercicios, así que coincide con el último número de la
  lista y cuenta los bloques (el "3 ejercicios" del Resumen sí cuenta solo ejercicios).
- **Resumen** gana una 3ª línea (`text/tag`, `tint/accent-50`) con el volumen en
  lenguaje natural en vez de las pills por patrón: `Volumen: 10 series de tracción,
  3 de pierna, 1 bloque`.
- **Asa de arrastre a la derecha**; el swipe a la derecha para sustituir/eliminar se
  conserva (Figma no dibuja esas acciones en ningún sitio). El asa reclama el gesto en
  `onStart`, así que se lleva los toques que caen sobre ella antes que el swipe.
  Los dos botones que descubre el swipe son botones de verdad, no bloques de color a
  sangre: `radius/sm`, `text/card-type`, `space/lg` de padding lateral, separados por
  `space/sm`, y con `space/sm` de aire arriba y abajo (no llegan al alto de la fila) más
  `space/md` entre el último botón y la tarjeta ya deslizada. **Sustituir** = fondo
  `color/surface-2` (el mismo relleno que los botones Secondary de Figma) + texto
  `color/text`; **eliminar** = fondo `tint/red-30` + texto `tint/red-50`. Con la fila
  abierta, el número se cambia por una flecha hacia atrás: es la pista de que se devuelve
  a su sitio tocándola.
- **Un solo botón de añadir** que abre un `DragSheet` con Ejercicio / Bloque / Desde
  preset (esta última solo si hay presets). Nada de `Alert` nativo: no se puede estilar.
- **`···`** abre otro `DragSheet` con duplicar / restaurar (solo si la sesión está
  editada) / eliminar (solo si queda más de una).
- El segmented A–E es la variante *Group together* tal cual: se reutiliza
  `SegmentedControl` sin tocarlo.
- **Sin botón de guardar**: el snapshot y el guardado viven en el editor de programa.

El swipe sigue con `Animated` de RN core en vez de Reanimated: es lógica previa que se
conserva tal cual, anima solo `translateX` y no mezcla drivers, así que no cae en la
trampa de §8. El reordenado sí es Reanimated, con el mismo enfoque que el editor de
programa (no se toca el orden pintado durante el gesto) — pero aquí los huecos tienen
alturas distintas, así que se miden todos y el umbral de salto se calcula contra el alto
del vecino, no contra un paso fijo.

### Exercice Editor — desglose

Nodo de Figma: `123:1511` (+ componentes `Exercice editor elements` `160:1197` y
`Option blocks` `176:1902` / `176:1952`). Vive dentro del modal de ejercicio del
Sesion Editor, así que la **cabecera** (barra accent con el nombre + chevron y
botón `Aceptar` gris `color/muted`) se pintó en `SessionEditorScreen.jsx`, fuera
del `ScrollView`, para que no se vaya con el scroll. El chevron de la barra
**sustituye** el ejercicio, igual que el botón del pie.

Orden del mock: Resumen → VOLUMEN → PROGRESIÓN → OPCIONES (lista agrupada) +
Vinculación. Piezas concretas:

- **Resumen** (`166:1245`): igual que en los otros dos editores — solo relleno
  `tint/accent-10`, **sin borde**, con la 3ª línea (`text/tag`, `tint/accent-50`)
  ocupada por la frase de progresión.
- **Cajas ±** (`142:1119`): `surface`, `radius/sm`, padding `space/md`, alto fijo
  68, botones 30×30 `surface2` / `radius/xs` con el símbolo en `tint/accent-50`
  a 24px. Figma dibuja el mismo componente de dos formas (dos cajas a alto 68 con
  los botones centrados y separados 26, otras dos hug con los botones a los
  bordes) — es una inconsistencia del mock y se unificó en **alto 68 + botones a
  los bordes**. El valor va en `text/card-title` sobre `color/text` (en Figma es
  `#fff` suelto, sin vincular).
- **Lista agrupada de opciones** (`176:1902`): contenedor `radius/md` +
  `overflow:hidden` y cada fila a `radius/xxs` con gap `space/xs` — el recorte
  del contenedor es lo que redondea las esquinas exteriores, así que no hace
  falta calcular radios por posición como en Progress.
- **Switch** (`176:1907`): carril 26×14.18 `radius/full`, pulgar 11.82. Figma
  solo dibuja el ON (carril `accent`, pulgar negro); el **OFF es decisión
  nuestra**: carril `surface2` + pulgar `mutedLight`. Animado con Reanimated
  (`interpolateColor` + `translateX`, 180 ms ease-in-out).
- **Textarea de la nota**: en Figma va sobre `color/workout-card` (#141414), que
  no es token del tema — se usa `th.colors.bg` (#151515), 1 unidad de diferencia.
- **Vinculación** (`176:1952`): tarjeta aparte (`surface`, `radius/md`), pills
  apiladas a ancho completo con `padding-x` 9 (literal, no hay token). Ninguna /
  grupo → `text/btn-action`; seleccionada → fondo `accent` + `onAccent`;
  `+ Nuevo grupo` → `text/subtitle` `mutedLight` centrado. Sigue apareciendo solo
  cuando el ejercicio existe en más de una sesión.
- **Icono de la fila de progresión** (`163:1223`): 3 barras ascendentes con el
  remate en diagonal, resueltas a coordenadas finales en `ProgressionIcon`
  (`ui/EditorIcons.jsx`) en vez de replicar las 3 rotaciones del asset.

Tres piezas de la app **no existen en el mock** y se resolvieron con el patrón
"fila + hoja" que Figma ya usa para Progresión y Tempo (decisiones del usuario):

| Pieza | Solución |
|---|---|
| Calentamiento | Sección propia `CALENTAMIENTO` con una `NavRow` (título = modo, subtítulo = `3 series · 60s de descanso`) que abre un `DragSheet` con toda la configuración |
| Modo de progresión (Auto/Fija/Submáx) | Pasa a ser el **paso 1** de la hoja de progresión; la pantalla queda con una sola fila, como Figma |
| Tempo | La fila muestra el valor (o `—`) y abre una hoja con el input |

Los botones **Sustituir / Eliminar** del pie tampoco están en Figma: son
funcionalidad pedida aparte y usan el lenguaje de los botones que descubre el
swipe en la lista del Sesion Editor (`surface2`/`text` y `tint/red-30`/
`tint/red-50`). El botón **Restaurar** que tenía la app se eliminó (no está en
Figma y el editor autoguarda).

### Editor de bloques — desglose

Nodos de Figma: `190:1661` (AMRAP) y `192:1897` (EMOM). **No hay frame de "For
time"** — se compone por analogía. Comparte cabecera con el editor de ejercicio
(barra accent con el nombre + desplegable de los bloques de la sesión, botón
`Aceptar`), Resumen y etiquetas de sección.

- **Secciones numeradas** (`1. FORMATO`, `2. INTERVALO`, `3. MOVIMIENTOS`) como
  en el mock; `OPCIONES` va sin número. El número de MOVIMIENTOS depende del
  formato, porque solo EMOM mete INTERVALO en medio.
- **"Rotar ejercicios" deja de ser un switch** y pasa a segmentado
  `Repetir bloque / Rotar ejercicios` (sigue mapeando a `emomMode`).
- **Intervalo**: el `120s` de la app se cambia por `Custom`, que abre una fila ±
  de 10-300s en pasos de 5. Un `intervalSec` que no esté entre los presets
  arranca ya en modo Custom.
- **For time**: rondas en fila ± y el tope como segmentado `Sin tope / Con tope`
  (no un switch), coherente con que en Figma los modos son segmentados.
- **Tarjeta de movimiento — se APARTA del mock, a dos líneas.** Figma la dibuja como
  fila compacta (nombre + campo + unidad + peso + `Kg` + asa, todo en una línea de 42),
  pero ahí el nombre competía con dos inputs, el selector y el asa, y se truncaba casi
  siempre. Ahora el cuerpo va a dos líneas — **nombre a `text/cardType`, hasta 2
  líneas**, y debajo los controles (cantidad + selector de unidad, y el peso + `Kg`
  a `space/lg` de ellos: junto, pero con aire que separa los dos pares) — y el asa
  es HERMANA del cuerpo, centrada contra el alto entero de la tarjeta, no contra la
  línea del nombre. Y deja de ser lista agrupada: **cada movimiento es una
  tarjeta suelta** con `radius/sm` completo y `space/sm` entre ellas — con dos líneas
  por movimiento los radios interiores de 2 px ya no agrupaban nada.
  El "reps" del mock ES el selector que ya existía: pulsable (cicla reps/cal/m/seg),
  en `color/accent` y con nombres de 3 letras (`s` → `seg`/`sec`); ahora con caja
  `tint/accent-10` para que se lea como control junto a su campo. Eliminar sigue en
  el swipe, con el mismo botón `tint/red-30` de la lista del editor de sesión.
  Reordenar movimientos es **funcionalidad nueva**, con el mismo `Sortable.Grid` que
  los otros dos editores (ver §"Reordenar").
- **Unidad por defecto de un movimiento nuevo**: sale del ejercicio — los que
  tienen `progressionModel: 'time_progression'` entran en segundos, el resto en
  reps. Antes siempre entraban en reps.
- Los campos (`Input Field`, nombre, nota) van sobre `color/workout-card`, que en
  este tema es `th.colors.bg`; "Añadir ejercicio" es outline `tint/accent-50`;
  "Guardar preset" es `surface2`; "Eliminar bloque" texto rojo sin fondo.

### Buscador de ejercicios — desglose

**No hay frame de Figma**: se compone a partir de dos imágenes de referencia que
mandó el usuario, traducidas a las convenciones ya cerradas (§9) — la referencia
usa su propio lenguaje de barra de búsqueda y botones, que **no** se copia.

- **Cabecera**: título `text/hero` (`Añadir ejercicios` / `Sustituir ejercicio`,
  según modo) + caja de cerrar 42×42 `surface2`.
- **Buscador + filtro**: la barra estándar (`surface2`, `radius/sm`, h42, lupa +
  ✕) y la caja de icono 42×42 con el **mismo icono de filtro que Clientes**
  (`M3 6h18M6 12h12M9 18h6`) y su badge accent con el nº de filtros aplicados.
- **Pills de patrón** (fila horizontal, single-select, se apaga volviendo a
  pulsarla). Los 9 `pattern` de la librería se colapsan a los **7 gruesos** de la
  referencia (Empuje/Tracción funden vertical+horizontal): decisión explícita del
  usuario, se pierde poder filtrar vertical vs. horizontal desde la UI.
- **Hoja de filtros** = `DragSheet` con GRUPO MUSCULAR / EQUIPO / TIPO en pills
  grandes multi-select (`surface2` → `accent`+`onAccent`). Se aplican **en vivo**;
  el CTA de abajo (`Ver N ejercicios`) solo cierra y `Limpiar` resetea. Para poner
  "Limpiar" donde `DragSheet` pinta "Aceptar" se le añadió una prop opcional
  `action={{ label, onPress }}` — el resto de hojas no cambia.
  `equipment: []` (43 ejercicios) se presenta como **Corporal**, que no es un
  valor real de la librería sino la ausencia de equipo.
- **Fila**: `surface`/`radius/sm`, nombre `text/card-title` + subtítulo
  `primaryGroup · equipo`. Seleccionada = fondo `tint/accent-10` y nombre en
  `accent`. Checkbox 36×36 (`surface2` → `accent`) solo en modo añadir; en modo
  sustituir/picker de bloque va la `ArrowIcon` y elegir cierra la pantalla.
- **Sustituir** arranca con la pill del patrón del ejercicio actual ya activa.
  Sustituye al viejo modo "Similar", que además filtraba por `level` sin que eso
  se viera en ningún control.
- **Se elimina el modo "Complementario"** (ordenar por patrones que faltan en la
  sesión). `existingPatterns` sigue llegando por params desde
  `SessionEditorScreen` pero ya no se lee.
- `+ Crear ejercicio` se queda donde estaba (encima de la lista) pero pasa al
  tratamiento de `+ Añadir sesión`: texto plano `text/card-type` en
  `tint/accent-50`, sin la caja dashed.

Las claves i18n viejas (`tabSimilar`, `tabPattern`, `allMuscles`, `levelBeginner`…)
**no se borran**: las sigue usando el selector de la app web
(`src/components/editor/ExerciseSelector.jsx`, fuera de `mobile/`).

### Alta de ejercicio nuevo — desglose

**No hay frame de Figma**: el pedido fue "que se parezca mucho al editor de
ejercicios real, misma estructura, mismos elementos de UI". Para que fuera
literal y no solo "parecido", se extrajeron `Switch`/`OptionRow`/`ToggleRow`/
`NavRow`/`NoteRow` de `ExerciseEditorInline.jsx` a un módulo compartido
(`src/components/ui/EditorRows.jsx`) — antes vivían como funciones locales no
exportadas. `ExerciseEditorInline.jsx` ahora importa de ahí; el alta de
ejercicio (`CustomExerciseScreen.jsx`) usa exactamente los mismos componentes,
no una reimplementación. También se centralizó la taxonomía (patrón/grupo
muscular/equipo) en `src/utils/exerciseTaxonomy.js`, de donde tira tanto el
buscador como el alta.

Estructura resultante (RESUMEN → VOLUMEN → PROGRESIÓN → OPCIONES), igual que el
editor real, más dos piezas que solo tienen sentido en el ALTA:

- **Nombre**: campo propio arriba del todo (el editor no lo necesita, el
  ejercicio ya existe).
- **Clasificación** (patrón / grupo muscular / equipo / tipo / nivel técnico):
  un único `NavRow` que abre una hoja con todo — sustituye a los chips sueltos
  de "Patrón"/"Material" y las "Opciones avanzadas" que tenía la pantalla
  antigua. Mismo patrón "fila + hoja" que Progresión/Calentamiento en el editor
  real (tampoco están en Figma). El título de la fila muestra el resumen de
  tags ya elegidos (o el hint vacío); el subtítulo es fijo, explica qué
  contiene la hoja.
- **Resumen**: la línea de volumen añade el patrón y el equipo tras el
  descanso (`3 × 8–12 reps · 90s descanso · Tracción · Mancuernas`), pedido
  explícito del usuario. Se usa `" · "` (no el guión que escribió en el chat),
  siguiendo la regla ya establecida de "guión en el mensaje = punto medio en la
  app" (§4.5).
- **Progresión** reutiliza el mismo sistema que el editor real (Modo → Tipo →
  Incremento), pero **sin el paso de evaluación**: `pctThreshold`/`evalMode`
  son config por SESIÓN (`exConfig.progression`), no de la ficha de librería —
  la ficha solo puede persistir `progressionModel` (legado) y `weightStep`. Los
  pasos se renumeran 1/2/3 en vez de 1/2/3/4.
- **Unilateral** se queda en OPCIONES (como en el editor), no dentro de
  Clasificación: es una propiedad de ejecución, no una etiqueta de búsqueda.
- **Acciones** (Cancelar/Crear) van al final del scroll, no en un footer fijo
  — pedido explícito del usuario.

### Menú principal (≡) — desglose

**No hay frame de Figma**: la referencia es un HTML que mandó el usuario
(`formfit-v29-Main menu.html`) más su texto explicando cada decisión. El menú era
un `card outlined` que contenía `cards outlined` — dos niveles de caja para lo
mismo; ahora son **listas fusionadas**: `section-label` (`spacingTag`
`mutedLight`, la misma de toda la app) + filas del sistema de listas agrupadas
(`getCardRadii`, gap `space/xs`). Éste es su caso de uso canónico: filas
uniformes de consulta/configuración.

- **`getCardRadii` se mudó a `src/theme.js`** (antes vivía suelto en
  `ProgressTab.jsx`): ahora lo comparten Progress, el detalle de ejercicio y el
  menú.
- **`SettingsSheet` ya usa `DragSheet`** (lo pedía §9): se borraron su `Modal`,
  su `PanResponder` y sus estilos propios. `DragSheet` acepta ahora **`title`
  opcional** — sin título pinta solo el asa, que es lo que necesita este menú.
  Efecto colateral: 10 errores de lint menos en `AppHeader.jsx` (13 → 3, los 3
  preexistentes).
- **Iconos en gris (`mutedLight`), no en lima**: son decoración funcional. El
  lima queda para lo que informa (estado, badge PRO, tema activo). Paths SVG
  copiados literalmente de la referencia.
- **Bloque de identidad arriba, solo PRO** (decisión del usuario) y **sin
  avatar**: nombre editable inline con lápiz (mismo patrón que el título del
  programa en el Program Editor) + `Entrenador · aparece en tus programas` +
  badge PRO. El nombre es `trainerSync.trainerName` — el que ven los clientes —
  y sustituye al campo "Tu nombre" que estaba enterrado en CUENTA. Una cuenta
  free entra directa a los ajustes, sin cabecera ni título "AJUSTES".
- **CONEXIONES con estado visible**: 2 filas de 2 líneas (Entrenador, Copia en
  Google Drive) + una 3ª solo en PRO (Sincronización con clientes). Navegan a
  las pantallas que YA existían (`TrainerConnection`, `DriveBackup`), así que
  desaparecen del menú las 4 filas sueltas de entrenador (cambiar, vincular
  Google, desconectar) y `DriveBackupModal` se queda sin usos. El subtítulo de
  Drive lleva **cuándo** fue la última copia (`hoy 9:41`), que en una app
  offline es el dato que tranquiliza, no "backup activo".
- **DATOS de 4 filas a 2**: una sola fila `Exportar` abre un `DragSheet` donde
  se elige el alcance (backup completo / programa + historial). Menos decisiones
  en el menú, más contexto en el momento de decidir.
- **PREFERENCIAS con controles inline**: unidades e idioma como
  `SegmentedControl` de ancho fijo (104) dentro de la fila — sin navegar. El
  idioma va **ES/EN sin banderas** (una bandera no representa un idioma). El
  tema pasa de texto a **muestras**: cada chip usa el `surface` y el `accent` de
  SU tema, con anillo lima en el activo (5 temas, no los 4 de la referencia).
- **CUENTA**: `Plan y facturación` (valor `Activo` en PRO / badge `FREE` que abre
  el paywall) y `Ayuda y soporte` → **Documentación**, pantalla nueva
  (`DocsScreen`) con la terminología de la app. El texto vive entero en
  `docs.sections` de i18n como lista de `{title, body}`: añadir apartados es
  editar ese array, no la pantalla.
- El toggle de pestañas PRO (solo free) pasa a `PREFERENCIAS` con el `Switch`
  animado de `ui/EditorRows`, en vez del botón de texto que tenía.

Dos desviaciones conscientes, por si en QA se quieren al revés:
`.val`/chevrons van en `muted` como la referencia, pero los **subtítulos de 2
líneas en `mutedLight`** (en `muted` a 11px casi no se leen, y es lo que ya usan
las `NavRow`); y el **punto de estado del entrenador es lima**, siguiendo el
texto del usuario ("dot lima" en las dos filas) y no la regla §8 de "azul =
entrenador" que sí aplica en HomeView.

### Entrenador y Copia en Drive — desglose

**No hay frame de Figma** para ninguna de las dos: eran las últimas pantallas
pre-migración (escala `typography`, `borders`, cadenas hardcodeadas en español) y
el encargo fue doble — traerlas al lenguaje de la app **y revisar que lo que
cuentan sea correcto, explicativo y claro**, sobre todo la del entrenador.

- **`ui/MenuList.jsx` nuevo**: `Section`, `SectionLabel`, `MenuRow`, `Status` y
  `RowIcon` salen del menú principal a una primitiva compartida, para que estas
  dos pantallas usen EXACTAMENTE las mismas filas (mismo precedente que
  `EditorRows.jsx`). `MenuRow` gana `subLines` (0 = sin límite, para subtítulos
  que explican en vez de resumir) y `labelColor` (acciones destructivas).
- **`utils/formatWhen.js` nuevo** (+ test): `hoy 9:41` / `ayer 21:03` /
  `14 jul 9:41`, con año solo si es otro. Lo usan el menú, Drive y Entrenador —
  antes el menú lo tenía como helper local y las dos pantallas usaban
  `toLocaleString('es-ES')` a pelo, que ignoraba el idioma de la app.
- **Cabecera** de las dos: título `text/hero` + caja de cerrar 42×42 `surface2`,
  igual que el alta de ejercicio y Documentación (fuera el `‹` y el título
  trackeado en `muted`).
- **Tarjeta de estado**: tratamiento del "Resumen" de los editores (relleno
  `tint/accent-10`, sin borde) con punto + etiqueta + titular + explicación.
  Pierde el tinte lima cuando el estado NO es bueno (sin conectar; en Drive
  también con el permiso caducado): en este tema el lima significa "esto va
  bien".
- **Pestañas de Drive** = `SegmentedControl` (antes un tab bar con subrayado que
  no existe en ningún otro sitio de la app). Frecuencia = 4 filas con check
  lima en la activa y subtítulo que explica cada una, en vez de un grid de
  botones sin explicación.

Correcciones de contenido (la parte que no es estilo):

| Antes | Ahora | Por qué |
|---|---|---|
| "Sin conexión" | "Sin entrenador" + "si entrenas por tu cuenta no necesitas esto" | "Sin conexión" se lee como "sin internet" |
| "Pendiente de sincronizar" / "Error de sincronización" | "Falta enviar" + qué está pendiente + fila **Reintentar el envío** | el estado nombraba el problema sin decir qué hacer; la acción de reintento existía en el store (`uploadHistoryToTrainer`) pero solo estaba en el banner del header |
| "ACCESO: 🔑 Código de entrenador" | "Entras con un código" + "si cambias de móvil tendrás que pedirle uno nuevo" | decía el dato, no la consecuencia |
| "ÚLTIMA SYNC" | "Último envío de tu historial" + "se envía solo al terminar cada sesión" | jerga abreviada |
| — | Sección **QUÉ VE TU ENTRENADOR** (sí ve / no ve) | dato no obvio y verificado contra `scopeFilterForUpload`: salen las sesiones de SUS programas y las libres posteriores a la conexión; no salen los programas propios ni nada anterior |
| "Desconectar entrenador" a secas | subtítulo con lo que pasa (se archiva su programa, vuelve el anterior) | la consecuencia solo aparecía en el `Alert`, ya pulsado |
| Drive: "FRECUENCIA · Por sesión" | "CUÁNDO SE GUARDA · Al terminar cada sesión" + "no necesita permisos en segundo plano" | el resto de frecuencias sí registran tarea en segundo plano, y eso no se decía |
| — | "Se guardan las 30 últimas… las más viejas se borran solas" | `MAX_BACKUPS = 30` en `driveService.js` era invisible en la UI |
| — | "La app solo puede ver los archivos que ella misma crea" | es el scope real (`drive.file`) y es lo que la gente pregunta antes de dar acceso a su Drive |
| "¿Restaurar «nombre»? Tus datos actuales se reemplazarán" | fecha legible de la copia + qué se reemplaza exactamente + "no se puede deshacer" | el nombre de archivo no dice cuándo es esa copia |

Todo el texto pasa a i18n (`trainer.*`, `drive.*` en es/en). Los tres modales de
conexión (código, vincular Google, modo de sincronización) **siguen sin migrar**:
son piezas aparte y no entraban en este encargo.

### Modales de conexión — desglose

Los tres eran tarjetas centradas con borde, escala `typography` y texto
hardcodeado. Pasan a **`DragSheet`**, que es lo que manda §9 ("cualquier modal
nuevo se monta con él"), con el fondo en `bg` para que se vean las tarjetas de
dentro — igual que el menú principal.

- **Sin fila de botones Cancelar/Aceptar**: el hueco derecho de la cabecera de
  `DragSheet` (`action`) hace de salida — *Cancelar* en los pasos iniciales,
  *Atrás* en el paso de confirmación y en Recuperar cuenta. Abajo queda un solo
  botón, el que avanza.
- **Títulos de hoja en caso normal** ("Conectar con entrenador", "Tu código
  personal"), que es la convención de las hojas ya migradas ("Añadir", "Tempo").
  De paso se corrigió el "EXPORTAR" en mayúsculas de la hoja de exportar.
- **`ui/CodeField.jsx` + `utils/codeFormat.js` nuevos** (con test): los dos
  modales que piden un código tenían su propio input y su propio botón de pegar,
  y el guion había que escribirlo a mano. Ahora el guion se pone solo, se fuerza
  mayúscula, se descartan símbolos y se corta al largo exacto — 2 grupos para el
  código de cliente (`XXXX-XXXX`), 3 para el de entrenador
  (`XXXX-XXXX-XXXX`). NO se filtran `I`, `O`, `0` ni `1` (el generador no las
  usa, pero borrar en silencio lo que alguien acaba de teclear es peor que un
  error de validación claro). Esto además vuelve fiable el login por código del
  entrenador, cuya contraseña ES el código con guiones.
- **Radios → el mismo check lima** que las frecuencias de Drive, y los emoji de
  los modos (🔵🔑📁) → iconos SVG en gris/lima (nube, llave, carpeta: la nube es
  la cuenta, la llave el código, la carpeta los archivos).

Correcciones de contenido:

| Antes | Ahora | Por qué |
|---|---|---|
| `Aceptar` en la pantalla de código guardado | `VOLVER A AUTENTICAR` + "úsalo si la app dejó de reconocerte" | el botón no aceptaba nada: reautenticaba la sesión de Supabase |
| `Activar` / `Continuar sin conexión` | `CREAR MI CÓDIGO` / `SEGUIR SIN CUENTA` | el CTA ahora dice qué va a pasar |
| "Google · Inicia sesión con tu cuenta…" | "Con tu cuenta de Google · tus clientes quedan asociados a tu cuenta, no hay código que guardar" | los tres modos se describen por su consecuencia real, no por el mecanismo |
| "Sin conexión" (modo) | "Sin cuenta · nada sale de este móvil" | otra vez el "sin conexión" que se lee como "sin internet" |
| "TU NOMBRE (PARA CLIENTES)" | "TU NOMBRE" + "es el nombre que tus clientes ven en los programas que les envías" | la aclaración cabe debajo, no en mayúsculas dentro de la etiqueta |
| 4 bullets sueltos en el paso de confirmar | sección "QUÉ PASA AL CONECTAR" con la 4ª corregida | decía "tu historial anterior se conserva"; lo que importa es que **no se le envía** (verificado en `scopeFilterForUpload`) |
| "No hay cuenta vinculada a ese Google" | "Ese Google no tiene ninguna conexión guardada. Pídele el código a tu entrenador." | dice qué hacer |
| Errores como `Alert('Error', …)` | títulos concretos ("No se pudo entrar con Google", "No se pudo crear la cuenta") | "Error" no informa de nada |

Todo el texto pasa a i18n: `trainer.*` crece con el flujo del cliente y `sync.*`
es nuevo para el del entrenador. `RecoveryScreen`/`CodeStatusScreen`/
`CodeRevealScreen` dejan de ser componentes con estado propio dentro del fichero
y pasan a ser bloques del mismo `DragSheet` (el estado del código de recuperación
sube al modal), así que el estado del flujo vive en un solo sitio.

### ⚠️ Reordenar: lo lleva `react-native-sortables`, NO lo montes a mano

Las tres listas reordenables del editor (sesiones del programa, huecos de la sesión,
movimientos del bloque) usan **`Sortable.Grid` con `columns={1}`**. Los ajustes comunes
viven en `src/components/ui/sortable.js` (`SORTABLE_PROPS`); el `onDragEnd` de cada
pantalla recibe `{ data, key, fromIndex, toIndex }` y escribe el orden en el store.

**Se montó a mano tres veces y las tres tuvo el mismo bug**: al soltar, durante uno o
varios frames algunas tarjetas aparecían en posiciones aleatorias, a veces fuera de la
lista. La causa es estructural, no un ajuste: la posición final estaba repartida entre
dos pipelines que nadie sincroniza — el *layout* (orden de hijos, commit de React →
shadow tree) y el *transform* (Reanimated, directo en el hilo de UI). `commitDrag`
disparaba los dos a la vez y ganaba el que ganaba: o el transform volvía a cero con la
lista aún en el orden viejo, o la lista se recolocaba con los offsets viejos encima
(cientos de px en un movimiento largo). El truco de "asentar primero y escribir después"
reducía el caso estable pero no podía eliminar la carrera. Aparte, `shiftSv` no se
reseteaba al soltar, así que el arrastre siguiente arrancaba desde el valor rancio y las
vecinas se deslizaban una fila entera durante 160 ms.

La librería no tiene ese problema porque **nunca deja que React reordene los hijos**: el
orden de render es fijo y cada celda se posiciona desde un mapa de posiciones en shared
value. Reordenar = escribir ese mapa en el hilo de UI, atómico por construcción.

Notas de uso:
- **`Sortable.Grid`, no `Sortable.Flex`.** Solo el grid vertical controla el ancho de
  celda (ancho del contenedor ÷ columnas); el flex deja a cada hijo su ancho natural y
  las tarjetas a ancho completo salen encogidas. El alto lo sigue midiendo por celda, así
  que una superserie puede ocupar el doble.
- **`customHandle` + `Sortable.Handle`**: el gesto vive SOLO en el asa. Las filas llevan
  encima su propio swipe horizontal (`PanResponder`) y el cuerpo es pulsable; con el
  gesto en toda la tarjeta se pelearían.
- **`key` estable de verdad.** Una `key` posicional (`${id}-${idx}`) hace que la librería
  y el estado apliquen el reordenado dos veces. Los movimientos de un bloque no tienen id
  propio (dos pueden ser el mismo ejercicio), así que `BlockEditorInline` les pone un
  `uid` al entrar en estado y lo quita al guardar.
- El ScrollView que contiene la lista tiene que ser `Reanimated.ScrollView` con
  `useAnimatedRef`, y pasarse como `scrollableRef` para el autoscroll.
- **Dentro de un `Modal` de RN hace falta su propio `GestureHandlerRootView`.** El
  `Modal` monta su contenido en otra jerarquía nativa, fuera del de `App.js`, así que
  sin uno propio los gestos no llegan y el asa simplemente no responde — es lo que
  pasaba en el modal del editor de bloque.

### ⚠️ Problema conocido sin resolver: animación de sesión completada
Al completar una sesión y cerrar el recap, la tarjeta correspondiente debería animar su
transición al estado "completada" (crossfade de fondo/borde + botón→check) — **no
reordena la lista** (eso ya no existe), solo cambia de aspecto la misma tarjeta, en el
mismo sitio. En QA, tres intentos distintos no lo han conseguido mostrar en dispositivo;
la tarjeta ya aparece completada al volver, sin animación visible:

1. `useIsFocused()` + "ajustar estado durante el render" (comparar `status` contra un
   `useState` y llamar `setState` en el cuerpo del render). Sospecha: React descarta el
   render intermedio antes de pintar (ver react.dev, "adjusting state during render"),
   así que nunca se pinta el frame "todavía no completado".
2. `useFocusEffect` + `InteractionManager.runAfterInteractions` para esperar a que
   termine la transición de navegación antes de animar. Diagnóstico de un subagente
   (Opus): `InteractionManager` no espera transiciones de `@react-navigation/native-stack`
   (son nativas, no crean handles JS) — el callback disparaba casi al inicio del slide,
   no al final, y el crossfade se consumía entero mientras Home aún entraba.
3. `useFocusEffect` + `transitionEnd` real del stack padre
   (`navigation.getParent().addListener('transitionEnd', …)`) con `setTimeout(500)`
   como red de seguridad. Razonamiento sólido (confirma que Home NO se remonta al volver
   del recap, así que el estado local sobrevive), pero en dispositivo **sigue sin
   verse**.

El código actual en `SessionCard` (`src/screens/HomeScreen.jsx`) implementa el intento 3.
Antes de intentar un cuarto enfoque: descartar causas de entorno (probar
`expo start -c` / limpiar caché de Metro, no solo recargar Expo Go — el usuario no lo
ha confirmado todavía) antes de seguir tocando la lógica de disparo, ya que el mismo
síntoma con tres implementaciones distintas también encaja con "algo sirve JS viejo".

### Pendiente de decisión (preguntar al usuario al llegar)
- Banner: la etiqueta a la izquierda de la barra usa el **nombre de la etapa**; el
  componente de Figma muestra "Volumen" como placeholder. Confirmado por el layout que
  escribió el usuario, pero conviene revalidarlo si se retoca el banner.
- Se propuso unificar el bloque derecho de las dos variantes del banner (mismo
  `CICLO`/nº/puntos en columna en ambas). **Propuesto y pendiente de aprobación.**

---

## 2. Dónde está cada cosa

```
mobile/
  App.js                     carga de fuentes (Inter) + splash + providers
  store/useStore.js          store Zustand: programas, sesiones, workoutLog, clientes…
  src/
    theme.js                 spacing, typography, textStyles, borders, withOpacity
    themes.js                colores + radios POR TEMA (formaFit y 4 temas legados)
    useTheme.js              useTheme() / useThemedStyles()
    navigation/RootNavigator.jsx   tabs + stack
    screens/                 una pantalla por fichero
    components/              compartidos; ui/ = primitivas; stats/ = Progress
    utils/, hooks/
  docs/
    UI-MIGRATION.md          ← este documento
    figma-extraction/        extracción de Figma (ver §5)
    expo-skills/             skills de Expo como referencia (no receta)
src/locales/{es,en}.json     i18n — OJO: en la raíz del repo, NO dentro de mobile/
```

**i18n es obligatoria**: todo texto visible va a `src/locales/es.json` **y** `en.json`.
No hardcodear cadenas nuevas.

---

## 3. Sistema de tokens — cómo se usa

```js
import { spacing, textStyles, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

const makeStyles = (th) => StyleSheet.create({
  card: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
    ...textStyles.cardTitle,
  },
});

function Pantalla() {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
}
```

- **`spacing`** (global, en `theme.js`) **tiene los valores EXACTOS de Figma**:
  `xs:2, xs2:4, sm:6, sm2:8, md:10, lg:15, xl:20, xxl:28`.
  Si Figma pide uno de esos números, usa SIEMPRE el token, nunca el literal.
- **`th.radius`** viene del tema. En formaFit: `xxs:2, xs:4, sm:6, md:10, lg:18, xl:18, full:9999`.
- **`th.colors`** — formaFit: `bg #151515`, `surface #1f1f1f` (tarjetas),
  `surface2 #272727` (barras de búsqueda, fondo de segmented, **botones secundarios**),
  `text #e6e6e6`, `mutedLight #818181`, `muted/muted2 #4d4d4d`, `accent #aae216`,
  `onAccent #000`, `green #66fa39`, `orange #fb923c`, `red #ff0900`, `blue #4c85ff`.
- **`th.tint`** — tints de Figma: `accent10`, `accent50`, `red30`, `red50`, `orange30`,
  `orange50`, `blue30`, `blue70`. En formaFit son valores exactos de Figma (base
  `#b8ff00` para el lima, distinta del accent sólido); en los temas legados se derivan
  con `withOpacity`.
- **`textStyles`** — composites EXACTOS de Figma (familia + tamaño + tracking):
  | token | Figma | uso |
  |---|---|---|
  | `hero` | Black 20 / 0 | números y títulos grandes |
  | `cardTitle` | Black 16 / 0.64 | nombre de sesión/ejercicio |
  | `cardType` | ExtraBold 12 / 1.2 | tags tipo "SESIÓN A" |
  | `btnAction` | Black 12 / 0 | texto de botones |
  | `subtitle` | Medium 12 / 0.48 | metadatos |
  | `tag` | Medium 10 / 0 | labels pequeños |
  | `spacingTag` | ExtraBold 10 / 2 | labels uppercase muy trackeados |
  | `smallBold` | SemiBold 8 / 1.12 | labels 8px (etapa, entrenador, contadores) |
- **`typography`** es la escala genérica LEGADA. Úsala solo en elementos que **no** salen
  de un mock de Figma (calendario de History, badges internos, etc.). No la mezcles con
  `textStyles` en un elemento que sí está en Figma.
- Las fuentes son **Inter, una familia por peso** (RN no sintetiza pesos en fuentes
  custom): `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold`, `Inter_800ExtraBold`,
  `Inter_900Black`, `Inter_900Black_Italic`. Se cargan en `App.js`. Si necesitas un peso
  nuevo, añádelo ahí **y** al `textStyles` correspondiente.

**No toques los 4 temas legados** (dark/midnight/earthy/space) al migrar: solo `formaFit`.

---

## 4. Reglas de fidelidad — las no negociables

> Regla primordial, repetida por el usuario varias veces:
> **"ES FUNDAMENTAL RESPETAR TODO LO QUE HAY EN FIGMA. Si en Figma md es 10, es 10.
> No me importa el valor actual en la app. Esto es un refactor completo de interfaz."**

1. **Exactitud**: radio, espaciado, tamaño/tracking de texto, layout y color se copian
   EXACTOS. Nunca "lo más parecido que ya existe en el código".
2. **Verifica la instancia concreta**, no generalices por analogía visual. Dos rondas de
   correcciones en History salieron de asumir que un componente heredaba el tratamiento
   de otro parecido.
3. **Variable equivocada, número correcto**: Figma a veces vincula un gap a `radius/sm`
   en vez de `space/sm` (ambos valen 6). Toma el NÚMERO, no repliques el nombre malo.
4. **Cajas de icono ≠ icono visible**: las coordenadas y el tamaño que da Figma suelen
   ser los de la CAJA del icono (hit-box), no los del glifo dibujado dentro. Pasó dos
   veces en Clientes (el bullet verde medía 3.69px dentro de una caja de 8; el menú "···"
   estaba anclado por su caja). Descarga el asset SVG y mira el `<circle>`/`<path>` real.
5. **Guión en Figma = punto medio "·" en la app.** El usuario dibuja guiones porque no
   puede escribir "·" en Figma. Siempre `" · "` con espacios.
6. **Bordes son raros en este tema**: solo como highlight de acento en 3 casos (tarjetas
   "Resumen", tarjeta de ejercicio colapsada, sesión completada). Nunca como decoración
   genérica de tarjeta.
7. **Dos tonos por familia de color son intencionales**: sólido oscuro para rellenos,
   tint claro para texto pequeño. No lo "corrijas".
8. **Azul = SIEMPRE entrenador/externo.** accent = positivo/propio, red = alerta.
9. **Pills de series**: dentro de una misma pill el número va en `accent` y la
   unidad/símbolo ("Kg", "x", "@") en `text`/`mutedLight`. Anatomía: sin borde,
   `radius/xs`, padding `space/sm` en las 4 direcciones; fondo `tint/accent-10` (en rango)
   / naranja al 30% (fuera de rango) / `surface2` (neutra). Formato `12@8` sin espacio.
   La pill de peso lleva `pl`+`py` pero **sin** padding derecho.
10. **Feedback táctil en todo lo pulsable**: nada de cambios de estado en seco. Figma no
    lo especifica (es un mock estático) pero es requisito del usuario. Ver §7.
11. **Contenido vs. forma**: la INFORMACIÓN debe coincidir con Figma, pero el formato de
    presentación puede seguir la convención ya existente en la app cuando el usuario lo
    prefiera (p. ej. chips separados por "·" en vez de una cadena combinada). Si el
    contenido de un componente de Figma difiere del real de la app, **pregunta** — no
    asumas en ninguna dirección.

---

## 5. Cómo extraer de Figma

- **fileKey**: `80ca8AvfTekEtbjDtmUCey`. Herramientas MCP `mcp__plugin_figma_figma__*`.
- **Colores y tipografía** → basta el componente suelto (`get_design_context` del nodeId).
- **Espaciados, gaps y padding de página** → hace falta `get_design_context` del **frame
  raíz de la pantalla**, no solo del componente aislado. Un componente aislado no expone
  cómo se usa en contexto. Hazlo desde el principio: no hacerlo costó 2 rondas extra en
  History.
- **`get_screenshot` + ImageMagick** para lo que el código no aclara: descarga el PNG y
  amplía la zona (`magick x.png -crop WxH+X+Y -resize 400% out.png`). Imprescindible para
  iconos y para leer componentes montados con posicionamiento absoluto.
- Los assets que devuelve (`imgEllipse…`) suelen ser **SVG**, no PNG: `cat` del fichero te
  da el color y la geometría reales.
- El usuario **no usa auto-layout** en muchos componentes → el código generado viene con
  `position:absolute` y coordenadas. Hay que extrapolar la estructura a flexbox: mira el
  screenshot y agrupa por coordenadas.
- `docs/figma-extraction/` tiene 36 documentos de extracción previos (`components/*.md`,
  `pages/*.md`). Son buena referencia de partida, pero **el archivo de Figma se ha
  actualizado desde entonces** — si un nodo no cuadra, re-extrae en vez de fiarte del .md.
  Los IDs de nodo cambian cuando el usuario rehace un componente.

---

## 6. Verificación y commits

Antes de cada commit:

```bash
npx eslint mobile/src/screens/LaPantalla.jsx    # desde la raíz del repo
npx vitest run                                   # 26 ficheros / 1446 tests
```

- **El lint tiene errores preexistentes** en ficheros grandes (`react-hooks/purity`,
  `no-unused-vars`, refs en render…). No los arregles de paso. Lo que importa es **no
  añadir ninguno nuevo**: compara el conteo contra `HEAD`.
  ```bash
  git stash && npx eslint <fichero> | grep problems; git stash pop
  ```
- Los tests son de lógica (utils/store), no de UI: un cambio puramente visual no debería
  moverlos. Si se rompen, has tocado lógica sin querer.
- Valida el JSON de i18n si lo editas:
  `node -e "JSON.parse(require('fs').readFileSync('src/locales/es.json'))"`.
- Commits en español, formato `tipo(ámbito): descripción`, explicando el **porqué** de
  los cambios no obvios (sobre todo cuando se corrige una mala lectura de Figma).

---

## 7. Animación — patrón adoptado

**`react-native-reanimated`** (v4 + `react-native-worklets`, ya instalados). Es el
estándar del proyecto para animaciones nuevas; **no uses `Animated` de RN core** para
listas ni controles nuevos.

- `useSharedValue` + `useAnimatedStyle` + `withTiming`.
- **Ease-in-out, no spring** — el usuario descartó el spring por exagerado:
  `withTiming(v, { duration: 200, easing: Easing.inOut(Easing.ease) })`.
- Listas: `LinearTransition`, `SlideOutRight`, `FadeIn/FadeOut`, `Reanimated.FlatList`
  con `itemLayoutAnimation`.
- **Nada debe animarse al abrir la pantalla**: mide primero, coloca sin animar
  (`positioned` ref), y anima solo a partir del siguiente cambio. Ver `SegmentedControl`.
- Modales tipo bottom-sheet: `PanResponder` compartido entre el handle y el backdrop, con
  umbral (`dy > 120 || vy > 0.8`) para cerrar y spring de vuelta si no llega.

---

## 8. Trampas de React Native ya pisadas

- **`ListHeaderComponent={() => <X/>}` remonta el header en cada render** → pasa el
  elemento directo (`ListHeaderComponent={header}`). Rompió la animación del segmented.
- **Los hijos `position:absolute` NO heredan el padding del padre.** Si posicionas algo
  con `top: alturaMedida` dentro de un contenedor con `paddingTop`, se solapa. Suma el
  padding a mano. (Causa del dropdown del modal de ejercicio montado sobre su barra.)
- **`alignItems: 'stretch'` en el padre deforma un hijo cuadrado**: necesita `height`
  explícito + `alignSelf: 'center'` (botón de cerrar del modal).
- **`flex-end` alinea contra la caja del texto, no la línea base visual**: el
  `line-height` deja aire. Compensa con `marginBottom`/`marginTop` negativos pequeños
  (puntos de ciclo, número del banner).
- **Modales y edge-to-edge (SDK 54)**: un `<Modal>` necesita `statusBarTranslucent` **y**
  `navigationBarTranslucent` para cubrir toda la pantalla; si no, la tab bar asoma por
  debajo.
- **No mezcles propiedades nativas y no-nativas en un mismo `Animated.View`** (`maxHeight`
  con `opacity`/`transform`). Motivo por el que se migró todo a Reanimated.
- `TextInput` dentro de una barra con padding: pon `padding: 0` en el input y controla el
  alto desde el contenedor, o Android añade el suyo.

---

## 9. Patrones visuales reutilizables

- **Lista agrupada** (`GroupedListRow`): fondo por item, gap `space/xs` (2) y radios
  asimétricos — primero: superiores `md` / inferiores `xs`; intermedios: `xxs` en las 4;
  último: al revés que el primero. Implementado como helper `getCardRadii(th, isFirst, isLast)`
  en `ProgressTab.jsx`. Se usa en listas densas de datos/config, **no** en listas de
  navegación (Clientes, History y HomeView usan tarjetas independientes con radio completo).
- **Barra de búsqueda estándar**: `surface2`, `radius/sm`, altura 42, lupa a la izquierda
  (mutedLight) y "✕" a la derecha que aparece al escribir. Los botones cuadrados
  adyacentes (filtro, "+") miden 42×42 para casar con ella.
- **Segmented control**: `src/components/ui/SegmentedControl.jsx`, props
  `{ options: [{id,label}], value, onChange }`. Solo existen 2 variantes reales en Figma;
  la de 2 líneas ("Etapas") es exclusiva de selección de etapa.
- **Modales "···"**: Figma unifica TODOS los menús contextuales de la app en un mismo
  patrón. Conforme se restylea cada pantalla, sus menús propios deben converger ahí.
  La fila de opción vive en **`sheetRowBase(th)` (`src/theme.js`)**: `surface2`,
  `radius/sm`, px `space/md`, py `space/sm2` y **`minHeight: 48`** (QA: "las filas
  son muy finas"). Antes estaba copiada en seis pantallas, así que subir el alto
  había que hacerlo seis veces; ahora se cambia en un sitio. `minHeight` y no más
  padding vertical: las filas de dos líneas ya lo superan y no se estiran.
- **`Switch` (`ui/EditorRows`)**: escalado ×1.7 sobre el 26×14.18 de Figma, en dos
  rondas de QA. `OPT_ROW_H` dejó de derivarse del ancho del carril y es un 46
  fijo, y la caja del switch mide el alto del carril y no un cuadrado: si no, el
  switch más grande estiraba la fila, que es justo lo que el usuario NO quería.

### Modales — SIEMPRE `DragSheet`, nunca uno nuevo

`src/components/DragSheet.jsx` es el único bottom-sheet de la app. Cualquier modal nuevo
(menú "···", hoja de opciones, picker, confirmación con más de dos salidas) se monta con
él. **No** montes otro Modal a mano y **no** uses `Alert` nativo: en Android no se puede
estilar y desentona con todo lo demás.

```jsx
<DragSheet visible={open} onClose={() => setOpen(false)} title={t('...')}>
  <View style={styles.sheetBody}>
    …filas…
  </View>
</DragSheet>
```

- Props: `{ visible, onClose, title, action, children }`. El handle, el backdrop, el
  título y el botón de cerrar los pone él; tú solo pintas el contenido.
- **La hoja va en `color/app` (`bg`), no en `surface`** — y con ella TODOS los modales de
  la app (tarjetas centradas, menús contextuales a ancho completo, el detalle de
  ejercicio de Progreso). Era una prop opcional (`background`) que usaban la mitad de las
  hojas; ahora es el fondo único y la prop ya no existe. Lo que va DENTRO sigue las reglas
  de siempre: tarjetas y filas en `surface`, campos / botones secundarios / segmented en
  `surface2`. **Nada dentro de un modal puede ir pintado en `bg`**: se funde. Por eso el
  `dark` de `StepField` (que pinta la caja en `bg`) solo se usa cuando el contenedor
  inmediato es una tarjeta `surface`, nunca directamente sobre el cuerpo de una hoja.
- **Se cierra arrastrando hacia abajo desde el handle Y desde el fondo** (>120 px o gesto
  rápido), o tocando el fondo. El *mismo* `PanResponder` se reparte entre las dos zonas:
  si cada una tuviera el suyo, el `gestureState` (el dy acumulado) sería distinto en cada
  una y el arrastre saltaría al cruzar de una a otra. El backdrop reclama el gesto solo
  al moverse (`onMoveShouldSetPanResponder`), para que un toque suelto siga siendo
  "cerrar".
- Patrón de fila ya usado en los dos editores: fondo `surface2`, `radius/sm`,
  `padding: space/md`, texto `text/card-type` y la flecha `ArrowIcon` a la derecha
  (`SheetRow` en `SessionEditorScreen.jsx`). Las acciones destructivas van en
  `color/red`, texto y flecha.
- El `SettingsSheet` de `AppHeader.jsx` es el mismo patrón anterior a extraer el
  componente; si lo tocas, hazlo converger en `DragSheet` en vez de duplicar.

---

## 10. Cómo trabaja el usuario

- Revisa **cada cambio en el dispositivo** y responde con correcciones muy concretas
  (píxeles, tokens, colores). Trabaja en iteraciones cortas: implementa → commit →
  espera QA.
- En cambios grandes pide **dividir el trabajo en partes** y que se le pregunte lo que no
  esté claro **antes** de implementar.
- Cuando dice "propón", quiere ver la propuesta (un mockup ayuda) **antes** de que se
  implemente.
- Si una lectura de Figma y algo que él escribe se contradicen, **manda lo que él
  escribe**, pero déjalo señalado explícitamente en la respuesta.
