# Estructura visualización datos ejercicios (`176:1268`)

## Variantes
- **Semi compacta**: fila horizontal de "pills" en una sola línea — pensada como vista resumida dentro de una card de ejercicio (peso x reps + resultado de cada serie en formato compacto). Tiene dos grupos de pills separados por un gap (probablemente serie actual vs próximas series).
- **Desglosada**: vista expandida en columna, una fila por serie — peso a la izquierda (alineado a la derecha del label) y pills de reps/RPE a la derecha, en grid.

## Variables vinculadas
- Fondos de pills: `tint/accent-10` (#b8ff001a) para pills "positivas" (verde), `tint/red-30` (#bd06004d) para pills "negativas" (rojo), `color/surface2` (#3a3a3a) para pills neutras (solo Desglosada).
- Pills: `space/sm` (6) padding, `radius/xs` (4) radio.
- Gap entre filas en Desglosada: `space/xs` (2).
- Wrapper de texto de pill roja (ej. `176:1326`): `color/red` aplicado a nivel de wrapper.
- Wrapper de texto de pills neutras (ej. `176:1325`, `176:1327`): `color/mutedLight` aplicado a nivel de wrapper.
- Número grande de peso en Desglosada (ej. "12.5" en `176:1323`): `color/accent` a nivel de wrapper.

## Valores sueltos SIN vincular (revisar)
Hallazgo sistemático — el fondo y borde de las pills SÍ están vinculados a variables, pero casi todos los `<span>` internos con los números usan hex/rgba sueltos que coinciden en valor con variables existentes pero no están enlazados a ellas:
- Pill de peso sin fondo (Semi compacta, `176:1249`/`176:1254`): span "12.5"/"8" con `text-[#aae216]` → debería ser `color/accent`; span "Kg" con `text-[#e6e6e6]` → debería ser `color/text`; span "x" con `text-[#818181]` → debería ser `color/mutedLight`.
- Pills rojas (ambas variantes, ej. `176:1250`, `176:1326`, `176:1339`): spans de número con `text-[#ff0900]` → debería ser `color/red` (redundante con el wrapper, que sí está vinculado); span "@" con `text-[rgba(255,94,88,0.5)]` → debería ser `tint/red-50`.
- Pills verdes/accent (ej. `176:1251`, `176:1252`, `176:1256`, `176:1257`): spans de número con `text-[#aae216]` → debería ser `color/accent`; span "@" con `text-[rgba(184,255,0,0.5)]` → debería ser `tint/accent-50`.
- Pills neutras grises (Desglosada, ej. `176:1325`, `176:1327`, `176:1328`, `176:1332`): span de número con `text-[#e6e6e6]` → debería ser `color/text` (el "@8" sí hereda correctamente el `mutedLight` del wrapper al no tener span propio).
- Unidad "kg" junto al peso grande (Desglosada, ej. `176:1323` "12.5 kg"): span "kg" con `text-[#e6e6e6]` → debería ser `color/text` (el número "12.5" sí está vinculado a `color/accent` en el wrapper, pero el span "kg" no).
- Gap del contenedor raíz en Semi compacta (`176:1267`): `gap-[6px]` sin var → debería ser `space/sm` (inconsistente con el resto del archivo, que sí usa `space/xs`/`space/sm` en todas las demás partes).
- Primera pill "peso x" en Semi compacta (`176:1249`, `176:1254`): usa `pl-[space/sm] py-[space/sm]` pero SIN padding derecho (`pr`), a diferencia de todas las demás pills que usan `p-[space/sm]` en las 4 direcciones — posible descuido de espaciado, no solo de color.

Es el hallazgo más llamativo de los 4 archivos: prácticamente todos los textos numéricos dentro de las pills (en ambas variantes) usan hex/rgba sueltos en vez de heredar o vincular la variable ya declarada en el wrapper padre.

## Tamaño
- Semi compacta (contenedor raíz): hug (flex-wrap, sin ancho fijo) — se ajusta al contenido.
- Segundo grupo de pills en Semi compacta (`176:1253`): hug, aparece después del primer grupo separado por gap.
- Desglosada (contenedor de columna): ancho fijo 340px, alto hug (una fila por serie).
- Labels de peso en Desglosada: ancho fijo 46px en filas 2 y 3 (`176:1330`, `176:1337`), pero la fila 1 (`176:1323`) NO tiene ancho fijo — inconsistencia de layout que puede desalinear la columna de pesos entre la primera fila y el resto.
- Pills individuales: hug (solo padding, sin ancho/alto fijo).

## Condicionales/ocultos
- Todo el contenido de "Semi compacta" (pills en línea, 2 grupos) solo aparece en esa variante.
- Todo el contenido de "Desglosada" (3 filas de peso + pills) solo aparece en esa variante.
- Ambas variantes reutilizan el mismo componente "Pills" pero con layout padre distinto (wrap horizontal vs columna vertical).
