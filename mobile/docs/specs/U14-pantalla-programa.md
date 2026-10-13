# Spec — Pantalla Programa

> Tema: ui
> En corto: El tab Programa arranca con la misma tarjeta que Inicio, en el mismo sitio, y la despliega hacia abajo con la etapa y las cifras; debajo, los botones y las etapas, con la en curso en ficha.
> Inicio: 2026-10-13
> Fin: 2026-10-13
> Fase U14-01 · hecho · La tarjeta de Inicio, desplegada · §4
> Fase U14-02 · hecho · Las etapas: ficha de la en curso, filas y hoja de cambio · §5
> Fase U14-03 · hecho · La entrada por partes en Sesión, Progresión, Clientes y Plantillas · §4.4
>
> Estado: **diseño cerrado e implementado el 13-oct-2026** (propuesta A2 de la
> maqueta), por probar en el móvil. Primera prueba (13-oct): cortes a 4 dp, cifras
> centradas y sin color, vuelve «● por entrenador», toque con retraso y la cabecera
> del editor como la ficha. Con una sesión en curso,
> Inicio lleva el banner encima de la tarjeta y Programa no: ahí sí se mueve. Contesta la parte de U12-02 que toca al tab Programa: qué dice su
> tarjeta. Dónde se edita desde Inicio sigue abierto en U12-02.

## 1. Por qué

Desde U12-01, en Inicio hay una tarjeta del programa que lleva al tab Programa. La
parte de arriba de la tarjeta de Programa dice casi lo mismo, pero:

- **no está a la misma altura**: Inicio rellena el scroll con `spacing.sm` (6) por
  arriba y `MyProgramScreen` con `spacing.lg` (15);
- **no está montada igual**: Inicio usa `HomeProgramCard` (ceja «TU PROGRAMA ·
  ETAPA», nombre en lima, semana tras un corte en diagonal, barra inclinada) y
  Programa usa `ProgramCard` (ceja con «›», nombre en blanco, semana sin total,
  barra recta y otra más abajo).

Al pasar de una a otra la tarjeta salta. Lo que se quiere es que **no salte**: que
Programa se lea como la tarjeta de Inicio **desplegada**. Y el resto de la pantalla
(etapa, cifras, botones, lista de etapas) necesitaba un lavado de cara con la voz
del onboarding (O03 §3.1), sin perder que es una pantalla de uso diario.

## 2. Maqueta y decisiones

Maqueta: [`docs/mockups/program-screen.html`](../mockups/program-screen.html)
(<https://claude.ai/artifact/5K87XA2N261CYoLtmdMfts>). Tres propuestas (A, B, C) y
una segunda vuelta de la A, la **A2**, que es la elegida.

Decisiones del usuario (13-oct-2026):

- **La A**: todo lo de la etapa en curso en la tarjeta, los botones debajo de la
  tarjeta, y la lista de etapas.
- **«Esta etapa» en dos columnas**: el número y el nombre debajo de la ceja y, a la
  derecha, la semana con los tramos. Repite la forma del programa de encima. (El
  número se añadió al pedir la implementación, 13-oct.)
- **La etapa en curso, en ficha** (como en B y C): ceja «EN CURSO · SEMANA 3 DE 4»,
  el nombre, la barra corta por semanas y las sesiones hechas. **Sin la lista de
  sesiones y sin relleno lima.**
- **EDITAR · VER PROGRAMA · ⋯ siguen pegados debajo de la tarjeta.**
- Descartadas: B (las fichas del editor; para ver una etapa había que tocarla) y C
  (la etapa en curso como pieza lima y el programa en cronograma).

## 3. Cómo queda

De arriba abajo, con un programa de varias etapas:

```
FormaFIT        9:41 · MAR 13 OCT          ≡     ← AppHeader, igual
┌───────────────────────────────╱──────────────┐
│ TU PROGRAMA · ACUMULACIÓN     ╱       SEMANA │  ← HomeProgramCard tal cual,
│ Fuerza Base                  ╱        07/12  │    a 6 dp de la cabecera
│ ▰▰▰▰▰▰ ▰▰▰▰▱▱ ▱▱▱▱ ▱         ╱               │
├───────────────────────────────────────────── │  ← corte de 2 dp, color del fondo
│ ESTA ETAPA                     SEMANA 3/4    │  ┐
│ 2 Acumulación                    ▰ ▰ ▰ ▱     │  │ lo que se despliega (U14-01)
├───────────────────────────────────────────── │  │
│ 86%          3 ses/sem       +12%            │  │
│ ADHERENCIA   RITMO           CARGA           │  ┘
└──────────────────────────────────────────────┘
[   EDITAR   ] [ VER PROGRAMA ] [ ••• ]             ← ProgramActions, 4 dp debajo
ETAPAS                          4 · 12 SEMANAS
╭──────────────────────────────────────────────╮
│ 1  Base                                   ✓  │  ← fila hecha
│    sem 1-4 · 3 sesiones por semana           │
╰──────────────────────────────────────────────╯
╭──────────────────────────────────────────────╮
│ EN CURSO · SEMANA 3 DE 4                     │  ← ficha de la en curso (U14-02)
│ 2 ACUMULACIÓN                                │
│ sem 5-8 · 3 sesiones por semana              │
│ ▰▰▰▱            7 de 12 sesiones             │
╰──────────────────────────────────────────────╯
╭──────────────────────────────────────────────╮
│ 3  Intensificación                        ○  │  ← fila por venir: se elige
│    sem 9-11 · 4 sesiones por semana          │
╰──────────────────────────────────────────────╯
```

## 4. U14-01 — La tarjeta de Inicio, desplegada

### 4.1 Una sola tarjeta

`MyProgramScreen` deja de pintar `ProgramCard` y pinta **`HomeProgramCard`**, el
mismo componente que Inicio, con una prop nueva (p. ej. `expanded`) y lo que se
despliega como hijo o como parte del componente. Arriba no cambia **nada**: misma
ceja, mismo nombre, mismo corte, misma semana, misma barra.

- `contentContainerStyle` de `MyProgramScreen`: `paddingTop: spacing.sm`, como
  `HomeScreen` (hoy es `spacing.lg`). Los dos usan `AppHeader` y
  `paddingHorizontal: spacing.lg`: con eso la tarjeta cae en el mismo píxel.
- **Ida y vuelta** (13-oct, al probar): en Programa, tocar la fila de arriba de la
  tarjeta (nombre, barra, semana) **vuelve a Sesión**, como desde Inicio lleva a
  Programa (`onOpen` + `openHint`, `myProgram.backToSessions`). Solo esa fila: lo
  desplegado debajo no navega. Pulsar la ceja «SEMANA» sigue abriendo la ficha de
  la semana (`DocSheet sectionId="week"`).
- **La ficha de cliente del entrenador lleva la misma tarjeta** (13-oct, al
  probar): `HomeProgramCard` con el progreso del cliente (`progress`), la ceja
  «PROGRAMA ASIGNADO» (`eyebrow`) y debajo lo mismo que aquí (`ProgramCardDetail`),
  pero quieto, sin despliegue y sin línea de autoría (el autor es él). El aviso de
  «terminó la etapa y sigue en ella» va como nota bajo «Esta etapa». La
  `ProgramCard` vieja se borró; en su archivo solo queda `ProgramActions`.

### 4.2 Lo que se despliega

Debajo de la fila de arriba, dentro de la misma caja `surface` y con su mismo
relleno lateral (`spacing.lg`):

0. **Quién hizo el programa**, si viene de un entrenador: «● por **Marta**», punto
   azul de 5 dp, `label` `mutedLight` con el nombre en `labelStrong` `blue`
   (como la tarjeta vieja). Sin entrenador, no sale. *(Añadido el 13-oct al
   probar: la tarjeta de Inicio no lo lleva y se echaba en falta.)*
1. **Un corte de 4 dp** (`spacing.xs2`, el ancho de la diagonal) a sangre, del
   color del fondo (`bg`). No es un filete gris. 14 dp de aire hasta lo
   siguiente. *(Era de 2 y se leía más fino que la diagonal.)*
2. **«Esta etapa»**, en dos columnas, con la misma forma que la fila del programa:
   - izquierda: ceja «ESTA ETAPA» (`caps`, `mutedLight`) y debajo, a 4 dp, **el
     número y el nombre** de la etapa: «2 Acumulación», los dos en `itemTitle`, el
     número en `accent` (`blue` si es de descarga) y el nombre en `text` (si no
     tiene nombre, «Etapa 2» con `home.stageDefault`, y sin número delante);
   - derecha, alineada al final: ceja «SEMANA 3/4» (`caps`, `mutedLight`) y debajo
     los **tramos**: un rectángulo por semana de la etapa, 16 × 8 dp, radio 2,
     inclinados −12° como la barra de arriba, 4 dp entre ellos; encendidos en
     `accent` hasta la semana en curso incluida (`i < weekInStage`), apagados en
     `surface3`. Son los puntos de hoy de `ProgramCard` con otra forma.
   - Semana y total: `status.weekInStage` y `status.lengthWeeks` (con las
     añadidas). Sin empezar: ceja «SIN EMPEZAR» y tramos todos apagados. Etapa sin
     límite (`lengthWeeks == null`): ceja «SEMANA 3» y **sin tramos**.
   - El bloque sale en los mismos casos que hoy `computeStageInfo` (con una sola
     etapa y sin límite, no sale: no hay nada que contar). Sin él, el corte va
     directamente antes de las cifras.
3. **Otro corte de 4 dp**, igual, con 14 dp por arriba y por abajo.
4. **Las tres cifras**: adherencia, ritmo y carga, en tres columnas iguales,
   **centradas**. Los
   valores son los de hoy (`adherence4w`, `adherence.recentPerWeek`, `loadPct`,
   ya calculados en `MyProgramScreen`), con otra voz:
   - el número en **Barlow** (`heroName`, 28), `text`, cifras tabulares y 2 dp de
     aire a la derecha para la cursiva. **Sin color**: el «en riesgo» de
     `computeAdherence` mide los días desde la última sesión, no el porcentaje, y
     pintaba de rojo un 100 % tras unos días sin entrenar (13-oct);
   - la unidad pegada («%», « ses/sem») en `label`, `mutedLight`;
   - debajo, la clave en `caps` `mutedLight` (`programCard.statAdherence`…).
   - Sin dato, «—», como hoy.
   - Relleno de abajo de la tarjeta: `spacing.lg`.

Inicio no despliega nada: su tarjeta sigue como en U12-01.

### 4.3 El despliegue

Al ganar el foco el tab Programa (`useFocusEffect` o `navigation.addListener('focus')`):

- la parte desplegable pasa de alto 0 y opacidad 0 a su alto, en **360 ms, out
  cubic**, con Reanimated (alto medido con `onLayout` o `AnimatedHeight` de
  `ui/`, que ya existe);
- lo de debajo de la tarjeta (botones, rótulo, etapas) **entra por partes**, como el
  onboarding (O03 §3.1.6): cada bloque sube 12 dp con opacidad de 0 a 1 en 420 ms
  out cubic, con 45 ms entre uno y otro, y el primero 120 ms después de empezar el
  despliegue. Con Reanimated `entering` o un `withDelay` por bloque.
- Al volver a Programa ya abierto (cambiar de tab y volver) se repite; al repintar
  sin cambiar de tab (cambiar de etapa, editar), **no**.
- Con «reducir movimiento» del sistema (`useReducedMotion` de Reanimated), todo
  aparece ya abierto.

Inicio no anima nada al volver.

### 4.4 U14-03 — La misma entrada en las demás pestañas

Pedido el 13-oct al probar U14-01: Sesión, Progresión, Clientes y Plantillas
entran igual que Programa. El mecanismo sale a piezas comunes:

- `src/hooks/useEnterClock.js`: el reloj de la pantalla, con las reglas de §4.3
  (arranca al llegar desde otra pestaña; no al volver de algo apilado ni al
  repintar; quieto con «reducir movimiento»), y el contexto `EnterClock`.
- `src/components/ui/Rise.jsx`: `Rise` (un bloque en su turno, `index`) y `Unfold`.
  Sin reloj en el contexto no animan: así la misma pieza sirve en la ficha de
  cliente, que no entra por partes. `Rise` acepta `layout` para no romper la
  transición del plegado de las sesiones de Inicio, y `style` para el `zIndex`
  del desplegable de ejercicios de Progresión.

Cada pantalla puede llevar su ritmo (`useEnterClock({ speed })`, que acelera el
reloj entero). **Sesión, Progresión y Clientes van a 1,5×** (`ENTER_FAST`): son
las de más bloques y a 1× se sentían lentas (13-oct). Programa y Plantillas, a 1×.

**En Sesión la tarjeta del programa no entra**: ya está puesta al llegar, como en
Programa. Así no salta en ninguno de los dos sentidos: de Inicio a Programa se
despliega, y de vuelta ya está en su sitio.

Qué entra en cada una, por orden:

| Pestaña | Bloques |
|---|---|
| Sesión | banner «En curso» · semana (la tarjeta del programa, quieta) · «SESIONES» · aviso de etapa · cada sesión (o la tarjeta de pestañas) · sesiones libres |
| Progresión | conmutador · período · cifras · buscador · selector de ejercicios · cada ejercicio (solo la pestaña Ejercicios; Carga e Historial se montan después y salen ya puestas) |
| Clientes | título · buscador · las tres cifras · rótulo de la lista · cada fila. La ficha de un cliente no |
| Plantillas | título · conmutador · cada plantilla |

**Probar U14-03**

- [ ] Sesión, Progresión, Clientes y Plantillas: al llegar desde otra pestaña, los bloques suben y aparecen uno detrás de otro.
- [ ] Sesión, Progresión y Clientes entran más deprisa que Programa y Plantillas.
- [ ] En Sesión la tarjeta del programa ya está al llegar: de Programa a Sesión no salta.
- [ ] Volver a Sesión al terminar o cerrar un entreno no repite la entrada.
- [ ] En Sesión, plegar y desplegar una sesión sigue sin saltos: las de debajo se deslizan.
- [ ] En Progresión, el desplegable «Filtrar ejercicios» sigue saliendo por encima de la lista.
- [ ] En Clientes, abrir la ficha de un cliente y volver a la lista no repite la entrada.
- [ ] Cambiar de segmento (Plantillas: Programas/Sesiones; Progresión: Carga) no repite la entrada.
- [ ] La ficha de cliente (Progreso y Programa) sale sin animar.
- [ ] Con «reducir movimiento» del sistema, todo aparece sin animar.

**Probar U14-01**

- [ ] Inicio → tocar la tarjeta del programa: en Programa la tarjeta queda en el mismo sitio, con la misma ceja, nombre, semana y barra; no salta.
- [ ] Lo mismo tocando el tab Programa en la barra de abajo.
- [ ] La tarjeta se alarga hacia abajo y luego entran los botones y las etapas, una pieza detrás de otra.
- [ ] «Esta etapa»: el número (en lima) y el nombre de la etapa debajo de la ceja, y a la derecha «SEMANA 3/4» con los tramos encendidos hasta la semana en curso.
- [ ] Una etapa alargada (con semanas añadidas) enseña su total con las añadidas.
- [ ] Una etapa sin límite: «SEMANA N» sin tramos.
- [ ] Recién cambiada de etapa (sin empezar): «SIN EMPEZAR» y los tramos apagados.
- [ ] Programa de una sola etapa sin límite: sin «Esta etapa»; las cifras siguen.
- [ ] Las cifras en Barlow, centradas y sin color (un 100 % ya no sale en rojo).
- [ ] Los dos cortes horizontales tienen el mismo grosor que la diagonal.
- [ ] Con un programa de entrenador sale «● por Nombre» en azul debajo de la barra; con uno propio, no.
- [ ] Tocar «SEMANA» arriba a la derecha abre la ficha de la semana.
- [ ] En Programa, tocar el nombre del programa (la fila de arriba) vuelve a Sesión; tocar «Esta etapa» o las cifras no hace nada.
- [ ] Cambiar de etapa o volver del editor no repite la animación.
- [ ] Con «reducir movimiento» del sistema, todo aparece sin animar.
- [ ] Ficha de un cliente (entrenador): la tarjeta del programa es la misma que la del tab Programa, con «PROGRAMA ASIGNADO», la semana y la etapa del cliente, «Esta etapa» y las cifras; sin «● por».
- [ ] Cliente que terminó la etapa y no avanza: la nota sale debajo de «Esta etapa».

## 5. U14-02 — Las etapas

Debajo de los botones (`ProgramActions`, sin cambios, 4 dp bajo la tarjeta). Solo
con dos o más etapas, como hoy.

### 5.1 El rótulo

24 dp por encima, 10 por debajo, 4 de sangría: «ETAPAS» (`caps`, `text`) a la
izquierda y «4 · 12 SEMANAS» (`caps`, `mutedLight`) a la derecha. Las semanas,
con `programTotals()` del editor (P14 §3.2), «12+» si alguna es sin límite.
Sustituye al título de `Section` de hoy.

### 5.2 Las filas

Una por etapa que **no** es la en curso, 6 dp entre ellas. Sustituyen a los
`MenuRow` de `StageList`.

- Caja `surface`, radio `lg` (18), alto mínimo 66, relleno 12/16, 14 dp entre
  piezas.
- Izquierda, **el número** de la etapa en Barlow (`heroName`), ancho mínimo 20, 2
  dp de aire a la derecha: `text`; `muted` si está hecha; `blue` si es de descarga
  (`stage.rx?.progressionHold === 'deload'`, como `isDeload` del editor).
- En medio, el **nombre** (`itemTitleQuiet`; `mutedLight` si está hecha) y debajo
  la meta en `label` `mutedLight`: «sem 9-11 · 4 sesiones por semana». El tramo es
  el del editor (`stageWeekRanges` de `utils/stageStats.js` y las claves
  `editor.stageRange*`; mejor sacar `rangeLabel` de `ProgramEditorScreen` a un
  helper compartido que copiarlo). Las sesiones, `home.stageSessionsPerWeek`.
- Derecha, la marca: **hecha** → ✓ en un círculo de 22 `surface3` con el ✓ en
  `mutedLight`; **por venir** → anillo de 22 con borde de 2 en `muted` (se elige);
  **bloqueada** → el candado de hoy (`LockIcon`, `muted`), fila desactivada y meta
  `home.stageLockedShort`, como ahora.
- **Elegir se nota** (O03 §3.1.3): al tocar una fila, se rellena de `accent` desde
  el centro de su marca de la derecha, en 450 ms out cubic (el mismo relleno que
  las entradas del paywall y las pestañas de Inicio, U13-02), el texto pasa a
  `onAccent` (lo pequeño al 68 %) y el anillo desaparece. El toque lleva 100 ms
  de retraso (`unstable_pressDelay`): sin él, empezar un scroll encima de una
  fila la encogía. Lo mismo en las fichas del editor. A los ~300 ms se abre la
  hoja de §5.4. Si se cancela, el relleno se recoge.

### 5.3 La ficha de la en curso

En su sitio de la lista (entre las hechas y las por venir), en vez de fila:

- Caja `surface`, radio `lg` (18), relleno 14 arriba, 16 a los lados y abajo. **Sin
  relleno lima ni borde**: destaca por tamaño.
- Ceja «EN CURSO · SEMANA 3 DE 4» (`caps`, `accent`). Sin empezar: «EN CURSO · SIN
  EMPEZAR». Sin límite: «EN CURSO · SEMANA 3». Con semanas añadidas, el total con
  ellas.
- El **número y el nombre**, en Barlow, a 4 dp: el número en `heroGlyph` (34)
  `accent`, el nombre en `heroName` (28) `text` en mayúsculas, alineados por abajo,
  6 dp entre ellos. Es la misma forma que la tarjeta de la sesión que toca en
  Inicio (letra + nombre).
- La meta, como en las filas, en `body` `mutedLight`: «sem 5-8 · 3 sesiones por
  semana».
- A 12 dp, **la barra corta**: 132 dp de ancho, un tramo por semana de la etapa
  (con las añadidas), 8 de alto, radio 2, inclinados −12°, 4 dp entre ellos;
  encendidos en `accent` hasta la semana en curso, apagados en `surface3`. A su
  derecha, a 12 dp, **las sesiones** en `body`: «**7** de 12 sesiones» (el hecho en
  `bodyStrong`), con `status.done` y `status.expected` de toda la etapa. Sin
  empezar, igual: «**0** de 12 sesiones» (la ceja ya dice «sin empezar»; la frase
  larga de antes sobraba). Sin límite: sin barra y «7 sesiones».
- De descarga: la ceja y el número en `blue`, y los tramos encendidos en `blue`.
- No se pulsa.

La semana de la etapa sale dos veces (tarjeta y ficha). Es a propósito por ahora;
si sobra al probarla, la ficha se queda solo con las sesiones.

**El editor, igual** (13-oct): la cabecera de la etapa del editor de programa
(P14 §3.4) usa el mismo número (`heroGlyph`), nombre (`heroName` en mayúsculas) y
meta en `body` que esta ficha, pero la meta dice las **semanas** («4 semanas · 3
sesiones por semana»; sin límite, «Sin límite»): el tramo ya está en las fichas de encima.

### 5.4 La hoja de cambio de etapa

Sustituye al `showDialog` de `confirmStage`, con el mismo texto y la misma lógica
(`setCurrentStage`):

- `DragSheet` **sin `title`** (el titular va dentro).
- Titular en Barlow (`heroName` en mayúsculas), con el nombre de la etapa en lima:
  «CAMBIAR A *INTENSIFICACIÓN*». Para la palabra en lima, `Marked` de
  `PaywallModal.jsx` (sacarlo a `ui/` si se reutiliza aquí).
- Debajo, en `body` `mutedLight` (`lineHeight` 21): `myProgram.stageConfirm.bodyStarted`
  si la etapa en curso ya se empezó, `myProgram.stageConfirm.body` si no.
- Botón lima a todo el ancho, «CAMBIAR DE ETAPA» (`button`, `onAccent` sobre
  `accent`, radio `md`), y debajo «Cancelar» de texto (`bodyStrong`,
  `mutedLight`). Es la única acción lima de la pantalla.
- Cerrar la hoja de cualquier forma = cancelar: el relleno de la fila se recoge.
- Al confirmar, la pantalla se repinta con la etapa nueva **sin repetir la
  entrada por partes** (§4.3).

**Probar U14-02**

- [ ] Con dos o más etapas: rótulo «ETAPAS» con «N · M SEMANAS» a la derecha.
- [ ] Las hechas: número apagado, nombre en gris y ✓ a la derecha.
- [ ] La en curso sale en ficha: «EN CURSO · SEMANA 3 DE 4», el número y el nombre en Barlow, la meta, la barra corta y «N de M sesiones».
- [ ] Una etapa de descarga se ve en azul (número; y en la ficha, ceja y tramos).
- [ ] Tocar una por venir: se rellena de lima desde el anillo y se abre la hoja «CAMBIAR A …» con el nombre en lima.
- [ ] Cancelar o cerrar la hoja: el relleno se recoge y no cambia nada.
- [ ] Confirmar: la etapa elegida pasa a ser la ficha «EN CURSO · SIN EMPEZAR» y la tarjeta de arriba lo refleja.
- [ ] El texto de la hoja avisa de que se pierde lo hecho solo si la etapa en curso ya había empezado.
- [ ] Programa de un entrenador con etapas bloqueadas: candado, fila desactivada, «La abre tu entrenador».
- [ ] Con una sola etapa no sale la lista.
- [ ] Hacer scroll empezando encima de una fila no la encoge; tocarla sí. Igual con las fichas del editor al desplazarlas.
- [ ] En el editor de programa, la cabecera de la etapa lleva el número y el nombre en Barlow y la meta «4 semanas · N sesiones por semana» (sin el tramo, que va en las fichas).

## 6. Textos nuevos

En `es.json` y `en.json`, por línea (sin reformatear el archivo):

| Clave | es | en |
|---|---|---|
| `myProgram.thisStage` | Esta etapa | This stage |
| `myProgram.stageWeekShort` | Semana {{week}}/{{total}} | Week {{week}}/{{total}} |
| `myProgram.stageNow` | En curso | Current |
| `myProgram.stageSessionsOpen_one` / `_other` | {{count}} sesión / {{count}} sesiones | {{count}} session / {{count}} sessions |
| `myProgram.stagesTotal` | {{count}} · {{weeks}} semanas | {{count}} · {{weeks}} weeks |
| `myProgram.stageConfirm.cta` | Cambiar de etapa | Change stage |

Se reutilizan: `home.stageDefault`, `home.stageSessionsPerWeek`,
`home.stageLockedShort`, `programCard.stageWeek`, `programCard.stageWeekOpen`,
`programCard.stageNotStarted`, `programCard.stageSessions`,
`programCard.statAdherence/statPace/statLoad`, `programCard.sessionsPerWeek`,
`myProgram.stagesLabel`, `myProgram.stageConfirm.*`, `common.cancel`,
`editor.stageRange*`. `myProgram.stageConfirm.confirm` («Cambiar») deja de usarse.

## 7. Código que se toca

| Qué | Dónde |
|---|---|
| Tarjeta con despliegue | `src/components/HomeProgramCard.jsx` |
| Pantalla: padding, tarjeta, lista, hoja | `src/screens/MyProgramScreen.jsx` (`StageList`, `confirmStage`, `computeStageInfo`) |
| Tramo «sem 5-8» compartido | sacar `rangeLabel` de `src/screens/ProgramEditorScreen.jsx`; `stageWeekRanges` en `src/utils/stageStats.js` |
| Total de semanas | `programTotals()` de `src/utils/stageProgress.js` (P14 §3.2) |
| Titular con palabra en lima | `Marked` en `src/components/PaywallModal.jsx` |
| Relleno desde la marca | el del paywall / `StageCards.jsx` (círculo que escala, `FILL_MS` 450) |
| Hoja | `src/components/DragSheet.jsx` |
| Lo de debajo de la tarjeta, compartido con la ficha de cliente | `src/components/ProgramCardDetail.jsx` |
| Ficha de cliente | `src/screens/ClientsScreen.jsx` (`AssignedProgramCard`); `ui/ProgramCard.jsx` queda solo con `ProgramActions` |

Nada de `fontSize`/`fontWeight` propios: los papeles de `textStyles` citados
arriba. Radios y colores del tema `formaFit`.

## 8. Fases

| Fase | Qué | Depende de | Estado |
|---|---|---|---|
| U14-01 | Tarjeta de Inicio desplegada en Programa: «Esta etapa», cifras, animación | — | ✅ sin commit — `HomeProgramCard` (`children`, `onWeekInfo`), `MyProgramScreen`; `Unfold`/`Rise` en `ProgramStages.jsx` |
| U14-03 | Entrada por partes en Sesión, Progresión, Clientes y Plantillas | U14-01 | ✅ sin commit — `hooks/useEnterClock.js`, `ui/Rise.jsx` |
| U14-02 | Etapas: rótulo, filas, ficha de la en curso, hoja de cambio | U14-01 (orden de pantalla) | ✅ sin commit — `src/components/ProgramStages.jsx`; `Marked` a `ui/`; `stageRangeLabel` e `isDeload` a `utils/stageStats.js` |
