"""Ordena FormFit_Maniqui.blend (spec X03-08 y X03-09). Se puede volver a ejecutar: lo que ya está hecho no cambia.

  - Outliner: tres grupos con color según quién toca qué (1 Maniquí NO TOCAR · 2 Props TUYO · 3 Manos TUYO).
  - Fuera las acciones de objeto que creó el autokey en las asas de referencia.
  - Por acción de ejercicio: ff_base y ff_name donde faltaban, ff_status, ff_mano y, en las variantes, ff_axis/ff_value.
  - Manos: `_mano.<id>` pasa a `mano.<id>` con solo los huesos de la mano, marcada como pose asset (biblioteca de poses)
    en su catálogo; y cuatro manos nuevas sacadas de los dedos de su ejercicio, para retocarlas.

  blender -b --factory-startup --python blender/organizar.py -- entrada.blend salida.blend
"""
import bpy, os, sys, uuid, importlib

here = os.path.dirname(os.path.abspath(__file__))
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None
if argv: bpy.ops.wm.open_mainfile(filepath=argv[0])
sys.path.insert(0, here)
import ffpose as F
importlib.reload(F)

# ---------- outliner
def grupo(nombre, color, padre=None):
    c = bpy.data.collections.get(nombre) or bpy.data.collections.new(nombre)
    c.color_tag = color
    p = padre or bpy.context.scene.collection
    if c.name not in p.children: p.children.link(c)
    return c

def mover(hijo, padre):
    c = bpy.data.collections.get(hijo)
    if not c: return
    for p in [bpy.context.scene.collection, *bpy.data.collections]:
        if p != padre and c.name in p.children: p.children.unlink(c)
    if c.name not in padre.children: padre.children.link(c)

G1 = grupo('1 · Maniquí · NO TOCAR', 'COLOR_01')
G2 = grupo('2 · Props para posar · TUYO', 'COLOR_04')
G3 = grupo('3 · Manos · TUYO', 'COLOR_04')
G3m = grupo('Manerales de polea', 'COLOR_04', G3)
mover('mannequin', G1); mover('FF_Props', G2); mover('FF_asas', G3)
for m in ('triangulo', 'asa', 'barra_recta', 'barra_supina', 'cuerda'): mover('FF_manerales_' + m, G3m)

def capa(lc, nombre):
    if lc.collection.name == nombre: return lc
    for ch in lc.children:
        r = capa(ch, nombre)
        if r: return r
# los manerales van colgados de las manos en todas las acciones: ocultos (ojo) al posar; se encienden para retocarlos
for vl in bpy.context.scene.view_layers:
    lc = capa(vl.layer_collection, G3m.name)
    if lc: lc.hide_viewport = True

# ---------- acciones sobrantes del autokey (asas de referencia): la asa se queda donde está
for o in bpy.data.objects:
    if o.name.startswith('FF_asa_') and o.animation_data and o.animation_data.action:
        a = o.animation_data.action; M = o.matrix_world.copy(); o.animation_data_clear(); o.matrix_world = M
        if a.users == 0: bpy.data.actions.remove(a)

# ---------- metadatos de los ejercicios
META = {   # acción: (base, nombre, estado, mano)   mano '' = asimétrica o de máquina: dedos de la acción
    'back_squat': ('stand', 'Sentadilla trasera', 'ok', 'barra_espalda'),
    'front_squat': ('stand', 'Sentadilla frontal', 'ok', 'barra_espalda'),
    'leg_press': ('seat', 'Prensa', 'ok', ''),
    'deadlift': (None, None, 'ok', 'barra_pm'),
    'romanian_deadlift': (None, None, 'ok', 'barra_pm'),
    'barbell_row': (None, None, 'ok', 'barra_pm'),
    'barbell_row_supino': (None, None, 'revisar', 'barra_pm'),
    'pullup': (None, None, 'ok', 'colgado_prono'),
    'Chinup': (None, None, 'ok', 'colgado_supino'),
    'cable_row': (None, None, 'revisar', 'triangulo'),
    'cable_row_one_arm': (None, None, 'revisar', ''),
}
for n, (base, nombre, st, mano) in META.items():
    a = bpy.data.actions.get(n)
    if not a: continue
    if base and 'ff_base' not in a: a['ff_base'] = base
    if nombre and 'ff_name' not in a: a['ff_name'] = nombre
    if 'ff_status' not in a: a['ff_status'] = st
    if 'ff_mano' not in a: a['ff_mano'] = mano
    if a.get('ff_grip') and 'ff_axis' not in a: a['ff_axis'] = 'grip'; a['ff_value'] = a['ff_grip']   # ff_grip se queda hasta X03-01

# ---------- manos: biblioteca de poses
CATS = {'Barra': 'Manos/Barra', 'Grosor': 'Manos/Por grosor', 'Manerales': 'Manos/Manerales de polea'}
cats_file = os.path.join(os.path.dirname(bpy.data.filepath), 'blender_assets.cats.txt')
ids = {}
if os.path.exists(cats_file):
    for ln in open(cats_file, encoding='utf-8'):
        p = ln.strip().split(':')
        if len(p) == 3 and not ln.startswith('#'): ids[p[1]] = p[0]
for path in CATS.values():
    ids.setdefault(path, str(uuid.uuid4()))
with open(cats_file, 'w', encoding='utf-8', newline='\n') as f:
    f.write('# Catálogos de la biblioteca de assets de FormFit_Maniqui.blend (los escribe blender/organizar.py)\nVERSION 1\n\n')
    for path, i in sorted(ids.items()): f.write(f'{i}:{path}:{path.replace("/", "-")}\n')

def asset(a, grupo, nombre):
    a.use_fake_user = True
    if not a.asset_data: a.asset_mark()
    a.asset_data.catalog_id = ids[CATS[grupo]]
    a['ff_name'] = nombre; a['ff_grupo'] = grupo
    a.asset_data.description = nombre

NOMBRES = {'abierta': 'Mano abierta', '28': 'Asa 28 mm (mancuerna)', '40': 'Asa 40 mm (kettlebell)',
           'triangulo': 'Maneral triángulo', 'asa': 'Maneral asa en D', 'barra_recta': 'Maneral barra recta',
           'barra_supina': 'Maneral barra supina', 'cuerda': 'Maneral cuerda'}
for a in [a for a in bpy.data.actions if a.name.startswith('_mano.')]:
    a.name = F.MANO + a.name[len('_mano.'):]
for a in [a for a in bpy.data.actions if a.name.startswith(F.MANO)]:
    i = a.name[len(F.MANO):]
    F.trim_hand(a)
    asset(a, 'Manerales' if a.get('ff_maneral') else 'Grosor', a.get('ff_name') if i not in NOMBRES else NOMBRES[i])

# manos nuevas: los dedos del frame 1 de su ejercicio (los dos lados), como punto de partida para retocar
NUEVAS = {'colgado_prono': ('pullup', 'Colgado, prono'), 'colgado_supino': ('Chinup', 'Colgado, supino'),
          'barra_espalda': ('back_squat', 'Barra en la espalda'), 'barra_pm': ('deadlift', 'Barra de peso muerto y remo')}
def curvas(a):
    return {(fc.data_path, fc.array_index): fc for l in a.layers for st in l.strips for sl in a.slots
            if (cb := st.channelbag(sl)) for fc in cb.fcurves}
plantilla = bpy.data.actions[F.MANO + 'abierta']
for i, (src, nombre) in NUEVAS.items():
    if bpy.data.actions.get(F.MANO + i): continue
    a = plantilla.copy(); a.name = F.MANO + i
    for k in [k for k in list(a.keys()) if k.startswith('ff_')]: del a[k]
    a['ff_base'] = 'mano'; a['ff_from'] = src
    s = curvas(bpy.data.actions[src])
    for key, fc in curvas(a).items():
        v = s[key].evaluate(1) if key in s else fc.keyframe_points[0].co[1]
        for kp in fc.keyframe_points: kp.co[1] = v; kp.handle_left[1] = v; kp.handle_right[1] = v
    asset(a, 'Barra', nombre)

# ponytail: sin miniaturas: en -b no hay cámara ni pose activa; se generan en Blender (Asset Shelf › clic derecho › Generar miniatura)
print('manos:', sorted(a.name for a in bpy.data.actions if a.name.startswith(F.MANO)))
if argv: bpy.ops.wm.save_as_mainfile(filepath=argv[1]); print('SAVED', argv[1])
