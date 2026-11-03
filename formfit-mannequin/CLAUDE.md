# FormFit · Maniquí 3D de ejercicios

Módulo de la app FormFit (React Native + Expo + TypeScript + Expo Router + Zustand). Muestra un maniquí 3D por ejercicio con:

- pose de inicio y final autoradas en Blender;
- sliders del entrenador (profundidad, anchura y rotación de pies, agarre, altura de barra, carga, recorrido…);
- adaptación a las proporciones del cliente (altura, fémur, tibia, tronco, dorsiflexión de tobillo);
- autocorrección del equilibrio (centro de masas sobre el mediopié);
- mapa de calor de demanda muscular;
- estética toon (colores planos, contorno, sombra suave).

Lee `docs/HANDOFF.md` antes de tocar nada: explica el pipeline completo y por qué cada pieza es como es.

## Estructura

```
blender/     FormFit_Maniqui.blend (rig + 5 ejercicios), export.py, ffpose.py (posar por script), ff_panel.py (deslizadores en Blender),
             ejercicios/ (un .py por ejercicio: META, PARAMS, frames), prep_rig.py, autopose.py, rigui.py, legacy/
assets/      mannequin.glb + poses.json  (SALIDA del exportador; no editar a mano)
prototype/   runtime.js (toda la lógica), shell.html (UI web), build.py -> viewer.html (visor autocontenido)
tests/       harness.js (Chromium headless + WebGL SwiftShader), fidelity.js, balance.js, screenshots.js
docs/        HANDOFF.md (documento principal), PORTING.md (plan para llevarlo a la app RN)
```

## Comandos

```bash
npm i                                   # three@0.147.0 + playwright (solo para el prototipo y los tests)
npx playwright install chromium         # si no hay navegador

# Blender -> assets. En este equipo: Blender 5.0, sin PATH, y siempre con --factory-startup (un add-on falla en -b)
B="C:/Program Files/Blender Foundation/Blender 5.0/blender.exe"
"$B" -b --factory-startup --python blender/export.py -- blender/FormFit_Maniqui.blend assets/
#   opcional: 3er argumento = guardar .blend corregido; --exercises back_squat,leg_press para exportar solo esos
# Posar un ejercicio por script (crea o reemplaza su acción): ver HANDOFF §2.5
"$B" -b --factory-startup --python blender/ejercicios/deadlift.py -- blender/FormFit_Maniqui.blend blender/FormFit_Maniqui.blend

npm run build:viewer                    # prototype/viewer.html (abrir en el navegador)
npm test                                # build + fidelidad + equilibrio
npm run shots                           # capturas en tests/shots/ para revisar visualmente
```

## Reglas que no se pueden romper

1. **Con los valores por defecto, el resultado debe ser la pose de Blender**: 0,0 mm en las claves de inicio y final. La prensa es la excepción documentada (pelvis fija al asiento). `tests/fidelity.js` lo comprueba; si falla, algo está mal.
2. **Los pies no deslizan**: tobillos y pies salen de las transformaciones exportadas, no del FK interpolado.
3. **Correcciones como diferencias**: el solver se evalúa con el cuerpo actual y con el de referencia, y solo se aplica la diferencia. El equilibrio final se hace en lazo cerrado sobre la pose real.
4. **Longitudes rígidas**: nada de IK stretch. Si en Blender una pierna no llega, el exportador baja el TORSO; no estires huesos.
5. **Nombres de huesos**: GLTFLoader quita los puntos (`DEF-HAND.L` → `DEF-HANDL`). Mapea siempre con `THREE.PropertyBinding.sanitizeNodeName`.
6. **Convención de ejes**: glTF tiene Y arriba y +Z delante. Exportador: posiciones `C·p`; rotaciones de hueso `C @ R`, no `C R Cᵀ`. Ver HANDOFF §3.
7. Después de tocar `runtime.js` o el exportador: `npm test` y `npm run shots`, y mira las capturas.

## Idioma y estilo

- La UI y los comentarios están en español.
- El usuario es desarrollador y diseñador; hace a mano en Blender los retoques finos de pose y espera que la pose base automática y los sliders salgan del código.
