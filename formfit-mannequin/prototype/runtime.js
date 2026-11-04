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
// claves de cada acción: inicio, intermedias de Blender (si las hay) y final, con su posición s en la repetición (0..1)
const KEYS = {};
const keysOf = ex => KEYS[ex] ??= [{ s: 0, ...POSES.exercises[ex].start }, ...(POSES.exercises[ex].mid || []), { s: 1, ...POSES.exercises[ex].end }];
// tramo entre claves consecutivas que contiene s: [clave a, clave b, t dentro del tramo, índice de a]
function seg(ex, s) { const K = keysOf(ex); let i = 0; while (i < K.length - 2 && s > K[i + 1].s) i++;
  return [K[i], K[i + 1], Math.min(1, Math.max(0, (s - K[i].s) / (K[i + 1].s - K[i].s))), i]; }

/* ---------------- Ejercicios: qué sliders tiene cada uno ---------------- */
const EXERCISES = {
  back_squat: { name: 'Sentadilla trasera', short: 'Trasera', base: 'stand', bar: true, elbowPref: null },
  front_squat: { name: 'Sentadilla frontal', short: 'Frontal', base: 'stand', bar: true },
  leg_press: { name: 'Prensa 45°', short: 'Prensa', base: 'seat', bar: false },
  deadlift: { name: 'Peso muerto', short: 'Muerto', base: 'hinge', bar: true },
  romanian_deadlift: { name: 'Peso muerto rumano', short: 'Rumano', base: 'hinge', bar: true },
  pullup: { name: 'Dominada', short: 'Dominada', base: 'hang', bar: true },
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
  // bisagra (peso muerto convencional, rumano…): la barra cuelga de las manos y va sobre el mediopié; con estos ajustes
  // un ejercicio se acerca a su vecino (rumano con más rodilla y hasta el suelo ≈ convencional)
  hinge: [
    // implemento: lo que empieza en el suelo (convencional) solo con lo que se apoya bien en él (barra, kettlebells)
    { id: 'impl', label: 'Implemento', def: 'barra', options: [['barra', 'Barra'], ['mancuernas', 'Mancuernas'], ['mancuernas_lado', 'A los lados'], ['kettlebell', '1 kettlebell'], ['kettlebells', '2 kettlebells']],
      allow: ex => hingeKeys(ex).floor ? ['barra', 'kettlebell', 'kettlebells'] : null },
    { id: 'knees', label: 'Flexión de rodilla', min: -60, max: 20, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada' : v < 0 ? `como mucho ${-v}° menos que la autorada abajo` : `+${v}° abajo` },
    { id: 'depth', label: 'Profundidad', min: -40, max: 30, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada' : `barra ${Math.abs(v)} cm más ${v > 0 ? 'alta' : 'baja'} (no pasa del suelo)` },
    { id: 'plates', label: 'Altura de los discos', min: 0, max: 30, step: 1, def: 0, fmt: v => v === 0 ? 'en el suelo' : `sobre bloques de ${v} cm` },
    { id: 'feet', label: 'Altura de los pies', min: 0, max: 20, step: 1, def: 0, fmt: v => v === 0 ? 'en el suelo' : `sobre ${v} cm (déficit)` },
    { id: 'stance', label: 'Anchura de pies', min: 0.75, max: 1.4, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}%` },
    { id: 'toes', label: 'Rotación de pies', min: -15, max: 20, step: 1, def: 0, fmt: v => `${v > 0 ? '+' : ''}${v}° sobre la autorada` },
    { id: 'grip', label: 'Anchura de agarre', min: 0.9, max: 1.3, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}%` },
    { id: 'load', label: 'Carga', min: 0, max: 300, step: 10, def: 150, fmt: v => `${v}% del peso corporal` },
  ],
  // colgado (dominada): el cuerpo cuelga de las manos; sin carga (el peso es el del cuerpo)
  hang: [
    { id: 'gripType', label: 'Agarre', def: 'prono', options: [['prono', 'Prono'], ['supino', 'Supino'], ['neutro', 'Neutro']] },
    { id: 'grip', label: 'Anchura de agarre', min: 0.75, max: 1.4, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}% (el neutro va a la anchura de las asas)` },
    { id: 'top', label: 'Hasta dónde sube', min: 50, max: 100, step: 1, def: 100, fmt: v => v === 100 ? 'la autorada (barbilla sobre la barra)' : `${v}% del recorrido` },
    { id: 'bottom', label: 'Desde dónde baja', min: 0, max: 40, step: 1, def: 0, fmt: v => v === 0 ? 'colgado del todo' : `${v}% del recorrido (codos algo flexionados)` },
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
// variantes (acción con `ff_variant_of`, p. ej. Chinup = dominada supina): no son un ejercicio aparte; comparten los ajustes del
// suyo y se usan desde su chip de agarre (variantFor)
const VARIANT = id => POSES.exercises[id]?.meta?.of;
for (const id of Object.keys(EXERCISES)) if (VARIANT(id) && state.per[VARIANT(id)]) state.per[id] = state.per[VARIANT(id)];
const variantFor = (ex, grip) => Object.keys(POSES.exercises).find(id => VARIANT(id) === ex && POSES.exercises[id].meta.grip === grip);
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
// Curvas entre claves como las de Blender (Bézier «auto clamped»), canal a canal: velocidad continua al pasar por cada clave,
// cero en los extremos del recorrido y donde el canal llega a un máximo o un mínimo. En recta (antes) la velocidad cambiaba de
// golpe en cada clave y se notaban tirones (en la dominada, entre el 32 y el 50 %, donde hay claves seguidas).
function curveAt(ex, s) { const [, , t, i] = seg(ex, s); return { K: keysOf(ex), i, t }; }
function herm({ K, i, t }, v) {                     // v(k): valor del canal en la clave k
  const n = K.length, ds = K[i + 1].s - K[i].s;
  const slope = j => { if (j <= 0 || j >= n - 1) return 0; const a = v(j - 1), b = v(j), c = v(j + 1);
    return (b - a) * (c - b) <= 0 ? 0 : (c - a) / (K[j + 1].s - K[j - 1].s); };
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * v(i) + (t3 - 2 * t2 + t) * ds * slope(i) + (3 * t2 - 2 * t3) * v(i + 1) + (t3 - t2) * ds * slope(i + 1);
}
const hermV = (c, v) => V(herm(c, k => v(k).x), herm(c, k => v(k).y), herm(c, k => v(k).z));
function hermQ(c, q) {                              // por componentes, con todas en el mismo hemisferio que la clave i, y normalizado
  const ref = q(c.i), al = k => { const x = q(k); return x.dot(ref) < 0 ? new THREE.Quaternion(-x.x, -x.y, -x.z, -x.w) : x; };
  return new THREE.Quaternion(herm(c, k => al(k).x), herm(c, k => al(k).y), herm(c, k => al(k).z), herm(c, k => al(k).w)).normalize();
}
// Pose autorada interpolada entre claves (rotaciones locales -> curvas -> FK)
const AUTH = {};
function authoredLocal(ex) {
  return AUTH[ex] ??= keysOf(ex).map(({ bones: B }) => {
    const loc = {}, off = {};
    for (const n of BN) {
      const q = new THREE.Quaternion(...B[n].q), P = PARENT[n];
      loc[n] = P ? new THREE.Quaternion(...B[P].q).invert().multiply(q) : q;
      if (P) off[n] = V(...B[n].off);
    }
    return { loc, off, root: V(...B['DEF-HIPS'].p) };
  });
}
let CUR_OFF = null;                                // desplazamientos locales autorados del frame actual
function authoredOffsets(ex, s) { const c = curveAt(ex, s), L = authoredLocal(ex), o = {};
  for (const n of BN) if (PARENT[n]) o[n] = hermV(c, k => L[k].off[n]); return o; }
function authoredPose(ex, s) {
  const c = curveAt(ex, s), L = authoredLocal(ex), pose = {};
  for (const n of ORDER) {
    const lq = hermQ(c, k => L[k].loc[n]), P = PARENT[n];
    pose[n] = { q: P ? pose[P].q.clone().multiply(lq) : lq, p: V() };
  }
  const offs = authoredOffsets(ex, s), saved = CUR_OFF; CUR_OFF = offs;
  pose['DEF-HIPS'].p = hermV(c, k => L[k].root); fkSub(pose, 'DEF-HIPS');
  CUR_OFF = saved; return pose;
}
// transformaciones mundiales exactas exportadas de Blender (para apoyos: pies, asas)
const expP = (ex, n, s) => { const c = curveAt(ex, s); return hermV(c, k => V(...c.K[k].bones[n].p)); };
const expQ = (ex, n, s) => { const c = curveAt(ex, s); return hermQ(c, k => new THREE.Quaternion(...c.K[k].bones[n].q)); };
// centro de masas sagital del sistema respecto al mediopié. Masas y centros por segmento de de Leva (% del peso corporal):
// cabeza 6,94 · tronco 43,46 · brazo 2,71 · antebrazo 1,62 · mano 0,61 · muslo 14,16 · pierna 4,33 · pie 1,37.
// Cabeza y brazos van en su sitio real, no sumados al tronco: en la sentadilla frontal los brazos van por delante y hacen de
// contrapeso; con la barra sin peso, el modelo antiguo creía el cuerpo más atrás y doblaba el tronco de más (46° en vez de 27°).
function midfootZ(P) { return ['L', 'R'].map(S => { const a = P[`DEF-FOOT.${S}`].p, t = P[`DEF-TOE.${S}`].p; return a.z + 0.4 * (t.z - a.z); }).reduce((x, y) => x + y) / 2; }
function comOffset(P, bar, load) {
  const p = n => P[n].p, along = (n, l) => p(n).clone().add(V(0, l * K(), 0).applyQuaternion(P[n].q));   // l m a lo largo del hueso
  const hip = midOf(P, 'DEF-THIGH01.L', 'DEF-THIGH01.R'), sh = midOf(P, 'DEF-ARM01.L', 'DEF-ARM01.R');
  let z = 43.46 * hip.clone().lerp(sh, 0.5).z + 6.94 * along('DEF-HEAD', 0.1).z;
  for (const S of ['L', 'R']) {
    const s = p(`DEF-ARM01.${S}`), e = p(`DEF-FORARM01.${S}`), w = p(`DEF-HAND.${S}`);
    const h = p(`DEF-THIGH01.${S}`), k = p(`DEF-SHIN01.${S}`), a = p(`DEF-FOOT.${S}`), t = p(`DEF-TOE.${S}`);
    z += 2.71 * lerp(s.z, e.z, 0.577) + 1.62 * lerp(e.z, w.z, 0.457) + 0.61 * along(`DEF-HAND.${S}`, 0.05).z
      + 14.16 * lerp(h.z, k.z, 0.41) + 4.33 * lerp(k.z, a.z, 0.44) + 1.37 * lerp(a.z, t.z, 0.4);
  }
  return (z + load * bar.z) / (100 + load) - midfootZ(P);
}
// CdM objetivo respecto al mediopié: el de las claves de Blender CON LA CARGA ACTUAL, interpolado entre ellas. Así la pose
// autorada sale tal cual con cualquier carga, y la carga solo decide cuánto pesa cada cosa al compensar otros cambios (cuerpo,
// rodilla, tobillo). Con la carga por defecto fija, quitar peso dejaba al cuerpo solo en el punto de equilibrio de cuerpo +
// barra: la frontal sin peso se doblaba y el peso muerto acababa inclinado hacia delante al bloquear.
// La pose interpolada tampoco sirve de referencia: entre claves se interpolan rotaciones, no el equilibrio (el CdM se iba hasta
// 5 cm atrás a mitad de bajada).
const EREF = {};
function comRef(ex, s, load) {
  const e = EREF[ex + '|' + load] ??= keysOf(ex).map(k => withBody(DEFAULT_BODY, () => { const A = authoredPose(ex, k.s); return comOffset(A, features(A, ex, k.s).bar, load); }));
  const [, , t, i] = seg(ex, s); return e[i] + (e[i + 1] - e[i]) * t;
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
  const A = fr('start'), B = fr('end'), [Ka, Kb, t] = seg(ex, s);
  if (A.bar) {
    const cv = curveAt(ex, s), c = hermV(cv, k => V(...cv.K[k].bar.center));
    f.bar = c; f.barAxis = V(...Ka.bar.axis).lerp(V(...Kb.bar.axis), t).normalize();
    const rel = c.clone().sub(sh);   // barra respecto al hombro en el marco del tronco (u = arriba, n = delante)
    f.barOff = { du: rel.y * Math.cos(f.phi) + rel.z * Math.sin(f.phi), dn: rel.z * Math.cos(f.phi) - rel.y * Math.sin(f.phi), dx: rel.x };
  }
  if (A.machine) {
    f.plate = { p: V(...Ka.plate.p).lerp(V(...Kb.plate.p), t), normal: V(...A.plate.normal), up: V(...A.plate.up) };
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

// implementos (spec X02-03). d: grosor del asa · rest: altura del asa con el implemento en el suelo · side: a los lados (asa
// de delante a atrás, agarre neutro), a dx del borde de la cadera · half: media distancia entre las manos si las dos van en la
// misma asa · rot: giro del asa hacia fuera (rotación externa del brazo, más natural con mancuernas) · kb: se dibuja kettlebell
const IMPL = {
  barra:           { d: 0.028, rest: 0.225 },
  mancuernas:      { d: 0.032, rest: 0.10, rot: 25 * DEG },
  mancuernas_lado: { d: 0.032, rest: 0.10, side: true, dx: 0.12 },
  kettlebell:      { d: 0.035, rest: 0.26, half: 0.05, kb: true },
  kettlebells:     { d: 0.035, rest: 0.26, side: true, dx: 0.18, kb: true },
};
// dominada: agarre supino (la palma hacia uno, misma barra; `roll`: la mano gira media vuelta sobre su eje antes de alinear
// el asa: girar 180° «lo mínimo» elige un eje cualquiera que cambia de un frame a otro) y neutro (asas paralelas, a ±25 cm, de delante a atrás)
const HANG_GRIP = { supino: { d: 0.028, palm: 'back', roll: Math.PI, elbow: 45 * DEG }, neutro: { d: 0.032, side: true, half: 0.25, palm: 'in', elbow: 35 * DEG } };
// eje del asa en el mundo para cada mano: transversal (barra), de delante a atrás (a los lados) o transversal girado `rot` con
// el lado del pulgar hacia delante (rotación externa)
const handleAxis = (I, sgn, barAxis = X) => I.side ? Z.clone() : I.rot ? V(-sgn * Math.cos(I.rot), 0, Math.sin(I.rot)) : barAxis.clone();
const implOf = ex => IMPL[state.per[ex].impl || 'barra'];
// mano para un implemento que no es el de la acción (spec X02-02): dedos y hueco mezclando las manos de referencia de 28 y
// 40 mm según el grosor del asa; la mano gira lo mínimo para que el asa le quede en el hueco con el eje del implemento, y de
// los dos sentidos, el que deja la palma donde toca (atrás con el asa transversal; hacia dentro a los lados)
function implHand(S, sgn, qA, I) {
  if (I.roll) qA = QA(V(0, 1, 0).applyQuaternion(qA), I.roll).multiply(qA);   // giro de la mano sobre su eje (supino)
  const t = clamp((I.d - 0.028) / 0.012), A = POSES.hands['28'][S], B = POSES.hands['40'][S];
  const hollow = V(...A.hollow.p).lerp(V(...B.hollow.p), t), ax = V(...A.hollow.axis).lerp(V(...B.hollow.axis), t).normalize();
  const fingers = {}; for (const n in A.fingers) fingers[n] = new THREE.Quaternion(...A.fingers[n]).slerp(new THREE.Quaternion(...B.fingers[n]), t);
  const palm = hollow.clone().setY(0), want = handleAxis(I, sgn);     // hacia la palma: el hueco, quitando lo que va a lo largo del hueso
  let best = null;
  for (const tgt of [want, want.clone().negate()]) {
    const q = new THREE.Quaternion().setFromUnitVectors(ax.clone().applyQuaternion(qA), tgt).multiply(qA), pw = palm.clone().applyQuaternion(q);
    const look = I.palm || (I.side ? 'in' : 'back');
    // hacia dónde mira la palma y, a igualdad, el que deja la mano apuntando como estaba (si no, el supino a veces le daba la vuelta)
    const score = (look === 'in' ? -sgn * pw.x : look === 'front' ? pw.z : -pw.z) + 0.5 * V(0, 1, 0).applyQuaternion(q).dot(V(0, 1, 0).applyQuaternion(qA));
    if (!best || score > best.score) best = { q, score };
  }
  return { q: best.q, fingers, hollow };
}
// bisagra: punto bajo y alto de la barra en las claves. El bajo es el inicio en el convencional y el final en el rumano.
const PLATE_R = 0.225;   // radio del disco: la barra en el suelo está a esta altura
const hingeKeys = ex => { const K = keysOf(ex), y = k => k.bar.center[1], lo = K.reduce((a, k) => y(k) < y(a) ? k : a), hi = K.reduce((a, k) => y(k) > y(a) ? k : a);
  return { sB: lo.s, HB: y(lo), HT: y(hi), floor: y(lo) < PLATE_R + 0.01 }; };
// Recorte: con la profundidad por encima del punto bajo, o con bloques más altos que él, la repetición va del punto alto al
// momento en que la barra está a esa altura en la animación YA AJUSTADA (cuerpo, rodilla, déficit…): es cortar, nada más.
// Lo de debajo no se ve, no se comprime, y la pose en el corte es la misma que se vería ahí sin recortar (solo sube el pecho).
// Más hondo que la autorada (profundidad negativa, déficit) no hay animación que recortar: lo resuelve el punto bajo.
const HCUT = {};
function hingeCut(ex) {
  const k = ex + JSON.stringify(state.body) + JSON.stringify(state.per[ex]);
  if (k in HCUT) return HCUT[k];
  const hk = hingeKeys(ex), prm = state.per[ex], y = s => evaluateRaw(ex, s).bar.center.y;
  const bottom = y(hk.sB), cut = Math.max(bottom + Math.max(0, prm.depth / 100), implOf(ex).rest + prm.plates / 100);
  let sCut = hk.sB;
  if (cut > bottom + 1e-4) {   // bisección entre el punto bajo y el alto sobre la altura real de la barra
    let lo = hk.sB, hi = 1 - hk.sB;
    for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (y(m) < cut) lo = m; else hi = m; }
    sCut = (lo + hi) / 2;
  }
  return (HCUT[k] = { ...hk, sCut });
}
// s de la repetición (0..1) -> s de la animación, dentro del recorrido recortado
function hingeS(ex, s) { const c = hingeCut(ex), sT = 1 - c.sB; return c.sCut + (sT - c.sCut) * (c.sB === 0 ? s : 1 - s); }
// ángulo autorado de la rodilla (muslo + tibia) en el punto bajo: el tope de «Flexión de rodilla» se cuenta desde él
const HKB = {};
const hingeKB = ex => HKB[ex] ??= withBody(DEFAULT_BODY, () => { const sB = hingeKeys(ex).sB, A = authoredPose(ex, sB), f = features(A, ex, sB); return f.beta + f.th; });
// bisagra: en cada clave, puño − barra (por lado). Entre claves se interpola y las manos van siempre a la barra; la pose
// interpolada describe un arco y la barra una recta (en el rumano se separaban hasta 11 cm).
const gripOf = (P, S) => { const hn = `DEF-HAND.${S}`; return P[hn].p.clone().add(socketRest(S).applyQuaternion(P[hn].q.clone().multiply(REST[hn].q.clone().invert()))); };
const HGRIP = {};
function hingeGrip(ex, s) {
  const G = HGRIP[ex] ??= keysOf(ex).map(k => withBody(DEFAULT_BODY, () => { const A = authoredPose(ex, k.s), bar = V(...k.bar.center);
    return Object.fromEntries(['L', 'R'].map(S => [S, { off: gripOf(A, S).sub(bar) }])); }));
  const [, , t, i] = seg(ex, s), a = G[i], b = G[i + 1];
  return Object.fromEntries(['L', 'R'].map(S => [S, { off: a[S].off.clone().lerp(b[S].off, t) }]));
}

/* ---------------- Evaluación de un frame ---------------- */
function evaluate(ex, s) {
  const base = EXERCISES[ex].base, prm = state.per[ex];
  // dominada: el recorrido se recorta por arriba (hasta dónde sube) y por abajo (desde dónde baja); no se comprime
  if (base === 'hang') s = (prm.bottom + s * (prm.top - prm.bottom)) / 100;
  // agarre con su propia acción (supino: Chinup); el neutro sale de la supina si la hay (los codos ya van hacia delante)
  if (base === 'hang') ex = variantFor(ex, prm.gripType) || (prm.gripType === 'neutro' && variantFor(ex, 'supino')) || ex;
  return evaluateRaw(ex, base === 'hinge' ? hingeS(ex, s) : s);
}
// s de la animación, sin recorte (el recorte la usa para buscar el corte)
function evaluateRaw(ex, s) { const saved = CUR_OFF; CUR_OFF = authoredOffsets(ex, s); try { return evaluateInner(ex, s); } finally { CUR_OFF = saved; } }
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
    // bisagra: subida (0 en el punto bajo, 1 arriba) medida por la altura autorada de la barra
    const hk = hinge && hingeKeys(ex), up = hinge ? clamp((F.bar.y - hk.HB) / (hk.HT - hk.HB)) : 0;
    const yaw0 = (F.L.yaw - F.R.yaw) / 2, stance0 = (F.L.an.x - F.R.an.x) / 2;
    const beta = hinge ? F.beta : F.beta * lerp(1, depth, clamp(F.beta / (60 * DEG)));
    const thPref0 = F.th, thPref = F.th + (hinge ? 0 : prm.knees * DEG * clamp(F.beta / (60 * DEG)));
    const yaw = yaw0 + prm.toes * DEG, stance = stance0 * prm.stance * d.k / d0.k;
    const barOff0 = F.barOff || { du: 0, dn: 0 }, barOff = { du: barOff0.du * d.k / d0.k + barH / 100, dn: barOff0.dn * d.k / d0.k };
    const L = prm.load;
    const lim0 = Math.max(35 * DEG, F.th) + 10 * DEG, limC = Math.max(35 * DEG, F.th) + (d.dorsi - 35) * DEG + 10 * DEG;
    const ref = solveStand(d0, F.beta, thPref0, F.phi, stance0, yaw0, barOff0, L, lim0);   // misma carga: solo cuenta lo que cambia el cuerpo
    const cur = solveStand(d, beta, thPref, F.phi, stance, yaw, barOff, L, limC);
    // estilo autorado + corrección del solver
    const thLim = Math.max(35 * DEG, F.th) + (d.dorsi - 35) * DEG;      // límite de tobillo relativo a la pose autorada
    // el CdM objetivo, dentro de la zona cómoda del pie (±6 cm del mediopié): si con esta carga el de las claves cae fuera
    // (salida del peso muerto sin peso: 12 cm detrás), el cuerpo se adelanta pivotando sobre el tobillo hasta meterlo
    const comZone = e => clamp(e, -0.06 * kk, 0.06 * kk);
    const phi0 = F.phi + (cur.phi - ref.phi), th = clamp(F.th + (hinge ? 0 : cur.th - ref.th) + (thPref - thPref0), -10 * DEG, thLim);
    // cadera: pose autorada + (geometría actual - geometría de referencia)  => exacta con los valores por defecto
    const G = (dd, b, t, st, yw) => { const dx = Math.max(0, st - dd.hipHalf), cv = Math.cos(Math.asin(Math.min(0.95, dx / (dd.Ls + dd.Lt)))), ch = Math.cos(yw * 0.85);
      const kz = dd.Ls * Math.sin(t) * ch, ky = dd.ankleH + dd.Ls * Math.cos(t) * cv; return V(0, ky + dd.Lt * Math.cos(b) * cv, kz - dd.Lt * Math.sin(b) * ch); };
    // entre claves el tobillo de la pose interpolada se desplaza respecto al plantado (hasta 13 cm con dos claves); la cadera se
    // mueve lo mismo para que la pierna mida lo que dicen muslo y tibia. Si no, la pierna queda corta y la rodilla se dobla de más:
    // en la sentadilla trasera, 64° en vez de 37° al 25 % de la bajada (parecía que bajaba primero con las rodillas); en el
    // rumano, 48° en vez de 32° a mitad. En las claves no hay desplazamiento.
    const drift = ['L', 'R'].map(S => expP(ex, `DEF-FOOT.${S}`, s).sub(auth[`DEF-FOOT.${S}`].p)).reduce((a, v) => a.add(v)).multiplyScalar(0.5);
    const hipOf = (b, t = th) => { const h = F.hip.clone().add(drift).add(G(d, b, t, stance, yaw).sub(G(d0, F.beta, F.th, stance0, yaw0))); h.x = F.hip.x; return h; };
    const hipT = hipOf(beta);
    const kr = d.k / d0.k, hg = hinge && hingeGrip(ex, s);
    // implemento: con el de la acción (la barra) mandan sus dedos y su puño; con otro, las manos de referencia (spec X02)
    const I = hinge ? implOf(ex) : IMPL.barra, handI = hinge && I !== IMPL.barra && POSES.hands
      && { L: implHand('L', 1, auth['DEF-HAND.L'].q, I), R: implHand('R', -1, auth['DEF-HAND.R'].q, I) };
    // bisagra: puño respecto a la barra, por lado, con el agarre aplicado a lo largo de la barra (la barra no gira: Rh = identidad).
    // A los lados, las mancuernas van junto a los muslos; con una kettlebell, las dos manos juntas en el asa.
    const gripOff = S => { const o = hg[S].off, along = o.dot(F.barAxis);
      const x = I.side ? Math.sign(along) * (d.hipHalf + I.dx * d.k) : I.half ? Math.sign(along) * I.half * kr : along * prm.grip * kr;
      return F.barAxis.clone().multiplyScalar(x).add(o.clone().addScaledVector(F.barAxis, -along).multiplyScalar(kr)); };
    const wristOff = S => handI ? handI[S].hollow.clone().multiplyScalar(d.k).applyQuaternion(handI[S].q)     // puño -> muñeca
      : socketRest(S).multiplyScalar(d.k).applyQuaternion(auth[`DEF-HAND.${S}`].q.clone().multiply(REST[`DEF-HAND.${S}`].q.clone().invert()));
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
    const bar = hinge ? shNow.clone().add(F.bar.clone().sub(F.sh).multiplyScalar(d.k / d0.k))   // brazos colgando: mismo vector hombro→barra...
      : shNow.clone().addScaledVector(u, barOff.du).addScaledVector(n, barOff.dn).add(V((barOff0.dx || 0) * d.k / d0.k, 0, 0));
    if (hinge) {   // ...salvo la altura: la que deja la muñeca izquierda con el BRAZO RECTO (regla: con la barra en las
      // manos el codo no se flexiona, ni en el aire ni en el suelo). Con el agarre más abierto el brazo baja menos.
      const sh = pose['DEF-ARM01.L'].p, o = gripOff('L').sub(wristOff('L'));   // barra -> muñeca
      const R = 0.999 * (LEN('L').Lu + LEN('L').Lf), dx = bar.x + o.x - sh.x, dz = bar.z + o.z - sh.z;
      bar.y = sh.y - o.y - Math.sqrt(Math.max(0, R * R - dx * dx - dz * dz));
    }
    const axis = F.barAxis.clone().applyQuaternion(Rh);
    for (const [S, sgn] of [['L', 1], ['R', -1]]) {
      const hn = `DEF-HAND.${S}`, sock = socketRest(S);
      let grip;
      if (hinge) grip = bar.clone().add(gripOff(S));
      else {
        const gripA = gripOf(auth, S), offA = gripA.clone().sub(F.bar), along = offA.dot(F.barAxis), perp = offA.clone().addScaledVector(F.barAxis, -along);
        grip = bar.clone().addScaledVector(axis, along * prm.grip * kr).add(perp.applyQuaternion(Rh).multiplyScalar(kr));
      }
      const qHandW = Rh.clone().multiply(auth[hn].q);
      const wrist = hinge ? grip.clone().sub(wristOff(S)) : grip.clone().sub(sock.clone().multiplyScalar(d.k).applyQuaternion(qHandW.clone().multiply(REST[hn].q.clone().invert())));
      const elbowPole = poleOf(auth[`DEF-ARM01.${S}`].p, auth[`DEF-FORARM01.${S}`].p, auth[hn].p).applyQuaternion(Rh);
      const ik = solveLimb(pose, auth, [`DEF-ARM01.${S}`, `DEF-ARM02.${S}`, `DEF-FORARM01.${S}`, `DEF-FORARM0.${S}`, hn], wrist, elbowPole, [LEN(S).Lu, LEN(S).Lf]);
      // mantener rotaciones autoradas (giradas con la barra) para el resto de la cadena del brazo tras el IK
      for (const c of subtree(hn)) pose[c].q = Rh.clone().multiply(auth[c].q);
      if (handI) { const h = handI[S]; pose[hn].q = h.q.clone(); for (const c in h.fingers) pose[c].q = h.q.clone().multiply(h.fingers[c]); }
      fkSub(pose, `DEF-SHOULDER.${S}`);
      if (ik.miss > 0.01) warns.push(`La mano ${S === 'L' ? 'izquierda' : 'derecha'} no llega a la barra (${Math.round(ik.miss * 100)} cm)`);
    }
    return { pose, bar, axis, warns, grips: hinge && ['L', 'R'].map(S => bar.clone().add(gripOff(S))) };
    };
    // ---- equilibrio en lazo cerrado sobre la pose real: el centro de masas del sistema (cuerpo + barra)
    // se mantiene sobre el mediopié igual que en la pose autorada; se corrige con la inclinación del tronco.
    let phiA, bA, betaH = beta, thH = th;
    if (hinge) {
      // bisagra: en cada frame, el mismo problema. La rodilla tiene el ángulo que toca (con «Flexión de rodilla» negativa, un
      // tope: la animación va normal hasta llegar a él y ahí se queda); con ese ángulo fijo, la pierna gira sobre el tobillo y el
      // tronco se inclina. Newton 2×2 sobre tibia y tronco para que:
      //   e1) el centro de masas (cuerpo + barra, con la carga actual) quede donde lo tienen las claves, dentro de la zona del pie
      //       (si no cabe, pivota sobre el tobillo hacia delante);
      //   e2) la barra siga su trayectoria: la de las claves (× k) más lo que cambie el punto bajo, repartido según la subida
      //       (todo abajo, nada arriba). Arriba, de pie, la altura de la barra apenas depende de tibia y tronco y no se puede
      //       exigir (con otro cuerpo saldría encogido): ahí manda la tibia autorada. e2 mezcla las dos cosas según la subida.
      // Así la barra baja al ritmo de la animación aunque la rodilla esté topada (antes se quedaba arriba y caía de golpe al
      // final). Con los valores por defecto sale la autorada.
      // Altura en el punto bajo: si la autorada está en el suelo, en el suelo (los bloques solo recortan), igual para todos los
      // cuerpos; si no, la autorada × k, más la profundidad negativa, sin pasar del suelo o los bloques. Altura de los pies: se
      // resuelve con los pies en el suelo y al final se sube todo.
      const cRef = comZone(comRef(ex, s, L)), pb = prm.plates / 100, pf = prm.feet / 100, dp = prm.depth / 100;
      // altura del asa. Con otro implemento, el hueco del puño queda a otra distancia de la muñeca (dI): para que la MANO vaya
      // por donde iba con la barra, el asa se desplaza dI. Lo que empieza en el suelo (convencional): abajo manda el
      // implemento (su asa en el suelo) y arriba, las manos. Lo demás (rumano): siempre las manos, sin atravesar el suelo.
      const barWo = socketRest('L').multiplyScalar(d.k).applyQuaternion(auth['DEF-HAND.L'].q.clone().multiply(REST['DEF-HAND.L'].q.clone().invert()));
      const dI = handI ? wristOff('L').y - barWo.y : 0;
      const hBot = hk.floor ? I.rest - pf : Math.max(hk.HB * kr + Math.min(0, dp) + dI, I.rest + pb - pf);
      const hT = hk.floor ? F.bar.y * kr + (hBot - hk.HB * kr) * (1 - up) + dI * up
        : F.bar.y * kr + dI + (hBot - hk.HB * kr - dI) * (1 - up);
      const KB = hingeKB(ex), Ka = F.beta + F.th, Kf = prm.knees <= 0 ? Math.min(Ka, KB + prm.knees * DEG) : Ka * (1 + prm.knees * DEG / KB);
      const T_MIN = -12 * DEG, T_MAX = Math.min(45 * DEG, thLim);   // tibia: atrás, pierna rígida con el peso en los talones; delante, el tobillo
      const E = (t, ph) => { const r = build(ph, hipOf(Kf - t, t));
        return [r, comOffset(r.pose, r.bar, L) - cRef, (1 - up) * (r.bar.y - hT) + up * 0.3 * (t - th)]; };
      let t = th, ph = F.phi, [r, e1, e2] = E(t, ph);
      for (let i = 0; i < 16 && Math.abs(e1) + Math.abs(e2) > 0.0002; i++) {
        const h = 1e-3, [, a1, a2] = E(t + h, ph), [, c1, c2] = E(t, ph + h);
        const j11 = (a1 - e1) / h, j21 = (a2 - e2) / h, j12 = (c1 - e1) / h, j22 = (c2 - e2) / h, det = j11 * j22 - j12 * j21;
        if (Math.abs(det) < 1e-12) break;
        t = clamp(t - (j22 * e1 - j12 * e2) / det, T_MIN, T_MAX); ph = clamp(ph - (j11 * e2 - j21 * e1) / det, -20 * DEG, 110 * DEG);
        [r, e1, e2] = E(t, ph);
      }
      if (Math.abs(e1) > 0.01) r.warns.push(`Con la rodilla así, el centro de masas se va ${Math.round(Math.abs(e1) * 100)} cm ${e1 > 0 ? 'hacia delante' : 'hacia atrás'}`);
      if (s === hk.sB && Math.abs(r.bar.y - hBot) > 0.01) r.warns.push(`No llega a esa profundidad con la rodilla así (se queda a ${Math.round((r.bar.y - hBot) * 100)} cm)`);
      const b = Kf - t, tF = t;
      phiA = ph; bA = r; betaH = b; thH = tF;
      const hipNow = midOf(r.pose, 'DEF-THIGH01.L', 'DEF-THIGH01.R'), hipA = midOf(auth, 'DEF-THIGH01.L', 'DEF-THIGH01.R').add(drift);
      out.hipD = [hipNow.y - hipA.y, hipNow.z - hipA.z];
    } else {
      const eRef = comZone(comRef(ex, s, L));
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
    if (hinge && prm.feet) { const lift = V(0, prm.feet / 100, 0); for (const n of BN) pose[n].p.add(lift); bar.add(lift); bA.grips.forEach(g => g.add(lift)); }
    if (hinge) { out.grips = bA.grips; out.impl = prm.impl || 'barra'; }
    if (hinge && phi > 85 * DEG && betaH + thH < 45 * DEG) out.warns.push('Bajar tanto con la rodilla tan recta pide unos isquios muy flexibles');
    out.bar = { center: bar, axis };
    const mf = midfootZ(pose), com = comOffset(pose, bar, L) + mf;
    // fuera del pie (talón ≈ 10 cm detrás del mediopié, punta ≈ 10 cm delante): se caería. P. ej. la salida del peso muerto
    // sin carga: sin la barra delante, el cuerpo queda 12 cm detrás.
    const edge = 0.10 * kk, off = com - mf;
    if (Math.abs(off) > edge) out.warns.push(`Se caería hacia ${off > 0 ? 'delante' : 'atrás'}: el centro de masas queda ${Math.round(Math.abs(off) * 100)} cm ${off > 0 ? 'por delante' : 'por detrás'} del mediopié, fuera del pie${L < 30 ? ' (con tan poca carga, la barra no hace de contrapeso)' : ''}`);
    out.act = cur.act; out.path = bar.clone(); out.mid = mf; out.com = com;
    out.readout = [['Tronco', `${Math.round(phi / DEG)}°`], ['Muslo', `${Math.round(betaH / DEG)}°`], ['Tibia', `${Math.round(thH / DEG)}°`],
      ...(hinge ? [['Barra', `${Math.round(bar.y * 100)} cm del suelo`]] : []), ['CdM–mediopié', `${((com - mf) * 100).toFixed(1)} cm`],
      ['Barra–mediopié', `${((bar.z - mf) * 100).toFixed(1)} cm`]];
    // qué ha ajustado: el muslo en el punto bajo para llegar a la barra (se reparte hasta arriba)
    // qué ha ajustado: dónde queda la cadera respecto a la autorada en este frame
    const [hy, hz] = (hinge && out.hipD) || [0, 0], cm = v => Math.round(Math.abs(v) * 100);
    if (cm(hy) || cm(hz)) out.readout.push(['Cadera', `${cm(hy) ? `${cm(hy)} cm más ${hy > 0 ? 'alta' : 'baja'}` : ''}${cm(hy) && cm(hz) ? ' y ' : ''}${cm(hz) ? `${cm(hz)} cm más ${hz > 0 ? 'adelante' : 'atrás'}` : ''} que la autorada`]);
    out.phase = `muslo ${Math.round(betaH / DEG)}°`;
  } else if (exd.base === 'hang') {
    // DOMINADA (tipo `hang`): el cuerpo cuelga de las manos.
    //  1) la pose autorada con las medidas actuales;
    //  2) los hombros donde los brazos llegan a la barra: el vector barra→hombros autorado × k, a la altura que deja la muñeca a
    //     la distancia hombro→muñeca autorada (× k) con el agarre actual (más abierto -> el cuerpo cuelga más alto);
    //  3) brazos por IK hasta la barra; con agarre supino o neutro, la mano de las manos de referencia (X02);
    //  Sin equilibrio automático (se quitó el péndulo el 4-nov: no aportaba). Con los valores por defecto sale la autorada.
    const kr = d.k / d0.k, barC = F.bar.clone(), ax = F.barAxis.clone();
    // las manos no se mueven en la barra: muñeca y giro de la mano salen de las claves exportadas (en Blender la mano cuelga de la
    // barra y está quieta), no de la pose interpolada, que entre claves la llevaba en arco (hasta 5 cm).
    const qHand = S => expQ(ex, `DEF-HAND.${S}`, s);
    // agarre: el de la acción, tal cual (con sus manos y codos); otro, girando la mano (manos de referencia). Desde la supina, el
    // neutro no da media vuelta y el codo va como en la supina
    const own = POSES.exercises[ex].meta?.grip || 'prono';
    const I = prm.gripType === own ? null : own === 'supino' && prm.gripType === 'neutro' ? { ...HANG_GRIP.neutro, elbow: 0 } : HANG_GRIP[prm.gripType];
    const handI = I && POSES.hands && { L: implHand('L', 1, qHand('L'), I), R: implHand('R', -1, qHand('R'), I) };
    const handle = S => { const along = expP(ex, `DEF-HAND.${S}`, s).sub(barC).dot(ax);     // centro del asa de cada mano
      return barC.clone().addScaledVector(ax, I && I.half ? Math.sign(along) * I.half * kr : along * prm.grip); };
    const wristAt = S => {
      if (handI) return handle(S).sub(handI[S].hollow.clone().multiplyScalar(d.k).applyQuaternion(handI[S].q));
      const wk = expP(ex, `DEF-HAND.${S}`, s).sub(barC), along = wk.dot(ax);           // prono: la muñeca de las claves
      return barC.clone().addScaledVector(ax, along * prm.grip).add(wk.addScaledVector(ax, -along).multiplyScalar(kr)); };
    const P = authoredPose(ex, s), shA = midOf(auth, 'DEF-ARM01.L', 'DEF-ARM01.R'), shP = midOf(P, 'DEF-ARM01.L', 'DEF-ARM01.R');
    const sh = barC.clone().add(shA.clone().sub(barC).multiplyScalar(kr));
    { // el hombro sigue el vector barra→hombros autorado (× k). Colgado, con el brazo casi recto (codo autorado < 20°), el cuerpo
      // cuelga a la distancia hombro→muñeca que da ese codo: con el agarre más abierto, más alto. Nunca más lejos de lo que llega
      // el brazo. (Fijar siempre la distancia daba saltos: a mitad de recorrido la muñeca pasa de estar encima del hombro a debajo.)
      const hA = auth['DEF-HAND.L'].p, eA = auth['DEF-FORARM01.L'].p, sA = auth['DEF-ARM01.L'].p;
      const elbowA = 180 - sA.clone().sub(eA).angleTo(hA.clone().sub(eA)) / DEG, wgt = clamp((20 - elbowA) / 10);
      const shL = () => sh.clone().add(P['DEF-ARM01.L'].p.clone().sub(shP)), w = wristAt('L');
      const h2 = () => { const q = shL(); return (q.x - w.x) ** 2 + (q.z - w.z) ** 2; };
      if (wgt > 0) { const RA = hA.distanceTo(sA) * kr; sh.y += wgt * (w.y - Math.sqrt(Math.max(0, RA * RA - h2())) - shL().y); }
      const Rmax = 0.999 * (LEN('L').Lu + LEN('L').Lf), q = shL();
      if (q.distanceTo(w) > Rmax) sh.y += w.y - Math.sign(w.y - q.y) * Math.sqrt(Math.max(0, Rmax * Rmax - h2())) - q.y; }
    const T = sh.clone().sub(shP); for (const n of BN) P[n].p.add(T);
    const warns = [];
    for (const S of ['L', 'R']) {
      const hn = `DEF-HAND.${S}`, wrist = wristAt(S);
      // el codo mira hacia donde lo llevan las claves (prono: hacia fuera); al girar la mano (supino, neutro), el codo gira con ella
      // hacia delante, alrededor de la línea hombro→muñeca (si no, el supino empezaba abriendo los codos hacia fuera)
      const pole = poleOf(auth[`DEF-ARM01.${S}`].p, auth[`DEF-FORARM01.${S}`].p, auth[hn].p);
      if (I && I.elbow) pole.applyAxisAngle(wrist.clone().sub(P[`DEF-ARM01.${S}`].p).normalize(), (S === 'L' ? -1 : 1) * I.elbow);
      const ik = solveLimb(P, auth, [`DEF-ARM01.${S}`, `DEF-ARM02.${S}`, `DEF-FORARM01.${S}`, `DEF-FORARM0.${S}`, hn], wrist, pole, [LEN(S).Lu, LEN(S).Lf]);
      // la mano con el giro de las claves; los dedos, con su giro relativo a la mano de la pose autorada (o de la mano de referencia)
      const qh = handI ? handI[S].q : qHand(S), inv = auth[hn].q.clone().invert();
      for (const c of subtree(hn)) P[c].q = qh.clone().multiply(inv.clone().multiply(auth[c].q));
      if (handI) for (const c in handI[S].fingers) P[c].q = qh.clone().multiply(handI[S].fingers[c]);
      fkSub(P, `DEF-SHOULDER.${S}`);
      if (ik.miss > 0.01) warns.push(`La mano ${S === 'L' ? 'izquierda' : 'derecha'} no llega a la barra (${Math.round(ik.miss * 100)} cm)`);
    }
    // sin equilibrio automático: el balanceo (péndulo alrededor de la barra) corregía 1° como mucho y le quitaba intención a la
    // animación; la dominada lastrada tendrá su propia acción
    const Pf = P, comZ = Q0 => comOffset(Q0, barC, 0) + midfootZ(Q0) - barC.z;
    Object.assign(pose, Pf); out.warns.push(...warns);
    out.bar = { center: barC, axis: ax }; out.mid = barC.z; out.com = comZ(Pf) + barC.z;
    out.path = midOf(Pf, 'DEF-ARM01.L', 'DEF-ARM01.R');
    out.act = { quads: 0, glutes: 0, hams: 0, add: 0, erect: 0.1, calves: 0 };
    if (handI) out.grips = ['L', 'R'].map(S => handle(S));
    const elbow = 180 - Pf['DEF-ARM01.L'].p.clone().sub(Pf['DEF-FORARM01.L'].p).angleTo(Pf['DEF-HAND.L'].p.clone().sub(Pf['DEF-FORARM01.L'].p)) / DEG;
    out.readout = [['Codo', `${Math.round(elbow)}°`], ['Hombros', `${Math.round((barC.y - out.path.y) * 100)} cm bajo la barra`],
      ['CdM–barra', `${((out.com - barC.z) * 100).toFixed(1)} cm`]];
    out.phase = `codo ${Math.round(elbow)}°`;
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
// implementos (spec X02-03): mancuernas (asa + dos cabezas hexagonales) y kettlebell (bola + asa), con el eje en X local
const ironMat = toon(0x2b2f37), steelMat = toon(0x9aa2ae);
const along = (geom, mat, x = 0, y = 0) => { const m = withOutline(geom, mat); m.rotation.z = Math.PI / 2; m.position.set(x, y, 0); return m; };
const dumbbells = [0, 1].map(() => { const g = new THREE.Group();
  g.add(along(new THREE.CylinderGeometry(0.016, 0.016, 0.14, 12), steelMat));
  for (const x of [-0.105, 0.105]) g.add(along(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 6), ironMat, x));
  scene.add(g); return g; });
const kettlebells = [0, 1].map(() => { const g = new THREE.Group(); scene.add(g);
  g.add(along(new THREE.CylinderGeometry(0.017, 0.017, 0.15, 12), ironMat));
  for (const x of [-0.075, 0.075]) { const post = withOutline(new THREE.CylinderGeometry(0.017, 0.017, 0.12, 10), ironMat); post.position.set(x * 0.9, -0.055, 0); post.rotation.z = -Math.sign(x) * 0.25; g.add(post); }
  const ball = withOutline(new THREE.SphereGeometry(0.11, 24, 16), ironMat); ball.position.y = -0.15; g.add(ball);
  return g; });
// dominada con agarre neutro: dos cuernos (las asas, de delante a atrás) que salen de una barra transversal en el extremo más
// alejado del cuerpo (delante)
const HORN = 0.26;
const parallels = new THREE.Group(); scene.add(parallels);
for (const x of [-1, 1]) { const h = withOutline(new THREE.CylinderGeometry(0.016, 0.016, HORN, 12), steelMat); h.rotation.x = Math.PI / 2; h.userData.x = x; parallels.add(h); }
{ const cross = withOutline(new THREE.CylinderGeometry(0.018, 0.018, 1, 12), steelMat); cross.rotation.z = Math.PI / 2; cross.userData.cross = true; parallels.add(cross); }
// bisagra: bloques bajo los discos y cajón bajo los pies (altura de los discos / de los pies); se escalan en alto
const boxMat = toon(0x5a6170);
const blocks = [-1, 1].map(() => { const b = withOutline(new THREE.BoxGeometry(0.3, 1, 0.5), boxMat); scene.add(b); return b; });
const footBox = withOutline(new THREE.BoxGeometry(0.6, 1, 0.42), boxMat); scene.add(footBox);
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
  const hp = EXERCISES[ex].base === 'hinge' ? state.per[ex] : { plates: 0, feet: 0 };
  blocks.forEach((b, i) => { b.visible = hp.plates > 0; if (!b.visible) return;
    b.scale.y = hp.plates / 100; b.position.set(r.bar.center.x + (i ? 0.72 : -0.72), hp.plates / 200, r.mid + 0.02); });
  footBox.visible = hp.feet > 0;
  if (footBox.visible) { footBox.scale.y = hp.feet / 100; footBox.position.set(0, hp.feet / 200, r.mid); }
  const impl = r.impl || 'barra', isDb = impl.startsWith('mancuernas');
  const neutral = EXERCISES[ex].base === 'hang' && state.per[ex].gripType === 'neutro' && r.grips;
  barMesh.visible = impl === 'barra' && !neutral;
  parallels.visible = !!neutral;
  if (neutral) { const g = r.grips, half = Math.abs(g[0].x - g[1].x) / 2;
    // la mano en el centro del cuerno; la barra transversal, en su extremo de delante y algo más ancha que los cuernos
    parallels.children.forEach(c => { if (c.userData.cross) { c.position.set(0, g[0].y, g[0].z + HORN / 2); c.scale.set(1, 2 * half + 0.16, 1); }
      else c.position.set(c.userData.x * half, g[0].y, g[0].z); }); }
  const I = IMPL[impl];
  dumbbells.forEach((g, i) => { g.visible = isDb; if (isDb) { g.position.copy(r.grips[i]); g.quaternion.setFromUnitVectors(X, handleAxis(I, i ? -1 : 1, r.bar.axis).normalize()); } });
  kettlebells.forEach((g, i) => { g.visible = !!I.kb && (i === 0 || impl === 'kettlebells'); if (!g.visible) return;
    if (impl === 'kettlebell') g.position.copy(r.grips[0]).add(r.grips[1]).multiplyScalar(0.5); else g.position.copy(r.grips[i]);
    g.quaternion.setFromUnitVectors(X, handleAxis(I, i ? -1 : 1, r.bar.axis).normalize()); });
  if (r.bar) {
    barG.position.copy(r.bar.center); barG.quaternion.setFromUnitVectors(X, r.bar.axis);
    const th = 0.02 + 0.13 * PRM().load / 200;
    plates.forEach(p => { p.visible = PRM().load > 0 && impl === 'barra' && EXERCISES[ex].base !== 'hang'; p.children[0].scale.set(1, th, 1); p.position.x = p.userData.s * (0.70 + th / 2); });
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
  for (const p of PARAMS[ex.base]) {
    if (!p.options) { slider(exHost, { ...p, id: `p-${p.id}`, get: () => PRM()[p.id], set: v => { PRM()[p.id] = v; } }); continue; }
    const w = document.createElement('div'); w.className = 'field';
    w.innerHTML = `<div class="top"><label>${p.label}</label></div><div class="seg" role="group" aria-label="${p.label}"></div>`;
    const segEl = w.querySelector('.seg'); segEl.style.flexWrap = 'wrap';   // con muchas opciones, en varias líneas
    for (const [v, l] of p.options.filter(([v]) => !p.allow?.(state.exId) || p.allow(state.exId).includes(v))) { const b = document.createElement('button'); b.textContent = l; b.setAttribute('aria-pressed', String(PRM()[p.id] === v));
      b.addEventListener('click', () => { PRM()[p.id] = v; segEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); changed(); }); segEl.appendChild(b); }
    exHost.appendChild(w);
  }
  const rb = document.createElement('button'); rb.className = 'copy'; rb.textContent = 'Volver a la pose autorada';
  rb.addEventListener('click', () => { for (const p of PARAMS[ex.base]) PRM()[p.id] = p.def; buildExerciseUI(); }); exHost.appendChild(rb);
  goal.r = ex.base === 'hang' ? 5.4 : 3.7;   // la dominada (barra a 2,3 m) se ve de más lejos
  setView(ex.base === 'seat' ? 'press' : 'side'); changed();
}
const exSeg = document.getElementById('exSeg');
for (const [id, ex] of Object.entries(EXERCISES)) {
  if (VARIANT(id)) continue;   // las variantes se eligen desde su chip
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
// reproducción: ida, pausa, vuelta, pausa. Lineal: el ritmo (arranque y frenada) ya viene de Blender en los frames exportados
function repS(t) { const T = 3.7; t %= T; if (t < 1.7) return t / 1.7; if (t < 1.9) return 1; if (t < 3.2) return 1 - (t - 1.9) / 1.3; return 0; }

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
  const k = K(); target.lerp(EX().base === 'seat' ? V(0, 0.75 * k, 0.3) : EX().base === 'hang' ? V(0, 1.6 * k, 0) : V(0, 0.8 * k, 0.03), 0.2);
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
