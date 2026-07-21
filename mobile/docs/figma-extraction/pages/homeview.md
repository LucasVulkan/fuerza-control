# HomeView (`102:266`)

## Qué muestra
Pantalla principal (home) del atleta: header de app, banner de programa activo con progreso de etapa/semana, selector semanal de días con estado (dot), lista de sesiones de la semana, acciones de programa (Editar/Ver/opciones), y sección de conexiones (Drive backup, Entrenador).

## Componentes reconocidos
- **App Header** (`235:4400`): logo "Forma FIT" a la izquierda, fecha/hora centrada ("19:53 - Sab 30, May"), icono menú (hamburguesa) a la derecha.
- **Banner** (`I235:4359;235:4321`, dentro de "SesionHeader"): tarjeta grande verde acento con etapa (ETAPA 1/3), nombre de programa ("Programa hipertrofia"), barra de progreso "Volumen" con marcadores, "Semana 2 de 3" + "66%", y bloque lateral con número de semana (07) + pill "21 Sesiones". Separador vertical negro entre el bloque principal y el bloque de semana.
- **SesionHeader**: wrapper que contiene el Banner (overflow-clip, padding lateral 6px) — parece ser el contenedor de carrusel/scroll horizontal para banners de programa.
- Selector semanal ("Wekk", sic — typo de "Week" en el nombre de capa): fila de iniciales L M X J V S D + fila de 7 dots de estado (día completado = verde lleno, día actual = contorno verde vacío "J", resto = gris).
- **Sesion Card** (`104:74`...`104:78`, 5 instancias): título "SESIÓN A/B/C/D/E", nombre de sesión, subtítulo de estado ("Completada el Lunes" en verde / "Completada hace N días"), y elemento de acción a la derecha que varía (ver comparativa abajo). Estado completado usa fondo tinte-acento + borde acento; estado pendiente usa fondo surface plano.
- **Buttons**: variante "EMPEZAR" (fondo acento sólido, icono flecha) en Sesión C; variante check (icono check verde) en Sesiones A/B ya completadas; variante chevron simple (Icons sin fondo) en D/E; botón outline "Sesión libre" (mismo estilo que "Añadir ejercicio" de los bloques); botones muted "EDITAR"/"VER"/"//" en la fila de Programa; botón "Conectar" (texto acento, sin fondo) y toggle "Conectado" (texto mutedaccent) en Conexiones.
- **Conexiones** (`102:2149`, `104:156`): fila con icono de estado (dot), título + subtítulo, y acción a la derecha (toggle "Conectado" o botón "Conectar"). Dos instancias: "Drive Back up" (conectado, con email) y "Entrenador" (desconectado, invita a conectar).
- Labels de sección en mayúsculas tracking amplio ("SESIONES", "PROGRAMA", "CONEXIONES") — mismo patrón de header de sección visto en los editores de bloque.

## Patrones de layout sin componente propio
- **Lista de Sesion Cards** (`104:73`): a diferencia de la lista agrupada de ejercicios, aquí cada Sesion Card tiene su propio `rounded-[var(--radius/md,10px)]` completo y gap de 10px entre ellas — NO es el patrón de "lista agrupada" (cada card es independiente, con radio en las 4 esquinas). Contrastar con la lista de clientes que sí usa el patrón agrupado.
- Fila de acciones de Programa (`102:346`, nombre de capa "Opciones"): 3 botones iguales en fila, los dos primeros `flex-1` (EDITAR, VER) y el tercero (`//`, probablemente "más opciones") de ancho fijo/hug — mismo componente Buttons reutilizado con distinto sizing.
- Selector semanal: dos filas apiladas (iniciales de día / dots de estado) sin ser un calendario completo — patrón simple específico de esta pantalla, no visto en librería de componentes.

## Sizing en contexto (fill/hug/fixed)
- Contenedor raíz: fill w-full, padding horizontal fijo.
- App Header: fill w-full, 3 elementos distribuidos (logo hug, fecha fixed width 108px, icono fixed 26px).
- SesionHeader/Banner: ancho fijo `w-[363px]` con `h-[100px]` fijo — no es fill relativo al padding del contenedor raíz (375 viewport - 12px de padding interno del wrapper), sugiere que el Banner tiene tamaño fijo pensado para un carrusel horizontal de banners, no necesariamente 100% del ancho de pantalla.
- Selector semanal: fill w-full, iconos de estado fixed `size-[12px]`.
- Sesion Cards: fill w-full, altura hug según contenido (~ interior fixed h-51px para el bloque de texto); el elemento de acción a la derecha es hug/fixed (icono 26px o pill de botón).
- Fila Programa: fill w-full, EDITAR/VER `flex-1` (reparto igual), botón `//` hug (ancho de contenido).
- Conexiones cards: ancho fijo `w-[363px]` (igual que el Banner) en vez de fill w-full — posible inconsistencia entre "usar 363px fijo" y "usar fill" en distintos bloques de la misma pantalla, ya que el resto de secciones (Sesion Cards, Programa) sí usan fill w-full. Confirmar si es intencional o resabio de copiar el frame del banner.
- Espacio final (`102:369`): `flex-1 min-h-px` con una imagen de fondo (probablemente placeholder de safe-area/tab-bar inferior) — no parece contenido real, sino relleno visual del mock.

## Notas / cosas a confirmar
- El logo dice **"Forma FIT"**, no "Fuerza & Control" — nombre de marca distinto al nombre del proyecto/repo actual. Confirmar si es un naming anterior/placeholder del diseño o un rebrand a considerar.
- El banner de programa usa layout de card grande con separador vertical interno (bloque principal + bloque semana), notablemente distinto de un banner de app fitness estándar (que normalmente sería solo texto + CTA); aquí integra barra de progreso, contador de sesiones y etapa en una sola pieza densa de información.
- Las Sesion Cards mezclan 3 estilos de "acción a la derecha" en la misma lista (check icon, botón EMPEZAR con icono, chevron simple) según estado — confirmar que la lógica de estado (completada / próxima a hacer / futura) está bien mapeada 1:1 con estos 3 visuales.
- Sección "Conexiones" con Google Drive backup y "Entrenador" (conexión con coach) — confirmar si estas integraciones ya existen en el código actual de la app o son features nuevas del rediseño.
- El botón `//` al final de la fila Programa no tiene label de texto claro — confirmar qué acción representa (posiblemente "más opciones"/overflow menu).
