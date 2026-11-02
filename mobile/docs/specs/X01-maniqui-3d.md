# Spec — Maniquí 3D de ejercicios          (archivo: X01-maniqui-3d.md)

> Tema: ejercicios
> En corto: Un maniquí 3D animado por ejercicio que el entrenador ajusta (profundidad, pies, agarre…) y que se adapta a las medidas del cliente sin perder el equilibrio. El cliente lo ve tal cual se lo dejó el entrenador, dentro de su programa.
> Inicio: 2026-11-02
> Fase X01-01 · hecho · Prueba en WebView desde Expo Go · §3
> Fase X01-02 · pendiente · Visor solo lienzo, protocolo y componente `ExerciseMannequin` · §5
> Fase X01-03 · pendiente · Estética: shader y colores del tema · §6
> Fase X01-04 · pendiente · Maquetas: selector, editor, Workout y los tres modos de lista · §7
> Fase X01-05 · pendiente · Datos: medidas, ajustes en el programa y cómo viajan · §8
> Fase X01-06 · pendiente · Editor: ajustar el ejercicio · §9
> Fase X01-07 · pendiente · Workout: ver el ejercicio del programa · §10
> Fase X01-08 · pendiente · Miniaturas de inicio y final · §11
> Fase X01-09 · pendiente · Selector de ejercicios con imagen · §12
> Fase X01-10 · pendiente · Preferencia: cómo se ven las listas de ejercicios · §13
> Fase X01-11 · pendiente · Blender: una acción por forma, exportación por ejercicio · §14
> Fase X01-12 · pendiente · Herramientas de Blender: matriz de formas, crear desde otra y hoja de revisión · §15
> Fase X01-13 · pendiente · Tipos de base por apoyo y un básico por patrón · §16
> Fase X01-14 · pendiente · Contenido completo: todas las formas de T08 · §17
>
> Estado: el sistema llega de un chat externo y vive en [`formfit-mannequin/`](../../../formfit-mannequin/) (Blender → `mannequin.glb` + `poses.json` → `runtime.js`); su documento principal es [`HANDOFF.md`](../../../formfit-mannequin/docs/HANDOFF.md). **X01-01 probada en parte** (2-nov-2026): va muy fluido y abre en un segundo o menos, así que **se sigue por la WebView** (camino A, §1). Decisiones del usuario en §2 (dos rondas, 2-nov-2026). **Hoy solo se deja la spec definida**; nada más se implementa. El resto de la spec está escrita el 2-nov-2026 y sin implementar; X01-04 (maquetas) va antes que cualquier UI.

## 1. Contexto

Tres ejercicios autorados en Blender (sentadilla trasera, frontal y prensa). Con los valores por defecto el visor reproduce la pose de Blender al milímetro; sliders y medidas del cliente solo añaden la diferencia que calcula el solver, y un lazo cerrado mantiene el centro de masas.

Dos caminos para meterlo en la app:

- **A · WebView** con el visor autocontenido. Reutiliza el 100 % del código y de los tests; se paga con la apertura (≤ 1 s medido) y una frontera de mensajes. **Elegido.**
- **B · nativo** con `expo-gl` + `@react-three/fiber/native` ([`PORTING.md`](../../../formfit-mannequin/docs/PORTING.md)). Solo si A se queda corto.

En la WebView el 3D corre en el motor del navegador del sistema (V8/JSC, con JIT), no en Hermes, así que lo que se ve en Expo Go vale para la build. `runtime.js` sigue siendo la única fuente de verdad: el navegador, los tests de `formfit-mannequin/` y la app cargan el mismo.

**Coste en memoria** (estimado, sin medir): unos 80–150 MB por WebView montada (proceso del navegador + three + malla). Parada no gasta batería; animando a 60 fps sí. De ahí tres reglas que valen para todas las fases:

- **Nunca una WebView por fila** de una lista: en las listas van miniaturas (§11).
- **Una WebView por pantalla** como mucho, que cambia de ejercicio por mensaje sin recargar.
- **Se pausa** cuando no se ve (pantalla en segundo plano, tarjeta plegada, app en segundo plano).

## 2. Decisiones del usuario (2-nov-2026, no reabrir)

1. **El cliente no edita nada del maniquí.** No puede editar el programa ni el ejercicio, así que tampoco sus ajustes ni sus medidas. Solo **visualiza**: reproducir, ir al inicio o al final, cambiar de vista, girar.
2. **Quien entrena solo edita todo**: sus medidas y los ajustes de cada ejercicio, como su propio entrenador.
3. **No es PRO.** Si funciona, es el gancho de la app.
4. **Ejercicio sin maniquí: no se enseña nada.** Ni hueco, ni genérico, ni «próximamente».
5. **Las variantes son poses, no ajustes.** Remo supino, prono, neutro, polea alta… cada una es su acción en Blender con su metadata. Al pulsar una variante en la app, se ve la suya. Los ajustes de la app (anchura de pies, profundidad…) son otra cosa: preferencias o ajustes antropométricos sobre esa pose.
6. **El maniquí se busca por movimiento y forma**, los de [T08](T08-catalogo-por-movimientos.md): el movimiento sale del patrón y la forma de los chips.
7. **Tres modos de lista**, elegibles en Preferencias: imagen grande (manda la imagen), imagen secundaria (manda el texto) y sin imagen (como hoy).
8. **El aspecto se adapta a la app**: shader y colores con los del tema.

Segunda ronda, el mismo día:

9. **Anchura y giro de pies, y agarre supino/prono/neutro, son preferencias del ejercicio**, no del cuerpo: se guardan en cada ejercicio del programa. Se enseñan como **chips de los que no cambian el ejercicio** (los «solo informa» de P09/T08), que funcionan como **preajustes**: «Pies anchos» pone la anchura y el giro de una vez; el slider queda para afinar (§8, §9).
10. **Todas las formas y variantes de T08 son acciones de Blender**, no solo los movimientos: de un implemento a otro cambia el recorrido de las manos (press militar con barra, mancuernas o kettlebell no es el mismo), y de pie a sentado cambia todo. Se empieza por los básicos (§16), pero al final se hacen todas (§17). Como son muchas combinaciones, hace falta **un sistema en Blender para crear una a partir de otra y revisarlas todas de un vistazo** (§15).
11. **El modo de lista por defecto se pregunta en el onboarding** (§13).
12. **Se empieza por un básico de cada patrón** para validar el código por patrón: sentadilla, bisagra, tracción vertical, tracción horizontal, empuje horizontal y empuje vertical (§16).
13. **La polea tiene altura ajustable**, pero **un jalón no es una polea alta**: en el jalón el cable baja desde más arriba y por delante, con su máquina, asiento y tope de rodillas; no es subir la polea por su columna (§16).

## 3. X01-01 · Prueba en WebView

- `formfit-mannequin/prototype/build.py` mete three.js dentro del HTML (antes venía de un CDN) y escribe una copia en `mobile/assets/mannequin/viewer.html`.
- `metro.config.js` trata `.html` como asset; `expo-asset` lo deja en un `file://` local y `react-native-webview` lo carga.
- Pantalla `MannequinTestScreen`, solo en desarrollo: menú › Desarrollador › «Maniquí 3D (prueba)». Enseña el visor con su propia UI web.

Visto en el navegador a 375 px: la fila de botones de arriba (Frente · Lateral · 45° · Músculos…) se solapa; es de la UI web, que X01-02 quita. Las fuentes del visor vienen de Google Fonts: sin red sale la de sistema (también desaparece con X01-02).

**Probar X01-01**

- [x] En Expo Go: menú › Desarrollador › «Maniquí 3D (prueba)» abre el visor y sale el maniquí animado, sin red.
- [ ] Girar y acercar con el dedo va fluido y no se pelea con el gesto de volver atrás.
- [x] Los sliders y el cambio de ejercicio (trasera · frontal · prensa) responden sin tirones.
- [x] Apuntar cuánto tarda en abrir la primera vez y las siguientes. — 2-nov: un segundo o menos.

## 4. Las tres capas de datos

| Capa | Qué es | Dónde vive | Quién la edita |
|---|---|---|---|
| **Pose** | La acción de Blender de una forma (§14) | assets de la app (`poses/<formKey>.json`) | el usuario, en Blender |
| **Medidas** (`body`) | altura, fémur, tibia, tronco, dorsiflexión | ficha del cliente · perfil propio | el entrenador · quien entrena solo |
| **Ajustes** (`params`) | profundidad, anchura y giro de pies, agarre, altura de barra… | en el ejercicio **del programa** (`exConfig.mannequin`) | quien edita el programa |

`runtime.js` ya recibe exactamente esto: `evaluate(ejercicio, s)` con `params` y `body` (HANDOFF §4.5). Lo que se guarda por cliente y ejercicio es un JSON de pocos bytes, y **solo lo que difiere del valor por defecto**: un ejercicio sin tocar no guarda nada.

## 5. X01-02 · Visor solo lienzo, protocolo y componente

**El HTML** (`shell.html` + `runtime.js`): fuera toda la UI web. Queda el lienzo, el giro con el dedo y los overlays de dibujo (línea del mediopié, trayectoria). Los indicadores (tronco, muslo, CdM…) se mandan a la app y se pintan en nativo.

**Protocolo** (`postMessage`, JSON, versionado con `v`):

| Sentido | Mensaje | Para qué |
|---|---|---|
| app → visor | `{ type: 'load', v, poseKey, params, body }` | cambiar de ejercicio sin recargar |
| app → visor | `{ type: 'set', params?, body? }` | mover un slider |
| app → visor | `{ type: 'play' \| 'pause' \| 'seek', s? }` | reproducir, parar, ir a inicio (0) o final (1) |
| app → visor | `{ type: 'view', id: 'front' \| 'side' \| 'three' }` | vista |
| app → visor | `{ type: 'theme', tokens }` | colores (§6) |
| app → visor | `{ type: 'snapshot', s, size }` | pedir una imagen (§11) |
| visor → app | `{ type: 'ready' }` · `{ type: 'readout', … }` · `{ type: 'warn', code }` · `{ type: 'image', dataUrl }` | |

Los avisos llegan como **códigos** (`hand_unreachable`…), no como texto: el texto lo pone i18n en la app.

**Componente** `src/components/exercise/ExerciseMannequin.jsx`:

```jsx
<ExerciseMannequin poseKey params body editable={false} paused={!visible} onReadout={…} />
```

- Carga el HTML una vez (lo que ya hace `MannequinTestScreen`) y manda `load` cuando cambia `poseKey`.
- `paused` se pone solo con el foco de la pantalla (`useIsFocused`) y con `AppState`.
- Si Android mata el proceso del navegador (`onRenderProcessGone`), recarga y vuelve a mandar `load`.
- `MannequinTestScreen` pasa a usar el componente, con los sliders nativos de prueba.

Los tests de `formfit-mannequin/` (`npm test`: fidelidad 0,0 mm y equilibrio) **tienen que seguir pasando**: quitar la UI no toca la matemática.

**Probar X01-02**

- [ ] La pantalla de prueba enseña solo el lienzo; los sliders son nativos y mueven el maniquí sin tirones.
- [ ] Cambiar de ejercicio no recarga la WebView (no hay parpadeo blanco).
- [ ] Salir de la pantalla y volver: estaba parado y sigue donde estaba.

## 6. X01-03 · Estética

- `runtime.js` ya lee los colores de tokens CSS (`readTheme`). La app manda los del tema activo con `theme` y el visor reescribe los tokens: fondo, cuerpo, articulaciones, contorno, acento (trayectoria) y la rampa del mapa de calor.
- La correspondencia tema → tokens del visor se decide con maqueta en X01-04 (cuerpo neutro sobre `surface`, trayectoria en `accent`, calor en la gama del tema…), y se aplica a los seis temas (`THEME_LIST`).
- Suelo, barra, discos y máquina: planos y en grises del tema; el protagonista es el cuerpo.

**Probar X01-03**

- [ ] Con cada tema el maniquí encaja con la pantalla que lo rodea; cambiar de tema con el visor abierto lo cambia en el momento.

## 7. X01-04 · Maquetas

Antes de cualquier UI, una maqueta HTML en `docs/mockups/` con variantes, como en el resto de rediseños. Preguntas que tiene que cerrar:

- **Selector de ejercicios**: cómo es la fila en cada uno de los tres modos (§13). Al pulsar una forma en la hoja «Elegir forma» de T08, ¿el visor sale en la propia hoja o se abre aparte?
- **Workout**: imagen pequeña por defecto, con **inicio y final** del recorrido. Al pulsar: **¿se abre un visor (hoja) o se amplía la imagen en su sitio y pasa a 3D?** Lo mismo durante el descanso.
- **Editor de ejercicio**: dónde van el visor y los sliders, y cómo se agrupan (ejercicio · cuerpo). Cómo se ve «este ejercicio tiene ajustes» en la lista de la sesión.
- **Visor abierto**: controles de reproducir, inicio, final y vistas para el cliente (§2.1), en nativo.
- **Ficha del cliente**: dónde se meten sus medidas, con los preajustes (fémur largo, tronco largo, tobillo rígido) para no pedir números a ciegas.
- Tokens del tema en el visor (§6).

**Probar X01-04**: es una maqueta; se cierra cuando el usuario elige. Pasa a `terminado`.

## 8. X01-05 · Datos

**Medidas.**

- **Cliente**: `client.body = { height, femur, tibia, torso, dorsi }` en su ficha, junto al peso que ya existe (`addClientBodyWeight`). Lo edita solo el entrenador.
- **Quien entrena solo**: `profile.body`, mismo formato. Sin medidas = el cuerpo por defecto del visor (180 cm, todo al 100 %, 35° de tobillo).

**Ajustes.** `exConfig.mannequin = { depth: 0.9, toes: 10 }`: solo las claves que difieren del valor por defecto del tipo de base. Va con el resto del `exConfig` (series, reps, tempo), así que **viaja con el programa sin código de sincronización nuevo** y entra en las copias.

**Cómo llegan las medidas al cliente.** La ficha del cliente es privada del entrenador: el cliente no la lee (nucleo.md, *Lo privado del entrenador*). Por eso las medidas **viajan dentro del programa enviado**: al enviar, se copia `client.body` a `program.mannequinBody`. El cliente lee `program.mannequinBody`; quien entrena solo, `profile.body`. Si el entrenador cambia las medidas, llegan con el siguiente envío, como cualquier otro cambio del programa.

**Qué pose se usa.** `poseKeyOf(exerciseId)`: la acción de esa forma si existe; si no, **nada** (§2.4). Hasta que exista T08, la clave es el id de la ficha del catálogo (`squat_barbell`, `front_squat_barbell`, `leg_press_standard`). Con T08 pasa a movimiento + forma (§14).

**Permisos** (§2.1–2.2): `editable` = es mi programa (quien entrena solo) o soy el entrenador editando el de un cliente. El cliente con entrenador nunca ve sliders.

**Preferencias del ejercicio como chips** (§2.9). Anchura y giro de pies, anchura de agarre y su orientación son del ejercicio, no del cuerpo. Cada movimiento declara sus chips de preajuste junto a sus ejes de T08; un chip escribe uno o varios ajustes, o elige la variante de Blender:

```js
// en movements.js (T08), solo los ejes que no cambian el ejercicio
presets: {
  feet: { narrow: { stance: 0.85, toes: 0 }, normal: {}, wide: { stance: 1.25, toes: 15 } },
  grip: { prone: '@grip=prone', supine: '@grip=supine', neutral: '@grip=neutral' },  // variante = otra acción
}
```

- Un chip que apunta a una variante (`@grip=…`) cambia la **pose**; uno que apunta a valores cambia los **ajustes**. Para quien edita es lo mismo: un chip.
- Mover un slider después deja el chip sin marcar («a medida»).
- Agarre y anchura ya se guardan hoy como variante que solo informa (P09). El chip **es** esa variante, no un dato nuevo: así lo que se apunta en el entreno y lo que enseña el maniquí no pueden ir por separado.
- Lo que no tiene chip (profundidad, avance de rodillas, altura de barra…) se queda en sliders.

**Probar X01-05**

- [ ] Entrenador: pone medidas a un cliente, ajusta su sentadilla, envía; el cliente ve el maniquí con esas medidas y esos ajustes.
- [ ] El cliente no ve sliders ni puede cambiar nada; sí reproducir, inicio, final y vistas.
- [ ] Quien entrena solo cambia sus medidas y sus ajustes, y se mantienen al cerrar la app y al restaurar una copia.
- [ ] Un ejercicio sin pose no enseña nada.

## 9. X01-06 · Editor

En el editor de ejercicio (la pantalla que ya tiene series, reps y tempo), según la maqueta de X01-04: el visor con las medidas del cliente (o las propias) y los sliders del tipo de base, con su texto en i18n (hoy están en `PARAMS` de `runtime.js`; las etiquetas pasan a `locales`). Encima de los sliders, los chips de preajuste (§8). «Restablecer» vuelve a la pose autorada.

**Probar X01-06**

- [ ] Mover cada slider cambia el maniquí y el valor queda guardado en ese ejercicio del programa, no en otros.
- [ ] Restablecer deja el ejercicio sin ajustes.
- [ ] «Pies anchos» cambia anchura y giro de una vez; tocar luego el slider desmarca el chip.
- [ ] Supino → prono cambia la pose (otra acción), y en el Workout se apunta esa variante.

## 10. X01-07 · Workout

Según la maqueta: la imagen del ejercicio (inicio y final) con los ajustes y las medidas de ese programa; al pulsarla, el visor. **Una sola WebView** en todo el entreno, montada al abrirla por primera vez, que cambia de ejercicio por mensaje y se pausa cuando no se ve.

**Probar X01-07**

- [ ] Abrir el visor en un ejercicio, cerrarlo, pasar al siguiente y abrirlo: no vuelve a tardar en cargar.
- [ ] Un entreno de una hora con el visor abierto de vez en cuando no calienta el móvil más de lo normal.

## 11. X01-08 · Miniaturas

Las imágenes de inicio y final son **capturas del propio visor**, no dibujos aparte:

- **Catálogo** (pose por defecto, cuerpo por defecto): se generan al exportar, con el harness de `formfit-mannequin/tests` (como `npm run shots`), y van como assets (`webp`, pequeñas). Así el selector no monta ninguna WebView.
- **Con ajustes o medidas** (Workout, editor): se generan **en el móvil** con `snapshot` y se guardan en caché con la clave `hash(poseKey, params, body, tema)`. Si la caché no la tiene, se enseña la del catálogo mientras tanto.

**Probar X01-08**

- [ ] El selector enseña las miniaturas sin retraso y sin red.
- [ ] Tras ajustar un ejercicio, su miniatura en el Workout refleja el ajuste.

## 12. X01-09 · Selector de ejercicios

Las miniaturas en las filas del buscador según el modo de lista (§13). En la hoja «Elegir forma» de T08, al pulsar una variante se ve **su** pose (§2.5) en el sitio que decida la maqueta. Depende de T08-04 para la hoja; las filas no.

**Probar X01-09**

- [ ] Pulsar variantes en la hoja cambia el maniquí a la de cada una; una variante sin pose no enseña nada.

## 13. X01-10 · Preferencia de lista

En Preferencias, «Ejercicios en las listas», con tres valores, para el selector y el Workout:

| Valor | Cómo se ve |
|---|---|
| **Imagen grande** | manda la imagen; el nombre va debajo o encima |
| **Imagen secundaria** | manda el texto; miniatura pequeña a un lado |
| **Sin imagen** | como hoy |

**El modo se pregunta en el onboarding** (§2.11): un paso con los tres modos dibujados, en el tramo común junto a unidades y tema. Si se salta, queda imagen secundaria. Ese paso pide su tarea en la spec de onboarding vigente cuando se implemente esta. Un ejercicio sin pose se ve siempre como «sin imagen», en cualquier modo.

**Probar X01-10**

- [ ] Cambiar el modo en Preferencias cambia el selector y el Workout al volver a ellos.
- [ ] El onboarding pregunta el modo; saltarlo deja imagen secundaria.

## 14. X01-11 · Blender: una acción por forma

**Un solo archivo** (`FormFit_Maniqui.blend`), un solo rig y **una acción por forma y variante** (§2.10): las acciones pesan poco y así un cambio en el rig vale para todas. Se divide solo si un día molesta (lentitud, conflictos), enlazando el rig desde un archivo maestro.

**Nombre de la acción = su clave**, con la forma de T08:

```
<movimiento>.<valores de los ejes que cargan>[@<variante>=<valor>]
row.barbell-bent-bi                 remo con barra inclinado
row.barbell-bent-bi@grip=supine     su variante con agarre supino
ohp.db-standing-bi                  press militar con mancuernas, de pie
ohp.db-seated-bi                    el mismo, sentado
```

**Metadata en la acción** (propiedades personalizadas, como `ff_base` y `ff_name` hoy): `ff_base` (tipo de base, §16), `ff_movement`, `ff_form` (JSON con los ejes), `ff_variant` y `ff_status` (`borrador` · `revisar` · `ok`). El exportador las vuelca a `meta`, comprueba que el nombre cuadra con ellas y **solo exporta las `ok`**.

**Búsqueda en la app**: forma + variante → forma → nada. No se cae al movimiento genérico: una pose que no es la del ejercicio enseña mal la técnica (§2.4).

**Exportador**: un JSON por acción (`poses/<clave>.json`, ~40 KB) en vez de `poses.json` entero, más un índice con las claves y su `meta`. El visor carga solo el que pide `load`.

**Hasta T08**: la clave es el id de la ficha (`squat_barbell`) y una tabla `poseKeyOf` mapea. Cuando T08-01 dé `movement` y `form` a cada ficha, la tabla desaparece.

**Probar X01-11**

- [ ] Exportar con una acción mal nombrada o sin metadata falla con un mensaje claro.
- [ ] Una acción en `borrador` no llega a la app.
- [ ] `npm test` de `formfit-mannequin/` sigue a 0,0 mm con los JSON por ejercicio.

## 15. X01-12 · Herramientas de Blender

El problema (§2.10): un movimiento son decenas de combinaciones (implemento × postura × lado × variantes), y cada una necesita su pose porque el recorrido cambia. Crear una tiene que ser rápido, y **revisarlas todas** también. Tres piezas, en un add-on propio (`blender/ff_tools.py`) con su panel junto al del rig:

**1. La matriz.** Lee las formas válidas de T08 (`movements.js` volcado a JSON: ejes, `valid`, `presets`) y las cruza con las acciones del archivo. Por movimiento enseña una tabla: cada forma y variante con su estado (**falta** · borrador · revisar · ok). Pulsar una fila abre su acción. El exportador imprime el mismo resumen («Press militar: 7 de 12 ok, faltan 3»).

**2. Crear desde otra.** Se elige una forma que falta y una hecha de la que partir («mancuernas, de pie» desde «barra, de pie»). El script:

- duplica la acción con el nombre y la metadata nuevos, en `borrador`;
- cambia el **implemento**: enseña sus props, oculta los demás y reengancha las manos al hueso del implemento nuevo con los padres de IK de `PROPERTIES` (como hoy la barra: `ARM_IK_parent = 5`). Cada implemento es un hueso con su **toma** (dónde va la mano): barra (una, sobre su eje), mancuernas y kettlebells (dos, `IMPL.L/R`, independientes), asa de polea, anillas…;
- pone el implemento nuevo **donde estaba el anterior** en las dos claves, como punto de partida;
- si cambia la **postura** (de pie ↔ sentado), aplica la plantilla de cuerpo de esa postura (pelvis en el asiento, pies apoyados) y mantiene lo de la cintura para arriba;
- deja la acción abierta para retocar a mano lo que cambia de verdad: con mancuernas las manos bajan más y rotan, con kettlebell el antebrazo va vertical.

`autopose.py` ya hace algo parecido a partir de direcciones de segmentos (HANDOFF §2.4): es la base.

**3. La hoja de revisión.** Un script (desde Blender, o desde el harness que ya hace `npm run shots`) que renderiza **inicio y final de todas las formas** de un movimiento, en lateral y frontal, y las pone en una página HTML en rejilla: una fila por forma, con su estado. Así se ven las doce de un press militar a la vez y salta a la vista la que tiene la mano mal. Las mismas capturas sirven de miniaturas del catálogo (§11).

**Probar X01-12**

- [ ] La matriz del press militar lista todas sus formas válidas y marca las que faltan.
- [ ] Crear «mancuernas, de pie» desde «barra, de pie» deja una acción en borrador con las mancuernas en las manos, sin barra, lista para retocar.
- [ ] La hoja de revisión del press militar enseña inicio y final de todas sus formas en una página.

## 16. X01-13 · Tipos de base por apoyo y un básico por patrón

**¿El mismo código vale para tracción vertical y horizontal?** Sí, si los tipos de base se definen por **cómo se apoya el cuerpo** y no por la dirección del movimiento. Por dónde va la carga es el recorrido del implemento, y eso ya viene de Blender. Lo que cambia el solver es dónde está el apoyo y si hay que equilibrar:

| Tipo de base | Apoyo | Equilibrio | Ejemplos |
|---|---|---|---|
| `stand` (existe) | pies en el suelo | sí: CdM sobre el mediopié | sentadilla, peso muerto, remo inclinado, press militar de pie |
| `seat` (existe: prensa) | pelvis en el asiento (+ pies) | no | prensa, jalón, remo sentado en polea, press militar sentado |
| `bench` | espalda en el banco (+ pies) | no | press de banca, remo con pecho apoyado |
| `hang` | manos en la barra | sí: el cuerpo cuelga bajo las manos | dominada |

Un tipo de base nuevo es: dónde se fija el cuerpo, qué sliders tiene y cómo se equilibra (o que no hace falta). El IK de brazos y piernas que conserva el estilo (`solveLimb`) ya es común a todos.

**Los básicos** (§2.12), uno por patrón, para validar cada tipo de base antes de llenar el catálogo:

| Patrón | Básico | Tipo de base | Implemento nuevo |
|---|---|---|---|
| Sentadilla | sentadilla trasera (hecha) | `stand` | — |
| Bisagra | peso muerto convencional | `stand` | — (la barra sale del suelo) |
| Tracción vertical | dominada | `hang` | barra fija |
| Tracción vertical | jalón al pecho | `seat` | máquina de jalón |
| Tracción horizontal | remo con barra | `stand` | — |
| Tracción horizontal | remo sentado en polea | `seat` | polea |
| Empuje horizontal | press de banca | `bench` | banco |
| Empuje vertical | press militar de pie | `stand` | — |

**Polea y jalón** (§2.13) son dos implementos distintos:

- **Polea (columna)**: un anclaje en una columna; el cable va del anclaje al asa. **Su altura es un ajuste** (`pulleyH`, del suelo a lo alto de la columna). Al cambiarla, el anclaje sube o baja por la columna y el cable cambia de ángulo; la pose se corrige con el mismo método de diferencias.
- **Jalón (máquina)**: la polea está **arriba y por delante**, por encima de la cabeza, con asiento y tope de rodillas. El cable baja casi vertical desde más alto que cualquier posición de la columna. Es su propia máquina (hueso y props), no una polea en lo alto.

En un movimiento de polea (remo, face pull, extensión de tríceps…), si la altura **cambia el ejercicio** (polea alta frente a baja) es un eje de T08 y va como acción; si **solo afina**, es el ajuste `pulleyH`. Se decide movimiento a movimiento al cerrar sus formas.

**Probar X01-13**

- [ ] Los ocho básicos se ven en el visor con su pose de Blender (fidelidad 0,0 mm salvo las excepciones documentadas).
- [ ] Peso muerto y press militar de pie siguen equilibrados (CdM en su valor autorado) al cambiar las medidas.
- [ ] Dominada: al cambiar las medidas, el cuerpo sigue colgando bajo las manos.
- [ ] Remo en polea: subir y bajar `pulleyH` mueve el anclaje por la columna y el cable sigue a las manos.
- [ ] Jalón: el cable baja desde arriba y por delante, no desde lo alto de una columna.

## 17. X01-14 · Contenido completo

Todas las formas y variantes de T08 (§2.10), movimiento a movimiento, con las herramientas de §15. Un movimiento está cerrado cuando su matriz está entera en `ok`. El orden lo decide el usuario según lo que más se use; los tipos de base que falten (zancada, tumbado boca abajo, cuadrupedia…) se añaden a §16 cuando aparezcan.

**Probar X01-14**: movimiento a movimiento con la hoja de revisión; cada uno se añade aquí como casilla al cerrarlo.

## 18. Fuera de alcance

- Render nativo (camino B), salvo que la WebView se quede corta.
- Mapa de calor muscular como información para el usuario: hoy es una estimación (HANDOFF §6); se enseña o no según la maqueta.
- Maniquí en la web pública.
