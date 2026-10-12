# Spec — Creador de etapas y planificador

> Tema: programas
> En corto: Añadir etapas pasa de una hoja difícil de seguir a una pantalla propia —el creador— que enseña de dónde partes, qué cambia y cómo queda cada ejercicio, con un mando para elegir el carácter de la etapa; el planificador pasa a ser el sitio donde se mira la periodización entera. Incluye ideas de más herramientas de periodización.
> Fase P15-01 · pendiente · Rondas de diseño del creador y del planificador; partir en tareas · §6
>
> Estado: **borrador, sin tareas** (abierta el 12-oct-2026). Sale de la primera
> ronda de [P14](P14-editor-etapas.md) (9-oct), cuando las dos cosas iban juntas: el
> usuario decidió cerrar antes el editor y seguir aquí después, «partiendo de lo que
> ya se hizo al principio más las rondas de ajustes que hagamos». Maqueta de partida:
> [`docs/mockups/stages-v2.html`](../mockups/stages-v2.html) §2 y §3. Al usuario le
> gustaron mucho cosas del planificador; nada está cerrado todavía.
>
> Revisa decisiones de [P06-stage-planner.md](P06-stage-planner.md): §14.2.1 (el plan
> no es un asistente: sigue sin serlo, pero añadir sale a su propia pantalla) y
> §14.2.7 (las semanas no se eligen al añadir). Absorbe U10-07 y U10-08 de
> [U10-todo-pesa.md](U10-todo-pesa.md) (la ola), hoy aparcadas.

---

## 1. Por qué

La hoja «Añadir etapas» del planificador (`DragSheet` en `StagePlannerScreen`) mete
en un panel tres pasos, una lista de acordeones con tres steppers cada uno y un
segmentado de alcance. Funciona, pero de primeras no se entiende de qué etapa se
parte, qué cambia ni cuánto, y no se ve el resultado: solo «+1 serie · −3 reps».
El usuario pidió que tenga **pantalla propia**, que se vea bien **de dónde partes y
qué añades**, que sea más elegante y que crear una etapa se sienta **más
interactivo**. Y pensar qué otras herramientas de periodización tienen sentido (§5).

La vista previa puede ser **exacta**: `applyRx` es pura y es lo mismo que ejecuta
`addStageLadder` al guardar. Hoy no se usa para enseñar nada.

### 1.1 Lo que ya fija P14 (el editor)

- **Un solo creador.** Las dos entradas del editor —la pestaña «+ nueva» al final
  de las pestañas y «Nueva etapa desde esta» en Ajustes— abren **el mismo creador**,
  con la etapa seleccionada como base. **Duplicar deja de ser un botón**: es crear
  con «Igual». Mientras este creador no exista, P14 manda al planificador de hoy
  (P14 §5.5).
- Con una sola etapa, el editor enseña «Añadir etapas», que también abre este
  creador.
- La hoja de Ajustes de una etapa es una sola (`StageSettingsSheet`, P14); el
  planificador debería usar la misma en vez del acordeón de `StageCard` (§4).

## 2. Lo que no cambia (modelo)

Nada del store. Todo es UI sobre lo que ya existe:

- Una etapa se crea aplicando una regla `rx` a la etapa **base** y materializándola
  (`applyRx`, `addStageLadder`). Deltas absolutos contra la base (P06 §2.4).
- **Todo se añade al final**, nunca en medio (P06 §14.2.2).
- `incrementScale` y `progressionHold` no se exponen como mandos (P06 §14.2.5-6).
- El planificador no usa métricas del cliente (P06 §2.8). El aviso de §3.6 es de
  estructura, no de métricas.

## 3. Añadir etapas — pantalla propia

Maqueta [`stages-v2.html`](../mockups/stages-v2.html) §2. `AddStagesScreen`, apilada, con cabecera de editor y botón al pie.
Sustituye a la `DragSheet` de `StagePlannerScreen`.

**Entradas:** la pestaña «+ nueva», «Nueva etapa desde esta» en Ajustes y «Añadir etapas» con una sola etapa, todas del editor (P14; base = etapa seleccionada) y el hueco «+ Añadir
etapas» del plan (base = `baseStageIdx`, la de hoy). Desde la ficha de cliente,
por ruta con `programId`, como el plan.

### 3.1 Arriba, siempre: la ola y la comparación

1. **La ola** (U10-07/08): semanas en x, área gris = series por semana, línea lima
   = intensidad estimada, una banda por etapa. Lo que ya hay, atenuado; una raya
   «NUEVAS» y lo que se añade con banda discontinua. Tocar una banda nueva la
   selecciona. Cambia al momento con cualquier mando.
2. **De dónde partes → lo que añades**: dos cajas («Parte de: 2 · Acumulación ▾»,
   tocable para cambiar la base · «Nueva: 3 · Intensificación») y cinco filas con
   antes → después y la diferencia:

   | Fila | De dónde sale |
   |---|---|
   | Series / semana | `stageVolume().sets` |
   | Reps en básicos | media de `minReps`-`maxReps` de los `isKey` |
   | Intensidad estimada | la métrica de U10 §8.2 (**por cerrar**, §7.4) |
   | Descanso medio | media de `restSec` |
   | Por sesión | `sessionStats().minutes`, media de las sesiones |

   Interruptor **Con la base / Con la anterior**: la regla se mide contra la base,
   pero lo que el entrenador espera ver muchas veces es el salto desde la etapa de
   justo antes. Las dos salen de aplicar la regla, así que las dos son exactas.

Antes de elegir nada, en lugar de la comparación: «Lo que añadas aparecerá a la
derecha de la raya, detrás de las N etapas que ya tiene el programa».

### 3.2 Vacía: ¿una etapa o un bloque?

Tarjeta «¿Qué añades?» con dos grupos:

- **Una etapa**: cuatro caracteres con icono — Volumen (+1 serie), Intensidad (−3
  reps en básicos, +25 % descanso), Igual (copia), Descarga (−1 serie, sin
  progresión, 1 semana).
- **Un bloque entero**: las escaleras de `stageRx.js` (Lineal, Intensificación,
  Accesorios) y dos nuevas (§5, Ondulante y Hacia un pico), cada una con su
  silueta en miniatura (alto = series, lima = sube intensidad, azul = descarga) y
  sus semanas.

### 3.3 La cola

Pastillas en fila, numeradas siguiendo al plan (3, 4, 5…), con nombre y semanas.
La seleccionada con borde lima; la descarga con número azul. `+` al final abre
el mismo «¿Qué añades?» como hoja. Encabezado «SE AÑADEN · 3 ETAPAS · 8 SEM».

### 3.4 La etapa seleccionada

- Nombre (editable) y **semanas** con stepper — se revisa P06 §14.2.7: la ola y el
  total del botón dependen de ellas.
- Las cuatro tarjetas de carácter: pulsar una resetea la regla a ese carácter.
- **El mando** (§3.5) o, alternativa sobria, deslizadores de series y reps.
- Aplicar a (Todo · Básicos · Accesorios) y Descanso (−50…+100 %, paso 5), como hoy.
- En una descarga, la línea fija «Sin progresión mientras dure».
- «Quitar esta etapa» en rojo, separado.

### 3.5 El mando 2D

Un cuadro con un punto que se arrastra. **Arriba = más series** (`setsDelta`
−3…+3), **derecha = más intensidad** (`repsShift` +3…−6). La base es un aro
blanco en (0, 0) y una línea discontinua une la base con el punto.

- **Imán** en cada casilla (una serie, una rep) y un toque de `expo-haptics` al
  cambiar de casilla.
- Los cuatro cuadrantes llevan nombre y se iluminan: Acumulación (↑), Sobrecarga
  (↑→), Realización (↓→), Mantenimiento (↓). El **nombre de la etapa sigue al
  cuadrante** hasta que el entrenador lo escribe a mano.
- Mover solo hacia intensidad pone el alcance en Básicos (como el preset de hoy)
  mientras el alcance no se haya tocado a mano.
- Debajo, la regla en texto (`describeRx`).

Es la parte «de juego» de la pantalla; las otras son cifras que ruedan al cambiar
(mismo gesto que U10-01) y la ola que se deforma. Nada de puntos, medallas ni
rachas.

### 3.6 Debajo: grupos musculares, ejercicios y un aviso

- **Series por semana y grupo**: una barra por grupo (`muscleGroupOf`) contra la
  franja 10-20 de `SETS_TARGET_MIN/MAX`; raya blanca = base, barra = etapa nueva;
  gris por debajo de 10, rojo por encima de 20. Función pura nueva sobre los
  `sessionTemplates` de una etapa (la de `trainingLoad.js` lee el log).
- **Así queda**: pestañas A/B/C y, por ejercicio, lo de antes tachado y lo nuevo
  con lo que cambia en lima (`4×5-8 · 3:00` → `5×2-5 · 3:45`). Es lo que más
  confianza da, y ya enseña cosas: en la maqueta, Intensificación sobre un programa
  de fuerza deja los básicos en 2-5, cosa que hoy nadie ve hasta abrir la sesión.
- **Aviso** (una sola regla): más de 8 semanas de trabajo seguidas sin descarga,
  contando el plan y la cola ⇒ franja azul «N semanas de trabajo seguidas sin
  descarga · + Descarga», un toque.

### 3.7 Al pie y al añadir

Botón lima «AÑADIR 3 ETAPAS · 8 SEM» (sin cola, no hay botón). Al pulsar: las
pastillas saltan, la ola pasa de discontinua a sólida, toast «+3 etapas en el
plan» y vuelta a donde se estaba, con la primera etapa nueva seleccionada en la
tira.

Salir con cola sin guardar pide confirmación (`showDialog`).

## 4. El plan (`StagePlannerScreen`)

Se queda como el sitio donde se **mira** la periodización entera: resumen, la ola
de U10-07 arriba y la línea de etapas. Cambia poco:

- Tocar una etapa abre `StageSettingsSheet` (P14 §5.5) en vez del acordeón.
- El hueco «+ Añadir etapas» navega a `AddStagesScreen`.
- Fuera la `DragSheet`, `RungCard` y `Dropdown`.

## 5. Más herramientas de periodización

Maqueta [`stages-v2.html`](../mockups/stages-v2.html) §3. Ordenadas por valor frente a coste. Ninguna es parte de esta spec:
son candidatas a tareas o specs propias.

| Herramienta | Valor | Coste | Cómo encaja |
|---|---|---|---|
| **Esfuerzo como palanca** (`rpeShift`: RPE 7 → 8 → 9 por etapa) | alto | bajo | Un campo más en `rx` que `applyRx` materializa en `targetRpe` de los ejercicios Por esfuerzo. Es la progresión de hipertrofia más usada y hoy no se puede expresar. En el mando sería un tercer control |
| **Series por grupo en el plan** | alto | bajo | La función de §3.6, también como fila plegable en la ficha |
| **Bloques guardados** | alto | bajo | «Guardar esta cola como bloque»: listas `{ kind, weeks, rx }`, lo que ya come `addStageLadder`. Se guardan en el perfil y salen en «Un bloque entero» |
| **Ondulante** y **Hacia un pico** | medio | bajo | Solo datos en `buildRungs` |
| **Planificar hacia una fecha** (competición, test) | alto | medio | Fecha objetivo en el programa; con «semana 1 = lunes más cercano» (P08) se reparten las semanas del bloque para que el pico caiga ahí. Nada se reprograma solo |
| **Sustituir ejercicios en la etapa nueva** | alto | medio | Paso opcional tras añadir, con las variantes de P09. Fuera de `rx` (P07 §1.1): es edición a mano de la etapa ya materializada |
| **Propuesta de etapa** ([P07](P07-stage-proposal.md)) | alto | alto | Esta pantalla es justo el «prellenado» que P07 §8.2 necesitaba: la cola llega rellena con una línea de por qué |
| **Semana de test** (AMRAP/1RM en básicos) | medio | alto | `rx` no sabe decir «una serie al máximo»: kind nuevo |
| **Ondas dentro de la etapa** (3:1) | medio | alto | Choca con «una etapa = la misma semana repetida». Hoy se consigue con etapas de 1 semana, y la tira las dibuja bien. **No lo haría** |

Recomendación: `rpeShift`, series por grupo y bloques guardados son las tres de
coste bajo que más cambian cómo se periodiza; la fecha objetivo es la primera
mediana.

## 6. Decisiones abiertas

De la primera ronda (9-oct), sin tocar todavía:

1. **Mando**: 2D o deslizadores (§3.5). Propuesta: 2D, con QA en el móvil antes de
   cerrar — si el dedo tapa el punto en 214 dp de alto, deslizadores.
2. **Semanas al añadir**: revisar P06 §14.2.7 (propuesta: sí, §3.4).
3. **Intensidad estimada**: la métrica de U10 §8.2 (%1RM con `weightForReps`) sigue
   sin validar con la semilla. Sin ella, la ola solo tiene el área y la fila de
   intensidad sale de la comparación. Propuesta: validarla como primera tarea.
4. **Base por defecto desde el plan**: hoy la última etapa sin regla. ¿O la última,
   a secas? (Desde el editor ya está decidido: la seleccionada.)
5. **Bloques nuevos**: ¿Ondulante y Hacia un pico entran ya (§5, coste bajo)?
6. **Duplicar dentro del creador** (P14): cómo se ve «Igual» para que duplicar sea
   un toque y no una búsqueda.
7. **El visualizador** (`ProgramDetailScreen`) sigue con `StageSelector`: ¿pasa a
   las pestañas de P14 (sin «+» ni Ajustes)?

## 7. Tareas previstas (se escriben al cerrar §6)

| Tarea | Alcance | Coste | Depende de |
|---|---|---|---|
| Métrica de intensidad | `utils/stageWave.js` + tests + validación con la semilla (U10 §8.2) | 🟡 | — |
| Pantalla del creador | `AddStagesScreen`: comparación, cola, «¿Qué añades?», ficha de etapa con deslizadores, «Así queda», botón; fuera la `DragSheet` del plan | 🔴 | — |
| Mando 2D | gesto (gesture-handler + Reanimated), imán, haptics, cuadrantes y nombre | 🟡 | Pantalla del creador |
| La ola | en el creador y en el plan (absorbe U10-07 y U10-08) | 🟡 | Métrica, Pantalla del creador |
| Grupos musculares y aviso | reusa la función de series por grupo de P14; aviso de descarga | 🟢 | Pantalla del creador |
| Plan con la hoja única | `StagePlannerScreen` abre `StageSettingsSheet` de P14; fuera el acordeón | 🟢 | P14 |

i18n en `es.json` y `en.json` en cada tarea.
