# Spec — Carga v1: un panel que se lee de un vistazo y no engaña

> Tema: entrenamiento
> En corto: La pestaña Carga pasa a ser un panel: tres tarjetas (carga, esfuerzo, fuerza) que eligen una sola gráfica, todo funciona aunque no se apunte el esfuerzo de la sesión, y deja de decir cosas que no son. De paso, el VOLUMEN de Ejercicios deja de comparar dos sesiones sueltas.
> Fase T11-01 · pendiente · Panel: tres tarjetas que eligen la gráfica · §4
> Fase T11-02 · pendiente · Sin sRPE la pestaña no se vacía · §5
> Fase T11-03 · pendiente · Carga: estado, monotonía y strain · §6
> Fase T11-04 · pendiente · Esfuerzo: semanas o sesiones y esfuerzo vs carga · §7
> Fase T11-05 · pendiente · RPE medio por ejercicio · §8
> Fase T11-06 · pendiente · Fuerza: 4 semanas y periodo, por ejercicio · §9
> Fase T11-07 · pendiente · Series por grupo contra lo previsto · §10
> Fase T11-08 · pendiente · El calendario vuelve al Historial · §11
> Fase T11-09 · pendiente · VOLUMEN de Ejercicios por semanas · §12
> Fase T11-10 · pendiente · Datos con sentido: casos y bordes con test · §13
>
> Estado: **spec reescrita el 6-nov-2026, sin implementar.** La primera versión
> (27-oct) solo arreglaba datos sin tocar la pantalla. Tras siete vueltas de
> maqueta con el usuario, la pantalla se rehace como panel:
> [`carga-t11-2.html`](../mockups/carga-t11-2.html), publicada en
> https://claude.ai/artifact/J5Yroz4mm5HV7ZxrBhRMfF. Es interactiva (quién mira,
> con o sin sRPE) y es la referencia de esta spec. La primera propuesta,
> descartada, está en [`carga-t11.html`](../mockups/carga-t11.html). Viene de la revisión
> con el **visor de carga** (`scripts/visor-carga/`,
> https://claude.ai/artifact/VY98E7ks2Tet15v2guqr8F). Sigue mandando
> [T04](T04-training-load.md) en todo lo que esta spec no toca.

---

## 1. Por qué

Lo que enseñó el visor sobre la vista Carga de hoy (`LoadTab.jsx`):

| Persona (fila del visor) | Qué pasa hoy |
|---|---|
| Ana y Luis, sin sRPE (todas) | La vista entera sale vacía («Aún no hay datos de esfuerzo»), y con ella Rendimiento y Series por grupo, que no dependen del sRPE |
| Carlos falta un día (carlos-7) | «−36 % · Estás descargando» |
| Carlos estancado desde la semana 4 (carlos-10) | Rendimiento «+27 %» fijo: con el periodo por defecto (3M) compara con el principio de la ventana y no se ve el estancamiento |
| Ana entrena 2 días (todas) | Series por grupo de los últimos 7 días contra una banda de 10-20: siempre «por debajo» |
| Javi, 3-4 sesiones (javi-6) | La monotonía sale siempre «variada»; el strain % se calcula y no se pinta |

Y la pantalla: el calendario y el selector de periodo van primero, lo que dice
«cómo va» son tres cifras abstractas (carga %, monotonía, sesiones) y hay cinco
tarjetas de gráficas apiladas. El entrenador, que es quien más la usa, tiene que
bajar mucho para ver si su cliente progresa.

Dos fallos encontrados al escribir esta spec:

- `LoadCalendar` no recibe el log: lee `workoutLog` del store. En la ficha de
  cliente pinta **el historial del entrenador**, no el del cliente. Se arregla en T11-08.
- El VOLUMEN de Ejercicios (`computeVolumeImprovePct`, `ProgressTab.jsx`)
  compara el tonelaje de la última sesión del periodo con el de la primera. Si una
  es Pierna y la otra Torso, salen ±60 % sin que haya cambiado nada. Se arregla en T11-09.

## 2. Qué se calcula sin sRPE

Para tenerlo claro al implementar (todo en `trainingLoad.js`):

- **Sin sRPE:** la carga externa (trabajo hecho) de cada sesión, que es Σ reps ×
  (peso efectivo ÷ 1RM de referencia de las 6 semanas anteriores), más los bloques
  de acondicionamiento. Las series sin reps no entran, y las de peso corporal sin
  peso del usuario tampoco: la sesión queda marcada `partial`. También salen
  sesiones, series por grupo, duración, fuerza (e1RM; el RPE de la serie la
  afina) y el RPE de cada serie si se apunta.
- **Solo con sRPE:** la carga interna (sRPE × minutos), el esfuerzo medio y
  «Esfuerzo vs carga».

## 3. Reglas comunes

- **Los 7 días.** «Últimos 7 días» es una ventana móvil, no la semana natural.
  **Si hoy aún no hay sesión, todas las ventanas de 7 y 28 días acaban ayer**: si
  no, un viernes por la mañana la semana sale con una sesión de menos y la carga
  cae un 17 % falso (el fallo de «falta un día» del visor). Lo mismo vale para
  los bloques semanales de las gráficas: bloques de 7 días hacia atrás desde ese
  día. La única excepción es Series por grupo (§10), que va por semana natural
  porque se compara con lo previsto para la semana del plan.
- **Un solo periodo para toda la pestaña: 1M · 3M · 6M.** Cada tarjeta de gráfica
  lleva su selector, pero todos van al mismo valor: cambiarlo en una cambia las
  demás. Se guarda como **preferencia del usuario** en el store, persistida, por
  defecto `3m`. «Todo» desaparece, porque no cabe en la cabecera de la tarjeta junto al título.
  Sigue la regla de T04 §4.1: el periodo recorta lo que se pinta, nunca lo que se calcula.
- **Quién mira.** Desde la ficha de cliente, los textos hablan del cliente en
  tercera persona («su último mes», «ha entrenado»). `ProgressPanel` recibe
  `subjectName` desde `ClientsScreen` y `LoadTab` elige la variante de texto. En
  `StatsScreen` va en segunda persona («tu último mes»).
- **De quién son los datos (añadido el 6-nov tras revisar el código).** Nada de
  la pestaña lee del store lo que es del sujeto: en el móvil del entrenador el
  store es **suyo**. `ProgressPanel` y `LoadTab` reciben por prop:
  - `baseLog` (ya existe), `fallbackBodyWeight`: en la ficha, el último de
    `selectedClient.bodyWeight` (hoy no se pasa y se deduce del log);
  - `program`: en la ficha `programs[selectedClient.activeProgramId]`, en
    Progresión `programs[profile.activeProgramId]`;
  - `client`: en la ficha `selectedClient`, en Progresión `null`. La etapa en
    curso sale **solo** de `athleteProgress(program, client)`
    (`stageProgress.js`), nunca de `program.currentStageIndex`: en el móvil del
    entrenador esos campos son de su copia y no avanzan;
  - `subjectName`.
  Las plantillas sí salen del store (`sessionTemplates`), porque las del
  programa del cliente están en él.
- **Una sola cifra de carga.** La tarjeta CARGA y la cifra de carga de la tarjeta
  de programa de la ficha (`clientLoadPct` en `ClientsScreen`) salen de la misma
  función de `trainingLoad.js` (`loadSummary` o similar: interna si hay sRPE,
  externa si no, con peso corporal y la regla de «acaba ayer»). Hoy son dos
  cuentas distintas y no cuadrarían.
- **Semanas por fecha, no por posición.** Las series semanales solo traen las
  semanas con datos; «hace 4 semanas» o «los últimos 3 meses» se buscan por
  fecha, nunca con `slice(-n)` o «n entradas atrás».
- **Desde la ficha, el estado vacío no lleva botón**: «Empieza a entrenar» lleva
  al Entreno del entrenador. Va un texto en tercera persona.
- **Todo dato se toca.** Lo que no es una tarjeta seleccionable lleva su
  `InfoLabel` (la «i») y abre su ficha en `MetricInfoSheet`. Los textos de la
  pantalla se quedan cortos y la explicación larga va en la ficha.
- **Nada de rojo** (UI-MIGRATION §4.9). Lo que baja va en `orange`.
- Ningún `NaN`, `Infinity` ni negativo imposible en lo que se pinta (§13).

## 4. T11-01 — Panel: tres tarjetas que eligen la gráfica

La pestaña, de arriba abajo: **tres tarjetas → la gráfica de la tarjeta elegida →
(con Esfuerzo) RPE medio por ejercicio → Series por grupo**. Sin calendario
(T11-08), sin línea de semana de etapa y sin el selector de periodo suelto.

**Tarjetas** (`statTile` de hoy, contenido centrado, misma fila de tres):

| Tarjeta | Número | Subtítulo | Minigráfica (8 semanas) |
|---|---|---|---|
| CARGA | media 7 d ÷ media 28 d − 1, en % (`+2 %`) | «vs su mes» / «vs tu mes» | carga de cada bloque de 7 días, `accent` |
| ESFUERZO | media del sRPE de las sesiones de los últimos 7 días, «8,0 /10» | «últimos 7 días» | media de sRPE de cada bloque, `orange` |
| FUERZA | cambio del índice de rendimiento en 4 semanas, en % | «en 4 semanas» | índice semanal, `accent` |

- **Selección** con el relleno de las fichas de datos de la app, el de
  `StageCards.jsx`. Es un círculo `accent` que sale de la esquina de arriba a la
  derecha con radio = diagonal de la tarjeta. Se llena en 450 ms out-cubic y la
  que se deja se vacía en 200 ms. El texto cambia a `onAccent` con el
  cruce de opacidades de `StageCard` (`[0, .6]` → 0 y `[.4, 1]` → 1). Se reutiliza
  ese código; si no se puede sacar sin tocar `StageCards`, se copia el patrón tal cual.
- Por defecto, **CARGA** elegida. La elección no se guarda.
- Las tarjetas son interactivas, así que no llevan «i»: su ficha está en la gráfica.

**La gráfica** es una tarjeta (`card` de hoy) con título + `InfoLabel` a la
izquierda y el selector de periodo a la derecha. Sustituye a las cinco tarjetas
de hoy: evolución, strain por semana, esfuerzo vs carga, rendimiento y series
(estas últimas siguen, en §10). La tira de strain semanal desaparece (§6).

**Cifras de encima de una gráfica** (Esfuerzo y Fuerza): dos columnas separadas
por una línea vertical `border`, **sin caja**, con el número en 16 px peso 800.
Una caja `surface2` sobre la tarjeta no tenía contraste, y un número del tamaño
de las tarjetas parecía otra fila de tarjetas. Si el rol de `textStyles` más
cercano no da esos 16 px, se usa el más cercano y se avisa.

**Probar T11-01**

- [ ] Entrar en Progreso › Carga: arriba las tres tarjetas, CARGA rellena de lima, debajo su gráfica. No hay calendario.
- [ ] Tocar ESFUERZO: el lima sale de la esquina de arriba a la derecha y la llena; CARGA se vacía deprisa; la gráfica cambia.
- [ ] Cambiar a 1M en una gráfica, pasar a otra tarjeta: también está en 1M. Cerrar la app y volver: sigue en 1M.
- [ ] Desde la ficha de un cliente, los textos dicen «su», no «tu».

**Notas de la implementación (T11-01):**
- `loadSummary` (`trainingLoad.js`) devuelve la serie ya con `value` (interna o externa) y la usan la tarjeta CARGA y `clientLoadPct`. `clientLoadPct` conserva su umbral de 14 días de historial.
- La cifra de FUERZA sale de `strengthChange` (mejor e1RM de 28 días contra los 28 anteriores, por ejercicio, solo con dato en las dos ventanas), no de `performanceWeekly`; la minigráfica sí usa el índice semanal. La gráfica de Fuerza sigue siendo la de hoy hasta T11-06.
- Sin sRPE, la gráfica de Esfuerzo enseña de momento el texto `load.emptyNoRpe` dentro de su tarjeta (T11-02 pone la invitación). La pestaña ya no se vacía por falta de sRPE: la carga pinta la externa.
- La monotonía, el strain y su tira se han quitado de la pantalla; vuelven en T11-03.
- `LoadTab` recibe `program` pero aún no lo usa (lo necesita T11-07).

## 5. T11-02 — Sin sRPE la pestaña no se vacía

Hoy, si ninguna sesión tiene sRPE, `LoadTab` pinta `load.emptyNoRpe` en vez del
panel. El estado vacío queda solo para «aún no hay sesiones».

- Sin ninguna sesión con sRPE, todo lo que usa la carga interna usa la **externa**:
  la tarjeta y la gráfica de CARGA, el estado, la monotonía y el strain. El título de la
  gráfica pasa a «Carga · trabajo hecho», y debajo una línea: «Sin esfuerzo
  apuntado, la carga es el trabajo: repeticiones por lo cerca que va cada serie de
  tu máximo.»
- Con sesiones con y sin sRPE, manda la interna, como hoy. Las sesiones sin sRPE
  son hueco, no cero (T04 §4.5).
- **La tarjeta ESFUERZO** sale en contorno (`border`, sin fondo) con «—» y «sin
  apuntar». Elegida, su gráfica es un fantasma de barras en contorno con una
  invitación:
  - quien entrena: «**Al acabar cada sesión, responde «¿Cómo de dura fue?» (de 1
    a 10).** Con eso verás aquí cuánto te cuesta cada semana y si te estás
    pasando, no solo cuánto haces.»
  - entrenador: «**{{nombre}} no apunta cómo de dura fue cada sesión.** Pídele que
    responda «¿Cómo de dura fue?» (de 1 a 10) al acabar. Con eso verías aquí cuánto
    le cuesta cada semana y si se está pasando, no solo cuánto hace.»
- El aviso no se repite en ningún otro sitio. **RPE medio por ejercicio (§8) sale
  igual**, porque usa el RPE de las series, no el de la sesión.

**Probar T11-02**

- [ ] Con un historial sin sRPE (`npm run seed` o el visor, persona Ana): la pestaña sale entera; CARGA dice «Carga · trabajo hecho».
- [ ] ESFUERZO en contorno con «—»; al tocarla, la invitación. Desde un cliente, la versión del entrenador con su nombre.
- [ ] Apuntar el esfuerzo en una sesión: la carga vuelve a ser la interna.

**Notas de la implementación (T11-02):**
- La tarjeta ESFUERZO sin sRPE conserva su relleno de lima al elegirla (solo cambia a contorno y «—» cuando no está elegida). La gráfica de Esfuerzo con sRPE pero menos de 2 semanas queda vacía hasta T11-04 (antes enseñaba `load.emptyNoRpe`, que mentía con sRPE; se ha borrado).

## 6. T11-03 — Carga: estado, monotonía y strain

**Lectura** encima de la gráfica, con su punto de color: la frase del estado
(`loadState`) y «Últimos 7 días contra la media de 28.» Los textos dejan de
presuponer una descarga:

| Estado | Hoy | v1 |
|---|---|---|
| `unloading` | Estás descargando. | Esta semana has entrenado menos que en tu último mes. |
| `steady` | Carga estable. | Esta semana, en línea con tu último mes. |
| `loading` | Estás acumulando carga. | Esta semana has entrenado más que en tu último mes. |

**Gráfica:** la de hoy (`LoadChart`: barras por día + medias de 7 y 28 días), con
su leyenda.

**Debajo, dos datos** (filas con una línea `border` encima, sin caja, cada una con su «i»):

- **Monotonía** · «0,9 · días variados». Por debajo de 1,5 es «días variados»,
  entre 1,5 y 2 «días bastante iguales» y desde 2 «días muy iguales» (umbrales de
  Foster, `MONOTONY_MODERATE`/`HIGH`). Texto: «Cuánto se parece entre sí la carga de
  los últimos 7 días. Los días sin entrenar también cuentan.» Con menos de 3
  sesiones en los 7 días: «—» y «Hacen falta 3 sesiones en 7 días».
  - Con 3 sesiones a la semana casi siempre sale «variados», porque los días de
    descanso pesan mucho. Es lo que mide Foster y no se toca. No se calcula sobre
    periodos largos: la desviación saldría casi toda del patrón de descansos.
- **Strain** · «+12 %». Es la carga de los 7 días × la monotonía, contra la media
  del strain de los 4 bloques anteriores (solo los que tienen 3 sesiones o más:
  una semana floja en la base inflaría el %). Texto: «Carga × monotonía de los últimos 7
  días, contra tu media de las 4 semanas anteriores.» Va sin color de alarma,
  porque no hay umbral universal (ficha `strain`). Sin base: «—».

Con menos de 3 sesiones no hay monotonía, y por tanto tampoco strain.

**Probar T11-03**

- [ ] Un viernes sin entrenar todavía, con lunes y miércoles hechos: la carga no sale un 17 % por debajo.
- [ ] La frase del estado es la nueva, nunca «Estás descargando».
- [ ] Monotonía con valor y etiqueta; strain en %. Tocar cualquiera de las dos abre su ficha.
- [ ] Con 2 sesiones en 7 días: «—» y el aviso de las 3 sesiones.

**Notas de la implementación (T11-03):**
- `monotonyStrain(days)` (`trainingLoad.js`) solo usa bloques completos de 7 días; los huecos (sesión sin sRPE) cuentan 0 como los descansos. Los textos del estado son claves `load.stateX` / `load.stateThirdX`; `load.state.*` y `load.emptyNoRpe` se han borrado. El strain se pinta como «+12 %» (con espacio, como la maqueta) y las tarjetas siguen con «+12%» de T11-01.

## 7. T11-04 — Esfuerzo: semanas o sesiones y esfuerzo vs carga

**Cifras:** «ÚLTIMOS 7 DÍAS · 8,0 /10 · 2 sesiones» | «MEDIA 3M · 7,6 /10 · 38
sesiones». La segunda es la media del sRPE de todas las sesiones del periodo
elegido, y su etiqueta cambia con él (MEDIA 1M / 3M / 6M).

**Gráfica:** un segmentado **«Semanas | Sesiones»** a todo el ancho y debajo
barras `orange` en escala 0-10, con el eje 0 · 5 · 10 a la derecha.
- Semanas: una barra por bloque de 7 días con la media de sRPE de sus sesiones.
- Sesiones: una barra por sesión.
- Las de los últimos 7 días van en `orange` lleno y el resto al 45 %. Abajo, la
  fecha de la primera barra y «ÚLTIMOS 7 DÍAS».
- La elección de semanas o sesiones no se guarda (por defecto, Semanas).

**Esfuerzo vs carga**, debajo, con su título y su «i»:
- Dos líneas semanales: carga externa (`accent`) y carga interna (`orange`). Cada
  una en % de cambio desde el primer bloque con sesiones del periodo, con eje de %
  a la derecha (pasos de 5, 10 o 20 según el rango) y un punto al final de cada línea.
- La lectura sale como chip y **dice qué sube, qué baja y cuánto**: «+8 % carga ·
  +2 % esfuerzo → adaptación». Compara la media de los últimos 4 bloques con la de
  los 4 anteriores. Debajo: «Últimas 4 semanas contra las 4 anteriores.»
- Etiquetas (`load.trend.*` de hoy, sin las flechas):
  - **adaptación**: carga sube y esfuerzo plano.
  - **fatiga**: carga plana y esfuerzo sube.
  - **bloque duro**: suben los dos.
  - **descarga**: bajan los dos.
  - **sin un patrón claro**: cualquier otro caso.
- «Sube», «baja» y «plano» se miden con un umbral **por decidir en T11-10, mirando
  el visor**. Con el ±8 % de `effortTrend`, un +4 % de carga con un +2 % de
  esfuerzo sale «sin patrón», aunque la tendencia es buena. La maqueta usa ±5 %.
- El chip compara siempre 4 bloques contra 4, también en 1M, aunque la gráfica
  pinte menos: la ficha lo dice.
- Se sustituye `effortTrend` (índices base 100 y bloques de 4, que se retrasaba
  semanas en las descargas: T11 v2 de antes).

**Probar T11-04**

- [ ] «Últimos 7 días» y «Media 3M» con sus sesiones; al cambiar a 6M, pone «Media 6M» y cambia el valor.
- [ ] «Semanas | Sesiones» cambia la gráfica; las barras de los últimos 7 días resaltan.
- [ ] El chip de Esfuerzo vs carga trae las dos cifras con su signo y la etiqueta.

## 8. T11-05 — RPE medio por ejercicio

Tarjeta propia, **debajo de la gráfica, solo con ESFUERZO elegida**, con su
selector de periodo (el compartido, §3). Va también sin sRPE.

- Título «RPE MEDIO POR EJERCICIO». Debajo, una tabla con las columnas:
  - **Ejercicio**
  - **Series**: series con RPE en el periodo.
  - **4 SEM**: RPE medio de sus series en las últimas 4 semanas.
  - **3M**: RPE medio en el periodo; la cabecera cambia con él.
- En 1M las dos columnas de RPE dirían lo mismo y queda una sola, «RPE».
- RPE medio = media del `rpe` de las series hechas del ejercicio, contando solo las
  que lo tienen. Las sub-series de un dropset no cuentan, igual que en series por grupo.
- Orden: de más duro a más suave por la columna 4 SEM. Los ejercicios sin RPE no salen.
- Pie: «Solo cuentan los ejercicios con RPE apuntado.»
- Sin ninguna serie con RPE en el periodo, la tarjeta no sale.

**Probar T11-05**

- [ ] Con ESFUERZO elegida, la tarjeta sale debajo con los ejercicios ordenados por RPE; con CARGA o FUERZA, no está.
- [ ] Cambiar el periodo en esta tarjeta cambia también la gráfica de Esfuerzo (y al revés).
- [ ] Sin sRPE pero con RPE en las series, la tarjeta sale igual.

## 9. T11-06 — Fuerza: 4 semanas y periodo, por ejercicio

**Cifras:** «4 SEMANAS · +3 % · desde el 9 oct» | «3M · +9 % · desde el 7 ago».
En 1M, la segunda columna sería la misma cifra y pasa a «MEJOR EJERCICIO ·
Sentadilla · +3 % en 4 semanas».
- La cifra grande de la tarjeta FUERZA es la de 4 semanas, y así quien lleva dos
  meses estancado no ve un «+27 %». **Corregido el 6-nov:** no sale de dos puntos
  del índice de `performanceWeekly`, porque ese índice promedia los ejercicios que
  haya en cada semana y la mezcla cambia (un ejercicio estrenado hace 2 semanas
  entra «ahora» con índice ~100 y no está «hace 4»: hunde la media sin que nadie
  pierda fuerza). La cifra es la **media de los cambios por ejercicio** de la
  tabla de abajo, contando solo los ejercicios con dato en las dos ventanas. Así
  tarjeta y tabla coinciden por construcción. Lo mismo para la cifra del periodo.
- Las ventanas de fuerza van en bloques de 7 días que acaban en el mismo día que
  la carga (§3), no en semanas naturales.

**Gráfica:**
- El índice del periodo en % de cambio desde su inicio, con área `accent` al 12 %
  y eje de % a la derecha.
- Las 4 últimas semanas van en una banda `accent` al 6 % con el rótulo «4 SEM».
  Un punto hueco marca dónde estaba hace 4 semanas (en 1M es el inicio) y uno lleno el final.
- Sin rótulos de valor dentro de la gráfica: los valores van en el eje.

**Por ejercicio**, una tabla con las columnas Ejercicio · 4 SEM · 3M (la cabecera
cambia con el periodo; en 1M, una sola columna):
- Cada celda es el cambio del e1RM del ejercicio, con el mismo criterio que
  `performanceWeekly`: mejor e1RM de la ventana de 4 semanas que acaba en el punto,
  contra el de 4 semanas antes o contra el inicio del periodo.
- Se pinta `+3 %` en `accent`, `−4 %` en `orange` e «igual» en `mutedLight`.
- Las dos columnas cuentan cosas distintas: una sentadilla puede ir +3 % en el
  último mes y −4 % en 3M, porque vuelve de un bache.
- Orden: por la columna 4 SEM, de más a menos. Hace falta una función por
  ejercicio en `trainingLoad.js` que reparta lo que hoy calcula `performanceWeekly`
  por dentro (`perExercise`).

**Probar T11-06**

- [ ] La tarjeta FUERZA y la cifra de 4 semanas coinciden; la del periodo cambia con 1M/3M/6M.
- [ ] La gráfica tiene el eje de % a la derecha, la banda de 4 semanas y los dos puntos; sin textos sueltos dentro.
- [ ] Un ejercicio que baja sale en naranja, uno parado dice «igual».

## 10. T11-07 — Series por grupo contra lo previsto

Sustituye a la ventana de 7 días con banda de 10-20 (T04 §5.2.6), que castigaba a
quien entrena 2 días. Decisión del usuario (27-oct): es una **referencia de cómo
distribuyes**, no un objetivo de volumen.

- **Semana natural** (lunes a domingo), la que está en curso. Cabecera: «Series por grupo · 32 de 45 esta semana».
- Cada grupo: **hechas de previstas** («6/9»).
  - Previstas = series del plan de esa semana por grupo: `stageSetsByGroup`
    (`stageStats.js`) sobre la etapa `athleteProgress(program, client).currentStageIndex`
    (§3, «De quién son los datos»).
  - Sin programa activo, solo las hechas.
- **Barra:**
  - Lo hecho va en `accent`; lo que queda hasta lo previsto, en contorno
    `accent50`, porque es lo que falta por hacer, no una falta.
  - Una marca `text` señala lo previsto, sobre una rejilla de 10 en 10 series.
  - El `orange` solo sale en semanas ya acabadas por debajo de lo previsto; en la
    semana en curso nunca, porque a mitad de semana todo está por debajo.
- Los grupos hechos sin estar previstos van al final.
- Se enseñan 4 grupos y «Ver los N grupos» despliega el resto.
- Se quitan la banda de 10-20 y su texto (`load.groupsHint`).

**Probar T11-07**

- [ ] Un miércoles con 2 de 3 sesiones hechas: cada grupo con su «hechas/previstas», lo que falta en contorno, nada en naranja.
- [ ] Un ejercicio de un grupo que no estaba en el plan sale al final, sin marca.
- [ ] Sin programa activo, solo las hechas.

## 11. T11-08 — El calendario vuelve al Historial

En Carga ocupaba mucho para lo que decía, y lo que de verdad cuenta es cuándo se
entrenó, no un mapa de esfuerzo.

- `LoadCalendar` sale de `LoadTab` y vuelve a la cabecera del Historial
  (`HistoryList`), donde vivía antes de U07 §5.1. Va también en el Historial de la
  ficha de cliente, que **no es `HistoryList`**: es el `ScrollView` propio del tab
  `history` de `ClientsScreen`. Se monta en los dos sitios.
- **Recibe por prop** `log`, `allExercises` y `fallbackBodyWeight` en vez de leer
  `workoutLog` del store. Así se arregla que en la ficha de cliente pinte el
  historial del entrenador (§1). En la ficha va el log entero del cliente
  (`clientBaseLog`), no el filtrado por alcance y periodo de la lista.
- Sigue teñido por la carga interna. Si el log no tiene ninguna sesión con sRPE, se
  tiñe por la externa, para que no salgan todos los días en contorno.

**Probar T11-08**

- [ ] Progreso › Historial: el calendario arriba, con tus sesiones.
- [ ] Ficha de un cliente › Historial: el calendario con las sesiones del cliente, no las tuyas.
- [ ] Con un historial sin sRPE, los días entrenados salen teñidos.

## 12. T11-09 — VOLUMEN de Ejercicios por semanas

La tarjeta VOLUMEN de Progreso › Ejercicios (`ProgressTab.jsx`) compara hoy el
tonelaje de la última sesión del periodo con el de la primera, y el subtítulo
compara la última con la anterior. Si se compara una Pierna con un Torso, salen
variaciones enormes.

- **Número:** volumen medio por bloque de 7 días de las últimas 4 semanas, contra
  las 4 anteriores, en % (mismos bloques que §3). Sin datos en las dos ventanas: «—».
  Se calcula sobre el log filtrado por alcance (programa o todo), **no** recortado
  por el periodo: con 1M elegido no existirían «las 4 anteriores».
- **Subtítulo:** «vs mes anterior».
- **Ficha `volumeTrend`:** «Volumen medio por semana de las últimas 4 semanas,
  comparado con las 4 anteriores.» Se quita el aviso de «son dos puntos».
- El tonelaje sigue saliendo de `recapStats` (una sola definición de volumen).

**Probar T11-09**

- [ ] Con historial de varias semanas alternando sesiones de pierna y torso, VOLUMEN da una cifra razonable (no ±60 %) y el subtítulo dice «vs mes anterior».
- [ ] Tocar la tarjeta: la ficha explica la comparación nueva.

## 13. T11-10 — Datos con sentido: casos y bordes con test

- Los casos del visor de carga como tests con literales, uno por persona y
  situación: sin sRPE, falta un día, viernes antes de entrenar, descarga,
  estancado, bloque duro.
- Los bordes que dejó abiertos la tabla del oráculo de I01 (módulo 6,
  `docs/auditoria-tests/tablas-de-casos.md`), cada uno con su decisión escrita
  aquí y su test:
  - sesión de duración 0 o sin series;
  - semana con sesiones pero sin sRPE (hueco, no 0);
  - referencia de 1RM (6 semanas) frente a la ventana de rendimiento (4);
  - límites de 7 y 28 días y la regla de «si hoy no hay sesión, acaba ayer».
- Las funciones nuevas con su test: monotonía y strain con su base, esfuerzo vs
  carga en %, RPE medio por ejercicio, fuerza por ejercicio, volumen por semanas.
- Fijar el umbral de «sube / baja / plano» de §7 mirando el visor, y documentarlo
  en la ficha.
- Ningún `NaN`, `Infinity` ni negativo imposible en lo que se pinta.

## 14. Fuera de esta spec

- **Carga por grupo muscular.** Descartada: reparte la carga externa (reps ×
  intensidad relativa) y sale casi igual que las series por grupo. Al dividir por el
  1RM, una serie pesada de 5 pesa menos que una de 12. El esfuerzo por grupo
  no existe, porque el sRPE es de la sesión.
- **Un aviso por cliente** en la lista del entrenador («No viene», «Se está
  pasando», «Plano»), enlazado con C02 (triaje, aparcada). Lo pinta la maqueta
  vieja `carga-semanal.html`.
- **Abrir la ficha de cliente directamente en Progresión › Carga.** Hoy entra por
  Programas y el panel abre en Ejercicios. Queda pendiente de decidir.
- **Coste por sesión:** comparar cada sesión con la misma sesión de otras semanas.
- **«Tu zona» de series por grupo** (volumen adaptativo) con historial suficiente.

## 15. Fases

| Fase | Qué | Toca | Coste |
|---|---|---|---|
| T11-01 | Panel de tres tarjetas, relleno, periodo único guardado, textos en tercera persona, props del sujeto (§3) y cifra de carga única | `LoadTab.jsx`, `ProgressPanel.jsx`, `ClientsScreen.jsx`, `StatsScreen.jsx`, `trainingLoad.js`, store, locales | 🟠 |
| T11-02 | Sin sRPE: carga externa y tarjeta de esfuerzo vacía | `LoadTab.jsx`, locales | 🟡 |
| T11-03 | Lectura del estado, monotonía y strain | `LoadTab.jsx`, `trainingLoad.js`, locales | 🟡 |
| T11-04 | Esfuerzo: semanas/sesiones, esfuerzo vs carga con cifras | `LoadTab.jsx`, `trainingLoad.js`, locales | 🟡 |
| T11-05 | RPE medio por ejercicio | `LoadTab.jsx`, `trainingLoad.js` | 🟡 |
| T11-06 | Fuerza a 4 semanas y por ejercicio | `LoadTab.jsx`, `trainingLoad.js` | 🟡 |
| T11-07 | Series por grupo contra lo previsto | `LoadTab.jsx` (+ plantillas de la etapa) | 🟡 |
| T11-08 | Calendario al Historial (propio y ficha), con log, ejercicios y peso por prop | `LoadCalendar.jsx`, `HistoryList`, `ClientsScreen.jsx` | 🟢 |
| T11-09 | VOLUMEN por semanas | `ProgressTab.jsx`, locales | 🟢 |
| T11-10 | Casos y bordes con test | `trainingLoad.test.js` | 🟡 |

Orden: T11-01 primero (es el armazón); T11-08 y T11-09 son independientes.
