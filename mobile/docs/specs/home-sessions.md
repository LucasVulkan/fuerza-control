# Spec — La Home gira sobre la sesión, no sobre el programa

> Tema: ui
> En corto: El banner lima deja de ser del programa y pasa a ser la sesión que toca; el programa baja a una tarjeta que se comparte con la ficha de cliente, y las tres frases que dan por hecho que entrenas rotando salen de la pantalla a una función.
> Fase U06 · pendiente · Rediseño de la HomeView: hero, filas planas, semana desnuda · §3
> Fase U07 · pendiente · `ProgramCard` compartida con `ClientsScreen` · §4
> Fase U08 · pendiente · `sessionPlan()`: rótulo, marcador y contador fuera de la pantalla · §5
> Fase U09 · pendiente · Plantillas de sesión libre · §7
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
> Estado: **ninguna fase implementada** (sep 2026). Sale de una sesión de
> diseño Opus + usuario sobre la zona de sesiones de la Home: seis rondas de
> maquetas, cada corrección del usuario sobre la anterior. Las decisiones están
> cerradas y los valores son exactos; lo que falta es escribirlo.
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
| Fila superior | rótulo a la izquierda (`Inter_900Black` 10, tracking 2.2, `onAccent`) · tag «SESIÓN C» a la derecha (`Inter_800ExtraBold` 10, tracking 2, `onAccent` al 50%) |
| Nombre | **22 px** `Inter_900Black`, line-height 1.1, `marginTop: spacing.md` |
| Meta | 12 px `Inter_600SemiBold`, `onAccent` al 62%, **`marginTop: spacing.sm`** |
| Botón | `onAccent` sólido, `radius.md`, `padding: 15px spacing.lg`, `marginTop: spacing.lg`; texto `btnAction` en **lima** + chevron |

El nombre empezó en 27 px y bajó a 22 a petición del usuario: 22 es el cuerpo
que ya usan el número de ciclo del banner y los valores de `StatsRow`, no un
tamaño inventado. Y el subtítulo bajó de `spacing.md` a `spacing.sm` para que
nombre y meta se lean como un bloque. **El botón no se toca**: es la pieza más
pesada del hero y así debe seguir.

La meta line lleva `{n} ejercicios · ~{min} min · última {rel}`, con los dos
primeros de `sessionStats()`, que ya existe.

Estados del hero:

| Estado | Rótulo | Meta | Botón |
|---|---|---|---|
| Siguiente | `Siguiente` | ejercicios · min · última vez | `EMPEZAR` |
| En curso | `En curso` | `3 de 6 ejercicios · empezada hace 42 min` | `CONTINUAR` |
| Ciclo cerrado | `Ciclo 07 completo` · tag `5 / 5` | «Vuelves a la Sesión A · Empuje pesado» | `EMPEZAR SESIÓN A`, sin relleno acento |
| **Sin hero** | — | — | — (§5.3) |

El estado «ciclo cerrado» **suelta el acento** (`surface2` + borde `border`,
botón con borde `accent-50` y texto `accent`): es la única pantalla del día que
no pide entrenar, y darle un respiro al lima tiene valor.

### 3.3 Las filas de las demás sesiones

Un solo bloque agrupado, `gap: 1` sobre `hair` para el filete, `radius.md`,
`overflow: hidden`. Cada fila: `padding: 13px spacing.lg`, `gap: spacing.md`.

```
[A]  Empuje pesado                    hace 3 días   ✓
[D]  Empuje volumen        Adaptada · ~44 min        ›
```

| Elemento | Regla |
|---|---|
| **Marcador** | Ancho fijo 20 px, `Inter_900Black` 13, tracking .5. Pendiente → `lima`; hecha → `muted`. **Sin caja, sin fondo, sin borde** |
| Nombre | `Inter_800ExtraBold` 13. Pendiente → `text`; hecha → `mutedLight` en peso 500 |
| Meta | 11 px peso 500 en `muted`. Hecha → cuándo; pendiente → ejercicios y minutos |
| «Adaptada» | **Texto en `tint.blue70` dentro de la meta**, no una pastilla |
| Acción | Ancho 16, a la derecha: check lima (hecha) o chevron `muted` (pendiente) |

Tres rondas de corrección llegaron aquí, así que conviene no deshacerlas:

1. Primero el check ocupaba un hueco reservado a la izquierda que en las filas
   pendientes **no lo llenaba nada**. Se fue a la derecha, con el chevron —
   que además es la regla de Figma para las Sesion Cards: la zona de acción
   siempre acaba en el mismo punto sea cual sea su contenido.
2. Luego el marcador era un chip de 24×24 con fondo `accent-10` (pendiente) o
   transparente con borde (hecha). El usuario lo rechazó: **«cambios de fondo
   raros»**. Fuera la caja; el color de la letra basta.
3. Y la pastilla azul de ADAPTADA pasó a ser texto. Menos ruido, y el azul
   sigue significando entrenador.

El ancho fijo de 20 px es lo que mantiene el borde izquierdo alineado en las
cuatro filas, y de paso **aguanta tres caracteres** sin tocar nada — ver §5.2.

---

## 4. Fase U07 — `ProgramCard` compartida

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
│   PROGRAMA                              CICLO      │  spacingTag mutedLight
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
| Eyebrow | `Programa` | `Programa asignado` |
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

Lo que sí sube de la Home a clientes: el marcador de letra y **las filas
agrupadas del ciclo entero**, para que el entrenador vea qué lleva hecho su
cliente sin abrir el historial. Al tocarlas debe abrirse la sesión **para
prepararla, no para entrenarla**.

### 4.5 Extracción

Sacar `AssignedProgramCard` a `components/ui/ProgramCard.jsx` quedándose **solo
con la tarjeta** (cabecera, cuerpo, etapa, 3 cajas, pie). Los avisos de bloqueo
y la sección de próxima sesión se quedan en `ClientsScreen`: son del tab, no de
la tarjeta. Extraer también las filas de sesión, que ahora usan las dos
pantallas.

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
3. **Las sesiones restantes van agrupadas**, con filete entre ellas y radio solo
   en las esquinas del bloque. Figma pide cinco tarjetas independientes de 81 px
   con radio completo y gap de 10.
4. **La sesión siguiente sale de la lista.** El orden A→F se respeta dentro de
   la lista, pero la elegida ya no está en ella.
5. **La sección `PROGRAMA` del final se elimina**: sus acciones bajan al pie de
   la `ProgramCard`.

---

## 9. Decisiones abiertas

| # | Pregunta | Contexto |
|---|---|---|
| 1 | **¿EDITAR se pinta con programa de entrenador?** | Hoy `HomeScreen` lo oculta a propósito con `isTrainerProgram`: la edición no sube por el canal y la siguiente actualización reemplazaría el programa entero. Los mocks lo pintan siempre. Si la regla sigue, VER ocupa el pie completo en ese caso |
| 2 | **El nombre del programa no se ve al abrir** | Consecuencia directa de bajar la tarjeta al final. La única forma de tenerlo arriba *y* la tarjeta abajo es duplicar el nombre en una línea fina de cabecera |
| 3 | **El radio** | La `ProgramCard` va a `radius.lg` (18) y las filas de sesión a `md` (10). O se igualan, o se acepta que la tarjeta es de otro rango — en clientes hoy conviven así y no chirría |
| 4 | **La semana perdió su contador** | Al quedarse desnuda (§3.1). Si el dato interesa, hay que devolvérselo de otra forma |

---

## 10. Fases

| Fase | Qué | Coste | Estado |
|---|---|---|---|
| **U06** | Rediseño de la HomeView: hero, filas planas, semana desnuda, tarjeta al final (§3) | medio | pendiente |
| **U07** | `ProgramCard` compartida: extracción, dos variantes, pie integrado, métricas del lado atleta (§4) | medio | pendiente |
| **U08** | `sessionPlan()` — se hace **dentro de U06**, no después (§5) | media tarde | pendiente |
| **U09** | Plantillas de sesión libre (§7) | bajo | pendiente |

---

## 11. Maquetas

Las tres maquetas de la sesión de diseño, con los valores exactos y el
antes/después de cada corrección:

- **Zona de sesiones — primeras propuestas**: <https://claude.ai/code/artifact/c823407f-a897-45ef-9ecd-3094e83ea8ff>
- **Cuatro exploraciones estructurales** (stepper, panel, sesión al mando, recorrido vertical): <https://claude.ai/code/artifact/df5739c5-26ce-4ec5-861f-da0ba4e0027c>
- **La Home reordenada** (4 rondas de corrección, con antes/después de cerca): <https://claude.ai/code/artifact/b7448110-37f8-4390-98ff-772b74d68259>
- **Una tarjeta, dos pantallas** (la convergencia con `ClientsScreen`): <https://claude.ai/code/artifact/a124dafa-aae0-48ad-ba0c-104b869788d5>
- **Cuando el orden no importa** (los quince modos de entrenar): <https://claude.ai/code/artifact/4587736e-02a0-464a-aeed-203906a04754>
