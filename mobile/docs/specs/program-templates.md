# Spec — Programas por plantilla flexible

> Estado: **fases 1, 2, 2b, 3, 3b, 4 y 5 implementadas** (ago 2026, ver §5.2,
> §5.3, §5.3.1, §5.4, §5.5, §6 y §7); fases 6, 7 y 8 pendientes.
> **La 8 (catálogo) pasa a ser la más urgente**: el ranking destapó que no hay
> plantilla de 5-7 días y esos usuarios reciben demasiado volumen (§7).
> Origen: dos conversaciones Opus + usuario (ago 2026) — la primera sobre el
> onboarding de propuestas, la segunda sobre las reglas que hacen flexible una
> plantilla.
>
> **Sustituye a la fase C de [program-generator.md](program-generator.md) §6.**
> De aquella spec siguen vigentes: la arquitectura de su §1 (fases A y B,
> implementadas) y las decisiones de diseño de plantillas de su §6.1 (citadas
> aquí en §8.4).
>
> Qué resuelve: hoy el generador **fabrica** un programa infinito y sin fases a
> partir de ocho preguntas. Después de esto el usuario **elige** entre programas
> reales de duración concreta, y sus respuestas deciden cuál se le propone y cómo
> se adapta sin romperlo.

---

## 0. La idea en una página

No se puede escribir una plantilla por cada combinación de días × tiempo ×
nivel × material. Hay dos maneras de cubrir el hueco:

- **Adaptar** una plantilla concreta a las restricciones del usuario. Local,
  determinista, barato. Ya está construido al 80%.
- **Planificar** la estructura semanal desde cero a partir de los días. Eso es un
  solver — y es el generador procedural otra vez, con mejores entradas.

**Esta spec hace toda la adaptación y compra la planificación con catálogo.**
Más días no reorganiza la plantilla elegida: hace que el ranking elija otra
plantilla con más sesiones. El precio son cuatro plantillas nuevas (§8.2), y es
más barato y más honesto que un solver que siempre podrá "mejorar" lo que la
plantilla propone — momento en el que la plantilla deja de ser la base.

Lo que hace que esto funcione es un detalle del modelo de datos que ya existe:
**los programas son ciclos rotativos, no calendarios semanales.** Una plantilla
de 4 sesiones entrenada 3 días por semana no es "un programa de 4 días que no
puedes hacer": es un ciclo que tarda 9,3 días en vez de 7. Nadie se salta el día
4. Por eso el eje "días" no necesita un motor de redistribución: necesita un
término en el ranking (§7.1) y un multiplicador de volumen (§5.4).

---

## 1. Diagnóstico (medido, ago 2026)

### 1.1 Casi nadie ve una plantilla

`findBestArchetype` ([archetypes.js:518](../../../src/data/archetypes.js))
exige `daysPerWeek` **exacto** en sus tres tiers. Las 8 plantillas del catálogo
son de 3 o 4 sesiones ⇒ **quien pida 1, 2, 5, 6 o 7 días cae siempre al
generador procedural**.

Además compara dos magnitudes distintas: desde la fase B,
`answers.daysPerWeek` es **frecuencia semanal**; en el arquetipo, `daysPerWeek`
es el **nº de sesiones del ciclo**.

### 1.2 El camino recomendado no tiene plantilla detrás

`recommendDistribution` ([OnboardingScreen.jsx:72](../../src/screens/OnboardingScreen.jsx))
recomienda `push_pull_legs` a todo intermedio o avanzado de 3, 5 o 6 días. **No
existe ninguna plantilla PPL.** El perfil más común recibe una recomendación que
sólo puede acabar en el generador procedural.

| | full_body | upper_lower | push_pull_legs |
|---|---|---|---|
| 3 sesiones | 6 | — | — |
| 4 sesiones | — | 2 | — |

### 1.3 El sustituto se elige mal, y cuando no hay, el hueco se pierde en silencio

`findSubstitute` ([archetypeAdapter.js:60](../../../src/utils/archetypeAdapter.js))
filtra por patrón + grupo + equipo + nivel y devuelve **`candidates[0]`**: el
primero del objeto, sin ordenar. Ignora `priority[goal]`, la cercanía de nivel y
`isCompound`. Y cuando no encuentra nada hace `return`, así que **el slot
desaparece sin que nadie se entere** — ni el usuario, ni un test, ni el preview.

El camino procedural sí tiene la cascada bien hecha
(`getKeyCandidatesWithFallback`, fase A1). El camino de plantilla, que es el
importante, no. Es la causa del "hallazgo pendiente" que quedó documentado sin
resolver en [program-generator.md](program-generator.md) §6.1.

### 1.4 Nadie mira el volumen semanal

La plantilla fija las series **por ciclo**; la frecuencia las multiplica sin que
nadie lo compruebe:

```
sets semanales de un grupo = sets del grupo en el ciclo × (daysPerWeek ÷ sesionesDelCiclo)
```

Volumen por ciclo de las plantillas actuales (calculado sobre `archetypes.js`):

| Plantilla | ses. | back | chest | quads | glúteo | hombro |
|---|---|---|---|---|---|---|
| FB hipertrofia beginner | 3 | 12 | 8 | 6 | 5 | 5 |
| FB hipertrofia intermedio | 3 | 18 | 11 | 10 | 8 | 7 |
| U/L hipertrofia intermedio | 4 | 12 | 12 | 14 | 11 | 6 |
| U/L hipertrofia avanzado | 4 | 14 | 11 | 14 | 14 | 9 |
| Glúteo intermedio | 3 | 9 | 7 | 7 | **21** | 7 |

Lo que ocurre hoy con la plantilla de principiante si pide 6 días:

| días/semana | multiplicador | back | chest |
|---|---|---|---|
| 3 | ×1,0 | 12 | 8 |
| 6 | ×2,0 | **24** | **16** |

`reduceForBeginner` ([archetypeAdapter.js:126](../../../src/utils/archetypeAdapter.js))
quita un key y un accesorio **por sesión**, ciego a la frecuencia: corrige la
magnitud equivocada.

Y el 21 de la fila del glúteo es deliberado — es el énfasis de esa plantilla.
Una banda por nivel a secas se lo recortaría. Por eso §5.4 lleva
`volumeEmphasis`.

### 1.5 La compresión por tiempo salta un escalón

`trimToTimeBudget` ([archetypeAdapter.js:216](../../../src/utils/archetypeAdapter.js))
quita accesorios enteros y **nunca reduce series**. Salta de "el ejercicio está"
a "el ejercicio no está" sin pasar por "el ejercicio está con dos series".

### 1.6 Los programas generados no terminan nunca

`adaptArchetype` emite **una etapa con `durationWeeks: null`**
([archetypeAdapter.js:380](../../../src/utils/archetypeAdapter.js)). Fue
deliberado ([stage-planner.md](stage-planner.md) §3.2.h). Consecuencia: sin
fases, sin final, y **nunca** dispara el banner de fin de etapa ni la propuesta
de [stage-proposal.md](stage-proposal.md).

Mientras tanto la maquinaria de fases está construida entera para el
planificador manual: `applyRx`, `buildRungs` y las escaleras en
[stageRx.js](../../../src/utils/stageRx.js), y
`addStageToProgram(programId, { rx, sourceStageIdx, name, durationWeeks })`
([mobile/store/useStore.js:1176](../../store/useStore.js)), que ya clona la etapa
base, aplica la regla y encadena `derivedFrom` (sin esa cadena el cliente pierde
los pesos de referencia al cambiar de fase). **El generador no la usa.**

---

## 2. Decisiones cerradas con el usuario (no re-litigar)

1. **La plantilla tiene protagonismo.** El usuario elige un programa de una
   lista; no recibe uno fabricado. La adaptación es un servicio sobre la
   plantilla elegida, y se enseña.
2. **Adaptar sí, planificar no** (§0). El eje "días" se resuelve eligiendo otra
   plantilla, nunca reorganizando la elegida.
3. **El material nunca filtra, ordena.** Ninguna plantilla se oculta por falta de
   equipo: baja en el ranking y declara cuántos ejercicios se van a sustituir.
4. **La pregunta de distribución desaparece.** Full body / U/L / PPL es una
   decisión que la plantilla ya tomó.
5. **Disciplina y objetivo se fusionan en una pregunta de identidad.** Por dentro
   siguen siendo dos campos (§7.3).
6. **Un principiante nunca recibe más de 3 sesiones distintas.** Si pide 6 días,
   rota una plantilla de 3 con el volumen recortado a su banda.
7. **El nivel se corrige con series, no sólo con ejercicios** (§5.4).
8. **El normalizador de volumen sólo recorta, nunca añade.** Un grupo por debajo
   de la banda no se rellena con ejercicios inventados: el mínimo lo decide quien
   escribió la plantilla.
9. **Tier 1 no se elimina nunca** — ni por tiempo, ni por volumen, ni por
   material (si hay alternativa). Es la regla de integridad principal.
   *Bajarle series* sí se permite, con suelo de 3: por tiempo sólo en las
   disciplinas cuya tabla lo incluye (§5.6), y por volumen sólo cuando los
   accesorios se han agotado (§5.4). No es la misma decisión: el ejercicio sigue
   en la sesión, con su progresión.
10. **Las fases de una plantilla son deltas contra la BASE**, no acumulativos —
    misma decisión que el planificador ([stage-planner.md](stage-planner.md) §2.4).
11. **Las reglas de integridad son un validador, no un pipeline** (§9). Se
    comprueban sobre el resultado, en el harness que ya existe; no se resuelven
    con un solver de restricciones.
12. **Un motor, una tabla por disciplina** (§5.6). No tres motores.
13. **El generador procedural no desaparece**: deja de ser autor de programas y
    queda como relleno interno de huecos.

### 2.1 Descartado con motivo (no re-proponer)

| Idea | Por qué no |
|---|---|
| Campo `fatiga` por ejercicio | Sus dos usos (no encadenar alta fatiga, los exigentes primero) los declara ya **el orden del array** de la plantilla, escrito a mano y respetado por el adaptador. 182 ejercicios de campo nuevo para reordenar lo que ya viene ordenado |
| Presupuesto de "recuperación" | No es medible el día 1 y el usuario no sabe contestarlo. El proxy honesto es el nivel, que ya se pregunta. Mismo argumento que [stage-planner.md](stage-planner.md) §2.8. Si algún día se mide, entra por la propuesta de etapa (P4), no por el onboarding |
| Motor de redistribución de días (4 días → 3) | Lo disuelve el ciclo rotativo (§0). Su único residuo real —perder frecuencia de un patrón clave— es un término del ranking (§7.1) |
| Declarar en la plantilla frecuencia ideal, duración ideal, distribución, volumen objetivo, intensidad | Todo eso ya se calcula del propio contenido de la plantilla. Declararlo otra vez son dos fuentes de verdad que se desincronizan en la tercera plantilla |
| Tres motores por disciplina | Tres caminos de código, tres juegos de tests, tres sitios donde arreglar el mismo bug. La diferencia real entre ellos es el orden de sacrificio: una tabla (§5.6) |

---

## 3. Modelo de plantilla flexible

Un arquetipo hoy es `{ id, name, tags, discipline, distribution, goal, level,
daysPerWeek, days: [{ label, name, color, emphasis, exercises: [...] }] }`.

### 3.1 Campos que se añaden

```js
// ── en el arquetipo ────────────────────────────────────────────────────────
summary: 'Tren superior y tren inferior alternados. Cada básico dos veces por semana.',
// Opcional. Hace dos cosas con el mismo dato: sube el techo de volumen de esos
// grupos (§5.4) y los protege del recorte por redundancia (§5.3). NO cuelga del
// `goal` — el goal es cómo se entrena, el énfasis es qué prioriza la plantilla.
volumeEmphasis: ['glutes_hamstrings'],
phases: [ … ],                            // opcional — §6

// ── en cada ejercicio del arquetipo ───────────────────────────────────────
tier: 1 | 2 | 3,                          // opcional — por defecto: role 'key' → 1, 'accessory' → 3
```

### 3.2 Campo que se elimina

`daysPerWeek` del arquetipo. Era el nombre equivocado para `days.length` y su
único uso era el matching exacto que causa §1.1. En el código pasa a llamarse
`sessionsPerCycle` y se **calcula**, no se declara.

### 3.3 Los tiers, y por qué no salen del adaptador

| Tier | Qué es | Se puede |
|---|---|---|
| 1 | Patrón principal, ejercicio donde queremos progresión, skill del objetivo | reducir series (según disciplina); **nunca eliminar** |
| 2 | Complementario, segundo estímulo del mismo patrón o músculo | reducir series, eliminar si su patrón ya lo cubre un tier 1 |
| 3 | Aislamiento, trabajo redundante, extra | reducir series, eliminar |

La frontera de hoy es binaria (`isKey`) y la consume medio sistema: el
`scope: 'keys'|'accessories'` de `applyRx`, la pill KEY del editor, el recorte por
tiempo, la vista de programa. Hacerla ternaria tocaría todo eso.

Por tanto: **`tier` vive en el dato del arquetipo, se usa sólo dentro del
adaptador para decidir el orden de compresión, y nunca llega al `exConfig`** —
que sigue exportando `isKey: tier === 1`. Cero cambios fuera del adaptador.

### 3.4 El slot ya existe

Cada ejercicio del arquetipo lleva `pattern` y `primaryGroup` escritos al lado
del `exerciseId`. Eso **es** un slot: la plantilla ya dice "empuje horizontal de
pecho, tier 1, y mi preferencia es press de banca". No hace falta un modelo de
datos nuevo — hace falta un resolvedor decente (§5.2).

Los metadatos que hacen falta por ejercicio ya están en la biblioteca de 182:
`pattern`, `primaryGroup`, `muscles[]`, `equipment[]`, `level`, `isCompound`,
`isKeyCandidate`, `priority: { [goal]: high|medium|low }`, `relatedVariants`.

---

## 4. Orden de adaptación

```
1. Elegir plantilla         ranking: identidad · nivel · velocidad de ciclo · coste de material   (§7)
2. Resolver slots           material · nivel · limitaciones → ejercicio concreto                  (§5.2)
3. Ajustar por nivel        reduceForBeginner (existente)                                         —
4. Normalizar volumen       banda por nivel × emphasis, sobre el CICLO entero                     (§5.4)
5. Comprimir por tiempo     escalera de compresión, por SESIÓN                                    (§5.3)
6. Validar integridad       invariantes; lo irreducible se enseña, no se fuerza                   (§9)
```

Dos cosas del orden que no son negociables y una que da igual:

- **Volumen antes que tiempo.** Recortar series acorta la sesión, y el
  presupuesto de tiempo es la restricción dura del usuario: tiene la última
  palabra.
- **Volumen sobre el ciclo, compresión por sesión.** Son magnitudes distintas y
  se calculan en ámbitos distintos.
- **La sustitución por material da igual dónde vaya**: es neutra en volumen y en
  tiempo (las series y el descanso los trae la plantilla, no el ejercicio). Va la
  segunda porque es lo más legible, no porque importe.

⚠️ Cambio estructural en `adaptArchetype`: hoy construye y cierra cada
`sessionTemplate` dentro del `forEach` de días. Los pasos 4 y 6 necesitan **el
ciclo entero a la vez**. Separar en dos pasadas: construir todos los
`exercises[]`, normalizar y validar, y después montar los `sessionTemplates`
(warmup, orden, ids).

---

## 5. FASES 1-3 — El adaptador flexible

Tres commits independientes sobre `src/utils/`. Ninguno toca UI.

### 5.1 Resultado enriquecido

`adaptArchetype` pasa a devolver, además de `{ program, sessionTemplates }`:

```js
{
  substitutions: [{ slotExerciseId, resolvedExerciseId, reason: 'equipment'|'level'|'limitation' }],
  unresolved:    [{ pattern, primaryGroup, tier }],   // slots que la biblioteca no pudo llenar
  weekly:        { back: 18, chest: 11, … },          // sets semanales por grupo, ya normalizados
  overBudget:    ['glutes_hamstrings'],               // grupos irreducibles (§5.4)
  overTime:      false,                               // no cupo en sessionMinutes (§5.3)
}
```

Todo esto lo consume el preview (§7.5) y el harness (§9). Hoy los tres primeros
existen dentro de la función y se tiran.

### 5.2 FASE 1 — Resolvedor de slots 🟢 ✅ IMPLEMENTADA

> Medido sobre la matriz de 528 combos del harness: sesiones cortas **56 → 40**
> (−29%). El umbral informativo de `programGenerator.test.js` baja de 11% a 9%.
>
> **Hallazgo al implementar, no bloqueante:** los 39 slots tier 1 que siguen sin
> resolverse son **todos** `back` con `equipment: []`. La biblioteca tiene 43
> ejercicios de peso corporal y **ni uno solo de tracción** — un usuario sin
> material se queda sin espalda. Es contenido que falta (remo invertido, remo con
> toalla), no lógica: ningún resolvedor puede arreglarlo. Va a la fase 8 (§11.2).
> Antes desaparecían en silencio; ahora salen en `unresolved`.
>
> **Caso añadido sobre la spec:** dos slots del mismo día que apuntan al mismo
> `exerciseId` perdían el segundo en silencio (`if (usedIds.has(resolvedId))
> return`). Ahora el segundo se resuelve como cualquier otro slot, con
> `reason: 'duplicate'`. Es la misma clase de fallo que ataca la fase.
>
> `tierOf()` ya aplica el defecto `key → 1`, `accessory → 3` (§3.1): la fase 2
> solo tiene que empezar a leer `tier` de las plantillas.

Sustituye a `findSubstitute`. En `src/utils/slotResolver.js` (nuevo, puro):

```js
resolveSlot({ pattern, primaryGroup, tier, goal, userLevel, userEquipment, excludeIds, allExercises })
  → { exercise, reason } | null
```

**Cascada** — parar en el primer escalón con resultados:

1. `pattern` + `primaryGroup` + equipo + nivel ≤ usuario
2. `pattern` + `primaryGroup` + equipo, **cualquier nivel**
3. `pattern` + equipo + nivel ≤ usuario (cualquier grupo)
4. `pattern` + equipo, cualquier nivel
5. *(sólo tier 1)* `primaryGroup` + `isCompound` + equipo, cualquier patrón

**Comparador**, aplicado dentro de cada escalón, en este orden:

1. `priority[goal]`: high > medium > low
2. `isCompound` primero, **sólo para tier 1**
3. menor `|LEVEL_ORDER[ex.level] − LEVEL_ORDER[userLevel]|`
4. `id` alfabético — desempate determinista, para que el mismo `answers` dé
   siempre el mismo programa

**Nunca devuelve `null` en silencio**: si los cinco escalones fallan, el llamante
lo apunta en `unresolved[]`. Un `unresolved` de tier 1 es una violación de
integridad (§9); de tier 2 o 3 es aceptable y se enseña en el preview.

La rama de limitación (`userLevel: 'beginner'` forzado, ya existente) se conserva
tal cual: entra en la misma cascada con el nivel bajado.

**Tests**: mismo `answers` ⇒ mismo resultado; con `equipment: ['dumbbells']` un
slot de press de banca con barra resuelve a press con mancuernas y no a un
aislamiento; con `goal: 'strength'` gana el candidato con `priority.strength ===
'high'` frente a uno `medium` del mismo patrón; ningún tier 1 queda sin resolver
en la matriz completa salvo biblioteca agotada demostrable.

### 5.3 FASE 2 — Escalera de compresión por tiempo 🟢 ✅ IMPLEMENTADA

> `src/utils/sessionCompression.js` (nuevo, puro): escalera + `DISCIPLINE_RULES`
> + `estimateSessionSec`. Lo usan **los dos** caminos: `adaptArchetype` y
> `generateProgram`. Eso revierte a propósito la duplicación deliberada de la
> fórmula de tiempo — se mantenía porque eran tres líneas; con seis peldaños y
> una tabla por disciplina, dos copias divergen seguro.
>
> Medido sobre la matriz de 528 combos, **con el mismo número de ejercicios por
> sesión** (3,99 y 4,63 de media): sesiones que se pasan del presupuesto de 45
> min, 626 → 410; de 60 min, 236 → 119. Sesiones cortas (<4 ejercicios), 40 → 30.
> Es decir: se cumple más el presupuesto sin perder contenido, que es justo lo
> que aporta el escalón que faltaba.
>
> **Decisión cerrada — qué cae primero.** Cae la **redundancia**, no el estímulo
> único: en el día de pierna del análisis se va la extensión de cuádriceps
> (tercer ejercicio de `quads`) antes que el gemelo (único de su grupo). Es la
> doctrina del propio análisis — "preservar estímulo → eliminar redundancia →
> reducir volumen".
>
> **Con una excepción: el énfasis de la plantilla.** Un grupo listado en
> `volumeEmphasis` no cuenta como redundante por mucho que se repita — en un
> programa de glúteo, el tercer ejercicio de glúteo *es* el programa. `t3Remove`
> además lo sacrifica el último. El suelo de sesión sigue mandando por encima:
> con un presupuesto imposible, el énfasis también cae.
>
> Ojo con de dónde cuelga esto: **no del `goal`**. Los goals (`hypertrophy`,
> `endurance`, `strength`, `max_strength`) describen *cómo* se entrena —rango de
> reps, descanso, intensidad—, no qué se prioriza. "Glúteo" no es un goal, es una
> **disciplina** (`glutes_legs`, que autorrellena `goal: 'hypertrophy'`), y su
> énfasis vive en la plantilla. Por eso el mismo campo `volumeEmphasis` gobierna
> las dos caras: sube el techo de volumen del grupo (§5.4) y lo protege del
> recorte por tiempo.

#### 5.3.1 FASE 2b — Sesiones cortas 🟢 ✅ IMPLEMENTADA

El problema: **30 min era estructuralmente inalcanzable**. El suelo de 1
principal + 2 accesorios, más 8 min de calentamiento general
(`SESSION_OVERHEAD_SEC`) y 3 min de transición por ejercicio
(`EXERCISE_OVERHEAD_SEC`), sumaban ~17 min antes de la primera serie. Se pasaban
1202 de 2016 sesiones de la matriz y la escalera no podía hacer nada más.

Y esos overheads son una **suposición**: modelan un gimnasio comercial lleno.

**Regla 1 — por debajo de 60 min no se cuenta el calentamiento general**
(`NO_WARMUP_BELOW_MIN`). En media hora no se calientan ocho minutos: se entra a
trabajar.

Las transiciones **sí se cuentan siempre**, y no es un matiz: quitarlas también
invertía el orden de los presupuestos. Sin ellas, 45 min darían 45 de trabajo y
60 min darían `60 − 8 − 3n ≈ 37` con cinco ejercicios — pedir más tiempo
entregaría menos entrenamiento. Quitando sólo el calentamiento, `45 − 3n` frente
a `52 − 3n`: creciente siempre, sea cual sea n. Hay un test que lo fija.

**Regla 0 — el presupuesto tiene tolerancia** (`TIME_TOLERANCE = 0,15`,
decisión del usuario). Antes, 60 minutos eran 60 exactos: una sesión de 60:20
perdía un ejercicio y una de 59:59 pasaba entera. Eso no es precisión, es ruido
con consecuencias — el presupuesto es una **estimación** construida sobre
overheads inventados (3 min por transición, 8 de calentamiento), no un
cronómetro.

El 15% da +9 min sobre un presupuesto de 60, que es lo que alguien entiende por
"una hora", y escala bien en los extremos: 34 para quien pidió 30, 103 para quien
pidió 90. Un porcentaje y no minutos fijos, porque +10 sobre 30 es un tercio más
de sesión. Por debajo del presupuesto no actúa: si la sesión sale corta, se
enseña corta.

Medido sobre la matriz: a 60 min los avisos de `overTime` pasan de **293 a 100**
y la media de ejercicios por sesión sube de 4,86 a 4,97. Y la Full Body de 2
sesiones —que a 60 se quedaba en 60:20 y perdía contenido— sobrevive entera:
68 min, 6 ejercicios, sin aviso.

**Regla 1b — por debajo del umbral, borrar antes que bajar series.** En una
sesión corta el montaje domina: un ejercicio a 2 series cuesta 180 s de
transición para 190 s de trabajo. Quitarlo ahorra los 370 s enteros; bajarle una
serie ahorra 95. Media docena de ejercicios a dos series es tiempo perdido
preparando material — mejor menos ejercicios con sus series completas.

Se deriva del orden de cada disciplina (`removalFirst`) en vez de escribir una
segunda tabla: los peldaños que quitan van delante, los que recortan detrás, y
cada grupo conserva su orden relativo. Para `strength`, que ya borraba primero,
no cambia nada.

⚠️ **Medido: hoy casi no se nota** (sesiones que se pasan a 45 min, 76 → 75; a
60 min, 62 → 60). La razón es que `t3Redundant` va primero en los dos órdenes y
las plantillas actuales tienen redundancia de sobra, así que el reordenamiento
rara vez llega a actuar. Se conserva porque la regla es correcta y el coste son
cuatro líneas derivadas; ganará peso cuando el catálogo tenga plantillas con
accesorios más diferenciados (fase 8). Hay un test que lo aísla con una sesión
sin redundancia ni pares antagonistas: a 59 min salen 4 ejercicios con sus 4
series, a 62 min salen 5 con tres recortados a 3.

**Regla 2 — superserie de opuestos, sólo en sesiones cortas.** Peldaño nuevo,
el primero de la escalera porque es el único que gana tiempo **sin quitar
ejercicios**: encadena dos accesorios tier 3 contiguos de patrones antagonistas
(`OPPOSITE_PATTERNS`: empuje↔tracción, sentadilla↔bisagra) marcando
`supersetWithNext`, con lo que el primero deja de contar su descanso.

- Sólo **contiguos**: `supersetWithNext` significa "encadenado con el siguiente",
  así que emparejar a distancia obligaría a reordenar lo que escribió quien
  diseñó la sesión. En las plantillas reales los accesorios contiguos ya suelen
  ser opuestos (remo + apertura).
- Sólo **opuestos**: encadenar dos del mismo grupo no es una superserie, es
  fatiga acumulada sobre el mismo músculo. Los patrones sin antagonista (core,
  gemelo, agarre) no se emparejan.
- Nunca **más de dos** eslabones.
- Sólo por **debajo de 60 min**: con 90 minutos por delante no hay razón para
  comprometer el descanso de nada.

**El preview usa el mismo criterio.** Enseñaba `sessionStats`, que siempre suma
el calentamiento — habría contradicho al presupuesto que se acaba de aplicar.
Ahora usa `estimateSessionSec` con el mismo flag, y cuando el calentamiento no
cuenta lo dice: `onboarding.preview.noWarmupNote`. `sessionStats` no se toca: lo
usa el resto de la app y sí debe contarlo todo.

**Medido** sobre la matriz de 528 combos (sesiones que se pasan del presupuesto):

| presupuesto | antes de la fase 2 | fase 2 | **fase 2b** |
|---|---|---|---|
| 30 min | 1250 | 1202 | **508** |
| 45 min | 626 | 410 | **144** |
| 60 min | 236 | 119 | 119 (sin cambio, por diseño) |

Y la media de ejercicios a 45 min **sube** de 3,99 a 4,04: la superserie
conserva lo que el peldaño siguiente habría borrado. El grueso de la mejora es
la regla 1 (55 superseries en 2016 sesiones no explican 694 sesiones menos).

**Lo que sigue sin caber es correcto.** Un día de dos básicos pesados a 3 series
con 3 y 2 min de descanso son 20 min sólo de descanso: no entra en 30 minutos y
`overTime` lo dice. El suelo de series no se salta para cumplir un presupuesto.

**Bloques de acondicionamiento — fuera, a la fase 8.** Son buena forma de
entrenar con poco tiempo, pero un bloque es **contenido**, no una
transformación: no se fabrica un AMRAP comprimiendo una sesión de fuerza. Lo
declara la plantilla, con su propio diseño.

Sustituye el bucle de `trimToTimeBudget`. Mismo sitio, mismas garantías previas
(keys intactos, estimación con la fórmula espejo de `sessionStats`), pero con el
escalón que falta: **reducir series antes de borrar ejercicios**.

Pasos, cada uno repetible hasta agotarse, en el orden que dicte la disciplina
(§5.6):

| Paso | Qué hace | Suelo |
|---|---|---|
| `t3Redundant` | Quita el último tier 3 cuyo `primaryGroup` ya cubra otro ejercicio de la sesión | — |
| `t3Sets` | −1 serie al tier 3 con más series | 2 series · **máx. 2 accesorios en el suelo** |
| `t3Remove` | Quita el último tier 3 | 2 accesorios por sesión |
| `t2Sets` | −1 serie al tier 2 con más series | 2 series |
| `t2Remove` | Quita el tier 2 cuyo patrón ya cubra un tier 1 de la sesión | — |
| `t1Sets` | −1 serie al tier 1 con más series | 3 series |

Tier 1 **nunca se elimina**. Si se agotan los pasos disponibles y sigue sin
caber, se para, `overTime: true`, y el preview enseña la duración real. Mentir
sobre el tiempo es peor que pasarse de él.

**Tope de accesorios en el suelo** (`MAX_ACCESSORIES_AT_FLOOR = 2`, decisión del
usuario). Ni la escalera ni el normalizador de volumen dejan un **tercer**
accesorio a 2 series: antes de eso, quitan uno. Media sesión a dos series es
volumen repartido demasiado fino — cada ejercicio cuesta su montaje igual y a
cambio deja un estímulo que casi no cuenta.

Aplica a los dos mecanismos que reducen series, y no puede bloquearse: si va a
haber un tercero en el suelo es que hay ≥3 accesorios, y el suelo de sesión
(1 principal + 2 accesorios) permite quitar uno.

Medido sobre 4096 sesiones (toda la matriz × los cuatro presupuestos): las
sesiones con tres accesorios en el suelo pasan de **11 a 0**, y el resto de
indicadores queda **idéntico** — mismas sesiones cortas (244), mismos desbordes
de tiempo (1660), mismos grupos sobre techo (180).

**Tests**: el ejemplo del usuario — sentadilla 4×6 (t1), RDL 3×8 (t1), prensa
3×10 (t2), extensión 3×12 (t3), gemelo 3×15 (t3) — a un presupuesto corto debe
producir, en este orden: fuera el gemelo, extensión a 2, prensa a 2, sentadilla y
RDL intactas.

### 5.4 FASE 3 — Normalizador de volumen semanal 🟢 ✅ IMPLEMENTADA

> `src/utils/weeklyVolume.js`, enganchado en los dos caminos. `adaptArchetype` y
> `generateProgram` pasan a **dos pasadas**: primero se resuelven todas las
> sesiones, después se normaliza el ciclo entero, y sólo entonces se comprime
> por tiempo y se montan las plantillas.
>
> Medido sobre los combos que la UI puede producir de verdad (1392 sesiones):
> grupos por encima de su techo **62 → 34**, programas afectados **47 → 23**,
> peor exceso **14,8 → 5,8** series semanales de más.
>
> **Coste, y por qué se acepta:** las sesiones de <4 ejercicios pasan de 30 a 67
> sobre la matriz completa, y el umbral informativo del harness sube de 9% a
> 14%. El reparto justifica el cambio: las cortas a 3 días son **exactamente las
> mismas de antes** (15); todo el aumento está en 4-7 días. Un principiante que
> entrena 6 días sobre un ciclo de 3 sesiones las repite el doble de veces, así
> que cada una tiene que ser más corta — no es un defecto, es la respuesta.
>
> **Regla añadida sobre la spec:** un ejercicio sólo se elimina si **el grupo
> sigue cubierto por otro ejercicio de esa misma sesión**. Sin esa condición,
> recortar volumen semanal podía dejar un día entero sin nada de espalda: bajaba
> el número y empeoraba el entrenamiento. Es la misma doctrina que la escalera de
> compresión — se elimina redundancia, no estímulo único.
>
> **Decisión posterior del usuario — el principal baja a 3 series como último
> recurso.** La spec original decía "tier 1 nunca". Se mantiene para
> *eliminarlo* (§2.9, sigue siendo intocable), pero cuando los accesorios se
> agotan sí se le baja una serie, con suelo de 3. Razón: un principiante con 24
> series semanales de espalda las tiene aunque no las mire nadie, y bajar un
> básico de 4 a 3 series no le quita el carácter al programa — el ejercicio sigue
> ahí, con su progresión. Medido: grupos por encima de su techo **34 → 28**,
> programas afectados **23 → 19**.
>
> **Hallazgo, de la misma familia que el de los 30 minutos:** aun así quedan
> excesos irreducibles. Tres principales de espalda a 3 series (su suelo) por dos
> ciclos semanales son 18 series con un techo de 14. Se declara en `overBudget`.
>
> `glutes_hypertrophy_intermediate` ya declara
> `volumeEmphasis: ['glutes_hamstrings']` — es la primera plantilla que usa el
> campo, y sus 21 series sobreviven al techo de 20.

`src/utils/weeklyVolume.js` (nuevo, puro):

```js
export const VOLUME_BANDS = {
  beginner:     { min: 8,  max: 12, hard: 14 },
  intermediate: { min: 12, max: 18, hard: 20 },
  advanced:     { min: 14, max: 22, hard: 26 },
};

/** Grupos sujetos a recorte. `core`, `grip` y `legs_lower` quedan fuera a
 *  propósito: sus series son baratas y su banda no es comparable a la de un
 *  motor primario. Sin esta lista, tres planchas disparan el recorte. */
export const CLAMPED_GROUPS = ['back', 'chest', 'shoulders', 'quads', 'glutes_hamstrings', 'arms'];

/** Grupos cuyo techo DIRECTO es más bajo porque el contador no ve todo lo que
 *  hacen: el hombro se lleva parte de cada press, el tríceps lo mismo, el
 *  bíceps de cada tracción. Y el hombro es además la articulación que sostiene
 *  el resto del entrenamiento. */
export const GROUP_CEILING_FACTOR = { shoulders: 0.7, arms: 0.7 };

/** Un grupo con énfasis declarado por la plantilla sube su techo. Sin esto, la
 *  plantilla de glúteo (21 sets/ciclo, deliberados) se recorta a 20 y deja de
 *  ser una plantilla de glúteo. */
export const EMPHASIS_BONUS = 6;

export function weeklySetsByGroup(sessions, daysPerWeek, allExercises)
export function normalizeWeeklyVolume(sessions, { daysPerWeek, level, discipline, volumeEmphasis, allExercises })
```

**Cálculo:**

```
multiplicador = daysPerWeek / sessions.length
semanal[g]    = Σ sets de los ejercicios con primaryGroup === g en todo el ciclo × multiplicador
techo[g]      = BANDS[level].hard × DISCIPLINE_RULES[discipline].volumeBandScale
                + (volumeEmphasis.includes(g) ? EMPHASIS_BONUS : 0)
```

El `primaryGroup` se lee de la biblioteca, no del `exConfig` — el `exConfig` no
lo lleva, y ese fue exactamente el bug de `reduceForBeginner` corregido en
`746840c`.

**Recorte**, hasta que ningún grupo pase su techo:

1. Elegir el grupo con **mayor exceso**.
2. Dentro de ese grupo, el **tier más alto disponible** (3 antes que 2; tier 1
   nunca) de la sesión que más aporte al grupo.
3. −1 serie. Suelo 2 series; por debajo, el ejercicio se elimina entero.
4. Al eliminar, respetar el suelo de 1 tier 1 + 2 accesorios por sesión.
5. Si no queda nada recortable, **parar** y devolver `overBudget: [grupos]`. Un
   exceso irreducible significa que los tier 1 solos ya pasan el techo, y los
   tier 1 no se tocan (§2.9).

**Se enchufa** en `adaptArchetype` y en `generateProgram` en el paso 4 de §4.
`reduceForBeginner` se mantiene: opera sobre otra cosa (densidad por sesión) y no
se pisan.

**Tests**:
- FB beginner + 6 días ⇒ ningún grupo de `CLAMPED_GROUPS` por encima de 14.
- Mismo caso ⇒ ningún ejercicio tier 1 cambia de series.
- FB intermedio + 3 días ⇒ **sin cambios**: no debe tocar lo que no sobra.
- Glúteo intermedio con `volumeEmphasis: ['glutes_hamstrings']` + 3 días ⇒ **sus
  21 sets sobreviven** (techo 26). Sin el emphasis, se recortan a 20.
- Exceso irreducible (bodyweight + limitaciones) ⇒ `overBudget` no vacío, sin
  bucle infinito.

### 5.5 FASE 3b — Vincular lo que se repite en el ciclo ✅ IMPLEMENTADA

> `autoLinkRepeated` en [exerciseLinks.js](../../../src/utils/exerciseLinks.js),
> llamado por los dos caminos justo antes de montar el programa — después de
> volumen y de tiempo, como pedía la spec.
>
> **Bug encontrado y arreglado por el camino, en el store.**
> `duplicateStageInProgram` remapea los `linkGroup` al clonar una etapa, con este
> comentario: *"las copias siguen vinculadas entre sí pero nunca a la etapa
> original"*. **`addStageToProgram` no lo hacía** — y es el que materializa las
> fases (§6.2) y el que usa el planificador. Con grupos creados a mano, editar un
> ejercicio de la fase 2 editaba el de la fase 1: exactamente lo que las fases
> existen para separar. Nadie lo había visto porque hasta ahora nada creaba
> grupos automáticamente y hay que tener etapas *y* vínculos a la vez.
>
> Arreglado en los dos sitios que clonan con `applyRx` (`addStageToProgram` y el
> constructor de escaleras), con un mapa de grupos **por etapa**. Hay test de
> regresión en `programPhases.test.js`: falla si se revierte.
>
> La pregunta abierta se resolvió como estaba propuesto: si la compresión deja
> dos instancias con distintas series, **se quedan sueltas**. No se igualan a la
> baja — sería inventar programación que la plantilla no escribió.

### 5.5.1 El diseño

Las plantillas **repiten a propósito el mismo ejercicio en varias sesiones del
ciclo** (§11.4: la progresión doble necesita exposición repetida al mismo
movimiento). Pero cada instancia es hoy independiente: dos sentadillas del mismo
ciclo progresan por separado, cada una leyendo sólo su propio historial. Con
frecuencia 2 eso es la mitad de la información para decidir el peso de mañana.

La maquinaria existe y es manual: `exConfig.linkGroup`
([exerciseLinks.js](../../../src/utils/exerciseLinks.js)). Dos instancias con el
mismo `exerciseId` y el mismo `linkGroup` **comparten configuración e
historial** — la progresión lee la última ejecución del grupo, venga de la
sesión que venga. El editor deja vincularlas a mano; el adaptador no las vincula
nunca.

**Regla:** al terminar de montar el ciclo, agrupar las instancias del mismo
`exerciseId` **cuyo `pickLinkedConfig` coincida** — mismos `isKey`, series,
reps, descanso y progresión. Si difieren, se quedan sueltas.

La condición no es un adorno: es la que ya declara `LINKED_CONFIG_KEYS`
(«`isKey` viaja con el grupo […] si una sentadilla es la principal de un día y
accesoria de otro, su programación ya difiere y no deberían estar en el mismo
grupo»). O sea, **la excepción de "objetivos diferentes" se detecta sola** — no
hace falta declararla en la plantilla. Y aplica igual a tier 1 y a accesorios:
lo que decide es si la programación es la misma, no la importancia.

Coste: una pasada sobre el ciclo ya construido, después del normalizador de
volumen (§5.4) y **después** de la compresión (§5.3) — comprimir puede dejar dos
instancias con distintas series, y entonces ya no deben vincularse. Va en el
mismo paso que la validación (§4, paso 6).

Sin decidir, no bloqueante: si dos instancias difieren **sólo** en series por
efecto del recorte, ¿se igualan a la baja para poder vincularlas, o se dejan
sueltas? Por defecto, sueltas — no inventar programación que la plantilla no
escribió.

### 5.6 La tabla por disciplina

`DISCIPLINE_RULES`, en `weeklyVolume.js` o junto a la escalera — **un sitio, no
tres motores**:

```js
export const DISCIPLINE_RULES = {
  // Hipertrofia: el volumen semanal es el estímulo. Antes de borrar un
  // ejercicio, se le quitan series a todo lo que se pueda.
  standard:     { compression: ['t3Redundant', 't3Sets', 't3Remove', 't2Sets', 't2Remove', 't1Sets'], volumeBandScale: 1.0 },
  glutes_legs:  { compression: ['t3Redundant', 't3Sets', 't3Remove', 't2Sets', 't2Remove', 't1Sets'], volumeBandScale: 1.0 },

  // Fuerza: la especificidad manda. Los accesorios se van enteros antes de
  // tocar una sola serie de los levantamientos, y `t1Sets` no está en la lista:
  // las series de los básicos no se recortan por tiempo.
  strength:     { compression: ['t3Redundant', 't3Remove', 't2Remove', 't3Sets', 't2Sets'],           volumeBandScale: 0.8 },

  // Calistenia: la skill es tier 1 y por tanto intocable. Con 30 minutos, el
  // muscle-up sigue estando; lo que desaparece es el trabajo complementario.
  calisthenics: { compression: ['t3Redundant', 't3Sets', 't3Remove', 't2Sets', 't2Remove'],           volumeBandScale: 0.9 },
};
```

Un motor, cuatro filas. Ninguna de las tres "prioridades por disciplina" del
análisis necesita código propio: son permutaciones de la misma escalera y un
factor sobre la banda.

---

## 6. FASE 4 — Plantillas con fases y duración concreta 🟢 ✅ IMPLEMENTADA

> Barata, como se esperaba: la maquinaria estaba entera. `adaptArchetype` escribe
> la etapa base con el nombre y la duración de la primera fase y devuelve
> `phases`; `generateAndActivateProgram` recorre las demás llamando a
> `addStageToProgram({ rx, name, durationWeeks, sourceStageIdx: 0 })`. Cero
> lógica de derivación nueva.
>
> **Las 8 plantillas del catálogo ya declaran fases** (`DEFAULT_PHASES` en
> `archetypes.js`, un esquema por objetivo — ver §6.3). Un programa de
> onboarding pasa de ser infinito a durar 8 o 9 semanas.
>
> El preview lo enseña en portada: *"8 semanas · 3 fases · 3 sesiones por
> ciclo"*. Si alguna etapa quedara sin límite, no se pinta total — no lo hay.
>
> **Invariante del harness relajado.** `programGenerator.test.js` exigía
> `stages[0].durationWeeks === null`. Ahora acepta `null` (plantilla sin fases y
> camino procedural) **o un entero positivo**; lo que sigue siendo violación es
> `0`, negativo o `undefined`, que romperían `advanceCycle`. Los valores exactos
> los fija `mobile/store/programPhases.test.js`, que prueba el camino real —
> etapas, duraciones, cadena `derivedFrom` y el contenido de cada `rx`.
>
> **Efecto secundario que importa:** hasta ahora un programa de onboarding nunca
> disparaba el banner de fin de etapa ni la propuesta de
> [stage-proposal.md](stage-proposal.md), porque `durationWeeks: null` no tiene
> umbral que alcanzar. Ahora sí.

Barata: la maquinaria existe entera (§1.6). Falta que la plantilla la declare y
que el onboarding la invoque.

### 6.1 El campo

```js
phases: [
  { name: 'Acumulación',     durationWeeks: 4, rx: null },
  { name: 'Intensificación', durationWeeks: 3, rx: { scope: 'keys', repsShift: -3, restPct: 25 } },
  { name: 'Descarga',        durationWeeks: 1, rx: { setsDelta: -1, progressionHold: 'deload' } },
]
```

- **Opcional.** Sin `phases`, una etapa con `durationWeeks: null` — exactamente
  el comportamiento de hoy. Ninguna plantilla actual cambia hasta que se le
  escriba el campo.
- El vocabulario de `rx` es el de [stageRx.js](../../../src/utils/stageRx.js) y
  no admite nada más: `scope`, `setsDelta`, `repsShift`, `restPct`,
  `incrementScale`, `progressionHold`. Si una fase necesita cambiar ejercicios,
  no es una fase: es otra plantilla.
- `phases[0].rx` debe ser `null` — la primera fase **es** la base.
- `scope: 'keys'` sigue significando `isKey`, o sea tier 1 (§3.3).
- Los nombres van en castellano en el dato, igual que `archetype.name`. Deuda de
  i18n preexistente del catálogo; no se arregla aquí.

### 6.2 Materialización

`adaptArchetype` escribe la etapa 0 con
`durationWeeks: archetype.phases?.[0].durationWeeks ?? null` y devuelve `phases`.

`generateAndActivateProgram` ([mobile/store/useStore.js:311](../../store/useStore.js)),
después del `set()` que guarda el programa:

```js
for (const phase of (phases ?? []).slice(1)) {
  get().addStageToProgram(program.id, {
    rx: phase.rx,
    name: phase.name,
    durationWeeks: phase.durationWeeks,
    sourceStageIdx: 0,          // deltas absolutos contra la base (§2.10)
  });
}
```

Cero lógica de derivación nueva: `addStageToProgram` ya clona, aplica `rx`, acuña
`tpl_*` y escribe `derivedFrom`.

**Sólo el store móvil.** `src/store/useStore.js` es la versión web (su
`addStageToProgram` ni siquiera acepta `rx`) y queda fuera de alcance.

**Tests**: `mobile/store/programPhases.test.js` — 3 fases ⇒ 3 etapas con sus
`durationWeeks`, los templates de cada etapa son `applyRx` de la BASE y llevan
`derivedFrom`, sin `phases` ⇒ 1 etapa con `durationWeeks: null`, y el camino
procedural no inventa fases.

### 6.3 El esquema por defecto — a revisar con criterio de dominio

`DEFAULT_PHASES` en `archetypes.js`. Es el punto de partida razonable de cada
objetivo, **no una decisión cerrada**: una plantilla puede declarar las suyas, y
estas están puestas para que el catálogo entero tenga duración desde el primer
día.

| Objetivo | Fases | Total |
|---|---|---|
| `hypertrophy` | Acumulación 4 · Intensificación 3 (`keys`, −3 reps, +25% descanso) · Descarga 1 | **8 semanas** |
| `strength` | Acumulación 4 · Intensificación 4 (`keys`, −2 reps, +25% descanso) · Descarga 1 | **9 semanas** |
| `endurance` | Acumulación 4 · Volumen 3 (`accessories`, +1 serie) · Descarga 1 | **8 semanas** |

Las tres decisiones que hay detrás, por si se quieren mover:

- **Fuerza desplaza menos las repeticiones** (−2, no −3): un programa de fuerza
  ya vive en rangos cortos, y −3 sobre un 5×5 lo dejaría en dobles.
- **Calistenia sube volumen en vez de intensidad**: la progresión va por
  repeticiones y dificultad del movimiento, no por acortar el rango.
- **Todas terminan en descarga de una semana**, con `progressionHold: 'deload'`
  para que el chip de progresión cambie de mensaje en vez de desaparecer
  ([stage-planner.md](stage-planner.md) §2.5).

---

## 7. FASE 5 — Matcher por ranking 🟢 ✅ IMPLEMENTADA

> `rankArchetypes` en [archetypes.js](../../../src/data/archetypes.js), con los
> pesos de §7.1 tal cual. El campo `daysPerWeek` del arquetipo **se ha
> eliminado**: era la duplicación que causaba el bug original (se calcula de
> `days.length`). `findBestArchetype` queda como envoltorio deprecado para el
> store web, que está fuera de alcance.
>
> **528/528 combos de la matriz reciben ahora una plantilla** (antes 60), y
> **ninguna sesión queda sin ejercicio clave**. El generador procedural deja de
> ser autor.
>
> ⚠️ **Y esto destapa el agujero del catálogo, que hay que leer entero.** Los
> grupos por encima de su techo semanal suben de 28 a **102**, y están
> concentrados donde el mapa (§11.1) ya decía que faltaba contenido:
>
> | días/semana | grupos sobre techo | de ellos, declarados en `overBudget` |
> |---|---|---|
> | 3 | 2 | 2 |
> | 4 | 14 | 6 |
> | 5 | 18 | 15 |
> | 6 | 28 | 16 |
> | 7 | 40 | 34 |
>
> ✅ **CERRADO** con `ppl_hypertrophy_intermediate` (§11.2). Un intermedio de
> 5, 6 o 7 días recibe ahora el PPL con velocidad de ciclo ~1 y **cero excesos**
> de volumen; los grupos sobre techo de toda la matriz bajan de 199 a 184. Lo que
> sigue debajo es el diagnóstico original, que explica por qué la fase 8 pasó a
> ser la urgente.
>
> La causa no era el ranking: **no existía ninguna plantilla de 5-7 días**, así
> que a esos usuarios les tocaba un ciclo de 3 sesiones rodando a 2,33 vueltas
> por semana, y los suelos impiden recortar tanto volumen. Antes iban al
> procedural, que montaba 6 sesiones con el volumen correcto pero sin curar.
>
> Es un intercambio real y hay que nombrarlo: **hemos cambiado volumen correcto
> sin curar por estructura curada con demasiado volumen**, para 5-7 días. Lo
> cierra la fase 8, y por eso PPL-6 es la prioridad 2 del catálogo: no es "una
> plantilla más", es la que arregla esta tabla.
>
> **Dos invariantes del harness reescritos**, los dos porque medían el
> comportamiento viejo:
>
> - *"nº de sesiones === días pedidos"* → ahora **lo fija la plantilla** (§2.2).
>   Sólo el camino procedural lo deriva de los días.
> - El indicador de sesiones cortas pasa a medirse **por sesión** (6,0%) y no por
>   combo: con el ranking la matriz produce 1627 sesiones en vez de 2016, así que
>   el porcentaje por combo dejó de ser comparable consigo mismo.

Reemplaza `findBestArchetype`. **Nunca devuelve vacío.**

### 7.1 `rankArchetypes(answers, allExercises)` en `src/data/archetypes.js`

```js
[{ archetype, score, sessionsPerCycle, cycleSpeed, adaptationCost, notes: [...] }, …]
```

| Criterio | Peso |
|---|---|
| `discipline` coincide | +40 |
| `goal` coincide | +15 |
| nivel exacto | +20 · adyacente +8 · a dos +0 |
| **frecuencia semanal por grupo** (media de `min(freq, 2) / 2` sobre los grupos con tier 1) | hasta +15 |
| **velocidad de ciclo**: `−20 × abs(cycleSpeed − 1)` | — |
| `cycleSpeed < MIN_CYCLE_SPEED[discipline]` (0,9 fuerza · 0,6 resto) | −60 |
| principiante con `sessionsPerCycle > 3` (§2.6) | −100 |
| `adaptationCost`: nº de ejercicios sin equipo del usuario | −3 cada uno |

```
cycleSpeed = daysPerWeek / sessionsPerCycle      // ciclos por semana
```

**Por qué un término de frecuencia** (añadido después de la fase 5, a raíz de la
revisión de niveles): sin él, a 3 días una full body y un PPL puntúan
**idéntico** —misma identidad, mismo nivel, misma velocidad de ciclo— y ganaba
el que estuviera antes en el array. Y son muy distintos: la full body toca cada
grupo 3 veces por semana y el PPL, 1. Es la regla de diseño del catálogo
(§11.4, "frecuencia ≥2 sobre el mismo movimiento") convertida en puntuación.

Sólo cuentan los tier 1 —dos series de un aislamiento no son una exposición al
patrón— y se satura en 2: pasar de 2 a 3 no puntúa más, porque a partir de ahí
lo que manda es el volumen. Comprobado con un PPL de 3 ficticio: 87,0 para la
full body frente a 82,5, y el PPL se lleva la nota `lowFrequency`.

**Por qué `cycleSpeed` y no una tabla de "sesiones ideales por días":** es la
magnitud real del modelo rotativo, sale de dos números que ya existen, y una sola
resta ordena bien todos los casos:

| Usuario | FB-2 | FB-3 | U/L-4 | PPL-6 | Gana |
|---|---|---|---|---|---|
| 2 días | **0** | −6,6 | −10 | −20 | FB-2 |
| 3 días | −10 | **0** | −5 | −20 | FB-3 / PPL-3 |
| 4 días | −20 | −6,6 | **0** | −13,4 | U/L-4 |
| 5 días | −30 | −13,4 | −5 | **−3,4** | PPL-6 |
| 6 días | −40 | −20 | −10 | **0** | PPL-6 |

El penalizador duro de fuerza (`MIN_CYCLE_SPEED: 0,9`) es el residuo bueno del
"menos días" del análisis: un ciclo de 4 sesiones a 2 días/semana deja la
sentadilla en 0,5 exposiciones semanales, y eso rompe la práctica del patrón.
Con el ranking, ese usuario recibe una plantilla de fuerza de 2-3 sesiones o, si
no existe, otra identidad — pero no un programa de fuerza que no puede practicar.

`adaptationCost` se calcula con el mismo `hasEquipment` del adaptador. Alimenta
el aviso honesto de la tarjeta (§7.4). `notes` son etiquetas para la UI, no
lógica: `needsBarbell`, `rotates` (`cycleSpeed > 1,25`), `levelStretch`,
`slowCycle`.

### 7.2 Retirada del procedural

`generateProgram` deja de ser alternativa: el ranking siempre da un ganador.
Queda como utilidad interna para huecos que el resolvedor no cubra. **No se borra
el archivo**, y su harness de invariantes pasa a correr sobre el camino
arquetipo → adaptador.

Con esto desaparece el "hallazgo pendiente" de
[program-generator.md](program-generator.md) §6.1: el ranking penaliza por nivel
y por `adaptationCost` la combinación que el tier-3 aceptaba por coincidencia
estructural.

**Tests**: el ranking nunca devuelve `[]` en la matriz completa; ningún
principiante recibe de primera una plantilla de >3 sesiones; con `equipment: []`
gana la de menor `adaptationCost` de su identidad; determinista.

---

## 8. FASE 6 — Onboarding de propuestas 🔴

⚠️ **`OnboardingScreen` no está migrada a FormaFit.** Esta fase la rehace, así
que es el momento de migrarla. **Leer [UI-MIGRATION.md](../UI-MIGRATION.md)
antes de tocarla.**

### 8.1 Forma del flujo

```
4 preguntas          →  PANTALLA DE PROPUESTAS  →  2 preguntas    →  preview
nivel                    2-3 candidatos             tiempo/sesión     con fases
qué buscas (identidad)   + "ver todas"              limitaciones
días/semana
material
```

**Antes de la lista van las respuestas que eligen qué plantilla; después, las que
sólo modifican la elegida.**

| Respuesta | Función | Dónde |
|---|---|---|
| nivel | elige + ajusta volumen | antes |
| identidad | elige | antes |
| días/semana | elige (`cycleSpeed`) | antes |
| material | ordena + resuelve slots | antes |
| tiempo/sesión | comprime | después |
| limitaciones | resuelve slots | después |
| distribución | **se elimina** (§2.4) | — |

### 8.2 Pregunta de identidad

| Tarjeta | `discipline` | `goal` |
|---|---|---|
| Ganar músculo | `standard` | `hypertrophy` |
| Ponerte fuerte | `strength` | `strength` |
| Glúteo y pierna | `glutes_legs` | `hypertrophy` |
| Calistenia | `calisthenics` | `endurance` |

`max_strength` deja de ser opción del onboarding: lo trae la plantilla si lo usa.
`answers.goal` sigue alimentando la regla A4 del adaptador y el comparador del
resolvedor (§5.2).

`answers.distribution` se conserva en el `onboardingSnapshot`, rellenado con la
`distribution` de la plantilla elegida — el snapshot se usa para regenerar y no
debe perder forma. El paso de `progressionModel` (sólo avanzados) se mantiene,
**después** de la elección.

### 8.3 La pantalla de propuestas

Tres candidatos (`rankArchetypes(...).slice(0, 3)`) + acceso a la lista completa.
Cada tarjeta:

- Nombre del programa.
- **`N semanas · M fases · S sesiones por ciclo`** — la duración va en portada.
- El `summary` de la plantilla.
- Aviso honesto según `notes`:
  - `needsBarbell` → *"Diseñado con barra. Sin ella sustituimos N ejercicios."*
  - `rotates` → *"3 sesiones que rotan en ciclo: entrenas 4 días, verás cada
    sesión más de una vez."*
  - ninguno → *"Encaja con tu material."*
- Badge **Recomendado** en la primera.

"Ver todas" abre la lista completa, ordenada, con el motivo escrito en las que
quedan al fondo (*"Pensada para 6 días"*, *"Requiere nivel avanzado"*). **Nada se
oculta y nada se bloquea** (§2.3).

Tocar una tarjeta abre el detalle: fases con su duración y su carácter, y
sesiones expandibles. Botón **Elegir este programa**.

### 8.4 Preview final

El preview actual gana, todo desde el resultado enriquecido de §5.1:

- Las **fases** como agrupación, con `durationWeeks` y el total en semanas.
- Las **sustituciones aplicadas**: *"Press banca barra → Press banca mancuerna"*.
  Hoy pasan en silencio.
- `unresolved`, `overBudget` y `overTime` si los hay — con lenguaje llano
  (*"Tu sesión dura ~52 min, cinco más de los que pediste"*).
- **"Ver otro programa"**, que vuelve a la lista **sin perder las respuestas**.

Se conserva: duración estimada por sesión (`sessionStats`, código mobile) y el
hint de ciclo de B4.

---

## 9. FASE 7 — Reglas de integridad 🟢

**Validador, no pipeline** (§2.11). Las reglas se comprueban sobre el resultado,
en el harness que ya existe (`src/utils/programGenerator.test.js`, que ya recorre
matrices de respuestas y afirma invariantes).

| Regla | Estado |
|---|---|
| Ningún ejercicio que el material no permita | ✅ invariante existente (A7) |
| No pasarse del tiempo disponible | ✅ escalera de compresión + `overTime` |
| No superar el volumen por grupo | ✅ normalizador + `overBudget` |
| No aumentar volumen sólo por tener más días | ✅ normalizador |
| No encadenar alta fatiga | ✅ lo declara el orden de la plantilla |
| **Ningún patrón fundamental sin cubrir en el ciclo** | ❌ invariante nuevo |
| **Ningún tier 1 en `unresolved` si existe alternativa** | ❌ invariante nuevo |
| **Ninguna skill/patrón clave por debajo de su frecuencia mínima** | ❌ invariante nuevo (`cycleSpeed`) |

Los tres nuevos, más los **casos con nombre propio** de la tabla del usuario, que
son la mejor especificación de tests que produjo el análisis:

| Caso | Qué debe pasar |
|---|---|
| 4×60 sobre plantilla de 4×60 | programa íntegro, sin recortes |
| 4×40 | frecuencia y tier 1 intactos; caen accesorios y series de accesorios |
| 3×60 | mismas 4 sesiones, ciclo más lento; volumen semanal baja solo, sin recortes |
| 3×40 | recorte por tiempo **y** el ciclo más lento; tier 1 intacto |
| 2×60 | el ranking entrega una plantilla de 2 sesiones, no la de 4 comprimida |
| 5×60 | el ranking entrega la de 6 sesiones; el volumen NO se duplica |

La excepción aceptable, ya documentada en el harness: una violación vale si un
barrido de la biblioteca con esos filtros demuestra que no había candidato — no
si el adaptador descartó un hueco pudiendo llenarlo.

---

## 10. Qué NO tocar

- Motor de progresión ([progression.js](../../../src/utils/progression.js)).
- Formato de `program` / `sessionTemplates` en el store (los editores dependen).
- El flujo de importación / conexión con entrenador del `OnboardingScreen`.
- `onboardingSnapshot`: puede ganar campos, no perderlos.
- `applyRx` y el planificador de etapas: esta spec **los usa**, no los modifica.
- `isKey` en el `exConfig`: sigue siendo booleano (§3.3).
- `src/store/useStore.js` (web) y `src/components/**` (UI web).

---

## 11. FASE 8 — Catálogo de plantillas 🔴

La parte cara y **no delegable**: diseño de programas reales. Sesión conjunta
modelo + usuario, una plantilla cada vez, como las cuatro de
[program-generator.md](program-generator.md) §6.1.

### 11.1 Mapa de cobertura

```
                          SESIONES DEL CICLO
                 2          3            4            6
              ┌──────────┬────────────┬────────────┬────────────┐
 GANAR        │    ❌    │ FB  ✅✅✅ │ U/L  ✅✅  │  PPL   ✅  │
 MÚSCULO      │  FB-2    │ (PPL-3     │            │   int      │
              │  beg/int │  descartado)│  int/adv   │            │
              ├──────────┼────────────┼────────────┼────────────┤
 PONERTE      │    —     │ FB    ✅   │    ❌      │    —       │
 FUERTE       │          │ solo adv   │  U/L fza   │            │
              │          │ falta int  │   int      │            │
              ├──────────┼────────────┼────────────┼────────────┤
 GLÚTEO       │    ❌    │ FB    ✅   │    ❌      │    —       │
 Y PIERNA     │  (opc.)  │   int      │  U/L glút  │            │
              ├──────────┼────────────┼────────────┼────────────┤
 CALISTENIA   │    —     │ FB    ✅   │    ❌      │    ❌      │
              │          │   int      │  U/L cal   │  PPL cal   │
              └──────────┴────────────┴────────────┴────────────┘
   ✅ existe   ❌ falta   — no tiene sentido / no prioritario
```

Dos reglas reducen el mapa a la mitad:

- **El principiante no pasa de 3 sesiones** (§2.6) ⇒ las columnas de 4 y 6 no
  necesitan variante beginner.
- **El nivel no multiplica las celdas.** Una celda necesita **una** plantilla
  intermedia. La variante "avanzado" sólo existe donde el contenido cambia de
  verdad (barra libre), y la "beginner" sólo en 2 y 3 sesiones. El resto lo
  resuelven el resolvedor de slots y el normalizador.

### 11.2 Prioridad

| # | Plantilla | Por qué |
|---|---|---|
| # | Plantilla | Estado |
|---|---|---|
| 1 | **PPL · 6 sesiones · intermedio** (`ppl6_hypertrophy_intermediate`) | ✅ **ESCRITA**. Cierra el tramo de 5-7 días |
| 2 | **PPL · 3 sesiones · intermedio** (`ppl3_hypertrophy_intermediate`) | ✅ **ESCRITA**. Ver la nota de abajo |
| 3 | **Full Body · 2 sesiones · intermedio** (`fullbody2_hypertrophy_intermediate`) | ✅ **ESCRITA**. Cubre 1-2 días |
| 4 | **Fuerza · 3 sesiones · intermedio** | Sólo existe la avanzada (5×5 con barra) |

**Sobre la Full Body de 2 sesiones.** Con sólo dos sesiones, la restricción que
manda no es el volumen: es que **cada grupo tiene que aparecer en las dos** o se
queda a frecuencia 1. Por eso ancla las dos compuestas de pierna —el tren
inferior es el que más gana con la exposición repetida y sólo tiene dos patrones
que cubrir— y reparte el tren superior: A los horizontales, B los verticales.
Los seis grupos salen a frecuencia 2 sin repetir la sesión.

⚠️ **Es una plantilla de 90 minutos, y eso destapa otra vez el problema de la
sobrecarga fija** (§5.3.1). Con seis ejercicios, **26 de los 60 minutos del
presupuesto se van en sobrecarga** — 18 de transiciones (3 min × 6) más 8 de
calentamiento. Quedan 34 para trabajar, y seis ejercicios no caben ahí: la
sesión íntegra son 70 min, a 60 se comprime hasta ~60 y declara `overTime` por
segundos. Ninguna combinación de series lo arregla, porque lo que no cabe es la
sobrecarga.

Ahora muerde el presupuesto **por defecto** del onboarding, no sólo el de 30. Si
`EXERCISE_OVERHEAD_SEC = 180` es demasiado para una sesión encadenada, esta es la
plantilla que lo demuestra.

**Sobre el PPL de 3 sesiones — decisión del usuario, revirtiendo un descarte
mío.** Toca cada grupo una vez por semana, así que incumple la regla de
frecuencia ≥2 (§11.4) y entrega menos volumen semanal que una full body a los
mismos 3 días (pecho 10 frente a 14, espalda 11 frente a 17). Yo la había
descartado por eso; es un error de criterio: **es una opción legítima** para
quien prefiere entrenar por grupos, acumula menos fatiga separándolos o
simplemente lo prefiere así.

Y el sistema no necesita que se excluya para hacer lo correcto: a 3 días el
ranking pone la full body primera (87,0) y el PPL-3 segundo (82,5) **con la nota
`lowFrequency`**. Ordenar, no excluir — la misma doctrina que con el material.

Sus diferencias con la de frecuencia 2 son de diseño, no de escala: seis
ejercicios por sesión en vez de cinco, dos movimientos por grupo grande dentro
del mismo día (la variedad de ángulos vive en la sesión, no entre mitades) y
**cero anclas**, porque cada sesión aparece una sola vez en el ciclo y no hay
nada que vincular. Esa es la contrapartida real de esta distribución.
| 5 | U/L fuerza 4 · U/L glúteo 4 · U/L o PPL calistenia | Celdas de 4 sesiones de las identidades no estándar |

**Hueco de biblioteca, no de plantilla** (detectado al implementar la fase 1):
de los 43 ejercicios sin material, **ninguno es de tracción** — un usuario de
peso corporal se queda literalmente sin espalda, y los 39 slots tier 1 que el
resolvedor no puede llenar son todos suyos. Hace falta contenido: remo
invertido (bajo una mesa o con anillas), remo con toalla en puerta, remo
australiano. Va con esta fase porque es la misma sesión de criterio.

Con 1-4 el mapa deja de tener agujeros que el usuario pueda notar. Son **cuatro
plantillas**, no ocho.

### 11.3 Derivación de la variante de 6 sesiones

Un PPL de 6 no es el de 3 repetido: es A/B, con variantes distintas en el segundo
paso y el volumen repartido. Las dos cosas que cambian son las dos que el sistema
ya sabe hacer, así que se declaran como dato:

```js
{
  id: 'ppl_hypertrophy_intermediate_6',
  derivedFrom: 'ppl_hypertrophy_intermediate',
  bHalf: {
    // sólo se nombra lo que cambia; el resto se hereda de la mitad A
    swap: { bench_press_db: 'incline_press_db', pulldown_pronated: 'cable_row' },
    rx:   { scope: 'accessories', setsDelta: -1 },
  },
}
```

- El `swap` es corto porque los 182 ejercicios llevan `relatedVariants`: los
  candidatos ya están escritos.
- El `rx` es el vocabulario de `applyRx`. `expandArchetype` monta las 6 sesiones
  antes de que el adaptador las vea.
- El volumen del conjunto lo revisa el normalizador, así que el A/B no puede
  colarse fuera de banda por descuido.

### 11.4 Decisiones de diseño heredadas (vigentes)

De [program-generator.md](program-generator.md) §6.1, verificadas plantilla a
plantilla:

- **Repetir el mismo ejercicio clave entre sesiones** (frecuencia ≥2): la
  progresión doble necesita exposición repetida al mismo movimiento.
- **El nivel del arquetipo debe coincidir con el nivel real de sus keys.** Uno de
  nivel inferior puede colarse a propósito; uno superior lo sustituye `fitsLevel`
  en silencio.
- **Contenido de barra libre ⇒ arquetipo `advanced` nuevo**, nunca modificar uno
  de nivel inferior.
- **Verificar con `sessionMinutes` 90 y 60**, y ahora también con `daysPerWeek` en
  los dos extremos de su rango (recorte de volumen activo e inactivo).
- **Marcar los tier 2 a mano.** El defecto (`key`→1, `accessory`→3) es correcto
  para la mayoría; el segundo estímulo de un patrón es tier 2 y sólo lo sabe
  quien escribe la plantilla.

---

## 12. Fases

| # | Alcance | Coste | Depende de | Modelo |
|---|---|---|---|---|
| 1 | Resolvedor de slots (§5.2) | 🟢 | — | ✅ **IMPLEMENTADA** — 1917 tests verdes, sesiones cortas 56 → 40 |
| 2 | Escalera de compresión + `DISCIPLINE_RULES` (§5.3, §5.6) | 🟢 | tiers (§3.1) | ✅ **IMPLEMENTADA** — desbordes a 60 min 236 → 119, mismo nº de ejercicios |
| 2b | Sesiones cortas: presupuesto sin calentamiento + superserie de opuestos (§5.3.1) | 🟢 | 2 | ✅ **IMPLEMENTADA** — desbordes a 45 min 410 → 144 |
| 3 | Normalizador de volumen + `volumeEmphasis` (§5.4) | 🟢 | 2 (comparten tabla) | ✅ **IMPLEMENTADA** — grupos sobre el techo 62 → 34, peor exceso 14,8 → 5,8 |
| 3b | Vincular lo repetido en el ciclo (§5.5) | 🟢 | 2, 3 | Sonnet |
| 4 | `phases` → N etapas (§6) | 🟢 | — | Sonnet |
| 5 | `rankArchetypes` + retirada del procedural (§7) | 🟢 | — | Sonnet |
| 6 | Onboarding de propuestas + migración FormaFit (§8) | 🔴 | 4, 5 | Opus/Sonnet — leer UI-MIGRATION.md |
| 7 | Reglas de integridad en el harness (§9) | 🟢 | 1-5 | Sonnet |
| 8 | Catálogo: 4 plantillas prioritarias + tracción sin material (§11) | 🔴 | 1-3 | **Modelo + usuario**, no delegable |

Las fases 1-5 aportan valor por separado y no dependen de la UI: con ellas
hechas, el onboarding actual ya entrega programas con fases, volumen sano,
sustituciones bien elegidas y salidos siempre de una plantilla.

La 8 se puede intercalar en cualquier punto después de la 3 — el normalizador es
lo que valida que una plantilla nueva aguanta a distintas frecuencias.

## 13. i18n

Cadenas nuevas por `t()` en `src/locales/es.json` **y** `en.json` (raíz del
repo):

- `onboarding.identity.*` — las 4 tarjetas de la pregunta fusionada.
- `onboarding.proposals.*` — título, badge "Recomendado", avisos
  (`needsBarbell`, `rotates`, `fitsEquipment`), "ver todas", motivos de descarte.
- `onboarding.preview.phases.*` — cabecera de fase y total en semanas.
- `onboarding.preview.substitutions.*` · `.overTime` · `.overBudget` ·
  `.unresolved`.

Los nombres de plantillas, fases y `summary` viven en el dato, en castellano
(deuda preexistente del catálogo, §6.1).

## 14. Verificación

- `npx vitest run` desde la raíz, verde.
- `npx eslint <ficheros tocados>` comparado contra HEAD: sólo cuentan violaciones
  **nuevas**.
- Para reproducir el barrido completo fuera de vitest: `npx vite-node` con un
  script que importe `rankArchetypes`, `adaptArchetype`, `resolveSlot` y
  `normalizeWeeklyVolume` y recorra la matriz (los imports del repo no llevan
  extensión; node pelado no los resuelve).
