# Workout Screen full header (`104:690`)

## Qué muestra
Misma pantalla completa que `109:510`/`260:2796` (header + 4 Exercise Cards + footer de botones), pero capturada en el estado de **scroll = 0**, con el SesionHeader en su tamaño completo (64px, sin colapsar). Es el complemento natural de `109:510`: mismo contenido de body, distinto estado de header. Útil para ver el punto de partida completo de la secuencia de collapse documentada en los `ws-mockup-*`.

La cuarta Exercise Card en este mock es "Hip thrust" (a diferencia de `109:510`/`260:2796`, cuya cuarta card no se llegó a inspeccionar en detalle, pero por metadata tiene el mismo alto de 496px que en este nodo también corresponde a "Hip thrust" con chip roja "-2.5kg recomendado").

## Componentes reconocidos
- **SesionHeader** (variante completa, 64px): estructura en columna — eyebrow `"SESIÓN A . 07:36"` (aquí sí separa visualmente sesión y cronómetro con un punto medio, a diferencia del header colapsado que los concatena con guion) + título `"Hipertrofia - Pull"` (20px) + fila de 7 dots de progreso debajo. Flecha atrás a la izquierda (también rotada 180°, mismo detalle que en `109:510`), icono de menú/notas a la derecha (aquí como ícono de "Empty notes" con trazo en color `onaccent`/negro, no relleno).
- **Exercise Card** x4: mismos componentes ya documentados en `109:510` — Header (título+subtítulo), Chips de recomendación, bloque de Calentamiento (`surface2`), tabla S1/S2/S3 con Series/Input Field, botón "Añadir serie", sección DROPS, Exercise Card compacta/completada con Icons "Check" y EstructuraVisualizacionDatosEjercicios.
  - La 4ª card ("Hip thrust") es una variante intermedia: tiene el bloque de calentamiento con solo **1 fila ya en estado "current"** (no hay fila S1 "hecha" antes) — es decir, el calentamiento de este ejercicio arranca directo en una serie activa/current, sin serie previa completada. Vale la pena confirmar si esto es porque el ejercicio no tiene calentamiento con múltiples sets, o es un estado de mock incompleto.
- **Buttons** (footer): igual que en `109:510` — "GUARDAR SESIÓN" (primario, full width) + "Descartar sesión" (secundario, texto).

## Patrones de layout sin componente propio
Idénticos a los documentados en `109:510` (bloque de calentamiento anidado con fondo `surface2`, sección DROPS anidada sin fondo diferenciado, grupo de pills de resumen con gap mínimo en la card compacta). No se detectaron patrones nuevos respecto a esa pantalla.

## Sizing en contexto (fill/hug/fixed)
- SesionHeader: FILL de ancho, alto FIXED 64px (vs 36.7px en la variante colapsada) — el mayor de las variantes de header vistas en todo el archivo.
- Bloque eyebrow+título+dots: layout en columna (`flex-col`) centrado, a diferencia de la variante colapsada que usa una fila (`flex-row`) — confirma que el colapso del header no es solo un cambio de alto sino también un cambio de dirección de layout (columna → fila) de su contenido interno.
- Resto de la pantalla (cards, footer): igual que `109:510` (FILL de ancho, HUG de alto en las cards, FILL/HUG en los botones del footer).

## Notas / cosas a confirmar
- El eyebrow del header completo usa un separador con punto medio (`"SESIÓN A . 07:36"`) mientras que el header colapsado concatena con guion (`"07:36 - Hipertrofia - Pull "`) — son dos formatos de string distintos para mostrar la misma información (nombre de sesión + cronómetro). Confirmar el formato final antes de implementar, ya que ninguno de los dos coincide con el patrón "SESIÓN A" + título en líneas separadas que se ve en los `ws-mockup-*` (esos mocks no muestran cronómetro en absoluto).
- Mismo detalle de la flecha rotada 180° que en `109:510` — parece consistente en todas las variantes de header con cronómetro, por lo que probablemente sea intencional (quizás el ícono base apunta hacia adelante y se reusa rotado para "atrás"), pero conviene confirmarlo.
- Esta es la única de las 3 pantallas grandes que muestra el header en su estado inicial completo — sirve como referencia clave del "antes" en la animación de collapse, en conjunto con `104:313` (mismo header completo pero versión recortada/sin body) y `109:510`/`260:2796` (header ya colapsado).
