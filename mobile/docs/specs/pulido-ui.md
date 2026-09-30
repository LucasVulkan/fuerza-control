# Spec — Pulido de UI (apuntes)

> Tema: ui
> En corto: Mejoras visuales y de estandarización apuntadas el 29-sep-2026 para más adelante: pantallas que se deslizan con el segmentado, un recap legible, hojas de opciones y confirmaciones todas iguales, textos sin traducir, un solo lima, cabeceras, pantallas vacías y una hoja de progresión duplicada.
> Fase U28 · hecho · Progresión: las pantallas se deslizan con el segmentado · §1
> Fase U29 · hecho · Recap: distribución y legibilidad · §2
> Fase U30 · hecho · Hojas de opciones con icono y estandarizadas · §3
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

**Hecho (30-sep-2026), solo al tocar el segmentado.** El usuario eligió esto
frente a un pager con gesto de dedo. El segmentado ya iba en Reanimated.
`stats/ProgressPanel.jsx` pone las pestañas en una fila de N × 100 % y la
traslada con `withTiming` y la misma curva que el resalte
(`SegmentedControl.TIMING`). El translate va en %, así que no hay nada que
medir. Cada pestaña se monta la primera vez que se visita y luego no se
desmonta: la que sale y la que entra tienen que verse a la vez. Las de fuera
de pantalla se ocultan al lector de pantalla. `SegmentedControl` no cambia de
comportamiento: solo expone su curva.

Si más adelante se quiere también deslizar con el dedo: `react-native-pager-view`
(está en Expo Go) con `onPageScroll` pasado a un `useSharedValue`, y el
segmentado leyendo esa posición en vez de la suya. Cuidado con el `ScrollView`
horizontal de `ProgressTab` (gestos anidados en ViewPager2) y con el gesto de
volver atrás de iOS en la ficha de cliente.

**Probar U28**

- [x] Progresión → tocar Carga y luego Historial: el contenido se desliza de
  lado a la vez que el resalte, sin corte, y vuelve igual hacia la izquierda.
- [x] Saltar de Ejercicios a Historial de un toque: cruza Carga deslizando,
  sin parpadeos.
- [x] Al volver a una pestaña ya visitada, conserva el scroll y los filtros.
- [x] Clientes → ficha → Progreso (sin Historial, dos segmentos): igual.
- [x] Borrar una sesión en Historial: solo sale esa tarjeta por la derecha.
- [x] Tirar para refrescar en Ejercicios y en Carga sigue funcionando.

## 2. U29 — Recap: distribución y legibilidad

El recap tenía 12 bloques apilados con el mismo peso, y lo que se pide (RPE y
peso corporal) iba **antes** que el premio (cifras y PRs). Maqueta aprobada en
[`docs/mockups/recap.html`](../mockups/recap.html) tras una ronda de ajustes
del usuario (29-sep-2026).

**Tres lenguajes, siempre el mismo por bloque:** resultado (se lee, tarjeta
`surface`), logro (se celebra, `tint/accent10`) y **formulario** (se escribe:
todo bajo el lápiz y nada más).

Orden nuevo en `SessionRecapScreen.jsx` (la maqueta es la de la primera ronda;
lo que cambió después está contado aquí, que es lo que manda):

1. **Marcador**: cabecera centrada sobre el fondo, como la de antes: ceja
   «✓ SESIÓN COMPLETADA» y, con aire debajo, la letra en su caja lima **a la
   izquierda** del nombre en Barlow (los de la sesión de hoy en Inicio; al
   lado y no encima para no gastar alto), con etapa · fecha bajo el nombre. Debajo, duración · volumen
   · series en **tres tarjetas sueltas** (las Progress cards, «va con la
   app»), en `title` y no en Barlow. El volumen lleva su % contra la misma
   sesión la vez anterior (`volumeDeltas`, el del historial). Sin tira de la
   semana: descartada por el usuario. Una primera versión metía cabecera y
   cifras en una sola tarjeta; el usuario la rechazó en la segunda ronda.
2. **Récords**: como mucho 3, ordenados por % de mejora; el resto detrás de
   «Ver N más». `detectPRs` da uno por ejercicio que supera su mejor marca de
   siempre, así que en los primeros meses salen 6-9.
3. **Formulario** (así, y no «Tu parte»). Sin contador de «Sin contestar»: rompía el
   peso de la cabecera; lo que falta lo dicen el punto de la pregunta y el pie.
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

- [x] Acabar una sesión de programa: arriba, centrado y sobre el fondo, sale
  ✓ SESIÓN COMPLETADA y, con algo de aire debajo, la letra (A/B/C) en su caja
  lima a la izquierda del nombre en Barlow, con etapa · fecha bajo el nombre. Debajo, duración · volumen · series en tres tarjetas sueltas,
  como antes.
- [x] Repetir una sesión que ya se había hecho: bajo el volumen sale su % contra
  la vez anterior (lima si sube, rojo apagado si baja).
- [x] Con récords: salen en lima bajo «N RÉCORDS», con el valor nuevo a la
  derecha y «anterior …» debajo del nombre. Con más de 3 sale «Ver N récords
  más» y al pulsarlo aparecen los demás.
- [x] Sin contestar el RPE: la sección se llama FORMULARIO (sin ningún chip al
  lado), la pregunta lleva un punto gris y el pie dice «Falta: cómo de dura fue».
  Pulsarlo baja hasta la pregunta.
- [x] Contestar el RPE: el punto pasa a ✓,
  desaparece el «Falta» del pie y, si hay una semana de historial, sale
  «CARGA DE LA SESIÓN +N % vs media 7d» en blanco, sin el número de carga.
- [x] Peso corporal: una sola fila, sin subtítulo, rellena con el último; los ±
  lo mueven de 0,1 en 0,1 y se puede escribir tocando el número. Un peso de
  tres cifras con decimal (p. ej. 102,4) no se corta.
- [x] Nota escrita durante el entreno: sale plegada en una fila NOTA DE LA
  SESIÓN con su primera línea a la derecha. Al tocarla se despliega (igual que
  en Info de un cliente); corregirla, salir con HECHO y abrir la sesión en el
  historial: sale la nota corregida.
- [x] Sin nota: la fila dice «Sin nota»; desplegada, la celda sale vacía con
  «Cómo te has sentido, molestias…». Escribir en ella no queda tapado por el
  teclado.
- [x] Info de un cliente sigue plegando y desplegando igual que antes (su
  desplegable ahora es la pieza compartida).
- [x] VS. ÚLTIMA SESIÓN: una fila por ejercicio, sin series, con el cambio a
  la derecha; los que hicieron récord llevan el trofeo; un ejercicio nuevo dice
  «nuevo». La primera vez que se hace una sesión, la sección no sale.
- [x] Sesión libre sobre la marcha: al final, ESTA SESIÓN LIBRE con «Guardar
  como sesión libre» (icono de disquete). Pulsarla: pasa a «Guardada…» con ✓
  y sale el aviso.
- [x] Sesión libre guardada con ejercicios añadidos, y con programa activo:
  salen «Cuenta para el programa» con su segmentado y «Añadir N ejercicios a la
  sesión» (icono +).
- [x] Entrenador apuntando por un cliente: la ceja dice «NOMBRE · SESIÓN
  COMPLETADA» en azul, la letra va en azul, y HECHO vuelve a la ficha del
  cliente.
- [x] En inglés, ningún texto del recap sale en español.
- [x] Al entrar, las secciones aparecen una tras otra de arriba abajo, cada una
  deslizándose en horizontal desde fuera del borde derecho, con un desfase que
  se nota, y el pie con HECHO llega el último. Contestar el RPE o abrir «Ver N
  récords más» no repite la entrada.

## 3. U30 — Hojas de opciones con icono y estandarizadas

Las hojas deslizables con listas de opciones llevan icono en cada fila y son
todas la misma pieza.

**Modelo elegido por el usuario (29-sep-2026): la fila de Inicio y del menú ≡**
(`MenuRow`): icono · texto · dato a la derecha si hace falta · galón, y
subtítulo cuando lo necesita. Las **hojas de selección** (elegir y confirmar,
como «+ cliente», los filtros o el modo de historial) son otro formato y se
quedan como están.

Cómo quedó:

- `ui/SheetRow` deja de ser su propia anatomía (fila suelta `surface2` sin
  icono) y pasa a ser `MenuRow` + **cerrar la hoja con su animación**. Es una
  capa y no una prop porque en el menú ≡ hay filas que NO cierran (los
  interruptores, exportar mientras exporta). Van dentro de `Section` sin título.
- `ui/rowIcons` junta los trazos de icono de fila (`ROW_ICON.edit`, `.trash`…):
  los del menú ≡ salen de `AppHeader` y se añaden los de las hojas.
- `danger` pasa a `tint/red50` (el rojo de «Borrar cuenta»), icono y texto. Un
  recuento va en `value` («Archivados · 3» → «Archivados» con el 3 a la derecha).
- `Section` acepta `style` para quitar el margen de abajo dentro de una hoja.

Hojas tocadas:

| Hoja | Antes | Ahora |
|---|---|---|
| Plantillas · `···` de programa (6) y de sesión (3) | `SheetRow` sin icono | con icono |
| Clientes · `⋯` del programa (8) | `SheetRow` sin icono | con icono; archivados con el recuento a la derecha |
| Clientes · pulsación larga en la tarjeta (5) | `Modal` propio con `›` de texto | `DragSheet` + `SheetRow`; empezar en lima, preparar en azul, badge de sesiones nuevas |
| Editor de sesión · Añadir (3), `···` (5) y presets (N) | `SheetRow` sin icono / filas a mano con `✕` | con icono; el preset con su meta de subtítulo y el ✕ como icono |
| Historial · gestionar (2) | `SheetRow` rojo sin icono | con icono |
| Workout · Añadir (2) | filas a mano | `SheetRow` con icono |
| Inicio · sesión libre (3) y plantillas (N) | `MenuRow` sin icono | con icono |
| Mi programa · `⋯` (1) y archivar (2) | `MenuRow` sin icono | con icono; borrar historial con `danger` |
| Ficha de cliente · sesión libre (1 + N) | `MenuRow` sin icono, y todas las plantillas en la misma hoja | con icono, y en dos hojas como en Inicio: «En blanco» + «Desde tus plantillas» (con su número) → la lista |

Se quedan fuera, con motivo: los filtros del historial, el modo de historial del
código de cliente y las hojas de «+ cliente» y filtros de Clientes (son de
selección); las hojas que son formularios (nuevo programa, cobro, bloque,
progresión, variante…). El Alert de borrar un cobro (pulsación larga en la
fila del cobro) es de U33.

**Ronda de QA (29-sep-2026).** «Desde tus plantillas» pierde el `(N)`: el
número va a la derecha (`value`) y el subtítulo pasa a «Crea una copia de la
plantilla». Y un fallo de `DragSheet` que venía de antes: su `Modal` no llevaba
`statusBarTranslucent`/`navigationBarTranslucent` (la regla de borde a borde de
UI-MIGRATION §8), así que en Android la hoja acababa encima de la barra de
navegación pero sumaba `insets.bottom` igual: todas las hojas subían ese alto
con un hueco vacío debajo, y en el menú ≡, que llega al tope, la barra gris
tapaba las últimas filas. Poner las dos props no bastó —las hojas pasaron a
quedar debajo de los botones—: los márgenes se leían de la raíz de la app, y el
Modal es otra ventana. Ahora `DragSheet` lleva un `SafeAreaProvider` dentro y la
tarjeta mide los de su ventana. Y en el menú ≡, que desplaza, las filas se
cortaban en seco contra la franja de abajo: el contenido pasa a llegar hasta el
borde con el velo en degradado del Workout (`ui/NavScrim`, que sale de
`WorkoutScreen` para compartirse). En las hojas la zona de los botones va
**opaca** (`opaqueInset`) y el fundido empieza justo encima: con el velo del
Workout tal cual se veían las filas por debajo de los botones, y en una hoja
eso distrae. El margen va dentro del scroll, así que las hojas cortas acaban
donde acababan. Arriba, bajo la cabecera, el mismo fundido, pero solo al
desplazar (con la hoja quieta taparía la primera fila). El velo va de borde a
borde: con el `width="100%"` en el SVG se medía sin el padding de la hoja y
no llegaba a los lados.

Segundo fallo de la misma ronda: tocar una opción que abre OTRA hoja desmonta
la primera, pero su animación de cierre seguía y al acabar llamaba a su
`onClose`. En la ficha de cliente las dos hojas de «+ Sesión libre» comparten
estado, así que ese `onClose` tardío cerraba la de plantillas nada más abrirse.
`DragSheet` ya no avisa de cierres cuando está desmontada.

Probada la alternativa de tarjetas sueltas (radio completo y aire entre
opciones) y descartada: las hojas de opciones siguen agrupadas, como el menú ≡
y el resto de listas de opciones de la app.

**Trampa de iOS.** Si la acción abre OTRO Modal, la hoja se cierra al instante
(`setX(false)`) y no con la animación: iOS no presenta un Modal mientras otro se
está yendo. Así quedan el menú de la tarjeta de cliente (el editor de programa
es un Modal) y la hoja «Añadir» del Workout (el editor de bloque también).

**Probar U30**

- [x] Plantillas → `···` de un programa: seis filas con icono (ver, editar,
  duplicar, compartir, exportar y borrar en rojo), agrupadas con esquinas
  redondeadas arriba y abajo. Tocar una cierra la hoja deslizando y hace lo suyo.
- [x] Plantillas → pestaña Sesiones → `···`: editar, duplicar y borrar con icono.
- [x] Clientes → ficha → Programa → `⋯`: filas con icono; «Programas
  archivados» lleva el número a la derecha; borrar en rojo.
- [x] Clientes → pulsación larga en una tarjeta: sale la hoja de siempre de la
  app (se arrastra para cerrar), con el nombre del cliente de título. Un
  cliente sin app lleva primero EMPEZAR en lima; uno con app, «Preparar
  próxima sesión» en azul. Progreso lleva el badge de sesiones nuevas si hay.
  Editar programa abre el editor sin quedarse colgado (iPhone incluido).
- [x] Editor de sesión → «+ Añadir»: ejercicio, bloque y (si hay) desde preset,
  con icono. Desde preset: cada preset con su resumen debajo; el ✕ lo borra
  (con su aviso) y tocar la fila lo añade.
- [x] Editor de sesión → `···`: renombrar, compartir como texto, duplicar y
  borrar (rojo) con icono.
- [x] Historial → gestionar: las dos opciones de borrar en rojo con icono y el
  texto de ayuda debajo.
- [x] Workout de una sesión libre → «+ Añadir»: ejercicio y bloque con icono;
  «bloque» abre el editor de bloque sin quedarse colgado (iPhone incluido).
- [x] Inicio → «+ Sesión libre»: empezar ya, crear y desde plantillas con icono;
  la lista de plantillas también. «Desde tus plantillas» lleva el número de
  plantillas a la derecha (sin paréntesis) y de subtítulo «Crea una copia de la
  plantilla».
- [x] Android con botones de navegación: ninguna hoja deja un hueco vacío
  debajo ni se mete bajo los botones; la última fila queda justo encima.
- [x] Menú ≡ en Android: al desplazar, las filas se desvanecen justo encima de
  los botones (sin franja gris que las corte) y bajo los botones no se ve
  ninguna fila. Bajando hasta el final, la última fila queda entera encima. El
  fundido ocupa todo el ancho de la hoja.
- [x] Menú ≡ (y cualquier hoja que desplace): arriba, con la hoja quieta, la
  primera fila se ve entera; al empezar a bajar, las filas se desvanecen bajo
  la cabecera en vez de cortarse.
- [x] Workout: el velo de abajo sobre los botones de Android se ve igual que antes. En el menú ≡, bajando hasta el final
  se ve entera la última fila (nada gris la tapa).
- [x] Mi programa → `⋯` → Archivar: la hoja de archivar con «conservar» y
  «borrar historial» (rojo), las dos con icono.
- [x] Ficha de cliente → + Sesión libre: igual que en Inicio. «En blanco» y,
  si hay plantillas, «Desde tus plantillas» con el número a la derecha y
  «Crea una copia de la plantilla» debajo. Al tocarla se abre otra hoja con la
  lista; tocar una se la asigna al cliente con su aviso (iPhone incluido: el
  cambio de hoja no se queda colgado).
- [x] El menú ≡ se ve y funciona igual que antes (sus iconos ahora vienen del
  módulo común).

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
- `Animated` de RN core sigue en 16 ficheros. Se migra solo donde se toque.

## Fases

| Fase | Qué | Estado | Coste |
|---|---|---|---|
| U28 | Las pestañas de Progresión se deslizan con el segmentado (solo al tocar) | ✅ rama `feat/recap` — probada en dispositivo 30-sep | 🟢 |
| U29 | Reordenar el recap: resultados primero, entrada de datos agrupada | ✅ rama `feat/recap` — probada en dispositivo 29-sep | 🟡 |
| U30 | Una sola fila de opción con icono; hoja «Añadir» del Workout | ✅ rama `feat/recap` — probada en dispositivo 29-sep | 🟡 |
| U31 | Hueco delante de las sesiones libres | pendiente | 🟢 |
| U32 | Botones del programa de cliente fuera de la tarjeta | pendiente | 🟢 |
| U33 | `ui/ConfirmSheet` y fuera los `Alert.alert` | pendiente | 🟡 |
| U34 | Textos fijos a i18n; `PaywallModal`, `ProgramUpdateModal`, `ImportModal` a `DragSheet` | pendiente | 🟡 |
| U35 | `#b8ff00` como token del tema | pendiente | 🟢 |
| U36 | Cabecera de cerrar compartida; ✕ como icono | pendiente | 🟢 |
| U37 | `EmptyState` común | pendiente | 🟢 |
| U38 | Hoja de progresión única | pendiente | 🟢 |
