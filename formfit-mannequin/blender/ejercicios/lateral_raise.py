"""Elevaciones laterales con mancuernas (ola 2): acción `lateral_raise`, en `libre` (base prevista: `stand`).
De pie. Frame 1: mancuernas a los lados, un poco por delante de los muslos, palmas hacia el cuerpo; frame 30: brazos
abiertos hasta `RAISE` grados, codos algo flexionados, palmas hacia abajo, en el plano de la escápula (algo por delante).

  blender -b --factory-startup --python blender/ejercicios/lateral_raise.py -- entrada.blend salida.blend
Es una base: codos, muñecas y trapecio se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('lateral_raise', 'libre', 'Elevaciones laterales')
DEG = math.pi / 180
PARAMS = {
    'STANCE_X':   (0.12, 0.08, 0.25, 'Tobillos, media anchura (m)'),
    'RAISE':      (85.0, 60.0, 100.0, 'Arriba: brazo separado del costado (°)'),
    'SCAP_PLANE': (20.0, 0.0, 35.0, 'Arriba: brazo por delante del plano lateral (°)'),
    'BEND':       (0.96, 0.90, 0.99, 'Brazo: alcance hombro-muñeca (fracción, codo algo flexionado)'),
}


def frames(F, p):
    NEU = {'L': Matrix.Rotation(90 * DEG, 3, 'Z') @ F.HANG_PRONE['L'], 'R': Matrix.Rotation(-90 * DEG, 3, 'Z') @ F.HANG_PRONE['R']}
    phi = F.trunk_rest
    hip = Vector((0.0, F.ankleH + (F.Lt + F.Ls) * 0.995))
    R = (F.H('DEF-HAND.L') - F.H('DEF-ARM01.L')).length * p['BEND']
    a, b = p['RAISE'] * DEG, p['SCAP_PLANE'] * DEG

    def pose(up):
        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_feet(p['STANCE_X'], 5)
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                sh = F.pb[f'DEF-ARM01.{S}'].head.copy()
                if up:   # brazo a `a` del costado, girado `b` hacia delante; la mano en su reposo (palma abajo) girada con él
                    dirv = Vector((sgn * math.sin(a) * math.cos(b), -math.sin(a) * math.sin(b), -math.cos(a)))
                    F.place_hand(S, sh + dirv * R, Matrix.Rotation(-sgn * b, 3, 'Z'), pole_dir=(0, 1, 0.3))
                else:
                    F.place_hand(S, sh + Vector((sgn * 0.03, -0.06, -R)), NEU[S], pole_dir=(0, 1, 0))
        return posar
    return [(1, pose(False)), (30, pose(True))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = '28'; act['ff_plan'] = 'stand'
    act['ff_apoyos'] = 'pie.L+pie.R'; act['ff_carga'] = 'manos'; act['ff_carga_pc'] = 15


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
