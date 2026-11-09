"""Flexiones (spec X03-05): acción `push_up`, tipo de base `libre` (la animación tal cual) hasta que exista `floor` (X03-07).
Frame 1: arriba, brazos rectos con las manos bajo los hombros; frame 30: abajo, el pecho cerca del suelo y los codos a ~45°
del tronco. El cuerpo, en línea recta del tobillo al hombro, apoyado en las puntas de los pies.

Se usa igual que deadlift.py: panel FormFit, Text Editor › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/push_up.py -- entrada.blend salida.blend
Es una base: manos (palma plana), cabeza, escápulas y la línea del cuerpo se retocan a mano en Blender.
"""
import math
from mathutils import Matrix

META = ('push_up', 'libre', 'Flexiones')
DEG = math.pi / 180
PARAMS = {
    'HAND_HALF':  (0.24, 0.15, 0.40, 'Manos, media anchura (m)'),
    'WRIST_Z':    (0.04, 0.02, 0.08, 'Muñeca sobre el suelo (m)'),
    'SH_LOW_Z':   (0.19, 0.12, 0.30, 'Hombros abajo, sobre el suelo (m)'),
    'SH_LOW_F':   (0.10, -0.05, 0.18, 'Hombros abajo, por delante de las manos (m)'),
    'FOOT_PITCH': (62.0, 30.0, 85.0, 'Pie (°; + = punta abajo, apoyado en los dedos)'),
    'STANCE_X':   (0.09, 0.03, 0.20, 'Tobillos, media anchura (m)'),
}
# palma abajo y dedos hacia delante: el eje de la mano (en reposo +X / −X) apunta delante (−Y)
FLAT_FWD = {'L': Matrix.Rotation(-90 * DEG, 3, 'Z'), 'R': Matrix.Rotation(90 * DEG, 3, 'Z')}


def frames(F, p):
    R = (F.H('DEF-HAND.L') - F.H('DEF-ARM01.L')).length * 0.99     # hombro -> muñeca con el brazo casi recto
    dx = p['HAND_HALF'] - F.H('DEF-ARM01.L').x
    Ltr = (F.shMid - F.hipMid).length; Lleg = (F.Lt + F.Ls) * 0.995
    Rf = Matrix.Rotation(p['FOOT_PITCH'] * DEG, 3, 'X')
    ankle_z = 0.012 - (Rf @ F.TOE).z                               # la punta del pie en el suelo

    def pose(sh_f, sh_z):
        # cuerpo recto: tronco y piernas en la misma línea, del tobillo (en el suelo, de puntillas) al hombro
        phi = math.acos(max(-1, min(1, (sh_z - ankle_z) / (Ltr + Lleg))))
        hip_f, hip_z = sh_f - Ltr * math.sin(phi), sh_z - Ltr * math.cos(phi)
        ank_f = sh_f - (Ltr + Lleg) * math.sin(phi)

        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_trunk(hip_f, hip_z, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                F.place_foot(S, ank_f, ankle_z, sgn * p['STANCE_X'], p['FOOT_PITCH'], knee=(ank_f / 2 + hip_f / 2, -0.5, sgn * 0.15))
                F.place_hand(S, F.W(0.0, p['WRIST_Z'], sgn * p['HAND_HALF']), FLAT_FWD[S], pole_dir=(0, 0.4, 0.6), curl=0)
        print(f'flexiones: hombros z {sh_z:.2f} · cuerpo a {90 - phi / DEG:.0f}° del suelo · tobillo f {ank_f:.2f} z {ankle_z:.2f}')
        return posar

    top_z = p['WRIST_Z'] + math.sqrt(max(1e-6, R ** 2 - dx ** 2))
    return [(1, pose(0.0, top_z)), (30, pose(p['SH_LOW_F'], p['SH_LOW_Z']))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'palma_plana'; act['ff_plan'] = 'floor'


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
