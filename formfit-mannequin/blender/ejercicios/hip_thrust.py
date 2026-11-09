"""Hip thrust con barra (spec X03-05): acción `hip_thrust`, tipo de base `libre` hasta que exista `bench` (X03-07).
Las escápulas apoyadas en el borde del banco (FF_banco, de lado a lado), pies en el suelo y la barra sobre la cadera. Frame 1:
abajo, la cadera cerca del suelo; frame 30: arriba, tronco y muslos en línea horizontal y las tibias verticales.
El giro es alrededor de los hombros, que no se mueven; los tobillos tampoco.

Se usa igual que deadlift.py: panel FormFit, Text Editor › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/hip_thrust.py -- entrada.blend salida.blend
Es una base: cabeza (mirando al frente arriba), escápulas en el borde, pies y manos se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('hip_thrust', 'libre', 'Hip thrust')
DEG = math.pi / 180
PARAMS = {
    'BENCH_Z':    (0.42, 0.35, 0.50, 'Banco, altura (m)'),
    'SH_Z':       (0.50, 0.40, 0.60, 'Hombros (articulación) sobre el suelo (m)'),
    'DROP':       (40.0, 20.0, 60.0, 'Abajo: tronco bajo la horizontal (°)'),
    'TOP':        (-88.0, -95.0, -80.0, 'Arriba: tronco (°; -90 = horizontal)'),
    'SHIN_FWD':   (0.02, -0.08, 0.12, 'Arriba: tobillo por delante de la rodilla (m)'),
    'BELLY':      (0.13, 0.08, 0.20, 'Barra: sobre la línea cadera-hombro (m)'),
    'GRIP_HALF':  (0.30, 0.20, 0.45, 'Agarre, media anchura (m)'),
    'STANCE_X':   (0.15, 0.08, 0.30, 'Tobillos, media anchura (m)'),
}
# mano sobre la barra, palma abajo y dedos hacia delante (los pies): el colgado prono girado 90° hacia delante
OVER = {S: Matrix.Rotation(-90 * DEG, 3, 'X') for S in 'LR'}


def frames(F, p):
    F.socket('L')
    hand = {S: OVER[S] @ F.HANG_PRONE[S] for S in 'LR'}
    sh = Vector((0.0, p['SH_Z']))
    d = lambda phi: F.trunk_R(phi) @ (F.shMid - F.hipMid)
    hip_of = lambda phi: sh - Vector((-d(phi).y, d(phi).z))
    top_phi, low_phi = p['TOP'] * DEG, (p['TOP'] + p['DROP']) * DEG
    hip_top = hip_of(top_phi)
    ankle = Vector((hip_top.x + F.Lt * 0.97 + p['SHIN_FWD'], F.ankleH))     # tibia casi vertical con el muslo horizontal
    print(f'hip thrust: cadera arriba z {hip_top.y:.2f} · abajo z {hip_of(low_phi).y:.2f} · tobillo f {ankle.x:.2f}')

    def pose(phi):
        hip = hip_of(phi)
        n = Vector((math.cos(phi), -math.sin(phi)))                       # hacia el vientre
        bar = hip + n * (p['BELLY'] + 0.015) + Vector((0.03, 0))

        def posar():
            F.set_props(hand_parent=5, foot_parent=0, bar_in_hands=0); F.hide_machine()
            F.place_bench(sh.x - 0.14, p['BENCH_Z'], (0.30, 1.20, p['BENCH_Z']), along_x=True)
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                F.place_foot(S, ankle.x, F.ankleH, sgn * p['STANCE_X'], 0, 10, knee=(ankle.x, 1.0, sgn * 0.3))
            F.place_bar(bar.x, bar.y)
            F.grip_bar(F.W(bar.x, bar.y), p['GRIP_HALF'], hand, pole_dir=(0, 0.3, 1))
        return posar
    return [(1, pose(low_phi)), (30, pose(top_phi))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'barra_pm'; act['ff_plan'] = 'bench'


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
