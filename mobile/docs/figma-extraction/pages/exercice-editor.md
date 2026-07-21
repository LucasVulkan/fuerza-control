# Exercice Editor (`123:1511`)

## Qué muestra
Editor de configuración de un ejercicio dentro de una sesión ("Puente de Gluteo"): resumen de la prescripción actual, parámetros de volumen (series/descanso/rango de reps), progresión automática, y un bloque largo de opciones avanzadas (unilateral, RPE, dropset, superserie, tempo, nota, vinculación entre sesiones).

## Componentes reconocidos
- **Bars** (header, variante título editable): "PUENTE DE GLUTEO" accent + chevron, `flex-[1_0_0]` — mismo patrón que en Exercice/Progress.
- **Buttons**: "Aceptar" (fondo `--color/muted` gris, no accent) junto al header, ancho hug — confirma acción de guardar/cerrar el editor.
- **ExerciceEditorElements** (nombre real del componente en Figma), 3 variantes:
  - `Resumen`: caja con borde accent y fondo `tint/accent-10`, label "RESUMEN" (accent, uppercase), línea de prescripción "3 x 812 REPS 90s" (placeholder mal formateado, ver notas) y subtítulo en `tint/accent-50` con la regla de progresión ("Sube 2.5 kg al completar todas las series").
  - `Caja`: stepper individual con label arriba (ej. "Series", "Descanso", "Reps Min", "Reps Max"), fila central con botón "-" (cuadrado 30px, `surface2`, texto accent-50) + valor grande (16px, black) + botón "+"; se usan 4 en grid 2x2.
  - `Progresion`: fila con ícono (barras tipo gráfico), texto "Automática" + subtítulo "Doble . todas las series . +2.5 kg", y chevron a la derecha — navega a config detallada de progresión.
- **Segmented control**: "REPS" / "TIME" (solo 2 opciones, a diferencia de los de 4 opciones vistos en otras pantallas) bajo el label "VOLUMEN" — alterna entre volumen basado en repeticiones o en tiempo.
- **Icons**: variante `Switch` (toggle on/off, verde=on) usada 4 veces en "Opciones básicas"; ícono de flecha/chevron para "Tempo" y para el header.
- **OptionBlocks** (nombre real del componente), 2 variantes:
  - `Opciones basicas`: lista agrupada (ver patrón abajo) con filas: "Unilateral" (switch), "Registar RPE" (switch), "Dropset en la última serie" (switch), "En superserie con siguiente" (switch), "Tempo" (chevron, navega a submenú), "Nota" (textarea + texto de ayuda "Visible en el ejercicio durante la sesion").
  - `Vinculacion`: card independiente (no agrupada, `surface` con radio uniforme `--radius/md`) con título "Vinculacion entre sesiones", selector tipo pills en columna ("Ninguna" muted, "Grupo 1. A, D" accent = seleccionado, "+ Nuevo grupo" muted) y texto explicativo debajo.

## Patrones de layout sin componente propio
- **Aparece de nuevo el patrón de "lista agrupada"** en `OptionBlocks` variante "Opciones basicas": cada fila (Unilateral, Registar RPE, Dropset, Superserie, Tempo, Nota) tiene fondo `surface`, gap `--space/xs` (2px), y radios asimétricos — primera fila sin radios especiales visibles pero el conjunto entero tiene contenedor `overflow-clip` con `rounded-[var(--radius/md,10px)]`, y la última fila (Nota) tiene explícitamente `rounded-bl/br-md rounded-tl/tr-xxs`. Mismo mecanismo que en Progress/Exercice.
- **Grid 2x2 de steppers** (Series/Descanso/Reps Min/Reps Max): 2 filas de 2 cards `flex-[1_0_0]` con gap 10px, patrón "form grid" sin nombre propio de componente, reutilizado igual para volumen y (potencialmente) para otros pares de parámetros numéricos.
- El stepper individual (- / valor / +) en sí es un patrón muy repetido (4 veces) pero definido como variante `Caja` de un componente ya nombrado (`ExerciceEditorElements`), así que no cuenta como "sin componente propio" — se documenta igual porque es clave para el editor.
- Bloques de sección ("VOLUMEN", "PROGRESIÓN", "OPCIONES"): label uppercase mutedlight + `pt-[var(--space/md,10px)]` como separador visual entre secciones, patrón repetido sin componente dedicado.

## Sizing en contexto (fill/hug/fixed)
- Header: Bars `flex-[1_0_0]` (fill) + botón "Aceptar" hug, ambos `self-stretch` (mismo alto).
- Caja "Resumen": `w-full`.
- Grid de steppers: cada card `flex-[1_0_0] min-w-px`, alto fijo `h-[68px]` en "Series"/"Reps Min" pero sin alto fijo (hug) en "Descanso"/"Reps Max" — inconsistencia menor entre cards del mismo grid, revisar si es intencional.
- OptionBlocks "Opciones basicas": `w-full`, cada fila `w-full` con alto hug (excepto "Tempo" que fija `h-[26px]`).
- Textarea de "Nota": alto fijo `h-[42px]`, fondo `--color/workout-card` (un token de color distinto a `surface`/`surface2`, específico de este contexto).
- OptionBlocks "Vinculacion": `w-full`, pills internas `w-full` (fill, apiladas en columna, no en fila como cabría esperar de un selector de opciones).

## Notas / cosas a confirmar
- **"Registar RPE" es un toggle switch** en las opciones del ejercicio — confirma que el registro de RPE ya está contemplado en el diseño, pero como flag booleano por ejercicio (se registra o no), no como una métrica agregada/tendencia. Esto es complementario a lo encontrado en Progress/Exercice (pills con RPE por serie) y a lo NO encontrado (sin gráfico de RPE, fatiga o carga acumulada semanal). Coherente entre las 3 pantallas: RPE se captura a nivel de serie individual, se visualiza como color en pills, pero no hay una vista de tendencia/agregada.
- El texto "3 x 812 REPS  90s" en la caja Resumen probablemente es un error de placeholder en el mock — con más contexto parece que debería leerse "3 x 8-12 REPS, 90s" (rango de reps + descanso), confirmar formato real con diseño.
- El botón "Aceptar" usa `--color/muted` (gris), no accent — inconsistente con otros CTAs primarios de otras pantallas (accent). Podría ser intencional (acción secundaria/neutra dentro de un flujo modal) o un descuido.
- "Vinculación entre sesiones" es una feature no trivial: permite agrupar el mismo ejercicio entre sesiones distintas para compartir configuración/historial (ej. mismo "Puente de Gluteo" en Sesión A y D comparten datos). Vale la pena confirmar si esto ya existe en el modelo de datos actual de la app o es una feature nueva a diseñar.
- No hay botones de "Sustituir ejercicio" ni "Eliminar ejercicio" visibles en este nodo — a diferencia de lo que se esperaría en un editor de ejercicio típico. Podrían estar en Sesion Editor (nivel superior) en vez de aquí; confirmar cuando se revise `sesion-editor.md`.
- Los switches (Icons variante "Switch") todos aparecen en estado "on" (verde) en el mock — no hay ejemplo visual del estado "off" en este nodo, aunque el código sí soporta ambos vía el componente.
