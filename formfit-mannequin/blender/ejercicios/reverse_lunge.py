"""Zancada atrás con mancuernas (ola 3): acción `reverse_lunge`, en `libre` (base prevista: `split`).
Frame 1: de pie, mancuernas a los lados; frame 30: abajo, el pie derecho atrás apoyado en la punta, la rodilla de atrás cerca
del suelo y la de delante sobre el pie, el tronco algo inclinado.

  blender -b --factory-startup --python blender/ejercicios/reverse_lunge.py -- entrada.blend salida.blend
Es una base: pie de atrás, rodillas, tronco y brazos se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('reverse_lunge', 'libre', 'Zancada atrás')
DEG = math.pi / 180
PARAMS = {
    'STANCE_X':   (0.10, 0.06, 0.18, 'Tobillos, media anchura (m)'),
    'STEP':       (0.85, 0.65, 1.05, 'Paso atrás: tobillo de atrás (m)'),
    'BACK_PITCH': (50.0, 30.0, 70.0, 'Pie de atrás de puntillas (°)'),
    'HIP_LOW':    (0.55, 0.45, 0.70, 'Abajo: altura de la cadera (m)'),
    'HIP_LOW_F':  (-0.36, -0.50, -0.20, 'Abajo: cadera respecto al tobillo de delante (m)'),
    'TRUNK_LOW':  (10.0, 0.0, 25.0, 'Abajo: tronco (°)'),
}


def frames(F, p):
    NEU = {'L': Matrix.Rotation(90 * DEG, 3, 'Z') @ F.HANG_PRONE['L'], 'R': Matrix.Rotation(-90 * DEG, 3, 'Z') @ F.HANG_PRONE['R']}
    R = (F.H('DEF-HAND.L') - F.H('DEF-ARM01.L')).length * 0.98
    Rf = Matrix.Rotation(p['BACK_PITCH'] * DEG, 3, 'X')
    back_z = 0.012 - (Rf @ F.TOE).z

    def pose(low):
        hip = Vector((p['HIP_LOW_F'], p['HIP_LOW'])) if low else Vector((0.0, F.ankleH + (F.Lt + F.Ls) * 0.995))
        phi = p['TRUNK_LOW'] * DEG if low else F.trunk_rest

        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_foot('L', 0.0, F.ankleH, p['STANCE_X'], 0, 5, knee=(0.6, 0.6, p['STANCE_X']))
            if low: F.place_foot('R', -p['STEP'], back_z, -p['STANCE_X'], p['BACK_PITCH'], 0, knee=(-0.2, -0.4, -p['STANCE_X']))
            else: F.place_foot('R', 0.0, F.ankleH, -p['STANCE_X'], 0, 5, knee=(0.6, 0.6, -p['STANCE_X']))
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                sh = F.pb[f'DEF-ARM01.{S}'].head.copy()
                F.place_hand(S, sh + Vector((sgn * 0.04, -0.03, -R)), NEU[S], pole_dir=(0, 1, 0))
        return posar
    return [(1, pose(False)), (30, pose(True))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = '28'; act['ff_plan'] = 'split'
    act['ff_apoyos'] = 'pie.L;pie.R'; act['ff_carga'] = 'manos'; act['ff_carga_pc'] = 30


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
