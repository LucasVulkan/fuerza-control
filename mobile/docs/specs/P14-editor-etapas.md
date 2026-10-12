# Spec — Editor de programa: tarjetas de etapa y sus sesiones

> Tema: programas
> En corto: En Editar programa, las etapas dejan de ser un segmentado con una segunda pulsación escondida y pasan a ser una fila de tarjetas («Etapa 2 · Acumulación · sem 5-8») que se desplaza con el dedo; debajo, la cabecera de la etapa elegida y sus sesiones sueltas, como en el editor de sesión, que siguen deslizándose, reordenándose y abriéndose como hoy.
> Inicio: 2026-10-09
> Fase P14-01 · terminado · Diseño del editor en cinco rondas con el usuario · §8
> Fase P14-02 · terminado · Cifras de una etapa: funciones puras y tests · §5.1
> Fase P14-03 · hecho · Tarjetas de etapa y rótulo · §5.2
> Fase P14-04 · hecho · Cabecera de la etapa y sus sesiones · §5.3
> Fase P14-05 · pendiente · Panel de cifras y grupos musculares · §5.4
> Fase P14-06 · pendiente · Hoja de Ajustes y «nueva etapa» · §5.5
> Fase P14-07 · pendiente · Programa de una sola etapa · §5.6
>
> Estado: **P14-02 a 04 implementadas, por probar** (12-oct-2026, rama
> `feat/editor-etapas`). Mientras no lleguen 05-07: no hay botón de cifras, el
> engranaje abre la hoja de etapa de siempre, el «+» de las tarjetas y «Ver plan»
> van al planificador sin `addFrom`, y un programa de una sola etapa enseña su
> tarjeta y el rótulo (la vista propia es P14-07). Diseño: cinco rondas con el
> usuario (9 y 12-oct); la maqueta que manda es
> [`docs/mockups/stages-editor-5.html`](../mockups/stages-editor-5.html) con las
> sesiones **sueltas**. Las anteriores quedan como historia (§8); de la v4
> (`stages-editor-4.html`) vale todo menos las pestañas y las sesiones dentro. El
> creador de etapas y el planificador van aparte, en
> [P15-creador-etapas.md](P15-creador-etapas.md); hasta que P15 exista, las
> entradas a «nueva etapa» van al planificador de hoy (§5.5).

---

## 1. Por qué

Hoy la sección Etapas de `ProgramEditorScreen` es el `StageSelector`, un
segmentado de dos líneas:

- Con más de 4 etapas se desplaza y corta los nombres.
- Tiene una función oculta: pulsar otra vez la etapa ya seleccionada abre su hoja
  de ajustes (nombre, semanas, en curso, candado, duplicar, eliminar). Solo lo
  avisa un texto de ayuda debajo.
- Las sesiones van debajo con un título «SESIONES DE …», y se leen como otra
  sección, no como el contenido de la etapa.
- Encima, una tarjeta de resumen (`summaryCard`, «PROGRAMA · 6 etapas · 19
  semanas») y un título «ETAPAS» suelto que ocupan mucho y dicen lo mismo.
- Con una sola etapa el segmentado enseña una pastilla sola: se lee como un
  programa dentro del programa.

Y lo que pidió el usuario: que las etapas se entiendan como **secciones de un
mismo programa** (tramos de semanas, el mesociclo), no como programas distintos.

## 2. Lo que no cambia

- **Nada del store.** Las acciones de hoy alcanzan: `updateStage`,
  `setCurrentStage`, `removeStageFromProgram`, `duplicateStageInProgram`,
  `reorderSessionsInStage`, `duplicateSessionInProgram`,
  `removeSessionFromProgram`, `addSessionToProgram`.
- **Todo se añade al final**, nunca en medio (P06 §14.2.2).
- Reglas del candado de [C03-stage-locks.md](C03-stage-locks.md) y `canLockStage`
  tal cual están en `ProgramEditorScreen`.
- La etapa en curso REAL sale del blob del cliente, nunca de la copia del programa
  (P08 §3.7): `athleteProgress(program, ownerClient(clients, program))` +
  `stageStatus`, como ya hace el planificador.
- **«Qué sesión toca»** (U13) se queda donde está, debajo.
- **`ProgramDetailScreen`** (el visualizador) sigue con `StageSelector`; decidir si
  pasa a tarjetas de etapa es cosa de P15 §6.7. Por eso `StageSelector` no se borra.
- El planificador (`StagePlannerScreen`) no cambia salvo el parámetro de entrada de
  §5.5.

## 3. Cómo queda (diseño cerrado)

De arriba abajo, con dos o más etapas. Es el mismo esqueleto que el editor de
sesión (`SessionEditorScreen`: chips A/B/C, tarjeta de resumen, «EJERCICIOS» y las
tarjetas sueltas): quien sabe usar uno sabe usar el otro.

```
‹        EDITAR PROGRAMA                ✓
            Fuerza Base
6 ETAPAS · 19 SEMANAS            Ver plan ›     ← rótulo, pegado a las tarjetas
┌─────────┐┏━━━━━━━━━┓┌──────────┐┌──
│✓ Etapa 1│┃Etapa 2  ┃│Etapa 3 🔒││Eta      ← fila desplazable; «+» al final
│Base     │┃Acumulac.┃│Intensif… ││
│sem 1-4  │┃sem 5-8  ┃│sem 9-11  ││
│         │┃▬▬▬───── ┃│          ││
└─────────┘┗━━━━━━━━━┛└──────────┘└──
╭──────────────────────────────────────────╮
│ EN CURSO · SEMANA 2 DE 4       [≡] [⚙]   │   ← cabecera de la etapa
│ 2 Acumulación                            │
│ 4 semanas · 3 sesiones                   │
╰──────────────────────────────────────────╯
SESIONES DE ESTA ETAPA
┌──────────────────────────────────────────┐
│ A  Pierna y empuje                   ⠿   │   ← las tarjetas de sesión de hoy
│    5 ejercicios · 22 series · 75 min     │
└──────────────────────────────────────────┘
  … B, C …
       + Añadir sesión a Acumulación

QUÉ SESIÓN TOCA
[ Rotación | Semanal | Libre ]
```

### 3.1 Fuera

- La tarjeta de resumen (`summaryCard`) y el título «ETAPAS».
- El texto de ayuda «toca otra vez para editar» (`editor.stageTapHint`).
- El título «SESIONES DE …» con el nombre (`editor.sessionsOf`): pasa a ser
  «SESIONES DE ESTA ETAPA», sin nombre (el nombre está en la cabecera, justo encima).
- La segunda pulsación sobre la etapa seleccionada.
- «N entrenos por semana»: ya lo dice la meta de la cabecera.

### 3.2 El rótulo

Una línea pegada a las tarjetas (8 dp por debajo hasta ellas): a la izquierda, en
caps `mutedLight`, «**6** ETAPAS · 19 SEMANAS» (el número en `text`), con «+» si
alguna etapa es sin límite («19+ SEMANAS», `programTotals().open`); a la derecha,
«Ver plan ›» en `accent`, que navega a `StagePlanner`.

### 3.3 Las tarjetas de etapa

- Una tarjeta por etapa, **100 × 72 dp**, radio 12, fondo `surface`, relleno 9/8.
  Caben tres enteras y asoma la cuarta en un móvil de 375 (con 78 cabían cuatro,
  pero «Acumulación» ya se cortaba).
- Dentro, de arriba abajo:
  - **«Etapa 2»** (500/11, sin negrita): «Etapa» y no solo el número, para que no
    haya duda de qué son, y más ligero que el nombre para que mande el nombre
    (decisiones del usuario). Con el **candado** rojo de 10 dp a la derecha
    si está bloqueada (§5.2, quién lo ve). Hechas: «✓ Etapa 1».
  - **Nombre** (700/12, una línea, se corta con «…»).
  - **Tramo de semanas** (500/10, `muted`): «sem 1-4 · sem 5-8 · sem 9-11 · sem 12».
    Dice sin palabras que son trozos seguidos del mismo calendario. Se calcula con
    las `durationWeeks` previstas (no con las semanas alargadas del cliente); una
    sin límite es «sem 13+», y **después** de una sin límite ya no hay calendario:
    esas tarjetas dicen la duración («4 sem»).
  - **En curso**: una **barrita de progreso** abajo, a todo el ancho, 3 dp (tinte
    `accent` al 18 % de fondo, `accent` de relleno) con las sesiones hechas de la
    etapa sobre las esperadas (`stageStatus().done / expected`). Sin límite, sin
    barrita.
- Estados: la **seleccionada**, borde 1,5 dp `accent`, fondo `surface2`, «Etapa N»
  en `accent` y nombre en `text`; el resto, «Etapa N» y nombre en `mutedLight`;
  las **hechas**, al 55 % de opacidad; las **descargas**, «Etapa N» en `blue` (y
  borde `blue` si están seleccionadas).
- **Al final, un cuadrado de 46 dp** con borde discontinuo (`border`), sin fondo,
  y un **+** en `accent`. Abre la creación de etapa con la seleccionada como base
  (§5.5).
- **Se desplaza con el dedo** (con imán suave al principio de cada tarjeta) y **se
  elige tocando**: desplazar solo mueve la fila, no cambia de etapa. Al cambiar de
  etapa por otro camino (deslizando la cabecera), la fila se mueve lo justo para que
  la elegida quede a la vista.

### 3.4 La cabecera de la etapa

Tarjeta `surface`, radio 18, relleno 16/14:

- **Ceja** (caps 10): el estado — «EN CURSO · SEMANA 2 DE 4» en `accent` (de
  `stageWeekLabel`), «HECHA», «POR VENIR» en `muted`, «DESCARGA» en `blue` si es de
  descarga y no ha llegado — y, si está bloqueada, «· 🔒 BLOQUEADA» en rojo.
- **Título**: el número en `accent` (en `blue` si es descarga), 7 dp, y el nombre
  (900/20, una línea).
- **Meta**: «4 semanas · 3 sesiones» (o «Sin límite de semanas · 3 sesiones»).
- A la derecha, dos botones de 36 dp (`surface2`, radio 11): **cifras** (tres
  barras horizontales, §5.4) y **ajustes** (engranaje, §5.5).

Debajo, a 20 dp, el rótulo **«SESIONES DE ESTA ETAPA»** (caps `mutedLight`, como
`secTitle`) y las sesiones (§4), con «+ Añadir sesión a **Acumulación**» como hoy
(texto `accent50`, el nombre en `accent`, sin caja). Después, **más aire** (unos
28 dp) antes de «QUÉ SESIÓN TOCA», para que cabecera y sesiones se lean como un
grupo.

**Cambiar de etapa** —tocando una tarjeta o **deslizando la cabecera** a los
lados— hace que la página entera (cabecera, rótulo y sesiones) salga y entre
deslizando en la dirección del cambio, con el mismo `useSlidePages` que usa el
editor de sesión al cambiar de sesión. Es lo que hace que cabecera y sesiones se
lean como una unidad sin compartir caja. Nunca se cambia de etapa deslizando sobre
una sesión (§4.2).

## 4. Las sesiones

### 4.1 Todo lo de hoy sigue igual

Sueltas (decisión del 12-oct, por coherencia con el editor de sesión y para no
apilar tres niveles de caja bajo las tarjetas de etapa), así que la lista es
**exactamente** la de hoy: la misma `Sortable.Grid` con las mismas `SessionCard`
(`SwipeRow`), sin tocar su aspecto.

| Hoy | En el editor nuevo |
|---|---|
| Tocar → `SessionEditor` | igual |
| Deslizar a la derecha → Duplicar · Eliminar | igual |
| La última sesión de la etapa no se puede eliminar | igual |
| Una tarjeta abierta a la vez (`openRowId`); se cierra al arrastrar | igual, y también se cierra al cambiar de etapa |
| Reordenar arrastrando **solo** desde el asa (`Sortable.Handle`) | igual, con el mismo autoscroll (`scrollableRef`) |
| `handleReorder` → `reorderSessionsInStage` | igual |
| Duplicar inserta tras el original y eliminar reetiqueta (P49) | igual |

### 4.2 Los gestos no se pisan

- **Deslizar una sesión** (derecha) es de `SwipeRow`. **Cambiar de etapa** se hace
  en las tarjetas de etapa o en la **cabecera** (ceja, título y meta), nunca en la
  zona de sesiones.
- El gesto de la cabecera solo se activa en horizontal (activa a ±20 dp en x,
  falla a ±10 dp en y) para no robarle el scroll vertical a la pantalla, y no
  arranca sobre los dos botones.
- Reordenar sigue siendo exclusivo del asa, así que tampoco choca con nada.

## 5. Tareas

### 5.1 P14-02 — Cifras de una etapa (funciones puras)

En `src/utils/stageProgress.js` (son aritmética de etapa) o un `stageStats.js`
nuevo si crece; con tests en vitest:

- `stageWeekRanges(stages)` → por etapa `{ from, to }` (semanas previstas, `to`
  null si sin límite) o `null` si va después de una sin límite. §3.3.
- `stageVolume(stage, sessionTemplates, allExercises)` → `{ sessions, exercises,
  sets }`. **Se mueve** desde `StagePlannerScreen.jsx` (mismo código) y el
  planificador la importa.
- `stageKeyReps(stage, sessionTemplates)` → rango medio `{ lo, hi }` de los
  ejercicios `isKey` (media de `minReps`/`maxReps`, redondeada); `null` si no hay
  principales.
- `stageMinutes(stage, sessionTemplates, allExercises)` → minutos por sesión,
  media de `sessionStats().minutes` de sus sesiones.
- `stageSetsByGroup(stage, sessionTemplates, allExercises)` → `[{ group, sets }]`
  con `muscleGroupOf` de `trainingLoad.js`, series previstas por semana (las
  sesiones de una etapa son las de una semana).
- `stageBaseIdx(stages, idx)` → índice de la etapa de la que salió
  (`stage.derivedFromStageId`) o `null` (hecha a mano o duplicada).

Hecho en `src/utils/stageStats.js` (+ `stageStats.test.js`). `stageSetsByGroup`
envuelve `plannedSetsByGroup` de `trainingLoad.js`, que ya contaba las series
previstas con las mismas reglas que la pestaña Carga.

### 5.2 P14-03 — Tarjetas de etapa y rótulo

Componente nuevo `src/components/ui/StageCards.jsx`:

- Props: `stages` (`[{ id, number, name, range, done, deload, locked, progress }]`
  ya resueltas por la pantalla), `value`, `onChange`, `onAdd`.
- `ScrollView` horizontal sin barra, `snapToInterval={108}` (100 + 8 de hueco)
  con `snapToAlignment="start"` y `decelerationRate="fast"`; el contenido sale a
  sangre (margen −16 y relleno 16, como el resto de filas desplazables de la app).
  Tocar elige; desplazar no. Al cambiar `value` desde fuera, `scrollTo` animado
  solo si la tarjeta elegida no se ve entera.
- El cuadrado «+» al final del contenido.
- **Quién ve el candado**: en el móvil del cliente, `isStageLocked`; en el del
  entrenador, `stage.locked && idx > activeIdx` en un programa de un cliente (la
  regla de `canLockStage`). En un programa propio, nunca.
- En `ProgramEditorScreen`: fuera `summaryCard`, `secTitle` de Etapas,
  `StageSelector` y `stageHint`; dentro el rótulo (§3.2) y `StageCards`.

**Probar P14-03**

- [ ] Programa de 6 etapas: se ven tres tarjetas y asoma la cuarta; la en curso con
  su barrita, las hechas atenuadas con ✓, las descargas en azul.
- [ ] Desplazar la fila no cambia de etapa; tocar una tarjeta la elige y la página
  cambia.
- [ ] Detrás de la última, el «+».
- [ ] «Etapa N», nombre y tramo caben; un nombre largo se corta con «…».
- [ ] Tramos: «sem 1-4 · sem 5-8…»; con una etapa sin límite, «sem 13+», y las de
  después con su duración.
- [ ] Rótulo «6 ETAPAS · 19 SEMANAS» y «19+» con una sin límite; «Ver plan ›» abre
  el planificador.
- [ ] Móvil del entrenador con un cliente: el candado sale en las bloqueadas por
  delante de la de ahora; en un programa propio no sale nunca. Móvil del cliente:
  igual que hoy.
- [ ] La barrita de la etapa en curso se llena con las sesiones hechas; en una etapa
  sin límite no sale.

### 5.3 P14-04 — Cabecera de la etapa y sus sesiones

- Cabecera (§3.4) con ceja, título y meta; los dos botones (el de cifras sin
  función hasta P14-05, o se deja fuera hasta entonces).
- Rótulo «SESIONES DE ESTA ETAPA» y la lista de §4 tal cual está hoy.
- Transición al cambiar de etapa con `useSlidePages`
  (`src/components/ui/useSlidePages.js`), como `SessionEditorScreen`: la página
  (cabecera + rótulo + lista) en un `Reanimated.View` con `key` = id de la etapa y
  `entering`/`exiting` del hook, más `LayoutAnimationConfig skipEntering
  skipExiting` dentro para que la lista no haga su propio fundido. Al cambiar se
  cierra `openRowId`.
- Gesto de la cabecera con `react-native-gesture-handler` (`Gesture.Pan`,
  `activeOffsetX([-20, 20])`, `failOffsetY([-10, 10])`): a más de 60 dp, etapa
  siguiente o anterior.
- Fuera `editor.sessionsOf` y `editor.stageTapHint` de los locales.

**Probar P14-04**

- [ ] Cambiar de etapa tocando una tarjeta y deslizando la cabecera: la página entra
  por el lado correcto y las sesiones son las de esa etapa.
- [ ] Deslizar la cabecera en vertical hace scroll de la pantalla, no cambia etapa.
- [ ] Deslizar una sesión a la derecha abre Duplicar · Eliminar como hoy.
- [ ] Duplicar y eliminar una sesión funcionan; la última no se puede eliminar.
- [ ] Reordenar por el asa, con autoscroll si la lista es larga.
- [ ] Una sesión abierta se cierra al cambiar de etapa y al empezar a arrastrar.
- [ ] Tocar una sesión abre su editor; volver deja la misma etapa seleccionada.
- [ ] «+ Añadir sesión a X» añade a la etapa seleccionada.
- [ ] Etapa bloqueada: ceja con «· 🔒 BLOQUEADA».
- [ ] Cabecera y sesiones se leen como un grupo (aire antes de «Qué sesión toca»).

### 5.4 P14-05 — Panel de cifras y grupos musculares

El botón de cifras despliega, dentro de la cabecera y bajo un filete, un panel
(se cierra con el mismo botón; queda abierto al cambiar de etapa):

- **Comparar**: `SegmentedControl` «Sin comparar · Con la anterior · Con su base».
  Con su base usa `stageBaseIdx`; si no hay con qué comparar, una línea
  («No hay con qué comparar: es la primera etapa / se hizo a mano»).
- **De dónde sale**: «Sale de **1 · Base** con +1 serie» (`describeRx`) o «Hecha a
  mano».
- **Tres cifras** en cajas `surface2`: series / semana, reps básicos, min por
  sesión, cada una con su diferencia si se compara (lima si sube el trabajo o la
  intensidad, azul si baja; en reps, menos reps cuenta como subir).
- **Series por semana y grupo**: la misma fila que la tarjeta de grupos de la
  pestaña Carga (`LoadTab`): nombre (`exerciseSelector.groups.*`), barra con las
  marcas de `SETS_TARGET_MIN/MAX`, `accent` dentro de rango y `orange` fuera
  (UI-MIGRATION §4.9: aquí no se usa rojo) y el número. **Se extrae** de `LoadTab`
  a un componente compartido; el editor le añade la raya de la etapa con la que se
  compara y la diferencia pequeña junto al número.
- Ficha de transparencia ([T02](T02-metric-transparency.md)) en el mismo commit:
  son series **previstas** por la plantilla, no hechas; la de Carga cuenta las
  hechas.

**Probar P14-05**

- [ ] Abrir cifras en una etapa creada con regla: «Sale de…», tres cifras y grupos.
- [ ] Con la anterior y con su base: diferencias y rayas correctas; en la primera
  etapa y en una hecha a mano, la línea de «no hay con qué comparar».
- [ ] Editar a mano las series de una sesión y volver: las cifras cambian.
- [ ] Los colores de los grupos son los de Carga.

### 5.5 P14-06 — Hoja de Ajustes y «nueva etapa»

- La `DragSheet` de hoy pasa a componente propio `StageSettingsSheet` (nombre,
  semanas o sin límite, en curso / activar, candado, eliminar), que P15 reutilizará
  en el planificador. Se abre **solo** con el botón de ajustes.
- Gana arriba de los botones **«＋ Nueva etapa desde esta»** (`accent10` con borde
  `accent50`).
- **Mientras no exista el creador de P15**, «nueva etapa» (la hoja y el «+» del
  final de las tarjetas) navega a `StagePlanner` con `{ programId, addFrom: idx }`, y el
  planificador abre su hoja «Añadir etapas» con esa etapa como base
  (`setSourceIdx(addFrom)` + `setAddOpen(true)` al montar). Es el único cambio en el
  planificador.
- **Duplicar se queda en la hoja hasta P15**: el usuario decidió que duplicar será
  «crear con Igual» en el creador, pero sin creador no hay dónde. P15 lo quita.

**Probar P14-06**

- [ ] El engranaje abre Ajustes; tocar la etapa ya seleccionada no abre nada.
- [ ] Nombre, semanas, sin límite, activar, candado y eliminar funcionan como hoy.
- [ ] «Nueva etapa desde esta» y el «+» de las tarjetas abren el planificador con la
  hoja de añadir abierta y esa etapa como base.
- [ ] Duplicar sigue funcionando.

### 5.6 P14-07 — Programa de una sola etapa

- **Sin tarjetas de etapa ni rótulo.** La cabecera sola, con la ceja «SIN LÍMITE DE SEMANAS»
  (o «N SEMANAS») y el título **«Todo el programa»** en vez del nombre de la etapa
  (repetiría el del programa), sin número; meta «3 sesiones por semana». Los dos
  botones igual. Sin gesto de cambiar etapa.
- Debajo de la cabecera, a 12 dp, un recuadro con borde discontinuo (`border`,
  radio 12): un cuadrado discontinuo con «+», **«Añadir etapas»** en `accent` y una
  sola línea: «Bloques de varias semanas para trabajar un objetivo concreto.» Sin
  ejemplo ni más texto (decisión del usuario). Abre lo mismo que §5.5.
- Debajo, «SESIONES» (sin «de esta etapa») y la lista.
- Al pasar a dos etapas aparecen las tarjetas de etapa y el rótulo, y el recuadro se va.

**Probar P14-07**

- [ ] Programa nuevo de una etapa: sin tarjetas de etapa, «Todo el programa», «Añadir etapas».
- [ ] Añadir una etapa desde ahí: al volver hay dos tarjetas de etapa con sus tramos.
- [ ] Borrar etapas hasta dejar una: vuelve la vista de una sola.

## 6. i18n

En `src/locales/es.json` **y** `en.json`, añadiendo línea a línea (nunca
reformatear el JSON):

- Nuevas: rótulo (`editor.stagesLabel` con `{{count}}` y `{{weeks}}`, y la variante
  abierta), tramo (`editor.stageRange`, `editor.stageRangeOpen`, `editor.stageRangeOne`),
  «Etapa {{n}}», «SESIONES DE ESTA ETAPA» y «SESIONES», ceja (hecha, por venir, descarga, bloqueada), meta, «Todo el
  programa», «Añadir etapas» y su línea, «Nueva etapa desde esta», el panel de cifras
  (comparar, de dónde sale, las tres cifras, «no hay con qué comparar»).
- Fuera (solo las usa el editor): `editor.stageTapHint`, `editor.sessionsOf`,
  `editor.summaryProgram`, `editor.programSummary*`, `editor.sectionStages`,
  `editor.sectionSessions`, `editor.stageSheetTitle` si la hoja nueva cambia el
  título. `weeksShort`, `weeksOpen` y `stageDuplicateBtn` se usan fuera: se quedan.

## 7. Qué no tocar

- El store y sus acciones de etapa/sesión.
- `StageSelector` (lo sigue usando `ProgramDetailScreen`).
- `StagePlannerScreen` salvo el parámetro `addFrom` (§5.5) y el import de
  `stageVolume`.
- `SessionCard`, `SwipeRow` y la lista de sesiones: se reutilizan sin cambios.

## 8. Cómo se llegó (rondas con el usuario)

1. **9-oct** — `stages-v2.html` §1: tira proporcional + ficha (A), fichas
   deslizables (B), ola + ficha (C). Gustó la A, pero sin longitudes, más ligera y
   con las sesiones bien unidas a la etapa.
2. **12-oct** — `stages-editor-2.html`: línea de tiempo centrada, la etapa como
   título de sus sesiones (carpeta, raíl, lista agrupada) y tres sitios para
   «nueva etapa». Elegida la **carpeta**; «nueva etapa» al final de la línea y en
   Ajustes, siempre al mismo creador.
3. **12-oct** — `stages-editor-3.html`: forma de la línea (círculos, cuadrados,
   segmentos, **pestañas**), texto (nombre, **semanas**, número), sesiones dentro o
   debajo, tarjeta de sesión (clara, **hundida**, filas), candado (**ceja**, meta).
   Fuera «Detalles»; número delante del nombre; letra de sesión sin caja.
4. **12-oct** — `stages-editor-4.html`: **rótulo** pegado a las pestañas en vez de
   tarjeta de resumen y título, «ahora» como **barrita** dentro de la pestaña,
   **tramo** de semanas (la barrita, bajo el tramo), **sin pestañas** con una sola etapa y «Añadir etapas» con
   una línea. La explicación de la primera vez («cada pestaña es una etapa…»)
   quedó **aparcada**. Comprobado el deslizar de sesiones dentro del panel.
5. **12-oct** — `stages-editor-5.html`: en vez de pestañas, **tarjetas de etapa**
   («Etapa 2», nombre, tramo y barrita; 100 dp, caben tres y asoma la cuarta; «+»
   al final): «tienen algo más de peso». Sesiones **sueltas** debajo de la cabecera,
   tras «SESIONES DE ESTA ETAPA», y no dentro de la tarjeta: es el esqueleto del
   editor de sesión (con su `useSlidePages`), evita tres niveles de caja bajo las
   tarjetas y deja `SessionCard`/`SwipeRow` sin tocar (dentro hacían falta tarjeta
   hundida, Duplicar en otro color y recorte). La unidad la dan el rótulo, el aire
   y que todo entra deslizando junto.
