# Clients program view (`204:1747`)

## Qué muestra
Vista de detalle del programa asignado a un cliente específico (desde la perspectiva del coach): header con botón volver + nombre del cliente ("Juan"), botones "Importar" y "+", y una tarjeta grande (Banner) con info del programa, estadísticas, botón Editar, y un banner secundario anidado en azul con la "Próxima sesión del ciclo" y CTA "Preparar".

## Componentes reconocidos
- **App Header**: mismo patrón general (Logo, Fecha, Menu 2) pero reemplazado en la fila de abajo por un header de detalle específico (back button + nombre + acciones), no el header estándar de listado.
- Botón "volver" (icono flecha rotada 180°, mismo asset que el `Icons` "Arrow_Special" usado en otros lados pero rotado) + nombre del cliente en título grande — patrón de header de "vista de detalle" no visto en las otras pantallas revisadas.
- **Buttons**: "Importar" (muted, `h-[35px]` fijo); "+" (fondo acento, cuadrado `w-[35px]`, sin label de texto); "Editar" (muted, dentro del banner); "Preparar" (fondo azul `--color/blue`, con icono flecha, dentro del sub-banner) — primera vez que aparece la variante de color azul en todo lo revisado, todas las demás CTAs usan verde acento.
- **Banner** (`228:3933`): tarjeta principal con borde acento (`tint/accent-50`) y fondo surface, conteniendo: nombre de programa en acento ("Hipertrofia push"), línea "ETAPA 1/3 - SEMANA 2 DE 3", subtítulo libre ("sin ritmo aun - meta 2"), fila de estadísticas (07 SEMANA / 13 SESIONES, mismo patrón visual que en `clients-2.md`), menú "..." y botón "Editar" a la derecha.
- **Banner anidado** (`I228:3933;230:3987`, dentro del Banner principal): sub-tarjeta de color azul translúcido (`tint/blue-30`) con icono de círculos concéntricos, texto "Próxima sesión del ciclo" + "A - Nombre de sesión", y botón CTA "Preparar" en azul sólido — un banner dentro de otro banner, patrón de anidación no visto en ninguna otra pantalla.

## Patrones de layout sin componente propio
- **Banner compuesto de 2 niveles** (card exterior con borde acento + card interior de color distinto tipo "aviso/próxima acción"): patrón específico de esta pantalla — no es simplemente el mismo Banner de HomeView, sino una variante con contenido interno más rico (stats + sub-banner de acción).
- Fila de estadísticas inline reutilizada (mismo patrón que `clients-2.md`: número acento + label pequeño mutedlight, separados por gap) pero aquí con solo 2 valores (SEMANA/SESIONES) en vez de 3 (ETAPAS/SEMANAS/SESIONES).
- Header de "vista de detalle con volver" (back + título + acciones a la derecha) es un patrón de navegación que no aparece en HomeView ni en Clients — vale la pena confirmar si ya existe un componente de header de detalle en el código actual.

## Sizing en contexto (fill/hug/fixed)
- Header interno: 3 bloques — volver+nombre (`w-[112px]` fijo), spacer implícito, acciones (`w-[215px]` fijo) — no es fill/flex-1 sino anchos fijos calculados, algo distinto del resto de headers vistos (que usaban `justify-between` fluido).
- Banner principal: fill w-full, altura fija `h-[178px]`.
- Banner anidado (azul): fill w-full (dentro del padding del banner principal), con un `mr-[-82px]` negativo en el bloque de icono+texto — posible ajuste manual/hack de layout en Figma para que el texto no choque con el botón, a revisar si es necesario replicar o si en código conviene un layout más limpio (ej. texto con `flex-1` y botón con `shrink-0`).
- Botón "+": fixed `w-[35px]`, sin label (ícono solo).
- Botón "Preparar": hug con label de ancho fijo interno `w-[70px]`.

## Notas / cosas a confirmar
- Es la única pantalla revisada que introduce el **color azul** (`--color/blue, #4c85ff` y `--tint/blue-30`) como accent secundario — todo lo demás en las otras 8 pantallas usa exclusivamente el verde acento (`--color/accent, #aae216`) para CTAs y highlights. Confirmar si el azul está reservado semánticamente para "próxima sesión / acción temporal urgente" o si es una elección de diseño puntual a revisar.
- El `mr-[-82px]` negativo mencionado arriba es sospechoso de ser un ajuste manual en Figma (auto-layout con position offset manual) más que un valor de diseño intencional — recomendar no replicarlo literalmente en código y en su lugar usar un layout flex normal (icono+texto en `flex-1`, botón en `shrink-0`).
- El subtítulo libre "sin ritmo aun - meta 2" parece texto de nota/objetivo editable por el coach — confirmar si corresponde a un campo de notas ya existente en el modelo de programa del código actual.
- Esta pantalla combina el rol "vista de programa de un cliente específico" — sería el equivalente, del lado del coach, a lo que en HomeView ve el propio atleta sobre su programa. Comparar directamente con el banner de HomeView (`homeview.md`) y con banner-2 (`banner-2.md`) para decidir si conviene que compartan el mismo componente base de "Program banner" con distintas variantes (atleta vs. coach, con/sin próxima sesión, con/sin borde acento).
