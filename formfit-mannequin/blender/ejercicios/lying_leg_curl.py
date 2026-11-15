"""Curl femoral tumbado en máquina (ola 2): acción `lying_leg_curl`, en `libre` (base prevista: máquina tumbado).
Boca abajo en el banco (FF_banco), las rodillas justo pasado el borde, manos en los agarres delante de la cabeza. Frame 1:
piernas estiradas; frame 30: rodillas flexionadas `KNEE_END`°. Sin rodillo ni banco en ángulo todavía (trabajo de después).

  blender -b --factory-startup --python blender/ejercicios/lying_leg_curl.py -- entrada.blend salida.blend
Es una base: cadera (que no se levante), cabeza, pies y manos se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('lying_leg_curl', 'libre', 'Curl femoral tumbado')
DEG = math.pi / 180
PARAMS = {
    'BENCH_Z':    (0.50, 0.40, 0.60, 'Banco, altura (m)'),
    'HIP_UP':     (0.11, 0.07, 0.15, 'Cadera (articulación) sobre el banco (m)'),
    'KNEE_START': (5.0, 0.0, 20.0, 'Abajo: flexión de rodilla (°; 0 no llega sin estirar)'),
    'KNEE_END':   (110.0, 80.0, 130.0, 'Arriba: flexión de rodilla (°)'),
    'KNEE_X':     (0.11, 0.06, 0.18, 'Rodillas, media anchura (m)'),
}
FWD = {'L': Matrix.Rotation(-90 * DEG, 3, 'Z'), 'R': Matrix.Rotation(90 * DEG, 3, 'Z')}   # eje hacia delante, palma abajo


def frames(F, p):
    phi = 90 * DEG                                                  # tronco horizontal, boca abajo, la cabeza hacia delante
    hip = Vector((0.0, p['BENCH_Z'] + p['HIP_UP']))
    d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
    sh = hip + Vector((-d.y, d.z))
    knee = hip + Vector((-F.Lt, -0.03))
    front, back = sh.x + 0.30, knee.x + 0.06                        # el banco acaba justo antes de la rodilla

    def pose(flex):
        a = flex * DEG                                              # tibia: 0 = horizontal hacia atrás
        ank = knee + F.Ls * Vector((-math.cos(a), math.sin(a)))

        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_bench((front + back) / 2, p['BENCH_Z'], (0.40, front - back, p['BENCH_Z']))
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                F.place_foot(S, ank.x, ank.y, sgn * p['KNEE_X'], 90 + flex, 0, knee=(knee.x, knee.y - 0.6, sgn * p['KNEE_X']))
                F.place_hand(S, F.W(sh.x + 0.25, p['BENCH_Z'] - 0.04, sgn * 0.22), FWD[S], pole_dir=(0, 0.3, -1))
        print(f'curl femoral: rodilla flex {flex:.0f}° · tobillo f {ank.x:.2f} z {ank.y:.2f}')
        return posar
    return [(1, pose(p['KNEE_START'])), (30, pose(p['KNEE_END']))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = '28'; act['ff_plan'] = 'bench'
    act['ff_apoyos'] = 'banco'; act['ff_carga'] = 'ninguna'; act['ff_carga_pc'] = 0


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
