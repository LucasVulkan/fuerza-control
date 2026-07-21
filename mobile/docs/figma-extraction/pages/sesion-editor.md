# Sesion editor (`208:1932`)

## Qué muestra
Editor de una sesión completa dentro de una etapa de programa ("Sesión A - Etapa 1"): header con navegación, selector de sesión (A-E), resumen de la sesión, lista reordenable de ejercicios/bloques (incluye un superset y un bloque EMOM), y acciones para añadir contenido.

## Componentes reconocidos
- **SesionHeader** (nombre real del componente en Figma): barra alta (64px) fondo accent con: chevron de "volver" (rotado 180°) a la izquierda, bloque central de texto (eyebrow "SESION A - ETAPA 1" + título grande "Nombre sesión", ambos centrados), y menú de opciones (3 puntos, rotado -90°) a la derecha.
- **Segmented control**: A/B/C/D/E para cambiar entre sesiones de la etapa, "A" activo (fondo accent). Todos los botones `flex-[1_0_0]` (fill equitativo), a diferencia del de rango temporal de Progress que era ancho fijo.
- **ExerciceEditorElements** (mismo componente que en Exercice Editor), 2 variantes usadas aquí:
  - `Resumen`: caja con borde accent (igual que en Exercice Editor), aquí con "3 ejercicios - 9 series - 60 min" y subtítulo "Pildoras de volumen por grupo muscular".
  - `Ejercicio editor`: fila de ejercicio en la lista de la sesión — nombre ("Ejercicio 2"), subtítulo con prescripción ("3 x 12-14 . 60s"), una o más **Pills** de tag (ver abajo), e ícono de **Arrastre** (drag handle, grid de 6 puntos) a la derecha.
- **Pills**: usadas como tags de contexto en cada fila de ejercicio — "Empuje V" (grupo muscular/etiqueta libre), "G1" + "Auto" (grupo de vinculación + progresión automática, fondo `tint/accent-10`), "Superset" (fondo `tint/accent-10`), "G1" + "Bloque" (el tag "Bloque" usa `tint/blue-30`/`color/blue`, distinto de los demás que son accent — único uso de color azul visto en todo el archivo).
- **Icons**: variante `Arrastre` (drag handle, 6 puntos en grid 2x3) en cada fila de ejercicio/bloque; variante en el header para volver y para el menú de opciones.
- **Buttons**: "+ Añadir ejercicio" y "+ Añadir bloque", ambos con borde `tint/accent-50` y fondo transparente, texto accent-50, ancho completo, apilados.

## Patrones de layout sin componente propio
- **Patrón de "lista agrupada" (tercera confirmación)**: el contenedor `208:2235` agrupa 6 filas de ejercicio/bloque con fondo `surface`, gap `--space/xs` (2px), radios asimétricos (primera fila `rounded-tl/tr-sm` + `rounded-bl/br-xxs`, filas intermedias todas `--radius/xxs`, última fila `rounded-bl/br-sm` + `rounded-tl/tr-xxs`). Mismo mecanismo que en Progress/Exercice/Exercice Editor, pero aquí con radios `sm` (6px) en los extremos en vez de `md` (10px) — el radio de extremo varía según contexto/densidad de la lista.
- **Patrón nuevo: "superset visual" con barra lateral de color** — dos filas de ejercicio con tag "Superset" están envueltas en un sub-contenedor (`209:2479`) con `border-l` de 2px en color accent, agrupándolas visualmente como una lista anidada dentro de la lista principal (gap 2px entre ellas). Este es un patrón sin nombre de componente que vale la pena replicar tal cual: una barra vertical de color a la izquierda de un grupo de filas indica que están vinculadas (ej. superset), sin necesidad de fusionar sus fondos.
- El bloque tipo **EMOM** ("EMOM - Nombre del emom", "10 rondas - 1:00 - 3 movimientos") convive en la misma lista agrupada que los ejercicios de fuerza normales, con la misma fila/estructura visual pero datos distintos (rondas/tiempo/movimientos en vez de series/reps/descanso) y tags distintos (G1 + Bloque en azul). No hay una fila visualmente distinta para bloques de conditioning — se integra en el mismo componente `Ejercicio editor`.
- Sección de acciones al final ("+ Añadir ejercicio" / "+ Añadir bloque"): 2 botones outline apilados con gap 10px, patrón "acciones secundarias al final de una lista" sin nombre propio.

## Sizing en contexto (fill/hug/fixed)
- SesionHeader: `w-[363px]` fijo en el mock (probablemente debería ser `w-full` en la app real, ya que el resto de la pantalla usa fill) — confirmar si el ancho fijo es un error de layout del mockup.
- Segmented control A-E: `w-full`, cada botón `flex-[1_0_0]` fill equitativo (5 botones iguales).
- Filas de ejercicio dentro de la lista agrupada: `w-[363px]` fijo también (mismo posible error que el header) en vez de `w-full` — inconsistente con el resto de pantallas de la app donde las listas son `w-full`.
- Botones "+ Añadir ejercicio/bloque": `w-full`, alto hug con padding vertical `--space/md` (10px).
- Pills de tag: hug de contenido, se acumulan en fila con gap 6px cuando hay más de una (ej. "G1" + "Bloque").

## Notas / cosas a confirmar
- **No hay botones explícitos de "sustituir" o "eliminar" ejercicio visibles en las filas** — cada fila solo muestra nombre/prescripción/tags/drag handle. Es probable que tocar la fila abra el Exercice Editor (donde tampoco se vieron esas acciones, ver `exercice-editor.md`) o que sustituir/eliminar viva detrás del menú "..." del header de la sesión — confirmar con el diseñador, porque en ningún nodo de los 6 investigados aparecen literalmente esas acciones.
- El drag handle (Icons "Arrastre") en cada fila confirma reordenamiento manual de ejercicios/bloques dentro de la sesión — coherente con el patrón drag-and-drop mencionado en la memoria del proyecto.
- El bloque EMOM confirma que la pantalla de edición de sesión ya contempla bloques de conditioning (EMOM al menos) mezclados con ejercicios de fuerza tradicionales en la misma lista — relevante dado que el proyecto ya tiene "strength+conditioning blocks" implementados según la memoria; comparar esta estructura visual con la implementación real.
- El patrón de "barra lateral de color = vinculación/superset" es una idea de UI reutilizable: podría aplicarse también a "vinculación entre sesiones" (visto en Exercice Editor) si se decide dar feedback visual similar en el listado de una sesión.
- Todas las prescripciones mostradas en las filas de ejercicio son idénticas ("Ejercicio 2" / "3 x 12-14 . 60s") — de nuevo, datos de placeholder repetidos en el mock, no tomar literalmente como diseño (nombres/valores reales variarían).
- El tag "Auto" (junto a "G1") en la primera fila sugiere que la fila resume visualmente si el ejercicio tiene progresión automática activada — coherente con el bloque "Progresión" visto en Exercice Editor.
