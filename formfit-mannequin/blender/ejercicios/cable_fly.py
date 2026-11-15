"""Cruce de poleas (ola 3): acción `cable_fly`, en `libre` (base prevista: polea doble, de pie).
De pie entre dos poleas altas (a los lados, `ff_pulley` con x), tronco algo inclinado. Frame 1: brazos abiertos en cruz,
codos algo flexionados, palmas delante; frame 30: manos juntas delante y por debajo del pecho, palmas enfrentadas.

  blender -b --factory-startup --python blender/ejercicios/cable_fly.py -- entrada.blend salida.blend
Es una base: codos (ángulo fijo durante el gesto), escápulas, pies (uno adelantado) y tronco se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('cable_fly', 'libre', 'Cruce de poleas')
DEG = math.pi / 180
PARAMS = {
    'STANCE_X':   (0.14, 0.08, 0.25, 'Tobillos, media anchura (m)'),
    'TRUNK':      (15.0, 0.0, 30.0, 'Inclinación del tronco (°)'),
    'BEND':       (0.95, 0.90, 0.99, 'Brazo: alcance hombro-muñeca (fracción, codo algo flexionado)'),
    'OPEN_BACK':  (10.0, 0.0, 25.0, 'Inicio: brazos por detrás del plano de los hombros (°)'),
    'END_F':      (0.42, 0.30, 0.55, 'Final: manos por delante de los hombros (m)'),
    'END_DOWN':   (0.22, 0.05, 0.40, 'Final: manos bajo los hombros (m)'),
    'PULLEY_Z':   (2.10, 1.60, 2.40, 'Poleas, altura (m)'),
}


def frames(F, p):
    phi = p['TRUNK'] * DEG
    hip = Vector((-0.06, F.ankleH + (F.Lt + F.Ls) * 0.99))
    R = (F.H('DEF-HAND.L') - F.H('DEF-ARM01.L')).length * p['BEND']
    b = p['OPEN_BACK'] * DEG

    def pose(end):
        def posar():
            F.set_props(hand_parent=0, foot_parent=0, bar_in_hands=0); F.hide_machine(); F.hide_bar()
            F.place_feet(p['STANCE_X'], 8)
            F.place_trunk(hip.x, hip.y, phi)
            for S, sgn in (('L', 1), ('R', -1)):
                sh = F.pb[f'DEF-ARM01.{S}'].head.copy()
                if end:
                    F.place_hand(S, sh + Vector((-sgn * (sh.x * sgn - 0.06), -p['END_F'], -p['END_DOWN'])),
                                 F.hand_frame(S, (0, -1, -0.3), (-sgn, 0, 0)), pole_dir=(sgn * 1, 0.3, 0.3))
                else:
                    dirv = Vector((sgn * math.cos(b), math.sin(b), 0.05))
                    F.place_hand(S, sh + dirv.normalized() * R, Matrix.Rotation(-90 * DEG, 3, 'X'), pole_dir=(sgn * 0.3, 0.5, -1))
        return posar
    return [(1, pose(False)), (30, pose(True))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'asa'; act['ff_plan'] = 'cable'
    act['ff_pulley'] = [0.0, p['PULLEY_Z'], 1.0]                    # [f, z, x]: una a cada lado (simétrica)
    act['ff_apoyos'] = 'pie.L+pie.R'; act['ff_carga'] = 'manos'; act['ff_carga_pc'] = 20


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
