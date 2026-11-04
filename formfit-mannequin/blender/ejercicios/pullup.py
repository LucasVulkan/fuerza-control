"""Dominada (tipo de base `hang`): acción `pullup`. Frame 1: colgado de la barra fija con los brazos rectos; frame 30: la
barbilla por encima de la barra, el pecho hacia ella y el cuerpo un poco inclinado hacia atrás. Agarre prono.

Se usa igual que deadlift.py: panel FormFit, Text Editor › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/pullup.py -- entrada.blend salida.blend
Es una base: hombros (escápulas), cabeza, piernas y el recorrido entre claves se retocan a mano en Blender.
La barra fija es el control BARRA (con la barra visible a la altura de la barra fija); las manos cuelgan de ella.
"""
import math
from mathutils import Vector, Matrix

META = ('pullup', 'hang', 'Dominada')
DEG = math.pi / 180
PARAMS = {
    'BAR_Z':      (2.30, 2.0, 2.6, 'Altura de la barra fija (m)'),
    'GRIP_HALF':  (0.30, 0.18, 0.45, 'Agarre, media anchura (m)'),
    'TRUNK_LOW':  (-3.0, -15.0, 10.0, 'Tronco colgado (°, + hacia delante)'),
    'TRUNK_TOP':  (-15.0, -35.0, 5.0, 'Tronco arriba (°)'),
    'SH_TOP_Z':   (0.07, 0.05, 0.25, 'Hombros arriba, bajo la barra (m)'),
    'SH_TOP_F':   (-0.07, -0.15, 0.05, 'Hombros arriba, delante de la barra (m)'),
    'LEG_F':      (0.06, -0.10, 0.30, 'Pies por delante de la cadera (m)'),
    'KNEE':       (8.0, 0.0, 90.0, 'Flexión de rodilla (°)'),
    'STANCE_X':   (0.09, 0.03, 0.20, 'Tobillos, media anchura (m)'),
}
# mano por encima de la cabeza, agarre prono: el eje de la mano (en reposo +X / −X) apunta arriba y la palma mira delante (−Y)
HANG_OVER = {'L': Matrix(((0, 1, 0), (0, 0, 1), (1, 0, 0))), 'R': Matrix(((0, -1, 0), (0, 0, 1), (-1, 0, 0)))}


def frames(F, p):
    bar = F.W(0.0, p['BAR_Z'])
    L = F.arm_len('L') * 0.995                          # brazo casi recto (el IK no se bloquea del todo)
    dx = p['GRIP_HALF'] - F.H('DEF-ARM01.L').x
    d = lambda phi: F.trunk_R(phi) @ (F.shMid - F.hipMid)     # cadera -> hombros (mundo)

    def pose(sh_f, sh_z, phi):
        def posar():
            F.set_props(hand_parent=5, foot_parent=0, bar_in_hands=0); F.hide_machine()
            F.place_bar(0.0, p['BAR_Z'])
            hip = F.W(sh_f, sh_z) - d(phi)                   # la cadera, desde los hombros y el tronco
            hf, hz = F.sagittal(hip)
            F.place_trunk(hf, hz, phi)
            # piernas colgando bajo la cadera, un poco por delante, con la rodilla algo flexionada
            reach = math.sqrt(F.Lt ** 2 + F.Ls ** 2 + 2 * F.Lt * F.Ls * math.cos(p['KNEE'] * DEG))
            leg = F.hipMid - F.H('DEF-FOOT.L'); drop = math.sqrt(max(1e-6, reach ** 2 - p['LEG_F'] ** 2))
            for S, sgn in (('L', 1), ('R', -1)):
                fik = f'FOOT-IK.{S}'; a = F.W(hf + p['LEG_F'], hz - drop, sgn * p['STANCE_X'])
                Rf = Matrix.Rotation(-35 * DEG, 3, 'X')    # pie colgando: punta hacia abajo
                F.setM(fik, Rf @ F.rest_rot(fik), a + Rf @ (F.H(fik) - F.H(f'DEF-FOOT.{S}')))
            # manos en la barra; codos hacia abajo y un poco atrás
            F.grip_bar(bar, p['GRIP_HALF'], HANG_OVER, pole_dir=(0, 0.3, -1))
        return posar

    # colgado: hombros bajo las manos con el brazo recto
    sh_low = (0.0, p['BAR_Z'] - math.sqrt(max(1e-6, L ** 2 - dx ** 2)))
    print(f'dominada: colgado hombros a {sh_low[1]:.2f} m · arriba {p["BAR_Z"] - p["SH_TOP_Z"]:.2f} m')
    return [(1, pose(sh_low[0], sh_low[1], p['TRUNK_LOW'] * DEG)),
            (30, pose(p['SH_TOP_F'], p['BAR_Z'] - p['SH_TOP_Z'], p['TRUNK_TOP'] * DEG))]


if __name__ == '__main__':
    import bpy, sys, os, importlib, types
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None
    if argv: bpy.ops.wm.open_mainfile(filepath=argv[0])
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, here if os.path.exists(os.path.join(here, 'ffpose.py')) else os.path.dirname(bpy.data.filepath))
    import ffpose as F
    importlib.reload(F)
    F.run(types.SimpleNamespace(META=META, PARAMS=PARAMS, frames=frames))
    bpy.context.scene.frame_set(30)
    if argv: bpy.ops.wm.save_as_mainfile(filepath=argv[1]); print('SAVED', argv[1])
