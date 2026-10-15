# Spec — Catálogo por movimientos

> Tema: entrenamiento
> En corto: Dejar de elegir entre trece remos: buscas un movimiento («Remo»), eliges su forma con chips (implemento, postura, lado…) y el nombre se escribe solo. Los 230 ejercicios de hoy pasan a ser las formas destacadas, sin perder ids ni historial. Progreso enseña el movimiento entero (relativo) o cada forma (absoluto), y en el Workout se puede cambiar de forma solo para esa sesión.
> Fase T08-01 · pendiente · Movimientos y formas: datos y utilidades puras · §4
> Fase T08-02 · pendiente · Maqueta v2 sobre el selector y Progreso actuales · §5
> Fase T08-03 · pendiente · Buscador agrupado por movimiento · §6
> Fase T08-04 · pendiente · Hoja «Elegir forma» · §7
> Fase T08-05 · pendiente · Factores de carga y peso sugerido · §8
> Fase T08-06 · pendiente · Progreso relativo y absoluto · §9
> Fase T08-07 · pendiente · Cambiar de forma en el Workout, solo esta sesión · §10
> Fase T08-08 · pendiente · Ejercicio propio por composición · §11
>
> Estado: spec escrita el 15-oct-2026, sin implementar y **sin fecha**: el refactor no empieza todavía. Sale de la conversación sobre T07 y de la maqueta v1 [`docs/mockups/catalogo-movimientos.html`](../mockups/catalogo-movimientos.html). Peldaños de calistenia → V2; Gimnasio/Casa → V3 (§12).

---

## 1. El problema

La librería es una lista plana: cada combinación de movimiento + implemento + postura
+ lado es una ficha escrita a mano. Buscar «remo» da 14 resultados, siempre falta
alguna combinación y el material va pegado a cada ficha. P09 descartó las «familias»
porque su borde era arbitrario (¿por qué el remo en T sí y el de anillas no?). Este
modelo lo resuelve con un criterio biomecánico en lugar de una lista: **un movimiento es
un gesto** (tracción horizontal con flexión de codo = Remo), y todo lo que cambia
alrededor —implemento, postura, lado— son **ejes**.

## 2. Decisiones del usuario (15-oct-2026, no reabrir)

- **Movimiento × ejes.** Se busca y se elige el movimiento; la forma se compone con
  chips. El nombre de una forma sin ficha se **genera** con una plantilla por movimiento
  que conoce su género («Press militar sentado»).
- **Los 230 ejercicios actuales son las formas destacadas.** Conservan id, nombre,
  consejos e historial. Lo procedural solo cubre las combinaciones que no tienen ficha.
- **Nombres propios** (Meadows, Seal row, Pendlay, Kroc…): si su forma ya tiene ficha,
  son un **alias** de esa ficha (`aliases`, T07); si no, son una forma destacada propia.
  Dos fichas con la misma forma no pueden existir (§4.4).
- **Asistida es un valor del implemento** en los movimientos que la admiten (dominada,
  fondos, muscle-up, pistol): «Asistida con banda», «Máquina asistida». Lo apuntado es
  la ayuda (`progressionDirection: 'decrease'`, como hoy).
- **El tempo no es forma.** Va en los ajustes del ejercicio (`exConfig.tempo`, ya
  existe). La «Sentadilla con pausa» deja de ser ficha (§4.4).
- **Ilustraciones**: una genérica por movimiento y una propia para las formas
  destacadas o con nombre que la tengan. Se busca primero la de la forma y, si no hay,
  la del movimiento. El arte no entra aquí; sí el hueco y la cadena (§4.1, §7).
- **Buscador agrupado**: cada resultado sale bajo su movimiento; la cabecera abre la
  hoja con lo escrito ya puesto y debajo van las formas concretas que coinciden (§6).
- **Progreso**: modo **relativo** (una línea en kilos de la forma de referencia del
  movimiento) y **absoluto** (cada forma por separado) (§9).
- **Cambiar de forma en el Workout** desde un icono que abre la hoja completa (no solo
  el implemento). Afecta solo a esa sesión; la siguiente vuelve a la del programa (§10).
- **Fuera**: peldaños como forma de progresar (V2) y Gimnasio/Casa (V3) (§12).

## 3. Lo que ya existe y se aprovecha

| Pieza | Dónde | Qué aporta |
|---|---|---|
| Ids derivados canónicos | `src/utils/exerciseIdentity.js` (`compose`, `decompose`) | `<root>__uni`, `<root>__<variante>`: el mismo mecanismo con más ejes |
| Variantes que solo informan | `src/utils/variants.js` (P09) | agarre y anchura: siguen siendo variante, no forma |
| Migración de ids | `src/utils/exerciseIdMigration.js` (`LEGACY_IDS`) | para las fichas que se juntan (§4.4) |
| Alias del buscador | `aliases` en la ficha (T07) | nombres propios que apuntan a una forma |
| Buscador | `src/utils/searchText.js` + `ExerciseSelectorScreen` | rediseñado en `02fbfb1` (bandeja de seleccionados, «En tu programa» primero). Puede cambiar con la maqueta v2: no es una base obligada |
| Detalle de ejercicio | `src/components/stats/ExerciseDetail.jsx` + `ProgressChart.jsx` | rediseñados en `02fbfb1`/`257fd61` (gráfica arrastrable, métricas, filtro por variante de P09-05). También pueden cambiar con la maqueta v2 |
| Carga externa | `src/utils/trainingLoad.js` | se divide por el e1RM del propio ejercicio: vale forma a forma sin cambios (§8.3) |
| Taxonomía | `src/utils/exerciseTaxonomy.js` | patrón, grupo y material: el movimiento los hereda |

## 4. T08-01 — Movimientos y formas (datos y utilidades)

Sin UI. Todo puro y con tests.

### 4.1 `src/data/movements.js` (nuevo)

```js
export const MOVEMENTS = {
  row: {
    id: 'row', name: 'Remo', nameEn: 'Row',
    pattern: 'horizontal_pull', primaryGroup: 'back',
    reference: 'barbell_row',              // forma de referencia (§9)
    illustration: 'row',                    // clave del arte genérico; null = sin dibujo
    axes: [                                 // en orden de pintado
      { id: 'impl', load: true,  values: ['barbell','db','kb','cable','machine','landmine','rings','bw','band'] },
      { id: 'pos',  load: true,  values: ['bent','chest','seated','hang'] },
      { id: 'side', load: true,  values: ['bi','uni'] },
    ],
    variants: ['grip','width'],            // ejes que solo informan (P09), sin cambios
    valid: {                               // qué valores admite cada implemento
      pos:  { barbell: ['bent','chest'], rings: ['hang'], bw: ['hang'], machine: ['seated','chest'], … },
      side: { barbell: ['bi'], rings: ['bi'], bw: ['bi'] },
    },
    name: { es: …, en: … },                // plantilla del nombre (§4.3)
  },
  …
};
```

- `load: true` = el eje **separa historial** (otra forma). Lo que solo informa sigue en
  `variants` como hoy. Un mismo eje puede cargar en un movimiento y no en otro: el agarre
  carga en Curl (martillo, inverso) y solo informa en Remo.
- Valores de implemento: los de `exerciseTaxonomy.EQUIPMENT` más `smith`, `landmine`,
  `trap` y los asistidos `assisted_band` / `assisted_machine`. El material de la ficha
  (`equipment`) **se sigue guardando**: el generador de programas filtra por él.
- Los ejes que no son implemento o lado son propios de cada movimiento («Postura»,
  «Dónde va la carga», «Ángulo», «Estilo»…). Su etiqueta va a i18n
  (`movements.<id>.axes.<eje>`, `movements.<id>.values.<valor>`).

### 4.2 La ficha gana `movement` y `form`

```js
barbell_row: { …, movement: 'row', form: { impl: 'barbell', pos: 'bent', side: 'bi' } },
```

- Las 230 fichas lo llevan. `isUnilateral` / `unilateralOf` se mantienen (los lee
  `exerciseIdentity`) pero deben **cuadrar** con `form.side`: lo comprueba un test.
- Un movimiento con una sola forma (Jefferson curl, levantamiento turco…) es válido: se
  comporta exactamente como un ejercicio de hoy.

### 4.3 `src/utils/movements.js` (nuevo)

| Función | Qué hace |
|---|---|
| `allowed(mv, axis, form)` | valores válidos de un eje dado el resto |
| `fix(mv, form)` | lleva una forma al punto válido más cercano |
| `compose(mv, want, prefer)` | lo pedido manda: si un valor no casa con el implemento, busca uno que sí (pedir «una mano» con barra → mancuerna). Ya probado en la maqueta |
| `featuredOf(mvId, lib)` | las fichas de ese movimiento |
| `formId(mvId, form, lib)` | la ficha si existe; si no, el id derivado `mv_<mov>__<valores>` (canónico, igual en dos móviles, como `__uni`) |
| `deriveForm(mvId, form, lib)` | la definición a guardar en `customExercises` para una forma sin ficha: copia de la ficha destacada más cercana (progresión, descanso, nivel) con el nombre generado en es y en |
| `formName(mv, form, lang)` | el nombre con la plantilla del movimiento |
| `parseQuery(text)` | palabras → `{ words, form }` («remo kb una mano» → `impl: kb, side: uni`) |

Las plantillas son cadenas de i18n con huecos (`{{lado}}`, `{{implemento}}`,
`{{postura}}`) y casos especiales por movimiento («Remo en anillas», «Remo invertido»,
«Hack squat»). Género: los adjetivos de la persona en masculino (T07).

### 4.4 Choques: dos fichas con la misma forma

Un test recorre la librería y **falla si dos fichas comparten movimiento + forma**. Los
choques conocidos y su resolución (con `LEGACY_IDS`, el historial se junta):

| Choque | Resolución |
|---|---|
| `landmine_row` ≈ `meadows_row` | queda `landmine_row` con alias «Meadows» |
| `pause_squat_barbell` | → `squat_barbell`; la migración pone `tempo: '3210'` en el `exConfig` de las plantillas que la usaban (hay que extender `migrateExerciseRefs`) |
| `leg_press_standard/high/wide` | la posición de los pies pasa a variante que solo informa (`feet`), las tres se juntan en `leg_press_standard` |
| los que salgan al pasar el test | se deciden con el usuario antes de cerrar la fase |

### 4.5 Movimientos (borrador para cerrar en la fase)

Unos 45–55. El reparto exacto es entregable de esta fase; esto es la propuesta:

- **Tracción**: Remo · Dominada (incluye supina, al pecho, arquero, máquina de escribir; asistidas) · Muscle-up · Jalón · Pullover / brazos rectos · Vuelo posterior (pájaros, pull-apart) · Face pull · Encogimiento · Remo al mentón · Curl de bíceps (martillo e inverso como agarre que carga) · Curl de muñeca.
- **Empuje**: Press de banca (ángulo: plano/inclinado/declinado; agarre cerrado) · Aperturas · Flexiones · Fondos (asistidos) · Press militar · Push press / jerk · Pino (flexión pica, contra la pared, libre) · Elevaciones (lateral/frontal) · Extensión de tríceps.
- **Pierna**: Sentadilla · Prensa · Hack · Zancada (incluye **búlgara**, step-up, lateral, cosaca) · Sentadilla a una pierna (pistol, asistida, camarón) · Extensión de cuádriceps · Sissy · Gemelos · Thruster.
- **Bisagra**: Peso muerto (estilo: convencional/sumo/rumano; a una pierna) · Buenos días · Hip thrust / puente · Curl femoral (tumbado, sentado, nórdico, GHR) · Extensión de espalda · Abducción · Aducción · Patada de glúteo · Pull-through · Swing · Jefferson curl.
- **Halterofilia**: Cargada (potencia, colgante, en sentadilla) · Arrancada · Dos tiempos.
- **Core**: Plancha · Hollow · Dead bug / bird dog · Elevación de piernas · Crunch / sit-up · Rueda abdominal · Antirrotación (Pallof, leñador, russian twist) · Levantamiento turco · Levers · Planche · L-sit · Dragon flag.
- **Agarre y carga**: Acarreo · Colgado · Subida de cuerda.
- **Acondicionamiento**: Remo ergómetro · Bici · SkiErg · Carrera · Comba (simple/dobles) · Trineo (empujar/arrastrar) · Balón medicinal (wall ball/slam) · Burpee · Devil press · Battle rope · Saltos · Jumping jacks · Rodillas al pecho · Mountain climber · Gateo del oso.

**Probar T08-01**: no tiene UI; se cierra a `terminado` con tests verdes.

## 5. T08-02 — Maqueta v2

Sin código de la app. Sobre la v1. El selector y el detalle de Progreso actuales
(`02fbfb1`, maqueta `progreso-y-selector.html`) son una referencia, no una restricción:
si el diseño de T08 pide cambiarlos, se cambian.

1. Buscador agrupado (§6), con «sentadilla con barra» y «búlgara» como ejemplos.
2. Hoja «Elegir forma» con implemento asistido, hueco de ilustración y nombres propios.
3. Workout: icono para cambiar de forma y aviso «Solo esta sesión» (§10).
4. Progreso: interruptor Relativo / Absoluto y tabla de formas (§9).
5. Sin Gimnasio/Casa y sin escalera de peldaños.

Se cierra cuando el usuario la apruebe; puede cambiar §6–§10.

## 6. T08-03 — Buscador agrupado

En `ExerciseSelectorScreen` y en el buscador del constructor
(`components/onboarding/builder/ExerciseSearch.jsx`). Mantiene los modos actuales
(selección múltiple, sustituir, `blockPicker` de bloques) y lo de `02fbfb1`.

- **Sin texto**: la lista es de movimientos (glifo o ilustración, nombre, «N formas»,
  última forma que hiciste). «En tu programa» sigue primero.
- **Con texto**: resultados **agrupados por movimiento**. Cabecera = movimiento (abre la
  hoja con lo escrito ya puesto: `parseQuery`). Debajo, las formas que coinciden, **cada
  una añadible con un toque**. Varios movimientos coinciden → varios grupos; primero el
  que casa por nombre.
- **Qué formas se listan**: destacadas + las que ya has hecho (están en tu historial o en
  `customExercises`). Las combinaciones teóricas no: se llega a ellas por la cabecera.
  Máximo 5 por grupo, con «Ver N más».
- Ejemplo «sentadilla con barra»: **Sentadilla** → trasera, frontal, en cajón, Zercher;
  **Zancada** → «Sentadilla búlgara con barra» solo si es destacada o la has hecho. La
  barra alta o baja es variante que solo informa: no sale como forma.
- Si la búsqueda describe una forma exacta de un solo movimiento, tarjeta «Lo que has
  escrito» con añadir directo (maqueta v1).
- Las pills de patrón filtran movimientos, no formas.

**Probar T08-03**

- [ ] Sin texto: «Remo · N formas» en lugar de catorce remos.
- [ ] «remo kb una mano» → tarjeta con «Remo a una mano con kettlebell».
- [ ] «búlgara» → sale bajo **Zancada**.
- [ ] «sentadilla con barra» → grupo Sentadilla con sus formas con barra; añadir una con un toque.
- [ ] Modo sustituir y selector de movimientos de bloque siguen funcionando.

## 7. T08-04 — Hoja «Elegir forma»

Componente compartido (`components/exercise/FormSheet.jsx`, `DragSheet`). La usan el
buscador (§6), el Workout (§10) y el editor de ejercicio.

- Arriba: movimiento (caps), **nombre generado** en vivo e ilustración (la de la forma
  si la tiene; si no, la del movimiento; si tampoco, el glifo).
- Un eje por fila con chips; los que **cargan** primero y las variantes que solo
  informan (agarre, anchura) al final con «solo informa». Un chip que no casa sale
  atenuado pero **se puede pulsar**: `compose` cambia lo necesario.
- Fila «Con nombre propio» (alias y formas destacadas con nombre).
- Pie: tu última vez en esa forma, o el **peso sugerido** si es nueva (§8). Botón Añadir
  / Cambiar.
- Elegir una forma sin ficha la **materializa** en `customExercises` con
  `deriveForm` (viaja con programas e historial como los derivados de P09).
- **Editor de ejercicio**: la hoja «Variante» de P09-04 conserva agarre/anchura y
  «Ejercicio aparte»; el interruptor «Unilateral» pasa a ser el eje Lado de esta hoja.
  Mismas reglas de bloqueo (P09 §6.5).

**Probar T08-04**

- [ ] Remo: Barra → pulsar «Una mano» → pasa a mancuerna y el nombre cambia.
- [ ] Dominada: implemento «Asistida con banda» → el campo de peso dice ayuda.
- [ ] Una forma nueva (p. ej. remo con kettlebell pecho apoyado) queda guardada y su
  historial es suyo.
- [ ] Meadows en la fila de nombres propios marca landmine + una mano.

## 8. T08-05 — Factores de carga y peso sugerido

### 8.1 Tabla de partida

Por movimiento, en `movements.js`: `factor[impl]` (respecto a la referencia; en
mancuerna y kettlebell, **por mano**), `posFactor`, y a una mano ×`uni` (mancuerna o
kettlebell) o ×0,55 (el resto). Los números se fijan en esta fase. Siempre se enseñan
con «≈».

### 8.2 Recalibración con tus datos

Si en las últimas 6 semanas (`REF_WEEKS`) tienes e1RM en la forma de referencia y en
otra, el factor de esa forma pasa a ser **tu cociente** (media con el de la tabla
mientras haya pocas sesiones). Puro, en `movements.js`, con tests.

### 8.3 Dónde se usa

- **Peso sugerido** en la hoja (§7) y al cambiar de forma (§10).
- **Carga externa**: sin cambios (cada forma es un id y se divide por su propio e1RM).
  Solo un paso nuevo en la cascada de `makeRefResolver`: entre el 1 y el 2, la
  referencia **prestada** del movimiento (e1RM de otra forma × factor), para que la
  primera sesión de una forma nueva no tome su propia sesión como referencia.
- Volumen semanal, récords del recap, progresión del programa y «última vez»: **por
  forma, sin cambios**.

**Probar T08-05**

- [ ] Remo con barra 80 × 8 en el historial → forma nueva de mancuerna a una mano sugiere ≈ 32–36 kg.
- [ ] Tras hacer las dos formas, la sugerencia se acerca a tu cociente real.

## 9. T08-06 — Progreso relativo y absoluto

Sobre `ExerciseDetail` + `ProgressChart` actuales.

- El detalle se abre **por movimiento** cuando el ejercicio tiene más de una forma con
  historial; si solo hay una, es el detalle de hoy, sin interruptor.
- **Relativo** (por defecto con 2+ formas): una línea en kg de la forma de referencia
  («kg de remo con barra»), un color por forma. La unidad sale en el título.
- **Absoluto**: una línea por forma con sus kilos reales; debajo, tabla con el récord
  de cada una.
- Chips por forma para apagar y encender (las de la maqueta v1). Convive con el filtro
  por variante de P09-05.
- Las métricas de arriba (Peso máx, Reps máx, Reps totales, Volumen, e1RM) en relativo
  se calculan en kilos de referencia; en absoluto, de la forma elegida.

**Probar T08-06**

- [ ] Remo con barra y remo con mancuerna en el historial → relativo: una línea con dos colores.
- [ ] Absoluto: dos líneas y tabla con el récord de cada forma.
- [ ] Un ejercicio con una sola forma se ve como hoy.

## 10. T08-07 — Cambiar de forma en el Workout

- Icono en la cabecera de la tarjeta del ejercicio (`components/workout/ExerciseCard.jsx`)
  → la hoja de §7 con **todos** los ejes, título «Solo esta sesión».
- **Hasta la primera serie hecha.** Con series marcadas el icono sale apagado (más
  adelante: «cambiar para las que quedan», con dos entradas en el registro).
- Al cambiar: el `exerciseId` de ese hueco pasa a la forma nueva en `activeSession`
  (`setsState`, notas, «última vez» de esa forma, peso sugerido por §8). El programa
  **no se toca**: la siguiente sesión vuelve a su forma.
- El registro guarda la forma hecha. La progresión del programa se calcula con el
  historial de **su** forma, así que una sesión suelta en otra no la mueve; en Progreso
  relativo sí aparece.
- Es el «Sustituir» que P09 §1.4 dejó fuera: reasignar lo que va por `exerciseId`
  (`setsState`, `exerciseNotes`, `lastExerciseRef`, recap y guardado). Si la forma nueva
  ya está en la sesión, no se deja (misma regla de hoy: un ejercicio, una vez).

**Probar T08-07**

- [ ] Sentadilla trasera → cambiar a frontal antes de empezar: nombre, «última vez» y peso cambian.
- [ ] Guardar: el historial de la frontal recibe la sesión; la trasera no.
- [ ] La siguiente sesión del programa vuelve a ser trasera.
- [ ] Con una serie marcada, el icono no deja cambiar.

## 11. T08-08 — Ejercicio propio por composición

`CustomExerciseScreen` empieza preguntando el movimiento: elegido uno, es la hoja de
§7 con nombre editable (y se guarda como forma derivada). «No está en la lista» abre el
formulario de hoy, que sigue igual.

**Probar T08-08**

- [ ] Crear «Remo con kettlebell pecho apoyado» desde Remo: sale en el buscador bajo Remo.
- [ ] «No está en la lista» abre el formulario en blanco de siempre.

## 12. Fuera de alcance

- **Peldaños (V2).** Progresar por palanca («Qué sube: Peldaño») está pensado pero no
  cerrado: una dominada negativa y una con goma conviven, no son una escalera estricta.
  Idea guardada: escalera por movimiento con % de peso corporal y métricas con chips por
  peldaño. La forma con peldaño fijo y lastre (la «normal») sí entra ya: es una forma más.
- **Gimnasio / Casa (V3).** Material por sitio y el Workout eligiendo forma según dónde
  estás.
- **Arte de ilustraciones.** Aquí solo el hueco y la cadena forma → movimiento.
- **Pegar entrenos** (`PasteWorkoutScreen`) usando `parseQuery`: mejora natural, después.

## 13. Reglas para quien implemente

- **Ningún id existente cambia** salvo los de `LEGACY_IDS` de §4.4.
- Locales: claves nuevas línea a línea en `es.json` y `en.json`, sin reformatear.
- UI: leer `docs/UI-MIGRATION.md`; FormaFit exacto; `textStyles` sin tamaños propios;
  animaciones con Reanimated.
- El selector y Progreso se rehacen según la maqueta v2 aprobada; lo de `02fbfb1` / `257fd61` se conserva solo si la maqueta lo mantiene.
- Tests: `npx vitest run` desde la raíz; `npx eslint <archivo>` sin errores nuevos.
- Reparto (memoria del proyecto): T08-01 §4.4–4.5 y la tabla de §8.1 piden criterio de
  contenido (Fable/Opus); el resto, Sonnet con esta spec.

## Fases

| Fase | Qué | Depende de | Estado |
|---|---|---|---|
| T08-01 | Datos y utilidades | — | pendiente |
| T08-02 | Maqueta v2 | — | pendiente |
| T08-03 | Buscador agrupado | 01, 02 | pendiente |
| T08-04 | Hoja «Elegir forma» | 01, 02 | pendiente |
| T08-05 | Factores y peso sugerido | 01 | pendiente |
| T08-06 | Progreso relativo/absoluto | 01, 05 | pendiente |
| T08-07 | Cambiar forma en el Workout | 04, 05 | pendiente |
| T08-08 | Ejercicio propio por composición | 04 | pendiente |
