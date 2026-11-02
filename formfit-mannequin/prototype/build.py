"""Empaqueta el visor web en un único HTML (GLB en base64 + poses + runtime).
Uso: python3 prototype/build.py  ->  prototype/viewer.html"""
import base64, os
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
shell = open(os.path.join(here, 'shell.html')).read()
b64 = base64.b64encode(open(os.path.join(root, 'assets', 'mannequin.glb'), 'rb').read()).decode()
poses = open(os.path.join(root, 'assets', 'poses.json')).read()
js = open(os.path.join(here, 'runtime.js')).read()
out = (shell + '<script type="application/octet-stream" id="model-b64">' + b64 + '</script>\n'
       + '<script type="application/json" id="poses-json">' + poses + '</script>\n'
       + '<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js"></script>\n'
       + '<script src="https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js"></script>\n<script>\n' + js + '</script>\n')
open(os.path.join(here, 'viewer.html'), 'w').write(out); print('prototype/viewer.html', len(out) // 1024, 'KB')
