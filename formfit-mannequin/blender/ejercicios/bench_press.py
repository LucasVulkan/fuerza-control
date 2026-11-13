"""Press de banca con barra (spec X03-05): acción `bench_press`, tipo de base `bench` (X03-07; antes `libre`).
Tumbado boca arriba en el banco (FF_banco, lo coloca la acción), pies en el suelo a los lados. Frame 1: barra arriba con los
brazos rectos sobre los hombros; frame 30: barra en el pecho, a la altura del esternón, codos hacia abajo y hacia los pies.

Se usa igual que deadlift.py: panel FormFit, Text Editor › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/bench_press.py -- entrada.blend salida.blend
Es una base: arco de la espalda, escápulas, cabeza, codos y manos se retocan a mano en Blender.
"""
import math
from mathutils import Vector

META = ('bench_press', 'bench', 'Press de banca')
DEG = math.pi / 180
PARAMS = {
    'BENCH_Z':    (0.43, 0.35, 0.50, 'Banco, altura (m)'),
    'BACK':       (0.10, 0.06, 0.14, 'Cadera (articulación) sobre el banco (m)'),
    'TRUNK':      (-85.0, -95.0, -70.0, 'Tronco (°; -90 = horizontal)'),
    'GRIP_HALF':  (0.27, 0.18, 0.40, 'Agarre, media anchura (m)'),
    'BAR_DOWN':   (0.12, 0.04, 0.20, 'Barra abajo: de los hombros hacia la cadera (m)'),
    'CHEST':      (0.115, 0.08, 0.16, 'Grosor del pecho sobre la línea cadera-hombro (m)'),
    'FOOT_F':     (0.42, 0.25, 0.60, 'Tobillos por delante de la cadera (m)'),
    'STANCE_X':   (0.30, 0.18, 0.45, 'Tobillos, media anchura (m)'),
}
# mano arriba con agarre prono: el eje de la mano apunta arriba y la palma mira hacia los pies (−Y), como en la dominada
PRESS = {'L': ((0, 1, 0), (0, 0, 1), (1, 0, 0)), 'R': ((0, -1, 0), (0, 0, 1), (-1, 0, 0))}


def frames(F, p):
    from mathutils import Matrix
    F.socket('L')
    hand = {S: Matrix(m) for S, m in PRESS.items()}
    phi = p['TRUNK'] * DEG
    hip = Vector((0.0, p['BENCH_Z'] + p['BACK']))
    d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
    sh = hip + Vector((-d.y, d.z))
    u = Vector((math.sin(phi), math.cos(phi))); n = Vector((math.cos(phi), -math.sin(phi)))   # hacia los hombros · hacia el pecho
    L = F.arm_len('L') * 0.99; dx = p['GRIP_HALF'] - F.H('DEF-ARM01.L').x
    top = sh + Vector((0.02, math.sqrt(max(1e-6, L ** 2 - dx ** 2))))
    low = sh - u * p['BAR_DOWN'] + n * (p['CHEST'] + 0.015)
    print(f'banca: hombros f {sh.x:.2f} z {sh.y:.2f} · barra arriba z {top.y:.2f} · abajo f {low.x:.2f} z {low.y:.2f}')

    def pose(bar):
        def posar():
            F.set_props(hand_parent=5, foot_parent=0, bar_in_hands=1); F.hide_machine()
            F.place_bench(hip.x - 0.35, p['BENCH_Z'], (0.30, 1.20, p['BENCH_Z']))
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                F.place_foot(S, hip.x + p['FOOT_F'], F.ankleH, sgn * p['STANCE_X'], 0, 10, knee=(hip.x + 0.3, 1.0, sgn * 0.4))
            F.place_bar(bar.x, bar.y)
            F.grip_bar(F.W(bar.x, bar.y), p['GRIP_HALF'], hand, pole_dir=(0, -0.5, -1))
        return posar
    return [(1, pose(top)), (30, pose(low))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'barra_press'
    act['ff_apoyos'] = 'banco;pie.L+pie.R'; act['ff_carga'] = 'manos'; act['ff_carga_pc'] = 80   # X03-14: dónde se apoya y dónde va la carga (demanda en `libre`)


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
