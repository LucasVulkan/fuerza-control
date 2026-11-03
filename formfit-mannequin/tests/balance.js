// Centro de masas del sistema vs mediopié al final de la repetición para distintos cuerpos/ajustes.
// Debe mantenerse igual que en la pose autorada (columna CdM) y los pies en el suelo.
// Bisagra (peso muerto): al empezar la barra sigue en el suelo (altura autorada, ±5 mm) y sobre el mediopié como en la autorada.
const { open } = require('./harness');
(async () => { const { page, close } = await open();
  console.log(await page.evaluate(() => { const D = __dbg, S = D.state, out = []; S.playing = false; let fail = 0;
    const cases = [['por defecto', {}, {}], ['tobillo 20°', { dorsi: 20 }, {}], ['fémur 112%', { femur: 112, tibia: 98, torso: 95 }, {}], ['tronco 110%', { femur: 94, torso: 110 }, {}],
      ['1,65 m', { height: 165 }, {}], ['sin carga', {}, { load: 0 }], ['carga 200%', {}, { load: 200 }], ['pies anchos', {}, { stance: 1.35, toes: 15 }], ['más profunda', {}, { depth: 1.15 }]];
    for (const [nm, body, prm] of cases) for (const ex of Object.keys(D.EXERCISES).filter(e => D.EXERCISES[e].base === 'stand')) {
      const sb = { ...S.body }, sp = { ...S.per[ex] }; Object.assign(S.body, body); Object.assign(S.per[ex], prm); S.exId = ex;
      const r = D.evaluate(ex, 1); const footY = Math.min(r.pose['DEF-FOOT.L'].p.y, r.pose['DEF-FOOT.R'].p.y);
      out.push(`${nm.padEnd(13)} ${ex.padEnd(12)} ${r.readout.map(x => x[0] + ' ' + x[1]).join(' · ')} · tobillo y=${(footY * 1000).toFixed(0)} mm${r.warns.length ? ' · ' + r.warns.join('; ') : ''}`);
      S.body = sb; S.per[ex] = sp; }
    const hcases = [['por defecto', {}, {}], ['fémur 112%', { femur: 112, tibia: 98, torso: 95 }, {}], ['tronco 110%', { femur: 94, torso: 110 }, {}],
      ['1,65 m', { height: 165 }, {}], ['1,95 m', { height: 195 }, {}], ['más rodilla', {}, { knees: 6 }], ['pies anchos', {}, { stance: 1.3, toes: 15 }]];
    for (const ex of Object.keys(D.EXERCISES).filter(e => D.EXERCISES[e].base === 'hinge')) {
      const A = D.POSES.exercises[ex].start.bar.center[1];
      for (const [nm, body, prm] of hcases) for (const s of [0, 0.5, 1]) {
        const sb = { ...S.body }, sp = { ...S.per[ex] }; Object.assign(S.body, body); Object.assign(S.per[ex], prm); S.exId = ex;
        const r = D.evaluate(ex, s);
        const bad = s === 0 && Math.abs(r.bar.center.y - A) > 0.005; if (bad) fail++;
        out.push(`${nm.padEnd(13)} ${ex} s=${s} ${r.readout.map(x => x[0] + ' ' + x[1]).join(' · ')}${bad ? ' · ¡la barra no está en el suelo!' : ''}${r.warns.length ? ' · ' + r.warns.join('; ') : ''}`);
        S.body = sb; S.per[ex] = sp; }
      // sin saltos: entre frames contiguos la barra no se mueve mucho más que con el cuerpo por defecto (antes el solver
      // saltaba de solución: hasta 20 cm de golpe)
      let ref;
      for (const [nm, body, prm] of hcases) {
        const sb = { ...S.body }, sp = { ...S.per[ex] }; Object.assign(S.body, body); Object.assign(S.per[ex], prm); S.exId = ex;
        let prev, jump = 0; for (let i = 0; i <= 40; i++) { const c = D.evaluate(ex, i / 40).bar.center; if (prev) jump = Math.max(jump, c.distanceTo(prev)); prev = c.clone(); }
        ref ??= jump;
        if (jump > ref * 1.5) { fail++; out.push(`${nm.padEnd(13)} ${ex}: ¡salto de ${(jump * 100).toFixed(1)} cm entre frames (por defecto ${(ref * 100).toFixed(1)})!`); }
        S.body = sb; S.per[ex] = sp; }
    }
    out.push(fail ? `FALLOS: ${fail}` : 'OK'); return out.join('\n'); }));
  await close(); })();
