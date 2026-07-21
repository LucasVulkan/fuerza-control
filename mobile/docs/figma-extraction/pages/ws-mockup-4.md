# WS mockup (`104:449`)

## Qué muestra
Misma pantalla y mismos datos que las tres anteriores, con el header en su estado **más colapsado**: 36px de alto (vs 46px en `104:167`, 64px en `102:370`/`104:313`). Mismo layout de una sola fila que `104:167` (flecha / título / dots / menú), solo que aún más comprimido verticalmente. El contenedor raíz aquí además tiene `py-10` (padding vertical de página, no solo lateral), a diferencia de las otras tres variantes.

Es el tercer y último paso visible de la secuencia de collapse del header.

## Componentes reconocidos
- **SesionHeader** (variante colapsada final): 36px alto, mismo contenido de una fila que en `104:167` (flecha, título 12px sin eyebrow, 7 dots, icono menú), pero con menos padding vertical interno.
- **Exercise Card** x2: contenido idéntico a las otras variantes, con una diferencia de interacción notable — ver nota de highlighting abajo.

## Patrones de layout sin componente propio
- Igual que en las variantes anteriores.

## Sizing en contexto (fill/hug/fixed)
- SesionHeader: alto fijo 36px (FIXED, el menor de las 4 variantes).
- Contenedor raíz: `py-[10px]` en vez de `p-[15px]` — hay menos aire arriba/abajo de página en este estado, coherente con "header más compacto = más espacio para contenido".

## Notas / cosas a confirmar
- **Diferencia de interacción relevante**: en esta variante, la celda KG de la fila S2 de la segunda card ("Dominadas") tiene fondo `tint/accent-50` (verde sólido/brillante) con texto blanco, mientras el resto de las celdas resaltadas del workout usan `tint/accent-10` (tenue). Esto sugiere un segundo nivel de highlight: el fondo tenue (`accent-10`) marca "la próxima serie a entrenar" a nivel de fila completa, y el fondo intenso (`accent-50`) marca el campo específico que está siendo editado/enfocado en ese momento (p.ej. el usuario tocó el stepper de KG). Confirmar con el diseñador si este es un estado de foco/edición activo.
- Confirmar si el `py-10` del contenedor raíz es intencional en este estado o un desajuste del mock.
