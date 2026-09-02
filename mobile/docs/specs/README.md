# Specs y roadmap de features

Índice del estado de las features grandes. Cada spec es autocontenida para que
cualquier implementador (humano o LLM) pueda ejecutarla sin la conversación
original. Reglas transversales en `mobile/AGENTS.md` + memoria del proyecto.

## Auditoría de corrección

| Spec | Estado | Coste | Nota |
|---|---|---|---|
| [auditoria-tecnica.md](auditoria-tecnica.md) — Auditoría técnica (ago 2026) | diagnóstico cerrado. 26 fallos: 3 críticos · 7 altos · 8 medios · 8 bajos — **15 resueltos**, 11 pendientes de **26**, ninguno crítico. El fallo 26 (`claim_trainer_slots` regalaba los clientes de otro entrenador) está **cerrado**: SQL desplegado ago-2026 | 🟡 | No es una feature: es corrección. La **tanda A** ([§27](auditoria-tecnica.md#27-orden-de-trabajo-sugerido)) va antes de publicar — un fallo al rehidratar AsyncStorage deja la app en pantalla negra sin recuperación, y restaurar un backup completo pierde todos los programas de clientes. La tanda B arregla que la copia programada a Drive nunca se ejecute; la D, que en iOS todo el mundo sea Pro |

| [client-connection.md](client-connection.md) — Conexión entrenador ↔ cliente | **app implementada, SQL DESPLEGADO** (ago 2026); falta prueba en dispositivo. Rediseño de los fallos 5, 7, 8 y 26 de la auditoría | 🟠 | La autorización se decidía en cuatro funciones con cuatro criterios, y dos ni estaban en el repo. Una regla única: *nadie se concede a sí mismo un asiento que otro ocupa*. Mapa completo de escenarios de (re)conexión. **El SQL de `supabase/connection_model.sql` y los cambios de la app se despliegan JUNTOS**: `get_slot_by_code` cambia de firma |

| [rediseno.md](rediseno.md) — Rediseño estructural (sep 2026) | spec cerrada, SIN implementar. 4 fases: 1 borrar la app web · 2 sacar la sesión del blob · 3 recortes antes de publicar · 4 Workout y publicar | 🟢/🟡 | No es corrección de fallos: es de **estructura**. Las fases 1 y 2 no tocan ni una pantalla ni un comportamiento. La 1 borra ~9.800 líneas de app web congelada desde may-2026 con su copia del store, y trae `src/utils|data|locales` dentro de `mobile/`. La 2 arregla que **cada tecla del campo de peso serialice el estado entero** (megabytes para un entrenador con clientes): zustand escribe en cada `set()` sin comparar, así que sacar `activeSession` del `partialize` **no basta** — hacen falta las dos mitades |

| [program-model.md](program-model.md) — Modelo de programas (sep 2026) | spec cerrada, SIN implementar. 3 fases independientes: 1 `owner`+`kind` · 2 un diccionario de sesiones · 3 sin espejo `days` | 🟡 | Sale del §6.1 de [rediseno.md](rediseno.md); **ésta sí toca pantallas**. "De quién es este programa" está escrito hoy en **cuatro sitios** que nadie obliga a estar de acuerdo, y el invariante lo sostiene quien lee: un filtro de UI es lo único que impide que `restoreProgram` le robe el programa a un cliente. La fase 1 cierra además una fuga real — `deleteProgram` y `deleteClient` **no borran las sesiones** (`removeSessionFromProgram` sí), así que cada borrado deja `tpl_*` huérfanos para siempre en el estado y en cada `.fitdata`. Lleva mapa de migración completo y sube el fichero a `version: '3'` |

## Specs listas para implementar

| Spec | Estado | Coste | Nota |
|---|---|---|---|
| [training-load.md](training-load.md) — Carga de entrenamiento | fases 1-5 implementadas + tira de strain (captura, `trainingLoad.js`, vista Carga, esfuerzo vs carga, rendimiento, series por grupo, strain semanal); fase 6 APARCADA | 🟡 | fase 6 (objetivos por etapa) parada: las etapas no guardan fecha de inicio y hay dos definiciones de "semana" en conflicto — ver cabecera de la spec. `npm run seed` genera historial de prueba |
| [metric-transparency.md](metric-transparency.md) — Ver la fórmula de cada dato | fases 1 y 2 implementadas (26 fichas + 5 gráficos documentados, apartado en Documentación y hoja al tocar el dato) | 🟢 | fase 3 (Workout, Recap, historial, adherencia) pendiente de decidir si merece la pena |
| [program-generator.md](program-generator.md) — Generador de programas | fases A+B implementadas (`606ccdf`, `eff1666`); **fase C sustituida** por program-templates.md | 🔴 | histórico del diagnóstico y de la cirugía A+B. Su §6.1 (plantillas escritas + decisiones de diseño) sigue vivo |
| [program-templates.md](program-templates.md) — Programas por plantilla flexible | **fases 1-5 implementadas** (resolvedor de slots, escalera de compresión, sesiones cortas, volumen semanal, vinculado automático, fases y duración, matcher por ranking); pendientes: 6 onboarding de propuestas · 7 reglas de integridad · 8 catálogo | 🟡/🔴 | el onboarding **propone programas** en vez de fabricarlos: 4 preguntas → 3 candidatos con su duración y su coste de adaptación → 2 preguntas. **Adaptar sí, planificar no**: el eje "días" se resuelve eligiendo otra plantilla (el modelo es de ciclos rotativos, no de semanas), nunca reorganizando la elegida — un solver acabaría siendo el generador procedural otra vez. Con las fases 1-5 dentro, **528/528 combos reciben una plantilla adaptada** (antes 60) con duración y fases reales. **La 8 pasa a ser la urgente**: el ranking destapó que sin plantilla de 5-7 días esos usuarios reciben demasiado volumen semanal — PPL-6 lo cierra |
| [onboarding-proposals.md](onboarding-proposals.md) — Onboarding de propuestas | **implementada** (ago 2026). Es la **fase 6** de program-templates, extraída a documento propio. Su UI la **sustituye** [onboarding-simple.md](onboarding-simple.md) | 🟢 | La única fase con UI: el onboarding pasó de 8 preguntas y un programa impuesto a **3 preguntas → 3 programas reales a elegir → 3 pasos de ajuste en vivo**. Sigue siendo la referencia del motor y de los datos (formas exactas de `rankArchetypes` y `adaptArchetype`, por qué el material no ordena el ranking). Lo que quedó terrible es el recorrido: 9-10 pantallas y la mitad avisando de recortes |
| [onboarding-simple.md](onboarding-simple.md) — Onboarding simple (3 preguntas) | **revisión 2 implementada** (ago 2026), pendiente de prueba en dispositivo. La revisión 1 se implementó y el QA la rechazó: el recorrido bien, la UI no se parecía a la app | 🟡 | **Tres preguntas y tres portadas**: nivel → qué buscas → días → propuestas → tu programa. Tiempo, material y limitaciones dejan de preguntarse: son **una fila que abre una hoja** con tres secciones, y el programa de debajo se repinta al tocarlas. La causa del rechazo, medida: `OptionCard`, `OnboardingStep` y `OnboardingProgress` eran **puertos literales del onboarding web** que no se usan en ninguna otra pantalla — **se borran**, y cada pieza nueva se cita con fichero y línea de la pantalla migrada de la que se copia. Lleva **dos cambios de motor**: `reduceForBeginner` pasa a reportar lo que quita, y el recorte por tiempo se calcula con nombres. Mockup aprobado. Sólo móvil |
| [client-triage.md](client-triage.md) — Triaje de clientes (P3) | spec cerrada, SIN implementar (ago 2026). 2 fases: 1 "bloque terminado" · 2 "estancado" | 🟢/🟡 | DOS banderas, alcance cerrado — el resto están descartadas con motivo en §5. El mecanismo de pills ya existe en `ClientsScreen`; esto cuelga dos de él. La bandera 1 cierra el bucle con el planificador: avisa de que un bloque acabó, así no hay que programar todas las etapas por adelantado |
| [stage-planner.md](stage-planner.md) — Planificador de etapas | **fases 0-4 implementadas** (ago 2026); fase 5 (recap consciente de la descarga) pendiente | 🟡 | la etapa pasa de ser una copia a ser una regla. Vacía buena parte de la fase C del generador: 1 arquetipo × escalera = programa periodizado |
| [program-view.md](program-view.md) — Visualizador de programa | **fases 1-3 implementadas** (ago 2026); fase 4 (export a PDF) pendiente de decisión | 🟢 | la pantalla "Ver programa" estaba en el modelo de datos de mayo: no enseñaba bloques, superseries, dropsets, calentamiento ni etapas. Ahora es un visualizador (no un tracker): resumen del programa, selector de etapas y volumen por grupo y ciclo contra la etapa 1 |
| [stage-proposal.md](stage-proposal.md) — Propuesta de etapa (P4) | spec cerrada, SIN implementar (ago 2026). 5 fases: 1 ventana de etapa · 2 estado del cliente · 3 reglas · 4 prellenado del planificador · 5 entradas y cool-down | 🟡 | cierra el bucle: el planificador se abre **prellenado** desde las métricas en vez de vacío. **Un cliente vinculado nunca recibe propuesta** — es trabajo del entrenador. Ninguna regla lee `stage.rx`: el carácter de la etapa se mide. Sus fases 1-2 desatascan la fase 6 de training-load y entregan la bandera "Estancado" del triaje |
| [bulk-edit.md](bulk-edit.md) — Editor masivo + sustitución | spec cerrada, SIN implementar (ago 2026). 3 fases: 1 editor de parámetros · 2 sustitución masiva · 3 campo progresión | 🟡 | lo que un entrenador hace en Excel arrastrando una columna. **Un solo editor**: sesión/etapa es un parámetro cambiable dentro, no dos pantallas. Barata porque `SessionEditorScreen` solo se alcanza desde el editor de programa, y de ahí hereda deshacer y `markProgramDirtyForClients` (§3.1). NO es un `rx`: el absoluto es asignación, no delta |

## Implementadas (en testeo en dispositivo, julio 2026)

| Spec | Estado |
|---|---|
| [strength-blocks.md](strength-blocks.md) — Dropset + Superserie | implementada (`92ab414`) |
| [conditioning-blocks.md](conditioning-blocks.md) — AMRAP/EMOM/For time | implementada, 4 fases + fix rondas EMOM + resumen en editor (`a15ee07`) |
| [warmup-sets.md](warmup-sets.md) — Series de calentamiento | implementada, 3 fases (`45a74ee` utils, `f04a254` editor, `8d7d187` workout) |
| Gestión del historial (sin spec propia) | implementada ago-2026: `logMode` merge/replace al importar + menú "···" en Historial con borrado en bloque (todo / ajeno al programa activo). Detalle abajo |

### Gestión del historial — desglose

Antes solo se podía borrar sesión a sesión. Tres piezas:

1. **`sections.logMode`** (`'merge' | 'replace'`) en `importData`. Sin él,
   reimportar un backup corregido NO actualizaba nada: la fusión deduplica por
   id y daba por buena la copia vieja. Simétrico al `templatesMode` que ya
   existía; el selector de `ImportModal` se extrajo a `ModeSectionRow` y ahora lo
   comparten historial y plantillas en vez de estar duplicado.
2. **`clearWorkoutLog(scope)`** en el store: `'all'` y `'off_program'`. Las
   sesiones libres (`__free__`) cuentan como ajenas al programa — es justo lo que
   se quiere limpiar (pruebas, semillas, sueltas). **Sin programa activo no borra
   nada**: sería un borrado total por sorpresa. Devuelve cuántas borró, para el
   toast.
3. **Menú "···" en `HistoryScreen`** con `DragSheet` (patrón unificado), junto al
   selector de ámbito. Confirmación nativa que dice **cuántas** sesiones se van
   —contadas antes— y recuerda exportar.

Trampa pisada: declarar el manejador antes de los `useMemo` que captura hace que
el compilador de React abandone la memoización de la pantalla entera (+1 error de
lint). Va después de `programTemplateIds`/`effectiveTemplateIds`.

## Aparcado (decisión de producto pendiente, NO implementar)

- ~~**Volumen semanal por patrón**~~ — **REVIVIDO** como fase 5 de
  [training-load.md](training-load.md): pasa a ser series por GRUPO MUSCULAR
  (no por patrón) dentro de la vista Carga, con rango de referencia 10-20.
  Aprobado por el usuario sobre mockup (jul 2026).
- **Aviso de balance de patrones**: descartado a nivel sesión (un día Push sin
  pierna es por diseño); como idea futura, a nivel programa/semana.

## Pendientes menores (sin spec, definir al arrancar)

- Chip "PR" en vivo en el workout al marcar serie (la lógica ya existe en
  `src/utils/sessionRecap.js` → `detectPRs`; es solo UI en SetRow/ExerciseCard).
- Prescripción por %1RM (base e1RM ya existe en `src/utils/oneRm.js`).
- Unificar modelo de guardado (autosave del editor de ejercicio vs botón Guardar
  + snapshot del editor de programa) — decisión de producto.
- Swipe en bordes de SessionEditorScreen como atajo para cambiar de sesión
  (los chips ya cubren la función; `switchSession` ya existe).

## Futuro ligado al restyle (Figma del usuario, "FormaFit")

- Fase de fuentes de los themes (`th.fonts` es placeholder) + theme Sharp.
- Migración de emojis a SVG (tabs del detalle de cliente, botón notas del workout).
- Barrido de i18n hardcodeado restante en ClientsScreen.
- Revisar contraste del header del theme Earthy.

## Explícitamente descartado

- Rep-schemes variables (21-15-9, escaleras, chippers) — fuera hasta después de
  los bloques de acondicionamiento.
- Streaks/rachas tipo Duolingo — contrario a la filosofía de "información justa".
- Granularizar las series de trabajo (editor por-serie) — solo si algún día se
  hacen pirámides/top-set como feature propia.
