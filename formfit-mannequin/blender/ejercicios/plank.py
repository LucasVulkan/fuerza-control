"""Plancha sobre antebrazos (ola 3): acción `plank`, en `libre` (base prevista: `floor`).
Ejercicio estático: codos bajo los hombros, antebrazos en el suelo hacia delante, el cuerpo recto de los hombros a las puntas
de los pies. Frame 1 y frame 30 son la misma pose (si hace falta, el usuario puede añadir un leve vaivén).

  blender -b --factory-startup --python blender/ejercicios/plank.py -- entrada.blend salida.blend
Es una base: cadera (ni hundida ni alta), cabeza, escápulas y manos se retocan a mano en Blender.
"""
import math
from mathutils import Matrix

META = ('plank', 'libre', 'Plancha')
DEG = math.pi / 180
PARAMS = {
    'ELBOW_X':    (0.11, 0.06, 0.18, 'Codos, media anchura (m)'),
    'ELBOW_Z':    (0.05, 0.03, 0.08, 'Codo (articulación) sobre el suelo (m)'),
    'FOOT_PITCH': (62.0, 30.0, 85.0, 'Pie (°; + = punta abajo, apoyado en los dedos)'),
    'STANCE_X':   (0.09, 0.03, 0.20, 'Tobillos, media anchura (m)'),
}
FLAT_FWD = {'L': Matrix.Rotation(-90 * DEG, 3, 'Z'), 'R': Matrix.Rotation(90 * DEG, 3, 'Z')}   # palma abajo, dedos delante


def frames(F, p):
    Lu = (F.H('DEF-FORARM01.L') - F.H('DEF-ARM01.L')).length; Lf = (F.H('DEF-HAND.L') - F.H('DEF-FORARM01.L')).length
    sh_z = p['ELBOW_Z'] + Lu * 0.995
    Ltr = (F.shMid - F.hipMid).length; Lleg = (F.Lt + F.Ls) * 0.995
    Rf = Matrix.Rotation(p['FOOT_PITCH'] * DEG, 3, 'X')
    ankle_z = 0.012 - (Rf @ F.TOE).z
    phi = math.acos(max(-1, min(1, (sh_z - ankle_z) / (Ltr + Lleg))))
    hip_f, hip_z = -Ltr * math.sin(phi), sh_z - Ltr * math.cos(phi)
    ank_f = -(Ltr + Lleg) * math.sin(phi)
    print(f'plancha: hombros z {sh_z:.2f} · cuerpo a {90 - phi / DEG:.0f}° del suelo')

    def posar():
        F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
        F.place_trunk(hip_f, hip_z, phi)
        for S, sgn in (('L', 1), ('R', -1)):
            F.place_foot(S, ank_f, ankle_z, sgn * p['STANCE_X'], p['FOOT_PITCH'], knee=(ank_f / 2 + hip_f / 2, -0.5, sgn * 0.15))
            F.place_hand(S, F.W(Lf * 0.99, p['ELBOW_Z'], sgn * p['ELBOW_X']), FLAT_FWD[S], pole_dir=(sgn * 0.2, 0.3, -1), curl=-40)
    return [(1, posar), (30, posar)]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'palma_plana'; act['ff_plan'] = 'floor'
    act['ff_apoyos'] = 'mano.L+mano.R;pie.L+pie.R'; act['ff_carga'] = 'ninguna'; act['ff_carga_pc'] = 0


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
