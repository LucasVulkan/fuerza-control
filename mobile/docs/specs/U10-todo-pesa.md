# Spec — Todo pesa: movimiento y gráficos con tema

> Tema: ui
> En corto: Lo que hace que la app se sienta de gimnasio y no un formulario: casillas que se despliegan en una regla al arrastrarlas, un metrónomo para el tempo, un descanso que avisa al final, la rampa del calentamiento, la tarjeta de hoy que se convierte en la cabecera del entreno y la ola de etapas del planificador.
> Inicio: 2026-10-03
> Fase U10-01 · hecho · Casillas que se despliegan en una regla (KG, reps, RPE) · §2 · antes U43
> Fase U10-02 · aparcado · Metrónomo de tempo · §3 · antes U44
> Fase U10-03 · pendiente · Los últimos segundos del descanso vibran y laten · §4 · antes U45
> Fase U10-04 · pendiente · Rampa del calentamiento en el Workout · §5 · antes U46
> Fase U10-05 · pendiente · Escalera del calentamiento en el editor · §6 · antes U47
> Fase U10-06 · pendiente · De la tarjeta de hoy a la cabecera del Workout · §7 · antes U48
> Fase U10-07 · aparcado · Ola de etapas en el planificador · §8 · antes U49
> Fase U10-08 · aparcado · La ola como vista previa al añadir etapas · §9 · antes U50
> Fase U10-09 · aparcado · Plan frente a real en Carga · §10 · antes U51
> Fase U10-10 · hecho · La regla, más precisa: vibración por enteros, partida y objetivo, ±, bordes que desplazan, cancelar · §2.6
> Fase U10-12 · hecho · La regla también en las casillas de segundos · §2.8
>
> Estado: **4-oct-2026: para la V1 solo quedan U10-03 a U10-06; U10-02, U10-07, U10-08 y U10-09 se aparcan** (decisión del usuario). **Spec cerrada el 30-sep-2026**. D1 y D2 cerradas
> el mismo día; queda abierta D3 (la tira de tramos del metrónomo, §1.4), que
> se resuelve al implementar U10-02. Sale de una conversación de exploración con el usuario sobre cómo
> hacer la app «menos sobria»: se enseñaron maquetas de unas quince ideas y
> estas nueve son las que sobrevivieron. Maqueta de referencia:
> [`docs/mockups/todo-pesa.html`](../mockups/todo-pesa.html). Orden
> recomendado: U10-01 → U10-03 → U10-02 → U10-04 → U10-05 → U10-06 → U10-07 → U10-08 → U10-09. U10-09 no
> tiene prioridad (palabras del usuario).

---

## 1. Contexto y decisiones cerradas

### 1.1 El lenguaje: «todo pesa»

Cada animación de esta spec sigue las mismas cuatro reglas. Son las que evitan
que la suma de nueve piezas se lea como una feria:

1. **Las cosas caen y se asientan, no rebotan.** Curva por defecto
   `Easing.bezier(0.35, 0, 0.15, 1)`. Nada de muelles con rebote visible en
   piezas grandes. Un muelle solo en piezas pequeñas (un botón que se hunde) y
   con amortiguación alta.
2. **Lo vertical es el valor.** Una cifra que sube rueda hacia arriba y una que
   baja rueda hacia abajo, **sea cual sea el sentido del dedo**. Es como un
   cuentakilómetros: rueda igual gires la rueda hacia donde la gires.
3. **El lima es «lo que toca ahora»**: la marca de la regla, la fase del tempo
   en curso, la serie activa. No se gasta en decoración.
4. **Vibraciones con significado, siempre las mismas:**
   - `Haptics.selectionAsync()` → cada paso de un valor (la regla).
   - `ImpactFeedbackStyle.Light` → cambio de fase o cuenta atrás.
   - `NotificationFeedbackType.Success` → algo terminó.

Toda animación nueva va con Reanimated (`useSharedValue`, `withTiming`,
`entering`/`exiting`, `layout`), no con `Animated` de RN core. Ver la memoria
del proyecto (Reanimated adoptado; no mezclar driver nativo y JS en el mismo
nodo). **Nada anima en el montaje inicial de una pantalla**, salvo que la fase
diga lo contrario. Es la misma regla que ya siguen `SegmentedControl` y la
cabecera del Workout.

### 1.2 Decisiones del usuario

- **KG, reps y RPE:** se ajustan con el mismo gesto horizontal de hoy, pero la
  casilla se despliega sobre toda la fila en una **regla fija** con una marca
  que sigue al dedo (opción «2» de las maquetas). La regla que pasa bajo una
  marca fija se descartó: obliga a elegir entre «sigue al dedo» y «derecha es
  más», y las dos se sienten mal.
- **Paso del peso:** sigue siendo el de hoy, 0,5 kg o 1 lb
  (`useWeightUnit().scrollStep`).
- **Rango del peso:** unos ±20 kg alrededor del peso de partida, con una regla
  fija que no se amplía (§1.4, D1). Revisado el 3-oct: 16 kg a lo ancho (§2.3). El espaciado se afina después, en el móvil.
- **Rango de reps:** estrecho y de enteros («te sueles mover entre 5 y 15»),
  para que se vean todos los valores y se atine sin esfuerzo.
- **RPE:** igual que las reps, enteros y todos a la vista.
- **Cifras:** mientras arrastras manda la burbuja; la casilla no cambia hasta
  soltar. Así se evita el «borrón» de cifras que se amontonaban al ir rápido.
  (El rodar de la cifra al soltar se quitó el 3-oct: «no hace falta».)
- **Tempo:** barra cargada con discos repetidos (no una pirámide de un disco de
  cada) y con el extremo de la barra visible. **Lo que sube y baja es la
  pesa**, sin fondo que se mueva, sobre una **línea de suelo**. Más adelante
  quizá lleve una ilustración pequeña (una botella de agua o similar); queda
  fuera de esta spec. **Texto fijo arriba** (D2). Se abre tocando el propio
  tempo de la tarjeta, con un pequeño metrónomo delante. Cómo se enseña el
  progreso de la repetición está abierto (D3).
- **Calentamiento en el Workout:** variante **Relleno, sin banda de fondo**.
  Cada fila lleva detrás una barra del % del peso de trabajo, pintada
  directamente sobre la tarjeta, sin hueco oscuro debajo; las filas juntas
  forman la rampa. Sin fila S1 discontinua: el título SERIES ya separa.
- **Calentamiento en el editor:** escalera de pasos hasta el peso de trabajo,
  con el número de series elegido en un `SegmentedControl`.
- **Transición a la cabecera:** aprobada tal cual («me gusta mucho»).
- **Ola de etapas:** va en los dos sitios, en la pantalla del planificador y en
  la hoja de añadir etapas. Siempre con datos reales de cada etapa, también
  después de editarla. **La métrica de intensidad hay que afinarla antes de
  implementar** (§8.2).
- **Plan frente a real:** idea del usuario: no guardar fechas de etapa, solo
  **comprobar al cerrar cada semana si se hizo lo planificado**. Sin prioridad.

### 1.3 Descartado (con motivo, para no volver a proponerlo)

| Idea | Motivo |
|---|---|
| Barra con discos en el descanso («quita 5, pon 10») | La app no sabe qué pesos distintos vas a usar: salvo el calentamiento y Por esfuerzo, todas las series van al mismo peso, así que diría «sin cambios» casi siempre. Solo se queda el aviso del final (U10-03) |
| Discos dentro de la casilla KG | Ilegible en una casilla pequeña, sobre todo con tres casillas (KG, reps, RPE) |
| Tira de discos fija en la tarjeta | Ocupa espacio y aporta poco sin pesos distintos por serie |
| Las pastillas del resumen entran una a una al plegarse la tarjeta | Un efecto de entrada más, sin significado |
| Mapa muscular | Descartado por ahora (coste de ilustración) |
| Tempo con anillo | La barra chocaba con el anillo arriba y abajo |
| Tempo con un fondo que sube y baja | Se entiende mejor si lo que se mueve es la pesa |
| Rampa del calentamiento como «hilo» bajo cada fila | El usuario prefirió el relleno |
| La semana como una barra con discos, RPE como reps en reserva, recap «hoy frente a la última vez», línea de tiempo de la sesión | «No me convencen» |
| «Así va a progresar» en el editor de ejercicio | Útil sobre todo para el entrenador. Queda como idea, sin fase |

### 1.4 Decisiones

**D1 · Precisión del peso en la regla — CERRADA (30-sep): regla fija, sin
ampliar.** ±20 kg de 0,5 en 0,5 (±40 lb de 1 en 1). Descartadas por ahora: que
la regla se afine al dejar el dedo quieto, y quedarse solo con ±5 kg.

Aviso conocido: son 80 posiciones en unos 300 dp de fila, menos de 4 dp cada
una. El usuario lo acepta: «ya afinaremos el espaciado más adelante». Por eso
**el rango y los píxeles por paso son una constante en un solo sitio**
(`scrubWindow`, §2.4), para ajustarlos en el móvil sin tocar nada más.

**D2 · Texto del metrónomo — CERRADA (30-sep): fijo arriba.** Además, la pesa
lleva una **línea de suelo** debajo de su posición más baja: es donde se apoya
al final de la bajada.

**D3 · Cómo se enseña el progreso de la repetición — ABIERTA (bloquea U10-02).**
La tira de tramos proporcionales no convence al usuario: con algunos tempos se
aplasta. Con `31X0`, por ejemplo, la X ocupa un 11 % del ancho y su rótulo no
cabe. Se piensa una solución al implementar U10-02. Hasta entonces la maqueta
conserva la tira solo como marcador de hueco.

---

## 2. U10-01 — Casillas que se despliegan en una regla

### 2.1 Hoy

`SetRow.jsx`, `InputCell`: un `PanResponder` horizontal (`H_THRESH = 12`, se
activa con `|dx| > 2·|dy|`) suma o resta `scrollStep` cada `STEP_PX = 8` px de
arrastre relativo. Al activarse se ve el borde lima (`inputAccentOverlay`) y los
chevrones. Tocar sin arrastrar abre el teclado. Pasos actuales:
- peso: `weightScrollStep` (0,5 kg / 1 lb);
- reps: 1;
- tiempo: 5;
- RPE: 1 (el valor por defecto de `InputCell`).

### 2.2 Qué cambia

Solo el **peso, las reps y el RPE**. El tiempo mantiene el gesto de hoy (ver
§2.5). El mismo `SetRow` sirve las filas de dropset (`D1`…), que heredan el
cambio sin tocar nada.

0. **Es una preferencia (3-oct, decisión del usuario).** El gesto de hoy no se
   borra: en Ajustes › Preferencias, una fila «Regla al deslizar» con un
   `Switch` (como «Pestañas PRO») guarda `profile.scrubRuler`. Por defecto
   **activada** (`?? true`). Apagada, `InputCell` hace exactamente lo de hoy
   (cifra que cambia en la casilla, pivote en el entero, chevrones, sin regla).
   Todo lo que sigue es el modo encendido.

1. **Se activa igual que hoy**: mismo umbral y misma condición horizontal.
   Añadir `onPanResponderTerminationRequest: () => false` para que el
   `ScrollView` no robe el gesto a media regla.
2. **Al activarse**, `SetRow` pinta una capa encima de la fila, que la tapa
   entera (de la etiqueta S1 al ✓). La capa crece desde el rectángulo de la
   casilla hasta el de la fila en 180 ms (curva de §1.1): anima `left` y
   `width` con Reanimated a partir de medidas de `onLayout` de la casilla y de
   la fila.
   - Fondo casi negro (`th.colors.bg`, o un paso más oscuro si hace falta
     contraste).
   - Borde fino en `th.colors.accent` y radio `GRID.RADIUS`.
   - Tapa REPS y RPE mientras dura el gesto, que es justo lo que se quiere:
     solo se edita un valor.
3. **Dentro de la capa, una regla:**
   - rayas largas y cortas en `mutedLight` (la longitud ya las distingue) y
     puntos en `muted`, con números;
   - una **marca lima vertical que está siempre bajo el dedo** (3-oct, el
     usuario: «la marca tiene que salir donde tienes el dedo»). La x de la
     marca es la del dedo en la fila, recortada a los extremos de la regla, y
     se ajusta al paso más cercano. El valor es el de la regla en esa x;
   - un número de la regla se ilumina **solo cuando el valor es exactamente
     ese número**. Iluminar el más cercano confundía: en 57,5 se encendía el
     60 y parecía que ya estabas ahí.
4. **Burbuja** por encima de la fila:
   - fondo `accent`, texto `onAccent`, `textStyles` de título;
   - lleva el valor con su unidad, **siempre detrás** («102.5 kg», «8 reps»,
     «8 RPE», «45 s»; el RPE delante quedaba al revés y descentrado), con el
     mismo separador decimal que la casilla;
   - **ancho fijo**, el que pide el caso más largo (tres cifras, decimal y
     unidad: «999.5 kg»/«999 lb»), para que no cambie de tamaño al pasar de
     99,5 a 100 ni al aparecer el decimal;
   - **las cifras pivotan en las unidades**: la cifra de las unidades queda
     siempre en el mismo sitio de la burbuja; las decenas y centenas crecen
     hacia la izquierda y el decimal y la unidad cuelgan a la derecha. Así el
     número se lee al pasar y no salta;
   - centrada sobre la marca y recortada para no salirse de la tarjeta;
   - hace falta porque el dedo tapa la marca.
   - Ojo: la tarjeta tiene `overflow: 'hidden'`. Encima de S1 están las
     cabeceras de columna, que dejan hueco dentro de la tarjeta; comprobarlo con
     el calentamiento plegado y sin él.
5. **Cada cambio de valor** → `Haptics.selectionAsync()`.
6. **Al soltar:**
   - se guarda el valor (el `onChangeText` de siempre);
   - la capa vuelve al tamaño de la casilla en 180 ms y **a la vez se
     desvanece**: el número nuevo de la casilla se ve desde que la regla
     empieza a encoger, no cuando ha terminado (3-oct);
   - la cifra de la casilla cambia sin animación. El rodar de la cifra se
     quitó el 3-oct («no hace falta que la cifra ruede»).
7. **La cifra de la casilla, centrada entera** (decimal incluido). Hoy se
   centra solo la parte entera y el decimal cuelga en una caja de 36 px, porque
   la cifra cambia en la casilla mientras arrastras. Con la regla la casilla
   no cambia durante el gesto (manda la burbuja), así que se centra el texto
   completo. Solo en el modo regla; el modo de hoy conserva su pivote.

### 2.3 Rangos

Dos clases de regla (revisado el 3-oct):

- **Anclada al dedo (peso y reps).** La escala es fija (pasos a lo ancho de
  la regla) y el valor de partida queda **justo bajo el dedo** al activarse:
  el gesto empieza sin cambiar el valor y la marca sale donde está el dedo. Lo
  que cabe a cada lado depende de dónde esté el dedo en la fila.
  **El 0 nunca queda dentro de la fila** (3-oct, el usuario): si anclar el
  valor bajo el dedo dejaría el 0 a la derecha del borde izquierdo de la regla
  (valor bajo o 0, hueco vacío a la izquierda), la regla se pone con el **0 en
  el extremo izquierdo** y pasa a ser absoluta, como la del RPE: el valor es
  el de bajo el dedo y salta a él al activarse (con 0 kg y el dedo en la
  casilla KG, a unos 5-6 kg). Con un valor bajo ese salto no molesta.
- **Fija y absoluta (RPE).** 1 a 10 a lo ancho de toda la regla. El valor es
  el número bajo el dedo, también al activarse: se llega a cualquier RPE de un
  solo gesto, esté vacío o no.

| Campo | Regla | Pasos a lo ancho | Paso | Marcas |
|---|---|---|---|---|
| Peso | Anclada al dedo. 0 a la izquierda | 32 (16 kg), con dos y con tres cifras / 55 (55 lb); 36 (36 lb) si la regla llega a 100 | `scrollStep` (0,5 kg / 1 lb) | Grande cada 2 kg, mediana cada 1 kg y un punto en los 0,5 (`| . : . |`); lb: grande cada 5, mediana cada 1 |
| Reps | Anclada al dedo. 0 a la izquierda | 12 (13 enteros) | 1 | Todas grandes |
| RPE | Fija, 1 a 10 | 9 | 1 | Todas grandes |

**Números:** van sobre las marcas grandes, pero solo los que caben: se usa el
menor múltiplo del intervalo de las marcas grandes cuya separación en pantalla
llega a un mínimo de píxeles (constante). Con 50 pasos en unos 300 dp, cada 2
kg son ~22-24 dp. Todos los números van en `labelStrong` y a la misma altura,
y en el peso **alternan blanco y gris** (3-oct, el usuario): 20 blanco, 22
gris, 24 blanco… Blancos los múltiplos de 4 kg (de 10 lb). Así se leen cada 2
kg sin amontonarse. El número que es exactamente el valor va en lima.
(Probado y descartado: alternar grande arriba y pequeño abajo, «queda feo».
Aparcado: un efecto lupa bajo el dedo; el dedo tapa justo esa zona.)

**Tres cifras:** si la regla llega a 100, la escala del peso pasa a 16 kg (36
lb) a lo ancho: menos números y más separados, para que «100», «102»… quepan.
A esos pesos no se ajusta de 20 en 20. Marcas y números van en múltiplos absolutos (84, 86, 88…), no
relativos al valor.

El valor de partida es el escrito o, si la casilla está vacía, el valor
fantasma (`prevValue`). Es lo mismo que ya usa `localValueRef` hoy. En reps se
redondea al entero. Los valores van por la **rejilla absoluta** de `step`
(3-oct): con 55,9 en la casilla la regla va por 55,5 · 56 · 56,5, no por 55,4 ·
56,4. El valor de partida, aunque esté fuera de la rejilla, se mantiene
mientras el dedo no se aleje medio paso: sin moverlo, no cambia.

Cambio sobre D1 (3-oct): la regla del peso ya no es de ±20 kg. Son 16 kg a lo
ancho de la fila, igual con dos que con tres cifras: es una herramienta de
**ajuste fino**, con un dedo, mientras entrenas (el usuario: «tiene que ser
preciso»; quedarse corto solo pesa la primera vez). Con el dedo en la casilla
KG, a la izquierda de la fila, hay menos regla hacia abajo (unos 3 kg) que
hacia arriba (unos 13).

### 2.4 Dónde va el código

- `SetRow.jsx`:
  - el estado del gesto (`{ field, start, value }`) sube de `InputCell` a
    `SetRow` con tres avisos (`onScrubStart`, `onScrubMove`, `onScrubEnd`);
  - `SetRow` pinta la capa;
  - `InputCell` conserva la apertura del teclado.
- Componente nuevo `components/workout/ScrubRuler.jsx`: la capa, la regla y la
  burbuja.
- Funciones puras nuevas en `utils/scrubScale.js`: la regla de un campo a
  partir del valor de partida, la x del dedo en la fila y el ancho de la fila
  (`min`, `max`, `step`, px por paso, origen, marcas y cada cuánto van los
  números), la x de un valor y el valor en una x. Los rangos de §2.3 son
  constantes al principio del fichero: es el mando para afinar el espaciado
  en el móvil (D1). Con su test: anclaje bajo el dedo, suelo 0, recorte a los
  extremos, RPE absoluto, libras y el aclarado de números.

### 2.5 Fuera de alcance

- ~~Casillas de tiempo~~: entran en U10-12 (§2.8).
- El editor de ejercicio y el de bloques: no tienen este gesto.

**Probar U10-01**

- [x] Arrastrar a la derecha la casilla KG de la serie activa: la capa crece
  desde la casilla hasta cubrir la fila, la marca sale bajo el dedo con el
  peso actual (sin cambiarlo) y sigue al dedo; derecha es más.
- [x] Cada paso vibra suave. La burbuja enseña el valor con su unidad y no se
  sale de la tarjeta en S1, ni con calentamiento ni sin él.
- [x] Al soltar, la capa vuelve a la casilla y la cifra cambia sin rodar.
- [x] Peso: 16 kg a lo ancho, también con tres cifras, marcas
  grandes cada 2 kg, medianas cada 1 kg y un punto en cada 0,5, de 0,5 en 0,5. Los números, iguales
  y a la misma altura, alternan blanco y gris y no se pisan, tampoco con tres
  cifras.
  Apuntar si cuesta atinar o si los números se amontonan, para afinar las
  constantes de `scrubScale.js` (D1).
- [x] Con 55,9 en la casilla, al deslizar el valor pasa por 55,5 · 56 · 56,5
  (no por 55,4 · 56,4); soltar sin mover el dedo deja 55,9.
- [x] Reps: la marca sale bajo el dedo con las reps actuales y se atina sin
  esfuerzo.
- [x] Con 0 kg (o reps muy bajas) el 0 queda en el extremo izquierdo de la
  regla, sin hueco vacío, y el valor salta al de bajo el dedo al empezar.
- [x] Al soltar, el número nuevo se ve en la casilla en cuanto la regla empieza
  a encoger.
- [x] RPE: la regla va de 1 a 10 a lo ancho de la fila. Al empezar, la marca
  sale bajo el dedo (también con el RPE vacío) y se llega a cualquier número
  de un solo gesto.
- [x] En 57,5 no se ilumina el 60: un número se pone en lima solo cuando el
  valor es exactamente ese.
- [x] Mientras arrastras, la lista no hace scroll aunque el dedo se desvíe en
  vertical.
- [x] Tocar sin arrastrar sigue abriendo el teclado.
- [x] Las filas de dropset (D1…) se comportan igual.
- [x] En libras: pasos de 1 lb y rango en lb.
- [x] La burbuja no cambia de ancho al pasar de 99.5 a 100 ni al aparecer el
  decimal, y la cifra de las unidades no se mueve dentro de ella.
- [x] Con la regla, la cifra de la casilla se ve centrada entera, decimal
  incluido.
- [x] Ajustes › Preferencias › «Regla al deslizar» apagado: el gesto vuelve a
  ser el de antes (la cifra cambia en la casilla, pivote en el entero, sin
  regla ni burbuja). Encendido otra vez: regla.

### 2.6 U10-10 — La regla, más precisa

Salió de probar U10-01 (3-oct). La regla es una herramienta de **ajuste fino,
con un dedo, mientras entrenas**: estas cinco piezas la hacen más precisa y
más fácil de usar sin mirar. El usuario las aprobó todas.

1. **Vibración por escalones.** Cada paso sigue vibrando, pero con dos
   fuerzas:
   - paso «fino» → `Haptics.selectionAsync()` (el de hoy);
   - paso «redondo» → `Haptics.impactAsync(ImpactFeedbackStyle.Light)`, un
     poco más fuerte.
   **Solo vibra si vas despacio** (3-oct): con el dedo a más de
   `SCRUB_HAPTIC_MAX_VX` (0,15 px/ms, de `gs.vx`) los pasos no vibran; al
   recorrer la regla deprisa sobra, al afinar es cuando ayuda. El avance por
   los bordes (punto 4) vibra siempre: el dedo está quieto. Más adelante el
   usuario podrá desactivar la vibración en Preferencias (3-oct, sin fase).
   Redondo = múltiplo de `strongEvery`: **1 kg** (los medios kilos son finos),
   **5 lb**. En reps y RPE cada paso ya es una unidad: todos finos. Es una
   constante más de `scrubScale.js`. (Excepción consciente a §1.1, donde
   `Light` era «cambio de fase»: aquí el usuario quiere contar kilos sin
   mirar.)

2. **Rayas de partida y de objetivo**: cortas, a la altura de la raya pequeña
   (y 33-40), de color pleno y más anchas que una raya normal (3 dp), para
   que siempre se vean; la marca, alta y encima, sigue siendo «dónde estás».
   Antes fueron pastillas en la franja baja («un poco invisibles») y luego
   líneas finas a toda la altura («no me termina de gustar») (3-oct):
   - **partida**: el valor de la casilla al empezar el gesto, en lima
     (`th.colors.accent`). Sirve para volver a él si te pasas;
   - **objetivo**: el valor fantasma de la casilla (`prevValue`), que es lo
     que la progresión, el plan o el entrenador piden hoy. En azul
     (`th.colors.blue`) si viene del entrenador (`prevSource === 'coach'`), en
     blanco (`th.colors.text`) si no. Solo se pinta si es distinto de la partida
     (con la casilla vacía, partida y objetivo son el mismo valor: una sola
     marca, la de objetivo);
   - si una de las dos cae fuera de la regla, se pinta pegada al borde por el
     que queda, a media opacidad: indica hacia dónde está.

3. **El cambio en la burbuja.** Debajo del valor, en una segunda línea
   pequeña (`labelStrong`, `onAccent` sin apagar: en `micro` apagado apenas se
   leía sobre lima), la diferencia con la partida:
   «+2.5», «−1», en la unidad del campo. Con diferencia 0 la línea queda
   vacía pero **reserva su sitio**: la burbuja no cambia de alto. La
   diferencia también pivota en las unidades, como el valor (§2.2 punto 4).
   El usuario: la progresión ya habla así («sube a 57 (+2.5)»).

4. **Bordes que desplazan la regla.** Hoy la regla solo llega a lo que cabe
   en la fila (con 16 kg y el dedo en KG, unos 3 kg hacia abajo).
   - **Indicador**: al acercar el dedo a un borde de la regla aparece, en ese
     borde y dentro de la capa, un indicador lima (un chevrón hacia fuera o
     un degradado estrecho) que **va cobrando intensidad** según te acercas:
     opacidad de 0 a 1 entre 56 y 24 dp del borde de la fila.
   - **Desplazamiento**: a menos de 24 dp del borde, la regla avanza sola
     hacia ese lado mientras el dedo sigue ahí, aunque no se mueva. Avanza
     un paso cada cierto tiempo, más deprisa cuanto más cerca del borde
     (de ~180 ms por paso al entrar a ~60 ms pegado al borde). Cada paso
     cambia el valor bajo el dedo y vibra como cualquier otro (punto 1).
   - Desplazar es mover los valores bajo la marca: `min`, `max` y
     `originValue` suben o bajan un paso; `originX` no cambia. El 0 sigue
     siendo el suelo: hacia abajo se para cuando `min` llega a 0.
   - Solo en las reglas que no lo enseñan todo: peso y reps. El RPE (1-10
     siempre a la vista) no se desplaza ni tiene indicador.
   - Constantes (zonas y velocidades) arriba de `scrubScale.js`.

5. **Cancelar.** Si con el gesto en marcha el dedo sube más de 48 dp por
   encima de donde empezó (`gs.dy < −48`), se entra en modo cancelar:
   - la marca vuelve a la partida y la regla se apaga (opacidad ~0,4);
   - la burbuja enseña el valor de partida y, en la línea del cambio,
     «Cancelar» (i18n: `workout.scrubCancel`, es «Cancelar» / en «Cancel»);
   - una vibración `Light` al entrar;
   - soltar ahí no guarda nada; volver a bajar el dedo retoma el gesto
     normal, con el valor bajo el dedo.

**Probar U10-10**

- [x] Peso: cada medio kilo vibra suave y cada kilo entero algo más fuerte.
  En libras, más fuerte cada 5 lb. Reps y RPE, todos suaves. Moviendo el dedo
  deprisa no vibra; al ir despacio, sí.
- [x] Con un objetivo en gris (casilla vacía, plan o última vez), la regla
  enseña una raya corta y ancha blanca en él; con objetivo del entrenador,
  azul. Con un valor escrito distinto del objetivo se ve también la de
  partida, en lima. Siempre se ven y se distinguen bien de la marca.
- [x] Si el objetivo cae fuera de la regla, su marca sale pegada al borde de
  ese lado, más tenue.
- [x] La burbuja enseña debajo «+2.5» / «−1» respecto a la partida, y no
  cambia de alto con diferencia 0.
- [x] Al acercar el dedo a un borde aparece el indicador y se va
  intensificando; pegado al borde, la regla avanza sola, más deprisa cuanto
  más cerca. Hacia abajo se para en 0. El RPE no se desplaza.
- [x] Subir el dedo por encima de la fila: la regla se apaga y la burbuja
  dice «Cancelar»; soltar ahí deja el valor como estaba. Volver a bajar el
  dedo retoma el ajuste.

### 2.7 U10-11 — movida a U11-02

El 4-oct-2026 pasó a [U11-preferencias-ui.md](U11-preferencias-ui.md) §3 (Preferencias de
UI), con su texto. El código U10-11 no se reutiliza.

### 2.8 U10-12 — La regla también en las casillas de segundos

3-oct, el usuario: en segundos seguía el gesto antiguo. Las casillas de tiempo
(`inputType: 'time'` y `'weight_time'`) usan la misma regla que las reps
cuando la preferencia está encendida (apagada, el gesto antiguo, que se
queda):

- anclada al dedo, de **5 en 5 s**, 50 s a lo ancho (10 pasos, ~28 dp cada
  uno), con el 0 a la izquierda si el valor es bajo y avance por los bordes;
- **todos los números a la vista**, alternando blanco (múltiplos de 10) y
  gris, como el peso;
- rejilla absoluta: un 47 se mantiene hasta mover el dedo y luego va por 45 ·
  50 · 55;
- burbuja «45 s», con la diferencia («+15 s») debajo;
- vibración: todos los pasos finos.

**Probar U10-12**

- [x] En un ejercicio por tiempo, deslizar la casilla de segundos despliega
  la regla: de 5 en 5, todos los números visibles, la marca bajo el dedo.
- [x] Lo mismo en peso + tiempo, en las dos casillas.
- [x] Con «Regla al deslizar» apagado, los segundos vuelven al gesto antiguo.
- [x] La burbuja del RPE dice «8 RPE», centrada, con la unidad detrás como
  en kg y reps.

---

## 3. U10-02 — Metrónomo de tempo

### 3.1 Datos

`exConfig.tempo`: cadena de hasta 4 caracteres `[0-9X]`. La limpia el editor
(`ExerciseEditorInline.jsx`, hoja de tempo). Notación de siempre:
excéntrica · pausa abajo · concéntrica · pausa arriba (`es.json` →
`exerciseEditor.tempoHint`). `X` = explosivo.

Función pura nueva en `utils/tempo.js`:

- `parseTempo(str)` → `[{ kind: 'ecc'|'bottom'|'con'|'top', sec }]`, o `null`
  si no son exactamente 4 caracteres válidos.
  - `X` cuenta como 0,5 s.
  - Las fases de 0 s se quitan.
  - Si todas son 0 → `null`.
- `tempoAt(phases, ms)` → `{ rep, phaseIdx, progress }`, con `rep` empezando en
  0 y `progress` de 0 a 1 dentro de la fase.
- `barPosition(phases, phaseIdx, progress)` → de 0 (arriba) a 1 (abajo):
  - la excéntrica baja de 0 a 1, lineal;
  - la pausa abajo se queda en 1;
  - la concéntrica sube de 1 a 0, con `easeInOut`;
  - la pausa arriba se queda en 0.

Tests: `'3010'`, `'31X0'`, `'0000'` → `null`, `'30'` → `null`, `'3x10'` →
válida.

**Simplificación consciente:** la repetición siempre empieza por la excéntrica,
como la notación. En un peso muerto desde el suelo o en dominadas el ciclo
empieza «a mitad», pero el ritmo es el mismo. No se modela.

### 3.2 La entrada, en la tarjeta

`ExerciseCard.jsx`, línea de objetivo: hoy el tempo va en `tempoInline`, en
gris. Si `parseTempo(exConfig.tempo)` es válido, **el propio tempo es el
disparador**:
- delante, un glifo pequeño de metrónomo (SVG de unos 11 × 12, trazo de 1,4);
- el texto `3-1-1-0` (con guiones al mostrarlo) en `accent`, con el subrayado
  punteado de `targetEditable`;
- `onPress` abre la hoja.

Es la regla del proyecto: el disparador es el dato, no un icono aparte. Si el
tempo no es válido, se queda en gris como hoy.

### 3.3 La hoja

Un `DragSheet` con título `Tempo · 3-1-1-0`. De arriba abajo:

1. **Texto**, fijo arriba (D2):
   - el nombre de la fase en grande: «Baja», «Pausa», «Sube»;
   - debajo, los segundos que quedan;
   - lima en las fases con movimiento y `text` en las pausas.
2. **La pesa, vista de frente:**
   - barra `mutedLight` de 4 px;
   - por lado, 3 discos de 20 en `text` y uno de 10 en `mutedLight`, más el
     collarín en `muted`;
   - se ve el extremo de la barra más allá del collarín;
   - se mueve en vertical entre dos topes fijos dentro de un área de unos
     180 dp, según `barPosition`;
   - **nada más se mueve.** En cada cambio de fase, un golpe de ancho del 4 %
     durante 200 ms y `Haptics Light`.
   - **Línea de suelo:** 2 px en `th.colors.border`, a todo el ancho del área.
     Queda justo bajo los discos cuando la pesa está en su posición más baja,
     así que los discos «tocan el suelo» al final de la bajada. Más adelante
     quizá se sume una ilustración pequeña (una botella de agua o similar),
     fuera de esta spec.
3. **El progreso de la repetición: pendiente de D3.** La primera propuesta era
   una tira de tramos proporcionales a los segundos, con rótulos del tipo
   «3 · baja», rellenándose en lima. No convence: con `31X0` o `2010` los
   tramos cortos se aplastan. Se decide al implementar. Lo que tiene que
   cumplir la solución:
   - se lee de un vistazo en qué fase estás y cuánto le queda;
   - no depende de que cada fase ocupe un ancho proporcional a sus segundos.
4. **Pie:**
   - «Rep 2 de 8» y un botón **EMPEZAR / PARAR**;
   - al EMPEZAR, 3 segundos de «Prepárate» con cuenta atrás y `Light` cada
     segundo;
   - las repeticiones salen de las reps de la serie activa (escritas o
     fantasma), si no de `maxReps`, si no de `minReps`, si no 8;
   - al acabarlas, `Success` y vuelve al estado inicial;
   - **no marca la serie**: el ✓ sigue siendo del usuario.

**Reloj.** El tiempo se mide por reloj, como en `ConditioningBlockCard`: se
guarda el `Date.now()` de inicio y se deriva todo con `tempoAt`. Un
temporizador de ~50 ms actualiza la fase. La posición de la pesa va en un
`useSharedValue` con `withTiming` por fase (duración = segundos de la fase), así
el movimiento corre en el hilo de UI. `expo-keep-awake` mientras corre (ya se
usa en `ConditioningBlockCard`). Cerrar la hoja lo para.

**Probar U10-02**

- [ ] Un ejercicio con tempo `3010`: en la tarjeta sale el metrónomo con
  `3-0-1-0` en lima y punteado. Sin tempo, o con un tempo incompleto, sale como
  hoy.
- [ ] Tocarlo abre la hoja. EMPEZAR → 3 s de «Prepárate» con vibración en cada
  segundo.
- [ ] La pesa baja en 3 s, sube en 1 s y no hay pausas (las de 0 s no
  aparecen). Con `3110` para abajo 1 s.
- [ ] Al final de la bajada, los discos se apoyan en la línea de suelo.
- [ ] El indicador de progreso elegido en D3 se lee de un vistazo, también con
  `31X0`. Cada cambio de fase vibra y da un golpe.
- [ ] Hace tantas repeticiones como la serie activa y termina con la vibración
  de éxito. La serie NO se marca.
- [ ] Con `X` en la concéntrica, la subida dura medio segundo.
- [ ] La pantalla no se apaga mientras corre. Cerrar la hoja lo para.

---

## 4. U10-03 — Los últimos segundos del descanso vibran y laten

`WorkoutScreen.jsx`, `RestTimerFloat`: aro de 64 dp y cuenta atrás. El fin ya
tiene su efecto en el store (`fireDone`: `Success` + toast «¡Siguiente
serie!»).

Se añade, en un efecto de `RestTimerFloat` sobre `timer.remaining`:
- cuando `remaining` pasa por 3, 2 y 1 → `Haptics Light`;
- el aro y la cifra laten: escala 1 → 1,08 → 1 en 250 ms, sobre una `View`
  envolvente con Reanimated, no sobre la que ya anima `Animated`;
- la cifra pasa a `accent` en esos tres segundos.

El 0 lo sigue marcando `fireDone`: no se duplica la vibración de éxito.

Solo pasa con la app delante. En segundo plano ya avisan las notificaciones de
siempre.

**Probar U10-03**

- [ ] Descanso de 30 s: en 3, 2 y 1 vibra suave y el aro late; la cifra se
  pone en lima.
- [ ] En 0, la vibración de éxito de siempre (una sola) y el toast.
- [ ] Saltar el descanso a los 2 s no deja ningún latido a medias.
- [ ] Deslizar para cerrar sigue funcionando igual.

---

## 5. U10-04 — Rampa del calentamiento en el Workout

`ExerciseCard.jsx`, «WarmupSection expandida». Hoy cada fila es
`C1 | 40 kg × 10 | ✓` sobre el fondo de la tarjeta, sin caja.

- **Detrás de cada fila, un relleno.** La zona de la etiqueta y el detalle (no
  el ✓) pasa a ser una caja de alto 34, igual que `warmupCheck`, **sin fondo
  propio**: se ve el `surface` de la tarjeta. Dentro, un relleno absoluto:
  - `width = pct %` del ancho de la caja, radio `th.radius.sm`;
  - el `pct` sale de `warmupStepsArr[wi].pct`, que existe siempre, aunque no
    haya peso de referencia.

  **Sin banda oscura debajo** (decisión del usuario): la rampa se dibuja
  directamente sobre la tarjeta.
- **Colores del relleno:**
  - pendiente → `th.colors.surface2`;
  - la siguiente por hacer → `th.colors.border`, un paso más claro;
    `border` es un color de línea, pero aquí vale como relleno;
  - hecha → `th.tint.accent10`, como `inputDone`.
- El texto no cambia de estilo. La etiqueta de la siguiente por hacer pasa a
  `accent`, como la serie activa.
- Al marcar o desmarcar, el color cambia con un fundido de 300 ms. **No hay
  animación de entrada al montar** (§1.1).
- **Calentamiento plegado** (`warmupCollapsed`): el ✓ de la línea resumen se
  cambia por una mini escalera de tres barras lima (SVG de 18 × 12). El resto
  de la línea no cambia.

Sin fila S1 discontinua: el rótulo SERIES ya separa (decisión del usuario).

**Probar U10-04**

- [ ] Sentadilla con calentamiento automático de 3: las filas se rellenan al
  40, 60 y 80 % y juntas se leen como una rampa.
- [ ] El relleno va directamente sobre la tarjeta, sin banda oscura debajo.
- [ ] La siguiente por hacer tiene el relleno más claro y la etiqueta en lima.
  Al marcarla se tiñe de lima con un fundido.
- [ ] Sin peso de referencia (ejercicio nuevo), las filas se rellenan igual,
  por su %.
- [ ] Con todo marcado, la línea plegada lleva la mini escalera en vez del ✓.
- [ ] Con un calentamiento a medida de 5 pasos, cada fila con su %.

---

## 6. U10-05 — Escalera del calentamiento en el editor

`ExerciseEditorInline.jsx`, hoja de calentamiento:

- **Modo `auto`:**
  - el `StepField` de series (1–4) se cambia por un `SegmentedControl`
    `1 · 2 · 3 · 4` (el «Sin calentamiento» ya lo da el control de modo que hay
    encima);
  - debajo, en lugar de la pista en texto (`warmupRampHint`), la **escalera**:
    - una columna por paso, con alto proporcional a su `pct`, en
      `th.colors.surface2`;
    - la última columna es «Trabajo» al 100 %, solo con borde discontinuo en
      `accent`;
    - encima de cada columna, su %; debajo, «× reps» en `muted`.
- **Modo `custom`:** la misma escalera, encima de las filas editables, y se
  actualiza al escribir.
- **Animación:** al cambiar de 2 a 3 series, las columnas cambian de alto y
  entran o salen con `layout` de Reanimated. Son `View`s, no SVG: se animan
  más fácil.
- Solo porcentajes. No se muestran kilos porque el editor no tiene a mano el
  peso de referencia, y en la maqueta eran de adorno.

**Probar U10-05**

- [ ] Hoja de calentamiento en Automático: series con control segmentado
  1·2·3·4 y la escalera debajo, con los % y las reps de la rampa (3 = 40·60·80,
  10·6·3).
- [ ] Al cambiar el número de series, la escalera se recoloca animada.
- [ ] A medida: la escalera sigue a las filas mientras se escriben.
- [ ] Sin calentamiento: no hay escalera.

---

## 7. U10-06 — De la tarjeta de hoy a la cabecera del Workout

### 7.1 Qué se ve

Al pulsar EMPEZAR (o CONTINUAR) en `TodayCard` (`components/SessionList.jsx`,
que se usa en Inicio y en la ficha de un cliente sin app), la tarjeta lima se
transforma en la cabecera del Workout. Cada parte se convierte en la parte
equivalente:

| En la tarjeta | Se convierte en |
|---|---|
| Caja lima (`today`, radio `md`) | Fondo de la cabecera (`headerWrap`, sobre `bg`): el lima se funde con `bg` y el radio va a 0 |
| Ceja `todayFlag` («Hoy · Semana 2») | Ceja `HeaderEyebrow` («Sesión B · 00:00», en `accent`). Fundido a mitad de recorrido |
| `todayGlyph` + `todayName` (Barlow, 28) | `headerTitle` (Inter, `heading`). La letra se desvanece y el nombre encoge y se centra |
| Raya `todayRule` (2 px, `onAccent`) | La regla segmentada `HeaderRule`: se estira a sangre y se parte en los segmentos de progreso |
| Meta y botón | Se desvanecen en los primeros 120 ms |
| — | Botón de volver y notas aparecen al final. Las tarjetas de ejercicio suben 40 dp con fundido, escalonadas 60 ms, desde los 300 ms |

Duración total unos 460 ms, con la curva de §1.1. **Sin rebote.** La vuelta
atrás (salir del Workout) mantiene la animación de siempre: no se hace la
transición inversa.

### 7.2 Cómo

1. `TodayCard`, justo antes de `onStart`:
   - mide con `measureInWindow` la tarjeta, la ceja, el nombre y la raya;
   - guarda esa foto (rectángulos, textos, letra) en un módulo nuevo
     `src/navigation/heroTransition.js` (`set`/`take`), sin store: es de un
     solo uso.
2. La navegación a `Workout` la dispara el store (`startSession` →
   `navigateTo`; comprobarlo en `useStore.js` y en `navigationRef.js`).
   Cuando hay foto pendiente, esa navegación va **sin animación de pila**.
   Recomendado: `options` del `Stack.Screen` de Workout en
   `RootNavigator.jsx` en forma de función, que lea un parámetro `hero` de la
   ruta. Hay que pasar ese parámetro en la llamada.
3. `WorkoutScreen`, al montar, hace `take()` de la foto. Si hay:
   - pinta encima una **copia tonta** en absoluto (caja, ceja, nombre y raya,
     sin lógica), con `pointerEvents="none"`;
   - la anima con Reanimated hasta los rectángulos reales de su cabecera
     (medidos con `onLayout`, sumando el inset superior);
   - mientras, la cabecera real está a opacidad 0; al terminar, aparece y la
     copia se desmonta;
   - animar el **tamaño de letra** no va en el hilo de UI. El nombre y la ceja
     se hacen con **dos capas** (Barlow de la tarjeta e Inter de la cabecera)
     que recorren el mismo camino con `translate` + `scale` y se cruzan a
     mitad.
4. Las tarjetas de ejercicio entran con `entering` (desplazamiento vertical y
   fundido), escalonadas. Solo cuando viene de la transición: al volver al
   Workout desde otra pantalla no animan.

**Riesgos que comprobar en el móvil:**
- en Android, `measureInWindow` con la barra de estado translúcida puede
  devolver la y desplazada por el inset;
- con el teclado abierto al pulsar EMPEZAR (no debería pasar), cancelar la
  transición y navegar como siempre.

**Probar U10-06**

- [ ] Inicio → EMPEZAR en la tarjeta de hoy: la caja lima sube y se estira
  hasta la cabecera; el nombre encoge hasta el título y la raya se parte en los
  segmentos de progreso. Sin salto al terminar.
- [ ] Los ejercicios suben escalonados después; el botón de volver y las notas
  aparecen al final.
- [ ] CONTINUAR una sesión en curso hace la misma transición.
- [ ] Desde la ficha de un cliente sin app (su tarjeta de hoy), igual.
- [ ] Empezar desde una fila plegada, una sesión libre o una notificación: la
  animación de siempre, sin copia fantasma.
- [ ] Salir del Workout y volver a entrar por otro camino: los ejercicios no
  vuelven a animar.
- [ ] Android e iPhone: la copia sale exactamente sobre la tarjeta (sin
  desplazamiento por la barra de estado).

---

## 8. U10-07 — Ola de etapas en el planificador

### 8.1 Qué se ve

`StagePlannerScreen.jsx`, encima de la línea de etapas, una tarjeta con la
**ola**:
- eje x: las semanas del programa, con la duración (`durationWeeks`) de cada
  etapa;
- área gris: **volumen**, series por semana;
- línea lima: **intensidad** (§8.2), entre etapas unida con curvas suaves;
- debajo del eje, una banda por etapa con su número; la de descarga en azul
  (`th.colors.blue` tintado), que ya es el color de descarga en la app;
- «estás aquí»: raya discontinua lima en la semana en curso (la de
  `stageWeekLabel`/`weeks-model`) y un punto sobre la línea.

**Enlazada con la línea de etapas:** tocar una banda despliega y marca esa
etapa (el mismo `openStageId`), y abrir una etapa marca su banda.

Leyenda mínima: «— Intensidad · ▆ Volumen · N semanas». Sin ejes numéricos: lo
que importa es la forma. Los números salen en la tarjeta de cada etapa, que ya
tiene la meta de volumen (`stageVolume`).

### 8.2 Los datos (y la intensidad, a afinar antes de implementar)

Siempre de lo **materializado**: los `sessionTemplates` de cada etapa. Así, lo
que se edite a mano después se ve.

- **Volumen de la semana** = `stageVolume(stage).sets`. Es la suma de series de
  todas las sesiones de la etapa, que son las sesiones de una semana (regla del
  proyecto: sesiones = entrenos por semana).
- **Intensidad**, propuesta: el **%1RM estimado** de lo que se pide a los
  ejercicios principales (`isKey`), con `weightForReps(1, reps, rpe)` de
  `oneRm.js`:
  - `reps` = el objetivo, media de `minReps` y `maxReps`;
  - `rpe` = `targetRpe` si el ejercicio va Por esfuerzo; si no, **8** (dos en
    recámara, el supuesto por defecto);
  - media ponderada por series de los principales de la etapa; si no hay
    principales, todos los de fuerza;
  - si las reps equivalentes pasan de 12 → se cuentan como 12, igual que
    `e1rmAtLeast`;
  - la descarga (`progressionHold: 'deload'`) no toca la cifra, porque con
    menos series la intensidad es la misma. Se ve en el volumen y en la banda
    azul.

  **Antes de implementar**, contrastar la propuesta con la semilla
  (`npm run seed`) y con las tres escaleras de `stageRx.js`, y enseñársela al
  usuario. Es el aviso de la memoria del proyecto: varias specs murieron por
  supuestos que la semilla desmentía. Dudas que resolver ahí: si el 8 por
  defecto sirve para la progresión Fija, y si la media de un rango (8–12 → 10)
  representa lo que se entrena.

Función pura nueva en `utils/stageWave.js`:
`stageWaveSeries(stages, sessionTemplates, allExercises)` →
`[{ stageIdx, weeks, sets, intensity, deload }]`. Con tests.

### 8.3 Móvil

Cabe bien hasta unas 25–30 semanas en el ancho del teléfono. Con más, la
tarjeta se desplaza en horizontal y abre centrada en la semana en curso.

**Probar U10-07**

- [ ] Planificador de un programa con 3 etapas y una descarga: la ola enseña el
  volumen y la intensidad por semana, y la descarga en azul.
- [ ] «Estás aquí» cae en la semana en curso de la etapa activa.
- [ ] Tocar una banda despliega su etapa; desplegar una etapa marca su banda.
- [ ] Editar a mano las series de una sesión de la etapa 2 y volver: la ola
  cambia.
- [ ] Una escalera de intensificación sube la línea lima; una de volumen sube
  el área.
- [ ] Un programa de una sola etapa: la ola es plana y no se rompe.

---

## 9. U10-08 — La ola como vista previa al añadir etapas

`StagePlannerScreen.jsx`, `DragSheet` «Añadir etapas», entre el paso 2
(escalera) y el 3 (etapas que se añaden):

- La misma ola de U10-07: las etapas que ya existen **atenuadas** a la izquierda,
  una raya «NUEVAS» y las que se van a añadir con banda de **borde
  discontinuo**.
- **Se actualiza al momento** al elegir escalera, cambiar semanas, series, reps
  o alcance de un peldaño (`RungCard`), añadir o quitar peldaños.
- Tocar la banda de un peldaño lo despliega (`openRung`).
- Los peldaños no existen aún: sus números salen de aplicar su `rx` sobre la
  etapa base con `applyRx(exercises, rx, allExercises)` (pura, ya existe) y
  pasarlos por `stageWaveSeries`. Mismo cálculo que tendrán al crearse, así que
  la vista previa no miente.

**Probar U10-08**

- [ ] Hoja Añadir etapas → Lineal: la ola enseña las etapas de hoy atenuadas y
  los peldaños nuevos en discontinuo, con la descarga en azul.
- [ ] Cambiar las series de un peldaño o su alcance: la ola cambia al momento.
- [ ] Intensificación sube la línea; Volumen sube el área; En blanco deja una
  etapa plana.
- [ ] Tocar la banda de un peldaño lo despliega.
- [ ] Aplicar: la ola de la pantalla (U10-07) queda con la misma forma que tenía
  la vista previa.

---

## 10. U10-09 — Plan frente a real en Carga (sin prioridad)

Pestaña Carga (`components/stats/LoadTab.jsx`), una tarjeta más: **Plan frente
a real**.
- Por semana, una barra discontinua con lo planificado y dentro una barra llena
  con lo hecho; la semana en curso en lima.
- Debajo, las bandas de etapa.
- Un selector Series / Sesiones.
- Tocar una semana enseña su detalle, por ejemplo «2 de 3 sesiones · 48 de 72
  series · Queda 1 sesión».

Llega también a la ficha de cliente del entrenador, porque `ClientsScreen`
reutiliza el mismo panel.

**Datos, según la idea del usuario: sin fechas de etapa.**
- **Al cerrarse cada semana** (lunes a domingo, el mismo `weekOne` de
  `P08-weeks-model.md`) se guarda un resumen:
  `{ weekStart, stageName, planSessions, planSets, doneSessions, doneSets }`.
  - El plan sale de la etapa activa en ese momento: sus sesiones y sus series.
  - Lo hecho, de las entradas del log de esa semana.
- El resumen se calcula la primera vez que se abre la app después de cerrarse
  la semana.
- **Límites aceptados:**
  - si la app pasa dos semanas sin abrirse, las dos se resumen con la etapa de
    ese momento;
  - la gráfica empieza vacía el día que entra la fase y se llena con el tiempo.
- **A resolver al especificar la fase:** los resúmenes se guardan en el
  dispositivo del cliente, y el entrenador tiene que recibirlos. Encaja con el
  blob que ya viaja con el historial (el mismo camino que el contador de
  progreso, ver `C03-stage-locks.md`). La alternativa es que cada dispositivo
  calcule los suyos.

**Probar U10-09**

- [ ] Tras cerrar una semana con 2 de 3 sesiones: su barra llena llega a dos
  tercios de la discontinua y el detalle dice «Faltó 1 sesión».
- [ ] La semana en curso va en lima y se actualiza al guardar una sesión.
- [ ] Series / Sesiones cambia la escala.
- [ ] En la ficha del cliente, el entrenador ve las mismas semanas que el
  cliente.

---

## 11. Fases

| Fase | Qué | Coste | Depende de | Estado |
|---|---|---|---|---|
| U10-01 | Casillas que se despliegan en una regla (§2) | 🟡 | — | hecho · 2a6104c |
| U10-02 | Metrónomo de tempo (§3) | 🟡 | D3 | pendiente |
| U10-03 | Final del descanso (§4) | 🟢 | — | pendiente |
| U10-04 | Rampa del calentamiento en el Workout (§5) | 🟢 | — | pendiente |
| U10-05 | Escalera del calentamiento en el editor (§6) | 🟢 | — | pendiente |
| U10-06 | Tarjeta de hoy → cabecera (§7) | 🟡 | — | pendiente |
| U10-07 | Ola de etapas en el planificador (§8) | 🟡 | cerrar la intensidad (§8.2) | pendiente |
| U10-08 | Ola como vista previa al añadir etapas (§9) | 🟢 | U10-07 | pendiente |
| U10-09 | Plan frente a real en Carga (§10) | 🟡 | sincronía de los resúmenes (§10) | pendiente, sin prioridad |
| U10-10 | La regla, más precisa (§2.6) | 🟡 | U10-01 | hecho · 2a6104c |
| U10-11 | Paso del ejercicio en la regla (§2.7) | 🟡 | U10-01 | movida a U11-02 (4-oct) |
| U10-12 | La regla en los segundos (§2.8) | 🟢 | U10-01 | hecho · c64c63a |
