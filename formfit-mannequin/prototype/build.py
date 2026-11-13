"""Empaqueta el visor web en un único HTML (GLB en base64 + poses + three.js + runtime), sin nada de red.
Uso: python prototype/build.py  ->  prototype/viewer.html  y  mobile/assets/mannequin/viewer.html (la app lo carga en una WebView)"""
import base64, os
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
rd = lambda *p: open(os.path.join(*p), encoding='utf-8').read()
three = os.path.join(root, 'node_modules', 'three')
shell = rd(here, 'shell.html')
b64 = base64.b64encode(open(os.path.join(root, 'assets', 'mannequin.glb'), 'rb').read()).decode()
poses = rd(root, 'assets', 'poses.json')
js = rd(here, 'runtime.js')
# afinado del usuario (X03-27): un objeto por acción, de ajustes/<acción>.json (o de la carpeta FF_AJUSTES); sin archivos, {}
import json, glob
adir = os.environ.get('FF_AJUSTES') or os.path.join(root, 'ajustes')
ajustes = {os.path.splitext(os.path.basename(f))[0]: json.load(open(f, encoding='utf-8')) for f in sorted(glob.glob(os.path.join(adir, '*.json')))}
out = (shell + '<script type="application/octet-stream" id="model-b64">' + b64 + '</script>\n'
       + '<script type="application/json" id="poses-json">' + poses + '</script>\n'
       + '<script type="application/json" id="ajustes-json">' + json.dumps(ajustes).replace('</', '<\\/') + '</script>\n'
       + '<script>\n' + rd(three, 'build', 'three.min.js') + '\n</script>\n'
       + '<script>\n' + rd(three, 'examples', 'js', 'loaders', 'GLTFLoader.js') + '\n</script>\n<script>\n' + js + '</script>\n')
app = os.path.join(os.path.dirname(root), 'mobile', 'assets', 'mannequin')
os.makedirs(app, exist_ok=True)
# FF_NO_APP=1: no toca el visor de la app (para trabajar sin recargarle el visor a quien lo está probando en el móvil)
for d in ((here,) if os.environ.get('FF_NO_APP') else (here, app)):
    open(os.path.join(d, 'viewer.html'), 'w', encoding='utf-8').write(out)
print('viewer.html', len(out) // 1024, 'KB  ->  prototype/ y mobile/assets/mannequin/')
