# Spec — Cabeceras de pantalla: una sola, y fuera de la banda accent

> Tema: ui
> En corto: La barra lima de las cabeceras estaba copiada cinco veces y se caía con nombres reales; pasa a un componente único sobre el fondo de la app, y de paso los dos últimos modales de Clientes pasan a hoja.
> Fase U10 · hecho · Cabecera única, fuera de la banda accent, y las dos hojas que faltaban en Clientes · §2
> Fase U11 · hecho · La cabecera pasa a barra: gris arriba, nombre debajo, regla segmentada · §6
>
> Estado: **U10 implementada y PROBADA EN DISPOSITIVO** (4-sep-2026): tres
> commits —`0ca9dd5` cabecera, `a0d49bc` Workout, `cd61d02` hojas de Clientes—
> dentro del merge `7188ca4`.
>
> **U11 implementada, pendiente de prueba en dispositivo** (7-sep-2026). El
> título de 25px y la regla lima de 5px de U10 se leían antes que el contenido
> en las tres pantallas donde más contenido hay; §6 cuenta las ocho variantes
> que se maquetaron y por qué gana ésta. De paso se cae el colapso en dos
> estados de Workout: sin título grande no hay nada que colapsar.
>
> Origen: no hay nodo de Figma para esto. La cabecera de Figma (`SesionHeader`,
> `110:3692`) es justo la que se sustituye — ver §4, que explica en qué se cae
> el mock al recibir el contenido que la app genera de verdad. El diseño se
> eligió sobre seis variantes maquetadas con nombres reales del generador.
>
> **Balance:** −331/+71 líneas en las cinco pantallas de la cabecera, y las dos
> hojas de Clientes se quedan sin siete grupos de estilos propios.
>
> **Verificación:** `npx vitest run` desde la raíz (1199/1199) y `npx eslint
> src/` comparando el recuento contra HEAD — hay 168 errores preexistentes, la
> regla es no añadir ninguno. Se comprobó commit a commit.

---

## 0. Qué resuelve y qué no

| Pieza | Qué hace | Toca pantallas |
|---|---|---|
| `ui/ScreenHeader.jsx` | La cabecera de detalle/editor, una sola vez | detalle y editor de programa, editor de sesión, planificador de etapas, onboarding |
| Cabecera de Workout | El mismo lenguaje, componente aparte | Workout |
| `ui/NumberChips.jsx` | Los chips de número del onboarding, extraídos | onboarding (×2), hoja de nuevo programa |
| Hojas de Clientes | Los dos últimos `<Modal>` centrados pasan a `DragSheet` | Clientes |

Lo que esta spec **no** toca, a propósito: las cabeceras de las pestañas
principales (`AppHeader`, que es otro componente y otro problema: marca y menú,
no navegación), ni las cabeceras simples de las pantallas de ajustes
(`DocsScreen`, `DriveBackupScreen`, `TrainerConnectionScreen`…), que son un
título y ya — no tienen ceja, ni acciones, ni nombre editable.

---

## 1. Por qué se cambia: la barra lima se caía en tres sitios a la vez

La cabecera anterior era una barra `accent` flotante (margen 15, radio, alto
fijo 72, título centrado entre un chevron y un `⋮`). Los tres problemas solo se
ven con contenido real: `mobile/src/data/archetypes.js` genera nombres como
**"Full Body · Hipertrofia · Barra libre"** y **"Empuje vertical, tracción y
pierna anterior"**, de 43 caracteres. Con "Hipertrofia · Pull" no se nota nada.

### 1.1 Ancho

Con el chevron a un lado y el `⋮` al otro, al título le quedaban ~250 px de los
345 disponibles, a 20 px de cuerpo. Cortaba a mitad de palabra casi siempre, y
truncar a la primera palabra no distingue "Full Body · Hipertrofia" de "Full
Body · Hipertrofia · Barra libre".

Había además un `headerTitleSpacer` invisible del ancho del lápiz, cuyo único
trabajo era que el título centrado no se descentrara — y que le robaba ancho al
nombre para conseguirlo.

### 1.2 Contraste

La ceja salía de `colors.muted`: un gris definido contra el fondo oscuro, pero
pintado encima del accent. Medido con WCAG sobre los cinco temas:

| Tema | ceja `muted` sobre `accent` | ceja `accent` sobre `bg` (hoy) |
|---|---|---|
| dark | 4.01 | 17.75 |
| midnight | **2.35** | 9.93 |
| earthy | **1.66** | 2.40 |
| space | **3.29** | 17.17 |
| formaFit | 5.47 | 11.83 |

En `earthy` era invisible. La regla general que sale de aquí está en §3.

### 1.3 Presupuesto de acento

Una losa lima arriba compite con el lima de los datos: el número de ejercicio,
el borde de la caja Resumen, el segmento activo del control. El acento se
gastaba antes de llegar al contenido, que es donde significa algo.

### 1.4 Cinco copias ya divergidas

`uppercase` sí/no, `overflow` sí/no, `justifyContent` sí/no, el lado de 26 px
contra 33 del onboarding —que hacía que su título no estuviera centrado nunca— y
el estado "programa no encontrado" de `ProgramDetailScreen` pintando la ceja con
el estilo del título, que saltaba al cargar.

---

## 2. Fase U10 — lo que se hizo

> **Ojo:** §2 es el registro de U10. Lo que hoy hay en el código es lo de §6 —
> la barra— y no el título de 25px que se describe aquí.

### 2.1 `ui/ScreenHeader.jsx`

Sobre el fondo de la app, a sangre, sin alto fijo:

- **Fila de ceja:** chevron `accent` (15) + ceja + acciones (lápiz, `⋮`, puntos
  del onboarding), todo alineado entre sí.
- **Ceja:** `spacing-tag` a 11 px, tracking 2.4, color `accent`. Fuerza
  mayúsculas en la caja porque las cadenas vienen mezcladas del JSON:
  `programView.eyebrow` ya es `"PROGRAMA"` pero `planner.eyebrow` es
  `"Planificar"` y `editor.sessionEyebrow` es `"Sesión B"`.
- **Título:** `text/hero` a 25 px, interlineado 26, tracking −0.5, color `text`,
  **a dos líneas**.
- **Regla `accent` de 5 px** a sangre, que ancla la cabecera al contenido.
  Exportada como `HEADER_RULE_H` porque Workout la necesita.
- `paddingTop: space/xxl`, que es lo que separa la cabecera de la barra de
  estado.

La solidez la da la masa tipográfica y la regla, no el bloque de color.

`right` acepta un nodo **o una función que recibe el color de tinta**. El `⋮`
del editor de sesión y los puntos del onboarding necesitan uno u otro según
sobre qué se pinte la cabecera, y así probar otra cabecera es un cambio de un
solo archivo. No es especulativo: es lo que permitió montar la variante F
entera y volver a ésta sin tocar ninguna pantalla (§4).

El estado de renombrar (`renaming`/`draft`) se queda **en la pantalla**, no
dentro del componente: `ProgramEditorScreen` lo mira desde `hasUnsavedChanges()`
para avisar al salir.

Se fueron con la barra: `HEADER_H` de `theme.js` (sin consumidores — ya no hay
alto fijo), el contrapeso invisible del lápiz y los espaciadores de 26 px de las
tres pantallas sin acción a la derecha.

### 2.2 La cabecera de Workout

**Comparte el estilo, no el código.** `ScreenHeader` no vale ahí porque esa
cabecera es sticky, colapsa con el scroll y lleva un reloj que repinta cada
segundo. Lo que viaja es el lenguaje y la constante del grosor de la regla.

Dos ajustes que pide su contexto y que la separan de las de los editores:

- **Título a una línea.** Es sticky y se come pantalla durante todo el entreno;
  la identidad la lleva la ceja ("SESIÓN A · 07:36"), así que ahí puede truncar.
- **Aire superior animado**, `space/xxl` desplegada y `space/lg` colapsada, con
  el mismo progreso que el crossfade. Fijo en 28 habría hecho que la cabecera
  colapsada arrastrase ese vacío para siempre.

**Los puntos de progreso pasan a ser la regla.** Es la única decisión
interpretativa de la fase: la regla tenía que estar de todas formas, así que el
progreso se monta encima —un segmento por ejercicio o bloque, lleno en `accent`
y pendiente al 25%— en vez de pedir fila propia. Se lee igual, sobrevive al
colapso sin duplicarse en las dos capas, y `flex: 1` por segmento sustituye los
tres saltos de gap que había que mantener a mano según hubiera 7, 12 o más
unidades.

De paso se borró `HeaderArrow`, que era una recopia local del mismo path SVG que
`ArrowIcon`.

### 2.3 Las dos hojas de Clientes

Los dos últimos `<Modal>` centrados de la pestaña. Lo pide el propio
`DragSheet.jsx`: *"úsalo para CUALQUIER modal nuevo, es el patrón único de la
app, no montes otro por tu cuenta"*.

Nuevo programa dejaba de reutilizar casi todo. Cada control tenía ya su
equivalente en el repo:

| Antes, a mano | Ahora |
|---|---|
| `tabRow` + `tabBtn` | `SegmentedControl` |
| rejilla `numBtn` de 2 a 6 | `NumberChips` |
| rejilla `numBtn` de 4/6/8/12 | `StepField`, 1-52 |
| `noLimitRow` | `ToggleRow` — es un booleano |
| `templateOption` | filas `sheetRowBase` con el tinte accent |
| `GhostBtn` + `AccentBtn` | cancelar en la cabecera de la hoja, un solo CTA abajo |

`ui/NumberChips.jsx` sale a componente porque iba por su tercer sitio: la
pregunta de días por semana y el alta manual del onboarding lo tenían escrito
entero cada uno. **El reparto con `StepField`**: chips cuando el rango es corto
y se ve entero de un vistazo, stepper cuando no caben pintadas todas las
opciones.

El conmutador de "sin límite" va **siempre arriba** y el contador aparece
debajo. Al revés, activarlo movería de sitio la fila que acabas de tocar.

Tres cosas que salieron al mover el código:

- **La etiqueta de sesiones estaba mal.** Decía "SESIONES POR SEMANA", pero
  `createProgramForClient` usa ese número para crear las sesiones distintas del
  ciclo (A, B, C…), no para repartirlas por semana. Pasa a
  `onboarding.sessionsPerCycle`, con el mismo rango 1-7 del alta manual.
- **Los textos estaban en castellano a pelo** ("NUEVO CLIENTE", "Cancelar",
  "SELECCIONAR PLANTILLA", "sesiones"…) aunque las claves i18n existían sin
  usarse. Ahora salen del JSON, con los títulos en caja de frase para que
  coincidan con las otras hojas ("Nueva entrada", "Etapa").
- **`billSheetBody` pasa a `formSheetBody`** y sirve a las tres hojas de
  formulario, en vez de un nombre de cuerpo por hoja.

El alta de cliente **sí** abre el teclado al entrar: el único campo es texto, la
hoja sube con él y queda bien. Es la excepción a la costumbre de la app, que no
usa `autoFocus` en hojas.

---

## 3. Las reglas que quedan

Son el motivo de escribir esto: sin ellas, la próxima pantalla vuelve a romperlo.

1. **Cualquier texto sobre un bloque `accent` deriva de `onAccent`, nunca de los
   tokens `muted*`.** Los `muted*` están definidos contra el fondo oscuro; sobre
   un color saturado no se leen como jerarquía sino como suciedad, y el
   contraste depende del tema (§1.2). Si hace falta jerarquía dentro del bloque,
   antes que rebajar el color conviene sacar el texto del bloque — que es
   exactamente lo que hace esta cabecera.
2. **Una cabecera de detalle/editor es `ScreenHeader`.** Si la pantalla necesita
   algo que no hace (sticky, colapso, un reloj), se copia el *lenguaje* y se
   importan sus constantes, como Workout — no se copia el componente.
3. **La regla es `HeaderRule`**, exportada junto a su grosor (`HEADER_RULE_H`).
   Segmentada si la pantalla tiene algo que contar, hairline si no; no dos
   implementaciones sueltas ni dos treses a mano.
4. **Chips contra stepper:** `NumberChips` si el rango es corto y cabe entero,
   `StepField` si no.
5. **Modal nuevo = `DragSheet`.** Ya estaba escrito en su cabecera; esta fase
   gastó los dos últimos incumplimientos.

---

## 4. Lo que se descartó, y por qué

Se maquetaron seis variantes sobre la paleta y la tipografía reales. Tres
pasaron el primer corte (B, D, F) y se llevaron a las cinco pantallas con
nombres del generador. Ahí se decidieron solas:

- **B — bloque partido** (columna negra de volver, costura dura negro/lima).
  La más contundente de las tres, y la que menos sitio deja al dato: el bloque
  de volver (52) más el del menú (44) se comen 96 px de los 345, así que el
  título tiene que bajar a 19 px. La que parecía más maciza era la que menos
  ancho daba.
- **F — solo título** (pastilla negra de volver, sin ceja, título a 27 px).
  Pierde información en el editor de sesión: la ceja dice `SESIÓN B ·
  INTENSIFICACIÓN` y ni la letra ni la etapa están en ningún otro sitio de la
  pantalla. Y la pastilla dice a dónde vuelves, no dónde estás, así que en el
  editor de sesión pone "← EDITAR PROGRAMA" mientras editas una sesión. Es la
  única de las tres que necesita que le expliques la regla.
  Se llegó a implementar entera para verla en el móvil, y se descartó ahí.
- **D — la elegida.** Es la única que no negocia nada en las cinco pantallas:
  lápiz, `⋮` y puntos del onboarding caben en la misma fila de ceja sin mover el
  título, y el título tiene el ancho entero. Efecto no previsto que se confirmó
  en dispositivo: al quitar la masa lima de arriba, el lima de los datos deja de
  competir y empieza a leerse como jerarquía.

El chevron flotando en medio de un bloque de color —que es lo que hacía la
cabecera de Figma— era el detalle que delataba lenguaje de navbar de iOS en una
app que no lo es. Las tres variantes lo resuelven dándole superficie propia o
quitándolo; D lo mantiene pero fuera del bloque, alineado con la ceja.

---

## 5. Lo que queda abierto

**El accent de `earthy`.** Da 2.40:1 contra su propio fondo (`#6a9458` sobre
`#dbd5c8`). Esta cabecera **no lo introduce** —es el mismo par que ya usan
`statValue`, `summaryTag` y `rowNum` en toda la app— pero cualquier texto
pequeño en accent es flojo ahí hasta que se oscurezca el accent de ese tema. Es
un arreglo de paleta, no de cabecera, y toca todas las pantallas.

**El borde de la barra de estado.** La cabecera arranca por debajo porque el
inset lo siguen poniendo las pantallas (`SafeAreaView edges={['top']}`). Si
alguna vez se quiere que el fondo llegue al borde físico, es meter `insets.top`
dentro de `ScreenHeader` y sacar ese borde de las cinco. No se hizo porque con
la variante D no se nota: su fondo es el mismo `bg` que hay encima.

---

## 6. U11 — de título grande a barra

U10 quitó la losa lima y dejó una cabecera de ceja + título de 25px Black +
regla lima de 5px. Funciona, pero en el editor de programa, el onboarding y el
entreno —las tres pantallas con más contenido— **la cabecera se lee antes que el
contenido**. Dos motivos concretos, los dos medibles:

- **Masa tipográfica.** 25px Black con interlineado 26 es más tinta que
  cualquier cosa de la pantalla, incluido el nombre del ejercicio que estás
  haciendo (17px).
- **Presupuesto de acento otra vez.** La ceja en `accent` más la regla de 5px
  son dos usos de lima antes de llegar al primer dato.

Y una tercera cosa que no era de peso sino de affordance: **el chevron dibuja
9px de ancho**. Tiene `hitSlop` de sobra, pero nada dibujado dice que se pulse.

### 6.1 Lo que se maquetó

Ocho variantes a tamaño real con la paleta, la tipografía y los **nombres que
genera `archetypes.js`** — que es lo que tumbó ya dos cabeceras (§1.1). En dos
rondas: cuatro direcciones (barra fija, título grande que colapsa, losa de
`surface`, barra + tira de estado) y, con lo que salió de la primera, cuatro
correcciones. Las descartadas y el porqué:

| Variante | Por qué no |
|---|---|
| Barra fija con título centrado y `‹ Programas` | La aritmética la mata: la etiqueta del destino ocupa 80 de los 345, y **centrar recorta por los dos lados a la vez** — al título le quedan ~180 (26 caracteres) para nombres de 43 |
| Título grande que colapsa (patrón iOS) | Resuelve el ancho pero mantiene la masa: 112 de alto en reposo y animación en tres pantallas para volver justo a la barra que se elige aquí. Camino largo al mismo sitio |
| Losa sobre `surface` con la tira de contexto | La mejor separación cabecera/contenido de las ocho, pero ~130 de alto y obliga a subir el selector de etapas fuera del scroll. Queda anotada por si alguna vez hace falta el estado fijo arriba |
| Barra + tira de estado en `surface2` | Dos bandas que mantener alineadas en tres pantallas, y la acción principal en la tira compite con el CTA del final del scroll |
| Todo en una línea (`EDITAR PROGRAMA · Fuerza 4 días`) | La más baja y la más limpia, pero **ata el ancho del nombre a la longitud de la cadena de identidad**: "EDITAR PROGRAMA" con tracking 2.4 se come 142 de los 286 y deja ~17 caracteres. Volvería a caerse sola en cuanto alguien escriba una ceja larga en el JSON |

### 6.2 La elegida

Una barra de **56** de alto, alineada a la izquierda:

- **Botón de volver en caja** de 32×32, `radius.md`, sobre `surface2`, con el
  chevron `accent` de 15. Sin etiqueta de destino: lo que dice "esto se pulsa" es
  la caja, y la etiqueta costaba 80px de ancho del nombre. Es el **único accent
  del cromo**.
- **Ceja arriba, en `mutedLight`** (`card-type` tal cual: 12 / 800 / +1.2,
  mayúsculas). Es "dónde estás", y va primero porque es el orden en que se lee:
  primero te sitúas, luego lees qué es esto. Es el token de los tags "SESIÓN X",
  que son esta misma clase de etiqueta; a 10 no aguantaba ir primero.
- **Nombre debajo**, Inter ExtraBold 16, tracking −0.2, `text`, **una línea**.
  16 es el tamaño de `text/Exercice`: a 14 el nombre pesaba menos que el propio
  contenido de la pantalla. Con 286 disponibles caben ~32 caracteres, y los que
  se pasen truncan a propósito — el número de caracteres va a limitarse al
  crear. Dos líneas se descartaron porque harían que la barra cambiase de alto
  según el programa que abras.
- **Acciones a la derecha en `mutedLight`** — el render-prop `right` ahora
  recibe esa tinta, no el accent.
- **`HeaderRule`**: la regla de cierre, exportada. Con `progress` (un booleano
  por unidad) sale partida en segmentos de 3px, lleno en `accent` y pendiente al
  25%; sin él, hairline de 1px de `border`. Un segmento por ejercicio en el
  entreno y **uno por pregunta en el onboarding**, que es lo que sustituye a los
  tres puntos del hueco de acciones. Por eso la ceja del onboarding se queda
  sólo con "NUEVO PROGRAMA": el "2 de 3" ya está dibujado.

### 6.3 Lo que se cae con ella

- **El colapso en dos estados de Workout, entero.** Existía porque la cabecera
  desplegada medía 68 y se comía pantalla durante todo el entreno. La barra mide
  poco más que la compacta (56 contra 38), así que se van el crossfade, la histéresis, las
  dos capas, el `onScroll` y las seis constantes de alto. Se queda `HEADER_H`,
  que sólo sirve para el desplazamiento del teclado.
- **El fundido de 20px bajo la cabecera** (`SCROLL_FADE_H` y su gradiente SVG).
  Tapaba el corte seco del contenido con la cabecera colapsada; sin colapso no
  hay nada que tapar, y **la regla ya marca el límite** — que es justamente la
  frontera cabecera/contenido que se busca.
- **`ProgressRule` de WorkoutScreen**, que pasa a ser `HeaderRule`, y los tres
  puntos del onboarding con sus dos estilos.

**Probar en dispositivo.** Las tres pantallas con datos reales: que el nombre
largo trunque y no empuje al icono de notas fuera, que la regla del onboarding
avance al pasar de pregunta, y que el teclado del campo de peso siga dejando la
fila activa visible en Workout (cambió `keyboardVerticalOffset`).

---

## 7. U16 — el límite de 25 caracteres

§6 dejó escrito que el nombre "va a limitarse al crear" y calculó ~32 sobre el
ancho de la barra. Ese es el techo. El suelo lo pone otra pantalla: la sesión de
hoy de la Home va a 24px Black **sin `numberOfLines`**, y ahí sólo caben ~20 en
una línea. **`NAME_MAX = 25`** (`src/utils/names.js`) se queda entre las dos: un
nombre en lo alto del rango puede partir la tarjeta de hoy en dos líneas, y ese
es el precio aceptado por dejar sitio a escribir algo que se entienda.

**Al escribir.** `ui/NameField.jsx` envuelve el input que ya había —no trae caja
propia: las hojas usan `sheetInput` y el onboarding `textInput`, que no son el
mismo token— le reserva 44px a la derecha y cuelga ahí el contador (`smallBold`,
`mutedLight`, rojo si se pasa). Va en los seis campos donde se teclea un nombre:
plantilla nueva y nombre de la copia al asignar (`ProgramScreen`), programa en
blanco y desde plantilla (`ClientsScreen`), nombre manual y copia de plantilla
(`OnboardingScreen`). El séptimo es la propia cabecera, que no puede llevar
`NameField`: el input llega hasta las acciones y la barra es de 56, así que el
contador se pinta **en el hueco de acciones y sólo mientras renombras**.

**`maxLength` es `max(NAME_MAX, longitud actual)`, no 25.** En Android un `value`
más largo que `maxLength` se recorta al editar, y hay nombres de antes del
límite —importados, del entrenador, de programas viejos— que no son del usuario
para perderlos sin avisar. Con el máximo abierto a lo que ya hay, esos nombres
se acortan pero no se alargan, y en cuanto bajan del límite vuelve a mandar él.
El contador enseña `37/25` en rojo mientras tanto: dice la verdad en vez de
bloquear.

**Y los nombres que reparte la app.** El límite no vale nada si el generador
entrega nombres de 43: abrir el lápiz enseñaría `43/25` sin haber escrito nada.
Los 26 nombres de `src/data/archetypes.js` que se pasaban están reescritos, y un
test lo sostiene (`src/utils/names.test.js`).

- **Programas**: los que no caben pierden el **objetivo**, no la variante.
  "Hipertrofia" lo comparten 9 de los 11 arquetipos y el `summary` de la tarjeta
  de propuesta ya lo cuenta; lo que distingue una plantilla de otra en la lista
  es la variante. `Full Body · Hipertrofia · Barra libre` → `Full Body · Barra`,
  `Push / Pull / Legs · Hipertrofia` → `PPL · 6 días` (y su hermana a `PPL · 3
  días`, que además pone las dos en el mismo eje).
- **Sesiones**: se quedan con los dos patrones que mandan en el día — el resto
  ya está en la lista de ejercicios, que se ve justo debajo del nombre en todas
  las pantallas donde aparece. `Empuje vertical, tracción y pierna anterior` →
  `Empuje · pierna`. De paso cae "Tirón", que no estaba en el vocabulario del
  resto de plantillas: ahora todas dicen "Tracción".

El catálogo se reescribió con 20 en la mano y se queda como está aunque el
límite acabara en 25: a 25 volverían **algunos** de los originales
(`Full Body · Hipertrofia`, 23) y no otros (`Full Body · Hipertrofia · Barra
libre`, 37), y la familia quedaría a medias —unas con objetivo y otras sin él—,
que es peor que el esquema entero. Los 5 caracteres de más son para lo que
escriba el usuario.
- **Copias**: `copyName()` recorta la base y **nunca el sufijo** — sin `(copia)`
  dos filas seguidas no se distinguen, que es justo lo que la copia necesita
  decir. El corte se lleva la palabra que parta por la mitad: `Upper/Lower ·
  Barra` → `Upper/Lower (copia)`, no `Upper/Lower · Bar (copia)`.

**Lo que se queda fuera.** El nombre de **etapa** (`Etapa 1`, el campo de la hoja
de ajustes) no lleva límite: no es un programa ni una sesión y no aparece en la
tarjeta de hoy. Y las **entradas de fuera** —importar, sync del entrenador— no
se capan al entrar: se muestran enteras y sólo se pueden acortar al editarlas.

---

## Fases

| Fase | Qué | Estado |
|---|---|---|
| **U10** | Cabecera única fuera de la banda accent (§2.1), mismo lenguaje en Workout (§2.2), las dos hojas de Clientes (§2.3) | ✅ `0ca9dd5` · `a0d49bc` · `cd61d02` (merge `7188ca4`) — 4-sep-2026, probada en dispositivo |
| **U11** | La cabecera pasa a barra de 56 (§6.2), `HeaderRule` compartida, y fuera el colapso de Workout (§6.3) | ✅ 7-sep-2026 — pendiente de prueba en dispositivo |
| **U16** | `NAME_MAX = 25` al escribir (§7), contador en el campo, y los nombres de arquetipo reescritos para caber | ✅ 9-sep-2026 — pendiente de prueba en dispositivo |
