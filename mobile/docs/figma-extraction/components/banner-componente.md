# Banner — componente (`228:3912`)

Nota: este es el componente "Banner" (no la variante de página/Pages homónima). Tiene 2 variantes con estructura distinta, aunque ambas comparten la "barra azul de sesión" interna.

## Variantes
- **Programa de cliente** (`228:3911`): tarjeta completa de programa activo — título del programa, etapa/semana/meta, contador semana/sesiones, botón "Editar" y botón de opciones (···), más la barra azul de "próxima sesión" embebida abajo. Vista para el cliente/atleta.
- **Banner de entrenador** (`228:3913`): solo la barra azul de notificación ("1 cliente con cambios sin enviar" + botón "Enviar todo"), sin la tarjeta de programa. Vista resumida para el entrenador.

## Variables vinculadas
- Contenedor tarjeta (Programa de cliente): `color/surface`=`#2a2a2a` (fondo), `radius/lg`=18, `space/lg`=15 (padding x), `space/md`=10 (padding y).
- Título "Hipertrofia push": `color/accent`=`#aae216`, estilo `text/hero` (Black 20px).
- "ETAPA 1 - SEMANA 2 DE 3": `color/text`=`#e6e6e6`, estilo `text/spacing tag` (Extra Bold 10px, tracking 20%).
- "sin ritmo aun - meta 2": `color/mutedLight`=`#818181`, estilo `text/tag`.
- Contador semana/sesiones: números en `color/accent`, labels en `color/mutedLight`, gap `space/xs`=2, estilo `text/SmallBold` (Semi Bold 8px) para labels.
- Botón "···" (opciones): fondo `color/muted`=`#4d4d4d`.
- Botón "Editar": fondo `color/muted`, `radius/md`=10, `space/md` (padding), `space/sm`=6 (gap), texto `color/text`.
- Barra azul interna (ambas variantes): fondo `tint/blue-30`=`rgba(0,62,195,0.3)`, `radius/lg`=18, `space/lg` (padding x), `space/md` (padding y). **Nota**: `tint/blue-30` no está en el set de tints documentado para el proyecto (accent-50/accent-10/red-50/red-30) — es una variable real y distinta, de una paleta azul aparte; confirmar si es un token válido del sistema o un remanente a unificar.
- Texto "Proxima sesión del ciclo" (label, variante cliente): `color/blue`=`#4c85ff` — igual que `tint/blue-30`, variable real pero fuera del set de colores documentado (`color/accent`, `muted`, `mutedLight`, `text`, `surface`, `surface2`, `workout-card`, `red`). Confirmar si `color/blue` es un token oficial del sistema.
- Texto "A - NOMBRE DE SESIÓN": `color/white`=`#ffffff` (variable, también fuera del set documentado — revisar si debería ser `color/text` en su lugar).
- Botón "Preparar"/"Enviar todo": fondo `color/blue`, `radius/md`, texto `color/onAccent`=`#000000`.
- Ícono de notificación (círculos concéntricos, ambas variantes): asset embebido, tamaño 26×26 — relleno no inspeccionable desde el código.

## Valores sueltos SIN vincular (revisar)
- Contenedor tarjeta (Programa de cliente): `w-[373px] h-[178px]` fijos (esperable en tarjeta, no crítico) y **gap `16px`** entre el bloque de texto y el bloque de botones (`230:4002`) — `16` no existe en la escala `space/xs-xl` (2/6/8/10/15/20). Sin vincular.
- Mismo problema en el stack vertical de botones (`228:3908`, íconos "···" + "Editar"): gap `16px` — sin vincular, mismo valor repetido.
- Header row (`230:4002`, título+contador vs. columna de botones): `gap-[77px]` — valor arbitrario, no coincide con ninguna variable de `space/*`. Sin vincular.
- Botón "···" (opciones, `228:3864`): `rounded-[8px]` — 8px no está en la escala de `radius/*` (4/6/10/18). Debería vincularse a `radius/sm` (6) o `radius/md` (10) según el diseño intencionado; actualmente es un valor suelto que no coincide con ningún token.
- Botón "···": tamaño `w-[28px] h-[27px]` fijo, literal (esperable en ícono, no crítico).
- Botón "Preparar" (variante cliente): padding asimétrico `px-space/sm (6) py-space/md (10)` — ambos vinculados pero mezclando dos tokens distintos en un mismo padding; comparar con "Enviar todo" (variante entrenador) que usa `p-space/sm` uniforme (6 en las 4 direcciones). Inconsistencia de diseño entre variantes, no es un valor sin vincular pero vale la pena homogeneizar.
- Márgenes negativos `mr-[-82px]` (cliente) y `mr-[-67px]` (entrenador) en el bloque de texto de la barra azul — ajustes de layout puntuales (hack de overflow/posicionamiento), no son tokens de diseño.

## Tamaño
- Programa de cliente (`228:3911`): fixed 373×178.
- Banner de entrenador (`228:3913`): fixed ancho 358px (contenedor externo); la barra azul interna es fill (`flex-1`) dentro de ese ancho, alto hug (~46px resultante).
- Barra azul interna en variante Programa de cliente: ancho fill (100% del padre, `w-full shrink-0`), alto hug.
- Botón "···": fixed 28×27.
- Botón "Editar": hug (padding + texto, sin dimensión fija).
- Botón "Preparar" (cliente): fixed ancho 70px, alto hug.
- Botón "Enviar todo" (entrenador): hug (sin ancho fijo).

## Condicionales/ocultos
- El bloque superior completo de la tarjeta (título, etapa/semana, contador, botones "···"/"Editar") solo existe en la variante **Programa de cliente**; **Banner de entrenador** muestra únicamente la barra azul de notificación.
- Dentro de la barra azul: el texto es "Proxima sesión del ciclo" + "A - Nombre de sesión" (extrabold, mayúsculas) en la variante cliente, vs. "1 cliente con cambios sin enviar" + "Proxima sesión del ciclo" (medium, sin mayúsculas forzadas) en la variante entrenador — mismo layout, contenido y jerarquía tipográfica invertidos entre variantes.
- El botón de la barra azul cambia de texto/tamaño de fuente: "Preparar" (12px, extrabold, ancho fijo 70px) en cliente vs. "Enviar todo" (10px, medium, ancho hug) en entrenador.
