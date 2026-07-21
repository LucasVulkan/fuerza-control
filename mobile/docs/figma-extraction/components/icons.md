# Icons (`98:138`)

Nota: el frame se documentó como "25 variantes" en el encargo, pero `get_metadata` devolvió **28 símbolos** — hay 3 extra no listadas originalmente: `round undone`, `Round current`, `Round done` (usadas para indicar el estado de una ronda/round, similar a "Serie uncheck/current/done" pero con badge numérico "1"). Se documentan las 28.

Todas las variantes tienen frame **26x26** confirmado por `get_metadata` (fixed).

Una sola llamada a `get_design_context` sobre el nodeId del frame trajo el código de 26 de las 28 variantes. Las 2 restantes (`Variant21`, `Variant22`) devolvieron un `<div>` vacío sin contenido (probablemente vectores "flatten"/boolean sin fill expuesto en el código) — se identifican solo por captura de pantalla: `Variant21` = ícono de refresh/loop (dos flechas curvas formando un círculo), `Variant22` = ícono de lápiz/editar.

## Variantes
- Arrow: flecha "→" (texto, no vector)
- Check: check de confirmación (imagen exportada)
- Conectado: punto/dot de estado conectado (imagen)
- Desconectado: punto/dot de estado desconectado (imagen)
- Serie uncheck: badge de serie sin marcar (fondo + icono check muted)
- Serie Current Uncheck: badge de serie actual sin marcar (fondo/borde acento + icono check)
- Serie done: badge de serie completada (fondo acento + icono check)
- Empty notes: notas vacías (3 círculos con borde, sin relleno)
- Full notes: notas completas (3 círculos rellenos)
- Arrow_Special: chevron ">" (imagen), usado como affordance de navegación (reutilizado en tarjeta "Ejercicio card")
- Menu: ícono de lista/hamburguesa (imagen)
- Delete: ícono de eliminar / X (imagen, forma "Union")
- Plus: glifo "+"
- Minus: glifo "-"
- More...: 3 puntos horizontales (menú contextual)
- Switch: toggle on/off (track + knob)
- €: símbolo de euro (texto)
- Cloud: ícono de nube (con badge/dot pequeño superpuesto)
- filtros: 3 líneas horizontales tipo slider/filtro
- Arrastre: grid de 6 puntos (drag handle)
- Variant21: refresh/loop (confirmado solo por captura, sin datos de código)
- Variant22: lápiz/editar (confirmado solo por captura, sin datos de código)
- target: 3 círculos concéntricos (ícono de objetivo)
- Menu 2: 3 barras horizontales apiladas rotadas 180° (tipo "layers")
- Progreso: 3 barras tipo gráfico de barras, rotadas -90°/escala -100%
- round undone: círculo outline + número "1" en gris (ronda no jugada)
- Round current: círculo con anillo + número "1" en verde acento (ronda actual)
- Round done: círculo relleno + número "1" en negro sobre acento (ronda completada)

## Variables vinculadas
- Serie uncheck: fondo = `color/surface2` (#3a3a3a); radio = `radius/sm` (6)
- Serie Current Uncheck: fondo = `tint/accent-10` (rgba(184,255,0,0.1)); borde = `tint/accent-50` (rgba(184,255,0,0.5)); radio = `radius/sm` (6)
- Serie done: fondo = `color/accent` (#aae216); radio = `radius/sm` (6)
- Empty notes (3 círculos): borde = `tint/accent-50` (rgba(184,255,0,0.5))
- Full notes (3 círculos): fondo = `color/onAccent` (#000000)
- Switch (track): fondo = `color/accent` (#aae216)
- € (texto): color = `color/text` (#e6e6e6) — única variante con tipografía+color 100% vinculados
- round undone (texto "1"): color = `color/mutedLight` (#818181)
- Round current (texto "1"): color = `color/accent` (#aae216)
- Round done (texto "1"): color = `color/onAccent` (#000000, vía `color/onaccent` en el código, mismo token)
- round undone / Round current / Round done (texto "1"): tipografía = `text/tag` (Inter Medium 10px)

## Valores sueltos SIN vincular (revisar)
- Arrow (texto "→"): color `rgba(255,255,255,0.88)` — debería vincularse a `color/text` (#e6e6e6), el más cercano; fuente Inter Black 20px con tracking `0.8px` también hardcodeado, sin `text/*` asociado.
- Plus (glifo "+"): color `text-white` (blanco puro, literal, no token) — debería vincularse a `color/text` (#e6e6e6). Tracking `0.96px` y tamaño `24px` hardcodeados.
- Minus (glifo "-"): mismo problema que Plus — color blanco literal sin vincular a `color/text`.
- Empty notes / Full notes (3 círculos internos): `rounded-[2.476px]` — valor de radio raro y suelto, no coincide con la escala `radius/xs-lg`; posiblemente arrastrado de un componente escalado, revisar si debería ser proporcional o fijo a variable.
- Switch (track): `rounded-[11816.999px]` — valor extremo tipo "full round" (equivalente visual a pill), no vinculado a variable pero es el patrón esperado para cápsulas totalmente redondeadas; bajo riesgo, no es una escala real de radios.
- round undone / Round current / Round done (anillos gráficos): son imágenes exportadas (`imgEllipse44/45/46`), no se puede verificar si el stroke del anillo está vinculado a variable — conceptualmente debería seguir el mismo patrón que el texto (`color/mutedLight`, `color/accent`, `color/accent` respectivamente) pero al ser asset rasterizado no es verificable por código.

## Tamaño
- Todas las variantes: frame fixed **26x26** (confirmado en `get_metadata`).
- Switch (track): fixed 26x14.182; knob fixed 11.818x11.818.
- Arrow_Special: interior fixed 12x20 dentro del frame 26x26.
- Menu: interior hug 22.66x18.071.
- Delete: interior fixed 17.803x18.
- target: anillos concéntricos fixed 12/20/26 px.
- Menu 2 / Progreso: barras con anchos/alturas escalonados fijos (16/20/24 y 14.72/19.32/23 px respectivamente) — geometría interna del ícono, no tokens de espaciado.

## Condicionales/ocultos
- Cada variante es mutuamente excluyente vía la prop `property1` (patrón estándar de icon set): solo se renderiza el contenido de la variante activa.
- La mayoría de los íconos son **imágenes exportadas** (SVG/PNG rasterizado vía URL de asset), no vectores con color vinculado a variables — el color queda "horneado" dentro del asset y no es editable vía token. Las únicas variantes con color realmente vinculado vía CSS variable son: Serie uncheck/Current/done (fondo), Empty/Full notes (borde/relleno de los 3 puntitos), Switch (track), €, y los 3 "round *" (texto del badge).
- `Variant21` y `Variant22` no devolvieron ningún nodo hijo en `get_design_context` (ni siquiera imagen) — posible limitación de la herramienta con vectores flatten. Confirmado visualmente por captura que sí tienen contenido en Figma.
