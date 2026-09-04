# Spec — Dropset y Superserie (mundo fuerza)

> Tema: entrenamiento
> En corto: Dropset (series inmediatas bajando peso) y superserie (dos ejercicios encadenados sin descanso) en el mundo fuerza, reutilizando la tarjeta de ejercicio de siempre.
> Fase T08 · hecho · Dropset: datos, toggle de editor, sub-filas y filtros de contabilidad · §1
> Fase T09 · hecho · Superserie: flag, agrupado, `SupersetBlock` y regla de descanso · §2
>
> Estado: **decisiones de producto tomadas, detalle de UX de agrupado a validar
> al implementar**. Mockups aprobados (`workout_view_superset_dropset`). Ambas
> features viven en el mundo FUERZA: reutilizan ExerciseCard/SetRow y el motor de
> progresión sigue siendo por ejercicio — NADA que ver con los bloques de
> acondicionamiento (spec aparte) ni con los linkGroups.

---

## 1. Dropset 🟢 (implementar primero — valida el patrón con riesgo mínimo)

### Concepto
Tras la última serie de trabajo, sub-series inmediatas a peso decreciente y sin
descanso. Se registran igual que series (peso×reps + ✓) pero son subordinadas.

### Datos
```js
// Prescripción (editor):
exConfig.dropset = null | true   // true = la ÚLTIMA serie de trabajo lleva drops
// Log: la última serie ganada gana un array (solo si el atleta registró drops):
set.drops = [{ weight, reps, done }]
```
v1: solo "última serie". Prescribir dropset por-serie arbitraria queda fuera.

### Editor
Toggle en OPCIONES del editor de ejercicio: "Dropset en la última serie" + hint.
La frase RESUMEN añade "· última con dropset".

### Workout (mockup)
- Bajo la última serie: sub-bloque indentado con borde izquierdo, label naranja
  "DROPS · sin descanso", filas peso×reps con ✓ (mismos inputs de SetRow, versión
  compacta), botón "＋ Añadir drop" (el atleta decide cuántos, típicamente 1-3).
- Los ✓ de drops NO disparan rest timer.
- El pre-relleno del primer drop puede sugerir −20% del peso de la serie madre
  (redondeado a 2,5) — editable; drops siguientes −20% del anterior.
- `allDone`/colapso: los drops NO bloquean el colapso (son opcionales).

### Contabilidad
| Métrica | ¿Cuentan los drops? |
|---|---|
| Volumen del recap | SÍ (trabajo real: Σ peso×reps) |
| Series (recap x/y, plannedSets) | NO |
| Progresión / evaluación | NO (el evaluador solo ve series de trabajo) |
| PRs | NO (reps en fatiga, no comparables) |
| Fantasmas última vez | los drops previos se muestran como ghost de los drops |

---

## 2. Superserie 🟢🟡

### Concepto
2+ ejercicios consecutivos ejecutados alternando (A1/A2): serie de A1 → serie de
A2 → descanso → repetir. Cada ejercicio conserva su config y su progresión.

### Datos — etiqueta de encadenado, lista sigue PLANA
```js
exConfig.supersetWithNext = true | ausente
// Grupo = cadena maximal de ejercicios CONSECUTIVOS con supersetWithNext:true
// (el último de la cadena puede no tenerlo; A1.supersetWithNext=true encadena A1+A2;
//  A1 y A2 true encadena A1+A2+A3).
```
- Decisión: adyacencia + flag, NO ids de grupo (más simple; el reorden por drag
  recompone las cadenas de forma natural — documentar este efecto en el hint).
- Duplicar sesión/etapa: el flag viaja con el exConfig, nada especial.
- ⚠️ punto a validar en implementación: si el drag-reorder parte una cadena de
  forma confusa, considerar limpiar flags huérfanos al reordenar.

### Editor
- En el editor de ejercicio (OPCIONES): toggle "En superserie con el siguiente"
  (visible solo si hay un ejercicio después en la sesión).
- En las filas de SessionEditorScreen: badge `SS` (accent) en los miembros, y
  render con conector visual entre filas encadenadas si es barato.

### Workout (mockup)
- `SupersetBlock`: contenedor que envuelve las ExerciseCards del grupo — cabecera
  "SUPERSERIE · N rondas · alternando", borde izquierdo accent continuo, badges
  A1/A2 junto al nombre. Las cards internas son las EXISTENTES (sin reescribir su
  maquinaria), solo se les inyecta el wrapper y la regla de descanso.
- **Descanso**: el ✓ de una serie de A1..A(n-1) NO dispara rest timer; el ✓ de la
  serie del ÚLTIMO ejercicio del grupo dispara el timer con el restSec de ESE
  último ejercicio. Pie del bloque: "Descanso Xs tras cada ronda".
- Progresión, fantasmas, autofill: sin cambios (por ejercicio).
- Colapso: cada card colapsa individualmente como hoy.

### Contabilidad
Cero cambios: cada ejercicio cuenta sus series/volumen/PRs/progresión como hoy.
`sessionStats` duración: los ejercicios de un grupo comparten el descanso → estimar
`rest` solo en el último miembro del grupo (los demás rest=0 para la estimación).

---

## 3. Orden de implementación y fases

1. 🟢 **Dropset**: datos + toggle editor + sub-filas workout + filtros de
   contabilidad (tests en sessionRecap para volumen-sí/series-no/PRs-no).
2. 🟢🟡 **Superserie**: flag + agrupado en editor + SupersetBlock + regla de descanso
   + estimación en sessionStats.

i18n: todas las strings nuevas por `t()` en es+en (claves bajo `exerciseEditor.*`
y `workout.*`). Reglas de lint/estilo: las de siempre (`th`, makeStyles, comparar
lint contra HEAD).
