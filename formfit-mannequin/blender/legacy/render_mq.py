import bpy, sys, math
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]   # vale con 'blender -b --python x.py -- ...' y con bpy de pip
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=ARGV[0]); out=ARGV[1]
sc=bpy.context.scene; vl=bpy.context.view_layer
sc.render.engine='BLENDER_WORKBENCH'; sh=sc.display.shading; sh.light='STUDIO'; sh.color_type='MATERIAL'; sh.show_object_outline=True
sc.render.resolution_x=sc.render.resolution_y=480
o=bpy.data.objects['Armature_Mannequin']; o.hide_render=True
for ob in sc.objects:
    if ob.name.startswith('WGT'): ob.hide_render=True
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera=cam; cam.data.lens=50
VIEWS={'side':Vector((4.0,0,0.9)),'front':Vector((0,-4.0,0.9)),'q':Vector((2.6,-3.0,1.8))}
for a in ARGV[2].split(','):
    o.animation_data.action=bpy.data.actions[a]
    for f in (1,30):
        sc.frame_set(f); sc.frame_set(f)
        for v,d in VIEWS.items():
            t=Vector((0,0,0.85)) if a!='leg_press' else Vector((0,-0.3,0.7))
            cam.location=t+(d-Vector((0,0,0.85)))*(0.8 if a=='leg_press' else 1)
            cam.rotation_euler=(t-cam.location).to_track_quat('-Z','Y').to_euler()
            sc.render.filepath=f'{out}/{a}_{f}_{v}.png'; bpy.ops.render.render(write_still=True)
