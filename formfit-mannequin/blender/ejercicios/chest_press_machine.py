"""Press de pecho en máquina (ola 2): acción `chest_press_machine`, en `libre` (base prevista: máquina sentado).
Sentado (FF_banco hace de asiento), espalda recta, pies en el suelo, agarres horizontales a la altura del pecho. Frame 1:
manos junto al pecho, codos atrás; frame 30: brazos estirados hacia delante. Sin respaldo ni brazos de la máquina todavía.

  blender -b --factory-startup --python blender/ejercicios/chest_press_machine.py -- entrada.blend salida.blend
Es una base: codos, escápulas, muñecas y pies se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('chest_press_machine', 'libre', 'Press de pecho en máquina')
DEG = math.pi / 180
PARAMS = {
    'SEAT_Z':     (0.45, 0.38, 0.55, 'Asiento, altura (m)'),
    'HIP_UP':     (0.10, 0.06, 0.14, 'Cadera (articulación) sobre el asiento (m)'),
    'TRUNK':      (-8.0, -20.0, 0.0, 'Tronco (°; − = reclinado)'),
    'HAND_HALF':  (0.26, 0.18, 0.35, 'Agarres, media anchura (m)'),
    'HAND_DOWN':  (0.08, 0.0, 0.15, 'Agarres bajo los hombros (m)'),
    'HAND_START': (0.08, 0.0, 0.20, 'Abajo: manos por delante de los hombros (m)'),
    'FOOT_F':     (0.48, 0.35, 0.60, 'Tobillos por delante de la cadera (m)'),
}
FWD = {'L': Matrix.Rotation(-90 * DEG, 3, 'Z'), 'R': Matrix.Rotation(90 * DEG, 3, 'Z')}   # eje hacia delante, palma abajo


def frames(F, p):
    phi = p['TRUNK'] * DEG
    hip = Vector((0.0, p['SEAT_Z'] + p['HIP_UP']))
    d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
    sh = hip + Vector((-d.y, d.z))
    R = (F.H('DEF-HAND.L') - F.H('DEF-ARM01.L')).length * 0.98
    dx = p['HAND_HALF'] - F.H('DEF-ARM01.L').x
    z = sh.y - p['HAND_DOWN']
    far = sh.x + math.sqrt(max(1e-6, R ** 2 - dx ** 2 - p['HAND_DOWN'] ** 2))
    print(f'press máquina: hombros f {sh.x:.2f} z {sh.y:.2f} · manos z {z:.2f}, de f {sh.x + p["HAND_START"]:.2f} a {far:.2f}')

    def pose(f, pole):
        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_bench(hip.x - 0.05, p['SEAT_Z'], (0.42, 0.42, p['SEAT_Z']))
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                F.place_foot(S, hip.x + p['FOOT_F'], F.ankleH, sgn * 0.15, 0, 8, knee=(hip.x + 0.6, 1.0, sgn * 0.2))
                F.place_hand(S, F.W(f, z, sgn * p['HAND_HALF']), FWD[S], pole_dir=pole)
        return posar
    return [(1, pose(sh.x + p['HAND_START'], (0, 1, -0.6))), (30, pose(far, (0, 0.3, -1)))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = '28'; act['ff_plan'] = 'seat'
    act['ff_apoyos'] = 'asiento'; act['ff_carga'] = 'ninguna'; act['ff_carga_pc'] = 0


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
