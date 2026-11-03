"""Peso muerto rumano (tipo de base `hinge`): acción `romanian_deadlift`. Empieza arriba (frame 1, bloqueo) y baja con la
rodilla casi bloqueada hasta la barra a media tibia (frame 30).

Es el vecino del convencional (X01 §2.14): misma geometría (deadlift.py), con el punto bajo más alto y menos rodilla.
En la app, con más rodilla y profundidad hasta el suelo se acerca al convencional.

Se usa igual que deadlift.py: panel FormFit, Text Editor › Run Script, o
  blender -b --factory-startup --python blender/ejercicios/romanian_deadlift.py -- entrada.blend salida.blend
Es una base: la espalda, la cabeza y el recorrido entre claves se retocan a mano en Blender.
"""
import os, importlib.util

META = ('romanian_deadlift', 'hinge', 'Peso muerto rumano')
PARAMS = {
    'STANCE_X':    (0.11, 0.06, 0.30, 'Tobillos, media anchura (m)'),
    'TOE_OUT':     (5.0, -5.0, 30.0, 'Puntas hacia fuera (°)'),
    'GRIP_HALF':   (0.26, 0.18, 0.45, 'Agarre, media anchura (m)'),
    'BAR_LOW':     (0.30, 0.15, 0.60, 'Barra abajo, altura del centro (m)'),
    'SHIN_START':  (4.0, 0.0, 15.0, 'Tibia abajo (°)'),
    'SH_AHEAD':    (0.03, -0.04, 0.10, 'Hombros por delante de la barra (m)'),
    'BAR_F':       (0.061, 0.02, 0.12, 'Barra delante del tobillo (m)'),
    'SHIN_END':    (3.0, 0.0, 12.0, 'Tibia al bloquear (°)'),
    'HIP_END_F':   (-0.02, -0.12, 0.06, 'Cadera al bloquear, delante del tobillo (m)'),
    'THIGH_FRONT': (0.08, 0.04, 0.12, 'Grosor del muslo delante del fémur (m)'),
}


def _deadlift():
    """deadlift.py, junto a este archivo (o en ejercicios/ junto al .blend si se ejecuta desde el Text Editor)."""
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, 'deadlift.py')
    if not os.path.exists(path):
        import bpy; path = os.path.join(os.path.dirname(bpy.data.filepath), 'ejercicios', 'deadlift.py')
    spec = importlib.util.spec_from_file_location('ffej_deadlift_base', path)
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


def frames(F, p):
    low, lock = [pose for _, pose in _deadlift().frames(F, p)]   # el convencional da (abajo, bloqueo)
    return [(1, lock), (30, low)]                               # el rumano empieza arriba


if __name__ == '__main__':
    import bpy, sys, types
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None
    if argv: bpy.ops.wm.open_mainfile(filepath=argv[0])
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, here if os.path.exists(os.path.join(here, 'ffpose.py')) else os.path.dirname(bpy.data.filepath))
    import ffpose as F
    importlib.reload(F)
    F.run(types.SimpleNamespace(META=META, PARAMS=PARAMS, frames=frames))
    bpy.context.scene.frame_set(30)
    if argv: bpy.ops.wm.save_as_mainfile(filepath=argv[1]); print('SAVED', argv[1])
