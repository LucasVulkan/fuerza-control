"""Curl de bíceps con barra (ola 2): acción `barbell_curl`, en `libre` (base prevista: `stand`).
De pie y erguido, agarre supino. Frame 1: barra colgando delante de los muslos con los brazos rectos; frame 30: arriba, el
codo pegado al costado y un poco adelantado, el antebrazo subido `ELBOW_TOP` grados.

  blender -b --factory-startup --python blender/ejercicios/barbell_curl.py -- entrada.blend salida.blend
Es una base: codos, muñecas y escápulas se retocan a mano en Blender.
"""
import math
from mathutils import Vector, Matrix

META = ('barbell_curl', 'libre', 'Curl con barra')
DEG = math.pi / 180
PARAMS = {
    'STANCE_X':   (0.12, 0.08, 0.25, 'Tobillos, media anchura (m)'),
    'GRIP_HALF':  (0.20, 0.14, 0.30, 'Agarre, media anchura (m)'),
    'ELBOW_TOP':  (140.0, 110.0, 155.0, 'Arriba: flexión del codo (°)'),
    'ELBOW_F':    (0.06, 0.0, 0.15, 'Arriba: codo por delante del hombro (m)'),
}


def frames(F, p):
    F.socket('L')
    SUP = {S: Matrix.Rotation(math.pi, 3, 'Z') @ F.HANG_PRONE[S] for S in 'LR'}   # colgando con la palma hacia delante
    phi = F.trunk_rest
    hip = Vector((0.0, F.ankleH + (F.Lt + F.Ls) * 0.995))
    d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
    sh = hip + Vector((-d.y, d.z))
    Lu = (F.H('DEF-FORARM01.L') - F.H('DEF-ARM01.L')).length; Lf = (F.H('DEF-HAND.L') - F.H('DEF-FORARM01.L')).length
    th = p['ELBOW_TOP'] * DEG
    elbow = sh + Vector((p['ELBOW_F'], -math.sqrt(max(1e-6, Lu ** 2 - p['ELBOW_F'] ** 2))))
    wrist = elbow + Lf * Vector((math.sin(th), -math.cos(th)))
    hand_top = {S: Matrix.Rotation(-th, 3, 'X') @ SUP[S] for S in 'LR'}             # la mano gira con el antebrazo
    v = hand_top['L'] @ F.socket('L'); top = wrist + Vector((-v.y, v.z))
    print(f'curl: codo z {elbow.y:.2f} · barra arriba f {top.x:.2f} z {top.y:.2f}')

    def pose(hang):
        def posar():
            F.set_props(hand_parent=5, foot_parent=0, bar_in_hands=0); F.hide_machine()
            F.place_feet(p['STANCE_X'], 5)
            F.place_trunk(hip.x, hip.y, phi)
            if hang:
                bf = sh.x + 0.04; bz = F.hang_bar(bf, p['GRIP_HALF'], SUP); hand = SUP
            else:
                bf, bz, hand = top.x, top.y, hand_top
            F.place_bar(bf, bz)
            F.grip_bar(F.W(bf, bz), p['GRIP_HALF'], hand, pole_dir=(0, 1, -0.4))
        return posar
    return [(1, pose(True)), (30, pose(False))]


def setup(F, act, p):
    act['ff_status'] = 'borrador'; act['ff_mano'] = 'colgado_supino'; act['ff_plan'] = 'stand'
    act['ff_apoyos'] = 'pie.L+pie.R'; act['ff_carga'] = 'manos'; act['ff_carga_pc'] = 35


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
