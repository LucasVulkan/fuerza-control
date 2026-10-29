# Spec — Hoja de Progresión v2: qué va a pasar y cómo se ajusta

> Tema: programas
> En corto: La hoja de Progresión deja de parecer un esqueleto: arriba, el ejercicio en su ficha; en el centro, una tarjeta que dice cuánto se recomendará subir y qué hay que hacer para conseguirlo; abajo, los ajustes en una lista plegada con su valor a la vista.
> Fase P19-01 · hecho · Cabecera y ficha del ejercicio · §3
> Fase P19-02 · hecho · Tarjeta «En la próxima sesión» · §4
> Fase P19-03 · hecho · «Cómo progresa»: los ajustes en lista plegada · §5
> Fase P19-04 · hecho · Iconos nuevos de Peso y Esfuerzo · §6
> Inicio: 2026-10-29
> Fin: 2026-10-29
>
> Estado: **implementada el 29-oct-2026, por probar en el móvil** (rama `feat/p19-hoja-progresion`, sin subir). Sale de rediseñar la hoja de
> [P18-05](P18-motor-progresion.md) («§7. P18-05 — Hoja de Progresión por niveles»),
> que el usuario veía floja: títulos en mayúsculas que no decían nada, bloques
> flotando sobre el fondo, un párrafo al pie que había que leer dos veces y poco
> margen para elegir el salto de peso. Se probaron tres caminos en
> [`progresion-hoja-2.html`](../mockups/progresion-hoja-2.html) y se eligió el C,
> afinado con los tokens de la app en
> [`progresion-hoja-3.html`](../mockups/progresion-hoja-3.html)
> (https://claude.ai/artifact/Ga9wijoCj2SAq8DF7vB6Fi), que es **la referencia
> visual de esta spec**. El motor (P18-01…04) no cambia. La hoja **no lee el
> historial** (decisión del usuario, 29-oct): la tarjeta dice el salto, no el peso
> de llegada. Los SVG de los iconos de P19-04 están en `mockups/iconos/`. Ideas que
> salieron y quedan fuera: plantillas de progresión (P20) y peso objetivo (P21), en
> `docs/ideas.md`.

---

## 1. Por qué

La hoja de P18-05 tenía todas las piezas, pero sin una idea que las uniera:

- «QUÉ SUBE», «CUÁNDO SUBE», «CUÁNTO SUBE CADA VEZ» eran rótulos, no información.
  Lo que importa (qué has elegido) había que deducirlo de qué botón estaba en lima.
- Las opciones sin elegir no tenían fondo: solo se veía la elegida.
- La regla al pie era un párrafo («Sube 2.5 kg cuando… si alguna serie no llega…
  baja un 10 % si faltan más del 15 %…»). Era correcta, pero no se leía de un vistazo.
- El salto de peso eran cuatro chips fijos (1.25 · 2.5 · 5 kg · 5 %).

La v2 responde a una sola pregunta, de arriba abajo: **¿qué me va a recomendar la
app la próxima vez, y qué tengo que hacer para conseguirlo?** Lo demás son ajustes,
y van plegados.

## 2. Principios y piezas

- **Solo piezas que ya existen.** La hoja es la `DragSheet` (fondo `bg`). Encima, las
  tarjetas y filas van en `surface` y lo que va dentro de una fila en `surface2`.
  Nada dentro de la hoja va en `bg`, como ya decía P18-05.
- **Textos con los roles de `textStyles`** (heading, itemTitle, bodyStrong, body,
  labelStrong, label, caps). Ningún `fontSize` propio (AGENTS.md).
- **Toda opción tiene fondo**, elegida o no. Lo elegido se rellena de lima (o se le
  enciende el borde en las tarjetas de «Cuándo sube»), como hoy.
- **Sin historial.** La hoja no sabe cuánto levantaste la última vez y no lo
  busca: dice el salto («+2.5 kg») y la condición, que solo dependen de lo que se
  elige en la hoja. Así es igual en el editor y en el alta de ejercicio propio.
- **Los decimales se escriben como en el resto de la app.** La coma de la maqueta
  («2,5») no es un cambio de esta spec.
- La hoja la comparten el editor de ejercicio y el alta de ejercicio propio
  (`ProgressionSheet`), igual que ahora.

Orden de la hoja, de arriba abajo:

1. Cabecera «Progresión» + Aceptar (§3).
2. Ficha del ejercicio (§3).
3. «Qué sube»: las tarjetas con icono y su frase, como en P18-05, sin el rótulo en
   mayúsculas encima.
4. Tarjeta «En la próxima sesión» (§4).
5. «Cómo progresa»: la lista plegada (§5).

Desaparecen el rótulo «QUÉ SUBE», los chips de «Cuánto sube», el bloque
«Avanzado» y la regla al pie con la raya lima. `progressionRule` se queda en el
código para quien la use fuera de la hoja.

La fila «Plantilla» que sale en la maqueta es la idea P20, no entra aquí.

## 3. P19-01 — Cabecera y ficha del ejercicio

- **Cabecera**: la de siempre de `DragSheet` («Progresión» en `heading` y «Aceptar»).
  El icono de tendencia **no va en el título** (cambio del usuario, 29-oct): va en la
  ficha del ejercicio.
- **Ficha del ejercicio**: una tarjeta `surface`, radio `md`, padding `md`/`lg`, en fila
  con hueco `md`:
  - A la izquierda, un cuadro de 28 × 28, radio `sm`, fondo `tint.accent10`, con un
    icono de tendencia (línea que sube y flecha) en `accent`, de 16.
  - Al lado, el nombre en `bodyStrong` y debajo, en `label` `mutedLight` y con cifras
    tabulares, el volumen (las claves `metaRange`/`metaFixed`/… de hoy).
- Entre los bloques de la hoja, `xl`, como hoy.

**Probar P19-01**

- [ ] Editor de un press militar 6×10-12 → Progresión: la cabecera es la de siempre.
  Debajo, el ejercicio en una tarjeta con el icono de tendencia en su cuadro lima suave
  a la izquierda y, a su lado, «Press militar con barra» y «6 × 10–12 reps».

## 4. P19-02 — Tarjeta «En la próxima sesión»

Explica la progresión automática con lo elegido en la hoja. Es una tarjeta
`surface`, radio `md`, padding `lg`, con hueco `sm2` entre líneas:

```
EN LA PRÓXIMA SESIÓN                         ← caps, mutedLight
Se recomendará subir                         ← body, mutedLight
+2.5 kg                                      ← itemTitle, accent, cifras tabulares
al completar 12 reps en todas las series.    ← body, mutedLight; lo que hay que hacer
                                                en bodyStrong text
─────────────────────────────────────────    ← raya `border`, padding-top sm2
Si no llegas, se recomendará mantener el     ← label, mutedLight
mismo peso. Si fallas por mucho o varias
veces seguidas, se recomendará bajar un 10 %.
```

- **Sin historial y sin «de → a»** (decisión del usuario, 29-oct): solo el salto.
  Tampoco lleva la píldora del delta ni cuadraditos de series.
- El salto se escribe como en el resto de la app (la unidad de `useWeightUnit`).
  Con % es «+5 %».

Textos según el tipo (en es y en, nuevas claves bajo `exerciseEditor.sheet.next`):

| Qué sube | Línea grande | «al completar…» | Pie |
|---|---|---|---|
| Peso, Todas | «Se recomendará subir» · **+2.5 kg** | «**12 reps en todas las series**» (reps fijas: las suyas; medida Tiempo: «**45 s en todas las series**») | «Si no llegas, se recomendará mantener el mismo peso.» + con Si fallas: «Si fallas por mucho o varias veces seguidas, se recomendará bajar un 10 %.» |
| Peso, La mayoría | igual | «**12 reps en 4 de 6 series** sin bajar de 10» | igual |
| Con freno de RPE | igual | + « y sin pasar de **RPE 8**» | igual |
| Ayuda | «Se recomendará quitar» · **2.5 kg** de ayuda | igual que Peso | «Si no llegas, se recomendará mantener la misma ayuda.» + «Si fallas por mucho o varias veces seguidas, se recomendará subirla un 10 %.» |
| Reps | «Se recomendará subir» · **+1 rep por serie** | «**el total de reps de la última vez**» | «Si no llegas, se recomendará mantener las mismas reps.» |
| Tiempo | «Se recomendará subir» · **+10 s por serie** | «**el total de segundos de la última vez**» | «Si no llegas, se recomendará mantener el mismo tiempo.» |
| Esfuerzo | (sin línea grande) «Se recomendará el peso con el que **tus reps cuesten RPE 8**.» | — | «Se calcula con la media de tus tres últimas sesiones.» |
| Nada | (sin línea grande) «No se recomendará ningún cambio: verás lo que hiciste la última vez y tú decides.» | — | — |

Reps y Tiempo siguen la regla de P18-02: la meta es el total de la última sesión
más el salto por serie.

**Probar P19-02**

- [ ] Press 6×10-12, +2.5 kg, Todas: la tarjeta dice «Se recomendará subir · +2.5 kg
  · al completar 12 reps en todas las series.», y bajo la raya «Si no llegas, se
  recomendará mantener el mismo peso. Si fallas por mucho o varias veces seguidas,
  se recomendará bajar un 10 %.».
- [ ] Cambia a La mayoría: «al completar 12 reps en 4 de 6 series sin bajar de 10».
- [ ] Enciende el freno de RPE 8: se añade «y sin pasar de RPE 8».
- [ ] Pon Nunca baja: el pie solo dice «Si no llegas, se recomendará mantener el
  mismo peso.».
- [ ] Cambia a +5 %: la línea grande dice «+5 %». Cambia el salto en «Cómo
  progresa»: la tarjeta cambia al momento.
- [ ] Dominada asistida: «Se recomendará quitar · 2.5 kg de ayuda».
- [ ] Reps, Tiempo, Esfuerzo y Nada: cada uno con su frase de la tabla.

## 5. P19-03 — «Cómo progresa»: los ajustes en lista plegada

Debajo de la tarjeta va el rótulo «Cómo progresa» (`caps`, `mutedLight`) y una
lista plegada. Es la de `optGroup` de `ExerciseEditorInline` (radio `md` fuera y
`xs` entre filas, que recorta), con filas del alto de `navRowGrouped` (58,
padding `sm`/`lg`, radio `xxs`):

- A la izquierda, un **icono** en un cuadro de 30 (`surface2`, radio `md`), trazo
  en `accent` de 18.
- **Título** en `bodyStrong` y **subtítulo de una línea** en `label` `mutedLight`.
- A la derecha, **el valor elegido en `accent`** (`labelStrong`).
- Un **chevron fino** en `muted`, hacia la derecha, que gira 90° hacia abajo al
  abrir la fila.
- Al tocar una fila se abre su cuerpo debajo, en `surface` (radio `xxs`, padding
  `xs2`/`lg`/`lg`, hueco `md`). **Solo una abierta a la vez**, y todas cerradas al
  abrir la hoja. El alto se anima con `AnimatedHeight`, como ahora.

Filas según lo que sube (los cuerpos reutilizan lo que hay hoy):

| Fila · icono | Subtítulo | Valor | Cuerpo |
|---|---|---|---|
| **Cuánto sube** · + | «Kilos fijos cada vez» / «Porcentaje del peso» | «+2.5 kg» / «+5 %» | `SegmentedControl` Kilos · Porcentaje, y debajo el `StepField` horizontal «Cada subida». En kilos va de escalón en escalón (mínimo un escalón, máximo 20 kg); en %, del 1 al 50. Pie en `label`: con %, «Se redondea al escalón (1.25 kg)». **Sustituye a los chips**: cualquier salto, no solo cuatro |
| **Cuándo sube** · tres rayas | «Series que llegan arriba» | «Todas» / «La mayoría» | Las dos tarjetas con cuadraditos de hoy (`WhenCard`), en `surface2` |
| **Si fallas** · flecha abajo | «Fallo grande o dos seguidos» | «−10 %» / «No baja» | `SegmentedControl` «Baja un 10 %» · «Nunca baja», con el `downFailHint` / `downNeverHint` de hoy |
| **Freno por esfuerzo** · medidor | «No sube si cuesta demasiado» | «No» / «RPE 8» | `SegmentedControl` No · RPE; con RPE, el `StepField` «RPE máximo» y `brakeOnHint`; si no, `brakeOffHint` |
| **Escalón** · barras | «Redondeo del peso» | «1.25 kg» | `StepField` del escalón y `stepHint` |

- **Ayuda**: «Cuánta ayuda quita», y en Si fallas «Sube un 10 %» (`downFailHintAssist`).
- **Reps / Tiempo**: una sola fila, «Cuánto sube» · «Reps de más en cada serie» /
  «Segundos de más en cada serie» · «+1 rep» / «+10 s», con un `StepField` (reps de 1
  a 5; segundos de 5 a 30, de 5 en 5). Sustituye a los chips +1/+2/+3 y +5/+10/+15.
- **Esfuerzo**: «Esfuerzo objetivo» · «RPE 8» (el `StepField` del RPE y la frase de
  las reps en recámara), «Escalón» (`SegmentedControl` Escalón · Exacto y su
  `StepField`) y, sin Exacto, «Cuándo sube» («Al superarlo» · «Al llegar»). Los
  textos son los de hoy, que pasan de Avanzado a filas.
- **Nada**: no hay lista.
- Las reglas de coherencia de hoy no cambian: el freno de RPE fuerza «Todas», el
  Esfuerzo con Rango sale apagado y explica que necesita reps fijas, etc.
- Los iconos de las filas se dibujan como los de las tarjetas de trazo
  (`TILE_ICON`): un trazo de 2, sin relleno, centrados en 24. Están en la maqueta.

**Probar P19-03**

- [ ] Al abrir la hoja, «Cómo progresa» sale con todas las filas cerradas. Cada fila
  tiene su icono en lima, su subtítulo en una línea, el valor en lima a la derecha
  y un chevron gris fino.
- [ ] Tocar una fila la abre y cierra la que estuviera abierta; el chevron gira
  hacia abajo y la hoja crece sin saltos.
- [ ] Cuánto sube: con Kilos, el − / + va de 1.25 en 1.25 (el escalón) y deja poner
  10 o 7.5 kg. Con Porcentaje, del 1 al 50. El valor de la fila y la tarjeta de
  arriba cambian al momento.
- [ ] Ninguna opción queda sin fondo: Kilos/Porcentaje, Todas/La mayoría, Baja un
  10 %/Nunca baja…
- [ ] Ya no están «Avanzado», los chips 1.25 · 2.5 · 5 · 5 % ni la regla con raya
  lima del pie.
- [ ] Reps: una sola fila «Cuánto sube» con +1 a +5 reps. Tiempo: +5 a +30 s.
- [ ] Esfuerzo (con reps fijas): filas Esfuerzo objetivo, Escalón y Cuándo sube;
  con Exacto desaparece Cuándo sube.
- [ ] Nada: no sale la lista.
- [ ] Lo elegido se guarda y vuelve igual al reabrir. El alta de un ejercicio propio
  usa la misma hoja.

## 6. P19-04 — Iconos nuevos de Peso y Esfuerzo

Los iconos de Peso (mancuerna) y Esfuerzo (cuentarrevoluciones) los ha dibujado el
usuario: [`mockups/iconos/peso.svg`](../mockups/iconos/peso.svg) y
[`mockups/iconos/esfuerzo.svg`](../mockups/iconos/esfuerzo.svg). Se ven en la
maqueta v3.

- Son de **relleno** (no de trazo como los demás) y vienen en una caja de 54 × 54
  con aire. En la tarjeta se recorta la caja para que pesen como los demás (a
  24 × 24 con la caja entera se quedaban pequeños), con el mismo alto de 24:
  - Peso: **32 × 24**, `viewBox="0 7 54 40"`.
  - Esfuerzo: **43 × 24**, `viewBox="1 11.5 52 29"`. Es ancho y bajo, y con el
    recorte de Peso pesaba menos que el resto (29-oct).
- **Peso**: una sola tinta. El negro del SVG pasa a ser el color del icono
  (`accent`, y `onAccent` en la tarjeta elegida).
- **Esfuerzo**: dos tonos. El arco va con el degradado del SVG (color lleno → mismo
  color al 50 %), el «1» al 50 % y las letras llenas. Los colores del SVG
  (`#AAE216`, `#B8FF00` al 50 %) se cambian por el color del icono, para que al
  elegir la tarjeta todo pase a `onAccent`. Con `react-native-svg`:
  `LinearGradient` con `stopColor` = el color del icono.
- **Ayuda** (dominadas asistidas) usa hoy otro icono. No cambia.
- Las letras del icono de Esfuerzo dicen «1RM», y la tarjeta habla de RPE. Se
  deja como lo dibujó el usuario; si cambia el SVG, solo se sustituye el path.

**Probar P19-04**

- [ ] Las tarjetas de Peso y Esfuerzo llevan los iconos nuevos, del mismo alto que
  Reps y Nada: en lima sin elegir y en negro al elegir.
- [ ] El arco de Esfuerzo hace el degradado de lleno a medio tono, también en
  negro al elegirlo.

## 7. Fuera de esta spec

- **El peso de la última vez** en la hoja («40 kg → 42.5 kg»): se probó en la
  maqueta y se quitó por simplificar (29-oct). La hoja no lee el historial.
- **Plantillas de progresión** (P20 en `ideas.md`): elegir una arriba de la hoja,
  que incluye qué sube, y guardar la propia. Está en la maqueta v3 como idea.
- **Peso objetivo** (P21 en `ideas.md`): «¿cuánto tardaría en llegar a 60 kg?»,
  con una gráfica en escalones y un rango, y guardarlo como objetivo. Está en la
  maqueta v2 (versión 2 de la artifact) como idea.

## 8. Fases

| Fase | Qué | Toca | Coste |
|---|---|---|---|
| P19-01 | Ficha del ejercicio con el icono de tendencia | `ProgressionSheet` | 🟢 ✅ 1d49dda |
| P19-02 | Tarjeta «En la próxima sesión» | `ProgressionSheet`, locales | 🟢 ✅ 8003730 |
| P19-03 | Lista plegada «Cómo progresa» | `ProgressionSheet`, locales, `StepField` (prop `decimal`) | 🟡 ✅ f0d9041 |
| P19-04 | Iconos de Peso y Esfuerzo | `ProgressionSheet` (`TILE_ICON`), SVG en `mockups/iconos/` | 🟢 ✅ d19bc3e |

Las cuatro fases son independientes, pero todas tocan `ProgressionSheet`: van una
detrás de otra, no en paralelo.
