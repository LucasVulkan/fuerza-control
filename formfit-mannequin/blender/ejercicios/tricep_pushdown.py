"""Extensión de tríceps en polea alta (ola 2): acción `tricep_pushdown`, en `libre` (base prevista: polea de pie).
De pie, el tronco algo inclinado, codos pegados al costado; maneral = barra recta corta (la barra sin discos). Frame 1:
antebrazos subidos (codo a ~`ELBOW_START`°); frame 30: brazos rectos, la barra delante de los muslos.
La polea queda arriba y delante (`ff_pulley`), para cuando haya base de polea de pie.

  blender -b --factory-startup --python blender/ejercicios/tricep_pushdown.py -- entrada.blend salida.blend
Es una base: codos, muñecas y tronco se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('tricep_pushdown', 'libre', 'Extensión de tríceps en polea')
DEG = math.pi / 180
PARAMS = {
    'STANCE_X':    (0.13, 0.08, 0.25, 'Tobillos, media anchura (m)'),
    'TRUNK':       (12.0, 0.0, 30.0, 'Inclinación del tronco (°)'),
    'GRIP_HALF':   (0.12, 0.06, 0.20, 'Agarre, media anchura (m)'),
    'ELBOW_START': (100.0, 70.0, 130.0, 'Arriba: flexión del codo (°)'),
    'ELBOW_F':     (0.04, -0.02, 0.10, 'Codo por delante del hombro (m)'),
    'PULLEY_Z':    (2.10, 1.80, 2.40, 'Polea, altura (m)'),
}
# mano sobre la barra con el antebrazo horizontal: eje hacia delante y palma abajo; al bajar gira con el antebrazo
FWD = {'L': Matrix.Rotation(-90 * DEG, 3, 'Z'), 'R': Matrix.Rotation(90 * DEG, 3, 'Z')}


def frames(F, p):
    F.socket('L')
    phi = p['TRUNK'] * DEG
    d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
    hip = Vector((-0.06, F.ankleH + (F.Lt + F.Ls) * 0.99 * math.cos(math.asin(0.06 / (F.Lt + F.Ls)))))   # cadera algo atrás para compensar
    sh = hip + Vector((-d.y, d.z))
    Lu = (F.H('DEF-FORARM01.L') - F.H('DEF-ARM01.L')).length; Lf = (F.H('DEF-HAND.L') - F.H('DEF-FORARM01.L')).length
    elbow = sh + Vector((p['ELBOW_F'], -math.sqrt(max(1e-6, Lu ** 2 - p['ELBOW_F'] ** 2))))

    def bar_at(theta):   # theta: ángulo del antebrazo bajo la horizontal (90 = vertical)
        hand = {S: Matrix.Rotation(theta, 3, 'X') @ FWD[S] for S in 'LR'}
        wrist = elbow + Lf * Vector((math.cos(theta), -math.sin(theta)))
        v = hand['L'] @ F.socket('L')
        return wrist + Vector((-v.y, v.z)), hand
    th0 = (90 - p['ELBOW_START']) * DEG          # flexión del codo (0 = recto) -> antebrazo bajo la horizontal
    b0, h0 = bar_at(th0); b1, h1 = bar_at(85 * DEG)
    print(f'tríceps polea: codo z {elbow.y:.2f} · barra arriba f {b0.x:.2f} z {b0.y:.2f} · abajo f {b1.x:.2f} z {b1.y:.2f}')

    def pose(bar, hand):
        def posar():
            F.set_props(hand_parent=5, foot_parent=0, bar_in_hands=0, discs=0); F.hide_machine()
            F.place_feet(p['STANCE_X'], 5)
            F.place_trunk(hip.x, hip.y, phi)
            F.place_bar(bar.x, bar.y)
            F.grip_bar(F.W(bar.x, bar.y), p['GRIP_HALF'], hand, pole_dir=(0, 1, -0.3))
        return posar
    return [(1, pose(b0, h0)), (30, pose(b1, h1))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'barra_recta'; act['ff_plan'] = 'cable'
    act['ff_pulley'] = [0.30, p['PULLEY_Z']]
    act['ff_apoyos'] = 'pie.L+pie.R'; act['ff_carga'] = 'manos'; act['ff_carga_pc'] = 25


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
