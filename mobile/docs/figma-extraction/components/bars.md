# Bars (`121:824`)

## Variantes
- **Search** (`121:822`): barra de búsqueda, fondo gris neutro con placeholder "Search bar...".
- **Dropdown** (`121:825`): pill de filtro/selección ("Names") con flecha, fondo verde acento — parece un chip de dropdown/filtro activo, no una barra de búsqueda.

## Variables vinculadas
- Contenedor (ambas variantes): `space/lg`=15 (padding horizontal), `space/md`=10 (padding vertical), `radius/sm`=6.
- Dropdown: fondo `color/accent`=`#aae216`; texto "Names" en `color/onAccent`=`#000000`, estilo `text/spacing tag` (Extra Bold 10px, tracking 20%≈2px).
- Search: fondo `color/surface2`=`#3a3a3a`; texto placeholder en `color/mutedLight`=`#818181`, estilo `text/subtitle` (Medium 12px, tracking 4%≈0.48px).

## Valores sueltos SIN vincular (revisar)
- No se encontraron colores o espaciados sueltos sin vincular en este nodo — contenedor y textos usan variables consistentemente.
- El icono de flecha (Dropdown, asset "Rectangle56", 10×10, rotado 90°) no es inspeccionable desde el código (relleno embebido en el asset); no se puede confirmar si su color está vinculado a `color/onAccent` o es un valor fijo dentro del asset. Revisar manualmente en Figma.
- Detalle menor: la pill "Dropdown" usa `mr-[-10px]` como ajuste de layout (hack de margen negativo para compensar el gap antes del ícono) — no es un token de diseño, es un ajuste de posicionamiento puntual, no requiere acción pero puede romperse si cambia el padding.

## Tamaño
- Search (`121:822`): sin ancho fijo en el código exportado → **hug** (se ajusta al placeholder "Search bar..."). Metadata del symbol lo muestra en 108×35 dentro del frame, pero eso es resultado del hug, no una restricción fija.
- Dropdown (`121:825`): fixed ancho 76px, alto hug (~32px resultante).

## Condicionales/ocultos
- El ícono de flecha (10×10, rotado 90°) solo aparece en la variante **Dropdown**; Search no tiene ícono.
