"""Herramientas para posar ejercicios por script sobre el rig del maniquí (Blender 4.4+ / 5.x).

Se importa desde los scripts de `blender/ejercicios/`. Da:
  - medidas del maniquí en reposo (muslo, tibia, tronco, brazo hasta el puño…);
  - colocar tronco, pies, barra y manos con posiciones del mundo (Z arriba, -Y delante);
  - crear la acción con sus metadatos y keyar inicio (frame 1) y final (frame 30), sin que se cuelen
    valores de otras acciones (se keyan todos los controles, también los que se quedan en reposo).
Coordenadas sagitales: f = hacia delante (= -Y), z = arriba.
"""
import bpy, sys, math
from mathutils import Vector, Matrix

if __name__ == '__main__':      # blender -b --factory-startup --python blender/ffpose.py -- entrada.blend salida.blend sellar a,b,c
    bpy.ops.wm.open_mainfile(filepath=sys.argv[sys.argv.index('--') + 1])

rig =bpy.data.objects['Armature_Mannequin']; pb = rig.pose.bones; ab = rig.data.bones
vl = bpy.context.view_layer
FRAMES = (1, 30)
PLATE_R = 0.225                                     # radio del disco de 20 kg: la barra en el suelo tiene el centro a esta altura


def upd(): vl.update(); vl.update()
def H(n): return ab[n].head_local.copy()
def rest_rot(n): return ab[n].matrix_local.to_3x3()
def W(f, z, x=0.0): return Vector((x, -f, z))           # sagital -> mundo de Blender
def sagittal(v): return v.y * -1, v.z                    # mundo -> (f, z)


def setM(name, rot3, pos):
    m = rot3.to_4x4(); m.translation = pos; pb[name].matrix = m; upd()


# ---- medidas en reposo
hipL, hipR = H('DEF-THIGH01.L'), H('DEF-THIGH01.R'); hipMid = (hipL + hipR) / 2
shL, shR = H('DEF-ARM01.L'), H('DEF-ARM01.R'); shMid = (shL + shR) / 2
Lt = (H('DEF-SHIN01.L') - hipL).length; Ls = (H('DEF-FOOT.L') - H('DEF-SHIN01.L')).length
ankleH = H('DEF-FOOT.L').z
TORSO_PIVOT = ab['TORSO'].head_local.copy()
trunk_rest = math.atan2(-(shMid - hipMid).y, (shMid - hipMid).z)      # inclinación hacia delante del tronco en reposo


def socket(S):
    """Centro del puño respecto a la muñeca, en reposo (palma hacia abajo)."""
    w0 = H(f'DEF-HAND.{S}'); b1 = H(f'DEF-FINGER-B-01.{S}'); b2 = H(f'DEF-FINGER-B-02.{S}')
    return b1.lerp(b2, 0.3) + Vector((0, 0, -0.026)) - w0


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
    upd()


def set_props(hand_parent, foot_parent):
    """hand_parent: 0 raíz · 5 barra. foot_parent: 0 raíz · 2 plataforma. IK en brazos y piernas."""
    P = pb['PROPERTIES']
    for S in 'LR':
        P[f'ARM-IK/FK.{S}'] = 0; P[f'LEG-IK/FK.{S}'] = 0
        P[f'ARM_IK_parent.{S}'] = hand_parent; P[f'FOOT-IK-PARENT.{S}'] = foot_parent
    rig.update_tag(); upd()


def place_trunk(hip_f, hip_z, phi):
    R = trunk_R(phi)
    setM('TORSO', R @ rest_rot('TORSO'), W(hip_f, hip_z) - R @ (hipMid - TORSO_PIVOT))


def place_feet(ankle_x, toe_out_deg, ankle_f=0.0):
    """Tobillos en (±ankle_x, f, altura de tobillo); puntas giradas hacia fuera."""
    for S, sgn in (('L', 1), ('R', -1)):
        Df = Matrix.Rotation(math.radians(sgn * toe_out_deg), 3, 'Z')
        fik = f'FOOT-IK.{S}'; a = W(ankle_f, ankleH, sgn * ankle_x)
        setM(fik, Df @ rest_rot(fik), a + Df @ (H(fik) - H(f'DEF-FOOT.{S}')))


def hide_machine(): pb['MAQUINA'].scale = (0.001,) * 3; upd()
def hide_bar(): pb['BARRA'].scale = (0.001,) * 3; upd()
def place_bar(f, z): setM('BARRA', rest_rot('BARRA'), W(f, z))


# mano colgando con agarre prono: el eje de la mano (en reposo +X / -X) apunta abajo y la palma mira atrás (+Y, hacia el cuerpo)
HANG_PRONE = {'L': Matrix(((0, 1, 0), (0, 0, -1), (-1, 0, 0))), 'R': Matrix(((0, -1, 0), (0, 0, -1), (1, 0, 0)))}


def grip_bar(bar, half_width, hand_rot, pole_dir, curl=-75):
    """Manos en la barra (centro del puño sobre el eje, a ±half_width), puños cerrados, codos hacia pole_dir."""
    for S, sgn in (('L', 1), ('R', -1)):
        Dh = hand_rot[S]                                  # giro de la mano respecto a su reposo, en el mundo
        grip = bar + Vector((sgn * half_width, 0, 0))
        setM(f'HAND_IK.{S}', Dh @ rest_rot(f'HAND_IK.{S}'), grip - Dh @ socket(S))
        sh = pb[f'DEF-ARM01.{S}'].head.copy()
        setM(f'ARM-POLE-IK.{S}', rest_rot(f'ARM-POLE-IK.{S}'), sh + Vector(pole_dir) * 0.5 + Vector((sgn * 0.15, 0, 0)))
        pb[f'FINGER-MASTER.{S}'].rotation_euler.x = math.radians(curl)
        pb[f'FINGER-ROT-MASTER.{S}'].rotation_euler.x = math.radians(curl + 5)
    upd()


def new_action(name, base, label):
    rig.animation_data_create()
    act = bpy.data.actions.get(name)
    if act: bpy.data.actions.remove(act)
    act = bpy.data.actions.new(name); act.use_fake_user = True
    act['ff_base'] = base; act['ff_name'] = label
    rig.animation_data.action = act
    return act


def channels(p): return ('location', 'rotation_quaternion' if p.rotation_mode == 'QUATERNION' else 'rotation_euler', 'scale')
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


def report(label):
    """Comprobación tras posar: cada mano llega a su objetivo (si no, el brazo es corto para esa pose)."""
    upd()
    hands = [(pb[f'DEF-HAND.{S}'].head - pb[f'HAND_IK.{S}'].head).length for S in 'LR']
    print(f'  {label}: mano->objetivo {max(hands) * 1000:.1f} mm')


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:]
    if args[2] == 'sellar':
        seal(args[3].split(','))
    bpy.ops.wm.save_as_mainfile(filepath=args[1]); print('SAVED', args[1])
