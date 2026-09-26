# Spec — El entrenador apunta por el cliente

> Tema: conexión
> En corto: Para clientes que no usan la app, el entrenador registra sus entrenos, a mano o pegando un texto; si el cliente se conecta más tarde, recibe todo lo que se le apuntó.
> Fase C19 · pendiente · Registrar una sesión para un cliente sin conectar · §3
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
> **No depende** de [free-sessions.md](free-sessions.md), salvo en un detalle:
> si esa spec ya está hecha, registrar una sesión libre para un cliente sale
> gratis (§3.6).

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
   En la ficha de un cliente conectado, «Registrar sesión» **no aparece**.
2. **Si el cliente se conecta después, recibe todo lo apuntado**: historial y
   progreso de etapa (§4). A partir de ese momento apunta él.
3. **El texto se entiende sin IA**: formato cerrado + revisión antes de guardar
   + la app aprende los nombres de cada entrenador (§6).
4. **La pantalla de entreno es la misma.** Registrar para un cliente es un
   entreno normal cuyo dueño es otro. No se hace una pantalla nueva.

## 3. Fase C19 — Registrar una sesión para un cliente sin conectar

### 3.1 Entrada

En la ficha del cliente (`ClientsScreen`, pestaña Programas), junto a la
sesión que toca, un botón **REGISTRAR SESIÓN**. Solo si `!syncLinked` y el
cliente tiene programa activo.

Abre una hoja con dos preguntas:
1. **Qué sesión**: las de la etapa actual, con la que toca preseleccionada
   (`sessionPlan` con el log del cliente, igual que la tarjeta de cliente).
2. **Cuándo fue**: fila de chips con los últimos 7 días, «Hoy» preseleccionado.
   Sin selector de fecha: la app no tiene dependencia de calendario y 7 días
   cubren el caso real (apuntar el lunes lo del sábado). `ponytail:` si hace
   falta ir más atrás, añadir un «Otro día» con un picker nativo.

Botón **EMPEZAR** → Workout.

### 3.2 El entreno tiene dueño

`startSession(templateId, { forClient = null, loggedAt = null })`. Se guarda en
`activeSession.forClient` y `activeSession.loggedAt`. `INITIAL_ACTIVE_SESSION`
gana los dos campos a `null`.

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

### 3.3 Fecha

- `timestamp` de la entrada = `loggedAt` (el día elegido, a la hora actual) si
  lo hay; si no, `Date.now()`.
- `recordSession` recibe `today: localDay(loggedAt)`, para que una sesión
  apuntada tarde arranque la etapa el día que se entrenó.
- **Duración**: si la sesión es de otro día, `startedAt` no significa nada. Se
  guarda la duración estimada de la sesión (`sessionStats(template, allExercises).minutes`, `sessionStats.js:24`),
  que es la que usa la carga interna. `ponytail:` estimada, no medida. Si la
  carga de clientes offline sale rara, añadir un campo «Duración» en el recap.

### 3.4 Progreso

El progreso de un cliente sin conectar lo escribe el entrenador, y ya se guarda
en el propio programa: `athleteProgress(program, client)`
(`stageProgress.js:195`) solo usa el blob del cliente si existe, y un cliente
que nunca se conectó no lo tiene. Así que el `stageUpdate` de `saveSession`
(`useStore.js:2291`) funciona sin cambios. Lo único que hay que comprobar es
que `ownerProgram` se busca en `programs`, donde también están los programas de
los clientes.

### 3.5 Al acabar y mientras dura

- `saveSession` pone `ui.homeTab: 'session'` (`useStore.js:2198`). Con
  `forClient`, el recap vuelve a la ficha de ese cliente, no a Inicio.
- **Entreno de cliente en curso**: Inicio no lo ve, porque sus filas son las
  del programa del usuario. Hay que añadir dos avisos:
  - En Inicio, una fila discreta encima de las sesiones: «En curso: sesión de
    {cliente} · CONTINUAR».
  - En la ficha del cliente, REGISTRAR SESIÓN pasa a CONTINUAR.
- Empezar otro entreno mientras hay uno de cliente en curso pasa por
  `confirmDiscardActive` (`HomeScreen.jsx:374`) como cualquier otro.
- La cabecera del Workout dice de quién es el entreno: rótulo
  «{CLIENTE} · SESIÓN C», en el azul del entrenador.

### 3.6 Con sesiones libres

Si [free-sessions.md](free-sessions.md) ya está hecha, la hoja de §3.1 puede
ofrecer también «Sesión sobre la marcha». No se añade en esta fase: se anota
para cuando existan las sesiones libres de un cliente
([group-classes.md](group-classes.md) §4).

### 3.7 Probar en dispositivo

> **Probar en dispositivo.** Cliente sin conectar con programa: REGISTRAR
> SESIÓN → la que toca → Hoy. El Workout sale con los pesos del **cliente**, no
> con los tuyos. Guardar: la entrada aparece en el historial del cliente, sube
> su «N de M» y su etapa, y **tu** historial no cambia.

> **Probar en dispositivo.** Registrar una sesión de hace 3 días: en el
> historial del cliente aparece en ese día, y la carga la cuenta con la
> duración estimada.

> **Probar en dispositivo.** Salir del Workout de un cliente a medias: Inicio
> muestra «En curso: sesión de …» y se puede continuar.

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

### 4.4 Probar en dispositivo (dos móviles)

> **Probar en dispositivo (dos móviles).** Entrenador: cliente sin conectar,
> registrar 3 sesiones en días distintos. Dar el código. Cliente: canjear → la
> hoja dice «Tu entrenador ha apuntado 3 entrenos» con fusionar marcado. Tras
> conectar, el cliente ve las 3 en su historial, su etapa va por donde iba y su
> Inicio marca las sesiones de esta semana.

> **Probar en dispositivo (dos móviles).** Tras la conexión, el cliente entrena
> una sesión. El entrenador la recibe y **no** aparecen duplicadas las 3
> anteriores. En la ficha ya no sale REGISTRAR SESIÓN.

## 5. Fase C21 — Compartir una sesión como texto

En la ficha del cliente (y en el editor de sesión, menú ⋯), **Compartir como
texto** → hoja de compartir del sistema (`Share` de React Native, sin
dependencia nueva). El texto:

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

La utilidad pura `sessionToText(template, lib, t)` vive en
`src/utils/sessionText.js`, junto al lector de §6. **Test de ida y vuelta:**
lo que produce `sessionToText`, con números añadidos, lo entiende `parseSessionText`.

Es lo que hace fiable la C22: el cliente devuelve **el mismo texto con sus
números**, así que los nombres coinciden al 100 %.

## 6. Fase C22 — Pegar un texto y que la app lo entienda

### 6.1 Formato

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
(§6.3).

Líneas que no encajan (títulos, notas, líneas vacías): se ignoran y se
enseñan tachadas en la revisión, para que se vea que no se han perdido.

`parseSessionText(text)` es pura y con tests: una tabla de casos
entrada → salida, incluida la ida y vuelta de §5.

### 6.2 Los nombres

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

### 6.3 Flujo

1. En la ficha del cliente (sin conectar), el menú de REGISTRAR SESIÓN añade
   **Pegar texto**. Se abre la misma hoja de §3.1 (qué sesión y cuándo) con un
   campo de texto, que se rellena desde el portapapeles si hay algo.
2. **Revisión**: una fila por línea con el ejercicio reconocido y lo entendido
   («4 × 6 · 100 kg»). Las sin reconocer llevan ELEGIR, que abre el buscador de
   ejercicios de siempre y guarda el alias.
3. **CONTINUAR** abre el Workout con todo relleno. Los ejercicios que están en
   la sesión elegida van a sus series; los demás entran como ejercicios añadidos
   (ad-hoc). Es la misma pantalla que en §3, con las series ya puestas: **la
   revisión final es el propio Workout**, y el guardado es `saveSession`, sin
   un camino nuevo.

### 6.4 Probar en dispositivo

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
  mismo Workout. Registrar uno detrás de otro cubre casi todo.
- **Bonos de sesiones**: que registrar una sesión descuente del bono del
  cliente. Encaja justo encima de esta spec y de la facturación que ya existe.
  Va en su propia spec.
- Formatos de texto de otras apps.

## Fases

| Fase | Qué | Depende de | Aceptación |
|---|---|---|---|
| C19 | §3: entreno con dueño, fecha, recap y avisos de «en curso» | — | Pruebas de §3.7 |
| C20 | §4: subir lo apuntado, guarda anti-pisado, hoja del cliente | C19 | Pruebas de §4.4, con dos móviles |
| C21 | §5: `sessionToText` + compartir | — | Test de ida y vuelta |
| C22 | §6: `parseSessionText` + alias + revisión → Workout | C19, C21 | Tests del lector y pruebas de §6.4 |

C19 y C21 son independientes y pueden ir en paralelo.
