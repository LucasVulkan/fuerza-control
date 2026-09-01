# Spec — Onboarding de propuestas (fase 6 de program-templates)

> Estado: **implementada** (ago 2026). Es la **fase 6** de
> [program-templates.md](program-templates.md) §8, extraída a documento propio
> porque es la única fase con UI y necesita contexto que aquella spec da por
> sabido.
>
> **Ojo al leer**: el enfoque cambió durante el QA y este documento describe el
> resultado, no la versión que se cerró en su día. Los tres cambios grandes están
> marcados donde tocan: sólo **tres** preguntas antes de la lista (§1), el
> material **ya no puntúa** el ranking (§3.1), y el resto de preguntas son un
> **paso interactivo** después de elegir (§5.3).
>
> **Autocontenida a propósito**: todo lo necesario está aquí o en los ficheros
> que se citan explícitamente. Las fases 1-5 ya estaban implementadas y su
> resultado se describe en §3.

---

## 1. Qué se construye

El onboarding hacía **ocho preguntas** y entregaba un programa ya decidido. El
usuario no elegía: recibía.

Ahora hace **tres preguntas, enseña tres plantillas reales**, y sólo después
pregunta lo que falta — enseñando en vivo lo que cada respuesta le hace al
programa.

```
3 preguntas   →  PLANTILLAS      →  3 ajustes en vivo  →  preview
nivel            3 candidatas       material              lo adaptado
qué buscas       + "ver todas"      tiempo/sesión         + guardar
días/semana      sesiones a la      limitaciones
                 vista              (+ progresión)
```

El corte es el que importa: **antes de la lista sólo van las respuestas que
eligen QUÉ plantilla. Las que sólo la adaptan van después, con la plantilla
delante y el resultado a la vista.**

| Respuesta | Qué hace | Dónde |
|---|---|---|
| nivel | elige plantilla + fija la banda de volumen | antes |
| identidad (disciplina+objetivo) | elige plantilla | antes |
| días/semana | elige plantilla (`cycleSpeed`) | antes |
| material | resuelve ejercicios — **ya no ordena** (§3.1) | después, en vivo |
| tiempo/sesión | comprime la elegida | después, en vivo |
| limitaciones | resuelve ejercicios de la elegida | después, en vivo |
| progresión | sólo se guarda; no adapta nada | después, sin panel |
| **distribución** | **la pregunta desaparece** | — |

La distribución (full body / U/L / PPL) deja de preguntarse: es una propiedad de
la plantilla que se elige. Preguntarla y después enseñar plantillas es preguntar
dos veces.

**El porqué de todo esto**: el generador no es la feature, el catálogo lo es. Una
lista que sale después de ocho preguntas es el output de un algoritmo que ya ha
decidido; una lista que sale después de tres es un catálogo que se navega. Y la
adaptación deja de ser una transformación silenciosa para ser algo que se ve
ocurrir.

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
step 0  StepLevel        → se conserva, pregunta 1
step 1  StepDiscipline   ┐ fusionados en StepIdentity, la pregunta 2
step 4  StepGoal         ┘ ("¿Qué buscas?", 4 tarjetas)
step 2  StepDays         → se conserva, pregunta 3   ← y aquí sale la lista
step 5  StepEquipment    ┐
step 3  StepTime         │ el componente DESAPARECE: sus opciones se pintan
step 6  StepLimitations  │ dentro del paso de ajuste, junto al panel en vivo
step 8  StepProgression  ┘ (§5.3)
step 7  StepDistrib      → ELIMINADO, y con él `recommendDistribution`,
                           `distAvailable`, `DIST_FOR` y `DIST_IDS`
```

El modo `auto` ya no es un wizard con un índice: es una máquina de cuatro fases
(`autoPhase`) — `questions`, `proposals`, `tuning`, `preview`. Las preguntas
previas siguen usando `OnboardingStep`, que gana una prop `nextLabel` porque el
último paso ya no genera nada: lleva a la lista.

Los cuatro pasos de ajuste NO usan `OnboardingStep`: necesitan el panel en vivo
fijo entre la cabecera y el scroll de opciones, y `OnboardingStep` mete todo lo
que le pasas dentro del ScrollView. Con el panel dentro se iría con el dedo al
primer scroll, que es justo lo contrario de "en vivo".

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

**Lo que se hizo, y su límite:** esta pantalla **no tiene nodo en Figma** — no
está en `docs/figma-extraction/pages/`. Las pantallas nuevas (tarjeta de
propuesta, panel en vivo, aviso de adaptación) se montaron con los tokens de `theme.js`
y los patrones ya migrados: tarjeta `surface` con `radius/md` y padding `lg`,
badge en `tint/accent-10` con texto `accent`, avisos en `surface2` y los que
duelen en `color/orange`. **Eso no es fidelidad a Figma, es coherencia con lo
migrado**: cuando exista el nodo, hay que revisarla contra él.

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

`answers` necesita `level`, `discipline`, `goal` y `daysPerWeek` — las **tres**
preguntas previas.

### `equipment` es opcional, y ausente ≠ vacío — CAMBIO DE MOTOR

`[]` significa "sé lo que tiene y es sólo su peso corporal". **Ausente** significa
"todavía no se lo he preguntado", y es el caso del onboarding móvil, que enseña
la lista antes de preguntar el material.

Antes no se distinguían, y puntuar el hueco como "no tiene nada" daba una lista
activamente equivocada. Medido, nivel intermedio y 4 días pedidos:

```
con material                      sin material (lo que se veía)
1. FB · Iniciación                1. Full Body · 2 días     ← 2 sesiones para 4 días
2. Upper/Lower                    2. Full Body · Hipertrofia
3. PPL · 3 días                   3. FB · Iniciación
4. Full Body                      4. PPL · 3 días
5. Full Body · 2 días             5. Upper/Lower            ← fuera del podio
```

Con `equipment` ausente, `rankArchetypes` no resta `adaptationCost` (lo devuelve
en 0) y no emite `needsBarbell`. Ordenan la disciplina, el objetivo, el nivel, la
velocidad de ciclo y la frecuencia. El coste de adaptación se enseña después, ya
con la plantilla elegida y en vivo.

El onboarding **web** sigue preguntando el material antes, le sigue pasando
`equipment`, y se comporta exactamente como siempre. Cubierto por
`src/data/rankArchetypes.test.js`.

Las `notes` posibles son los avisos honestos de la tarjeta:

| nota | Cuándo | Qué decir |
|---|---|---|
| `needsBarbell` | `adaptationCost > 0` — **sólo si se conoce el material**, así que nunca en esta pantalla | "Diseñado con barra. Sin ella sustituimos N ejercicios." |
| `rotates` | `cycleSpeed > 1,25` | "3 sesiones que rotan en ciclo: entrenas 4 días, verás cada sesión más de una vez." |
| `slowCycle` | el ciclo avanza demasiado despacio | "Con 2 días, el ciclo tarda más de una semana en cerrarse." |
| `levelStretch` | la plantilla no es de tu nivel | "Pensada para intermedios; adaptamos ejercicios y volumen." |
| `lowFrequency` | cada grupo se toca ~1 vez por semana | "Cada grupo, una vez por semana." |

Sin ninguna nota, **no se dice nada**. La frase que había ("Encaja con tu
material") era mentira en esta pantalla: aún no se sabe qué material tiene.

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

**Implementado:** la acción acepta un segundo argumento `archetypeId` opcional y
lo usa en vez del primero del ranking. Sin él se comporta como siempre — el store
web y `programPhases.test.js` la siguen llamando con un solo argumento.

**Y el guardado va después del preview.** La pantalla no llama a esta acción para
enseñar el preview: llama a `adaptArchetype` por su cuenta y pinta el resultado en
memoria. La acción sólo se ejecuta al pulsar EMPEZAR o EDITAR. Si guardara al
elegir, "ver otro programa" (§5.4) dejaría un programa activo y sus etapas ya
materializadas en el store cada vez que el usuario cambia de opinión.

Para que el programa previsualizado y el guardado sean el mismo, la normalización
de respuestas vive ahora en un sitio: `normalizeOnboardingAnswers`, exportada de
`mobile/store/useStore.js`. Es idempotente — la pantalla la aplica y el store la
vuelve a aplicar. Antes estaba partida en dos (`bodyweight` en la pantalla,
`cables` en el store).

### 3.4 Tiempo

`estimateSessionSec(exercises, allExercises, { includeWarmup })` e
`includesWarmup(sessionMinutes)`, en `src/utils/sessionCompression.js`.

El preview **ya los usa** (no `sessionStats`) para que el número mostrado y el
presupuesto aplicado no se contradigan. Conservarlo así — está explicado en
[program-templates.md](program-templates.md) §5.3.1.

---

## 4. Decisiones cerradas — no re-litigar

1. **La plantilla tiene protagonismo.** El usuario elige de una lista; no recibe
   un programa fabricado. El generador no es la feature: el catálogo lo es.
2. **El material ni filtra ni ordena: adapta, y se ve.** Antes hundía en el
   ranking a las plantillas caras de adaptar. Ahora se pregunta *después* de
   elegir, y lo que hace se enseña en vivo mientras se contesta (§5.3).
3. **La pregunta de distribución desaparece.**
4. **Disciplina y objetivo se fusionan** en una pregunta de identidad.
5. **La tarjeta enseña estructura, no texto.** Las sesiones del ciclo, cuántas
   son y cuántas semanas dura. Nada de ejercicios: cuando se pinta la lista
   todavía no se sabe cuáles sobrevivirían.
6. **Volver atrás no pierde las respuestas.** "Ver otro programa" devuelve a la
   lista con todo lo contestado.

---

## 5. Pantalla por pantalla

### 5.1 Las tres preguntas que eligen plantilla

1. **Nivel** — `StepLevel` tal cual está.
2. **¿Qué buscas?** — `StepIdentity`, fusiona disciplina y objetivo:

   | Tarjeta | `discipline` | `goal` |
   |---|---|---|
   | Ganar músculo | `standard` | `hypertrophy` |
   | Ponerte fuerte | `strength` | `strength` |
   | Glúteo y pierna | `glutes_legs` | `hypertrophy` |
   | Calistenia | `calisthenics` | `endurance` |

   `max_strength` deja de ser opción del onboarding: lo trae la plantilla si lo
   usa. `GOAL_MIN_LEVEL` sigue existiendo y bloquea la tarjeta "Ponerte fuerte" a
   los principiantes — bloquea una TARJETA de esta pregunta, nunca una plantilla
   de la lista.

3. **Días por semana** — `StepDays` tal cual (1-7).

Y ya. El material, el tiempo y las limitaciones no eligen plantilla: la ajustan,
y se preguntan después.

### 5.2 La pantalla de propuestas

`rankArchetypes({ level, discipline, goal, daysPerWeek })` — **sin `equipment`**,
a propósito (§3.1). Las tres primeras, más "ver todas".

Cada tarjeta (`ProposalCard`) lleva:

- Nombre del programa (`archetype.name`).
- **El número de sesiones por ciclo en grande**, junto a las semanas (suma de
  `phases[].durationWeeks`). Las fases **no** salen: son estructura interna y en
  la tarjeta sólo añadían texto.
- **La lista de sesiones del ciclo** — etiqueta y nombre de cada `archetype.days`.
  Es lo que de verdad distingue una plantilla de otra, y es cierto pase lo que
  pase con el material.
- La frase de carácter (`summary`, §6).
- Las notas que apliquen, **todas**, no la primera (§9).
- Badge **Recomendado** en la primera.

El número de sesiones va en grande por un motivo concreto de QA: el ranking
ofrece plantillas cuyo ciclo no coincide con los días pedidos (pides 4, te
ofrece una de 3 que rota), y en letra pequeña eso no se ve.

Tocar una tarjeta **elige** esa plantilla y lleva al ajuste. **No hay pantalla de
detalle**: lo que enseñaba —las sesiones— ya está en la tarjeta, y los ejercicios
no se pueden enseñar todavía sin mentir.

### 5.3 El ajuste interactivo

Tres pasos, y para avanzados un cuarto:

4. **Material** — multi, con `bodyweight` exclusivo.
5. **Tiempo por sesión** — 30/45/60/90.
6. **Limitaciones** — multi, con `none` exclusivo.
7. **Progresión** — sólo avanzados. Va la última y **sin panel**:
   `progressionModel` no entra en `adaptArchetype`, así que no habría nada en
   vivo que enseñar.

Cada toque vuelve a pasar la plantilla por `adaptArchetype`, y `LiveSummary`
—fijo, fuera del scroll, o dejaría de ser en vivo al primer dedazo— enseña el
resultado:

- **`~N min por sesión`** en grande, más un chip por sesión con sus minutos y su
  número de ejercicios.
- **En el paso de tiempo, el recorte sesión a sesión**: `A −1 ejercicio · −3
  series`. Y si no recorta nada, se dice — *"Todo cabe en 45 min. Ningún
  recorte."* Callar ahí dejaba la pregunta sin respuesta.
- En material y limitaciones, los ejercicios perdidos respecto a la plantilla
  escrita, sólo si los hay, y los sustituidos con su par `origen → destino`. En
  limitaciones se filtran a los de `reason: 'limitation'`.
- Los huecos que el material no cubre.

**Cada recorte contra su propia referencia.** El del tiempo se calcula contra la
misma plantilla con las mismas respuestas y `sessionMinutes: null`, que desactiva
`compressSession` (`sessionCompression.js:331`). Restar contra la plantilla
escrita no vale en ese paso: mezclaría lo que se llevan el material y el nivel,
que no se mueven al cambiar de 90 a 45, y el número se quedaría clavado dando la
impresión de que la pregunta no hace nada. Cuesta un `adaptArchetype` de más, y
sólo en ese paso.

Medido con Upper/Lower, principiante, 4 días:

```
sin material aún   ~41 min   15 ejercicios (7 menos)   12 sustituidos   5 huecos
con sus máquinas   ~50 min   20 ejercicios (2 menos)    8 sustituidos   0 huecos
lo mismo a 45 min  ~42 min   20 ejercicios (2 menos)
lo mismo a 30 min  ~35 min   17 ejercicios (5 menos)
```

**Por qué el número grande son los minutos y no "lo que pierdes".** Medido, con
las plantillas actuales el presupuesto casi sólo muerde a 30 minutos:

```
                        90    60    45                    30
Upper/Lower             —     —     —                     A −2ej/−5ser  B −1/−3  C −1/−5  D −1/−5
PPL · 6 días            —     —     —                     las seis, −1ej/−3ser cada una
Full Body · Fuerza      —     —     C −1ej/−3ser          A −1/−8  B −1/−6  C −1/−8
```

(Medido con el umbral del calentamiento en 60. **Desde ago-2026 está en 45**, así
que el salto de estimación que describe el párrafo siguiente ya sólo ocurre entre
30 y 45.)

Los minutos sí se mueven con cada opción, porque por debajo del umbral se deja de
contar el calentamiento general. El recorte va debajo, con su detalle por sesión
cuando lo hay y diciéndolo explícitamente cuando no.

### 5.4 El preview

Enseña la cabecera (sesiones por ciclo, semanas, avisos de ciclo y de
calentamiento), las sesiones plegables con sus ejercicios, y `AdaptationNotice`
con lo que el adaptador devolvía desde las fases 1-3 sin que lo leyera nadie:

- `substitutions` → *"Press banca barra → Press banca mancuerna"*.
- `unresolved` → *"No hemos podido cubrir 2 huecos de espalda con tu material."*
- `overTime` → *"Tu sesión A dura ~68 min, más de los 60 que pediste."*
- `overBudget` → *"Volumen de hombro por encima de lo recomendado para tu nivel."*
- **"Ver otro programa"** → vuelve a §5.2 sin perder respuestas.

Hay solape deliberado con el panel de §5.3: el panel es para decidir mientras
contestas, el preview es el resumen de lo decidido. El preview además lista los
ejercicios, que el panel no.

**Sigue faltando una honestidad, y es del motor**: `reduceForBeginner`
(`archetypeAdapter.js:108`) le quita un accesorio por sesión a un principiante
que elige una plantilla de intermedio, y `adaptArchetype` no lo reporta en
ninguno de sus cuatro campos. `AdaptationNotice` no puede decirlo. El panel en
vivo de §5.3 sí lo insinúa —cuenta los ejercicios perdidos contra la plantilla
original— pero no dice por qué. Para cerrarlo, `adaptArchetype` tendría que
devolver esa reducción.

---

## 6. Lo que hay que añadir al dato

✅ Hecho: las 11 plantillas de `src/data/archetypes.js` llevan ya su `summary`.

`summary` en cada arquetipo: una frase de carácter para la tarjeta. El tono:

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

Creadas:

- `onboarding.identity.*` — las 4 tarjetas de la pregunta fusionada.
- `onboarding.proposals.*` — título, badge, avisos de `notes`, ciclo, semanas,
  "ver todas", "ver otro programa".
- `onboarding.tuning.*` — el panel en vivo: minutos por sesión, ejercicios
  perdidos, sustituidos, huecos sin cubrir.
- `onboarding.preview.*` — `.unresolved`, `.overTime`, `.overBudget`,
  `.adaptedTitle`, `.ready`, `.edit`, `.start`, `.exerciseCount`, `.setCount`.

Borradas al quedarse sin uso: `proposals.notes.fits` (mentía en una pantalla que
aún no sabe el material), y `proposals.choose` · `.phasesTitle` · `.phaseWeeks` ·
`.sessionsTitle` · `preview.weeksAndPhases`, que eran de la pantalla de detalle
que ya no existe.

**No se borra** `onboarding.stepDistribution.*` ni `onboarding.distributions.*`:
las sigue usando el onboarding **web**. Tampoco `stepEquipment.*`,
`stepTime.*`, `stepLimitations.*` ni `stepProgression.*` — los componentes
desaparecieron pero sus títulos y subtítulos los reusa el paso de ajuste.
`disabledReasons.requiresIntermediate` la usa la pregunta de identidad.

---

## 8. Verificación

- ✅ `npx vitest run` desde la raíz: **1118 verdes** — los 1107 de antes,
  intactos, más 7 de `mobile/store/onboardingAnswers.test.js` y 4 de
  `src/data/rankArchetypes.test.js` para el material ausente (§3.1).
- ✅ `npx eslint mobile/src` sale igual que en HEAD: 197 problemas / 170 errores /
  27 avisos. En `OnboardingScreen.jsx` siguen los **2 errores preexistentes**
  (`useRef` sin usar y un `setState` dentro de un efecto) y ninguno más.
- ✅ Test nuevo: `mobile/store/onboardingAnswers.test.js` — `archetypeId` manda
  sobre el ranking, `normalizeOnboardingAnswers` es idempotente y no pierde
  campos, y el `onboardingSnapshot` conserva todas las respuestas incluida la
  `distribution` de la plantilla elegida.
**Probar en dispositivo.** Los cuatro modos (auto, manual, plantilla propia, importar) y la conexión con entrenador siguen funcionando; y el camino nuevo entero: elegir una candidata, "ver otro programa", volver de la lista a las preguntas sin perder ninguna respuesta, y EMPEZAR y EDITAR desde el preview — que es donde por fin se guarda el programa.

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
- **`onboarding.stepDistribution.*` y `onboarding.distributions.*` NO se borran**
  aunque §7 lo permitiera: el onboarding **web** (`src/components/onboarding/
  OnboardingView.jsx`) sigue preguntando la distribución y usándolas. Lo mismo
  con `disabledReasons.requiresIntermediate` / `.requiresAdvanced`, que además
  las usa la pregunta de identidad. Esta fase toca sólo el onboarding móvil.
- **El preview se pinta sin haber guardado nada** (§3.3). Si alguien mueve la
  llamada a `generateAndActivateProgram` a `chooseArchetype`, "ver otro programa"
  vuelve a crear programas huérfanos.
- **Al rankear NO se pasa `equipment`** (§3.1). Pasarle `[]` "por limpieza"
  reintroduce la regresión entera: `[]` significa "no tiene nada", no "no lo sé".
- **La tarjeta enseña TODAS las notas, no la primera.** Salió del QA: con la
  primera sola, `needsBarbell` se comía siempre a `levelStretch` — que era justo
  la que explicaba por qué a un principiante le salían 4 ejercicios en tren
  inferior y no 5.
- **El panel en vivo va FUERA del ScrollView.** Por eso los pasos de ajuste no
  usan `OnboardingStep`: mete a sus hijos dentro del scroll, y un panel que se va
  con el dedo deja de ser en vivo.
- **`adaptArchetype` corre en cada render del ajuste**, y así tiene que ser: es
  lo que hace que el panel responda. Es puro y barato (milisegundos); no hace
  falta debounce ni memo más fino que el `useMemo` sobre `submitAnswers`.

---

## 10. Qué NO entra

- El motor de generación: fases 1-5, calibradas. **Con una excepción**, y está
  documentada en §3.1: `rankArchetypes` tuvo que aprender a no puntuar el
  material cuando no se le da. Sin eso, la lista antes de preguntarlo salía al
  revés y todo el enfoque se cae.
- El catálogo de plantillas (fase 8): faltan Fuerza · 3 sesiones · intermedio y
  los ejercicios de tracción sin material. Es contenido y va aparte.
- Las reglas de integridad del harness (fase 7).

### Lo que este cambio deja como siguiente prioridad

Si las plantillas son la feature, **el catálogo es el producto**. Son 11, y la
fase 8 reconoce que están incompletas. Con el generador de protagonista eso era
un detalle de contenido; con las plantillas de protagonista, es lo más
importante que queda por hacer. La pantalla ya está lista para catálogos más
grandes: "ver todas" no tiene tope y la tarjeta se explica sola.
