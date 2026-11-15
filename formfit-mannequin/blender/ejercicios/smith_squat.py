"""Sentadilla en multipower (ola 2): acción `smith_squat`, en `libre` (base prevista: `stand` con barra guiada).
La barra sube y baja en vertical (raíl) sobre la espalda, y los pies van adelantados respecto a ella, así que el tronco puede
ir más vertical que en la trasera libre. Frame 1: de pie; frame 30: abajo (cadera a la altura de `HIP_LOW`).
Sin el raíl de la máquina todavía (trabajo de después).

  blender -b --factory-startup --python blender/ejercicios/smith_squat.py -- entrada.blend salida.blend
Es una base: espalda, rodillas, cabeza y manos se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('smith_squat', 'libre', 'Sentadilla en multipower')
DEG = math.pi / 180
PARAMS = {
    'STANCE_X':   (0.17, 0.10, 0.28, 'Tobillos, media anchura (m)'),
    'TOE_OUT':    (15.0, 0.0, 30.0, 'Puntas hacia fuera (°)'),
    'BAR_F':      (-0.12, -0.25, 0.05, 'Raíl: barra respecto al tobillo (m; − = detrás, pies adelantados)'),
    'TRUNK_TOP':  (3.0, 0.0, 10.0, 'Arriba: tronco (°)'),
    'TRUNK_LOW':  (25.0, 10.0, 40.0, 'Abajo: tronco (°)'),
    'HIP_LOW':    (0.50, 0.38, 0.65, 'Abajo: altura de la cadera (m)'),
    'GRIP_HALF':  (0.32, 0.25, 0.42, 'Agarre, media anchura (m)'),
}
# barra en la espalda: el eje de la mano apunta arriba y la palma hacia delante (como en el press militar)
PRESS = {'L': Matrix(((0, 1, 0), (0, 0, 1), (1, 0, 0))), 'R': Matrix(((0, -1, 0), (0, 0, 1), (-1, 0, 0)))}


def frames(F, p):
    F.socket('L')

    def body(phi, hip_z=None):
        d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
        u = Vector((math.sin(phi), math.cos(phi))); back = Vector((-math.cos(phi), math.sin(phi)))
        off = Vector((-d.y, d.z)) + u * 0.05 + back * 0.07           # cadera -> barra (5 cm sobre los hombros, 7 cm detrás)
        hip_f = p['BAR_F'] - off.x
        if hip_z is None:                                           # de pie: la pierna casi estirada
            hip_z = F.ankleH + math.sqrt(max(1e-6, ((F.Lt + F.Ls) * 0.99) ** 2 - hip_f ** 2))
        hip = Vector((hip_f, hip_z))
        return hip, hip + off

    hip0, bar0 = body(p['TRUNK_TOP'] * DEG)
    hip1, bar1 = body(p['TRUNK_LOW'] * DEG, p['HIP_LOW'])
    reach = math.hypot(hip1.x, hip1.y - F.ankleH)
    print(f'multipower: barra f {bar0.x:.2f} de z {bar0.y:.2f} a {bar1.y:.2f} · cadera abajo f {hip1.x:.2f} '
          f'(cadera-tobillo {reach:.2f} de {F.Lt + F.Ls:.2f})')

    def pose(phi, hip, bar):
        def posar():
            F.set_props(hand_parent=5, foot_parent=0, bar_in_hands=0); F.hide_machine()
            F.place_feet(p['STANCE_X'], p['TOE_OUT'])
            for S, sgn in (('L', 1), ('R', -1)):
                F.setM(f'IK-POLE-LEG.{S}', F.rest_rot(f'IK-POLE-LEG.{S}'), F.W(0.8, 0.6, sgn * 0.35))   # rodillas hacia delante y fuera
            F.place_trunk(hip.x, hip.y, phi)
            F.place_bar(bar.x, bar.y)
            F.grip_bar(F.W(bar.x, bar.y), p['GRIP_HALF'], PRESS, pole_dir=(0, 1, -1))
        return posar
    return [(1, pose(p['TRUNK_TOP'] * DEG, hip0, bar0)), (30, pose(p['TRUNK_LOW'] * DEG, hip1, bar1))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'barra_espalda'; act['ff_plan'] = 'stand'
    act['ff_apoyos'] = 'pie.L+pie.R'; act['ff_carga'] = 'tronco'; act['ff_carga_pc'] = 100


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
