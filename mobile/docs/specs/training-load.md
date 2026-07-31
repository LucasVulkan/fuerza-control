# Spec — Carga de entrenamiento (sRPE, carga interna/externa, panel de Carga)

> Estado: **Fase 1 IMPLEMENTADA** (captura de sRPE + peso corporal en el recap).
> Fases 2-6 sin empezar. Cada fase = 1 commit y aporta valor por sí sola.
>
> Origen: conversación Opus + usuario (jul 2026) a partir de una propuesta de
> panel con tendencia de carga, monotonía, strain y ACWR. Varias piezas de la
> propuesta original se cambiaron con razones — están en §10, **leer antes de
> re-litigar cualquier decisión**.

## 1. Concepto y alcance

El sistema separa dos cosas que la app hoy mezcla:

- **Carga externa** — el trabajo hecho. Objetivo, medible: reps × %1RM.
- **Carga interna** — lo que ese trabajo te costó. Subjetivo: sRPE × minutos.

Y una tercera que la app **ya calcula y no hay que reinventar**:

- **Rendimiento** — e1RM, deltas, PRs (`src/utils/oneRm.js`, `sessionRecap.js`).

Regla de encuadre: **las métricas de carga miden fatiga y riesgo, no adaptación.**
La adaptación se mide con rendimiento. El panel enseña las dos cosas juntas
(entrada → salida); no vender las métricas de carga como "estás progresando".

### Fuera de alcance

- ACWR como número con zona de riesgo, y modelos fitness-fatigue (CTL/ATL/TSB).
  Ver §10.4.
- TRIMP y cualquier métrica que requiera frecuencia cardíaca (no hay sensor).
- Recomendaciones automáticas de descarga. El panel informa; no prescribe.

## 2. Modelo de datos

### 2.1 Implementado (fase 1)

```js
// workoutLog[n] — aditivo, sin migración. Ausente = sesión sin feedback.
entry.sessionRpe  // 1-10 entero | undefined — dureza de la SESIÓN (Foster CR-10)
entry.bodyWeight  // kg | null — peso del día, unidad de almacenamiento

// profile
profile.bodyWeight // kg | null — último peso conocido, prerrellena el recap
```

`entry.sessionRpe` es un constructo **distinto** de `set.rpe` (que valora UNA
serie y es opt-in por ejercicio vía `exConfig.trackRpe`). Nunca derivar uno del
otro, ni rellenar sesiones antiguas promediando el RPE de serie.

Acción de store: `setSessionFeedback(logId, { sessionRpe, bodyWeight })` —
parchea la entrada por id (el recap se abre con la sesión ya guardada) y
actualiza `profile.bodyWeight` sólo si viene peso. Los dos campos son
independientes: pasar uno no borra el otro.

Ambos viajan al entrenador sin tocar nada: el payload del cliente incluye el
`workoutLog` entero (`useStore.js` → `pushClientData`).

### 2.2 Fase 6 (objetivos de etapa)

```js
stage.loadTarget = null | { type: 'weekly_delta', pct: number }  // +8 = acumulación, −40 = descarga
```

## 3. Util puro nuevo — `src/utils/trainingLoad.js` (+ tests, fase 2)

Vive en `src/utils/` (compartido, tests vitest desde la raíz del repo), como
`oneRm.js` y `conditioningBlocks.js`. Todo puro: recibe el log, no toca el store.

### 3.1 Duración de la sesión

`entry.duration` es reloj de pared (`Date.now() − startedAt`): incluye descansos,
pausas y móvil en el bolsillo. Las series **no llevan timestamp**, así que no
existe tiempo activo real. Se acota con un modelo:

```js
modelSec(entry) =
    Σ_ejercicios [ Σ_series (work + rest) + 180 ]
  + Σ_bloques    [ segundosActivos + 180 ]
  + 480                                 // calentamiento general, si SE ENTRENÓ algo
// work = el tiempo REAL de la serie si la tiene, si no 35 s
// rest = ex.restSec ?? 90   ← restSec SÍ está guardado en el log por ejercicio
// blockActiveSec: for-time usa su timeSec real; amrap/emom, blockEstimatedSec

sessionMinutes(entry) = clamp(entry.duration / 60000, 0.5 × modelSec/60, 2 × modelSec/60)
```

Dos matices que salieron al implementar:
- `work` usa el **tiempo real registrado**, no el punto medio del rango prescrito
  como hace `sessionStats`: el log guarda el tiempo de cada serie, y aquí se
  modela lo hecho, no lo planificado.
- El calentamiento general (480 s) solo se suma si de verdad se registró trabajo.
  Un ejercicio presente con 0 series no es una sesión, y sin este guard
  `sessionMinutes` devolvía un suelo de 4 minutos para una sesión vacía.

Constantes idénticas a `mobile/src/utils/sessionStats.js` (180/480/35) —
**duplicadas a propósito**, mismo precedente que `LIMITATION_GROUPS` en el
generador: `sessionStats` modela el PLAN desde una plantilla, esto modela lo
HECHO desde una entrada de log. Firmas y entradas distintas.

Limitación conocida: el log no guarda `supersetWithNext`, así que los miembros de
una superserie cuentan su descanso completo y el modelo sobreestima un poco. Sólo
afecta al techo/suelo del clamp, no al valor cuando el reloj es plausible.

### 3.2 Carga interna

```js
internalLoad(entry) = entry.sessionRpe != null
  ? entry.sessionRpe × sessionMinutes(entry)
  : null                                   // hueco en la serie, NUNCA 0
```

### 3.3 Carga externa — volumen relativo

**No es tonelaje.** Es `Σ reps × (peso / 1RM de referencia)`, es decir "reps a
intensidad relativa". Motivos en §10.1.

```js
isBodyweight(def)
  // La carga es tu cuerpo salvo que el equipo aporte carga externa:
  //   LOAD_BEARING = { barbell, dumbbells, cables, machines, kettlebell }
  // Todo lo demás (pullup_bar, parallettes, rings, ab_wheel, weight_belt,
  // resistance_band, rope, equipment vacío) es aparato de sujeción o lastre.
  // ⚠ NO vale "equipment está vacío": las dominadas llevan ['pullup_bar'] y los
  // fondos ['parallettes','dip_bar'], y son ejercicios de peso corporal.
  // def desconocido (ejercicio borrado) → false, default seguro.

effectiveWeight(set, def, bodyWeight)
  // 1. Equipo con carga → parseFloat(set.weight)
  // 2. Peso corporal    → bodyWeight + (set.weight || 0)      ← lastre
  // 3. progressionDirection 'decrease' → bodyWeight − (set.weight || 0)
  //    weight es ASISTENCIA (goma), no carga: sumarla invertiría el progreso.
  // Sin bodyWeight, los casos 2 y 3 devuelven null.

setLoad(set, ref) = reps × (effectiveWeight / ref)     // null si falta cualquiera

sessionLoads(log, allExercises, { fallbackBodyWeight, weeks })
  // → [{ id, timestamp, internal, external, partial }] ordenado por fecha.
  //   external = Σ setLoad (series + drops) + Σ_bloques segundosActivos × K
```

**Verificado contra la librería real (182 ejercicios)**: 68 quedan como peso
corporal y los 4 con `progressionDirection: 'decrease'` (los asistidos) caen
todos dentro, ninguno fuera — la regla del caso 3 no puede dispararse por error
en un ejercicio con barra.

**Referencia de 1RM — cascada** (`refFor(exerciseId, entry)`):
1. Mejor e1RM del ejercicio en las `weeks` semanas **anteriores** a esa sesión.
2. Mejor e1RM **de la propia sesión** (ejercicio estrenado hoy).
3. **Peso efectivo máximo visto** (previo o de hoy) — salva los ejercicios que
   siempre se hacen por encima de 12 reps, donde Epley nunca da referencia.
4. `null` → esas series no computan y la sesión sale `partial: true`.

El corte por sesión (y no "hasta hoy") es lo que hace el histórico **inmutable**:
un PR de esta semana no puede reescribir la carga de hace tres meses. Hay test.

Series de >12 reps **sí cuentan**: no generan referencia, pero reciben su %1RM de
la referencia existente. Ese es justo el mecanismo que salva a los accesorios.

Series sin reps (isométricos, series de tiempo) **no computan y tampoco marcan la
sesión como parcial**: quedan fuera del volumen relativo por definición, no por
falta de datos.

### 3.3-bis Dos desviaciones respecto al plan original de esta spec

1. **`recentE1RM` NO recibe un parámetro `asOf`** y `oneRm.js` no se toca. La
   referencia tiene que calcularse sobre el peso **efectivo**, y `recentE1RM` /
   `bestSetE1RM` leen `set.weight` en crudo: con ellas, ningún ejercicio de peso
   corporal tendría referencia jamás. Se reutiliza `epley1RM`, que es la fórmula
   y el límite de 12 reps — la parte que sí debe estar compartida.
2. **No existe `externalLoad(entry, log, …)` suelta.** Resolver la referencia
   rescaneando el log por cada ejercicio de cada sesión es O(sesiones² ×
   ejercicios) (~14 M operaciones con 3 años de historial). `sessionLoads`
   construye un índice `exerciseId → [{id, ts, e1rm, maxW}]` **una sola vez** por
   pasada y devuelve todas las sesiones. Quien quiera una sola sesión, la busca
   por `id` en el resultado.

### 3.4 Peso corporal del histórico

`fallbackBodyWeight` (el último peso conocido del perfil) se usa en las entradas
sin `bodyWeight` propio. Sin él, todo el historial anterior a la fase 1 quedaría
sin carga en los ejercicios de peso corporal — es decir, meses de datos muertos.
Hace el histórico **aproximado, no falso**, y se declara en la ficha de la
métrica (ver [metric-transparency.md](metric-transparency.md)).

```js
// ponytail: un solo factor para todos los bloques, calibrado a ojo
// (AMRAP de 12' ≈ un ejercicio de 4×10 al 70%). Es la parte menos defendible
// del modelo. Si algún día importa: factor por formato, o pedir un sRPE propio
// del bloque.
const BLOCK_LOAD_PER_SEC = 0.04;
```

### 3.4 Serie diaria y agregados

```js
dailySeries(log, allExercises)
  // Un punto por DÍA DE CALENDARIO local desde la primera sesión hasta hoy.
  // Días sin entrenar → { internal: 0, external: 0 }. Los ceros son datos:
  // sin ellos las medias móviles y la monotonía no significan nada.
  // → [{ day: ts(00:00 local), internal, external, sessions }]

rollingMean(serie, n)
  // Ventana expansiva mientras no haya n días de historial (si no, la línea de
  // 28d sólo existiría a partir del día 28 y el gráfico saldría casi vacío).

monotony(sieteDias)  = media / desviaciónTípicaPoblacional   // null si SD === 0
strain(sieteDias)    = suma × monotony(sieteDias)            // null si monotony null

loadState(m7, m28)   // m7/m28 → 'unloading' (<0.8) | 'steady' (0.8-1.3) | 'loading' (>1.3)
```

Todas las funciones sobre carga interna. La monotonía/strain de carga externa no
se usan (Foster las definió sobre sRPE).

## 4. Reglas críticas (leer antes de tocar la UI)

1. **El selector de período NO filtra el cálculo.** `filterLog` recorta el log
   ANTES de nada; si la vista Carga lo usa, la media de 28 días es imposible de
   calcular con "7D" seleccionado. El cálculo va **siempre sobre el log
   completo**; el período recorta sólo lo que se pinta.
2. **El toggle "Programa actual" no existe en la vista Carga.** La carga es
   sistémica: filtrar por programa convierte las sesiones de fuera en días de
   descanso falsos y hunde las medias. Filtrar ahí es incorrecto, no incómodo.
3. **El período de la vista Carga es `1M / 3M / 6M / TODO`** — "7D" no es una
   ventana de gráfico útil (7 barras, dos líneas planas).
4. **Monotonía y strain se ocultan si la semana tiene <3 sesiones.** No se pintan
   en verde: no hay dato. Con 1-2 sesiones la desviación típica la dominan los
   ceros y el número miente.
5. **Sin `sessionRpe` no hay carga interna.** Hueco en la línea, nunca 0 — un 0
   se lee como "descansé" y es falso.
6. **Strain sin umbral absoluto.** Se muestra relativo a la línea base de 4
   semanas del propio usuario ("+18% vs tu base"), nunca con colores fijos.

## 5. UI

### 5.1 Entrada — `SegmentedControl` en la pantalla de Progreso

`StatsScreen` envuelve `ProgressTab` y `ClientsScreen` lo reutiliza en el detalle
de cliente → **el panel llega al lado entrenador gratis**, que es donde monotonía
y strain son más accionables.

Segmentado nuevo `EJERCICIOS | CARGA` como primera fila. `EJERCICIOS` = el
`ProgressTab` actual **sin tocar** (1954 líneas ya migradas a Figma). `CARGA` =
componente nuevo `mobile/src/components/stats/LoadTab.jsx`. No meter el panel
dentro de `ProgressTab`.

### 5.2 Contenido de la vista Carga (aprobado por mockup, jul 2026)

1. Fila de período (`1M/3M/6M/TODO`, sin toggle de programa).
2. **3 progress cards** reutilizando el componente exacto, con significado nuevo:
   `CARGA 7D` (+% vs 28d) · `MONOTONÍA` (baja/moderada/alta) · `STRAIN` (+% vs
   base). Condición del usuario: sólo si la información cabe bien; si no, bajar
   monotonía/strain a strips.
3. **Card "Tendencia de carga"** — barras diarias (`muted2`) + línea 7d (`accent`)
   + línea 28d (`blue`), leyenda, y strip de estado con punto de color y frase
   ("Estás acumulando carga. La semana va un 34% por encima de tu media del mes").
4. **Card "Esfuerzo vs carga"** — dos líneas **indexadas base 100** sobre su
   propia media de 28d. En unidades crudas (kg vs AU) una aplasta a la otra.
   Debajo, chip de interpretación: `↑ carga + = esfuerzo → adaptación`,
   `= carga + ↑ esfuerzo → fatiga`, `↓ ambas → descarga`.
5. **Card "Rendimiento"** — e1RM medio indexado. Es la salida del sistema; sin
   ella el panel mide fatiga pero no responde a "¿me estoy adaptando?".
6. **Card "Series por grupo"** (fase 5) — barras horizontales de la semana actual
   por `primaryGroup`, con marcas verticales del rango 10-20 series. **No** son
   barras apiladas por semana: a ancho de móvil, 9 grupos × 4 semanas es
   ilegible, y la pregunta real es "¿me falta hombro?".

### 5.3 Gráficos

Extender el `MiniLineChart` de `ProgressTab.jsx` con un prop `series[]` (hoy pinta
una sola). Ya resuelve eje, scroll, tooltip y animación. **No añadir
`victory-native` ni `gifted-charts`** por tres polilíneas.

### 5.4 Transparencia de fórmulas — obligatoria

Cada métrica que estrene una fase de esta spec añade su ficha (`what` / `formula`
/ `caveat`) al registro de [metric-transparency.md](metric-transparency.md) **en
el mismo commit**, y su etiqueta se hace tocable. No es un extra posterior: son
justo las métricas con más letra pequeña que declarar (reloj de pared acotado,
peso corporal ausente, días de descanso a 0, factor de bloques calibrado a ojo).

### 5.5 Recap (fase 2)

Bajo la fila de sRPE, una línea: `Carga de la sesión: 546 · +12% vs media 7d`.
**Sin "AU"** — es jerga y no aporta; el contexto relativo es lo que se lee.

## 6. i18n

Toda cadena visible en `src/locales/es.json` Y `en.json` (raíz del repo). Fase 1
ya añadió `recap.rpeQuestion / rpeLow / rpeMid / rpeHigh / bodyWeight`.
Namespace nuevo para el panel: `load.*`.

## 7. Casos borde (checklist de QA)

- Sesión sin `sessionRpe` → hueco en la línea interna, la externa se pinta igual.
- Sesión con `sessionRpe` pero `duration: 0` (guardada sin `startedAt`) → el
  clamp cae al modelo; no debe dar 0 ni NaN.
- Usuario sin `bodyWeight` → los ejercicios de peso corporal no computan, sesión
  `partial: true`; la vista lo indica, no lo esconde.
- Ejercicio estrenado hoy → sin referencia previa, cae al e1RM de la propia
  sesión.
- Semana entera de descanso → SD = 0 → monotonía null → indicador oculto.
- Log de menos de 28 días → media de 28d con ventana expansiva, sin línea rota.
- Log vacío / primera sesión → panel en estado vacío, no gráficos con una barra.
- Cambio de unidad kg↔lb → todo el cálculo en kg; sólo la UI convierte.
- Sesión libre (`__free__`) → cuenta igual; no tiene plantilla pero sí `restSec`
  por defecto.

## 8. Qué NO tocar

- La lógica de ejercicios de `ProgressTab` (modal, `MiniLineChart` existente,
  `computeValue`, regresión) más allá de añadir el prop `series[]`.
- `set.rpe` y `exConfig.trackRpe` — el RPE por serie sigue siendo opt-in y
  alimenta la progresión (`progression.js`), no la carga.
- `recapStats` — el tonelaje del recap se queda como está.
- El array `clients[id].bodyWeight` del lado entrenador: es otra feature (el
  entrenador lo teclea a mano). Unificarlo es una decisión aparte.

**Limpieza hecha en la fase 2:** `getSessionTotalVol` (`ProgressTab.jsx`) no
sumaba las sub-series de los dropsets y `recapStats` sí. Ahora delega en
`recapStats(session).volume` — una sola definición de "volumen" en la app. Sube
ligeramente los números de la card VOLUMEN en quien use dropsets.

## 9. Fases

| # | Contenido | Estado |
|---|---|---|
| 1 | `entry.sessionRpe` + `entry.bodyWeight` + `setSessionFeedback` + UI de recap + i18n | ✅ hecha (`0bda778`) |
| 2 | `src/utils/trainingLoad.js` + 52 tests + unificación de tonelaje + línea de carga en el recap | ✅ hecha |
| 3 | Segmentado `EJERCICIOS/CARGA` + `LoadTab` con cards, gráfico de tendencia y strip de estado | — |
| 4 | Gráfico esfuerzo vs carga (indexado) + card Rendimiento. **Esperar 4+ semanas de sRPE real** o es un gráfico vacío | — |
| 5 | Series por grupo muscular | — |
| 6 | `stage.loadTarget` + progreso contra el objetivo de la etapa | — |

## 10. Decisiones cerradas y por qué (no re-litigar)

### 10.1 Carga externa = volumen relativo, no tonelaje
El tonelaje pondera por peso absoluto (una serie de sentadilla aplasta a diez de
curl) y vale **0** en peso corporal. El volumen relativo lo normaliza y, sobre
todo, **hace innecesaria una tabla de factores por ejercicio** (dominada 1.0,
flexión 0.64, fondo 0.95...): como el mismo factor aparece en el numerador y en
la referencia, se cancela. Con tonelaje esa tabla sería obligatoria para toda la
biblioteca.

### 10.2 El e1RM no necesita RPE
`epley1RM(weight, reps, rpe = null)` — el RPE es opcional y sólo refina el
cálculo con las reps en reserva. El límite real es **12 reps efectivas**, y se
resuelve con la referencia por ejercicio (§3.3): los accesorios de alto rango sí
computan.

### 10.3 Duración = reloj acotado, no tiempo modelado
El "tiempo activo calculado" sería `series × constante`, con lo que
`sRPE × duración` degeneraría en `sRPE × series` — ya no es sRPE-TL. El clamp usa
tiempo real cuando es plausible, funciona sobre todo el historial existente y no
toca el modelo de datos. Mejora futura opcional: sellar `doneAt` en
`toggleSetDone` y calcular tiempo activo real.

### 10.4 Ni ACWR ni CTL/ATL como número
El ACWR clásico (medias acopladas 7/28) arrastra artefactos matemáticos conocidos
y su "sweet spot" no replica. CTL/ATL/Forma es mejor modelo pero introduce un
segundo sistema de ventanas solapado con el gráfico. Decisión: **un solo sistema**
— la relación 7d/28d, que es el ACWR, presentada como estado cualitativo. El
indicador y el gráfico son literalmente los mismos datos.

### 10.5 Monotonía con días de descanso a 0
Es la convención original de Foster (7 días). La alternativa (sólo días de
entreno) hace que entrenar menos "mejore" la monotonía, que es absurdo. Se
compensa ocultando el indicador con <3 sesiones.

### 10.6 sRPE en el recap, entero, escala 1-10
El recap es el único momento en que el usuario ya está mirando sus números. Sin
decimales: valorar una sesión entera es una impresión, no una medida.

### 10.7 Peso corporal siempre visible
Sin lógica de caducidad ni preguntas condicionales. Fila permanente prerrellenada
con el último valor; cambiarlo lo guarda en la sesión y pasa a ser el nuevo
último.

## 11. Patrones existentes a imitar (rutas exactas)

- Util puro + tests: `src/utils/conditioningBlocks.js` + `.test.js`.
- e1RM y ventana reciente: `src/utils/oneRm.js`.
- Acción de store que parchea el log por id: `setSessionFeedback` en
  `mobile/store/useStore.js`.
- Card de estadística y `SegmentedControl`: `mobile/src/components/stats/ProgressTab.jsx`
  (`statTile`, `PERIOD_OPTIONS`) y `mobile/src/components/ui/SegmentedControl.jsx`.
- Gráfico SVG: `MiniLineChart` dentro de `ProgressTab.jsx`.
- Reglas de fidelidad visual: `mobile/docs/UI-MIGRATION.md` (el panel es pantalla
  nueva sin nodo de Figma → tokens y primitivas existentes, no inventar).
