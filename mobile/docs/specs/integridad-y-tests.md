# Spec — Integridad de datos y calidad de los tests

> Tema: integridad
> En corto: Asegurarse de que lo que la app calcula y guarda es correcto —progresiones, carga, 1RM, paso de etapas, sincronización— con tests que de verdad cazan errores en vez de pasar, un simulador que entrena meses en segundos y un verificador que audita todo el estado.
> Fase I01 · pendiente · Auditar los tests que ya hay (mutaciones, historial, oráculo) · §3
> Fase I02 · pendiente · `auditState`: el verificador de integridad del estado · §4
> Fase I03 · pendiente · El simulador de entrenos y etapas · §5
> Fase I04 · pendiente · Propiedades e invariantes sobre entradas aleatorias · §6
> Fase I05 · pendiente · Fronteras de datos y backups dorados · §7
> Fase I06 · pendiente · Un solo origen de verdad y mapa de efectos · §8
> Fase I07 · pendiente · Cobertura como mapa y reglas de proceso · §9
>
> Estado: **SIN IMPLEMENTAR — en espera deliberada** (2-oct-2026). 7 fases:
> I01 auditoría de tests · I02 `auditState` · I03 simulador · I04 propiedades ·
> I05 fronteras y backups · I06 origen único · I07 cobertura y proceso.
>
> **No se ejecuta todavía, y no es por prioridad.** Se arranca cuando terminen
> las specs que hay a medias (las "por probar" y "con cosas pendientes" de
> `docs/estado.html`): auditar código que todavía se está moviendo es medir una
> foto movida, y varias fases (I03, I06) tocan justo el store y el Workout que
> esas specs están cambiando. **Orden al retomarla: I01 primero** (es solo
> lectura, no cambia nada y da el informe con números); después I02, que es el
> cimiento de las demás.
>
> Origen: conversación del 2-oct-2026. Dos preocupaciones del usuario: (1) la
> integridad de los datos y de toda la lógica con fórmula detrás —progresiones,
> cálculo de carga, paso de etapas—, que hoy solo se prueba a mano en el móvil; y
> (2) que los tests existentes estén "pensados para pasar": los escribe el mismo
> LLM que escribe el código y comparte su error. Un test así da tranquilidad
> falsa, que es peor que no tener test.
>
> **Código nuevo de tema**: `I`. No se usó `E` porque sus números los comparte
> con los fallos de [auditoria-tecnica.md](auditoria-tecnica.md) (`npm run estado`
> los cuenta juntos), y esta auditoría va a **encontrar** fallos: necesitan esos
> números libres.
>
> Depende de: nada para I01. I03 e I06 dependen de I02. I05 depende de I02.
> No toca pantallas.

---

## 1. Por qué, y qué se midió

Medido el 2-oct-2026 sobre `fada958`:

| Dato | Valor | Lectura |
|---|---|---|
| Tests (`it`/`test`) | 1.111 | Mucho material |
| `expect` | ≈ 2.077 | ~1,9 por test: no hay tests vacíos en masa |
| Aserciones débiles (`toBeTruthy`, `toBeDefined`, `toBeFalsy`) | 30 | Poca cosa; no es el problema |
| `.skip` / `.todo` / snapshots | 0 | Bien |
| Herramienta de **cobertura**, **mutaciones** o **propiedades** | ninguna | No existe forma objetiva de saber si un test caza algo |
| Commits de `progression.js` que cambian `progression.test.js` **en el mismo commit** | 15 de 19 | Mismo autor, mismo momento: el sesgo compartido que preocupa |
| `progression.test.js` (bloque RPE): lo que se aserta | solo `chip.type`, con `t = () => ''` | No comprueba `suggestedWeight`, reps ni mensaje (solo se leyó una parte del fichero) |
| `parseFloat` sobre `weight` en `utils/` y `store/` | 16 | Pesos como strings por todo el log |
| Normalización de la coma decimal | un solo sitio: `ExerciseCard.jsx:845` | Pegar un entreno, imports y overrides confían en que el dato llegue limpio |
| Chip de progresión calculado en | `ExerciseCard.jsx:158` · `useStore.js:2531` · `sessionText.js:37` | Tres copias de la misma decisión, las tres dentro de `try { … } catch {}` |

Lo que **no** se midió, y por eso la primera fase es auditar: cuántos de los
1.111 tests fallarían si el código tuviera un fallo. El `grep` no puede saberlo.

**El problema de fondo no es de cantidad sino de independencia.** Un test
escrito por quien escribió el código verifica "el código hace lo que el autor
creyó", no "el código hace lo que la spec dice". Ante un error de comprensión
—una fórmula mal entendida, un caso borde no pensado— código y test fallan
juntos y en el mismo sentido, y el test sale verde. Todas las fases de abajo
existen para meter una **fuente de verdad que no sea el autor del código**:
mutaciones (la máquina), propiedades (el azar), la spec firmada (el usuario),
`auditState` (las reglas de coherencia) y el simulador (el uso real).

## 2. Principios

1. **Nada de lo que decide si el dato es correcto lo decide un LLM.** Un LLM
   puede escribir la herramienta; el veredicto lo da una máquina (mutantes,
   invariantes) o el usuario (la tabla de casos firmada).
2. **Auditar no repara.** `auditState` informa; nunca modifica datos del
   usuario. Una reparación automática equivocada pierde más datos que la
   inconsistencia que arregla. Reparar es una acción explícita, aparte y con
   copia previa.
3. **Determinismo.** Nada de `Math.random()` ni reloj real en simulador ni
   propiedades: semilla fija (como `seed-load-data.mjs`, que ya lo hace así) y
   `vi.setSystemTime`. Un fallo que no se puede reproducir no se puede arreglar.
4. **Un fallo encontrado se registra en `auditoria-tecnica.md`** como `E27`,
   `E28`… con su `> En corto:`, y se arregla con test que falla antes y pasa
   después (§9). Esta spec no lleva su propia lista de bugs.
5. **El oráculo es el límite.** Ninguna de estas herramientas sabe cuál es el
   resultado *correcto* de una fórmula; solo detectan incoherencias, tests
   huecos e invariantes rotos. Si la spec de una fórmula está mal, todo sale
   verde. Por eso la tabla de casos firmada (§3.3) es una pieza, no un adorno.

---

## 3. Fase I01 — Auditar los tests que ya hay

**Solo lectura: no cambia código de la app ni los tests.** Entrega un informe
en `docs/auditoria-tests/` (Markdown, fuera de `docs/specs/` para no entrar en
`npm run estado`) con números y una lista de acciones. Coste 🟡 (lo caro es
domar Stryker en Windows, no el análisis).

### 3.1 Mutaciones

Herramienta: `@stryker-mutator/core` + `@stryker-mutator/vitest-runner`.
Cambia el código (`>` por `>=`, `+` por `-`, borra una rama, devuelve `null`) y
ejecuta los tests: un mutante que **sobrevive** es comportamiento que ningún
test vigila.

- **Comprobar primero** que el runner de Stryker soporta vitest 4.1.8 (la
  versión del repo; en `node_modules/.bin` no hay `vite-node`). Si no, caer a
  la versión de vitest que sí soporte solo para esta herramienta, o a un
  script propio mínimo de mutación (cambiar un operador, correr un fichero de
  tests, restaurar con `git checkout`). No seguir si el coste se dispara:
  informar y parar.
- `stryker.config.mjs` en la raíz, `mutate` **limitado a lógica pura** (≈10-16
  ficheros, para que corra en minutos y no en horas):
  `progression`, `progressionForm`, `setPlan`, `oneRm`, `warmup`, `stageRx`,
  `stageProgress`, `trainingLoad`, `prescription`, `sessionPlan`, `weekProgress`,
  `weeklyVolume`, `adherence`, `improvement`, `clientLogs`, `programOwnership`
  (todos en `mobile/src/utils/`). El store entero (4.963 líneas) queda para una
  segunda pasada por zonas (`saveSession`, `advanceStage`, `importData`).
- Script `npm run mutacion -- <fichero>` para correr uno solo.
- Salida: puntuación de mutación por fichero y la lista de mutantes
  supervivientes, cada uno clasificado a mano en: **(a) equivalente** (cambiar
  el código no cambia el comportamiento; se ignora), **(b) hueco real** (falta
  un test; se escribe), **(c) fallo encontrado** (el código estaba mal y nadie
  lo vio; va a `auditoria-tecnica.md`).

### 3.2 Arqueología del historial

Buscar los "tests ajustados para pasar": commits donde **un valor esperado de
un test cambió en el mismo commit que el código que prueba**.

- Script (`scripts/` o un comando de `git log -p` documentado en el informe) que
  recorre cada `*.test.js`, saca los hunks con una línea `-  expect(…)` y otra
  `+  expect(…)` y los cruza con el fichero fuente cambiado en el commit.
- Cada hallazgo se revisa contra la spec correspondiente: ¿el valor viejo o el
  nuevo es el que la spec manda? Las dos respuestas son útiles: si era el
  nuevo, el test mejoró; si no, se ha encontrado un fallo.
- Empezar por `progression.js` (15 de 19 commits con test en el mismo commit) y
  `stageProgress.js`.

### 3.3 Oráculo independiente

Para cada módulo de fórmula, los tests se contrastan con **la spec, no con el
código**:

| Módulo | Spec que manda (a confirmar al ejecutar) |
|---|---|
| `progression.js`, `setPlan.js`, `progressionForm.js` | `progresion-clara.md`, `effort-progression.md` |
| `oneRm.js` | `effort-progression.md`, `metric-transparency.md` |
| `warmup.js` | `warmup-sets.md` |
| `stageProgress.js` | `weeks-model.md`, `stage-locks.md` |
| `stageRx.js` | `stage-planner.md`, `stage-proposal.md` |
| `trainingLoad.js`, `weeklyVolume.js` | `training-load.md` |

Procedimiento, por módulo:

1. Un agente **sin acceso al código** recibe solo el `§` de la spec y escribe
   una **tabla de casos** en lenguaje llano (`100 kg × 5 @RPE 8 → e1RM 123,3`;
   `3×8 con 60 kg, todas completas, rango 8-12 → mantiene`), incluidos bordes:
   cero, vacío, rango degradado, RPE fuera de 5-10, reps > 12, semana de
   descarga.
2. **El usuario revisa y firma la tabla.** Es el único paso que no se
   delega: las filas que no cuadren con su intención se corrigen *ahí*, antes
   de mirar el código.
3. Se ejecuta la tabla contra el código. Cada discrepancia es un fallo del
   código, un fallo de la spec o una ambigüedad; se resuelve en el chat.
4. La tabla firmada se queda **en la spec** (sección `## Casos`) y los tests la
   citan (`// spec §4.2, caso 7`). Así el valor esperado tiene un dueño y no
   vive solo en el test.
5. En paralelo, un segundo agente hace de **adversario**: recibe un módulo y
   sus tests y escribe entradas pensadas para romperlo, y lista las suposiciones
   que el código hace y que no están en la spec.

### 3.4 Catálogo de olores

Lista de patrones a buscar y qué hacer con cada uno:

- **Solo `chip.type`** con `t` nulo: no comprueba el contenido. Ampliar a peso,
  reps y tipo de regla.
- **Esperado calculado con el propio código** (`expect(f(x)).toBe(f(y) + 1)`
  donde `f` es lo que se prueba): reescribir con el literal de la tabla.
- **`toHaveBeenCalled()` sin argumentos** (7): comprobar con qué se llamó.
- **`toBeTruthy()` sobre un valor concreto** (30): comparar el valor.
- **`try { … } catch {}` en la ruta de datos** —hoy `ExerciseCard.jsx:158`,
  `useStore.js:2531`, `sessionText.js:37`—: un fallo en la progresión se traga
  y la pantalla dice "sin chip". Un error del motor se convierte en ausencia de
  dato sin que nadie se entere. Inventariar **todos** los `catch` vacíos o
  silenciosos de `store/` y `src/utils/` y decidir en cada uno: relanzar en
  test/dev (§8.2), o justificarlo.
- **Tests que mockean la unidad probada**, o que montan un estado tan a medida
  que ya no se parece al real.

### 3.5 Entrega y criterio de aceptación

- `docs/auditoria-tests/informe.md`: tabla por fichero (tests, `expect`,
  puntuación de mutación, nº de mutantes (b) y (c), olores), los hallazgos del
  historial y las tablas de casos pendientes de firma.
- Cada mutante (b) con un test nuevo que lo mata, **verificado**: el test falla
  contra el código mutado y pasa contra el real.
- Cada (c) dado de alta como fallo `E27+` en `auditoria-tecnica.md`.
- **Meta de referencia, no de aceptación**: ≥ 80 % de mutación en
  `progression`, `setPlan`, `oneRm`, `stageProgress`. Una cifra de cobertura sin
  la de mutación no vale (§9).

---

## 4. Fase I02 — `auditState`: el verificador de integridad

Una **función pura** `auditState(state) → Violation[]` en
`src/utils/auditState.js`, sin efectos y sin tocar el store. `Violation =
{ code, severity: 'error' | 'warn', path, message }`. Es la pieza que convierte
"los datos están bien" en algo que se puede comprobar, y la reutilizan I03, I05
y I06. Coste 🟡.

### 4.1 Qué comprueba

Sobre las claves que ya persiste `partialize` (`store/useStore.js:4625`):
`profile`, `workoutLog`, `clientLogs`, `customExercises`, `blockPresets`,
`stageBannerSnooze`, `programs`, `sessionTemplates`, `clients`, `tagRegistry`,
`exerciseAliases`, `driveBackup`, `trainerSync`, `clientSync`, `theme`.

**Referencias** (nada apunta a algo que no existe):

- Cada `sessionTemplateId` de cada día de cada etapa de cada programa existe en
  `sessionTemplates`.
- Cada `sessionTemplates[*]` pertenece a algún programa o es plantilla libre
  (**no hay huérfanas**: es la fuga que `program-model.md` cerró para
  `deleteProgram`/`deleteClient`, y el verificador la vigila para siempre).
- Cada `exerciseId` de plantillas y log está en la librería, es un
  `customExercises` o tiene alias (`exerciseAliases`).
- `profile.activeProgramId` existe y no está archivado.
- Cada clave de `clientLogs` es un cliente de `clients`.
- `linkGroup`s: cada grupo tiene ≥ 2 miembros y todos viven en la misma sesión.

**Unicidad y forma**:

- Ids únicos en `workoutLog` y en `clientLogs[*]`; ids de programas, plantillas
  y clientes únicos.
- Cada serie guardada: `weight`, `reps`, `time`, `rpe` son string vacío o
  numéricos finitos y ≥ 0; `rpe` entre 1 y 10; sin `NaN`, sin `Infinity`, sin
  coma decimal dentro del string.
- `timestamp` finito, no futuro (con margen de reloj), y no anterior a 2020.

**Coherencia derivada** (la parte que atrapa la deriva silenciosa):

- Los contadores de etapa (`currentStageIndex`, sesiones de la etapa,
  `stageStartedOn`; `stageProgress.js`) coinciden con lo **recalculado desde el
  log**. Si no coinciden, es que hay estado derivado persistido que se desvió.
- `currentStageIndex` está dentro de `stages`.
- Una sesión completada cuenta en la etapa que tocaba el día que se hizo.

La lista exacta de comprobaciones se cierra al implementar leyendo la forma real
de cada clave (`clients` y `trainerSync` no se inspeccionaron aún); cada
comprobación lleva un `code` estable (`REF_TEMPLATE_MISSING`, `LOG_ID_DUP`,
`SET_NOT_FINITE`…) para poder filtrar y para que un informe de hace meses siga
significando lo mismo.

### 4.2 Dónde se engancha

1. **Tests**: helper `expectIntegrity(state)` que falla con la lista de
   violaciones. Lo llaman I03 (tras cada acción del simulador) y I05 (tras cada
   migración).
2. **Dev**: un suscriptor del store, solo con `__DEV__`, que corre `auditState`
   tras cada `set` y hace `console.error` con las violaciones. Cuesta cero en
   producción.
3. **Fronteras**: se ejecuta sobre lo que entra por `importData`,
   `importForClient`, `downloadClientHistory`, `_restoreFromSlot` y
   `checkAndPullProgramUpdates` **antes de mezclarlo**, y sobre el estado al
   rehidratar. Aquí **solo informa** (principio 2): si hay errores, avisa al
   usuario y deja la decisión suya; no descarta ni corrige.
4. **Informe visible** (decisión abierta, §12): un apartado "Diagnóstico de
   datos" en Ajustes/Documentación que muestre las violaciones con su `code`, y
   que se pueda copiar para pegarlo en un chat.

### 4.3 Criterio de aceptación

- Sobre un estado limpio devuelve `[]`; sobre uno con **cada** violación
  inyectada devuelve exactamente esa (un test por `code`, con el dato roto
  fabricado a mano).
- Corrido sobre un backup real del móvil del usuario: lista lo que haya, y cada
  hallazgo se explica o se registra como fallo.
- Coste en tiempo medido con un historial grande (`npm run seed`, 12+ semanas) y
  anotado; en dev no debe notarse al teclear un peso.

---

## 5. Fase I03 — El simulador de entrenos y etapas

Entrenar meses en segundos, con el **store real**, sin tocar el móvil. Un
humano o un LLM escribe un escenario, lo ejecuta y lee la traza. Depende de I02.
Coste 🟡/🔴 (la más grande).

### 5.1 Por qué es viable

Ya existe casi todo: `store/useStore.test.js` importa el store de verdad en
Node (alias de `vite.config.js` a `test/native-stub.js` + mocks de Supabase),
y ya hace `startSession` → `updateSetField` → `saveSession` con
`vi.useFakeTimers()` saltando de semana en semana (p. ej. el bloque
`saveSession — lo que se ve en gris se da por hecho (QA P48)`).
`clientSync.sim.test.js` ya simula entrenador↔cliente con una tabla falsa.

### 5.2 Diseño

Ficheros en `test/sim/` (junto a `native-stub.js`):

- `simulate.js` — `simulate(escenario) → traza`. Monta el programa (generado
  con `generateAndActivateProgram`, una plantilla, o un `.fitdata` real),
  avanza el reloj día a día con `vi.setSystemTime`, y en cada día que toque
  entreno hace `startSession` → rellena con el atleta → `saveSession`; al final
  de cada etapa lo que hace la app (`stageBannerDue`, `advanceStage`,
  `extendStage`).
- `athletes.js` — el **atleta**: función `(contexto) → { weight, reps, rpe,
  done } | 'salta'` que ve lo mismo que el usuario (el gris de `planSet`, el
  chip) y decide. Presets: `perfecto` (cumple siempre), `falla-a-veces` (p %
  de series por debajo, con semilla), `grinder` (siempre RPE alto),
  `irregular` (se salta semanas), `vuelve-tras-parar` (4 semanas sin entrenar),
  `lesion` (baja el peso de golpe). PRNG con semilla (`mulberry32`), nunca
  `Math.random`.
- `escenarios/*.json` — `{ programa, atleta, semanas, semilla, unidad,
  invariantes }`.
- `run.test.js` — corre el escenario indicado en `SIM=<fichero>` y escribe la
  traza. `npm run sim -- escenarios/double-12-semanas.json`.

Las simulaciones **pasan por `saveSession`**, no por `getProgression` suelto: es
el camino que cubre "✓ sin escribir guarda lo gris" (P56), el cálculo del chip
con historial, el avance de etapa y el sumar al log.

> vitest 4 no trae `vite-node`, así que el simulador se ejecuta **bajo
> vitest** (reutiliza los alias). Los `vi.mock` de Supabase del encabezado de
> `useStore.test.js` hay que repetirlos o moverlos a un `setupFiles`; no se
> pueden poner en un módulo auxiliar (se elevan por fichero).

### 5.3 La traza

Una fila por serie y una por sesión, en JSON-lines y en tabla de texto
resumida: `semana · día · sesión · ejercicio · serie · peso×reps@rpe · gris
(plan) · chip (tipo + peso sugerido) · etapa · e1RM · carga 7d/28d`. Pensada
para que un LLM la lea entera y diga "en la semana 6 el press sube 2,5 kg
después de fallar".

### 5.4 Invariantes que se comprueban solos

Tras **cada** acción: `expectIntegrity` (I02). Y, por reglas del dominio:

- Ningún peso `NaN`, negativo ni con más decimales que el `weightStep`.
- **Tras fallar no se sube** (en `double`/`reps`/`time`): si la última sesión
  no cumplió, el siguiente gris no supera lo hecho.
- En semana de descarga (`hold: 'deload'`) el peso se mantiene.
- Con `direction: 'decrease'` (ayuda) el número no sube.
- Los contadores de etapa son una función del log (y coinciden con I02).
- Pasar de etapa conserva sesiones, ejercicios y progresiones; nunca pierde un
  ejercicio ni duplica una sesión.
- El 1RM estimado y la carga no saltan de forma absurda de una semana a otra
  salvo que el atleta lo haga (umbral configurable).
- `exportar → importar` en mitad de la simulación deja el estado igual
  (idempotente) y sigue entrenando igual.

### 5.5 Reproducir con datos reales

`--backup ruta.fitdata`: carga un backup del móvil, corre `auditState` y
simula **encima** del historial real. Es probablemente lo que más valor da: los
datos sintéticos no tienen las rarezas de los reales. Los backups reales traen
datos personales: viven **fuera del repo** (o anonimizados, §7.3).

### 5.6 Criterio de aceptación

Cinco escenarios que corren en < 10 s cada uno (`double` 12 semanas con atleta
perfecto, `double` con fallos, `effort` con grinder, cambio de etapa a la
semana 4, vuelta tras 4 semanas sin entrenar), una traza legible y los
invariantes de §5.4 activos. Cada invariante se prueba **rompiendo a propósito**
el código (mutante manual) y viendo que el simulador lo detecta.

---

## 6. Fase I04 — Propiedades e invariantes sobre entradas aleatorias

`fast-check` (devDependency) para decir *"para toda entrada válida se cumple
X"* y dejar que la máquina busque el contraejemplo. Sus entradas no comparten
los puntos ciegos del autor, y el *shrinker* devuelve el caso mínimo que falla.
Coste 🟢/🟡.

### 6.1 Propiedades

- **Inversas**: `weightForReps(epley1RM(w, r, p), r, p) ≈ w` dentro del dominio
  donde ambas están definidas. (Ojo: `epley1RM` devuelve `w` para `r === 1` y
  no `w·(1+1/30)`: es una decisión de modelo, no un error, y la propiedad la
  tiene que respetar.)
- **Monotonía**: más peso o más reps a igual RPE nunca baja el e1RM; más RPE
  (más cerca del fallo) nunca sube el e1RM para las mismas reps.
- **Progresión**: nunca sugiere subir si hubo una serie sin completar (cuando
  la regla es "todas completas"); `hold` por descarga ignora el rendimiento
  (`progression.js:472`).
- **Idempotencia**: `normalizeProgress(normalizeProgress(x)) = normalizeProgress(x)`;
  `ensureStages` idem; `resolveProgressionConfig` sobre su propia salida.
- **Fechas**: `addDays` y `daysBetween` son inversas; `localDay` no se parte en
  cambios de hora (DST) ni en medianoche; "semana" coincide en todos los sitios
  que la calculan (`weeks-model.md` avisa de dos definiciones en conflicto).
- **Mezcla (sync)**: `mergeClientLog` es **conmutativa, asociativa e
  idempotente** y solo añade (append-only) — es lo que impide que dos
  dispositivos pierdan sesiones. `scopeFilterForUpload` nunca deja pasar un
  campo fuera del alcance.
- **Round-trip**: para cualquier estado válido generado, `exportar → importar`
  da el mismo estado; `reidProgramFile` conserva la estructura.
- **Parseo**: pegar un entreno (`PasteWorkoutScreen`, `sessionText`) nunca
  devuelve pesos `NaN` y reconoce `62,5` y `62.5` por igual.

### 6.2 Tests metamórficos (cuando no hay un valor correcto de referencia)

Se compara el sistema consigo mismo bajo una transformación que no debe cambiar
el resultado:

- Pasar todos los pesos de kg a lb y volver (`useWeightUnit`) no altera el log.
- Desplazar todas las fechas N días no altera ni progresiones ni etapas.
- Dividir una sesión en dos guardados, o guardarla en otro orden de series, da
  el mismo chip siguiente.
- Duplicar un programa (`cloneProgramFromTemplate`) y entrenar los dos da
  trazas idénticas.

### 6.3 Criterio de aceptación

Cada propiedad con ≥ 1.000 casos por defecto y semilla registrada cuando falle.
Al menos una propiedad **cazada de verdad** al introducir un fallo a mano en el
código (misma prueba de "romper a propósito" de I03).

---

## 7. Fase I05 — Fronteras de datos y backups dorados

Los datos entran al estado por **seis puertas** y hoy cada una confía en que
llegue limpio. Coste 🟡.

### 7.1 Las puertas

`importData` (`useStore.js:3068`) · `importForClient` (`:855`) ·
`downloadClientHistory` (`:3741`) · `_restoreFromSlot` (`:4007`) ·
`checkAndPullProgramUpdates` (`:4118`) · rehidratación del storage
(`onRehydrateStorage`, `:4642`), más el texto pegado (`PasteWorkoutScreen`).
Todas ya llaman a `migrateExerciseRefs`; ninguna comprueba la forma.

### 7.2 Un solo sitio para los números

El peso es un string en todo el log y se parsea en 16 sitios con
`parseFloat`. Se crea `src/utils/num.js`:

- `toNum(v)` → número finito ≥ 0 o `null`; acepta `'62,5'`, `' 62.5 '`, `62.5`;
  rechaza `''`, `'abc'`, `NaN`, `Infinity`, negativos.
- `roundTo(n, step)` → redondeo al `weightStep` con la precisión correcta (sin
  `62.49999999`).
- Se sustituyen los 16 `parseFloat` de peso, **uno a uno y con test** (cambiar
  cómo se parsea puede cambiar cuándo sube una progresión). Regla de ESLint
  (`no-restricted-syntax`, en `warn` con conteo contra HEAD, como pide
  `AGENTS.md` por los errores previos) que impide volver a `parseFloat(…weight…)`.

### 7.3 Validar la forma en cada puerta

Un validador por puerta que comprueba forma y tipos **antes** de mezclar,
reutilizando `auditState` para la coherencia. Dos opciones, a decidir en §12:

- **A (recomendada)**: validadores a mano y ligeros + `auditState`. Cero
  dependencias nuevas.
- **B**: Zod en las fronteras. Esquema declarativo y mensajes de error buenos, a
  costa de una dependencia y de mantener los esquemas versionados.

Un dato que no pasa **no se descarta en silencio** (principio 2): se avisa al
usuario con el `code` y se le deja decidir.

### 7.4 Backups dorados

La mejor defensa contra perder datos reales en una actualización. Fixtures
congelados, uno por versión del esquema (`version: '2'`, `'3'`, `'4'`
—`useStore.js:2991`—, y la actual):

- `test/golden/v2.fitdata`, `v3`, `v4`, `actual`.
- Cada uno: `importData` → `expectIntegrity` limpio → `exportFullBackup` →
  `importData` → estado igual (idempotente).
- **Anonimizados** antes de entrar al repo: nombres de clientes, notas, peso
  corporal y cualquier texto libre se sustituyen por valores sintéticos; los
  números de series se conservan (son los que ejercitan las rarezas).
- **Regla**: cualquier cambio del esquema añade un fixture nuevo. La versión
  actual se congela como `vN` justo antes de subir el número.

### 7.5 Criterio de aceptación

Los cuatro fixtures pasan; `toNum` con una tabla de casos firmada (§3.3); 0
`parseFloat` de peso fuera de `num.js`; cada puerta rechaza (con aviso) una
carga con la forma rota que se fabrica para el test.

---

## 8. Fase I06 — Un solo origen de verdad y mapa de efectos

Atacar las **fugas**: sitios donde la misma decisión vive copiada, estado
derivado que se persiste, y acciones que tocan más de lo que dicen. Depende de
I02 (y de I03 para §8.3). Coste 🟡.

### 8.1 Una sola función para el chip

El chip de progresión se calcula en `ExerciseCard.jsx:158`, en `saveSession`
(`useStore.js:2531`) y en `sessionText.js:37`. Si divergen, lo que la tarjeta
**promete** no es lo que `saveSession` **guarda** (la misma clase de bug que
P48/P56 ya tuvo una vez con `planSet`). Se extrae a una función
`chipFor({ exConfig, def, logs, t })` que usan los tres, y un test que lo
fija: dado un historial, los tres devuelven lo mismo.

### 8.2 Los errores no se tragan

Cada `try { … } catch {}` inventariado en I01 §3.4 se resuelve: en `test` y
`__DEV__` **se relanza o se registra** como violación (`console.error` +
contador que el simulador lee); en producción se mantiene el fallback para no
tumbar la pantalla. Así un fallo del motor deja de convertirse en "sin chip".

### 8.3 Tabla de efectos: qué toca cada acción

Un fichero declarativo `acción → claves del estado que puede cambiar`:

```js
saveSession:        ['workoutLog', 'clientLogs', 'programs', 'activeSession', 'ui'],
toggleSetDone:      ['activeSession'],
updateExerciseParams: ['sessionTemplates'],
advanceStage:       ['programs', 'stageBannerSnooze'],
```

El simulador (I03) y un test propio envuelven cada acción, comparan el estado
antes/después clave a clave y **fallan si cambió algo no declarado**. Es el
detector de fugas más directo: una acción que "de paso" toca `clientLogs` o
reescribe una plantilla ajena salta en cuanto se ejecuta. Se arranca con las
acciones de log, programa y etapa; el resto se añade según se toquen.

### 8.4 Mapa de flujo de datos

`docs/data-flow.md`: por cada clave de `partialize`, **quién la escribe** (qué
acciones), **quién la lee**, si es **primaria o derivada** y si **sincroniza**
(con qué filtro). Se genera con `grep` + revisión a mano y se contrasta con la
tabla de §8.3. Cada clave derivada persistida (los contadores de etapa son el
caso conocido: 14 menciones en el store) termina en una de dos: se **calcula**
al leer, o se mantiene y `auditState` verifica que coincide con lo recalculado.

### 8.5 Duplicación

`jscpd` (o equivalente) sobre `mobile/src` y `store/` como informe puntual, no
como puerta de CI: solo para encontrar otras copias como la del chip.

### 8.6 Criterio de aceptación

El chip tiene un solo origen y un test que lo cubre; cero `catch` silenciosos
sin justificar; la tabla de efectos cubre las acciones de log/programa/etapa y
**atrapa una fuga fabricada a propósito**; `docs/data-flow.md` existe y cada
clave derivada tiene decisión.

---

## 9. Fase I07 — Cobertura como mapa y reglas de proceso

Coste 🟢.

### 9.1 Cobertura

`@vitest/coverage-v8` y `npm run cobertura`. **Solo como mapa** de qué zonas no
tienen nada (`useStore.js` tiene 4.963 líneas frente a 2.472 de tests). Una
línea cubierta no significa una línea vigilada —para eso está la mutación de
I01—; por eso no se fija un porcentaje objetivo ni se usa para aceptar nada.

### 9.2 Reglas de proceso (a `mobile/AGENTS.md`)

1. **Rojo primero.** Un fallo (`E27+`, QA `Pxx`) empieza por un test que
   **falla contra el código viejo**; se comprueba antes de arreglar (revertir el
   arreglo y ver el rojo). Los tests nacidos de bugs reales son los menos
   sesgados que existen.
2. **No se cambia un valor esperado sin decir por qué.** Si un commit modifica
   el literal de un `expect`, el mensaje del commit lo nombra y cita la spec. Es
   la regla que habría evitado los casos que busca I01 §3.2.
3. **El valor esperado de una fórmula sale de la spec**, de su tabla de casos
   (§3.3), no de ejecutar el código y copiar el resultado.
4. **Quien escribe el código no escribe en solitario los tests de sus
   fórmulas.** Un agente distinto, con la spec y sin el código, escribe la tabla
   de casos (§3.3); el implementador solo la hace pasar.
5. **Una fase que toca lógica con fórmula cierra con**: su tabla de casos firmada,
   sus propiedades (I04) si procede, y el simulador (I03) pasando.
6. **Cada cambio de esquema** congela un backup dorado (§7.4).

### 9.3 Criterio de aceptación

`npm run cobertura` genera el informe; las seis reglas en `AGENTS.md`; la
sección de `docs/specs/README.md` sobre cerrar una fase menciona la regla 5.

---

## 10. Fases

| Fase | Qué | Coste | Depende de | Estado |
|---|---|---|---|---|
| I01 | Auditar los tests (mutaciones · historial · oráculo · olores) | 🟡 | — | pendiente |
| I02 | `auditState` | 🟡 | — | pendiente |
| I03 | Simulador | 🟡/🔴 | I02 | pendiente |
| I04 | Propiedades y metamórficos | 🟢/🟡 | — (usa I02 en round-trip) | pendiente |
| I05 | Fronteras y backups dorados | 🟡 | I02 | pendiente |
| I06 | Origen único y mapa de efectos | 🟡 | I02 (§8.3: I03) | pendiente |
| I07 | Cobertura y reglas de proceso | 🟢 | — | pendiente |

**Orden recomendado**: I01 → I02 → I03 → I04 → I05 → I06 → I07. I01 va primero
porque es lectura y porque dice dónde están los huecos reales antes de gastar
esfuerzo en el resto; I07 puede adelantarse en cualquier momento (las reglas no
cuestan nada).

Ninguna fase tiene pruebas en dispositivo: son de datos y de tests. Cada una
pasa a `terminado` al cerrarse, salvo la parte de I02 que se vea en pantalla
(informe de diagnóstico, §12), que sí pediría casillas.

## 11. Descartado con motivo

- **Event sourcing** (guardar eventos y derivar el estado): haría todo
  auditable y reproducible, pero es una reescritura del store entero. `auditState`
  + recálculo de lo derivado da la mayor parte del beneficio sin migrar nada.
- **Migrar a TypeScript**: el beneficio (formas de datos comprobadas) se
  consigue en las fronteras con §7.3; migrar 5.000 líneas de store por esto no
  compensa. `tsc --checkJs` con JSDoc queda como opción barata si se quiere más.
- **Un porcentaje de cobertura como puerta de CI**: mide líneas ejecutadas, no
  líneas vigiladas; un número alto da tranquilidad falsa, que es justo lo que se
  quiere evitar.
- **Que un LLM revise sus propios tests y diga si son buenos**: comparte el
  sesgo que se quiere detectar. Sí se usa un LLM como *adversario* y como
  redactor de la tabla de casos, pero el veredicto lo dan las mutaciones y el
  usuario.
- **Reparar datos automáticamente al detectar una inconsistencia** (principio 2).
- **Tests de interfaz** (render de pantallas): fuera de alcance. Los stubs de
  `native-stub.js` son inertes y la UI se prueba en el móvil; esta spec cubre
  solo lo que tiene lógica o formula detrás.

## 12. Decisiones abiertas

1. **¿Validadores a mano (A) o Zod (B)?** en §7.3. Recomendada A.
2. **¿`auditState` visible para el usuario?** (§4.2-4). Un apartado de
   diagnóstico sirve para pedir ayuda ("pégame tu informe") pero es pantalla
   nueva, con su i18n es/en y su mockup. Recomendado: primero solo tests y dev;
   la pantalla, si hace falta.
3. **¿Stryker o script propio?** Depende de si el runner de Stryker funciona con
   vitest 4.1.8 en Windows (§3.1). Se decide al empezar I01, no antes.
4. **¿Qué backups reales se anonimizan para §7.4?** Hace falta que el usuario
   exporte uno de cada versión que tenga a mano y diga qué es sensible.
5. **Umbral de "salto absurdo"** del 1RM y la carga en los invariantes de §5.4:
   se fija mirando las trazas de los primeros escenarios.
