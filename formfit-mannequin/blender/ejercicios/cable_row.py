"""Remo sentado en polea (tipo de base `cable`): acción `cable_row`. Sentado con la pelvis en el asiento y los pies en la
plataforma, rodillas algo flexionadas; maneral triángulo (agarre neutro, manos juntas). Frame 1: brazos estirados hacia la
polea y el tronco algo adelantado; frame 30: el maneral en el ombligo, codos atrás y el tronco vertical.

La polea (anclaje del cable) se guarda en la acción (`ff_pulley`, [f, z] en metros) y el exportador la pasa al visor, que
la sube o baja con «Altura de la polea». El asiento, la plataforma y la columna los dibuja el visor.

Se usa igual que deadlift.py: panel FormFit, Text Editor › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/cable_row.py -- entrada.blend salida.blend
Es una base: escápulas, cabeza, codos y el recorrido entre claves se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('cable_row', 'cable', 'Remo en polea')
DEG = math.pi / 180
PARAMS = {
    'HIP_Z':       (0.52, 0.40, 0.70, 'Cadera (articulación) sobre el suelo (m)'),
    'KNEE':        (25.0, 5.0, 60.0, 'Flexión de rodilla (°)'),
    'FOOT_DROP':   (10.0, -10.0, 35.0, 'Tobillo por debajo de la cadera (°, desde la horizontal)'),
    'FOOT_PITCH':  (-70.0, -90.0, -40.0, 'Pie en la plataforma (°; -90 = planta delante)'),
    'STANCE_X':    (0.12, 0.06, 0.25, 'Tobillos, media anchura (m)'),
    'TRUNK_START': (18.0, 0.0, 40.0, 'Tronco con los brazos estirados (°, + delante)'),
    'TRUNK_END':   (-3.0, -20.0, 15.0, 'Tronco al tirar (°)'),
    'PULLEY_F':    (0.30, 0.10, 0.60, 'Polea delante de los tobillos (m)'),
    'PULLEY_Z':    (0.40, 0.10, 1.20, 'Polea, altura (m)'),
    'GRIP_HALF':   (0.05, 0.03, 0.12, 'Manos en el triángulo, media separación (m)'),
    'BAR_TO':      (0.32, 0.10, 0.45, 'Al tirar: bajo la línea de hombros, por el tronco (m)'),
    'TO_FRONT':    (0.17, 0.10, 0.30, 'Al tirar: maneral delante de la línea cadera-hombro (m)'),
}
# agarre neutro con los brazos hacia delante: el eje de la mano (en reposo +X / −X) apunta delante (−Y), la palma hacia
# dentro y el pulgar arriba
NEUTRAL_FWD = {'L': Matrix(((0, 0, 1), (-1, 0, 0), (0, -1, 0))), 'R': Matrix(((0, 0, -1), (1, 0, 0), (0, -1, 0)))}


def frames(F, p):
    F.socket('L')                                                 # mide el puño antes de posar (medir pone el rig en reposo)
    hip = Vector((0.0, p['HIP_Z']))                               # (f, z)
    K = p['KNEE'] * DEG
    reach = math.sqrt(F.Lt ** 2 + F.Ls ** 2 + 2 * F.Lt * F.Ls * math.cos(K))     # cadera -> tobillo con esa rodilla
    a = p['FOOT_DROP'] * DEG
    ankle = hip + Vector((reach * math.cos(a), -reach * math.sin(a)))
    pulley = Vector((ankle.x + p['PULLEY_F'], p['PULLEY_Z']))
    L = F.arm_len('L') * 0.985                                  # brazo casi recto (sin pasarse del alcance)
    d = lambda phi: F.trunk_R(phi) @ (F.shMid - F.hipMid)        # cadera -> hombros (mundo)
    print(f'remo en polea: tobillo f {ankle.x:.2f} z {ankle.y:.2f} · polea f {pulley.x:.2f} z {pulley.y:.2f}')

    def pose(phi, pull):
        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=1); F.hide_machine(); F.hide_bar()
            F.place_trunk(hip.x, hip.y, phi)
            Rf = Matrix.Rotation(p['FOOT_PITCH'] * DEG, 3, 'X')
            for S, sgn in (('L', 1), ('R', -1)):
                fik = f'FOOT-IK.{S}'; at = F.W(ankle.x, ankle.y, sgn * p['STANCE_X'])
                F.setM(fik, Rf @ F.rest_rot(fik), at + Rf @ (F.H(fik) - F.H(f'DEF-FOOT.{S}')))
                F.setM(f'IK-POLE-LEG.{S}', F.rest_rot(f'IK-POLE-LEG.{S}'), F.W(ankle.x * 0.5, hip.y + 0.6, sgn * (p['STANCE_X'] + 0.05)))
            sh = F.sagittal(F.pb['DEF-ARM01.L'].head)
            sh = Vector(sh)
            if pull:   # el maneral en el ombligo, delante del tronco
                u = Vector((math.sin(phi), math.cos(phi))); n = Vector((math.cos(phi), -math.sin(phi)))
                g = hip + Vector((-d(phi).y, d(phi).z)) - u * p['BAR_TO'] + n * p['TO_FRONT']
            else:      # brazos estirados hacia la polea, casi rectos
                g = sh + (pulley - sh).normalized() * math.sqrt(max(1e-6, L ** 2 - (F.H('DEF-ARM01.L').x - p['GRIP_HALF']) ** 2))
            F.grip_bar(F.W(g.x, g.y), p['GRIP_HALF'], NEUTRAL_FWD, pole_dir=(0, 1, -0.4))
        return posar
    return [(1, pose(p['TRUNK_START'] * DEG, False)), (30, pose(p['TRUNK_END'] * DEG, True))]


def setup(F, act, p):
    """La polea va en la acción (ffpose.run llama a setup tras posar): el exportador la pasa al visor en meta.pulley."""
    K, a = p['KNEE'] * DEG, p['FOOT_DROP'] * DEG
    reach = math.sqrt(F.Lt ** 2 + F.Ls ** 2 + 2 * F.Lt * F.Ls * math.cos(K))
    act['ff_pulley'] = [reach * math.cos(a) + p['PULLEY_F'], p['PULLEY_Z']]


if __name__ == '__main__':
    import bpy, sys, os, importlib, types
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None
    if argv: bpy.ops.wm.open_mainfile(filepath=argv[0])
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, here if os.path.exists(os.path.join(here, 'ffpose.py')) else os.path.dirname(bpy.data.filepath))
    import ffpose as F
    importlib.reload(F)
    ex = types.SimpleNamespace(META=META, PARAMS=PARAMS, frames=frames, setup=setup)
    F.run(ex)
    bpy.context.scene.frame_set(30)
    if argv: bpy.ops.wm.save_as_mainfile(filepath=argv[1]); print('SAVED', argv[1])
