"""Panel «FormFit» en la barra lateral (N) del visor 3D: un deslizador por cada ajuste de cada ejercicio de blender/ejercicios/.

Cómo se abre: Text Editor › Open › blender/ff_panel.py › Run Script (Alt+P). Vuelve a ejecutarlo si cambias un ejercicio o
ffpose.py (se recarga entero). Para que salga solo al abrir el .blend: marca «Register» en el Text Editor (necesita
Preferencias › Save & Load › Auto Run Python Scripts).

- Mover un deslizador recalcula la pose al momento (solo reescribe las claves de lo que mueve el script).
- Los valores se guardan en la propia acción (`ff_params`): el .blend recuerda con qué ajustes está hecho cada ejercicio.
- Recalcular a mano un ejercicio con deslizadores borra los retoques a mano de esa acción: primero ajustes, luego retoque.
"""
import bpy, os, sys, json, importlib, importlib.util, subprocess

BASE = os.path.dirname(bpy.data.filepath)                    # blender/
ROOT = os.path.dirname(BASE)                                 # formfit-mannequin/
sys.path.insert(0, BASE)
import ffpose as F
importlib.reload(F)


def load_exercises():
    out = {}
    folder = os.path.join(BASE, 'ejercicios')
    for fn in sorted(os.listdir(folder)):
        if fn.endswith('.py') and not fn.startswith('_'):
            spec = importlib.util.spec_from_file_location('ffej_' + fn[:-3], os.path.join(folder, fn))
            m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); out[m.META[0]] = m
    return out


EX = load_exercises()
_busy = False                                                # no recalcular mientras se cargan valores en los deslizadores


def group(sc): return getattr(sc, f'ff_{sc.ff_ex}', None)
def values(sc): g = group(sc); return {k: getattr(g, k) for k in EX[sc.ff_ex].PARAMS}


def load_into_sliders(sc):
    """Copia a los deslizadores los ajustes guardados en la acción (o los de por defecto)."""
    global _busy
    ex = EX[sc.ff_ex]; p = F.params(ex, bpy.data.actions.get(ex.META[0]))
    _busy = True
    try:
        for k, v in p.items(): setattr(group(sc), k, v)
    finally:
        _busy = False


def on_exercise(self, ctx):
    act = bpy.data.actions.get(EX[self.ff_ex].META[0])
    if act: F.rig.animation_data.action = act
    load_into_sliders(self)


def make_group(name, ex):
    def on_change(self, ctx):
        if not _busy: F.run(ex, {k: getattr(self, k) for k in ex.PARAMS}, live=True)
    ann = {k: bpy.props.FloatProperty(name=v[3], default=v[0], min=v[1], max=v[2], step=1, precision=3, update=on_change)
           for k, v in ex.PARAMS.items()}
    return type(f'FF_PG_{name}', (bpy.types.PropertyGroup,), {'__annotations__': ann})


class FF_OT_rebuild(bpy.types.Operator):
    bl_idname = 'ff.rebuild'; bl_label = 'Crear / recrear acción'
    bl_description = 'Crea la acción de cero con estos ajustes y keya todo el rig (borra los retoques a mano)'
    def execute(self, ctx):
        F.run(EX[ctx.scene.ff_ex], values(ctx.scene)); ctx.scene.frame_set(ctx.scene.frame_current); return {'FINISHED'}


class FF_OT_defaults(bpy.types.Operator):
    bl_idname = 'ff.defaults'; bl_label = 'Restablecer'
    bl_description = 'Vuelve a los ajustes por defecto del ejercicio'
    def execute(self, ctx):
        global _busy
        ex = EX[ctx.scene.ff_ex]; _busy = True
        try:
            for k, v in ex.PARAMS.items(): setattr(group(ctx.scene), k, v[0])
        finally:
            _busy = False
        F.run(ex, values(ctx.scene), live=True); return {'FINISHED'}


class FF_OT_frame(bpy.types.Operator):
    bl_idname = 'ff.frame'; bl_label = 'Frame'
    frame: bpy.props.IntProperty()
    def execute(self, ctx): ctx.scene.frame_set(self.frame); return {'FINISHED'}


class FF_OT_export(bpy.types.Operator):
    bl_idname = 'ff.export'; bl_label = 'Guardar y exportar al visor'
    bl_description = 'Guarda el .blend, exporta assets/ (glb + poses.json) y regenera el visor (prototipo y app)'
    def execute(self, ctx):
        bpy.ops.wm.save_mainfile()
        r = subprocess.run([bpy.app.binary_path, '-b', '--factory-startup', '--python', os.path.join(BASE, 'export.py'), '--',
                            bpy.data.filepath, os.path.join(ROOT, 'assets')], capture_output=True, text=True)
        if r.returncode or 'OK' not in r.stdout:
            self.report({'ERROR'}, 'El exportador falló: mira la consola'); print(r.stdout[-3000:], r.stderr[-3000:]); return {'CANCELLED'}
        b = subprocess.run([sys.executable, os.path.join(ROOT, 'prototype', 'build.py')], capture_output=True, text=True)
        if b.returncode:
            self.report({'ERROR'}, 'build.py falló: mira la consola'); print(b.stdout, b.stderr); return {'CANCELLED'}
        self.report({'INFO'}, 'Exportado: recarga el visor'); return {'FINISHED'}


class FF_PT_panel(bpy.types.Panel):
    bl_space_type = 'VIEW_3D'; bl_region_type = 'UI'; bl_category = 'FormFit'; bl_label = 'Ejercicio'
    def draw(self, ctx):
        sc = ctx.scene; lay = self.layout
        lay.prop(sc, 'ff_ex', text='')
        ex = EX[sc.ff_ex]
        if not bpy.data.actions.get(ex.META[0]):
            lay.label(text='Aún no hay acción para este ejercicio'); lay.operator('ff.rebuild'); return
        row = lay.row(align=True)
        for f, label in ((1, 'Inicio'), (30, 'Final')):
            op = row.operator('ff.frame', text=label, depress=sc.frame_current == f); op.frame = f
        col = lay.column(align=True)
        for k in ex.PARAMS: col.prop(group(sc), k, slider=True)
        row = lay.row(align=True); row.operator('ff.defaults'); row.operator('ff.rebuild', text='Recrear')
        lay.operator('ff.export', icon='EXPORT')


CLASSES = []


def register():
    for name, ex in EX.items():
        cls = make_group(name, ex); bpy.utils.register_class(cls); CLASSES.append(cls)
        setattr(bpy.types.Scene, f'ff_{name}', bpy.props.PointerProperty(type=cls))
    bpy.types.Scene.ff_ex = bpy.props.EnumProperty(name='Ejercicio', items=[(n, e.META[2], '') for n, e in EX.items()], update=on_exercise)
    for cls in (FF_OT_rebuild, FF_OT_defaults, FF_OT_frame, FF_OT_export, FF_PT_panel):
        bpy.utils.register_class(cls); CLASSES.append(cls)
    load_into_sliders(bpy.context.scene)


def unregister():
    for cls in reversed(CLASSES): bpy.utils.unregister_class(cls)
    CLASSES.clear()
    for name in EX:
        if hasattr(bpy.types.Scene, f'ff_{name}'): delattr(bpy.types.Scene, f'ff_{name}')
    if hasattr(bpy.types.Scene, 'ff_ex'): del bpy.types.Scene.ff_ex


if __name__ == '__main__':
    old = bpy.app.driver_namespace.get('ff_panel_unregister')
    if old:
        try: old()
        except Exception as e: print('ff_panel: desregistrar el anterior:', e)
    register(); bpy.app.driver_namespace['ff_panel_unregister'] = unregister
    print('Panel FormFit listo: visor 3D › barra lateral (N) › pestaña FormFit')
