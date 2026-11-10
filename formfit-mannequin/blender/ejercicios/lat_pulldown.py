"""Jalón al pecho (spec X03-05): acción `lat_pulldown` (agarre prono), tipo de base `cable` desde X03-20 (antes `libre`): la polea
arriba (`ff_pulley`: en la vertical de la barra del frame 1, 0,45 m por encima) y `ff_impl = 'barra_jalon'` (el visor no dibuja
maneral: la barra es la de la acción). Las variantes de agarre son acciones propias que salen de este mismo script: `lat_pulldown_supino.py`
y `lat_pulldown_neutro.py`.

Las manos CUELGAN DE LA BARRA (ARM_IK_parent = 5, como en la banca y la dominada): se anima el control BARRA y las manos van
con ella sin deslizarse; el codo se dobla solo lo que pida la distancia. Lo que reparte el tirón entre escápula y codo es:
  - BARRA: por dónde baja (recta, por delante de la cara);
  - SHOULDER.L/R: las escápulas (arriba en el frame 1, abajo desde el 10: la barra baja con los brazos casi rectos);
  - ARM-POLE-IK.L/R: hacia dónde van los codos;
  - TORSO: la inclinación del tronco (algo más atrás al final).
Claves: 1 = brazos estirados hacia arriba y delante, a la barra bajo la polea (`PULLEY_F`), y escápulas arriba · 10 = escápulas abajo, brazos casi rectos · 20 = barra a la altura de la
barbilla, por delante de la cara · 30 = barra en lo alto del pecho.
La barra va sin discos (PROPERTIES["DISCOS"] = 0) y el asiento es FF_banco.

Se usa igual que deadlift.py: panel FormFit, Text Editor › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/lat_pulldown.py -- entrada.blend salida.blend
"""
import math
from mathutils import Vector, Matrix

META = ('lat_pulldown', 'cable', 'Jalón al pecho')
TOP = {}   # la barra en el frame 1 (f, z), para la polea de `setup`
DEG = math.pi / 180
PARAMS = {
    'SEAT_Z':      (0.45, 0.38, 0.55, 'Asiento, altura (m)'),
    'HIP_UP':      (0.08, 0.05, 0.12, 'Cadera (articulación) sobre el asiento (m)'),
    'TRUNK_START': (-6.0, -20.0, 10.0, 'Tronco arriba (°, − hacia atrás)'),
    'TRUNK_END':   (-16.0, -35.0, 0.0, 'Tronco al tirar (°)'),
    'GRIP_HALF':   (0.40, 0.08, 0.50, 'Agarre, media anchura (m)'),
    'SCAP_UP':     (12.0, 0.0, 25.0, 'Arriba: escápulas subidas (°)'),
    'SCAP_DOWN':   (18.0, 0.0, 30.0, 'Desde el frame 10: escápulas bajadas (°)'),
    'ARMS_10':     (0.97, 0.85, 1.0, 'Frame 10: brazo (hombro-puño) respecto a recto'),
    'PULLEY_F':    (0.25, 0.10, 0.40, 'Polea delante de la cadera (m): arriba la barra cuelga de ella (se agarra por delante)'),
    'FACE_F':      (0.26, 0.15, 0.35, 'Frame 20: barra a la altura de la barbilla, delante de los hombros (m)'),
    'FACE_Z':      (0.20, 0.10, 0.30, 'Frame 20: barra sobre los hombros (m)'),
    'BAR_TO':      (0.06, 0.0, 0.15, 'Al tirar: bajo la línea de hombros, por el tronco (m)'),
    'TO_FRONT':    (0.15, 0.08, 0.25, 'Al tirar: barra delante de la línea cadera-hombro (m)'),
    'STANCE_X':    (0.18, 0.08, 0.30, 'Tobillos, media anchura (m)'),
}
# manos arriba en la barra: el eje de la mano apunta arriba; la palma, según el agarre
OVER = {'L': Matrix(((0, 1, 0), (0, 0, 1), (1, 0, 0))), 'R': Matrix(((0, -1, 0), (0, 0, 1), (-1, 0, 0)))}   # prono: palma delante
TURN = {'prono': (0, 0), 'supino': (180, 180), 'neutro': (-90, 90)}           # giro de la mano alrededor de la vertical (L, R)
POLE = {'prono': (0, 0.3, -1), 'supino': (0, -0.6, -1), 'neutro': (0, -0.4, -1)}   # codos: abiertos (prono) o delante


def make(grip):
    def frames(F, p):
        F.socket('L')
        hand = {S: Matrix.Rotation(TURN[grip][i] * DEG, 3, 'Z') @ OVER[S] for i, S in enumerate('LR')}
        hip = Vector((0.0, p['SEAT_Z'] + p['HIP_UP']))
        L = F.arm_len('L') * 0.99; dx = p['GRIP_HALF'] - F.H('DEF-ARM01.L').x
        ankle_f = hip.x + F.Lt * 0.92

        def pose(phi, scap, where):
            def posar():
                F.set_props(hand_parent=5, foot_parent=0, bar_in_hands=0, discs=0); F.hide_machine()
                F.place_bench(hip.x - 0.02, p['SEAT_Z'], (0.40, 0.40, p['SEAT_Z']))
                F.place_trunk(hip.x, hip.y, phi)
                for S, sgn in (('L', 1), ('R', -1)):
                    F.place_foot(S, ankle_f, F.ankleH, sgn * p['STANCE_X'], 0, 10, knee=(ankle_f + 0.3, 1.0, sgn * 0.3))
                F.scapulae(scap)
                sh = Vector(F.sagittal((F.pb['DEF-ARM01.L'].head + F.pb['DEF-ARM01.R'].head) / 2))   # hombros ya colocados
                if where == 'face':
                    bar = sh + Vector((p['FACE_F'], p['FACE_Z']))
                elif where == 'chest':
                    u = Vector((math.sin(phi), math.cos(phi))); n = Vector((math.cos(phi), -math.sin(phi)))
                    bar = sh - u * p['BAR_TO'] + n * p['TO_FRONT']
                else:   # arriba y frame 10 (escápulas abajo, brazo casi recto): la barra bajo la polea (delante de la cadera), sin volver atrás;
                    # si el brazo no llega, se acerca la polea
                    r = L * (1.0 if where == 'top' else p['ARMS_10']); f = hip.x + p['PULLEY_F']
                    while (r ** 2 - dx ** 2 - (f - sh.x) ** 2 < 1e-6) and f > sh.x:
                        f -= 0.005; print(f'  AVISO: el brazo no llega a PULLEY_F; polea a {f - hip.x:.3f} m')
                    bar = Vector((f, sh.y + math.sqrt(max(1e-6, r ** 2 - dx ** 2 - (f - sh.x) ** 2))))
                F.place_bar(bar.x, bar.y)
                if where == 'top': TOP['bar'] = (bar.x, bar.y)
                F.grip_bar(F.W(bar.x, bar.y), p['GRIP_HALF'], hand, pole_dir=POLE[grip])
                print(f'  jalón {grip} {where}: hombros z {sh.y:.2f} · barra f {bar.x:.2f} z {bar.y:.2f}')
            return posar
        return [(1, pose(p['TRUNK_START'] * DEG, -p['SCAP_UP'], 'top')),
                (10, pose(p['TRUNK_START'] * DEG, p['SCAP_DOWN'], 'mid')),
                (20, pose((p['TRUNK_START'] + p['TRUNK_END']) / 2 * DEG, p['SCAP_DOWN'], 'face')),
                (30, pose(p['TRUNK_END'] * DEG, p['SCAP_DOWN'], 'chest'))]

    def setup(F, act, p):
        act['ff_status'] = 'borrador'; act['ff_pulley'] = [TOP['bar'][0], TOP['bar'][1] + 0.45]; act['ff_impl'] = 'barra_jalon'
        act['ff_mano'] = {'prono': 'colgado_prono', 'supino': 'colgado_supino', 'neutro': 'colgado_neutro'}[grip]
        if grip != 'prono':
            act['ff_variant_of'] = 'lat_pulldown'; act['ff_axis'] = 'grip'; act['ff_value'] = grip; act['ff_grip'] = grip
    return frames, setup


frames, setup = make('prono')


def main(META, PARAMS, frames, setup):
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


if __name__ == '__main__':
    main(META, PARAMS, frames, setup)
