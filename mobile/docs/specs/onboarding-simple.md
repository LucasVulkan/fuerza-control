# Spec — Onboarding simple (tres preguntas y tres portadas)

> Tema: onboarding
> En corto: El alta del usuario nuevo en tres preguntas y tres portadas, en vez del cuestionario largo. La revisión 1 se rechazó en QA porque no se parecía a la app; esta es la 2.
> Fase O01 · hecho · Revisión 2: tres preguntas y tres portadas, con la UI de la app
>
> Estado: **revisión 2 implementada** (ago 2026), pendiente de prueba en
> dispositivo. La revisión 1 se implementó y **el QA en dispositivo la rechazó**:
> el flujo estaba bien, la UI no se parecía a la app. Este documento es la verdad
> actual y sustituye por completo a la revisión 1.
>
> **Autocontenida a propósito**: todo lo necesario para ejecutarla en frío está
> aquí o en los ficheros que se citan con ruta y línea. Mockup aprobado por el
> usuario: las seis pantallas de esta spec salen de él.
>
> **Sólo móvil.** El onboarding web (`src/components/onboarding/OnboardingView.jsx`)
> no se toca, no se mira y no se migra. Comparte los ficheros de i18n, y eso
> condiciona qué claves se pueden borrar (§10).

---

## 1. Por qué hay una revisión 2

La revisión 1 acertó el recorrido —menos preguntas, plantillas de protagonistas,
ajustes encima del programa ya montado— y falló en lo visual. La causa, medida:

`OptionCard`, `OnboardingStep` y `OnboardingProgress` **son puertos literales del
onboarding web** (lo dice su propia cabecera: *"fiel al original web"*) y **no se
usan en ninguna otra pantalla de la app**. Cambiar tokens encima no arregla que
las *formas* sean ajenas: indicador circular y casilla cuadrada, cabecera de
título 30 px + subtítulo, barra de progreso de 3 px segmentada. Nada de eso
existe en el resto de la app.

**Los tres componentes se borran.** Todo lo que esta spec pinta sale de piezas
que ya usan otras pantallas migradas, y cada una se cita con su fichero y su
línea. **No se inventa un solo valor**: esta pantalla no tiene nodo en Figma, así
que la única fidelidad posible es copiar la anatomía de lo ya migrado.

Además cambian cinco cosas de producto que salieron del QA:

1. **El nivel vuelve a ser pregunta** (era una perilla en una pestaña diminuta).
2. **Los días no vienen premarcados**, y el aviso del ciclo se da *antes* de elegir.
3. **La tarjeta de plantilla se rehace**: nombre, tres datos que distinguen, sesiones.
4. **Los días de la semana desaparecen** del dibujo del ciclo: prometían un
   calendario que el programa no impone. Se cuenta semana a semana.
5. **El panel de ajustes se lee**: tres secciones con color, no un párrafo.

---

## 2. El flujo

```
selector de modo → NIVEL → ¿QUÉ BUSCAS? → DÍAS → PROPUESTAS → TU PROGRAMA
  (sin tocar)      3 opciones  4 opciones   1-7    3 + ver todas   ajustes + EMPEZAR
                   auto-avanza auto-avanza  auto-avanza
```

| Respuesta | Dónde | Por defecto |
|---|---|---|
| nivel | **pregunta 1** | ninguno |
| identidad (disciplina + objetivo) | **pregunta 2** | ninguno |
| días/semana | **pregunta 3** | **ninguno** — nada premarcado |
| tiempo/sesión | hoja de ajustes | `60` |
| material | hoja de ajustes | preset `gym` |
| limitaciones | hoja de ajustes | `['none']` |
| progresión | no se pregunta | `double_progression` |
| distribución | no se pregunta | de la plantilla elegida |

---

## 3. Estado del código

**Fichero principal:** `mobile/src/screens/OnboardingScreen.jsx` (1623 líneas tras
la revisión 1).

### 3.1 Lo que NO se toca

| Modo | Acción |
|---|---|
| `null` — selector inicial (5 tarjetas) | **conservar entero**, emoji incluidos |
| `'manual'` | conservar |
| `'template_picker'` | conservar |
| `'auto'` | **se rehace** |

El selector de modo se queda con sus cinco tarjetas, **"Tengo un entrenador"
incluida**: no es una forma de crear un programa, es una de las varias formas de
*obtener* uno, como importar un backup o cargar una plantilla propia.

Intactos también: `parseImportFile`, `ImportModal`, `handlePickFile`,
`handleImport`, `ClientCodeModal`, el efecto de `pendingExternalImport`,
`finish`, `handleEditProgram`, `handleManualCreate`, `handleLoadTemplate`,
`BrandTag`, `FitLogo`.

### 3.2 Lo que se borra

```
mobile/src/components/onboarding/OptionCard.jsx          fichero entero
mobile/src/components/onboarding/OnboardingStep.jsx      fichero entero
mobile/src/components/onboarding/OnboardingProgress.jsx  fichero entero
mobile/src/components/onboarding/AnswerChips.jsx         fichero entero (chips → NavRow + hoja)
mobile/src/components/onboarding/WeekStrip.jsx           fichero entero (días de semana → filas de semana)
```

Y en `OnboardingScreen.jsx`: `StepIdentity`/`StepDays` tal y como están hoy (se
rehacen), `ProposalCard` (se rehace), `AdaptationNotice` (se rehace), y todo
estilo que quede huérfano.

**Comprobación obligatoria antes de borrar cada fichero**: `grep -rn "<nombre>"
mobile/src`. Los cinco son de uso exclusivo del onboarding hoy, pero el borrado
sólo es seguro si el grep lo confirma en el momento de hacerlo.

### 3.3 Lo que se conserva

- `SessionRow` — las sesiones plegables, con dos cambios (§6.4).
- `uniqueSessionTemplates`, `exerciseName`, `totalWeeksOf`, `dedupSubstitutions`.
- `mobile/src/utils/weekPattern.js` **y su test** — el cálculo del ciclo no
  cambia; cambia sólo cómo se dibuja.
- `mobile/src/utils/equipmentPresets.js` — presets y `presetOf`.
- El invariante de guardado: **nada se persiste hasta EMPEZAR/EDITAR**
  (`confirmProgram` → `persistChosen` → `generateAndActivateProgram`).

### 3.4 Lo que se añade

| Fichero | Qué |
|---|---|
| `mobile/src/components/onboarding/CycleWeeks.jsx` | las filas «SEMANA 1 · A B C A» (§6.3) |
| `mobile/src/components/onboarding/AdjustSheet.jsx` | la hoja única de ajustes (§7) |
| `mobile/src/components/onboarding/AdaptationPanel.jsx` | el detalle por secciones (§8) |
| `mobile/src/utils/adaptationDiff.js` + `.test.js` | qué se llevó el tiempo (§5.2) |

---

## 4. El vocabulario visual — de dónde sale cada pieza

**Leer `mobile/docs/UI-MIGRATION.md` §3 (tokens), §4 (fidelidad) y §9 (patrones)
antes de escribir UI.** Todo lo de abajo son valores reales, ya en el repo.

| Pieza | Fuente exacta | Anatomía |
|---|---|---|
| Cabecera lima | `ProgramDetailScreen.jsx` `styles.header` | alto 52, `margin: lg lg 0`, fondo `accent`, radio `md`, `paddingHorizontal: lg`; eyebrow `btnAction` 10/tracking 1 en `muted`; título `hero` en `onAccent`, `lineHeight: 22` |
| Puntos de progreso | `HomeScreen.jsx:177` `CycleDots` | 7×7, radio 3.5, gap `sm`; hechos `onAccent`, pendientes `onAccent` al 16 % |
| Tarjeta de opción | tarjetas de navegación (Clientes/History/HomeView) | fondo `surface`, radio `md`, `padding: md lg`, gap `sm` entre tarjetas. **No** lista agrupada: `getCardRadii` es para listas densas de datos, no de elección (§9) |
| Chips 1-7 | `ProgramDetailScreen.jsx` `styles.chip` | `flex: 1`, `paddingVertical: sm`, radio `sm`, fondo `surface`, texto `hero`-ish; activo → fondo `accent`, texto `onAccent` |
| Fila navegable | `EditorRows.jsx:111` `NavRow` | fondo `surface`, radio `sm`, `padding: md`, gap `md`; título `cardType`/`text`, subtítulo `tag`/`mutedLight`, `ArrowIcon` a la derecha en `accent` |
| Fila de stats | `ProgramDetailScreen.jsx` `stats`/`stat` | valor `hero` a 22/lineHeight 24 en `accent`; etiqueta `smallBold` a 11 en `mutedLight` |
| Sesión | `ProgramDetailScreen.jsx` `sessionHead` | letra `hero`, nombre `cardTitle`, meta `tag` — **con los tamaños bajados**, §6.2 y §6.4 |
| Hoja | `DragSheet.jsx` | el único bottom-sheet de la app. Fondo `bg`; **nada dentro puede ir pintado en `bg`** |
| Cuerpo de hoja | `ExerciseEditorInline.jsx:706` (hoja de Progresión) | `sheetBody` gap `lg`; `stepTitle` = `spacingTag` uppercase en `mutedLight`, con el número en `accent`; `hint` = `tag`/`mutedLight`/lineHeight 14 |
| Segmentado | `ui/SegmentedControl.jsx` | props `{ options: [{id,label}], value, onChange }` |
| Pills multi | `ExerciseEditorInline.jsx` `linkPill` | fondo `surface2`, radio `xs`, `paddingHorizontal: 9`, `paddingVertical: sm`, texto `btnAction`; activo → `accent` + `onAccent` |
| Chevron de desplegar | `EditorIcons.jsx:26` `ChevronDown` | **el triángulo relleno (`▼`/`▲`) se borra: no se usa en ninguna parte de la app** |
| Flecha de fila | `EditorIcons.jsx:12` `ArrowIcon` | sólida; `ROW_CHEVRON` = 10.77 |

Reglas que salen de §4 de UI-MIGRATION y aplican en todo:

- **Bordes casi nunca**: sólo como highlight de acento. Nada de borde decorativo.
- **Azul = entrenador/externo, siempre.** No se usa aquí para nada.
- **Feedback táctil en todo lo pulsable** (`activeOpacity`), sin excepción.
- **Animación con Reanimated**, no `Animated` del core.
- Guión de Figma = `" · "` en la app.

---

## 5. Los dos cambios de motor

Todo lo demás sale de datos que ya existen. Estos dos no.

### 5.1 `reduceForBeginner` tiene que contar lo que hace — `src/utils/archetypeAdapter.js:108`

Hoy, a un principiante que elige una plantilla de intermedio le **quita una clave
y un accesorio por sesión y le añade un core**, y no lo reporta en ninguno de los
campos que devuelve `adaptArchetype`. El usuario ve menos ejercicios de los que
prometía la tarjeta y nadie se lo explica. **Es visible en el panel de ajustes.**

```js
// antes: function reduceForBeginner(exercises, userEquipment) → exercises
// ahora:
function reduceForBeginner(exercises, userEquipment) {
  …
  return { exercises: result, removed: [...ids quitados], added: addedId ?? null };
}
```

Es una función **privada del módulo** (no exportada) con **un único llamador**,
`adaptArchetype` en `:258-260` — el cambio de firma no rompe nada fuera. Ese
llamador acumula por sesión y `adaptArchetype` devuelve un campo nuevo:

```js
levelCuts: [{ label: 'A', removedIds: ['barbell_row'], addedId: 'plank' }, …]
```

Campo **añadido**, no modificado: ningún consumidor actual se entera. Vacío
cuando no hay reducción (todos los casos que no son principiante con plantilla
de otro nivel).

**Test nuevo** (en `src/utils/` junto a los del adaptador): un principiante con
una plantilla de intermedio devuelve `levelCuts` no vacío y con ids reales de la
biblioteca; el mismo principiante con `fullbody_hypertrophy_beginner` lo devuelve
vacío.

### 5.2 Qué se llevó el tiempo, con nombres — `mobile/src/utils/adaptationDiff.js` (nuevo)

`adaptArchetype` sabe qué sesiones **no caben** (`overTime`), pero no qué quitó
para que cupieran. Se calcula en la pantalla, como ya se hacía en la revisión
anterior: adaptar la MISMA plantilla con las MISMAS respuestas y
`sessionMinutes: null` —que desactiva `compressSession`
(`sessionCompression.js:331`)— y restar.

```js
/** @returns [{ label, removedIds: [...], setsDelta: 6 }] — sólo sesiones con recorte. */
export function diffAdaptations(free, budgeted) { … }
```

`free` y `budgeted` son dos resultados de `adaptArchetype`. Se comparan las
plantillas de sesión por `label`, y dentro por `exerciseId`.

**No se compara contra el arquetipo escrito**: mezclaría lo que quitan el
material y el nivel, que no se mueven al cambiar de 90 a 45 minutos.

**Test** (`adaptationDiff.test.js`): con dos objetos de sesión fabricados a mano
—sin motor— devuelve el id que falta y la diferencia de series; sin diferencias
devuelve `[]`; una sesión que sólo pierde series aparece con `removedIds: []` y
`setsDelta > 0`.

Cuesta un `adaptArchetype` de más por render del preview. Es puro y son
milisegundos: no hace falta debounce.

---

## 6. Pantalla por pantalla

### 6.1 Las tres preguntas

Las tres comparten cabecera: eyebrow `NUEVO PROGRAMA`, título de la pregunta,
y **tres puntos** a la derecha que se rellenan (§4). El botón de volver es el
`‹` de la izquierda; **no hay botón "Siguiente"**: las tres son de selección
única y **auto-avanzan al tocar**.

1. **Tu nivel** — «¿Cuánto llevas entrenando?». Tres tarjetas de opción con
   nombre (`cardTitle`) y descripción (`subtitle`/`mutedLight`). Debajo, un
   `hint`: «Marca tu banda de volumen y qué programas te proponemos.»
2. **¿Qué buscas?** — las 4 tarjetas de `IDENTITY_OPTIONS`
   (`muscle`/`strength`/`glutes_legs`/`calisthenics`), que fijan `discipline` y
   `goal`. **Ninguna se bloquea nunca**: `GOAL_MIN_LEVEL`, `goalAvailable` y
   `LEVEL_ORDER` ya no existen en esta pantalla. Un principiante que pide fuerza
   recibe la plantilla de fuerza con su nota `levelStretch` y su volumen
   adaptado. Decir la verdad en la tarjeta es mejor que decir que no en la
   pregunta.
3. **Días por semana** — chips 1-7, **ninguno seleccionado al entrar**
   (`daysPerWeek: null`). Debajo, dos líneas: *«Hay programas con más sesiones
   que días. Su ciclo dura más de una semana — te lo enseñamos en cada uno.»*

La selección pinta la tarjeta en `tint.accent10` con borde `accent50` y el
nombre en `accent`. Volver atrás no pierde nada.

### 6.2 Propuestas

Cabecera: eyebrow con lo contestado (`INTERMEDIO · 4 DÍAS`), título «Tus
programas». `rankArchetypes({ level, discipline, goal, daysPerWeek })` — **sin
`equipment`** (§9). Las tres primeras, más «ver las N plantillas» sin tope.

**La tarjeta, tres bloques bien separados:**

1. **Cabecera** — nombre (`cardTitle`) + badge `MEJOR` en la primera; debajo el
   byline (`subtitle`/`mutedLight`): `8 semanas · 3 fases`.
2. **Los tres datos**, en fila, separados por filete vertical `border`, con
   filete arriba y abajo. Valor `hero` 22 en `accent`, etiqueta `smallBold` 11 en
   `mutedLight`:
   - **SESIONES** — `archetype.days.length`
   - **SERIES/CICLO** — suma de `sets` de todos los ejercicios de todos los días
   - **EXIGENCIA** — tres barras de 14×8 (radio `xxs`), rellenas según
     `archetype.level`: principiante 1, intermedio 2, avanzado 3. Las apagadas en
     `muted`.
3. **Las sesiones** — letra en el color del día a **18 px** (no 26), nombre en
   `subtitle` (no `cardTitle` 16), meta en `tag`: `6 ejercicios · 18 series`.

Debajo, `archetype.summary` y **una sola nota**, la primera que aplique:

```js
const NOTE_PRIORITY = ['slowCycle', 'levelStretch', 'lowFrequency'];
```

`rotates` no se pinta (lo enseña §6.3) y `needsBarbell` no se emite aquí (§9).

**Las semanas no van en los stats**: son 8 en diez de las once plantillas —
medido— así que como dato destacado no distingue nada. Por eso viven en el
byline.

### 6.3 Tu programa

Cabecera lima con el nombre del programa. Debajo, en el cuerpo:

1. **Byline**: `8 semanas · 3 fases · Hipertrofia`.
2. **Los tres datos** (misma fila de stats de §6.2, sin filetes):
   **SESIONES · SERIES · POR SESIÓN**. Las series se cuentan sobre las
   **plantillas ya adaptadas**, no sobre el arquetipo, y los minutos son la media
   de las sesiones del ciclo con `estimateSessionSec` e
   `includesWarmup(sessionMinutes)` — nunca `sessionStats` (§9). Los tres se
   mueven al tocar los ajustes: es justo para lo que están.
   Cuatro columnas no caben (a 335 px tocan a 78 y `SERIES/CICLO` mide más), por
   eso las semanas están en el byline.
3. **Cómo se reparte** — `CycleWeeks` (nuevo componente):
   una fila por semana, fondo `surface`, radio `sm`, `padding: sm2 lg`.
   A la izquierda `SEMANA 1` en `smallBold` 11 `mutedLight` **en una sola línea**
   (`numberOfLines={1}`); a la derecha, empujados con `marginLeft: 'auto'`, un
   cuadrado de 26×26 por sesión, radio `xs`, **fondo `surface2` y la LETRA en el
   color del día** — al revés que en la revisión 1, porque así se lee mejor.
   Las filas salen de `weekPattern(daysPerWeek, sessionCount, weekIndex)`.
   **Dos filas cuando `daysPerWeek % sessionCount !== 0`**, una sola cuando la
   semana se repite. Nada de iniciales de días de la semana: el programa no
   impone qué día entrenas.
4. **Ajustes** — un `secLabel` «AJUSTES» y **un único `NavRow`**:
   título `60 MIN · GIMNASIO · SIN LIMITACIONES` (`numberOfLines={1}`),
   subtítulo «Tiempo, material y limitaciones», flecha en `accent`. Abre §7.
5. **La fila de ajustes aplicados** — `surface2`, radio `sm`, `padding: md`:
   «14 ajustes a tu programa» + `ChevronDown`. Despliega §8. Si no hay nada que
   decir, la fila no existe.
6. **Las sesiones**, plegables (§6.4).
7. **Pie**: «Puedes cambiarlo todo después, en el editor.» en `muted`, y
   **EDITAR** (secundario, `surface2` sólido sin borde) + **EMPEZAR** (`accent`).
   Aquí se guarda, por primera y única vez.

### 6.4 `SessionRow`

Se conserva, con dos cambios: **sin borde** (regla de bordes) y el `▼`/`▲`
sustituido por `ChevronDown`, rotado 180° con Reanimated al abrir. La letra de la
sesión va en el color del día, y la lista de ejercicios interior mantiene el
tratamiento que ya tiene (`cardType`/`accent` el número, `subtitle` a 14 el
nombre, `tag` la meta).

---

## 7. La hoja de ajustes — `AdjustSheet.jsx`

Un `DragSheet` con `title="Ajustes"` y **tres secciones numeradas en este
orden**, con el formato exacto de la hoja de Progresión
(`ExerciseEditorInline.jsx:706`): `stepTitle` con el número en `accent`, el
control, y un `hint` debajo que dice **el efecto de lo elegido**.

**1 · TIEMPO POR SESIÓN**
`SegmentedControl` con `30 / 45 / 60 / 90`. El hint, en `orange` cuando recorta y
en `mutedLight` cuando no:
- *«Se quita 1 ejercicio en A y B, y 6 series en total.»* — de `diffAdaptations` (§5.2)
- *«Cabe todo. Ningún recorte.»*

**2 · MATERIAL**
`SegmentedControl` con cuatro opciones cortas — **`Gimnasio · Casa · Cuerpo ·
Otro`**; con cuatro segmentos en 335 px cada uno tiene ~78 px y «Peso corporal»
no cabe en una línea (`SegmentedControl` fuerza `numberOfLines={1}`). El hint
dice qué es cada uno. `Otro` despliega debajo las **pills de multiselección** con
los 9 `EQUIP_IDS`, `bodyweight` exclusivo. Hint: *«6 ejercicios sustituidos · 2
huecos que no cubre.»*

Al abrir la hoja con un material que no coincide con ningún preset
(`presetOf(...) === 'custom'`), `Otro` viene ya seleccionado y las pills
desplegadas.

**3 · LIMITACIONES**
Sólo **pills de multiselección**: `Ninguna · Hombro · Lumbar · Rodilla`, con
`none` exclusivo. Hint: *«2 ejercicios sustituidos para evitar el hombro.»*

Las pills van en fila que envuelve (`flexWrap`), que es la única desviación
respecto a `linkPill` — allí van en columna porque son etiquetas largas.

Cada toque actualiza `answers`, re-corre `adaptArchetype` y **repinta el programa
de debajo**: los hints y los tres datos de §6.3 cambian con la hoja abierta. Eso
es la feature, no un extra.

---

## 8. El panel de ajustes — `AdaptationPanel.jsx`

Colapsado tras la fila de §6.3. Al desplegarse, **tres secciones**, cada una con
su cabecera (`spacingTag` uppercase en su color + contador en píldora), y sus
filas en `surface`, radio `xs`, `padding: sm md`:

| Sección | Color | Qué lista |
|---|---|---|
| **Sustituidos** | `accent` | `substitutions` deduplicadas: `origen → destino` con `ArrowIcon` gris entre medias. El origen tachado en `mutedLight`, el destino en `text`. Etiqueta a la derecha con el motivo: `MATERIAL`, `NIVEL`, `HOMBRO`/`LUMBAR`/`RODILLA` según `reason` |
| **Quitados** | `orange` | la letra de la sesión en su color + el nombre del ejercicio + etiqueta con el motivo: **`45 MIN`** (de `diffAdaptations`) o **`TU NIVEL`** (de `levelCuts`). El core que `reduceForBeginner` **añade** va en esta misma lista, en `accent`, con la etiqueta `AÑADIDO · TU NIVEL` |
| **Sin cubrir** | `red` | `unresolved` agrupado por grupo muscular: «2 huecos de espalda» + etiqueta `TU MATERIAL NO LLEGA` |

**Tiempo y nivel van en la misma sección a propósito**: quitan lo mismo
—ejercicios y series— y separarlos obliga a leer dos veces para saber qué falta.
El motivo lo dice la etiqueta, igual que en las sustituciones.

**Nada en azul**: en esta app el azul significa siempre entrenador o externo.

El contador de la fila colapsada es la suma de las tres secciones.
`overBudget` se sigue enseñando como una línea suelta en la sección roja.

---

## 9. Invariantes que no se tocan

- **A `rankArchetypes` NO se le pasa `equipment`.** Ausente ≠ `[]`: `[]`
  significa "sólo tiene su peso corporal" y hunde toda plantilla de barra. Hay un
  material por defecto y la tentación es real. La regresión está medida en
  [onboarding-proposals.md](onboarding-proposals.md) §3.1. Consecuencia:
  `needsBarbell` no se emite nunca aquí.
- **Nada se guarda hasta EMPEZAR o EDITAR.** Si el guardado sube a la elección de
  plantilla, «ver otro programa» deja programas huérfanos y etapas
  materializadas en el store.
- **El preview usa `estimateSessionSec`, no `sessionStats`** — para que el número
  no contradiga al presupuesto aplicado (program-templates.md §5.3.1).
- **`answers.distribution`** se rellena con la de la plantilla elegida antes de
  guardar (`persistChosen`).
- `normalizeOnboardingAnswers` (`mobile/store/useStore.js:70`) es idempotente: la
  pantalla la aplica y el store la vuelve a aplicar.
- `generateAndActivateProgram(answers, archetypeId)` (`:353`) no cambia.

---

## 10. i18n

Todo por `t()`, en `src/locales/es.json` **y** `en.json` (raíz del repo).
`src/locales/locales.test.js` exige el **mismo juego de claves en los dos**.

Se reutiliza lo que ya existe: `onboarding.levels.*`, `onboarding.identity.*`,
`onboarding.stepDays.*`, `onboarding.stepLevel.*`, `onboarding.stepTime.*`,
`onboarding.stepEquipment.*`, `onboarding.stepLimitations.*`,
`onboarding.sessionTimes.*`, `onboarding.equipment.*`, `onboarding.limitations.*`,
`onboarding.equipmentPresets.*`, `onboarding.proposals.*`, `onboarding.preview.*`.

**Nuevas** — cabecera de preguntas, las secciones de la hoja, las etiquetas de
motivo del panel, los hints de efecto, `SEMANA {{n}}`, los datos de la tarjeta
(`SESIONES`, `SERIES/CICLO`, `EXIGENCIA`, `SERIES`, `POR SESIÓN`) y el aviso de
ciclo de la pregunta de días.

**Se borran** (sin uso y sólo del móvil): `onboarding.week.*` — las iniciales de
los días de la semana se van con la tira.

**NO se borran aunque parezcan huérfanas**: `onboarding.stepDistribution.*`,
`onboarding.distributions.*`, `onboarding.progressionModels.*`,
`onboarding.stepProgression.*`, `onboarding.disabledReasons.*`. Las usa el
onboarding **web**. `grep -rn "<clave>" src/` antes de borrar cualquier cosa.

---

## 11. Verificación

- `npx vitest run` desde la raíz. Referencia actual: **1125 verdes**. Deben
  seguir todos, más los nuevos de `adaptationDiff.test.js` y el de `levelCuts`.
  `weekPattern.test.js` y `onboardingAnswers.test.js` **no se tocan** y tienen
  que seguir verdes.
- `npx eslint mobile/src` — igual que en HEAD, sin errores nuevos. En
  `OnboardingScreen.jsx` hay **2 preexistentes** (`useRef` sin usar, `setState`
  en un efecto).
- `npm run estado` para regenerar `mobile/docs/estado.html`.
- Actualizar la fila de **Onboarding** en `mobile/docs/UI-MIGRATION.md` §1 y su
  desglose: los tres componentes portados del web ya no existen.

**Probar en dispositivo.** Los cinco caminos del selector, y el nuevo entero:
tres preguntas con auto-avance y vuelta atrás sin perder respuestas → elegir
tarjeta → abrir la hoja y mover las tres secciones viendo cambiar los tres datos
→ desplegar el panel → «ver otro programa» → EMPEZAR y EDITAR.

Dos recorridos concretos que hay que mirar con lupa:
**principiante + Upper/Lower + 4 días** (es donde `levelCuts` tiene que aparecer)
y **calistenia + 5 días + sólo peso corporal** (donde más sustituye el adaptador).

---

## 12. Trampas conocidas

- **No inventar UI.** Esta pantalla no tiene nodo en Figma. Cada valor sale de la
  tabla de §4, y esa tabla cita fichero y línea. Si algo no está ahí, se copia de
  la pantalla migrada más parecida — nunca se elige "lo que quede bien".
- **`DragSheet` es el único bottom-sheet.** No montar otro `Modal`, no usar
  `Alert` nativo. Nada dentro de la hoja pintado en `bg`.
- **El triángulo relleno no existe en esta app.** `ChevronDown` para desplegar,
  `ArrowIcon` para filas navegables.
- **La cabecera del preview va fuera del `ScrollView`**: es lo que responde a la
  hoja de ajustes. Si se va con el dedo, deja de verse el efecto.
- **`FlatList` con `ListHeaderComponent`**: pasar el elemento, nunca una función
  que lo devuelva, o se remonta en cada render.
- **Reanimated**, no `Animated` del core. (`DragSheet` usa core por historia
  propia; no es precedente.)
- **Borrar claves de i18n sin `grep` en `src/`** rompe el onboarding web en
  silencio: comparten fichero.
- **`reduceForBeginner` cambia de firma.** Es privada y tiene un solo llamador,
  pero conviene comprobarlo con `grep` antes de tocarla.
- **El segundo `adaptArchetype`** (el de `sessionMinutes: null`) sólo hace falta
  para el diff del tiempo. Es puro y barato; no envolverlo en nada raro.

---

## 13. Qué NO entra

- **El onboarding web.** Sigue con sus 8 pasos.
- **El resto del motor**: `rankArchetypes` y el ranking no se tocan. Los dos
  cambios de §5 son los únicos.
- **El catálogo** (fase 8 de program-templates): once plantillas, incompletas.
  Sigue siendo la siguiente prioridad — con las plantillas de protagonistas, lo
  que falta es catálogo.
- **Mover el material al perfil.** Es lo lógico (el material es del gimnasio, no
  del programa) pero toca `profile` y la sincronización. La hoja de §7 lo deja
  suficientemente barato como para que no urja.
