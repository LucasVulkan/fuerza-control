# Spec — Transparencia de métricas ("¿de dónde sale este número?")

> Estado: **NO IMPLEMENTADA**. Pedida por el usuario (jul 2026) al cerrar
> [training-load.md](training-load.md): *"en todos los elementos en los que hay
> fórmulas y datos expuestos, que haya una forma de ver la fórmula exacta usada,
> a modo informativo"*.
>
> Transversal: no pertenece a ninguna pantalla. Cubre las métricas que YA existen
> (e1RM, tonelaje, adherencia, chips de progresión…) y las que lleguen después.

## 1. Principio

Todo número derivado que la app enseña debe poder explicarse **con la fórmula
real que se ejecuta**, no con una paráfrasis. Si el código descarta las series de
más de 12 reps, la ficha lo dice.

Corolario que da sentido a la feature: **el campo de límite es obligatorio.** Una
ficha que sólo enseña la fórmula vende precisión; una que enseña la fórmula y su
punto ciego es lo que el usuario necesita para saber cuánto fiarse. Si una
métrica no tiene límite que declarar, casi siempre es que no se ha buscado.

## 2. Una fuente, dos superficies

El error a evitar es escribir la explicación dos veces (glosario y tooltip) y que
diverjan al primer cambio de fórmula. Por eso:

```
registro de métricas  ──┬──►  DocsScreen (glosario navegable, todas juntas)
                        └──►  MetricInfoSheet (al tocar el dato concreto)
```

### 2.1 El registro

Namespace nuevo `metrics.*` en `src/locales/{es,en}.json`, una entrada por
métrica:

```json
"metrics": {
  "e1rm": {
    "name":    "1RM estimado",
    "what":    "El peso que podrías levantar una sola vez, estimado a partir de tus series.",
    "formula": "1RM = peso × (1 + reps / 30)",
    "caveat":  "Fórmula de Epley. Se ignoran las series de más de {{maxReps}} reps: por encima de ahí sobreestima. Si registras RPE, se suman las reps en reserva ({{rir}})."
  }
}
```

Cuatro campos, siempre los cuatro: `name` · `what` (una frase, sin jerga) ·
`formula` (la expresión literal) · `caveat` (el límite conocido).

Las constantes se **interpolan desde el código**, no se teclean en el JSON:
`t('metrics.e1rm.caveat', { maxReps: MAX_RELIABLE_REPS })`. Así cambiar la
constante actualiza la documentación sola. Ese es el mecanismo que impide que la
ficha mienta.

El mapa id → constantes vive en un módulo pequeño,
`mobile/src/utils/metricDocs.js`:

```js
// { [metricId]: () => interpolationValues } — sólo las métricas con constantes.
export const METRIC_VARS = {
  e1rm:         () => ({ maxReps: MAX_RELIABLE_REPS, rir: '10 − RPE' }),
  externalLoad: () => ({ weeks: REF_WEEKS }),
  ...
};
```

### 2.2 `MetricInfoSheet`

Componente nuevo en `mobile/src/components/ui/`. Recibe `metricId`, muestra los
cuatro campos y se cierra arrastrando. **Reutiliza `mobile/src/components/DragSheet.jsx`**
(ya resuelve `PanResponder`, backdrop, spring-in y el umbral de cierre) — no
escribir otro sheet.

Disparador: la **etiqueta** del dato es lo tocable (`SESIONES`, `CARGA`,
`MONOTONÍA`, el título del gráfico), con un icono de información pequeño a su
derecha. No hacer tocable la card entera: en Progreso ya abre el detalle del
ejercicio y en el panel de Carga chocaría con el propio gráfico.

El icono va en **SVG**, no emoji ⓘ — misma regla que el resto de la migración
(ver `docs/UI-MIGRATION.md`). Tamaño 12, color `th.colors.muted`; el aro no debe
competir con el número.

### 2.3 DocsScreen

`DocsScreen` ya se alimenta entero de `docs.sections` (array de
`{ title, points[] }`) y no hay que tocar la pantalla para añadir contenido. Pero
las fichas de métrica tienen 4 campos, no viñetas sueltas, así que sí necesita un
bloque nuevo: tras las secciones actuales, un apartado **"Cómo se calcula cada
número"** que recorra el registro `metrics.*` y pinte cada ficha con el mismo
componente que usa el sheet. Un solo render para las dos superficies.

## 3. Inventario de métricas a documentar

### 3.1 Obligatorias en v1 (ya visibles hoy)

| id | Dónde se enseña | Origen del cálculo |
|---|---|---|
| `e1rm` | Progreso, detalle de ejercicio, PRs | `src/utils/oneRm.js` — Epley + reps en reserva, ≤12 reps |
| `volume` | Recap, Progreso | `recapStats` — Σ peso × reps, drops incluidos |
| `setsDonePlanned` | Recap | `recapStats` — planificadas desde `entry.plannedSets` |
| `loadTrend` | Progreso, card CARGA | `linearRegressionPct` promediado por ejercicio |
| `volumeTrend` | Progreso, card VOLUMEN | primera vs última sesión del período |
| `lastSessionDelta` | Progreso, subtítulos | última vs penúltima sesión |
| `pr` | Recap | escalera e1RM → peso máximo → reps a peso corporal |
| `progressionChip` | Workout | `progression.js` — umbrales de `evaluateCompletion` por modo |
| `estimatedDuration` | Editor de sesión | `sessionStats.js` — 35s/serie + descanso + 180s/ejercicio + 480s/sesión |
| `warmupWeight` | Workout | `warmup.js` — % del peso de trabajo, redondeo a 2,5 kg |
| `adherence` | Clientes (entrenador) | `adherence.js` — huecos esperados `7/frecuencia`, media de 4 semanas |
| `stageProgress` | Programa | `stageProgress.js` — rotación por sesiones distintas del ciclo |
| `blockDelta` | Recap | `compareBlockResults` — for-time invertido (menos es mejor) |

### 3.2 Nuevas, según avancen las fases de [training-load.md](training-load.md)

`sessionLoad` (sRPE × minutos) · `sessionMinutes` (reloj acotado por el modelo) ·
`externalLoad` (reps × %1RM con referencia de 6 semanas) · `movingAverage` (7d/28d,
ventana expansiva) · `monotony` · `strain` · `loadState` · `indexed100` ·
`performanceIndex`.

Las que tienen el límite más importante que declarar, y por qué existe esta spec:
`sessionMinutes` (el reloj de pared incluye el móvil en el bolsillo),
`externalLoad` (los ejercicios de peso corporal no computan sin peso corporal),
`monotony` (los días de descanso cuentan como 0) y el factor de los bloques de
acondicionamiento (calibrado a ojo).

## 4. Fases

| # | Contenido | Nota |
|---|---|---|
| 1 | Registro `metrics.*` (es+en) + `metricDocs.js` + apartado en `DocsScreen` | Cubre TODAS las métricas de golpe sin tocar ninguna pantalla de datos. Es el 80% del valor |
| 2 | `MetricInfoSheet` + etiquetas tocables en Progreso y Recap | |
| 3 | Extender a Workout (chip de progresión, calentamiento) y lado entrenador (adherencia) | |

Fase 1 puede hacerse antes o después de la fase 2 de training-load, son
independientes. Las métricas nuevas se añaden al registro **en el mismo commit**
que las estrena — regla, no sugerencia: una métrica sin ficha es una métrica
indocumentada.

## 5. Qué NO hacer

- **Renderizar LaTeX / MathML.** Las fórmulas son de una línea y en texto plano
  se leen igual: `carga = sRPE × minutos`. Nada de dependencias de tipografía
  matemática.
- **Escribir las constantes a mano en el JSON.** Se interpolan (§2.1) o la ficha
  se queda obsoleta a la primera calibración.
- **Cards enteras tocables** para abrir la ficha: colisiona con la navegación que
  ya tienen.
- **Explicaciones largas.** Una frase de `what`, una línea de `formula`, una o dos
  de `caveat`. Si no cabe, el problema es la métrica, no el texto.

## 6. Patrones existentes a imitar

- Sheet arrastrable: `mobile/src/components/DragSheet.jsx`.
- Pantalla alimentada 100% por i18n: `mobile/src/screens/DocsScreen.jsx` +
  `docs.sections` en `src/locales/{es,en}.json`.
- Constantes exportadas para documentarlas: `MAX_RELIABLE_REPS` en
  `src/utils/oneRm.js` (hoy es privada — exportarla).
- Iconos SVG propios: `NoteIcon` en `mobile/src/components/workout/ExerciseCard.jsx`,
  `mobile/src/components/ui/EditorIcons.jsx`.
