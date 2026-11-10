"""Jalón con agarre supino: variante de `lat_pulldown` con acción propia (ff_variant_of = lat_pulldown, ff_axis = grip,
ff_value = supino). Sale del mismo script que el prono (lat_pulldown.py, make('supino')); cambian el giro de la mano, los codos
y la anchura por defecto.
  blender -b --factory-startup --python blender/ejercicios/lat_pulldown_supino.py -- entrada.blend salida.blend
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lat_pulldown as B

META = ('lat_pulldown_supino', 'cable', 'Jalón supino')
PARAMS = {**B.PARAMS, 'GRIP_HALF': (0.17, 0.08, 0.50, 'Agarre, media anchura (m)')}
frames, setup = B.make('supino')

if __name__ == '__main__':
    B.main(META, PARAMS, frames, setup)
