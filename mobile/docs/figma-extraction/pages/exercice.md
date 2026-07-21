# Exercice (`123:951`)

## Qué muestra
Pantalla de detalle/progreso de UN ejercicio concreto ("Puente de Gluteo"). Muy similar en estructura a Progress pero enfocada en un solo ejercicio: header colapsable con el nombre, stats destacadas (1RM/CARGA), selector de métrica (KG/REPS/VOL/1RM) y un historial de sesiones anteriores con el detalle de series agrupado por bloque de peso.

## Componentes reconocidos
- **App Header**: igual que en History/Progress.
- **Bars** (variante título de ejercicio): barra accent con el nombre del ejercicio en mayúsculas ("PUENTE DE GLUTEO") + chevron a la derecha — mismo patrón que "Buscar Ejercicios" en Progress, reutilizado aquí como header colapsable/navegable de la pantalla.
- **Segmented control** (rango temporal): "7D"/"1M"/"3M"/"Todo", igual que en Progress, ancho fijo 198px, conviviendo con el botón "Programa actual" en la misma fila.
- **Buttons**: "Programa actual" (accent), igual que en Progress.
- **PregressCard**: mismas 2 variantes que en Progress (`Variant2`=1RM "74 - Kg"/"68Kg PR", `Default`=CARGA "+31%"/"+2.5% ult.ses."). Fila de 3 cards: 1RM, CARGA, CARGA.
- **Segmented control** (métrica, nuevo, no visto en Progress/History): 4 opciones "KG" / "REPS" / "VOL" / "1RM", "KG" activo. A diferencia del selector temporal, aquí el primer botón ("KG") tiene padding fijo (hug) mientras los otros 3 son `flex-[1_0_0]` (fill) — ver nota de sizing.
- **"Ejercicios progreso"** (mismo nombre de nodo que en Progress, pero contenido interno distinto): aquí es un log de sesiones pasadas para este ejercicio específico. Cada item: fecha (mutedlight, "Mar. 26 may.") + delta de carga vs. sesión anterior (verde "+3kg" o rojo "-13kg") en la fila superior; debajo, el detalle de series agrupado en 3 filas por bloque de peso.
- **Pills**: mismas pills de rep@RPE que en History (fondo `surface2`/gris cuando RPE~8, fondo `tint/red-30` cuando RPE~9 o "al fallo").
- **Icons**: chevron (10x10, rotado 90°) en el header del ejercicio, igual patrón que "Buscar Ejercicios" de Progress.

## Patrones de layout sin componente propio
- **Confirma el mismo patrón de "lista agrupada"** visto en Progress: los 5 items "Ejercicios progreso" (`123:968`...`123:972`) tienen fondo `surface`, gap `--space/xs` (2px) entre ellos, y radios asimétricos — primero con esquinas superiores `--radius/md` (10px) e inferiores `--radius/xxs` (2px); los 3 del medio con las 4 esquinas en `--radius/xxs`; el último con esquinas inferiores `--radius/md` y superiores `--radius/xxs`. Mismo mecanismo (radios por-item, no contenedor con overflow-clip).
- **Variante de "Estructura visualización datos ejercicios" distinta a la de History**: aquí no es una fila horizontal de pills sino una **tabla de 3 filas** (una por bloque de peso: 12.5kg, 15kg, 10kg), cada fila = peso (accent, alineado) + fila de Pills de reps@RPE (3-4 pills por fila, `justify-between`). Este layout "peso a la izquierda + pills a la derecha, repetido en 3 filas" es un patrón sin nombre de componente propio en el código, distinto del layout compacto de History.
- El bloque "fecha + delta" en la cabecera de cada item de historial (`justify-between`, fecha a la izquierda mutedlight, delta a la derecha en verde/rojo) es un patrón repetido sin componente propio.

## Sizing en contexto (fill/hug/fixed)
- Fila de 3 PregressCard: igual que en Progress, `flex-[1_0_0]` cada una (fill equitativo).
- Segmented control de métrica (KG/REPS/VOL/1RM): el botón activo "KG" es **hug** (`px-[var(--space/sm,6px)]`, sin `flex-1`), mientras REPS/VOL/1RM son **fill** (`flex-[1_0_0]`) — layout asimétrico donde el botón seleccionado no reparte espacio igual que el resto. Confirmar si es intencional o un descuido del mockup (en el segmented control de rango temporal de Progress, en cambio, ningún botón usa flex-1, todos son hug con `w-[198px]` fijo en el contenedor).
- Items de "Ejercicios progreso": `w-full`, alto hug (crece con las 3 filas de peso+pills).
- Dentro de cada fila de peso: el texto de peso tiene `w-[46px]` fijo en las filas 2 y 3 (alineación a la derecha) pero `w-full`-ish/auto en la primera fila — inconsistencia menor a confirmar.

## Notas / cosas a confirmar
- Esta pantalla reutiliza literalmente el mismo bloque de "1RM + CARGA x2" que Progress, pero aplicado a un solo ejercicio — sugiere que ese trío de stats (1RM, Carga, Carga) es un componente compartido entre "progreso general" y "progreso por ejercicio", y que las 2 tarjetas "CARGA" repetidas en el mock son placeholder (probablemente en la versión real serían métricas distintas, ej. Volumen total y Frecuencia, no la misma métrica duplicada).
- El selector KG/REPS/VOL/1RM implica que debería existir un **gráfico de tendencia** que cambia según la métrica seleccionada, pero **no hay ningún gráfico/chart visible en este nodo** — solo las stat cards y la lista de historial. Puede ser que el chart no esté diseñado aún, o que se omitió en este mock. Vale la pena confirmarlo, puede ser relevante para la decisión de producto de carga/tendencia.
- El log de sesiones con delta de carga (+3kg/-13kg) respecto a la sesión anterior es el indicador de progreso más "cuantitativo" encontrado en todo el archivo — no es RPE ni fatiga, es variación de peso total levantado sesión a sesión.
- Las pills con RPE 9 (fondo rojo) parecen marcar sistemáticamente la fila de mayor peso (10kg) en las 3 sesiones mostradas — coherente con "el peso más alto de la sesión es el más exigente", confirma que el color rojo = alto esfuerzo/RPE alto, no necesariamente "fallo total".
- Nombre de nodo "Ejercicios progreso" se reutiliza para dos estructuras de contenido bastante distintas entre Progress (lista de ejercicios navegables) y Exercice (log de sesiones de un ejercicio) — mismo nombre, propósito distinto; tenerlo en cuenta si se busca reutilizar el componente en código.
