# SesionHeader (`110:3692`)

## Variantes
- **Default**: header principal de sesión activa — botón atrás, título (hora + nombre sesión / nombre programa), dots de paginación (7 puntos), icono de ajustes a la derecha.
- **collapsado**: versión de una sola fila del header (scroll colapsado) — atrás, texto resumen "hora - nombre", dots de paginación, icono de menú/editar a la derecha.
- **Editar Programa**: modo edición de programa — atrás, título "EDITAR PROGRAMA" + nombre del programa, menú de 3 puntos verticales a la derecha (sin dots de paginación).
- **Editar sesion**: modo edición de sesión — atrás, título "SESION A - ETAPA 1" + nombre de sesión editable, menú de 3 puntos verticales (sin dots de paginación).
- **Main head con etapaser con etapas** (nombre literal de la variante en Figma; parece typo/duplicación de "Main head con etapas"): banner de programa con bloque de progreso por etapa — nombre programa, semana, pill "N Sesiones", más bloque "Etapa X/Y" + barra de volumen + "Semana X de Y" + "%".
- **Main header sin etapas**: mismo banner de programa pero sin el bloque de etapa/progreso (solo nombre, semana, pill de sesiones).

## Variables vinculadas
- Contenedor Default/Editar Programa/Editar sesion: `color/accent` (#aae216) fondo, `space/sm` (6) padding, `radius/md` (10) radio, alto fijo 64px.
- Contenedor collapsado: `color/accent` fondo, `space/sm` padding, `radius/md` radio.
- Textos sobre fondo accent (título chico, título grande, "Sesiones", "Volumen", label "ETAPA 1/3", "Semana 2 de 3" en el wrapper): `color/onAccent` (#000000).
- Banner (Main head/Main header): `color/accent` fondo, `radius/lg` (18) radio.
- Pill "21 Sesiones": borde `color/onAccent`, `radius/full` (9999).
- Segmento de fondo de barra de progreso (235:4336): `color/onAccent`.
- Marcadores de la barra de progreso (235:4337, 235:4338): `color/accent`.
- Icono "3 puntos verticales" (menú, solo Editar Programa/Editar sesion) e icono chevron atrás: imágenes rasterizadas (no verificable como variable de color vía código).

## Valores sueltos SIN vincular (revisar)
- "07" (número de semana, banner) — `text-black`: debería vincularse a `color/onAccent` (mismo valor #000000 pero sin link). Variantes: Main head con etapas, Main header sin etapas.
- Label "SEMANA" — `text-[rgba(0,0,0,0.76)]`: valor suelto, no coincide con ningún tint conocido; debería vincularse a `color/onAccent` (o crearse un tint de onAccent al 76% si es intencional). Variantes: Main head con etapas, Main header sin etapas.
- Línea divisoria vertical (nodo `235:4329`) — `bg-black h-[126.19px] w-[2.612px]`: debería vincularse a `color/onAccent`. Solo en "Main head con etapas".
- Track de la barra de progreso "Volumen" (nodo `235:4335`) — `bg-[#81a71e]`: hex suelto que no coincide con ningún token conocido (parece un verde accent oscurecido); debería vincularse a `color/accent` o a un tint/muted-accent existente. Solo en "Main head con etapas".
- Textos "Semana 2 de 3" (`235:4339`) y "66%" (`235:4340`) — `text-black`: deberían vincularse a `color/onAccent`. Solo en "Main head con etapas".

## Tamaño
- Contenedor Default/Editar Programa/Editar sesion: fixed 363x64.
- Contenedor collapsado: fixed width 363, height hug (via `space/md` padding vertical).
- Contenedor exterior Main head/Main header: fixed width 375 (con `space/sm` padding horizontal), height hug.
- Banner interno (Main head/Main header): fixed width 363, height fixed 100 (con etapas) / 79 (sin etapas).
- Pill "N Sesiones": fixed 92x27.
- Iconos (chevron, menú, ajustes): fixed 26x26.
- Bloque título: fixed width 166 en Default; hug en Editar Programa/Editar sesion.
- Bloque "ETAPA X/Y": fixed width 129 (solo con etapas).
- Bloque "Volumen" (label + barra + textos): fixed width 207 (solo con etapas).

## Condicionales/ocultos
- Chevron atrás + bloque de título: solo en Default, Editar Programa, Editar sesion.
- Dots de paginación (7 puntos): solo en Default.
- Icono de 3 puntos verticales (menú): solo en Editar Programa y Editar sesion.
- Icono de "ajustes" (3 círculos concéntricos): solo en Default.
- Bloque banner completo (Etapa/Semana/Sesiones): solo en Main head con etapas / Main header sin etapas (reemplaza toda la estructura de header/chrome de las otras 4 variantes).
- Bloque "Etapa X/Y" + línea divisoria + barra "Volumen": solo en Main head con etapas (ausente en Main header sin etapas, que es idéntica salvo ese bloque).
- Fila completa de la variante collapsado (atrás + texto resumen + dots + icono): estructura propia, solo existe en esa variante.
