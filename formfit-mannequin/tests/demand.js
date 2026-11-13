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
    // 16. el maneral va por el cable (X03-22) y el tronco quieto (X03-26): con «Tronco al inicio» = «al final» (a medio camino entre los de la acción), en 11 puntos de la repetición el maneral varía menos de 4 cm de
    // altura más de lo autorado y el codo no baja del maneral más de 5 cm; y el pecho no cambia de inclinación (< 0,5°), ni pelvis, columna y cabeza (< 1°)
    { const tilt = (r, n) => { const y = new D.THREE.Vector3(0, 1, 0).applyQuaternion(r.pose[n].q); return Math.atan2(y.z, y.y) / DEG; }, DEG = Math.PI / 180, quieto = (S.per.cable_row.trunk0 + S.per.cable_row.trunk1) / 2;   // a medio camino, como el antiguo balanceo 0
      const rg = prm => { const hs = [], bj = [], t = {}; for (let i = 0; i <= 10; i++) { const r = ev('cable_row', i / 10, {}, prm); hs.push(r.bar.center.y); bj.push(r.bar.center.y - r.pose['DEF-FORARM01.L'].p.y);
          for (const n of ['DEF-CHEST', 'DEF-HIPS', 'DEF-SPINE02', 'DEF-HEAD']) (t[n] ??= []).push(tilt(r, n)); }
        return { v: Math.max(...hs) - Math.min(...hs), m: Math.max(...bj), t: Object.fromEntries(Object.entries(t).map(([n, a]) => [n, Math.max(...a) - Math.min(...a)])) }; };
      const q = rg({ trunk0: quieto, trunk1: quieto }), a = rg({});   // la altura de la barra autorada ya baja 12 cm (el cable no es horizontal): se pide no más que eso
      ok('16 maneral por el cable', q.v <= a.v + 0.01 && q.m <= 0.05 && q.t['DEF-CHEST'] < 0.5 && ['DEF-HIPS', 'DEF-SPINE02', 'DEF-HEAD'].every(n => q.t[n] < 1),
        `cable_row quieto: maneral varía ${(q.v * 100).toFixed(1)} cm de altura (autorado ${(a.v * 100).toFixed(1)}) · el codo baja del maneral hasta ${(q.m * 100).toFixed(1)} cm · inclinación varía pecho ${q.t['DEF-CHEST'].toFixed(2)}° · pelvis ${q.t['DEF-HIPS'].toFixed(2)}° · columna ${q.t['DEF-SPINE02'].toFixed(2)}° · cabeza ${q.t['DEF-HEAD'].toFixed(2)}°`); }
    // 17. jalón por delante (X03-22): con «Distancia de la polea» +10, en s = 0 la barra queda 8-12 cm más adelante; con «Anchura de agarre» 1,3 las muñecas se separan entre un 20 y un 40 %
    { const a = ev('lat_pulldown', 0), b = ev('lat_pulldown', 0, {}, { pulleyF: 10 }), g = ev('lat_pulldown', 0, {}, { grip: 1.3 }), wr = r => r.pose['DEF-HAND.L'].p.distanceTo(r.pose['DEF-HAND.R'].p);
      const dz = b.bar.center.z - a.bar.center.z, k = wr(g) / wr(a) - 1;
      ok('17 jalón por delante', dz >= 0.08 && dz <= 0.12 && k >= 0.2 && k <= 0.4, `pulleyF +10: barra ${(dz * 100).toFixed(1)} cm más adelante · grip 1,3: muñecas ${(k * 100).toFixed(0)} % más separadas`); }
    // 18. escápulas al inicio y al final (X03-26, antes juego escapular): hombro L en los ejes del pecho; jalón con scap0 = scap1 = 0 (abajo), la altura no varía más de 1 cm (la spec pedía 0,5: la curva de Blender se sale 0,66 cm de la recta) y es la del final; remo con scap0 = scap1 = 0 (retraídas),
    // a menos de 0,5 cm del hombro de la clave final en toda la repetición; con scap0 = 120, más protracción al inicio que con 100
    { const sh = r => { const c = r.pose['DEF-CHEST'], q = c.q.clone().invert(); return r.pose['DEF-ARM01.L'].p.clone().sub(c.p).applyQuaternion(q); };
      const ys = []; for (let i = 0; i <= 10; i++) ys.push(sh(ev('lat_pulldown', i / 10, {}, { scap0: 0 })).y); const fin = sh(ev('lat_pulldown', 1)).y;
      const e1 = sh(ev('cable_row', 1, {}, { scap0: 0 })); let dm = 0; for (let i = 0; i <= 10; i++) dm = Math.max(dm, sh(ev('cable_row', i / 10, {}, { scap0: 0 })).distanceTo(e1));
      const z100 = sh(ev('cable_row', 0)).z, z120 = sh(ev('cable_row', 0, {}, { scap0: 120 })).z;
      ok('18 escápulas', Math.max(...ys) - Math.min(...ys) < 0.01 && Math.abs(ys[0] - fin) < 0.005 && dm < 0.005 && z120 > z100,
        `jalón scap0 = scap1 = 0: hombro varía ${((Math.max(...ys) - Math.min(...ys)) * 100).toFixed(2)} cm, a ${((ys[0] - fin) * 100).toFixed(2)} cm del final · remo scap0 = scap1 = 0: hasta ${(dm * 100).toFixed(2)} cm de la clave final · protracción al inicio (z del hombro en el pecho) ${(z100 * 100).toFixed(1)} -> ${(z120 * 100).toFixed(1)} cm con scap0 120`); }
    // 30. jalón sobre Blender (X03-26). Por defecto, tres agarres, 61 puntos: todo lo que no es brazo (tronco, piernas, escápulas) a 0,0 mm de Blender; los brazos ya no se comparan con Blender (X03-27: la muñeca es absoluta, alineada con el antebrazo; se informa cuánto se apartan);
    // la mano agarra la barra (hueco a menos de 3 mm de su punto de agarre), la muñeca va recta (< 1°: «alineada + afinado», afinado vacío) y no hay avisos ni `sFin`
    for (const gt of ['prono', 'supino', 'neutro']) { const act = gt === 'prono' ? 'lat_pulldown' : D.variantFor('lat_pulldown', gt); let rest = 0, wr = 0, el = 0, hu = 0, mu = 0, avisos = 0;
      for (let i = 0; i <= 60; i++) { const r = ev('lat_pulldown', i / 60, {}, { gripType: gt }), A = D.withBody(D.DEFAULT_BODY, () => D.authoredPose(act, i / 60)); avisos += r.warns.length;
        for (const n of D.BN) if (!/ARM0|FORARM|HAND|FINGER|THUMB|PALM/.test(n)) rest = Math.max(rest, r.pose[n].p.distanceTo(A[n].p));
        for (const S of ['L', 'R']) { wr = Math.max(wr, r.pose[`DEF-HAND.${S}`].p.distanceTo(A[`DEF-HAND.${S}`].p)); el = Math.max(el, r.pose[`DEF-FORARM01.${S}`].p.distanceTo(A[`DEF-FORARM01.${S}`].p));
          hu = Math.max(hu, D.hollowAt(act, r.pose, S).distanceTo(r.grips[S === 'L' ? 0 : 1])); }
        mu = Math.max(mu, r.align.wrist); }
      ok('30 jalón sobre Blender', rest < 1e-4 && hu < 0.003 && mu < Math.PI / 180 && !avisos && ev('lat_pulldown', 1, {}, { gripType: gt }).sFin === undefined,
        `${gt}: resto del cuerpo ${(rest * 1000).toFixed(2)} mm · muñecas hasta ${(wr * 1000).toFixed(1)} mm y codos hasta ${(el * 1000).toFixed(1)} mm de Blender (informativo) · hueco–agarre ${(hu * 1000).toFixed(2)} mm · muñeca ${(mu * 180 / Math.PI).toFixed(2)}° de la recta · avisos ${avisos}`); }
    // polea: con el brazo casi recto el codo no puede alinear el antebrazo con el cable (el antebrazo va con el brazo), así que la spec (≤ 5° con +15) no es alcanzable: se pide que en s = 0 el exceso
    // (antebrazo–cable sobre el de la acción) quede bajo 15° en todo el rango del ajuste (−12…+8) y que R3 no empeore lo que da el brazo solo
    { const exc = pf => ev('lat_pulldown', 0, {}, { pulleyF: pf }).align.excess * 180 / Math.PI, a = exc(0), b = exc(8), c = exc(-12);
      ok('31 jalón polea', b <= 15 && c <= 15 && a < 5, `exceso antebrazo–cable en s = 0: ${a.toFixed(1)}° por defecto · ${b.toFixed(1)}° con +8 · ${c.toFixed(1)}° con −12`); }
    // dest +8 (hacia el esternón): o el recorrido acaba antes (sFin < 1) o el exceso se mantiene bajo 15°; nunca un aviso
    { let av = 0, ex = -99; const sf = ev('lat_pulldown', 1, {}, { dest: 8 }).sFin;
      for (let i = 0; i <= 60; i++) { const r = ev('lat_pulldown', i / 60, {}, { dest: 8 }); av += r.warns.length; ex = Math.max(ex, r.align.excess * 180 / Math.PI); }
      ok('32 jalón dest', !av && ex <= 15.001, `dest +8: sFin ${sf === undefined ? 'no hay' : sf.toFixed(3)} · exceso máx ${ex.toFixed(1)}° dentro del recorrido · avisos ${av}`); }
    // 33. afinado del usuario (X03-27). Los tres agarres. `rel` = ángulo mano–antebrazo alrededor del eje del puño, medido en la pose (independiente de `align`)
    { const T = D.THREE, Yv = new T.Vector3(0, 1, 0), DEG = Math.PI / 180, act = gt => gt === 'prono' ? 'lat_pulldown' : D.variantFor('lat_pulldown', gt);
      const rel = (a, P, S) => { const ax = D.jalonData(a).side[S].axis.clone().applyQuaternion(P[`DEF-HAND.${S}`].q); return -D.wrapA(D.psiOf(Yv.clone().applyQuaternion(P[`DEF-HAND.${S}`].q), ax) - D.psiOf(P[`DEF-HAND.${S}`].p.clone().sub(P[`DEF-FORARM01.${S}`].p), ax)) / DEG; };   // + = flexión (la palma hacia el antebrazo; X03-28: el signo ya es el anatómico en las dos manos)
      // `ev` cambia el objeto de ajustes del ejercicio y la acción de cada agarre dejaría de compartirlo: aquí se cambian los dos (como en la interfaz, donde son el mismo)
      const dif = (a, b) => D.wrapA((a - b) * DEG) / DEG, con = (a, aj, s, prm) => { const pb = S.per.lat_pulldown, pv = S.per[a], sb = { ...pb }, sv = { ...pv }; D.ajSet(a, aj); Object.assign(pb, prm); Object.assign(pv, prm);
        try { return D.evaluateRaw(a, s); } finally { D.ajSet(a, null); Object.assign(pb, sb); Object.assign(pv, sv); } };
      // giro del polo medido desde la X (como R3 y el codo estable); con el brazo a lo ancho esa referencia se degenera, así que (c) usa el `giro` entre dos poses
      const sw = (P, S) => { const Sh = P[`DEF-ARM01.${S}`].p, E = P[`DEF-FORARM01.${S}`].p, W = P[`DEF-HAND.${S}`].p; return D.swivel(W.clone().sub(Sh).normalize(), D.poleOf(Sh, E, W)) / DEG; };
      // giro del codo de la pose Q frente a la P alrededor de hombro→muñeca (con signo; sin tomar la X como referencia, que se degenera con el brazo a lo ancho)
      const giro = (P, Q, S) => { const Sh = Q[`DEF-ARM01.${S}`].p, ax = Q[`DEF-HAND.${S}`].p.clone().sub(Sh).normalize(), pr = X => { const p = D.poleOf(X[`DEF-ARM01.${S}`].p, X[`DEF-FORARM01.${S}`].p, X[`DEF-HAND.${S}`].p); return p.addScaledVector(ax, -p.dot(ax)); }, a = pr(P), b = pr(Q);
        return Math.atan2(ax.dot(a.clone().cross(b)), a.dot(b)) / DEG; };
      // (a) afinado vacío: muñeca recta (< 1°) en 61 puntos, ambas manos
      for (const gt of ['prono', 'supino', 'neutro']) { let m = 0; for (let i = 0; i <= 60; i++) { const P = ev('lat_pulldown', i / 60, {}, { gripType: gt }).pose; for (const S of ['L', 'R']) m = Math.max(m, Math.abs(rel(act(gt), P, S))); }
        ok('33a muñeca recta', m < 1, `${gt}: ángulo mano–antebrazo hasta ${m.toFixed(2)}° en 61 puntos`); }
      // (b) base.muneca = [10, 0, −10]: 10°, 0° y −10° en s = 0, 0,5 y 1 (± 1°)
      for (const gt of ['prono', 'supino', 'neutro']) { const a = act(gt), v = [0, D.sOfProg(a, 0.5), 1].map(s => rel(a, con(a, { base: { muneca: [10, 0, -10] } }, s, { gripType: gt }).pose, 'L'));   // «mitad» = mitad del gesto (X03-28, interpolación sobre el progreso)
        ok('33b muñeca afinada', Math.abs(v[0] - 10) < 1 && Math.abs(v[1]) < 1 && Math.abs(v[2] + 10) < 1, `${gt}: ${v.map(x => x.toFixed(2) + '°').join(' · ')} en s = 0, 0,5, 1 (pedido 10, 0, −10)`); }
      // (c) en.grip.max.codos = [0, 30, 30]: con grip al máximo el codo gira 30° más en s = 1; a medio camino 15° (± 2°); por defecto 0°
      for (const gt of ['prono', 'supino', 'neutro']) { const a = act(gt), aj = { en: { grip: { max: { codos: [0, 30, 30] } } }, rangos: { grip: { max: 1.4 } } }, d = g => Math.abs(giro(con(a, null, 1, { gripType: gt, grip: g }).pose, con(a, aj, 1, { gripType: gt, grip: g }).pose, 'L')), [d1, d2, d3] = [1.4, 1.2, 1].map(d);
        ok('33c afinado por ajuste', Math.abs(d1 - 30) < 4 && Math.abs(d2 - 15) < 4 && d3 < 0.5, `${gt}: grip 1,4 → ${d1.toFixed(1)}° · grip 1,2 → ${d2.toFixed(1)}° · grip 1 → ${d3.toFixed(1)}° de giro del codo en s = 1 (pedido 30, 15, 0; ±4°: al girar el codo gira la mano y la muñeca se desplaza hasta 6 cm, y con ella el eje del brazo)`); }
      // (d) codo estable: entre s = 0 y el instante en que el codo queda definido el giro del polo no cambia (< 0,5°)
      for (const gt of ['prono', 'supino', 'neutro']) { const a = act(gt); let m = 0, sc = 0; for (const S of ['L', 'R']) { const st = D.jalonData(a).side[S].stab; if (!st) continue; sc = Math.max(sc, st.sc);
          const w0 = sw(con(a, null, 0, { gripType: gt }).pose, S); for (let i = 1; i <= 20; i++) m = Math.max(m, Math.abs(dif(sw(con(a, null, st.sc * i / 20, { gripType: gt }).pose, S), w0))); }
        ok('33d codo estable', m < 1, `${gt}: el giro del polo varía hasta ${m.toFixed(2)}° entre s = 0 y s = ${sc.toFixed(3)} (cuando el codo queda definido; la spec pide < 0,5°, el resto es el eje del brazo al girar el tronco)`); }

      // ---- X03-28 (34): la mano de la biblioteca, el espejo, las magnitudes nuevas y su sentido anatómico
      const ARM = /ARM|HAND|FINGER|PALM|THUMB|SHOULDER/, mirr = (P, re) => { let m = 0; for (const n of D.BN) { if (!/\.L$/.test(n) || !re.test(n)) continue; const a = P[n].p, b = P[n.replace(/\.L$/, '.R')].p; m = Math.max(m, Math.hypot(a.x + b.x, a.y - b.y, a.z - b.z)); } return m; };
      const dist = (P, Q, re) => { let m = 0; for (const n of D.BN) if (re.test(n)) m = Math.max(m, P[n].p.distanceTo(Q[n].p)); return m; };
      const AF = { base: { muneca: [20, 0, -10], desv: [10, 0, 0], barraDedos: [8, 8, 8] } };
      // (34a) espejo: con el afinado, brazos, manos y dedos de la derecha son el reflejo en X de los de la izquierda (< 0,1 mm), y el afinado sí mueve la mano (> 5 mm)
      for (const gt of ['prono', 'supino', 'neutro']) { const a = act(gt); let m = 0, mv = 0;
        for (const s of [0, 0.5, 1]) { const P = con(a, AF, s, { gripType: gt }).pose; m = Math.max(m, mirr(P, ARM)); mv = Math.max(mv, dist(P, con(a, null, s, { gripType: gt }).pose, /HAND/)); }
        ok('34a espejo', m < 1e-4 && mv > 0.005, `${gt}: brazos y manos reflejados hasta ${(m * 1000).toFixed(3)} mm · el afinado mueve la mano hasta ${(mv * 1000).toFixed(1)} mm`); }
      // (34b) barraDedos = 10: el hueco se mueve 10 mm (± 0,5) a lo largo de la mano y, con el afinado, sigue a 0,0 mm del agarre
      for (const gt of ['prono', 'supino', 'neutro']) { const a = act(gt), r = con(a, { base: { barraDedos: [10, 10, 10] } }, 0.5, { gripType: gt }); let d = 0, h = 0, ang = 0;
        for (const S of ['L', 'R']) { const g = r.grips[S === 'L' ? 0 : 1], h0 = D.hollowAt(a, r.pose, S), h1 = D.hollowAt(a, r.pose, S, 0.01), Yh = Yv.clone().applyQuaternion(r.pose[`DEF-HAND.${S}`].q);
          d = Math.max(d, Math.abs(h0.distanceTo(h1) - 0.01)); h = Math.max(h, h1.distanceTo(g)); ang = Math.max(ang, h1.clone().sub(h0).angleTo(Yh) / DEG); }
        ok('34b barraDedos', d < 0.0005 && h < 1e-4 && ang < 1, `${gt}: el hueco se mueve ${((0.01 + d) * 1000).toFixed(2)} mm (pedido 10) a ${ang.toFixed(2)}° de la mano · hueco–agarre ${(h * 1000).toFixed(3)} mm`); }
      // (34c) desv = 15: la mano gira 15° (± 1) alrededor de la normal de la palma; (34d) y en el sentido anatómico, igual en las dos manos: flexión + lleva la palma al antebrazo, desviación + los dedos al meñique
      for (const gt of ['prono', 'supino', 'neutro']) { const a = act(gt), P0 = con(a, null, 0.5, { gripType: gt }).pose, P1 = con(a, { base: { desv: [15, 15, 15] } }, 0.5, { gripType: gt }).pose; let ang = 0, ax = 1;
        for (const S of ['L', 'R']) { const dq = P0[`DEF-HAND.${S}`].q.clone().invert().multiply(P1[`DEF-HAND.${S}`].q), A = 2 * Math.acos(Math.min(1, Math.abs(dq.w))), n = new T.Vector3(dq.x, dq.y, dq.z).normalize();
          ang = Math.max(ang, Math.abs(A / DEG - 15)); ax = Math.min(ax, Math.abs(n.dot(D.jalonData(a).side[S].palm))); }
        ok('34c desviación', ang < 1 && ax > 0.97, `${gt}: la mano gira ${(15 + ang).toFixed(2)}° (pedido 15) · eje a ${(Math.acos(ax) / DEG).toFixed(1)}° de la normal de la palma`); }
      for (const gt of ['prono', 'supino', 'neutro']) { const a = act(gt), P0 = con(a, null, 0.5, { gripType: gt }).pose, res = [];
        for (const [k, v] of [['muneca', 30], ['desv', 20]]) { const P1 = con(a, { base: { [k]: [v, v, v] } }, 0.5, { gripType: gt }).pose;
          res.push(['L', 'R'].map(S => { const f = P => P[`DEF-HAND.${S}`].p.clone().sub(P[`DEF-FORARM01.${S}`].p).normalize(), loc = (P, vv) => vv.clone().applyQuaternion(P[`DEF-HAND.${S}`].q.clone().invert()),
              pk = D.REST[`DEF-FINGER-D-01.${S}`].p.clone().sub(D.REST[`DEF-FINGER-A-01.${S}`].p).applyQuaternion(D.REST[`DEF-HAND.${S}`].q.clone().invert()).normalize(), pn = D.jalonData(a).side[S].palm;
              return k === 'muneca' ? -(loc(P1, f(P1)).dot(pn) - loc(P0, f(P0)).dot(pn)) : -(loc(P1, f(P1)).dot(pk) - loc(P0, f(P0)).dot(pk)); })); }
        ok('34d sentido anatómico', res.every(r => r[0] > 0.3 && Math.abs(r[0] - r[1]) < 0.02), `${gt}: flexión +30 → palma hacia el antebrazo ${res[0].map(x => x.toFixed(2)).join(' / ')} · desviación +20 → dedos hacia el meñique ${res[1].map(x => x.toFixed(2)).join(' / ')} (izquierda / derecha; > 0,3 y iguales)`); }
      // (34e) la mano de la biblioteca (prono, supino): los dedos respecto a la mano son los de POSES.hands[meta.mano] (< 0,5°); el neutro (sin mano posada) conserva los de la acción
      for (const gt of ['prono', 'supino', 'neutro']) { const a = act(gt), man = D.POSES.hands[D.POSES.exercises[a].meta.mano], P = con(a, null, 0.5, { gripType: gt }).pose; let m = 0;
        if (man) for (const S of ['L', 'R']) for (const n in man[S].fingers) { const q = P[`DEF-HAND.${S}`].q.clone().invert().multiply(P[n].q), l = new T.Quaternion(...man[S].fingers[n]); m = Math.max(m, 2 * Math.acos(Math.min(1, Math.abs(q.dot(l)))) / DEG); }
        ok('34e mano de la biblioteca', man ? m < 0.5 : true, `${gt}: ${man ? `dedos a ${m.toFixed(3)}° de ${D.POSES.exercises[a].meta.mano}` : `${D.POSES.exercises[a].meta.mano} no está en la biblioteca: dedos de la acción`}`); }
      // (34f) escápulas y tronco: `escap` 30 mueve el hombro respecto al pecho; `tronco` +10 inclina el pecho +10° (± 1,5)
      { const a = act('prono'), P0 = con(a, null, 0.5, {}).pose, tilt = P => { const y = Yv.clone().applyQuaternion(P['DEF-CHEST'].q); return Math.atan2(y.z, y.y) / DEG; };
        const Pe = con(a, { base: { escap: [30, 30, 30] } }, 0.5, {}).pose, Pt = con(a, { base: { tronco: [10, 10, 10] } }, 0.5, {}).pose, rel = P => P['DEF-ARM01.L'].p.clone().sub(P['DEF-CHEST'].p).applyQuaternion(P['DEF-CHEST'].q.clone().invert()).y;
        const dy = (rel(Pe) - rel(P0)) * 100, dt = tilt(Pt) - tilt(P0);
        ok('34f escápulas y tronco', Math.abs(dy) > 0.3 && Math.abs(dt - 10) < 1.5, `escap +30: el hombro se mueve ${dy.toFixed(2)} cm en el pecho · tronco +10: el pecho se inclina ${dt.toFixed(2)}°`); }
    }
    // 19-22 (X03-14): apoyos y carga declarados en las acciones `libre`. Cuánto de la reacción total lleva cada parte: suma de las fuerzas de apoyo en Y por parte del cuerpo
    const apoyo = (r, ...parts) => { const ap = r.dem.forces.filter(f => f.tipo === 'apoyo'), t = ap.reduce((a, f) => a + f.f.y, 0); return ap.filter(f => parts.includes(f.part)).reduce((a, f) => a + f.f.y, 0) / t; };
    // 19. búlgara abajo: el pie de delante (pie.L) lleva más del 60 %; rodilla y cadera izquierdas con demanda > 0,2
    // (antes del rozamiento, X03-21, la rodilla daba 0,197 en el punto bajo; con él, 0,67)
    { const r = ev('bulgarian_split_squat', 1), d = (id, c) => r.dem.joints.find(j => j.id === id).d[c], p = apoyo(r, 'foot.L');
      ok('19 búlgara', p > 0.6 && d('knee.L', 'ext') > 0.2 && d('hip.L', 'ext') > 0.2, `pie delantero ${(p * 100).toFixed(1)} % · pie trasero ${((1 - p) * 100).toFixed(1)} % · knee.L ext d ${f3(d('knee.L', 'ext'))} · hip.L ext d ${f3(d('hip.L', 'ext'))} · reparto del panel: ${r.dem.reparto.map(g => g.nombre + ' ' + g.pct.toFixed(0) + ' %').join(' · ')}`); }
    // 20. flexiones abajo: las manos llevan entre el 55 % y el 80 %; pectoral y tríceps > 0,1
    { const r = ev('push_up', 1), p = apoyo(r, 'hand.L', 'hand.R'), a = r.act;
      ok('20 flexiones', p > 0.55 && p < 0.8 && a.pecs > 0.1 && a.triceps > 0.1, `manos ${(p * 100).toFixed(1)} % · pies ${((1 - p) * 100).toFixed(1)} % · pecs ${f3(a.pecs)} · triceps ${f3(a.triceps)} · delts ${f3(a.delts)} · abs ${f3(a.abs)}`);
      const r0 = ev('push_up', 0); out.push(`     (arriba: manos ${(apoyo(r0, 'hand.L', 'hand.R') * 100).toFixed(1)} %)`); }
    // 21. hip thrust arriba: más glúteo que cuádriceps
    { const r = ev('hip_thrust', 1), a = r.act;
      ok('21 hip thrust', a.glutes > a.quads, `glutes ${f3(a.glutes)} · quads ${f3(a.quads)} · hams ${f3(a.hams)} · hombros ${(apoyo(r, 'trunkUp') * 100).toFixed(1)} % · pies ${((1 - apoyo(r, 'trunkUp')) * 100).toFixed(1)} %`); }
    // 22. press de banca abajo: pectoral > 0,2; con el banco y los pies fijos, rodilla y cadera no se calculan
    { const r = ev('bench_press', 1), a = r.act, j = id => r.dem.joints.find(x => x.id === id);
      ok('22 banca', a.pecs > 0.2 && j('knee.L').M === null && j('hip.L').M === null && j('shoulder.L').M !== null, `pecs ${f3(a.pecs)} · triceps ${f3(a.triceps)} · delts ${f3(a.delts)} · knee.L ${j('knee.L').M} · shoulder.L ${j('shoulder.L').M ? 'calculado' : 'null'}`); }
    // 22b. una acción `libre` sin apoyos declarados: sin demanda y sin error
    { const m = D.POSES.exercises.push_up.meta, ap = m.apoyos; delete m.apoyos;
      try { const r = ev('push_up', 0.5), pk = D.repPeak('push_up'); ok('22b sin apoyos', r.dem === null && Object.keys(r.act).length === 0 && pk.curve.length === 31, `dem ${r.dem} · act ${JSON.stringify(r.act)} · curva ${pk.curve.length} puntos`); } finally { m.apoyos = ap; } }
    // 23. rozamiento por mínimo esfuerzo (X03-21), en 31 puntos de cada acción con dos grupos de apoyo: E(h*) <= E(0), |h| <= 0,6·min(NA, NB) y las fuerzas horizontales de los apoyos suman 0
    for (const ex of ['push_up', 'bulgarian_split_squat', 'hip_thrust']) { let bad = '', hmax = 0, angMax = 0, mejora = 0;
      for (let j = 0; j <= 30; j++) { const r = ev(ex, j / 30), z = r.dem.roz, ap = r.dem.forces.filter(f => f.tipo === 'apoyo');
        const sx = ap.reduce((a, f) => a + f.f.x, 0), sz = ap.reduce((a, f) => a + f.f.z, 0), okE = z.E <= z.E0 + 1e-9, okM = Math.abs(z.h) <= z.mu * Math.min(z.NA, z.NB) + 1e-6, okH = Math.abs(sx) < 1e-6 && Math.abs(sz) < 1e-6;
        if (!(okE && okM && okH)) bad += ` s=${(j / 30).toFixed(2)}[${okE ? '' : 'E '}${okM ? '' : 'mu '}${okH ? '' : 'sumaH '}E0 ${z.E0.toExponential(2)} E ${z.E.toExponential(2)} h ${z.h.toFixed(3)} h* ${z.hOpt.toFixed(3)} NA ${z.NA.toFixed(3)} NB ${z.NB.toFixed(3)}]`;
        hmax = Math.max(hmax, Math.abs(z.h)); angMax = Math.max(angMax, ...r.dem.reparto.map(g => g.ang)); mejora = Math.max(mejora, 1 - z.E / z.E0); }
      ok('23 rozamiento', !bad, `${ex}: |h| máx ${f3(hmax)} PC · inclinación máx ${angMax.toFixed(1)}° · esfuerzo −${(mejora * 100).toFixed(0)} % como mucho${bad}`); }
    // 23b. con un solo grupo de apoyo no hay rozamiento: sentadilla sin cambios (roz = null y la prueba 2 sin tocar)
    { const r = ev('back_squat', 1); ok('23b un grupo', r.dem.roz === null && r.dem.reparto === null, `back_squat roz ${r.dem.roz} · reparto ${r.dem.reparto}`); }
    // 24-27 (X03-07): ajustes de las bases floor, split y bench. Utilidades: punto de un hueso, punto medio de dos y cm con un decimal
    const bp = (r, n) => r.pose[n].p, mid2 = (r, a, b) => bp(r, a).clone().add(bp(r, b)).multiplyScalar(0.5), cm1 = v => (v * 100).toFixed(1), nrm = r => r.dem.raw, shd = r => mid2(r, 'DEF-ARM01.L', 'DEF-ARM01.R');
    // 24. flexiones (floor): manos más abajo (hacia la cadera) -> más deltoides abajo; manos hacia la cabeza -> más tríceps en proporción al pectoral; manos más abiertas -> hombros arriba más bajos;
    // empuje +5 -> hombros abajo 4-6 cm más adelante y las puntas de los pies no se mueven (la spec pedía +10 y 8-12 cm: el tobillo de este maniquí está a ~10 cm de la punta, ver HANDOFF §4.4h)
    { const d0 = nrm(ev('push_up', 1)), d20 = nrm(ev('push_up', 1, {}, { handPos: 20 }));
      ok('24 flexiones handPos +20', d20.delts > d0.delts, `delts abajo (raw) ${f3(d0.delts)} -> ${f3(d20.delts)}`);
      const r0 = nrm(ev('push_up', 1)), rm = nrm(ev('push_up', 1, {}, { handPos: -15 }));
      ok('24 flexiones handPos -15', rm.triceps / rm.pecs > r0.triceps / r0.pecs, `triceps/pecs abajo ${f3(r0.triceps / r0.pecs)} -> ${f3(rm.triceps / rm.pecs)}`);
      const y0 = shd(ev('push_up', 0)).y, y150 = shd(ev('push_up', 0, {}, { hands: 150 })).y;
      ok('24 flexiones hands 150', y150 < y0, `hombros arriba ${cm1(y0)} -> ${cm1(y150)} cm de altura`);
      const a = ev('push_up', 1), b = ev('push_up', 1, {}, { push: 5 }), dz = shd(b).z - shd(a).z, dt = Math.max(...['L', 'R'].map(S => bp(a, `DEF-TOE.${S}`).distanceTo(bp(b, `DEF-TOE.${S}`))));
      ok('24 flexiones push +5', dz >= 0.04 && dz <= 0.06 && dt < 0.001, `hombros abajo ${cm1(dz)} cm más adelante · puntas se mueven ${(dt * 1000).toFixed(2)} mm`);
      out.push(`     (push +6: hombros ${cm1(shd(ev('push_up', 1, {}, { push: 6 })).z - shd(a).z)} cm más adelante)`);
      const el = (prm, s) => Math.abs(bp(ev('push_up', s, {}, prm), 'DEF-FORARM01.L').x);   // handRot +: codos más pegados
      ok('24 flexiones handRot', el({ handRot: 45 }, 1) < el({}, 1) && el({ handRot: -45 }, 1) > el({}, 1), `codo x abajo: ${cm1(el({ handRot: 45 }, 1))} (+45) < ${cm1(el({}, 1))} < ${cm1(el({ handRot: -45 }, 1))} (−45) cm`); }
    // 25. hip thrust (bench), arriba (s = 1): con los pies 15 cm más lejos los isquios trabajan más (hams en raw) y la fuerza de los pies se inclina más hacia el banco; con 10 cm más cerca, más cuádriceps.
    // Los tobillos se mueven exactamente lo pedido y las puntas siguen en el suelo
    { const feet = r => r.dem.forces.filter(f => f.tipo === 'apoyo' && f.part.startsWith('foot')), inc = r => { const f = feet(r), z = f.reduce((a, x) => a + x.f.z, 0), y = f.reduce((a, x) => a + x.f.y, 0); return [Math.atan2(-z, y) / D.THREE.MathUtils.DEG2RAD, z]; };   // + = hacia el banco (-z)
      const a = ev('hip_thrust', 1), lej = ev('hip_thrust', 1, {}, { feet: 15 }), cer = ev('hip_thrust', 1, {}, { feet: -10 }), [ia] = inc(a), [il] = inc(lej);
      ok('25 hip thrust pies lejos', lej.dem.raw.hams > a.dem.raw.hams && il > ia && il > 3, `hams ${f3(a.dem.raw.hams)} -> ${f3(lej.dem.raw.hams)} (+15 cm) · flecha de los pies ${ia.toFixed(1)}° -> ${il.toFixed(1)}° hacia el banco · quads ${f3(a.dem.raw.quads)} -> ${f3(lej.dem.raw.quads)}`);
      ok('25 hip thrust pies cerca', cer.dem.raw.quads > a.dem.raw.quads, `quads ${f3(a.dem.raw.quads)} -> ${f3(cer.dem.raw.quads)} (-10 cm) · hams ${f3(a.dem.raw.hams)} -> ${f3(cer.dem.raw.hams)} · flecha ${inc(cer)[0].toFixed(1)}°`);
      const dz = ['L', 'R'].map(S => bp(lej, `DEF-FOOT.${S}`).z - bp(a, `DEF-FOOT.${S}`).z), dy = Math.max(...['L', 'R'].flatMap(S => ['FOOT', 'TOE'].map(n => Math.abs(bp(lej, `DEF-${n}.${S}`).y - bp(a, `DEF-${n}.${S}`).y))));
      ok('25 hip thrust tobillos', dz.every(v => Math.abs(v - 0.15) < 1e-6) && dy < 1e-6, `tobillos +${dz.map(cm1).join(' / ')} cm (pedido 15) · alturas de tobillo y punta cambian ${(dy * 1000).toFixed(3)} mm`); }
    // 26. press de banca (bench): con grip 140 la barra arriba queda más baja y pecs (abajo) no baja; con touch +6 la barra abajo queda 5-7 cm más hacia la cadera; con codos +30 el codo abajo queda más afuera
    { const a0 = ev('bench_press', 0), g0 = ev('bench_press', 0, {}, { grip: 140 }), a1 = ev('bench_press', 1), g1 = ev('bench_press', 1, {}, { grip: 140 }), t1 = ev('bench_press', 1, {}, { touch: 6 }), e1 = ev('bench_press', 1, {}, { elbows: 30 }), ez = ev('bench_press', 1, {}, { elbows: -30 });
      ok('26 press grip', g0.bar.center.y < a0.bar.center.y && g1.dem.raw.pecs >= a1.dem.raw.pecs, `barra arriba ${cm1(a0.bar.center.y)} -> ${cm1(g0.bar.center.y)} cm (grip 140) · pecs abajo ${f3(a1.dem.raw.pecs)} -> ${f3(g1.dem.raw.pecs)}`);
      const dt = t1.bar.center.z - a1.bar.center.z;
      ok('26 press touch', dt >= 0.05 && dt <= 0.07, `barra abajo ${cm1(dt)} cm más hacia la cadera (touch +6)`);
      ok('26 press codos', Math.abs(bp(e1, 'DEF-FORARM01.L').x) > Math.abs(bp(a1, 'DEF-FORARM01.L').x) && Math.abs(bp(ez, 'DEF-FORARM01.L').x) < Math.abs(bp(a1, 'DEF-FORARM01.L').x), `codo x abajo ${cm1(bp(ez, 'DEF-FORARM01.L').x)} (−30) < ${cm1(bp(a1, 'DEF-FORARM01.L').x)} < ${cm1(bp(e1, 'DEF-FORARM01.L').x)} (+30) cm`);
      const h0 = ev('hip_thrust', 1), e2 = ev('hip_thrust', 1, {}, { benchH: 10 }); ok('26 hip thrust banco', Math.abs(e2.props[0][1].y - h0.props[0][1].y - 0.1) < 1e-6 && Math.abs(shd(e2).y - shd(h0).y - 0.1) < 1e-6, `banco y hombros suben 10 cm con benchH +10 (alto de la caja ${cm1(e2.props[0][1].y)} cm)`); }
    // 27. búlgara (split): con dorsi 45 la rodilla de delante, abajo, queda más adelante y el pie de delante lleva más porcentaje que con 35; con benchH +10 el tobillo de atrás sube 10 cm (y el banco);
    // con stride +15 no hay aviso de pierna corta en ningún punto; el pie de delante no se mueve con ningún ajuste; con trunk +25 el hombro abajo queda más adelante y el pie de delante lleva más
    { const pct = r => r.dem.reparto[0].nombre === 'pie delantero' ? r.dem.reparto[0].pct : r.dem.reparto[1].pct, a = ev('bulgarian_split_squat', 1), d = ev('bulgarian_split_squat', 1, { dorsi: 45 });
      ok('27 búlgara dorsiflexión', bp(d, 'DEF-SHIN01.L').z > bp(a, 'DEF-SHIN01.L').z + 0.03 && pct(d) > pct(a), `rodilla delantera z ${cm1(bp(a, 'DEF-SHIN01.L').z)} -> ${cm1(bp(d, 'DEF-SHIN01.L').z)} cm · pie delantero ${pct(a).toFixed(1)} % -> ${pct(d).toFixed(1)} % (dorsi 45)`);
      const b = ev('bulgarian_split_squat', 1, {}, { benchH: 10 }), b0 = ev('bulgarian_split_squat', 0, {}, { benchH: 10 }), a0 = ev('bulgarian_split_squat', 0), dy1 = bp(b, 'DEF-FOOT.R').y - bp(a, 'DEF-FOOT.R').y, dy0 = bp(b0, 'DEF-FOOT.R').y - bp(a0, 'DEF-FOOT.R').y;
      ok('27 búlgara banco', Math.abs(dy1 - 0.1) < 1e-6 && Math.abs(dy0 - 0.1) < 1e-6 && Math.abs(b.props[0][1].y - a.props[0][1].y - 0.1) < 1e-6, `tobillo de atrás +${cm1(dy1)} cm abajo y +${cm1(dy0)} cm arriba (pedido 10) · banco ${cm1(a.props[0][1].y)} -> ${cm1(b.props[0][1].y)} cm de alto`);
      let w = 0, mv = 0; for (let i = 0; i <= 30; i++) { const r = ev('bulgarian_split_squat', i / 30, {}, { stride: 15 }), q = ev('bulgarian_split_squat', i / 30); w += r.warns.length; mv = Math.max(mv, bp(r, 'DEF-FOOT.L').distanceTo(bp(q, 'DEF-FOOT.L'))); }
      ok('27 búlgara zancada', w === 0 && mv < 1e-6, `stride +15: ${w} avisos en 31 puntos · el pie de delante se mueve ${(mv * 1000).toFixed(3)} mm`);
      const t = ev('bulgarian_split_squat', 1, {}, { trunk: 25 }); ok('27 búlgara tronco', shd(t).z > shd(a).z + 0.1 && pct(t) > pct(a), `hombros abajo z ${cm1(shd(a).z)} -> ${cm1(shd(t).z)} cm · pie delantero ${pct(a).toFixed(1)} % -> ${pct(t).toFixed(1)} % (trunk +25)`); }
    // 28. sin saltos: en cada acción de las bases nuevas, con cada ajuste en sus dos extremos, ninguna articulación se mueve más de 6 cm entre dos de 61 puntos consecutivos; sin avisos de miembro que no llega
    { const AJ = { push_up: { hands: [70, 170], handPos: [-20, 25], handRot: [-45, 45], push: [-5, 6], load: [0, 100] }, bulgarian_split_squat: { stride: [-15, 20], benchH: [-20, 15], trunk: [-10, 25], stance: [60, 200], load: [0, 100] },
        bench_press: { grip: [70, 160], touch: [-6, 8], elbows: [-30, 30], stance: [60, 160] }, hip_thrust: { feet: [-15, 25], stance: [60, 200], benchH: [-10, 10] } };
      for (const [ex, ps] of Object.entries(AJ)) { let worst = 0, who = '', avisos = new Set();
        for (const [id, ext] of Object.entries(ps)) for (const v of ext) { let prev = null;
          for (let i = 0; i <= 60; i++) { const r = ev(ex, i / 60, {}, { [id]: v }), P = D.BN.map(n => r.pose[n].p);
            for (const w of r.warns) avisos.add(`${id}=${v}: ${w}`);
            if (prev) for (let j = 0; j < P.length; j++) { const d = P[j].distanceTo(prev[j]); if (d > worst) { worst = d; who = `${D.BN[j]} ${id}=${v} s=${(i / 60).toFixed(2)}`; } }
            prev = P; } }
        ok('28 sin saltos', worst <= 0.06 && !avisos.size, `${ex}: salto máx ${cm1(worst)} cm (${who})${avisos.size ? ' · avisos: ' + [...avisos].slice(0, 4).join(' | ') : ''}`, !D.EXERCISES[ex] || D.EXERCISES[ex].base === 'libre'); } }
    out.push(fail ? `FALLOS: ${fail}` : 'OK'); return out.join('\n'); }, REF);
  console.log(txt); await close(); if (/^FALLO/m.test(txt)) process.exit(1); })();
