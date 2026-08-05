# Spec — Propuesta de etapa (P4)

> Estado: **spec cerrada, sin implementar** (ago 2026). Es la **P4** del análisis
> de 5 palancas que produjo [stage-planner.md](stage-planner.md) (P1) y
> [client-triage.md](client-triage.md) (P3). Origen: conversación Opus + usuario
> (ago 2026).
>
> Qué resuelve: hoy el planificador se abre **vacío**. El entrenador tiene
> delante seis meses de métricas —adherencia, rendimiento, carga, series por
> grupo— y aun así elige el bloque siguiente de memoria. Esta spec convierte esos
> datos en un **borrador** de la etapa siguiente.
>
> **Nunca autopilot.** La salida es un prellenado del planificador que el
> entrenador acepta, edita o descarta. Regla de encuadre heredada de
> [training-load.md](training-load.md): *la carga es un termómetro, no un mando.*

---

## 1. Las dos decisiones que dan forma a todo lo demás

### 1.1 El vocabulario de salida está cerrado por `applyRx`

Una propuesta solo puede hablar el idioma que
[`stageRx.js`](../../../src/utils/stageRx.js) sabe materializar: `scope`,
`setsDelta`, `repsShift`, `restPct`, `incrementScale`, `progressionHold` y
`durationWeeks`. **Nada más existe.** Por tanto hay cuatro arquetipos
proponibles:

| Arquetipo | `rx` | Ciclos |
|---|---|---|
| **Descarga** | `setsDelta:-1, progressionHold:'deload'` | 1 |
| **Volumen** | `setsDelta:+1` (`all` o `accessories`) | 4 |
| **Intensidad** | `scope:'keys', repsShift:-3, restPct:+25` | 3-4 |
| **Repetir** | noop | = la anterior |

Y tres cosas **no proponibles**, que salen como aviso con acción manual y
**nunca** como etapa: cambiar ejercicios, cambiar el nº de sesiones por ciclo, y
tocar kilos. Lo último por decisión ya cerrada — el kilaje es del motor de
progresión por ejercicio, no de la estructura.

Fingir que una propuesta puede cambiar los ejercicios es la forma más rápida de
que el entrenador deje de leer las propuestas.

### 1.2 Quién ve una propuesta — la puerta

**Un cliente que termina una etapa de un programa de su entrenador no recibe
ninguna propuesta.** Ni card, ni banner, **ni se calcula** — la pasada por el log
no es gratis y no hay nada que enseñar. De eso se encarga el entrenador.

La condición ya existe, inline, en
[useStore.js:1416](../../store/useStore.js):

```js
const isAuthor = !(clientSync?.slotId && clientSync.trainerProgramIds?.includes(programId));
```

Se extrae a `isProgramAuthor(programId, clientSync)` y se usa como gate de render
**y de cálculo**:

| Quién | Propuesta |
|---|---|
| Cliente, programa del entrenador | **nada, en ningún sitio** |
| Entrenador mirando a un cliente | sí |
| Usuario solo, programa propio | sí — es su propio entrenador |

---

## 2. Señales, clasificadas por disponibilidad

| Nivel | Señal | Requisito |
|---|---|---|
| **T0** | [`computeAdherence`](../../../src/utils/adherence.js), `adherencePct`, `stageWeeksCompleted` vs `durationWeeks` | nada |
| **T1** | [`performanceWeekly`](../../../src/utils/trainingLoad.js), carga **externa** semanal, `setsByMuscleGroup` | ≥8 semanas de log |
| **T2** | `monotony`, `strain`, `loadState`, `effortTrend` | **`sessionRpe`, que es opt-in** |

**Regla dura: ninguna propuesta puede depender solo de T2.**
[client-triage.md](client-triage.md) §5 ya descartó monotonía y strain como
bandera por exactamente este motivo — estarían apagadas para todo cliente que no
puntúe sus sesiones. T2 **afina y sube la confianza**; nunca dispara solo.

### 2.1 El proxy de fatiga — cascada, primer escalón con dato gana

El caso que motiva la feature ("el rendimiento no sube pero la fatiga sí")
necesita medir fatiga **sin** sRPE:

1. **Con sRPE** (≥60% de las sesiones de las últimas 4 semanas lo llevan):
   `strain` de la semana contra su base de 4 semanas (+25%), o
   `monotony > MONOTONY_HIGH`.
2. **Sin sRPE**: **carga externa ↑ con rendimiento plano** — más trabajo, misma
   salida: estás pagando y no cobras. Es el cuadrante `fatigue` de
   `effortTrend`, medido externa-vs-rendimiento en vez de externa-vs-interna.
3. **Sin nada**: **ciclos consecutivos sin descarga**. El tiempo bajo carga es
   por sí solo un prior de fatiga y no necesita ningún dato.

El escalón alcanzado decide el `confidence` de la propuesta (1 ⇒ `high`,
2 y 3 ⇒ `low`), que la UI dice en palabras.

---

## 3. El carácter de una etapa se MIDE, no se lee

⚠️ **Ninguna regla puede leer `stage.rx`.** `rx` solo existe si la etapa la creó
el planificador, y la propia spec del planificador ya lo declaró poco fiable:
*"editar la etapa a mano manda sobre ella; `stage.rx` queda como etiqueta
desactualizada — aceptado, es procedencia"*. Una feature que se apoye en él solo
funciona justo después de un bloque generado, que es la minoría de los casos.

El carácter se deriva de dos fuentes, en este orden:

**a) Carácter MEDIDO — lo que de hecho pasó.** Con la ventana de etapa (§4.1)
hay dos ventanas comparables: la de la etapa que cierra y la de la anterior.
Sobre ellas, dos números que ya se calculan:

```
series/semana ↓≥20%                 → descarga
series/semana ↑≥15%, reps ≈ igual   → volumen
series ≈, carga externa ↑           → intensidad
todo ≈                              → repetición
```

**b) Carácter PRESCRITO — diff estructural entre etapas consecutivas.**
`stages[i].days[].exercises[].exConfig` tiene `sets`, `minReps`, `maxReps`,
`restSec` y `progression.hold` (que `applyRx` **materializa** en el exConfig, así
que también se lee en una etapa escrita a mano). El diff contra `stages[i-1]` da
el mismo veredicto **sin log**, que es lo único disponible en el ciclo 1 de una
etapa.

Resultado: `stageCharacter → 'volume' | 'intensity' | 'deload' | 'repeat' | 'unknown'`.

**`unknown` es el caso normal, no el borde.** Primera etapa, sin límite, hecha a
mano: no hay con qué comparar. Lo que sobrevive:

| Regla | Con `unknown` |
|---|---|
| R0, R1, R2, R3, R6, R7 | **idénticas** |
| R4 / R5 (elegir entre volumen e intensidad) | degradan al default: **volumen** |

Es decir: el caso que motiva la feature funciona sin saber nada del pasado
estructural. Lo único que se pierde es la elección *fina* entre subir volumen o
subir intensidad, y su default es la opción conservadora.

---

## 4. Piezas nuevas

### 4.1 Ventana de etapa — dentro de [`stageProgress.js`](../../../src/utils/stageProgress.js)

```js
stageStart(log, stage)  // min(timestamp) de entries con sessionTemplateId ∈ stage.days[]
stageLog(log, stage)    // sus entries
```

Cada etapa acuña `tpl_*` frescos, así que **el log ya lleva la identidad de
etapa dentro**. Son ~15 líneas y **desbloquean el problema que aparcó la fase 6
de [training-load.md](training-load.md)**: "las etapas no guardan cuándo
empezaron" y "ciclo ≠ semana natural". Sin campo nuevo y sin migración.

Fichero propio no: es aritmética de etapa, vive con el resto.

### 4.2 `src/utils/clientState.js` — las cuatro lecturas en UNA pasada

```js
readClientState({ log, allExercises, program, stageIndex, progress, adherence, now })
→ {
    execution,          // de computeAdherence: 'ok' | 'flojo' | 'roto'
    performance,        // 'up' | 'flat' | 'down' | null
    cost,               // 'bajo' | 'normal' | 'alto' | null
    rpeCoverage,        // 0-1
    stageCharacter,     // §3
    stage: { cycles, cyclesSinceDeload },
  }
```

Una función y no una por señal, por lo que ya estableció
[client-triage.md](client-triage.md) §4: `performanceWeekly` recorre cada serie
de cada sesión y con 20 clientes no se puede llamar una vez por bandera.

Piezas internas que no existen:

- **`perfTrend(series, { block: 4, flat: 2 })` → `'up'|'flat'|'down'`.** Es el
  mismo `isStalled` que pide [client-triage.md](client-triage.md) §3.2 —
  **construirlo una vez** y que lo consuman las dos features. Medias de bloque
  4 vs 4, nunca dos puntos sueltos: con un mesociclo 3:1, comparar la última
  semana contra la de hace cuatro enfrenta descarga con descarga.
- **`costSignal(...)`** — la cascada de §2.1.
- **`rpeCoverage(log, weeks)`** — decide el escalón de la cascada y el
  `confidence`.
- **`stageCharacter(...)`** — §3.

La carga externa semanal **no necesita código nuevo**: `sessionLoads` →
`dailySeries` → `weeklySeries` ya encadenan.

### 4.3 `src/utils/stageProposal.js`

```js
proposeNextStage(state, { stages, stageIndex })
→ null
| { rungs:      [{ kind, durationWeeks, rx }],   // formato exacto de buildRungs
    ladderId,                                    // preselecciona el segmentado
    reasonKey,                                   // i18n, nunca texto armado
    evidence:   [{ key, value }],                // "6 ciclos · rendimiento −1% · carga +18%"
    confidence: 'high' | 'low' }
```

`rungs` sale en el formato que ya come `addStageLadder`. **Cero maquinaria nueva
en el store.**

---

## 5. Las reglas — la primera que dispara, gana

El orden es "lo que descalifica el diagnóstico, primero". Mismo criterio de
prioridad que ya usa el triaje.

**R0 · Sin datos.** <8 semanas de log o <2 ciclos cerrados ⇒ **`null`**. El
planificador se abre vacío, como hoy. El día 1 no se diagnostica nada.

**R1 · Ejecución rota.** `requiresAttention(status)` o adherencia <70% ⇒
**repetir igual** (noop, misma duración). Un cliente que no entrena también sale
plano, y llamarlo "estancado" es el diagnóstico equivocado: el problema es que no
ejecuta, no que el programa no sirva. Con adherencia <50% sostenida, además,
aviso de **reducir sesiones por ciclo** — que `rx` no puede hacer: texto y acción
al editor, no una etapa.

**R2 · Coste alto + rendimiento no subiendo ⇒ DESCARGA**, 1 ciclo.
Guard: **si `stageCharacter === 'deload'`, esta regla no dispara.** Nunca dos
descargas seguidas; cae a R5.

**R3 · ≥6 ciclos sin descarga y rendimiento no subiendo ⇒ DESCARGA.**
Es el disparo por tiempo, y el que cubre las etapas **sin límite**, donde no hay
cierre al que engancharse. Si el rendimiento **sí** sube no se interrumpe nada
hasta el techo duro de 8 ciclos, y ahí solo se avisa.

**R4 · Rendimiento subiendo + coste normal ⇒ seguir apretando.**
- Si `stageCharacter === 'volume'` **y** los grupos principales están en el techo
  de `SETS_TARGET_MAX` ⇒ **Intensidad**. No se pueden añadir series eternamente.
- Si no ⇒ **Volumen**.

**R5 · Rendimiento plano + ejecución buena + coste normal ⇒ alternar el
estímulo.** `volume` → Intensidad; `intensity` → Volumen; `unknown` → Volumen.
Si ya se alternaron **dos** bloques y sigue plano ⇒ **aviso de cambiar
ejercicios**, no una etapa (§1.1).

**R6 · Rendimiento bajando con ejecución buena ⇒ DOS etapas**: descarga (1
ciclo) + vuelta a la base (noop, 4). Único caso que propone más de una.

**R7 · Por defecto ⇒ repetir la base con `setsDelta:+1`, 4 ciclos.**

### 5.1 Modificadores (afinan, no disparan)

- **`setsByMuscleGroup`**: si algún grupo está bajo `SETS_TARGET_MIN`, la serie
  extra de R4/R7 va a `scope:'accessories'` en vez de `all`. Como **bandera** ya
  se descartó (el programa está cerrado de antemano, §5 del triaje); como
  **selector de dónde poner la serie** sí es información nueva.
- **Duración propuesta** = la de la etapa que cierra, acotada a 3-5 ciclos. Si
  era "sin límite", 4. La duración que eligió el entrenador ya es información.
- **Empate** ⇒ gana la más conservadora: descarga > repetir > subir.

---

## 6. Estado nuevo que persistir — poco, y con una trampa

Solo el **cool-down** del aviso en etapas sin límite. Sin él sale en cada cierre
de ciclo y se ignora a la tercera.

⚠️ **No guardarlo en `stage.*` ni en ningún sitio del programa.** Cualquier
escritura al programa viaja en `program_json` y le dispara al cliente el
`ProgramUpdateModal`: le llegaría una "actualización de programa" por un dato de
UI del entrenador. Va como mapa **local del dispositivo que lo pinta**, fuera de
`programs`:

```js
proposalDismissed: { [`${programId}:${stageIdx}`]: cyclesWhenDismissed }
// reaparece a +3 ciclos
```

Mismo criterio que ya se aplicó a `stageAdvancePending`: *"es un estado de UI
descartable"*.

## 7. Dos guards, cero campos nuevos

- **Frescura.** La propuesta se calcula en el móvil del entrenador sobre el log
  sincronizado del cliente. Si la última sesión tiene **>10 días**, no se
  propone: se dice "sin datos recientes". Sale del propio log.
- **Origen del progreso.** `progressFromBlob` / `clientStageIndex`, **nunca**
  `program.stageWeeksCompleted` — en el móvil del entrenador ese campo es de su
  copia y no se mueve. Lección ya pagada dos veces
  ([stage-locks.md](stage-locks.md) §9 y el QA de la fase 0 del planificador).

---

## 8. UI — cuatro sitios, dos ya construidos

1. **Caja `blockDone` del hero** ([ClientsScreen.jsx:404](../../src/screens/ClientsScreen.jsx))
   — ya existe con su CTA al planificador. Gana **una línea** con el `reasonKey`,
   y el botón pasa de "Planificar" a "Ver propuesta".
2. **[`StagePlannerScreen`](../../src/screens/StagePlannerScreen.jsx)** — recibe
   la propuesta y **prellena**: `ladderId` preselecciona el segmentado, `rungs`
   rellenan los campos, y arriba una tira de *por qué* con la evidencia y un
   "descartar". Como la escalera ya se aplica al momento sin borrador, la
   propuesta es prellenado y no un estado nuevo. Es el trabajo real de UI.
3. **NUEVO — entrada para el usuario solo.** `HomeScreen` ya calcula
   `stageComplete` y pinta la tira llena, pero **no hay ninguna puerta al
   planificador desde ahí**: quien se entrena solo termina la etapa y no pasa
   nada. Hace falta el equivalente del `blockDone` en la tarjeta de etapa, con
   CTA a `StagePlanner`. **Sin esto la feature solo existe para entrenadores.**
4. El aviso de "6 ciclos sin descarga" en etapa sin límite reutiliza 1 y 3. No es
   un canal nuevo, y **nada de notificaciones**.

## 9. i18n y transparencia

- `proposal.*`: un `reasonKey` por regla, las etiquetas de evidencia y el
  descartar. En `src/locales/es.json` **Y** `en.json` (raíz del repo).
- [metric-transparency.md](metric-transparency.md) obliga a la ficha (`what` /
  `formula` / `caveat`) **en el mismo commit**. Las métricas nuevas visibles son
  "rendimiento plano" y "coste", y son justo las que más letra pequeña necesitan:
  qué se compara con qué, y que **sin sRPE el coste es un proxy**, no una medida.

## 10. Calibración — no es opcional

Todos estos umbrales son **conjetura, no medida**:

`flat = 2` puntos de índice · `6` ciclos sin descarga · `60%` de cobertura de
sRPE · `+25%` de strain vs base · `<70%` de adherencia · `±20%/±15%` de series
para el carácter medido.

Calibrar contra `npm run seed` **antes** de dar la fase 3 por buena. Es la
lección que este proyecto ya se ha llevado tres veces: verificar los datos antes
de fiarse de una spec propia, incluida la recién escrita.

## 11. Casos borde (checklist de QA)

| Caso | Resultado |
|---|---|
| Cliente vinculado termina una etapa | **Nada en su móvil.** Ni card, ni cálculo |
| Usuario solo termina una etapa | Propuesta en Home, con CTA al planificador |
| Cliente con <8 semanas de log | `null`. Planificador vacío, como hoy |
| Cliente que no sincroniza desde hace 3 semanas | Sin propuesta: "sin datos recientes" |
| Cliente sin ningún `sessionRpe` | Propuesta igualmente, `confidence: 'low'`, coste por cascada 2/3 |
| Etapa cerrada que ya era descarga | R2 no dispara; nunca dos descargas seguidas |
| Programa con una sola etapa, hecha a mano, sin límite | `stageCharacter: 'unknown'`; R2/R3 funcionan igual |
| Etapa creada por el planificador (con `rx`) | **La misma propuesta que sin `rx`** — hay test de esto |
| Cliente en riesgo Y plano | R1 gana: repetir, no descarga |
| Aviso de etapa sin límite descartado | No vuelve hasta +3 ciclos |
| Entrenador con 20 clientes | Una sola pasada por cliente; solo `active`; medir con la semilla |

## 12. Qué NO tocar / NO construir

- **Autopilot.** Nada crea etapas solo. La propuesta prellena; el entrenador
  confirma.
- **Notificaciones push.**
- **Modelos fitness-fatigue (CTL/ATL/TSB) o ACWR numérico** — decisión cerrada,
  [training-load.md](training-load.md) §10.4.
- **`stage.rx` como entrada de ninguna regla** (§3).
- **Retro-aplicar** una propuesta a etapas ya creadas.
- `performanceWeekly`, `computeAdherence`, `applyRx`: se consumen, no se tocan.
- El circuito de [stage-locks.md](stage-locks.md): esta feature **lee** el blob
  de progreso y nada más.

## 13. Fases

| # | Alcance | Coste |
|---|---|---|
| 1 | `stageStart`/`stageLog` + `isProgramAuthor` extraído (§4.1, §1.2) | 🟢 |
| 2 | `perfTrend` + `costSignal` + `stageCharacter` + `readClientState` (§4.2) | 🟡 |
| 3 | `stageProposal.js` + tests + calibración con la semilla (§4.3, §5, §10) | 🟡 |
| 4 | Prellenado del planificador + línea en el hero (§8.1-2) | 🟡 |
| 5 | Entrada en Home + aviso de etapa sin límite + cool-down (§8.3-4, §6) | 🟢 |

Las fases 1 y 2 **valen solas**: la 1 desatasca la fase 6 de
[training-load.md](training-load.md), y la 2 entrega `perfTrend`, que es la
bandera "Estancado" que [client-triage.md](client-triage.md) §3 ya tiene
especificada.

## 14. Patrones existentes a imitar (rutas exactas)

- Util puro + tests: [`stageRx.js`](../../../src/utils/stageRx.js) +
  `.test.js`, [`stageProgress.js`](../../../src/utils/stageProgress.js).
- Memo por cliente sobre el log: `adherenceByClient` en
  [ClientsScreen.jsx](../../src/screens/ClientsScreen.jsx).
- Aviso en el hero con CTA: la caja `blockDone` / `lockBox`, mismo fichero.
- Prellenado de campos de escalera: `buildRungs` + `LADDER_FIELDS` en
  [`StagePlannerScreen`](../../src/screens/StagePlannerScreen.jsx).
- Fidelidad visual: `mobile/docs/UI-MIGRATION.md` — todo lo de esta spec cae en
  pantallas ya migradas ⇒ tokens y primitivas existentes, no inventar.
