# Spec — Planificador de etapas (la etapa como regla, no como copia)

> Tema: programas
> En corto: Una etapa deja de ser un duplicado del programa entero y pasa a ser una regla («mismas sesiones, +1 serie, −5% de peso»), así que hacerlo evolucionar cuesta minutos en vez de reeditar N sesiones a mano.
> Fase P24 · hecho · Unificación del modelo + paso de ciclos en los dos modales de creación · §3
> Fase P25 · hecho · `applyRx` + `templateChainIds` + `addStageToProgram({rx})` · §4
> Fase P26 · hecho · Switch «principal» + pill KEY, que habilita `scope` · §5
> Fase P27 · hecho · `progressionHold: deload` en `progression.js` · §6
> Fase P28 · hecho · Pantalla del planificador · §7
> Fase P29 · pendiente · Recap consciente de la descarga · §4.2
>
> Estado: **fases 0-4 implementadas** (ago 2026). 5 fases, cada una un
> commit que aporta valor por sí solo. Origen: conversación Opus + usuario
> (ago 2026) sobre cómo usar las métricas ya existentes para programar más
> rápido. El análisis completo derivó en 5 palancas (P1-P5); **esta spec es la
> P1 y su dependencia directa**. Las otras cuatro están resumidas en §12 para
> que no se pierdan.
>
> Problema que resuelve: hoy **una etapa es un duplicado literal del programa**
> ([`addStageToProgram`](../../store/useStore.js) hace `cloneDays` de la
> anterior), así que "hacer evolucionar" un programa cuesta reeditar N sesiones
> × M ejercicios a mano. El entrenador construye las 3-4 etapas el día 1 porque
> es lo único viable, y luego no las revisa nunca.
>
> ⚠️ **Antes de implementar la fase 1, leer §4.1**: hoy ya, cambiar de etapa
> **borra la referencia de pesos del cliente**. Es un bug vivo que esta feature
> destapa y sin cuyo arreglo la escalera de etapas es peor que no tenerla.

---

## 1. Concepto

Dos capas que hoy no se hablan:

| Capa | Qué hace | Reactividad |
|---|---|---|
| **Ejecución** — `exConfig.progression` | decide el peso de mañana desde las series de ayer | automática, por ejercicio |
| **Estructura** — `stage` | `{ id, name, durationWeeks, days[], locked }` | **cero**: copia congelada |

La spec añade la capa que falta: una **regla de etapa** (`rx`) que transforma
los `exConfig` de la etapa base al crear una etapa nueva.

**Decisión arquitectónica central: la regla se MATERIALIZA, no se resuelve en
runtime.** `applyRx(exercises, rx)` devuelve `exConfig` normal y corriente,
indistinguible de lo que escribiría el entrenador a mano. Consecuencias:

- Cero cambios en los ~10 consumidores de `exConfig` (WorkoutScreen,
  `sessionStats`, `trainingLoad`, `sessionRecap`, editor, preview, snapshot del
  log). Una capa de resolución en lectura los tocaría todos.
- La etapa generada **sigue siendo editable a mano**, ejercicio a ejercicio,
  como hoy. Con una capa de runtime, "editar a mano una etapa derivada" es una
  pregunta de diseño desagradable.
- Precio asumido: **cambiar la regla después no retro-aplica**. Si te
  equivocaste, borras la etapa y la vuelves a crear.

Única excepción, justificada en §6: `progressionHold` sí lo lee
`getProgression` en runtime.

## 2. Decisiones cerradas con el usuario (no re-litigar)

1. **Todo programa es un programa por etapas.** No existe el estado "sin
   etapas". Fase 0.
2. **`durationWeeks: null` significa "sin límite"**, y es exactamente el
   comportamiento actual de un programa sin etapas. La fase 0 no cambia el
   comportamiento de nadie por construcción.
3. Al crear un programa se piden **ciclos**, con explicación de qué es un ciclo
   y opción explícita "sin límite".
4. **Los peldaños de una escalera derivan de la etapa BASE, no del anterior.**
   Los deltas son absolutos contra la base ("+1 serie", "+2 series"), no
   acumulativos. Editar el peldaño 2 no descoloca el 3.
5. **En una descarga el chip de progresión NO se oculta: cambia de mensaje.**
   Ocultarlo lee como "la app se ha roto" y el cliente sube el peso igual.
6. **La cadena `derivedFrom` se aplica solo al grupo A** (referencia de
   progresión y prellenado), **no al grupo B** (comparaciones del recap e
   historial). Razón en §4.2.
7. **`progression.type` y `direction` NO suben a la etapa.** Una plancha
   progresa por tiempo y una dominada asistida por goma, haya descarga o
   acumulación. Eso es física del ejercicio. Lo que sube es la *agresividad*.
8. El planificador **no usa métricas**: el día 1 no hay datos. Las métricas
   entran al CERRAR una etapa (P4, §12), no al planificarla.
9. El `SegmentedControl` de etapas **navega**; el planificador (lista vertical)
   **planifica**. No intentar que un control horizontal haga las dos cosas: con
   nombres reales ("Intensificación") no cabe y no va a caber.

---

## 3. FASE 0 — Unificación del modelo 🟢

**Comportamiento idéntico al actual por construcción** (§2.2). La única UI es
el campo de ciclos en los dos modales de creación (§3.2.h) y el "sin límite"
en el sheet de etapa; todo lo demás lo validan los tests.

### 3.1 El hallazgo que la hace barata

`program.days` **ya es un espejo denormalizado de los días de la etapa
activa**: `setCurrentStage` ([useStore.js:1332](../../store/useStore.js)),
`advanceStage` y `removeStageFromProgram` escriben `days: stages[idx].days`
cada vez que mueven la etapa.

Por tanto: **si todos los programas tienen `stages` y `days` sigue espejando la
activa, los ~40 sitios que leen `program.days` siguen funcionando sin
tocarlos.** Las ~15 ramas `hasStages ? stages[i].days : program.days` quedan
muertas pero inofensivas; se limpian cuando se toque cada pantalla, no ahora.

### 3.2 Trabajo

**a) Los 4 sitios que crean programas nacen con `stages`:**

| Sitio | Nota |
|---|---|
| [useStore.js:680](../../store/useStore.js) `createProgramForClient` | |
| [useStore.js:987](../../store/useStore.js) alta manual | |
| [programGenerator.js:495](../../../src/utils/programGenerator.js) | `days` → `stages: [{ …, days }]` + `days` espejo |
| [archetypeAdapter.js:368](../../../src/utils/archetypeAdapter.js) | idem |

Forma de la etapa inicial:

```js
stages: [{
  id: generateId('stage'),
  name: t('stage.defaultFirst'),   // "Etapa 1"
  durationWeeks: <lo que pida el paso de creación> | null,
  days: programDays,
}],
currentStageIndex: 0,
days: programDays,                 // espejo
```

**b) Helper `withStages(program, stages, currentStageIndex?)`** que reespeja
`days` al escribir. Hoy **6 escrituras a `stages` no lo hacen** y al unificar
deja de estar tapado por las ramas:
[1031](../../store/useStore.js), 1091, 1119, 1214, 1224, 1277.

**c) `addStageToProgram` pierde la rama de conversión** (`if (!hasStages)`,
[useStore.js:1200](../../store/useStore.js)): siempre añade una etapa al final,
y de paso cierra la etapa en curso si estaba sin límite (ver §3.2.g).

**d) `removeStageFromProgram`**: el guard `stages.length <= 1 → return` ya
existe y ahora es el invariante. Se borra la rama que colapsaba a "sin etapas"
([useStore.js:1291](../../store/useStore.js), el destructuring
`{ stages: _s, currentStageIndex: _csi, ...rest }`).

**e) `cloneProgramFromTemplate`** ([useStore.js:1408](../../store/useStore.js))
pierde su rama `else` de programa sin etapas.

**f) `durationWeeks: null` (sin límite) frente a `?? 4`.** Hoy el `?? 4` asume
"sin definir"; ahora hay que distinguirlo de "sin límite". Sitios:

| Sitio | Con `null` debe |
|---|---|
| [HomeScreen.jsx:109](../../src/screens/HomeScreen.jsx) `totalWeeks` | no pintar "semana X de 4"; ciclo actual sin total |
| [HomeScreen.jsx:583](../../src/screens/HomeScreen.jsx) meta del modal | "sin límite · N sesiones/ciclo" |
| [ProgramEditorScreen.jsx:382](../../src/screens/ProgramEditorScreen.jsx) meta del selector | "sin límite" |
| [ProgramEditorScreen.jsx:499](../../src/screens/ProgramEditorScreen.jsx) `StepField` | necesita representar el "sin límite" (ver §7.2) |
| [ProgramEditorScreen.jsx:197](../../src/screens/ProgramEditorScreen.jsx) y [ProgramScreen.jsx:54](../../src/screens/ProgramScreen.jsx) sumatorios | una etapa sin límite hace el total indeterminado → "12+ ciclos" |
| [ClientsScreen.jsx:1479](../../src/screens/ClientsScreen.jsx) | ya usa `?? Infinity`, correcto, no tocar |

`advanceCycle` ya lo hace bien: `durationWeeks != null && …`
([stageProgress.js:152](../../../src/utils/stageProgress.js)). **No tocar.**

**g) Programas ya guardados sin `stages`.** `ensureStages` los envuelve en una
etapa. Se llama en los dos únicos sitios por los que entran programas de fuera:
`onRehydrateStorage` y `importData`. Es idempotente, así que no cuesta nada en
arranques posteriores. Red de seguridad: como las ramas de LECTURA de las
pantallas siguen ahí, un programa que se colara sin normalizar sigue
funcionando.

⚠️ **Corregido al implementar.** La spec decía que la etapa migrada heredase
`Math.max(stageWeeksCompleted, 4)`. Es incorrecto para una migración
**silenciosa**: un programa sin etapas nunca tuvo final, y darle un número se
lo inventa — un cliente con 15 rotaciones abriría la app con "Ciclo 15 de 15" y
una tira de 15 segmentos llenos donde antes no había nada. La migración usa
`durationWeeks: null`, que es la definición de "sin límite" (§2.2) y lo que
hace que la fase 0 no cambie el comportamiento de nadie.

La regla "la etapa duró lo que de hecho duró" **no se pierde: se mueve al
momento en que significa algo**, que es `addStageToProgram` (§3.2.c), en el util
puro `closeOpenStage`. Una etapa sin límite delante de otra deja al cliente
encerrado para siempre — `advanceCycle` no puede alcanzar un umbral que no
existe, así que el banner de avanzar no aparece nunca.

**Dos trampas encontradas en el QA de la fase 0** (ronda 1, ago 2026), las dos
con el mismo síntoma: cerrar la etapa en 2 ciclos y que el cliente siguiera
debiendo uno más.

1. **`stageAdvancePending` no lo recalculaba nadie.** Cerrar la etapa por los
   ciclos ya hechos la deja terminada *en ese instante*, pero la bandera solo
   se evalúa dentro de `advanceCycle`, es decir en el siguiente guardado que
   cierre ciclo — una rotación entera de peaje. `closeOpenStage` devuelve
   `advancePending` y la acción la escribe. Es `false` cuando no hay ningún
   ciclo cerrado (programa recién creado): ahí la etapa sí está por delante.
2. **El contador se leía del sitio equivocado.** En el móvil del entrenador,
   `program.stageWeeksCompleted` es de SU copia y no se mueve nunca — él no
   entrena el programa del cliente — así que cerraba la etapa en 1 ciclo por
   muchos que llevara el cliente. Se lee del blob de progreso
   (`progressFromBlob`), misma lección que `clientStageIndex` en
   [stage-locks.md](stage-locks.md) §9.

Y un tercero, de pintura, en `computeStageInfo`: `weekInStage` usa
`min(hechos + 1, total)`, así que "voy por el ciclo 2 de 2" y "he terminado los
2" son el mismo número y la tira dejaba el último segmento vacío. `stageComplete`
los distingue y la llena entera.

**h) El paso de ciclos en la creación de programa.** Es la única UI de la fase
0, y va aquí y no en la 4: sin ella, un programa nuevo nace con una duración
inventada y el momento "se acabó la etapa" —que es la puerta de entrada a todo
lo demás— nunca llega.

Dos modales, **los dos en pantallas ya migradas a FormaFit**:

| Modal | Fichero | Acción de store |
|---|---|---|
| `NewProgramModal` (entrenador → cliente) | [ClientsScreen.jsx:692](../../src/screens/ClientsScreen.jsx) | `createProgramForClient(clientId, numSessions, name)` |
| `CreateModal` (plantillas propias) | [ProgramScreen.jsx:100](../../src/screens/ProgramScreen.jsx) | `createEmptyProgram(numSessions, name, mode)` |

Las dos acciones ganan un parámetro `durationWeeks` (`number | null`). Campo
nuevo bajo el de nº de sesiones:

```
¿Cuántos ciclos dura esta etapa?
Un ciclo son todas las sesiones distintas del programa (A, B y C), en el
orden que sea. Cuando se completa, cuenta uno.
  [ − ]  4 ciclos  [ + ]
  ○ Sin límite — la etapa dura hasta que tú añadas la siguiente
```

Reutilizar `StepField` (el mismo del sheet de etapa) + una fila de opción para
"sin límite" ⇒ `durationWeeks: null` (§2.2).

**El onboarding NO se toca.** `OnboardingScreen` aún no está migrado a
FormaFit, y meterle un paso ahí sería trabajo que hay que rehacer al migrarlo.
Los programas generados (`programGenerator`, `archetypeAdapter`) nacen con
`durationWeeks: null` — que es **exactamente el comportamiento de hoy** para un
programa generado (sin etapas ⇒ sin umbral). El usuario le pone duración desde
el editor cuando quiera, o al planificar el bloque (fase 4). Cuando se migre el
onboarding, añadir el paso allí es una línea.

### 3.3 Definition of done — fase 0

- `npx vitest run` verde sin cambios en las expectativas existentes.
- Test nuevo: un programa creado por cada uno de los 4 sitios tiene
  `stages.length === 1` y `days === stages[0].days` (misma referencia o mismo
  contenido).
- Test nuevo: tras `addSessionToProgram` / `removeSession` /
  `reorderSessionsInStage` / `duplicateSessionInProgram` sobre la etapa activa,
  `program.days` sigue espejando `stages[currentStageIndex].days`.
- Test nuevo: `durationWeeks: null` nunca produce `stageAdvancePending`.
- Los dos modales de creación (§3.2.h) pasan `durationWeeks` y "sin límite"
  llega al store como `null`, no como `0` ni `undefined`.
- Un programa generado por onboarding nace con `durationWeeks: null` y se
  comporta igual que hoy (sin banner de fin de etapa).
- Strings nuevas por `t()` en `es.json` Y `en.json`.
- eslint: comparar contra HEAD, solo cuentan violaciones nuevas.

---

## 4. FASE 1 — `applyRx` + cadena de plantillas 🟡 ✅ IMPLEMENTADA

### 4.1 ⚠️ La cadena `derivedFrom` — requisito, no extra

[`WorkoutScreen.jsx:366`](../../src/screens/WorkoutScreen.jsx):

```js
const lastSession = workoutLog.filter((e) => e.sessionTemplateId === activeSession.templateId)…
```

La referencia de progresión se busca **por `sessionTemplateId`**, y crear una
etapa acuña `tpl_*` frescos. Por lo tanto, **hoy ya**, la primera vez que el
cliente entrena cada sesión de una etapa nueva:

- `getProgression` recibe `lastSets` vacío → `return null` → **sin chip**;
- los valores fantasma de peso y reps salen **en blanco** (el mismo
  `lastExercise` alimenta `resolveExerciseReference`).

Cada salto de etapa manda al cliente a adivinar sus kilos. Con etapas caras y
raras se nota poco; con esta feature, que las hace baratas, es el problema
principal. **Una escalera de 4 peldaños que resetea los pesos 4 veces es peor
que no tener escalera.**

Arreglo, reutilizando maquinaria existente —
[`exerciseLinks.js`](../../../src/utils/exerciseLinks.js) ya resuelve "última
ejecución a través de varias plantillas" para los grupos vinculados:

```js
// sessionTemplates[tplId]
tpl.derivedFrom = sourceTplId | null    // etapa 3 → etapa 2 → etapa 1

// src/utils/exerciseLinks.js (junto a linkGroupTemplateIds)
export function templateChainIds(templateId, getTemplate)
  // [templateId, su derivedFrom, el derivedFrom de aquel, …]
  // Corta ante un id inexistente o un ciclo (Set de visitados).
```

Consumidores (**grupo A**, y solo estos):

| Sitio | Cambio |
|---|---|
| [WorkoutScreen.jsx:389](../../src/screens/WorkoutScreen.jsx) `lastExercise` | rama no-vinculada: `lastLinkedExercise(workoutLog, templateChainIds(...), exerciseId)` en vez de buscar en `lastSession` |
| [useStore.js:1817](../../store/useStore.js) `getProgressionRecommendation` | `getLastSession(templateId)` → recorrer la cadena |

`lastLinkedExercise(workoutLog, templateIds, exerciseId)`
([exerciseLinks.js:50](../../../src/utils/exerciseLinks.js)) ya hace
exactamente lo que hace falta. Prioridad si un ejercicio está además vinculado:
**gana el `linkGroup`** (es una decisión explícita del entrenador; la cadena es
automática).



**Cómo quedó al implementar.** Los tres llamantes resolvían la referencia por su
cuenta y solo el caso vinculado miraba más allá de la plantilla actual, así que
en vez de parchear cada uno se unificaron en `lastExerciseRef({ workoutLog,
program, templateId, exConfig, getTemplate })`, que decide entre grupo
vinculado y cadena. Llamantes: `WorkoutScreen` (chip + fantasmas),
`getProgressionRecommendation` y el `resolveSet` de `saveSession` — este último
no estaba en la lista de la spec y sufría lo mismo.

**`duplicateStageInProgram` también sella `derivedFrom`.** La spec lo dejaba
fuera por ser "copia literal", pero acuña `tpl_*` nuevos igual que
`addStageToProgram`, así que perdía los pesos de referencia exactamente igual.
Donde NO se sella es en `duplicateSessionInProgram`: ahí la copia y el original
conviven en el mismo ciclo, así que es una sesión nueva, no la evolución de
otra.

### 4.2 Lo que NO entra: el grupo B (decisión cerrada, §2.6)

Tres funciones de `sessionRecap.js` filtran por `sessionTemplateId` y **se
quedan como están**:

- [`compareToLast`](../../../src/utils/sessionRecap.js) (:185) — flechas de
  delta por ejercicio en el recap.
- `volumeDeltaByEntry` (:142) — el "+12%" de la tarjeta de Historial.
- `prevBlockResult` (:165) — comparación de bloques AMRAP/EMOM.

(`detectPRs` **no** está afectada: filtra por `exerciseId` sobre todo el log,
así que los PRs ya cruzan etapas sin tocar nada.)

Motivo de dejarlas fuera: el grupo A pregunta *"¿qué peso movió?"* — un hecho,
inmune a que la prescripción cambie. El grupo B pregunta *"¿fue mejor o
peor?"*, y el `rx` **acaba de cambiar la prescripción a propósito**. En un
peldaño de descarga (`setsDelta: -1`) el cliente hace exactamente lo pedido y
el recap le pintaría **−25% de volumen en rojo**: cierto pero pedagógicamente
falso, y choca con la decisión ya cerrada de que el rojo apagado es para
retrocesos reales.

**Encadenar el grupo B bien hecho no es cambiar un filtro**: es que la
comparación sepa que la etapa es de descarga y lo diga en verde o con mensaje
propio ("−25% volumen · descarga planificada ✓"). Depende de
`progressionHold` (fase 3) y se hace **después**, como fase 5 o dentro de una
revisión del recap. Comportamiento mientras tanto: idéntico al de hoy (sin
delta en la primera sesión de cada etapa; nadie lo ha reportado).

### 4.3 `src/utils/stageRx.js` (nuevo, puro, con tests)

Vive en `src/utils/` (compartido, tests vitest desde la raíz), como
`stageProgress.js` y `conditioningBlocks.js`.

```js
export const DEFAULT_RX = {
  scope:           'all',   // 'all' | 'keys' | 'accessories'   (fase 2)
  setsDelta:        0,      // −2..+2       suelo duro: 1 serie
  repsShift:        0,      // −4..+4       desplaza min Y max juntos, suelo 1
  restPct:          0,      // −50..+100    suelo 15 s
  incrementScale:   1,      // 1 | 0.5      multiplica progression.increment.value
  progressionHold:  null,   // null | 'deload'                  (fase 3)
};

export function applyRx(exercises, rx) → exercises
```

Reglas:

- **Puro y total**: `rx` ausente o todo a cero ⇒ devuelve el array tal cual
  (identidad). Es el comportamiento "Igual que la anterior", que es el de hoy.
- **Suelos duros**: `sets ≥ 1`, `minReps ≥ 1`, `restSec ≥ 15`. Nunca 0 ni
  negativo.
- **`repsShift` desplaza, no sustituye**: 8-12 con −3 → 5-9. Sustituir el rango
  entero por uno fijo ignora que un accesorio y un básico no comparten rango.
- **Ejercicios de tiempo intactos en reps**: `buildExConfig` deja `minReps` /
  `maxReps` fuera en `time_progression` y `submax`
  ([programGenerator.js:517](../../../src/utils/programGenerator.js)). Si
  `minReps == null`, `repsShift` se salta; `setsDelta` y `restPct` sí aplican.
- **`incrementScale` se aplica sobre el valor de la etapa BASE** (§2.4), no
  sobre el de la etapa anterior. Solo toca `increment.value`; en
  `increment.type === 'pct'` escala `pct`, y en `'stepped'` escala cada
  `steps[].value`. Redondeo: al múltiplo de `minIncrement` si existe, si no a
  0,25 (mismo criterio que
  [`computeIncrement`](../../../src/utils/progression.js)).
- **`progressionHold`** se escribe en `exConfig.progression.hold`. Si el
  ejercicio no tenía `progression` explícita, `applyRx` la materializa con
  `resolveProgressionConfig(exConfig, def)` antes de escribir — para eso
  `applyRx` necesita recibir también `allExercises` (biblioteca + custom) como
  segundo parámetro. Firma real: `applyRx(exercises, rx, allExercises)`.
- **Nunca toca `exerciseId`, `order`, `linkGroup`, `supersetWithNext`,
  `dropset`, `warmup`, `trainerNote`, `limitationNote`, ni ningún id.** La
  aritmética de cierre de ciclo (`stageTplIds` distintos) depende de que los
  ids no se toquen.

Tests mínimos: identidad con `rx` vacío; suelos; ejercicio de tiempo; scope;
`incrementScale` sobre los 3 tipos de `increment`; que ningún id cambia.

### 4.4 `addStageToProgram`

```js
addStageToProgram(programId, { rx = null, sourceStageIdx = null, name, durationWeeks } = {})
```

- `sourceStageIdx` por defecto: la última etapa (comportamiento actual).
- Entre `cloneDays` y el `set`, aplicar `applyRx` a los `exercises` de cada
  plantilla clonada, y estampar `derivedFrom: sourceTplId`.
- Guardar `stage.rx` **solo como procedencia**: alimenta la línea "Derivada de
  *Acumulación* · +1 serie" del sheet. **Nada en runtime lo lee.** Sin esto, a
  las tres semanas el entrenador no se acuerda de qué escalera montó.
- Sin argumentos ⇒ comportamiento idéntico al actual. Retrocompat total.

Nuevo, para la escalera de la fase 4:

```js
addStageLadder(programId, { sourceStageIdx, rungs: [{ name, durationWeeks, rx }] })
// Todos los peldaños derivan de sourceStageIdx (§2.4). Una sola escritura al store.
```

### 4.5 Definition of done — fase 1

- `applyRx` con tests; `templateChainIds` con test de cadena y de ciclo.
- Test de integración: crear etapa con `setsDelta: +1` sobre una base de 3
  sesiones ⇒ los `tpl_*` son nuevos, `derivedFrom` apunta al origen, cada
  `exConfig.sets` subió 1, ningún `exerciseId` cambió.
- Test de regresión: `addStageToProgram(id)` sin opciones produce exactamente
  lo que producía antes.
- Verificar a mano en dispositivo: cliente que avanza de etapa **conserva los
  fantasmas de peso y ve el chip** en la primera sesión de la etapa nueva.

---

## 5. FASE 2 — Ejercicio principal (`isKey`) y `scope` 🟢 ✅ IMPLEMENTADA

Los ejercicios añadidos a mano nacen con `isKey: false`
([useStore.js:922](../../store/useStore.js)) y **no hay UI para cambiarlo**, así
que en un programa hecho a mano `isKey` es `false` en todo y `scope` no
discriminaría nada. Los programas generados **ya traen `isKey`** correcto
(`buildExConfig`, `archetypeAdapter`), así que la pill se enciende sola en todo
lo generado.

- **Switch "Ejercicio principal"** en la sección Opciones de
  `ExerciseEditorInline` → `updateExerciseConfig(templateId, exerciseId, { isKey })`.
- **Pill "KEY"** en la fila del ejercicio en `SessionEditorScreen`, junto a los
  badges ya existentes (SS de superserie, etc.).
- Con esto `rx.scope` (`'all' | 'keys' | 'accessories'`) pasa a ser real.

Feature útil por sí sola (el entrenador ve de un vistazo cuál es el básico del
día) y es la única dependencia de `scope`.



**`isKey` SÍ entra en `LINKED_CONFIG_KEYS`** (corregido en el QA de la fase 2).
Se implementó primero al revés, razonando que ser el básico es un papel de ESA
sesión. El usuario lo rechazó y tiene razón: estar vinculado significa compartir
la estructura ENTERA, sin excepciones —decisión ya cerrada del proyecto—, y si
una sentadilla es la principal de un día y accesoria de otro, su programación ya
difiere y no deberían estar en el mismo grupo. La salida es desvincular. Una
excepción silenciosa aquí es además imposible de adivinar para quien la usa.

**"Principal" es metadato, no badge** (misma ronda de QA). Como pastilla junto
al nombre se llevaba una fila entera en cuanto el nombre era largo, y la palabra
en español no cabe en una pill. Va como primer término de la línea de subtítulo,
separado por punto medio, en los tres sitios donde aparece:
`ExerciseCard` del workout (que ya tenía un `keyBadge` sin estrenar, invisible
hasta que existió el switch), la fila del editor de sesión y `ProgramDetailScreen`.
Es además lo que ya decía el comentario de cabecera de `SessionEditorScreen`:
"todo lo que antes eran badges pasa a metadato del subtítulo; la única pill que
queda es la del formato de bloque".

Una sola cadena para los tres: `common.keyExercise` ("Principal" / "Key").
Sustituye a `workout.keyBadge` y al `' · CLAVE'` hardcodeado de
`ProgramDetailScreen`.

---

## 6. FASE 3 — El chip de descarga 🟢 ✅ IMPLEMENTADA

**Ocultar el chip en una descarga es barato y falla como entrenamiento.** Es la
única voz de la app en el momento de la serie: sin chip, el cliente lee "esto
no tiene progresión" o "la app se ha roto", y **sube el peso igual**, con lo
que la descarga no ocurre.

El chip se queda y dice lo contrario. `progression.js` ya tiene el tipo `hold`
(`type:'hold', icon:'→'`); una descarga es un `hold` con mensaje propio:

> `→ Semana de descarga — mantén 60kg y deja 3-4 reps en recámara`

Cambios, todos en [`src/utils/progression.js`](../../../src/utils/progression.js):

1. `resolveProgressionConfig` normaliza `hold` (`p.hold ?? null`) — ya normaliza
   todo lo demás en un punto.
2. `getProgression`: rama al principio, **después** de resolver `prog` y de la
   guarda `type === 'none'`:

   ```js
   if (prog.hold === 'deload') {
     return { type: 'hold', icon: '→',
              msg: t('progression.deload_hold', { weightStr }),
              suggestedWeight: maxW || null, suggestedTime: null };
   }
   ```

   Devuelve `suggestedWeight` para que el prellenado siga funcionando.
3. i18n `progression.deload_hold` en `es.json` y `en.json`.
4. Tests en `progression.test.js`: con `hold: 'deload'` nunca sale `type: 'up'`
   ni `'down'`, en ninguno de los 5 tipos de progresión.

**Es el único lectura-en-runtime que añade toda la feature**, y vive en una
función pura que ya tiene tests. Merece la excepción a §1.

**Cómo quedó al implementar.** El chip lleva `reason: 'deload'` y mantiene
`type: 'hold'`, en vez de estrenar un tipo nuevo: así ningún consumidor que ya
mire `chip.type` (que solo conoce up/hold/down) se rompe, y la tarjeta puede
pintarlo distinto igualmente. Etiqueta propia ("Descarga") y color `blue`, para
que no comparta el gris de "sin novedad" — nunca rojo (§4.9 de UI-MIGRATION).

La rama va **antes** de mirar el rendimiento y **después** de la guarda
`type === 'none'`: da igual lo bien o mal que saliera la sesión, el bloque pide
mantener; pero un ejercicio sin progresión sigue sin chip.

---

## 7. FASE 4 — La pantalla de planificador 🔴 ✅ IMPLEMENTADA

### 7.1 Por qué pantalla propia y no el `StageSelector`

| Control | Para qué | Escala |
|---|---|---|
| [`StageSelector`](../../src/components/ui/StageSelector.jsx) horizontal | **navegar** — qué etapa estoy editando | scroll desde la 5ª, ya implementado |
| Planificador, lista vertical | **ver y editar el plan completo** | 8-10 etapas sin despeinarse |

Con nombres reales ("Acumulación 2", "Intensificación") un control horizontal
no cabe y no va a caber. Entrada desde la cabecera del editor de programa,
**no** desde el menú "···" — con la fase 0, "convertir en programa por etapas"
desaparece del menú porque deja de existir el concepto.

### 7.2 Contenido

```
PLANIFICAR BLOQUE                            12 ciclos ≈ 12 sem
Base: Acumulación · 3 sesiones/ciclo

  ┌────────────────────────────────────────────┐
  │ 1  Acumulación            [ 4 ] ciclos  ▾  │  base
  │ 2  Acumulación 2          [ 4 ] ciclos  ▾  │  +1 serie
  │ 3  Intensificación        [ 3 ] ciclos  ▾  │  −3 reps · +25% desc.
  │ 4  Descarga               [ 1 ] ciclo   ▾  │  −1 serie · sin progresión
  └────────────────────────────────────────────┘
                                          + etapa

  Escalera:  ● Lineal 3+1   ○ Intensificación   ○ Volumen   ○ Manual
```

- La escalera **rellena valores por defecto**; todo editable después (nombre,
  ciclos, los tres números, scope, política de progresión). Tocar cualquier
  valor cambia el selector a "Manual".
- **Contador de ciclos arriba**, total del bloque, en vivo. Si alguna etapa es
  "sin límite", el total es indeterminado ("12+ ciclos").
- Se confirma **una vez** (`addStageLadder`) y se materializan las etapas. A
  partir de ahí son etapas normales.
- Si el programa **ya está en marcha**, línea de contexto arriba con lo que ya
  se calcula (adherencia, rendimiento, estado de carga). Informa la decisión;
  no la toma. Ver P3 en §12.

### 7.3 Escaleras predefinidas (constantes en `stageRx.js`)

| Escalera | Peldaños (deltas contra la BASE) |
|---|---|
| Lineal 3+1 | base · `setsDelta:+1` · `setsDelta:+2` · `setsDelta:-1, progressionHold:'deload'` |
| Intensificación | base · `scope:'keys', repsShift:-3, restPct:+25` · `scope:'keys', repsShift:-5, restPct:+50, incrementScale:0.5` · descarga |
| Volumen | base · `scope:'accessories', setsDelta:+1` · `scope:'accessories', setsDelta:+2` · `scope:'accessories', setsDelta:+3` |

**Por qué dos de las tres llevan `scope`, y por qué la fase 2 es su requisito.**
No es cosmética: sin alcance, un peldaño de intensificación empuja los curls a
5-9 repeticiones, y eso **contradice una regla que el propio generador ya
aplica** — "uniarticulares siempre con parámetros de hipertrofia"
([programGenerator.js](../../../src/utils/programGenerator.js), rama
`ex.isCompound ? goalParams : GOAL_PARAMS.hypertrophy`). El rango corto es de
los básicos; los accesorios viven en 8-15 haga el bloque lo que haga. Y al
revés en Volumen: las series extra van a los accesorios, no a la sentadilla
pesada.

La descarga y la acumulación lineal sí van a `scope:'all'`: bajar el volumen o
añadir una serie a todo es exactamente lo que se quiere en esos dos casos.

Duraciones por defecto 4/4/3/1. **Tres peldaños es el objetivo, no seis**: si
el entrenador planifica 6 etapas el día 1, la propuesta al cerrar bloque (P4)
no tiene nada que decir en medio año.

### 7.4 Cómo quedó al implementar

**Entrada: la hoja del `+`** (decidida con el usuario, mejor que la cabecera que
proponía esta spec — era otro sitio donde esconderlo). El `+` del
`StageSelector` abre un `DragSheet` con dos filas: *Etapa nueva* (copia de la
última, un toque, lo de siempre) y *Planificar bloque*. **El menú "···" del
editor de programa desaparece**: su única acción era "añadir etapa" y ahora vive
en el `+`, junto a las etapas.

Como el planificador es también el editor de reglas, no hace falta un selector
de regla aparte para el `+`: "una etapa con regla" es el planificador con un
peldaño.

**La escalera se aplica al momento, sin borrador.** Las etapas se crean y se
editan ahí mismo (nombre, ciclos, borrar), que es lo que el store ya sabe hacer.
Un estado intermedio de "plan pendiente de confirmar" sería una máquina de
estados entera para ahorrar un toque de deshacer.

**La base es la última etapa SIN regla**, o sea la última construida a mano — "la
base del plan". Derivar del último peldaño montaría el bloque nuevo encima de
una descarga. La pantalla lo dice explícitamente para que no sea una sorpresa.

**Añadir, nunca reemplazar**: planificar sobre un programa con etapas las
conserva y añade detrás. Borrar sigue siendo explícito.

Fila de procedencia en la hoja de etapa: `describeRx` traduce la regla a
"+1 serie en accesorios · −3 reps en básicos". Es una etiqueta, no una regla
viva — editar la etapa a mano manda sobre ella.

Bug preexistente encontrado de camino: `editor.cyclesShort` no existía en
ninguno de los dos locales, así que el meta del `StageSelector` pintaba la clave
en crudo. Añadida con formas de plural.

**La escalera es un configurador, no una plantilla** (QA de la fase 4). Una
escalera cerrada solo sirve si tu bloque coincide con ella: la hoja del "+"
lleva un `SegmentedControl` de tipo (lineal / intensificación / volumen), un
contador de etapas de trabajo, un interruptor de "terminar con descarga" y, por
peldaño, ciclos más los campos propios del tipo — reps en básicos y descanso en
intensificación, series en las otras dos. Todo viene prerrellenado y todo se
puede tocar antes de aplicar.

Por eso `LADDERS` (tabla fija) desaparece y lo sustituye `buildRungs(ladderId,
count, withDeload)`, que **extrapola**: pedir 4 peldaños no puede depender de que
alguien escribiera el cuarto a mano. `LADDER_FIELDS` declara qué campos son
editables por tipo, y hay test de que cada campo declarado lo escribe de verdad
algún peldaño — si no, el planificador pintaría un control que no controla nada.

Bug de camino: `StepField` filtraba el signo al teclear, así que en un campo de
delta negativo (−3 reps) se podía escribir "3" y el valor se clampaba a 0. Ahora
admite el signo cuando `min < 0`.

Pendiente y apuntado por el usuario: un **bloque a medida** donde se elija qué
parámetros tocar, para lo que no encaje en los tres tipos.

**Ronda 2 de QA.** Cuatro cosas, una de ellas de fondo:

- **`th.colors.app` no existe en ningún theme.** Es un nombre de token de Figma
  que se coló como si fuera del theme; los 5 usos renderizaban sin fondo, que es
  lo que hacía que la hoja y sus tarjetas parecieran competir. Fondo de pantalla
  → `bg`, tarjetas dentro de una hoja → `surface`, y la hoja pasa a
  `background={th.colors.bg}` (patrón ya usado por AppHeader, ClientCodeModal y
  TrainerSyncModal — no era exclusivo del menú principal).
- **`planner.fields.restPct_keys` no existía.** La etiqueta se componía
  añadiendo el alcance a TODOS los campos, y el descanso no tiene variante por
  alcance. Ahora los campos declaran `scoped: true` y `fieldLabelKey` decide.
  Hay test que recorre cada peldaño de cada escalera y comprueba que la clave
  resultante existe en los DOS locales.
- **Los nombres de las escaleras describían la forma, no lo que hacen**, y
  "Lineal 3+1" además mentía desde que el número de peldaños es editable. Pasan
  a nombrar el objetivo: **Volumen total** (series a todo), **Intensidad**
  (rango corto en los principales) y **Accesorios** (series solo en accesorios).
  Las descripciones dicen qué toca cada una, sin mencionar la descarga —que es
  opcional y tiene su propio interruptor.
- La base ahora se dice **dentro de la hoja**, no solo en la pantalla.

**Verificado, sobre la duda del usuario:** añadir un segundo bloque NO parte de
la descarga del primero. `baseStageIdx` devuelve la última etapa **sin `rx`**, y
todos los peldaños generados llevan `rx`, así que la base sigue siendo la última
construida a mano. Es lo correcto: derivar de una descarga (−1 serie) haría que
el "+1" del bloque siguiente saliera por debajo del primero. La consecuencia
asumida es que dos bloques seguidos tienen la MISMA estructura de series y
rangos; el progreso entre bloques lo lleva el motor de progresión por ejercicio,
que es donde vive. Si algún día se quiere elegir otra base, el sitio es un
selector en esta hoja.

**Ronda 3 de QA.**

- **"Peldaño" desaparece de la UI.** En código el término se queda (`rung`,
  `buildRungs`) porque distingue bien la pieza de una escalera de la etapa ya
  creada, pero de cara al usuario todo es *etapa*: "Las etapas del bloque se
  derivan de «X»".
- **Borrar pasa a una X en la esquina de la fila.** Como botón de texto se comía
  media fila y competía con el stepper de ciclos, que es el control que de
  verdad se toca ahí. `CloseIcon` es nuevo en `EditorIcons` y queda disponible
  para el resto de la app.
- **`muted` (#4d4d4d) es casi invisible sobre `bg` (#151515).** Los subtítulos
  del planificador pasan a `mutedLight` (#818181). `muted` se queda solo donde
  Figma lo pide de verdad: el eyebrow sobre el relleno lima de la cabecera.

### 7.5 Nota

El paso de ciclos de la creación de programa **está en la fase 0** (§3.2.h),
no aquí: sin él no existe el momento "se acabó la etapa" y nada de esto tiene
puerta de entrada. El `StepField` del sheet de etapa
([ProgramEditorScreen.jsx:499](../../src/screens/ProgramEditorScreen.jsx))
necesita el mismo tratamiento de "sin límite", también en la fase 0.

---

## 8. i18n

Todas las cadenas en `src/locales/es.json` Y `en.json` (raíz del repo).
Namespaces: `planner.*` (escaleras, reglas, contador de ciclos, paso de
creación), `progression.deload_hold`, `editor.exerciseIsKey` / `editor.keyPill`,
`stage.noLimit`.

## 9. Casos borde (checklist de QA)

| Caso | Resultado esperado |
|---|---|
| Etapa creada sin `rx` | Idéntica a la de hoy (copia literal) |
| `setsDelta: -2` sobre un ejercicio de 1 serie | Queda en 1, no en −1 |
| `repsShift: -4` sobre un rango 5-8 | 1-4, no 1-4 con min>max ni negativos |
| Ejercicio de tiempo con `repsShift` | Sin cambios en tiempo; sí aplica `setsDelta`/`restPct` |
| Cliente entra en la primera sesión de una etapa nueva | **Ve chip y fantasmas de peso** (§4.1) |
| Ejercicio vinculado (`linkGroup`) en una etapa derivada | Gana el `linkGroup` sobre la cadena |
| Etapa de descarga | Chip `→` con mensaje de descarga; nunca `⬆` ni `⬇` |
| Etapa con `durationWeeks: null` | Nunca `stageAdvancePending`; Home no pinta "semana X de N" |
| Escalera aplicada y luego edición manual de una etapa | La edición manda; `stage.rx` queda como etiqueta desactualizada — aceptado, es procedencia |
| Programa del entrenador con escalera → cliente | Viaja en `program_json` como cualquier edición; el cliente ve `ProgramUpdateModal` |
| Etapa derivada borrada | Sus hijas quedan con `derivedFrom` apuntando a un id inexistente → `templateChainIds` corta ahí sin romper |
| Programa viejo sin `stages` en el móvil | Normalizado a 1 etapa con `durationWeeks = max(stageWeeksCompleted, 4)` |

## 10. Qué NO tocar

- **La aritmética de cierre de ciclo.** `cloneDays` ya acuña `tpl_*` frescos por
  etapa y `applyRx` **nunca toca ids**; `advanceCycle` y `stageProgress.js` se
  quedan como están.
- **Todo el circuito de `stage-locks`**: `locked`, `stageActivatedAt`,
  `mergeProgressOnImport`, el blob de progreso, `clientStageIndex`. Ver
  [stage-locks.md](stage-locks.md).
- `progression.type` y `direction` por ejercicio (§2.7).
- `duplicateStageInProgram` — copia literal, es otra acción y sigue teniendo
  sentido.
- `sessionRecap.js` (§4.2).
- El generador de programas (`programGenerator.js` / `archetypeAdapter.js`) más
  allá de emitir `stages` en la fase 0.

## 11. Fases

| # | Alcance | Coste | Modelo |
|---|---|---|---|
| 0 | Unificación del modelo + paso de ciclos en los 2 modales de creación (§3) | 🟢 | ✅ **IMPLEMENTADA** — 875 tests verdes, lint igual que HEAD |
| 1 | `applyRx` + `templateChainIds` + `addStageToProgram({rx})` (§4) | 🟡 | ✅ **IMPLEMENTADA** — 911 tests. `applyRx` no tiene llamante en producción hasta la fase 4: lo que aporta valor hoy es la cadena (§4.1) |
| 2 | Switch "principal" + pill KEY → habilita `scope` (§5) | 🟢 | ✅ **IMPLEMENTADA** — la pill reutiliza el hueco de la pill de bloque; `isKey` NO viaja en `LINKED_CONFIG_KEYS` |
| 3 | `progressionHold: 'deload'` en `progression.js` (§6) | 🟢 | ✅ **IMPLEMENTADA** — no se puede ver en el móvil hasta la fase 4: nada escribe `hold` hasta que el planificador cree un peldaño de descarga |
| 4 | Pantalla de planificador (§7) | 🔴 | ✅ **IMPLEMENTADA** — `StagePlannerScreen`, entrada por la hoja del `+`; la escalera se aplica al momento, sin borrador |
| 5 | *(futuro)* Grupo B: recap consciente de la descarga (§4.2) | 🟡 | — |

Las fases 0-3 aportan valor solas y son entregables por separado. La 4 es la
que convierte todo lo anterior en una herramienta.

## 12. Las otras cuatro palancas del análisis (contexto, no alcance)

Del análisis original (ago 2026), por si se retoman:

- **P2 — política de progresión en la etapa**: absorbida aquí como
  `incrementScale` + `progressionHold`.
- **P3 — triaje de clientes**: banderas en la lista de `ClientsScreen` usando
  lo ya calculado (`adherence.js`, `trainingLoad.js`, el blob `progress`): no
  ejecuta · etapa esperando · monótono · estancado · hueco de grupo muscular.
  Coste 🟢, no depende de esta spec, ROI muy alto.
- **P4 — propuesta de etapa al cerrar una etapa**: cuando
  `stageWeeksCompleted ≥ durationWeeks`, redactar un **borrador** de la
  siguiente desde métricas. Regla, primera que dispara gana: adherencia <70% ⇒
  repetir · monotonía repetitiva o strain alto con rendimiento plano ⇒ descarga
  · rendimiento ↑ con carga estable ⇒ intensificar · rendimiento plano con
  adherencia buena ⇒ cambiar estímulo · por defecto ⇒ repetir con `+1` serie.
  **Esta spec es lo que hace P4 barato**: su salida es un `rx` y un número de
  ciclos, es decir una llamada a `addStageToProgram`. Nunca autopilot: borrador
  que el entrenador acepta, edita o descarta.
- **P5 — el peso sugerido vuelve al programa**: hoy `progression.seed` se queda
  fosilizado en lo que puso el entrenador el día 1, así que al planificar la
  etapa siguiente el programa miente sobre los pesos reales.

Regla de encuadre heredada de [training-load.md](training-load.md) y que esta
spec respeta: **la carga es un termómetro, no un mando.** El planificador
propone *estructura* (series, rangos, descansos); el kilaje sigue siendo del
motor reactivo por ejercicio.

## 13. Patrones existentes a imitar (rutas exactas)

- Util puro + tests: [`src/utils/stageProgress.js`](../../../src/utils/stageProgress.js)
  y `conditioningBlocks.js`.
- Lectura de historial a través de varias plantillas:
  [`src/utils/exerciseLinks.js`](../../../src/utils/exerciseLinks.js)
  (`linkGroupTemplateIds`, `lastLinkedExercise`).
- Acción de store que reescribe etapas: `updateStage` / `setCurrentStage` en
  [useStore.js](../../store/useStore.js).
- Sheet de etapa y `StepField`:
  [ProgramEditorScreen.jsx:472](../../src/screens/ProgramEditorScreen.jsx).
- Reglas de fidelidad visual: `mobile/docs/UI-MIGRATION.md` — el planificador
  es pantalla nueva sin nodo de Figma ⇒ tokens y primitivas existentes, no
  inventar.
