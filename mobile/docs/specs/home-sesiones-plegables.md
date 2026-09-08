# Spec — Las sesiones se pliegan: una sola lista, la de hoy en color

> Tema: ui
> En corto: Las sesiones dejan de ser «un hero + una lista» y pasan a ser una única lista de filas plegables; la que toca hoy es una de ellas, en lima, con la letra grande y su botón puesto, y todas se abren al tocarlas para enseñar los ejercicios.
> Fase U12 · hecho · Cimientos: tokens de texto y `targetLabel()` extraído · §4
> Fase U13 · hecho · La lista plegable: filas, tarjeta de hoy, desplegable y botones · §5
>
> **Probar en dispositivo.** La mancha de lima crece al desplegar la sesión de
> hoy (~150 px cerrada → ~320 px abierta con siete ejercicios). En pantalla de
> ordenador se ve bien; con brillo alto y en la mano puede ser mucha. Si molesta,
> la salida está escrita: la caja negra del desplegable pasa a ocupar también el
> pie (§9.2), sin tocar nada más.
>
> **Probar en dispositivo.** El acordeón cierra la tarjeta abierta al abrir otra.
> Con la de hoy abierta y la lista larga, comprobar que al cerrarla la pantalla
> no da un salto brusco — es lo único de la animación que no se puede juzgar
> sobre la maqueta.
>
> Estado: **las dos fases implementadas** (sep 2026, `f2f79f0`), a falta de las
> dos pruebas en dispositivo de arriba. Sale de una sesión de diseño Opus +
> usuario sobre la Home: siete rondas de maquetas y un prototipo funcional, cada
> ronda corrigiendo la anterior.
>
> Los valores de §4.2 y §5 son los que quedaron **después de verlo en el móvil**,
> que corrigió cuatro cosas que la maqueta daba por buenas: la lista del hero se
> pintaba con tinta invertida y salía negra sobre negro; los radios por posición
> (`getCardRadii`) no valen cuando cualquier fila puede crecer; la flecha de
> desplegar no informaba de nada; y la tipografía se leía más floja que en el
> mock — con `Inter_900Black` de techo, lo único que queda es cuerpo y tracking.
>
> **Reemplaza** la §3.2 (el hero) y la §3.3 (las filas) de
> [home-sessions.md](home-sessions.md), que quedan como registro de lo que hubo.
> Todo lo demás de aquella spec sigue vigente y **no se toca**: la tarjeta de
> programa (§4), la tira de semana (§3.1), las plantillas de sesión libre (§7) y
> la regla del acento (§1.1), que esta spec estrecha aún más.
>
> Problema que resuelve: el hero se arrancaba de la lista y crecía hasta media
> pantalla si enseñaba los ejercicios; la lista de abajo, en cambio, no decía
> qué hay dentro de cada sesión, así que la única forma de saberlo era empezarla.
> Además el hero tenía **un solo objetivo de toque** —empezar— y no había manera
> de mirar sin entrar.

---

## 1. Concepto

Una anatomía, dos escalas, cuatro estados.

```
┌ A   Empuje                           ayer ✓ ┐   60 px · hecha
├ B   Tirón                         hace 3 d ✓ ┤   60 px · hecha
│ ┌─────────────────────────────────────┐   │
│ │ HOY TE TOCA                           │   │
│ │ C  Pierna y core                      │   │   tarjeta lima
│ │ ───────────────────────────────────   │   │   ~148 px cerrada
│ │    7 EJERCICIOS · 55 MIN · HACE 6 D   │   │
│ │  ┌────────────────────────────────┐  │   │   ← solo al desplegar
│ │  │ 1 Sentadilla trasera       4×5  │  │   │
│ │  │ 2 Peso muerto rumano       3×8  │  │   │
│ │  └────────────────────────────────┘  │   │
│ │  [       EMPEZAR SESIÓN C        › ]  │   │
│ └─────────────────────────────────────┘   │
├ D   Full body corto                  35 min ┤   60 px · pendiente
└────────────────────────────────────────────┘
```

Tres reglas, y de ellas sale todo lo demás:

1. **Todas las sesiones están en la lista, en orden de ciclo.** La de hoy ya no
   se extrae: ocupa su hueco. Al completarla, la tarjeta grande se mueve al
   hueco de la siguiente — eso es lo que se está diciendo.
2. **Toda la fila abre; solo el botón entra.** Tocar la cabecera despliega los
   ejercicios; tocar el botón empieza a entrenar. Dos objetivos, sin ambigüedad.
3. **El botón lo trae puesto solo la de hoy.** Las demás lo revelan al abrirse,
   y en contorno en vez de relleno. Es la manera de decir «puedes, pero no es lo
   que toca» sin un diálogo de confirmación.

### 1.1 La regla del acento, más estrecha

`home-sessions.md` §1.1 dejó el acento reservado a «esto es lo siguiente». Aquí
se estrecha un paso más: **dentro de la Home, el relleno lima es exactamente una
pieza** —la tarjeta de hoy— y dentro de ella el lima desaparece por completo,
porque sobre lima el acento es el negro. La letra, la raya y las series van en
negro; el botón se invierte (fondo negro, texto lima).

El contorno lima sigue significando «acción disponible, no prioritaria»: lo usan
la sesión libre (ya existía) y el botón de las sesiones no-de-hoy al desplegarse.

---

## 2. Lo que esta spec NO toca

Se dice explícitamente porque la sesión de diseño llegó a proponerlo y se
descartó **para esta ronda**, no para siempre:

| Pieza | Qué pasa |
|---|---|
| Tarjeta de programa | **Igual que hoy**, con su pie de EDITAR / VER / ⋯. Se llegó a maquetar sin pie y pulsable entera; queda fuera de esta spec |
| Tira de semana | Igual, arriba del todo (home-sessions §3.1) |
| Sesión libre | Igual, botón en contorno bajo la lista (home-sessions §7) |
| Sección CONEXIONES | Igual. Se maquetó su borrado (ya vive en el menú ≡) y queda fuera |
| Cabecera de la app | Igual ([cabeceras.md](cabeceras.md)) |
| Banner de etapa terminada | Igual, encima de la lista |

---

## 3. Lo que se descartó por el camino

Seis rondas de maquetas. Lo que no sobrevivió, con el motivo, para que nadie lo
vuelva a proponer sin saber que ya se miró:

| Idea | Por qué no |
|---|---|
| **Hero con los ejercicios dentro** | Funcionaba, pero 310 px de tarjeta. El plegado es la respuesta a eso |
| **Lomos verticales** (sesiones de canto, nombre girado) | Tope real de 5 sesiones y el nombre en vertical cuesta de leer. Tumbados —que es esto— no tienen tope |
| **Baraja / mazo de cartas** | Bonita, pero obligaba a abreviar los nombres a dos columnas |
| **Barra segmentada del ciclo** (A B C D bajo la cabecera) | **Ruido**: el orden ya lo llevan las tarjetas. Se sustituyó por la raya entera y el contador «2 de 4» volvió al rótulo de sección |
| **Letra a la derecha** | Se maquetaron las dos. Gana la izquierda: la Home es un índice y en un índice el identificador va delante. La derecha gana ancho — si con nombres reales de entrenador el texto se trunca, es la salida |
| **Lista de ejercicios en versalitas con filete y series en lima** | Tres acentos por línea; competía con la cabecera. Ver §5.4 |
| **Zona desplegada en negro con el botón invertido a lima** | Se maquetó y se prototipó (maqueta C). Descartada: el botón **cambia de color** al desplegar y se lee como un parpadeo |
| **Caja negra a sangre** (sin lima a los lados) | Descartada por el usuario a favor del filo de 6 px, que mantiene la tarjeta como una sola pieza |
| **Barlow Condensed recta** para letras y nombres | +204 KB por dos familias que solo compran ancho, y para una sola pantalla. El diseño se reajustó a Inter (§4.1) |
| **Nombres en versalitas** | Con la condensada funcionaban; en Inter Black ocupan demasiado y se leen más lento. Caja baja |

---

## 4. Fase U12 — Cimientos: tokens y `targetLabel()`

Tres cosas que **no son la pantalla** y que si no van primero obligan a
inventarlas dentro de ella. Ninguna cambia nada visible por sí sola.

### 4.1 Sin fuente nueva: Inter, la que ya está

Las maquetas de la sesión de diseño usaban **Barlow Condensed recta** para la
letra de sesión y los nombres. Se descarta, y queda escrito el porqué para que
no se vuelva a plantear a ciegas:

- La app carga hoy **solo** `BarlowCondensed_800ExtraBold_Italic`, que es la del
  logo. La recta son **dos familias más** (`600SemiBold` y `800ExtraBold`) y
  **+204 KB** de bundle — medido: los dos TTF de `node_modules` pesan 103.856 y
  104.812 bytes. El paquete ya es dependencia, así que el coste es solo peso.
- Lo único que compra la condensada es **ancho**: una C de 48 px en 23 de ancho,
  y un nombre en versalitas a 20 px dentro de una fila de 52. Nada más del
  diseño depende de ella.
- Y entraría **para una sola pantalla**, cuando la regla de `docs/UI-MIGRATION.md`
  es que **Inter es la voz de la app**. Una segunda familia solo se justifica si
  se extiende (Workout, visualizador de programa), y eso es una decisión más
  grande que esta Home.

Se maquetaron las tres opciones —Barlow, Inter con los mismos valores, e Inter
reajustada— y el cambio literal **no funciona**: con Inter a 48 px la letra se
sale de su columna y el nombre a 30 px rompe a dos líneas. No es un cambio de
familia, es un reajuste de cuerpos, y es el que va escrito abajo.

Si algún día se añade la Barlow, esta fase es exactamente lo que hay que tocar:
dos líneas de import y cuatro tokens. **No bloquea nada de la U13.**

### 4.2 Tokens de texto nuevos

Van a `textStyles` en `src/theme.js`, con el resto. **No salen de Figma** —
salen de esta sesión de diseño, igual que los del hero de `home-sessions.md`—, y
por eso se documentan aquí con su valor exacto. Los cuatro son Inter, que ya
está cargada entera:

```js
// src/theme.js — textStyles
sessionGlyph:  { fontFamily: 'Inter_900Black', fontSize: 22, letterSpacing: -0.6 },  // letra de fila
sessionGlyphXL:{ fontFamily: 'Inter_900Black', fontSize: 34, letterSpacing: -1.6 },  // letra de la de hoy
sessionName:   { fontFamily: 'Inter_900Black', fontSize: 16, letterSpacing: -0.2 },  // nombre de fila
sessionNameXL: { fontFamily: 'Inter_900Black', fontSize: 24, letterSpacing: -0.8 },  // nombre de la de hoy
```

Los interlineados NO van en el token porque cambian por sitio (`lineHeight: 22`
en la letra de fila, `28` en la XL, `25` en el nombre XL): se ponen en el
`StyleSheet` de la pantalla, como ya hace `heroName`.

Los cuerpos subieron un punto al ver la pantalla de verdad: la maqueta se leía
más pesada que la app. **`Inter_900Black` es el peso más alto que carga la app**,
así que lo único que queda para ganar cuerpo es tamaño y tracking — subir y
apretar. Misma nota que ya llevaba `heroName`.

**Nada va en versalitas.** Con la condensada los nombres iban en mayúsculas; en
Inter Black las mayúsculas ocupan demasiado y se pierde velocidad de lectura, así
que **nombre de sesión y nombre de fila van en caja baja**, tal cual los escribe
el entrenador. Las mayúsculas se quedan donde ya estaban: rótulos, meta y botón.

**La columna de la letra mide 26 px en las dos escalas.** Es lo que hace que la
letra de fila y la letra grande caigan en la misma vertical y la lista se lea
como un índice. No es negociable: si se toca, se pierde el efecto entero.

### 4.3 `targetLabel()` sale de `ExerciseCard`

La prescripción «4 × 5 reps» ya se compone en
`src/components/workout/ExerciseCard.jsx:86` (`buildTarget`), con todos los casos
resueltos: `submax`, `reps`, `time`/`weight_time`, rango `min–max`, unilateral,
y el fallback a los valores del ejercicio de la librería cuando la sesión no los
fija. **No se reescribe**: se extrae.

```js
// src/utils/prescription.js
export function targetLabel(def, exConfig, t, { compact = false } = {})
```

- `compact: false` → lo de hoy, idéntico: `"4 × 5 reps"`, `"3 × 20–40 s por lado"`.
- `compact: true` → lo que pinta la Home: **sin la palabra «reps», sin espacios
  alrededor del `×` y sin el «por lado»** → `"4×5"`, `"3×20–40 s"`, `"4×submáx"`.

`ExerciseCard` pasa a importarla y llamarla sin opciones. Su comportamiento no
cambia ni un carácter — es la condición para que la extracción sea segura.

**Prueba:** `src/utils/prescription.test.js`, con un caso por rama (submax,
reps iguales, rango, tiempo, unilateral) × los dos modos. Es la única lógica
nueva de la fase.

### 4.4 `sessionPlan()` deja de sacar el hero de la lista

`src/utils/sessionPlan.js` devuelve hoy `rows` **sin** la sesión hero, porque el
hero se pintaba fuera. Ahora la lista las lleva todas:

```js
rows: days.map((d) => ({
  templateId: d.templateId,
  marker:     d.label ?? '',
  isDone:     doneIds.has(d.templateId),
  isHero:     d.templateId === hero?.templateId,   // ← nuevo
})),
```

`heroTemplateId`, `heroLabel` y `subtitle` **no cambian**: el rótulo sigue
saliendo de aquí y `heroTemplateId: null` sigue significando «no hay ninguna
destacada» (home-sessions §5.3), que ahora se pinta como una lista donde ninguna
fila es la tarjeta grande.

Hay que **actualizar `src/utils/sessionPlan.test.js`**: los casos que hoy
comprueban que el hero no está en `rows` pasan a comprobar que está, con
`isHero: true`, y en su posición de ciclo.

---

## 5. Fase U13 — La lista plegable

### 5.1 La fila colapsada (todas menos la de hoy)

Sale de `GroupedRow` (`ui/MenuList`) pero **no es `GroupedRow`**: pierde el
subtítulo de dos líneas y gana otra escala, así que se escribe en la Home como
`SessionRow`.

**Y ya no es una lista agrupada.** `getCardRadii` —radios asimétricos por
posición, 2 px de separación— supone que las filas son piezas de un bloque; aquí
cualquiera de ellas crece al desplegarse, así que **cada sesión es una tarjeta
suelta con su `radius.md` entero**.

El aire va **dentro** de la tarjeta y no entre ellas: `gap: spacing.xs2` (4) en
el grupo y **60 px de alto** por fila. Separadas y estrechas la lista parecía una
persiana; juntas y altas se leen como fichas. La de hoy suma
`marginVertical: spacing.xs2` (4) —el doble de hueco que las demás— porque es la
pieza grande y pegada a sus vecinas se leía como parte de la misma lista.

| Elemento | Regla |
|---|---|
| Fila | `backgroundColor: surface`, alto fijo **60**, `paddingHorizontal: 14`, `gap: 12`, `borderRadius: radius.md` |
| **Letra** | `textStyles.sessionGlyph` (Inter_900Black 22, tracking −0.6), `lineHeight: 22`, **ancho fijo 26**. Pendiente → `LIMA` (#b8ff00); hecha → `muted` |
| Nombre | `textStyles.sessionName` (Inter_900Black 16, tracking −0.2), **caja baja**, `flex: 1`, `numberOfLines: 1`. Pendiente → `text`; hecha → `mutedLight` |
| Meta | Inter_600SemiBold **11** en `muted`, a la derecha. Hecha → «ayer», «hace 3 d» (`relativeTime`); pendiente → «35 min» (`sessionStats().minutes`) |
| Estado | Hecha → check `LIMA` de 14. Pendiente → **nada** (§5.3.1) |
| «Adaptada» | Texto en `tint.blue70` **delante del meta**, separado por ` · ` (regla de home-sessions §3.3, que sigue viva) |

La fila baja de dos líneas a una porque el subtítulo largo («Completada hace 3
días · 5 ejercicios») se parte: la fecha se queda a la derecha y el número de
ejercicios se va al desplegable, donde están los ejercicios de verdad.

### 5.2 La tarjeta de hoy, colapsada

Misma anatomía a otra escala, sobre `accent`. **~152 px** con nombre de una
línea.

| Elemento | Regla |
|---|---|
| Tarjeta | `backgroundColor: colors.accent` (#aae216), `borderRadius: radius.md` (10), `overflow: 'hidden'` |
| Cabecera | `padding: 14px 15px 11px`, pulsable entera. Rótulo a ancho completo y debajo la fila **letra + nombre**, centrados entre sí (§5.2.1) |
| **Letra** | `textStyles.sessionGlyphXL` (Inter_900Black 34, tracking −1.6), `lineHeight: 28`, color `onAccent` (**negro**), ancho fijo **26** |
| Rótulo | `heroLabel` de `sessionPlan` en Inter_800ExtraBold **9**, tracking 2, mayúsculas, `onAccent` al **55 %** |
| Nombre | `textStyles.sessionNameXL` (Inter_900Black 24, tracking −0.8), `lineHeight: 25`, **caja baja**, `onAccent` sólido, `flex: 1`, `numberOfLines: 2` |
| **Raya** | Alto **2**, `backgroundColor: onAccent` al **85 %**, `borderRadius: 2`, `marginTop: 11`. Es la pieza que trajo el «tablón» y la única decoración de la tarjeta |
| Meta | Inter_700Bold **10**, tracking 1.1, mayúsculas, `onAccent` al 55 %, `marginTop: 10`: «7 EJERCICIOS · 55 MIN · HACE 6 DÍAS» |
| Pie | `padding: 11px 6px 6px` — **6 px laterales**, los mismos que la caja del desplegable |
| Botón | `backgroundColor: onAccent`, `borderRadius: radius.md`, `padding: 15`, texto `textStyles.btnAction` **a 13 con tracking 0.4** en `LIMA` + cheurón `›`. Los 12 del token se quedaban por debajo del resto de la tarjeta |

#### 5.2.1 Dónde va la letra, en vertical

**La letra se empareja con el nombre, no con el bloque entero.** Son la misma
cosa dicha de dos maneras —«C» y «Pierna y core»—, así que van en la misma línea:

```
HOY TE TOCA                 ← rótulo, a ancho completo
C  Pierna y core            ← la letra y el nombre, sobre el mismo suelo
────────────────────────
7 EJERCICIOS · 55 MIN · …
```

En código, el rótulo sale de la columna de texto y la letra y el nombre forman su
propia fila:

```js
headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 6 },
glyph:   { ...textStyles.sessionGlyphXL, lineHeight: 28, width: 26,
           includeFontPadding: false },
name:    { ...textStyles.sessionNameXL, lineHeight: 25, flex: 1 },
```

`flex-end` y no `center`: la letra **se apoya en el mismo suelo que el nombre**.
Y **sin un solo margen a ojo** — lo hace flexbox, así que aguanta el nombre en
dos líneas y no depende de cuánto mida el rótulo en cada plataforma.

Dos intentos antes de este, los dos descartados en el móvil y no sobre la
maqueta:

1. **Centrada contra el bloque entero** (rótulo + nombre) con 1 px de corrección
   óptica. Cuadraba en el mock; en la mano **parecía un error, no una decisión**,
   porque la letra no estaba alineada con nada.
2. **Centrada contra el nombre.** Mejor, pero a media altura sigue sin haber una
   línea que compartan.

De ahí que el rótulo suba a ancho completo, donde además se alinea con la raya,
la meta y el botón: el único elemento sangrado pasa a ser el nombre, y lo sangra
su propia letra.

`includeFontPadding: false` (aquí y en la letra de fila) es lo que hace que la
caja valga lo que dice `lineHeight` y no lo que Android le suma por su cuenta.

Se descartó emparejar la letra con el nombre e ignorar el rótulo —que
conceptualmente es lo correcto: «C» y «Pierna y core» son la misma cosa dicha de
dos maneras— porque solo se consigue con un margen fijo, y en cuanto el nombre
rompe a dos líneas la letra vuelve a quedarse arriba. `alignItems: 'center'`
**se recoloca solo** sea cual sea el nombre, que es lo que necesita una pantalla
que pinta lo que escribe otro.

El rótulo de `sessionPlan` cambia de palabras, no de mecanismo:
`home.sessionNext` pasa de **«Siguiente»** a **«Hoy te toca»** y
`home.sessionActive` se queda en **«En curso»** (§7).

### 5.3 El desplegable

Aparece bajo la meta, dentro de la misma tarjeta.

**La lista se pinta igual en los dos sitios.** Dentro de la tarjeta de hoy vive
en su caja negra, así que lleva los mismos grises que en una fila normal: no hay
variante «sobre lima». Se implementó una y era texto negro sobre negro.

**En la de hoy** — la caja negra con filo de lima (la «maqueta A» aprobada):

| Elemento | Regla |
|---|---|
| Caja | `backgroundColor: colors.bg` (#151515), `borderRadius: radius.sm` (6), `marginHorizontal: **6**`, `padding: 9px 12px` |
| Fila de ejercicio | `flexDirection: 'row'`, `alignItems: 'baseline'`, `gap: 10`, `paddingVertical: 4`. **Sin filete** |
| Índice | Inter_600SemiBold **10** en `muted`, ancho fijo 11, `fontVariant: ['tabular-nums']` |
| Nombre | Inter_500Medium **13** en `text`, `flex: 1`, `numberOfLines: 1` |
| Series | `targetLabel(..., { compact: true })` en Inter_600SemiBold **11**, `mutedLight`, tabular |

Los 6 px laterales son deliberados: el lima queda de **filo**, no de marco, y la
tarjeta se sigue leyendo como una sola pieza. El pie del botón lleva los mismos
6 px, así que caja y botón comparten margen.

**En las demás filas** — sin caja, sobre la propia `surface`:

| Elemento | Regla |
|---|---|
| Zona | `backgroundColor: surface` (el de la fila), `padding: 2px 14px 14px` |
| Raya | Alto 2, `tint.accent50`, `borderRadius: 2`, `marginBottom: 8` — la misma raya de la tarjeta grande, apagada |
| Lista | Idéntica a la de arriba, mismos tamaños y colores |
| Botón | **Contorno**: `borderWidth: 1`, `borderColor: accent`, fondo transparente, texto en `accent` a 13 con tracking 0.4, `padding: 14`, `borderRadius: radius.md`, `marginTop: 12` |

**Bloques de acondicionamiento.** Un template puede traer `blocks` además de
`exercises` ([conditioning-blocks.md](conditioning-blocks.md)). Van **después**
de los ejercicios, una línea cada uno con la misma anatomía: nombre =
`block.name ?? t('blocks.formats.' + block.format)`, y en la columna de las
series el formato en mayúsculas (`AMRAP`, `EMOM`, `FOR TIME`) en `mutedLight` —
sin la pastilla de color que usan el editor y el recap, que aquí sería un cuarto
acento. El índice sigue la numeración de los ejercicios.

**Cuántos se enseñan: todos.** No hay «+3 más». Una sesión de 12 ejercicios da
una tarjeta larga, y es la información que se pidió ver.

#### 5.3.1 Sin flecha de desplegar

La primera versión llevaba un ▾ que giraba al abrir, en la fila y en la meta de
la tarjeta de hoy. **Fuera**: en una pantalla donde *todo* se despliega, un icono
por fila no informa — solo repite. La fila hecha se queda con su check, la
pendiente con su duración, y la de hoy con su meta a secas.

Lo que sí se queda es el `accessibilityState={{ expanded }}` y el
`accessibilityHint` («Ver / Ocultar ejercicios»): con lector de pantalla el estado
hay que decirlo, aunque a la vista no haya icono.

### 5.4 Por qué la lista es así de sosa

Se maquetaron cuatro tratamientos y se eligió el más plano a propósito:

- **Sin versalitas.** La caja baja se lee más rápido y deja las mayúsculas como
  marca de la cabecera.
- **Sin filetes.** Eran una tabla que no lo es.
- **Sin lima en las series.** Dentro de la tarjeta ya hay dos usos del acento —
  la raya y el botón— y un tercero repetido siete veces le roba fuerza justo a
  lo que hay que pulsar.

El contraste entre cabecera (Inter Black, 22-34 px, negro sobre lima) y lista
(Inter Medium, 13 px, gris sobre negro) **es** lo que hace cantar a la cabecera.
Con toda la pantalla en la misma familia ese contraste lo sostienen el **peso** y
el **cuerpo** —900 contra 500, 34 px contra 13—, no la tipografía. Subir el peso
de la lista los hace competir.

### 5.5 Los tres botones

Uno por estado, y el nombre de la sesión **dentro** del botón — es el hallazgo
de la primera ronda y no se negocia: el botón dice a dónde lleva.

| Estado de la sesión | Texto | Estilo |
|---|---|---|
| Es la de hoy, sin empezar | `EMPEZAR SESIÓN C` | Relleno negro sobre la tarjeta lima |
| Es la de hoy, a medias | `CONTINUAR SESIÓN C` | Igual |
| Otra, pendiente, desplegada | `EMPEZAR SESIÓN D` | Contorno `accent` |
| **Otra, ya hecha, desplegada** | **`REPETIR SESIÓN A`** | Contorno `accent` |

«Repetir» en vez de «empezar» cuando la sesión ya está marcada como hecha en el
ciclo (`row.isDone`) es literal: no vas a empezar nada, vas a repetirla. Es lo
único de la pantalla que cambia de verbo según el estado.

Sin `template.label` (la letra) el botón cae a la forma corta —`EMPEZAR`,
`CONTINUAR`, `REPETIR`— sin nombre. La interfaz no promete lo que no tiene, la
misma regla del hero de home-sessions §5.3.

### 5.6 Comportamiento

- **Acordeón puro: solo una abierta a la vez.** Abrir cierra la que estuviera
  abierta, sea cual sea. Prototipado y aprobado.
- **Todas empiezan cerradas** al entrar en la pantalla. El estado vive en un
  `useState` de la Home (`openTemplateId`); no se persiste ni se recuerda al
  volver — es una preferencia de un segundo, no un ajuste.
- **La cabecera abre; el botón entra.** El `onPress` del botón corta la
  propagación.
- **El diálogo de «empezar fuera de orden» desaparece.** Hoy empezar una sesión
  que no toca lanza un `Alert` (`home.startOutOfOrderTitle/Desc`) porque era un
  toque accidental. Con el plegado hacen falta **dos toques deliberados** —
  abrir y pulsar un botón que además está en contorno—, así que el diálogo pasa
  a ser fricción sin motivo. **Las claves i18n se quedan** en `es.json`/`en.json`
  por si se decide volver (§9.1).
- **Descartar una sesión a medias sigue confirmándose.** Ese `Alert`
  (`workout.discardConfirm`) **no se toca**: ahí sí se pierde trabajo.
- **La sesión en curso**, se pulse donde se pulse, navega a `Workout` en vez de
  arrancar de cero. Igual que hoy.

### 5.7 La animación

Reanimated, como el resto de la app. **El patrón exacto ya existe** en
`src/components/SessionCard.jsx:239` (el acordeón de la tarjeta de historial) y
se copia de ahí:

```jsx
<Reanimated.View layout={LinearTransition.duration(240)}>
  {/* cabecera, siempre */}
  {open && (
    <Reanimated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
      {/* la lista */}
    </Reanimated.View>
  )}
</Reanimated.View>
```

El `layout` de la tarjeta anima el cambio de alto; el contenido entra y sale con
opacidad. **No** se persigue el alto con un `Animated.Value` de RN core — es
justo la mezcla que la app ya dejó atrás (memoria del proyecto y `SessionCard`).

No hay nada más animado: la flecha de desplegar no existe (§5.3.1), así que el
alto y la opacidad son todo el movimiento de la pantalla.

### 5.8 Lo que se borra de la Home

Al entrar esto, de `HomeScreen.jsx` desaparecen:

- El componente `Hero` entero y sus estilos (`hero*`).
- El bloque `<GroupedRow>` de las sesiones y `rowChevron`.
- `heroMeta` compuesto en la pantalla: la meta de la tarjeta grande se compone
  igual pero para una fila más de la lista.
- `confirmOutOfOrder` (§5.6).

`GroupedRow` **se queda** en `ui/MenuList`: la usa CONEXIONES y las hojas.

---

## 6. Cómo queda la pantalla, de arriba abajo

Nada se mueve de sitio salvo la zona de sesiones:

1. `AppHeader`
2. Tira de semana
3. Rótulo `TUS SESIONES` + contador `2 DE 4 EN ESTE CICLO` — el `subtitle` de
   `sessionPlan`, que **vuelve al rótulo** (la barra segmentada que lo iba a
   sustituir se descartó, §3)
4. Banner de etapa terminada, si lo hay
5. **La lista plegable** ← lo único nuevo
6. Botón de sesión libre
7. Tarjeta de programa

El rótulo cambia de palabra: `home.sessions` («Sesiones») pasa a **«Tus
sesiones»**. Es de la misma sesión de diseño: posesivo, porque la queja original
era que no se entendía que la lista fueran *tus días de entrenamiento*.

---

## 7. i18n

Todo en `src/locales/es.json` y `en.json`, **una clave por línea** (nunca
reformatear el archivo entero).

Nuevas:

| Clave | es | en |
|---|---|---|
| `home.btnStartSession` | `EMPEZAR SESIÓN {{label}}` | `START SESSION {{label}}` |
| `home.btnContinueSession` | `CONTINUAR SESIÓN {{label}}` | `CONTINUE SESSION {{label}}` |
| `home.btnRepeat` | `REPETIR` | `REPEAT` |
| `home.btnRepeatSession` | `REPETIR SESIÓN {{label}}` | `REPEAT SESSION {{label}}` |
| `home.rowMinutes` | `~{{minutes}} min` | `~{{minutes}} min` |
| `home.expand` | `Ver ejercicios` | `Show exercises` |
| `home.collapse` | `Ocultar ejercicios` | `Hide exercises` |

Cambian de texto (misma clave):

| Clave | Antes | Ahora |
|---|---|---|
| `home.sessionNext` | `Siguiente` | `Hoy te toca` |
| `home.sessions` | `Sesiones` | `Tus sesiones` |

Se quedan como están: `home.btnStart`, `home.btnContinue` (fallback sin letra),
`home.cycleCount`, `home.sessionActive`, `home.adapted`, `home.sessionMeta`,
`home.rowDone`.

---

## 8. Accesibilidad

- La cabecera de cada sesión es `accessibilityRole="button"` con
  `accessibilityState={{ expanded }}` y `accessibilityHint` =
  `home.expand` / `home.collapse`. A la vista no hay icono de desplegar, así que
  con lector de pantalla el `hint` es lo único que lo dice (§5.3.1).
- El botón de empezar es **otro** botón accesible, con su etiqueta completa
  («Empezar sesión C»). Es la razón por la que no se resuelve todo con un solo
  toque largo: con lector de pantalla, dos acciones necesitan dos nodos.
- La etiqueta de la fila sigue el patrón de hoy: `Sesión C, Pierna y core,
  completada / pendiente`.
- Contraste: negro sobre `accent` (#aae216) da 13:1; el negro al 55 % del rótulo
  y la meta se queda en 5,6:1 — por encima del 4,5 exigido a ese cuerpo. El
  `mutedLight` de las series sobre `bg` es el mismo par que ya usa toda la app.

---

## 9. Decisiones abiertas

### 9.1 El diálogo de fuera de orden

Se quita (§5.6). Es la única decisión de la spec que cambia **comportamiento** y
no solo forma, y la más fácil de revertir: si en dispositivo se ve que la gente
empieza sesiones que no tocaba, vuelve el `Alert` — las claves siguen ahí.

### 9.2 Cuánta lima aguanta la tarjeta abierta

Con siete ejercicios la tarjeta abierta mide ~320 px, y unos 200 son lima. Si en
el móvil resulta demasiada, la salida ya está maquetada: **la caja negra crece
hasta englobar el botón** y el botón se invierte a lima. Se prototipó (maqueta
C) y se descartó por el cambio de color del botón — pero si el problema es la
mancha, es el remedio, y solo cambia dos estilos.

### 9.3 Letra a la izquierda con nombres largos

La letra a la izquierda come 30 px de ancho al nombre. Con nombres de entrenador
largos («Full body corto de viaje») la fila podría truncar. Si pasa con datos
reales, la variante con la letra a la derecha está maquetada y es el mismo
componente con el orden de los hijos invertido.

---

## 10. Criterio de aceptación

1. Con un programa de 4 sesiones y 2 hechas, la Home enseña **cuatro filas en
   orden de ciclo**, la tercera en lima con su botón.
2. Tocar cualquier cabecera despliega sus ejercicios con series; tocar otra
   cierra la primera.
3. La sesión hecha, desplegada, ofrece **REPETIR SESIÓN A** en contorno.
4. El botón de la de hoy dice **CONTINUAR SESIÓN C** si esa sesión está a
   medias, y lleva a `Workout` sin descartar nada.
5. Al guardar la sesión de hoy, la tarjeta grande pasa al hueco de la siguiente
   y la recién hecha queda como fila gris con su check.
6. Con 6 sesiones, todas cerradas caben sin scroll hasta el botón de empezar.
7. Una sesión con bloques de acondicionamiento los lista después de los
   ejercicios, con su formato a la derecha.
8. `npx eslint src/screens/HomeScreen.jsx` no añade errores sobre HEAD, y
   `npx vitest run` pasa con los tests nuevos de `prescription` y los
   actualizados de `sessionPlan`.

---

## 11. Fases

| Fase | Qué | Coste | Estado |
|---|---|---|---|
| **U12** | Cimientos: cuatro tokens de Inter en `textStyles`, `targetLabel()` extraído a `utils/prescription.js` con su test, y `sessionPlan()` devolviendo todas las filas con `isHero` (§4). **Sin fuentes nuevas** (§4.1) | bajo | ✅ f2f79f0 |
| **U13** | La lista plegable: `SessionRow`, tarjeta de hoy, desplegable, tres botones, acordeón, animación, i18n y borrado del `Hero` (§5) | medio | ✅ f2f79f0 |

---

## 12. Maquetas

En orden de la sesión de diseño. Las dos últimas son las que mandan:

- **Cuatro Homes para una sola pregunta** (rutas A-D): <https://claude.ai/code/artifact/28cba974-3cb9-4a56-b636-a74bd3c092ca>
- **La Home A, cuatro afinados**: <https://claude.ai/code/artifact/40768373-9ed5-4dd8-a4ba-38100d5c8180>
- **Ver los ejercicios sin crecer** (lomos, baraja, tablón, pastillas): <https://claude.ai/code/artifact/1818bd35-f4cf-450d-ba71-c975139ee0d0>
- **Tablón y lomos tumbados** (los cuatro tratamientos de la cabecera + las barras): <https://claude.ai/code/artifact/3432206f-c454-4d19-9544-08e394a7cde5>
- **Todo colapsado** (los cuatro estados del plegado): <https://claude.ai/code/artifact/ad67053c-9278-41d3-b7e1-044b7028be62>
- **Izquierda o derecha** (alineación de las letras, sin barra segmentada): <https://claude.ai/code/artifact/52626b6a-53b2-4298-8a97-76919b76c721>
- **Aligerar la lista** (los cuatro tratamientos del listado; gana «limpia»): <https://claude.ai/code/artifact/4ffb7442-5fdf-4771-a377-a47b8be7e996>
- **Hoy, en lima** (la tarjeta de hoy en color, colapsada y expandida): <https://claude.ai/code/artifact/b8fba1f3-bd20-4a59-8a0e-a78f62964aa7>
- **El interior negro** (cuánto lima a los lados; gana la caja de 6 px): <https://claude.ai/code/artifact/3e353a91-f6d8-45f2-af18-e07dca24deb8>
- **Desplegar y contraer** — **el prototipo bueno**: las tres maquetas
  funcionando, con el acordeón y los dos objetivos de toque. La maqueta **A** es
  la aprobada: <https://claude.ai/code/artifact/02bae593-f523-4096-82b8-10478a04b0c3>
- **¿Hace falta la Barlow?** (la misma Home en Barlow, en Inter literal y en Inter
  reajustada; gana Inter): <https://claude.ai/code/artifact/b84f869a-b024-47ae-bc0b-9e51b7be4a90>
- **Dónde va la C** — **los valores finales**: las cuatro alineaciones verticales
  de la letra, con nombre de una y de dos líneas, y la Home entera ya solo en
  Inter: <https://claude.ai/code/artifact/edde1485-2fcc-41e7-8763-e281d79620b6>
