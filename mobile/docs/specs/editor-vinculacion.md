# Spec — Editor de programa: deslizar sesiones y vincular ejercicios

> Tema: programas
> En corto: Las tarjetas de sesión del editor de programa se deslizan para duplicar o eliminar, como las filas de ejercicio. Vincular un ejercicio entre sesiones deja de ser elegir «Grupo 1» y pasa a ser ver las programaciones que tiene ese ejercicio en la etapa y meter esta sesión en una de ellas; al añadir ejercicios que ya están en otras sesiones, una hoja ofrece vincularlos.
> Fase P49 · hecho · Deslizar las tarjetas de sesión del editor de programa · §3
> Fase P50 · pendiente · Vinculación en el editor de ejercicio: grupo «Programación» y hoja de programaciones · §4
> Fase P51 · pendiente · Vincular al añadir ejercicios · §5
>
> Estado: spec cerrada el 1-oct-2026; P49 implementada y probada el 3-oct-2026, P50 y P51 SIN implementar. Maqueta aprobada:
> [`docs/mockups/link-exercises.html`](../mockups/link-exercises.html) (v4; las
> referencias «maqueta §N» de abajo son a ella). Sale de una sesión de diseño con
> el usuario que pasó por cuatro versiones: casillas por sesión (v1, descartada:
> cada sesión veía una lista distinta y un grupo grande eran tres letras y tres
> nombres), mapa de programaciones con confirmación (v2), ficha propia con
> deshacer (v3) y la v4. El orden recomendado es P49 → P50 → P51; P51 reutiliza
> la hoja de P50.

## 1. Contexto y decisiones cerradas

### 1.1 Lo que había

- **Sesiones en el editor de programa** (`ProgramEditorScreen.jsx`, `SessionCard`):
  asa de arrastre + toque para abrir. Duplicar y eliminar solo existían en el
  menú ··· de *dentro* de la sesión (`SessionEditorScreen.jsx`). Las filas de
  ejercicio del editor de sesión, en cambio, se deslizan a la derecha y
  descubren Sustituir / Eliminar (`EditorRow`, mismo archivo).
- **Vinculación** (`ExerciseEditorInline.jsx`, sección «Vinculación entre
  sesiones»): pastillas «Ninguna / Grupo 1 · A, C / + Nuevo grupo». Tres
  problemas:
  1. Vincular A y C costaba dos pantallas: en A «Nuevo grupo» (un grupo de uno)
     y luego en C «Grupo 1».
  2. «Grupo N» no dice nada: lo que distingue un grupo de otro es su
     programación.
  3. **Miraba todo el programa, no la etapa**: `exerciseInstanceCount` y
     `exerciseLinkGroups` recorren `programTemplateIds`, que junta todas las
     etapas. La sección salía aunque el ejercicio solo estuviera en una sesión
     de la etapa, mezclaba letras de etapas distintas («A, A») y dejaba vincular
     con una sesión de otra etapa (editar la etapa 2 cambiaba la 1). Al crear o
     duplicar una etapa los grupos sí se renombran (`remapGroup`), así que el
     fallo es solo de lo que la pantalla ofrecía.

### 1.2 El modelo de la vinculación (no cambia)

`exConfig.linkGroup`: las instancias del mismo `exerciseId` con el mismo
`linkGroup` comparten `LINKED_CONFIG_KEYS` (editar una edita todas, en
`updateExerciseParams`) y su historial (`lastExerciseRef`). Ver
`src/utils/exerciseLinks.js`. **Esta spec no toca el dato**, solo cómo se ve y se
manipula.

### 1.3 Decisiones del usuario (no reabrir)

- **Una fila por programación, no por sesión.** La hoja de vinculación enseña las
  distintas programaciones que tiene el ejercicio en la etapa; debajo de cada
  una, fichas con las letras de las sesiones que la usan. Fichas unidas =
  vinculadas. **El mapa es el mismo desde cualquier sesión**: solo cambia cuál es
  la ficha lima (la tuya). Así la primera vinculación se ve igual que la quinta y
  escala a cualquier número de sesiones.
- **Fichas con el lenguaje de la superserie**: piezas a 2 px con los radios de
  dentro a 2 px. Nada de colores por grupo (se acaban) ni de nombres de sesión
  en la fila (no caben).
- **Vincular = mover tu ficha a otra fila**: «Usar» adopta la programación de esa
  fila, así que no hay conflicto que preguntar. «Separar» te saca a una fila
  propia. **Sin confirmación**: actúa al momento y deja una línea con Deshacer.
- **Solo se mueve la sesión que editas.** Desde C no se vincula B con D.
- **Ámbito = la etapa.**
- La vinculación es **una ficha más** del editor, como Variante, Calentamiento y
  Progresión, y las cuatro van **en un solo grupo titulado «Programación»**, con
  la anatomía de ficha de hoy (título blanco, meta gris, negrita en lo
  importante). La ficha de vinculación **no se tiñe** de lima.
- **Aviso de «estás editando varias»**: las fichas de sesión van en el Resumen
  con el texto «Vinculado», como en la v2, y debajo del Resumen una línea de
  texto que diga que editar este ejercicio lo edita en las otras sesiones (§4.2).
  El usuario descartó la franja «Editas A, B y C a la vez» porque parece que
  editas *las sesiones*. El texto exacto se afina al implementar.
- **Al añadir**: nada se vincula solo. Una hoja lista los ejercicios que se
  repiten, cada uno con su botón «Vincular»; al vincular uno, su botón pasa a
  «✓ Vinculado».

## 2. Piezas compartidas

### 2.1 `ui/SwipeRow.jsx` (nuevo, P49)

Se extrae de `EditorRow` (`SessionEditorScreen.jsx`) lo que no es contenido: el
`PanResponder` (deslizar a la derecha, umbral `SWIPE_OPEN / 2`), el panel de
acciones detrás, el muelle de vuelta, el «se cierra cuando se abre otra»
(`isOpen` / `onOpenChange`) y el número que se cambia por la flecha ‹ estando
abierta. Recibe:

```js
<SwipeRow
  actions={[{ label, onPress, kind: 'neutral' | 'danger' }]}  // 1 o 2
  isOpen onOpenChange
  leading={<Text>01</Text>}           // número o letra; abierta → flecha ‹
  onPress                              // abierta → cierra; cerrada → onPress
  handle={<Sortable.Handle>…</Sortable.Handle>}
  style radii
>{contenido}</SwipeRow>
```

Los dos botones son los de hoy (`ACTION_BTN_WIDTH` 104, `surface2` / tinte rojo).
`EditorRow` pasa a usarla sin cambiar nada visible. El reordenado sigue viviendo
solo en el asa (`Sortable.Handle`): por eso no choca con el gesto horizontal.

### 2.2 `ui/SessionChips.jsx` (nuevo, P50)

Las fichas. `<SessionChips labels={['A','B','C']} me="C" fresh="C" size="md|sm" tint />`:

- `md` 26×26 (hoja de vinculación), `sm` 20×20 (Resumen, filas del editor de
  sesión, hoja de añadir). Texto con un rol de `textStyles` (no `fontSize`
  propio, AGENTS.md).
- Unidas a 2 px; radios exteriores `radius.sm` (md) / `radius.xs` (sm), interiores
  `radius.xxs`.
- `me`: fondo `accent`, texto `onAccent`. `fresh` (la que acaba de moverse):
  anillo `accent` separado 2 px. `tint` (dentro del Resumen): fondo accent al 18 %
  y texto accent.

### 2.3 `src/utils/exerciseLinks.js` — lo nuevo (P50, con tests)

```js
/** Template ids de la etapa que contiene `templateId` (en su orden). */
export function stageTemplateIds(program, templateId)

/**
 * Programaciones del ejercicio en la etapa de `templateId`:
 * [{ key, linkGroup|null, templateIds, labels, config, me }]
 * Una fila por linkGroup con ≥2 miembros en la etapa; cada instancia sin grupo
 * (o sola en el suyo) es una fila propia. Ordenadas por la posición en la
 * etapa de su primera sesión. `me` = contiene `templateId`.
 */
export function linkRows(program, templateId, exerciseId, getTemplate)
```

- Un `linkGroup` con un solo miembro en la etapa cuenta como **suelta**. Pasa al
  borrar una sesión (`removeSessionFromProgram` no limpia el grupo del otro
  miembro) o al separar: no hace falta normalizar el dato, se normaliza al leer.
- **Dos filas con la misma programación sin vincular son dos filas.** Coincidir no
  es estar vinculadas, y el mapa lo enseña así.
- `exerciseLinkGroups` y `exerciseInstanceCount` pasan a mirar la etapa
  (`stageTemplateIds`) en todos sus llamantes. `linkGroupTemplateIds` (propagación
  y referencia de pesos) puede seguir mirando el programa: con la UI limitada a
  la etapa, un grupo ya no puede cruzar etapas. Los cruzados que ya existan no se
  migran (retrocompatibilidad no necesaria, decisión del usuario).
- Texto de la programación de una fila: el de `rowMeta` del editor de sesión
  (`4 × 5 · 150s`) con « · Clave» si `isKey`. Se saca `rowMeta` a una utilidad
  compartida en vez de duplicarla.

Tests en `exerciseLinks.test.js`: etapa con 4 sesiones sin vincular → 4 filas;
A+B vinculadas → 3 filas y el mismo orden visto desde B y desde C; grupo de un
miembro → suelta; otra etapa con el mismo ejercicio no aparece.

### 2.4 Acciones del store (P50, con tests en `useStore.test.js`)

```js
// Lleva la instancia de `templateId` a la fila `row` (adopta su programación).
// Fila con grupo → setExerciseLinkGroup(tid, ex, row.linkGroup).
// Fila suelta (sesión X) → gid nuevo; X recibe linkGroup = gid sin cambiar su
// config; luego setExerciseLinkGroup(tid, ex, gid) adopta la de X.
linkExerciseToRow(templateId, exerciseId, row)

// Saca la instancia de su grupo (linkGroup = null), conservando la config.
unlinkExercise(templateId, exerciseId)
```

**Deshacer**: antes de actuar, la hoja guarda una foto de los `exConfig` del
ejercicio en las plantillas de la etapa. Deshacer los restaura con una sola
acción del store (`restoreExerciseConfigs(snapshot)`). La foto vive en el estado
de la hoja y se pierde al cerrarla.

## 3. P49 — Deslizar las tarjetas de sesión del editor de programa

Maqueta: ninguna (mismo gesto que las filas de ejercicio).

- `SessionCard` (`ProgramEditorScreen.jsx`) pasa a `SwipeRow` con **Duplicar |
  Eliminar**: `duplicateSessionInProgram(programId, tid)` y
  `removeSessionFromProgram(programId, tid)`.
- **Anatomía igual a la fila de ejercicio**: letra a la izquierda (donde va el
  número), asa a la derecha. Hoy el asa de la tarjeta de sesión va a la izquierda.
- **Eliminar** no sale si es la única sesión de la etapa (regla `canDelete` del
  editor de sesión) y pide la misma confirmación que hoy
  (`editor.sessionDeleteConfirm`).
- **Duplicar**: la copia aparece justo debajo y sale con el fundido de entrada de
  la lista. No se abre. Toast `editor.toastSessionDuplicated`. La copia nace sin
  vincular, como hoy (`linkGroup: null`).
- Las dos acciones **se quedan también** en el menú ··· del editor de sesión: el
  gesto no se descubre solo.
- Un solo estado `openRowId` en la pantalla, como en el editor de sesión: abrir
  una tarjeta cierra la otra; empezar a arrastrar cierra la abierta.

**Store (revisión 3-oct-2026: la spec prometía dos cosas que el store no hacía).**
Se arregla en las acciones, no en la pantalla, para que valga también desde el ···
del editor de sesión:

- `duplicateSessionInProgram` **añadía la copia al final**: pasa a insertarla
  justo detrás del original y reetiquetar la etapa por posición.
- `removeSessionFromProgram` **no reetiquetaba** (borrar B de A, B, C dejaba A, C):
  pasa a reetiquetar la etapa de la que sale.
- Reetiquetar = lo que ya hace `reorderSessionsInStage` (letra del día y `label`
  de la plantilla según la posición). Se reutiliza, no se duplica; y su lista de
  letras pasa a ser `DAY_LABELS` (tenía 6, `DAY_LABELS` tiene 7).
- Tests en `useStore.test.js`: duplicar B de A, B, C → A, B, copia(C), D; eliminar
  B → A, B (la antigua C pasa a B, plantilla incluida).
- `switchSession` del editor de sesión calcula el sentido del deslizamiento con
  la lista de antes de duplicar (la copia no está → `-1`, entra por la
  izquierda); la copia entra por la derecha.

Fuera de alcance: `BlockEditorInline` tiene una tercera copia del mismo gesto
(un botón, otra anchura); se queda como está.

**Probar P49**

- [x] Deslizar a la derecha una tarjeta de sesión → salen Duplicar y Eliminar; la
  letra se cambia por ‹; tocar la tarjeta la cierra sin abrir la sesión.
- [x] Abrir una tarjeta y deslizar otra → la primera se cierra.
- [x] Duplicar → la copia sale debajo, con letra nueva, y la lista no se abre.
- [x] Eliminar → confirmación; al aceptar desaparece y las letras se reajustan.
- [x] Etapa con una sola sesión → solo sale Duplicar.
- [x] Arrastrar por el asa sigue reordenando, y deslizar en horizontal no mueve la
  página.
- [x] Las filas del editor de sesión se comportan igual que antes (Sustituir /
  Eliminar).
- [x] Desde el ··· del editor de sesión: Duplicar pone la copia detrás de la
  original (entra deslizando por la derecha) y Eliminar reajusta las letras.

## 4. P50 — Vinculación en el editor de ejercicio

Maqueta §1 (editor) y §2 (hoja).

### 4.1 Grupo «Programación»

Debajo de VOLUMEN, las cuatro fichas que hoy son «título · ficha» por separado
van en **un solo grupo** con el título **PROGRAMACIÓN** (i18n
`exerciseEditor.sectionProgramming`), en este orden:

| Fila | Título (blanco) | Meta (gris; **negrita** = lo importante) |
|---|---|---|
| Progresión | Progresión | **Auto** · Doble progresión · +2.5 kg |
| Calentamiento | Calentamiento | **Auto** · 3 series · 60s |
| Variante (si `showVariantRow`) | Variante | **Barra alta** |
| Vinculación (§4.3) | Vinculación | Vinculado con **A y B** |

- Anatomía: la de las filas del grupo de OPCIONES (fondo `surface`, separación
  `spacing.xs`, radios exteriores `radius.md` del contenedor) con el contenido
  del `NavRow` de hoy: icono accent, título `bodyStrong`, meta `label` en
  `mutedLight`, flecha accent. El meta admite un trozo en negrita (mismo rol, otro
  peso: ver `MenuList.GroupedRow` para el precedente de dos pesos).
- Se borran los títulos VARIANTE, CALENTAMIENTO y PROGRESIÓN y la sección vieja
  de vinculación (pastillas, `linkPill*`, `handleLinkSelect`).
- El contenido del meta de cada ficha es el que ya calcula el editor
  (`progRowSub`, `warmupRowSub`, `dimsSub` / `rowTitle`); lo que hoy es el título
  de la ficha (p. ej. «Auto») pasa a ser la parte en negrita del meta.

### 4.2 El aviso de «se edita en varias sesiones»

Solo si la instancia está vinculada (su fila de `linkRows` tiene ≥2 sesiones):

- **En el Resumen**: una línea más con `SessionChips size="sm" tint` y el texto
  «Vinculado». Es lo que había en la v2 de la maqueta (§1D).
- **Debajo del Resumen**: una línea de texto que deje claro que lo que se edita en
  varias sesiones es *este ejercicio*, no las sesiones. Propuesta del usuario:
  «Ejercicio vinculado. Se edita en las sesiones A, B y C a la vez». **El texto
  exacto y su estilo se deciden al implementar**: el usuario lo dejó abierto
  («se descubre cuando haya que implementarlo»). Se descartó la franja fija bajo
  la cabecera de la maqueta v3/v4, porque su texto parecía hablar de editar las
  sesiones.

### 4.3 La ficha Vinculación

Tres estados, mismo icono y título:

| Estado | Meta | Toque |
|---|---|---|
| Vinculada | Vinculado con **A y B** (con muchas: «con **5 sesiones**» si no cabe) | abre la hoja |
| Suelta, pero está en otras sesiones de la etapa | Sin vincular · también en **A, B y D** | abre la hoja |
| No está en otras sesiones de la etapa | Sin vincular · no está en otras sesiones | apagada (`muted`), sin flecha, no hace nada |

La ficha está siempre, también apagada: así no aparece y desaparece de un
ejercicio a otro.

Solo en ejercicios de una sesión de programa. En una sesión libre o una plantilla
de sesión (`!template.programId`) no hay ficha, como hoy (`showLinking`).

### 4.4 La hoja «Vincular con otras sesiones»

`DragSheet`, título **«Vincular con otras sesiones»**, a la derecha «Hecho».

1. **Texto** (afinable): «Vincula «Sentadilla trasera» con otras sesiones para
   que funcionen como un solo ejercicio: comparten historial y progresión, y lo
   que edites en una cambia en todas.» El nombre del ejercicio va en negrita.
2. Etiqueta **PROGRAMACIONES EN ESTA ETAPA** (caps, `muted`).
3. Una fila por cada elemento de `linkRows`, en su orden:
   - título: la programación (`4 × 5 · 150s · Clave`), `bodyStrong`;
   - debajo, `SessionChips size="md"` con `me` en la tuya;
   - **tu fila**: fondo `tint.accent10`; si tiene ≥2 sesiones, botón
     **«Separar»** (texto `mutedLight`, sin fondo);
   - **las demás**: botón **«Usar»** (texto accent sobre `surface2`).
4. «Usar» → `linkExerciseToRow`; la ficha salta a esa fila con el anillo de
   `fresh` y la fila vieja desaparece (layout animation de Reanimated). Abajo
   aparece la línea **«C pasa a estar vinculada con A y B · Deshacer»** (sin
   cifras de programación, decisión del usuario).
5. «Separar» → `unlinkExercise`; la línea dice **«C deja de estar vinculada con A
   y B · Deshacer»**.
6. Deshacer → `restoreExerciseConfigs` y la línea se va. La línea también se va
   al cerrar la hoja; solo hay una a la vez (la última acción).
7. Al volver al editor, los valores de VOLUMEN y de las fichas tienen que mostrar
   la programación adoptada: el mismo re-sync que ya hace `handleLinkSelect`
   (vaciar el autosave pendiente **antes** de actuar y luego
   `applyValues(computeInitial(fresh, def))`). Sin esto, el autosave diferido
   machaca la programación adoptada.

### 4.5 El editor de sesión

`metaFor` deja de añadir «Vinculado A, C» en texto y pinta
`SessionChips size="sm"` (con `me` en la sesión abierta) detrás de la
prescripción, en la misma línea (maqueta §3F).

### 4.6 i18n (es / en)

`exerciseEditor.sectionProgramming`, `link.rowTitle`, `link.metaLinked`
(`Vinculado con <b>{{sessions}}</b>`), `link.metaLinkedMany`, `link.metaLoose`,
`link.metaAlone`, `link.summaryTag`, `link.summaryLine` (texto de §4.2),
`link.sheetTitle`, `link.sheetIntro`, `link.stageLabel`, `link.use`,
`link.separate`, `link.didLink`, `link.didUnlink`, `link.undo`. Se borran
`exerciseEditor.link{Label,Hint,None,New,GroupN}` y `editor.metaLinked`. La
negrita del meta: el proyecto no usa `<Trans>`; la fila recibe el meta en dos
trozos (normal + negrita) y los anida en un `Text`, que es lo más corto.

Listas de letras («A y B», «A, B y D» / «A and B», «A, B and D»): una función
`joinLabels(labels, t)` con una clave `common.listAnd`. No `Intl.ListFormat`: no
está garantizado en Hermes.

### 4.7 Relación con el bug aparcado

Memoria del proyecto, «vincular no aparece»: la sección no salía en la sesión C
de un cliente. Con P50 el criterio de visibilidad cambia (etapa en vez de
programa) y la ficha está siempre, apagada si no hay con quién. Si reaparece, el
síntoma será la ficha apagada sin motivo, y la sospecha anotada (un `exerciseId`
distinto entre A y C) se ve a simple vista en el mapa.

### 4.8 Fallos encontrados al revisar la spec (3-oct-2026)

Van dentro de P50: si no, la fase se apoya en ellos.

1. **Un vinculado se queda sin historial al cambiar de etapa.** Crear o duplicar
   una etapa da id nuevo a los grupos (`remapGroup`), y `recentExerciseRefs`
   (`src/utils/exerciseLinks.js`), si hay `linkGroup`, mira solo las plantillas
   de ese grupo, que en la etapa nueva aún no tienen entrenos. Los sueltos siguen
   la cadena `derivedFrom` y sí tienen referencia; los vinculados empiezan cada
   etapa sin pesos ni progresión. Ya pasa hoy; P50 y P51 multiplican los
   vinculados. Arreglo: con grupo, los ids son la cadena `templateChainIds` de
   cada plantilla del grupo (sin repetidos). Test en `exerciseLinks.test.js`:
   etapa 2 recién creada de una etapa 1 con A·B vinculadas y entrenadas → la
   referencia de A en la etapa 2 es la última de A o B en la etapa 1.
2. **El calentamiento y el dropset no viajan con el grupo.** `LINKED_CONFIG_KEYS`
   es anterior a `warmup` y `dropset` y no los incluye: rompe la regla «la
   configuración de un grupo vinculado es idéntica, sin excepciones», y el texto
   de la hoja (§4.4, «lo que edites en una cambia en todas») mentiría. Se añaden
   los dos. `supersetWithNext` se queda fuera: depende del ejercicio que va detrás
   en cada sesión. Efecto lateral: `autoLinkRepeated` del generador agrupa por
   `pickLinkedConfig`, así que deja de juntar instancias con distinto
   calentamiento (correcto).
3. **La tabla de §4.1 se quedó vieja con P55.** Ya no hay modos «Auto» / «Fija»:
   en Progresión la negrita es `progTitle` («Doble progresión», «Por esfuerzo
   @8»…) y el resto del meta, `ruleTxt`; en Calentamiento la negrita es
   `exerciseEditor.warmup.<modo>` y el resto, `warmupRowSub`. `ruleTxt` es una
   frase larga: el meta se corta a una línea (`numberOfLines`).

**Probar P50**

- [ ] Editor de ejercicio: debajo de VOLUMEN un solo título PROGRAMACIÓN con
  Progresión, Calentamiento, Variante y Vinculación; los títulos sueltos ya no
  están.
- [ ] Ejercicio que solo está en esta sesión de la etapa → ficha Vinculación
  apagada, «no está en otras sesiones», no abre nada.
- [ ] Mismo ejercicio en otra etapa pero no en esta → sigue apagada.
- [ ] Ejercicio en A, B, C y D sin vincular, desde B → la hoja enseña 4 filas,
  la de B teñida.
- [ ] «Usar» en la fila de A → B salta a la fila de A, sale «B pasa a estar
  vinculada con A · Deshacer»; al cerrar, series, reps y descanso del editor son
  los de A.
- [ ] Abrir la sentadilla de C → el mapa es el mismo que en B (fila A·B arriba),
  con C en lima.
- [ ] Deshacer devuelve B a su fila y a su programación anterior.
- [ ] «Separar» → B vuelve a una fila propia con la programación de A; editar B ya
  no cambia A.
- [ ] Vinculada: el Resumen enseña las fichas con «Vinculado» y debajo la línea de
  aviso; suelta, no hay ninguna de las dos.
- [ ] Editar series en una vinculada → cambia en las demás (no regresión).
- [ ] Editor de sesión: los vinculados llevan las fichas pequeñas en su línea.
- [ ] Borrar la sesión A de un grupo A·B → en B la ficha dice «Sin vincular».
- [ ] Etapa nueva desde una con la sentadilla A·B vinculada y entrenada → en la
  primera sesión de la etapa nueva salen los pesos de referencia de la anterior.
- [ ] Cambiar el calentamiento de un vinculado → cambia en las otras sesiones.

## 5. P51 — Vincular al añadir ejercicios

Maqueta §3.

### 5.1 La pista en el buscador

`ExerciseSelectorScreen`, solo si `templateId` es de una sesión de programa (no
`sessionMode`, no sesión libre): cada resultado que ya esté en **otra** sesión de
la etapa lleva « · en A, B, D» en `tint.accent50` al final de su meta. Sirve para
ver que es el mismo, si te pasas de volumen o si es justo lo que quieres. No
bloquea nada.

### 5.2 La entrega al editor de sesión

El selector añade los ejercicios y vuelve (`goBack`), como hoy. Antes de volver
deja `ui._addedExercises = { templateId, ids }` con lo añadido, el mismo patrón
que `ui._blockPickerResult`. `SessionEditorScreen` lo consume en un efecto
(y lo borra): se queda con los `ids` que están en otra sesión de la etapa
(`linkRows(...).length > 1`) y, si queda alguno, abre la hoja de §5.3.

### 5.3 La hoja «Vincular ejercicios»

**Una sola `DragSheet` con dos páginas**, no dos hojas encadenadas: en Android,
abrir un `Modal` mientras se cierra otro ya dio guerra (ver el `setTimeout` de
`onShowArchived` en ClientsScreen). El paso entre páginas desliza el contenido
como el pager del editor de sesión (`entering` / `exiting` de Reanimated con
`SegmentedControl.TIMING`), y la altura se anima con `ui/AnimatedHeight`.

**Página 1 — lista** (maqueta §3B/D/E). Título **«Vincular ejercicios»** y
«Hecho» a la derecha (cierra la hoja).

- Texto: «Estos ejercicios se repiten en otras sesiones. Puedes vincularlos para
  que funcionen como uno solo.»
- Una fila por ejercicio, en el orden de la sesión:
  - suelto: título el nombre, meta «También en **A, B y D**», botón
    **«Vincular»** (accent sobre `surface2`);
  - vinculado: meta «Vinculado con **A y B**» y, en lugar del botón,
    **«✓ Vinculado»** en accent, sin fondo: es un estado, no una acción.
- Toda la fila se puede tocar, también la vinculada (para separar o cambiar de
  fila).
- **Por defecto nada vinculado.**

**Página 2 — la hoja de §4.4 tal cual**, para el ejercicio tocado, con «‹» a la
izquierda del título. «‹» y «Hecho» vuelven a la página 1. La fila de ese
ejercicio se ilumina un momento (borde `accent50`, ~600 ms) y su estado ya es el
nuevo. Si sales sin vincular, o tras Deshacer, sigue en «Vincular».

Cerrar la hoja con alguno sin vincular lo deja suelto. Se puede vincular luego
desde su ficha.

### 5.4 i18n (es / en)

`link.addTitle`, `link.addIntro`, `link.addAlsoIn`, `link.addLink`,
`link.addLinked`, `exerciseSelector.alsoIn`.

**Probar P51**

- [ ] Buscador desde la sesión C: un ejercicio que está en A y B enseña «· en A,
  B»; uno que no está, nada; en una sesión libre, nada.
- [ ] Añadir 3, dos de ellos ya en otras sesiones → al volver sale «Vincular
  ejercicios» con esos dos, cada uno con «Vincular».
- [ ] Añadir solo ejercicios que no están en otra sesión → no sale ninguna hoja.
- [ ] Tocar «Vincular» → la hoja pasa a la página 2 sin cerrarse ni parpadear;
  «Usar» en una fila; «Hecho» vuelve a la lista con «✓ Vinculado» y «Vinculado
  con …».
- [ ] Entrar en la página 2 y volver sin tocar nada → sigue en «Vincular».
- [ ] «Hecho» en la página 1 cierra; los vinculados llegan al editor de sesión con
  la programación de su fila y sus fichas pequeñas.
- [ ] Android: abrir y cerrar la hoja varias veces seguidas no la deja colgada.

## Fases

| Fase | Qué | Depende de | Coste | Estado |
|---|---|---|---|---|
| P49 | `SwipeRow` + tarjetas de sesión con Duplicar/Eliminar | — | 🟢 | hecho |
| P50 | `linkRows` por etapa, `SessionChips`, grupo «Programación», ficha y hoja de vinculación, aviso en el Resumen | P49 (no estricto) | 🟡 | pendiente |
| P51 | Pista en el buscador + hoja «Vincular ejercicios» de dos páginas | P50 | 🟡 | pendiente |
