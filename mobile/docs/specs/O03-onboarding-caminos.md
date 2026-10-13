# Spec — Onboarding por caminos

> Tema: onboarding
> En corto: El alta lleva a cada usuario a lo suyo: ajustes básicos, una pregunta de cómo entrena y tres caminos distintos (por su cuenta, con entrenador, entrenador), con un constructor guiado de programa y unas tarjetas que enseñan lo básico. Todo saltable, y «Ya tengo cuenta» lo recupera todo.
> Fase O03-01 · pendiente · Cerrar el flujo y dividirlo en tareas · §15
>
> Estado: **borrador, sin tareas** (abierta el 4-oct-2026). El 12-oct-2026 se
> cerró el **estilo visual** (el del paywall, §3.1: «me gusta mucho») y se
> rehízo el recorrido **contrastado con el código**: cada pantalla que crea algo
> usa lo que la app tiene de verdad (§2.1). El usuario da el flujo por bueno «por
> ahora»; queda lo de §14 antes de partirlo en tareas. La única fase, O03-01, es
> justo eso; cuando se cierre, se sustituye por las tareas reales.
>
> Sustituirá al recorrido de entrada actual (`SetupScreen` + el selector de modo
> de `OnboardingScreen`). Lo que **no** sustituye es el flujo de plantillas de
> [O01](O01-onboarding-simple.md) (nivel → qué buscas → días → propuestas → tu
> programa): pasa a ser uno de los caminos (§8).

---

## 1. Por qué

Hoy el primer arranque es `SetupScreen` (solo unidades) y, después, el selector de
`OnboardingScreen` con cinco tarjetas iguales: automático, manual, importar,
plantilla propia y «tengo entrenador». Todos los usuarios ven lo mismo y nadie le
pregunta a nadie quién es. Tres consecuencias:

- **El entrenador no llega a lo suyo.** Su producto (clientes, plantillas,
  conexión) no aparece en el alta; lo encuentra, si acaso, más tarde.
- **«Tengo entrenador» es una tarjeta más entre cinco**, cuando para ese usuario
  es lo único que importa.
- **No se enseña la app.** Ni cómo se abre una sesión, ni cómo se apunta una
  serie, ni que el programa se edita.

Lo que pidió el usuario: idioma, unidades, tema y cómo meter los números (regla o
deslizar); separar entrenadores del resto; al entrenador, enseñarle plantillas y
clientes y preguntarle cuántos clientes lleva y si da clases en grupo (para
recoger datos, no para cambiarle el recorrido); al resto, que elija plantilla o
monte la suya según su nivel, y que «tengo entrenador» quede muy claro, con
salida para el entrenador que no usa la app. Y después, pantallas que expliquen
lo básico, haciendo cosas reales cuando se pueda. Con una UI más interactiva,
fácil de seguir, que se pueda saltar y volver atrás, con el progreso a la vista.

## 2. Las maquetas

- [`docs/mockups/onboarding-2.html`](../mockups/onboarding-2.html) — **la de
  referencia** (12-oct-2026): el recorrido de esta spec con el estilo de §3.1.
- [`docs/mockups/onboarding.html`](../mockups/onboarding.html) — la primera
  versión (4-oct), solo para el recorrido; se queda como historia.

En las dos se toca todo: el teléfono recorre el flujo de verdad (atrás,
«Saltar», tema en vivo, la celda de peso se arrastra, el buscador busca en el
catálogo real) y a la derecha van la nota de la pantalla visible, el **mapa**
(cada nodo salta a su pantalla; ⤵ entra en el constructor desde ese camino) y
las decisiones.

Siguen sin nodo de Figma. Cuando se implemente, las piezas salen de las
pantallas ya migradas (como hizo O01 §4) y el estilo nuevo (titular, barra,
relleno, panel) se saca del paywall, que ya está en código (`PaywallModal.jsx`).

### 2.1 Contrastado con el código (12-oct-2026)

Lo que el código obligó a cambiar respecto a la primera versión:

| Hecho del código | Dónde | Qué cambia |
|---|---|---|
| «¿Cómo va a entrenar?» (con la app / le apuntas tú) **solo se pregunta con cuenta en la nube**; sin ella, todos son «sin app» | `ClientsScreen.jsx:2344`, `createClient({ withApp })` (`useStore.js:666`) | la cuenta del entrenador va justo después de elegir «con la app» (§7.4) |
| Cuenta del entrenador: Apple (solo iOS), Google, código personal de 12 o sin cuenta; con campo «Tu nombre» | `TrainerSyncModal.jsx` (`MODES`, textos `sync.*`) | §7.4-7.5 usan esos modos y textos |
| El código de cliente es de **8** caracteres (`XXXX-XXXX`) y al canjearlo enseña **«Programa encontrado»** y lo carga | `ClientCodeModal.jsx` (`trainer.code*`) | §9: sin «esperando a que te lo asigne» |
| El programa del entrenador **no se edita** en el móvil del cliente | `MyProgramScreen.jsx:257` (`isTrainerProgram`) | §11.4: fuera «Cambia lo que quieras» para el conectado |
| Inicio tiene dos vistas: `profile.homeView` = `cards` (lista, por defecto) o `tabs` | `AppHeader.jsx:367`, U13 | §11.2 |
| Plan gratis: **3 clientes, 1 con app, 1 plantilla de programa, 1 de sesión** | `FREE` en `src/utils/freePlan.js` | §12 (la versión anterior decía 2+2) |
| Invitación: texto `clients.codeCard.shareText` y enlace `https://formafit-pro.github.io/join/?c=CÓDIGO` | `src/config/web.js` (M01-04, M02-02, hechas) | §7.8 deja de esperar a M01-04 |
| Fila de Clientes: avatar con color e insignia, 2.ª línea programa o aviso, cuadraditos, última vez, muesca | C08 §3-4 | §7.7 y §11.4 la dibujan tal cual |
| Buscador: campo «Buscar ejercicio», filas «nombre · grupo · material», 177 ejercicios | `ExerciseSelectorScreen.jsx`, `src/data/exerciseLibrary.js` | §10.1, en versión corta |
| Clases en grupo: C06-01 **aparcada** | C06 | §7.2: solo dato; sin «es un grupo» ni tarjeta de pizarra |

## 3. Principios de la UI

### 3.1 El estilo (cerrado el 12-oct-2026)

El del paywall ([M01 §5.7](M01-monetizacion.md)), con menos elementos gráficos
para que se lea mejor:

1. **Una pregunta, un titular.** Barlow cursiva en mayúsculas (`heroGlyph`), con
   la palabra clave en lima; si no se marca ninguna, la última. Debajo, una
   línea en `body` y nada más: sin antetítulos, sin emojis, sin iconos de adorno.
   Titulares largos (más de ~34 caracteres) bajan un escalón.
2. **El progreso arriba, siempre igual**: atrás · nombre del tramo en lima con
   «· 2 de 4» · Saltar, y debajo la barra de cuatro tramos. La barra **avanza con
   animación** desde donde estaba en cada respuesta.
3. **Elegir se nota.** La tarjeta se rellena de lima desde su círculo de
   selección, como las entradas del paywall y las pestañas de Inicio (U13-02:
   450 ms, out cubic, se recoge si se cambia), y el texto pasa a negro. Con
   respuesta única, **avanza sola al terminar el relleno** (~520 ms). Las que
   llevan a otro sitio llevan «›» y también se rellenan antes de irse.
4. **El botón no se mueve**: va fijo abajo, donde llega el pulgar; desactivado
   se ve gris (`surface2`/`muted`), no medio transparente. **Una sola acción lima
   por pantalla.**
5. **Tarjetas grandes**: 72 de alto mínimo, título a 17, descripción a 14.
6. **Entra por partes**: titular, texto y opciones, con 45 ms entre una y otra.
7. **Los cierres, en el panel lima** del paywall (radio 40, degradado
   accent→green, botón negro con texto lima): bienvenida, «Conectado», «Lo
   encontrado» y «Todo listo».
8. **Se nota el trabajo hecho**: antes de las propuestas, tres casillas se marcan
   con lo que contestó (§8); al final, la lista de hecho y pendiente (§11.5).

### 3.2 El recorrido

- **Una pregunta por pantalla.**
- **Progreso por tramos, no por pantallas** — *Ajustes · Tú · Configura ·
  Aprende* —, que se llena dentro de cada tramo. Se ve qué falta sin contar
  pasos, y no miente cuando un camino es más largo que otro.
- **Todo se puede saltar.** «Saltar» salta **el tramo entero** con los valores
  por defecto. Sin «Saltar»: la bifurcación (§6) y la cuenta del entrenador
  (§7.4), porque sin ella no hay código que darle al cliente. Dentro del
  constructor, además, «Lo termino después» en cada paso.
- **Siempre se puede volver** sin perder lo contestado.
- **Enseñar en vez de explicar**: el tema repinta la pantalla; las unidades
  enseñan un número; la elección regla/deslizar es una celda que se arrastra; las
  sesiones aparecen al elegir cuántas; la vista de Inicio se dibuja.
- **Real donde va a vivir, esquema en lo demás.** Lo que el usuario va a ver a
  diario —la fila de Clientes, la vista de Inicio, el buscador— se dibuja con las
  piezas de la app. Lo que solo se explica (plantillas, próxima sesión, sesión
  libre) puede ser un esquema simplificado.
- **Nada obligatorio** salvo lo dicho: cada paso tiene un valor por defecto y una
  salida.

## 4. El flujo

```
Bienvenida ─┬─ Empezar → Idioma → Unidades → Tema → ¿Cómo entrenas?
            └─ Ya tengo cuenta → Recuperar todo (§5.2) → la app
                                                          │
   ┌──────────────────────────────┬───────────────────────┴───────────────┐
Por mi cuenta (§8)            Con entrenador (§9)                    Soy entrenador/a (§7)
Nivel                         ¿Usa la app?                           Nº clientes · ¿Clases en grupo?  (datos)
Plantilla o el mío            ├ Sí, tengo código → programa          Crea tu 1.er cliente: ¿cómo va a entrenar?
├ plantilla: qué buscas,      │   encontrado → conectado             ├ con la app → tu cuenta (→ tu código)
│  días, preparando,          ├ Sí, sin código → mensaje             └ le apuntas tú
│  propuestas (O01)           └ No usa la app → invítale             Su programa: 1.ª plantilla ⤵ o catálogo
└ el mío ⤵                        + copia su programa (a mano ⤵)     Asignar (con la fila real de Clientes)
                                                                     Invitarle (solo con app)
                                                                     ¿También entrenas tú? ─ sí → «Por mi cuenta»
        │                              │                                 │ no
        └──── Aprende: cómo ves Inicio → cómo apuntas → tarjetas ────┘     └─ Aprende: tarjetas de entrenador
                                   └─────────── Listo (hecho + pendiente) ───────────┘

⤵ = constructor guiado (§10), compartido por los tres caminos
```

| Tramo | Pantallas |
|---|---|
| Ajustes | idioma, unidades, tema |
| Tú | bifurcación + las preguntas de cada camino (nivel; nº clientes y grupos; ¿usa la app?) |
| Configura | lo que crea algo: programa, cliente, cuenta, plantilla, asignación, conexión |
| Aprende | quien entrena: cómo ves Inicio (§11.2), cómo apuntas (§11.3) y las tarjetas (§11.4). El entrenador que no entrena: sus tarjetas |

**Por qué Inicio y regla/deslizar van en Aprende y no en Ajustes**: son de quien
entrena; el entrenador que solo lleva clientes se ahorra dos pantallas que no le
sirven. Y van justo antes de las tarjetas, que enseñan lo elegido: la de «tu
sesión de hoy» dibuja la vista de Inicio que acaba de escoger.

## 5. Tramo común

### 5.1 Bienvenida

Logotipo (Forma + FIT), titular en tres líneas («Tu programa, / tus series, /
*tu progreso*»), versales «Lo dejamos a tu medida en dos minutos» y los cuatro
tramos como una barra vacía con sus nombres, para que se sepa desde el principio
lo que viene. Abajo, el panel lima: **Empezar** y **Ya tengo cuenta**.

### 5.2 Ya tengo cuenta — recuperarlo todo

Decisión del usuario (12-oct-2026): **«Ya tengo cuenta» recupera todo**. Hoy eso
está repartido en cuatro sitios, cada uno con su puerta:

| Qué | Cómo vuelve hoy | Dónde |
|---|---|---|
| Clientes del entrenador | Apple, Google o código personal de 12 | `TrainerSyncModal` (`recovery`) |
| Conexión del cliente con su entrenador (y su programa) | la cuenta que vinculó el cliente (Apple/Google) | `ClientCodeModal` (`startWithSocial`), `ClientGoogleLinkModal` |
| Pro | la misma cuenta (RevenueCat `logIn`) o Restaurar compras | M01 §3 |
| Programas e historial propios | copia de seguridad: Google Drive o archivo `.fitdata` | `DriveBackupScreen`, importar |

Una sola pantalla, «Recupera lo tuyo», con cuatro entradas:

- **Continuar con Apple** (solo iPhone) — clientes, entrenador y Pro.
- **Continuar con Google** — lo mismo, más las copias de Drive.
- **Tengo un código de entrenador** — los doce caracteres.
- **Solo tengo una copia de seguridad** — Drive o archivo.

Y una nota en azul: si entrenaba con un entrenador y no vinculó cuenta, que le
pida un código nuevo; su historial se conserva (`trainer.codeSlotOccupied`).

Tras entrar, **«Esto es lo que había»**: cada cosa se marca al encontrarla
(cuenta de entrenador · N clientes; conexión con {entrenador} · {programa}; Forma
Pro; copia de Drive del {fecha}) y lo que no está sale en gris con «no había»,
sin alarma. Con código de entrenador, un enlace «Restaurar una copia de
seguridad →». Panel lima con **Ir a la app**: si se recupera algo, el onboarding
entero se salta.

**Lo que no cabe en una cuenta**: el programa y el historial de quien entrena
por su cuenta no viven en ningún servidor; solo vuelven con la copia. Con
Google se ofrece la de Drive en el mismo paso; con Apple, solo el archivo. Ver
§14 (abierta 2).

### 5.3 Idioma

Dos tarjetas, con el idioma del móvil ya marcado; tocar avanza. Guarda
`profile.language`. Abierto si merece pantalla propia (§14).

### 5.4 Unidades

Dos baldosas grandes, «80 kg» y «175 lb» (la cifra en Barlow); tocar avanza.
Guarda `profile.weightUnit` — es lo único que hace hoy `SetupScreen.jsx`, que
desaparece.

### 5.5 Tema

Las muestras de los cinco temas de `src/themes.js` (FormaFit, Oscuro, Midnight,
Earthy, Space). Tocar una **repinta toda la pantalla al momento** (`setTheme`,
`useStore.js:531`) y una tarjeta de ejemplo enseña cómo queda una sesión. No
avanza solo: se prueban varios.

## 6. La bifurcación — «¿Cómo entrenas?»

Tres tarjetas, sin «Saltar»:

| Tarjeta | Camino |
|---|---|
| **Por mi cuenta** — sigo un programa o me lo monto yo | §8 |
| **Con un entrenador** — alguien me prepara el programa | §9 |
| **Soy entrenador/a** — preparo programas para mis clientes | §7 |

Pregunta **la situación, no la identidad**. Así nadie tiene que llamarse
«atleta» y ningún texto de la app necesita un sustantivo para quien no es
entrenador. Y «tengo entrenador» queda en primera fila, que era el requisito.

El rol se guarda en `profile` y decide qué pestañas se ven: hoy
`proTabsHidden` es en la práctica esa preferencia («no soy entrenador, quítame
esos tabs», M01 §4.3). Se puede cambiar después en el menú.

## 7. Camino del entrenador

1. **¿Con cuántos clientes trabajas?** — Empiezo · 1-5 · 6-15 · 16-30 · +30.
   Dato (§13). Salvo «Empiezo», aparece la línea del plan gratis (§12).
2. **¿Das clases en grupo?** — Sí, habitualmente · A veces · No, solo individual.
   **Solo dato** para nuestra analítica: hoy no hay grupos en la app
   ([C06-01](C06-group-classes.md) aparcada), así que la respuesta no cambia
   nada del recorrido.
3. **Crea tu primer cliente** — la hoja «Nuevo cliente» de Clientes con otra
   cara: el nombre («Ana» de ejemplo) y **«¿Cómo va a entrenar?»**, con sus
   textos (`clients.newClientModal.*`):
   - **Entrena con la app** — «Le das un código y recibe sus programas en el
     móvil.»
   - **Le apuntas tú** — «Entrena contigo o por mensajes, y tú registras lo que
     hace.»

   Y «Se cambia cuando quieras desde su ficha». **Sin opción de grupo.** Real:
   al pulsar «Crear cliente», existe (`createClient(name, { withApp })`).
4. **Tu cuenta de entrenador** — **solo si «con la app»**, y sin «Saltar»: el
   código del cliente vive en la nube, en su cuenta. Titular «Tu cuenta de
   *entrenador*», una línea («Para que {cliente} reciba su programa en el móvil,
   tus clientes se guardan en tu cuenta»), el campo **«Tu nombre · lo ven tus
   clientes»** (`sync.nameLabel`) y tres modos, los de `TrainerSyncModal`:
   - **Continuar con Apple** (solo iPhone; en Android ni se pinta) — «Nada que
     guardar».
   - **Continuar con Google** — «Nada que guardar».
   - **Con un código personal** — «La app te da un código y es tu única llave».

   «Sin cuenta» no se ofrece: contradice lo que acaba de elegir. Debajo, «Ya
   tengo cuenta de entrenador» (recuperar, §5.2). Con Apple o Google se vuelve
   del login y se sigue al paso 6. Con «le apuntas tú» este paso no existe.
5. **Tu código personal** — solo con código. El momento que más importa del
   camino: sin el código pierde la cuenta y a sus clientes. El código de 12 en
   grande (`XXXX-XXXX-XXXX`), **Copiar** y **Enviármelo** (al compartir, a sí
   mismo), y la advertencia en naranja (`sync.revealWarn`). El botón «Ya lo he
   guardado» **no se activa hasta copiarlo o enviárselo** — propuesta: hoy
   `code_reveal` no lo exige (§14). Salida «Prefiero Google o Apple» (vuelve al
   paso 4). «Todo listo» recuerda dónde volver a verlo: Menú → Sincronización.
6. **Su programa** — dos opciones y una salida:
   - **Montar mi primera plantilla** (~3 min) → constructor guiado en modo
     entrenador (§10).
   - **Partir de una del catálogo** → lista de plantillas → paso 7.
   - «Lo hago después» → paso 8 (o 9 sin app).
7. **Asígnasela a {cliente}** — con las piezas reales (C07-02): la plantilla
   como en Plantillas (nombre, sesiones, letras) y debajo, «Así lo verás en
   Clientes», **la fila del cliente de C08 tal cual**: avatar con su color (el
   que le asigna `nextIdentityColor`), con el reloj de «esperando código» si es
   con app, «Sin programa» y el botón «+ Programar». Al pulsar **Asignar**, la
   fila cambia delante de él: «{plantilla} · Etapa 1» y los cuadraditos de la
   semana; el botón dice «✓ Asignada» y avanza solo (~1,3 s). Es el gesto que
   repetirá con cada cliente.
8. **Invita a {cliente}** — **solo con app**. Va después de asignar porque al
   canjear el código el cliente recibe el programa en ese momento. Su código de
   cliente en grande (`XXXX-XXXX`), «Copiar código» (secundario), la fila de
   Clientes con el reloj («En Clientes, hasta que lo meta») y **Enviar
   invitación** (acción lima) con el mensaje real
   (`clients.codeCard.shareText` + `inviteUrl`, M01-04). «Siguiente» como
   secundario.
9. **¿Y tú también entrenas?** — Sí → empalma con «por mi cuenta» (§8, desde el
   nivel) y después con Aprende (§11). No → Clientes pasa a ser su pantalla
   principal y va a sus tarjetas (§11.4), sin «cómo ves Inicio» ni «cómo
   apuntas». El entrenador que entrena es el caso normal, no la excepción.
10. **Listo** (§11.5).

Abierto: si las preguntas de datos (1-2) van antes o después de crear el
cliente (§14).

## 8. Camino «por mi cuenta»

1. **Nivel** — Empiezo (<6 meses) · Llevo un tiempo (6 meses-2 años) · Mucho (+2
   años). Igual que la pregunta 1 de O01. Decide qué se recomienda en el paso 2
   y la profundidad del constructor (§10.3).
2. **Plantilla o el mío** — justo después del nivel, porque quien monta el suyo
   no necesita «qué buscas» ni «días» (los días los elige el constructor).
   - Principiante: **«Te proponemos un programa hecho»**, con «Ver programas
     para mí» (recomendado) y «Prefiero montarlo yo» como enlace.
   - Intermedio y avanzado: las dos tarjetas con el mismo peso.
   - En los dos, un enlace «Tengo una copia de seguridad» (el importar de hoy).
3. **Plantilla** → qué buscas (cuatro baldosas con la palabra, sin emoji) → días
   → **preparando** → propuestas: el flujo de O01, con su hoja de ajustes.
   **Preparando** (~1,5 s): «Buscando tu *programa*» y tres casillas que se
   marcan una a una con lo contestado (nivel, objetivo, días); luego entran las
   propuestas. Hace que se sientan suyas y no un catálogo.
   **El mío** → constructor guiado (§10).
4. **Aprende** (§11) → **Listo**.

## 9. Camino «con entrenador»

1. **¿Tu entrenador usa Forma Fit?**
   - **Sí, tengo su código** — «Ocho letras y números, tipo XK7M-2P4T».
   - **Sí, pero no tengo código** → dónde lo saca el entrenador (Clientes → ficha
     → Conectar) y un mensaje ya escrito para pedírselo, con «Enviar mensaje».
     «Lo meto más tarde» sigue adelante.
   - **No la usa** → las dos cosas a la vez, no una u otra:
     - **Invítale a la app**: mensaje con enlace a la store.
     - **Copia su programa** («mientras tanto»): texto (WhatsApp, notas) →
       analizador de [C05-05](C05-trainer-logging.md), que **hoy solo entiende
       sesiones sueltas** (§14); a mano → constructor completo (§10); de una
       parecida → propuestas.
2. **El código** — ocho casillas en dos grupos de cuatro (el guion se pone
   solo), «Pegar» lo rellena entero. Es el primer paso de `ClientCodeModal`.
3. **Programa encontrado** — el paso «confirmar» de `ClientCodeModal`: el código
   ya trae el programa que le asignó su entrenador, así que se enseña antes de
   conectar, en una tarjeta con borde azul (azul = entrenador): «De {entrenador}
   · {programa} · N sesiones · N etapas» y sus letras. Debajo, «Qué pasa al
   conectar», resumen de `trainer.codeImplies1-4`: se carga en Inicio y lo sigue
   tal cual (lo cambia su entrenador, no él); su entrenador verá las sesiones que
   complete; si cambia el programa, le avisamos y decide cuándo pasarse; puede
   desconectarse cuando quiera. **Conectar**. Si su entrenador ya le había
   apuntado entrenos, sale además la elección de historial de la app
   (`codeHistoryProgram` / `codeHistoryMerge`).
4. **Conectado con {entrenador}** — en el panel lima: «{programa} ya está en tu
   Inicio. {Entrenador} verá las sesiones que completes». **Sin espera**: no hay
   «aparecerá cuando te lo asigne».
5. Si llegó por un **enlace de invitación** (`forma://join/CODIGO`, M01-04), el
   paso 1 se salta y el código viene puesto.
6. **Aprende** (§11) → **Listo**.

Por definir: cuando el entrenador que no usaba la app se la instala, ¿puede
adoptar el programa que el cliente copió? (§14).

## 10. El constructor guiado

Un solo constructor de programa, usado en tres sitios: la primera plantilla del
entrenador (§7.6), «montar el mío» (§8) y «lo copio a mano» (§9). **Cambia la
profundidad, no las pantallas.** El objetivo, en palabras del usuario: que vea
cómo es el proceso, que sienta que invierte tiempo valioso en crear algo, que de
paso vea todas las opciones que hay, y que nunca se sientan obligatorias.

### 10.1 Los pasos

```
1 Sesiones → 2 Un ejercicio → 3 Volumen → 4 Progresión → «Ya tiene forma»
```

1. **Sesiones** — elegir un número (1-6) hace aparecer las tarjetas A, B, C… al
   momento. Son las sesiones de cada semana: **no hay un campo de días aparte**
   (regla del proyecto). Si se contestaron los días antes, vienen puestas.
2. **Un ejercicio en la sesión A** — «+ Añadir ejercicio» abre **el buscador en
   corto**, dentro de la tarjeta de la sesión: el campo «Buscar ejercicio» y las
   filas del de la app («nombre» y «grupo · material»), sobre el catálogo real
   (`exerciseLibrary.js`, sin acentos ni mayúsculas al buscar, como
   `filterBySearch`). Sin escribir, cinco sugeridos según el nivel (máquinas y
   mancuernas para el principiante, básicos con barra para el resto); al
   escribir, los seis primeros resultados con lo buscado en lima y el total; si
   no hay nada, «＋ Crear "{lo escrito}"». Tocar uno lo añade. Mientras busca,
   se ocultan la línea de debajo del titular y el botón de seguir, para que
   quepan los resultados. **Fuera de la versión corta**: las pills de patrón, la
   hoja de filtros y la selección múltiple; los verá en el editor. Con uno basta
   para ver cómo funciona; B, C… se ven vacías, con «después».
3. **Volumen** del ejercicio (§10.3).
4. **Progresión** del ejercicio (§10.3).
5. **Ya tiene forma** — lo construido (A con su ejercicio y su resumen, el resto
   vacías), nombre opcional con uno ya puesto («Plantilla 1» / «Mi programa») y
   la nota «Sigue editándolo cuando termines: Programa → {nombre}». El
   entrenador sigue a «Asígnasela a {cliente}» (§7.7); el resto, a Aprende.

**La sensación de construir**: arriba, una barra con cuatro fichas que se van
encendiendo — «✓ 4 sesiones · ✓ Press banca · ✓ 3×8-12 · ✓ Por reglas».

**Nunca obligatorio**: en cada paso, «Lo termino después» sale guardando lo que
haya (al menos las sesiones vacías), y «Saltar» de arriba hace lo mismo.

### 10.2 Lo que hay que reutilizar

El constructor **no es un editor aparte**. Volumen y progresión salen del editor
de ejercicio real: los campos de Volumen de `ExerciseEditorInline` y
`editor/ProgressionSheet.jsx` (P12 §12, ya compartida entre editor y alta de
ejercicio). El buscador corto filtra el mismo catálogo y pinta la misma fila que
`ExerciseSelectorScreen`. Lo aprendido en el onboarding tiene que ser
literalmente lo que verá después. El modo principiante (§10.3) es la única
pieza propia.

### 10.3 Principiante frente a avanzado y entrenador

| | Principiante | Avanzado · entrenador · copiar a mano |
|---|---|---|
| Sugeridos del buscador | Sentadilla goblet, Press de banca con mancuernas, Remo en polea, Prensa, Jalón al pecho | Sentadilla con barra, Press de banca con barra, Peso muerto convencional, Dominadas, Press militar con barra |
| Volumen | tres opciones con nombre — **Fuerza · 5 / Músculo · 10 / Resistencia · 15** — y el nº de series. Sin rangos ni descanso | series, reps mín-máx y descanso, como en el editor |
| Progresión | **una pregunta**: «¿Quieres que la app te diga cuándo subir o bajar el peso?» (§10.4) | el editor de progresión real (§10.5) |
| Extras | — | calentamiento, dropset, superserie y vincular, como interruptores |

Intermedio = principiante en la maqueta, con el enlace «ver todas las opciones»
(§10.4) para pasar al completo. Abierto (§14).

### 10.4 La pregunta del principiante

«¿Quieres que la app te diga cuándo subir o bajar el peso?» — según cómo te
salgan las series.

- **Sí, guíame** (recomendado) — con un ejemplo con sus números: «Si completas
  3×10 con 40 kg, la próxima vez te propondremos 42,5. Si te cuesta, menos.» →
  progresión por peso, por reglas.
- **No, lo decido yo** — «Verás lo que hiciste la última vez y tú eliges el
  peso.» → sin progresión (`up: 'none'`).

Debajo, **«Ver todas las opciones de progresión →»** abre el editor completo en
el sitio: el principiante nunca queda bloqueado.

### 10.5 El editor completo

Los pasos de `ProgressionSheet`, numerados según los que salgan, con **la regla
escrita en una frase arriba** que cambia con cada toque:

- **Qué sube** — Peso · Reps · Nada.
- **Cómo** (si sube peso) — Por reglas · Por esfuerzo. Por esfuerzo exige reps
  fijas: si había rango, se avisa y se pasa al mínimo (`effortNeedsFixed`).
- **Cuándo sube** (reglas) — todas las series · una serie. **RPE objetivo**
  (esfuerzo) — 6-10, con las reps en recámara.
- **Cuándo baja** — 2 fallos · 3 fallos · nunca.
- **Y si quieres más · todo opcional** — interruptores de calentamiento, dropset
  en la última serie, superserie con el siguiente y vincular con otras sesiones.
  Los ve todos sin tener que tocar ninguno.

Frases de ejemplo: «Cuando todas las series lleguen a 12 reps → +2,5 kg y vuelves
a 8.» · «Cada sesión la app calcula el peso para que 3×8 te quede en RPE 8.»

Los textos de los pasos ya existen en `exerciseEditor.*` de los locales
(`stepUp`, `upOptions`, `stepHow`, `howRules`, `howEffort`, sus pistas…).

## 11. Aprende

### 11.1 Real frente a simulado

- **Lo que crea algo es real**: crear el cliente, la cuenta, la plantilla,
  asignarla, conectarlo, el programa propio. Son las pantallas de la app con
  otra cara; al acabar, existe.
- **Lo que explica es simulado**: tarjetas con una mini-pantalla, un elemento
  resaltado que late (lima; azul si es del entrenador) y, cuando hace falta, un
  círculo que marca dónde tocar. 3-4 por camino, con puntos de progreso,
  Anterior/Siguiente, saltables. Las mismas pistas **reaparecen la primera vez
  que entra en cada pantalla real**, que es cuando de verdad se recuerdan.
- **Mini-pantallas reales donde va a vivir**: la vista de Inicio elegida y la
  fila de Clientes (C08) se dibujan como en la app; plantillas, próxima sesión y
  sesión libre, como esquemas.

### 11.2 Cómo ves Inicio

Solo quien entrena. «¿Cómo quieres ver tus *sesiones*?» — «Así será tu Inicio.
Se cambia en Preferencias.» **Las dos opciones lado a lado**, cada una con su
dibujo, para comparar sin ir y volver:

- **Lista** (`homeView: 'cards'`, por defecto) — «Todas las sesiones, una debajo
  de otra»: la que toca en lima con su botón, las demás en filas.
- **Pestañas** (`'tabs'`, U13) — «Una tarjeta, una pestaña por sesión». En el
  dibujo **las pestañas se tocan**: abrir otra pasa la tarjeta a `surface` y deja
  la pestaña de la que toca en lima, como U13 §2.

Elegir rellena la tarjeta entera de lima (el dibujo conserva sus colores). Con
entrenador conectado, las pestañas llevan la etiqueta «Para tu caso» (U13 §1:
para quien recibe un programa). Los nombres de las sesiones son los de su
programa si ya lo tiene.

### 11.3 Cómo apuntas una serie (regla o deslizar)

Es la práctica de «cómo se apunta una serie» disfrazada de pregunta. Una fila de
serie (S1 · peso · reps) que **se arrastra de verdad**, y dos tarjetas:

- **Con regla** — al deslizar a los lados aparece la regla y se ve cada paso.
- **Solo deslizar** — el número sube y baja con el dedo, sin regla.

Cambiar de tarjeta cambia cómo responde la fila. Guarda `profile.scrubRuler`,
que ya existe (`AppHeader.jsx:363`, Preferencias) y por defecto es `true`.

**Por confirmar al implementar**: en la maqueta «solo deslizar» es vertical y
«regla» horizontal; hay que comprobar qué hace exactamente el Workout con
`scrubRuler: false` y que la demo diga lo mismo.

### 11.4 Las tarjetas

La de «apunta cada serie» ya no existe: lo acaba de practicar en §11.3.

**Por mi cuenta, con entrenador sin conectar y entrenador que también entrena**:
1. *(solo entrenador)* **Tus clientes, de un vistazo** — como abajo.
2. **Tu sesión de hoy, en Inicio** — la vista elegida en §11.2, con el botón
   Empezar resaltado. El texto cambia con la vista.
3. **Cambia lo que quieras** — Programa → ejercicios, series, progresión.
4. **¿Hoy algo distinto? Sesión libre** — el «+»; cuenta o no como sesión del
   programa.

**Con entrenador conectado** (código canjeado): igual, pero la 3 es **«{Entrenador}
ve tus entrenos»** — un aviso azul de programa cambiado («Ver ›») y una sesión
hecha con «la verá» —: le llega cada sesión que completa; si cambia el programa,
se le avisa y decide cuándo pasarse. **«Cambia lo que quieras» no sale**: no
puede editar el programa de su entrenador. La 4 añade que su entrenador también
ve las libres.

**Entrenador que no entrena**:
1. **Tus clientes, de un vistazo** — **la lista real de C08**: el cliente que
   acaba de crear arriba (con su reloj si es con app), uno al día con
   cuadraditos y la muesca lima de sesiones sin revisar, uno «Sin entrenar» en
   rojo y uno «Cambios sin enviar» en azul con «↑ Enviar».
2. **Plantillas: programa una vez** — asígnala a varios; cada uno a su ritmo.
3. **Ajusta su próxima sesión** — desde la ficha, sin tocar el programa.
4. *(solo si su cliente es «le apuntas tú»)* **Apunta tú sus sesiones** —
   «Registrar sesión» o pegar el texto de WhatsApp (C05).

Sin tarjeta de pizarra: no hay grupos (§7.2).

Las mini-pantallas usan lo que el usuario acaba de crear (nombre del programa,
del cliente, unidad, vista de Inicio).

### 11.5 Listo

«Todo *listo*» y una lista con lo hecho (✓) y lo pendiente (círculo vacío).
Entrenador: «Cliente: Ana · con la app» · «Código personal guardado · Menú →
Sincronización» (o «Cuenta de Google/Apple») · «"Plantilla 1" asignada» ·
«Rellenar las sesiones B, C de la plantilla» · «Esperando a que Ana meta su
código». Con entrenador conectado: «Conectado con Marta» · «"{programa}" en tu
Inicio», sin pendientes de espera. Panel lima: «A entrenar» o «A por tus
clientes» e **Ir a la app**. **Los pendientes reaparecen como tarjeta en Inicio o
en Clientes**: si no, «lo hago después» se pierde.

## 12. Monetización dentro del onboarding

**Sin paywall en el onboarding.** El plan gratis es el de `freePlan.js`: **3
clientes (1 con app), 1 plantilla de programa y 1 de sesión**. Si el entrenador
dice que lleva clientes, una línea informativa: «Empiezas gratis con 3 clientes
(1 con la app) y 1 plantilla. Cuando necesites más, Pro quita el límite.» Sin
botón de compra. El paywall salta donde dice M01, al pasarse del límite.

Consecuencias que hay que tener presentes:
- La primera plantilla del onboarding **gasta la única gratis**. Es lo que se
  busca (que la monte), pero «Todo listo» no debe sugerirle crear otra.
- El primer cliente «con la app» **gasta el único hueco con app**: el segundo
  con app ya pide Pro. No se avisa en el onboarding; lo dice el contador de
  Clientes.

Si M01 acaba con prueba gratis, la línea cambia a «prueba Pro N días».

## 13. Datos que se recogen

| Dato | Dónde | Para qué |
|---|---|---|
| rol (por mi cuenta · con entrenador · entrenador) | `profile` | pestañas visibles, camino |
| ¿también entrena? (entrenador) | `profile` | pantalla principal, si ve Aprende de atleta |
| nivel | ya existe en las respuestas del onboarding | recomendación, profundidad del constructor |
| nº de clientes | `profile` | solo dato |
| clases en grupo | `profile` | solo dato (hoy no cambia nada) |
| ¿su entrenador usa la app? | `profile` | dato |
| cómo va a entrenar su primer cliente | ya existe (`client.syncSlotId`) | dato |
| modo de cuenta del entrenador | ya existe (`trainerSync.mode`) | dato |
| vista de Inicio | ya existe (`profile.homeView`) | dato + preferencia |

Se guardan en local desde el principio. **Para que le lleguen al usuario hace
falta [A01](A01-analitica.md)** (analítica propia), que está en espera
precisamente hasta que el onboarding se asiente; sus eventos de onboarding
(A01 §5) habrá que rehacerlos sobre este recorrido.

## 14. Decisiones

### Tomadas

- Bifurcación por situación, no por identidad (§6).
- El entrenador que entrena empalma con «por mi cuenta» (§7.9).
- La elección regla/deslizar es una práctica (§11.3).
- Hacer = real, explicar = simulado y repetido sobre la pantalla real (§11.1).
- El entrenador monta su primera plantilla con el constructor y se la asigna al
  cliente que acaba de crear (§7.6-7); el catálogo, como atajo.
- Un constructor único con dos profundidades; el principiante solo responde una
  pregunta de progresión (§10).
- Sin paywall en el onboarding (§12).
- *(12-oct)* **Estilo**: el del paywall, con menos adornos (§3.1).
- *(12-oct)* **«Ya tengo cuenta» recupera todo** (§5.2).
- *(12-oct)* **Grupos**: solo dato; fuera «es un grupo» y la pizarra (§7.2).
- *(12-oct)* **Cliente nuevo con «¿Cómo va a entrenar?»** y, con app, la cuenta
  del entrenador justo después, sin saltar (§7.3-4).
- *(12-oct)* **Asignar e invitar con las piezas reales** de Clientes; invitar
  solo con app y después de asignar (§7.7-8).
- *(12-oct)* **Con código, sin espera**: programa encontrado → conectado; sin
  tarjeta de editar (§9, §11.4).
- *(12-oct)* **Cómo ves Inicio, en Aprende**, con las dos vistas a la vista; y
  regla/deslizar con ella (§4, §11.2-3).
- *(12-oct)* **Buscador corto** en el constructor (§10.1).

### Abiertas

1. **Idioma**: ¿pantalla propia o el del móvil con un enlace «cambiar»?
2. **Recuperar «todo» para quien entrena por su cuenta**: su programa e historial
   no viven en ninguna cuenta, solo en la copia (Drive o archivo). ¿Basta con
   ofrecer la copia en «Recupera lo tuyo» (lo que hace la maqueta), o se añade
   una copia en la nube atada a la cuenta (Apple/Google), que es lo único que
   haría «todo» de verdad con un solo login? Lo segundo es una feature nueva.
   Implementar §5.2 pide además **una búsqueda conjunta por identidad** (huecos
   de entrenador, hueco de cliente, RevenueCat y, con Google, Drive) que hoy no
   existe: cada pieza tiene su llamada.
3. **El código personal bloquea el botón** hasta copiarlo o enviárselo (§7.5):
   ¿se lleva también a `TrainerSyncModal` fuera del onboarding?
4. **Orden del entrenador**: ¿preguntas de datos antes o después de crear el
   cliente? (acción primero engancha más; preguntas primero es más natural).
5. **Intermedio**: ¿constructor sencillo con enlace (como la maqueta) o completo?
6. **Plantilla a medias asignada**: el entrenador asigna una plantilla con B y C
   vacías; si el cliente se conecta antes de rellenarlas, le llega un programa a
   medias. ¿No se envía hasta que todas las sesiones tengan ejercicios, o se
   pregunta al conectar?
7. **Pegar el programa del entrenador**: ampliar el analizador de C05-05 a un
   programa entero, o quitar la opción.
8. **Adoptar el programa copiado**: cuando el entrenador que no usaba la app se
   conecta, ¿puede quedarse con el programa que el cliente copió?
9. **Rol sin pestañas**: qué ve exactamente cada rol (¿el entrenador que no
   entrena pierde Inicio, o solo cambia la pestaña de entrada?).
10. **Re-entrada**: `OnboardingScreen` también se abre desde la app («Nuevo
    programa», `fromApp`). Propuesta: el onboarding nuevo es solo de primer
    arranque y el creador de programa (O01 + constructor) sigue siendo la puerta
    de «Nuevo programa».

## 15. Siguiente paso

**O03-01 — Cerrar el flujo y dividirlo en tareas.** Resolver lo abierto de §14,
iterar la maqueta lo que haga falta y partir la spec en tareas. Orden previsible,
por dependencias:

- se puede hacer ya: el estilo como piezas propias (titular, barra de tramos,
  opción con relleno, pie fijo, panel; §3.1), tramo común (§5.1, §5.3-5.5),
  bifurcación y rol (§6), camino «por mi cuenta» (§8), constructor con buscador
  corto (§10), Aprende (§11) y el camino del entrenador entero (§7: la
  invitación, M01-04, ya está hecha);
- espera a la abierta 2: «Ya tengo cuenta» (§5.2), por la búsqueda conjunta;
- instrumentación: A01-02, después de todo lo anterior.

### Código que se toca o reutiliza (verificado el 12-oct-2026)

| Pieza | Dónde |
|---|---|
| Primer arranque, solo unidades → desaparece | `src/screens/SetupScreen.jsx` (`setupComplete`) |
| Selector de modo, manual, plantilla propia, importar, flujo O01 | `src/screens/OnboardingScreen.jsx` |
| Ruta inicial | `src/navigation/RootNavigator.jsx` (`_initialRoute`, pantallas `Setup` y `Onboarding`) |
| Estilo: titular, relleno de selección, panel lima | `src/components/PaywallModal.jsx` (`Marked`, `PlanTicket`, panel) |
| Preferencia de la regla | `profile.scrubRuler` (`AppHeader.jsx:363`) |
| Vista de Inicio | `profile.homeView` (`AppHeader.jsx:367`), `SessionTabsCard.jsx`, `SessionList.jsx` |
| Tema | `setTheme` (`store/useStore.js:531`), `src/themes.js` |
| Pestañas de entrenador | `profile.proTabsHidden`, `RootNavigator.jsx` |
| Nuevo cliente con/sin app | `ClientsScreen.jsx:2344` (`askClientMode`), `createClient` (`useStore.js:666`) |
| Cuenta del entrenador y su código | `src/components/TrainerSyncModal.jsx` (`select`, `code_reveal`, `recovery`) |
| Fila de Clientes | C08 §3-4 (`ClientsScreen.jsx`, `identityColor.js`) |
| Asignar programa | hoja de C07-02 |
| Invitación | `inviteUrl` (`src/config/web.js`), `clients.codeCard.shareText` |
| Código de cliente y «programa encontrado» | `src/components/ClientCodeModal.jsx` |
| Reconectar el cliente con su cuenta | `src/components/ClientGoogleLinkModal.jsx`, `ClientCodeModal` (`startWithSocial`) |
| Programa del entrenador no editable | `isTrainerProgram` (`src/utils/stageLocks.js`), `MyProgramScreen.jsx:257` |
| Buscador y catálogo | `src/screens/ExerciseSelectorScreen.jsx`, `src/data/exerciseLibrary.js`, `src/utils/searchText.js` |
| Copia de seguridad | `src/screens/DriveBackupScreen.jsx`, importar `.fitdata` |
| Plan gratis | `FREE` en `src/utils/freePlan.js` |
| Pegar texto | `src/screens/PasteWorkoutScreen.jsx` (C05-05) |
| Progresión | `src/components/editor/ProgressionSheet.jsx` |
| Hojas | `src/components/DragSheet.jsx` |
| Paywall (no se abre desde aquí) | `src/components/PaywallModal.jsx` |
