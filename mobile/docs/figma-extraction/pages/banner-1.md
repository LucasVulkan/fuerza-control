# Banner (`235:4343`)

## Qué muestra
Banner/tarjeta de programa activo, variante con placeholders genéricos ("Nombre de la etapa", "Nombre Programa") — parece un componente de banner en estado "template" (sin datos reales conectados aún), distinto del banner ya poblado con datos que aparece en HomeView.

## Componentes reconocidos
- No usa componentes reutilizables identificables de la librería "Components" — es el propio Banner (pieza base), compuesto solo por textos absolutos y formas decorativas.
- Pill "21 Sesiones" con borde, mismo estilo que en HomeView/banner-2.
- Elemento decorativo "Group 32" (ver `group-32.md`): 3 barras rotadas tipo comilla/marca, ubicado abajo a la izquierda.
- Separador entre bloque principal y bloque "SEMANA": aquí es una **línea diagonal rotada** (`rotate-[21.69deg]`), no vertical recta.

## Patrones de layout sin componente propio
- Layout de "card con separador interno en 2 columnas" (bloque etapa/programa a la izquierda + bloque semana/sesiones a la derecha) — mismo patrón conceptual que banner-2 y el banner de HomeView, pero con posicionamiento absoluto (no auto-layout) y decoración distinta.

## Sizing en contexto (fill/hug/fixed)
- Contenedor raíz: `size-full` (fill del frame contenedor), pero todo el contenido interno usa posicionamiento **absoluto con coordenadas fijas** (left/top en px) en vez de auto-layout — a diferencia del banner de HomeView que sí usa auto-layout (flex) parcialmente. Esto sugiere que este nodo es una versión más temprana/menos "componentizada" del banner.
- Pill "21 Sesiones": fixed `w-[92px] h-[27px]`.
- Bloque "ETAPA 1 - SEMANA 2 DE 3": un solo string de texto (no separado en label+valor como en banner-2).

## Notas / cosas a confirmar
- Comparado con **banner-2** (`233:4260`): este banner-1 (235:4343)...
  - Usa texto de placeholder ("Nombre de la etapa", "Nombre Programa") en vez de datos reales — sugiere que es un draft/plantilla anterior.
  - Combina "ETAPA 1" y "SEMANA 2 DE 3" en una sola línea de texto arriba a la izquierda, mientras banner-2 separa "ETAPA 1/3" en una pill propia y mueve "Semana 2 de 3" a la barra de progreso.
  - **No tiene barra de progreso "Volumen"** — banner-2 y el banner de HomeView sí la tienen. Esto sugiere que banner-1 es una iteración de diseño anterior a agregar la barra de progreso.
  - Tiene el elemento decorativo Group 32 (3 marcas rotadas) que no aparece en banner-2 ni en el banner final de HomeView — parece descartado en la iteración posterior.
  - El separador es una línea diagonal (`rotate-[21.69deg]`) vs. la línea vertical recta de banner-2/HomeView.
  - Conclusión: **banner-1 parece ser un diseño exploratorio/descartado y banner-2 el que evolucionó hacia la versión usada en HomeView** (banner-2 coincide en estructura casi exacta con el banner real de HomeView, incluyendo barra de progreso, pill ETAPA, separador vertical recto). Confirmar con el usuario/diseñador cuál es la versión "vigente" a implementar — todo indica que es banner-2, pero vale la pena verificar que banner-1 no sea en realidad una variante para otro contexto (ej. un tipo de programa distinto).
