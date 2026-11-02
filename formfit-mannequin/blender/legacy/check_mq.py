import bpy, sys, math
ARGV = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]   # vale con 'blender -b --python x.py -- ...' y con bpy de pip
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=ARGV[0]); out=ARGV[1]
sc=bpy.context.scene; vl=bpy.context.view_layer; o=bpy.data.objects['Armature_Mannequin']; pb=o.pose.bones
for a in ('back_squat','front_squat'):
    o.animation_data.action=bpy.data.actions[a]; ref=None
    for f in (1,8,15,22,30):
        sc.frame_set(f); sc.frame_set(f)
        bar=pb['BARRA'].matrix; inv=bar.inverted()
        res=[]
        for S in 'LR':
            ab=o.data.bones; hand=pb[f'DEF-HAND.{S}']
            w0=ab[f'DEF-HAND.{S}'].head_local; sock=ab[f'DEF-FINGER-B-01.{S}'].head_local.lerp(ab[f'DEF-FINGER-B-02.{S}'].head_local,0.3)+Vector((0,0,-0.026))
            g=hand.matrix @ (ab[f'DEF-HAND.{S}'].matrix_local.inverted() @ sock)
            r=inv @ g          # en espacio de la barra: Y = eje de la barra
            res.append((math.hypot(r.x, r.z)*100, r.y*100))
        if ref is None: ref=res
        print(a,'frame',f,'puño-eje barra: %.1f / %.1f cm | desliz a lo largo: %.1f / %.1f cm'%(res[0][0],res[1][0],res[0][1]-ref[0][1],res[1][1]-ref[1][1]))
# primer plano del agarre
sc.render.engine='BLENDER_WORKBENCH'; sh=sc.display.shading; sh.light='STUDIO'; sh.color_type='MATERIAL'; sh.show_object_outline=True
sc.render.resolution_x=sc.render.resolution_y=360; o.hide_render=True
for ob in sc.objects:
    if ob.name.startswith(('WGT','FF_disco')): ob.hide_render=True
cam=bpy.data.objects.new('c',bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera=cam
for a,off,tag in (('back_squat',Vector((0.25,0.45,0.05)),'bs_detras'),('back_squat',Vector((0.3,-0.4,0.1)),'bs_delante'),('front_squat',Vector((0.35,-0.4,0.05)),'fs')):
    o.animation_data.action=bpy.data.actions[a]; sc.frame_set(30); sc.frame_set(30)
    t=pb['DEF-HAND.L'].tail.copy(); cam.location=t+off; cam.rotation_euler=(t-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=f'{out}/grip_{tag}.png'; bpy.ops.render.render(write_still=True)
