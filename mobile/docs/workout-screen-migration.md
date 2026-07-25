# Migración de Workout Screen — guía de trabajo

> **Léela entera antes de tocar nada.** Es autocontenida: un chat o subagente debería poder
> migrar la pantalla sólo con este documento + los ficheros que referencia.
> Complementa a `UI-MIGRATION.md` (reglas globales de la migración FormaFit) — no la sustituye.
> **Antes de empezar, lee también `UI-MIGRATION.md` §3 (tokens), §4 (fidelidad), §5 (extraer
> de Figma), §7 (animación) y §8 (trampas de RN).** Todo eso aplica aquí también.

Workout Screen es la pantalla **más importante y más compleja** de la app. A diferencia de
HomeView, aquí NO se rediseña la funcionalidad: es un **restyle** que aplica el diseño FormaFit
sobre lógica que ya existe y funciona. Toda esa lógica (timer de descanso, supersets, bloques
AMRAP/EMOM/for-time, calentamiento, dropsets, ejercicios ad-hoc, notas de coach/entrenador/
cliente, sesión libre, gesto scroll-para-ajustar, conversión de unidades, puntero de serie
activa, auto-colapso de card) **se preserva intacta**. Lo único genuinamente nuevo es la
**cabecera colapsable con puntos de progreso**.

---

## 0. Decisiones ya tomadas por el usuario (jul 2026) — no volver a preguntar

1. **Cabecera = 2 estados discretos, con snap + crossfade.** Grande (64px) y compacta (~36px).
   La cabecera está **fija (sticky) arriba** siempre; el contenido scrollea por debajo. Al pasar
   un umbral de scroll, cambia **de golpe** entre los 2 estados con un fundido corto (~200ms
   ease-in-out). **NO** es una interpolación continua ligada al offset (RACIONALIZACION §5-bis:
   "2 estados, no interpolación de 4 pasos"). Los 4 `WS mockup` de Figma eran exploración de una
   misma idea, no la referencia final.
2. **Puntos de progreso = 1 por ejercicio, se rellenan al completar. Incluyen los bloques de
   acondicionamiento.** Un punto por cada `ExerciseCard` de fuerza (incluidos los ad-hoc) **y**
   uno por cada bloque AMRAP/EMOM/for-time. Un punto se rellena cuando ese ejercicio queda
   completo (todas sus series de trabajo hechas → la card auto-colapsa) o cuando el bloque queda
   finalizado. En un superset, cada ejercicio miembro cuenta como su propio punto.
3. **Piezas que Figma no dibuja → restyle por analogía, misma estructura y lógica.** El timer de
   descanso flotante se restylea por analogía (tokens/colores nuevos, misma forma). Ver §7.
4. **Supersets: mismo diseño de hoy. El único cambio es añadir el prefijo `A1`/`A2` delante del
   nombre del ejercicio**, con la **misma tipografía que el nombre** pero en **color accent**.
   (Hoy existe como `groupBadge` tipo pill; pasa a ser un prefijo inline del nombre.)
5. **Bloques AMRAP/EMOM SÍ tienen rediseño en Figma** — dentro del componente `Exercice Card`
   (nodo `106:2956`), no como editor sino como **runtime**: variantes `AMRAP close` / `AMRAP
   running` / `Variant5` (EMOM idle) / `Variant6` (EMOM running). Mapean casi 1:1 con los
   estados actuales de `ConditioningBlockCard` (idle/running/finished). Ver §6.
6. **Modal de notas: restyle FormaFit + drag-to-close** con la misma lógica que los modales
   actualizados recientemente, donde **el arrastre funciona también desde el cuerpo/fondo del
   sheet**, no sólo desde el handle. Ver §8.
7. **Resumen de la card completada (colapsada): adoptar el formato FormaFit de 2 colores** — el
   mismo `EstructuraVisualizacionDatosEjercicios` ya implementado en History y en Progress/
   ejercicios. **Reutilizar ese componente**, no reinventar el resumen. Ver §5.4.

---

## 1. Ficheros que se tocan

| Fichero | Rol | Alcance del cambio |
|---|---|---|
| `src/screens/WorkoutScreen.jsx` | Pantalla contenedora | Cabecera colapsable nueva + puntos de progreso; restyle de footer (Guardar/Descartar), botón "Añadir ejercicio", banner de sesión libre; restyle del timer flotante y del modal de notas. La **lógica** (store, puntero de serie activa, grouping de supersets, save/discard) NO cambia. |
| `src/components/workout/ExerciseCard.jsx` | Card de ejercicio (expandida + colapsada) | El grueso del restyle. Header, chips, calentamiento, grid de series, dropset, notas, card colapsada. Toda la máquina de auto-colapso animado (`maxH`/`contentOpacity`) se **conserva**. |
| `src/components/workout/SetRow.jsx` | Fila de una serie (grid KG/REP/RPE) | Restyle de celdas (Input Field), botón done, botón timer, arrows del scroll-adjust. **Mantener la alineación perfecta de columnas** (ver §5.3). |
| `src/components/workout/ConditioningBlockCard.jsx` | Runtime de bloque AMRAP/EMOM/for-time | Restyle contra las variantes `AMRAP*`/`Variant5/6` del componente Figma `Exercice Card`. Lógica de reloj/derivaciones intacta. |
| `src/components/workout/SupersetBlock.jsx` | Wrapper de superset | Restyle mínimo. El prefijo `A1`/`A2` va en `ExerciseCard` (§5.1), no aquí. |
| `src/locales/{es,en}.json` (raíz del repo) | i18n | Sólo si aparece texto nuevo. No hardcodear. |

Reutilizar (no duplicar): el componente de pills de resumen 2-colores de
`src/components/stats/ProgressTab.jsx` (History/Progress) para la card colapsada (§5.4), y
`src/components/DragSheet.jsx` como base del modal de notas (§8).

---

## 2. Material de referencia en Figma

- **fileKey**: `80ca8AvfTekEtbjDtmUCey`. Herramientas `mcp__plugin_figma_figma__*`.
- **Recordatorio de `UI-MIGRATION.md` §5**: el archivo de Figma se ha actualizado desde las
  extracciones `.md` antiguas. **Los nodos de abajo están verificados en esta sesión (jul 2026)**,
  pero si algo no cuadra, re-extrae con `get_design_context`/`get_screenshot` en vez de fiarte.

### Componentes (página "Components", `0:1`)

| Componente | Nodo | Variantes relevantes (nodo) |
|---|---|---|
| **SesionHeader** | `110:3692` | `Default` = grande 64px (`110:3691`), `collapsado` = 36.7px (`110:3693`) |
| **Exercice Card** | `106:2956` | `Default` expandida (`105:2490`), `Collapse` completada (`106:2957`), `AMRAP close` (`260:3294`), `AMRAP running` (`260:3451`), `Variant5`=EMOM idle (`260:3626`), `Variant6`=EMOM running (`260:3655`) |
| **Series** (fila de serie) | `105:2393` | `Default` (`105:2392`), `Calentamiento` (`213:2138`), `Variant2/3/5` |
| **Input Field** (celda) | `105:2415` | `Done` (`105:2414`), `Current` (`105:2416`), `Empty` (`105:2428`), `Sliding value` = estado scroll-adjust (`105:2485`) |
| **Pills** | `106:3111` | `reps Series` (`106:3056`), `Kg series` (`124:1114`), `Solid` (`106:3112`) |
| **EstructuraVisualizacionDatosEjercicios** | `176:1268` | `Semi compacta` (`176:1267`), `Desglosada` (`176:1269`), `Variant3` (`306:2860`) |
| **Chips** (recomendación) | `110:4247` | `Default` lima (`110:4246`), `Variant2` roja (`110:4248`), `Variant3` azul (`110:4348`) |
| **Icons** | frame `98:138` | `Serie uncheck` (`105:2459`), `Serie Current Uncheck` (`105:2479`), `Serie done` (`106:2701`), `Empty notes` (`106:3371`), `Full notes` (`106:3399`), `Arrow` (`98:137`), `Menu` (`119:831`), `Plus` (`142:1104`), `Minus` (`142:1108`), `round undone` (`261:3717`), `Round current` (`261:3723`), `Round done` (`261:3726`), `target` (`230:4020`) |
| **Buttons** | `102:2078` | `Añadir serie/sesion` outline (`106:3284`), `Secondary` (`102:2079`), `Tertiary buttom` (`235:4760`) |

### Pantallas completas (referencia de layout en contexto — página "Moodboard")

- `104:690` "Workout Screen full header" → estado header grande + body + footer completos.
- `109:510` "Workout Screen header collapse" → estado header colapsado + body + footer.
- `104:313` / `102:370` / `104:167` / `104:449` "WS mockup" → 4 fotogramas de la exploración
  del colapso; **usar sólo como inspiración**, la decisión final es 2 estados (§0.1).
- `260:2796` "Workout Screen with training block" → **ignorar**: duplicado exacto de `109:510`,
  sin bloque real (era placeholder). El diseño de bloque real vive en el componente `Exercice
  Card` (§6), no aquí.

### Extracciones previas (buen punto de partida, re-verificar)
`docs/figma-extraction/pages/workout-*.md`, `ws-mockup-*.md`, y
`docs/figma-extraction/components/{sesion-header,estructura-datos-ejercicios,chips,
exercice-editor-elements,ejercicios-progreso}.md`.

---

## 3. Tokens FormaFit usados en Workout (valores exactos de Figma)

Extraídos de `get_variable_defs` sobre `104:690`. **Usa siempre el token, nunca el literal**
(ver `UI-MIGRATION.md` §3 para el sistema completo `spacing`/`textStyles`/`th.colors`/`th.radius`).

| Figma | Valor | Token en código |
|---|---|---|
| `color/accent` | `#aae216` | `th.colors.accent` |
| `color/onAccent` | `#000000` | `th.colors.onAccent` |
| `color/text` | `#e6e6e6` | `th.colors.text` |
| `color/mutedLight` | `#818181` | `th.colors.mutedLight` |
| `color/muted` | `#4d4d4d` | `th.colors.muted` |
| `color/surface` | `#252525` | `th.colors.surface` |
| `color/surface2` | `#3a3a3a` | `th.colors.surface2` |
| `color/workout-card` | `#141414` | fondo de la pantalla (= `th.colors.bg`); ver nota abajo |
| `color/red` | `#ff0900` | `th.colors.red` |
| `tint/accent-10` | `#b8ff001a` | `th.tint.accent10` |
| `tint/accent-50` | `#b8ff0080` | `th.tint.accent50` |
| `tint/red-30` | `#bd06004d` | `th.tint.red30` |
| `tint/red-50` | `#ff5e5880` | `th.tint.red50` |
| `space/xs` 2 · `sm` 6 · `md` 10 · `lg` 15 · `xxl` 28 | — | `spacing.xs/sm/md/lg/xxl` |
| `radius/xs` 4 · `sm` 6 · `md` 10 · `lg` 18 · `full` 9999 | — | `th.radius.xs/sm/md/lg/full` |
| `text/hero` | Black 20/0 | `textStyles.hero` |
| `text/card-title` | Black 16/4 | `textStyles.cardTitle` (nombre de ejercicio) |
| `text/Exercice` | Black 16/0 | título de ejercicio (ver nota) |
| `text/card-type` | ExtraBold 12/10 | `textStyles.cardType` (subtítulo "3 X 8-10REPS", tag SESIÓN) |
| `text/spacing tag` | ExtraBold 10/20 | `textStyles.spacingTag` (labels tipo CALENTAMIENTO, DROPS, POR RONDA) |
| `text/btn-action` | Black 12/0 | `textStyles.btnAction` (texto de botones) |
| `text/tag` | Medium 10/0 | `textStyles.tag` |

> **Notas de tokens:**
> - Aparece un token nuevo `color/workout-card: #141414`, idéntico al `bg` de la pantalla. En
>   los screenshots las Exercice Cards se ven casi negras (fondo cercano a `#141414`) con las
>   celdas Input Field más claras (`surface`/`surface2`) por encima. **Verifica por-componente**
>   con qué fondo se dibuja la card (probablemente `workout-card`/`bg`, no `surface`), y si hace
>   falta añadir el token a `themes.js` (formaFit) o mapearlo a `bg`.
> - Hay dos estilos de texto para el nombre de ejercicio en Figma (`card-title` con tracking 4 y
>   `Exercice` sin tracking). Verifica cuál usa la instancia real de la Exercice Card antes de
>   fijar el `textStyles`; no asumas por el nombre del token.
> - **Pills de 2 colores (regla ya cerrada, `UI-MIGRATION.md` §9 y RACIONALIZACION §5-bis):** el
>   número (kg/reps) va en `accent`, la unidad/símbolo ("Kg", "x", "@") en `text`/`mutedLight`.
>   Vincula cada uno a su token aunque el Figma origen los tenga como hex sueltos.

---

## 4. La cabecera colapsable (lo único nuevo) — HECHA, en testeo (commit `52a6d62`)

Referencia: `SesionHeader` `110:3692` variantes `Default` (`110:3691`) y `collapsado`
(`110:3693`); en contexto `104:690` (grande) y `109:510` (colapsada).

> §4.1-4.3 quedan como el spec original (sigue siendo la referencia de intención). **§4.4
> documenta lo que se implementó de verdad y las correcciones que salieron de las rondas de
> QA** — si algo de abajo contradice 4.1-4.3, manda 4.4.

### 4.1 Estructura visual
- **Fondo lima (`color/accent`) sólido, esquinas `radius/md` (10), padding `space/sm` (6).**
  Es una "tarjeta flotante" pinada arriba con margen lateral de página. Todo el texto/iconos van
  en `color/onAccent` (negro).
- **Grande (64px, layout en columna, centrado):**
  - Fila: flecha atrás (izq) · bloque central · icono notas (der).
  - Bloque central (columna centrada): eyebrow `SESIÓN A · 07:36` (`text/spacing tag`, negro) +
    título `Hipertrofia - Pull` (`text/hero`, negro, 20px) + **fila de puntos de progreso** debajo.
  - El eyebrow concatena **label de sesión + cronómetro** con `·` (punto medio, con espacios).
- **Compacta (~36.7px, layout en fila):**
  - Una sola línea: flecha atrás · texto resumen `07:36 · Hipertrofia · Pull` · puntos · icono notas.
  - Desaparece el eyebrow "SESIÓN A" como bloque separado; el cronómetro pasa al inline.
  - Los puntos se colocan a la derecha del título, centrados verticalmente.
- **Iconos:** flecha atrás = `Icons/Arrow` (`98:137`) — en Figma va rotada 180°, replica el glifo
  final, no la rotación literal. Icono de notas = `Icons/Empty notes` (`106:3371`) / `Full notes`
  (`106:3399`) según haya notas de sesión (mismo criterio que hoy: `activeSession.notes`).

### 4.2 Comportamiento (snap + crossfade, §0.1)
- La cabecera es **sticky**: se renderiza fuera del `ScrollView` (como hoy el `<View
  styles.header>`), no como `ListHeaderComponent` — evita el remount que rompió la animación en
  HomeView (`UI-MIGRATION.md` §8).
- Estado `compact: boolean` derivado del scroll con **histéresis** para que no parpadee en el
  umbral: p. ej. pasa a compacto cuando `scrollY > 48` y vuelve a grande cuando `scrollY < 24`.
  Lee `scrollY` con `onScroll` (`scrollEventThrottle={16}`) o un `Animated.Value`.
- Al cambiar `compact`, **crossfade** entre las dos composiciones: usa Reanimated
  (`useSharedValue` + `withTiming(v, { duration: 200, easing: Easing.inOut(Easing.ease) })`) —
  el estándar del proyecto (`UI-MIGRATION.md` §7). El alto del contenedor también anima entre
  64→36.7 en el mismo timing. **Nada anima en el montaje inicial** (mide/coloca sin animar,
  anima sólo a partir del primer cambio — mismo patrón que `SegmentedControl`).
- Ojo con el reflow columna→fila: son dos sub-layouts distintos, no el mismo con menos alto. Lo
  más robusto es renderizar ambas composiciones superpuestas (absolute) y cruzar opacidad; el
  contenedor anima su `height`.

### 4.3 Puntos de progreso (§0.2)
- **Fuente de datos:** una lista ordenada de "unidades completables" = todos los ejercicios de
  fuerza en orden de pantalla (grupos de superset aplanados, en el mismo orden que ya calcula
  `exerciseGroups`) + los ad-hoc (`activeSession.adHocExercises`) + los bloques
  (`template.blocks`). Un punto por unidad, en ese orden.
- **Relleno de un punto:**
  - Ejercicio de fuerza (incl. ad-hoc): completo = todas sus series de trabajo `done` (el mismo
    `allDone`/`workDone` que ya dispara el auto-colapso en `ExerciseCard`). Para el header,
    calcúlalo en `WorkoutScreen` desde `setsState` (no dependas del estado interno de la card).
  - Bloque: completo = `blockState[block.id].finishedAt != null` (estado `finished`).
- **Estilo:** punto relleno lima (`accent`) = completo; punto hueco/anillo `onAccent` translúcido
  = pendiente. Extrae el color/tamaño/gap exactos del SVG de los puntos en `110:3691`
  (descarga el asset, mira el `<circle>` real — recuerda `UI-MIGRATION.md` §4.4: caja de icono ≠
  glifo). El screenshot muestra el punto activo/actual algo más grande o resaltado; confirma en
  el asset si hay 3 estados (hecho / actual / pendiente) o sólo 2.
- **Muchos ejercicios:** una sesión puede tener 8+ unidades. Decide el comportamiento del overflow
  (wrap a 2 filas en el header grande / encoger gap / scroll horizontal). Figma muestra ~7–8
  puntos en una fila; si no caben, **preferir encoger el gap antes que hacer scroll**. Anótalo y,
  si hay duda con >10 puntos, pregunta al usuario con un ejemplo real.
- **Animación de relleno:** al volver del recap o al completar la última serie de un ejercicio,
  el punto correspondiente puede animar su transición pendiente→lleno (`withTiming` 200ms). No es
  obligatorio para la primera entrega, pero encaja con el patrón del proyecto.

### 4.4 Implementación real y correcciones de QA (cierra la Parte 1)

**Estructura:** cabecera sticky fuera del `ScrollView` (`headerWrap`, margen lateral
`spacing.lg`=15, `marginTop: spacing.lg`, `marginBottom: spacing.md`=10 — los 3 valores
confirmados con `get_design_context` sobre `109:489`/`109:511` en contexto, no sobre el
componente aislado). Dentro, un `Reanimated.View` (`headerBar`) cuya `height` anima
64↔36.71 vía `useAnimatedStyle`, con **2 capas absolutas superpuestas** (grande/compacta)
que cruzan opacidad con el mismo `compactProgress` (`useSharedValue`, `withTiming` 200ms
`Easing.inOut(Easing.ease)`) — mismo patrón que `SegmentedControl.jsx` (nada anima en el
montaje: un `useRef` salta el primer efecto). `compact: boolean` con histéresis
(`HEADER_COMPACT_ON=48`/`HEADER_COMPACT_OFF=24`) vía `onScroll` del `ScrollView`
(`scrollEventThrottle={16}`).

**Dots — 2 estados confirmados, no 3.** Se inspeccionó el SVG real de `110:3691`/`110:3693`:
`Ellipse24` = relleno sólido (`fill=black`, o sea `onAccent`), `Ellipse28` = solo borde sin
relleno (hueco real). `Ellipse25` (fill accent + borde negro fino) resultó ser una
inconsistencia del propio mock de Figma: como el fondo del header YA es accent, un relleno
accent es invisible ahí — visualmente indistinguible de `Ellipse28`, no es un 3er estado
real (Figma no usa variables/componente para los dots, son círculos sueltos con algo de
deriva). Implementado: completo = relleno `onAccent` sólido; pendiente = anillo `onAccent`
al 40% de opacidad. Overflow >7 unidades → encoge el `gap` (`spacing.sm`→`xs2`→`xs`), no
wrap ni scroll (no hizo falta preguntar, no llegó a probarse un caso real de >10 en QA).

**Tamaño de los dots y del icono de notas — mismo tamaño en ambas cabeceras** (`DOT_SIZE=8`
para los dots, `26` para `NoteIcon` en grande Y compacta). Esto es una corrección explícita
del usuario sobre el spec original: la 1ª implementación escalaba ambos con el header
(dots 6→4, notas 26→16, siguiendo literalmente el tamaño del asset de Figma en cada
variante); el usuario pidió que NO escalaran — dots iguales y algo más grandes que el
tamaño inicial (probado 10, revertido a 8 por "demasiado grande"), notas al tamaño que ya
tenía la grande (26). La flecha de atrás SÍ sigue escalando (26 grande / 16 compacta, no se
pidió cambiarlo).

**Centrado vertical del bloque grande (eyebrow/título/dots):** el título usaba el
`lineHeight` "normal" del font (Inter Black añade bastante aire de más a un tamaño de 20px)
lo que lo alejaba visualmente de eyebrow/dots aunque el `gap` fuera pequeño. Fix:
`lineHeight: 22` explícito en `grandeTitle`/`freeNameInputHeader`. El `gap` entre
eyebrow/título/dots se quitó del todo (`gap:0`, pedido explícito — antes `2`, valor de
Figma, pero el usuario lo prefirió a cero tras ver el resultado). Eyebrow y fila de dots
comparten una altura fija (`HEADER_ROW_H=14`, vía `lineHeight` en el eyebrow y `height` en
`dotsRow`) para que el título quede simétricamente centrado (el peso visual encima y
debajo del título tiene que ser igual para que el centrado automático de flexbox lo deje
exactamente en el medio).

**Cabecera compacta — full-width con gap equidistante:** `justifyContent:'space-between'`
(sin `gap` fijo) reparte el hueco sobrante en 3 partes iguales entre flecha/texto/dots/notas.
El texto (`compactTextWrap`) pasa de `flex:1` a `flexShrink:1, minWidth:0` — dentro de
`space-between` es el único elemento que debe ceder ancho y truncar (`numberOfLines={1}`) en
vez de acaparar el hueco.

**Fundido del scroll bajo la cabecera:** sin dependencia nueva — overlay con gradiente de
`react-native-svg` (`Defs`/`LinearGradient`/`Stop`/`Rect`, ya es dependencia del proyecto),
20px de alto, `th.colors.bg` opaco→transparente, `pointerEvents="none"`. La `opacity` del
overlay está atada al MISMO `compactProgress` del crossfade del header (0 en grande, 1 en
compacta) — pedido explícito de la 2ª ronda de QA: en la 1ª implementación el fundido
estaba siempre visible, y el usuario pidió que solo aparezca al colapsar la cabecera.

**`NoteIcon` (antes solo en `ExerciseCard.jsx`) se exportó y ganó un prop `tone`**
(`'surface'` por defecto = paleta original sobre card oscura, `'onAccent'` = paleta
invertida para usarlo sobre el fondo lima de la cabecera) — mismo componente, sin
duplicar el SVG.

**Corrección de scope necesaria (fuera de "solo cabecera"):** el `ScrollView` de contenido
(`content`) usaba `paddingHorizontal: spacing.xl` (20) heredado de antes de esta migración;
el margen real de página en Figma es `spacing.lg` (15, confirmado en el mismo
`get_design_context` de arriba). Se corrigió para que las Exercise Cards queden alineadas
con el margen de la cabecera nueva — si no, la cabecera habría quedado más ancha que las
cards debajo. No se tocó nada más del contenido (gap entre cards, cards en sí).

---

## 5. Exercise Card (restyle) — `Default` (`105:2490`) y `Collapse` (`364:3030`, ver corrección en §5.5)

Toda la máquina de estado de `ExerciseCard.jsx` se conserva: `inputType`, warmup pills, dropset,
puntero de serie activa (`activeSetIndex`), coach target/notes, auto-colapso animado
(`maxH`/`contentOpacity`/`collapsedMeasurer`). **Sólo cambian estilos y el prefijo de superset.**

### 5.1 Header de la card (expandida)
- **Nombre** en `text/card-title` (o `text/Exercice`, verificar §3), `color/text`, blanco.
- **Prefijo de superset (§0.4):** cuando `groupLabel` existe (`A1`, `A2`…), va **inline delante
  del nombre**, misma tipografía que el nombre pero `color/accent`. Ej: `A1 Puente de glúteo`.
  Sustituye al `groupBadge` tipo pill de hoy. Verifica el separador/espaciado en Figma.
- **Subtítulo** `3 X 8-10REPS` en `text/card-type` (ExtraBold 12, tracking 10), `mutedLight`,
  uppercase. Mantén el sufijo de calentamiento y el tempo inline como hoy (contenido igual).
- **Icono de notas del ejercicio** arriba a la derecha (`Empty notes`/`Full notes`). Mantiene la
  lógica actual (`clientNote`, `noteInputOpen`).
- Badge `isKey` ("clave"): no está claramente en Figma; restyle por analogía (pill accent) o
  confirmar si se elimina. Anótalo, no bloquees.

### 5.2 Chips de recomendación — `Chips` (`110:4247`)
- **Anatomía:** `space/sm` padding, `radius/xs`, **borde izquierdo de color**, fondo tint tenue,
  texto en el tint-50 del color. `Default` lima = subir peso; `Variant2` roja = bajar; `Variant3`
  azul = info/coach.
- Mapea a la lógica actual: `progression.type` up→lima, down→roja, hold→lima tenue; coach target
  (`hasCoachTarget`) → chip azul (`Variant3`). El azul = entrenador (regla global, §4.8 de
  `UI-MIGRATION.md`). Conserva la condición de ocultar la chip de progresión cuando hay coach target.
- **Familia de color `blue`**: ya adoptada en la migración (existe `th.colors.blue` / `th.tint.blue*`).
  Si falta algún tint azul en `themes.js` (formaFit), añádelo con el valor exacto de Figma.

### 5.3 Bloque de calentamiento — `Series/Calentamiento` (`213:2138`)
- Contenedor anidado con fondo `surface2`, `radius/md`, padding. Header: label `Calentamiento` +
  meta `90s descanso` (o "sin timer"). Pills de calentamiento `10Kg × 10 → 15Kg × 5` con flecha
  `→` entre ellas, **solo lectura** (no son inputs), primera pill resaltada lima.
- Es exactamente el `warmupBlock` actual: conserva `warmupComputed`, `toggleWarmupPill`,
  `warmupNoReference`, el disparo de `startRestTimer` al tocar una pill. Sólo restyle.

### 5.3-bis Grid de series — `SetRow.jsx` + `Input Field` (`105:2415`)
- **Columnas:** headers `KG` / `REP` / `RPE` (`text/spacing tag`, `mutedLight`) + celdas
  Input Field. Celda = fondo `surface`/`surface2`, borde `borderCard`, `radius/sm`, texto
  `text/card-title`-ish centrado.
- **Estados de celda (mapean a Input Field):** `Empty` = placeholder "—" gris; valor escrito =
  `Done`; serie activa = `Current` (borde lima, arrows ‹ › visibles = hint del scroll-adjust);
  durante el arrastre = `Sliding value` (`105:2485`) — es el estado que ya implementa el
  `inputAccentOverlay` animado + arrows activos. Conserva TODO el gesto `PanResponder`
  (scroll-para-ajustar), el fantasma de sesión anterior (gris) / coach target (azul), y el
  copy-from-prev.
- **Botón done:** `Icons/Serie uncheck` (`105:2459`) / `Serie Current Uncheck` (`105:2479`) /
  `Serie done` (`106:2701`). Restyle del `doneBtn` actual (36×36) contra esos glifos.
- **Botón timer (▶/⏸)** para `inputType` time/weight_time: restyle por analogía (no hay glifo
  propio evidente; mantener 36×36 alineado con el done).

> ### ⚠️ Excepción de fidelidad — alineación del grid (requisito explícito del usuario)
> En Figma el grid `sesiones/KG/REP/RPE` tiene **errores de alineación**: la columna RPE usa un
> ancho fijo (50–63px según el mock) distinto al de KG/REP, y el header RPE no queda perfectamente
> centrado sobre su celda. **Esto NO se replica.** La app hoy tiene las columnas perfectamente
> alineadas (KG/REP/RPE todas `flex:1`, headers centrados sobre cada celda, spacers de 20px/36px
> para el label de serie y los botones). **Mantén la alineación actual del código** (celdas de
> datos `flex:1` que se reparten el ancho por igual, headers centrados encima). Es el caso del
> §4.11 de `UI-MIGRATION.md` ("contenido vs. forma") y una corrección deliberada de un fallo del
> mock: la información y el estilo de celda vienen de Figma, pero la **rejilla se queda como está**.

### 5.4 Dropset — sección `DROPS`
- Label `DROPS` en rojo (`text/spacing tag`, `color/red`). Mini-tabla `KG/REPS` (sin RPE),
  filas `D1`… con celdas Input Field, `+ AÑADIR DROP` en rojo. Es el `dropBlock` actual: conserva
  `addDropToLastSet`/`updateDropField`/`toggleDropDone`/`removeDropFromLastSet` y la regla de que
  la card no auto-colapsa hasta que los drops estén hechos. Sólo restyle (hoy usa borde naranja;
  Figma usa rojo — adopta rojo).

### 5.5 Card colapsada / completada — HECHA, en testeo (commits `edf2086` + siguiente)

> ⚠️ **Corrección sobre esta sección**: el nodo `106:2957` que apuntaba esta guía resultó ser
> `Property 1=Collapsed old`, una variante vieja del componente. El nodo real y vigente es
> **`364:3030` (`Property 1=Collapsed`)** — verificado con `get_metadata` sobre el frame padre
> `106:2956` en la sesión que implementó esto. Si algo no cuadra al re-visitar, re-extrae sobre
> `364:3030`, no sobre `106:2957`.

**Diseño real (nodo `364:3030`), contra lo que decía esta guía:**
- **Fondo = `color/surface` (igual que la card normal, NO `tint/accent-10`)**, con un rect
  `surface2` al 60% de opacidad tiñendo SOLO la zona título/subtítulo (el mismo fondo que ya usa
  la cabecera de la card expandida — reutilizado tal cual, no un tratamiento nuevo). Borde
  `tint/accent-50` alrededor de toda la card (único highlight de "completado").
- **Check a la IZQUIERDA** (glifo plano, sin círculo/fondo propio, 26px, color accent) — al
  contrario de lo que decía esta guía. **Icono de notas a la DERECHA**, en el mismo sitio que
  ocupa en la cabecera expandida (mismo `NoteIcon`, mismo `onPress`).
- **Sin botón "+" para añadir serie** en el estado colapsado (se eliminó, no estaba en el nodo real).
- **Resumen de series = `EstructuraVisualizacionDatosEjercicios` "Semi compacta"** (no
  "Desglosada" — el nodo `364:3030` embebe la variante `176:1267`), reutilizando
  `groupSetsByWeight`/`getPillVariant`/`buildSetLabel` de `src/utils/setDisplay.js`, MISMA lógica
  que History/Progress. **Diferencia real confirmada contra los píxeles del nodo**: aquí "fuera de
  rango" es **ROJO** (`tint/red-30` bg, `color/red` texto), no el naranja que usan History/Progress
  — decisión de usuario específica para esta card, no una alineación con el resto de la app.
- **"Cambio mínimo" respecto a la cabecera expandida** (pedido explícito): la cabecera colapsada
  reutiliza el MISMO `header` (fondo/padding/nombre/subtítulo/icono de notas) que la expandida,
  solo con el check añadido a la izquierda — no es un componente nuevo.

**Colapso fluido (pedido explícito, no estaba en el spec original):** la cabecera es ahora
**persistente** (se pinta una sola vez, fuera del crossfade) — nombre/subtítulo/fondo/icono de
notas NO parpadean al colapsar/expandir. Solo dos cosas animan: (1) el check entra/sale
**deslizando** (`checkProgress`, ancho 0↔32 + opacidad, en paralelo a la altura) con el título
desplazándose para dejarle sitio; (2) el CUERPO (grid expandido ↔ resumen de pills) hace fade
out/in. La máquina de `maxH`/`contentOpacity`/`collapsedMeasurer`/`startCollapse`/`startExpand` se
conservó intacta — solo se le añadió `checkProgress` en paralelo.

**Bug de Android (overflow + borderRadius) — solución no obvia, no la repitas mal:** un `View` con
`overflow:'hidden'` + `borderRadius` en Android puede no repintar sus hijos tras cambiar de estado
(la card se queda con el fondo visible pero el contenido montado e interactivo SIN PINTAR — se
"pulsa" pero no se ve). El fix es un **borde permanente** (`borderWidth:1`, `borderColor:
'transparent'` en reposo) en la card: el ancho nunca cambia, solo el color (a `tint.accent50` al
completarse) — así tampoco hay salto de layout. Si se toca `card`/`cardCollapsed` en el futuro,
**no quitar ese borde transparente** aunque parezca decorativo/inútil a simple vista.

**Superseries — comportamiento del borde de completado (no estaba en el spec original, decisión
tomada en esta sesión):**
- Un `ExerciseCard` miembro de una superserie (`hideAddSetBtn=true`) **nunca** dibuja su propio
  borde de completado, esté o no completo — prop `suppressCollapsedBorder` (siempre `true` cuando
  `hideAddSetBtn`, calculado en `WorkoutScreen.jsx`).
- El highlight de completado vive en el **`SupersetBlock`** (`completed` prop), y solo se activa
  cuando **TODOS** los miembros están completos (`isExerciseDone`, extraída a
  `src/utils/exerciseStatus.js` para no duplicar la lógica entre `ExerciseCard` y `WorkoutScreen`)
  **Y** las N cards están visualmente colapsadas — no solo con los datos hechos. Reabrir CUALQUIER
  miembro a mano quita el borde del bloque al instante (cada `ExerciseCard` reporta su
  `isCollapsed` a `WorkoutScreen` vía `onCollapsedChange`, agregado por grupo en el estado
  `memberCollapsed`), igual que una card suelta expandida pierde su propio borde.
- `SupersetBlock` gana un `blockCompleted` (borde `tint.accent50` en los 3 lados que no ocupa la
  barra izquierda estructural — esa barra sigue siempre sólida `color/accent`, es un marcador
  distinto: "esto es una superserie", no de completado). No tiene `overflow:'hidden'`, así que NO
  necesita el truco del borde transparente permanente del punto anterior.

Conserva la máquina de auto-colapso (`maxH`/`contentOpacity`/`collapsedMeasurer`/`startCollapse`/
`startExpand`).

---

## 6. Bloques de acondicionamiento — `ConditioningBlockCard.jsx`

Rediseño en el componente `Exercice Card` (`106:2956`). Mapa de estados:

| Estado actual (código) | Variante Figma | Nodo |
|---|---|---|
| `idle` (AMRAP) | `AMRAP close` | `260:3294` |
| `running` (AMRAP) | `AMRAP running` | `260:3451` |
| `idle` (EMOM) | `Variant5` | `260:3626` |
| `running` (EMOM) | `Variant6` | `260:3655` |
| `finished` (cualquiera) | usar `Collapse` de la card como analogía (resumen colapsado) | `106:2957` |
| `for_time` (idle/running) | **sin variante propia** → restyle por analogía con AMRAP | — |

Contenido confirmado en los screenshots (mapea 1:1 con el código actual):
- **AMRAP close / EMOM idle:** título `AMRAP - Nombre Del Bloque` + meta (`10 MIN · 3 MOVIMIENTOS`
  / `10 RONDAS · 1:00 · 3 MOVIMIENTOS`) + icono notas; strip de nota del editor; lista de
  movimientos (`12 reps` en lima + `- Nombre del ejercicio`); botón lima `Empezar bloque`.
- **AMRAP running:** `Restante` + reloj grande lima (`text/hero`-ish, ~44px); `POR RONDA` +
  movimientos; steppers `Rondas completadas` y `+reps parciales` (usan `Icons/Plus`/`Minus`);
  botón `Finalizar - 15+15`; `CANCELAR BLOQUE` (texto).
- **EMOM running:** `Intervalo 1 de 20` + reloj grande; `ESTE INTERVALO` + movimiento actual;
  `SIGUIENTE` + próximo; **fila de dots numerados** (`Icons/round undone` `261:3717` / `Round
  current` `261:3723` / `Round done` `261:3726`; fallo = rojo); botón `Fallo`; `CANCELAR BLOQUE`.
- **finished:** fila con check + título + meta + `scorePill`; expandible al detalle + `Reabrir`.
  Restyle contra el patrón de card colapsada.

**Color semántico del bloque:** hoy el código usa accent=AMRAP, blue=EMOM, orange=for_time
(`ConditioningBlockCard` línea 87). Verifica contra Figma si el rediseño mantiene esa distinción
o si todos van en accent; ajusta pero conserva la lógica de derivación de reloj/haptics/keep-awake
intacta. `for_time` no tiene mock → restyle por analogía con AMRAP y anótalo.

---

## 7. Timer de descanso flotante (`RestTimerFloat` en `WorkoutScreen.jsx`)

No está en Figma → **restyle por analogía** (§0.3): tokens/colores FormaFit (fondo `surface`,
borde `borderCard`, `radius/lg`, anillo de progreso en `accent`, texto `text`), misma forma
(anillo + cuenta atrás + nombre + skip) y **mismo gesto** (swipe derecha para descartar). No
cambia la lógica (`restTimer` del store, `PanResponder`, slide in/out).

---

## 8. Modal de notas (`NotesModal` en `WorkoutScreen.jsx`)

- **Restyle FormaFit** + **drag-to-close** (§0.6). Reutiliza `src/components/DragSheet.jsx` (ya
  implementa backdrop que se desvanece con el arrastre, spring-in, umbral `dy>120 || vy>0.8`) o
  replica su patrón. **Requisito extra del usuario:** el arrastre debe funcionar **también desde
  el cuerpo/fondo del sheet**, no sólo desde el handle — replica el `PanResponder` del último
  modal actualizado del repo que ya lo hace así (el `DragSheet` actual sólo arrastra desde el
  handle; amplía los `panHandlers` al cuerpo respetando el scroll interno).
- Conserva `KeyboardAvoidingView` para el `TextInput`, `updateSessionNotes`, el hint
  "se guarda con la sesión". Cuida el edge-to-edge (SDK 54): `statusBarTranslucent` +
  `navigationBarTranslucent` (`UI-MIGRATION.md` §8).

---

## 9. Footer, "Añadir ejercicio", sesión libre

- **`GUARDAR SESIÓN`**: botón primario lima full-width (`text/btn-action`/hero sobre `onAccent`),
  `radius/md`. **`Descartar sesión`**: sólo texto, lima, uppercase, tracking amplio, centrado.
  Mapea a `Buttons` (`102:2078`) — variante primaria + `Tertiary buttom` (`235:4760`).
- **`+ Añadir ejercicio`**: outline `Añadir serie/sesion` (`106:3284`), borde `tint/accent-50`,
  texto accent. Misma acción (navega a `ExerciseSelector`).
- **Banner de sesión libre** y `freeNameInput` del header: no están en Figma → restyle por
  analogía (tokens nuevos), misma funcionalidad. En modo libre el header muestra el input de
  nombre + `ElapsedClock`; adáptalo al header lima nuevo.

---

## 10. Reglas de fidelidad específicas de Workout

Además de las globales de `UI-MIGRATION.md` §4:
1. **Grid perfectamente alineado** — no replicar el desalineado del mock (§5.3-bis). Es la
   excepción de fidelidad más importante de esta pantalla y viene por pedido explícito.
2. **Guión de Figma = `·` (punto medio con espacios)** en eyebrow/resumen del header
   (`SESIÓN A · 07:36`, `07:36 · Hipertrofia · Pull`). `UI-MIGRATION.md` §4.5.
3. **Preservar lógica > replicar mock.** Si el mock estático contradice un estado real (p. ej.
   título de ejercicio en lima en algún `WS mockup`), manda la lógica de la app; el mock grande
   `104:690`/`109:510` es la referencia buena (título en blanco).
4. **Verifica la instancia en contexto**, no el componente aislado, para gaps/padding de página
   (`UI-MIGRATION.md` §5).
5. **Feedback táctil en todo lo pulsable** (`UI-MIGRATION.md` §4.10).

---

## 11. Propuesta de división en partes

El usuario trabaja en iteraciones cortas (implementa → commit → QA). Propuesta (confirmar antes
de arrancar, y **preguntar lo que no esté claro antes de implementar cada parte**):

Orden real (se optó por la alternativa: calentar con la Parte 2 antes que la cabecera):

1. ✅ **Parte 1 — Cabecera colapsable + puntos de progreso** (commit `52a6d62`, EN TESTEO) —
   header sticky 2-estados con snap+crossfade + dots (fuerza + ad-hoc + bloques) + fundido del
   scroll bajo la cabecera. Detalle completo y correcciones de QA en §4.4 (varios puntos
   corrigen el spec original de §4.1-4.3, léela antes de retocar la cabecera).
2. ✅ **Parte 2 — Exercise Card expandida** (commits previos a esta guía) — header (+ prefijo
   superset A1/A2), chips, calentamiento, grid de series (¡alineación!), dropset, notas.
3. ✅ **Parte 3 — Exercise Card colapsada/completada** (commit `edf2086` + siguiente, EN
   TESTEO) — resumen 2-colores (§5.5), colapso fluido, borde de completado en superseries. Detalle
   completo en §5.5 (varios puntos corrigen esta guía, léela entera antes de tocar la card).
4. ⬜ **Parte 4 — Bloques AMRAP/EMOM/for-time** (`ConditioningBlockCard`) contra las variantes
   `Exercice Card`. **SIGUIENTE al retomar.**
5. ⬜ **Parte 5 — Timer flotante, modal de notas (drag-from-body), footer, sesión libre, ad-hoc.**

---

## 12. Verificación y commits (igual que el resto de la migración)

```bash
npx eslint mobile/src/components/workout/ExerciseCard.jsx   # desde la raíz del repo
npx eslint mobile/src/screens/WorkoutScreen.jsx
npx vitest run                                              # lógica; un restyle no debe moverlos
```
- Lint: hay errores preexistentes en ficheros grandes; **no añadir nuevos** (compara contra HEAD
  con el truco de `git stash` de `UI-MIGRATION.md` §6).
- Tests: son de lógica (utils/store). Si un cambio "visual" los rompe, tocaste lógica sin querer
  (aquí es fácil: hay mucha lógica entrelazada en `ExerciseCard`/`SetRow`).
- i18n: valida el JSON si lo editas. Todo texto visible nuevo → `es.json` **y** `en.json`.
- Prueba en dispositivo cada parte (el usuario revisa píxel a píxel). Estados a cubrir en QA:
  serie activa/hecha/vacía, card auto-colapsando al completar, dropset, superset (A1/A2),
  calentamiento sin referencia, coach target (azul), sesión libre, cada tipo de bloque
  (idle/running/finished), timer de descanso, modal de notas, header en scroll=0 y colapsado, y
  el relleno de los dots (incluyendo un bloque finalizado).

---

## 13. Cosas a confirmar al llegar (no bloqueantes)
- ~~Overflow de los dots con >8–10 unidades~~ **RESUELTO (Parte 1, §4.4):** encoge el gap,
  no wrap/scroll.
- ~~Estados del dot: ¿2 o 3?~~ **RESUELTO (Parte 1, §4.4):** 2 (hecho/pendiente) — el
  aparente 3er estado del mock era una inconsistencia de color de Figma, no un estado real.
- Fondo real de la Exercice Card: `color/workout-card` (#141414) vs `surface` — verificar por
  componente y decidir si se añade el token a `themes.js`.
- `text/card-title` (tracking 4) vs `text/Exercice` (tracking 0) para el nombre de ejercicio.
- `for_time`: confirmar restyle por analogía con AMRAP (no hay mock propio).
- Badge `isKey` ("clave"): ¿se mantiene como pill accent o se elimina? No está claro en Figma.
- **Idea aplazada (jul 2026, no implementada):** que todas las cards nazcan colapsadas al abrir
  la sesión salvo la primera — "colapsado pendiente" (sin datos, sin check, sin borde, sin
  resumen de pills), distinto del "colapsado completado" actual (§5.5). Requiere una SEGUNDA
  razón de colapso independiente de `allDone` (p. ej. `pendingClosed`, sembrado por un prop
  `startCollapsed` desde `WorkoutScreen`), con su propia altura medida (cabecera sola, sin
  pills) y sin disparar el efecto que hoy reabre la card en cuanto `allDone` es falso (ese efecto
  tendría que mirar `collapsed`, no `isCollapsed`, para no interferir). Decisiones de producto
  pendientes antes de implementar: (1) en una superserie, ¿"el primero" es el primer GRUPO
  (A1+A2 abiertas si el grupo 1 es superserie) o el primer ejercicio suelto?; (2) ¿ad-hoc y
  bloques de acondicionamiento entran en esta regla o quedan siempre visibles como hoy?
