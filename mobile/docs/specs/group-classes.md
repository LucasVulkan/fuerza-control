# Spec — Clases y sesiones asignadas

> Tema: conexión
> En corto: El entrenador puede tener grupos (clases colectivas) además de clientes, asignar sesiones libres a un cliente o a un grupo, abrir la clase que toca en modo pizarra y apuntar «clase dada».
> Fase C23 · pendiente · El grupo como tipo de cliente · §3
> Fase C24 · pendiente · Sesiones libres de un cliente o de un grupo · §4
> Fase C25 · pendiente · Modo pizarra · §5
> Fase C26 · pendiente · Clase dada · §6
> Fase C27 · hecho · Plantillas de sesión en la pestaña Plantillas y asignarlas a un cliente · §4.6
>
> Estado: **spec cerrada, SIN implementar** (26-sep-2026). Sale de la misma
> sesión de diseño que [trainer-logging.md](trainer-logging.md). Escrita después
> de leer el código, con fichero y línea, pero hay que volver a comprobarlas
> antes de cada fase.
>
> **Revisada el mismo 26-sep** tras el análisis por tipo de entrenador. Cambios:
> los grupos van en **su propia sección** de la lista en vez de un filtro (§3.2),
> la pizarra se abre **desde la lista** (§3.2), la ficha de un grupo reutiliza la
> lista de sesiones de Inicio con PIZARRA como acción (§5.1), la pizarra es **solo
> para grupos** (§2.6) y el WOD diario queda aparcado (§8). Segunda vuelta con el
> usuario: el programa de un grupo **avanza igual que siempre** (§2.5), y un grupo
> **de clases sueltas** no pide programa y elige la clase en dos toques (§2.8).
> Maquetas: [`trainer-models.html`](../mockups/trainer-models.html) y
> [`board.html`](../mockups/board.html) (la pizarra).
>
> **Depende de [free-sessions.md](free-sessions.md) T19-T21** para la C24
> (sesiones libres con `owner`, §4.1.1 de esa spec; ya en main). La C25 reutiliza
> las piezas de lista de sesiones que extrae la C19 de
> [trainer-logging.md](trainer-logging.md) §3.1; si la C25 llega antes, la
> extracción la hace ella.

---

## 1. Problema

La app está pensada para entrenamiento 1 a 1: un cliente, un programa. Hay tres
cosas que el entrenador no puede hacer:

1. **Dar clases colectivas.** En una clase no importa el progreso individual:
   importa tener las sesiones preparadas, abrir la que toca y verla como una
   pizarra. Las clases pueden rotar (A, B, C…) o ser sueltas, sin orden.
2. **Asignar sesiones que no son del programa**: una rutina de movilidad para
   un cliente, o las clases sueltas de un grupo. Hoy solo se asignan programas.
3. **Abrir una sesión de un cliente para verla.** Hoy solo hay dos formas de
   verla: editándola o con «Ver programa», que además no enseña sesiones
   libres.

## 2. Decisiones cerradas

1. **Un grupo es un cliente de otro tipo**, no una entidad nueva. Reutiliza la
   ficha, el programa, el historial y la facturación. Por ahora **nadie se
   conecta a un grupo**: no hay alumnos con app.
2. **En las clases solo se apunta «clase dada»**: qué sesión, qué día y,
   opcionalmente, cuántos asistentes. No hay resultados por persona.
3. **La pizarra es vertical**, para el móvil en la mano o una tablet. Nada de
   modo horizontal ni tele por ahora.
4. **Futuro, fuera de alcance**: que los alumnos «entren» en una clase y
   apunten sus resultados, ellos o el profe (§8). La entrada de «clase dada» es
   donde se colgarán esos resultados, así que no hay que rehacer nada.
5. **El programa de un grupo avanza exactamente igual que el de un cliente**:
   la siguiente es la que más tiempo lleva sin darse (`sessionPlan`), y cada
   clase dada cuenta. Consecuencia conocida y aceptada por ahora: si el mismo
   grupo se da a varias horas, la rotación avanza **por clase**, y a las 19:00
   toca la B aunque esa gente no haya hecho la A. Cualquier fila abre su
   pizarra, así que se elige otra a mano. Lo que lo resolvería de verdad está
   en «Por explorar» (§8): sesiones ligadas a un día de la semana.
6. **La pizarra es solo para grupos.** Para ver la sesión de un cliente
   individual (problema 3) basta con abrir su fila en la ficha: enseña los
   ejercicios, como en Inicio ([trainer-logging.md](trainer-logging.md) §3.1 y
   §4.1 aquí). Un VER más sería un botón que repite lo que ya está.
7. **Un grupo cuenta como un cliente** en el freemium 2+2 de
   [monetizacion.md](monetizacion.md) §4. Es la regla más simple, y un estudio
   con varias clases ya pasa por caja, que es razonable.
8. **Dos formas de grupo, sin ajuste que elegir**: se deducen de lo que tiene.
   - **Con programa**: sesiones que rotan y etapas. La pizarra abre la que
     toca en **un toque**.
   - **Solo con sesiones libres** (clases sueltas, el profe elige cada día): no
     es «un grupo al que le falta programa». La tarjeta dice cuántas sesiones
     tiene, y la pizarra abre una hoja con todas para elegir: **dos toques**.

## 3. Fase C23 — El grupo como tipo de cliente

`client.kind: 'individual' | 'group'`. Si falta, vale `'individual'`.

### 3.1 Crear

La hoja de nuevo cliente añade un `SegmentedControl` **Cliente / Grupo** encima
del nombre. `createClient(name, { kind })` (`useStore.js:606`). Con Grupo:
- El marcador de posición del nombre es «Ej.: Funcional, Pilates…».
- **No crea slot en Supabase**: sin conexión posible, el slot sería un código
  que no sirve para nada (hoy se crea en `useStore.js:621` si el entrenador está
  en modo nube).

### 3.2 En la lista de clientes

- **Sección propia arriba**: etiqueta **GRUPOS** con su número (tratamiento de
  `SectionHeader` de Inicio) y sus tarjetas; después la etiqueta **CLIENTES** y
  el resto. **Sin grupos, no se pinta ninguna etiqueta**: la lista del
  entrenador 1 a 1 se queda exactamente como hoy. La búsqueda filtra las dos
  secciones; el orden y los filtros de la hoja solo afectan a CLIENTES.
- **No hace falta filtro Clientes / Grupos**: la sección ya los separa. El
  contador de la cabecera («CLIENTES · 9») cuenta solo individuales.
- **Tarjeta de grupo**, misma anatomía que `ClientListCard`
  (`ClientsScreen.jsx:1527`):
  - Línea 1: nombre · «Semana NN» si el programa tiene semanas.
  - Línea 2: programa · etapa.
  - Línea 3: «2/3 esta semana · 12 asist.» (media de asistentes de las últimas
    clases que lo tengan; sin datos, no se pinta). **Sin porcentaje**: un grupo
    no tiene adherencia.
  - Hueco derecho: **Pizarra · B**, que abre la pizarra de la clase que toca en
    un toque. Tratamiento *quieto*, `tint.accent10` + texto accent (el de
    «Preparar»), no el relleno sólido de los CTA urgentes: es la acción de
    siempre, no un aviso.
- **Tarjeta de un grupo de clases sueltas** (sin programa, con sesiones libres,
  §2.8). **Sin el aviso «Sin programa activo»**: no le falta nada.
  - Línea 1: nombre, sin «Semana».
  - Línea 2: «6 sesiones» (`bodyStrong`, en el sitio del programa).
  - Línea 3: «2 esta semana · 12 asist.».
  - Hueco derecho: **Pizarra**, mismo tratamiento quieto, que abre la hoja
    «Elegir clase» (§5.1).
- Un grupo **vacío** (sin programa ni sesiones libres): el aviso y el
  **+ Programa** de siempre.
- **No entra en la adherencia ni en los avisos** («requiere atención»,
  `ClientsScreen.jsx:1907`, píldoras de riesgo y el aviso de cambios sin
  enviar), ni en las banderas de [client-triage.md](client-triage.md) cuando se
  implemente. Un grupo que no da clase una semana no es un cliente abandonando.
- Pulsación larga: Pizarra, Editar programa, Info.

### 3.3 La ficha de un grupo

Pestañas (`ClientsScreen.jsx:2459`):

| Pestaña | En un grupo |
|---|---|
| Programa | `ProgramCard` + lista de sesiones con PIZARRA (§5.1) + sesiones libres (§4) |
| Historial | Pasa a llamarse **Clases**: la lista de clases dadas (§6) |
| Progreso | **No aparece**: no hay datos individuales |
| Info | Nombre, notas y facturación. Sin peso corporal ni código de conexión |

`ProgramCard` en un grupo: la ceja dice «Programa del grupo» y las cifras son
dos, **Ritmo** (clases por semana, `recentPerWeek` sobre su log) y **Asistencia**
(media de asistentes). Sin adherencia ni carga. Hasta que exista la C26 el log
está vacío y las dos salen «—».

**Grupo de clases sueltas**: sin `ProgramCard` y **sin la caja «Sin programa
activo»** (`noActiveBox`, `ClientsScreen.jsx:2588`). La pestaña empieza
directamente por SESIONES LIBRES (§4.1), con PIZARRA en cada fila. Debajo de
«＋ Sesión libre», un enlace terciario **Añadir programa** por si algún día lo
quiere.

### 3.4 Probar en dispositivo

**Probar C23**

- [ ] Crear un grupo con el entrenador en modo nube: no
  aparece código de conexión, la ficha tiene Programa · Clases · Info, y el grupo
  sale en la sección GRUPOS de la lista, no en «requiere atención» aunque no
  tenga clases.
- [ ] Entrenador sin grupos: la lista de clientes se ve
  **idéntica** a antes (sin etiquetas de sección).
- [ ] Grupo sin programa y con 3 sesiones libres (tras la
  C24): la tarjeta dice «3 sesiones», sin aviso de programa, y **Pizarra** abre
  la hoja para elegir clase. Dos toques hasta la pizarra.

## 4. Fase C24 — Sesiones libres de un cliente o de un grupo

Se apoya en [free-sessions.md](free-sessions.md) §4.1.1: una sesión libre con
`owner: clientId` es de ese cliente o grupo.

### 4.1 En la ficha

Pestaña Programa, debajo de las sesiones del programa: **SESIONES LIBRES**, con
las mismas filas plegables que Inicio (`SessionRow` sin letra, free-sessions
§6.1). Abierta, la fila enseña los ejercicios y sus botones dependen de la
ficha:

| Ficha | Botones de la fila abierta |
|---|---|
| Cliente conectado | EDITAR · COMPARTIR |
| Cliente sin conectar | EMPEZAR · EDITAR ([trainer-logging.md](trainer-logging.md) §3) |
| Grupo | PIZARRA · EDITAR |

Debajo, «＋ Sesión libre» (contorno, como en Inicio) →
`createFreeTemplate(null, clientId)` → editor en modo libre. Sin sesiones libres,
solo sale ese botón, sin etiqueta de sección.

### 4.2 Editarlas

- Editor en modo libre, igual que las propias.
- Sin «Mostrar en Inicio»: no aplica a una sesión de otro. El interruptor solo
  sale con `owner === 'me'`.
- Al salir, `useEditorExit` marca **a ese cliente** como pendiente de reenviar
  (free-sessions §5 ya lo deja anotado).
- **`_programSig` tiene que incluir las sesiones libres del cliente.** La marca
  de pendiente es por firma (`markProgramDirtyForClients`, `useStore.js:722`):
  si la firma solo mira el programa, editar una sesión libre no cambiaría nada.
  El nombre `markProgramDirtyForClients` se queda; lo que cambia es qué entra
  en la firma.

### 4.3 Borrar un cliente o un grupo

Sus sesiones libres se van con él. `purgeProgram` (`useStore.js:171`) borra las
plantillas de sus programas, y `deleteClient` (`useStore.js:671`) tiene que
borrar además las plantillas con `owner === clientId`.

### 4.4 Llegan al móvil del cliente conectado

Solo clientes individuales conectados: los grupos no tienen móvil al otro lado.

- **Subida:** `_buildProgramJson` (`useStore.js:2609`) añade
  `freeSessions: { [id]: plantilla }` con las sesiones libres del dueño del
  programa. Los ejercicios propios que usen entran en `relCustom`, como los del
  programa.
- **Bajada (cliente):** al importar el programa, las sesiones libres que venían
  del entrenador **se sustituyen enteras** por las nuevas. Así las que el
  entrenador borró desaparecen. Cada una se guarda con:
  - `owner: 'me'`, que en el dispositivo significa «mía», igual que los
    programas recibidos (`useStore.js:2646`);
  - `trainerName`, que ya se sella en las plantillas (`useStore.js:3197`);
  - `fromTrainer: true`, que es lo que la marca como del entrenador.
- **Mismo id** en los dos móviles: así, cuando el entrenador recibe entrenos de
  esas sesiones, sabe cuál de sus sesiones libres era.
- **En el Inicio del cliente:** salen en su sección de sesiones libres, con
  «de {entrenador}» en azul (azul = entrenador). **El cliente no las edita**: sin
  EDITAR y sin interruptor. Si quiere una versión suya, la hace con «Crear».
- Los entrenos que haga con ellas son sesiones libres normales: suben al
  entrenador (free-sessions §4.2) y pueden sustituir un día (free-sessions
  §7.3).

### 4.5 Probar en dispositivo

**Probar C24**

- [ ] (dos móviles) El entrenador crea una sesión libre
  para un cliente conectado y reenvía. El cliente la ve en Inicio con «de
  {entrenador}», sin EDITAR, y puede hacerla. El entrenador la borra y reenvía:
  desaparece del móvil del cliente, y el historial del cliente la conserva.
- [ ] Crear una sesión libre para un grupo: aparece en su
  ficha con PIZARRA y **no** en tu Inicio.

### 4.6 Fase C27 — Plantillas de sesión

Idea del usuario (28-sep): asignar sesiones sueltas desde la pestaña
**Plantillas**, igual que se asignan programas.

**Una plantilla de sesión no es una sesión tuya** (QA 28-sep, cambia la primera
versión). Es una sesión libre con `kind: 'template'`, la misma marca que las
plantillas de programa. Al principio eran la misma cosa que tus sesiones libres,
y eso tenía un problema: si te asignabas una plantilla y la adaptabas para ti,
cambiabas la plantilla. Ahora:
- Las plantillas viven solo en Plantillas › Sesiones. No salen en tu Inicio ni
  en «Mis sesiones libres», no se entrenan y su editor no lleva «Mostrar en
  Inicio» (la ceja dice «Plantilla de sesión»).
- Para entrenarla, te la asignas: la hoja de asignar tiene **Tú** el primero,
  con el mismo gesto que un cliente. Recibes una copia en tu Inicio y la
  adaptas sin tocar la plantilla.
- **Toda sesión libre tuya sale en Inicio** (QA 28-sep). «Mostrar en Inicio» y
  la lista «Mis sesiones libres» existían para tener sesiones guardadas fuera de
  Inicio, y eso ya lo resuelven las plantillas: o es una plantilla, o está
  asignada (a ti o a un cliente). Se retiran los dos; quitar solo la lista
  habría dejado inaccesibles las que estaban ocultas. Para sacar una de Inicio,
  se borra desde su editor.
- En la hoja de «＋ Sesión libre» de Inicio, la tercera opción pasa a ser
  **Desde tus plantillas**, igual que en la ficha de un cliente: tocar una te
  copia la sesión a Inicio. Sin plantillas (sin PRO, o sin haber hecho ninguna)
  no sale.
- Las plantillas creadas antes de este cambio (sin `kind`) aparecen ahora como
  sesiones tuyas en Inicio (sin migración).

**La pestaña** (`ProgramScreen.jsx`):
- Bajo la cabecera, un `SegmentedControl` **Programas / Sesiones**. La cabecera
  dice «PLANTILLAS · N» con el número del segmento, y **+ Plantilla** crea lo
  del segmento.
- **Sesiones**: una tarjeta por plantilla de sesión, con el mismo `TemplateCard`
  (nombre + 3 cifras: ejercicios, bloques y minutos, de `sessionStats`) y
  **Asignar**. Orden: nombre.
- **+ Plantilla** en Sesiones: `createFreeTemplate(null, 'me', { asTemplate: true })`
  → editor en modo libre.
- **Tocar la tarjeta** → hoja: Editar, Duplicar, Eliminar
  (`deleteFreeTemplate`). Duplicar = `copyFreeTemplate(id, { asTemplate: true })`
  con el sufijo « (copia)» de las plantillas de programa.

**Asignar** (`copyFreeTemplate(templateId, { owner: clientId })`, store; la misma
acción duplica con `owner: 'me'`):
- **Copia** la sesión con id nuevo y `owner: clientId`, como `cloneProgramFromTemplate`
  copia un programa. Editar la del cliente no toca la plantilla, y al revés.
- Hoja de asignar: la lista de clientes individuales de `AssignSheet` sin el
  aviso de «reemplaza» (una sesión no sustituye a nada), sin campo de nombre, y
  con **Asignar**. **Selección múltiple** (QA 28-sep): tocar marca, volver a
  tocar desmarca, y el botón dice «Asignar a 3». Cada cliente recibe su copia.
  Tras asignar, toast y la hoja se cierra: no se abre el editor, porque lo
  normal es mandarla tal cual.
- Si el cliente está conectado, queda **pendiente de reenviar** (§4.2, firma).
- **Límite conocido**: las sesiones libres viajan dentro del programa, así que a
  un cliente con app **sin programa** no le llegan hasta que tenga uno. La hoja
  de asignar lo avisa en su fila.

**Desde la ficha** (§4.1): «＋ Sesión libre» abre una hoja con **En blanco** y,
debajo, tus plantillas de sesión (misma forma que `NewProgramSheet`). Es la misma
copia que Asignar.

**Probar C27**

- [x] Plantillas → Sesiones → + Plantilla: se abre el
  editor y la sesión **no** sale en tu Inicio. Asignarla a un cliente: aparece en
  su ficha. Editar la del cliente no cambia la plantilla.
- [x] Asignar una sesión marcando 3 clientes (y desmarcando uno por el camino):
  el botón dice «Asignar a 2», y la sesión aparece en la ficha de esos dos y no
  en la del desmarcado.
- [x] Una plantilla de sesión no sale en tu Inicio y su editor dice «Plantilla de
  sesión». Asignártela (Tú, arriba del todo): la copia sale en tu Inicio;
  cambiarle un ejercicio no cambia la plantilla.
- [x] Inicio › ＋ Sesión libre: la tercera opción es «Desde tus plantillas (N)».
  Tocar una plantilla la añade a tu Inicio. El editor de una sesión tuya ya no
  tiene «Mostrar en Inicio».

## 5. Fase C25 — Modo pizarra

### 5.1 Desde dónde se abre

Una pantalla nueva, **`BoardScreen`**, para ver una sesión mientras se da. Se
abre con `{ templateId, clientId }` desde tres sitios, todos de un grupo:
- **La lista de clientes**: el CTA de la tarjeta (§3.2). Con programa,
  **Pizarra · B** abre la clase que toca en un toque. De clases sueltas,
  **Pizarra** abre la hoja **Elegir clase**: una `DragSheet` con una fila por
  sesión (nombre y «última hace X días», la que más tiempo lleva sin darse
  primero). Al tocar una, pizarra. Dos toques.
- **La ficha del grupo**: la lista de sesiones de Inicio (las piezas que extrae
  [trainer-logging.md](trainer-logging.md) §3.1), con la clase que toca en lima,
  ceja «Siguiente clase» y **PIZARRA · CLASE B**. Las demás en filas plegables
  con PIZARRA y COMPARTIR (C21). Contador «2 de 3 esta semana» como en Inicio.
- **Las sesiones libres del grupo** (§4.1).

Debajo de la lista, **Apuntar clase dada** (contorno): la hoja de §6 sin pasar
por la pizarra, para la clase que se dio sin abrir la app.

### 5.2 Contenido

Maqueta: [`board.html`](../mockups/board.html). Pendiente de la ronda de QA del
usuario antes de implementarla.

**Todo a la vista, en una lista. Nunca un ejercicio a la vez.** En una clase
cada uno va a su ritmo y un circuito se hace en distinto orden por estaciones.
Mostrar un ejercicio a la vez obligaría a todos a ir juntos y al profe a pasar
pantallas. La pizarra enseña **qué hay que hacer**, no por dónde va nadie.

De arriba abajo:
- **Cabecera compacta y fija**: ‹, el grupo en `caps` y la sesión («B · Pierna
  y core») en `heading`. Así la lista de debajo se queda con toda la altura.
- **Los ejercicios en el orden de la sesión**, agrupados como en el Workout
  (`sessionSlots`, `sessionSlots.js:21`). Una fila por ejercicio:
  - el número en `title` y `muted`;
  - el nombre en `heroName` (Barlow Condensed 28), que al ser condensada cabe
    entero a esa escala;
  - la prescripción (`targetLabel` compacto, `prescription.js:18`) a la derecha,
    en `heroGlyph` (34) y **lima**: es lo que se busca desde lejos;
  - debajo, en `body` y `mutedLight`, la carga, el descanso y la nota o
    limitación si las hay.
- **Superseries y circuitos**: un marco `surface` con cabecera `caps`. Con 2
  miembros, «Superserie · 3 rondas» (la cadena del Workout,
  `workout.supersetHeader`, sin «alternando»). Con 3 o más, **«Circuito · 4
  vueltas»** (clave nueva `board.circuitHeader`): en una clase, una cadena
  larga se hace por estaciones y no siempre en orden.
- Los bloques AMRAP/EMOM/For time con **su reloj**: `ConditioningBlockCard` ya
  funciona solo por props (`block`, `state`, `onStart`, `onFinish`…,
  `ConditioningBlockCard.jsx:78`). La pizarra le pasa un estado local
  (`useState`), sin tocar la sesión en curso del store. `ponytail:` si la app
  se cierra a mitad de un bloque, el reloj se pierde (el Workout lo recupera y
  la pizarra no). Si molesta en clase, guardar ese estado en el store como
  `blockState`. El reloj ya va a 44 px (`clock`, única excepción de la escala
  en ese componente) y se lee a distancia. **Sin contador de rondas**: en la
  pizarra nadie apunta. Hay que comprobar si `ConditioningBlockCard` puede
  esconderlo por props; si no, una prop `scoring={false}`.
- Pie fijo: **TERMINAR CLASE**, que abre la hoja de §6 con «Hoy» marcado.
- **Tablet en vertical** (ancho ≥ 600): el mismo contenido en **dos columnas**,
  para que una sesión normal quepa entera sin desplazar. Mismos roles de texto:
  no se agranda nada, se aprovecha el ancho.

**Pantalla siempre encendida** mientras la pizarra está abierta
(`expo-keep-awake`, ya instalado y usado en `ConditioningBlockCard.jsx:29`).

**Diseño: sin nodo de Figma.** La pizarra se lee a un metro, así que el cuerpo
de letra sube. Pero **sin `fontSize` propios**: se usan roles de `textStyles`
(regla de `AGENTS.md`). Los roles elegidos están arriba; los dos más grandes
de la escala (`heroGlyph` y `heroName`) son los de la tarjeta lima de Inicio, así
que la pizarra habla como «lo que toca». Vertical siempre (decisión §2.3).

### 5.3 Probar en dispositivo

**Probar C25**

- [ ] Desde la lista de clientes, Pizarra · B de un grupo
  abre la clase que toca en un toque. Con un AMRAP, en el móvil y en una tablet,
  a un metro: se lee sin acercarse, la pantalla no se apaga y el reloj del AMRAP
  funciona.

## 6. Fase C26 — Clase dada

Al pulsar TERMINAR CLASE en la pizarra, o **Apuntar clase dada** en la ficha
(§5.1), se abre una hoja pequeña:
- **Qué clase**: solo al venir de la ficha. Chips con las sesiones de la etapa,
  la que toca marcada; las libres del grupo al final.
- **Cuándo**: chips de hoy y los 6 días anteriores, «Hoy» marcado. Son los
  mismos chips que trainer-logging §3.2; si esa spec ya está hecha, se
  reutilizan.
- **Asistentes**: un contador opcional (`StepField`), vacío por defecto.
- **GUARDAR**.

`logClass(groupId, templateId, { timestamp, attendees })` escribe en
`clientLogs[groupId]`:

```js
{ id, kind: 'class', sessionTemplateId, sessionName, timestamp,
  attendees: n | null, exercises: [],
  ...(isFree ? { free: true } : {}) }
```

- **La que toca:** `sessionPlan` con el log del grupo funciona sin cambios. La
  sesión que más tiempo lleva sin darse es la siguiente, que es la rotación de
  clases. Las filas marcan las dadas esta semana. **Varias clases el mismo día**
  son varias entradas, y la rotación avanza una por clase (§2.5).
- **Etapas:** si el programa del grupo tiene etapas por semanas, `logClass`
  aplica `recordSession` como cualquier entreno (`useStore.js:2295`), así que
  sirve para planificar un trimestre.
- **Pestaña Clases:** una fila por clase dada: letra, sesión, fecha y
  asistentes. Hay que comprobar que `SessionCard` (`SessionCard.jsx`) aguanta
  una entrada sin ejercicios. Si no, fila propia con `GroupedRow`.
- **Los grupos no entran en la carga**: no tienen Progreso (§3.3), así que el
  panel de carga no se pinta. Ninguna otra pantalla lee el log de un grupo.

**Probar C26**

- [ ] Grupo con programa A/B/C: dar la A desde la pizarra
  y TERMINAR CLASE con 12 asistentes. En la ficha la siguiente pasa a ser la B,
  la tarjeta de la lista dice «Pizarra · B» y «1/3 esta semana · 12 asist.», y la
  pestaña Clases muestra la A de hoy. Apuntar desde la ficha una clase de ayer:
  aparece en su día.

## 7. Orden

```
C19 (trainer-logging: extrae la lista de sesiones) ─┐
C23 (grupo) ─────────────────────────────────────────┼→ C25 (pizarra) ──→ C26 (clase dada)
free-sessions T19-T21 (hecha) + C23 ───────────────────→ C24 (sesiones libres de clientes y grupos)
```

Con C23 + C25 + C26 hay clases con programa; la C24 añade las clases sueltas y
las sesiones asignadas a clientes.

## 8. Fuera de alcance

- **Alumnos que entran en una clase** y apuntan sus resultados, ellos mismos o
  el profe: decisión §2.4. Cuando llegue, los resultados se cuelgan de la
  entrada `kind: 'class'` (p. ej. `results: [{ name, … }]`) y el modelo de
  «grupo» ya está.
- **Resultados de la clase tipo box** (ranking de un for time). Mismo sitio.
- **WOD diario (box)**: aparcado. Una sesión nueva cada día acumula decenas de
  sesiones libres en la ficha, ordenadas por creación y sin archivar. Si se
  retoma, lo mínimo es esconder las ya dadas o enseñar solo las últimas N.
- **Pizarra en horizontal o en una tele** (§2.3).
- **Varios clientes en el mismo programa** (circuitos): el usuario lo aparcó.
- **Bonos de sesiones**: aparcado; la facturación actual podría desaparecer
  (ver trainer-logging §7).

### Por explorar: sesiones ligadas a un día de la semana

Idea del usuario, sin decidir. Que las sesiones de un programa puedan llevar un
día de la semana (A = lunes, B = miércoles…). **La que toca la decide el
calendario y no el historial**: no avanza al hacerla, sino al llegar el día. Se
puede hacer cualquier sesión cuando quieras; el día es la lógica de partida. Así
funciona un estudio que da la misma clase a todas las horas del día, y se acaba
el problema de §2.5. Afectaría también a los programas individuales, así que va
en su propia spec, cruzada con [weeks-model.md](weeks-model.md) (hoy la semana
cuenta sesiones, no días).

## Fases

| Fase | Qué | Depende de | Aceptación |
|---|---|---|---|
| C23 | §3: `kind: 'group'`, sin slot, sección GRUPOS con su tarjeta, ficha y hoja de alta | — | Pruebas de §3.4 |
| C24 | §4: sesiones libres con dueño cliente, firma, borrado, subida y bajada. **Parte individual ✅ `a3f84da`** (ficha, firma, borrado, subida y bajada; tests en `useStore.test.js`). Falta la de grupos (filas con PIZARRA), que va con la C23/C25 | free-sessions T19-T21 (C23 solo para la parte de grupos) | Pruebas de §4.5 (una con dos móviles) |
| C25 | §5: lista de sesiones del grupo con PIZARRA, `BoardScreen` con bloques y pantalla encendida, tras la ronda de maquetas | C23, lista de sesiones de C19 | Prueba de §5.3 |
| C26 | §6: `logClass`, hoja de clase dada, pestaña Clases | C23, C25 | Prueba de §6 |
| C27 ✅ `a3f84da` | §4.6: segmentado Programas / Sesiones en Plantillas, asignar (`copyFreeTemplate`), hoja de «＋ Sesión libre» en la ficha | C24 (la sección de la ficha) | Prueba de §4.6 |

**Orden de implementación acordado (28-sep)**: clientes individuales primero.
C19 ([trainer-logging.md](trainer-logging.md)) → C24 **sin grupos** + C27. Los
grupos (C23, C25, C26) después.
