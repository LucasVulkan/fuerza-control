# Banner (`233:4260`)

## Qué muestra
Banner/tarjeta de programa activo — versión con pill "ETAPA 1/3", título "Nombre Programa" centrado, barra de progreso "Volumen" con "Semana 2 de 3" / "66%", y bloque de semana ("SEMANA 07" + pill "21 Sesiones") separado por una línea vertical recta. Es prácticamente idéntico al banner ya poblado con datos reales dentro de `homeview.md` (mismo layout, misma barra de progreso, mismo separador recto).

## Componentes reconocidos
- Pill "ETAPA 1/3" (fondo transparente/leve, texto pequeño semibold) — no existía en banner-1.
- Pill "21 Sesiones" con borde negro — igual a banner-1 y a HomeView.
- Barra de progreso "Volumen": estructura de 2 barras superpuestas (barra base `#81a71e` al 94% + barra activa negra al 56%) más 2 marcadores pequeños verdes (hitos), con labels "Semana 2 de 3" y "66%" debajo — este es un mini-componente de progreso propio del banner, no until de la librería genérica.
- Separador vertical recto entre bloque principal y bloque semana (línea negra fina, no diagonal).

## Patrones de layout sin componente propio
- Igual que banner-1: card con posicionamiento absoluto por coordenadas (no auto-layout), 2 columnas separadas por línea vertical.
- La "barra de progreso con hitos" (2 marcadores verdes superpuestos sobre la barra) es un patrón visual específico que no corresponde a ningún componente "Progress bar" genérico visto en la librería — vale la pena confirmar si existe un componente de progress bar reusable en la sección "Components" del archivo, o si hay que crearlo.

## Sizing en contexto (fill/hug/fixed)
- Igual que banner-1: `size-full` en el contenedor raíz, contenido interno con posiciones absolutas fijas (no fill/hug real).
- Pill "ETAPA 1/3": ancho fijo `w-[129px]`.
- Barra de progreso: ancho relativo en `%` dentro de un contenedor `w-[207px]` fijo (no fill del banner completo).

## Notas / cosas a confirmar
- Comparado con **banner-1** (`235:4343`): ver el análisis completo en `banner-1.md`. En resumen, banner-2 agrega la barra de progreso "Volumen", cambia "ETAPA 1 - SEMANA 2 DE 3" (texto plano) por una pill dedicada "ETAPA 1/3", cambia el separador de diagonal a vertical recto, y elimina la decoración "Group 32". Todo apunta a que **banner-2 es la iteración más reciente/final**, coincidiendo casi 1:1 con el banner real usado en `homeview.md`.
- El título del programa aquí es genérico ("Nombre Programa") mientras que en HomeView aparece como "Programa hipertrofia" — confirma que banner-2 es la plantilla/componente base y el de HomeView es la instancia con datos reales.
- Confirmar con el código actual si ya existe un cálculo de "Volumen %" y "marcadores de hito" en la barra de progreso semanal, o si esto es una feature visual nueva a implementar.
