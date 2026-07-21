# Option blocks (`176:1951`)

## Variantes
- Opciones basicas: lista de filas de settings tipo switch para un ejercicio normal (Unilateral, Registrar RPE, Dropset en la última serie, En superserie con siguiente, Tempo con chevron, Nota con textarea).
- opciones bloque acondicionamiento: opciones específicas de un bloque de acondicionamiento (Nombre con input tipo texto, campo de nota "nota para el atleta...").
- Opcion individual: fila única con switch "Cada intervalo un ejercicio" + subtítulo "Explicación".
- Vinculacion: panel de vinculación entre sesiones (selector "Ninguna" / "Grupo 1. A, D" / "+ Nuevo grupo" + texto explicativo).

## Variables vinculadas
- Contenedor raíz (todas): `radius/md` = 10px, ancho fijo 311px; padding/gap varía por variante (`space/xs`, `space/sm`, `space/md`, `space/lg`).
- Filas de switch (Opciones basicas, Opcion individual): bg `color/surface` = #2a2a2a, texto `color/text` = #e6e6e6, `radius/xxs` = 2px, switch activo `color/accent` = #aae216.
- opciones bloque acondicionamiento: bg `color/surface`, labels `color/text`, inputs/textarea bg `color/workout-card` = #141414, placeholder `color/mutedLight` = #818181, `radius/sm` = 6px.
- Vinculacion — título "Vinculacion entre sesiones": `color/text`.
- Vinculacion — pill "Ninguna": bg `color/surface2` = #3a3a3a, texto `color/text`, `radius/xs` = 4px.
- Vinculacion — pill "Grupo 1. A, D" (seleccionado): bg `color/accent`, texto `color/onAccent` = #000000, `radius/xs`.
- Vinculacion — pill "+ Nuevo grupo": bg `color/surface2`, texto `color/mutedLight`, `radius/xs`.
- Vinculacion — texto explicativo final: `color/mutedLight`.
- Fila "Nota" (Opciones basicas): esquinas redondeadas mixtas — inferior `radius/md`, superior `radius/xxs` (para fundirse con el resto de la lista).

## Valores sueltos SIN vincular (revisar)
- Icono "Switch" (círculo verde del toggle, usado en todas las filas de switch): `rounded-[11816.999px]` como valor literal absurdo — debería ser `radius/full` (9999px). Presente en todas las variantes que usan switches (Opciones basicas x4, Opcion individual x1).
- Padding horizontal de las 3 pills en Vinculacion ("Ninguna", "Grupo 1. A, D", "+ Nuevo grupo"): `px-[9px]` como valor literal, no coincide con ningún token de `space/*` (2/6/8/10/15/20) — revisar si debería ser `space/sm2` (8px) o `space/md` (10px).

## Tamaño
- Todas las variantes: fixed 311px de ancho, alto hug (crece según cantidad de filas).
- Fila "Tempo": fixed 26px de alto.
- opciones bloque acondicionamiento — textarea "nota para el atleta...": fixed 54px de alto.
- Nota (Opciones basicas) — textarea: fixed 42px de alto.

## Condicionales/ocultos
- Las filas Unilateral, Registrar RPE, Dropset, Superserie, Tempo y Nota solo aparecen en "Opciones basicas".
- El switch (icono "Switch") solo aparece en Opciones basicas y Opcion individual; no aparece en "opciones bloque acondicionamiento" ni en "Vinculacion" (que usan selección de pills en su lugar).
- El bloque "Nombre" + input de texto solo aparece en "opciones bloque acondicionamiento".
- El selector de pills ("Ninguna"/"Grupo 1..."/"+ Nuevo grupo") y el texto explicativo largo solo aparecen en "Vinculacion".
- El label "Explicación" bajo el switch solo aparece en "Opcion individual".
