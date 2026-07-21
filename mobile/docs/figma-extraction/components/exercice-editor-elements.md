# Exercice editor elements (`160:1197`)

## Variantes
- Caja: tarjeta compacta de "Series" con contador +/- centrado (ancho fijo pequeño, 156px). Uso suelto tipo stepper.
- Horizontal: fila "Series" con label a la izquierda y contador +/- a la derecha, mismo patrón que Caja pero en layout horizontal.
- Progresion: fila con icono de barras, título "Automática" y subtítulo descriptivo de la progresión configurada. Incluye icono chevron a la derecha (fila navegable).
- Resumen: caja destacada (borde y fondo verdes) que muestra el resumen final de series/reps/descanso más el mensaje de progresión ("Sube 2.5 kg al completar...").
- Ejercicios Bloques: contenedor de bloque con header "Reps/Kg" y lista de ejercicios (cada uno con drag handle, nombre e inputs de reps/kg), más botón "Nuevo movimiento".
- Ejercicio blqoues (typo en Figma): fila individual de ejercicio dentro de un bloque, con nombre, inputs de reps/kg con labels y drag handle. Es la fila suelta que compone "Ejercicios Bloques".
- Ejercicio editor: fila de ejercicio en el editor principal (fuera de bloques), con drag handle, nombre + subtítulo (series x reps . descanso) y pills de grupo ("G1", "Auto").
- divider: línea separadora fina (1px) dentro de un contenedor de 4px de alto.

## Variables vinculadas
- Contenedor base (todas): `color/surface` = #2a2a2a (bg), `space/md` = 10px (gap/padding), `radius/sm` = 6px — excepto Ejercicio editor que usa `radius/xxs` = 2px y `space/sm2` = 8px de padding vertical.
- Resumen: `tint/accent-10` = rgba(184,255,0,0.1) (bg), `tint/accent-50` = rgba(184,255,0,0.5) (border), `space/sm/md/lg` (6/10/15), `radius/md` = 10px.
- Título "RESUMEN": `color/accent` = #aae216.
- Texto "3 x 812 REPS 90s" (Resumen): `color/text` = #e6e6e6.
- Subtítulo "Sube 2.5 kg..." (Resumen): `tint/accent-50` = rgba(184,255,0,0.5).
- Botones +/- (Caja, Horizontal): bg `color/surface2` = #3a3a3a, símbolo `tint/accent-50`, `radius/xs` = 4px.
- Progresion: bg `color/surface`, título `color/text`, subtítulo `color/mutedLight` = #818181.
- Pills "G1"/"Auto" (Ejercicio editor): bg `tint/accent-10`, texto `color/accent`, `radius/xs`.
- Subtítulo "3 x 12-14 . 60s" (Ejercicio editor): `color/mutedLight`.
- Input Fields "12.5" (Ejercicio blqoues, Ejercicios Bloques): bg `color/surface2`, texto `color/mutedLight`, `radius/sm`.
- Labels "reps"/"Kg"/"Reps"/"Kg" (headers y sufijos): `color/mutedLight`.
- Nombre "Ejercicio N" (todas las filas de ejercicio): `color/text`.
- Divider: línea `color/surface2`.
- Botón "Nuevo movimiento" — texto: `tint/accent-50`; borde: `tint/accent-50`; padding `space/sm`/`space/md`.

## Valores sueltos SIN vincular (revisar)
- Texto "15" (contador, variantes Caja y Horizontal, nodos `142:1103` y `160:1202`): color `text-white` (blanco puro hardcodeado) — debería vincularse a `color/text` (#e6e6e6) o confirmarse si el blanco puro es intencional (contraste con el resto que usa color/text).
- Botón "Nuevo movimiento" (variante Ejercicios Bloques, nodo `184:2442`): `rounded-[10px]` como valor literal en vez de `radius/md` (aunque el valor numérico coincide, 10px, no está vinculado a la variable).
- Borde del botón "Nuevo movimiento": `border-[0.5px]` — grosor de borde suelto, no hay variable de border-width en el sistema dado; solo mencionar si se define una en el futuro.

## Tamaño
- Caja: fixed 156px de ancho, alto hug.
- Horizontal, Resumen: fixed 269px de ancho, alto hug.
- Progresion, Ejercicio editor, Ejercicios Bloques, Ejercicio blqoues: fixed 259px de ancho, alto hug.
- Divider: fixed 252px de ancho x 4px de alto (contenedor), línea interna 1px.
- Input Fields "12.5": fixed 51x30px.
- Botones +/- : fixed 30x30px (size).

## Condicionales/ocultos
- El bloque de header "Series"/"Reps"+"Kg" con contador solo aparece en Caja, Horizontal, Ejercicios Bloques, Resumen (título) y divider (vacío/no aplica en divider).
- Los botones +/- (Icons "-"/"+") solo aparecen en Caja y Horizontal, no en Ejercicios Bloques (que en cambio muestra labels "Reps"/"Kg" sin contador).
- Las pills "G1"/"Auto" y el subtítulo "3 x 12-14 . 60s" solo aparecen en Ejercicio editor, no en Ejercicio blqoues ni Ejercicios Bloques.
- El drag handle (`Icons` variante "Arrastre") aparece en Ejercicios Bloques, Ejercicio blqoues y Ejercicio editor, no en Caja/Horizontal/Progresion/Resumen/divider.
- El botón "Nuevo movimiento" y la segunda fila de ejercicio ("Ejercicio 2" duplicado) solo aparecen en la variante Ejercicios Bloques (parecen ser contenido de ejemplo con 2 ejercicios dentro del bloque).
- La variante "Ejercicio blqoues" NO tiene color de fondo propio (a diferencia de Ejercicio editor y Ejercicios Bloques) — sugiere que se usa anidada dentro de un contenedor con su propio fondo.
