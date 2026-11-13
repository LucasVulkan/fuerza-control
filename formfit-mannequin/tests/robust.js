// Prueba de robustez por barrido (X03-24, spec X03 §28): node tests/robust.js [ejercicio] [--gate]   (npm run robust [ejercicio])
// Por cada ejercicio con botón: todo por defecto, cada ajuste numérico visible en su mínimo y en su máximo, cada opción de cada selector y 40 combinaciones al
// azar con semilla fija (el cuerpo, por defecto). Cada caso recorre 61 puntos de la repetición y se mide contra siete criterios:
//   1 avisos     `warns` vacío en los 61 puntos
//   2 saltos     ningún hueso de las manos, antebrazos, brazos, rodillas, pies, pelvis, pecho y cabeza da un tirón: su desplazamiento cambia más de 2 cm de un paso al siguiente, o se mueve más de 3 cm entre dos puntos con un cambio de más de 1 cm, o más de 6 cm en cualquier caso
//   3 manos      el punto de agarre de cada mano a menos de 3 mm de su `grip`, si el resultado trae `grips`: en el jalón (X03-26) el hueco de la mano, el mismo punto con el que el solver coloca la muñeca (`hollowAt`); en los demás, `gripOf`
//   4 longitudes hombro→codo, codo→muñeca, cadera→rodilla y rodilla→tobillo no cambian más de 1 mm a lo largo de la repetición
//   5 números    ninguna posición NaN ni fuera de una caja de 3 m (x y z en ±1,5 m, y de −0,5 a 3 m)
//   6 muñeca     (solo el jalón) el ángulo mano–antebrazo alrededor del eje del puño no se aparta más de 8° del de la acción en ese mismo s
//   7 antebrazo  (solo el jalón) el exceso de ángulo antebrazo–cable, visto de lado, sobre el de la acción no pasa de 15° dentro del recorrido (hasta `sFin`)
// `--todos` lista cada caso que falla; `ROBUST_SEED=n` cambia la semilla de las combinaciones al azar. Sale con código ≠ 0 solo si falla un ejercicio de GATE (esos también corren en `npm test`, con `--gate`). Los demás son informativos.
const { open } = require('./harness');
const GATE = ['lat_pulldown'];   // deben pasar con 0 fallos; si tienen selector `gripType`, el barrido entero se repite con cada agarre
const ARGS = process.argv.slice(2), ONLY = ARGS.find(a => !a.startsWith('--')), GATE_ONLY = ARGS.includes('--gate');
const LIM = { step: 0.03, accel: 0.02, hand: 0.003, len: 0.001, wrist: 8, align: 15 }, N = 60, RANDOM = 40, SEED = +process.env.ROBUST_SEED || 20261112, BOX = { xz: 1.5, y0: -0.5, y1: 3 };
const CRIT = [['avisos', 'avisos'], ['saltos', 'saltos'], ['manos', 'manos'], ['longitudes', 'long.'], ['numeros', 'números'], ['muneca', 'muñeca'], ['antebrazo', 'antebr.']];

// ---- lo que corre dentro del visor: todos los casos de un ejercicio -> { casos, fallos por criterio, peor caso de cada uno }
function barrido({ ex, forceGrips, LIM, N, RANDOM, SEED, BOX }) {
  const D = __dbg, S = D.state; S.playing = false; S.exId = ex;
  const ps = D.PSET(ex).filter(p => !D.phide(ex, p)), def = Object.fromEntries(D.PSET(ex).map(p => [p.id, D.pdef(ex, p)]));
  const opts = p => p.options.map(o => o[0]).filter(v => !p.allow?.(ex) || p.allow(ex).includes(v));
  let seed = SEED; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const snap = (p, v) => +(Math.round((v - p.min) / p.step) * p.step + p.min).toFixed(4);
  const base = []; base.push({ nombre: 'todo por defecto', prm: {} });
  for (const p of ps) { if (p.options) { if (forceGrips && p.id === 'gripType') continue; for (const o of opts(p)) if (o !== def[p.id]) base.push({ nombre: `${p.id}=${o}`, prm: { [p.id]: o } }); }
    else for (const v of D.prange(ex, p)) if (v !== def[p.id]) base.push({ nombre: `${p.id}=${v}`, prm: { [p.id]: v } }); }
  for (let i = 0; i < RANDOM; i++) { const prm = {}; for (const p of ps) { if (forceGrips && p.id === 'gripType') continue; prm[p.id] = p.options ? opts(p)[Math.floor(rnd() * opts(p).length)] : snap(p, D.prange(ex, p)[0] + rnd() * (D.prange(ex, p)[1] - D.prange(ex, p)[0])); } base.push({ nombre: `azar ${i + 1}`, prm }); }
  const casos = forceGrips ? forceGrips.flatMap(g => base.map(c => ({ nombre: `${g} · ${c.nombre}`, prm: { ...c.prm, gripType: g } }))) : base;
  const TRACK = ['HAND.L', 'HAND.R', 'FORARM01.L', 'FORARM01.R', 'ARM01.L', 'ARM01.R', 'SHIN01.L', 'SHIN01.R', 'FOOT.L', 'FOOT.R', 'HIPS', 'CHEST', 'HEAD'].map(n => 'DEF-' + n);
  const SEG = [['ARM01', 'FORARM01'], ['FORARM01', 'HAND'], ['THIGH01', 'SHIN01'], ['SHIN01', 'FOOT']].flatMap(([a, b]) => ['L', 'R'].map(s => [`DEF-${a}.${s}`, `DEF-${b}.${s}`]));
  const res = { casos: casos.length, fallos: Object.fromEntries(['avisos', 'saltos', 'manos', 'longitudes', 'numeros', 'muneca', 'antebrazo'].map(k => [k, 0])), peor: {} };
  res.lista = []; const worst = (k, valor, c, txt) => { res.lista.push(`${k}: ${c.nombre} -> ${txt}`); if (!res.peor[k] || valor > res.peor[k].valor) res.peor[k] = { valor, caso: c.nombre + ' ' + JSON.stringify(c.prm), txt }; };
  const meta = D.POSES.exercises[ex].meta, jalon = meta.impl === 'barra_jalon';
  res.jalon = jalon;
  for (const c of casos) {
    Object.assign(S.per[ex], def, c.prm);
    let warns = 0, aviso = '', paso = 0, acel = 0, quienP = '', quienA = '', mano = 0, mun = 0, ant = -Infinity, ok = true, err = null; const pos = [], len = SEG.map(() => [Infinity, -Infinity]);
    const act = jalon ? D.variantFor(ex, S.per[ex].gripType) || ex : ex;   // la acción del agarre elegido
    try {
      for (let i = 0; i <= N; i++) {
        const r = D.evaluate(ex, i / N); warns += r.warns.length; if (r.warns.length && !aviso) aviso = `s=${(i / N).toFixed(2)} ${r.warns[0]}`;
        const P = TRACK.map(n => r.pose[n].p.clone()); pos.push(P);
        for (const p of P) if (![p.x, p.y, p.z].every(Number.isFinite) || Math.abs(p.x) > BOX.xz || Math.abs(p.z) > BOX.xz || p.y < BOX.y0 || p.y > BOX.y1) ok = false;
        SEG.forEach(([a, b], j) => { const d = r.pose[a].p.distanceTo(r.pose[b].p); len[j][0] = Math.min(len[j][0], d); len[j][1] = Math.max(len[j][1], d); });
        if (r.grips && r.grips.length) { const lados = r.grips.length === 2 ? ['L', 'R'] : [meta.hand || 'L']; lados.forEach((s, j) => { mano = Math.max(mano, (jalon ? D.hollowAt(act, r.pose, s) : D.gripOf(r.pose, s)).distanceTo(r.grips[j])); }); }
        if (r.align) { mun = Math.max(mun, r.align.wrist * 180 / Math.PI); ant = Math.max(ant, r.align.excess * 180 / Math.PI); }
      }
    } catch (e) { ok = false; err = e.message; }
    if (!err) {
      for (let j = 0; j < TRACK.length; j++) for (let i = 1; i <= N; i++) { const d = pos[i][j].clone().sub(pos[i - 1][j]); if (d.length() > paso) { paso = d.length(); quienP = `${TRACK[j].slice(4)} s=${(i / N).toFixed(2)}`; }
        if (i > 1) { const a = d.distanceTo(pos[i - 1][j].clone().sub(pos[i - 2][j])); if (a > acel) { acel = a; quienA = `${TRACK[j].slice(4)} s=${(i / N).toFixed(2)}`; } } }
    }
    const rig = Math.max(...len.map(([a, b]) => b - a));
    if (warns) { res.fallos.avisos++; worst('avisos', warns, c, aviso); }
    if (acel > LIM.accel || paso > 2 * LIM.step || (paso > LIM.step && acel > LIM.accel / 2)) { /* un paso largo pero suave (movimiento rápido, sin tirón) no es un salto */ res.fallos.saltos++; worst('saltos', Math.max(paso / LIM.step, acel / LIM.accel), c, `paso máx ${(paso * 100).toFixed(1)} cm (${quienP}) · cambio de paso máx ${(acel * 100).toFixed(1)} cm (${quienA})`); }
    if (mano > LIM.hand) { res.fallos.manos++; worst('manos', mano / LIM.hand, c, `${(mano * 1000).toFixed(1)} mm`); }
    if (rig > LIM.len) { res.fallos.longitudes++; worst('longitudes', rig / LIM.len, c, `${(rig * 1000).toFixed(1)} mm`); }
    if (mun > LIM.wrist) { res.fallos.muneca++; worst('muneca', mun / LIM.wrist, c, `${mun.toFixed(1)}° de la acción`); }
    if (ant > LIM.align + 1e-6) { res.fallos.antebrazo++; worst('antebrazo', ant / LIM.align, c, `exceso ${ant.toFixed(1)}°`); }
    if (!ok) { res.fallos.numeros++; worst('numeros', 1, c, err || 'NaN o fuera de la caja'); }
    res.max = res.max || { paso: 0, acel: 0, mano: 0, rig: 0 }; res.max.paso = Math.max(res.max.paso, paso); res.max.acel = Math.max(res.max.acel, acel); res.max.mano = Math.max(res.max.mano, mano); res.max.rig = Math.max(res.max.rig, rig);
  }
  Object.assign(S.per[ex], def);
  return res;
}

(async () => {
  const { page, close } = await open(); let bad = 0;
  const lista = await page.evaluate(() => Object.keys(__dbg.EXERCISES).filter(id => !__dbg.VARIANT(id)));
  const rows = [];
  for (const ex of lista) {
    const gate = GATE.includes(ex); if ((ONLY && ex !== ONLY) || (GATE_ONLY && !gate)) continue;
    const t0 = Date.now();
    const forceGrips = gate ? await page.evaluate(ex => { const p = __dbg.PSET(ex).find(p => p.id === 'gripType' && !__dbg.phide(ex, p)); return p ? p.options.map(o => o[0]) : null; }, ex) : null;
    const r = await page.evaluate(barrido, { ex, forceGrips, LIM, N, RANDOM, SEED, BOX });
    r.ex = ex; r.gate = gate; r.seg = ((Date.now() - t0) / 1000).toFixed(1); rows.push(r);
    const total = Object.values(r.fallos).reduce((a, b) => a + b, 0); if (gate && total) bad++;
  }
  console.log(`${'ejercicio'.padEnd(26)}${'casos'.padStart(6)}${CRIT.map(([, t]) => t.padStart(11)).join('')}   puerta`);
  for (const r of rows) console.log(`${r.ex.padEnd(26)}${String(r.casos).padStart(6)}${CRIT.map(([k]) => String(!r.jalon && (k === 'muneca' || k === 'antebrazo') ? '—' : r.fallos[k]).padStart(11)).join('')}   ${r.gate ? (Object.values(r.fallos).some(x => x) ? 'FALLA' : 'ok') : '-'}  (${r.seg} s)`);
  if (ARGS.includes('--todos')) for (const r of rows) console.log(`\n${r.ex}: todos los casos que fallan\n  ${r.lista.join('\n  ')}`);
  for (const r of rows) { const w = Object.entries(r.peor); if (!w.length) continue; console.log(`\n${r.ex}: peor caso de cada criterio`);
    for (const [k, v] of w) console.log(`  ${k.padEnd(11)} ${v.txt}  ←  ${v.caso}`); }
  await close(); if (bad) { console.log(`\nFALLO: ${bad} ejercicio(s) de la puerta con fallos`); process.exit(1); }
})();
