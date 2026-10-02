# Spec — Progresión clara

> Tema: programas
> En corto: El motor de progresión ya cubre casi todas las formas de entrenar, pero daba consejos equivocados en cuatro casos y ni el editor ni el Workout dejaban claro qué decide. Primero se arreglan los fallos; después se ordena en tres preguntas (qué pides, qué sube, cuándo y cuánto) y el plan del motor pasa a ser el gris de cada serie.
> Fase P52 · hecho · Cuatro fallos del motor · §2
> Fase P53 · terminado · Diseño y maqueta: Qué pides, la hoja de Progresión y el plan en el Workout · §3
> Fase P54 · hecho · Motor: el modelo nuevo y el plan de cada serie · §4
> Fase P55 · hecho · Editor: Qué pides y la hoja de Progresión · §5
> Fase P56 · pendiente · Workout: el plan en el gris y la línea de recomendación · §6
> Fase P57 · pendiente · La última vez: botón, línea o debajo de cada serie · §7
>
> Estado: **P55 hecha** (2-oct-2026, `400d1de` + `56327d5`; falta probarla a mano). **P54 hecha** (2-oct-2026, `2fc2f19`; falta probarla a mano). **P52 hecha y probada** (1-oct/2-oct-2026, `f5311ef` + arreglos de QA
> `fa2e48f`, `6f8cb45`, `0f9e3a8`; rama `feat/recap`). **P53 (diseño) cerrada** con el usuario el 1-oct: maqueta
> `docs/mockups/progression.html`, decisiones en §3.1. Implementación en cuatro
> fases encadenadas, P54 → P55 → P56 → P57 (§4-§7), escritas para que las haga un
> subagente sin más contexto. Fuera a propósito, sin decidir (§3.1-bis): tiempo
> con carga y dónde enseñar «Próxima sesión». La escalera (top set + back-off,
> pirámide invertida) va **después**, como extensión de «Qué pides»: sin motor nuevo.

---

## 1. Formas de entrenar que hay que soportar

| # | Forma de entrenar | Qué sube y cuándo | Antes de P52 |
|---|---|---|---|
| A | Hipertrofia por rango (3×8–12) | Todas al máximo → peso | ✅ Doble |
| B | Fuerza lineal (5×5) | Todas completas → peso | ✅ «Peso» = Doble con mín = máx |
| C | Fuerza autorregulada (5 @ RPE 8) | El peso sale del e1RM | ✅ Por esfuerzo |
| D | Peso corporal | Reps | ⚠️ roto (§2.1) |
| E | Asistidas | Baja la asistencia | ⚠️ se rompía al editar (§2.3) |
| F | Tiempo | Tiempo | ⚠️ atascado (§2.2) |
| G | Accesorio sin progresión | Nada | ✅ Fija |
| H | Descarga | Mantener | ✅ etapas (`hold: 'deload'`) |
| I | Pesado / ligero en días distintos | Cada uno por su lado | ✅ sin vincular |
| J | Top set + back-off, pirámide invertida | El top set, y el resto le sigue | ❌ escalera, después de P53 |
| K | Porcentajes de 1RM (5/3/1, ondulante) | El ciclo | ❌ **fuera** (decisión del usuario, 1-oct) |

Pesos objetivo por serie: **descartados** (usuario, 1-oct). La progresión parte
del peso de la última sesión; sin historial, el Workout dice qué peso buscar.
`progression.seed` no lo lee nadie: se borra en P53.

## 2. P52 — Cuatro fallos del motor

Todos en `src/utils/progression.js`, comprobados contra el motor real antes de
tocarlo y cubiertos en `progression.test.js` (`describe('P52 …')`).

### 2.1 Reps proponía lo mismo hicieras lo que hicieras

`chipReps` evaluaba sin objetivos (cualquier serie marcada contaba) y proponía
`maxReps + salto`. Con 9/8/8 o con 13/13/13 decía «sube a 15»: el salto era el
`weightStep` (2,5 → 3 reps). **Ahora**: si todas llegan al mínimo, el objetivo
es la serie más floja + el salto; si no, mantener.

### 2.2 Tiempo nunca pasaba del máximo

El objetivo vive en la plantilla y el motor no tiene memoria, así que
`maxTime + salto` era siempre el mismo número (45 s hechos → «sube a 42,5»).
**Ahora**: la misma regla que Reps, desde la serie más floja, redondeado a
segundos. El salto por defecto es 5 s.

`defaultIncrement(type, def)` da el salto por defecto según lo que sube (1 rep,
5 s o `weightStep`). El editor lo aplica al cambiar «Qué progresa». Si ya tenías
un ejercicio en Reps o Tiempo guardado con 2,5, hay que volver a fijar el salto.

### 2.3 Una asistida editada pedía más asistencia

El editor guardaba siempre `direction: 'increase'`. Ahora no la guarda, y
`resolveProgressionConfig` toma la del ejercicio (`def.progressionDirection`)
por encima de la de la plantilla, así que lo ya guardado también se corrige.

### 2.4 «% mínimo» no hacía nada en Doble

La hoja lo ofrecía y `chipDouble` exigía siempre todas las series al máximo.
`hitMaxEnough` lo lee ahora, en Doble y en asistidas.

Queda fuera a propósito (va en P53): medida Tiempo + tipo Doble sugiere «sube a
2,5 kg» en una plancha. Es una combinación que el editor no debería ofrecer.

**Probar P52**

- [x] Dominadas: en el editor, Progresión → Automática y en «Qué progresa»
  elegir **Reps** (por defecto vienen en Doble). Rango 6–12, hacer 9/8/8 → la
  próxima vez la tarjeta dice «↑ SUBIR A 9 reps +1» y debajo «tu serie más floja
  fue de 8», con la misma letra que el peso. Hacer 7/6/5 → «→ MANTENER 6 reps»
  y «alguna serie no llegó a 6».
  (2-oct: la cifra era una frase larga con otra letra y sin motivo; arreglado y
  probado.)
- [x] Plancha en Automática · Tiempo, 30–60 s: hacer 45/45/40 → la próxima vez
  propone 45 s. Al cambiar el tipo a Tiempo en el editor, el salto pasa a 5 s.
  (2-oct: probada. Faltaba el delta, que salía vacío al contarse desde la mejor
  serie; ahora dice «45 s +5», contado desde la serie de la que parte.)
- [x] Dominadas asistidas: cambiar las series en el editor y completar todas al
  máximo con 20 kg → la tarjeta dice «↑ MENOS AYUDA 17.5 kg −2.5».
  (2-oct: decía «Subir a 17.5»; arreglado con `assist` en el chip y probado.)
- [x] Press banca en Doble con «% mínimo» al 60 %: 2 de 3 series al máximo → sube,
  y el motivo dice «2 de 3 series llegaron a 12».
  (2-oct: el motivo decía «todas las series»; arreglado con `why_partHit` y probado.)

## 3. P53 — Qué pides en el editor, la progresión en su hoja, el plan en el Workout

Maqueta v2: [`docs/mockups/progression.html`](../mockups/progression.html). La hoja
de Progresión es interactiva: cada paso ofrece solo lo que encaja con lo anterior.

### 3.1 Decisiones del usuario (1-oct-2026, revisión de la v1)

1. **Qué pides** se queda en el editor (medida, series, descanso, rango o reps
   fijas). **Todo lo que automatiza** (qué sube en adelante) va en la hoja de
   Progresión, con pasos que aparecen según lo elegido.
2. **El RPE no se pide en Qué pides.** Es criterio de la progresión: «Por
   esfuerzo» o «Cuándo sube: RPE máx.» en cualquier progresión por reglas (la
   flexibilidad de hoy: Doble + se cumple con RPE). Si la progresión lo
   necesita, Registrar RPE se enciende solo y queda bloqueado.
3. **La hoja no deja montar nada que no funcione**: lo que nunca aplica no sale,
   y lo que depende de algo que se puede cambiar sale apagado y dice por qué.
4. **Si no se cumple, mantener o bajar. Nada de subir reps por serie**: en
   Mantener, el gris es lo que hiciste la última vez.
5. **Cuándo baja** pasa a ser un paso propio (solo Peso por reglas).
6. **Por esfuerzo** elige cuándo sube: al superar el objetivo (lo de hoy) o al
   llegar a él.

7. **«% mínimo» pasa a «Parcial: N de M series».** El porcentaje no se entendía.
8. **Cuándo baja: Nunca · Si fallan N de M.** Sin «2 fallos seguidos». La hoja
   impide que bajar choque con subir (§3.2).
9. **El escalón de peso se ve** donde se usa (subir por %, Por esfuerzo y su
   «Al llegar», que sube un escalón).
10. **Al cambiar el peso, el gris pide el objetivo de progresión**: las reps
    fijas, o el máximo del rango.
11. **Última vez: línea (sin color), botón o debajo de cada serie, a elegir en
    Ajustes. Por defecto, el botón.** Fuera la columna estilo Strong.
12. **El escalón es por ejercicio**, partiendo del `weightStep` de la librería y
    editable en la hoja. Por material sería más exacto, pero un gimnasio tiene
    demasiadas máquinas distintas.
13. **La frase del motivo bajo la recomendación sobra** («completaste 3 × 12 con
    60 kg»): rompe la rejilla de la tarjeta. **Se queda la variante A · Suelta**:
    una línea con qué hacer, cuánto y el delta (`↑ SUBIR A 62.5 kg +2.5`), sin
    frase y **sin icono**. La línea entera se pulsa y abre una ficha con la regla,
    lo de la última vez y lo de hoy. **A2 · Banda** (la misma línea sobre un
    fondo) se prueba en el móvil al implementar. B (en la cabecera) no cabe con
    nombres largos y C (en la columna) no sobrevive a tres columnas con RPE.

14. **Reps y Tiempo: la meta es la última + el salto** (2-oct). Con «Qué sube:
    Reps», un rango 6–12 no significa nada: se progresa a 20 y la tarjeta sigue
    diciendo 6–12. Qué pides pasa a ser **un valor de inicio** (reps o
    segundos), que hace de suelo, y la meta de hoy es **la serie más floja de la
    última sesión + el salto**. Se descartó «la meta se mantiene hasta
    cumplirla»: obligaba a repasar todo el historial y borrar una sesión la
    cambiaba; esta sigue a lo que haces de verdad, también en un mal día.
    Detalle en §4.4.

### 3.1-bis Sin decidir

- **Tiempo con carga** (§3.2): la propuesta está en la maqueta (caso F2). No se
  implementa hasta que se decida.
- **«Próxima sesión» en el Resumen del editor: no es definitivo.** Añade mucha
  altura al bloque. Que el entrenador y el cliente vean lo que toca la próxima
  vez sí tiene sentido, pero falta decidir dónde.

### 3.2 La hoja, paso a paso

| Paso | Opciones | Cuándo sale / qué la limita |
|---|---|---|
| Qué sube | Peso · Reps · Tiempo · Nada | Reps → Peso, Reps, Nada. Tiempo → Tiempo, Peso, Nada. Sin carga → nunca Peso. Asistido → «Asistencia ↓» |
| Cómo | Por reglas · Por esfuerzo | Solo Peso con medida Reps y carga externa. Por esfuerzo exige reps fijas (con rango, apagado y con el motivo) |
| Cuándo sube | Todas · Parcial (N de M) · RPE máx. | Por reglas, Reps y Tiempo. Parcial de 1 a M−1. La meta sale de Qué pides: máximo o reps fijas (Peso), mínimo (Reps, Tiempo) |
| RPE objetivo · Escalón · Cuándo sube | Al superarlo · Al llegar | Solo Por esfuerzo |
| Cuánto sube | Fijo · Porcentaje (redondea al escalón) | Peso: kg o %. Reps y Tiempo: enteros, sin % |
| Cuándo baja | Nunca · Si fallan N de M | Solo Peso por reglas. Con «Parcial N de M», bajar exige al menos M−N+1 fallos |

Por qué ese mínimo: con «Parcial N de M», una sesión que sube deja como mucho
M−N series fuera; si bajar pidiera M−N o menos, la misma sesión cumpliría las
dos reglas.

Lo de hoy, comprobado: baja si **menos del 60 % de las series llega al mínimo**.
Es «Si fallan» con su valor por defecto, ⌊M·0,4⌋+1: 2 de 3, 2 de 4, 3 de 5.

**Tiempo con carga** (propuesta, **sin decidir**, §3.1-bis): con medida Tiempo y un
ejercicio con carga, «Peso» es una doble progresión en segundos: todas llegan al
máximo → sube el peso y el tiempo vuelve al mínimo. Arregla además la
combinación que la P52 dejó fuera (Tiempo + Doble sugería kilos en una plancha).

### 3.3 Lo que pide al motor

- `evaluation.mode: 'part'` con un número de series (sustituye a `'pct'` y
  `pctThreshold`).
- `progression.down: null | { fails: N }`: sustituye al 60 % fijo.
- `progression.effortWhen: 'beat' | 'reach'`. 'reach': si la sesión cuadra, sube
  un escalón.
- Escalón por ejercicio: `exConfig.weightStep` por encima del de la librería.
  Sustituye a `increment.minIncrement`.
- Tiempo + Peso (si se decide): la doble progresión de `chipDouble` sobre segundos.
- La evaluación por RPE deja de depender de que Registrar RPE esté encendido:
  lo enciende la propia progresión.
- Fuera `seed`, `custom`, `stepped` y `minRir`, que nadie usa.

### 3.4 Workout

La línea de progresión (variante A, §3.1.13) encabeza el plan y **el gris de cada serie es el
plan**: el peso de la progresión y las reps del objetivo. Si no se cumplió, el
gris es lo que hiciste. ✓ acepta lo que se ve: `saveSession.resolveSet` y la
tarjeta tienen que salir de una sola función. Sin historial, «busca un peso con
el que hagas 8–12». Lo de la última vez: línea sin color, botón de historial o
debajo de cada serie, a elegir en Ajustes.

Decisiones abiertas: las de la maqueta, §«Para decidir».

---

## Implementación (P54–P57)

Cuatro fases, en este orden: cada una depende de la anterior. Todo en la rama
viva (`feat/recap`), un commit por fase como mínimo.

**Verificación de cada fase** (además de sus tests): `npx vitest run` en
`mobile/` sin fallos; `npx eslint <archivos tocados>` sin errores **nuevos**
(hay errores previos: comparar el recuento contra HEAD); `npx expo export
--platform android` para pillar imports rotos. Textos nuevos en `es.json` **y**
`en.json`, añadidos línea a línea (nunca reescribir el JSON con un script que lo
reformatee). Al cerrar la fase: cabecera a `hecho`, fila en §8 con el commit,
`npm run estado`.

**No se toca**: `CustomExerciseScreen` (su progresión es la de la librería),
`prescription.targetLabel` y las listas (Por esfuerzo sigue siendo
`type: 'effort'`), el tiempo con carga y «Próxima sesión» (§3.1-bis).

## 4. P54 — Motor: el modelo nuevo de la progresión

Solo `src/utils/` y sus tests. No cambia ninguna pantalla, pero sí lo que
proponen tres casos (§4.6).

### 4.1 El modelo

`exConfig.progression` (se mantienen los nombres internos para no arrastrar
cambios: `double` es «Peso · por reglas»):

```js
{
  type: 'double' | 'reps' | 'time' | 'effort' | 'none',
  evaluation: {
    mode: 'all_complete' | 'part' | 'rpe',   // UI: Todas · Parcial · RPE máx.
    need: 2,                                  // 'part': series que tienen que llegar
    maxRpe: 8,                                // 'rpe'
  },
  increment: { type: 'fixed' | 'pct', value: 2.5, pct: 5 },
  down: 'never' | { fails: 2 },               // solo 'double'; ausente → valor por defecto (§4.3)
  targetRpe: 8,                               // 'effort'
  effortWhen: 'beat' | 'reach',               // 'effort'; ausente → 'beat'
  hold: null | 'deload',                      // lo escribe applyRx, sin cambios
}
```

`exConfig.weightStep` (nuevo, **fuera** de `progression`): el escalón de peso
del ejercicio. Ausente → `def.weightStep` si es > 0, si no 2,5.

`resolveProgressionConfig(exConfig, def)` devuelve siempre la forma completa y
añade `step` (el escalón resuelto) y `direction` (del `def`, P52). Lectura de lo
antiguo, sin migrar datos:

| Guardado | Se lee como |
|---|---|
| `type: 'weight'` | `'double'` con meta = `minReps` (el editor de hoy deja guardar `'weight'` con rango, y su meta era el mínimo: leerlo con `maxReps` cambiaría cuándo sube) |
| `evaluation.mode: 'pct'` + `pctThreshold` | `'part'` con `need = ceil(pctThreshold · sets)` |
| `'part'` sin `need` | `need = ceil((pctThreshold ?? 0,8) · sets)` (el editor sigue guardando `pctThreshold` hasta P55) |
| `increment.type: 'stepped'` | `'fixed'` con `value` del primer escalón |
| `increment.minIncrement` | se ignora (lo sustituye `step`) |
| `seed`, `minRir`, `custom` | se ignoran |

Se borran de `progression.js` el código y la cabecera que describen `seed`,
`custom`, `stepped`, `minIncrement` y `minRir`, y `applyMinIncrement`.

`stageRx.scaleIncrement` redondea hoy a `minIncrement`: pasa a redondear al
`step` resuelto (que `applyRx` ya puede sacar de `resolveProgressionConfig`).
`applyRx` materializa la config resuelta en `next.progression`: **no** escribe
`step` ni `direction` (son del ejercicio, se resuelven siempre), y `down` se
escribe solo si venía guardado. Por eso `resolveProgressionConfig` deja `down`
como está (ausente → `null`) y el valor por defecto de §4.3 lo calcula el chip
con las series de la sesión: si se resolviera con las de la etapa base, una
etapa con más series heredaría un `fails` que no le toca.

**Puente hasta P55** (única excepción a «solo `src/utils/`»): el editor lee
`evaluation.mode` y no conoce `'part'`. En `computeInitial`
(`ExerciseEditorInline.jsx`) se lee `'part'` como `'pct'` con
`evalPct = round(need / sets · 100)`. Nada más; P55 sustituye ese estado.

`exerciseLinks.LINKED_CONFIG_KEYS` añade `'weightStep'`: el escalón viaja con el
grupo, como el resto de la configuración.

### 4.2 Un solo chip para «Peso · por reglas»

`chipWeight` y `chipDouble` se funden en uno (`chipDoubleDecrease` sigue siendo
su espejo para asistidos, con la misma lógica). Con `G` = `maxReps` (la meta;
con reps fijas `min = max`), `F` = `minReps` (el suelo) y `n` = series de la
plantilla:

```
alMeta  = series con reps ≥ G (o marcadas sin reps)
alSuelo = series con reps ≥ F (o marcadas sin reps)       ← countQualifyingSets
sube    = all_complete: alMeta ≥ n
          part:         alMeta ≥ need
          rpe:          alMeta ≥ n  y (sin RPE apuntado  o  RPE medio ≤ maxRpe)
baja    = down ≠ 'never'  y  (n − alSuelo) ≥ down.fails  y  peso > 0
orden   = sube → baja → mantener
```

**Desaparece la bajada escondida por RPE > 9,5** que tenía `chipDouble`: bajar
es solo la regla explícita. La «mayoría al mínimo» (`mostHitMin`, 0,8) también
sobra: lo que no sube ni baja, mantiene.

`why` del chip: `why_allHit` (sube con todas), `why_partHit` (nuevo: «{{need}}
de {{n}} series llegaron a {{goal}}»), `why_rpeAbove` (nuevo: llegó a la meta
pero con RPE medio > maxRpe), `why_belowMin` (baja), `why_holdReps` (mantener).

### 4.3 Cuándo baja: el valor por defecto

`down` ausente = `{ fails: floor(n · 0,4) + 1 }`. **Es exactamente lo de hoy**
(«menos del 60 % de las series al mínimo»: 2 de 3, 2 de 4, 3 de 5),
comprobado contra el motor. El valor por defecto y el recorte de `fails` a
`[1, n]` se calculan en el chip, con la `n` de la sesión, porque una regla de
etapa puede cambiar `n` (§4.1, `applyRx`).

Si una etapa sube las series y la regla de bajar queda por debajo de
`n − need + 1`, no se corrige: el orden «sube → baja» decide y no hay error.

### 4.4 Reps, Tiempo y Por esfuerzo

- **Reps y Tiempo: la meta es la última + el salto** (§3.1.14). Sin historial
  ni memoria: solo la última sesión, como en P52.
  - Qué pides guarda **el inicio**: `minReps = maxReps = inicio` (o
    `minTime = maxTime`). Con Reps o Tiempo no hay rango.
  - Si se cumple (`all`, `part` o `rpe`, con las series ≥ inicio): meta =
    serie más floja + salto, `type: 'up'`. Si no: meta = inicio, `type: 'hold'`.
  - El chip trae siempre la meta (`suggestedReps` / `suggestedTime`), `from`
    (la serie más floja, para el delta) y `why`. **Esto ya está hecho** (QA
    P52, 2-oct): antes Reps no traía número y la tarjeta pintaba la frase larga
    en el hueco de la cifra. Lo que queda para P54 es quitar el rango (meta =
    inicio como suelo) y el `part`.
- **Por esfuerzo**: redondea al `step` resuelto, que en Por esfuerzo es
  `exConfig.weightStep` o, si no, `min(def.weightStep, 2,5)`: ahí el escalón es
  la resolución de la carga, no el salto. Con el de la librería tal cual (5 kg)
  un punto de RPE (+2,8 %) no movía el peso por debajo de ~90 kg y todo era
  «mantener» (QA P54.3, ya visto en QA P48). El usuario lo ve y lo puede cambiar
  en la hoja, también por encima de 2,5.
  Con `effortWhen: 'reach'`: si el cálculo deja el peso igual (`type: 'hold'`)
  y todas las series llegaron a las reps objetivo, sube un `step`
  (`type: 'up'`, `why_effortReached`, nuevo).
- `increment.type: 'pct'` redondea al múltiplo de `step` más cercano, nunca por
  debajo de `step`. **Solo en peso** (Doble, asistidos): en Reps y Tiempo el
  escalón es de kilos y no aplica; siguen redondeando a entero, mínimo 1, como
  hoy.

### 4.5 El plan de cada serie: `src/utils/setPlan.js` (nuevo)

Hoy el gris se decide en **dos** sitios que se copian a mano: la tarjeta
(`ExerciseCard.jsx`, gris en ~808-835 y relleno de ✓ en ~876-899) y el guardado
(`useStore.saveSession → resolveSet`, ~2491). Si divergen, lo que se ve en gris
no es lo que se guarda. Una sola función pura para los dos:

```js
planSet({ exConfig, def, chip, lastSets, overrideEx, index })
  → { weight: Ref, reps: Ref, time: Ref, rpe: Ref }   // Ref = { value: string, source }
```

Por campo, el primero que tenga valor:

1. **Objetivo del entrenador** (`overrideEx[campo]`) → `source: 'coach'`.
2. **El plan**, `source: 'plan'`:
   - `chip.effort` → peso = `chip.suggestedWeight`; reps = `minReps`.
   - `chip.suggestedWeight != null` y `chip.type !== 'hold'` → peso =
     `suggestedWeight`; reps = la meta (reps fijas, o `maxReps` con rango).
   - `chip.suggestedReps != null` y `chip.type === 'up'` → reps =
     `suggestedReps`. En mantener, el gris es lo que hiciste (decisión 4), no el
     inicio.
   - `chip.suggestedTime != null` y `chip.type === 'up'` → tiempo = `suggestedTime`.
3. **La última vez** (`lastSets[index][campo]`) → `source: 'last'`.
4. Nada → `{ value: '', source: 'none' }`.

`'plan'` se pinta igual que `'last'` (gris); solo `'coach'` va en azul. El RPE
solo tiene `coach`. `resolveRef` y `resolveExerciseReference`
(`sessionOverride.js`) se quedan para lo que no son series, si queda algún uso;
si no, se borran.

### 4.6 Lo que cambia para el usuario

1. Una serie mala con RPE > 9,5 ya no baja el peso sola: mantiene.
2. En Doble, con al menos el 80 % de las series en el suelo, el texto era «Bien
   ejecutado… busca más reps»; ahora es el de mantener (`normal_hold`). El peso
   no cambia.
3. ~~Por esfuerzo redondea al escalón del ejercicio, no a 2,5 como máximo.~~
   Revertido en QA P54.3: sin escalón propio, sigue siendo como mucho 2,5.

### 4.7 Tests

`progression.test.js`: la tabla de §4.2 caso a caso (all/part/rpe × sube/baja/
mantiene, con 3 y 5 series), el valor por defecto de `down` contra los cinco
casos de §3.2, `down: 'never'`, asistidos espejo, lectura de lo antiguo (§4.1),
`effortWhen: 'reach'`, `step` en `pct` y en Por esfuerzo, `suggestedReps`.
`setPlan.test.js` (nuevo): el orden de §4.5, un campo por fuente, la meta con
rango y con reps fijas, Por esfuerzo, sin historial. `stageRx.test.js`:
`incrementScale` redondea al `step`.

**Probar P54**

- [x] Press banca 3 × 8–12 en Automática: 12/12/12 con 60 kg → «Subir a 62.5»;
  12/10/9 → «Mantener 60»; 9/7/7 → «Bajar a 57.5».
- [x] El mismo press banca con **Registrar RPE** encendido y **Cuándo sube =
  RPE** (máx. 8): hacer 12/10/9 con 60 kg, las tres a RPE 10 → «Mantener 60».
  Antes de P54 decía «Bajar a 57.5» (la media de RPE pasaba de 9,5); ahora solo
  baja la regla de fallos, y 12/10/9 no falla ninguna.
- [x] Peso muerto Por esfuerzo 3 × 4 @8, con 60 kg: hacer 3 × 4 @7 → «Subir a
  62.5»; hacer 3 × 5 @8 → también «Subir a 62.5» (las dos equivalen a 7 reps
  a fallo).
  (2-oct: con el escalón de librería, 5 kg, las dos decían «Mantener»: +2,8 %
  no llegaba a medio escalón. Arreglado: en Por esfuerzo, como mucho 2,5 salvo
  escalón propio.)
- [x] Una etapa de descarga sigue diciendo «Descarga» y no sube ni baja.

## 5. P55 — Editor: Qué pides y la hoja de Progresión

`src/components/editor/ExerciseEditorInline.jsx` y textos. La maqueta
(`docs/mockups/progression.html`, hoja interactiva) es la referencia de qué paso
sale cuándo; aquí va lo que la maqueta no dice.

### 5.1 Volumen (Qué pides)

- Si Qué sube es **Reps o Tiempo**, Volumen enseña un solo campo, «Reps de
  inicio» o «Tiempo de inicio» (§4.4), y no el segmentado de rango. Al pasar a
  Reps desde un rango, el inicio es el mínimo del rango.
- Se queda el segmentado Reps · Tiempo y debajo, solo con Reps, uno nuevo:
  **Rango · Reps fijas**. Se deduce de `minReps === maxReps`. Pasar a fijas
  deja `maxReps = minReps` y un solo `StepField` horizontal «Reps» (el de Por
  esfuerzo hoy). Pasar a rango pone `maxReps = minReps + 4`.
- El campo «Reps objetivo» de Por esfuerzo desaparece de aquí: con Reps fijas ya
  es ese campo.
- La etiqueta de la sección sigue siendo VOLUMEN (Figma).

### 5.2 La fila PROGRESIÓN

Título según la configuración: «Sin progresión», «Automática · Peso»,
«Automática · Asistencia», «Automática · Reps», «Automática · Tiempo»,
«Por esfuerzo · RPE 8». Subtítulo y línea del Resumen: la **frase de la regla**,
de una función nueva `progressionRule(exConfig, def, t)` en `progression.js`
(o en un `progressionText.js` si crece), que también usará la ficha del Workout
(P56). Frases (las de la maqueta):

- Peso: «Sube 2.5 kg cuando todas las series lleguen a 12 · baja si fallan 2 de 3».
  Asistido: «Quita … · más ayuda si fallan …». Con Parcial: «cuando 2 de 3
  series…». Con RPE: «cuando todas las series con RPE ≤ 8…». Con `down: 'never'`
  sin la cola.
- Reps / Tiempo: «+1 rep sobre tu serie más floja cuando todas las series pasen de 6».
- Por esfuerzo: «Peso calculado para 5 reps a RPE 8 · sube al superar el objetivo».
- Nada: «El peso lo cambias tú».

**«Próxima sesión» no se implementa** (§3.1-bis).

### 5.3 La hoja

Sustituye entera la hoja actual (modo → tipo → cuándo → cuánto, ~890-1050). Los
pasos se numeran según los que salgan. Reglas de qué se ofrece:

| Paso | Sale si | Opciones |
|---|---|---|
| **Qué sube** | siempre | Medida Reps: Peso (solo si `canAddWeight(def)`, §5.3-bis; «Asistencia ↓» si `def.progressionDirection === 'decrease'`), Reps, Nada. Medida Tiempo: Tiempo, Nada |
| **Cómo** | Peso, medida Reps, carga externa, no asistido | Por reglas · Por esfuerzo. Por esfuerzo **apagado** con rango, con la pista en naranja «Por esfuerzo necesita reps fijas: cámbialo en Volumen» |
| **RPE objetivo** | Por esfuerzo | `StepField` 6–10 + «N en recámara» |
| **Escalón de peso** | Por esfuerzo | `StepField` paso 0,25, mín. 0,25, y la opción **Exacto** (§5.4-bis) |
| **Cuándo sube** (esfuerzo) | Por esfuerzo | Al superarlo · Al llegar, con su pista |
| **Cuándo sube** | Por reglas, Reps, Tiempo | Todas · Parcial · RPE máx. Parcial: `StepField` «Tienen que llegar» con valor «N de M», de 1 a M−1. RPE máx.: `StepField` 6–10 |
| **Cuánto sube** | Por reglas, Reps, Tiempo | Peso: Fijo · Porcentaje + valor; con Porcentaje, además **Escalón** («Redondea al escalón»). Reps: entero 1–10. Tiempo: entero en pasos de 5 s |
| **Cuándo baja** | Peso por reglas y Asistencia ↓ | Nunca · Si fallan. Si fallan: `StepField` «Series bajo el mínimo» con valor «N de M», mínimo `M − need + 1` con Parcial y 1 si no, con la pista de por qué |

Coherencia, en una función `normalize` del estado del editor que se llama al
abrir (en `computeInitial`) y tras cada cambio (como en la maqueta, cuyo JS es
la referencia: `normalize`, `showHow`, `effortReason`, `needsRpe`): si lo elegido deja de valer, vuelve al primero
válido (Qué sube) o a Por reglas (Cómo); `need` y `fails` se recortan a su
rango cuando cambian las series. Al cambiar Qué sube, el salto vuelve a su valor
por defecto (`defaultIncrement`, P52).

El valor por defecto de `fails` en el editor es el de §4.3. Se guarda siempre
`down` explícito (`'never'` o `{ fails }`) al guardar desde el editor.

### 5.3-bis Ejercicios sin carga: Peso solo si se pueden lastrar (revisión 2-oct)

`isBodyweight(def)` solo no vale: las dominadas, los fondos y las flexiones
lastradas son de peso corporal y se progresan con lastre (P41 juntó las
lastradas en Dominadas). La librería ya lo dice con el escalón: de los 66
ejercicios sin carga, solo esos tres tienen `weightStep > 0`.

- `canAddWeight(def)` en `progression.js` (exportada): `!isBodyweight(def) ||
  def.weightStep > 0`. `isBodyweight` viene de `trainingLoad.js` (no hay ciclo
  de imports).
- **Motor**: `resolveProgressionConfig` lee `type: 'double'` como `'reps'` si
  `!canAddWeight(def)` y la dirección es `'increase'` (los asistidos no
  cambian). Son ~40 ejercicios de la librería (hollow, rueda, dominadas supinas,
  crunch…) que vienen en Doble con escalón 0 y proponían kilos. Con eso el
  editor, que inicializa desde `resolveProgressionConfig`, y el motor dicen lo
  mismo. Test: `pull_up_supine` (0) → `reps`; `pull_up` (2,5) → `double`;
  `pull_up_assisted` → `double` con `decrease`.
- **Cómo** (Por esfuerzo) sigue exigiendo carga externa (`!isBodyweight`): en
  un lastrado el `weight` es solo el lastre y el e1RM saldría mal.

### 5.4 Registrar RPE

Si la progresión necesita RPE (Por esfuerzo, o Cuándo sube = RPE máx.), el
`ToggleRow` de Registrar RPE se muestra encendido, **bloqueado** y con la pista
«Lo pide la progresión», y se guarda `trackRpe: true`. Hoy eso solo lo hacía Por
esfuerzo; la opción RPE máx. ya no depende de haberlo encendido antes.

### 5.4-bis Por esfuerzo: el 1RM y el peso exacto (QA P54, 2-oct)

Decisión del usuario: quien elige Por esfuerzo es avanzado y quiere ver el
1RM estimado y, si lo pide, el peso calculado sin redondear.

- **Motor** (`progression.js`, `chipEffort`): el chip trae además `e1rm` (la
  media de las series de la última sesión, la que usa el cálculo; en P56 pasa
  a ser la media de las tres últimas, §6.5) y `raw` (el peso antes de
  redondear). Ambos `null` cuando no hay cálculo (sin RPE, poco fiable,
  descarga).
- **Exacto**: se guarda `exConfig.weightStep: 'exact'`, pero
  `resolveProgressionConfig` **nunca** devuelve un `step` que no sea número
  (`stageRx.scaleIncrement` y `defaultIncrement` hacen cuentas con él: daría
  `NaN`). Devuelve `step` como si no estuviera (el de la librería con tope 2,5)
  y `exact: true`, solo con `type: 'effort'`; en Por reglas, `exact: false` y
  se lee como ausente. `chipEffort` con `exact` redondea `raw` a 0,1 kg en vez
  de al escalón. Con Exacto no sale
  el paso «Cuándo sube» de Por esfuerzo (el peso se mueve con cualquier
  cambio y «Al llegar» no se daría nunca): se guarda `effortWhen: 'beat'`.
- **Hoja**: el paso Escalón es un segmentado **Escalón · Exacto**; con Escalón,
  el `StepField` de siempre debajo. Pista de Exacto: «Propone el peso
  calculado tal cual: tú decides qué cargas».
- Tests: `e1rm` y `raw` en el chip; Exacto da 61.7 donde el escalón 2,5 da
  62.5; `'exact'` en un ejercicio Por reglas se ignora.

### 5.5 Qué se guarda

`commitValues` escribe la forma de §4.1: `type` (`double` para Peso por reglas,
también con reps fijas), `evaluation`, `increment`, `down`, `targetRpe` +
`effortWhen` en Por esfuerzo, y `exConfig.weightStep` **solo si difiere** del
que se resuelve sin él (el de la librería; en Por esfuerzo, ese con tope 2,5:
§4.4) (así un cambio en la librería sigue llegando a los ejercicios que no
lo tocaron). Desaparecen del estado del editor `progMode`, `evalPct` e
`incrMin`.

**Probar P55**

- [ ] Abrir la hoja de un press banca: Qué sube · Cómo · Cuándo sube · Cuánto
  sube · Cuándo baja, y la frase del Resumen dice lo mismo que la hoja.
- [ ] Con Rango, Por esfuerzo sale apagado con la pista naranja; al pasar a Reps
  fijas se puede elegir, y al volver a Rango vuelve solo a Por reglas.
- [ ] Parcial 2 de 3 → Cuándo baja no deja bajar de 2; con Parcial 1 de 3, no
  baja de 3.
- [ ] Cuándo sube = RPE máx. → Registrar RPE se enciende y no se puede apagar.
- [ ] Dominadas (sin carga): Qué sube no ofrece Peso. Dominadas asistidas:
  «Asistencia ↓», sin Cómo.
- [ ] Plancha (Tiempo): solo Tiempo y Nada; el salto en segundos enteros.
- [ ] Por esfuerzo: cambiar el escalón a 1,25 y comprobar en el Workout que el
  peso propuesto es múltiplo de 1,25.
- [ ] Peso muerto Por esfuerzo, Escalón → **Exacto**: «Cuándo sube» desaparece,
  y tras 3 × 4 @7 con 60 kg el Workout propone 61.7 kg (con escalón 2,5,
  62.5).
- [ ] Guardar, salir y volver a entrar: la hoja recupera todo lo elegido.

## 6. P56 — Workout: el plan en el gris y la línea de recomendación

`ExerciseCard.jsx`, `useStore.saveSession`, `warmup.js` y textos.

### 6.1 El gris es el plan

- La tarjeta calcula el gris y el relleno de ✓ con `planSet` (P54) en vez de
  `resolveExerciseReference` + `lastSet`.
- `saveSession.resolveSet` usa **la misma** `planSet`. Para ello calcula el chip
  de cada ejercicio con `getProgression(exConfig, def, lastSets, () => '')`; el
  `def` sale de `exerciseLibrary` + `customExercises` del store.
- Test en `useStore.test.js`: una sesión con la serie solo marcada ✓ guarda el
  peso del plan (62,5), no el de la última vez (60).

### 6.2 El calentamiento sube con el plan

`warmup.resolveWorkWeight` añade un escalón a su cascada, después del objetivo
del entrenador y antes de la última sesión: el peso del plan
(`chip.suggestedWeight`). Si no, el calentamiento rampa hacia el peso de la
semana pasada.

### 6.3 La línea de recomendación (variante A)

En el bloque `progBlock` (~654-678):

- **Fuera la línea `progWhy`** (la frase gris). Se queda la fila: flecha +
  etiqueta + destino + pastilla del delta.
- Toda la fila es un `Pressable` (sin icono) que abre una `DragSheet` con tres
  bloques: **REGLA** (`progressionRule`), **LA ÚLTIMA VEZ** (las pastillas de
  la última sesión, §6.4) y **HOY** (`chip.why`).
- Reps y Tiempo con número (ya hecho en QA P52): el destino es la meta de hoy
  («9 reps», «45 s») y el delta se cuenta desde `from`. La línea del objetivo de la cabecera
  (`targetLabel`) dice también la meta de hoy: «3 × 9 reps», no el inicio. En
  las listas sin historial a mano (Inicio, editor de sesión) se pinta el
  inicio con un «+»: «3 × 8+ reps».
- **Primera vez** (sin historial, progresión ≠ `none`, sin objetivo del
  entrenador): una fila nueva con la misma anatomía, en `text`:
  «◇ BUSCA TU PESO · 8–12 reps» (con carga), «◇ HAZ LAS QUE PUEDAS · 6–12»
  (sin carga), «◇ AGUANTA LO QUE PUEDAS · 30–60 s» (tiempo), «◇ BUSCA TU PESO ·
  5 @ RPE 8» (por esfuerzo). La ficha dice qué buscar.
- Fija (`type: 'none'`): sin línea, como hoy.
- **Por esfuerzo: el 1RM al final de la línea** (decisión del usuario, 2-oct),
  en `muted` y alineado a la derecha: `↑ PESO OBJETIVO 62.5 kg +2.5   1RM 74`.
  Sale de `chip.e1rm`, redondeado a kg entero y en la unidad del usuario; sin
  `e1rm`, no sale. La ficha (bloque HOY) dice de dónde viene: «1RM estimado,
  media de tus 3 últimas sesiones: 74 kg» (o «de tu última sesión» si solo hay
  una, §6.5). No es el de Progreso (la mejor serie en 6 semanas): por eso lo
  dice.
- Objetivo del entrenador y descarga: como hoy (azul).
- **A2 · Banda** (la misma fila sobre `tint.accent10`, o azul en descarga) se
  deja detrás de una constante en el archivo para probarla en el móvil; la
  elección final se apunta aquí.

### 6.5 Por esfuerzo: el 1RM de las tres últimas sesiones (decisión 2-oct)

Hoy el 1RM sale de la última sesión sola (la media de sus series). Un error de
medio punto al apuntar el RPE ya es un 1,5–2 % del 1RM, más que un escalón de
2,5 en 100 kg: el peso bailaba semana a semana sin que cambiara nada, y un día
malo o una descarga (series fáciles, la estimación menos fiable) arrastraban
la sesión siguiente. Con la media de tres, el ruido baja casi a la mitad y el
retraso es de una sesión como mucho; «al superarlo» ya empuja hacia arriba.

- **De dónde salen.** `exerciseLinks.js`: `recentLinkedExercises(workoutLog,
  templateIds, exerciseId, n)` → `[{ timestamp, exercise }]`, las `n` últimas
  con series, más recientes primero; `lastLinkedExercise` pasa a ser
  `recentLinkedExercises(…, 1)[0]?.exercise` (mismo resultado, tiene tests).
  Y `recentExerciseRefs(args, n)`, con los mismos argumentos y el mismo alcance
  que `lastExerciseRef` (vinculación o cadena de plantillas), que pasa a ser
  `recentExerciseRefs(args, 1)[0]?.exercise`. **Se adelanta de P57 (§7.2)**,
  que lo reutiliza.
- **Motor.** `getProgression(exConfig, def, lastSets, t, earlier = [])`:
  `earlier` son las series de las sesiones anteriores a la última (arrays de
  sets, de más reciente a más antigua). Solo lo lee `chipEffort`: el 1RM de
  cada sesión es la media de sus series (como hoy); se descartan las que no dan
  1RM (sin RPE) y las de descarga; `e1rm` = media simple de las tres primeras
  válidas, empezando por la última. Si la última no da 1RM, el chip sigue
  siendo `why_effortNoRpe` (lo de hoy): la media no sustituye a apuntar el RPE.
  El peso de partida (`maxW`, para la flecha y el delta) sigue siendo el de la
  última sesión. El chip trae `e1rmSessions` (1–3) para el texto de la ficha.
- **Descargas.** `saveSession` escribe `deload: true` en el ejercicio del log
  cuando su `exConfig.progression.hold === 'deload'`. `earlier` llega ya sin
  ellas (el que llama las filtra) y la última, si es de descarga, cuenta como
  sin 1RM para la media pero sigue siendo `lastSets`.
- **Quién lo pasa.** `WorkoutScreen` calcula para cada tarjeta las tres
  últimas con `recentExerciseRefs` (la primera es la `lastExercise` de hoy) y
  la tarjeta llama a `getProgression` con las otras dos; `saveSession` (§6.1)
  hace lo mismo para que el plan guardado sea el que se ve. `sessionText` sigue
  con la última sola (texto para compartir).
- **Tests.** `progression.test.js`: con tres sesiones de 1RM 72, 74 y 76 el
  `e1rm` es 74; una sin RPE no cuenta; con una sola, la de hoy; última sin RPE
  → `why_effortNoRpe`. `exerciseLinks.test.js`: `recentLinkedExercises` y que
  `lastLinkedExercise`/`lastExerciseRef` no cambian. `useStore.test.js`: el
  log de una etapa de descarga lleva `deload: true`.

### 6.4 Pastillas reutilizables

Las pastillas de la tarjeta plegada (`pillsBlock`, ~533-587) salen a
`components/workout/SetPills.jsx` (`sets`, `exConfig`, `neutral`). `neutral`
quita el color de dentro y fuera de rango (para «la última vez»). Las usan la
tarjeta plegada, la ficha (§6.3) y P57.

**Probar P56**

- [ ] Tras 12/12/12 con 60 kg: el gris de las tres series dice 62.5 × 12; ✓ sin
  escribir nada guarda 62.5 × 12 (verlo en Historial).
- [ ] Tras 12/10/9: el gris repite 60 × 12 · 10 · 9.
- [ ] El calentamiento de ese día rampa hacia 62.5, no hacia 60.
- [ ] Peso muerto Por esfuerzo con tres sesiones (1RM distintos): la línea
  enseña la media y la ficha dice «media de tus 3 últimas sesiones». Hacer una
  cuarta sin apuntar RPE → «apunta el RPE», no un peso.
- [ ] Una sesión de etapa de descarga no entra en esa media.
- [ ] Ya no hay frase gris bajo la recomendación; al tocar la línea sale la
  ficha con la regla, la última vez y el motivo.
- [ ] Ejercicio sin historial: «Busca tu peso · 8–12 reps»; dominadas sin
  historial: «Haz las que puedas».
- [ ] Dominadas en Reps tras 9/8/8: «Subir a 9 reps +1» y el gris pide 9.
- [ ] Objetivo del entrenador: la línea azul y el gris azul, como antes.
- [ ] Peso muerto Por esfuerzo tras 3 × 4 @7 con 60 kg: la línea acaba en
  «1RM 74» y la ficha dice que es de la última sesión. Sin RPE apuntado, sin 1RM.
- [ ] Banda A2 activada a mano: valorar y apuntar aquí la elección.

## 7. P57 — La última vez: botón, línea o debajo de cada serie

### 7.1 La preferencia

`profile.lastSessionView: 'button' | 'line' | 'below'`, **por defecto
`'button'`**. Se guarda con `setProfile` (el `profile` ya persiste). Fila nueva
en el menú, sección Preferencias de `AppHeader.jsx` (donde están unidades e
idioma): «Última sesión» con `SegmentedControl` Botón · Línea · Serie.

### 7.2 De dónde salen las sesiones

`recentLinkedExercises` y `recentExerciseRefs` ya existen (P56, §6.5).
`WorkoutScreen` ya calcula las tres últimas de cada tarjeta para Por esfuerzo:
P57 las pasa también, con su fecha, a la vista de la última vez.

### 7.3 Las tres vistas

- **Botón** (por defecto): icono de historial en la cabecera de la tarjeta, a
  la izquierda del de notas, solo si hay historial. Abre una `DragSheet` con las
  tres últimas sesiones: fecha (`toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })`,
  como `SessionRecapScreen`; **no** `formatters.formatDate`, que fija `es-ES`) y
  `SetPills neutral`. No hay enlace a Progreso (no existe navegación al
  detalle de un ejercicio desde el Workout; se añade si se pide).
- **Línea**: bajo la recomendación, «ÚLTIMA · LUN 29 SEP» en `caps`/`muted` y
  las pastillas neutras. Sin color (decisión 1-oct).
- **Debajo de cada serie**: bajo cada `SetRow`, una fila de 12 px en `muted` con
  lo de esa serie la última vez, alineada con las columnas (`GRID`), y «ANT.» en
  la columna de la etiqueta. Solo en la tarjeta abierta.

**Probar P57**

- [ ] Instalación limpia: la tarjeta trae el icono de historial y abre las tres
  últimas sesiones con su fecha.
- [ ] Cambiar en el menú a Línea: la fila «Última · fecha» sin color bajo la
  recomendación. A Serie: lo de la última vez debajo de cada serie, alineado.
- [ ] Ejercicio vinculado entre sesiones A y C: el historial mezcla las dos.
- [ ] Sin historial: ni icono, ni línea, ni filas.

## 8. Registro

| Fase | Commit | Nota |
|---|---|---|
| P52 | `f5311ef` | cuatro fallos del motor |
| P53 | `e8c4f2e` … `8f52105` | diseño y maqueta (v1 → v3 + variantes de A) |
| P54 | `2fc2f19` | motor: modelo nuevo, chip único de peso, `setPlan` |
| P55 | `400d1de`, `56327d5` | motor (`canAddWeight`, `exact`, `progressionRule`) y editor (`progressionForm.js`, hoja nueva) |
| P56 | — | |
| P57 | — | |
