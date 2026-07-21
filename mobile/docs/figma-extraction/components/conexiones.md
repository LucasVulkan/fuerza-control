# Conexiones (`110:3753`)

## Variantes
- **Default**: estado "Conectado" — punto verde (icono lleno), texto de botón "Conectado" en tono atenuado (no invita a acción, ya está conectado).
- **Variant2**: estado "Desconectado" — punto gris, texto de botón "Conectar" en verde acento pleno (invita a la acción de conectar).

## Variables vinculadas
- Contenedor: `color/surface` (#2a2a2a) fondo, `space/lg` (15) gap, `space/xxl` (28) padding horizontal, `space/md` (10) padding vertical, `radius/md` (10) radio, ancho fijo 363.
- Título "Drive Back up": `color/text` (#e6e6e6).
- Subtítulo (email): `color/mutedLight` (#818181).
- Botón texto "Conectado" (estado Default): `tint/accent-50` (#b8ff0080).
- Botón texto "Conectar" (estado Variant2): `color/accent` (#aae216).
- Botón contenedor: `space/sm` (6) padding horizontal, `space/md` (10) padding vertical, `radius/md` (10) radio.
- Icono de punto (verde/gris): imagen rasterizada exportada, no verificable como variable de fill vía el código generado.

## Valores sueltos SIN vincular (revisar)
- No se detectaron valores sueltos — todos los colores de texto y fondo usan `var(--...)` en ambas variantes.
- Nota aparte: `color/muted` (#4d4d4d) aparece en las variable defs del nodo pero no se usa en ningún elemento visible del componente — variable "huérfana" en este alcance, no es un valor suelto sino una variable declarada sin uso aquí.

## Tamaño
- Icono: fixed 26x26.
- Bloque de texto (título + subtítulo): flex-1 / min-w-px (fill — crece para llenar el espacio disponible entre icono y botón).
- Botón: hug (solo padding, sin ancho/alto fijo).
- Contenedor: ancho fijo 363, alto hug (definido por el padding vertical).

## Condicionales/ocultos
- No hay elementos que aparezcan/desaparezcan entre variantes; toda la estructura está presente en ambas. Solo cambian: la imagen del icono (punto verde vs gris), el texto del botón ("Conectado" vs "Conectar") y su color.
