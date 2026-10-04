# Spec — Progresión clara

> Tema: programas
> En corto: El motor de progresión ya cubre casi todas las formas de entrenar, pero daba consejos equivocados en cuatro casos y ni el editor ni el Workout dejaban claro qué decide. Primero se arreglan los fallos; después se ordena en tres preguntas (qué pides, qué sube, cuándo y cuánto) y el plan del motor pasa a ser el gris de cada serie.
> Inicio: 2026-10-01
> Fin: 2026-10-03
> Fase P12-01 · hecho · Cuatro fallos del motor · §2 · antes P52
> Fase P12-02 · terminado · Diseño y maqueta: Qué pides, la hoja de Progresión y el plan en el Workout · §3 · antes P53
> Fase P12-03 · hecho · Motor: el modelo nuevo y el plan de cada serie · §4 · antes P54
> Fase P12-04 · hecho · Editor: Qué pides y la hoja de Progresión · §5 · antes P55
> Fase P12-05 · hecho · Workout: el plan en el gris y la línea de recomendación · §6 · antes P56
> Fase P12-07 · hecho · Tiempo con carga (Tiempo + Peso, doble en segundos) · §8 · antes P61
> Fase P12-08 · hecho · Peso corporal: sellado en la sesión y fila en el menú · §9 · antes P62
> Fase P12-09 · aparcado · Peso corporal en el motor (Por esfuerzo, 1RM y récords) · §10 · antes P63
> Fase P12-10 · terminado · Alta de ejercicio propio con la misma hoja de Progresión que el editor · §12 · antes P65
>
> Estado: **4-oct-2026: P12-06 se mueve a [U11-01](U11-preferencias-ui.md) (Preferencias de UI) y P12-10 se da por terminada.** **P12-07 hecha y probada** (2-oct-2026, `d77ffd3`). **P12-08 hecha y probada** (2-oct-2026, `6fd801d`). **P12-05 hecha** (2-oct-2026, `66a5719` + `e04682f`; falta probarla a mano). **P12-04 hecha** (2-oct-2026, `400d1de` + `56327d5`; falta probarla a mano). **P12-03 hecha** (2-oct-2026, `2fc2f19`; falta probarla a mano). **P12-01 hecha y probada** (1-oct/2-oct-2026, `f5311ef` + arreglos de QA
> `fa2e48f`, `6f8cb45`, `0f9e3a8`; rama `feat/recap`). **P12-02 (diseño) cerrada** con el usuario el 1-oct: maqueta
> `docs/mockups/progression.html`, decisiones en §3.1. Implementación en cuatro
> fases encadenadas, P12-03 → P12-04 → P12-05 → P12-06 (§4-§7), escritas para que las haga un
> subagente sin más contexto, más P12-07 (§8, tras QA P12-04: tiempo con carga) y P12-08
> (§9, peso corporal en el menú y sellado en la sesión), decididas el 2-oct. P12-09
> (§10) es lo que se sacó de la primera P12-07 y se aparcó. Sin decidir (§3.1-bis): dónde enseñar «Próxima sesión». La escalera (top set + back-off,
> pirámide invertida) va **después**, como extensión de «Qué pides»: sin motor nuevo.

---

## 1. Formas de entrenar que hay que soportar

| # | Forma de entrenar | Qué sube y cuándo | Antes de P12-01 |
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
| J | Top set + back-off, pirámide invertida | El top set, y el resto le sigue | ❌ escalera, después de P12-02 |
| K | Porcentajes de 1RM (5/3/1, ondulante) | El ciclo | ❌ **fuera** (decisión del usuario, 1-oct) |

Pesos objetivo por serie: **descartados** (usuario, 1-oct). La progresión parte
del peso de la última sesión; sin historial, el Workout dice qué peso buscar.
`progression.seed` no lo lee nadie: se borra en P12-02.

## 2. P12-01 — Cuatro fallos del motor

Todos en `src/utils/progression.js`, comprobados contra el motor real antes de
tocarlo y cubiertos en `progression.test.js` (`describe('P12-01 …')`).

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

Queda fuera a propósito (va en P12-02): medida Tiempo + tipo Doble sugiere «sube a
2,5 kg» en una plancha. Es una combinación que el editor no debería ofrecer.

**Probar P12-01**

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

## 3. P12-02 — Qué pides en el editor, la progresión en su hoja, el plan en el Workout

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

- ~~**Tiempo con carga**~~: **decidido el 2-oct**, doble en segundos (P12-07, §8.5).
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

**Tiempo con carga** (**decidido el 2-oct**, se implementa en P12-07, §8.5): con medida Tiempo y un
ejercicio con carga, «Peso» es una doble progresión en segundos: todas llegan al
máximo → sube el peso y el tiempo vuelve al mínimo. Arregla además la
combinación que la P12-01 dejó fuera (Tiempo + Doble sugería kilos en una plancha).

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

## Implementación (P12-03–P12-06)

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
`type: 'effort'`) y «Próxima sesión» (§3.1-bis). El tiempo con carga va en P12-07.

## 4. P12-03 — Motor: el modelo nuevo de la progresión

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
añade `step` (el escalón resuelto) y `direction` (del `def`, P12-01). Lectura de lo
antiguo, sin migrar datos:

| Guardado | Se lee como |
|---|---|
| `type: 'weight'` | `'double'` con meta = `minReps` (el editor de hoy deja guardar `'weight'` con rango, y su meta era el mínimo: leerlo con `maxReps` cambiaría cuándo sube) |
| `evaluation.mode: 'pct'` + `pctThreshold` | `'part'` con `need = ceil(pctThreshold · sets)` |
| `'part'` sin `need` | `need = ceil((pctThreshold ?? 0,8) · sets)` (el editor sigue guardando `pctThreshold` hasta P12-04) |
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

**Puente hasta P12-04** (única excepción a «solo `src/utils/`»): el editor lee
`evaluation.mode` y no conoce `'part'`. En `computeInitial`
(`ExerciseEditorInline.jsx`) se lee `'part'` como `'pct'` con
`evalPct = round(need / sets · 100)`. Nada más; P12-04 sustituye ese estado.

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
  ni memoria: solo la última sesión, como en P12-01.
  - Qué pides guarda **el inicio**: `minReps = maxReps = inicio` (o
    `minTime = maxTime`). Con Reps o Tiempo no hay rango.
  - Si se cumple (`all`, `part` o `rpe`, con las series ≥ inicio): meta =
    serie más floja + salto, `type: 'up'`. Si no: meta = inicio, `type: 'hold'`.
  - El chip trae siempre la meta (`suggestedReps` / `suggestedTime`), `from`
    (la serie más floja, para el delta) y `why`. **Esto ya está hecho** (QA
    P12-01, 2-oct): antes Reps no traía número y la tarjeta pintaba la frase larga
    en el hueco de la cifra. Lo que queda para P12-03 es quitar el rango (meta =
    inicio como suelo) y el `part`.
- **Por esfuerzo**: redondea al `step` resuelto, que en Por esfuerzo es
  `exConfig.weightStep` o, si no, `min(def.weightStep, 2,5)`: ahí el escalón es
  la resolución de la carga, no el salto. Con el de la librería tal cual (5 kg)
  un punto de RPE (+2,8 %) no movía el peso por debajo de ~90 kg y todo era
  «mantener» (QA P12-03.3, ya visto en QA P10-03). El usuario lo ve y lo puede cambiar
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
   Revertido en QA P12-03.3: sin escalón propio, sigue siendo como mucho 2,5.

### 4.7 Tests

`progression.test.js`: la tabla de §4.2 caso a caso (all/part/rpe × sube/baja/
mantiene, con 3 y 5 series), el valor por defecto de `down` contra los cinco
casos de §3.2, `down: 'never'`, asistidos espejo, lectura de lo antiguo (§4.1),
`effortWhen: 'reach'`, `step` en `pct` y en Por esfuerzo, `suggestedReps`.
`setPlan.test.js` (nuevo): el orden de §4.5, un campo por fuente, la meta con
rango y con reps fijas, Por esfuerzo, sin historial. `stageRx.test.js`:
`incrementScale` redondea al `step`.

**Probar P12-03**

- [x] Press banca 3 × 8–12 en Automática: 12/12/12 con 60 kg → «Subir a 62.5»;
  12/10/9 → «Mantener 60»; 9/7/7 → «Bajar a 57.5».
- [x] El mismo press banca con **Registrar RPE** encendido y **Cuándo sube =
  RPE** (máx. 8): hacer 12/10/9 con 60 kg, las tres a RPE 10 → «Mantener 60».
  Antes de P12-03 decía «Bajar a 57.5» (la media de RPE pasaba de 9,5); ahora solo
  baja la regla de fallos, y 12/10/9 no falla ninguna.
- [x] Peso muerto Por esfuerzo 3 × 4 @8, con 60 kg: hacer 3 × 4 @7 → «Subir a
  62.5»; hacer 3 × 5 @8 → también «Subir a 62.5» (las dos equivalen a 7 reps
  a fallo).
  (2-oct: con el escalón de librería, 5 kg, las dos decían «Mantener»: +2,8 %
  no llegaba a medio escalón. Arreglado: en Por esfuerzo, como mucho 2,5 salvo
  escalón propio.)
- [x] Una etapa de descarga sigue diciendo «Descarga» y no sube ni baja.

## 5. P12-04 — Editor: Qué pides y la hoja de Progresión

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
(P12-05). Frases (las de la maqueta):

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
por defecto (`defaultIncrement`, P12-01).

El valor por defecto de `fails` en el editor es el de §4.3. Se guarda siempre
`down` explícito (`'never'` o `{ fails }`) al guardar desde el editor.

### 5.3-bis Ejercicios sin carga: Peso solo si se pueden lastrar (revisión 2-oct)

`isBodyweight(def)` solo no vale: las dominadas, los fondos y las flexiones
lastradas son de peso corporal y se progresan con lastre (P09-01 juntó las
lastradas en Dominadas). La librería ya lo dice con el escalón: de los 66
ejercicios sin carga, solo esos tres tienen `weightStep > 0`.

- **Corregido en QA P12-04.5 (2-oct): todo ejercicio se puede lastrar**, también
  una plancha. Qué sube ofrece Peso siempre con medida Reps; la librería solo
  decide **el valor por defecto**.
- **Motor**: sin `progression` guardada, `resolveProgressionConfig` lee
  `'double'` como `'reps'` si el ejercicio es de peso corporal con
  `weightStep` 0 en la librería y la dirección es `'increase'` (los asistidos no
  cambian). Un Peso elegido en la hoja se respeta. Son ~40 ejercicios de la librería (hollow, rueda, dominadas supinas,
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

### 5.4-bis Por esfuerzo: el 1RM y el peso exacto (QA P12-03, 2-oct)

Decisión del usuario: quien elige Por esfuerzo es avanzado y quiere ver el
1RM estimado y, si lo pide, el peso calculado sin redondear.

- **Motor** (`progression.js`, `chipEffort`): el chip trae además `e1rm` (la
  media de las series de la última sesión, la que usa el cálculo; en P12-05 pasa
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

**Probar P12-04**

- [x] Abrir la hoja de un press banca: Qué sube · Cómo · Cuándo sube · Cuánto
  sube · Cuándo baja, y la frase del Resumen dice lo mismo que la hoja.
- [x] Con Rango, Por esfuerzo sale apagado con la pista naranja; al pasar a Reps
  fijas se puede elegir, y al volver a Rango vuelve solo a Por reglas.
- [x] Parcial 2 de 3 → Cuándo baja no deja bajar de 2; con Parcial 1 de 3, no
  baja de 3.
- [x] Cuándo sube = RPE máx. → Registrar RPE se enciende y no se puede apagar.
- [x] Dominadas supinas: Qué sube ofrece Peso, Reps y Nada, y por defecto
  viene Reps. Dominadas: por defecto Peso; sin Cómo (Por esfuerzo solo con
  carga externa, hasta decidir el peso corporal). Dominadas asistidas:
  «Asistencia ↓», sin Cómo, con Cuándo baja.
  (2-oct: Peso salía capado en lo que la librería no lastra; todo ejercicio se
  puede lastrar, la librería solo decide el valor por defecto. Arreglado.)
- [x] Un ejercicio de una etapa de descarga: cambiar algo en el editor y en el
  Workout sigue diciendo «Descarga» (antes, editar lo cancelaba).
- [x] Plancha (Tiempo): solo Tiempo y Nada; el salto en segundos enteros.
- [x] Por esfuerzo: cambiar el escalón a 1,25 y comprobar en el Workout que el
  peso propuesto es múltiplo de 1,25.
- [x] Peso muerto Por esfuerzo, Escalón → **Exacto**: «Cuándo sube» desaparece,
  y tras 3 × 4 @7 con 60 kg el Workout propone 61.7 kg (con escalón 2,5,
  62.5).
- [x] Guardar, salir y volver a entrar: la hoja recupera todo lo elegido.

## 6. P12-05 — Workout: el plan en el gris y la línea de recomendación

`ExerciseCard.jsx`, `useStore.saveSession`, `warmup.js` y textos.

### 6.1 El gris es el plan

- La tarjeta calcula el gris y el relleno de ✓ con `planSet` (P12-03) en vez de
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

Revisión contra el código (2-oct): en `ExerciseCard` el calentamiento se
calcula (~157) **antes** que el chip (~374): hay que subir el cálculo del chip.
En asistidos (`chip.assist`) el número del plan es la ayuda, no un peso: ahí
no entra en la cascada.

### 6.3 La línea de recomendación (variante A)

En el bloque `progBlock` (~654-678):

- **Fuera la línea `progWhy`** (la frase gris). Se queda la fila: flecha +
  etiqueta + destino + pastilla del delta.
- Toda la fila es un `Pressable` (sin icono) que abre una `DragSheet` con tres
  bloques: **REGLA** (`progressionRule`), **LA ÚLTIMA VEZ** (las pastillas de
  la última sesión, §6.4) y **HOY** (`chip.why`).
- Reps y Tiempo con número (ya hecho en QA P12-01): el destino es la meta de hoy
  («9 reps», «45 s») y el delta se cuenta desde `from`. La línea del objetivo de la cabecera
  (`targetLabel`) dice también la meta de hoy: «3 × 9 reps», no el inicio. En
  las listas sin historial a mano (Inicio, editor de sesión) se pinta el
  inicio con un «+»: «3 × 8+ reps».
  Cómo (revisión 2-oct): `prescription.targetLabel(def, ex, t, { compact,
  today })`. Con progresión Reps o Tiempo y sin `today`, el inicio con «+»
  («3 × 8+ reps», «3 × 30+ s»): hoy pinta «30–30 s» desde que P12-04 guarda un
  solo inicio. La tarjeta pasa `today = { reps: chip.suggestedReps }` o
  `{ time: chip.suggestedTime }` cuando el chip trae número. El resto de tipos
  no cambia.
- **Primera vez** (sin historial, progresión ≠ `none`, sin objetivo del
  entrenador): una fila nueva con la misma anatomía, en `text`:
  «◇ BUSCA TU PESO · 8–12 reps» (con carga), «◇ HAZ LAS QUE PUEDAS · 6–12»
  (sin carga), «◇ AGUANTA LO QUE PUEDAS · 30–60 s» (tiempo), «◇ BUSCA TU PESO ·
  5 @ RPE 8» (por esfuerzo). La ficha dice qué buscar.
  «Sin carga» = `isBodyweight(def)`, sea cual sea Qué sube (unas dominadas en
  Peso empiezan sin lastre: «haz las que puedas»). Lo de la derecha es la
  prescripción sin las series, como en la cabecera (rango, «8+», «30–60 s»,
  «5 @ RPE 8»). La progresión se lee con `resolveProgressionConfig` (sin
  historial no hay chip).
- Fija (`type: 'none'`): sin línea, como hoy.
- **Por esfuerzo: el 1RM al final de la línea** (decisión del usuario, 2-oct),
  en `muted` y alineado a la derecha: `↑ PESO OBJETIVO 62.5 kg +2.5   1RM 74`.
  Sale de `chip.e1rm`, redondeado a kg entero y en la unidad del usuario; sin
  `e1rm`, no sale. La ficha (bloque HOY) dice de dónde viene: «1RM estimado,
  media de tus 3 últimas sesiones: 74 kg» (o «de tu última sesión» si solo hay
  una, §6.5). No es el de Progreso (la mejor serie en 6 semanas): por eso lo
  dice.
- Objetivo del entrenador y descarga: como hoy (azul).
- ~~**A2 · Banda**~~ (la misma fila sobre `tint.accent10`, o azul en
  descarga): probada en el móvil el 2-oct y **descartada** por el usuario. Se
  queda A · Suelta y la variante se borró del código.

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
  `recentExerciseRefs(args, 1)[0]?.exercise`. **Se adelanta de P12-06 (§7.2)**,
  que lo reutiliza.
- **Motor.** `getProgression(exConfig, def, lastSets, t, { earlier = [],
  lastDeload = false } = {})` (un objeto de opciones: P12-07 le añade
  `bodyWeight`): `earlier` son las series de las sesiones anteriores a la
  última, ya sin las de descarga (arrays de sets, de más reciente a más
  antigua), y `lastDeload` dice si la última fue de descarga (el log la marca,
  ver abajo; `lastSets` no lo lleva). Solo lo lee `chipEffort`: el 1RM de cada
  sesión es la media de sus series (como hoy); se descartan las que no dan 1RM
  (sin RPE) y la última si es de descarga; `e1rm` = media simple de las tres
  primeras válidas, empezando por la última. Si la última **no es de
  descarga** y no da 1RM, el chip sigue siendo `why_effortNoRpe` (lo de hoy):
  la media no sustituye a apuntar el RPE. Si es de descarga, el 1RM sale de las
  anteriores; sin ninguna válida, `why_effortNoRpe`.
  El peso de partida (`maxW`, para la flecha y el delta) sigue siendo el de la
  última sesión. El chip trae `e1rmSessions` (1–3) para el texto de la ficha.
- **Descargas.** `saveSession` escribe `deload: true` en el ejercicio del log
  cuando su `exConfig.progression.hold === 'deload'`. El que llama filtra
  `earlier` y pasa `lastDeload` (la última sigue siendo `lastSets`: el peso de
  partida, la flecha y el delta salen de ella).
- **Quién lo pasa.** `WorkoutScreen` calcula para cada tarjeta las tres
  últimas con `recentExerciseRefs` (la primera es la `lastExercise` de hoy) y
  la tarjeta llama a `getProgression` con las otras dos; `saveSession` (§6.1)
  hace lo mismo para que el plan guardado sea el que se ve. `sessionText` sigue
  con la última sola (texto para compartir).
- **Tests.** `progression.test.js`: con tres sesiones de 1RM 72, 74 y 76 el
  `e1rm` es 74; una sin RPE no cuenta; con una sola, la de hoy; última sin RPE
  → `why_effortNoRpe`; última de descarga (`lastDeload`) con RPE → el 1RM sale
  de las anteriores, sin `why_effortNoRpe`. `exerciseLinks.test.js`: `recentLinkedExercises` y que
  `lastLinkedExercise`/`lastExerciseRef` no cambian. `useStore.test.js`: el
  log de una etapa de descarga lleva `deload: true`.

### 6.4 Pastillas reutilizables

Las pastillas de la tarjeta plegada (`pillsBlock`, ~533-587) salen a
`components/workout/SetPills.jsx` (`sets`, `exConfig`, `neutral`). `neutral`
quita el color de dentro y fuera de rango (para «la última vez»). Las usan la
tarjeta plegada, la ficha (§6.3) y P12-06.

**Cómo quedó (P12-05, decisiones donde la spec no llegaba)**

- `getProgression(..., { earlier, lastDeload })` lo arma `progressionHistory(recent)`
  (`progression.js`) desde los objetos del log; tarjeta y `saveSession` lo usan
  igual. `WorkoutScreen` pasa a la tarjeta `recentSessions` (`[{ timestamp, exercise }]`,
  la primera es `lastExercise`): P12-06 solo tiene que leerlas.
- La fila «Primera vez» no sale en los ejercicios añadidos sobre la marcha
  (`onEditTarget`): no tienen progresión que explicar. Sale de `firstTimeRx` (`prescription.js`).
- La ficha de una descarga lleva LA ÚLTIMA VEZ y HOY, sin REGLA (la regla de la
  config diría «sube…» y la etapa pide mantener). Sin historial, REGLA y HOY.
- Pastillas `neutral`: sobre `surface2` (sobre la hoja o la tarjeta, la de `bg`
  no se vería) y con el peso en `text`.
- `sessionText` (texto para compartir) quita el «+»: lo que se pega de vuelta no
  lo lee.
- Se borran `resolveRef` y `resolveExerciseReference` (`sessionOverride.js`).
- Sin RPE en la última sesión, la línea dice «Peso objetivo» con el mismo peso y
  sin 1RM; el «sin RPE, el peso se queda igual» vive ahora solo en la ficha.
- `progressionRule` en la ficha recibe la etiqueta de la unidad pero el valor
  sigue en kg, como en el editor (en lb sale «2.5 lb»): pendiente de los dos.

**Probar P12-05**

- [x] Tras 12/12/12 con 60 kg: el gris de las tres series dice 62.5 × 12; ✓ sin
  escribir nada guarda 62.5 × 12 (verlo en Historial).
- [x] Tras 12/10/9: el gris repite 60 × 12 · 10 · 9.
- [x] El calentamiento de ese día rampa hacia 62.5, no hacia 60.
- [x] Peso muerto Por esfuerzo con tres sesiones (1RM distintos): la línea
  enseña la media y la ficha dice «media de tus 3 últimas sesiones». Hacer una
  cuarta sin apuntar RPE → la línea dice «Apunta el RPE» donde iría el 1RM y
  el peso se queda el de la última vez.
- [x] Una sesión de etapa de descarga no entra en esa media.
- [x] Ya no hay frase gris bajo la recomendación; al tocar la línea sale la
  ficha con la regla, la última vez y el motivo.
- [x] Ejercicio sin historial: «Busca tu peso · 8–12 reps»; dominadas sin
  historial: «Haz las que puedas».
- [x] Dominadas en Reps tras 9/8/8: «Subir a 9 reps +1» y el gris pide 9.
- [x] Objetivo del entrenador: la línea azul y el gris azul, como antes.
- [x] Peso muerto Por esfuerzo tras 3 × 4 @7 con 60 kg: la línea acaba en
  «1RM 74» y la ficha dice que es de la última sesión. Sin RPE apuntado, sin 1RM.
- [x] Banda A2 activada a mano: valorar y apuntar aquí la elección.
  (2-oct: descartada, se queda la línea suelta.)

## 7. P12-06 — movida a U11-01

El 4-oct-2026 pasó a [U11-preferencias-ui.md](U11-preferencias-ui.md) §2, con su texto
y sus casillas, porque es una preferencia de UI. El código P12-06 no se reutiliza.

## 8. P12-07 — Tiempo con carga

Sale de QA P12-04.5 (2-oct). P12-04 capaba «Peso» en los ejercicios de peso corporal
que la librería no lastra; el usuario: **todo ejercicio de peso corporal se
puede lastrar**, también una plancha. Lo típico de cada ejercicio es solo el
valor por defecto, y los límites están en la hoja, que no deja montar
combinaciones absurdas. Eso ya está arreglado (`bf919ee`). Queda lo que no
cabía en un arreglo: el tiempo con carga.

La primera versión de P12-07 llevaba también «el peso corporal cuenta» (Por
esfuerzo, 1RM y récords). Se sacó el mismo día: ver P12-09 (§10). P12-07 no necesita
el peso corporal para nada.

Va **después de P12-05** (usa su objeto de opciones de `getProgression` y
`planSet` conectado).

### 8.1 Decisión del usuario (2-oct)

**Tiempo + Peso = doble en segundos**: rango de tiempo; cuando todas las series
llegan al máximo, sube el peso y el tiempo vuelve al mínimo. Con tiempo fijo
(45–45) es «aguanta 45 s → sube peso». Arregla además la combinación que la P12-01
dejó fuera (Tiempo + Doble sugería kilos en una plancha).

### 8.2 Tiempo + Peso (doble en segundos)

- **Hoja**: con medida Tiempo, Qué sube ofrece **Tiempo · Peso · Nada** (en
  asistidos, «Asistencia ↓»). Con Peso: sin Cómo (solo por reglas); Cuándo sube
  Todas · Parcial · RPE máx.; Cuánto sube en kg o %; Cuándo baja con fallos
  bajo el mínimo de tiempo.
- **Volumen**: con Tiempo + Peso, el rango de tiempo (min–max), como el rango de
  reps con Peso; con Tiempo + Tiempo, el valor de inicio de siempre.
- **Motor**: `type: 'double'` con medida de tiempo (`exConfig.inputType` `time`
  o `weight_time`) evalúa en segundos: `verdict(prog, doneSets, n, minTime,
  maxTime, 'minTime')`. Sube → peso + salto; baja → peso − salto; si no,
  mantener. Lo mismo en `chipDoubleDecrease`.
- **Plan** (`setPlan`): con Tiempo + Peso, al subir o bajar, peso = el del plan
  y tiempo = **el mínimo** (con otro peso, el tiempo se vuelve a construir
  desde abajo). En mantener, lo hecho.
- `progressionRule`: «Sube 2.5 kg cuando todas las series lleguen a 60 s ·
  baja si fallan 2 de 3».
- Prescripción (`prescription.targetLabel`) y listas: «3 × 30–60 s», como hoy.

### 8.3 Tests

`progression.test.js`: Tiempo + Peso (todas al máximo → sube peso; fallos →
baja con la regla; `progressionRule`). `progressionForm.test.js`: Tiempo ofrece
Peso. `setPlan.test.js`: Tiempo + Peso vuelve al mínimo.

### 8.4 Lo que la spec no cubría (decidido al implementar)

- **«Medida Tiempo»** es `isTimed(exConfig, def)` en `progression.js`: el
  `inputType` y, sin él, el modelo de progresión (como el editor y la
  prescripción). Un `double` guardado con medida Tiempo (plantillas generadas,
  ejercicios de la librería) pasa a evaluar en segundos; antes el editor lo
  forzaba a Tiempo al abrirlo y ahora se abre como Peso.
- **Textos de tiempo**: `why_allHitTime`, `why_belowMinTime`, `why_holdTime` y
  `normal_strugglingTime` (es y en), para no hablar de «repeticiones» en una
  plancha. La meta en `why_partHit` y en la regla lleva su unidad («60 s»).
- **El editor** no tiene «Rango · Fijo» para el tiempo: Tiempo + Peso usa los dos
  campos de siempre y «tiempo fijo» es mínimo = máximo. Al pasar de Tiempo a Peso
  se conserva el máximo que había (igual al mínimo); quien quiera rango lo sube.
  La frase del Resumen recibe la medida de ahora, no la guardada.
- **`type: 'weight'` antiguo** con medida Tiempo: la meta es el mínimo de tiempo,
  como era el de reps.

**Probar P12-07**

- [x] Plancha con medida Tiempo: Qué sube ofrece Peso. 30–60 s, 60/60/60 con
  5 kg → «Subir a 7.5» y el gris pide 30 s.
- [x] Plancha 45–45 con 5 kg: 45/45/45 → sube; 45/40/45 → mantiene.
- [x] Fallos bajo el mínimo de tiempo con «Cuándo baja»: baja el peso.
- [x] Tiempo + Tiempo sigue como antes (sin sugerir kilos).

## 9. P12-08 — Peso corporal: sellado en la sesión y fila en el menú

Decidido el 2-oct. El peso corporal **está unificado**: el del perfil
(`profile.bodyWeight`) es el que cuenta, y el que se apunta en el recap lo
actualiza (ya lo hace `setSessionFeedback`). Sin pantalla de Perfil por ahora:
requiere diseño y contenido que meter dentro. El peso se queda en el menú.

### 9.1 Qué es hoy

- La carga (`trainingLoad.js`) cuenta el peso corporal **siempre**; no se
  guarda: se recalcula sobre el log cada vez.
- El peso de cada sesión es `entry.bodyWeight` si el recap lo guardó, y si no
  el del perfil de hoy (`bodyWeightOf`). Esas sesiones **flotan**: cambiar el
  peso reescribe su carga.
- El recap enseña `entry.bodyWeight ?? profileBodyWeight` pero **solo guarda si
  se edita**. `saveSession` crea la entrada con `bodyWeight: null`.

### 9.2 Sellar el peso al guardar la sesión

En `saveSession` (`store/useStore.js`, donde hoy `bodyWeight: null`), la entrada
nace con el peso que el recap enseñaría:

- **Mío**: `profile.bodyWeight ?? null`.
- **Cliente sin app (`forClient`)**: el último `bodyWeight` del log de ese
  cliente (`ownerLogOf`), la misma regla que `SessionRecapScreen`. Nunca mi
  perfil.
- **Sin peso conocido**: `null`, como hoy.

El recap no cambia: enseña lo ya sellado, y corregirlo actualiza la sesión y el
perfil como ahora. Las sesiones anteriores a P12-08 sin peso siguen flotando (no
hay forma de saber qué pesabas); no se migran.

Test en `useStore.test.js`: con el perfil a 62 kg, guardar deja `bodyWeight:
62`; cambiar el perfil a 70 después no altera esa sesión; un entreno de cliente
usa el último peso de su log y no el mío; sin peso, `null`.

### 9.3 Fila en el menú

`AppHeader.jsx`, sección Preferencias, bajo Unidades / Idioma / Tema: fila
**«Peso corporal»**.

- **Sin `StepField`.** Se pulsa y se escribe a mano: un campo numérico
  (`keyboardType` decimal) en el `control` de la `MenuRow`, con el valor en la
  unidad del usuario (`useWeightUnit`: `toDisplay` / `toKg`) y la unidad al
  lado. Acepta decimales: 55.1 vale (y 55,1: la coma se trata como punto).
- Al salir del campo o confirmar: si es un número entre 20 y 500 (en kg),
  guarda `profile.bodyWeight` en kg con **un decimal** (`Math.round(n * 10) /
  10`, como el recap) vía `setProfile`. Si no es válido o está vacío, **vuelve
  al valor anterior** sin guardar; no hay forma de borrar el peso.
- Sin peso apuntado: el campo vacío con un placeholder («— kg»).
- Cambiar de KG a LB no pierde nada: se guarda en kg y se muestra convertido.
- Cambiar el peso aquí **no toca sesiones ya hechas** (§9.2): solo las que se
  guarden desde ahora.
- Textos en `es.json` **y** `en.json`, línea a línea. Estilos con los roles de
  `textStyles`; nada de `fontSize` propio.

**Probar P12-08**

- [x] Menú → Preferencias: pulsar «Peso corporal», escribir 55.1 → queda 55.1
  al cerrar y reabrir el menú.
- [x] Escribir «abc», 0 o 900: vuelve al valor de antes.
- [x] Con LB: se enseña en libras y, al volver a KG, sigue siendo el mismo peso.
- [x] Terminar un entreno: el recap trae ese peso sin tocarlo. Cambiar el peso
  en el menú → la carga de esa sesión (Progreso → Carga) no cambia.
- [x] Corregir el peso en el recap → el menú lo enseña.
- [x] Entreno apuntado a un cliente sin app: el recap trae el último peso del
  cliente, no el mío, y el menú no se mueve.

## 10. P12-09 — Peso corporal en el motor (aparcada)

**Aparcada el 2-oct (usuario).** Era el resto de la primera P12-07. Idea: un
ejercicio de peso corporal puede **contar el peso corporal** en lugar de solo el
lastre, y con eso Por esfuerzo, el 1RM y los récords trabajan con el total.

**Por qué se aparcó.**

- Es nicho: lo normal es progresar en reps y, con lastre, subir kilos **por
  reglas**, que no cambia cuentes o no el cuerpo (subir 2,5 kg de lastre es
  lo mismo).
- El motor no es lo bastante fino para que el matiz se note: el cuerpo varía
  1–2 kg y el escalón es de 1,25–2,5 kg, dentro del ruido del RPE.
- El coste está en la semántica (qué peso vale en cada contexto, inversión en
  asistidos, redondeo doble), no en las llamadas: `getProgression` solo lo
  llaman `ExerciseCard`, `sessionText` y `planSet`.
- Sin ella, el 1RM de unas dominadas es el 1RM **del lastre**: coherente, y es
  lo que mide quien las lastra (+10 → +12,5).

**Qué la reabriría**: que haya gente que haga Por esfuerzo con peso corporal, o
que ver «1RM 10 kg» en dominadas moleste en Progreso. Entonces lo barato es
empezar solo por el 1RM y los récords (§10.3), que no tocan el motor.
P12-08 ya deja el peso sellado en cada sesión, que es lo que haría falta.

### 10.1 Lo que decidió el usuario (2-oct)

1. Opción por ejercicio: **«Peso corporal: Solo lastre · Cuenta»**. Por
   defecto, **Solo lastre** (como hoy).
2. Lo que cambia: **Por esfuerzo, el 1RM y los récords**. La **carga**
   (`trainingLoad.js`) cuenta el peso corporal **siempre**, como hoy.
3. Por reglas no cambia.

### 10.2 Opción en el editor y Por esfuerzo con el cuerpo

- `exConfig.countBodyweight: true` (ausente = solo lastre). Solo si
  `isBodyweight(def)` (incluidos asistidos). `LINKED_CONFIG_KEYS` la añade.
  `ToggleRow` «Cuenta tu peso corporal» en el editor de ejercicio, junto a
  Registrar RPE (no en la hoja de Progresión: no es solo progresión).
  `saveSession` copia `countBodyweight: true` en el ejercicio del log (como
  `variant`), para que Progreso sepa, sesión a sesión, si contaba.
- `getProgression(exConfig, def, lastSets, t, { earlier, bodyWeight })`. Con
  `countBodyweight`, `chipEffort` trabaja con el **total**:
  `effectiveWeight(set, def, bodyWeight)` (cuerpo + lastre; asistidos, cuerpo −
  ayuda). El e1RM y `chip.e1rm` son del total; el peso que propone vuelve a lo
  que se carga: lastre = total − cuerpo (asistido: ayuda = cuerpo − total),
  redondeado al escalón o Exacto, nunca por debajo de 0 («sin lastre» / «sin
  ayuda»).
- Sin `bodyWeight`: mantener con `why_effortNoBodyweight` y sin `e1rm`.
- `progressionForm.showHow`: Por esfuerzo sale también en peso corporal y
  asistidos **si `countBodyweight`**; sin ella, apagado con la pista «Por
  esfuerzo en peso corporal necesita contar tu peso: actívalo en Opciones».
- `progressionRule` en asistido Por esfuerzo: «Ayuda calculada para 5 reps a
  RPE 8…».
- Peso en cada contexto: el de la sesión si se selló (P12-08); en sesiones
  anteriores (`earlier`) se usa el mismo de hoy (`ponytail:` unas semanas de
  diferencia son ruido frente al RPE).

### 10.3 1RM y récords con el cuerpo

`oneRm.recentE1RM`, `improvement.metricValue` y `sessionRecap.bestE1RM` leen
`set.weight` tal cual. Con el ejercicio del log marcado `countBodyweight`: el
peso de cada serie es el total (`effectiveWeight` con `entry.bodyWeight`) en el
1RM, la métrica kg de Progreso y los récords de peso y 1RM; los récords de reps
sin lastre (`bestReps`) no cambian; sin peso conocido, como hoy. Sesiones sin la
marca: como hoy.

Tests (cuando se haga): `progression.test.js` (dominadas, 60 kg + 10 kg × 5 @8
→ e1RM del total, propone lastre, total < cuerpo → 0, asistido → ayuda, sin
peso → `why_effortNoBodyweight`), `progressionForm.test.js`,
`sessionRecap.test.js`, `improvement.test.js`, `useStore.test.js` (el log copia
`countBodyweight`).

## 11. Registro

| Fase | Commit | Nota |
|---|---|---|
| P12-01 | `f5311ef` | cuatro fallos del motor |
| P12-02 | `e8c4f2e` … `8f52105` | diseño y maqueta (v1 → v3 + variantes de A) |
| P12-03 | `2fc2f19` | motor: modelo nuevo, chip único de peso, `setPlan` |
| P12-04 | `400d1de`, `56327d5` | motor (`canAddWeight`, `exact`, `progressionRule`) y editor (`progressionForm.js`, hoja nueva) |
| P12-05 | `66a5719`, `e04682f` | motor (1RM de tres sesiones, `progressionHistory`, calentamiento, `targetLabel` con `today`, `firstTimeRx`) y Workout (`planSet` en tarjeta y guardado, línea + ficha, `SetPills`) |
| P12-06 | — | movida a U11-01 (4-oct) |
| P12-07 | `d77ffd3` | motor (`isTimed`, `chipDouble`/`chipDoubleDecrease` en segundos, `progressionRule`), `planSet` al tiempo mínimo y hoja con Tiempo · Peso · Nada |
| P12-08 | `6fd801d` | sellado del peso en `saveSession` (sesión libre incluida) y fila «Peso corporal» en el menú (`parseBodyWeight`) |
| P12-09 | — | aparcada (2-oct): peso corporal en el motor |
| P12-10 | `2c2dc25` | `ProgressionSheet.jsx` extraída del editor y usada también en el alta; `def.progression` (`resolveProgressionConfig`, `isTimed` y `computeInitial` leen `def.inputType`); `trackRpe` al añadir |

## 12. P12-10 — Alta de ejercicio propio con la misma hoja de Progresión

Pedido en QA de P11-04 (3-oct-2026): «la hoja de progresión tiene que ser igual; ¿qué
sentido tiene tener dos?». `CustomExerciseScreen` se quedó con la hoja de antes
de P12-04 (Automática / Fija → tipo → incremento) y guarda en el `def` solo
`progressionModel` (nombre viejo) y `weightStep`. El editor usa la hoja de P12-04
(`progressionForm.js`: `initProgForm`, `patchProgForm`, `buildProgression`,
`needsRpe`, `upOptions`…), que vive en línea dentro de
`components/editor/ExerciseEditorInline.jsx` (`sheetSteps` / `addStep`, ~470-710,
y el `DragSheet` de ~1080).

### 12.1 Una sola hoja

- Se saca el cuerpo de la hoja de Progresión de `ExerciseEditorInline` a un
  componente propio, `components/editor/ProgressionSheet.jsx` (pasos numerados,
  hints y avisos, idénticos a hoy). Recibe el formulario (`prog`), el contexto
  (`ctx`: `def`, `sets`, `metric`, `range`), lo que necesite para pintar (unidad
  de peso, `minReps`, etc.) y un `onPatch(patch)`. Lo de «dejar el estado
  coherente» (`settle`: encender RPE, pasar a un solo valor de inicio…) se queda
  en quien lo usa, porque toca el estado de Volumen de cada pantalla.
- `ExerciseEditorInline` lo usa **sin cambiar nada visible** (P12-04 está probada).
- `CustomExerciseScreen` lo usa en lugar de su hoja vieja. Su estado de
  progresión pasa a ser el mismo formulario: `initProgForm({}, borrador, ctx)`,
  con un `def` borrador armado con lo que lleva la pantalla (`progressionDirection:
  'increase'`, `weightStep`, `isCustom`, equipo…), para que las opciones que
  ofrece (`canAddWeight`, Por esfuerzo…) sean las mismas que tendrá el
  ejercicio.
- **Volumen igual que en el editor**: la hoja depende de Rango / Reps fijas y
  del inicio único de Reps y Tiempo (§5.1), así que el bloque VOLUMEN del alta
  pasa a tener los mismos controles que el del editor (medida, Rango / Reps
  fijas, campos de inicio). Si conviene, se extrae también; si no, se copia la
  lógica mínima (`changeVolume` / `settle`).
- La ficha (grupo PROGRAMACIÓN, P11-04) y el Resumen del alta usan lo mismo que el
  editor: negrita `exerciseEditor.progTitle.*`, resto
  `progressionRule(…, { short: true })`, y la frase larga en el Resumen.

### 12.2 Dónde se guarda

- El `def` del ejercicio propio guarda la progresión entera:
  `def.progression = buildProgression(prog, ctx)`. `progressionModel` se sigue
  escribiendo (lo leen otros sitios) con el equivalente: `fixed` si `up ===
  'none'`, si no el de `LEGACY_TYPE_MAP` del tipo.
- `resolveProgressionConfig` (`utils/progression.js`) acepta `def.progression`
  como valor por defecto: prioridad `exConfig.progression` > `def.progression` >
  campos viejos. Test en `progression.test.js`.
- Si la progresión pide RPE (`needsRpe`), al añadirlo a una plantilla se escribe
  `trackRpe: true` con `updateExerciseParams`, igual que ya se hace con la
  variante en `handleCreate`.
- De paso: `computeInitial` del editor lee `exConfig.inputType ??
  def?.inputType ?? …`. Hoy un ejercicio propio de Tiempo con progresión Doble se
  abría en el editor como Reps, porque `addExercise` no copia `inputType`.
- Se borran las claves i18n que dejen de usarse (`progModes`, `progModeDesc`,
  `progTypes`, `progTypeDesc`, `stepMode`, `stepType`, `stepIncr`… solo si nadie
  más las usa: buscarlas antes).

**Lo que se iba a probar en P12-10** (dada por terminada el 4-oct-2026 sin marcar casilla a casilla)

- Alta de ejercicio propio → la hoja de Progresión es la misma del editor
  (mismos pasos, opciones y textos).
- Crear uno con Peso, +5 kg, «baja si fallan 2 de 3» → al abrirlo en la
  sesión, la hoja del editor enseña exactamente eso.
- Crear uno Por esfuerzo → en la sesión, Registrar RPE encendido y bloqueado.
- Crear uno de Tiempo → en el editor de la sesión sale en Tiempo, no en Reps.
- Volumen del alta: Rango / Reps fijas y los campos de inicio como en el
  editor.
- Editor de ejercicio: la hoja de Progresión sigue igual que antes (no
  regresión de P12-04).
