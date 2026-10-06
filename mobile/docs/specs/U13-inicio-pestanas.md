# Spec — Inicio por pestañas

> Tema: ui
> En corto: Una segunda forma de ver las sesiones en Inicio: una sola tarjeta con una pestaña por sesión (✓ B C D E), para quien recibe un programa o hace siempre el mismo orden. Se elige en Preferencias y la lista plegable sigue siendo la de por defecto.
> Inicio: 2026-10-06
> Fin: 2026-10-06
> Fase U13-01 · hecho · La tarjeta de pestañas y la preferencia · §3
> Fase U13-02 · hecho · El color se extiende desde la pestaña · §4
> Fase U13-03 · hecho · Mantener y deslizar por las pestañas · §5
> Fase U13-04 · aparcado · Ver lo que hiciste la última vez · §6
> Fase U13-05 · hecho · Ajustes de la primera prueba, «la semana empieza por la A» (del programa) y el mismo botón · §8
> Fase U13-06 · hecho · Programa libre: ninguna sesión toca · §9
> Fase U13-07 · hecho · Menos colores en las pestañas: probado y vuelto atrás; pestañas un poco más oscuras · §10
> Fase U13-08 · hecho · Radio más bajo en tarjetas de sesión y de programa, y menos aire en los botones del programa · §11
> Fase U13-09 · hecho · Progresión: radio más bajo y menos aire entre las tarjetas de información · §12
>
> Estado: **U13-01 a U13-03 hechas el 6-oct-2026**, por probar en el móvil. Es la
> variante **A · Tal cual** de la maqueta, elegida «para empezar y ajustar».
> Coste: un componente nuevo (`SessionTabsCard`), una rama en `HomeScreen` y una
> fila en Preferencias; ni datos ni lógica nuevos — lee el mismo `sessionPlan`
> que la lista. La pregunta del onboarding va a O03 (§7).
>
> **6-oct-2026, primera prueba (U13-05):** pestañas sin abrir más claras, letra
> de la abierta en lima, pestañas más anchas, deslizar sin mantener, relleno más
> lento, la tarjeta despliega los ejercicios (§3.6), el color también llena y
> vacía las pestañas y el nombre entra deslizando (§4), el botón es el de la
> lista, y una opción del programa para que la semana empiece por la A (§8).
> Segunda prueba: el relleno ya no se reinicia al ir y volver deprisa (§4) y
> se arregló que los nombres se acumularan al deslizar. **U13-06**: tercera opción
> del programa, libre, sin sesión que toque (§9).

## 1. Por qué

La lista plegable de [U04](U04-home-sesiones-plegables.md) enseña todas las
sesiones como tarjetas sueltas. A quien recibe un programa de su entrenador, o
hace siempre el mismo orden, le sobra: quiere ver la que toca y poco más. Las
pestañas dicen lo mismo —qué hay, qué está hecho, cuál toca— en una pieza.

**Las dos conviven.** La lista sigue siendo la de por defecto; las pestañas se
eligen en Preferencias (§3.5) y, cuando exista, en el onboarding (§7). Las dos
leen lo mismo (`plan.rows` de `sessionPlan`, `sessionStats`, `startCta`,
`requestStart`) y solo cambia cómo se pinta: lo que se toque en cómo se cuenta una
sesión vale para las dos, pero cada cambio visual hay que probarlo dos veces.

## 2. Decisiones (6-oct-2026)

Maqueta: <https://claude.ai/artifact/QgYheVaGwFwoiAznQGppfd> (cuatro variantes del
estado «abierta otra»). Referencia de forma: la captura del usuario a 3,2× (tarjeta
de 358 de ancho).

- **El lima es la que toca, y solo esa** (la regla de U04 §1.1). Abrir otra
  pestaña pasa la tarjeta a `surface`; la pestaña de la que toca se queda
  **rellena de lima** con su letra en negro, así que siempre se sabe cuál era.
- **Sin «HOY»** en la pestaña: miente en cuanto entrenas (la que toca pasa a ser
  la siguiente, que no harás hoy) y quita la letra, que es la que repite el
  Workout. Si hace falta la palabra, irá en una ceja de la tarjeta.
- **Variante A · Tal cual**, con las pestañas sin abrir en `border` (`#3a3a3a`)
  desde la primera prueba: en `surface2`, como la captura, se veían oscuras. Si
  aun así se pierden, quedan las otras salidas maquetadas: **C** (raya de 3 px
  del color del fondo bajo las no abiertas) y **D** (carpeta: las pestañas por
  encima de la tarjeta).
  Se descartó del todo pintarlas del negro del fondo: se confunden con él.
- **La elección no se recuerda**: al volver a Inicio, o al guardar la sesión que
  toca, la tarjeta vuelve a la que toca. Igual que el acordeón de U04.

## 3. U13-01 — La tarjeta y la preferencia

`src/components/SessionTabsCard.jsx`, montada en `HomeScreen` en lugar del
`plan.rows.map(...)` de la lista cuando `profile.homeView === 'tabs'`. El rótulo
TUS SESIONES, el banner de etapa y las sesiones libres no cambian.

### 3.1 Capas

De abajo arriba, dentro de la tarjeta (`radius.md`, `overflow: 'hidden'`):

1. El fondo de la tarjeta: lima si la abierta es la que toca, `surface` si no.
2. El círculo del relleno (§4).
3. La tira de pestañas: un `Svg` con un `Path` por pestaña **sin abrir**. La
   abierta no se dibuja: es la propia tarjeta asomando, y por eso se une a ella.
4. Las letras / ✓ y el chevron, encima del `Svg`.
5. El cuerpo: nombre, meta y botón.

### 3.2 Geometría (medida en la captura, no sale de tokens)

| Medida | Valor | Qué es |
|---|---|---|
| `TAB_H` | 43 | Alto de la tira |
| `PITCH` | 54 | De una pestaña a la siguiente (47 en la captura; se pidieron más anchas). Si no caben, se estrechan todas por igual hasta dejar libre el hueco del chevron |
| `SLANT` | 6 | Inclinación del canto, «/»: arriba 6 px más a la derecha que abajo |
| `GAP` | 1,5 | Entre dos pestañas se ve la tarjeta: es la línea de lima de la captura |
| `CORNER` | 6 | Las dos esquinas de **abajo** de cada pestaña, redondeadas (curva cuadrática). Las de arriba van rectas contra el borde |
| `LEFT` | −10 | La primera empieza fuera: el borde redondeado de la tarjeta la corta en recto |
| `CHEV_W` | 44 | Hueco del chevron a la derecha |

Cuerpo: 11 a los lados, `spacing.md` arriba y `spacing.lg` abajo; el botón a 12
de la meta.

### 3.3 Colores y texto

| Pieza | La que toca abierta (lima) | Otra abierta (`surface`) |
|---|---|---|
| Pestaña sin abrir | `surface3` (§10), letra en `text`, ✓ en `green` | igual |
| Pestaña de la que toca, sin abrir | — | lima, letra (o ✓) en `onAccent` |
| Pestaña abierta | la tarjeta, letra en `onAccent` | la tarjeta, letra en `accent`, ✓ en `green` |
| Nombre | `heroName`, `onAccent`, hasta 2 líneas | `heroName`, `text` |
| Meta | `caps`, `onAccent` al 55 % | `caps`, `mutedLight` |
| Botón | `StartButton` de la lista: negro, texto lima (§8.2) | `StartButton`: lima con texto negro; hecha, `surface2` |
| Chevron de la tira | `onAccent` | `mutedLight`; apunta abajo con los ejercicios abiertos (§3.6) |

- Letras en `heroName` (la Barlow de la tarjeta de hoy) en mayúsculas: la escala
  tipográfica de U06 no deja un cuerpo propio. El nombre de la captura parece una
  palo seco ancha en cursiva que la app no carga; se usa la Barlow, que es la voz
  de la tarjeta de hoy.
- Meta: «7 EJERCICIOS · ~55 MIN» (`home.sessionMeta`); la hecha añade cuándo fue.
  «Adaptada» va detrás en `tint.blue70`, como en la lista.
- Botón con la letra, como en la lista: EMPEZAR SESIÓN B, CONTINUAR…, REPETIR…

### 3.4 Accesibilidad

Cada pestaña es un nodo `tab` con `selected`, su etiqueta de la lista («Sesión C,
Día de tirón, pendiente», con «Mi entreno de hoy» delante en la que toca) y la
acción `activate`, que es la que lanza el doble toque del lector de pantalla. El
gesto de §5 no es accesible; no hace falta: el doble toque elige igual.

### 3.5 La preferencia

`profile.homeView: 'cards' | 'tabs'`, por defecto `'cards'`. Fila con
interruptor en **Preferencias** del menú (`AppHeader.jsx`), siguiendo las reglas
de [U11](U11-preferencias-ui.md) §1. Textos nuevos: `header.homeTabsLabel`
(«Sesiones en pestañas») y `header.homeTabsHint`.

### 3.6 Los ejercicios

Tocar la tarjeta en cualquier sitio que no sea el botón ni una pestaña (el
nombre, la meta, el hueco del chevron) despliega los ejercicios, como la cabecera
de una fila de la lista. Van en la caja negra de la tarjeta de hoy (U04 §5.3),
igual sobre lima y sobre gris, entre la meta y el botón; `ExerciseLines` tal cual.

- **Abierto o cerrado es de la tarjeta, no de la sesión**: cambiar de pestaña con
  los ejercicios a la vista enseña los de la otra. Al volver a Inicio se queda
  como estaba (solo vuelve la pestaña que toca).
- El chevron de la tira lo dice: `›` cerrado, apuntando abajo abierto.
- Mismas animaciones que la lista: `collapseOut` al cerrar y `layout` con
  `FOLD_MS` en la tarjeta y el botón.

**Probar U13-01**

- [ ] Menú › Preferencias › «Sesiones en pestañas»: Inicio cambia a una tarjeta con una pestaña por sesión; al apagarlo vuelve la lista.
- [ ] Las pestañas se ven como en la captura: inclinadas, separadas por una línea de lima, esquinas de abajo redondas, la primera cortada recta por el borde de la tarjeta.
- [ ] La sesión hecha esta semana lleva ✓ verde; las demás, su letra en blanco.
- [ ] Al entrar, está abierta la que toca: tarjeta lima, nombre y meta en negro, EMPEZAR negro.
- [ ] Tocar otra pestaña: la tarjeta pasa a gris, la pestaña de la que toca queda lima con su letra en negro, y el botón es lima (o REPETIR gris si está hecha).
- [ ] EMPEZAR / CONTINUAR / REPETIR arranca esa sesión (o vuelve a la que está a medias).
- [ ] Salir de Inicio y volver: está abierta otra vez la que toca.
- [ ] Guardar la sesión que toca: al volver, la tarjeta abre la siguiente y la hecha lleva ✓.
- [ ] Con 6 sesiones caben todas y el chevron; con 7 (o en un móvil estrecho), se estrechan sin pisarlo.
- [ ] La abierta que no es la que toca lleva la letra en lima.
- [ ] Tocar el nombre, la meta o el hueco del chevron despliega los ejercicios en la caja negra; otra vez, los recoge. El chevron apunta abajo mientras están abiertos.
- [ ] Con los ejercicios abiertos, cambiar de pestaña enseña los de la otra sesión, sin cerrarse.
- [ ] Con TalkBack / VoiceOver, cada pestaña se lee y se elige con doble toque.

## 4. U13-02 — El color se extiende desde la pestaña

Al elegir una pestaña, el color nuevo de la tarjeta **sale de la pestaña y se
extiende hasta cubrirla**. Un círculo del color nuevo, centrado en la pestaña a
media altura, crece de 0 a su radio (la distancia a la esquina más lejana) en
`FILL_MS` = 450 ms (320 en la primera prueba, rápido), `Easing.out(cubic)`. Debajo sigue el color de antes; al
acabar, pasa a ser el de debajo.

- Va con Reanimated (`useSharedValue` + `withTiming`), arrancado en el mismo
  toque y no en un efecto. Las escrituras con `.set()`: con `.value =` dentro de
  un `useCallback` el lint del React Compiler se queja.
- El círculo no se esconde al acabar: se queda encima, del mismo color que la
  tarjeta, y el siguiente relleno lo saca otra vez desde cero.
- **Nunca se reinicia** (segunda prueba: al ir y volver deprisa entre la que
  toca y otra, el círculo a medias saltaba a tarjeta llena y salía otro desde
  cero). Como solo hay dos colores, un relleno a medias siempre se sigue o se
  deshace: si se vuelve al color de debajo, el círculo **se recoge** hacia su
  pestaña desde donde iba; si se va al que se estaba extendiendo, **sigue** desde
  donde iba. Cada tramo dura lo que le queda (mínimo 120 ms).
- La pestaña abierta se llena con **su** color (lima la que toca, gris las
  demás), no con el del círculo: con el círculo recogiéndose, ese era el de la
  otra, y la que toca acababa gris o una cualquiera en lima (tercera prueba).
- Lo que deciden las animaciones (qué pestaña está abierta, qué color hay debajo
  y cuál se extiende) vive en una ref al día en cada toque, no en el estado de
  React: deslizando rápido llegan varios toques antes de repintar.
- **Las pestañas también se llenan y se vacían** (`TAB_MS` = 260 ms): en la que
  se abre, el color de la tarjeta sube desde abajo hasta llenarla y fundirla con
  la tarjeta; en la que se cierra, baja hasta vaciarse. Un `Rect` animado
  (`useAnimatedProps`) recortado a la forma de cada pestaña con un `ClipPath`.
  Es lo único que se mueve entre dos sesiones grises, donde la tarjeta no cambia
  de color.
- **El nombre entra deslizando** desde el lado de la pestaña elegida (24 px y
  fundido, 220 ms), para que el cambio no sea un salto. Con él entran la meta y
  los ejercicios; el botón se queda. Es **una sola vista** movida con
  `translateX`/`opacity`: la primera versión montaba una por sesión con
  `entering`/`exiting`, y deslizando rápido las que salían se quedaban encima,
  sumándose.

**Probar U13-02**

- [ ] De la que toca a otra: el gris sale de la pestaña tocada y cubre la tarjeta, sin parpadeo al acabar.
- [ ] De otra a la que toca: el lima sale de su pestaña.
- [ ] Tocar pestañas muy seguido no deja la tarjeta de un color que no toca.
- [ ] El texto no se queda ilegible mientras el color avanza (negro sobre gris o blanco sobre lima un instante es aceptable; más, no).
- [ ] Entre dos sesiones grises: la pestaña nueva se llena de gris desde abajo y la anterior se vacía.
- [ ] El nombre entra desde la derecha al ir a una pestaña de la derecha, y desde la izquierda al revés; no da saltos.
- [ ] Deslizando rápido por las pestañas no quedan pestañas a medio llenar ni nombres superpuestos.
- [ ] Ir y volver deprisa entre la que toca y otra: el color se recoge o sigue desde donde iba, sin saltar a la tarjeta llena.
- [ ] Ir y volver deprisa (tocando o deslizando) entre la que toca y otras: la pestaña de la que toca acaba siempre lima, y la abierta siempre del color de la tarjeta.

## 5. U13-03 — Deslizar por las pestañas

Arrastrar el dedo en horizontal sobre la tira va abriendo la pestaña que queda
debajo, como quien hace scroll, con un toque háptico (`selectionAsync`) en cada
cambio. Un toque corto elige como siempre. Primero había que mantener pulsado
220 ms; se quitó en la primera prueba.

- `react-native-gesture-handler`: `Gesture.Race(Pan, Tap)`; el `Pan` se activa
  con 8 px en horizontal y se retira con 12 px en vertical,
  los dos con `runOnJS(true)` (solo eligen pestaña; la animación es la de §4).
  Es el primer uso de la API `Gesture` en la app; `GestureHandlerRootView` ya
  estaba en `App.js`.
- La pestaña se calcula por la `x` del dedo; fuera de la tira por los lados se
  queda en la primera o la última. Un toque en el hueco del chevron no hace nada.
- Esa asimetría es lo que deja hacer scroll vertical de Inicio empezando sobre
  la tira.

**Probar U13-03**

- [ ] Deslizar el dedo a lo largo de las pestañas, sin mantener: se van abriendo una a una, con un toque háptico en cada una.
- [ ] Al soltar se queda abierta la última.
- [ ] Empezar a hacer scroll de Inicio con el dedo sobre las pestañas sigue haciendo scroll, sin abrir ninguna.
- [ ] Mientras se desliza, Inicio no se mueve en vertical.

## 6. U13-04 — Lo abierto (aparcado)

- **Ver lo que hiciste la última vez** (petición de usuarios, no prioritaria): un
  botón en la tarjeta que cambia la lista de ejercicios (§3.6) por lo hecho en
  cada uno la última vez que se entrenó esa sesión (`getLastSession` ya lo tiene).

## 7. Onboarding

En el onboarding por caminos ([O03](O03-onboarding-caminos.md)) se preguntará cómo
quiere ver el usuario su programa —lista o pestañas—, enseñando las dos y
explicando cómo funcionan. Escribe la misma `profile.homeView`. Queda anotado en
las decisiones abiertas de O03 §14; no es tarea de esta spec.

## 8. U13-05 — Primera prueba y «la semana empieza por la A»

Lo pedido tras la primera prueba en el móvil (6-oct-2026) ya está repartido en
§2, §3, §4 y §5. Lo que no es de esta tarjeta:

### 8.1 Qué sesión toca: opción del programa

Con seis sesiones, A y C hechas esta semana y B sin hacer, Inicio decía que
tocaba la D. No era el orden de creación: la regla de P08 §3.5 es «la que más
tiempo llevas sin hacer, **las nunca hechas primero**», y la B se había hecho
alguna semana anterior mientras que la D nunca. Se probó a cambiar la regla para
todos y se volvió atrás el mismo día: **la de siempre se queda por defecto** y la
otra es una opción.

- **Es del programa, no del usuario**: `program.sessionOrder`, al final del
  editor del programa (QUÉ SESIÓN TOCA: Rotación · Desde la A · Libre). Empezó
  siendo un interruptor (`weeklyOrder`) y pasó a tres valores con U13-06; como
  era del mismo día, no hubo nada que migrar. Primero fue una preferencia del menú; se movió al
  programa porque la preferencia se quedaba en el móvil del cliente y su
  entrenador podía ver otra sesión como «la que toca».
- Encendida: toca **la primera, en el orden del programa, que no has hecho esta
  semana**; con todas hechas, la de siempre. Cada lunes vuelve a la A, aunque la
  semana anterior quedara a medias.
- `sessionPlan({ …, order })`, con `order: program.sessionOrder` en los cinco
  sitios que dicen «la que toca»: Inicio (lista y pestañas), la ficha del cliente
  (`ClientSessions`), la tarjeta y el menú de Clientes, «Preparar sesión» y pegar
  un entreno.
- Viaja con el programa: el cliente la recibe en la actualización, que lo dice
  en su resumen de cambios (`programUpdate.diff.order_<valor>`).
- Texto de ayuda «Semana»: la regla de siempre y la del programa que empieza por
  la A.

### 8.2 El mismo botón

El botón de la tarjeta es el de la lista: `StartButton` sale de `SessionList` y
lo usan `TodayCard`, `SessionRow` y las pestañas. Negro con texto lima en la que
toca, lima en las demás, `surface2` al repetir; y el texto con la letra
(EMPEZAR SESIÓN B), como en la lista. La captura no lo replicaba y no hay motivo
para tener dos.

**Probar U13-05**

- [ ] Sin tocar nada: con A y C hechas esta semana, B hecha otra semana y D nunca, toca la D (como siempre).
- [ ] Editor del programa › «La semana empieza por la A»: en el mismo caso toca la B, en lista y en pestañas.
- [ ] Con la opción y todas hechas esta semana, toca la que hace más tiempo que hiciste.
- [ ] Con la opción, el lunes siguiente vuelve a tocar la A.
- [ ] El entrenador la activa en el programa de un cliente y lo sube: al cliente le sale en el aviso de cambios, y su Inicio y la ficha del entrenador dicen la misma sesión.
- [ ] El botón de las pestañas es igual que el de la lista: EMPEZAR SESIÓN B negro sobre lima en la que toca, lima en otra pendiente, gris al REPETIR.

## 9. U13-06 — Programa libre: ninguna sesión toca

Tercer valor de la opción del programa (§8.1): **`sessionOrder: 'free'`**, «Libre».
Para programas sin orden, donde se hace la sesión que se quiere el día que se
quiere.

- `sessionPlan({ order: 'free' })` devuelve `heroTemplateId: null`: ninguna
  toca. Los ✓ de hechas esta semana y el contador «2 de 4» siguen igual.
- **Lista (U04)**: ya sabía pintarlo (U04 §4.4): todas las filas en gris, sin
  tarjeta lima.
- **Pestañas: nunca hay lima** (decisión del 6-oct-2026). Ni la tarjeta ni
  ninguna pestaña: el lima es «la que toca» y aquí no toca ninguna; pintar la
  abierta de lima le daría otro sentido según el programa. La tarjeta va en gris
  con el botón lima, la abierta lleva la letra en lima y se llena y vacía como
  siempre; no hay círculo, porque el color no cambia.
- Al entrar se abre la **primera sin hacer esta semana**, sin destacarla; con
  todas hechas, la primera.
- Lo del entrenador ya aceptaba que no hubiera ninguna: la tarjeta de Clientes y
  «Preparar sesión» caen a la primera de la etapa, el atajo «Empezar sesión B»
  del menú de Clientes no sale, y pegar un entreno elige por los ejercicios.
- Textos: `editor.sessionOrder*`, `programUpdate.diff.order_free` y la ayuda
  «Semana».

**Probar U13-06**

- [ ] Editor del programa › QUÉ SESIÓN TOCA › Libre: en Inicio (lista) ninguna sesión sale en lima.
- [ ] En pestañas, ni la tarjeta ni ninguna pestaña en lima; se abre la primera sin hacer esta semana, y la abierta lleva la letra en lima.
- [ ] Cambiar de pestaña llena y vacía las pestañas, sin círculo de color.
- [ ] El botón de cualquier sesión es lima (o gris al REPETIR) y arranca esa sesión.
- [ ] El entrenador pone Libre en el programa de un cliente y lo sube: el aviso dice que ya no hay sesión que toque; su ficha y «Preparar sesión» abren la primera de la etapa.

## 10. U13-07 — Menos colores en las pestañas: probado y vuelto atrás

Con una sesión no hero abierta había demasiados colores: tres fondos de pestaña
(lima, la tarjeta, `border`) y cuatro de letra (negro, lima, blanco, verde).
Se probó la variante **E · Simplificada** de la maqueta
(<https://claude.ai/artifact/QgYheVaGwFwoiAznQGppfd>): pestañas en `surface2` y
un solo color de letra, lima entero en la abierta y al 50 % en las demás. Se
leía bien pero no convenció, y el mismo día se volvió a la de antes (letras en
`text`, la abierta en lima, ✓ verde) con un solo cambio:

- **Pestañas sin abrir un poco más oscuras**: token nuevo `surface3` `#333333`
  en el tema FormaFit (`themes.js`), medio paso entre `surface2` (`#272727`, se
  perdía en la tarjeta gris) y `border` (`#3a3a3a`). Los otros temas no lo
  tienen y caen a `border`.
- Se volvió a probar el lima al 50 % en las letras sin abrir, ya sobre
  `surface3`: se prefirió el blanco.
- **Los botones secundarios de una sesión** (REPETIR, EDITAR, compartir), que en
  `surface2` casi no se veían sobre la tarjeta, pasan también a `surface3`, en la
  lista y en las pestañas (`sesBtnSecondary` de `SessionList`; los otros temas
  caen a `surface2`).

**Probar U13-07**

- [ ] Las pestañas sin abrir se ven algo más oscuras que antes y se siguen distinguiendo de la tarjeta gris.
- [ ] REPETIR SESIÓN (y EDITAR / compartir) se distingue bien sobre la tarjeta, en la lista y en las pestañas.

## 11. U13-08 — Radio más bajo y menos aire

Pedido el 6-oct-2026, tras ver las pestañas en el móvil:

- **Radio `md` (10) → `sm` (6)** en las tarjetas de sesión (fila, tarjeta de
  hoy, tarjeta de pestañas), en sus botones (EMPEZAR / REPETIR / EDITAR, para no
  quedar más redondos que la tarjeta que los contiene), en la tarjeta de programa
  de Inicio (U12) y en la del tab Programa y la ficha de cliente (`ProgramCard`)
  con sus botones Editar · Ver · ⋯ (`ProgramActions`).
- **Aire de los botones del programa: 8 → 4** (`spacing.xs2`), entre la tarjeta y
  los botones y entre botones: el mismo que separa las tarjetas de sesión.
- Fuera de esto se quedan en `md`: el botón «+ Sesión libre», el banner de etapa
  y el resto de tarjetas de la app.

**Probar U13-08**

- [ ] Las tarjetas de sesión (lista y pestañas) y sus botones tienen las esquinas menos redondas.
- [ ] En el tab Programa, la tarjeta y Editar · Ver · ⋯ van con el radio nuevo y más juntos (4 entre tarjeta y botones y entre botones).

## 12. U13-09 — Progresión: radio más bajo y menos aire

Lo mismo que §11, en el tab Progresión (6-oct-2026):

- **Radio `lg` (16) → `md` (10)** en las tarjetas de información SESIONES ·
  CARGA · VOLUMEN (Ejercicios y Carga) y, en Carga, en la tarjeta de la gráfica
  y la del calendario, para no mezclar dos radios en la misma pestaña.
- **Separación entre las tres tarjetas: 10 → 8** (`spacing.sm2`). Se probaron 4
  (la de las tarjetas de sesión) y 6, y se dejó en 8. El aire vertical
  entre bloques de la pestaña no cambia.

**Probar U13-09**

- [ ] En Progresión › Ejercicios y › Carga, las tres tarjetas de arriba tienen las esquinas menos redondas y van más juntas.
- [ ] En Carga, la gráfica y el calendario llevan el mismo radio que esas tarjetas.
