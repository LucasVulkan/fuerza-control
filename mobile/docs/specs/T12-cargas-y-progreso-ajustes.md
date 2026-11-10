# Spec — Cargas y progreso: ajustes tras la revisión de noviembre

> Tema: entrenamiento
> En corto: Una revisión de cómo se calculan la progresión, el 1RM, la carga y la mejora encontró trece sitios donde la cifra salía mal o se leía mal (reps tras una descarga, series largas que contaban doble, datos que desaparecían al apuntar RPE, «Mejora» a 0 % subiendo reps…). Aquí queda qué se cambió y por qué.
> Inicio: 2026-11-10
> Fin: 2026-11-10
> Fase T12-01 · hecho · Motor de progresión: descarga, series, RPE máximo, suelo al bajar · §3
> Fase T12-02 · hecho · 1RM, récords y carga: series largas, RPE y fuente del panel · §4
> Fase T12-03 · hecho · Mejora, última sesión, volumen y etiqueta de tendencia · §5
>
> Estado: **implementada entera el 10-nov-2026** en develop (versión 1.0.3), por
> probar en dispositivo. Commits: T12-01 `c31812d7`, T12-02 `50a19941`, T12-03
> `9692472c`. 23 tests nuevos (2606 en total, en verde). Tests antiguos que
> cambiaron porque cambia la regla: `oneRm.test.js` (reps + recámara > 12 ya da
> valor), `sessionRecap.test.js` (el RPE ya no hace récord),
> `trainingLoad.test.js` (referencia de series largas) y los dos
> `progression.p18*` (RPE de la serie más dura; el caso 8 de las tablas de P18
> pasa de media 8,8 a máximo 9,5). Los textos de §5.4 entraron en el commit de
> T12-01.

## 1. Por qué

El 10-nov-2026 se repasó toda la lógica de cargas desde el punto de vista de
un atleta o un entrenador que mide su progreso, pasando casos reales por el
motor. La base se dio por buena (un solo chip para tarjeta, guardado y texto;
«sin dato» nunca es cero; el historial de carga no se reescribe). Salieron
trece puntos; doce se corrigen aquí y uno se deja anotado (§6).

Los números de cada «antes» son la salida real del motor ese día.

## 2. Reglas comunes

- Cambios mínimos, en los `utils` puros, cada uno con su test en el `*.test.js`
  de al lado. Nada de pantallas nuevas ni de ajustes nuevos.
- No se reabre nada decidido en P18 (el −10 %, la meta por total, la media de
  tres sesiones en Por esfuerzo): se corrigen sus bordes.
- Textos en `es.json` y `en.json`, añadiendo o cambiando líneas sin reformatear
  el archivo.

## 3. T12-01 — Motor de progresión

Archivo: `src/utils/progression.js` (y `ProgressionSheet.jsx` para 3.5).

### 3.1 Reps y Tiempo: la descarga no cuenta

Antes: 12/12/10 → semana de descarga con 12/12 → la primera sesión de la etapa
siguiente pedía 9/9/9, porque la meta salía del total de la descarga (24 + 3).

Ahora: en `progressionChip`, si el tipo resuelto es `reps` o `time` y el
ejercicio no está en descarga (`hold !== 'deload'`), las sesiones con
`deload: true` se quitan de `recent` antes de calcular, siempre que quede
alguna que no lo sea. Si las tres son de descarga, se calcula como hasta ahora.
Es lo que ya hacía Por esfuerzo. «Peso · por reglas» no cambia.

### 3.2 Reps y Tiempo: cambia el número de series

Antes: 12/12/7 (31) y la sesión pasa a 4 series → pedía 9/9/9/8 (31 + 4
repartido en 4).

Ahora: en `chipVolume`, si las series apuntadas la última vez (`m`) no son las
de hoy (`n`), la meta es el total escalado, `round(total · n / m)`, **sin**
sumar el salto (la serie de más ya es la progresión), con `reason: 'first'`,
`misses: 0` y sin mirar `lastGoal` ni la sesión anterior. 12/12/7 a 4 series →
41 → 11/10/10/10. 4 series de 10 a 3 → 30 → 10/10/10.

### 3.3 «RPE máx.» mira la serie más dura

Antes: con máximo 8 y series a RPE 7 / 7,5 / 9,5 (media 8) subía.

Ahora: `judgeDouble` compara el RPE **más alto** de las series apuntadas, no
la media. Los textos dejan de decir «RPE medio»: `progression.next.extraRpe`,
`progression.next.rpeOver`, `progression.rule.whenRpe` (y los demás que lo
digan, en los dos idiomas) pasan a hablar de «ninguna serie por encima de
RPE X» / la serie más dura. El comentario de cabecera del archivo también.

### 3.4 Bajar nunca deja por debajo de lo recién completado

Antes: 5×5 a 100 completado → sube a 102,5 → 5/5/4/3/3 → proponía 92,5.

Ahora: en la rama de bajar de `chipDouble`, si la sesión anterior fue con
menos peso y cumplió la meta (`prev.up`), el peso propuesto no baja de
`prev.w` → 100. En asistidas, al revés: no se pone más ayuda que la de esa
sesión. Solo mira la sesión inmediatamente anterior.

### 3.5 Por esfuerzo: decir que se va por encima aunque el peso no cambie

Antes: 95, 97,5 y 100 kg × 5 a RPE 8, 7,5 y 7 con objetivo RPE 8 → «Mantén
100 · Clavaste el objetivo», cuando la última sesión sola daría 102,5.

Ahora: el cálculo no cambia (media de tres sesiones). Si el resultado es
mantener pero la última sesión sola (su e1RM, mismo redondeo) daría subir, el
porqué es `progression.why_effortAlmostUp` («Rendiste por encima del objetivo;
con otra sesión así, sube el peso»); si daría bajar, `why_effortAlmostDown`
(«Rendiste por debajo del objetivo; con otra sesión así, baja el peso»). No
aplica cuando «Al llegar» ya sube un escalón.

Además, el aviso de la hoja de Progresión («a partir de 12 reps contando las de
recámara…») salía con 12 justas (10 reps a RPE 8), donde el motor sí calcula:
la condición de `effortUnreliable` pasa de `>=` a `>` y el texto, de «A partir
de 12 reps…» a «Con más de 12 reps…».

**Probar T12-01**

- [ ] Ejercicio por Reps (p. ej. dominadas) tras una etapa de descarga: la
  primera sesión de la etapa siguiente pide reps parecidas a las de antes de la
  descarga, no menos.
- [ ] Ejercicio por Reps al que se le añade una serie en el editor: la meta de
  la sesión siguiente reparte más o menos lo mismo por serie que la última vez.
- [ ] «RPE máx. 8» llegando arriba con una serie a RPE 9: mantiene y el texto
  habla de la serie más dura, no de la media.
- [ ] Reps fijas (5×5): completar, subir, y fallar por mucho → propone volver al
  peso anterior, no un 10 % menos.
- [ ] Por esfuerzo con una sesión más fácil que el objetivo y el peso igual: el
  porqué dice que con otra sesión así sube.
- [ ] Hoja de Progresión, Por esfuerzo con 10 reps a RPE 8: sin aviso; con 11
  reps a RPE 8: con aviso.

## 4. T12-02 — 1RM, récords y carga

### 4.1 Apuntar el RPE ya no borra la serie (`src/utils/oneRm.js`)

Antes: 100×10 sin RPE → 1RM 133; 100×11 a RPE 8 → sin 1RM (11 + 2 de recámara
pasa de 12), y la serie desaparecía de la gráfica de 1RM, de los récords y de
la tarjeta de Fuerza.

Ahora: en `epley1RM`, si las reps apuntadas son ≤ 12, las reps equivalentes
(reps + recámara) se acotan a 12: es una cota baja, el mismo criterio de
`e1rmAtLeast`. Más de 12 reps apuntadas sigue dando `null`.

### 4.2 Las series de más de 12 reps ya no cuentan doble (`src/utils/trainingLoad.js`)

Antes: un ejercicio que siempre se hace a más de 12 reps no tiene 1RM, la
referencia caía al peso máximo y cada rep contaba 1,0, como un máximo: 3×15 =
45 de carga frente a 25,7 de 3×12 con el mismo peso.

Ahora: en `makeRefResolver`, el último respaldo es `maxW × (1 + 12/30)` (al
menos una 12RM), no `maxW`. 3×15 pasa a ~32.

### 4.3 Los récords no dependen del RPE (`src/utils/sessionRecap.js`)

Antes: 100×5 a RPE 8 después de 100×5 a RPE 9 salía como récord de 1RM.

Ahora: `detectPRs` calcula el 1RM solo con peso y reps. Un récord es haber
levantado más, no haberlo apuntado más fácil. (La cifra del récord puede no
coincidir con el 1RM estimado de la ficha del ejercicio, que sí usa el RPE.)

### 4.4 Un RPE de sesión suelto no vacía el panel (`src/utils/trainingLoad.js`)

Antes: con una sola sesión valorada de 24, `loadSummary` pasaba a carga
interna y las medias salían a 0, sin comparación.

Ahora: la fuente es interna solo si al menos la mitad de las sesiones de los
28 días que acaban en `now` tienen carga interna; si en esos 28 días no hay
sesiones, vale la regla anterior (alguna en todo el log). Una sola función
decide la fuente y la usan `loadSummary` y `calendarLoads`.

**Probar T12-02**

- [ ] Ejercicio a 10–12 reps apuntando RPE 7–8: la gráfica de 1RM estimado
  tiene punto en todas las sesiones.
- [ ] Repetir peso y reps de la última vez apuntando un RPE más bajo: el
  resumen no lo marca como récord.
- [ ] Con RPE de sesión en una sola sesión antigua: Progreso › Carga enseña la
  tarjeta CARGA con cifra y comparación.

## 5. T12-03 — Mejora, última sesión, volumen y tendencia

### 5.1 «Mejora» cuenta las reps, no solo el peso (`src/utils/improvement.js`)

Antes: 100 kg pasando de 8 a 12 reps en cinco sesiones → Mejora 0 % (medía el
peso máximo); en 1RM estimado es +11 %. Es la cifra de las tarjetas de
Ejercicios y la «mejora global» de Clientes.

Ahora: `improvementMetric(logs, def)` devuelve la métrica de `seriesMetric`,
salvo que sea `kg` y haya al menos dos sesiones con 1RM estimado, en cuyo caso
es `e1rm`. La usan `computeOverallImprovement`, `computeLastLoadDelta` y el %
de mejora por ejercicio de `ProgressTab.jsx`. El detalle del ejercicio, donde
la métrica se elige a mano, no cambia.

### 5.2 «% última sesión» compara cada ejercicio con su vez anterior

Antes: `computeLastLoadDelta` comparaba la última sesión con la anterior del
log, fuera la que fuera: con un programa A/B no compartían ejercicios y salía
vacío.

Ahora: cada ejercicio de la última sesión se compara con la sesión anterior
más reciente que lo contiene.

### 5.3 El volumen usa el peso que de verdad se mueve

Antes: `recapStats` multiplicaba el peso apuntado por las reps. En una
asistida el peso apuntado es la ayuda: 8 reps con 30 kg de ayuda daban 240 y
con 10 kg, 80.

Ahora: `recapStats(entry, { allExercises, fallbackBodyWeight })` usa
`effectiveWeight`. Si no se puede calcular (falta el peso corporal): una
asistida no suma, y el resto suma el peso apuntado como antes. Sin
`allExercises` se comporta como antes. Para no crear un ciclo de imports,
`isBodyweight` y `effectiveWeight` pasan a `src/utils/effectiveWeight.js` y
`trainingLoad.js` las reexporta. Los llamadores que enseñan volumen
(`SessionRecapScreen`, `HistoryList`, `ClientsScreen` con el peso del cliente,
y `ProgressTab` vía `volumeChange`) pasan la librería. `ProgressTab` no pasa
peso corporal de respaldo porque también pinta clientes: ahí una asistida sin
peso corporal en la sesión no suma.

### 5.4 La tendencia describe, no diagnostica

Antes: al pasar de 4×10 al 70 % a 5×3 al 90 % la carga baja (30 → 13,6) y el
esfuerzo sube, y la etiqueta decía «fatiga» en un bloque de intensificación
planificado.

Ahora: `load.trend.fatigue` dice «más esfuerzo sin más carga» / «more effort,
no more load». La clave y la lógica no cambian. Si alguna ficha de métrica lo
explica como fatiga, se ajusta al mismo tono.

**Probar T12-03**

- [ ] Ejercicio en el que solo han subido las reps estas semanas: su tarjeta en
  Progreso › Ejercicios marca mejora positiva.
- [ ] Programa con sesiones A y B: tras una sesión B, el «% última sesión» de
  Progreso tiene cifra.
- [ ] Resumen de una sesión con dominadas asistidas quitando ayuda respecto a
  la vez anterior: el volumen no baja por eso.
- [ ] Progreso › Carga › Esfuerzo vs carga con más esfuerzo y la misma carga:
  la etiqueta dice «más esfuerzo sin más carga».

## 6. Lo que no se toca

- **Pirámides y serie tope con series de bajada.** El motor toma el peso máximo
  de la sesión y juzga todas las series como si fueran a ese peso. Límite
  conocido; se abordará si alguien lo pide.
- **«Peso · por reglas» tras una descarga** sigue manteniendo el peso en la
  primera sesión de vuelta.
- **La media de tres sesiones de Por esfuerzo** se queda: va medio punto de RPE
  por detrás de un atleta que mejora cada sesión, a cambio de no mover el peso
  por un RPE mal apuntado. Solo cambia el texto (§3.5).
