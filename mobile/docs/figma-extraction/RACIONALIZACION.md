# Racionalización del diseño Figma "FormaFit" — para migración a la app

> Síntesis de los 36 documentos de extracción (`components/*.md`, `pages/*.md`) más los
> 6 componentes ya documentados en memoria de proyecto (Buttons, Sesion Card, Series,
> Input Field, Exercice Card, Pills). Objetivo: decidir qué es modular, qué se fusiona,
> qué queda independiente, y en qué orden migrar pantalla por pantalla.

## 1. Tokens — set completo (incluye descubrimientos nuevos)

Los siguientes tokens NO estaban en el catálogo original (extraído solo de Buttons/Sesion
Card el primer día) y aparecen repetidamente en los archivos nuevos — son reales, no ruido:

**Color** (nuevo vs ya conocido):
- `color/blue` `#4c85ff`, `tint/blue-30` `rgba(0,62,195,.3)`, `tint/blue-70` `rgba(89,142,255,.7)` — **NUEVO**
- `color/white` `#ffffff` — **NUEVO** (aparece en vez de `color/text` en varios sitios, probablemente por error)
- `color/green` `#66fa39` — **NUEVO**, usado para deltas positivos ("+13kg")
- Confirmado por el usuario: el patrón "color sólido oscuro + tint claro para texto" es intencional en TODAS las familias (accent, red, blue) — no es inconsistencia.

**Espaciado** (nuevo): `space/xs2` = 4, `space/xxl` = 28
**Radio** (nuevo): `radius/xxs` = 2, `radius/full` = 9999
**Tipografía** (nuevo): `text/hero` (Inter Black 20px) — usado en Progress cards y título de Banner

### Bug sistemático — prioridad #1 antes de portar nada
En **casi todos** los componentes que usan "Pills" (Sesion Card, Ejercicios progreso,
Estructura visualización datos ejercicios, History, Exercice...) el fondo/borde de la
pill SÍ está vinculado a variable, pero cada `<span>` de texto numérico dentro
(peso, reps, "@", "kg", "x") usa hex/rgba suelto que coincide en valor con un token real
pero no está enlazado. Se repite decenas de veces. **Recomendación: arreglarlo en el
componente base "Pills" de Figma antes de extraer nada más — cascada automática a todos
los usos**, en vez de corregirlo instancia por instancia en código.

### Bugs de vinculación cruzada (variable equivocada, no solo suelta)
- Modal settings: padding vertical → `radius/md` en vez de `space/md` (mismo valor, variable mala).
- Segmented control: gap del contenedor → `radius/sm` en vez de `space/sm`.
- Switch icon (Option blocks, Icons): `rounded-[11816.999px]` literal absurdo en vez de `radius/full`.
- Banner: botón "···" `rounded-[8px]` sin token (no está en la escala 4/6/10/18).

### Valores sin token candidato (dejar para decisión de diseño, no urgente)
`gap-16px`/`gap-77px` (Banner), `px-9px` (pills de Vinculación), `gap-35px` (App Header).

## 2. Racionalización de componentes — qué construir y cómo

### Primitivas nuevas reutilizables (construir UNA vez, usar en toda la app)
| Componente | Nota |
|---|---|
| **Buttons** | CTA/Secondary/Tertiary/Toggle/Segmented-item — un componente, prop `variant`. |
| **Pills** | Arreglar el bug de hex sueltos en Figma primero. Un componente, variantes solid/kg/reps/tag/info. |
| **Chips** | Aviso con borde izquierdo de color (accent/red/**blue**) — NO existe hoy en la app (hoy el target del coach es un ghost azul, concepto distinto). Nuevo. |
| **Segmented control** | Las 3 "variantes" son 1 componente con nº de items y modo 1-línea/2-líneas variable. |
| **Progress card** | Tarjeta valor+label+subtítulo. 100% limpia de tokens, la más fácil de portar. |
| **GroupedListRow** (patrón, sin nombre en Figma) | Ver §3 — merece componente propio por lo mucho que se repite. |

### NO son componentes nuevos — son restyle de algo que ya existe en la app
| Figma | Mapea a |
|---|---|
| Input Field (Done/Current/Empty/Sliding) | La celda de `SetRow` ya existente — no crear un componente aparte, es documentación visual de sus estados. |
| Option blocks (filas switch/pill) | Filas de `ExerciseEditorInline` — restyle in-place. |
| Exercice editor elements (Caja/Horizontal/Progresion/Resumen/divider) | Piezas ya presentes en `ExerciseEditorInline`/`SessionEditorScreen`/`ProgramEditorScreen` — restyle, no reconstrucción. |
| Modal entries/settings | Probablemente el sistema de bottom-sheet/DragSheet que ya existe — confirmar antes de crear uno nuevo. |
| Estructura visualización datos ejercicios | No es un componente — son 2 modos de layout (horizontal/vertical) de **Pills**. |
| Vinculación entre sesiones (Option blocks) | Ya existe como feature (`linkGroup`, confirmado en memoria) — solo hace falta el restyle visual del selector de pills. |

### Requieren split — mismo nombre en Figma, dos usos reales distintos
- **Sesion Card**: mezcla tarjeta-de-sesión-del-atleta, fila-de-historial, fila-de-cliente, y tarjeta-de-plantilla en un solo componente con 8 variantes. Al portar, tratarlas como 3-4 componentes reales distintos con estructura compartida mínima, no fuerces un solo componente con 8 variantes.
- **Ejercicios progreso**: "Ejercicio card"/"compacto"/"Semicompacto" (fila navegable en Progress) vs "Desglosado" (log de sesión en Exercice) son conceptualmente 2 cosas con forma similar, no 1.
- **Bars**: "Search" (input de búsqueda) y "Dropdown" (pill de filtro) están en el mismo componente Figma pero son 2 conceptos de UI distintos — separar.
- **SesionHeader**: separar en (a) header colapsable de Workout (scroll-driven, animación de 4 pasos, complejidad real de ingeniería) y (b) headers estáticos de "editar programa/sesión" (triviales, probablemente ya cubiertos por headers existentes de la app).

### Icons (28 variantes)
La mayoría son imágenes exportadas sin color editable — no hay que portar "el componente Icons", hay que cruzar cada uno contra los iconos SVG que la app YA tiene (AppHeader ya tiene su propio patrón de iconos) y solo crear los que falten. Los realmente vinculados a variables (Serie uncheck/current/done, Empty/Full notes, Switch, €, los 3 "round *") son los únicos donde el color debe venir de un token en vez de estar "horneado" en el asset.

## 3. Patrón "lista agrupada" — confirmado y localizado

Fondo por item + gap 2px + radio solo en el primer/último item. Aparece en:
**editor de movimientos AMRAP/EMOM, lista de ejercicios de Progress, log de sesiones de
Exercice, "Opciones básicas" de Exercice Editor, lista de ejercicios/bloques de Sesion
Editor.**

**NO aparece** en: Clients, Templates ("Clients" mal nombrado), History, Sesion Cards de
HomeView, lista de sesiones de Program Editor — esas usan tarjetas independientes con
radio completo y gap normal (6-10px).

Conclusión: es un patrón deliberado para **listas densas de datos/config**, no para
**listas de navegación a un objeto grande**. Merece un componente `GroupedListRow`
reutilizable, no repetir el cálculo de radios a mano 5 veces.

Patrón nuevo relacionado, solo visto una vez (Sesion Editor): **barra lateral de acento**
agrupando 2+ filas como "superset" — visualmente distinto (no fusiona fondos, solo un
borde izquierdo de 2px) pero mismo espíritu de "agrupar sin fusionar". Vale la pena un
wrapper reutilizable también, ya que el superset ya existe en el modelo de datos.

## 4. Resolución de nombres confusos (no perder tiempo con esto en implementación)

- **`235:4471` "Clients"** → en realidad es la pantalla de **Plantillas de programa**
  (mapea a `ProgramScreen.jsx`/`TemplateCard`), nombre de capa sin actualizar. Tratar
  como pantalla separada, no como variante de Clientes.
- **`235:4343` "Banner"** → borrador descartado (sin barra de progreso, con la decoración
  huérfana "Group 32"). **`233:4260` "Banner"** → versión final, coincide con HomeView.
  Usar solo la segunda como referencia.
- **`233:4271` "Group 32"** → resto decorativo del borrador descartado. Ignorar.
- **`260:2796` "Workout Screen with training block"** → duplicado exacto de `109:510`,
  sin ningún contenido de bloque real (ni AMRAP, ni EMOM, ni cronómetro). El diseño de
  "bloque integrado en Workout Screen" **no existe todavía** en Figma — no usar este
  nodo como referencia para eso.
- **`102:370`/`104:313`/`104:167`/`104:449` "WS mockup"** → no son 4 pantallas, son 4
  fotogramas de UNA animación de colapso del header por scroll: `104:313` (scroll=0,
  cuadrado full-bleed 64px) → `102:370` (redondeado 64px con margen) → `104:167`
  (redondeado 46px, contenido pasa de columna a fila) → `104:449` (redondeado 36px, el
  más comprimido). `104:690` "Workout Screen full header" es el mismo estado que
  `104:313` pero con el body y footer completos.

## 5. Preguntas de producto abiertas (requieren tu decisión, no solo visual)

1. **Carga/RPE/fatiga** (conecta con la conversación de ayer): confirmado que en NINGÚN
   mock hay tendencia agregada de RPE ni fatiga — solo una card "CARGA" (% de volumen) y
   una "1RM". El RPE se captura por serie (toggle en Exercice Editor) y se ve como color
   de pill, nunca agregado. La decisión sigue completamente abierta, el diseño no la
   resuelve ni la contradice.
2. El selector KG/REPS/VOL/1RM en Exercice implica un gráfico de tendencia que **no
   existe** en ningún mock — ¿entra en alcance o no?
3. Program Editor: fila suelta "Etapa 5" no encaja con el segmented control de 3 etapas
   — placeholder raro o error de mock, confirmar con diseño.
4. Bloques EMOM: el mock muestra "AMRAP" seleccionado en el control de Formato (debería
   ser EMOM) — probable copia-pega sin actualizar, no bloqueante.
5. **Azul como color semántico**: aparece consistentemente para "originado por el
   entrenador / próxima acción" (tag "Bloque" en Sesion Editor, sub-banner "próxima
   sesión", fila "Entrenador relacionado" en Modal, Chips Variant3) — nunca para UI
   genérica. Recomiendo adoptarlo formalmente como 3er color semántico (accent=positivo,
   red=alerta, blue=entrenador/siguiente-acción) en vez de tratarlo como suelto.
6. **Ningún mock de editor (Exercice Editor, Sesion Editor) muestra acciones de
   "sustituir"/"eliminar" ejercicio** — la app YA las tiene vía swipe (implementado esta
   sesión). Confirmar si Figma las omite a propósito (viven detrás del swipe, coincide
   con la app real) o si simplemente no se mockearon.
7. "Tipo de EMOM" (Repetir bloque / Rotar ejercicios) — confirmar si ya existe en el
   código o es alcance nuevo.
8. Nombres de etapa libres ("Volumen" en vez de "Etapa 3") — el modelo ya tiene
   `stage.name`, probablemente ya soportado, solo confirmar.
9. Dos cards "CARGA" idénticas en Progress (mock con datos duplicados) — probablemente
   deberían ser 2 métricas reales distintas (¿volumen total y frecuencia?) — confirmar.

## 6. Orden de migración recomendado

**Antes de tocar código**: arreglar el bug sistemático de Pills en el propio Figma
(cascada automática), y resolver las preguntas del §5 que bloquean decisiones de diseño
(sobre todo la 5 y la 6, que afectan a qué se construye).

1. **Tokens** → `mobile/src/themes.js`, incluye las familias nuevas (blue/green/white,
   xxs/full, xxl/xs2, hero).
2. **Primitivas nuevas** (§2, tabla 1): Buttons, Pills, Chips, Segmented control,
   ProgressCard, GroupedListRow.
3. **Restyle por pantalla**, de menor a mayor riesgo:
   HomeView → History → Progress/Exercice (comparten ProgressCard + lista agrupada) →
   Clients/Templates (listas independientes) → Program Editor → Sesion Editor/Exercice
   Editor (lista agrupada + filas de opciones) → Editores AMRAP/EMOM → **Workout
   Screen al final** (el header colapsable por scroll es la pieza de mayor complejidad
   de ingeniería de todo el set, y `ExerciseCard` es donde vive toda la lógica de
   dropset/superserie/calentamiento que hay que preservar con más cuidado).
