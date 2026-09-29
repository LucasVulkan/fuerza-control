# Spec — Variantes de ejercicio

> Tema: programas
> En corto: Agarre y anchura dejan de ser ejercicios distintos: son la «variante» de uno solo, que informa, se apunta en cada entreno y se puede filtrar en Progreso. Lo que cambia la carga (a una mano, o separar una variante para tener dos jalones el mismo día) sí es otro ejercicio, con id fijo y progresión propia.
> Fase P41 · hecho · Librería: fusión de repetidos, migración de ids y buscador por palabras · §3
> Fase P42 · hecho · La variante en el editor y en las listas · §4
> Fase P43 · pendiente · La variante de hoy en el Workout, compartir y pegar · §5
> Fase P44 · pendiente · Cambiar el ejercicio: unilateral y ejercicio aparte · §6
> Fase P45 · pendiente · Progreso filtrado por variante · §7
>
> Estado: **P41 probada y P42 implementada** (29-sep-2026, rama
> `feat/exercise-variants`); P42 pendiente de probar en dispositivo; P43-P45 sin
> implementar. Lo que salió
> distinto de lo escrito, en §3.5.
>
> Spec cerrada el 29-sep-2026. Maqueta aprobada:
> [`docs/mockups/exercise-variants.html`](../mockups/exercise-variants.html)
> (§0-§7; las referencias «maqueta §N» de abajo son a ella). Sale de una sesión
> de diseño con el usuario que pasó por pills, familias de ejercicios y chips en
> el buscador, y lo descartó todo por complicar más que resolver (§1.3). Orden:
> P41 → P42 → P43 → P44 → P45; P41 va primero porque cambia ids que todo lo
> demás usa, y deja hecha la utilidad pura de identidad (§2.5) que P44 usa.

---

## 1. Contexto y decisiones cerradas

### 1.1 El problema

La librería trata como ejercicios distintos cosas que son el mismo movimiento
con otra mano: `pulldown_pronated`, `pulldown_supinated` y `pulldown_neutral`
son tres «Jalón al pecho»; `cable_row` y `seated_row_neutral` son dos «Remo en
polea»; las dominadas sin lastre y las de agarre neutro son dos entradas. Cada una lleva su historial, así que
cambiar de agarre parte la progresión en trozos, y el buscador se llena de
repetidos.

### 1.2 La regla (una sola)

**¿Mueves más o menos el mismo peso?**

- **Sí → variante.** Agarre (prono / supino / neutro) y anchura (ancho / medio /
  estrecho). Solo informa: mismo ejercicio, mismo historial, misma progresión.
  Se apunta en cada entreno y se puede filtrar en Progreso.
- **No → otro ejercicio**, con su id y su historial: cambiar de implemento
  (barra, mancuernas, polea, máquina, kettlebell), hacerlo **a una mano**, o un
  agarre que cambia la carga (press banca agarre cerrado, curl martillo, curl
  inverso: se quedan como están).

### 1.3 Decisiones del usuario (no reabrir)

- **Sin familias de ejercicios.** Se probó agrupar «Remo» con un chip por
  implemento y se descartó: el borde de la familia era arbitrario (¿por qué el
  remo en T o el de anillas no entran?). La librería sigue con **un ejercicio por
  implemento**, como hoy. El buscador **no cambia**, salvo buscar por palabras
  sueltas (P41).
- **Solo dos dimensiones**: agarre y anchura. Inclinación de banco y maneral
  (cuerda, triángulo, barra V) quedan fuera; lo que tiene nombre propio por el
  maneral («Jalón con triángulo») es un ejercicio de la librería.
- **La variante no toca la progresión ni los récords.** Solo se guarda y se filtra.
- **Unilateral = otro ejercicio.** Si la librería tiene la versión a una mano
  («Remo unilateral en polea»), se usa esa; si no, la app la crea como ejercicio
  propio con **id fijo** (`pulldown__uni`).
- **Ejercicio aparte**: un interruptor convierte una variante en su propio
  ejercicio con id fijo (`pulldown__pronated_wide`, nombre «Jalón al pecho ·
  Prono · Ancho», **sin paréntesis**: el usuario los descartó por raros),
  progresión propia y variante fija. Sirve para tener dos
  jalones en la misma sesión, que la app no admite (§1.4).
- **Una sola hoja, «Variante»**, en el editor de ejercicio: arriba lo que solo
  informa (agarre, anchura), abajo lo que cambia el ejercicio (Unilateral,
  Ejercicio aparte). En el Workout, la misma hoja **solo con agarre y anchura**,
  «solo esta sesión».
- **Workout:** la variante va detrás del nombre, en gris, **sin subrayado ni
  icono** (el icono quizá más adelante). Si el programa no tiene variante, no
  sale nada y no hay nada que tocar.
- **Editor de sesión:** la variante va en la línea del nombre, no en la de meta.
- **Ejercicios propios** también declaran dimensiones (P42) y «a una mano» (P44).
- **Dominadas supinas (chin-up) siguen siendo un ejercicio**: en inglés tienen
  nombre propio. Se renombra a «Dominadas supinas» / «Chin-ups» y buscar «chin
  up» tiene que encontrarla (§3.4).
- Retrocompatibilidad de datos no se exige en general, pero **el historial del
  usuario no se pierde**: los ids fusionados se migran (P41).

### 1.4 Restricciones del código que marcan el diseño

- **Una sesión no admite el mismo ejercicio dos veces.** `addExercise` y
  `replaceExercise` (`store/useStore.js`, ~l.1058) lo rechazan **en silencio**;
  `activeSession.setsState`, `exerciseNotes` y el log van por `exerciseId`. Por eso
  existe «Ejercicio aparte» y por eso los interruptores de identidad se bloquean
  (§6.5).
- **El Workout no tiene «Sustituir».** Cambiar de ejercicio a mitad del entreno
  tocaría `setsState`, la «última vez» (`lastExerciseRef`, que busca en la misma
  plantilla y sus etapas), el recap y el guardado. Fuera de alcance (README →
  *Pendientes menores*).
- **Los ejercicios propios ya funcionan en toda la app**: 21 archivos resuelven
  definiciones como `{ ...exerciseLibrary, ...customExercises }`
  (`getEffectiveLibrary()` en el store), y `customExercises` viaja con programas
  e historial entre entrenador y cliente y entra en las copias. Por eso un
  ejercicio derivado **se materializa en `customExercises`** y no hace falta
  ninguna capa de resolución nueva.
- `exerciseLibrary` **no se persiste** (`partialize`): los cambios de la
  librería se ven al arrancar. Lo que se persiste y hay que migrar es lo que
  guarda ids: plantillas, historial, alias, etc. (§3.3).

---

## 2. Modelo de datos

### 2.1 Catálogo — `src/utils/variants.js` (nuevo)

```js
export const VARIANT_DIMS = {
  grip:  ['pronated', 'supinated', 'neutral'],
  width: ['wide', 'medium', 'narrow'],
};
export const DIM_ORDER = ['grip', 'width'];   // orden de pintado y de sufijo
```

Una variante es `{ grip?, width? }` con valores del catálogo. `{}` o ausente =
sin especificar. Todo lo que compara variantes usa `sameVariant(a, b)` (mismas
claves con valor, ignorando `undefined`/`null`).

Helpers puros del mismo fichero, con tests:

- `variantParts(variant, t)` → `['Prono', 'Ancho']` en `DIM_ORDER`.
- `variantLabel(variant, t)` → `'Prono · Ancho'` (con `SEP` = `' · '`), o `''`.
- `cleanVariant(variant, def)` → quita las dimensiones u opciones que el
  ejercicio no declara (se usa al sustituir y al aplicar arquetipos).
- `variantKey(variant)` → `'pronated_wide'` (sufijo de id; §2.5).

### 2.2 Dimensiones de cada ejercicio

Campo nuevo en la librería y en los ejercicios propios:

```js
variants: { grip: ['pronated', 'supinated', 'neutral'], width: ['wide', 'medium', 'narrow'] }
```

Solo las opciones que tienen sentido para ese ejercicio. Sin campo = no tiene
variante. Lista inicial (el implementador la revisa contra la librería; es un
punto de partida, no un techo):

| Ejercicio | grip | width |
|---|---|---|
| `pulldown` (Jalón al pecho, §3.1) | las 3 | las 3 |
| `pull_up` (Dominadas, §3.1) · `pull_up_weighted` · `pull_up_assisted` | prono, neutro | las 3 |
| `cable_row` (Remo en polea, §3.1) · `machine_row` | las 3 | las 3 |
| `barbell_row` | prono, supino | ancho, medio |
| `single_arm_cable_row` · `db_row_unilateral` | prono, neutro | — |
| `bench_press_barbell` · `incline_bench_press_barbell` | — | ancho, medio |
| `bench_press_db` · `incline_press_db` · `shoulder_press_db` | prono, neutro | — |
| `chest_press_machine` · `shoulder_press_machine` | prono, neutro | — |

Fuera a propósito: curls (martillo e inverso cambian la carga y ya son
ejercicios), sentadillas y prensas (la «anchura» de pies se deja para cuando
haya una dimensión de posición de pies; hoy la prensa ya tiene tres entradas
por pies y se quedan así).

### 2.3 En la sesión — `exConfig.variant`

`template.exercises[i].variant = { grip?, width? }`. Opcional. Viaja con la
plantilla (entrenador → cliente sin trabajo extra) y con el grupo vinculado:
se añade `'variant'` a `LINKED_CONFIG_KEYS` (`src/utils/exerciseLinks.js`).

### 2.4 En el registro — `entry.exercises[i].variant`

Lo que se hizo **de verdad**: la variante de hoy si se cambió en el Workout
(P43), si no la del programa. Se omite la clave si está vacía. No se usa para
nada más que pintar y filtrar.

### 2.5 Identidad: gemelos y derivados — `src/utils/exerciseIdentity.js` (nuevo, P41)

Utilidad **pura** (sin store), con tests. P41 la necesita para la migración
(§3.3) y P44 para los interruptores.

**Gemelo unilateral de la librería.** Campo nuevo `unilateralOf` en la entrada
a una mano, apuntando a la de dos manos:

| Unilateral | `unilateralOf` |
|---|---|
| `single_arm_cable_row` | `cable_row` |
| `single_leg_press` | `leg_press_standard` |
| `single_leg_rdl_db` | `romanian_deadlift_db` |
| `single_leg_hip_thrust` | `hip_thrust` |

**Derivado.** Un ejercicio que la app crea copiando otro, guardado en
`customExercises` con id fijo:

```
<base>__uni                 unilateral sin gemelo en la librería
<base>__<variantKey>        ejercicio aparte          (pulldown__pronated_wide)
<base>__uni__<variantKey>   unilateral + aparte        (pulldown__uni__pronated)
<gemelo>__<variantKey>      aparte sobre un gemelo     (single_arm_cable_row__neutral)
```

Su definición:

```js
{
  ...rootDef,                         // copia del ejercicio de partida (librería o propio)
  id,
  name, nameEn,                       // §2.6
  isUnilateral: uni || rootDef.isUnilateral,
  variants: variant ? {} : (uni ? { grip: rootDef.variants?.grip } : rootDef.variants),
  derived: { root, unilateral: uni, variant },   // variant: null si no es aparte
  isCustom: false,                    // no lleva la etiqueta CUSTOM del buscador
}
```

Una sola forma canónica, así los dos móviles llegan siempre al mismo id.

API:

- `decompose(id, lib)` → `{ root, uni, natural, variant }`.
  `lib[id].derived` → sus campos · `lib[id].unilateralOf` → `{ root: unilateralOf,
  uni: true }` · `lib[id].isUnilateral` sin gemelo → `{ root: id, uni: true,
  natural: true }` · resto → `{ root: id, uni: false }`.
- `compose({ root, uni, variant }, lib)` → `{ id, def | null }`: `base = uni ?
  (gemeloDe(root) ?? root + '__uni') : root`; `id = variant ? base + '__' +
  variantKey(variant) : base`. Devuelve `def` (a materializar) solo si `id` no
  existe en `lib`.
- `gemeloDe(root, lib)` → el id cuyo `unilateralOf === root`, o `null`.
- `canBeUnilateral(def, lib)` → `false` si ya es unilateral; `true` si tiene
  gemelo o si `def.equipment` incluye `dumbbells`, `cables`, `machines`,
  `kettlebell` o `resistance_band` (una barra se coge con dos manos).

### 2.6 Nombres

Se generan una vez, al crear el derivado, en **los dos idiomas**, importando
`es.json` y `en.json` como ya hace `src/utils/sessionText.js` (no con la `t` del
idioma actual):

- Unilateral: `variants.nameUnilateral` → es «{{name}} unilateral», en
  «Unilateral {{name}}» (sin paréntesis, como en español).
- Aparte: `variants.nameApart` → «{{name}} · {{variant}}», con `variantLabel`:
  «Jalón al pecho · Prono · Ancho». Sin paréntesis (decisión del usuario). El
  texto de compartir sesión tiene que entender nombres con « · » (§5.2).
- Unilateral + aparte: «Jalón al pecho unilateral · Prono».

Se distingue de un ejercicio normal con variante por el peso: el aparte es todo
nombre, en negrita; el normal lleva la variante detrás, en gris.

---

## 3. P41 — Librería: fusión, migración y buscador

### 3.1 Fusión

| Id nuevo | Nombre (es / en) | Sustituye a (con la variante que llevaba) |
|---|---|---|
| `pulldown` | Jalón al pecho / Lat Pulldown | `pulldown_pronated` (prono) · `pulldown_supinated` (supino) · `pulldown_neutral` (neutro) |
| `cable_row` (se queda) | Remo en polea / Seated Cable Row | `seated_row_neutral` (neutro) |
| `pull_up` | Dominadas / Pull-ups | `pull_up_weighted_barbell` (—, era «Dominadas sin lastre») · `pull_up_weighted` (—, «Dominadas lastradas») · `pull_up_neutral` (neutro) |

- La entrada nueva hereda los metadatos de la más usada (`pulldown_pronated`,
  `pull_up_weighted_barbell`); nivel, grupo, músculos y `priority` se revisan a
  mano. `isKeyCandidate: true` si alguna lo era.
- `relatedVariants` y `assistedVariantId` de **toda** la librería se reescriben
  con el mapa (varias apuntan a los ids viejos; ver `grep`).
- **`pull_up_supine` no se fusiona** (decisión del usuario: en inglés es otro
  ejercicio, «chin-up»). Solo se renombra: «Dominadas supinas» / «Chin-ups».
- `pull_up_weighted` (lastradas) **también se fusiona** (decisión del usuario,
  QA 29-sep): el peso apuntado en «Dominadas» es el lastre y la carga ya suma
  el peso corporal (`trainingLoad.effectiveWeight`); separarlas partía la línea
  de progreso justo al progresar. `pull_up` pasa a salto de 2,5 kg (antes 0,
  que nunca proponía lastre) y a `max_strength: 'high'`.
- `high_cable_row` («Remo polea alta») **no** es un jalón: es tirar hacia la cara
  con los codos abiertos, 15-20 reps, primo del face pull. Se queda.

### 3.2 Arquetipos y tests

- `src/data/archetypes.js`: cada slot con un id viejo pasa al nuevo y gana
  `variant` (p. ej. `{ exerciseId: 'pulldown', variant: { grip: 'pronated' }, … }`).
  Donde `archetypeAdapter.js` construye el `exConfig` desde el slot
  (`exerciseId: resolvedExId`, ~l.87), copia `variant` pasada por
  `cleanVariant(variant, defDelResuelto)` (si el resolvedor cayó en otro
  ejercicio, la variante que no aplica se cae).
- Test nuevo: **ningún día de ningún arquetipo tiene dos veces el mismo
  `exerciseId`** tras el mapa (hoy los jalones prono y supino están en días
  distintos; el test lo asegura).
- Actualizar los tests que citan ids viejos: `onboarding.test.js`,
  `sessionCompression.test.js`, `trainingLoad.test.js`, `weeklyVolume.test.js`.

### 3.3 Migración — `src/utils/exerciseIdMigration.js` (nuevo)

```js
export const LEGACY_IDS = {
  pulldown_pronated:        { id: 'pulldown',  variant: { grip: 'pronated' } },
  pulldown_supinated:       { id: 'pulldown',  variant: { grip: 'supinated' } },
  pulldown_neutral:         { id: 'pulldown',  variant: { grip: 'neutral' } },
  seated_row_neutral:       { id: 'cable_row', variant: { grip: 'neutral' } },
  pull_up_weighted_barbell: { id: 'pull_up', name: 'Dominadas sin lastre', nameEn: 'Pull-ups (bodyweight)' },
  pull_up_weighted:         { id: 'pull_up', name: 'Dominadas lastradas',  nameEn: 'Weighted Pull-ups' },
  pull_up_neutral:          { id: 'pull_up',   variant: { grip: 'neutral' } },
};
```

`migrateExerciseRefs(data, lib)` — pura, idempotente, muta en sitio, con tests.
Recorre lo que guarda ids:

- `sessionTemplates[*].exercises[*]`: `exerciseId` → nuevo; `variant` = la del
  mapa si el exConfig no traía.
- `workoutLog[*].exercises[*]` y `clientLogs[*][*].exercises[*]`: igual.
- `exerciseAliases` (alias → id): los valores.
- `clientSync.pendingOverrides[*].exercises`: las claves.
- Bloques (`template.blocks[*].movements[*].exerciseId`): el id (sin variante).

**Choque dentro de una sesión** (una plantilla con `pulldown_pronated` y
`pulldown_neutral`): el primero pasa a `pulldown` con su variante; el segundo
pasa a **ejercicio aparte** — `compose({ root: 'pulldown', uni: false, variant },
lib)` — y su definición se añade a `customExercises`. En las entradas del
historial **de esa misma plantilla** (`sessionTemplateId`) el segundo recibe el
mismo id aparte, para que no se mezclen al fusionar.

Dónde se llama (una vez por entrada de datos):

1. `onRehydrateStorage`, junto a las demás migraciones «pre-publicación».
2. `importData`, sobre `data` antes de fusionar.
3. `downloadClientHistory`, `_restoreFromSlot` y `checkAndPullProgramUpdates`,
   sobre lo que llega (historial de un cliente con la versión vieja, programa de
   un entrenador con la vieja). Si el implementador encuentra otra entrada de
   datos de otro móvil que no pase por `importData`, también.
4. `activeSession` (clave aparte, se lee tras rehidratar): las claves de
   `setsState` y `exerciseNotes`. Es raro tener una sesión abierta al
   actualizar, pero sin esto se pierden las series.

### 3.4 Buscador por palabras

`filterBySearch` (`src/utils/searchText.js`) casa hoy la frase entera:
«remo polea» no encuentra «Remo en polea», y «chin up» no encuentra la chin-up
(y, como no casa nada, la vuelta de subsecuencia devuelve press en máquina y
curls). Reglas nuevas, en este orden:

1. Los guiones cuentan como espacio, en la búsqueda y en el texto.
2. Casa si **todas las palabras** de la búsqueda están en el texto, en cualquier
   orden y como parte de palabra («dominada supina» → «Dominadas supinas»).
3. Si nada casa, casa si la búsqueda **sin espacios** está en el texto sin
   espacios («chinup» → «Chin-ups»).
4. Solo si tampoco, la subsecuencia de hoy (≥ 4 letras).

Tests en `searchText.test.js`: «remo polea», «chin up», «chin-up», «chinup» y
«dominada supina» encuentran lo suyo y nada de press ni curls.

### 3.5 Lo que salió distinto (P41)

- Ya entran en P41, porque la migración y `exerciseIdentity` los usan: el campo
  `variants` de los tres ejercicios fusionados (`pull_up` solo con prono y
  neutro, porque la chin-up quedó aparte), `unilateralOf` en los cuatro gemelos,
  y las claves `variants.options.*`, `variants.nameUnilateral` y
  `variants.nameApart` en los dos idiomas. El resto de la tabla de §2.2 es P42.
- `migrateExerciseRefs` recibe un objeto con cualquiera de las claves que
  guardan ids (`sessionTemplates`, `userPrograms`, `freeSessions`, `workoutLog`,
  `clientLogs`, `exerciseAliases`, `clientSync`, `activeSession`) y deja los
  apartes nuevos en `customExercises`. En un choque se queda el id el ejercicio
  **sin** variante (si lo hay), no el primero: así el que pasa a aparte siempre
  tiene una variante con la que separarse.
- También se llama en `importForClient` (la otra puerta de programas ajenos) y
  sobre las prescripciones que baja `checkAndPullProgramUpdates`.
- El buscador lleva una pasada intermedia: la búsqueda **sin espacios** dentro
  del texto sin espacios («chinup»), antes de la subsecuencia.
- `seed-load-data.mjs` usaba `pull_up_neutral`: pasa a `pull_up`.
- Choque **sin** variante con la que separarse (lastradas y sin lastre en la misma
  sesión): el segundo conserva su id viejo como copia de `pull_up` con su nombre
  de siempre (`name`/`nameEn` en `LEGACY_IDS`), guardada en `customExercises`. Un
  id viejo que ya existe como ejercicio no se vuelve a migrar.
- QA 29-sep: el botón «Añadir» del buscador enseña cuántos se van a añadir
  («Añadir 3», `exerciseSelector.addActionN`).

### 3.6 Aceptación

`npx vitest run` desde la raíz en verde; `npx expo export --platform android`
sin errores de import; en un historial sembrado con los ids viejos
(`useStore.test.js` con `rehydrateCallback()`), los entrenos quedan en el id
nuevo con su variante.

**Probar P41**

- [x] Con un historial que tenía «Jalón al pecho agarre prono»: tras actualizar,
  Progreso enseña «Jalón al pecho» con todas las sesiones de antes; la sesión
  que lo tenía sigue abriendo y el Workout rellena los pesos de la última vez.
- [x] Buscar «remo polea» encuentra «Remo en polea» y «Remo polea alta»; buscar
  «jalon» (sin tilde) encuentra «Jalón al pecho» una sola vez.
- [x] Buscar «chin up», «chinup» o «dominada supina» encuentra «Dominadas
  supinas», y no sale ningún press ni curl.
- [x] Generar un programa en el onboarding: ningún día repite ejercicio y los
  jalones salen con su agarre.
- [x] Entrenador con la versión nueva y cliente con la vieja: al descargar el
  historial del cliente, sus jalones caen en «Jalón al pecho».
- [x] Una sesión con «Dominadas lastradas»: tras actualizar sale «Dominadas» con
  el historial de antes; al llegar a 8 reps en todas las series, el Workout
  propone 2,5 kg más de lastre.
- [x] Buscador al añadir: con 3 ejercicios marcados, el botón dice «Añadir 3».

---

## 4. P42 — La variante en el editor y en las listas

Maqueta §1A-§1B (grupo de arriba de la hoja) y §5.

### 4.1 Editor de ejercicio — fila VARIANTE

`src/components/editor/ExerciseEditorInline.jsx`. Bloque nuevo **debajo del
Resumen** (QA 29-sep: encima se perdía):

- Etiqueta de sección `variants.section` («VARIANTE»), `secLabel`.
- `NavRow` (`src/components/ui/EditorRows.jsx`) con el icono de ajustes
  (dos deslizadores, trazo `accent`, 15 px, junto a `ProgressionIcon` en
  `ui/EditorIcons.jsx`), título = `variantLabel` o `variants.none` («Sin
  especificar»), subtítulo = las dimensiones que hay en la hoja
  («Agarre · anchura»; P44 añade «Una mano»).
- Sale si el ejercicio declara alguna dimensión (P44 amplía la condición).
- Abre un `DragSheet` (`src/components/DragSheet.jsx`), título
  `variants.title` («Variante»), acción de la derecha la de siempre («Hecho»).

Contenido de la hoja (P42): grupo `variants.howTitle` («CÓMO SE HACE · SOLO
INFORMA»), `textStyles.caps` en `mutedLight`, y debajo un grupo de filas como
`optGroup` (radio `md`, huecos de 2 px) con una fila por dimensión declarada:
su nombre en `bodyStrong` **sin icono** (QA 29-sep: se quitaron) y debajo los
chips de sus opciones.

Chips: anatomía de `linkPill` del propio editor (`surface2`, radio `xs`,
padding 9/6, `textStyles.button`; activo `accent` con texto `onAccent`). Selección
simple por dimensión, **tocar la marcada la desmarca**. Transición de color con
Reanimated (`interpolateColor`, ~160 ms), como los botones de escala del recap.

La variante se guarda en `exConfig.variant` con el **autoguardado del editor**
(el mismo camino que `tempo` o `trainerNote`).

### 4.2 Editor de sesión

`SessionEditorScreen.jsx`, fila de ejercicio (~l.195): el nombre y la variante
en **un solo `Text`** de una línea: nombre en `rowName` (`bodyStrong`) y, anidado,
` · Prono · Ancho` en `textStyles.body` con color `mutedLight`. Al cortarse por
el final se pierde antes la variante que el nombre. La línea de meta no cambia.

### 4.3 Workout

`ExerciseCard.jsx`, `nameBlock` (~l.424): mismo patrón que 4.2, con el nombre en
`itemTitleQuiet` y la variante anidada **en el mismo estilo con color
`mutedLight`** (no hay rol 16/500; la regla de `AGENTS.md` es elegir rol y cambiar
solo color). Sin subrayado. En P42 aún no se toca; P43 la hace pulsable.

### 4.4 Guardado, historial y recap

- `saveSession`: cada ejercicio de plantilla lleva `variant: exConfig.variant`
  si no está vacía (§2.4). Los `adHocExercises` ya copian su `config`.
- `HistoryList.jsx` y `SessionRecapScreen.jsx`: detrás del nombre del ejercicio,
  la variante **del registro** con el estilo de meta que ya use esa fila
  (maqueta §5: `label`, `mutedLight`).
- `SessionList.jsx` (filas desplegables de Inicio, ~l.73) y el visualizador
  (`ProgramDetailScreen.jsx`): la variante del programa detrás del nombre, mismo
  patrón.

### 4.5 Sustituir

`replaceExercise` conserva el `exConfig` entero; tras sustituir, la variante se
limpia con `cleanVariant` contra el ejercicio nuevo (una variante de jalón no
tiene sentido en un press).

### 4.6 Ejercicio propio

`CustomExerciseScreen.jsx`: sección nueva `customExercise.variantSection`
(«VARIANTE») debajo del Resumen, como en el editor, con dos `ToggleRow`: «Agarre» (pista
«Prono · Supino · Neutro») y «Anchura» («Ancho · Medio · Estrecho»). Encendido =
todas las opciones de esa dimensión en `def.variants`. (P44 añade «A una mano»
aquí.) Maqueta §7.

### 4.7 Lo que salió distinto (P42)

- El grupo de chips es un componente propio, `src/components/ui/VariantPicker.jsx`,
  porque la hoja del Workout (P43) es el mismo grupo: ya acepta `programValue`
  para la marca «programa». `variantDims(def)` vive en `utils/variants.js`.
- Tabla de §2.2 aplicada tal cual (15 ejercicios con `variants`).
- `saveSession` escribe `variant` solo si no está vacía; `replaceExercise` la
  limpia con `cleanVariant` contra el ejercicio nuevo; `'variant'` está en
  `LINKED_CONFIG_KEYS`.
- Lint: `ExerciseEditorInline` sube de 31 a 32 avisos, todos de la familia
  `react-hooks/refs` que ya tenía (cada `useState(i.x)` del editor lo da; el de
  `variant` es uno más del mismo patrón).

**Probar P42**

- [ ] Editor de «Jalón al pecho» y «Nuevo ejercicio»: la sección VARIANTE va
  debajo del Resumen; en la hoja, sin iconos, elegir Neutro y Estrecho → la
  fila dice «Neutro · Estrecho»; tocar Neutro otra vez lo desmarca.
- [x] Editor de sesión: «Jalón al pecho · Neutro · Estrecho» con la variante en
  gris en la línea del nombre; con un nombre largo se corta la variante, no el
  nombre.
- [x] Workout: la variante sale detrás del nombre, en gris; un ejercicio sin
  variante no enseña nada.
- [x] Guardar: el recap y el historial dicen la variante; en el móvil del
  cliente conectado la variante del programa llega con el programa.
- [x] Sustituir un jalón con variante por un press de banca con barra: el press
  no hereda el agarre.
- [x] Crear un ejercicio propio con Agarre: su editor enseña la fila VARIANTE
  con las tres opciones.

---

## 5. P43 — La variante de hoy en el Workout, compartir y pegar

Maqueta §4.

### 5.1 La hoja del Workout

- La variante de `ExerciseCard` (4.3) pasa a ser pulsable **solo si el programa
  tiene variante** (o si hoy se cambió). `onPress` en el `Text` anidado, como la
  línea de objetivo editable (`targetEditable`, pero sin su subrayado).
  Colapsada la tarjeta, tocar la cabecera la despliega como ahora; la variante
  solo responde desplegada.
- Abre un `DragSheet` con **solo** el grupo de agarre y anchura, título de grupo
  `variants.todayTitle` («HOY · SOLO ESTA SESIÓN») en `accent`. Debajo de la
  opción del programa, `variants.programMark` («programa», `label`, `mutedLight`)
  dentro del chip. Pie: `variants.todayHint` («El programa no cambia. Queda
  apuntado en el registro de hoy.», `body`, `mutedLight`) y el enlace
  `variants.backToProgram` («↺ Volver a la del programa», `button`, `mutedLight`),
  que solo sale si hoy difiere.
- Estado: `activeSession.variants = { [exerciseId]: variant }` (añadir
  `variants: {}` a `INITIAL_ACTIVE_SESSION`). Acción nueva
  `setSessionVariant(exerciseId, variant | undefined)`; `undefined` borra la
  clave (= la del programa). Un `{}` explícito significa «hoy sin especificar».
- En la tarjeta, la opción que difiere del programa va en `accent` (maqueta §4B).
- `saveSession`: `variant` del ejercicio = `activeSession.variants[id]` si la
  clave existe, si no `exConfig.variant`. Vale también para los ad-hoc.

### 5.2 Compartir como texto (C21) y pegar (C22)

Hoy el nombre acaba en el primer ` · ` (`parseSessionText`, ~l.255: `name:
segs[0]`), así que un nombre con « · » —un aparte, o un ejercicio con su
variante— se partiría. Se arregla el pegado, no el nombre:

- `sessionToText`: la variante va detrás del nombre con el mismo separador que
  en pantalla: `Jalón al pecho · Prono · Ancho · 4x8-10 · 60kg:`.
- `parseSessionText`: el nombre son **todos los segmentos hasta el primero que
  sea receta o peso** (`parseRx` / `parseWeight`), no solo el primero. La línea
  guarda `nameSegs` además de `name` (unidos con `SEP`).
- Nuevo `resolveName(nameSegs, find)` en `sessionText.js` → `{ exerciseId,
  variant }`: prueba de más largo a más corto (`nameSegs.slice(0, k).join(SEP)`)
  con `find`; el primero que resuelve gana. Los segmentos que sobran, si **todos**
  son opciones del catálogo (es o en, `normName`), son la variante; si no, se
  ignoran. Un aparte existente casa entero antes que el jalón con variante.
- `PasteWorkoutScreen.jsx` usa `resolveName` donde hoy llama a `find(l.name)`
  (~l.126 y ~l.147) y guarda la variante en el entreno pegado.
- Tests en `sessionText.test.js`: ida y vuelta de una sesión con un jalón con
  variante, un aparte y un ejercicio sin variante; y un nombre de la librería
  sin « · » sigue resolviendo igual que hoy.

**Probar P43**

- [ ] Workout de una sesión con «Jalón al pecho · Neutro · Estrecho»: tocar la
  variante abre la hoja con «programa» bajo Neutro y Estrecho; elegir Prono →
  la tarjeta dice «Prono» en lima; el editor de sesión sigue diciendo Neutro.
- [ ] «Volver a la del programa» devuelve Neutro y el lima desaparece.
- [ ] Guardar con Prono: el historial y el recap dicen Prono; la siguiente vez
  el Workout vuelve a proponer Neutro.
- [ ] Un ejercicio sin variante en el programa no es pulsable.
- [ ] Compartir la sesión por texto y pegar la respuesta del cliente: el jalón
  se reconoce y el entreno pegado trae su variante.

---

## 6. P44 — Cambiar el ejercicio: unilateral y ejercicio aparte

Maqueta §1B-§1D, §2 y §3.

### 6.1 La hoja del editor gana el grupo de abajo

Debajo del grupo de 4.1, grupo `variants.identityTitle` («CAMBIA EL
EJERCICIO»), filas `ToggleRow` (`EditorRows.jsx`):

| Fila | Sale si | Pista |
|---|---|---|
| **Unilateral** | `canBeUnilateral(def)` o el ejercicio es un unilateral con raíz de dos manos (gemelo o `__uni`) | `variants.unilateralHint`: «Cuenta como otro ejercicio, con su propio historial y progresión.» |
| **A una mano** (fija, sin interruptor, texto `muted`) | el ejercicio es unilateral de por sí (`decompose().natural`) | `variants.alreadyUnilateral`: «Este ejercicio ya es unilateral.» |
| **Ejercicio aparte** | siempre que haya fila VARIANTE | apagado: `variants.apartHintOff` — ««{{name}}» pasa a tener **su propia progresión** y podrás añadir otro «{{base}}» a la sesión. La variante queda fija.» · encendido: `variants.apartHintOn` — «Tiene **su propia progresión**. Ya puedes añadir otro «{{base}}» a esta sesión.» |

- El texto del aparte se escribe **con los nombres de verdad** (`name` = el que
  resultaría según §2.6; `base` = el ejercicio sin aparte). Es la decisión del
  usuario: explicar con nombres, no con abstracciones.
- Sin agarre ni anchura elegidos, «Ejercicio aparte» sale apagado y deshabilitado
  (opacidad del switch) con `variants.apartNeedsVariant` («Elige antes un agarre
  o una anchura.»).
- Con Unilateral encendido, la dimensión anchura desaparece del grupo de arriba y
  en su lugar va `variants.widthNA` («Anchura: no aplica a una mano.», `label`,
  `muted`): una mano no tiene anchura.
- Con Ejercicio aparte encendido, el grupo de arriba pasa a `variants.fixedTitle`
  («CÓMO SE HACE · FIJA») y una sola fila con la variante («Prono · Ancho») y
  `variants.fixedHint` («Es parte del ejercicio. Para cambiarla, apaga
  «Ejercicio aparte».»).
- La fila VARIANTE del editor sale también cuando `canBeUnilateral`, o cuando
  el ejercicio es unilateral o aparte, aunque no declare dimensiones. Su
  subtítulo incluye «Una mano» si la fila Unilateral existe.
- En OPCIONES **desaparece «Unilateral»**.

### 6.2 Qué hace un interruptor

Acción nueva del store `changeExerciseIdentity(templateId, exerciseId, { uni,
variant })` (`variant` = la aparte, o `null` para quitarla):

1. `decompose(exerciseId)` → estado actual; se aplica el cambio pedido. Si se
   enciende Unilateral con aparte puesto, la variante aparte pierde `width`.
2. `compose(...)` → `{ id, def }`.
3. **Bloqueo** (§6.5). Si está bloqueado, no hace nada y devuelve
   `{ blocked: name }`.
4. Si `def`, se añade a `customExercises` (materializar).
5. Sustitución en la plantilla — y en **todas las del grupo vinculado** si el
   exConfig tiene `linkGroup` (`linkGroupTemplateIds` de `exerciseLinks.js`) — con
   la lógica de `replaceExercise`. Al encender aparte, `exConfig.variant` se queda
   con la fija; al apagarlo, se restaura la fija como variante normal.
6. Devuelve `{ id }`.

`ExerciseEditorScreen.jsx`: el editor recibe un `onIdentityChange(newId)` que
llama a `selectExercise(newId)` (ya remonta el editor y sube arriba). Antes de
la acción, el editor **vuelca el autoguardado pendiente** (el mismo volcado que
hace al desmontarse), o la última edición se escribiría en el id viejo. Toast al
encender aparte: `variants.toastApart` (««{{name}}» es ahora un ejercicio
aparte»).

### 6.3 Nombres y listas

El derivado se pinta con su `name`, como cualquier ejercicio: los apartes llevan
el nombre entero en negrita y **no** tienen variante gris ni son pulsables en el
Workout (su hoja no tendría nada que cambiar hoy). En el buscador salen como un
ejercicio más, sin la etiqueta CUSTOM (`isCustom: false`).

### 6.4 `exConfig.isUnilateral` desaparece

- `prescription.js` (l.36), `sessionText.js` (l.50) y `ProgramDetailScreen.jsx`
  leen **solo** `def.isUnilateral` («c/p»).
- `'isUnilateral'` sale de `LINKED_CONFIG_KEYS`.
- Migración en `onRehydrateStorage`: un exConfig con `isUnilateral: true` sobre un
  ejercicio de dos manos pasa por `compose({ root, uni: true })` (materializando
  si hace falta) y se borra la clave. Con `false` o sobre uno ya unilateral, se
  borra sin más.
- `CustomExerciseScreen.jsx`: el «Unilateral» de OPCIONES se muda a la sección
  VARIANTE de 4.6 como «A una mano» (pista «Siempre unilateral: sin anchura.»),
  y al encenderlo se apaga y deshabilita «Anchura».

### 6.5 La regla de bloqueo (una para los cuatro gestos)

Poner o quitar Unilateral y poner o quitar Ejercicio aparte **no se mueven** si
el ejercicio que resultaría **ya está en la sesión**, o en cualquier sesión de
su grupo vinculado. La fila enseña `variants.blocked` en `orange` («No se puede:
ya hay un «{{name}}» en esta sesión. Quítalo o sustitúyelo antes.»; con grupo,
`variants.blockedLinked`: «… en una sesión vinculada.»). Es la misma invariante
que ya aplica `replaceExercise`, pero ahora dicha en vez de silenciosa.

### 6.6 Historial

El derivado empieza de cero. Los entrenos anteriores se quedan en el ejercicio
original con su variante apuntada (el filtro de P45 los sigue enseñando). No se
copian ni se mueven entradas de historial. Opcional, si sobra tiempo: si un
aparte no tiene historial, la sugerencia de peso del Workout sale de los
entrenos del original con esa variante.

**Probar P44**

- [ ] Remo en polea → hoja → Unilateral: el editor pasa a «Remo unilateral en
  polea» (el de la librería), la anchura desaparece y el Resumen dice «c/p».
  Apagarlo vuelve a «Remo en polea».
- [ ] Jalón al pecho → Unilateral: se crea «Jalón al pecho unilateral»; en el
  buscador de otra sesión sale como ejercicio normal, sin CUSTOM.
- [ ] Remo con mancuerna: no hay interruptor, sale «Este ejercicio ya es
  unilateral».
- [ ] Jalón al pecho con Prono · Ancho → Ejercicio aparte: el texto dice
  «Jalón al pecho · Prono · Ancho» y «otro Jalón al pecho»; al encenderlo el
  título cambia, la variante queda fija y sale el toast.
- [ ] Con el aparte en la sesión, el buscador vuelve a ofrecer «Jalón al pecho»;
  añadirlo deja dos jalones en la sesión, cada uno con su historial.
- [ ] Con los dos jalones: apagar «Ejercicio aparte» no se mueve y dice «ya hay
  un «Jalón al pecho» en esta sesión».
- [ ] Un jalón vinculado entre la A y la C → Unilateral: cambia en las dos
  sesiones.
- [ ] En el móvil del cliente conectado, el programa con «Jalón al pecho
  unilateral» abre y se entrena (la definición llega con el programa).
- [ ] Crear un ejercicio propio «A una mano»: su Anchura queda apagada.

---

## 7. P45 — Progreso filtrado por variante

Maqueta §6.

- `ExerciseDetailModal` (`src/components/stats/ProgressTab.jsx`): encima de los
  cuadros de 1RM / tendencia, una fila de pills con la anatomía de las pills de
  patrón del buscador (`ExerciseSelectorScreen`: radio `full`, alto 36, `button`,
  `surface2`; activa `accent`), selección simple: `variants.filterAll` («Todas»)
  + una por cada **variante distinta presente** en los registros de ese
  ejercicio (etiqueta `variantLabel`; los registros sin variante solo cuentan en
  «Todas»). **Si hay menos de dos variantes distintas, la fila no sale.**
- La variante elegida filtra `allLogs`, `periodLogs` y `rawLogs` al entrar al
  modal (`getExerciseLogsFrom` ya devuelve `exercise.variant`), así 1RM, PR,
  tendencia, gráfica y lista de sesiones salen solo de esos entrenos.
- La lista de ejercicios de Progreso no cambia: cada id es una línea, y los
  derivados (unilateral, aparte) ya salen como líneas propias.
- La progresión automática **no** mira el filtro.

**Probar P45**

- [ ] Un jalón hecho con prono y con neutro: el detalle enseña «Todas · Prono ·
  Neutro»; con Neutro, el 1RM y la gráfica cambian y la lista de sesiones solo
  tiene las de neutro.
- [ ] Un ejercicio hecho siempre igual no enseña la fila de filtros.

---

## 8. Reglas para quien implemente

- **Textos**: todo en `src/locales/es.json` y `en.json`, claves nuevas bajo
  `variants.*` (más `customExercise.variantSection`, `oneHand`, `oneHandHint`).
  **Añadir claves línea a línea; nunca reescribir el JSON con un volcado** (rompe el
  formato del fichero). Inglés: Pronated / Supinated / Neutral · Wide / Medium /
  Narrow · Grip / Width / One arm.
- **Tipografía**: solo roles de `textStyles` (`src/theme.js`); cambiar color o
  interlineado, nunca tamaño ni peso. `src/theme.test.js` lo vigila.
- **Interacciones**: todo lo pulsable con transición (Reanimated), nada en seco.
- **Verificación por fase**: `npx vitest run` desde la raíz; `npx eslint` de los
  ficheros tocados comparando el recuento con `HEAD` (hay errores previos);
  `npx expo export --platform android` para pillar imports rotos.
- **Pruebas en dispositivo**: el usuario prueba en Expo Go sobre la carpeta
  `fuerza-control/mobile`; lo del cliente conectado, con dos móviles.

## 9. Fuera de alcance

- Sustituir un ejercicio durante el Workout («sustituir solo hoy»).
- Familias de ejercicios y chips en el buscador (descartado, §1.3).
- Inclinación, maneral y posición de pies como dimensiones.
- Cambiar la variante en el Workout cuando el programa no tiene ninguna.
- Renombrar el resto de la librería («Peso muerto rumano (barra)» → «con
  barra»…): solo se renombran los fusionados.
- Mover historial al separar un aparte (§6.6).

## 10. Fases

| Fase | Qué | Coste | Depende de | Registro |
|---|---|---|---|---|
| P41 | Fusión, `exerciseIdentity.js`, migración de ids, buscador por palabras | 🟡 | — | ✅ ver commit de la rama — 1451 tests |
| P42 | Catálogo, `exConfig.variant`, hoja (grupo informativo), listas, guardado, ejercicio propio | 🟡 | P41 | |
| P43 | Variante de hoy en el Workout, compartir y pegar | 🟢 | P42 | |
| P44 | Unilateral y ejercicio aparte, bloqueo, vinculación, fuera `exConfig.isUnilateral` | 🟡 | P41, P42 | |
| P45 | Filtro por variante en el detalle de Progreso | 🟢 | P42 | |
