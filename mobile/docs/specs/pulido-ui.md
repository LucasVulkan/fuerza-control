# Spec — Pulido de UI (apuntes)

> Tema: ui
> En corto: Mejoras visuales y de estandarización apuntadas el 29-sep-2026 para más adelante: pantallas que se deslizan con el segmentado, un recap legible, hojas de opciones y confirmaciones todas iguales, textos sin traducir, un solo lima, cabeceras, pantallas vacías y una hoja de progresión duplicada.
> Fase U28 · pendiente · Progresión: las pantallas se deslizan con el segmentado · §1
> Fase U29 · hecho · Recap: distribución y legibilidad · §2
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

El recap tenía 12 bloques apilados con el mismo peso, y lo que se pide (RPE y
peso corporal) iba **antes** que el premio (cifras y PRs). Maqueta aprobada en
[`docs/mockups/recap.html`](../mockups/recap.html) tras una ronda de ajustes
del usuario (29-sep-2026).

**Tres lenguajes, siempre el mismo por bloque:** resultado (se lee, tarjeta
`surface`), logro (se celebra, `tint/accent10`) y **tu parte** (se escribe:
todo bajo el lápiz y nada más).

Orden nuevo en `SessionRecapScreen.jsx` (la maqueta es la de la primera ronda;
lo que cambió después está contado aquí, que es lo que manda):

1. **Marcador**: cabecera centrada sobre el fondo, como la de antes: ceja
   «✓ SESIÓN COMPLETADA», la letra en su caja lima y el nombre en Barlow (los
   de la sesión de hoy en Inicio), y etapa · fecha. Debajo, duración · volumen
   · series en **tres tarjetas sueltas** (las Progress cards, «va con la
   app»), en `title` y no en Barlow. El volumen lleva su % contra la misma
   sesión la vez anterior (`volumeDeltas`, el del historial). Sin tira de la
   semana: descartada por el usuario. Una primera versión metía cabecera y
   cifras en una sola tarjeta; el usuario la rechazó en la segunda ronda.
2. **Récords**: como mucho 3, ordenados por % de mejora; el resto detrás de
   «Ver N más». `detectPRs` da uno por ejercicio que supera su mejor marca de
   siempre, así que en los primeros meses salen 6-9.
3. **Tu parte**, con «Sin contestar» / «Todo contestado» (solo mira el sRPE):
   - sRPE con sus botones `surface2` de siempre (el usuario prefirió el fondo
     de antes). Al contestarlo, la carga sale en la misma tarjeta **solo como %
     vs media 7d**, en blanco: el número de carga suelto no dice nada.
   - Peso corporal con `StepField` (± y celda `bg`), relleno con el último.
     Sin subtítulo: «El último: X kg, hace N días» ocupaba demasiado para lo
     poco que decía.
   - Nota de la sesión en el **desplegable de Info de la ficha de cliente**
     (`InfoSection`, que sale a `components/ui/`): cerrada ocupa una fila y
     dice a la derecha la primera línea de la nota o «Sin nota». La que se
     escribió en el entreno se corrige ahí. `setSessionFeedback` acepta ahora
     `notes`.
4. **Vs. última sesión**: una fila por ejercicio con el nombre y **solo el
   delta** (sin series: «no necesito un resumen de lo que ya he hecho»), y el
   trofeo en los que hicieron récord. Sin sesión anterior, no sale.
5. Bloques, igual que antes.
6. **Esta sesión libre**: «cuenta para el programa» y las dos acciones como
   filas `MenuRow` con icono.
7. **Pie fijo** con HECHO; si falta el sRPE, «Falta: cómo de dura fue» encima,
   que baja hasta la pregunta. No bloquea.

**Entrada**: la pantalla se construye sección a sección, cada una de derecha
a izquierda desde 90 px fuera (entrada propia, `enterFromRight`; `FadeInRight`
solo recorre 25), 380 ms y 110 ms entre una y otra; el pie se funde el último.
Solo al montar.

De paso: el nombre de la etapa se leía de `program.currentStageIndex`, que en
el móvil del entrenador es su copia y no se mueve; ahora pasa por
`athleteProgress` (la única puerta, weeks-model §3.7).

**Probar U29**

- [ ] Acabar una sesión de programa: arriba, centrado y sobre el fondo, sale
  ✓ SESIÓN COMPLETADA, la letra (A/B/C) en su caja lima, el nombre en Barlow y
  etapa · fecha. Debajo, duración · volumen · series en tres tarjetas sueltas,
  como antes.
- [ ] Repetir una sesión que ya se había hecho: bajo el volumen sale su % contra
  la vez anterior (lima si sube, rojo apagado si baja).
- [ ] Con récords: salen en lima bajo «N RÉCORDS», con el valor nuevo a la
  derecha y «anterior …» debajo del nombre. Con más de 3 sale «Ver N récords
  más» y al pulsarlo aparecen los demás.
- [ ] Sin contestar el RPE: la sección TU PARTE dice «Sin contestar», la
  pregunta lleva un punto gris y el pie dice «Falta: cómo de dura fue».
  Pulsarlo baja hasta la pregunta.
- [ ] Contestar el RPE: el punto pasa a ✓, el chip a «Todo contestado» (lima),
  desaparece el «Falta» del pie y, si hay una semana de historial, sale
  «CARGA DE LA SESIÓN +N % vs media 7d» en blanco, sin el número de carga.
- [ ] Peso corporal: una sola fila, sin subtítulo, rellena con el último; los ±
  lo mueven de 0,1 en 0,1 y se puede escribir tocando el número. Un peso de
  tres cifras con decimal (p. ej. 102,4) no se corta.
- [ ] Nota escrita durante el entreno: sale plegada en una fila NOTA DE LA
  SESIÓN con su primera línea a la derecha. Al tocarla se despliega (igual que
  en Info de un cliente); corregirla, salir con HECHO y abrir la sesión en el
  historial: sale la nota corregida.
- [ ] Sin nota: la fila dice «Sin nota»; desplegada, la celda sale vacía con
  «Cómo te has sentido, molestias…». Escribir en ella no queda tapado por el
  teclado.
- [ ] Info de un cliente sigue plegando y desplegando igual que antes (su
  desplegable ahora es la pieza compartida).
- [ ] VS. ÚLTIMA SESIÓN: una fila por ejercicio, sin series, con el cambio a
  la derecha; los que hicieron récord llevan el trofeo; un ejercicio nuevo dice
  «nuevo». La primera vez que se hace una sesión, la sección no sale.
- [ ] Sesión libre sobre la marcha: al final, ESTA SESIÓN LIBRE con «Guardar
  como sesión libre» (icono de disquete). Pulsarla: pasa a «Guardada…» con ✓
  y sale el aviso.
- [ ] Sesión libre guardada con ejercicios añadidos, y con programa activo:
  salen «Cuenta para el programa» con su segmentado y «Añadir N ejercicios a la
  sesión» (icono +).
- [ ] Entrenador apuntando por un cliente: la ceja dice «NOMBRE · SESIÓN
  COMPLETADA» en azul, la letra va en azul, y HECHO vuelve a la ficha del
  cliente.
- [ ] En inglés, ningún texto del recap sale en español.
- [ ] Al entrar, las secciones aparecen una tras otra de arriba abajo, cada una
  deslizándose en horizontal desde fuera del borde derecho, con un desfase que
  se nota, y el pie con HECHO llega el último. Contestar el RPE o abrir «Ver N
  récords más» no repite la entrada.

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
| U29 | Reordenar el recap: resultados primero, entrada de datos agrupada | ✅ rama `feat/recap` — pendiente de probar en dispositivo | 🟡 |
| U30 | Una sola fila de opción con icono; hoja «Añadir» del Workout | pendiente | 🟡 |
| U31 | Hueco delante de las sesiones libres | pendiente | 🟢 |
| U32 | Botones del programa de cliente fuera de la tarjeta | pendiente | 🟢 |
| U33 | `ui/ConfirmSheet` y fuera los `Alert.alert` | pendiente | 🟡 |
| U34 | Textos fijos a i18n; `PaywallModal`, `ProgramUpdateModal`, `ImportModal` a `DragSheet` | pendiente | 🟡 |
| U35 | `#b8ff00` como token del tema | pendiente | 🟢 |
| U36 | Cabecera de cerrar compartida; ✕ como icono | pendiente | 🟢 |
| U37 | `EmptyState` común | pendiente | 🟢 |
| U38 | Hoja de progresión única | pendiente | 🟢 |
