# Spec — Catorce papeles y ocho cuerpos: la app deja de gritar

> Tema: ui
> En corto: La app tenía 177 combinaciones distintas de cuerpo × peso × tracking repartidas por 47 ficheros; ahora tiene una escala de ocho pasos, catorce papeles con nombre y tres reglas, y el bold vuelve a significar algo porque ya no está en todas partes.
> Fase U17 · hecho · Los papeles: `textStyles` se rehace y `typography` se retira · §4
> Fase U18 · hecho · Las pantallas: los 170 `fontSize` a pelo caen sobre los papeles · §5
> Fase U19 · hecho · El suelo de legibilidad y los dos pesos que sobraban · §6
> Fase U20 · hecho · La anatomía nombre + meta, una sola para toda la app · §9
>
> Estado: **las cuatro fases implementadas** (sep 2026), en la rama
> `feat/tipografia-jerarquia`. Sale de una auditoría del uso real de tipografía
> en `mobile/src` pedida por el usuario: «ahora mismo es una cacofonía de textos
> diferentes».
>
> **Probar en dispositivo.** Son ~85 sitios que cambian de cuerpo de verdad (el
> resto sólo cambia de token a token). El riesgo está concentrado en las cajas
> medidas al píxel donde el texto SUBE: la tira de días del calendario de
> Historial (celda de 30 px, número de 10 → 12), la tab bar (9 → 11), los ejes de
> las dos gráficas (8 → 11) y los badges pequeños de Progreso (8 → 12). Ver §7.
>
> **Lo que NO se toca, por identidad** (§2.3): la Barlow de la tarjeta de hoy, la
> Black de los nombres de sesión de la Home, la Black de los botones principales
> («Editar programa») y la itálica del logotipo FORMA.

---

## 1. El problema, con números

Estado antes de esta spec, medido sobre `mobile/src` (47 ficheros con estilos de
texto):

| Métrica | Antes |
|---|---|
| Declaraciones de `fontSize` | **309** (170 literales, 139 vía token) |
| Combinaciones únicas *(cuerpo × peso × tracking × interlineado)* | **177** |
| Cuerpos distintos en pantalla | **22** literales + 7 tokens |
| Ficheros de fuente en el bundle | **8** (6 pesos de Inter + itálica + Barlow) |
| Valores distintos de `letterSpacing` | **27** |
| `lineHeight` a ojo | **128** |

Y **dos sistemas conviviendo**: `typography.{xs,sm,base,md,lg,xl,xxl}` —una
escala suelta heredada, en 20 ficheros— y `textStyles.*` —veinte tokens
compuestos de Figma, en 47—. Doce ficheros usaban los dos a la vez.

Cuatro tokens hacían el 70 % del trabajo (`cardType` 115 usos, `tag` 111,
`subtitle` 97, `spacingTag` 70); los otros dieciséis se repartían 120. Por debajo,
170 literales que no pasaban por ningún token.

Peores focos: `ClientsScreen` 43 combinaciones, `ConditioningBlockCard` 32,
`ExerciseCard` 30, `ProgressTab` 26.

---

## 2. Por qué sonaba a cacofonía

### 2.1 Escalones que nadie ve

Por debajo de un ~12 % de diferencia el ojo no separa dos cuerpos. La app
distinguía 10 y 11 px: **139 sitios peleándose por un píxel**. Lo mismo con
15/16/17 (30 sitios), 18/19/20 (12) y 22/24/26 (13). Eso no es jerarquía, es
ruido con forma de jerarquía.

### 2.2 Cuatro perillas a la vez

La jerarquía se construye moviendo **una o dos** variables. Aquí cada estilo movía
cuerpo **y** peso **y** tracking **y** color a la vez. Ocho voces distintas en una
sola tarjeta (`ConditioningBlockCard`, antes):

```
17/900/-0.17 · 15/900/0 · 12/600/0 · 10/700/1.4
12/800/1.2   · 11/600/0 · 22/700/0 · 24/900/-0.24
```

### 2.3 El tracking sin regla

27 valores: `0.1`, `0.26`, `0.32`, `0.4`, `0.48`, `0.5`, `0.64`, `0.8`, `0.88`,
`1`, `1.1`, `1.12`, `1.2`, `1.4`, `1.5`… El tracking positivo **sólo** hace algo
en versales; en caja baja a 12 px abre huecos y frena la lectura.

Y el caso peor: `cardType` (12/800/**+1.2**) se usaba en 115 sitios, de los cuales
**108 pintan texto en caja baja** — nombres de ejercicio, etiquetas de botón,
valores, «Eliminar». Ciento ocho sitios con tracking de versales sobre texto que
no lo es.

### 2.4 La negra dejó de significar nada

`Inter_900Black` aparecía en 29 sitios, muchos a 11–13 px. Si el nombre de la
sesión, el badge de filtro, el título del modal y la fila de la tabla van todos en
Black, ninguno destaca: la identidad que hay que proteger estaba diluida por su
propio exceso de uso.

### 2.5 Once sitios por debajo del suelo

Había once estilos a 8–9 px, uno de ellos **la etiqueta de la tab bar** (9 px), que
es navegación primaria. El mínimo de iOS HIG es 11 pt y el de Material 12 sp; con
Inter —que no tiene eje óptico— sobre `#0a0a0a` a 8 px el texto no se lee, se
adivina.

---

## 3. El sistema: tres ejes cerrados

### 3.1 Escala — siete pasos y un suelo

```
11 · 12 · 14 · 16 · 18 · 22 · 28 · 34
```

Progresión de ~1.15 a ~1.25, redondeada a pares. Cada paso es perceptible y
ninguno sobra. El **11** es el suelo y sólo lo merecen tres sitios: tab bar, ejes
de gráfica y sufijos de unidad.

Una sola excepción funcional, documentada en el código: **el reloj de AMRAP a
44 px**. No es display, es un dato que se lee de pie, a metro y medio del suelo.

### 3.2 Pesos — de ocho ficheros a seis

| Peso | Papel |
|---|---|
| **500 Medium** | cuerpo, metadatos |
| **700 Bold** | énfasis, nombres en editores |
| **800 ExtraBold** | versales, cabeceras |
| **900 Black** | identidad: nombres, botones, cifras |
| 900 Italic | wordmark FORMA *(identidad)* |
| Barlow 800 It. | hero + logo *(identidad)* |

Fuera **`Inter_400Regular`** (1 uso) e **`Inter_600SemiBold`** (27). Dos ficheros
menos en el bundle y, sobre todo, se elimina el par 500/600, indistinguible a
12 px y responsable de buena parte del ruido.

El 400 era además el *fallback* de `INTER_BY_WEIGHT`. Que ahora apunte al 500 no
es sólo simplificar, es **corregir**: texto claro sobre fondo oscuro sufre
irradiación —el fondo invade el trazo— y la Regular a 12–14 px se ve más fina de
lo que el diseño supone. Medium es el peso por defecto correcto en una UI oscura.

### 3.3 Tracking — tres reglas

```
VERSALES        →  +1.2   (siempre; es el único caso en que hace algo)
Caja baja ≤ 22  →   0
Display > 22    →  −0.02 em   (−0.5 a 28, −0.7 a 34)
```

Única excepción viva: los **códigos de emparejamiento y el tempo** (`+4`). Se leen
carácter a carácter, no como palabra: ahí el aire es funcional. Tienen papel
propio (`code`).

### 3.4 Interlineado — tres relaciones

```js
LINE = { tight: 1.15, body: 1.5, row: 1.2 }
lh(14)            // 21
lh(18, LINE.tight) // 21
```

Display y títulos `tight`; cuerpo multilínea `body`; filas de una línea `row` o la
cuenta explícita de caja (la del hero de la Home, que no se toca).

---

## 4. Fase U17 — Los papeles

`src/theme.js` pierde `typography` entero y `textStyles` se rehace con catorce
papeles. Un papel dice **para qué** sirve un texto, no cómo se ve: es lo que evita
que dentro de tres meses alguien invente el decimoquinto.

| Papel | Def. | Para qué |
|---|---|---|
| `heroGlyph` | 34 Barlow 800 It. / 0 / upper | letra de la sesión de hoy **(identidad)** |
| `heroName` | 28 Barlow 800 It. / 0 | nombre de la sesión de hoy **(identidad)** |
| `title` | 22 / 900 / −0.5 | cifras grandes, títulos de hoja, letra de fila |
| `heading` | 18 / 800 / −0.2 | cabecera de pantalla y de modal |
| `itemTitle` | 16 / 900 / −0.2 | nombre en lista de consulta **(identidad)** |
| `itemTitleQuiet` | 16 / 700 / −0.2 | el mismo nombre dentro de un editor |
| `body` | 14 / 500 / 0 | cuerpo de lectura |
| `bodyStrong` | 14 / 700 / 0 | su énfasis |
| `button` | 14 / 900 / 0 | todo lo que se pulsa y lleva palabra **(identidad)** |
| `label` | 12 / 500 / 0 | metadatos, unidades, filas densas |
| `labelStrong` | 12 / 800 / 0 | su énfasis |
| `caps` | 12 / 800 / +1.2 | la ceja en versales, una para toda la app |
| `micro` | 11 / 500 / 0 | el suelo: tab bar, ejes, sufijos |
| `code` | 22 / 900 / +4 | códigos de emparejamiento y tempo |

Hay un patrón detrás y es lo que lo hace enseñable: **cada cuerpo tiene su versión
callada y su versión firme**, y se sube de peso antes que de cuerpo.

| Cuerpo | callado | firme | identidad |
|---|---|---|---|
| 16 | `itemTitleQuiet` 700 | — | `itemTitle` 900 |
| 14 | `body` 500 | `bodyStrong` 700 | `button` 900 |
| 12 | `label` 500 | `labelStrong` 800 | `caps` 800 +1.2 |
| 11 | `micro` 500 | — | — |

### 4.1 Mapa de los veinte tokens viejos

| Antes | Ahora | Usos | Cambia |
|---|---|---|---|
| `cardType` 12/800/1.2 | `labelStrong` 12/800/0 | 115 | **el tracking se va** (§2.3) |
| `tag` 12/500/0 | `label` | 111 | nada |
| `subtitle` 14/500/0.48 | `body` 14/500/0 | 97 | el tracking se va |
| `spacingTag` 12/800/2 | `caps` 12/800/1.2 | 70 | tracking 2 → 1.2 |
| `btnAction` 14/900/0 | `button` | 34 | nada |
| `cardTitle` 16/900/0.64 | `itemTitle` 16/900/−0.2 | 33 | el tracking se invierte |
| `hero` 20/900/0 | `title` 22/900/−0.5 | 25 | +2 |
| `smallBold` 10/600/1.12 | `caps` 12/800/1.2 | 16 | +2 y sube de peso |
| `screenTitle` 18/800/−0.2 | `heading` | 4 | nada |
| `addLink` 13/800/0.26 | `button` 14/900/0 | 3 | +1 y sube de peso |
| `editorName` 16/700/−0.2 | `itemTitleQuiet` | 2 | nada |
| `exercice` 16/900/0 | `itemTitle` | 1 | tracking |
| `sessionGlyph` 22/900/−0.6 | `title` | 1 | tracking |
| `sessionName` 16/900/−0.2 | `itemTitle` | 1 | nada |
| `sessionGlyphXL` | `heroGlyph` | 1 | nada |
| `sessionNameXL` | `heroName` | 1 | nada |

**El mayor ahorro es `caps`**: `cardType` + `spacingTag` + `smallBold` sumaban
201 sitios diciendo lo mismo —*etiqueta corta en versales*— con tres tracking
distintos. El comentario de `theme.js` ya había detectado el patrón al unificar
tres cejas en `spacingTag`; esto termina esa faena y le quita al `labelStrong` el
tracking que nunca le tocó.

---

## 5. Fase U18 — Las pantallas

Los 170 literales caen sobre los papeles con este mapa:

```
8, 9, 10, 11  →  11 (caja baja)  /  12 (si es versal)
13            →  14 (texto)      /  12 (si es etiqueta)
15, 16, 17    →  16
18, 19, 20    →  18
22, 24, 26    →  22
28, 32        →  28
```

**Exentos**, por identidad o por función: 19 y 38 (wordmark FORMA), 44 (reloj de
AMRAP), y los `fontSize` de 32/40/18 que son **emojis de estado vacío**, no texto.

Un estilo puede seguir ajustando `lineHeight`, `color`, `flex` o la familia de un
`<Text>` anidado sobre un papel — eso es variación, no un papel nuevo. Lo que no
puede es volver a declarar `fontSize` suelto.

---

## 6. Fase U19 — El suelo y el bundle

- Los once sitios a 8–9 px suben a 11 o 12. En particular: **tab bar 9 → 11**,
  ejes de las dos gráficas **8 → 11**, badge de PR y píldoras de Progreso
  **8 → 12**, número del calendario **10 → 12**.
- `Inter_400Regular` e `Inter_600SemiBold` salen de `App.js` y de `app.json`.
- `INTER_BY_WEIGHT` remapea 400 → 500 y 600 → 700 para que un estilo rezagado
  renderice bien en vez de caer a la fuente del sistema.

---

## 7. Resultado medido

| Métrica | Antes | Después |
|---|---|---|
| Combinaciones únicas | 177 | **40** *(y 26 de ellas son familias de `<Text>` anidados, no estilos completos)* |
| Declaraciones de `fontSize` en `src` | 309 | **33** *(14 son la definición de los papeles)* |
| Valores de `letterSpacing` | 27 | **8** *(5 son papeles; 3, excepciones documentadas)* |
| Cuerpos en pantalla | 29 | **8 + 1** |
| Ficheros de fuente | 8 | **6** |
| Papeles / tokens | 20 + 170 sueltos | **14** |

Reparto de uso final: ver §9, que redistribuye parte de `label`/`labelStrong`
hacia `body`/`bodyStrong` al unificar la anatomía nombre + meta.

---

## 8. La regla que evita la recaída

> **Máximo tres papeles tipográficos por pantalla.** Lo demás se jerarquiza con
> **color**, no con tipografía.

La paleta ya tiene cuatro niveles para eso: `text` → `mutedLight` → `muted` →
`muted2`. Es el error de fondo de `ConditioningBlockCard` y `ClientsScreen`: le
pedían ocho niveles de jerarquía a la tipografía cuando cuatro de ellos eran en
realidad *importancia*.

Y el sistema se vigila solo: `src/theme.test.js` falla si un papel se sale de la
escala, baja del suelo de 11, pide una familia que `App.js` no carga, inventa un
tracking, o vuelve a declarar `fontWeight` —que es lo que hacía caer Android a
Roboto—. Sin ese test, en tres meses hay un decimoquinto papel a 15 px con
tracking 0.7 y nadie se entera.

## 9. Fase U20 — La anatomía nombre + meta

Sale del primer repaso en pantalla de U17–U19. Los papeles estaban bien elegidos
pero **mal repartidos**: media app llamaba «meta» a un `label` de 12 y la otra
media a un `body` de 14, y en tres sitios el nombre acabó siendo más pequeño que
su propia línea de metadatos.

El caso claro es la tarjeta de cliente: el **nombre del programa** iba a 12 y la
**etapa que cuelga de él**, a 14. La línea que manda era la más pequeña de las
dos.

### 9.1 La anatomía

Toda lista de consulta y todo editor de la app usan esta y sólo esta:

```
Nombre            → itemTitle 16/900   (consulta)  ·  itemTitleQuiet 16/700 (editor)
Nombre secundario → bodyStrong 14/700
Meta              → body 14/500
```

El nombre secundario y la meta **comparten cuerpo y se separan por peso**. Es la
misma regla del sistema —se sube de peso antes que de cuerpo— aplicada a la
unidad que más se repite en la app.

La referencia la fijó el usuario: el «sin ritmo aún» de la tarjeta de cliente
(`cPaceUnit`), que ya estaba en `body`.

### 9.2 Dónde se aplicó

| Zona | Qué cambia |
|---|---|
| **Clientes** | «+ Cliente» y «+ Programa» pasan de `labelStrong` a `button` — es la misma caja de 42/44 px que «+ Plantilla» de Plantillas, que ya iba en `button`. Nombre de programa y línea de aviso, de 12 a `bodyStrong` |
| **Historial** (`SessionCard`) | Nombre de sesión y su letra, de `labelStrong` a `itemTitle`. Etapa, fila de datos, fecha de la esquina, meta del detalle y nombres de ejercicio, a 14 |
| **Progresión** (`ProgressTab`) | Nombre de ejercicio a `itemTitle`, su subtítulo a `body` |
| **Visualizador** (`ProgramDetailScreen`) | Subtítulo y stats de sesión, meta de tarjeta y de bloque, notas de ejercicio y de bloque, número y prescripción, todo a 14 |
| **Editores** | Las dos líneas de las tarjetas de resumen (`summaryMain` / `summarySub` / `summaryVolume`), nombres de movimiento, `presetName` + `presetMeta`, y el nombre de fila del planificador de etapas |

### 9.3 Segundo repaso

Del segundo pase en pantalla salieron cinco ajustes más, todos dentro de la misma
anatomía:

- **El nombre en historial y progresión pasa de `itemTitle` a `itemTitleQuiet`.**
  Misma voz que los nombres de sesión y de ejercicio del editor de programa. La
  Black a 16 en una lista que se recorre entera cansa; el peso que hace falta
  para encontrar un nombre con la vista es Bold, no Black.
- **La tarjeta de programa de la Home** deja de hablar en `title` (22): nombre y
  contador de ciclos bajan a `itemTitle`, la misma letra que los nombres de las
  sesiones de la lista de abajo. Son la misma pantalla y el mismo tipo de dato.
- **«ETAPA 1 · Nombre»**, en esa misma tarjeta, sube de 12 a `bodyStrong`: es un
  nombre y quedaba por debajo del resto de la tarjeta.
- **Los segmentados** suben un escalón, a `bodyStrong`. Es texto que se pulsa y a
  12 se leía como metadato. `ui/TabBar` no es un `SegmentedControl` —lo dice su
  propia cabecera, track y radio distintos— pero es la otra tira de pestañas de
  la app y sube con ellos: dejarla a 12 recrearía el desajuste que U20 arregla.
- **`ui/EditorRows`** —la anatomía de las tarjetas del editor de ejercicio:
  Calentamiento, Progresión, Opciones— se había quedado fuera de U20 por ser un
  componente compartido y no una de las pantallas de la lista. `navRowTitle` a
  `itemTitleQuiet`, `optRowLabel` a `bodyStrong`, las dos pistas a `body`. Con
  él, sus copias sueltas en los dos editores inline y en el alta de ejercicio, y
  los botones de esas hojas («Sustituir», «Eliminar», «+ Añadir paso»), que
  seguían en `labelStrong` en vez de en `button`.

### 9.4 Tercer repaso

- **`ui/StepField`**, las cajas de ± del editor (Series, Descanso, Reps): sus dos
  variantes iban a 12 y se leían como metadato. Las dos suben a `bodyStrong`.
  Se probó la del grid a 16 —el título de tarjeta de `NavRow`, que es lo que se
  había pedido— y en pantalla no funcionó: un ± con su rótulo es una **fila de
  opción con botones**, no una tarjeta, y a 16 el rótulo pesaba más que el propio
  número. Decisión del usuario: las dos a 14.
- Y detrás de ella, **el nombre de fila baja de 16 a `bodyStrong`** en todas las
  listas de la app: las tarjetas de Calentamiento / Progresión / Opciones
  (`ui/EditorRows`), las tarjetas de Historial (`SessionCard`), las filas de
  Progresión (`ProgressTab`) y los nombres de sesión y de ejercicio de los tres
  editores (`ProgramEditor`, `SessionEditor`, `StagePlanner`).

  Con ello **nombre y meta comparten cuerpo y se separan sólo por peso** —14/700
  contra 14/500—, que es la anatomía de §9.1 llevada hasta el final. El nombre de
  historial pasó por los dos extremos antes de quedarse aquí: a 12 estaba por
  debajo de sus propios datos, y la Black a 16 gritaba en una lista que se
  recorre entera.

  `itemTitleQuiet` (16) queda para los tres sitios donde un nombre **no está en
  una lista**: el ejercicio en marcha del entreno, su celda de serie y la
  cabecera de «Próxima sesión». Ahí el nombre es el asunto de la pantalla entera,
  no una fila entre muchas.
- **«Añadir ejercicio»** de la sesión de entreno, a `button`. Es el hermano de
  «Añadir serie» (`ExerciseCard.addLinkText`), que ya iba en `button`: mismo
  enlace, misma voz. A 12 el botón salía diminuto y con él su «+» en lima, que
  sólo hereda el color.

El resto de botones de añadir ya seguían el patrón correcto —el glifo en lima al
100 % es un `<Text>` anidado que **sólo cambia el color** sobre el estilo del
botón—, así que el único roto era ese. Vale igual para el nombre de etapa en
«Añadir sesión a …» del editor de programa.

### 9.5 Cuarto repaso — la frontera `label` / `body`

Al bajar el nombre de fila de 16 a 14 (§9.4), el par nombre + meta se quedó
apoyado **sólo en peso y color**: 14/700 contra 14/500. El usuario preguntó si el
meta no debería volver a 12, y sí — pero no en bloque.

La frontera no la decide la pantalla ni la posición, sino **si el texto se
escanea o se lee**:

| | Papel | Ejemplos |
|---|---|---|
| **Escaneado** | `label` 12/500 | «5 ejercicios · 55 min · ayer», «4×8 · 90s», fechas, contadores, unidades, «ETAPA 2» |
| **Leído** | `body` 14/500 | pistas bajo una opción, avisos, descripciones, texto legal |

Un dato escaneado no se lee nunca de izquierda a derecha: es un objetivo de
vistazo, y a 12 sobre `mutedLight` da 7.1:1 de contraste, de sobra en fondo
oscuro. Una frase sí se lee, y a 12 vuelve exactamente el problema de sep-2026
—Inter sin eje óptico sobre `#0a0a0a`, dos líneas seguidas— que motivó la subida
de escala.

**Esto no reabre el desdoble 12/14 que la spec vino a cerrar.** Aquel era «cada
pantalla declaró lo suyo»; éste es una regla por función, con una pregunta que
cualquiera puede contestar dentro de tres meses: *¿es una frase, o son datos con
separadores?*

Se descartó la alternativa aparentemente más barata —dejarlo todo a 14 y apagar
el color de `mutedLight` a `muted`—: `muted` (#777) da **4.4:1** sobre el fondo,
justo por debajo del 4.5:1 de AA para texto normal. Por eso el propio `theme.js`
dice que `mutedLight` existe para «mantener ≥4.5:1 a cuerpos pequeños». El color
no es una palanca disponible aquí; el cuerpo sí.

Bajan 35 claves de estilo en 14 ficheros: la banda de metadatos de las tarjetas
de Historial, el subtítulo de Progresión, el sub de las tarjetas del editor de
ejercicio, los metas del visualizador, los de los tres editores, las unidades de
los `StepField` y de las cajas de calentamiento, y la línea de programa, ciclo,
ritmo y fechas de la tarjeta de cliente.

### 9.6 Lo que se dejó fuera, y por qué

- **`WorkoutScreen` y el hero de la Home**, por instrucción explícita: son las dos
  piezas donde la densidad está medida contra una caja concreta.
- **Las filas de sesión del modal de Progresión** (`modalSes*`) y las píldoras de
  series: no cuelgan de un nombre, son tres columnas en una fila estrecha y a 14
  se desbordan.
- **`statSub` de las tarjetas de estadística** y las barras de grupo muscular
  (`groupName` / `groupHint`): son etiquetas de un dato, no la meta de un nombre.

---

## 10. Fases

| Fase | Estado | Qué | Commit |
|---|---|---|---|
| U17 | ✅ | `textStyles` rehecho con 14 papeles, `typography` retirado, 510 usos de token migrados | esta rama |
| U18 | ✅ | 170 literales caídos sobre los papeles en 47 ficheros | esta rama |
| U19 | ✅ | Suelo de 11 px, Inter 400 y 600 fuera del bundle, test de invariantes | esta rama |
| U20 | ✅ | Anatomía nombre + meta unificada en clientes, historial, progresión, visualizador y editores | esta rama |

Criterio de aceptación de las cuatro: `npx vitest run` en verde (1244 tests) y
`npx eslint mobile/src` sin errores nuevos respecto a HEAD (169, los mismos).
