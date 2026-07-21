# Pregress card (`121:808`)

Nota: el nombre en Figma está mal escrito ("Pregress card"). Corrección esperada: **"Progress card"**. Se conserva el nombre original de Figma en este documento por trazabilidad.

## Variantes
- Default: tarjeta de progreso con métrica porcentual — ej. "+31% / CARGA / +2.5% ult.ses." (variación de carga de trabajo)
- Variant2: tarjeta de progreso con métrica de peso — ej. "74 - Kg / 1RM / 68Kg PR" (repetición máxima estimada + PR)

Ambas comparten exactamente la misma estructura (contenedor > bloque valor+label > subtítulo), solo cambia el contenido de texto y un ancho fijo puntual en Variant2.

## Variables vinculadas
- Contenedor (ambas variantes): fondo = `color/surface` (#2a2a2a); padding horizontal = `space/xl` (20); padding vertical = `space/lg` (15); radio = `radius/lg` (18)
- Grupo interno de texto (ambas variantes): gap = `space/lg` (15)
- Bloque valor+label (ambas variantes): gap = `space/xs` (2)
- Valor principal ("+31%" / "74 - Kg"): color = `color/accent` (#aae216); tipografía = `text/hero` (Inter Black 20px)
- Label ("CARGA" / "1RM"): color = `color/text` (#e6e6e6); tipografía = `text/spacing tag` (Inter Extra Bold 10px, tracking 2px, uppercase)
- Subtítulo ("+2.5% ult.ses." / "68Kg PR"): color = `tint/accent-50` (rgba(184,255,0,0.5)); tipografía = `text/tag` (Inter Medium 10px)

## Valores sueltos SIN vincular (revisar)
Ninguno encontrado. Este componente está 100% vinculado a variables — todos los colores, espaciados, radio y tipografías provienen de tokens. Es el componente más "limpio" de los tres analizados.

## Tamaño
- Contenedor: ancho fixed 119px (ambas variantes, según `get_metadata`); alto hug (determinado por contenido + paddings, ~95px en la captura).
- Valor+label: fill del ancho del contenedor (`w-full` en Default; en Variant2 el label usa `min-w-full w-[min-content]` y el valor `w-[85px]` fixed — ligera inconsistencia entre variantes en cómo se define el ancho del texto, pero sin impacto visual dado que el contenedor ya es fixed).

## Condicionales/ocultos
- Ninguno — ambas variantes renderizan exactamente los mismos 3 elementos (valor, label, subtítulo), solo cambia el texto.
