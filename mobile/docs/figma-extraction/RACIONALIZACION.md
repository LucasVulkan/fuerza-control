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

## 5. Preguntas de producto — RESUELTAS por el usuario (jul 2026)

1. **Carga/RPE/fatiga**: sigue sin resolverse en el diseño — el usuario confirma que las
   cards de Progress son EXACTAMENTE las que ya existen hoy en la app (carga y volumen,
   ver punto 9 más abajo), sin nada nuevo salvo restyle de color. La decisión de
   producto sobre RPE/fatiga agregados sigue totalmente abierta e independiente de este
   rediseño.
2. **Resuelto**: el gráfico de Exercice/Progress es el mismo que ya existe en el código
   hoy, solo con colores actualizados — no hay que diseñarlo ni construirlo de cero, es
   restyle puro. El selector KG/REPS/VOL/1RM ya debe estar resuelto en el código actual.
3. **Resuelto**: la fila "Etapa 5" NO es una fila suelta ni un error — es el mismo
   elemento de "editar etapa" que ya existe hoy, con nombre placeholder. No hay
   inconsistencia real, era una lectura equivocada del mock.
4. **Resuelto**: confirmado error de copiar/pegar (el Formato debería mostrar EMOM
   seleccionado, no AMRAP). No bloqueante, no representa ninguna decisión de diseño.
5. **Resuelto**: el azul (y sus tints) es SIEMPRE "relacionado con el entrenador" — sin
   excepciones. Adoptarlo formalmente como 3er color semántico: accent=positivo/propio,
   red=alerta, blue=entrenador/externo.
6. **Resuelto, con funcionalidad nueva** — ver §5-bis.
7. **Resuelto**: "Tipo de EMOM" ya existe en código y UI, pero HOY vive como toggle
   dentro de un setting; en el rediseño pasa a ser una opción principal arriba (más
   visible, mismo dato subyacente). Es un cambio de jerarquía de información, no de
   modelo de datos.
8. **Resuelto**: nombres de etapa funcionan igual que hoy — al crear usa "Etapa N" por
   defecto, editable como ya se puede hacer. Sin cambios de modelo.
9. **Resuelto**: las dos cards "CARGA" duplicadas en el mock son placeholder — en
   realidad representan **Carga** y **Volumen**, las dos métricas que la app ya muestra
   hoy en Progress. Sin funcionalidad nueva ahí, solo restyle.

## 5-bis. Aclaraciones adicionales del usuario (importantes para no perder al implementar)

- **Pills — los "hex sueltos" son en realidad 2 colores intencionales, no un bug**: el
  usuario usa sistemáticamente `color/accent` para el número (kg/reps) y `color/text`
  para la unidad/símbolo ("Kg", "x", "@") dentro de la misma pill — de ahí la aparente
  inconsistencia que detectaron los subagentes. La intención de 2 colores por pill es
  CORRECTA y debe respetarse en el código; lo único a vigilar en la implementación RN es
  vincular cada uno a su token (`th.colors.accent` / `th.colors.text`) en vez de
  hardcodear, independientemente de si el Figma origen los tiene bien vinculados o no.
- **Segmented control — solo 2 de las 3 variantes se usan**: "Group together" (1 línea)
  se usa para cualquier selección entre múltiples opciones genérica. "Individual
  buttons" (la variante 2) **NO se usa en ningún sitio** — descartarla, no portarla.
  "Etapas" (2 líneas) se usa EXCLUSIVAMENTE para seleccionar etapa de programa, donde la
  segunda línea siempre muestra el nº de semanas de esa etapa — no es un modo genérico
  de "2 líneas", es específico de etapas.
- **Historial y Progress — calendario y gráfica se mantienen tal cual**: ambos elementos
  ya existen en el código actual y NO están en el mock de Figma (se omitieron a
  propósito) — no tocarlos salvo actualización de color. No interpretar su ausencia en
  Figma como "hay que quitarlos".
- **Buttons — una variante puede mapear a más de una acción real**: por ejemplo "Toggle
  text ON" se usa tanto para conexiones (Conectado/Conectar) como para "omitir
  sesión/bloque de entreno" — al construir la primitiva Buttons, no asumir un
  significado único por variante visual, es un estilo reutilizable para varias acciones.
- **Modal entries/settings = estandarización de TODOS los modales "..." de la app**: no
  es un componente nuevo aislado, es el reemplazo unificado de cualquier menú contextual
  que hoy se abre con un botón "···" en cualquier pantalla. Construirlo como primitiva
  de la fase 2 y usarlo para reemplazar los menús contextuales existentes conforme se
  restylee cada pantalla (SessionEditorScreen, ClientsScreen, ProgramScreen, etc. tienen
  hoy implementaciones propias que deberían converger en este único patrón).
- **Header de Workout — simplificado a 2 estados, no una animación de 4 pasos**: la
  referencia real es "workout expandido" (`workout-full-header.md`) y "workout
  colapsado" (`workout-header-collapse.md`) — el mismo header ocupando menos espacio,
  NO una interpolación continua ligada al scroll. Los 4 "WS mockup" eran exploración de
  ese mismo concepto, no la referencia final — tratar solo expandido/colapsado como los
  2 estados reales a implementar (simplifica bastante la ingeniería frente a lo que
  sugería la secuencia de 4 fotogramas).
- **Lista agrupada — radio confirmado**: 2px (`radius/xxs`) en todos los corners
  interiores de cada fila; los corners exteriores de la primera y última fila usan un
  radio mayor. Coincide exactamente con lo que ya documentaron los subagentes — sin
  cambios sobre lo ya recogido en §3.

## 5-ter. Funcionalidad NUEVA confirmada (no es solo restyle — necesita su propio diseño/lógica)

- **Exercice Editor**: añadir dos botones al final ("Eliminar" / "Sustituir"), aunque
  esas acciones YA viven en el swipe de la fila (implementado esta sesión) — son un
  segundo punto de entrada explícito, no un reemplazo del swipe. Ambos coexisten.
- **Sesion Editor**: el header pasa a tener un icono "···" que abre un modal (via el
  patrón unificado de §5-bis) con **Duplicar sesión / Eliminar sesión / Renombrar
  sesión** — confirmar al llegar a esa pantalla si "duplicar" reutiliza la acción de
  store que ya existe (memoria: "duplicar sesión/etapa" ya implementado) o si hace falta
  lógica nueva para eliminar/renombrar una sesión individual (distinto de programa).
- **HomeView — mini calendario semanal real**: el selector de días (L M X J V S D + fila
  de dots) NO es decorativo — es una funcionalidad nueva que debe reflejar días
  REALMENTE entrenados (día completado = dot lleno), derivable de `workoutLog`
  (timestamps de sesiones guardadas) pero requiere lógica de agregación nueva, no existe
  hoy tal cual.
- **HomeView — orden FIJO de las Sesion Cards**: cambio de comportamiento respecto a
  hoy — las tarjetas de sesión mantienen su orden por letra a medida que se completan
  ("la A siempre será la primera"), en vez de reordenarse. Hay que localizar la lógica
  de orden/rotación actual (relacionada con `stageSessionsCompleted`/`sessPerCycle` en
  `ActiveProgramHero`, a confirmar el sitio exacto) y decidir cómo separar "qué sesión
  toca a continuación" (que sigue siendo dinámico) de "en qué orden se listan las
  tarjetas" (que pasa a ser fijo).

## 6. Orden de migración recomendado

**Antes de tocar código**: nada bloquea ya — todas las preguntas de producto están
resueltas (§5). El único trabajo previo opcional es corregir en Figma el detalle de
vinculación de variables de Pills si el usuario quiere pulirlo, pero no es bloqueante
para empezar (la implementación RN vinculará los tokens correctamente de todos modos).

1. **Tokens** → `mobile/src/themes.js`, incluye las familias nuevas (blue/green/white,
   xxs/full, xxl/xs2, hero).
2. **Primitivas nuevas** (§2, tabla 1, con las correcciones de §5-bis): Buttons, Pills,
   Chips, Segmented control (solo 2 variantes reales), ProgressCard, GroupedListRow,
   Modal unificado (reemplaza los menús "···" existentes).
3. **Restyle por pantalla**, de menor a mayor riesgo — HomeView ahora tiene 2 piezas de
   funcionalidad nueva (§5-ter) además del restyle, así que si se prefiere calentar con
   una pantalla de restyle puro antes, empezar por History:
   HomeView (restyle + calendario semanal + orden fijo) → History → Progress/Exercice
   (comparten ProgressCard + lista agrupada) → Clients/Templates (listas independientes)
   → Program Editor → Sesion Editor (+ modal "···" nuevo) / Exercice Editor (+ botones
   eliminar/sustituir) → Editores AMRAP/EMOM → **Workout Screen al final** (header
   expandido/colapsado — más simple de lo estimado, ver §5-bis — y `ExerciseCard`, donde
   vive toda la lógica de dropset/superserie/calentamiento a preservar con más cuidado).
4. **Pantallas sin diseño en Figma** (onboarding, menú, algunos modales): quedan fuera
   de este barrido — al terminar todo lo que sí tiene mock, hacer inventario de lo que
   falta y decidir aparte.
