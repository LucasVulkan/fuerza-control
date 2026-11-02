// Centro de masas del sistema vs mediopié al final de la repetición para distintos cuerpos/ajustes.
// Debe mantenerse igual que en la pose autorada (columna CdM) y los pies en el suelo.
const { open } = require('./harness');
(async () => { const { page, close } = await open();
  console.log(await page.evaluate(() => { const D = __dbg, S = D.state, out = []; S.playing = false;
    const cases = [['por defecto', {}, {}], ['tobillo 20°', { dorsi: 20 }, {}], ['fémur 112%', { femur: 112, tibia: 98, torso: 95 }, {}], ['tronco 110%', { femur: 94, torso: 110 }, {}],
      ['1,65 m', { height: 165 }, {}], ['sin carga', {}, { load: 0 }], ['carga 200%', {}, { load: 200 }], ['pies anchos', {}, { stance: 1.35, toes: 15 }], ['más profunda', {}, { depth: 1.15 }]];
    for (const [nm, body, prm] of cases) for (const ex of Object.keys(D.EXERCISES).filter(e => D.EXERCISES[e].base === 'stand')) {
      const sb = { ...S.body }, sp = { ...S.per[ex] }; Object.assign(S.body, body); Object.assign(S.per[ex], prm); S.exId = ex;
      const r = D.evaluate(ex, 1); const footY = Math.min(r.pose['DEF-FOOT.L'].p.y, r.pose['DEF-FOOT.R'].p.y);
      out.push(`${nm.padEnd(13)} ${ex.padEnd(12)} ${r.readout.map(x => x[0] + ' ' + x[1]).join(' · ')} · tobillo y=${(footY * 1000).toFixed(0)} mm${r.warns.length ? ' · ' + r.warns.join('; ') : ''}`);
      S.body = sb; S.per[ex] = sp; }
    return out.join('\n'); }));
  await close(); })();
