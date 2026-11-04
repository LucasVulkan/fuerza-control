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
    // con el cuerpo y los ajustes por defecto, la carga no cambia la pose: el objetivo de CdM se calcula con la carga actual
    // (si no, sin peso la frontal se doblaba y el peso muerto acababa inclinado hacia delante). Con la mitad de la carga por
    // defecto: sin carga, la bisagra cambia a propósito (su CdM sale del pie y pivota sobre el tobillo). Margen de 5 mm: en la
    // bisagra el visor endereza los codos de las claves, así que su pose ya no es la autorada y esa diferencia pesa distinto.
    for (const ex of Object.keys(D.EXERCISES).filter(e => D.EXERCISES[e].base !== 'seat')) for (const s of [0, 1]) {
      const sp = { ...S.per[ex] }; S.exId = ex; const P0 = D.evaluate(ex, s).pose; S.per[ex].load = sp.load / 2; const r1 = D.evaluate(ex, s), P1 = r1.pose; S.per[ex] = sp;
      let dv = 0; for (const n of D.BN) dv = Math.max(dv, P0[n].p.distanceTo(P1[n].p));
      const atEdge = Math.abs(r1.com - r1.mid) > 0.059;   // el CdM llega al borde de la zona del pie: pivota a propósito
      if (dv > 0.005 && !atEdge) { fail++; out.push(`${ex} s=${s}: ¡con la mitad de carga la pose cambia ${(dv * 1000).toFixed(0)} mm con el cuerpo por defecto!`); }
    }
    // implementos (X02): las manos llegan al asa todo el recorrido
    for (const ex of Object.keys(D.EXERCISES).filter(e => D.EXERCISES[e].base === 'hinge')) for (const impl of (D.PRM && ['mancuernas', 'mancuernas_lado', 'kettlebell', 'kettlebells'])) {
      const sp = { ...S.per[ex] }; S.exId = ex; S.per[ex].impl = impl;
      for (let i = 0; i <= 10; i++) { const r = D.evaluate(ex, i / 10), w = r.warns.find(x => x.includes('no llega a la barra')); if (w) { fail++; out.push(`${ex} ${impl} s=${i / 10}: ¡${w}!`); break; } }
      S.per[ex] = sp; }
    // rumano (no empieza en el suelo): con cualquier implemento la mano va por donde con la barra (±1,5 cm)
    for (const ex of Object.keys(D.EXERCISES).filter(e => D.EXERCISES[e].base === 'hinge' && D.POSES.exercises[e].start.bar.center[1] > 0.3)) {
      const sp = { ...S.per[ex] }; S.exId = ex; const wrist = () => [0, 0.25, 0.5, 0.75, 1].map(s => D.evaluate(ex, s).pose['DEF-HAND.L'].p.y);
      S.per[ex].impl = 'barra'; const w0 = wrist();
      for (const impl of ['mancuernas', 'mancuernas_lado', 'kettlebell', 'kettlebells']) { S.per[ex].impl = impl; const w = wrist(), dv = Math.max(...w.map((y, i) => Math.abs(y - w0[i])));
        if (dv > 0.015) { fail++; out.push(`${ex} ${impl}: ¡la mano va ${(dv * 100).toFixed(1)} cm por otro sitio que con la barra!`); } }
      S.per[ex] = sp; }
    // colgado: las manos no se mueven en la barra en todo el recorrido (antes, entre claves, iban en arco hasta 5 cm)
    for (const ex of Object.keys(D.EXERCISES).filter(e => D.EXERCISES[e].base === 'hang')) for (const gt of ['prono', 'supino', 'neutro']) {
      const sp = { ...S.per[ex] }; S.exId = ex; S.per[ex].gripType = gt; let w0, dv = 0;
      for (let i = 0; i <= 20; i++) { const r = D.evaluate(ex, i / 20), w = r.pose['DEF-HAND.L'].p.clone().sub(r.bar.center); if (!w0) w0 = w; dv = Math.max(dv, w.distanceTo(w0)); }
      if (dv > 0.01) { fail++; out.push(`${ex} ${gt}: ¡la mano se mueve ${(dv * 100).toFixed(1)} cm en la barra!`); }
      S.per[ex] = sp; }
    // sin carga, el CdM de la bisagra no sale del pie: pivota sobre el tobillo (antes: «se caería», 12 cm detrás)
    for (const ex of Object.keys(D.EXERCISES).filter(e => D.EXERCISES[e].base === 'hinge')) for (let i = 0; i <= 10; i++) {
      const sp = { ...S.per[ex] }; S.exId = ex; S.per[ex].load = 0; const r = D.evaluate(ex, i / 10); S.per[ex] = sp;
      const off = r.com - r.mid; if (Math.abs(off) > 0.065) { fail++; out.push(`${ex} s=${i / 10} sin carga: ¡el CdM queda a ${(off * 100).toFixed(1)} cm del mediopié!`); }
    }
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
      for (const [nm, body, prm] of [...hcases, ['bloques', {}, { plates: 12 }], ['déficit', {}, { feet: 8 }], ['más hondo', {}, { depth: -15 }], ['menos hondo', {}, { depth: 15 }],
        ['mancuernas', {}, { impl: 'mancuernas' }], ['a los lados', {}, { impl: 'mancuernas_lado' }], ['kettlebell', {}, { impl: 'kettlebell' }], ['2 kettlebells', {}, { impl: 'kettlebells' }]]) {
        const sb = { ...S.body }, sp = { ...S.per[ex] }; Object.assign(S.body, body); Object.assign(S.per[ex], prm); S.exId = ex;
        const st = []; let prev; for (let i = 0; i <= 40; i++) { const c = D.evaluate(ex, i / 40).bar.center; if (prev) st.push(c.distanceTo(prev)); prev = c.clone(); }
        const worst = Math.max(...st.map((x, i) => x / Math.max(st[i - 1] ?? 0, st[i + 1] ?? 0, 0.003)));
        if (worst > 2) { fail++; out.push(`${nm.padEnd(13)} ${ex}: ¡salto entre frames: un paso ${worst.toFixed(1)}× el de al lado!`); }
        S.body = sb; S.per[ex] = sp; }
    }
    // remo: sin saltos entre frames, las manos llegan a la barra o al asa y, abajo, el brazo sigue recto (codo como el autorado)
    for (const ex of Object.keys(D.EXERCISES).filter(e => D.EXERCISES[e].base === 'row')) {
      const elbow0 = D.evaluate(ex, 0).readout.find(x => x[0] === 'Codo')[1];
      for (const [nm, body, prm] of [['por defecto', {}, {}], ['1,65 m', { height: 165 }, {}], ['1,95 m', { height: 195 }, {}], ['fémur 112%', { femur: 112, tibia: 98, torso: 95 }, {}],
        ['erguido', {}, { trunk: -30 }], ['inclinado', {}, { trunk: 25 }], ['al pecho', {}, { dest: -20 }], ['ancho', {}, { grip: 1.35 }], ['estrecho', {}, { grip: 0.85 }],
        ['supino', {}, { gripType: 'supino' }], ['mancuernas', {}, { impl: 'mancuernas' }], ['neutras', {}, { impl: 'mancuernas_lado' }], ['2 kettlebells', {}, { impl: 'kettlebells' }]]) {
        const sb = { ...S.body }, sp = { ...S.per[ex] }; Object.assign(S.body, body); Object.assign(S.per[ex], prm); S.exId = ex;
        const st = []; let prev, miss;
        for (let i = 0; i <= 40; i++) { const r = D.evaluate(ex, i / 40), c = r.bar.center; if (prev) st.push(c.distanceTo(prev)); prev = c.clone(); miss ??= r.warns.find(x => x.includes('no llega')); }
        const worst = Math.max(...st.map((x, i) => x / Math.max(st[i - 1] ?? 0, st[i + 1] ?? 0, 0.003))), e0 = D.evaluate(ex, 0).readout.find(x => x[0] === 'Codo')[1];
        if (worst > 2) { fail++; out.push(`${nm.padEnd(13)} ${ex}: ¡salto entre frames: un paso ${worst.toFixed(1)}× el de al lado!`); }
        if (miss) { fail++; out.push(`${nm.padEnd(13)} ${ex}: ¡${miss}!`); }
        if (Math.abs(parseFloat(e0) - parseFloat(elbow0)) > 2) { fail++; out.push(`${nm.padEnd(13)} ${ex}: ¡abajo el codo está a ${e0} (autorado ${elbow0})!`); }
        S.body = sb; S.per[ex] = sp; }
    }
    out.push(fail ? `FALLOS: ${fail}` : 'OK'); return out.join('\n'); }));
  await close(); })();
