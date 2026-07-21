# WS mockup (`102:370`)

## Qué muestra
Workout Screen en su versión más simple: header de sesión "flotante" (con margen y esquinas redondeadas) a 64px de alto, y dos Exercise Cards apiladas con datos de ejemplo (Puente de glúteo, Dominadas). No incluye footer de botones (Guardar/Descartar) — el frame termina justo debajo de las cards, así que es un recorte del scroll, no la pantalla completa.

Es la variante "de referencia": header alto (64px), con esquinas redondeadas y separado del borde superior por el padding de página (15px). Compárese con `104:313` (mismo header pero pegado al borde, sin radio) y con `104:167`/`104:449` (mismo header pero cada vez más bajo).

## Componentes reconocidos
- **SesionHeader**: fondo lima (`--color/accent`), 64px alto, radio `--radius/md` (10px). Contiene: flecha atrás (←), bloque central (eyebrow "SESIÓN A" + título "Hipertrofia - Pull" + fila de 7 puntos de progreso/semana), e icono de menú/notas (3 líneas) a la derecha.
- **Exercise Card** (data-name "Frame 40"/"Frame 41" en el mock, pero corresponde al componente "Exercice Card" visto en las pantallas grandes): título del ejercicio (16px, color accent aquí — nótese que en este mock el título va en lima, mientras que en las pantallas reales `109:510`/`104:690` el título va en blanco/texto normal; puede ser un estado distinto o inconsistencia del mock), subtítulo "3 x 8-10reps" en gris/tracking ancho, tabla KG/REP/RPE, filas S1/S2/S3.
- **Series/Input Field**: cada celda KG y REP es una caja `surface` con esquinas `radius/xs`; la celda RPE es una caja aparte con flechas `‹ › ` (stepper) y ancho fijo 63px.
- Icono check circular (verde relleno) a la derecha de S1 (fila completada); icono check circular hueco (outline) en S2 y S3.

## Patrones de layout sin componente propio
- No se observa el patrón de "lista agrupada" (fondo compartido, radio solo primero/último) en esta pantalla — cada Exercise Card es una tarjeta independiente con su propio radio completo y gap de 10px entre ellas (no hay fondo compartido).
- Fila de serie (S1/S2/S3): patrón repetido de "label + 3 celdas + icono check" con gap fijo de 6px, no es un componente nombrado aparte sino una composición manual de Input Fields.

## Sizing en contexto (fill/hug/fixed)
- Contenedor raíz: `flex-col`, `items-center`, `gap-10`, `padding-15` — columna que fija el ancho de las cards a `w-full` (FILL) menos el padding lateral.
- SesionHeader: `w-full` (FILL) dentro del padding de página; alto fijo 64px (FIXED).
- Exercise Card: `w-full` (FILL), alto HUG (crece según el número de series/contenido — aquí 191px con 3 filas).
- Celdas KG/REP: `flex-[1_0_0]` (FILL, se reparten el espacio disponible por igual).
- Celda RPE: ancho fijo 63px (FIXED) — no crece con el contenedor.
- Icono check: tamaño fijo 26x25px (FIXED).

## Notas / cosas a confirmar
- El título del ejercicio aparece en color lima (`--color/accent`) en este mock, distinto de los mocks grandes (`109:510`, `104:690`) donde el título es blanco/texto (`--color/text`). Confirmar cuál es el estado correcto — podría ser un remanente de una iteración anterior del diseño.
- La fila S2 en la primera card ("Puente de glúteo") tiene fondo `tint/accent-10` (resaltada, es la "próxima serie a entrenar"); la fila S2 de la segunda card ("Dominadas") NO está resaltada — coincide con el patrón de "highlight global de la siguiente serie" mencionado en el historial de commits del proyecto (solo se resalta la serie activa de todo el workout, no una por ejercicio).
- No hay footer con botones "Guardar sesión" / "Descartar sesión" visible en este recorte — sí aparece en `109:510`, `260:2796` y `104:690`.
