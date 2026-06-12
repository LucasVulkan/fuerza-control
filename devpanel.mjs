/**
 * devpanel — tiny local control panel for the project.
 *
 *   npm run panel        → opens http://localhost:5174
 *
 * Zero dependencies (built-in http + child_process). Shows project version,
 * git branch / last commit, and a button to run the test suite with live output.
 */
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = 5174;

const sh = (cmd) =>
  new Promise((resolve) => {
    exec(cmd, { cwd: ROOT, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ code: err?.code ?? 0, out: (stdout || '') + (stderr || '') });
    });
  });

async function projectInfo() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const [branch, commit, status] = await Promise.all([
    sh('git rev-parse --abbrev-ref HEAD'),
    sh('git log -1 --format="%h %s"'),
    sh('git status --porcelain'),
  ]);
  // Commits committed locally but not yet pushed to the upstream branch.
  const aheadRes = await sh('git rev-list --count @{u}..HEAD');
  const ahead = /^\d+$/.test(aheadRes.out.trim()) ? Number(aheadRes.out.trim()) : 0;
  return {
    name:    'Forma Fit',
    version: pkg.version,
    branch:  branch.out.trim() || '—',
    commit:  commit.out.trim() || '—',
    dirty:   status.out.trim().length > 0,
    ahead,
  };
}

const server = createServer(async (req, res) => {
  if (req.url === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(await projectInfo()));
    return;
  }
  if (req.url === '/api/test' && req.method === 'POST') {
    const { code, out } = await sh('npm test');
    // Parse Vitest summary line, e.g. "Tests  30 passed (30)"
    const m = out.match(/Tests\s+(\d+)\s+passed(?:\s+\|\s+(\d+)\s+failed)?\s+\((\d+)\)/);
    const passed = m ? Number(m[1]) : null;
    const failed = m && m[2] ? Number(m[2]) : (code === 0 ? 0 : null);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: code === 0, passed, failed, total: m ? Number(m[3]) : null, out }));
    return;
  }
  if (req.url === '/api/push' && req.method === 'POST') {
    const { code, out } = await sh('git push');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: code === 0, out: out.trim() || '(sin salida)' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`devpanel → ${url}`);
  const open = process.platform === 'win32' ? `start "" "${url}"`
             : process.platform === 'darwin' ? `open "${url}"`
             : `xdg-open "${url}"`;
  exec(open, () => {});
});

const HTML = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>devpanel</title>
<style>
  :root { --bg:#0f1115; --card:#181b22; --border:#262b36; --text:#e6e8ec; --muted:#8a92a3;
          --green:#3fb950; --red:#f85149; --accent:#3b82f6; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text);
         font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif; padding:28px; }
  .wrap { max-width:760px; margin:0 auto; display:flex; flex-direction:column; gap:18px; }
  h1 { font-size:18px; margin:0; display:flex; align-items:center; gap:10px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:18px; }
  .meta { display:grid; grid-template-columns:auto 1fr; gap:6px 16px; font-size:13px; }
  .meta dt { color:var(--muted); }
  .meta dd { margin:0; font-variant-numeric:tabular-nums; }
  .pill { display:inline-block; padding:2px 9px; border-radius:999px; font-size:12px; font-weight:600; }
  .pill.clean { background:rgba(63,185,80,.15); color:var(--green); }
  .pill.dirty { background:rgba(248,81,73,.15); color:var(--red); }
  button { background:var(--accent); color:#fff; border:none; border-radius:8px;
           padding:10px 18px; font-size:14px; font-weight:600; cursor:pointer; }
  button.secondary { background:#30363d; }
  button:disabled { opacity:.5; cursor:default; }
  .row { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
  .banner { font-weight:700; font-size:15px; padding:9px 14px; border-radius:8px; display:none; }
  .banner.pass { display:block; background:rgba(63,185,80,.13); color:var(--green); border:1px solid rgba(63,185,80,.3); }
  .banner.fail { display:block; background:rgba(248,81,73,.13); color:var(--red); border:1px solid rgba(248,81,73,.3); }
  pre { background:#0b0d11; border:1px solid var(--border); border-radius:8px; padding:14px;
        overflow:auto; max-height:46vh; font-size:12.5px; white-space:pre-wrap; margin:0; color:#c9d1d9; }
  .muted { color:var(--muted); font-size:12px; }
</style></head>
<body><div class="wrap">
  <h1>🏋️ <span id="title">devpanel</span></h1>

  <div class="card">
    <dl class="meta">
      <dt>Versión</dt><dd id="version">…</dd>
      <dt>Rama</dt><dd id="branch">…</dd>
      <dt>Último commit</dt><dd id="commit">…</dd>
      <dt>Estado</dt><dd id="dirty">…</dd>
      <dt>Sin subir</dt><dd id="ahead">…</dd>
    </dl>
    <div class="row" style="margin-top:14px">
      <button id="pushBtn" class="secondary" onclick="pushGit()">⬆ Push a git</button>
      <span id="pushStatus" class="muted"></span>
    </div>
    <pre id="pushOut" style="margin-top:10px;display:none"></pre>
  </div>

  <div class="card">
    <div class="row" style="margin-bottom:14px">
      <button id="runBtn" onclick="runTests()">▶ Correr tests</button>
      <span id="status" class="muted">Listo.</span>
    </div>
    <div id="banner" class="banner"></div>
    <pre id="out" style="margin-top:12px;display:none"></pre>
  </div>
</div>

<script>
async function loadInfo() {
  const i = await (await fetch('/api/info')).json();
  document.getElementById('title').textContent = i.name + ' — devpanel';
  document.getElementById('version').textContent = 'v' + i.version;
  document.getElementById('branch').textContent = i.branch;
  document.getElementById('commit').textContent = i.commit;
  document.getElementById('dirty').innerHTML = i.dirty
    ? '<span class="pill dirty">cambios sin commitear</span>'
    : '<span class="pill clean">limpio</span>';
  document.getElementById('ahead').textContent =
    i.ahead > 0 ? \`\${i.ahead} commit\${i.ahead !== 1 ? 's' : ''}\` : 'todo subido';
}

async function pushGit() {
  const btn = document.getElementById('pushBtn');
  const st  = document.getElementById('pushStatus');
  const out = document.getElementById('pushOut');
  btn.disabled = true; st.textContent = 'Subiendo…'; st.style.color = '';
  out.style.display = 'none';
  try {
    const r = await (await fetch('/api/push', { method: 'POST' })).json();
    out.textContent = r.out; out.style.display = 'block';
    st.textContent  = r.ok ? '✓ Push hecho' : '✗ Falló el push';
    st.style.color  = r.ok ? 'var(--green)' : 'var(--red)';
  } catch (e) {
    st.textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false;
    loadInfo(); // refresh "sin subir" counter
  }
}

async function runTests() {
  const btn = document.getElementById('runBtn');
  const status = document.getElementById('status');
  const banner = document.getElementById('banner');
  const out = document.getElementById('out');
  btn.disabled = true; status.textContent = 'Corriendo…';
  banner.className = 'banner'; out.style.display = 'none';
  const t0 = performance.now();
  try {
    const r = await (await fetch('/api/test', { method: 'POST' })).json();
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    out.textContent = r.out; out.style.display = 'block';
    if (r.ok) {
      banner.className = 'banner pass';
      banner.textContent = \`✓ \${r.passed ?? ''} tests en verde (\${secs}s)\`;
    } else {
      banner.className = 'banner fail';
      banner.textContent = \`✗ \${r.failed ?? '?'} fallaron\${r.passed != null ? ' · ' + r.passed + ' ok' : ''} (\${secs}s)\`;
    }
    status.textContent = 'Hecho.';
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false;
    loadInfo(); // refresh dirty/commit in case it changed
  }
}

loadInfo();
</script>
</body></html>`;
