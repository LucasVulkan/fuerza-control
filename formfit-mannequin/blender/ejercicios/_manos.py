"""Manos de referencia (spec X02-01): asas de referencia y una acción por mano, para retocar a mano en Blender.

Crea (o rehace) en el archivo abierto:
  - la colección `FF_asas` con cilindros de referencia `FF_asa_<mano>.L/R` (28 y 40 mm), donde va el asa en la mano en
    reposo (brazos en cruz, palma abajo: el asa va de delante a atrás). Son la guía para posar y lo que lee el exportador
    para saber dónde está el hueco del puño y hacia dónde va el asa; no se exportan como malla;
  - las acciones `mano.abierta`, `mano.28` y `mano.40`: el rig en reposo con los dedos cerrados sobre su asa (con los
    controles FINGER-MASTER como base). Se retocan a mano: dedos, pulgar y, si hace falta, el propio cilindro.
Si una acción ya existe NO se rehace (son retoques del usuario); para rehacerla, bórrala antes.

Uso: Text Editor › Open › este archivo › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/_manos.py -- entrada.blend salida.blend
El exportador las ignora como ejercicios (empiezan por `_`) y las guarda aparte en poses.json (`hands`).
"""
import bpy, sys, os, importlib
from mathutils import Vector, Matrix

# mano: (diámetro del asa en m, cierre de los dedos en grados de FINGER-MASTER) — punto de partida, se retoca a mano
HANDS = {'abierta': (None, -10), '28': (0.028, -75), '40': (0.040, -58)}
HANDLE_LEN = 0.14


def hollow(F, S):
    """Centro del hueco del puño con los dedos como estén: falanges de corazón y anular (como ffpose.socket)."""
    pts = [F.pb[f'DEF-FINGER-{d}-0{i}.{S}'].head for d in 'BC' for i in (1, 2, 3)] + [F.pb[f'DEF-FINGER-{d}-03.{S}'].tail for d in 'BC']
    return sum(pts, Vector()) / len(pts)


def handle(name, S, d, center, col):
    """Cilindro de referencia (eje a lo largo de Y del mundo: de delante a atrás, el asa con la mano en cruz y palma abajo)."""
    ob = bpy.data.objects.get(f'FF_asa_{name}.{S}')
    if ob is None:
        import bmesh
        me = bpy.data.meshes.new(f'FF_asa_{name}.{S}'); bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=d / 2, radius2=d / 2, depth=HANDLE_LEN)
        bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(me.name, me); col.objects.link(ob)
    ob.matrix_world = Matrix.Translation(center) @ Matrix.Rotation(1.5707963, 4, 'X')
    ob['ff_diametro'] = d
    return ob


def main(F):
    sc = bpy.context.scene
    col = bpy.data.collections.get('FF_asas') or bpy.data.collections.new('FF_asas')
    if col.name not in sc.collection.children: sc.collection.children.link(col)
    col.hide_render = True
    prev = F.rig.animation_data.action if F.rig.animation_data else None
    for name, (d, curl) in HANDS.items():
        if bpy.data.actions.get(F.MANO + name):
            print(f'  mano.{name}: ya existe, no se toca'); continue
        act = F.new_action(F.MANO + name, 'mano', f'Mano {name}')
        act['ff_diametro'] = d or 0.0
        F.reset(); F.fist('L', curl); F.fist('R', curl); F.upd()
        F.key(1); F.finish(act); F.trim_hand(act)
        if d:
            for S in 'LR': handle(name, S, d, F.rig.matrix_world @ hollow(F, S), col)
        print(f'  mano.{name}: creada' + (f' con su asa de {d * 1000:.0f} mm' if d else ''))
    F.reset()
    if prev: F.rig.animation_data.action = prev


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None     # None = desde el Text Editor
    if argv: bpy.ops.wm.open_mainfile(filepath=argv[0])
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, here if os.path.exists(os.path.join(here, 'ffpose.py')) else os.path.dirname(bpy.data.filepath))
    import ffpose as F
    importlib.reload(F)
    main(F)
    if argv: bpy.ops.wm.save_as_mainfile(filepath=argv[1]); print('SAVED', argv[1])
