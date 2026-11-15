"""Extensión de cuádriceps en máquina (ola 2): acción `leg_extension`, en `libre` (base prevista: máquina sentado).
Sentado en el asiento (FF_banco hace de asiento), el muslo horizontal con la rodilla en el borde, manos en los agarres a los
lados de la cadera. Frame 1: tibia colgando (rodilla a ~`KNEE_START`°); frame 30: pierna estirada hasta `KNEE_END`°.
Sin respaldo ni rodillo todavía: la máquina (respaldo, rodillo, eje de giro alineado con la rodilla) es trabajo de después.

  blender -b --factory-startup --python blender/ejercicios/leg_extension.py -- entrada.blend salida.blend
Es una base: tronco, pies y manos se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('leg_extension', 'libre', 'Extensión de cuádriceps')
DEG = math.pi / 180
PARAMS = {
    'SEAT_Z':     (0.50, 0.42, 0.60, 'Asiento, altura (m)'),
    'HIP_UP':     (0.10, 0.06, 0.14, 'Cadera (articulación) sobre el asiento (m)'),
    'TRUNK':      (-12.0, -25.0, 5.0, 'Tronco (°; − = reclinado)'),
    'KNEE_START': (95.0, 80.0, 110.0, 'Abajo: flexión de rodilla (°)'),
    'KNEE_END':   (10.0, 0.0, 30.0, 'Arriba: flexión de rodilla (°)'),
    'KNEE_X':     (0.11, 0.06, 0.18, 'Rodillas, media anchura (m)'),
}


def frames(F, p):
    neu = {'L': Matrix.Rotation(90 * DEG, 3, 'Z') @ F.HANG_PRONE['L'], 'R': Matrix.Rotation(-90 * DEG, 3, 'Z') @ F.HANG_PRONE['R']}
    phi = p['TRUNK'] * DEG
    hip = Vector((0.0, p['SEAT_Z'] + p['HIP_UP']))
    knee = hip + Vector((F.Lt, -0.02))

    def pose(flex):
        a = (90 - flex) * DEG                                       # tibia: 0 = colgando vertical, 90 = horizontal
        ank = knee + F.Ls * Vector((math.sin(a), -math.cos(a)))

        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_bench((hip.x - 0.18 + knee.x - 0.06) / 2, p['SEAT_Z'], (0.42, knee.x - 0.06 - hip.x + 0.18, p['SEAT_Z']))
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                F.place_foot(S, ank.x, ank.y, sgn * p['KNEE_X'], -a / DEG, 0, knee=(knee.x + 0.5, knee.y + 0.3, sgn * p['KNEE_X']))
                F.place_hand(S, F.W(hip.x + 0.02, p['SEAT_Z'] + 0.09, sgn * 0.27), neu[S], pole_dir=(0, 1, 0))
        print(f'extensión: rodilla flex {flex:.0f}° · tobillo f {ank.x:.2f} z {ank.y:.2f}')
        return posar
    return [(1, pose(p['KNEE_START'])), (30, pose(p['KNEE_END']))]


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
