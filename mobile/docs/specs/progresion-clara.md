# Spec — Progresión clara

> Tema: programas
> En corto: El motor de progresión ya cubre casi todas las formas de entrenar, pero daba consejos equivocados en cuatro casos y ni el editor ni el Workout dejaban claro qué decide. Primero se arreglan los fallos; después se ordena en tres preguntas (qué pides, qué sube, cuándo y cuánto) y el plan del motor pasa a ser el gris de cada serie.
> Fase P52 · hecho · Cuatro fallos del motor · §2
> Fase P53 · pendiente · Editor en tres preguntas y el plan en el Workout · §3
>
> Estado: **P52 hecha** (1-oct-2026, `f5311ef`, rama `feat/recap`), pendiente de
> probar en dispositivo. **P53 en maqueta**: `docs/mockups/progression.html`, con
> cinco decisiones abiertas en su §«Para decidir». No se escribe la P53 en detalle
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

## 3. P53 — Editor en tres preguntas y el plan en el Workout

Maqueta: [`docs/mockups/progression.html`](../mockups/progression.html), con los
casos A–G y los estados primera vez, descarga y objetivo del entrenador.

**Editor.** La hoja de cuatro pasos (modo → tipo → cuándo → cuánto) se sustituye
por tres secciones a la vista:

1. **Qué pides**: Reps/Tiempo, y para reps Rango · Reps fijas · Reps @ RPE.
   «Por esfuerzo» deja de ser un modo y pasa a ser una forma de pedir.
2. **Qué sube**: solo las opciones que tienen sentido con lo pedido. Peso y Doble
   se funden (la diferencia es rango o reps fijas), «Fija» es «Nada», en un
   asistido la opción es «Asistencia ↓» y con @ RPE no hay pregunta.
3. **Cuándo y cuánto**: fila que abre la hoja con la exigencia y el salto.

El Resumen añade **Próxima sesión**: el plan que verá el cliente, calculado con
su última sesión. Es lo que da control al entrenador.

**Workout.** La línea de progresión pasa a ser la cabecera del plan y **el gris
de cada serie es el plan**: peso de la progresión y reps del objetivo. ✓ acepta
exactamente eso, y `saveSession.resolveSet` y la tarjeta tienen que salir de
**una sola función**, porque hoy son dos cascadas copiadas. Sin historial, «busca
un peso con el que hagas 8–12». Lo de la última vez se sigue viendo: línea,
botón de historial o columna (decisión abierta 1 de la maqueta).

Decisiones abiertas: las cinco de la maqueta, §«Para decidir».
