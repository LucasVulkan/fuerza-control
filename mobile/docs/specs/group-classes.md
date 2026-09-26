# Spec — Clases y sesiones asignadas

> Tema: conexión
> En corto: El entrenador puede tener grupos (clases colectivas) además de clientes, asignar sesiones libres a un cliente o a un grupo, abrir cualquier sesión en modo pizarra para darla y apuntar «clase dada».
> Fase C23 · pendiente · El grupo como tipo de cliente · §3
> Fase C24 · pendiente · Sesiones libres de un cliente o de un grupo · §4
> Fase C25 · pendiente · Modo pizarra · §5
> Fase C26 · pendiente · Clase dada · §6
>
> Estado: **spec cerrada, SIN implementar** (26-sep-2026). Sale de la misma
> sesión de diseño que [trainer-logging.md](trainer-logging.md). Escrita después
> de leer el código, con fichero y línea, pero hay que volver a comprobarlas
> antes de cada fase.
>
> **Depende de [free-sessions.md](free-sessions.md) T19-T21** para la C24
> (sesiones libres con `owner`, §4.1.1 de esa spec). La C23 y la C25 no
> dependen de nada.

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

## 3. Fase C23 — El grupo como tipo de cliente

`client.kind: 'individual' | 'group'`. Si falta, vale `'individual'`.

**Crear.** La hoja de nuevo cliente añade un selector «Cliente / Grupo».
`createClient(name, { kind })` (`useStore.js:606`). **Un grupo no crea slot en
Supabase**: sin conexión posible, el slot sería un código que no sirve para
nada (hoy se crea en `useStore.js:621` si el entrenador está en modo nube).

**La ficha de un grupo** (`ClientsScreen`, pestañas en `:2456`):

| Pestaña | En un grupo |
|---|---|
| Programas | Igual: programa activo, anteriores, editar |
| Historial | Pasa a llamarse **Clases**: la lista de clases dadas (§6) |
| Progreso | **No aparece**: no hay datos individuales |
| Info | Nombre, notas y facturación. Sin peso corporal ni código de conexión |

**En la lista de clientes:**
- El grupo lleva un marcador de grupo junto al nombre.
- **No entra en la adherencia ni en los avisos** («requiere atención»,
  `ClientsScreen.jsx:1907`), ni en las banderas de
  [client-triage.md](client-triage.md) cuando se implemente. Un grupo que no da
  clase una semana no es un cliente abandonando.
- La línea de estado dice «Última clase hace 3 días».
- Filtro de la lista: «Clientes / Grupos / Todos», dentro de los filtros
  unificados que ya existen.

**Probar en dispositivo.**
> **Probar en dispositivo.** Crear un grupo con el entrenador en modo nube: no
> aparece código de conexión, la ficha no tiene Progreso y el grupo no sale en
> «requiere atención» aunque no tenga clases.

## 4. Fase C24 — Sesiones libres de un cliente o de un grupo

Se apoya en [free-sessions.md](free-sessions.md) §4.1.1: una sesión libre con
`owner: clientId` es de ese cliente o grupo.

### 4.1 En la ficha

Pestaña Programas, debajo del programa: sección **SESIONES LIBRES**, con la
misma sección que Inicio (free-sessions §6.1 la deja reutilizable por props).
- Filas con las sesiones libres del cliente. Al desplegar: **VER** (pizarra,
  §5) y **EDITAR**.
- Debajo, «＋ Sesión libre» → `createFreeTemplate(null, clientId)` → editor en
  modo libre.
- En un cliente **sin conectar**, además, REGISTRAR
  ([trainer-logging.md](trainer-logging.md) §3, si está hecha).

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

**Probar en dispositivo.**
> **Probar en dispositivo (dos móviles).** El entrenador crea una sesión libre
> para un cliente conectado y reenvía. El cliente la ve en Inicio con «de
> {entrenador}», sin EDITAR, y puede hacerla. El entrenador la borra y reenvía:
> desaparece del móvil del cliente, y el historial del cliente la conserva.

> **Probar en dispositivo.** Crear una sesión libre para un grupo: aparece en su
> ficha y **no** en tu Inicio.

## 5. Fase C25 — Modo pizarra

Una pantalla nueva, **`BoardScreen`**, para ver una sesión mientras se da. Es de
solo lectura: no se apunta nada. Se abre con `{ templateId, clientId }` desde:
- la ficha de un grupo: sesiones del programa y sesiones libres, botón
  **PIZARRA** (en un grupo sustituye a EMPEZAR);
- la ficha de un cliente individual: botón **VER** en sus sesiones. Esto cubre
  el punto 3 del problema sin tocar «Ver programa».

**Contenido, de arriba abajo:**
- Cabecera: nombre del grupo o cliente y nombre de la sesión.
- Los ejercicios en el orden de la sesión, con superseries y bloques agrupados
  como en el Workout (`sessionSlots`, `sessionSlots.js:21`). Por ejercicio:
  nombre, prescripción (`targetLabel`, `prescription.js:18`) y la nota o
  limitación si la tiene.
- Los bloques AMRAP/EMOM/For time con **su reloj**: `ConditioningBlockCard` ya
  funciona solo por props (`block`, `state`, `onStart`, `onFinish`…,
  `ConditioningBlockCard.jsx:78`). La pizarra le pasa un estado local
  (`useState`), sin tocar la sesión en curso del store. `ponytail:` si la app
  se cierra a mitad de un bloque, el reloj se pierde (el Workout lo recupera y
  la pizarra no). Si molesta en clase, guardar ese estado en el store como
  `blockState`.
- Pie: **CLASE DADA** (§6), solo en grupos.

**Pantalla siempre encendida** mientras la pizarra está abierta
(`expo-keep-awake`, ya instalado y usado en `ConditioningBlockCard.jsx:29`).

**Diseño: sin nodo de Figma.** La pizarra se lee a un metro, así que el cuerpo
de letra sube. Pero **sin `fontSize` propios**: se usan roles de `textStyles`
(regla de `AGENTS.md`). Probablemente `heroName` para el nombre del ejercicio y
`title` o `heading` para la prescripción (roles en `src/theme.js:143`). **Antes de implementar, una ronda de
maquetas con el usuario**, como se hizo con el recap. Vertical siempre
(decisión §2.3).

**Probar en dispositivo.**
> **Probar en dispositivo.** Abrir la pizarra de una sesión con un AMRAP en el
> móvil y en una tablet, a un metro: se lee sin acercarse, la pantalla no se
> apaga y el reloj del AMRAP funciona.

## 6. Fase C26 — Clase dada

Al pulsar CLASE DADA en la pizarra se abre una hoja pequeña:
- **Cuándo**: chips de los últimos 7 días, «Hoy» marcado. Son los mismos chips
  que trainer-logging §3.1; si esa spec ya está hecha, se reutilizan.
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
  clases. Las filas marcan las dadas esta semana.
- **Etapas:** si el programa del grupo tiene etapas por semanas, `logClass`
  aplica `recordSession` como cualquier entreno (`useStore.js:2295`), así que
  sirve para planificar un trimestre.
- **Pestaña Clases:** una fila por clase dada: sesión, fecha y asistentes. Hay
  que comprobar que `SessionCard` (`SessionCard.jsx`) aguanta una entrada sin
  ejercicios. Si no, fila propia con `GroupedRow`.
- **Los grupos no entran en la carga**: no tienen Progreso (§3), así que el
  panel de carga no se pinta. Ninguna otra pantalla lee el log de un grupo.

**Probar en dispositivo.**
> **Probar en dispositivo.** Grupo con programa A/B/C: dar la A y marcar CLASE
> DADA. En la ficha la siguiente pasa a ser la B, y la pestaña Clases muestra la
> A de hoy con sus asistentes. Marcar una clase de ayer: aparece en su día.

## 7. Orden

```
free-sessions T19-T21 ──→ C24 (sesiones libres de clientes y grupos)
C23 (grupo) ──┬──────────→ C24
              └→ C25 (pizarra) ──→ C26 (clase dada)
```

C23 y C25 pueden empezar ya. Con C23 + C25 + C26 hay clases con programa; la
C24 añade las clases sueltas y las sesiones asignadas a clientes.

## 8. Fuera de alcance

- **Alumnos que entran en una clase** y apuntan sus resultados, ellos mismos o
  el profe: decisión §2.4. Cuando llegue, los resultados se cuelgan de la
  entrada `kind: 'class'` (p. ej. `results: [{ name, … }]`) y el modelo de
  «grupo» ya está.
- **Resultados de la clase tipo box** (ranking de un for time). Mismo sitio.
- **Pizarra en horizontal o en una tele** (§2.3).
- **Varios clientes en el mismo programa** (circuitos): el usuario lo aparcó.
- **Bonos de sesiones** que se descuentan al dar una clase o registrar una
  sesión: su propia spec (ver trainer-logging §7).

## Fases

| Fase | Qué | Depende de | Aceptación |
|---|---|---|---|
| C23 | §3: `kind: 'group'`, sin slot, ficha y lista | — | Prueba de §3 |
| C24 | §4: sesiones libres con dueño cliente, firma, borrado, subida y bajada | free-sessions T19-T21, C23 | Pruebas de §4 (una con dos móviles) |
| C25 | §5: `BoardScreen` con bloques y pantalla encendida, tras la ronda de maquetas | — | Prueba de §5 |
| C26 | §6: `logClass`, pestaña Clases | C23, C25 | Prueba de §6 |
