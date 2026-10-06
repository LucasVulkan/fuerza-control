# Spec — Onboarding por caminos

> Tema: onboarding
> En corto: El alta lleva a cada usuario a lo suyo: ajustes básicos, una pregunta de cómo entrena y tres caminos distintos (por su cuenta, con entrenador, entrenador), con un constructor guiado de programa y unas tarjetas que enseñan lo básico. Todo saltable.
> Fase O03-01 · pendiente · Cerrar el flujo y dividirlo en tareas · §15
>
> Estado: **borrador, sin tareas** (abierta el 4-oct-2026). Recoge lo hablado
> con el usuario y la maqueta [`docs/mockups/onboarding.html`](../mockups/onboarding.html),
> que el usuario dio por buena «por ahora». El flujo **no está cerrado**: falta
> seguir definiéndolo antes de partirlo en tareas (§14 lista lo abierto). La única
> fase, O03-01, es justo eso; cuando se cierre, se sustituye por las tareas reales.
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

## 2. La maqueta

[`docs/mockups/onboarding.html`](../mockups/onboarding.html). Se puede tocar todo:
- el teléfono de la izquierda recorre el flujo de verdad (atrás, «Saltar», tema
  en vivo, la celda de peso se arrastra con regla o deslizando);
- a la derecha, la nota de la pantalla visible (por qué es así), el **mapa** (cada
  nodo salta a su pantalla; los marcados con ⤵ entran en el constructor desde ese
  camino) y la lista de decisiones.

Es para decidir el recorrido, **no la UI final**: usa los tokens de FormaFit para
parecerse a la app, pero no tiene nodo de Figma ni fidelidad. Cuando se
implemente, las piezas salen de las pantallas ya migradas (como hizo O01 §4).

## 3. Principios de la UI

- **Una pregunta por pantalla**, con tarjetas grandes con icono. Si la respuesta
  es única, tocar **avanza solo** (~250 ms, para que se vea la selección).
- **Progreso por tramos, no por pantallas**: una barra de cuatro segmentos con
  nombre — *Ajustes · Tú · Configura · Aprende* — que se llena dentro de cada
  tramo. Se ve qué falta sin contar pasos, y no miente cuando un camino es más
  largo que otro.
- **Todo se puede saltar.** «Saltar» arriba a la derecha salta **el tramo entero**
  con los valores por defecto. La única pantalla sin «Saltar» es la bifurcación
  (§6). Dentro del constructor, además, «Lo termino después» en cada paso.
- **Siempre se puede volver** (flecha arriba a la izquierda) sin perder lo
  contestado.
- **Enseñar en vez de explicar**: el tema repinta la pantalla al tocarlo; las
  unidades enseñan un número; la elección regla/deslizar es una celda que se
  arrastra; las sesiones aparecen al elegir cuántas.
- **Nada obligatorio**: cada paso tiene un valor por defecto sensato y una salida.

## 4. El flujo

```
Bienvenida → Idioma → Unidades → Tema → Regla/deslizar → ¿Cómo entrenas?
                                                          │
   ┌──────────────────────────────┬───────────────────────┴───────────────┐
Por mi cuenta (§8)            Con entrenador (§9)                    Soy entrenador/a (§7)
Nivel                         ¿Usa la app?                           Nº clientes · ¿Clases en grupo?  (datos)
Plantilla o el mío            ├ Sí, tengo código → conectado         Crea tu 1.er cliente
├ plantilla: qué buscas,      ├ Sí, sin código → mensaje             Su programa: 1.ª plantilla ⤵ o catálogo
│  días, propuestas (O01)     └ No usa la app → invítale             Asignar plantilla → cliente
└ el mío ⤵                        + copia su programa (a mano ⤵)     Conectarlo (invitación)
                                                                     ¿También entrenas tú? → «Por mi cuenta»
        └──────────── Aprende (3-4 tarjetas) → Listo (hecho + pendiente) ───────────┘

⤵ = constructor guiado (§10), compartido por los tres caminos
```

| Tramo | Pantallas |
|---|---|
| Ajustes | idioma, unidades, tema, regla/deslizar |
| Tú | bifurcación + las preguntas de cada camino (nivel; nº clientes y grupos; ¿usa la app?) |
| Configura | lo que crea algo: programa, cliente, plantilla, conexión |
| Aprende | las tarjetas de §11 |

## 5. Tramo común

### 5.1 Bienvenida

Logo, una frase, **Empezar** y **Ya tengo cuenta**. Lo segundo lleva a recuperar
la cuenta (código o Google, lo que ya existe en `TrainerSyncModal`) y se salta el
onboarding: sin eso, quien reinstala o cambia de móvil lo repite entero
(abierto, §14).

### 5.2 Idioma

Dos tarjetas, con el idioma del móvil ya marcado; tocar avanza. Guarda
`profile.language`. Abierto si merece pantalla propia o basta un enlace
«cambiar idioma» en la bienvenida (§14).

### 5.3 Unidades

Dos baldosas grandes, «80 kg» y «175 lb»; tocar avanza. Guarda
`profile.weightUnit` — es lo único que hace hoy `SetupScreen.jsx`, que
desaparece.

### 5.4 Tema

Las muestras de los cinco temas de `src/themes.js` (FormaFit, Oscuro, Midnight,
Earthy, Space). Tocar una **repinta toda la pantalla al momento** (`setTheme`,
`useStore.js:531`) y una tarjeta de ejemplo enseña cómo queda una sesión. No
avanza solo: se prueban varios.

### 5.5 Cómo meter los números (regla o deslizar)

Es la práctica de «cómo se apunta una serie» disfrazada de pregunta. Una fila de
serie (S1 · peso · reps) que **se arrastra de verdad**, y dos tarjetas:

- **Con regla** — al deslizar a los lados aparece la regla y se ve cada paso.
- **Solo deslizar** — el número sube y baja con el dedo, sin regla.

Cambiar de tarjeta cambia cómo responde la fila. Guarda `profile.scrubRuler`,
que ya existe (`AppHeader.jsx:363`, Preferencias) y por defecto es `true`.

**Por confirmar al implementar**: en la maqueta «solo deslizar» es vertical y
«regla» horizontal; hay que comprobar qué hace exactamente el Workout con
`scrubRuler: false` y que la demo diga lo mismo.

## 6. La bifurcación — «¿Cómo entrenas?»

Tres tarjetas, sin «Saltar»:

| Tarjeta | Camino |
|---|---|
| **Por mi cuenta** — sigo un programa o me lo monto yo | §8 |
| **Con un entrenador** — alguien me prepara el programa | §9 |
| **Soy entrenador/a** — preparo programas para mis clientes | §7 |

Pregunta **la situación, no la identidad**. Así nadie tiene que llamarse
«atleta» (el usuario dudaba del término) y ningún texto de la app necesita un
sustantivo para quien no es entrenador. Y «tengo entrenador» queda en primera
fila, que era el requisito.

El rol se guarda en `profile` y decide qué pestañas se ven: hoy
`proTabsHidden` es en la práctica esa preferencia («no soy entrenador, quítame
esos tabs», M01 §4.3). Se puede cambiar después en el menú.

## 7. Camino del entrenador

1. **¿Con cuántos clientes trabajas?** — Empiezo · 1-5 · 6-15 · 16-30 · +30.
   Dato (§13). Si elige más de 2, aparece la línea del plan gratis (§12).
2. **¿Das clases en grupo?** — Sí · A veces · No. Dato, y además decide una cosa:
   con Sí o A veces, el paso 3 ofrece «Es un grupo».
3. **Crea tu primer cliente** — solo el nombre, con un ejemplo de placeholder
   («Ana»). Real: al pulsar, el cliente existe. Con grupos, el interruptor «Es un
   grupo» (cliente `kind: 'group'`, [C06-01](C06-group-classes.md) — **aparcada**, ver §14).
4. **Su programa** — dos opciones y una salida:
   - **Montar mi primera plantilla** (recomendada, «~3 min») → constructor guiado
     en modo entrenador (§10). Es la apuesta: ve el editor real, invierte tiempo
     en algo suyo y sale con una plantilla que reutilizará.
   - **Partir de una del catálogo** → lista de plantillas; asigna directamente.
   - «Lo hago después».
5. **Asígnasela a {cliente}** — tarjeta plantilla → flecha → cliente: el gesto que
   repetirá con cada cliente. Real (hoja «Asignar programa»,
   [C07-02](C07-asignar-programas.md)). Lleva el contador «Plantillas: 1 de 2
   gratis» de M01 §4.4.
6. **Conecta a {cliente}** — su código grande, **Enviar invitación** (mensaje con
   enlace, [M01-04](M01-monetizacion.md)) y Copiar. Una nota dice que, si el
   cliente no usa la app, también vale: el entrenador apunta sus sesiones desde la
   ficha o pega el texto que le mande ([C05](C05-trainer-logging.md)). Si el
   entrenador no tiene cuenta todavía, aquí se crea la de código en un toque.
7. **¿Y tú también entrenas?** — Sí → empalma con el camino «por mi cuenta» (§8,
   desde el nivel). No → Clientes pasa a ser su pantalla principal.
   El entrenador que entrena es el caso normal, no la excepción.
8. **Aprende** (§11) → **Listo** (§11.3).

Abierto: si las preguntas de datos (1-2) van antes o después de crear el cliente
(§14).

## 8. Camino «por mi cuenta»

1. **Nivel** — Empiezo (<6 meses) · Llevo un tiempo (6 meses-2 años) · Mucho (+2
   años). Igual que la pregunta 1 de O01. Decide dos cosas: qué se recomienda en
   el paso 2 y la profundidad del constructor (§10.3).
2. **Plantilla o el mío** — va justo después del nivel, porque quien monta el
   suyo no necesita «qué buscas» ni «días» (los días los elige el constructor).
   - Principiante: **«Te proponemos un programa hecho»**, con la plantilla
     recomendada como tarjeta grande y «Prefiero montarlo yo» como enlace.
   - Intermedio y avanzado: las dos tarjetas con el mismo peso.
   - En los dos, un enlace «Tengo una copia de seguridad» (el importar de hoy).
3. **Plantilla** → qué buscas → días → propuestas: el flujo de O01 tal cual, con
   su hoja de ajustes (tiempo, material, limitaciones).
   **El mío** → constructor guiado (§10).
4. **Aprende** (§11) → **Listo**.

## 9. Camino «con entrenador»

1. **¿Tu entrenador usa Fuerza & Control?**
   - **Sí, tengo su código** → seis casillas que aceptan pegar el código entero
     (`ClientCodeModal` como pantalla) → «Conectado con {entrenador}. Tu programa
     aparecerá en Inicio en cuanto te lo asigne. Mientras, puedes registrar
     sesiones libres.»
   - **Sí, pero no tengo código** → dónde lo saca el entrenador (Clientes → ficha →
     Conectar) y un mensaje ya escrito para pedírselo, con «Enviar mensaje».
     «Lo meto más tarde» sigue adelante.
   - **No la usa** → las dos cosas a la vez, no una u otra:
     - **Invítale a la app**: mensaje con enlace a la store — «podrás gestionar mi
       programa desde ahí y ver mis entrenos (gratis hasta 2 clientes)».
     - **Copia su programa** («mientras tanto»): ¿cómo te lo pasó?
       - Texto (WhatsApp, notas) → pegar y que la app lo entienda. Reutiliza el
         analizador de [C05-05](C05-trainer-logging.md), que **hoy solo entiende
         sesiones sueltas**: haría falta ampliarlo a un programa entero, o quitar
         la opción (§14).
       - Lo copio a mano → constructor guiado en modo completo (§10): copiar el
         programa de un entrenador necesita series y rangos exactos.
       - Empiezo de una parecida → propuestas de plantillas.
2. Si llegó por un **enlace de invitación** (`forma://join/CODIGO`, M01-04), la
   pregunta se salta y el código viene puesto.
3. **Aprende** (§11) → **Listo**.

Por definir: cuando el entrenador que no usaba la app se la instala, ¿puede
adoptar el programa que el cliente copió? (§14).

## 10. El constructor guiado

Un solo constructor de programa, usado en tres sitios: la primera plantilla del
entrenador (§7.4), «montar el mío» (§8) y «lo copio a mano» (§9). **Cambia la
profundidad, no las pantallas.** El objetivo, en palabras del usuario: que vea
cómo es el proceso, que sienta que invierte tiempo valioso en crear algo, que de
paso vea todas las opciones que hay, y que nunca se sientan obligatorias.

### 10.1 Los pasos

```
1 Sesiones → 2 Un ejercicio → 3 Volumen → 4 Progresión → «Ya tiene forma»
```

1. **Sesiones** — elegir un número (1-6) hace aparecer las tarjetas A, B, C… al
   momento. Son las sesiones de cada semana: **no hay un campo de días aparte**
   (regla del proyecto). En «por mi cuenta» el número no viene puesto; si alguna vez
   se contestó antes, se usa.
2. **Un ejercicio en la sesión A** — «+ Añadir ejercicio» abre una lista corta.
   Con uno basta para ver cómo funciona; B, C… se ven vacías, con «después».
3. **Volumen** del ejercicio (§10.3).
4. **Progresión** del ejercicio (§10.3).
5. **Ya tiene forma** — lo construido (A con su ejercicio y su resumen, el resto
   vacías), nombre opcional con uno ya puesto («Plantilla 1» / «Mi programa») y
   la nota «Sigue editándolo cuando termines: Programa → {nombre}». El
   entrenador sigue a «Asígnasela a {cliente}» (§7.5); el resto, a Aprende.

**La sensación de construir**: arriba, una barra con cuatro fichas que se van
encendiendo — «✓ 4 sesiones · ✓ Press banca · ✓ 3×8-12 · ✓ Por reglas».

**Nunca obligatorio**: en cada paso, «Lo termino después» sale guardando lo que
haya (al menos las sesiones vacías), y «Saltar» de arriba hace lo mismo.

### 10.2 Lo que hay que reutilizar

El constructor **no es un editor aparte**. Volumen y progresión salen del editor
de ejercicio real: los campos de Volumen de `ExerciseEditorInline` y
`editor/ProgressionSheet.jsx` (P12 §12, ya compartida entre editor y alta de
ejercicio). Lo aprendido en el onboarding tiene que ser literalmente lo que verá
después. El modo principiante (§10.3) es la única pieza propia.

### 10.3 Principiante frente a avanzado y entrenador

| | Principiante | Avanzado · entrenador · copiar a mano |
|---|---|---|
| Lista de ejercicios | máquinas y mancuernas (sentadilla goblet, press con mancuernas, remo en polea…) | básicos con barra (sentadilla, press banca, peso muerto, dominadas…) |
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

## 11. Aprender lo básico

### 11.1 Real frente a simulado

- **Lo que crea algo es real**: crear el cliente, la plantilla, asignarla,
  conectarlo, el programa propio. Son las pantallas de la app con otra cara; al
  acabar, existe.
- **Lo que explica es simulado**: tarjetas con una mini-pantalla animada, un
  elemento resaltado y un dedo que señala. 3-4 por camino, con puntos de
  progreso, Anterior/Siguiente, saltables. Las mismas pistas **reaparecen la
  primera vez que entra en cada pantalla real**, que es cuando de verdad se
  recuerdan.

### 11.2 Las tarjetas

**Por mi cuenta y con entrenador** (las cuatro que pidió el usuario):
1. Tu sesión de hoy, en Inicio — toca la que toca y Empezar.
2. Apunta cada serie — con el texto de la opción elegida en §5.5 (regla o
   deslizar); el descanso empieza solo.
3. Cambia lo que quieras — Programa → ejercicios, series, progresión.
4. Sesión libre — el «+» para entrenar fuera del programa; cuenta o no como
   sesión del programa.

**Entrenador**:
1. Tus clientes de un vistazo — quién entrenó, quién lleva días sin hacerlo,
   quién tiene sesiones nuevas.
2. Plantillas — programa una vez y asígnalo a varios; cada uno avanza a su ritmo.
3. Ajusta su próxima sesión — desde la ficha, sin tocar el programa.
4. Pizarra para tus clases — solo si da clases en grupo.

Las mini-pantallas usan lo que el usuario acaba de crear (nombre del programa,
del cliente, unidad).

### 11.3 Listo

Una lista con lo hecho (✓) y lo pendiente (·): «Cliente: Ana · Plantilla
"Plantilla 1" asignada · Rellenar las sesiones B, C de la plantilla · Esperando a
que se conecte». **Los pendientes reaparecen como tarjeta en Inicio o en
Clientes**: si no, «lo hago después» se pierde.

## 12. Monetización dentro del onboarding

**Sin paywall en el onboarding.** Si el entrenador dice que lleva más de 2
clientes, una línea informativa: «Empiezas gratis con 2 clientes y 2 plantillas.
Cuando necesites más, Pro quita el límite.» Sin botón de compra. El paywall salta
donde dice M01: al crear el 3.er cliente, cuando ya ha visto el valor. En la
asignación (§7.5), el contador «Plantillas: 1 de 2 gratis».

Esto **no necesita que [M01](M01-monetizacion.md) esté implementada**: solo que el
2+2 sea la regla. Si M01 acaba con prueba gratis, la línea cambia a «prueba Pro
N días». El usuario dudaba entre ponerlo aquí o dejar que se lo encuentren; la
propuesta es lo segundo con aviso previo.

## 13. Datos que se recogen

| Dato | Dónde | Para qué |
|---|---|---|
| rol (por mi cuenta · con entrenador · entrenador) | `profile` | pestañas visibles, camino |
| ¿también entrena? (entrenador) | `profile` | pantalla principal |
| nivel | ya existe en las respuestas del onboarding | recomendación, profundidad del constructor |
| nº de clientes | `profile` | solo dato |
| clases en grupo | `profile` | dato + ofrecer «es un grupo» |
| ¿su entrenador usa la app? | `profile` | dato |

Se guardan en local desde el principio. **Para que le lleguen al usuario hace
falta [A01](A01-analitica.md)** (analítica propia), que está en espera
precisamente hasta que el onboarding se asiente; sus eventos de onboarding
(A01 §5) habrá que rehacerlos sobre este recorrido.

## 14. Decisiones

### Tomadas (con la maqueta)

- Bifurcación por situación, no por identidad (§6).
- El entrenador que entrena empalma con «por mi cuenta» (§7.7).
- La elección regla/deslizar es una práctica (§5.5).
- Hacer = real, explicar = simulado y repetido sobre la pantalla real (§11.1).
- El entrenador monta su primera plantilla con el constructor y se la asigna al
  cliente que acaba de crear (§7.4-5); el catálogo, como atajo.
- Un constructor único con dos profundidades; el principiante solo responde una
  pregunta de progresión (§10).
- Sin paywall en el onboarding (§12).

### Abiertas

1. **Idioma**: ¿pantalla propia o el del móvil con un enlace «cambiar»?
2. **«Ya tengo cuenta»** en la bienvenida: ¿entra? (recomendado: sí).
3. **Orden del entrenador**: ¿preguntas de datos antes o después de crear el
   cliente? (acción primero engancha más; preguntas primero es más natural).
4. **Intermedio**: ¿constructor sencillo con enlace (como la maqueta) o completo?
5. **Plantilla a medias asignada**: el entrenador asigna una plantilla con B y C
   vacías; si el cliente se conecta antes de rellenarlas, le llega un programa a
   medias. ¿No se envía hasta que todas las sesiones tengan ejercicios, o se
   pregunta al conectar?
6. **«Es un grupo»** depende de [C06-01](C06-group-classes.md), aparcada. ¿Se
   reactiva o se quita del onboarding hasta entonces?
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
11. **Cómo ver el programa** (6-oct-2026): preguntar si se quiere Inicio en lista
    plegable o en pestañas ([U13](U13-inicio-pestanas.md)), enseñando las dos y
    cómo se usan. Escribe `profile.homeView`. ¿En los ajustes del principio o al
    final, cuando ya hay un programa que enseñar?

## 15. Siguiente paso

**O03-01 — Cerrar el flujo y dividirlo en tareas.** Resolver lo abierto de §14,
iterar la maqueta lo que haga falta y partir la spec en tareas. Orden previsible,
por dependencias:

- se puede hacer ya: tramo común (§5), bifurcación y rol (§6), camino «por mi
  cuenta» (§8), constructor (§10), aprender (§11);
- espera a M01-04 (invitación con enlace): conectar en el camino del entrenador
  (§7.6) y el enlace de invitación del camino con entrenador (§9.2);
- espera a C06-01 (si se mantiene): «es un grupo» (§7.3);
- instrumentación: A01-02, después de todo lo anterior.

### Código que se toca o reutiliza (verificado el 4-oct-2026)

| Pieza | Dónde |
|---|---|
| Primer arranque, solo unidades → desaparece | `src/screens/SetupScreen.jsx` (`setupComplete`) |
| Selector de modo, manual, plantilla propia, importar, flujo O01 | `src/screens/OnboardingScreen.jsx` |
| Ruta inicial | `src/navigation/RootNavigator.jsx` (`_initialRoute`, pantallas `Setup` y `Onboarding`) |
| Preferencia de la regla | `profile.scrubRuler` (`AppHeader.jsx:363`) |
| Tema | `setTheme` (`store/useStore.js:531`), `src/themes.js` |
| Pestañas de entrenador | `profile.proTabsHidden`, `RootNavigator.jsx` |
| Código de cliente | `src/components/ClientCodeModal.jsx` |
| Asignar programa | hoja de C07-02 |
| Pegar texto | `src/screens/PasteWorkoutScreen.jsx` (C05-05) |
| Progresión | `src/components/editor/ProgressionSheet.jsx` |
| Hojas | `src/components/DragSheet.jsx` |
| Paywall (no se abre desde aquí) | `src/components/PaywallModal.jsx` |
