# Spec — La tarjeta de programa pierde el pie

> Tema: ui
> En corto: La tarjeta «Tu programa» de la Home deja de llevar botones: se pulsa el nombre para ver el programa y la etapa para elegirla, y todas las acciones (editar, archivar) se mudan al visualizador, que pasa a ser la pantalla del programa.
> Fase U14 · hecho · La tarjeta: una superficie, dos zonas pulsables, progreso en dos niveles · §3
> Fase U15 · hecho · El visualizador hereda las acciones y el selector compartido · §4
>
> **Probar en dispositivo.** Las dos zonas pulsables de la tarjeta. Lo que hay
> que mirar es si se **aprende** que son dos sitios distintos: cada una se tiñe
> de `surface2` por su cuenta al pulsarla, y esa es toda la pista. Si al pulsar
> la etapa la gente espera abrir el programa, la separación no se lee y hay que
> darle otra señal.
>
> **Probar en dispositivo.** La barra de etapas con un programa real de 5-6
> etapas de duración desigual. Sobre la maqueta los tramos se distinguen; con
> una etapa de 2 ciclos junto a una de 6, el tramo corto puede quedarse en nada.
>
> Estado: **las dos fases implementadas** (8-sep-2026). Sale de una sesión de
> diseño Opus + usuario sobre maquetas HTML a 375pt con los tokens reales de
> `formaFit` (`docs/mockups/`), en cuatro rondas: aligerar la tarjeta → mejorar
> la lectura del progreso → refinar la barra → jerarquía sin segundo color.
>
> **Reemplaza las §4.2, §4.3 y §4.7 de [home-sessions.md](home-sessions.md)**
> (la anatomía de la tarjeta y su pie de acciones) y la §3.2 de
> [program-view.md](program-view.md) (los chips de etapa). El resto de las dos
> specs sigue vigente: la convergencia con `ClientsScreen` que cuenta la §4.1 de
> home-sessions es justo lo que hace que esto valga para las dos pantallas.

---

## 1. Problema

La tarjeta pesaba más que lo que dice. En una tarjeta de ~330 px de alto había
**dos superficies** (cabecera `surface2` sobre cuerpo `surface`), **tres cajas
rellenas** para tres cifras, **un pie de tres celdas** con dos filetes, y una
barra de progreso que decía una sola cosa. Cuatro elementos gráficos compitiendo
por un contenido que cabe en tres líneas.

Y decía mal lo que decía. El progreso tenía **un solo nivel**: la barra pintaba
los ciclos de la etapa en curso, así que respondía a «cuánto le queda a esta
etapa» y **no a «por dónde voy del programa»** — que es la pregunta que la gente
se hace mirando una tarjeta que se llama «Tu programa». El número de la esquina
(`CICLO 07`) cuenta los ciclos totales del programa: es el cuentakilómetros, no
la posición.

El pie, además, prometía cosas raras. `EDITAR` desaparecía para los programas de
entrenador (la edición no sube por el canal, así que el botón mentía) y `VER`
llevaba al visualizador, que era la pantalla que más gente necesitaba y a la que
solo se llegaba por un botón de 46 px compartido con otros dos.

---

## 2. Decisiones cerradas con el usuario (no re-litigar)

1. **Una sola superficie.** La banda `surface2` de la cabecera se cae. La
   tarjeta ya lleva lima, azul y tres grises de texto; un segundo fondo era un
   color más para decir «aquí empieza otra cosa». Lo dice un filete de 1 px a
   sangre.
2. **La tarjeta no lleva botones.** Pulsar el nombre lleva al programa; pulsar
   la etapa abre el selector. Nada de pie.
3. **El toque va al visualizador, no al editor.** Un programa se edita una vez y
   se consulta muchas, y el programa de entrenador **no se edita**: con el toque
   llevando al editor, el mismo gesto tendría que hacer dos cosas distintas
   según de quién sea el programa. Llevando al visualizador el gesto es idéntico
   para todos y lo único que cambia es si dentro aparece «Editar».
4. **El número de ciclo de la esquina se queda.** Es el ancla de «cuánto llevas
   haciendo este programa», y ninguna otra pieza de la tarjeta lo dice.
5. **Dos preguntas, dos objetos.** La barra es el programa entero (etapas); los
   puntos son los ciclos de la etapa en curso. Se probó al revés —puntos para
   las etapas, barra para los ciclos— y pierde: los ciclos de una etapa son tres
   o cuatro y se cuentan de un vistazo, mientras que las etapas pueden ser seis
   y **duran distinto**, que es justo lo que una barra proporcional sabe decir y
   unos puntos no.
6. **Las cifras se quedan las tres** (adherencia, ritmo, carga) y con sus
   nombres. Lo que se va es la caja.

### 2.1 Lo que se descartó por el camino

| Idea | Por qué se cae |
|---|---|
| Elevar el tramo de la etapa en curso (9 px contra 4) | Funcionaba para encontrar la etapa, pero la barra dejaba de ser una línea y **despegaba el texto de arriba**: el bloque se leía como dos cosas |
| Cursor blanco de «estás aquí» cruzando la barra | Un cuarto color en una tarjeta a la que le estábamos quitando uno |
| Cifras en una sola línea de texto (`86% adherencia · 1,5 cic/sem · +4% carga`) | La más ligera de todas, pero las cifras dejan de ser escaneables: se leen, no se miran. Y a 320 px la línea rompe |
| Escalera de etapas numeradas bajo la barra | Añade una fila de etiquetas para decir lo que la barra ya dice |
| `⋯` en la esquina de la tarjeta | Un tercer objetivo dentro de una tarjeta que acabábamos de partir en dos |

---

## 3. Fase U14 — La tarjeta

### 3.1 Anatomía

```
┌ surface · radius.lg · overflow hidden ─────────────┐
│ ZONA NOMBRE — padding 16 · pulsable → visualizador │
│   TU PROGRAMA ›                         CICLO      │  spacingTag mutedLight
│   Hipertrofia Iniciación                   02      │  hero 20 · text / accent
│   ● por Marcos Ruiz                                │  ← solo variante self
├ filete 1px `border`, a sangre ─────────────────────┤
│ ZONA ETAPA — padding 16 · pulsable → selector      │
│   Etapa 2 Acumulación              ● ● ○ ○         │  cardType 13 · pips
│   ▬▬▬▬▬  ▬▬▬▬▬▬▬  ▭▭▭▭▭  ▭▭▭▭▭▭▭  ▭▭▭            │  barra de etapas
│ CIFRAS — px 16 pb 16, sin caja                     │
│   85%          0,5            +4%                  │  cardTitle text
│   ADHERENCIA   CIC/SEM        CARGA                │  spacingTag muted
└────────────────────────────────────────────────────┘
```

El pie **sigue existiendo en el componente** y se pinta solo si llega alguna de
sus tres funciones (`onEdit`/`onView`/`onMore`). La Home ya no las pasa; la
ficha de cliente sí — ver §3.5.

### 3.2 El progreso, en dos niveles

**La barra es el programa.** Un tramo por etapa, y el ancho de cada tramo es
proporcional a sus ciclos: una etapa de 4 ciclos ocupa el doble que una de 2.
Todos los tramos a la misma altura (6 px, radio 3, hueco 4):

| Tramo | Color |
|---|---|
| Etapas cumplidas | `tint.accent50` |
| Etapa en curso | `colors.accent` |
| Etapas por venir | `colors.border` |

La etapa sin techo de ciclos (`durationWeeks: null`) pesa 1 para no comerse la
barra. **Con una sola etapa la barra no se pinta**: mediría el programa contra
sí mismo.

**Los puntos son la etapa.** Uno por ciclo de la etapa en curso, 7 px, encendidos
en `accent` hasta el ciclo actual **incluido** — «voy por el 2 de 4» son dos
puntos encendidos, que es lo mismo que dice el número grande de la cabecera. Sin
techo de ciclos no hay puntos: no hay contra qué contar.

Terminada la etapa, `weekInStage` queda pegado a `totalWeeks` por el clamp de
`computeStageInfo` y **se encienden todos**, que es exactamente lo que se quiere
decir. Antes hacía falta un `stageComplete` aparte para no dejar el último
segmento vacío; con los puntos sobra y se ha borrado.

### 3.3 Las dos zonas y su feedback

Cada zona es un `PressZone` (local a `ProgramCard.jsx`) que interpola su fondo de
`surface` a `surface2` — **90 ms al entrar, 160 al salir**. Iluminar la tarjeta
entera haría imposible aprender que son dos sitios.

Sin `onPress` el `PressZone` es una `View` normal y no hay nada que animar, que
es el caso de la ficha de cliente.

⚠️ **Trampa de lint.** Asignar `p.value` dentro del handler de `onPressIn`
dispara `react-hooks/immutability`. El estado va por `useState` + `useEffect`,
que es el patrón de [`EditorRows`](../../src/components/ui/EditorRows.jsx) —
incluidos los colores extraídos a strings sueltos, porque el worklet solo captura
valores serializables y `th` lleva funciones dentro.

El chevron `›` va **pegado a la ceja**, en `muted`, y solo cuando hay `onPress`.
Al lado del nombre competía con él; es la única señal de que la tarjeta se pulsa.

### 3.4 Lo que ya no está

- **La banda `surface2`** de la cabecera → filete de 1 px.
- **Las tres cajas** de las cifras (fondo `bg` + `radius.md` + padding) → nada:
  el aire ya las separa.
- **El pie** en la Home.
- **[`StageSegBar`](../../src/components/ui/StageSegBar.jsx)** — borrada. Era la
  barra de ciclos con el skew −18°, y no la usaba nadie más. Con ella se va el
  skew en esta pieza: la barra nueva es recta y redondeada, como la maqueta
  aprobada.
- **La nota de etapa** en la Home (`quedan 2 sesiones`) — la sigue usando la
  ficha de cliente (`stageNote`), donde dice otra cosa.

### 3.5 La ficha de cliente conserva el pie

Ahí la tarjeta **no es navegable**: es el contenido del tab de Programa, y su
`⋯` guarda las diez acciones del entrenador (subir, prescribir, compartir,
exportar, desasignar…). Lo que sí hereda es todo lo demás: una superficie,
cifras sin caja y el progreso en dos niveles.

---

## 4. Fase U15 — El visualizador es la pantalla del programa

Al quitar el pie, [`ProgramDetailScreen`](../../src/screens/ProgramDetailScreen.jsx)
pasa de ser un destino más a ser **donde vive todo lo que se le puede hacer a un
programa**.

### 4.1 Editar, al final

Botón de ancho completo, relleno `accent`, texto `btnAction` en `onAccent`,
**después de las sesiones**. Ahí y no un lápiz en la cabecera: sería una segunda
puerta a la misma pantalla, y editar es lo que decides *después* de haber visto
el programa.

Se pinta bajo tres condiciones, que ya existían repartidas por la app:

1. no es el programa de un cliente (`ownerClient`) — el entrenador lo edita
   desde la ficha;
2. es el programa **activo** — el editor trabaja sobre
   `_editingProgramId ?? activeProgramId`, así que con un archivado abierto el
   botón editaría otra cosa;
3. no viene de un entrenador (`isTrainerProgram`) — la razón que ya tenía la
   Home: la edición no sube por el canal y la siguiente actualización lo
   reemplaza entero.

### 4.2 Archivar, en el `⋯` de la cabecera

`ScreenHeader` ya acepta `right`. El `⋯` abre el `DragSheet` de siempre con una
fila, y esa fila abre la hoja de archivar —la misma de la Home, con sus dos
salidas (conservar o borrar historial)— que **se muda entera aquí**. Al archivar
se vuelve atrás: la pantalla ya no tiene nada que mirar.

Mismas condiciones que editar salvo la del entrenador: un programa de entrenador
sí se archiva.

> **Por qué había que moverlo y no solo borrarlo:** el `⋯` del pie era el
> **único** acceso a archivar el programa activo. `ProgramScreen` no lo ofrece, y
> el «Programas archivados» del menú principal es la lista, no la acción.

### 4.3 El selector de etapas pasa a ser el compartido

Los chips propios (`chipRow`, `flex: 1` por chip) se estrangulaban a partir de 5
etapas — que es el caso que trae el planificador. Pasan a
[`StageSelector`](../../src/components/ui/StageSelector.jsx), la variante
«Etapas» de Figma que ya usan el editor de programa y el planificador: reparte el
ancho hasta 4 y **desde la 5ª pasa a scroll horizontal**, centrando la activa y
dejando asomar 24 px de la vecina.

Dos ajustes que pedía el nuevo consumidor:

- **El `+` se vuelve opcional** (`{!!onAdd && …}`): aquí se mira, no se crean
  etapas.
- **La segunda pulsación se ignora.** Pulsar la etapa ya activa vuelve a emitir
  `onChange` a propósito — el editor lo usa para abrir el modal de la etapa. En
  un visualizador no hay nada que abrir.

El texto de ciclos pasa de `programView.stageCycles` (`"{{count}} c."`) a
`editor.cyclesShort` (`"4 ciclos"`): la abreviatura existía **solo** por la falta
de ancho que acabamos de quitar, y ahora los dos sitios que usan el mismo control
dicen lo mismo. La clave vieja se borra de los dos idiomas.

**Se descartó el desplegable de etapas**, que era la otra salida: esconde cuántas
etapas tiene el programa —dato que la cabecera de esta misma pantalla presume en
`04 ETAPAS`— y obliga a dos toques para comparar dos etapas seguidas, que es
justo lo que se hace aquí dentro.

---

## 5. i18n

Una clave nueva y una borrada:

| Clave | |
|---|---|
| `programView.editBtn` | **nueva** — `EDITAR PROGRAMA` / `EDIT PROGRAM` |
| `programView.stageCycles` | **borrada** — la sustituye `editor.cyclesShort` |

Todo lo demás reutiliza lo que había: `home.archive`, `home.archiveModal.*`,
`home.moreOptions`, `home.selectStage`, `programCard.*`.

---

## 6. Fases

| # | Fase | Estado |
|---|---|---|
| U14 | La tarjeta: una superficie, dos zonas pulsables, progreso en dos niveles | ✅ 8-sep-2026 — `ui/ProgramCard.jsx` reescrita, `HomeScreen` y `ClientsScreen` adaptadas, `ui/StageSegBar.jsx` borrada |
| U15 | El visualizador hereda las acciones y el selector compartido | ✅ 8-sep-2026 — `ProgramDetailScreen` (editar, `⋯` archivar, `StageSelector`), `StageSelector` con `onAdd` opcional |

Criterio de aceptación de las dos: `npx eslint` sin errores nuevos y `npx vitest
run` en verde (1225 pruebas), más las dos pruebas en dispositivo de la cabecera.

---

## 7. Trampas conocidas

- La tarjeta necesita **la lista de etapas**, no solo la actual: el prop es
  `stages` (`[{ cycles }]`) + `stageIdx`. Las dos pantallas lo sacan de sitios
  distintos — la Home de `activeProgram.stages` y la ficha de cliente del blob
  espejado del cliente (`clientStageIndex`), que es el índice bueno ahí porque
  el contador del entrenador no se mueve solo.
- `stage.label` y `stage.name` **coinciden** cuando la etapa no tiene nombre
  propio (`computeStageInfo` cae al `Etapa N`): la tarjeta compara los dos y no
  lo escribe dos veces.
- La etiqueta `CICLO` sigue siendo pulsable (abre la ficha del glosario) dentro
  de una zona que también lo es. Es un `TouchableOpacity` anidado y el hijo gana;
  si algún día molesta, el sitio natural de esa ficha es el visualizador.
- El `⋯` de la cabecera del visualizador solo aparece con el programa **activo y
  propio**: al abrirlo desde archivados o desde la ficha de un cliente, la
  cabecera se queda sin acciones y eso es lo correcto.
