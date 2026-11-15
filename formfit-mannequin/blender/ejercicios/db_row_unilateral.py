"""Remo con mancuerna a una mano (ola 3): acción `db_row_unilateral`, en `libre` (base prevista: `row`).
Rodilla y mano izquierdas en el banco (FF_banco, de delante a atrás), pie derecho en el suelo, tronco casi horizontal. Tira la
mano derecha: frame 1, la mancuerna colgando bajo el hombro; frame 30, junto a la cadera con el codo arriba.

  blender -b --factory-startup --python blender/ejercicios/db_row_unilateral.py -- entrada.blend salida.blend
Es una base: espalda, escápulas, codo y pie se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('db_row_unilateral', 'libre', 'Remo con mancuerna a una mano')
DEG = math.pi / 180
PARAMS = {
    'BENCH_Z':    (0.40, 0.35, 0.50, 'Banco, altura (m)'),
    'TRUNK':      (88.0, 70.0, 95.0, 'Tronco (°; 90 = horizontal)'),
    'FOOT_X':     (0.22, 0.15, 0.40, 'Pie derecho, separado del centro (m)'),
    'ROW_F':      (0.10, -0.05, 0.25, 'Arriba: muñeca por delante de la cadera (m)'),
    'ROW_UP':     (0.12, 0.05, 0.25, 'Arriba: muñeca bajo la línea cadera-hombro (m)'),
}
FLAT_FWD = Matrix.Rotation(-90 * DEG, 3, 'Z')                       # mano izquierda plana en el banco, dedos delante


def frames(F, p):
    NEU_R = Matrix.Rotation(-90 * DEG, 3, 'Z') @ F.HANG_PRONE['R']
    phi = p['TRUNK'] * DEG
    knee = Vector((0.0, p['BENCH_Z'] + 0.05))
    hip = knee + Vector((-0.03, F.Lt * 0.99))                       # muslo izquierdo vertical sobre la rodilla
    d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
    sh = hip + Vector((-d.y, d.z))
    R = (F.H('DEF-HAND.L') - F.H('DEF-ARM01.L')).length
    u = Vector((math.sin(phi), math.cos(phi))); n = Vector((math.cos(phi), -math.sin(phi)))   # hacia los hombros · hacia el pecho
    top = hip + u * 0.10 + n * p['ROW_UP']
    print(f'remo 1 mano: cadera z {hip.y:.2f} · hombros f {sh.x:.2f} z {sh.y:.2f}')
    back, front = -F.Ls - 0.05, sh.x + 0.15

    def pose(up):
        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_bench((back + front) / 2, p['BENCH_Z'], (0.32, front - back, p['BENCH_Z']), x=0.14)
            F.place_trunk(hip.x, hip.y, phi)
            F.place_foot('L', -F.Ls, p['BENCH_Z'] + 0.05, 0.12, 90, 0, knee=(0.0, 0.0, 0.12))
            F.place_foot('R', 0.05, F.ankleH, -p['FOOT_X'], 0, 10, knee=(0.8, 0.6, -p['FOOT_X']))
            shL = F.pb['DEF-ARM01.L'].head.copy()
            F.place_hand('L', F.W(sh.x + 0.02, p['BENCH_Z'] + 0.04, shL.x), FLAT_FWD, pole_dir=(0.3, 0.5, 0), curl=0)
            shR = F.pb['DEF-ARM01.R'].head.copy()
            w = F.W(top.x + p['ROW_F'], top.y, shR.x - 0.02) if up else shR + Vector((0, -0.04, -R * 0.97))
            F.place_hand('R', w, NEU_R, pole_dir=(-0.2, 0.6, 1.0 if up else 0.0))
        return posar
    return [(1, pose(False)), (30, pose(True))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = ''; act['ff_plan'] = 'row'
    act['ff_apoyos'] = 'banco'; act['ff_carga'] = 'mano.R'; act['ff_carga_pc'] = 30


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
