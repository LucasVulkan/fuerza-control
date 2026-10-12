# Spec — Editor de programa: las etapas como pestañas de una carpeta

> Tema: programas
> En corto: En Editar programa, las etapas dejan de ser un segmentado con una segunda pulsación escondida y pasan a ser las pestañas de una carpeta: cada pestaña es un tramo de semanas del programa y, debajo, la tarjeta de la etapa lleva dentro sus sesiones, que siguen deslizándose, reordenándose y abriéndose como hoy.
> Inicio: 2026-10-09
> Fase P14-01 · terminado · Diseño del editor en cuatro rondas con el usuario · §8
> Fase P14-02 · pendiente · Cifras de una etapa: funciones puras y tests · §5.1
> Fase P14-03 · pendiente · Pestañas de etapa y rótulo · §5.2
> Fase P14-04 · pendiente · Tarjeta de la etapa con sus sesiones dentro · §5.3
> Fase P14-05 · pendiente · Panel de cifras y grupos musculares · §5.4
> Fase P14-06 · pendiente · Hoja de Ajustes y «nueva etapa» · §5.5
> Fase P14-07 · pendiente · Programa de una sola etapa · §5.6
>
> Estado: **diseño cerrado, sin implementar** (12-oct-2026). Cuatro rondas con el
> usuario (9 y 12-oct); la maqueta que manda es
> [`docs/mockups/stages-editor-4.html`](../mockups/stages-editor-4.html). Las
> anteriores (`stages-v2.html` §1, `stages-editor-2.html`, `stages-editor-3.html`)
> quedan como historia (§8). El creador de etapas y el planificador van aparte, en
> [P15-creador-etapas.md](P15-creador-etapas.md); hasta que P15 exista, las
> entradas a «nueva etapa» van al planificador de hoy (§5.5).
>
> Las pestañas, «a confirmar cuando se vean en el móvil» (palabras del usuario): si
> en el dispositivo no convencen, la alternativa con más números era la línea de
> segmentos de `stages-editor-3.html`.

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
  pasa a pestañas es cosa de P15 §6.7. Por eso `StageSelector` no se borra.
- El planificador (`StagePlannerScreen`) no cambia salvo el parámetro de entrada de
  §5.5.

## 3. Cómo queda (diseño cerrado)

De arriba abajo, con dos o más etapas:

```
‹        EDITAR PROGRAMA                ✓
            Fuerza Base
6 ETAPAS · 19 SEMANAS            Ver plan ›     ← rótulo, pegado a las pestañas
      ┌─────┐┏━━━━━┓┌─────┐┌─────┐┌─────┐
      │  ✓  │┃  2  ┃│ 3 🔒│ 4 🔒│  5  │┊ + ┊
      │sem1-4│┃sem5-8┃│sem9-11│sem 12│...  ┊nueva┊
      └─────┘┃ ▬▬─ ┃└─────┘└─────┘└─────┘
╭─────────────┛     ┗──────────────────────╮   ← la pestaña se funde con el panel
│ EN CURSO · SEMANA 2 DE 4       [≡] [⚙]   │
│ 2 Acumulación                            │
│ 4 semanas · 3 sesiones                   │
│ ┌──────────────────────────────────────┐ │
│ │ A  Pierna y empuje               ⠿   │ │   ← sesiones hundidas (bg sobre surface)
│ │    5 ejercicios · 22 series · 75 min │ │
│ └──────────────────────────────────────┘ │
│   … B, C …                               │
│       + Añadir sesión a Acumulación      │
╰──────────────────────────────────────────╯
QUÉ SESIÓN TOCA
[ Rotación | Semanal | Libre ]
```

### 3.1 Fuera

- La tarjeta de resumen (`summaryCard`) y el título «ETAPAS».
- El texto de ayuda «toca otra vez para editar» (`editor.stageTapHint`).
- El título «SESIONES DE …» (`editor.sessionsOf`).
- La segunda pulsación sobre la etapa seleccionada.
- «N entrenos por semana»: ya lo dice la meta de la tarjeta.

### 3.2 El rótulo

Una línea pegada a las pestañas (8 dp por debajo hasta las pestañas): a la
izquierda, en caps `mutedLight`, «**6** ETAPAS · 19 SEMANAS» (el número en
`text`), con «+» si alguna etapa es sin límite («19+ SEMANAS»,
`programTotals().open`); a la derecha, «Ver plan ›» en `accent`, que navega a
`StagePlanner`.

### 3.3 Las pestañas

- Una pestaña por etapa, **62 dp** de ancho (que quepa «sem 12-15»), 46 dp de alto
  y radio 12 arriba; la seleccionada, 50 dp y radio 14, del color del panel
  (`surface`), y **se funde con él**: dos esquinas cóncavas de 14 dp a sus lados,
  abajo. Las demás, `#171717` (entre `bg` y `surface`; token nuevo, §5.2).
- Dentro, dos líneas centradas: el **número** (900/13; `accent` la seleccionada,
  `mutedLight` el resto, `muted` + ✓ las hechas, `blue` las descargas) y el
  **tramo de semanas** (500/10, `muted`; `mutedLight` en la seleccionada).
- **Tramo, no duración**: «sem 1-4 · sem 5-8 · sem 9-11 · sem 12». Dice sin
  palabras que son trozos seguidos del mismo calendario. Se calcula con las
  `durationWeeks` previstas (no con las semanas alargadas del cliente); una etapa
  sin límite es «sem 13+», y **después** de una sin límite ya no hay calendario:
  esas pestañas dicen la duración («4 sem»).
- **En curso**: una **barrita de progreso** de 30×3 dp **debajo del tramo**
  (tinte `accent` al 18 % de fondo, `accent` de relleno) con las sesiones hechas
  de la etapa sobre las esperadas (`stageStatus().done / expected`). Sin límite,
  sin barrita. Decidido por el usuario el 12-oct (la otra opción era bajo el número).
- **Candado**: icono rojo de 9 dp junto al número en las bloqueadas (§5.2, quién
  lo ve).
- **Al final, una pestaña «+ nueva»** con borde discontinuo (`border`) sin fondo,
  «+» y «nueva» en `accent`. Abre la creación de etapa con la seleccionada como
  base (§5.5).
- **Se arrastran con el dedo** y la seleccionada queda **siempre centrada** (imán
  de 62 dp): soltar selecciona la que queda en el centro; tocar una la selecciona y
  la centra. La primera y la última también se centran (relleno a los lados). Un
  degradado de 26 dp a `bg` en cada borde dice que hay más.

### 3.4 La tarjeta de la etapa (la carpeta)

Panel `surface`, radio 18, relleno 16/14/14. Arriba:

- **Ceja** (caps 10): el estado — «EN CURSO · SEMANA 2 DE 4» en `accent` (de
  `stageWeekLabel`), «HECHA», «POR VENIR» en `muted`, «DESCARGA» en `blue` si es de
  descarga y no ha llegado — y, si está bloqueada, «· 🔒 BLOQUEADA» en rojo.
- **Título**: el número en `accent` (en `blue` si es descarga), 7 dp, y el nombre
  (900/20, una línea).
- **Meta**: «4 semanas · 3 sesiones» (o «Sin límite de semanas · 3 sesiones»).
- A la derecha, dos botones de 36 dp (`surface2`, radio 11): **cifras** (tres
  barras horizontales, §5.4) y **ajustes** (engranaje, §5.5).

Debajo, a 14 dp, **las sesiones** (§4) y «+ Añadir sesión a **Acumulación**» como
hoy (texto `accent50`, el nombre en `accent`, sin caja).

**Cambiar de etapa** —tocando o arrastrando las pestañas, o **deslizando la
cabecera de la tarjeta** a los lados— hace que la tarjeta entera salga y entre
deslizando en la dirección del cambio (~320 ms). Nunca se cambia de etapa
deslizando sobre una sesión (§4.2).

## 4. Las sesiones dentro de la carpeta

### 4.1 Todo lo de hoy sigue igual

La lista es la misma `Sortable.Grid` con las mismas `SessionCard` (`SwipeRow`):

| Hoy | Dentro de la carpeta |
|---|---|
| Tocar → `SessionEditor` | igual |
| Deslizar a la derecha → Duplicar · Eliminar | igual; cambia el color del botón neutro (§4.3) |
| La última sesión de la etapa no se puede eliminar | igual |
| Una tarjeta abierta a la vez (`openRowId`); se cierra al arrastrar o al cambiar de etapa | igual, y también se cierra al cambiar de etapa |
| Reordenar arrastrando **solo** desde el asa (`Sortable.Handle`) | igual, con el mismo autoscroll (`scrollableRef`) |
| `handleReorder` → `reorderSessionsInStage` | igual |
| Duplicar inserta tras el original y eliminar reetiqueta (P49) | igual |

### 4.2 Los gestos no se pisan

- **Deslizar una sesión** (derecha) es de `SwipeRow`. **Cambiar de etapa** se hace
  en las pestañas o en la **cabecera** de la tarjeta (ceja, título y meta), nunca
  en la zona de sesiones.
- El gesto de la cabecera solo se activa en horizontal (activa a ±20 dp en x,
  falla a ±10 dp en y) para no robarle el scroll vertical a la pantalla, y no
  arranca sobre los dos botones.
- Reordenar sigue siendo exclusivo del asa, así que tampoco choca con nada.

### 4.3 Lo que cambia de aspecto

- **Tarjeta hundida**: fondo `bg` (no `surface`) — se pasa por `style` a
  `SwipeRow`, que ya lo admite. La letra sigue en `accent` sin caja.
- **El botón neutro (Duplicar) en `bg`**: el `surface2` de siempre se perdería
  sobre el panel `surface` (1,1:1). `SwipeRow` gana una prop para el fondo del botón
  neutro (por defecto `surface2`, sin cambiar el editor de sesión). El de eliminar
  sigue en `tint.red30`.
- **Recorte**: la tarjeta deslizada no puede salirse del panel. Cada fila va en un
  contenedor con `overflow: 'hidden'` y radio `md` (10). Comprobar en Android que
  el recorte no corta la sombra/escala de la tarjeta levantada al reordenar
  (casilla en §5.3).

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

### 5.2 P14-03 — Pestañas de etapa y rótulo

Componente nuevo `src/components/ui/StageTabs.jsx`:

- Props: `stages` (`[{ id, number, range, done, deload, locked, progress }]`
  ya resueltas por la pantalla), `value`, `onChange`, `onAdd`.
- `ScrollView` horizontal, `snapToInterval={62}`, `decelerationRate="fast"`,
  relleno lateral `(ancho − 62) / 2` para poder centrar la primera y la última;
  `onMomentumScrollEnd` (y `onScrollEndDrag` sin inercia) selecciona la del centro;
  al cambiar `value` desde fuera, `scrollTo` animado. La pestaña «+ nueva» va al
  final del contenido y **no se selecciona** al soltar encima: solo con un toque.
- Las esquinas cóncavas de la seleccionada con `react-native-svg` (dos `Path` de
  14×14 en `surface`); en RN no hay degradado radial.
- Token nuevo `tabOff: '#171717'` en `formaFit` (y uno equivalente en los temas
  legados: el `surface` de cada uno oscurecido; si no convence, `bg`).
- Degradados laterales con el componente de degradado que ya use la app (si no hay,
  `react-native-svg` `LinearGradient`).
- **Quién ve el candado**: en el móvil del cliente, `isStageLocked`; en el del
  entrenador, `stage.locked && idx > activeIdx` en un programa de un cliente (la
  regla de `canLockStage`). En un programa propio, nunca.
- En `ProgramEditorScreen`: fuera `summaryCard`, `secTitle` de Etapas,
  `StageSelector` y `stageHint`; dentro el rótulo (§3.2) y `StageTabs`.

**Probar P14-03**

- [ ] Programa de 6 etapas: se ven unas 5 pestañas, la en curso con su barrita, las
  hechas con ✓; al arrastrar y soltar, la del centro queda seleccionada y la
  tarjeta cambia.
- [ ] Tocar una pestaña lejana la centra y la selecciona.
- [ ] La primera y la última se pueden centrar; detrás de la última, «+ nueva».
- [ ] Soltar con «+ nueva» en el centro no crea nada: vuelve a la última.
- [ ] Tramos: «sem 1-4 · sem 5-8…»; con una etapa sin límite, «sem 13+», y las de
  después con su duración.
- [ ] Rótulo «6 ETAPAS · 19 SEMANAS» y «19+» con una sin límite; «Ver plan ›» abre
  el planificador.
- [ ] Móvil del entrenador con un cliente: el candado sale en las bloqueadas por
  delante de la de ahora; en un programa propio no sale nunca. Móvil del cliente:
  igual que hoy.
- [ ] La barrita, bajo el tramo de la pestaña en curso, se llena con las sesiones
  hechas; en una etapa sin límite no sale.
- [ ] Las pestañas en sí: ¿convencen en el móvil? (si no, segmentos, §8).

### 5.3 P14-04 — Tarjeta de la etapa con sus sesiones dentro

- Cabecera (§3.4) con ceja, título y meta; los dos botones (el de cifras sin
  función hasta P14-05, o se deja fuera hasta entonces).
- La lista de §4 dentro del panel, hundida, con el recorte y el botón neutro en
  `bg` (prop nueva de `SwipeRow`).
- Transición al cambiar de etapa: el bloque va con `key` = id de la etapa y
  `entering`/`exiting` de Reanimated en la dirección del cambio
  (`FadeInRight`/`FadeInLeft` o un `entering` propio de ~40 dp). Al cambiar se cierra
  `openRowId`.
- Gesto de la cabecera con `react-native-gesture-handler` (`Gesture.Pan`,
  `activeOffsetX([-20, 20])`, `failOffsetY([-10, 10])`): a más de 60 dp, etapa
  siguiente o anterior; durante el arrastre la tarjeta sigue al dedo a ~45 %.
- Fuera `editor.sessionsOf` y `editor.stageTapHint` de los locales.

**Probar P14-04**

- [ ] Cambiar de etapa por pestaña, arrastre de pestañas y deslizando la cabecera:
  la tarjeta entra por el lado correcto y las sesiones son las de esa etapa.
- [ ] Deslizar la cabecera en vertical hace scroll de la pantalla, no cambia etapa.
- [ ] Deslizar una sesión a la derecha abre Duplicar · Eliminar dentro del panel,
  recortada; Duplicar se lee sobre el panel.
- [ ] Duplicar y eliminar una sesión funcionan; la última no se puede eliminar.
- [ ] Reordenar por el asa dentro del panel, con autoscroll si la lista es larga; el
  recorte no corta la tarjeta levantada (Android e iOS).
- [ ] Una sesión abierta se cierra al cambiar de etapa y al empezar a arrastrar.
- [ ] Tocar una sesión abre su editor; volver deja la misma etapa seleccionada.
- [ ] «+ Añadir sesión a X» añade a la etapa seleccionada.
- [ ] Etapa bloqueada: ceja con «· 🔒 BLOQUEADA».

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
- **Mientras no exista el creador de P15**, «nueva etapa» (la hoja y la pestaña
  «+ nueva») navega a `StagePlanner` con `{ programId, addFrom: idx }`, y el
  planificador abre su hoja «Añadir etapas» con esa etapa como base
  (`setSourceIdx(addFrom)` + `setAddOpen(true)` al montar). Es el único cambio en el
  planificador.
- **Duplicar se queda en la hoja hasta P15**: el usuario decidió que duplicar será
  «crear con Igual» en el creador, pero sin creador no hay dónde. P15 lo quita.

**Probar P14-06**

- [ ] El engranaje abre Ajustes; tocar la etapa ya seleccionada no abre nada.
- [ ] Nombre, semanas, sin límite, activar, candado y eliminar funcionan como hoy.
- [ ] «Nueva etapa desde esta» y la pestaña «+ nueva» abren el planificador con la
  hoja de añadir abierta y esa etapa como base.
- [ ] Duplicar sigue funcionando.

### 5.6 P14-07 — Programa de una sola etapa

- **Sin pestañas ni rótulo.** La tarjeta sola, con la ceja «SIN LÍMITE DE SEMANAS»
  (o «N SEMANAS») y el título **«Todo el programa»** en vez del nombre de la etapa
  (repetiría el del programa), sin número; meta «3 sesiones por semana». Los dos
  botones igual. Sin gesto de cambiar etapa.
- Debajo de la tarjeta, a 12 dp, un recuadro con borde discontinuo (`border`,
  radio 12): un cuadrado discontinuo con «+», **«Añadir etapas»** en `accent` y una
  sola línea: «Bloques de varias semanas para trabajar un objetivo concreto.» Sin
  ejemplo ni más texto (decisión del usuario). Abre lo mismo que §5.5.
- Al pasar a dos etapas aparecen las pestañas y el rótulo, y el recuadro se va.

**Probar P14-07**

- [ ] Programa nuevo de una etapa: sin pestañas, «Todo el programa», «Añadir etapas».
- [ ] Añadir una etapa desde ahí: al volver hay pestañas con dos tramos.
- [ ] Borrar etapas hasta dejar una: vuelve la vista de una sola.

## 6. i18n

En `src/locales/es.json` **y** `en.json`, añadiendo línea a línea (nunca
reformatear el JSON):

- Nuevas: rótulo (`editor.stagesLabel` con `{{count}}` y `{{weeks}}`, y la variante
  abierta), tramo (`editor.stageRange`, `editor.stageRangeOpen`, `editor.stageRangeOne`),
  pestaña nueva, ceja (hecha, por venir, descarga, bloqueada), meta, «Todo el
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
- El editor de sesión: el botón neutro de `SwipeRow` sigue en `surface2` por defecto.

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
