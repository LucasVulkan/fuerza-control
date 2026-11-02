# Plan para llevar el maniquí a la app (Expo + React Native)

## Objetivo

Que la app tenga un componente `<ExerciseMannequin />` que se vea y se comporte igual que `prototype/viewer.html`, con la lógica en TypeScript y testeada.

## Arquitectura propuesta

```
src/features/mannequin/
  core/                      # TypeScript puro sin React, portado de runtime.js; testeable con vitest/jest
    types.ts                 # PosesFile, ExercisePose, BodyParams, ExerciseParams, PoseResult
    math.ts                  # QA, frame, deltaFrames, twoBone, poleOf (three.js Vector3/Quaternion)
    skeleton.ts              # REST, LOCAL_OFF, ORDER, KIDS, STRETCH, fkSub, authoredPose
    features.ts              # features(), socketRest()
    solveStand.ts            # solver sagital + demanda muscular
    balance.ts               # comOffset, midfootZ, lazo cerrado de phi
    evaluate.ts              # evaluate(ex, s, params, body) -> { pose, bar, plate, act, readout, warns }
    params.ts                # PARAMS por tipo de base, PRESETS, valores por defecto
  render/
    ExerciseMannequin.tsx    # <Canvas> de @react-three/fiber/native
    useMannequin.ts          # carga el GLB y aplica la pose a los huesos (mapa con sanitizeNodeName)
    materials.ts             # toon + contorno + shader de heatmap (onBeforeCompile)
    props.tsx                # barra, discos, prensa
  store/
    mannequinStore.ts        # Zustand: ejercicio, params por ejercicio, cuerpo del cliente, s / play
  assets/
    mannequin.glb
    poses/<exercise>.json    # un JSON por ejercicio (dividir poses.json)
```

La UI de sliders (`ExerciseControls.tsx`) usa los componentes del design system de FormFit, no los del prototipo.

## Pasos

1. **Dependencias:** `three`, `@react-three/fiber` (con `/native`), `expo-gl` y `expo-asset`. Opcionales: `@react-three/drei` (algunos helpers no funcionan en native) y `expo-file-system`.
   - Fija la versión de three. El prototipo usa r147; en versiones recientes GLTFLoader está en `three/examples/jsm/loaders/GLTFLoader.js` (o `three/addons`).
   - Hay que revisar `outputColorSpace` / `colorSpace` (antes `outputEncoding`) para que los colores planos no cambien.
2. **Portar `core/` 1:1 desde `runtime.js`**, sin tocar la matemática. Sustituciones necesarias:
   - quitar la dependencia de `state` global: `evaluate` recibe params y body como argumentos;
   - quitar `CUR_OFF` global: pasar los offsets explícitamente a `fkSub`;
   - `EXERCISES` se lee de `poses.json → meta`.
3. **Tests de `core/`:** portar `fidelity.js` y `balance.js` a vitest/jest, en Node y sin navegador. Las cifras de referencia actuales:
   - fidelidad: 0,0 mm;
   - prensa al final: 43 mm;
   - deslizamiento de pies: 0;
   - CdM: −2,8 cm (trasera) y −3,8 cm (frontal) en todos los casos;
   - por defecto: tronco a 27° (trasera) y 15° (frontal).
4. **Render en native:**
   - Cargar el GLB con `useGLTF` (o `GLTFLoader.parse` sobre un ArrayBuffer de `expo-asset`).
   - Huesos: `matrixAutoUpdate = false`, anular `updateMatrixWorld` y escribir `bone.matrixWorld.compose(...)` en cada frame (`useFrame`).
   - Mapear los nombres con `sanitizeNodeName` (los puntos desaparecen).
   - Copiar tal cual el contorno (segundo SkinnedMesh con `BackSide` e inflado por normal) y el shader del heatmap.
   - Cámara orbital con gestos (`react-native-gesture-handler`) o `OrbitControls` de drei/native.
5. **Rendimiento en móvil:**
   - La malla tiene unos 25.600 vértices y el contorno los duplica. Si va justo, exportar con Subsurf nivel 0, que se cambia en `export.py` (`m.levels = 1` → `0`).
   - Evaluar la pose solo cuando cambian `s` o los params, no por frame si está en pausa.
   - El lazo de equilibrio son unas 8 llamadas a `build`; si hiciera falta, cachear por (ejercicio, s cuantizado, params).
6. **Persistencia:** guardar `{ exerciseId, params, body }` por cliente o rutina (Supabase, si ya se usa en FormFit).
7. **Pipeline de contenido:** añadir un script npm `export:mannequin` que lance Blender headless y divida `poses.json` por ejercicio en `src/features/mannequin/assets/poses/`.

## Orden recomendado

1. `core/` y sus tests: es la parte crítica y no depende de la UI.
2. El render en una pantalla de prueba (`app/(dev)/mannequin.tsx`).
3. Los sliders con el design system.
4. Persistencia.
5. Nuevos tipos de base (bisagra, tumbado, colgado).
