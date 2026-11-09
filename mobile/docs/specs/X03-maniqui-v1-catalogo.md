# Spec — Maniquí v1: catálogo rápido y su seguimiento          (archivo: X03-maniqui-v1-catalogo.md)

> Tema: ejercicios
> En corto: Llenar el catálogo de maniquíes lo antes posible —primero con la animación de Blender tal cual, la lógica después— con una página que diga, ficha a ficha, si su maniquí sale de una acción, de una variante o de los ajustes de la app, y cuánto pesa todo.
> Fase X03-01 · pendiente · Exportador por acción, compacto, con estado y revisión · §4
> Fase X03-02 · pendiente · Tipo de base `libre`: la animación tal cual · §5
> Fase X03-03 · pendiente · Catálogo: patrones, ejercicios, variantes y fichas · §6
> Fase X03-04 · pendiente · Miniaturas del catálogo · §7
> Fase X03-05 · pendiente · Ola 1: búlgara, banca, jalón, hip thrust y flexiones · §8
> Fase X03-06 · pendiente · Ola 2: lo que cabe en las bases que ya hay · §9
> Fase X03-07 · pendiente · Bases nuevas `bench`, `split` y `floor` · §10
> Fase X03-08 · pendiente · Biblioteca de manos (poses de Blender) · §11
> Fase X03-09 · hecho · Orden del .blend y guía del flujo · §12
>
> Estado: escrita el 8-nov-2026 a partir de lo medido en la rama `feat/x01-peso-muerto` (11 acciones); el mismo día, modelo del catálogo cerrado con el usuario (§2) y maqueta [`catalogo-maniqui-2.html`](../mockups/catalogo-maniqui-2.html) (la v1, con tarjetas, no se entendía). **X03-09 hecha el 9-nov** (`blender/organizar.py`, guía `formfit-mannequin/docs/BLENDER.md`) junto con la parte de Blender de X03-08: las manos son pose assets `mano.*` (solo huesos de la mano) en tres catálogos, con cuatro nuevas por retocar (colgado prono y supino, barra en la espalda, barra de peso muerto) y `ff_status`/`ff_mano` en cada acción; export idéntico (0 de diferencia) salvo el nombre de tres ejercicios. Falta de X03-08 que el visor use `ff_mano`. Concreta X01-11 (un JSON por acción, `ff_status`), X01-12 (la matriz) y X01-08 (miniaturas) para la v1, sin esperar a T08: la clave sigue siendo el id de la ficha.

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

**Manos.** Una acción o variante con las manos **simétricas** apunta a una mano de la biblioteca (`ff_mano`, §11), que es la que pone la app; las **asimétricas** (arquero, remo a un brazo) no apuntan a ninguna y usan los dedos de su acción.

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
  - `mano`: `ff_mano`, la mano de la biblioteca que usa (§11); vacío = la de la acción (manos asimétricas);
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
- **Equilibrio y demanda muscular**: no. El mapa de calor se apaga.
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

- **`bench`** (espalda o escápulas en el banco, pies en el suelo): la pelvis o el tronco fijos al banco como la pelvis al asiento en `seat`; brazos por IK a la barra (como `row`, empujando en vez de tirar); ajustes: anchura y tipo de agarre, implemento (barra, mancuernas), altura de la barra en el pecho, ángulo del banco (plano · inclinado · declinado: si cambia el recorrido, acción propia), pies. Hip thrust: lo fijo son las escápulas y lo que se mueve la cadera. Sin equilibrio.
- **`split`** (un pie delante en el suelo y el otro detrás, en el suelo o en un banco): como `stand` con el centro de masas entre los dos pies (más sobre el de delante); ajustes: largo de la zancada, altura del banco, inclinación del tronco, implemento.
- **`floor`** (manos y pies en el suelo: flexiones, plancha): manos y pies fijos donde están en Blender (como los tobillos plantados); ajustes: anchura de manos, manos elevadas (inclinada/declinada como alturas de caja), rodillas apoyadas. Sin equilibrio.

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
- **Visor:** una acción o variante con `ff_mano` usa **siempre** los dedos de esa mano, con su implemento o con otro (se acaban las tres fuentes). Sin `ff_mano` (manos asimétricas), los de la acción. `tests/fidelity.js` compara entonces los dedos con los de la mano, no con los de la acción.
- **Punto de partida de las nuevas** (colgado prono y supino, barra en la espalda, barra de peso muerto): Claude las saca de los dedos de `pullup`, `Chinup`, `back_squat` y `deadlift`, y el usuario las retoca. Se asignan con `ff_mano` en esas acciones.
- A comprobar al empezar, en Blender 5.0: que aplicar una pose con huesos seleccionados solo toca esos huesos, y cómo se aplica invertida desde el *Asset Shelf*.

**Probar X03-08**

- [ ] En Pose Mode salen las manos en el *Asset Shelf*, por grupos; aplicar una a la mano izquierda solo cambia esa mano, y la invertida pone la derecha igual.
- [ ] Retocar «colgado prono» y exportar cambia los dedos de la dominada y de todo lo que la usa en el visor.
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
- **Guía** `formfit-mannequin/docs/BLENDER.md`, para el usuario y enlazada desde HANDOFF §0: el árbol de arriba con qué es de quién; el camino de una pose (Blender → exportador → índice → app) y de una mano (biblioteca → `ff_mano` → visor) en un dibujo; y tres recetas cortas: retocar un ejercicio y marcarlo `ok`, posar una variante con acción propia, posar o retocar una mano.

**Probar X03-09**

- [ ] Al abrir el .blend se entiende qué es cada colección y cuáles se pueden tocar.
- [ ] Con la guía, retocar un ejercicio, marcarlo `ok` y exportar sin preguntar a Claude.
- [ ] `npm test` sigue en verde tras el orden.

## 13. Fuera de alcance

- Acondicionamiento cíclico (correr, comba, ergómetros, battle rope): necesita animación en bucle.
- Formato binario de poses: el JSON compacto comprimido ya pesa ~3 KB.
- Bajar la resolución de la malla: se mira cuando el resto esté (§3.1).
- La matriz por forma de T08 (X01-12): llega con T08; esta página es la de la v1.

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
| X03-08 | Biblioteca de manos | — | pendiente |
| X03-09 | Orden del .blend y guía | X03-08 | pendiente |
