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
| Clientes (tarjeta, header, modal de filtros) | ✅ | `src/screens/ClientsScreen.jsx` |
| Modal de sincronización | ✅ (solo colores) | `src/components/TrainerSyncModal.jsx` |
| **HomeView** | ✅ | `src/screens/HomeScreen.jsx` |
| Plantillas / ProgramScreen | ⬜ | `src/screens/ProgramScreen.jsx` |
| **Program Editor** | ✅ | `src/screens/ProgramEditorScreen.jsx`, `src/components/ui/StageSelector.jsx` |
| Sesion Editor (+ modal "···" nuevo) | ⬜ | `src/screens/SessionEditorScreen.jsx` |
| Exercice Editor (+ botones eliminar/sustituir) | ⬜ | `src/components/editor/ExerciseEditorInline.jsx` |
| Bloques AMRAP / EMOM | ⬜ | editores de bloque |
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
