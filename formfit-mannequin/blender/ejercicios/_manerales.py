"""Manerales de polea (remo): geometría y mano de referencia de cada uno, para retocar a mano en Blender.

Por maneral crea (si no existe; lo que ya existe NO se toca, son retoques del usuario):
  - la malla `maneral_<malla>` (triángulo, barra, cuerda, asa en D), modelada en el marco «de uso»: el GANCHO (donde
    engancha el cable y sobre el que pivota) en el origen, −Y hacia la polea, +Z arriba, +X a la izquierda del usuario.
    Es una base: se remodela libremente (Edit Mode); el origen del objeto debe seguir en el gancho;
  - en la colección `FF_manerales_<maneral>`, una instancia por mano `FF_maneral.<maneral>.L/R` (comparten la malla),
    emparentada a la mano (`DEF-HAND`). Se ve en cualquier acción: sirve para ver cómo encaja el maneral en los ejercicios;
  - la acción `_mano.<maneral>`: el rig en reposo con los dedos cerrados sobre el maneral. Se retocan dedos y pulgar y,
    si hace falta, se mueve la instancia respecto a la mano (eso es lo que se exporta: dónde va el maneral en la mano).
El exportador saca la malla, y por mano: dedos, el maneral respecto a la mano y el punto de agarre, que calcula él (el
centro del puño cerrado, en el marco del maneral): solo hay que mover el maneral (`poses.json` › `manerales` y `hands`). El visor dibuja esa malla, pivotando sobre el gancho, y pone las manos donde dice cada `_mano`.

Uso: Text Editor › Open › este archivo › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/_manerales.py -- entrada.blend salida.blend
"""
import bpy, sys, os, importlib, math
from mathutils import Vector, Matrix

# maneral: (malla, agarre (marco de uso, m) por mano, giro de uso -> mano en reposo, cierre de los dedos, rígido)
#   giro: «neutro» (palmas enfrentadas, pulgar arriba), «prono» (palma abajo), «supino» (palma arriba)
MANERALES = {
    'triangulo':    ('triangulo', {'L': (0.05, 0.11, 0.0), 'R': (-0.05, 0.11, 0.0)}, 'neutro', -70, True),
    'asa':          ('asa', {'L': (0.0, 0.07, 0.0), 'R': (0.0, 0.07, 0.0)}, 'neutro', -70, True),
    'barra_recta':  ('barra', {'L': (0.24, 0.02, 0.0), 'R': (-0.24, 0.02, 0.0)}, 'prono', -75, True),
    'barra_supina': ('barra', {'L': (0.24, 0.02, 0.0), 'R': (-0.24, 0.02, 0.0)}, 'supino', -75, True),
    'cuerda':       ('cuerda', {'L': (0.0, 0.20, 0.0), 'R': (0.0, 0.20, 0.0)}, 'neutro', -65, False),
}
# marco de uso -> mano en reposo (brazos en cruz, palma abajo, pulgar delante): columnas = imagen de X, Y, Z de uso
GIRO = {
    'neutro': {'L': ((0, 0, 1), (-1, 0, 0), (0, -1, 0)), 'R': ((0, 0, -1), (1, 0, 0), (0, -1, 0))},
    'prono':  {'L': ((0, 1, 0), (-1, 0, 0), (0, 0, 1)), 'R': ((0, -1, 0), (1, 0, 0), (0, 0, 1))},
    'supino': {'L': ((0, -1, 0), (-1, 0, 0), (0, 0, -1)), 'R': ((0, 1, 0), (1, 0, 0), (0, 0, -1))},
}


def cols(c): return Matrix([[c[0][i], c[1][i], c[2][i]] for i in range(3)])


def malla(nombre):
    """Geometría base (marco de uso, gancho en el origen). Cilindros entre puntos."""
    me = bpy.data.meshes.get('maneral_' + nombre)
    if me: return me
    import bmesh
    bm = bmesh.new()

    def cil(a, b, r, seg=12):
        a, b = Vector(a), Vector(b); d = b - a
        geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=d.length)
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), verts=geom['verts'])

    cil((-0.012, 0, 0), (0.012, 0, 0), 0.018)                     # anilla del gancho
    if nombre == 'triangulo':
        for x in (0.05, -0.05):
            cil((x, 0.11, -0.065), (x, 0.11, 0.065), 0.015)       # asas verticales
            cil((x, 0.11, 0.06), (0, 0, 0), 0.009); cil((x, 0.11, -0.06), (0, 0, 0), 0.009)
    elif nombre == 'asa':
        cil((0, 0.07, -0.065), (0, 0.07, 0.065), 0.016)
        cil((0, 0.07, 0.06), (0, 0, 0), 0.008); cil((0, 0.07, -0.06), (0, 0, 0), 0.008)
    elif nombre == 'barra':
        cil((-0.36, 0.02, 0), (0.36, 0.02, 0), 0.014)
    elif nombre == 'cuerda':                                       # un ramal (cada mano lleva el suyo)
        cil((0, 0, 0), (0, 0.18, 0), 0.011); cil((0, 0.18, 0.06), (0, 0.18, -0.07), 0.012)
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.024, matrix=Matrix.Translation((0, 0.18, -0.085)))
    me = bpy.data.meshes.new('maneral_' + nombre); bm.to_mesh(me); bm.free()
    return me


def main(F):
    sc = bpy.context.scene
    F.socket('L')                                   # medir el puño pone el rig en reposo: antes de nada
    prev = F.rig.animation_data.action if F.rig.animation_data else None
    for m, (nm, agarres, giro, curl, rigido) in MANERALES.items():
        act = bpy.data.actions.get('_mano.' + m)
        if act and bpy.data.objects.get(f'FF_maneral.{m}.L'):
            print(f'  {m}: ya existe, no se toca'); continue
        col = bpy.data.collections.get('FF_manerales_' + m) or bpy.data.collections.new('FF_manerales_' + m)
        if col.name not in sc.collection.children: sc.collection.children.link(col)
        col.hide_render = True
        act = act or F.new_action('_mano.' + m, 'mano', f'Mano {m}')
        act['ff_maneral'] = m; act['ff_rigido'] = rigido
        F.rig.animation_data.action = act
        F.reset(); F.fist('L', curl); F.fist('R', curl); F.upd(); F.key(1); F.finish(act)
        me = malla(nm)
        for S in 'LR':
            H = F.rig.matrix_world @ F.H(f'DEF-HAND.{S}') + F.rig.matrix_world.to_3x3() @ F.socket(S)   # hueco del puño cerrado, en reposo
            g = Vector(agarres[S]); R = cols(GIRO[giro][S])
            ob = bpy.data.objects.new(f'FF_maneral.{m}.{S}', me); col.objects.link(ob)
            ob.parent = F.rig; ob.parent_type = 'BONE'; ob.parent_bone = f'DEF-HAND.{S}'
            F.upd(); ob.matrix_world = Matrix.Translation(H) @ R.to_4x4() @ Matrix.Translation(-g)
        print(f'  {m}: malla maneral_{nm}, instancias y _mano.{m} creadas')
    F.reset()
    if prev: F.rig.animation_data.action = prev


def reflejar(F):
    """La mano derecha de cada `_mano.<maneral>` sale de la izquierda: solo se posa la izquierda (dedos y dónde va el maneral
    en la mano). Dedos y controles .L -> .R como el X-Mirror de Blender (posición (−x, y, z), cuaternión (w, x, −y, −z),
    euler (x, −y, −z)); el maneral derecho, el espejo del izquierdo respecto a su mano (en los ejes de la mano, X invertida)."""
    prev = F.rig.animation_data.action if F.rig.animation_data else None
    Fx = Matrix.Diagonal((-1, 1, 1, 1))
    for act in [a for a in bpy.data.actions if a.name.startswith('_mano.')]:
        m = act.name[len('_mano.'):]
        L, R = bpy.data.objects.get(f'FF_maneral.{m}.L'), bpy.data.objects.get(f'FF_maneral.{m}.R')
        if not (L and R): continue
        F.rig.animation_data.action = act; bpy.context.scene.frame_set(1); F.upd()
        for pl in F.pb:
            if not pl.name.endswith('.L') or pl.name[:-2] + '.R' not in F.pb: continue
            pr = F.pb[pl.name[:-2] + '.R']
            x, y, z = pl.location; pr.location = (-x, y, z)
            w, qx, qy, qz = pl.rotation_quaternion; pr.rotation_quaternion = (w, qx, -qy, -qz)
            ex, ey, ez = pl.rotation_euler; pr.rotation_euler = (ex, -ey, -ez)
            pr.scale = pl.scale
        F.upd(); F.key(1); F.finish(act); F.upd()
        H = lambda S: F.rig.matrix_world @ F.pb[f'DEF-HAND.{S}'].matrix
        # con autokey, mover el maneral le crea una acción de objeto que pisaría el reflejo al cambiar de frame: fuera (se queda
        # donde está en el frame 1, que es lo que cuenta)
        for o in (L, R):
            if o.animation_data: M = o.matrix_world.copy(); o.animation_data_clear(); o.matrix_world = M
        R.matrix_world = H('R') @ Fx @ (H('L').inverted() @ L.matrix_world) @ Fx
        print(f'  {m}: mano y maneral derechos reflejados de los izquierdos')
    if prev: F.rig.animation_data.action = prev


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None
    if argv: bpy.ops.wm.open_mainfile(filepath=argv[0])
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, here if os.path.exists(os.path.join(here, 'ffpose.py')) else os.path.dirname(bpy.data.filepath))
    import ffpose as F
    importlib.reload(F)
    if argv and len(argv) > 2 and argv[2] == 'reflejar': reflejar(F)   # ... -- entrada.blend salida.blend reflejar
    else: main(F)
    if argv: bpy.ops.wm.save_as_mainfile(filepath=argv[1]); print('SAVED', argv[1])
