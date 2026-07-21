# WS mockup (`104:167`)

## Qué muestra
Misma pantalla y mismos datos que `102:370`/`104:313`, pero con el header ya "colapsado" a 46px de alto (vs 64px). El header vuelve a tener esquinas redondeadas y margen de página (`p-15` completo, como en `102:370`), pero su contenido interno cambia de layout: en vez de eyebrow+título+dots apilados verticalmente en el centro, ahora es una sola fila: flecha ← / título "Hipertrofia - Pull" (sin eyebrow "SESIÓN A") / 7 puntos de progreso / icono menú — todo en una línea horizontal.

Es el segundo paso de la secuencia de collapse: header más bajo, contenido reflowed a una fila.

## Componentes reconocidos
- **SesionHeader** (variante colapsada intermedia): 46px alto, `rounded-md`, `px-20`. El bloque título pierde el eyebrow "SESIÓN A" y el título baja a 12px (antes 20px). Los 7 puntos de progreso, que antes estaban debajo del título, ahora se ubican a la derecha del título, en su propio grupo con `gap-6`, verticalmente centrados con el alto completo del header.
- **Exercise Card** x2: sin cambios respecto a `102:370` (mismos textos, misma tabla S1/S2/S3, mismo resaltado de S2 solo en la primera card).

## Patrones de layout sin componente propio
- Igual que en las variantes anteriores: filas de serie repetidas manualmente, sin lista agrupada de fondo compartido.

## Sizing en contexto (fill/hug/fixed)
- SesionHeader: alto fijo 46px (FIXED, menor que 64px) — el título y los dots pasan de layout vertical (columna) a horizontal (fila) para caber en la altura reducida.
- Título del header: ancho HUG (`w-[99px]`, ya no `w-[166px]` con texto centrado) — el texto ahora es más corto porque no lleva el eyebrow.
- Resto de la pantalla (cards): igual que en `102:370` (FILL de ancho, HUG de alto).

## Notas / cosas a confirmar
- Confirmar el trigger exacto del cambio de layout (vertical→horizontal) dentro del header: ¿es un breakpoint de altura, o una transición continua/interpolada durante el gesto de scroll?
- El eyebrow "SESIÓN A" desaparece completamente en este estado (no se colapsa a texto más chico, se elimina) — confirmar si esta información se pierde o se muestra en otro lugar cuando el header está colapsado.
