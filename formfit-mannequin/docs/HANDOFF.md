# Maniquí 3D de FormFit: cómo funciona todo

Documento principal del módulo: qué hay en Blender, qué hace cada script, qué se exporta y cómo el visor lo convierte en una pose ajustable. Las reglas raras van con su porqué; vienen de muchas iteraciones con el usuario. **Si vas a tocar algo, lee entera la §0**; el resto se consulta cuando haga falta.

---

## 0. Empezar aquí

### 0.1 Qué es

Un maniquí 3D animado por ejercicio para la app (spec [X01](../../mobile/docs/specs/X01-maniqui-3d.md); agarres e implementos en [X02](../../mobile/docs/specs/X02-agarres-implementos.md)). El usuario anima cada ejercicio en Blender; el visor (`prototype/runtime.js`, empaquetado en `viewer.html` y cargado por una WebView en la app) reproduce esa animación y la adapta a los ajustes del entrenador (anchura, profundidad, rodilla, agarre, implemento…) y a las medidas del cliente (altura, fémur, tibia, tronco, tobillo).

Hoy hay nueve ejercicios: sentadilla trasera y frontal (`stand`), prensa (`seat`), peso muerto convencional y rumano (`hinge`), dominada (`hang`, con la variante supina `Chinup`), remo con barra (`row`, con la variante `barbell_row_supino`), remo en polea y remo en polea a un brazo (`cable`).

**Rama:** todo el trabajo del maniquí va en su propia rama, `feat/x01-peso-muerto`, en la carpeta del proyecto (no en una carpeta aparte: Expo Go sirve desde ella). Nunca en `develop`: es una feature larga y `develop` sigue recibiendo otras.

### 0.2 Reglas que no se rompen

1. **Con los valores por defecto sale la pose de Blender**: 0,0 mm en cada clave y cada muestra exportada (`tests/fidelity.js`). Excepciones documentadas: la prensa (§4.4) y las claves de bisagra con el codo flexionado en Blender (§4.4b).
2. **Correcciones como diferencias**: el visor parte de la pose autorada y solo añade lo que cambian los ajustes o el cuerpo. El estilo humano lo pone el usuario en Blender; un solver no sabe inventarlo.
3. **Lo que se ve debe tener sentido físico** (manos que no resbalan en la barra, brazos rectos al tirar del suelo, pies que no deslizan, centro de masas dentro del pie…), pero **sin quitarle intención a la animación**: si una corrección automática apenas aporta, se quita (el balanceo de la dominada se quitó por eso).
4. **Una acción por movimiento, no por implemento** (X01 §2.15). Cambiar de barra a mancuernas lo hace la app; un movimiento distinto, o una variante que el usuario quiera controlar a mano (la dominada supina), es otra acción (§2.6).
5. **Longitudes rígidas** (sin IK stretch) y **ejes**: glTF tiene Y arriba y +Z delante (§3.2).
6. Después de tocar `runtime.js` o el exportador: `npm test`, `npm run shots` y **mirar las capturas**.

### 0.3 Cómo se trabaja con el usuario

El usuario es desarrollador y diseñador: anima y retoca en Blender, prueba en el móvil y decide. Claude hace la base, el código y las comprobaciones.

1. **Base por script.** Claude escribe `blender/ejercicios/<id>.py` (§2.5), lo ejecuta sobre el `.blend` y comprueba con un render rápido que tiene sentido. Antes de escribir en el `.blend`, mira `git status`: si tiene cambios sin commitear, son del usuario (haz copia o pregunta).
2. **Retoque a mano.** El usuario retoca en Blender y guarda. Puede añadir claves intermedias y acciones nuevas (variantes).
3. **Exportar y medir.** Claude exporta (§3), pasa los tests y **mide**: compara el visor con los frames reales de Blender (§0.5) en vez de fiarse de la vista. Casi todos los fallos que el usuario vio en el móvil se encontraron así.
4. **Commit** con todo lo generado: el `.blend`, `assets/poses.json`, `assets/mannequin.glb` y `mobile/assets/mannequin/viewer.html` (lo copia `build.py`). Código de tarea en el mensaje (`X01-13`, `X02-04`…). Rama de trabajo: `feat/x01-peso-muerto`.
5. **El usuario lo mira en el móvil** (Expo Go › menú › Desarrollador › «Maniquí 3D (prueba)») y comenta.

Las conversaciones son en español, y los comentarios del código y los textos del visor, también.

### 0.4 Receta: un ejercicio nuevo

1. **Tipo de base** (cómo se apoya el cuerpo, X01 §16):

   | Base | Apoyo | Qué resuelve el visor | Ejemplos |
   |---|---|---|---|
   | `stand` | pies; barra en el tronco | CdM sobre el mediopié moviendo el tronco | sentadillas, press militar de pie |
   | `hinge` | pies; peso en las manos | tibia y tronco para el CdM y la trayectoria de la barra; brazos rectos; implementos | peso muerto, rumano |
   | `cable` | pelvis en el asiento, pies en la plataforma; maneral con cable a una polea | brazos que tiran; altura de la polea; tronco (inclinación y balanceo); manerales | remo en polea |
   | `row` | pies; peso en las manos, tronco fijo | brazos que tiran (codo libre); inclinación y destino de la barra; CdM con la cadera; implementos | remo con barra |
   | `hang` | manos en una barra fija | hombros bajo las manos, manos quietas en la barra, agarres | dominada, chin-up |
   | `seat` | pelvis en el asiento | plataforma sobre su raíl | prensa; jalón y remo en polea (por hacer) |

   Si ninguno vale (tumbado en banco, por ejemplo), hace falta uno nuevo: una rama en `evaluateInner`, sus `PARAMS[base]` y sus tests.
2. **¿Hay un vecino?** Parte de su script (el rumano salió del convencional; la dominada supina, de la prona). Si es la misma acción con otro agarre que el usuario quiere controlar, es una **variante** (§2.6).
3. **Script** `blender/ejercicios/<id>.py`: `META = (acción, base, nombre)`, `PARAMS` (los mandos, con valor, rango y etiqueta) y `frames(F, p)`, que coloca tronco, pies, implemento y manos con `ffpose` (§2.5). Frame 1 = inicio, 30 = final; `ffpose.key` keya **todo** el rig.
4. **Ejecutarlo** y renderizar una comprobación (§0.5). El usuario lo retoca.
5. **Exportar** (§3). El visor lo recoge solo con su `meta`; añade el nombre corto en `EXERCISES` (runtime.js) y, si la cámara no lo encuadra, su objetivo en el bucle de render (`target.lerp`).
6. **Tests**: `fidelity.js` lo cubre solo; añade a `balance.js` lo propio de su base (saltos entre frames, manos en la barra…) y a `screenshots.js` sus capturas.
7. **Documentar**: su sección en §4, la tabla de `PARAMS` (§4.5) y el estado en la spec X01 (§16).

### 0.5 Cómo comprobar

- `npm test` (build + fidelidad + equilibrio) y `npm run shots` (capturas en `tests/shots/`). **`npm run shots` no reconstruye el visor**: si has tocado `runtime.js`, `npm run build:viewer` antes.
- **Sondas del visor:** un script de Node que abre el visor con `tests/harness.js` y llama a `window.__dbg` (`evaluate(ex, s)`, `authoredPose`, `POSES`, `state`…). Así se miden ángulos, alturas, saltos entre frames o tiempos por frame. Patrón:

  ```js
  const { open } = require('./tests/harness');
  (async () => { const { page, close } = await open();
    console.log(await page.evaluate(() => { const D = __dbg, S = D.state; S.playing = false; S.exId = 'pullup';
      S.per.pullup.gripType = 'supino';
      return [0, 0.5, 1].map(s => D.evaluate('pullup', s).readout.map(x => x.join(' ')).join(' · ')).join('\n'); }));
    await close(); })();
  ```
- **Comparar con Blender frame a frame:** con un script de `bpy` se recorren los frames 1–30 de la acción (sin IK stretch, como el exportador) y se vuelcan posiciones de huesos en coordenadas glTF (`C @ p`); luego se comparan con `evaluate(ex, (frame − 1) / 29)`. Así se encontraron el desfase de los tobillos (§4.3), las manos que se movían en la barra (§4.4c) y el ritmo distinto al de Blender (§3.1).
- **Render rápido en Blender** (Workbench, cámara a un lado y de frente) para ver una acción recién creada sin abrir la interfaz.
- Blender en este equipo: `C:/Program Files/Blender Foundation/Blender 5.0/blender.exe`, siempre con `-b --factory-startup` (un add-on del usuario falla en modo `-b`).

---

## 1. Visión general

```
 Blender (FormFit_Maniqui.blend)              export.py                          runtime.js (visor)
 ┌───────────────────────────────┐   ┌─────────────────────────────┐   ┌───────────────────────────────────────┐
 │ Rig del maniquí (~290 huesos) │   │ esqueleto limpio DEF-*      │   │ pose autorada: curvas entre poses      │
 │ 1 acción por movimiento       │──▶│ mannequin.glb (malla)       │──▶│ + correcciones por tipo de base        │
 │ frame 1 = inicio, 30 = final  │   │ poses.json: claves + 1 de   │   │   (ajustes, cuerpo, equilibrio)        │
 │ (+ claves intermedias)        │   │ cada 5 frames, implementos, │   │ + implementos y manos de referencia    │
 │ manos de referencia `_mano.*` │   │ manos de referencia         │   │ + heatmap + estética toon              │
 └───────────────────────────────┘   └─────────────────────────────┘   └───────────────────────────────────────┘
```

**La idea clave:** el entrenador ve exactamente lo que se posó en Blender. Cada ajuste o medida del cliente añade solo la diferencia que calcula el visor. Así se conserva el estilo humano de la pose y aun así el maniquí se adapta.

Escalar a cientos de ejercicios significa: una acción por movimiento en Blender, un tipo de base que ya exista y ejecutar el exportador. Código nuevo solo para un tipo de base nuevo.

---

## 2. Blender

### 2.1 El archivo `blender/FormFit_Maniqui.blend`

Es el maniquí del usuario (`Mannequin` + `Armature_Mannequin`) con estos cambios:

- **Drivers rotos corregidos o eliminados**, y huesos auxiliares (`MCH_HIPS`, `WGT_*`) desmarcados como deform. Lo hace `prep_rig.py`.
- **Huesos de implementos** (no deform), hijos de `ROOT`:
  - `BARRA`: su eje Y local es el eje de la barra (X del mundo).
  - `MAQUINA`: la prensa. Lleva el asiento, el respaldo y las asas como objetos emparentados al hueso.
  - `PLATAFORMA`: hijo de `MAQUINA`. Su eje Y es la normal de la plataforma, que mira al usuario.
- **Padres de IK nuevos** en el hueso `PROPERTIES`:
  - `ARM_IK_parent.L/R`: 0 Root, 1 Torso, 2 Hips, 3 Chest, 4 Head y **5 Barra**. Las manos siguen a la barra.
  - `FOOT-IK-PARENT.L/R`: 0 Root, 1 Torso y **2 Plataforma**. Los pies siguen a la plataforma.
  - Las dos propiedades están keyadas con interpolación CONSTANT.
- **Sin IK stretch**: `ik_stretch = 0` y `use_stretch = False`. El rig original estiraba los brazos y las piernas hasta un ±5 % para alcanzar el objetivo, y eso rompía la adaptación a las medidas del cliente.
- **Back squat, frame 1**: el TORSO se bajó lo justo para que las piernas lleguen al pie sin estirarse.
- **Objetos de props** en la colección `FF_Props`: `FF_barra`, `FF_disco_±1`, `FF_asiento`, `FF_respaldo`, `FF_asa_±1` y `FF_plataforma`. Sirven solo para posar en Blender; el visor dibuja sus propios props.
- `rigui.py` es el panel del rig (script de texto incluido en el .blend). Blender lo ignora en modo `-b`.

### 2.2 Controles del rig que se usan al posar

| Control | Qué hace |
|---|---|
| `TORSO` | Mueve y rota todo el tronco y la cadera (pivote de la pelvis). |
| `HIPS`, `CHEST`, `NECK`, `HEAD` | Ajustes de columna, cuello y cabeza. |
| `FOOT-IK.L/R` | Pie (pivote en la bola del pie). El polo de la rodilla es `IK-POLE-LEG.L/R`, hijo del pie. |
| `HAND_IK.L/R` | Muñeca. Su rotación está aislada del brazo: rotar la mano no mueve el brazo. |
| `ARM-POLE-IK.L/R` | Orienta el húmero (arriba/abajo/apertura). No mueve la mano; lo compensa la muñeca. |
| `FINGER-MASTER.L/R` | X negativa cierra el puño. `FINGER-ROT-MASTER` hace el giro de los dedos y `THUMB` el pulgar. |
| `BARRA`, `MAQUINA`, `PLATAFORMA` | Implementos. Las manos y los pies van emparentados vía `PROPERTIES`. `BARRA` es el control; la barra que se ve es `BARRA_FINAL` (§2.5). |
| `PROPERTIES › BARRA_EN_MANOS` | 1 = la barra visible va entre los puños (peso muerto); 0 = sigue al control `BARRA` (sentadillas). |
| `PROPERTIES` | Interruptores IK/FK (`ARM-IK/FK`, `LEG-IK/FK`; 0 = IK) y los padres de IK. |

Preferencias del usuario sobre el rig, ya acordadas:

- El polo del codo solo orienta el húmero y la mano no se mueve.
- La mano no se desliza entre el inicio y el final.
- La rotación de la mano está aislada del brazo.
- Las acciones van separadas: una por ejercicio, sin encadenarlas en una línea de tiempo.
- Todo va en el frame 1 y el 30. Si algo cae en el frame 2 es un error y se mueve al 1.

### 2.3 Cómo se añade un ejercicio nuevo

**Por script (recomendado, §2.5):** un archivo en `blender/ejercicios/<id>.py` describe la pose con medidas y ángulos y crea la acción entera. Luego se retoca a mano.

**A mano:**

1. Duplica una acción del mismo tipo (por ejemplo `back_squat` → `hip_thrust`) y ponle `use_fake_user`.
2. Posa el frame 1 (inicio) y el frame 30 (final) con los controles de arriba. **Keya todo** (en el visor: `A` con todos los huesos y `I` en el frame 1 y en el 30), no solo lo que has movido: el exportador evalúa cada acción desde el reposo, y un canal sin clave se queda en reposo (§3.1).
   **Claves intermedias:** keya también los frames que quieras entre el 2 y el 29 (por ejemplo, para que la barra no atraviese la tibia). Se exportan y el visor pasa exactamente por ellas (§3.1). Ojo: **Recrear** del panel rehace la acción de cero y las borra; los deslizadores en vivo solo reescriben los frames 1 y 30.
3. Para tipo máquina, ten `MAQUINA` visible (escala 1) y la barra oculta (escala 0.001), o al revés.
4. Propiedades personalizadas en la acción: `ff_base` (`"stand"`, `"seat"`, `"hinge"` o `"hang"`) y `ff_name` (el nombre visible). Con eso el visor la enseña sin tocar código (`EXERCISES` se completa con la meta de `poses.json`). Si es una variante de otro ejercicio, además `ff_variant_of` y `ff_grip` (§2.6).
5. Exporta (§3). El exportador detecta las acciones del rig con claves hasta el frame 30. Ignora las que empiezan por `00` o `_` (por ejemplo `00-keying` o las manos de referencia) y las acciones de objeto que crea Blender al mover un objeto con autokey (`FF_asa_28.LAction`).

**Duplicar una acción** (para una variante): Dope Sheet › Action Editor con el rig seleccionado › botón de duplicar junto al nombre (crea `<nombre>.001` y la asigna); renombrar, escudo (fake user) y, en la barra lateral (`N`) › Action › Custom Properties, ajustar `ff_name`. O desde la consola de Python: `a = bpy.data.actions['pullup'].copy(); a.name = 'Chinup'; a.use_fake_user = True; bpy.data.objects['Armature_Mannequin'].animation_data.action = a`.

**Versión de Blender.** El `.blend` lo guardó por última vez Blender **5.0** (el de este equipo). Antes lo había guardado el 5.2 del chat original; al abrirlo con el 5.0 avisa de «posible pérdida de datos», pero el export del 5.0 sale idéntico (0,000 mm) en las tres acciones. Usa siempre la misma versión para guardarlo.

### 2.4 La pose base automática (legado)

**Ya no se usa para ejercicios nuevos: se usan los scripts de §2.5.** Se conserva porque creó las tres acciones originales. `autopose.py` reconstruye poses sobre el rig a partir de **direcciones de segmentos**, no de rotaciones de huesos. Por eso funciona entre esqueletos distintos. Recibe un `cc_poses.json` con, por clave:

- direcciones de muslo, tibia y tronco;
- tobillos, muñecas, barra, máquina y plataforma;
- deltas de mano y pie.

Con eso:

- coloca el `TORSO` con la misma inclinación absoluta;
- pone los pies y la cadera respetando las longitudes del maniquí;
- coloca la barra respecto al hombro;
- pone las manos con un agarre anclado al eje de la barra (la misma anchura en las dos claves);
- orienta los polos con la dirección del codo;
- cierra los puños.

Al final keya los controles en los frames 1 y 30.

`legacy/extract_cc.py` sacó ese JSON del primer modelo de Character Creator.

### 2.5 Posar por script: `ffpose.py` y `blender/ejercicios/`

`autopose.py` depende de un JSON sacado de otro modelo. Para ejercicios nuevos se describe la pose **en geometría del propio maniquí**:

- `blender/ffpose.py`: la librería. Medidas en reposo (muslo, tibia, tronco, brazo hasta el centro del puño), coordenadas sagitales (`W(f, z)`: f = hacia delante = −Y), y funciones para colocar tronco (`place_trunk`), pies (`place_feet`), barra (`place_bar`) y manos en la barra (`grip_bar`, con `HANG_PRONE` para colgar en prono). `new_action` crea la acción con `ff_base` y `ff_name`; `key(frame)` keya **todos** los canales del rig y de `PROPERTIES`; `report` avisa si una mano no llega.
- `blender/ejercicios/deadlift.py`: el peso muerto. Barra sobre el mediopié real (mitad del pie, medida en la malla), en el suelo al radio del disco; brazos casi rectos; la cadera sale de cruzar muslo y tronco; al bloquear, tronco erguido y la barra apoyada en la cara delantera del muslo. Sus `PARAMS` (anchura, rotación de pies, agarre, tibia…) son los mandos, con su valor por defecto y su rango.
- `blender/ejercicios/romanian_deadlift.py`: el rumano. Usa la geometría de `deadlift.py` con el punto bajo más alto (`BAR_LOW`, barra a media tibia) y menos rodilla, y le da la vuelta: empieza arriba (frame 1) y baja (frame 30). El usuario lo retocó después a mano.
- `blender/ejercicios/pullup.py`: la dominada. Barra fija (el control `BARRA`, a 2,30 m), manos colgadas de ella con agarre prono (`HANG_OVER`), colgado con los brazos rectos en el frame 1 y la barbilla sobre la barra en el 30; piernas colgando bajo la cadera (`FOOT-IK` a mano, no en el suelo). El usuario la retocó a mano (con claves intermedias) e hizo a mano la variante supina `Chinup`.
- `blender/ejercicios/barbell_row.py`: el remo con barra. Tronco fijo (`TRUNK`, 55°) y la tibia (`SHIN`); abajo la barra cuelga con los brazos verticales bajo los hombros, `BAR_F` por delante del tobillo (0,15 m: con 0,061, sobre el mediopié, la rodilla se iba a 53°), y la rodilla sale de llegar a esa cadera con el muslo; arriba la barra va al ombligo (`BAR_TO` por el tronco bajo la línea de hombros, `CHEST_FRONT` delante de ella), codos atrás. Mide el puño (`F.socket`) antes de posar: medir pone el rig en reposo.
- `blender/ejercicios/cable_row.py`: el remo en polea. Cadera a `HIP_Z` (sentado; el asiento lo dibuja el visor), pies en la plataforma (`FOOT-IK` a mano, planta hacia delante con `FOOT_PITCH`) a la distancia que da la rodilla `KNEE`; manos en el triángulo con agarre neutro (`NEUTRAL_FWD`), estiradas hacia la polea en el frame 1 (tronco `TRUNK_START`) y en el ombligo en el 30 (`TRUNK_END`). Tiene `setup`, que `ffpose.run` llama tras posar: guarda la polea en la acción (`ff_pulley`, [f, z]); el exportador la pasa a `meta.pulley`. La barra (`BARRA`) va oculta y `BARRA_EN_MANOS = 1`: el maneral exportado es el punto entre los puños (el exportador lo saca en las acciones `cable` aunque la barra esté oculta).
- `blender/ejercicios/cable_row_one_arm.py`: el remo en polea a un brazo, **acción propia** (no variante: la pose del cuerpo cambia y es más sensible). Parte de `cable_row.py`; tira la derecha de un asa en D (`ff_hand = "R"`), con la polea delante de su hombro (`PULLEY_X`; `ff_pulley` lleva entonces [f, z, x]); la izquierda descansa en el muslo. El giro del tronco (`TWIST_START`/`TWIST_END`) va en el **pecho** (control `CHEST`), no en la pelvis: con la pelvis girada una pierna no llegaba a su pie y el exportador bajaba la cadera. Brazo estirado: la **muñeca** a 0,997 de brazo + antebrazo (en reposo el codo del maniquí no está recto: hombro→muñeca mide 0,503 y los dos segmentos 0,531). El control `BARRA` (oculto, `BARRA_EN_MANOS = 0`) marca el asa en el puño real (`FF_PUNO.R`) después de posar.
- `blender/ejercicios/_manos.py`: las manos de referencia (abajo). Empieza por `_`: el panel no lo carga como ejercicio.
- `ffpose.run(ejercicio, ajustes, live)`: el único punto que crea o actualiza la acción de un ejercicio (lo usan la terminal, el Text Editor y el panel).

```bash
B="C:/Program Files/Blender Foundation/Blender 5.0/blender.exe"
"$B" -b --factory-startup --python blender/ejercicios/deadlift.py -- blender/FormFit_Maniqui.blend blender/FormFit_Maniqui.blend
```

`--factory-startup` es necesario en este equipo: un add-on del usuario («Cargo») falla en modo `-b`.

**Panel con deslizadores (`blender/ff_panel.py`).** Text Editor › Open › `blender/ff_panel.py` › Run Script (Alt+P). Aparece la pestaña **FormFit** en la barra lateral (N) del visor 3D:

- un desplegable con los ejercicios de `blender/ejercicios/` y, por cada ajuste de su `PARAMS`, un deslizador;
- mover un deslizador **recalcula en vivo** (~55 ms medido en `-b`): `ffpose.run(live=True)` desconecta la acción mientras posa (para que la animación no pise lo colocado), apaga la deformación de la malla y solo reescribe las claves de los controles que ha movido. Da exactamente lo mismo que recrear de cero (0,00 mm);
- **Inicio / Final** saltan a los frames 1 y 30; **Restablecer** vuelve a los valores de `PARAMS`; **Recrear** crea la acción de cero (y keya todo el rig); **Guardar y exportar al visor** guarda, ejecuta `export.py` y `build.py` (prototipo y app);
- los valores se guardan en la acción (`ff_params`), así que el .blend recuerda los ajustes de cada ejercicio y el script desde la terminal usa los mismos.

Recalcular borra los retoques a mano de esa acción: primero deslizadores, luego retoque. Para que el panel salga solo al abrir el .blend, marca «Register» en el Text Editor (pide Auto Run Python Scripts).

**Un ejercicio nuevo** es un `.py` en `blender/ejercicios/` con `META = (acción, tipo de base, nombre)`, `PARAMS = {ajuste: (valor, mín, máx, etiqueta)}` y `frames(F, p)`, que devuelve `[(frame, posar)]`. El panel lo recoge solo (vuelve a ejecutar `ff_panel.py`).

**Sin panel:** Text Editor › Open › `blender/ejercicios/deadlift.py` › Run Script también recrea la acción en el archivo abierto, sin guardar.

**Muñecas rígidas (`ffpose.py … munecas`, ya aplicado).** El rig original tenía la mano «aislada»: `DEF-HAND` copiaba posición y giro de `HAND_IK` aunque el brazo no llegara, y el hueso de la muñeca (`DEF-FORARM0`) se estiraba para cubrir el hueco (140 % al bajar la mano 5 cm). Ahora `MCH-HAND-SWITCH` lleva una restricción `FF_mano_en_antebrazo` (Copy Location a la cola de `MCH-FORARM-SWITCH`): la mano conserva el giro de `HAND_IK`, pero su posición es el final del antebrazo. Si arrastras la mano más allá del alcance, el brazo queda recto y la mano no se separa. Las otras tres acciones se mueven ≤ 0,06 mm.

**Barra en las manos (`ffpose.py … barra-manos`, ya aplicado).** El control `BARRA` sigue siendo el padre de las manos (moverlo las mueve), pero la barra **visible y exportada** es otro hueso, `BARRA_FINAL`:

- copia a `BARRA`; si `PROPERTIES["BARRA_EN_MANOS"] = 1` se coloca entre los dos puños (`FF_PUNO.L/R`, hijos de `DEF-HAND` en el hueco del puño cerrado) y apunta de uno a otro;
- así, en el peso muerto la barra va siempre con las manos, aunque entre claves el brazo no llegue al control o muevas una mano a mano. En las sentadillas vale 0 y la barra sigue al control (va en la espalda);
- `BARRA_EN_MANOS` está keyada (constante) en todas las acciones: `deadlift` y `romanian_deadlift` 1, el resto 0. `ff_barra` y los discos cuelgan de `BARRA_FINAL`; el exportador la lee en vez de `BARRA`;
- sin ciclo de dependencias: nada depende de `BARRA_FINAL` salvo las mallas.

**Agarre con el puño cerrado.** `socket()` mide el hueco del puño **ya cerrado** (centro de las falanges de corazón y anular); antes se medía con la mano abierta y el puño quedaba ~3 cm por encima de la barra. `hang_bar()` coloca una barra colgada de los hombros reales con la **muñeca** al alcance del brazo (el puño queda por debajo de la línea de la muñeca). `report` dice «mano→objetivo» (0 = el brazo llega) y «puño→barra» (0 = agarra la barra).

**Acciones selladas.** Las tres acciones originales solo keyaban algunos controles; el resto se quedaba con lo que dejara la acción anterior, así que la pose exportada **dependía del orden** (al meter `deadlift` entre medias, la frontal cambiaba 7 cm y la prensa 2 m). `ffpose.py … sellar back_squat,front_squat,leg_press` keyó en cada una lo que heredaba en el orden de siempre: el export es idéntico y ya no depende del orden.

**Manos de referencia** (spec X02-01). `blender/ejercicios/_manos.py` crea en el archivo:
- la colección `FF_asas` con cilindros de referencia `FF_asa_28.L/R` y `FF_asa_40.L/R` (28 y 40 mm), donde va el asa en la mano en reposo (brazos en cruz, palma abajo: el asa va de delante a atrás);
- las acciones `_mano.abierta`, `_mano.28` y `_mano.40`: el rig en reposo con los dedos cerrados sobre su asa, con `FINGER-MASTER` a −10°, −75° y −58° como punto de partida.

**Manerales de polea** (`blender/ejercicios/_manerales.py`, para los remos): por maneral (triángulo, asa en D, barra recta, barra supina, cuerda) una malla `maneral_<malla>` (se remodela libremente en Edit Mode; el origen del objeto es el **gancho**, donde engancha el cable; marco «de uso»: −Y hacia la polea, +Z arriba), en la colección `FF_manerales_<maneral>` dos instancias `FF_maneral.<maneral>.L/R` emparentadas a `DEF-HAND` (se ven en cualquier acción), y la acción `_mano.<maneral>` (rig en reposo, dedos cerrados sobre el maneral). Se retocan la geometría, los dedos y, moviendo la instancia, dónde va el maneral en la mano: se hace **una vez por maneral** y vale para todos los ejercicios. El exportador saca la malla (`poses.json › manerales`, triángulos en el marco del maneral, glTF) y por mano (`hands.<maneral>.L/R`): dedos, `maneral` (el maneral respecto a la mano: posición en los ejes de la mano y giro `(Rmano⁻¹·Rmaneral)·Cᵀ`, porque la malla se convierte con C) y `agarre` (lo calcula el exportador: el centro del puño cerrado en el marco del maneral; así el usuario solo mueve el maneral); y `rigido` (la cuerda no). El script no rehace lo que ya existe.

**Se retocan a mano**: dedos, pulgar y, si hace falta, el propio cilindro (el exportador lee dónde está). Con los dedos cerrados por los controles, el cilindro queda en el hueco calculado desde los huesos, que van por dentro de la malla, así que de salida pisa un poco los dedos. El script no rehace una acción `_mano.` que ya exista (son retoques); para rehacerla, se borra antes. Como empieza por `_`, el panel FormFit no la carga y el exportador no la trata como ejercicio.

### 2.6 Variantes

Una variante es otra acción del mismo ejercicio que el usuario quiere controlar a mano (por ejemplo, la dominada supina: los codos van distintos que en la prona). Se marca en la acción con dos propiedades:

- `ff_variant_of`: el ejercicio del que es variante (`"pullup"`);
- `ff_grip`: qué agarre es (`"supino"`).

El exportador las copia en `meta` (`of`, `grip`). En el visor no salen como ejercicio aparte: comparten los ajustes del suyo y las usa su chip de agarre (`variantFor`); detalle en §4.4c. Hoy: `Chinup` (`pullup`, `supino`) y `barbell_row_supino` (`barbell_row`, `supino`). Sin variante, el agarre se consigue girando la mano de la acción de partida (manos de referencia, X02).

---

## 3. Exportación (`blender/export.py`)

```bash
"$B" -b --factory-startup --python blender/export.py -- blender/FormFit_Maniqui.blend assets/ [corregido.blend] [--exercises a,b]
npm run build:viewer   # empaqueta viewer.html (prototipo y mobile/assets/mannequin/); npm test también lo hace
# o con el módulo bpy de pip:   python3 -I blender/export.py blender/FormFit_Maniqui.blend assets/
#   (en la sesión original se usó  pip install bpy==5.2.3; ejecutar SIEMPRE con -I y fuera de la carpeta de scripts)
```

### 3.1 Qué hace, en orden

0. **Cada acción desde el reposo** (`use(ex)`): antes de evaluarla pone todos los huesos en reposo. Así ninguna hereda de otra (§2.5).
1. **Rigidez.** Desactiva el IK stretch en todos los huesos y restricciones IK. Después revisa cada clave: si una pierna no llega a su pie (hueco > 0,5 mm), baja el `TORSO` ese hueco y vuelve a keyar, hasta 6 iteraciones.
2. **Esqueleto limpio `FF_Skeleton`.** En el rig, los DEF cuelgan planos de ROOT; aquí se crean solo los 68 huesos `DEF-*` con jerarquía real (`parent_of`):
   - Columna: `HIPS` (raíz) → `SPINE01` → `SPINE02` → `CHEST` → `NECK` → `HEAD`.
   - Brazo: `CHEST` → `SHOULDER` → `ARM01` → `ARM02` → `FORARM01` → `FORARM0` → `HAND` → `PALM-x` → `FINGER-x-01..03`.
   - Pulgar: `HAND` → `THUMB01..03`.
   - Pierna: `HIPS` → `THIGH01` → `THIGH02` → `SHIN01` → `SHIN02` → `FOOT` → `TOE`.
   - El reposo es idéntico al de los DEF del rig.
3. **Malla.** Copia `Mannequin` con Mirror y Subsurf nivel 1 aplicados (25.636 vértices, materiales `display01` y `display02`). Quita los Mask, pesa la malla al esqueleto limpio y borra los grupos que no son DEF.
4. **`mannequin.glb`.** Solo malla, skin y materiales: sin animaciones ni texturas. Ocupa unos 1,8 MB.
5. **`poses.json`.** Por cada ejercicio, las transformaciones mundiales de cada DEF y los implementos en el frame 1 (`start`), el 30 (`end`) y los intermedios (`mid`, cada uno con su `s = (frame − 1) / 29`): las claves intermedias que haya y, además, **un frame cada 5** (`SAMPLE`).

   **Por qué las muestras:** Blender interpola los *controles* del rig con curvas y la IK hace que los *huesos* no sigan esas curvas; el visor solo ve huesos. Medido en la dominada (diferencia máxima con los frames de Blender): en recta sin muestras, 20° de codo y 5 cm; con curvas (§4.1) sin muestras, 9° y 2,5 cm; curvas y una muestra cada 10 frames, 7°; **curvas y una cada 5, 2° y 0,4 cm** (lo que se usa). Coste: unos 125–200 KB por ejercicio (en vez de ~50) y ~0,3 ms por frame (en vez de ~0,15).
6. **Manos de referencia** (`hands`): por cada acción `_mano.<nombre>` y cada lado, el giro de cada hueso de la mano (dedos, palmas, pulgar) relativo a `DEF-HAND` y, si tiene asa `FF_asa_<nombre>.L/R`, su centro y su eje en los ejes de `DEF-HAND` (`hollow`). Los ejes locales del hueso se conservan en glTF, así que esos valores valen tal cual en el visor.

### 3.2 Convención de ejes (importante)

- Blender tiene Z arriba y −Y delante; glTF, Y arriba y +Z delante. `C = ((1,0,0),(0,0,1),(0,−1,0))`.
- **Posiciones:** `C·p`.
- **Rotaciones de hueso:** `C @ R`, y **no** `C R Cᵀ`. El exportador glTF conserva los ejes locales del hueso (Y a lo largo del hueso), así que solo cambia el marco del mundo. Con `C R Cᵀ`, las rotaciones salían 90° desviadas respecto al bind del GLB.
- **Desplazamiento local `off`:** posición del hijo respecto al padre, en los ejes del padre. Se calcula con **la misma rotación que se exporta como `q` del padre** (`grot(Pm.to_3x3()).to_quaternion()`). Con huesos escalados, como el hombro de la sentadilla frontal (`len` 1,031), usar `Pm.to_quaternion()` daba 5 mm de error. Ya está corregido.
- El rig traslada algunos DEF (hombros, tweaks), así que el FK desde rotaciones locales necesita estos `off` por clave para reproducir Blender exactamente. Con ellos, el error es 0,0 mm.

### 3.3 Formato de `poses.json`

```jsonc
{
  "units": "m", "space": "glTF (Y arriba, +Z delante)",
  "bones": ["DEF-HIPS", ...],                // 68 huesos
  "parent": { "DEF-SPINE01": "DEF-HIPS", "DEF-HIPS": null, ... },
  "rest":   { "<hueso>": { "p": [x,y,z], "q": [x,y,z,w] } },     // reposo = bind del GLB
  "exercises": {
    "back_squat": {
      "meta": { "base": "stand", "name": "back_squat" },          // variante: + "of": "pullup", "grip": "supino"
      "start": {
        "bones": { "<hueso>": { "p": [...], "q": [...], "len": 1.0, "off": [...] } },  // mundo; off = local respecto al padre
        "bar": { "center": [...], "axis": [...] },                               // solo si BARRA visible
        "ik_parent": { "hand": 5, "foot": 0 }
      },
      "mid": [ { "s": 0.172, "bones": {...}, "bar": {...}, ... }, ... ],   // claves intermedias y una muestra cada 5 frames
      "end": { ... }
    },
    "leg_press": {
      "meta": { "base": "seat", ... },
      "start": { "bones": {...}, "machine": { "p", "q" }, "plate": { "p", "normal", "up" }, "handles": [[...],[...]], ... },
      "end": { ... }
    }
  },
  "hands": {                                  // manos de referencia (X02)
    "28": { "d": 0.028,
            "L": { "fingers": { "<hueso de la mano>": [x,y,z,w] },   // giro relativo a DEF-HAND
                   "hollow": { "p": [x,y,z], "axis": [x,y,z] } },     // asa en los ejes de DEF-HAND
            "R": { ... } },
    "abierta": { "d": null, "L": { "fingers": { ... } }, "R": { ... } }
  }
}
```

Por ejercicio son unos 125–200 KB (con las muestras); hoy `poses.json` ocupa ~1 MB y el visor ~4 MB. 300 ejercicios en un solo archivo rondarían 45 MB. Para producción conviene:

- un JSON por ejercicio, cargado bajo demanda;
- y/o quitar los dedos que no cambian y cuantizar.

---

## 4. Runtime (`prototype/runtime.js`)

Es un único archivo de unas 1.000 líneas (three.js r147 UMD) y contiene toda la lógica. `shell.html` es la UI web y `build.py` lo empaqueta todo en `viewer.html`, con el GLB en base64, y lo copia a `mobile/assets/mannequin/`.

**Por dónde entra un frame:** `evaluate(ex, s)` (s = posición en la repetición, 0–1) traduce la s según el tipo (recortes con frenada, `ramp`; en la dominada, la variante del agarre elegido) y llama a `evaluateRaw(ex, s)`, que fija los desplazamientos locales del frame y llama a `evaluateInner`. Ahí cada tipo de base tiene su rama: `stand`/`hinge` (comparten `build`), `hang` y `seat`. Devuelve `{ pose, bar, warns, readout, act, … }`; `placeProps` dibuja los implementos y `repS` da la s al reproducir (ida, pausa, vuelta, pausa; lineal, porque el ritmo ya viene de Blender).

### 4.1 Datos y FK

- `REST` y `LOCAL_OFF` salen de `poses.rest`. `ORDER` es el orden topológico y `KIDS` los hijos.
- `keysOf(ex)` da las poses exportadas en orden (inicio, intermedias, final) y `seg(ex, s)` el tramo que contiene s.
- `authoredPose(ex, s)` calcula la pose autorada en el instante `s ∈ [0,1]`:
  - las rotaciones **locales**, los `off` y la raíz se interpolan con **curvas como las de Blender** (`herm`, `hermV`, `hermQ`: Bézier «auto clamped» canal a canal; velocidad continua al pasar por cada pose, cero en los extremos del recorrido y donde un canal llega a su máximo o mínimo). Las rotaciones, por componentes en el mismo hemisferio y normalizadas. En recta, la velocidad cambiaba de golpe en cada pose y se notaban tirones;
  - después se aplica FK desde `DEF-HIPS`.
- `expP`/`expQ` dan la posición y el giro **exportados** de un hueso (con las mismas curvas): se usan para lo que tiene que estar exactamente donde en Blender (tobillos plantados, manos en la barra fija).
- **Proporciones:** `STRETCH(n)` alarga el `off.y` de los hijos según el hueso:
  - fémur para `THIGH01/02`;
  - tibia para `SHIN01/02`;
  - tronco para `SPINE01/02` y `HIPS`.

  Además hay una escala global `K() = altura/180`. Al GLB se le aplica escala (k, k·stretch, k) por hueso.
- **Skinning manual:** se escribe directamente `bone.matrixWorld.compose(p, q, scale)` y se anula `updateMatrixWorld` en los huesos.

  ⚠️ GLTFLoader sanea los nombres: `DEF-HAND.L` pasa a `DEF-HANDL`. `initRig` mapea con `THREE.PropertyBinding.sanitizeNodeName`. Sin eso, los huesos L/R no se mueven, y no da ningún error.

### 4.2 IK que conserva el estilo

`solveLimb(pose, auth, [u1,u2,l1,l2,end], target, pole, [a,b])`:

1. IK analítico de dos segmentos (`twoBone`).
2. Calcula el delta de marco de cada segmento (dirección principal + bisagra) entre la pose autorada y la nueva (`deltaFrames`).
3. Aplica ese delta a **los dos huesos** de cada segmento (01/02). Así se conserva el reparto de giro (twist) autorado.

El polo sale de la propia pose autorada (`poleOf`), rotado si cambia la rotación de pies.

### 4.3 `evaluate(ex, s)`: tipo `stand` (sentadillas)

1. `F = features(auth)`: ángulos de la pose autorada.
   - `phi`: tronco, línea cadera–hombro respecto a la vertical, positivo hacia delante (+Z).
   - `beta`: muslo, igual a `-sag(cadera − rodilla)`.
   - `th`: tibia.
   - También: yaw de pies, polos, barra respecto al hombro (`du`, `dn`, `dx`).
2. **Profundidad y rodillas:**
   - `beta` se escala con `depth`, más cuanto más profunda es la fase.
   - `knees` suma grados a la tibia preferida.
3. **Solver sagital `solveStand`.** Modelo de palos con masas relativas:
   - tronco 0,678 (incluye cabeza y brazos);
   - muslos 0,2;
   - tibias 0,093;
   - pies 0,029;
   - barra = carga/100.

   Busca `phi` y `th` para que el centro de masas quede sobre el mediopié, con la tibia limitada por la dorsiflexión. Se resuelve **dos veces**, las dos con la carga actual: con el cuerpo y los ajustes por defecto (`ref`) y con los actuales (`cur`). Se aplican las diferencias:
   - `th = F.th + (cur.th − ref.th)`, limitada a `max(35°, F.th) + (dorsi − 35°)`. El límite es relativo para respetar poses autoradas con más de 35° de tibia, como la frontal (51°).
   - Cadera: `F.hip + G(cur) − G(ref)`.
4. **`build(phi)`**: construye la pose completa para una inclinación de tronco dada.
   - **Tronco:** rotación `R = QA(X, phi − F.phi)` aplicada a todo lo que no es pierna.
   - **Piernas:** IK hasta el **tobillo plantado**: posición exportada de Blender, escalada por `stance` y `k`. El pie y la punta toman la rotación exportada más la rotación de pies.

     ⚠️ No uses el tobillo del FK interpolado: entre claves se desliza hasta 13 cm.

     Y la cadera se desplaza lo mismo que ese tobillo (`drift`): la cadera autorada está colocada respecto al tobillo del FK, así que, si no, la pierna queda corta y la rodilla se dobla de más. En la sentadilla trasera eran 64° en vez de 37° al 25 % de la bajada: parecía que bajaba primero con las rodillas. Con la corrección, 43° y el tronco se inclina antes (13° frente a 8°): flexión doble de cadera y rodilla. En las claves no hay desplazamiento.
   - **Barra:** hombro + `du`·u + `dn`·n + `dx` (el offset lateral cuenta).
   - **Brazos:** el agarre se proyecta sobre el eje de la barra y se escala con `grip`. La muñeca se coloca desde el *socket* del puño (`socketRest`). El polo del codo es el autorado rotado con el tronco. Si la mano no llega, se avisa.
5. **Equilibrio en lazo cerrado:** `comOffset(pose, bar, carga)` calcula el centro de masas real del sistema respecto al mediopié real, con masas y centros por segmento de de Leva (cabeza 6,94 %, tronco 43,46 %, brazo 2,71, antebrazo 1,62, mano 0,61, muslo 14,16, pierna 4,33, pie 1,37). Cabeza y brazos van en su sitio, no sumados al tronco: en la frontal los brazos van por delante y hacen de contrapeso.

   Se ajusta `phi` por secante (hasta 8 iteraciones) para que ese offset sea **el de las claves de Blender con la carga actual, interpolado entre ellas** (`comRef`). Por eso, con el cuerpo y los ajustes por defecto, la pose autorada sale igual con cualquier carga (`tests/balance.js` lo comprueba); la carga solo decide cuánto pesa cada cosa al compensar otros cambios (con el tobillo a 20°, frontal a 27° de tronco con 100 %, 32° con barra vacía y 38° sin peso).

   ⚠️ No fijes el objetivo con la carga por defecto: al quitar peso, el cuerpo solo tenía que ocupar el punto de equilibrio de cuerpo + barra, y la frontal sin peso se doblaba (46° con el tobillo a 20°) y el peso muerto acababa inclinado hacia delante al bloquear. Tampoco vale la pose interpolada: entre claves se interpolan rotaciones, no el equilibrio, y el objetivo se iba hasta −5,5 cm a mitad de bajada.

   Si el centro de masas sale del pie (±10 cm × k del mediopié), avisa de que se caería: p. ej. la salida del peso muerto sin carga queda 12 cm por detrás.

   *Opción pendiente de decidir:* forzar el centro de masas a 0 cm en lugar del offset de las claves. Las claves actuales tienen +3,0 / −2,8 cm (trasera) y +2,6 / −3,8 cm (frontal): se corrige retocándolas en Blender.
6. **Salidas del visor:**
   - línea discontinua = vertical del mediopié real;
   - indicadores: tronco, muslo, tibia, CdM–mediopié y barra–mediopié.

### 4.4 `evaluate`: tipo `seat` (prensa)

- La **pelvis queda fija al asiento**: se traslada la pose para que el punto medio de las caderas coincida con la clave de inicio. En Blender la cadera se movía unos 6 cm entre claves.
- **Plataforma sobre el raíl:**
  - `plate(u) = cadera + (P0 − cadera)·legR + T·u·legR`.
  - `T` = desplazamiento autorado de la plataforma (end − start).
  - `legR` = (longitud de pierna del cliente) / (longitud autorada).
  - `u(s) = (1−s)·(−startOff/|T|) + s·depth`.

  La orientación se mantiene constante, la de la clave de inicio. En la clave final de Blender la plataforma está rotada unos 10°; se ignora.
- **Los pies van pegados a la plataforma:** se usa el offset pie–plataforma de la clave de inicio, más `footHigh` (sobre el eje `up` de la plataforma) y `stance`.
- Si la pierna no llega (extensión de más), `u` retrocede hasta el 99,5 % de la longitud de pierna.
- **Manos:** IK hasta las muñecas exportadas (asas fijas a la máquina).
- **Demanda muscular:** línea de fuerza por el mediopié, paralela al raíl, y brazos de momento a la rodilla y a la cadera.

### 4.4b `evaluate`: tipo `hinge` (peso muerto convencional, rumano)

Comparte el código de `stand` (piernas a los tobillos plantados, `build(phi, cadera)`), con estos cambios:

- **La barra va en las manos** (`hingeGrip`): en cada clave se guarda, por lado, puño − barra, y entre claves se interpola. Las manos van a la barra por IK.
- **Regla: brazos rectos.** Con la barra en las manos el codo no se flexiona, ni en el aire ni en el suelo. La barra se pone a la altura que deja la muñeca izquierda con el brazo recto (99,9 % de brazo + antebrazo) desde el hombro actual; con el agarre más abierto, más alta. Si una clave de Blender tiene el codo flexionado (hoy: el inicio del convencional, 25°, y el rumano, 12–15°), el visor lo endereza y esa clave ya no coincide con Blender: `tests/fidelity.js` lo avisa. Conviene enderezarlos en Blender.

  ⚠️ No uses la barra interpolada con las manos de la pose interpolada: la barra va en recta y las manos en arco (en el rumano, con dos claves, se separaban 11 cm).
- **Punto bajo y alto** (`hingeKeys`): la clave con la barra más baja y la más alta. En el convencional el bajo es el inicio; en el rumano, el final (empieza arriba).
- **Recorte** (`hingeCut`, `hingeS`): con `depth` positivo, o con bloques más altos que el punto bajo, la repetición **se acorta**: va del punto alto al momento en que la barra está a esa altura en la animación **ya ajustada** (cuerpo, rodilla, déficit…). Es solo cortar: lo de debajo no se ve, no se comprime, y la pose en el corte es la que se vería ahí sin recortar (convencional con −20° de rodilla y +20 cm: empieza en la pose del −20° con la barra a 42 cm; solo sube el pecho). Se busca por bisección sobre `evaluateRaw` (la s de la animación, sin recorte), una vez por cuerpo y ajustes. `evaluate` traduce la s de la repetición a la de la animación.

  ⚠️ No vuelvas a resolver el punto bajo en el corte: un «−20° de rodilla» sobre una rodilla que ahí ya está menos doblada es mucho más rígido y la barra se aleja del cuerpo.
- **En cada frame, el mismo problema** (antes eran dos pasos, punto bajo y resto, con repartos de tibia y compensaciones aparte; la barra se quedaba arriba con la rodilla topada y caía de golpe al final):
  - **La rodilla tiene el ángulo que toca.** Con `knees` negativo es un tope: `K = min(K_autorada, KB + knees)`, con `KB` el ángulo autorado abajo (`hingeKB`). La animación va normal mientras se dobla menos que el tope (arriba, en el rumano, no cambia nada) y al llegar se queda ahí (rumano a −40°: 7°, 13°, 18° y se queda en 18°). Con `knees` positivo se dobla más, en proporción.

    ⚠️ No lo hagas proporcional en todo el recorrido: arriba, donde la rodilla casi no se dobla, adelantaba la cadera y metía la barra en el cuerpo.
  - Con ese ángulo fijo, la pierna gira sobre el tobillo y el tronco se inclina: **Newton 2×2 sobre tibia y tronco** para que
    - e1: el **centro de masas** quede donde lo tienen las claves (con la carga actual), dentro de la zona del pie (`comZone`);
    - e2: la **barra siga su trayectoria**: la de las claves × k, más lo que cambie el punto bajo repartido según la subida (todo abajo, nada arriba). Arriba, de pie, la altura de la barra apenas depende de tibia y tronco y no se puede exigir (con otro cuerpo saldría encogido): e2 mezcla según la subida la altura de la barra (abajo) con la tibia autorada (arriba).
  - Así cada ajuste mueve la cadera, no la rodilla: déficit o más hondo → la cadera va atrás casi sin bajar y el tronco se inclina, nada de cuclillas; menos rodilla → la cadera sube y el tronco se inclina, y la pierna se inclina hacia atrás hasta `T_MIN` (tibia a −12°: pierna rígida, peso en los talones). Si ahí ya no cuadra, avisa de que el CdM se adelanta.
  - Altura en el punto bajo: si la autorada está en el suelo, en el suelo (los bloques solo recortan), igual para todos los cuerpos; si no, la autorada × k, más `depth` negativo, sin pasar del suelo o los bloques. Si no llega, avisa.
  - Rumano sin carga a −40°, altura de la barra cada 10 % del recorrido: 86, 84, 79, 74, 69, 62, 56, 49, 43, 36, 30 cm (antes: 86, 84, 81, 80, 79, 77, 75, 71, 65, 56, 30).
- **Tobillos plantados y cadera** (`drift`, común con `stand`, ver §4.3): en el rumano, sin ella, 48° de rodilla en vez de 32° a mitad de recorrido, y reducir la rodilla apenas se notaba.

  Antes era un Newton 2×2 que mezclaba «altura de la barra» y «muslo autorado» con pesos según `s`: con otro cuerpo saltaba de solución (hasta 20 cm de un frame al siguiente). `tests/balance.js` lo vigila.
- `knees` es «Flexión de rodilla»: negativo, la flexión máxima (el autorado abajo menos tantos grados); positivo, más rodilla.
- **Zona del pie y pivote sobre el tobillo** (`comZone`): el CdM objetivo se mete en ±6 cm × k del mediopié. Si con esta carga el de las claves cae fuera (la salida del peso muerto sin carga: 12 cm detrás), el Newton lo mete pivotando sobre el tobillo (la tibia es una de sus incógnitas): rodillas, cadera y hombros van hacia delante, hasta la dorsiflexión que dé el tobillo (`thLim`). Convencional sin carga: tibia 16° (10° la autorada) y el CdM a −6 cm en todo el recorrido. El objetivo también se limita así en las sentadillas (allí compensa el tronco).
- **Altura de los pies** (`feet`): se resuelve con los pies en el suelo y al final se sube todo el cuerpo y la barra. **Altura de los discos** (`plates`): bloques bajo los discos. El visor dibuja las cajas (`blocks`, `footBox`).
- Aviso de isquios: tronco por encima de 85° con la rodilla flexionada menos de 45°.

**Implementos y manos** (spec X02). Ajuste `impl` (chips): barra · mancuernas (delante) · a los lados · 1 kettlebell · 2 kettlebells. Lo que empieza en el suelo (convencional) solo admite lo que se apoya bien en él: barra y kettlebells (`allow`). Catálogo `IMPL`: grosor del asa (`d`), altura del asa con el implemento en el suelo (`rest`: barra 22,5 cm, mancuernas 10, kettlebell 26), `side` (a los lados: asa de delante a atrás, agarre neutro, a `hipHalf + dx`), `half` (1 kettlebell: las dos manos juntas en el asa, a ±5 cm), `rot` (mancuernas delante: el asa girada 25° con el pulgar hacia delante, rotación externa del brazo).
- **Altura: la gran diferencia entre convencional y rumano.** Con otro implemento, el hueco del puño queda a otra distancia de la muñeca (`dI`: unos 4 cm con las manos de referencia frente a `socketRest`).
  - Rumano (no empieza en el suelo): **mandan las manos**. El asa se desplaza `dI` para que la mano vaya exactamente por donde iba con la barra (`tests/balance.js` lo comprueba, ±1,5 cm), y el implemento solo limita: no atraviesa el suelo ni los bloques.
  - Convencional (empieza en el suelo): **abajo manda el implemento** (su asa en el suelo, `rest`) y, según sube, las manos vuelven a su sitio.

  ⚠️ No uses la altura del implemento en el suelo para el rumano: con mancuernas, las manos bajaban 12 cm y el tronco se acostaba.
- Con el implemento de la acción (la barra) no cambia nada: dedos y puño de la acción (fidelidad).
- Con otro (`implHand`): dedos y hueco del puño mezclando `hands['28']` y `hands['40']` por el grosor; la mano gira lo mínimo para que el eje del asa en la mano coincida con el del implemento (`handleAxis`) y, de los dos sentidos, se queda el que deja la palma atrás (asa transversal) o hacia dentro (a los lados). La muñeca va a `asa − hueco` y el brazo, recto, por IK.
- El centro de masas usa la carga en la línea de las asas (como la barra). El visor dibuja mancuernas (asa + cabezas hexagonales) y kettlebells (bola + asa) en `r.grips`.
- Idea del usuario (4-nov) para más adelante: que con el peso que se usa aparezcan las kettlebells, mancuernas y discos que tocan.

**Ejercicios vecinos** (spec X01 §2.14): cada uno tiene su acción y los mismos ajustes los acercan. El rumano con `knees` +8 y `depth` −40 queda en tronco 70°, muslo 66° y barra en el suelo; el convencional por defecto está en 72° y 65° (`tests/shots/rdl_as_conventional.png`).

**Ojo con el rumano:** en este modelo (brazos colgando, hombros sobre la barra, barra sobre el mediopié) bajar la barra a media tibia exige ~58° de flexión de rodilla, y aun a la altura de la rodilla ~47°. Una rodilla más recta solo deja inclinar el tronco ~25°. Un rumano más «rígido» se retoca a mano en Blender o se recorta con `depth`.

Con los valores por defecto sale la autorada (0,0 mm en las claves), salvo los codos (ver la regla de brazos rectos). Indicadores: tronco, muslo, tibia, altura de la barra, CdM–mediopié, barra–mediopié y, si cambia, «Cadera» (en ese frame, cuántos cm más alta/baja y adelante/atrás que la autorada).

### 4.4c `evaluate`: tipo `hang` (dominada)

El cuerpo cuelga de las manos. Acción `pullup` (script `blender/ejercicios/pullup.py`): frame 1 colgado con los brazos rectos, frame 30 con la barbilla sobre la barra, el pecho hacia ella y el tronco algo hacia atrás; agarre prono; la barra fija es el control `BARRA` a 2,30 m.

1. La pose autorada con las medidas actuales (`authoredPose` con el cuerpo de ahora).
2. **Hombros:** el vector barra→hombros autorado × k. Colgado, con el brazo casi recto (codo autorado < 20°), se fuerza la distancia hombro→muñeca que da ese codo: con el agarre más abierto, el cuerpo cuelga más alto. Nunca más lejos de lo que llega el brazo.

   ⚠️ No fijes la distancia en todo el recorrido: a mitad de subida la muñeca pasa de estar encima del hombro a debajo, y con otro agarre el cálculo saltaba de un lado al otro (hasta 30 cm entre frames).
3. **Brazos** por IK hasta la barra. **Las manos no se mueven en la barra:** la muñeca y el giro de la mano salen de las claves exportadas (`expP`/`expQ`; en Blender la mano cuelga de la barra y está quieta), no de la pose interpolada, que entre claves las llevaba en arco hasta 5 cm (`tests/balance.js` lo vigila con los tres agarres). Agarre (`gripType`): prono (el de la acción, con sus dedos), supino (la mano gira media vuelta sobre su eje, `roll`, y luego se alinea con la barra; girar 180° «lo mínimo» elegía un eje cualquiera que cambiaba de un frame a otro) y neutro (asas paralelas a ±25 cm, de delante a atrás, palmas hacia dentro; se dibujan como dos cuernos unidos por una barra transversal en su extremo de delante). Supino y neutro usan las manos de referencia (X02). En `implHand`, a igualdad de palma, gana la opción que deja la mano apuntando como estaba (si no, el supino a veces la ponía boca abajo). **El codo gira con la mano:** con supino (45°) y neutro (35°), el polo del codo de las claves gira alrededor de la línea hombro→muñeca hacia delante; si no, el supino empezaba abriendo los codos hacia fuera, como el prono.
**Variantes con acción propia.** Una acción con las propiedades `ff_variant_of` (el ejercicio del que es variante) y `ff_grip` (su agarre) no sale como ejercicio aparte: comparte los ajustes del suyo y la usa su chip de agarre (`variantFor`). Hoy: `Chinup` (dominada supina, hecha a mano por el usuario) es `ff_variant_of = "pullup"`, `ff_grip = "supino"`. Con el chip «Supino» se ve esa acción tal cual (manos, codos, piernas); el «Neutro» sale de ella si existe (sus codos ya van hacia delante), girando solo la mano. Sin variante, el agarre se consigue girando la mano de la acción de partida, como antes. Es la convención de una acción por forma (X01 §2.15) y vale para remos y lo que venga.
4. **Sin equilibrio automático.** Hubo un péndulo (todo el cuerpo giraba alrededor de la barra hasta dejar el CdM donde lo tenían las claves), pero corregía 1° como mucho y le quitaba intención a la animación; se quitó el 4-nov. La dominada lastrada tendrá su propia acción.

Recorrido: `top` (hasta dónde sube, 15–100 % del autorado) y `bottom` (desde dónde baja, 0–60 %: codos algo flexionados) recortan la animación en `evaluate`; no se comprime. **Frenada en el corte** (`ramp`, también en el recorte de la bisagra, `hingeS`): en un extremo recortado la animación iba aún en movimiento y se paraba en seco; ahora se llega a él frenando (velocidad 0 en el corte). Los extremos sin recortar se dejan tal cual: ahí ya frena la animación de Blender. Indicadores: codo, hombros bajo la barra y CdM–barra. La cámara apunta más alto y desde más lejos (`target`, `goal.r`). `tests/fidelity.js` no comprueba que los pies no deslicen (colgado no se apoyan).

Pendiente (X01-13): piernas cruzadas o dobladas, escápulas (subir y bajar los hombros), «pecho a la barra» por encima de la autorada, demanda muscular de tracción (hoy el mapa solo tiene piernas y espalda baja).

### 4.4d `evaluate`: tipo `row` (remo con barra)

Acción `barbell_row` (script `blender/ejercicios/barbell_row.py`): frame 1 brazos colgando, frame 30 barra en el ombligo; el tronco y las piernas no se mueven. Comparte la rama de `stand`/`hinge` (piernas a los tobillos plantados, `build(phi, cadera)`, implementos y manos de X02), con esto propio:

- **Cuánto ha tirado** (`rowUp`): 0 con los brazos colgando, 1 con la barra en el tronco, por la distancia hombros→barra autorada.
- **La barra**: el vector hombros→barra autorado × k; abajo sin girar (los brazos cuelgan en vertical), arriba girado con el tronco (`lerp` según `rowUp`). «Hacia dónde sube» (`dest`) la lleva a lo largo del tronco, también según `rowUp`. Con otro agarre o implemento, abajo el brazo sigue recto: la barra sube o baja lo que cambia la altura del brazo recto respecto al agarre autorado (diferencia: 0 por defecto).
- **Codos**: el polo autorado, girado con el tronco según tira.
- **Agarre**: prono o supino. El supino es una **variante con acción propia**, `barbell_row_supino` (`ff_variant_of = "barbell_row"`, `ff_grip = "supino"`): copia del remo con cada mano girada media vuelta sobre su eje por el hueco del puño, para retocar a mano (girar la mano en el visor no coincidía y la barra subía mucho). Sin esa acción, la mano gira en el visor (`roll`) y el codo se pega 30° (`ROW_SUP_ELBOW`). Implementos: barra, mancuernas (también supinas: palma delante) y 2 kettlebells (a los lados; su anchura sigue a «Anchura de agarre», como las mancuernas).
- **Inclinación con barra** (`ROW_BAR`): al inclinar más el tronco la barra iría tan al ombligo que atravesaría el pecho. Sube hacia el pecho en proporción (8 cm con la inclinación máxima, +25°) y el recorrido **se corta** cuando el codo llega a 120° (o al codo autorado del final, si es mayor), con frenada en el corte (`rowCut`, bisección sobre `evaluateRaw`, como `hingeCut`). También corta si «Hacia dónde sube» la lleva al pecho. Con mancuernas y kettlebells, recorrido completo.
- **Equilibrio**: el tronco a la inclinación autorada + `trunk`, la rodilla con su ángulo autorado, y una secante sobre la tibia (la pierna gira sobre el tobillo) para que el CdM con la carga actual quede donde lo tiene la autorada en ese frame × k. **Sin recortarlo a la zona del pie** (a diferencia de la bisagra): en la autorada el CdM va de +0,4 a −7 cm al tirar, y recortarlo movía la cadera con los valores por defecto (61 mm en el frame 1).
- Indicadores: tronco, codo, muslo, tibia, barra, CdM–mediopié, barra–mediopié y «Cadera» si cambia.

### 4.4e `evaluate`: tipo `cable` (remo en polea)

Acción `cable_row` (script `blender/ejercicios/cable_row.py`). Comparte la rama del remo (brazos que tiran, `rowUp`, codos, manos de referencia) con esto propio:

- **Pies fijos en la plataforma** (la de la pose de inicio; la plataforma no se mueve) y **pelvis en el asiento**: con «Flexión de rodilla» o con otras medidas, la pelvis se desliza por el asiento (delante/atrás) hasta que cada pierna mide lo que dan muslo y tibia con la rodilla autorada + el ajuste. Antes se movía la plataforma, que en una máquina es fija. Sin equilibrio (sentado, apoyado).
- **Plataforma** (`out.footPlate`): contra la planta de la pose de inicio: el giro del pie respecto al reposo aplicado a la planta en reposo (en el suelo). Antes salía de tobillo→dedos, que no es la planta, y los pies no apoyaban planos.
- **Tronco**: el de la animación alrededor de cómo queda al tirar (s = 1, `PHI1`): `swing` escala esa oscilación (0 % = quieto) y `trunk` la desplaza.
- **Polea** (`pulleyOf`, `pulleyAt`): la columna es la de la acción (`meta.pulley`: delante y, a un brazo, a un lado), pero **la altura por defecto es donde la línea antebrazo→maneral de la pose de inicio corta la columna**: así el antebrazo y la mano quedan en línea con el cable con la animación del usuario, se retoque como se retoque (la de la acción, 40 cm, quedaba por debajo del brazo). «Altura de la polea» la sube o baja desde ahí (nunca bajo 5 cm).
- **Al cambiar la altura**, el brazo estirado gira alrededor del hombro de la pose de inicio hasta apuntar a la polea nueva; esa corrección se **suma como una traslación que se desvanece en recta** según tira (`(e0 girado − e0) × (1 − rowUp)`), y las manos y los codos giran con ella (`qP`). Antes se giraba el vector hombros→maneral de cada frame y el maneral dibujaba un círculo hacia arriba; ahora la trayectoria se separa ≤ 5 cm de la recta y el antebrazo queda a ≤ 4° del cable con cualquier altura.
- **Muñeca recta** (`wrist`, por defecto «recta»): tras el IK del brazo, la mano gira lo mínimo para tener con el antebrazo (`DEF-FORARM0`) la relación de reposo (en reposo el eje de la mano va 4,6° del antebrazo), sin cambiar su giro sobre sí misma; la muñeca se recoloca para que el puño siga en el maneral y se repite 4 veces (≤ 2° de flexión en todo el recorrido, con cualquier polea y maneral). El usuario lo pidió para que la muñeca no se tuerza al tirar ni al subir la polea. **Es la excepción de fidelidad de la polea**: la mano (y por tanto el brazo) ya no es la de Blender; `tests/fidelity.js` mide la polea con «La de Blender» (`wrist = 'autorada'`), que da 0,0 mm.
- **Brazo estirado, en lazo cerrado** (`barShift`): con otro maneral, otra polea o la muñeca recta, la muñeca queda a otra distancia del hombro. El maneral se mueve a lo largo del brazo (`ud`) hasta que hombro→muñeca mide lo de la pose autorada en ese frame × k, con todo el peso con los brazos estirados y nada al tirar. Por **bisección** (una secante sacaba la mano del alcance: cerca del brazo recto la distancia se satura) y sin pasar de donde la mano llega. Por defecto no se toca. Coste: ~1 ms por frame.
- **Recorrido** (`bottom`, `top`): como en la dominada, recortan la animación con frenada en el corte.
- **Maneral del .blend** (`manData`, si existe `_mano.<maneral>`): el visor dibuja su malla y las manos salen de él (dedos de `_mano.<maneral>`, también para el maneral propio de la acción: los dedos de la acción ya no cuentan). Con la muñeca recta, el **centro de los agarres** sigue la trayectoria y el maneral gira ahí para quedar en línea con las manos, con las manos en línea con el antebrazo (5 pasadas); el cable engancha en el gancho, que queda donde toque. Girarlo alrededor del gancho era inestable (los agarres bajaban, el antebrazo los seguía y la mano acababa 56° hacia abajo). Rígido: un giro para todas las manos (la media); cuerda: cada ramal del gancho común a su mano. Con la barra, «Anchura de agarre» mueve las manos por ella. Con la muñeca de Blender, las manos son las de la acción y el maneral va donde lo pone la mano que tira. Sin datos de maneral, el esquemático de antes.
  - Con el triángulo, arriba/abajo la mano queda en línea (0–7°), pero si los codos se abren al tirar (en la acción, 22 cm del centro con las manos a 8) las manos no pueden seguir cada una a su antebrazo: queda una desviación lateral de hasta 35° al final. Se arregla con los codos más pegados en la acción.
- **Manerales** (`impl`): triángulo (el de la acción, `IMPL.triangulo`, a la anchura de Blender), barra recta (transversal a ±24 cm × anchura, palmas abajo; supino, arriba: `implHand` con `palm: 'down' | 'up'`) y cuerda (asas verticales, palmas dentro, que se abren 10 cm al tirar: `half + spread × rowUp`).
- Props (`placeCable`): columna y polea, cable (de la polea al gancho del maneral), asiento y plataforma (con la pose de inicio y la planta del pie), y el maneral.
- Indicadores: tronco, codo, ángulo del cable y altura de la polea.
- **A un brazo** (`meta.hand`, acción `cable_row_one_arm`): solo el brazo de esa mano va por IK. La **mano libre sigue apoyada en el muslo**: su muñeca y su giro se guardan en el marco del hueso del muslo más cercano de la pose autorada y se recolocan en el muslo actual (IK del brazo libre), así sube o baja con la pierna al doblar o estirar la rodilla. El asa exportada es el puño de esa mano (`FF_PUNO.R`), no el control `BARRA`: el control no sigue a los retoques de la mano (quedaba 11 cm por debajo). El pivote de los brazos (giro hacia la polea, vector hombro→asa) es ese hombro, no el centro de los hombros (con el pecho girado no están en el eje X y el codo se doblaba al cambiar polea o tronco). El maneral es el asa de la acción (`IMPL.asa`) y se ocultan maneral, agarre y anchura (`hide` en `PARAMS`).

### 4.5 Sliders (`PARAMS`)

| Tipo | id | Rango (defecto) | Efecto |
|---|---|---|---|
| stand | `depth` | 0,6–1,25 (1) | Escala el ángulo del muslo en la fase profunda. |
| stand | `knees` | ±12° (0) | Tibia preferida más o menos adelantada; el solver reparte. |
| stand | `stance` | 0,75–1,4 (1) | Anchura de pies. |
| stand | `toes` | −15…20° (0) | Rotación de pies sobre la autorada (también gira el polo de la rodilla). |
| stand | `grip` | 0,8–1,3 (1) | Anchura de agarre sobre el eje de la barra. |
| stand | `barH` | −6…4 cm (0) | Barra más alta o más baja en la espalda. |
| stand | `load` | 0–200 % PC (100) | Masa de la barra en el equilibrio y la demanda. |
| seat | `startOff` | −12…3 cm (0) | Inicio del recorrido (+ = más extendido). |
| seat | `depth` | 0,5–1,3 (1) | Final del recorrido. |
| seat | `footHigh` | ±10 cm (0) | Pies más altos o más bajos en la plataforma. |
| seat | `stance`, `toes`, `load` | — | Igual que arriba (carga 0–400 %, defecto 180). |
| hinge | `knees` | −60…20° (0) | Flexión de rodilla: negativo, la flexión máxima (tope); la animación va normal hasta llegar a él. Menos rodilla sube la cadera (y la adelanta cuando la tibia llega a −12°). |
| hinge | `depth` | −40…30 cm (0) | Profundidad: altura de la barra en el punto bajo. Hacia arriba recorta el recorrido; hacia abajo, más flexión de cadera, sin pasar del suelo ni de los bloques. |
| hinge | `plates` | 0…30 cm (0) | Altura de los discos (bloques): si quedan por encima del punto bajo, recortan el recorrido. |
| hinge | `feet` | 0…20 cm (0) | Altura de los pies (déficit): el cuerpo sube con los pies; si la barra se apoya, lo que falta sale de la cadera. |
| hinge | `stance`, `toes`, `grip`, `load` | — | Igual que en stand (agarre 0,9–1,3; carga 0–300 %, defecto 150). |
| hinge | `impl` | chips (barra) | Implemento: barra · mancuernas · a los lados · 1 kettlebell · 2 kettlebells. Lo que empieza en el suelo solo admite barra y kettlebells. |
| row | `impl` | chips (barra) | Barra · mancuernas · 2 kettlebells. |
| row | `gripType` | chips (prono) | Prono · supino (su acción, `barbell_row_supino`; con mancuernas, palma delante). |
| row | `trunk` | −40…25° (0) | Inclinación del tronco sobre la autorada (60° → 54° en la acción). Compensa la cadera; con barra, hacia el pecho y recorte a codo 120°. |
| row | `dest` | −20…8 cm (0) | Hacia dónde sube: negativo, hacia el pecho; positivo, hacia la cadera (por el tronco). |
| row | `grip`, `stance`, `toes`, `load` | — | Como en la bisagra (agarre 0,85–1,35; carga 0–150 %, defecto 60). |
| cable | `impl` | chips (triángulo) | Maneral: triángulo · barra recta · cuerda. |
| cable | `gripType` | chips (prono) | Con barra recta: prono · supino. |
| cable | `pulleyH` | −30…80 cm (0) | Altura de la polea sobre la autorada (40 cm). |
| cable | `trunk` | −15…25° (0) | Inclinación del tronco (desplaza toda la oscilación). |
| cable | `swing` | 0–200 % (100) | Balanceo del tronco: 0 % quieto (como al tirar). |
| cable | `dest` | −20…8 cm (0) | Hacia dónde tira, a lo largo del tronco. |
| cable | `knees` | −20…50° (0) | Flexión de rodilla (los pies quedan en la plataforma; la pelvis se desliza por el asiento). |
| cable | `grip`, `stance` | — | Anchura de la barra recta (0,7–1,6) y de pies. |
| cable | `wrist` | chips (recta) | Muñeca recta (mano alineada con el antebrazo) · la de Blender. |
| cable | `bottom`, `top` | 0–60 % (0), 40–100 % (100) | Desde dónde empieza y hasta dónde tira: recortan con frenada. |
| hang | `gripType` | chips (prono) | Prono · supino · neutro. Usa la variante de ese agarre si la hay (§2.6); si no, gira la mano. |
| hang | `grip` | 0,75–1,4 (1) | Anchura de agarre (el neutro va a la anchura de sus asas). |
| hang | `top` | 15–100 % (100) | Hasta dónde sube: recorta la animación por arriba, con frenada. |
| hang | `bottom` | 0–60 % (0) | Desde dónde baja: recorta por abajo (codos algo flexionados). |

Cuerpo (`state.body`):

- altura: 180;
- fémur, tibia y tronco: 100 %;
- dorsiflexión: 35°.

Preajustes: `avg`, `femur` (fémur largo), `torso` (tronco largo) y `ankle` (tobillo rígido).

Lo que el entrenador guardaría por cliente y ejercicio es `{ exerciseId, params, body }`: un JSON pequeño.

### 4.6 Render

- **Toon:** `MeshToonMaterial` con un gradiente de 2 pasos (196 y 255), luz ambiental 0,58 y luz direccional 0,5 pegada a la cámara.
- **Contorno:** casco invertido. Es un segundo SkinnedMesh con `BackSide` que se infla a lo largo de la normal después del skinning (`project_vertex`). El grosor se ajusta con la distancia de cámara.
- **Mapa muscular procedural:** en el shader, con la posición y la normal en reposo de cada vértice. Las zonas (cuádriceps, glúteo, isquios, aductores, gemelos y erectores) se definen con distancias a segmentos entre huesos del reposo (cadera, rodilla, tobillo, pelvis, pecho) pasados como uniforms. Sirve para cualquier avatar sin pintar máscaras. La intensidad sale de `act` (momentos articulares cuasi-estáticos).
- **Materiales:** los que contienen `02` en el nombre son articulaciones, en gris oscuro. El resto, cuerpo con heatmap.
- **Props:** barra y discos (grosor según la carga); prensa con asiento y respaldo fijos a la pose de inicio, plataforma y asas.
- **Vista lateral:** los discos se vuelven translúcidos cuando la cámara mira a lo largo de la barra.
- **Overlays:** trayectoria de la barra o la plataforma, línea del mediopié y esqueleto de referencia autorado (botón "Referencia").
- **Tema claro/oscuro:** con tokens CSS que el JS lee en `readTheme`.

### 4.7 Ganchos de depuración

`window.__dbg` expone `state`, `evaluate`, `authoredPose`, `POSES`, `REST`, `BN`, `RIG`, `camera`, `plates`, `setOverride`, etc. Los usan los tests. En producción se pueden quitar o dejar tras un flag.

---

## 5. Tests

```bash
npm test          # build + fidelity + balance
npm run shots     # capturas a tests/shots/*.png
```

- `fidelity.js`:
  - el FK del runtime coincide con Blender: 0,0 mm en todas las poses exportadas (claves y muestras);
  - con los valores por defecto, el runtime coincide con Blender (prensa al final: 43 mm a propósito; bisagra con codos flexionados en Blender: aviso, no fallo);
  - los pies no se deslizan (salvo `hang`: colgado no se apoyan).
- `balance.js`:
  - sentadillas: CdM y barra respecto al mediopié para 9 cuerpos y ajustes;
  - con el cuerpo por defecto, cambiar la carga no cambia la pose (salvo cuando el CdM llega al borde de la zona del pie);
  - bisagra: el punto bajo donde toca (suelo o autorada × k), sin saltos entre frames con 15 cuerpos, ajustes e implementos, las manos llegan al asa con cada implemento, en el rumano la mano va por donde con la barra con cualquier implemento, y sin carga el CdM no sale del pie;
  - dominada: las manos no se mueven en la barra con los tres agarres;
  - polea: sin saltos entre frames con 15 cuerpos, ajustes y manerales, las manos llegan y, con los brazos estirados, el codo es el autorado;
  - remo: sin saltos entre frames con 15 cuerpos, ajustes e implementos, las manos llegan, abajo el codo es el autorado (brazo recto) y, con barra, arriba no pasa de 120°.
- `harness.js`: Chromium headless con WebGL por SwiftShader. Sirve `three@0.147.0` desde `node_modules` porque el CDN no es accesible en CI.

---

## 6. Limitaciones conocidas y siguientes pasos

- **Remo en polea** (`cable_row`) y **a un brazo** (`cable_row_one_arm`) hechos por script; falta que el usuario los retoque en Blender y los vea en el móvil. Idea: con la polea alta, que «Hacia dónde tira» vaya solo hacia el pecho. El remo con barra (`row`) está hecho; retocado a mano; pendiente retocar la variante supina `barbell_row_supino` (codos pegados) y verlo en el móvil.
- **Demanda muscular:** sale del modelo de palos (`cur.act`), no de la pose final. En `hinge` es aproximada y en `hang` no hay (el mapa solo tiene piernas y espalda baja): faltan las zonas de tracción y empuje.
- **Bisagra:** codos flexionados en las claves del convencional (25° al empezar); choques entre implementos, brazos y piernas; una kettlebell entre los pies debería limitar cuánto se cierran (X02 §7).
- **Dominada:** piernas cruzadas o dobladas, escápulas, pecho a la barra por encima de la autorada.
- **Tamaño:** con muestras, ~150 KB por ejercicio; para cientos, un JSON por ejercicio cargado bajo demanda y quitar dedos que no cambian (§3.3).
- **Tempo:** idea de usar el tempo del ejercicio para el ritmo de la animación (X01 §2.16).
- **Visuales pendientes:** la vista «Frente» no es exactamente frontal. La prensa no muestra el raíl ni el carro y su plataforma ignora la rotación de ~10° de la clave final.
- **Exportador:** asume los nombres del rig del maniquí (`Armature_Mannequin`, `Mannequin`, `DEF-*`, `PROPERTIES`, `BARRA`, `MAQUINA`, `PLATAFORMA`, `FF_asa_±1`).

La migración a la app está en `docs/PORTING.md`.
