# Spec — El entrenador apunta por el cliente

> Tema: conexión
> En corto: Para clientes que no usan la app, el entrenador entrena con ellos desde su ficha o apunta después lo que hicieron; si el cliente se conecta más tarde, recibe todo lo apuntado.
> Fase C19 · pendiente · Entrenar y apuntar para un cliente sin conectar · §3
> Fase C20 · pendiente · Traspaso al conectarse: el cliente recibe lo apuntado · §4
> Fase C21 · pendiente · Compartir una sesión como texto · §5
> Fase C22 · pendiente · Pegar un texto y que la app lo entienda (sin IA) · §6
>
> Estado: **spec cerrada, SIN implementar** (26-sep-2026). Sale de una sesión de
> diseño Opus + usuario sobre los modelos de entrenador que la app no cubre
> (cliente offline, clases colectivas). La otra mitad es
> [group-classes.md](group-classes.md). Escrita después de leer el código; cada
> afirmación lleva fichero y línea, pero hay que volver a comprobarlas antes de
> cada fase.
>
> **Revisada el mismo 26-sep** tras un análisis por tipo de entrenador
> (presencial 1 a 1, semiprivado, coach por WhatsApp, clases, readaptador). Cambios:
> entrenar en vivo y apuntar lo pasado son **dos entradas distintas** (§2.5), la
> ficha de un cliente sin conectar **se parece a su Inicio** (§2.6), el modo
> registro va sin reloj ni descansos (§3.4), y pegar texto vive dentro de «Apuntar
> sesión pasada» (§6.3). Maqueta de todo lo visual:
> [`docs/mockups/trainer-models.html`](../mockups/trainer-models.html).
>
> **Orden recomendado**: C19 → C21 → (grupos: C23, C25, C26) → C20 → C24 → C22.
> La C22 va la última y **solo con una tabla de textos reales** de clientes (§6.1).
>
> **No depende** de [free-sessions.md](free-sessions.md), salvo en un detalle:
> si esa spec ya está hecha, registrar una sesión libre para un cliente sale
> gratis (§3.7).

---

## 1. Problema

Hoy **solo se entrena desde Inicio y siempre para uno mismo**:
`startSession` solo se llama en `HomeScreen.jsx:515`, y `saveSession` escribe
siempre en `workoutLog` (`useStore.js:2196`, `:2300`). Los entrenos de un
cliente viven en `clientLogs[clientId]` y solo entran por dos caminos: lo que
sube su móvil (`downloadHistory`) o un fichero importado (`importForClient`,
`useStore.js:806`).

Un entrenador con un cliente que no usa la app (entrena con él en persona, o le
manda la sesión por WhatsApp) no tiene forma de apuntar nada: ni progreso, ni
carga, ni adherencia.

## 2. Decisiones cerradas

1. **Solo para clientes sin conectar** (`!client.syncLinked`, que se refresca en
   `useStore.js:3447`). Los conectados apuntan ellos: su progreso es suyo (regla
   de oro de stage-locks) y hoy los datos solo viajan del cliente al entrenador.
2. **Si el cliente se conecta después, recibe todo lo apuntado**: historial y
   progreso de etapa (§4). A partir de ese momento apunta él.
3. **El texto se entiende sin IA**: formato cerrado + revisión antes de guardar
   + la app aprende los nombres de cada entrenador (§6).
4. **La pantalla de entreno es la misma.** Registrar para un cliente es un
   entreno normal cuyo dueño es otro. No se hace una pantalla nueva.
5. **Dos intenciones, dos entradas.** *Entrenar ahora con el cliente delante*
   (el presencial, el 90 % de los casos) y *apuntar lo que ya hizo* (el lunes lo
   del sábado, o lo que te mandó por WhatsApp) son cosas distintas:
   - **EMPEZAR** abre el Workout en vivo, hoy, sin hojas previas.
   - **Apuntar sesión pasada** abre una hoja (qué sesión, qué día) y el Workout
     en **modo registro**: sin reloj ni descansos (§3.4).
6. **Una acción principal por tipo de ficha.** Conectado → *Preparar* (lo de
   hoy, sin cambios). Sin conectar → *Empezar*. Grupo → *Pizarra*
   ([group-classes.md](group-classes.md)). Lo demás, en segundo plano.
7. **La ficha de un cliente sin conectar se parece a su Inicio**: la lista de
   sesiones de la etapa con la que toca en lima, las mismas piezas que Inicio
   (§3.1). Tú haces de su app, así que ves lo que vería él. La ficha de un
   conectado no cambia: allí él entrena y tú supervisas.

## 3. Fase C19 — Entrenar y apuntar para un cliente sin conectar

### 3.1 La ficha

Pestaña Programa de un cliente **sin conectar y con programa activo**. De arriba
abajo:

1. `ClientCodeBlock` si no se ha descartado (como hoy). Con entradas en el log
   del cliente, su texto explicativo cambia a «Dáselo a {name} si algún día usa
   la app: recibirá todo lo que le hayas apuntado» (clave nueva
   `clients.codeCard.explainLogged`). Es el embudo hacia la C20.
2. `ProgramCard` como hoy (adherencia, ritmo y carga salen del log que apunta
   el entrenador).
3. **SESIONES** con el contador de la semana («1 de 2 esta semana»), igual que
   Inicio: la que toca en la tarjeta lima (`TodayCard`) con **EMPEZAR SESIÓN B**,
   y el resto en filas plegables (`SessionRow`) que al abrirse enseñan los
   ejercicios y **EMPEZAR SESIÓN C**. `sessionPlan` con el log del cliente,
   igual que la tarjeta de cliente.
   - La ceja de la tarjeta lima dice «Le toca» (clave nueva), no «Mi entreno de
     hoy».
   - Abierta, cada fila lleva además **COMPARTIR** como secundario (C21, §5). En
     la tarjeta lima, COMPARTIR va dentro del desplegable, bajo los ejercicios.
4. **Apuntar sesión pasada**: botón de contorno bajo la lista, el mismo
   tratamiento que «+ Sesión libre» de Inicio (`freeSessionBtn`). Abre la hoja
   de §3.2.

**Fuera, para un cliente sin conectar**: la sección «Próxima sesión» con
*Preparar* y su pista. Preparar existe para mandar ajustes a un móvil que aquí
no hay: los ajustes se hacen en el propio Workout.

**Pieza compartida.** `TodayCard`, `SessionRow`, `ExerciseLines` y
`SectionHeader` viven hoy dentro de `HomeScreen.jsx` (`:179`, `:252`, `:338`).
Se mueven sin cambios a `src/components/SessionList.jsx` y los importan Inicio y
la ficha. La ficha de un grupo reutiliza lo mismo ([group-classes.md](group-classes.md) §5).
Grep de control: Inicio se ve idéntico antes y después del movimiento.

**En la lista de clientes** la tarjeta de un cliente sin conectar **no cambia**:
la diferencia está en la ficha. Solo dos añadidos:
- Con un entreno suyo en curso, el hueco derecho pasa a **Continuar** (CTA
  accent, **primero** en la prioridad de `ClientListCard`, `ClientsScreen.jsx:1591`).
- La pulsación larga (`ClientActionsSheet`, `ClientsScreen.jsx:1442`) añade
  arriba **Empezar sesión B**.

### 3.2 Hoja «Apuntar sesión pasada»

Dos preguntas y un botón:
1. **Qué sesión**: una fila de chips con las sesiones de la etapa actual
   (letra + nombre corto), con la que toca preseleccionada.
2. **Cuándo**: chips con hoy y los 6 días anteriores («Hoy», «Ayer», «Jue 24»…),
   **Hoy** preseleccionado: entrenó por la mañana y lo apuntas por la noche es
   un caso real. Sin selector de fecha: la app no tiene dependencia de
   calendario y 7 días cubren el caso real. `ponytail:` si hace falta ir más
   atrás, añadir un «Otro día» con un picker nativo.

Debajo, una línea: «Se abre sin reloj ni descansos: solo apuntas lo que hizo».
Botón **APUNTAR** → Workout en modo registro. Y una segunda salida, **Pegar
texto** (C22, §6.3); hasta que exista la C22, no se pinta.

### 3.3 El entreno tiene dueño

`startSession(templateId, { forClient = null, loggedAt = null, logOnly = false })`.
Se guardan en `activeSession.forClient`, `.loggedAt` y `.logOnly`.
`INITIAL_ACTIVE_SESSION` gana los tres campos (`null`, `null`, `false`). EMPEZAR
pasa solo `forClient`; la hoja de §3.2 pasa los tres.

Un helper en el store decide de qué historial se lee y en cuál se escribe:

```js
// El historial del dueño del entreno en curso: el mío o el del cliente.
const ownerLog = (s, clientId) => (clientId ? s.clientLogs[clientId] ?? [] : s.workoutLog);
```

Sitios que hoy leen `workoutLog` y pasan a leer `ownerLog`:

| Sitio | Qué hace |
|---|---|
| `WorkoutScreen.jsx:255`, `:323` | `lastExerciseRef`: pesos de la última vez y progresión |
| `saveSession` (`useStore.js:2145`, `:2232`) | Autorrelleno de series marcadas sin datos |
| `saveSession` al escribir (`:2196`, `:2300`) | La entrada va a `clientLogs[forClient]` |
| `SessionRecapScreen.jsx:127`, `:180`, `:181`, y `loadInfo` | Buscar la entrada, PRs, comparación y carga |
| `setSessionFeedback` (`useStore.js:2347`) | RPE y peso corporal: escribe en la entrada del cliente |

El recap recibe el dueño por parámetro de ruta:
`navigation.replace('SessionRecap', { entryId, clientId })`
(`WorkoutScreen.jsx:478`).

Grep de control: `grep -n "workoutLog" src/screens/WorkoutScreen.jsx
src/screens/SessionRecapScreen.jsx`. Cada lectura que quede tiene que tener un
motivo para ser la del usuario.

### 3.4 Modo registro

Con `activeSession.logOnly`:
- **Sin descansos.** `toggleSetDone` arranca el temporizador **siempre** que se
  marca una serie (`useStore.js:1927-1942`), y el calentamiento también
  (`ExerciseCard.jsx:167`). Una guarda al principio de `startRestTimer`
  (`useStore.js:2511`): `if (get().activeSession.logOnly) return;`. Una sola
  guarda en la función compartida, no en cada llamada. Sin ella, apuntar el
  lunes lo del sábado lanzaría una notificación de descanso con cada serie.
- **Sin reloj de sesión** en la cabecera del Workout.
- **Bloques AMRAP/EMOM/For time**: sin reloj; el resultado se escribe a mano
  (rondas, tiempo). Comprobar qué deja escribir hoy `ConditioningBlockCard` sin
  arrancar el reloj. Si no deja, se aparca y el bloque se apunta en la nota.
- **Duración**: la estimada de la sesión
  (`sessionStats(template, allExercises).minutes`, `sessionStats.js:24`), que es
  la que usa la carga interna. `ponytail:` estimada, no medida. Si la carga de
  clientes sin conectar sale rara, añadir un campo «Duración» en el recap.

En vivo (EMPEZAR) todo funciona como un entreno propio: reloj, descansos y
duración medida.

### 3.5 Fecha

- `timestamp` de la entrada = `loggedAt` (el día elegido, a la hora actual) si
  lo hay; si no, `Date.now()`.
- `recordSession` recibe `today: localDay(loggedAt)`, para que una sesión
  apuntada tarde arranque la etapa el día que se entrenó.

### 3.6 Progreso

El progreso de un cliente sin conectar lo escribe el entrenador, y ya se guarda
en el propio programa: `athleteProgress(program, client)`
(`stageProgress.js:195`) solo usa el blob del cliente si existe, y un cliente
que nunca se conectó no lo tiene. Así que el `stageUpdate` de `saveSession`
(`useStore.js:2291`) funciona sin cambios. Lo único que hay que comprobar es
que `ownerProgram` se busca en `programs`, donde también están los programas de
los clientes.

### 3.7 Al acabar y mientras dura

- `saveSession` pone `ui.homeTab: 'session'` (`useStore.js:2198`). Con
  `forClient`, el recap vuelve a la ficha de ese cliente, no a Inicio.
- **Entreno de cliente en curso**: Inicio no lo ve, porque sus filas son las
  del programa del usuario. Hay que añadir tres avisos:
  - En Inicio, una fila discreta encima de las sesiones: «En curso: sesión de
    {cliente} · CONTINUAR».
  - En la lista de clientes, el CTA **Continuar** de §3.1.
  - En la ficha, la tarjeta lima dice **CONTINUAR SESIÓN B** (la misma regla que
    Inicio, `startCta`, `HomeScreen.jsx:317`).
- Empezar otro entreno mientras hay uno de cliente en curso pasa por
  `confirmDiscardActive` (`HomeScreen.jsx:374`) como cualquier otro.
- La cabecera del Workout dice de quién es el entreno: rótulo
  «{CLIENTE} · SESIÓN C», en el azul del entrenador. En modo registro, además,
  la fecha: «{CLIENTE} · SESIÓN C · SÁB 20».
- **Sesiones libres**: si [free-sessions.md](free-sessions.md) ya está hecha,
  las sesiones libres del cliente ([group-classes.md](group-classes.md) §4) salen
  en su ficha con las mismas filas y el mismo EMPEZAR. No se añade nada en esta
  fase.

### 3.8 Probar en dispositivo

> **Probar en dispositivo.** Cliente sin conectar con programa: la ficha enseña
> SESIONES con la que toca en lima. EMPEZAR SESIÓN B → el Workout sale con los
> pesos del **cliente**, no con los tuyos, y con reloj y descansos. Guardar: la
> entrada aparece en el historial del cliente, sube su «N de M» y su etapa, y
> **tu** historial no cambia.

> **Probar en dispositivo.** Apuntar sesión pasada → la A → hace 3 días. El
> Workout no tiene reloj, y marcar series **no** lanza el descanso ni su
> notificación. En el historial del cliente aparece en ese día, y la carga la
> cuenta con la duración estimada.

> **Probar en dispositivo.** Salir del Workout de un cliente a medias: Inicio
> muestra «En curso: sesión de …», su tarjeta en Clientes dice Continuar, y se
> puede continuar desde cualquiera de los dos.

> **Probar en dispositivo.** Inicio se ve **idéntico** tras mover `TodayCard` y
> `SessionRow` a `SessionList.jsx`.

## 4. Fase C20 — Traspaso al conectarse

### 4.1 Lo que ya existe

El camino ya está hecho, porque es el de «reinstalar recupera»:

- El slot guarda un historial (`history_json`) con entradas, ejercicios propios
  y progreso (`uploadHistory`, `supabaseSync.js:124`).
- Al conectarse, el cliente lo descarga y restaura el progreso siempre, y las
  entradas si elige fusionar (`_restoreFromSlot`, `useStore.js:3546`).
- La hoja del código ya ofrece fusionar cuando hay historial remoto
  (`ClientCodeModal.jsx:361`).
- **El entrenador ya puede escribir en ese campo.** La política «Trainer manages
  their slots» es `ALL` sobre sus filas (`supabase/secure_trainer_clients.sql`,
  resumen final). **No hace falta SQL nuevo.**

Lo que falta es que el entrenador suba lo apuntado.

### 4.2 Subir lo apuntado

`pushTrainerLogToSlot(clientId)`:
- Solo si el cliente tiene `syncSlotId` y **no** está conectado.
- Sube `clientLogs[clientId]`, sus ejercicios propios y
  `athleteProgress(program, client)` con `uploadHistory`, el mismo formato que
  sube un cliente.
- Añade `source: 'trainer'` al payload, para que la hoja del cliente sepa de
  dónde viene (§4.3).

Se llama en dos momentos:
1. Al guardar una sesión registrada (§3), en segundo plano. Si falla, no avisa:
   se reintenta en el siguiente.
2. En `uploadProgramToClient` (`useStore.js:3183`), para que al dar el código
   todo esté arriba aunque el paso 1 fallara.

**Guarda contra pisar al cliente.** Si el cliente se conecta y el entrenador aún
no lo sabe (`syncLinked` se refresca al tirar), una subida del entrenador podría
pisar el historial que el cliente ya subió. Antes de subir, se relee el slot
(`getTrainerSlots`, `supabaseSync.js:341`). Si ya tiene `client_id`, no se sube
y se marca `syncLinked: true`. Queda una ventana de segundos entre leer y
escribir. Es aceptable, porque en ese momento el cliente aún no ha podido
entrenar con la app.

### 4.3 Lo que ve el cliente

Si el historial remoto trae `source: 'trainer'`:
- La hoja del código **preselecciona fusionar** (hoy preselecciona «Solo el
  programa», `ClientCodeModal.jsx:55`).
- El texto dice «Tu entrenador ha apuntado {n} entrenos tuyos».
- El progreso se restaura siempre, como hoy. Lo fusiona `mergeProgressOnImport`,
  que ya prioriza una activación de etapa más reciente.

Después de conectarse, el cliente sube su historial ya fusionado y manda él. El
entrenador lo descarga como siempre. Las entradas apuntadas por él tienen el
mismo id, así que `mergeClientLog` (`clientLogs.js:120`) no las duplica.

**En la ficha del entrenador**, al pasar a conectado, la lista de sesiones con
EMPEZAR se sustituye por la «Próxima sesión» con *Preparar* de siempre, y su pista
dice «Entrena con su app: lo que haga te llega solo» (clave nueva
`clients.nextSessionHintLinked`). Esa línea explica por qué ya no está EMPEZAR.

### 4.4 Probar en dispositivo (dos móviles)

> **Probar en dispositivo (dos móviles).** Entrenador: cliente sin conectar,
> registrar 3 sesiones en días distintos. Dar el código. Cliente: canjear → la
> hoja dice «Tu entrenador ha apuntado 3 entrenos» con fusionar marcado. Tras
> conectar, el cliente ve las 3 en su historial, su etapa va por donde iba y su
> Inicio marca las sesiones de esta semana.

> **Probar en dispositivo (dos móviles).** Tras la conexión, el cliente entrena
> una sesión. El entrenador la recibe y **no** aparecen duplicadas las 3
> anteriores. En la ficha ya no sale EMPEZAR y la pista explica por qué.

## 5. Fase C21 — Compartir una sesión como texto

**Dónde**: botón **COMPARTIR** en las filas de sesión abiertas de la ficha (§3.1,
y las de un grupo en [group-classes.md](group-classes.md) §5), y en el menú ⋯ del
editor de sesión. Abre la hoja de compartir del sistema (`Share` de React
Native, sin dependencia nueva). Sirve para los tres casos: al cliente que no usa
la app, al grupo de WhatsApp de una clase, y a un conectado si lo pide.

El texto:

```
Sesión C · Pierna fuerza
Sentadilla 4x6
Peso muerto rumano 3x8
Zancada búlgara 3x10
Plancha 3x40s
```

- Una línea por ejercicio: nombre en el idioma de la app + series × objetivo
  (`targetLabel` en modo compacto, `prescription.js:18`).
- Los bloques salen con su formato: `AMRAP 12' — 10 wall balls, 10 burpees`.
- Si el cliente tiene pesos de la última vez, se añaden: `Sentadilla 4x6 · última 100`.
  En un grupo no (no hay pesos individuales).

La utilidad pura `sessionToText(template, lib, t)` vive en
`src/utils/sessionText.js`, junto al lector de §6. **Test de ida y vuelta:**
lo que produce `sessionToText`, con números añadidos, lo entiende `parseSessionText`.

Es lo que hace fiable la C22: el cliente devuelve **el mismo texto con sus
números**, así que los nombres coinciden al 100 %.

## 6. Fase C22 — Pegar un texto y que la app lo entienda

### 6.1 Antes de escribir código: textos reales

La tabla de tests **se escribe con mensajes reales** de clientes, no con los
que imaginamos. Mínimo 20, pedidos a entrenadores que trabajen por WhatsApp. La
forma real suele ser «sentadilla 100 100 95, la última me costó», y el formato
de §6.2 se ajusta a lo que salga. **Sin esa tabla, la C22 no empieza.**

### 6.2 Formato

Una línea por ejercicio: `<nombre> <series>`. Las formas de `<series>`:

| Escrito | Se entiende como |
|---|---|
| `4x6 100` · `4x6x100` · `4x6 @100kg` | 4 series de 6 a 100 |
| `100x8, 100x8, 95x7` (lista separada por comas) | Una serie por elemento: peso × reps |
| `3x10` sin peso | 3 series de 10, sin peso |
| `3x40s` · `3x1'` | 3 series por tiempo |
| `... @8` al final | RPE 8 |
| `kg` / `lb` | Se ignoran; se asume la unidad del usuario |

**Regla de la ambigüedad:** `NxR` suelto son series × reps; en una lista, cada
`AxB` es peso × reps. Es la convención habitual y está escrita en la hoja
(§6.4).

Líneas que no encajan (títulos, notas, líneas vacías): se ignoran y se
enseñan tachadas en la revisión, para que se vea que no se han perdido.

`parseSessionText(text)` es pura y con tests: la tabla de §6.1 como casos
entrada → salida, más la ida y vuelta de §5.

### 6.3 Los nombres

La biblioteca tiene 182 ejercicios con `name` y `nameEn` y **sin sinónimos**
(`src/data/exerciseLibrary.js`). Orden de búsqueda para cada nombre:
1. Coincidencia exacta, sin tildes ni mayúsculas, con `name` / `nameEn` de la
   biblioteca y de los ejercicios propios.
2. **Alias aprendidos del entrenador**: `exerciseAliases: { 'banca':
   'bench_press_barbell' }`, persistido y en el backup.
3. Si no hay coincidencia, se deja «sin reconocer».

La primera vez que el entrenador resuelve «banca» a mano, se guarda como alias.
**No hay coincidencia aproximada** (distancia de edición…): «press banca» podría
ser con barra o con mancuernas, y equivocarse en silencio es peor que
preguntar una vez.

### 6.4 Flujo

1. En la hoja **Apuntar sesión pasada** (§3.2), la segunda salida **Pegar
   texto**. Un texto siempre habla de algo que ya pasó, así que vive ahí y no
   en un menú aparte. Qué sesión y cuándo se eligen igual; se añade un campo de
   texto, que se rellena desde el portapapeles si hay algo.
2. **Revisión**: una fila por línea con el ejercicio reconocido y lo entendido
   («4 × 6 · 100 kg»). Las sin reconocer llevan ELEGIR, que abre el buscador de
   ejercicios de siempre y guarda el alias.
3. **CONTINUAR** abre el Workout en modo registro con todo relleno. Los
   ejercicios que están en la sesión elegida van a sus series; los demás entran
   como ejercicios añadidos (ad-hoc). Es la misma pantalla que en §3, con las
   series ya puestas: **la revisión final es el propio Workout**, y el guardado
   es `saveSession`, sin un camino nuevo.

### 6.5 Probar en dispositivo

> **Probar en dispositivo.** Compartir una sesión como texto por WhatsApp,
> añadir números como lo haría un cliente, copiarlo y pegarlo: todos los
> ejercicios se reconocen y el Workout sale relleno.

> **Probar en dispositivo.** Pegar un texto escrito a mano con «banca»: pide
> elegir el ejercicio. En el segundo texto con «banca» ya no lo pide.

## 7. Fuera de alcance

- **Registrar para clientes conectados** (el entrenador apunta y le llega al
  cliente). Necesita un canal entrenador → cliente para el historial y romper
  la regla de que el progreso es del cliente. Decisión §2.1.
- **Semiprivado**: varios clientes a la vez, cada uno con su sesión, en un
  mismo Workout. **No está cubierto**: registrar uno detrás de otro obliga a
  apuntarlo después, de memoria, porque solo hay un `activeSession`. Es un
  modelo de negocio común (estudios de 2-4 personas) y el día que se aborde
  necesita varios entrenos en curso a la vez. Nada de esta spec lo impide:
  `forClient` ya separa el dueño.
- **Bonos de sesiones**: aparcado. La facturación actual podría desaparecer, así
  que no se construye nada encima.
- Formatos de texto de otras apps.

## Fases

| Fase | Qué | Depende de | Aceptación |
|---|---|---|---|
| C19 | §3: ficha con lista de sesiones, EMPEZAR, hoja de sesión pasada, modo registro, dueño, fecha y avisos de «en curso» | — | Pruebas de §3.8 |
| C20 | §4: subir lo apuntado, guarda anti-pisado, hoja del cliente, pista en la ficha | C19 | Pruebas de §4.4, con dos móviles |
| C21 | §5: `sessionToText` + COMPARTIR | C19 (las filas donde vive el botón) | Test de ida y vuelta |
| C22 | §6: tabla de textos reales, `parseSessionText` + alias + revisión → Workout | C19, C21 | Tests del lector y pruebas de §6.5 |
