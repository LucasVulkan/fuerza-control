"""Herramientas para posar ejercicios por script sobre el rig del maniquí (Blender 4.4+ / 5.x).

Se importa desde los scripts de `blender/ejercicios/`. Da:
  - medidas del maniquí en reposo (muslo, tibia, tronco, brazo hasta el puño…);
  - colocar tronco, pies, barra y manos con posiciones del mundo (Z arriba, -Y delante);
  - crear la acción con sus metadatos y keyar inicio (frame 1) y final (frame 30), sin que se cuelen
    valores de otras acciones (se keyan todos los controles, también los que se quedan en reposo).
Coordenadas sagitales: f = hacia delante (= -Y), z = arriba.
"""
import bpy, sys, math, json, re
from mathutils import Vector, Matrix

if __name__ == '__main__':      # blender -b --factory-startup --python blender/ffpose.py -- entrada.blend salida.blend sellar a,b,c
    bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--') + 1])

rig = bpy.data.objects['Armature_Mannequin']; pb = rig.pose.bones; ab = rig.data.bones
vl = bpy.context.view_layer
FRAMES = (1, 30)
PLATE_R = 0.225                                     # radio del disco de 20 kg: la barra en el suelo tiene el centro a esta altura


touched = set()                                     # controles que ha movido la pose actual (para el recálculo en vivo)


def upd(): vl.update(); vl.update()
def H(n): return ab[n].head_local.copy()
def rest_rot(n): return ab[n].matrix_local.to_3x3()
def W(f, z, x=0.0): return Vector((x, -f, z))           # sagital -> mundo de Blender
def sagittal(v): return v.y * -1, v.z                    # mundo -> (f, z)


def setM(name, rot3, pos):
    m = rot3.to_4x4(); m.translation = pos; pb[name].matrix = m; touched.add(name); upd()


# ---- medidas en reposo
hipL, hipR = H('DEF-THIGH01.L'), H('DEF-THIGH01.R'); hipMid = (hipL + hipR) / 2
shL, shR = H('DEF-ARM01.L'), H('DEF-ARM01.R'); shMid = (shL + shR) / 2
Lt = (H('DEF-SHIN01.L') - hipL).length; Ls = (H('DEF-FOOT.L') - H('DEF-SHIN01.L')).length
ankleH = H('DEF-FOOT.L').z
TORSO_PIVOT = ab['TORSO'].head_local.copy()
trunk_rest = math.atan2(-(shMid - hipMid).y, (shMid - hipMid).z)      # inclinación hacia delante del tronco en reposo


CURL = -75                                          # cierre del puño (FINGER-MASTER, grados)
_SOCK = {}


def fist(S, curl=CURL):
    pb[f'FINGER-MASTER.{S}'].rotation_euler.x = math.radians(curl)
    pb[f'FINGER-ROT-MASTER.{S}'].rotation_euler.x = math.radians(curl + 5)
    touched.update((f'FINGER-MASTER.{S}', f'FINGER-ROT-MASTER.{S}'))


def socket(S):
    """Hueco del puño YA CERRADO respecto a la muñeca, con la mano en reposo (palma abajo): es lo que va sobre el eje de la
    barra. Con la mano abierta el hueco queda ~3 cm más arriba; por eso se mide con los dedos cerrados (centro de las
    falanges de corazón y anular)."""
    if not _SOCK:                                   # las dos manos a la vez y una sola vez: medir pone el rig en reposo
        act = rig.animation_data.action if rig.animation_data else None
        if act: rig.animation_data.action = None
        reset(); fist('L'); fist('R'); upd()
        for s in 'LR':
            pts = [pb[f'DEF-FINGER-{d}-0{i}.{s}'].head for d in 'BC' for i in (1, 2, 3)] + [pb[f'DEF-FINGER-{d}-03.{s}'].tail for d in 'BC']
            _SOCK[s] = sum(pts, Vector()) / len(pts) - pb[f'DEF-HAND.{s}'].head
        reset()
        if act: rig.animation_data.action = act
    return _SOCK[S].copy()


def rigid_wrists():
    """La mano toma el giro de HAND_IK pero su posición es el final del antebrazo: si el brazo no llega, la mano no se separa
    estirando la muñeca (DEF-FORARM0 llegaba al 140 %). Idempotente."""
    for S in 'LR':
        p = pb[f'MCH-HAND-SWITCH.{S}']
        if 'FF_mano_en_antebrazo' in p.constraints: continue
        c = p.constraints.new('COPY_LOCATION'); c.name = 'FF_mano_en_antebrazo'
        c.target = rig; c.subtarget = f'MCH-FORARM-SWITCH.{S}'; c.head_tail = 1.0
        print(f'  muñeca {S}: la mano ya no se separa del antebrazo')
    upd()


def arm_len(S):
    """Hombro (DEF-ARM01) -> centro del puño con el brazo recto (en reposo el brazo está estirado en T)."""
    return (H(f'DEF-HAND.{S}') + socket(S) - H(f'DEF-ARM01.{S}')).length


def trunk_R(phi):
    """Rotación del tronco para que la línea cadera-hombro quede a `phi` de la vertical (+ = hacia delante)."""
    return Matrix.Rotation(phi - trunk_rest, 3, 'X')


def shoulders_for(hip_f, hip_z, phi):
    """Hombros (L, R) en el mundo con la cadera (punto medio) en (f, z) y el tronco a `phi`."""
    hip = W(hip_f, hip_z); R = trunk_R(phi)
    return {S: hip + R @ (H(f'DEF-ARM01.{S}') - hipMid) for S in 'LR'}


def reset():
    for p in pb:
        p.location = (0, 0, 0); p.scale = (1, 1, 1); p.rotation_quaternion = (1, 0, 0, 0); p.rotation_euler = (0, 0, 0)
    if 'BANCO' in pb: pb['BANCO'].scale = (0.001,) * 3            # el banco, oculto salvo que la pose lo coloque
    upd()


def setup_bench():
    """Banco (o cajón, o asiento) para posar: hueso BANCO (sin deformar, hijo de ROOT) con la caja FF_banco colgada de él, en
    FF_Props. Cada acción lo keya: colocado (place_bench) o escondido (escala 0,001). Las acciones que ya había lo keyan
    escondido. La caja mide 1 m de lado en reposo, con el centro de la cara de arriba en la cabeza del hueso: la escala del
    hueso es la medida (ancho x, largo y, alto z). Idempotente."""
    if 'BANCO' not in ab:
        for ob in vl.objects: ob.select_set(False)
        vl.objects.active = rig; rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT'); eb = rig.data.edit_bones
        b = eb.new('BANCO'); b.head = (0, 0, 0); b.tail = (0, 0.05, 0); b.roll = 0; b.parent = eb['ROOT']; b.use_deform = False
        bpy.ops.object.mode_set(mode='POSE')
        reset(); pb['BANCO'].scale = (1, 1, 1); upd()
        me = bpy.data.meshes.new('FF_banco')
        v = [(x, y, z) for x in (-.5, .5) for y in (-.5, .5) for z in (-1, 0)]
        me.from_pydata(v, [], [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)])
        ob = bpy.data.objects.new('FF_banco', me); ob.color = (0.35, 0.35, 0.38, 1)
        bpy.data.collections['FF_Props'].objects.link(ob)
        ob.parent = rig; ob.parent_type = 'BONE'; ob.parent_bone = 'BANCO'; upd()
        ob.matrix_world = rig.matrix_world @ pb['BANCO'].matrix           # con el hueso en reposo: la caja en su cabeza
        reset(); print('  BANCO y FF_banco creados')
    for act in bpy.data.actions:
        if act.name.startswith(('00', '_', MANO)) or not act.layers or 'pose.bones["BANCO"].scale' in keyed_paths(act): continue
        rig.animation_data.action = act; pb['BANCO'].scale = (0.001,) * 3
        for f in FRAMES: pb['BANCO'].keyframe_insert('scale', frame=f); pb['BANCO'].keyframe_insert('location', frame=f); pb['BANCO'].keyframe_insert('rotation_quaternion', frame=f)
        print(f'  {act.name}: banco escondido')
    upd()


def setup_discs():
    """PROPERTIES["DISCOS"] (1 = con discos, 0 = sin): los discos de la barra se encogen con un driver. Así una acción puede
    colgar las manos de la barra (ARM_IK_parent = 5, que copia también la escala del control BARRA, por eso no se puede
    esconder la barra encogiéndola) y enseñarla como barra de jalón. Las acciones que ya había lo keyan a 1. Idempotente."""
    P = pb['PROPERTIES']
    if 'DISCOS' not in P:
        P['DISCOS'] = 1
        P.id_properties_ui('DISCOS').update(min=0, max=1, description='0 = la barra sin discos (barra de jalón)')
        for s in ('1', '-1'):
            ob = bpy.data.objects[f'FF_disco_{s}']
            for i in range(3):
                d = ob.driver_add('scale', i).driver; d.type = 'SCRIPTED'; d.expression = 'max(p, 0.001)'
                v = d.variables.new(); v.name = 'p'; v.targets[0].id = rig; v.targets[0].data_path = 'pose.bones["PROPERTIES"]["DISCOS"]'
        print('  DISCOS creada')
    path = 'pose.bones["PROPERTIES"]["DISCOS"]'
    for act in bpy.data.actions:
        if act.name.startswith(('00', '_', MANO)) or not act.layers or path in keyed_paths(act): continue
        rig.animation_data.action = act; P['DISCOS'] = 1
        for f in FRAMES: P.keyframe_insert('["DISCOS"]', frame=f)
        finish(act); print(f'  {act.name}: DISCOS = 1')
    upd()


def place_bench(f, z, size, x=0.0, along_x=False):
    """Banco con el centro de la cara de arriba en (f, z, x) y medidas `size` = (ancho, largo, alto) en metros. Por defecto el
    largo va de delante a atrás (press de banca); along_x: de lado a lado (hip thrust, búlgara)."""
    R = Matrix.Rotation(math.pi / 2, 3, 'Z') if along_x else Matrix.Identity(3)
    want = W(f, z, x); ob = bpy.data.objects['FF_banco']
    p = pb['BANCO']; p.rotation_mode = 'QUATERNION'
    m = R.to_4x4(); m.translation = want; p.matrix = m; p.scale = size; touched.add('BANCO'); upd()
    for _ in range(3):                    # la caja cuelga de la cola del hueso: al escalar se desplaza; se corrige midiendo
        err = want - ob.matrix_world.translation
        if err.length < 1e-5: break
        p.location = p.location + ab['BANCO'].matrix_local.to_3x3().inverted() @ err; upd()


def set_props(hand_parent, foot_parent, bar_in_hands=0, discs=1):
    """hand_parent: 0 raíz · 5 barra. foot_parent: 0 raíz · 2 plataforma. bar_in_hands: 1 = la barra visible va entre los
    puños (setup_bar_in_hands). discs: 0 = la barra sin discos (barra de jalón; setup_discs). IK en brazos y piernas."""
    P = pb['PROPERTIES']
    if 'BARRA_EN_MANOS' in P: P['BARRA_EN_MANOS'] = bar_in_hands
    if 'DISCOS' in P: P['DISCOS'] = discs
    for S in 'LR':
        P[f'ARM-IK/FK.{S}'] = 0; P[f'LEG-IK/FK.{S}'] = 0
        P[f'ARM_IK_parent.{S}'] = hand_parent; P[f'FOOT-IK-PARENT.{S}'] = foot_parent
    touched.add('PROPERTIES'); rig.update_tag(); upd()


def place_trunk(hip_f, hip_z, phi):
    R = trunk_R(phi)
    setM('TORSO', R @ rest_rot('TORSO'), W(hip_f, hip_z) - R @ (hipMid - TORSO_PIVOT))


def place_feet(ankle_x, toe_out_deg, ankle_f=0.0):
    """Tobillos en (±ankle_x, f, altura de tobillo); puntas giradas hacia fuera."""
    for S, sgn in (('L', 1), ('R', -1)):
        Df = Matrix.Rotation(math.radians(sgn * toe_out_deg), 3, 'Z')
        fik = f'FOOT-IK.{S}'; a = W(ankle_f, ankleH, sgn * ankle_x)
        setM(fik, Df @ rest_rot(fik), a + Df @ (H(fik) - H(f'DEF-FOOT.{S}')))


def hide_machine(): pb['MAQUINA'].scale = (0.001,) * 3; touched.add('MAQUINA'); upd()
def hide_bar(): pb['BARRA'].scale = (0.001,) * 3; touched.add('BARRA'); upd()
def place_bar(f, z): setM('BARRA', rest_rot('BARRA'), W(f, z))


# mano colgando con agarre prono: el eje de la mano (en reposo +X / -X) apunta abajo y la palma mira atrás (+Y, hacia el cuerpo)
HANG_PRONE = {'L': Matrix(((0, 1, 0), (0, 0, -1), (-1, 0, 0))), 'R': Matrix(((0, -1, 0), (0, 0, -1), (1, 0, 0)))}


def grip_bar(bar, half_width, hand_rot, pole_dir, curl=CURL):
    """Manos en la barra (hueco del puño cerrado sobre el eje, a ±half_width), codos hacia pole_dir."""
    for S, sgn in (('L', 1), ('R', -1)):
        Dh = hand_rot[S]                                  # giro de la mano respecto a su reposo, en el mundo
        grip = bar + Vector((sgn * half_width, 0, 0))
        setM(f'HAND_IK.{S}', Dh @ rest_rot(f'HAND_IK.{S}'), grip - Dh @ socket(S))
        sh = pb[f'DEF-ARM01.{S}'].head.copy()
        setM(f'ARM-POLE-IK.{S}', rest_rot(f'ARM-POLE-IK.{S}'), sh + Vector(pole_dir) * 0.5 + Vector((sgn * 0.15, 0, 0)))
        fist(S, curl)
    upd()


def place_hand(S, wrist, hand_rot, pole_dir, curl=CURL):
    """Una mano suelta (sin barra): la muñeca en `wrist` (mundo) con el giro `hand_rot` respecto a su reposo; codo hacia pole_dir."""
    sgn = 1 if S == 'L' else -1
    setM(f'HAND_IK.{S}', hand_rot @ rest_rot(f'HAND_IK.{S}'), wrist)
    sh = pb[f'DEF-ARM01.{S}'].head.copy()
    setM(f'ARM-POLE-IK.{S}', rest_rot(f'ARM-POLE-IK.{S}'), sh + Vector(pole_dir) * 0.5 + Vector((sgn * 0.15, 0, 0)))
    fist(S, curl)


def place_foot(S, f, z, x, pitch_deg=0.0, toe_out_deg=0.0, knee=None):
    """Un tobillo en (f, z, x) con el pie girado `pitch_deg` alrededor del eje lateral (+ = punta abajo) y `toe_out_deg` hacia
    fuera; knee = (f, z, x) adonde apunta la rodilla (el polo del IK), si no la del rig."""
    sgn = 1 if S == 'L' else -1
    Df = Matrix.Rotation(math.radians(sgn * toe_out_deg), 3, 'Z') @ Matrix.Rotation(math.radians(pitch_deg), 3, 'X')
    fik = f'FOOT-IK.{S}'
    setM(fik, Df @ rest_rot(fik), W(f, z, x) + Df @ (H(fik) - H(f'DEF-FOOT.{S}')))
    if knee: setM(f'IK-POLE-LEG.{S}', rest_rot(f'IK-POLE-LEG.{S}'), W(*knee))


def scapulae(down_deg):
    """Escápulas: + = bajarlas (depresión), − = subirlas. Gira el control SHOULDER alrededor de su raíz (15° ≈ 3 cm el hombro)."""
    for S, sgn in (('L', 1), ('R', -1)):
        M = pb[f'SHOULDER.{S}'].matrix.copy()
        setM(f'SHOULDER.{S}', Matrix.Rotation(math.radians(sgn * down_deg), 3, 'Y') @ M.to_3x3(), M.translation)


TOE = Vector((0, -0.194, -0.056))                  # tobillo -> punta del pie en reposo (cola de DEF-TOE)


BAR_IN_HANDS = {'deadlift': 1, 'romanian_deadlift': 1, 'barbell_row': 1, 'cable_row': 1, 'cable_row_one_arm': 0}                      # acciones con la barra en las manos; el resto, en el control BARRA


def setup_bar_in_hands():
    """Barra visible (`BARRA_FINAL`) separada del control (`BARRA`). Idempotente.
    - BARRA (control) sigue siendo el padre de las manos (ARM_IK_parent = 5): moverla mueve las manos.
    - BARRA_FINAL es la que se ve y la que exporta export.py: copia a BARRA y, si PROPERTIES["BARRA_EN_MANOS"] = 1, se coloca
      entre los dos puños (FF_PUNO.L/R, hijos de DEF-HAND en el hueco del puño cerrado) y apunta de uno a otro. Así la barra va
      siempre con las manos, aunque el brazo no llegue al control. Sin ciclo: nada depende de BARRA_FINAL salvo las mallas."""
    P = pb['PROPERTIES']
    if 'BARRA_EN_MANOS' not in P:
        P['BARRA_EN_MANOS'] = 0
        P.id_properties_ui('BARRA_EN_MANOS').update(min=0, max=1, description='1 = la barra visible va entre los puños')
    if 'BARRA_FINAL' not in ab:
        sock = {S: socket(S) for S in 'LR'}
        for ob in vl.objects: ob.select_set(False)
        vl.objects.active = rig; rig.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT'); eb = rig.data.edit_bones
        for S in 'LR':
            b = eb.new(f'FF_PUNO.{S}'); b.head = H(f'DEF-HAND.{S}') + sock[S]; b.tail = b.head + Vector((0, 0, -0.04))
            b.parent = eb[f'DEF-HAND.{S}']; b.use_deform = False
        src = eb['BARRA']; b = eb.new('BARRA_FINAL'); b.head = src.head.copy(); b.tail = src.tail.copy(); b.roll = src.roll
        b.parent = eb['ROOT']; b.use_deform = False
        bpy.ops.object.mode_set(mode='POSE')
        for n in ('FF_PUNO.L', 'FF_PUNO.R', 'BARRA_FINAL'): rig.data.bones[n].hide = True
        pf = pb['BARRA_FINAL']; pf.rotation_mode = 'QUATERNION'
        c = pf.constraints.new('COPY_TRANSFORMS'); c.name = 'FF_control'; c.target = rig; c.subtarget = 'BARRA'
        for name, typ, sub, k in (('FF_puno_L', 'COPY_LOCATION', 'FF_PUNO.L', '1'), ('FF_puno_R', 'COPY_LOCATION', 'FF_PUNO.R', '0.5'),
                                  ('FF_eje', 'DAMPED_TRACK', 'FF_PUNO.L', '1')):
            c = pf.constraints.new(typ); c.name = name; c.target = rig; c.subtarget = sub
            if typ == 'DAMPED_TRACK': c.track_axis = 'TRACK_Y'           # el eje Y del hueso es el de la barra
            d = c.driver_add('influence').driver; d.type = 'SCRIPTED'; d.expression = f'{k} * p'
            v = d.variables.new(); v.name = 'p'; v.targets[0].id = rig; v.targets[0].data_path = 'pose.bones["PROPERTIES"]["BARRA_EN_MANOS"]'
        for ob in bpy.data.objects:      # la barra y los discos cuelgan de la barra visible (mismo reposo: misma inversa del padre)
            if ob.parent == rig and ob.parent_bone == 'BARRA': ob.parent_bone = 'BARRA_FINAL'
        print('  BARRA_FINAL y puños creados')
    for act in bpy.data.actions:                                          # keyar la propiedad en todas las acciones (si no, se colaría)
        if act.name.startswith(('00', '_')) or not act.layers: continue
        path = 'pose.bones["PROPERTIES"]["BARRA_EN_MANOS"]'
        if path in keyed_paths(act): continue
        rig.animation_data.action = act; P['BARRA_EN_MANOS'] = BAR_IN_HANDS.get(act.name, 0)
        for f in FRAMES: P.keyframe_insert('["BARRA_EN_MANOS"]', frame=f)
        finish(act); print(f'  {act.name}: BARRA_EN_MANOS = {P["BARRA_EN_MANOS"]}')
    upd()


def hang_bar(bar_f, half_width, hand_rot, slack=0.995):
    """Altura de la barra para que cuelgue de los hombros ACTUALES con el brazo casi recto: la muñeca (no el puño) a
    `slack` × su alcance. El puño queda por debajo de la línea de la muñeca, así que no basta con hombro->puño."""
    sh = pb['DEF-ARM01.L'].head.copy(); reach = (H('DEF-HAND.L') - H('DEF-ARM01.L')).length * slack
    gap = lambda z: (W(bar_f, z) + Vector((half_width, 0, 0)) - hand_rot['L'] @ socket('L') - sh).length - reach
    lo, hi = sh.z - 2 * reach, sh.z                  # lejos (gap > 0) … a la altura del hombro (gap < 0)
    for _ in range(50):
        m = (lo + hi) / 2
        if gap(m) > 0: lo = m
        else: hi = m
    return (lo + hi) / 2


def new_action(name, base, label):
    rig.animation_data_create()
    act = bpy.data.actions.get(name)
    if act: bpy.data.actions.remove(act)
    act = bpy.data.actions.new(name); act.use_fake_user = True
    act['ff_base'] = base; act['ff_name'] = label
    rig.animation_data.action = act
    return act


MANO = 'mano.'   # prefijo de las manos de la biblioteca (pose assets, spec X03 §11): mano.<id>
HAND_RE = re.compile(r'FINGER|THUMB|PALM')   # huesos de la mano que guarda una pose de mano (no la muñeca ni el brazo)


def trim_hand(act):
    """Deja en una acción de mano solo los canales de dedos, palmas y pulgar (los dos lados): así, como pose de la
    biblioteca, aplicarla no mueve nada más del rig."""
    for l in act.layers:
        for st in l.strips:
            for sl in act.slots:
                cb = st.channelbag(sl)
                if not cb: continue
                for fc in [f for f in cb.fcurves if not (f.data_path.startswith('pose.bones["') and HAND_RE.search(f.data_path.split('"')[1]))]:
                    cb.fcurves.remove(fc)


def channels(p): return('location', 'rotation_quaternion' if p.rotation_mode == 'QUATERNION' else 'rotation_euler', 'scale')
def prop_names(): P = pb['PROPERTIES']; return [k for k in P.keys() if isinstance(P[k], (int, float))]


def key(frame, only_missing=False, act=None):
    """Keya TODOS los canales del rig y todas las propiedades de PROPERTIES: la acción no depende de ninguna otra.
    only_missing: solo los canales que la acción aún no tiene (para sellar acciones antiguas)."""
    have = keyed_paths(act) if only_missing else set()
    for p in pb:
        for path in channels(p):
            if f'pose.bones["{p.name}"].{path}' not in have: p.keyframe_insert(path, frame=frame)
    for pr in prop_names():
        if f'pose.bones["PROPERTIES"]["{pr}"]' not in have: pb['PROPERTIES'].keyframe_insert(f'["{pr}"]', frame=frame)


def keyed_paths(act):
    out = set()
    for layer in act.layers:
        for strip in layer.strips:
            for slot in act.slots:
                cb = strip.channelbag(slot)
                if cb: out |= {fc.data_path for fc in cb.fcurves}
    return out


def seal(order):
    """Las acciones antiguas solo keyan algunos controles; el resto se quedaba con lo que dejó la acción anterior, así que la
    pose dependía del orden. Reproduce el orden en que se exportaban (`order`, empezando tras la última en el frame 30) y
    keya en cada una lo que le faltaba con el valor que heredaba. Después la exportación es igual, pero ya no depende del orden."""
    sc = bpy.context.scene
    rig.animation_data.action = bpy.data.actions[order[-1]]; sc.frame_set(FRAMES[-1])
    for name in order:
        act = bpy.data.actions[name]; rig.animation_data.action = act
        missing_before = keyed_paths(act)
        sc.frame_set(FRAMES[0]); key(FRAMES[0], only_missing=True, act=act)
        # en el frame final, las mismas que se añadieron en el inicial (constantes: el valor heredado no cambia)
        added = keyed_paths(act) - missing_before
        sc.frame_set(FRAMES[-1])
        for p in pb:
            for path in channels(p):
                if f'pose.bones["{p.name}"].{path}' in added: p.keyframe_insert(path, frame=FRAMES[-1])
        for pr in prop_names():
            if f'pose.bones["PROPERTIES"]["{pr}"]' in added: pb['PROPERTIES'].keyframe_insert(f'["{pr}"]', frame=FRAMES[-1])
        finish(act)
        print(f'  {name}: {len(added)} canales sellados')


def finish(act):
    """Las propiedades discretas (padres de IK, IK/FK) no se interpolan."""
    for layer in act.layers:
        for strip in layer.strips:
            for slot in act.slots:
                cb = strip.channelbag(slot)
                if cb:
                    for fc in cb.fcurves:
                        if 'PROPERTIES' in fc.data_path:
                            for kp in fc.keyframe_points: kp.interpolation = 'CONSTANT'


def params(ex, act=None):
    """Valores de los ajustes de un ejercicio: los guardados en su acción (`ff_params`) o, si no hay, los de PARAMS."""
    p = {k: v[0] for k, v in ex.PARAMS.items()}
    if act and 'ff_params' in act: p.update({k: v for k, v in json.loads(act['ff_params']).items() if k in p})
    return p


def run(ex, p=None, live=False):
    """Posa el ejercicio `ex` (META, PARAMS, frames(F, p) -> [(frame, posar)]) y deja sus claves en su acción.
    Completo: crea la acción de cero y keya todo el rig.  En vivo (deslizadores): solo reescribe las claves de lo que mueve
    la pose, con la acción desconectada mientras posa (para que la animación no pise lo colocado) y sin deformar la malla."""
    name, base, label = ex.META
    act = bpy.data.actions.get(name)
    p = p or params(ex, act)
    keys = ex.frames(sys.modules[__name__], p)
    if live and act and act.layers:
        _live(act, keys)
    else:
        act = new_action(name, base, label)
        for f, posar in keys:
            reset(); posar(); report(f'frame {f}'); key(f)
        finish(act)
    act['ff_params'] = json.dumps(p)
    if hasattr(ex, 'setup'): ex.setup(sys.modules[__name__], act, p)   # datos propios de la acción (p. ej. la polea del remo en polea)
    return act


def _live(act, keys):
    body = bpy.data.objects['Mannequin']; mods = [m for m in body.modifiers if m.show_viewport]
    for m in mods: m.show_viewport = False
    rig.animation_data.action = None
    vals = []
    try:
        for f, posar in keys:
            touched.clear(); reset(); posar()
            for n in touched:
                b = pb[n]
                if n == 'PROPERTIES':
                    vals += [(f'pose.bones["PROPERTIES"]["{k}"]', 0, f, float(b[k])) for k in prop_names()]
                else:
                    for path in channels(b): vals += [(f'pose.bones["{n}"].{path}', i, f, v) for i, v in enumerate(getattr(b, path))]
    finally:
        rig.animation_data.action = act
        for m in mods: m.show_viewport = True
    cb = act.layers[0].strips[0].channelbag(act.slots[0])
    for path, i, f, v in vals:
        fc = cb.fcurves.find(path, index=i)
        if fc: fc.keyframe_points.insert(f, v, options={'REPLACE', 'FAST'})
    for fc in cb.fcurves: fc.update()
    sc = bpy.context.scene; sc.frame_set(sc.frame_current)


def report(label):
    """Comprobación tras posar: cada mano llega a su objetivo (si no, el brazo es corto para esa pose)."""
    upd()
    hands = [(pb[f'DEF-HAND.{S}'].head - pb[f'HAND_IK.{S}'].head).length for S in 'LR']
    msg = f'  {label}: mano->objetivo {max(hands) * 1000:.1f} mm'
    if 'BARRA' in touched and pb['BARRA'].scale.x > 0.5:
        bar = pb['BARRA'].matrix.translation
        gap = max(((sum((pb[f'DEF-FINGER-{d}-0{i}.{S}'].head for d in 'BC' for i in (1, 2, 3)), Vector())
                    + sum((pb[f'DEF-FINGER-{d}-03.{S}'].tail for d in 'BC'), Vector())) / 8 - bar).yz.length for S in 'LR')
        msg += f' · puño->barra {gap * 1000:.1f} mm'
    print(msg)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:]
    if args[2] == 'sellar':
        seal(args[3].split(','))
    elif args[2] == 'munecas':
        rigid_wrists()
    elif args[2] == 'barra-manos':
        setup_bar_in_hands()
    elif args[2] == 'banco':
        setup_bench()
    elif args[2] == 'discos':
        setup_discs()
    bpy.ops.wm.save_as_mainfile(filepath=args[1]); print('SAVED', args[1])
