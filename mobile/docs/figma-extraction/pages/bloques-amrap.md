# Bloques: AMRAP (`190:1661`)

## Qué muestra
Editor/bottom-sheet de configuración de un bloque de acondicionamiento en modo AMRAP: resumen, selector de formato (segmented control AMRAP/EMOM/For Time), tiempo límite, lista de movimientos y opciones (nombre + nota).

## Componentes reconocidos
- **Bars** (`190:1663`): barra superior verde acento con label "BLOQUE DE ACONDICIONAMIENTO" + icono chevron — funciona como header/título de tipo de bloque, con acción implícita de cambiar tipo.
- **Buttons**: variante "Aceptar" (gris muted, junto a la Bar), variante outline con borde acento "Añadir ejercicio", variante muted full-width "Guardar preset" (footer).
- **Exercice editor elements**: contenedor reutilizado para 3 cosas distintas: (1) el cuadro "RESUMEN" con fondo tinte-acento y borde; (2) la fila "Tiempo límite" con stepper -/+; (3) cada fila de ejercicio en la lista de movimientos.
- **Segmented control**: "Formato" con 3 opciones (AMRAP/EMOM/For Time), AMRAP seleccionado en acento.
- **Icons**: icono "Arrastre" (drag handle, 6 puntos) al final de cada fila de ejercicio; icono chevron/flecha en la Bar.
- **Input Field**: los dos campos numéricos (reps / Kg) dentro de cada fila de ejercicio, estilo pill gris con texto centrado.
- **Option blocks**: contenedor "Opciones" con campo "Nombre" (input de una línea) y textarea "nota para el atleta...".
- Stepper -/+ (par de botones cuadrados 30x30 con fondo surface2) reutilizado para "Tiempo límite".

## Patrones de layout sin componente propio
- **Lista agrupada de ejercicios** (`190:1680`): contenedor con `gap: var(--space/xs, 2px)` que envuelve 3 filas "Exercice editor elements" con `bg: var(--color/surface)`. Solo la primera fila tiene `rounded-tl/tr` y solo la última tiene `rounded-bl/br`; las filas del medio no tienen radio. Esto es exactamente el patrón "lista agrupada" mencionado: fondo por item, gap mínimo (2px) entre ellos, radio de esquina solo en el primer y último item. Coincide con el patrón visto también en `clients-1.md` / `clients-2.md`.
- **Sección numerada con label pequeño** ("1. FORMATO", "2. MOVIMIENTOS", "3. OPCIONES" en EMOM): usa un `<ol>` HTML con `list-decimal` para el número, texto uppercase, tracking amplio, color mutedlight — no es un componente, es un patrón de texto repetido como separador de sección dentro del editor.
- Fila "Tiempo límite" con stepper: layout label-izquierda / stepper-derecha (botón menos, valor con unidad, botón más) — mismo patrón se repite en EMOM para "Rondas".

## Sizing en contexto (fill/hug/fixed)
- Contenedor raíz: fill (w-full), padding fijo `var(--space/lg, 15px)`.
- Bar "Bloque de acondicionamiento": fill vía `flex-1`, se estira a lo ancho menos el botón "Aceptar" que es hug.
- Botón "Aceptar": hug (ajustado al texto + padding).
- Cuadro RESUMEN: fill w-full, alto hug según contenido.
- Segmented control: fill w-full, cada opción `flex-1` (reparto igual de 3 columnas).
- Fila "Tiempo límite": fill w-full, altura fija 46px.
- Cada fila de ejercicio: fill w-full; los inputs reps/Kg son `w-[51px]` fijos (hug con ancho mínimo fijo), el nombre del ejercicio es `flex-1` (fill).
- Icono de arrastre: fixed `size-[26px]`.
- Textarea de nota: fill w-full, alto fijo `h-[54px]`.
- Botón "Guardar preset" / "Añadir ejercicio": fill w-full.

## Notas / cosas a confirmar
- El texto "Peso opcional" aparece a la derecha del header "2. MOVIMIENTOS" — sugiere que el peso es un campo opcional en este tipo de bloque; confirmar si en código actual el campo Kg puede quedar vacío/placeholder en AMRAP.
- Los valores de ejemplo en los inputs (12.5 / 12.5, nombres "Ejercicio 2" repetidos 3 veces) son placeholders de mock, no representan datos reales — no llamativo, solo aclaración.
- El resumen dice "15 min" y "Realiza los 3 ejercicios tantas veces como puedas" — el copy es autogenerado a partir de la config (tiempo límite + cantidad de movimientos); confirmar si esto ya existe como texto dinámico en el código o es nuevo.
- El botón "Aceptar" y la Bar (header) están al mismo nivel de altura (`self-stretch` / `items-start`) formando una fila; en la app actual conviene revisar si el header de bloque ya tiene esta combinación bar+botón lado a lado.
