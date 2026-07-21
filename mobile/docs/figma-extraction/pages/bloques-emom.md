# Bloques: EMOM (`192:1897`)

## Qué muestra
Misma estructura de editor de bloque de acondicionamiento que AMRAP, pero en modo EMOM: agrega selector "Tipo de EMOM" (Repetir bloque / Rotar ejercicios) y selector de duración de intervalo (30s/45s/60s/90s/120s), más el stepper de "Rondas" en vez de "Tiempo límite".

## Componentes reconocidos
- Mismos componentes que `bloques-amrap.md`: **Bars** (header tipo de bloque), **Buttons** (Aceptar, Añadir ejercicio outline, Guardar preset), **Exercice editor elements** (resumen / filas de stepper / filas de ejercicio), **Segmented control** (usado 3 veces aquí: Formato, Tipo de EMOM, Intervalo), **Icons** (drag handle), **Input Field** (reps/Kg), **Option blocks** (Nombre + nota).
- Segmented control "Intervalo" tiene 5 opciones (30s/45s/60s/90s/120s) en vez de 3 — mismo componente pero con más items, cada uno sigue siendo `flex-1`.

## Patrones de layout sin componente propio
- Misma **lista agrupada de ejercicios** que en AMRAP (`192:1917`): gap 2px, bg surface por fila, radio solo primer/último item — aquí con 3 filas (Ejercicio 1/2/3).
- Mismo patrón de "sección numerada" con `<ol>` para "1. FORMATO", "2. INTERVALO" (sub-sección dentro de bloque 1), "3. MOVIMIENTOS".
- Fila stepper reutilizada para "Rondas" (idéntica a "Tiempo límite" de AMRAP, mismo layout label+stepper).

## Sizing en contexto (fill/hug/fixed)
- Igual que AMRAP: contenedor raíz fill w-full con padding fijo.
- Segmented controls fill w-full, opciones `flex-1` — en el de 5 opciones (Intervalo) las últimas 2 (90s/120s) tienen `padding-x` mayor (`var(--space/md,10px)` vs `var(--space/sm,6px)` en las primeras 3), posible inconsistencia de padding entre opciones del mismo control a confirmar.
- Fila "Rondas": fill w-full, altura fija 46px (igual patrón que Tiempo límite en AMRAP).
- Resto de sizing idéntico a AMRAP (inputs reps/Kg fixed 51px, icono arrastre fixed 26px, textarea nota fixed 54px alto).

## Notas / cosas a confirmar
- El segmented control "Formato" (`1. FORMATO`) muestra **"AMRAP" seleccionado en acento** aunque este mockup es de EMOM — probablemente un artefacto de copiar/pegar el componente desde el mockup de AMRAP sin actualizar el estado seleccionado. Confirmar con diseño si es error de mock o si el nombre del nodo/página no coincide con el estado real que debería mostrarse (debería tener "EMOM" seleccionado).
- Resumen dinámico: "3 ejercicios x 5 rondas = 15 intervalos de 45s" — texto calculado a partir de (cantidad de movimientos) x (rondas) = (intervalos totales) de (duración de intervalo). Confirmar que la fórmula coincide con la lógica real de EMOM en el código (intervalos = ejercicios × rondas cuando el tipo es "Rotar ejercicios"; en "Repetir bloque" podría ser distinto).
- "Tipo de EMOM": Repetir bloque vs Rotar ejercicios — no tengo certeza de si esto ya existe como concepto en el código actual (mobile). Vale la pena confirmar si hoy EMOM solo soporta un modo o si esta es una feature nueva a implementar.
- Duración de intervalo por defecto mostrada: 30s seleccionado; valores disponibles fijos (30/45/60/90/120s) sugieren un enum cerrado, no un input libre — confirmar si el código actual permite valores custom.
