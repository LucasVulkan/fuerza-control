# Spec — Pulido de UI (apuntes)

> Tema: ui
> En corto: Mejoras visuales y de estandarización apuntadas el 29-sep-2026 para más adelante: pantallas que se deslizan con el segmentado, un recap legible, hojas de opciones y confirmaciones todas iguales, textos sin traducir, un solo lima, cabeceras, pantallas vacías y una hoja de progresión duplicada.
> Inicio: 2026-09-29
> Fase U09-01 · hecho · Progresión: las pantallas se deslizan con el segmentado · §1 · antes U28
> Fase U09-02 · hecho · Recap: distribución y legibilidad · §2 · antes U29
> Fase U09-03 · hecho · Hojas de opciones con icono y estandarizadas · §3 · antes U30
> Fase U09-04 · hecho · Sesiones libres: icono delante o sin hueco · §4 · antes U31
> Fase U09-05 · hecho · Programa de cliente: botones fuera de la tarjeta · §5 · antes U32
> Fase U09-06 · hecho · Confirmaciones y avisos sin Alert nativo · §6 · antes U33
> Fase U09-07 · hecho · Textos fijos a i18n y modales viejos a DragSheet · §7 · antes U34
> Fase U09-08 · hecho · Un solo lima, como token del tema · §8 · antes U35
> Fase U09-09 · hecho · Cabecera de cerrar compartida y ✕ como icono · §9 · antes U36
> Fase U09-10 · hecho · Pantalla vacía común, sin emojis · §10 · antes U37
> Fase U09-11 · terminado · Una sola hoja de progresión · §11 · antes U38
> Fase U09-12 · hecho · Editar sesión: la página se desliza al cambiar de sesión · §12 · antes U39
> Fase U09-13 · hecho · Importar archivo: el contenido de la hoja al estándar · §13 · antes U40
> Fase U09-14 · pendiente · Programas archivados: la lista al estándar · §14 · antes U41
> Fase U09-15 · hecho · Sesión libre: el bloque se edita en la pantalla de Editar bloque · §15 · antes U42
> Fase U09-16 · hecho · Inicio: banner de sesión en curso · §16 · antes U52
> Fase U09-17 · hecho · Descartar sesión dice cuál · §17 · antes U53
>
> Estado: **apuntes, no spec cerrada** (29-sep-2026). U09-01–U09-05 son notas del
> usuario; U09-06–U09-11 salen de una revisión del código el mismo día (solo código,
> sin mirar la app en el móvil). Los datos concretos (ficheros, líneas,
> recuentos) son de esa fecha y hay que revalidarlos antes de implementar, y el
> diseño de cada fase está sin cerrar. Fases independientes entre sí salvo lo
> que se dice en cada una.

## 1. U09-01 — Progresión: las pantallas se deslizan con el segmentado

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

**Probar U09-01**

- [x] Progresión → tocar Carga y luego Historial: el contenido se desliza de
  lado a la vez que el resalte, sin corte, y vuelve igual hacia la izquierda.
- [x] Saltar de Ejercicios a Historial de un toque: cruza Carga deslizando,
  sin parpadeos.
- [x] Al volver a una pestaña ya visitada, conserva el scroll y los filtros.
- [x] Clientes → ficha → Progreso (sin Historial, dos segmentos): igual.
- [x] Borrar una sesión en Historial: solo sale esa tarjeta por la derecha.
- [x] Tirar para refrescar en Ejercicios y en Carga sigue funcionando.

## 2. U09-02 — Recap: distribución y legibilidad

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

**Probar U09-02**

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

## 3. U09-03 — Hojas de opciones con icono y estandarizadas

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
fila del cobro) es de U09-06.

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

**Probar U09-03**

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

## 4. U09-04 — Sesiones libres: icono delante o sin hueco

Las filas de sesiones libres dejan un espacio vacío delante. O se pone un icono
en ese hueco o se elimina el espacio. La lista está en `HomeScreen.jsx`
(bloque «Sesiones libres», ~432); las filas de sesión de programa llevan la
letra en ese hueco (`marker` en `SessionList.jsx`).

**Hecho (30-sep-2026): número.** Las sesiones libres llevan 01, 02… en el
hueco, con la misma fuente que las letras de las sesiones que no son la de hoy
(`sesGlyph`) y en el gris de las sesiones hechas (`sesGlyphDone`, prop
`markerMuted` de `SessionRow`), no en lima: numeran, no dicen qué toca. También en la ficha de cliente (`ClientSessions.jsx`), que tenía
el mismo hueco. La columna de `sesGlyph` pasa de `width: 24` a `minWidth: 24`
(dos cifras no cabían) y lleva cifras tabulares para que los nombres queden
alineados entre sí.

**Probar U09-04**

- [x] Inicio → Sesiones libres: cada fila lleva 01, 02… en gris delante del
  nombre, y los nombres quedan alineados entre ellos.
- [x] Las filas de sesiones del programa siguen igual (letra y nombre en su
  sitio).
- [x] Clientes → ficha de un cliente sin app → sus sesiones libres: igual.

## 5. U09-05 — Programa de cliente: botones fuera de la tarjeta

En el programa de un cliente, los botones van pegados a la tarjeta. Tienen que
separarse como en el tab «Programa» (ver [U07-tab-programa.md](U07-tab-programa.md);
`MyProgramScreen.jsx` pone las acciones en un grupo de `MenuRow` aparte).

La tarjeta del cliente es `AssignedProgramCard`, dentro de
`ClientsScreen.jsx` (5.095 líneas). Al tocarla, sacarla a su propio fichero.

**Hecho (30-sep-2026).** El pie de dentro de `ProgramCard` (Editar · Ver ·
`⋯` con filetes) desaparece: ya solo lo usaba la ficha. Los botones sueltos del
tab Programa pasan a `ProgramActions`, exportado desde `ui/ProgramCard.jsx`, y
lo usan las dos pantallas. `AssignedProgramCard` se queda en `ClientsScreen`:
el cambio allí son tres líneas y sacarla no hacía falta para esto. Además, a
petición del usuario, la tarjeta pasa a `radius/md` (el de los botones) y los
botones quedan a `space/sm2` de ella, la misma separación que entre ellos.

**Probar U09-05**

- [x] Clientes → ficha → Programa: Editar, Ver y `⋯` van debajo de la
  tarjeta, sueltos, iguales que en el tab Programa. La tarjeta ya no lleva pie.
- [x] Cada botón hace lo de antes: Editar abre el editor, Ver el visualizador y
  `⋯` la hoja de opciones del entrenador.
- [x] Tab Programa: sin cambios (Editar solo si se puede editar, `⋯` solo si
  el programa es tuyo).

## 6. U09-06 — Confirmaciones y avisos sin Alert nativo

`DragSheet` y `UI-MIGRATION` §9 prohíben el `Alert` nativo (en Android no se
puede estilar), pero hay **64 `Alert.alert` en 24 ficheros**. Los que más:
`ClientsScreen` (19), `DriveBackupScreen` (9), `SessionEditorScreen` (5),
`TrainerSyncModal` (5).

- Unas 20 son confirmaciones de borrar o descartar. Plantillas ya tiene una
  hoja de confirmación dentro de `ProgramScreen.jsx` (`confirmRow`,
  `confirmCancel`, `confirmDelete`): sacarla a `ui/ConfirmSheet` y usarla en
  todas.
- El resto son avisos de error: valorar pasarlos a `Toast`.

**Decidido (30-sep-2026), con la maqueta
[`docs/mockups/confirm.html`](../mockups/confirm.html):** diálogo **centrado**,
no hoja inferior, y detrás un **velo**, no blur.

- Centrado porque desde U09-03 una hoja inferior es elegir entre opciones, y
  muchas confirmaciones salen desde una hoja abierta: una hoja sobre otra se
  confunde. Además una hoja se cierra arrastrando, que en algo destructivo se
  hace sin querer.
- Velo (el negro al 60 % de `DragSheet`) y no blur: en Android `expo-blur` no
  difumina lo que hay debajo de un `Modal`, que es otra ventana.
- Estructura fija: **título** (la acción), **una frase** (qué pasa y qué no se
  pierde) y **botones con verbo**. Cancelar siempre a la izquierda en gris; la
  acción a la derecha, en rojo si destruye (`tint/red-30` + `redText`) y en
  lima si solo cambia algo. Un aviso lleva un solo botón, «Entendido».
  Tocar el velo o el atrás de Android = Cancelar.

**Hecho (30-sep-2026).** `ui/dialog.js` (`showDialog`) + `ui/DialogHost.jsx`,
montado una vez en `RootNavigator` junto al Toast. `showDialog` tiene la misma
firma que el `alert` nativo, así que los 65 `Alert.alert` se cambiaron por
nombre sin tocar sus `onPress`. `dialog.test.js` falla si vuelve a aparecer
uno en `src`. La hoja de confirmar borrado de Plantillas (`ConfirmDeleteSheet`)
también pasa al diálogo: todas iguales.

- **A `Toast`** (10): los errores de pantallas normales, que no piden decidir
  nada: subir el programa y enviar ajustes (Clientes), enviar la próxima sesión
  y los de Drive (conectar, guardar, restaurar, borrar).
- **Siguen como aviso de un botón** los errores que saltan dentro de una hoja
  o un modal (sincronización, Google, borrar cuenta, pago, «Pasar a la app»,
  Info del cliente): el Toast va por debajo de los `Modal` y no se vería. Y
  los que explican algo (archivo no válido, permiso de Drive caducado).
- De paso: los cuatro «Descartar sesión» llevaban la pregunta de título y sin
  frase; ahora título «Descartar sesión» y la pregunta de frase. Dos botones
  con texto fijo («Cancelar», «Eliminar») pasan a i18n.
- **Pendiente para U09-07:** títulos con interrogación y textos fijos en el
  título o la frase («¿Eliminar etapa?», «Error», «Error en la compra»…).

**Probar U09-06**

- [x] Plantillas → borrar un programa, y Editar sesión → `⋯` → eliminar
  sesión: sale el diálogo centrado sobre el velo, Cancelar a la izquierda y
  Eliminar en rojo. Cancelar no hace nada; Eliminar borra.
- [x] Tocar el velo o el atrás de Android cierra sin hacer nada.
- [x] Ficha de cliente → Programa → `⋯` → eliminar o reactivar un programa: el
  diálogo sale por encima aunque venga de la hoja (Android).
- [ ] Lo mismo en **iPhone**, que es donde un `Modal` sobre otro puede fallar.
- [x] Empezar otra sesión con una a medias: «Descartar sesión» de título y la
  pregunta debajo.
- [x] Reemplazar el programa activo de un cliente: la acción sale en lima.
- [x] Editar una sesión libre que estás haciendo → borrarla: aviso con un solo
  botón, «Entendido».
- [x] Sin conexión, subir el programa de un cliente: sale un toast rojo, no un
  diálogo.

## 7. U09-07 — Textos fijos a i18n y modales viejos a DragSheet

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

**Parte 1 hecha (30-sep-2026): textos a i18n.**

- Los tres modales enteros (`paywall.*`, `programUpdate.*`, `import.*` —este
  último ya existía de la versión web, sin usar y con otros textos: se
  reescribe con los que enseña el modal), los de Clientes (título de importar,
  código, sincronización, la pantalla sin Pro y tres toasts) y los sueltos
  («Sin sesión activa», «NOTA», «CUSTOM» → `exerciseSelector.customBadge`,
  «PROPIO» en español).
- Las líneas de «Tu entrenador ha modificado el programa» las montaba
  `buildProgramDiff` en español dentro del store. Ahora devuelve `{ k, p }`
  (clave de `programUpdate.diff` y parámetros) y las traduce el modal al
  pintarlas; una actualización pendiente de antes, guardada como texto, se
  pinta tal cual.
- Títulos de diálogo sin interrogación (regla de U09-06), en los dos idiomas:
  «Eliminar etapa», «Restaurar esta copia», «Cambiar a {{name}}»… (diez). Los
  «Error» fijos pasan a `common.error`, que faltaba (Onboarding lo pedía con
  respaldo), y los respaldos «No se pudo…» a sus claves.
- Se quedan sin traducir a propósito: «Forma» y «PRO» (marca) y «RPE».

**Probar U09-07**

- [x] Con la app en inglés: Clientes sin Pro, el modal de pago, importar un
  archivo (backup y programa) y la ficha de un cliente → Info salen en inglés.
- [x] Con la app en inglés, cuando el entrenador cambia el programa: el aviso y
  sus líneas («+1 new stage», «A: +2 exercises»…) salen en inglés.
- [x] En español, los mismos sitios dicen lo de antes; los diálogos de borrar
  etapa, restaurar copia, desconectar, etc. ya no llevan «¿?» en el título.

**Parte 2 hecha (30-sep-2026): modales viejos.**

- **A `DragSheet`** (elegir entre opciones): el de pago (se cierra arrastrando;
  fuera su ✕ y su asa), importar archivo (título en la cabecera de la hoja,
  IMPORTAR a todo lo ancho; Cancelar es cerrar la hoja), importar para un
  cliente (las tres formas como `SheetRow` con icono y subtítulo) y, de paso,
  otros dos `Modal` propios de Clientes con el mismo velo 0.7: la hoja de Info
  del cliente y el `⋯` de un programa archivado (ahora filas de U09-03:
  reactivar, exportar, eliminar en rojo). Fuera `GhostBtn` y sus estilos.
- **Actualización del programa → diálogo** (es una decisión, no un menú): sale
  con `showDialog`, que gana `options.items`, una lista con scroll en una caja
  `surface2` bajo la frase. Título «Tu entrenador ha modificado el programa»,
  frase «Sigues en tu etapa y tu semana», la lista de cambios y Ahora no /
  Actualizar (lima). Fuera la ceja «ACTUALIZACIÓN».
- **Quedan con `Modal` propio** (fuera del alcance de U09-07): archivados del menú
  ≡ (→ U09-14), el editor de bloque de la sesión libre en el Workout (→ U09-15), el
  detalle de ejercicio de Progresión (velo 0.82) y las notas del entreno
  (`NotesModal`, 0.6). El contenido de Importar archivo sigue viejo (→ U09-13).

**Probar U09-07**

- [x] Clientes sin Pro → Ver planes PRO (y Plantillas, y el menú ≡): el pago
  sale como hoja, se cierra arrastrando o tocando fuera.
- [x] Menú ≡ → importar un backup y un programa: hoja con el título arriba, el
  fichero y su tipo, las opciones y IMPORTAR abajo; «Listo» o arrastrar
  cancela. Importar hace lo de antes.
- [x] Ficha de cliente → `⋯` → importar programa: hoja con las tres formas,
  cada una con icono y explicación; tocar una importa.
- [x] Clientes → Info de un cliente: hoja estándar con el nombre de título y
  el código (copiar sigue funcionando).
- [x] Ficha → Programa → archivados → `⋯`: hoja con reactivar, exportar y
  eliminar (en rojo, con su diálogo).
- [x] Como cliente, cuando el entrenador cambia el programa: diálogo centrado
  con la lista de cambios; Ahora no lo aparca, Actualizar lo aplica.

## 8. U09-08 — Un solo lima, como token del tema

El `accent` de `formaFit` es `#aae216`, pero hay un `'#b8ff00'` escrito a mano
en 5 ficheros: `HomeScreen` y `SessionList` (constante `LIMA`),
`ProgramScreen` («literal de Figma, distinto de color/accent»),
`CustomExerciseScreen` y `ExerciseSelectorScreen`. Ese color no cambia con el
tema. Pasa a un color del tema con nombre propio (ya existe
`accent10: rgba(184,255,0,0.1)` con esa base en `themes.js`).

**Hecho (30-sep-2026): un solo lima, `accent`.** El usuario eligió unificar en
vez de darle token propio a `#b8ff00`: todo pasa a `th.colors.accent`
(`#aae216`). Cambia a la vista, un punto menos chillón, en Inicio (letra de hoy
y puntos entrenados de la semana, letra de las sesiones, check, compartir,
chevron y texto del botón de la tarjeta de hoy) y en tres botones de relleno
(Crear ejercicio, el selector de ejercicios y el de Plantillas). Las tintas
`tint/accent-10` y `tint/accent-50` siguen con base `#b8ff00`: ya son tokens
del tema y vienen así de Figma.

**Probar U09-08**

- [x] Inicio: la letra de hoy de la semana, los puntos entrenados, las letras
  de las sesiones y la tarjeta de hoy se ven en el mismo lima que el resto de la
  app (pestañas, segmentados).
- [x] Crear ejercicio, el botón del selector de ejercicios y Plantillas: el
  relleno lima es el mismo.

## 9. U09-09 — Cabecera de cerrar compartida y ✕ como icono

`DocsScreen`, `DriveBackupScreen`, `TrainerConnectionScreen` y
`CustomExerciseScreen` llevan el mismo bloque `header`/`headerTitle`/`iconBox`
copiado igual. Sale a una pieza compartida (o a una variante de
`ui/ScreenHeader`).

La ✕ de cerrar o borrar es un carácter de texto en unos 10 sitios
(`PaywallModal`, `ProgressTab`, `ExerciseCard`, `ClientsScreen`,
`ExerciseEditorInline`…), cuando el resto de iconos son SVG de línea.

**Hecho (30-sep-2026).**

- **Cabecera:** las cuatro pantallas entran deslizando desde la derecha, así
  que la ✕ a la derecha (que dice «cierro algo que se abrió encima») no les
  tocaba. Pasan a `ScreenHeader`, como el resto de pantallas a las que se
  navega: ‹ a la izquierda, ceja en lima y el nombre debajo. Ceja = la sección
  del menú de la que cuelgan (CUENTA para Documentación, CONEXIONES para Drive y
  Entrenador) y «Ejercicio propio» (`customExercise.eyebrow`) para Nuevo
  ejercicio. Lo primero bajo la cabecera lleva `paddingTop: spacing.md`, el
  aire del editor de sesión. Fuera las cuatro copias de
  `header`/`headerTitle`/`iconBox`/`closeGlyph`.
- **Nuevo ejercicio:** «Crear» (ahora «Añadir») sube a la cabecera, a la derecha, con el mismo
  botón que «Añadir» del selector de ejercicios (lima; en `surface2` mientras
  no hay nombre, pero pulsable para marcar el campo). El botón Cancelar de
  abajo desaparece: cancelar es ‹.
- **✕ como icono:** los diez botones con una ✕ de texto pasan a `CloseIcon`
  (`EditorIcons`), con el mismo color: cerrar el modal de pago y el de
  Progresión, borrar la búsqueda (Progresión ×2, Clientes, selector de
  ejercicios), quitar un paso de calentamiento, una serie descendente, una fila
  de facturación, una etiqueta (×2) y la etiqueta de su píldora. Tamaño 16
  donde el carácter era de 14 px y 14 donde era de 12 (la cruz ocupa la mitad
  de su caja). No se tocan las «×» de multiplicar ni la ✕ de ronda fallida del
  bloque de acondicionamiento, que es un estado en pareja con ✓.
- **Pendiente:** junto a la ✕ de las etiquetas de Clientes quedan ✓ y ✎ de
  texto.

**Probar U09-09**

- [x] Menú → Documentación, Copia en Drive y Entrenador: barra con ‹ a la
  izquierda, ceja en lima y el nombre debajo; ‹ vuelve. El contenido no queda
  pegado a la línea de la cabecera.
- [x] Selector de ejercicios → Crear ejercicio: igual, con «Ejercicio propio»
  de ceja. «Añadir» está arriba a la derecha, apagado hasta escribir un nombre;
  pulsarlo sin nombre marca el campo. Abajo ya no hay botones; ‹ cancela.
- [x] Las ✕ de borrar búsqueda (Clientes, selector, Progresión), cerrar el
  modal de Progresión y el de pago, quitar un paso de calentamiento y una serie
  descendente, y las de etiquetas y facturación en Clientes: son una cruz de
  línea, del tamaño y color de antes, y siguen haciendo lo suyo.

## 10. U09-10 — Pantalla vacía común, sin emojis

Cinco pantallas vacías con emoji a 32 o 40 px: 📭 `HistoryList`, 📈
`ProgressTab`, 🏋️ `NoProgram`, 👥 `ClientsScreen` (dos veces). Las cinco se
cambian por un componente `EmptyState` con icono de línea (como `RowIcon`),
título y texto.

**Revisado contra el código (3-oct-2026).** Las cinco siguen ahí, pero no son
las únicas pantallas vacías: hay otras cuatro sin emoji y cada una con su
tipografía y su botón (`ProgramScreen` ×3: puerta PRO, sin sesiones, sin
plantillas; `LoadTab`). Una pieza «común» que deja fuera cuatro de nueve no
lo es. Y quedan emojis fuera de las pantallas vacías.

### 10.1 La pieza

`components/ui/EmptyState.jsx`, de arriba abajo y centrado:

- **Icono** (opcional): un trazo de `ROW_ICON`, a 32 px en `mutedLight`.
  `RowIcon` gana `size` (por defecto 18, como ahora) y `strokeWidth` (por
  defecto 2.4); aquí 32 y 1.8, para que el trazo no engorde al escalar. Sin
  caja ni círculo detrás: va donde iba el emoji.
- **Título** (opcional): `textStyles.bodyStrong`, `text`.
- **Texto**: `textStyles.body`, `mutedLight`, centrado, `lh(body)`.
- **Acción** (opcional, `{ label, onPress }`): el botón lima que ya usa
  `ProgramScreen` (`cta`: alto 44, `radius.md`, `labelStrong` en `onAccent`).
  Hoy hay tres botones distintos para lo mismo (`NoProgram` en `radius.md` con
  `button`/`bg`, la puerta PRO de Clientes en `radius.sm`), se quedan en uno.
- **Secundaria** (opcional, `{ label, onPress }`): texto en `mutedLight`, el
  «Ocultar pestaña» de las puertas PRO.
- `gap: spacing.md`, `paddingHorizontal: spacing.xxl`; `style` para que quien
  la usa diga si ocupa la pantalla (`flex: 1`, centrado vertical) o va en una
  lista (`paddingVertical`).

### 10.2 Dónde

| Sitio | Icono | Título | Acción |
|---|---|---|---|
| `HistoryList` (📭) | `history` | — | — |
| `ProgressTab` (📈) | `progress` | — | — |
| `LoadTab` | `progress` | — | — |
| `NoProgram` (🏋️) | `exercise` | — | Nuevo programa |
| Clientes, puerta PRO (👥) | `user` | sí | PRO + ocultar pestaña |
| Clientes, sin clientes (👥) | `user` | — | — |
| Plantillas, puerta PRO | `preset` | sí | PRO + ocultar pestaña |
| Plantillas, sin sesiones | `preset` | — | Crear |
| Plantillas, sin plantillas | `preset` | — | Crear |

«Sin plantillas» pierde su título («Plantillas»): repetía la cabecera
«PLANTILLAS · 0» que tiene justo encima. Los títulos de Plantillas pasan de
`title` a `bodyStrong`, como Clientes.

Fuera: los avisos de una línea dentro de una lista o una hoja («sin sesiones
en este filtro», «sin datos de peso», facturación, gráficas) no son pantallas
vacías y se quedan como están.

Limpieza: `HomeScreen` conserva `emptyState`/`emptyIcon`/`emptyText`/
`newProgramBtn*` en sus estilos sin usarlos desde que eso se mudó a
`NoProgram`; se borran.

### 10.3 El resto de emojis

- Copiar el código del cliente (Clientes → Info): 📋 / ✓ de texto (a 18 px,
  fuera de la escala) → `ROW_ICON.duplicate` / `CheckIcon`, en `mutedLight` y
  lima al copiar.
- Nota del ejercicio en el historial (`SessionCard`, 📝) y nota del entrenador
  en el Workout (`ExerciseCard`, 📋): el emoji delante del texto → `ROW_ICON.text`
  a 13 px en `mutedLight`, en fila con el texto (el texto sigue siendo el que
  se recorta/expande).
- Aviso de fin de descanso (`services/timerNotification.js`): título y cuerpo
  en castellano a pelo (`'✅ ¡A por la siguiente serie!'`, «descansaste bien»,
  «¡Descanso terminado!») → claves i18n en `es`/`en`, sin el ✅. Se le escapó
  a U09-07.
- **Se quedan:** los emojis de la lista de ventajas del `PaywallModal` (cambiarlos
  pide iconos que no existen —facturación— y va con el rediseño del pago) y
  los ⬆/⬇ de `utils/progression.js` (son datos del motor, no se pintan tal cual).

**Hecho (3-oct-2026).** `components/ui/EmptyState.jsx` y `RowIcon` con `size` y
`strokeWidth` (por defecto 18 y 2.4, las filas no cambian). Las nueve pantallas
de la tabla lo usan, cada una con el `flex: 1` o el `paddingVertical` que ya
tenía; `NoProgram` se queda como envoltorio (lleva el aviso de desconexión) y
solo cambia lo que pinta. Fuera los estilos `empty*`, `proBtn*`, `hideTabBtn*`
y `newProgramBtn*` de `ClientsScreen`, `ProgramScreen`, `HomeScreen`,
`NoProgram`, `HistoryList`, `ProgressTab` y `LoadTab` (`emptyText` de Clientes y
`cta` de Programa siguen: los usan otros sitios). `templates.title` se queda: es
la cabecera «PLANTILLAS · N».

Lo que salió distinto de lo previsto o que la spec no fijaba:

- Los dos botones secundarios de «Ocultar pestaña» pasan a `labelStrong` (el de
  Clientes iba a `label`); es el del `ProgramScreen`.
- El texto de `NoProgram` pasa de `muted` a `mutedLight`, como el resto.
- Las notas: el icono va en `mutedLight` y el texto conserva su color (lima en
  `SessionCard`, `text` en la del entrenador); el icono se centra en la primera
  línea con un `marginTop` calculado.
- `timerNotification.js` tenía más texto fijo que los tres citados: también los
  dos nombres de canal de Android («Temporizador de descanso», «Fin de
  descanso») y el título y cuerpo de la notificación de cuenta atrás
  («Descansando…»). Todo en `restTimer.notif*`. Se traduce con `i18n.t` en el
  momento de mostrar; los canales se nombran al arrancar, con el idioma que
  haya entonces (el idioma guardado se aplica al rehidratar, que puede llegar
  después), y se corrigen en el siguiente arranque.
- No se toca `infoCodeText` (16 px, ver «Otros detalles»): solo el botón de copiar.

**Probar U09-10**

- [ ] Historial sin sesiones (programa actual y «todas»): un icono de reloj
  de línea en gris con el texto, sin emoji.
- [ ] Progresión → Ejercicios sin datos (primera sesión, búsqueda sin
  resultados, sin datos): icono de barras de línea y el texto adecuado a cada caso.
- [ ] Progresión → Carga sin sesiones o sin RPE: icono de barras y su texto,
  centrado, y el pull to refresh sigue funcionando.
- [ ] Inicio y Programa sin programa activo: icono de pesa de línea, el texto y
  el botón lima «Nuevo programa» que sigue haciendo lo mismo (y con un
  entrenador vinculado, avisa antes de desvincular).
- [ ] Clientes sin PRO: icono de persona, título, texto, botón PRO lima (abre el
  pago) y «Ocultar pestaña» en gris debajo, que sigue ocultándola y vuelve a Inicio.
- [ ] Clientes PRO sin clientes (y buscando algo que no existe): icono de
  persona y el texto, centrado en la pantalla.
- [ ] Plantillas sin PRO: icono de marcador, título, texto, botón PRO y
  «Ocultar pestaña», igual que Clientes.
- [ ] Plantillas → Sesiones sin ninguna: icono, texto y botón «Crear» que
  crea una sesión como antes.
- [ ] Plantillas → Programas sin ninguno: icono, texto y botón «Crear», y ya no
  repite el título «Plantillas» sobre la cabecera «PLANTILLAS · 0».
- [ ] Clientes → ficha → Info de un cliente con código: el botón de copiar
  enseña un icono de copiar en gris; al pulsarlo pasa a una marca lima
  durante un momento y el código queda copiado.
- [ ] Historial → abrir una sesión con una nota de ejercicio: el icono de
  documento en gris delante del texto, y el texto no se desborda.
- [ ] Workout de un cliente con nota del entrenador en un ejercicio: icono de
  documento delante; la nota se recorta a una línea y se expande al tocarla.
- [ ] Fin de descanso con la app en castellano: la notificación sale en
  castellano, sin el ✅ («¡A por la siguiente serie!»).
- [ ] Lo mismo con la app en inglés: título y cuerpo salen en inglés, y los
  canales de notificación de la app en los ajustes de Android también.

## 11. U09-11 — Una sola hoja de progresión

La hoja de progresión de `editor/ExerciseEditorInline.jsx` y la de
`CustomExerciseScreen.jsx` son copias y ya no coinciden: al alta de ejercicio
le falta el paso «Cuándo se cumple» (`stepEval`) y numera 3 el incremento.
Sacar una sola pieza, y decidir si el alta debe tener el paso de evaluación.
Al usuario (29-sep-2026) no le cuadra que se quitara en el alta; lo más
probable es una simplificación fuera de lugar. Se decide al llegar a la fase.

**Resuelto por P12-10 (3-oct-2026, `2c2dc25`).** La hoja salió a
`components/editor/ProgressionSheet.jsx` y la usan el editor y el alta, con
todos los pasos (también «Cuándo se cumple»). Nada más que hacer aquí; las
pruebas van en P12-10.

## 12. U09-12 — Editar sesión: la página se desliza al cambiar de sesión

Al cambiar de sesión con el segmentado de Editar sesión, la lista hacía el
fundido de fábrica de `react-native-sortables` (cambian todos los ids). Ahora
la página entera se desliza de lado como en Progresión (U09-01).

**Hecho (30-sep-2026), sin pager.** Un pager de verdad obligaba a sacar el
cuerpo de la sesión a un componente por sesión y a sacar el segmentado del
scroll, que es un cambio de diseño. En su lugar, en `SessionEditorScreen.jsx`
resumen, lista y «Añadir» van en un `Reanimated.View` con `key={templateId}` y
`entering`/`exiting` propios, en worklet: leen la dirección de un
`useSharedValue` que fija `switchSession` y trasladan un ancho de pantalla con
`SegmentedControl.TIMING`. Un `LayoutAnimationConfig skipEntering
skipExiting` quita el fundido de las filas al montar y desmontar la página;
añadir o borrar un ejercicio lo sigue haciendo. Al abrir el editor, dirección
0: no desliza. La página se remonta en cada cambio, como antes: no conserva el
scroll ni la fila abierta.

**Probar U09-12**

- [x] Cambiar a una sesión posterior: la vieja sale por la izquierda y la
  nueva entra por la derecha, a la vez que el resalte. A una anterior, al revés.
- [x] Al abrir el editor, la página no desliza.
- [x] Añadir o borrar un ejercicio sigue haciendo su fundido.
- [x] Reordenar arrastrando funciona justo después de cambiar de sesión.

## 13. U09-13 — Importar archivo: el contenido de la hoja al estándar

Visto por el usuario al probar U09-07 (30-sep-2026): la carcasa ya es `DragSheet`,
pero lo de dentro sigue siendo la interfaz vieja de `ImportModal.jsx`
(`AppHeader`, `ExternalImportModal` y `OnboardingScreen` la usan):

- Backup completo: tarjetas `surface2` con borde y un `Switch` nativo por
  sección, y dentro de historial y plantillas unos botones Combinar /
  Reemplazar propios con una pista en rojo.
- Programa: botones de radio propios (círculo + punto) en tarjetas con borde
  que se tiñen de lima al elegir.
- Un aviso en caja roja arriba, y la pastilla del tipo de fichero con borde.

Llevarlo a las piezas de la app: filas `MenuRow` agrupadas en `Section` (con
interruptor donde hoy hay `Switch`), el `SegmentedControl` para Combinar /
Reemplazar, y para elegir el modo las filas de hoja con marca de elegida.
Necesita maqueta antes: son decisiones de diseño, no de código.

**Decidido (30-sep-2026)** con [`docs/mockups/import.html`](../mockups/import.html)
(variante **B**) y [`docs/mockups/choice.html`](../mockups/choice.html):

- **Pieza nueva y estándar, `ChoiceRow`** (en `ui/MenuList.jsx`), para toda
  elección excluyente de dos o más opciones: `MenuRow` con un radio a la
  derecha, centrado en vertical. Apagado, aro `muted`; elegida, aro y punto
  lima (el radio clásico, marcador 3 de la maqueta) **y un filo lima a la
  izquierda** de la fila (el de las superseries, marcador 5). Toda la fila se
  pulsa.
- **Regla:** una elección nace SIN elegir solo si elegir mal cuesta algo
  (borrar datos). Si hay una opción segura evidente, viene elegida. Con una
  obligatoria sin elegir, el botón va apagado pero pulsable, y al pulsarlo la
  sección que falta dice «Elige una» en rojo al lado de su título.
- Backup: programa, ejercicios propios y clientes con interruptor (el de la
  app, no el nativo); historial y plantillas como elección de tres (no
  importar · añadir las que falten · sustituir, esta en rojo), sin elegir al
  abrir. Programa: sus formas como `ChoiceRow` con explicación, la primera
  elegida. Lo que el archivo no trae, apagado con «No hay en este archivo».
  Fuera la caja roja de aviso y la pastilla del tipo (va detrás del nombre, en
  versales lima). Botón «Importar» de la app. Nombres de las formas acortados
  («Programa e historial», «Solo el historial», «Solo el programa»).

**Hecho (30-sep-2026).** `ImportModal.jsx` reescrito con esas piezas; mismo
contrato de `sections` con `importData`. `import.*` de los locales rehecho.

**Ajustes tras probarlo (30-sep-2026, usuario):**

- La cabecera de toda `DragSheet` dice **«Cerrar»** y no «Hecho»/«Listo»:
  cierra sin hacer nada más, y «Hecho» parecía una acción. Norma general:
  el texto de esa esquina es «Cerrar» salvo que la hoja pase una `action`
  que haga algo.
- `ChoiceRow`: radio de 20 (punto de 10), no de 22. **Las opciones llevan
  icono**, como el resto de filas de hoja: no importar (círculo tachado,
  `ROW_ICON.skip`, nuevo), añadir (`new`), sustituir (`sync`, en rojo), y las
  formas de importar un programa (`import`, `history`, `text`). Las filas con
  interruptor también (programa, ejercicios, clientes).
- «Elige una» a la derecha del título, en su misma línea.
- «Añadir las que falten» → «Añadir las nuevas».
- Clientes solo suma (los del archivo se añaden o actualizan al mismo cliente,
  los tuyos se quedan): lo dice su explicación, «3 clientes · se suman a los
  tuyos».
- De paso, la hoja de **exportar** del menú ≡ tenía sus dos filas pegadas (un
  `View` sin separación): pasa a `Section`.
Pendiente de otra fase: pasar a `ChoiceRow` las elecciones que hoy marcan con
un check suelto (etapas de Mi programa, frecuencia de Drive, modo de historial
del código de cliente…).

**Probar U09-13**

- [x] Menú ≡ → importar un backup completo: interruptores de programa,
  ejercicios y clientes (lo que no trae el archivo, apagado); historial y
  plantillas sin elegir e «Importar» en gris.
- [x] Pulsar «Importar» sin elegir: no importa y sale «Elige una» en rojo junto
  al título que falta; se va al elegir. Con todo elegido, «Importar» en lima.
- [x] Elegir una opción: aro y punto lima y el filo a la izquierda; elegir otra
  apaga la anterior. «Sustituir…» va en rojo.
- [x] Importar con «Añadir las nuevas» y con «Sustituir…»: hace lo de antes
  (combinar / reemplazar).
- [x] Importar un programa: tres formas (dos si no trae historial), la primera
  elegida, e importa según la elegida.
- [x] Todas las filas de la hoja llevan icono; «Elige una» sale a la derecha.
- [x] Cualquier hoja (exportar, `⋯`, filtros…): arriba a la derecha dice
  «Cerrar».
- [x] Menú ≡ → Exportar: las dos filas separadas, como el resto de listas.

## 14. U09-14 — Programas archivados: la lista al estándar

Dos listas de programas archivados con interfaz vieja:

- Ficha de cliente → Programa → archivados (`ClientsScreen`,
  `ArchivedProgramRow` dentro de una `DragSheet`): cada fila lleva tres iconos
  sueltos (ver, descargar, `⋯`). El `⋯` ya abre la hoja estándar (U09-07).
- Los tuyos, desde el menú ≡ (`AppHeader`, `ArchivedProgramsModal`): sigue
  siendo un `Modal` propio con su velo (0.7).

Las dos, a la misma pieza: filas de la app y las acciones en el `⋯` (hoja de
opciones de U09-03), y la del menú ≡ a `DragSheet`. Maqueta antes.

## 15. U09-15 — Sesión libre: el bloque se edita en la pantalla de Editar bloque

En una sesión libre en curso, añadir un bloque de acondicionamiento en el
Workout (o tocar editar en uno) abre `BlockEditorInline` dentro de un `Modal`
a pantalla completa propio de `WorkoutScreen` (barra con el nombre y
«Aceptar»). Desde el editor de sesión el mismo editor es una pantalla,
`BlockEditorScreen`, con la cabecera estándar (‹ y ✓). Que el Workout navegue
a esa pantalla en vez de montar la suya; hay que ver cómo trabaja con el
`templateId` `'__free__'` de la sesión libre.

**Revisado contra el código (3-oct-2026).** El store ya acepta `'__free__'`
en `addBlockToSession`/`updateBlock`/`removeBlockFromSession` (escriben en
`activeSession.freeBlocks`), así que `BlockEditorInline` vale tal cual. Lo que
no vale de `BlockEditorScreen` con ese id:

- **Lee los bloques de `sessionTemplates[templateId]`**, que para `'__free__'`
  no existe: la pantalla saldría vacía (`!block` → `null`). Para `'__free__'`
  los bloques son `activeSession.freeBlocks` (y de ahí también el desplegable
  para saltar entre bloques).
- **El ✓ es `useEditorExit().done`**: marca el programa activo como pendiente
  de reenviar a sus clientes, dice «Programa editado» y `backToMain` desapila
  hasta Main, **sacándote del entreno**. Con `'__free__'` el ✓ hace lo mismo
  que ‹: `navigation.goBack()`, sin toast ni marcas (la sesión libre no es de
  ningún programa; los bloques ya están escritos en el momento).

Y de paso se arregla un fallo de hoy: dentro del `Modal`, «Añadir movimiento»
navega a `ExerciseSelector`, que es una pantalla del stack y se abre **debajo**
del modal. Como pantalla, el selector entra encima y vuelve al bloque.

En `WorkoutScreen`: añadir bloque = `addBlockToSession('__free__', bloque)` y
`navigate('BlockEditor', { templateId: '__free__', blockId })`; el lápiz del
bloque, lo mismo sin añadir. Fuera el `Modal`, `editingBlockId`,
`blockScrollRef`, los estilos `blockHeader*`/`modalSafe` y los imports que
queden sin uso (`GestureHandlerRootView`, `BlockEditorInline`…).

**Hecho (3-oct-2026).** `BlockEditorScreen` toma los bloques de
`activeSession.freeBlocks` cuando `templateId` es `'__free__'` y su ✓ hace
`goBack()` en ese caso; con cualquier otra plantilla no cambia. `WorkoutScreen`
navega a esa pantalla al añadir un bloque y desde el lápiz, y pierde el `Modal`,
`editingBlockId`, `blockScrollRef`, los estilos `blockHeader*`/`modalSafe` y los
imports que dejaron de usarse (`Modal`, `SafeAreaView`, `GestureHandlerRootView`,
`Reanimated`, `BlockEditorInline`).

**Probar U09-15**

- [ ] Sesión libre en curso → Añadir → Bloque: se abre la pantalla Editar bloque
  (‹ y ✓ arriba), deslizando desde la derecha y no como hoja.
- [ ] El ✓ vuelve al Workout, sin toast «Programa editado» y con el bloque
  como lo dejaste.
- [ ] El ‹ hace lo mismo que el ✓.
- [ ] El lápiz de un bloque que ya estaba en el Workout abre la misma pantalla.
- [ ] Con dos bloques en la sesión libre, el desplegable de la cabecera salta
  entre ellos.
- [ ] Añadir movimiento (dentro del bloque) abre el selector encima del editor
  y el movimiento elegido aparece en el bloque al volver.
- [ ] Borrar el bloque desde el editor vuelve al Workout y el bloque ya no está.
- [ ] En una sesión de programa, editar un bloque desde el editor de sesión sigue
  igual: el ✓ dice «Programa editado» y vuelve a Main.

## 16. U09-16 — Inicio: banner de sesión en curso

Hoy, si empiezas una sesión que no es la que toca y vuelves a Inicio, esa
sesión **pasa a ser el hero** (`sessionPlan` hacía mandar a la activa sobre
todo). Confunde: sabes que no es la de hoy y la tarjeta grande dice que sí. Y
una sesión libre empezada no tiene hero que heredar: se queda abajo del todo,
como una fila más, y no se ve que está a medias. La sobre la marcha (`__free__`)
ni siquiera tiene fila: solo cambiaba el texto del botón de abajo.

**Decidido (1-oct-2026), sin maqueta:** un **banner arriba de todo** mientras
haya una sesión a medias, **siempre**, sea cual sea (programa, libre, sobre la
marcha o de un cliente). Se descartó resaltar la fila: abajo del todo no se ve
sin hacer scroll, y la sobre la marcha no tiene fila.

- **El hero vuelve a ser la que toca.** `sessionPlan` pierde `activeTemplateId`:
  la activa ya no manda, ni en Inicio ni en la ficha de un cliente. El hero
  enseña su meta normal aunque sea la que estás haciendo. Fuera las claves
  `home.sessionActive` y `home.heroMetaActive`, que solo servían a eso.
- La fila de la sesión activa sigue diciendo CONTINUAR (`startCta`), como ya
  hacía.
- **Sustituye** al aviso estrecho de «En curso: sesión C de Ana», que se
  quedaba corto: una línea de texto `body` en 12 px de alto útil.

**El banner.** `radius/md`, padding `space/lg`, encima de la semana, en el
`ScrollView`. **A prueba (1-oct-2026): relleno lima**, con la tinta del hero
(`onAccent`, también en la ceja y el reloj), compacto (padding vertical
`space/md`, interlineado 1.2, QA 1-oct) y CONTINUAR como su botón (`onAccent` de
fondo, texto lima). Si resulta demasiado llamativo junto al hero, se vuelve a
`surface` con solo el botón en lima.
Se probaron y descartaron (QA 1-oct): colgando del header (sin esquinas
arriba) y asomando por la derecha (esquinas solo a la izquierda, más corta que
la pantalla). Se queda como tarjeta normal.

- Ceja en `caps`: punto + «EN CURSO · 12:34». El reloj es el del Workout
  (hh:mm:ss en vivo, mismo hook); en modo registro no lleva reloj.
- Nombre en `itemTitle`, una línea, con lo mismo delante que su fila en
  Inicio: la letra las del programa («C · Empuje»), el número las libres
  guardadas («02 · Piernas»), y la sobre la marcha, que no tiene fila, su
  nombre o «Sesión libre».
- Sin la cuenta de ejercicios: se probó y no hacía falta (QA 1-oct). La lleva
  el diálogo de U09-17.
- Botón CONTINUAR a la derecha. Todo el banner lleva al Workout.
- **De un cliente, en azul** (el azul es del entrenador) y la ceja dice de
  quién: «EN CURSO · ANA · 12:34». Lo mío, en lima.

El nombre y la cuenta los saca `utils/activeSession.js`
(`activeSessionSummary`), que comparte con el diálogo de U09-17.

**Hecho (1-oct-2026).** `components/ActiveSessionBanner.jsx`, montado encima de
la semana en `HomeScreen`. El reloj del Workout pasa a
`ui/useElapsedText.js` y lo usan los dos. Fuera también `elapsedShort`, que
solo servía a la meta «empezada hace…» del hero.

**Probar U09-16**

- [x] Sin sesión a medias, Inicio no enseña banner.
- [x] Empezar la sesión que **no** toca y volver a Inicio: banner arriba con su
  nombre y el reloj corriendo; el hero sigue siendo la que
  toca, con su meta normal.
- [x] Empezar la que toca y volver: banner arriba y el hero con su meta normal
  (sin «empezada hace…»).
- [x] Empezar una sesión libre guardada y volver: banner con su número y su
  nombre («02 · Piernas»). Tocarlo (o CONTINUAR) abre el Workout.
- [x] Una del programa sale como «C · Empuje», sin «Sesión».
- [x] El banner en lima junto al hero: ¿se distinguen o es demasiado? (Si es
  demasiado, vuelve a `surface` con el botón en lima.)
- [x] Sesión libre sobre la marcha: banner con «Sesión libre» (o el nombre que
  le hayas puesto).
- [x] Entrenador: empezar la sesión de un cliente sin app y volver a Inicio:
  banner en azul con el nombre del cliente en la ceja. En su ficha, el hero es
  el que le toca, no el que está a medias.
- [x] Apuntar una sesión pasada de un cliente: el banner sale sin reloj.

## 17. U09-17 — Descartar sesión dice cuál

Al empezar otra sesión con una a medias salía «Descartar sesión» y «¿Descartar
la sesión en curso? …», sin decir cuál. Y era una pregunta, que las reglas de
U09-06 no permiten en el diálogo.

**Decidido (1-oct-2026):** título «Descartar sesión»; debajo, en una línea
propia, **la sesión y lo que llevas** («C · Empuje · 3 de 6 ejercicios»,
con el mismo nombre que el banner); y debajo la frase, en afirmativo: «Los datos que has introducido
se perderán.».

- `showDialog` gana `options.subtitle`: una línea en `bodyStrong` y `text`
  entre el título y la frase.
- Los cuatro sitios que lo copiaban (Inicio, ficha de cliente, Clientes →
  Preparar sesión, Pegar entreno) pasan a `confirmDiscardActive(t, onConfirm)`
  (`components/ui/confirmDiscard.js`), que lo lee del store.

**Hecho (1-oct-2026).**

**Probar U09-17**

- [x] Con una sesión a medias, empezar otra desde Inicio: título «Descartar
  sesión», debajo el nombre de la que está a medias con «N de M ejercicios», y
  debajo «Los datos que has introducido se perderán.». Sin interrogación.
- [x] Lo mismo desde la ficha de un cliente y desde Pegar entreno.
- [x] Con la app en inglés, el diálogo sale en inglés.

## Otros detalles vistos (sin fase)

- Pocos tamaños de letra fuera de la escala de `textStyles`, casi todos en los
  emojis de U09-10. El resto: `ProgramScreen` `statLabel` (10),
  `ClientsScreen` `infoCodeText` (16) e `infoCopyBtnText` (18),
  `AppHeader` (19), el badge de la tab bar (11).
- `Animated` de RN core sigue en 16 ficheros. Se migra solo donde se toque.

## Fases

| Fase | Qué | Estado | Coste |
|---|---|---|---|
| U09-01 | Las pestañas de Progresión se deslizan con el segmentado (solo al tocar) | ✅ rama `feat/recap` — probada en dispositivo 30-sep | 🟢 |
| U09-02 | Reordenar el recap: resultados primero, entrada de datos agrupada | ✅ rama `feat/recap` — probada en dispositivo 29-sep | 🟡 |
| U09-03 | Una sola fila de opción con icono; hoja «Añadir» del Workout | ✅ rama `feat/recap` — probada en dispositivo 29-sep | 🟡 |
| U09-04 | Hueco delante de las sesiones libres: 01, 02… | ✅ rama `feat/recap` — probada en dispositivo 30-sep | 🟢 |
| U09-05 | Botones del programa de cliente fuera de la tarjeta | ✅ rama `feat/recap` — probada en dispositivo 30-sep | 🟢 |
| U09-06 | Diálogo propio (`showDialog`) y fuera los `Alert.alert` | ✅ rama `feat/recap` | 🟡 |
| U09-07 | Textos fijos a i18n; pago, importar e Info/archivados de Clientes a `DragSheet`; actualización de programa a diálogo | ✅ rama `feat/recap` — probada en dispositivo 30-sep | 🟡 |
| U09-08 | Un solo lima: `#b8ff00` pasa a `accent` | ✅ rama `feat/recap` — probada en dispositivo 30-sep | 🟢 |
| U09-09 | Esas cuatro pantallas a `ScreenHeader`; ✕ como icono | ✅ rama `feat/recap` — probada en dispositivo 30-sep | 🟡 |
| U09-10 | `EmptyState` común en las nueve pantallas vacías; fuera los emojis de la UI | ✅ rama `feat/recap` | 🟡 |
| U09-11 | Hoja de progresión única | ✅ resuelta por P12-10 (`2c2dc25`) | 🟢 |
| U09-12 | Editar sesión: la página se desliza al cambiar de sesión | ✅ rama `feat/recap` — probada en dispositivo 30-sep | 🟢 |
| U09-13 | Importar archivo al estándar; `ChoiceRow` como pieza de elección única | ✅ rama `feat/recap` — probada en dispositivo 30-sep | 🟡 |
| U09-14 | Programas archivados (cliente y menú ≡) al estándar (maqueta antes) | pendiente | 🟡 |
| U09-15 | Sesión libre: el bloque se edita en `BlockEditorScreen` | ✅ rama `feat/recap` | 🟢 |
| U09-16 | Banner de sesión en curso; el hero deja de seguir a la activa | ✅ rama `feat/recap` | 🟡 |
| U09-17 | Descartar sesión dice cuál, sin pregunta | ✅ rama `feat/recap` | 🟢 |
