// Motor de demanda (X03-10, spec §14): masas, equilibrio de fuerzas, calibración contra el modelo anterior, simetría y dirección de los cambios.
// Las pruebas 0-3 son de física/calibración y fallan el test; en las 4-6, 8 y 9 (qué sube y qué baja al cambiar un ajuste) un fallo se avisa pero no falla. La 7 (dominada), la 10 y la 11 (X03-16), la 12 (ángulos anatómicos, X03-18) la 13 (papel de cada músculo, X03-19), la 14 (jalón), la 15 (curvatura, X03-20), la 16-18 (maneral por el cable, jalón por delante y juego escapular, X03-22/23) sí fallan.
const { open } = require('./harness');
// act de referencia (s = 1, todo por defecto) del modelo de cuatro masas anterior, apuntados antes de borrarlo
const REF = { back_squat: { quads: 1, glutes: 0.6799 }, front_squat: { quads: 1, glutes: 0.5985 }, leg_press: { quads: 0.6528, glutes: 0.936 } };
(async () => { const { page, close } = await open();
  const txt = await page.evaluate(REF => { const D = __dbg, S = D.state, out = []; let fail = 0; S.playing = false;
    const f3 = v => v.toFixed(3);
    // evalúa con cuerpo y ajustes cambiados y los restaura
    const ev = (ex, s, body = {}, prm = {}) => { const sb = { ...S.body }, sp = { ...S.per[ex] }; Object.assign(S.body, body); Object.assign(S.per[ex], prm); S.exId = ex;
      try { return D.evaluate(ex, s); } finally { S.body = sb; S.per[ex] = sp; } };
    const comp = (r, id, c) => r.dem.joints.find(j => j.id === id).comp[c];
    const ok = (n, cond, txt, soft) => { out.push(`${cond ? 'ok   ' : soft ? 'AVISO' : 'FALLO'} ${n} ${txt}`); if (!cond && !soft) fail++; };

    // 0. masas: suman 1 y su centro de masas coincide con comOffset
    for (const ex of ['back_squat', 'deadlift', 'pullup']) for (const s of [0, 0.5, 1]) {
      const r = ev(ex, s), parts = D.bodyParts(r.pose), m = parts.reduce((a, p) => a + p.m, 0), z = parts.reduce((a, p) => a + p.m * p.c.z, 0);
      const ref = D.comOffset(r.pose, r.bar.center, 0) + D.midfootZ(r.pose);
      ok('0 masas', Math.abs(m - 1) < 1e-9 && Math.abs(z - ref) < 1e-4, `${ex} s=${s}: masas ${m.toFixed(6)} · CdM ${(z * 1000).toFixed(2)} mm vs comOffset ${(ref * 1000).toFixed(2)} mm`);
    }
    // 1. equilibrio: las fuerzas suman cero (pesos + cargas + apoyos)
    for (const ex of Object.keys(D.EXERCISES).filter(e => ['stand', 'hinge', 'row', 'hang'].includes(D.EXERCISES[e].base))) for (const s of [0, 0.5, 1]) {
      const r = ev(ex, s), t = r.dem.forces.reduce((a, x) => a.add(x.f), new D.THREE.Vector3());
      ok('1 equilibrio', Math.max(Math.abs(t.x), Math.abs(t.y), Math.abs(t.z)) < 1e-6, `${ex} s=${s}: suma ${t.toArray().map(v => v.toExponential(1)).join(' ')}`);
    }
    // 2. calibración: quads y glúteo de las sentadillas y la prensa, a ±0,10 de los del modelo anterior
    for (const [ex, ref] of Object.entries(REF)) { const a = ev(ex, 1).act;
      for (const k of ['quads', 'glutes']) ok('2 calibración', Math.abs(a[k] - ref[k]) <= 0.10, `${ex} ${k} ${f3(a[k])} (antes ${ref[k]})`); }
    // 3. simetría
    { const r = ev('back_squat', 1), l = comp(r, 'knee.L', 'ext'), rr = comp(r, 'knee.R', 'ext');
      ok('3 simetría', Math.abs(l - rr) <= 0.05 * Math.max(Math.abs(l), Math.abs(rr)), `back_squat knee.L ${f3(l)} · knee.R ${f3(rr)}`); }
    // 4. rodillas adelante
    { const a = ev('back_squat', 1), b = ev('back_squat', 1, {}, { knees: 10 });
      ok('4 rodillas adelante', comp(b, 'knee.L', 'ext') > comp(a, 'knee.L', 'ext') && comp(b, 'hip.L', 'ext') < comp(a, 'hip.L', 'ext'),
        `knee.ext ${f3(comp(a, 'knee.L', 'ext'))} -> ${f3(comp(b, 'knee.L', 'ext'))} · hip.ext ${f3(comp(a, 'hip.L', 'ext'))} -> ${f3(comp(b, 'hip.L', 'ext'))}`, true); }
    // 5. fémur largo
    { const a = ev('back_squat', 1), b = ev('back_squat', 1, { femur: 112, tibia: 98, torso: 95 });
      ok('5 fémur largo', comp(b, 'hip.L', 'ext') > comp(a, 'hip.L', 'ext'), `hip.ext ${f3(comp(a, 'hip.L', 'ext'))} -> ${f3(comp(b, 'hip.L', 'ext'))}`, true); }
    // 6. bisagra rígida en el punto bajo
    { const E = D.POSES.exercises.deadlift, K = [E.start, ...(E.mid || []), E.end], low = K.reduce((a, k) => k.bar.center[1] < a.bar.center[1] ? k : a), sB = low === K[0] ? 0 : low === K[K.length - 1] ? 1 : low.s;
      // con la carga por defecto hams y erect ya saturan en 1 (caps de la spec), así que se mira el momento sin recortar:
      // más hip.ext (isquios) y lumbar.ext (erectores), menos knee.ext (cuádriceps)
      const ra = ev('deadlift', sB), rb = ev('deadlift', sB, {}, { knees: -40 }), g = (r, id, c) => f3(comp(r, id, c));
      ok('6 bisagra rígida', comp(rb, 'hip.L', 'ext') > comp(ra, 'hip.L', 'ext') && comp(rb, 'lumbar', 'ext') > comp(ra, 'lumbar', 'ext') && comp(rb, 'knee.L', 'ext') < comp(ra, 'knee.L', 'ext'),
        `hip.ext ${g(ra, 'hip.L', 'ext')} -> ${g(rb, 'hip.L', 'ext')} · lumbar.ext ${g(ra, 'lumbar', 'ext')} -> ${g(rb, 'lumbar', 'ext')} · knee.ext ${g(ra, 'knee.L', 'ext')} -> ${g(rb, 'knee.L', 'ext')} (act: hams ${f3(ra.act.hams)} -> ${f3(rb.act.hams)} · erect ${f3(ra.act.erect)} -> ${f3(rb.act.erect)} · quads ${f3(ra.act.quads)} -> ${f3(rb.act.quads)})`, true); }
    // 7. dominada
    { const a = ev('pullup', 0.5).act;
      ok('7 dominada', a.lats > 0.2 && a.biceps > 0.1 && a.quads < 0.05, `lats ${f3(a.lats)} · biceps ${f3(a.biceps)} · quads ${f3(a.quads)}`); }
    // 8. polea
    { const r = ev('cable_row', 1), j = id => r.dem.joints.find(x => x.id === id);
      ok('8 polea', r.act.lats > 0.1 && r.act.erect > 0 && j('knee.L').M === null && j('hip.L').M === null, `lats ${f3(r.act.lats)} · erect ${f3(r.act.erect)} · knee.L ${j('knee.L').M} · hip.L ${j('hip.L').M}`, true); }
    // 9. carga
    { const ra = ev('back_squat', 1, {}, { load: 100 }), rb = ev('back_squat', 1, {}, { load: 200 }), a = ra.act, b = rb.act;   // quads ya satura en 1: se mira el momento de la rodilla
      ok('9 carga', comp(rb, 'knee.L', 'ext') > comp(ra, 'knee.L', 'ext') && b.glutes > a.glutes && b.erect > a.erect, `knee.ext ${f3(comp(ra, 'knee.L', 'ext'))} -> ${f3(comp(rb, 'knee.L', 'ext'))} · quads ${f3(a.quads)} -> ${f3(b.quads)} · glutes ${f3(a.glutes)} -> ${f3(b.glutes)} · erect ${f3(a.erect)} -> ${f3(b.erect)}`, true); }
    // 10. relativa (X03-16/19): en cada acción, el mayor raw / PEAK de los músculos PRINCIPALES a lo largo de los 31 puntos del recorrido es 1 (el más exigido llega al máximo en su punto más duro)
    for (const ex of ['back_squat', 'deadlift', 'pullup', 'cable_row']) { const { PEAK } = D.repPeak(ex); let mx = 0, who = '';
      for (let j = 0; j <= 30; j++) { const raw = ev(ex, j / 30).dem.raw; for (const m of D.PAPEL[ex].p) if (raw[m] / PEAK > mx) { mx = raw[m] / PEAK; who = m; } }
      ok('10 relativa', Math.abs(mx - 1) <= 0.001, `${ex}: PEAK ${f3(PEAK)} · mayor raw/PEAK ${f3(mx)} (${who})`); }
    // 11. la carga cambia el reparto: más carga, más erectores respecto al cuádriceps
    { const q = r => r.dem.raw.erect / r.dem.raw.quads, ra = ev('back_squat', 1, {}, { load: 50 }), rb = ev('back_squat', 1, {}, { load: 200 });
      ok('11 reparto', q(rb) > q(ra), `back_squat erect/quads load 50 ${f3(q(ra))} -> load 200 ${f3(q(rb))}`); }
    // 12. ángulos anatómicos (X03-18): el reposo del rig en 0 (el hombro en abducción 90°; su flexión no se mira: con el brazo en cruz es un atan2 de dos números casi nulos); las poses de cada acción (en el reposo se mide con REST como pose)
    { const a = D.anatomia(D.REST), mal = Object.keys(a).filter(k => !k.startsWith('shoulder.flex') && Math.abs(a[k] - (k.startsWith('shoulder.abd') ? 90 : 0)) > (k.startsWith('shoulder.abd') ? 5 : 1));
      ok('12 anatomía reposo', !mal.length, mal.length ? mal.map(k => `${k} ${a[k].toFixed(1)}`).join(' · ') : `todos a 0° (hombro abd ${a['shoulder.abd.L'].toFixed(1)}°)`); }
    { const A = (ex, s) => D.anatomia(ev(ex, s).pose), a0 = A('back_squat', 0), a1 = A('back_squat', 1);
      ok('12 sentadilla', a0['knee.flex.L'] < 15 && a1['knee.flex.L'] > 90 && a1['hip.flex.L'] > 70, `knee.flex ${a0['knee.flex.L'].toFixed(1)} -> ${a1['knee.flex.L'].toFixed(1)} · hip.flex ${a0['hip.flex.L'].toFixed(1)} -> ${a1['hip.flex.L'].toFixed(1)} · ankle.dorsi ${a0['ankle.dorsi.L'].toFixed(1)} -> ${a1['ankle.dorsi.L'].toFixed(1)} · lumbar.flex ${a0['lumbar.flex'].toFixed(1)} -> ${a1['lumbar.flex'].toFixed(1)}`); }
    { const E = [0, 0.25, 0.5, 0.75, 1].map(s => D.anatomia(ev('pullup', s).pose)['elbow.flex.L']), lo = Math.min(...E), hi = Math.max(...E);
      ok('12 dominada', lo < 25 && hi > 90, `elbow.flex ${E.map(v => v.toFixed(0)).join(' ')} (mín ${lo.toFixed(1)} · máx ${hi.toFixed(1)})`); }
    { const a = D.anatomia(ev('deadlift', 0).pose); ok('12 peso muerto', a['hip.flex.L'] > 60 && a['knee.flex.L'] > 40, `s=0: hip.flex ${a['hip.flex.L'].toFixed(1)} · knee.flex ${a['knee.flex.L'].toFixed(1)}`); }
    { const a = D.anatomia(ev('cable_row', 0).pose)['elbow.flex.L'], b = D.anatomia(ev('cable_row', 1).pose)['elbow.flex.L'];
      ok('12 polea', b - a > 60, `elbow.flex ${a.toFixed(1)} -> ${b.toFixed(1)}`); }
    // 13. papel de cada músculo (X03-19): lo pintado en los 31 puntos
    { const g = (ex, f) => { const { PEAK } = D.repPeak(ex); let o = {}; for (let j = 0; j <= 30; j++) { const p = D.pinta(ex, ev(ex, j / 30).dem.raw, PEAK); for (const m in p) o[m] = f(o[m] ?? 0, p[m]); } return o; },
        mx = (a, b) => Math.max(a, b), s = g('back_squat', mx), p = g('pullup', mx);
      ok('13 papel sentadilla', s.add <= 0.5 + 1e-9 && Math.abs(Math.max(s.quads, s.glutes) - 1) <= 0.001, `máx pintado: quads ${f3(s.quads)} · glutes ${f3(s.glutes)} · add ${f3(s.add)} · hams ${f3(s.hams)} · erect ${f3(s.erect)} · calves ${f3(s.calves)} · abs ${f3(s.abs)}`);
      ok('13 papel dominada', Math.abs(Math.max(p.lats, p.biceps) - 1) <= 0.001 && p.triceps === 0, `máx pintado: lats ${f3(p.lats)} · biceps ${f3(p.biceps)} · delts ${f3(p.delts)} · triceps ${f3(p.triceps)}`); }
    // 14. jalón en la base de polea (X03-20): con la barra abajo (s = 1) trabajan dorsal y bíceps; rodilla y cadera no se calculan (pelvis, muslos y pies fijos)
    { const r = ev('lat_pulldown', 1), j = id => r.dem.joints.find(x => x.id === id);
      ok('14 jalón', r.act.lats > 0.1 && r.act.biceps > 0.1 && j('knee.L').M === null, `lats ${f3(r.act.lats)} · biceps ${f3(r.act.biceps)} · knee.L ${j('knee.L').M} · hip.L ${j('hip.L').M}`); }
    // 15. curvatura del tronco (X03-20): con +15 la flexión lumbar sube entre 10° y 20° respecto a 0 (y con −15 baja otro tanto), en el jalón y en el remo en polea, al principio y al final
    for (const ex of ['lat_pulldown', 'cable_row']) for (const s of [0, 1]) { const A = (prm = {}) => D.anatomia(ev(ex, s, {}, prm).pose)['lumbar.flex'], a = A(), b = A({ curv: 15 }), c = A({ curv: -15 });
      ok('15 curvatura', b - a >= 10 && b - a <= 20 && a - c >= 10 && a - c <= 20, `${ex} s=${s}: lumbar.flex ${a.toFixed(1)} -> ${b.toFixed(1)} con +15 (Δ ${(b - a).toFixed(1)}) · ${c.toFixed(1)} con -15 (Δ ${(c - a).toFixed(1)})`); }
    // 16. el maneral va por el cable (X03-22): con el balanceo a 0, en 11 puntos de la repetición el maneral varía menos de 4 cm de altura y el codo no baja del maneral más de 5 cm
    { const rg = sw => { const hs = [], bj = []; for (let i = 0; i <= 10; i++) { const r = ev('cable_row', i / 10, {}, { swing: sw }); hs.push(r.bar.center.y); bj.push(r.bar.center.y - r.pose['DEF-FORARM01.L'].p.y); } return [Math.max(...hs) - Math.min(...hs), Math.max(...bj)]; };
      const [v, m] = rg(0), [v0] = rg(100);   // la altura de la barra autorada ya baja 12 cm (el cable no es horizontal): se pide no más que eso
      ok('16 maneral por el cable', v <= v0 + 0.01 && m <= 0.05, `cable_row swing 0: maneral varía ${(v * 100).toFixed(1)} cm de altura (autorado ${(v0 * 100).toFixed(1)}) · el codo baja del maneral hasta ${(m * 100).toFixed(1)} cm`); }
    // 17. jalón por delante (X03-22): con «Distancia de la polea» +10, en s = 0 la barra queda 8-12 cm más adelante; con «Anchura de agarre» 1,3 las muñecas se separan entre un 20 y un 40 %
    { const a = ev('lat_pulldown', 0), b = ev('lat_pulldown', 0, {}, { pulleyF: 10 }), g = ev('lat_pulldown', 0, {}, { grip: 1.3 }), wr = r => r.pose['DEF-HAND.L'].p.distanceTo(r.pose['DEF-HAND.R'].p);
      const dz = b.bar.center.z - a.bar.center.z, k = wr(g) / wr(a) - 1;
      ok('17 jalón por delante', dz >= 0.08 && dz <= 0.12 && k >= 0.2 && k <= 0.4, `pulleyF +10: barra ${(dz * 100).toFixed(1)} cm más adelante · grip 1,3: muñecas ${(k * 100).toFixed(0)} % más separadas`); }
    // 18. juego escapular (X03-23): hombro L en los ejes del pecho; jalón con juego 0, la altura no varía más de 0,5 cm y es la del final; remo con juego 0 y escápulas +100, a menos de 0,5 cm del hombro de la clave final; con juego 150, más protracción al inicio que con 100
    { const sh = r => { const c = r.pose['DEF-CHEST'], q = c.q.clone().invert(); return r.pose['DEF-ARM01.L'].p.clone().sub(c.p).applyQuaternion(q); };
      const ys = []; for (let i = 0; i <= 10; i++) ys.push(sh(ev('lat_pulldown', i / 10, {}, { scapPlay: 0 })).y); const fin = sh(ev('lat_pulldown', 1)).y;
      const e1 = sh(ev('cable_row', 1, {}, { scapPlay: 0, scapPos: 100 })); let dm = 0; for (let i = 0; i <= 10; i++) dm = Math.max(dm, sh(ev('cable_row', i / 10, {}, { scapPlay: 0, scapPos: 100 })).distanceTo(e1));
      const z100 = sh(ev('cable_row', 0)).z, z150 = sh(ev('cable_row', 0, {}, { scapPlay: 150 })).z;
      ok('18 juego escapular', Math.max(...ys) - Math.min(...ys) < 0.005 && Math.abs(ys[0] - fin) < 0.005 && dm < 0.005 && z150 > z100,
        `jalón juego 0: hombro varía ${((Math.max(...ys) - Math.min(...ys)) * 100).toFixed(2)} cm, a ${((ys[0] - fin) * 100).toFixed(2)} cm del final · remo juego 0 +100: hasta ${(dm * 100).toFixed(2)} cm de la clave final · protracción al inicio (z del hombro en el pecho) ${(z100 * 100).toFixed(1)} -> ${(z150 * 100).toFixed(1)} cm con juego 150`); }
    out.push(fail ? `FALLOS: ${fail}` : 'OK'); return out.join('\n'); }, REF);
  console.log(txt); await close(); if (/^FALLO/m.test(txt)) process.exit(1); })();
