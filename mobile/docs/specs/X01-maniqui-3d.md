# Spec — Maniquí 3D de ejercicios          (archivo: X01-maniqui-3d.md)

> Tema: ejercicios
> En corto: Un maniquí 3D animado por ejercicio que el entrenador ajusta (profundidad, pies, agarre…) y que se adapta a las medidas del cliente sin perder el equilibrio.
> Inicio: 2026-11-02
> Fin: 2026-11-02
> Fase X01-01 · hecho · Prueba en WebView desde Expo Go · §2
>
> Estado: el sistema llega de un chat externo y vive en [`formfit-mannequin/`](../../../formfit-mannequin/) (Blender → `mannequin.glb` + `poses.json` → `runtime.js`). Su documento principal es [`HANDOFF.md`](../../../formfit-mannequin/docs/HANDOFF.md). X01-01 lo mete en la app tal cual, dentro de una WebView, para decidir si ese camino basta o hace falta portarlo a render nativo.

## 1. Contexto

Tres ejercicios autorados en Blender (sentadilla trasera, frontal y prensa). Con los valores por defecto el visor reproduce la pose de Blender al milímetro; sliders y medidas del cliente solo añaden la diferencia que calcula el solver, y un lazo cerrado mantiene el centro de masas.

Dos caminos para la app:

- **A · WebView** con el visor autocontenido. Reutiliza el 100 % del código y de los tests; se paga con la apertura (1–2 s) y una frontera de mensajes.
- **B · nativo** con `expo-gl` + `@react-three/fiber/native` ([`PORTING.md`](../../../formfit-mannequin/docs/PORTING.md), escrito para otra estructura de app: hay que adaptarlo a `mobile/src/`).

En la WebView el 3D corre en el motor del navegador del sistema (V8/JSC, con JIT), no en Hermes, así que lo que se ve en Expo Go vale para la build.

## 2. X01-01 · Prueba en WebView

- `formfit-mannequin/prototype/build.py` mete three.js dentro del HTML (antes venía de un CDN) y escribe una copia en `mobile/assets/mannequin/viewer.html`.
- `metro.config.js` trata `.html` como asset; `expo-asset` lo deja en un `file://` local y `react-native-webview` lo carga.
- Pantalla `MannequinTestScreen`, solo en desarrollo: menú › Desarrollador › «Maniquí 3D (prueba)». Enseña el visor con su propia UI web.

Qué hay que mirar al probar: cuánto tarda en abrir, si el giro con el dedo y los sliders van fluidos, si la animación da tirones, y si el texto se lee a ancho de móvil. Las fuentes del visor vienen de Google Fonts: sin red se ve con la de sistema. Ya visto en el navegador a 375 px: la fila de botones de arriba (Frente · Lateral · 45° · Músculos…) se solapa; es de la UI web, que la siguiente tarea sustituye.

Si convence, la siguiente tarea quita la UI web del visor, deja solo el lienzo y pone los sliders nativos (con i18n), hablando por `postMessage`.

**Probar X01-01**

- [ ] En Expo Go: menú › Desarrollador › «Maniquí 3D (prueba)» abre el visor y sale el maniquí animado, sin red.
- [ ] Girar y acercar con el dedo va fluido y no se pelea con el gesto de volver atrás.
- [ ] Los sliders y el cambio de ejercicio (trasera · frontal · prensa) responden sin tirones.
- [ ] Apuntar cuánto tarda en abrir la primera vez y las siguientes.
