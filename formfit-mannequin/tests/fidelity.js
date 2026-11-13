// 1) FK del runtime == Blender en las claves, intermedias incluidas (0 mm).  2) Con valores por defecto, la pose final == pose autorada en las claves
//    (salvo la prensa y las claves de bisagra con el codo flexionado en Blender: el visor lo endereza).
// 3) Los pies no deslizan durante la repetición (sentadillas: sobre el suelo; prensa: sobre la plataforma).
const { open } = require('./harness');
(async () => { const { page, close } = await open();
  console.log(await page.evaluate(() => { const D = __dbg, out = []; let fail = 0; D.state.playing = false; const LIBRES = ['libre', 'floor', 'split', 'bench'];   // X03-07: las bases que salen de libre se miden igual
    for (const ex of Object.keys(D.POSES.exercises)) {
      // polea: por defecto la muñeca va recta (alineada con el antebrazo), no la de Blender; la fidelidad se mide con la de Blender
      if (D.EXERCISES[ex]?.base === 'cable') D.state.per[ex].wrist = 'autorada';
      const E = D.POSES.exercises[ex], keys = [['start', 0, E.start], ...(E.mid || []).map(m => [`clave s=${m.s.toFixed(2)}`, m.s, m]), ['end', 1, E.end]];
      // bisagra: el visor endereza los codos (regla: brazos rectos con la barra en las manos). Si alguna clave tiene el codo
      // flexionado en Blender, el ejercicio difiere a propósito (también las claves vecinas, que heredan el ajuste de cadera):
      // se avisa, para enderezarlo en Blender. Con todos rectos, ≤ 3 mm.
      const V = a => new D.THREE.Vector3(...a), elbowOf = B => 180 - V(B['DEF-ARM01.L'].p).sub(V(B['DEF-FORARM01.L'].p)).angleTo(V(B['DEF-HAND.L'].p).sub(V(B['DEF-FORARM01.L'].p))) * 180 / Math.PI;
      const hinge = D.EXERCISES[ex].base === 'hinge', bentEx = hinge && keys.some(([, , K]) => elbowOf(K.bones) > 8);
      for (const [k, s, K] of keys) {
        const A = D.withBody(D.DEFAULT_BODY, () => D.authoredPose(ex, s)), B = K.bones; let fk = 0;
        for (const n of D.BN) fk = Math.max(fk, A[n].p.distanceTo(new D.THREE.Vector3(...B[n].p)));
        // jalón (X03-26 R1, X03-27): la barra va siempre en el hueco de la mano y la muñeca va alineada con el antebrazo (absoluta), así que los brazos (hombro abajo) ya no se comparan con Blender:
        // solo se informa cuánto se apartan; todo lo demás sigue en 0,0 mm
        const jalon = D.POSES.exercises[ex].meta.impl === 'barra_jalon', brazo = n => /ARM0|FORARM|HAND|FINGER|THUMB|PALM/.test(n);
        const r = D.evaluate(ex, s); let dv = 0, dr1 = 0; for (const n of D.BN) { const d = r.pose[n].p.distanceTo(new D.THREE.Vector3(...B[n].p)); if (jalon && brazo(n)) dr1 = Math.max(dr1, d); else dv = Math.max(dv, d); }
        const elbow = elbowOf(B), bent = hinge && elbow > 8;
        const lim = D.EXERCISES[ex].base === 'seat' ? 0.06 : bentEx ? Infinity : hinge ? 0.003 : 0.001;   // prensa: pelvis fijada al asiento y plataforma sin rotar => difiere a propósito
        if (!(fk <= 0.001 && dv <= lim)) fail++;   // así también falla con NaN
        out.push(`${ex} ${k}: FK vs Blender ${(fk * 1000).toFixed(1)} mm · runtime por defecto vs Blender ${(dv * 1000).toFixed(1)} mm${jalon ? ` · brazos (R1) ${(dr1 * 1000).toFixed(1)} mm` : ''}${bent ? ` (aviso: en Blender el codo está flexionado ${elbow.toFixed(0)}°; el visor lo endereza)` : bentEx ? ' (aviso: hereda el codo enderezado de otra clave)' : ''}`);
      }
      if (D.EXERCISES[ex].base === 'hang') continue;   // colgado: los pies no se apoyan
      let slide = 0, f0;
      for (let i = 0; i <= 20; i++) { const r = D.evaluate(ex, i / 20), ref = r.plate || new D.THREE.Vector3();
        const f = r.pose['DEF-TOE.L'].p.clone().sub(ref); if (!i) f0 = f; slide = Math.max(slide, f.distanceTo(f0)); }
      const libre = LIBRES.includes(D.EXERCISES[ex].base);   // libre = la animación de Blender tal cual: si sus pies deslizan, es de Blender (se avisa, para retocarlo allí)
      if (!libre && !(slide <= 0.001)) fail++;
      out.push(`${ex}: deslizamiento del pie ${(slide * 1000).toFixed(1)} mm${libre && slide > 0.001 ? ' (aviso: viene de la animación de Blender)' : ''}`);
    }
    // libre (X03-02): con otra altura el mundo entero escala por k (pies en el suelo, nada desliza) y con otro fémur/tibia/tronco no cambia nada (sin STRETCH)
    for (const ex of Object.keys(D.EXERCISES).filter(e => LIBRES.includes(D.EXERCISES[e].base))) for (const s of [0, 0.5, 1]) {
      const sb = { ...D.state.body }, ev = b => { Object.assign(D.state.body, sb, b); try { return D.evaluate(ex, s); } finally { Object.assign(D.state.body, sb); } };
      const a = ev({}), h = ev({ height: 200 }), f = ev({ femur: 112, tibia: 90, torso: 108 }), k = 200 / 180; let dh = 0, df = 0;
      for (const n of D.BN) { dh = Math.max(dh, h.pose[n].p.distanceTo(a.pose[n].p.clone().multiplyScalar(k))); df = Math.max(df, f.pose[n].p.distanceTo(a.pose[n].p)); }
      const toe = Math.min(a.pose['DEF-TOE.L'].p.y, a.pose['DEF-TOE.R'].p.y), toeH = Math.min(h.pose['DEF-TOE.L'].p.y, h.pose['DEF-TOE.R'].p.y);
      if (!(dh <= 0.001 && df <= 0.001 && Math.abs(toeH - toe * k) <= 0.001)) fail++;
      out.push(`${ex} s=${s}: altura 200 vs escala exacta ${(dh * 1000).toFixed(2)} mm · fémur/tibia/tronco ${(df * 1000).toFixed(2)} mm`);
    }
    out.push(fail ? `FALLOS: ${fail}` : 'OK'); return out.join('\n'); }));
  await close(); })();
