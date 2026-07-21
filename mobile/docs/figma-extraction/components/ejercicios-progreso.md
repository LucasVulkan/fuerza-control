# Ejercicios progreso (`124:1059`)

Frame contenedor de 4 variantes, todas de ancho fixed **370px** (confirmado por `get_metadata`), alto hug (crece según contenido: 49 / 65 / 65 / 117 px respectivamente).

Internamente el componente reutiliza dos sub-componentes anidados:
- **Pills** (`106:3056`, variante única "reps Series"): la píldora base "12.5Kg x 12@8".
- **EstructuraVisualizacionDatosEjercicios** (`176:1267`/`176:1269`): fila de píldoras, con props `"Semi compacta"` (horizontal, usada por la variante `Semicompacto`) y `"Desglosada"` (vertical en 3 filas, usada por `Desglosado`). Nota: el naming de esta prop interna ("Semi compacta" con espacio) no coincide exactamente con el nombre de la variante padre ("Semicompacto" sin espacio) — inconsistencia de naming en Figma a tener en cuenta si se genera código a partir de los nombres.

La variante `compacto` NO usa este sub-componente: tiene su propia fila de píldoras inline (reutiliza `Pills` + una píldora custom en rojo).

## Variantes
- Ejercicio card: cabecera de ejercicio — nombre del ejercicio ("Hipertrofia - Pull"), meta de sesiones/progreso ("27 sesiones - +133% progreso") y chevron de navegación a la derecha. Sin píldoras de series.
- compacto: fecha + delta ("Mar. 26 may. / +13kg") arriba, y debajo una fila de 4 píldoras compactas en una sola línea (una en rojo = serie fallida).
- Semicompacto: igual que compacto arriba, pero las píldoras se generan vía el sub-componente `EstructuraVisualizacionDatosEjercicios` en modo horizontal (misma apariencia visual, distinta fuente de datos/composición).
- Desglosado: igual arriba (fecha + delta), pero debajo del delta despliega 3 filas, una por set de trabajo, cada fila con su peso ("12.5 kg" / "15 kg" / "10 kg") a la izquierda y 3-4 píldoras de reps@RIR a la derecha.

## Variables vinculadas
- Contenedor tarjeta (las 4 variantes): fondo = `color/surface` (#2a2a2a); padding horizontal = `space/lg` (15); padding vertical = `space/md` (10); radio = `radius/md` (10)
- Contenedor tarjeta (compacto/Semicompacto/Desglosado, layout columna): gap = `space/sm` (6)
- Fecha ("Mar. 26 may."): color = `color/mutedLight` (#818181); tipografía = `text/tag` (Inter Medium 10px)
- Delta ("+13kg"/"+3kg"): color = `color/green` (#66fa39); tipografía = `text/card-type` (Inter Extra Bold 12px, tracking 1.2px)
- Ejercicio card — nombre ("Hipertrofia - Pull"): color = `color/text` (#e6e6e6); tipografía = `text/card-type`
- Ejercicio card — meta: color base = `color/mutedLight` (#818181), con el "+133%" en `color/accent` (#aae216); tipografía = `text/tag`; gap interno = `space/xs` (2)
- Todas las Pills (fondo/padding/radio, en las 4 variantes): fondo variable según estado — `tint/accent-10` (rgba(184,255,0,0.1)) para set normal, `tint/red-30` (rgba(189,6,0,0.3)) para set fallido, `color/surface2` (#3a3a3a) para sets neutros (usado en Desglosado); padding = `space/sm` (6); radio = `radius/xs` (4)
- Desglosado — fila de peso por set ("12.5 kg" etc.): color = `color/accent` (#aae216) para el número, con el sufijo "kg" en `color/text` (#e6e6e6, como span override); tipografía contenedor = tamaño 12px Inter Black
- Desglosado — píldoras neutras: color de texto = `color/mutedLight` (#818181)

## Valores sueltos SIN vincular (revisar)
Hallazgo más llamativo: **el patrón se repite de forma sistemática en las 4 variantes** — el fondo/padding/radio de cada píldora SÍ está vinculado a variables, pero el color de los `<span>` de texto dentro de casi todas las píldoras usa hex/rgba literal en vez de la variable correspondiente, a pesar de que el valor coincide exactamente con un token existente:
- `text-[#aae216]` → debería ser `color/accent` (compacto, Semicompacto, Desglosado, y en Pills base)
- `text-[#e6e6e6]` → debería ser `color/text` (aparece en casi todas las píldoras, ej. sufijo "Kg", "@8")
- `text-[#818181]` → debería ser `color/mutedLight` (ej. la "x" en las píldoras "12.5Kg x")
- `text-[#ff0900]` → debería ser `color/red` (números dentro de píldoras rojas, en compacto/Semicompacto/Desglosado)
- `text-[rgba(184,255,0,0.5)]` → debería ser `tint/accent-50` (el "@" dentro de píldoras verdes)
- `text-[rgba(255,94,88,0.5)]` → debería ser `tint/red-50` (el "@" dentro de píldoras rojas)

Esto se repite decenas de veces (cada número/símbolo dentro de cada píldora es un `<span>` separado con su propio color hardcodeado) en: Pills base, la fila inline de `compacto`, ambos modos de `EstructuraVisualizacionDatosEjercicios` (Semi compacta y Desglosada). Consistente con lo que el usuario confirmó: es un descuido sistemático, no algo puntual — vale la pena revisar/normalizar el componente Pills completo en Figma antes del rediseño.

- Gap `gap-[6px]` en el wrapper de `EstructuraVisualizacionDatosEjercicios` (variante "Semi compacta") y en el punto donde `EjerciciosProgreso` instancia ese sub-componente para `Semicompacto`: es un valor fijo de 6px que coincide exactamente con `space/sm` (6) pero está escrito como literal `gap-[6px]` en vez de `gap-[var(--space/sm,6px)]`. Revisar.
- Desglosado — ancho `w-[46px]` fixed en la columna de peso ("15 kg", "10 kg" alineados a la derecha): no es una variable de espaciado, es un ancho de columna para alinear texto; probablemente intencional pero no hay token para "ancho de columna", solo mencionarlo como valor fijo a confirmar con diseño.

## Tamaño
- Contenedor tarjeta: ancho fixed 370px (las 4 variantes); alto hug (49 / 65 / 65 / 117px según variante, crece con el contenido).
- Ejercicio card — bloque de texto: fill (flex-1) del ancho disponible a la izquierda del chevron.
- Pills (todas): hug (ancho/alto según contenido de texto + padding).
- Desglosado — columna de peso: fixed 46px en filas 2 y 3 ("15 kg", "10 kg"); la fila 1 ("12.5 kg") no tiene ancho fijo explícito (hug), inconsistencia menor entre filas del mismo tipo.

## Condicionales/ocultos
- Fecha + delta ("Mar. 26 may." / "+13kg"): solo aparece en `compacto`, `Semicompacto`, `Desglosado` — NO en `Ejercicio card`.
- Nombre de ejercicio + meta de progreso ("Hipertrofia - Pull" / "27 sesiones..."): solo aparece en `Ejercicio card`.
- Chevron/ícono de navegación (instancia de `Arrow_Special` del icon set): solo aparece en `Ejercicio card`.
- Fila de píldoras vía `EstructuraVisualizacionDatosEjercicios`: solo aparece en `Semicompacto` (modo horizontal "Semi compacta") y `Desglosado` (modo vertical "Desglosada").
- Fila de píldoras inline (propia, sin sub-componente): solo aparece en `compacto`.
- En Desglosado, las 3 filas de sets están hardcodeadas en el ejemplo (pesos 12.5/15/10 kg, con distinta combinación de píldoras rojas/neutras por fila) — es data de ejemplo, no contenido condicional del componente en sí.
