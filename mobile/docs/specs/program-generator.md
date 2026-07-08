# Spec — Generador automático de programas (onboarding)

> Estado: **diagnóstico cerrado (Fable, jul 2026). Fases A y B implementadas y
> fusionadas** (`606ccdf` fase A, `eff1666` fase B — ver §4 y §5, marcadas al
> final de cada una). **Fase C EN PAUSA** (jul 2026, a petición del usuario:
> "es muy extenso y no termino de tenerlo claro") — 4 de ~10-12 arquetipos
> escritos y verificados (ver §6.1), matcher por puntuación y retirada del
> procedural SIN EMPEZAR. §1 describe la arquitectura TAL COMO QUEDÓ tras A+B
> — léela así, no como "antes".
>
> Evidencia original del diagnóstico: stress-test de 21.600 combinaciones de
> respuestas del onboarding (matriz nivel × disciplina × distribución ×
> objetivo × días × equipo × limitaciones) sobre el sistema PRE-fase A.
> Resultados: solo el 5% se resolvía por arquetipo (el camino de calidad);
> 38.000+ sesiones generadas sin ningún ejercicio clave; 4.400+ con menos de 3
> ejercicios; 1.080 programas con menos días de los pedidos sin aviso. Los
> fixes de A+B corrigen estas causas — ver harness de 704 tests en
> `src/utils/programGenerator.test.js`.

---

## 1. Arquitectura (actualizada tras fases A+B — jul 2026)

```
OnboardingScreen (mobile/src/screens/OnboardingScreen.jsx)
  └─ B1: nivel → disciplina → días (1-7, frecuencia) → tiempo/sesión → objetivo
         → equipo (incl. 'bodyweight') → limitaciones → distribución (B2: RECOMENDADA primero)
  └─ answers = { level, discipline, distribution, daysPerWeek, sessionMinutes,
                 goal, equipment[], limitations[] }
       └─ useStore.generateAndActivateProgram(answers)   [useStore.js ~línea 276]
            ├─ findBestArchetype(answers)   [src/data/archetypes.js]
            │    match EXACTO de discipline+distribution+goal+level+daysPerWeek
            │    (sin cambios en fase A/B — la fase C lo reemplaza por scoring)
            ├─ si hay arquetipo → adaptArchetype(arquetipo, answers)  [src/utils/archetypeAdapter.js]
            │    sustituye ejercicios por equipo/nivel/limitación (A3: sustituye, no
            │    elimina); aplica goal a los keys si difiere del arquetipo (A4);
            │    recorta por sessionMinutes vía trimToTimeBudget (B3)
            └─ si no → generateProgram(answers)  [src/utils/programGenerator.js]
                 monta sesiones con DISTRIBUTION_PATTERNS + getKeyCandidatesWithFallback
                 (A1: cascada de nivel para keys, nunca vacío) + getCandidates (accesorios,
                 4 intentos, A2); exercisesPerSession por sessionMinutes (B3);
                 ciclar patrones si daysPerWeek pide más sesiones que las definidas (A6,
                 capado a 6 — B2 reinterpreta daysPerWeek como frecuencia, no conteo)
```

Biblioteca: `src/data/exerciseLibrary.js` — 182 ejercicios con campos
`level` (beginner/intermediate/advanced), `equipment[]` (vacío = peso corporal,
43 así), `primaryGroup`, `pattern`, `isCompound`, `isKeyCandidate`,
`priority: { [goal]: high|medium|low }`, `relatedVariants`, `assistedVariantId`.

Los programas de la app son **ciclos rotativos** (days se rotan; no semana
natural). Esto importa: un programa de 3-6 sesiones sirve para cualquier
frecuencia (1-7 días/semana) — la frecuencia solo cambia la velocidad de
avance por el ciclo (B2).

## 2. Causas raíz (diagnóstico)

| # | Causa | Dónde |
|---|---|---|
| R1 | Solo 10 "keys" de nivel beginner en la biblioteca y TODOS requieren máquinas/cables/bandas/barras. Beginner + solo mancuernas ⇒ **cero keys posibles** en todos los grupos | `getCandidates` (keyOnly + `exerciseFitsLevel`) |
| R2 | Cuando un hueco (key o accesorio) no tiene candidato, se descarta **en silencio** (`if (!candidates.length) return`) → sesiones de 2-3 ejercicios | `generateProgram` |
| R3 | Limitación física **elimina** todos los keys del grupo en vez de sustituir por variante suave. Hombro ⇒ día de Empuje sin keys | `getCandidates` + `adaptArchetype` (`role==='key' && isLimited → return`) |
| R4 | `findBestArchetype` exige `daysPerWeek` exacto; los 4 arquetipos son de 3 días ⇒ 2/4/5/6 días caen SIEMPRE al generador procedural | `archetypes.js` |
| R5 | Patrones procedurales con menos días que los pedidos generan menos sesiones sin avisar (Fuerza full-body tiene 3 patrones; pides 5 ⇒ 3) | `DISTRIBUTION_PATTERNS` + `slice` |
| R6 | 1 y 7 días no existen en la UI (selector 2–6; PPL fijo 3; U/L 2 o 4) | `StepDays` |
| R7 | El tiempo por sesión no es una variable (`exercisesPerSession = daysPerWeek <= 3 ? 5 : 4` y ya) | `generateProgram` |
| R8 | No hay camino "solo peso corporal": el paso de equipo bloquea Next con selección vacía, aunque `equipment: []` funcionaría (43 ejercicios sin equipo pasan el filtro) | `StepEquipment` (`nextDisabled`) |
| R9 | `adaptArchetype` **ignora `goal`**: eliges fuerza sobre arquetipo de hipertrofia y las series/reps no cambian | `archetypeAdapter.js` |

## 3. Decisión de producto (cerrada)

**Invertir la estrategia**: la plantilla curada (arquetipo) debe ser el camino
del 100% de los casos; el generador procedural queda como relleno interno de
huecos, nunca como autor del programa completo. Separar **nº de sesiones
distintas del programa** (lo fija la plantilla) de **días/semana** (frecuencia,
1–7, lo fija el usuario) — el ciclo rotativo ya existente hace el resto.

Esto se ejecuta en 3 fases. La fase A NO invierte la estrategia todavía: hace
cirugía al sistema actual para que deje de producir programas rotos hoy.

---

## 4. FASE A — Cirugía al generador actual 🟢 ✅ IMPLEMENTADA (`606ccdf`)

Objetivo: con CUALQUIER combinación de respuestas, cada sesión generada tiene
≥1 ejercicio clave, ≥4 ejercicios (salvo imposibilidad real de biblioteca), sin
duplicados, respetando equipo, y con el nº de días pedido. Cero cambios de UX
salvo A5 (opción peso corporal).

### A1 — Fallback de nivel para keys (`programGenerator.js`)

El nivel del ejercicio es orientación, no barrera de seguridad. En
`getCandidates` con `keyOnly`, si el filtro estándar no devuelve nada, relajar
en cascada (parar en el primer escalón con resultados):

1. `isKeyCandidate && isCompound`, nivel ≤ usuario, priority≠low (actual).
2. `isKeyCandidate && isCompound`, **cualquier nivel** — ordenar por cercanía
   de nivel al del usuario y después por priority.
3. `isCompound` del grupo, cualquier nivel, mismo orden.

Implementación sugerida: no ensuciar `getCandidates`; función
`getKeyCandidatesWithFallback(...)` que llama a `getCandidates` y aplica los
escalones. El orden por cercanía de nivel: `Math.abs(LEVEL_ORDER[ex.level] - LEVEL_ORDER[level])`
como criterio previo al de priority.

### A2 — Nunca perder un hueco en silencio (`programGenerator.js`)

- Keys: con A1 el hueco de key casi nunca queda vacío. Si aun así queda
  (biblioteca sin compounds del grupo para ese equipo), rellenar el hueco como
  accesorio del mismo grupo (los 3 intentos de accesorios ya existentes) con
  `isKey: false`.
- Accesorios: al tercer intento existente ("cualquier grupo, nivel ≤ usuario")
  añadir un 4º: cualquier grupo, **cualquier nivel**. Con 43 ejercicios de peso
  corporal, esto no puede quedar vacío.

### A3 — Limitación = sustituir, no eliminar

- `programGenerator.js` (`getCandidates`, rama `isLimited`): para keys, en vez
  de `return false`, permitir compounds del grupo de nivel beginner (proxy de
  "amable con la articulación"); si no hay, beginner no-compound. El
  `buildExConfig` ya aplica sets reducidos + `limitationNote` — mantener.
- `archetypeAdapter.js`: sustituir `if (archetypeEx.role === 'key' && isLimited) return;`
  por: buscar sustituto con `findSubstitute({ ..., userLevel: 'beginner' })`
  (mismo pattern+grupo); solo si no existe sustituto, eliminar el ejercicio.
  El exConfig resultante usa la rama `isLimited` de `buildExConfig` (2 sets,
  12-15 reps, nota).

### A4 — El adaptador aplica el objetivo (`archetypeAdapter.js`)

Si `answers.goal !== archetype.goal`, los ejercicios **key** adoptan los
parámetros del objetivo elegido (mover/duplicar la tabla `GOAL_PARAMS` de
`programGenerator.js`; exportarla de ahí es lo limpio): `minReps/maxReps/restSec`
del goal; `sets` = `max(sets del arquetipo, sets del goal)`. Los accesorios no
cambian (aislamientos siempre en rangos de hipertrofia — regla ya existente en
el generador). Ejercicios con `minReps: null` (tiempo/submáx) no se tocan.

### A5 — Camino "solo peso corporal" (`OnboardingScreen.jsx` + locales)

- Añadir `'bodyweight'` a `EQUIP_IDS` (primera posición). Comportamiento
  exclusivo igual que `'none'` en limitaciones (reutilizar la lógica de
  `toggleMulti`: seleccionar bodyweight limpia el resto y viceversa).
- Al construir `answers` para el generador: `bodyweight` ⇒ `equipment: []`
  (el filtro `exerciseFitsEquipment` ya hace lo correcto con lista vacía:
  solo pasan ejercicios sin equipo).
- `nextDisabled` pasa a: sin selección alguna (bodyweight cuenta como selección).
- i18n en `src/locales/es.json` Y `en.json` bajo `onboarding.equipment.bodyweight`
  (`label`: "Solo peso corporal" / "Bodyweight only"; `description`: "Sin
  material — ejercicios con tu propio cuerpo" / equivalente).
- OJO: la normalización `machines→cables` de `generateAndActivateProgram`
  (useStore ~línea 277) debe dejar `[]` intacto (ya lo hace — verificar).

### A6 — Honestidad de días (`programGenerator.js`)

Si `daysPerWeek > patternDays.length`, **ciclar** los patrones (día 4 = patrón
1 otra vez, con label/color propios y template id nuevo). Sesiones repetidas en
estructura está bien (frecuencia 2 real); los ejercicios pueden coincidir — no
es un bug, es entrenar un patrón 2 veces por semana.

### A7 — Tests de invariantes (nuevo `src/utils/programGenerator.test.js`)

Harness de invariantes sobre una matriz representativa (~400-600 combos, no las
21.600 — vitest debe seguir siendo rápido). Para cada programa generado
(arquetipo o procedural, según el camino real de `generateAndActivateProgram`,
replicando la normalización machines→cables):

- nº de sesiones === `daysPerWeek` pedido (para full_body; para U/L y PPL, el
  nº natural de la distribución).
- cada sesión: ≥1 ejercicio con `isKey: true`, ≥4 ejercicios, sin exerciseIds
  duplicados, todos los ids existen en la biblioteca.
- equipo: ningún ejercicio cuyo `equipment[]` no interseque con el equipo del
  usuario (contando la normalización machines⊃cables y equipo vacío = solo
  bodyweight).
- Casos de regresión con nombre propio:
  - beginner + `['dumbbells']` + hipertrofia + full_body 3d → todas las
    sesiones con key.
  - limitación `shoulder` + PPL → el día de Empuje conserva ≥1 key (sustituido)
    con `limitationNote`.
  - `equipment: []` (bodyweight) → programa completo, solo ejercicios sin equipo.
  - fuerza + full_body + 5 días → 5 sesiones.
  - adaptArchetype con goal='strength' sobre arquetipo hypertrophy → los keys
    llevan reps del rango de fuerza (5-8).

Nota para el implementador: la excepción aceptable a "≥4 ejercicios" es cuando
la biblioteca no da más de sí (p. ej. bodyweight + limitaciones múltiples).
Formularlo en el test como: si la sesión tiene <4, debe ser porque un barrido
de la biblioteca con esos filtros no encuentra más candidatos elegibles — no
porque el generador descartó huecos pudiendo llenarlos.

### Definition of done — fase A

- `npx vitest run --exclude "**/.claude/**"` verde (existentes + nuevos).
- Los archivos tocados parsean con babel (`babel-preset-expo`).
- eslint: comparar contra HEAD; solo cuentan violaciones NUEVAS (familias
  react-hooks/*, no-unused-vars listados en memoria del proyecto son
  pre-existentes).
- Strings nuevas por `t()` en es Y en (solo aplica a A5).
- Cero cambios de comportamiento fuera de lo listado (no tocar el orden de
  preguntas, ni distribución de pasos, ni el preview).

---

## 5. FASE B — Rediseño del flujo de onboarding 🟡 ✅ IMPLEMENTADA (`eff1666`)

Decisiones cerradas (no re-abrir sin consultar). Alcance: `OnboardingScreen.jsx`,
`programGenerator.js` (solo lectura de `sessionMinutes` + recorte), locales.

### B1 — Nuevo orden de preguntas

`nivel → disciplina → días/semana (1–7) → tiempo por sesión → objetivo →
equipo → limitaciones → distribución (RECOMENDADA)`

- La disciplina se mantiene donde está (identidad del entrenamiento); lo que se
  mueve es la distribución: del principio al FINAL, ya con días+nivel+disciplina
  conocidos para recomendar.
- `StepDays` pasa a un selector genérico 1–7 (chips como el actual 2–6). Los
  special-case de PPL (fijo 3) y U/L (2/4) DESAPARECEN de este paso — esa
  lógica vive ahora en la recomendación de distribución.
- Nuevo `StepTime`: 4 opciones tipo OptionCard — 30 / 45 / 60 / 90 min →
  `answers.sessionMinutes` (default 60). Textos por `t()`.
- `totalSteps` se recalcula (hay un paso más); el paso extra de advanced se
  mantiene como esté.

### B2 — Paso de distribución recomendada

- Se calcula `recommended` con esta tabla (filtrada por `DIST_FOR[discipline]`
  y los gates de nivel existentes; si la recomendada no pasa los gates, se
  recomienda la siguiente compatible):
  | días | recomendada |
  |---|---|
  | 1-2 | full_body |
  | 3 | beginner → full_body · intermediate+ → push_pull_legs |
  | 4 | upper_lower |
  | 5-6 | intermediate+ → push_pull_legs · beginner → full_body |
  | 7 | push_pull_legs (hint: "incluye al menos un día suave o de descanso activo") |
- UI: las mismas OptionCard de hoy, con la recomendada PRIMERA y un badge
  "Recomendado" (i18n); las demás siguen seleccionables con sus gates actuales.
- Semántica NUEVA de `daysPerWeek` = **frecuencia** (cuántos días entrena), no
  nº de sesiones. Para B, el nº de sesiones generadas sigue siendo
  `min(daysPerWeek, 6)` con el ciclado de A6 (7 días → 6 sesiones distintas);
  si `daysPerWeek > sesiones generadas`, el preview muestra un hint "tus N
  sesiones rotan en ciclo — entrenas {{days}} días" (i18n). El desacople
  completo (plantilla fija el nº de sesiones) llega en fase C.

### B3 — Presupuesto de tiempo (recorte) ⚠️ revisión Fable al terminar

En `generateProgram` (y en `adaptArchetype`), tras construir los ejercicios de
cada sesión:

1. Estimar segundos con la MISMA fórmula de `sessionStats`
   (`sets × (35s trabajo + restSec)`; ejercicios de tiempo: punto medio del
   rango). NO importar `mobile/src/utils/sessionStats.js` desde `src/utils/`
   (rompe la frontera src↔mobile): duplicar la fórmula en un helper local
   `estimateSessionSec(exercises)` con comentario apuntando a sessionStats.
2. `exercisesPerSession` inicial según tiempo: 30min→3 · 45→4 · 60→5 · 90→6.
   (Sustituye al actual `daysPerWeek <= 3 ? 5 : 4`.)
3. Bucle de recorte: mientras `estimado > sessionMinutes×60` y queden
   accesorios: quitar el ÚLTIMO accesorio cuyo `primaryGroup` ya esté cubierto
   por otro ejercicio de la sesión; si no hay ninguno así, el último accesorio
   a secas. Suelo duro: nunca bajar de 1 key + 2 accesorios (3 ejercicios) —
   si aun así no cabe, se deja y el preview muestra la duración real.
4. Los keys NUNCA se recortan por tiempo.

### B4 — Preview

- Mostrar duración estimada por sesión (aquí SÍ usar `sessionStats`, el preview
  es código mobile) junto al nombre de cada sesión.
- El hint de ciclo de B2 cuando días > sesiones.
- OPCIONAL (solo si sale barato reutilizando el patrón de reemplazo existente):
  acción "sustituir" por ejercicio. Si complica, dejarlo fuera y apuntarlo.

### B5 — Tests

Ampliar `programGenerator.test.js`: con `sessionMinutes: 30` ninguna sesión
generada supera ~35 min estimados (margen por el suelo duro) y todas conservan
≥1 key; con 90 min salen 6 ejercicios; invariantes existentes intactos con el
nuevo parámetro presente y ausente (default 60).

## 6. FASE C — Biblioteca de plantillas + matching por puntuación 🟡 EN PAUSA

### 6.1 Arquetipos escritos hasta la pausa (4 de ~10-12)

Diseñados en conversación directa Fable+usuario, verificados uno a uno con
scripts `vite-node` (matching correcto, sustitución segura si falta equipo,
recorte por tiempo sin tocar keys, frecuencia≥2 en los keys principales) y
tests de regresión en `programGenerator.test.js`:

| Arquetipo | id | Commit |
|---|---|---|
| Full Body · Hipertrofia · Iniciación (3d) | `fullbody_hypertrophy_beginner` | `746840c` |
| Upper/Lower · Hipertrofia · Intermedio (4d) | `upperlower_hypertrophy_intermediate` | `0234c96` |
| Upper/Lower · Hipertrofia · Avanzado (4d, barra libre) | `upperlower_hypertrophy_advanced` | `0410156` |
| Full Body · Fuerza · Avanzado (3d, 5×5) | `fullbody_strength_advanced` | `3e27ea0` |

Decisiones de diseño reutilizables para las que faltan:
- **Repetir el mismo ejercicio clave entre sesiones de la semana (frecuencia
  ≥2)** en vez de dispersar variedad — ancla la progresión doble, que necesita
  exposición repetida al mismo movimiento para detectar mejora.
- **El nivel del arquetipo debe coincidir con el nivel real de sus keys** en la
  biblioteca (`fitsLevel` sustituye en silencio cualquier ejercicio de nivel
  superior al declarado). Un ejercicio de nivel INFERIOR al del arquetipo sí
  puede colarse a propósito (p. ej. `hack_squat` intermedio dentro de un
  arquetipo `advanced` — `fitsLevel` solo bloquea hacia arriba). Ver el bug
  real que esto destapó en `reduceForBeginner` (commit `746840c`): leía
  `pattern`/`primaryGroup` de campos que ya no existen en el exConfig.
- **Volumen semanal por GRUPO muscular** (no por patrón de movimiento) como
  referencia ~10-14 sets — tracciones verticales y horizontales suman al mismo
  grupo (`back`), empuje horizontal y vertical NO (`chest` vs `shoulders` son
  grupos distintos en la biblioteca).
- Cuando el diseño pedido usa ejercicios de nivel `advanced` en la biblioteca
  (barra libre: `bench_press_barbell`, `barbell_row`, `overhead_press_barbell`,
  `squat_barbell`, `romanian_deadlift`), el arquetipo debe declararse
  `level: 'advanced'` — si no, el sustitutor los cambia por versiones de
  mancuerna en cuanto lo sirve a un usuario real. NO modificar un arquetipo de
  nivel inferior existente para meter contenido de barra libre: crear uno
  nuevo (ver `upperlower_hypertrophy_advanced`, que coexiste con
  `upperlower_hypertrophy_intermediate` sin pisarse).
- Verificar SIEMPRE con `sessionMinutes: 90` (plantilla íntegra, sin recorte)
  Y con `sessionMinutes: 60` (recorte activo) — el recorte por tiempo (B3)
  puede eliminar de forma legítima un accesorio redundante cuyo grupo ya
  cubre el key del día; no es un bug si pasa, pero hay que verlo antes de dar
  la plantilla por buena.

**Hallazgo pendiente (no bloqueante, no se tocó)**: al escribir el primer
arquetipo de `discipline: 'strength'` (`fullbody_strength_advanced`), el
tier-3 de `findBestArchetype` (ignora nivel a propósito, ver §1) empezó a
enrutar ahí a usuarios `beginner` con equipo casi nulo — casos que antes
siempre caían al generador procedural. `adaptArchetype`'s `findSubstitute`
solo relaja 2 niveles (pattern+group exacto → pattern solo) y no tiene la
cascada de `getKeyCandidatesWithFallback` (A1) del procedural, así que para
ejercicios de barra sin NINGÚN equipo a veces no hay candidato bodyweight de
nivel beginner y el slot se descarta. Verificado caso a caso: son casos de
biblioteca agotada, no huecos descartables por error (mismo tipo de excepción
ya documentada en `EMPHASIS_KEY_GROUPS` del test). Umbral informativo del test
subido de 10% a 11% con el análisis documentado inline (commit `3e27ea0`).
Una cascada de sustitución tan robusta como A1 en `adaptArchetype` es
candidata a hacerse dentro de esta misma fase C, antes o junto al matcher.

### 6.2 Pendiente al retomar

1. **Completar arquetipos que faltan** (~6-8 según la lista original: FB 2
   sesiones beginner, FB 3 intermediate ya existe — revisar si aguanta,
   PPL 3 intermediate, PPL 6 advanced, glúteo U/L, calistenia PPL, fuerza U/L
   4). Sesión conjunta Fable+usuario, igual que las 4 ya hechas.
2. **Matcher por puntuación** (reemplaza `findBestArchetype`): nunca devuelve
   null. Score = distribución (peso alto) + cercanía de días + disciplina +
   nivel (el adaptador ya corrige nivel) + objetivo (el adaptador ya corrige
   objetivo tras A4). Desempate por orden en el array. Con el matcher, el
   tier-3 "ignora nivel" desaparece — su reemplazo por scoring puede resolver
   también el hallazgo pendiente de arriba (el matcher elegiría un arquetipo
   de nivel apropiado en vez de forzar el más cercano en discipline+distribución+días).
3. **Retirar `generateProgram` del camino principal**: queda como utilidad
   interna del adaptador para rellenar huecos que la sustitución no cubra.
   No borrar el archivo; los tests de invariantes de A7 pasan a correr sobre
   el camino arquetipo→adaptador.
4. **Revisar si el onboarding necesita simplificarse antes de esto** — el
   propio usuario señaló que el flujo actual (disciplina + objetivo +
   distribución + días + tiempo + equipo + limitaciones) es "muy extenso" y
   no está claro si conviene reducirlo a una sola pregunta de identidad
   ("qué tipo de programa quieres": calistenia/hipertrofia/glúteo-pierna/
   fuerza/funcional) antes de seguir invirtiendo en más plantillas. No hay
   decisión tomada — es la primera cosa a discutir al retomar.

## 7. Qué NO tocar (todas las fases)

- Motor de progresión (`src/utils/progression.js`).
- Formato de `program`/`sessionTemplates` en el store (los editores dependen).
- El flujo de importación / conexión con entrenador del OnboardingScreen.
- `onboardingSnapshot` guardado en el programa (se usa para re-generar).

## 8. Herramienta de verificación

El stress-harness usado para el diagnóstico (matriz completa + invariantes) es
la base de A7. Para reproducir el diagnóstico completo fuera de vitest:
ejecutar con `npx vite-node` un script que importe `findBestArchetype`,
`adaptArchetype`, `generateProgram` y recorra la matriz (los imports del repo
no llevan extensión; node pelado no los resuelve).

## 9. Asignación de modelos

| Tarea | Modelo | Nota |
|---|---|---|
| Fase A completa | **Sonnet** ✅ hecho | Cirugía localizada con tests de invariantes que la validan sola |
| Fase B implementación | Sonnet/Opus ✅ hecho (Sonnet) | UI + recorte por tiempo; la spec fija las decisiones |
| Revisión de la fase B (recorte por tiempo) | Fable línea a línea ✅ hecho | El recorte interactúa con keys/accesorios/limitaciones; fácil de romper sutilmente |
| Fase C matcher + retirada del procedural | Sonnet | Mecánico con la spec — pendiente, EN PAUSA |
| **Fase C contenido de plantillas** | **Fable + usuario** | Diseño de programas de entrenamiento reales: requiere criterio de dominio profundo, balance de volumen/frecuencia/patrones por nivel. NO delegable a la spec — 4/~10-12 hechas (§6.1), EN PAUSA |
