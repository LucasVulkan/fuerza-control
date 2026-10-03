# Spec — Editor de sesión: ejercicios como tarjetas y cartas

> Tema: programas
> En corto: Exploración de formas más agradables de enseñar los ejercicios en el editor de sesión: una lista de tarjetas grandes, un grid de dos columnas y cartas que se pasan deslizando con −/+ dentro. Nada decidido.
> Fase P13-01 · aparcado · Lista grande (A2): número y nombre en una línea, dosis en etiquetas · §3 · antes P58
> Fase P13-02 · aparcado · Grid de dos columnas (A) · §4 · antes P59
> Fase P13-03 · aparcado · Cartas que se pasan deslizando (C baraja / D carrusel) · §5 · antes P60
>
> Estado: **exploratoria, no definitiva** (2-oct-2026). Solo existe la maqueta
> [`docs/mockups/session-cards.html`](../mockups/session-cards.html), interactiva.
> Las tres fases están aparcadas a propósito: no hay que implementar nada hasta
> que el usuario elija. Si se retoma, la P13-01 es la barata y la P13-03 conviene
> después de cerrar P12-03–P12-06 de [P12-progresion-clara.md](P12-progresion-clara.md).

## 1. De dónde sale

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

## 2. Lo común a todas

- Tocar un ejercicio abre su ficha. **Mantener pulsado y arrastrar reordena**;
  al soltar se renumera.
- La superserie y el bloque se mueven enteros. El orden dentro de la
  superserie, en su ficha.
- El número usa `heroGlyph` (el del marcador de sesión) en acento; el nombre,
  `itemTitle`. Lo demás baja a `label` en `mutedLight`.

## 3. Lista grande (A2)

Una tarjeta ancha por fila, como la del AMRAP. Número y nombre en la misma
línea (alineados por la base), debajo la variante y la dosis en etiquetas
(«**4** series», «**6–8** reps», «**120** s descanso»). La superserie, dos
tarjetas pegadas a 2 px dentro del marco acento, como hoy.

Coste estimado: **+30-60 líneas** en `EditorRow`, sin ficheros nuevos; mismo
`Sortable.Grid` de una columna. Mantenimiento igual que hoy. Queda por decidir
si se quita el asa de arrastre (mantener en toda la fila puede chocar con el
deslizar que descubre sustituir/eliminar) o se deja y el cambio es solo de
estilo.

## 4. Grid de dos columnas (A)

Las mismas tarjetas en dos columnas: número grande arriba, nombre, variante y la
dosis abajo en gris pequeño. La superserie y el bloque ocupan la fila entera.

Coste estimado: parecido a P13-01 (`Sortable.Grid` con `columns={2}` y otra
tarjeta). Los nombres largos se parten en dos líneas.

## 5. Cartas (C baraja / D carrusel)

Una carta por ejercicio con sitio para todo: nombre, «4 × 6–8» grande,
«Última vez» con las reps de cada serie, −/+ de series, descanso, mín y máx,
la progresión a un toque y «Abrir ficha completa». La última carta es «+ Añadir».

- **C · Baraja apilada**: se arrastra la carta para pasar. **Orden**: en la tira
  de fichas numeradas de abajo, manteniendo y arrastrando. **Superserie**: en la
  3a, la 3b asoma más y enseña su nombre; el borde de abajo de la 3a se enciende.
- **D · Carrusel con vecinos**: scroll lateral con imán. **Orden**: mantener una
  carta «aleja» la baraja y queda el grid (§4) en pequeño para arrastrar.
  **Superserie**: la pareja no se encoge y una grapa acento cruza el hueco.

Coste estimado: **+600-800 líneas** en 3-4 ficheros nuevos y ~15 claves de
i18n. Lo caro no es hacerlo sino mantenerlo: los −/+ repiten la sección de
volumen de `ExerciseEditorInline.jsx` (modos Reps/Tiempo/Submáx, mín ≤ máx) y
los bloques tienen tres formatos. Para no duplicar lógica habría que sacar esa
sección a un componente compartido, y cada cambio del modelo de progresión
(P12-03–P12-06, U10-01–U10-09) tocaría dos pantallas. Sin −/+ baja a ~350 líneas, pero
entonces es una A2 más lenta de recorrer.
