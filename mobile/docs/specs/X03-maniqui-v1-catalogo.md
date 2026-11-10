# Spec — Maniquí v1: catálogo rápido y su seguimiento          (archivo: X03-maniqui-v1-catalogo.md)

> Tema: ejercicios
> En corto: Llenar el catálogo de maniquíes lo antes posible —primero con la animación de Blender tal cual, la lógica después— con una página que diga, ficha a ficha, si su maniquí sale de una acción, de una variante o de los ajustes de la app, y cuánto pesa todo.
> Inicio: 2026-11-09
> Fase X03-01 · pendiente · Exportador por acción, compacto, con estado y revisión · §4
> Fase X03-02 · pendiente · Tipo de base `libre`: la animación tal cual · §5
> Fase X03-03 · pendiente · Catálogo: patrones, ejercicios, variantes y fichas · §6
> Fase X03-04 · pendiente · Miniaturas del catálogo · §7
> Fase X03-05 · pendiente · Ola 1: búlgara, banca, jalón, hip thrust y flexiones · §8
> Fase X03-06 · pendiente · Ola 2: lo que cabe en las bases que ya hay · §9
> Fase X03-07 · pendiente · Bases nuevas `bench`, `split` y `floor` · §10
> Fase X03-08 · hecho · Biblioteca de manos (poses de Blender) · §11
> Fase X03-09 · hecho · Orden del .blend y guía del flujo · §12
> Fase X03-10 · hecho · Motor de demanda: momentos por articulación desde la pose real · §14
> Fase X03-11 · pendiente · Variantes genéricas por eje y su traducción a ajustes · §15
> Fase X03-12 · hecho · Fuerzas y brazos de momento a la vista · §16
> Fase X03-13 · hecho · Zonas de tracción y empuje en el mapa · §17
> Fase X03-14 · pendiente · Apoyos y carga declarados en la acción (demanda en `libre`) · §18
> Fase X03-15 · hecho · Sentadilla armónica: la tibia sigue el ritmo de la animación y la dorsiflexión manda · §19
> Fase X03-16 · hecho · Demanda relativa al ejercicio: mapa sin saturar, bíceps en las tracciones y panel sin ruido · §20
> Fase X03-17 · hecho · Capas de fuerza claras: resistencia, apoyo, brazos, equilibrio y trayectoria · §21
> Fase X03-18 · hecho · Acciones con grados anatómicos y brazos sin cifras · §22
> Fase X03-19 · hecho · Papel de cada músculo: principales y secundarios · §23
> Fase X03-20 · hecho · Jalón en la base de polea, con curvatura del tronco · §24
> Fase X03-21 · pendiente · Hacia dónde va la fuerza en los ejercicios con varios apoyos · §25
>
> Estado: **Segunda prueba del usuario, 10-nov (noche), sobre X03-15/16/17** → X03-18 (el panel nombra la acción con sus grados desde la posición anatómica, no el signo del momento; cifras de los brazos en una capa aparte) y X03-19 (músculos principales y secundarios por ejercicio: los aductores no pueden salir al 99 % en la sentadilla). Las líneas morada y verde casi superpuestas en la sentadilla están bien (es que está equilibrada). El mismo día el usuario da los datos de las acciones `libre` (objetivo, papel, apoyos, ajustes): van a X03-14 (papel y reparto entre apoyos), a X03-07 (ajustes de `bench`, `split` y `floor`), y salen X03-20 (jalón en `cable`, con balanceo y curvatura del tronco) y X03-21 (dirección de la fuerza con rozamiento, por mínimo esfuerzo). Orden: **X03-18 → X03-19 → X03-20** (no dependen de `libre`) y **X03-02 → X03-14 → X03-21 → X03-07**. **Prueba del usuario del 10-nov sobre X03-10/12/13** → tres tareas nuevas, X03-15 a X03-17 (§19–§21): gesto raro de tobillo en la sentadilla al tocar rodillas o dorsiflexión (medido), mapa que satura y bíceps apagado en la dominada, y líneas de fuerza confusas. Los mapas de calor se pintarán a mano más adelante y el rediseño de ajustes y medidas se hace con la interfaz de la app (X01). **Revisión del 10-nov-2026** (lectura de `runtime.js`, HANDOFF y `catalogo.js`): se añaden X03-10 a X03-14. La demanda (X03-10, 12, 13 y 14) está escrita para implementarse sin la conversación: fórmulas, signos, tablas, dónde va cada cosa en `runtime.js` y pruebas automáticas (§14, §16–§18); lo que el usuario pidió es que un entrenador vea qué articulación se lleva la carga y los brazos de momento al ajustar un ejercicio. Orden recomendado: **X03-02 → X03-01 → X03-11**, y la demanda cuando se quiera, **X03-10 → X03-12 → X03-13** (no dependen de lo anterior) y **X03-14** tras X03-02. Antes de la primera base nueva de X03-07, partir `evaluateInner` en una función por base (nota en §10). Lo anterior: escrita el 8-nov-2026 a partir de lo medido en la rama `feat/x01-peso-muerto` (11 acciones); el mismo día, modelo del catálogo cerrado con el usuario (§2) y maqueta [`catalogo-maniqui-2.html`](../mockups/catalogo-maniqui-2.html) (la v1, con tarjetas, no se entendía). **X03-09 hecha el 9-nov** (`blender/organizar.py`, guía `formfit-mannequin/docs/BLENDER.md`) junto con la parte de Blender de X03-08: las manos son pose assets `mano.*` (solo huesos de la mano) en tres catálogos, con cuatro nuevas por retocar (colgado prono y supino, barra en la espalda, barra de peso muerto) y `ff_status`/`ff_mano` en cada acción; export idéntico (0 de diferencia) salvo el nombre de tres ejercicios. El 9-nov, el usuario decide que el visor **no** use `ff_mano` por ahora: cada acción lleva sus dedos (posados con la biblioteca, que lo hace rápido) y las variantes sin acción propia los saca la app; X03-08 queda hecha sin tocar el visor. **9-nov (tarde), empezadas X03-03 y X03-05** a petición del usuario («añadir movimientos al catálogo para ir viendo qué necesidades surgen»; de momento sin posar variantes, pero que el catálogo diga que existen): `formfit-mannequin/catalogo.js` con 9 movimientos y 39 ejercicios (ejes y valores incluidos), la página `npm run catalogo` → `formfit-mannequin/docs/catalogo.html` con avisos, el índice `assets/index.json` que escribe el exportador (adelanto de X03-01: acciones y manos con estado, sin partir `poses.json`), y las cinco acciones de la ola 1 posadas por script en `libre`, `borrador` (con `ff_plan` = la base que tendrán), más un banco que lleva cada acción (hueso `BANCO` + caja `FF_banco`). Las `libre` no van a `poses.json` hasta X03-02. Concreta X01-11 (un JSON por acción, `ff_status`), X01-12 (la matriz) y X01-08 (miniaturas) para la v1, sin esperar a T08: la clave sigue siendo el id de la ficha.

## 1. Contexto

Hoy hay 11 acciones (9 ejercicios + 2 variantes) y cada una ha llevado su lógica en el visor antes de enseñarse. A ese ritmo, las ~230 fichas del catálogo no llegan nunca. Para una v1 hacen falta tres cosas:

1. **Poder enseñar una acción en cuanto está posada**, aunque no tenga ajustes ni equilibrio (§5).
2. **Saber en todo momento qué falta**: por ficha, de dónde sale su maniquí (§6).
3. **Que el peso no crezca con el catálogo**: hoy cada acción pesa 126–200 KB; con 150 serían 22 MB solo de poses (§3).

Las decisiones de X01 §2 siguen valiendo: ejercicio sin maniquí no enseña nada (§2.4), las variantes son poses (§2.5), una acción por movimiento y no por implemento (§2.15).

## 2. El modelo: patrón → ejercicio → variantes → fichas

Cerrado con el usuario el 8-nov-2026. Maqueta: [`catalogo-maniqui-2.html`](../mockups/catalogo-maniqui-2.html) (la v1, con tarjetas, no se entendía).

```
Patrón            conjunto de ejercicios parecidos                    Remos en polea
 └─ Ejercicio     SIEMPRE una acción de Blender (la base)             cable_row
     └─ Variantes por eje (los chips)                                 Maneral: triángulo · barra recta · cuerda
         cada valor dice de dónde sale:
           la del ejercicio   el valor con el que está posada la acción (triángulo)
           acción             su propia acción en Blender, para lo complejo (dominada supina → Chinup)
           script             la saca el visor de la acción del ejercicio (barra recta, cuerda)
           falta              aún no existe (no se enseña)
     └─ Fichas de la app      ejercicio + valores de sus ejes      cable_row · high_cable_row = polea: alta
```

- **Ejercicio o variante.** Una variante **modifica el ejercicio, no lo cambia**: agarre, implemento, pies, maneral, asistencia. Si cambia el recorrido o el apoyo, es otro ejercicio con su acción: trasera y frontal, convencional y rumano, de pie y sentado, a dos manos y a un brazo. Encaja con T08: el patrón es más o menos su *movimiento*, el ejercicio una *forma* con recorrido propio y los ejes de las variantes sus ejes que no cambian el recorrido; se usan sus nombres de eje y valor.
- **Por eje, no por combinación.** Se apunta cada valor de cada eje, no cada cruce: «supino con mancuernas» usa la acción del supino y el script pone las mancuernas. Si un cruce concreto no sale bien, se marca como **excepción** con su propia acción.
- **Los sliders no son variantes.** Anchura, profundidad, inclinación… son ajustes del tipo de base y no salen en el catálogo. Un chip que es un preajuste de sliders (pies anchos) sí es una variante de origen *script*.
- **Lo que no es ni lo uno ni lo otro** va en la ficha como nota: el tempo (`pause_squat_barbell`, `pull_up_negative`) lo pone el programa.
- **Fichas fuera**: sin maniquí a propósito (máquinas de cardio…).

**Manos.** Una acción o variante con las manos **simétricas** apunta a la mano de la biblioteca con que se posó (`ff_mano`, §11); las **asimétricas** (arquero, remo a un brazo) no apuntan a ninguna. En la app, cada acción enseña siempre sus propios dedos; las variantes sin acción propia, los que pone la app (§11).

**Nivel de lógica** de cada acción: `libre` (la animación tal cual, §5) o un tipo de base con sus ajustes (`stand`, `hinge`, `hang`, `row`, `cable`, `seat`…). Una acción `libre` se promociona cuando su base exista (cambia `ff_base` y se exporta). Una variante *script* sobre una acción `libre` todavía no funciona: la página lo avisa.

**El trabajo sale de aquí** (la página lo enseña en la columna «Siguiente», §6):

| Para el usuario (Blender a mano) | Para Claude |
|---|---|
| retocar la acción de cada ejercicio (`borrador`/`revisar` → `ok`) | crear por script la acción de cada ejercicio que falta |
| posar las variantes de origen *acción* | las variantes de origen *script* (lógica del visor) |
| posar las manos de la biblioteca | tipos de base, exportador y la página |

## 3. Cuánto cuesta (medido el 8-nov)

### 3.1 Peso

| Pieza | Hoy (11 acciones) | 150 acciones, formato actual | 150 acciones, compacto (§4) |
|---|---|---|---|
| Poses | 1,6 MB (0,47 gzip) | ~22 MB (~6 gzip) | **~2,6 MB (~0,45 gzip)** |
| Malla `mannequin.glb` | 1,8 MB (0,8 gzip) | igual | igual |
| three.js + `runtime.js` | ~0,7 MB | igual (+~10 KB por base nueva) | igual |
| Miniaturas (inicio y final) | — | — | ~1,8 MB (§7) |
| `viewer.html` | 5,0 MB (todo dentro, GLB en base64: +33 %) | — | el GLB y las poses como archivos aparte |

**Total de la feature con 150 acciones: unos 7 MB en disco y ~4 MB en la descarga.** Lo que más pesa pasa a ser la malla, no las poses.

De dónde sale el «compacto», medido sobre las 11 acciones (media por acción):

- formato actual: 145 KB (40 KB gzip). Por hueso guarda posición y giro **mundiales**, `len` y `off`, con 17 decimales, y los 30 huesos de los dedos en cada pose;
- sin posiciones mundiales (las rehace el FK, que ya da 0,0 mm), giros con 4 decimales, `len` solo si no es 1 y dedos una vez por acción: **17,5 KB (2,9 KB gzip)**. Trece veces menos;
- en binario (int16) bajaría a ~6 KB sin comprimir; no compensa mientras el JSON comprimido pese 3 KB.

Si la malla molesta: sin el Subsurf que aplica el exportador (25.636 vértices) se queda en torno a la cuarta parte; con el estilo toon puede no notarse. Se decide viéndolo, no entra en la v1.

### 3.2 Procesamiento

- **Por frame** (HANDOFF §3.1, §4.4e): ~0,3 ms la pose con sus correcciones; el remo en polea +1 ms. Una acción `libre`, menos (solo interpolar y FK). El coste real es dibujar: 25.636 vértices con skinning, dos pasadas (cuerpo y contorno). Va sobrado en un móvil medio a 60 fps; lo que hay que vigilar es la batería, y por eso se pausa al no verse (X01-07).
- **Memoria**: una sola WebView con WebGL (X01-07), que en Android suele rondar 50–100 MB mientras está abierta (estimación, por medir en X03-05). Las poses se cargan **bajo demanda**, una por ejercicio: 17 KB de JSON se leen en menos de 1 ms. Hoy se cargan todas al abrir.
- **Exportar**: un archivo por acción y solo las que cambian (`rev`, §4).

### 3.3 Coste de hacer un movimiento

| Qué | Trabajo | Código |
|---|---|---|
| Ficha que es una **variante script** de otro ejercicio | una línea en `catalogo.js` | 0 |
| **Variante** de una acción | duplicar en Blender y retocar (10–20 min del usuario) | 0 |
| **Acción** en una base que ya existe | script de base (Claude, 30–60 min con su render de comprobación) + retoque del usuario | 0 (su nombre en `EXERCISES` y la cámara si no encuadra) |
| **Acción** en `libre` | igual que la anterior, sin ajustes ni equilibrio en el visor | 0 |
| **Tipo de base** nuevo | 1–2 días de iteración (la dominada y la polea llevaron eso), 150–400 líneas de `runtime.js` y sus tests | sí |

El cuello de botella es el **retoque a mano**, no el código. Por eso las olas (§8–§9) van agrupadas por base: se posan varias por script, se revisan juntas en la hoja de revisión (§7) y se retocan seguidas.

### 3.4 Cuántas acciones hacen falta

Repaso de las 230 fichas (8-nov), aproximado:

- **~45 son variantes script** de otro ejercicio: las de mancuernas o kettlebell con el recorrido de la de barra (`romanian_deadlift_db`, `hip_thrust_db`, `good_morning_db`, `push_press_db`…), las asistidas con goma, las lastradas, `leg_press_high`/`wide`, `pause_squat_barbell` (tempo), `pull_up_supine`.
- **~15 isométricas** (plancha, hollow, L-sit, colgado, pino…): una sola pose (inicio = final). Las más baratas.
- **~20 de acondicionamiento** cíclicas (correr, comba, remo ergómetro, battle rope…): **fuera** en la v1 salvo que el usuario diga lo contrario; necesitan bucle, no ida y vuelta.
- **El resto, ~140 acciones** de ida y vuelta.

## 4. X03-01 · Exportador por acción, compacto, con estado y revisión

Lo que X01-11 ya pedía, más lo que hace falta para el seguimiento:

- **Un archivo por acción**: `assets/poses/<acción>.json`, en el formato compacto de §3.1 (sin posiciones mundiales, 4 decimales en giros y offsets, `len` solo si ≠ 1, dedos una vez por acción salvo que cambien entre claves). El visor rehace las posiciones mundiales con el FK al cargar; `expP`/`expQ` siguen funcionando sobre ellas.
- **Lo común aparte**: `assets/poses/_common.json` con `bones`, `parent`, `rest`, `hands` y `manerales` (~80 KB, hoy repetido dentro de `poses.json`).
- **Índice** `assets/poses/index.json`: por acción, su `meta` (base, nombre, `of`, `grip`, `hand`…) más:
  - `status`: `ff_status` de la acción (`borrador` · `revisar` · `ok`; sin propiedad = `ok`, para las 11 de hoy);
  - `from`: `ff_from`, la acción de la que se duplicó (la pone «Crear desde otra» y se puede escribir a mano); sirve para la página y para saber a quién afecta un cambio;
  - `rev`: los 8 primeros caracteres del hash del JSON de la acción. Cambia solo si cambia la pose. Es la **versión**: la usan las miniaturas (§7) y la caché de capturas en el móvil (X01-08) como clave, y el historial completo está en git;
  - `kb`: tamaño del archivo;
  - `mano`: `ff_mano`, la mano de la biblioteca que usa (§11); vacío = manos asimétricas, posadas a mano;
  - en las variantes con acción propia, `of` (`ff_variant_of`), `axis` y `value` (`ff_axis`, `ff_value`: el eje y el valor que son, con los nombres de T08). `ff_grip` se lee como `ff_axis = grip` para las dos que ya hay.
- **Solo llega a la app lo `ok`** (`build.py` copia `ok`; el prototipo enseña todo, con el estado en el nombre).
- **Precisión**: `tests/fidelity.js` sigue en 0,0 mm con su tolerancia actual; si los 4 decimales la rompen, 5 (se mide, no se discute).

**Probar X03-01**

- [ ] `npm test` en verde y `npm run shots` igual que antes (comparar capturas).
- [ ] `assets/poses/` tiene un archivo por acción, ninguno de más de 25 KB, y el índice con `status`, `from` y `rev`.
- [ ] Volver a exportar sin tocar nada deja los `rev` iguales; retocar una acción cambia solo el suyo.
- [ ] Una acción en `borrador` sale en el prototipo pero no en `mobile/assets/mannequin/`.

## 5. X03-02 · Tipo de base `libre`: la animación tal cual

Para enseñar una acción en cuanto está posada. `ff_base = "libre"`:

- **Pose**: la autorada (`authoredPose`) con la escala global de la altura (`K()`), y nada más: sin `STRETCH` por segmento (con otro fémur los pies deslizarían o atravesarían el suelo, y en `libre` no hay quien lo corrija). Los pies y las manos, como en Blender.
- **Implementos**: los que exporta la acción (barra, máquina, plataforma, maneral) donde estén en Blender, escalados con `K()`. Si la acción usa un banco o un cajón, se dibuja como caja fija con la medida de la acción (`ff_props`: lista de cajas `[centro, tamaño]` en la acción; el exportador las copia). Sin props nuevos en el visor.
- **Ajustes**: ninguno salvo la carga (solo dibuja los discos) y el recorrido (`bottom`/`top`, que ya son genéricos). El editor no enseña sliders.
- **Equilibrio y demanda muscular**: no. El mapa de calor se apaga (hasta X03-14, §18: con los apoyos y la carga declarados en la acción, sí hay demanda).
- **Fidelidad**: 0,0 mm siempre (es la pose tal cual); `tests/fidelity.js` la cubre sin cambios.

Coste: una rama más en `evaluateInner`, unas decenas de líneas.

**Probar X03-02**

- [ ] Una acción `libre` se ve exactamente como en Blender, con su barra o máquina.
- [ ] Al cambiar la altura del cliente, el maniquí escala entero sin que los pies deslicen.
- [ ] El editor no enseña sliders para una acción `libre`.

## 6. X03-03 · Catálogo: patrones, ejercicios, variantes y fichas

**Dos fuentes, sin repetir nada:**

- **Blender** dice lo que existe de cada acción: estado, base, mano, de qué variante es (índice del exportador, §4).
- **`formfit-mannequin/catalogo.js`** dice lo que se quiere: patrones, sus ejercicios (por id de acción, exista o no), los ejes de cada uno con sus valores y su origen previsto (*script* o *acción*), y qué fichas de la app cuelgan de cada ejercicio con qué valores. Es lo único que se escribe a mano; lo edita Claude cuando el usuario lo pide.

```js
export const CATALOGO = [
  { patron: 'Remos en polea', ejercicios: [
    { accion: 'cable_row', nombre: 'Remo en polea sentado',
      ejes: { maneral: { triangulo: 'base', barra_recta: 'script', cuerda: 'script' },
              polea:   { baja: 'base', alta: 'falta' } },
      fichas: { cable_row: {}, high_cable_row: { polea: 'alta' } } },
    { accion: 'face_pull', nombre: 'Face pull', fichas: { face_pull: {} } },   // sin acción todavía
  ]},
];
export const FUERA = ['air_bike', 'run', …];   // sin maniquí a propósito
```

- Una variante de origen *acción* se reconoce sola: es la acción con `of` + `axis` + `value` en el índice; en `catalogo.js` se escribe `'accion'` y la página dice si ya existe y en qué estado.
- Cada valor de eje que no sea `base` se traduce a lo que entiende el visor (`params`: `impl`, `gripType`, preajustes de X01 §8) en una tabla por eje junto a `catalogo.js`; así la ficha `high_cable_row` llega a la app como `{ pose: 'cable_row', params: { pulleyH: … } }`. De ahí sale el `poseKeyOf` de X01-05 (generado, no a mano): lo que no está en el catálogo no tiene maniquí.
- Cuando T08-01 dé `movement` + `form` a cada ficha, las fichas se asignan solas por su forma y los ejes se leen de `movements.js`.

**La página** (`npm run catalogo` en `formfit-mannequin/`, escribe `docs/catalogo.html`; no se edita a mano), como la maqueta:

- **como una base de datos**: a la izquierda, una página por movimiento (con «ejercicios en la app / total») y la de la biblioteca de manos;
- en cada movimiento, **una tabla con filas anidadas**: ejercicio → eje → variante; se abre y se cierra cada ejercicio;
- **las mismas columnas en todas las filas**, en palabras normales: *Sale de* (acción propia · pose del ejercicio · script del visor), *Pose en Blender* (falta · borrador · por revisar · lista), *Lógica en el visor* (hecha · falta · tal cual = `libre`), *Mano* (la de la biblioteca o «de la acción», y si falta), *Se ve en la app* (sí · no, calculado), *Variantes listas* (x/y, en la fila del ejercicio), *Fichas* (cuántas, y cuáles al pasar por encima) y *Siguiente* (qué falta y de quién: tú o Claude);
- la página de manos (§11): cada una con su pose, quién la usa y si falta posarla;
- avisos: variante *script* sobre una acción `libre`; ficha del catálogo de la app que no está en ningún ejercicio ni en `FUERA`; acción del índice que no está en `catalogo.js`; valor de eje sin traducción a `params`.

**Hecho el 9-nov** (falta lo que depende de T08 y de X03-01): `catalogo.js` lleva cada valor de eje como texto (`'base'`, `'script'`, `'hecha'` = script ya en el visor, `'accion'`, `'accion:<id>'`, y `'|<mano>'` si cambia de mano); `prototype/catalogo-pagina.js` lo junta con `assets/index.json` en `prototype/catalogo.template.html` (la maqueta v2 con datos) y añade una página «Avisos». Una acción `libre` sale como «libre → bench» y su lógica, «Falta» hasta X03-02. Aún no se traducen los valores a `params` del visor ni se genera `poseKeyOf`.

Si editar `catalogo.js` a través de Claude se queda corto, la página pasa a ser editable como `npm run plan` (arrastrar fichas a ejercicios); se decide usándola.

**Probar X03-03**

- [ ] La página enseña los patrones con sus ejercicios, ejes y fichas, como la maqueta.
- [ ] «Siguiente» y «Se ve en la app» cambian al cambiar el estado de una acción en Blender y exportar.
- [ ] Las 230 fichas están en algún ejercicio o en `FUERA`; si no, aviso.
- [ ] En la app, una ficha del catálogo enseña su maniquí con sus valores y una que no está no enseña nada.

## 7. X03-04 · Miniaturas del catálogo

Las de X01-08 (capturas del propio visor, no dibujos), con lo que hace falta para que no pesen:

- **Las genera el harness** (`tests/harness.js`, como `npm run shots`) al exportar, **solo de las acciones cuyo `rev` cambió**: `assets/thumbs/<acción>.<rev>.webp`.
- **Una imagen por acción con inicio y final lado a lado** (en vez de dos archivos), vista lateral, fondo transparente, cuerpo por defecto. ~240 px de alto, WebP con pérdida: los colores planos del toon comprimen muy bien. Estimado 6–12 KB por acción (por medir en esta fase); con 150, **~1,5 MB**.
- **Un solo juego para los dos temas** si el contraste aguanta sobre fondo claro y oscuro; si no, se renderiza por tema (dobla el peso). Se decide viéndolo.
- Las fichas que son variante de otro ejercicio usan la miniatura de su acción mientras no tengan la suya. Si la variante se nota mucho (mancuernas frente a barra), se genera una propia con esos `params`: `assets/thumbs/<ficha>.<rev>.webp`.
- Con ajustes o medidas propias (editor, Workout), la captura en el móvil y su caché de X01-08, con la clave `rev + hash(params, body, tema)`.

Alternativa descartada por ahora: dibujar la miniatura en el móvil como silueta 2D (SVG) desde la pose, que pesaría 0 KB más. No tiene el aspecto del visor; queda como plan B si las imágenes pesaran más de lo estimado.

**Probar X03-04**

- [ ] Exportar sin cambios no regenera ninguna miniatura.
- [ ] El tamaño total de `assets/thumbs/` dividido por el número de acciones queda por debajo de 12 KB.
- [ ] Las miniaturas se leen bien en tema claro y oscuro.

## 8. X03-05 · Ola 1: búlgara, banca, jalón, hip thrust y flexiones

Las cinco que pidió el usuario el 8-nov, en `libre` para tenerlas ya, cada una con su script en `blender/ejercicios/` (§2.5 del HANDOFF) y su render de comprobación:

| Ficha | Acción | Ahora | Después (base) | Implemento / props |
|---|---|---|---|---|
| `bulgarian_split_squat` | `bulgarian_split_squat` | `libre` | `split` (§10) | mancuernas a los lados (X02); banco tras el pie de atrás (caja) |
| `bench_press_barbell` | `bench_press` | `libre` | `bench` (§10) | barra; banco (caja); pies en el suelo |
| `pulldown` | `lat_pulldown` | `libre` → `cable` | `cable` con la polea arriba y por delante (X01 §2.13) | barra de jalón; asiento y tope de rodillas (cajas). Puede bastar con `cable` y `ff_pulley` alto: se prueba primero |
| `hip_thrust` | `hip_thrust` | `libre` | `bench` (§10) | barra en la cadera; banco bajo las escápulas |
| `push_up` | `push_up` | `libre` | `floor` (§10) | ninguno |

**Posadas el 9-nov** por script, en `borrador`, para que el usuario las retoque: `blender/ejercicios/{bulgarian_split_squat,bench_press,lat_pulldown,hip_thrust,push_up}.py` (hoja de comprobación en `formfit-mannequin/docs/x03-05-poses-borrador.png`, sin commitear). El banco, el asiento del jalón y el cajón de la búlgara son la misma caja (`FF_banco`, colgada del hueso `BANCO`; `ffpose.place_bench`), que cada acción coloca o esconde. Manos que piden y no existen: `barra_press` (banca), `palma_plana` (flexiones). El usuario retocó las cinco; da por buenas (`ok`) la búlgara, la banca, el hip thrust y las flexiones. **El jalón se rehízo** con las manos colgadas de la barra (en IK sueltas no había forma de controlar cuánto es escápula y cuánto codo): escápulas abajo en el frame 10 antes de doblar el codo, barra por delante de la cara en el 20, y sus variantes de agarre supino y neutro como acciones propias (`lat_pulldown_supino`, `lat_pulldown_neutro`; mano `colgado_neutro` por posar). La anchura de agarre será un ajuste del visor, no una variante. Falta X03-02 para que se vean en la app.

Y las que salen gratis de ellas por **ajuste** o **variante** en cuanto su base tenga los ajustes: `bench_press_db`, `close_grip_bench_press`, `hip_thrust_db`, `glute_bridge_barbell` (variante de hip thrust en el suelo), `single_leg_hip_thrust`, `split_squat_static`, `knee_push_up`, `incline_push_up`, `diamond_push_up`, `weighted_push_up`.

**Probar X03-05**

- [ ] Las cinco se ven en el móvil como en Blender, con su banco, barra o máquina.
- [ ] Apuntar la memoria de la app con el visor abierto (perfilador de Android Studio o similar) para cerrar la estimación de §3.2.

## 9. X03-06 · Ola 2: lo que cabe en las bases que ya hay

Sin código nuevo en el visor. Por base (lista orientativa; la página de §6 dice qué falta de verdad):

- **`stand`** (pies en el suelo, barra o mancuernas respecto al hombro): press militar de pie, push press, curl con barra, curl inverso, encogimientos, remo al mentón, elevaciones laterales y frontales, sentadilla goblet, Zercher, sentadilla al cajón, sentadilla con el aire, thruster (si cabe; si no, `libre`).
- **`hinge`**: sumo, peso muerto con barra hexagonal (¿ajuste `impl`?), buenos días, peso muerto a una pierna, pull-through, swing (acción propia: el recorrido cambia, X01 §2.15).
- **`row`**: remo en T, remo Meadows / landmine, remo con mancuerna a una mano (acción propia, como el de polea).
- **`hang`**: dominada al pecho, arquero, escápulas, negativas, toes to bar, elevaciones de piernas colgado, colgado (isométrica).
- **`cable`**: face pull, remo alto en polea, jalón con brazos rectos, curl en polea, extensión de tríceps en polea.
- **`seat`**: prensa a una pierna; extensión de cuádriceps y curl femoral sentado (si la máquina cabe en `seat`; si no, `libre`).
- **`libre`** para todo lo que no encaje y las isométricas (plancha, hollow, L-sit, pino…), que son una sola pose.

Orden: lo que más usan las plantillas de programas primero (lo decide el usuario mirando la página).

**Probar X03-06**: por tanda, con la hoja de revisión; cada tanda se añade aquí como casilla al cerrarla.

## 10. X03-07 · Bases nuevas `bench`, `split` y `floor`

Cada una es la receta de X01 §16 (dónde se fija el cuerpo, qué ajustes tiene, si se equilibra), y promociona las acciones `libre` que le tocan:

- **`bench`** (espalda o escápulas en el banco, pies en el suelo): la pelvis o el tronco fijos al banco como la pelvis al asiento en `seat`; brazos por IK a la barra (como `row`, empujando en vez de tirar); ajustes: anchura y tipo de agarre, implemento (barra, mancuernas), abertura de codos, punto de contacto de la barra en el pecho, recorrido, ángulo del banco (plano · inclinado · declinado: si cambia el recorrido, acción propia), pies. Sin equilibrio.
  - **Hip thrust** (usuario, 10-nov): lo fijo son las escápulas y lo que se mueve la cadera. El ajuste que manda es la **distancia de los pies**: lejos, los isquios trabajan para que el pie no se vaya hacia delante; cerca, el cuádriceps; y la fuerza va más hacia el banco cuanto más lejos están. Eso solo se ve si los apoyos tienen rozamiento (X03-21, que debe estar antes). Además: anchura de pies, altura del banco, recorrido. Pies sobre un apoyo inclinado: quizá más adelante (cambia poco el efecto).
- **`split`** (un pie delante en el suelo y el otro detrás, en el suelo o en un banco): como `stand` con el centro de masas entre los dos pies; ajustes: largo de la zancada, **altura del banco**, inclinación del tronco, implemento, profundidad y la dorsiflexión del cuerpo. El usuario (10-nov): hacia dónde va el peso, más delante o más atrás, no es un ajuste aparte: lo decide la dorsiflexión (más dorsiflexión, más rodilla delante y más peso delante, como en la sentadilla de X03-15). El reparto entre los dos pies se enseña (X03-14).
- **`floor`** (manos y pies en el suelo: flexiones, plancha): manos y pies fijos donde están en Blender (como los tobillos plantados); sin equilibrio. Ajustes (usuario, 10-nov):
  - **anchura de manos**;
  - **manos más arriba o más abajo** respecto a los hombros: desde cerca de la cabeza (acaba en extensión de tríceps casi pura: puede ser otro ejercicio, pero si este aguanta ese extremo, vale) hasta la altura del abdomen (pseudo plancha, con mucho hombro);
  - **rotación de las manos** (dedos hacia fuera, delante o dentro; cambia la abertura de los codos);
  - **dirección de empuje**: los hombros se desplazan hacia delante o atrás a lo largo del recorrido (empezar en neutro y acabar en pseudo plancha);
  - manos o pies elevados (inclinada/declinada, como alturas de caja), rodillas apoyadas, profundidad.

**Antes de la primera** (revisión del 10-nov): `evaluateInner` son unas 460 líneas con cuatro bases en una misma rama, separadas por banderas (`cable`, `row`, `hinge`, `one`). Se parte en una función por base sobre las piezas comunes (`build`, `solveLimb`, `comOffset`), sin cambiar el resultado (`npm test` y capturas iguales). Y `split` necesita el centro de masas contra el apoyo de **los dos pies por separado**: hoy `comOffset` solo mira delante/atrás y promedia los pies.

**Probar X03-07**: lo de X01-13 para cada base (sin saltos entre frames con 15 cuerpos, manos y pies donde tocan, fidelidad 0,0 mm con los valores por defecto), una casilla por base al cerrarla.

## 11. X03-08 · Biblioteca de manos (poses de Blender)

**El problema hoy:** los dedos que ve la app salen de tres sitios según el ejercicio (los de la propia acción con su implemento; una mezcla de `_mano.28` y `_mano.40` con otro implemento o agarre; `_mano.<maneral>` en la polea), y cada `_mano.*` keya el rig entero (296 huesos) aunque solo cuentan los dedos. No se ve qué mano usa cada ejercicio ni dónde se retoca.

**Una sola regla:** las manos simétricas salen de **una mano con nombre de la biblioteca**, por contexto de agarre, y se reutilizan entre ejercicios (las rodillas al pecho colgado usan la de la dominada prona):

| Grupo | Manos |
|---|---|
| Barra | colgado prono · colgado supino · barra en la espalda (sentadillas) · barra de peso muerto y remo · (press, cuando llegue) |
| Por grosor | asa 28 mm (mancuerna) · asa 40 mm (kettlebell) · abierta |
| Propias de un agarre | goblet (copa: la pesa en las palmas, no en el asa), y las que vayan saliendo |
| Manerales de polea | triángulo · asa en D · barra recta · barra supina · cuerda |

La tabla es el punto de partida, no una lista cerrada: **la biblioteca es lo que haya en el *Asset Shelf* del .blend**. Al crear un ejercicio se decide si reutiliza una mano o necesita una nueva, y la página de manos del catálogo enseña las que existen y, como «falta», las que algún ejercicio pide con `ff_mano` y aún no están.
| Apoyo | palma plana (flexiones, plancha), cuando llegue |

- **En Blender son *pose assets*** (la biblioteca de poses de Blender 5.0: Pose Mode › *Asset Shelf* abajo del visor 3D). Cada una es la acción `mano.<id>` marcada como asset, con **solo los huesos de la mano izquierda** (dedos, palmas, pulgar y sus controles), en un catálogo del Asset Browser por grupo. Al posar cualquier ejercicio, se selecciona la mano y se pulsa la pose; la derecha, con «aplicar invertida». Lo mismo vale para retocar: se cambia la pose de la biblioteca y vale para todos.
- **Lo que no es dedos** se queda donde está: el cilindro de referencia (`FF_asa_*`) y el maneral (`FF_maneral.*`) con su sitio en la mano.
- **Exportador:** lee las `mano.*` (en vez de `_mano.*`, que se renombran), refleja la derecha como hoy (`reflejar`) y saca lo mismo que ahora (`hands`). Antes de quitar los huesos que sobran, se comprueba que el export sale idéntico.
- **Visor (decidido el 9-nov): no cambia.** Una acción, ejercicio o variante con acción propia, enseña **sus** dedos: se posan aplicando la mano de la biblioteca en Blender, y `ff_mano` solo apunta cuál se usó. Una variante **sin acción propia** (por script) usa los dedos de su ejercicio si el agarre no cambia, y si cambia, los que pone la app: la mezcla de asa 28 y 40 mm con otro implemento, o `mano.<maneral>` en la polea. `tests/fidelity.js` no cambia.
- **Consecuencia:** retocar una mano de la biblioteca no cambia los ejercicios ya posados; hay que volver a aplicarla en cada acción que la usa (se buscan por `ff_mano`). Que el visor tome los dedos de `ff_mano` queda para cuando haya muchas acciones por mano.
- **Punto de partida de las nuevas** (colgado prono y supino, barra en la espalda, barra de peso muerto): Claude las saca de los dedos de `pullup`, `Chinup`, `back_squat` y `deadlift`, y el usuario las retoca. Se asignan con `ff_mano` en esas acciones.
- A comprobar al empezar, en Blender 5.0: que aplicar una pose con huesos seleccionados solo toca esos huesos, y cómo se aplica invertida desde el *Asset Shelf*.

**Probar X03-08**

- [ ] En Pose Mode salen las manos en el *Asset Shelf*, por grupos; aplicar una a la mano izquierda solo cambia esa mano, y la invertida pone la derecha igual.
- [ ] Aplicar «colgado prono» a la dominada, keyar y exportar cambia sus dedos en el visor.
- [ ] El export de las manos que ya había sale igual que antes del cambio.

## 12. X03-09 · Orden del .blend y guía del flujo

Que el usuario sepa, al abrir el archivo, qué puede tocar y qué no. Hoy hay siete colecciones sueltas en la raíz (`mannequin`, `FF_Props`, `FF_asas`, cinco `FF_manerales_*`), acciones de objeto sobrantes (`FF_asa_28.LAction`…, del autokey) y tres acciones sin `ff_base`/`ff_name` (`back_squat`, `front_squat`, `leg_press`).

**Outliner** (colecciones con color y cerradas por defecto; los scripts se actualizan a los nombres nuevos):

```
Scene Collection
├─ 🔴 1 · Maniquí · NO TOCAR          rig + malla
├─ 🟢 2 · Props para posar · TUYO      barra, discos, asiento, respaldo, asas de la prensa, plataforma (no se exportan)
├─ 🟢 3 · Manos · TUYO                 lo que no son dedos: dónde va el implemento en la mano
│     ├─ Asas de referencia            28 y 40 mm
│     └─ Manerales                     triángulo · asa · barra recta · barra supina · cuerda (ocultos al posar)
└─ ⚪ 9 · Sistema · NO TOCAR           widgets del rig
```

- Los **ejercicios** (acciones) se eligen en el panel FormFit, que enseña patrón, estado y mano de cada uno; las **manos**, en el *Asset Shelf* (§11). Nada de buscarlos en la lista de acciones.
- Fuera las acciones de objeto sobrantes, y `ff_base`/`ff_name` en las tres que no los tienen; se comprueba que el export sale idéntico.
- **Guía** `formfit-mannequin/docs/BLENDER.md`, para el usuario y enlazada desde HANDOFF §0: el árbol de arriba con qué es de quién; el camino de una pose (Blender → exportador → índice → app) y de una mano (biblioteca → aplicada en la acción → visor) en un dibujo; y tres recetas cortas: retocar un ejercicio y marcarlo `ok`, posar una variante con acción propia, posar o retocar una mano.

**Probar X03-09**

- [ ] Al abrir el .blend se entiende qué es cada colección y cuáles se pueden tocar.
- [ ] Con la guía, retocar un ejercicio, marcarlo `ok` y exportar sin preguntar a Claude.
- [ ] `npm test` sigue en verde tras el orden.

## 13. Fuera de alcance

- Acondicionamiento cíclico (correr, comba, ergómetros, battle rope): necesita animación en bucle.
- Formato binario de poses: el JSON compacto comprimido ya pesa ~3 KB.
- Bajar la resolución de la malla: se mira cuando el resto esté (§3.1).
- La matriz por forma de T08 (X01-12): llega con T08; esta página es la de la v1.

## 14. X03-10 · Motor de demanda: momentos por articulación desde la pose real

> Esta sección y las §16–§18 están escritas para implementarse **sin la conversación original**. Todo ocurre en `formfit-mannequin/` (rama `feat/x01-peso-muerto`). Antes de empezar: leer `formfit-mannequin/CLAUDE.md` y la §0 de `docs/HANDOFF.md`. Orden: X03-10 → X03-12 → X03-13 → X03-14; cada una se cierra con `npm test` en verde.

### 14.1 Qué hay hoy y qué se quiere

El equilibrio se calcula sobre la pose 3D final (`comOffset` en `prototype/runtime.js`), pero la demanda muscular (`out.act`, seis números de 0 a 1 que pintan el mapa de calor) sale de otro sitio:

- `stand`, `hinge` y `row`: del bloque «demanda (momentos cuasi-estáticos)» al final de `solveStand`, un modelo de cuatro masas anterior a la pose final (`out.act = cur.act`);
- `seat` (prensa): un cálculo propio al final de su rama en `evaluateInner` (`arm(kneeL)`, `arm(hipM)`);
- `cable` y `hang`: valores fijos (`out.act = { quads: 0, …, erect: 0.25 }`).

Se quiere **una sola función** que, con la pose final y las fuerzas externas, dé el momento que cada articulación tiene que vencer; de ahí salen el mapa de calor (esta fase), las líneas y brazos de momento a la vista (§16), los músculos de tracción y empuje (§17) y la demanda de las acciones `libre` (§18).

**Qué es y qué no es:** estática inversa (cuasi-estática, sin inercias). Da **momentos netos por articulación**, que es física fiable. El paso de momento a músculo es una tabla de reparto por convención (§14.7), no una medida.

### 14.2 Reglas para quien lo implemente

1. **La pose no cambia.** Esta fase solo lee la pose final. `tests/fidelity.js` y `tests/balance.js` deben dar exactamente la misma salida que antes (guardar la salida de `npm test` antes de empezar y compararla al final).
2. No se toca cómo `solveStand` resuelve tronco y tibia; solo se le quita el bloque de demanda.
3. `comOffset` no se toca. La función nueva usa las mismas masas y centros, y un test comprueba que coinciden (§14.9, prueba 0).
4. Sin dependencias nuevas. Todo en `runtime.js`, en una sección nueva `/* ---------------- Demanda: momentos por articulación ---------------- */` colocada justo antes de `/* ---------------- Evaluación de un frame ---------------- */`.
5. Comentarios y textos en español, como el resto del archivo.
6. Unidades: longitudes en metros; fuerzas en **pesos corporales** (PC; el peso del cuerpo entero = 1); momentos en PC·m. La carga del ajuste `load` es % del peso corporal: fuerza = `load / 100`.
7. Ejes (glTF): **Y arriba, +Z delante, +X hacia la izquierda del maniquí** (el pie `.L` tiene X positiva). Producto vectorial de three.js: `a.clone().cross(b)`.

### 14.3 Las partes del cuerpo

Función `bodyParts(P)` (P = pose: `P[hueso] = { p: Vector3, q: Quaternion }`). Devuelve una lista de `{ id, m, c }` con la masa (fracción del peso corporal) y el centro de masas (Vector3) de cada parte. Con `p = n => P[n].p`, `K()` la escala global, `along(n, l) = p(n) + (0, l·K(), 0) girado por P[n].q` (igual que en `comOffset`), `hip` = punto medio de `DEF-THIGH01.L/R` y `sh` = punto medio de `DEF-ARM01.L/R`:

| id | m | c |
|---|---|---|
| `pelvis` | 0.1117 | `hip.lerp(sh, 0.12)` |
| `trunkUp` | 0.3229 | `hip.lerp(sh, 0.6315)` |
| `head` | 0.0694 | `along('DEF-HEAD', 0.1)` |
| `armU.S` | 0.0271 | de `DEF-ARM01.S` a `DEF-FORARM01.S`, al 0.577 |
| `armF.S` | 0.0162 | de `DEF-FORARM01.S` a `DEF-HAND.S`, al 0.457 |
| `hand.S` | 0.0061 | `along('DEF-HAND.S', 0.05)` |
| `thigh.S` | 0.1416 | de `DEF-THIGH01.S` a `DEF-SHIN01.S`, al 0.41 |
| `shank.S` | 0.0433 | de `DEF-SHIN01.S` a `DEF-FOOT.S`, al 0.44 |
| `foot.S` | 0.0137 | de `DEF-FOOT.S` a `DEF-TOE.S`, al 0.4 |

`S` es `L` y `R` (16 partes en total; las masas suman 1). `pelvis` + `trunkUp` equivalen al tronco único de `comOffset` (0.4346 en el punto medio): por eso el 0.6315.

### 14.4 Fuerzas

Una fuerza es `{ p: Vector3 (dónde se aplica), f: Vector3 (en PC), part: id de la parte que la recibe, tipo: 'peso' | 'carga' | 'apoyo' }`.

**Pesos:** una por parte: `{ p: c, f: (0, −m, 0), part: id, tipo: 'peso' }`.

**Carga y apoyos por tipo de base** (tabla `SUPPORTS` en el código; `L = prm.load / 100`; `gripOf(P, S)` ya existe y da el centro del puño):

| Base | Carga | Apoyos |
|---|---|---|
| `stand` | `L` hacia abajo en `out.bar.center`, sobre `trunkUp` | verticales: un grupo, `pie.L + pie.R` |
| `hinge`, `row` | `L/2` hacia abajo en `gripOf(P, 'L')` sobre `hand.L`, y lo mismo en `R` | verticales: un grupo, `pie.L + pie.R` |
| `hang` | ninguna | verticales: un grupo, `mano.L + mano.R` |
| `cable` | `L` hacia la polea, repartida entre las manos que tiran: dirección `normalize(out.pulley − (out.maneral?.hook ‖ out.bar.center))`, aplicada en `gripOf(P, S)` sobre `hand.S`. A un brazo (`meta.hand`), toda en esa mano | fijos: `pelvis`, `foot.L`, `foot.R` |
| `seat` (prensa) | `L/2` en cada pie, en el punto medio del pie (de `DEF-FOOT.S` a `DEF-TOE.S`, al 0.4), sobre `foot.S`, en la dirección del raíl con el sentido que apunta **de la plataforma hacia la cadera** (`dir = normalize(F.plateTravel)`; si `dir · (hip − out.plate) < 0`, se invierte) | fijos: `pelvis`, `trunkUp` |

- `cable` no tiene ajuste de carga: se añade a `PARAMS.cable` `{ id: 'load', label: 'Carga', min: 0, max: 150, step: 5, def: 60, fmt: v => \`${v}% del peso corporal\` }`. No afecta a la pose.
- Puntos de apoyo vertical: `pie.S` = punto medio del pie (al 0.4 de `DEF-FOOT.S` a `DEF-TOE.S`), sobre `foot.S`; `mano.S` = `gripOf(P, S)`, sobre `hand.S`.
- Un apoyo **vertical** empuja solo hacia arriba y su fuerza se calcula (§14.5). Un apoyo **fijo** (asiento, respaldo, plataforma, banco) tiene una fuerza desconocida: no se calcula, y lo que hace es impedir medir desde ese lado (§14.6).
- Si una base tiene algún apoyo fijo, **todos** sus apoyos se tratan como fijos.

### 14.5 Reparto entre apoyos verticales

Solo cuando todos los apoyos son verticales (uno o dos grupos, cada grupo con uno o dos puntos). «Horizontal» = componentes X y Z.

1. `Rtot` = −(suma de la componente Y de pesos y cargas). Es positivo.
2. `c` = punto horizontal por donde pasa la resultante: media de las posiciones horizontales de pesos y cargas, ponderada por su componente Y.
3. **Dos grupos** (centros horizontales `g1`, `g2` = media de sus puntos): `t = clamp(((c − g1) · (g2 − g1)) / |g2 − g1|², 0, 1)`; `R1 = (1 − t)·Rtot`, `R2 = t·Rtot`. Dentro de cada grupo de dos puntos, mitad y mitad. Los puntos de aplicación no se mueven.
4. **Un grupo de dos puntos** `a`, `b`: `u = clamp(((c − a) · (b − a)) / |b − a|², 0, 1)` (si `|b − a| < 1e-4`, `u = 0.5`); `Ra = (1 − u)·Rtot`, `Rb = u·Rtot`. Lo que sobra en perpendicular se corrige moviendo el punto de apoyo dentro del pie: `e = c − (a + u·(b − a))` (horizontal), limitado a `|e| ≤ 0.10·K()` en los pies y a `0` en las manos (una barra no tiene anchura). Los puntos de aplicación son `a + e` y `b + e`.
5. **Un grupo de un punto** `a`: `Ra = Rtot`, aplicado en `a + e`, con `e = c − a` limitado igual.
6. Cada reacción se añade a la lista: `{ p, f: (0, R, 0), part, tipo: 'apoyo' }`.

Qué significa: de pie, con los pies a la par, la fuerza del suelo pasa por la vertical del centro de masas (punto 4: `e` adelanta o atrasa el apoyo dentro del pie). Con un pie delante y otro detrás (búlgara, §18), el punto 3 reparte el peso entre los dos según dónde cae el centro de masas.

### 14.6 El momento en cada articulación

Para una articulación en el punto `J`, con su **lado distal** (lista de partes): `M = Σ (fuerza.p − J) × fuerza.f` sobre **todas** las fuerzas (pesos, cargas y apoyos) cuya `part` está en el lado distal.

- Si hay apoyos fijos y alguno está en el lado distal: se calcula con el otro lado (todas las demás partes) y se cambia el signo, `M = −Σ…`. Si los dos lados tienen apoyo fijo, la articulación **no se puede calcular**: `m = null` y no cuenta para nada.
- Ejes del cuerpo, con `hipL/R` = `DEF-THIGH01.L/R`, `shL/R` = `DEF-ARM01.L/R`, `hip` y `sh` sus puntos medios: `xP = normalize(hipL − hipR)`, `xT = normalize(shL − shR)`, `uT = normalize(sh − hip)`, `nT = xT × uT`, `nP = xP × uT`. `sgn` = +1 en el lado `L`, −1 en el `R`.

| Articulación | Punto `J` | Lado distal | Componentes (positivo = lo que dice el nombre) |
|---|---|---|---|
| `ankle.S` | `DEF-FOOT.S` | `foot.S` | `plantar = −M · xP` |
| `knee.S` | `DEF-SHIN01.S` | `shank.S`, `foot.S` | `ext = +M · kS`, con `kS = normalize((rodilla − cadera) × (tobillo − rodilla))`; si ese producto mide menos de 1e-4, `kS = xP` |
| `hip.S` | `DEF-THIGH01.S` | `thigh.S`, `shank.S`, `foot.S` | `ext = −M · xP` · `add = sgn · (M · nP)` |
| `lumbar` | `hip + 0.10·K()·uT` | `trunkUp`, `head`, y los seis de los brazos | `ext = +M · xT` |
| `shoulder.S` | `DEF-ARM01.S` | `armU.S`, `armF.S`, `hand.S` | `flex = +M · xT` · `add = sgn · (M · nT)` · `hadd = sgn · (M · uT)` |
| `elbow.S` | `DEF-FORARM01.S` | `armF.S`, `hand.S` | `flex = −M · eS`, con `eS = normalize((codo − hombro) × (muñeca − codo))`; si mide menos de 1e-4, `eS = −xT` |

Un valor negativo es la demanda contraria: `ext` negativo = demanda de flexión; `add` negativo = de abducción; `hadd` negativo = de abducción horizontal; `flex` negativo en el codo = de extensión.

Comprobación mental de los signos (para depurar): en la sentadilla, `knee.ext > 0` y `hip.ext > 0`; en un curl con el antebrazo horizontal, `elbow.flex > 0`; en la dominada con agarre ancho, `shoulder.add > 0`; de pie con un peso delante en las manos, `shoulder.flex > 0` y `lumbar.ext > 0`.

**Línea de fuerza y brazo de momento** (para §16), por articulación calculable: `Fr` = suma de las fuerzas del lado usado. Si `|Fr| > 0.02`: `q = J + (Fr × M) / |Fr|²` es el punto de la línea de fuerza más cercano a la articulación y `arm = |q − J|` el brazo de momento en metros. Si no, `q = null`. (Si se usó el otro lado, con su `M` sin cambiar de signo.)

### 14.7 De momento a demanda y a músculo

`D(v, cap) = clamp(max(0, v) / (cap · K()))`. Capacidades por lado, en PC·m (constantes `CAP`; las cuatro primeras salen de las que ya usaba `solveStand`, las demás son de partida):

| `knee` | `hip` | `hipFrontal` | `ankle` | `lumbar` | `shoulder` | `elbow` |
|---|---|---|---|---|---|---|
| 0.20 | 0.275 | 0.15 | 0.11 | 0.50 | 0.12 | 0.08 |

Por articulación de dos lados se toma **el mayor de los dos lados**. `deep = clamp(β / 110°)`, con `β` el ángulo entre el muslo (`cadera → rodilla`) y la vertical hacia abajo, el mayor de los dos lados.

| Músculo (`act.`) | Fórmula (todo pasa por `clamp` 0–1 al final) |
|---|---|
| `quads` | `D(knee.ext, knee)` |
| `glutes` | `D(hip.ext, hip) · (0.55 + 0.45·deep) + 0.5 · D(−hip.add, hipFrontal)` |
| `hams` | `max(0.6 · D(hip.ext, hip), D(−knee.ext, knee))` |
| `add` | `D(hip.add, hipFrontal) + 0.3 · D(hip.ext, hip) · (0.3 + 0.7·deep)` |
| `erect` | `D(lumbar.ext, lumbar)` |
| `calves` | `D(ankle.plantar, ankle)` |
| `lats` | `max(D(−shoulder.flex, shoulder), D(shoulder.add, shoulder), 0.5 · D(−shoulder.hadd, shoulder))` |
| `pecs` | `max(D(shoulder.hadd, shoulder), 0.5 · D(shoulder.flex, shoulder))` |
| `delts` | `max(D(shoulder.flex, shoulder), D(−shoulder.add, shoulder), 0.5 · D(−shoulder.hadd, shoulder))` |
| `biceps` | `D(elbow.flex, elbow)` |
| `triceps` | `D(−elbow.flex, elbow)` |

Una articulación con `m = null` aporta 0.

### 14.8 La función y dónde se llama

```js
// P: pose final · ex: id de la acción · out: lo que devuelve evaluateInner (bar, pulley, maneral, plate, F…)
function demand(P, ex, out) → {
  forces,   // [{ p, f, part, tipo }]  pesos, cargas y apoyos (para dibujar, §16)
  joints,   // [{ id: 'knee.L', J, M, comp: { ext: 0.12 }, d: { ext: 0.6 }, q, arm }]   comp en PC·m con signo; d = demanda 0–1 del valor absoluto; M = null si no se puede calcular
  act,      // { quads, glutes, hams, add, erect, calves, lats, pecs, delts, biceps, triceps }
}
```

- Se llama **una vez** al final de `evaluateInner`, justo antes de cada `return out` (hay dos: el de la polea, dentro de `if (cable)`, y el final): `out.dem = demand(pose, ex, out); out.act = out.dem.act;`.
- Se borran: el bloque `// demanda (momentos cuasi-estáticos)` de `solveStand` (y `act` de su `return`), `out.act = cur.act`, el `out.act` de la prensa con sus `arm`, `Ld` y `deep`, y los `out.act` fijos de `cable` y `hang`.
- `frameLoop` y la lista `MUSCLES` siguen leyendo las seis claves de siempre; las cinco nuevas no se pintan hasta §17.
- En `window.__dbg` se añaden `demand`, `bodyParts`, `comOffset` y `midfootZ`.
- Coste: unas 16 partes × 11 articulaciones de productos vectoriales, muy por debajo de 0,1 ms por frame.

### 14.9 Pruebas automáticas: `tests/demand.js`

Archivo nuevo, con el mismo patrón que `tests/balance.js` (abre el visor con `tests/harness.js`, usa `__dbg`, imprime líneas y acaba con `process.exit(1)` si algo falla). Se añade al script `test` de `package.json` (`… && node tests/demand.js`) y como `test:demand`. Cada prueba fija `S.playing = false`, `S.exId` y restaura cuerpo y ajustes al acabar.

**Antes de borrar nada**, con el código actual, apuntar `r.act.quads` y `r.act.glutes` de `back_squat`, `front_squat` y `leg_press` en `s = 1` con todo por defecto: son los valores de referencia de la prueba 2.

0. **Masas**: para `back_squat`, `deadlift` y `pullup` en `s = 0, 0.5, 1`: la Z del centro de masas de `bodyParts` (media ponderada) coincide con `comOffset(P, r.bar.center, 0) + midfootZ(P)` (con `r = evaluate(ex, s)` y `P = r.pose`) a menos de 0,1 mm, y las masas suman 1.
1. **Equilibrio**: en `stand`, `hinge`, `row` y `hang`, la suma de todas las fuerzas es menor de 1e-6 en cada eje.
2. **Calibración**: `quads` y `glutes` de `back_squat`, `front_squat` y `leg_press` (`s = 1`, por defecto) a ±0,10 de los valores apuntados. Si no entra, se ajustan `CAP.knee` y `CAP.hip` (y solo eso) y se deja escrito en el comentario de `CAP` cuánto se movieron.
3. **Simetría**: `back_squat`, `s = 1`: `knee.L` y `knee.R` difieren menos de un 5 %.
4. **Rodillas adelante**: `back_squat`, `s = 1`, `knees = +10` frente a `0`: sube `knee.ext` y baja `hip.ext`.
5. **Fémur largo** (`{ femur: 112, tibia: 98, torso: 95 }`): `back_squat`, `s = 1`: sube `hip.ext` respecto al cuerpo por defecto.
6. **Bisagra rígida**: `deadlift`, en su punto bajo, `knees = −40` frente a `0`: suben `hams` y `erect`, baja `quads`.
7. **Dominada**: `pullup`, `s = 0.5`: `lats > 0.2` y `biceps > 0.1`; `quads < 0.05`.
8. **Polea**: `cable_row`, `s = 1`: `lats > 0.1`, `erect > 0`; `knee.L` y `hip.L` con `M = null`.
9. **Carga**: `back_squat`, `s = 1`, `load = 200` frente a `100`: suben `quads`, `glutes` y `erect`.

Si una prueba de la 4 a la 9 falla con la física bien implementada (signos de §14.6 comprobados), **no se fuerza**: se deja como aviso en la salida y se anota en la spec para decidirlo con el usuario.

### 14.10 Al acabar

- `npm test` (incluye `demand.js`) y `npm run shots`; mirar que el mapa de calor de sentadillas y prensa se parece al de antes.
- `docs/HANDOFF.md`: en §4.3 punto 3 quitar la demanda de `solveStand`; sección nueva §4.8 «Demanda» con un resumen de §14.3–§14.7; en §6 quitar la limitación «Demanda muscular: sale del modelo de palos».
- Commit con `(X03-10)` y los archivos generados (`mobile/assets/mannequin/viewer.html`, que copia `build.py`).

Lo que se deja como está, a propósito: la carga sigue siendo % del peso corporal (los kilos reales necesitan el peso del cliente: X01-05); el objetivo de centro de masas sigue siendo el de las claves de Blender; la barra del peso muerto apoyada en el suelo no se descuenta (siempre cuelga de las manos).

**Probar X03-10**

- [ ] `npm test` en verde, con `tests/demand.js` dentro, y la salida de `fidelity.js` y `balance.js` igual que antes del cambio.
- [ ] En el visor, sentadilla trasera, frontal y prensa pintan cuádriceps y glúteo como antes (a ojo).
- [ ] Sentadilla con «Avance de rodillas» al máximo: el cuádriceps se calienta más y el glúteo menos que por defecto.
- [ ] Peso muerto con «Flexión de rodilla» a −40°: más isquios y erectores, menos cuádriceps.

## 15. X03-11 · Variantes genéricas por eje y su traducción a ajustes

**El problema hoy:** `variantFor(ex, grip)` solo se llama en `hang` y `row` y solo mira el agarre (`meta.grip`). El índice ya exporta `eje` y `valor` por acción, pero el visor no los usa: `lat_pulldown_supino` y `lat_pulldown_neutro` (base `cable`) no se verían, y cada eje nuevo (banco inclinado, una pierna, polea alta) pediría otro caso especial. Además falta lo que §6 dejó sin hacer: traducir cada valor de eje a ajustes del visor.

- **Exportador**: en `meta`, `of`, `axis` y `value` (hoy `of` y `grip`; `ff_grip` se sigue leyendo como `axis = grip`).
- **Visor, una sola resolución** al entrar en `evaluate`, antes de la base: con los valores elegidos (`{ eje: valor }`), se busca la acción que es variante de ese ejercicio con ese eje y valor; si existe, se evalúa esa. Fuera los casos de `hang` y `row`. Con varios ejes elegidos gana la **excepción** (la acción que coincide en más ejes, §2) y los demás valores se aplican por script encima.
- **Recurso entre valores**, declarado y no en el código: hoy «neutro sale de la supina si existe» está escrito dentro de `evaluate`; pasa a `catalogo.js` (`Neutro: 'desde:Supino'`).
- **Tabla valor → ajustes** junto a `catalogo.js` (`ajustes.js`): por eje y valor de origen *script*, los `params` del visor (`Implemento › Mancuernas` → `{ impl: 'mancuernas' }`, `Pies › Altos` → `{ footHigh: 8 }`, `Polea › Alta` → `{ pulleyH: … }`). Un valor *script* sin fila sale como aviso en la página.
- **`poseKeyOf` generado**: `npm run catalogo` escribe también `mobile/src/data/mannequinPoses.js`, con ficha → `{ pose, valores, params }`, de las fichas de `catalogo.js` (que pasan a decir sus valores: `high_cable_row: { Polea: 'Alta' }`, como en el ejemplo de §6). Lo que no está, no tiene maniquí.
- `EXERCISES` deja de pedir el nombre corto a mano: sale de `meta.name`.

**Probar X03-11**

- [ ] `npm test` en verde; dominada y remo con barra en supino se ven igual que antes (capturas iguales).
- [ ] El jalón con agarre supino y neutro enseña sus acciones propias.
- [ ] La página del catálogo avisa de un valor *script* sin traducción, y deja de avisar al añadirla.
- [ ] `mannequinPoses.js` trae cada ficha del catálogo con su acción y sus ajustes, y ninguna de `FUERA`.

## 16. X03-12 · Fuerzas y brazos de momento a la vista

Depende de X03-10 (usa `out.dem`). Solo dibuja y enseña: no cambia ni la pose ni los números. Archivos: `prototype/runtime.js` y `prototype/shell.html`.

**Qué se ve** (con el botón nuevo «Fuerzas» encendido):

1. **Flechas de fuerza**: una por cada fuerza de `dem.forces` de tipo `carga` (azul, el color de `lineMat`) y `apoyo` (gris `0x8a93a3`); los pesos de las partes no se dibujan. La flecha va de `p` a `p + f̂ · len`, con `len = clamp(0.35 · |f|, 0.08, 0.6)` metros, y una punta de dos trazos de 4 cm.
2. **Brazos de momento**: por cada articulación de `dem.joints` con `q` no nulo y alguna demanda ≥ 0,10: un segmento de `J` a `q`, del color caliente del tema (`--heat-hi`).
3. **Línea de fuerza de la articulación principal** (la de mayor demanda en ese frame): una recta discontinua que pasa por su `q` con la dirección de su `Fr`, 0,6 m a cada lado.

**Cómo se dibuja:** un `THREE.LineSegments` (`demLines`) con `vertexColors`, `depthTest: false` y `renderOrder = 6`, cuya geometría se rehace en cada frame en `frameLoop`, igual que hace hoy `refLines` (`geometry.dispose()` y `new THREE.BufferGeometry().setFromPoints(…)` más el atributo `color`). La recta discontinua va aparte, en un `THREE.Line` con `LineDashedMaterial` (como `midLine`; hay que llamar a `computeLineDistances()` al rehacerla). Visible solo si `state.forces`.

**Botón:** en `shell.html`, junto a `linesBtn`: `<button class="vbtn" id="forcesBtn" aria-pressed="true">Fuerzas</button>`; en `runtime.js`, `state.forces = true` y `toggle('forcesBtn', 'forces')` como los otros tres.

**Panel «Articulaciones»** (en `shell.html`, un bloque nuevo debajo del de «Demanda estimada», con `<div class="muscles" id="joints"></div>`; se rellena en `frameLoop` como `mRows`): una fila por articulación calculable, con los dos lados juntos si se parecen:

- nombre: Tobillo · Rodilla · Cadera · Lumbar · Hombro · Codo, seguido del sentido de su componente mayor en ese frame («Rodilla · extensión», «Hombro · aducción», «Codo · flexión»; negativo = el contrario: flexión, abducción, extensión). Nombres de componente: `ext` extensión/flexión · `plantar` flexión plantar/dorsal · `add` aducción/abducción · `hadd` aducción horizontal/abducción horizontal · `flex` flexión/extensión;
- barra: la demanda (0–100) de esa componente;
- valor: el brazo de momento en cm (`Math.round(arm * 100)` + ` cm`) y, si los ajustes o el cuerpo no son los por defecto, la **diferencia** con la pose autorada: `+18 %` o `−12 %`.
- Si los dos lados difieren más de un 15 %, dos filas: «Rodilla izq.» y «Rodilla dcha.». Si no, una fila con el lado mayor.

**La diferencia con la autorada:** función nueva `evaluateDefault(ex, s)`: guarda `state.body` y `state.per[ex]`, pone `DEFAULT_BODY` y los valores `def` de `PARAMS[base]`, llama a `evaluate(ex, s)` y restaura en un `finally`. **Se llama desde `frameLoop`, nunca desde dentro de `evaluate`** (se llamaría a sí misma), y solo si `!isDefault()`. Se guarda en una caché por `ex + '|' + Math.round(s * 200)`. Diferencia = `(valor − valor0) / max(|valor0|, 0.02·K())`, en %, redondeada; entre −3 % y +3 % no se enseña.

**Probar X03-12**

- [ ] Sentadilla trasera de lado: flecha azul hacia abajo en la barra, flechas grises hacia arriba en los pies y un segmento de la rodilla y otro de la cadera hasta la vertical de la fuerza.
- [ ] Al subir «Avance de rodillas», el segmento de la rodilla se alarga y el de la cadera se acorta, y el panel dice algo como «Rodilla +…%» y «Cadera −…%».
- [ ] Remo en polea: la flecha de la carga sigue el cable; al subir la polea cambia el brazo del hombro.
- [ ] Con todo por defecto no sale ninguna diferencia; el botón «Fuerzas» lo esconde todo.

## 17. X03-13 · Zonas de tracción y empuje en el mapa

Depende de X03-10 (`act.lats`, `pecs`, `delts`, `biceps`, `triceps` ya existen). Hoy el shader (`GLSL` en `runtime.js`) pinta seis zonas con `uAct[6]`; pasan a ser once.

- **Uniforms:** `uAct[11]` y tres puntos nuevos del reposo, como `uHip` o `uKnee` (se rellenan donde se rellenan esos, en `initRig`): `uShoulder` (`REST['DEF-ARM01.L'].p`), `uElbow` (`REST['DEF-FORARM01.L'].p`), `uWrist` (`REST['DEF-HAND.L'].p`).
- **`frameLoop`:** `MU.uAct.value = [quads, glutes, hams, add, erect, calves, lats, pecs, delts, biceps, triceps]`.
- **`MUSCLES`:** cinco filas más: `['lats', 'Dorsal']`, `['pecs', 'Pectoral']`, `['delts', 'Deltoides']`, `['biceps', 'Bíceps']`, `['triceps', 'Tríceps']`.
- **Zonas** (dentro de `muscleColor`, con las mismas ayudas `st`, `segD`, `segT`; `p` ya trae `abs(x)` y `n` la normal reflejada; el reposo del maniquí es **con los brazos en cruz y las palmas hacia abajo**, así que el brazo va a lo largo de X, el bíceps mira hacia delante y el tríceps hacia atrás). Valores **de partida**:

```glsl
float armD = segD(p, uShoulder, uElbow), armT = segT(p, uShoulder, uElbow);
float upper = (1. - st(armD, 0.055*uS)) * st(armT, .18) * (1. - st(armT, .92));
float biceps  = upper * st(n.z, .05);
float triceps = upper * st(-n.z, .05);
float delts = (1. - st(length(p - uShoulder), 0.075*uS)) * (1. - st(armT, .22));
float torsoX = 1. - st(p.x, uShoulder.x - 0.02*uS);                       // dentro del tronco, no en el brazo
float pecs = torsoX * st(p.x, .015*uS) * st(n.z, .35) * st(p.y, uShoulder.y - 0.17*uS) * (1. - st(p.y, uShoulder.y - 0.02*uS));
float lats = torsoX * st(p.x, .07*uS) * st(-n.z, .25) * st(p.y, uPelvis.y + 0.12*uS) * (1. - st(p.y, uShoulder.y - 0.04*uS));
```

  y sus cinco `c = mix(c, heatC(tint, uAct[i]), zona);` después de los seis que hay, con `delts` el último (va encima).
- **Se ajustan mirando**: `npm run build:viewer` y capturas del maniquí en reposo de frente y de espaldas con cada zona al máximo (un script de sonda que ponga `MU.uAct` a 1 con `__dbg`; hay que exponer `MU` en `__dbg`). Se retocan radios y límites hasta que cada zona caiga sobre su músculo sin pisar las otras ni las seis que ya había (sobre todo `lats` con `erect`). El visto bueno es del usuario.
- El `customProgramCacheKey` de `bodyMat` no cambia.

**Probar X03-13**

- [ ] Dominada: se calientan dorsal y bíceps al subir.
- [ ] Remo en polea: dorsal y bíceps; al soltar, se enfrían.
- [ ] Sentadillas y prensa se ven igual que antes de esta fase (las zonas nuevas no pisan las de las piernas ni los erectores).
- [ ] Cada zona nueva cae sobre su músculo en las capturas de frente y de espaldas.

## 18. X03-14 · Apoyos y carga declarados en la acción (demanda en `libre`)

Depende de X03-02 (base `libre`) y de X03-10. Sustituye a la línea de §5 «Equilibrio y demanda muscular: no»: una acción `libre` **sí** tiene demanda si dice dónde se apoya y dónde va la carga. Así el press de banca, la búlgara, el hip thrust, las flexiones o un curl enseñan fuerzas y brazos de momento sin esperar a tener su base. Los ajustes (adelantar el pie, dirección de bajada…) siguen llegando con cada base (§10): con ellos, la demanda responde sola porque se calcula sobre la pose final.

**En Blender**, dos propiedades de la acción (las pone el `setup` de su script en `blender/ejercicios/`, y `blender/organizar.py` no las toca):

- `ff_apoyos`: texto. Grupos separados por `;`, puntos de un grupo por `+`. Puntos verticales: `pie.L`, `pie.R`, `mano.L`, `mano.R`, `hombros` (punto medio de `DEF-ARM01.L/R`, sobre `trunkUp`). Apoyos fijos: `asiento` (`pelvis`), `banco` (`pelvis` y `trunkUp`), `plataforma` (`foot.L` y `foot.R`). Como mucho dos grupos verticales.
- `ff_carga`: `tronco` (en la barra, sobre `trunkUp`) · `manos` (mitad en cada puño) · `mano.L` / `mano.R` · `cadera` (en la barra, sobre `pelvis`) · `ninguna`. Y `ff_carga_pc`: la carga por defecto, en % del peso corporal.

| Acción | `ff_apoyos` | `ff_carga` | `ff_carga_pc` |
|---|---|---|---|
| `bulgarian_split_squat` | `pie.L;pie.R` | `manos` | 40 |
| `bench_press` | `banco;pie.L+pie.R` | `manos` | 80 |
| `lat_pulldown` (y sus dos variantes) | — | — | — (pasa directamente a la base `cable`: X03-20) |
| `hip_thrust` | `hombros;pie.L+pie.R` | `cadera` | 120 |
| `push_up` | `mano.L+mano.R;pie.L+pie.R` | `ninguna` | 0 |

**Papel de cada músculo** (tabla `PAPEL` de X03-19; revisado con el usuario el 10-nov):

| Acción | Objetivo | Principales | Secundarios |
|---|---|---|---|
| `bulgarian_split_squat` | la pierna de delante | quads, glutes | add, hams, calves, erect |
| `bench_press` | empuje horizontal | pecs, triceps, delts | lats |
| `lat_pulldown` (y variantes) | tracción vertical | lats, biceps | delts, pecs, abs |
| `hip_thrust` | glúteo | glutes | hams, quads, add |
| `push_up` | empuje horizontal | pecs, triceps, delts | abs |

**Reparto entre apoyos a la vista**: con dos grupos verticales, el panel enseña encima de «Articulaciones» una línea con el reparto del peso entre ellos, en % de la reacción total: «Pie delantero 78 % · pie trasero 22 %» en la búlgara, «Manos 68 % · pies 32 %» en las flexiones, «Hombros 55 % · pies 45 %» en el hip thrust. Nombres: el grupo con `pie.L` delante de `pie.R` es «pie delantero»; si no, «pies», «manos», «hombros». En la búlgara el reparto ya responde a la dorsiflexión y a la inclinación del tronco porque se calcula sobre la pose final: más dorsiflexión, más rodilla delante, más peso sobre el pie de delante.

**Exportador** (`blender/export.py`, donde ya copia `ff_pulley` y `ff_hand` a `meta`): `meta.apoyos` (el texto tal cual), `meta.carga`, `meta.cargaPc`.

**Visor:** en `demand`, si la base es `libre`, apoyos y carga salen de `meta` en vez de la tabla `SUPPORTS` (se interpretan con una función `parseSupports(texto)` que devuelve la misma estructura que usa esa tabla). El ajuste `load` de `libre` toma `meta.cargaPc` como valor por defecto. Sin `meta.apoyos`, `out.dem = null`, `act` todo a 0 y el mapa apagado, como decía §5. Recordatorio de §14.4: si hay algún apoyo fijo, todos se tratan como fijos (en el press de banca solo se calculan hombros y codos, que es lo que interesa).

**Pruebas automáticas** (se añaden a `tests/demand.js`):

1. `bulgarian_split_squat`, punto bajo: el apoyo de `pie.L` (el de delante) lleva más del 60 % del total; `knee.L` y `hip.L` con demanda > 0,2.
2. `push_up`, abajo: las manos llevan entre el 55 % y el 80 % del peso; `pecs > 0.1` y `triceps > 0.1`.
3. `hip_thrust`, arriba: `glutes > quads`.
4. `bench_press`, abajo: `pecs > 0.2`; `knee.L` con `M = null`.

**Probar X03-14**

- [ ] `npm test` en verde con las cuatro pruebas nuevas.
- [ ] Búlgara en el visor: flechas verdes en los dos pies, más larga la de delante; el panel enseña rodilla y cadera izquierda y derecha por separado y el reparto «Pie delantero … % · pie trasero … %».
- [ ] Flexiones: se calientan pectoral y tríceps al bajar.
- [ ] Una acción `libre` sin `ff_apoyos` se ve sin mapa y sin flechas, y no da error.

## 19. X03-15 · Sentadilla armónica: la tibia sigue el ritmo de la animación y la dorsiflexión manda

> §19–§21 salen de la prueba del usuario del 10-nov sobre X03-10/12/13 y están escritas para implementarse sin la conversación. Orden: X03-15 → X03-16 → X03-17. Reglas generales: las de §14.2.

**El fallo (medido el 10-nov, sentadilla trasera, tibia en grados al 0 · 10 · 20 · 30 · 40 · 50 · 60 · 80 · 100 % del recorrido):**

| Caso | Tibia | Qué se ve |
|---|---|---|
| Por defecto | 8 15 24 32 38 43 46 46 45 | bien |
| «Avance de rodillas» +10 | 8 17 **29 35** 38 43 46 46 45 | el tobillo se adelanta al empezar y el tronco se va atrás (2° en vez de 6°); abajo no cambia nada |
| Dorsiflexión 20° | 8 15 **20 20** 23 28 31 31 30 | la tibia choca con el tope al 20 % y el tronco salta de 6° a 20° |
| Dorsiflexión 50° | igual que por defecto | más tobillo no hace nada |

El usuario: «realizan primero un gesto extraño de dorsiflexión antes de empezar a flexionar la cadera. El movimiento cadera–tobillo debe ser armónico y la cadera tiene que liderarlo». Y: en una sentadilla se baja con la máxima dorsiflexión cómoda, así que **es la dorsiflexión la que decide cuánto avanza la rodilla**; «Avance de rodillas» se queda como un extra.

**Causa** (rama `stand` de `evaluateInner`): la tibia es `F.th + (cur.th − ref.th) + (thPref − thPref0)`, recortada a `thLim`. El ajuste de rodillas entra multiplicado por `clamp(F.beta / 60°)`, que llega a 1 muy pronto; el solver de palos mueve la tibia casi gratis al principio (`wTh` pequeño); y el tope `thLim` recorta en seco.

**El arreglo: la tibia conserva el ritmo de Blender y solo se escala su recorrido.** Solo para la base `stand` (en `hinge`, `row` y `cable` no cambia nada: siguen usando `th` y `thLim` como hoy).

1. Función nueva `standRef(ex)`, en caché por acción y calculada con `withBody(DEFAULT_BODY, …)` (como `hingeKB`): `th0` = `features(authoredPose(ex, 0), ex, 0).th`; `sB` y `FB` = la `s` y las `features` de la clave de `keysOf(ex)` con la tibia (`th`) mayor; `thB = FB.th`.
2. Avance de la tibia en el frame: `p = (thB − th0) < 2° ? 0 : clamp((F.th − th0) / (thB − th0))`. Vale 0 de pie y 1 en el punto más bajo, con el ritmo de la animación.
3. Cuánto cambia la tibia **abajo**, en radianes: `dB = dCuerpo + (d.dorsi − 35)·DEG + prm.knees·DEG`, donde `dCuerpo = curB.th − refB.th` son dos llamadas a `solveStand` en el punto bajo, iguales que las de `ref` y `cur` de hoy pero con `FB` en lugar de `F` (su `beta`, `th`, `phi`, anchura, giro de pies y `barOff` salen de `FB` con las mismas fórmulas), las dos con `thPref = FB.th` y el mismo límite (`90·DEG`, sin tope). Así `dCuerpo` solo recoge lo que cambian el cuerpo, la anchura, la profundidad y la altura de la barra, y vale 0 con todo por defecto.
4. Tibia del frame: `th = clamp(F.th + p · dB, −10·DEG, 75·DEG)`.
5. `phi0` (el tronco de partida) y el lazo de equilibrio no se tocan: el tronco compensa solo.

Con esto la tibia es `th0 + p · (thB + dB − th0)`: el recorrido de Blender, escalado. Dorsiflexión 20° → llega a 31° abajo; 50° → a 61°; «Avance de rodillas» suma o resta encima. Con los valores por defecto `dB = 0` y sale la pose autorada (fidelidad 0,0 mm).

**Pruebas automáticas** (se añaden a `tests/balance.js`, que falle si no se cumplen), para `back_squat` y `front_squat`, con los casos `knees +10`, `knees −10`, `dorsi 20`, `dorsi 50` y cuerpo `{ femur: 112, tibia: 98, torso: 95 }`, muestreando `s` de 0 a 1 cada 0,05 y leyendo tibia y tronco del `readout` o, mejor, de la pose:

1. **Armónica**: `(tibia(s) − tibia(0)) / (tibia(sB) − tibia(0))` coincide con `p(s)` de la autorada a ±0,03 en todas las muestras.
2. **La dorsiflexión manda**: con `dorsi 50` la tibia abajo sube 15° ± 1,5° respecto a por defecto; con `dorsi 20` baja 15° ± 1,5°.
3. **Sin tirones**: el tronco no cambia más de 6° entre dos muestras seguidas en ningún caso.

`tests/fidelity.js` debe seguir igual. La parte informativa de `balance.js` (los nueve cuerpos y ajustes de las sentadillas) cambiará en los casos de tobillo y de cuerpo: se apunta en el informe qué líneas cambian y se comprueba que no aparece ningún aviso nuevo de «se caería».

HANDOFF: reescribir en §4.3 el punto 3 (cómo sale la tibia) y la fila `knees` de §4.5.

**Probar X03-15**

- [ ] Sentadilla trasera y frontal con «Dorsiflexión de tobillo» a 20° y a 50°: bajan sin gesto raro de tobillo al empezar; la cadera lidera como con los valores por defecto.
- [ ] Con 50° la rodilla avanza más abajo y el tronco queda más erguido; con 20°, al revés.
- [ ] «Avance de rodillas» a +12 y a −12: mismo ritmo, solo cambia hasta dónde llega la rodilla.
- [ ] Con todo por defecto la sentadilla es la de siempre.

## 20. X03-16 · Demanda relativa al ejercicio: mapa sin saturar, bíceps en las tracciones y panel sin ruido

Decisiones del usuario (10-nov): el color debe ser máximo cuando el músculo está en su máxima carga mecánica del ejercicio; la carga solo cambia el **reparto** entre grupos (más carga → más erectores); el panel debe enseñar solo lo relevante y nombrar lo que trabaja (en la sentadilla la cadera se flexiona al bajar: lo que se quiere leer es quién lo aguanta, los extensores, y nunca «aducción» como titular).

**1. Valores sin recortar.** `demand` devuelve además `raw`: los mismos once músculos de `act` **antes** del `clamp` final, calculados con una `D` sin recortar (`max(0, v) / (cap · K())`). `act` (recortado) se queda como está: lo usan los tests.

**2. Pico de la repetición.** `computeCurve` ya evalúa 31 puntos del recorrido cada vez que cambia algo. Ahí se guarda `PEAK = max(0.05, el mayor valor de raw de cualquier músculo en cualquiera de los 31 puntos)` y, por articulación (`knee`, `hip`…), `JPEAK[id]` = el mayor `|comp| / (CAP · K())` de cualquiera de sus componentes y lados en los 31 puntos.

**3. El mapa y las barras de «Demanda estimada» pintan `clamp(raw / PEAK)`**, no `act` (en `frameLoop`: `MU.uAct.value` y `mRows`; y la gráfica `spark` usa `raw / PEAK` de cuádriceps y glúteo). El músculo más exigido llega a 1 en su punto más duro y los demás quedan en proporción; ya no satura, y al cambiar la carga cambia el reparto (comprobado: al doblar la carga en sentadilla, el momento de rodilla sube ×1,5 y el lumbar ×1,74).

**4. Bíceps en las tracciones (convención declarada).** El momento neto del codo sale casi nulo en la dominada (antebrazo vertical bajo la barra) porque el modelo no ve la fuerza con que las manos tiran a lo largo de una barra fija. En la tabla de músculos de `demand`:

- `tiron = max(D(−shoulder.flex), D(shoulder.add))` (extensión o aducción del hombro: lo que hace el dorsal);
- `codoFlex = clamp(ángulo de flexión del codo / 60°)`, con el ángulo = el que forman `hombro → codo` y `codo → muñeca` (0 = brazo recto), el mayor de los dos lados;
- `sinergia = 0.5 · tiron · codoFlex`;
- `biceps = max(D(elbow.flex), sinergia)` y `triceps = max(0, D(−elbow.flex) − sinergia)`.

Con el brazo recto (peso muerto) `codoFlex = 0` y no cambia nada. Se comenta en el código como convención, no física. La prueba 7 de `tests/demand.js` deja de ser aviso: `biceps > 0.1` en la dominada a `s = 0.5`.

**5. Panel «Articulaciones»** (`jointRows`):

- **Solo las relevantes**: una articulación sale si `JPEAK[id] ≥ 0.15 · max(JPEAK)`. Así las filas no aparecen y desaparecen durante la repetición. Casilla «Ver todas» (`<label><input type="checkbox" id="allJoints"> Ver todas</label>` junto al título, `state.allJoints`) para quitar el filtro.
- **Barra**: `clamp(valor de la componente / (CAP · K()) / max(JPEAK))`.
- **Componente que se enseña**: en `ankle`, `knee`, `hip`, `lumbar` y `elbow`, siempre la sagital (`plantar`, `ext`, `ext`, `ext`, `flex`); en `shoulder`, la mayor de las tres.
- **Nombre = quién trabaja** (sustituye a `CNAME`):

| Articulación · componente | Positivo | Negativo |
|---|---|---|
| Tobillo · `plantar` | Tobillo · gemelos | Tobillo · tibial |
| Rodilla · `ext` | Rodilla · extensores (cuádriceps) | Rodilla · flexores (isquios) |
| Cadera · `ext` | Cadera · extensores (glúteo, isquios) | Cadera · flexores |
| Lumbar · `ext` | Lumbar · erectores | Lumbar · abdominales |
| Hombro · `flex` | Hombro · flexores (deltoides) | Hombro · extensores (dorsal) |
| Hombro · `add` | Hombro · aductores (dorsal, pectoral) | Hombro · abductores (deltoides) |
| Hombro · `hadd` | Hombro · aductores horizontales (pectoral) | Hombro · abductores horizontales |
| Codo · `flex` | Codo · flexores (bíceps) | Codo · extensores (tríceps) |

- La diferencia en % frente a la autorada, igual que hoy, pero solo en las filas que se enseñan.
- El título del bloque de músculos pasa a «Demanda relativa».

**Pruebas automáticas** (en `tests/demand.js`): la 7 pasa a exigir bíceps; nueva 10: en `back_squat`, `deadlift`, `pullup` y `cable_row`, el mayor `raw / PEAK` a lo largo de 31 puntos es 1 ± 0,001 (para ello el test calcula `PEAK` igual que `computeCurve`; exponer en `__dbg` una función `repPeak(ex)` que lo devuelva y que `computeCurve` use); nueva 11: `back_squat` en `s = 1`, `raw.erect / raw.quads` es mayor con `load = 200` que con `load = 50`.

**Probar X03-16**

- [ ] Sentadilla: el cuádriceps llega al color máximo solo en el punto más duro; glúteo y erectores quedan por debajo.
- [ ] Al subir la carga, los erectores ganan color respecto al cuádriceps.
- [ ] Dominada y remo en polea: el bíceps se calienta al doblar el codo, y no sale tríceps.
- [ ] En la sentadilla el panel enseña rodilla, cadera y lumbar (no tobillo, hombro ni codo), con «Cadera · extensores»; «Ver todas» las devuelve.

## 21. X03-17 · Capas de fuerza claras: resistencia, apoyo, brazos, equilibrio y trayectoria

El usuario (10-nov): «Tiene que quedar muy claro la dirección de la resistencia y ser trazable. Así como la dirección de la fuerza. Y de ahí salen los brazos de momento. Ahora las líneas son confusas: hay dos líneas azules punteadas. Y poder activarse o desactivarse individualmente». Hoy las flechas y los brazos son líneas de 1 píxel, y la vertical del mediopié y la línea de fuerza son las dos azules y discontinuas.

**Cinco capas, cada una con su color, su botón y su grosor.** Sustituyen a los botones «Líneas» y «Fuerzas» (`state.lines` y `state.forces` desaparecen) y a `demLines`/`fLine`:

| Capa (botón, `state.`) | Qué dibuja | Color | Por defecto |
|---|---|---|---|
| Resistencia (`lyRes`) | **Una** flecha por la resultante de las fuerzas de tipo `carga` (punto = media de sus puntos ponderada por su módulo; vector = su suma) y su **línea de acción**: una recta fina que pasa por ese punto en su dirección, 1,2 m a cada lado | morado `0x7a3ff2` | encendida |
| Apoyo (`lySup`) | Una flecha por cada fuerza de tipo `apoyo` y la línea de acción de su resultante (igual que arriba) | verde `0x1f9d55` | encendida |
| Brazos (`lyArm`) | Por cada articulación **relevante** (el mismo filtro del panel, §20.5) con `q`: una bolita en la articulación, un segmento grueso de `J` a `q` y una etiqueta con los centímetros | tinta oscura `0x1a1e26` | encendida |
| Equilibrio (`lyBal`) | La vertical del mediopié de hoy (`midLine`) | azul actual, discontinua | apagada |
| Trayectoria (`lyPath`) | La trayectoria de hoy (`pathLine`) | azul actual, continua | apagada |

- **Grosor de verdad**: nada de `THREE.Line` para las tres primeras capas. Se dibujan con mallas: cilindros con los ayudantes que ya existen (`cyl(r, mat)` sin contorno o un `CylinderGeometry` propio, y `strut(malla, a, b)` para colocarlos entre dos puntos), un `ConeGeometry` para la punta de cada flecha y una `SphereGeometry` para la bolita. Radios: flecha 0,010 m (punta: cono de radio 0,028 y alto 0,07), brazo 0,007, bolita 0,016, línea de acción 0,0035. Materiales `MeshBasicMaterial` con `depthTest: false` y `renderOrder` 6–7 para que se vean por encima del cuerpo. Un pequeño depósito de mallas que se reutilizan cada frame (se crean si faltan y se esconden las que sobran): nada de crear geometrías por frame.
- **Largo de las flechas**: `clamp(0.35 · |f|, 0.12, 0.6)` m. La de resistencia **acaba** en el punto de aplicación (viene de fuera hacia la carga); la de apoyo **sale** del punto de apoyo.
- **Etiquetas**: elementos HTML `.flabel` dentro del contenedor del lienzo (posición absoluta, `pointer-events: none`), colocados en cada frame proyectando el punto 3D con `v.clone().project(camera)`. Una en el centro de cada brazo («27 cm») y una junto a la flecha de resistencia con la carga («100 % PC»; en `hang`, nada). Se reutilizan como las mallas.
- **Trazar una articulación**: pulsar una fila del panel «Articulaciones» la selecciona (`state.joint = 'knee' | 'hip' | … | null`; pulsarla otra vez la suelta; la fila seleccionada se resalta). Con una seleccionada, la capa Brazos dibuja **solo** esa articulación (sus dos lados) y además su **línea de fuerza efectiva**: una recta fina del color de los brazos que pasa por su `q` en la dirección de la resultante de su lado (0,8 m a cada lado). Es la línea contra la que se mide ese brazo; casi coincide con la de apoyo o la de resistencia, pero descuenta el peso de los segmentos intermedios. Para la dirección hace falta la resultante: `demand` guarda `Fr` en cada articulación (junto a `q` y `arm`) y se borra el recálculo que hoy hace `drawForces`.
- **Botones**: en `shell.html`, donde están hoy «Líneas» y «Fuerzas», cinco botones `vbtn` con un punto del color de su capa delante del texto (`<i class="dot" style="background:#7a3ff2"></i>`). Hacen de leyenda. `toggle(id, clave)` como los demás.
- `npm run shots` saldrá con las capas por defecto; es lo esperado.

**Comprobar mirando capturas** (obligatorio; sonda con `tests/harness.js`): sentadilla trasera de lado abajo (flecha morada bajando hasta la barra con su línea, flechas verdes subiendo desde los pies, brazos oscuros con sus centímetros, todo legible sobre el muslo en rojo); la misma con la rodilla seleccionada (solo su brazo y su línea); remo en polea (la flecha morada sigue el cable); dominada (apoyo verde en las manos); y una con todas las capas apagadas (no queda nada dibujado).

HANDOFF: §4.6 (capas) y §4.8 (selección de articulación).

**Probar X03-17**

- [ ] Cada uno de los cinco botones enciende y apaga solo su capa, y el color del punto del botón es el de lo que dibuja.
- [ ] En la sentadilla se distinguen de un vistazo la resistencia (morada, hacia abajo en la barra) y el apoyo (verde, hacia arriba en los pies), con sus líneas.
- [ ] Los brazos de momento se leen sobre el cuerpo y llevan sus centímetros.
- [ ] Al pulsar «Rodilla» en el panel queda solo su brazo con su línea; al pulsarla otra vez vuelven todos.
- [ ] Ya no hay dos líneas azules discontinuas a la vez por defecto.

## 22. X03-18 · Acciones con grados anatómicos y brazos sin cifras

El usuario (10-nov, tras probar X03-15/16/17): «Hay que nombrar las acciones que se realizan durante el ejercicio. Una dominada no tiene una extensión de codo: tiene una flexión de X grados. Lo que tienen que mostrar es los grados de esa acción durante el recorrido. […] Los grados de una articulación han de ser en base a la posición anatómica, no a la animación de Blender». Y: «El número en cm flotando sobre el brazo de momento es un poco too much: deberíamos poder ver solo líneas de momento, con o sin datos».

Hoy el panel nombra cada fila por el signo del momento neto (§20.5, tabla `CNAME`): eso da «Codo · extensores (tríceps)» en la dominada, que contradice el mapa. A partir de ahora **la fila dice qué hace la articulación (el ángulo anatómico) y la barra dice cuánto trabajan sus músculos**, con los mismos valores que pinta el mapa. Archivos: `prototype/runtime.js`, `prototype/shell.html`, `tests/demand.js`.

**1. Ángulos anatómicos: `anatomia(P)`.** Función nueva, junto a `bodyParts`. Devuelve, en grados y por lado (`.L`, `.R`) salvo la lumbar, los ángulos de abajo. **Cero = posición anatómica** (de pie, piernas rectas, brazos colgando). El reposo del rig coincide con ella en piernas y columna (de pie, piernas rectas), así que ahí el ángulo se mide **como diferencia con el mismo ángulo en el reposo** (`REST[hueso].p`); los brazos del reposo están en cruz, así que el hombro se mide con vectores contra el tronco. Ninguna pose de la animación es el origen.

| Clave | Cómo se mide | Signo |
|---|---|---|
| `knee.flex` | ángulo entre `cadera→rodilla` (`DEF-THIGH01`→`DEF-SHIN01`) y `rodilla→tobillo` (`DEF-SHIN01`→`DEF-FOOT`), menos el del reposo | 0 = recta, crece al doblar |
| `elbow.flex` | ángulo entre `hombro→codo` (`DEF-ARM01`→`DEF-FORARM01`) y `codo→muñeca` (`DEF-FORARM01`→`DEF-HAND`), menos el del reposo | 0 = recto |
| `ankle.dorsi` | ángulo entre `tobillo→rodilla` y `tobillo→punta` (`DEF-FOOT`→`DEF-TOE`), y el resultado es `ángulo del reposo − ángulo actual` | + dorsiflexión (rodilla hacia la punta), − flexión plantar |
| `hip.flex` | en el plano sagital de la pelvis: `u` = eje de la pelvis (`DEF-SPINE01.p − punto medio de las caderas`, normalizado), `x` = `DEF-THIGH01.L − .R` normalizado, `f = x × u` (delante). Muslo `t = rodilla − cadera`: `atan2(t·f, −t·u)`, menos el mismo valor en el reposo | + delante (flexión), − detrás (extensión) |
| `hip.abd` | `atan2(s · t·x, −t·u)` con `s = +1` en `L` y `−1` en `R`, menos el del reposo | + hacia fuera (abducción), − hacia dentro |
| `lumbar.flex` | ángulo en el plano sagital entre el eje de la pelvis `u` y el del tronco alto (`DEF-CHEST.p − DEF-SPINE01.p`), menos el del reposo; con signo `+` si el tronco alto va hacia delante (`f`) | + flexión, − extensión |
| `shoulder.flex` | en los ejes del tronco que ya usa `demand` (`uT`, `xT`, `nT`; `nT` = delante): húmero `h = codo − hombro`, `atan2(h·nT, −h·uT)` | + delante (flexión), − detrás (extensión). Brazo colgando = 0 |
| `shoulder.abd` | `atan2(s · h·xT, −h·uT)`, `s` como arriba | + hacia fuera (abducción) |

`evaluate` no la llama: se llama donde hace falta (`repPeak` y `frameLoop`) con `r.pose`.

**2. Recorrido de cada ángulo.** `repPeak` guarda también, por clave y lado, el mínimo, el máximo y el valor en `s = 0` y `s = 1` a lo largo de sus 31 puntos: `RANGO['knee.flex.L'] = { min, max, ini, fin }`. Una clave es **acción del ejercicio** si `max − min ≥ 15°` en algún lado.

**3. Panel «Articulaciones»** (`jointRows`), fila por articulación:

- **Nombre**: articulación + su acción + el recorrido en grados: «Codo · flexión 15–130°», «Rodilla · flexión 0–112°», «Cadera · flexión 2–105°». Si la articulación tiene varias claves (hombro y cadera), la de mayor recorrido. Para las claves con signo (hombro, cadera, tobillo, lumbar) el nombre lo pone el signo del valor más lejos de 0 en el recorrido: «Hombro · extensión 0–40°» si va detrás, «Tobillo · dorsiflexión 0–35°» o «· flexión plantar 0–20°». El recorrido se escribe de menor a mayor valor absoluto (`|min|`–`|max|` del lado dominante). Siempre la flexión, nunca la extensión, en rodilla, codo y cadera: la extensión es que los grados bajen.
- **Valor**: los grados actuales («95°») y, si los ajustes o el cuerpo no son los por defecto, la diferencia de carga con la autorada igual que hoy («95° · +18 %»). El brazo en cm solo con la capa de cifras encendida (punto 5): «95° · 29 cm».
- **Barra**: el **mayor valor de sus músculos en el mapa** (el mismo `clamp(raw/PEAK)` con el papel de X03-19 aplicado), con `GRUPO = { ankle: [calves], knee: [quads, hams], hip: [glutes, hams, add], lumbar: [erect], shoulder: [lats, pecs, delts], elbow: [biceps, triceps] }`. Así panel y mapa dicen lo mismo: en la dominada, el codo lo marca el bíceps.
- **Qué filas salen**: las articulaciones con alguna acción (punto 2) y las que tienen un músculo **principal** (X03-19). «Ver todas» enseña también las demás.
- Lados separados («Rodilla izq.» / «Rodilla dcha.») cuando sus grados actuales difieren más de 10° o sus barras más de un 15 %.
- Se borran `CNAME`, `SAG` y el filtro de `JPEAK` de §20.5 (`JPEAK` se queda si lo usa algo más; si no, también se borra).

**4. El ángulo en el 3D, solo con la articulación seleccionada** (`state.joint`, X03-17): un arco fino del color de los brazos en la articulación, entre los dos segmentos que miden su ángulo, con radio 0,08 m. Nada más: sin texto.

**5. Cifras aparte.** La capa Brazos dibuja **solo las líneas**. Botón nuevo «Cifras» (`lyNum`, `state.lyNum`, **apagado** por defecto) junto a los cinco de capas: enciende las etiquetas `.flabel` (centímetros de los brazos y % PC de la resistencia) y los cm del panel. Si los dos lados de una articulación difieren menos de 1 cm, **una** etiqueta (la del lado mayor), no dos.

**Pruebas automáticas** (nueva 12 en `tests/demand.js`, exponer `anatomia` en `__dbg`):

- reposo del rig: todos los ángulos en 0 ± 1° salvo `shoulder.abd` (90 ± 5°);
- `back_squat`: `knee.flex` < 15° en `s = 0` y > 90° en `s = 1`; `hip.flex` > 70° en `s = 1`;
- `pullup`: `elbow.flex` < 25° en el punto de brazos estirados y > 90° arriba;
- `deadlift` en `s = 0` (abajo): `hip.flex` > 60°, `knee.flex` > 40°;
- `cable_row`: `elbow.flex` crece de `s = 0` a `s = 1` en más de 60°.

Si una prueba no cuadra con las poses (por ejemplo, que el punto de brazos estirados de la dominada no esté en `s = 0`), se busca el punto en la curva de 31 en vez de cambiar el umbral, y se anota.

**Comprobar mirando** (capturas con `tests/harness.js`): panel de la sentadilla, de la dominada y del remo en polea; la sentadilla con la rodilla seleccionada (arco); y la sentadilla con «Cifras» encendida y apagada.

HANDOFF: §4.6 (capa Cifras) y §4.8 (ángulos y panel).

**Probar X03-18**

- [ ] Dominada: el panel dice «Codo · flexión …°» y «Hombro · …» con sus grados, y su barra se mueve como el bíceps y el dorsal del mapa.
- [ ] Sentadilla: «Rodilla · flexión 0–…°» y «Cadera · flexión …°»; nunca «extensión» ni «aducción» como nombre.
- [ ] Con los brazos estirados el codo marca cerca de 0°; con las piernas rectas la rodilla también.
- [ ] Por defecto no hay números flotando; «Cifras» los enciende, y una sola etiqueta cuando los dos lados valen lo mismo.
- [ ] Al seleccionar una articulación se ve su arco.

## 23. X03-19 · Papel de cada músculo: principales y secundarios

El usuario (10-nov): «Aductores al 99 %, obviamente no, ya que no es su acción principal. Habrá que buscar una forma de establecer cuál es la acción principal y qué músculos están implicados directamente y cuáles son secundarios». Hoy el mapa escala todos los músculos con el mismo pico (§20.3), y los aductores salen altos en la sentadilla porque el pie queda por fuera de la cadera: es un momento real, pero de **estabilización**, no el objetivo del ejercicio.

La física no cambia (`demand`, `act` y `raw` se quedan igual, y las pruebas 0–11 también). El papel solo cambia **cómo se pinta**: mapa, barras de «Demanda relativa» y barras del panel.

**1. Tabla `PAPEL`** en `runtime.js`, por id de acción (las variantes con `meta.of` usan la de su ejercicio si no tienen una propia). Cada músculo es `principal`, `secundario` o no sale (no se pinta):

| Acción | Principales | Secundarios |
|---|---|---|
| `back_squat`, `front_squat` | quads, glutes | add, hams, erect, calves |
| `leg_press` | quads, glutes | add, hams, calves |
| `deadlift` | glutes, hams, quads, erect | add, lats, calves |
| `romanian_deadlift` | hams, glutes | erect, add, lats |
| `barbell_row` | lats, delts, biceps | erect, hams, glutes |
| `cable_row` | lats, biceps, delts | erect |
| `pullup` | lats, biceps | delts, pecs |

Es una propuesta de partida (de Claude); el usuario la corrige al probar. `// ponytail:` la tabla vive en el visor hasta que el catálogo (X03-03) tenga la ficha de cada ejercicio; entonces se mueve allí.

**2. Cómo se pinta.**

- `PEAK` (§20.2) pasa a ser el mayor `raw` de los **principales** en los 31 puntos. Un principal se pinta `clamp(raw / PEAK)`: el más exigido llega a 1 en su punto más duro, como hoy.
- Un secundario se pinta `SECUNDARIO · clamp(raw / PEAK)`, con `const SECUNDARIO = 0.5`: se ve, sube y baja con el ajuste, pero nunca llega al color del objetivo. Si el ajuste lo carga mucho (más carga → más erectores) se nota, porque su `raw` sube.
- Un músculo que no está en la tabla de su acción se pinta 0.
- **Abdominales**, músculo número doce (`abs`, «Abdominales»; el usuario lo quiere como estabilizador en flexiones y jalón): `abs = D(lumbar.ext, −1)` en la tabla de `demand` (el momento lumbar que pide flexionar, el que hoy el panel llamaba «Lumbar · abdominales»; en la plancha lo da sola la gravedad, que quiere hundir la cadera). Zona del shader: delante del tronco (`st(n.z, .35)`), `p.x < 0.07·uS` y entre `uPelvis.y + 0.04` y `uShoulder.y − 0.20` (de partida; se ajusta mirando como las de X03-13, sin pisar `pecs`). `uAct[12]`, una fila más en `MUSCLES` y en `GRUPO.lumbar` (`[erect, abs]`).
- **Sin tabla** (las acciones nuevas hasta que tengan la suya): principales = los músculos de las articulaciones con acción (X03-18 punto 2, por `GRUPO`); secundarios = los demás con `raw > 0`. Es lo que verán búlgara, banca, jalón, hip thrust y flexiones cuando entren en `libre` (X03-14).
- En «Demanda relativa», los principales primero; los secundarios con el nombre en gris (`var(--muted)` o el color atenuado que ya use el panel). Los que no salen, ocultos.

**Pruebas automáticas** (nueva 13; exponer `PAPEL` y una función `pinta(ex, raw, PEAK)` que devuelva los once valores pintados, y que `frameLoop` use la misma):

- `back_squat`, en los 31 puntos: lo pintado de `add` ≤ 0,5 y el mayor de `quads`/`glutes` llega a 1 ± 0,001;
- `pullup`: el mayor de `lats`/`biceps` llega a 1; `triceps` pintado = 0;
- la prueba 10 de §20 pasa a mirar solo los principales.

**Probar X03-19**

- [ ] Sentadilla: cuádriceps y glúteo son los que llegan al color máximo; aductores, isquios, erectores y gemelos se ven más tenues.
- [ ] Al subir mucho la carga los erectores ganan color, pero sin llegar al del cuádriceps.
- [ ] Dominada: dorsal y bíceps al máximo; deltoides tenue; nada en el tríceps.
- [ ] La lista de «Demanda relativa» pone primero los principales.
- [ ] La zona de abdominales cae sobre el abdomen y no pisa el pectoral (captura de frente).

## 24. X03-20 · Jalón en la base de polea, con curvatura del tronco

El usuario (10-nov): el jalón, si es compatible, a la base `cable` (así tiene carga, demanda y el **balanceo** como el remo en polea desde el principio). Y, si se puede, un ajuste para hacerlo «más encorvado» (abdomen contraído) o «más recto sacando pecho». En el rig de Blender los dos controladores del abdomen levantan las piernas en vez de doblar el tronco, hasta llegar al hueso de las costillas; **en el visor no pasa**: allí se giran los huesos de deformación de la columna y cada giro solo arrastra a sus hijos (pecho, cuello, cabeza y brazos), con la pelvis y las piernas quietas.

**1. Las tres acciones pasan a `cable`.** En `blender/ejercicios/lat_pulldown.py` (el mismo script hace las tres con `make(grip)`): `META` con base `cable`, `ff_plan` fuera, y `act['ff_pulley'] = [f, z]` como en `cable_row.py`: la polea alta en la vertical de la barra del frame 1 (`f` = la de la barra) y `z` 0,45 m por encima de ella. Se vuelve a ejecutar el script sobre el `.blend` y se exporta (comandos en `formfit-mannequin/CLAUDE.md`). **No se tocan las poses**: si el script no puede ejecutarse sin reposar, se ponen las propiedades a mano con un script de una línea sobre las tres acciones y se avisa.

**2. Lo que cambia en el visor para el jalón** (leer antes la base `cable` entera en `evaluateInner` y en `placeProps`; hacer lo mínimo):

- La barra es la de la acción (la de Blender, sin discos), no un maneral del visor. Una propiedad `ff_impl = 'barra_jalon'` en la acción (el exportador la copia a `meta.impl`, como `ff_hand`) dice que no se dibuja maneral y que se esconden los ajustes `impl`, `gripType` y `grip` (las variantes de agarre ya son acciones propias), igual que hoy los esconde `meta.hand`.
- `pulleyH` y `knees` se esconden para el jalón (la polea alta no se mueve y los muslos van bajo el rodillo). Se quedan `trunk`, `swing` (balanceo), `dest` (hacia dónde tira; para el jalón el texto dice «más hacia la clavícula» / «más hacia el esternón») y `load`.
- Apoyos de `demand`: los del cable más los muslos (`fijo: ['pelvis', 'thigh.L', 'thigh.R', 'foot.L', 'foot.R']`): rodilla y cadera no se calculan, hombro y codo sí desde la mano.
- Si la base `cable` da por hecho algo del remo que el jalón no cumple (por ejemplo, que la polea está delante), se resuelve con la condición mínima y se anota en el informe.

**3. Ajuste nuevo `curv`** («Curvatura del tronco», en `PARAMS.cable`, así también lo tiene el remo en polea): de −15 a +20, paso 1, `def: 0`, `fmt`: 0 = «la autorada», positivo = «… ° más encorvado», negativo = «… ° más erguido, sacando pecho». Se aplica como un giro alrededor del eje lateral del tronco repartido a medias entre `DEF-SPINE02` y `DEF-CHEST` (+ = flexión, el pecho hacia delante y abajo), **después** de la inclinación del tronco (`trunk`) y **antes** de llevar las manos al maneral, para que las manos sigan agarrando y los brazos se recoloquen solos. Con `curv = 0` no se toca nada (fidelidad 0,0 mm).

**Pruebas automáticas:**

- `npm test`: fidelidad de las tres acciones en 0,0 mm con los valores por defecto.
- `tests/demand.js`, nueva 14: `lat_pulldown` en `s = 1` (barra abajo): `act.lats > 0.1` y `act.biceps > 0.1`; `knee.L` con `M = null`.
- Nueva 15: con `curv = +15`, `anatomia(P)['lumbar.flex']` sube entre 10° y 20° respecto a `curv = 0`; en `cable_row`, igual.

HANDOFF: §4 (base `cable`, jalón y `curv`).

**Probar X03-20**

- [ ] Jalón en el visor con sus tres agarres: la barra baja con la animación de Blender, con el cable vertical a la polea.
- [ ] «Balanceo» del jalón: el tronco se echa atrás al tirar, como en el remo en polea.
- [ ] «Curvatura del tronco» encorva o saca pecho sin mover la pelvis ni las piernas, y las manos siguen en la barra.
- [ ] Se calientan dorsal y bíceps; el abdomen tenue.

## 25. X03-21 · Hacia dónde va la fuerza en los ejercicios con varios apoyos

El usuario (10-nov), hablando del hip thrust: «Si el pie está apoyado en el suelo y lo alejas mucho, el isquio trabaja para mantenerlo ahí; si está muy cerca, es el cuádriceps. […] Si alejas mucho los pies, la fuerza va a ir más hacia el banco, lo cual es bueno saberlo. Y en general, en los ejercicios de múltiples apoyos, sería genial poder saber en qué dirección va esa fuerza cuando aplicas fuerza».

Hoy los apoyos solo empujan **en vertical** (§14.5). Con un solo grupo de apoyo (sentadilla, peso muerto) es correcto. Con dos grupos (búlgara, hip thrust, flexiones: X03-14), el suelo y el banco también pueden empujar en horizontal por rozamiento, y la estática sola no dice cuánto: hay una incógnita de más. Se resuelve con el criterio estándar de la biomecánica, la **optimización estática** (Crowninshield y Brand, 1981), aquí sobre los momentos articulares en vez de músculo a músculo: de todos los repartos posibles, el cuerpo usa el que **menos esfuerzo** pide. Con ese criterio sale solo lo que el usuario describe: con los pies lejos, el reparto que menos cuesta es el que tira del pie hacia el cuerpo, y eso lo hacen los isquios.

**1. Planteamiento** (en `apoyosVerticales` o una función nueva que la sustituya cuando hay dos grupos; solo si **todas** las cargas externas son verticales, como en `libre`: si no, se queda como hoy):

- `A`, `B`: centros de los dos grupos (media de sus puntos); `d` = la dirección horizontal de `A` a `B` (normalizada); `L` = la distancia horizontal entre ellos; `dy = B.y − A.y`.
- El grupo `B` recibe una fuerza horizontal `h · d` y el `A` la contraria (`−h · d`; se reparten a partes iguales entre los puntos de cada grupo). Suman cero, así que el peso sigue igualando la reacción vertical total `Rtot`.
- Con `h`, el reparto vertical cambia para que los momentos cuadren. En el plano vertical que contiene `d`, con `u_i = (p_i − A)·d` la posición horizontal de cada peso o carga `w_i` (positivo hacia abajo): `N_B = (Σ u_i · w_i + dy · h) / L` y `N_A = Rtot − N_B`. Con `h = 0` es el reparto de hoy. Dentro de cada grupo, los puntos se reparten como hoy.
- **Esfuerzo**: `E(h) = Σ (comp / (CAP · K()))²` sobre todas las componentes de todas las articulaciones calculables. Como todas las fuerzas son lineales en `h`, cada componente también: `comp(h) = c0 + h · (c1 − c0)`, con `c0` calculado con `h = 0` y `c1` con `h = 1`. El mínimo: `h* = −Σ c0 · Δ / Σ Δ²`, con `Δ = c1 − c0`.
- **Rozamiento**: `|h*| ≤ μ · min(N_A, N_B)`, con `μ = 0.6` (`// ponytail:` un solo μ para suelo y banco; si un apoyo es de goma o el banco es de piel se separa). Si `N_A` o `N_B` salen negativos con `h*`, se recorta `h*` hasta que el menor quede en 0.
- `demand` calcula las articulaciones tres veces (con `h = 0`, `h = 1` y `h*`): sacar el bucle de articulaciones a una función que reciba la lista de fuerzas. Coste despreciable (dos pasadas más sobre seis articulaciones).

**2. A la vista** (capa Apoyo de X03-17): las flechas verdes ya salen de la fuerza real, así que **se inclinan solas**. Con «Cifras» encendida (X03-18), junto a cada flecha de apoyo, el ángulo con la vertical y hacia dónde: «18° hacia el banco» / «hacia los pies» / «hacia las manos» (el nombre del otro grupo, como en el reparto de X03-14); menos de 3°, nada. Y la línea de reparto del panel añade la dirección: «Hombros 55 % · pies 45 % (18° hacia el banco)».

**Pruebas automáticas** (nueva 16 en `tests/demand.js`, con las acciones de X03-14):

- en `push_up`, `bulgarian_split_squat` y `hip_thrust`, en los 31 puntos: `E(h*) ≤ E(0)`, `|h*| ≤ 0.6 · min(N_A, N_B) + 1e-6` y la suma de fuerzas horizontales de los apoyos es 0 ± 1e-6;
- con un solo grupo de apoyo (`back_squat`), los resultados son idénticos a los de antes (prueba 2 sin tocar).

Lo de los pies lejos o cerca del hip thrust se comprueba cuando la base `bench` tenga el ajuste de distancia de pies (X03-07, con X03-21 ya hecha): pies 15 cm más lejos → el momento flexor de rodilla (isquios) sube y la flecha del pie se inclina hacia el banco; pies 15 cm más cerca → sube el cuádriceps. Se añade como prueba automática en esa fase.

HANDOFF: §4.8 (rozamiento y reparto por mínimo esfuerzo).

**Probar X03-21**

- [ ] Hip thrust: las flechas verdes de los pies y de los hombros se inclinan, y con «Cifras» dicen hacia dónde.
- [ ] Flexiones: el reparto entre manos y pies sale en el panel y las flechas de las manos se inclinan.
- [ ] La sentadilla y el peso muerto se ven igual que antes.

## Fases

| Fase | Qué | Depende de | Estado |
|---|---|---|---|
| X03-01 | Exportador por acción, compacto, con estado y revisión | — | pendiente |
| X03-02 | Tipo de base `libre` | — | pendiente |
| X03-03 | Catálogo: patrones, ejercicios, variantes y fichas | X03-01 | pendiente |
| X03-04 | Miniaturas del catálogo | X03-01 | pendiente |
| X03-05 | Ola 1 (búlgara, banca, jalón, hip thrust, flexiones) | X03-02 | pendiente |
| X03-06 | Ola 2 (bases existentes) | X03-03 | pendiente |
| X03-07 | Bases `bench`, `split`, `floor` | X03-05 | pendiente |
| X03-08 | Biblioteca de manos | — | hecho |
| X03-09 | Orden del .blend y guía | X03-08 | hecho |
| X03-10 | Motor de demanda: momentos por articulación desde la pose real | — | hecho 10-nov, sin commit. `CAP.knee` 0,20 → 0,23 y `CAP.hip` 0,275 → 0,20 al calibrar. Aviso: en la dominada el bíceps da 0 (momento neto del codo casi nulo); el mapa satura en 1 con las cargas por defecto |
| X03-11 | Variantes genéricas por eje y su traducción a ajustes | X03-01 | pendiente |
| X03-12 | Fuerzas y brazos de momento a la vista | X03-10 | hecho 10-nov, sin commit. Las líneas miden 1 px y se ven poco; «Avance de rodillas» positivo no mueve nada con el tobillo por defecto (tope del solver) |
| X03-13 | Zonas de tracción y empuje en el mapa | X03-10 | hecho 10-nov, sin commit. `torsoX`, `lats` y `delts` ajustadas respecto a las fórmulas de partida; falta el visto bueno del usuario |
| X03-14 | Apoyos y carga declarados en la acción (demanda en `libre`) | X03-02, X03-10 | pendiente |
| X03-15 | Sentadilla armónica: tibia al ritmo de la animación, la dorsiflexión manda | — | hecho 10-nov, sin commit. En la pose 3D los ±15° de tobillo quedan en +12,8° / −13,5° (la anchura de pies; el modelo es 2D) |
| X03-16 | Demanda relativa al ejercicio, bíceps en las tracciones y panel sin ruido | X03-10, X03-12 | hecho 10-nov, sin commit. Por pulir: en la dominada el panel dice «Codo · extensores (tríceps)» y «Lumbar · abdominales» mientras el mapa pinta bíceps; aductores al 99 % en la sentadilla; el tobillo sale en el panel de la sentadilla (37 % del pico) |
| X03-17 | Capas de fuerza claras | X03-16 | hecho 10-nov, sin commit. Por pulir: etiquetas duplicadas de los dos lados cuando valen lo mismo |
| X03-18 | Acciones con grados anatómicos y brazos sin cifras | X03-17 | hecho 10-nov, sin commit. `hip.abd` con `hypot(t·f, t·u)` (la fórmula de la spec se disparaba con el muslo flexionado > 90°); hombro en (−90°, 270°]; lados separados solo por grados. Filas: con tabla `PAPEL`, las articulaciones con músculo principal o secundario (si no, las piernas de la dominada salían con barra 0) |
| X03-19 | Papel de cada músculo: principales y secundarios | X03-18 | hecho 10-nov, sin commit. La gráfica de la repetición dibuja los dos primeros principales. Aviso: en la sentadilla los aductores quedan clavados en 0,5 toda la repetición (su `raw` supera el pico ya de pie: `CAP.hipFrontal` bajo) |
| X03-20 | Jalón en la base de polea, con curvatura del tronco | X03-18 | hecho 10-nov, sin commit. `curv` gira `DEF-SPINE01` y `SPINE02` (con `SPINE02` y `CHEST` la lumbar solo cambiaba 4°); chip de agarre prono/supino/neutro en vez de esconderlo; se esconden también `wrist` y `elbows` |
| X03-21 | Hacia dónde va la fuerza con varios apoyos | X03-14 | pendiente |
