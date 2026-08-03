# Specs y roadmap de features

Índice del estado de las features grandes. Cada spec es autocontenida para que
cualquier implementador (humano o LLM) pueda ejecutarla sin la conversación
original. Reglas transversales en `mobile/AGENTS.md` + memoria del proyecto.

## Specs listas para implementar

| Spec | Estado | Coste | Nota |
|---|---|---|---|
| [training-load.md](training-load.md) — Carga de entrenamiento | fases 1-5 implementadas + tira de strain (captura, `trainingLoad.js`, vista Carga, esfuerzo vs carga, rendimiento, series por grupo, strain semanal); fase 6 APARCADA | 🟡 | fase 6 (objetivos por etapa) parada: las etapas no guardan fecha de inicio y hay dos definiciones de "semana" en conflicto — ver cabecera de la spec. `npm run seed` genera historial de prueba |
| [metric-transparency.md](metric-transparency.md) — Ver la fórmula de cada dato | fases 1 y 2 implementadas (26 fichas + 5 gráficos documentados, apartado en Documentación y hoja al tocar el dato) | 🟢 | fase 3 (Workout, Recap, historial, adherencia) pendiente de decidir si merece la pena |
| [program-generator.md](program-generator.md) — Generador de programas | fases A+B implementadas (`606ccdf`, `eff1666`); fase C EN PAUSA (4/~10-12 plantillas, ver §6.2) | 🔴 | contenido de plantillas (fase C) = Fable+usuario; onboarding "muy extenso", pendiente decidir si simplificar antes de seguir |
| [client-triage.md](client-triage.md) — Triaje de clientes (P3) | spec cerrada, SIN implementar (ago 2026). 2 fases: 1 "bloque terminado" · 2 "estancado" | 🟢/🟡 | DOS banderas, alcance cerrado — el resto están descartadas con motivo en §5. El mecanismo de pills ya existe en `ClientsScreen`; esto cuelga dos de él. La bandera 1 cierra el bucle con el planificador: avisa de que un bloque acabó, así no hay que programar todas las etapas por adelantado |
| [stage-planner.md](stage-planner.md) — Planificador de etapas | spec cerrada, SIN implementar (ago 2026). 5 fases: 0 unificar modelo · 1 `applyRx`+cadena · 2 pill KEY · 3 chip de descarga · 4 planificador | 🟡 | la etapa pasa de ser una copia a ser una regla. **Arrastra un bug vivo**: cambiar de etapa borra hoy la referencia de pesos del cliente (§4.1). Vacía buena parte de la fase C del generador: 1 arquetipo × escalera = programa periodizado |

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
