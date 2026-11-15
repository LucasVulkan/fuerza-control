"""Face pull en polea con cuerda (ola 3): acción `face_pull`, en `libre` (base prevista: polea de pie).
De pie frente a la polea (a la altura de la cara, `ff_pulley`), algo inclinado hacia atrás. Frame 1: brazos estirados hacia
la polea con los extremos de la cuerda juntos; frame 30: manos junto a las orejas, codos altos y abiertos.

  blender -b --factory-startup --python blender/ejercicios/face_pull.py -- entrada.blend salida.blend
Es una base: codos, muñecas (rotación externa), escápulas y tronco se retocan a mano en Blender.
"""
import math
from mathutils import Vector

META = ('face_pull', 'libre', 'Face pull')
DEG = math.pi / 180
PARAMS = {
    'STANCE_X':   (0.14, 0.08, 0.25, 'Tobillos, media anchura (m)'),
    'TRUNK':      (-6.0, -15.0, 5.0, 'Tronco (°; − = hacia atrás)'),
    'HAND_UP':    (0.10, 0.0, 0.20, 'Manos sobre los hombros (m)'),
    'END_X':      (0.24, 0.16, 0.32, 'Final: manos, media anchura (m)'),
    'END_F':      (0.06, -0.02, 0.12, 'Final: manos por delante de los hombros (m)'),
    'PULLEY_F':   (1.10, 0.80, 1.50, 'Polea por delante de los tobillos (m)'),
}


def frames(F, p):
    phi = p['TRUNK'] * DEG
    hip = Vector((0.04, F.ankleH + (F.Lt + F.Ls) * 0.995))
    d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
    sh = hip + Vector((-d.y, d.z))
    R = (F.H('DEF-HAND.L') - F.H('DEF-ARM01.L')).length * 0.97
    dx = 0.08 - F.H('DEF-ARM01.L').x
    far = sh.x + math.sqrt(max(1e-6, R ** 2 - dx ** 2 - p['HAND_UP'] ** 2))

    def pose(end):
        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_feet(p['STANCE_X'], 8)
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                if end:
                    F.place_hand(S, F.W(sh.x + p['END_F'], sh.y + p['HAND_UP'] + 0.05, sgn * p['END_X']),
                                 F.hand_frame(S, (sgn * 0.2, 0.2, 1), (-sgn * 0.3, -1, 0.2)), pole_dir=(sgn * 1.2, 0.6, 0.1))
                else:
                    F.place_hand(S, F.W(far, sh.y + p['HAND_UP'], sgn * 0.08), F.hand_frame(S, (0, -1, 0), (-sgn, 0, 0)), pole_dir=(sgn * 1.0, 0.2, 0))
        return posar
    print(f'face pull: hombros z {sh.y:.2f} · manos de f {far:.2f}')
    return [(1, pose(False)), (30, pose(True))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'cuerda'; act['ff_plan'] = 'cable'
    hip_z = F.ankleH + (F.Lt + F.Ls) * 0.995
    act['ff_pulley'] = [p['PULLEY_F'], hip_z + (F.shMid - F.hipMid).z + p['HAND_UP']]
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
