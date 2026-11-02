"""Reconstruye las poses sobre el rig del maniquí a partir de direcciones de segmentos (cc_poses.json)."""
import bpy, sys, json, math
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]   # vale con 'blender -b --python x.py -- ...' y con bpy de pip
from mathutils import Vector, Matrix, Quaternion
src, poses_path, out = ARGV[0], ARGV[1], ARGV[2]
bpy.ops.wm.open_mainfile(filepath=src)
sc = bpy.context.scene; vl = bpy.context.view_layer
o = bpy.data.objects['Armature_Mannequin']; arm = o.data; pb = o.pose.bones; ab = arm.bones
D = json.load(open(poses_path))
V = lambda l: Vector(l)
M3 = lambda rows: Matrix(rows)
def upd(): vl.update(); vl.update()

# ---- medidas del maniquí (reposo)
H = lambda n: ab[n].head_local.copy()
hipL, hipR = H('DEF-THIGH01.L'), H('DEF-THIGH01.R'); hipMid = (hipL + hipR) / 2
Lt = (H('DEF-SHIN01.L') - hipL).length; Ls = (H('DEF-FOOT.L') - H('DEF-SHIN01.L')).length
shL, shR = H('DEF-ARM01.L'), H('DEF-ARM01.R'); shMid = (shL + shR) / 2
ankleH = H('DEF-FOOT.L').z
Pv = ab['TORSO'].head_local.copy()
def ang(v): return math.atan2(-v.y, v.z)          # inclinación hacia delante (-Y) en el plano sagital
rest_trunk_m = ang(shMid - hipMid)
rest_trunk_cc = math.atan2(-0.06, 0.516)          # línea cadera-hombro del modelo CC en reposo
k = 1.80 / 1.825
hand_k = (H('DEF-FINGER-B-01.L') - H('DEF-HAND.L')).length / 0.094   # mano del maniquí vs CC
print(f'maniquí: muslo {Lt:.3f} tibia {Ls:.3f} tronco {(shMid-hipMid).length:.3f} | escala mano {hand_k:.2f}')

def setM(name, rot3, pos):
    m = rot3.to_4x4(); m.translation = pos; pb[name].matrix = m; upd()
def rest_rot(name): return ab[name].matrix_local.to_3x3()
CONTROLS = ['TORSO', 'NECK', 'HEAD', 'FOOT-IK.L', 'FOOT-IK.R', 'HAND_IK.L', 'HAND_IK.R', 'ARM-POLE-IK.L', 'ARM-POLE-IK.R',
            'FINGER-MASTER.L', 'FINGER-MASTER.R', 'FINGER-ROT-MASTER.L', 'FINGER-ROT-MASTER.R', 'THUMB.L', 'THUMB.R',
            'BARRA', 'MAQUINA', 'PLATAFORMA', 'IK-POLE-LEG.L', 'IK-POLE-LEG.R']
PROPS = ['ARM-IK/FK.L', 'ARM-IK/FK.R', 'LEG-IK/FK.L', 'LEG-IK/FK.R', 'ARM_IK_parent.L', 'ARM_IK_parent.R', 'FOOT-IK-PARENT.L', 'FOOT-IK-PARENT.R']

def reset():
    for p in pb:
        p.location = (0, 0, 0); p.scale = (1, 1, 1); p.rotation_quaternion = (1, 0, 0, 0); p.rotation_euler = (0, 0, 0)
    upd()

def pose(ex, d):
    reset()
    P = pb['PROPERTIES']; seat = d['machine'] is not None
    for S in 'LR':
        P[f'ARM-IK/FK.{S}'] = 0; P[f'LEG-IK/FK.{S}'] = 0
        P[f'ARM_IK_parent.{S}'] = 0 if seat else 5
        P[f'FOOT-IK-PARENT.{S}'] = 2 if seat else 0
    o.update_tag(); upd()
    # props
    if seat:
        pb['BARRA'].scale = (0.001,) * 3
        setM('MAQUINA', M3(d['machine_rot']), V(d['machine']))
    else:
        pb['MAQUINA'].scale = (0.001,) * 3
        upd()
    # tronco: misma inclinación absoluta que tu pose
    user_trunk = ang(V(d['trunk_dir']))
    R = Matrix.Rotation(user_trunk - rest_trunk_m, 3, 'X')
    # piernas: direcciones de tus segmentos con las longitudes del maniquí
    sides = {'L': ('l', hipL), 'R': ('r', hipR)}
    if not seat:
        ank = {S: V((d[s]['ankle'][0], d[s]['ankle'][1], ankleH)) for S, (s, _) in sides.items()}
        hips = {S: ank[S] - Ls * V(d[s]['shin_dir']) - Lt * V(d[s]['thigh_dir']) for S, (s, _) in sides.items()}
        hip_t = (hips['L'] + hips['R']) / 2
    else:
        hip_t = V(d['hip'])
        ank = {S: hip_t + R @ (h - hipMid) + Lt * V(d[s]['thigh_dir']) + Ls * V(d[s]['shin_dir']) for S, (s, h) in sides.items()}
    setM('TORSO', R @ rest_rot('TORSO'), hip_t - R @ (hipMid - Pv))
    # cuello: tu corrección relativa al tronco
    nq = M3(d['neck_delta_rel']).to_quaternion()
    pb['NECK'].rotation_quaternion = Quaternion(Vector((1, 0, 0)), nq.to_euler().x)  # solo cabeceo, sin giros laterales
    upd()
    # pies
    if seat:
        pl_user = V(d['plate']); am_user = (V(d['l']['ankle']) + V(d['r']['ankle'])) / 2; am = (ank['L'] + ank['R']) / 2
        setM('PLATAFORMA', M3(d['plate_rot']), am + (pl_user - am_user))
    for S, (s, _) in sides.items():
        Df = M3(d[s]['foot_delta'])
        fik = f'FOOT-IK.{S}'; a0 = H(f'DEF-FOOT.{S}')
        setM(fik, Df @ rest_rot(fik), ank[S] + Df @ (H(fik) - a0))
    # barra y manos
    S_now = {S: hip_t + R @ (H(f'DEF-ARM01.{S}') - hipMid) for S in 'LR'}
    sh_m = (S_now['L'] + S_now['R']) / 2
    if not seat:
        bar = sh_m + (V(d['bar']) - V(d['sh'])) * k
        setM('BARRA', rest_rot('BARRA'), bar)
    for S, (s, _) in sides.items():
        Dh = M3(d[s]['hand_delta'])
        # punto de agarre del maniquí (centro del puño) en reposo, relativo a la muñeca
        w0 = H(f'DEF-HAND.{S}'); b1 = H(f'DEF-FINGER-B-01.{S}'); b2 = H(f'DEF-FINGER-B-02.{S}')
        sock = b1.lerp(b2, 0.3) + Vector((0, 0, -1)) * (0.014 + 0.012) - w0
        if not seat:
            d1 = D[ex]['1']   # misma anchura de agarre en inicio y final (la mano no se desliza)
            grip_user = V(d1[s]['wrist']) + M3(d1[s]['hand_delta']) @ (sock / hand_k)
            grip = bar + Vector((grip_user.x - V(d1['bar']).x, 0, 0)) * k   # siempre sobre el eje de la barra
            wrist = grip - Dh @ sock
        else: wrist = V(d[s]['wrist'])
        setM(f'HAND_IK.{S}', Dh @ rest_rot(f'HAND_IK.{S}'), wrist)
        pole = S_now[S] + V(d[s]['elbow_dir']) * 0.5
        setM(f'ARM-POLE-IK.{S}', rest_rot(f'ARM-POLE-IK.{S}'), pole)
    # agarre
    rack = ex == 'front_squat'
    for S in 'LR':
        pb[f'FINGER-MASTER.{S}'].rotation_euler.x = math.radians(-35 if rack else -75)
        pb[f'FINGER-ROT-MASTER.{S}'].rotation_euler.x = math.radians(-25 if rack else -70)
    upd()

def key(frame):
    for n in CONTROLS:
        p = pb[n]
        for path in ('location', 'rotation_quaternion' if p.rotation_mode == 'QUATERNION' else 'rotation_euler', 'scale'):
            p.keyframe_insert(path, frame=frame)
    for pr in PROPS: pb['PROPERTIES'].keyframe_insert(f'["{pr}"]', frame=frame)

o.animation_data_create()
for ex in ('back_squat', 'front_squat', 'leg_press'):
    act = bpy.data.actions.get(ex) or bpy.data.actions.new(ex); act.use_fake_user = True
    o.animation_data.action = act
    for f in ('1', '30'):
        pose(ex, D[ex][f]); key(int(f))
    # las propiedades discretas no se interpolan
    for layer in act.layers:
        for strip in layer.strips:
            for slot in act.slots:
                cb = strip.channelbag(slot)
                if cb:
                    for fc in cb.fcurves:
                        if 'PROPERTIES' in fc.data_path:
                            for kp in fc.keyframe_points: kp.interpolation = 'CONSTANT'
o.animation_data.action = bpy.data.actions['back_squat']
sc.frame_start, sc.frame_end = 1, 30; sc.frame_set(30)
bpy.ops.wm.save_as_mainfile(filepath=out); print('SAVED')
