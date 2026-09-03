# Spec — Visualizador de programa

> Tema: programas
> En corto: La pantalla que enseña QUÉ es el programa —sesiones, ejercicios, volumen por grupo— sin mezclarlo con en qué semana va el atleta.
> Fase P20 · hecho · La sesión deja de mentir: superserie, dropset, calentamiento, bloques
> Fase P21 · hecho · Cabecera y selector: resumen, autoría, chips de etapa
> Fase P22 · hecho · Volumen y diff: `plannedSetsByGroup`, `stageDiff` y tarjeta de barras
> Fase P23 · pendiente · Export a PDF — decisión de producto, pediría `expo-print`
>
> Estado: **fases 1-3 implementadas** (ago 2026); fase 4 (export a PDF)
> pendiente de decisión de producto. Origen: conversación
> Opus + usuario sobre `ProgramDetailScreen`, que había quedado desactualizada.
> Mockups aprobados sobre esquema (no sobre Figma: la fidelidad se extrae al
> implementar, ver `mobile/AGENTS.md`).
>
> Es un **visualizador**, no un tracker. No muestra en qué etapa va el atleta,
> ni la semana en curso, ni el progreso. Muestra **qué es el programa**.

---

## 1. Problema

[`ProgramDetailScreen`](../../src/screens/ProgramDetailScreen.jsx) es un port de
la vista de impresión web (`ProgramPrintView`, parada desde mayo 2026) y se
quedó en el modelo de datos de entonces. Hoy no enseña:

| Qué | Dónde vive | Qué pasa hoy |
|---|---|---|
| Bloques de acondicionamiento | `template.blocks` | una sesión que sea solo AMRAP+EMOM sale vacía |
| Superseries | `exConfig.supersetWithNext` | lista plana, no se ve el encadenado |
| Dropsets | `exConfig.dropset` | invisible |
| Series de calentamiento | `exConfig.warmup` | invisible |
| Orden real | `sessionSlots()` | los bloques no se ordenan con los ejercicios |
| Etapas | `program.stages` | solo pinta `program.days` (espejo de la activa) |
| Prescripción | `exConfig` ?? `def` | lee solo `exConfig`, así que muchas filas salen "3 series" a secas |

Además tiene strings en español a pelo ("series", "descanso", "Sin ejercicios
configurados") — i18n es obligatoria en las dos lenguas.

## 2. Decisiones cerradas con el usuario (no re-litigar)

1. **La cabecera lleva el resumen del programa, no el estado actual.** Etapas,
   ciclos y sesiones. Nada de "etapa 2 de 4 · semana 3".
2. **Nombre del entrenador en la cabecera** cuando lo hay.
3. **El selector de etapas se queda.** Al tocar una etapa cambian el gráfico de
   volumen y las sesiones. No cambia la etapa activa del programa: es una vista.
4. **Todo se compara contra la etapa 1**, no contra la anterior. Es además
   contra la que `applyRx` deriva los peldaños ([stage-planner.md](stage-planner.md) §2.4).
   Con la etapa 1 seleccionada no hay marca, ni delta, ni línea de cambios.
5. **El subtítulo de etapa NO puede salir de `rx`.** La regla se materializa y
   la etapa se edita a mano después ([stage-planner.md](stage-planner.md) §1), así que `rx`
   miente en cuanto alguien toca un ejercicio. Sale de un diff real de
   ejercicios, series y bloques. Sin cambios detectados, no se pone nada.
6. **Todas las sesiones desplegadas**, siempre. No hay plegado.
7. **Nada de tiempo estimado por ciclo.** Por sesión sí (series y minutos).
8. Se lee **como documento**: no hace falta ceñirse a los componentes de la
   app, pero sí al tema (accent, tarjetas, colores de día).

## 3. Estructura

Cuatro zonas, una sola pantalla, un solo scroll.

```
┌ cabecera ───────────────────────────────┐
│ PROGRAMA / nombre / "Programa de X"     │
│ 04 ETAPAS   12 CICLOS   04 SESIONES     │
├ selector de etapas ─────────────────────┤
│ [ Base ][ Volumen ][ Intens. ][ Desc. ] │
│ Frente a Base · +6 series · 2 nuevos    │
├ tarjeta de volumen ─────────────────────┤
│ SERIES POR GRUPO Y CICLO      ▏etapa 1  │
│ Pecho     ████████▏░░░   18 +4          │
├ tarjetas de sesión (todas abiertas) ────┤
│ A  Empuje                16 series 55'  │
│    Press banca CLAVE          4 × 6–8   │
│    │ SUPERSERIE · 3 RONDAS · 90 S       │
│    ┌ AMRAP · 12 min ──────────────────┐ │
└─────────────────────────────────────────┘
```

### 3.1 Cabecera

- Barra accent con flecha atrás, eyebrow y nombre del programa — mismo patrón
  que [`StagePlannerScreen`](../../src/screens/StagePlannerScreen.jsx), que es
  su pantalla hermana.
- Línea de autoría, **solo si aplica**:
  - copia del cliente (`clientSync.trainerName` y el programa vino del
    entrenador) → "Programa de {nombre}";
  - copia del entrenador (`program.clientId`) → "Para {nombre del cliente}";
  - programa propio → nada.
- Tres cifras en accent: **etapas** (`stages.length`), **ciclos** (Σ
  `durationWeeks`; si alguna es `null`, "sin límite") y **sesiones** de la
  etapa seleccionada (pueden variar entre etapas).

### 3.2 Selector de etapas

Fila horizontal scrollable, un chip por etapa: nombre + ciclos ("4 c." / "∞").
Seleccionado en accent. **Con una sola etapa no se pinta** — un selector de un
elemento es ruido. Debajo, la línea de cambios (§4.2) cuando el índice > 0.

### 3.3 Tarjeta de volumen

Una barra por grupo muscular, ordenadas de más a menos series **de la etapa
seleccionada**. Mismo lenguaje visual que las barras de `LoadTab` (carril
`surface2`, relleno accent, marcas del rango 10–20), más dos cosas propias:

- **Marca de la etapa 1**: línea vertical clara en el valor de la etapa 1.
- **Delta**: `+4` / `−2` junto al número, en accent (o `mutedLight` si es 0).

La escala es `max(SETS_SCALE_MIN, máximo entre la etapa mirada y la etapa 1)`,
para que la marca nunca se salga del carril. Un grupo fuera del rango 10–20 se
pinta en naranja, igual que en `LoadTab` (nunca rojo, ver `UI-MIGRATION.md` §4.9).

Pie: la referencia 10–20 es **semanal**, y aquí se cuenta por **ciclo**. Si
alguien hace 2 ciclos por semana, la referencia no aplica tal cual. La nota lo
dice; no se intenta adivinar la frecuencia.

### 3.4 Tarjetas de sesión

Una tarjeta por sesión de la etapa seleccionada, **todas desplegadas**:

- Cabecera: letra en el color del día (`day1..day6` del tema), nombre, énfasis,
  y a la derecha series y minutos (`sessionStats`).
- Cuerpo: los huecos de `sessionSlots(template)` en su orden real.

| Hueco | Render |
|---|---|
| Ejercicio | nombre + badge CLAVE si `isKey`; bajo el nombre, "N series de calentamiento" si `warmup` y "última serie con dropset" si `dropset`; a la derecha `S × R` en accent y el descanso debajo |
| Superserie | filete accent a la izquierda, cabecera "SUPERSERIE · N RONDAS · X S" (rondas = series del primer miembro; descanso = el del último, que es quien dispara el timer, ver [strength-blocks.md](strength-blocks.md) §2) y los miembros dentro sin su propio descanso |
| Bloque | tarjeta interior en `surface2`, formato en azul + meta del reloj, y los movimientos en una línea (`cantidad unidad · peso`) + nota si la hay |

La prescripción va **alineada a la derecha en columna propia**: es lo que hace
que la sesión se pueda barrer en vertical.

## 4. Utilidades nuevas

### 4.1 `plannedSetsByGroup(templates, allExercises)` — `src/utils/trainingLoad.js`

Vecina de `setsByMuscleGroup` a propósito: son la misma métrica, una prescrita
y otra realizada, y si las reglas de atribución divergen la comparación entre
pantallas deja de valer. Mismas reglas, todas ya justificadas ahí:

- atribución por `primaryGroup` (volumen **directo**, no reparte a sinergistas);
- `primaryGroup: 'custom'` o ejercicio borrado → `'other'`;
- **el dropset no suma serie** (es intensificación de la última, no una serie más);
- el calentamiento no cuenta (no es volumen de trabajo);
- los bloques de acondicionamiento no cuentan (no tienen series ni grupo).

Entra un array de plantillas ya resueltas (`getEffectiveTemplate`), no `days`:
la pantalla ya las resuelve para pintarlas y la función se testea sin store.
Devuelve `[{ group, sets }]` de más a menos.

### 4.2 `stageDiff(fromTemplates, toTemplates, allTemplates)` — `src/utils/programDiff.js`

Diff **real** entre dos etapas, para el subtítulo (§2.5).

**Emparejado de sesiones**: `cloneDays` deja `derivedFrom` en cada plantilla
apuntando a la de origen ([useStore.js](../../store/useStore.js), `addStageToProgram`).
Se sube por esa cadena (máx. 10 saltos) hasta dar con una plantilla de la etapa
destino; si no resuelve (etapas hechas a mano), se empareja **por índice**, que
es como se clonan los días.

Devuelve, agregado sobre toda la etapa:

```js
{
  setsDelta:   number,          // Σ sets − Σ sets
  added:       number,          // ejercicios que no estaban
  removed:     number,          // ejercicios que ya no están
  replaced:    number,          // por sesión, min(añadidos, quitados) — un cambio, no dos
  blocksDelta: number,
  reps:        { delta, count } | null,  // desplazamiento de reps más repetido
}
```

`reps` es el cuarto dato, y no es decorativo: una etapa de intensificación
normalmente **no** cambia ni series ni ejercicios, solo el rango de
repeticiones — sin él su subtítulo saldría vacío justo donde más falta hace.

La pantalla compone la línea saltándose los ceros. Todo a cero → no hay línea.

**No se reutiliza `buildProgramDiff`** del store: ese compara dos versiones del
mismo programa por conteos, con textos en español a pelo, para el aviso de
"tu entrenador ha cambiado algo". Otra pregunta y otro contrato.

## 5. i18n

Namespace nuevo `programView.*` en `src/locales/{es,en}.json` (raíz del repo).
Se reutilizan `exerciseSelector.groups.*` para los grupos musculares,
`blocks.formats.*` y `blocks.units.*` para los bloques, y `common.keyExercise`.

## 6. Fases

1. **La sesión deja de mentir** — `sessionSlots`, superserie, dropset,
   calentamiento, bloques, fallback de prescripción al `def`, i18n. Es el bug
   de fondo y aporta valor solo.
2. **Cabecera y selector** — resumen del programa, autoría, chips de etapa y
   sesiones de la etapa elegida.
3. **Volumen y diff** — `plannedSetsByGroup`, `stageDiff` y la tarjeta de barras.
4. **Export a PDF** (opcional, no incluido): pediría `expo-print`. Hoy la
   pantalla se lee como documento y se puede capturar; añadir una dependencia
   solo para esto es una decisión de producto, no técnica.

## 7. Trampas conocidas

- `program.days` es el **espejo de la etapa activa**, no la lista de días del
  programa ([stage-planner.md](stage-planner.md) §3.1). Esta pantalla lee `stages[i].days`.
- Programas anteriores a la fase 0 del planificador pueden no tener `stages`:
  se cae a una etapa sintética con `program.days`.
- Un `exConfig` no siempre trae `sets`/`minReps`: hay que caer al `def` de la
  biblioteca, como hacía la vista de impresión web.
- Las plantillas se resuelven con `getEffectiveTemplate` (`userPrograms` pisa a
  `sessionTemplates`), nunca leyendo `sessionTemplates` directo.
