"""FormFit · exportador Blender -> app.
Genera:
  - mannequin.glb : maniquí (Mirror + Subsurf aplicados) con un esqueleto limpio DEF-* con jerarquía.
  - poses.json    : para cada ejercicio, inicio, final y claves intermedias ('mid', con su s) como transformaciones de los huesos DEF (espacio glTF, Y arriba)
                    + implementos (barra, máquina, plataforma, asas).
Uso:
  blender -b --python export.py -- archivo.blend carpeta_salida [blend_corregido.blend] [--exercises a,b,c]
  (o con el módulo bpy de pip:  python3 -I export.py archivo.blend carpeta_salida ...)
Ejercicios: por defecto, todas las acciones con claves en los frames 1 y 30 (se ignoran las que empiezan por "00" o "_").
Metadatos opcionales por acción (propiedades personalizadas de la acción): ff_base = "stand" | "seat" | "hinge" | "hang", ff_name = "Sentadilla trasera";
variantes: ff_variant_of = "pullup", ff_grip = "supino" (el visor la usa desde el chip de agarre de su ejercicio).
Cada acción se evalúa desde el reposo: tiene que keyar todo lo que usa (blender/ffpose.py key() lo hace).
"""
import bpy, sys, json, math, os
from mathutils import Vector, Matrix
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
only = None
if '--exercises' in argv:
    i = argv.index('--exercises'); only = argv[i + 1].split(','); del argv[i:i + 2]
src, outdir = argv[0], argv[1]
os.makedirs(outdir, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=src)
sc = bpy.context.scene; vl = bpy.context.view_layer
rig = bpy.data.objects['Armature_Mannequin']; body = bpy.data.objects['Mannequin']
FRAMES = {'start': 1, 'end': 30}
def bone_action(a):
    """Solo acciones del rig (canales de pose.bones): mover un objeto con autokey crea acciones de objeto (FF_asa_28.LAction)."""
    return any(fc.data_path.startswith('pose.bones') for l in a.layers for st in l.strips for sl in a.slots if (cb := st.channelbag(sl)) for fc in cb.fcurves)
EXERCISES = tuple(only or [a.name for a in bpy.data.actions if not a.name.startswith(('00', '_')) and a.frame_range[1] >= FRAMES['end'] and bone_action(a)])
print('ejercicios:', EXERCISES)

SAMPLE = 5   # además, un frame cada SAMPLE: Blender interpola los controles con curvas (arranque y frenada suaves) y el visor, en
             # recta entre claves; sin muestras, en la dominada el cuerpo subía antes que en Blender y el codo se doblaba de más
def mids(ex):
    """Frames intermedios que se exportan: los que tienen clave y uno cada SAMPLE (el visor interpola por tramos entre ellos)."""
    act = bpy.data.actions[ex]
    fcs = [fc for l in act.layers for st in l.strips for sl in act.slots if (cb := st.channelbag(sl)) for fc in cb.fcurves]
    keyed = {round(k.co.x) for fc in fcs for k in fc.keyframe_points}
    return sorted((keyed | set(range(FRAMES['start'] + SAMPLE, FRAMES['end'], SAMPLE))) & set(range(FRAMES['start'] + 1, FRAMES['end'])))

def use(ex):
    """Activa la acción partiendo del reposo: un canal que la acción no keya no hereda lo que dejó la anterior."""
    for p in rig.pose.bones:
        p.location = (0, 0, 0); p.scale = (1, 1, 1); p.rotation_quaternion = (1, 0, 0, 0); p.rotation_euler = (0, 0, 0)
    rig.animation_data.action = bpy.data.actions[ex]

# ---------- extremidades rígidas: sin estiramiento del IK (longitudes constantes, como un cuerpo real)
for p in rig.pose.bones:
    p.ik_stretch = 0.0
    for c in p.constraints:
        if c.type == 'IK': c.use_stretch = False
# si una pierna no llega a su pie (antes lo disimulaba el estiramiento), bajar la cadera lo justo
for ex in EXERCISES:
    use(ex)
    for f in [*FRAMES.values(), *mids(ex)]:
        for it in range(6):
            sc.frame_set(f); sc.frame_set(f)
            gap = max((rig.pose.bones[f'DEF-FOOT.{S}'].head - rig.pose.bones[f'DEF-SHIN01.{S}'].head).length - (rig.data.bones[f'DEF-FOOT.{S}'].head_local - rig.data.bones[f'DEF-SHIN01.{S}'].head_local).length for S in 'LR')
            if gap < 0.0005: break
            t = rig.pose.bones['TORSO']; M = t.matrix.copy(); M.translation.z -= gap * 1.1; t.matrix = M; vl.update()
            t.keyframe_insert('location', frame=f)
        if it: print(f'  {ex} frame {f}: cadera bajada para que las piernas lleguen a los pies')
if len(argv) > 2:   # guardar también el .blend corregido
    bpy.ops.wm.save_as_mainfile(filepath=argv[2], copy=True); print('blend sin estiramiento ->', argv[2])

# ---------- jerarquía limpia de los huesos de deformación
DEF = [b.name for b in rig.data.bones if b.use_deform and b.name.startswith('DEF-')]
def parent_of(n):
    side = n[-2:] if n.endswith(('.L', '.R')) else ''
    base = n[:-2] if side else n
    chain = {'DEF-SPINE01': 'DEF-HIPS', 'DEF-SPINE02': 'DEF-SPINE01', 'DEF-CHEST': 'DEF-SPINE02', 'DEF-NECK': 'DEF-CHEST', 'DEF-HEAD': 'DEF-NECK'}
    if n in chain: return chain[n]
    if n == 'DEF-HIPS': return None
    limb = {'DEF-SHOULDER': 'DEF-CHEST', 'DEF-ARM01': 'DEF-SHOULDER', 'DEF-ARM02': 'DEF-ARM01', 'DEF-FORARM01': 'DEF-ARM02',
            'DEF-FORARM0': 'DEF-FORARM01', 'DEF-HAND': 'DEF-FORARM0', 'DEF-THUMB01': 'DEF-HAND', 'DEF-THUMB02': 'DEF-THUMB01',
            'DEF-THUMB03': 'DEF-THUMB02', 'DEF-THIGH01': 'DEF-HIPS', 'DEF-THIGH02': 'DEF-THIGH01', 'DEF-SHIN01': 'DEF-THIGH02',
            'DEF-SHIN02': 'DEF-SHIN01', 'DEF-FOOT': 'DEF-SHIN02', 'DEF-TOE': 'DEF-FOOT'}
    if base in limb:
        p = limb[base]; return p if p == 'DEF-CHEST' or p == 'DEF-HIPS' else p + side
    if base.startswith('DEF-PALM-'): return 'DEF-HAND' + side
    if base.startswith('DEF-FINGER-'):
        letter, idx = base.split('-')[2], int(base.split('-')[3])
        return (f'DEF-PALM-{letter}' if idx == 1 else f'DEF-FINGER-{letter}-0{idx - 1}') + side
    raise KeyError(n)
PARENT = {n: parent_of(n) for n in DEF}
assert all(p is None or p in PARENT for p in PARENT.values()), [p for p in PARENT.values() if p and p not in PARENT]

# ---------- esqueleto de exportación (mismo reposo que los DEF del rig)
for ob in vl.objects: ob.select_set(False)
skel_data = bpy.data.armatures.new('FF_Skeleton'); skel = bpy.data.objects.new('FF_Skeleton', skel_data)
sc.collection.objects.link(skel); vl.objects.active = skel; skel.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for n in DEF:
    b = rig.data.bones[n]; e = skel_data.edit_bones.new(n)
    e.head = b.head_local.copy(); e.tail = b.tail_local.copy(); e.matrix = b.matrix_local.copy(); e.use_deform = True
for n, p in PARENT.items():
    if p: skel_data.edit_bones[n].parent = skel_data.edit_bones[p]
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- malla: copia con Mirror + Subsurf(1) aplicados, pesada al esqueleto limpio
mesh = body.copy(); mesh.data = body.data.copy(); mesh.name = 'FF_Mannequin'; sc.collection.objects.link(mesh)
for m in list(mesh.modifiers):
    if m.type == 'SUBSURF': m.levels = 1
    if m.type in ('MASK', 'ARMATURE'): mesh.modifiers.remove(m)
rig.data.pose_position = 'REST'; vl.update()
for ob in vl.objects: ob.select_set(False)
vl.objects.active = mesh; mesh.select_set(True)
for m in list(mesh.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
mesh.parent = skel; mesh.matrix_parent_inverse = skel.matrix_world.inverted()
arm_mod = mesh.modifiers.new('Armature', 'ARMATURE'); arm_mod.object = skel
keep = set(DEF)
for g in list(mesh.vertex_groups):
    if g.name not in keep: mesh.vertex_groups.remove(g)
print('malla exportada:', len(mesh.data.vertices), 'vértices,', len(mesh.vertex_groups), 'grupos, materiales', [m.name for m in mesh.data.materials])

# ---------- GLB
for ob in vl.objects: ob.select_set(False)
skel.select_set(True); mesh.select_set(True); vl.objects.active = skel
bpy.ops.export_scene.gltf(filepath=os.path.join(outdir, 'mannequin.glb'), export_format='GLB', use_selection=True,
                          export_animations=False, export_skins=True, export_yup=True, export_apply=False,
                          export_materials='EXPORT', export_image_format='NONE', export_def_bones=False)
rig.data.pose_position = 'POSE'

# ---------- poses
C = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))          # Blender (Z arriba, -Y delante) -> glTF (Y arriba, +Z delante)
gpos = lambda v: list(C @ Vector(v))
grot = lambda m3: C @ m3            # ejes locales del hueso se conservan (Y a lo largo del hueso); solo cambia el mundo
def quat(m3): q = m3.to_quaternion(); return [q.x, q.y, q.z, q.w]
rest = {n: rig.data.bones[n].matrix_local for n in DEF}
out = {'units': 'm', 'space': 'glTF (Y arriba, +Z delante)', 'bones': DEF, 'parent': PARENT,
       'rest': {n: {'p': gpos(rest[n].translation), 'q': quat(grot(rest[n].to_3x3()))} for n in DEF}, 'exercises': {}}
pb = rig.pose.bones
for ex in EXERCISES:
    act = bpy.data.actions[ex]; use(ex); out['exercises'][ex] = {}
    seat = pb['MAQUINA'].scale.x > 0.5 if (sc.frame_set(1) or True) else False
    out['exercises'][ex]['meta'] = {'base': act.get('ff_base', 'seat' if seat else 'stand'), 'name': act.get('ff_name', ex)}
    if act.get('ff_variant_of'):   # variante de otro ejercicio (p. ej. Chinup = pullup con agarre supino): el visor la usa desde su chip
        out['exercises'][ex]['meta'].update({'of': act['ff_variant_of'], 'grip': act.get('ff_grip')})
    if act.get('ff_pulley'):   # polea (anclaje del cable), [f, z] en metros -> glTF
        f, z, *x = act['ff_pulley']; out['exercises'][ex]['meta']['pulley'] = [x[0] if x else 0.0, z, f]
    if act.get('ff_hand'):     # una sola mano tira (remo a un brazo): la otra va tal cual con el tronco
        out['exercises'][ex]['meta']['hand'] = act['ff_hand']
    for key, f in [*FRAMES.items(), *(('mid', m) for m in mids(ex))]:
        sc.frame_set(f); sc.frame_set(f)
        P = pb['PROPERTIES']
        fr = {'bones': {}}
        for n in DEF:
            M = pb[n].matrix
            ent = {'p': gpos(M.translation), 'q': quat(grot(M.to_3x3())), 'len': (pb[n].tail - pb[n].head).length / rig.data.bones[n].length}
            par = PARENT[n]
            if par:   # desplazamiento local respecto al padre (en ejes del padre): reproduce traslaciones del rig (hombros, tweaks)
                Pm = pb[par].matrix
                off = grot(Pm.to_3x3()).to_quaternion().to_matrix().transposed() @ (C @ (M.translation - Pm.translation))   # misma rotación que 'q' del padre (huesos escalados)
                ent['off'] = list(off)
            fr['bones'][n] = ent
        if pb['BARRA'].scale.x > 0.5 or act.get('ff_base') == 'cable':   # en polea, el maneral (entre los puños)
            B = pb['BARRA_FINAL' if 'BARRA_FINAL' in pb else 'BARRA'].matrix   # la que se ve: con BARRA_EN_MANOS va entre los puños
            fr['bar'] = {'center': gpos(B.translation), 'axis': gpos(B.to_3x3().col[1].normalized())}
            if act.get('ff_hand'):   # a un brazo: el asa es el puño de esa mano (sigue a los retoques de la mano, no al control BARRA)
                fr['bar']['center'] = gpos(pb[f"FF_PUNO.{act['ff_hand']}"].head)
        if pb['MAQUINA'].scale.x > 0.5:
            fr['machine'] = {'p': gpos(pb['MAQUINA'].matrix.translation), 'q': quat(grot(pb['MAQUINA'].matrix.to_3x3()))}
            Pl = pb['PLATAFORMA'].matrix
            fr['plate'] = {'p': gpos(Pl.translation), 'normal': gpos(Pl.to_3x3().col[1].normalized()), 'up': gpos(Pl.to_3x3().col[2].normalized())}
            fr['handles'] = [gpos(bpy.data.objects[f'FF_asa_{s}'].matrix_world.translation) for s in (1, -1)]
        fr['ik_parent'] = {'hand': int(P['ARM_IK_parent.L']), 'foot': int(P['FOOT-IK-PARENT.L'])}
        if key == 'mid':
            fr['s'] = (f - FRAMES['start']) / (FRAMES['end'] - FRAMES['start'])
            out['exercises'][ex].setdefault('mid', []).append(fr)
        else: out['exercises'][ex][key] = fr
# ---------- manos de referencia (spec X02): acciones `_mano.<nombre>` (blender/ejercicios/_manos.py) y sus asas FF_asa_<nombre>.L/R
#   fingers: giro de cada hueso de la mano (dedos, palma, pulgar) relativo a DEF-HAND (igual en Blender y en glTF: C se cancela)
#   hollow: centro y eje del asa en los ejes de DEF-HAND (los ejes locales del hueso se conservan en glTF)
def under(n, root):
    while n:
        n = PARENT[n]
        if n == root: return True
    return False
out['hands'] = {}; out['manerales'] = {}   # mallas de los manerales (marco del maneral, glTF)
for act in [a for a in bpy.data.actions if a.name.startswith('_mano.')]:
    use(act.name); sc.frame_set(1); sc.frame_set(1)
    name = act.name[len('_mano.'):]; d = act.get('ff_diametro') or None; ent = {'d': d}
    for S in 'LR':
        hn = f'DEF-HAND.{S}'; Mh = rig.matrix_world @ pb[hn].matrix; qh = Mh.to_quaternion(); Rinv = qh.to_matrix().inverted()
        e = {'fingers': {n: quat((qh.inverted() @ (rig.matrix_world @ pb[n].matrix).to_quaternion()).to_matrix()) for n in DEF if under(n, hn)}}
        ob = bpy.data.objects.get(f'FF_asa_{name}.{S}')
        if ob:
            e['hollow'] = {'p': list(Rinv @ (ob.matrix_world.translation - Mh.translation)),
                           'axis': list((Rinv @ (ob.matrix_world.to_3x3() @ Vector((0, 0, 1)))).normalized())}
        # maneral (blender/ejercicios/_manerales.py): dónde va respecto a la mano (origen = gancho; rotación glTF de la malla:
        # la malla se convierte con C, así que rel = (Rmano⁻¹ · Rmaneral) · Cᵀ) y su punto de agarre (marco del maneral, glTF)
        mo = bpy.data.objects.get(f'FF_maneral.{name}.{S}')
        if mo:
            Mm = mo.matrix_world
            e['maneral'] = {'p': list(Rinv @ (Mm.translation - Mh.translation)), 'q': quat((Rinv @ Mm.to_quaternion().to_matrix()) @ C.transposed())}
            # agarre: el centro del puño cerrado (falanges de corazón y anular, como ffpose.socket) en el marco del maneral
            pts = [pb[f'DEF-FINGER-{dd}-0{i}.{S}'].head for dd in 'BC' for i in (1, 2, 3)] + [pb[f'DEF-FINGER-{dd}-03.{S}'].tail for dd in 'BC']
            e['agarre'] = gpos(Mm.inverted() @ (rig.matrix_world @ (sum(pts, Vector()) / len(pts))))
            ent['malla'] = mo.data.name
            if mo.data.name not in out['manerales']:
                me = mo.data; me.calc_loop_triangles()
                out['manerales'][me.name] = {'pos': [round(c, 5) for v in me.vertices for c in gpos(v.co)],
                                             'idx': [i for t in me.loop_triangles for i in t.vertices]}
        ent[S] = e
    if act.get('ff_maneral'): ent['rigido'] = bool(act.get('ff_rigido', True))
    out['hands'][name] = ent
print('manos de referencia:', list(out['hands']) or 'ninguna (blender/ejercicios/_manos.py las crea)')
json.dump(out, open(os.path.join(outdir, 'poses.json'), 'w'))
print('OK', os.listdir(outdir))
