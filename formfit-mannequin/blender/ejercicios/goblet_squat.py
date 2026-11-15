"""Sentadilla goblet (ola 3): acción `goblet_squat`, en `libre` (base prevista: `stand`).
La kettlebell (o mancuerna) se sujeta con las dos manos delante del pecho, palmas enfrentadas. Frame 1: de pie; frame 30:
abajo, la cadera a `HIP_LOW`, el tronco más erguido que en la trasera y los codos entre las rodillas.

  blender -b --factory-startup --python blender/ejercicios/goblet_squat.py -- entrada.blend salida.blend
Es una base: manos (copa), codos, espalda y rodillas se retocan a mano en Blender.
"""
import math
from mathutils import Vector

META = ('goblet_squat', 'libre', 'Sentadilla goblet')
DEG = math.pi / 180
PARAMS = {
    'STANCE_X':   (0.20, 0.12, 0.30, 'Tobillos, media anchura (m)'),
    'TOE_OUT':    (20.0, 0.0, 35.0, 'Puntas hacia fuera (°)'),
    'TRUNK_LOW':  (30.0, 15.0, 45.0, 'Abajo: tronco (°)'),
    'HIP_LOW':    (0.45, 0.35, 0.60, 'Abajo: altura de la cadera (m)'),
    'HIP_LOW_F':  (-0.14, -0.30, 0.0, 'Abajo: cadera respecto al tobillo (m)'),
    'HOLD_F':     (0.16, 0.10, 0.25, 'Manos delante de la línea de hombros (m)'),
    'HOLD_DOWN':  (0.20, 0.10, 0.30, 'Manos bajo los hombros, por el tronco (m)'),
    'HOLD_X':     (0.07, 0.04, 0.12, 'Manos, media anchura (m)'),
}


def frames(F, p):
    top_hip = Vector((0.0, F.ankleH + (F.Lt + F.Ls) * 0.97))      # pies abiertos: la pierna va en diagonal
    low_hip = Vector((p['HIP_LOW_F'], p['HIP_LOW']))

    def pose(hip, phi):
        d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
        sh = hip + Vector((-d.y, d.z))
        u = Vector((math.sin(phi), math.cos(phi))); n = Vector((math.cos(phi), -math.sin(phi)))
        w = sh + n * p['HOLD_F'] - u * p['HOLD_DOWN']
        up = Vector((0, -u.x, u.y))                                 # «arriba» del tronco, en el mundo

        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_feet(p['STANCE_X'], p['TOE_OUT'])
            for S, sgn in (('L', 1), ('R', -1)):
                F.setM(f'IK-POLE-LEG.{S}', F.rest_rot(f'IK-POLE-LEG.{S}'), F.W(0.8, 0.6, sgn * 0.45))
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                F.place_hand(S, F.W(w.x, w.y, sgn * p['HOLD_X']), F.hand_frame(S, up, (-sgn, 0, 0)), pole_dir=(sgn * 0.3, 0, -1), curl=-50)
        return posar
    return [(1, pose(top_hip, 3 * DEG)), (30, pose(low_hip, p['TRUNK_LOW'] * DEG))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'goblet'; act['ff_plan'] = 'stand'
    act['ff_apoyos'] = 'pie.L+pie.R'; act['ff_carga'] = 'manos'; act['ff_carga_pc'] = 25


if __name__ == '__main__':
    import bpy, sys, os, importlib, types
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None
    if argv: bpy.ops.wm.open_mainfile(filepath=argv[0])
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, here if os.path.exists(os.path.join(here, 'ffpose.py')) else os.path.dirname(bpy.data.filepath))
    import ffpose as F
    importlib.reload(F)
    F.run(types.SimpleNamespace(META=META, PARAMS=PARAMS, frames=frames, setup=setup))
    bpy.context.scene.frame_set(30)
    if argv: bpy.ops.wm.save_as_mainfile(filepath=argv[1]); print('SAVED', argv[1])
