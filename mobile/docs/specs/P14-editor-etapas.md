# Spec — Editor de programa: tarjetas de etapa y sus sesiones

> Tema: programas
> En corto: En Editar programa, las etapas dejan de ser un segmentado con una segunda pulsación escondida y pasan a ser una fila de tarjetas («Etapa 2 · Acumulación · sem 5-8») que se desplaza con el dedo; debajo, la cabecera de la etapa elegida y sus sesiones sueltas, como en el editor de sesión, que siguen deslizándose, reordenándose y abriéndose como hoy.
> Inicio: 2026-10-09
> Fase P14-01 · terminado · Diseño del editor en cinco rondas con el usuario · §8
> Fase P14-02 · terminado · Cifras de una etapa: funciones puras y tests · §5.1
> Fase P14-03 · hecho · Tarjetas de etapa y rótulo · §5.2
> Fase P14-04 · hecho · Cabecera de la etapa y sus sesiones · §5.3
> Fase P14-05 · pendiente · Panel de cifras y grupos musculares · §5.4
> Fase P14-06 · hecho · Hoja «Ajustes de etapa» y «nueva etapa» · §5.5
> Fase P14-07 · hecho · Programa de una sola etapa · §5.6
> Fase P14-08 · pendiente · Que asome la etapa de al lado al deslizar · §5.7
>
> Estado: **P14-03, 04, 06 y 07 implementadas, por probar** (03-04 el
> 13-oct, 06-07 el 15-oct; todo en `main` salvo 06-07, en `feat/onboarding-caminos`).
> Falta P14-05 (panel de cifras); P14-08 sigue pendiente. El 15-oct el usuario
> rehízo P14-07 (§5.6: sin recuadro «Añadir etapas», se crea etapa desde «Ver
> plan» o el engranaje) y pidió la hoja de ajustes nueva (§5.5). Diseño: la
> maqueta que manda es
> [`docs/mockups/stages-editor-5.html`](../mockups/stages-editor-5.html) con las
> sesiones **sueltas**, y las fichas de
> [`stages-editor-6.html`](../mockups/stages-editor-6.html) F. Las anteriores
> quedan como historia (§8). El creador de etapas y el planificador van aparte,
> en [P15-creador-etapas.md](P15-creador-etapas.md); hasta que P15 exista, «nueva
> etapa» va al planificador de hoy (§5.5).

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

### 3.3 Las fichas de etapa

Rehechas el 12-oct tras probar la v5 en el móvil: las tarjetas de 100 × 72 con
«Etapa 2», nombre, tramo y barrita eran pequeñas para tanto texto y no pegaban
con el resto de la app. Ahora hablan como el onboarding y el paywall (maqueta
[`stages-editor-6.html`](../mockups/stages-editor-6.html), variante F).

- **Todas iguales** (13-oct, tras probarlas: se leen mejor aunque quepan menos):
  72 × 80 dp, radio 14, fondo `surface`, y apilan, centrados, **«ETAPA»** (`caps`
  `mutedLight`), **el número** grande (`heroName`, Barlow cursiva; en `text`, en
  `muted` si está hecha, en `blue` si es descarga) y **el tramo de semanas**
  (`label` `mutedLight`). El número, a altura de línea 34 (1,2 em: la Barlow se
  corta con menos) y 2 dp de aire a la derecha para la cursiva.
- **La elegida** se rellena de lima (de `blue` si es descarga) **siempre desde la
  esquina de arriba a la derecha**, en 450 ms, como las pestañas de Inicio
  (U13-02), venga de un toque o de deslizar la cabecera; el texto pasa a
  `onAccent` (lo pequeño, al 65 %). La que se deja se vacía en 200 ms. Las dos
  cosas arrancan al tocar, sin esperar a que la pantalla se repinte con la etapa
  nueva (la elegida vive en un valor compartido, no en el render).
- El tramo: «sem 1-4 · sem 5-8 · sem 9-11 · sem 12». Dice sin palabras que son
  trozos seguidos del mismo calendario. Se calcula con las `durationWeeks`
  previstas (no con las semanas alargadas del cliente); una sin límite es
  «sem 13+», y **después** de una sin límite ya no hay calendario: esas fichas
  dicen la duración («4 sem»).
- A la derecha, a media altura junto al número (arriba va «ETAPA»), el **punto** de la en curso (7 dp,
  `accent`; negro sobre el lima) o el **candado** rojo de 10 dp si está bloqueada
  (§5.2, quién lo ve). No coinciden nunca: la en curso no puede estar bloqueada.
  El progreso de la en curso no va en la ficha (la barrita se leía mal): lo dice
  la ceja de la cabecera.
- **Sin nombre**: ya lo dice la cabecera, justo debajo.
- **Al final, una ficha del mismo tamaño** con borde discontinuo (`muted`), sin
  fondo, y un **+** en `accent`. Abre la creación de etapa con la seleccionada
  como base (§5.5).
- **Se desplaza con el dedo** (sin imán) y **se elige tocando**: desplazar solo
  mueve la fila, no cambia de etapa. Si la elegida (por toque o por otro camino)
  queda en un borde, la fila avanza hasta que **asome media ficha de la de al
  lado**, para que no parezca la última.

### 3.4 La cabecera de la etapa

Tarjeta `surface`, radio 18, relleno 16/14:

- **Ceja** (caps 10): el estado — «EN CURSO · SEMANA 2 DE 4» en `accent` (de
  `stageWeekLabel`), «HECHA», «POR VENIR» en `muted`, «DESCARGA» en `blue` si es de
  descarga y no ha llegado — y, si está bloqueada, «· 🔒 BLOQUEADA» en rojo.
- **Título**: el número en `accent` (en `blue` si es descarga), 7 dp, y el nombre
  (900/20, una línea).
- **Meta**: «4 SEMANAS · 3 SESIONES» (o «SIN LÍMITE DE SEMANAS · 3 SESIONES»), en
  `caps` `mutedLight`, como la meta de la sesión en Inicio (decisión del 12-oct).
- A la derecha, dos botones de 36 dp (`surface2`, radio 11): **cifras** (tres
  barras horizontales, §5.4) y **ajustes** (engranaje, §5.5).

Debajo, a 20 dp, el rótulo **«SESIONES DE ESTA ETAPA»** (caps `mutedLight`, como
`secTitle`) y las sesiones (§4), con «+ Añadir sesión a **Acumulación**» como hoy
(texto `accent50`, el nombre en `accent`, sin caja). Después, **más aire** (unos
28 dp) antes de «QUÉ SESIÓN TOCA», para que cabecera y sesiones se lean como un
grupo.

**Cambiar de etapa** —tocando una ficha o **deslizando la cabecera** a los
lados— hace que la página entera (cabecera, rótulo y sesiones) salga y entre
deslizando en la dirección del cambio, con el mismo `useSlidePages` que usa el
editor de sesión al cambiar de sesión. Es lo que hace que cabecera y sesiones se
lean como una unidad sin compartir caja. **Mientras se desliza la cabecera, la
página va con el dedo** (a un quinto si no hay etapa hacia ese lado) y se apaga
al final del recorrido (opaca hasta un tercio del ancho, apagada a los nueve
décimos), solo como respuesta visual: no asoma la etapa de al lado. Al soltar
pasados 60 dp sigue saliendo y apagándose en 220 ms en el hilo de UI, sin esperar a
que React pinte la etapa nueva, que entra como siempre al estar lista; si no,
vuelve a su sitio en 200 ms. La ficha nueva se rellena al instante:
la etapa elegida vive también en un valor compartido (`sel` de `StageCards`), así
que el relleno y la recolocación de la fila no esperan a que React repinte la
página. Cambiar de etapa **no mueve el scroll** de la pantalla: la página nueva
sostiene medio segundo el alto de la vieja (sin eso la lista se montaba sin alto
y la pantalla saltaba arriba). Nunca se cambia de etapa deslizando sobre una
sesión (§4.2).

El 13-oct se probaron, en este orden, un carrusel de cabeceras que seguía al dedo,
sesiones que lo seguían fila a fila y luego en bloque, y todas las etapas montadas
de entrada con un fundido. Todo se descartó (§8, rondas 7-12): bucles, desfases,
fallos de carga, cierres de la app y, con todo montado, mucho lag al abrir y al
cambiar. Seguir al dedo queda para P14-08.

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

- Props: `stages` (`[{ id, number, range, done, deload, locked, now }]`
  ya resueltas por la pantalla), `value`, `onChange`, `onAdd`.
- `ScrollView` horizontal sin barra; el contenido sale a
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

- [ ] Programa de 6 etapas: todas las fichas iguales («ETAPA», número, tramo); la
  en curso con su punto, las hechas con el número apagado, las descargas en azul.
- [ ] Desplazar la fila no cambia de etapa; tocar una ficha la rellena de lima desde
  la esquina de arriba a la derecha y la anterior se vacía a la vez, deprisa, las
  dos al instante de tocar.
- [ ] Tocar la ficha visible del borde: la fila avanza a la vez que se rellena y
  asoma media ficha de la siguiente (o del «+»); igual hacia la izquierda.
- [ ] Detrás de la última, el «+».
- [ ] El número y el tramo caben, también con dos cifras («11», «sem 12-15»).
- [ ] Tramos: «sem 1-4 · sem 5-8…»; con una etapa sin límite, «sem 13+», y las de
  después con su duración.
- [ ] Rótulo «6 ETAPAS · 19 SEMANAS» y «19+» con una sin límite; «Ver plan ›» abre
  el planificador.
- [ ] Móvil del entrenador con un cliente: el candado sale en las bloqueadas por
  delante de la de ahora; en un programa propio no sale nunca. Móvil del cliente:
  igual que hoy.
- [ ] Elegir una descarga la rellena de azul; deslizar la cabecera rellena la nueva
  también desde arriba a la derecha.

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
  siguiente o anterior. Mientras se arrastra, la página se desplaza con el dedo y
  se apaga (worklets del gesto + `dragX`; `dragStage` para que la nueva no herede
  el desplazamiento). Al soltar, `dragX` sigue hasta salir y la salida de la
  página (`exitPage`) arranca desde donde esté; cambiando de otra forma, la de
  `useSlidePages`. Que asome la etapa de al lado es P14-08.
- Fuera `editor.sessionsOf` y `editor.stageTapHint` de los locales.

**Probar P14-04**

- [ ] Cambiar de etapa tocando una ficha y deslizando la cabecera: la página entra
  por el lado correcto y las sesiones son las de esa etapa.
- [ ] Al deslizar la cabecera, la página (cabecera y sesiones) va con el dedo hasta
  el final y se apaga al acercarse al borde; soltando antes del umbral vuelve a su
  sitio, y pasándolo sigue saliendo al momento (sin quedarse parada esperando) y
  entra la nueva cuando esté lista.
- [ ] En la primera etapa hacia la derecha y en la última hacia la izquierda, la
  página apenas se mueve y vuelve al soltar.
- [ ] Tras cambiar deslizando, volver a la etapa anterior tocando su ficha: entra
  recta, no desplazada.
- [ ] Al deslizar la cabecera, la ficha nueva se rellena (y la fila se recoloca si
  hace falta) sin esperar a que entre la página.
- [ ] Deslizar la cabecera en vertical hace scroll de la pantalla, no cambia etapa.
- [ ] Deslizar la cabecera deprisa varias veces: al parar, ficha y página son de la
  misma etapa.
- [ ] Deslizar una sesión a la derecha abre Duplicar · Eliminar como hoy; tocar
  la flecha ‹ (o cualquier otro punto de la tarjeta) la devuelve a su sitio.
- [ ] Duplicar y eliminar una sesión funcionan; la última no se puede eliminar.
- [ ] Reordenar por el asa, con autoscroll si la lista es larga.
- [ ] Una sesión abierta se cierra al cambiar de etapa y al empezar a arrastrar.
- [ ] Con la pantalla bajada, cambiar de etapa no la devuelve arriba (salvo que la
  nueva sea más corta y no quepa).
- [ ] Tocar una sesión abre su editor; volver deja la misma etapa seleccionada.
- [ ] «+ Añadir sesión a X» añade a la etapa seleccionada.
- [ ] Etapa bloqueada: ceja con «· 🔒 BLOQUEADA».
- [ ] Cabecera y sesiones se leen como un grupo: hay más aire entre «+ Añadir
  sesión» y «QUÉ SESIÓN TOCA» que dentro del grupo. Prueba de vista, sin toques.

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

### 5.5 P14-06 — Hoja «Ajustes de etapa» y «nueva etapa»

Rehecha el 15-oct a petición del usuario: la de antes tenía un botón inventado
para «sin límite», el estado al mismo nivel que un botón y los botones de abajo
sin título.

- Título **«Ajustes de etapa»**; el botón de la derecha dice **«Aceptar»**
  (`DragSheet` gana `doneLabel`; cierra igual que «Cerrar»). Se abre **solo** con
  el engranaje.
- Todo con las filas del resto de la app (`Section` + `MenuRow` / `SheetRow` de
  `MenuList`), en secciones con título:
  - **NOMBRE** — el campo de siempre. Fuera con una sola etapa (no se ve en
    ningún sitio).
  - **DERIVADA DE** — la línea de `describeRx`, si la hay (P14-05 la llevará al
    panel de cifras).
  - **DURACIÓN** — «Sin límite de semanas» con interruptor (`Switch` de
    `EditorRows`) y, si tiene límite, la fila «Semanas» con el contador (`StepField`
    `flat` dentro de la fila).
  - **ESTADO** (con dos o más etapas) — informa, no es botón: «En curso» con su
    semana (`Status`); bloqueada por el entrenador, el candado y «La abre tu
    entrenador»; si no, la fila de acción «Pasar a esta etapa».
  - **ACCESO** (entrenador, programa de un cliente, por delante de la de ahora) —
    «Bloqueada» con interruptor y la pista de siempre.
  - **ETAPAS DEL PROGRAMA** — filas con icono que cierran la hoja: **«Nueva
    etapa»** (en `accent`, «Se crea a partir de esta»), «Duplicar etapa» y
    «Eliminar etapa» (roja; no con una sola).
- **Mientras no exista el creador de P15**, «nueva etapa» (la hoja y el «+» del
  final de las fichas) navega a `StagePlanner` con `{ programId, addFrom: idx }`:
  el planificador entra con la hoja «Añadir etapas» abierta y esa etapa como base
  (estado inicial de `addOpen` y `sourceIdx`), y **al aplicar vuelve al editor**.
  En el planificador, el hueco del final dice «+ Nueva etapa».
- **Duplicar se queda en la hoja hasta P15**: el usuario decidió que duplicar será
  «crear con Igual» en el creador, pero sin creador no hay dónde. P15 lo quita.
- La hoja **no** se ha sacado a un `StageSettingsSheet` propio: solo la usa el
  editor y depende de su estado (`slide`, `holdPage`, `dragStage`). Se saca cuando
  P15 la necesite en el planificador.

**Probar P14-06**

- [ ] El engranaje abre «Ajustes de etapa» con «Aceptar» arriba; tocar la ficha
  ya elegida no abre nada.
- [ ] Nombre, semanas, el interruptor de sin límite, pasar a esta etapa, el
  candado (entrenador) y eliminar funcionan.
- [ ] El estado se lee como información, no como botón; «Pasar a esta etapa» solo
  sale en una etapa que no es la de ahora ni está bloqueada.
- [ ] «Nueva etapa» (hoja y «+» de las fichas) abre el planificador con la hoja de
  añadir abierta y esa etapa como base; al aplicar vuelve al editor.
- [ ] «Ver plan» → «+ Nueva etapa» abre la hoja de añadir; al aplicar se queda en
  el planificador.
- [ ] Duplicar sigue funcionando.

### 5.6 P14-07 — Programa de una sola etapa

Rehecha por el usuario el 15-oct (sustituye al recuadro «Añadir etapas» del
diseño anterior):

- **Sin fichas de etapa.** El rótulo dice **«PROGRAMA SIN ETAPAS»**, con «Ver
  plan ›» a la derecha como siempre.
- La cabecera, igual que con varias, salvo:
  - ceja **«EN CURSO · SEMANA 3 DE 8»**, o **«EN CURSO · SEMANA 3»** si no tiene
    límite (`stageWeekLabel`, la misma de siempre);
  - título **sin número** y con **el nombre del programa** (el de la etapa no se
    enseña);
  - sin gesto de cambiar de etapa.
- Debajo, **«SESIONES»** (`editor.sectionSessions`) y «+ Añadir sesión», sin
  nombre de etapa.
- **Crear la segunda etapa**: desde «Ver plan» («+ Nueva etapa») o desde el
  engranaje («Nueva etapa», §5.5). Al volver con dos etapas aparecen las fichas y
  el rótulo de siempre.
- **En Programa** (la tarjeta desplegada, `ProgramCardDetail`, que es también la
  de la ficha del cliente) tampoco sale «Esta etapa» con una sola etapa, tenga
  límite o no (antes solo se quitaba sin límite).

**Probar P14-07**

- [ ] Programa de una etapa: sin fichas, «PROGRAMA SIN ETAPAS», ceja «EN CURSO ·
  SEMANA N DE M» (o «SEMANA N» sin límite), título = nombre del programa, sin número.
- [ ] Deslizar la cabecera no hace nada; «SESIONES» y «+ Añadir sesión».
- [ ] La hoja de ajustes no enseña Nombre, Estado ni Eliminar.
- [ ] Crear una etapa desde el engranaje: al aplicar vuelve al editor con dos fichas
  y sus tramos.
- [ ] Borrar etapas hasta dejar una: vuelve la vista de una sola.
- [ ] En Programa (y en la ficha del cliente), un programa de una etapa no enseña
  «Esta etapa», tenga límite o no; las cifras siguen.

### 5.7 P14-08 — Que asome la etapa de al lado al deslizar

Hoy, al deslizar la cabecera, la página se desplaza con el dedo y cambia de etapa
al soltar, pero la de al lado no asoma detrás. Que asome sería solo estético, y el
13-oct (§8, rondas
7-12) salió caro: cuatro intentos con bucles, fallos de carga y cierres de la app.
Si se retoma: una sola fuente de la etapa elegida, nada que se monte en el gesto,
ningún efecto que mueva una cosa en respuesta a otra, y medir antes en el móvil
(abrir el editor y cambiar de etapa no pueden ir más lentos que hoy).

## 6. i18n

En `src/locales/es.json` **y** `en.json`, añadiendo línea a línea (nunca
reformatear el JSON):

- Nuevas: rótulo (`editor.stagesLabel` con `{{count}}` y `{{weeks}}`, la variante
  abierta y `editor.stagesLabelNone`), hoja de ajustes (`editor.stageStateNow`,
  `stageMoveHere(Sub)`, `stageActionsLabel`, `stageNew(Sub)`, `stageNoLimit(Hint)`), tramo (`editor.stageRange`, `editor.stageRangeOpen`, `editor.stageRangeOne`),
  «ETAPA» (`editor.stageWord`), «SESIONES DE ESTA ETAPA» y «SESIONES», ceja (hecha, por venir, descarga, bloqueada), meta, «Todo el
  programa», «Añadir etapas» y su línea, «Nueva etapa desde esta», el panel de cifras
  (comparar, de dónde sale, las tres cifras, «no hay con qué comparar»).
- Fuera (solo las usa el editor): `editor.stageTapHint`, `editor.sessionsOf`,
  `editor.summaryProgram`, `editor.programSummary*`, `editor.sectionStages`,
  `editor.stageActiveBadge`, `stageActivateBtn`, `stageActiveHint`, `stageIsActive`,
  `stageAccessOpen` (quitadas el 15-oct). `editor.sectionSessions` se queda: la
  usa la vista de una sola etapa. `weeksShort`, `weeksOpen` y `stageDuplicateBtn`
  se usan fuera: se quedan.

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
6. **12-oct** — `stages-editor-6.html`, tras probar la v5 en el móvil: las tarjetas
   eran pequeñas para tanto texto y no pegaban con el resto de la app; la barrita
   de la en curso se leía mal (pasó a un punto). Selector en la voz del onboarding:
   números (A), tramos (B), fichas (C), y dos intermedias (D, E). Elegida una C
   con «ETAPA» pequeño detrás del número, por la base (F). La cabecera con el
   nombre se queda como está «por ahora».
7. **13-oct** — primera prueba de P14-03/04 en el móvil: todas las fichas en el
   formato de la elegida (caben menos, se leen mejor) y el relleno siempre desde
   arriba a la derecha; la cabecera, un carrusel que sigue al dedo con las
   vecinas asomando (deslizarla no respondía hasta soltar); cambiar de etapa no
   mueve el scroll; la flecha ‹ de una sesión abierta, pulsable.
8. **13-oct (2)** — segunda prueba: la ficha que se deja tardaba en vaciarse; tocar
   una ficha cambiaba la cabecera de golpe; las sesiones entraban después y por la
   derecha, poco fluido. Ahora la ficha vieja se vacía al tocar, el carrusel viaja
   hasta la tocada, la fila de fichas deja asomar la vecina en los bordes y las
   sesiones salen y entran fila a fila colgadas del carrusel, como las hojas.
9. **13-oct (3)** — tercera prueba: el fila a fila se sentía bien cuando iba, pero
   con fallos de carga y visuales; la ficha se rellenaba tarde al deslizar, y
   deslizar deprisa dejaba carrusel y etapa en bucle («Maximum update depth
   exceeded»). Ahora el carrusel es la única fuente de la etapa, que cambia a
   mitad de recorrido (en el hilo de UI para las fichas), y las sesiones vuelven
   a ir en bloque, deslizando y fundiéndose.
10. **13-oct (4)** — cuarta prueba: tocar la ficha del borde la recolocaba tarde
    (se rellenaba y luego se movía); las sesiones no iban con la cabecera; a veces
    la app se cerraba deslizando. Ahora la fila de fichas se mueve desde el hilo de
    UI junto con el relleno, y las sesiones se colocan según el carrusel, sin
    animaciones de salida (sospechosas del cierre; sin registro del error para
    confirmarlo).
11. **13-oct (5)** — tras cuatro rondas con fallos de carga, visuales, desfases y
    cierres de la app, se simplifica: se cambia de etapa solo tocando una ficha,
    todas las etapas se montan al abrir y el cambio es un fundido corto. Deslizar
    queda para después, sobre esta base (P14-08).
12. **13-oct (6)** — con todas las etapas montadas, mucho lag al abrir el editor y
    al cambiar de etapa. Se vuelve al sistema del principio (cabecera con
    `Gesture.Pan` y página que entra con `useSlidePages`), que iba bien; se quedan
    de estas rondas las fichas iguales con relleno desde arriba a la derecha, el
    relleno y la recolocación al instante (valor compartido), el borde que deja
    asomar la vecina, el scroll que no vuelve arriba y la flecha ‹ pulsable.
13. **13-oct (7)** — el sistema del principio va bien; se le añade respuesta al
    deslizar: la página se desplaza con el dedo (sin asomar la de al lado) y, al
    soltar pasado el umbral, sale desde ahí y entra la nueva como siempre.
14. **13-oct (8)** — la página se quedaba a mitad (iba a media velocidad) y, al
    soltar, parada hasta que cargaba la nueva. Ahora va 1:1 con el dedo, se apaga
    al final y al soltar sigue saliendo sin esperar.
