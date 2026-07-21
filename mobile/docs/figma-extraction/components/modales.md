# Sistema de modales: Modal entries (`231:4204`) + Modal settings (`231:4214`)

Ambos nodos forman el mismo sistema: "Modal settings" es el contenedor tipo bottom-sheet que agrupa varias filas "Modal entries" (una por opción/setting).

## Variantes
- Modal entries / Setting normal: fila estándar de un modal de opciones — icono + label + chevron. Uso genérico para cualquier entrada de settings.
- Modal entries / Entrenador relacionado: misma fila pero resaltada en azul, para indicar que el setting fue configurado/sugerido por el entrenador vinculado (no es una elección propia del atleta).
- Modal settings: símbolo suelto sin variantes — es el bottom-sheet completo con drag handle, título de sección y una lista de filas "Modal entries" ya compuestas (ejemplo con 4 filas: "Ver progreso", "Póxima sesión" [sic, typo en Figma], "Editar programa", "Automática").

## Variables vinculadas
- Modal entries (ambas variantes): `space/xl` = 20px (gap), `space/md` = 10px (padding), `radius/sm` = 6px.
- Setting normal: bg `color/surface` = #2a2a2a, texto `color/text` = #e6e6e6.
- Entrenador relacionado: bg `tint/blue-30` = rgba(0,62,195,0.3), texto `color/blue` = #4c85ff (icono y chevron también cambian de asset para tono azul).
- Modal settings (contenedor): bg `color/surface2` = #3a3a3a, `space/lg` = 15px (padding horizontal), `radius/lg` = 18px (esquinas superiores redondeadas, inferior recto = hoja tipo bottom-sheet), `space/md` = 10px (gap entre filas).
- Título de sección "Nombre del setting": `color/accent` = #aae216.
- Drag handle (barra superior): bg `color/mutedLight` = #818181, `radius/full` = 9999px, fixed 35x3px.
- Fila "Póxima sesión" dentro de Modal settings: reutiliza la variante Entrenador relacionado (bg `tint/blue-30`, texto `color/blue`) pero con un icono distinto (ver Condicionales).

## Valores sueltos SIN vincular (revisar)
- Contenedor "Modal settings": `py-[var(--radius/md,10px)]` — el padding vertical está vinculado a la variable de radio `radius/md` en vez de a `space/md` (ambas valen 10px por coincidencia, pero es la variable incorrecta; debería ser `space/md`). Bug de vinculación, no un valor totalmente suelto, pero merece corrección.

## Tamaño
- Modal entries (ambas variantes): fixed 259px de ancho, alto hug.
- Modal settings: fixed 349px de ancho x 213px de alto (alto fijo pese a contener una lista — revisar si en la implementación real debe ser hug/dinámico según cantidad de filas).
- Drag handle: fixed 35x3px.
- Iconos de fila: fixed 14x14px.

## Condicionales/ocultos
- El icono dentro de cada fila cambia según el contenido, no según la variante formal de "Modal entries":
  - "Ver progreso" y "Editar programa" usan icono tipo barras/gráfico o de edición.
  - "Editar programa" usa específicamente un componente `Edit` conectado vía Code Connect (icono real del código, no un asset estático) — al implementar, reutilizar el ícono `Edit` ya existente en el codebase en vez de un SVG suelto.
  - "Póxima sesión" usa un icono de círculos concéntricos tipo diana/target, distinto del resto.
  - "Automática" (última fila) reutiliza el componente completo `ModalEntires` en su variante "Setting normal" como instancia, en vez de repetir el markup.
- El color azul (`tint/blue-30` / `color/blue`) y el icono alternativo de "Entrenador relacionado" solo aparecen cuando el setting proviene de una configuración del entrenador (fila "Póxima sesión" en el ejemplo de Modal settings).
