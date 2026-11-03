// Centro de masas del sistema vs mediopié al final de la repetición para distintos cuerpos/ajustes.
// Debe mantenerse igual que en la pose autorada (columna CdM) y los pies en el suelo.
// Bisagra (convencional, rumano): en el punto bajo (la clave con la barra más baja) la barra queda donde toca: en el suelo si la
// autorada está en el suelo (los discos no cambian con el cuerpo); si no, a la autorada escalada con la altura (±5 mm).
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
      const K = [D.POSES.exercises[ex].start, ...(D.POSES.exercises[ex].mid || []), D.POSES.exercises[ex].end], low = K.reduce((a, k) => k.bar.center[1] < a.bar.center[1] ? k : a);
      const sB = low === K[0] ? 0 : low === K[K.length - 1] ? 1 : low.s, A = low.bar.center[1], onFloor = A < 0.235;
      for (const [nm, body, prm] of hcases) for (const s of [0, 0.5, 1]) {
        const sb = { ...S.body }, sp = { ...S.per[ex] }; Object.assign(S.body, body); Object.assign(S.per[ex], prm); S.exId = ex;
        const r = D.evaluate(ex, s), want = onFloor ? A : A * (S.body.height / 180);
        const bad = s === sB && Math.abs(r.bar.center.y - want) > 0.005; if (bad) fail++;
        out.push(`${nm.padEnd(13)} ${ex} s=${s} ${r.readout.map(x => x[0] + ' ' + x[1]).join(' · ')}${bad ? ' · ¡la barra no está en su punto bajo!' : ''}${r.warns.length ? ' · ' + r.warns.join('; ') : ''}`);
        S.body = sb; S.per[ex] = sp; }
      // sin saltos: ningún paso de la barra entre frames contiguos puede ser más del doble que el mayor de sus dos vecinos
      // (antes el solver saltaba de solución: hasta 20 cm de golpe en un frame). Vale aunque el recorrido se recorte.
      for (const [nm, body, prm] of [...hcases, ['bloques', {}, { plates: 12 }], ['déficit', {}, { feet: 8 }], ['más hondo', {}, { depth: -15 }], ['menos hondo', {}, { depth: 15 }]]) {
        const sb = { ...S.body }, sp = { ...S.per[ex] }; Object.assign(S.body, body); Object.assign(S.per[ex], prm); S.exId = ex;
        const st = []; let prev; for (let i = 0; i <= 40; i++) { const c = D.evaluate(ex, i / 40).bar.center; if (prev) st.push(c.distanceTo(prev)); prev = c.clone(); }
        const worst = Math.max(...st.map((x, i) => x / Math.max(st[i - 1] ?? 0, st[i + 1] ?? 0, 0.003)));
        if (worst > 2) { fail++; out.push(`${nm.padEnd(13)} ${ex}: ¡salto entre frames: un paso ${worst.toFixed(1)}× el de al lado!`); }
        S.body = sb; S.per[ex] = sp; }
    }
    out.push(fail ? `FALLOS: ${fail}` : 'OK'); return out.join('\n'); }));
  await close(); })();
