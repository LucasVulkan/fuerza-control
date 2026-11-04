"""Remo con barra (tipo de base `row`): acción `barbell_row`. Tronco fijo a `TRUNK` (55°) y piernas como en el rumano; solo se
mueven los brazos. Frame 1: brazos colgando, rectos, con la barra bajo los hombros; frame 30: la barra contra el ombligo,
con los codos atrás. Agarre prono.

Se usa igual que deadlift.py: panel FormFit, Text Editor › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/barbell_row.py -- entrada.blend salida.blend
Es una base: escápulas, cabeza, codos y el recorrido entre claves se retocan a mano en Blender.
"""
import math
from mathutils import Vector

META = ('barbell_row', 'row', 'Remo con barra')
DEG = math.pi / 180
PARAMS = {
    'STANCE_X':    (0.12, 0.06, 0.30, 'Tobillos, media anchura (m)'),
    'TOE_OUT':     (5.0, -5.0, 30.0, 'Puntas hacia fuera (°)'),
    'GRIP_HALF':   (0.28, 0.18, 0.45, 'Agarre, media anchura (m)'),
    'TRUNK':       (55.0, 15.0, 80.0, 'Inclinación del tronco (°)'),
    'SHIN':        (6.0, 0.0, 15.0, 'Tibia (°)'),
    'BAR_F':       (0.15, 0.04, 0.20, 'Barra abajo delante del tobillo, bajo los hombros (m; 0,061 = mediopié)'),
    'BAR_TO':      (0.30, 0.05, 0.40, 'Barra arriba (ombligo): bajo la línea de hombros, por el tronco (m)'),
    'CHEST_FRONT': (0.11, 0.06, 0.20, 'Grosor del tronco delante de la línea cadera-hombro (m)'),
}


def frames(F, p):
    F.socket('L')                                                 # mide el puño antes de posar (medir pone el rig en reposo)
    phi, th = p['TRUNK'] * DEG, p['SHIN'] * DEG
    # abajo la barra cuelga sobre el mediopié con los brazos verticales: los hombros quedan encima y la cadera, detrás a lo que
    # mida el tronco; la rodilla sale de llegar a esa cadera con el muslo (la cadera, sobre el círculo del muslo)
    knee = Vector((F.Ls * math.sin(th), F.ankleH + F.Ls * math.cos(th)))        # (f, z)
    d = F.trunk_R(phi) @ (F.shMid - F.hipMid)                     # cadera -> hombros (mundo)
    hip_f = p['BAR_F'] + d.y                      # d.y es -f
    dx = max(-F.Lt * 0.99, min(F.Lt * 0.99, hip_f - knee.x))
    hip = Vector((hip_f, knee.y + math.sqrt(F.Lt ** 2 - dx ** 2)))
    sh = hip + Vector((-d.y, d.z))
    print(f'remo: rodilla {(math.asin(-dx / F.Lt) + th) / DEG:.0f}°')
    u = Vector((math.sin(phi), math.cos(phi))); n = Vector((math.cos(phi), -math.sin(phi)))   # tronco arriba · pecho (delante)
    top = sh - u * p['BAR_TO'] + n * (p['CHEST_FRONT'] + 0.015)   # barra contra el tronco (radio de la barra 1,5 cm)
    print(f'remo: cadera f {hip.x:.2f} z {hip.y:.2f} · hombros f {sh.x:.2f} z {sh.y:.2f} · barra arriba f {top.x:.2f} z {top.y:.2f}')

    def pose(hang):
        def posar():
            F.set_props(hand_parent=5, foot_parent=0, bar_in_hands=1); F.hide_machine()
            F.place_feet(p['STANCE_X'], p['TOE_OUT'])
            F.place_trunk(hip.x, hip.y, phi)
            bf, bz = (sh.x, F.hang_bar(sh.x, p['GRIP_HALF'], F.HANG_PRONE)) if hang else (top.x, top.y)
            F.place_bar(bf, bz)
            F.grip_bar(F.W(bf, bz), p['GRIP_HALF'], F.HANG_PRONE, pole_dir=(0, 1, 0.2))
            if hang: print(f'  barra abajo f {bf:.2f} z {bz:.2f} (tobillo en f 0)')
        return posar
    return [(1, pose(True)), (30, pose(False))]


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
