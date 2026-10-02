# Spec — Asignar programas: una puerta, cualquier origen

> Tema: conexión
> En corto: Darle un programa a un cliente se hace desde un solo botón, «Asignar programa», que deja elegir el origen: en blanco, una plantilla, el programa de otro cliente o un archivo. Desde cualquier programa se puede copiar a otro cliente o guardar como plantilla. Un programa siempre se copia, nunca se comparte.
> Fase C29 · terminado · Las copias de programas conservan la cadena entre etapas · §3
> Fase C30 · hecho · «Asignar programa»: una hoja con cuatro orígenes · §4
> Fase C31 · pendiente · Copiar a otro cliente y guardar como plantilla · §5
>
> Estado: C29 terminada y C30 hecha y probada (2-oct-2026); C31 pendiente. Spec cerrada el 1-oct-2026. Sin maqueta: las hojas
> reutilizan piezas que ya existen (`SheetRow`, `ChoiceRow`, `AssignSheet` de
> Plantillas, `NewProgramSheet`). Sale del mismo análisis que
> [`editor-vinculacion.md`](editor-vinculacion.md), y el usuario aprobó la
> propuesta sin cambios. Orden: C29 primero, porque C30 y C31 hacen que se copien
> muchos más programas.

## 1. Contexto y decisiones cerradas

### 1.1 Lo que había

| Quiero… | Antes |
|---|---|
| Programa en blanco → cliente | ✅ «Nuevo programa» (pestaña En blanco) |
| Plantilla → cliente | ✅ Plantillas → «Asignar», o desde el cliente (pestaña De plantilla) |
| Archivo → cliente **sin** programa | ❌ «Importar» solo está en el ··· de la tarjeta de programa, que solo existe si ya hay uno |
| Programa del cliente X → cliente Y | ❌ |
| Programa de un cliente → plantilla | ❌ |
| Programa archivado → otro cliente | ❌ |

Además, el importar del cliente (`ClientImportModal`, `ClientsScreen.jsx`) mezcla
dos intenciones en una hoja: traer un programa (`replace`, `replace_log`) y traer
entrenos (`merge_log`).

### 1.2 Lo que lo hace barato

`cloneProgramFromTemplate(sourceId, { owner, kind, name })` (`useStore.js`)
copia **cualquier** programa, no solo plantillas: copia las sesiones con ids
nuevos, pone el progreso a cero, deja el programa activo si el cliente no tenía
y abre el editor. «De otro cliente» y «Guardar como plantilla» son esa misma
llamada con otro origen o con `kind: 'template'`.

### 1.3 Decisiones (no reabrir)

- **Un programa siempre se copia, nunca se comparte.** Cada copia es
  independiente. Una plantilla es un programa sin dueño (`kind: 'template'`).
- **Una sola puerta en la ficha del cliente**: «Asignar programa» sustituye a
  «Nuevo programa», tenga o no programa activo.
- **Desde cualquier programa** (activo o archivado): «Copiar a otro cliente» y
  «Guardar como plantilla».
- **Importar historial va aparte** de importar programa.
- **No hay sincronización plantilla → copias** («actualizar a todos los que la
  usan»): choca con que cada copia se adapta a su cliente. Si algún día hace
  falta, será una acción explícita, no un vínculo vivo.

## 2. Qué no cambia

- El modelo `owner` / `kind` (`src/utils/programOwnership.js`), un activo por
  cliente, el archivado del anterior al reemplazar (`assignActiveProgram`) y el
  aviso de reemplazo (`confirmReplaceActive`).
- La subida al cliente con app: el programa nuevo queda `programDirty` como hoy;
  el invitado se sube solo (C28) y el conectado enseña «Subir».
- La pantalla Plantillas y su «Asignar» siguen igual (C31 reutiliza su hoja).

## 3. C29 — Las copias conservan la cadena entre etapas

**Bug.** `cloneProgramFromTemplate` copia cada sesión con `...srcTemplate`, así
que `derivedFrom` sigue apuntando a la sesión **del original**. En la copia de un
programa de varias etapas, las sesiones de la etapa 2 apuntan a la etapa 1 del
original y no a la de la copia. `templateChainIds` corta ahí (en el móvil del
cliente esa plantilla no existe, y en el del entrenador no tiene entrenos de ese
cliente), y el día que el cliente pasa a la etapa 2 no ve pesos de referencia
(ni fantasmas ni chip de progresión). Pasa ya hoy al asignar plantillas de
varias etapas.

**Arreglo.** En `cloneDays`, un mapa `idViejo → idNuevo` de todas las sesiones
copiadas. Después de copiar todas las etapas, se reescribe `derivedFrom` de cada
copia con el mapa. Si apunta a algo de fuera del programa copiado, pasa a
`null`: no hay de dónde heredar. `linkGroup` no necesita cambio, porque los
grupos se buscan dentro de su programa. `stage.id` y `derivedFromStageId` se
copian tal cual: ya son locales al programa.

**Test** en `useStore.test.js`: programa de dos etapas con `derivedFrom` de la 2
a la 1 → clonar → `templateChainIds` de una sesión de la etapa 2 de la copia
llega a la sesión de la etapa 1 **de la copia**, y ningún `derivedFrom` de la
copia apunta a un id del original.

Sin pruebas a mano: al cerrar, `terminado`.

## 4. C30 — «Asignar programa»: una hoja con cuatro orígenes

Sustituye a `NewProgramSheet` (pestañas En blanco / De plantilla).

### 4.1 Dónde se abre

- Estado vacío del tab Programa (`noActiveBox`): el botón pasa a **«Asignar
  programa»**.
- Menú ··· de `AssignedProgramCard`: «Nuevo programa» pasa a **«Asignar
  programa»**, y desaparece «Importar programa».

### 4.2 La hoja

`DragSheet` «Asignar programa». Si el cliente ya tiene programa activo, una
línea arriba: «Sustituye a **{{name}}**, que pasa a Programas anteriores».
Sustituye al diálogo de `confirmReplaceActive`: el aviso se lee antes de elegir,
como ya hace `AssignSheet` en Plantillas.

Paso 1, **origen**: filas `MenuRow` + `RowIcon` (icono y galón) en una
`Section`. **No `SheetRow`**: esa cierra la hoja al tocarla, y aquí hay que
pasar al paso 2.

| Origen | Paso 2 |
|---|---|
| **En blanco** | el formulario de hoy: nombre, sesiones, semanas o «sin límite» |
| **Plantilla** (si hay alguna) | lista de `templatesOf(programs)` |
| **De otro cliente** (si hay algún programa que copiar) | lista agrupada (§4.3) |
| **Desde archivo** | selector de archivo → §4.4 |

Paso 2 dentro de la misma hoja, cambiando de página como en
[`editor-vinculacion.md`](editor-vinculacion.md) §5.3: nada de dos `Modal` seguidos.
`DragSheet` gana una prop `onBack`: con ella, «‹» a la izquierda del título
vuelve al paso 1 (la misma que usará P50).
Las listas de origen son `ChoiceRow` y abajo va el nombre (prellenado con el del
origen, editable, `NameField`) y el botón **«Asignar»**.

El botón del paso 2 va **fijo al pie de la hoja**, fuera del scroll (QA 2-oct-2026:
con una lista larga, al elegir no se veía qué hacer después). `DragSheet` gana una
prop `footer` para eso.

Al asignar: `cloneProgramFromTemplate(id, { owner: clientId, name })` +
`setClientActiveProgram`, igual que hace hoy `handleCreateFromTemplate`, y se abre
el editor.

### 4.3 «De otro cliente»

Todos los programas que no son plantilla (`kind !== 'template'`), **menos el
activo de este cliente**, agrupados por dueño: «Tuyos» (`owner: 'me'`) y un
grupo por cliente, ordenados por nombre. Subtítulo de cada fila:
`N sesiones · N etapas`.

Arriba, un `SegmentedControl` **«Activos | Archivados»** (QA 2-oct-2026: con todo
mezclado, solo «Tuyos» ya eran 6 o 7 filas). Activos = el activo de cada dueño;
Archivados = el resto, los más recientes primero (`programsOf`). Sin etiqueta
«activo»: ya lo dice el segmentado. Nace en Activos; si una de las dos vistas
está vacía no hay segmentado y se enseña la otra.

Entran también los archivados del propio cliente. Para volver a uno tal cual ya
está «Reactivar»; esto lo copia de cero (progreso nuevo).

### 4.4 «Desde archivo»

`handleImportPick` de hoy: `DocumentPicker` → `parseImportFile`, con la hoja
abierta.

- Archivo sin programa → el error de hoy («El archivo no contiene ningún
  programa») y se queda en el paso 1.
- Con programa → **siempre** paso 2 (decidido el 2-oct-2026: los cuatro
  orígenes acaban en «Asignar»): nombre del archivo y nombre del programa que
  trae, y «Asignar» → `importForClient(clientId, data, 'replace')`. Sin campo de
  nombre: se importa con el suyo.
- Con programa **y** entrenos → en ese paso 2, además, un `ToggleRow`
  «Importar historial (N)», apagado por defecto. Encendido
  → modo `replace_log`.
- Importar no abre el editor (como hoy).

### 4.5 «Importar historial»

En el menú ··· de la tarjeta, debajo de Exportar: **«Importar historial»** →
selector → `importForClient(clientId, data, 'merge_log')`, con el toast de hoy.
`ClientImportModal` desaparece.

Sin programa activo **no** hay «Importar historial» ni ··· nuevo (decidido el
2-oct-2026): sin programa, lo que se importa es un programa, y «Desde archivo»
ya trae su historial si se quiere.

### 4.6 i18n (es / en)

`clients.assignProgram`, `clients.assign.title`, `.replaces`, `.fromBlank`,
`.fromTemplate`, `.fromClient`, `.fromFile`, `.mine`, `.activeTag`,
`.withHistory`, `.assignBtn`, `clients.menuImportHistory`. Se borran
`clients.newProgramModal.tab*`, `clients.importModal.*` y `clients.menuImport`.

**Probar C30**

- [x] Cliente sin programa → botón «Asignar programa» → salen los orígenes:
  En blanco y Desde archivo siempre; Plantilla solo si hay plantillas; De otro
  cliente solo si hay algún programa que copiar.
- [x] Tocar un origen → la página se desliza y aparece «‹» junto al título;
  «‹» vuelve a los orígenes sin cerrar la hoja. Cerrar la hoja desde la página 2
  y reabrirla → empieza otra vez en los orígenes.
- [x] En blanco → el formulario de antes (nombre, sesiones, semanas) →
  «CREAR Y EDITAR» crea el programa y abre el editor.
- [x] Plantilla → filas con radio, ninguna elegida y «ASIGNAR» apagado → al
  elegir una se rellena el nombre → «ASIGNAR» → abre el editor con la copia.
- [x] De otro cliente → grupo «Tuyos» y un grupo por cliente por orden
  alfabético; en cada uno el activo primero con la etiqueta «activo»; cada fila
  dice «N sesiones · N etapas». El activo de ESTE cliente no sale; sus programas
  anteriores sí.
- [x] Asignar uno de otro cliente → se abre el editor con la copia; editarla
  no cambia el programa del otro cliente.
- [x] Desde archivo → se abre el selector con la hoja abierta (probarlo
  también en iPhone) → página con el nombre del programa y del archivo →
  «ASIGNAR» → queda como activo, sin abrir el editor.
- [x] Desde archivo con un archivo sin programa → diálogo «El archivo no
  contiene ningún programa» y la hoja sigue en los orígenes.
- [x] Archivo con entrenos → sale «Importar historial (N)», apagado. Apagado → el historial del cliente no cambia; encendido →
  los entrenos aparecen en su historial.
- [x] Cliente con programa activo → arriba de la hoja, en naranja,
  «Sustituye a X, que pasa a Programas anteriores»; al asignar no sale ningún
  diálogo de confirmación, y el anterior está en Programas anteriores.
- [x] ··· de la tarjeta → «Asignar programa» (ya no «Nuevo programa») abre
  la hoja; ya no está «Importar programa».
- [x] ··· → «Importar historial» (debajo de Exportar) → elegir un archivo
  con entrenos → toast «N sesiones importadas», el programa activo no cambia.
- [x] Cliente con app: el programa asignado queda pendiente de subir (o se
  sube solo si es invitado), como antes.

## 5. C31 — Copiar a otro cliente y guardar como plantilla

### 5.1 Dónde

- Menú ··· de `AssignedProgramCard` (programa activo).
- Menú de `ArchivedProgramRow` (Programas anteriores), junto a Reactivar.
- Programas propios del entrenador (`owner: 'me'`): donde ya tengan menú, lo
  mismo. Si no lo tienen, se deja para cuando lo tengan.

### 5.2 «Copiar a otro cliente»

Abre la `AssignSheet` de Plantillas (`ProgramScreen.jsx`), que se mueve a
`components/AssignProgramSheet.jsx` para usarla en las dos pantallas. Ya trae lo
necesario: lista de clientes con «sustituye a X» o «sin programa» en cada fila,
nombre de la copia y «Asignar». Desde la ficha de un cliente, ese cliente no sale
en la lista. Al asignar, toast «Copiado a {{client}}» y **no** se abre el editor
(no navegar fuera de la ficha que estabas mirando). Hoy
`cloneProgramFromTemplate` con `owner` de cliente fija `_editingProgramId`; se
añade una opción `{ open: false }` para no hacerlo.

### 5.3 «Guardar como plantilla»

`cloneProgramFromTemplate(id, { kind: 'template', name })`, con el nombre del
programa sin sufijo (el usuario lo renombra en Plantillas si quiere). Toast
«Guardado en Plantillas». Sin hoja: es reversible borrando la plantilla.

### 5.4 i18n (es / en)

`clients.menuCopyTo`, `clients.menuSaveTemplate`, `clients.toastCopiedTo`,
`clients.toastSavedTemplate`.

**Probar C31**

- [ ] Programa activo de X → ··· → «Copiar a otro cliente» → elegir Y → Y tiene una
  copia como activo; seguimos en la ficha de X.
- [ ] La copia de Y empieza en su etapa 1 sin progreso, aunque X fuera por la 3.
- [ ] Programa archivado → «Copiar a otro cliente» funciona igual.
- [ ] ··· → «Guardar como plantilla» → aparece en Plantillas; editarla no cambia el
  programa del cliente.
- [ ] Programa de varias etapas copiado a otro cliente → al pasar a la etapa 2,
  la primera sesión enseña los pesos de la etapa 1 de **esa** copia (C29).

## Fases

| Fase | Qué | Depende de | Coste | Estado |
|---|---|---|---|---|
| C29 | `derivedFrom` reescrito en `cloneProgramFromTemplate` + test | — | 🟢 | ✅ eeb598f — derivedFrom remapeado dentro de la copia + test |
| C30 | Hoja «Asignar programa» con cuatro orígenes; «Importar historial» aparte | C29 | 🟡 | ✅ 15351db — `AssignProgramSheet` de dos páginas, `DragSheet.onBack`, `copySources` + test |
| C31 | «Copiar a otro cliente» y «Guardar como plantilla» en los menús de programa | C29 | 🟢 | pendiente |
