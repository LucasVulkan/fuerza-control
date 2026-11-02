"""Paso 1-2: limpieza del rig del maniquí + barra/máquina como padres de manos y pies."""
import bpy, sys, math
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]   # vale con 'blender -b --python x.py -- ...' y con bpy de pip
from mathutils import Vector, Matrix
src, out = ARGV[0], ARGV[1]
bpy.ops.wm.open_mainfile(filepath=src)
sc = bpy.context.scene; vl = bpy.context.view_layer
o = bpy.data.objects['Armature_Mannequin']; arm = o.data

# ---------- 1. drivers rotos
props = set(o.pose.bones['PROPERTIES'].keys())
fixed, removed = 0, 0
for fc in list(o.animation_data.drivers):
    d = fc.driver
    if d.is_valid: continue
    ok = True
    for v in d.variables:
        t = v.targets[0]; p = t.data_path
        if '["PROPERTIES"]' in p:
            key = p.split('"]["')[-1].rstrip('"]')
            if key not in props:
                cand = key.replace(' ', '-')
                if cand in props: t.data_path = p.replace(key, cand); fixed += 1
                else: ok = False
    # el owner existe?
    try: o.path_resolve(fc.data_path.rsplit('.', 1)[0])
    except Exception: ok = False
    if not ok:
        o.animation_data.drivers.remove(fc); removed += 1
    else:
        # forzar re-evaluación
        d.expression = d.expression
print(f'drivers: corregidos {fixed}, eliminados (apuntaban a huesos inexistentes) {removed}, inválidos restantes', sum(1 for fc in o.animation_data.drivers if not fc.driver.is_valid))

# ---------- 2. huesos auxiliares marcados como deform
for n in ('MCH_HIPS', 'WGT_LEG_POLE.L', 'WGT_LEG_POLE.R', 'WGT_ARM_POLE.L', 'WGT_ARM_POLE.R'):
    arm.bones[n].use_deform = False

# ---------- 3. barra y máquina
for ob in vl.objects: ob.select_set(False)
vl.objects.active = o; o.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); eb = arm.edit_bones
def nb(name, head, tail, parent='ROOT', align_z=Vector((0, 0, 1))):
    if name in eb: eb.remove(eb[name])
    b = eb.new(name); b.head = head; b.tail = tail; b.parent = eb[parent]; b.use_deform = False; b.align_roll(align_z); return b
nb('BARRA', Vector((0, 0.015, 1.454)), Vector((0.25, 0.015, 1.454)))              # eje Y del hueso = eje de la barra (X mundo)
nb('MAQUINA', Vector((0, 0.3, 0.0)), Vector((0, 0.3, 0.25)), align_z=Vector((0, -1, 0)))
nb('PLATAFORMA', Vector((0, -0.8, 0.6)), Vector((0, -0.95, 0.6)), parent='MAQUINA')  # eje Y = normal (hacia el usuario al posar)
bpy.ops.object.mode_set(mode='POSE'); pb = o.pose.bones
col = arm.collections.get('PROPS') or arm.collections.new('PROPS')
for n in ('BARRA', 'MAQUINA', 'PLATAFORMA'):
    col.assign(arm.bones[n]); pb[n].rotation_mode = 'QUATERNION'
    pb[n].custom_shape = bpy.data.objects.get('WGT-ROT'); pb[n].color.palette = 'THEME09'
P = pb['PROPERTIES']

def add_parent_option(bone, prop, label, target_bone, index):
    c = pb[bone].constraints['Armature']
    t = c.targets.new(); t.target = o; t.subtarget = target_bone; t.weight = 0.0
    var_name = prop.replace('-', '_').replace('.', '_')
    fc = t.driver_add('weight'); d = fc.driver; d.type = 'SCRIPTED'
    v = d.variables.new(); v.name = var_name; v.type = 'SINGLE_PROP'
    v.targets[0].id_type = 'OBJECT'; v.targets[0].id = o; v.targets[0].data_path = f'pose.bones["PROPERTIES"]["{prop}"]'
    d.expression = f'{var_name}=={index}'
    ui = P.id_properties_ui(prop); cur = ui.as_dict()
    ui.update(min=0, max=index, soft_min=0, soft_max=index, description=(cur.get('description', '') + f', {index}:{label}').strip(', '))
    return d.is_simple_expression
ok = []
for S in 'LR':
    ok.append(add_parent_option(f'MCH-PARENT-HAND_IK.{S}', f'ARM_IK_parent.{S}', 'Barra', 'BARRA', 5))
    ok.append(add_parent_option(f'MCH-PARENT-FOOT-IK.{S}.001', f'FOOT-IK-PARENT.{S}', 'Plataforma', 'PLATAFORMA', 2))
# la descripción del lado R estaba incompleta en el original
P.id_properties_ui('ARM_IK_parent.R').update(description='0:Root, 1:Torso, 2:Hips, 3:Chest, 4:Head, 5:Barra')
P.id_properties_ui('ARM_IK_parent.L').update(description='0:Root, 1:Torso, 2:Hips, 3:Chest, 4:Head, 5:Barra')
print('drivers nuevos sin Python:', all(ok))

# ---------- 4. props
bpy.ops.object.mode_set(mode='OBJECT')
def mat(name, rgb):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name); m.diffuse_color = (*rgb, 1); return m
steel, rubber, pad = mat('FF_acero', (0.6, 0.63, 0.68)), mat('FF_disco', (0.09, 0.1, 0.12)), mat('FF_tapiz', (0.14, 0.33, 0.81))
pcol = bpy.data.collections.get('FF_Props') or bpy.data.collections.new('FF_Props')
if pcol.name not in sc.collection.children: sc.collection.children.link(pcol)
vl.active_layer_collection = vl.layer_collection.children[pcol.name]
def prop(name, prim, bone, loc=(0, 0, 0), rot=(0, 0, 0), scale=None, material=steel, **kw):
    if name in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[name])
    getattr(bpy.ops.mesh, f'primitive_{prim}_add')(**kw)
    ob = bpy.context.active_object; ob.name = name; ob.data.materials.append(material)
    ob.parent = o; ob.parent_type = 'BONE'; ob.parent_bone = bone; ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.location = Vector(loc) - Vector((0, arm.bones[bone].length, 0)); ob.rotation_euler = rot
    if scale: ob.scale = scale
    return ob
# barra: Y del hueso = X del mundo
prop('FF_barra', 'cylinder', 'BARRA', rot=(math.pi / 2, 0, 0), vertices=16, radius=0.014, depth=2.2)
for s in (-1, 1):
    prop(f'FF_disco_{s}', 'cylinder', 'BARRA', loc=(0, s * 0.75, 0), rot=(math.pi / 2, 0, 0), vertices=32, radius=0.225, depth=0.1, material=rubber)
# máquina (prensa): Y del hueso = arriba, Z = delante (-Y mundo)
prop('FF_asiento', 'cube', 'MAQUINA', loc=(0, -0.04, -0.02), scale=(0.21, 0.04, 0.21), material=pad, size=2)
prop('FF_respaldo', 'cube', 'MAQUINA', loc=(0, 0.327, -0.379), rot=(math.radians(-42), 0, 0), scale=(0.21, 0.375, 0.04), material=pad, size=2)
for s in (-1, 1): prop(f'FF_asa_{s}', 'cylinder', 'MAQUINA', loc=(s * 0.27, 0.16, -0.06), vertices=12, radius=0.016, depth=0.16)
prop('FF_plataforma', 'cube', 'PLATAFORMA', loc=(0, -0.02, 0), scale=(0.31, 0.02, 0.25), material=rubber, size=2)
for ob in vl.objects: ob.select_set(False)
vl.active_layer_collection = vl.layer_collection
arm.display_type = 'OCTAHEDRAL'
bpy.ops.wm.save_as_mainfile(filepath=out); print('SAVED')
