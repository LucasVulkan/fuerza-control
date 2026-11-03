# Maniquí 3D de FormFit: cómo funciona todo

Este documento recoge cómo funciona hoy cada pieza del sistema. Cubre:

- qué hay en Blender;
- qué hace cada script;
- qué se exporta y en qué formato;
- cómo el visor convierte eso en una pose ajustable.

Las decisiones de diseño vienen de muchas iteraciones con el usuario; cuando hay una regla rara, va con su porqué.

---

## 1. Visión general

```
 Blender (FormFit_Maniqui.blend)              export.py                       runtime.js
 ┌───────────────────────────────┐   ┌──────────────────────────┐   ┌──────────────────────────────────────┐
 │ Rig del maniquí (~290 huesos) │   │ esqueleto limpio DEF-*   │   │ pose autorada(s) = slerp inicio→final │
 │ 1 acción por ejercicio        │──▶│ mannequin.glb (malla)    │──▶│ + correcciones (sliders, cuerpo)      │
 │ frame 1 = inicio, 30 = final  │   │ poses.json (2 claves/ej.)│   │ + equilibrio en lazo cerrado          │
 │ BARRA / MAQUINA / PLATAFORMA  │   │ + barra/plataforma/asas  │   │ + heatmap + estética toon             │
 └───────────────────────────────┘   └──────────────────────────┘   └──────────────────────────────────────┘
```

**La idea clave:** el entrenador ve exactamente lo que se posó en Blender. Cada slider o medida del cliente añade solo la diferencia que calcula el solver. Así se conserva el estilo humano de la pose, que un solver no sabe inventar, y aun así el maniquí se adapta.

Escalar a cientos de ejercicios significa:

- por cada ejercicio, una acción en Blender con dos claves;
- un tipo de base (`stand` o `seat`) que decide sliders y solver;
- ejecutar el exportador.

Sin código nuevo, salvo que haga falta un tipo de base nuevo.

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
   **Claves intermedias** (por ejemplo, para que la barra no atraviese la tibia): keya también los frames que quieras entre el 2 y el 29. El exportador las guarda en `poses.json` como `mid` (cada una con su `s = (frame − 1) / 29`), el visor interpola por tramos entre claves consecutivas (`seg()` en runtime.js) y `tests/fidelity.js` comprueba cada una a 0,0 mm. Ojo: **Recrear** del panel rehace la acción de cero y las borra; los deslizadores en vivo solo reescriben los frames 1 y 30.
3. Para tipo máquina, ten `MAQUINA` visible (escala 1) y la barra oculta (escala 0.001), o al revés.
4. Propiedades personalizadas en la acción: `ff_base` (`"stand"`, `"seat"` o `"hinge"`) y `ff_name` (el nombre visible). Con eso el visor la enseña sin tocar código (`EXERCISES` se completa con la meta de `poses.json`).
5. Exporta (§3). El exportador detecta todas las acciones con claves hasta el frame 30. Ignora las que empiezan por `00` o `_`; por ejemplo `00-keying`.

**Versión de Blender.** El `.blend` lo guardó por última vez Blender **5.0** (el de este equipo). Antes lo había guardado el 5.2 del chat original; al abrirlo con el 5.0 avisa de «posible pérdida de datos», pero el export del 5.0 sale idéntico (0,000 mm) en las tres acciones. Usa siempre la misma versión para guardarlo.

### 2.4 La pose base automática

`autopose.py` reconstruye poses sobre el rig a partir de **direcciones de segmentos**, no de rotaciones de huesos. Por eso funciona entre esqueletos distintos. Recibe un `cc_poses.json` con, por clave:

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

`legacy/extract_cc.py` sacó ese JSON del primer modelo de Character Creator. Para ejercicios nuevos, el camino natural es que Claude genere el `cc_poses.json`:

- a partir de una descripción biomecánica (ángulos de muslo, tibia y tronco, posición de la barra, etc.);
- o a partir de un ejercicio parecido ya posado.

Después se ejecuta `autopose.py` y el usuario retoca en Blender.

### 2.5 Posar por script: `ffpose.py` y `blender/ejercicios/`

`autopose.py` depende de un JSON sacado de otro modelo. Para ejercicios nuevos se describe la pose **en geometría del propio maniquí**:

- `blender/ffpose.py`: la librería. Medidas en reposo (muslo, tibia, tronco, brazo hasta el centro del puño), coordenadas sagitales (`W(f, z)`: f = hacia delante = −Y), y funciones para colocar tronco (`place_trunk`), pies (`place_feet`), barra (`place_bar`) y manos en la barra (`grip_bar`, con `HANG_PRONE` para colgar en prono). `new_action` crea la acción con `ff_base` y `ff_name`; `key(frame)` keya **todos** los canales del rig y de `PROPERTIES`; `report` avisa si una mano no llega.
- `blender/ejercicios/romanian_deadlift.py`: el rumano. Usa la geometría de `deadlift.py` con el punto bajo más alto (`BAR_LOW`, barra a media tibia) y menos rodilla, y le da la vuelta: empieza arriba (frame 1) y baja (frame 30).
- `blender/ejercicios/deadlift.py`: el peso muerto. Barra sobre el mediopié real (mitad del pie, medida en la malla), en el suelo al radio del disco; brazos casi rectos; la cadera sale de cruzar muslo y tronco; al bloquear, tronco erguido y la barra apoyada en la cara delantera del muslo. Sus `PARAMS` (anchura, rotación de pies, agarre, tibia…) son los mandos, con su valor por defecto y su rango.
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

---

## 3. Exportación (`blender/export.py`)

```bash
blender -b --python blender/export.py -- blender/FormFit_Maniqui.blend assets/ [corregido.blend] [--exercises a,b]
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
5. **`poses.json`.** Por cada ejercicio y cada clave (frame 1 = `start`, 30 = `end`), las transformaciones mundiales de cada DEF y los implementos.

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
      "meta": { "base": "stand", "name": "back_squat" },
      "start": {
        "bones": { "<hueso>": { "p": [...], "q": [...], "len": 1.0, "off": [...] } },  // mundo; off = local respecto al padre
        "bar": { "center": [...], "axis": [...] },                               // solo si BARRA visible
        "ik_parent": { "hand": 5, "foot": 0 }
      },
      "end": { ... }
    },
    "leg_press": {
      "meta": { "base": "seat", ... },
      "start": { "bones": {...}, "machine": { "p", "q" }, "plate": { "p", "normal", "up" }, "handles": [[...],[...]], ... },
      "end": { ... }
    }
  }
}
```

Por ejercicio son unos 40 KB; 300 ejercicios rondarían 12 MB. Para producción conviene:

- un JSON por ejercicio, cargado bajo demanda;
- y/o quitar los dedos que no cambian y cuantizar.

---

## 4. Runtime (`prototype/runtime.js`)

Es un único archivo de unas 680 líneas (three.js r147 UMD) y contiene toda la lógica. `shell.html` es la UI web y `build.py` lo empaqueta todo en `viewer.html`, con el GLB en base64.

### 4.1 Datos y FK

- `REST` y `LOCAL_OFF` salen de `poses.rest`. `ORDER` es el orden topológico y `KIDS` los hijos.
- `authoredPose(ex, s)` calcula la pose autorada en el instante `s ∈ [0,1]`:
  - las rotaciones **locales** se interpolan con slerp entre start y end;
  - los `off` se interpolan linealmente;
  - después se aplica FK desde `DEF-HIPS`.
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

   Busca `phi` y `th` para que el centro de masas quede sobre el mediopié, con la tibia limitada por la dorsiflexión. Se resuelve **dos veces**: con el cuerpo y los ajustes por defecto (`ref`) y con los actuales (`cur`). Se aplican las diferencias:
   - `th = F.th + (cur.th − ref.th)`, limitada a `max(35°, F.th) + (dorsi − 35°)`. El límite es relativo para respetar poses autoradas con más de 35° de tibia, como la frontal (51°).
   - Cadera: `F.hip + G(cur) − G(ref)`.
4. **`build(phi)`**: construye la pose completa para una inclinación de tronco dada.
   - **Tronco:** rotación `R = QA(X, phi − F.phi)` aplicada a todo lo que no es pierna.
   - **Piernas:** IK hasta el **tobillo plantado**: posición exportada de Blender, escalada por `stance` y `k`. El pie y la punta toman la rotación exportada más la rotación de pies.

     ⚠️ No uses el tobillo del FK interpolado: entre claves se desliza hasta 13 cm.
   - **Barra:** hombro + `du`·u + `dn`·n + `dx` (el offset lateral cuenta).
   - **Brazos:** el agarre se proyecta sobre el eje de la barra y se escala con `grip`. La muñeca se coloca desde el *socket* del puño (`socketRest`). El polo del codo es el autorado rotado con el tronco. Si la mano no llega, se avisa.
5. **Equilibrio en lazo cerrado:** `comOffset(pose, bar, carga)` calcula el centro de masas real del sistema respecto al mediopié real. Se ajusta `phi` por secante (hasta 8 iteraciones) para que ese offset sea **el de las claves de Blender, interpolado entre ellas** (`comRef`). No vale el de la pose interpolada: entre claves se interpolan rotaciones, no el equilibrio, y el objetivo se iba hasta −5,5 cm a mitad de bajada (y el tronco quedaba 7° más erguido que el autorado).

   Esto corrige lo que el modelo de palos no captura. Por ejemplo, con el tobillo limitado a 20° en la sentadilla frontal, antes el centro de masas quedaba 8,5 cm por detrás; ahora queda en −3,8 cm, igual que en la pose autorada.

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

- **La barra va en las manos** (`hingeGrip`): en cada clave se guarda, por lado, puño − barra y el alcance hombro→puño, y entre claves se interpolan. La barra se pone a la altura que deja el puño izquierdo al alcance del hombro actual (agarre más abierto → barra más alta) y las manos van a la barra por IK. En las claves es exactamente la autorada.

  ⚠️ No uses la barra interpolada con las manos de la pose interpolada: la barra va en recta y las manos en arco (en el rumano, con dos claves, se separaban 11 cm).
- **Punto bajo y alto** (`hingeKeys`): la clave con la barra más baja y la más alta. En el convencional el bajo es el inicio; en el rumano, el final (empieza arriba).
- **Recorte** (`hingeCut`, `hingeS`): con `depth` positivo, o con bloques más altos que el punto bajo, la repetición **se acorta**: va del punto alto al momento de la animación en que la barra (en las manos) está a esa altura. Lo de debajo no se ve; no se comprime. `evaluate` traduce la s de la repetición a la s de la animación.
- **Muslo y tronco**, con una sola solución en cada paso:
  1. Punto bajo (`s` = la del recorte), en dos partes:
     - a) **El cuerpo** (fémur, tronco, agarre, rodilla): Newton 2×2 sobre muslo y tronco para la altura base, con la barra sobre el mediopié. La altura base es: apoyada (suelo o bloques) → la del apoyo, igual para todos los cuerpos; recortada sin apoyo → la de la animación en ese punto; si no → la autorada × k.
     - b) **Lo que falta** (déficit, `depth` negativo): **flexión de cadera**. El ángulo de la rodilla no cambia (muslo + tibia fijo): la pierna gira sobre el tobillo, la cadera va atrás casi sin bajar (−1 cm con 8 cm de déficit) y el tronco se inclina. Nada de cuclillas.

     Salen `dB0` y `dTh` (cambio de muslo y de tibia), una vez por cuerpo y ajustes (`hingeStart`, en caché). Si no llega a la altura, avisa.
  2. Resto: muslo y tibia = autorados + `dB0`/`dTh` × `(1 − subida)²` (0 arriba: de pie es de pie; con el cuadrado, la barra no acelera al llegar abajo). El tronco, por secante, el que deja la barra sobre el mediopié.

  Antes era un Newton 2×2 que mezclaba «altura de la barra» y «muslo autorado» con pesos según `s`: con otro cuerpo saltaba de solución (hasta 20 cm de un frame al siguiente). `tests/balance.js` lo vigila.
- `knees` es «Flexión de rodilla»: más o menos tibia, con todo su efecto abajo, que se desvanece hacia arriba.
- **Altura de los pies** (`feet`): se resuelve con los pies en el suelo y al final se sube todo el cuerpo y la barra. **Altura de los discos** (`plates`): bloques bajo los discos. El visor dibuja las cajas (`blocks`, `footBox`).
- Aviso de isquios: tronco por encima de 85° con la rodilla flexionada menos de 45°.

**Ejercicios vecinos** (spec X01 §2.14): cada uno tiene su acción y los mismos ajustes los acercan. El rumano con `knees` +8 y `depth` −40 queda en tronco 70°, muslo 66° y barra en el suelo; el convencional por defecto está en 72° y 65° (`tests/shots/rdl_as_conventional.png`).

**Ojo con el rumano:** en este modelo (brazos colgando, hombros sobre la barra, barra sobre el mediopié) bajar la barra a media tibia exige ~58° de flexión de rodilla, y aun a la altura de la rodilla ~47°. Una rodilla más recta solo deja inclinar el tronco ~25°. Un rumano más «rígido» se retoca a mano en Blender o se recorta con `depth`.

Con los valores por defecto sale la autorada: 0,0 mm en las claves. Indicadores: tronco, muslo, tibia, altura de la barra, barra–mediopié y, si cambia, «Cadera abajo» (cuánto y por qué).

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
| hinge | `knees` | −6…15° (0) | Flexión de rodilla: más o menos tibia, todo su efecto en el punto bajo; se desvanece al subir. |
| hinge | `depth` | −40…30 cm (0) | Profundidad: altura de la barra en el punto bajo. Hacia arriba recorta el recorrido; hacia abajo, más flexión de cadera, sin pasar del suelo ni de los bloques. |
| hinge | `plates` | 0…30 cm (0) | Altura de los discos (bloques): si quedan por encima del punto bajo, recortan el recorrido. |
| hinge | `feet` | 0…20 cm (0) | Altura de los pies (déficit): el cuerpo sube con los pies; si la barra se apoya, lo que falta sale de la cadera. |
| hinge | `stance`, `toes`, `grip`, `load` | — | Igual que en stand (agarre 0,9–1,3; carga 0–300 %, defecto 150). |

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

- `fidelity.js` comprueba tres cosas:
  - el FK del runtime coincide con Blender: 0,0 mm en todas las claves;
  - con los valores por defecto, el runtime coincide con Blender: 0,0 mm (prensa al final: 43 mm a propósito, por la pelvis fija y la plataforma sin rotar);
  - los pies no se deslizan: 0,0 mm.
- `balance.js`: centro de masas y barra respecto al mediopié para 9 combinaciones de cuerpo y ajustes. El CdM debe quedarse en el valor autorado y los tobillos a la altura de tobillo × k. Para `hinge`, 7 cuerpos/ajustes en s = 0, 0,5 y 1: en el punto bajo la barra tiene que estar en el suelo (si la autorada lo está) o a la autorada × k (±5 mm). Además, sin saltos: con 11 cuerpos/ajustes (bloques, déficit, más y menos hondo incluidos), ningún paso de la barra entre frames puede ser más del doble que el mayor de sus vecinos (el solver antiguo da 14 fallos).
- `harness.js`: Chromium headless con WebGL por SwiftShader. Sirve `three@0.147.0` desde `node_modules` porque el CDN no es accesible en CI.

---

## 6. Limitaciones conocidas y siguientes pasos

- **Configuración de ejercicios:** `EXERCISES` en `runtime.js` lleva los nombres cortos a mano; una acción que no esté se añade sola con su `meta` de `poses.json`.
- **Demanda muscular:** sale del modelo de palos (`cur.act`), no de la pose final tras el lazo cerrado. Recalcularla sobre la pose real sería más coherente. En `hinge` es aún más aproximada: el modelo de palos pone la barra en el tronco.
- **Peso muerto:** pose base por script (§2.5), sin retoque a mano todavía. Al empezar el tronco sale bastante horizontal (71°); se puede bajar la cadera con `SHIN_START` hasta donde la espinilla deja, o retocando en Blender.
- **Tipos de base:** existen `stand` (barra en el tronco), `seat` (prensa) y `hinge` (barra en las manos). Para nuevos patrones (spec X01 §16, por apoyo):
  - tumbado (press banca, hip thrust);
  - colgado (dominadas);
  - empuje vertical.
- **Visuales pendientes:** la vista "Frente" no es exactamente frontal. La prensa no muestra el raíl ni el carro.
- **Plataforma de la prensa:** la rotación de unos 10° en la clave final se ignora. Conviene corregirla en Blender.
- **Exportador:** asume los nombres del rig del maniquí (`Armature_Mannequin`, `Mannequin`, `DEF-*`, `PROPERTIES`, `BARRA`, `MAQUINA`, `PLATAFORMA`, `FF_asa_±1`).

La migración a la app está en `docs/PORTING.md`.
