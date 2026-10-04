# Spec — Preferencias de UI

> Tema: ui
> En corto: Las opciones que deciden cómo se ve una pantalla o una función —la última vez en el Workout, cómo se mueve la regla del peso…— viven todas aquí, en la sección Preferencias del menú.
> Fase U11-01 · pendiente · La última vez: botón, línea o debajo de cada serie · §2 · antes P57
> Fase U11-02 · pendiente · La regla se para en el incremento mínimo del ejercicio · §3
> Fase U11-03 · aparcado · Editor de sesión, vista lista grande (A2): número y nombre en una línea, dosis en etiquetas · §4.3 · antes P58
> Fase U11-04 · aparcado · Editor de sesión, vista grid de dos columnas (A) · §4.4 · antes P59
> Fase U11-05 · aparcado · Editor de sesión, vista cartas que se pasan deslizando (C baraja / D carrusel) · §4.5 · antes P60
>
> Estado: **abierta el 4-oct-2026** para juntar en un sitio las tareas de
> personalización de la interfaz, que andaban repartidas por las specs de cada
> función. U11-01 venía de P12-06 ([P12-progresion-clara.md](P12-progresion-clara.md) §7);
> U11-02 venía de U10-11 ([U10-todo-pesa.md](U10-todo-pesa.md) §2.7). Las dos se
> mueven con su texto tal cual; ninguna está implementada. U11-03 a U11-05 son la
> antigua spec P13 (editor de sesión como tarjetas y cartas, P13-01 a P13-03),
> metida aquí el 4-oct-2026 como posibles vistas del editor a elegir; siguen
> aparcadas y exploratorias. El archivo P13 se borró; el código P13 no se reutiliza.

## 1. Qué entra aquí

Una tarea es de esta spec si **da al usuario a elegir cómo se ve o se comporta
una pantalla o una función**, sin cambiar qué datos hay. Todas comparten:

- Se guardan en `profile` con `setProfile` (el `profile` ya persiste).
- Se eligen en la sección **Preferencias** del menú (`AppHeader.jsx`, donde
  están unidades, idioma y peso corporal).
- Tienen un valor por defecto que es el de hoy: quien no toque nada no nota el
  cambio.

Lo que decide **el entrenador para un programa** (progresión, RPE, vínculos…)
no es una preferencia de UI y sigue en su spec.

## 2. U11-01 — La última vez: botón, línea o debajo de cada serie

*Antes P12-06 (§7 de [P12-progresion-clara.md](P12-progresion-clara.md)).*

### 2.1 La preferencia

`profile.lastSessionView: 'button' | 'line' | 'below'`, **por defecto
`'button'`**. Fila nueva en el menú, sección Preferencias de `AppHeader.jsx`:
«Última sesión» con `SegmentedControl` Botón · Línea · Serie.

### 2.2 De dónde salen las sesiones

`recentLinkedExercises` y `recentExerciseRefs` ya existen (P12-05, §6.5 de
P12). `WorkoutScreen` ya calcula las tres últimas de cada tarjeta para Por
esfuerzo: U11-01 las pasa también, con su fecha, a la vista de la última vez.

### 2.3 Las tres vistas

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

**Probar U11-01**

- [ ] Instalación limpia: la tarjeta trae el icono de historial y abre las tres
  últimas sesiones con su fecha.
- [ ] Cambiar en el menú a Línea: la fila «Última · fecha» sin color bajo la
  recomendación. A Serie: lo de la última vez debajo de cada serie, alineado.
- [ ] Ejercicio vinculado entre sesiones A y C: el historial mezcla las dos.
- [ ] Sin historial: ni icono, ni línea, ni filas.

## 3. U11-02 — La regla se para en el incremento mínimo del ejercicio

*Antes U10-11 (§2.7 de [U10-todo-pesa.md](U10-todo-pesa.md)).*

**Más adelante** (3-oct, el usuario: «quizás esto se puede dejar para más
adelante»). Con barra se sube de 2,5 en 2,5, con mancuernas de 2 en 2. La
progresión y los ejercicios ya traen un **incremento mínimo** (ver
`increment` en `utils/progression.js`). La regla podría pararse solo en esos
pesos: menos posiciones, más fácil acertar.

- Lo decide el usuario: preferencia «Regla por incremento del ejercicio» (o
  similar), apagada por defecto; apagada, la regla va de 0,5 kg / 1 lb como
  en U10-01.
- Por pensar al especificar: qué incremento manda si el ejercicio y la
  progresión no coinciden, qué pasa con un valor fuera de esa rejilla (el
  mismo trato que §2.3 de U10: se mantiene hasta mover el dedo), y la escala
  (con pasos de 2,5 kg cabe más rango en la fila).

## 4. U11-03 a U11-05 — Vistas del editor de sesión (antes P13)

*Antes la spec P13 «Editor de sesión: ejercicios como tarjetas y cartas»
(P13-01 a P13-03), del 2-oct-2026.* **Exploratoria, no definitiva**: solo existe
la maqueta [`docs/mockups/session-cards.html`](../mockups/session-cards.html),
interactiva. Las tres están aparcadas a propósito: no se implementa nada hasta
que el usuario elija. Aquí cabrían como **preferencia de vista** del editor de
sesión (la lista de hoy por defecto). Si se retoma, U11-03 es la barata.

### 4.1 De dónde sale

El editor de sesión (`SessionEditorScreen.jsx`) enseña los ejercicios como una
lista de filas en la que todas dicen lo mismo con el mismo peso («4 × 6–8 ·
120s»). La idea era probar formas más agradables, con dos condiciones del
usuario:

- **Primero se entiende el orden, luego el contenido**: el número y el nombre
  mandan; la dosis va detrás.
- Mismos tokens de formaFit, y **sin el resumen** de la pantalla.

Descartado en la exploración: un grid con los −/+ siempre visibles en cada
tarjeta (tarjetas altas, se ve poca sesión) y el lápiz que giraba la tarjeta
para editar (tocar abre la ficha, como hoy).

### 4.2 Lo común a todas

- Tocar un ejercicio abre su ficha. **Mantener pulsado y arrastrar reordena**;
  al soltar se renumera.
- La superserie y el bloque se mueven enteros. El orden dentro de la
  superserie, en su ficha.
- El número usa `heroGlyph` (el del marcador de sesión) en acento; el nombre,
  `itemTitle`. Lo demás baja a `label` en `mutedLight`.

### 4.3 Lista grande (A2)

Una tarjeta ancha por fila, como la del AMRAP. Número y nombre en la misma
línea (alineados por la base), debajo la variante y la dosis en etiquetas
(«**4** series», «**6–8** reps», «**120** s descanso»). La superserie, dos
tarjetas pegadas a 2 px dentro del marco acento, como hoy.

Coste estimado: **+30-60 líneas** en `EditorRow`, sin ficheros nuevos; mismo
`Sortable.Grid` de una columna. Mantenimiento igual que hoy. Queda por decidir
si se quita el asa de arrastre (mantener en toda la fila puede chocar con el
deslizar que descubre sustituir/eliminar) o se deja y el cambio es solo de
estilo.

### 4.4 Grid de dos columnas (A)

Las mismas tarjetas en dos columnas: número grande arriba, nombre, variante y la
dosis abajo en gris pequeño. La superserie y el bloque ocupan la fila entera.

Coste estimado: parecido a U11-03 (`Sortable.Grid` con `columns={2}` y otra
tarjeta). Los nombres largos se parten en dos líneas.

### 4.5 Cartas (C baraja / D carrusel)

Una carta por ejercicio con sitio para todo: nombre, «4 × 6–8» grande,
«Última vez» con las reps de cada serie, −/+ de series, descanso, mín y máx,
la progresión a un toque y «Abrir ficha completa». La última carta es «+ Añadir».

- **C · Baraja apilada**: se arrastra la carta para pasar. **Orden**: en la tira
  de fichas numeradas de abajo, manteniendo y arrastrando. **Superserie**: en la
  3a, la 3b asoma más y enseña su nombre; el borde de abajo de la 3a se enciende.
- **D · Carrusel con vecinos**: scroll lateral con imán. **Orden**: mantener una
  carta «aleja» la baraja y queda el grid (§4.4) en pequeño para arrastrar.
  **Superserie**: la pareja no se encoge y una grapa acento cruza el hueco.

Coste estimado: **+600-800 líneas** en 3-4 ficheros nuevos y ~15 claves de
i18n. Lo caro no es hacerlo sino mantenerlo: los −/+ repiten la sección de
volumen de `ExerciseEditorInline.jsx` (modos Reps/Tiempo/Submáx, mín ≤ máx) y
los bloques tienen tres formatos. Para no duplicar lógica habría que sacar esa
sección a un componente compartido, y cada cambio del modelo de progresión
(P12-03–P12-06, U10-01–U10-09) tocaría dos pantallas. Sin −/+ baja a ~350 líneas, pero
entonces es una A2 más lenta de recorrer.
