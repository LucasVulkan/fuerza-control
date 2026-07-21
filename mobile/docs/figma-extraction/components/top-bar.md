# Top bar / Logo / Fecha / App Header (`119:809`, `119:829`, `119:827`, `119:846`)

Los cuatro nodos son piezas del mismo conjunto de cabecera. Hay dos composiciones distintas conviviendo en el archivo:

- **Top bar** (`119:809`): Logo + Fecha + icono "Subtract" (asset SVG suelto, forma de menú/hamburguesa en 3 líneas, rotado 180°).
- **App Header** (`119:846`): Logo + Fecha + componente **Icons** variante "Menu 2" (3 rectángulos armados a mano, no un asset único).

Es decir, **el icono de menú está resuelto de dos formas distintas** para lo que visualmente es el mismo elemento (ver "Hallazgo" abajo).

## Variantes
- Top bar (`119:809`): cabecera completa lista para pantalla (logo, hora/fecha, icono menú).
- Fecha (`119:829`): symbol suelto, solo el texto "19:53 - Sab 30, May".
- Logo (`119:827`): symbol suelto, "Forma" + isotipo "FIT".
- App Header (`119:846`): composición alternativa logo + fecha + icono menú (versión "Icons/Menu 2").

## Variables vinculadas
- Fecha, texto (todas las variantes): `color/mutedLight` = `#818181`.
- Top bar, contenedor: `radius/md` = `10` — **usada como padding vertical** (`py`), no como radio. Es una variable real y está vinculada, pero su uso semántico es raro (un token de "radius" aplicado a spacing). Revisar si en realidad debería ser `space/md` (también vale 10, incidentalmente).
- App Header: `color/accent` (`#aae216`) y `color/mutedLight` aparecen en las variables del nodo, pero `color/accent` no se ve en el JSX expuesto — probablemente está aplicado dentro del asset/relleno de los rectángulos del icono "Menu 2" (no visible como clase Tailwind, solo inferido de `get_variable_defs`).

## Valores sueltos SIN vincular (revisar)
- Texto "Forma" (Logo, todas las variantes): color `text-white` (blanco plano, sin variable) — debería vincularse a `color/text` (`#e6e6e6`) o a un token de blanco puro si existe uno dedicado a marca.
- Logo, gap entre "Forma" y "FIT" (todas las variantes): `1.899px` — valor fraccionario suelto, no coincide con ninguna variable de `space/*`. Probablemente artefacto de un componente escalado; aun así no está tokenizado.
- Fecha, tracking del texto: `0.4px` suelto (no es una variable, aunque el color sí lo es).
- App Header, gap entre Logo / Fecha / Icons: `35px` suelto — no coincide con ninguna variable de `space/*` (2/6/8/10/15/20). Es un valor arbitrario sin vincular.
- Icono "Subtract" (Top bar) e icono "Menu 2" (App Header): el color de relleno no es inspeccionable desde el código (son assets SVG/raster embebidos), no se puede confirmar si están vinculados a `color/text` o similar. Marcar para revisión visual manual.

## Tamaño
- Top bar (`119:809`): ancho fill (se reparte con `justify-between` dentro del padre), alto hug (definido por el padding vertical `radius/md`=10 + contenido).
- Logo (`119:827` / `119:810`): hug — ancho/alto determinados por el texto "Forma" + el asset "FIT" (fijo 45×19).
- Fecha (`119:829`): fixed 108×12.
- Icono "Subtract" (dentro de Top bar): fixed 22×18.071.
- App Header (`119:846`): hug (sin ancho/alto fijo, solo `gap-35px` entre hijos).
- Icons "Menu 2" (dentro de App Header): fixed 26×26.

## Condicionales/ocultos
- El icono de menú cambia de implementación según el contenedor: asset único "Subtract" en Top bar vs. componente compuesto "Icons" (property1="Menu 2", 3 rectángulos) en App Header. No es una condición de variante en el mismo componente, sino dos componentes padres distintos resolviendo el mismo lugar visual de forma diferente — al portar a RN conviene unificar en un solo ícono.
