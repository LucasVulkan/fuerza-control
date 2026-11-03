"""Peso muerto convencional (tipo de base `hinge`): crea la acción `deadlift` con inicio (barra en el suelo) y final (bloqueo).

Uso:  blender -b --factory-startup --python blender/ejercicios/deadlift.py -- entrada.blend salida.blend
La pose sale de la geometría del maniquí, no de rotaciones a mano:
  - barra sobre el mediopié; en el suelo, con el centro a la altura del radio del disco;
  - brazos rectos y casi verticales, hombros un poco por delante de la barra;
  - la cadera sale de cruzar muslo (desde la rodilla) y tronco (desde los hombros);
  - al final, de pie: tibia casi vertical, hombros justo encima de la barra.
Es una base: los retoques finos (espalda, cabeza, escápulas) se hacen a mano en Blender.
"""
import bpy, sys, os, math
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=argv[0])
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import ffpose as F
from mathutils import Vector

DEG = math.pi / 180
STANCE_X = 0.11          # tobillos a ±11 cm (anchura de cadera)
TOE_OUT = 8              # puntas hacia fuera, grados
GRIP_HALF = 0.26         # manos a ±26 cm: justo por fuera de las piernas
SHIN_START = 8 * DEG     # tibia al empezar: la espinilla roza la barra (asoma 3,9 cm por delante del hueso a esa altura)
SHIN_END = 3 * DEG       # tibia al bloquear
SH_AHEAD = 0.02          # hombros por delante de la barra al empezar (m)
BAR_F = 0.061            # mediopié: mitad del pie (talón a -6,9 cm y punta a +19,2 cm del tobillo, medidos en la malla)
THIGH_FRONT = 0.08       # el muslo asoma ~8 cm por delante del fémur: al bloquear la barra apoya ahí
HIP_END_F = -0.02        # al bloquear, cadera 2 cm por detrás del tobillo, tronco erguido
L = {S: F.arm_len(S) * 0.995 for S in 'LR'}   # brazo casi recto (el IK no se bloquea del todo)
dx = GRIP_HALF - F.H('DEF-ARM01.L').x


def knee(th): return Vector((F.Ls * math.sin(th), F.ankleH + F.Ls * math.cos(th)))       # (f, z)


def bisect(fn, a, b, n=60):
    fa = fn(a)
    for _ in range(n):
        m = (a + b) / 2; fm = fn(m)
        if (fa < 0) == (fm < 0): a, fa = m, fm
        else: b = m
    return (a + b) / 2


def hip_from_shoulder(sh, phi):
    """Cadera (f, z) que deja los hombros en `sh` con el tronco a `phi`."""
    d = F.trunk_R(phi) @ (F.shMid - F.hipMid)
    return Vector((sh.x + d.y, sh.y - d.z))   # d.y es -f


# ---- inicio: barra en el suelo
bar0 = Vector((BAR_F, F.PLATE_R))
sh0 = Vector((BAR_F + SH_AHEAD, F.PLATE_R + math.sqrt(L['L'] ** 2 - dx ** 2 - SH_AHEAD ** 2)))
k0 = knee(SHIN_START)
phi0 = bisect(lambda p: (hip_from_shoulder(sh0, p) - k0).length - F.Lt, 20 * DEG, 85 * DEG)
hip0 = hip_from_shoulder(sh0, phi0)

# ---- final: de pie y erguido; la barra apoya en la cara delantera del muslo, con los brazos un poco hacia delante
k1 = knee(SHIN_END)
a1 = math.asin((k1.x - HIP_END_F) / F.Lt)
hip1 = k1 + Vector((-F.Lt * math.sin(a1), F.Lt * math.cos(a1)))
phi1 = F.trunk_rest + 2 * DEG
d1 = F.trunk_R(phi1) @ (F.shMid - F.hipMid); sh1 = hip1 + Vector((-d1.y, d1.z))
bar1 = Vector((BAR_F, sh1.y - L['L']))
for _ in range(5):                      # la barra toca el muslo a su altura (el muslo va de la cadera a la rodilla)
    t = (hip1.y - bar1.y) / (hip1.y - k1.y)
    bar1.x = hip1.x + t * (k1.x - hip1.x) + THIGH_FRONT + 0.014
    bar1.y = sh1.y - math.sqrt(L['L'] ** 2 - dx ** 2 - (bar1.x - sh1.x) ** 2)

print(f'peso muerto: inicio tronco {phi0 / DEG:.0f}° · cadera z {hip0.y:.2f} (rodilla {k0.y:.2f}) · final tronco {phi1 / DEG:.0f}° · barra z {bar1.y:.2f}')

act = F.new_action('deadlift', 'hinge', 'Peso muerto')
for frame, hip, phi, bar in ((1, hip0, phi0, bar0), (30, hip1, phi1, bar1)):
    F.reset(); F.set_props(hand_parent=5, foot_parent=0); F.hide_machine()
    F.place_feet(STANCE_X, TOE_OUT)
    F.place_trunk(hip.x, hip.y, phi)
    F.place_bar(bar.x, bar.y)
    F.grip_bar(F.W(bar.x, bar.y), GRIP_HALF, F.HANG_PRONE, pole_dir=(0, 1, 0))
    F.report(f'frame {frame}')
    F.key(frame)
F.finish(act)
bpy.context.scene.frame_set(30)
bpy.ops.wm.save_as_mainfile(filepath=argv[1]); print('SAVED', argv[1])
