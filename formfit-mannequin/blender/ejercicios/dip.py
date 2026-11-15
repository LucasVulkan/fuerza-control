"""Fondos en paralelas (ola 3): acción `dip`, en `libre` (base prevista: `hang`, apoyado en las manos).
Las manos quietas sobre las paralelas (barras de delante a atrás, a `BAR_Z`), rodillas flexionadas y pies cruzados atrás.
Frame 1: arriba, brazos rectos; frame 30: abajo, hombros a la altura de los codos, tronco algo inclinado. Las paralelas
no se ven todavía (llegan con su base).

  blender -b --factory-startup --python blender/ejercicios/dip.py -- entrada.blend salida.blend
Es una base: hombros, escápulas, piernas y manos se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('dip', 'libre', 'Fondos en paralelas')
DEG = math.pi / 180
PARAMS = {
    'BAR_Z':      (1.35, 1.20, 1.50, 'Paralelas, altura (m)'),
    'BAR_X':      (0.26, 0.20, 0.32, 'Paralelas, media separación (m)'),
    'TRUNK_TOP':  (8.0, 0.0, 20.0, 'Arriba: tronco (°)'),
    'TRUNK_LOW':  (25.0, 5.0, 40.0, 'Abajo: tronco (°)'),
    'SH_LOW':     (0.06, -0.02, 0.15, 'Abajo: hombros sobre las paralelas (m)'),
    'SH_LOW_F':   (-0.10, -0.20, 0.0, 'Abajo: hombros respecto a las manos (m; − = detrás)'),
}


def frames(F, p):
    F.socket('L')
    R = (F.H('DEF-HAND.L') - F.H('DEF-ARM01.L')).length * 0.99
    grip = {S: F.W(0.0, p['BAR_Z'], sgn * p['BAR_X']) for S, sgn in (('L', 1), ('R', -1))}
    wrist = {S: grip[S] - F.socket(S) for S in 'LR'}               # mano en su reposo: la barra cruza la palma bajo los dedos
    dx = p['BAR_X'] - F.H('DEF-ARM01.L').x
    top = Vector((0.02, wrist['L'].z + math.sqrt(max(1e-6, R ** 2 - dx ** 2))))

    def pose(sh, phi):
        d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
        hip = sh - Vector((-d.y, d.z))
        knee = hip + F.Lt * Vector((math.sin(-10 * DEG), -math.cos(10 * DEG)))
        ank = knee + Vector((-F.Ls * 0.95, 0.0))

        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                F.place_foot(S, ank.x, ank.y, sgn * 0.05, 90, 0, knee=(knee.x + 0.5, knee.y, sgn * 0.12))
                F.place_hand(S, wrist[S], Matrix.Identity(3), pole_dir=(sgn * 0.3, 1, 0))
        print(f'fondos: hombros f {sh.x:.2f} z {sh.y:.2f} · pies z {ank.y:.2f}')
        return posar
    return [(1, pose(top, p['TRUNK_TOP'] * DEG)), (30, pose(Vector((p['SH_LOW_F'], p['BAR_Z'] + p['SH_LOW'])), p['TRUNK_LOW'] * DEG))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'barra_press'; act['ff_plan'] = 'hang'
    act['ff_apoyos'] = 'mano.L+mano.R'; act['ff_carga'] = 'ninguna'; act['ff_carga_pc'] = 0


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
