# Spec — Sesiones libres de verdad

> Tema: entrenamiento
> En corto: Una sesión libre guardada pasa a ser una sesión normal sin programa: se edita con el mismo editor, puede estar a la vista en Inicio, progresa por su cuenta y, al acabarla, puedes decir que sustituye a una sesión del programa.
> Fase T19 · hecho · Modelo: la sesión libre es un `sessionTemplate` sin programa · §4
> Fase T20 · hecho · Editor de sesión en modo libre · §5
> Fase T21 · hecho · Inicio: sección «Sesiones libres» y hoja de «＋ Sesión libre» · §6
> Fase T22 · hecho · Recap: guardar, añadir ejercicios y «Cuenta como sesión X» · §7
> Fase T23 · hecho · Quién cuenta qué: sesión que toca, adherencia, Progreso y entrenador · §8
>
> Estado: **✅ IMPLEMENTADA ENTERA** (26-sep-2026, rama `feat/free-sessions`:
> T19 `93ee875`, T20 `c45f078`, T21 `2b8dd59`, T22 `aa24148`, T23 `0538ed0`,
> más dos arreglos de QA `c8a64ab` y `2b31670`), pendiente de probar en
> dispositivo (§11). Cosas que salieron distintas de lo escrito:
> - El botón «Guardar como sesión libre» del recap (§7.1) entró ya en T19: sin
>   él la app se quedaba sin forma de guardar tras borrar las plantillas viejas.
> - Botones de las filas de Inicio (QA 26-sep, vale para TODAS las filas salvo
>   la de hoy): sólidos y a todo el ancho. EMPEZAR/CONTINUAR en `accent` con
>   texto `onAccent`; REPETIR (sesión ya hecha esta semana) y EDITAR en
>   `surface2` sin borde, la variante Secondary de la app.
> - `targetLabel` leía la progresión solo de la librería: un ejercicio submáx en
>   la librería (flexiones, burpees…) pasado a doble en la sesión seguía saliendo
>   «submáx», y sin rango pintaba «null». Ahora manda la sesión, y lo que falta
>   sale de `DEFAULT_TARGET` (`progression.js`: 8–12 reps / 20–40 s), el mismo
>   valor que ya enseñaba el editor y usaba el motor. Caso real: el paseo del
>   granjero (doble progresión, sin rango en la librería) salía «submáx» en
>   Inicio mientras el editor decía «8–12, automática».
> - Las claves de texto del editor van en `freeSession.*` (`badge`,
>   `toastSaved`), no en `editor.*`: son de la sesión libre, no del editor.
> - «Cuenta como» usa el `SegmentedControl` (opción «No» + una por sesión), así
>   que no hace falta «tocar la elegida para quitarla»: se elige «No».
> - La regla de §8 vive en dos helpers de `freeSessions.js`:
>   `programTemplateOf(e)` y `countsForProgram(e)`.
>
> Spec escrita el 25-sep-2026. Sale de una sesión de
> diseño Opus + usuario. Las tres decisiones de §2 las cerró el usuario. Se
> escribió **después** de leer el código, y cada afirmación sobre él lleva
> fichero y línea. Aun así, antes de cada fase hay que comprobar contra el código
> lo que se da por hecho (lección de training-load y de home-sessions).
>
> **Revisada 26-sep-2026:** las sesiones libres llevan dueño (§4.1.1) para que
> la siguiente feature (sesiones libres de clientes y grupos) no obligue a
> migrar datos. No cambia ninguna fase.
>
> **Sustituye** las plantillas de sesión libre de
> [home-sessions.md](home-sessions.md) §7 (U09): `freeSessionPresets`
> desaparece.

---

## 1. Problema

Hoy conviven dos cosas que se llaman «sesión libre» y ninguna es una sesión:

| Qué | Dónde | Qué le falta |
|---|---|---|
| La sesión **sobre la marcha** (`templateId: '__free__'`) | `startFreeSession`, `useStore.js:1772`; se guarda en `saveSession`, `useStore.js:2162` | Nada: es lo que tiene que ser |
| La **plantilla** (`freeSessionPresets`) | `src/utils/freeSessionPreset.js` | Solo guarda ejercicios, número de series, reps/tiempo, descanso y bloques. **No se puede editar** (el editor de sesión no sabe abrirla), no tiene progresión, calentamiento, superseries ni dropsets, y no se ve en Inicio |

El usuario quiere sesiones «sueltas» (movilidad, agarre, una sesión de hotel)
que se hagan de vez en cuando o a diario **sin desestructurar el programa**, que
se puedan editar como cualquier sesión, tener a la vista en Inicio y, en el
futuro, compartir.

## 2. Decisiones cerradas

1. **Una sesión libre guardada es un `sessionTemplate` con `programId: null`.**
   No es un formato aparte. Con eso el editor de sesión, el de ejercicio, el de
   bloque, el Workout, el recap y la progresión de pesos funcionan sin ramas
   nuevas (§3). La sesión sobre la marcha (`'__free__'`) se queda tal cual.

2. **La carga cuenta siempre.** Toda sesión, libre o no, entra en la carga de
   entrenamiento (RPE de sesión, carga externa, series por grupo, relación
   aguda/crónica), en la tira de la semana y en el progreso de cada ejercicio.
   El cansancio es real: dejar fuera una hora de agarre falsea el panel. **Hoy
   ya es así** (`StatsScreen.jsx:41` pasa el `workoutLog` entero y `LoadTab` no
   filtra por programa) y **no se toca**.

3. **Que una sesión libre cuente como día del programa es una sustitución
   explícita: «Cuenta como Sesión C»**, que se elige en el recap. No hay un
   sí/no de «afecta al progreso». Con un sí/no la app no sabría qué día se ha
   cubierto: el contador de la etapa subiría pero la C seguiría siendo la que
   toca, y eso es incoherente. Al elegir la sesión, todo lo que mira el programa
   lo trata como la C: contador de etapa, sesión que toca, «N de M esta semana»,
   adherencia y el filtro «programa actual».

4. **El entrenador ve todas las sesiones libres**, como hoy
   (`clientLogs.js:93`): las necesita para leer la carga de su cliente. Solo
   cuentan para la adherencia las que sustituyen a una sesión. Si algún día se
   quiere privacidad, será una opción «privada» por sesión, no ligada al
   progreso (fuera de alcance, §10).

5. **Los pesos del programa nunca aprenden de una sesión libre.** Hoy ya es así
   y sigue siéndolo: `lastExerciseRef` (`exerciseLinks.js:114`) busca por la
   cadena de plantillas de la sesión, y una sesión libre es otra plantilla. Tu
   press de técnica a 60 kg no rebaja el press del programa. **Ni siquiera con
   «Cuenta como»**: sustituir un día no hace que la sesión sea la C.

## 3. Lo que sale solo al ser un `sessionTemplate`

Comprobado contra el código, y **no hay que tocarlo**:

| Pieza | Por qué funciona sin cambios |
|---|---|
| Empezar | `startSession(templateId)` (`useStore.js:1754`) no mira el programa |
| Workout | El camino normal de plantilla. `getActiveBlocks` (`useStore.js:241`) lee `template.blocks` |
| Guardar | La rama normal de `saveSession`. `ownerProgram` sale `null` (`useStore.js:2288`), así que **no toca el contador de etapa** |
| Prellenar pesos y progresión Auto | `lastExerciseRef` por `templateChainIds`: la sesión libre aprende de sí misma |
| Recap: comparación con la última vez | `compareToLast` (`sessionRecap.js:185`) compara por `sessionTemplateId` |
| Vinculación de ejercicios | `programTemplateIds(undefined)` devuelve un conjunto vacío (`clientLogs.js:12`), así que `showLinking` es `false` en `ExerciseEditorInline.jsx:317` y la sección no aparece |
| Filtro «programa actual» de Progreso | Filtra por los ids del programa (`ProgressTab.jsx:77`, `:566`): la libre queda fuera sola |
| Backup completo | `sessionTemplates` ya va entero en `backupPayload.js` y se restaura con `mergeFileSessions` (`useStore.js:835`, `:856`) |
| Borrar un programa | `purgeProgram` (`useStore.js:171`) solo borra los ids del programa: las libres no se tocan |

## 4. Fase T19 — Modelo

### 4.1 Forma

```js
sessionTemplates[id] = {
  id,                  // generateId('tpl')
  programId: null,     // ← lo que la hace libre
  owner:     'me',     // de quién es: 'me' o el id de un cliente (§4.1.1)
  label:     null,     // sin letra
  name,                // '' permitido; se pinta «Sesión libre»
  onHome:    true,     // visible en Inicio
  emphasis: '', color: null,
  exercises: [ /* exConfig normales, los de addExercise */ ],
  blocks:    [ /* ConditioningBlock con id */ ],
}
```

Una sola regla para saber si una plantilla es libre: `!template.programId`.

#### 4.1.1 El dueño

Cada sesión libre lleva **`owner`**, igual que los programas (`'me'` o el id
de un cliente). En esta spec **siempre es `'me'`**: todas las sesiones libres
que se crean aquí son del propio usuario.

Se pone ya, aunque nadie use otro valor, porque la siguiente feature (sesiones
libres asignadas a un cliente o a un grupo) lo necesita. Si no está desde el
primer día:
- las sesiones libres que el entrenador cree para un grupo **le saldrían en su
  propio Inicio**, mezcladas con las suyas;
- habría que migrar después todas las plantillas ya creadas.

Reglas que valen desde ya, aunque hoy no se note:
- **«Mías» es `owner === 'me'`**, no `!programId` a secas. Inicio, «Mis
  sesiones libres» y el recap (§6, §7) filtran por eso.
- `programId: null` dice que la sesión es libre; `owner` dice de quién es. Son
  dos preguntas distintas y no se deducen una de otra.
- Al borrar un cliente habrá que borrar también sus sesiones libres, como hace
  `purgeProgram` con sus programas. **No se implementa aquí**, porque aún no
  puede existir ninguna; queda escrito para la spec que las introduzca.

### 4.2 La entrada del historial

Toda entrada de una sesión libre, de los dos tipos, se guarda con
**`free: true`**:

| Tipo | `sessionTemplateId` | `free` |
|---|---|---|
| Sobre la marcha | `'__free__'` | `true` (nuevo) |
| Desde una sesión libre guardada | el id de la plantilla | `true`: en `saveSession`, rama normal, `...(!template.programId ? { free: true } : {})` |

**Por qué hace falta el campo:** en el móvil del entrenador la plantilla no
existe. Sin `free`, una entrada con `sessionTemplateId: 'tpl_x'` desconocido no
se distinguiría de una sesión de un programa borrado. Y en el del cliente,
`clientLogs.js:93` **dejaría de subir** las sesiones libres guardadas, porque
solo deja pasar `'__free__'`. Este fallo sería silencioso: el entrenador dejaría
de verlas sin que nada avisara.

Helper único en `src/utils/freeSessions.js` (ver §4.4):

```js
export const isFreeEntry = (e) => e?.free === true || e?.sessionTemplateId === '__free__';
```

La segunda condición cubre las entradas de antes de esta spec.

Además, la entrada puede llevar **`countsAs: templateId`** (§7.3).

### 4.3 Acciones del store

| Acción | Qué hace |
|---|---|
| `createFreeTemplate(plan = null, owner = 'me')` → `id` | Crea la plantilla de §4.1. Vacía, o desde un plan con la forma de `presetFromEntry`. En esta spec nadie pasa `owner` |
| `saveEntryAsFreeTemplate(entryId)` → `id` | `createFreeTemplate(presetFromEntry(entry))` y **reapunta la entrada**: `sessionTemplateId = id`, `free: true`. Así esa primera vez ya es el historial de la plantilla: la próxima vez sale con los pesos puestos y el recap compara |
| `setFreeTemplateOnHome(id, bool)` | Cambia `onHome` |
| `deleteFreeTemplate(id)` | Borra la plantilla. **Rechaza** si es la `activeSession.templateId`. El historial no se toca: las entradas llevan `sessionName` y `free` |
| `setEntryCountsAs(entryId, templateId \| null)` | §7.3 |

Se **borran** `saveFreeSessionPreset`, `updateFreeSessionPreset`,
`deleteFreeSessionPreset` y el campo `freeSessionPresets`
(`useStore.js:417`, `:1139-1168`). También `freePresetId` de
`INITIAL_ACTIVE_SESSION` (`useStore.js:230`) y de la entrada (`useStore.js:2180`).
`startFreeSession(preset)` pasa a no aceptar argumento: solo arranca en blanco.

### 4.4 `src/utils/freeSessions.js`

Sale de renombrar `freeSessionPreset.js` (y su test):

- `presetFromEntry(entry)` — **se queda igual**, con sus tests. Es el paso
  «entrada → plan».
- `freeTemplateFromPreset(preset, { id, owner = 'me', newBlockId, lib })` — **nueva**, pura.
  Convierte el plan en la plantilla de §4.1. Cada ejercicio lleva los mismos
  valores por defecto que `addExercise` (`useStore.js:1187`: `isKey: false`,
  `restSec: def.restSec ?? 90`, `minReps`/`maxReps` de la biblioteca,
  `progressionOverride: null`, `limitationNote: null`, `order`), pisados por lo
  que traiga el plan (`sets`, `minReps`, `maxReps`, `minTime`, `maxTime`,
  `restSec`). A los bloques se les pone `id: newBlockId()`.
- `freeSessionFromPreset` — **se borra**: empezar una plantilla ya es
  `startSession`.
- `isFreeEntry` — §4.2.

Test: el plan de un `presetFromEntry` real da una plantilla con los mismos
ejercicios, series y objetivos, con valores por defecto donde el plan no dice
nada, y bloques con id nuevo.

### 4.5 Migración de `freeSessionPresets`

La retrocompatibilidad no es obligatoria, pero el usuario tiene plantillas
reales en el móvil y convertirlas son pocas líneas. Se hace en **dos puertas,
con la misma función**:

1. `onRehydrateStorage` (`useStore.js:4172`): cada preset pasa a plantilla con
   `freeTemplateFromPreset`, `owner: 'me'` y `onHome: true`, y
   `freeSessionPresets` se borra.
2. Importar un backup viejo (`useStore.js:2871`): lo mismo con
   `data.freeSessionPresets`, en vez de fusionarlos.

`backupPayload.js:42` deja de escribir la clave.

## 5. Fase T20 — Editor de sesión en modo libre

Se abre con `navigation.navigate('SessionEditor', { templateId })`, sin
`programId`. El modo libre es `!template.programId`.

| Pieza de `SessionEditorScreen` | En modo libre |
|---|---|
| Segmented de sesiones A/B/C (`days`, `:243`) | No aparece. Ya sale vacío porque `program` es `undefined`: **comprobarlo**, no darlo por hecho |
| Ceja de la cabecera | «Sesión libre» en vez de la etapa |
| Nombre | Editable como hoy (`renameSession`). Vacío → placeholder «Sesión libre» |
| Menú ⋯: duplicar / eliminar del programa | Se sustituye por **Eliminar sesión libre** (confirmación; deshabilitado si es la sesión en curso) |
| **Mostrar en Inicio** | Fila con interruptor, justo bajo la cabecera y antes de la lista. Es la única opción de la sesión libre y tiene que verse sin abrir un menú. Usar el interruptor que ya tenga la app en otra pantalla, no uno nuevo |
| Ejercicios, bloques, arrastre, swipe | Igual |

**`useEditorExit` hay que tocarlo, o rompe a los clientes.** Hoy `commit()`
(`useEditorExit.js:31`) marca **el programa activo** como pendiente de reenviar
a los clientes y dice «Programa editado». Editar una sesión libre haría las dos
cosas mal. Fix: `useEditorExit(navigation, templateId)`. Si esa plantilla no
tiene `programId`, `commit` no marca nada y el toast es «Sesión guardada». Los
tres llamantes que tienen `templateId` (sesión, ejercicio, bloque) lo pasan; el
editor de programa no pasa nada y se queda como está.

**Cuando existan sesiones libres de un cliente** (siguiente spec), editar una
de ellas tendrá que marcar a **ese cliente** como pendiente de reenviar, igual
que hoy pasa con su programa. Aquí no hay que hacer nada: el `commit` de arriba
solo tiene que mirar la plantilla, no suponer que es del usuario.

**No llamar a `beginEditSession`** en modo libre. Su foto restaura
`sessionTemplates` entero al cancelar (`useStore.js:940`) y está pensada para el
programa. En modo libre no hay cancelar: todo se guarda al momento, como ya dice
la cabecera de `useEditorExit`.

**Sesión creada y abandonada vacía.** «Crear» (§6.2) da de alta la plantilla
antes de abrir el editor. Si sales sin añadir nada, se borra al desmontar
`SessionEditorScreen`: `useEffect` de limpieza, solo en modo libre, si
`exercises` y `blocks` están vacíos. El editor sigue montado mientras hay
pantallas encima (selector de ejercicio, editor de ejercicio), así que la
limpieza solo corre al salir de verdad.

## 6. Fase T21 — Inicio

### 6.1 La sección

Orden en `HomeScreen`:

```
…sesiones del programa (plan.rows)
SESIONES LIBRES                 ← rótulo, solo si hay alguna mía con onHome
[fila] Movilidad diaria   ~15 min
[fila] Agarre             hace 3 días
[＋ SESIÓN LIBRE]              ← el botón de hoy (HomeScreen.jsx:647)
ProgramCard…
```

- Las filas son el **`SessionRow` de siempre** (`HomeScreen.jsx:179`), con el
  hueco de marcador **vacío**: sin letra, como pidió el usuario. El hueco se
  mantiene para que los nombres queden alineados con los de las sesiones del
  programa. Nunca van hechas ni con `adapted`.
- Meta: la última vez si la hay (`relativeTime`); si no, `~{min} min`
  (`sessionStats`). Mismo criterio que las filas del programa.
- Al desplegar: `ExerciseLines` + pie con **EMPEZAR** (el `sesBtn` de hoy) y
  **EDITAR** a su lado, en variante discreta. La variante es la de
  `stageBannerBtnQuiet` (`HomeScreen.jsx`, banner de etapa): contorno
  `accent-50` y texto `accent`. No hay nodo de Figma, así que hereda anatomías
  ya cerradas, igual que el recap (ver `docs/UI-MIGRATION.md`).
  `SessionRow` gana la prop opcional `onEdit`: sin ella, nada cambia.
- EMPEZAR → `requestStart(templateId)` (`HomeScreen.jsx:512`), que ya pide
  confirmar si hay otra sesión en curso. En curso → CONTINUAR (`startCta`).
- EDITAR → `SessionEditor` en modo libre.
- Orden: el de creación. Reordenar queda fuera (§10).
- Comparte el acordeón con las filas del programa (`openId`): abrir una cierra
  la otra.
- El rótulo usa el mismo estilo que el de SESIONES de arriba.
- **Solo las mías:** `owner === 'me' && onHome` (§4.1.1).
- **Hacer la sección reutilizable.** La ficha de cliente la necesitará tal cual
  para las sesiones libres de un cliente o un grupo. Que la sección reciba la
  lista de sesiones y las acciones (empezar, editar) por props, en lugar de
  leer del store las del usuario. No se extrae a otro fichero hasta que haya
  un segundo sitio que la use.

**Sin programa activo la sección también sale.** Hoy la sesión libre entera
está dentro de la rama con programa y `NoProgram` se queda solo
(`HomeScreen.jsx:664`). Tener sesiones libres sin programa es justo uno de los
casos de uso.

### 6.2 La hoja de «＋ Sesión libre»

Se abre **siempre** (hoy solo con plantillas, `HomeScreen.jsx:396`). Si la
sesión en curso es `'__free__'`, el botón sigue diciendo «Continuar sesión
libre» y va directo al Workout, como hoy.

| Fila | Qué hace |
|---|---|
| **Empezar ya** | `startFreeSession()`: sobre la marcha, como hoy |
| **Crear sesión libre** | `createFreeTemplate()` → `SessionEditor` en modo libre |
| **Mis sesiones libres (n)** | Solo si n > 0. Abre la segunda hoja |

La segunda hoja reemplaza a la de plantillas de hoy (`HomeScreen.jsx:697`):
todas mis sesiones libres (`owner === 'me'`), primero las `onHome`. Tocar la fila → empezar. A la
derecha, en lugar de la ✕, **EDITAR** → editor. Es el único camino al editor
para las que no están en Inicio. Borrar pasa al editor, donde se ve lo que se
borra.

Así quedan cubiertos los casos del punto 4 del usuario:

| Caso | Camino |
|---|---|
| Empezar sobre la marcha | ＋ → Empezar ya |
| Crearla con el editor | ＋ → Crear |
| Empezar una que está en Inicio | La fila → EMPEZAR |
| Empezar una que no está en Inicio | ＋ → Mis sesiones libres → la fila |
| Convertir una sobre la marcha en guardada | Recap → Guardar como sesión libre (§7.1) |

### 6.3 Workout

- Rótulo: si `!template.programId`, `t('freeSession.badge')` en vez de
  `workout.sessionLabel` (`WorkoutScreen.jsx:459`). El título es el nombre de la
  plantilla, sin editar (se renombra en el editor).
- Lo demás, camino de plantilla normal: `isFree` en `WorkoutScreen` sigue
  queriendo decir **sobre la marcha** (`'__free__'`) y no se toca.

## 7. Fase T22 — Recap

Todo en la zona donde hoy están los botones de plantilla
(`SessionRecapScreen.jsx:539`). El recap solo se abre justo después de guardar
(`WorkoutScreen.jsx:478`, único `navigate('SessionRecap')`), y §7.3 se apoya en
eso.

### 7.1 Sobre la marcha (`'__free__'`)

**Guardar como sesión libre** → `saveEntryAsFreeTemplate(entry.id)`. El botón se
queda en «Guardada» como hoy (`templateSaved`). La nueva sesión sale con
`onHome: true`: acabas de hacerla y lo probable es que quieras repetirla. Se
oculta desde el editor.

### 7.2 Desde una sesión libre guardada

Si en el entreno añadiste ejercicios (entradas con `isAdHoc: true`): **Añadir
{n} ejercicios a la sesión**. Llama a `addExercise(tplId, id)` por cada uno y
ajusta `sets` al número de series hechas con `updateExerciseParams`. **No se
reescribe la plantilla con lo hecho** (el antiguo `updateFreeSessionPreset`):
ahora la plantilla lleva configuración (progresión, calentamiento…) que la
entrada no tiene, y reescribirla la borraría.

### 7.3 Cuenta como sesión X

Aparece en cualquier entrada libre (los dos tipos) si hay programa activo con
sesiones en la etapa actual.

```
CUENTA PARA EL PROGRAMA
[ No ] [ A ] [ B ] [ C ] [ D ]      ← chips; «No» elegido por defecto
Cuenta como la Sesión C: avanza la semana y la etapa.   ← hint, solo si hay elegida
```

- Chips: `athleteProgress(program).currentStageIndex` → `stage.days`, marcador
  = `label`. Mismo componente de chips que el segmented del SessionEditor.
- Cambia en los dos sentidos mientras estás en el recap. Tocar la elegida
  vuelve a «No».

`setEntryCountsAs(entryId, tplId | null)`:

1. `prev = entry.countsAs`. `wasCounted` = `prev` está en los `days` de la
   etapa actual. `countsNow` = `tplId` está en ellos.
2. Patch de progreso con una función pura nueva en `stageProgress.js`, al lado
   de `recordSession`:

   ```js
   export function substitutionPatch(progress, { wasCounted, countsNow, today }) {
     if (wasCounted === countsNow) return {};           // de A a C: el contador no cambia
     if (countsNow) return recordSession(progress, { inCurrentStage: true, today });
     return { stageSessionsDone: Math.max(0, (progress?.stageSessionsDone ?? 0) - 1) };
   }
   ```

   Se aplica con `applyProgress`, como hace `saveSession`
   (`useStore.js:2310`).
3. Escribe `countsAs` en la entrada (o lo quita, si `null`).

Test de `substitutionPatch`: no → C suma 1 y fija `stageStartedOn` si era la
primera; C → no resta 1 sin bajar de 0; A → C no cambia nada.

`ponytail:` quitar la sustitución no deshace `stageStartedOn` si fue la primera
sesión de la etapa. Es aceptable: la etapa arrancó ese día igualmente. Y
`wasCounted` se deduce de la etapa actual porque el recap solo se ve recién
guardado: la etapa no puede haber cambiado entre medias. **Si algún día se
puede editar desde el historial**, hay que guardar en la entrada en qué etapa
contó.

El progreso y el log ya se replican solos al entrenador: el suscriptor
(`useStore.js:4411`) salta con `workoutLog !== prev.workoutLog` y con
`progressChanged`. El contador sigue siendo propiedad del cliente (regla de oro
de stage-locks).

## 8. Fase T23 — Quién cuenta qué

Una regla, en `freeSessions.js`:

```js
// ¿Cuenta esta entrada como la sesión `tid` del programa?
export const programTemplateOf = (e) => (isFreeEntry(e) ? e.countsAs ?? null : e.sessionTemplateId);
```

| Dónde | Cambio |
|---|---|
| `sessionPlan` (`sessionPlan.js:39`) — sesión que toca, marca de hecha, «N de M esta semana» | `const tid = programTemplateOf(entry)` en vez de `sessionTemplateId`. Cubre también la tarjeta de cliente y «Preparar sesión» del entrenador, que llaman a la misma función con el log espejado. Test en `sessionPlan.test.js`: una libre con `countsAs: C` marca la C como hecha y mueve el hero |
| Adherencia — `MyProgramScreen.jsx:176`, `:182` y `ClientsScreen.jsx:1907`, `:1908` | `sessions` = log filtrado a `!isFreeEntry(e) \|\| e.countsAs`. Hoy cuentan todas las libres |
| Progreso, «programa actual» — `ProgressTab.jsx:77` y `:566` | `ids.has(e.sessionTemplateId) \|\| ids.has(e.countsAs)` |
| Entrenador, «programa actual» — `ClientsScreen.jsx:2113` | Hoy mete **todas** las libres (`=== '__free__' \|\|`, comentario del bug 14). Pasa a `activeClientTemplateIds.has(e.countsAs) \|\|`. **Es un cambio de comportamiento intencionado**: decisión §2.3. Actualizar el comentario |
| Subida al entrenador — `clientLogs.js:93` | `isFreeEntry(e) && ts >= linkedTs` en vez de `=== '__free__'` (§4.2) |
| Historial — `SessionCard.jsx:75` | `isFree = isFreeEntry(session)` → ★ y `sessionName`. En el móvil del entrenador la plantilla no existe y es la única pista |
| Recap — `SessionRecapScreen.jsx:168` | `isFree = isFreeEntry(entry)`; §7 elige bloque según sea `'__free__'` o no |
| Carga, tira de la semana, progreso de ejercicio, `loadPct` | **Nada** (§2.2) |
| Documentación / glosario (P40) | Una entrada «Sesión libre»: qué es, que la carga siempre cuenta y qué hace «Cuenta como» |

Grep de control al cerrar la fase: `grep -rn "'__free__'" src store`. Cada
aparición que quede tiene que referirse a la sesión **sobre la marcha**, no a
«libre» en general.

## 9. Textos (es / en)

Añadir clave a clave, sin reformatear el JSON (regla de locales). Se borran las
de plantillas que queden sin uso (`startFromTemplate*`, `templatesTitle`,
`updateTemplate`, `saveAsNew`, `templateUpdated`, `deleteTemplate*`…); se
comprueba con grep al cerrar T21/T22.

| Clave | es | en |
|---|---|---|
| `freeSession.sectionTitle` | Sesiones libres | Free sessions |
| `freeSession.startNow` / `startNowDesc` | Empezar ya / Una sesión en blanco, sobre la marcha | Start now / A blank session, on the fly |
| `freeSession.create` / `createDesc` | Crear sesión libre / Prepárala en el editor para repetirla cuando quieras | Create free session / Build it in the editor to repeat it any time |
| `freeSession.mine` / `mineDesc` | Mis sesiones libres ({{count}}) / Las que tienes guardadas, estén o no en Inicio | My free sessions ({{count}}) / Your saved ones, on Home or not |
| `freeSession.showOnHome` / `showOnHomeHint` | Mostrar en Inicio / Aparece en Inicio junto a las sesiones del programa | Show on Home / Appears on Home next to your program sessions |
| `freeSession.delete` / `deleteConfirm` | Eliminar sesión libre / Se borra «{{name}}». Las veces que la hiciste siguen en el historial. | Delete free session / «{{name}}» will be deleted. Past workouts stay in your history. |
| `freeSession.saveAsFree` / `saved` | Guardar como sesión libre / Guardada en tus sesiones libres | Save as free session / Saved to your free sessions |
| `freeSession.addExercises` | Añadir {{count}} ejercicios a la sesión | Add {{count}} exercises to the session |
| `recap.countsAsTitle` / `countsAsNone` / `countsAsHint` | Cuenta para el programa / No / Cuenta como la Sesión {{label}}: avanza la semana y la etapa. | Counts toward program / No / Counts as Session {{label}}: moves your week and stage forward. |
| `editor.freeEyebrow` / `toastFreeSaved` | Sesión libre / Sesión guardada | Free session / Session saved |

## 10. Fuera de alcance (anotado para no perderlo)

- **Compartir sesiones** («te paso mi sesión de agarre»). El modelo ya lo deja
  fácil: una plantilla sin programa es autocontenida (ejercicios + bloques + los
  `customExercises` que use). Sería un `.fitdata` de una sesión. No se prepara
  nada ahora.
- **Sesiones libres asignadas por el entrenador** a un cliente o a un grupo (una
  rutina de movilidad, las clases de un grupo). Es la siguiente spec y se apoya
  en el `owner` de §4.1.1, que ya queda puesto aquí.
- **Recordar el último «Cuenta como»** de cada sesión libre como valor por
  defecto. Es barato (un campo en la plantilla), pero hay que ver primero si se
  usa.
- **Prellenar pesos la primera vez** con el último registro del ejercicio en
  cualquier sesión. Hoy la primera vez sale vacía.
- **Reordenar** las sesiones libres de Inicio y **duplicarlas**.
- **Sesión privada** que no sube al entrenador (§2.4).

## 11. Probar en dispositivo

> **Probar en dispositivo.** Crear una sesión libre desde ＋ → Crear, añadir dos
> ejercicios con progresión Auto, salir con el check y comprobar que aparece en
> Inicio. Entrenarla dos veces: la segunda tiene que salir con los pesos de la
> primera y el recap tiene que comparar.

> **Probar en dispositivo.** ＋ → Crear y salir sin añadir nada: no debe quedar
> ninguna sesión vacía ni en Inicio ni en «Mis sesiones libres».

> **Probar en dispositivo.** Editar una sesión libre siendo cliente de un
> entrenador: **no** debe aparecer «Programa editado» ni el entrenador debe ver el
> programa como pendiente de reenviar.

> **Probar en dispositivo.** Sesión sobre la marcha → recap → Guardar como sesión
> libre → aparece en Inicio. Empezarla: sale con los pesos de esa primera vez.

> **Probar en dispositivo.** Con la C pendiente esta semana: hacer una sesión
> libre y marcar «Cuenta como C». Al volver a Inicio la C sale hecha, el contador
> «N de M» sube uno y el hero pasa a la siguiente. Repetir marcando y
> desmarcando en el recap: el contador de etapa no se descuadra.

> **Probar en dispositivo (dos móviles).** El entrenador ve la sesión libre
> guardada del cliente en el historial con ★ y su nombre. Con el filtro
> «programa actual» solo aparece si se marcó «Cuenta como». La adherencia del
> cliente solo sube con las marcadas.

> **Probar en dispositivo.** Con la migración: las plantillas que ya tenías
> aparecen como sesiones libres en Inicio.

> **Probar en dispositivo.** El hueco de marcador vacío en las filas libres:
> comprobar que se lee como «sin letra» y no como un fallo. Si parece un hueco
> roto, la salida es quitarlo y aceptar que el nombre no se alinea.

## Fases

| Fase | Qué | Depende de | Aceptación |
|---|---|---|---|
| T19 ✅ `93ee875` | §4: forma (con `owner`), `free`, acciones, `freeSessions.js` + tests, migración | — | Tests verdes; las plantillas viejas migran con `owner: 'me'`; una sesión libre guardada se puede empezar con `startSession` y se guarda con `free: true`; `clientLogs` la sube |
| T20 ✅ `c45f078` | §5: editor en modo libre, `useEditorExit`, limpieza de vacías | T19 | Se crea, se edita, se oculta de Inicio y se borra desde el editor sin marcar el programa |
| T21 ✅ `2b8dd59` | §6: sección en Inicio (también sin programa), hoja, Workout | T19, T20 | Los cinco caminos de la tabla de §6.2 |
| T22 ✅ `aa24148` | §7: recap, `substitutionPatch` + test | T19 | Guardar, añadir ejercicios y «Cuenta como» en los dos sentidos |
| T23 ✅ `0538ed0` | §8: `programTemplateOf`, adherencia, filtros, historial, glosario | T22 | Test de `sessionPlan`; grep de `'__free__'` limpio |

T19 va sola primero. Después, T20+T21 y T22+T23 son independientes entre sí.
