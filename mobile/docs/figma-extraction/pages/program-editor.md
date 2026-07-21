# Program editor (`210:2864`)

## Qué muestra
Editor de un programa completo ("Hipertrofia - Pull"): header, resumen global, selector/lista de etapas (stages), y lista de sesiones de la etapa seleccionada, con acciones para añadir etapas y sesiones.

## Componentes reconocidos
- **SesionHeader** (mismo componente que en Sesion Editor, reutilizado a nivel de programa): eyebrow "EDITAR PROGRAMA" + título "Hipertrofia - Pull", chevron volver a la izquierda, ícono de edición ("Edit", vía Code Connect — es un componente de código real ya mapeado, distinto al resto que son solo capas de Figma) a la derecha en vez del menú de 3 puntos usado en Sesion Editor.
- **ExerciceEditorElements** variante `Resumen` (mismo patrón que en Exercice Editor/Sesion Editor): caja con borde accent, "RESUMEN" + "2 etapas - 8 semanas - 10 sesiones".
- **Segmented control** (etapas): 3 botones con 2 líneas cada uno — nombre de etapa (bold) + duración ("5 sem.", "2 sem.", "1 sem.") en línea secundaria. Etiquetas: "Etapa 1", "Etapa 2", **"Volumen"** (nombre custom, no numérico) — confirma que las etapas pueden tener nombres personalizados, no solo "Etapa N".
- **ExerciceEditorElements** variante `Progresion` (mismo componente/layout que en Exercice Editor, reutilizado aquí para representar una etapa individual): ícono + "Etapa 5" + subtítulo "4 semanas - 5 sesiones" + chevron. Ver nota de inconsistencia abajo.
- **Sesion Card**: misma tarjeta vista en History, aquí en su variante "normal" (no la de historial) — "SESIÓN A/B/C/D" (accent, uppercase) + "Nombre de la sesión" + "3 ejercicios - 9 series - 60min", con un ícono de chevron (navegación) a la derecha en vez del ícono "Delete" (X) que tenía en History. Confirma que Sesion Card tiene al menos 2 variantes de ícono trailing según contexto (borrar en historial, navegar en editor).
- **Buttons** (outline accent-50): "+ Añadir etapa" y "+ Añadir sesión a **Etapa 1**" (con el nombre de la etapa actual resaltado en accent dentro del mismo texto) — mismo estilo de botón "outline" visto en Sesion Editor para añadir ejercicio/bloque.

## Patrones de layout sin componente propio
- **No hay timeline ni representación visual de progreso temporal entre etapas** (ni línea conectora, ni barra de progreso, ni gráfico de gantt) — las etapas se representan únicamente como: (a) un segmented control de 3 opciones con nombre+duración, y (b) una fila suelta tipo lista para "Etapa 5" con ícono+nombre+duración+chevron. Es la respuesta más directa a la pregunta de "cómo se representan las etapas visualmente": son filas/tabs de texto, no gráficos.
- La lista de "Sesiones - Etapa 1" usa el mismo patrón de card independiente con gap uniforme (`--space/sm`, 6px) visto en History — **no** el patrón de lista agrupada con radios asimétricos; aquí cada Sesion Card mantiene radio completo en las 4 esquinas. Confirma que el patrón de "lista agrupada" no es universal: se usa para listas de datos/detalle (progreso, opciones, ejercicios de una sesión) pero no para listas de navegación a un objeto grande (sesiones, historial).
- Encabezados de sección ("ETAPAS", "SESIONES - ETAPA 1"): mismo patrón de label uppercase mutedlight + padding superior visto en Exercice Editor.

## Sizing en contexto (fill/hug/fixed)
- SesionHeader: de nuevo `w-[363px]` fijo (mismo patrón/posible inconsistencia que en Sesion Editor).
- Segmented control de etapas: `w-full`, 3 botones `flex-[1_0_0]` (fill equitativo) — a diferencia del segmented control A-E de Sesion Editor que también era fill, coherente.
- Fila "Etapa 5" (variante Progresion): `w-full`.
- Sesion Card: `w-full` (fill), igual que en History.
- Botones outline "+ Añadir...": `w-full`.

## Notas / cosas a confirmar
- **Inconsistencia notable a confirmar con diseño**: el segmented control de arriba muestra 3 etapas ("Etapa 1" 5 sem., "Etapa 2" 2 sem., "Volumen" 1 sem. — total 8 semanas, coincide con el resumen "8 semanas"), pero justo debajo aparece una fila suelta "Etapa 5 - 4 semanas - 5 sesiones" que no encaja con las 3 etapas del segmented control ni sus duraciones. Podría ser: (a) contenido de ejemplo/placeholder sin relación real, (b) una etapa adicional que no cabe en el segmented control y se lista aparte (patrón "overflow" cuando hay muchas etapas), o (c) un elemento de otro estado del diseño pegado por error. Vale la pena preguntar directamente antes de implementar.
- El ícono de "Edit" en el header SÍ está vinculado por Code Connect a un componente de código real (a diferencia de todos los demás iconos del archivo, que son solo capas SVG de Figma) — indica que ya existe un componente `Edit`/ícono de edición en el codebase que Figma reconoce; útil para no reinventar el ícono.
- Las etapas con nombre custom ("Volumen" en vez de "Etapa 3") sugieren que el modelo de datos de etapa incluye un campo de nombre libre, no solo un número de orden — confirmar si el código actual ya soporta esto.
- No se ve ninguna acción de eliminar/reordenar etapas o sesiones en este nodo (no hay drag handle en Sesion Card ni en la fila de etapa, a diferencia de Sesion Editor donde sí había drag handles en las filas de ejercicio) — o las etapas/sesiones no son reordenables desde aquí, o esa acción vive en otro sitio (swipe, menú contextual) no capturado en el mock.
- El resumen global "2 etapas - 8 semanas - 10 sesiones" sigue el mismo formato compacto "N - N - N" visto en los resúmenes de Exercice Editor y Sesion Editor — patrón de texto consistente en toda la app para cajas "Resumen".
