# Progress (`122:789`)

## Qué muestra
Pantalla de progreso general. Header + selector de rango temporal + 3 tarjetas de métricas destacadas (1RM y CARGA) + botón de filtro "Programa actual" + buscador + lista desplegable de ejercicios con su progreso individual.

## Componentes reconocidos
- **App Header**: igual que en History (Logo, Fecha, Icons "Menu 2").
- **Segmented control**: rango temporal con 4 opciones "7D" / "1M" / "3M" / "Todo", "7D" activo (fondo accent).
- **Buttons**: botón "Programa actual" (fondo accent, texto negro) a la derecha del segmented control — filtro para acotar el progreso al programa activo.
- **PregressCard** (sic, typo en el nombre del componente en Figma): tarjeta de métrica destacada, dos variantes:
  - `Default` ("CARGA"): número grande "+31%" (accent), label "CARGA" (uppercase, tracking amplio), subtítulo "+2.5% ult.ses." (tinte accent 50%).
  - `Variant2` ("1RM"): número grande "74 - Kg", label "1RM", subtítulo "68Kg PR" (personal record).
  - Se muestran 3 en fila (`flex-[1_0_0]` cada una, fill equitativo): 1RM, CARGA, CARGA (datos duplicados en el mock, probablemente serían métricas de distintos ejercicios/lifts en la app real).
- **Bars** (search bar): input tipo "Search bar..." con fondo `surface2`, placeholder en `mutedlight`.
- **"Buscar Ejercicios" bar**: variante de Bars con fondo accent, texto negro uppercase, y un ícono chevron a la derecha (rotado 90°) — funciona como header/toggle de una sección desplegable, no como buscador en sí.
- **Icons**: chevron pequeño (10x10) usado tanto en la barra "Buscar Ejercicios" como en cada fila de "Ejercicios progreso" (para navegar al detalle del ejercicio).
- **"Ejercicios progreso"** (nodo repetido, sin nombre de componente formal en la librería pero muy consistente): fila con nombre del ejercicio/bloque en bold + subtítulo "27 sesiones - +133% progreso" (el "+133%" en accent) + chevron a la derecha.

## Patrones de layout sin componente propio
- **Aquí SÍ aparece el patrón de "lista agrupada" pedido por el usuario.** El bloque "Ejercicios progreso" (nodos `122:915`, `122:921`, `122:928`, `122:935`, `122:942`) tiene:
  - Fondo `surface` en cada item.
  - Gap mínimo entre items: `--space/xs` (2px), vía contenedor padre con `gap-[var(--space/xs,2px)]`.
  - Radio de esquina solo en el primer y último item: el primero (`122:915`) tiene `rounded-tl-md rounded-tr-md` (10px arriba) + `rounded-bl-xs rounded-br-xs` (4px abajo, casi recto); los items intermedios (`122:921`, `122:928`, `122:935`) tienen radio uniforme mínimo `--radius/xxs` (2px, casi cuadrado); el último (`122:942`) tiene `rounded-bl-md rounded-br-md` (10px abajo) + `rounded-tl-xxs rounded-tr-xs` (2-4px arriba, casi recto). Esto confirma el patrón "grupo con fondo por item + esquinas redondeadas solo en extremos" que se pidió identificar — aquí implementado con radios asimétricos por item en vez de un contenedor único con overflow-clip.
- El bloque de 3 PregressCard en fila es un patrón de "hero stats row" (3 tarjetas iguales, fill equitativo, mismo alto) que no tiene nombre propio de componente más allá de la card individual.

## Sizing en contexto (fill/hug/fixed)
- Segmented control temporal: ancho fijo `w-[198px]` (a diferencia del de History que es `w-full`) — aquí convive con el botón "Programa actual" en la misma fila (`justify-between`), por eso no ocupa todo el ancho.
- Botón "Programa actual": hug de contenido.
- Fila de 3 PregressCard: contenedor `w-full`, cada card `flex-[1_0_0] min-w-px` — fill equitativo entre las 3, alto fijo del contenedor `h-[108px]` pero cada card internamente hace hug de su contenido centrado.
- Search bar y "Buscar Ejercicios" bar: `w-full`.
- Cada fila "Ejercicios progreso": `w-full`, alto hug (texto de 2 líneas + padding).

## Notas / cosas a confirmar
- **Sobre carga/RPE/fatiga (lo que se pidió investigar en detalle):** No hay ningún indicador explícito de RPE, fatiga, ni "tendencia semanal" en este mockup. Lo más cercano es la card **"CARGA"**, que muestra un porcentaje de cambio (**"+31%"**) y un delta respecto a la última sesión (**"+2.5% ult.ses."**) — esto parece ser **volumen/tonelaje de carga** (peso x reps acumulado), no un score de esfuerzo percibido ni fatiga. No hay gráfico de tendencia (line chart, sparkline) visible en este nodo, ni mención de "RPE" en ningún texto o nombre de capa.
- La card "1RM" muestra un PR (personal record) explícito ("68Kg PR") — dato de fuerza máxima estimada, relacionado pero distinto de carga acumulada.
- El texto "+133% progreso" en las filas de ejercicio es sospechosamente idéntico en las 5 filas (mismo valor "27 sesiones - +133% progreso" repetido) — es un placeholder de mockup, no tomar el valor literal como diseño intencional, pero sí el formato ("N sesiones - X% progreso").
- El nombre "PregressCard" (con typo, falta la "o" de Progress) es literal del archivo Figma — si se genera código real desde Code Connect, corregir el nombre.
- No quedó claro si "Ejercicios progreso" lista ejercicios individuales o también bloques/sesiones — el primer y último item dicen "Hipertrofia - Pull" (nombre de sesión, igual que en History) mientras los 3 del medio son ejercicios sueltos ("Hip thrust", "Curl de biceps con barra", "Crunch"). Podría ser una lista mixta (sesiones + ejercicios) o un error de datos de mockup — confirmar con el diseñador/PM.
- Vale la pena decidir si el patrón de "carga" (volumen acumulado con % de cambio) es suficiente para la decisión de producto pendiente sobre RPE/fatiga, o si eso todavía no está diseñado y habría que proponerlo desde cero.
