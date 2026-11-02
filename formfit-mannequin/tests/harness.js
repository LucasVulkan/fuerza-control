// Carga prototype/viewer.html en Chromium headless (WebGL por SwiftShader) sirviendo three@0.147 desde node_modules.
// Expone window.__dbg (state, evaluate, POSES, REST, BN, ...). Uso: const { open } = require('./harness'); const { page, close } = await open();
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
async function open(viewport = { width: 1280, height: 800 }) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport });
  page.on('pageerror', e => console.log('ERR', e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) console.log('console', m.text()); });
  const html = '<!doctype html><meta charset="utf-8">' + fs.readFileSync(path.join(ROOT, 'prototype', 'viewer.html'), 'utf8');
  await page.route('**/*', r => { const u = r.request().url();
    if (u.includes('three@0.147.0/')) return r.fulfill({ path: path.join(ROOT, 'node_modules/three', u.split('three@0.147.0/')[1]), contentType: 'application/javascript' });
    if (u.startsWith('http://x/')) return r.fulfill({ body: html, contentType: 'text/html' });
    return r.abort(); });
  await page.goto('http://x/'); await page.waitForFunction(() => window.__ready, { timeout: 60000 });
  return { page, close: () => browser.close() };
}
module.exports = { open, ROOT };
