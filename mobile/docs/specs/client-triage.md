# Spec — Triaje de clientes (P3)

> Estado: **spec cerrada, sin implementar** (ago 2026). Sale del análisis de 5
> palancas (P1-P5) sobre cómo usar las métricas que ya se calculan para
> programar más rápido; la P1 es [stage-planner.md](stage-planner.md), esta es
> la P3.
>
> Qué resuelve: con 20 clientes, la pregunta del entrenador no es "¿cuánta carga
> lleva Ana?" sino **"¿a quién miro hoy?"**. El objetivo es convertir "repasar 20
> clientes" en "mirar los 3 que lo piden".
>
> **Alcance cerrado con el usuario: DOS banderas nuevas, ni una más.** El resto
> de candidatas están en §5 con el motivo de su descarte. La razón es explícita:
> *"no quiero que el dashboard sea una feria de iconos y datos"*.

---

## 1. Lo que YA existe (no reconstruir)

El mecanismo de triaje está construido. Antes de tocar nada, leer
`ClientsScreen.jsx`:

| Pieza | Dónde |
|---|---|
| `computeAdherence` — estados `on_track/slipping/at_risk/no_data/muted`, umbrales que escalan con la frecuencia del programa (`7/target` días de hueco esperado), racha semanal | [`src/utils/adherence.js`](../../../src/utils/adherence.js) |
| `AttentionPill` — contador, **solo se pinta si su cuenta > 0**, filtra la lista y la reordena | [ClientsScreen.jsx:1446](../../src/screens/ClientsScreen.jsx) |
| Pills vivas: **En riesgo** y **Sin revisar** | [ClientsScreen.jsx:2987](../../src/screens/ClientsScreen.jsx) |
| `adherenceByClient` — el `useMemo` que ya calcula por cliente | [ClientsScreen.jsx:1815](../../src/screens/ClientsScreen.jsx) |
| Aviso de **etapa bloqueada** en el hero + punto naranja en la fila | [stage-locks.md](stage-locks.md) §4 |

Por tanto esta spec **no construye un sistema de avisos**: cuelga dos banderas
de un perchero que ya está puesto. Ese es todo el trabajo de UI.

Nota de higiene, opcional: el estado se llama `adherenceFilter` y ya guarda un
valor que no es de adherencia (`'unreviewed'`). Al añadir dos más el nombre
miente del todo — renombrar a `attentionFilter` es un buscar-y-reemplazar y
conviene hacerlo en el mismo commit.

## 2. Bandera A — Etapa terminada y sin siguiente 🟢

### 2.1 Por qué esta y no "etapa esperando" a secas

Una etapa terminada tiene **tres** desenlaces distintos, y solo uno de ellos es
un problema del entrenador:

| Estado | Qué pasa | Quién actúa |
|---|---|---|
| Terminada · hay siguiente · abierta | el cliente avanza solo | nadie |
| Terminada · hay siguiente · **bloqueada** | el cliente se queda | **ya avisado** ([stage-locks.md](stage-locks.md) §4) |
| Terminada · **no hay siguiente** | el cliente repite la última para siempre, en silencio | ⬅ **esta spec** |

El tercero es hoy invisible y es el que importa: **es lo que permite dejar de
planificar todas las etapas por adelantado.** Con el aviso, el flujo pasa a ser
"monto un bloque → me avisan cuando se acaba → monto el siguiente", que es
además la razón de ser del planificador (P1). Sin él, el planificador espera a
que el entrenador se acuerde.

### 2.2 Regla

```js
// src/utils/clientAttention.js (nuevo, puro, con tests)
export function blockFinished(client, program)
```

Se cumple cuando **todas**:

1. El programa es del entrenador y está activo.
2. `stage = program.stages[clientStageIndex(client, program)]` — **el índice del
   BLOB del cliente, no `program.currentStageIndex`**. En el móvil del
   entrenador ese campo significa "la etapa que yo activé" y miente en cuanto el
   cliente avanza solo ([stage-locks.md](stage-locks.md) §9).
3. `stage.durationWeeks != null` — una etapa sin límite no termina nunca (§2.2
   de [stage-planner.md](stage-planner.md)).
4. `progress.stageWeeksCompleted >= stage.durationWeeks`, leyendo `progress` con
   `progressFromBlob(client.progress, program.id)`.
5. **No hay etapa siguiente**: el índice es el último de `program.stages`.

El estado manual del cliente (`paused`/`inactive`) silencia la bandera, igual
que hace `computeAdherence`.

### 2.3 UI

- **Pill** "Bloque terminado" en la fila de pills, con contador, misma anatomía
  que las dos existentes. Color: `orange` (es una decisión pendiente, no un
  riesgo — el rojo es de `at_risk`).
- **Hero del detalle de cliente**: cuarto estado junto a los tres de
  [stage-locks.md](stage-locks.md) §4, con **acción directa al planificador** de
  ese cliente. Ese botón es la mitad del valor de la bandera: avisar sin dar el
  siguiente paso deja el trabajo a medias.

Coste: barato. El dato es un contador que ya viaja en el blob de progreso y ya
se lee en la fila; no toca `trainingLoad`.

## 3. Bandera B — Estancado 🟡

### 3.1 La pregunta que responde

"Lleva un mes entrenando bien y sin mejorar." Es la única bandera que habla del
**programa** y no del cliente, y por eso es la más valiosa: el resto dicen que
alguien no entrena; esta dice que lo que le has puesto ya no le sirve.

### 3.2 Regla

Se apoya en [`performanceWeekly(log, allExercises)`](../../../src/utils/trainingLoad.js),
que ya existe y ya está en producción en la pestaña Carga. Recordatorio de lo
que hace, porque condiciona el umbral: cada ejercicio se indexa **contra su
propia línea base** y se promedian los índices (150 kg de sentadilla y 40 de
curl no se promedian en kilos); cada semana toma el **mejor e1RM de las últimas
4 semanas**, para que una descarga no aparezca como pérdida de fuerza.

```js
export function isStalled(performanceSeries, { block = 4, flat = 2 } = {})
```

- Compara la **media del último bloque de 4 semanas contra la del bloque
  anterior**, no dos puntos sueltos. Es el mismo criterio que ya usa
  [`effortTrend`](../../../src/utils/trainingLoad.js): con un mesociclo 3:1,
  comparar la última semana contra la de hace cuatro enfrenta descarga con
  descarga y siempre sale "sin cambios".
- **Estancado** = `|media_reciente − media_anterior| < flat` puntos de índice.
- **Mínimo 8 semanas** de serie con dato. Con menos no es estancamiento, es
  falta de historial: devuelve `false`, no una bandera.

⚠️ **`flat: 2` es una conjetura, no un valor medido.** `effortTrend` usa 8, pero
sobre series de carga, que son mucho más ruidosas que el índice de rendimiento
(que ya viene suavizado por la ventana de 4 semanas). **Calibrar contra
`npm run seed` antes de dar la fase por buena** — es la lección que este
proyecto ya se ha llevado tres veces: verificar los datos antes de fiarse de una
spec propia, incluida la recién escrita.

### 3.3 Regla de exclusión — importante

**"Estancado" NO se muestra si la adherencia pide atención** (`requiresAttention`)
ni si está `muted`.

Un cliente que no entrena también sale plano, y etiquetarlo de "estancado" da el
diagnóstico equivocado: el problema es que no ejecuta, no que el programa no
funcione. Es el mismo orden de prioridad que usará P4 ("la primera regla que
dispara, gana"), y es lo que evita que dos pills señalen al mismo cliente por la
misma causa.

### 3.4 UI

Pill "Estancado" con contador, color `orange`. Nada en la fila más allá del
color de atención que ya existe: la explicación vive en la pestaña Carga del
cliente, que ya tiene la card de Rendimiento con el gráfico entero.

## 4. El coste real: no es la UI

`computeAdherence` es barato — solo mira *timestamps*. `performanceWeekly`
**recorre cada serie de cada sesión** y construye un índice de e1RM por
ejercicio.

Hoy eso corre para **un** cliente, al abrir su detalle. La bandera B lo pondría
a correr para **todos**, en cada render de la lista.

Requisitos, no sugerencias:

- `useMemo` sobre `clientLogs` + `allExercises`, siguiendo el patrón de
  `adherenceByClient`.
- **Solo para clientes con estado manual `active`.** Los pausados no generan
  bandera (§3.3), así que calcularlos es trabajo tirado.
- **Una sola pasada por cliente.** Si algún día entran más banderas de métrica,
  que devuelvan todas de la misma llamada en vez de recorrer el log una vez por
  bandera.
- Medir con la semilla antes de dar la fase por buena. Si con 20 clientes y años
  de historial la lista tirita, la salida es calcular la bandera B de forma
  diferida (después del primer render) y no bloquear la lista con ella.

## 5. Descartado, con motivo (no re-litigar)

- **Hueco por grupo muscular.** Decisión del usuario, y el argumento es bueno:
  **el programa está cerrado de antemano**. Si no hay ejercicio de hombro, el
  cliente no va a hacer hombro — el "hueco" no es información nueva, es el
  programa que escribiste. Y si lo que pasa es que se salta siempre ese
  ejercicio, eso **ya se ve en el historial**. Si algún día se quiere, su sitio
  es la card de series por grupo de la pestaña Carga, no el listado.
- **Monotonía / strain.** Se calculan sobre carga interna, que es
  `sRPE × minutos`, y el sRPE es opcional para el cliente (además se oculta con
  menos de 3 sesiones en la semana, [training-load.md](training-load.md) §4.4).
  Estaría apagada para todo cliente que no puntúe sus sesiones. Se retoma cuando
  se sepa cuánta gente lo rellena de verdad.
- **Etapa terminada con siguiente abierta.** No es un aviso: el cliente avanza
  solo. Avisar de algo que se resuelve sin ti es ruido.

## 6. Idea futura que salió de aquí (no es esta spec)

**Distinguir por qué falla un ejercicio: por falta de EJECUCIÓN o por
RENDIMIENTO.** Un ejercicio que el cliente se salta sistemáticamente y uno en el
que se atasca son dos problemas distintos con dos soluciones distintas
(sustituirlo vs. bajar la carga), y hoy los dos se ven igual: como una línea que
no sube.

Los datos están: el log guarda qué se registró y qué no, y `sessionRecap` ya
sabe comparar contra la vez anterior. No hay spec y no corre prisa.

## 7. i18n

`clients.blockDonePill`, `clients.stalledPill`, y el texto del cuarto estado del
hero + su botón. En `src/locales/es.json` Y `en.json`.

## 8. Casos borde (checklist de QA)

| Caso | Resultado |
|---|---|
| Cliente pausado o inactivo | Ninguna bandera nueva, como con adherencia |
| Cliente sin conectar / sin blob de progreso | `blockFinished` false — no hay dato, no hay aviso |
| Etapa sin límite (`durationWeeks: null`) | Nunca "bloque terminado": esa etapa no termina |
| Etapa terminada y la siguiente bloqueada | El aviso de stage-locks, **no** el nuevo. Son excluyentes |
| Cliente en riesgo Y plano | Solo "En riesgo". La exclusión de §3.3 |
| Cliente con 5 semanas de historial | Nunca "estancado": mínimo 8 |
| Cliente que solo hace sesiones libres | No cuentan para el ciclo (ya era así), así que su etapa no termina |
| El entrenador borra etapas por debajo de donde está el cliente | `clientStageIndex` recorta al rango; sin crash |
| 20 clientes con 3 años de log | La lista no puede tiritar al abrirse (§4) |

## 9. Qué NO tocar

- `computeAdherence` y sus umbrales. La bandera B se apoya en su resultado, no
  lo modifica.
- `performanceWeekly` y el resto de `trainingLoad.js`: se consumen, no se tocan.
- El circuito de `stage-locks` (blob de progreso, `clientStageIndex`,
  `stageActivatedAt`). La bandera A **lee** ese blob y nada más.
- La pestaña Carga: el detalle sigue siendo suyo. El listado solo señala.

## 10. Fases

| # | Alcance | Coste |
|---|---|---|
| 1a | ✅ Cuarto estado del hero (aviso + botón al planificador) — ago 2026 | 🟢 |
| 1b | `clientAttention.js` + `blockFinished` + pill con contador en el listado | 🟢 |
| 2 | `isStalled` + memo por cliente + pill, con calibración de `flat` contra la semilla | 🟡 |

La fase 1 no depende de la 2 y cierra el bucle con el planificador, así que va
primero.

**1a hecha, 1b no.** Decisión del usuario: primero el aviso en la ficha, que es
lo que cierra el bucle con el planificador. El aviso vive dentro de
`ActiveProgramHero` ([ClientsScreen.jsx](../../src/screens/ClientsScreen.jsx),
`blockDone`) reutilizando la caja del aviso de etapa bloqueada; no hay
`clientAttention.js` todavía porque no hace falta función pura hasta que la
condición se evalúe para los 20 clientes a la vez. La 1b es la que la pide: ahí
sí se extrae `blockFinished(client, program)` con sus tests y las reglas de §2.2
(estado manual `paused`/`inactive` silencia), que hoy no aplican porque el hero
solo mira al cliente que ya has abierto.
