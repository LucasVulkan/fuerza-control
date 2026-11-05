"""Remo en polea a un brazo (tipo de base `cable`): acción `cable_row_one_arm`. Sentado como en el remo en polea
(cable_row.py), tira la mano derecha de un asa en D (agarre neutro) con la polea delante del hombro derecho; la izquierda
descansa sobre el muslo. El tronco gira: con el brazo estirado el hombro derecho va adelante (`TWIST_START`) y al tirar
se abre (`TWIST_END`).

Es su propia acción (no una variante del remo a dos manos): la pose del cuerpo cambia y es más sensible. El visor solo
mueve el brazo que tira (`ff_hand` = "R"); el otro va tal cual con el tronco.

Se usa igual que deadlift.py: panel FormFit, Text Editor › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/cable_row_one_arm.py -- entrada.blend salida.blend
Es una base: el giro del tronco, escápulas, cabeza y el brazo libre se retocan a mano en Blender.
"""
import math, os, importlib.util
from mathutils import Vector, Matrix

META = ('cable_row_one_arm', 'cable', 'Remo en polea a un brazo')
DEG = math.pi / 180


def _cable_row():
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, 'cable_row.py')
    if not os.path.exists(path):
        import bpy; path = os.path.join(os.path.dirname(bpy.data.filepath), 'ejercicios', 'cable_row.py')
    spec = importlib.util.spec_from_file_location('ffej_cable_row_base', path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


B = _cable_row()
PARAMS = {**{k: v for k, v in B.PARAMS.items() if k != 'GRIP_HALF'},
          'TRUNK_START': (12.0, 0.0, 40.0, 'Tronco con el brazo estirado (°, + delante)'),
          'TWIST_START': (20.0, 0.0, 45.0, 'Giro del tronco con el brazo estirado (°, hombro derecho adelante)'),
          'TWIST_END':   (-8.0, -30.0, 10.0, 'Giro del tronco al tirar (°)'),
          'PULLEY_X':    (-0.18, -0.35, 0.0, 'Polea a un lado (m; − = derecha)'),
          'BAR_TO':      (0.28, 0.10, 0.45, 'Al tirar: bajo la línea de hombros, por el tronco (m)'),
          'TO_FRONT':    (0.12, 0.05, 0.30, 'Al tirar: asa delante de la línea cadera-hombro (m)')}
# mano libre sobre el muslo: dedos hacia delante (−Y), palma abajo
PALM_DOWN_FWD = Matrix(((0, 1, 0), (-1, 0, 0), (0, 0, 1)))


def frames(F, p):
    F.socket('L')                                                 # mide el puño antes de posar (medir pone el rig en reposo)
    hip = Vector((0.0, p['HIP_Z']))
    K = p['KNEE'] * DEG
    reach = math.sqrt(F.Lt ** 2 + F.Ls ** 2 + 2 * F.Lt * F.Ls * math.cos(K))
    a = p['FOOT_DROP'] * DEG
    ankle = hip + Vector((reach * math.cos(a), -reach * math.sin(a)))
    pulley = F.W(ankle.x + p['PULLEY_F'], p['PULLEY_Z'], p['PULLEY_X'])
    print(f'remo a un brazo: polea {tuple(round(c, 2) for c in pulley)}')

    def pose(phi, twist, pull):
        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine()
            F.place_trunk(hip.x, hip.y, phi)
            # el giro va en el pecho (control CHEST), no en la pelvis: con la pelvis girada una pierna no llegaba a su pie
            Rz = Matrix.Rotation(twist * DEG, 3, 'Z'); C = F.pb['CHEST'].matrix.copy(); F.setM('CHEST', Rz @ C.to_3x3(), C.translation)
            R = Rz @ F.trunk_R(phi)
            Rf = Matrix.Rotation(p['FOOT_PITCH'] * DEG, 3, 'X')
            for S, sgn in (('L', 1), ('R', -1)):
                fik = f'FOOT-IK.{S}'; at = F.W(ankle.x, ankle.y, sgn * p['STANCE_X'])
                F.setM(fik, Rf @ F.rest_rot(fik), at + Rf @ (F.H(fik) - F.H(f'DEF-FOOT.{S}')))
                F.setM(f'IK-POLE-LEG.{S}', F.rest_rot(f'IK-POLE-LEG.{S}'), F.W(ankle.x * 0.5, hip.y + 0.6, sgn * (p['STANCE_X'] + 0.05)))
            sh = F.pb['DEF-ARM01.R'].head.copy()
            if pull:   # el asa junto al costado derecho, delante del tronco
                trunk = R @ (F.shMid - F.hipMid); u = trunk.normalized(); n = (R @ Vector((0, -1, 0))).normalized()
                g = F.W(hip.x, hip.y) + trunk - u * p['BAR_TO'] + n * p['TO_FRONT'] + Vector((sh.x * 0.6, 0, 0))
            Dh = B.NEUTRAL_FWD['R']
            if not pull:   # brazo estirado hacia la polea: la MUÑECA a 0,997 de brazo + antebrazo, no el puño
                dirp = (pulley - sh).normalized(); reach = ((F.H('DEF-FORARM01.R') - F.H('DEF-ARM01.R')).length + (F.H('DEF-HAND.R') - F.H('DEF-FORARM01.R')).length) * 0.997   # brazo + antebrazo (en reposo el codo no está recto)
                lo, hi = 0.0, 2 * reach
                for _ in range(50):
                    m = (lo + hi) / 2
                    if (sh + dirp * m - Dh @ F.socket('R') - sh).length < reach: lo = m
                    else: hi = m
                g = sh + dirp * lo
            F.setM('HAND_IK.R', Dh @ F.rest_rot('HAND_IK.R'), g - Dh @ F.socket('R'))
            F.setM('ARM-POLE-IK.R', F.rest_rot('ARM-POLE-IK.R'), sh + Vector((0, 1, -0.4)).normalized() * 0.5 + Vector((-0.15, 0, 0)))
            F.fist('R'); F.upd()
            # el control BARRA (oculto) marca el asa, en el puño real (no en el objetivo): es lo que se exporta
            F.setM('BARRA', F.rest_rot('BARRA') * 0.001, F.pb['FF_PUNO.R'].head.copy())
            # mano libre sobre el muslo izquierdo (a 60 % de la cadera a la rodilla, un poco por encima)
            th = F.pb['DEF-THIGH01.L'].head; kn = F.pb['DEF-SHIN01.L'].head
            rest = th + (kn - th) * 0.6 + Vector((0, 0, 0.07))
            F.setM('HAND_IK.L', PALM_DOWN_FWD @ F.rest_rot('HAND_IK.L'), rest)
            F.setM('ARM-POLE-IK.L', F.rest_rot('ARM-POLE-IK.L'), F.pb['DEF-ARM01.L'].head + Vector((0.3, 0.3, 0)))
            F.fist('L', -20)
        return posar
    return [(1, pose(p['TRUNK_START'] * DEG, p['TWIST_START'], False)), (30, pose(p['TRUNK_END'] * DEG, p['TWIST_END'], True))]


def setup(F, act, p):
    """La polea y la mano que tira van en la acción (meta.pulley con su x, meta.hand)."""
    K, a = p['KNEE'] * DEG, p['FOOT_DROP'] * DEG
    reach = math.sqrt(F.Lt ** 2 + F.Ls ** 2 + 2 * F.Lt * F.Ls * math.cos(K))
    act['ff_pulley'] = [reach * math.cos(a) + p['PULLEY_F'], p['PULLEY_Z'], p['PULLEY_X']]
    act['ff_hand'] = 'R'


if __name__ == '__main__':
    import bpy, sys, types
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None
    if argv: bpy.ops.wm.open_mainfile(filepath=argv[0])
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, here if os.path.exists(os.path.join(here, 'ffpose.py')) else os.path.dirname(bpy.data.filepath))
    import ffpose as F
    importlib.reload(F)
    F.run(types.SimpleNamespace(META=META, PARAMS=PARAMS, frames=frames, setup=setup))
    bpy.context.scene.frame_set(30)
    if argv: bpy.ops.wm.save_as_mainfile(filepath=argv[1]); print('SAVED', argv[1])
