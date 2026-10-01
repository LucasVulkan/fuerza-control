# Spec — Progresión clara

> Tema: programas
> En corto: El motor de progresión ya cubre casi todas las formas de entrenar, pero daba consejos equivocados en cuatro casos y ni el editor ni el Workout dejaban claro qué decide. Primero se arreglan los fallos; después se ordena en tres preguntas (qué pides, qué sube, cuándo y cuánto) y el plan del motor pasa a ser el gris de cada serie.
> Fase P52 · hecho · Cuatro fallos del motor · §2
> Fase P53 · pendiente · Qué pides en el editor, la progresión en su hoja, el plan en el Workout · §3
>
> Estado: **P52 hecha** (1-oct-2026, `f5311ef`, rama `feat/recap`), pendiente de
> probar en dispositivo. **P53 en maqueta v2** (`docs/mockups/progression.html`, revisada
> con el usuario el 1-oct; decisiones en §3.1), con cinco preguntas abiertas en su §«Para decidir». No se escribe la P53 en detalle
> hasta que el usuario las cierre. La escalera (top set + back-off, pirámide
> invertida) va **después** de la P53 y como extensión de «Qué pides»: sin motor nuevo.

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

- [ ] Dominadas en Automática · Reps, rango 6–12: hacer 9/8/8 → la próxima vez
  dice «apunta a 9 reps». Hacer 7/6/5 → «llega al mínimo».
- [ ] Plancha en Automática · Tiempo, 30–60 s: hacer 45/45/40 → la próxima vez
  propone 45 s. Al cambiar el tipo a Tiempo en el editor, el salto pasa a 5 s.
- [ ] Dominadas asistidas: cambiar las series en el editor y completar todas al
  máximo con 20 kg → propone **bajar** a 17,5 kg.
- [ ] Press banca en Doble con «% mínimo» al 60 %: 2 de 3 series al máximo → sube.

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
11. **Última vez: línea (sin color) y botón, a elegir en Ajustes**; la maqueta
    añade «debajo de cada serie». Fuera la columna estilo Strong.

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

**Tiempo con carga** (propuesta, pendiente de confirmar): con medida Tiempo y un
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
- Tiempo + Peso: la doble progresión de `chipDouble` sobre segundos.
- La evaluación por RPE deja de depender de que Registrar RPE esté encendido:
  lo enciende la propia progresión.
- Fuera `seed`, `custom`, `stepped` y `minRir`, que nadie usa.

### 3.4 Workout

La línea de progresión es la cabecera del plan y **el gris de cada serie es el
plan**: el peso de la progresión y las reps del objetivo. Si no se cumplió, el
gris es lo que hiciste. ✓ acepta lo que se ve: `saveSession.resolveSet` y la
tarjeta tienen que salir de una sola función. Sin historial, «busca un peso con
el que hagas 8–12». Lo de la última vez: línea sin color, botón de historial o
debajo de cada serie, a elegir en Ajustes.

Decisiones abiertas: las de la maqueta, §«Para decidir».
