"""Press militar con barra (ola 2): acción `overhead_press`, en `libre` (base prevista: `stand`).
De pie y erguido. Frame 1: barra delante de los hombros (posición de rack, codos delante y abajo); frame 30: barra sobre la
cabeza con los brazos rectos, encima de los hombros.

  blender -b --factory-startup --python blender/ejercicios/overhead_press.py -- entrada.blend salida.blend
Es una base: cabeza (se aparta de la barra), escápulas, codos y muñecas se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('overhead_press', 'libre', 'Press militar')
DEG = math.pi / 180
PARAMS = {
    'STANCE_X':   (0.13, 0.08, 0.25, 'Tobillos, media anchura (m)'),
    'TOE_OUT':    (8.0, -5.0, 25.0, 'Puntas hacia fuera (°)'),
    'GRIP_HALF':  (0.25, 0.18, 0.35, 'Agarre, media anchura (m)'),
    'RACK_F':     (0.08, 0.03, 0.14, 'Barra abajo: delante de los hombros (m)'),
    'RACK_Z':     (0.03, -0.05, 0.10, 'Barra abajo: sobre los hombros (m)'),
}
# mano con la barra por delante: el eje de la mano apunta arriba y la palma mira hacia delante (la de la banca, de pie)
PRESS = {'L': Matrix(((0, 1, 0), (0, 0, 1), (1, 0, 0))), 'R': Matrix(((0, -1, 0), (0, 0, 1), (-1, 0, 0)))}


def frames(F, p):
    F.socket('L')
    phi = F.trunk_rest
    hip = Vector((0.0, F.ankleH + (F.Lt + F.Ls) * 0.995))
    d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
    sh = hip + Vector((-d.y, d.z))
    L = F.arm_len('L') * 0.99; dx = p['GRIP_HALF'] - F.H('DEF-ARM01.L').x
    low = sh + Vector((p['RACK_F'], p['RACK_Z']))
    top = sh + Vector((0.0, math.sqrt(max(1e-6, L ** 2 - dx ** 2))))
    print(f'press militar: hombros z {sh.y:.2f} · barra abajo z {low.y:.2f} · arriba z {top.y:.2f}')

    def pose(bar, pole):
        def posar():
            F.set_props(hand_parent=5, foot_parent=0, bar_in_hands=0); F.hide_machine()
            F.place_feet(p['STANCE_X'], p['TOE_OUT'])
            F.place_trunk(hip.x, hip.y, phi)
            F.place_bar(bar.x, bar.y)
            F.grip_bar(F.W(bar.x, bar.y), p['GRIP_HALF'], PRESS, pole_dir=pole)
        return posar
    return [(1, pose(low, (0, -1, -0.6))), (30, pose(top, (0, 0.3, -1)))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'barra_press'; act['ff_plan'] = 'stand'
    act['ff_apoyos'] = 'pie.L+pie.R'; act['ff_carga'] = 'manos'; act['ff_carga_pc'] = 50


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
