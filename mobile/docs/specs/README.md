# Specs y roadmap de features

Índice del estado de las features grandes. Cada spec es autocontenida para que
cualquier implementador (humano o LLM) pueda ejecutarla sin la conversación
original. Reglas transversales en `mobile/AGENTS.md` + memoria del proyecto.

**La foto de todo esto se ve de un vistazo en [`docs/estado.html`](../estado.html)**,
que se regenera con `npm run estado`. No se edita a mano: lo lee de las specs.

## Códigos: tema › spec › tarea

Tres niveles, y el código dice en cuál estás:

| Nivel | Código | Ejemplo | Dónde vive |
|---|---|---|---|
| **Tema** | una letra | `C` | la letra de la tabla de abajo |
| **Spec** (un bloque de tareas con su lógica) | letra + 2 dígitos | `C05` | el archivo `C05-trainer-logging.md` |
| **Tarea** (la unidad que se implementa y se prueba) | spec + 2 dígitos | `C05-02` | su línea `> Fase C05-02 …` |
| **Casilla de prueba** | tarea + punto + número | `C05-02.3` | su lista `**Probar C05-02**` |

Para encontrar algo: `ls mobile/docs/specs/C05*` abre la spec; `npm run estado C05-02`
(o `C05`) imprime su título, archivo y sección. La página `estado.html` enseña la
misma jerarquía: temas → sus specs por orden de código → sus tareas.

| Letra | Tema |
|---|---|
| `E` | Errores — son los 26 fallos de [auditoria-tecnica.md](auditoria-tecnica.md), `E01`-`E26`, con el número que ya tenían. Es **un solo documento**: sus fallos no llevan nivel de spec |
| `M` | Monetización |
| `O` | Onboarding |
| `P` | Programas y editor |
| `T` | Entrenamiento |
| `C` | Entrenador ↔ cliente |
| `U` | Estructura y UI |
| `A` | Analítica |
| `I` | Integridad y tests — corrección de datos y calidad de los tests (los fallos que encuentre van a `E`, no aquí) |

El tema es **el de la spec entera**, no el de cada tarea: una tarea de programas que
toca UI sigue siendo `P` porque su spec lo es. Dentro de un tema los números
suben por orden de creación, y tanto el de spec como el de tarea **no se reutilizan
nunca**, ni aunque se borre: un código de hace tres meses tiene que seguir
significando lo mismo. `npm run estado` falla si dos specs se pisan el código, si
el archivo no empieza por él, o si una tarea no cuelga de su spec o usa la letra de
otro tema.

### Códigos antiguos (`antes C19`)

Hasta el 3-oct-2026 las tareas se numeraban por tema (`C19` era la 19.ª de todo
«Entrenador ↔ cliente»), sin decir en qué spec estaban. Esos códigos siguen en
los comentarios de `mobile/src` y en los mensajes de commit, que no se reescriben:
cada tarea conserva el suyo al final de su cabecera (`· antes C19`) y
`npm run estado C19` lo traduce (`C05-01` · título · archivo). `grep "antes C19"`
también vale. No se asignan códigos antiguos nuevos.

**Ojo con un `Cnn` suelto**: es ambiguo (la `C05` antigua era una tarea de triaje; la
`C05` nueva es una spec). En un comentario de `src/` o un commit anterior al
3-oct-2026 es el código antiguo; en cualquier texto nuevo, una spec se escribe
`C05` y una tarea siempre con su guion, `C05-02`. `npm run estado C05` enseña las dos
lecturas.

## Cabecera estándar de una spec

Es **obligatoria** y la lee el generador. Si falta algo o trae un valor
desconocido, `npm run estado` **falla** en vez de callarse:

```markdown
# Spec — Título          (archivo: M01-monetizacion.md)

> Tema: monetización
> En corto: Una frase, en cristiano, de qué va la cosa.
> Inicio: 2026-09-14
> Fin: 2026-09-28
> Fase M01-01 · pendiente · Identidad en RevenueCat · §3
> Fase M01-02 · pendiente · Freemium 2+2 y hoja de elección · §4 · antes M02
>
> Estado: **la prosa de siempre**, con el detalle, los commits y el coste.
```

- **`Tema`** — uno de los nueve de la tabla de arriba. Es la tarjeta de la página en la que cae la spec.
- **`En corto`** — para qué sirve esto meses después. El título y el nombre del
  archivo no bastan para acordarse de qué iba algo; esta línea sí. Sin jerga.
- **`Fase <código> · <estado> · <título> · §<sección> [· antes <viejo>]`** — una
  línea por tarea (la «fase»), **al menos una**. El código es el de su spec +
  número (`M01-02`); el `antes` es opcional y solo lo llevan las migradas. Estado: `pendiente` · `hecho` · `terminado` · `aparcado`
  (ver *Pruebas en dispositivo*, abajo). Es la unidad de
  seguimiento: casi nada se implementa de una vez, así que una spec "a medias"
  no dice nada y "3 de 10 fases" sí.
  La **`§`** es la sección de este mismo documento que cuenta esa fase; la
  página la enseña entera al pulsar la fase, así que no hay que buscarla a mano.
  Si apunta a un encabezado que no existe, `npm run estado` falla — un puntero
  roto se descubre al generar y no al pulsarlo.
- **`Inicio`** / **`Fin`** — el día en que se **trabajó** la spec, no el día en que se
  escribió. `Inicio` = cuando la primera tarea salió de `pendiente`; `Fin` =
  cuando la última lo hizo (esté o no probada). Alimentan la **línea de tiempo** de
  la página. **Las tareas `aparcado` no cuentan**: ni empiezan una spec ni impiden
  que acabe, y una spec solo con aparcadas no sale. El generador exige el `Inicio`
  en cuanto hay una tarea empezada, el `Fin` en cuanto no queda ninguna
  pendiente, y falla si hay un `Fin` con tareas pendientes (si se reabre una
  spec, se borra). Formato `AAAA-MM-DD`; el error dice qué día es hoy.
- **`Estado`** — la prosa de siempre. Sigue siendo la fuente de verdad del
  detalle; la página no la pinta porque no cabe.

**Ya no se escriben a mano `Progreso:` ni `Falta:`**: la página cuenta las
fases de cada spec (terminadas · por probar · por hacer), porque eran dos
campos que se desviaban solos.

**Quién manda sobre el estado: la cabecera.** La tabla `## Fases` de dentro del
documento es otra cosa y por eso no se unifican: es el **registro** de lo que se
hizo y en qué commit (`✅ 0884d09`), con su coste, sus dependencias y su criterio
de aceptación. La cabecera es **dónde estamos hoy**. Al cerrar una fase se
cambian las dos: la palabra en la cabecera y la fila de la tabla con el commit.

No se intenta derivar el estado de esas tablas —sería la opción sin
duplicación— por dos motivos concretos: hay ocho formatos de tabla distintos
entre las specs, y varias tienen **más filas que fases** (`program-templates`
parte la 2 en 2 y 2b, `monetizacion` tiene una fila `—` para el papeleo de las
stores, que no es código). Forzar un 1:1 perdería información real a cambio de
un parser frágil.

Dentro de [auditoria-tecnica.md](auditoria-tecnica.md) cada fallo lleva su propia
línea `> En corto:` justo bajo el título, por lo mismo. Esa spec es la única sin
`> Fase`: su unidad son los fallos.

## Pruebas en dispositivo

Es lo único que `vitest` no puede cubrir, porque los stubs del test son
inertes. Cada fase lleva **su lista de casillas**, en cualquier sitio de la spec
(lo normal: al final de su sección):

```markdown
**Probar C05-01**

- [ ] Cliente sin conectar → EMPEZAR SESIÓN B: el Workout sale con los pesos
  del cliente. Las líneas sangradas siguen siendo la misma casilla.
- [x] Una que ya se probó
```

La página las numera `C05-01.1`, `C05-01.2`… para poder decir cuál falla. Lo que se
ve en la página sale de la cabecera **y** de las casillas, sin nada más que
mantener:

| Cabecera | Casillas | En la página |
|---|---|---|
| `pendiente` | — (puede traerlas ya escritas) | **Por hacer** |
| `hecho` | alguna `[ ]` | **Por probar** |
| `hecho` | todas `[x]` | **Terminado** |
| `terminado` | ninguna | **Terminado** |
| `aparcado` | — | Por hacer, en gris |

- **`hecho` sin lista falla.** Quien cierra una fase dice qué hay que probar.
  Si no hay nada que probar a mano (un refactor, un cambio de datos, papeleo),
  la fase va directamente a `terminado`.
- **`terminado` con casillas sin marcar falla.** Una fase probada se queda en
  `hecho` con todas marcadas: pasa sola a Terminado.
- Las fases cerradas antes del 28-sep-2026 están en `terminado` por decisión del
  usuario (se dieron por probadas). Sus bloques antiguos quedan como prosa
  `**Probado en dispositivo.**` y la página ya no los lee; si un día hay que
  repetir una, se convierte en casilla.

**El usuario valida en el chat, no editando el documento.** Dice «C05-01 probada»
→ se marcan `[x]` todas las de C05-01. Dice «C05-01.2 falla: sale la fecha de hoy» →
la casilla se queda `[ ]` con la nota al final (`— ❌ 28-sep: sale la fecha de
hoy`), se arregla, y la nota se quita cuando vuelva a probarla. En los dos
casos, `npm run estado`.

## Cómo mantener esto al día

Tres situaciones. Las tres acaban en `npm run estado`, que **falla** si algo no
cuadra en vez de generar una página que miente — así que si duda, ejecútalo.

### Al cerrar una fase

1. En la **cabecera** de la spec, su línea `> Fase …` pasa a `hecho` (o a
   `terminado` si no hay nada que probar a mano). Esto es lo que manda: es lo
   que lee la página.
   Si es **la primera** de la spec en salir de `pendiente`, se añade `> Inicio:` con
   la fecha de hoy; si es **la última** (descontando las aparcadas), `> Fin:`.
2. En la **tabla `## Fases`** del documento, su fila recibe el commit y lo que
   haya que decir (`✅ 0884d09 — …`). Es el registro, no el estado.
3. Si está en `hecho`, su lista `**Probar <código>**` con las casillas de lo
   que el usuario tiene que comprobar en el móvil (§ *Pruebas en dispositivo*).
   Pruebas concretas, que se puedan dar por buenas o no: qué tocar y qué tiene
   que pasar.
4. `npm run estado`.

### Al añadir una fase o una spec nueva

**Una tarea nueva en una spec que ya existe:** la siguiente de las suyas
(`C05-06` si llega hasta la `C05-05`), con su línea `> Fase` en la cabecera.

**Una spec nueva:**

1. `npm run estado` imprime **la siguiente spec libre de cada tema** (`P14`…).
   Se coge esa. Un número **no se reutiliza nunca**.
2. El archivo se llama `<código>-<nombre>.md` (`P14-mi-spec.md`) y su cabecera
   (§ *Cabecera estándar*) trae al menos una tarea `P14-01`, con **`§N` a la
   sección que la cuenta**.
3. Se añade su fila a la tabla del tema que le toque, más abajo en este archivo.
4. `npm run estado`.

### Al añadir un fallo a [auditoria-tecnica.md](auditoria-tecnica.md)

1. Fila en el índice de severidad con el número siguiente — es su código `E<nn>`.
2. Sección `## <n>. Título` con una línea `> En corto:` justo debajo: qué
   causaba, en cristiano. Sin ella el generador falla.
3. Al arreglarlo, el ✅ en el índice y un bloque `### ✅ Resuelto` al final de la
   sección diciendo **en qué se equivocaba el diagnóstico** si se equivocaba. Esa
   es la parte que ha hecho útil ese documento; el §0 de allí lo explica.
4. `npm run estado`.

### Lo que el generador comprueba solo

Tema desconocido · falta `En corto` o `Estado` · una spec sin fases · un archivo
sin prefijo de spec · una tarea que no cuelga de su spec · una spec que no
empieza por la letra de su tema · **dos specs con el mismo código** · un
estado de fase que no es `pendiente`/`hecho`/`terminado`/`aparcado` · un
`Inicio`/`Fin` ausente, sobrante, mal formado o con el `Fin` antes del `Inicio` · una `§`
que apunta a un encabezado que no existe · un fallo de la auditoría sin
`> En corto:` · una fase `hecho` sin lista de pruebas · una `terminado` con
casillas sin marcar · un `**Probar X**` sin casillas o de una fase que no es de
esa spec · un `**Probar en dispositivo.**` del formato antiguo.

Lo que **no** puede comprobar: que la palabra de la cabecera y el ✅ de la tabla
digan lo mismo, y que el texto describa la realidad. Eso es de quien edita.

## Auditoría de corrección

| Spec | Estado | Coste | Nota |
|---|---|---|---|
| [auditoria-tecnica.md](auditoria-tecnica.md) — Auditoría técnica (ago 2026) | **cerrada** (sep 2026). 26 fallos: 3 críticos · 7 altos · 8 medios · 8 bajos — **los 26 resueltos**, las seis tandas de [§27](auditoria-tecnica.md#27-orden-de-trabajo-sugerido) | ✅ | No es una feature: es corrección. Queda pendiente de **prueba en dispositivo** (no de código) la (re)conexión cliente↔entrenador — ver [C01-client-connection.md](C01-client-connection.md). En 10 de los 26 el arreglo propuesto por el diagnóstico estaba mal o incompleto: cada sección lo dice en su bloque **Resuelto**, que es lo que hace útil el documento |

| [C01-client-connection.md](C01-client-connection.md) — Conexión entrenador ↔ cliente | **app implementada, SQL DESPLEGADO** (ago 2026); falta prueba en dispositivo. Rediseño de los fallos 5, 7, 8 y 26 de la auditoría | 🟠 | La autorización se decidía en cuatro funciones con cuatro criterios, y dos ni estaban en el repo. Una regla única: *nadie se concede a sí mismo un asiento que otro ocupa*. Mapa completo de escenarios de (re)conexión. **El SQL de `supabase/connection_model.sql` y los cambios de la app se despliegan JUNTOS**: `get_slot_by_code` cambia de firma |

| [U01-rediseno.md](U01-rediseno.md) — Rediseño estructural (sep 2026) | **fases 1 y 2 implementadas** (2-sep-2026), pendientes de prueba en dispositivo; 3 recortes antes de publicar · 4 Workout y publicar | 🟢/🟡 | No es corrección de fallos: es de **estructura**, y ninguna de las dos fases tocó una pantalla. La 1 borró 9.825 líneas de app web congelada desde may-2026 con su copia del store, y trajo `src/utils\|data\|locales` dentro de `mobile/`: **ya no hay `src/` en la raíz**. La 2 arregla que **cada tecla del campo de peso serialice el estado entero** (megabytes para un entrenador con clientes): zustand escribe en cada `set()` sin comparar, así que sacar `activeSession` del `partialize` **no basta** — hacen falta las dos mitades. Las dos specs se revisaron contra el código antes de ejecutarlas y las dos tenían huecos: en la 1, `clientSync.sim.test.js` era la única dependencia inversa del repo y ninguna regla de reescritura la tocaba; en la 2, la caducidad de 12 h se saltaba la sesión que venía dentro del blob de una instalación anterior |

| [P03-program-model.md](P03-program-model.md) — Modelo de programas (sep 2026) | **las tres fases implementadas** (2-sep-2026), pendientes de prueba en dispositivo | 🟡 | Sale del §6.1 de [U01-rediseno.md](U01-rediseno.md); **ésta sí toca pantallas**. "De quién es este programa" está escrito hoy en **cuatro sitios** que nadie obliga a estar de acuerdo, y el invariante lo sostiene quien lee: un filtro de UI es lo único que impide que `restoreProgram` le robe el programa a un cliente. La fase 1 cierra además una fuga real — `deleteProgram` y `deleteClient` **no borran las sesiones** (`removeSessionFromProgram` sí), así que cada borrado deja `tpl_*` huérfanos para siempre en el estado y en cada `.fitdata`. Lleva mapa de migración completo y sube el fichero a `version: '3'`. **Revisada contra el código (sep 2026)**: el diagnóstico se confirmó entero y la spec se parcheó con lo que faltaba — `generateAndActivateProgram` no escribe dueño (y `owner` es un test positivo, así que el programa desaparecería de la pantalla), `importForClient` es una **segunda** puerta de entrada de programas de fuera sin `ensureStages` (bloquea la fase 3), `exportProgramWithLog` es una copia literal de `_buildProgramJson` que se borra, y el vaciado de la semilla se adelanta a la fase 1 |
| [U02-home-sessions.md](U02-home-sessions.md) — La Home gira sobre la sesión (sep 2026) | spec cerrada, SIN implementar. 4 fases: U02-01 HomeView · U02-02 `ProgramCard` compartida · U02-03 `sessionPlan()` · U02-04 plantillas de sesión libre | 🟢/🟡 | Hoy **las sesiones completadas son lo más llamativo de la lista** (fondo `tint/accent-10` + borde `accent-50`) y la siguiente va sobre `surface` plano igual que las futuras: la jerarquía está invertida. El banner lima deja de ser del programa y pasa a ser la sesión que toca — **el banner desaparece como pieza de Figma** y sus cuatro datos se reparten (§8, pendiente de aprobar). Al bajar el programa al final se descubrió que `AssignedProgramCard` de `ClientsScreen` **ya era esa tarjeta**: se extrae a `ui/ProgramCard` con dos variantes, y de paso rescata el «07» en acento que el rediseño había perdido. La U02-03 no añade funcionalidad: junta en `sessionPlan()` las **tres cadenas que dan por hecho que entrenas rotando** (rótulo del hero, marcador de fila, contador del rótulo), ninguna de las cuales sabe hoy callarse — y de ahí sale la regla de §5.3: **el tamaño del hero es la confianza de la app**, así que en un modo a la carta no hay hero y manda la lista. §6 contrasta quince formas reales de entrenar: diez encajan hoy, y las dos que parecían no encajar se resuelven duplicando sesiones + `linkGroup` y con la sesión libre, que no toca `cycleCompletedIds` |
| [U03-cabeceras.md](U03-cabeceras.md) — Cabeceras de pantalla (sep 2026) | **U03-01 implementada y probada en dispositivo** (4-sep-2026, `0ca9dd5` · `a0d49bc` · `cd61d02`) | 🟢 | La barra accent estaba copiada **cinco veces** y ya divergida, y se caía con contenido real: los arquetipos generan nombres de 43 caracteres y al título le quedaban ~250px entre el chevron y el ⋮. Además la ceja salía de `colors.muted`, un gris del fondo oscuro pintado **encima** del accent — 1.66:1 en `earthy`, 2.35:1 en `midnight`. Pasa a `ui/ScreenHeader.jsx` sobre el fondo de la app, con regla accent de 5px. Workout copia el **lenguaje, no el componente** (es sticky y colapsa). Sin nodo de Figma: la cabecera del mock es justo la que se sustituye, y el diseño se eligió sobre seis variantes con nombres reales — B y F se descartaron por ancho y por perder la etapa en el editor de sesión (§4). La regla que deja: **texto sobre accent deriva de `onAccent`, nunca de los `muted*`** |

## Specs listas para implementar

| Spec | Estado | Coste | Nota |
|---|---|---|---|
| [M01-monetizacion.md](M01-monetizacion.md) — Freemium 2+2, pago dual e invitar clientes | spec cerrada, SIN implementar (sep 2026). 4 fases: 0 identidad · 1 freemium · 2 paywall dual · 3 invitar | 🟢/🟡 | El muro es **todo o nada**: sin Pro no hay ni un cliente ni una plantilla, así que el entrenador no puede probar el producto con lo que hace a diario. Pasa a **2 clientes y 2 plantillas gratis**, y el precio a **anual O pago único** sobre el mismo entitlement — que el código ya soporta entero: `checkProStatus` solo mira `entitlements.active[...]` y el paywall ya itera sobre los paquetes. Al caducar **no se borra nada**: la sincronización se **congela cliente a cliente** (el cliente sigue subiendo, el entrenador no descarga) y los 2 activos los elige él — sale casi gratis porque `uploadHistory` sube el log entero cada vez, así que una sola descarga recupera el backlog, y el contador de "entrenos sin descargar" ya está calculado. Lo caro no es la app (~5 días), es el **contrato de Apps de Pago de Apple**, que es espera pura: empezarlo el día 1. **La fase 0 va primera y no se pospone**: `Purchases.configure` va sin `appUserID`, así que hoy el Pro **no cruza de Android a iPhone** y arreglarlo con compras hechas obliga a reconciliar alias a mano. Descartado con motivo: límite en el servidor (necesitaría webhooks + tabla de entitlements) y deferred deep linking (obligaría a un SDK de atribución que tumba el *"no rastreamos"* de `app-store-privacidad.md`) |
| [T04-training-load.md](T04-training-load.md) — Carga de entrenamiento | fases 1-5 implementadas + tira de strain (captura, `trainingLoad.js`, vista Carga, esfuerzo vs carga, rendimiento, series por grupo, strain semanal); fase 6 APARCADA | 🟡 | fase 6 (objetivos por etapa) parada: las etapas no guardan fecha de inicio y hay dos definiciones de "semana" en conflicto — ver cabecera de la spec. `npm run seed` genera historial de prueba |
| [T02-metric-transparency.md](T02-metric-transparency.md) — Ver la fórmula de cada dato | fases 1 y 2 implementadas (26 fichas + 5 gráficos documentados, apartado en Documentación y hoja al tocar el dato) | 🟢 | fase 3 (Workout, Recap, historial, adherencia) pendiente de decidir si merece la pena |
| [P02-program-generator.md](P02-program-generator.md) — Generador de programas | fases A+B implementadas (`606ccdf`, `eff1666`); **fase C sustituida** por P04-program-templates.md | 🔴 | histórico del diagnóstico y de la cirugía A+B. Su §6.1 (plantillas escritas + decisiones de diseño) sigue vivo |
| [P04-program-templates.md](P04-program-templates.md) — Programas por plantilla flexible | **fases 1-5 implementadas** (resolvedor de slots, escalera de compresión, sesiones cortas, volumen semanal, vinculado automático, fases y duración, matcher por ranking); pendientes: 6 onboarding de propuestas · 7 reglas de integridad · 8 catálogo | 🟡/🔴 | el onboarding **propone programas** en vez de fabricarlos: 4 preguntas → 3 candidatos con su duración y su coste de adaptación → 2 preguntas. **Adaptar sí, planificar no**: el eje "días" se resuelve eligiendo otra plantilla (el modelo es de ciclos rotativos, no de semanas), nunca reorganizando la elegida — un solver acabaría siendo el generador procedural otra vez. Con las fases 1-5 dentro, **528/528 combos reciben una plantilla adaptada** (antes 60) con duración y fases reales. **La 8 pasa a ser la urgente**: el ranking destapó que sin plantilla de 5-7 días esos usuarios reciben demasiado volumen semanal — PPL-6 lo cierra |
| [O02-onboarding-proposals.md](O02-onboarding-proposals.md) — Onboarding de propuestas | **implementada** (ago 2026). Es la **fase 6** de program-templates, extraída a documento propio. Su UI la **sustituye** [O01-onboarding-simple.md](O01-onboarding-simple.md) | 🟢 | La única fase con UI: el onboarding pasó de 8 preguntas y un programa impuesto a **3 preguntas → 3 programas reales a elegir → 3 pasos de ajuste en vivo**. Sigue siendo la referencia del motor y de los datos (formas exactas de `rankArchetypes` y `adaptArchetype`, por qué el material no ordena el ranking). Lo que quedó terrible es el recorrido: 9-10 pantallas y la mitad avisando de recortes |
| [O01-onboarding-simple.md](O01-onboarding-simple.md) — Onboarding simple (3 preguntas) | **revisión 2 implementada** (ago 2026), pendiente de prueba en dispositivo. La revisión 1 se implementó y el QA la rechazó: el recorrido bien, la UI no se parecía a la app | 🟡 | **Tres preguntas y tres portadas**: nivel → qué buscas → días → propuestas → tu programa. Tiempo, material y limitaciones dejan de preguntarse: son **una fila que abre una hoja** con tres secciones, y el programa de debajo se repinta al tocarlas. La causa del rechazo, medida: `OptionCard`, `OnboardingStep` y `OnboardingProgress` eran **puertos literales del onboarding web** que no se usan en ninguna otra pantalla — **se borran**, y cada pieza nueva se cita con fichero y línea de la pantalla migrada de la que se copia. Lleva **dos cambios de motor**: `reduceForBeginner` pasa a reportar lo que quita, y el recorte por tiempo se calcula con nombres. Mockup aprobado. Sólo móvil |
| [C02-client-triage.md](C02-client-triage.md) — Triaje de clientes (P3) | spec cerrada, SIN implementar (ago 2026). 2 fases: 1 "bloque terminado" · 2 "estancado" | 🟢/🟡 | DOS banderas, alcance cerrado — el resto están descartadas con motivo en §5. El mecanismo de pills ya existe en `ClientsScreen`; esto cuelga dos de él. La bandera 1 cierra el bucle con el planificador: avisa de que un bloque acabó, así no hay que programar todas las etapas por adelantado |
| [P08-weeks-model.md](P08-weeks-model.md) — De ciclos a semanas | **implementada y fusionada a main** (25-sep-2026, `f7016d0`); pruebas en dispositivo en sus bloques «Probar en dispositivo». 5 fases: P08-01 modelo puro · P08-02 store y sincronización · P08-03 atleta · P08-04 entrenador · P08-05 onboarding, docs y textos | 🟡 | El «ciclo» (vuelta a todas las sesiones) sale de la app: **las sesiones de cada etapa son sus entrenos por semana** (sin dato aparte), etapas en semanas naturales desde la **primera sesión** de la etapa, y al acabar se comprueba lo entrenado y se **propone alargar** si falta al menos una semana. El hero pasa a ser la sesión que más tiempo llevas sin hacer. El progreso sigue siendo un contador del cliente que el entrenador espeja (§3.1 tiene la tabla de qué se guarda, dónde y quién lo escribe). Sustituye stage-locks §0.6/§3.2 y desbloquea la fase 6 de training-load |
| [C05-trainer-logging.md](C05-trainer-logging.md) — El entrenador apunta por el cliente | implementada entera (28-sep-2026), con C05-02 añadida. Fases: C05-01 registrar · C05-03 traspaso al conectarse · C05-04 compartir como texto · C05-05 pegar texto | 🟡 | Para clientes **sin conectar**: el entrenador abre la sesión del cliente en el Workout de siempre y lo guardado va a su historial y a su etapa, con fecha de hasta 7 días atrás. Si el cliente se conecta después, **recibe todo lo apuntado** por el mismo camino que ya usa «reinstalar recupera» (sin SQL nuevo). El texto se entiende **sin IA**: formato cerrado, alias aprendidos por entrenador y el Workout relleno como revisión final. Los conectados apuntan ellos |
| [C06-group-classes.md](C06-group-classes.md) — Clases y sesiones asignadas | spec cerrada, SIN implementar (26-sep-2026). 4 fases: C06-01 grupo · C06-02 sesiones libres de clientes/grupos · C06-03 pizarra · C06-04 clase dada | 🟡 | Un **grupo es un cliente de otro tipo** (sin slot, sin Progreso, fuera de la adherencia). Las sesiones libres pasan a poder ser de un cliente o grupo y **llegan al móvil del cliente conectado**, de solo lectura y en azul. La **pizarra** abre cualquier sesión para darla, vertical y con el reloj de los bloques; en un grupo se cierra con «clase dada», que alimenta la rotación de clases. Depende de free-sessions T06-01–T06-03 solo para la C06-02 |
| [T06-free-sessions.md](T06-free-sessions.md) — Sesiones libres de verdad | **implementada, probada y fusionada a main** (26-sep-2026, merge `1a02b01`). 5 fases: T06-01 modelo · T06-02 editor · T06-03 Inicio · T06-04 recap · T06-05 quién cuenta qué | 🟡 | La sesión libre guardada deja de ser una copia congelada (`freeSessionPresets`) y pasa a ser un `sessionTemplate` sin programa: editor, progresión, Workout y recap salen gratis. **La carga cuenta siempre**; que cuente como día del programa es una sustitución explícita en el recap («Cuenta como Sesión C»), no un sí/no. El entrenador las ve todas, pero solo las sustituciones cuentan para la adherencia. Dos trampas que la spec cierra: `useEditorExit` marcaría el programa activo al editar una libre, y `clientLogs` dejaría de subir las libres guardadas sin avisar |
| [P06-stage-planner.md](P06-stage-planner.md) — Planificador de etapas | **fases 0-4 implementadas** (ago 2026); pendientes la 5 (recap consciente de la descarga) y la 6 (rediseño del planificador, §14) | 🟡 | la etapa pasa de ser una copia a ser una regla. Vacía buena parte de la fase C del generador: 1 arquetipo × escalera = programa periodizado |
| [P05-program-view.md](P05-program-view.md) — Visualizador de programa | **fases 1-3 implementadas** (ago 2026); fase 4 (export a PDF) **aparcada** (4-oct-2026) | 🟢 | la pantalla "Ver programa" estaba en el modelo de datos de mayo: no enseñaba bloques, superseries, dropsets, calentamiento ni etapas. Ahora es un visualizador (no un tracker): resumen del programa, selector de etapas y volumen por grupo y ciclo contra la etapa 1 |
| [P07-stage-proposal.md](P07-stage-proposal.md) — Propuesta de etapa (P4) | **aparcada entera** (4-oct-2026); spec cerrada, SIN implementar (ago 2026). 5 fases: 1 ventana de etapa · 2 estado del cliente · 3 reglas · 4 prellenado del planificador · 5 entradas y cool-down | 🟡 | cierra el bucle: el planificador se abre **prellenado** desde las métricas en vez de vacío. **Un cliente vinculado nunca recibe propuesta** — es trabajo del entrenador. Ninguna regla lee `stage.rx`: el carácter de la etapa se mide. Sus fases 1-2 desatascan la fase 6 de training-load y entregan la bandera "Estancado" del triaje |
| [A01-analitica.md](A01-analitica.md) — Analítica anónima propia | spec cerrada, **en espera deliberada** (sep 2026): se arranca cuando el onboarding deje de moverse, porque la A01-02 es instrumentarlo. 4 fases: A01-01 tubería · A01-02 eventos · A01-03 pulso · A01-04 privacidad | 🟢 | Saber si terminan el onboarding, si conectan con entrenador, si vuelven a la semana y **cuánto mejoran**. El plan de marketing pedía Firebase GA4 y se descarta: GA4 no calcula una regresión sobre un historial de entrenamiento, y mete a Google como tercero receptor — adiós al *"no rastreamos"* de [app-store-privacidad.md](../app-store-privacidad.md). En su lugar, **una tabla `app_events` en el Supabase que ya está configurado**: sin dependencia nueva (`expo-crypto` ya está), sin ATT, sin dashboard. `device` es un UUID aleatorio que **no** es el `user.id`, y la tabla no tiene policy de SELECT: la anon key inserta y no lee. La métrica de mejora ya existe (`computeOverallImprovement`) pero vive dentro de `ProgressTab.jsx` sin exportar y **sin una sola prueba**, siendo el número más vendible de la app: A01-03 la saca a `utils/improvement.js` con la suya. "Programa terminado" **no se mide** — el modelo solo tiene `archived`, que mezcla terminado con abandonado; los separa la adherencia del pulso. **A01-04 no bloquea el código, bloquea la publicación** |
| [P01-bulk-edit.md](P01-bulk-edit.md) — Editor masivo + sustitución | **aparcada entera** (4-oct-2026; su `Estado` dice qué hay que rehacer si se retoma); spec cerrada, SIN implementar (ago 2026). 3 fases: 1 editor de parámetros · 2 sustitución masiva · 3 campo progresión | 🟡 | lo que un entrenador hace en Excel arrastrando una columna. **Un solo editor**: sesión/etapa es un parámetro cambiable dentro, no dos pantallas. Barata porque `SessionEditorScreen` solo se alcanza desde el editor de programa, y de ahí hereda deshacer y `markProgramDirtyForClients` (§3.1). NO es un `rx`: el absoluto es asignación, no delta |
| [U04-home-sesiones-plegables.md](U04-home-sesiones-plegables.md) — Las sesiones se pliegan | **implementada** (sep 2026, `f2f79f0`), pendiente de prueba en dispositivo. 2 fases: U04-01 cimientos · U04-02 la lista plegable | 🟢 | La zona de sesiones de la Home deja de ser «hero + lista» y pasa a ser **una sola lista de filas plegables** en orden de ciclo: la de hoy es una de ellas, en lima, con la letra grande y su botón puesto. Toda la fila abre y enseña los ejercicios con sus series; solo el botón entra a entrenar. Una sesión ya hecha, al desplegarse, ofrece **REPETIR** en vez de EMPEZAR. **Reemplaza las §3.2 y §3.3 de [U02-home-sessions.md](U02-home-sessions.md)** y no toca nada más de esa pantalla (programa, semana, sesión libre y cabecera se quedan igual). Barata porque casi todo existe: el acordeón es el de `SessionCard`, los radios son `getCardRadii` y la prescripción «4×5» se **extrae** de `ExerciseCard` en vez de reescribirse. Lo único que hay que cargar son dos familias de Barlow Condensed rectas — hoy solo está la cursiva del logo |
| [U05-program-card.md](U05-program-card.md) — La tarjeta de programa pierde el pie | **implementada** (8-sep-2026), pendiente de prueba en dispositivo. 2 fases: U05-01 la tarjeta · U05-02 el visualizador hereda las acciones | 🟢 | La tarjeta pesaba más que lo que dice —dos superficies, tres cajas para tres cifras, un pie de tres celdas— y encima **respondía a la pregunta equivocada**: su barra pintaba los ciclos de la etapa, no por dónde vas del programa. Ahora es una sola superficie sin botones con **dos zonas pulsables** (nombre → visualizador, etapa → selector), y el progreso va en dos niveles: barra de etapas con tramos proporcionales a sus ciclos, puntos para los ciclos de la etapa en curso. El toque va al **visualizador y no al editor** porque el programa de entrenador no se edita: llevando al editor, el mismo gesto haría dos cosas según de quién sea el programa. De ahí sale la U05-02 — editar y archivar se mudan a `ProgramDetailScreen`, que además cambia sus chips de etapa por el `StageSelector` compartido (los chips se estrangulaban a partir de 5 etapas). Muere `StageSegBar`. **Reemplaza las §4.2, §4.3 y §4.7 de [U02-home-sessions.md](U02-home-sessions.md)** y la §3.2 de [P05-program-view.md](P05-program-view.md) |
| [C04-qa-sep-conexion.md](C04-qa-sep-conexion.md) — QA sep-2026: lo que no viaja entre cliente y entrenador | spec cerrada, SIN implementar (22-sep-2026). 4 fases: C04-01 disparador de envío · C04-02 "sin revisar" · C04-03 cambios sin subir · C04-04 preparar sesión | 🟢/🟡 | Siete bugs de la ronda de QA y dos causas. La grande: lo único que sube historial y progreso es una llamada al final de `saveSession`, así que el RPE del recap, avanzar de etapa y las sesiones libres (que además hacen `return` antes y dejan el temporizador de descanso corriendo) no llegan; y `mergeClientLog` descarta la copia corregida de una entrada que el entrenador ya tiene. Se sustituye por **un suscriptor del store** con espera de 2 s. "Sucio" pasa a ser **firma de lo que enviaría ≠ firma de lo último enviado** |
| [U08-qa-sep-pantallas.md](U08-qa-sep-pantallas.md) — QA sep-2026: navegación, progreso y tipografía | spec cerrada, SIN implementar (22-sep-2026). 4 fases: U08-01 volver a Main · U08-02 unidades en Progreso · U08-03 gráfica · U08-04 Barlow iOS | 🟢/🟡 | En **React Navigation 7 `navigate` a una ruta apilada apila otra**: el recap, el Workout, el check de los editores y el store apilaban un `Main` duplicado (pantalla negra al dar atrás, el check siempre a Sesiones). Progreso elegía la métrica **punto a punto** y restaba kilos de repeticiones; se decide por ejercicio y sale a `utils/improvement.js` (el que reservaba A01-03). U08-04 va sin causa confirmada: aplica el nombre PostScript en iOS y se cierra con un build |
| [P09-exercise-variants.md](P09-exercise-variants.md) — Variantes de ejercicio | spec cerrada, SIN implementar (29-sep-2026). 5 fases: P09-01 librería y migración · P09-02 variante en editor y listas · P09-03 variante de hoy en el Workout · P09-04 unilateral y ejercicio aparte · P09-05 filtro en Progreso | 🟡 | Una regla: **¿mueves el mismo peso?** Agarre y anchura son la **variante** (informa, se apunta, se filtra; no toca la progresión) y los tres jalones, los dos remos en polea y las dos dominadas sin lastre se juntan en uno (la chin-up se queda aparte: en inglés es otro ejercicio) con la migración de su historial. Lo que cambia la carga es **otro ejercicio**: a una mano, o una variante convertida en «ejercicio aparte» para tener dos jalones en la misma sesión (la app no admite el mismo ejercicio dos veces). Los dos se crean como ejercicio propio con **id fijo** (`pulldown__uni`, `pulldown__pronated_wide`), así funcionan en los 21 sitios que ya resuelven librería + propios y viajan al cliente sin trabajo extra. Las familias de ejercicios se probaron y se descartaron: el borde era arbitrario. Maqueta en `docs/mockups/exercise-variants.html` |
| [U07-tab-programa.md](U07-tab-programa.md) — El tab «Programa» | spec cerrada, SIN implementar (sep 2026). 3 fases: U07-01 limpieza · U07-02 el tab · U07-03 el Historial entra en Progresión | 🟢/🟡 | El tab de Sesiones hace cinco cosas y la última es **una copia literal de dos filas del menú `≡`** (Drive y Entrenador, mismos destinos y peores subtítulos): la U07-01 la borra y no depende de nada más. El Historial deja de ser pestaña y se mete en Progresión como tercer segmento —**opt-in por prop**, porque la ficha de cliente comparte `ProgressPanel` y ya tiene su propio tab de Historial— y su hueco lo ocupa «Programa». El tab es **plano, sin control segmentado**: la tarjeta (no navegable, como en la ficha de cliente), las etapas que salen de la hoja modal y se pintan inline, y las tres acciones del programa —ver, editar, archivar— en un solo grupo de filas. Eso **reemplaza las §4.1 y §4.2 de [U05-program-card.md](U05-program-card.md)**: el visualizador pierde su pie y su `⋯`, sin dejar ningún caso huérfano (esas condiciones solo se cumplían para el programa activo y propio, que es el del tab). Nació con una cuarta fase que extraía el visualizador a componente para meterlo en un segmento; al caerse el segmentado se cayó con ella, y con eso la spec **no toca** [P05-program-view.md](P05-program-view.md). El calendario de calor se muda a CARGA: usa `internalLoad`, no es historial |
| [P10-effort-progression.md](P10-effort-progression.md) — Progresión por esfuerzo | spec cerrada, SIN implementar (29-sep-2026). 3 fases: P10-01 fuera «submáx» · P10-02 motor y editor · P10-03 Workout y listas | 🟡 | «Submáx» decía tres cosas y hacía una cuarta (solo registro): desaparece y sus 7 ejercicios, todos sin carga, pasan a Fija. El tercer modo pasa a ser **Por esfuerzo**: reps objetivo + RPE, y el peso de cada sesión sale del e1RM calculado con el RPE apuntado — la misma fórmula de Epley que ya usa `oneRm.js`, en los dos sentidos. **Lo que progresa es el 1RM, no el RPE**, así que no se acaba en 10. Solo con carga externa y nunca por defecto |
| [U09-pulido-ui.md](U09-pulido-ui.md) — Pulido de UI (apuntes) | apuntes, no spec cerrada (29-sep-2026). 11 fases: U09-01 pager en Progresión · U09-02 recap · U09-03 hojas de opciones · U09-04 hueco de sesiones libres · U09-05 botones del programa de cliente · U09-06 confirmaciones sin Alert · U09-07 i18n y modales viejos · U09-08 un solo lima · U09-09 cabecera de cerrar · U09-10 pantalla vacía · U09-11 hoja de progresión | 🟢/🟡 | U09-01–U09-05 son notas del usuario; U09-06–U09-11 salen de revisar el código: 64 `Alert.alert` pese a estar prohibidos, dos filas de opción distintas (con y sin icono), textos en español fijos que rompen el inglés, un segundo lima escrito a mano en 5 ficheros y piezas copiadas que ya divergieron. Cada fase necesita revalidar datos y cerrar diseño antes de implementarse |
| [U10-todo-pesa.md](U10-todo-pesa.md) — Todo pesa: movimiento y gráficos con tema | spec cerrada, SIN implementar (30-sep-2026). 9 fases: U10-01 casillas que se despliegan en una regla · U10-02 metrónomo de tempo · U10-03 final del descanso · U10-04 rampa del calentamiento · U10-05 escalera en el editor · U10-06 tarjeta de hoy → cabecera · U10-07 ola de etapas · U10-08 ola como vista previa · U10-09 plan frente a real | 🟢/🟡 | Sale de explorar con maquetas cómo hacer la app menos sobria; de unas quince ideas quedaron nueve, y las descartadas están en su §1.3 con el motivo. Un lenguaje común para todas («todo pesa»: sin rebotes, lo vertical es el valor, el lima es lo que toca, vibraciones con significado fijo). Decisiones del §1.4: regla del peso fija de ±20 kg a 0,5 sin ampliar (se sabe que cuesta atinar; el espaciado se afina en el móvil), texto del metrónomo fijo y la pesa sobre una línea de suelo. **Queda abierta D3**: cómo se enseña el progreso de la repetición, porque la tira de tramos se aplasta con algunos tempos. La intensidad de la ola se valida con la semilla antes de U10-07. Maqueta: `docs/mockups/todo-pesa.html` |
| [P11-editor-vinculacion.md](P11-editor-vinculacion.md) — Deslizar sesiones y vincular ejercicios | spec cerrada, SIN implementar (1-oct-2026). 3 fases: P11-01 deslizar tarjetas de sesión · P11-02 vinculación como mapa de programaciones por etapa · P11-03 vincular al añadir | 🟢/🟡 | Maqueta `docs/mockups/link-exercises.html` (v4). Ámbito de la vinculación = la etapa (antes, todo el programa). |
| [P12-progresion-clara.md](P12-progresion-clara.md) — Progresión clara | **cerrada** (1→3-oct-2026): P12-01 a P12-05, P12-07, P12-08 y P12-10 terminadas; P12-09 aparcada; P12-06 movida a U11-01 (4-oct) | 🟢/🟡 | El motor ya cubría casi todo pero se equivocaba en cuatro casos: Reps y Tiempo no tenían memoria, una asistida editada pedía más ayuda y «% mínimo» no hacía nada en Doble. La P12-02 ordena la progresión en tres preguntas y hace que el plan sea el gris de cada serie. La escalera va después, como extensión de «Qué pides» |
| [C07-asignar-programas.md](C07-asignar-programas.md) — Asignar programas: una puerta, cualquier origen | spec cerrada, SIN implementar (1-oct-2026). 3 fases: C07-01 copias con `derivedFrom` bien · C07-02 hoja «Asignar programa» · C07-03 copiar a otro cliente / guardar como plantilla | 🟢/🟡 | C07-01 es un bug vivo: las copias de programas de varias etapas pierden los pesos de referencia al pasar de etapa. |
| [U11-preferencias-ui.md](U11-preferencias-ui.md) — Preferencias de UI | abierta el 4-oct-2026 para juntar las opciones de personalización de la interfaz. 5 fases: U11-01 la última vez (antes P12-06) · U11-02 regla por incremento del ejercicio (antes U10-11) · U11-03 a U11-05 vistas del editor de sesión, aparcadas (antes la spec P13, borrada) | 🟢 | Aquí va toda tarea que deje al usuario elegir cómo se ve o se comporta una pantalla o función: en `profile`, fila en Preferencias del menú, por defecto lo de hoy (§1) |

## Implementadas (en testeo en dispositivo, julio 2026)

| Spec | Estado |
|---|---|
| [T03-strength-blocks.md](T03-strength-blocks.md) — Dropset + Superserie | implementada (`92ab414`) |
| [T01-conditioning-blocks.md](T01-conditioning-blocks.md) — AMRAP/EMOM/For time | implementada, 4 fases + fix rondas EMOM + resumen en editor (`a15ee07`) |
| [T05-warmup-sets.md](T05-warmup-sets.md) — Series de calentamiento | implementada, 3 fases (`45a74ee` utils, `f04a254` editor, `8d7d187` workout) |
| Gestión del historial (sin spec propia) | implementada ago-2026: `logMode` merge/replace al importar + menú "···" en Historial con borrado en bloque (todo / ajeno al programa activo). Detalle abajo |

### Gestión del historial — desglose

Antes solo se podía borrar sesión a sesión. Tres piezas:

1. **`sections.logMode`** (`'merge' | 'replace'`) en `importData`. Sin él,
   reimportar un backup corregido NO actualizaba nada: la fusión deduplica por
   id y daba por buena la copia vieja. Simétrico al `templatesMode` que ya
   existía; el selector de `ImportModal` se extrajo a `ModeSectionRow` y ahora lo
   comparten historial y plantillas en vez de estar duplicado.
2. **`clearWorkoutLog(scope)`** en el store: `'all'` y `'off_program'`. Las
   sesiones libres (`__free__`) cuentan como ajenas al programa — es justo lo que
   se quiere limpiar (pruebas, semillas, sueltas). **Sin programa activo no borra
   nada**: sería un borrado total por sorpresa. Devuelve cuántas borró, para el
   toast.
3. **Menú "···" en `HistoryScreen`** con `DragSheet` (patrón unificado), junto al
   selector de ámbito. Confirmación nativa que dice **cuántas** sesiones se van
   —contadas antes— y recuerda exportar.

Trampa pisada: declarar el manejador antes de los `useMemo` que captura hace que
el compilador de React abandone la memoización de la pantalla entera (+1 error de
lint). Va después de `programTemplateIds`/`effectiveTemplateIds`.

## Aparcado (decisión de producto pendiente, NO implementar)

- ~~**Volumen semanal por patrón**~~ — **REVIVIDO** como fase 5 de
  [T04-training-load.md](T04-training-load.md): pasa a ser series por GRUPO MUSCULAR
  (no por patrón) dentro de la vista Carga, con rango de referencia 10-20.
  Aprobado por el usuario sobre mockup (jul 2026).
- **Aviso de balance de patrones**: descartado a nivel sesión (un día Push sin
  pierna es por diseño); como idea futura, a nivel programa/semana.

## Pendientes menores (sin spec, definir al arrancar)

- Chip "PR" en vivo en el workout al marcar serie (la lógica ya existe en
  `src/utils/sessionRecap.js` → `detectPRs`; es solo UI en SetRow/ExerciseCard).
- Prescripción por %1RM (base e1RM ya existe en `src/utils/oneRm.js`).
- Unificar modelo de guardado (autosave del editor de ejercicio vs botón Guardar
  + snapshot del editor de programa) — decisión de producto.
- **Sustituir un ejercicio durante el workout**, como sustitución **puntual de
  esa sesión**: no toca el programa y queda reflejada en el historial (hoy solo
  se puede desde `SessionEditorScreen`, y `saveSession` no distingue "sustituido"
  de "saltado + ad-hoc"). Sube de prioridad desde sep-2026: es la vía de
  adaptación que le queda al cliente conectado ahora que el programa del
  entrenador es de solo lectura — ver [C03-stage-locks.md](C03-stage-locks.md) §2.1.
  `replaceExercise` ya existe; lo que falta es el registro en el log y la entrada
  desde `WorkoutScreen`.
- Swipe en bordes de SessionEditorScreen como atajo para cambiar de sesión
  (los chips ya cubren la función; `switchSession` ya existe).

## Futuro ligado al restyle (Figma del usuario, "FormaFit")

- Fase de fuentes de los themes (`th.fonts` es placeholder) + theme Sharp.
- Migración de emojis a SVG (tabs del detalle de cliente, botón notas del workout).
- Barrido de i18n hardcodeado restante en ClientsScreen.
- Revisar contraste del header del theme Earthy.

## Explícitamente descartado

- Rep-schemes variables (21-15-9, escaleras, chippers) — fuera hasta después de
  los bloques de acondicionamiento.
- Streaks/rachas tipo Duolingo — contrario a la filosofía de "información justa".
- Granularizar las series de trabajo (editor por-serie) — solo si algún día se
  hacen pirámides/top-set como feature propia.
