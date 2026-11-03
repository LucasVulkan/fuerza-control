// 1) FK del runtime == Blender en las claves, intermedias incluidas (0 mm).  2) Con valores por defecto, la pose final == pose autorada en las claves.
// 3) Los pies no deslizan durante la repetición (sentadillas: sobre el suelo; prensa: sobre la plataforma).
const { open } = require('./harness');
(async () => { const { page, close } = await open();
  console.log(await page.evaluate(() => { const D = __dbg, out = []; let fail = 0; D.state.playing = false;
    for (const ex of Object.keys(D.POSES.exercises)) {
      const E = D.POSES.exercises[ex], keys = [['start', 0, E.start], ...(E.mid || []).map(m => [`clave s=${m.s.toFixed(2)}`, m.s, m]), ['end', 1, E.end]];
      for (const [k, s, K] of keys) {
        const A = D.withBody(D.DEFAULT_BODY, () => D.authoredPose(ex, s)), B = K.bones; let fk = 0;
        for (const n of D.BN) fk = Math.max(fk, A[n].p.distanceTo(new D.THREE.Vector3(...B[n].p)));
        const r = D.evaluate(ex, s); let dv = 0; for (const n of D.BN) dv = Math.max(dv, r.pose[n].p.distanceTo(new D.THREE.Vector3(...B[n].p)));
        const lim = D.EXERCISES[ex].base === 'seat' ? 0.06 : 0.001;   // prensa: pelvis fijada al asiento y plataforma sin rotar => difiere a propósito
        if (fk > 0.001 || dv > lim) fail++;
        out.push(`${ex} ${k}: FK vs Blender ${(fk * 1000).toFixed(1)} mm · runtime por defecto vs Blender ${(dv * 1000).toFixed(1)} mm`);
      }
      let slide = 0, f0;
      for (let i = 0; i <= 20; i++) { const r = D.evaluate(ex, i / 20), ref = r.plate || new D.THREE.Vector3();
        const f = r.pose['DEF-TOE.L'].p.clone().sub(ref); if (!i) f0 = f; slide = Math.max(slide, f.distanceTo(f0)); }
      if (slide > 0.001) fail++;
      out.push(`${ex}: deslizamiento del pie ${(slide * 1000).toFixed(1)} mm`);
    }
    out.push(fail ? `FALLOS: ${fail}` : 'OK'); return out.join('\n'); }));
  await close(); })();
