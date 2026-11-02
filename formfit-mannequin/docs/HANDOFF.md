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
| `BARRA`, `MAQUINA`, `PLATAFORMA` | Implementos. Las manos y los pies van emparentados vía `PROPERTIES`. |
| `PROPERTIES` | Interruptores IK/FK (`ARM-IK/FK`, `LEG-IK/FK`; 0 = IK) y los padres de IK. |

Preferencias del usuario sobre el rig, ya acordadas:

- El polo del codo solo orienta el húmero y la mano no se mueve.
- La mano no se desliza entre el inicio y el final.
- La rotación de la mano está aislada del brazo.
- Las acciones van separadas: una por ejercicio, sin encadenarlas en una línea de tiempo.
- Todo va en el frame 1 y el 30. Si algo cae en el frame 2 es un error y se mueve al 1.

### 2.3 Cómo se añade un ejercicio nuevo

1. Duplica una acción del mismo tipo (por ejemplo `back_squat` → `hip_thrust`) y ponle `use_fake_user`.
2. Posa el frame 1 (inicio) y el frame 30 (final) con los controles de arriba. Keya los controles y las propiedades de `PROPERTIES`.
3. Para tipo máquina, ten `MAQUINA` visible (escala 1) y la barra oculta (escala 0.001), o al revés.
4. Si quieres, añade propiedades personalizadas en la acción: `ff_base` (`"stand"` o `"seat"`) y `ff_name` (el nombre visible).
5. Exporta (§3). El exportador detecta todas las acciones con claves hasta el frame 30. Ignora las que empiezan por `00` o `_`; por ejemplo `00-keying`.

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

---

## 3. Exportación (`blender/export.py`)

```bash
blender -b --python blender/export.py -- blender/FormFit_Maniqui.blend assets/ [corregido.blend] [--exercises a,b]
# o con el módulo bpy de pip:   python3 -I blender/export.py blender/FormFit_Maniqui.blend assets/
#   (en la sesión original se usó  pip install bpy==5.2.3; ejecutar SIEMPRE con -I y fuera de la carpeta de scripts)
```

### 3.1 Qué hace, en orden

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
5. **Equilibrio en lazo cerrado:** `comOffset(pose, bar, carga)` calcula el centro de masas real del sistema respecto al mediopié real. Se ajusta `phi` por secante (hasta 8 iteraciones) para que ese offset sea **igual al de la pose autorada**.

   Esto corrige lo que el modelo de palos no captura. Por ejemplo, con el tobillo limitado a 20° en la sentadilla frontal, antes el centro de masas quedaba 8,5 cm por detrás; ahora queda en −3,8 cm, igual que en la pose autorada.

   *Opción pendiente de decidir:* forzar el centro de masas a 0 cm en lugar del offset autorado. Las poses actuales tienen −2,8 cm (trasera) y −3,8 cm (frontal).
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
- `balance.js`: centro de masas y barra respecto al mediopié para 9 combinaciones de cuerpo y ajustes. El CdM debe quedarse en el valor autorado y los tobillos a la altura de tobillo × k.
- `harness.js`: Chromium headless con WebGL por SwiftShader. Sirve `three@0.147.0` desde `node_modules` porque el CDN no es accesible en CI.

---

## 6. Limitaciones conocidas y siguientes pasos

- **Configuración de ejercicios:** `EXERCISES` en `runtime.js` está escrito a mano. Ya se exporta `meta.base` y `meta.name`; el runtime debería leerlos de `poses.json`.
- **Demanda muscular:** sale del modelo de palos (`cur.act`), no de la pose final tras el lazo cerrado. Recalcularla sobre la pose real sería más coherente.
- **Tipos de base:** solo existen `stand` (con barra) y `seat` (prensa). Para nuevos patrones habría que añadir uno nuevo cada vez:
  - bisagra de cadera (peso muerto, RDL);
  - tumbado (press banca, hip thrust);
  - colgado (dominadas);
  - empuje vertical.
- **Visuales pendientes:** la vista "Frente" no es exactamente frontal. La prensa no muestra el raíl ni el carro.
- **Plataforma de la prensa:** la rotación de unos 10° en la clave final se ignora. Conviene corregirla en Blender.
- **Exportador:** asume los nombres del rig del maniquí (`Armature_Mannequin`, `Mannequin`, `DEF-*`, `PROPERTIES`, `BARRA`, `MAQUINA`, `PLATAFORMA`, `FF_asa_±1`).

La migración a la app está en `docs/PORTING.md`.
