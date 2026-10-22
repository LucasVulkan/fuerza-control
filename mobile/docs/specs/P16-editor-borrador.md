# Spec — Editor con borrador, cabecera de niveles y tarjeta de identidad

> Tema: programas
> En corto: El editor de programa pasa a trabajar sobre un borrador que se puede cancelar; la cabecera dice si estás en la base (Cancelar) o dentro (‹ y a dónde vuelves); el nombre y las cifras de lo que editas van en una tarjeta gris con lápiz; borrar una sesión, un ejercicio o una etapa ofrece Deshacer.
> Inicio: 2026-10-22
> Fase P16-01 · hecho · Borrador: Cancelar descarta, el check guarda · §3
> Fase P16-02 · hecho · Cabecera del editor por niveles · §4
> Fase P16-03 · hecho · Tarjeta de identidad · §5
> Fase P16-04 · pendiente · Cambiar de ejercicio o bloque: lista anclada y anterior/siguiente · §6
> Fase P16-05 · pendiente · Marcas «editada» en lo que se ha tocado · §7
> Fase P16-06 · pendiente · Letras y números en Barlow en las filas · §8
> Fase P16-07 · pendiente · Toast con Deshacer al borrar · §9
>
> Estado: **spec escrita, sin implementar** (18-oct-2026). Sale del análisis
> «qué hace que la app se sienta premium» (estados que la IA se salta: saber qué
> ha pasado, poder deshacer, saber dónde estás) y de cinco rondas de maquetas.
> Maquetas que mandan: [`editor-salida-5.html`](../mockups/editor-salida-5.html)
> (cabecera, tarjeta, avisos; **presentación a pantalla completa**) y
> [`editor-ejercicio.html`](../mockups/editor-ejercicio.html) (editor de
> ejercicio, **esquina + anterior/siguiente**). Las v1-v4 de `editor-salida*` y
> `editor-tarjeta.html` quedan como historia (§10).

---

## 1. Por qué

Tres problemas del editor de hoy, todos del mismo tipo — la interfaz promete
algo que el sistema no hace, o no dice dónde estás:

1. **No hay cancelar.** Cada cambio se escribe en el store al momento
   (`programs` y `sessionTemplates` están en el `partialize`). El chevron y el
   check de la cabecera guardan los dos; solo cambia adónde vas
   (`src/hooks/useEditorExit.js`). Pero un chevron frente a un check se lee como
   «cancelar / aceptar»: quien sale por el chevron cree que no ha guardado.
2. **No se sabe dónde estás.** Programa, sesión, ejercicio y bloque son cuatro
   pantallas de un mismo modo, y nada distingue la primera (la base) de las de
   dentro.
3. **Renombrar está escondido.** El nombre se cambia tocando el título de la
   cabecera, sin ninguna pista (`ScreenHeader`: «No hay lápiz ni botón de
   confirmar»).

Y borrar pide confirmación con un diálogo cada vez, cuando lo que da confianza
es poder deshacerlo.

## 2. Decisiones cerradas con el usuario (18-oct-2026)

| # | Decisión | Descartado y por qué |
|---|---|---|
| D1 | Se mantiene el sistema de hoy: **un check que guarda y sale del editor entero desde cualquier nivel** | Guardar en una barra abajo que solo sale con cambios (v4 B): separaba del todo navegar y guardar, pero el usuario prefiere el check |
| D2 | **Base del editor: «Cancelar» a la izquierda.** Dentro: **«‹ nombre del nivel anterior»**. Es el patrón de iOS para editar dentro de un modal (Contactos, Calendario) | Barra de modo de dos filas (v2 B); chevron solo (hoy) |
| D3 | Cancelar **solo existe en la base**. Desde dentro se sube con el chevron, que no pierde nada | Cancelar en todos los niveles |
| D4 | **Pantalla completa**, no hoja. Por eso la base lleva «EDITANDO» en el centro de la cabecera | Presentación en hoja (iOS pageSheet), con la pantalla de antes asomando |
| D5 | **Tarjeta gris lisa** (`surface2`, radio de tarjeta) con ceja, nombre y cifras | Degradado («etéreo», la app no usa degradados), ficha perforada, lima, banda tintada, banda gris |
| D6 | Cifras pequeñas y pegadas al nombre: el número en Barlow ~16, el texto a 12 como está | Cifras grandes a 20-26 (tapaban el editor) |
| D7 | El nombre de la cabecera **solo aparece al hacer scroll**, cuando la tarjeta sale de pantalla | Cabecera fija con ceja + nombre (repite la tarjeta) |
| D8 | En el editor de ejercicio, **cambiar de ejercicio** = botón de lista «n/N» en la esquina de la tarjeta **y** fila anterior/siguiente con swipe, como en Progreso › ejercicio | Chevron pegado al nombre: parecía «sustituir este» |
| D9 | La lista anclada del desplegable (número en Barlow + nombre, el actual resaltado) es **el formato de lista de la app** para estos saltos | — |
| D10 | La regla de progresión en la tarjeta dice **solo cuándo sube**, no cuándo baja | — |
| D11 | Borrar sesión, ejercicio o etapa → **toast con Deshacer**, sin diálogo | Diálogo «¿Seguro?» de hoy |
| D12 | Lo tocado durante el borrador lleva la marca **«editada»** | — |

## 3. P16-01 — Borrador: Cancelar descarta, el check guarda

**Al entrar en el editor** (la primera pantalla del editor que se apila, ver
§4.1) se guarda una copia profunda de lo que se puede tocar:

- el programa (`programs[id]`) y todos los `sessionTemplates` con ese
  `programId`, o
- si se entra a editar una plantilla de sesión o una sesión libre (sin
  programa), ese `sessionTemplate`.

Se sigue escribiendo en el store como hoy: así no cambia nada del resto del
código (Workout, Home, vistas previas). La copia vive en el store, fuera del
`partialize` (`ui._editorDraft = { kind, id, snapshot, startedAt }`): si la app
muere a mitad, al volver se queda lo escrito, como hoy.

- **Check (guardar)**: borra la copia, marca a los clientes
  (`markProgramDirtyForClients` / `markClientDirty`), toast «Programa guardado»
  y `backToMain` (lo que ya hace `done()` de `useEditorExit`).
- **Cancelar sin cambios** (el estado actual es igual a la copia): sale sin
  preguntar, sin toast, sin marcar clientes.
- **Cancelar con cambios**: diálogo con `showDialog`:
  - título «¿Descartar los cambios?», subtítulo el nombre del programa (o de la
    sesión), cuerpo «El programa vuelve a como estaba al entrar en el editor.»;
  - botón principal **«Seguir editando»** (cancel style), y **«Descartar
    cambios»** en destructivo;
  - descartar = escribir la copia de vuelta en el store (programa + templates;
    los templates que se crearon dentro del borrador se borran, los que se
    borraron vuelven) y salir sin marcar clientes ni toast.
- **Gesto de volver de iOS y botón atrás de Android en la base** = Cancelar
  (mismo diálogo). `navigation.addListener('beforeRemove', …)` en la pantalla
  base; en las de dentro el gesto sube un nivel como hoy.
- **Lo que no se deshace al cancelar**: ejercicios propios creados en la
  librería desde el editor (`customExercises`) se quedan — son de la librería,
  no del programa.
- El chevron de los niveles de dentro **no guarda ni descarta**: sube un nivel
  en el mismo borrador. `useEditorExit.commit()` deja de llamarse al volver; el
  toast y el marcado de clientes solo salen con el check.
- La comparación «hay cambios» es una igualdad profunda entre la copia y lo
  actual (los mismos campos que se copian). Se expone como selector
  `selectEditorDirty` para el aviso, para el check (§4) y para las marcas (§7).

*Como quedó (22-oct):* `ProgramEditor` es siempre la base (sin parámetro: solo se abre por `navigate('programEditor')`) y `SessionEditor` lo es con `editorBase: true` (Plantillas, Inicio, Programa, ficha de cliente); Cancelar = `goBack()` y `beforeRemove` decide si pregunta (`cancel` de `useEditorBase`, para P16-02); el toast «Programa editado» pasa a «Programa guardado»; para plantilla/sesión libre el cuerpo del aviso dice «La sesión vuelve…».

**Probar P16-01**

- [ ] Editar programa → cambiar las series de un ejercicio → volver con ‹ hasta la base → Cancelar → sale el diálogo; «Seguir editando» lo cierra y sigues en el editor
- [ ] Mismo caso → «Descartar cambios» → el ejercicio vuelve a tener las series de antes, en el editor y en Inicio; no sale ningún toast
- [ ] Entrar al editor y salir con Cancelar sin tocar nada → sale sin diálogo
- [ ] Cambiar algo dentro de una sesión y pulsar el check desde ahí → guarda, toast «Programa guardado», vuelves a la pestaña desde la que abriste el editor
- [ ] Añadir una sesión y borrar otra → Cancelar → Descartar → la añadida desaparece y la borrada vuelve
- [ ] Programa de un cliente: cambiar algo → Cancelar → Descartar → el cliente no queda marcado para «↑ Enviar»; con el check, sí
- [ ] En la base, gesto de volver (iOS) o botón atrás (Android) con cambios → mismo diálogo
- [ ] Editar una plantilla de sesión desde Plantillas → Cancelar con cambios → Descartar → la plantilla queda como estaba

## 4. P16-02 — Cabecera del editor por niveles

Un modo nuevo de `ScreenHeader` (`src/components/ui/ScreenHeader.jsx`), solo
para las pantallas del editor: `ProgramEditorScreen`, `SessionEditorScreen`,
`ExerciseEditorScreen`, `BlockEditorScreen` y `StagePlannerScreen`. Las otras
diez pantallas que usan `ScreenHeader` (Mi cuenta, Ayuda, Drive, Conexión con
entrenador, Pegar entreno, Próxima sesión, Vista del programa, Detalle de
ejercicio, Selector de ejercicios, Crear ejercicio) **no cambian**.

Fila de 56, como hoy:

- **Izquierda**
  - en la **base**: texto «Cancelar» (`textStyles.button`, `mutedLight`) → §3;
  - **dentro**: chevron lima + **nombre del nivel al que vuelves** en lima
    (`bodyStrong`), recortado con puntos suspensivos («‹ Fuerza 4 días»,
    «‹ Torso pesado»). Desde el editor de sesión de un programa con varias
    etapas, el destino es el nombre del programa (la etapa ya la dice la ceja
    de la tarjeta).
- **Centro**
  - en la base, sin scroll: «EDITANDO» (`textStyles.caps`, `accent`);
  - en cualquier nivel, cuando la tarjeta de identidad (§5) sale de pantalla:
    la ceja de la tarjeta (`caps`, `accent`) y el nombre (`bodyStrong`),
    centrados, con un fundido y 6 px de subida; y una línea fina debajo de la
    cabecera (`#262626`). Al plegarse, el texto del «‹ destino» se apaga y queda
    solo el chevron, para que no se pisen (como iOS cuando no cabe).
- **Derecha**: el check de hoy (`CheckIcon`, `accent`), en todos los niveles.
  En el editor de sesión sigue el menú «···» a su izquierda.

### 4.1 Qué pantalla es la base

**No depende del tipo de pantalla**: el editor de sesión es la base cuando se
abre desde Plantillas o para editar una sesión libre, y el de ejercicio cuando
se abre desde una plantilla. La base es **la primera pantalla del editor en la
pila**: un parámetro de ruta `editorBase: true` que pone quien abre el editor
(los `navigate('ProgramEditor' | 'SessionEditor' …)` desde fuera del editor), o
el índice de la pila si resulta más limpio. El implementador lista todos los
puntos de entrada con `grep -rn "navigate('\(Program\|Session\|Exercise\|Block\)Editor'"`.

### 4.2 Lo que se va

- Renombrar en la cabecera (`renaming`, `draft`, `onRenameStart`,
  `onRenameCommit`, el velo): pasa al lápiz de la tarjeta (§5). Se borra del
  componente si ya nadie lo usa.
- El desplegable de título (`menu`) en ejercicio y bloque: pasa a la tarjeta
  (§6). `onTitlePress` sigue: lo usa Detalle de ejercicio.

*Como quedó (22-oct):* `ScreenHeader` recibe `editor={{ base, onCancel, backLabel, folded }}` (renombrando vuelve a pintarse la cabecera de siempre); `folded` sale de `useEditorFold(threshold = 60)` (`onScroll` + `scrollEventThrottle={16}`). **Sin tarjeta aún (P16-03)** el plegado es un scroll de 60 px: P16-03 solo cambia el umbral por el alto medido de la tarjeta (`// P16-03:` en `hooks/useEditorFold.js`). Para no dejar al usuario sin renombrar ni cambiar de ejercicio hasta entonces, **siguen vivos `renaming`/`onRename*` y `menu`**, y el centro es pulsable (renombra, abre el desplegable u `onTitlePress`): en el programa, tocando «EDITANDO»; en la sesión, también por «···» › Editar nombre; en ejercicio y bloque, tocando el título plegado (con la cabecera sin plegar no hay acceso al desplegable hasta P16-04). **P16-03 quita `renaming`/`draft`/`onRename*`/velo; P16-04 quita `menu`.** `StagePlanner` solo usa el modo si se abre desde el editor (`fromEditor: true`; desde Clientes no) y la sesión libre del Workout (`BlockEditor` con `__free__`) no es editor. Destino de «‹» en ejercicio y bloque: el nombre de la sesión; en sesión: el del programa.

**Probar P16-02**

- [ ] Editar programa → arriba «Cancelar · EDITANDO · ✓»
- [ ] Abrir una sesión → «‹ Fuerza 4 días» y ✓; abrir un ejercicio → «‹ Torso pesado» y ✓
- [ ] Hacer scroll en una sesión larga (aún sin tarjeta: pasados ~60 px) → aparecen arriba la ceja y el nombre centrados, sale la línea fina y el «‹» se queda sin texto; al volver arriba, se invierte
- [ ] Editar una plantilla de sesión desde Plantillas → la sesión es la base: «Cancelar», no «‹»
- [ ] Mi cuenta, Vista del programa y Detalle de ejercicio siguen con su cabecera de siempre

## 5. P16-03 — Tarjeta de identidad

Sustituye el **Resumen** tintado de lima (`summaryCard`) del editor de sesión y
del de ejercicio, y es la primera pieza del de programa y del de bloque. Un
componente nuevo, `EditorIdentityCard`.

- Caja: `surface2`, radio de tarjeta (16), padding 13/15/13/18.
- **Ceja** (`caps`, `accent`): dónde estás dentro del programa.
  - Programa: «PROGRAMA». Programa de un cliente: «PROGRAMA · MARTA», con el
    nombre en el azul de cliente (`th.colors.blue`) — hoy esa información está
    en la ceja de la cabecera («Editar programa de cliente») y no se puede perder.
  - Sesión: «SESIÓN A · ETAPA 1» (sin etapa si el programa tiene una sola).
    Plantilla de sesión y sesión libre: la ceja que hoy lleva la cabecera.
  - Ejercicio: «EJERCICIO 01 · SESIÓN A».
- **Nombre**: `textStyles.heroName` (Barlow Condensed). Si a 28 se come la
  pantalla, el implementador lo baja con un rol nuevo en `textStyles` (no un
  `fontSize` suelto: `theme.test.js` lo prohíbe — ver U06).
- **Cifras**, una línea con `flex-wrap`, a 3 px del nombre: número en Barlow
  ~16 cursiva + texto a 12 (`label`, `mutedLight`). Rol nuevo en `textStyles`
  para el número (p. ej. `statGlyph`). Contenido:
  - Programa: semanas · sesiones/sem · etapas (esta última solo si hay más de una).
  - Sesión: ejercicios · series · min.
  - Ejercicio: la línea de volumen de hoy (`volumeLine` de
    `ExerciseEditorInline`: calentamiento, series × reps, descanso, dropset).
- **Lápiz** en la esquina (30×30, `surface`, radio 10, icono lima) en programa y
  sesión → `DragSheet` «Programa» / «Sesión A» con el campo Nombre (contador
  `n/43`, `NAME_MAX`) y «Hecho». «Hecho» **no guarda**: el nombre entra en el
  borrador y se guarda con el check. Sin lápiz cuando no se puede editar (el
  cliente con un programa del entrenador). El ejercicio no se renombra (eso es
  Sustituir): en su esquina va el botón de lista de §6.
- **Solo el ejercicio**, debajo de una línea fina (`#333`):
  - la regla de progresión con su icono (`ProgressionIcon`) en el tinte de hoy
    (`accent50`, el valor en negrita `accent`), **solo la subida**: la frase de
    `progressionRule` sin la cola «· baja si fallan…» (D10);
  - si el ejercicio está vinculado: icono de enlace + «Vinculado con la sesión
    C» + «· cambia en las dos» en `mutedLight`. Con más sesiones: «con las
    sesiones C y D». El selector de grupos sigue abajo, donde está.

### 5.1 Lo que cambia alrededor en el editor de programa

- **Varias etapas**: el rótulo de encima de las fichas pasa a «ETAPAS» a secas
  (las cifras totales ya las dice la tarjeta), con «Ver plan» a la derecha.
- **Una etapa**: desaparece la cabecera de la etapa, que hoy repite el nombre
  del programa (`single` en `ProgramEditorScreen`): la tarjeta ya lo dice.

*Como quedó (22-oct):* `components/editor/EditorIdentityCard` (props: `eyebrow`, `clientName`, `name`/`emptyName`, `stats` o `line`, `onRename`+`renameTitle` para el lápiz, **`corner`**, `onLayout`, `children`). **`corner` es el hueco de P16-04**: un `View` absoluto en la esquina (top 12 / right 12, 30 de alto, el nombre deja 70 a la derecha) donde va el botón «n/N»; `ExerciseEditorScreen` y `BlockEditorScreen` tienen un comentario `// P16-04:` donde pasarlo, y `ExerciseEditorInline`/`BlockEditorInline` lo reenvían. Rol nuevo `textStyles.statGlyph` (Barlow 16, ya en la escala). El nombre usa `heroName` (28, a dos líneas como mucho), sin rol más pequeño: la escala no tiene 24. La tarjeta del ejercicio y la del bloque viven dentro de los `*Inline` (el volumen y el nombre del bloque salen de su estado local, así que cambian al momento); la ceja («Ejercicio 01 · Sesión A», con el número de la lista de la sesión, `slotNumber`) la arma la pantalla y también va a la cabecera plegada. `useEditorFold()` ya no recibe umbral: devuelve `onCardLayout` y pliega al pasar el alto medido menos 20. Se quita de `ScreenHeader` el renombrado entero (`renaming`, `draft`, `onDraftChange`, `onRename*`, `placeholder`, velo y contador) y «···» › Editar nombre de la sesión (redundante con el lápiz); `menu` sigue hasta P16-04. Desvíos: (1) la regla usa `progressionRule(…, { parts: true })` y pone en negrita lima toda la acción («Sube 2,5 kg»), no solo el valor; (2) el bloque lleva su resumen en dos partes (línea + frase bajo la línea fina); (3) **con una sola etapa se quita el título repetido de la cabecera de la etapa, pero se queda la cabecera (ceja «En curso» + semanas/sesiones + engranaje)**: el engranaje es el único acceso a los ajustes de la etapa; (4) en la ficha de un programa de cliente, la ceja de la cabecera plegada es «Programa · Marta» (sin el azul); (5) las cifras de sesiones/sem son las de la etapa en curso; (6) se borran las claves de i18n que dejan de usarse (`titleEdit*`, `summarySession`, `summaryBlock`, `volume*`, `stagesLabel*` salvo `stagesLabelNone`, `exerciseEyebrow`, `blockEyebrow`, `programNamePlaceholder`).

**Probar P16-03**

- [ ] Editor de programa con 3 etapas → tarjeta gris «PROGRAMA / nombre / 12 semanas · 4 sesiones/sem · 3 etapas»; el rótulo de las fichas dice «ETAPAS»
- [ ] Programa de una sola etapa → la cabecera de la etapa ya no repite el nombre del programa (sigue el engranaje)
- [ ] Lápiz → hoja con el nombre → cambiarlo → Hecho → la tarjeta lo enseña; Cancelar el editor → Descartar → vuelve el nombre de antes
- [ ] Programa de un cliente → la ceja dice «PROGRAMA · <nombre del cliente>» en azul
- [ ] Editor de ejercicio → la tarjeta lleva el volumen, la regla (solo cuándo sube) y, si está vinculado, «Vinculado con la sesión X»; cambiar el grupo a «Ninguna» quita esa línea
- [ ] Cambiar las series en el editor de ejercicio → la cifra de la tarjeta cambia al momento
- [ ] Editor de sesión → tarjeta gris con «SESIÓN A · ETAPA 1» (sin etapa si solo hay una), nombre, ejercicios · series · min y lápiz; «···» ya no trae Editar nombre
- [ ] Editor de bloque → tarjeta con «BLOQUE 04 · SESIÓN A», el nombre del bloque (cambia al escribirlo en Opciones) y el resumen
- [ ] Scroll en cualquier editor → la cabecera se pliega (ceja + nombre) cuando la tarjeta sale de pantalla, no antes

## 6. P16-04 — Cambiar de ejercicio o bloque

En `ExerciseEditorScreen` y `BlockEditorScreen`, que hoy saltan entre hermanos
con el desplegable del título.

1. **Botón de lista en la esquina de la tarjeta**: icono de lista + «2/6»
   (`labelStrong`, `mutedLight`), caja `surface`, radio 10, alto 30. Abre la
   **lista anclada** justo debajo de la tarjeta. Con el título plegado (§4),
   tocarlo abre la misma lista bajo la cabecera.
2. **Fila anterior/siguiente** encima de la tarjeta: **la misma pieza que
   Detalle de ejercicio** (`ExerciseDetail.jsx`, estilos `nbr` / `nbrBtn` /
   `nbrText`): «‹ Press banca» a la izquierda y «Press militar ›» a la derecha,
   cada uno en su mitad, recortado. Sin vecino, su lado queda vacío.
3. **Swipe** a los lados sobre el contenido cambia al anterior/siguiente, con
   el mismo gesto que `ExerciseDetail` (`PanResponder`, umbral, resistencia al
   20 % en los extremos). Que no robe el scroll vertical ni los gestos de los
   controles (StepField, SegmentedControl).
4. El cambio usa `selectExercise` de hoy (remonta `ExerciseEditorInline` con
   `key`), con un deslizamiento horizontal en la dirección del cambio en vez
   del `FadeInDown`.

### 6.1 La lista anclada (componente reutilizable)

Sale del desplegable de `ScreenHeader` (`menu`) a un componente propio,
`AnchoredList`, porque se va a usar en otros sitios (D9):

- Caja `surface2`, radio 10, padding 4, sombra; ancho de la columna de
  contenido; anclada bajo el elemento que la abre; velo transparente detrás
  que la cierra.
- Filas de 10/12 px de padding, radio 8: número en Barlow cursiva (`muted`) +
  nombre (`bodyStrong`). La fila actual: fondo `surface`, número y nombre en
  `accent`.

**Probar P16-04**

- [ ] Editor de ejercicio → botón «1/6» en la esquina → lista bajo la tarjeta con el actual resaltado → elegir otro → cambia, con deslizamiento
- [ ] Fila de arriba «‹ anterior · siguiente ›» → tocar «siguiente» → cambia; en el primero no hay «anterior»
- [ ] Deslizar el contenido a la izquierda → siguiente ejercicio; en el último, el contenido se resiste y vuelve
- [ ] Deslizar en horizontal sobre un campo con − / + no cambia de ejercicio
- [ ] Con la tarjeta fuera de pantalla, tocar el título plegado → abre la lista
- [ ] Editor de bloque → lo mismo entre bloques

## 7. P16-05 — Marcas «editada»

Con el borrador (§3) se sabe qué ha cambiado. Comparando cada elemento con su
copia:

- **Tarjeta de sesión** del editor de programa tocada (cualquier cambio en su
  template): texto «editada» (`labelStrong`, `accent`) a la derecha.
- **Fila de ejercicio** del editor de sesión tocada: la meta («4×5 · 3 min»)
  en `accent` en vez de `mutedLight`.
- Una sesión o un ejercicio **nuevos** dentro del borrador cuentan como
  editados.
- Al guardar o descartar, desaparecen (la copia se borra).

**Probar P16-05**

- [ ] Cambiar las series de un ejercicio de la sesión A → en el editor de sesión, su meta sale en lima; en el de programa, la sesión A lleva «editada»
- [ ] Guardar con el check y volver a entrar → ya no hay marcas
- [ ] Añadir una sesión → sale con «editada»

## 8. P16-06 — Letras y números en Barlow

En las filas del editor, la letra de la sesión (`sesLetter` de
`ProgramEditorScreen`, hoy `itemTitle` Inter Black 16) y el número del
ejercicio (`rowNumber` de `SessionEditorScreen`, hoy `labelStrong` 12) pasan a
**Barlow Condensed cursiva**, más grandes y con la columna más ancha:

- letra de sesión: ~26 px, `accent`, columna de ~20 px;
- número de ejercicio («01», «03A»): ~20 px, `muted`.

Un rol nuevo en `textStyles` (p. ej. `indexGlyph`), dado de alta en la
escala de U06 y en `theme.test.js`, y no tamaños sueltos. El mismo rol en los
números de la lista anclada (§6.1). El implementador revisa si la tarjeta de
sesión de Vista del programa y el onboarding usan el mismo `sesLetter` y, si
sí, pregunta antes de cambiarlos.

**Probar P16-06**

- [ ] Editor de programa → las letras A, B, C de las tarjetas en Barlow cursiva, más grandes, y el nombre no se desplaza
- [ ] Editor de sesión → «01», «02», «03A» en Barlow cursiva gris

## 9. P16-07 — Toast con Deshacer al borrar

**Dónde**: borrar una sesión (editor de programa, acción de la tarjeta),
borrar una etapa (hoja de ajustes de etapa), quitar un ejercicio (editor de
sesión y botón Eliminar del editor de ejercicio). Si funciona bien, se
extenderá a clientes, plantillas y otras cosas que no son permanentes.

- **Sin diálogo**: se borra al momento.
- Toast nuevo con acción. El de hoy (`src/components/Toast.jsx`) es
  `pointerEvents="none"`, una sola línea centrada y redondo; se añade una
  variante con acción:
  - abajo, sobre el pulgar, ancho completo menos 15 a cada lado, radio 16, fondo
    `text` y tinta `bg` (el «neutral» de hoy);
  - «**Sesión B** eliminada» / «**Press banca** quitado» / «**Etapa 2**
    eliminada» + botón «Deshacer» (`button`, verde oscuro sobre claro);
  - una barra de 3 px que se vacía en **5 s**; al acabar, el toast se va;
  - borrar otra cosa con el toast fuera lo sustituye (solo se puede deshacer lo
    último).
- `showToast(msg, duration, type, action?)` con `action = { label, onPress }`.
- **Deshacer** restaura exactamente lo que había: antes de borrar se guarda una
  copia profunda de lo afectado (el programa + los templates que toque el
  borrado; en una etapa, también sus sesiones) y deshacer la escribe de vuelta.
  Mismo mecanismo que el descarte de §3, a escala pequeña.
- Sigue valiendo la regla de hoy: la última sesión de una etapa no se borra.

**Probar P16-07**

- [ ] Borrar la sesión B → desaparece sin preguntar y sale «Sesión B eliminada · Deshacer» con la barra → Deshacer → vuelve en su sitio, con sus ejercicios
- [ ] Borrar una sesión y esperar 5 s → el toast se va y la sesión sigue borrada
- [ ] Quitar un ejercicio en el editor de sesión → toast → Deshacer → vuelve en su posición, con su configuración
- [ ] Eliminar desde el editor de ejercicio → vuelve a la sesión con el toast → Deshacer → el ejercicio vuelve
- [ ] Borrar una etapa → toast → Deshacer → vuelve la etapa con sus sesiones
- [ ] Borrar dos sesiones seguidas → el toast es el de la segunda; Deshacer solo recupera la segunda

## 10. Historia del diseño

- v1 `editor-salida.html`: «Cancelar / Guardar» arriba con un solo Guardar. El
  chevron frente a Guardar seguía pareciendo cancelar.
- v2 `editor-salida-2.html`: barra de modo de dos filas frente a chevron con
  destino; tarjeta en placa (degradado) o banda.
- v3 `editor-salida-3.html`: tarjetas sólidas (ficha perforada, lima, banda
  tintada).
- v4 `editor-salida-4.html`: tarjeta y banda grises; Guardar en una barra abajo.
- v5 `editor-salida-5.html`: la elegida.
- `editor-tarjeta.html`: primera tarjeta y primer toast con Deshacer.
- `editor-ejercicio.html`: editor de ejercicio con contenido real; esquina y
  anterior/siguiente.

## Fases

| Fase | Qué | Depende de | Coste | Estado |
|---|---|---|---|---|
| P16-01 | Borrador, Cancelar y aviso | — | 🟡 | ✅ `212f79f` — `useEditorDraft` + `utils/editorDraft` |
| P16-02 | Cabecera por niveles | P16-01 (Cancelar) | 🟡 | ✅ `f154e43` — modo `editor` de `ScreenHeader` + `useEditorFold` |
| P16-03 | Tarjeta de identidad y hoja de nombre | P16-02 (quita el renombrado de la cabecera) | 🟡 | ✅ `HASH` — `EditorIdentityCard` + `statGlyph` |
| P16-04 | Lista anclada, anterior/siguiente y swipe | P16-03 (esquina de la tarjeta) | 🟡 | pendiente |
| P16-05 | Marcas «editada» | P16-01 | 🟢 | pendiente |
| P16-06 | Letras y números en Barlow | — | 🟢 | pendiente |
| P16-07 | Toast con Deshacer | — (independiente del borrador) | 🟡 | pendiente |
