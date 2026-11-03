(() => {
/* =====================================================================
   FormFit · runtime de ejercicios
   Pose autorada en Blender (inicio/final) + correcciones del solver:
   equilibrio, proporciones, anchura/rotación de pies, agarre, profundidad.
   Con los ajustes por defecto, el resultado es exactamente la pose autorada.
   ===================================================================== */
const DEG = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const QA = (axis, ang) => new THREE.Quaternion().setFromAxisAngle(axis, ang);
const X = V(1, 0, 0), Y = V(0, 1, 0), Z = V(0, 0, 1);
const POSES = JSON.parse(document.getElementById('poses-json').textContent);

/* ---------------- Ejercicios: qué sliders tiene cada uno ---------------- */
const EXERCISES = {
  back_squat: { name: 'Sentadilla trasera', short: 'Trasera', base: 'stand', bar: true, elbowPref: null },
  front_squat: { name: 'Sentadilla frontal', short: 'Frontal', base: 'stand', bar: true },
  leg_press: { name: 'Prensa 45°', short: 'Prensa', base: 'seat', bar: false },
  deadlift: { name: 'Peso muerto', short: 'Muerto', base: 'hinge', bar: true },
};
// las acciones nuevas aparecen solas con su meta (ff_base, ff_name) aunque no estén en la lista
for (const [id, e] of Object.entries(POSES.exercises)) EXERCISES[id] ??= { name: e.meta.name, short: e.meta.name, base: e.meta.base, bar: e.meta.base !== 'seat' };
const PARAMS = {
  stand: [
    { id: 'depth', label: 'Profundidad', min: 0.6, max: 1.25, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}% de la autorada` },
    { id: 'knees', label: 'Avance de rodillas', min: -12, max: 12, step: 1, def: 0, fmt: v => `${v > 0 ? '+' : ''}${v}°` },
    { id: 'stance', label: 'Anchura de pies', min: 0.75, max: 1.4, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}%` },
    { id: 'toes', label: 'Rotación de pies', min: -15, max: 20, step: 1, def: 0, fmt: v => `${v > 0 ? '+' : ''}${v}° sobre la autorada` },
    { id: 'grip', label: 'Anchura de agarre', min: 0.8, max: 1.3, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}%` },
    { id: 'barH', label: 'Altura de la barra', min: -6, max: 4, step: 0.5, def: 0, fmt: v => `${v > 0 ? '+' : ''}${v} cm` },
    { id: 'load', label: 'Carga', min: 0, max: 200, step: 5, def: 100, fmt: v => `${v}% del peso corporal` },
  ],
  seat: [
    { id: 'startOff', label: 'Inicio del recorrido', min: -12, max: 3, step: 0.5, def: 0, fmt: v => v === 0 ? 'autorado' : `${v > 0 ? '+' : ''}${v} cm ${v > 0 ? 'más extendido' : 'más flexionado'}` },
    { id: 'depth', label: 'Final del recorrido', min: 0.5, max: 1.3, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}% del autorado` },
    { id: 'footHigh', label: 'Altura de pies en la plataforma', min: -10, max: 10, step: 0.5, def: 0, fmt: v => `${v > 0 ? '+' : ''}${v} cm` },
    { id: 'stance', label: 'Anchura de pies', min: 0.75, max: 1.4, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}%` },
    { id: 'toes', label: 'Rotación de pies', min: -15, max: 20, step: 1, def: 0, fmt: v => `${v > 0 ? '+' : ''}${v}°` },
    { id: 'load', label: 'Carga', min: 0, max: 400, step: 10, def: 180, fmt: v => `${v}% del peso corporal` },
  ],
  // bisagra (peso muerto): la barra cuelga de las manos; empieza en el suelo y sube sobre el mediopié
  hinge: [
    { id: 'knees', label: 'Rodilla al empezar', min: -6, max: 8, step: 1, def: 0, fmt: v => `${v > 0 ? '+' : ''}${v}° de tibia` },
    { id: 'stance', label: 'Anchura de pies', min: 0.75, max: 1.4, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}%` },
    { id: 'toes', label: 'Rotación de pies', min: -15, max: 20, step: 1, def: 0, fmt: v => `${v > 0 ? '+' : ''}${v}° sobre la autorada` },
    { id: 'grip', label: 'Anchura de agarre', min: 0.9, max: 1.3, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}%` },
    { id: 'load', label: 'Carga', min: 0, max: 300, step: 10, def: 150, fmt: v => `${v}% del peso corporal` },
  ],
};
const PRESETS = {
  avg: { femur: 100, tibia: 100, torso: 100, dorsi: 35 },
  femur: { femur: 112, tibia: 98, torso: 95, dorsi: 35 },
  torso: { femur: 94, tibia: 100, torso: 110, dorsi: 35 },
  ankle: { femur: 100, tibia: 100, torso: 100, dorsi: 20 },
};
const state = { exId: 'back_squat', per: {}, body: { height: 180, ...PRESETS.avg }, s: 1, playing: !matchMedia('(prefers-reduced-motion: reduce)').matches, lines: true, heat: true, ref: false };
for (const [id, ex] of Object.entries(EXERCISES)) state.per[id] = Object.fromEntries(PARAMS[ex.base].map(p => [p.id, p.def]));
const EX = () => EXERCISES[state.exId], PRM = () => state.per[state.exId];
const isDefault = () => PARAMS[EX().base].every(p => PRM()[p.id] === p.def) && state.body.height === 180 && ['femur', 'tibia', 'torso'].every(k => state.body[k] === 100) && state.body.dorsi === 35;

/* ---------------- Rig ---------------- */
const RIG = { ready: false };
const W = {};                                     // pose mundial por hueso {p, q}
const BN = POSES.bones, PARENT = POSES.parent;
const ORDER = [];                                 // padres antes que hijos
(function topo() { const done = new Set(); const visit = n => { if (done.has(n)) return; if (PARENT[n]) visit(PARENT[n]); done.add(n); ORDER.push(n); }; BN.forEach(visit); })();
const REST = {}, LOCAL_OFF = {};
for (const n of BN) REST[n] = { p: V(...POSES.rest[n].p), q: new THREE.Quaternion(...POSES.rest[n].q) };
for (const n of BN) { const P = PARENT[n]; if (P) LOCAL_OFF[n] = REST[n].p.clone().sub(REST[P].p).applyQuaternion(REST[P].q.clone().invert()); }

const STRETCH = n => {
  const b = state.body;
  if (/^DEF-THIGH0[12]/.test(n)) return b.femur / 100;
  if (/^DEF-SHIN0[12]/.test(n)) return b.tibia / 100;
  if (/^DEF-(SPINE0[12]|HIPS)$/.test(n)) return b.torso / 100;
  return 1;
};
const K = () => state.body.height / 180;          // escala global

// FK: rotaciones mundiales dadas -> posiciones coherentes con longitudes (proporciones incluidas)
function fkPositions(pose, rootP) {
  const k = K();
  for (const n of ORDER) {
    const P = PARENT[n];
    if (!P) { pose[n].p = rootP.clone(); continue; }
    const off = LOCAL_OFF[n].clone(); off.y *= STRETCH(P);
    pose[n].p = off.multiplyScalar(k).applyQuaternion(pose[P].q).add(pose[P].p);
  }
}
// Pose autorada interpolada (rotaciones locales -> slerp -> FK)
const AUTH = {};
function authoredLocal(ex) {
  if (AUTH[ex]) return AUTH[ex];
  const out = {};
  for (const key of ['start', 'end']) {
    const B = POSES.exercises[ex][key].bones; const loc = {}, off = {};
    for (const n of BN) {
      const q = new THREE.Quaternion(...B[n].q), P = PARENT[n];
      loc[n] = P ? new THREE.Quaternion(...B[P].q).invert().multiply(q) : q;
      if (P) off[n] = V(...B[n].off);
    }
    out[key] = { loc, off, root: V(...B['DEF-HIPS'].p) };
  }
  return (AUTH[ex] = out);
}
let CUR_OFF = null;                                // desplazamientos locales autorados del frame actual
function authoredOffsets(ex, s) { const A = authoredLocal(ex), o = {}; for (const n of BN) if (PARENT[n]) o[n] = A.start.off[n].clone().lerp(A.end.off[n], s); return o; }
function authoredPose(ex, s) {
  const A = authoredLocal(ex), pose = {};
  for (const n of ORDER) {
    const lq = A.start.loc[n].clone().slerp(A.end.loc[n], s), P = PARENT[n];
    pose[n] = { q: P ? pose[P].q.clone().multiply(lq) : lq, p: V() };
  }
  const offs = authoredOffsets(ex, s), saved = CUR_OFF; CUR_OFF = offs;
  pose['DEF-HIPS'].p = A.start.root.clone().lerp(A.end.root, s); fkSub(pose, 'DEF-HIPS');
  CUR_OFF = saved; return pose;
}
// transformaciones mundiales exactas exportadas de Blender (para apoyos: pies, asas)
const EXP = (ex, key, n) => POSES.exercises[ex][key].bones[n];
const expP = (ex, n, s) => V(...EXP(ex, 'start', n).p).lerp(V(...EXP(ex, 'end', n).p), s);
const expQ = (ex, n, s) => new THREE.Quaternion(...EXP(ex, 'start', n).q).slerp(new THREE.Quaternion(...EXP(ex, 'end', n).q), s);
// centro de masas sagital del sistema respecto al mediopié (mismas masas que el solver)
function midfootZ(P) { return ['L', 'R'].map(S => { const a = P[`DEF-FOOT.${S}`].p, t = P[`DEF-TOE.${S}`].p; return a.z + 0.4 * (t.z - a.z); }).reduce((x, y) => x + y) / 2; }
function comOffset(P, bar, load) {
  const m = (a, b) => P[a].p.clone().add(P[b].p).multiplyScalar(0.5);
  const hip = m('DEF-THIGH01.L', 'DEF-THIGH01.R'), sh = m('DEF-ARM01.L', 'DEF-ARM01.R');
  let z = 0.678 * hip.clone().lerp(sh, 0.62).z, M = 0.678;
  for (const S of ['L', 'R']) { const h = P[`DEF-THIGH01.${S}`].p, k = P[`DEF-SHIN01.${S}`].p, a = P[`DEF-FOOT.${S}`].p, t = P[`DEF-TOE.${S}`].p;
    z += 0.1 * (h.z + k.z) / 2 + 0.0465 * (k.z + a.z) / 2 + 0.0145 * (a.z + 0.4 * (t.z - a.z)); M += 0.161; }
  const mb = load / 100; z += mb * bar.z; M += mb;
  return z / M - midfootZ(P);
}
const clonePose = P => Object.fromEntries(Object.entries(P).map(([n, v]) => [n, { p: v.p.clone(), q: v.q.clone() }]));
const midOf = (P, a, b) => P[a].p.clone().add(P[b].p).multiplyScalar(0.5);
const sag = v => Math.atan2(v.z, v.y);            // inclinación hacia delante (+Z) desde la vertical

/* ---------------- Medidas del cuerpo (dependen de proporciones) ---------------- */
function dims() {
  const P = {}; for (const n of BN) P[n] = { p: V(), q: REST[n].q.clone() };
  fkPositions(P, REST['DEF-HIPS'].p.clone().multiplyScalar(K()));
  const hipL = P['DEF-THIGH01.L'].p, hipR = P['DEF-THIGH01.R'].p, kn = P['DEF-SHIN01.L'].p, an = P['DEF-FOOT.L'].p;
  const shL = P['DEF-ARM01.L'].p, shR = P['DEF-ARM01.R'].p;
  const hipMid = hipL.clone().add(hipR).multiplyScalar(0.5), shMid = shL.clone().add(shR).multiplyScalar(0.5);
  return {
    k: K(), Lt: kn.distanceTo(hipL), Ls: an.distanceTo(kn), Ltr: shMid.distanceTo(hipMid),
    Lu: P['DEF-FORARM01.L'].p.distanceTo(shL), Lf: P['DEF-HAND.L'].p.distanceTo(P['DEF-FORARM01.L'].p),
    ankleH: REST['DEF-FOOT.L'].p.y * K(), hipHalf: Math.abs(hipL.x - hipR.x) / 2, shHalf: Math.abs(shL.x - shR.x) / 2,
    mf: 0.4 * Math.abs(P['DEF-TOE.L'].p.z - an.z) + 0.02 * K(), dorsi: state.body.dorsi,
  };
}
const DEFAULT_BODY = { height: 180, ...PRESETS.avg };
function withBody(body, fn) { const saved = state.body; state.body = body; try { return fn(); } finally { state.body = saved; } }

/* ---------------- Solver de equilibrio (de pie) ---------------- */
// Dado ángulo de muslo (beta) y preferencia de tibia (thPref), devuelve tronco (phi) y tibia (th) que ponen el CdM sobre el mediopié.
function solveStand(d, beta, thPref, phiPref, stanceHalf, toeYaw, barOff, load, thLimit) {
  const dx = Math.max(0, stanceHalf - d.hipHalf);
  const cv = Math.cos(Math.asin(Math.min(0.95, dx / (d.Ls + d.Lt)))), ch = Math.cos(toeYaw * 0.85);
  const engage = clamp(beta / (100 * DEG));
  const mfz = d.mf * Math.cos(toeYaw);
  const mb = load / 100, mT = 0.678, mTh = 0.2, mSh = 0.093, mFt = 0.029, tot = mT + mTh + mSh + mFt + mb;
  function geo(phi, th) {
    const knee = { z: d.Ls * Math.sin(th) * ch, y: d.ankleH + d.Ls * Math.cos(th) * cv };
    const hip = { z: knee.z - d.Lt * Math.sin(beta) * ch, y: knee.y + d.Lt * Math.cos(beta) * cv };
    const u = { z: Math.sin(phi), y: Math.cos(phi) }, n = { z: Math.cos(phi), y: -Math.sin(phi) };
    const sh = { z: hip.z + u.z * d.Ltr, y: hip.y + u.y * d.Ltr };
    const bar = { z: sh.z + u.z * barOff.du + n.z * barOff.dn, y: sh.y + u.y * barOff.du + n.y * barOff.dn };
    const trunk = { z: hip.z + u.z * d.Ltr * 0.62, y: hip.y + u.y * d.Ltr * 0.62 };
    const comZ = (mT * trunk.z + mTh * (hip.z + knee.z) / 2 + mSh * knee.z / 2 + mFt * mfz + mb * bar.z) / tot;
    return { phi, th, knee, hip, u, sh, bar, trunk, comZ };
  }
  const F = (phi, th) => geo(phi, th).comZ - mfz;
  const thMax = thLimit ?? d.dorsi * DEG, thMin = -10 * DEG, phMin = -15 * DEG, phMax = 85 * DEG;
  const wTh = 2.5 + 25 * engage * engage;
  let phi = phiPref, th = clamp(thPref, thMin, thMax);
  for (let i = 0; i < 12; i++) {
    const f = F(phi, th); if (Math.abs(f) < 1e-6) break;
    const e = 1e-4, fp = (F(phi + e, th) - f) / e, ft = (F(phi, th + e) - f) / e;
    let gt = ft / wTh; if ((th <= thMin && gt * f > 0) || (th >= thMax && gt * f < 0)) gt = 0;
    const den = fp * fp + ft * gt; if (den < 1e-12) break;
    phi = clamp(phi - f * fp / den, phMin, phMax); th = clamp(th - f * gt / den, thMin, thMax);
  }
  const g = geo(phi, th);
  // demanda (momentos cuasi-estáticos)
  const aboveHip = mT + mb, zH = (mT * g.trunk.z + mb * g.bar.z) / aboveHip, Mhip = aboveHip * (zH - g.hip.z);
  const aboveKnee = aboveHip + mTh, zK = (mT * g.trunk.z + mb * g.bar.z + mTh * (g.hip.z + g.knee.z) / 2) / aboveKnee, Mknee = aboveKnee * (g.knee.z - zK);
  const l5z = g.hip.z + g.u.z * 0.1, upz = g.hip.z + g.u.z * d.Ltr * 0.7, Mspine = 0.55 * (upz - l5z) + mb * (g.bar.z - l5z);
  const deep = clamp(beta / (110 * DEG)), hipN = Mhip / (0.55 * d.k);
  const act = {
    quads: clamp(Mknee / (0.4 * d.k)), glutes: clamp(hipN * (0.55 + 0.45 * deep)), hams: clamp(hipN * 0.6),
    add: clamp(hipN * (0.3 + 0.4 * clamp((stanceHalf / d.shHalf - 0.8) / 0.8)) * (0.3 + 0.7 * deep)),
    erect: clamp(Mspine / (0.5 * d.k)), calves: clamp(tot * mfz / (0.12 * d.k) * 0.55),
  };
  return { ...g, act, mfz, balance: Math.abs(F(phi, th)) };
}

/* ---------------- Utilidades de IK ---------------- */
const _m0 = new THREE.Matrix4(), _m1 = new THREE.Matrix4();
function frame(prim, sec) {
  const x = prim.clone().normalize(); const z = sec.clone().sub(x.clone().multiplyScalar(sec.dot(x))).normalize();
  return new THREE.Matrix4().makeBasis(x, z.clone().cross(x), z);
}
// rotación que lleva el marco (prim0, sec0) a (prim1, sec1)
function deltaFrames(prim0, sec0, prim1, sec1) {
  return new THREE.Quaternion().setFromRotationMatrix(frame(prim1, sec1).multiply(frame(prim0, sec0).transpose()));
}
function twoBone(A, C, a, b, pole) {
  const AC = C.clone().sub(A); const raw = AC.length() || 1e-6; const u = AC.divideScalar(raw);
  const dist = clamp(raw, Math.abs(a - b) + 1e-4, a + b - 1e-4);
  const x = (a * a - b * b + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, a * a - x * x));
  const p = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))); if (p.lengthSq() < 1e-8) p.set(0, 0, 1); p.normalize();
  const mid = A.clone().addScaledVector(u, x).addScaledVector(p, h);
  return { mid, end: mid.clone().addScaledVector(C.clone().sub(mid).normalize(), b), miss: Math.max(0, raw - (a + b)) };
}
function poleOf(A, M, C) { const u = C.clone().sub(A).normalize(); const o = M.clone().sub(A); return o.sub(u.multiplyScalar(o.dot(u))).normalize(); }
// Recoloca una extremidad de 2 segmentos (cada uno con 2 huesos: X01/X02) conservando el reparto de giro autorado.
function solveLimb(pose, auth, names, target, poleDir, lens) {
  const [u1, u2, l1, l2, end] = names;
  const A = pose[u1].p.clone();
  const aMid = auth[l1].p, aEnd = auth[end].p, aA = auth[u1].p;
  const aUp = aMid.clone().sub(aA), aLo = aEnd.clone().sub(aMid);
  let aHinge = aUp.clone().cross(aLo); if (aHinge.lengthSq() < 1e-8) aHinge = poleOf(aA, aMid, aEnd).cross(aEnd.clone().sub(aA));
  const ik = twoBone(A, target, lens[0], lens[1], poleDir);
  const nUp = ik.mid.clone().sub(A), nLo = ik.end.clone().sub(ik.mid);
  let nHinge = nUp.clone().cross(nLo); if (nHinge.lengthSq() < 1e-8) nHinge = poleDir.clone().cross(nUp);
  if (nHinge.dot(aHinge) < 0 && aUp.clone().cross(aLo).lengthSq() < 1e-6) nHinge.negate();
  const dU = deltaFrames(aUp, aHinge, nUp, nHinge), dL = deltaFrames(aLo, aHinge, nLo, nHinge);
  pose[u1].q = dU.clone().multiply(auth[u1].q); pose[u2].q = dU.clone().multiply(auth[u2].q);
  pose[l1].q = dL.clone().multiply(auth[l1].q); pose[l2].q = dL.clone().multiply(auth[l2].q);
  return ik;
}
// FK parcial: recalcula posiciones de un subárbol a partir de su raíz
function fkFrom(pose, root) {
  const k = K(), stack = [root];
  const kids = n => BN.filter(c => PARENT[c] === n);
  while (stack.length) {
    const n = stack.pop();
    for (const c of kids(n)) {
      const off = LOCAL_OFF[c].clone(); off.y *= STRETCH(n);
      pose[c].p = off.multiplyScalar(k).applyQuaternion(pose[n].q).add(pose[n].p); stack.push(c);
    }
  }
}
const KIDS = {}; for (const n of BN) KIDS[n] = BN.filter(c => PARENT[c] === n);
function fkSub(pose, root, setRot) {
  const k = K(), st = [root];
  while (st.length) { const n = st.pop(); for (const c of KIDS[n]) { if (setRot) setRot(c); const off = (CUR_OFF ? CUR_OFF[c] : LOCAL_OFF[c]).clone(); off.y *= STRETCH(n); pose[c].p = off.multiplyScalar(k).applyQuaternion(pose[n].q).add(pose[n].p); st.push(c); } }
}
function subtree(root) { const out = [], st = [root]; while (st.length) { const n = st.pop(); out.push(n); st.push(...KIDS[n]); } return out; }

/* ---------------- Rasgos de la pose autorada ---------------- */
function features(P, ex, s) {
  const hip = midOf(P, 'DEF-THIGH01.L', 'DEF-THIGH01.R'), sh = midOf(P, 'DEF-ARM01.L', 'DEF-ARM01.R');
  const f = { hip, sh, phi: sag(sh.clone().sub(hip)) };
  const side = S => {
    const h = P[`DEF-THIGH01.${S}`].p, kn = P[`DEF-SHIN01.${S}`].p, an = P[`DEF-FOOT.${S}`].p, toe = P[`DEF-TOE.${S}`].p;
    const fd = toe.clone().sub(an); fd.y = 0;
    return { h, kn, an, beta: -sag(h.clone().sub(kn)), th: sag(kn.clone().sub(an)), yaw: Math.atan2(fd.x, fd.z), legPole: poleOf(h, kn, an) };
  };
  f.L = side('L'); f.R = side('R');
  f.beta = (f.L.beta + f.R.beta) / 2; f.th = (f.L.th + f.R.th) / 2;
  const fr = k => POSES.exercises[ex][k];
  const A = fr('start'), B = fr('end');
  if (A.bar) {
    const c = V(...A.bar.center).lerp(V(...B.bar.center), s);
    f.bar = c; f.barAxis = V(...A.bar.axis).lerp(V(...B.bar.axis), s).normalize();
    const rel = c.clone().sub(sh);   // barra respecto al hombro en el marco del tronco (u = arriba, n = delante)
    f.barOff = { du: rel.y * Math.cos(f.phi) + rel.z * Math.sin(f.phi), dn: rel.z * Math.cos(f.phi) - rel.y * Math.sin(f.phi), dx: rel.x };
  }
  if (A.machine) {
    f.plate = { p: V(...A.plate.p).lerp(V(...B.plate.p), s), normal: V(...A.plate.normal), up: V(...A.plate.up) };
    f.plate0 = V(...A.plate.p); f.plateTravel = V(...B.plate.p).sub(V(...A.plate.p));
    f.handles = A.handles.map(h => V(...h));
  }
  return f;
}
// punto de agarre de la mano (centro del puño) en reposo, relativo a la muñeca
function socketRest(S) {
  const w = REST[`DEF-HAND.${S}`].p, b1 = REST[`DEF-FINGER-B-01.${S}`].p, b2 = REST[`DEF-FINGER-B-02.${S}`].p;
  return b1.clone().lerp(b2, 0.3).add(V(0, -0.026, 0)).sub(w);       // palma hacia abajo en reposo (-Y)
}

/* ---------------- Evaluación de un frame ---------------- */
function evaluate(ex, s) { CUR_OFF = authoredOffsets(ex, s); try { return evaluateInner(ex, s); } finally { CUR_OFF = null; } }
function evaluateInner(ex, s) {
  const exd = EXERCISES[ex], prm = state.per[ex];
  const auth = withBody(DEFAULT_BODY, () => authoredPose(ex, s));
  const bf = state.body, kk = K();
  const segLen = (a, b, f) => auth[a].p.distanceTo(auth[b].p) * f * kk;
  const LEN = S => ({ Lt: segLen(`DEF-THIGH01.${S}`, `DEF-SHIN01.${S}`, bf.femur / 100), Ls: segLen(`DEF-SHIN01.${S}`, `DEF-FOOT.${S}`, bf.tibia / 100),
    Lu: segLen(`DEF-ARM01.${S}`, `DEF-FORARM01.${S}`, 1), Lf: segLen(`DEF-FORARM01.${S}`, `DEF-HAND.${S}`, 1) });
  const F = features(auth, ex, s);
  const d = dims(), d0 = withBody(DEFAULT_BODY, dims);
  const pose = clonePose(auth);
  const out = { pose, act: null, warns: [], readout: [], path: null, F };
  if (exd.base === 'stand' || exd.base === 'hinge') {
    // hinge (peso muerto): la barra cuelga de las manos en vez de ir en el tronco; se resuelven muslo y tronco para que
    // la barra siga sobre el mediopié y, al empezar, en el suelo (los discos no cambian con el cuerpo)
    const hinge = exd.base === 'hinge', depth = prm.depth ?? 1, barH = prm.barH ?? 0;
    const yaw0 = (F.L.yaw - F.R.yaw) / 2, stance0 = (F.L.an.x - F.R.an.x) / 2;
    const beta = hinge ? F.beta : F.beta * lerp(1, depth, clamp(F.beta / (60 * DEG)));
    const thPref0 = F.th, thPref = F.th + prm.knees * DEG * (hinge ? 1 - s : clamp(F.beta / (60 * DEG)));
    const yaw = yaw0 + prm.toes * DEG, stance = stance0 * prm.stance * d.k / d0.k;
    const barOff0 = F.barOff || { du: 0, dn: 0 }, barOff = { du: barOff0.du * d.k / d0.k + barH / 100, dn: barOff0.dn * d.k / d0.k };
    const L = prm.load;
    const lim0 = Math.max(35 * DEG, F.th) + 10 * DEG, limC = Math.max(35 * DEG, F.th) + (d.dorsi - 35) * DEG + 10 * DEG;
    const ref = solveStand(d0, F.beta, thPref0, F.phi, stance0, yaw0, barOff0, 100, lim0);
    const cur = solveStand(d, beta, thPref, F.phi, stance, yaw, barOff, L, limC);
    // estilo autorado + corrección del solver
    const thLim = Math.max(35 * DEG, F.th) + (d.dorsi - 35) * DEG;      // límite de tobillo relativo a la pose autorada
    const phi0 = F.phi + (cur.phi - ref.phi), th = clamp(F.th + (hinge ? 0 : cur.th - ref.th) + (thPref - thPref0), -10 * DEG, thLim);
    // cadera: pose autorada + (geometría actual - geometría de referencia)  => exacta con los valores por defecto
    const G = (dd, b, t, st, yw) => { const dx = Math.max(0, st - dd.hipHalf), cv = Math.cos(Math.asin(Math.min(0.95, dx / (dd.Ls + dd.Lt)))), ch = Math.cos(yw * 0.85);
      const kz = dd.Ls * Math.sin(t) * ch, ky = dd.ankleH + dd.Ls * Math.cos(t) * cv; return V(0, ky + dd.Lt * Math.cos(b) * cv, kz - dd.Lt * Math.sin(b) * ch); };
    const hipOf = b => { const h = F.hip.clone().add(G(d, b, th, stance, yaw).sub(G(d0, F.beta, F.th, stance0, yaw0))); h.x = F.hip.x; return h; };
    const hipT = hipOf(beta);
    // ---- construcción de la pose para una inclinación de tronco (y una cadera) dadas
    const build = (phi, hipT) => {
    const pose = clonePose(auth), warns = [];
    const R = QA(X, phi - F.phi);                       // +phi = hacia delante (+Z)
    const hipA = F.hip;
    const legSet = new Set([...subtree('DEF-THIGH01.L'), ...subtree('DEF-THIGH01.R')]);
    for (const n of BN) if (!legSet.has(n)) { pose[n].q = R.clone().multiply(auth[n].q); }
    pose['DEF-HIPS'].p = hipT.clone().add(auth['DEF-HIPS'].p.clone().sub(hipA).applyQuaternion(R));
    fkSub(pose, 'DEF-HIPS');
    // piernas
    for (const [S, sgn] of [['L', 1], ['R', -1]]) {
      const Fs = F[S], dYaw = sgn * prm.toes * DEG;
      const an0 = expP(ex, `DEF-FOOT.${S}`, s);          // tobillo plantado (exacto de Blender, sin deriva entre claves)
      const ank = V(an0.x * prm.stance * d.k / d0.k, an0.y * d.k / d0.k, an0.z);
      const pole = Fs.legPole.clone().applyAxisAngle(Y, dYaw);
      solveLimb(pose, auth, [`DEF-THIGH01.${S}`, `DEF-THIGH02.${S}`, `DEF-SHIN01.${S}`, `DEF-SHIN02.${S}`, `DEF-FOOT.${S}`], ank, pole,
        [LEN(S).Lt, LEN(S).Ls]);
      fkSub(pose, `DEF-THIGH01.${S}`, c => { if (c === `DEF-THIGH02.${S}` || c === `DEF-SHIN01.${S}` || c === `DEF-SHIN02.${S}`) return; });
      pose[`DEF-FOOT.${S}`].q = QA(Y, dYaw).multiply(expQ(ex, `DEF-FOOT.${S}`, s));
      pose[`DEF-TOE.${S}`].q = QA(Y, dYaw).multiply(expQ(ex, `DEF-TOE.${S}`, s));
      fkSub(pose, `DEF-THIGH01.${S}`);
    }
    // barra y brazos: en la espalda gira con el tronco (Rh = R); colgada de las manos no gira (Rh = identidad)
    const shNow = midOf(pose, 'DEF-ARM01.L', 'DEF-ARM01.R'), Rh = hinge ? Q() : R;
    const u = V(0, Math.cos(phi), Math.sin(phi)), n = V(0, -Math.sin(phi), Math.cos(phi));
    const bar = hinge ? shNow.clone().add(F.bar.clone().sub(F.sh).multiplyScalar(d.k / d0.k))   // brazos colgando: mismo vector hombro→barra
      : shNow.clone().addScaledVector(u, barOff.du).addScaledVector(n, barOff.dn).add(V((barOff0.dx || 0) * d.k / d0.k, 0, 0));
    const axis = F.barAxis.clone().applyQuaternion(Rh);
    for (const [S, sgn] of [['L', 1], ['R', -1]]) {
      const hn = `DEF-HAND.${S}`, sock = socketRest(S);
      const gripA = auth[hn].p.clone().add(sock.clone().applyQuaternion(auth[hn].q.clone().multiply(REST[hn].q.clone().invert())));
      const offA = gripA.clone().sub(F.bar), along = offA.dot(F.barAxis); var perp = offA.clone().addScaledVector(F.barAxis, -along);
      const grip = bar.clone().addScaledVector(axis, along * prm.grip * d.k / d0.k).add(perp.applyQuaternion(Rh).multiplyScalar(d.k / d0.k));
      const qHandW = Rh.clone().multiply(auth[hn].q);
      const wrist = grip.clone().sub(sock.clone().multiplyScalar(d.k).applyQuaternion(qHandW.clone().multiply(REST[hn].q.clone().invert())));
      const elbowPole = poleOf(auth[`DEF-ARM01.${S}`].p, auth[`DEF-FORARM01.${S}`].p, auth[hn].p).applyQuaternion(Rh);
      const ik = solveLimb(pose, auth, [`DEF-ARM01.${S}`, `DEF-ARM02.${S}`, `DEF-FORARM01.${S}`, `DEF-FORARM0.${S}`, hn], wrist, elbowPole, [LEN(S).Lu, LEN(S).Lf]);
      // mantener rotaciones autoradas (giradas con la barra) para el resto de la cadena del brazo tras el IK
      for (const c of subtree(hn)) pose[c].q = Rh.clone().multiply(auth[c].q);
      fkSub(pose, `DEF-SHOULDER.${S}`);
      if (ik.miss > 0.01) warns.push(`La mano ${S === 'L' ? 'izquierda' : 'derecha'} no llega a la barra (${Math.round(ik.miss * 100)} cm)`);
    }
    return { pose, bar, axis, warns };
    };
    // ---- equilibrio en lazo cerrado sobre la pose real: el centro de masas del sistema (cuerpo + barra)
    // se mantiene sobre el mediopié igual que en la pose autorada; se corrige con la inclinación del tronco.
    let phiA, bA, betaH = beta;
    if (hinge) {
      // bisagra: muslo (b) y tronco (ph) por Newton 2×2 sobre la pose real.
      //  e1: barra sobre el mediopié (de los pies plantados) como en la autorada;
      //  e2: la barra en el mismo punto del recorrido: al empezar (s=0) en el suelo, que no cambia con el cuerpo; hacia el
      //      bloqueo (s=1) pesa más mantener el muslo autorado.  Con los valores por defecto, e = 0 en (F.beta, F.phi).
      const mfP = (['L', 'R'].map(S => { const a = expP(ex, `DEF-FOOT.${S}`, s), t = expP(ex, `DEF-TOE.${S}`, s); return a.z + 0.4 * (t.z - a.z); }).reduce((x, y) => x + y)) / 2;
      const offA = F.bar.z - mfP;
      const H0 = POSES.exercises[ex].start.bar.center[1], H1 = POSES.exercises[ex].end.bar.center[1];
      // ponytail: bloqueo del cuerpo actual ≈ el autorado escalado por la altura; fémur/tronco lo cambian ±2 cm y ahí manda el muslo (s→1)
      const hT = H0 + (F.bar.y - H0) / (H1 - H0) * (H1 * d.k / d0.k - H0);
      const E = (b, ph) => { const r = build(ph, hipOf(b)); return [r, r.bar.z - midfootZ(r.pose) - offA, (1 - s) * (r.bar.y - hT) + s * s * 0.3 * (b - F.beta)]; };
      let b = beta, ph = F.phi, [r, e1, e2] = E(b, ph);
      for (let i = 0; i < 6 && Math.abs(e1) + Math.abs(e2) > 0.0005; i++) {
        const h = 1e-3, [, a1, a2] = E(b + h, ph), [, c1, c2] = E(b, ph + h);
        const j11 = (a1 - e1) / h, j21 = (a2 - e2) / h, j12 = (c1 - e1) / h, j22 = (c2 - e2) / h, det = j11 * j22 - j12 * j21;
        if (Math.abs(det) < 1e-12) break;
        b = clamp(b - (j22 * e1 - j12 * e2) / det, -10 * DEG, 130 * DEG); ph = clamp(ph - (j11 * e2 - j21 * e1) / det, -20 * DEG, 89 * DEG);
        [r, e1, e2] = E(b, ph);
      }
      phiA = ph; bA = r; betaH = b;
    } else {
      const eRef = comOffset(auth, F.bar, 100);
      phiA = phi0; bA = build(phiA, hipT); let eA = comOffset(bA.pose, bA.bar, L) - eRef;
      if (Math.abs(eA) > 0.0005) {
        let phiB = phiA + (eA > 0 ? -3 : 3) * DEG, bB = build(phiB, hipT), eB = comOffset(bB.pose, bB.bar, L) - eRef;
        for (let i = 0; i < 8 && Math.abs(eB) > 0.0005; i++) {
          const den = eB - eA; if (Math.abs(den) < 1e-9) break;
          const phiN = clamp(phiB - eB * (phiB - phiA) / den, -15 * DEG, 85 * DEG);
          phiA = phiB; eA = eB; phiB = phiN; bB = build(phiB, hipT); eB = comOffset(bB.pose, bB.bar, L) - eRef;
        }
        phiA = phiB; bA = bB;
      }
    }
    const phi = phiA, { bar, axis } = bA; Object.assign(pose, bA.pose); out.warns.push(...bA.warns);
    out.bar = { center: bar, axis };
    const mf = midfootZ(pose), com = comOffset(pose, bar, L) + mf;
    out.act = cur.act; out.path = bar.clone(); out.mid = mf; out.com = com;
    out.readout = [['Tronco', `${Math.round(phi / DEG)}°`], ['Muslo', `${Math.round(betaH / DEG)}°`], ['Tibia', `${Math.round(th / DEG)}°`],
      hinge ? ['Barra', `${Math.round(bar.y * 100)} cm del suelo`] : ['CdM–mediopié', `${((com - mf) * 100).toFixed(1)} cm`],
      ['Barra–mediopié', `${((bar.z - mf) * 100).toFixed(1)} cm`]];
    out.phase = `muslo ${Math.round(betaH / DEG)}°`;
  } else {
    // PRENSA: la pelvis queda fija en el asiento (la de la clave de inicio); la plataforma recorre el raíl
    // con orientación constante y los pies van pegados a ella.
    const hip0 = midOf({ a: { p: expP(ex, 'DEF-THIGH01.L', 0) }, b: { p: expP(ex, 'DEF-THIGH01.R', 0) } }, 'a', 'b');
    const shift = hip0.clone().sub(midOf(auth, 'DEF-THIGH01.L', 'DEF-THIGH01.R'));
    pose['DEF-HIPS'].p.add(shift); fkSub(pose, 'DEF-HIPS');
    const hipSeat = hip0;
    const legR = (LEN('L').Lt + LEN('L').Ls) / (auth['DEF-THIGH01.L'].p.distanceTo(auth['DEF-SHIN01.L'].p) + auth['DEF-SHIN01.L'].p.distanceTo(auth['DEF-FOOT.L'].p));
    const A0 = POSES.exercises[ex].start, nrm = V(...A0.plate.normal), up = V(...A0.plate.up), P0 = V(...A0.plate.p);
    const T = F.plateTravel, Tn = T.clone().normalize();
    // posición del raíl: inicio desplazado por startOff (cm), final escalado por depth
    let u = (1 - s) * (-prm.startOff / 100 / T.length()) + s * prm.depth;
    const plateAt = uu => hipSeat.clone().add(P0.clone().sub(hipSeat).multiplyScalar(legR)).addScaledVector(T, uu * legR);
    const rel = S => expP(ex, `DEF-FOOT.${S}`, 0).sub(P0);   // pie respecto a la plataforma (clave de inicio)
    const ankAt = (S, uu) => { const r = rel(S); const a = plateAt(uu).add(r).addScaledVector(up, prm.footHigh / 100 * kk); a.x = expP(ex, `DEF-FOOT.${S}`, 0).x * prm.stance * kk; return a; };
    // no extender más allá de lo que da la pierna: si no llega, la plataforma se queda donde la pierna llega
    for (let it = 0; it < 30; it++) {
      const over = Math.max(...['L', 'R'].map(S => pose[`DEF-THIGH01.${S}`].p.distanceTo(ankAt(S, u)) - 0.995 * (LEN(S).Lt + LEN(S).Ls)));
      if (over <= 0) break; u += over / (T.length() * legR) * 1.05;
    }
    const plate = plateAt(u);
    for (const [S, sgn] of [['L', 1], ['R', -1]]) {
      const Fs = F[S], dYaw = sgn * prm.toes * DEG;
      const ank = ankAt(S, u);
      const pole = Fs.legPole.clone().applyAxisAngle(nrm, -dYaw);
      solveLimb(pose, auth, [`DEF-THIGH01.${S}`, `DEF-THIGH02.${S}`, `DEF-SHIN01.${S}`, `DEF-SHIN02.${S}`, `DEF-FOOT.${S}`], ank, pole, [LEN(S).Lt, LEN(S).Ls]);
      const qy = QA(nrm, -dYaw);
      pose[`DEF-FOOT.${S}`].q = qy.clone().multiply(expQ(ex, `DEF-FOOT.${S}`, 0)); pose[`DEF-TOE.${S}`].q = qy.clone().multiply(expQ(ex, `DEF-TOE.${S}`, 0));
      fkSub(pose, `DEF-THIGH01.${S}`);
    }
    // manos en las asas (fijas a la máquina)
    for (const S of ['L', 'R']) {
      const hn = `DEF-HAND.${S}`, wrist = expP(ex, hn, 0);
      const elbowPole = poleOf(pose[`DEF-ARM01.${S}`].p, auth[`DEF-FORARM01.${S}`].p.clone().add(shift), wrist);
      solveLimb(pose, auth, [`DEF-ARM01.${S}`, `DEF-ARM02.${S}`, `DEF-FORARM01.${S}`, `DEF-FORARM0.${S}`, hn], wrist, elbowPole, [LEN(S).Lu, LEN(S).Lf]);
      for (const c of subtree(hn)) pose[c].q = auth[c].q.clone();
      fkSub(pose, `DEF-SHOULDER.${S}`);
    }
    out.plate = plate; out.plateFrame = { normal: nrm, up };
    // demanda: línea de fuerza por el mediopié, paralela al raíl
    const rail = F.plateTravel.clone().normalize().negate();
    const mid = midOf(pose, 'DEF-FOOT.L', 'DEF-FOOT.R'), kneeL = pose['DEF-SHIN01.L'].p, hipM = midOf(pose, 'DEF-THIGH01.L', 'DEF-THIGH01.R');
    const arm = p => Math.abs(p.clone().sub(mid).cross(rail).x);
    const Ld = prm.load / 100, kn = kneeL.clone().sub(pose['DEF-THIGH01.L'].p).angleTo(pose['DEF-FOOT.L'].p.clone().sub(kneeL));
    const deep = clamp(kn / (110 * DEG));
    out.act = { quads: clamp(Ld * arm(kneeL) / (0.22 * d.k) * 0.4), glutes: clamp(Ld * arm(hipM) / (0.16 * d.k) * (0.35 + 0.65 * deep) * 0.6),
      hams: clamp(Ld * arm(hipM) / (0.16 * d.k) * 0.3), add: clamp(Ld * arm(hipM) / (0.16 * d.k) * 0.25 * prm.stance), erect: 0.08, calves: clamp(0.1 + Ld * 0.03) };
    out.path = plate.clone(); out.mid = null;
    out.readout = [['Rodilla', `${Math.round(kn / DEG)}°`], ['Recorrido total', `${Math.round(T.length() * (prm.depth + prm.startOff / 100 / T.length()) * legR * 100)} cm`]];
    out.phase = `rodilla ${Math.round(kn / DEG)}°`;
  }
  return out;
}

/* ================= Three.js ================= */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50); scene.add(camera);
scene.add(new THREE.AmbientLight(0xffffff, 0.58));
const sun = new THREE.DirectionalLight(0xffffff, 0.5); sun.position.set(2.2, 3.2, 1.5); camera.add(sun);
const grad = new THREE.DataTexture(new Uint8Array([196, 196, 196, 255, 255, 255, 255, 255]), 2, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
const toon = c => new THREE.MeshToonMaterial({ color: c, gradientMap: grad });
const OUTLINE = { value: 0.006 };
const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1e26, side: THREE.BackSide });
outlineMat.onBeforeCompile = sh => { sh.uniforms.uThickness = OUTLINE; sh.vertexShader = 'uniform float uThickness;\n' + sh.vertexShader.replace('#include <project_vertex>', 'transformed += normalize(objectNormal) * uThickness;\n#include <project_vertex>'); };
outlineMat.customProgramCacheKey = () => 'ol-skin';
const outlineStatic = new THREE.MeshBasicMaterial({ color: 0x1a1e26, side: THREE.BackSide });
outlineStatic.onBeforeCompile = sh => { sh.uniforms.uThickness = { value: 0.006 }; sh.vertexShader = 'uniform float uThickness;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + normal * uThickness;'); };
outlineStatic.customProgramCacheKey = () => 'ol-static';
const withOutline = (geom, mat) => { const g = new THREE.Group(); g.add(new THREE.Mesh(geom, mat)); g.add(new THREE.Mesh(geom, outlineStatic)); return g; };

/* ---- mapa muscular: zonas definidas a partir del esqueleto en reposo (vale para cualquier avatar) ---- */
const MU = { uAct: { value: [0, 0, 0, 0, 0, 0] }, uHeat: { value: 1 }, uLo: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHi: { value: new THREE.Color() },
  uHip: { value: V() }, uKnee: { value: V() }, uAnk: { value: V() }, uPelvis: { value: V() }, uChest: { value: V() }, uS: { value: 1 } };
const GLSL = `
varying vec3 vRP; varying vec3 vRN;
uniform float uAct[6]; uniform float uHeat; uniform vec3 uLo, uMid, uHi, uHip, uKnee, uAnk, uPelvis, uChest; uniform float uS;
float segD(vec3 p, vec3 a, vec3 b){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.); return length(pa-ba*h); }
float segT(vec3 p, vec3 a, vec3 b){ vec3 ba=b-a; return clamp(dot(p-a,ba)/dot(ba,ba),0.,1.); }
float st(float x, float e){ return smoothstep(e-0.012, e+0.012, x); }
vec3 heatC(vec3 t, float a){ return a<0.5 ? mix(t,uMid,a*2.) : mix(uMid,uHi,a*2.-1.); }
vec3 muscleColor(vec3 base){
  if (uHeat < 0.5) return base;
  vec3 p = vec3(abs(vRP.x), vRP.y, vRP.z); vec3 n = normalize(vRN); n.x *= sign(vRP.x + 1e-5);
  vec3 tint = mix(base, uLo, 0.5);
  float thigh = 1. - st(segD(p, uHip, uKnee), 0.11*uS); float tt = segT(p, uHip, uKnee);
  float medial = st(-n.x, .45);
  float quads = thigh * st(n.z, .08) * (1.-medial) * st(tt, .08) * (1.-st(tt, .9));
  float add   = thigh * medial * (1.-st(tt, .55));
  float hams  = thigh * st(-n.z, .10) * (1.-medial) * st(tt, .3) * (1.-st(tt, .92));
  vec3 gq = (p - (uHip + vec3(-0.015, 0.0, -0.06)*uS)) / (vec3(.11,.12,.11)*uS);
  float glut  = (1.-st(length(gq), 1.)) * st(-n.z, .05) * (1.-st(tt, .3)) * st(p.y, uHip.y - 0.16*uS);
  float calf  = (1.-st(segD(p, uKnee, uAnk), 0.075*uS)) * st(-n.z, .05) * st(segT(p, uKnee, uAnk), .1) * (1.-st(segT(p, uKnee, uAnk), .75));
  float erect = st(p.x, .012*uS) * (1.-st(p.x, .07*uS)) * st(p.y, uPelvis.y+0.03*uS) * (1.-st(p.y, uChest.y)) * st(-n.z, .55);
  vec3 c = base;
  c = mix(c, heatC(tint, uAct[0]), quads); c = mix(c, heatC(tint, uAct[1]), glut); c = mix(c, heatC(tint, uAct[2]), hams);
  c = mix(c, heatC(tint, uAct[3]), add);   c = mix(c, heatC(tint, uAct[4]), erect); c = mix(c, heatC(tint, uAct[5]), calf);
  return c;
}`;
function bodyMat(color, heat) {
  const m = toon(color);
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, MU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRP; varying vec3 vRN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRP = position; vRN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GLSL)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', heat ? 'vec4 diffuseColor = vec4( muscleColor(diffuse), opacity );' : 'vec4 diffuseColor = vec4( diffuse, opacity );');
  };
  m.customProgramCacheKey = () => heat ? 'mq-heat' : 'mq-plain';
  return m;
}
const MATS = { body: bodyMat(0xdcd6cc, true), joint: bodyMat(0x4a5468, false) };

/* ---- escenario y props ---- */
const floor = new THREE.Group(); scene.add(floor);
const wood = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 2.0), toon(0xc89b66)); wood.position.y = -0.02;
const rub = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 2.0), toon(0x3a3e46)); rub.position.set(-0.9, -0.02, 0);
const rub2 = rub.clone(); rub2.position.x = 0.9; floor.add(wood, rub, rub2);
const barG = new THREE.Group(); scene.add(barG);
const barMesh = withOutline(new THREE.CylinderGeometry(0.014, 0.014, 2.2, 14), toon(0x9aa2ae)); barMesh.rotation.z = Math.PI / 2; barG.add(barMesh);
const plates = [-1, 1].map(s => { const g = new THREE.Group(); const m = withOutline(new THREE.CylinderGeometry(0.225, 0.225, 1, 36), toon(0x2b2f37)); m.rotation.z = Math.PI / 2; g.add(m); barG.add(g); g.userData.s = s; return g; });
const press = new THREE.Group(); scene.add(press);
const padMat = toon(0x2453cf);
const plateMesh = withOutline(new THREE.BoxGeometry(0.62, 0.5, 0.04), toon(0x2b2f37)); press.add(plateMesh);
const seatMesh = withOutline(new THREE.BoxGeometry(0.42, 0.08, 0.42), padMat), backMesh = withOutline(new THREE.BoxGeometry(0.42, 0.75, 0.08), padMat);
const handleMeshes = [0, 1].map(() => { const h = withOutline(new THREE.CylinderGeometry(0.016, 0.016, 0.16, 12), toon(0x9aa2ae)); h.rotation.x = Math.PI / 2; return h; });
press.add(seatMesh, backMesh, ...handleMeshes);
const lineMat = new THREE.LineDashedMaterial({ color: 0x2453cf, dashSize: 0.04, gapSize: 0.03 });
const midLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0.002, 0), V(0, 2.1, 0)]), lineMat); midLine.computeLineDistances(); scene.add(midLine);
const pathMat = new THREE.LineBasicMaterial({ color: 0x2453cf }); const pathLine = new THREE.Line(new THREE.BufferGeometry(), pathMat); scene.add(pathLine);
// referencia: esqueleto autorado (para comparar)
const refMat = new THREE.LineBasicMaterial({ color: 0xe8452a, depthTest: false, transparent: true, opacity: 0.9 });
const refLines = new THREE.LineSegments(new THREE.BufferGeometry(), refMat); refLines.renderOrder = 5; scene.add(refLines);

function placeProps(ex, r) {
  const F = r.F; barG.visible = !!r.bar; press.visible = !r.bar;
  if (r.bar) {
    barG.position.copy(r.bar.center); barG.quaternion.setFromUnitVectors(X, r.bar.axis);
    const th = 0.02 + 0.13 * PRM().load / 200;
    plates.forEach(p => { p.visible = PRM().load > 0; p.children[0].scale.set(1, th, 1); p.position.x = p.userData.s * (0.70 + th / 2); });
    // vista lateral: el disco tapa al maniquí -> se vuelve translúcido cuando la cámara mira a lo largo de la barra
    const al = Math.abs(camera.position.clone().sub(r.bar.center).normalize().dot(r.bar.axis));
    const fade = clamp((al - 0.8) / 0.15);
    plates.forEach(p => { const [body, ol] = p.children[0].children; if (body.material.transparent !== fade > 0) { body.material.transparent = fade > 0; body.material.needsUpdate = true; } body.material.opacity = 1 - 0.75 * fade; body.material.depthWrite = fade < 0.5; ol.visible = fade < 0.5; });
  } else {
    const n = r.plateFrame.normal, up = r.plateFrame.up;
    plateMesh.position.copy(r.plate).addScaledVector(n, -0.02);
    plateMesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(up.clone().cross(n).normalize(), up, n));
    // banco fijo: se coloca con la pose de inicio exportada, no con la cadera animada
    const P0 = n0 => V(...POSES.exercises[ex].start.bones[n0].p);
    const hip = P0('DEF-THIGH01.L').add(P0('DEF-THIGH01.R')).multiplyScalar(0.5);
    seatMesh.position.copy(hip).add(V(0, -0.13, -0.03));
    const u = P0('DEF-ARM01.L').add(P0('DEF-ARM01.R')).multiplyScalar(0.5).sub(hip).normalize();
    backMesh.position.copy(hip).addScaledVector(u, 0.4).addScaledVector(V(0, -u.z, u.y).negate(), 0.14);
    backMesh.quaternion.setFromUnitVectors(Y, u);
    F.handles.forEach((h, i) => handleMeshes[i].position.copy(h));
  }
}

/* ---- carga del maniquí ---- */
function initRig(gltf) {
  const root = gltf.scene; scene.add(root); root.updateMatrixWorld(true);
  const bones = {}, skinned = [];
  // GLTFLoader quita los puntos de los nombres (DEF-HAND.L -> DEF-HANDL): mapear por el nombre saneado
  const byClean = {}; for (const n of BN) byClean[THREE.PropertyBinding.sanitizeNodeName(n)] = n;
  root.traverse(o => { if (o.isBone && byClean[o.name]) bones[byClean[o.name]] = o; if (o.isSkinnedMesh) skinned.push(o); });
  const missing = BN.filter(n => !bones[n]); if (missing.length) console.warn('huesos sin enlazar', missing);
  for (const b of Object.values(bones)) { b.matrixAutoUpdate = false; b.updateMatrixWorld = () => {}; b.updateWorldMatrix = () => {}; }
  for (const m of skinned) {
    m.frustumCulled = false;
    const nm = (m.material && m.material.name) || '';
    m.material = /02/.test(nm) ? MATS.joint : MATS.body;
    OUTLINE.base = OUTLINE.value = 0.006 / new THREE.Vector3().setFromMatrixScale(m.matrixWorld).x;
    const o = new THREE.SkinnedMesh(m.geometry, outlineMat); o.bind(m.skeleton, m.bindMatrix); o.frustumCulled = false; m.parent.add(o);
  }
  Object.assign(RIG, { bones, ready: true });
  const R = n => REST[n].p;
  MU.uHip.value.copy(R('DEF-THIGH01.L')); MU.uKnee.value.copy(R('DEF-SHIN01.L')); MU.uAnk.value.copy(R('DEF-FOOT.L'));
  MU.uPelvis.value.copy(R('DEF-HIPS')); MU.uChest.value.copy(R('DEF-CHEST'));
}
let POSE_OVERRIDE = null;
function applyPose(pose) {
  const k = K(), sc = new THREE.Vector3();
  for (const n of BN) { const b = RIG.bones[n]; if (!b) continue; sc.set(k, k * STRETCH(n), k); b.matrixWorld.compose(pose[n].p, pose[n].q, sc); }
}

/* ---- tema ---- */
function readTheme() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  renderer.setClearColor(new THREE.Color(v('--stage'))); outlineMat.color.set(v('--outline')); outlineStatic.color.set(v('--outline'));
  lineMat.color.set(v('--path')); pathMat.color.set(v('--path'));
  MU.uLo.value.set(v('--heat-lo')); MU.uMid.value.set(v('--heat-mid')); MU.uHi.value.set(v('--heat-hi')); padMat.color.set(v('--accent'));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ---- cámara ---- */
const target = V(0, 0.82, 0.02), orbit = { th: 90 * DEG, ph: 80 * DEG, r: 3.7 }, goal = { ...orbit };
const VIEWS = { front: { th: 0, ph: 82 * DEG }, side: { th: 90 * DEG, ph: 82 * DEG }, three: { th: 40 * DEG, ph: 72 * DEG }, press: { th: 125 * DEG, ph: 70 * DEG } };
const pointers = new Map(); let pinch0 = 0, r0 = 0;
canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); r0 = goal.r; } });
canvas.addEventListener('pointermove', e => { if (!pointers.has(e.pointerId)) return; const pv = pointers.get(e.pointerId); const dx = e.clientX - pv.x, dy = e.clientY - pv.y; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) { goal.th -= dx * 0.009; goal.ph = clamp(goal.ph - dy * 0.007, 15 * DEG, 100 * DEG); orbit.th = goal.th; orbit.ph = goal.ph; setView(null); }
  else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const dd = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) goal.r = clamp(r0 * pinch0 / dd, 0.8, 7); } });
const endPtr = e => { pointers.delete(e.pointerId); pinch0 = 0; }; canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { e.preventDefault(); goal.r = clamp(goal.r * (1 + e.deltaY * 0.0012), 0.8, 7); }, { passive: false });
const viewBtns = document.querySelectorAll('[data-view]');
function setView(name) { viewBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === name))); if (!name) return; const v = VIEWS[name];
  const cur = ((orbit.th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); let dth = v.th - cur; if (dth > Math.PI) dth -= 2 * Math.PI; if (dth < -Math.PI) dth += 2 * Math.PI; goal.th = orbit.th + dth; goal.ph = v.ph; }
viewBtns.forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));

/* ---- interfaz ---- */
function slider(host, { id, label, min, max, step, get, set, fmt }) {
  const w = document.createElement('div'); w.className = 'field';
  w.innerHTML = `<div class="top"><label for="${id}">${label}</label><output id="${id}-o"></output></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}">`;
  host.appendChild(w); const inp = w.querySelector('input'), out = w.querySelector('output');
  const sync = () => { inp.value = get(); out.textContent = fmt(get()); };
  inp.addEventListener('input', () => { set(+inp.value); out.textContent = fmt(+inp.value); changed(); }); sync(); return sync;
}
const exHost = document.getElementById('exFields'), bodyHost = document.getElementById('bodyFields');
function buildExerciseUI() {
  const ex = EX(); document.querySelector('h1').textContent = ex.name; exHost.innerHTML = '';
  for (const p of PARAMS[ex.base]) slider(exHost, { ...p, id: `p-${p.id}`, get: () => PRM()[p.id], set: v => { PRM()[p.id] = v; } });
  const rb = document.createElement('button'); rb.className = 'copy'; rb.textContent = 'Volver a la pose autorada';
  rb.addEventListener('click', () => { for (const p of PARAMS[ex.base]) PRM()[p.id] = p.def; buildExerciseUI(); }); exHost.appendChild(rb);
  setView(ex.base === 'seat' ? 'press' : 'side'); changed();
}
const exSeg = document.getElementById('exSeg');
for (const [id, ex] of Object.entries(EXERCISES)) {
  const b = document.createElement('button'); b.textContent = ex.short; b.dataset.ex = id;
  b.addEventListener('click', () => { state.exId = id; exSeg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); buildExerciseUI(); });
  exSeg.appendChild(b);
}
exSeg.querySelector('button').setAttribute('aria-pressed', 'true');
const bodySync = [];
const bodyField = (id, label, min, max, fmt, custom = true) => bodySync.push(slider(bodyHost, { id, label, min, max, step: 1, get: () => state.body[id], set: v => { state.body[id] = v; if (custom) pressSeg(null); }, fmt }));
bodyField('height', 'Altura', 150, 205, v => `${v} cm`, false);
bodyField('femur', 'Fémur', 85, 120, v => `${v}% del maniquí`); bodyField('tibia', 'Tibia', 85, 120, v => `${v}% del maniquí`);
bodyField('torso', 'Tronco', 85, 120, v => `${v}% del maniquí`); bodyField('dorsi', 'Dorsiflexión de tobillo', 15, 45, v => `${v}°`);
function pressSeg(val) { document.querySelectorAll('#presetSeg button').forEach(b => b.setAttribute('aria-pressed', String(val !== null && b.dataset.preset === val))); }
document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => { Object.assign(state.body, PRESETS[b.dataset.preset]); pressSeg(b.dataset.preset); bodySync.forEach(f => f()); changed(); }));
const playBtn = document.getElementById('playBtn');
const ICON_PAUSE = '<svg viewBox="0 0 16 16"><rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11a.6.6 0 0 0 .9.5l9-5.5a.6.6 0 0 0 0-1l-9-5.5a.6.6 0 0 0-.9.5z"/></svg>';
let clock = 0;
function setPlaying(on) { state.playing = on; playBtn.innerHTML = on ? ICON_PAUSE : ICON_PLAY; playBtn.setAttribute('aria-label', on ? 'Pausar' : 'Reproducir'); if (on) clock = state.s * 1.7; }
playBtn.addEventListener('click', () => setPlaying(!state.playing));
const scrub = document.getElementById('scrub'); scrub.addEventListener('input', () => { setPlaying(false); state.s = scrub.value / 1000; });
const toggle = (id, key) => document.getElementById(id).addEventListener('click', e => { state[key] = !state[key]; e.currentTarget.setAttribute('aria-pressed', String(state[key])); });
toggle('linesBtn', 'lines'); toggle('heatBtn', 'heat'); toggle('refBtn', 'ref');
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function repS(t) { const T = 3.7; t %= T; if (t < 1.7) return ease(t / 1.7); if (t < 1.9) return 1; if (t < 3.2) return 1 - ease((t - 1.9) / 1.3); return 0; }

const MUSCLES = [['quads', 'Cuádriceps'], ['glutes', 'Glúteo mayor'], ['hams', 'Isquiotibiales'], ['add', 'Aductores'], ['erect', 'Erectores'], ['calves', 'Gemelos y sóleo']];
const mHost = document.getElementById('muscles');
const mRows = MUSCLES.map(([key, name]) => { const n = document.createElement('div'); n.className = 'n'; n.textContent = name; const b = document.createElement('div'); b.className = 'bar'; const i = document.createElement('i'); b.appendChild(i); const v = document.createElement('div'); v.className = 'v'; mHost.append(n, b, v); return { key, i, v }; });
const spark = document.getElementById('spark');
function computeCurve() {
  const curve = []; for (let j = 0; j <= 30; j++) { const s = j / 30, r = evaluateAt(s); curve.push({ s, q: r.act.quads, g: r.act.glutes, path: r.path.clone() }); }
  const pts = k => curve.map(c => `${(c.s * 300).toFixed(1)},${(72 - c[k] * 66).toFixed(1)}`).join(' ');
  spark.innerHTML = `<line x1="0" y1="72" x2="300" y2="72" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/><line x1="0" y1="39" x2="300" y2="39" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/><polyline points="${pts('q')}" fill="none" stroke="var(--heat-hi)" stroke-width="2" vector-effect="non-scaling-stroke"/><polyline points="${pts('g')}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/><line id="cursor" x1="0" y1="0" x2="0" y2="76" stroke="var(--ink)" stroke-width="1" vector-effect="non-scaling-stroke" opacity=".5"/>`;
  pathLine.geometry.dispose(); pathLine.geometry = new THREE.BufferGeometry().setFromPoints(curve.map(c => c.path));
}
function evaluateAt(s) { const saved = state.s; state.s = s; try { return evaluate(state.exId, s); } finally { state.s = saved; } }
const jsonEl = document.getElementById('json');
function renderJSON() { const r2 = v => Math.round(v * 100) / 100; jsonEl.textContent = JSON.stringify({ ejercicio: state.exId, pose: 'autorada (Blender)', ajustes: Object.fromEntries(Object.entries(PRM()).map(([k, v]) => [k, r2(v)])) }, null, 2); }
document.getElementById('copyBtn').addEventListener('click', async e => { const btn = e.currentTarget; try { await navigator.clipboard.writeText(jsonEl.textContent); btn.textContent = 'Copiado'; } catch { const r = document.createRange(); r.selectNodeContents(jsonEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); btn.textContent = 'Seleccionado'; } setTimeout(() => btn.textContent = 'Copiar JSON', 1500); });
let curveDirty = true;
const defNote = document.getElementById('defNote');
function changed() { curveDirty = true; renderJSON(); defNote.textContent = isDefault() ? 'pose autorada exacta' : 'corregida por el solver'; }

/* ---- bucle ---- */
const readout = document.getElementById('readout'), phaseLbl = document.getElementById('phaseLbl'), demandAt = document.getElementById('demandAt');
function resize() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(canvas);
const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let last = performance.now();
function frameLoop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (curveDirty) { curveDirty = false; computeCurve(); }
  if (state.playing) { clock += dt; state.s = repS(clock); }
  scrub.value = Math.round(state.s * 1000);
  const r = evaluate(state.exId, state.s); window.__last = r;
  applyPose(POSE_OVERRIDE ? POSE_OVERRIDE() : r.pose); placeProps(state.exId, r);
  const a = r.act; MU.uAct.value = [a.quads, a.glutes, a.hams, a.add, a.erect, a.calves]; MU.uHeat.value = state.heat ? 1 : 0; MU.uS.value = 1;
  midLine.visible = state.lines && r.mid !== null; if (r.mid !== null) midLine.position.z = r.mid; pathLine.visible = state.lines;
  // referencia autorada
  refLines.visible = state.ref;
  if (state.ref) { const A = withBody(DEFAULT_BODY, () => authoredPose(state.exId, state.s)); const pts = []; for (const n of BN) { const P = PARENT[n]; if (P && !/FINGER|THUMB|PALM/.test(n)) pts.push(A[P].p, A[n].p); } refLines.geometry.dispose(); refLines.geometry = new THREE.BufferGeometry().setFromPoints(pts); }
  const k = K(); target.lerp(EX().base === 'seat' ? V(0, 0.75 * k, 0.3) : V(0, 0.8 * k, 0.03), 0.2);
  orbit.th += (goal.th - orbit.th) * 0.12; orbit.ph += (goal.ph - orbit.ph) * 0.12; orbit.r += (goal.r - orbit.r) * 0.15;
  camera.position.set(target.x + orbit.r * Math.sin(orbit.ph) * Math.sin(orbit.th), target.y + orbit.r * Math.cos(orbit.ph), target.z + orbit.r * Math.sin(orbit.ph) * Math.cos(orbit.th));
  camera.lookAt(target); if (OUTLINE.base) OUTLINE.value = OUTLINE.base * clamp(orbit.r / 3.2, 0.3, 1.2);
  renderer.render(scene, camera);
  readout.innerHTML = r.readout.map(([l, v]) => `<span class="chip"><b>${l}</b>${v}</span>`).join('') + r.warns.map(w => `<span class="chip warn">${esc(w)}</span>`).join('');
  phaseLbl.textContent = `${Math.round(state.s * 100)}% · ${r.phase}`; demandAt.textContent = `en el ${Math.round(state.s * 100)}%`;
  mRows.forEach(m => { const v = a[m.key]; m.i.style.width = `${(v * 100).toFixed(1)}%`; m.v.textContent = `${Math.round(v * 100)}`; });
  const cur = document.getElementById('cursor'); if (cur) { cur.setAttribute('x1', state.s * 300); cur.setAttribute('x2', state.s * 300); }
  requestAnimationFrame(frameLoop);
}
readTheme(); setPlaying(state.playing); resize();
const loading = document.getElementById('loading');
const bin = Uint8Array.from(atob(document.getElementById('model-b64').textContent.trim()), c => c.charCodeAt(0));
new THREE.GLTFLoader().parse(bin.buffer, '', gltf => { initRig(gltf); loading.hidden = true; buildExerciseUI(); window.__ready = true; requestAnimationFrame(frameLoop); },
  err => { loading.textContent = 'No se ha podido cargar el modelo 3D. Recarga la página para reintentarlo.'; console.error(err); });
window.__dbg = { camera, plates, state, RIG, THREE, setOverride: f => { POSE_OVERRIDE = f; }, evaluate, authoredPose, POSES, REST, BN, withBody, DEFAULT_BODY, features, PRM, EXERCISES };
})();
