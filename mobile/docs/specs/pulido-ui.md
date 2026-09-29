# Spec — Pulido de UI (apuntes)

> Tema: ui
> En corto: Mejoras visuales y de estandarización apuntadas el 29-sep-2026 para más adelante: pantallas que se deslizan con el segmentado, un recap legible, hojas de opciones y confirmaciones todas iguales, textos sin traducir, un solo lima, cabeceras, pantallas vacías y una hoja de progresión duplicada.
> Fase U28 · pendiente · Progresión: las pantallas se deslizan con el segmentado · §1
> Fase U29 · pendiente · Recap: distribución y legibilidad · §2
> Fase U30 · pendiente · Hojas de opciones con icono y estandarizadas · §3
> Fase U31 · pendiente · Sesiones libres: icono delante o sin hueco · §4
> Fase U32 · pendiente · Programa de cliente: botones fuera de la tarjeta · §5
> Fase U33 · pendiente · Confirmaciones y avisos sin Alert nativo · §6
> Fase U34 · pendiente · Textos fijos a i18n y modales viejos a DragSheet · §7
> Fase U35 · pendiente · Un solo lima, como token del tema · §8
> Fase U36 · pendiente · Cabecera de cerrar compartida y ✕ como icono · §9
> Fase U37 · pendiente · Pantalla vacía común, sin emojis · §10
> Fase U38 · pendiente · Una sola hoja de progresión · §11
>
> Estado: **apuntes, no spec cerrada** (29-sep-2026). U28-U32 son notas del
> usuario; U33-U38 salen de una revisión del código el mismo día (solo código,
> sin mirar la app en el móvil). Los datos concretos (ficheros, líneas,
> recuentos) son de esa fecha y hay que revalidarlos antes de implementar, y el
> diseño de cada fase está sin cerrar. Fases independientes entre sí salvo lo
> que se dice en cada una.

## 1. U28 — Progresión: las pantallas se deslizan con el segmentado

Al cambiar en el control segmentado entre Ejercicios, Carga e Historial, el
contenido cambia de golpe. Tiene que desplazarse de lado a la vez que el
resalte del segmentado, como un pager.

Lo que dice el código: `ui/SegmentedControl.jsx` anima el resalte con
`Animated` de RN core. Para que el resalte siga al dedo mientras se desliza la
pantalla (y no solo al soltar), el segmentado tiene que pasar a Reanimated y
leer la posición del pager desde un `useSharedValue`. Esa es la parte grande
de la fase. El segmentado se usa en muchas pantallas: el cambio no puede
alterar su comportamiento cuando no hay pager.

## 2. U29 — Recap: distribución y legibilidad

El recap tiene muchas cosas y hoy se lee mal. Necesita mejor jerarquía y
reparto del espacio.

Orden actual en `SessionRecapScreen.jsx`, 12 bloques apilados: cabecera · RPE
de la sesión · carga · peso corporal · cifras · PRs · bloques de
acondicionamiento · comparación con la sesión anterior · nota · «cuenta para
el programa» · añadir a la sesión libre · guardar como sesión libre · Hecho.

El problema principal: lo que se pide (RPE y peso corporal) va **antes** que
el premio (cifras y PRs). Propuesta para discutir:

1. Resultados: cifras y PRs.
2. Comparación con la sesión anterior y bloques.
3. Una sola tarjeta «cómo ha ido»: RPE (y la carga que sale de él), peso
   corporal y nota.
4. Las decisiones de sesión libre, juntas en un grupo.
5. «Hecho» fijo abajo.

## 3. U30 — Hojas de opciones con icono y estandarizadas

Las hojas deslizables con listas de opciones tienen que llevar icono en cada
fila y ser todas la misma pieza.

Hay dos tipos de fila de opción:

| Pieza | Icono | Dónde |
|---|---|---|
| `MenuRow` (`ui/MenuList.jsx`) | sí | menú ≡ (`AppHeader`), Inicio, Mi programa, `ClientSessions` |
| `SheetRow` (`ui/SheetRow.jsx`) | no | Plantillas (`ProgramScreen`, 9 filas), Clientes (8), editor de sesión (8) |

- `history/HistoryList.jsx` mezcla las dos en el mismo fichero.
- La hoja «Añadir» del Workout (`WorkoutScreen.jsx` ~725) tiene filas hechas a
  mano y hace `setAddSheetOpen(false)`: se cierra de golpe, el fallo que
  `SheetRow` ya arregló cerrando con la animación de `DragSheet`.
- Decidir entre dar a `SheetRow` una prop de icono o pasar sus usos a
  `MenuRow`. Lo segundo deja una sola pieza.

El long press de cliente que recordaba el usuario es borrar un cobro
(`ClientsScreen.jsx` ~2942), con `Alert` nativo: va en U33.

## 4. U31 — Sesiones libres: icono delante o sin hueco

Las filas de sesiones libres dejan un espacio vacío delante. O se pone un icono
en ese hueco o se elimina el espacio. La lista está en `HomeScreen.jsx`
(bloque «Sesiones libres», ~432); las filas de sesión de programa llevan la
letra en ese hueco (`marker` en `SessionList.jsx`).

## 5. U32 — Programa de cliente: botones fuera de la tarjeta

En el programa de un cliente, los botones van pegados a la tarjeta. Tienen que
separarse como en el tab «Programa» (ver [tab-programa.md](tab-programa.md);
`MyProgramScreen.jsx` pone las acciones en un grupo de `MenuRow` aparte).

La tarjeta del cliente es `AssignedProgramCard`, dentro de
`ClientsScreen.jsx` (5.095 líneas). Al tocarla, sacarla a su propio fichero.

## 6. U33 — Confirmaciones y avisos sin Alert nativo

`DragSheet` y `UI-MIGRATION` §9 prohíben el `Alert` nativo (en Android no se
puede estilar), pero hay **64 `Alert.alert` en 24 ficheros**. Los que más:
`ClientsScreen` (19), `DriveBackupScreen` (9), `SessionEditorScreen` (5),
`TrainerSyncModal` (5).

- Unas 20 son confirmaciones de borrar o descartar. Plantillas ya tiene una
  hoja de confirmación dentro de `ProgramScreen.jsx` (`confirmRow`,
  `confirmCancel`, `confirmDelete`): sacarla a `ui/ConfirmSheet` y usarla en
  todas.
- El resto son avisos de error: valorar pasarlos a `Toast`.

## 7. U34 — Textos fijos a i18n y modales viejos a DragSheet

Textos en español escritos en el código, que rompen la app en inglés:

- Pantallas enteras: `PaywallModal`, `ProgramUpdateModal`, `ImportModal`.
- `ClientsScreen`: «IMPORTAR PROGRAMA», «CÓDIGO CLIENTE», «SINCRONIZACIÓN EN
  LA NUBE», «Conectado · sin código local», y la pantalla sin Pro («Gestión de
  clientes», «Ver planes PRO», «Ocultar tab»). Varios `Alert` con «Error» y
  «No se pudo…» fijos.
- Sueltos: «Sin sesión activa» (`WorkoutScreen`), «NOTA» (`SessionCard`),
  «Error en la compra» (`PaywallModal`).
- Al revés: «CUSTOM», fijo en inglés, en `ExerciseSelectorScreen`.

Esos tres modales, y el de importar de `ClientsScreen`, montan su propio
`Modal` en vez de `DragSheet`. El fondo oscuro que ponen detrás tiene cuatro
opacidades distintas (0.6, 0.7, 0.75 y 0.82). Pasarlos a `DragSheet` lo
unifica.

## 8. U35 — Un solo lima, como token del tema

El `accent` de `formaFit` es `#aae216`, pero hay un `'#b8ff00'` escrito a mano
en 5 ficheros: `HomeScreen` y `SessionList` (constante `LIMA`),
`ProgramScreen` («literal de Figma, distinto de color/accent»),
`CustomExerciseScreen` y `ExerciseSelectorScreen`. Ese color no cambia con el
tema. Pasa a un color del tema con nombre propio (ya existe
`accent10: rgba(184,255,0,0.1)` con esa base en `themes.js`).

## 9. U36 — Cabecera de cerrar compartida y ✕ como icono

`DocsScreen`, `DriveBackupScreen`, `TrainerConnectionScreen` y
`CustomExerciseScreen` llevan el mismo bloque `header`/`headerTitle`/`iconBox`
copiado igual. Sale a una pieza compartida (o a una variante de
`ui/ScreenHeader`).

La ✕ de cerrar o borrar es un carácter de texto en unos 10 sitios
(`PaywallModal`, `ProgressTab`, `ExerciseCard`, `ClientsScreen`,
`ExerciseEditorInline`…), cuando el resto de iconos son SVG de línea.

## 10. U37 — Pantalla vacía común, sin emojis

Cinco pantallas vacías con emoji a 32 o 40 px: 📭 `HistoryList`, 📈
`ProgressTab`, 🏋️ `NoProgram`, 👥 `ClientsScreen` (dos veces). Las cinco se
cambian por un componente `EmptyState` con icono de línea (como `RowIcon`),
título y texto.

## 11. U38 — Una sola hoja de progresión

La hoja de progresión de `editor/ExerciseEditorInline.jsx` y la de
`CustomExerciseScreen.jsx` son copias y ya no coinciden: al alta de ejercicio
le falta el paso «Cuándo se cumple» (`stepEval`) y numera 3 el incremento.
Sacar una sola pieza, y decidir si el alta debe tener el paso de evaluación.
Al usuario (29-sep-2026) no le cuadra que se quitara en el alta; lo más
probable es una simplificación fuera de lugar. Se decide al llegar a la fase.

## Otros detalles vistos (sin fase)

- Pocos tamaños de letra fuera de la escala de `textStyles`, casi todos en los
  emojis de U37. El resto: `ProgramScreen` `statLabel` (10),
  `ClientsScreen` `infoCodeText` (16) e `infoCopyBtnText` (18),
  `AppHeader` (19), el badge de la tab bar (11).
- `Animated` de RN core sigue en 16 ficheros. Solo importa donde se toque (U28).

## Fases

| Fase | Qué | Estado | Coste |
|---|---|---|---|
| U28 | Pager sincronizado con el segmentado de Progresión; segmentado a Reanimated | pendiente | 🟡 |
| U29 | Reordenar el recap: resultados primero, entrada de datos agrupada | pendiente | 🟡 |
| U30 | Una sola fila de opción con icono; hoja «Añadir» del Workout | pendiente | 🟡 |
| U31 | Hueco delante de las sesiones libres | pendiente | 🟢 |
| U32 | Botones del programa de cliente fuera de la tarjeta | pendiente | 🟢 |
| U33 | `ui/ConfirmSheet` y fuera los `Alert.alert` | pendiente | 🟡 |
| U34 | Textos fijos a i18n; `PaywallModal`, `ProgramUpdateModal`, `ImportModal` a `DragSheet` | pendiente | 🟡 |
| U35 | `#b8ff00` como token del tema | pendiente | 🟢 |
| U36 | Cabecera de cerrar compartida; ✕ como icono | pendiente | 🟢 |
| U37 | `EmptyState` común | pendiente | 🟢 |
| U38 | Hoja de progresión única | pendiente | 🟢 |
