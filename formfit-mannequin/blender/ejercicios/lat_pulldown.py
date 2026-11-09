"""Jalón al pecho (spec X03-05): acción `lat_pulldown`, tipo de base `libre`; después, `cable` con la polea arriba (X01 §2.13).
Sentado en el asiento (FF_banco hace de asiento), muslos horizontales y pies en el suelo; barra de jalón con agarre prono
ancho. Frame 1: brazos estirados arriba, tronco un poco hacia atrás; frame 30: la barra en la parte alta del pecho, codos
abajo y atrás, tronco algo más inclinado. La barra de jalón no se ve (BARRA oculta, como el maneral del remo en polea): la
dibujará la app.

Se usa igual que deadlift.py: panel FormFit, Text Editor › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/lat_pulldown.py -- entrada.blend salida.blend
Es una base: escápulas, cabeza, codos y manos se retocan a mano en Blender.
"""
import math
from mathutils import Vector

META = ('lat_pulldown', 'libre', 'Jalón al pecho')
DEG = math.pi / 180
PARAMS = {
    'SEAT_Z':      (0.45, 0.38, 0.55, 'Asiento, altura (m)'),
    'HIP_UP':      (0.08, 0.05, 0.12, 'Cadera (articulación) sobre el asiento (m)'),
    'TRUNK_START': (-6.0, -20.0, 10.0, 'Tronco con los brazos arriba (°, − hacia atrás)'),
    'TRUNK_END':   (-18.0, -35.0, 0.0, 'Tronco al tirar (°)'),
    'GRIP_HALF':   (0.40, 0.25, 0.50, 'Agarre, media anchura (m)'),
    'BAR_F':       (0.06, -0.05, 0.20, 'Arriba: barra delante de los hombros (m)'),
    'BAR_TO':      (0.06, 0.0, 0.15, 'Al tirar: bajo la línea de hombros, por el tronco (m)'),
    'TO_FRONT':    (0.13, 0.08, 0.20, 'Al tirar: barra delante de la línea cadera-hombro (m)'),
    'STANCE_X':    (0.18, 0.08, 0.30, 'Tobillos, media anchura (m)'),
}
HANG_OVER = {'L': ((0, 1, 0), (0, 0, 1), (1, 0, 0)), 'R': ((0, -1, 0), (0, 0, 1), (-1, 0, 0))}   # eje arriba, palma delante


def frames(F, p):
    from mathutils import Matrix
    F.socket('L')
    hand = {S: Matrix(m) for S, m in HANG_OVER.items()}
    hip = Vector((0.0, p['SEAT_Z'] + p['HIP_UP']))
    d = lambda phi: F.trunk_R(phi) @ (F.shMid - F.hipMid)
    L = F.arm_len('L') * 0.99; dx = p['GRIP_HALF'] - F.H('DEF-ARM01.L').x
    ankle_f = hip.x + F.Lt * 0.92

    def pose(phi, pull):
        sh = hip + Vector((-d(phi).y, d(phi).z))
        if pull:
            u = Vector((math.sin(phi), math.cos(phi))); n = Vector((math.cos(phi), -math.sin(phi)))
            bar = sh - u * p['BAR_TO'] + n * p['TO_FRONT']
        else:
            bar = sh + Vector((p['BAR_F'], math.sqrt(max(1e-6, L ** 2 - dx ** 2 - p['BAR_F'] ** 2))))
        print(f'jalón: hombros z {sh.y:.2f} · barra f {bar.x:.2f} z {bar.y:.2f}')

        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=1); F.hide_machine(); F.hide_bar()
            F.place_bench(hip.x - 0.02, p['SEAT_Z'], (0.40, 0.40, p['SEAT_Z']))
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                F.place_foot(S, ankle_f, F.ankleH, sgn * p['STANCE_X'], 0, 10, knee=(ankle_f + 0.3, 1.0, sgn * 0.3))
            F.grip_bar(F.W(bar.x, bar.y), p['GRIP_HALF'], hand, pole_dir=(0, 0.3, -1))
        return posar
    return [(1, pose(p['TRUNK_START'] * DEG, False)), (30, pose(p['TRUNK_END'] * DEG, True))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'colgado_prono'; act['ff_plan'] = 'cable'


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
