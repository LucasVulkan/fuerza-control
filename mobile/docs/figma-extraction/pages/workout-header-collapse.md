# Workout Screen header collapse (`109:510`)

## Qué muestra
Pantalla completa de Workout con scroll ya avanzado: header colapsado (36.7px, una sola fila combinando cronómetro de sesión + nombre), 4 Exercise Cards con distintos estados (en progreso con calentamiento y drops, completada/compacta, en progreso con calentamiento y drops, en progreso normal) y footer con botones "GUARDAR SESIÓN" / "Descartar sesión". Es la vista de referencia más completa de cómo se compone una sesión real de fuerza con calentamiento, series principales y series de drop-set.

## Componentes reconocidos
- **SesionHeader** (variante "collapsado"): fila única con flecha atrás (rotada 180°, posible detalle a revisar), título combinado `"07:36 - Hipertrofia - Pull "` (cronómetro de sesión + nombre de la sesión en un solo string, no en campos separados), 7 puntos de progreso, icono de menú/notas.
- **Exercise Card** (variante expandida, ejercicios "Puente de glúteo" y "Dominadas"): Header (Título 16px + Subtítulo "3 x 8-10reps" 10px) + icono **Icons** variante "Empty notes"; fila de **Chips** de recomendación de peso (`+2.5 kg recomendado` en lima, `-2.5kg recomendado` en rojo, ambos con borde izquierdo de color y fondo tenue); bloque **Series** de calentamiento (fondo `surface2`, label "Calentamiento" + "90s descanso", 2 sets ya completados mostrados como mini-pills `10Kg x 10` con flecha `→` entre ellas — NO son inputs editables, son solo lectura); tabla principal KG/REP/RPE con 3 filas usando **Series**/**Input Field**: S1 (component `Series`, ya hecho), S2 (fila "current", con borde lima y **Icons** "Serie Current Uncheck"), S3 (**Input Field** variante "Empty", con **Icons** "Serie uncheck"); botón **Buttons** "Añadir serie" (pill con borde, texto lima); sección "DROPS" (label rojo) con su propia mini tabla KG/REPS y filas D1 (**Input Field** variante "Current" con **Icons** "Serie Current Uncheck"); link "+ añadir drop".
- **Exercise Card** (variante compacta/completada, "Pull-down vertical"): fondo `tint/accent-10` + borde `accent-50` (resaltado de "completado"), icono "Empty notes" a la IZQUIERDA del título (no a la derecha como en la variante expandida), círculo de 32px con **Icons** "Check" a la derecha (grande, centrado). Debajo, dos filas de **EstructuraVisualizacionDatosEjercicios** ("Semi compacta"): cada una es un resumen de una serie ya hecha, mostrado como grupo de **Pills** en línea: `12.5 Kg x` + `12@8` (peso/reps + RIR o RPE), con la pill de RIR en rojo o lima según corresponda.
- **Buttons** (footer): botón primario lleno lima "GUARDAR SESIÓN" (full width) + botón secundario solo texto "Descartar sesión" (centrado, lima, uppercase, tracking ancho) debajo.

## Patrones de layout sin componente propio
- **Grupo de pills de resumen** (`EstructuraVisualizacionDatosEjercicios`): dentro de una fila, agrupa 2 pills con `gap-2px` (peso + RIR/RPE) — el gap mínimo entre las dos pills de un mismo set les da sensación de "una sola cápsula partida en 2 colores", aunque técnicamente son 2 elementos separados sin fondo compartido continuo. No es exactamente el patrón de "lista agrupada con radio solo en extremos" que se buscaba, pero es el patrón más cercano encontrado: mini-agrupación de 2 chips con gap casi nulo.
- **Bloque de calentamiento dentro de la card** (fondo `surface2` anidado dentro de la card `surface`): es una "tarjeta dentro de la tarjeta" con su propio radio (`radius/md`) y padding, usada para separar visualmente el calentamiento de las series principales sin ser un componente de la librería con nombre propio.
- **Sección DROPS**: mismo patrón — tabla secundaria anidada con su propio header de columnas (KG/REPS, sin RPE) y sus propias filas D1, todo dentro de la misma Exercise Card, sin fondo diferenciado (a diferencia del bloque de calentamiento que sí tiene `surface2`).
- No se observó el patrón exacto de "lista agrupada con fondo por item, gap mínimo, radio solo primero/último" que se mencionó como referencia — las Exercise Cards siempre son tarjetas completamente independientes con gap de 15px y radio completo en las 4 esquinas.

## Sizing en contexto (fill/hug/fixed)
- SesionHeader: FILL de ancho (w-[363px] dentro del padding de página), alto FIXED (36.7px).
- Exercise Card: FILL de ancho, alto HUG — varía mucho según contenido: 496px (con calentamiento+drops), 122px (compacta/completada), 532px (con calentamiento+drops, otro ejercicio), 496px.
- Celdas KG/REP dentro de Series/Input Field: FILL (`flex-[1_0_0]`), se reparten el ancho disponible.
- Celda RPE: FIXED (50px en la tabla principal, ancho distinto al de los mocks WS que usaban 63px — revisar si es la misma celda con padding distinto).
- Botón "GUARDAR SESIÓN": FILL de ancho completo.
- Botón "Descartar sesión": HUG (ancho automático, centrado).
- Pills de `EstructuraVisualizacionDatosEjercicios`: HUG, se envuelven (`flex-wrap`) si no entran en el ancho disponible.

## Notas / cosas a confirmar
- La flecha de "volver" en el SesionHeader colapsado está rotada 180° (`flex-none rotate-180`) — visualmente podría verse invertida; confirmar si es intencional (¿otro ícono reusado con rotación?) o un error del mock.
- El título del header colapsado concatena cronómetro + nombre en un solo string (`"07:36 - Hipertrofia - Pull "`) en vez de mostrarlos en elementos separados — importante para implementación, ya que no hay separación de datos en el diseño, habría que decidir el formato en código.
- La card "Hip thrust"/las cards en general muestran el bloque de calentamiento con 2 series ya completadas como texto no editable (solo lectura) — a diferencia de las series principales que sí son editables. Confirmar si el calentamiento es realmente de solo lectura una vez completado o si también permite edición.
- El componente `EstructuraVisualizacionDatosEjercicios` solo tiene una variante documentada en el código extraído (`"Semi compacta"`) — el nombre sugiere que existen variantes "compacta" u otras no vistas en estos mocks.
