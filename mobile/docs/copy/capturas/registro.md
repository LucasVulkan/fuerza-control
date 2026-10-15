# Registro de capturas

## Estado por fila (OK = captura hecha y revisada)
001 — OK (001-menu-arriba.png)
002 — OK (002-menu-abajo.png)
003 — OK (003-programas-archivados.png)
004 — OK (004-exportar.png)
005 — OK (005-importar-selector.png) — selector del sistema, cancelado con atrás
006 — OK (006-entrenador-vincular.png, 006b-vincular-google-previo.png, 006c-cambiar-entrenador.png, 006d-desconectar.png) — modales cancelados; «Continuar con Google» no pulsado
007 — OK (007-copia-drive.png) — pestaña «Copias» no capturada
008 — OK (008-sync-clientes.png) — cancelado
009 — OK (009a-unidades-idioma-tema.png, 009c-peso-corporal.png) — los selectores son filas en línea, no hojas
010 — OK (010-pestanas-interruptores.png)
011 — OK (011a-paywall.png) — plan puesto en FREE para capturar y devuelto a PRO. No se pulsó compra
012 — OK (012a…012y-documentacion.png) — documento completo, desplazado; duplicados eliminados
013 — OK (013-eliminar-cuenta.png) — cancelado
020 — OK (020-inicio-programa.png)
021 — OK (021-inicio-desplazado.png) — la pantalla no se desplaza: todo cabe
022 — OK (022-hoja-sesion-libre.png)
023 — OK (023-hoja-desde-plantillas.png)
024 — OK (024-banner-sesion-activa.png)
025 — PENDIENTE: requiere tener una sesión activa y empezar otra; no llegué a probarlo
026 — PENDIENTE: no probado (activar «Sesiones en pestañas» en el menú; no se hizo)
027 — ✎ solo texto
030 — OK (030a-workout-vacio.png) — la variante con primer ejercicio sale en 031a
031 — OK (031a-workout-ejercicio.png, 031b-serie-marcada-descanso.png) — al marcar la serie no apareció temporizador de descanso visible
032 — PENDIENTE: la regla se activa arrastrando horizontalmente sobre kg/reps; ui.sh no tiene gesto horizontal. Solo está 032-regla-deslizar.png sin la regla
033 — OK (033-notas-ejercicio.png)
034 — PENDIENTE: no encontrado el selector de variante desde el entreno
035 — PENDIENTE: no probado
036 — PENDIENTE: no hay superserie en los datos
037 — PENDIENTE: no hay bloque de condicionamiento en los datos
038 — PENDIENTE: depende de 037
039 — PENDIENTE: el entreno de prueba no llegó a guardarse (ver nota abajo)
040 — PENDIENTE: depende de 039
050 — OK (050-programa-arriba.png)
051 — PENDIENTE: no capturado (desplazar Programa)
052 — PENDIENTE: no capturado
053 — PENDIENTE: no capturado
054 — PENDIENTE: no capturado
055 — PENDIENTE: no capturado
056 — PENDIENTE: no capturado
060 — OK (060-editor-programa.png)
061 — PENDIENTE: no capturado
062 — PENDIENTE: no capturado
063 — PENDIENTE: no capturado
064 — OK (064-planificador-etapas.png)
065 — PENDIENTE: no capturado
066 — PENDIENTE: no capturado
067 — OK (067-selector-ejercicios.png)
068 — OK (068-selector-sin-resultados.png)
069 — PENDIENTE: no se encontró la pantalla de editor de ejercicio desde el entreno; sin explicaciones según la prioridad
070 — OK (070-hoja-progresion.png) — hoja de progresión del ejercicio personalizado
071 — PENDIENTE: no capturado
072 — OK (072-ejercicio-personalizado.png)
073 — PENDIENTE: no capturado
080 — OK (080-progresion-principal.png)
081 — OK (081-carga-calendario.png)
082 — OK parcial (082a-info-strain.png, 082b-info-evolucion-carga.png) — no se encontró ⓘ en otras métricas
083 — PENDIENTE: no capturado
084 — PENDIENTE: no capturado
085 — PENDIENTE: no capturado
090 — OK (090-clientes-panel.png)
091 — PENDIENTE: el plan es PRO; no probado en FREE
092 — PARCIAL: 092a-nuevo-cliente.png es el modal «Nuevo cliente». El modal de código NO se capturó porque requiere crear un cliente (no se creó)
093 — PENDIENTE: no capturado
094 — PENDIENTE: no capturado
095 — PENDIENTE: no capturado
096 — PENDIENTE: no capturado
100 — OK parcial (100a-onboarding-paso1.png, 100b-onboarding-paso2.png, 100c-onboarding-elegir.png, 100d, 100e, 100f) — no terminado, sin crear programa
101 — OK (101b-hoja-ajustes-sheet.png) — hoja de ajustes del onboarding; la pantalla de confirmación está en 101a-confirmacion-programa.png
102 — PENDIENTE: panel de adaptación no encontrado en los caminos probados

## Incidencia importante
Tras cerrar el onboarding con atrás, la app se cerró al salir a la pantalla de inicio del móvil y al volver a abrir Forma Fit los datos eran otros: el programa activo pasó de «Hipertrofia» (8 etapas, editor/planificador capturados) a «Lucas» (Etapa 1, semana 2 de 1), el entrenador aparece desconectado («Conectar»), la copia de Drive muestra «Última copia: 9 oct» y la sincronización con clientes dice «Con cuenta de Google». No he podido determinar la causa. Conviene revisar antes de seguir.
Nota: la sesión de prueba «Sesión D» con el ejercicio «Press Pallof prueba» quedó abierta en el entreno (puede que ya no exista tras el reinicio).

## Textos sospechosos
- 007 (Copia en Drive): «La conexión con Google no funciona en Expo Go. Prueba con la app instalada (build EAS).» — texto de desarrollo visible. (007-copia-drive.png)
- 006 (Vincular con Google, 006b): «El inicio de sesión no funciona en Expo Go. Prueba con la app instalada.» — mismo caso. (006b-vincular-google-previo.png)
- 006 (Entrenador, 006): fila Desconectarme: «Dejas de enviarle sesiones…» frente al modal «Dejarás de enviarle tus sesiones…» — redacción distinta para la misma acción. Revisar.
- 006 (Desconectarme, modal): «Podrás volver a conectarte con el mismo código» — ok, pero conviene alinear con la fila.
- 010 (Sesiones en pestañas): la descripción se corta con «…»: «Una sola tarjeta en Inicio, con una pestaña por s...» (009c-peso-corporal.png, 010)
- 008 (Sincronización con clientes): «el historial que él tenía tuyo» (013-eliminar-cuenta.png) — redacción forzada, revisar. Está en el modal de eliminar cuenta.
- 003 (Programas archivados): «1 sesiones» / «1 sesiones · 23 sept. 2026» — plural mal. (003-programas-archivados.png)
- 003: «Programa de inicacion» — errata (puede ser dato de prueba).
- 012 (Documentación): «For time: un trabajo fijo, lo más rápido posible.» — término en inglés. (012b-documentacion.png)
- 050 (Programa): «Semana 2 de 2 (+1) · 2 de 6 sesiones» y «Semana 2 de 1 · 3 de 3 sesiones» — el «(+1)» y «de 2» resultan confusos. (050-programa-arriba.png)
- 050 (Programa): «21 ses/sem» frente a «6 sesiones» — cifras que no cuadran a simple vista. (050-programa-arriba.png)
- 064 (Planificador): «Semana 2 de 2 (+1)» — mismo caso. (064-planificador-etapas.png)
- 100a (Crear programa): «Al crear un programa nuevo te desconectarás de tu entrenador y el programa actual será reemplazado.» — aviso claro, pero conviene revisar tono. (100a-onboarding-paso1.png)
- 101a (Confirmación): «Puedes cambiar cualquier cosa después, en el editor.» — ok.
- 020/Sesión: «Mi entreno de hoy» aparece como etiqueta de la pestaña D cuando es el día de hoy. Revisar si es copy.
- 011 (Paywall): «Forma Pro próximamente» junto a la sección «Forma de pago» — contradice que haya compra. (011a-paywall.png)
- 082 (Strain): «se muestra comparado con tu propio promedio…» — ok.
- 012 (Documentación): «Recomendación de progresión … (SIMPLIFICADO)» — revisar.
