# Textos por archivo

Generado del código: cada archivo, en qué pantallas aparece y los textos (es.json) que usa. ★ = 60+ caracteres (explicativo).

## components/ActiveSessionBanner.jsx

Aparece en: Home

- `home.running` — En curso
- `home.btnContinue` — CONTINUAR

## components/AppHeader.jsx

Aparece en: Clients, Home, MyProgram, Program, Stats

- `header.namePlaceholder` — Añade tu nombre
- `header.identityRole` — Entrenador · aparece en tus programas
- `header.toastRestored` — Programa restaurado
- `clients.reactivateTitle` — Reactivar programa
- ★ `clients.reactivateConfirm` — "{{name}}" pasará a ser el programa activo y el actual se archivará. ¿Continuar?
- `common.cancel` — Cancelar
- `clients.menuReactivate` — Reactivar
- `clients.deleteProgramTitle` — Eliminar programa
- `clients.deleteProgramConfirm` — ¿Eliminar "{{name}}"?
- `clients.menuDelete` — Eliminar programa
- `clients.toastSavedTemplate` — Guardado en Plantillas
- `header.exportSheetTitle` — Exportar
- `header.exporting` — Exportando…
- `header.exportBackup` — Exportar backup
- `header.exportBackupSub` — Todo: programas, historial y ajustes
- `header.exportProgramHistory` — Exportar programa + historial
- `header.exportProgramHistorySub` — Solo el programa activo y sus sesiones
- `header.bodyWeight` — Peso corporal
- `header.trainerSubGoogle` — reconexión con Google
- `header.trainerSubCode` — sincroniza por código
- `header.trainerSubOff` — Recibe los programas de tu entrenador
- `dayCard.today` — Hoy
- `dayCard.yesterday` — Ayer
- `header.driveSubReconnect` — Requiere volver a conectar
- `header.driveSubOff` — Copia automática de tus datos
- `header.driveSubLast` — Última copia: {{when}}
- `header.driveSubNever` — Sin copias todavía
- `header.syncSubGoogle` — Con cuenta de Google
- `header.syncSubApple` — Con cuenta de Apple
- `header.syncSubCode` — Con código de recuperación
- `header.syncSubOffline` — Solo en este dispositivo
- `header.syncSubNone` — Sin configurar
- `header.sectionPrograms` — PROGRAMAS
- `header.newProgramItem` — Nuevo programa
- `header.archivedProgramsItem` — Programas archivados
- `header.sectionConnections` — CONEXIONES
- `header.trainerRow` — Entrenador
- `header.statusConnected` — Conectado
- `header.statusConnect` — Conectar
- `header.driveRow` — Copia en Google Drive
- `header.statusActive` — Activa
- `header.statusReconnect` — Reconectar
- `header.statusActivate` — Activar
- `header.clientSyncRow` — Sincronización con clientes
- `header.statusSetUp` — Configurar
- `header.sectionData` — DATOS
- `header.exportRow` — Exportar
- `header.exportRowValue` — backup · programa
- `header.importFile` — Importar archivo
- `header.sectionPreferences` — PREFERENCIAS
- `header.units` — Unidades
- `header.language` — Idioma
- `header.theme` — Tema
- `header.proTabsLabel` — Pestañas de entrenador
- `header.proTabsHint` — Muestra las pestañas de Clientes y Plantillas
- `header.homeTabsLabel` — Sesiones en pestañas
- `header.homeTabsHint` — Una sola tarjeta en Inicio, con una pestaña por sesión
- `header.scrubRulerLabel` — Regla al deslizar
- `header.scrubRulerHint` — KG, reps y RPE se ajustan sobre una regla
- `header.sectionAccount` — CUENTA
- `header.planRow` — Plan
- `header.docsRow` — Documentación
- `header.deleteAccountRow` — Eliminar mi cuenta
- ★ `header.deleteAccountSub` — Borra tu cuenta y lo que haya en el servidor. No se puede deshacer.
- `header.sectionDeveloper` — DESARROLLADOR
- `header.plan` — Plan:
- `header.switchToFree` — Cambiar a FREE
- `header.switchToPro` — Cambiar a PRO
- `header.toastSynced` — Historial sincronizado
- `header.toastSyncFailed` — No se pudo sincronizar
- `errors.invalidFile` — Archivo no válido
- `common.error` — Error
- `errors.cannotReadFile` — No se pudo leer el archivo
- `header.toastImported` — Datos importados
- `header.pendingBannerSyncing` — Sincronizando…
- ★ `header.pendingBanner` — ⚠️ Última sesión no enviada al entrenador · Toca para reintentar

## components/ArchivedProgramsSheet.jsx

Aparece en: Clients, Home, MyProgram, Program, Stats

- `clients.programSessions` — {{count}} sesiones
- `clients.noSessionsYet` — Aún sin sesiones
- `archived.title` — Programas archivados
- `archived.reactivate` — Reactivar
- `archived.view` — Ver
- `archived.export` — Exportar
- `archived.saveTemplate` — Guardar como plantilla
- `archived.delete` — Eliminar
- `archived.empty` — No hay programas archivados.

## components/ClientCodeModal.jsx

Aparece en: Onboarding, TrainerConnection

- ★ `trainer.errNoIdToken` — No se devolvió la identidad de la cuenta. Inténtalo otra vez.
- `trainer.errGoogle` — No se pudo conectar con Google.
- `trainer.errApple` — No se pudo conectar con Apple.
- ★ `trainer.errSlotOccupied` — Este hueco ya está ocupado. Pídele a tu entrenador que te genere un código nuevo — tu historial no se pierde.
- `trainer.errCodeNotFound` — Código no encontrado. Comprueba que lo has escrito bien.
- `trainer.codeBack` — Atrás
- `common.cancel` — Cancelar
- ★ `trainer.socialNoSlot` — Esa cuenta no tiene ninguna conexión guardada. Pídele el código a tu entrenador.
- ★ `trainer.socialLead` — Entra con la cuenta que vinculaste y recuperamos tu conexión con el entrenador.
- `trainer.socialSearching` — Buscando la cuenta de entrenador vinculada…
- ★ `trainer.expoGoNote` — El inicio de sesión no funciona en Expo Go. Prueba con la app instalada.
- ★ `trainer.codeLead` — Escribe el código que te ha dado tu entrenador. Son ocho caracteres tipo XK7M-2P4T; el guion se pone solo.
- `trainer.codeContinue` — CONTINUAR
- `trainer.or` — o
- `trainer.googleCta` — RECONECTAR CON GOOGLE
- ★ `trainer.socialCtaHint` — Solo si ya estuviste conectado y vinculaste una cuenta: recupera la conexión sin tener que escribir el código otra vez.
- `trainer.codeProgramLabel` — PROGRAMA
- ★ `trainer.codeAlreadyLinked` — Ya estás conectado con un entrenador. Al continuar dejas de estarlo y pasas a este.
- ★ `trainer.codeSlotOccupied` — Este hueco ya lo ocupa un dispositivo. Si eres tú y has reinstalado la app, tu entrenador tiene que generarte un código nuevo: tu historial se conserva.
- ★ `trainer.codeHistoryFromTrainer` — Tu entrenador ya te ha apuntado entrenos: fusiona el historial para verlos en el tuyo.
- `trainer.codeHistoryLabel` — TU HISTORIAL
- `trainer.codeWhatHappens` — QUÉ PASA AL CONECTAR
- `paywall.privacy` — Privacidad
- `trainer.codeConnectCta` — CONECTAR
- `trainer.codeFoundAccount` — Cuenta encontrada
- `trainer.codeFoundProgram` — Programa encontrado
- `trainer.socialTitle` — Reconectar con mi cuenta
- `trainer.googleTitle` — Reconectar con Google
- `trainer.codeTitle` — Conectar con entrenador
- `trainer.retryCta` — PROBAR OTRA VEZ
- `trainer.codeHistoryProgram` — Solo el programa
- `trainer.codeHistoryMerge` — Programa e historial
- ★ `trainer.codeHistoryProgramSub` — Se importa el programa del entrenador. Tu historial de este móvil no cambia.
- ★ `trainer.codeHistoryMergeSub` — Además se recupera el historial que tu entrenador tiene guardado. Las sesiones repetidas no se duplican.
- ★ `trainer.codeImplies1` — Tu programa actual se archiva y se carga el de tu entrenador.
- ★ `trainer.codeImplies2` — Tu entrenador verá las sesiones que completes de sus programas y las libres a partir de hoy, con el peso que anotes. Puedes desconectarte cuando quieras.
- ★ `trainer.codeImplies3` — Si él cambia el programa, la app te avisa y decides cuándo cambiarlo.
- `trainer.codeImplies4` — Tu historial anterior no se borra ni se le envía.

## components/ClientGoogleLinkModal.jsx

Aparece en: TrainerConnection

- `trainer.linkToast` — Cuenta vinculada
- ★ `trainer.errNoIdToken` — No se devolvió la identidad de la cuenta. Inténtalo otra vez.
- `trainer.linkErrTitle` — No se pudo vincular
- `trainer.linkErrBody` — No se pudo vincular la cuenta. Inténtalo otra vez.
- `trainer.linkTitle` — Vincular cuenta
- `common.cancel` — Cancelar
- ★ `trainer.linkLead` — Vincula una cuenta para recuperar la conexión con tu entrenador en otro móvil sin volver a pedirle el código.
- `trainer.linkWhatHappens` — QUÉ CAMBIA
- `trainer.linkCta` — CONTINUAR CON GOOGLE
- ★ `trainer.expoGoNote` — El inicio de sesión no funciona en Expo Go. Prueba con la app instalada.
- ★ `trainer.linkImplies1` — Tu conexión con el entrenador y tu historial se quedan como están.
- `trainer.linkImplies2` — En otro móvil basta con entrar con la misma cuenta.
- `trainer.linkImplies3` — Ya no tendrás que guardar ningún código.

## components/ClientSessions.jsx

Aparece en: Clients, PasteWorkout

- `clients.logPast.title` — Apuntar sesión pasada
- `clients.logPast.which` — Qué sesión
- `clients.logPast.when` — Cuándo
- `clients.logPast.hint` — Se abre sin reloj ni descansos: solo apuntas lo que hizo.
- `clients.logPast.btn` — APUNTAR
- `paste.fromSheet` — Pegar texto
- `home.sessionMeta` — {{count}} ejercicios · ~{{minutes}} min
- `home.heroMetaLast` — última {{rel}}
- `home.firstTime` — Primera vez
- `home.sessions` — Tus sesiones
- `workout.sessionLabel` — Sesión {{label}}
- `clients.sessionFlag` — Le toca
- `home.rowMinutes` — ~{{minutes}} min
- `clients.logPast.open` — Apuntar sesión pasada
- `freeSession.templateUnnamed` — Sesión libre
- `freeSession.sectionTitle` — Sesiones libres
- `freeSession.badge` — Sesión libre
- `freeSession.btn` — + Sesión libre
- `clients.freeSheet.title` — Sesión libre para {{name}}
- ★ `templates.assignSession.noProgram` — Necesita tener un programa asignado para recibir sesiones libres.
- `clients.freeSheet.blank` — En blanco
- `clients.freeSheet.blankDesc` — Se abre el editor y la preparas para este cliente
- `freeSession.fromTemplates` — Desde tus plantillas
- `freeSession.fromTemplatesDesc` — Crea una copia de la plantilla
- `freeSession.templatesTitle` — Tus plantillas de sesión
- `clients.freeSheet.assigned` — Sesión asignada a {{name}}

## components/DeleteAccountModal.jsx

Aparece en: Clients, Home, MyProgram, Program, Stats

- `deleteAccount.confirmTitle` — Eliminar tu cuenta
- `deleteAccount.confirmBody` — Esta acción no se puede deshacer.
- `common.cancel` — Cancelar
- `deleteAccount.confirmCta` — Eliminar
- `deleteAccount.toastDone` — Cuenta eliminada
- `deleteAccount.errTitle` — No se pudo eliminar la cuenta
- `deleteAccount.errBody` — Inténtalo otra vez en un momento.
- `deleteAccount.title` — Eliminar cuenta
- ★ `deleteAccount.noAccount` — No tienes ninguna cuenta que borrar: esta app está en modo sin conexión y nada tuyo sale de este móvil. Si quieres empezar de cero, desinstala la app.
- ★ `deleteAccount.lead` — Se borra tu cuenta del servidor y todo lo que esté guardado en ella. Esto no se puede deshacer.
- `deleteAccount.whatHappens` — QUÉ SE BORRA
- ★ `deleteAccount.implTrainer` — Tus clientes dejan de estar sincronizados: pierden el programa que les enviaste y su código deja de funcionar.
- ★ `deleteAccount.implClient` — Dejas de estar conectado con tu entrenador y se borra el historial que él tenía tuyo.
- ★ `deleteAccount.implIrreversible` — No hay forma de recuperarlo. Ni con tu código, ni entrando otra vez con Google o Apple.
- `deleteAccount.whatStays` — QUÉ NO SE BORRA
- ★ `deleteAccount.staysLocal` — Tu historial, tus programas y tus ejercicios de este móvil se quedan como están. La app sigue funcionando sin cuenta.
- ★ `deleteAccount.staysPro` — Si tienes Pro no lo pierdes: la compra va con tu cuenta de Apple o Google Play, no con esta. Se recupera con "Restaurar compras".
- `deleteAccount.cta` — ELIMINAR MI CUENTA

## components/DragSheet.jsx

Aparece en: Clients, CustomExercise, Docs, ExerciseEditor, ExerciseSelector, Home, MyProgram, Onboarding, PasteWorkout, ProgramEditor, Program, SessionEditor, StagePlanner, Stats, TrainerConnection, Workout

- `common.close` — Cerrar

## components/editor/BlockEditorInline.jsx

Aparece en: BlockEditor

- `common.delete` — Eliminar
- `blocks.presetSaved` — Preset guardado
- `blocks.deleteBlock` — Eliminar bloque
- `blocks.deleteConfirm` — ¿Eliminar "{{name}}"?
- `common.cancel` — Cancelar
- `blocks.capModes.none` — Sin tope
- `blocks.capModes.cap` — Con tope
- `blocks.intervalCustom` — Custom
- `blocks.summary.amrapMain` — {{min}} min
- `blocks.summary.empty` — Añade movimientos para definir el circuito
- ★ `blocks.summary.emomMain` — {{rounds}} rondas · {{interval}} cada una · {{total}} en total
- `blocks.summary.emomSubOne` — Cada ronda: el movimiento
- `blocks.summary.emomSubRotate` — Cada ronda: 1 movimiento, rotando entre los {{count}}
- `blocks.summary.emomSubAll` — Cada ronda: los {{count}} movimientos completos
- `blocks.summary.forTimeMainCap` — {{rounds}} rondas · tope {{cap}} min
- `blocks.summary.forTimeMainNoCap` — {{rounds}} rondas · sin tope
- `blocks.lapsTipNone` — No llega a una vuelta completa a los {{moves}} movimientos
- `editor.summaryBlock` — RESUMEN DEL BLOQUE
- `blocks.formatLabel` — Formato
- `blocks.emomTypeLabel` — Tipo de EMOM
- `blocks.capLabel` — Tiempo límite
- `blocks.roundsLabel` — Rondas
- `blocks.roundDuration` — Duración
- `blocks.movements` — Movimientos
- `blocks.weightOptional` — Peso opcional
- `blocks.addMovement` — Añadir ejercicio
- `blocks.sectionOptions` — Opciones
- `blocks.nameLabel` — Nombre
- `blocks.notePlaceholder` — Nota para el atleta…
- `blocks.savePreset` — Guardar preset
- `blocks.formats.amrap` — AMRAP
- `blocks.formats.emom` — EMOM
- `blocks.formats.for_time` — For time
- `blocks.emomModes.all` — Repetir bloque
- `blocks.emomModes.rotate` — Rotar ejercicios
- ★ `blocks.emomModeDesc.all` — Cada ronda haces todos los movimientos y descansas el tiempo restante.
- `blocks.emomModeDesc.rotate` — Cada ronda, un movimiento; rotan en orden.
- `blocks.formatDesc.amrap` — Haz tantas rondas como puedas en un tiempo determinado.
- `blocks.formatDesc.emom` — Rondas de tiempo fijo; cada ronda tiene su trabajo.
- `blocks.formatDesc.for_time` — Completa todas las rondas lo más rápido posible.
- `blocks.units.reps` — reps
- `blocks.units.cal` — cal
- `blocks.units.m` — m
- `blocks.units.sec` — seg

## components/editor/ExerciseEditorInline.jsx

Aparece en: ExerciseEditor

- `exerciseEditor.warmup.rampStep` — {{pct}}% × {{reps}}
- ★ `exerciseEditor.effortUnreliable` — A partir de {{max}} reps, contando las de recámara, el cálculo del peso deja de ser fiable
- `exerciseEditor.effortVolume` — {{reps}} reps · RPE {{rpe}}
- `exerciseEditor.warmup.summaryCount` — C×{{n}}
- `exerciseEditor.restSummary` — {{s}}s descanso
- `exerciseEditor.dropsetSummary` — dropset final
- `exerciseEditor.progTitle.none` — Sin progresión
- `exerciseEditor.progTitle.effort` — Por esfuerzo
- `exerciseEditor.warmup.restShort` — {{s}}s
- `exerciseEditor.warmup.noTimer` — sin temporizador
- `exerciseEditor.warmup.rowAutoSub` — {{sets}} series · {{rest}}
- `exerciseEditor.warmup.rowCustomSub` — {{n}} pasos · {{rest}}
- `variants.none` — Sin especificar
- `exerciseEditor.summaryTitle` — RESUMEN DEL EJERCICIO
- `exerciseEditor.sectionVolume` — Volumen
- `exerciseEditor.metricReps` — Reps
- `exerciseEditor.metricTime` — Tiempo
- `exerciseEditor.fieldSets` — Series
- `exerciseEditor.fieldRest` — Descanso
- `exerciseEditor.fieldStartTime` — Tiempo de inicio
- `exerciseEditor.fieldMinTime` — Tiempo mín
- `exerciseEditor.fieldMaxTime` — Tiempo máx
- `exerciseEditor.fieldMinReps` — Reps mín
- `exerciseEditor.fieldMaxReps` — Reps máx
- `exerciseEditor.sectionProgramming` — Programación
- `exerciseEditor.sectionProgression` — Progresión
- `exerciseEditor.warmup.title` — Calentamiento
- `variants.section` — Variante
- `exerciseEditor.sectionOptions` — Opciones
- `exerciseEditor.isKeyLabel` — Ejercicio principal
- ★ `exerciseEditor.isKeyHint` — El básico del día. Las reglas de etapa pueden tratarlo distinto de los accesorios.
- `exerciseEditor.trackRpeLabel` — Registrar RPE
- `exerciseEditor.trackRpeLocked` — Lo pide la progresión
- `exerciseEditor.dropsetLabel` — Dropset en la última serie
- ★ `exerciseEditor.dropsetHint` — Al terminar la última serie podrás añadir sub-series a peso decreciente, sin descanso.
- `exerciseEditor.supersetLabel` — En superserie con el siguiente
- ★ `exerciseEditor.supersetHint` — Se alternará con el siguiente ejercicio, sin descanso entre ambos. El descanso de este ejercicio no se usará.
- `exerciseEditor.tempoLabel` — Tempo
- `exerciseEditor.trainerNoteLabel` — Nota para el cliente
- `exerciseEditor.trainerNotePlaceholder` — Ej. codos a 45°, baja en 3 segundos…
- `exerciseEditor.trainerNoteHint` — Visible en el ejercicio durante la sesión
- `exerciseEditor.linkLabel` — Vinculación entre sesiones
- `exerciseEditor.linkNone` — Ninguna
- `exerciseEditor.linkGroupN` — Grupo {{n}}
- `exerciseEditor.linkNew` — Nuevo grupo
- ★ `exerciseEditor.linkHint` — Comparte configuración e historial con el mismo ejercicio en otras sesiones. Editar uno edita todos.
- `exerciseEditor.substituteBtn` — Sustituir
- `common.delete` — Eliminar
- `variants.title` — Variante
- `variants.fixedTitle` — Cómo se hace · fija
- ★ `variants.fixedHint` — Es parte del ejercicio. Para cambiarla, apaga «Ejercicio único».
- `variants.howHint` — Solo informa: no cambia el historial ni la progresión.
- `variants.widthNA` — La anchura no aplica a un ejercicio unilateral.
- `variants.identityTitle` — Cambia el ejercicio
- `variants.oneHand` — Unilateral
- `variants.alreadyUnilateral` — Este ejercicio ya es unilateral.
- `variants.unilateral` — Unilateral
- ★ `variants.unilateralHint` — Cuenta como otro ejercicio, con su propio historial y progresión.
- `variants.apart` — Ejercicio único
- ★ `variants.apartHintOn` — Tiene su propia progresión. Ya puedes añadir otro «{{base}}» a esta sesión.
- ★ `variants.apartHintOff` — «{{name}}» pasa a tener su propia progresión y podrás añadir otro «{{base}}» a la sesión. La variante queda fija.
- `variants.apartNeedsVariant` — Elige antes un agarre o una anchura.
- `variants.toastApart` — «{{name}}» es ahora un ejercicio único
- `exerciseEditor.warmup.setsLabel` — Series
- `exerciseEditor.warmup.addStep` — Añadir paso
- `exerciseEditor.warmup.restLabel` — Descanso
- ★ `exerciseEditor.tempoHint` — Excéntrica · Pausa · Concéntrica · Pausa (ej. 3010; X = explosivo)
- ★ `variants.blockedLinked` — No se puede: ya hay un «{{name}}» en una sesión vinculada. Quítalo o sustitúyelo antes.
- ★ `variants.blocked` — No se puede: ya hay un «{{name}}» en esta sesión. Quítalo o sustitúyelo antes.
- `exerciseEditor.fieldStartReps` — Reps de inicio
- `exerciseEditor.fieldFixedReps` — Reps
- `exerciseEditor.progTitle.weight` — Peso
- `exerciseEditor.progTitle.assist` — Asistencia
- `exerciseEditor.progTitle.reps` — Reps
- `exerciseEditor.progTitle.time` — Tiempo
- `variants.dim.grip` — Agarre
- `variants.dim.width` — Anchura
- `variants.dim.unilateral` — Unilateral
- `exerciseEditor.repsMode.range` — Rango
- `exerciseEditor.repsMode.fixed` — Reps fijas
- `exerciseEditor.warmup.none` — Ninguno
- `exerciseEditor.warmup.auto` — Auto
- `exerciseEditor.warmup.custom` — Personalizado

## components/editor/ProgressionSheet.jsx

Aparece en: CustomExercise, ExerciseEditor

- `exerciseEditor.effortFailure` — Hasta el fallo
- ★ `exerciseEditor.effortUnreliable` — A partir de {{max}} reps, contando las de recámara, el cálculo del peso deja de ser fiable
- `exerciseEditor.ofN` — de {{n}}
- `exerciseEditor.stepUp` — Qué sube
- `exerciseEditor.stepHow` — Cómo
- `exerciseEditor.howRules` — Por reglas
- `exerciseEditor.howEffort` — Por esfuerzo
- `exerciseEditor.effortNeedsFixed` — Por esfuerzo necesita reps fijas: cámbialo en Volumen
- `exerciseEditor.stepRpe` — RPE objetivo
- `exerciseEditor.maxRpeLabel` — RPE objetivo
- `exerciseEditor.rpeAutoOn` — Registrar RPE se enciende solo.
- `exerciseEditor.stepSize` — Escalón de peso
- `exerciseEditor.stepSizeLabel` — Escalón
- `exerciseEditor.stepWhen` — Cuándo sube
- ★ `exerciseEditor.effDownHint` — Bajar es automático: si sale más duro de lo pedido, el cálculo da menos peso.
- `progression.rule.whenPart` — {{need}} de {{n}} series
- `progression.rule.whenRpe` — todas las series con RPE ≤ {{rpe}}
- `progression.rule.whenAll` — todas las series
- `exerciseEditor.metaReach` — lleguen a {{goal}}
- `exerciseEditor.metaOver` — pasen de {{floor}}
- `exerciseEditor.needLabel` — Tienen que llegar
- `exerciseEditor.rpeMaxLabel` — RPE máximo
- `exerciseEditor.whenHint` — Sube cuando {{when}} {{meta}}. La meta sale de Volumen.
- `exerciseEditor.stepIncr` — Cuánto sube
- `exerciseEditor.incrValueLabel` — Incremento
- `exerciseEditor.roundStepLabel` — Redondea al escalón
- ★ `exerciseEditor.stepSizeHintPct` — El salto más pequeño que permite el material. Viene del ejercicio.
- `exerciseEditor.incrFixedRepsLabel` — Reps por subida
- `exerciseEditor.incTimeLabel` — Segundos que se suman
- `exerciseEditor.stepDown` — Cuándo baja
- `exerciseEditor.failsLabel` — Series bajo el mínimo
- ★ `exerciseEditor.downPartHint` — Con «Parcial {{need}} de {{n}}» no puede ser menos de {{min}}: una misma sesión podría subir y bajar.
- `exerciseEditor.downNeverHint` — Si no llegas, mantiene. Nunca propone bajar.
- ★ `exerciseEditor.howEffortHint` — La app calcula el peso de cada sesión con el 1RM estimado y el RPE que apuntas.
- `exerciseEditor.howRulesHint` — Subes cuando se cumple la regla de abajo.
- `exerciseEditor.stepSizeExactHint` — Propone el peso calculado tal cual: tú decides qué cargas.
- ★ `exerciseEditor.stepSizeHint` — El salto más pequeño que permite el material. Redondea el peso calculado. Viene del ejercicio.
- `exerciseEditor.incAssistLabel` — Ayuda que se quita
- `exerciseEditor.incWeightLabel` — Peso que se suma
- `exerciseEditor.incIntHintReps` — En reps enteras; sin porcentaje.
- `exerciseEditor.incIntHintTime` — En segundos enteros; sin porcentaje.
- ★ `exerciseEditor.downHintAssist` — Añade {{inc}} de ayuda si {{fails}} o más series no llegan al mínimo ({{floor}}).
- ★ `exerciseEditor.downHint` — Baja {{inc}} si {{fails}} o más series no llegan al mínimo ({{floor}}).
- `exerciseEditor.upOptions.weight` — Peso
- `exerciseEditor.upOptions.assist` — Asistencia ↓
- `exerciseEditor.upOptions.reps` — Reps
- `exerciseEditor.upOptions.time` — Tiempo
- `exerciseEditor.upOptions.none` — Nada
- ★ `exerciseEditor.upHint.weightAssist` — En un asistido progresar es quitar ayuda: lo sabe el ejercicio, no hay que configurarlo.
- `exerciseEditor.upHint.weightFixed` — Sube el peso; las reps se quedan en {{reps}}.
- `exerciseEditor.upHint.weightRange` — Sube el peso y las reps vuelven a {{min}}.
- `exerciseEditor.upHint.weightTime` — Sube el peso y el tiempo vuelve a {{min}}.
- ★ `exerciseEditor.upHint.reps` — Suben las reps desde tu serie más floja; el peso no se toca.
- `exerciseEditor.upHint.time` — Sube el tiempo desde tu serie más floja.
- ★ `exerciseEditor.upHint.none` — Sin progresión: el gris repite lo de la última vez y el peso lo cambias tú.
- `exerciseEditor.stepSizeOpt.step` — Escalón
- `exerciseEditor.stepSizeOpt.exact` — Exacto
- `exerciseEditor.effWhen.beat` — Al superarlo
- `exerciseEditor.effWhen.reach` — Al llegar
- ★ `exerciseEditor.effWhenHint.beat` — Sube solo si la sesión salió más fácil de lo pedido (más reps o menos RPE). Si cuadró, mantiene el peso.
- ★ `exerciseEditor.effWhenHint.reach` — Si cuadró con el objetivo, sube un escalón ({{step}} {{unit}}). Si salió más fácil, lo que diga el cálculo.
- `exerciseEditor.evalModes.all_complete` — Todas
- `exerciseEditor.evalModes.part` — Parcial
- `exerciseEditor.evalModes.rpe` — RPE máx.
- `exerciseEditor.incrTypes.fixed` — Fijo
- `exerciseEditor.incrTypes.pct` — Porcentaje
- `exerciseEditor.incrTypeDesc.fixed` — Añade una cantidad fija en cada subida de carga
- `exerciseEditor.incrTypeDesc.pct` — Sube el peso un porcentaje del valor actual
- `exerciseEditor.downOpt.never` — Nunca
- `exerciseEditor.downOpt.fail` — Si fallan

## components/ExternalImportModal.jsx

Aparece en: —

- `errors.invalidFile` — Archivo no válido
- `header.toastImported` — Datos importados

## components/FreeClientsSheet.jsx

Aparece en: Clients

- `freePlan.chooseTitle` — Con quién sigues
- `common.cancel` — Cancelar
- `freePlan.chooseCount` — {{n}}/{{max}} clientes · {{app}}/{{maxApp}} con app
- `freePlan.alreadyChosen` — elegido
- `freePlan.chooseCta` — Seguir con estos
- `freePlan.goPro` — Prefiero hacerme Pro
- ★ `freePlan.chooseMoreLead` — Te ha quedado un hueco en el plan gratis. Puedes ocuparlo con un cliente fuera de plan; los que ya elegiste no cambian.
- ★ `freePlan.chooseLead` — Sin Pro, el plan gratis llega a 3 clientes y solo 1 con app. Los que no elijas quedan fuera de plan: puedes ver su historial, pero no apuntarles ni enviarles nada. No se borra nada, pero lo que elijas ya no se puede cambiar.
- `freePlan.withApp` — Con app
- `freePlan.withoutApp` — Le apuntas tú

## components/history/HistoryList.jsx

Aparece en: Stats

- `history.currentProgram` — Programa actual
- `history.all` — Todo
- `history.clearNothing` — No hay sesiones que borrar
- `common.cancel` — Cancelar
- `history.clear.confirm` — Borrar
- `history.clearDone` — {{count}} sesiones borradas
- `history.noSessionsProgram` — No hay sesiones registradas para este programa.
- `history.noSessionsEmpty` — Completa tu primera sesión para verla aquí.
- `history.filterTitle` — Filtrar
- `history.scopeLabel` — Ámbito
- `history.stagesLabel` — Etapas
- `history.manageTitle` — GESTIONAR HISTORIAL
- `history.clear.off_program.action` — Borrar lo ajeno al programa activo
- `history.clear.all.action` — Borrar todo el historial
- ★ `history.clearHint` — Acciones sin deshacer. Exporta una copia desde ≡ → Exportar antes de borrar.
- `history.clear.all.title` — ¿Borrar todo el historial?
- `history.clear.all.body` — Se borrarán {{count}} sesiones. No se puede deshacer.
- `history.clear.off_program.title` — ¿Borrar las sesiones de fuera del programa?
- ★ `history.clear.off_program.body` — Se borrarán {{count}} sesiones que no pertenecen al programa activo, incluidas las sesiones libres. No se puede deshacer.

## components/HomeProgramCard.jsx

Aparece en: Home

- `home.stageDefault` — Etapa {{n}}
- `programCard.stageNotStarted` — Sin empezar
- `home.weekProgress` — Semana {{current}} de {{total}}
- `programCard.stageWeekOpen` — Semana {{week}}
- `home.openProgram` — Abre tu programa
- `home.yourProgram` — Tu programa
- `home.week` — Semana

## components/ImportModal.jsx

Aparece en: Clients, Home, MyProgram, Onboarding, Program, Stats

- `import.choiceNone` — No importar
- `import.choiceMerge` — Añadir las nuevas
- `import.pickOne` — Elige una
- `import.typeFullBackup` — Backup completo
- `import.typeProgramWithLog` — Programa + historial
- `import.typeProgram` — Programa
- `import.notInFile` — No hay en este archivo
- `import.title` — Importar archivo
- `import.sectionProgram` — Programa activo
- `import.sectionProgramDesc` — Activa el programa importado
- `import.sectionCustomExercises` — Ejercicios propios
- `import.sectionClients` — Clientes
- `import.templatesTitle` — Plantillas · {{count}}
- `import.importBtn` — Importar
- `import.logReplace` — Sustituir todo el historial
- `import.templatesReplace` — Sustituir todas
- `import.clientsDesc_one` — {{count}} cliente · se suma a los tuyos
- `import.clientsDesc_other` — {{count}} clientes · se suman a los tuyos
- `import.logTitle_one` — Historial · {{count}} sesión
- `import.logTitle_other` — Historial · {{count}} sesiones
- `import.modeFull` — Programa e historial
- `import.modeFullDesc` — Activa el programa y añade sus sesiones a tu historial
- `import.modeLogOnly` — Solo el historial
- `import.modeLogOnlyDesc` — Mantiene tu programa y añade las sesiones del archivo
- `import.modeProgramOnly` — Solo el programa
- `import.modeProgramOnlyDesc` — Activa el programa sin tocar tu historial

## components/onboarding/AdaptationPanel.jsx

Aparece en: Onboarding

- `onboarding.adaptationPanel.substitutedTitle` — Sustituidos
- `onboarding.adaptationPanel.removedTitle` — Quitados
- `onboarding.adaptationPanel.gapsTitle` — Sin cubrir

## components/onboarding/AdjustSheet.jsx

Aparece en: Onboarding

- `onboarding.adjustSheet.timeHintOk` — Cabe todo. Ningún recorte.
- `onboarding.adjustSheet.timeHintSetsOnly` — Se quitan {{sets}} series en total.
- ★ `onboarding.adjustSheet.materialCustomHint` — {{subs}} ejercicios sustituidos · {{gaps}} huecos que no cubre.
- `onboarding.adjustSheet.limitationsHintNone` — Sin limitaciones activas.
- `onboarding.adjustSheet.title` — Ajustes
- `onboarding.adjustSheet.step1` — Tiempo por sesión
- `onboarding.adjustSheet.step2` — Material
- `onboarding.adjustSheet.step3` — Limitaciones
- ★ `onboarding.adjustSheet.materialHint.gym` — Máquinas, mancuernas, barra, dominadas, kettlebell y bandas.
- ★ `onboarding.adjustSheet.materialHint.home` — Mancuernas, bandas elásticas, barra de dominadas y rueda abdominal.
- `onboarding.adjustSheet.materialHint.bodyweight` — Sólo tu peso corporal, sin material.
- `onboarding.adjustSheet.materialHint.custom` — Tu propia selección de material.
- `onboarding.adjustSheet.material.gym` — Gimnasio
- `onboarding.adjustSheet.material.home` — Casa
- `onboarding.adjustSheet.material.bodyweight` — Cuerpo
- `onboarding.adjustSheet.material.custom` — Otro
- `onboarding.equipment.bodyweight.label` — Solo peso corporal
- `onboarding.equipment.bodyweight.description` — Sin material — ejercicios con tu propio cuerpo.
- `onboarding.equipment.machines.label` — Máquinas
- `onboarding.equipment.machines.description` — Prensa, polea, curl, extensión...
- `onboarding.equipment.dumbbells.label` — Mancuernas
- `onboarding.equipment.dumbbells.description` — Ajustables o fijas.
- `onboarding.equipment.barbell.label` — Barra libre
- `onboarding.equipment.barbell.description` — Barra olímpica con discos.
- `onboarding.equipment.pullup_bar.label` — Barra de dominadas
- `onboarding.equipment.pullup_bar.description` — Fija o de puerta.
- `onboarding.equipment.parallettes.label` — Paralelas / Dip bar
- `onboarding.equipment.parallettes.description` — Para fondos y L-sit.
- `onboarding.equipment.kettlebell.label` — Kettlebell
- `onboarding.equipment.kettlebell.description` — Una o varias.
- `onboarding.equipment.resistance_band.label` — Bandas elásticas
- `onboarding.equipment.resistance_band.description` — Para asistencia o activación.
- `onboarding.equipment.ab_wheel.label` — Rueda abdominal
- `onboarding.equipment.ab_wheel.description` — Ab wheel rollout.
- `onboarding.limitations.none.label` — Sin limitaciones
- `onboarding.limitations.none.description` — Puedo hacer cualquier ejercicio sin restricciones.
- `onboarding.limitations.shoulder.label` — Hombro / Trapecio
- `onboarding.limitations.shoulder.description` — Molestias en hombro, manguito rotador o trapecio.
- `onboarding.limitations.lower_back.label` — Zona lumbar
- `onboarding.limitations.lower_back.description` — Problemas en la zona baja de la espalda.
- `onboarding.limitations.knee.label` — Rodilla
- `onboarding.limitations.knee.description` — Molestias en rodilla o menisco.

## components/PaywallModal.jsx

Aparece en: Clients, Home, MyProgram, Program, Stats

- `paywall.processing` — Compra procesada, sincronizando…
- `paywall.errTitle` — No se pudo completar la compra
- `drive.errBackupBody` — Inténtalo otra vez en un momento.
- `paywall.plan.recommended` — RECOMENDADO
- `paywall.plan.annualMonthly` — {{price}} al mes
- `paywall.plan.lifetimeSub` — Sin renovaciones
- `common.close` — Cerrar
- `paywall.headline` — Conecta con ⏎ todos tus ⏎ *clientes*
- `paywall.tagline` — UNA APP PARA ENTRENARLOS A TODOS
- `paywall.payTitle` — Forma de pago
- `paywall.comingSoon` — Forma Pro próximamente
- `paywall.restore` — Restaurar compra
- `paywall.terms` — Términos de uso
- `paywall.privacy` — Privacidad
- `paywall.plan.annual` — Anual
- `paywall.plan.annualPer` — al año
- `paywall.plan.annualCta` — Suscribirme · {{price}}/año
- ★ `paywall.plan.annualLegal` — {{price}} al año. Se renueva sola; cancélala cuando quieras desde {{store}}.
- `paywall.plan.lifetime` — Para siempre
- `paywall.plan.lifetimePer` — pago único
- `paywall.plan.lifetimeCta` — Comprar por {{price}}
- `paywall.plan.lifetimeLegal` — Pago único de {{price}}, sin suscripción.
- `paywall.features.connected.title` — Todos tus clientes *sincronizados*
- ★ `paywall.features.connected.desc` — Tú programas, ellos entrenan. Todo sincronizado sin salir de la app.
- `paywall.features.clients.title` — *Sin límite* de clientes
- `paywall.features.clients.desc` — El plan gratis llega a 3.
- `paywall.features.templates.title` — *Sin límite* de plantillas
- `paywall.features.templates.desc` — Crea programas y sesiones listos para asignar.

## components/ProgramUpdateModal.jsx

Aparece en: Home

- `programUpdate.diff.stageN` — Etapa {{n}}
- `programUpdate.diff.sessionN` — Sesión {{n}}
- `programUpdate.title` — Tu entrenador ha modificado el programa
- `programUpdate.applySub` — Sigues en tu etapa y tu semana
- `programUpdate.later` — Ahora no
- `programUpdate.apply` — Actualizar
- `programUpdate.diff.newProgram` — Programa nuevo del entrenador
- `programUpdate.diff.movedTo` — Tu entrenador te pasa a {{name}}
- `programUpdate.diff.movedToUnnamed` — Tu entrenador te pasa a otra etapa
- `programUpdate.diff.stagesAdded_one` — +{{count}} etapa nueva
- `programUpdate.diff.stagesAdded_other` — +{{count}} etapas nuevas
- `programUpdate.diff.stagesRemoved_one` — {{count}} etapa eliminada
- `programUpdate.diff.stagesRemoved_other` — {{count}} etapas eliminadas
- `programUpdate.diff.stageLocked` — {{stage}} bloqueada
- `programUpdate.diff.stageUnlocked` — {{stage}} desbloqueada
- `programUpdate.diff.sessions_one` — {{delta}} sesión
- `programUpdate.diff.sessions_other` — {{delta}} sesiones
- `programUpdate.diff.stageSessions_one` — Etapa {{n}}: {{delta}} sesión
- `programUpdate.diff.stageSessions_other` — Etapa {{n}}: {{delta}} sesiones
- `programUpdate.diff.exercises_one` — {{session}}: {{delta}} ejercicio
- `programUpdate.diff.exercises_other` — {{session}}: {{delta}} ejercicios
- `programUpdate.diff.order_rotation` — Toca la sesión que más tiempo llevas sin hacer
- `programUpdate.diff.order_weekly` — Cada semana empieza por la primera sesión
- `programUpdate.diff.order_free` — Ya no hay sesión que toque: haces la que quieras
- `programUpdate.diff.minor` — Cambios menores en el programa

## components/SessionCard.jsx

Aparece en: Clients, Stats

- `freeSession.historyLabel` — Sesión libre
- `history.deleteTitle` — Eliminar sesión
- `history.deleteConfirm` — ¿Eliminar esta sesión?
- `common.cancel` — Cancelar
- `common.delete` — Eliminar
- `history.noteLabel` — Nota
- `history.setsShort` — series
- `history.noteTag` — 📝 nota
- `home.adapted` — Adaptada
- `blocks.formats.amrap` — AMRAP
- `blocks.formats.emom` — EMOM
- `blocks.formats.for_time` — For time

## components/SessionList.jsx

Aparece en: Clients, Home, PasteWorkout

- `home.adapted` — Adaptada
- `home.fromTrainer` — de {{name}}
- `home.edit` — Editar
- `sessionText.share` — Compartir la sesión
- `home.collapse` — Ocultar ejercicios
- `home.expand` — Ver ejercicios
- `blocks.formats.amrap` — AMRAP
- `blocks.formats.emom` — EMOM
- `blocks.formats.for_time` — For time

## components/SessionTabsCard.jsx

Aparece en: Home

- `home.sessionNext` — Mi entreno de hoy
- `home.adapted` — Adaptada
- `home.collapse` — Ocultar ejercicios
- `home.expand` — Ver ejercicios

## components/stats/LoadCalendar.jsx

Aparece en: Clients, Stats

- `history.heatLegend` — Carga
- `history.heatMore` — más
- `history.heatNoRpe` — sin RPE

## components/stats/LoadTab.jsx

Aparece en: Clients, Stats

- `load.emptyNoSessions` — Completa tu primera sesión para ver la carga aquí.
- ★ `load.emptyNoRpe` — Aún no hay datos de esfuerzo. Al terminar una sesión, responde a «¿Cómo de dura fue?» en el resumen: la carga se calcula con ese valor y la duración.
- `load.monotonyHigh` — repetitiva
- `load.monotonyModerate` — normal
- `load.monotonyLow` — variada
- `load.load7d` — Carga 7d
- `load.vs28d` — vs media 28d
- `load.thisWeekLoad` — esta semana
- `load.monotony` — Monoton.
- `load.needsSessions` — pocas sesiones
- `load.sessions7d` — Sesiones
- `load.avgPerWeek` — media {{n}}/sem
- `load.strainTitle` — Strain por semana
- `load.lastWeeks` — últimas {{count}}
- `load.thisWeek` — esta semana
- ★ `load.strainHint` — Una barra por semana. Las de menos de 3 sesiones van en contorno.
- `load.trendTitle` — Evolución de la carga
- `load.perDay` — por día
- `load.legendDaily` — carga diaria
- `load.legend7d` — media 7d
- `load.legend28d` — media 28d
- `load.effortTitle` — Esfuerzo vs carga
- `load.base100` — base 100
- `load.legendExternal` — carga externa
- `load.legendEffort` — esfuerzo
- `load.perfTitle` — Rendimiento
- `load.perfMeta` — 1RM estimado medio
- `load.perfDetail` — en {{weeks}} semanas.
- `load.groupsTitle` — Series por grupo
- `load.last7d` — últimos 7 días
- `load.groupOther` — Otros
- ★ `load.groupsHint` — Las marcas señalan el rango de referencia de {{min}}-{{max}} series semanales por grupo. Cuenta volumen directo: un press de banca suma a pecho, no a tríceps.
- `load.state.loading.title` — Estás acumulando carga.
- `load.state.loading.detail` — Estás entrenando por encima de tu media del último mes.
- `load.state.steady.title` — Carga estable.
- `load.state.steady.detail` — La semana está en línea con tu media del último mes.
- `load.state.unloading.title` — Estás descargando.
- `load.state.unloading.detail` — Estás entrenando por debajo de tu media del último mes.
- `load.trend.adaptation` — ↑ carga · = esfuerzo → adaptación
- `load.trend.fatigue` — = carga · ↑ esfuerzo → fatiga
- `load.trend.hard` — ↑ carga · ↑ esfuerzo → bloque duro
- `load.trend.deload` — ↓ carga · ↓ esfuerzo → descarga
- `load.trend.mixed` — sin un patrón claro
- `exerciseSelector.groups.chest` — Pecho
- `exerciseSelector.groups.back` — Espalda
- `exerciseSelector.groups.shoulders` — Hombro
- `exerciseSelector.groups.arms` — Brazos
- `exerciseSelector.groups.biceps` — Bíceps
- `exerciseSelector.groups.triceps` — Tríceps
- `exerciseSelector.groups.quads` — Cuádriceps
- `exerciseSelector.groups.glutes_hamstrings` — Glúteo e isquios
- `exerciseSelector.groups.legs_lower` — Gemelos
- `exerciseSelector.groups.core` — Core
- `exerciseSelector.groups.grip` — Agarre

## components/stats/ProgressPanel.jsx

Aparece en: Clients, Stats

- `load.tabExercises` — Ejercicios
- `load.tabLoad` — Carga
- `load.tabHistory` — Historial

## components/stats/ProgressTab.jsx

Aparece en: Clients, Stats

- `stats.periodAll` — Todo
- `stats.metricSeconds` — Seg
- `stats.metricReps` — Reps
- `stats.metricVolume` — Vol
- `dayCard.today` — Hoy
- `dayCard.yesterday` — Ayer
- `dayCard.daysAgo` — Hace {{count}} días
- `dayCard.oneWeekAgo` — Hace 1 semana
- `dayCard.weeksAgo` — Hace {{count}} semanas
- `dayCard.oneMonthAgo` — Hace 1 mes
- `dayCard.monthsAgo` — Hace {{count}} meses
- `dayCard.oneYearAgo` — Hace 1 año
- `dayCard.yearsAgo` — Hace {{count}} años
- `stats.chartNeedsTwo` — Necesitas al menos 2 sesiones en este período.
- `stats.lastShort` — últ.
- `stats.searchExercise` — Buscar ejercicio…
- `stats.currentProgram` — Programa actual
- `stats.statTrend` — Mejora
- `stats.statVolume` — Volumen
- `stats.noSessionsPeriod` — Sin sesiones en este período.
- `stats.progressSuffix` — progreso
- `stats.lastSessionShort` — últ. ses.
- `stats.statSessions` — Sesiones
- `stats.thisWeek` — {{count}} esta semana
- `stats.filterExercises` — Filtrar ejercicios
- `stats.clearSelection` — Restablecer selección
- `stats.emptyFirstSession` — Completa tu primera sesión para ver el progreso aquí.
- `stats.emptyNoMatch` — Sin coincidencias para esa búsqueda.
- `stats.noData` — Sin datos para el filtro seleccionado.

## components/TrainerSyncModal.jsx

Aparece en: Clients, Home, MyProgram, Program, Stats

- `sync.copied` — ✓ Copiado
- `sync.copyHint` — Toca para copiar
- `sync.nameLabel` — TU NOMBRE
- `sync.namePlaceholder` — Ej. Lucas García
- ★ `sync.nameHint` — Es el nombre que tus clientes ven en los programas que les envías.
- `sync.onlyInstalled` — Solo en la app instalada, no en Expo Go.
- ★ `sync.errNoIdToken` — No se devolvió la identidad de la cuenta. Inténtalo otra vez.
- `sync.errGoogleTitle` — No se pudo entrar con Google
- `sync.errGoogleBody` — Inténtalo otra vez en un momento.
- `sync.errAppleTitle` — No se pudo entrar con Apple
- `sync.errReconnectTitle` — No se pudo volver a autenticar
- `sync.errReconnectBody` — Comprueba tu código e inténtalo otra vez.
- `sync.errAccountTitle` — No se pudo crear la cuenta
- `sync.errAccountBody` — Inténtalo otra vez en un momento.
- `common.cancel` — Cancelar
- ★ `sync.warnCodeExists` — Ya tienes un código. Si creas otro, tus clientes actuales dejan de sincronizar con él.
- ★ `sync.modeCodeWarn` — Guárdalo tú: sin ese código no se puede recuperar la cuenta.
- `sync.warnUpgrade` — Tus clientes actuales se pasan solos a tu cuenta.
- `sync.purchaseTitle` — Guarda tu compra
- `sync.titleFirstTime` — Gestión de clientes
- `sync.title` — Sincronización
- `sync.revealTitle` — Tu código personal
- `sync.recoveryTitle` — Recuperar cuenta
- `common.accept` — Aceptar
- `trainer.codeBack` — Atrás
- `sync.purchaseLater` — Ahora no
- `sync.statusTag` — SINCRONIZANDO
- `sync.statusTitle` — Tus clientes están sincronizados
- ★ `sync.statusSub` — Con tu código personal. Guárdalo: es lo que te devuelve la cuenta si cambias de móvil.
- `sync.yourCodeLabel` — TU CÓDIGO
- `sync.reauthCta` — VOLVER A AUTENTICAR
- ★ `sync.reauthHint` — Úsalo si la app dejó de reconocerte: vuelve a entrar con el código que ya tienes guardado.
- `sync.changeModeLink` — Cambiar el modo de sincronización →
- ★ `sync.revealLead` — Este es tu código. Cópialo y guárdalo donde no lo pierdas: es la única forma de recuperar la cuenta.
- `sync.revealCta` — YA LO HE GUARDADO
- ★ `sync.recoveryLead` — Escribe tu código de entrenador para recuperar el acceso a tus clientes. Son doce caracteres; los guiones se ponen solos.
- `sync.recoveryCta` — RECUPERAR
- `sync.reauthGoogleLink` — Entrar con otra cuenta de Google →
- `sync.reauthLink` — Volver a autenticarse con otro código →
- `sync.recoveryLink` — ¿Ya tienes un código? Recuperar cuenta →
- `sync.switchUpgradeTitle` — ¿Pasar a tu cuenta?
- `sync.switchTitle` — ¿Cambiar el modo?
- ★ `sync.switchUpgradeBody` — Tus clientes actuales se migran solos a tu cuenta y dejas de depender del código.
- ★ `sync.switchBody` — Se cerrará la cuenta actual. Tus clientes se quedan guardados en este móvil, pero dejan de sincronizar hasta que vuelvas a entrar.
- `sync.switchUpgradeConfirm` — Pasar a la cuenta
- `sync.switchConfirm` — Cambiar
- ★ `sync.revealWarnPurchase` — Si pierdes el móvil y no tienes el código, no se pueden recuperar ni la cuenta ni tu compra en otro móvil. En esta misma cuenta de la tienda, «Restaurar compra anterior» sigue funcionando.
- ★ `sync.revealWarn` — Si pierdes el móvil y no tienes el código, la cuenta y la sincronización con tus clientes no se pueden recuperar.
- ★ `sync.purchaseLead` — Vincúlala a una cuenta para recuperarla en cualquier móvil, aunque cambies de Android a iPhone.
- ★ `sync.selectLead` — Elige cómo quieres que la app guarde tus clientes. Puedes cambiarlo más adelante.
- `sync.ctaConnected` — YA CONECTADO
- `sync.ctaOffline` — SEGUIR SIN CUENTA
- `sync.ctaGoogle` — CONTINUAR CON GOOGLE
- `sync.ctaCode` — CREAR MI CÓDIGO
- `sync.modeGoogleTitle` — Con tu cuenta de Google
- ★ `sync.modeGoogleDesc` — Tus clientes quedan asociados a tu cuenta. No hay ningún código que guardar: entras con Google y ya está.
- `sync.modeAppleTitle` — Con tu cuenta de Apple
- ★ `sync.modeAppleDesc` — Igual que con Google, pero con tu Apple ID. Puedes ocultar tu correo y aun así recuperar la cuenta.
- `sync.modeCodeTitle` — Con un código personal
- ★ `sync.modeCodeDesc` — La app crea un código de 12 caracteres. Todo funciona igual, pero el código es tu única llave.
- `sync.modeOfflineTitle` — Sin cuenta
- ★ `sync.modeOfflineDesc` — Nada sale de este móvil. Compartes programas e historial exportando e importando archivos a mano.

## components/ui/CodeField.jsx

Aparece en: Clients, Home, MyProgram, Onboarding, Program, Stats, TrainerConnection

- `common.pasted` — ✓ PEGADO
- `common.paste` — PEGAR

## components/ui/confirmDiscard.js

Aparece en: Clients, Home, PasteWorkout

- `workout.discardSession` — Descartar sesión
- `workout.discardConfirm` — Los datos que has introducido se perderán.
- `common.cancel` — Cancelar

## components/ui/DialogHost.jsx

Aparece en: —

- `common.understood` — Entendido

## components/ui/MetricDoc.jsx

Aparece en: Clients, Docs, Stats

- `docs.metricRules` — Reglas de la app
- `docs.metricCaveat` — Límites
- `docs.metricFormulaApprox` — Cómo se calcula (simplificado)
- `docs.metricFormula` — Cómo se calcula
- `metrics.e1rm.name` — 1RM estimado
- ★ `metrics.e1rm.what` — Estima el peso máximo que podrías levantar una sola vez, sin tener que intentarlo de verdad. Sirve para seguir tu progreso en un ejercicio aunque cambies de repeticiones cada semana.
- `metrics.e1rm.formula` — 1RM estimado = peso × (1 + repeticiones ÷ 30)
- ★ `metrics.e1rm.rules` — Si registras el RPE, se estima cuántas repeticiones te quedaban en reserva (10 − RPE) y se suman a las hechas antes de aplicar la fórmula: una serie a RPE 8 se calcula como si hubieras hecho dos repeticiones más.
- ★ `metrics.e1rm.caveat` — Es la fórmula de Epley, una estimación y no una medición. Se ignoran las series de más de {{maxReps}} repeticiones porque a partir de ahí sobreestima de forma notable.
- `metrics.pr.name` — Récord personal (PR)
- ★ `metrics.pr.what` — Señala las sesiones en las que superaste tu mejor registro anterior en un ejercicio.
- ★ `metrics.pr.formula` — se compara el 1RM estimado; si no se puede calcular, el peso máximo; y si tampoco, las repeticiones a peso corporal
- ★ `metrics.pr.rules` — La comparación es contra todo tu historial anterior, no contra la última sesión. La primera vez que haces un ejercicio establece tu referencia inicial, así que no se considera un récord. Se marca un solo récord por ejercicio y sesión: el primero de esa escalera.
- ★ `metrics.pr.caveat` — Al apoyarse en el 1RM estimado, hereda su margen de error: un récord ajustado puede venir de la estimación y no de una mejora real.
- `metrics.performanceIndex.name` — Rendimiento
- ★ `metrics.performanceIndex.what` — Resume en un solo número cómo ha evolucionado tu rendimiento estimado en todos los ejercicios del período. Sirve para saber si el entrenamiento se está convirtiendo en resultados.
- ★ `metrics.performanceIndex.formula` — media de (1RM estimado de cada ejercicio ÷ su valor inicial) × 100
- ★ `metrics.performanceIndex.rules` — Para cada semana se toma el mejor 1RM estimado conseguido en las 4 semanas anteriores, no el de esa semana suelta, para que una descarga no aparezca como pérdida de rendimiento. Un ejercicio entra solo si tiene valor inicial y al menos una semana posterior con datos. Se promedian los índices de cada ejercicio, no los kilos.
- ★ `metrics.performanceIndex.caveat` — Es rendimiento estimado, no fuerza medida: se apoya por completo en el 1RM estimado. Cambiar de ejercicios a mitad del período mueve el número aunque tu rendimiento no cambie.
- `metrics.loadTrend.name` — Mejora
- ★ `metrics.loadTrend.what` — Indica si los pesos que mueves suben o bajan de media en el período, juntando todos tus ejercicios en un porcentaje.
- ★ `metrics.loadTrend.formula` — línea de tendencia (regresión lineal) sobre las sesiones de cada ejercicio; el porcentaje es el cambio entre sus extremos, promediado entre ejercicios
- ★ `metrics.loadTrend.rules` — Todos los ejercicios pesan lo mismo en el promedio, independientemente de cuántas sesiones tengan. Cada ejercicio se mide en una sola unidad: en kilos si alguna vez llevó peso, si no en repeticiones. Uno de peso corporal que empieza sin lastre no suma, porque no hay porcentaje sobre 0 kg.
- ★ `metrics.loadTrend.caveat` — Es la pendiente de una recta ajustada a todas tus sesiones, no la diferencia entre la primera y la última. Un ejercicio recién estrenado, con pocos puntos, puede mover el resultado más de lo que le corresponde.
- `metrics.lastSessionDelta.name` — Diferencia con la sesión anterior
- ★ `metrics.lastSessionDelta.what` — Compara tu última sesión con la anterior del mismo tipo para ver de un vistazo si subiste o bajaste.
- `metrics.lastSessionDelta.formula` — (última − anterior) ÷ anterior × 100
- ★ `metrics.lastSessionDelta.rules` — En el historial esta diferencia se calcula sobre el volumen y compara con la vez anterior de esa misma sesión, no con la sesión inmediatamente anterior en el tiempo.
- ★ `metrics.lastSessionDelta.caveat` — Son solo dos sesiones: un mal día, o uno especialmente bueno, mueven el resultado por completo.
- `metrics.volume.name` — Volumen
- ★ `metrics.volume.what` — Suma los kilos totales que has movido en una sesión. Sirve para comparar la cantidad de trabajo entre sesiones parecidas.
- ★ `metrics.volume.formula` — volumen = suma de (peso × repeticiones) de cada serie registrada
- `metrics.volume.rules` — Cuenta también las sub-series de los dropsets.
- ★ `metrics.volume.caveat` — Los ejercicios de peso corporal cuentan como 0 kg de volumen porque no tienen un peso externo registrado. Una sesión de dominadas y fondos puede salir con muy poco volumen aunque haya sido dura.
- `metrics.setsDonePlanned.name` — Series hechas y planificadas
- ★ `metrics.setsDonePlanned.what` — Muestra cuántas series registraste frente a las que tenía la sesión, para ver si la completaste.
- ★ `metrics.setsDonePlanned.formula` — hechas = series con datos registrados o marcadas · planificadas = suma de las series de la plantilla
- ★ `metrics.setsDonePlanned.rules` — Las planificadas se congelan al guardar la sesión. Un ejercicio que te saltas desaparece de la sesión guardada, pero sus series siguen contando en las planificadas: eso es lo que hace visible el hueco.
- ★ `metrics.setsDonePlanned.caveat` — Una serie marcada sin datos cuenta como hecha igual que una con peso y repeticiones.
- `metrics.volumeTrend.name` — Volumen (pestaña Progreso)
- ★ `metrics.volumeTrend.what` — Compara el volumen de la primera sesión del período con el de la última.
- ★ `metrics.volumeTrend.formula` — (volumen de la última sesión − volumen de la primera) ÷ volumen de la primera × 100
- ★ `metrics.volumeTrend.caveat` — No es una línea de tendencia: son dos puntos. Una sesión atípica en cualquiera de los dos extremos cambia el resultado por completo.
- `metrics.muscleGroupSets.name` — Series por grupo muscular
- ★ `metrics.muscleGroupSets.what` — Reparte las series de los últimos 7 días entre los grupos musculares, para ver si alguno se está quedando corto.
- ★ `metrics.muscleGroupSets.formula` — suma de las series de los ejercicios cuyo grupo muscular principal es ese
- ★ `metrics.muscleGroupSets.rules` — Cuenta volumen directo: un press de banca suma a pecho y no reparte nada a tríceps ni a hombro. Un dropset cuenta como una sola serie. Los grupos que entrenaste en las 4 semanas anteriores pero no en los últimos 7 días aparecen a cero en vez de desaparecer.
- ★ `metrics.muscleGroupSets.caveat` — El rango de referencia de {{min}} a {{max}} series es orientativo para hipertrofia y depende de tu objetivo. Al ignorar el volumen indirecto, los grupos que trabajas sobre todo como secundarios salen más bajos de lo que realmente entrenas.
- `metrics.sessionLoad.name` — Carga de la sesión
- ★ `metrics.sessionLoad.what` — Resume en un número cuánto te ha costado una sesión, juntando su duración con lo dura que te pareció. Es la base de todo el panel de Carga.
- `metrics.sessionLoad.formula` — carga = sRPE × minutos de sesión
- ★ `metrics.sessionLoad.rules` — Sin responder al sRPE no hay carga: la sesión deja un hueco en las gráficas, nunca un cero. Los bloques de acondicionamiento aportan {{blockFactor}} unidades por segundo activo.
- ★ `metrics.sessionLoad.caveat` — Es el método sRPE de Foster. El número no significa nada por sí solo: solo tiene sentido comparado con tus propias sesiones. El factor de los bloques está calibrado a ojo y es la parte menos fiable del cálculo.
- `metrics.sessionMinutes.name` — Minutos de sesión
- ★ `metrics.sessionMinutes.what` — Es la duración que se usa para calcular la carga de la sesión.
- ★ `metrics.sessionMinutes.formula` — minutos = tiempo real transcurrido, limitado entre la mitad y el doble de la duración estimada
- ★ `metrics.sessionMinutes.rules` — El tiempo real va desde que empiezas la sesión hasta que la guardas. El límite evita que una sesión que dejaste abierta varias horas multiplique tu carga.
- ★ `metrics.sessionMinutes.caveat` — Ese tiempo incluye descansos, pausas y el móvil en el bolsillo. Como las series no guardan la hora a la que las hiciste, no existe una medida del tiempo realmente activo.
- `metrics.externalLoad.name` — Carga externa
- ★ `metrics.externalLoad.what` — Mide el trabajo que hiciste en repeticiones ponderadas por lo cerca que estuviste de tu máximo. Sirve para comparar sesiones con ejercicios distintos.
- ★ `metrics.externalLoad.formula` — carga externa = suma de repeticiones × (peso ÷ 1RM de referencia)
- ★ `metrics.externalLoad.rules` — El 1RM de referencia es tu mejor 1RM estimado de las 6 semanas anteriores a esa sesión, congelado por fecha para que un récord de hoy no reescriba tu historial. Los ejercicios de peso corporal necesitan que hayas registrado tu peso corporal; los isométricos y las series de tiempo no entran, porque no tienen repeticiones.
- ★ `metrics.externalLoad.caveat` — No es tonelaje: normaliza por tu capacidad actual, así que una serie de curl y una de sentadilla a la misma intensidad relativa aportan una carga similar. Al depender del 1RM estimado, hereda su margen de error.
- `metrics.movingAverage.name` — Medias de 7 y 28 días
- ★ `metrics.movingAverage.what` — Son las líneas suaves del gráfico de carga: tu carga habitual de la última semana y del último mes. Sirven para ver la forma general por encima del ruido del día a día.
- ★ `metrics.movingAverage.formula` — media de la carga diaria de los últimos 7 (o 28) días, contando los días de descanso como 0
- ★ `metrics.movingAverage.rules` — Mientras no tienes 28 días de historial se promedian los días que haya, en vez de dejar la línea sin empezar. Los días en los que entrenaste sin responder al sRPE quedan fuera del promedio en lugar de contar como cero: desconocido no es descanso.
- ★ `metrics.movingAverage.caveat` — Una media móvil suaviza, pero también retrasa: un cambio real de carga tarda unos días en verse reflejado en la línea.
- `metrics.loadState.name` — Estado de carga
- ★ `metrics.loadState.what` — Resume si estás acumulando carga, manteniéndola estable o descargando.
- ★ `metrics.loadState.formula` — media de 7 días ÷ media de 28 días → menos de 0,8 descarga · de 0,8 a 1,3 estable · más de 1,3 acumulación
- `metrics.loadState.rules` — Se muestra como estado y no como número a propósito.
- ★ `metrics.loadState.caveat` — Es la relación agudo/crónico. La versión numérica arrastra artefactos matemáticos conocidos y sus umbrales de riesgo no se replican de forma consistente en los estudios, así que conviene tomarlo como orientación y no como un semáforo.
- `metrics.monotony.name` — Monotonía
- ★ `metrics.monotony.what` — Indica si repites la misma carga día tras día sin variación, un patrón asociado a peor recuperación. Cuanto MÁS BAJA, mejor: significa que alternas días duros con días suaves.
- ★ `metrics.monotony.formula` — monotonía = media de la carga diaria ÷ su desviación típica, sobre 7 días
- ★ `metrics.monotony.rules` — Los días de descanso cuentan como 0, tal como define el método original. Se oculta cuando la semana tiene menos de {{minSessions}} sesiones. Por encima de {{high}} se marca como alta; por debajo de {{moderate}}, como baja.
- ★ `metrics.monotony.caveat` — Con una o dos sesiones en la semana, los días de descanso dominan la desviación y el número deja de significar nada: por eso se oculta en lugar de mostrarse en verde.
- `metrics.strain.name` — Strain
- ★ `metrics.strain.what` — Resume el estrés acumulado de la semana juntando cuánta carga hiciste con lo poco que la variaste.
- `metrics.strain.formula` — strain = carga total de la semana × monotonía
- ★ `metrics.strain.rules` — Se muestra comparado con tu propio promedio de las 4 semanas anteriores. Se oculta cuando la semana tiene menos de {{minSessions}} sesiones, igual que la monotonía.
- ★ `metrics.strain.caveat` — No existe un umbral universal de strain, así que nunca se muestra con colores fijos ni con un valor de alarma: solo tiene sentido frente a tu propio historial.
- `metrics.indexed100.name` — Base 100
- ★ `metrics.indexed100.what` — Es el reescalado que permite dibujar juntas dos magnitudes con unidades distintas, como la carga externa y el esfuerzo.
- `metrics.indexed100.formula` — valor ÷ primer valor del período × 100
- ★ `metrics.indexed100.rules` — El 100 corresponde al principio del período seleccionado, así que cambia al mover el selector.
- ★ `metrics.indexed100.caveat` — Si la primera semana del período fue atípica —una descarga, por ejemplo— desplaza toda la serie hacia arriba.
- `metrics.loadHeatmap.name` — Mapa de calor del calendario
- ★ `metrics.loadHeatmap.what` — Tiñe cada día del calendario según la carga de la sesión, para localizar de un vistazo tus días duros y tus rachas.
- ★ `metrics.loadHeatmap.formula` — cuatro escalones repartidos por cuartiles de tu propia carga diaria
- ★ `metrics.loadHeatmap.rules` — Los cortes se calculan sobre todo tu historial, no sobre el mes visible, para que al cambiar de mes signifiquen lo mismo. Un día entrenado sin responder al sRPE se dibuja con contorno y sin relleno, porque no hay carga que representar.
- ★ `metrics.loadHeatmap.caveat` — El color ordena tus días entre sí, no contra un valor absoluto: siempre habrá días oscuros y días claros aunque entrenes de forma muy uniforme.
- `metrics.sessionCount.name` — Sesiones
- ★ `metrics.sessionCount.what` — Cuenta las sesiones que has completado dentro del período seleccionado. Sirve para saber si estás manteniendo el ritmo.
- `metrics.sessionCount.formula` — número de sesiones guardadas dentro del período
- ★ `metrics.sessionCount.rules` — Responde al selector de período y al filtro de programa. El subtítulo «esta semana», en cambio, siempre cuenta la semana natural en curso, de lunes a domingo, con independencia del período elegido.
- ★ `metrics.sessionCount.caveat` — Cuenta sesiones, no su tamaño: un calentamiento de diez minutos y una sesión de dos horas suman lo mismo.
- `metrics.weekSessions.name` — Sesiones (últimos 7 días)
- ★ `metrics.weekSessions.what` — Cuántas veces has entrenado en los últimos 7 días. Está junto a la carga porque es lo que le da sentido: 2.400 de carga no significa lo mismo saliendo de 3 sesiones que de 5.
- `metrics.weekSessions.formula` — número de sesiones guardadas en los últimos 7 días
- ★ `metrics.weekSessions.rules` — Es una ventana móvil de 7 días, no la semana natural: un lunes por la mañana la semana natural está casi vacía y el dato no serviría. El subtítulo es tu media de las 4 semanas anteriores, para saber si esta semana es normal para ti. Es además el recuento que decide si la monotonía y el strain se muestran o se ocultan.
- ★ `metrics.weekSessions.caveat` — Cuenta sesiones, no su tamaño: un calentamiento de diez minutos y una sesión de dos horas suman lo mismo. No confundir con la tarjeta «Sesiones» de Progreso, que cuenta el período seleccionado.
- `metrics.progressionChip.name` — Recomendación de progresión
- ★ `metrics.progressionChip.what` — Es la sugerencia de subir, mantener o bajar que aparece en cada ejercicio durante el entrenamiento, a partir de cómo te fue la última vez.
- ★ `metrics.progressionChip.formula` — series válidas ÷ series objetivo, cruzado con el rango de repeticiones y con el RPE si lo registras
- ★ `metrics.progressionChip.rules` — Una serie válida es la que alcanzó el mínimo de repeticiones (o de tiempo) del ejercicio; una serie marcada como hecha sin datos también cuenta. Con el modo de evaluación por RPE, subir exige además que el RPE promedio no supere el techo que hayas fijado.
- ★ `metrics.progressionChip.caveat` — Mira solo tu última sesión de ese ejercicio, no tu evolución. Es una sugerencia: ignorarla no afecta a nada más.
- `metrics.estimatedDuration.name` — Duración estimada
- ★ `metrics.estimatedDuration.what` — Calcula cuánto va a durar una sesión antes de hacerla, para poder ajustarla al tiempo del que dispones.
- ★ `metrics.estimatedDuration.formula` — series × (35 s + descanso) + 180 s por ejercicio + 480 s de calentamiento general
- ★ `metrics.estimatedDuration.rules` — Los 180 segundos por ejercicio cubren la transición: buscar la máquina, montar el peso, ajustar. En superseries se cuenta el descanso completo de cada miembro.
- ★ `metrics.estimatedDuration.caveat` — Es un modelo, no una medida: asume que respetas los descansos configurados y no sabe si te entretienes entre series. En superseries sobreestima algo.
- `metrics.warmupWeight.name` — Pesos de calentamiento
- ★ `metrics.warmupWeight.what` — Propone los pesos de las series de aproximación a partir del peso de trabajo del día.
- ★ `metrics.warmupWeight.formula` — peso = porcentaje del peso de trabajo del día, redondeado a 2,5 kg
- ★ `metrics.warmupWeight.rules` — El peso de trabajo sale de la prescripción del entrenador o, si no la hay, de tu serie más pesada la última vez. Sin ninguna de las dos, las pills salen vacías hasta que escribas tu primer peso. No se guardan en el historial.
- ★ `metrics.warmupWeight.caveat` — Son orientativos: el porcentaje no distingue entre ejercicios ni tiene en cuenta cómo te encuentras ese día.
- `metrics.blockDelta.name` — Comparación de bloques
- ★ `metrics.blockDelta.what` — Indica si mejoraste respecto a la última vez que hiciste ese mismo bloque de acondicionamiento.
- ★ `metrics.blockDelta.formula` — AMRAP: rondas y repeticiones · EMOM: rondas completadas · For time: tiempo
- ★ `metrics.blockDelta.rules` — En los bloques for time menos tiempo es mejor, así que el signo va invertido respecto a los otros dos formatos. Se compara contra la vez anterior de la misma sesión, no contra tu mejor resultado.
- ★ `metrics.blockDelta.caveat` — Los bloques no registran el peso usado, así que dos resultados iguales con cargas distintas se comparan como si fueran equivalentes.
- `metrics.stageProgress.name` — Progreso de etapa
- ★ `metrics.stageProgress.what` — En qué semana de la etapa vas y cuántas sesiones llevas, para saber cuánto te queda y si hace falta alargarla.
- ★ `metrics.stageProgress.formula` — semana de la etapa = semanas de calendario desde el lunes de la semana 1 · sesiones esperadas = semanas × sesiones de la etapa
- ★ `metrics.stageProgress.rules` — La semana 1 la fija la primera sesión de la etapa (de jueves a domingo, empieza el lunes siguiente). Al acabar, si faltan sesiones por valor de una semana o más, se propone alargar. El contador de sesiones es del cliente y se replica al entrenador; no se deduce del historial, así que borrar una sesión no lo baja.
- ★ `metrics.stageProgress.caveat` — Las semanas que añades al alargar no suben las sesiones esperadas: sirven para recuperar las que faltaban.
- `metrics.adherence.name` — Adherencia
- ★ `metrics.adherence.what` — Avisa de qué clientes se están descolgando de la frecuencia que pide su programa. Mide riesgo de abandono a partir del tiempo sin entrenar, no el porcentaje de sesiones cumplidas.
- ★ `metrics.adherence.formula` — días desde la última sesión ÷ (7 ÷ sesiones por semana) → hasta 2 al día · más de 4 en riesgo
- ★ `metrics.adherence.rules` — El umbral se adapta a la frecuencia del programa, así que es justo entre clientes que entrenan 2 o 5 días por semana. El promedio semanal usa las 4 semanas completas anteriores, sin contar la que está en curso, para que un lunes por la mañana no parezca un frenazo. Pausar a un cliente silencia la adherencia.
- ★ `metrics.adherence.caveat` — No es un porcentaje de cumplimiento: un cliente que entrena hoy sale bien aunque llevara tres semanas parado. Mide cuánto hace que no entrena en relación con lo que debería, no lo que ha hecho acumulado.

## components/ui/MetricInfo.jsx

Aparece en: Clients, Stats

- `docs.metricsTitle` — Cómo se calcula cada número
- `docs.chartRead` — Cómo leerla
- `docs.chartParts` — Datos que lo componen
- `chartDocs.loadOverTime.name` — Evolución de la carga
- ★ `chartDocs.loadOverTime.what` — Cada barra es la carga de un día. Las dos líneas son la media de los últimos 7 días (lima) y de los últimos 28 (azul), que enseñan la forma general por debajo del ruido del día a día.
- ★ `chartDocs.loadOverTime.read` — Cuando la línea de 7 días va por encima de la de 28 estás acumulando más carga de la habitual; cuando cae por debajo, estás descargando. Que se crucen a menudo es señal de alternancia sana. Lo que conviene vigilar es una separación grande y sostenida.
- `chartDocs.effortVsLoad.name` — Esfuerzo vs carga
- ★ `chartDocs.effortVsLoad.what` — Dos líneas semanales: el trabajo que haces (carga externa) y lo que te cuesta (esfuerzo). Van en unidades distintas, así que las dos se reescalan a base 100 para poder compararlas.
- ★ `chartDocs.effortVsLoad.read` — Lo que importa es si se separan, no dónde están. Más trabajo al mismo coste significa que te estás adaptando. El mismo trabajo costando más es fatiga acumulada. Las dos subiendo es un bloque duro, y las dos bajando, una descarga.
- `chartDocs.performance.name` — Rendimiento
- ★ `chartDocs.performance.what` — Cómo evoluciona tu 1RM estimado medio a lo largo del período, con 100 en tu punto de partida.
- ★ `chartDocs.performance.read` — Es la salida del sistema: la carga es lo que metes y esto es lo que sale. Subir aquí con la carga estable es la señal más clara de que el entrenamiento está funcionando. Que baje mientras la carga sube suele avisar de un estancamiento.
- `chartDocs.strainWeekly.name` — Strain por semana
- ★ `chartDocs.strainWeekly.what` — El estrés acumulado de cada semana, una barra por semana. Las semanas con menos de 3 sesiones van en contorno: se entrenó, pero no hay dato fiable que dibujar.
- ★ `chartDocs.strainWeekly.read` — Manda la forma, no la altura concreta. Tres o cuatro semanas subiendo y luego una caída es un mesociclo sano. Subir sin caer nunca es lo que hay que vigilar.
- `chartDocs.muscleGroups.name` — Series por grupo
- ★ `chartDocs.muscleGroups.what` — Las series de los últimos 7 días repartidas por grupo muscular, con dos marcas que señalan el rango de referencia.
- ★ `chartDocs.muscleGroups.read` — Busca huecos, no perfección. Un grupo a cero o muy por debajo del rango varias semanas seguidas es lo accionable. Pasarse por arriba no es malo en sí mismo si te recuperas bien.

## components/ui/NoProgram.jsx

Aparece en: Home, MyProgram

- `header.newProgramWarnTitle` — Crear nuevo programa
- ★ `header.newProgramWarnBody` — Al crear un programa nuevo te desconectarás de tu entrenador y el programa actual será reemplazado.
- `common.cancel` — Cancelar
- `common.continue` — Continuar
- `home.noActiveProgram` — No hay programa activo.
- `home.newProgram` — ＋ NUEVO PROGRAMA

## components/ui/ProgramCard.jsx

Aparece en: Clients, MyProgram

- `programCard.eyebrowClient` — Programa asignado
- `programCard.eyebrowSelf` — Tu programa
- `home.bannerBy` — por
- `programCard.week` — Semana
- `home.selectStage` — Seleccionar etapa
- `programCard.statAdherence` — Adherencia
- `programCard.sessionsPerWeek` — ses/sem
- `programCard.statPace` — Ritmo
- `programCard.statLoad` — Carga
- `programCard.edit` — EDITAR
- `programCard.view` — VER PROGRAMA
- `home.moreOptions` — Más opciones

## components/ui/ScreenHeader.jsx

Aparece en: BlockEditor, CustomExercise, Docs, DriveBackup, ExerciseEditor, ExerciseSelector, NextSession, Onboarding, PasteWorkout, ProgramDetail, ProgramEditor, SessionEditor, StagePlanner, TrainerConnection, Workout

- `programView.eyebrow` — PROGRAMA
- `planner.eyebrow` — Plan del programa
- `editor.sessionEyebrow` — Editar sesión {{label}}

## components/ui/StageCards.jsx

Aparece en: ProgramEditor

- `editor.stageWord` — Etapa
- `editor.newStageA11y` — Nueva etapa

## components/ui/VariantPicker.jsx

Aparece en: CustomExercise, ExerciseEditor, Workout

- `variants.backToProgram` — Volver a la del programa
- `variants.dim.grip` — Agarre
- `variants.dim.width` — Anchura
- `variants.dim.unilateral` — Unilateral
- `variants.options.grip.pronated` — Prono
- `variants.options.grip.supinated` — Supino
- `variants.options.grip.neutral` — Neutro
- `variants.options.width.wide` — Ancho
- `variants.options.width.medium` — Medio
- `variants.options.width.narrow` — Estrecho

## components/workout/AdHocTargetSheet.jsx

Aparece en: Workout

- `exerciseEditor.fieldSets` — Series
- `exerciseEditor.fieldRest` — Descanso
- `exerciseEditor.fieldMinTime` — Tiempo mín
- `exerciseEditor.fieldMaxTime` — Tiempo máx
- `exerciseEditor.fieldMinReps` — Reps mín
- `exerciseEditor.fieldMaxReps` — Reps máx
- ★ `workout.adHocTargetHint` — Solo para esta sesión. Los ejercicios añadidos sobre la marcha no se guardan en el programa.

## components/workout/ConditioningBlockCard.jsx

Aparece en: Workout

- `blocks.cancel` — Cancelar bloque
- `blocks.cancelConfirm` — ¿Cancelar el bloque? Se perderá el progreso.
- `common.cancel` — Cancelar
- `blocks.cappedTag` — (cap)
- `blocks.lastLabel` — Última vez
- `blocks.roundDone` — Ronda completada
- `blocks.removeRound` — Restar ronda
- `blocks.reopen` — Reabrir
- `blocks.movements` — Movimientos
- `blocks.start` — EMPEZAR
- `blocks.addMovementsHint` — Añade movimientos al bloque
- `blocks.roundsLabel` — Rondas
- `blocks.perRound` — Por ronda
- `blocks.timeUp` — ¡Tiempo! Ajusta tu score y finaliza
- `blocks.roundsDone` — Rondas completadas
- `blocks.partialReps` — + reps parciales
- `blocks.finishWithScore` — Finalizar · {{score}}
- `blocks.partialHint` — Al acabar el tiempo podrás ajustar la ronda parcial
- `blocks.roundLabel` — Ronda
- `blocks.nextUp` — Siguiente
- `blocks.timeUpEmom` — ¡Tiempo! Marca los fallos y finaliza
- `blocks.failHint` — Toca una ronda para marcarla como fallada
- `blocks.capLabel` — Tiempo límite
- `blocks.finish` — Finalizar
- `blocks.formats.amrap` — AMRAP
- `blocks.formats.emom` — EMOM
- `blocks.formats.for_time` — For time
- `blocks.units.reps` — reps
- `blocks.units.cal` — cal
- `blocks.units.m` — m
- `blocks.units.sec` — seg

## components/workout/ExerciseCard.jsx

Aparece en: Workout

- `workout.warmup.metaSuffix` —  · C×{{count}}
- `common.keyExercise` — Principal
- `workout.thisSession` — esta sesión
- `workout.warmup.collapsedSummary` — {{label}} · {{count}} series hasta {{weight}}
- `workout.warmup.blockLabel` — Calentamiento
- `workout.warmup.restLabel` — Descanso {{sec}}s
- `workout.warmup.noTimer` — Sin temporizador
- `workout.warmup.noReference` — Los pesos se calculan al escribir tu primer peso de trabajo
- `workout.e1rmShort` — 1RM
- `workout.e1rmNoRpe` — Apunta el RPE
- `workout.coachTarget` — Objetivo de tu entrenador
- `workout.setsSectionLabel` — Series
- `workout.reps` — Reps
- `workout.timeSec` — Seg
- `workout.dropsetLabel` — Drops · sin descanso
- `workout.addDropBtn` — Añadir drop
- `workout.addSetBtn` — Añadir serie
- `variants.title` — Variante
- `variants.todayTitle` — Hoy · solo esta sesión
- ★ `variants.todayHint` — El programa no cambia. Queda apuntado en el registro de hoy.
- `workout.progSheet.lastTime` — La última vez
- `workout.progSheet.first` — Primera vez
- `workout.progSheet.rule` — Regla
- `workout.clientNotePlaceholder` — Nota para tu entrenador (molestias, sensaciones…)
- `workout.notesSavedWith` — Se guarda con la sesión al pulsar GUARDAR SESIÓN.
- `workout.progression.firstWeight` — Busca tu peso
- `workout.progression.firstBodyweight` — Haz las que puedas
- `workout.progression.firstTime` — Aguanta lo que puedas
- ★ `workout.progSheet.firstWeight` — Elige un peso con el que hagas {{what}} en todas las series. Desde la próxima sesión, la progresión decide.
- ★ `workout.progSheet.firstEffort` — Elige un peso con el que hagas {{what}}. Desde la próxima sesión, la progresión lo calcula.
- ★ `workout.progSheet.firstBodyweight` — Haz las reps que puedas en cada serie ({{what}}). Desde la próxima sesión, la progresión decide.
- ★ `workout.progSheet.firstTime` — Aguanta lo que puedas en cada serie ({{what}}). Desde la próxima sesión, la progresión decide.
- `workout.progSheet.e1rmMany` — 1RM estimado: {{kg}} (media de {{count}} sesiones)
- `workout.progSheet.e1rmOne` — 1RM estimado: {{kg}}
- `variants.options.grip.pronated` — Prono
- `variants.options.grip.supinated` — Supino
- `variants.options.grip.neutral` — Neutro
- `variants.options.width.wide` — Ancho
- `variants.options.width.medium` — Medio
- `variants.options.width.narrow` — Estrecho
- `workout.progression.up` — Subir
- `workout.progression.hold` — Mantener
- `workout.progression.down` — Bajar
- `workout.progression.deload` — Descarga
- `workout.progression.upTo` — Subir a
- `workout.progression.downTo` — Bajar a
- `workout.progression.deloadTo` — Descarga a
- `workout.progression.effortTo` — Peso objetivo
- `workout.progression.assistLessTo` — Menos ayuda
- `workout.progression.assistMoreTo` — Más ayuda

## components/workout/NotesModal.jsx

Aparece en: Workout

- `common.save` — Guardar

## components/workout/ScrubRuler.jsx

Aparece en: Workout

- `workout.reps` — Reps
- `workout.scrubCancel` — Cancelar

## components/workout/SupersetBlock.jsx

Aparece en: Workout

- `workout.supersetHeader` — Superserie · {{count}} rondas · alternando
- `workout.supersetFooterPrefix` — Descanso 
- `workout.supersetFooterSuffix` —  tras cada ronda
- `workout.addSetBtn` — Añadir serie

## hooks/useEditorExit.js

Aparece en: BlockEditor, ExerciseEditor, ProgramEditor, SessionEditor

- `freeSession.toastSaved` — Sesión guardada
- `editor.toastProgramEdited` — Programa editado

## hooks/useLastDays.js

Aparece en: Clients, PasteWorkout

- `dayCard.today` — Hoy

## navigation/RootNavigator.jsx

Aparece en: —

- `tabs.session` — Sesión
- `tabs.program` — Programa
- `tabs.progress` — Progresión
- `tabs.clients` — Clientes
- `tabs.templates` — Plantillas

## screens/BlockEditorScreen.jsx

Aparece en: BlockEditor

- `editor.blockEyebrow` — Editar bloque
- `blocks.formats.amrap` — AMRAP
- `blocks.formats.emom` — EMOM
- `blocks.formats.for_time` — For time

## screens/ClientsScreen.jsx

Aparece en: Clients

- `clients.changesPendingTag` — CAMBIOS SIN ENVIAR
- ★ `clients.changesPendingText` — Has editado el programa y el cliente todavía tiene la versión anterior.
- `clients.menuUpload` — Subir a cliente
- `clients.stageLockedTag` — ETAPA BLOQUEADA
- ★ `clients.stageLockedText` — Ha terminado {{current}}. {{next}} está bloqueada y no puede entrar.
- `clients.stageUnlockBtn` — Desbloquear y enviar
- `clients.blockDoneTag` — BLOQUE TERMINADO
- ★ `clients.blockDoneText` — Ha terminado {{current}} y no hay etapa siguiente: repetirá esta hasta que le montes el próximo bloque.
- `clients.blockDoneBtn` — Planificar siguiente etapa
- `home.stageDefault` — Etapa {{n}}
- `clients.stageFinishedStaying` — Ha terminado {{current}} y sigue en ella
- `clients.nextSectionLabel` — Próxima sesión
- `clients.sessionMeta` — {{count}} ejercicios · {{minutes}} min aprox
- `clients.prepare` — Preparar
- ★ `clients.nextSessionHintLinked` — Entrena con su app: lo que haga te llega solo. Preparar ajusta solo esta sesión; el programa no cambia.
- `clients.programMenuTitle` — Programa
- `clients.assignProgram` — Asignar programa
- `clients.menuShare` — Compartir
- `clients.menuExport` — Exportar
- `clients.menuImportHistory` — Importar historial
- `clients.menuSaveTemplate` — Guardar como plantilla
- `clients.menuArchived` — Programas archivados
- `clients.menuDeassign` — Archivar
- `clients.menuDelete` — Eliminar programa
- `clients.codeCard.reissueConfirmTitle` — Generar un código nuevo
- ★ `clients.codeCard.reissueConfirmBody` — El código actual dejará de funcionar y {{name}} tendrá que introducir el nuevo. Su historial y su programa se conservan. ⏎  ⏎ Úsalo si ha reinstalado la app, ha perdido el código, o el código se le ha filtrado a alguien.
- `common.cancel` — Cancelar
- `clients.codeCard.reissueConfirmCta` — Generar
- `clients.codeCard.reissueDone` — Código nuevo generado
- `clients.codeCard.reissueError` — No se pudo generar el código nuevo
- `clients.codeCard.cancelConfirmTitle` — Cancelar la invitación
- ★ `clients.codeCard.cancelConfirmBody` — El código de {{name}} deja de funcionar y vuelve a ser un cliente sin app: le apuntarás tú sus entrenos.
- `clients.codeCard.cancelConfirmCta` — Cancelar invitación
- `clients.codeCard.cancelDone` — Invitación cancelada
- `common.error` — Error
- `clients.keyTab.copied` — Código copiado
- ★ `clients.codeCard.shareText` — Te invito a Forma Fit para enviarte tu programa. Toca para conectar: {{url}} ⏎  ⏎ Si te pide un código: {{code}}
- `clients.keyTab.connecting` — Conectando…
- `clients.codeCard.reissue` — Generar código nuevo
- `clients.codeCard.linkedLine` — Entrena con su app: lo que haga te llega solo.
- `clients.keyTab.connectedNoCode` — Conectado · sin código local
- `clients.codeCard.share` — Compartir
- `clients.codeCard.cancel` — Cancelar invitación
- `clients.codeCard.waiting` — Esperando a {{name}}
- `clients.moveToApp.step1` — Se genera su código.
- `clients.moveToApp.step1Sub` — Se lo das y lo introduce en la app.
- `clients.moveToApp.step2NoLog` — Se sube su programa.
- `clients.moveToApp.step2Sub` — Al conectarse, le aparecen en su historial.
- `clients.moveToApp.step3` — Dejas de apuntarle.
- `clients.moveToApp.step3Sub` — A partir de ahora lo hace desde su móvil.
- `clients.moveToApp.done` — Código generado
- `clients.keyTab.connectError` — No se pudo conectar.
- `clients.moveToApp.title` — Pasar a {{name}} a la app
- `clients.moveToApp.btn` — GENERAR CÓDIGO
- `clients.newProgramModal.nameLabel` — Nombre
- `clients.newProgramModal.namePlaceholder` — Nombre del programa
- `clients.assign.title` — Asignar programa
- `clients.newProgramModal.createBtn` — CREAR Y EDITAR
- `clients.assign.assignBtn` — ASIGNAR
- `clients.assign.replaces` — Sustituye a {{name}}, que pasa a Programas archivados.
- `clients.assign.fromBlank` — En blanco
- `clients.assign.fromTemplate` — Plantilla
- `clients.assign.fromClient` — De otro cliente
- `clients.assign.fromFile` — Importar archivo
- `onboarding.sessionsPerWeek` — Sesiones por semana
- `editor.weeksQuestion` — ¿Cuántas semanas dura esta etapa?
- `editor.weeksOpen` — Sin límite
- `editor.weeksNoLimit` — Sin límite — la etapa dura hasta que añadas la siguiente
- `editor.stageWeeksUnit` — Semanas
- `clients.assign.viewActive` — Activos
- `clients.assign.viewArchived` — Archivados
- `clients.assign.mine` — Tuyos
- `clients.assign.withHistory` — Importar historial ({{count}})
- `clients.billSheet.date` — Fecha
- `clients.billSheet.added` — Cobro registrado
- `clients.billSheet.title` — Nueva entrada
- `clients.billSheet.client` — Cliente
- `clients.billSheet.noClients` — Crea un cliente antes de registrar un cobro.
- `clients.billSheet.clientPlaceholder` — Elige un cliente
- `clients.billSheet.searchClient` — Buscar cliente…
- `clients.billSheet.noMatches` — Ningún cliente con ese nombre
- `clients.billSheet.amount` — Importe
- `clients.billSheet.concept` — Concepto
- `clients.billConceptPlaceholder` — Concepto (ej: Mensualidad junio)
- `clients.billSheet.status` — Estado
- `clients.billPending` — Pendiente
- `clients.statusPaid` — Pagado
- `clients.billSheet.add` — AÑADIR
- `clients.clientConnected` — Cliente conectado
- `clients.infoCodeLabel` — CÓDIGO CLIENTE
- `clients.infoCloudLabel` — SINCRONIZACIÓN EN LA NUBE
- `clients.infoCloudNoCode` — Conectado · sin código local
- `clients.connecting` — Conectando…
- `clients.connectCloud` — ☁️ Conectar a la nube
- `clients.actProgress` — Ver progreso
- `clients.actNextSession` — Próxima sesión
- `clients.actEditProgram` — Editar programa
- `clients.actInfo` — Info del cliente
- `clients.workoutInProgress` — Entreno a medias
- `clients.btnContinue` — Continuar
- `clients.noActiveProgram` — Sin programa activo
- `clients.btnProgram` — Programar
- `clients.pendingTitle` — Cambios sin enviar
- `clients.btnSendOverride` — Enviar
- `clients.stageLockedShort` — Etapa siguiente bloqueada
- `clients.stageUnlockShort` — Desbloquear
- `clients.blockDoneShort` — Sin etapa siguiente
- `clients.blockPlanShort` — Planificar
- `clients.notTraining` — Sin entrenar
- `clients.slowingDown` — Bajando el ritmo
- `freePlan.frozenLabel` — Fuera de plan
- `clients.statusPaused` — En pausa
- `clients.statusInactive` — Inactivo
- `clients.statusInvited` — Esperando código
- `clients.lastWeek` — última semana
- `clients.stageNWeeks` — sem {{n}} de {{total}}
- `clients.info.link_linked` — Con app
- `clients.actStartSession` — Empezar sesión {{label}}
- `clients.sendAllDone` — Todo enviado
- `clients.sendAllPartial` — {{ok}} enviados · {{fail}} sin enviar
- `dayCard.today` — Hoy
- `dayCard.yesterday` — Ayer
- `dayCard.daysAgo` — Hace {{count}} días
- `clients.pendingLabel` — Pendiente
- `clients.info.upToDate` — Al día
- `clients.toastStageUnlocked` — {{name}} desbloqueada y enviada
- `clients.programUploadError` — No se pudo subir el programa.
- `clients.deleteClientTitle` — Eliminar cliente
- `clients.deleteClientConfirm` — ¿Eliminar cliente y todos sus programas e historial?
- `common.delete` — Eliminar
- `clients.programFallback` — Programa
- `clients.toastSavedTemplate` — Guardado en Plantillas
- `errors.invalidFile` — Archivo no válido
- `clients.assign.noProgramInFile` — El archivo no contiene ningún programa
- `clients.errorUpdateHistory` — Error al actualizar historial
- `clients.tabs.programs` — Programa
- `clients.tabs.history` — Historial
- `clients.tabs.progress` — Progreso
- `clients.tabs.info` — Info
- `clients.period.7d` — 7 días
- `clients.period.30d` — 30 días
- `clients.period.all` — Todo
- `clients.programSent` — Programa enviado
- `clients.deleteProgramTitle` — Eliminar programa
- `clients.deleteProgramConfirm` — ¿Eliminar "{{name}}"?
- `clients.reactivateTitle` — Reactivar programa
- ★ `clients.reactivateConfirm` — "{{name}}" pasará a ser el programa activo y el actual se archivará. ¿Continuar?
- `clients.menuReactivate` — Reactivar
- `clients.archiveTitle` — Archivar programa
- ★ `clients.archiveConfirm` — "{{name}}" pasará a Programas archivados y el cliente se quedará sin programa activo. Podrás reactivarlo cuando quieras.
- `clients.noArchivedPrograms` — Este cliente no tiene programas archivados.
- `clients.scope.active` — Programa activo
- `clients.scope.all` — Todos los programas
- `clients.noSessionsFilter` — Sin sesiones para este filtro.
- `clients.statusLabel` — Estado
- `clients.statusActive` — Activo
- `clients.filterTags` — Etiquetas
- `clients.info.newTag` — Nueva
- `clients.info.newTagPlaceholder` — Nombre de la etiqueta
- `clients.info.tagsHint` — Toca una etiqueta para asignarla o quitarla.
- `clients.personalData` — Datos personales
- `clients.fieldNameAlias` — Alias
- `clients.fieldFullName` — Nombre
- `clients.fieldPhone` — Teléfono
- `clients.fieldEmail` — Email
- `clients.fieldNotes` — Notas
- `clients.notesPlaceholder` — Objetivos, lesiones, preferencias, observaciones...
- `clients.notesSavedHint` — Se guarda al salir del campo.
- `clients.bodyWeight` — Peso corporal
- `clients.noWeightData` — Sin datos todavía.
- `clients.billing` — Facturación
- `clients.billedLabel` — Facturado
- `clients.receivedLabel` — Cobrado
- `clients.noBillingData` — Sin entradas todavía.
- `clients.billDeleteConfirm` — ¿Eliminar esta factura?
- ★ `clients.info.billHint` — Toda entrada nace pendiente · toca la pastilla para darla por cobrada · mantén pulsada la fila para borrarla.
- `clients.info.connection` — Conexión
- ★ `clients.info.noAppLine` — Le apuntas tú sus entrenos. Si empieza a usar la app, pásalo y recibirá todo lo que le hayas apuntado.
- `clients.moveToApp.open` — Pasar a la app
- `paste.title` — Pegar entreno
- `clients.newBtn` — + Cliente
- `clients.searchPlaceholder` — Buscar cliente…
- `clients.summary.needs` — Pendientes
- `clients.summary.adherence` — Adherencia
- `clients.summary.adherenceSub` — media 4 sem
- `clients.summary.improvement` — Mejora
- `clients.summary.improvementSub` — media 8 sem
- `clients.listHeader` — Clientes
- `clients.sort.done` — Listo
- `clients.sendAllRow` — Cambios sin enviar · {{count}} clientes
- `clients.sending` — Enviando…
- `clients.sendAll` — Enviar todo
- `freePlan.roomTitle` — Te queda un hueco libre
- ★ `freePlan.bannerSub` — El plan gratis llega a {{max}} clientes, {{maxApp}} con app. Elige con quién sigues.
- `freePlan.roomSub` — Puedes recuperar a un cliente sin hacerte Pro.
- `freePlan.bannerBtn` — Elegir
- `clients.noResults` — Sin resultados para esa búsqueda
- `clients.noClientsEmpty` — Sin clientes. Pulsa ＋ Nuevo para añadir uno.
- `freePlan.frozenSection` — Fuera de plan
- `clients.folded` — En pausa o esperando código
- `clients.overrideSent` — Prescripción enviada
- `clients.overrideSendFailed` — No se pudo enviar la prescripción.
- `clients.sort.title` — Ordenar
- `clients.sort.activity` — Actividad
- `clients.sort.activitySub` — El que entrenó más recientemente, primero
- `clients.sort.name` — Nombre
- `clients.sort.nameSub` — De la A a la Z
- `clients.sort.manual` — A mano
- `clients.sort.manualSub` — Tu orden, arrastrando
- `clients.sort.reorder` — Reordenar
- `clients.sort.needsFirst` — Lo pendiente, arriba
- `clients.sort.needsFirstSub` — Avisos y botones encima de tu orden
- `clients.filterSheet.title` — Filtros
- `clients.filterSheet.status` — Estado
- `clients.filterSheet.statusAll` — Todos
- `clients.filterSheet.statusActive` — Activos
- `clients.filterSheet.statusInactive` — Inactivos
- `clients.filterSheet.tags` — Etiquetas
- `clients.searchTagPlaceholder` — Buscar etiqueta…
- `clients.deleteTagTitle` — Eliminar etiqueta
- ★ `clients.deleteTagConfirm` — «{{name}}» está asignada a {{count}} cliente(s). ¿Eliminarla de todos?
- `clients.filterSheet.clear` — Limpiar filtros
- `clients.newClientModal.title` — Nuevo cliente
- `clients.newClientModal.nameLabel` — Nombre
- `clients.newClientModal.namePlaceholder` — Nombre del cliente
- `clients.newClientModal.modeLabel` — ¿Cómo va a entrenar?
- `clients.newClientModal.modeHint` — Puedes cambiarlo cuando quieras desde Info.
- `clients.newClientModal.createBtn` — CREAR CLIENTE
- `clients.codeCard.waitLine` — Que descargue Forma Fit e introduzca este código.
- ★ `clients.codeCard.needProgram` — Asígnale un programa: el código funciona en cuanto tenga uno.
- `clients.sort.lensAdherence` — Adherencia ↑
- `clients.sort.lensImprovement` — Mejora ↑
- `clients.statusBilled` — Facturado
- `clients.info.link_none` — Sin app
- `clients.info.link_invited` — Esperando código
- `clients.newClientModal.mode_app` — Entrena con la app
- `clients.newClientModal.mode_appSub` — Le das un código y recibe sus programas en el móvil.
- `clients.newClientModal.mode_self` — Le apuntas tú
- `clients.newClientModal.mode_selfSub` — Entrena contigo o por mensajes, y tú registras lo que hace.

## screens/CustomExerciseScreen.jsx

Aparece en: CustomExercise

- ★ `exerciseEditor.effortUnreliable` — A partir de {{max}} reps, contando las de recámara, el cálculo del peso deja de ser fiable
- `exerciseEditor.effortVolume` — {{reps}} reps · RPE {{rpe}}
- `exerciseEditor.progTitle.none` — Sin progresión
- `exerciseEditor.progTitle.effort` — Por esfuerzo
- `exerciseSelector.equipment.bodyweight` — Corporal
- `exerciseSelector.levelBeginner` — Principiante
- `exerciseSelector.levelIntermediate` — Intermedio
- `customExercise.levelAdvanced` — Avanzado
- `exerciseEditor.restSummary` — {{s}}s descanso
- `customExercise.toastCreated` — Ejercicio creado
- `customExercise.eyebrow` — Ejercicio propio
- `customExercise.title` — Nuevo ejercicio
- `customExercise.createBtn` — Añadir
- `customExercise.nameLabel` — NOMBRE
- `customExercise.namePlaceholder` — Ej: Press Pallof con cable
- `customExercise.nameError` — El nombre es obligatorio
- `exerciseEditor.summaryTitle` — RESUMEN DEL EJERCICIO
- `exerciseEditor.sectionVolume` — Volumen
- `exerciseEditor.metricReps` — Reps
- `exerciseEditor.metricTime` — Tiempo
- `exerciseEditor.fieldSets` — Series
- `exerciseEditor.fieldRest` — Descanso
- `exerciseEditor.fieldStartTime` — Tiempo de inicio
- `exerciseEditor.fieldMinTime` — Tiempo mín
- `exerciseEditor.fieldMaxTime` — Tiempo máx
- `exerciseEditor.fieldMinReps` — Reps mín
- `exerciseEditor.fieldMaxReps` — Reps máx
- `exerciseEditor.sectionProgramming` — Programación
- `exerciseEditor.sectionProgression` — Progresión
- `variants.section` — Variante
- `variants.unilateral` — Unilateral
- `variants.none` — Sin especificar
- `variants.dim.unilateral` — Unilateral
- `variants.dim.grip` — Agarre
- `variants.dim.width` — Anchura
- `exerciseEditor.sectionOptions` — Opciones
- `exerciseEditor.tempoLabel` — Tempo
- `customExercise.notesLabel` — NOTAS DE EJECUCIÓN
- `customExercise.notesPlaceholder` — Ej: Mantener la columna neutra...
- `customExercise.tagsRowTitle` — Clasificación
- `customExercise.tagsRowEmpty` — Toca para configurar
- `customExercise.tagsRowHint` — Patrón · grupo muscular · equipo · tipo · nivel
- `variants.title` — Variante
- `variants.howHint` — Solo informa: no cambia el historial ni la progresión.
- `variants.widthNA` — La anchura no aplica a un ejercicio unilateral.
- `variants.identityTitle` — Cambia el ejercicio
- `variants.unilateralNewHint` — Se hace a una mano, siempre: no tiene anchura.
- ★ `exerciseEditor.tempoHint` — Excéntrica · Pausa · Concéntrica · Pausa (ej. 3010; X = explosivo)
- `customExercise.tagsSheetTitle` — Clasificación y avanzado
- `customExercise.patternSectionLabel` — PATRÓN DE MOVIMIENTO
- `exerciseSelector.filters.muscleGroup` — GRUPO MUSCULAR
- `exerciseSelector.filters.equipment` — EQUIPO
- `exerciseSelector.filters.type` — TIPO
- `exerciseSelector.filters.compound` — Compuesto
- `exerciseSelector.filters.isolation` — Aislamiento
- `customExercise.levelSectionLabel` — NIVEL TÉCNICO
- `exerciseEditor.fieldStartReps` — Reps de inicio
- `exerciseEditor.fieldFixedReps` — Reps
- `exerciseEditor.progTitle.weight` — Peso
- `exerciseEditor.progTitle.assist` — Asistencia
- `exerciseEditor.progTitle.reps` — Reps
- `exerciseEditor.progTitle.time` — Tiempo
- `exerciseSelector.patterns.vertical_pull` — Tracción vertical
- `exerciseSelector.patterns.horizontal_pull` — Tracción horizontal
- `exerciseSelector.patterns.vertical_push` — Empuje vertical
- `exerciseSelector.patterns.horizontal_push` — Empuje horizontal
- `exerciseSelector.patterns.squat` — Pierna (rodilla)
- `exerciseSelector.patterns.hip_hinge` — Pierna (cadera)
- `exerciseSelector.patterns.core` — Core
- `exerciseSelector.patterns.carry_grip` — Agarre / Carga
- `exerciseSelector.patterns.calf_raise` — Gemelos
- `exerciseSelector.groups.chest` — Pecho
- `exerciseSelector.groups.back` — Espalda
- `exerciseSelector.groups.shoulders` — Hombro
- `exerciseSelector.groups.arms` — Brazos
- `exerciseSelector.groups.biceps` — Bíceps
- `exerciseSelector.groups.triceps` — Tríceps
- `exerciseSelector.groups.quads` — Cuádriceps
- `exerciseSelector.groups.glutes_hamstrings` — Glúteo e isquios
- `exerciseSelector.groups.legs_lower` — Gemelos
- `exerciseSelector.groups.core` — Core
- `exerciseSelector.groups.grip` — Agarre
- `exerciseSelector.equipment.barbell` — Barra
- `exerciseSelector.equipment.dumbbells` — Mancuernas
- `exerciseSelector.equipment.cables` — Polea
- `exerciseSelector.equipment.machines` — Máquina
- `exerciseSelector.equipment.kettlebell` — Kettlebell
- `exerciseSelector.equipment.resistance_band` — Bandas
- `exerciseSelector.equipment.pullup_bar` — Barra dominadas
- `exerciseSelector.equipment.parallettes` — Paralelas
- `exerciseSelector.equipment.rings` — Anillas
- `exerciseSelector.equipment.ab_wheel` — Rueda abdominal
- `exerciseSelector.equipment.rope` — Cuerda
- `exerciseSelector.equipment.weight_belt` — Lastre
- `exerciseEditor.repsMode.range` — Rango
- `exerciseEditor.repsMode.fixed` — Reps fijas

## screens/DocsScreen.jsx

Aparece en: Docs

- `header.sectionAccount` — CUENTA
- `docs.title` — Documentación
- ★ `docs.intro` — Cómo se organiza el entrenamiento en la app y qué significa cada término. Los cuatro primeros —sesión, semana, etapa y programa— encajan unos dentro de otros: cada uno agrupa al anterior.
- `docs.metricsTitle` — Cómo se calcula cada número
- ★ `docs.metricsIntro` — Cada dato que ves en la app sale de una fórmula concreta, y todas tienen un límite. Aquí están las dos cosas.
- `docs.metricGroups.performance` — Rendimiento y récords
- `docs.metricGroups.volume` — Volumen
- `docs.metricGroups.load` — Carga
- `docs.metricGroups.session` — Sesión y plan
- `docs.metricGroups.trainer` — Lado entrenador

## screens/DriveBackupScreen.jsx

Aparece en: DriveBackup

- `dayCard.today` — Hoy
- `dayCard.yesterday` — Ayer
- `drive.loadingConnect` — Conectando con Google…
- `drive.toastConnected` — Google Drive conectado
- `drive.errConnectTitle` — No se pudo conectar
- `drive.loadingBackups` — Cargando copias…
- `drive.loadingBackup` — Guardando copia…
- `drive.toastSaved` — Copia guardada
- `drive.errExpiredTitle` — Permiso caducado
- ★ `drive.errExpiredBody` — Vuelve a conectar tu cuenta de Google para seguir guardando copias.
- `drive.errBackupTitle` — No se pudo guardar la copia
- `drive.restoreTitle` — Restaurar esta copia
- ★ `drive.restoreBody` — Todo lo que tienes ahora en la app (programas, historial y ajustes) se reemplaza por lo que había en la copia del {{when}}. Esto no se puede deshacer.
- `common.cancel` — Cancelar
- `drive.restoreConfirm` — Restaurar
- `drive.loadingRestore` — Descargando la copia…
- `drive.toastRestored` — Copia restaurada
- `drive.errRestoreTitle` — No se pudo restaurar
- `drive.deleteAllTitle` — Borrar todas las copias
- ★ `drive.deleteAllBody` — Se borrarán de tu Google Drive y no se podrán recuperar. La app seguirá conectada y guardará copias nuevas.
- `drive.deleteAllConfirm` — Borrar todo
- `drive.loadingDelete` — Borrando…
- `drive.toastDeleted` — Copias borradas
- `drive.errDeleteTitle` — No se pudieron borrar
- `drive.disconnectTitle` — Desconectar la cuenta
- ★ `drive.disconnectBody` — Se dejarán de guardar copias nuevas. Las copias que ya están en tu Drive no se borran y puedes volver a conectarte cuando quieras.
- `drive.disconnectConfirm` — Desconectar
- `drive.toastDisconnected` — Cuenta desconectada
- `header.sectionConnections` — CONEXIONES
- `drive.title` — Copia en Drive
- `drive.tabSettings` — Ajustes
- `drive.tabBackups` — Copias
- `drive.offTitle` — Sin copia de seguridad
- ★ `drive.reconnectSub` — Google ha caducado el permiso. Vuelve a conectar la cuenta para seguir guardando copias.
- ★ `drive.offSub` — Tus datos viven solo en este móvil. Si lo pierdes o reinstalas la app, se van con él.
- `drive.activeSub` — Última copia: {{when}}
- `drive.activeSubNever` — Todavía no se ha guardado ninguna copia.
- `drive.reconnectCta` — VOLVER A CONECTAR
- ★ `drive.expoGoNote` — La conexión con Google no funciona en Expo Go. Prueba con la app instalada (build EAS).
- `drive.sectionFrequency` — CUÁNDO SE GUARDA
- `drive.sectionName` — NOMBRE DEL ARCHIVO
- `drive.namePlaceholder` — forma-backup
- `drive.namePreview` — Se guardará como {{name}}
- ★ `drive.nameHint` — Se le añade la fecha automáticamente, así distingues cada copia en Drive.
- `drive.sectionActions` — ACCIONES
- `drive.backupNow` — Guardar una copia ahora
- `drive.backupNowSub` — No esperes a la próxima sesión.
- `drive.disconnect` — Desconectar la cuenta
- ★ `drive.disconnectSub` — Se dejan de guardar copias nuevas. Las que ya están en Drive no se borran.
- `drive.deleteAll` — Borrar todas las copias
- `drive.deleteAllSub` — Se borran de tu Drive y no se pueden recuperar.
- `drive.sectionHow` — QUÉ HACE
- `drive.how1Title` — Guarda todo en tu Drive
- ★ `drive.how1Sub` — Programas, historial, ejercicios propios, ajustes, y también tus clientes y plantillas de sesión, en la carpeta «Forma Backups» de tu Google Drive.
- `drive.how2Title` — Es tu cuenta, no la nuestra
- ★ `drive.how2Sub` — La app solo puede ver los archivos que ella misma crea; el resto de tu Drive le es invisible.
- `drive.how3Title` — Se guardan las 30 últimas
- ★ `drive.how3Sub` — Cada copia es un archivo con su fecha. Al pasar de 30, las más viejas se borran solas.
- `drive.connectCta` — CONECTAR CON GOOGLE
- ★ `drive.backupsNeedConnect` — Conecta tu cuenta de Google en la pestaña Ajustes para ver tus copias.
- ★ `drive.backupsNeedReconnect` — La sesión con Google ha caducado, así que no se ha podido consultar tu Drive. Vuelve a conectar en la pestaña Ajustes: tus copias siguen ahí.
- ★ `drive.backupsLoadFailed` — No se ha podido consultar tu Drive. Desliza hacia abajo para reintentar.
- `drive.backupsEmpty` — Todavía no hay ninguna copia en tu Drive.
- `drive.backupsHint` — Toca una copia para restaurarla en este móvil.
- `drive.tagActive` — COPIA ACTIVA
- `drive.tagReconnect` — HAY QUE RECONECTAR
- `drive.tagOff` — SIN COPIAS
- `drive.freqSession` — Al terminar cada sesión
- ★ `drive.freqSessionSub` — Recomendado: la copia va siempre al día y no necesita permisos en segundo plano.
- `drive.freqDaily` — Una vez al día
- `drive.freqDailySub` — En segundo plano, aunque no entrenes ese día.
- `drive.freqWeekly` — Una vez a la semana
- `drive.freqWeeklySub` — En segundo plano, aunque no entrenes esa semana.
- `drive.freqMonthly` — Una vez al mes
- `drive.freqMonthlySub` — En segundo plano, aunque no entrenes ese mes.

## screens/ExerciseEditorScreen.jsx

Aparece en: ExerciseEditor

- `editor.exerciseEyebrow` — Editar ejercicio
- `editor.toastExDeleted` — Ejercicio eliminado

## screens/ExerciseSelectorScreen.jsx

Aparece en: ExerciseSelector

- `editor.toastExAdded` — Ejercicio añadido
- `exerciseEditor.toastSubstituted` — Ejercicio sustituido
- `exerciseSelector.customBadge` — PROPIO
- `exerciseSelector.titleAdd` — Añadir ejercicios
- `exerciseSelector.titleReplace` — Sustituir ejercicio
- `exerciseSelector.addActionN` — Añadir {{count}}
- `exerciseSelector.addAction` — Añadir
- `exerciseSelector.searchPlaceholder2` — Buscar ejercicio
- `exerciseSelector.createExercise` — ＋ Crear ejercicio
- `exerciseSelector.noResults` — Sin resultados
- `exerciseSelector.filters.title` — Filtros
- `exerciseSelector.filters.clear` — Limpiar
- `exerciseSelector.filters.muscleGroup` — GRUPO MUSCULAR
- `exerciseSelector.filters.equipment` — EQUIPO
- `exerciseSelector.filters.type` — TIPO
- `exerciseSelector.filters.compound` — Compuesto
- `exerciseSelector.filters.isolation` — Aislamiento
- `exerciseSelector.filters.seeNone` — Sin resultados
- `exerciseSelector.groups.chest` — Pecho
- `exerciseSelector.groups.back` — Espalda
- `exerciseSelector.groups.shoulders` — Hombro
- `exerciseSelector.groups.arms` — Brazos
- `exerciseSelector.groups.biceps` — Bíceps
- `exerciseSelector.groups.triceps` — Tríceps
- `exerciseSelector.groups.quads` — Cuádriceps
- `exerciseSelector.groups.glutes_hamstrings` — Glúteo e isquios
- `exerciseSelector.groups.legs_lower` — Gemelos
- `exerciseSelector.groups.core` — Core
- `exerciseSelector.groups.grip` — Agarre
- `exerciseSelector.equipment.bodyweight` — Corporal
- `exerciseSelector.equipment.barbell` — Barra
- `exerciseSelector.equipment.dumbbells` — Mancuernas
- `exerciseSelector.equipment.cables` — Polea
- `exerciseSelector.equipment.machines` — Máquina
- `exerciseSelector.equipment.kettlebell` — Kettlebell
- `exerciseSelector.equipment.resistance_band` — Bandas
- `exerciseSelector.equipment.pullup_bar` — Barra dominadas
- `exerciseSelector.equipment.parallettes` — Paralelas
- `exerciseSelector.equipment.rings` — Anillas
- `exerciseSelector.equipment.ab_wheel` — Rueda abdominal
- `exerciseSelector.equipment.rope` — Cuerda
- `exerciseSelector.equipment.weight_belt` — Lastre
- `exerciseSelector.patternGroups.push` — Empuje
- `exerciseSelector.patternGroups.pull` — Tracción
- `exerciseSelector.patternGroups.squat` — Sentadilla
- `exerciseSelector.patternGroups.hinge` — Bisagra
- `exerciseSelector.patternGroups.core` — Core
- `exerciseSelector.patternGroups.grip` — Agarre
- `exerciseSelector.patternGroups.calf` — Gemelos

## screens/HomeScreen.jsx

Aparece en: Home

- `home.dayTrained` — entrenaste
- `dayCard.today` — Hoy
- `freeSession.templateUnnamed` — Sesión libre
- `home.currentStageDefault` — la etapa actual
- `home.advanceTo` — AVANZAR A {{name}}
- `home.stageLockedTitle` — Etapa bloqueada
- ★ `home.stageLockedText` — Has terminado {{current}}. La siguiente, {{next}}, está bloqueada — tu entrenador tiene que abrirla.
- `home.stageLockedHint` — Mientras tanto puedes seguir entrenando esta etapa.
- `home.understood` — ENTENDIDO
- `home.stageEndedTitle` — Etapa terminada
- `home.stageCompleted` — ¡Etapa completada!
- `home.stageAdvanceText` — Has terminado {{current}}. ¿Empezar {{next}}?
- `home.oneMoreWeek` — UNA SEMANA MÁS
- ★ `home.stageEarlyText` — Ya has hecho las {{expected}} sesiones de {{current}}. Puedes pasar a {{next}} ya o terminar la semana.
- `home.notNow` — AHORA NO
- `home.sessionMeta` — {{count}} ejercicios · ~{{minutes}} min
- `home.heroMetaLast` — última {{rel}}
- `home.firstTime` — Primera vez
- `home.sessions` — Tus sesiones
- `workout.sessionLabel` — Sesión {{label}}
- `home.sessionDone` — Completada
- `home.sessionPending` — Pendiente
- `home.rowMinutes` — ~{{minutes}} min
- `freeSession.sectionTitle` — Sesiones libres
- `freeSession.badge` — Sesión libre
- `freeSession.btnContinue` — Continuar sesión libre
- `freeSession.btn` — + Sesión libre
- `freeSession.startTitle` — Sesión libre
- `freeSession.startNow` — Empezar ya
- `freeSession.startNowDesc` — Una sesión en blanco, sobre la marcha
- `freeSession.create` — Crear sesión libre
- `freeSession.createDesc` — Prepárala en el editor para repetirla cuando quieras
- `freeSession.fromTemplates` — Desde tus plantillas
- `freeSession.fromTemplatesDesc` — Crea una copia de la plantilla
- `freeSession.templatesTitle` — Tus plantillas de sesión
- `freeSession.addedToHome` — Añadida a tu Inicio

## screens/MyProgramScreen.jsx

Aparece en: MyProgram

- `home.stageDefault` — Etapa {{n}}
- `myProgram.stagesLabel` — Etapas
- `home.stageLockedShort` — La abre tu entrenador
- `home.stageOpen` — Sin límite
- `myProgram.stageConfirm.title` — Cambiar a {{name}}
- ★ `myProgram.stageConfirm.bodyStarted` — Empezarás {{name}} desde la semana 1: lo que llevas de la etapa en curso deja de contar.
- `myProgram.stageConfirm.body` — Pasarás a entrenar esta etapa.
- `common.cancel` — Cancelar
- `myProgram.stageConfirm.confirm` — Cambiar
- `errors.invalidFile` — Archivo no válido
- `errors.noHistoryInFile` — El archivo no contiene ningún entreno
- `header.toastImported` — Datos importados
- `clients.deleteProgramTitle` — Eliminar programa
- `clients.deleteProgramConfirm` — ¿Eliminar "{{name}}"?
- `clients.menuDelete` — Eliminar programa
- `home.moreOptions` — Más opciones
- `header.newProgramItem` — Nuevo programa
- `clients.menuShare` — Compartir
- `clients.menuExport` — Exportar
- `clients.menuImportHistory` — Importar historial
- `clients.menuSaveTemplate` — Guardar como plantilla
- `clients.toastSavedTemplate` — Guardado en Plantillas
- `home.archive` — Archivar
- `home.archiveModal.title` — Archivar programa
- `home.archiveModal.desc` — Se guardará en archivados. Podrás restaurarlo después.
- `home.archiveModal.keepHistory` — Mantener historial
- ★ `home.archiveModal.keepHistoryDesc` — El programa se archiva, el historial de sesiones se conserva
- `home.archiveModal.clearHistory` — Borrar historial
- ★ `home.archiveModal.clearHistoryDesc` — Se eliminarán todas las sesiones registradas de este programa

## screens/NextSessionScreen.jsx

Aparece en: NextSession

- `workout.reps` — Reps
- `workout.timeSec` — Seg
- `nextSession.notConnectedTitle` — Cliente sin conexión
- ★ `nextSession.notConnectedBody` — Este cliente no está conectado a la nube, así que no se le puede enviar la prescripción.
- `nextSession.sent` — Enviado a {{name}}
- `nextSession.sendFailed` — No se pudo enviar.
- `nextSession.title` — Próxima sesión
- `nextSession.clear` — Limpiar
- `nextSession.noProgram` — Este cliente no tiene programa activo.
- ★ `nextSession.hint` — Ajusta solo lo que quieras cambiar. Lo que no toques sigue su progresión.
- `nextSession.last` — Última: {{summary}}
- `nextSession.noLast` — Sin datos previos
- `nextSession.notePlaceholder` — Nota (solo esta sesión)…
- `nextSession.send` — Enviar a {{name}}
- `nextSession.onlyNext` — Solo afecta a la próxima sesión

## screens/OnboardingScreen.jsx

Aparece en: Onboarding

- `onboarding.newProgram` — NUEVO PROGRAMA
- `onboarding.preview.exerciseCount` — {{exercises}} ejercicios
- `onboarding.preview.estimatedMinutes` — ~{{minutes}} min
- `onboarding.preview.setCount` — {{sets}} series
- `onboarding.proposals.best` — MEJOR
- `onboarding.proposals.weeks` — {{weeks}} semanas
- `onboarding.proposals.sessionsLabel` — SESIONES
- `onboarding.proposals.setsLabel` — SERIES
- `onboarding.proposals.demandLabel` — EXIGENCIA
- `common.error` — Error
- `onboarding.generateError` — No se pudo generar el programa. Inténtalo de nuevo.
- `onboarding.programNamePlaceholder` — Ej: Lucas - Full Body
- `errors.cannotReadFile` — No se pudo leer el archivo
- `onboarding.generating` — GENERANDO PROGRAMA
- `onboarding.buildingPlan` — Construyendo tu plan personalizado...
- `onboarding.limitations.none.label` — Sin limitaciones
- `onboarding.chips.limitationsCount` — {{count}} limitación
- `onboarding.preview.eyebrow` — TU PROGRAMA
- `onboarding.preview.setsLabel` — SERIES
- `onboarding.preview.perSessionLabel` — POR SESIÓN
- ★ `onboarding.preview.noWarmupNote` — Tiempo estimado sin calentamiento general — en sesiones cortas se entra a trabajar. Incluye el cambio de material entre ejercicios.
- `onboarding.preview.adjustSectionLabel` — Ajustes
- `onboarding.preview.adjustNavSubtitle` — Tiempo, material y limitaciones
- `onboarding.preview.changeLater` — Puedes cambiar cualquier cosa después, en el editor.
- `onboarding.preview.edit` — EDITAR
- `onboarding.preview.start` — EMPEZAR
- `onboarding.proposals.title` — Selecciona tu programa
- `onboarding.proposals.seeTop` — Ver sólo las recomendadas
- `onboarding.proposals.seeAll` — Ver las {{total}} plantillas
- `onboarding.howToCreate` — ¿Cómo lo creamos?
- `onboarding.modeAuto` — Elegir programa
- ★ `onboarding.modeAutoDesc` — Eliges entre programas ya hechos y lo adaptamos a tus días y tu material.
- `onboarding.modeRecommended` — RECOMENDADO
- `onboarding.modeManual` — Programa vacío
- `onboarding.modeManualDesc` — Montas tú la estructura y añades tus propios ejercicios.
- `onboarding.modeImport` — Importar archivo
- `onboarding.modeImportDesc` — Abre un archivo .fitdata exportado desde Forma Fit.
- `onboarding.modeTemplate` — Cargar plantilla
- `onboarding.modeTemplateDesc` — Parte de una de tus {{count}} plantillas guardadas.
- `onboarding.modeTrainer` — Tengo un entrenador
- `onboarding.modeTrainerDesc` — Introduce su código y recibe el programa ya sincronizado.
- `onboarding.modeFooterHint` — Sea cual sea el camino, luego puedes editarlo todo.
- `onboarding.programName` — Nombre del programa
- `onboarding.sessionsPerWeek` — Sesiones por semana
- ★ `onboarding.emptySessionsHint` — Se crearán {{count}} sesiones vacías. Podrás añadir más, y los ejercicios, desde el editor.
- `onboarding.back` — ATRÁS
- `onboarding.createAndEdit` — CREAR Y EDITAR
- `onboarding.yourTemplates` — Tus plantillas
- `onboarding.templateMeta` — {{count}} sesiones por semana
- `onboarding.templateCopyHint` — La plantilla no se toca: se copia.
- `onboarding.createProgram` — CREAR PROGRAMA
- `onboarding.stepLevel.headerTitle` — Tu nivel
- `onboarding.stepLevel.title` — ¿Cuál es tu nivel?
- `onboarding.stepLevel.hint` — Marca tu banda de volumen y qué programas te proponemos.
- `onboarding.identity.title` — ¿Qué buscas?
- `onboarding.identity.subtitle` — Con esto elegimos el tipo de programa.
- `onboarding.stepDays.headerTitle` — Días por semana
- `onboarding.stepDays.subtitleFrequency` — ¿Cuántos días a la semana entrenas?
- ★ `onboarding.stepDays.daysHint` — Cada sesión del programa es un entreno a la semana. Si un programa no cuadra con tus días, te lo decimos.
- ★ `onboarding.proposals.notes.needsBarbell` — Diseñado con barra. Sin ella sustituimos {{exercises}} ejercicios.
- ★ `onboarding.proposals.notes.moreSessions_one` — Son {{sessions}} sesiones por semana, más que el día que elegiste. Puedes quitar alguna en el editor.
- ★ `onboarding.proposals.notes.moreSessions_other` — Son {{sessions}} sesiones por semana, más que los {{count}} días que elegiste. Puedes quitar alguna en el editor.
- ★ `onboarding.proposals.notes.fewerSessions_one` — Son {{sessions}} sesiones por semana, menos que el día que elegiste. Puedes añadir alguna en el editor.
- ★ `onboarding.proposals.notes.fewerSessions_other` — Son {{sessions}} sesiones por semana, menos que los {{count}} días que elegiste. Puedes añadir alguna en el editor.
- ★ `onboarding.proposals.notes.levelStretch` — Pensada para nivel {{level}}; adaptamos ejercicios y volumen.
- `onboarding.proposals.notes.lowFrequency` — Cada grupo, una vez por semana.
- `onboarding.levels.beginner.label` — Principiante
- `onboarding.levels.beginner.description` — Menos de 1 año entrenando o volviendo tras una pausa larga.
- ★ `onboarding.levels.beginner.detail` — Ejercicios guiados por máquina, patrones básicos con peso corporal y mancuernas. Progresión sencilla y segura.
- `onboarding.levels.intermediate.label` — Intermedio
- `onboarding.levels.intermediate.description` — 1–3 años entrenando con continuidad.
- ★ `onboarding.levels.intermediate.detail` — Mancuernas, cables, kettlebell y ejercicios de peso corporal técnicos como dominadas o fondos. Doble progresión.
- `onboarding.levels.advanced.label` — Avanzado
- `onboarding.levels.advanced.description` — Más de 3 años con técnica sólida en movimientos libres.
- ★ `onboarding.levels.advanced.detail` — Barra libre, ejercicios lastrados, periodización. Requiere buena técnica en sentadilla, peso muerto y press.
- `onboarding.adjustSheet.material.gym` — Gimnasio
- `onboarding.adjustSheet.material.home` — Casa
- `onboarding.adjustSheet.material.bodyweight` — Cuerpo
- `onboarding.adjustSheet.material.custom` — Otro
- `onboarding.limitations.none.description` — Puedo hacer cualquier ejercicio sin restricciones.
- `onboarding.limitations.shoulder.label` — Hombro / Trapecio
- `onboarding.limitations.shoulder.description` — Molestias en hombro, manguito rotador o trapecio.
- `onboarding.limitations.lower_back.label` — Zona lumbar
- `onboarding.limitations.lower_back.description` — Problemas en la zona baja de la espalda.
- `onboarding.limitations.knee.label` — Rodilla
- `onboarding.limitations.knee.description` — Molestias en rodilla o menisco.
- `onboarding.goals.hypertrophy.label` — Hipertrofia
- `onboarding.goals.hypertrophy.description` — Aumentar masa muscular. 8–12 reps por serie.
- `onboarding.goals.endurance.label` — Resistencia
- `onboarding.goals.endurance.description` — Aguantar más. 12–20 reps, descansos cortos.
- `onboarding.goals.strength.label` — Fuerza
- `onboarding.goals.strength.description` — Mover más peso. 5–8 reps, descansos largos.
- `onboarding.goals.max_strength.label` — Fuerza máxima
- `onboarding.goals.max_strength.description` — Máximo rendimiento. 3–5 reps, solo avanzado.
- `onboarding.identity.muscle.label` — Ganar músculo
- `onboarding.identity.muscle.description` — Hipertrofia general. El enfoque más completo y versátil.
- `onboarding.identity.strength.label` — Ponerte fuerte
- ★ `onboarding.identity.strength.description` — Sentadilla, peso muerto y press como eje. Series pesadas y descansos largos.
- `onboarding.identity.glutes_legs.label` — Glúteo y pierna
- `onboarding.identity.glutes_legs.description` — Máximo énfasis en glúteo, isquios y pierna.
- `onboarding.identity.calisthenics.label` — Calistenia
- ★ `onboarding.identity.calisthenics.description` — Peso corporal, agarre y core. Fuerza relativa y control del cuerpo.

## screens/PasteWorkoutScreen.jsx

Aparece en: PasteWorkout

- `freeSession.templateUnnamed` — Sesión libre
- `paste.pickTitle` — ¿Qué ejercicio es?
- `paste.eyebrow` — Lo que te devolvió
- `paste.title` — Pegar entreno
- `paste.placeholder` — Pega aquí el texto que te devolvió el cliente
- `paste.pasteBtn` — Pegar
- `paste.who` — De quién
- `paste.online` — {{name}} usa la app: sus entrenos los apunta él.
- `paste.noClients` — No tienes clientes sin app.
- `paste.noSessions` — {{name}} no tiene sesiones que apuntar.
- `clients.logPast.which` — Qué sesión
- `freeSession.sectionTitle` — Sesiones libres
- `clients.logPast.when` — Cuándo
- `paste.review` — Lo que se ha entendido
- `paste.empty` — Pega un texto para ver lo que se entiende.
- `paste.block` — Se apunta en el entreno
- `paste.unknown` — Sin reconocer
- `paste.notDone` — No lo hizo
- `paste.added` — añadido
- `paste.pick` — Elegir
- `paste.continue` — Continuar

## screens/ProgramDetailScreen.jsx

Aparece en: ProgramDetail

- `workout.perSide` — c/p
- `programView.stageFallback` — Etapa {{n}}
- `programView.blockMin` — {{count}} min
- `programView.blockEmom` — {{count}} × {{interval}}
- `programView.diffSets` — {{signed}} series
- `programView.diffPrefix` — Frente a {{name}}
- `load.groupOther` — Otros
- `common.keyExercise` — Principal
- `programView.dropsetLine` — última serie con dropset
- `programView.sessionMin` — {{count}} min
- `programView.sessionSets` — {{count}} series
- `programView.emptySession` — Sin ejercicios
- `programView.weeksOpen` — ∞
- `programView.forClient` — Para {{name}}
- `programView.byTrainer` — Programa de {{name}}
- `programView.eyebrow` — PROGRAMA
- `programView.notFound` — Programa no encontrado
- `programView.statStages` — ETAPAS
- `programView.statWeeks` — SEMANAS
- `programView.statSessions` — SESIONES
- `editor.weeksOpen` — Sin límite
- `programView.volumeTitle` — SERIES POR GRUPO Y SEMANA
- `programView.volumeMark` — ▏{{name}}
- ★ `programView.volumeHint` — Las marcas del carril señalan el rango de referencia de {{min}}-{{max}} series semanales.
- `exerciseSelector.groups.chest` — Pecho
- `exerciseSelector.groups.back` — Espalda
- `exerciseSelector.groups.shoulders` — Hombro
- `exerciseSelector.groups.arms` — Brazos
- `exerciseSelector.groups.biceps` — Bíceps
- `exerciseSelector.groups.triceps` — Tríceps
- `exerciseSelector.groups.quads` — Cuádriceps
- `exerciseSelector.groups.glutes_hamstrings` — Glúteo e isquios
- `exerciseSelector.groups.legs_lower` — Gemelos
- `exerciseSelector.groups.core` — Core
- `exerciseSelector.groups.grip` — Agarre
- `blocks.units.reps` — reps
- `blocks.units.cal` — cal
- `blocks.units.m` — m
- `blocks.units.sec` — seg
- `blocks.formats.amrap` — AMRAP
- `blocks.formats.emom` — EMOM
- `blocks.formats.for_time` — For time

## screens/ProgramEditorScreen.jsx

Aparece en: ProgramEditor

- `editor.sessionDeleteBtn` — Eliminar sesión
- `editor.sessionDeleteConfirm` — Se borra «{{name}}» del programa.
- `common.cancel` — Cancelar
- `editor.toastSessionDuplicated` — Sesión duplicada
- `planner.deleteTitle` — Eliminar etapa
- `planner.deleteBody` — Se perderán las sesiones de «{{name}}».
- `common.delete` — Eliminar
- `editor.toastStageDeleted` — Etapa eliminada
- `editor.weeksOpen` — Sin límite
- `editor.stageRangeWeeks` — {{n}} sem
- `editor.stageRangeOpen` — sem {{from}}+
- `editor.stageRangeOne` — sem {{from}}
- `editor.stageRange` — sem {{from}}-{{to}}
- `editor.stageBrowNow` — En curso · {{week}}
- `editor.stageBrowDone` — Hecha
- `editor.stageBrowDeload` — Descarga
- `editor.stageBrowNext` — Por venir
- `editor.stageWeeksOpenLong` — Sin límite de semanas
- `editor.titleEditClient` — EDITAR PROGRAMA DE CLIENTE
- `editor.titleEdit` — EDITAR PROGRAMA
- `editor.programNamePlaceholder` — Nombre del programa
- `editor.viewPlan` — Ver plan ›
- `editor.stageBrowLocked` — Bloqueada
- `editor.stageSettingsA11y` — Ajustes de la etapa
- `editor.sessionsOfStage` — Sesiones de esta etapa
- `editor.rowDuplicate` — Duplicar
- `editor.rowDelete` — Eliminar
- `editor.sessionMeta` — {{ex}} ejercicios · {{sets}} series · ~{{min}} min
- `editor.sessionMetaNoTime` — {{ex}} ejercicios · {{sets}} series
- `editor.addSessionPrefix` — + Añadir sesión a 
- `editor.addSession` — + Añadir sesión
- `editor.sessionOrderTitle` — Qué sesión toca
- `editor.stageSheetTitle` — Etapa
- `editor.stageNameLabel` — Nombre
- `editor.stageName` — Nombre de la etapa
- `editor.stageFromLabel` — Derivada de
- `editor.stageDurationLabel` — Duración
- `editor.weeksNoLimit` — Sin límite — la etapa dura hasta que añadas la siguiente
- `editor.stageWeeksUnit` — Semanas
- `editor.stageStateLabel` — Estado
- `editor.stageIsActive` — Etapa activa
- `editor.stageActiveHint` — Es la etapa que entrena el atleta ahora
- `editor.stageActiveBadge` — ACTIVA
- `home.stageLockedShort` — La abre tu entrenador
- `editor.toastStageActivated` — {{name}} activada
- `editor.stageActivateBtn` — Activar esta etapa
- `editor.stageAccessLabel` — Acceso
- `editor.stageAccessOpen` — Libre
- `editor.stageAccessLocked` — Bloqueada
- `editor.toastStageDuplicated` — Etapa duplicada
- `editor.stageDuplicateBtn` — Duplicar etapa
- `editor.stageDeleteBtn` — Eliminar etapa
- `editor.stageAccessLockedHint` — El cliente no entra hasta que tú la desbloquees
- `editor.stageAccessOpenHint` — El cliente entra en cuanto termina la anterior
- `editor.sessionOrder_rotation` — Rotación
- `editor.sessionOrder_weekly` — Desde la A
- `editor.sessionOrder_free` — Libre
- `editor.sessionOrderHint_rotation` — Toca la que más tiempo se lleva sin hacer.
- ★ `editor.sessionOrderHint_weekly` — Cada lunes vuelve a la A: toca la primera que no se ha hecho esta semana.
- `editor.sessionOrderHint_free` — Ninguna toca: cada día se elige la que se quiera.

## screens/ProgramScreen.jsx

Aparece en: Program

- `templates.assignModal.assignBtn` — Asignar
- `templates.newModal.title` — Nueva plantilla
- `common.cancel` — Cancelar
- `templates.newModal.namePlaceholder` — Nombre de la plantilla
- `templates.newModal.sessionsLabel` — Sesiones
- `templates.newModal.sessionsUnit` — sesiones
- `editor.weeksQuestion` — ¿Cuántas semanas dura esta etapa?
- `editor.stageWeeksUnit` — Semanas
- `templates.newModal.noLimitLabel` — Sin límite de semanas
- `editor.weeksNoLimit` — Sin límite — la etapa dura hasta que añadas la siguiente
- `templates.newModal.createBtn` — CREAR Y EDITAR
- `templates.assignModal.title` — Asignar a cliente
- ★ `templates.assignModal.desc` — Se creará una copia del programa para el cliente seleccionado. La plantilla original no se modifica.
- ★ `templates.assignModal.noClients` — Sin clientes todavía. ⏎ Crea un cliente primero desde el tab Clientes.
- `freePlan.outOfPlan` — Fuera de plan
- `templates.assignModal.replaces` — Reemplaza: {{name}}
- `templates.assignModal.noProgram` — Sin programa
- `templates.assignModal.programNameLabel` — Nombre del programa
- `freeSession.templateUnnamed` — Sesión libre
- ★ `templates.assignSession.desc` — Se le crea una copia: lo que cambies después en la plantilla no le llega.
- `templates.assignSession.me` — Tú
- `templates.assignSession.meSub` — Se añade una copia a tus sesiones libres.
- ★ `templates.assignSession.noProgram` — Necesita tener un programa asignado para recibir sesiones libres.
- `templates.assignSession.btnMany` — Asignar a {{count}}
- `templates.deleteTitle` — Eliminar plantilla
- `templates.deleteConfirm` — ¿Eliminar esta plantilla?
- `common.delete` — Eliminar
- `templates.statMinutes` — min
- `templates.toastCreated` — Plantilla creada
- `templates.copyNameSuffix` —  (copia)
- `templates.toastDuplicated` — Plantilla duplicada
- `templates.toastAssigned` — Asignado, abriendo editor
- `templates.toastDeleted` — Plantilla eliminada
- `templates.title` — Plantillas
- `templates.newBtn` — + Plantilla
- `templates.segPrograms` — Programas
- `templates.segSessions` — Sesiones
- ★ `templates.sessionsEmpty` — Sin plantillas de sesión todavía. ⏎ Crea sesiones sueltas —movilidad, un circuito, una clase— y asígnalas a tus clientes.
- ★ `templates.empty` — Sin plantillas todavía. ⏎ Crea plantillas para asignarlas ⏎ rápidamente a tus clientes.
- `templates.actionView` — Ver plantilla
- `templates.actionEdit` — Editar
- `templates.contextDuplicate` — Duplicar
- `templates.actionShare` — Compartir
- `templates.contextExport` — Exportar archivo
- `templates.contextDelete` — Eliminar
- ★ `freeSession.deleteActive` — Es la sesión que estás haciendo: termínala o descártala antes de borrarla.
- `templates.assignSession.meToast` — ti
- `templates.assignSession.toast` — Sesión asignada a {{name}}
- `templates.assignSession.toastMany` — Sesión asignada a {{count}} clientes

## screens/SessionEditorScreen.jsx

Aparece en: SessionEditor

- `common.keyExercise` — Principal
- `editor.volumeRest` — {{count}} de {{pattern}}
- `editor.volumeLine` — Volumen: {{parts}}
- `editor.rowSubstitute` — Sustituir
- `editor.rowDelete` — Eliminar
- `editor.metaLinked` — Vinculado {{sessions}}
- `editor.toastExDeleted` — Ejercicio eliminado
- `editor.sessionEyebrow` — Editar sesión {{label}}
- `blocks.deleteBlock` — Eliminar bloque
- `blocks.deleteConfirm` — ¿Eliminar "{{name}}"?
- `common.cancel` — Cancelar
- `editor.sessionDeleteBtn` — Eliminar sesión
- `editor.sessionDeleteConfirm` — Se borra «{{name}}» del programa.
- `freeSession.delete` — Eliminar sesión libre
- ★ `freeSession.deleteActive` — Es la sesión que estás haciendo: termínala o descártala antes de borrarla.
- ★ `freeSession.deleteConfirm` — Se borra «{{name}}». Las veces que la hiciste siguen en el historial.
- `freeSession.templateUnnamed` — Sesión libre
- `templates.sessionEyebrow` — Plantilla de sesión
- `freeSession.badge` — Sesión libre
- `editor.summarySession` — RESUMEN DE LA SESIÓN {{label}}
- `editor.sessionMeta` — {{ex}} ejercicios · {{sets}} series · ~{{min}} min
- `editor.sessionMetaNoTime` — {{ex}} ejercicios · {{sets}} series
- `editor.sectionExercises` — Ejercicios · {{n}}
- `editor.addLabel` — Añadir ejercicio
- `editor.addSheetTitle` — Añadir
- `editor.addExerciseOption` — Ejercicio
- `editor.addBlockOption` — Bloque de acondicionamiento
- `editor.addPresetOption` — Bloque desde preset
- `editor.sessionMenuTitle` — Opciones de sesión
- `editor.renameOption` — Editar nombre
- `sessionText.menu` — Compartir como texto
- `editor.sessionDuplicateBtn` — Duplicar sesión
- `editor.toastSessionDuplicated` — Sesión duplicada
- `blocks.fromPreset` — Desde preset
- `blocks.deletePreset` — Eliminar preset
- `exerciseSelector.patterns.vertical_pull` — Tracción vertical
- `exerciseSelector.patterns.horizontal_pull` — Tracción horizontal
- `exerciseSelector.patterns.vertical_push` — Empuje vertical
- `exerciseSelector.patterns.horizontal_push` — Empuje horizontal
- `exerciseSelector.patterns.squat` — Pierna (rodilla)
- `exerciseSelector.patterns.hip_hinge` — Pierna (cadera)
- `exerciseSelector.patterns.core` — Core
- `exerciseSelector.patterns.carry_grip` — Agarre / Carga
- `exerciseSelector.patterns.calf_raise` — Gemelos
- `blocks.formats.amrap` — AMRAP
- `blocks.formats.emom` — EMOM
- `blocks.formats.for_time` — For time

## screens/SessionRecapScreen.jsx

Aparece en: SessionRecap

- `recap.newExercise` — nuevo
- `recap.repsShort` — rep
- `recap.setsShort` — serie
- `blocks.delta.roundsShort` — ronda
- `blocks.delta.repsShort` — rep
- `blocks.delta.completedShort` — ronda
- `recap.topWeight` — Peso máx
- `recap.bestSet` — Mejor serie
- `recap.previous` — anterior
- `recap.repsValue` — {{count}} reps
- `recap.completed` — SESIÓN COMPLETADA
- `recap.duration` — Duración
- `recap.volume` — Volumen
- `recap.sets` — Series
- `recap.form` — Formulario
- `recap.rpeQuestion` — ¿Cómo de dura fue la sesión?
- `recap.rpeLow` — Suave
- `recap.rpeMid` — Dura
- `recap.rpeHigh` — Máxima
- `recap.sessionLoad` — Carga de la sesión
- `recap.vsMean7d` — vs media 7d
- `recap.bodyWeight` — Peso corporal
- `recap.note` — Nota de la sesión
- `recap.noteEmpty` — Sin nota
- `recap.notePlaceholder` — Cómo te has sentido, molestias, algo para la próxima…
- `recap.vsLast` — Vs. última sesión
- `blocks.recapSection` — Bloques
- `recap.freeTitle` — Esta sesión libre
- `recap.countsAsTitle` — Cuenta para el programa
- `recap.countsAsNone` — No
- ★ `recap.countsAsHint` — Cuenta como la Sesión {{label}}: avanza la semana y la etapa.
- `freeSession.exercisesAdded` — Añadidos a la sesión
- `recap.addExercisesSub` — Los que añadiste durante el entreno
- `freeSession.saved` — Guardada en tus sesiones libres
- `freeSession.saveAsFree` — Guardar como sesión libre
- `recap.saveAsFreeSub` — Para repetirla desde Inicio
- `recap.missing` — Falta:
- `recap.missingRpe` — cómo de dura fue
- `recap.done` — HECHO
- `blocks.formats.amrap` — AMRAP
- `blocks.formats.emom` — EMOM
- `blocks.formats.for_time` — For time

## screens/StagePlannerScreen.jsx

Aparece en: StagePlanner

- `editor.weeksOpen` — Sin límite
- ★ `planner.stageVolume` — {{sessions}} sesiones · {{exercises}} ejercicios · {{sets}} series
- `planner.createdWith` — Creada con {{parts}}
- `editor.stageNameLabel` — Nombre
- `planner.stagePlaceholder` — Nombre de la etapa
- `editor.stageWeeksUnit` — Semanas
- `editor.stageDuplicateBtn` — Duplicar etapa
- `editor.stageDeleteBtn` — Eliminar etapa
- `planner.noChanges` — sin cambios
- `planner.fields.scope` — Aplicar a
- `planner.deloadFixedLine` — Sin progresión mientras dure
- `planner.removeRung` — Quitar esta etapa
- `planner.rungs.deload` — Descarga
- `planner.toastAdded` — +{{count}} etapas
- `editor.copySuffix` — (copia)
- `editor.toastStageDuplicated` — Etapa duplicada
- `planner.deleteTitle` — Eliminar etapa
- `planner.deleteBody` — Se perderán las sesiones de «{{name}}».
- `common.cancel` — Cancelar
- `common.delete` — Eliminar
- `planner.eyebrow` — Plan del programa
- `planner.summaryTag` — AHORA MISMO
- `planner.summaryOpen` — {{stages}} etapas · {{weeks}}+ semanas
- `planner.summary` — {{stages}} etapas · {{weeks}} semanas
- `planner.summaryPerWeek` — {{count}} entrenos por semana
- `planner.sectionStages` — Ya en el programa
- `planner.addSlot` — + Añadir etapas aquí
- `planner.addStagesTitle` — Añadir etapas
- `planner.fromStage` — Parte de la etapa
- ★ `planner.fromStageHint` — De ella se copian las sesiones. Las etapas nuevas van al final del plan, elijas la que elijas.
- `planner.startWith` — Empezar con
- `planner.startWithHint` — O monta la lista a mano con los botones de abajo.
- `planner.stagesToAdd` — Las etapas que se añaden
- `planner.addWork` — + trabajo
- `planner.addDeload` — + descarga
- `planner.unlock` — Desbloquear
- `planner.lock` — Bloquear
- `planner.scopes.all` — Todo
- `planner.scopes.keys` — Básicos
- `planner.scopes.accessories` — Accesorios
- `planner.rungNames.linear` — Acumulación {{n}}
- `planner.rungNames.intensification` — Intensificación {{n}}
- `planner.rungNames.volume` — Volumen {{n}}
- `planner.rungNames.blank` — Etapa {{n}}
- `planner.ladders.linear` — Volumen total
- `planner.ladders.intensification` — Intensidad
- `planner.ladders.volume` — Accesorios
- ★ `planner.ladderDesc.linear` — Sube series en todos los ejercicios de la etapa para aumentar el volumen de trabajo.
- ★ `planner.ladderDesc.intensification` — Baja el rango de repeticiones de los ejercicios principales y alarga el descanso.
- ★ `planner.ladderDesc.volume` — Sube series solo en los accesorios; los ejercicios principales no se tocan.

## screens/TrainerConnectionScreen.jsx

Aparece en: TrainerConnection

- `dayCard.today` — Hoy
- `dayCard.yesterday` — Ayer
- `trainer.offTitle` — No estás conectado
- `trainer.unnamedTrainer` — Tu entrenador
- ★ `trainer.offSub` — Si entrenas por tu cuenta no necesitas esto. Conéctate solo si un entrenador te prepara los programas.
- ★ `trainer.pendingSub` — Tu última sesión aún no le ha llegado. Se reintenta al abrir la app, o puedes reintentarlo ahora.
- ★ `trainer.connectedSub` — Te envía los programas y ve las sesiones que completas de ellos.
- `header.toastSynced` — Historial sincronizado
- `header.toastSyncFailed` — No se pudo sincronizar
- `trainer.disconnectTitle` — Desconectarte de tu entrenador
- ★ `trainer.disconnectBody` — Dejarás de enviarle tus sesiones. Su programa se archivará y se restaurará el que tenías antes, si tenías uno. Podrás volver a conectarte con el mismo código.
- `common.cancel` — Cancelar
- `trainer.disconnectConfirm` — Desconectarme
- `header.sectionConnections` — CONEXIONES
- `trainer.title` — Entrenador
- `trainer.sectionDetails` — DETALLES
- `trainer.rowProgram` — Programa que te envió
- ★ `trainer.rowProgramSub` — Si lo actualiza, la app te avisa y decides tú cuándo cambiarlo.
- `trainer.rowProgramNoneSub` — Todavía no te ha enviado ningún programa.
- `trainer.rowProgramNone` — Ninguno
- `trainer.rowLastUpload` — Último envío de tu historial
- `trainer.rowLastUploadFailed` — Falló el {{when}}. Se reintentará automáticamente.
- `trainer.rowLastUploadSub` — Se envía solo, al terminar cada sesión.
- `trainer.never` — Aún ninguno
- `trainer.rowAccessCode` — Entras con un código
- ★ `trainer.rowAccessGoogleSub` — Puedes recuperar la conexión en otro móvil sin pedirle nada a tu entrenador.
- ★ `trainer.rowAccessCodeSub` — El código no caduca ni cambia: es siempre el mismo. Guárdalo para volver a entrar si cambias de móvil o reinstalas la app.
- `trainer.sectionPrivacy` — QUÉ VE TU ENTRENADOR
- `trainer.sharedTitle` — Sí ve
- ★ `trainer.sharedBody` — Las sesiones que completas de los programas que él te envía, y las sesiones libres que hagas desde que os conectasteis.
- `trainer.notSharedTitle` — No ve
- ★ `trainer.notSharedBody` — Los programas que te hayas creado tú, ni nada de lo que entrenaste antes de conectaros.
- `trainer.sectionActions` — ACCIONES
- `trainer.retryingLabel` — Enviando…
- `trainer.retryLabel` — Reintentar el envío
- `trainer.retrySub` — Intenta mandarle tu historial ahora mismo.
- ★ `trainer.linkGoogleSub` — Para no depender del código si cambias de móvil o reinstalas la app.
- `trainer.changeLabel` — Cambiar de entrenador
- ★ `trainer.changeSub` — Te pedirá el código del nuevo. El programa actual se archiva y recibirás el suyo.
- `trainer.disconnectLabel` — Desconectarme
- ★ `trainer.disconnectSub` — Dejas de enviarle sesiones. Su programa se archiva y se restaura el que tenías antes. Para volver, el mismo código.
- `trainer.sectionHow` — CÓMO FUNCIONA
- `trainer.how1Title` — Él escribe tu programa
- ★ `trainer.how1Sub` — Te llega a la app y entrenas con él igual que con cualquier otro.
- `trainer.how2Title` — Tus sesiones le llegan solas
- ★ `trainer.how2Sub` — Al terminar cada sesión se le envía el registro para que vea cómo vas.
- `trainer.how3Title` — Hace falta su código
- ★ `trainer.how3Sub` — Ocho caracteres tipo XK7M-2P4T que te da tu entrenador. Es siempre el mismo, así que guárdalo: lo necesitarás si reinstalas la app.
- `trainer.connectCta` — CONECTAR CON UN CÓDIGO
- ★ `trainer.socialCtaHint` — Solo si ya estuviste conectado y vinculaste una cuenta: recupera la conexión sin tener que escribir el código otra vez.
- `trainer.rowAccessApple` — Entras con tu cuenta de Apple
- `trainer.rowAccessGoogle` — Entras con tu cuenta de Google
- `trainer.linkAccountLabel` — Vincular una cuenta
- `trainer.linkGoogleLabel` — Vincular mi cuenta de Google
- `trainer.socialCta` — RECONECTAR CON MI CUENTA
- `trainer.googleCta` — RECONECTAR CON GOOGLE
- `trainer.tagConnected` — CONECTADO
- `trainer.tagPending` — FALTA ENVIAR
- `trainer.tagOff` — SIN ENTRENADOR

## screens/WorkoutScreen.jsx

Aparece en: Workout

- `restTimer.skip` — Saltar ›
- `freeSession.badge` — Sesión libre
- `workout.sessionLabel` — Sesión {{label}}
- `freeSession.templateUnnamed` — Sesión libre
- `workout.noActiveSession` — Sin sesión activa
- `freeSession.namePlaceholder` — Nombre (opcional)
- ★ `freeSession.infoText` — Sesión puntual — queda guardada en tu historial ligada al programa activo, pero no modifica el progreso ni el contador de semanas.
- `editor.addSheetTitle` — Añadir
- `workout.addExercise` — Añadir ejercicio
- `workout.saveSession` — GUARDAR SESIÓN
- `workout.discardSession` — Descartar sesión
- `workout.sessionNotes` — NOTAS DE SESIÓN
- ★ `workout.notesPlaceholder` — Anota cómo fue el entreno, sensaciones, ajustes para la próxima vez...
- `workout.notesSavedWith` — Se guarda con la sesión al pulsar GUARDAR SESIÓN.
- `editor.addExerciseOption` — Ejercicio
- `editor.addBlockOption` — Bloque de acondicionamiento

## services/timerNotification.js

Aparece en: —

- `restTimer.notifChannelRest` — Temporizador de descanso
- `restTimer.notifChannelDone` — Fin de descanso
- `restTimer.notifResting` — Descansando…
- `restTimer.notifDoneTitle` — ¡A por la siguiente serie!
- `restTimer.notifDoneBodyNamed` — {{name}} — descansaste bien
- `restTimer.notifDoneBody` — ¡Descanso terminado!

## utils/activeSession.js

Aparece en: Clients, Home, PasteWorkout

- `freeSession.templateUnnamed` — Sesión libre
- `home.runningMeta` — {{done}} de {{total}} ejercicios

## utils/adaptationDiff.js

Aparece en: Onboarding

- `onboarding.adaptationPanel.reasonTime` — {{minutes}} MIN
- `onboarding.adaptationPanel.reasonLevelCut` — TU NIVEL
- `onboarding.adaptationPanel.reasonAdded` — AÑADIDO · TU NIVEL
- `onboarding.adaptationPanel.gapTag` — TU MATERIAL NO LLEGA
- ★ `onboarding.preview.overBudget` — Volumen de {{group}} por encima de lo recomendado para tu nivel.
- `onboarding.adaptationPanel.reasonMaterial` — MATERIAL
- `onboarding.adaptationPanel.reasonLevel` — NIVEL
- `onboarding.adaptationPanel.reasonShoulder` — HOMBRO
- `onboarding.adaptationPanel.reasonLowerBack` — LUMBAR
- `onboarding.adaptationPanel.reasonKnee` — RODILLA
- `exerciseSelector.groups.chest` — Pecho
- `exerciseSelector.groups.back` — Espalda
- `exerciseSelector.groups.shoulders` — Hombro
- `exerciseSelector.groups.arms` — Brazos
- `exerciseSelector.groups.biceps` — Bíceps
- `exerciseSelector.groups.triceps` — Tríceps
- `exerciseSelector.groups.quads` — Cuádriceps
- `exerciseSelector.groups.glutes_hamstrings` — Glúteo e isquios
- `exerciseSelector.groups.legs_lower` — Gemelos
- `exerciseSelector.groups.core` — Core
- `exerciseSelector.groups.grip` — Agarre

## utils/conditioningBlocks.js

Aparece en: BlockEditor, Clients, CustomExercise, Docs, ExerciseEditor, Home, MyProgram, NextSession, PasteWorkout, ProgramDetail, ProgramEditor, Program, SessionEditor, SessionRecap, StagePlanner, Stats, Workout

- `blocks.cappedTag` — (cap)

## utils/exerciseIdentity.js

Aparece en: ExerciseEditor

- `variants.nameUnilateral` — {{name}} unilateral
- `variants.nameApart` — {{name}} · {{variant}}

## utils/formatWhen.js

Aparece en: Clients, DriveBackup, Home, MyProgram, Program, Stats, TrainerConnection

- `dayCard.today` — Hoy
- `dayCard.yesterday` — Ayer

## utils/importFile.js

Aparece en: Clients, Home, MyProgram, Onboarding, Program, Stats

- `errors.importNoVersion` — El archivo no tiene campo "version".
- `errors.importBadVersion` — Versión {{version}} no compatible.
- `errors.importBadJson` — El archivo no es un JSON válido.

## utils/lastSeen.js

Aparece en: Clients

- `clients.lastNever` — Nunca
- `dayCard.today` — Hoy
- `dayCard.yesterday` — Ayer
- `clients.lastSeenDays` — hace {{count}} d

## utils/pickImportFile.js

Aparece en: Clients, MyProgram

- `errors.invalidFile` — Archivo no válido
- `common.error` — Error
- `errors.cannotReadFile` — No se pudo leer el archivo

## utils/prescription.js

Aparece en: Clients, Home, NextSession, PasteWorkout, SessionEditor, Workout

- `workout.effortFailure` — RPE 10 (al fallo)
- `workout.perSide` — c/p

## utils/progression.js

Aparece en: Clients, CustomExercise, ExerciseEditor, Home, NextSession, PasteWorkout, ProgramDetail, ProgramEditor, SessionEditor, StagePlanner, Workout

- `progression.why_partHit` — {{hit}} de {{n}} series llegaron a {{goal}}
- ★ `progression.why_rpeAbove` — Llegaste a la meta, pero con un RPE medio por encima de {{maxRpe}}
- ★ `progression.time_allHitMax` — Todas las series por encima del mínimo. Apunta a {{next}} s en todas la próxima vez.
- `progression.why_timeAllHit` — Tu serie más floja fue de {{n}} s
- `progression.time_keep` — Sigue trabajando en el rango {{min}}–{{max}}s. Sin prisa.
- ★ `progression.reps_advance` — Todas las series por encima del mínimo. Apunta a {{next}} reps en todas la próxima vez.
- `progression.why_repsUp` — Tu serie más floja fue de {{n}} reps
- `progression.reps_hold` — Llega al mínimo de reps en todas las series antes de subir.
- `progression.withWeight` — {{kg}}kg
- `progression.sameWeight` — el mismo peso
- ★ `progression.normal_allHit` — Todas las series al máximo. Sube a {{next}}kg la próxima vez.
- `progression.normal_hold` — Sigue con {{weightStr}} y foco en la técnica.
- `progression.effort_noWeight` — Elige un peso con el que llegues al RPE objetivo
- `progression.why_effortReached` — Clavaste el objetivo y llegaste a todas las reps
- `progression.withAssist` — {{kg}}kg de asistencia
- `progression.noAssist` — sin asistencia
- ★ `progression.decrease_lastAssist` — ¡Excelente! Todas las series al máximo con {{assist}}kg de asistencia. La próxima vez intenta sin asistencia.
- ★ `progression.decrease_allHit` — Todas las series al máximo. Reduce la asistencia a {{next}}kg la próxima vez.
- ★ `progression.decrease_free` — ¡Todas las series sin asistencia! Es hora de pasar a la versión lastrada.
- `progression.decrease_struggling` — No llegaste al mínimo. Aumenta la asistencia a {{next}}kg.
- `progression.decrease_hold` — Sigue con {{assistStr}} y foco en la técnica.
- ★ `progression.deload_hold` — Semana de descarga: mantén {{weightStr}} y deja 3-4 reps en recámara.
- `progression.why_deload` — Esta semana toca descarga
- `progression.rule.none` — El peso lo cambias tú
- `progression.rule.effortShort` — {{reps}} reps a RPE {{rpe}}
- `progression.rule.effortAction` — Peso para {{reps}} reps a RPE {{rpe}}
- `progression.rule.whenPart` — {{need}} de {{n}} series
- `progression.rule.whenRpe` — todas las series con RPE ≤ {{rpe}}
- `progression.rule.whenAll` — todas las series
- `progression.rule.weakestShort` — +{{inc}} sobre la serie más floja
- `progression.rule.whenGoal` — cuando {{when}} lleguen a {{goal}}
- `progression.why_allHitTime` — Aguantaste el tiempo máximo en todas las series
- `progression.why_allHit` — Completaste todas las reps en todas las series
- `progression.why_timeHold` — Alguna serie no llegó a {{min}} s
- `progression.why_repsHold` — Alguna serie no llegó a {{min}} reps
- `progression.why_effortNoRpe` — No apuntaste el RPE, así que el peso se queda igual
- `progression.why_effortUnreliable` — Con tantas reps objetivo, el peso no se puede calcular
- `progression.rule.effortWhenReach` — Sube cuando llegas al objetivo
- `progression.rule.effortWhenBeat` — Sube cuando superas el objetivo
- ★ `progression.rule.effortReach` — Peso calculado para {{reps}} reps a RPE {{rpe}} · sube al llegar al objetivo
- ★ `progression.rule.effortBeat` — Peso calculado para {{reps}} reps a RPE {{rpe}} · sube al superar el objetivo
- `progression.rule.whenTime` — cuando {{when}} pasen de {{floor}} s
- `progression.rule.whenReps` — cuando {{when}} pasen de {{floor}} reps
- ★ `progression.rule.timeUp` — +{{inc}} sobre tu serie más floja cuando {{when}} pasen de {{floor}} s
- ★ `progression.rule.repsUp` — +{{inc}} sobre tu serie más floja cuando {{when}} pasen de {{floor}}
- `progression.rule.assistShort` — −{{inc}} al llegar a {{goal}}
- `progression.rule.weightShort` — +{{inc}} al llegar a {{goal}}
- `progression.rule.assistAction` — Quita {{inc}} de ayuda
- `progression.rule.weightAction` — Sube {{inc}}
- `progression.rule.assistDownLine` — Más ayuda si fallan {{fails}} de {{n}} series
- `progression.rule.weightDownLine` — Baja si fallan {{fails}} de {{n}} series
- `progression.rule.assistUp` — Quita {{inc}} cuando {{when}} lleguen a {{goal}}
- `progression.rule.weightUp` — Sube {{inc}} cuando {{when}} lleguen a {{goal}}
- `progression.rule.assistDown` —  · más ayuda si fallan {{fails}} de {{n}}
- `progression.rule.weightDown` —  · baja si fallan {{fails}} de {{n}}
- ★ `progression.normal_struggling` — No llegaste al mínimo de reps. Prueba con {{next}}kg para consolidar técnica.
- ★ `progression.normal_strugglingTime` — No llegaste al tiempo mínimo. Prueba con {{next}}kg para consolidar técnica.
- `progression.why_belowMin` — No llegaste al mínimo de reps
- `progression.why_belowMinTime` — No llegaste al tiempo mínimo
- `progression.why_effortEasier` — Rendiste por encima del objetivo
- `progression.why_effortHarder` — Rendiste por debajo del objetivo
- `progression.why_effortOnTarget` — Clavaste el objetivo
- `progression.why_holdReps` — Alguna serie se quedó sin completar
- `progression.why_holdTime` — Alguna serie no llegó al tiempo máximo
- `progression.rule.incReps_one` — {{count}} rep
- `progression.rule.incReps_other` — {{count}} reps

## utils/sessionPlan.js

Aparece en: Clients, Home, NextSession, PasteWorkout

- `home.sessionNext` — Mi entreno de hoy
- `home.weekCount` — {{done}} de {{total}} esta semana

## utils/sessionRowText.js

Aparece en: Clients, Home, PasteWorkout

- `dayCard.today` — Hoy
- `dayCard.yesterday` — Ayer
- `dayCard.daysAgo` — Hace {{count}} días
- `dayCard.oneWeekAgo` — Hace 1 semana
- `dayCard.weeksAgo` — Hace {{count}} semanas
- `home.btnContinueSession` — CONTINUAR SESIÓN {{label}}
- `home.btnContinue` — CONTINUAR
- `home.btnRepeatSession` — REPETIR SESIÓN {{label}}
- `home.btnRepeat` — REPETIR
- `home.btnStartSession` — EMPEZAR SESIÓN {{label}}
- `home.btnStart` — EMPEZAR

## utils/sessionText.js

Aparece en: Clients, PasteWorkout, SessionEditor

- `workout.perSide` — c/p
- `workout.sessionLabel` — Sesión {{label}}
- ★ `sessionText.howTo` — Escribe detrás de cada «:» lo que hiciste: «ok» si salió como está, o el peso x reps de cada serie (100x6 100x6 95x5). Deja vacío lo que no hiciste.
- `blocks.formats.amrap` — AMRAP
- `blocks.formats.emom` — EMOM
- `blocks.formats.for_time` — For time
- `blocks.units.reps` — reps
- `blocks.units.cal` — cal
- `blocks.units.m` — m
- `blocks.units.sec` — seg

## utils/stageProgress.js

Aparece en: Clients, Home, MyProgram, NextSession, Onboarding, PasteWorkout, ProgramEditor, Program, SessionRecap, StagePlanner, Stats

- `programCard.stageNotStarted` — Sin empezar
- `programCard.stageWeekOpen` — Semana {{week}}
- `programCard.stageWeekExtra` — Semana {{week}} de {{total}} (+{{extra}})
- `programCard.stageWeek` — Semana {{week}} de {{total}}
- `programCard.stageSessions` — {{done}} de {{expected}} sesiones

## utils/stageRx.js

Aparece en: ProgramEditor, StagePlanner

- `planner.rxParts.incrementHalf` — incremento a la mitad
- `planner.rxParts.deload` — sin progresión
- `planner.rxParts.setsUp` — +{{n}} serie
- `planner.rxParts.setsDown` — −{{n}} serie
- `planner.rxParts.setsUp_keys` — +{{n}} serie en básicos
- `planner.rxParts.setsDown_keys` — −{{n}} serie en básicos
- `planner.rxParts.setsUp_accessories` — +{{n}} serie en accesorios
- `planner.rxParts.setsDown_accessories` — −{{n}} serie en accesorios
- `planner.rxParts.repsUp` — +{{n}} reps
- `planner.rxParts.repsDown` — −{{n}} reps
- `planner.rxParts.repsUp_keys` — +{{n}} reps en básicos
- `planner.rxParts.repsDown_keys` — −{{n}} reps en básicos
- `planner.rxParts.repsUp_accessories` — +{{n}} reps en accesorios
- `planner.rxParts.repsDown_accessories` — −{{n}} reps en accesorios
- `planner.rxParts.restUp` — +{{n}}% descanso
- `planner.rxParts.restDown` — −{{n}}% descanso

## utils/startNewProgram.js

Aparece en: Clients, Home, MyProgram, Program, Stats

- `header.newProgramWarnTitle` — Crear nuevo programa
- ★ `header.newProgramWarnBody` — Al crear un programa nuevo te desconectarás de tu entrenador y el programa actual será reemplazado.
- `common.cancel` — Cancelar
- `common.continue` — Continuar

## utils/variants.js

Aparece en: Clients, CustomExercise, ExerciseEditor, Home, Onboarding, PasteWorkout, ProgramDetail, SessionEditor, SessionRecap, Stats, Workout

- `variants.options.grip.pronated` — Prono
- `variants.options.grip.supinated` — Supino
- `variants.options.grip.neutral` — Neutro
- `variants.options.width.wide` — Ancho
- `variants.options.width.medium` — Medio
- `variants.options.width.narrow` — Estrecho

## Claves sin uso literal (dinámicas o muertas)

`common.back` · `common.next` · `common.export` · `common.import` · `common.merge` · `common.replace` · `common.sessions` · `common.session_one` · `common.session_other` · `common.exercises_one` · `common.exercises_other` · `common.clients_one` · `common.clients_other` · `common.day` · `header.newProgram` · `header.archivedPrograms` · `header.exportSection` · `header.fullBackup` · `header.programAndHistory` · `header.importSection` · `header.developer` · `docs.sections.0.id` · `docs.sections.0.title` · `docs.sections.0.points.0` · `docs.sections.0.points.1` · `docs.sections.0.points.2` · `docs.sections.1.id` · `docs.sections.1.title` · `docs.sections.1.points.0` · `docs.sections.1.points.1` · `docs.sections.1.points.2` · `docs.sections.1.points.3` · `docs.sections.2.id` · `docs.sections.2.title` · `docs.sections.2.points.0` · `docs.sections.2.points.1` · `docs.sections.2.points.2` · `docs.sections.2.points.3` · `docs.sections.3.id` · `docs.sections.3.title` · `docs.sections.3.points.0` · `docs.sections.3.points.1` · `docs.sections.3.points.2` · `docs.sections.3.points.3` · `docs.sections.3.points.4` · `docs.sections.4.id` · `docs.sections.4.title` · `docs.sections.4.points.0` · `docs.sections.4.points.1` · `docs.sections.4.points.2` · `docs.sections.5.id` · `docs.sections.5.title` · `docs.sections.5.points.0` · `docs.sections.5.points.1` · `docs.sections.5.points.2` · `docs.sections.5.points.3` · `docs.sections.6.id` · `docs.sections.6.title` · `docs.sections.6.points.0` · `docs.sections.6.points.1` · `docs.sections.7.id` · `docs.sections.7.title` · `docs.sections.7.points.0` · `docs.sections.7.points.1` · `docs.sections.7.points.2` · `docs.sections.8.id` · `docs.sections.8.title` · `docs.sections.8.points.0` · `docs.sections.8.points.1` · `docs.sections.8.points.2` · `docs.sections.8.points.3` · `docs.sections.9.id` · `docs.sections.9.title` · `docs.sections.9.points.0` · `docs.sections.9.points.1` · `docs.sections.9.points.2` · `docs.sections.10.id` · `docs.sections.10.title` · `docs.sections.10.points.0` · `docs.sections.10.points.1` · `docs.sections.11.id` · `docs.sections.11.title` · `docs.sections.11.points.0` · `docs.sections.11.points.1` · `home.activeProgram` · `home.selectSession` · `home.program` · `home.weekDayLetters.0` · `home.weekDayLetters.1` · `home.weekDayLetters.2` · `home.weekDayLetters.3` · `home.weekDayLetters.4` · `home.weekDayLetters.5` · `home.weekDayLetters.6` · `home.stageWeeks_one` · `home.stageWeeks_other` · `home.stageSessionsPerWeek_one` · `home.stageSessionsPerWeek_other` · `home.stageProgress` · `home.stageCount` · `home.activeStage` · `home.stageBehindText_one` · `home.stageBehindText_other` · `home.extendWeeks_one` · `home.extendWeeks_other` · `home.close` · `home.sessionActiveNow` · `home.lastTime` · `home.view` · `home.nextWorkout` · `home.rowDone` · `home.startOutOfOrderTitle` · `workout.addedThisSession` · `workout.sessionSaved` · `workout.addedLabel` · `workout.addSet` · `workout.effortTarget_one` · `workout.effortTarget_other` · `workout.exerciseLabel` · `workout.previous` · `workout.kg` · `workout.seconds` · `workout.assistance` · `workout.trainerCredit` · `workout.progressionReps_one` · `workout.progressionReps_other` · `freeSession.templateExercises_one` · `freeSession.templateExercises_other` · `freeSession.templateBlocks_one` · `freeSession.templateBlocks_other` · `freeSession.addExercises_one` · `freeSession.addExercises_other` · `blocks.sectionTitle` · `blocks.addBlock` · `blocks.newBlock` · `blocks.noCap` · `blocks.fail` · `blocks.thisInterval` · `blocks.intervalOf` · `blocks.remaining` · `blocks.toClose` · `blocks.lapsTip_one` · `blocks.lapsTip_other` · `blocks.lapsRest_one` · `blocks.lapsRest_other` · `blocks.scoreLine.amrap_one` · `blocks.scoreLine.amrap_other` · `blocks.scoreLine.amrapReps_one` · `blocks.scoreLine.amrapReps_other` · `blocks.scoreLine.emom_one` · `blocks.scoreLine.emom_other` · `blocks.scoreLine.forTime_one` · `blocks.scoreLine.forTime_other` · `blocks.meta.amrap_one` · `blocks.meta.amrap_other` · `blocks.meta.emom_one` · `blocks.meta.emom_other` · `blocks.meta.forTime_one` · `blocks.meta.forTime_other` · `blocks.summary.amrapMainCount_one` · `blocks.summary.amrapMainCount_other` · `blocks.summary.amrapSub_one` · `blocks.summary.amrapSub_other` · `blocks.summary.forTimeSub_one` · `blocks.summary.forTimeSub_other` · `history.title` · `history.stagesCount_one` · `history.stagesCount_other` · `history.noSessions` · `history.modifiedTag` · `archived.archivedOn` · `archived.deleteModal.title` · `archived.deleteModal.desc` · `archived.deleteModal.keepHistory` · `archived.deleteModal.keepHistoryDesc` · `archived.deleteModal.withHistory` · `archived.deleteModal.withHistoryDesc` · `freePlan.bannerTitle_one` · `freePlan.bannerTitle_other` · `paywall.frozenError` · `summary.ready` · `summary.daysReview` · `summary.sets` · `summary.customize` · `summary.start` · `summary.patternPull` · `summary.patternPush` · `summary.patternLegs` · `summary.patternCore` · `summary.patternGrip` · `summary.patternCalves` · `summary.patternAccessory` · `onboarding.adjustSheet.timeHintRemoved_one` · `onboarding.adjustSheet.timeHintRemoved_other` · `onboarding.adjustSheet.limitationsHint_one` · `onboarding.adjustSheet.limitationsHint_other` · `onboarding.adaptationPanel.gapText_one` · `onboarding.adaptationPanel.gapText_other` · `onboarding.appName` · `onboarding.stepIndicator` · `onboarding.proposals.eyebrow_one` · `onboarding.proposals.eyebrow_other` · `onboarding.proposals.phasesCount_one` · `onboarding.proposals.phasesCount_other` · `onboarding.proposals.subtitle` · `onboarding.proposals.seeProposals` · `onboarding.proposals.recommended` · `onboarding.proposals.another` · `onboarding.proposals.forWhat` · `onboarding.proposals.change` · `onboarding.stepLevel.subtitle` · `onboarding.stepDiscipline.title` · `onboarding.stepDiscipline.subtitle` · `onboarding.stepDistribution.title` · `onboarding.stepDistribution.subtitle` · `onboarding.stepDistribution.recommended` · `onboarding.stepDistribution.sevenDaysHint` · `onboarding.stepDays.subtitleUpperLower` · `onboarding.stepDays.titleFullBody` · `onboarding.stepDays.titleFrequency` · `onboarding.stepDays.daysCount` · `onboarding.stepDays.daysCount_other` · `onboarding.stepDays.allGroupsHint` · `onboarding.stepDays.moreVarietyHint` · `onboarding.stepTime.title` · `onboarding.stepTime.subtitle` · `onboarding.sessionTimes.30.label` · `onboarding.sessionTimes.30.description` · `onboarding.sessionTimes.45.label` · `onboarding.sessionTimes.45.description` · `onboarding.sessionTimes.60.label` · `onboarding.sessionTimes.60.description` · `onboarding.sessionTimes.90.label` · `onboarding.sessionTimes.90.description` · `onboarding.preview.adjustmentsRow_one` · `onboarding.preview.adjustmentsRow_other` · `onboarding.preview.ready` · `onboarding.preview.adaptedTitle` · `onboarding.preview.unresolved` · `onboarding.preview.overTime` · `onboarding.preview.minutesPerSession` · `onboarding.preview.adjustments` · `onboarding.preview.adjustments_other` · `onboarding.stepGoal.title` · `onboarding.stepGoal.subtitle` · `onboarding.stepEquipment.title` · `onboarding.stepEquipment.subtitle` · `onboarding.stepLimitations.title` · `onboarding.stepLimitations.subtitle` · `onboarding.stepProgression.title` · `onboarding.stepProgression.subtitle` · `onboarding.generateProgram` · `onboarding.disciplines.standard.label` · `onboarding.disciplines.standard.description` · `onboarding.disciplines.standard.detail` · `onboarding.disciplines.calisthenics.label` · `onboarding.disciplines.calisthenics.description` · `onboarding.disciplines.calisthenics.detail` · `onboarding.disciplines.glutes_legs.label` · `onboarding.disciplines.glutes_legs.description` · `onboarding.disciplines.glutes_legs.detail` · `onboarding.disciplines.strength.label` · `onboarding.disciplines.strength.description` · `onboarding.disciplines.strength.detail` · `onboarding.distributions.full_body.label` · `onboarding.distributions.full_body.description` · `onboarding.distributions.upper_lower.label` · `onboarding.distributions.upper_lower.description` · `onboarding.distributions.push_pull_legs.label` · `onboarding.distributions.push_pull_legs.description` · `onboarding.equipmentPresets.gym.label` · `onboarding.equipmentPresets.gym.description` · `onboarding.equipmentPresets.home.label` · `onboarding.equipmentPresets.home.description` · `onboarding.equipmentPresets.bodyweight.label` · `onboarding.equipmentPresets.bodyweight.description` · `onboarding.equipmentPresets.custom.label` · `onboarding.equipmentPresets.custom.description` · `onboarding.equipmentPresets.customize` · `onboarding.chips.limitationsCount_other` · `onboarding.progressionModels.double_progression.label` · `onboarding.progressionModels.double_progression.description` · `onboarding.progressionModels.linear.label` · `onboarding.progressionModels.linear.description` · `onboarding.progressionModels.reps_progression.label` · `onboarding.progressionModels.reps_progression.description` · `onboarding.disabledReasons.notForDiscipline` · `onboarding.disabledReasons.requiresIntermediate` · `onboarding.disabledReasons.requiresAdvanced` · `onboarding.upperLowerOptions.2sessions` · `onboarding.upperLowerOptions.4sessions` · `onboarding.pplSessions.push` · `onboarding.pplSessions.pull` · `onboarding.pplSessions.legs` · `dayCard.noRecords` · `dayCard.inProgress` · `stats.sessionsCount_one` · `stats.sessionsCount_other` · `stats.title` · `stats.selectedCount_one` · `stats.selectedCount_other` · `months.0` · `months.1` · `months.2` · `months.3` · `months.4` · `months.5` · `months.6` · `months.7` · `months.8` · `months.9` · `months.10` · `months.11` · `editor.stageWeeks` · `editor.stageActivate` · `editor.stageAddHint` · `editor.addSessionToStage` · `editor.convertToStages` · `editor.changesHint` · `editor.toastStageAdded` · `editor.deleteStageConfirm` · `editor.saveChanges` · `editor.save` · `editor.saved` · `editor.dayLabel` · `editor.exerciseCount_one` · `editor.exerciseCount_other` · `editor.edited` · `editor.setsRest` · `editor.close` · `editor.addExercise` · `editor.restore` · `editor.resetConfirm` · `editor.toastReset` · `editor.stagesLabel_one` · `editor.stagesLabel_other` · `editor.stagesLabelOpen_one` · `editor.stagesLabelOpen_other` · `editor.stageSessions_one` · `editor.stageSessions_other` · `editor.weeksShort_one` · `editor.weeksShort_other` · `editor.sectionSessions` · `editor.menuTitle` · `editor.metaProgAuto` · `editor.volumeFirst_one` · `editor.volumeFirst_other` · `editor.volumeBlocks_one` · `editor.volumeBlocks_other` · `editor.badges.auto` · `editor.badges.fixed` · `recap.prsCount_one` · `recap.prsCount_other` · `recap.morePrs_one` · `recap.morePrs_other` · `recap.exercisesCount_one` · `recap.exercisesCount_other` · `load.strain` · `load.vsBaseline` · `exerciseSelector.filters.see_one` · `exerciseSelector.filters.see_other` · `exerciseSelector.title` · `exerciseSelector.searchPlaceholder` · `exerciseSelector.tabSimilar` · `exerciseSelector.tabComplementary` · `exerciseSelector.tabPattern` · `exerciseSelector.tabMuscle` · `exerciseSelector.allPatterns` · `exerciseSelector.allMuscles` · `exerciseSelector.exerciseCount_one` · `exerciseSelector.exerciseCount_other` · `exerciseSelector.addedN_one` · `exerciseSelector.addedN_other` · `exerciseSelector.muscles.latissimus_dorsi` · `exerciseSelector.muscles.biceps` · `exerciseSelector.muscles.rear_deltoid` · `exerciseSelector.muscles.rhomboids` · `exerciseSelector.muscles.mid_trapezius` · `exerciseSelector.muscles.pectoralis` · `exerciseSelector.muscles.triceps` · `exerciseSelector.muscles.anterior_deltoid` · `exerciseSelector.muscles.deltoid` · `exerciseSelector.muscles.hamstrings` · `exerciseSelector.muscles.glutes` · `exerciseSelector.muscles.erector_spinae` · `exerciseSelector.muscles.quadriceps` · `exerciseSelector.muscles.rectus_abdominis` · `exerciseSelector.muscles.hip_flexors` · `exerciseSelector.muscles.forearms` · `exerciseSelector.muscles.serratus` · `exerciseEditor.progressionType` · `exerciseEditor.unilateralLabel` · `exerciseEditor.saveBtn` · `exerciseEditor.toastUpdated` · `exerciseEditor.sectionEvaluation` · `exerciseEditor.sectionIncrement` · `exerciseEditor.effortRir_one` · `exerciseEditor.effortRir_other` · `exerciseEditor.progressionModels.double_progression.label` · `exerciseEditor.progressionModels.double_progression.desc` · `exerciseEditor.progressionModels.time_progression.label` · `exerciseEditor.progressionModels.time_progression.desc` · `variants.howTitle` · `clients.title` · `clients.filterActive` · `clients.filterInactive` · `clients.filterAll` · `clients.noClients` · `clients.programCount_one` · `clients.programCount_other` · `clients.importBtn` · `clients.noPrograms` · `clients.activeLabel` · `clients.activeStarLabel` · `clients.activateStarLabel` · `clients.removeActiveTitle` · `clients.setActiveTitle` · `clients.toastDownloaded` · `clients.sessionFallback` · `clients.btnUploadChanges` · `clients.btnEditProgram` · `clients.btnAddProgram` · `clients.btnViewActivity` · `clients.btnViewProgress` · `clients.weekCompliance` · `clients.weekPace` · `clients.weekPaceNoData` · `clients.sessionsPerWeek` · `clients.noPaceShort` · `clients.thisWeek` · `clients.weekLabel` · `clients.unreviewedSessions_one` · `clients.unreviewedSessions_other` · `clients.btnProgramShort` · `clients.view` · `clients.edit` · `clients.upload` · `clients.assigned` · `clients.stagePos` · `clients.stageWeek` · `clients.lastSessionDate` · `clients.totalSessions` · `clients.noProgramsHint` · `clients.noActiveProgramHint` · `clients.refreshHistory` · `clients.refreshingHistory` · `clients.sortRecent` · `clients.sortRecentDesc` · `clients.sortOldAsc` · `clients.filterTagsCount_one` · `clients.filterTagsCount_other` · `clients.syncActive` · `clients.syncOff` · `clients.syncSetup` · `clients.syncModeCode` · `clients.syncModeManual` · `clients.nextSessionHint` · `clients.codeCard.title` · `clients.codeCard.explain` · `clients.codeCard.dismiss` · `clients.keyTab.title` · `clients.keyTab.subtitle` · `clients.keyTab.copy` · `clients.keyTab.noSlot` · `clients.keyTab.connect` · `clients.noProgressFilter` · `clients.contextExport` · `clients.contextDelete` · `clients.actionView` · `clients.actionEdit` · `clients.actionShare` · `clients.sessionsLastActivity` · `clients.sessionsOnly` · `clients.moveToApp.step2_one` · `clients.moveToApp.step2_other` · `clients.fieldFirstName` · `clients.billPaid` · `clients.info.connected` · `clients.info.notConnected` · `clients.globalBilling` · `clients.periodThisMonth` · `clients.periodLast3Months` · `clients.periodAll` · `clients.noBillingEntries` · `templates.badge` · `templates.contextUseWithClient` · `templates.statStages_one` · `templates.statStages_other` · `templates.statWeeks_one` · `templates.statWeeks_other` · `templates.statSessions_one` · `templates.statSessions_other` · `templates.statExercises_one` · `templates.statExercises_other` · `templates.statBlocks_one` · `templates.statBlocks_other` · `templates.assignModal.clientLabel` · `templates.assignModal.programNamePlaceholder` · `programView.editBtn` · `programView.diffAdded_one` · `programView.diffAdded_other` · `programView.diffRemoved_one` · `programView.diffRemoved_other` · `programView.diffReplaced_one` · `programView.diffReplaced_other` · `programView.diffBlocksAdded_one` · `programView.diffBlocksAdded_other` · `programView.diffBlocksRemoved_one` · `programView.diffBlocksRemoved_other` · `programView.diffReps_one` · `programView.diffReps_other` · `programView.sessionExercises_one` · `programView.sessionExercises_other` · `programView.warmupLine_one` · `programView.warmupLine_other` · `programView.supersetHead_one` · `programView.supersetHead_other` · `programView.blockRounds_one` · `programView.blockRounds_other` · `sessionText.rounds_one` · `sessionText.rounds_other` · `paste.trimmed_one` · `paste.trimmed_other` · `print.viewerTitle` · `print.exportPdf` · `print.trainingProgram` · `print.metaDays` · `print.metaStructure` · `print.metaTotalSets` · `print.metaDaysValue` · `print.metaSetsValue` · `print.legendKey` · `print.legendRest` · `print.legendWarmup` · `print.tableNum` · `print.tableExercise` · `print.tableSetsReps` · `print.tableRest` · `print.sessionLabel` · `print.perSide` · `restTimer.remaining` · `restTimer.go` · `planner.applyCount_one` · `planner.applyCount_other` · `planner.fields.setsDelta` · `planner.fields.setsDelta_keys` · `planner.fields.setsDelta_accessories` · `planner.fields.repsShift` · `planner.fields.repsShift_keys` · `planner.fields.repsShift_accessories` · `planner.fields.restPct`