# Spec — La Home gira sobre la sesión, no sobre el programa

> Tema: ui
> En corto: El banner lima deja de ser del programa y pasa a ser la sesión que toca; el programa baja a una tarjeta que se comparte con la ficha de cliente, y las tres frases que dan por hecho que entrenas rotando salen de la pantalla a una función.
> Fase U06 · hecho · Rediseño de la HomeView: hero, lista agrupada, semana desnuda · §3
> Fase U07 · hecho · `ProgramCard` compartida con `ClientsScreen` · §4
> Fase U08 · hecho · `sessionPlan()`: rótulo, marcador y contador fuera de la pantalla · §5
> Fase U09 · hecho · Plantillas de sesión libre · §7
>
> **Probar en dispositivo.** El acento pasa a estar en pantalla todos los días
> (antes marcaba «programa activo», ahora «te toca entrenar»). Hay que mirar si
> cansa con uso real y si el hero se distingue del bloque de programa a media
> distancia. Es lo único de esta spec que no se puede decidir sobre el mock.
>
> **Probar en dispositivo.** Con el bloque de programa al final, el nombre del
> programa deja de verse al abrir la app (hay que bajar ~500 px). Comprobar si
> molesta en uso diario o si da igual porque ya sabes qué programa llevas.
>
> **Superada en parte (sep 2026) por dos specs**, que se llevan cuatro §: el
> hero (§3.2) y las filas de las demás sesiones (§3.3) van a
> [home-sesiones-plegables.md](home-sesiones-plegables.md), y la anatomía de la
> tarjeta con su pie de acciones (§4.2, §4.3, §4.7) a
> [program-card.md](program-card.md). Queda como registro. **El resto sigue
> vigente**: la semana (§3.1), el hallazgo de la convergencia y lo que la tarjeta
> deja distinto a propósito (§4.1, §4.4-§4.6), `sessionPlan()` (§5 — cambia solo
> en que ya no saca el hero de `rows`), los modos (§6) y la sesión libre (§7).
>
> Estado: **todas las fases implementadas** (sep 2026, U06/U07/U08 en 97ae57d y
> U09 en 94e77f6), a falta de las dos pruebas en dispositivo de arriba. **Las plantillas
> de sesión libre de §7 (U09) las sustituye [free-sessions.md](free-sessions.md)** (T19-T23). Sale de una sesión de
> diseño Opus + usuario sobre la zona de sesiones de la Home: seis rondas de
> maquetas, cada corrección del usuario sobre la anterior. Las decisiones están
> cerradas y los valores son exactos; lo que faltaba era escribirlo.
>
> Depende de que la Home ya esté migrada a FormaFit (lo está, ver
> `docs/UI-MIGRATION.md`) y de `AssignedProgramCard`, que ya existe y está
> migrada. **No depende de ninguna feature nueva** salvo tres métricas que hoy
> solo se calculan del lado del entrenador (§4.3).
>
> Problema que resuelve: en la Home de hoy **las sesiones completadas son lo
> más llamativo de la lista** (fondo `tint/accent-10` + borde `accent-50`) y la
> siguiente —la única accionable— va sobre `surface` plano igual que las
> futuras. La jerarquía está invertida: la vista atrae primero hacia lo que ya
> no hay que hacer.

---

## 1. Concepto

Se invierte el orden de importancia de la pantalla. Hasta ahora mandaba el
programa (banner lima, la pieza más elaborada del mock de Figma) y las sesiones
eran una lista debajo. A partir de aquí:

| # | Qué | Tratamiento |
|---|---|---|
| 1 | **La sesión que toca** | Bloque acento, único elemento en color de la pantalla |
| 2 | **Las demás sesiones** | Tabla de filas planas bajo el hero |
| 3 | **Semana entrenada** | Tira desnuda arriba del todo, sin caja ni rótulo |
| 4 | **Programa, autor, etapa y ciclo** | Una tarjeta al final, compartida con la ficha de cliente |

La consecuencia más grande: **el banner desaparece como pieza**. Sus cuatro
datos (nombre de programa, número de ciclo, puntos de sesión, barra de etapa) se
reparten entre el hero y la tarjeta de programa. Ninguno se pierde. Ver §8, que
es lo que hay que aprobar contra Figma.

### 1.1 Regla del acento

Antes: `accent` marcaba «programa activo» (banner) y «sesión completada»
(fondo + borde de la tarjeta).

Ahora: **`accent` marca «esto es lo siguiente»**, y nada más. Las sesiones
completadas conservan el check lima y pierden fondo y borde. Es la decisión que
más se aparta del mock y la que arregla la jerarquía invertida.

---

## 2. Lo que se descartó por el camino

Se probaron seis estructuras antes de esta. Se dejan aquí para no volver a
proponerlas:

| Idea | Por qué no |
|---|---|
| **Solo restyle** (hero más alto, done apagada, orden fijo) | Funciona, pero no resuelve «que se vea que es la zona de entreno»: sigue siendo una lista de cinco barras iguales |
| **Agrupar por estado** (siguiente / resto / completadas) | Rompe el orden fijo A→F, que es una decisión ya cerrada |
| **Stepper horizontal del ciclo** (5 pastillas + panel) | Comprime muy bien pero **esconde cuatro nombres de sesión detrás de cuatro letras**; en una app donde las sesiones se llaman «Pierna completa» eso es inaceptable |
| **Recorrido vertical** (línea que conecta las 5, nodo con halo) | Gustó, pero la línea **insinúa un orden obligatorio que el ciclo no tiene** (puedes hacer la D antes que la C) y come 22 px de ancho en todas las filas |
| **Panel contenedor rotulado ENTRENAMIENTO** | «Entrenamiento» es vocabulario nuevo; la app dice sesión, ciclo, etapa, programa |
| **Fila de 3 datos del onboarding** (`StatsRow`: ETAPA / CICLO / AVANCE) | Elegante y con cero tokens nuevos, pero pone **tres números en `accent` a 22 px justo encima del hero**, y los pips son binarios donde la barra segmentada es gradual |

---

## 3. Fase U06 — La HomeView

Orden de la pantalla, de arriba abajo:

```
AppHeader (logo · fecha · menú)
Semana                      ← tira desnuda
SESIONES · 2 de 5 este ciclo
[hero]
[filas de las demás]
[＋ SESIÓN LIBRE]
[ProgramCard]               ← §4
CONEXIONES
```

Se elimina la sección `PROGRAMA` del final (los botones EDITAR / VER / ···):
pasa al pie de la `ProgramCard`.

### 3.1 La semana

Sin caja, sin rótulo y sin contador: las dos filas del `WeekSelector` actual
(letras + puntos), `paddingHorizontal: spacing.xl`, `paddingVertical: 9`.

Se probó a meterla en una caja con rótulo «ESTA SEMANA» y un contador
«2 ENTRENOS»; el usuario lo rechazó. **Si en algún momento se quiere recuperar
ese contador, hay que dárselo de otra forma** — al quitarle la caja se fue con
ella.

Hoy sigue marcándose solo con la letra en lima, no con el punto (regla ya
cerrada, en la cabecera de `WeekSelector`).

### 3.2 El hero

Sustituye a la Sesion Card de la sesión que toca. **No es una tarjeta más de la
lista: se extrae de ella.** Las demás conservan su orden alfabético (A, B, D, E
cuando la hero es la C), así que ninguna cambia de sitio al completarse — la
regla de orden fijo se respeta, solo que la elegida no está en la lista.

Valores exactos, ya afinados en dos rondas:

| Pieza | Valor |
|---|---|
| Contenedor | `colors.accent` (#aae216, el relleno sólido — **no** el lima #b8ff00), `radius.lg`, `padding: spacing.lg` |
| Fila superior | «SIGUIENTE · SESIÓN C» en un solo `Text` (`Inter_900Black` 10, tracking 2.2, uppercase): el papel en `onAccent` al 62%, la sesión en `onAccent` sólido. El tag suelto de la derecha se cayó en QA — ver abajo |
| Nombre | línea limpia, sin prefijo: `marginTop: spacing.md`, `textStyles.hero` (**20 px** `Inter_900Black`, line-height 1.05, tracking −0.5) en `onAccent` sólido |
| Meta | 12 px `Inter_600SemiBold`, `onAccent` al 62%, **`marginTop: spacing.sm`** |
| Botón | `onAccent` sólido, `radius.md`, `padding: 15px spacing.lg`, `marginTop: spacing.lg`; texto `btnAction` en **lima** + chevron |

El nombre empezó en 27 px, bajó a 22 y acabó en 20 —dos correcciones del
usuario, la segunda ya sobre el dispositivo—. 20 es además el token `text/hero`:
el mismo cuerpo que el nombre de programa y el número de ciclo de la
`ProgramCard`, no un tamaño intermedio inventado.

**El tag «SESIÓN C» de la derecha desaparece: la sesión se dice en el rótulo.**
Arriba a la derecha, en 10 px al 50% sobre el lima, no se leía; y era la pieza que
menos trabajaba del hero, porque ocupaba una esquina para decir una letra.

Tres intentos hasta dar con el sitio, y los dos primeros se anotan porque los dos
parecían razonables:

1. **La letra delante del nombre**, al 55% para prefijar sin competir. Sobre el
   lima se leyó **gris y apagada** — el mismo defecto que se venía a arreglar.
2. **La letra delante del nombre en tinta sólida**, con el punto a media altura
   de separador. Se lee, pero le come el arranque de la línea al nombre, que es
   lo único que el hero tiene que decir a media distancia.
3. **La sesión dentro del rótulo**: `SIGUIENTE · SESIÓN C`. Es exactamente la
   línea `ETAPA 2 · VOLUMEN` de la `ProgramCard` —papel a media tinta, dato en
   tinta sólida, punto a media altura entre los dos— así que no estrena forma
   ninguna, y **el nombre recupera su línea entera**.

⚠️ **`Inter_900Black` es el peso más alto que carga la app** (App.js), así que a
20 px no hay nada más pesado que pedirle al nombre. Lo que queda para ganar
cuerpo es apretar —tracking −0.5, interlineado 1.05—, y si aun así se quiere más
peso el único camino es subir otra vez el tamaño. Y el subtítulo bajó de `spacing.md` a `spacing.sm` para que
nombre y meta se lean como un bloque. **El botón no se toca**: es la pieza más
pesada del hero y así debe seguir.

La meta line lleva `{n} ejercicios · ~{min} min · última {rel}`, con los dos
primeros de `sessionStats()`, que ya existe.

Estados del hero:

| Estado | Rótulo | Meta | Botón |
|---|---|---|---|
| Siguiente | `Siguiente · Sesión C` | ejercicios · min · última vez | `EMPEZAR` |
| En curso | `En curso · Sesión C` | `3 de 6 ejercicios · empezada hace 42 min` | `CONTINUAR` |
| **Sin hero** | — | — | — (§5.3) |

Son **tres y no más**. Ver §3.2.1: el «ciclo cerrado» que había aquí no existe.

#### 3.2.1 No hay estado de «ciclo cerrado» — y la sesión A nunca lo lleva

Una versión anterior de esta spec daba un cuarto estado al hero: «Ciclo 07
completo · 5/5 · EMPEZAR SESIÓN A». **Es imposible**, y además rompía una cosa:
si la A siempre viniera envuelta en «ciclo completado», la sesión A no tendría
nunca su hero normal.

El flujo real, leído en `advanceCycle` (`src/utils/stageProgress.js`):

```js
const cycleClosed = cycleIds.size >= valid.size;
return {
  cycleCompletedIds:   cycleClosed ? [] : [...cycleIds],   // ← se vacía aquí
  stageWeeksCompleted: (…) + (cycleClosed ? 1 : 0),
  totalWeeksCompleted: (…) + (cycleClosed ? 1 : 0),
  …
};
```

Guardar la quinta sesión **cierra el ciclo y lo vacía en la misma escritura**.
Nunca hay un momento con las cinco hechas: al volver a la Home el contador dice
«0 de 5 este ciclo», la tarjeta dice `CICLO 08`, y **A es el hero normal, con su
rótulo «Siguiente» y su botón EMPEZAR**. Igual que cualquier otro día.

Consecuencias, y las tres importan:

1. **La sesión A no tiene un tratamiento especial.** Ni ella ni ninguna: el
   hero depende del papel, no de la letra.
2. **El «has cerrado el ciclo» es del recap**, no de la Home. Es un momento,
   no un estado — cuando el usuario vuelve, ya está en el siguiente.
3. **El único «algo terminó» que persiste en la Home es la ETAPA**
   (`stageAdvancePending`), y ya está implementado: el banner de
   `HomeScreen.jsx:738`, con sus dos variantes (etapa completada / siguiente
   bloqueada por el entrenador). Va **encima** del hero y no lo sustituye —
   la sesión que toca sigue siendo la que toca. Su botón va en outline
   (`accent-50` + texto `accent`), no relleno, para no competir con EMPEZAR.

⚠️ Es la tercera vez en este proyecto que una suposición sobre los datos se cuela
en una spec propia sin verificarla contra el código. Se detectó en QA de maqueta,
no antes de escribirla.

### 3.3 Las filas de las demás sesiones

**Es la lista agrupada que la app ya tiene**, la de la lista de ejercicios de
Progreso (`ProgressTab.jsx`, `exRow` + `getCardRadii`) y la de `ui/MenuList`.
No se inventa nada: filas sueltas con `gap: spacing.xs` (2 px de fondo de
pantalla entre ellas) y **radios asimétricos por posición** — la primera
redondea arriba a `radius.md` y abajo a `xs`, la última al revés, las del medio
a `xxs`. El grupo se lee como un bloque sin necesitar una caja que lo contenga.

```
┌ A   Empuje pesado                              ✓ ┐   ← md md / xs xs
│     Completada hace 3 días · 5 ejercicios        │
├ B   Tirón pesado                               ✓ ┤   ← xxs
│     Completada ayer · 5 ejercicios               │
├ D   Empuje volumen                             › ┤
│     Adaptada · 5 ejercicios · ~44 min            │
├ E   Tirón volumen                              › ┤   ← xxs xs / md md
└     5 ejercicios · ~40 min                       ┘
```

Anatomía: la de `exRow`, más el hueco de marcador que `MenuRow` ya reserva para
el icono.

| Elemento | Regla |
|---|---|
| Fila | `backgroundColor: surface`, `padding: spacing.md spacing.lg`, `gap: spacing.lg`, `overflow: hidden` + `getCardRadii(th, isFirst, isLast)` |
| **Marcador** | Ancho fijo **20 px** (el hueco de icono de `MenuRow`), `Inter_900Black` 13, tracking .5. Pendiente → `lima`; hecha → `muted`. **Sin caja, sin fondo, sin borde** |
| Nombre | `textStyles.cardType` a **13 px** en `text` — **el mismo color en hecha y en pendiente** |
| Subtítulo | `textStyles.tag` a **11 px** en `mutedLight`, `gap: spacing.xs` bajo el nombre. Hecha → «Completada hace 3 días · 5 ejercicios»; pendiente → «5 ejercicios · ~44 min» |
| «Adaptada» | **Texto en `tint.blue70` al principio del subtítulo**, no una pastilla |
| Acción | A la derecha: check lima (hecha) o el chevron `›` de 18 px de `exRow` (pendiente) |

Lo que aporta sobre la versión con filete que había antes:

- **El filete gris desaparece.** Era un elemento que no significaba nada y que
  no existe en ninguna otra lista de la app. Los 2 px de separación son fondo
  de pantalla, no una línea.
- **La fila es de dos líneas**, así que cada sesión dice lo que es sin pelear
  por el espacio horizontal. Antes «hace 3 días» iba apretado contra el borde
  derecho.
- **Conexiones entra en el mismo grupo** con la otra anatomía de la misma lista
  (`MenuRow`: etiqueta 14, sub 11, estado con punto a la derecha), así que la
  pantalla acaba con **un solo tipo de lista repetido dos veces**.

Decisiones de estado ya cerradas — conviene no deshacerlas:

1. El check estaba a la izquierda ocupando un hueco que en las filas pendientes
   **no llenaba nada**. Se fue a la derecha, con el chevron — que además es la
   regla de Figma para las Sesion Cards: la zona de acción siempre acaba en el
   mismo punto sea cual sea su contenido.
2. El marcador fue un chip de 24×24 con fondo `accent-10` (pendiente) o borde
   (hecha). El usuario lo rechazó: **«cambios de fondo raros»**. Fuera la caja;
   el color de la letra basta.
3. La pastilla azul de ADAPTADA pasó a ser texto. Menos ruido, y el azul sigue
   significando entrenador.
4. **El nombre no cambia de color** entre hecha y pendiente. Lo que distingue
   es el marcador, el icono de la derecha y lo que dice el subtítulo. Menos
   variación, y la lista se lee como una sola cosa.

El ancho fijo de 20 px del marcador es lo que mantiene el borde izquierdo
alineado en las cuatro filas, y de paso **aguanta tres caracteres** sin tocar
nada — ver §5.2.

**Extracción:** la fila sale a `ui/MenuList` como `GroupedRow`, **no a un
`ui/GroupedList` nuevo**: el grupo, el `gap: spacing.xs` y `getCardRadii` ya
vivían ahí, y CONEXIONES es la otra anatomía (`MenuRow`) de esa misma lista, así
que un archivo aparte habría duplicado el contenedor para no compartir nada.
**En la ficha de cliente NO se usa** — ver §4.5.

---

## 4. Fase U07 — `ProgramCard` compartida

> ⚠️ **La anatomía de abajo (§4.2), su pie de acciones (§4.3) y la extracción
> (§4.7) están superadas por [program-card.md](program-card.md)** (sep 2026): la
> tarjeta perdió la banda de dos tonos, las cajas de las cifras y el pie, y la
> `StageSegBar` que se cita aquí está borrada. Lo que sigue vigente de esta fase
> es el **hallazgo** —que las dos pantallas ya tenían la misma tarjeta— y lo que
> se decidió dejar distinto entre ellas (§4.4-§4.6).

### 4.1 El hallazgo

`AssignedProgramCard` (`ClientsScreen.jsx`, tab Programa) **ya es esta tarjeta**:
mismo bloque nombre + ciclo, misma `StageSegBar`, mismas acciones, misma sección
de próxima sesión. Las dos pantallas convergían sin saberlo.

Gana la de clientes casi entera, y no por gusto: está implementada, migrada a
FormaFit y pasada por QA, y su cabecera a dos tonos (`surface2` arriba,
`surface` abajo) no es invento suyo — es el patrón de la tarjeta de ejercicio
del workout.

Y resuelve gratis la única pérdida real del rediseño: **el número de ciclo**. Al
desmontar el banner el «07» se había quedado en texto pequeño; en la tarjeta de
clientes vive donde debe, arriba a la derecha, a 20 px en `accent`.

### 4.2 Anatomía (la de `apCard`, sin cambios)

```
┌ surface · radius.lg · overflow hidden ─────────────┐
│ apHead — surface2, py 14 px 16                     │
│   TU PROGRAMA                           CICLO      │  spacingTag mutedLight
│   Hipertrofia AF                           07      │  hero 20 · text / accent
│   ● por Marcos Ruiz                                │  ← solo variante self
│ apBody — pt 14 px 16 pb 16                         │
│   ETAPA 2 · VOLUMEN              Ciclo 3 de 4      │  spacingTag / subtitle
│   StageSegBar                                      │
│   ┌ bg ────┐┌ bg ────┐┌ bg ────┐   marginTop lg    │
│   │ 87%    ││ 1.2    ││ +8%    │   cardTitle text  │
│   │ADHER.  ││RITMO   ││CARGA   │   spacingTag muted│
│   └────────┘└────────┘└────────┘                   │
│ apFoot — borderTop border                          │
│   EDITAR  │  VER PROGRAMA  │  ⋯                    │
└────────────────────────────────────────────────────┘
```

Dos variantes:

| | `self` (Home) | `client` (ficha de cliente) |
|---|---|---|
| Eyebrow | `Tu programa` | `Programa asignado` |
| Línea de autoría | `● por {entrenador}` en **azul**, solo si el programa viene de uno | no existe — el entrenador *es* el autor |

**El azul es la regla de siempre**: azul = entrenador, sin excepciones. Sin
entrenador detrás la línea no existe y la tarjeta encoge; no se rellena con
«creado por ti» ni nada parecido (petición explícita del usuario).

### 4.3 Lo único que cambia de la tarjeta

**El pie de acciones se mete dentro.** Hoy en clientes son tres botones sueltos
bajo la tarjeta (`apBtn`, alto 44 sobre `surface2`). Pasan a un pie de tres
celdas divididas por el mismo filete que separa las columnas de datos, con
`borderTop` sobre `colors.border`, alto 46, texto `cardType` en `text` y el `⋯`
en `mutedLight` sobre una celda fija de 52.

Razón del usuario, literal: **«le da un sentido de pertenencia, es más fácil
saber qué se ve y qué se edita»**. Sueltos debajo podían leerse como acciones de
pantalla, no del programa. Aplica a las dos pantallas.

**La Home tiene que calcular sus propias métricas.** Adherencia, ritmo y carga
salen de utils que ya existen (`trainingLoad.js` y la adherencia de clientes),
pero hoy solo se computan del lado del entrenador. **Es la única pieza de lógica
nueva de toda la convergencia.** El efecto secundario es bueno: el atleta ve de
sí mismo exactamente las tres cifras que su entrenador ve de él, sin panel
oculto.

### 4.4 Lo que se queda distinto a propósito

La sesión siguiente. En la Home es un **hero en acento con EMPEZAR**; en
clientes sigue siendo una **ficha con «Preparar»** en `accent-10`. El acento
marca la acción principal de cada pantalla, y en clientes esa acción se hace una
vez por semana: un hero ahí estaría gritando.

Lo que sí sube de la Home a clientes es solo el **marcador de letra**. La lista
agrupada no: ver §4.6.

### 4.5 En la ficha de cliente NO hay sesiones

Ni la lista agrupada ni un resumen. **El entrenador no puede pulsar esas
sesiones** —no va a entrenarlas— así que cualquier cosa que las pinte solo
empuja hacia abajo lo único que sí va a tocar, que son los ajustes del programa.

Se probaron las dos y se descartaron las dos:

1. La **lista agrupada** entera, la misma que la Home. Cuatro filas de dos
   líneas ocupando media pantalla para algo que no se pulsa.
2. Una **línea de resumen** dentro de la tarjeta (`A✓ B✓ C D E`). Cabía, pero
   sobraba: **la barra de etapa ya rellena su segmento actual con la fracción
   de sesiones hechas del ciclo**, así que el dato estaba dicho dos veces, y
   «Próxima sesión», que va justo debajo, dice por dónde va la clienta.

El tab de Programa queda con **tres piezas y ninguna suelta**: la tarjeta con
sus ajustes, la ficha de «Preparar» y su nota. Entra sin scroll, que era el
objetivo.

### 4.6 Las pestañas pierden la banda

`ui/TabBar` **existe y está en uso** (`ClientsScreen.jsx:2465`), pero hay que
restilarlo. Su diseño actual son pestañas clásicas: la activa toma `colors.bg`
con las esquinas de arriba redondeadas y **se funde con el contenido**, lo que
obliga a que lo de arriba sea una banda de otro color (`detailNavBand`, sobre
`surface`).

Ese es el problema: la pantalla pasa de **header negro → banda gris → contenido
negro**, y una banda gris no existe en ningún otro sitio de la app. El recurso
es correcto y está bien argumentado en la cabecera del componente, pero paga un
fondo que el resto del producto no usa.

**Pestañas nuevas, sobre `bg`:**

| Pieza | Valor |
|---|---|
| Track | `colors.surface`, `radius.md`, `padding: 3`, `gap: 3` |
| Pestaña | `flex: 1`, `padding: 9px 2px`, `radius.sm`, `textStyles.cardType` en `mutedLight` |
| Activa | fondo `colors.surface2`, texto en `colors.text` |
| Animación | la píldora **desliza** a la nueva posición, igual que el `SegmentedControl` |

Con esto la pantalla entera va sobre `bg`: cabecera, nombre, pestañas y
contenido. Desaparecen la banda y las dos condiciones que imponía (sin borde
inferior, sin `paddingBottom`).

**La regla que sustituye a la de la banda, y es más simple:**

> El `SegmentedControl` de filtro lleva el highlight en **`accent`**; las
> pestañas de navegación lo llevan **neutro**. En una pantalla con los dos, la
> píldora lima es siempre el filtro.

> ⚠️ **Revertido en QA (sep-2026).** La píldora de `TabBar` pasa a `accent` con
> el texto en `onAccent`: probada en la ficha de cliente, en `surface2` la
> pestaña activa casi no se distinguía, y en qué pestaña estás es el dato que
> manda en esa cabecera. La diferencia con el segmentado se queda donde ya
> estaba de verdad —track `surface` + `radius.md` contra `surface2` +
> `radius.full`—, que era el otro argumento de este mismo apartado.

Los dos siguen sin parecerse —track `surface2` y `radius.full` contra `surface`
y `radius.md`— y siguen conviviendo: las pestañas navegan entre sub-pantallas,
y dentro de cada una hay segmentados que filtran. Lo que cambia es **de dónde
sale la diferencia**: antes del fondo sobre el que flotaban, ahora del color del
highlight, que además encaja con §1.1 — el acento marca acción, no en qué
pestaña estás.

⚠️ **Coste real:** `TabBar.jsx` está implementado, probado y en uso, y su
cabecera documenta el motivo que aquí se cae. Hay que reescribir componente y
comentario, no solo la maqueta.

### 4.7 Extracción

Sacar `AssignedProgramCard` a `components/ui/ProgramCard.jsx` quedándose **solo
con la tarjeta** (cabecera, cuerpo, etapa, 3 cajas, pie). Los avisos de bloqueo
y la sección de próxima sesión se quedan en `ClientsScreen`: son del tab, no de
la tarjeta. Las filas de sesión NO se comparten — en la ficha de cliente no hay
sesiones (§4.5), así que la lista agrupada solo la usa la Home.

Dos accesos que vivían en el banner se mudan a las piezas equivalentes de la
tarjeta, y solo en la variante `self`: la etiqueta **CICLO** abre la ficha del
apartado (era ya el disparador en el banner) y el **bloque de etapa** abre el
selector (era el `onPress` del banner entero). En la ficha de cliente no hay
nada que elegir desde ahí, así que ninguna de las dos es pulsable.

---

## 5. Fase U08 — `sessionPlan()`

### 5.1 Por qué

La Home tiene la rotación metida en el código en **tres cadenas de texto**, y
las tres se deciden hoy dentro de la pantalla. No es un problema de
extensibilidad abstracta: es que **ninguna de las tres sabe callarse**.

| # | Cadena | Hoy | Qué no sabe decir |
|---|---|---|---|
| 1 | Rótulo del hero | Sale de una rama de `getSessionStatus`, cuyo estado se llama `'next'` | «no sé por qué esta es la que toca» |
| 2 | Marcador de la fila | `template.label`, leído dentro de la fila | «estas sesiones no tienen letra» |
| 3 | Contador del rótulo | Se compone en la pantalla con los dos números de `computeCycleProgress()` | «no hay ciclo que contar» |

En el caso 1 la palabra y el concepto están **soldados**: `'next'` significa a la
vez «es la que toca» y «es la siguiente en orden alfabético». En el 3, las
palabras «este ciclo» son una afirmación sobre cómo funciona el programa,
escrita en la capa de maquetación.

### 5.2 El cambio

Una función que devuelve las tres cosas, porque las tres salen de la misma
pregunta — «¿cuál toca y por qué?»:

```js
function sessionPlan(program, activeSession, workoutLog) {
  // Hoy solo sabe rotar. Un switch por modo de programa cuando haga falta.
  return {
    heroLabel: 'Siguiente',          // 1 — null ⇒ no se pinta hero (§5.3)
    rows:      [{ marker: 'A', … }], // 2 — cadena corta, no "la letra"
    subtitle:  '2 de 5 este ciclo',  // 3 — null ⇒ no se pinta contador
  };
}
```

Con tres consecuencias en la pantalla:

- `getSessionStatus` devuelve `'hero'` en vez de `'next'`: el estado nombra el
  **papel**, no el orden.
- La fila recibe `marker` como prop en vez de la plantilla entera. Los 20 px de
  ancho fijo ya aguantan `LUN`, y como no hay caja tampoco hay forma que se
  rompa con texto más largo.
- El contador se pinta solo si `subtitle` no es `null`.

**No añade ni una funcionalidad.** Devuelve exactamente lo que la pantalla
calcula hoy. Lo único que hace es juntar las tres frases que dan por hecho la
rotación para que se vean, en vez de estar repartidas disfrazadas de detalles de
maquetación. Media tarde de trabajo, cero cambios visibles.

⚠️ **Se hace al implementar U06, no después.** Hacerlo luego significa volver a
tocar los tres sitios.

### 5.3 La regla del hero: existe solo cuando la app sabe por qué

Esto salió de una pregunta del usuario que el diseño no tenía contestada: **en
un modo a la carta no hay «siguiente»** — todas las sesiones pesan lo mismo
salvo la sugerida por llevar más tiempo sin hacerse. ¿Qué pasa entonces con un
hero cuatro veces más grande que las demás?

La respuesta no es «un hero con otro rótulo». Presentar una heurística con la
misma autoridad que «esta es literalmente tu siguiente sesión del programa» es
mentir con la maquetación. La regla es:

> **El tamaño del hero es la confianza de la app.** Si la app sabe cuál toca,
> hay hero. Si solo puede sugerir, no lo hay: manda la lista.

| Modo | ¿Sabe cuál toca? | Hero |
|---|---|---|
| Rotación | sí, es la primera sin hacer del ciclo | sí — `Siguiente` |
| Por día de la semana | sí, la asignada a hoy | sí — `Hoy` |
| Sesión abierta | sí, la que está a medias | sí — `En curso` |
| Fechada | sí, la publicada para hoy | sí — `Hoy · 4 sep` |
| **A la carta** | **no** | **no** |

Sin hero, **la lista es la pantalla**: las filas se ordenan por días desde la
última vez, así que la más abandonada queda arriba por el propio orden. **La
sugerencia vive en el orden y en la meta («hace 9 días»), que son datos, no
cromo.** Y la app no promete lo que no sabe.

Consecuencia de diseño que hay que respetar ya en U06: **las filas tienen que
poder sostener la zona solas**. Hoy lo hacen —nombre, meta y acción a la
derecha— con un solo ajuste pendiente: en un modo sin hero, el icono de la
derecha debe leerse como «empezar», no como «ver».

Hay precedente en el propio diseño: el estado «ciclo cerrado» (§3.2) ya suelta
el acento cuando no hay nada que empujar. No es un caso especial, es la misma
regla.

---

## 6. Modos de entrenar — el contraste

Quince formas reales de entrenar en gimnasio contra el modelo de la app. **Diez
encajan hoy**, tres a medias, dos no. Es material informativo: no justifica
construir nada, pero sí los tres cambios de §5.

**Encajan sin tocar nada (10):** full body repetido · A/B alterno · torso/pierna
· push-pull-legs (×1 o ×2) · circuito fijo de máquinas · gimnasio como
complemento de otro deporte · dobles sesiones · bloques de
acumulación/intensificación/descarga · **especialización con frecuencia
desigual** · **sesión corta de reserva**.

Las dos últimas parecían no encajar y sí encajan:

- **Especialización (A, B, A, C, A).** Duplicar la sesión da una copia con
  **id propio**, así que `cycleCompletedIds` las distingue. Para compartir
  progresión se **vinculan los ejercicios**: mismo `exerciseId` + mismo
  `linkGroup` comparten configuración e historial, y la referencia de peso sale
  del último registro del grupo venga de la sesión que venga. La regla de que la
  config vinculada es 100% idéntica aquí no estorba: es que las sesiones son la
  misma.
- **Sesión corta de reserva.** Es sesión libre y ya funciona: `saveSession` con
  `'__free__'` guarda su propia entrada y **no toca `cycleCompletedIds`**, así
  que entrenas sin gastar un hueco del ciclo. Lo único que falta es comodidad
  → §7.

**A medias (3):** Weider anclado a días de la semana (la app arrastra la sesión
saltada al día siguiente; mucha gente la daría por perdida) · **ondulante
diario (DUP)** · **olas de cuatro semanas (5/3/1)**.

Las dos últimas fallan por lo mismo, y merece la pena escribirlo:

> Quieren **compartir el historial de pesos sin compartir la programación**.
> `LINKED_CONFIG_KEYS` incluye `sets`, `minReps`, `maxReps` y `restSec`, así que
> vincular obliga a que los tres días lleven el mismo rango de repeticiones —
> justo lo que un ondulante no quiere. O compartes historial y repites rango, o
> pones rangos distintos y cada día progresa por su cuenta.
>
> Eso **no es un descuido**: está decidido a propósito en la cabecera de
> `exerciseLinks.js` (si dos instancias se programan distinto, la salida es
> desvincular, no una excepción invisible). Buena decisión, no tocar a la
> ligera. Si algún día hay que abrir el DUP, lo que hace falta **no es un modo
> nuevo sino un segundo tipo de vínculo** — «mismo ejercicio, misma referencia
> de peso, programación propia» — que sale de excluir esas cuatro claves para
> ese tipo. Cambio pequeño en código, consecuencia grande en interfaz: dos
> clases de vínculo que el usuario tiene que distinguir de un vistazo.

**No encajan (2):** **a la carta / autorregulado** (no hay «siguiente»; ver
§5.3, es el único de los quince que choca de frente con las tres cadenas) y
**sesión del día fechada** (WOD, entrenador que publica el lunes lo del martes:
pide sesiones con fecha y prescripción, y el canal entrenador→cliente manda
programas, no sesiones sueltas).

Si algún día hay que construir uno, **«a la carta» es el barato**: no toca
datos, las plantillas ya existen y la fecha de la última vez ya se calcula. Con
U08 hecho es escribir un segundo caso de `sessionPlan()` y aceptar que
`heroLabel` sea `null`.

---

## 7. Fase U09 — Plantillas de sesión libre

Lo único que le falta al caso «sesión corta de reserva» (§6). Hoy la sesión
libre se monta desde cero cada vez, así que la versión de 30 minutos que casi
todo el mundo acaba teniendo hay que reconstruirla a mano.

Guardar una sesión libre como plantilla reutilizable y poder abrirla de un
toque desde el botón `＋ SESIÓN LIBRE`. **Sigue sin avanzar el ciclo** — eso es
lo que la hace útil aquí y no debe cambiar.

Es independiente del resto de la spec: se puede hacer antes, después o nunca.

### 7.1 No hay que diseñarlo: la app ya lo resolvió un nivel más abajo

Los **presets de bloque** de acondicionamiento son este mismo problema con otro
tamaño, y están hechos y en uso. U09 es esa forma a nivel de sesión, no un
diseño nuevo:

| Pieza | Presets de bloque (hoy) | Plantillas de sesión libre (U09) |
|---|---|---|
| Almacén | `blockPresets: []` en `useStore.js` — copias **congeladas**, device-global, fuera del sync, dentro del backup | igual, array propio |
| Crear | botón al final del editor de bloque (`BlockEditorInline.jsx`) + toast | §7.3 |
| Usar | la hoja de «añadir» gana una fila **solo si hay al menos uno**, y esa fila abre una segunda hoja con la lista | §7.2 |
| Borrar | una `✕` por fila en esa segunda hoja, con confirmación | igual |

`saveBlockPreset` le quita el `id` al bloque y le pone un `presetId` nuevo:
insertar un preset **copia**, no referencia. La plantilla de sesión hace lo
mismo.

### 7.2 Abrir: la hoja solo existe cuando hay algo que ofrecer

Pulsar `＋ SESIÓN LIBRE` abre una hoja de dos opciones —**nueva** o **desde
plantilla**— y la segunda abre la lista.

**Con cero plantillas la hoja no aparece**: el botón va directo a la sesión
libre en blanco, exactamente como hoy. Es la misma regla que gobierna la fila de
presets del editor (`blockPresets.length > 0 &&`), y tiene dos consecuencias
buenas: quien no use plantillas nunca ve un paso de más, y la hoja no puede
ofrecer una lista vacía.

Es además la regla del hero (§5.3) aplicada a otra pieza: **la interfaz no
promete lo que no tiene**.

### 7.3 Guardar: en el recap, no en el workout

El botón vive en el **recap**, como acción secundaria encima de `LISTO`.

1. Al empezar una sesión libre no sabes si merece guardarse; al acabarla, sí.
   El editor de bloque puede poner su botón abajo porque acabas de terminar de
   *editarlo* — el recap es ese mismo momento para una sesión libre.
2. El pie del workout es un par ya decidido (GUARDAR primario · Descartar
   secundario) y un tercer botón ahí compite con el guardado.
3. El recap ya es una pantalla que te **pide** algo (el RPE), no un informe, así
   que tiene sitio para una acción sin cambiar de naturaleza.

**Una plantilla por sesión**: guardada, el botón se queda diciéndolo y no acepta
un segundo toque. Guardarla dos veces daría dos plantillas idénticas y ninguna
forma de distinguirlas.

**Y si la sesión SALIÓ de una plantilla, se puede actualizar esa.** Es el caso
normal: abres la plantilla, le cambias un par de cosas por el camino y quieres
que se queden. Sin esto, cada retoque fundaba una copia y acababas con tres
«Corta de reserva» sin saber cuál es la buena. El recap ofrece las dos salidas,
con «Actualizar «Corta»» al doble de ancho que «Guardar como nueva» — la
actualización es lo que se espera, la copia es la excepción. Sin plantilla de
origen, o si se borró mientras tanto, vuelve el botón único.

Actualizar **conserva el `presetId`**, así que la plantilla no se mueve de sitio
en la lista; y si le quitaste el nombre a la sesión se queda con el que ya tenía.
La sesión recuerda su origen en `freePresetId`, que viaja al log porque el recap
trabaja sobre la entrada y no sobre la sesión, que a esas alturas ya está
reseteada.

⚠️ **El recap es un momento, no un estado** — el mismo aviso del §3.2.1. Si el
usuario lo pasa de largo, la sesión queda en el historial y la plantilla se
pierde. Se acepta a propósito: el segundo hogar permanente sería un `⋯` en la
entrada de historial, y hoy esa tarjeta no tiene ninguno, así que sería estrenar
una afordancia para un caso que quizá no aparece. Si aparece, ese es el sitio.

### 7.4 Qué se congela, y dónde vive

**Qué:** los ejercicios con su configuración (series, rangos, descansos), los
bloques y el nombre. **Los pesos y las reps registradas no** — eso es el log.
La plantilla es el plan, no lo que hiciste.

Al implementarlo apareció que **esa configuración no existía**: el `exConfig` de
un ejercicio añadido sobre la marcha se inventaba en cada render con los valores
por defecto de la biblioteca, así que la línea «4 × 8–12 · 90 s» de la tarjeta
era un dato que nadie podía cambiar y que la plantilla no podía congelar. Se
arregló en el mismo sitio donde se ve (commit b5424d5): la entrada ad-hoc lleva
su `config`, la línea de objetivo es su disparador —el dato es el disparador,
como la etiqueta CICLO de la Home— y detrás hay una hoja con el bloque VOLUMEN
del editor y nada más. Nada de progresión, calentamiento ni vinculación: en una
sesión libre no hay siguiente sesión a la que progresar.

**Dónde:** `freeSessionPresets`, array propio device-global, **no en
`sessionTemplates`**. Ese mapa lo referencian los días de las etapas; una
plantilla libre metida ahí sería una sesión sin dueño, y aparecería en todo lo
que recorre plantillas. Como `blockPresets`: fuera del canal del entrenador (es
tuya, no la programa nadie) y dentro de `backupPayload`, del que viaja con la
biblioteca personal en la importación.

Las dos funciones que deciden qué entra y qué no son puras y viven en
`utils/freeSessionPreset.js`, fuera del store: `presetFromEntry` congela,
`freeSessionFromPreset` vuelve a montar. Lo que hay que acertar es exactamente
eso, así que se prueba solo.

---

## 8. Lo que se aparta de Figma — pendiente de aprobar

Contra la extracción de `docs/figma-extraction/pages/homeview.md`:

1. **El banner desaparece como pieza.** Es el componente más elaborado del mock
   (número de ciclo, puntos, barra de etapa, separador vertical). Sus datos se
   reparten entre el hero y la `ProgramCard`; ninguno se pierde, pero el
   componente deja de existir.
2. **El acento cambia de dueño.** En Figma el borde acento marca la sesión
   completada; aquí el relleno acento marca la siguiente y las completadas se
   quedan solo con el check.
3. **Las sesiones restantes usan la lista agrupada.** Figma pide cinco tarjetas
   independientes de 81 px con radio completo y gap de 10; aquí van con
   `gap: spacing.xs` y radios por posición. No es una forma inventada —es el
   patrón que ya usan Progreso, los menús y la lista de clientes— pero **en
   esta pantalla el mock pide el otro**.
4. **La sesión siguiente sale de la lista.** El orden A→F se respeta dentro de
   la lista, pero la elegida ya no está en ella.
5. **La sección `PROGRAMA` del final se elimina**: sus acciones bajan al pie de
   la `ProgramCard`.

---

## 9. Decisiones abiertas

| # | Pregunta | Contexto |
|---|---|---|
| 1 | ~~**¿EDITAR se pinta con programa de entrenador?**~~ **Resuelto al implementar: no.** | La regla sigue —la edición no sube por el canal y la siguiente actualización reemplazaría el programa entero—, así que `ProgramCard` recibe `onEdit: undefined` y VER ocupa el pie junto al `⋯` |
| 2 | **El nombre del programa no se ve al abrir** | Consecuencia directa de bajar la tarjeta al final. La única forma de tenerlo arriba *y* la tarjeta abajo es duplicar el nombre en una línea fina de cabecera |
| 3 | **El radio** | La `ProgramCard` va a `radius.lg` (18) y las filas de sesión a `md` (10). O se igualan, o se acepta que la tarjeta es de otro rango — en clientes hoy conviven así y no chirría |
| 4 | **La semana perdió su contador** | Al quedarse desnuda (§3.1). Si el dato interesa, hay que devolvérselo de otra forma |
| 5 | **¿Se echan de menos las sesiones en clientes?** | §4.5 las quita del todo. Si al usarlo falta saber qué lleva hecho, el sitio es el historial del cliente, que está a una pestaña — no devolverlas a esta pantalla |
| 6 | **Ancho de las pestañas** | Cuatro etiquetas a `cardType` (12 px, tracking 1.2) dejan ~82 px por celda: «Historial» entra justo. Si en dispositivo se corta, bajar el tracking solo de las pestañas, no el tamaño |
| 7 | **El tracking del nombre de sesión** | La fila hereda `cardType` de Progreso, con **tracking 1.2**. El tamaño ya subió a 13/11 en QA (a 12/10 la fila se quedaba pequeña al lado del hero); el tracking sigue sin tocar, y en «Empuje volumen» queda más espaciado de lo esperable. Si no convence, bajarlo solo aquí y anotarlo |

---

## 10. Fases

| Fase | Qué | Coste | Estado |
|---|---|---|---|
| **U06** | Rediseño de la HomeView: hero, lista agrupada, semana desnuda, tarjeta al final (§3) | medio | ✅ 97ae57d |
| **U07** | `ProgramCard` compartida: extracción, dos variantes, pie integrado, métricas del lado atleta, ficha de cliente sin sesiones y restyle de `ui/TabBar` sin banda (§4) | medio | ✅ 97ae57d |
| **U08** | `sessionPlan()` — se hizo **dentro de U06**, no después (§5) | media tarde | ✅ 97ae57d |
| **U09** | Plantillas de sesión libre (§7) | bajo | ✅ 94e77f6 |

---

## 11. Maquetas

Las tres maquetas de la sesión de diseño, con los valores exactos y el
antes/después de cada corrección:

- **Zona de sesiones — primeras propuestas**: <https://claude.ai/code/artifact/c823407f-a897-45ef-9ecd-3094e83ea8ff>
- **Cuatro exploraciones estructurales** (stepper, panel, sesión al mando, recorrido vertical): <https://claude.ai/code/artifact/df5739c5-26ce-4ec5-861f-da0ba4e0027c>
- **La Home reordenada** (4 rondas de corrección, con antes/después de cerca): <https://claude.ai/code/artifact/b7448110-37f8-4390-98ff-772b74d68259>
- **Una tarjeta, dos pantallas** (la convergencia con `ClientsScreen`): <https://claude.ai/code/artifact/a124dafa-aae0-48ad-ba0c-104b869788d5>
- **Cuando el orden no importa** (los quince modos de entrenar): <https://claude.ai/code/artifact/4587736e-02a0-464a-aeed-203906a04754>
- **La Home, montada** — **la referencia buena**: la pantalla entera con los componentes finales, la lista agrupada, la ficha de cliente, los tres estados del hero (incluido el modo sin hero) y el inventario de qué componente sale de dónde: <https://claude.ai/code/artifact/a9a04c00-d471-4034-a20b-4bb6795784bc>
