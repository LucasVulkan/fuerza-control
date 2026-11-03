"""Peso muerto convencional (tipo de base `hinge`): acción `deadlift` con inicio (barra en el suelo) y final (bloqueo).

Tres formas de usarlo:
  - Panel FormFit (barra lateral N del visor 3D, tras ejecutar blender/ff_panel.py): un deslizador por ajuste, en vivo.
  - Text Editor › Open › este archivo › Run Script (Alt+P): recrea la acción en el archivo abierto, sin guardar.
  - Terminal:  blender -b --factory-startup --python blender/ejercicios/deadlift.py -- entrada.blend salida.blend
Si la acción ya tiene ajustes guardados (los del panel), se usan esos; si no, los de PARAMS.

La pose sale de la geometría del maniquí, no de rotaciones a mano:
  - barra sobre el mediopié; en el suelo, con el centro a la altura del radio del disco;
  - brazos rectos y casi verticales, hombros un poco por delante de la barra;
  - la cadera sale de cruzar muslo (desde la rodilla) y tronco (desde los hombros);
  - al final, de pie y erguido, con la barra apoyada en la cara delantera del muslo.
Es una base: los retoques finos (espalda, cabeza, escápulas) se hacen a mano en Blender.
"""
import math
from mathutils import Vector

META = ('deadlift', 'hinge', 'Peso muerto')      # acción, tipo de base, nombre visible
DEG = math.pi / 180
# ajuste: (valor, mínimo, máximo, etiqueta)   — metros salvo los marcados en grados
PARAMS = {
    'STANCE_X':    (0.11, 0.06, 0.30, 'Tobillos, media anchura (m)'),
    'TOE_OUT':     (8.0, -5.0, 30.0, 'Puntas hacia fuera (°)'),
    'GRIP_HALF':   (0.26, 0.18, 0.45, 'Agarre, media anchura (m)'),
    'SHIN_START':  (8.0, 0.0, 20.0, 'Tibia al empezar (°)'),
    'SH_AHEAD':    (0.02, -0.04, 0.10, 'Hombros por delante de la barra (m)'),
    'BAR_F':       (0.061, 0.02, 0.12, 'Barra delante del tobillo (m)'),
    'SHIN_END':    (3.0, 0.0, 12.0, 'Tibia al bloquear (°)'),
    'HIP_END_F':   (-0.02, -0.12, 0.06, 'Cadera al bloquear, delante del tobillo (m)'),
    'THIGH_FRONT': (0.08, 0.04, 0.12, 'Grosor del muslo delante del fémur (m)'),
}


def frames(F, p):
    """Calcula la geometría con los ajustes `p` y devuelve [(frame, posar)]."""
    BAR_F = p['BAR_F']
    L = F.arm_len('L') * 0.995                     # brazo casi recto (el IK no se bloquea del todo)
    dx = p['GRIP_HALF'] - F.H('DEF-ARM01.L').x
    d = lambda phi: F.trunk_R(phi) @ (F.shMid - F.hipMid)     # cadera -> hombros (mundo)
    knee = lambda th: Vector((F.Ls * math.sin(th), F.ankleH + F.Ls * math.cos(th)))    # (f, z)

    def bisect(fn, a, b, n=60):
        fa = fn(a)
        for _ in range(n):
            m = (a + b) / 2; fm = fn(m)
            if (fa < 0) == (fm < 0): a, fa = m, fm
            else: b = m
        return (a + b) / 2

    # ---- inicio: barra en el suelo; hombros sobre ella con el brazo recto; la cadera donde se cruzan muslo y tronco
    bar0 = Vector((BAR_F, F.PLATE_R))
    sh0 = Vector((BAR_F + p['SH_AHEAD'], F.PLATE_R + math.sqrt(max(1e-6, L ** 2 - dx ** 2 - p['SH_AHEAD'] ** 2))))
    k0 = knee(p['SHIN_START'] * DEG)
    hip_at = lambda phi: Vector((sh0.x + d(phi).y, sh0.y - d(phi).z))   # d.y es -f
    phi0 = bisect(lambda ph: (hip_at(ph) - k0).length - F.Lt, 5 * DEG, 89 * DEG)
    hip0 = hip_at(phi0)

    # ---- final: de pie y erguido; la barra apoya en la cara delantera del muslo, con los brazos un poco hacia delante
    k1 = knee(p['SHIN_END'] * DEG)
    a1 = math.asin(max(-1, min(1, (k1.x - p['HIP_END_F']) / F.Lt)))
    hip1 = k1 + Vector((-F.Lt * math.sin(a1), F.Lt * math.cos(a1)))
    phi1 = F.trunk_rest + 2 * DEG
    sh1 = hip1 + Vector((-d(phi1).y, d(phi1).z))
    bar1 = Vector((BAR_F, sh1.y - L))
    for _ in range(5):                              # la barra toca el muslo a su altura (el muslo va de la cadera a la rodilla)
        t = (hip1.y - bar1.y) / (hip1.y - k1.y)
        bar1.x = hip1.x + t * (k1.x - hip1.x) + p['THIGH_FRONT'] + 0.014
        bar1.y = sh1.y - math.sqrt(max(1e-6, L ** 2 - dx ** 2 - (bar1.x - sh1.x) ** 2))

    print(f'peso muerto: inicio tronco {phi0 / DEG:.0f}° · cadera z {hip0.y:.2f} (rodilla {k0.y:.2f}) · '
          f'final tronco {phi1 / DEG:.0f}° · barra z {bar1.y:.2f}')

    def pose(hip, phi, bar, hang):
        def posar():
            F.set_props(hand_parent=5, foot_parent=0, bar_in_hands=1); F.hide_machine()
            F.place_feet(p['STANCE_X'], p['TOE_OUT'])
            F.place_trunk(hip.x, hip.y, phi)
            if hang:   # al bloquear la barra cuelga de los hombros reales del rig, con la muñeca justo al alcance
                bar.y = F.hang_bar(bar.x, p['GRIP_HALF'], F.HANG_PRONE)
            F.place_bar(bar.x, bar.y)
            F.grip_bar(F.W(bar.x, bar.y), p['GRIP_HALF'], F.HANG_PRONE, pole_dir=(0, 1, 0))
        return posar
    return [(1, pose(hip0, phi0, bar0, False)), (30, pose(hip1, phi1, bar1, True))]


if __name__ == '__main__':
    import bpy, sys, os, importlib, types
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None     # None = desde el Text Editor
    if argv: bpy.ops.wm.open_mainfile(filepath=argv[0])
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))           # blender/ (ejecutado desde la terminal)
    sys.path.insert(0, here if os.path.exists(os.path.join(here, 'ffpose.py')) else os.path.dirname(bpy.data.filepath))   # o junto al .blend
    import ffpose as F
    importlib.reload(F)                                                           # por si ffpose.py cambió
    F.run(types.SimpleNamespace(META=META, PARAMS=PARAMS, frames=frames))
    bpy.context.scene.frame_set(30)
    if argv: bpy.ops.wm.save_as_mainfile(filepath=argv[1]); print('SAVED', argv[1])
