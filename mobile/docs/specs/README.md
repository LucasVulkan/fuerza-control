# Specs y roadmap de features

Índice del estado de las features grandes. Cada spec es autocontenida para que
cualquier implementador (humano o LLM) pueda ejecutarla sin la conversación
original. Reglas transversales en `mobile/AGENTS.md` + memoria del proyecto.

## Specs listas para implementar

| Spec | Estado | Coste | Nota |
|---|---|---|---|
| [training-load.md](training-load.md) — Carga de entrenamiento | fases 1 y 2 implementadas (captura en el recap + `src/utils/trainingLoad.js`); fases 3-6 listas para ejecutar | 🟡 | siguiente = fase 3 (vista Carga). La fase 4 necesita 4+ semanas de sRPE real antes de tener sentido |
| [metric-transparency.md](metric-transparency.md) — Ver la fórmula de cada dato | sin empezar | 🟢 | transversal (métricas viejas y nuevas). La fase 1 (registro i18n + apartado en `DocsScreen`) cubre todas las métricas sin tocar ninguna pantalla de datos |
| [program-generator.md](program-generator.md) — Generador de programas | fases A+B implementadas (`606ccdf`, `eff1666`); fase C EN PAUSA (4/~10-12 plantillas, ver §6.2) | 🔴 | contenido de plantillas (fase C) = Fable+usuario; onboarding "muy extenso", pendiente decidir si simplificar antes de seguir |

## Implementadas (en testeo en dispositivo, julio 2026)

| Spec | Estado |
|---|---|
| [strength-blocks.md](strength-blocks.md) — Dropset + Superserie | implementada (`92ab414`) |
| [conditioning-blocks.md](conditioning-blocks.md) — AMRAP/EMOM/For time | implementada, 4 fases + fix rondas EMOM + resumen en editor (`a15ee07`) |
| [warmup-sets.md](warmup-sets.md) — Series de calentamiento | implementada, 3 fases (`45a74ee` utils, `f04a254` editor, `8d7d187` workout) |

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
