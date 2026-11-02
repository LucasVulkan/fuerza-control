"""Extrae de tu archivo CC las poses como DIRECCIONES de segmentos y relaciones mano/barra/tronco (independientes de proporciones)."""
import bpy, sys, json, math
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]   # vale con 'blender -b --python x.py -- ...' y con bpy de pip
from mathutils import Vector, Matrix
bpy.ops.wm.open_mainfile(filepath=ARGV[0]); out = ARGV[1]
sc = bpy.data.scenes['Scene.002']; bpy.context.window.scene = sc
a = bpy.data.objects['Armature']; pb = a.pose.bones; ab = a.data.bones
M = lambda n: pb[n].matrix                       # espacio armature (cm)
P = lambda n: pb[n].head * 0.01                  # metros
def delta(n): return (M(n).to_3x3() @ ab[n].matrix_local.to_3x3().inverted())
def rows(m): return [list(r) for r in m]
H0 = 1.825
data = {}
for act in ('back_squat', 'front_squat', 'leg_press'):
    a.animation_data.action = bpy.data.actions[act]; data[act] = {}
    for f in (1, 30):
        sc.frame_set(f); sc.frame_set(f)
        Rt = delta('spine_03')
        hipL, hipR = P('thigh_l'), P('thigh_r'); hip = (hipL + hipR) / 2
        shL, shR = P('upperarm_l'), P('upperarm_r'); sh = (shL + shR) / 2
        d = dict(
            trunk_delta=rows(Rt), pelvis_delta=rows(delta('pelvis')), neck_delta_rel=rows(Rt.inverted() @ delta('neck_01')),
            hip=list(hip), sh=list(sh), H0=H0,
            trunk_dir=list((sh - hip).normalized()),
        )
        for S in 'lr':
            hp, kn, an = P(f'thigh_{S}'), P(f'calf_{S}'), P(f'foot_{S}')
            el, wr = P(f'lowerarm_{S}'), P(f'hand_{S}'); s_ = P(f'upperarm_{S}')
            d[S] = dict(
                ankle=list(an), thigh_dir=list((kn - hp).normalized()), shin_dir=list((an - kn).normalized()),
                foot_delta=rows(delta(f'foot_{S}')),
                hand_delta=rows(delta(f'hand_{S}')), wrist=list(wr),
                elbow_dir=list((el - s_).normalized()), shoulder=list(s_),
            )
        bar_scale = pb['CTRL_bar'].scale.x
        d['bar'] = list(P('CTRL_bar')) if bar_scale > 0.5 else None
        if pb['CTRL_machine'].scale.x > 0.5:
            d['machine'] = list(P('CTRL_machine')); d['machine_rot'] = rows(M('CTRL_machine').to_3x3())
            d['plate'] = list(P('CTRL_plate')); d['plate_rot'] = rows(M('CTRL_plate').to_3x3())
        else: d['machine'] = None
        data[act][f] = d
json.dump(data, open(out, 'w'), indent=1); print('OK', out)
