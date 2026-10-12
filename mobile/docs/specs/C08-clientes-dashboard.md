# Spec — La lista de Clientes como dashboard

> Tema: conexión
> En corto: La pantalla de Clientes pasa a leerse de un vistazo: arriba tres cifras que se pulsan para comparar a todos, y una fila por cliente que dice una sola cosa cada vez (dónde va, o qué necesita y el botón para hacerlo). Fuera las pills y el ruido de colores; el orden lo elige el entrenador y se queda guardado.
> Inicio: 2026-10-08
> Fin: 2026-10-12
> Fase C08-01 · hecho · Avatar con color de identidad e insignia de «con app» · §3
> Fase C08-02 · hecho · La fila: aviso o programa, botón con icono, cuadraditos, última vez y muesca de sin revisar · §4
> Fase C08-03 · hecho · Tres tarjetas de resumen; adherencia y mejora como lentes · §5
> Fase C08-04 · hecho · Orden elegido y guardado: criterio, «lo pendiente, arriba» y a mano · §6
> Fase C08-05 · hecho · Rótulo de la lista: etiquetas con scroll, «Enviar todo» y fuera las pills · §7
>
> Estado: **C08 implementada y probada entera** (8→12-oct-2026). C08-01: `ClientAvatar.jsx`,
> `utils/identityColor.js` (+ test), `IDENTITY_COLORS` en `theme.js`, `color` al crear
> cliente (las dos altas del store) y migración en `onRehydrateStorage`. Añadidos tras la
> primera prueba: insignia de reloj para el invitado y el «atrás» de Android desde la
> ficha vuelve a la lista (antes saltaba a Inicio; no lo causó C08).
> **C08-02 implementada y probada** (8-oct-2026): `ClientListCard` reescrita, lista en bloques
> agrupados con `getCardRadii`, fila de plegados, `weekExtra` en `sessionPlan` y
> `utils/lastSeen.js` (los dos con test). Hasta C08-04 el orden sigue siendo el de hoy: los
> avisos aún no suben solos. ponytail: los plegados se despliegan sin animar la altura.
> **C08-03 implementada y probada** (9-oct-2026): `SummaryTile` (relleno circular desde el
> toque, patrón de `PlanTicket`), `clientAvisos()` compartida por la fila y «Necesitan algo»,
> `improvementByClient` (8 semanas, memoizada) y la lente en la fila. Las cifras cuentan la
> lista principal tal como se ve (búsqueda y filtros incluidos). Las pills siguen hasta C08-05.
> Tras la primera prueba: forma de las tarjetas de progresión (cifra · NOMBRE · «media 4 sem»),
> «Necesitan algo» pasa a **Pendientes**, el lima entra siempre desde arriba a la izquierda y
> pulsar Pendientes ilumina un momento las filas con algo pendiente.
> **C08-04 implementada y probada** (12-oct-2026): `utils/orderClients.js` (+ test), orden en
> `profile.clientsOrder`, hoja «Ordenar» (`ChoiceRow` + interruptor), modo «Reordenar» con
> `Sortable.Grid` y asas. El rótulo de la lista ya existe con «CLIENTES» y el botón de orden;
> C08-05 le añade las etiquetas. Fuera el orden de la hoja de filtros y sus claves.
> **C08-05 implementada y probada** (12-oct-2026): fuera las pills de atención
> (`AttentionPill`, sus contadores y `adherenceFilter`), etiquetas en el rótulo con scroll y
> degradado, «Enviar todo» compacto solo con 2 o más. Decisiones al implementar: sin «Esta
> semana» en el rótulo (junto al botón de orden no queda sobre los cuadraditos y se leía
> «Esta semana ⇅ Actividad»; la v8 tampoco lo llevaba); el botón de filtro conserva su
> globo con el número de filtros en vez del punto lima. Las demás, sin implementar. Sale de iterar ocho
> maquetas con el usuario en el chat; la que manda es
> [`docs/mockups/clients-dashboard-8.html`](../mockups/clients-dashboard-8.html),
> que es interactiva (caso tranquilo / movido / lunes, etiquetas, hoja de orden,
> modo reordenar). Las versiones 1-7 de la misma carpeta son el camino, no el
> destino. Sustituye las pills de [C02-client-triage.md](C02-client-triage.md):
> sus banderas siguen valiendo, pero como aviso en la fila (§4.2), no como pill.

---

## 1. Qué problema resuelve

La tarjeta de hoy (`ClientListCard`, [ClientsScreen.jsx:1388](../../src/screens/ClientsScreen.jsx))
mete en una fila: nombre, «Semana NN», programa · etapa, adherencia en % con su
color, ritmo (sesiones/semana), «3/4 esta semana», la fecha o «N sin revisar»,
hasta tres avisos apilados y un botón cuyo color cambia según cuál gane (lima,
azul, naranja). Encima, una fila de pills (En riesgo · Aflojando · Sin revisar ·
etiquetas) y un banner de «Cambios sin enviar». Cada pieza tiene su razón, pero
juntas no tienen jerarquía: en un día movido la pantalla es una feria de colores.

La regla que sale de las maquetas:

- **Cada cliente aparece una vez** y su fila dice **una sola cosa** en la segunda
  línea: dónde va (programa · etapa · semana) **o** qué necesita (el aviso).
- **El color solo marca qué necesita algo.** Un cliente al día es gris y lima.
- **Las acciones viven en un botón con icono**, solo en las filas que lo piden.
- **Las cifras de comparar** (adherencia, mejora) no están en cada fila: se
  piden pulsando su tarjeta de arriba.

## 2. Lo que ya existe y se reutiliza (no reconstruir)

| Pieza | Dónde | Para qué aquí |
|---|---|---|
| `ClientListCard` | [ClientsScreen.jsx:1388](../../src/screens/ClientsScreen.jsx) | se reescribe en su sitio (§4); su lógica de avisos y CTA es la base |
| `computeAdherence` + `adherencePct` (ventana móvil de 4 semanas, en días, capada a 100) | [adherence.js:120](../../src/utils/adherence.js) | estado (en riesgo / aflojando) y el % de cada cliente; `adherenceByClient` ya lo calcula por cliente |
| `computeOverallImprovement(log, allExercises)` | [improvement.js:103](../../src/utils/improvement.js) | la «mejora global» de la pestaña de progreso: media de la tendencia (recta de regresión) de cada ejercicio |
| `sessionPlan({ days, log, t }).weekDone` | [sessionPlan.js](../../src/utils/sessionPlan.js) | entrenos de la etapa desde el lunes, repeticiones incluidas; una libre marcada «cuenta como C» cuenta como la C |
| `isFreeEntry` / `programTemplateOf` | [freeSessions.js:27](../../src/utils/freeSessions.js) | saber qué entradas de la semana no cuentan para el programa |
| `unreviewedByClient` / `getNewSessionsCount` | [ClientsScreen.jsx:1852](../../src/screens/ClientsScreen.jsx) | entrenos sin revisar (solo clientes con app: sale de `remoteSessionsCount`) |
| `linkOf(client)` → `'linked'` | [ClientsScreen.jsx:1688](../../src/screens/ClientsScreen.jsx) | cliente con app |
| Relleno circular desde el toque, 450 ms, `Easing.out(cubic)`, que se recoge si vuelves | `PlanTicket` en [PaywallModal.jsx:102](../../src/components/PaywallModal.jsx) (mismo lenguaje que U13-02) | tarjetas de arriba (§5) |
| `react-native-sortables` + `SORTABLE_PROPS` + `Sortable.Handle` | [ProgramEditorScreen.jsx:55](../../src/screens/ProgramEditorScreen.jsx), `components/ui/sortable` | orden a mano (§6) |
| `updateProfile(updates)` y el `profile` persistido | [useStore.js:530](../../store/useStore.js) | guardar el orden (§6), como `scrubRuler` |

## 3. Avatar con color de identidad e insignia de «con app» (C08-01)

### 3.1 Avatar

Círculo de 36 px a la izquierda de la fila con **las iniciales** (dos letras:
primera de cada una de las dos primeras palabras del nombre). Fondo = color de
identidad al 18 % (`withOpacity(c, 0.18)`), letras = el color entero, peso del
rol de texto que toque en `textStyles` (no se añade `fontWeight` propio, AGENTS.md).

**Para qué:** reconocer al instante quién es quién. Lo que reconoce es el color
(«Ana es la violeta»), no la letra. Se descartaron una lista de iconos asignables
(20 a mano, y un icono no se asocia a una persona) y la foto (selector,
almacenamiento y sincronización; si llega algún día, lo natural es que la suba
el cliente con app).

### 3.2 Paleta de identidad

Seis tonos **lejos del lima, el naranja, el rojo y el azul** de los avisos, para
que nunca se lean como estado. Hay temas claros (`earthy`, `space`), así que van
dos juegos en `src/theme.js`, elegidos por `th.scheme`:

```js
export const IDENTITY_COLORS = {
  dark:  ['#b39dfa', '#f28dc4', '#4fd1c5', '#d9b88a', '#8fb8de', '#c9a0dc'],
  light: ['#6d4fd8', '#c2407f', '#1f8f86', '#8a6a3c', '#3f6f9e', '#8d4fa6'],
};
```

Los de `light` son orientativos: comprobar en dispositivo que las letras dan
≥ 4.5:1 sobre su propio tinte en `earthy` y `space` y ajustarlos si no.

### 3.3 Qué color le toca a cada uno (se guarda)

`client.color` = índice en la paleta. **Se guarda**: si se calculase por
posición, borrar un cliente le cambiaría el color a los demás.

- `createClient` ([useStore.js:659](../../store/useStore.js)) asigna **el índice menos
  usado** entre los clientes existentes (empate → el más bajo).
- Migración en `onRehydrateStorage`: los clientes sin `color`, en orden de
  `createdAt` (y de id si empatan), reciben el menos usado en ese momento.
- Si aun así llega un cliente sin `color` (importado de un `.fitdata`), se pinta
  con un respaldo determinista `hash(client.id) % 6`; no se escribe en el estado
  al pintar.

Helper puro y con test en `src/utils/identityColor.js`:
`nextIdentityColor(clients)` y `identityColorOf(client)`.

### 3.4 Insignia de «con app»

Cliente con `linkOf(client) === 'linked'`: un círculo de 19 px pegado a la
esquina **inferior derecha** del avatar (desborda 5 px), fondo `surface` (la
tarjeta, así parece recortado) y dentro el icono de móvil de hoy
(el `Path` de `cAppIcon`, [ClientsScreen.jsx](../../src/screens/ClientsScreen.jsx)) a 12 px,
trazo `text`. **Se quita el móvil que hoy va junto al nombre.**

Invitado (`linkOf === 'invited'`: le generaste el código y aún no lo ha
canjeado): la misma insignia con un **reloj** en `mutedLight`, «esperando».
Sin app: sin insignia (es el caso normal del presencial).

**Probar C08-01**

- [x] Clientes existentes: al abrir la app tras actualizar, cada uno tiene un color
  y al cerrar y abrir sigue teniendo el mismo.
- [x] Crear tres clientes seguidos: salen con colores distintos de los ya usados
  mientras quede alguno libre.
- [x] Borrar un cliente: ningún otro cambia de color.
- [x] Cliente con app: insignia de móvil abajo a la derecha del avatar; sin el
  móvil junto al nombre. Sin app: sin insignia.
- [x] Cliente al que le generaste el código y aún no lo ha canjeado: insignia con
  un reloj gris. Al canjearlo pasa a la del móvil.
- [x] Abrir la ficha de un cliente y pulsar «atrás» en Android (botón o gesto):
  vuelve a la lista de Clientes, no a Inicio.
- [x] Tema `earthy` y `space`: las iniciales se leen bien sobre su círculo.

## 4. La fila (C08-02)

### 4.1 Estructura

Lista **compacta**: un solo bloque, 2 px entre filas, solo las esquinas de fuera
redondeadas (`getCardRadii`, el patrón de lista agrupada de la app). Se eligió
frente a tarjetas sueltas porque ahora todas las filas tienen la misma forma y
se leen como una tabla; separarlas hace que cada una se lea como un objeto
aparte, que es el ruido que se quita.

Fila de **alto fijo, 70 px** (las dos líneas con `space/lg` arriba y abajo; más aire que la maqueta, tras la primera prueba), lleve lo que lleve: `[avatar] [nombre / 2.ª línea] [derecha]`. Tocar la fila abre la
ficha (como hoy); mantener pulsado abre las acciones (como hoy).

Fila **normal** (sin aviso con botón):

```
 (AL)  Ana López                            ▪▪▪▫ +1
       Hipertrofia · Bloque 2 · sem 3 de 6       ayer
```

Fila **con aviso y botón**:

```
 (JO)  Javier Ortiz                    ┌──────────┐
       Cambios sin enviar              │ ↑ ENVIAR │
                                       └──────────┘
```

### 4.2 Segunda línea: programa o aviso

Sin aviso: `programa · etapa · sem N de M` (semana de la etapa del cliente, la
de su blob — `stageStatus(...)`, la misma cuenta que hoy). En su última semana,
`última semana` en `text` en vez de `sem N de M`, sin color: aviso previo sin
alarma. Etapa sin duración: `programa · etapa`.

Con aviso: **el aviso sustituye a la línea entera**, en `labelStrong` (el 12 de la
meta, en negrita) y en el color de su dueño
(el código de hoy: lima = en marcha, azul = tuyo sin enviar, naranja = parado,
rojo = en riesgo). Si tiene más de uno se pinta el de más prioridad y detrás un
`+N` en `mutedLight`. Prioridad (la del CTA de hoy, más los dos sin botón):

| # | Aviso | Cuándo (hoy en `ClientListCard`) | Color | Botón (icono · texto) |
|---|---|---|---|---|
| 1 | Entreno a medias | `inProgress` | blue | ▶ Continuar |
| 2 | Sin programa | `!activeProgram` | text | + Programar |
| 3 | Cambios sin enviar | `showDirty` (programa) | blue | ↑ Enviar |
| 4 | Etapa siguiente bloqueada | `stageStuck` | orange | candado abierto · Desbloquear |
| 5 | Etapa terminada | `blockStuck` | orange | calendario · Planificar |
| 6 | Cambios sin enviar | `showOverrideDirty` (prescripciones) | blue | ↑ Enviar |
| 7 | Sin entrenar | adherencia `AT_RISK` | redText | — |
| 8 | Bajando el ritmo | adherencia `SLIPPING` | orange | — |

Con un entreno a medias (1) no se cuentan 7 ni 8: ese entreno es justo lo que
los resuelve, aún sin guardar (salía «Entreno a medias +1» sin decir de qué).

Los textos de 3-6 ya existen (`clients.pendingTitle`, `stageLockedShort`,
`blockDoneShort`); los demás son claves nuevas (§8).

**Congelado** (M01 §4.5): sin botón ni aviso; la 2.ª línea dice
`freePlan.frozenLabel` en `mutedLight` y se queda en su sección de congelados
como hoy.

### 4.3 El botón

Fondo `surface3`, texto `text` en `button` (la voz de «+ Cliente») y **sin versales** (en
mayúsculas se comía la línea; cambiado tras la primera prueba), y delante **un icono sólido de 15 px en el color del aviso** (el triángulo de Continuar, con las puntas apenas redondeadas). El color
va en el aviso y en el icono, **no en el fondo del botón**: «Sin entrenar» y
«Bajando el ritmo» no tienen botón, y si el color viviera en el botón los dos
avisos más graves se quedarían sin él. Iconos: los de `components/ui` si existen
(▷, +, ↑, candado, calendario); si no, `Path` de 24×24 con trazo 2,2 como el
resto de la pantalla.

Las filas con botón **no llevan cuadraditos ni última vez**: el botón ocupa la
derecha entera. Es el precio de no duplicar al cliente.

### 4.4 Derecha de la fila normal

**Línea 1, a la altura del nombre: los cuadraditos.** Uno por sesión prevista
en la semana de su etapa (`weekTotal`, como hoy), 10×10, radio 2, 3 px entre
ellos; llenos (`accent`) los `min(weekDone, weekTotal)` primeros, vacíos
(`surface3`) el resto. Van en la línea del nombre para que con 6-7 sesiones no
se peguen a la línea del programa.

**Lo hecho de más va con número detrás** («+1», «+2», en `accent`, peso del
rol de dato): `extra = max(0, weekDone − weekTotal) + libresSueltas`, donde
`libresSueltas` son las entradas del log de esta semana (desde
`startOfWeek`) que **no cuentan para el programa** (`programTemplateOf(e) == null`)
o cuya plantilla no es de la etapa actual. Así los cuadraditos son **siempre las
sesiones previstas**; nunca pasan de `weekTotal`.

`sessionPlan` devuelve además `weekExtra` con esa cuenta (un campo nuevo, con
test; la Home no lo usa).

**Línea 2: la última vez.** Etiqueta corta, en `mutedLight`:
`hoy` (en `text`) · `ayer` · día de la semana abreviado si fue hace 2-6 días
(`toLocaleDateString(lang, { weekday: 'short' })` sin el punto, como
[useLastDays.js](../../src/hooks/useLastDays.js)) · `hace N d` desde 7 días ·
`nunca` si no hay ninguno. Helper puro `lastSeenLabel(ts, now, t, lang)` con test.

El rótulo de la lista dice «Esta semana» encima de esta columna (§7), así que
no hace falta poner «3/4» en cada fila: el número se quitó a propósito.

### 4.5 Sin revisar: la muesca

Cliente con app y `getNewSessionsCount(id) > 0`:

- Fila normal: **muesca lima metida en la esquina inferior derecha** de la
  fila, con el número en negro (`onAccent`). `position: absolute`, `right: 0`,
  `bottom: 0`, `borderTopLeftRadius: radius.md` y la esquina inferior derecha
  **con el radio de la propia fila** (2 px en una intermedia, `radius.md` en la
  última del bloque): parece recortada en la tarjeta, no puesta encima. **Tapa
  la última vez**, y no se pierde nada: si hay entrenos sin revisar, la última
  vez es el último de ellos.
- Fila con botón: un globo lima redondo con el número, **delante del botón**.
- Tocar la muesca o el globo abre su historial (`onViewUnreviewed`, como hoy).

Los sin revisar **no son un aviso**: no cambian la 2.ª línea ni cuentan en
«Necesitan algo» (§5). Sí suben en el orden (§6.2).

### 4.6 Pausados y esperando código

Los clientes `paused` y los invitados (`linkOf === 'invited'`) salen de la
lista y se pliegan en **una fila** al final, en su propio bloque:
`En pausa o esperando código · Sara, Irene ›`. Al tocarla se despliega en su
sitio (`AnimatedHeight`) con sus filas en gris, sin cuadraditos. Los
`inactive` siguen como hoy: ocultos por el filtro de estado de la hoja de
filtros.

### 4.7 Lo que sale de la fila

«Semana NN» del programa, el % de adherencia, el ritmo («2,5 ses/sem»), «3/4
esta semana», los avisos apilados y el texto «N sin revisar». El % y el ritmo
siguen en la ficha.

**Probar C08-02**

- [x] Cliente al día: nombre, cuadraditos a la altura del nombre, «programa ·
  etapa · sem N de M» y la última vez a la derecha. Ningún otro color que el lima.
- [x] En la última semana de la etapa pone «última semana» en blanco.
- [x] Cliente con 6 sesiones por semana: los cuadraditos no tocan la línea de abajo.
- [x] Hacer las 3 de 3 y repetir una: 3 llenos y «+1». Hacer una sesión libre que
  no sustituye a ninguna: «+1» más. Una libre marcada «cuenta como B»: llena
  un cuadradito, sin «+».
- [x] Cambios sin enviar: la 2.ª línea dice «Cambios sin enviar» en azul y a la
  derecha «↑ ENVIAR» con la flecha azul; al enviar, la fila vuelve a la normal.
- [x] Etapa terminada sin siguiente: aviso naranja y «PLANIFICAR» abre el
  planificador. Con la siguiente bloqueada: «DESBLOQUEAR» la abre.
- [x] Cliente en riesgo: «Sin entrenar» en rojo, sin botón, con sus cuadraditos y
  su última vez.
- [x] Dos avisos a la vez: sale el de más prioridad y «+1».
- [x] Cliente con app y 2 entrenos sin revisar: muesca lima «2» en la esquina
  inferior derecha, recortada en la esquina (también en la última fila del
  bloque, con su radio grande); tocarla abre su historial.
- [x] Entreno a medias y sin revisar a la vez: globo delante de «CONTINUAR».
- [x] Pausados e invitados plegados al final en una fila; al tocarla se despliegan.
- [x] Hoy · ayer · «lun» · «hace 9 d» · «nunca» salen donde toca, en español e inglés.

## 5. Tres tarjetas de resumen; adherencia y mejora como lentes (C08-03)

### 5.1 Las tarjetas

Bajo el buscador, tres tarjetas iguales en fila con **la forma de las tarjetas
de progresión** (`statTile` de ProgressTab), centradas: la cifra en `title`, el
nombre en versales (`caps`) y una línea de qué mide en `label`:

| Tarjeta | Nombre | Línea de abajo |
|---|---|---|
| Pendientes | PENDIENTES | — (la cifra se explica sola) |
| Adherencia | ADHERENCIA | media 4 sem |
| Mejora | MEJORA | media 8 sem |

«Pendientes» y no «Avisos» (alarmante) ni «Acciones» (cuenta también a quien
está «Sin entrenar», que no tiene botón).

| Tarjeta | Cifra | Cuenta |
|---|---|---|
| **Pendientes** | nº de clientes | los de la lista (sin pausados, invitados ni congelados) con algún aviso de la tabla de §4.2. Los sin revisar no cuentan |
| **Adherencia media** | % | media de `adherence.pct` de los clientes con programa, sin pausados ni silenciados (`MUTED`), ignorando los `null`. Sin ninguno: «—» |
| **Mejora media** | ±% | media de `computeOverallImprovement` de cada cliente sobre **sus últimas 8 semanas** de log, ignorando los `null`. Positiva en `accent` |

Con etiquetas activas (§7) las tres cuentan solo a ese grupo.

**Sobre la mejora media.** Las descargas no la estropean (es una recta de
tendencia, no «última contra primera»). Lo que la distorsiona es mezclar
perfiles: un principiante a +25 % y un veterano a +2 % dan +13 %, que no describe
a ninguno. El usuario la quiere igual («agrada verlo»), y por eso la lente
(§5.2) importa: la media se puede abrir y ver a cada uno. Se memoiza por
cliente (regresión por ejercicio); no se recalcula en cada render.

### 5.2 Las lentes

**Adherencia** y **Mejora** se pulsan:

- Pulsar una la **rellena de lima** desde **la esquina de arriba a la izquierda**,
  siempre la misma para que sea consistente: círculo que crece hasta cubrirla en 450 ms (`Easing.out(Easing.cubic)`), texto a
  `onAccent` al mismo paso; al soltarla se recoge hacia esa esquina. Mismo
  patrón que `PlanTicket` (un `useSharedValue` por tarjeta que sigue desde donde
  iba si vas y vuelves deprisa, nunca reinicia).
- Mientras una está rellena, **la derecha de cada fila enseña la cifra de ese
  cliente** en vez de cuadraditos / última vez / botón:
  - Adherencia: `92%` (rol de dato, 16 px) y debajo una barrita de 52×4 llena
    hasta el %; cifra y barra en rojo bajo 60, naranja bajo 75, si no la cifra en
    `text` y la barra en `accent`.
  - Mejora: `+8%` en `accent` si es positiva, en `mutedLight` si es 0 o negativa.
  - Sin programa o sin dato: «—» en `muted`.
  - La 2.ª línea **no cambia**: el aviso se queda porque explica la cifra.
- La lista se ordena **de peor a mejor** por esa cifra, salvo con el orden «A
  mano» (§6.3), que no se mueve.
- Pulsar otra vez la rellena, o pulsar la otra, la cambia. **Pendientes nunca
  se rellena**: hace el gesto de pulsación (escala 0,96), devuelve al estado
  normal y **las filas con algo pendiente se iluminan de lima un momento**
  (velo lima al 18 %: sube en 180 ms, aguanta 450 y se apaga en 650). **Por defecto ninguna está rellena.**
- Las lentes no se guardan: al salir de la pantalla y volver, estado normal.

**Probar C08-03**

- [x] Al entrar, ninguna tarjeta está rellena. «Pendientes» cuenta lo mismo
  que filas con aviso hay en la lista.
- [x] Pulsar «Pendientes»: las filas con aviso se iluminan de lima un momento y
  vuelven a su color; las demás no.
- [x] Pulsar Adherencia: se rellena de lima desde la esquina de arriba a la izquierda, toques donde toques; cada fila enseña
  su % con su barrita; la lista queda de menor a mayor.
- [x] Pulsar Mejora con Adherencia rellena: la primera se recoge, la segunda se
  rellena y las cifras cambian a mejora.
- [x] Pulsar la rellena otra vez, o «Pendientes»: vuelve todo a la vista normal
  y al orden de antes. «Pendientes» nunca queda rellena.
- [x] Pulsar deprisa varias veces: el relleno sigue desde donde iba, sin saltos.
- [x] Con la lente puesta, un cliente con «Cambios sin enviar» sigue diciéndolo en
  su 2.ª línea, sin botón.
- [x] Con el orden «A mano», pulsar una lente cambia las cifras pero nadie se mueve.

## 6. Orden elegido y guardado (C08-04)

### 6.1 El botón de orden

A la derecha del rótulo de la lista (§7), siempre visible: icono ⇅ + el nombre
del criterio («Actividad», «Nombre», «A mano»). Con una lente rellena dice
«Adherencia ↑» / «Mejora ↑», salvo con «A mano». Al tocarlo abre una hoja
(`DragSheet`) **Ordenar**:

- **Criterio** (radio, una lista agrupada):
  - **Actividad** — el que entrenó más recientemente, primero (el `recent` de hoy).
  - **Nombre** — de la A a la Z.
  - **A mano** — tu orden, arrastrando.
- Con «A mano» elegido, una fila **Reordenar ›** (§6.3).
- **Lo pendiente, arriba** (interruptor, encendido por defecto): los
  clientes con aviso van encima, por la prioridad de §4.2, y debajo el resto por
  el criterio. Apagado, el criterio manda sobre todos.

El orden **sale de la hoja de filtros**, que se queda con estado y etiquetas.
El «Actividad ↑» de hoy (más inactivos primero) se quita: con los avisos arriba
y la lente de adherencia ya no hace falta.

### 6.2 Se guarda

En `profile.clientsOrder` (persistido con el `profile`, `updateProfile`):

```js
clientsOrder: { by: 'activity' | 'name' | 'manual', needsFirst: true, manual: [clientId, …] }
```

Valor por defecto `{ by: 'activity', needsFirst: true, manual: [] }` (sin
migración: se lee con `?? DEFAULT`). Hoy el orden vive en un `useState` y se
pierde al salir de la pantalla.

Orden final de la lista, en este orden de reglas:

1. Con lente y criterio ≠ `manual`: por la cifra de la lente, de peor a mejor. Fin.
2. Si `needsFirst`: primero los que tienen aviso (por prioridad de §4.2), después
   **los que tienen sin revisar**, después el resto.
3. Dentro de cada grupo, el criterio. En `manual`, por posición en `manual`; los
   que no están en la lista (clientes nuevos) van **al final**, por `createdAt`.

### 6.3 A mano

**Reordenar** cierra la hoja y pone la lista en modo edición:

- Cada fila enseña un **asa** (el `DragIcon` de `components/ui/EditorIcons`) a la
  derecha en vez de cuadraditos / botón, y se arrastra por el asa con
  `react-native-sortables` (`Sortable.Handle`, `SORTABLE_PROPS`), igual que las
  sesiones en el editor de programa. Se arrastra por el asa porque mantener
  pulsada la fila ya abre sus acciones.
- En edición se ve el orden puro (sin «lo pendiente, arriba»), las
  tarjetas de arriba no responden y el botón de orden pasa a **Listo** en lima.
- **Listo** guarda `manual` con el orden que se ve y vuelve a la vista normal.

**Probar C08-04**

- [x] El rótulo de la lista enseña «⇅ Actividad»; al tocarlo sale la hoja Ordenar.
- [x] Elegir «Nombre», salir de la pantalla, cerrar la app y volver: sigue por nombre.
- [x] Apagar «Lo pendiente, arriba»: los clientes con aviso se colocan en
  su sitio alfabético. Encenderlo: vuelven arriba.
- [x] Con «Lo pendiente, arriba» encendido, los de sin revisar van justo
  después de los de aviso.
- [x] «A mano» → Reordenar: salen las asas, se arrastra por el asa, «Listo» lo
  guarda; al volver a la pantalla el orden sigue.
- [x] Mantener pulsada una fila en modo normal sigue abriendo sus acciones.
- [x] Crear un cliente con orden «A mano»: aparece al final.

## 7. Rótulo de la lista, etiquetas y «Enviar todo» (C08-05)

### 7.1 El rótulo

Entre las tarjetas y la lista, una línea:

- Izquierda: **CLIENTES** (rol de rótulo de sección).
- Derecha: el botón de orden (§6.1). Sin «Esta semana»: junto al botón de orden
  no queda encima de los cuadraditos y se leía «Esta semana ⇅ Actividad».

### 7.2 Etiquetas

Se eligen en la hoja de filtros, como hoy (varias a la vez, se filtra por
cualquiera: `tagFilter.some`). Activas:

- **Sustituyen al rótulo entero** («CLIENTES» y «Esta semana») por sus pastillas
  lima (`accent` / `onAccent`, versales, con ✕ que quita esa etiqueta), en un
  `ScrollView` horizontal con un degradado de salida a la derecha que avisa de
  que hay más.
- El **botón de orden se queda fijo a la derecha**, fuera del scroll, solo con
  el icono.
- El botón de filtro, junto al buscador, lleva un punto lima mientras hay alguna.
- Las tarjetas de arriba cuentan solo a ese grupo (§5.1).

### 7.3 Fuera las pills

Se quitan `AttentionPill`, sus contadores (`attnCounts`, `unreviewedCount`), el
estado `adherenceFilter` / `effectiveAdherenceFilter` con sus ramas de filtrado
y orden, y la fila 3 de la cabecera (pills + etiquetas aplicadas). Lo que
hacían ya lo hacen otras piezas: los avisos suben solos (§6.2), los sin revisar
se ven por la muesca (§4.5) y la lente de adherencia pone arriba a los de riesgo.

### 7.4 «Enviar todo»

El banner global de «Cambios sin enviar» (`pendingBanner`) se queda **solo
cuando hay 2 o más clientes** con cambios sin enviar, y compacto: una fila del
mismo ancho que la lista, encima de ella, con el icono ↑ azul, «Cambios sin
enviar · N clientes» y el botón «ENVIAR TODO» (fondo `surface3`, como los de la
fila). Con uno solo basta su botón «Enviar» en la fila. El banner de congelados
(M01) no cambia.

**Probar C08-05**

- [x] Sin etiquetas: «CLIENTES» a la izquierda y «⇅ Actividad» a la derecha.
- [x] Activar una etiqueta: el rótulo pasa a su pastilla lima con ✕; las tres
  tarjetas cuentan solo a esos clientes; el botón de filtro lleva su globo.
- [x] Activar tres: se desplazan en horizontal y el botón de orden sigue fijo a la
  derecha. La ✕ de una quita solo esa.
- [x] No hay pills de «En riesgo» ni «Sin revisar» en ningún caso.
- [x] Un cliente con cambios sin enviar: no hay banner, solo su botón. Dos: sale
  la fila «Cambios sin enviar · 2 clientes» con «ENVIAR TODO», que los envía.

## 8. Textos nuevos (es · en)

Todos en `src/locales/es.json` y `en.json`, línea a línea (sin reformatear el
JSON), bajo `clients.`:

| Clave | es | en |
|---|---|---|
| `summary.needs` | necesitan algo | need something |
| `summary.adherence` | adherencia media | avg adherence |
| `summary.improvement` | mejora media | avg improvement |
| `workoutInProgress` | Entreno a medias | Workout in progress |
| `btnProgram` | Programar | Program |
| `notTraining` | Sin entrenar | Not training |
| `slowingDown` | Bajando el ritmo | Slowing down |
| `blockDone` | Etapa terminada | Stage finished |
| `stageNWeeks` | sem {{n}} de {{total}} | wk {{n}} of {{total}} |
| `lastWeek` | última semana | last week |
| `lastSeenDays` | hace {{count}} d | {{count}}d ago |
| `folded` | En pausa o esperando código | Paused or awaiting code |
| `listHeader` | Clientes | Clients |
| `sort.title` | Ordenar | Sort |
| `sort.activity` / `sort.activitySub` | Actividad / El que entrenó más recientemente, primero | Activity / Most recently trained first |
| `sort.name` / `sort.nameSub` | Nombre / De la A a la Z | Name / A to Z |
| `sort.manual` / `sort.manualSub` | A mano / Tu orden, arrastrando | Manual / Your order, by dragging |
| `sort.reorder` | Reordenar | Reorder |
| `sort.done` | Listo | Done |
| `sort.needsFirst` / `sort.needsFirstSub` | Lo pendiente, arriba / Avisos y botones encima de tu orden | To do on top / Alerts and actions above your order |
| `sort.lensAdherence` / `sort.lensImprovement` | Adherencia ↑ / Mejora ↑ | Adherence ↑ / Improvement ↑ |
| `sendAllRow` | Cambios sin enviar · {{count}} clientes | Unsent changes · {{count}} clients |

`dayCard.today`, `dayCard.yesterday`, `clients.thisWeek`, `clients.lastNever`,
`clients.pendingTitle`, `stageLockedShort`, `stageUnlockShort`, `blockPlanShort`,
`btnContinue`, `btnSendOverride` ya existen y se reutilizan. Las claves de las
pills y de «Actividad ↑» (`atRiskPill`, `slippingPill`, `unreviewedPill`,
`filterSheet.sortIdle`, `filterSheet.sortRecent`, `filterSheet.sortName`,
`filterSheet.sort`) se borran si nadie más las usa (grep antes).

## 9. Orden de trabajo y riesgos

C08-01 → C08-02 → C08-03 → C08-04 → C08-05. La 02 es la grande; la 04 depende de
la 03 (la lente ordena) y la 05 de la 04 (el botón de orden vive en el rótulo).

- `ClientsScreen.jsx` tiene 4.800 líneas. **No** se parte en esta spec: se
  reescribe `ClientListCard` en su sitio y se añaden `ClientsSummary` y
  `SortSheet` como funciones del mismo archivo, como el resto de sus piezas.
- `computeOverallImprovement` por cliente puede costar con historiales largos:
  `useMemo` por `clientLogs[id]` y recorte a 8 semanas **antes** de llamarla.
- Lo que no hace `vitest`: las casillas de cada fase. Lo que sí: tests de
  `identityColor.js`, `lastSeenLabel`, `weekExtra` de `sessionPlan` y la función
  de orden de §6.2 (sacarla a un util puro, `orderClients(list, opts)`, para
  poder probarla sin la pantalla).
