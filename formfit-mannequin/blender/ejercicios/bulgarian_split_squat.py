"""Sentadilla búlgara (spec X03-05): acción `bulgarian_split_squat`, tipo de base `libre` hasta que exista `split` (X03-07).
Pie izquierdo delante en el suelo; el derecho detrás, con el empeine sobre el banco (FF_banco, de lado a lado). Manos
colgando a los lados (con mancuernas: las dibuja la app). Frame 1: arriba, la pierna de delante casi recta; frame 30: abajo,
el muslo de delante casi horizontal y la rodilla de atrás cerca del suelo.

Se usa igual que deadlift.py: panel FormFit, Text Editor › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/bulgarian_split_squat.py -- entrada.blend salida.blend
Es una base: el pie de atrás en el banco, la cadera y la inclinación del tronco se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('bulgarian_split_squat', 'libre', 'Sentadilla búlgara')
DEG = math.pi / 180
PARAMS = {
    'BENCH_Z':    (0.45, 0.35, 0.55, 'Banco, altura (m)'),
    'STRIDE':     (0.78, 0.55, 1.00, 'Tobillo de atrás detrás del de delante (m)'),
    'STANCE_X':   (0.10, 0.04, 0.20, 'Tobillos, media anchura (m)'),
    'SHIN_LOW':   (18.0, 0.0, 35.0, 'Abajo: tibia de delante (°)'),
    'THIGH_LOW':  (-12.0, -10.0, 30.0, 'Abajo: muslo de delante bajo la horizontal (°, − = por encima)'),
    'HIP_TOP_F':  (-0.10, -0.25, 0.05, 'Arriba: cadera por delante del tobillo de delante (m)'),
    'TRUNK_TOP':  (6.0, -5.0, 25.0, 'Arriba: tronco (°)'),
    'TRUNK_LOW':  (14.0, 0.0, 40.0, 'Abajo: tronco (°)'),
    'REAR_PITCH': (160.0, 120.0, 180.0, 'Pie de atrás (°; 180 = planta hacia arriba)'),
}
# brazo colgando con agarre neutro: el eje de la mano apunta abajo y la palma hacia el cuerpo
NEUTRAL_DOWN = {'L': Matrix.Rotation(90 * DEG, 3, 'Y'), 'R': Matrix.Rotation(-90 * DEG, 3, 'Y')}


def frames(F, p):
    Lleg = (F.Lt + F.Ls) * 0.985
    front = Vector((0.0, F.ankleH))
    rear = Vector((-p['STRIDE'], p['BENCH_Z'] + 0.02))           # tobillo con el empeine sobre el banco (pie boca arriba: el tobillo queda casi a ras)
    R = (F.H('DEF-HAND.L') - F.H('DEF-ARM01.L')).length * 0.985

    th, a = p['SHIN_LOW'] * DEG, p['THIGH_LOW'] * DEG
    knee = front + Vector((F.Ls * math.sin(th), F.Ls * math.cos(th)))
    hip_low = knee + Vector((-F.Lt * math.cos(a), -F.Lt * math.sin(a)))
    hf = p['HIP_TOP_F']; hip_top = Vector((hf, F.ankleH + math.sqrt(max(1e-6, Lleg ** 2 - hf ** 2))))
    for n, h in (('arriba', hip_top), ('abajo', hip_low)):
        print(f'búlgara {n}: cadera f {h.x:.2f} z {h.y:.2f} · cadera->tobillo de atrás {(h - rear).length:.2f} (pierna {F.Lt + F.Ls:.2f})')

    def pose(hip, phi):
        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_bench(rear.x - 0.06, p['BENCH_Z'], (0.30, 1.20, p['BENCH_Z']), along_x=True)
            F.place_trunk(hip.x, hip.y, phi)
            F.place_foot('L', front.x, front.y, p['STANCE_X'], 0, 5, knee=(front.x + 0.6, 0.6, p['STANCE_X']))
            F.place_foot('R', rear.x, rear.y, -p['STANCE_X'], p['REAR_PITCH'], 0, knee=((hip.x + rear.x) / 2 + 0.4, -0.5, -p['STANCE_X']))
            for S, sgn in (('L', 1), ('R', -1)):
                sh = F.pb[f'DEF-ARM01.{S}'].head
                F.place_hand(S, sh + Vector((sgn * 0.05, 0, -R)), NEUTRAL_DOWN[S], pole_dir=(0, 1, 0))
        return posar
    return [(1, pose(hip_top, p['TRUNK_TOP'] * DEG)), (30, pose(hip_low, p['TRUNK_LOW'] * DEG))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = '28'; act['ff_plan'] = 'split'


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
