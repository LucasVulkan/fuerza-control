# Segmented control (`210:2612`)

## Variantes
- **Group together** (`210:2611`): un solo contenedor con fondo compartido (`color/surface2`) que agrupa 3 botones; el primero ("Selected") resaltado en verde, los otros 2 en gris/texto muted. Es el segmented control "clásico" (ej. tabs).
- **Etapas** (`210:3344`): misma estructura que Group together pero cada botón agrega una segunda línea de texto pequeña ("Toggle On") debajo del label principal — variante para mostrar 2 líneas de info por segmento (ej. nombre de etapa + subtítulo).
- **Individual buttons** (`210:2613`): cada botón es independiente, con su propio fondo y radio (no comparten contenedor con bg único) y gap entre ellos — visualmente parecen botones sueltos en vez de un control segmentado.

## Variables vinculadas
- Contenedor (Group together / Etapas): `radius/md`=10 (radio), `color/surface2`=`#3a3a3a` (fondo), `space/xs2`=4 (padding).
- Contenedor (Individual buttons): `space/sm`=6 (gap y padding) — sin `color/surface2` propio (cada botón trae el suyo).
- Botón "Selected"/"Toggle On" (todas las variantes): `color/accent`=`#aae216` (fondo), `radius/sm`=6, `space/sm`=6 (padding horizontal), texto `color/onAccent`=`#000000`.
  - Padding vertical del botón seleccionado difiere por variante: `space/sm2`=8 en Group together/Etapas vs `space/md`=10 en Individual buttons (ambas vinculadas, pero inconsistentes entre sí — revisar si es intencional).
- Botones no seleccionados ("Option 2"/"Option 3"): texto `color/mutedLight`=`#818181`; en Individual buttons también `color/surface2` de fondo, `radius/sm`, `space/md` de padding (uniforme, a diferencia de Group together que no tiene bg propio por botón).
- Texto principal de todos los botones: estilo de texto `text/card-type` (Inter Extra Bold 12px, tracking ~10%).
- Subtítulo "Toggle On" (solo Etapas): estilo `text/tag` (Inter Medium 10px). Color: `color/surface2` sobre el botón seleccionado (texto oscuro sobre verde) y sin variable de color explícita en los botones no seleccionados (hereda default).
- Gap interno del contenedor (Group together/Etapas) usa `radius/sm`=6 en vez de un token de `space/*` — variable vinculada pero de la categoría equivocada (un radio usado como gap). Incidentalmente coincide en valor con `space/sm` (también 6), pero semánticamente está mal elegida.

## Valores sueltos SIN vincular (revisar)
- No se detectaron colores o espaciados en hex/px puro sin vincular — todos los valores de color/spacing usan variables (aunque algunas mal elegidas semánticamente, ver arriba).
- Anchos fijos de los botones (82px "Selected", 117px "Option 2"/"Option 3") son literales sin token — esperable, los anchos de botón normalmente no se tokenizan, pero queda para decisión de diseño si conviene un ancho mínimo/variable en vez de fijo.

## Tamaño
- Group together (`210:2611`): hug — 336×39 (medida resultante, no fijada explícitamente en el nodo).
- Etapas (`210:3344`): hug — 336×51 (más alto por la segunda línea "Toggle On").
- Individual buttons (`210:2613`): hug — 340×47.
- Botón "Selected"/"Toggle On": fixed ancho 82px, alto hug.
- Botón "Option 2"/"Option 3": fixed ancho 117px, alto hug.

## Condicionales/ocultos
- La línea de subtítulo "Toggle On" bajo cada label solo aparece en la variante **Etapas**; en Group together e Individual buttons no existe ese segundo renglón.
- El color de texto del subtítulo cambia entre "surface2" (sobre el botón verde seleccionado) y sin color explícito en los otros dos botones — revisar en Figma si falta vincular ahí también.
