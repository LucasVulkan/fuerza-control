# Chips (`110:4247`)

## Variantes
- **Default**: chip verde/acento — probablemente aviso positivo o sugerencia (texto de ejemplo: "deberías subir ~2.5kg").
- **Variant2**: chip rojo — probablemente alerta/advertencia.
- **Variant3**: chip azul — probablemente informativo/neutral.

## Variables vinculadas
- Contenedor (las 3 variantes): `space/sm` (6) padding, `radius/xs` (4) radio, ancho fijo 333, borde izquierdo (`border-l`, grosor sin token explícito, probablemente 1px por defecto).
- Default: fondo `tint/accent-10` (#b8ff001a), borde `color/accent` (#aae216), texto `tint/accent-50` (#b8ff0080).
- Variant2: fondo `tint/red-30` (#bd06004d), borde `color/red` (#ff0900), texto `tint/red-50` (#ff5e5880).
- Variant3: fondo `tint/blue-30` (#003ec34d), borde `color/blue` (#4c85ff), texto `tint/blue-70` (#598effb2).

Nota: Variant3 usa una familia de tokens "blue" (`color/blue`, `tint/blue-30`, `tint/blue-70`) que no está en la lista de tokens conocidos del proyecto — confirmar si hay que incorporarla al sistema de diseño de la app o si es exclusiva de este archivo de Figma.

## Valores sueltos SIN vincular (revisar)
- No se detectaron valores sueltos — las 3 variantes vinculan consistentemente fondo, borde y texto a variables.

## Tamaño
- Contenedor: ancho fijo 333, alto hug (definido por `space/sm` de padding).
- Texto interior: flex-1 / min-w-px (fill — ocupa el espacio restante del chip).

## Condicionales/ocultos
- Ninguno — la estructura es idéntica en las 3 variantes, solo cambia la paleta de color (fondo/borde/texto) y el texto de ejemplo.
