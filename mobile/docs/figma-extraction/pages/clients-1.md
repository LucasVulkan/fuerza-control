# Clients (`150:1165`)

## Qué muestra
Pantalla de lista de clientes (vista del entrenador/coach): header con contador "CLIENTES 7", acciones rápidas (icono €, icono nube/sync, botón "+ Cliente"), barra de búsqueda + botón de filtro, y lista de tarjetas de cliente.

## Componentes reconocidos
- **App Header**: mismo patrón que HomeView (Logo "Forma FIT", Fecha centrada, icono Menu 2), pero aquí con `pt-[var(--space/sm,6px)]` en vez de `pt-[var(--space/md,10px)]`.
- Título de sección "CLIENTES" + contador en acento verde ("7") — patrón de título de pantalla con badge numérico inline, no visto en HomeView.
- **Icons** cuadrados 35x35 (fondo surface2): icono "€" (probablemente acceso a pagos/facturación) y icono "nube" con un dot verde superpuesto (probablemente estado de sincronización) — ambos junto al botón principal.
- **Buttons**: variante "+ Cliente" (fondo acento sólido, para agregar cliente nuevo); variante "Client actions" reusada dos formas — "+ Programa" (fondo acento, para cliente sin programa asignado) y "Progreso" (fondo muted, con icono de barras, para cliente con programa activo).
- **Bars** variante "Search" — barra de búsqueda con placeholder "Search bar..." (fondo surface2), reutiliza el mismo componente "Bars" que en `bloques-amrap.md`/`bloques-emom.md` se usaba como header de bloque (mismo nombre de componente, uso distinto: aquí es un input, allí era un botón/label).
- Icono de filtro (35x35, 3 líneas horizontales decrecientes tipo "sliders") junto a la barra de búsqueda.
- **Sesion Card** (mismo nombre de componente que en HomeView) reutilizado como **tarjeta de cliente**: nombre del cliente en acento ("Juan"), tipo de programa con bullet ("• Hipertrofia Push/Pull"), estado ("Completada hace 10 días"), número de semana ("03 SEMANA"), botón de acción a la derecha, y menú "..." (3 dots) en la esquina superior derecha.

## Patrones de layout sin componente propio
- **Lista de tarjetas de cliente** (`177:2154`): a diferencia de lo esperado, **NO usa el patrón de "lista agrupada"** (fondo compartido + radio solo en extremos) que sí aparece en la lista de ejercicios de los bloques AMRAP/EMOM. Aquí cada tarjeta de cliente es independiente: `gap-[var(--space/sm,6px)]` entre ellas y cada una con `rounded-[var(--radius/md,10px)]` completo en las 4 esquinas — mismo patrón que las Sesion Cards de HomeView, no el patrón agrupado. Confirmar si esto es intencional o si el rediseño debería unificarlo con el patrón agrupado en algún punto.
- Fila de acciones rápidas junto al título (íconos €, nube+dot, botón + Cliente): patrón de "cluster de acciones" a la derecha de un título de sección, no visto en HomeView.
- Fila búsqueda + filtro: input flexible (`flex-1`) + icono de acción de ancho fijo al lado — patrón simple de search bar con filtro adosado.

## Sizing en contexto (fill/hug/fixed)
- Contenedor raíz: fill w-full, mismo padding lateral que HomeView.
- Título "CLIENTES 7": hug (ancho de contenido).
- Iconos de acción (€, nube, filtro): fixed `size-[35px]`.
- Botón "+ Cliente": hug con ancho de texto fijo interno `w-[70px]` para el label.
- Barra de búsqueda: `flex-1` (fill del espacio restante junto al icono de filtro fixed).
- Tarjetas de cliente: fill w-full, altura hug según contenido.
- Botón de acción dentro de la card ("+ Programa" / "Progreso"): hug.

## Notas / cosas a confirmar
- Comparar con **clients-2** (`235:4471`, ver `clients-2.md`) — probablemente representa otro estado/variante de esta misma pantalla.
- La primera tarjeta ("Juan", primera instancia `150:1311`) usa el botón **"+ Programa"** (verde acento) mientras las otras 3 tarjetas (instancias del componente `SesionCard`) usan **"Progreso"** (gris muted, con icono de barras). Esto sugiere 2 estados de cliente: sin programa asignado (CTA para asignar uno, destacado en acento) vs. con programa activo (acceso a ver su progreso, menos destacado). Confirmar que la lógica de datos actual del código distingue estos 2 estados de cliente.
- Icono "nube" con dot verde: posible indicador de sincronización/backup automático a nivel de cuenta de coach — confirmar si ya existe esta feature en el código o es nueva.
- Todas las tarjetas muestran el mismo nombre "Juan" y mismos datos — son placeholders de mock, no representan variación real de datos.
- El menú "..." en cada tarjeta (3 dots verticales) sugiere acciones contextuales por cliente (editar, eliminar, etc.) — no hay detalle de qué opciones contiene, vale la pena preguntar a diseño/producto.
