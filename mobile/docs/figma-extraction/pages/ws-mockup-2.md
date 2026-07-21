# WS mockup (`104:313`)

## Qué muestra
Misma pantalla y mismos datos que `102:370` (Puente de glúteo + Dominadas), pero es el estado de header **antes de cualquier scroll**: header a 64px de alto, pegado al borde superior e izquierdo/derecho de la pantalla, SIN esquinas redondeadas y sin padding superior de página (el `padding` del contenedor pasa de `p-15` a `px-15` — se pierde el padding top). El resto del layout es idéntico a `102:370`.

Es la primera pieza de la secuencia de "header collapse": header full-bleed y cuadrado en reposo (scroll = 0).

## Componentes reconocidos
- **SesionHeader**: idéntico contenido a `102:370` (flecha, eyebrow+título+dots, icono menú), pero `w-[393px]` (ancho total de pantalla, no `w-full` relativo al padding) y sin `rounded-*` — ocupa el ancho completo del dispositivo y no tiene radio.
- **Exercise Card** x2: mismos componentes que en `102:370` (título, subtítulo, tabla KG/REP/RPE, filas S1/S2/S3, Input Fields, icono check).

## Patrones de layout sin componente propio
- Mismo patrón de fila de serie que en `102:370` (label + 3 celdas + check), sin componente propio nombrado.
- No hay lista agrupada de fondo compartido — cada card mantiene su propio radio y fondo independiente.

## Sizing en contexto (fill/hug/fixed)
- Contenedor raíz: cambia de `p-[15px]` (102:370) a `px-[15px]` (sin padding-top) — el header queda pegado al borde superior real de la pantalla (FILL de ancho completo, sin margen).
- SesionHeader: alto fijo 64px (FIXED), ancho fijo `w-[393px]` en vez de `w-full` relativo — ocupa el ancho total del viewport, no solo el área con padding.
- Exercise Cards: igual que en `102:370` (FILL de ancho, HUG de alto).

## Notas / cosas a confirmar
- Esta es probablemente la primera captura de una animación de "header collapse" disparada por scroll: en reposo (scroll=0) el header es cuadrado y ocupa todo el ancho sin margen; en cuanto se hace scroll, pasa a redondeado con margen (ver `102:370`) y luego se va achicando en alto (ver `104:167`, `104:449`). Confirmar con el diseñador si el orden de la secuencia es este o el inverso.
- Confirmar si el header "full-bleed" (este mock) es realmente el estado inicial o si es una variante alternativa sin relación con el scroll.
