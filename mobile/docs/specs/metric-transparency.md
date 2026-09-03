# Spec — Transparencia de métricas ("¿de dónde sale este número?")

> Tema: entrenamiento
> En corto: Tocar cualquier número de la app y ver de qué fórmula exacta sale. 26 métricas con su ficha.
> Fase T05 · hecho · Registro `metrics.*` + `metricDocs.js` + apartado en Documentación
> Fase T06 · hecho · `MetricInfoSheet` + etiquetas tocables en Progreso, ejercicio y Carga
> Fase T07 · pendiente · Extender a Workout, recap, historial y lado entrenador
>
> Estado: **FASES 1 Y 2 IMPLEMENTADAS** (ago 2026) — registro `metrics.*` con
> las 26 métricas que la app expone, `metricDocs.js`, el apartado "Cómo se
> calcula cada número" en Documentación, y la hoja informativa al tocar la
> etiqueta de un dato en Progreso, detalle de ejercicio y Carga. Pedida por el
> usuario (jul 2026) al cerrar
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

**Cinco campos**, separados a propósito para no mezclar concepto con
implementación (la primera versión los mezclaba y se notaba):

| campo | contenido | obligatorio |
|---|---|---|
| `name` | cómo se llama en la app | sí |
| `what` | qué mide **y para qué sirve** | sí |
| `formula` | el cálculo, sin reglas ni matices | sí |
| `rules` | reglas de la aplicación: qué entra, qué se excluye, cuándo se oculta | no |
| `caveat` | el límite conocido: cuánto puedes fiarte del número | sí |

Las fórmulas que son un resumen y no el cálculo literal se declaran en
`APPROX_FORMULA` (`metricDocs.js`) y la ficha las etiqueta como *"Cómo se calcula
(simplificado)"*. Presentar un resumen como fórmula exacta es justo la
imprecisión que esta spec existe para evitar.

### 2.1-bis Vocabulario — un término por concepto

Regla editorial, no estilo: usar dos palabras para lo mismo hace dudar de si son
lo mismo.

| Concepto | Término único |
|---|---|
| Estimación del máximo | **1RM estimado** — nunca "marca", "fuerza" ni "récord" |
| Denominador de la carga externa | **1RM de referencia** |
| Ancla de un índice | **valor inicial** |
| Todas las sesiones guardadas | **historial** |
| Lo elegido en el selector 1M/3M/6M | **período** |
| Regresión | **línea de tendencia (regresión lineal)** |
| Ventana de cuatro semanas | **las 4 semanas anteriores** |

Dos reglas más:
- **"Tendencia" solo para pendientes.** Una variación entre dos puntos no es una
  tendencia y decirlo así confunde. Por eso el gráfico del panel de Carga pasó de
  "Tendencia de carga" a **"Evolución de la carga"**: son barras diarias con dos
  medias móviles, no una regresión.
- **Nunca "fuerza" para hablar del e1RM.** Es *rendimiento estimado*: "fuerza"
  tiene un significado preciso en entrenamiento y sugiere una medición objetiva
  que aquí no existe.

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

### 2.1-ter Un gráfico NO es una métrica

Namespace aparte `chartDocs.*`, con tres campos por gráfico: `name`, `what` (qué
representa) y `read` (**cómo se interpreta**).

Salió del QA: al abrir "Esfuerzo vs carga" aparecían las fichas de carga externa,
carga de sesión y base 100, pero en ningún sitio se decía qué representa el
gráfico ni cómo leerlo — había que deducirlo de tres fichas. La hoja pinta ahora
el bloque del gráfico **primero**, con relleno accent porque es la cabecera y no
una ficha más, y debajo, tras un separador "Datos que lo componen", las fichas de
sus métricas.

Efecto lateral buscado: la interpretación deja de vivir en un párrafo largo
debajo del gráfico. Bajo la tira de strain quedó una línea.

### 2.2 `MetricInfoSheet` — alcance cerrado

**Qué es tocable** (decisión del usuario, ago 2026): las 3 cards de Progreso,
las 3 del detalle de ejercicio, las 3 de Carga y los 4 títulos de gráfico de esa
pestaña. **Qué no**: la gráfica del detalle de ejercicio, que ya es interactiva y
no es lo bastante compleja como para necesitar explicación.

La regla de fondo: **no hacer tocable todo lo que tenga un número.** Si el icono
aparece en todas partes deja de significar nada y se convierte en ruido.

**El icono ⓘ va solo en los títulos de gráfico.** Las tarjetas pequeñas son
pulsables enteras y sin icono: en una caja de 108 px con un número grande y dos
etiquetas el aro era ruido, y una tarjeta pequeña no tiene ninguna otra acción
con la que competir por el toque —al contrario que las de Progreso, que abren el
detalle del ejercicio, y por eso allí el disparador sí es la etiqueta.

**Un dato puede necesitar varias fichas**, así que la hoja recibe una lista:
"Carga 7d" no se explica solo con la carga de sesión, hace falta la media móvil;
"Esfuerzo vs carga" necesita carga externa, carga de sesión y base 100.

### 2.2-bis Implementación

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
| 1 | Registro `metrics.*` (es+en) + `metricDocs.js` + apartado en `DocsScreen` | ✅ **hecha** — 24 fichas, cubre todas las métricas sin tocar ninguna pantalla de datos |
| 2 | `MetricInfoSheet` + etiquetas tocables en Progreso, detalle de ejercicio y Carga | ✅ **hecha** |
| 3 | Extender a Workout (chip de progresión, calentamiento), Recap, historial y lado entrenador (adherencia) | pendiente de decidir si merece la pena |

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
