"""Elevación de gemelos de pie (ola 3): acción `calf_raise`, en `libre` (base prevista: `stand`).
De pie con mancuernas a los lados (en máquina, la carga va en los hombros: variante). Frame 1: talones en el suelo; frame 30:
de puntillas, el pie girado `RISE` grados alrededor de las puntas, y todo el cuerpo sube con los tobillos.
Sin escalón todavía (con escalón el talón baja por debajo de las puntas al empezar).

  blender -b --factory-startup --python blender/ejercicios/calf_raise.py -- entrada.blend salida.blend
Es una base: pies, rodillas (casi rectas) y brazos se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('calf_raise', 'libre', 'Elevación de gemelos')
DEG = math.pi / 180
PARAMS = {
    'STANCE_X':   (0.12, 0.08, 0.20, 'Tobillos, media anchura (m)'),
    'RISE':       (35.0, 20.0, 50.0, 'Arriba: pie girado sobre las puntas (°)'),
}


def frames(F, p):
    NEU = {'L': Matrix.Rotation(90 * DEG, 3, 'Z') @ F.HANG_PRONE['L'], 'R': Matrix.Rotation(-90 * DEG, 3, 'Z') @ F.HANG_PRONE['R']}
    R = (F.H('DEF-HAND.L') - F.H('DEF-ARM01.L')).length * 0.98
    tip = Vector((-F.TOE.y, F.ankleH + F.TOE.z))                   # punta del pie en el suelo (f, z) con el tobillo en f 0

    def pose(pitch):
        v = Matrix.Rotation(pitch * DEG, 3, 'X') @ F.TOE
        ank = tip - Vector((-v.y, v.z))
        hip = Vector((ank.x - 0.02, ank.y + (F.Lt + F.Ls) * 0.995))

        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            for S, sgn in (('L', 1), ('R', -1)):
                F.place_foot(S, ank.x, ank.y, sgn * p['STANCE_X'], pitch, 5, knee=(0.8, 0.5, sgn * p['STANCE_X']))
            F.place_trunk(hip.x, hip.y, F.trunk_rest)
            for S, sgn in (('L', 1), ('R', -1)):
                sh = F.pb[f'DEF-ARM01.{S}'].head.copy()
                F.place_hand(S, sh + Vector((sgn * 0.04, -0.02, -R)), NEU[S], pole_dir=(0, 1, 0))
        print(f'gemelos: pie {pitch:.0f}° · tobillo f {ank.x:.3f} z {ank.y:.3f}')
        return posar
    return [(1, pose(0.0)), (30, pose(p['RISE']))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = '28'; act['ff_plan'] = 'stand'
    act['ff_apoyos'] = 'pie.L+pie.R'; act['ff_carga'] = 'manos'; act['ff_carga_pc'] = 40


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
