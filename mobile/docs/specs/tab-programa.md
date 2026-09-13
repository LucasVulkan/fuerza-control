# Spec — El tab «Programa»

> Tema: ui
> En corto: El Historial deja de ser pestaña y se mete dentro de Progresión; su hueco en la barra lo ocupa «Programa», una pantalla plana que dice dónde vas del programa y guarda sus tres acciones, y así el tab de Sesiones se queda con las sesiones de entreno y nada más.
> Fase U21 · hecho · Limpieza previa: fuera el bloque de conexiones duplicado y el mapeo muerto · §3
> Fase U22 · hecho · El tab «Programa»: la tarjeta, las etapas y las acciones · §4
> Fase U23 · hecho · El Historial entra en Progresión · §5
>
> **Probar en dispositivo.** Que se encuentre el programa. Hoy se llega a él
> bajando hasta el final del tab de Sesiones, y eso lo hace todo el mundo sin
> querer; con un tab propio hay que ir a buscarlo. Si a los dos días nadie ha
> entrado en «Programa», el tab no se ha aprendido.
>
> **Probar en dispositivo.** La lista de etapas inline, con un programa de 5-6
> etapas y alguna bloqueada. Antes era una hoja que se abría a propósito y ahora
> está siempre a la vista, así que cambiar de etapa pasa a pedir confirmación
> (§4.3): lo que hay que medir es si **el aviso estorba** a quien cambia de
> etapa a menudo, o si al revés hace falta también en el aviso de fin de etapa.
>
> **Probar en dispositivo.** Con la etapa terminada: que el aviso de avanzar de
> etapa siga viéndose. Se queda en Sesiones a propósito (§4.4) y el tab de
> Programa lleva un punto; si la gente lo ignora en los dos sitios, la decisión
> está mal y el aviso tiene que volver a ser modal.
>
> Estado: **las tres fases implementadas** (13-sep-2026), pendientes de prueba en dispositivo. Sale de una sesión de
> análisis Opus + usuario sobre el ruido del tab de Sesiones, y de una segunda
> pasada del usuario que **quitó el control segmentado** de la propuesta
> original: el tab es plano y el visualizador sigue siendo la pantalla que ya
> es. Con eso se cayó la fase que extraía el visualizador a componente —unas 250
> líneas de refactor— y la spec pasó de cuatro fases a tres. Las tres son
> **independientes entre sí**: la U21 es borrado puro, la U22 es la idea, y la
> U23 es la única de la que uno puede arrepentirse, así que va la última.
>
> **Reemplaza la §4.1 y la §4.2 de [program-card.md](program-card.md)** —editar
> y archivar dejan el visualizador y se mudan al tab, que pasa a ser donde vive
> todo lo que se le puede hacer al programa. El resto de esa spec sigue vigente:
> la tarjeta no cambia por dentro, solo de pantalla. De
> [home-sessions.md](home-sessions.md) se cae la §4 entera (el programa al final
> de la Home) y el bloque de conexiones. La lista plegable de
> [home-sesiones-plegables.md](home-sesiones-plegables.md) **no se toca**: es
> justo lo que se queda. [program-view.md](program-view.md) **no se toca en
> absoluto**: el visualizador sigue siendo una pantalla del stack y se sigue
> entrando desde un sitio, ahora una fila con su nombre.

---

## 1. Problema

El tab de Sesiones hace cinco cosas. De arriba abajo: la tira de la semana, el
aviso de etapa terminada, la lista de sesiones, el botón de sesión libre, la
tarjeta del programa y **un bloque de conexiones que es una copia literal de dos
filas del menú `≡`**. Son 1.342 líneas en
[`HomeScreen.jsx`](../../src/screens/HomeScreen.jsx) y un scroll que hay que
recorrer entero para llegar a lo que menos se usa.

Y el programa, que es lo que peor cabe ahí, es lo que peor se cuenta. Vive en una
tarjeta de 330 px al final del scroll, donde tiene sitio para el nombre, un
número de ciclo, la etapa en curso y tres cifras. Todo lo demás —qué etapas
tiene, en cuál estás, cuáles están bloqueadas, qué se puede hacer con el
programa— está detrás de una hoja modal, de un toque en el nombre, o del `⋯` de
otra pantalla.

Mientras tanto, **la ficha de cliente ya resolvió esto**. Su vista de detalle
([`ClientsScreen.jsx:2413`](../../src/screens/ClientsScreen.jsx#L2413)) tiene un
tab de Programa cuyo contenido es exactamente esto: la tarjeta, no navegable, con
las acciones colgando de ella. El lado entrenador lleva meses con la estructura
que al lado atleta le falta. Esta spec los hace converger.

### 1.1 Lo que mide el problema

| Síntoma | Dónde |
|---|---|
| Dos filas de conexiones duplicadas del menú `≡`, con subtítulos **peores** que los del menú | [`HomeScreen.jsx:905-940`](../../src/screens/HomeScreen.jsx#L905) vs [`AppHeader.jsx:382-400`](../../src/components/AppHeader.jsx#L382) |
| Las etapas del programa solo se ven abriendo una hoja modal | [`HomeScreen.jsx:395-434`](../../src/screens/HomeScreen.jsx#L395) |
| Las acciones del programa están repartidas en tres gestos distintos de dos pantallas | tarjeta (nombre → ver), footer del visualizador (editar), `⋯` de su cabecera (archivar) |
| Un mapeo de navegación a un tab que nadie llama | [`navigationRef.js:21`](../../src/navigation/navigationRef.js#L21) |
| El Historial apila calendario, ámbito y pills de etapa antes de la primera sesión | [`HistoryScreen.jsx:431-505`](../../src/screens/HistoryScreen.jsx#L431) |

---

## 2. Decisiones cerradas con el usuario (no re-litigar)

1. **El tab se llama «Programa», no «Mi programa».** El «mi» solo haría falta si
   hubiera ambigüedad, y la barra pro ya distingue Programa / Plantillas /
   Clientes.
2. **La ruta se llama `MyProgram`.** `Program` ya es la de Plantillas
   ([`RootNavigator.jsx:115`](../../src/navigation/RootNavigator.jsx#L115)) y el
   nombre de ruta es lo único que no se puede repetir.
3. **Sin control segmentado.** El tab es **una sola pantalla plana**: dónde vas.
   Un conmutador de dos posiciones para una pantalla que cabe entera en un
   scroll es un control que hay que aprender para no ganar nada.
4. **El visualizador no se toca.** Sigue siendo `ProgramDetailScreen`, una
   pantalla del stack, y se sigue entrando desde un solo sitio. Lo único que
   cambia es que ese sitio pasa de ser un gesto sobre el nombre de la tarjeta a
   ser **una fila que pone «Ver programa»**.
5. **Editar vive en el tab.** Ya no hace falta entrar al visualizador para
   editar: el tab es la pantalla del programa. Ver §4.3.
6. **Sesiones no pierde el aviso de etapa terminada.** Es lo único con caducidad
   de la app y es lo que bloquea el entreno de mañana: es una sesión, no un
   programa. Ver §4.4.
7. **Las etapas salen de la hoja modal y se pintan inline**, y a cambio
   **cambiar de etapa pasa a pedir confirmación**. En una hoja que abres a
   propósito, elegir ya tenía peso; en una lista siempre visible, no. Ver §4.3.
8. **El mensaje de «no hay programa» sale en los dos tabs.** Sesiones porque no
   tiene sesiones que listar, Programa porque no tiene programa que enseñar. Ver
   §4.6.
9. **El Historial va el último.** Es la única fase reversible con coste, y la
   que puede empeorar la lectura si se hace mal (§5.1).

### 2.1 Lo que se descartó por el camino

| Idea | Por qué se cae |
|---|---|
| Control segmentado «Dónde voy» / «El programa» dentro del tab | Era la propuesta original. Obliga a extraer el visualizador a componente (~250 líneas de refactor) y deja **dos selectores de etapa con significado opuesto** en la misma pantalla: uno cambia la etapa activa y el otro solo la que miras. Se cae entero, y con él la fase que lo sostenía |
| Que el tab «Programa» sustituya a `ProgramDetailScreen` | La pantalla la siguen necesitando Plantillas y la ficha de cliente, que miran programas que **no** son el activo |
| Dejar también «Editar» en el pie del visualizador | Sus tres condiciones (`isMineActive && !isTrainerProgram`) solo se cumplen para el programa **activo y propio**, que es exactamente el del tab. Duplicarlo sería una segunda puerta a la misma pantalla para el mismo caso |
| Mantener la tarjeta navegable en el tab | La fila «Ver programa» ya dice adónde va, con palabras. Dos puertas al mismo sitio a 200 px de distancia no ayudan: la tarjeta deja de ser pulsable, igual que en la ficha de cliente (§3.5 de [program-card.md](program-card.md)) |
| Mover el aviso de etapa terminada al tab de Programa | Deja el tab de Sesiones diciendo «te toca la sesión B» cuando lo que pasa es que la etapa se acabó |
| Mover la tira `L M X J V S D` al Historial | Es lo más parecido a historial que queda en Sesiones, pero el usuario la pidió desnuda y arriba a propósito. Fuera de alcance |
| Tres tabs de programa para el usuario pro (Programa · Plantillas · Clientes) | No se cae: ya son tres cosas distintas y ya están rotuladas. Lo que **sí** se vigila es que sigan siendo cinco tabs y no seis — por eso el Historial tiene que irse antes de que Programa entre |

---

## 3. Fase U21 — Limpieza previa

Borrado puro, sin nada nuevo. Es independiente del resto de la spec y **se puede
hacer aunque se descarte todo lo demás**.

### 3.1 El bloque de conexiones de la Home

[`HomeScreen.jsx:905-940`](../../src/screens/HomeScreen.jsx#L905) pinta una
sección `CONEXIONES` con dos `MenuRow`: Drive y Entrenador. El menú `≡` de
[`AppHeader.jsx:382-400`](../../src/components/AppHeader.jsx#L382) ya tiene esa
misma sección, con las **mismas dos filas**, los **mismos destinos**
(`DriveBackup` y `TrainerConnection`) y subtítulos mejores — el del menú dice
`Marcos Ruiz · por código`, el de la Home dice `Entrenador`.

Se borra el bloque y con él:

- el cálculo de `driveConnected`, `driveWarn`, `driveBackupRel`, `driveSub`,
  `trainerOk`, `trainerWarn`, `trainerTitle` y `trainerSub`
  ([`HomeScreen.jsx:584-606`](../../src/screens/HomeScreen.jsx#L584));
- el helper `formatBackupTime` ([`:45`](../../src/screens/HomeScreen.jsx#L45)),
  que no lo usa nadie más;
- la variante `dim` de `SectionHeader` si no queda ningún otro uso;
- siete claves de i18n en los dos idiomas (§6).

⚠️ `driveBackup` y `clientSync` **siguen leyéndose** del store para otras cosas
(`clientSync.pendingOverrides` marca las sesiones adaptadas), así que no se caen
los selectores enteros. `MenuRow`, `Status` y `RowIcon` también siguen
importándose: los usan el selector de etapa y las hojas de sesión libre.

### 3.2 El mapeo muerto

[`navigationRef.js:21`](../../src/navigation/navigationRef.js#L21) mapea
`'history'` al tab `History`. Nadie llama a `navigate('history')` en todo el
repo. Se borra ahora porque en la U22 ese tab deja de existir y el mapeo pasaría
de muerto a roto.

---

## 4. Fase U22 — El tab «Programa»

### 4.1 La barra de tabs

`History` sale, `MyProgram` entra en su sitio (el segundo), y Progresión recibe
el historial en la U23. Siguen siendo tres tabs para el usuario normal y cinco
para el pro:

| | Antes | Después |
|---|---|---|
| 1 | Sesión · `barbell` | Sesión · `barbell` |
| 2 | Historial · `time` | **Programa · `layers`** |
| 3 | Progresión · `stats-chart` | Progresión · `stats-chart` |
| 4 | Clientes · `people` (pro) | Clientes · `people` (pro) |
| 5 | Plantillas · `layers` (pro) | Plantillas · `copy` (pro) |

⚠️ **El icono `layers` estaba cogido por Plantillas.** Se lo queda Programa, que
es lo que de verdad tiene etapas apiladas, y Plantillas pasa a `copy` — que es
además lo que hace: clonar.

### 4.2 La pantalla

`src/screens/MyProgramScreen.jsx`. `AppHeader` arriba como todos los tabs y un
`ScrollView` con tres bloques, de arriba abajo:

```
┌─ AppHeader ────────────────────────────────────────┐
│                                                    │
│  ┌ ProgramCard · variant="self" ────────────────┐  │  la misma de la Home,
│  │  TU PROGRAMA              CICLO  02          │  │  sin tocar por dentro.
│  │  Hipertrofia Iniciación                      │  │  NO navegable: sin
│  │  ● por Marcos Ruiz                           │  │  `onPress` ni
│  │ ─────────────────────────────────────────    │  │  `onStagePress`
│  │  Etapa 2 Acumulación          ● ● ○ ○        │  │
│  │  ▬▬▬▬ ▬▬▬▬▬▬ ▭▭▭▭ ▭▭▭▭▭                     │  │
│  │  85%        0,5         +4%                  │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ETAPAS                                            │  SectionHeader
│  ┌──────────────────────────────────────────────┐  │
│  │ Acumulación        4 ciclos · 4 sesiones   ✓ │  │  las filas del antiguo
│  │ Intensificación    3 ciclos · 4 sesiones     │  │  StagePickerSheet,
│  │ Descarga           bloqueada               🔒│  │  ahora inline
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │ Ver programa                               › │  │  MenuRow → visualizador
│  │ Editar programa                            › │  │  MenuRow → editor
│  │ Archivar programa                            │  │  MenuRow → hoja
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

Tres grupos de la **misma** anatomía de lista, que es la que acaba de quedarse
libre al borrar el bloque de conexiones de la Home: `SectionHeader` + grupo de
`MenuRow`. Nada de esto es un componente nuevo.

### 4.3 Las etapas, inline, y las tres acciones

**Las etapas dejan de vivir en una hoja.** `StagePickerSheet`
([`HomeScreen.jsx:395`](../../src/screens/HomeScreen.jsx#L395)) desaparece como
modal y su contenido —el grupo de `MenuRow` con nombre, `4 ciclos · 4 sesiones`,
el check lima en la activa y el candado en las bloqueadas— se pinta directamente
en el tab. Es el cambio que responde al «de una forma más clara y extendida»: en
el sitio donde la pregunta es *dónde voy*, las etapas están a la vista y no
detrás de un gesto.

Se conserva su comportamiento: `isStageLocked`, la fila deshabilitada, el
`labelColor` accent en la activa, el candado y el check. Con una sola etapa el
bloque no se pinta.

#### Cambiar de etapa pide confirmación

Lo único que cambia de la pieza. Hoy elegir etapa la cambia en seco, y eso
valía porque **había que abrir una hoja a propósito para llegar**: el gesto ya
era la confirmación (ver el comentario de
[`:380-393`](../../src/screens/HomeScreen.jsx#L380), «la salida es la propia
cabecera de la hoja, así que no hay botón de cancelar»). Con las filas siempre a
la vista ese peso desaparece y hay que devolvérselo.

`Alert` nativo, el mismo patrón que el borrado del historial
([`HistoryScreen.jsx:414`](../../src/screens/HistoryScreen.jsx#L414)), con dos
salidas: cancelar y cambiar.

⚠️ **Y hay algo real que perder, que hoy no se avisa.**
[`setCurrentStage`](../../store/useStore.js#L1609) no solo mueve
`currentStageIndex`: pone `stageWeeksCompleted: 0` y `cycleCompletedIds: []`.
O sea que cambiar de etapa **borra el ciclo en curso** — las sesiones que
llevaras marcadas de esta rotación. El aviso lo dice con esas palabras y no con
un «¿seguro?» genérico; el texto se calla la parte del ciclo cuando no hay nada
marcado (`cycleCompletedIds.length === 0`), que es el caso de quien acaba de
entrar en la etapa. La variante con ciclo empezado va con plural de i18next
(`bodyReset_one` / `bodyReset_other`), que es como el resto del fichero cuenta
sesiones.

Esto **arregla un agujero que ya existía**: hoy ese reinicio pasa sin decir
nada, en la hoja y en el editor de programa. La confirmación vive en la pantalla
y no dentro de la acción del store — `advanceStage` y el editor tienen sus
propios flujos y su propio contexto, y meterle un `Alert` al store lo haría
imposible de probar.

**Las tres acciones, en un grupo.** Hoy están repartidas en tres gestos de dos
pantallas distintas; pasan a ser tres filas seguidas:

| Fila | Qué hace | De dónde viene | Cuándo se pinta |
|---|---|---|---|
| Ver programa | `setPrintingProgram(activeProgramId)` → `ProgramDetail` | era el toque sobre el nombre de la tarjeta | siempre |
| Editar programa | `navigate('programEditor')` | era el footer de `ProgramDetailScreen` | `isMineActive && !isTrainerProgram` |
| Archivar programa | abre la hoja de archivar de siempre | era el `⋯` de la cabecera del visualizador | `isMineActive` |

Al mudarse editar y archivar, **`ProgramDetailScreen` pierde su footer y su
`⋯`**, y con ellos el `DragSheet` del menú y el de archivar. Esto no deja ningún
caso huérfano: las tres condiciones de esos dos controles solo se cumplen para el
programa **activo y propio**, que es justo el que enseña el tab. Abierto desde
Plantillas o desde la ficha de un cliente, el visualizador ya se quedaba sin
acciones — y ahora se queda sin ellas siempre, que es lo que dice su propia spec:
es un visualizador.

Las etiquetas ya existen: `programCard.view` (`VER PROGRAMA`) y
`programView.editBtn` (`EDITAR PROGRAMA`) se reaprovechan en minúscula de fila, y
archivar usa `home.archive`.

### 4.4 El aviso de etapa terminada se queda en Sesiones

El banner de
[`HomeScreen.jsx:687-745`](../../src/screens/HomeScreen.jsx#L687) —«etapa
terminada, avanzar a X» y su variante bloqueada— **no se muda**. Es lo único con
caducidad de la app y lo que decide qué entrenas mañana.

Lo que sí gana el tab de Programa es un punto: `tabBarBadge` cuando
`stageAdvancePending`, con el mismo tratamiento que el contador de Clientes
([`RootNavigator.jsx:104`](../../src/navigation/RootNavigator.jsx#L104)) pero sin
número — un punto, no una cifra.

### 4.5 Lo que la Home suelta

De [`HomeScreen.jsx`](../../src/screens/HomeScreen.jsx) se van, enteros y sin
tocar por dentro:

- el `<ProgramCard>` y su `Reanimated.View` envolvente
  ([`:836-880`](../../src/screens/HomeScreen.jsx#L836));
- `StagePickerSheet` ([`:395-434`](../../src/screens/HomeScreen.jsx#L395)) y su
  estado `stagePicker` — el componente se muda y **deja de ser una hoja**;
- el `DocSheet` del ciclo y su estado `cycleDoc`, que cuelga de la etiqueta
  `CICLO` de la tarjeta;
- `computeStageInfo`, `computeWeekNum` y los `useMemo` de `adherence`,
  `adherence4w` y `loadPct`, que solo alimentan la tarjeta.

La Home baja de 1.342 a ~1.050 líneas y se queda con lo que dice su nombre: la
semana, el aviso de etapa, las sesiones y la sesión libre.

### 4.6 Sin programa activo, el mensaje sale en los dos tabs

El estado vacío de [`:872-903`](../../src/screens/HomeScreen.jsx#L872) («No hay
programa activo» + `＋ NUEVO PROGRAMA`, con su `Alert` de desconexión del
entrenador cuando hay `clientSync.slotId`) lo necesitan **las dos** pantallas:
Sesiones porque no tiene sesiones que listar, y Programa porque no tiene programa
que enseñar.

Sale a `src/components/ui/NoProgram.jsx` tal cual está, con su `Alert` incluido,
y lo pintan las dos. No se reescribe: es un `export default` alrededor del JSX
que ya existe, y las dos pantallas lo montan con la misma condición
(`!activeProgram`).

---

## 5. Fase U23 — El Historial entra en Progresión

La última y la única de la que uno puede arrepentirse.

### 5.1 El problema que hay que resolver antes

Meter el historial bajo un `SegmentedControl` de tres opciones deja **dos
segmented controls pegados**: el de Progresión arriba y el de ámbito
(`Programa actual` / `Todos`) justo debajo, más la fila de pills de etapa. Eso es
más ruido, no menos — lo contrario de lo que persigue toda la spec.

Dos movimientos lo arreglan, y los dos valen por sí solos:

**a) El calendario de calor se va a CARGA.** Hoy vive en la cabecera del
historial, pero lo que pinta es `internalLoad` — la misma util que sostiene
[`LoadTab`](../../src/components/stats/LoadTab.jsx). No es «qué hice», es «cuánto
me machaqué»: está en el segmento equivocado. Con él se van `getLoadHeat`,
`heatLevel`, `HEAT_STEPS`, `CELL_H` y `CELL_GAP`.

⚠️ El calendario es hoy el **único** filtro por día del historial
(`selectedDate`). Al mudarse, el chip de fecha seleccionada se cae con él: en
Carga no hay lista que filtrar. El filtro por día **desaparece** — nadie lo pidió
y era un efecto colateral de tener el calendario ahí.

**b) Ámbito y etapas colapsan en un chip.** En vez de un `SegmentedControl` + una
tira horizontal de pills, una sola fila:

```
  [ Programa actual · Etapa 2  ▾ ]                    ···
```

Pulsarla abre un `DragSheet` con `SheetRow` —los dos componentes ya están— con
las dos opciones de ámbito y, debajo, las etapas como filas conmutables. El `···`
de gestión del historial se queda donde está, al lado.

Con a) y b) hechos, la cabecera del historial pasa de cuatro bloques a uno, y el
`SegmentedControl` de Progresión es el único control de la pantalla.

### 5.2 El reparto

`HistoryScreen.jsx` deja de ser pantalla y pasa a
`src/components/history/HistoryList.jsx`: se le caen `AppHeader`, el `View`
contenedor y el `paddingTop: insets.top` —los pone `StatsScreen`— y gana un prop
`header` que se antepone dentro de `ListHeaderComponent`.

`ProgressPanel` gana una tercera opción **opt-in**:

```jsx
<ProgressPanel … history={<HistoryList />} />
```

Sin el prop, el panel se queda con dos segmentos. **Esto no es opcional**: la
ficha de cliente usa el mismo `ProgressPanel`
([`ClientsScreen.jsx:2625`](../../src/screens/ClientsScreen.jsx#L2625)) y **ya
tiene su propio tab de Historial**. Si el tercer segmento saliera siempre, el
entrenador vería el historial del cliente dos veces, en dos sitios, con filtros
distintos.

Los tres rótulos caben: la ficha de cliente ya reparte cuatro
(`Programa · Historial · Progreso · Info`) a 375 pt sin truncar, y aquí son tres.

### 5.3 Los tres segmentos, ya sí, dicen tres cosas

| Segmento | La pregunta |
|---|---|
| Ejercicios | qué levanto y cuánto he mejorado |
| Carga | cuánto me machaco — y el calendario, que es eso |
| Historial | qué hice |

---

## 6. i18n

| Clave | |
|---|---|
| `tabs.history` | **borrada** — el tab desaparece (U22) |
| `tabs.program` | **nueva** — `Programa` / `Program` (U22) |
| `home.connections` · `home.connect` · `home.connected` · `home.notConnected` · `home.reconnect` · `home.pendingSync` · `home.trainer` | **borradas** — solo las usaba el bloque de conexiones (U21). Verificado: no queda ningún otro consumidor en `src/` |
| `myProgram.stagesLabel` | **nueva** — `ETAPAS` / `STAGES`, el rótulo del grupo (U22) |
| `myProgram.archiveRow` | **nueva** — `Archivar programa` / `Archive program` (U22) |
| `myProgram.stageConfirm.title` | **nueva** — `¿Cambiar a {{name}}?` / `Switch to {{name}}?` (U22) |
| `myProgram.stageConfirm.body` | **nueva** — `Pasarás a entrenar esta etapa.` / `You will start training this stage.` (U22) |
| `myProgram.stageConfirm.bodyReset` | **nueva** — la variante con ciclo empezado: `Pasarás a entrenar esta etapa y se reiniciará el ciclo en curso: perderás las {{count}} sesiones que llevas marcadas.` / `…you will lose the {{count}} sessions you have marked.` (U22) |
| `myProgram.stageConfirm.confirm` | **nueva** — `Cambiar` / `Switch` (U22) |
| `history.filterChip` | **nueva** — `{{scope}} · {{stage}}` (U23) |
| `history.allStages` · `history.currentProgram` · `history.all` | **se quedan**: pasan del control de ámbito a las filas de la hoja (U23) |

Las dos filas de acción reutilizan lo que hay: `programCard.view`
(`VER PROGRAMA`) y `programView.editBtn` (`EDITAR PROGRAMA`). Igual que
`home.selectStage`, `home.stage*`, `home.archiveModal.*`, `programCard.*` y
`load.tab*`.

Las claves nuevas se añaden **línea a línea** en `es.json` y `en.json`: nunca
reescribiendo el fichero con un volcado, que reformatea todo lo demás.

---

## 7. Fases

| # | Fase | Coste | Estado |
|---|---|---|---|
| U21 | Limpieza previa: conexiones duplicadas y mapeo muerto | 🟢 −96 líneas | ✅ 13-sep-2026 — bloque `CONEXIONES` y su estado derivado, `formatBackupTime`, la variante `dim` de `SectionHeader`, 7 claves ×2 idiomas y el caso `'history'` de `viewToRoute` |
| U22 | El tab «Programa»: la tarjeta, las etapas y las acciones | 🟡 `MyProgramScreen` 417 líneas · `ui/NoProgram` extraído · Home −330 · visualizador −131 | ✅ 13-sep-2026 — en tres pasos: la tarjeta se muda, las etapas pasan a `Section` inline con confirmación, y las tres acciones se juntan mientras el visualizador suelta pie y `⋯` |
| U23 | El Historial entra en Progresión | 🟡 `stats/LoadCalendar` extraído · `HistoryScreen` → `history/HistoryList` · Historial 669 → 317 líneas | ✅ 13-sep-2026 — el calendario a Carga (celda 30 → 24), ámbito y etapas a un chip con hoja, y el tercer segmento opt-in |

Criterio de aceptación de las tres: `npx eslint <ficheros>` sin errores nuevos
respecto a HEAD (hay preexistentes) y `npx vitest run` en verde desde la raíz del
repo, más las tres pruebas en dispositivo de la cabecera.

⚠️ **Dependencias — corregido.** La primera versión de esta spec decía que la
U23 debía ir después de la U22 «para no dejar cuatro pestañas». Es al revés: la
U22 mete «Programa» en el hueco del Historial, y si la U23 no ha movido el
historial a Progresión todavía, esa versión se queda **sin acceso al
historial**. O la U23 va primera, o la U22 convive con cuatro pestañas hasta que
llegue. Se eligió lo segundo, que es inocuo mientras no se publique.

La U22 se ejecuta en tres pasos, y cada uno deja la app coherente:
**(a)** la tarjeta se muda al tab nuevo con su hoja de etapas detrás —
**hecho**; **(b)** las etapas pasan a inline y cambiar de etapa pide
confirmación — **hecho**; **(c)** las tres acciones se juntan en un grupo y el
visualizador pierde su pie y su `⋯` — **hecho**. En (a) la tarjeta **conserva** `onStagePress`: quitarle
el selector antes de que exista la lista inline dejaría un hueco sin forma de
cambiar de etapa.

> La spec nació con cuatro fases: la U22 original extraía el visualizador a un
> componente `ProgramView` para poder meterlo en un segmento del tab. Al caerse
> el control segmentado (§2.1) se cayó con él, y las fases se renumeraron antes
> de que ningún código saliera del repo. **Ningún `U24` llegó a significar
> nada**; el siguiente código libre del tema sigue siendo el que diga
> `npm run estado`.

---

## 8. Trampas conocidas

- **El nombre de ruta.** `Program` está cogido por Plantillas. El tab nuevo es
  `MyProgram` aunque su rótulo diga «Programa». Lo mismo en `viewToRoute`, que
  gana un caso `'myProgram'` al perder el de `'history'`.
- **La tarjeta sin `onPress` ni `onStagePress`.** `ProgramCard` está preparada
  (`PressZone` sin `onPress` es una `View` y el chevron `›` solo se pinta si hay
  navegación), pero hay que pasarle los dos a `undefined` **y seguir pasándole
  `onCycleInfo`**: la etiqueta `CICLO` sigue abriendo la ficha del glosario, que
  es la única pieza pulsable que le queda.
- **`setPrintingProgram` fija el global.** La fila «Ver programa» tiene que
  llamarlo siempre con `activeProgramId`, nunca navegar a `ProgramDetail` a
  secas: sin fijarlo, el visualizador abre el último programa que se miró (una
  plantilla, el de un cliente).
- **`ListHeaderComponent` no recibe una función.** `HistoryList` compone
  `<>{header}{listHeader}</>` y lo pasa **como elemento**, no como
  `() => elemento`: con la función se remonta en cada render y se pierden el
  scroll y el estado de la cabecera.
- **`ProgressPanel` es compartido.** Todo lo que se le añada tiene que ser
  opt-in por prop, o aparece también en la ficha de cliente (§5.2).
- **El orden de declaración y los `useMemo`.** En `HistoryScreen` ya se pisó:
  declarar un manejador antes de los `useMemo` que captura hace que el
  compilador de React abandone la memoización de la pantalla entera. Al partir el
  fichero hay que mantener el orden (ver el desglose de gestión del historial en
  el [README](README.md)).
- **La confirmación de etapa va en la pantalla, no en el store.**
  `setCurrentStage` lo llaman también el editor de programa y el aviso de fin de
  etapa, que tienen su propio contexto: un `Alert` dentro de la acción se los
  comería a los tres y dejaría el store sin poder probarse.
- **Archivar navega hacia atrás.** `handleArchive` acaba en `navigation.goBack()`
  porque vivía en una pantalla del stack. En un tab no hay atrás: al archivar
  desde aquí, el tab se queda enseñando `NoProgram`, que es lo correcto y no
  necesita navegación ninguna.
