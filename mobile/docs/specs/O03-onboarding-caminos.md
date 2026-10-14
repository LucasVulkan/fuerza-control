# Spec — Onboarding por caminos

> Tema: onboarding
> En corto: El alta lleva a cada usuario a lo suyo: ajustes básicos, una pregunta de cómo entrena y tres caminos distintos (por su cuenta, con entrenador, entrenador), con un constructor guiado de programa y unas tarjetas que enseñan lo básico. Todo saltable, y «Ya tengo cuenta» devuelve lo que había.
> Inicio: 2026-10-13
> Fase O03-01 · hecho · Armazón del recorrido y tramo común · §17
> Fase O03-02 · hecho · Constructor guiado I: sesiones, buscador corto y «ya tiene forma» · §18
> Fase O03-03 · pendiente · Constructor guiado II: volumen en dos profundidades · §19
> Fase O03-04 · pendiente · Camino «por mi cuenta» · §20
> Fase O03-05 · hecho · Camino «con entrenador» · §21
> Fase O03-06 · hecho · Aprende: cómo ves Inicio, cómo apuntas y las tarjetas · §22
> Fase O03-07 · pendiente · «Ya tengo cuenta», versión mínima · §23
> Fase O03-08 · pendiente · Camino del entrenador · §24
> Fase O03-09 · aparcado · Recuperar todo con un solo login · §26.1
> Fase O03-10 · aparcado · Pendientes y pistas sobre las pantallas reales · §26.2
> Fase O03-11 · pendiente · «Nuevo programa» con el recorrido nuevo · §25
>
> Estado: **spec cerrada; olas 1 y 2 hechas (O03-01, 02, 05, 06), por probar** (14-oct-2026). Abierta el 4-oct como
> borrador; el 12-oct se cerró el estilo (el del paywall) y se rehízo el
> recorrido contra el código; el 13-oct se revisó otra vez contra el código, se
> corrigieron cinco cosas que no habrían funcionado (§2.2), se cerraron las diez
> abiertas (§15) y se partió en ocho tareas para subagentes, en cuatro olas
> (§27). El mismo día se añadió la novena, O03-11: «Nuevo programa» desde la
> app entra por el recorrido nuevo y `OnboardingScreen` se borra (§25). Maqueta de referencia: [`docs/mockups/onboarding-2.html`](../mockups/onboarding-2.html).
>
> Sustituye al recorrido de entrada actual (`SetupScreen` + el selector de modo
> de `OnboardingScreen`) **y** a «Nuevo programa», que hoy abre ese mismo selector.
> Las piezas de propuestas de [O01](O01-onboarding-simple.md) se reutilizan en el
> camino «por mi cuenta»; el resto de `OnboardingScreen` se borra (O03-11).

---

## 1. Por qué

Hoy el primer arranque es `SetupScreen` (idioma y unidades) y, después, el selector
de `OnboardingScreen` con cinco tarjetas iguales: automático, manual, importar,
plantilla propia y «tengo entrenador». Todos ven lo mismo y nadie le pregunta a
nadie quién es:

- **El entrenador no llega a lo suyo.** Clientes, cuenta y conexión no aparecen
  en el alta.
- **«Tengo entrenador» es una tarjeta más entre cinco**, cuando para ese usuario
  es lo único que importa.
- **No se enseña la app**: ni cómo se abre una sesión, ni cómo se apunta una
  serie, ni que el programa se edita.

Lo que pidió el usuario: idioma, unidades, tema y cómo meter los números (regla o
deslizar); separar entrenadores del resto; al entrenador, enseñarle clientes y
plantillas y preguntarle cuántos clientes lleva y si da clases en grupo (como
dato); al resto, que elija plantilla o monte la suya según su nivel, con «tengo
entrenador» muy claro y salida para el entrenador que no usa la app. Después,
pantallas que expliquen lo básico haciendo cosas reales cuando se pueda. UI
interactiva, fácil de seguir, saltable, con vuelta atrás y el progreso a la vista.

## 2. La maqueta y el código

- [`docs/mockups/onboarding-2.html`](../mockups/onboarding-2.html) — **la de
  referencia**. Se recorre entera: atrás, «Saltar», tema en vivo, la celda de peso
  se arrastra en los dos modos, el buscador busca en el catálogo real. A la
  derecha, la nota de cada pantalla, el **mapa** (cada nodo salta a su pantalla;
  ⤵ entra en el constructor desde ese camino; «Por invitación ↗» simula el
  enlace) y el recuadro «Revisión del 13-oct».
- [`docs/mockups/onboarding.html`](../mockups/onboarding.html) — la primera
  versión (4-oct); solo historia.

Sin nodo de Figma. Las piezas salen de las pantallas ya migradas y el estilo nuevo
(titular, relleno, panel) del paywall, que está en código (`PaywallModal.jsx`).
**Ante la duda entre esta spec y la maqueta, manda la spec.**

### 2.1 Hechos del código que dan forma al recorrido

| Hecho | Dónde | Consecuencia |
|---|---|---|
| El modo «con app / le apuntas tú» de un cliente solo se pregunta con cuenta en la nube | `ClientsScreen.jsx` (`askClientMode`), `createClient` (`store/useStore.js`) | la cuenta del entrenador va justo después de elegir «con la app» (§7.4) |
| Cuenta del entrenador: Apple (solo iOS), Google, código personal de 12; campo «Tu nombre» | `TrainerSyncModal.jsx` (`MODES`, `doSwitch`, textos `sync.*`) | §7.4-7.5 usan esos modos y textos |
| El código de cliente es de 8 (`XXXX-XXXX`); al canjearlo enseña el programa y lo carga | `ClientCodeModal.jsx`, `validateClientCode`, `linkToTrainer` | §9: «programa encontrado» → conectado, sin espera |
| El programa del entrenador no se edita en el móvil del cliente | `isTrainerProgram` (`src/utils/stageLocks.js`) | §11.4: sin «Cambia lo que quieras» para el conectado |
| Inicio tiene dos vistas: `profile.homeView` = `cards` (defecto) o `tabs` | `AppHeader.jsx`, `HomeScreen.jsx`, U13 | §11.2 |
| La regla al deslizar es `profile.scrubRuler` (defecto `true`) | `AppHeader.jsx`, `workout/SetRow.jsx` | §11.3 |
| Plan gratis: 3 clientes, 1 con app, 1 plantilla de programa, 1 de sesión | `FREE` en `src/utils/freePlan.js` | §13 |
| Invitación: `clients.codeCard.shareText` + `inviteUrl(code)` | `src/config/web.js`, `ClientsScreen.jsx` (`handleShare`) | §7.8 |
| Fila de Clientes (C08): avatar con color e insignia, 2.ª línea, cuadraditos, última vez, muesca | `ClientsScreen.jsx` (`renderItem` de la lista) | se extrae a componente (§22) y se reutiliza |
| Catálogo de ejercicios: 177, buscador sin acentos | `src/data/exerciseLibrary.js`, `filterBySearch` (`src/utils/searchText.js`) | §10.1 |
| Clases en grupo: C06-01 aparcada | C06 | §7.2: solo dato |

### 2.2 Lo que la revisión del 13-oct corrigió

Cinco cosas de la versión del 12-oct **no habrían funcionado**:

1. **Crear el cliente «con app» antes de la cuenta.** `createClient(name, { withApp })`
   solo pide el hueco al servidor si `trainerSync.userId` existe; sin cuenta crea
   un cliente sin app **y no avisa**. → El cliente se crea siempre sin app y, con
   la cuenta hecha, pasa a la app con `connectClientToCloud(clientId)` (§7.3-7.4).
2. **Asignar no envía.** `setClientActiveProgram` solo deja el programa
   «pendiente de enviar». Sin `uploadProgramToClient`, el código del cliente no
   trae programa. → En el onboarding, guardar o asignar **envía** (§7.6-7.7).
3. **Invitar sin programa da error.** `validateClientCode` lanza «El entrenador
   aún no ha subido ningún programa» si el hueco no tiene programa. → Sin programa
   no hay paso de invitar (§7.8).
4. **Quien acaba sin programa volvería al onboarding en cada arranque.** La ruta
   inicial manda al onboarding si no hay `onboardingCompleted` ni programa
   activo. → «Listo» lo marca en todos los caminos (§16.4).
5. **«Solo deslizar» no es vertical.** En `SetRow` los dos modos van a los lados:
   sin regla la cifra cambia en la casilla (chevrones, borde lima); con regla la
   casilla no se mueve, sale la regla y se guarda al soltar (§11.3).

Y una de diseño, del usuario: **el entrenador no monta una plantilla, monta el
programa de su cliente** (§7.6). Asignar una plantilla la copia; lo que
completara después en la plantilla no le llegaría al cliente, y tendría dos cosas
a medias que editar.

## 3. Principios de la UI

### 3.1 El estilo (cerrado el 12-oct-2026)

El del paywall ([M01 §5.7](M01-monetizacion.md)), con menos adornos:

1. **Una pregunta, un titular.** Barlow cursiva en mayúsculas (`textStyles.heroGlyph`),
   con la palabra clave en lima (`ui/Marked.jsx`, `*palabra*`); si no se marca
   ninguna, la última. Debajo, una línea en `body` y nada más: sin antetítulos,
   sin emojis, sin iconos de adorno. Titulares de más de ~34 caracteres bajan un
   escalón.
2. **El progreso arriba, siempre igual**: atrás · nombre del tramo en lima con
   «· 2 de 4» · Saltar, y debajo la barra de cuatro tramos. La barra **avanza con
   animación** desde donde estaba.
3. **Elegir se nota.** La tarjeta se rellena de lima desde su círculo de selección
   (como `PlanTicket` del paywall y las pestañas de Inicio, U13-02: 450 ms, out
   cubic, se recoge si se cambia) y el texto pasa a `onAccent`. Con respuesta
   única **avanza sola al terminar el relleno** (~520 ms). Las que llevan a otro
   sitio llevan «›» y también se rellenan antes de irse.
4. **El botón no se mueve**: fijo abajo; desactivado se ve gris
   (`surface2`/`muted`), no medio transparente. **Una sola acción lima por
   pantalla.**
5. **Tarjetas grandes**: 72 de alto mínimo; título en el rol de 17, descripción
   en el de 14 (roles de `textStyles`, nunca `fontSize` propio — AGENTS.md).
6. **Entra por partes**: titular, texto y opciones, 45 ms entre una y otra
   (`ui/Rise.jsx` + `hooks/useEnterClock.js`).
7. **Los cierres, en el panel lima** del paywall (radio 40, degradado
   accent→green, botón `onAccent` con texto lima): bienvenida, «Conectado» y
   «Todo listo».
8. **Se nota el trabajo hecho**: «preparando» antes de las propuestas (§8) y la
   lista de hecho/pendiente al final (§11.5).

### 3.2 El recorrido

- **Una pregunta por pantalla.**
- **Progreso por tramos** — *Ajustes · Tú · Configura · Aprende* —, que se llena
  dentro de cada tramo. No miente cuando un camino es más largo que otro.
- **Todo se puede saltar.** «Saltar» salta **el tramo entero** con los valores por
  defecto. Sin «Saltar»: la bifurcación (§6), la cuenta del entrenador (§7.4) y su
  código personal (§7.5). En el constructor, además, «Lo termino después».
- **Siempre se puede volver** sin perder lo contestado (también con el atrás de
  Android).
- **Enseñar en vez de explicar**: el tema repinta la pantalla; las unidades
  enseñan un número; regla/deslizar es una celda que se arrastra; las sesiones
  aparecen al elegir cuántas; la vista de Inicio se dibuja.
- **Real donde va a vivir, esquema en lo demás.** La fila de Clientes, la vista
  de Inicio y el buscador se dibujan como en la app. Lo que solo se explica
  (plantillas, próxima sesión, sesión libre) puede ser un esquema.
- **Hacer es real**: crear el cliente, la cuenta, el programa, asignarlo,
  conectarse. Al acabar la pantalla, existe.

## 4. El flujo

```
Bienvenida (+ idioma) ─┬─ Empezar → Unidades → Tema → ¿Cómo entrenas?
                       └─ Ya tengo cuenta → Recupera lo tuyo (§12) → la app
   (por invitación: Unidades → Tema → código ya puesto, §9.5)
                                                          │
   ┌──────────────────────────────┬───────────────────────┴───────────────┐
Por mi cuenta (§8)            Con entrenador (§9)                    Soy entrenador/a (§7)
Nivel                         ¿Usa la app?                           Nº clientes · ¿Clases en grupo?  (datos)
Plantilla o el mío            ├ Sí, tengo código → programa          Crea tu 1.er cliente: ¿cómo va a entrenar?
├ plantilla: qué buscas,      │   encontrado → conectado             ├ con la app → tu cuenta (→ tu código)
│  días, preparando,          ├ Sí, sin código → pedírselo           └ le apuntas tú
│  propuestas (O01)           └ No usa la app → invítale             Su programa: crearlo ⤵ · catálogo → asignar · después
└ el mío ⤵                        + cópialo (a mano ⤵ · parecido)    Invitarle (solo con app y programa)
                                                                     ¿También entrenas tú? ─ sí → «Por mi cuenta»
        │                              │                                 │ no
        └──── Aprende: cómo ves Inicio → cómo apuntas → tarjetas ────┘     └─ Aprende: tarjetas de entrenador
                                   └─────────── Listo (hecho + pendiente) ───────────┘

⤵ = constructor guiado (§10), compartido por los tres caminos
```

| Tramo | Pantallas |
|---|---|
| Ajustes | unidades, tema (el idioma va en la bienvenida) |
| Tú | bifurcación + las preguntas de cada camino (nivel; nº clientes y grupos; ¿usa la app?) |
| Configura | lo que crea algo: programa, cliente, cuenta, asignación, conexión |
| Aprende | quien entrena: cómo ves Inicio, cómo apuntas y las tarjetas. El entrenador que no entrena: sus tarjetas |

Inicio y regla/deslizar van en Aprende y no en Ajustes porque son de quien
entrena, y porque la tarjeta siguiente enseña justo la vista elegida.

**Desde la app**, «Nuevo programa» entra por otra puerta del mismo recorrido
(§25):

```
Nuevo programa → Elige cómo empezar ─┬─ Programa recomendado → qué buscas → días → propuestas ─┐
                                     ├─ Crear desde cero ⤵ ────────────────────────────────────┤
                                     ├─ Desde una plantilla → elegir ──────────────────────────┼→ Programa listo → Inicio
                                     ├─ Importar archivo ──────────────────────────────────────┘
                                     └─ Programa de tu entrenador → código → conectado → Inicio
```

## 5. Tramo común

### 5.1 Bienvenida

Logotipo (Forma + `FitLogo`), titular en tres líneas («Tu programa, / tus series,
/ *tu progreso*»), versales «Lo dejamos a tu medida en dos minutos» y los cuatro
tramos como una barra vacía con sus nombres. Arriba a la derecha, el **selector
de idioma** ES · EN (§5.2). Abajo, el panel lima: **Empezar** y **Ya tengo
cuenta**. Si llegó por invitación, una línea azul: «{Entrenador} te ha invitado.
Al final de los ajustes te conectamos» (el nombre, si `validateClientCode` lo
da; si no, «Tu entrenador te ha invitado»).

### 5.2 Idioma

En la bienvenida, no en pantalla propia. Viene marcado **el del móvil**: hoy no se
detecta (`src/i18n.js` arranca con `lng: 'es'`); se lee con
`Intl.DateTimeFormat().resolvedOptions().locale` — empieza por `en` → inglés; lo
demás → español. Se aplica la primera vez que se pinta la bienvenida, si el
usuario no lo ha tocado. Tocar ES/EN llama a `setLanguage(lang)` y repinta todo.

### 5.3 Unidades

Dos baldosas grandes, «80 kg» y «175 lb» (la cifra en Barlow); tocar avanza.
Guarda `profile.weightUnit`.

### 5.4 Tema

Las cinco muestras de `src/themes.js`. Tocar una **repinta toda la pantalla al
momento** (`setTheme(name)`; el tema vive en `state.theme`, no en `profile`) y una
tarjeta de ejemplo enseña una sesión. No avanza sola: botón «Siguiente».

## 6. La bifurcación — «¿Cómo entrenas?»

Tres tarjetas, sin «Saltar»:

| Tarjeta | Camino | `profile.role` |
|---|---|---|
| **Por mi cuenta** — sigo un programa o creo el mío | §8 | `'self'` |
| **Con un entrenador** — alguien me prepara el programa | §9 | `'coached'` |
| **Soy entrenador/a** — preparo programas para mis clientes | §7 | `'trainer'` |

Pregunta la situación, no la identidad. **El rol decide las pestañas**: `self` y
`coached` ponen `profile.proTabsHidden: true` (hoy todos ven las de entrenador por
defecto); `trainer`, `false`. Se cambia después en el menú, como hoy.

## 7. Camino del entrenador

1. **¿Con cuántos clientes trabajas?** — Empiezo · 1-5 · 6-15 · 16-30 · +30.
   Dato (`profile.trainerClientsBand`). Salvo «Empiezo», la línea del plan gratis
   (§13). Botón «Siguiente».
2. **¿Das clases en grupo?** — Sí, habitualmente · A veces · No, solo individual.
   Dato (`profile.trainerGroups`); no cambia nada (C06-01 aparcada). Avanza sola.
3. **Crea tu primer cliente** — nombre (`NameField`, «Ana» de ejemplo) y
   **«¿Cómo va a entrenar?»** con los textos de `clients.newClientModal.*`:
   **Entrena con la app** · **Le apuntas tú**, y «Se cambia cuando quieras desde
   su ficha». Sin opción de grupo. «Crear cliente» llama a
   **`createClient(name)` sin `withApp`** y guarda el id en el recorrido.
   - Con app y sin cuenta → paso 4. Con app y cuenta ya hecha (vuelta atrás) →
     `connectClientToCloud(id)` y paso 6. Le apuntas tú → paso 6.
   - Volver atrás y cambiar el nombre **renombra** (`renameClient`), no crea otro.
4. **Tu cuenta de entrenador** — solo con app, **sin «Saltar»**. Titular «Tu
   cuenta de *entrenador*», una línea («Para que {cliente} reciba su programa en el
   móvil, tus clientes se guardan en tu cuenta»), el campo **«Tu nombre · lo ven
   tus clientes»** (`sync.nameLabel`, `setTrainerName`) y tres modos: **Continuar
   con Apple** (solo iOS; en Android ni se pinta), **Continuar con Google**,
   **Con un código personal**. «Sin cuenta» no se ofrece. Debajo, «Ya tengo cuenta
   de entrenador» → `TrainerSyncModal` en su pantalla de recuperar. Con la cuenta
   hecha: `connectClientToCloud(clientId)` y paso 6 (Apple/Google) o 5 (código).
5. **Tu código personal** — solo con código, sin «Saltar». El código de 12 en
   grande, **Copiar** (`expo-clipboard`) y **Enviármelo** (`Share.share`), y la
   advertencia naranja (`sync.revealWarn`). «Ya lo he guardado» **no se activa
   hasta copiarlo o enviárselo**. Salida «Prefiero Google o Apple» → vuelve al 4.
6. **Ahora, el programa de {cliente}** — «Es suyo: lo empiezas aquí y lo sigues
   editando desde su ficha». Dos opciones y una salida:
   - **Crear su programa** (~3 min) → constructor en modo entrenador (§10). El
     programa **es del cliente** (`createProgramForClient`), no una plantilla: no
     hay paso de asignar, y no gasta la única plantilla gratis. Al terminar se
     envía (§10.1 paso 5).
   - **Partir de uno del catálogo** → lista de programas del catálogo (§7.7).
   - «Lo hago después» → paso 9 (sin invitación: §7.8). Con app, una línea lo
     avisa: «La invitación a {cliente} va después de darle programa: es lo primero
     que verá al meter el código».
7. **Asígnaselo a {cliente}** — solo desde el catálogo. Arriba la lista de
   `ARCHETYPES` (nombre, N sesiones · N semanas, letras); al elegir uno, la
   tarjeta del programa y, debajo, «Así lo verás en Clientes» con **la fila real
   de Clientes** (§22.1): avatar con su color, reloj de «esperando código» si es
   con app, «Sin programa» y «+ Programar». **Asignar** genera el programa para
   el cliente (`generateProgramForClient`, §24.3), lo activa y, con app, **lo
   envía**; la fila cambia delante de él («{programa} · Etapa 1» y cuadraditos),
   el botón pasa a «✓ Asignado» y avanza solo (~1,3 s).
8. **Invita a {cliente}** — **solo con app y con programa enviado**. Su código
   (`XXXX-XXXX`) en grande, «Copiar código» (secundario), la fila de Clientes con
   el reloj («En Clientes, hasta que lo meta») y **Enviar invitación** (lima) con
   `clients.codeCard.shareText` + `inviteUrl`. **Al volver de compartir avanza
   solo** si `Share.share` devuelve `sharedAction`; con `dismissedAction` (solo
   iOS) se queda. En Android siempre llega `sharedAction` y avanza aunque haya
   cancelado; no pasa nada, el código sigue en su ficha. Salida «Lo envío
   después».
9. **¿Y tú también entrenas?** — **Sí** → `profile.alsoTrains: true`, empalma con
   «por mi cuenta» desde el nivel (§8) y después Aprende completo. **No** →
   `profile.homeTab: 'Clients'` (la app arranca en Clientes; Inicio sigue estando)
   y Aprende solo con las tarjetas de entrenador (§11.4).
10. **Listo** (§11.5).

## 8. Camino «por mi cuenta»

1. **Nivel** — Empiezo (<6 meses) · Llevo un tiempo (6 meses-2 años) · Tengo
   experiencia (+2 años). Va a `answers.level` (`beginner`/`intermediate`/`advanced`, los de O01).
   Decide la recomendación y la profundidad del constructor.
2. **Plantilla o el mío**:
   - Principiante: titular «Te proponemos un programa hecho», «Ver programas para
     mí» (recomendado; «Según tu objetivo y tus días de entreno») y «Prefiero
     crearlo yo» como enlace.
   - Intermedio y avanzado: «¿Plantilla o el tuyo?», las dos tarjetas al mismo
     peso: «Ver programas para mí» y «Crear el mío» («Define sesiones,
     ejercicios y progresión»).
   - En los dos, un enlace «Tengo una copia de seguridad» → importar `.fitdata`
     (lo de `handlePickFile` + `ImportModal` de hoy); tras importar, Aprende.
3. **Plantilla** → **qué buscas** (cuatro baldosas con la palabra, sin emoji; los
   valores de `StepIdentity` de O01) → **días** (1-7; `answers.daysPerWeek`) →
   **preparando** → **propuestas** y **tu programa** de O01 con su hoja de ajustes,
   reutilizados (§20.2). **Preparando** (~1,5 s): «Buscando tu *programa*» y tres
   casillas que se marcan una a una (nivel, objetivo, días); luego entran las
   propuestas. Confirmar el programa (`generateAndActivateProgram`) lleva a
   Aprende.
   **El mío** → constructor (§10): principiante e intermedio en profundidad
   sencilla; avanzado, completa.
4. **Aprende** (§11) → **Listo**.

## 9. Camino «con entrenador»

1. **¿Tu entrenador usa Forma Fit?** (`profile.coachUsesApp`)
   - **Sí, tengo su código** — «Ocho letras y números, tipo XK7M-2P4T».
   - **Sí, pero no tengo código** → dónde lo saca (Clientes → tu ficha → Conectar)
     y un mensaje ya escrito con **Enviar mensaje** (`Share.share`; al volver
     **avanza solo** como en §7.8). «Lo meto más tarde» sigue a Aprende.
   - **No la usa** → **Invítale a la app** (mensaje con enlace a la web
     `WEB_URL`; «empezar es gratis», sin cifras) y **Copia su programa**
     («mientras tanto»): **Lo copio a mano** → constructor completo (§10);
     **Empiezo de uno parecido** → el camino de plantillas de §8 desde el nivel.
     Sin «pegar texto» (§15).
2. **El código** — `ui/CodeField` (8, `groups = 2`, guion solo, «Pegar»).
   «Continuar» → `validateClientCode(code)`; el error se enseña en la pantalla,
   con «Lo meto más tarde» como salida.
3. **Programa encontrado** — el paso «confirmar» de `ClientCodeModal` como
   pantalla: tarjeta con borde azul (azul = entrenador): «De {entrenador} ·
   {programa}» y sus letras si el hueco las trae. Debajo, «Qué pasa al conectar»
   con `trainer.codeImplies1-4` resumidos. Los avisos de hoy (`codeAlreadyLinked`,
   `codeSlotOccupied`) y, si hay historial en la nube, la elección
   `codeHistoryProgram` / `codeHistoryMerge`. **Conectar** →
   `linkToTrainer(code, { mergeHistory })`.
4. **Conectado con {entrenador}** — en el panel lima: «{programa} ya está en tu
   Inicio. {Entrenador} verá las sesiones que completes». Sin espera. «Siguiente»
   → Aprende.
5. **Por invitación** (`pendingInviteCode`, M01-04): la bienvenida lo dice (§5.1),
   los ajustes van igual y después **se salta la bifurcación y el paso 1**: el
   código viene puesto y `profile.role = 'coached'`. Al consumirlo,
   `clearPendingInviteCode()`.
6. **Aprende** (§11) → **Listo**.

## 10. El constructor guiado

Un solo constructor, en tres sitios: el programa del cliente (§7.6, modo
`trainer`), «crear el mío» (§8, modo `self`) y «lo copio a mano» (§9, modo
`copy`). **Cambia la profundidad, no las pantallas.** Que vea cómo es el
proceso, que sienta que invierte tiempo en algo suyo, que vea todas las opciones
y que ninguna se sienta obligatoria.

**Crea el programa de verdad** al salir del paso 1, y los pasos siguientes editan
ese programa con las acciones del store. Lo aprendido aquí es literalmente lo que
verá después en el editor.

### 10.1 Los pasos

```
1 Sesiones → 2 Un ejercicio → 3 Volumen → 4 «Ya tiene forma»
```

1. **Sesiones** — `NumberChips` 1-6; las tarjetas A, B, C… aparecen al momento.
   Son las sesiones de cada semana: **no hay campo de días aparte**. Si se
   contestaron los días antes, vienen puestas. Titular: «¿Cuántas sesiones por
   semana?» (entrenador) / «¿Cuántos días vas a entrenar?» (resto).
2. **Un ejercicio en la sesión A** — «+ Añadir ejercicio» (resaltado que late)
   abre **el buscador en corto** dentro de la tarjeta de la sesión: campo
   «Buscar ejercicio» y filas «nombre · grupo · material» sobre la biblioteca real
   (`exerciseLibrary` + `customExercises`), con `filterBySearch`. Sin escribir,
   cinco sugeridos según profundidad (§10.3); al escribir, los seis primeros con
   lo buscado en lima y el total; sin resultados, «＋ Crear "{lo escrito}"».
   Mientras busca se ocultan la línea del titular y el botón. B, C… se ven
   vacías, con «después». **Fuera**: pills de patrón, hoja de filtros, selección
   múltiple.
3. **Volumen** (§10.3).
4. **Ya tiene forma** — nombre editable con uno puesto («Mi programa» /
   «Programa de {cliente}»).
   - `self` y `copy`: lo construido (A con su ejercicio, el resto vacías) y la nota
     «Sigue editándolo cuando termines: Programa → {nombre}». **Guardar** → Aprende.
   - `trainer`: «Así lo verás en Clientes» con **la fila real** del cliente ya con
     el programa, y la nota «Las sesiones B y C están vacías. Rellénalas en
     Clientes → {cliente}: cada cambio le llega con «↑ Enviar»». Botón **«Guardar
     y enviar a {cliente}»** (con app: `uploadProgramToClient`) o «Guardar».
     Sigue a invitar (§7.8) o a «¿también entrenas?».

**La sensación de construir**: arriba, una barra con tres fichas que se
encienden — «✓ 4 sesiones · ✓ Press banca · ✓ 3×8-12».

**Sin paso de progresión** (decisión del usuario, 14-oct-2026: demasiado complejo
para un onboarding). El ejercicio se queda con la progresión que trae de la
biblioteca (`addExercise` no la toca: `progressionOverride: null`), y la nota de
«Ya tiene forma» dice dónde cambiarla. §10.4 y §10.5 quedan como diseño aparcado.

**Nunca obligatorio**: «Lo termino después» en cada paso y «Saltar» arriba salen
guardando lo que haya (al menos las sesiones vacías). En modo `trainer` sin ningún
ejercicio, el programa queda en su ficha **sin enviar** y sin invitación.

### 10.2 Lo que se reutiliza

- Volumen: los campos de `editor/ExerciseEditorInline.jsx`, sobre el ejercicio
  real.
- Buscador: `filterBySearch` y la misma fila que `ExerciseSelectorScreen`.
- Crear el programa: `createEmptyProgram` (self/copy) y `createProgramForClient`
  (trainer). Ejercicio: `addExercise`, `replaceExercise`, `addCustomExercise`.
  Sesiones: `addSessionToProgram`, `removeSessionFromProgram`. Nombre:
  `renameProgram`.
- El volumen sencillo (tres opciones con nombre) es la única pieza propia.

### 10.3 Las dos profundidades

| | Sencilla (principiante · intermedio) | Completa (avanzado · entrenador · copiar) |
|---|---|---|
| Sugeridos | Sentadilla goblet, Press de banca con mancuernas, Remo en polea, Prensa (pies centrados), Jalón al pecho | Sentadilla con barra, Press de banca con barra, Peso muerto convencional, Dominadas, Press militar con barra |
| Volumen | tres opciones con nombre — **Fuerza · 5 / Músculo · 10 / Resistencia · 15** (reps fijas) — y el nº de series | series, reps mín-máx y descanso, como en el editor |

### 10.4 La pregunta del principiante (aparcada, 14-oct)

«¿Quieres que la app te diga cuándo subir o bajar el peso?» — según cómo te salgan
las series.

- **Sí, guíame** (recomendado) — con un ejemplo con sus números («Si completas
  3×10 con 40 kg, la próxima vez te propondremos 42,5. Si no las completas, menos»; la
  unidad, la suya) → progresión por peso, por reglas.
- **No, lo decido yo** — «Verás lo que hiciste la última vez y tú eliges el peso»
  → sin progresión.

Debajo, **«Ver todas las opciones de progresión →»** abre el editor completo en el
sitio.

### 10.5 El editor completo (aparcado, 14-oct)

Los pasos de `ProgressionSheet`, con **la regla escrita en una frase arriba** que
cambia con cada toque: Qué sube (Peso · Reps · Nada) → Cómo (Por reglas · Por
esfuerzo; por esfuerzo exige reps fijas: si había rango, se avisa y se pasa al
mínimo, `effortNeedsFixed`) → Cuándo sube (reglas) o RPE objetivo (esfuerzo) →
Cuándo baja. Después, **«Y si quieres más · todo opcional»**: interruptores de
calentamiento, dropset en la última serie, superserie con el siguiente y vincular
con otras sesiones. Los textos ya existen en `exerciseEditor.*`.

## 11. Aprende y Listo

### 11.1 Real frente a simulado

Las tarjetas son **simuladas**: mini-pantalla, un elemento resaltado que late
(lima; azul si es del entrenador) y un círculo donde tocar. 3-4 por camino, con
puntos de progreso, Anterior/Siguiente, saltables. **Mini-pantallas fieles donde
va a vivir**: la vista de Inicio elegida y la fila de Clientes; plantillas,
próxima sesión y sesión libre, como esquemas.

### 11.2 Cómo ves Inicio

Solo quien entrena. «¿Cómo quieres ver tus *sesiones*?» — «Así será tu Inicio. Se
cambia en Preferencias». **Las dos opciones lado a lado**, cada una con su dibujo:
**Lista** (`homeView: 'cards'`, por defecto) y **Pestañas** (`'tabs'`, U13), cuyas
pestañas se tocan en el dibujo. Con entrenador conectado, «Pestañas» lleva «Para
tu caso». Los nombres de sesión son los de su programa si ya lo tiene.

### 11.3 Cómo apuntas una serie

Una fila de serie (S1 · peso · reps) que **se arrastra de verdad a los lados**, y
dos tarjetas:

- **Con regla** — «Sale una regla bajo el dedo y se guarda al soltar. Más
  preciso.» La casilla no cambia durante el gesto; una burbuja enseña el valor.
- **Solo deslizar** — «La cifra cambia en la casilla mientras arrastras. Más
  rápido.» Chevrones y borde lima.

Cambiar de tarjeta cambia cómo responde la fila. «Me quedo con este» guarda
`profile.scrubRuler`.

### 11.4 Las tarjetas

**Por mi cuenta, con entrenador sin conectar y entrenador que también entrena**:
1. *(solo entrenador)* **Tus clientes, de un vistazo** — como abajo.
2. **Tu sesión de hoy, en Inicio** — la vista elegida, con Empezar resaltado.
3. **Cambia lo que quieras** — Programa → ejercicios, series, progresión.
4. **¿Hoy algo distinto? Sesión libre** — el «+»; cuenta o no como sesión.

**Con entrenador conectado**: la 3 es **«{Entrenador} ve tus entrenos»** (aviso
azul de programa cambiado y una sesión hecha «la verá»); «Cambia lo que quieras»
no sale. La 4 añade que su entrenador también ve las libres.

**Entrenador que no entrena**:
1. **Tus clientes, de un vistazo** — **filas reales de Clientes**: el cliente que
   acaba de crear arriba (con su reloj si es con app) y tres de ejemplo: uno al día
   con cuadraditos y la muesca de sesiones sin revisar, uno «Sin entrenar» en rojo
   y uno «Cambios sin enviar» en azul con «↑ Enviar».
2. **Plantillas: programa una vez** — «Cuando el programa de {cliente} te sirva
   para otros, guárdalo como plantilla y asígnalo. Cada uno recibe su copia y
   avanza a su ritmo» (C07-03).
3. **Ajusta su próxima sesión** — desde la ficha, sin tocar el programa.
4. *(solo si su cliente es «le apuntas tú»)* **Apunta tú sus sesiones** —
   «Registrar sesión» o pegar el texto de WhatsApp (C05).

Las mini-pantallas usan lo creado (nombre del programa, del cliente, unidad, vista
de Inicio).

### 11.5 Listo

«Todo *listo*», «Lo que falta lo retomas cuando quieras» y la lista de lo hecho (✓)
y lo pendiente (círculo vacío), **cada pendiente con dónde se retoma**. Ejemplos:

- Entrenador: «Cliente: Ana · con la app» · «Cuenta de Google» / «Código personal
  guardado · Menú → Sincronización» · «"Programa de Ana" creado y enviado» ·
  «Rellenar las sesiones B, C y enviárselas · Clientes → Ana» · «Esperando a que
  Ana meta su código». Sin programa: «Darle un programa · Clientes → Ana» e
  «Invitar a Ana, cuando tenga programa».
- Con entrenador conectado: «Conectado con Marta» · «"{programa}" en tu Inicio».
- Sin conectar: «Conectar con tu entrenador · Menú → Entrenador».
- Por mi cuenta: «"Mi programa" creado» · «Rellenar las sesiones B, C · Programa».

Panel lima: «A entrenar» o «Tus clientes te esperan» e **Ir a la app** (§16.4).

## 12. Ya tengo cuenta (versión mínima)

«Recupera lo *tuyo*» — «¿Qué tenías en el otro móvil?». Tres entradas, cada una
abre lo que la app ya tiene:

- **Mi cuenta de entrenador** — «Con Apple, Google o tu código de 12. Vuelven tus
  clientes» → `TrainerSyncModal` en su pantalla de recuperar.
- **Entreno con un entrenador** — «Con la cuenta que vinculaste. Vuelve tu
  programa» → `ClientCodeModal` con `startWithSocial`.
- **Una copia de seguridad** — «De Google Drive o un archivo .fitdata» →
  `DriveBackupScreen` o el selector de archivo.

Nota azul: «¿Entrenabas con un entrenador y no vinculaste cuenta? Pídele un código
nuevo: tu historial se conserva». Pro vuelve con la misma cuenta o con
«Restaurar compras» del paywall. Si la recuperación sale bien, se marca el
onboarding como hecho y se va a la app; si se cancela, se vuelve aquí.

Aparcado (§26.1): un solo login que lo busque todo y la pantalla «Esto es lo que
había».

## 13. Monetización dentro del onboarding

**Sin paywall en el onboarding.** Si el entrenador dice que lleva clientes, una
línea informativa: «Empiezas gratis con 3 clientes (1 con la app) y 1 plantilla.
Cuando necesites más, Pro quita el límite». Sin botón de compra. El paywall salta
donde dice M01, al pasarse del límite.

- El primer cliente «con la app» gasta el único hueco con app; no se avisa aquí.
- El programa del cliente **no gasta** la plantilla gratis (es un programa, no
  una plantilla).
- Si M01 acaba con prueba gratis, la línea cambia a «prueba Pro N días».

## 14. Datos que se recogen

| Dato | Dónde | Para qué |
|---|---|---|
| rol | `profile.role` (nuevo) | pestañas, camino |
| ¿también entrena? | `profile.alsoTrains` (nuevo) | pestaña de entrada, Aprende |
| pestaña de entrada | `profile.homeTab` (nuevo: `'Home'` · `'Clients'`) | `RootNavigator` |
| nivel | `profile.onboardingAnswers` (existe) | recomendación, profundidad |
| nº de clientes | `profile.trainerClientsBand` (nuevo) | dato |
| clases en grupo | `profile.trainerGroups` (nuevo) | dato |
| ¿su entrenador usa la app? | `profile.coachUsesApp` (nuevo) | dato |
| cómo entrena su primer cliente | `client.syncSlotId` (existe) | dato |
| modo de cuenta | `trainerSync.mode` (existe) | dato |
| vista de Inicio | `profile.homeView` (existe) | preferencia |
| regla al deslizar | `profile.scrubRuler` (existe) | preferencia |

En local desde el principio. Para que lleguen hace falta [A01](A01-analitica.md);
sus eventos de onboarding (A01 §5) se rehacen sobre este recorrido (A01-02).

## 15. Decisiones

Todas tomadas; no queda nada abierto.

- Bifurcación por situación, no por identidad (§6).
- El entrenador que entrena empalma con «por mi cuenta» (§7.9).
- Regla/deslizar es una práctica, en Aprende (§11.3).
- Hacer = real, explicar = simulado (§11.1).
- Un constructor único con dos profundidades (§10).
- Sin paywall en el onboarding (§13).
- *(12-oct)* Estilo del paywall con menos adornos (§3.1). Grupos solo como dato.
  Cliente nuevo con «¿Cómo va a entrenar?» y cuenta justo después. Con código, sin
  espera. Buscador corto en el constructor.
- *(13-oct)* **Idioma en la bienvenida**, con el del móvil (§5.2).
- *(13-oct)* **«Ya tengo cuenta» en versión mínima** (§12); lo completo, aparcado
  (§26.1).
- *(13-oct)* **El código personal bloquea el botón** hasta copiarlo o enviárselo,
  aquí y en `TrainerSyncModal` (§24).
- *(13-oct)* **Entrenador: preguntas de datos primero**, luego cliente, cuenta y
  programa (§7).
- *(13-oct)* **Intermedio = constructor sencillo** con el enlace a todas las
  opciones (§10.3).
- *(13-oct)* **El entrenador monta el programa del cliente, no una plantilla**
  (§7.6). Asignar queda para el catálogo. Desaparece la pregunta de «plantilla a
  medias asignada».
- *(13-oct)* **Guardar o asignar envía; sin programa no hay invitación** (§7.7-7.8).
- *(13-oct)* **Compartir avanza solo** al volver (§7.8, §9.1).
- *(13-oct)* **Fuera**: pegar el programa entero del entrenador (el analizador de
  C05-05 solo entiende sesiones sueltas) y que el entrenador adopte el programa
  copiado.
- *(13-oct)* **Rol**: `self`/`coached` ocultan las pestañas de entrenador; el
  entrenador que no entrena arranca en Clientes y conserva Inicio (§6, §7.9).
- *(13-oct)* **Re-entrada**: «Nuevo programa» entra por el mismo recorrido, por
  otra puerta: sin Ajustes, bifurcación ni Aprende, con las cinco salidas del
  selector de hoy y un cierre corto (§25). `OnboardingScreen` se borra. (La
  primera versión de esta spec decía que «Nuevo programa» seguía abriendo
  `OnboardingScreen` con `fromApp`; esa ruta no existe: nadie pasa `fromApp`.)

## 16. Arquitectura común

Esta sección es **obligatoria para todas las tareas**: fija los nombres, los
ficheros y los contratos para que las tareas se puedan hacer en paralelo sin
pisarse.

### 16.1 Ficheros

```
src/screens/onboarding/OnboardingFlowScreen.jsx   ruta 'Start': cabecera + pantalla actual + transición
src/screens/onboarding/screens/common.jsx         bienvenida, unidades, tema, bifurcación, listo   (O03-01)
src/screens/onboarding/screens/builder.jsx        b_sessions … b_done                               (O03-02, 03)
src/screens/onboarding/screens/self.jsx           s_level … s_props                                 (O03-04)
src/screens/onboarding/screens/coached.jsx        c_app … c_linked                                  (O03-05)
src/screens/onboarding/screens/learn.jsx          a_home, a_input, a_cards                          (O03-06)
src/screens/onboarding/screens/recover.jsx        recover                                           (O03-07)
src/screens/onboarding/screens/trainer.jsx        t_clients … t_self                                (O03-08)
src/screens/onboarding/screens/newProgram.jsx     n_source, n_templates, n_done                     (O03-11)
src/components/onboarding/flow/                   piezas de estilo (§16.5)                          (O03-01)
src/utils/onboardingFlow.js (+ .test.js)          tramos, progreso, saltos y rutas condicionales     (O03-01, cada tarea añade lo suyo)
```

`OnboardingFlowScreen` pinta la pantalla por su id con un registro
`SCREENS = { ...commonScreens, ...builderScreens, ... }`: cada fichero de
`screens/` exporta su objeto `{ id: Component }`. **Cada tarea solo toca su
fichero** (más los compartidos que su sección diga).

### 16.2 El estado del recorrido

En el store, clave nueva **`onboardingFlow`**, persistida (añadirla a
`partialize`, `store/useStore.js`):

```js
onboardingFlow: null | {
  screen: 'welcome',          // id de la pantalla actual
  history: [],                // ids anteriores, para «atrás»
  entry: 'first',             // 'first' (primer arranque) | 'newProgram' (desde la app, §25)
  answers: {                  // todo lo contestado; nada se borra al volver
    langTouched: false,
    viaInvite: false,         // llegó por forma://join
    role: null,               // 'self' | 'coached' | 'trainer'
    level: null, goal: null, days: null, path: null,          // por mi cuenta
    coachApp: null,           // 'code' | 'nocode' | 'no'
    linked: null,             // { trainerName, programName } al conectar
    clientsBand: null, groups: null,                          // entrenador
    clientId: null, clientMode: null,   // 'app' | 'self'
    account: null,            // 'apple' | 'google' | 'code'
    codeSaved: false,
    programId: null,          // el programa creado o asignado en el recorrido
    programSource: null,      // 'builder' | 'catalog' | 'proposal' | 'import' | 'coach'
    sent: false,              // el programa del cliente se envió
    builderCtx: null,         // 'self' | 'trainer' | 'copy'
    alsoTrains: null,
  },
  done: [],                   // [{ key, ok, label }] para «Listo» (§11.5)
}
```

Acciones nuevas: `startOnboardingFlow({ entry = 'first' })`, `flowGo(id)`, `flowBack()`,
`flowAnswer(patch)`, `flowDone(item)` (sustituye por `key`), `finishOnboardingFlow()`.
`flowGo` empuja la actual a `history`; `flowBack` la saca. El atrás de Android
(`BackHandler`) llama a `flowBack`; en la bienvenida, el comportamiento por
defecto.

### 16.3 `src/utils/onboardingFlow.js`

Puro y con test (vitest). Exporta:

- `SECTIONS = ['settings', 'you', 'setup', 'learn']` y `sectionOf(id)` (−1 =
  sin barra: bienvenida y recuperar; 4 = completado: listo).
- `sectionProgress(id, history, answers)` → 0-1 dentro del tramo: pantallas del
  tramo vistas / total esperado del tramo según las respuestas (la maqueta,
  `secTotal`, es la referencia).
- `skipTarget(id, answers)` → adónde lleva «Saltar», o `null` si no se puede
  (bifurcación, cuenta, código personal).
- Las rutas condicionales: `afterSettings(a)` (invitación → `c_code`; si no,
  `role`), `afterProgram(a)` (entrenador: con app y `sent` → `t_invite`; si no,
  `t_self`), `builderExit(a, entry)` (`newProgram` → `n_done`; `trainer` →
  `afterProgram`; resto → `a_home`), `afterProposal(entry)` (`newProgram` →
  `n_done`; si no, `a_home`),
  `learnStart(a)` (entrenador que no entrena → `a_cards`; resto → `a_home`).
- `deviceLanguage(locale)` → `'en'` si empieza por `en`, si no `'es'`.

Cada tarea añade sus ids y sus casos al test. Test mínimo de O03-01: la
invitación se salta la bifurcación; saltar Ajustes cae en la bifurcación; la
bifurcación no se puede saltar; el progreso no baja al avanzar.

### 16.4 Entrada, salida y rutas

- **Ruta inicial** (`store/useStore.js`, en `onRehydrateStorage`, donde hoy se
  calcula `_initialRoute`): `'Start'` si hay `onboardingFlow` en curso con
  `entry: 'first'` **o** si
  no hay `onboardingCompleted` ni programa activo; si no, lo de hoy (`'Workout'`
  si hay sesión a medias, `'Main'`). Un programa creado a mitad del recorrido
  (el constructor, las propuestas) no corta el recorrido.
- **`RootNavigator`**: ruta `Start` → `OnboardingFlowScreen`; fuera la ruta
  `Setup`, su `case 'setup'` de `navigationRef.js` y `SetupScreen.jsx` (se
  borra). `Onboarding` se queda hasta O03-11, que la borra.
  El guardia de la invitación (que no navega en `Setup`/`Onboarding`) añade
  `Start`.
- **`finishOnboardingFlow()`** («Ir a la app» de Listo y cualquier salida
  temprana): `profile.onboardingCompleted = true`, `profile.setupComplete = true`,
  `onboardingFlow = null`, y `navigation.replace('Main')`.

### 16.5 Las piezas de estilo (`src/components/onboarding/flow/`)

| Pieza | Qué es | De dónde sale |
|---|---|---|
| `FlowHeader` | atrás · tramo «· N de 4» · Saltar; barra de cuatro tramos que anima su ancho (Reanimated) desde el anterior | maqueta `.top` |
| `FlowTitle` | titular `heroGlyph` con `Marked`; sin `*` marca la última palabra; >34 caracteres baja de escalón | §3.1.1 |
| `FlowOption` | tarjeta con círculo de selección y relleno lima desde el círculo (450 ms, out cubic); `onPick` tras ~520 ms si avanza sola; variante «›» para las que llevan a otro sitio | `PlanTicket` del paywall, U13-02 |
| `FlowTile` | baldosa grande (unidades, qué buscas) con el mismo relleno | maqueta `.tile` |
| `FlowFooter` | pie fijo con la acción lima y las secundarias | §3.1.4 |
| `FlowPanel` | panel lima de cierre (radio 40, degradado accent→green) | panel de `PaywallModal` |
| `FlowNote` | nota (`acc` lima, `blue` entrenador, `warn` naranja) | maqueta `.note` |

Entrada por partes con `Rise` + `useEnterClock`. Transición entre pantallas: 18 px
de desplazamiento, 260 ms, out cubic (a la izquierda al volver). Reanimated, no
`Animated` de RN.

### 16.6 Reglas de la casa (para todos los subagentes)

- Leer `mobile/AGENTS.md` y `docs/UI-MIGRATION.md`. **Roles de `textStyles`**,
  nunca `fontSize`/`fontWeight`/`letterSpacing` propios. Colores y radios de
  `useTheme()`; solo se toca el tema `formaFit` si hiciera falta.
- **Tono**: los textos suenan a app, no a colega: cortos, claros, con el verbo de
  lo que pasa. Amigable sí («Ahora, el programa de Ana»); términos demasiado
  coloquiales no («montar», «a tu aire», «a por»). Las acciones del usuario, en
  primera persona («Prefiero crearlo yo», «Lo hago después»). Los de esta spec ya
  están escritos así; si hace falta uno nuevo, el modelo son las opciones de §25.2.
- **i18n**: todo texto visible en `src/locales/es.json` **y** `en.json`, bajo
  `onboardingFlow.<área>` (`common`, `builder`, `self`, `coached`, `learn`,
  `recover`, `trainer`, `done`). O03-01 deja creadas todas las áreas. Las claves
  se añaden **línea a línea con Edit**, nunca reescribiendo el JSON.
- Fuentes custom en Android: nunca `fontFamily` custom junto a `fontWeight`.
- `FlatList`: nunca `ListHeaderComponent={() => …}`.
- Navegación RN7: `navigate('Main')` desde una pantalla apilada duplica; usar
  `replace`/`popTo`.
- Verificación: `npx eslint <ficheros tocados>` (no añadir errores respecto a
  HEAD) y `npx vitest run` desde la raíz del repo. `npm run estado` tras tocar la
  spec.
- Al cerrar la tarea: su línea de cabecera a `hecho`, su fila de `## Fases` con el
  commit, sus casillas **Probar** ya escritas aquí (se pueden afinar), `Inicio`
  en la cabecera si es la primera, y `npm run estado`.

## 17. O03-01 — Armazón del recorrido y tramo común

**Depende de**: nada. **Ola 1, sola** (todo lo demás cuelga de aquí).

Hace:

1. **Estado y util**: §16.2 y §16.3 enteros, con su test.
2. **Pantalla y navegación**: `OnboardingFlowScreen` con el registro de §16.1,
   cabecera, transición y `BackHandler`; ruta `Start`, ruta inicial, borrado de
   `SetupScreen` (§16.4). Los ficheros de `screens/` de las demás tareas se
   crean **vacíos** (`export default {}`) para que nadie tenga que tocar el
   registro.
3. **Piezas** de §16.5.
4. **Pantallas**: bienvenida con idioma (§5.1-5.2), unidades (§5.3), tema (§5.4),
   bifurcación (§6, con `profile.role` y `proTabsHidden`) y **Listo** genérico
   (§11.5): pinta `onboardingFlow.done` y el panel, y llama a
   `finishOnboardingFlow`.
5. **Provisional hasta que lleguen los caminos**: cada tarjeta de la bifurcación,
   si su primera pantalla aún no está en el registro, termina el recorrido y
   abre lo de hoy: «Por mi cuenta» → `Onboarding` (selector viejo, sin
   `fromApp`); «Con un entrenador» → `Onboarding` con la hoja del código abierta;
   «Soy entrenador/a» → `Main`. «Ya tengo cuenta», igual de provisional:
   `Onboarding`. Así la app sigue usable entre olas.
6. **Invitación**: si al montar hay `pendingInviteCode`, `answers.viaInvite = true`
   y la bienvenida enseña la línea azul (§5.1).
7. Las áreas de i18n de §16.6, vacías salvo `common` y `done`.

Fuera: todo lo que no es tramo común.

**Lo que dejó hecho** (para las tareas que cuelgan de aquí):

- **Pantallas**: cada una recibe `goTo(id)`. Si `id` aún no está en el registro,
  `goTo` hace la salida provisional (prefijo `t_` → la app; `c_` → el selector
  viejo con la hoja del código, vía el parámetro `openCode` de `Onboarding`; el
  resto → el selector viejo). Al registrar su primera pantalla, un camino quita
  su provisional **sin tocar nada**: basta que `SCREENS[id]` exista.
- **Salida**: `finishOnboardingFlow()` hace lo de §16.4 y navega con `navigateTo('home')`
  (reset si `Main` no está en la pila, `pop` si lo está: sirve para el `Start` apilado
  de O03-11). `finishOnboardingFlow({ route, params })` es solo el provisional:
  cierra el recorrido y resetea la pila a esa ruta **sin** marcar `onboardingCompleted`.
- **Ruta inicial**: la calcula `initialRouteFor` (util, con test). El recorrido
  nace al hidratar (`newFlow('first')`), no al montar `Start`.
- **Valores de `answers`** que las rutas dan por hechos (cabecera de `onboardingFlow.js`):
  `path` `'own'|'template'`, `coachApp` `'code'|'nocode'|'no'`, `alsoTrains` booleano,
  `programSource` `'builder'|'catalog'|'proposal'|'import'|'coach'`.
- **Piezas** (`components/onboarding/flow/`): además de las de §16.5, `FlowBody` (scroll +
  pie + reloj de la entrada por partes; **cada pantalla es un `FlowBody`**),
  `PanelButton` (botón del panel lima) y `useFill`. Opciones y baldosas aceptan `index`
  (su turno en la entrada) y se meten dentro de `FlowBody`; `FlowTitle` ocupa los turnos
  0 y 1. El relleno es una vista que escala bajo `overflow: hidden`, no SVG.
- **Tipografía**: la bienvenida usa `heroGlyph` (34), no los 52 de la maqueta: ningún rol
  pasa de 34 y la regla es no inventar `fontSize`.
- **ESLint**: `eslint.config.js` apaga `react-refresh/only-export-components` en
  `screens/onboarding/screens/*.jsx` (cada fichero exporta su registro).

**Probar O03-01**

- [ ] Instalación limpia (borrar datos de la app): abre en la bienvenida, no en
  `SetupScreen`. Con el móvil en inglés, la bienvenida sale en inglés y ES/EN la
  cambia al momento.
- [ ] Empezar → Unidades: tocar «lb» rellena la baldosa de lima desde el centro
  y avanza sola; la barra de «Ajustes» crece con animación.
- [ ] Tema: tocar Midnight repinta todo el teléfono al instante; «Siguiente» lleva
  a «¿Cómo entrenas?».
- [ ] «¿Cómo entrenas?» no tiene «Saltar». «Saltar» en Unidades lleva directo a
  la bifurcación.
- [ ] Atrás (flecha y botón físico de Android) vuelve pantalla a pantalla con lo
  contestado marcado.
- [ ] «Por mi cuenta» (provisional) abre el selector de siempre; al terminar allí,
  la app ya no vuelve a la bienvenida al reabrirla. Las pestañas de entrenador no
  se ven.
- [ ] «Con un entrenador» (provisional) abre el selector de siempre con la hoja
  del código ya abierta; las pestañas de entrenador no se ven.
- [ ] «Ya tengo cuenta» (provisional) abre el selector de siempre.
- [ ] «Soy entrenador/a» (provisional) entra en la app con las pestañas de
  entrenador visibles.
- [ ] Matar la app en «Tema» y reabrir: vuelve a «Tema».
- [ ] Abrir un enlace `forma://join/XXXX-XXXX` con la app recién instalada: la
  bienvenida enseña la línea azul de la invitación.
- [ ] Usuario existente (con programa) que actualiza: entra en la app como
  siempre, sin onboarding.

## 18. O03-02 — Constructor guiado I: sesiones, buscador corto y «ya tiene forma»

**Depende de**: O03-01. **Ola 2**, en paralelo con O03-05 y O03-06.

Hace, en `screens/builder.jsx`:

1. `startBuilder(ctx)` (exportada para los caminos): guarda `builderCtx` y va a
   `b_sessions`. La profundidad sale de `ctx` y de `answers.level` (§10.3).
2. **b_sessions** (§10.1.1) con `NumberChips` y las tarjetas que aparecen. Al
   «Siguiente» la primera vez **crea el programa**:
   - `self`/`copy`: `createEmptyProgram(n, nombre)` (lo activa).
   - `trainer`: `createProgramForClient(clientId, n, nombre)` +
     `setClientActiveProgram(clientId, id)`. **Cambio en el store**:
     `createProgramForClient` gana un quinto parámetro `{ openEditor = true }`;
     con `false` no toca `ui._editingProgramId` ni llama a
     `navigate('programEditor')`. Su llamada de `ClientsScreen` no cambia.
   - Volver y cambiar el número: añade o quita sesiones vacías del final
     (`addSessionToProgram` / `removeSessionFromProgram`), sin recrear.
   - Guarda `answers.programId`.
3. **b_exercise** (§10.1.2): el buscador corto, con `filterBySearch` sobre
   `exerciseLibrary` + `customExercises`, sugeridos por profundidad, «Crear» con
   `addCustomExercise` (mismo formato de ejercicio propio que
   `ExerciseSelectorScreen`) y `addExercise` en la sesión A. Elegir otro
   sustituye (`replaceExercise`).
4. **b_done** (§10.1.5) en sus dos variantes. La variante `trainer` usa la fila
   de Clientes: si O03-06 aún no la ha extraído (§22.1), un hueco con el nombre y
   «{programa} · Etapa 1» que se cambia por la fila real al fusionar. «Guardar y
   enviar» llama a `uploadProgramToClient` si el cliente tiene `syncSlotId`, y
   marca `answers.sent`.
5. La **barra de fichas** (§10.1) y «Lo termino después» / «Saltar» →
   `builderExit` (§16.3). Mientras O03-03 no esté, b_exercise salta a b_done.
6. `flowDone` con el programa creado y, si quedan sesiones vacías, el pendiente
   «Rellenar las sesiones B, C…» (§11.5).

**Probar O03-02**

- [ ] (Desde el mapa provisional o con O03-04 hecho) «Crear el mío» → elegir 4:
  aparecen A-D al momento. Siguiente, atrás, elegir 2: al terminar el programa
  tiene 2 sesiones, no 6.
- [ ] «+ Añadir ejercicio» → sin escribir salen cinco sugeridos; escribir «press»
  filtra con «press» en lima y el total; «zzz» ofrece «＋ Crear "zzz"».
- [ ] Buscar «sentadilla» sin tilde encuentra «Sentadilla goblet».
- [ ] Tras «Guardar», Programa enseña el programa con A y su ejercicio y B, C
  vacías.
- [ ] «Lo termino después» en el paso 1 con 3 elegidas deja un programa con 3
  sesiones vacías y sigue el recorrido.
- [ ] Entrenador (con O03-08): el programa aparece en la ficha del cliente, no en
  Programas del entrenador ni en sus plantillas; no se abre el editor.
- [ ] Entrenador (con O03-08): «Lo termino después» sin ningún ejercicio no
  envía; con uno y cliente con app, sí. Sin red, sale igual y queda sin enviar.
- [ ] «Cambiar» el ejercicio lo sustituye (no se duplica); cerrar el buscador
  con la ✕ sin elegir deja la sesión A como estaba.

## 19. O03-03 — Constructor guiado II: volumen

**Depende de**: O03-02. **Ola 3**, en paralelo con O03-04 y O03-07.

Hace, en `screens/builder.jsx`:

1. **b_volume** (§10.3): sencilla (tres opciones con nombre, reps fijas + series)
   y completa (series, mín-máx, descanso), escribiendo con
   `updateExerciseParams` sobre el ejercicio de la sesión A. Reutilizar los
   campos de `ExerciseEditorInline`; si no se pueden sacar sin arrastrar el editor
   entero, extraer los campos a un componente compartido que usen los dos.
2. **Sin `b_prog`** (§10.1): `b_exercise` sigue a `b_volume` (la constante
   `AFTER_EXERCISE` de `builder.jsx`) y `b_volume` a `b_done`. La barra de fichas
   pasa a tres: quitar la de progresión y encender la de volumen («3×8-12»).
   Quitar de `onboardingFlow.js` el id `b_prog` (tramo y `skipTarget`). La nota
   de «Ya tiene forma» (`self`/`copy`) añade que la progresión se cambia en el
   editor: «Sigue editándolo cuando termines: Programa → {nombre}. Ahí cambias
   también cómo progresa cada ejercicio».
3. **«Saltar» en b_sessions** (pendiente de O03-02): si hay un número elegido y
   aún no hay programa, «Saltar» tiene que crearlo igual que «Siguiente» y «Lo
   termino después» (§10.1 «Nunca obligatorio»). Elegir la forma más simple:
   crear el programa al elegir el número (y ajustarlo después con las sesiones
   del final) o un gancho de salida del constructor.

**Probar O03-03**

- [ ] Principiante: Volumen enseña «Fuerza · 5 / Músculo · 10 / Resistencia · 15»
  y series; sin rangos ni descanso.
- [ ] Avanzado: series, reps mín-máx y descanso; cambiar 3×8-12 a 4×6-8 y, en el
  editor, el ejercicio tiene 4×6-8 y ese descanso.
- [ ] No hay paso de progresión: de Volumen se pasa a «Ya tiene forma», y la barra
  de arriba tiene tres fichas, todas encendidas.
- [ ] Elegir 3 sesiones y pulsar «Saltar» sin «Siguiente»: el programa existe con
  3 sesiones vacías.

## 20. O03-04 — Camino «por mi cuenta»

**Depende de**: O03-02 (para «el mío»). **Ola 3**.

Hace, en `screens/self.jsx`:

1. **s_level**, **s_choice** (dos variantes, §8.2), **s_goal**, **s_days**,
   **s_props** (preparando + propuestas + tu programa) como en §8.
2. **Extracción de O01**: `ProposalCard`, la vista «tu programa» con
   `AdjustSheet`/`AdaptationPanel` y lo que necesiten (`StatsRow`, `Pips`,
   `SessionRow`, `proposalNote`, `computeAdjustments`…) salen de
   `OnboardingScreen.jsx` a `src/components/onboarding/` para que los usen las
   dos pantallas. `OnboardingScreen` **sigue igual** para el usuario hasta que
   O03-11 lo borre.
   Confirmar → `generateAndActivateProgram(answers, archetypeId)`.
3. «Tengo una copia de seguridad» → importar `.fitdata` (lo de `handlePickFile`
   + `ImportModal`), y a Aprende.
4. Entrada desde «¿también entrenas?» (O03-08) y desde «Empiezo de uno parecido»
   (O03-05): la misma `s_level`.
5. Quitar el provisional de «Por mi cuenta» de O03-01. `flowDone` con lo creado.

**Probar O03-04**

- [ ] Principiante → «Te proponemos un programa hecho» con «Ver programas para
  mí» recomendado y «Prefiero crearlo yo» como enlace.
- [ ] Avanzado → «¿Plantilla o el tuyo?» con las dos al mismo peso.
- [ ] Plantilla: qué buscas → días → «Buscando tu programa» marca tres casillas
  con lo contestado y entran tres propuestas.
- [ ] Elegir propuesta → tu programa con su hoja de ajustes; confirmar → Aprende;
  en la app, ese programa activo.
- [ ] «Tengo una copia de seguridad» importa un `.fitdata` y sigue.
- [ ] Desde la app, «Nuevo programa» abre el selector de siempre y sus propuestas
  funcionan igual que antes.

## 21. O03-05 — Camino «con entrenador»

**Depende de**: O03-01. **Ola 2**.

Hace, en `screens/coached.jsx`:

1. **c_app** (§9.1), **c_ask** (mensaje + compartir que avanza solo), **c_noapp**
   (invitar + copiar), **c_copy** (a mano → `startBuilder('copy')`; parecido →
   `s_level`).
2. **c_code**, **c_confirm**, **c_linked** (§9.2-9.4). **Extracción**: la lógica
   de los pasos «enter» y «confirm» de `ClientCodeModal` (validar, avisos,
   elección de historial, conectar, errores) pasa a un hook
   `src/hooks/useClientCode.js` que usan el modal y estas pantallas. El modal
   no cambia para el usuario.
3. **Invitación** (§9.5): `afterSettings` ya lleva a `c_code` con el código
   puesto; aquí `role = 'coached'` y `clearPendingInviteCode()` al conectar o al
   salir.
4. Compartir que avanza: helper `shareAndContinue(message, next)` en
   `src/components/onboarding/flow/` (lo reutiliza O03-08): `Share.share`;
   `sharedAction` → `flowGo(next)`; `dismissedAction` → nada.
5. Quitar el provisional de «Con un entrenador» de O03-01. `flowDone` con
   conectado / pendiente.

**Probar O03-05**

- [ ] «Sí, tengo su código» → pegar un código real → «Programa encontrado» con el
  nombre del entrenador y del programa y «Qué pasa al conectar».
- [ ] Conectar → panel «Conectado con {entrenador}» → en la app, su programa en
  Inicio y no se puede editar.
- [ ] Código inventado → el error sale en la pantalla, sin cerrar nada.
- [ ] «Sí, pero no tengo código» → Enviar mensaje → elegir WhatsApp → al volver
  pasa sola a «Cómo ves Inicio». (iOS: cerrar la hoja sin compartir → se queda.)
- [ ] «No la usa» → «Lo copio a mano» abre el constructor en su versión completa.
- [ ] Por invitación: enlace → bienvenida con la línea azul → unidades → tema →
  directamente el código ya puesto, sin «¿Cómo entrenas?».
- [ ] El modal de código de la app (Menú → Entrenador) sigue funcionando igual.
- [ ] Por invitación, pulsar «Saltar» en el código: al acabar el recorrido no se
  abre Conexión con entrenador.
- [ ] «Listo» enseña «Conectado con {entrenador}» y «"{programa}" en tu Inicio» al
  conectar, o «Conectar con tu entrenador · Menú → Entrenador» si no.

## 22. O03-06 — Aprende

**Depende de**: O03-01. **Ola 2**.

Hace, en `screens/learn.jsx`:

1. **a_home** (§11.2) con una miniatura propia `HomeViewPreview` (lista y
   pestañas, pestañas tocables) dibujada con los tokens y glifos de
   `SessionList`/`SessionTabsCard`; se reutiliza en la tarjeta «Tu sesión de hoy».
2. **a_input** (§11.3): `ScrubDemo`, una fila S1 · peso · reps con los dos
   gestos **a los lados**, sobre las funciones de `src/utils/scrubScale.js`
   (`scrubRuler`, `scrubValueAt`) para que la regla sea la misma del Workout.
   Guarda `profile.scrubRuler`.
3. **a_cards** (§11.4): el carrusel de tarjetas con puntos, Anterior/Siguiente y
   sus variantes por camino (`role`, `alsoTrains`, `linked`, `clientMode`).
4. **Extracción de la fila de Clientes** (§22.1): sale del `renderItem` de la
   lista de `ClientsScreen.jsx` a `src/components/ClientRow.jsx` (props: el
   cliente y lo que hoy calcule el `renderItem`: 2.ª línea, cuadraditos, última
   vez, muesca, botón). `ClientsScreen` la usa igual que antes. La usan
   «Tus clientes, de un vistazo», b_done (O03-02) y asignar/invitar (O03-08).
5. `learnStart` en el util.

### 22.1 La fila de Clientes

Es la de C08 §3-4 tal cual. La tarjeta del entrenador la pinta con su cliente
real arriba y tres clientes de ejemplo (datos fijos, no del store).

**Probar O03-06**

- [ ] «Cómo ves Inicio»: las dos vistas lado a lado; en «Pestañas» tocar otra
  pestaña la abre en el dibujo. Elegir «Pestañas» → al terminar, Inicio sale en
  pestañas.
- [ ] «Cómo apuntas»: con «Con regla», arrastrar el peso a la derecha enseña la
  regla y el valor en la burbuja; al soltar se queda. Con «Solo deslizar», la
  cifra cambia en la casilla mientras arrastras.
- [ ] Elegir «Solo deslizar» → en un entreno real, la casilla funciona sin regla.
- [ ] Tarjetas de «por mi cuenta»: la 1.ª dibuja la vista de Inicio elegida
  (en el entrenador que también entrena es la 2.ª). Anterior/Siguiente y los
  puntos funcionan, y la última dice «Entendido» y lleva a Listo.
- [ ] Entrenador (con O03-08): «Tus clientes, de un vistazo» enseña arriba su
  cliente real (con reloj si es con app) y tres de ejemplo.
- [ ] Entrenador que no entrena: «Apunta tú sus sesiones» solo sale si su
  cliente es «le apuntas tú».
- [ ] Conectado con entrenador: no sale «Cambia lo que quieras»; sale «{Entrenador}
  ve tus entrenos».
- [ ] La pestaña Clientes de la app se ve exactamente igual que antes de la
  extracción (color, insignia, cuadraditos, muesca).

## 23. O03-07 — «Ya tengo cuenta», versión mínima

**Depende de**: O03-01. **Ola 3**.

Hace, en `screens/recover.jsx`, la pantalla de §12:

1. `TrainerSyncModal` gana la prop `initialScreen` (`'select'` por defecto;
   `'recovery'` la abre en recuperar). **Ya existe** (13-oct, para el «Ya tengo
   cuenta» del paywall): aquí solo hay que usarla.
2. «Entreno con un entrenador» → `ClientCodeModal` con `startWithSocial`.
3. «Una copia de seguridad» → `DriveBackupScreen` (navegar) o el selector de
   archivo; al importar, terminar.
4. Éxito en cualquiera → `finishOnboardingFlow()`; cancelar → se queda.
5. Quitar el provisional de «Ya tengo cuenta» de O03-01.

**Probar O03-07**

- [ ] «Mi cuenta de entrenador» → código de 12 de una cuenta real → vuelven los
  clientes y se entra en la app sin más onboarding.
- [ ] «Entreno con un entrenador» → Google de un cliente vinculado → vuelve su
  programa.
- [ ] «Una copia de seguridad» → archivo `.fitdata` → programas e historial
  restaurados.
- [ ] Cancelar cualquiera de las tres vuelve a «Recupera lo tuyo».

## 24. O03-08 — Camino del entrenador

**Depende de**: O03-02, O03-03, O03-05 (`shareAndContinue`),
O03-06 (`ClientRow`) y O03-07 (`TrainerSyncModal.initialScreen`). **Ola 4, sola.**

Hace, en `screens/trainer.jsx`, §7 entero:

1. **t_clients**, **t_groups** (datos a `profile`).
2. **t_client** con `createClient(name)` sin app, renombrar al volver (§7.3).
3. **Cuenta**: la lógica de `TrainerSyncModal` para crear la cuenta (Google con
   `AuthSession`, Apple, código: `doSwitch`, `handleApple`, el efecto de la
   respuesta de Google, `setTrainerName`) pasa a un hook
   `src/hooks/useTrainerAccount.js` que usan el modal y **t_account**. El modal no
   cambia para el usuario. Con la cuenta hecha, `connectClientToCloud(clientId)`.
4. **t_code** (§7.5) con el bloqueo; **el mismo bloqueo en `code_reveal` de
   `TrainerSyncModal`** («Ya lo he guardado» desactivado hasta Copiar o Enviar).
5. **t_program** (§7.6) → `startBuilder('trainer')` · catálogo · después.
6. **t_catalog** + **t_assign** (§7.7). **Store nuevo**:
   `generateProgramForClient(clientId, archetypeId)` — `adaptArchetype` con las
   respuestas por defecto del arquetipo (sus días; nivel intermedio;
   `normalizeOnboardingAnswers`), `owner: clientId`, sus fases como en
   `generateAndActivateProgram`, **sin** tocar `profile`; devuelve el id. Después
   `setClientActiveProgram` y, con app, `uploadProgramToClient`. Test en
   `store/useStore.test.js`: el programa es del cliente y el perfil no cambia.
7. **t_invite** (§7.8) con `shareAndContinue` y «Lo envío después».
8. **t_self** (§7.9): `alsoTrains`; «No» → `profile.homeTab = 'Clients'`.
   **`RootNavigator`**: el `Tab.Navigator` de `MainTabs` usa
   `initialRouteName={profile.homeTab ?? 'Home'}` (si `Clients` está oculta por
   `proTabsHidden`, `Home`).
9. Quitar el provisional de «Soy entrenador/a» de O03-01. `flowDone` con todo lo
   de §11.5.

**Probar O03-08**

- [ ] Datos: «1-5» enseña la línea del plan gratis; «Empiezo» no.
- [ ] Cliente «Ana» con la app → «Tu cuenta de entrenador» sin «Saltar»; en
  Android no sale Apple.
- [ ] Con código personal: «Ya lo he guardado» gris hasta pulsar Copiar o
  Enviármelo.
- [ ] Menú → Sincronización → crear cuenta con código: el mismo bloqueo.
- [ ] «Crear su programa» con 3 sesiones y un ejercicio → «Guardar y enviar a Ana»
  → «Invita a Ana» con su código. En Clientes: Ana con el programa, sin «Cambios
  sin enviar», con el reloj de esperando código.
- [ ] Canjear ese código en otro móvil: entra con «Programa de Ana» (A con su
  ejercicio).
- [ ] Del catálogo: elegir uno → Asignar → la fila cambia y avanza sola; el
  programa está en la ficha de Ana y no se ha gastado la plantilla gratis
  (Plantillas vacía).
- [ ] «Lo hago después» con cliente con app → no sale «Invita a Ana»; en Listo,
  «Darle un programa» e «Invitar a Ana, cuando tenga programa».
- [ ] Enviar invitación → WhatsApp → al volver pasa sola a «¿Y tú también
  entrenas?».
- [ ] «No, solo clientes» → solo tarjetas de entrenador → Ir a la app abre en
  Clientes. Reabrir la app: sigue abriendo en Clientes.
- [ ] «Sí, quiero llevar el mío» → nivel → … → Aprende completo, con «Tus clientes,
  de un vistazo» la primera.
- [ ] Cliente «le apuntas tú» → no hay pantalla de cuenta; en Aprende sale «Apunta
  tú sus sesiones».

## 25. O03-11 — «Nuevo programa» con el recorrido nuevo

**Depende de**: O03-02, O03-03, O03-04 y O03-05. **Ola 4**, en paralelo con O03-08.
Maqueta: fila «Desde la app» del mapa.

### 25.1 Cómo es hoy

`startNewProgram` (el ≡ y el ··· de Programa) y `NoProgram` (estado vacío) llaman a
`navigate('onboarding')`, que abre la ruta `Onboarding` **sin parámetros**: el
selector viejo de cinco tarjetas (automático, manual, importar, desde mis
plantillas, tengo entrenador), sin flecha para volver (`fromApp` no lo pasa
nadie) y, al terminar, `navigation.replace('Main')`. Con entrenador conectado,
antes sale el aviso de que se desconecta (`header.newProgramWarn*`), y `finish()`
llama a `unlinkFromTrainer({ keepProgram: true })`.

### 25.2 Cómo queda

- **Entrada**: `startNewProgram` y `NoProgram` mantienen el aviso del entrenador
  y, en vez de `navigate('onboarding')`, llaman a
  `startOnboardingFlow({ entry: 'newProgram' })` y **apilan** `Start` sobre `Main`
  (no `replace`). Empieza en `n_source`.
- **Cabecera**: «Nuevo programa» en lugar del tramo, sin barra. La flecha de
  `n_source` cierra sin cambios (`onboardingFlow = null` y `goBack`). «Saltar»
  solo dentro del constructor.
- **`n_source`** — «Elige cómo *empezar*» · «Podrás editar el programa en
  cualquier momento». Cinco `FlowOption` con «›». **Textos de app, no de colega**
  (decisión del usuario, 13-oct): cortos, neutros, sin «te lo montas» ni «te
  enseñamos 3»:
  - **Programa recomendado** (etiqueta «Recomendado») — «Según tu nivel, tu
    objetivo y tus días de entreno» → `s_goal` con el nivel de `profile.onboardingAnswers.level` (si no
    hay, `s_level` primero) → `s_days` → `s_props` → confirmar → `n_done`.
  - **Crear desde cero** — «Define sesiones, ejercicios y progresión» →
    `startBuilder('self')`, profundidad según el nivel → `n_done`.
  - **Desde una plantilla** — «Usa una de tus plantillas guardadas»; **solo si**
    `templatesOf(programs)`
    no está vacío → `n_templates`.
  - **Programa de tu entrenador** — «Conéctate con el código de tu entrenador» →
    `c_code` →
    `c_confirm` → `c_linked`, cuyo botón pasa a ser «Ir a la app».
  - **Importar archivo** — «Archivo .fitdata de una copia de seguridad» →
    selector + `ImportModal` → `n_done`.
- **`n_templates`** — «Elige una *plantilla*» · «Se crea una copia. La plantilla
  original no cambia». Lista de plantillas (nombre, «N sesiones · N etapas»,
  letras) con `FlowOption`, el nombre prellenado y editable (`NameField`) y
  «Usar esta» → `cloneProgramFromTemplate(id, { name })`. Si el plan gratis lo
  para (devuelve nada), se queda.
- **`n_done`** — «Programa *listo*» · «"{nombre}" ya es tu programa activo» (o «El
  archivo se ha importado») y el panel lima: «Disponible en Inicio. Puedes
  editarlo en Programa» · **Ir a la app**.
- **Salida** (`finishOnboardingFlow` con `entry: 'newProgram'`): no toca
  `onboardingCompleted` ni `setupComplete`. Si se creó o eligió un programa
  propio (no en la rama del entrenador) y había `clientSync.slotId`,
  `unlinkFromTrainer({ keepProgram: true })` como hoy. `onboardingFlow = null` y
  `backToMain(navigation, { screen: 'Home' })`.
- **No se retoma**: un recorrido `newProgram` a medias no se abre al arrancar;
  `onRehydrateStorage` lo borra. Lo que ya se creó sigue en Programa.
- Las rutas `builderExit` y `afterProposal` del util llevan a `n_done` con esta
  entrada (§16.3); `s_*`, `b_*` y `c_*` no cambian por dentro.

### 25.3 Limpieza

- Se borra **`src/screens/OnboardingScreen.jsx`** entero, su ruta `Onboarding` de
  `RootNavigator`, su `case 'onboarding'` de `navigationRef.js` y su nombre en el
  guardia de la invitación. Las piezas que extrajo O03-04 siguen en
  `src/components/onboarding/`.
- Claves de `onboarding.*` en los locales que ya no use nadie (comprobar con
  `grep` en `src/`): se borran **línea a línea**, nunca reescribiendo el JSON.
  Las que usen las piezas extraídas se quedan.
- `NoProgram` llama a `startNewProgram` en vez de repetir el aviso del
  entrenador: una sola entrada.

**Probar O03-11**

- [ ] ≡ → Nuevo programa: «Elige cómo empezar» con «Nuevo programa»
  arriba y sin barra de tramos. La flecha vuelve a la app sin cambios.
- [ ] «Programa recomendado» no pregunta el nivel → qué buscas → días → propuestas
  → «Empezar con este» → «Programa listo» → Ir a la app abre Inicio con el
  programa nuevo.
- [ ] «Crear desde cero» → constructor → Guardar → «Programa listo».
- [ ] Sin plantillas no sale «Desde una plantilla»; con una, «Usar esta» la copia
  con el nombre puesto y la plantilla sigue igual en Plantillas.
- [ ] Conectado a un entrenador: Nuevo programa avisa de la desconexión; al crear
  uno, queda desconectado y el programa nuevo es editable.
- [ ] «Programa de tu entrenador» → código → conectado → Ir a la app.
- [ ] «Importar archivo» con un `.fitdata` → «Programa listo».
- [ ] El estado vacío de Programa (sin programa) abre el mismo recorrido.
- [ ] Matar la app a mitad de «Nuevo programa» y reabrir: entra en la app, no en
  el recorrido.

## 26. Aparcadas

### 26.1 O03-09 — Recuperar todo con un solo login

Una pantalla, un login (Apple/Google) y la app busca en todos los sitios: huecos
de entrenador, hueco de cliente, RevenueCat y, con Google, Drive; después «Esto es
lo que había» con cada cosa marcada (la maqueta del 12-oct, en el historial de
git). Pide **una búsqueda conjunta por identidad** que hoy no existe (cada pieza
tiene su llamada) y, para que «todo» sea todo, una **copia en la nube atada a la
cuenta** para quien entrena por su cuenta (hoy su programa solo vuelve con la
copia de Drive o el archivo). Es una feature nueva; se aparca hasta que la
versión mínima (O03-07) enseñe si hace falta.

### 26.2 O03-10 — Pendientes y pistas sobre las pantallas reales

Dos cosas que el recorrido deja preparadas y no hace:
- Que los pendientes de «Listo» **reaparezcan como tarjeta** en Inicio o en
  Clientes hasta hacerlos (hoy «Listo» dice dónde se retoman y basta).
- Que las pistas de Aprende **reaparezcan la primera vez que se entra en cada
  pantalla real**, que es cuando se recuerdan.

## 27. Reparto entre subagentes

Cada tarea es **un subagente** (Sonnet), con un prompt autocontenido: «implementa
O03-NN de `mobile/docs/specs/O03-onboarding-caminos.md`; lee antes §2, §3, §16 y la
sección de tu tarea; tu maqueta es `mobile/docs/mockups/onboarding-2.html`
(nodos del mapa de tu camino); no toques ficheros de otras tareas salvo los que
diga tu sección; verifica con eslint y vitest; cierra la tarea según §16.6».

| Ola | Tareas | En paralelo | Por qué ese orden |
|---|---|---|---|
| 1 | O03-01 | — | estado, util, registro y piezas: lo usan todas |
| 2 | O03-02 · O03-05 · O03-06 | sí, 3 worktrees | ficheros de pantallas distintos; O03-06 extrae `ClientRow`, que nadie más toca en esta ola |
| 3 | O03-03 · O03-04 · O03-07 | sí, 3 worktrees | 03 sigue en `builder.jsx`; 04 extrae de `OnboardingScreen`, que nadie más toca; 07 toca `TrainerSyncModal` antes que 08 |
| 4 | O03-08 · O03-11 | sí, 2 worktrees | 08 usa piezas de casi todas y toca `TrainerSyncModal`, el store y la parte de pestañas de `RootNavigator`; 11 borra `OnboardingScreen` (ya sin provisionales que lo usen) y la ruta `Onboarding` de la pila. Choque esperable: líneas distintas de `RootNavigator.jsx` |

**Ramas** (memoria del proyecto: una sola rama viva). Rama `feat/onboarding-caminos`
sacada de la viva en `C:\Users\lucas\fuerza-control`. En las olas en paralelo,
cada subagente en su worktree **fusiona la rama viva antes de empezar** (los
worktrees nacen con base vieja); al acabar la ola, se fusionan los tres en la
rama viva (los choques esperables son de líneas añadidas en `es.json`/`en.json`
y en el test del util; se resuelven quedándose con las dos) y se quitan los
worktrees (`cmd /c rmdir` en las junctions de `node_modules`, `git worktree
remove`). Antes de la ola siguiente, `npx vitest run` en la rama viva.

**Entre olas, revisión** (Fable u Opus): leer el diff de la ola contra esta spec y
la maqueta antes de lanzar la siguiente. Lo que haya que corregir se corrige en la
rama viva, no en la ola siguiente.

**Pruebas del usuario**: tras cada ola, las casillas de sus tareas. La app es
usable entre olas gracias a los provisionales de O03-01 (§17.5).

## Fases

| Fase | Qué | Depende de | Estado |
|---|---|---|---|
| O03-01 | Armazón del recorrido y tramo común | — | ✅ 6a126f6 — `OnboardingFlowScreen` (ruta `Start`) con registro, `onboardingFlow` en el store, `utils/onboardingFlow.js` + test, piezas `flow/` y las cinco pantallas comunes; `SetupScreen` borrada |
| O03-02 | Constructor guiado I | O03-01 | ✅ b36b9d2 · 2e0084c — b_sessions/b_exercise/b_done, `builderProgram.js` y `onboardingBuilder.js` con tests; `createProgramForClient(…, { openEditor })`. Pendiente para O03-03: «Saltar» en b_sessions sin «Siguiente» no crea el programa; b_exercise sale a `b_done` (`AFTER_EXERCISE`) |
| O03-03 | Constructor guiado II (solo volumen; progresión aparcada el 14-oct) | O03-02 | pendiente |
| O03-04 | Camino «por mi cuenta» | O03-02 | pendiente |
| O03-05 | Camino «con entrenador» | O03-01 | ✅ 395c664 — `coached.jsx`, `hooks/useClientCode.js` (estado en un store de módulo) usado también por `ClientCodeModal`, `shareAndContinue`. `validateClientCode` no trae las letras de las sesiones: `c_confirm` no las pinta |
| O03-06 | Aprende | O03-01 | ✅ ac13d22 · d58b1b6 — `ClientRow` extraída (la fila ya era `ClientListCard`; ésta calcula y `ClientRow` dibuja), `HomeViewPreview`, `ScrubDemo` sobre `ScrubRuler`/`scrubScale`, tarjetas por camino. En la fusión, el hueco de b_done (O03-02) pasó a `ClientRow` |
| O03-07 | «Ya tengo cuenta», versión mínima | O03-01 | pendiente |
| O03-08 | Camino del entrenador | O03-02, 03, 05, 06, 07 | pendiente |
| O03-09 | Recuperar todo con un solo login | O03-07 | aparcada |
| O03-10 | Pendientes y pistas sobre las pantallas reales | O03-06 | aparcada |
| O03-11 | «Nuevo programa» con el recorrido nuevo | O03-02, 03, 04, 05 | pendiente |
