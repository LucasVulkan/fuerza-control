# Spec — Onboarding de propuestas (fase 6 de program-templates)

> Estado: **cerrada, SIN implementar** (ago 2026). Es la **fase 6** de
> [program-templates.md](program-templates.md) §8, extraída a documento propio
> porque es la única fase con UI y necesita contexto que aquella spec da por
> sabido.
>
> **Autocontenida a propósito**: todo lo necesario para ejecutarla está aquí o en
> los ficheros que se citan explícitamente. Las fases 1-5 ya están implementadas
> y su resultado se describe en §3.

---

## 1. Qué se construye

Hoy el onboarding hace **ocho preguntas** y entrega un programa ya decidido. El
usuario no elige: recibe.

Después de esta fase hace **cuatro preguntas, enseña tres programas reales, y
pregunta dos cosas más** para ajustar el que se elija.

```
4 preguntas          →  PANTALLA DE PROPUESTAS  →  2 preguntas    →  preview
nivel                    2-3 candidatos             tiempo/sesión     con fases
qué buscas               + "ver todas"              limitaciones
días/semana
material
```

El corte no es arbitrario: **antes de la lista van las respuestas que eligen qué
plantilla; después, las que sólo modifican la elegida.**

| Respuesta | Qué hace | Dónde |
|---|---|---|
| nivel | elige plantilla + fija la banda de volumen | antes |
| identidad (disciplina+objetivo) | elige plantilla | antes |
| días/semana | elige plantilla (`cycleSpeed`) | antes |
| material | ordena las candidatas + resuelve ejercicios | antes |
| tiempo/sesión | comprime la elegida | después |
| limitaciones | resuelve ejercicios de la elegida | después |
| **distribución** | **la pregunta desaparece** | — |

La distribución (full body / U/L / PPL) deja de preguntarse: es una propiedad de
la plantilla que se elige. Preguntarla y después enseñar plantillas es preguntar
dos veces.

---

## 2. Estado del código hoy

**Fichero:** `mobile/src/screens/OnboardingScreen.jsx`, 1422 líneas.

### 2.1 Lo que NO se toca

La pantalla tiene cuatro modos (`mode`), y **sólo uno cambia**:

| Modo | Qué es | Acción |
|---|---|---|
| `null` | selector inicial (Auto / Manual / Importar / Entrenador) | conservar |
| `'manual'` | nombre + nº de sesiones → `createEmptyProgram` | conservar |
| `'template_picker'` | clonar plantilla propia → `cloneProgramFromTemplate` | conservar |
| `'auto'` | **el wizard de 8-9 pasos** | **se rehace** |

También se conservan intactos el flujo de importación (`parseImportFile`,
`ImportModal`, `handlePickFile`, `handleImport`) y el de conexión con entrenador
(`ClientCodeModal`).

### 2.2 Lo que se sustituye

Los pasos actuales del modo `auto`:

```
step 0  StepLevel        → se conserva (pregunta 1)
step 1  StepDiscipline   → se fusiona con StepGoal en la pregunta de identidad
step 2  StepDays         → se conserva (pregunta 3)
step 3  StepTime         → se MUEVE detrás de la pantalla de propuestas
step 4  StepGoal         → se fusiona con StepDiscipline
step 5  StepEquipment    → se conserva (pregunta 4)
step 6  StepLimitations  → se MUEVE detrás de la pantalla de propuestas
step 7  StepDistrib      → SE ELIMINA, y con él `recommendDistribution`,
                           `distAvailable`, `DIST_FOR` y `DIST_IDS`
step 8  StepProgression  → se conserva, detrás de la elección (sólo avanzados)
```

Componentes reutilizables que ya existen y hay que seguir usando, en
`mobile/src/components/onboarding/`: `OnboardingStep`, `OptionCard` (soporta
`badge`, `disabled`, `disabledReason`, `multi`) y `OnboardingProgress`.

### 2.3 Migración FormaFit — obligatoria

`OnboardingScreen` **no está migrada** al rediseño FormaFit (no aparece en
`mobile/docs/UI-MIGRATION.md`). Como esta fase la rehace de arriba abajo, es el
momento de migrarla.

**Leer `mobile/docs/UI-MIGRATION.md` ANTES de escribir una línea de UI.** Ahí
están las reglas de fidelidad (radio, espaciado, tipografía y color exactos de
Figma), el sistema de tokens (`src/theme.js` + `src/themes.js`, tocar sólo
`formaFit`) y las trampas de React Native ya pisadas.

---

## 3. Los datos que ya existen

Las fases 1-5 dejaron listo todo lo que la pantalla necesita. **No hay que
calcular nada nuevo.**

### 3.1 `rankArchetypes(answers)` → `src/data/archetypes.js`

Devuelve **todas** las plantillas puntuadas y ordenadas de mejor a peor. Nunca
devuelve vacío.

```js
[
  {
    archetype,                    // el objeto plantilla entero
    score: 57.3,
    sessionsPerCycle: 3,          // = archetype.days.length
    cycleSpeed: 1.33,             // días/semana ÷ sesiones del ciclo
    adaptationCost: 8,            // ejercicios que habría que sustituir
    notes: ['needsBarbell', 'rotates'],
  },
  …
]
```

`answers` necesita `level`, `discipline`, `goal`, `daysPerWeek` y `equipment` —
es decir, **exactamente las cuatro primeras preguntas**.

Las cinco `notes` posibles son los avisos honestos de la tarjeta:

| nota | Cuándo | Qué decir |
|---|---|---|
| `needsBarbell` | `adaptationCost > 0` | "Diseñado con barra. Sin ella sustituimos N ejercicios." |
| `rotates` | `cycleSpeed > 1,25` | "3 sesiones que rotan en ciclo: entrenas 4 días, verás cada sesión más de una vez." |
| `slowCycle` | el ciclo avanza demasiado despacio | "Con 2 días, el ciclo tarda más de una semana en cerrarse." |
| `levelStretch` | la plantilla no es de tu nivel | "Pensada para intermedios; adaptamos ejercicios y volumen." |
| `lowFrequency` | cada grupo se toca ~1 vez por semana | "Cada grupo, una vez por semana." |

Sin ninguna nota: *"Encaja con tu material."*

### 3.2 `adaptArchetype(archetype, answers)` → `src/utils/archetypeAdapter.js`

```js
{
  program,           // con stages: la fase 1 es la etapa base
  sessionTemplates,  // { [id]: { id, label, name, emphasis, color,
                     //           generatedWarmup, exercises: [exConfig] } }
  phases,            // [{ name, durationWeeks, rx }] | null
  substitutions,     // [{ slotExerciseId, resolvedExerciseId, reason }]
                     //   reason: 'equipment' | 'level' | 'limitation' | 'duplicate'
  unresolved,        // [{ pattern, primaryGroup, tier }]  huecos sin llenar
  overTime,          // ['A', 'C']  etiquetas de sesiones que no caben
  weekly,            // { back: 17, chest: 14, … } series semanales por grupo
  overBudget,        // ['shoulders']  grupos por encima de su techo
}
```

`exConfig`: `exerciseId, isKey, sets, restSec, minReps, maxReps,
progressionOverride, limitationNote, order`. `minReps: null` = ejercicio de
tiempo.

**Nada de esto se consume todavía.** `substitutions`, `unresolved`, `overTime`,
`weekly` y `overBudget` existen desde las fases 1-3 esperando a esta pantalla.

### 3.3 El store

`generateAndActivateProgram(answers)` en `mobile/store/useStore.js:311` ya hace
el camino entero: rankea, adapta, guarda y materializa las fases 2..N. Devuelve
`{ program, sessionTemplates, phases }`.

**Cambio necesario:** hoy la plantilla la elige él (`rankArchetypes(...)[0]`).
Con la pantalla de propuestas la elige el usuario, así que la acción tiene que
aceptar un `archetypeId` opcional y usarlo en vez del primero del ranking.

### 3.4 Tiempo

`estimateSessionSec(exercises, allExercises, { includeWarmup })` e
`includesWarmup(sessionMinutes)`, en `src/utils/sessionCompression.js`.

El preview **ya los usa** (no `sessionStats`) para que el número mostrado y el
presupuesto aplicado no se contradigan. Conservarlo así — está explicado en
[program-templates.md](program-templates.md) §5.3.1.

---

## 4. Decisiones cerradas — no re-litigar

1. **La plantilla tiene protagonismo.** El usuario elige de una lista; no recibe
   un programa fabricado.
2. **El material nunca filtra, ordena.** Ninguna plantilla se oculta por falta de
   equipo: baja en el ranking y declara su coste en la tarjeta.
3. **La pregunta de distribución desaparece.**
4. **Disciplina y objetivo se fusionan** en una pregunta de identidad.
5. **La duración va en portada de la tarjeta**: es lo que convierte esto en un
   programa y no en una lista de ejercicios.
6. **Volver atrás no pierde las respuestas.** "Ver otro programa" devuelve a la
   lista con todo lo contestado.

---

## 5. Pantalla por pantalla

### 5.1 Las cuatro preguntas

1. **Nivel** — `StepLevel` tal cual está.
2. **¿Qué buscas?** — pregunta nueva; fusiona disciplina y objetivo:

   | Tarjeta | `discipline` | `goal` |
   |---|---|---|
   | Ganar músculo | `standard` | `hypertrophy` |
   | Ponerte fuerte | `strength` | `strength` |
   | Glúteo y pierna | `glutes_legs` | `hypertrophy` |
   | Calistenia | `calisthenics` | `endurance` |

   `max_strength` deja de ser opción del onboarding: lo trae la plantilla si lo
   usa. `GOAL_MIN_LEVEL` sigue existiendo para los objetivos de fuerza.

3. **Días por semana** — `StepDays` tal cual (1-7).
4. **Material** — `StepEquipment` tal cual (multi, con `bodyweight` exclusivo).

### 5.2 La pantalla de propuestas

`rankArchetypes(answers).slice(0, 3)` más acceso a la lista completa.

Cada tarjeta lleva:

- Nombre del programa (`archetype.name`).
- **`N semanas · M fases · S sesiones por ciclo`**
  - semanas = suma de `phases[].durationWeeks`
  - fases = `phases.length`
  - sesiones = `sessionsPerCycle`
- Una frase de carácter → **campo `summary`, que hay que añadir** (§6).
- El aviso que corresponda según `notes` (tabla de §3.1).
- Badge **Recomendado** en la primera.

"Ver todas" abre la lista completa ordenada. **Nada se oculta ni se bloquea.**

Tocar una tarjeta abre el detalle: las fases con su duración y su carácter, y las
sesiones expandibles con sus ejercicios. Botón **Elegir este programa**.

### 5.3 Las dos preguntas de ajuste

5. **Tiempo por sesión** — `StepTime` tal cual (30/45/60/90).
6. **Limitaciones** — `StepLimitations` tal cual.

Después, sólo para avanzados, `StepProgression` como hasta ahora.

### 5.4 El preview

El preview actual ya enseña las fases, la duración estimada por sesión y el aviso
de calentamiento. **Le falta consumir lo que el adaptador ya devuelve:**

- `substitutions` → *"Press banca barra → Press banca mancuerna"*. Hoy pasan en
  silencio, y enseñarlas es la promesa de honestidad de toda la feature.
- `unresolved` → *"No hemos podido cubrir 2 huecos de espalda con tu material."*
- `overTime` → *"Tu sesión A dura ~68 min, más de los 60 que pediste."*
- `overBudget` → *"Volumen de hombro por encima de lo recomendado para tu nivel."*
- **"Ver otro programa"** → vuelve a §5.2 sin perder respuestas.

---

## 6. Lo que hay que añadir al dato

`summary` en cada arquetipo de `src/data/archetypes.js`: una frase de carácter
para la tarjeta. Las 11 plantillas lo necesitan. El tono:

- Upper/Lower: *"Tren superior y tren inferior alternados. Cada básico dos veces
  por semana."*
- PPL frecuencia 2: *"Empuje, tracción y pierna, cada uno dos veces por semana."*
- Full Body 2 días: *"Todo el cuerpo en cada sesión. Para quien entrena dos veces
  por semana."*

Va en castellano en el dato, igual que `name` — deuda de i18n preexistente del
catálogo que no se arregla aquí.

---

## 7. i18n

Todas las cadenas por `t()` en `src/locales/es.json` **y** `en.json` (raíz del
repo, no dentro de `mobile/`).

Ya existen: `onboarding.stepLevel.*`, `onboarding.stepDays.*`,
`onboarding.stepTime.*`, `onboarding.stepEquipment.*`,
`onboarding.stepLimitations.*`, `onboarding.equipment.*`,
`onboarding.limitations.*`, `onboarding.levels.*`,
`onboarding.preview.cycleHint`, `.estimatedMinutes`, `.noWarmupNote` y
`.weeksAndPhases`.

Hay que crear:

- `onboarding.identity.*` — las 4 tarjetas de la pregunta fusionada.
- `onboarding.proposals.*` — título, badge "Recomendado", los cinco avisos de
  `notes`, "ver todas", "elegir este programa", "ver otro programa".
- `onboarding.preview.substitutions.*` · `.unresolved` · `.overTime` ·
  `.overBudget`.

Se pueden **borrar** al eliminar el paso de distribución:
`onboarding.stepDistribution.*`, `onboarding.distributions.*`, y
`onboarding.disabledReasons.requiresIntermediate` / `.requiresAdvanced` si no
quedan otros usos.

---

## 8. Verificación

- `npx vitest run` desde la raíz, verde. Los **1107 tests** actuales no deberían
  moverse: esta fase no toca el motor.
- `npx eslint mobile/src/screens/OnboardingScreen.jsx` — comparar el número
  contra HEAD. Hay **2 errores preexistentes** (`useRef` sin usar y un `setState`
  dentro de un efecto); no añadir más.
- Test nuevo: el `answers` que produce el flujo nuevo tiene la misma forma que
  consume `generateAndActivateProgram`, con `distribution` derivada de la
  plantilla elegida. El `onboardingSnapshot` no puede perder campos — se usa para
  regenerar.
- A mano, en dispositivo: los cuatro modos (auto, manual, plantilla propia,
  importar) y el flujo de conexión con entrenador siguen funcionando.

---

## 9. Trampas conocidas

- **`answers.distribution` sigue existiendo** aunque no se pregunte: se rellena
  con la `distribution` de la plantilla elegida antes de guardar el snapshot.
- **`OptionCard` ya soporta `badge`** — se usaba para "Recomendado" en el paso de
  distribución que se elimina. Reutilizarlo, no reinventarlo.
- **`FlatList` con `ListHeaderComponent`**: pasar el elemento, nunca una función
  que lo devuelva, o se remonta en cada render.
- **Animaciones con Reanimated** (`useSharedValue`, `exiting`, `layout`), no
  `Animated` de React Native core.
- **El preview usa `estimateSessionSec`, no `sessionStats`**, y es deliberado
  (§3.4). No "arreglarlo".
- Los ficheros `mobile/package.json`, `mobile/package-lock.json` y
  `mobile/tsconfig.json` llevan modificaciones sin commitear ajenas a esta tarea.
  No incluirlos en el commit.

---

## 10. Qué NO entra

- El motor de generación: fases 1-5, terminadas y calibradas.
- El catálogo de plantillas (fase 8): faltan Fuerza · 3 sesiones · intermedio y
  los ejercicios de tracción sin material. Es contenido y va aparte.
- Las reglas de integridad del harness (fase 7).
