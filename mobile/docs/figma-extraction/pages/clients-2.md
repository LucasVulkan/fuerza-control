# Clients (`235:4471`)

## Qué muestra
**A pesar del nombre de capa "Clients"/"Clientes", esta pantalla en realidad es la lista de PLANTILLAS de programa** del coach: header "PLANTILLAS 3" + botón "+ Plantilla", y una lista de tarjetas de plantilla (nombre, etapas/semanas/sesiones, botones "Ver plantilla" / "Asignar"). El nombre de nodo/página es un residuo de haberla duplicado desde la pantalla de Clients real (`clients-1.md`) sin renombrar.

## Componentes reconocidos
- **App Header**: idéntico a `clients-1.md` (Logo, Fecha, Menu 2).
- Título de sección "PLANTILLAS" + contador en acento ("3") — mismo patrón que "CLIENTES 7" de `clients-1.md`, pero sin los iconos de acción (€, nube) que sí tenía esa pantalla; aquí solo queda el botón "+ Plantilla".
- **Sesion Card** (mismo componente base, variante "Plantillas"): header con label "PLANTILLA" (uppercase, pequeño, acento) + menú "..." (3 dots), título "Hipertrofia Push/Pull", fila de 3 estadísticas (3 ETAPAS / 13 SEMANAS / 52 SESIONES, número en acento + label mutedlight), y footer con 2 botones muted lado a lado: "Ver plantilla" y "Asignar".
- **Buttons**: variante "+ Plantilla" (fondo acento) reemplaza a "+ Cliente"; botones muted "Ver plantilla"/"Asignar" (mismo estilo muted que "EDITAR"/"VER" de HomeView).

## Patrones de layout sin componente propio
- Lista de tarjetas de plantilla (`235:4484`): igual que en `clients-1.md`, **cada card tiene radio completo propio y gap de 6px** — tampoco es el patrón de "lista agrupada". Confirma que el patrón agrupado (fondo compartido, radio solo extremos) NO aparece en ninguna de las 2 variantes de esta pantalla, solo en la lista de ejercicios de los bloques AMRAP/EMOM.
- Footer de card con 2 botones lado a lado ("Ver plantilla" / "Asignar", `justify-between`) — patrón nuevo no visto en `clients-1.md` (ahí solo había 1 botón de acción por card).
- Fila de estadísticas inline (número acento + label pequeño, repetido 3 veces con gap) — mismo patrón visual que aparece luego en `clients-program-view.md` (07 SEMANA / 13 SESIONES).

## Sizing en contexto (fill/hug/fixed)
- Igual estructura general que `clients-1.md`: contenedor raíz fill, header hug/fixed, lista fill w-full.
- Cards de plantilla: fill w-full, altura hug (`gap-[var(--radius/lg,18px)]` interno entre el bloque de info y el bloque de botones — nota: usa el token de radius como si fuera un gap, posible reutilización de variable no semánticamente correcta a confirmar).
- Botones "Ver plantilla"/"Asignar": hug, mismo ancho aproximado por padding pero no forzado a `flex-1` (a diferencia de "EDITAR"/"VER" en HomeView que sí eran `flex-1`).

## Notas / cosas a confirmar
- **Diferencia principal con clients-1**: clients-1 (`150:1165`) es la lista real de clientes del coach; clients-2 (`235:4471`) es la lista de plantillas de programa reutilizando el mismo layout/componentes (App Header, título+contador, Sesion Card, lista con gap) pero con contenido y acciones distintas. No son 2 estados de la misma pantalla sino 2 pantallas distintas que comparten el mismo esqueleto visual — el nombre "Clients" en esta segunda es un error de nomenclatura en Figma, no un indicio de que sean la misma vista.
- Recomendación: al implementar, tratar esto como una pantalla separada "Plantillas de programa" (para el rol coach/entrenador), reutilizando el mismo componente base de card que "Clientes" pero con props/contenido distintos — no como una variante de la pantalla de clientes.
- Confirmar con el diseñador si el nombre de capa debería corregirse en el archivo de Figma para evitar confusión futura.
- Faltan los iconos de acción (€, nube+sync) y la barra de búsqueda+filtro que sí tenía `clients-1.md` — confirmar si esta pantalla de plantillas los necesita también o si fue simplificada a propósito.
