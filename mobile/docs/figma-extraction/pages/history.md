# History (`118:744`)

## Qué muestra
Pantalla de historial de sesiones. Header de app + segmented control para filtrar ("Programa activo" / "Todos") + lista vertical de tarjetas de sesión, algunas colapsadas (solo resumen) y una expandida mostrando el detalle de series por ejercicio.

## Componentes reconocidos
- **App Header**: fila superior con Logo ("Forma FIT"), Fecha ("19:53 - Sab 30, May") centrada, e Icons (variante "Menu 2", hamburguesa) a la derecha.
- **Segmented control**: dos "Buttons" dentro de un contenedor `surface2`, uno activo (fondo `--color/accent`, texto negro) y uno inactivo (texto `mutedlight`). Labels "Programa activo" / "Todos".
- **Sesion Card** (variante `property1="Sesion historial"`): tarjeta reutilizada 4 veces. Contiene: tag superior "SESIÓN A/B/C" (accent, extrabold, tracking amplio, uppercase), título del bloque (ej. "Empujes", "Hipertrofia - Pull"), subtítulo con fecha + etapa + nº ejercicios ("Dom, 14 jun - Etapa 1 - 5 ejercicios"), e Icons (variante "Delete", una X) a la derecha para borrar.
- **Icons**: dos variantes vistas — "Delete" (X, en cada Sesion Card) y "Menu 2" (hamburguesa, en el header).
- **Pills** (dentro de "Estructura visualización datos ejercicios"): pill de peso ("12.5Kg x") sin fondo y pills de rep@RPE con fondo — tinte rojo (`--tint/red-30`) cuando el valor es "cercano al fallo"/alto esfuerzo, tinte verde/accent (`--tint/accent-10`) para series normales. Se agrupan en filas por serie.
- **Estructura visualización datos ejercicios**: fila de pills que resume las series de un ejercicio (peso + rep@RPE repetido por serie), usada dentro de la Sesion Card expandida.

## Patrones de layout sin componente propio
- **NO aparece el patrón de "lista agrupada"** (fondo compartido, gap mínimo, radio solo en primer/último item) que se pidió buscar. Las 4 Sesion Card están separadas con gap uniforme de 10px (`--space/md`) y cada una tiene radio completo en las 4 esquinas — son tarjetas independientes, no una lista agrupada.
- Dentro de la Sesion Card expandida, cada ejercicio se presenta como: nombre del ejercicio (bold, tracking amplio) + fila de Pills de sets, apilados verticalmente con gap `--space/xs` (2px) entre nombre y pills, y `--space/md` (10px) entre ejercicios distintos. Este bloque "nombre ejercicio + pills de sets" no tiene nombre de componente propio en el código pero se repite igual para "Puente de Gluteo" y "Dominadas".

## Sizing en contexto (fill/hug/fixed)
- Contenedor raíz: `size-full`, columna con padding lateral 15px (`--space/lg`) y gap 10px entre hijos — fill del viewport.
- App Header: `w-full`, `justify-between` — Logo y Icons hug, Fecha centrada con ancho fijo 108px.
- Segmented control: `w-full`, cada botón interno `flex-[1_0_0]` (fill del espacio disponible, 50/50).
- Sesion Card: `w-full` (fill horizontal), altura hug según contenido (una card colapsada mide ~51px de bloque de texto, la expandida crece con el contenido de ejercicios).
- Pills: hug de contenido (padding fijo + texto), no fill.

## Notas / cosas a confirmar
- El nombre de nodo del componente es "Sesion Card" con variante "Sesion historial" — sugiere que existe otra variante de Sesion Card para otros contextos (ej. dashboard/hoy), útil comparar con el código actual.
- El color rojo en las pills de rep@RPE parece indicar series "al fallo" o de alta dificultad (posible antecedente de un futuro indicador de RPE/esfuerzo) — vale la pena comparar con lo encontrado en Progress.
- El ícono de "Delete" (X) está en cada card de historial — implica que el historial permite borrar sesiones individuales directamente desde la lista, algo no estándar en apps de fitness (normalmente el historial es de solo lectura).
- El segmented control "Programa activo / Todos" sugiere que el historial se puede filtrar por si la sesión pertenece al programa activo o no — confirmar si esto ya existe en la app actual.
- Solo una de las 4 Sesion Card está expandida con detalle; no está claro en el mockup si el expand/collapse es interactivo (tap) o si son dos variantes de card distintas (colapsada vs expandida) coexistiendo como ejemplo visual.
