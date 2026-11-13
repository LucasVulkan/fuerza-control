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

// jalón (X03-20): la barra es la de la acción (meta.impl, del .blend: ff_impl), no un maneral del visor
const JALON = ex => POSES.exercises[ex]?.meta?.impl === 'barra_jalon';

/* ---------------- Ejercicios: qué sliders tiene cada uno ---------------- */
const EXERCISES = {
  back_squat: { name: 'Sentadilla trasera', short: 'Trasera', base: 'stand', bar: true, elbowPref: null },
  front_squat: { name: 'Sentadilla frontal', short: 'Frontal', base: 'stand', bar: true },
  leg_press: { name: 'Prensa 45°', short: 'Prensa', base: 'seat', bar: false },
  deadlift: { name: 'Peso muerto', short: 'Muerto', base: 'hinge', bar: true },
  romanian_deadlift: { name: 'Peso muerto rumano', short: 'Rumano', base: 'hinge', bar: true },
  pullup: { name: 'Dominada', short: 'Dominada', base: 'hang', bar: true },
  barbell_row: { name: 'Remo con barra', short: 'Remo', base: 'row', bar: true },
  cable_row: { name: 'Remo en polea', short: 'Polea', base: 'cable', bar: true },
  cable_row_one_arm: { name: 'Remo en polea a un brazo', short: 'Polea 1 brazo', base: 'cable', bar: true },
};
// las acciones nuevas aparecen solas con su meta (ff_base, ff_name) aunque no estén en la lista
for (const [id, e] of Object.entries(POSES.exercises)) EXERCISES[id] ??= { name: e.meta.name, short: e.meta.name, base: e.meta.base, bar: e.meta.base !== 'seat' };
// remo con barra: al inclinar más el tronco la barra no puede ir tan al ombligo (atravesaría el pecho). Sube hacia el pecho en
// proporción (`cm` con la inclinación máxima, `trunk`) y el recorrido se corta cuando el codo llega a `elbow` (con frenada).
// Con mancuernas y kettlebells, recorrido completo.
const ROW_BAR = { trunk: 25, cm: 8, elbow: 120 };   // elbow en grados
// carga de la acción `libre` y de las bases que salen de ella (X03-14): su valor por defecto es el de la acción (`ff_carga_pc`) y solo sale si la acción lleva carga;
// no mueve la pose (dibuja los discos o las mancuernas y pesa en la demanda)
const LOAD_LIBRE = { id: 'load', label: 'Carga', hide: ex => !(POSES.exercises[ex]?.meta?.carga && POSES.exercises[ex].meta.carga !== 'ninguna'), min: 0, max: 250, step: 5,
  defOf: ex => POSES.exercises[ex]?.meta?.cargaPc ?? 0, def: 0, fmt: v => `${v}% del peso corporal` };
const CARGA = (ex, t) => POSES.exercises[ex]?.meta?.carga === t;
const benchTop = ex => { const b = POSES.exercises[ex]?.meta?.props?.[0]; return b ? (b[0][1] + b[1][1] / 2) * 100 : 0; };   // cm del suelo a la tapa del banco
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
  // remo (remo con barra): tronco fijo y piernas quietas; solo se mueven los brazos. Comparte con la bisagra piernas,
  // implementos y equilibrio (el CdM lo compensa la cadera, girando la pierna sobre el tobillo)
  row: [
    { id: 'impl', label: 'Implemento', def: 'barra', options: [['barra', 'Barra'], ['mancuernas', 'Mancuernas'], ['kettlebells', '2 kettlebells']] },
    { id: 'gripType', label: 'Agarre', def: 'prono', options: [['prono', 'Prono'], ['supino', 'Supino']] },
    { id: 'trunk', label: 'Inclinación del tronco', min: -40, max: ROW_BAR.trunk, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada' : `${Math.abs(v)}° más ${v > 0 ? 'inclinado' : 'erguido'}` },
    { id: 'dest', label: 'Hacia dónde sube', min: -20, max: 8, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada (ombligo)' : `${Math.abs(v)} cm más hacia ${v < 0 ? 'el pecho' : 'la cadera'}` },
    { id: 'grip', label: 'Anchura de agarre', min: 0.85, max: 1.35, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}%` },
    { id: 'stance', label: 'Anchura de pies', min: 0.75, max: 1.4, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}%` },
    { id: 'toes', label: 'Rotación de pies', min: -15, max: 20, step: 1, def: 0, fmt: v => `${v > 0 ? '+' : ''}${v}° sobre la autorada` },
    { id: 'load', label: 'Carga', min: 0, max: 150, step: 5, def: 60, fmt: v => `${v}% del peso corporal` },
  ],
  // polea sentado (remo en polea): la pelvis en el asiento y los pies en la plataforma; los brazos tiran de un maneral unido por
  // un cable a la polea. Comparte con el remo los brazos (y con la bisagra las manos de referencia)
  cable: [
    { id: 'impl', label: 'Maneral', hide: ex => !!POSES.exercises[ex]?.meta?.hand || JALON(ex), def: 'triangulo', options: [['triangulo', 'Triángulo'], ['barra_recta', 'Barra recta'], ['cuerda', 'Cuerda']] },
    { id: 'gripType', label: 'Agarre (barra recta)', hide: ex => !!POSES.exercises[ex]?.meta?.hand || JALON(ex), def: 'prono', options: [['prono', 'Prono'], ['supino', 'Supino']] },
    { id: 'gripType', label: 'Agarre', hide: ex => !JALON(ex), def: 'prono', options: [['prono', 'Prono'], ['supino', 'Supino'], ['neutro', 'Neutro']] },   // jalón: elige la acción de su agarre (variantFor)
    { id: 'pulleyH', label: 'Altura de la polea', hide: JALON, min: -30, max: 80, step: 1, def: 0, fmt: v => `${Math.round((POSES.exercises[state.exId]?.meta?.pulley ? pulleyAt(state.exId, v).y : 0) * 100)} cm del suelo${v === 0 ? ' (en línea con el brazo)' : ''}` },
    // jalón (X03-22): la polea va por delante (la autorada, a unos 25 cm del eje de la persona); los brazos giran hacia ella como con «Altura de la polea»
    { id: 'pulleyF', label: 'Distancia de la polea', hide: ex => !JALON(ex), min: -12, max: 8, step: 1, def: 0, fmt: v => { const B = POSES.exercises[state.exId]?.start.bones, z = B ? (B['DEF-THIGH01.L'].p[2] + B['DEF-THIGH01.R'].p[2]) / 2 : 0;
      return `${Math.round((pulleyAt(state.exId, 0, v).z - z) * 100)} cm delante de la cadera${v === 0 ? ' (la autorada)' : ''}`; } },
    // inicio y final (X03-26): la inclinación ABSOLUTA del pecho (+ = hacia delante) al empezar y al acabar la repetición; su valor por defecto es el de la acción (se mide en
    // sus claves: `tiltKeys`). Los dos iguales = tronco quieto (sustituyen a «Inclinación» y «Balanceo»)
    { id: 'trunk0', label: 'Tronco al inicio', min: -25, max: 45, lim: ex => JALON(ex) ? [-16, 22] : [-25, 45], step: 1, defOf: ex => tiltKeys(ex)[0] / DEG, def: 0, fmt: v => trunkFmt(v, 0) },
    { id: 'trunk1', label: 'Tronco al final', min: -25, max: 45, lim: ex => JALON(ex) ? [-25, 14] : [-25, 45], step: 1, defOf: ex => tiltKeys(ex)[1] / DEG, def: 0, fmt: v => trunkFmt(v, 1) },
    // curvatura (X03-20): giro del pecho y la columna alta alrededor del eje lateral, tras la inclinación y antes de llevar las manos al maneral
    { id: 'curv', label: 'Curvatura del tronco', min: -15, max: 20, lim: ex => JALON(ex) ? [-15, 14] : [-15, 20], step: 1, def: 0, fmt: v => v === 0 ? 'la autorada' : v > 0 ? `${v}° más encorvado` : `${-v}° más erguido, sacando pecho` },
    // escápulas al inicio y al final (X03-26): 0 = como en la clave de final de la acción, 100 = como en la de inicio (jalón: 0 abajo, 100 arriba; remos: 0 retraídas, 100 protraídas)
    { id: 'scap0', label: 'Escápulas al inicio', min: 0, max: 120, step: 5, def: 100, fmt: v => scapFmt(v, 100) },
    { id: 'scap1', label: 'Escápulas al final', min: 0, max: 120, step: 5, def: 0, fmt: v => scapFmt(v, 0) },
    { id: 'dest', label: 'Hacia dónde tira', min: -20, max: 8, step: 1, def: 0, fmt: v => JALON(state.exId) ? (v === 0 ? 'la autorada' : `${Math.abs(v)} cm más hacia ${v < 0 ? 'la clavícula' : 'el esternón'}`)
      : v === 0 ? 'la autorada (ombligo)' : `${Math.abs(v)} cm más hacia ${v < 0 ? 'el pecho' : 'la cadera'}` },
    { id: 'knees', label: 'Flexión de rodilla', hide: JALON, min: -20, max: 50, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada' : `${v > 0 ? '+' : ''}${v}° (la pelvis se desliza por el asiento)` },
    { id: 'grip', label: 'Anchura de agarre (barra recta)', hide: ex => !!POSES.exercises[ex]?.meta?.hand || JALON(ex), min: 0.7, max: 1.6, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}%` },
    { id: 'grip', label: 'Anchura de agarre', hide: ex => !JALON(ex), min: 0.7, max: 1.4, step: 0.01, def: 1,
      // el límite es en distancia real, no en % de la acción (el 70 % del prono, que es ancho, seguía siendo muy separado): de 16 cm a 110 cm entre manos
      lim: ex => { const a = gripHalf(ex); return [Math.ceil(GRIP_HALF_MIN / a * 100) / 100, Math.floor(GRIP_HALF_MAX / a * 100) / 100]; },
      fmt: v => `${Math.round(v * 100)}% · ${Math.round(2 * v * gripHalf(state.exId) * 100)} cm entre manos` },   // jalón: las manos se deslizan por la barra
    { id: 'stance', label: 'Anchura de pies', min: 0.75, max: 1.6, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}%` },
    { id: 'wrist', label: 'Mano', hide: JALON, def: 'polea', options: [['polea', 'Hacia la polea'], ['autorada', 'La de Blender']] },
    { id: 'elbows', label: 'Codos', hide: JALON, min: -30, max: 45, step: 1, def: 0, fmt: v => v === 0 ? 'los del maneral' : `${Math.abs(v)}° más ${v > 0 ? 'abiertos' : 'pegados'}` },
    // jalón (X03-27): los codos al inicio y al final, que se suman al afinado `codos(s)` con un lerp suave
    ...[['elbows0', 'Codos al inicio'], ['elbows1', 'Codos al final']].map(([id, label]) => ({ id, label, hide: ex => !JALON(ex), min: -30, max: 45, step: 1, def: 0, fmt: v => v === 0 ? 'los autorados' : `${Math.abs(v)}° más ${v > 0 ? 'abiertos' : 'pegados'}` })),
    { id: 'bottom', label: 'Desde dónde empieza', min: 0, max: 60, step: 1, def: 0, fmt: v => v === 0 ? 'brazos estirados (la autorada)' : `${v}% del recorrido` },
    { id: 'top', label: 'Hasta dónde tira', min: 40, max: 100, step: 1, def: 100, fmt: v => v === 100 ? 'la autorada' : `${v}% del recorrido` },
    { id: 'load', label: 'Carga', min: 0, max: 150, step: 5, def: 60, fmt: v => `${v}% del peso corporal` },
  ],
  // colgado (dominada): el cuerpo cuelga de las manos; sin carga (el peso es el del cuerpo)
  hang: [
    { id: 'gripType', label: 'Agarre', def: 'prono', options: [['prono', 'Prono'], ['supino', 'Supino'], ['neutro', 'Neutro']] },
    { id: 'grip', label: 'Anchura de agarre', min: 0.75, max: 1.4, step: 0.01, def: 1, fmt: v => `${Math.round(v * 100)}% (el neutro va a la anchura de las asas)` },
    { id: 'top', label: 'Hasta dónde sube', min: 15, max: 100, step: 1, def: 100, fmt: v => v === 100 ? 'la autorada (barbilla sobre la barra)' : `${v}% del recorrido` },
    { id: 'bottom', label: 'Desde dónde baja', min: 0, max: 60, step: 1, def: 0, fmt: v => v === 0 ? 'colgado del todo' : `${v}% del recorrido (codos algo flexionados)` },
  ],
  // libre (X03-02): la animación de Blender tal cual, solo escalada por la altura del cliente. El único ajuste es la carga (X03-14): su valor por defecto
  // es el de la acción (`ff_carga_pc`) y solo sale si la acción lleva carga; no mueve la pose (dibuja los discos y pesa en la demanda)
  libre: [LOAD_LIBRE],
  // bases sobre `libre` (X03-07): la animación de Blender y, encima, los ajustes como diferencias; con todos en su valor por defecto sale la pose de Blender.
  // Sin `bottom` / `top` (recorrido): por ahora no (spec X03 §10.1).
  floor: [   // flexiones: manos y pies fijos en el suelo, el cuerpo gira sobre las puntas
    { id: 'hands', label: 'Anchura de manos', min: 70, max: 170, step: 1, def: 100, fmt: v => v === 100 ? 'la autorada' : `${v}%` },
    { id: 'handPos', label: 'Altura de las manos', min: -20, max: 25, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada' : `${Math.abs(v)} cm hacia ${v < 0 ? 'la cabeza' : 'la cadera'}` },
    { id: 'handRot', label: 'Rotación de las manos', min: -45, max: 45, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada (dedos hacia delante)' : `${Math.abs(v)}° dedos hacia ${v > 0 ? 'fuera' : 'dentro'}` },
    { id: 'push', label: 'Dirección de empuje', min: -5, max: 6, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada' : `abajo, hombros ${Math.abs(v)} cm más ${v > 0 ? 'adelante' : 'atrás'}` },   // ponytail: el tobillo de este maniquí está a ~10 cm de la punta, así que abajo el pie solo da ~6 cm de avance; la spec pedía +15
    { id: 'load', label: 'Lastre', min: 0, max: 100, step: 5, def: 0, fmt: v => `${v}% del peso corporal` },
  ],
  split: [   // búlgara: pie de delante en el suelo, el de atrás en el banco
    { id: 'stride', label: 'Largo de la zancada', min: -15, max: 20, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada' : `${Math.abs(v)} cm más ${v > 0 ? 'larga' : 'corta'}` },
    { id: 'benchH', label: 'Altura del banco', min: -20, max: 15, step: 1, def: 0, fmt: v => `${Math.round(benchTop(state.exId) + v)} cm del suelo${v === 0 ? ' (la autorada)' : ''}` },
    { id: 'trunk', label: 'Inclinación del tronco', min: -10, max: 25, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada' : `${Math.abs(v)}° más ${v > 0 ? 'adelante' : 'atrás'}` },
    { id: 'stance', label: 'Anchura de pies', min: 60, max: 200, step: 1, def: 100, fmt: v => v === 100 ? 'la autorada' : `${v}%` },
    LOAD_LIBRE,
  ],
  bench: [   // press de banca (carga en las manos) y hip thrust (carga en la cadera): cada ajuste sale según `meta.carga`
    { id: 'grip', label: 'Anchura de agarre', hide: ex => !CARGA(ex, 'manos'), min: 70, max: 160, step: 1, def: 100, fmt: v => v === 100 ? 'la autorada' : `${v}%` },
    { id: 'touch', label: 'Dónde toca la barra', hide: ex => !CARGA(ex, 'manos'), min: -6, max: 8, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada' : `${Math.abs(v)} cm hacia ${v < 0 ? 'la clavícula' : 'el abdomen'}` },
    { id: 'elbows', label: 'Codos', hide: ex => !CARGA(ex, 'manos'), min: -30, max: 30, step: 1, def: 0, fmt: v => v === 0 ? 'los autorados' : `${Math.abs(v)}° más ${v > 0 ? 'abiertos' : 'pegados'}` },
    { id: 'stance', label: 'Anchura de pies', hide: ex => !CARGA(ex, 'manos'), min: 60, max: 160, step: 1, def: 100, fmt: v => v === 100 ? 'la autorada' : `${v}%` },
    { id: 'feet', label: 'Distancia de los pies', hide: ex => !CARGA(ex, 'cadera'), min: -15, max: 25, step: 1, def: 0, fmt: v => v === 0 ? 'la autorada' : `${Math.abs(v)} cm más ${v > 0 ? 'lejos' : 'cerca'} del banco` },
    { id: 'stance', label: 'Anchura de pies', hide: ex => !CARGA(ex, 'cadera'), min: 60, max: 200, step: 1, def: 100, fmt: v => v === 100 ? 'la autorada' : `${v}%` },
    { id: 'benchH', label: 'Altura del banco', hide: ex => !CARGA(ex, 'cadera'), min: -10, max: 10, step: 1, def: 0, fmt: v => `${Math.round(benchTop(state.exId) + v)} cm del suelo${v === 0 ? ' (la autorada)' : ''}` },
    LOAD_LIBRE,
  ],
};
const PRESETS = {
  avg: { femur: 100, tibia: 100, torso: 100, dorsi: 35 },
  femur: { femur: 112, tibia: 98, torso: 95, dorsi: 35 },
  torso: { femur: 94, tibia: 100, torso: 110, dorsi: 35 },
  ankle: { femur: 100, tibia: 100, torso: 100, dorsi: 20 },
};
const PSET = ex => PARAMS[EXERCISES[ex].base];   // los ajustes de un ejercicio: los de su base
// rango de un ajuste: el suyo o, si lo recorta el ejercicio (`lim`: p. ej. el jalón no admite tanta inclinación sin perder la alineación), el de `lim`
// rango, valor por defecto y «oculto» de un ajuste: los del código (o, si lo recorta el ejercicio, `lim`) y, encima, los que el usuario fija en el afinado (X03-27, `rangos`), sin pasar de `lim`
function rangoOf(ex, p) {
  const lim = p.lim?.(ex) ?? [p.min, p.max], def = p.defOf ? p.defOf(ex) : p.def, rg = !p.options && AJ[actOf(ex)]?.rangos?.[p.id];   // el valor por defecto de `libre` lo dice la acción
  if (!rg) return { min: lim[0], max: lim[1], def, oculto: false };
  const min = rg.min ?? lim[0], max = Math.max(rg.max ?? lim[1], min);   // lo que escribe el usuario manda, también fuera de `lim` (el rango probado)
  return { min, max, def: clamp(rg.def ?? def, min, max), oculto: !!rg.oculto };
}
const prange = (ex, p) => { const r = rangoOf(ex, p); return [r.min, r.max]; };
const pdef = (ex, p) => rangoOf(ex, p).def;
const phide = (ex, p) => !!p.hide?.(ex) || rangoOf(ex, p).oculto;
const state = { exId: 'back_squat', per: {}, body: { height: 180, ...PRESETS.avg }, s: 1, playing: !matchMedia('(prefers-reduced-motion: reduce)').matches, heat: true, ref: false, allJoints: false, joint: null,
  lyRes: true, lySup: true, lyArm: true, lyBal: false, lyPath: false, lyNum: false };   // capas de fuerza (X03-17) y cifras (X03-18)
const EX = () => EXERCISES[state.exId], PRM = () => state.per[state.exId];
const isDefault = () => PSET(state.exId).every(p => PRM()[p.id] === pdef(state.exId, p)) && state.body.height === 180 && ['femur', 'tibia', 'torso'].every(k => state.body[k] === 100) && state.body.dorsi === 35;

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
  return { ...g, mfz, balance: Math.abs(F(phi, th)) };
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
function solveLimb(pose, auth, names, target, poleDir, lens, hingeRef) {   // hingeRef: bisagra autorada de referencia cuando la de la pose no es de fiar (brazo casi recto)
  const [u1, u2, l1, l2, end] = names;
  const A = pose[u1].p.clone();
  const aMid = auth[l1].p, aEnd = auth[end].p, aA = auth[u1].p;
  const aUp = aMid.clone().sub(aA), aLo = aEnd.clone().sub(aMid);
  let aHinge = aUp.clone().cross(aLo); if (aHinge.lengthSq() < 1e-8) aHinge = poleOf(aA, aMid, aEnd).cross(aEnd.clone().sub(aA));
  if (hingeRef) aHinge = hingeRef;
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
  // manerales de polea. triángulo: el de la acción (la mano tal cual, a la anchura de Blender) · barra recta: transversal, a
  // ±w × anchura, palmas abajo (o arriba en supino) · cuerda: asas verticales, palmas dentro, que se abren al tirar (half + spread × lo que ha tirado)
  triangulo:       { d: 0.03, fixed: true },
  barra_recta:     { d: 0.028, w: 0.24, palm: 'down' },
  cuerda:          { d: 0.032, vert: true, half: 0.06, spread: 0.10, palm: 'in' },
  asa:             { d: 0.03, fixed: true },   // remo a un brazo: el asa en D de la acción
  barra_jalon:     { d: 0.028, fixed: true },  // jalón (X03-20): la barra de la acción (meta.impl); no es una opción: solo para los datos de dibujo
};
// dominada: agarre supino (la palma hacia uno, misma barra; `roll`: la mano gira media vuelta sobre su eje antes de alinear
// el asa: girar 180° «lo mínimo» elige un eje cualquiera que cambia de un frame a otro) y neutro (asas paralelas, a ±25 cm, de delante a atrás)
const HANG_GRIP = { supino: { d: 0.028, palm: 'back', roll: Math.PI, elbow: 45 * DEG }, neutro: { d: 0.032, side: true, half: 0.25, palm: 'in', elbow: 35 * DEG } };
// eje del asa en el mundo para cada mano: transversal (barra), de delante a atrás (a los lados) o transversal girado `rot` con
// el lado del pulgar hacia delante (rotación externa)
const handleAxis = (I, sgn, barAxis = X) => I.side ? Z.clone() : I.vert ? Y.clone() : I.rot ? V(-sgn * Math.cos(I.rot), 0, Math.sin(I.rot)) : barAxis.clone();
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
    const look = I.palm || (I.side || I.vert ? 'in' : 'back');
    // hacia dónde mira la palma y, a igualdad, el que deja la mano apuntando como estaba (si no, el supino a veces le daba la vuelta)
    const score = (look === 'in' ? -sgn * pw.x : look === 'front' ? pw.z : look === 'down' ? -pw.y : look === 'up' ? pw.y : -pw.z) + 0.5 * V(0, 1, 0).applyQuaternion(q).dot(V(0, 1, 0).applyQuaternion(qA));
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
// recorte con frenada: en un extremo recortado la animación sigue en movimiento, así que se llega a él frenando (velocidad 0 en el
// corte) en vez de pararse en seco; en uno sin recortar, la animación ya frena sola (curvas de Blender) y se deja tal cual.
//   s -> [0, 1] con pendiente a al empezar y b al acabar (1 = sin tocar, 0 = frena)
const ramp = (s, a, b) => (s ** 3 - 2 * s * s + s) * a + (3 * s * s - 2 * s ** 3) + (s ** 3 - s * s) * b;
function hingeS(ex, s) { const c = hingeCut(ex), cut = c.sCut !== c.sB;
  return c.sB === 0 ? c.sCut + (1 - c.sCut) * ramp(s, cut ? 0 : 1, 1) : c.sCut * ramp(s, 1, cut ? 0 : 1); }
// ángulo autorado de la rodilla (muslo + tibia) en el punto bajo: el tope de «Flexión de rodilla» se cuenta desde él
const HKB = {};
const hingeKB = ex => HKB[ex] ??= withBody(DEFAULT_BODY, () => { const sB = hingeKeys(ex).sB, A = authoredPose(ex, sB), f = features(A, ex, sB); return f.beta + f.th; });
// sentadilla (X03-15): la tibia conserva el ritmo de Blender y solo se escala su recorrido. `th0` = tibia de pie, `FB`/`sB` = rasgos y s
// de la clave con la tibia más adelantada (el punto bajo); con ellos, el avance de la tibia en un frame es p = (F.th − th0) / (FB.th − th0)
const SREF = {};
const standRef = ex => SREF[ex] ??= withBody(DEFAULT_BODY, () => {
  const fs = keysOf(ex).map(k => ({ s: k.s, F: features(authoredPose(ex, k.s), ex, k.s) })), B = fs.reduce((a, x) => x.F.th > a.F.th ? x : a);
  return { th0: fs[0].F.th, sB: B.s, FB: B.F };
});
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

// remo: cuánto ha tirado (0 = brazos colgando en el frame 1, 1 = la barra en el tronco en el 30), por la distancia hombros→barra
// autorada. Abajo los brazos cuelgan (vertical); arriba la barra va con el tronco.
const ROWD = {};
const rowUp = (ex, F) => { const [a, b] = ROWD[ex] ??= withBody(DEFAULT_BODY, () => [0, 1].map(s => { const f = features(authoredPose(ex, s), ex, s); return f.bar.distanceTo(f.sh); }));
  return clamp((a - F.bar.distanceTo(F.sh)) / (a - b)); };
// codos por maneral (grados, + = abiertos y arriba): con agarre prono la mano solo va en línea con el antebrazo si el codo se abre
// (a la altura del pectoral, más o menos); supino y neutro, lo más pegados posible, como en la acción (0). Se aplica al empezar y se
// desvanece al tirar: al final la mano en el tronco ya deja el codo donde toca
const ELBOW_MAN = { barra_recta: 40 };
// maneral de polea (spec X02; blender/ejercicios/_manerales.py): el del implemento elegido (a un brazo, el asa en D; la barra
// recta supina tiene su propia mano). null si el .blend aún no lo tiene (se dibuja el esquemático)
function manData(ex) {
  if (JALON(ex)) return null;   // la barra del jalón es la de la acción: sin maneral del visor
  const prm = state.per[ex], one = POSES.exercises[ex].meta?.hand;
  const m = one ? 'asa' : prm.impl === 'barra_recta' && prm.gripType === 'supino' ? 'barra_supina' : prm.impl;
  const h = POSES.hands?.[m]; if (!h?.[one || 'L']?.maneral) return null;
  const side = S => { const e = h[S], relQ = new THREE.Quaternion(...e.maneral.q), ag = V(...e.agarre);
    return { relQ, relQi: relQ.clone().invert(), ag, hg: V(...e.maneral.p).add(ag.clone().applyQuaternion(relQ)),   // hg: agarre en los ejes de la mano
      fingers: Object.fromEntries(Object.entries(e.fingers).map(([n, q]) => [n, new THREE.Quaternion(...q)])) }; };
  return { m, mesh: h.malla, rigid: h.rigido !== false, bar: m.startsWith('barra'), L: side('L'), R: side('R') };
}
// polea: la de la acción (columna, a un lado) a la altura donde la corta la línea antebrazo -> maneral de la pose de inicio
// (la mano apunta a la polea): con los valores por defecto, el brazo y el cable quedan en línea con la animación del usuario
const PUL = {};
const pulleyOf = ex => PUL[ex] ??= (() => { const E = POSES.exercises[ex], P = V(...E.meta.pulley); if (JALON(ex)) return P;   // jalón: la polea alta, tal cual (sobre la barra)
  const B = E.start.bones, S = E.meta.hand, b = n => V(...B[n].p);
  const sh = S ? b(`DEF-FORARM01.${S}`) : b('DEF-FORARM01.L').add(b('DEF-FORARM01.R')).multiplyScalar(0.5), h = V(...E.start.bar.center);   // codo -> maneral
  P.y = Math.max(0.05, sh.y + (h.y - sh.y) * (P.z - sh.z) / (h.z - sh.z)); return P; })();
const pulleyAt = (ex, cm, cmF = 0) => { const P = pulleyOf(ex).clone(); P.y = Math.max(0.05, P.y + cm / 100); P.z += cmF / 100; return P; };   // «Altura de la polea» (sin bajar del suelo) y, en el jalón, «Distancia de la polea»
// escápulas (X03-23): giro de DEF-SHOULDER respecto al pecho y posición de su cabeza en los ejes del pecho ([q, v]), en la pose autorada y en
// las claves de inicio y final. La posición también se escala: la cabeza de la escápula se desplaza hasta 2 cm en los ejes del pecho
const scapRel = (P, S) => { const qi = P['DEF-CHEST'].q.clone().invert(); return [qi.clone().multiply(P[`DEF-SHOULDER.${S}`].q), P[`DEF-SHOULDER.${S}`].p.clone().sub(P['DEF-CHEST'].p).applyQuaternion(qi)]; };
const SCAPR = {};
const scapR = ex => SCAPR[ex] ??= withBody(DEFAULT_BODY, () => { const a = authoredPose(ex, 0), b = authoredPose(ex, 1); return Object.fromEntries(['L', 'R'].map(S => [S, [scapRel(a, S), scapRel(b, S)]])); });
// q^t: escala el ángulo sobre su eje (slerp con t > 1 no siempre extrapola)
const qPow = (q, t) => { const w = clamp(q.w, -1, 1), sn = Math.sqrt(1 - w * w); return sn < 1e-9 ? new THREE.Quaternion() : new THREE.Quaternion().setFromAxisAngle(V(q.x, q.y, q.z).multiplyScalar(Math.sign(w || 1) / sn), 2 * Math.acos(Math.abs(w)) * t); };
// ---- inicio y final de la base `cable` (X03-26): inclinación del pecho (+ = hacia delante) en las claves de una acción, y lo que lleva recorrido el pecho autorado entre las dos
const chestTilt = P => { const y = Y.clone().applyQuaternion(P['DEF-CHEST'].q); return Math.atan2(y.z, y.y); };
const TILT = {}, TILT_MIN = 1 * DEG;   // si la acción no mueve el tronco (menos de 1°), w = s suavizado
const tiltOf = ex => TILT[ex] ??= withBody(DEFAULT_BODY, () => [0, 1].map(s => chestTilt(authoredPose(ex, s))));
const tiltKeys = ex => tiltOf(VARIANT(ex) || ex);   // los valores por defecto de «Tronco al inicio / al final» son los de la acción base (las variantes comparten ajustes)
const trunkFmt = (v, i) => `${Math.round(Math.abs(v)) < 1 ? 'vertical' : `${Math.round(Math.abs(v))}° hacia ${v > 0 ? 'delante' : 'atrás'}`}${Math.abs(v - tiltKeys(state.exId)[i] / DEG) < 0.5 ? ' (la autorada)' : ''}`;
const scapFmt = (v, d) => { const J = JALON(state.exId), lo = J ? 'abajo' : 'retraídas', hi = J ? 'arriba' : 'protraídas'; return `${v === 0 ? lo : v === 100 ? hi : `${v}% hacia ${hi}`}${v === d ? ' (la autorada)' : ''}`; };
// el tronco en este frame con «Tronco al inicio / al final»: el pecho debe ir de `trunk0` a `trunk1` con el mismo ritmo (w) que el autorado, y cada hueso del tronco hace lo mismo que su
// recta de la acción (de su giro en la clave de inicio al de la de final, con el progreso w del pecho) más lo que la acción se sale de esa recta (la cabeza que cabecea, p. ej.). Devuelve el
// giro de mundo de cada hueso que no es pierna ni brazo, y el de los brazos con el pecho. Por defecto, nada. Si la acción no mueve el tronco (< 1°), un giro rígido `rigid` (rad)
const KEYQ = {}, legsOf = new Set([...subtree('DEF-THIGH01.L'), ...subtree('DEF-THIGH01.R')]), armsOf = new Set([...subtree('DEF-SHOULDER.L'), ...subtree('DEF-SHOULDER.R')]);
const keyQ = ex => KEYQ[ex] ??= withBody(DEFAULT_BODY, () => [0, 1].map(s => { const A = authoredPose(ex, s); return Object.fromEntries(BN.map(n => [n, A[n].q.clone()])); }));
function trunkQ(ex, prm, A, s) {
  const [t0, t1] = tiltOf(ex), [d0, d1] = tiltKeys(ex), mv = Math.abs(t1 - t0) >= TILT_MIN, w = mv ? (chestTilt(A) - t0) / (t1 - t0) : s * s * (3 - 2 * s);
  const dT = (prm.trunk0 * DEG - d0) * (1 - w) + (prm.trunk1 * DEG - d1) * w + (fineAt(ex, prm, s).tronco || 0) * DEG;   // lo que el pecho se aparta del autorado (+ el afinado «Tronco · Inclinación», X03-28)
  if (Math.abs(dT) < 1e-9) return {};
  if (!mv) return { rigid: dT };
  const [K0, K1] = keyQ(ex), w2 = w + dT / (t1 - t0), q = {}, line = (n, t) => slerpX(K0[n], K1[n], t);
  for (const n of BN) if (!legsOf.has(n) && !armsOf.has(n)) q[n] = A[n].q.clone().multiply(line(n, w).invert()).multiply(line(n, w2));
  const dC = q['DEF-CHEST'].clone().multiply(A['DEF-CHEST'].q.clone().invert());
  for (const n of armsOf) q[n] = dC.clone().multiply(A[n].q);
  return { q };
}
// escápula de este frame con «Escápulas al inicio / al final»: u = lo que le queda por recorrer (1 al inicio, 0 al final); lo que la acción se sale de la recta se conserva
const slerpX = (a, b, t) => a.clone().multiply(qPow(a.clone().invert().multiply(b), t));   // como slerp, pero extrapola con t > 1
const qAng = (a, b) => 2 * Math.acos(clamp(Math.abs(a.dot(b)), 0, 1));
function scapAt(ex, prm, A, S, s) {
  const fe = (fineAt(ex, prm, s).escap || 0) / 100;   // afinado «Escápulas · Subir / bajar» (X03-28): se suma al progreso u'
  const [[q0, v0], [q1, v1]] = scapR(ex)[S], [r, v] = scapRel(A, S), d01 = qAng(q0, q1), dv = v0.distanceTo(v1);
  const sm = 1 - s * s * (3 - 2 * s), uq = d01 > 0.01 ? qAng(r, q1) / d01 : sm, uv = dv > 0.002 ? v.clone().sub(v1).dot(v0.clone().sub(v1)) / (dv * dv) : sm;   // lo que le queda por recorrer, por el giro y por la posición
  const to = u => prm.scap1 / 100 + (prm.scap0 - prm.scap1) / 100 * u + fe, lv = t => v1.clone().lerp(v0, t);
  return [r.clone().multiply(slerpX(q1, q0, uq).invert()).multiply(slerpX(q1, q0, to(uq))), v.sub(lv(uv)).add(lv(to(uv)))];
}
// ---- jalón sobre Blender, con reglas de mano, muñeca y codo (X03-26)
// R1 la barra en el hueco de la mano · R2 la mano gira alrededor de la barra con el antebrazo · R3 el codo va donde alinea el antebrazo con el cable (visto de lado) · R4 el recorrido acaba donde se pierde la alineación
const ALIGN_TOL = 15 * DEG, JAL_IT = 8, JAL_RELAX = 0.6, JAL_EPS = 0.1;   // vueltas de R2 y cuánto se avanza hacia el punto fijo en cada una
const wrapA = x => Math.atan2(Math.sin(x), Math.cos(x));
const psiOf = (d, a) => { const e1 = Y.clone().addScaledVector(a, -a.y).normalize(); return Math.atan2(d.dot(a.clone().cross(e1)), d.dot(e1)); };   // ángulo de d alrededor de a (proyectado en el plano perpendicular a a)
const sagAng = (a, b) => Math.abs(wrapA(Math.atan2(a.z, a.y) - Math.atan2(b.z, b.y)));   // ángulo entre a y b visto de lado (plano YZ)
const swivel = (ax, v) => { const ref = X.clone().addScaledVector(ax, -ax.x).normalize(), p = v.clone().addScaledVector(ax, -v.dot(ax)); return Math.atan2(ax.dot(ref.clone().cross(p)), ref.dot(p)); };   // giro de v alrededor de ax, medido desde X
const elbowAng = (Sh, W, c, Lf) => {   // R3: giro, alrededor de hombro→muñeca, del codo «de regla» (E* = W − Lf·c: antebrazo en la línea del cable) y cuánto se aparta de la línea
  const u = W.clone().sub(Sh).normalize(), v = W.clone().addScaledVector(c, -Lf).sub(Sh);
  return { phi: swivel(u, v), r: v.addScaledVector(u, -v.dot(u)).length() };
};
const JAL = {};
// el codo «estable al empezar» (X03-27): mientras el brazo está casi recto (el codo se separa de la línea hombro→muñeca menos de ELBOW_DEF antebrazos) su giro no está definido y pivotaría;
// se usa el del primer instante de la acción en que ya lo está (`sc`, por bisección sobre la pose autorada) y su giro `th` (swivel), una vez por acción y lado
const ELBOW_DEF = 0.25, STAB_FADE = 0.15, smooth01 = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const elbowSep = (A, S) => { const Sh = A[`DEF-ARM01.${S}`].p, E = A[`DEF-FORARM01.${S}`].p, W = A[`DEF-HAND.${S}`].p, u = W.clone().sub(Sh).normalize(), v = E.clone().sub(Sh); return v.addScaledVector(u, -v.dot(u)).length() / E.distanceTo(W); };
const stablePole = (ax, th) => X.clone().addScaledVector(ax, -ax.x).normalize().applyAxisAngle(ax, th);   // el polo con ese giro (inverso de `swivel`)
function elbowStable(ex, S) {
  const f = s => elbowSep(authoredPose(ex, s), S); let i = 0;
  while (i <= 60 && f(i / 60) < ELBOW_DEF) i++;
  if (i === 0 || i > 60) return null;   // ya definido al empezar, o nunca
  let lo = (i - 1) / 60, hi = i / 60; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if (f(m) < ELBOW_DEF) lo = m; else hi = m; }
  const A = authoredPose(ex, hi), Sh = A[`DEF-ARM01.${S}`].p, E = A[`DEF-FORARM01.${S}`].p, W = A[`DEF-HAND.${S}`].p;
  return { sc: hi, th: swivel(W.clone().sub(Sh).normalize(), poleOf(Sh, E, W)) };
}
const jalonData = ex => JAL[ex] ??= withBody(DEFAULT_BODY, () => {   // por mano: el hueco (en los ejes de la mano) de la clave de final, donde la barra está bien envuelta; dónde agarra a lo largo de la barra (clave de inicio); el eje del puño; el alcance al inicio
  const E = POSES.exercises[ex], A0 = authoredPose(ex, 0), A1 = authoredPose(ex, 1), b0 = V(...E.start.bar.center), b1 = V(...E.end.bar.center), side = {};
  for (const S of ['L', 'R']) { const hn = `DEF-HAND.${S}`;
    const hollow = b1.clone().add(V(gripOf(A1, S).x - b1.x, 0, 0)).sub(A1[hn].p).applyQuaternion(A1[hn].q.clone().invert()), axis = V(...POSES.hands['28'][S].hollow.axis).normalize();
    // palm: hacia dónde está la barra respecto al hueso (en los ejes de la mano), perpendicular a la mano (Y) y al eje de agarre; es la normal de la palma (X03-28)
    const palm = axis.clone().cross(Y).normalize(); if (palm.dot(hollow) < 0) palm.negate();
    side[S] = { hollow, along: gripOf(A0, S).x - b0.x, axis, palm, R0: A0[hn].p.distanceTo(A0[`DEF-ARM01.${S}`].p), stab: elbowStable(ex, S) }; }
  return { side };
});
// el hueco de la mano con el afinado «Barra en la mano» (X03-28): `dedos` (+ hacia los dedos) y `palma` (+ más dentro de la palma), en metros, medidos en el mundo
const hollowFine = (jd, dedos = 0, palma = 0, k = K()) => jd.hollow.clone().addScaledVector(Y, dedos / k).addScaledVector(jd.palm, -palma / k);
const hollowAt = (ex, P, S, dedos = 0, palma = 0) => P[`DEF-HAND.${S}`].p.clone().add(hollowFine(jalonData(ex).side[S], dedos, palma).multiplyScalar(K()).applyQuaternion(P[`DEF-HAND.${S}`].q));   // el punto de la barra que la mano tiene en el hueco
// medidas del resultado frente a la acción en el mismo s: exceso de ángulo antebrazo–cable (R4) y cuánto se aparta la muñeca (hand–antebrazo alrededor del eje del puño)
function jalonAlign(ex, P, bar, A, barA, pulley, pulleyA, mun) {   // mun: la flexión de muñeca afinada (rad); la muñeca se mide contra «alineada + afinado»
  const jd = jalonData(ex), out = { excess: -Infinity, wrist: 0 };
  for (const [S, sgn] of [['L', 1], ['R', -1]]) { const f = (Q, b, pu) => { const e = Q[`DEF-FORARM01.${S}`].p, w = Q[`DEF-HAND.${S}`].p, f = w.clone().sub(e), a = jd.side[S].axis.clone().applyQuaternion(Q[`DEF-HAND.${S}`].q);
      return { d: sagAng(f, pu.clone().sub(b)), rel: wrapA(psiOf(Y.clone().applyQuaternion(Q[`DEF-HAND.${S}`].q), a) - psiOf(f, a)) }; };
    const a = f(P, bar, pulley), b = f(A, barA, pulleyA); out.excess = Math.max(out.excess, a.d - b.d); out.wrist = Math.max(out.wrist, Math.abs(wrapA(a.rel + sgn * mun))); }   // la flexión en espejo: el signo del lado
  return out;
}
// la mano de la biblioteca de la acción (`meta.mano`, X03-28): los giros de sus dedos respecto a la mano, por lado; null si la acción no la tiene o no está posada en la biblioteca (colgado_neutro)
const LIBH = {};
const libraryHand = ex => LIBH[ex] ??= (() => { const h = POSES.hands?.[POSES.exercises[ex]?.meta?.mano]; if (!h) return null;
  return Object.fromEntries(['L', 'R'].map(S => [S, Object.fromEntries(Object.entries(h[S].fingers).map(([n, q]) => [n, new THREE.Quaternion(...q)]))])); })();
const ROW_SUP_ELBOW = 30 * DEG;   // remo supino sin su acción: los codos más pegados al cuerpo
// remo con barra: hasta dónde llega la animación (s) para que el codo no pase de ROW_BAR.elbow (ni del autorado al final, si es
// mayor: por defecto, la pose de Blender). Bisección sobre evaluateRaw, una vez por cuerpo y ajustes; el codo crece con s.
const RCUT = {};
function rowCut(ex) {
  const prm = state.per[ex], k = ex + JSON.stringify(state.body) + JSON.stringify(prm);
  if (k in RCUT) return RCUT[k];
  if ((prm.impl || 'barra') !== 'barra') return (RCUT[k] = 1);
  const B = POSES.exercises[ex].end.bones, P = n => V(...B[n].p), elEnd = 180 - P('DEF-ARM01.L').sub(P('DEF-FORARM01.L')).angleTo(P('DEF-HAND.L').sub(P('DEF-FORARM01.L'))) / DEG;
  const el = s => evaluateRaw(ex, s).elbow, cap = Math.max(ROW_BAR.elbow, elEnd + 0.5);
  if (el(1) <= cap) return (RCUT[k] = 1);
  let lo = 0, hi = 1; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (el(m) < cap) lo = m; else hi = m; }
  return (RCUT[k] = (lo + hi) / 2);
}

/* ---------------- Demanda: momentos por articulación ---------------- */
// Estática inversa sobre la pose final (spec X03 §14): cuasi-estática, sin inercias. Fuerzas en pesos corporales (PC), longitudes en m,
// momentos en PC·m. Da momentos netos por articulación (física); el paso a músculo es un reparto por convención (tabla de `demand`).
// Ejes glTF: Y arriba, +Z delante, +X a la izquierda del maniquí.
// Partes del cuerpo: masa (fracción del peso) y centro de masas. pelvis + trunkUp = el tronco único de comOffset.
function bodyParts(P) {
  const p = n => P[n].p, hip = midOf(P, 'DEF-THIGH01.L', 'DEF-THIGH01.R'), sh = midOf(P, 'DEF-ARM01.L', 'DEF-ARM01.R');
  const along = (n, l) => p(n).clone().add(V(0, l * K(), 0).applyQuaternion(P[n].q)), at = (a, b, t) => p(a).clone().lerp(p(b), t);
  const parts = [{ id: 'pelvis', m: 0.1117, c: hip.clone().lerp(sh, 0.12) }, { id: 'trunkUp', m: 0.3229, c: hip.clone().lerp(sh, 0.6315) },
    { id: 'head', m: 0.0694, c: along('DEF-HEAD', 0.1) }];
  for (const S of ['L', 'R']) parts.push(
    { id: 'armU.' + S, m: 0.0271, c: at(`DEF-ARM01.${S}`, `DEF-FORARM01.${S}`, 0.577) }, { id: 'armF.' + S, m: 0.0162, c: at(`DEF-FORARM01.${S}`, `DEF-HAND.${S}`, 0.457) },
    { id: 'hand.' + S, m: 0.0061, c: along(`DEF-HAND.${S}`, 0.05) }, { id: 'thigh.' + S, m: 0.1416, c: at(`DEF-THIGH01.${S}`, `DEF-SHIN01.${S}`, 0.41) },
    { id: 'shank.' + S, m: 0.0433, c: at(`DEF-SHIN01.${S}`, `DEF-FOOT.${S}`, 0.44) }, { id: 'foot.' + S, m: 0.0137, c: at(`DEF-FOOT.${S}`, `DEF-TOE.${S}`, 0.4) });
  return parts;
}
// Ejes del cuerpo (§14.6): pelvis (xP, nP) y tronco (xT, uT, nT = delante); `hip` = punto medio de las caderas
function ejesCuerpo(P) {
  const n = (p, q) => P[p].p.clone().sub(P[q].p).normalize(), hip = midOf(P, 'DEF-THIGH01.L', 'DEF-THIGH01.R'), sh = midOf(P, 'DEF-ARM01.L', 'DEF-ARM01.R');
  const a = { hip, xP: n('DEF-THIGH01.L', 'DEF-THIGH01.R'), xT: n('DEF-ARM01.L', 'DEF-ARM01.R'), uT: sh.clone().sub(hip).normalize() };
  a.nT = a.xT.clone().cross(a.uT); a.nP = a.xP.clone().cross(a.uT);
  return a;
}
// Ángulos anatómicos en grados (X03-18, spec §22): 0 = posición anatómica (de pie, piernas rectas, brazos colgando), nunca la pose de Blender.
// Las piernas y la columna del reposo del rig ya son la anatómica, así que ahí se mide la DIFERENCIA con el mismo ángulo en el reposo (`REST_ANG`);
// el hombro se mide con vectores contra el tronco (en el reposo los brazos van en cruz: abd = 90°). Claves por lado: `knee.flex.L`…; `lumbar.flex` sin lado.
const angulos = P => {
  const d = (a, b) => P[b].p.clone().sub(P[a].p), at = (u, v) => u.angleTo(v) / DEG, e = ejesCuerpo(P);
  const u = P['DEF-SPINE01'].p.clone().sub(e.hip).normalize(), f = e.xP.clone().cross(u), w = d('DEF-SPINE01', 'DEF-CHEST'), o = {};   // u: eje de la pelvis; f: delante
  for (const S of ['L', 'R']) {
    const sg = S === 'L' ? 1 : -1, th = `DEF-THIGH01.${S}`, sn = `DEF-SHIN01.${S}`, ft = `DEF-FOOT.${S}`, ar = `DEF-ARM01.${S}`, fa = `DEF-FORARM01.${S}`, t = d(th, sn), h = d(ar, fa);
    o[`knee.flex.${S}`] = at(t, d(sn, ft)); o[`elbow.flex.${S}`] = at(h, d(fa, `DEF-HAND.${S}`)); o[`ankle.dorsi.${S}`] = at(d(ft, sn), d(ft, `DEF-TOE.${S}`));
    o[`hip.flex.${S}`] = Math.atan2(t.dot(f), -t.dot(u)) / DEG; o[`hip.abd.${S}`] = Math.atan2(sg * t.dot(e.xP), Math.hypot(t.dot(f), t.dot(u))) / DEG;   // fuera del plano sagital (con el muslo flexionado más de 90° la fórmula con −t·u se disparaba)
    o[`shoulder.flex.${S}`] = Math.atan2(h.dot(e.nT), -h.dot(e.uT)) / DEG; o[`shoulder.abd.${S}`] = Math.atan2(sg * h.dot(e.xT), -h.dot(e.uT)) / DEG;
  }
  o['lumbar.flex'] = Math.atan2(w.dot(f), w.dot(u)) / DEG;
  return o;
};
const REST_ANG = angulos(REST);
function anatomia(P) {
  const a = angulos(P), o = {};
  // hombro: sin restar el reposo; con el brazo por encima de la cabeza el ángulo pasa de 180° a −180°, así que se mide en (−90°, 270°]
  for (const k in a) o[k] = k.startsWith('shoulder') ? (a[k] < -90 ? a[k] + 360 : a[k]) : k.startsWith('ankle') ? REST_ANG[k] - a[k] : a[k] - REST_ANG[k];
  return o;
}
// Cómo se apoya cada base: `cargas` (fuerzas externas de la carga) y, o bien `vert` (grupos de apoyos verticales: el suelo o la barra,
// que empujan solo hacia arriba y se calculan), o bien `fijo` (partes apoyadas en algo fijo: asiento, respaldo, plataforma; su fuerza
// es desconocida y solo impide medir desde ese lado). Si hay algún apoyo fijo, todos los apoyos de la base se tratan como fijos.
const footPt = (P, S) => P[`DEF-FOOT.${S}`].p.clone().lerp(P[`DEF-TOE.${S}`].p, 0.4);
const SUPPORTS = (() => {
  const pies = P => [['L', 'R'].map(S => ({ p: footPt(P, S), part: 'foot.' + S, emax: 0.10 * K() }))];
  const manos = P => ['L', 'R'].map(S => ({ p: gripOf(P, S), part: 'hand.' + S, emax: 0 }));
  const enManos = (P, L) => ['L', 'R'].map(S => ({ p: gripOf(P, S), f: V(0, -L / 2, 0), part: 'hand.' + S, tipo: 'carga' }));
  const libre = (P, ex, out, L) => { const m = POSES.exercises[ex].meta; return m.apoyos ? parseSupports(m.apoyos, m.carga)(P, out, L) : null; };
  return {
    stand: (P, ex, out, L) => ({ cargas: [{ p: out.bar.center.clone(), f: V(0, -L, 0), part: 'trunkUp', tipo: 'carga' }], vert: pies(P) }),
    hinge: (P, ex, out, L) => ({ cargas: enManos(P, L), vert: pies(P) }),
    row: (P, ex, out, L) => ({ cargas: enManos(P, L), vert: pies(P) }),
    hang: P => ({ cargas: [], vert: [manos(P)] }),
    cable: (P, ex, out, L) => {
      const dir = out.pulley.clone().sub(out.maneral?.hook || out.bar.center).normalize(), one = POSES.exercises[ex].meta?.hand, lados = one ? [one] : ['L', 'R'];
      return { cargas: lados.map(S => ({ p: gripOf(P, S), f: dir.clone().multiplyScalar(L / lados.length), part: 'hand.' + S, tipo: 'carga' })), fijo: ['pelvis', 'foot.L', 'foot.R', ...(JALON(ex) ? ['thigh.L', 'thigh.R'] : [])] };   // jalón: los muslos, bajo el rodillo
    },
    libre: libre, split: libre, bench: libre,   // sin apoyos declarados: sin demanda
    // flexiones: además, el lastre (% del peso) como una carga vertical sobre el tronco (sin dibujo)
    floor: (P, ex, out, L) => { const r = libre(P, ex, out, L); if (r && L) r.cargas.push({ p: midOf(P, 'DEF-THIGH01.L', 'DEF-THIGH01.R').lerp(midOf(P, 'DEF-ARM01.L', 'DEF-ARM01.R'), 0.63), f: V(0, -L, 0), part: 'trunkUp', tipo: 'carga' }); return r; },
    seat: (P, ex, out, L) => {
      const dir = out.F.plateTravel.clone().normalize(); if (dir.dot(midOf(P, 'DEF-THIGH01.L', 'DEF-THIGH01.R').sub(out.plate)) < 0) dir.negate();   // de la plataforma a la cadera
      return { cargas: ['L', 'R'].map(S => ({ p: footPt(P, S), f: dir.clone().multiplyScalar(L / 2), part: 'foot.' + S, tipo: 'carga' })), fijo: ['pelvis', 'trunkUp'] };
    },
  };
})();
// Apoyos y carga declarados en la acción `libre` (X03-14, `ff_apoyos` y `ff_carga`) -> la misma estructura que SUPPORTS: (P, out, L) => { cargas, vert | fijo, nombres }.
// Grupos separados por `;` y puntos de un grupo por `+`. Verticales: pie.L, pie.R, mano.L, mano.R, hombros. Fijos: asiento (pelvis), banco (pelvis y tronco), plataforma (pies).
// Con algún apoyo fijo todos se tratan como fijos (§14.4). Carga: tronco · manos · mano.L · mano.R · cadera · ninguna.
const FIJOS = { asiento: ['pelvis'], banco: ['pelvis', 'trunkUp'], plataforma: ['foot.L', 'foot.R'] };
function parseSupports(texto, carga = 'ninguna') {
  const grupos = texto.split(';').map(g => g.split('+').map(x => x.trim()));
  return (P, out, L) => {
    const pt = n => { const [k, S] = n.split('.');
      return k === 'pie' ? { kind: k, p: footPt(P, S), part: 'foot.' + S, emax: 0.10 * K() } : k === 'mano' ? { kind: k, p: gripOf(P, S), part: 'hand.' + S, emax: 0 }
        : { kind: 'hombros', p: midOf(P, 'DEF-ARM01.L', 'DEF-ARM01.R'), part: 'trunkUp', emax: 0.10 * K() }; };
    const bar = out.bar?.center, f = V(0, -L, 0), cargas = carga === 'tronco' ? [{ p: bar.clone(), f, part: 'trunkUp', tipo: 'carga' }] : carga === 'cadera' ? [{ p: bar.clone(), f, part: 'pelvis', tipo: 'carga' }]
      : carga === 'manos' ? ['L', 'R'].map(S => ({ p: gripOf(P, S), f: V(0, -L / 2, 0), part: 'hand.' + S, tipo: 'carga' }))
      : carga.startsWith('mano.') ? [{ p: gripOf(P, carga.slice(5)), f, part: 'hand.' + carga.slice(5), tipo: 'carga' }] : [];
    if (grupos.flat().some(n => FIJOS[n])) return { cargas, fijo: [...new Set(grupos.flat().flatMap(n => FIJOS[n] || [pt(n).part]))] };
    const vert = grupos.map(g => g.map(pt)), kind = G => G[0].kind;
    // nombres para el panel: dos pies sueltos = «pie delantero» (el de más z) y «pie trasero»; si no, el tipo en plural
    const nombres = vert.map(G => ({ pie: 'pies', mano: 'manos', hombros: 'hombros' }[kind(G)]));
    if (vert.length === 2 && vert.every(G => G.length === 1 && G[0].kind === 'pie')) { const d = vert[0][0].p.z >= vert[1][0].p.z; nombres[0] = d ? 'pie delantero' : 'pie trasero'; nombres[1] = d ? 'pie trasero' : 'pie delantero'; }
    return { cargas, vert, nombres };
  };
}
// Reparto entre apoyos verticales (§14.5): la reacción total iguala el peso y pasa por la vertical del centro de masas.
// Un grupo de dos puntos: reparto por cercanía y, lo que sobra en perpendicular, se corrige moviendo el apoyo dentro del pie.
// Con dos grupos (X03-21) el suelo o el banco también pueden empujar en horizontal por rozamiento: `h` es esa fuerza (en PC; +h·d sobre el grupo B y −h·d sobre el A, repartida
// a partes iguales entre sus puntos) y `g` la geometría de geoDos. Con h = 0 es el reparto de siempre.
function apoyosVerticales(forces, grupos, h = 0, g = null) {
  let Rtot = 0, cx = 0, cz = 0;
  for (const f of forces) { Rtot -= f.f.y; cx -= f.f.y * f.p.x; cz -= f.f.y * f.p.z; }
  cx /= Rtot; cz /= Rtot;
  const res = [], put = (pt, R, e) => res.push({ p: pt.p.clone().add(e), f: V(0, R, 0), part: pt.part, tipo: 'apoyo' });
  if (grupos.length === 2 && h) {
    const NB = g.nb0 + g.nb1 * h, hv = g.d.clone().multiplyScalar(h);
    grupos.forEach((G, i) => G.forEach(q => res.push({ p: q.p.clone(), f: V(hv.x * (i ? 1 : -1) / G.length, (i ? NB : g.Rtot - NB) / G.length, hv.z * (i ? 1 : -1) / G.length), part: q.part, tipo: 'apoyo' })));
  } else if (grupos.length === 2) {
    const g = grupos.map(G => [G.reduce((s, q) => s + q.p.x, 0) / G.length, G.reduce((s, q) => s + q.p.z, 0) / G.length]);
    const dx = g[1][0] - g[0][0], dz = g[1][1] - g[0][1], t = clamp(((cx - g[0][0]) * dx + (cz - g[0][1]) * dz) / (dx * dx + dz * dz));
    grupos.forEach((G, i) => G.forEach(q => put(q, (i ? t : 1 - t) * Rtot / G.length, V())));
  } else {
    const [a, b] = grupos[0], ab = b ? [b.p.x - a.p.x, b.p.z - a.p.z] : [0, 0], l2 = ab[0] * ab[0] + ab[1] * ab[1];
    const u = !b ? 0 : l2 < 1e-8 ? 0.5 : clamp(((cx - a.p.x) * ab[0] + (cz - a.p.z) * ab[1]) / l2);
    const e = V(cx - (a.p.x + u * ab[0]), 0, cz - (a.p.z + u * ab[1])); if (e.length() > a.emax) e.setLength(a.emax);
    put(a, b ? (1 - u) * Rtot : Rtot, e); if (b) put(b, u * Rtot, e);
  }
  return res;
}
// Dos grupos de apoyo con fuerzas externas verticales (X03-21): A = grupos[0], B = grupos[1], d = dirección horizontal de A a B, Rtot = reacción vertical total y
// NB(h) = nb0 + nb1·h la reacción vertical de B cuando además hay una fuerza horizontal h·d sobre B y −h·d sobre A (momentos respecto a A). Con h = 0 es el reparto clásico.
function geoDos(forces, grupos) {
  const c = G => G.reduce((a, q) => a.add(q.p), V()).divideScalar(G.length), A = c(grupos[0]), B = c(grupos[1]), d = V(B.x - A.x, 0, B.z - A.z), Lh = d.length();
  if (Lh < 1e-4) return null;
  d.divideScalar(Lh); let Rtot = 0, su = 0;
  for (const f of forces) { Rtot -= f.f.y; su -= f.f.y * ((f.p.x - A.x) * d.x + (f.p.z - A.z) * d.z); }
  return { d, Rtot, nb0: su / Lh, nb1: (B.y - A.y) / Lh };
}
// Rozamiento: |h| <= MU_ROZ·min(NA, NB) con las dos reacciones >= 0; cada desigualdad es lineal en h (a·h + b >= 0). Devuelve [mín, máx] o null si h = 0 no cabe
// (el centro de masas queda fuera de los apoyos: se queda el reparto clásico). ponytail: un solo MU_ROZ para suelo y banco; si un apoyo es de goma o el banco es de piel, se separa.
const MU_ROZ = 0.6;
function limitesH({ Rtot, nb0, nb1 }) {
  let lo = -Infinity, hi = Infinity;
  for (const [a, b] of [[MU_ROZ * nb1 - 1, MU_ROZ * nb0], [MU_ROZ * nb1 + 1, MU_ROZ * nb0], [-MU_ROZ * nb1 - 1, MU_ROZ * (Rtot - nb0)], [-MU_ROZ * nb1 + 1, MU_ROZ * (Rtot - nb0)]]) {
    if (Math.abs(a) < 1e-12) { if (b < 0) return null; } else if (a > 0) lo = Math.max(lo, -b / a); else hi = Math.min(hi, -b / a);
  }
  return lo <= 0 && hi >= 0 ? [lo, hi] : null;
}
// destino de una fuerza de apoyo inclinada, con el nombre del otro grupo (el hombro-banco se dice «el banco»)
const HACIA = { pies: 'los pies', manos: 'las manos', hombros: 'el banco', 'pie delantero': 'el pie delantero', 'pie trasero': 'el pie trasero' };
const haciaTxt = (otro, acerca) => acerca ? `hacia ${HACIA[otro]}` : `alejándose ${('de ' + HACIA[otro]).replace('de el ', 'del ')}`;
// Capacidades por lado (PC·m, × K()): las cuatro primeras salen de las de solveStand; las demás, de partida.
// Calibración (prueba 2 de tests/demand.js, contra el modelo de cuatro masas anterior): CAP.knee 0.20 -> 0.23 y CAP.hip 0.275 -> 0.20.
const CAP = { knee: 0.23, hip: 0.20, hipFrontal: 0.15, ankle: 0.11, lumbar: 0.50, shoulder: 0.12, elbow: 0.08 };
// Articulaciones (§14.6): `S` = tiene lado L y R · `J` punto · `dist` partes del lado distal · `cap` capacidad de cada componente ·
// `comp` componentes con signo a partir del momento M y los ejes del cuerpo `a` (positivo = lo que dice el nombre).
const JOINTS = [
  { id: 'ankle', S: 1, J: (P, S) => P[`DEF-FOOT.${S}`].p, dist: S => [`foot.${S}`], cap: { plantar: 'ankle' }, comp: (M, a) => ({ plantar: -M.dot(a.xP) }) },
  { id: 'knee', S: 1, J: (P, S) => P[`DEF-SHIN01.${S}`].p, dist: S => [`shank.${S}`, `foot.${S}`], cap: { ext: 'knee' },
    comp: (M, a, S, P) => { const h = P[`DEF-THIGH01.${S}`].p, k = P[`DEF-SHIN01.${S}`].p, t = P[`DEF-FOOT.${S}`].p, kS = k.clone().sub(h).cross(t.clone().sub(k));
      return { ext: M.dot(kS.length() < 1e-4 ? a.xP : kS.normalize()) }; } },
  { id: 'hip', S: 1, J: (P, S) => P[`DEF-THIGH01.${S}`].p, dist: S => [`thigh.${S}`, `shank.${S}`, `foot.${S}`], cap: { ext: 'hip', add: 'hipFrontal' },
    comp: (M, a, S) => ({ ext: -M.dot(a.xP), add: (S === 'L' ? 1 : -1) * M.dot(a.nP) }) },
  { id: 'lumbar', J: (P, S, a) => a.hip.clone().addScaledVector(a.uT, 0.10 * K()), cap: { ext: 'lumbar' },
    dist: () => ['trunkUp', 'head', 'armU.L', 'armU.R', 'armF.L', 'armF.R', 'hand.L', 'hand.R'], comp: (M, a) => ({ ext: M.dot(a.xT) }) },
  { id: 'shoulder', S: 1, J: (P, S) => P[`DEF-ARM01.${S}`].p, dist: S => [`armU.${S}`, `armF.${S}`, `hand.${S}`], cap: { flex: 'shoulder', add: 'shoulder', hadd: 'shoulder' },
    comp: (M, a, S) => { const sg = S === 'L' ? 1 : -1; return { flex: M.dot(a.xT), add: sg * M.dot(a.nT), hadd: sg * M.dot(a.uT) }; } },
  { id: 'elbow', S: 1, J: (P, S) => P[`DEF-FORARM01.${S}`].p, dist: S => [`armF.${S}`, `hand.${S}`], cap: { flex: 'elbow' },
    comp: (M, a, S, P) => { const s = P[`DEF-ARM01.${S}`].p, e = P[`DEF-FORARM01.${S}`].p, w = P[`DEF-HAND.${S}`].p, eS = e.clone().sub(s).cross(w.clone().sub(e));
      return { flex: -M.dot(eS.length() < 1e-4 ? a.xT.clone().negate() : eS.normalize()) }; } },
];
// P: pose final · ex: id de la acción · out: lo que devuelve evaluateInner (bar, pulley, maneral, plate, F…)
// -> { forces: [{ p, f, part, tipo }], joints: [{ id, J, M, comp, d, q, arm, Fr }], reparto: [{ nombre, pct, ang, hacia }] y roz: { h, hOpt, mu, NA, NB, E0, E, lim, d } (rozamiento, X03-21) con dos grupos de apoyo (si no, null), act: { quads, … } (recortado 0–1), raw: los mismos doce sin recortar (el doce, `abs`, desde X03-19) }
function demand(P, ex, out) {
  const prm = state.per[ex], L = (prm.load ?? 0) / 100, parts = bodyParts(P);
  const forces = parts.map(q => ({ p: q.c, f: V(0, -q.m, 0), part: q.id, tipo: 'peso' }));
  const sup = SUPPORTS[EXERCISES[ex].base](P, ex, out, L); if (!sup) return null;   // acción `libre` sin apoyos declarados: sin demanda
  forces.push(...sup.cargas);
  const fijo = new Set(sup.fijo || []);
  // ejes del cuerpo
  const a = ejesCuerpo(P);
  // momento y brazo de cada articulación con una lista de fuerzas (§14.6); se llama una vez, o tres con dos grupos de apoyo (X03-21)
  const articulaciones = fs => {
    const momento = (J, ids, enIds) => { const M = V(), Fr = V(); for (const f of fs) if (ids.has(f.part) === enIds) { M.add(f.p.clone().sub(J).cross(f.f)); Fr.add(f.f); } return [M, Fr]; };
    const js = [];
    for (const j of JOINTS) for (const S of j.S ? ['L', 'R'] : [null]) {
      const J = j.J(P, S, a), dist = new Set(j.dist(S)), rec = { id: S ? `${j.id}.${S}` : j.id, J, M: null, comp: {}, d: {}, q: null, arm: null, Fr: null };
      js.push(rec);
      // lado distal; si tiene un apoyo fijo se mide con el otro (y se cambia el signo); si los dos lo tienen, no se puede calcular
      const dFijo = [...dist].some(i => fijo.has(i)), oFijo = parts.some(q => !dist.has(q.id) && fijo.has(q.id));
      if (dFijo && oFijo) continue;
      const [Mr, Fr] = momento(J, dist, !dFijo);
      rec.M = dFijo ? Mr.clone().negate() : Mr; rec.Fr = Fr;
      rec.comp = j.comp(rec.M, a, S, P);
      for (const c in rec.comp) rec.d[c] = clamp(Math.abs(rec.comp[c]) / (CAP[j.cap[c]] * K()));
      if (Fr.length() > 0.02) { rec.q = J.clone().add(Fr.clone().cross(Mr).divideScalar(Fr.lengthSq())); rec.arm = rec.q.distanceTo(J);
        rec.pts = fs.filter(f => f.tipo !== 'peso' && dist.has(f.part) === !dFijo).map(f => f.p); }   // dónde nace esa fuerza (apoyos y cargas): para dibujar su línea hasta allí
      // brazo de la CARGA (lo que se dibuja): contra la línea de la resistencia externa del lado distal, sin los pesos del cuerpo. Contra la resultante
      // neta, donde la carga y el peso del tronco casi se anulan (el lumbar del jalón), la línea se va lejísimos (104 cm) y no dice nada
      const cs = fs.filter(f => f.tipo !== 'peso' && dist.has(f.part) === !dFijo);   // cargas y apoyos, sin los pesos del cuerpo: la cadera y la rodilla del hip thrust miden contra LA MISMA línea, la del pie
      if (cs.length) { const Mc = V(), Fc = V(); for (const f of cs) { Mc.add(f.p.clone().sub(J).cross(f.f)); Fc.add(f.f); }
        if (Fc.length() > 0.02) { rec.qL = J.clone().add(Fc.clone().cross(Mc).divideScalar(Fc.lengthSq())); rec.armL = rec.qL.distanceTo(J); rec.FL = Fc; rec.ptsL = cs.map(f => f.p); rec.deCarga = cs.some(f => f.tipo === 'carga'); } }
    }
    return js;
  };
  let joints, reparto = null, roz = null;   // reparto: con dos grupos verticales, cuánto de la reacción total lleva cada uno (para el panel); roz: el rozamiento elegido
  if (sup.vert) {
    // dos grupos y cargas solo verticales (X03-21): el rozamiento h* es el que menos esfuerzo pide (optimización estática, Crowninshield y Brand 1981, sobre los momentos articulares)
    let h = 0, g = null, lim = null, j0 = null, E0 = 0, hOpt = 0;
    const cap = (id, c) => CAP[JOINTS.find(x => x.id === id.split('.')[0]).cap[c]] * K();
    const esf = js => js.reduce((t, j) => t + (j.M ? Object.keys(j.comp).reduce((u, c) => u + (j.comp[c] / cap(j.id, c)) ** 2, 0) : 0), 0);   // E = Σ (comp / (CAP·K))²
    if (sup.vert.length === 2 && sup.cargas.every(c => !c.f.x && !c.f.z) && (g = geoDos(forces, sup.vert)) && (lim = limitesH(g))) {
      j0 = articulaciones([...forces, ...apoyosVerticales(forces, sup.vert)]); E0 = esf(j0);
      const j1 = articulaciones([...forces, ...apoyosVerticales(forces, sup.vert, 1, g)]); let num = 0, den = 0;   // comp(h) = c0 + h·Δ: el mínimo pesa cada componente por 1/(CAP·K)²
      j0.forEach((j, i) => { if (j.M) for (const c in j.comp) { const w = 1 / cap(j.id, c) ** 2, d = j1[i].comp[c] - j.comp[c]; num += w * j.comp[c] * d; den += w * d * d; } });
      hOpt = den > 1e-12 ? -num / den : 0; h = clamp(hOpt, lim[0], lim[1]);
    }
    const ap = apoyosVerticales(forces, sup.vert, h, g); forces.push(...ap);
    joints = h || !j0 ? articulaciones(forces) : j0;
    if (sup.nombres && sup.vert.length === 2) {
      const R = sup.vert.map(G => ap.filter(f => G.some(q => q.part === f.part)).reduce((a, f) => a + f.f.y, 0)), t = R[0] + R[1];
      reparto = sup.vert.map((G, i) => ({ nombre: sup.nombres[i], pct: 100 * R[i] / t, ang: Math.atan(Math.abs(h) / R[i]) / DEG, hacia: h ? haciaTxt(sup.nombres[1 - i], h < 0) : null }));
      for (const f of ap) { const i = sup.vert.findIndex(G => G.some(q => q.part === f.part)); f.hacia = reparto[i].hacia; }   // para las cifras de la capa Apoyo
      if (g) roz = { h, hOpt, mu: MU_ROZ, NA: R[0], NB: R[1], E0, E: esf(joints), lim, d: g.d };
    }
  } else joints = articulaciones(forces);
  // de momento a demanda: el mayor de los dos lados (una articulación sin calcular aporta 0)
  const val = (id, c, sg = 1) => Math.max(0, ...joints.filter(j => j.M && (j.id === id || j.id.startsWith(id + '.'))).map(j => sg * j.comp[c]));
  const beta = Math.max(...['L', 'R'].map(S => P[`DEF-SHIN01.${S}`].p.clone().sub(P[`DEF-THIGH01.${S}`].p).angleTo(V(0, -1, 0)))), deep = clamp(beta / (110 * DEG));
  // CONVENCIÓN (no física) para bíceps y tríceps en las tracciones: el momento neto del codo sale casi nulo en la dominada (antebrazo vertical
  // bajo la barra) porque el modelo no ve la fuerza con que las manos tiran a lo largo de una barra fija. Si el hombro extiende o aduce (lo que hace el
  // dorsal) y el codo está flexionado, el bíceps trabaja en proporción; con el brazo recto (peso muerto) no cambia nada.
  const codoFlex = clamp(Math.max(...['L', 'R'].map(S => { const sh = P[`DEF-ARM01.${S}`].p, el = P[`DEF-FORARM01.${S}`].p, wr = P[`DEF-HAND.${S}`].p;
    return el.clone().sub(sh).angleTo(wr.clone().sub(el)); })) / (60 * DEG));
  // la tabla de músculos con una D recortada (act, lo que usan los tests) o sin recortar (raw, lo que se escala con el pico de la repetición)
  const musculos = f => {
    const D = (id, c, cap, sg) => f(val(id, c, sg) / (CAP[cap] * K())), Dsh = (c, sg) => D('shoulder', c, 'shoulder', sg);
    const hipE = D('hip', 'ext', 'hip'), sinergia = 0.5 * Math.max(Dsh('flex', -1), Dsh('add')) * codoFlex;
    return {
      quads: D('knee', 'ext', 'knee'), glutes: hipE * (0.55 + 0.45 * deep) + 0.5 * D('hip', 'add', 'hipFrontal', -1), hams: Math.max(0.6 * hipE, D('knee', 'ext', 'knee', -1)),
      add: D('hip', 'add', 'hipFrontal') + 0.3 * hipE * (0.3 + 0.7 * deep), erect: D('lumbar', 'ext', 'lumbar'), abs: D('lumbar', 'ext', 'lumbar', -1), calves: D('ankle', 'plantar', 'ankle'),
      lats: Math.max(Dsh('flex', -1), Dsh('add'), 0.5 * Dsh('hadd', -1)), pecs: Math.max(Dsh('hadd'), 0.5 * Dsh('flex')),
      delts: Math.max(Dsh('flex'), Dsh('add', -1), 0.5 * Dsh('hadd', -1)), biceps: Math.max(D('elbow', 'flex', 'elbow'), sinergia), triceps: Math.max(0, D('elbow', 'flex', 'elbow', -1) - sinergia),
    };
  };
  const act = musculos(clamp), raw = musculos(x => x);
  for (const k in act) act[k] = clamp(act[k]);
  return { forces, joints, act, raw, reparto, roz };
}

const VARIANT = id => POSES.exercises[id]?.meta?.of;
const variantFor = (ex, grip) => Object.keys(POSES.exercises).find(id => VARIANT(id) === ex && POSES.exercises[id].meta.grip === grip);
// ---- afinado del usuario (X03-27): un dato por acción (`ajustes/<acción>.json`, lo mete build.py), la capa entre las reglas y la app. Muñeca y codos, en grados, en tres instantes (s = 0, 0,5 y 1),
// con un valor `base` y, por ajuste del entrenador, otro en su mínimo y en su máximo; más los rangos de los ajustes. Sin archivo, todo vale 0 y los rangos son los del código
const AJ = JSON.parse(document.getElementById('ajustes-json')?.textContent || '{}');
let AJ_VER = 0;   // sube al editar el afinado: invalida las cachés que dependen de él (sFin)
const ajSet = (act, v) => { if (v) AJ[act] = v; else delete AJ[act]; AJ_VER++; };
const GRIP_HALF_MIN = 0.08, GRIP_HALF_MAX = 0.55, gripHalf = ex => Math.abs(jalonData(actOf(ex)).side.L.along);   // media anchura de agarre de la acción (m) y sus topes
const actOf = ex => JALON(ex) ? variantFor(ex, state.per[ex]?.gripType) || ex : ex;   // la acción del agarre elegido
// interpolación entre los tres valores (inicio, mitad, final) como las claves de Blender en «auto clamped»: pendiente 0 en los extremos y en una
// clave que es máximo o mínimo, sin pasarse nunca de los valores puestos (Hermite monótono, Fritsch–Carlson). Antes era la parábola por los tres
// puntos: cambiaba deprisa nada más salir del inicio y se pasaba (con [30, 0, 0], −3,8 al 75 %)
const keys3 = (v, t) => { const d0 = 2 * (v[1] - v[0]), d1 = 2 * (v[2] - v[1]);
  const m1 = d0 * d1 <= 0 ? 0 : Math.sign(d0) * Math.min((Math.abs(d0) + Math.abs(d1)) / 2, 3 * Math.min(Math.abs(d0), Math.abs(d1)));
  const [a, b, ma, mb, u] = t <= 0.5 ? [v[0], v[1], 0, m1, t * 2] : [v[1], v[2], m1, 0, t * 2 - 1], h = 0.5, u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * a + (u3 - 2 * u2 + u) * h * ma + (-2 * u3 + 3 * u2) * b + (u3 - u2) * h * mb; };
// «mitad» es la mitad del GESTO, no del tiempo: en el jalón, a mitad de tiempo la barra lleva el 36 % del recorrido (las escápulas van antes
// que el codo). El progreso es lo que han bajado las manos en la acción de Blender (0 al inicio, 1 al final); sin manos que se muevan, el tiempo
const PROG = {};
const progOf = act => PROG[act] ??= withBody(DEFAULT_BODY, () => { const y = i => { const P = authoredPose(act, i / 60); return (P['DEF-HAND.L'].p.y + P['DEF-HAND.R'].p.y) / 2; };
  const ys = Array.from({ length: 61 }, (_, i) => y(i)), span = ys[0] - ys[60]; if (Math.abs(span) < 0.05) return null;
  let m = 0; return ys.map(v => (m = Math.max(m, clamp((ys[0] - v) / span)))); });
const progAt = (act, s) => { const t = progOf(act); if (!t) return s; const x = clamp(s) * 60, i = Math.min(59, Math.floor(x)); return lerp(t[i], t[i + 1], x - i); };
const sOfProg = (act, p) => { const t = progOf(act); if (!t) return p; const i = t.findIndex(v => v >= p - 1e-9); if (i <= 0) return 0; return (i - 1 + (p - t[i - 1]) / ((t[i] - t[i - 1]) || 1)) / 60; };
const quad = (v, s) => keys3(v, s);
// magnitudes afinables por modelo (X03-28): el panel del editor se genera de aquí y `fineAt` suma todas; añadir una es una línea. Todas valen 0 por defecto y tienen tres valores (inicio, mitad, final)
const AFINABLES = { jalon: [
  { parte: 'mano', label: 'Mano', mags: [
    { id: 'muneca', label: 'Flexión', unidad: '°', min: -45, max: 45, paso: 1, ayuda: 'Giro de la mano alrededor de la barra: + lleva la palma hacia el antebrazo.' },
    { id: 'desv', label: 'Desviación', unidad: '°', min: -30, max: 30, paso: 1, ayuda: 'Giro de la mano sobre la palma: + lleva los dedos hacia el meñique.' }] },
  { parte: 'codo', label: 'Codo', mags: [{ id: 'codos', label: 'Giro', unidad: '°', min: -90, max: 90, paso: 1, ayuda: 'Giro del codo alrededor de la línea hombro–muñeca: + los abre.' }] },
  { parte: 'barra', label: 'Barra en la mano', mags: [
    { id: 'barraDedos', label: 'Hacia los dedos', unidad: ' mm', min: -20, max: 20, paso: 1, ayuda: 'Dónde queda la barra a lo largo de la mano: + hacia los dedos, − hacia la muñeca.' },
    { id: 'barraPalma', label: 'Hacia la palma', unidad: ' mm', min: -15, max: 15, paso: 1, ayuda: 'Cuánto se hunde la barra en la palma: + más dentro.' }] },
  { parte: 'escap', label: 'Escápulas', mags: [{ id: 'escap', label: 'Subir / bajar', unidad: '%', min: -50, max: 50, paso: 1, ayuda: 'Se suma a su recorrido entre abajo y arriba: + las sube.' }] },
  { parte: 'tronco', label: 'Tronco', mags: [{ id: 'tronco', label: 'Inclinación', unidad: '°', min: -15, max: 15, paso: 1, ayuda: 'Se suma a la inclinación del tronco: + hacia delante.' }] },
] };
const afPartes = ex => (JALON(ex) ? AFINABLES.jalon : null) || [];
const afMags = ex => afPartes(ex).flatMap(p => p.mags);
// afinado efectivo en `s` con los ajustes `prm`: por magnitud, base + Σ peso · (extremo − base), con peso = lo lejos que está el ajuste de su valor por defecto hacia ese extremo (0..1)
function fineAt(act, prm, s) {
  const f = AJ[act], mags = afMags(act), out = Object.fromEntries(mags.map(m => [m.id, 0]));
  if (!f) return out;
  const ws = Object.entries(f.en || {}).flatMap(([id, e]) => { const p = PSET(act).find(p => p.id === id && !p.hide?.(act)); if (!p) return [];
    const r = rangoOf(act, p), x = prm[id], hi = x > r.def, w = hi ? (x - r.def) / ((r.max - r.def) || 1) : x < r.def ? (r.def - x) / ((r.def - r.min) || 1) : 0; return [[e[hi ? 'max' : 'min'], clamp(w)]]; });
  for (const { id: m } of mags) {
    const b = f.base?.[m] || [0, 0, 0], v = b.slice();
    for (const [ext, w] of ws) if (ext?.[m]) for (let i = 0; i < 3; i++) v[i] += w * (ext[m][i] - b[i]);
    out[m] = keys3(v, progAt(act, s));
  }
  return out;
}
// ajustes iniciales de cada ejercicio (aquí y no arriba: los valores por defecto de `defOf` miden las claves de la acción)
for (const [id, ex] of Object.entries(EXERCISES)) state.per[id] = Object.fromEntries(PSET(id).map(p => [p.id, pdef(id, p)]));
// variantes (acción con `ff_variant_of`, p. ej. Chinup = dominada supina): no son un ejercicio aparte; comparten los ajustes del
// suyo y se usan desde su chip de agarre (variantFor)
for (const id of Object.keys(EXERCISES)) if (VARIANT(id) && state.per[VARIANT(id)]) state.per[id] = state.per[VARIANT(id)];
// jalón: cada agarre es una acción con sus propios ajustes (anchura, polea, tronco…): al cambiar de agarre se guardan los del que se deja y se
// ponen los del nuevo (los que tenía, o sus valores por defecto: los del código o los `rangos` de su afinado). Antes se arrastraban de uno a otro
const PER_ACT = {};
function setGrip(ex, v) {
  const prm = state.per[ex]; PER_ACT[actOf(ex)] = { ...prm }; prm.gripType = v;
  const saved = PER_ACT[actOf(ex)];
  for (const p of PSET(ex)) if (p.id !== 'gripType') prm[p.id] = saved ? saved[p.id] : pdef(ex, p);
}

/* ---------------- Evaluación de un frame ---------------- */
function evaluate(ex, s) {
  const base = EXERCISES[ex].base, prm = state.per[ex];
  if (base === 'cable' && JALON(ex)) ex = variantFor(ex, prm.gripType) || ex;   // jalón: el agarre elige su acción
  // dominada y polea: el recorrido se recorta por arriba (hasta dónde sube) y por abajo (desde dónde baja); no se comprime. Jalón: además acaba en `sFin` (R4)
  const sf = base === 'cable' && JALON(ex) ? sFin(ex) : 1;
  if (base === 'hang' || base === 'cable') { const lo = prm.bottom, hi = Math.max(Math.min(prm.top, sf * 100), lo + 5); s = Math.min((lo + (hi - lo) * ramp(s, lo > 0 ? 0 : 1, hi < 100 ? 0 : 1)) / 100, sf); }   // (con «Desde dónde empieza» más allá de sFin, se queda en sFin)
  // agarre con su propia acción (supino: Chinup); el neutro sale de la supina si la hay (los codos ya van hacia delante)
  if (base === 'hang') ex = variantFor(ex, prm.gripType) || (prm.gripType === 'neutro' && variantFor(ex, 'supino')) || ex;
  // remo: el supino con su acción (barbell_row_supino) si la hay; con barra, el recorrido se corta en el codo máximo (frenando)
  if (base === 'row') { ex = variantFor(ex, prm.gripType) || ex; const c = rowCut(ex); s = c * ramp(s, 1, c < 1 ? 0 : 1); }
  const r = evaluateRaw(ex, base === 'hinge' ? hingeS(ex, s) : s); if (sf < 1) r.sFin = sf; return r;
}
// R4 (X03-26): hasta dónde llega la repetición del jalón: el primer s en que el antebrazo, visto de lado, se aparta del cable más que ALIGN_TOL respecto a la acción (31 puntos y bisección);
// 1 si nunca. Va sin recorte (evaluateRaw) y se guarda por cuerpo y ajustes
const SFIN = {};
function sFin(ex) {
  const k = ex + AJ_VER + JSON.stringify(state.body) + JSON.stringify(state.per[ex]);
  if (k in SFIN) return SFIN[k];
  const bad = s => evaluateRaw(ex, s).align.excess > ALIGN_TOL;
  let lo = 0, hi = null;
  for (let i = 0; i <= 30 && hi === null; i++) { if (bad(i / 30)) hi = i / 30; else lo = i / 30; }
  if (hi === null) return SFIN[k] = 1;
  for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (bad(m)) hi = m; else lo = m; }
  return SFIN[k] = lo;
}
// Demanda con los ajustes y el cuerpo por defecto (la pose autorada), para enseñar en el panel cuánto cambian las articulaciones (X03-12).
// SOLO se llama desde frameLoop, nunca desde evaluate/evaluateInner (se llamaría a sí misma). Se cachea por acción y s: la autorada no
// depende de ajustes ni cuerpo. Las variantes comparten el objeto de ajustes con su acción base (state.per): se cambian todos los alias.
const DEMDEF = {};
function evaluateDefault(ex, s) {
  s = Math.round(s * 200) / 200; const key = ex + '|' + s;
  if (key in DEMDEF) return DEMDEF[key];
  const body = state.body, prm = state.per[ex], alias = Object.keys(state.per).filter(k => state.per[k] === prm);
  try {
    state.body = DEFAULT_BODY;
    const def = Object.fromEntries(PSET(ex).map(p => [p.id, pdef(ex, p)]));
    for (const k of alias) state.per[k] = def;
    return (DEMDEF[key] = evaluate(ex, s).dem);
  } finally { state.body = body; for (const k of alias) state.per[k] = prm; }
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
  if (exd.base === 'stand' || exd.base === 'hinge' || exd.base === 'row' || exd.base === 'cable') {
    // hinge (peso muerto): la barra cuelga de las manos en vez de ir en el tronco; se resuelven muslo y tronco para que
    // la barra siga sobre el mediopié y, al empezar, en el suelo (los discos no cambian con el cuerpo)
    // row (remo): como la bisagra (barra en las manos, implementos), pero el tronco queda fijo y los brazos se doblan
    // cable (remo en polea): como el remo (brazos que tiran), con la pelvis fija en el asiento, los pies en la plataforma y la polea
    const cable = exd.base === 'cable', row = exd.base === 'row' || cable, hinge = exd.base === 'hinge' || row, depth = prm.depth ?? 1, barH = prm.barH ?? 0;
    // bisagra: subida (0 en el punto bajo, 1 arriba) medida por la altura autorada de la barra; remo: cuánto ha tirado
    const hk = hinge && hingeKeys(ex), up = row ? rowUp(ex, F) : hinge ? clamp((F.bar.y - hk.HB) / (hk.HT - hk.HB)) : 0;
    const yaw0 = (F.L.yaw - F.R.yaw) / 2, stance0 = (F.L.an.x - F.R.an.x) / 2;
    const beta = hinge ? F.beta : F.beta * lerp(1, depth, clamp(F.beta / (60 * DEG)));
    const thPref0 = F.th, thPref = F.th + (hinge ? 0 : prm.knees * DEG * clamp(F.beta / (60 * DEG)));
    const yaw = yaw0 + (prm.toes ?? 0) * DEG, stance = stance0 * prm.stance * d.k / d0.k;
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
    const phi0 = F.phi + (cur.phi - ref.phi);
    let th;
    if (exd.base === 'stand') {
      // sentadilla (X03-15): tibia = la de Blender + p · dB. p (0 de pie, 1 en el punto bajo) sigue el ritmo de la animación; dB es cuánto
      // cambia la tibia ABAJO: lo que cambian cuerpo, anchura, profundidad y barra (dos solveStand en el punto bajo, 0 por defecto) + la
      // dorsiflexión (manda ella) + «Avance de rodillas» (un extra). Así no hay gesto de tobillo al empezar ni tope que recorte en seco.
      const { th0, FB } = standRef(ex), thB = FB.th, p = thB - th0 < 2 * DEG ? 0 : clamp((F.th - th0) / (thB - th0));
      const yawB = (FB.L.yaw - FB.R.yaw) / 2, stB = (FB.L.an.x - FB.R.an.x) / 2, bo = FB.barOff;
      const refB = solveStand(d0, FB.beta, FB.th, FB.phi, stB, yawB, bo, L, 90 * DEG);
      const curB = solveStand(d, FB.beta * lerp(1, depth, clamp(FB.beta / (60 * DEG))), FB.th, FB.phi, stB * prm.stance * d.k / d0.k, yawB + (prm.toes ?? 0) * DEG,
        { du: bo.du * d.k / d0.k + barH / 100, dn: bo.dn * d.k / d0.k }, L, 90 * DEG);
      th = clamp(F.th + p * (curB.th - refB.th + (d.dorsi - 35) * DEG + prm.knees * DEG), -10 * DEG, 75 * DEG);
    } else th = clamp(F.th + (hinge ? 0 : cur.th - ref.th) + (thPref - thPref0), -10 * DEG, thLim);
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
    // remo supino: la mano da media vuelta sobre su eje y la palma mira delante (con el asa transversal)
    // (si la acción ya es supina, solo cambia el implemento: la mano no da la vuelta)
    const own = POSES.exercises[ex].meta?.grip || 'prono', sup = row && prm.gripType === 'supino' && !implOf(ex).side;
    // a un brazo (meta.hand): solo esa mano tira (WS), con el asa de la acción; la otra va tal cual con el tronco
    const WS = POSES.exercises[ex].meta?.hand || 'L', one = !!POSES.exercises[ex].meta?.hand;
    const I0 = one ? IMPL.asa : hinge ? implOf(ex) : IMPL.barra, ownI = one ? IMPL.asa : cable ? IMPL.triangulo : IMPL.barra;
    const I = cable ? (sup && I0 === IMPL.barra_recta ? { ...I0, palm: 'up' } : I0)       // polea: la mano gira de neutra a prona o supina
      : !sup || (own === 'supino' && I0 === IMPL.barra) ? I0 : { ...I0, palm: 'front', ...(own === 'supino' ? {} : { roll: Math.PI }) };
    // polea: al subirla o bajarla, los brazos estirados giran hacia ella alrededor del hombro, y con ellos las manos y el maneral
    // (qP; se deshace según tira: al tirar el maneral va al tronco). Sin polea, identidad
    // pivote de los brazos: el centro de los hombros o, a un brazo, el hombro que tira (con el pecho girado no están en el eje X)
    const shA = one ? auth[`DEF-ARM01.${WS}`].p : F.sh;
    const P0 = cable && pulleyOf(ex), B0 = cable && POSES.exercises[ex].start.bones, b0 = n => V(...B0[n].p);
    const sh0 = cable && (one ? b0(`DEF-ARM01.${WS}`) : b0('DEF-ARM01.L').add(b0('DEF-ARM01.R')).multiplyScalar(0.5));   // hombro con el brazo estirado
    // jalón: la barra cuelga bajo la polea, así que el brazo (de largo rE) gira hasta que la barra queda en la vertical de la polea nueva
    const rE = cable && V(...POSES.exercises[ex].start.bar.center).sub(sh0).length() * (d.k / d0.k);
    const angP = P => JALON(ex) ? Math.acos(clamp((P.z - sh0.z) / rE, -1, 1)) : Math.atan2(P.y - sh0.y, P.z - sh0.z), dP = cable && (prm.pulleyH || prm.pulleyF) ? -(angP(pulleyAt(ex, prm.pulleyH, prm.pulleyF)) - angP(P0)) : 0;
    const qP = QA(X, dP * (1 - up));                      // manos y codos: giran con el brazo, menos según tira
    const qHandA = S => qP.clone().multiply(auth[`DEF-HAND.${S}`].q);
    const handI = hinge && I !== ownI && POSES.hands
      && { L: implHand('L', 1, qHandA('L'), I), R: implHand('R', -1, qHandA('R'), I) };
    // bisagra: puño respecto a la barra, por lado, con el agarre aplicado a lo largo de la barra (la barra no gira: Rh = identidad).
    // A los lados, las mancuernas van junto a los muslos; con una kettlebell, las dos manos juntas en el asa.
    const gripOff = S => { const o = hg[S].off.clone().applyQuaternion(qP), along = o.dot(F.barAxis);
      const x = I.side ? Math.sign(along) * (d.hipHalf + I.dx * d.k) * (row ? prm.grip : 1) : I.half ? Math.sign(along) * (I.half + (I.spread || 0) * up) * kr
        : I.w ? Math.sign(along) * I.w * prm.grip * kr : I.fixed && !JALON(ex) ? along * kr : along * prm.grip * kr;   // jalón: las manos se deslizan por la barra (el maneral por defecto es el triángulo, `fixed`)
      return F.barAxis.clone().multiplyScalar(x).add(o.clone().addScaledVector(F.barAxis, -along).multiplyScalar(kr)); };
    const wristOff = S => handI ? handI[S].hollow.clone().multiplyScalar(d.k).applyQuaternion(handI[S].q)     // puño -> muñeca
      : socketRest(S).multiplyScalar(d.k).applyQuaternion(qHandA(S).multiply(REST[`DEF-HAND.${S}`].q.clone().invert()));
    const md = cable && manData(ex);
    // ---- construcción de la pose para una inclinación de tronco (y una cadera) dadas
    // «Tronco al inicio / al final» (X03-26): giro hueso a hueso (authQ) o, si la acción no mueve el tronco, rígido (dRigid)
    const { q: authQ, rigid: dRigid = 0 } = cable ? trunkQ(ex, prm, auth, s) : {};
    const build = (phi, hipT, barShift = 0) => {
    const pose = clonePose(auth), warns = [];
    const R = QA(X, phi - F.phi);                       // +phi = hacia delante (+Z)
    const hipA = F.hip;
    const legSet = new Set([...subtree('DEF-THIGH01.L'), ...subtree('DEF-THIGH01.R')]);
    for (const n of BN) if (!legSet.has(n)) { pose[n].q = R.clone().multiply(authQ?.[n] || auth[n].q); }
    pose['DEF-HIPS'].p = hipT.clone().add(auth['DEF-HIPS'].p.clone().sub(hipA).applyQuaternion(R));
    fkSub(pose, 'DEF-HIPS');
    if (cable && prm.curv) {   // curvatura del tronco (X03-20): mitad del giro en SPINE01 y mitad en SPINE02, cada uno arrastra solo a sus hijos; pelvis y piernas quietas
      // (la spec decía SPINE02 y CHEST, pero con esos pivotes `lumbar.flex`, que mide SPINE01→CHEST, solo sube 4° con +15; con estos, 12°)
      // ponytail: el eje lateral es X (el tronco no va girado; en el remo a un brazo, con el pecho girado, es una aproximación)
      const qc = QA(X, prm.curv * DEG / 2);
      for (const root of ['DEF-SPINE01', 'DEF-SPINE02']) { const c = pose[root].p.clone();
        for (const n of subtree(root)) { pose[n].q = qc.clone().multiply(pose[n].q); if (n !== root) pose[n].p = pose[n].p.clone().sub(c).applyQuaternion(qc).add(c); } }
    }
    if (cable && (prm.scap0 !== 100 || prm.scap1 !== 0 || fineAt(ex, prm, s).escap)) {   // escápulas al inicio y al final (X03-26), con giros relativos al pecho; los brazos se recolocan solos
      const C = pose['DEF-CHEST'];
      for (const S of ['L', 'R']) { const sn = `DEF-SHOULDER.${S}`, [r, v] = scapAt(ex, prm, auth, S, s);
        pose[sn].q = C.q.clone().multiply(r); pose[sn].p = v.multiplyScalar(kk).applyQuaternion(C.q).add(C.p); fkSub(pose, sn); }
    }
    // piernas
    for (const [S, sgn] of [['L', 1], ['R', -1]]) {
      const Fs = F[S], dYaw = sgn * (prm.toes ?? 0) * DEG;
      const an0 = expP(ex, `DEF-FOOT.${S}`, s);          // tobillo plantado (exacto de Blender, sin deriva entre claves)
      let ank = V(an0.x * prm.stance * d.k / d0.k, an0.y * d.k / d0.k, an0.z);
      if (cable) ank = V(an0.x * prm.stance * kr, an0.y, an0.z);   // pies en la plataforma (fija): la pelvis es la que se desliza (seatSlide)
      const pole = Fs.legPole.clone().applyAxisAngle(Y, dYaw);
      solveLimb(pose, auth, [`DEF-THIGH01.${S}`, `DEF-THIGH02.${S}`, `DEF-SHIN01.${S}`, `DEF-SHIN02.${S}`, `DEF-FOOT.${S}`], ank, pole,
        [LEN(S).Lt, LEN(S).Ls]);
      fkSub(pose, `DEF-THIGH01.${S}`, c => { if (c === `DEF-THIGH02.${S}` || c === `DEF-SHIN01.${S}` || c === `DEF-SHIN02.${S}`) return; });
      pose[`DEF-FOOT.${S}`].q = QA(Y, dYaw).multiply(expQ(ex, `DEF-FOOT.${S}`, s));
      pose[`DEF-TOE.${S}`].q = QA(Y, dYaw).multiply(expQ(ex, `DEF-TOE.${S}`, s));
      fkSub(pose, `DEF-THIGH01.${S}`);
    }
    // barra y brazos: en la espalda gira con el tronco (Rh = R); colgada de las manos no gira (Rh = identidad)
    const shNow = midOf(pose, 'DEF-ARM01.L', 'DEF-ARM01.R'), Rh = hinge ? qP.clone() : R;
    const ph = cable ? sag(shNow.clone().sub(midOf(pose, 'DEF-THIGH01.L', 'DEF-THIGH01.R'))) : phi;   // polea: la línea cadera→hombros de la pose (el tronco va hueso a hueso)
    const u = V(0, Math.cos(ph), Math.sin(ph)), n = V(0, -Math.sin(ph), Math.cos(ph));
    let bar = hinge ? shNow.clone().add(F.bar.clone().sub(F.sh).multiplyScalar(d.k / d0.k))   // brazos colgando: mismo vector hombro→barra...
      : shNow.clone().addScaledVector(u, barOff.du).addScaledVector(n, barOff.dn).add(V((barOff0.dx || 0) * d.k / d0.k, 0, 0));
    if (row) {
      // remo: abajo los brazos cuelgan (el vector hombros→barra autorado, sin girar); arriba la barra va con el tronco (girado
      // con él) y «Hacia dónde sube» la lleva a lo largo del tronco. Con otro agarre o implemento, abajo el brazo sigue recto:
      // la barra sube o baja lo que cambia la altura del brazo recto (diferencia con el agarre autorado: exacta por defecto).
      const off = F.bar.clone().sub(shA).multiplyScalar(kr), rA = off.length(), offP = V(0, 0, 0);   // rA: hombro→maneral autorado
      if (dP) { const e0 = V(...POSES.exercises[ex].start.bar.center).sub(sh0).multiplyScalar(kr);   // brazo estirado autorado
        offP.copy(e0.clone().applyAxisAngle(X, dP).sub(e0).multiplyScalar(1 - up)); off.add(offP); }   // en línea con el cable; se desvanece en recta
      const chest = I0 === IMPL.barra ? ROW_BAR.cm * clamp(prm.trunk / ROW_BAR.trunk) : 0;   // con barra e inclinado: hacia el pecho
      if (cable) {
        // polea (X03-22): el maneral va por la recta del cable (la del maneral autorado de este frame a la polea), a la distancia
        // autorada del hombro de ahora: el codo hace lo de la animación y el maneral se desliza por el cable. Por defecto, el autorado
        const hs = (one ? pose[`DEF-ARM01.${WS}`].p : shNow), Ba = F.hip.clone().add(F.bar.clone().sub(F.hip).multiplyScalar(kr)).add(offP);
        const dir = pulleyAt(ex, prm.pulleyH, prm.pulleyF).sub(Ba).normalize(), w = Ba.clone().sub(hs), b = w.dot(dir), disc = b * b - (w.lengthSq() - rA * rA);
        let t = -b;   // sin intersección: el punto de la recta más cercano al hombro
        // jalón (X03-26): la raíz cuadrada se dispara cuando el cable es perpendicular a hombro→barra (justo al final del tirón: tangente) y la barra daba saltos de 9 cm. Se usa su linealización
        // t = −Δ/(2b), con b amortiguada (b/(b² + ε²)): igual de exacta por defecto (Δ = 0) y con la sensibilidad acotada. El resto lo corrige el brazo estirado (barShift) y el codo
        const lin = -(w.lengthSq() - rA * rA) * b / (2 * (b * b + JAL_EPS * JAL_EPS));
        // de las dos soluciones, la más cercana a la polea (el maneral queda «por delante» del hombro a lo largo del cable): es la autorada en las
        // cuatro acciones (b0 > 0 en todo el recorrido) y, como no cambia de una a otra al mover el hombro, no salta (la «más cercana a Ba» sí)
        if (JALON(ex)) t = lin;
        else if (disc >= 0) t = -b + Math.sqrt(disc);
        else if (Math.sqrt(w.lengthSq() - b * b) - rA > 0.01) warns.push('El maneral no llega: el hombro queda lejos del cable');
        bar = Ba.addScaledVector(dir, t);
        bar.addScaledVector(u, -(prm.dest - chest) / 100 * kk * up);
        // barShift (lazo cerrado del brazo estirado): a lo largo del brazo, NO del cable (con el cable casi tangente a la esfera, moverse por él no cambia el alcance)
        bar.addScaledVector(bar.clone().sub(hs).normalize(), barShift);
      } else {
      bar = (one ? pose[`DEF-ARM01.${WS}`].p : shNow).clone().add(off.lerp(off.clone().applyQuaternion(R), up)).addScaledVector(u, -(prm.dest - chest) / 100 * kk * up);
      const sh = pose[`DEF-ARM01.${WS}`].p, Rr = 0.999 * (LEN(WS).Lu + LEN(WS).Lf);
      const h = o => Math.sqrt(Math.max(0, Rr * Rr - (bar.x + o.x - sh.x) ** 2 - (bar.z + o.z - sh.z) ** 2));
      const oC = gripOff(WS).sub(wristOff(WS)), oR = hg[WS].off.clone().multiplyScalar(kr).sub(socketRest(WS).multiplyScalar(d.k).applyQuaternion(auth[`DEF-HAND.${WS}`].q.clone().multiply(REST[`DEF-HAND.${WS}`].q.clone().invert()))).applyQuaternion(qP);
      bar.y += (1 - up) * (oR.y - oC.y + h(oR) - h(oC));
      }
    } else if (hinge) {   // ...salvo la altura: la que deja la muñeca izquierda con el BRAZO RECTO (regla: con la barra en las
      // manos el codo no se flexiona, ni en el aire ni en el suelo). Con el agarre más abierto el brazo baja menos.
      const sh = pose['DEF-ARM01.L'].p, o = gripOff('L').sub(wristOff('L'));   // barra -> muñeca
      const R = 0.999 * (LEN('L').Lu + LEN('L').Lf), dx = bar.x + o.x - sh.x, dz = bar.z + o.z - sh.z;
      bar.y = sh.y - o.y - Math.sqrt(Math.max(0, R * R - dx * dx - dz * dz));
    }
    const axis = F.barAxis.clone().applyQuaternion(Rh);
    const sides = one ? [WS] : ['L', 'R'];
    const poleFor = S => { const hn = `DEF-HAND.${S}`, pl = poleOf(auth[`DEF-ARM01.${S}`].p, auth[`DEF-FORARM01.${S}`].p, auth[hn].p).applyQuaternion(Rh);
      return row ? pl.lerp(pl.clone().applyQuaternion(R), up).normalize() : pl; };
    // mano en el maneral (pose y dedos) con el maneral en (pM, qMS)
    const handOn = (S, pM, qMS) => { const e = md[S], hn = `DEF-HAND.${S}`, ag = e.ag.clone(); if (md.bar) ag.x *= prm.grip;   // barra: la anchura mueve las manos por ella
      const grip = pM.clone().add(ag.applyQuaternion(qMS)), qH = qMS.clone().multiply(e.relQi);
      const wrist = grip.clone().sub(e.hg.clone().multiplyScalar(d.k).applyQuaternion(qH)), pole = poleFor(S);
      const ea = ((ELBOW_MAN[md.m] || 0) * (1 - up) + prm.elbows) * DEG;   // codos: giro alrededor de la línea hombro→muñeca
      if (ea) pole.applyAxisAngle(wrist.clone().sub(pose[`DEF-ARM01.${S}`].p).normalize(), (S === 'L' ? 1 : -1) * ea);
      const ik = solveLimb(pose, auth, [`DEF-ARM01.${S}`, `DEF-ARM02.${S}`, `DEF-FORARM01.${S}`, `DEF-FORARM0.${S}`, hn], wrist, pole, [LEN(S).Lu, LEN(S).Lf]);
      pose[hn].q = qH; for (const c in e.fingers) pose[c].q = qH.clone().multiply(e.fingers[c]);
      fkSub(pose, `DEF-SHOULDER.${S}`); return { grip, ik }; };
    let man = null;
    if (md && prm.wrist !== 'autorada') {
      // MANERAL (polea): lo orienta el cable. La tensión tira del gancho, así que el centro de los agarres, el gancho y la polea quedan
      // en línea, y las manos van donde las pone el maneral (_mano.<maneral>), apuntando hacia la polea. Antes giraba para seguir al
      // antebrazo: al final del tirón, con los codos abiertos, el antebrazo apuntaba abajo y el maneral salía de la línea del cable.
      // El centro de los agarres sigue la trayectoria. Rígido (triángulo, barra, asa): el giro mínimo desde el marco de uso (no se
      // tumba); cuerda: el gancho en la línea del cable, a su largo, y cada ramal del gancho a su mano.
      const toP = pulleyAt(ex, prm.pulleyH, prm.pulleyF).sub(bar).normalize();
      const gc = sides.map(S => md[S].ag).reduce((a, v) => a.add(v), V(0, 0, 0)).multiplyScalar(1 / sides.length);
      const gh = gc.length() > 1e-3 ? gc.clone().negate().normalize() : V(0, 0, 1);   // del centro de los agarres al gancho (marco del maneral)
      const q0 = new THREE.Quaternion().setFromUnitVectors(gh, toP), pM = bar.clone().addScaledVector(toP, gc.length());
      const qMs = {}, at = {};
      for (const S of sides) {
        qMs[S] = q0.clone(); at[S] = pM;
        if (!md.rigid) { const G = bar.clone().add(md[S].ag.clone().sub(gc).applyQuaternion(q0));   // cuerda: el ramal, del gancho a su mano
          qMs[S] = new THREE.Quaternion().setFromUnitVectors(md[S].ag.clone().applyQuaternion(q0).normalize(), G.clone().sub(pM).normalize()).multiply(q0);
          at[S] = G.sub(md[S].ag.clone().applyQuaternion(qMs[S])); }
      }
      const res = Object.fromEntries(sides.map(S => [S, handOn(S, at[S], qMs[S])]));
      for (const S of sides) if (res[S].ik.miss > 0.01) warns.push(`La mano ${S === 'L' ? 'izquierda' : 'derecha'} no llega al maneral (${Math.round(res[S].ik.miss * 100)} cm)`);
      man = { mesh: md.mesh, hook: pM, parts: sides.map(S => qMs[S]), at: sides.map(S => res[S].grip.clone().sub((md.bar ? md[S].ag.clone().setX(md[S].ag.x * prm.grip) : md[S].ag.clone()).applyQuaternion(qMs[S]))), grips: sides.map(S => res[S].grip) };
    }
    if (!man) for (const [S, sgn] of [['L', 1], ['R', -1]]) {
      if (one && S !== WS) continue;   // a un brazo: el otro brazo, el de Blender (girado con el tronco)
      if (JALON(ex)) continue;         // el jalón: más abajo (jalonArms)
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
      if (row) {   // remo: el codo va con el tronco según tira; en supino, más pegado (gira alrededor de la línea hombro→muñeca)
        elbowPole.lerp(elbowPole.clone().applyQuaternion(R), up).normalize();
        if (JALON(ex) && prm.elbows) elbowPole.applyAxisAngle(wrist.clone().sub(pose[`DEF-ARM01.${S}`].p).normalize(), sgn * prm.elbows * DEG);   // jalón: «Codos» (en el remo, por maneral)
        if (I.roll) elbowPole.applyAxisAngle(wrist.clone().sub(pose[`DEF-ARM01.${S}`].p).normalize(), sgn * ROW_SUP_ELBOW);
      }
      const chain = [`DEF-ARM01.${S}`, `DEF-ARM02.${S}`, `DEF-FORARM01.${S}`, `DEF-FORARM0.${S}`, hn];
      let ik = solveLimb(pose, auth, chain, wrist, elbowPole, [LEN(S).Lu, LEN(S).Lf]);
      // mantener rotaciones autoradas (giradas con la barra) para el resto de la cadena del brazo tras el IK
      for (const c of subtree(hn)) pose[c].q = Rh.clone().multiply(auth[c].q);
      if (handI) { const h = handI[S]; pose[hn].q = h.q.clone(); for (const c in h.fingers) pose[c].q = h.q.clone().multiply(h.fingers[c]); }
      fkSub(pose, `DEF-SHOULDER.${S}`);
      if (cable && prm.wrist !== 'autorada' && !JALON(ex)) {   // polea: muñeca recta (no en el jalón: la mano agarra la barra como en Blender) (la mano alineada con el antebrazo, como en reposo)
        const q0 = pose[hn].q.clone(), fa = `DEF-FORARM0.${S}`, hR = Y.clone().applyQuaternion(REST[hn].q);
        const offW = q => handI ? handI[S].hollow.clone().multiplyScalar(d.k).applyQuaternion(q) : sock.clone().multiplyScalar(d.k).applyQuaternion(q.clone().multiply(REST[hn].q.clone().invert()));
        let qh = q0.clone();
        for (let it = 0; it < 4; it++) {
          const want = hR.clone().applyQuaternion(pose[fa].q.clone().multiply(REST[fa].q.clone().invert()));   // eje de la mano en reposo, llevado con el antebrazo
          qh = new THREE.Quaternion().setFromUnitVectors(Y.clone().applyQuaternion(qh), want).multiply(qh);
          ik = solveLimb(pose, auth, chain, grip.clone().sub(offW(qh)), elbowPole, [LEN(S).Lu, LEN(S).Lf]); fkSub(pose, `DEF-SHOULDER.${S}`);
        }
        const dq = qh.clone().multiply(q0.clone().invert()); for (const c of subtree(hn)) pose[c].q = dq.clone().multiply(pose[c].q);
        fkSub(pose, `DEF-SHOULDER.${S}`);
      }
      if (ik.miss > 0.01) warns.push(`La mano ${S === 'L' ? 'izquierda' : 'derecha'} no llega a la barra (${Math.round(ik.miss * 100)} cm)`);
    }
    const jGrips = [];
    if (JALON(ex)) {   // jalón sobre Blender (X03-26): R1 barra en el hueco de la mano, R2 mano con el antebrazo, R3 codo que alinea el antebrazo con el cable
      const JD = jalonData(ex), P = pulleyAt(ex, prm.pulleyH, prm.pulleyF), cA = pulleyAt(ex, 0, 0).sub(F.bar).normalize();
      const fine = fineAt(ex, prm, s), munR = fine.muneca * DEG, desvR = fine.desv * DEG, libH = libraryHand(ex), elbD = fine.codos + lerp(prm.elbows0, prm.elbows1, s * s * (3 - 2 * s));   // el afinado del usuario (X03-27): flexión de muñeca y giro de los codos, en s
      for (let fix = 0; fix < 6; fix++) {
        const c = P.clone().sub(bar).normalize(); let miss = 0; jGrips.length = 0;
        for (const [S, sgn] of [['L', 1], ['R', -1]]) {
          const hn = `DEF-HAND.${S}`, jd = JD.side[S], Sh = pose[`DEF-ARM01.${S}`].p, aSh = auth[`DEF-ARM01.${S}`].p, aE = auth[`DEF-FORARM01.${S}`].p, aW = auth[hn].p, { Lu, Lf } = LEN(S);
          const lim = 0.9 * jd.R0 * kr, G = bar.clone().addScaledVector(axis, Sh.x + clamp(jd.along * prm.grip * kr - Sh.x, -lim, lim));   // R1: un punto fijo de la barra (sobre el eje); el agarre se recorta para que el brazo llegue
          const qH0 = Rh.clone().multiply(auth[hn].q);
          const ax = jd.axis.clone().applyQuaternion(qH0), psiH0 = psiOf(Y.clone().applyQuaternion(qH0), ax), eA = elbowAng(aSh, aW, cA, aW.distanceTo(aE));
          const stabG = jd.stab ? smooth01((s - jd.stab.sc) / STAB_FADE) : 1;   // R3 no actúa mientras el codo es estable y entra poco a poco en los STAB_FADE siguientes
          const poleA = jd.stab && s < jd.stab.sc ? stablePole(aW.clone().sub(aSh).normalize(), jd.stab.th) : poleOf(aSh, aE, aW);   // codo estable al empezar: con el brazo casi recto, el giro del primer instante en que el codo está definido
          const pole0 = poleA.clone().applyQuaternion(Rh); pole0.lerp(pole0.clone().applyQuaternion(R), up).normalize();
          const offA = wrapA(swivel(aW.clone().sub(aSh).normalize(), poleA) - eA.phi);   // dónde está el codo autorado respecto al «de regla»
          const poleFor = W => { const e = elbowAng(Sh, W, c, Lf), ax = W.clone().sub(Sh).normalize(), g = clamp(Math.min(e.r, eA.r) / (0.25 * Lf)) * stabG;   // R3: el codo conserva ese desfase respecto al «de regla» (sin(Δ) en vez de Δ envuelto: continuo aunque el codo «de regla» quede al otro lado); g lo apaga con el brazo casi recto
            return pole0.clone().applyAxisAngle(ax, g * Math.sin(e.phi + offA - swivel(ax, pole0)) + sgn * elbD * DEG); };
          // bisagra autorada de referencia: con el brazo casi recto el plano del codo de la acción es ruido (el codo se aparta 1-4 cm y cambia
          // de lado), y como `solveLimb` gira el hueso lo que cambia ese plano, el húmero daba una vuelta de ~70° sobre sí mismo al empezar
          // (medido en supino y neutro). Mientras el codo es estable se usa la bisagra del giro estable, y se funde con la de la acción después
          const axA = aW.clone().sub(aSh).normalize(), hReal = aE.clone().sub(aSh).cross(aW.clone().sub(aE));
          const hingeA = jd.stab && stabG < 1 ? stablePole(axA, jd.stab.th).cross(axA).normalize().lerp(hReal.lengthSq() > 1e-10 ? hReal.normalize() : stablePole(axA, jd.stab.th).cross(axA), stabG).normalize() : undefined;
          const chain = [`DEF-ARM01.${S}`, `DEF-ARM02.${S}`, `DEF-FORARM01.${S}`, `DEF-FORARM0.${S}`, hn], hol = hollowFine(jd, fine.barraDedos / 1000, fine.barraPalma / 1000, kk), wristFor = q => G.clone().sub(hol.clone().multiplyScalar(kk).applyQuaternion(q));
          let q = qH0, ik, th = 0;
          for (let it = 0; it <= JAL_IT; it++) {   // R2 (X03-27, absoluta): la mano gira alrededor del eje del puño (th) hasta quedar en línea con el antebrazo más la flexión afinada; punto fijo amortiguado, y una última vuelta con la mano ya fijada
            q = QA(ax, th).multiply(qH0); q = QA(jd.palm.clone().applyQuaternion(q), sgn * desvR).multiply(q); const W = wristFor(q); ik = solveLimb(pose, auth, chain, W, poleFor(W), [Lu, Lf], hingeA);
            if (it < JAL_IT) th += JAL_RELAX * wrapA(-sgn * munR + psiOf(W.clone().sub(ik.mid), ax) - psiH0 - th);
          }
          const dq = q.clone().multiply(qH0.clone().invert()); for (const k of subtree(hn)) pose[k].q = dq.clone().multiply(Rh.clone().multiply(auth[k].q));
          if (libH) for (const c in libH[S]) pose[c].q = q.clone().multiply(libH[S][c]);   // los dedos de la mano de la biblioteca (X03-28), relativos a la mano
          fkSub(pose, `DEF-SHOULDER.${S}`); jGrips.push(G); miss = Math.max(miss, ik.miss);
        }
        if (miss < 1e-5) break;
        bar.addScaledVector(shNow.clone().sub(bar).normalize(), miss + 0.001);   // alguna mano no llega: la barra se acerca (cede el codo, no la mano)
      }
    }
    if (md && !man) {   // muñeca de Blender: las manos son las de la acción y el maneral va donde lo pone la mano que tira
      const S = WS, e = md[S], qMS = pose[`DEF-HAND.${S}`].q.clone().multiply(e.relQ), grip = pose[`DEF-HAND.${S}`].p.clone().add(e.hg.clone().multiplyScalar(d.k).applyQuaternion(pose[`DEF-HAND.${S}`].q));
      const pM = grip.sub(e.ag.clone().applyQuaternion(qMS));
      man = { mesh: md.mesh, hook: pM, parts: md.rigid ? [qMS] : ['L', 'R'].filter(T => !one || T === WS).map(T => pose[`DEF-HAND.${T}`].q.clone().multiply(md[T].relQ)), grips: null };
    }
    if (one) {   // a un brazo: la mano libre sigue apoyada donde estaba en el muslo (si se dobla o estira la pierna, sube o baja con él)
      const S = WS === 'L' ? 'R' : 'L', hn = `DEF-HAND.${S}`, aw = auth[hn].p;
      const tb = ['L', 'R'].flatMap(T => [`DEF-THIGH01.${T}`, `DEF-THIGH02.${T}`]).reduce((a, n) => auth[n].p.distanceTo(aw) < auth[a].p.distanceTo(aw) ? n : a);
      const inv = auth[tb].q.clone().invert(), wrist = pose[tb].p.clone().add(aw.clone().sub(auth[tb].p).applyQuaternion(inv).multiplyScalar(kr).applyQuaternion(pose[tb].q));
      const qh = pose[tb].q.clone().multiply(inv).multiply(auth[hn].q), pole = poleOf(pose[`DEF-ARM01.${S}`].p, pose[`DEF-FORARM01.${S}`].p, pose[hn].p);
      solveLimb(pose, auth, [`DEF-ARM01.${S}`, `DEF-ARM02.${S}`, `DEF-FORARM01.${S}`, `DEF-FORARM0.${S}`, hn], wrist, pole, [LEN(S).Lu, LEN(S).Lf]);
      const qi = auth[hn].q.clone().invert(); for (const c of subtree(hn)) pose[c].q = qh.clone().multiply(qi.clone().multiply(auth[c].q));
      fkSub(pose, `DEF-SHOULDER.${S}`);
    }
    return { pose, bar, axis, warns, man, grips: man?.grips || (JALON(ex) ? jGrips : hinge && (one ? [WS] : ['L', 'R']).map(S => bar.clone().add(gripOff(S)))) };
    };
    // ---- equilibrio en lazo cerrado sobre la pose real: el centro de masas del sistema (cuerpo + barra)
    // se mantiene sobre el mediopié igual que en la pose autorada; se corrige con la inclinación del tronco.
    let phiA, bA, betaH = beta, thH = th;
    if (cable) {
      // polea: la pelvis queda en el asiento (la autorada). Sin equilibrio: sentado y con los pies apoyados
      phiA = F.phi + dRigid;   // «Tronco al inicio / al final» (X03-26): el giro hueso a hueso va en authQ
      // (en el jalón «Flexión de rodilla» está escondida y no actúa: con la pelvis deslizada el hombro se aleja del cable)
      // con «Flexión de rodilla» o con otras medidas, los pies no se mueven de la plataforma: la pelvis se desliza por el asiento
      // (delante/atrás) hasta que cada pierna mide lo que dan muslo y tibia con la rodilla autorada + el ajuste. Por defecto, 0
      const slide = ['L', 'R'].map(S => { const an = expP(ex, `DEF-FOOT.${S}`, s), th = auth[`DEF-THIGH01.${S}`].p, v = an.clone().sub(th);
        const lt0 = segLen(`DEF-THIGH01.${S}`, `DEF-SHIN01.${S}`, 1) / kk, ls0 = segLen(`DEF-SHIN01.${S}`, `DEF-FOOT.${S}`, 1) / kk, { Lt, Ls } = LEN(S);
        const K = Math.acos(clamp((v.lengthSq() - lt0 * lt0 - ls0 * ls0) / (2 * lt0 * ls0), -1, 1)) + (JALON(ex) ? 0 : prm.knees) * DEG, D2 = Lt * Lt + Ls * Ls + 2 * Lt * Ls * Math.cos(K);
        const hx = F.hip.x + (th.x - F.hip.x) * kr, hy = F.hip.y + (th.y - F.hip.y) * kr, ax = an.x * prm.stance * kr;
        return an.z - Math.sqrt(Math.max(0, D2 - (ax - hx) ** 2 - (an.y - hy) ** 2)) - (F.hip.z + (th.z - F.hip.z) * kr); });
      const hipC = F.hip.clone().add(V(0, 0, (slide[0] + slide[1]) / 2));
      // brazo estirado: con otro maneral, otra polea o la muñeca recta, la muñeca queda a otra distancia del hombro y el codo se
      // doblaría. El maneral se mueve a lo largo del brazo hasta que hombro→muñeca mide lo de la pose autorada en este frame (× k),
      // con todo el peso con los brazos estirados y nada al tirar (secante). Con la muñeca de Blender y por defecto, 0
      const reach = r => r.pose[`DEF-HAND.${WS}`].p.distanceTo(r.pose[`DEF-ARM01.${WS}`].p);
      bA = build(phiA, hipC);
      if (up < 1) {
        const r0 = reach(bA); let want = Math.min(r0 + (1 - up) * (auth[`DEF-HAND.${WS}`].p.distanceTo(auth[`DEF-ARM01.${WS}`].p) * kr - r0), 0.99 * (LEN(WS).Lu + LEN(WS).Lf));   // (el brazo no da más de lo que mide)
        if (JALON(ex)) want = Math.max(want, Math.abs(bA.pose[`DEF-HAND.${WS}`].p.x - bA.pose[`DEF-ARM01.${WS}`].p.x) + 0.01);   // ni la muñeca puede estar más cerca del hombro que lo que se aparta de lado (agarre ancho)
        if (Math.abs(r0 - want) > 0.0005) {   // (ya está: por defecto no se toca)
        // bisección (cerca del brazo recto la distancia se satura y una secante lo sacaba del alcance): alejar el maneral alarga
        // hombro→muñeca hasta que el brazo no da más; se queda en el último punto al que la mano llega
        const MAXS = JALON(ex) ? 0.12 * (1 - up) : 0.2;   // jalón: el brazo estirado mueve la barra como mucho 12 cm, y nada al final (up = 1): más era una raíz falsa (saltos de 17 cm al pasar de `up < 1` a `up = 1`)
        let lo = r0 < want ? 0 : -MAXS, hi = r0 < want ? MAXS : 0;
        for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2, b = build(phiA, hipC, m), ok = !b.warns.length;
          if (reach(b) < want && ok) lo = m; else hi = m; if (ok) bA = b; }
        }
      }
      const P = bA.pose, e = n => P[`${n}.${WS}`].p; out.elbow = 180 - e('DEF-ARM01').clone().sub(e('DEF-FORARM01')).angleTo(e('DEF-HAND').clone().sub(e('DEF-FORARM01'))) / DEG;
    } else if (row) {
      // remo: el tronco a la inclinación del ajuste y la rodilla con su ángulo autorado; el centro de masas (con la carga actual)
      // donde lo tiene la pose autorada en este frame (× k; sin recortarlo a la zona del pie: la pose es la de Blender) lo compensa la cadera: la pierna gira sobre
      // el tobillo (secante sobre la tibia). Por defecto, la autorada.
      const cRef = comOffset(auth, F.bar, L) * kr, Ka = F.beta + F.th, phR = F.phi + prm.trunk * DEG;
      const T_MIN = -12 * DEG, T_MAX = Math.min(45 * DEG, thLim);
      const E = t => { const r = build(phR, hipOf(Ka - t, t)); return [r, comOffset(r.pose, r.bar, L) - cRef]; };
      let t = th, [r, e] = E(t);
      for (let i = 0; i < 12 && Math.abs(e) > 0.0002; i++) {
        const [, e2] = E(t + 1e-3), j = (e2 - e) / 1e-3; if (Math.abs(j) < 1e-9) break;
        t = clamp(t - e / j, T_MIN, T_MAX); [r, e] = E(t);
      }
      if (Math.abs(e) > 0.01) r.warns.push(`Con el tronco así, el centro de masas se va ${Math.round(Math.abs(e) * 100)} cm ${e > 0 ? 'hacia delante' : 'hacia atrás'}`);
      phiA = phR; bA = r; betaH = Ka - t; thH = t;
      const hipNow = midOf(r.pose, 'DEF-THIGH01.L', 'DEF-THIGH01.R'), hipA = midOf(auth, 'DEF-THIGH01.L', 'DEF-THIGH01.R').add(drift);
      out.hipD = [hipNow.y - hipA.y, hipNow.z - hipA.z];
      const P = r.pose, elbow = 180 - P['DEF-ARM01.L'].p.clone().sub(P['DEF-FORARM01.L'].p).angleTo(P['DEF-HAND.L'].p.clone().sub(P['DEF-FORARM01.L'].p)) / DEG;
      out.elbow = elbow;
    } else if (hinge) {
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
    if (hinge) { out.grips = bA.grips; out.impl = one ? 'asa' : JALON(ex) ? 'barra_jalon' : prm.impl || 'barra'; }
    if (hinge && !cable && phi > 85 * DEG && betaH + thH < 45 * DEG) out.warns.push('Bajar tanto con la rodilla tan recta pide unos isquios muy flexibles');
    out.bar = { center: bar, axis };
    if (cable) {   // polea: el cable va de la polea al maneral; indicadores propios (sin centro de masas: sentado)
      const P = pulleyAt(ex, prm.pulleyH, prm.pulleyF), c = P.clone().sub(bA.man?.hook || bar);   // el cable sale del gancho del maneral
      // plataforma: fija, contra la planta de los pies de la pose de inicio (el giro del pie respecto al reposo aplicado a la
      // planta en reposo, que está en el suelo). Solo la anchura de pies la cambia
      const sole = ['L', 'R'].map(S => { const fn = `DEF-FOOT.${S}`, a = expP(ex, fn, 0), Rf = expQ(ex, fn, 0).multiply(REST[fn].q.clone().invert());
        const r = REST[fn].p, c0 = V(r.x, 0, (r.z + REST[`DEF-TOE.${S}`].p.z) / 2).sub(r).multiplyScalar(kk).applyQuaternion(Rf);
        return { p: V(a.x * prm.stance * kr, a.y, a.z).add(c0), n: V(0, -1, 0).applyQuaternion(Rf), up: V(0, 0, 1).applyQuaternion(Rf) }; });
      out.footPlate = { p: sole[0].p.clone().add(sole[1].p).multiplyScalar(0.5), n: sole[0].n, up: sole[0].up };
      out.pulley = P; out.path = bar.clone(); out.mid = bar.z; out.com = bar.z; out.maneral = bA.man;
      if (JALON(ex)) out.align = jalonAlign(ex, pose, bar, auth, F.bar, P, pulleyAt(ex, 0, 0), fineAt(ex, prm, s).muneca * DEG);   // R4 y criterios de robust.js: frente a la acción en este mismo s
      out.readout = [['Tronco', `${Math.round(chestTilt(pose) / DEG)}°`], ['Codo', `${Math.round(out.elbow)}°`], ['Cable', `${Math.round(Math.atan2(c.y, Math.hypot(c.x, c.z)) / DEG)}° sobre la horizontal`],
        ['Polea', `${Math.round(P.y * 100)} cm del suelo`]];
      out.phase = `codo ${Math.round(out.elbow)}°`;
      out.dem = demand(pose, ex, out); out.act = out.dem.act;
      return out;
    }
    const mf = midfootZ(pose), com = comOffset(pose, bar, L) + mf;
    // fuera del pie (talón ≈ 10 cm detrás del mediopié, punta ≈ 10 cm delante): se caería. P. ej. la salida del peso muerto
    // sin carga: sin la barra delante, el cuerpo queda 12 cm detrás.
    const edge = 0.10 * kk, off = com - mf;
    if (Math.abs(off) > edge) out.warns.push(`Se caería hacia ${off > 0 ? 'delante' : 'atrás'}: el centro de masas queda ${Math.round(Math.abs(off) * 100)} cm ${off > 0 ? 'por delante' : 'por detrás'} del mediopié, fuera del pie${L < 30 ? ' (con tan poca carga, la barra no hace de contrapeso)' : ''}`);
    out.path = bar.clone(); out.mid = mf; out.com = com;
    out.tib = thH;   // tibia que pide el solver, sin redondear (las pruebas la comparan con la de la pose)
    out.readout = [['Tronco', `${Math.round(phi / DEG)}°`], ['Muslo', `${Math.round(betaH / DEG)}°`], ['Tibia', `${Math.round(thH / DEG)}°`],
      ...(hinge ? [['Barra', `${Math.round(bar.y * 100)} cm del suelo`]] : []), ['CdM–mediopié', `${((com - mf) * 100).toFixed(1)} cm`],
      ['Barra–mediopié', `${((bar.z - mf) * 100).toFixed(1)} cm`]];
    // qué ha ajustado: el muslo en el punto bajo para llegar a la barra (se reparte hasta arriba)
    // qué ha ajustado: dónde queda la cadera respecto a la autorada en este frame
    const [hy, hz] = (hinge && out.hipD) || [0, 0], cm = v => Math.round(Math.abs(v) * 100);
    if (cm(hy) || cm(hz)) out.readout.push(['Cadera', `${cm(hy) ? `${cm(hy)} cm más ${hy > 0 ? 'alta' : 'baja'}` : ''}${cm(hy) && cm(hz) ? ' y ' : ''}${cm(hz) ? `${cm(hz)} cm más ${hz > 0 ? 'adelante' : 'atrás'}` : ''} que la autorada`]);
    out.phase = `muslo ${Math.round(betaH / DEG)}°`;
    if (row) { out.readout.splice(1, 0, ['Codo', `${Math.round(out.elbow)}°`]); out.phase = `codo ${Math.round(out.elbow)}°`; }
  } else if (SOBRE_LIBRE.includes(exd.base)) {
    // LIBRE (X03-02): la pose autorada tal cual, con la altura del cliente y nada más (sin STRETCH por segmento: con otro fémur los pies
    // deslizarían o atravesarían el suelo y aquí no hay quien lo corrija). Todo el mundo (cuerpo, barra, banco) se escala por K() desde el
    // origen, así los pies siguen en el suelo. Sin equilibrio ni ajustes; `flat` hace que applyPose tampoco estire los huesos.
    const k = kk, Pa = libreAt(ex, s, bf.height);
    Object.assign(pose, Pa); out.flat = true;
    if (F.bar) out.bar = { center: F.bar.clone().multiplyScalar(k), axis: F.barAxis.clone() };
    out.props = (POSES.exercises[ex].meta.props || []).map(([c, z]) => [V(...c).multiplyScalar(k), V(...z).multiplyScalar(k)]);   // cajas fijas [centro, tamaño] (banco, cajón)
    const meta = POSES.exercises[ex].meta, ev = { floor: evalFloor, split: evalSplit, bench: evalBench }[exd.base];
    if (ev) withBody({ ...DEFAULT_BODY, height: bf.height }, () => ev(ex, s, out, clonePose(Pa), prm, bf.dorsi));   // X03-07: los ajustes como diferencias sobre la pose de libre
    if (!F.bar && meta.carga === 'manos' && prm.load > 0) { out.impl = 'mancuernas_lado'; out.grips = ['L', 'R'].map(S => gripOf(pose, S)); }   // sin barra y con carga en las manos: las mancuernas del visor
    out.path = midOf(pose, 'DEF-ARM01.L', 'DEF-ARM01.R'); out.mid = null; out.phase = 'la animación de Blender';
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
      const Fs = F[S], dYaw = sgn * (prm.toes ?? 0) * DEG;
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
    const kn = pose['DEF-SHIN01.L'].p.clone().sub(pose['DEF-THIGH01.L'].p).angleTo(pose['DEF-FOOT.L'].p.clone().sub(pose['DEF-SHIN01.L'].p));
    out.path = plate.clone(); out.mid = null;
    out.readout = [['Rodilla', `${Math.round(kn / DEG)}°`], ['Recorrido total', `${Math.round(T.length() * (prm.depth + prm.startOff / 100 / T.length()) * legR * 100)} cm`]];
    out.phase = `rodilla ${Math.round(kn / DEG)}°`;
  }
  out.dem = demand(pose, ex, out); out.act = out.dem ? out.dem.act : {};
  return out;
}

/* ---------------- Bases sobre `libre`: floor, split y bench (X03-07) ---------------- */
// Cada una parte de la pose de `libre` (la animación de Blender escalada por la altura, sin estirar huesos) y aplica sus ajustes como DIFERENCIAS:
// con todo en su valor por defecto no toca nada (0,0 mm). Se llaman con el cuerpo `{ ...DEFAULT_BODY, height }` (sin STRETCH por segmento) y reciben
// `out.pose` (a modificar) y `A`, una copia de la pose de partida. Piezas: solveLimb + fkSub (`limbTo`), poleOf y el avance del gesto `avance`.
const SOBRE_LIBRE = ['libre', 'floor', 'split', 'bench'];
function libreAt(ex, s, height) {   // la pose de `libre` en s (también fuera del frame actual)
  const k = height / 180, Pa = withBody({ ...DEFAULT_BODY, height }, () => authoredPose(ex, s)), T = Pa['DEF-HIPS'].p.clone().multiplyScalar(k - 1);
  for (const n of BN) Pa[n].p.add(T);
  return Pa;
}
// avance del gesto w(s): 0 en la clave de inicio y 1 en la de final, medido con el punto que se mueve (`pt`) proyectado sobre la recta entre sus dos extremos
const AVANCE = {};
const avance = (ex, pt, A) => { const e = AVANCE[ex] ??= [0, 1].map(s => pt(libreAt(ex, s, 180))), d = e[1].clone().sub(e[0]), l2 = d.lengthSq();
  return l2 < 1e-8 ? 0 : clamp(pt(A).divideScalar(K()).sub(e[0]).dot(d) / l2); };
const LIMB = { leg: ['THIGH01', 'THIGH02', 'SHIN01', 'SHIN02', 'FOOT'], arm: ['ARM01', 'ARM02', 'FORARM01', 'FORARM0', 'HAND'] };
// pierna o brazo S de P hasta `target` con las longitudes de A (rígidas); el pie o la mano conservan su giro de mundo
function limbTo(P, A, kind, S, target, pole) {
  const n = LIMB[kind].map(x => `DEF-${x}.${S}`), ik = solveLimb(P, A, n, target, pole ?? poleOf(A[n[0]].p, A[n[2]].p, A[n[4]].p), [A[n[0]].p.distanceTo(A[n[2]].p), A[n[2]].p.distanceTo(A[n[4]].p)]);
  fkSub(P, kind === 'leg' ? n[0] : `DEF-SHOULDER.${S}`);
  return ik;
}
const LADO = { L: 1, R: -1 };
const aviso = (out, ik, que) => { if (ik.miss > 0.01) out.warns.push(`${que} no llega (${Math.round(ik.miss * 100)} cm)`); };
const bisec = (g, lo, hi) => { if (g(lo) >= 0) return lo; if (g(hi) <= 0) return hi; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; } return (lo + hi) / 2; };   // g creciente

// FLOOR · flexiones. Manos y pies fijos en el suelo; el cuerpo es una tabla rígida que gira alrededor de las puntas de los pies.
const FLOOR_TOP = {};
function evalFloor(ex, s, out, A, prm) {
  const hs = prm.hands / 100, hp = prm.handPos / 100, rot = prm.handRot * DEG, push = prm.push / 100;
  if (hs === 1 && !hp && !rot && !push) return;
  const P = out.pose, shM = Q => midOf(Q, 'DEF-ARM01.L', 'DEF-ARM01.R'), toeM = Q => midOf(Q, 'DEF-TOE.L', 'DEF-TOE.R'), th = Q => { const v = shM(Q).sub(toeM(Q)); return Math.atan2(v.y, v.z); };
  // ángulo de la tabla con el suelo arriba (t0) y abajo (t1); el de abajo no cambia. El de arriba sube o baja D0 para que el brazo quede igual de estirado
  // con las manos donde se piden (más abiertas o más lejos, el cuerpo queda más bajo)
  const key = `${ex}|${state.body.height}|${prm.hands}|${prm.handPos}`;
  const T0 = FLOOR_TOP[key] ??= (() => { const A0 = libreAt(ex, 0, state.body.height), A1 = libreAt(ex, 1, state.body.height), sh = A0['DEF-ARM01.L'].p, h = A0['DEF-HAND.L'].p,
    O = toeM(A0), W = h.clone(), d0 = sh.distanceTo(h); W.x *= hs; W.z -= hp;
    return { t0: th(A0), t1: th(A1), D0: hs === 1 && !hp ? 0 : bisec(D => sh.clone().sub(O).applyQuaternion(QA(X, -D)).add(O).distanceTo(W) - d0, th(A1) - th(A0), 25 * DEG) }; })();   // abajo del todo (la tabla del final) es lo más bajo que puede llegar
  const dt = T0.t0 - T0.t1, Dl = Math.abs(dt) < 1e-4 ? 0 : T0.D0 * (th(A) - T0.t1) / dt;   // lo que sube el cuerpo ahora
  const R = QA(X, -Dl), O = toeM(A);
  if (Dl) for (const n of BN) { P[n].p = P[n].p.clone().sub(O).applyQuaternion(R).add(O); P[n].q = R.clone().multiply(P[n].q); }
  for (const S of ['L', 'R']) P[`DEF-TOE.${S}`].q = A[`DEF-TOE.${S}`].q.clone();   // la punta sigue plana en el suelo
  if (push) {   // los pies ruedan sobre las puntas (hasta 80°): el tobillo avanza push·w y el cuerpo se traslada con él; luego gira alrededor del tobillo para que los hombros no bajen
    const w = avance(ex, shM, A), a = ['L', 'R'].map(S => P[`DEF-FOOT.${S}`].p.clone().sub(P[`DEF-TOE.${S}`].p)).reduce((x, y) => x.add(y)).multiplyScalar(0.5),
      rho = Math.hypot(a.y, a.z), al = Math.atan2(a.z, a.y), al2 = Math.asin(clamp((a.z + push * w) / rho, -1, Math.sin(80 * DEG))), T = V(0, rho * Math.cos(al2) - a.y, rho * Math.sin(al2) - a.z);
    for (const n of BN) if (!/-TOE\./.test(n)) P[n].p.add(T);
    const An = midOf(P, 'DEF-FOOT.L', 'DEF-FOOT.R'), r = shM(P).sub(An), Rp = QA(X, -(Math.asin(clamp((r.y - T.y) / Math.hypot(r.y, r.z), -1, 1)) - Math.atan2(r.y, r.z)));   // r.y − T.y: la altura que tenían los hombros
    for (const n of BN) if (!/-TOE\./.test(n)) { P[n].p = P[n].p.clone().sub(An).applyQuaternion(Rp).add(An); if (!/-FOOT\./.test(n)) P[n].q = Rp.clone().multiply(P[n].q); }
    for (const S of ['L', 'R']) P[`DEF-FOOT.${S}`].q = QA(X, al2 - al).multiply(P[`DEF-FOOT.${S}`].q);
  }
  for (const S of ['L', 'R']) {   // brazos a las manos nuevas; la mano conserva su giro (más handRot, alrededor de la vertical)
    const g = LADO[S], h = A[`DEF-HAND.${S}`].p, W = h.clone(), dq = QA(Y, g * rot);
    W.x *= hs; W.z -= hp;
    for (const c of subtree(`DEF-HAND.${S}`)) P[c].q = dq.clone().multiply(A[c].q);
    const pole = poleOf(A[`DEF-ARM01.${S}`].p, A[`DEF-FORARM01.${S}`].p, h).applyQuaternion(R);
    if (rot) pole.applyAxisAngle(P[`DEF-ARM01.${S}`].p.clone().sub(W).normalize(), g * 0.7 * rot);   // + = codos más pegados
    aviso(out, limbTo(P, A, 'arm', S, W, pole), `La mano ${S === 'L' ? 'izquierda' : 'derecha'}`);
  }
}

// SPLIT · sentadilla búlgara. Pie de delante plantado; el de atrás, en el banco. La pelvis sigue a la rodilla de delante (dorsiflexión).
function evalSplit(ex, s, out, A, prm, dorsi) {
  const st = prm.stride / 100, bh = prm.benchH / 100, tr = prm.trunk * DEG, sx = prm.stance / 100, dd = (dorsi - 35) * DEG;
  if (!st && !bh && !tr && sx === 1 && !dd) return;
  const P = out.pose, F = A['DEF-FOOT.L'].p.z >= A['DEF-FOOT.R'].p.z ? 'L' : 'R', B = F === 'L' ? 'R' : 'L', hipM = Q => midOf(Q, 'DEF-THIGH01.L', 'DEF-THIGH01.R'), w = avance(ex, hipM, A);
  // dorsiflexión: la tibia de delante gira (dorsi − 35)·w alrededor del tobillo (sin pasar de dorsi); el muslo conserva su orientación,
  // así que la pelvis, el tronco y los brazos se trasladan lo que se mueve la rodilla
  const v = A[`DEF-SHIN01.${F}`].p.clone().sub(A[`DEF-FOOT.${F}`].p);
  let dl = dd * w; if (dl > 0) dl = Math.min(dl, Math.max(0, dorsi * DEG - Math.atan2(v.z, v.y)));
  const T = v.clone().applyQuaternion(QA(X, dl)).sub(v);
  for (const n of BN) P[n].p.add(T);
  if (tr) {   // el tronco gira alrededor de la cadera; los brazos cuelgan (se trasladan con los hombros sin girar)
    const R = QA(X, tr), H = hipM(P);
    for (const n of subtree('DEF-SPINE01')) { P[n].p = P[n].p.clone().sub(H).applyQuaternion(R).add(H); P[n].q = R.clone().multiply(P[n].q); }
    for (const S of ['L', 'R']) { const a = `DEF-ARM01.${S}`, d = P[a].p.clone().sub(A[a].p); for (const c of subtree(a)) { P[c].p = A[c].p.clone().add(d); P[c].q = A[c].q.clone(); } }
  }
  const tg = {}; for (const S of ['L', 'R']) { tg[S] = A[`DEF-FOOT.${S}`].p.clone(); if (S === B) tg[S].add(V(0, bh, -st)); tg[S].x *= sx; }   // tobillos: el de delante no se mueve; el de atrás sigue al banco
  // si una pierna no llega (zancada larga, banco bajo: la pelvis de arriba queda alta), todo el cuerpo baja lo justo para que llegue
  let down = 0;
  for (let i = 0; i < 8; i++) {
    const m = Math.max(...['L', 'R'].map(S => { const v = P[`DEF-THIGH01.${S}`].p.clone().sub(tg[S]).sub(V(0, down, 0)), l = A[`DEF-THIGH01.${S}`].p.distanceTo(A[`DEF-SHIN01.${S}`].p) + A[`DEF-SHIN01.${S}`].p.distanceTo(A[`DEF-FOOT.${S}`].p), q = v.length() - 0.999 * l;
      return q <= 0 ? 0 : q / Math.max(0.3, v.y / v.length()); }));
    if (!m) break; down += m;
  }
  if (down) for (const n of BN) P[n].p.y -= down;
  for (const S of ['L', 'R']) aviso(out, limbTo(P, A, 'leg', S, tg[S]), `La pierna de ${S === F ? 'delante' : 'atrás'}`);
  if (out.props[0]) { const [c, z] = out.props[0]; out.props[0] = [V(c.x, c.y + bh / 2, c.z - st), V(z.x, z.y + bh, z.z)]; }   // el banco se aleja con el tobillo y sube con su altura
}

// BENCH · press de banca (carga en las manos) y hip thrust (carga en la cadera). Tronco o escápulas fijos en el banco, pies en el suelo.
const BENCH_TOP = {};
function evalBench(ex, s, out, A, prm) {
  const P = out.pose, sx = prm.stance / 100, press = CARGA(ex, 'manos'), hipM = Q => midOf(Q, 'DEF-THIGH01.L', 'DEF-THIGH01.R'), shM = Q => midOf(Q, 'DEF-ARM01.L', 'DEF-ARM01.R');
  const legs = dz => { for (const S of ['L', 'R']) { const t = A[`DEF-FOOT.${S}`].p.clone(); t.x *= sx; t.z += dz; aviso(out, limbTo(P, A, 'leg', S, t), `La pierna ${S === 'L' ? 'izquierda' : 'derecha'}`); } };
  if (press) {
    const g = prm.grip / 100, tc = prm.touch / 100, el = prm.elbows * DEG;
    if (g === 1 && !tc && !el && sx === 1) return;
    // arriba la barra sube o baja (dy) para que el brazo quede igual de estirado con el agarre nuevo; abajo toca el pecho donde toca (más `touch` a lo largo del tronco)
    const key = `${ex}|${state.body.height}|${prm.grip}`;
    const dy = BENCH_TOP[key] ??= (() => { const A0 = libreAt(ex, 0, state.body.height), sh = A0['DEF-ARM01.L'].p, h = A0['DEF-HAND.L'].p, d0 = sh.distanceTo(h);
      return g === 1 ? 0 : bisec(d => V(h.x * g, h.y + d, h.z).distanceTo(sh) - d0, -0.4, 0.2); })();
    const w = avance(ex, Q => midOf(Q, 'DEF-HAND.L', 'DEF-HAND.R'), A), D = V(0, dy * (1 - w), 0).addScaledVector(hipM(A).sub(shM(A)).normalize(), tc * w);
    for (const S of ['L', 'R']) {
      const h = A[`DEF-HAND.${S}`].p, W = h.clone(), pole = poleOf(A[`DEF-ARM01.${S}`].p, A[`DEF-FORARM01.${S}`].p, h);
      W.x *= g; W.add(D);
      if (el) pole.applyAxisAngle(W.clone().sub(P[`DEF-ARM01.${S}`].p).normalize(), LADO[S] * el);   // + = codos más abiertos
      aviso(out, limbTo(P, A, 'arm', S, W, pole), `La mano ${S === 'L' ? 'izquierda' : 'derecha'}`);
    }
    if (out.bar) out.bar.center.add(D);
    if (sx !== 1) legs(0);
    return;
  }
  // hip thrust: los hombros (escápulas) son el pivote y suben o bajan con el banco (b); la cadera sube b·w (al empezar sigue en el suelo): el cuerpo gira alrededor de los hombros
  const b = prm.benchH / 100, f = prm.feet / 100;
  if (!b && !f && sx === 1) return;
  const w = avance(ex, hipM, A), S1 = shM(A).add(V(0, b, 0)), H0 = hipM(A), r0 = H0.clone().sub(S1.clone().sub(V(0, b, 0))), rho = Math.hypot(r0.y, r0.z);
  const a0 = Math.atan2(r0.y, r0.z), a1 = Math.asin(clamp((r0.y + b * w - b) / rho, -1, 1)), Rr = QA(X, -(a1 - a0));   // la cadera acaba en H0.y + b·w
  const xf = p => p.clone().add(V(0, b, 0)).sub(S1).applyQuaternion(Rr).add(S1);
  for (const n of BN) { P[n].p = xf(P[n].p); P[n].q = Rr.clone().multiply(P[n].q); }
  for (const S of ['L', 'R']) for (const n of ['FOOT', 'TOE']) P[`DEF-${n}.${S}`].q = A[`DEF-${n}.${S}`].q.clone();   // los pies siguen planos en el suelo
  if (out.bar) out.bar.center.copy(xf(out.bar.center));
  legs(f);
  if (out.props[0]) { const [c, z] = out.props[0]; out.props[0] = [V(c.x, c.y + b / 2, c.z), V(z.x, z.y + b, z.z)]; }
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
const MU = { uAct: { value: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, uHeat: { value: 1 }, uLo: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHi: { value: new THREE.Color() },
  uHip: { value: V() }, uKnee: { value: V() }, uAnk: { value: V() }, uPelvis: { value: V() }, uChest: { value: V() }, uShoulder: { value: V() }, uElbow: { value: V() }, uWrist: { value: V() }, uS: { value: 1 } };
const GLSL = `
varying vec3 vRP; varying vec3 vRN;
uniform float uAct[12]; uniform float uHeat; uniform vec3 uLo, uMid, uHi, uHip, uKnee, uAnk, uPelvis, uChest, uShoulder, uElbow, uWrist; uniform float uS;
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
  // tracción y empuje (X03-13): el reposo es con los brazos en cruz y las palmas hacia abajo (el brazo va a lo largo de X)
  float armD = segD(p, uShoulder, uElbow), armT = segT(p, uShoulder, uElbow);
  float upper = (1. - st(armD, 0.055*uS)) * st(armT, .18) * (1. - st(armT, .92));
  float biceps  = upper * st(n.z, .05);
  float triceps = upper * st(-n.z, .05);
  float delts = (1. - st(length(p - uShoulder), 0.10*uS)) * (1. - st(armT, .22)) * st(p.x, uShoulder.x - 0.04*uS);
  float torsoX = 1. - st(p.x, uShoulder.x + 0.005*uS);   // dentro del tronco, no en el brazo
  float pecs = torsoX * st(p.x, .015*uS) * st(n.z, .35) * st(p.y, uShoulder.y - 0.17*uS) * (1. - st(p.y, uShoulder.y - 0.02*uS));
  float lats = torsoX * st(p.x, .07*uS) * st(-n.z, .25) * st(p.y, uPelvis.y + 0.27*uS) * (1. - st(p.y, uShoulder.y - 0.05*uS));
  // abdominales (X03-19): delante del tronco, entre la pelvis y el pecho (por debajo del pectoral)
  float abdo = (1. - st(p.x, .07*uS)) * st(n.z, .35) * st(p.y, uPelvis.y + 0.04*uS) * (1. - st(p.y, uShoulder.y - 0.20*uS));
  vec3 c = base;
  c = mix(c, heatC(tint, uAct[11]), abdo);
  c = mix(c, heatC(tint, uAct[0]), quads); c = mix(c, heatC(tint, uAct[1]), glut); c = mix(c, heatC(tint, uAct[2]), hams);
  c = mix(c, heatC(tint, uAct[3]), add);   c = mix(c, heatC(tint, uAct[4]), erect); c = mix(c, heatC(tint, uAct[5]), calf);
  c = mix(c, heatC(tint, uAct[6]), lats); c = mix(c, heatC(tint, uAct[7]), pecs); c = mix(c, heatC(tint, uAct[9]), biceps);
  c = mix(c, heatC(tint, uAct[10]), triceps); c = mix(c, heatC(tint, uAct[8]), delts);   // el deltoides, el último: va encima
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
// acciones `libre` (X03-02): cajas fijas de la acción (banco, cajón…), [centro, tamaño] ya escalados por K()
const fixedBoxes = [];
function placeBoxes(list) {
  while (fixedBoxes.length < list.length) { const b = withOutline(new THREE.BoxGeometry(1, 1, 1), padMat); scene.add(b); fixedBoxes.push(b); }
  fixedBoxes.forEach((b, i) => { b.visible = !!list[i]; if (list[i]) { b.position.copy(list[i][0]); b.scale.copy(list[i][1]); } });
}
// polea (remo en polea): columna con la polea, cable, asiento bajo la pelvis, plataforma bajo los pies y el maneral (triángulo,
// barra recta o cuerda). Los tramos son cilindros de alto 1 que se colocan entre dos puntos (strut)
const cableG = new THREE.Group(); scene.add(cableG);
const cyl = (r, mat) => withOutline(new THREE.CylinderGeometry(r, r, 1, 12), mat);
const strut = (m, a, b) => { const d = b.clone().sub(a); m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(1, Math.max(d.length(), 1e-4), 1); m.quaternion.setFromUnitVectors(Y, d.normalize()); };
const colMat = toon(0x5a6170);   // propio de la columna: se vuelve translúcida de frente (X03-27)
const CBL = { column: withOutline(new THREE.BoxGeometry(0.12, 1, 0.12), colMat), wheel: withOutline(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), ironMat),
  cable: cyl(0.004, toon(0x1d2027)), seat: withOutline(new THREE.BoxGeometry(0.36, 1, 0.42), padMat), foot: withOutline(new THREE.BoxGeometry(0.5, 0.32, 0.04), toon(0x2b2f37)),
  bar: cyl(0.014, steelMat), grips: [0, 1].map(() => cyl(0.016, steelMat)), arms: [0, 1].map(() => cyl(0.012, steelMat)), ropes: [0, 1].map(() => cyl(0.012, toon(0x1d2027))) };
CBL.wheel.rotation.z = Math.PI / 2;
cableG.add(CBL.column, CBL.wheel, CBL.cable, CBL.seat, CBL.foot, CBL.bar, ...CBL.grips, ...CBL.arms, ...CBL.ropes);
// mallas de los manerales (poses.json › manerales, del .blend): dos por malla (la cuerda lleva un ramal por mano)
const MANMESH = {};
function manMeshes(name) {
  if (MANMESH[name]) return MANMESH[name];
  const d = POSES.manerales[name], g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3)); g.setIndex(d.idx); g.computeVertexNormals();
  return (MANMESH[name] = [0, 1].map(() => { const o = withOutline(g, steelMat); cableG.add(o); return o; }));
}
function placeCable(ex, r) {
  const P = r.pulley, c = r.bar.center, g = r.grips, impl = r.impl, fwd = P.clone().sub(c).setX(0).normalize();
  const jal = impl === 'barra_jalon';   // jalón: la columna va delante, pasados los pies (el maniquí mira a la máquina), y un brazo llega hasta la polea
  const colZ = jal ? r.footPlate.p.z + 0.3 : P.z + 0.1;
  CBL.column.scale.y = 2.1; CBL.column.position.set(P.x, 1.05, colZ); CBL.wheel.position.copy(P);
  // el cable se engancha delante del maneral: en el vértice del triángulo, en el centro de la barra o en el nudo de la cuerda
  const mn = r.maneral;   // maneral del .blend: su malla, pivotando en el gancho
  for (const k in MANMESH) MANMESH[k].forEach(o => { o.visible = false; });
  if (mn) manMeshes(mn.mesh).forEach((o, i) => { o.visible = !!mn.parts[i]; if (o.visible) { o.position.copy(mn.at?.[i] || mn.hook); o.quaternion.copy(mn.parts[i]); } });
  const hook = mn ? mn.hook : c.clone().addScaledVector(fwd, impl === 'barra_recta' || impl === 'barra_jalon' ? 0 : impl === 'cuerda' ? 0.16 : impl === 'asa' ? 0.07 : 0.11);
  strut(CBL.cable, hook, P);
  if (mn) { [CBL.bar, ...CBL.grips, ...CBL.arms, ...CBL.ropes].forEach(m => { m.visible = false; }); placeSeat(ex, r); return; }
  CBL.bar.visible = impl === 'barra_recta'; if (CBL.bar.visible) strut(CBL.bar, c.clone().add(V(-0.36, 0, 0)), c.clone().add(V(0.36, 0, 0)));
  CBL.grips.forEach((m, i) => { m.visible = impl !== 'barra_recta' && impl !== 'barra_jalon' && !!g[i]; if (m.visible) strut(m, g[i].clone().add(V(0, -0.06, 0)), g[i].clone().add(V(0, 0.06, 0))); });
  CBL.arms.forEach((m, i) => { m.visible = impl === 'triangulo' || impl === 'asa'; if (!m.visible) return;
    if (impl === 'asa') strut(m, g[0].clone().add(V(0, i ? 0.06 : -0.06, 0)), hook); else strut(m, g[i], hook); });   // asa en D: de los extremos del agarre al gancho
  if (jal) { CBL.arms[0].visible = true; strut(CBL.arms[0], V(P.x, P.y, colZ), P); }
  CBL.ropes.forEach((m, i) => { m.visible = impl === 'cuerda'; if (m.visible) strut(m, g[i].clone().add(V(0, 0.06, 0)), hook); });
  placeSeat(ex, r);
}
function placeSeat(ex, r) {
  // asiento y plataforma: con la pose de inicio exportada (no se mueven con la animación); la plataforma, contra la planta
  const B = POSES.exercises[ex].start.bones, Pb = n => V(...B[n].p), hip = Pb('DEF-THIGH01.L').add(Pb('DEF-THIGH01.R')).multiplyScalar(0.5);
  const top = hip.y - 0.1; CBL.seat.scale.y = top; CBL.seat.position.set(0, top / 2, hip.z - 0.02);
  const fp = r.footPlate, side = fp.up.clone().cross(fp.n).normalize();   // plataforma: contra la planta (su normal sale del pie)
  CBL.foot.position.copy(fp.p).addScaledVector(fp.n, 0.02).setX(0);
  CBL.foot.visible = !(JALON(ex) || fp.p.y < 0.05);   // pies en el suelo (jalón): sin plataforma, que haría clipping con él
  CBL.foot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, fp.up, fp.n));
}
const lineMat = new THREE.LineDashedMaterial({ color: 0x2453cf, dashSize: 0.04, gapSize: 0.03 });
const midLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0.002, 0), V(0, 2.1, 0)]), lineMat); midLine.computeLineDistances(); scene.add(midLine);
const pathMat = new THREE.LineBasicMaterial({ color: 0x2453cf }); const pathLine = new THREE.Line(new THREE.BufferGeometry(), pathMat); scene.add(pathLine);
// referencia: esqueleto autorado (para comparar)
const refMat = new THREE.LineBasicMaterial({ color: 0xe8452a, depthTest: false, transparent: true, opacity: 0.9 });
const refLines = new THREE.LineSegments(new THREE.BufferGeometry(), refMat); refLines.renderOrder = 5; scene.add(refLines);
// capas de fuerza (X03-17): resistencia, apoyo y brazos de momento, dibujadas con mallas (grosor de verdad) y con un depósito de mallas que se
// reutiliza cada frame (se crean las que faltan y se esconden las que sobran: nada de crear geometrías por frame). Equilibrio y trayectoria son
// midLine y pathLine. Cada capa tiene su color, su botón y su estado (state.lyRes, lySup, lyArm, lyBal, lyPath).
const layerG = new THREE.Group(); scene.add(layerG);
const unit = { cyl: new THREE.CylinderGeometry(1, 1, 1, 10), cone: new THREE.ConeGeometry(1, 1, 14), ball: new THREE.SphereGeometry(1, 14, 10) };
const LAYER = Object.fromEntries([['res', 0x7a3ff2], ['sup', 0x1f9d55], ['arm', 0x1a1e26]].map(([k, c]) => {
  const mat = new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true }), L = { mat };   // transparente: se pinta después de los discos translúcidos
  for (const t in unit) { const items = []; let n = 0;
    L[t] = { begin: () => { n = 0; },
      next() { if (n === items.length) { const m = new THREE.Mesh(unit[t], mat); m.renderOrder = t === 'cyl' ? 6 : 7; m.frustumCulled = false; layerG.add(m); items.push(m); } const m = items[n++]; m.visible = true; return m; },
      end: () => { for (let i = n; i < items.length; i++) items[i].visible = false; } }; }
  return [k, L]; }));
// cilindro de radio r de a a b (strut deja la escala en (1, largo, 1): el radio va en x y z)
const bar3 = (L, a, b, r) => { const m = L.cyl.next(); strut(m, a, b); m.scale.x = m.scale.z = r; };
const cone3 = (L, base, d, h, r) => { const m = L.cone.next(); m.position.copy(base).addScaledVector(d, h / 2); m.quaternion.setFromUnitVectors(Y, d); m.scale.set(r, h, r); };
const ball3 = (L, p, r) => { const m = L.ball.next(); m.position.copy(p); m.scale.setScalar(r); };
// flecha: tallo (radio 0,010) y punta de cono (radio 0,028, alto 0,07); sale de `tail` hacia d y acaba en tail + d·len
const arrow3 = (L, tail, d, len) => { const base = tail.clone().addScaledVector(d, len - 0.07); bar3(L, tail, base, 0.010); cone3(L, base, d, 0.07, 0.028); };
// resultante de un grupo de fuerzas: vector = su suma; punto = media de sus puntos ponderada por su módulo (null si es nula)
const resultant = fs => { const f = V(), p = V(); let w = 0; for (const x of fs) { const m = x.f.length(); f.add(x.f); p.addScaledVector(x.p, m); w += m; }
  return f.length() > 1e-4 && w > 1e-4 ? { f, p: p.divideScalar(w), d: f.clone().normalize() } : null; };
const actionLine = (L, p, d, half) => bar3(L, p.clone().addScaledVector(d, -half), p.clone().addScaledVector(d, half), 0.0035);
// etiquetas HTML sobre el lienzo: se reutilizan; se colocan después de render proyectando el punto 3D
const stageEl = canvas.parentElement, LBL = { items: [], list: [] };
const label = (text, p, color) => LBL.list.push({ text, p: p.clone(), color });
function placeLabels() {
  const w = canvas.clientWidth, h = canvas.clientHeight, placed = [];
  while (LBL.items.length < LBL.list.length) { const e = document.createElement('div'); e.className = 'flabel'; stageEl.appendChild(e); LBL.items.push(e); }
  LBL.items.forEach((e, i) => { const l = LBL.list[i]; e.hidden = !l; if (!l) return;
    const v = l.p.clone().project(camera); let x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
    for (let k = 0; k < 6 && placed.some(q => Math.abs(q[0] - x) < 54 && Math.abs(q[1] - y) < 17); k++) y += 17;   // si dos se pisan, la segunda baja
    placed.push([x, y]); e.textContent = l.text; e.style.color = l.color; e.style.left = `${x}px`; e.style.top = `${y}px`; });
  LBL.list.length = 0;
}
// ángulo de cada articulación en el 3D (X03-18): las dos direcciones entre las que se mide (rodilla y codo: la prolongación del segmento de arriba y el de abajo,
// así el arco mide justo la flexión)
const dv = (P, a, b) => P[b].p.clone().sub(P[a].p);
const ARCOS = {
  ankle: (P, S) => [dv(P, `DEF-FOOT.${S}`, `DEF-SHIN01.${S}`), dv(P, `DEF-FOOT.${S}`, `DEF-TOE.${S}`)],
  knee: (P, S) => [dv(P, `DEF-THIGH01.${S}`, `DEF-SHIN01.${S}`), dv(P, `DEF-SHIN01.${S}`, `DEF-FOOT.${S}`)],
  hip: (P, S) => [ejesCuerpo(P).hip.clone().sub(P['DEF-SPINE01'].p), dv(P, `DEF-THIGH01.${S}`, `DEF-SHIN01.${S}`)],
  lumbar: P => [P['DEF-SPINE01'].p.clone().sub(ejesCuerpo(P).hip), dv(P, 'DEF-SPINE01', 'DEF-CHEST')],
  shoulder: (P, S) => [ejesCuerpo(P).uT.clone().negate(), dv(P, `DEF-ARM01.${S}`, `DEF-FORARM01.${S}`)],
  elbow: (P, S) => [dv(P, `DEF-ARM01.${S}`, `DEF-FORARM01.${S}`), dv(P, `DEF-FORARM01.${S}`, `DEF-HAND.${S}`)],
};
// arco fino de radio 0,08 m en J entre las direcciones d1 y d2
function arco(L, J, d1, d2) {
  d1 = d1.clone().normalize(); d2 = d2.clone().normalize();
  const ax = d1.clone().cross(d2), th = d1.angleTo(d2); if (ax.length() < 1e-4 || th < 0.02) return;
  ax.normalize(); const N = Math.ceil(th / 0.2); let a = J.clone().addScaledVector(d1, 0.08);
  for (let i = 1; i <= N; i++) { const b = J.clone().addScaledVector(d1.clone().applyAxisAngle(ax, th * i / N), 0.08); bar3(L, a, b, 0.006); a = b; }
}
function drawLayers(dem, prm, P) {
  for (const k in LAYER) for (const t in unit) LAYER[k][t].begin();
  if (dem) {
    // resistencia: UNA flecha por la resultante de las cargas, que acaba en su punto de aplicación (viene de fuera hacia la carga), y su línea de acción
    const res = state.lyRes && resultant(dem.forces.filter(f => f.tipo === 'carga'));
    if (res) { const len = clamp(0.35 * res.f.length(), 0.12, 0.6), tail = res.p.clone().addScaledVector(res.d, -len);
      arrow3(LAYER.res, tail, res.d, len); actionLine(LAYER.res, res.p, res.d, 1.2); if (state.lyNum) label(`${Math.round(prm.load)} % PC`, tail, '#7a3ff2'); }
    // apoyo: una flecha por cada fuerza de apoyo (sale del punto de apoyo) y la línea de acción de su resultante
    if (state.lySup) { const ap = dem.forces.filter(f => f.tipo === 'apoyo' && f.f.length() > 1e-4);
      const dicho = new Set();   // una sola etiqueta si los dos lados dicen lo mismo
      for (const f of ap) { const d = f.f.clone().normalize(), len = clamp(0.35 * f.f.length(), 0.12, 0.6); arrow3(LAYER.sup, f.p, d, len);
        // con «Cifras» (X03-21): el ángulo con la vertical y hacia dónde (el nombre del otro grupo); menos de 3°, nada
        const ang = Math.atan2(Math.hypot(f.f.x, f.f.z), f.f.y) / DEG; const t = `${Math.round(ang)}° ${f.hacia}`; if (state.lyNum && f.hacia && ang >= 3 && !dicho.has(t)) { dicho.add(t); label(t, f.p.clone().addScaledVector(d, len), '#1f9d55'); } }
      const r = resultant(ap); if (r) actionLine(LAYER.sup, r.p, r.d, 1.2); }
    // brazos: bolita en la articulación y segmento grueso hasta la línea de fuerza (los centímetros, solo con «Cifras»). Con una articulación elegida,
    // solo la suya, su arco de ángulo (X03-18) y su línea de fuerza efectiva (la de la resultante de su lado, contra la que se mide ese brazo)
    if (state.lyArm) { const lab = {};
      for (const j of dem.joints) { const [id, S] = j.id.split('.');
        if (state.joint ? id !== state.joint : !principal(id)) continue;   // sin articulación elegida: solo las de los músculos principales
        if (state.joint) arco(LAYER.arm, j.J, ...ARCOS[id](P, S));
        const q = j.qL || j.q; if (!q) continue;   // contra la línea de la carga; sin carga en ese lado, contra la resultante
        ball3(LAYER.arm, j.J, 0.016); bar3(LAYER.arm, j.J, q, 0.007); (lab[id] ??= []).push({ ...j, q, arm: j.armL ?? j.arm });
        // la línea contra la que se mide (X03-29): de donde nace la fuerza (el pie en el hip thrust, la mano en el jalón) hasta pasado el pie del brazo;
        // así el brazo toca una línea que se ve, no una que flota. Verde si la fuerza es de un apoyo, morada si es la carga
        { const d = (j.qL ? j.FL : j.Fr).clone().normalize(), pts = (j.qL ? j.ptsL : j.pts) || [], ts = [0, ...pts.map(p => p.clone().sub(q).dot(d))];
          bar3(j.qL ? (j.deCarga ? LAYER.res : LAYER.sup) : LAYER.res, q.clone().addScaledVector(d, Math.min(...ts) - 0.06), q.clone().addScaledVector(d, Math.max(...ts) + 0.06), 0.0035); }
        if (state.joint) actionLine(LAYER.arm, q, (j.qL ? j.FL : j.Fr).clone().normalize(), 0.8); }
      // una sola etiqueta por articulación si sus dos lados difieren menos de 1 cm
      if (state.lyNum) for (const js of Object.values(lab)) { js.sort((a, b) => b.arm - a.arm);
        js.forEach((j, i) => { if (i === 0 || js[0].arm - j.arm >= 0.01) label(`${Math.round(j.arm * 100)} cm`, j.J.clone().lerp(j.q, 0.5), ''); }); } }
  }
  for (const k in LAYER) for (const t in unit) LAYER[k][t].end();
}

function placeProps(ex, r) {
  const F = r.F, libre = SOBRE_LIBRE.includes(EXERCISES[ex].base); barG.visible = !!r.bar; press.visible = !r.bar && !libre; placeBoxes(r.props || []);
  cableG.visible = EXERCISES[ex].base === 'cable' && !!r.pulley; if (cableG.visible) placeCable(ex, r);
  const hp = EXERCISES[ex].base === 'hinge' ? state.per[ex] : { plates: 0, feet: 0 };
  blocks.forEach((b, i) => { b.visible = hp.plates > 0; if (!b.visible) return;
    b.scale.y = hp.plates / 100; b.position.set(r.bar.center.x + (i ? 0.72 : -0.72), hp.plates / 200, r.mid + 0.02); });
  footBox.visible = hp.feet > 0;
  if (footBox.visible) { footBox.scale.y = hp.feet / 100; footBox.position.set(0, hp.feet / 200, r.mid); }
  const impl = r.impl || 'barra', isDb = impl.startsWith('mancuernas');
  const neutral = EXERCISES[ex].base === 'hang' && state.per[ex].gripType === 'neutro' && r.grips;
  barMesh.visible = (impl === 'barra' || impl === 'barra_jalon') && !neutral;   // el jalón: la barra de la acción, sin discos
  parallels.visible = !!neutral;
  if (neutral) { const g = r.grips, half = Math.abs(g[0].x - g[1].x) / 2;
    // la mano en el centro del cuerno; la barra transversal, en su extremo de delante y algo más ancha que los cuernos
    parallels.children.forEach(c => { if (c.userData.cross) { c.position.set(0, g[0].y, g[0].z + HORN / 2); c.scale.set(1, 2 * half + 0.16, 1); }
      else c.position.set(c.userData.x * half, g[0].y, g[0].z); }); }
  const I = IMPL[impl];
  dumbbells.forEach((g, i) => { g.visible = isDb; if (isDb) { g.position.copy(r.grips[i]); g.quaternion.setFromUnitVectors(X, handleAxis(I, i ? -1 : 1, r.bar?.axis).normalize()); } });
  kettlebells.forEach((g, i) => { g.visible = !!I.kb && (i === 0 || impl === 'kettlebells'); if (!g.visible) return;
    if (impl === 'kettlebell') g.position.copy(r.grips[0]).add(r.grips[1]).multiplyScalar(0.5); else g.position.copy(r.grips[i]);
    g.quaternion.setFromUnitVectors(X, handleAxis(I, i ? -1 : 1, r.bar?.axis).normalize()); });
  if (r.bar) {
    barG.position.copy(r.bar.center); barG.quaternion.setFromUnitVectors(X, r.bar.axis);
    const th = 0.02 + 0.13 * PRM().load / 200;
    plates.forEach(p => { p.visible = PRM().load > 0 && impl === 'barra' && EXERCISES[ex].base !== 'hang'; p.children[0].scale.set(1, th, 1); p.position.x = p.userData.s * (0.70 + th / 2); });
    // vista lateral: el disco tapa al maniquí -> se vuelve translúcido cuando la cámara mira a lo largo de la barra
    const al = Math.abs(camera.position.clone().sub(r.bar.center).normalize().dot(r.bar.axis));
    const fade = clamp((al - 0.8) / 0.15);
    plates.forEach(p => { const [body, ol] = p.children[0].children; if (body.material.transparent !== fade > 0) { body.material.transparent = fade > 0; body.material.needsUpdate = true; } body.material.opacity = 1 - 0.75 * fade; body.material.depthWrite = fade < 0.5; ol.visible = fade < 0.5; });
  } else if (!libre) {
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
  MU.uShoulder.value.copy(R('DEF-ARM01.L')); MU.uElbow.value.copy(R('DEF-FORARM01.L')); MU.uWrist.value.copy(R('DEF-HAND.L'));
}
let POSE_OVERRIDE = null, CAM_HOLD = null;   // CAM_HOLD: para las capturas (tests), la cámara mira ahí en vez de al sitio de siempre
function applyPose(pose, flat) {
  const k = K(), sc = new THREE.Vector3();
  for (const n of BN) { const b = RIG.bones[n]; if (!b) continue; sc.set(k, k * (flat ? 1 : STRETCH(n)), k); b.matrixWorld.compose(pose[n].p, pose[n].q, sc); }
}

/* ---- tema ---- */
function readTheme() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  renderer.setClearColor(new THREE.Color(v('--stage'))); outlineMat.color.set(v('--outline')); outlineStatic.color.set(v('--outline'));
  lineMat.color.set(v('--path')); pathMat.color.set(v('--path')); LAYER.arm.mat.color.set(v('--ink'));   // los brazos, en tinta (0x1a1e26 en el tema claro)
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
function slider(host, { id, label, min, max, step, get, set, fmt, onInput }) {
  const w = document.createElement('div'); w.className = 'field';
  w.innerHTML = `<div class="top"><label for="${id}">${label}</label><output id="${id}-o"></output></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}">`;
  host.appendChild(w); const inp = w.querySelector('input'), out = w.querySelector('output');
  const sync = () => { inp.value = get(); out.textContent = fmt(get()); };
  inp.addEventListener('input', () => { set(+inp.value); out.textContent = fmt(+inp.value); changed(); onInput?.(); }); sync(); sync.inp = inp; return sync;
}
let finNote = null;
const exHost = document.getElementById('exFields'), bodyHost = document.getElementById('bodyFields');
function buildExerciseUI(keepView) {   // keepView: no toca la cámara (al cambiar de agarre o de dónde se afina)
  const ex = EX(); document.querySelector('h1').textContent = ex.name; exHost.innerHTML = ''; state.joint = null;
  for (const p of PSET(state.exId)) {
    const ver = edOn(state.exId) && !p.hide?.(state.exId);   // en el editor, los ajustes que el usuario ha ocultado se siguen viendo (atenuados) para poder volver a mostrarlos
    if (phide(state.exId, p) && !ver) continue;   // no aplica a este ejercicio (p. ej. el maneral en el remo a un brazo)
    if (!p.options) { const [min, max] = prange(state.exId, p), sy = slider(exHost, { ...p, min, max, id: `p-${p.id}`, get: () => PRM()[p.id], set: v => { PRM()[p.id] = v; } }); if (ver) edTools(sy, p); continue; }
    const w = document.createElement('div'); w.className = 'field';
    w.innerHTML = `<div class="top"><label>${p.label}</label></div><div class="seg" role="group" aria-label="${p.label}"></div>`;
    const segEl = w.querySelector('.seg'); segEl.style.flexWrap = 'wrap';   // con muchas opciones, en varias líneas
    for (const [v, l] of p.options.filter(([v]) => !p.allow?.(state.exId) || p.allow(state.exId).includes(v))) { const b = document.createElement('button'); b.textContent = l; b.setAttribute('aria-pressed', String(PRM()[p.id] === v));
      b.addEventListener('click', () => { if (p.id === 'gripType' && JALON(state.exId)) setGrip(state.exId, v); else PRM()[p.id] = v; segEl.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); changed(); if (p.id === 'gripType' && JALON(state.exId)) buildExerciseUI(true); }); segEl.appendChild(b); }   // jalón: otro agarre, otra acción y otros rangos
    exHost.appendChild(w);
  }
  finNote = document.createElement('div'); finNote.className = 'chip warn'; finNote.hidden = true; finNote.textContent = 'El recorrido acaba antes: a partir de aquí el antebrazo deja la línea del cable'; exHost.appendChild(finNote);   // R4 (X03-26)
  const rb = document.createElement('button'); rb.className = 'copy'; rb.textContent = 'Volver a la pose autorada';
  rb.addEventListener('click', () => { for (const p of PSET(state.exId)) PRM()[p.id] = pdef(state.exId, p); buildExerciseUI(); }); exHost.appendChild(rb);
  buildEditor();
  if (!keepView) { goal.r = ex.base === 'hang' ? 5.4 : ex.base === 'cable' || SOBRE_LIBRE.includes(ex.base) ? 4.2 : 3.7;   // la dominada (barra a 2,3 m) se ve de más lejos
    setView(ex.base === 'seat' ? 'press' : 'side'); }
  changed();
}
/* ---- editor de afinado (X03-27; panel nuevo en X03-28): solo con ?editor en la dirección; lo sirve y guarda `npm run editor` (tools/editor.js) ----
   Una parte cada vez (Mano, Codo, Barra en la mano, Escápulas, Tronco), un momento cada vez (inicio, mitad, final) y un contexto, que sale de los propios ajustes del entrenador:
   todos por defecto = la base; uno solo en su mínimo o su máximo = ese extremo; cualquier otro estado = valor interpolado (solo lectura). */
const EDITOR = /[?&]editor\b/.test(location.search);
const afSec = document.getElementById('afinado'), afBody = document.getElementById('afBody'), afAct = document.getElementById('afAct');
const SAVED = Object.fromEntries(Object.keys(POSES.exercises).map(a => [a, JSON.stringify(AJ[a] ?? null)]));   // lo guardado, para «Deshacer» y el aviso de cambios sin guardar
const ed = { parte: 'mano', mom: 0, msg: '', lim: {} };   // parte y momento elegidos; msg: resultado de guardar; lim: el aviso «límite: …» de cada campo de rango
let edSync = () => {}, edCurves = () => {};
const GRIPS = { prono: 'Prono', supino: 'Supino', neutro: 'Neutro' }, MOMS = ['Inicio', 'Mitad', 'Final'];
const clone = o => JSON.parse(JSON.stringify(o));
const edOn = ex => EDITOR && afPartes(ex).length > 0;
const edParams = act => PSET(act).filter(p => !p.options && !p.hide?.(act));   // los ajustes numéricos del ejercicio (también los que el usuario oculta: se pueden volver a mostrar)
const edP = (act, id) => edParams(act).find(p => p.id === id);
const num = v => String(+v.toFixed(2)).replace('.', ',');
function edCtx(act) {   // dónde se afina: la base (todo por defecto), un extremo (uno solo a menos de un paso de su mínimo o su máximo y el resto por defecto) o nada (interpolado)
  const off = edParams(act).filter(p => Math.abs(PRM()[p.id] - rangoOf(act, p).def) > 1e-6);
  if (!off.length) return { kind: 'base' };
  if (off.length === 1) { const p = off[0], r = rangoOf(act, p); for (const ext of ['min', 'max']) if (r[ext] !== r.def && Math.abs(PRM()[p.id] - r[ext]) <= p.step + 1e-9) return { kind: 'ext', id: p.id, ext }; }
  return { kind: 'interp' };
}
const edLabel = (act, c) => c.kind === 'base' ? 'default' : c.kind === 'ext' ? `${edP(act, c.id).label} al ${c.ext === 'min' ? 'mínimo' : 'máximo'}`
  : `solo lectura: ${edParams(act).filter(p => Math.abs(PRM()[p.id] - rangoOf(act, p).def) > 1e-6).map(p => p.label.toLowerCase()).join(', ')} entre default y un extremo; aquí se ve la mezcla. Lleva cada ajuste a Default, Mín o Máx para editar`;
const edBase = (act, m, i) => AJ[act]?.base?.[m]?.[i] ?? 0;
const edGet = (act, c, m, i) => c.kind === 'ext' ? AJ[act]?.en?.[c.id]?.[c.ext]?.[m]?.[i] ?? edBase(act, m, i) : c.kind === 'base' ? edBase(act, m, i) : fineAt(act, PRM(), i / 2)[m];
const edRef = (act, c, m, i) => c.kind === 'ext' ? edBase(act, m, i) : 0;   // con qué se compara un valor para saber si se ha cambiado: el 0 en la base, la base en un extremo
function edClean(act) {   // quita lo que vale lo mismo que no tener nada (ceros en la base; en un extremo, lo que vale como la base)
  const A = AJ[act]; if (!A) return;
  for (const m in A.base || {}) if (A.base[m].every(x => x === 0)) delete A.base[m];
  if (A.base && !Object.keys(A.base).length) delete A.base;
  for (const id in A.en || {}) { for (const e of ['min', 'max']) { const c = A.en[id][e]; if (!c) continue;
      for (const m in c) if (c[m].every((x, i) => x === (A.base?.[m]?.[i] ?? 0))) delete c[m];
      if (!Object.keys(c).length) delete A.en[id][e]; }
    if (!Object.keys(A.en[id]).length) delete A.en[id]; }
  if (A.en && !Object.keys(A.en).length) delete A.en;
  if (A.rangos && !Object.keys(A.rangos).length) delete A.rangos;
  if (!Object.keys(A).length) delete AJ[act];
  AJ_VER++;
}
function edSet(act, c, m, i, v) {
  const A = AJ[act] ??= {}, b = A.base ??= {};
  if (c.kind === 'base') (b[m] ??= [0, 0, 0])[i] = v;
  else { const e = ((A.en ??= {})[c.id] ??= {})[c.ext] ??= {}; e[m] ??= (b[m] ?? [0, 0, 0]).slice(); e[m][i] = v; }
  edClean(act);
}
// todo lo que se ha cambiado en esta acción: valores distintos de 0 en la base, y en cada extremo los que difieren de la base
function edChanges(act) {
  const A = AJ[act], out = []; if (!A) return out;
  const M = afPartes(act).flatMap(pt => pt.mags.map(m => ({ m, pt })));
  for (const { m, pt } of M) for (let i = 0; i < 3; i++) { const v = edBase(act, m.id, i); if (v) out.push({ c: { kind: 'base' }, m, pt, i, v }); }
  for (const [id, e] of Object.entries(A.en || {})) for (const ext of ['min', 'max']) for (const { m, pt } of M) for (let i = 0; i < 3; i++) {
    const v = e[ext]?.[m.id]?.[i]; if (v !== undefined && v !== edBase(act, m.id, i)) out.push({ c: { kind: 'ext', id, ext }, m, pt, i, v }); }
  return out;
}
const fmtV = (m, v) => `${v > 0 ? '+' : ''}${v}${m.unidad}`;
const edLimits = (act, p) => p.lim?.(act) ?? [p.min, p.max];
function edRango(act, p, f, v) {   // f: min | max | def | oculto. Los valores se recortan a los límites duros del código y el campo lo dice (ed.lim)
  const lim = edLimits(act, p), code = { min: lim[0], max: lim[1], def: p.defOf ? p.defOf(act) : p.def }, old = rangoOf(act, p), A = AJ[act] ??= {}, R = (A.rangos ??= {})[p.id] ??= {};
  if (f === 'min' || f === 'max') { if (v < lim[0] || v > lim[1]) ed.lim[p.id] = `fuera del rango probado (${num(lim[0])} a ${num(lim[1])})`; else delete ed.lim[p.id]; }   // se acepta: solo avisa
  if (f === 'oculto') { if (v) R.oculto = true; else delete R.oculto; } else if (Math.abs(v - code[f]) < 1e-9) delete R[f]; else R[f] = v;
  if (!Object.keys(R).length) delete A.rangos[p.id];
  edClean(act); ed.msg = '';
  const r = rangoOf(act, p); if (PRM()[p.id] === old.def) PRM()[p.id] = r.def; PRM()[p.id] = clamp(PRM()[p.id], r.min, r.max);
  buildExerciseUI(true);
}
function edGoto(act, c, mom) {   // coloca los ajustes del entrenador en ese contexto y salta a ese momento
  for (const q of edParams(act)) PRM()[q.id] = rangoOf(act, q).def;
  if (c.kind === 'ext') PRM()[c.id] = rangoOf(act, edP(act, c.id))[c.ext];
  if (mom !== undefined) { ed.mom = mom; setPlaying(false); state.s = mom / 2; }
  buildExerciseUI(true);
}
const eyeSvg = off => `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>${off ? '<path d="M3 3l18 18"/>' : ''}</svg>`;
// los controles de rango de un ajuste del entrenador en modo editor: mínimo y máximo a los lados del deslizador, ⇤ ⇥ para ir a los extremos, «def» y el ojo
function edTools(sync, p) {
  const act = actOf(state.exId), w = sync.inp.closest('.field'), r = rangoOf(act, p), lim = edLimits(act, p), A = AJ[act];
  const nf = f => { const i = document.createElement('input'); i.type = 'number'; i.step = p.step; i.value = +r[f].toFixed(2); i.setAttribute('aria-label', `${p.label}: ${f === 'min' ? 'mínimo' : 'máximo'}`);
    i.addEventListener('change', () => edRango(act, p, f, +i.value)); return i; };
  const row = document.createElement('div'); row.className = 'edrange'; sync.inp.replaceWith(row); row.append(nf('min'), sync.inp, nf('max'));
  const t = document.createElement('div'); t.className = 'edtools'; w.appendChild(t);
  const b = (txt, title, fn) => { const x = document.createElement('button'); x.innerHTML = txt; x.title = title; x.setAttribute('aria-label', title); x.addEventListener('click', fn); t.appendChild(x); return x; };
  const goExt = ext => { for (const q of edParams(act)) PRM()[q.id] = rangoOf(act, q).def; PRM()[p.id] = rangoOf(act, p)[ext]; buildExerciseUI(true); };
  b('Default', `Volver «${p.label}» a su default (el resto no se toca)`, () => { PRM()[p.id] = rangoOf(act, p).def; buildExerciseUI(true); });
  b('Mín', `Llevar «${p.label}» a su mínimo y el resto a default, para afinar ese extremo`, () => goExt('min'));
  b('Máx', `Llevar «${p.label}» a su máximo y el resto a default, para afinar ese extremo`, () => goExt('max'));
  b('Fijar default', `Que el valor actual sea el default de «${p.label}» (con el que empieza el entrenador)`, () => edRango(act, p, 'def', PRM()[p.id]));
  const gap = document.createElement('span'); gap.className = 'gap'; t.appendChild(gap);
  if (ed.lim[p.id]) { const l = document.createElement('span'); l.className = 'lim'; l.textContent = ed.lim[p.id]; t.insertBefore(l, gap); }
  b(eyeSvg(r.oculto), r.oculto ? `«${p.label}» está oculto al entrenador: mostrarlo` : `Ocultar «${p.label}» al entrenador`, () => edRango(act, p, 'oculto', !r.oculto));
  if (r.oculto) w.classList.add('oc');
  const imp = document.createElement('p'); imp.className = 'hint edimp';
  const n1 = v => num(Math.round(v / p.step) * p.step); imp.textContent = r.oculto ? 'El entrenador no lo ve: queda siempre en su default.' : `El entrenador lo mueve de ${n1(r.min)} a ${n1(r.max)} y empieza en ${n1(r.def)}.`; w.appendChild(imp);
  if (A?.en?.[p.id] || A?.rangos?.[p.id]) { const d = document.createElement('i'); d.className = 'afdot'; d.title = 'tiene cambios'; w.querySelector('label').appendChild(d); }
}
function buildEditor() {
  const on = edOn(state.exId); afSec.hidden = !on; afBody.innerHTML = ''; edSync = () => {}; edCurves = () => {};
  if (!on) return;
  const act = actOf(state.exId), partes = afPartes(act), grp = (title, cls = '') => { const g = document.createElement('div'); g.className = 'fgroup ' + cls; g.innerHTML = title ? `<h3>${title}</h3>` : ''; afBody.appendChild(g); return g; };
  afAct.textContent = act;
  // 1. franja «Afinando» (siempre visible) y la mano que se usa
  const strip = document.createElement('div'); strip.className = 'afstrip'; strip.innerHTML = '<span></span><button hidden>Todo a default</button>'; afBody.appendChild(strip);
  const [stripTxt, bBase] = strip.children; bBase.addEventListener('click', () => edGoto(act, { kind: 'base' }));
  const mano = POSES.exercises[act].meta.mano, hint = document.createElement('p'); hint.className = 'hint';
  hint.textContent = !mano ? '' : libraryHand(act) ? `Mano de la biblioteca: ${mano}` : `Mano de la acción: falta «${mano}» en la biblioteca`; if (hint.textContent) afBody.appendChild(hint);
  // 2. momento
  const gm = grp('Momento'), rm = document.createElement('div'); rm.className = 'afrow'; gm.appendChild(rm);
  const segM = document.createElement('div'); segM.className = 'seg'; segM.setAttribute('role', 'group'); segM.setAttribute('aria-label', 'Momento'); rm.appendChild(segM);
  const bM = MOMS.map((t, i) => { const b = document.createElement('button'); b.addEventListener('click', () => { ed.mom = i; setPlaying(false); state.s = sOfProg(act, i / 2); edSync(); }); segM.appendChild(b); return b; });
  const hold = document.createElement('button'); hold.className = 'afhold'; hold.textContent = 'Blender'; hold.title = 'Mantén pulsado para ver la pose de la acción de Blender tal cual'; hold.setAttribute('aria-pressed', 'false'); rm.appendChild(hold);
  const holdOff = () => { POSE_OVERRIDE = null; hold.setAttribute('aria-pressed', 'false'); };
  hold.addEventListener('pointerdown', e => { hold.setPointerCapture?.(e.pointerId); POSE_OVERRIDE = () => withBody(DEFAULT_BODY, () => authoredPose(act, state.s)); hold.setAttribute('aria-pressed', 'true'); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) hold.addEventListener(ev, holdOff);
  // 3. qué afino: una parte y sus magnitudes
  const gp = grp('Qué afino'), segP = document.createElement('div'); segP.className = 'seg afseg'; segP.setAttribute('role', 'group'); segP.setAttribute('aria-label', 'Parte'); gp.appendChild(segP);
  if (!partes.some(p => p.parte === ed.parte)) ed.parte = partes[0].parte;
  const bP = partes.map(p => { const b = document.createElement('button'); b.addEventListener('click', () => { ed.parte = p.parte; buildMags(); edSync(); }); segP.appendChild(b); return b; });
  const magHost = document.createElement('div'); magHost.className = 'stack'; magHost.style.marginTop = '6px'; gp.appendChild(magHost);
  let syncs = [];
  function buildMags() {
    magHost.innerHTML = ''; syncs = [];
    for (const m of partes.find(p => p.parte === ed.parte).mags) {
      const sy = slider(magHost, { id: `af-${m.id}`, label: m.label, min: m.min, max: m.max, step: m.paso, get: () => Math.round(edGet(act, edCtx(act), m.id, ed.mom)), fmt: v => fmtV(m, v),
        set: v => { const c = edCtx(act); if (c.kind === 'interp') return; edSet(act, c, m.id, ed.mom, v); ed.msg = ''; }, onInput: () => { setPlaying(false); state.s = sOfProg(act, ed.mom / 2); } });
      const w = sy.inp.closest('.field'), top = w.querySelector('.top'), help = document.createElement('small'); help.className = 'afhelp'; help.textContent = m.ayuda; top.after(help);
      const x = document.createElement('button'); x.className = 'afx'; x.textContent = '×'; x.title = `Poner «${m.label}» a 0 en este momento`; x.setAttribute('aria-label', `Quitar ${m.label}`); top.querySelector('output').after(x);
      x.addEventListener('click', () => { const c = edCtx(act); if (c.kind === 'interp') return; edSet(act, c, m.id, ed.mom, edRef(act, c, m.id, ed.mom)); ed.msg = ''; changed(); });
      const cv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); cv.setAttribute('class', 'afcurve'); cv.setAttribute('viewBox', '0 0 300 44'); cv.setAttribute('preserveAspectRatio', 'none');
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', `${m.label} a lo largo de la repetición`); w.appendChild(cv);
      sy.curve = () => { const c = edCtx(act), v = [0, 1, 2].map(i => edGet(act, c, m.id, i)), span = Math.max(Math.max(...v, 0) - Math.min(...v, 0), (m.max - m.min) / 6), mid = (Math.max(...v, 0) + Math.min(...v, 0)) / 2, lo = mid - span * 0.6, hi = mid + span * 0.6, Y = x => 42 - (x - lo) / (hi - lo) * 40;   // escala a los valores puestos (con un mínimo), para que la forma se vea
        const pts = Array.from({ length: 61 }, (_, i) => `${(i * 5).toFixed(1)},${Y(keys3(v, progAt(act, i / 60))).toFixed(1)}`).join(' ');
        const ks = [0, 1, 2].map(i => `<circle cx="${(sOfProg(act, i / 2) * 300).toFixed(1)}" cy="${Y(v[i]).toFixed(1)}" r="${i === ed.mom ? 4 : 3}" class="${i === ed.mom ? 'on' : ''}"/>`).join('');
        cv.innerHTML = `<line x1="0" x2="300" y1="${Y(0)}" y2="${Y(0)}" class="z"/><polyline points="${pts}"/>${ks}<line x1="${(state.s * 300).toFixed(1)}" x2="${(state.s * 300).toFixed(1)}" y1="0" y2="44" class="now"/>`; };
      sy.m = m; sy.x = x; syncs.push(sy);
    }
  }
  buildMags();
  // 5. lo que has cambiado
  const gc = grp('<span class="cnt"></span><span class="afstate"></span>'), list = document.createElement('div'); list.className = 'aflist'; gc.appendChild(list);
  // 6. guardar, deshacer y copiar de otro agarre
  const ga = grp(''), acc = document.createElement('div'); acc.className = 'afsave'; ga.appendChild(acc);
  acc.innerHTML = '<button class="copy pri">Guardar</button><button class="copy">Deshacer</button><select aria-label="Copiar de otro agarre"></select><span class="afstate"></span>';
  const [bSave, bUndo, sel, st] = acc.children, root = VARIANT(act) || act, ids = Object.keys(POSES.exercises).filter(id => id !== act && (id === root || VARIANT(id) === root));
  sel.innerHTML = '<option value="">Copiar de otro agarre…</option>' + ids.map(id => `<option value="${id}">${GRIPS[POSES.exercises[id].meta.grip || 'prono'] || id}</option>`).join(''); sel.hidden = !ids.length;
  sel.addEventListener('change', () => { if (!sel.value) return; const o = AJ[sel.value]; ajSet(act, o ? clone(o) : null); ed.msg = ''; for (const p of edParams(act)) { const r = rangoOf(act, p); PRM()[p.id] = clamp(PRM()[p.id], r.min, r.max); } buildExerciseUI(true); });
  bSave.addEventListener('click', async () => {
    try { const r = await fetch(`/ajustes/${act}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(AJ[act] ?? {}) }), j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `error ${r.status}`); SAVED[act] = JSON.stringify(AJ[act] ?? null); ed.msg = 'Guardado'; } catch (e) { ed.msg = `No se ha guardado: ${e.message}`; }
    edSync(); });
  bUndo.addEventListener('click', () => { ajSet(act, SAVED[act] === 'null' ? null : JSON.parse(SAVED[act])); ed.msg = ''; for (const p of edParams(act)) { const r = rangoOf(act, p); PRM()[p.id] = clamp(PRM()[p.id], r.min, r.max); } buildExerciseUI(true); });
  const dot = on => on ? '<i class="afdot" title="tiene cambios"></i>' : '';
  edCurves = () => syncs.forEach(f => f.curve());
  edSync = () => {
    const c = edCtx(act), ro = c.kind === 'interp', ref = ro ? { kind: 'base' } : c, A = AJ[act], dirty = JSON.stringify(A ?? null) !== SAVED[act];
    const dif = (m, i) => edGet(act, ref, m, i) !== edRef(act, ref, m, i);   // ¿hay algo cambiado ahí, en este contexto?
    stripTxt.textContent = `Afinando: ${GRIPS[PRM().gripType] || act} · ${edLabel(act, c)}${ro ? '' : ` · ${MOMS[ed.mom]}`}`; strip.classList.toggle('ro', ro); bBase.hidden = !ro;
    bM.forEach((b, i) => { b.setAttribute('aria-pressed', String(i === ed.mom)); b.innerHTML = `<span>${MOMS[i]}</span>${dot(partes.some(p => p.mags.some(m => dif(m.id, i))))}`; });
    bP.forEach((b, i) => { b.setAttribute('aria-pressed', String(partes[i].parte === ed.parte)); b.innerHTML = `<span>${partes[i].label}</span>${dot(partes[i].mags.some(m => [0, 1, 2].some(j => dif(m.id, j))))}`; });
    syncs.forEach(f => { f.inp.disabled = ro; f(); f.curve(); f.x.hidden = ro || edGet(act, c, f.m.id, ed.mom) === edRef(act, c, f.m.id, ed.mom); });
    // la lista: un renglón por valor cambiado (y por rango); pulsarlo lleva a ese contexto, parte y momento; la × lo quita
    const ch = edChanges(act), rg = Object.entries(A?.rangos || {}).flatMap(([id, R]) => { const p = edP(act, id); return p ? Object.entries(R).map(([f, v]) => ({ p, f, v })) : []; });
    gc.querySelector('.cnt').textContent = `Lo que has cambiado · ${ch.length + rg.length}`; const gs = gc.querySelector('.afstate'); gs.textContent = dirty ? 'sin guardar' : ''; gs.classList.toggle('dirty', dirty);
    list.innerHTML = ch.length + rg.length ? '' : '<div class="c" style="cursor:default">Nada todavía: mueve un deslizador.</div>';
    for (const e of ch) { const d = document.createElement('div'), lab = e.c.kind === 'base' ? 'Default' : `${edP(act, e.c.id)?.label || e.c.id} ${e.c.ext === 'min' ? 'mín' : 'máx'}`;
      d.innerHTML = `<span class="c">${lab} · ${e.pt.label} · ${e.m.label} · ${MOMS[e.i].toLowerCase()}</span><span class="v">${fmtV(e.m, e.v)}</span><button class="afx" aria-label="Quitar este cambio">×</button>`;
      d.addEventListener('click', () => { ed.parte = e.pt.parte; edGoto(act, e.c, e.i); });
      d.querySelector('button').addEventListener('click', ev => { ev.stopPropagation(); edSet(act, e.c, e.m.id, e.i, edRef(act, e.c, e.m.id, e.i)); ed.msg = ''; changed(); });
      list.appendChild(d); }
    for (const { p, f, v } of rg) { const d = document.createElement('div'), txt = f === 'oculto' ? 'oculto al entrenador' : `${f === 'min' ? 'mín' : f === 'max' ? 'máx' : 'por defecto'} ${(() => { try { return p.fmt(v); } catch { return num(v); } })()}`;
      d.innerHTML = `<span class="c">Rango · ${p.label}</span><span class="v">${txt}</span><button class="afx" aria-label="Quitar este cambio">×</button>`;
      d.querySelector('button').addEventListener('click', () => { const lim = edLimits(act, p); edRango(act, p, f, f === 'oculto' ? false : f === 'min' ? lim[0] : f === 'max' ? lim[1] : p.defOf ? p.defOf(act) : p.def); });
      list.appendChild(d); }
    st.textContent = ed.msg; bUndo.disabled = !dirty;
  };
  edSync();
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
document.getElementById('allJoints').addEventListener('change', e => { state.allJoints = e.target.checked; });
toggle('heatBtn', 'heat'); toggle('refBtn', 'ref');
for (const k of ['lyRes', 'lySup', 'lyArm', 'lyBal', 'lyPath', 'lyNum']) toggle(k, k);
// reproducción: ida, pausa, vuelta, pausa. Lineal: el ritmo (arranque y frenada) ya viene de Blender en los frames exportados
function repS(t) { const T = 3.7; t %= T; if (t < 1.7) return t / 1.7; if (t < 1.9) return 1; if (t < 3.2) return 1 - (t - 1.9) / 1.3; return 0; }

const MUSCLES = [['quads', 'Cuádriceps'], ['glutes', 'Glúteo mayor'], ['hams', 'Isquiotibiales'], ['add', 'Aductores'], ['erect', 'Erectores'], ['calves', 'Gemelos y sóleo'],
  ['lats', 'Dorsal'], ['pecs', 'Pectoral'], ['delts', 'Deltoides'], ['biceps', 'Bíceps'], ['triceps', 'Tríceps'], ['abs', 'Abdominales']];
const mHost = document.getElementById('muscles');
const mRows = MUSCLES.map(([key, name]) => { const n = document.createElement('div'); n.className = 'n'; n.textContent = name; const b = document.createElement('div'); b.className = 'bar'; const i = document.createElement('i'); b.appendChild(i); const v = document.createElement('div'); v.className = 'v'; mHost.append(n, b, v); return { key, n, b, i, v }; });
// papel de cada músculo en cada acción (X03-19): principal (llega al color máximo), secundario (se pinta a la mitad como mucho) o ninguno (no se pinta).
// Propuesta de partida; el usuario la corrige al probar. ponytail: la tabla vive en el visor hasta que el catálogo (X03-03) tenga la ficha de cada ejercicio; entonces se mueve allí.
// Las variantes (meta.of) usan la de su ejercicio. Sin tabla (acciones nuevas): principales = los músculos de las articulaciones con acción (GRUPO), secundarios = los demás con raw > 0.
const PAPEL = {
  back_squat: { p: ['quads', 'glutes'], s: ['add', 'hams', 'erect', 'calves'] }, leg_press: { p: ['quads', 'glutes'], s: ['add', 'hams', 'calves'] },
  deadlift: { p: ['glutes', 'hams', 'quads', 'erect'], s: ['add', 'lats', 'calves'] }, romanian_deadlift: { p: ['hams', 'glutes'], s: ['erect', 'add', 'lats'] },
  barbell_row: { p: ['lats', 'delts', 'biceps'], s: ['erect', 'hams', 'glutes'] }, cable_row: { p: ['lats', 'biceps', 'delts'], s: ['erect'] }, pullup: { p: ['lats', 'biceps'], s: ['delts', 'pecs'] },
  lat_pulldown: { p: ['lats', 'biceps'], s: ['delts', 'pecs', 'abs'] },   // X03-14, revisadas con el usuario el 10-nov
  bulgarian_split_squat: { p: ['quads', 'glutes'], s: ['add', 'hams', 'calves', 'erect'] }, bench_press: { p: ['pecs', 'triceps', 'delts'], s: ['lats'] },
  hip_thrust: { p: ['glutes'], s: ['hams', 'quads', 'add'], j: ['hip', 'knee'] },   // la rodilla: su brazo decide cuádriceps o isquios (usuario, 14-nov)
  push_up: { p: ['pecs', 'triceps', 'delts'], s: ['abs'] },
};
PAPEL.front_squat = PAPEL.back_squat;
const SECUNDARIO = 0.5, PAPELX = {};
const GRUPO = { ankle: ['calves'], knee: ['quads', 'hams'], hip: ['glutes', 'hams', 'add'], lumbar: ['erect', 'abs'], shoulder: ['lats', 'pecs', 'delts'], elbow: ['biceps', 'triceps'] };   // músculos de cada articulación
const papelDe = ex => PAPEL[ex] || PAPEL[VARIANT(ex)] || PAPELX[ex];
const principal = id => { const t = papelDe(state.exId); return t?.j ? t.j.includes(id) : t ? GRUPO[id].some(m => t.p.includes(m)) : relevant(id); };   // `j`: las articulaciones con brazo, si el ejercicio las fija   // articulación movida por algún músculo principal
// lo que se pinta (mapa, barras, gráfica y barras del panel de articulaciones): principal = clamp(raw / PEAK), secundario = SECUNDARIO · eso, el resto 0
function pinta(ex, raw, peak) {
  const t = papelDe(ex), o = {};
  for (const [m] of MUSCLES) o[m] = !t || t.p.includes(m) ? clamp(raw[m] / peak) : t.s.includes(m) ? SECUNDARIO * clamp(raw[m] / peak) : 0;
  return o;
}
// panel «Articulaciones» (X03-12/16/18): la fila dice qué hace la articulación (ángulo anatómico, `anatomia`) y la barra cuánto trabajan sus músculos (GRUPO,
// lo mismo que pinta el mapa). Claves por articulación: [clave, nombre si el valor más lejos de 0 es positivo, si es negativo]
const JNAME = { ankle: 'Tobillo', knee: 'Rodilla', hip: 'Cadera', lumbar: 'Lumbar', shoulder: 'Hombro', elbow: 'Codo' };
const JKEYS = { ankle: [['ankle.dorsi', 'dorsiflexión', 'flexión plantar']], knee: [['knee.flex', 'flexión', 'extensión']], lumbar: [['lumbar.flex', 'flexión', 'extensión']],
  hip: [['hip.flex', 'flexión', 'extensión'], ['hip.abd', 'abducción', 'aducción']], shoulder: [['shoulder.flex', 'flexión', 'extensión'], ['shoulder.abd', 'abducción', 'aducción']], elbow: [['elbow.flex', 'flexión', 'extensión']] };
// pico y recorrido de la repetición: el mapa y las barras se escalan con PEAK = mayor `raw` de los músculos PRINCIPALES en los 31 puntos (mínimo 0,05; X03-16/19), para que
// el más exigido llegue a 1 en su punto más duro; RANGO['knee.flex.L'] = { min, max, ini, fin } de cada ángulo anatómico; ACC[articulación] = tiene acción
// (algún ángulo suyo recorre ≥ 15° en algún lado). Los rellena computeCurve; repPeak(ex) los calcula para cualquier acción (las pruebas usan el mismo).
let PEAK = 1, RANGO = {}, ACC = {};
function repPeak(ex = state.exId) {
  const curve = [], RG = {}, acc = {};
  for (let j = 0; j <= 30; j++) {
    const s = j / 30, r = evaluate(ex, s), an = anatomia(r.pose); curve.push({ s, raw: r.dem?.raw, path: r.path.clone() });
    for (const k in an) { const g = RG[k] ??= { min: Infinity, max: -Infinity }; g.min = Math.min(g.min, an[k]); g.max = Math.max(g.max, an[k]); if (j === 0) g.ini = an[k]; if (j === 30) g.fin = an[k]; }
  }
  for (const k in RG) if (RG[k].max - RG[k].min >= 15) acc[k.split('.')[0]] = true;
  if (!curve[0].raw) return { PEAK: 1, RANGO: RG, ACC: acc, curve };   // acción `libre` sin apoyos declarados: sin demanda
  if (!PAPEL[ex] && !PAPEL[VARIANT(ex)]) { const p = Object.keys(acc).flatMap(id => GRUPO[id]); PAPELX[ex] = { p, s: MUSCLES.map(m => m[0]).filter(m => !p.includes(m) && curve.some(c => c.raw[m] > 0)) }; }
  let peak = 0.05; for (const m of papelDe(ex).p) for (const c of curve) peak = Math.max(peak, c.raw[m]);
  return { PEAK: peak, RANGO: RG, ACC: acc, curve };
}
// articulaciones que se enseñan (panel y capa Brazos): con tabla PAPEL, las que tienen algún músculo principal o secundario (así las piernas de la
// dominada, que se mueven pero no trabajan, no salen); sin tabla, las que tienen acción. «Ver todas» enseña las demás
const relevant = id => { if (state.allJoints) return true; const t = PAPEL[state.exId] || PAPEL[VARIANT(state.exId)]; return t ? GRUPO[id].some(m => t.p.includes(m) || t.s.includes(m)) : !!ACC[id]; };
// `pt` = lo pintado (pinta), `an` = anatomia(pose actual). Los dos lados salen juntos salvo que sus grados actuales difieran más de 10°
function jointRows(dem, dem0, pt, an) {
  const rows = [], span = (k, s) => RANGO[k + s].max - RANGO[k + s].min;
  for (const id in JNAME) {
    if (!relevant(id)) continue;
    const sides = id === 'lumbar' ? [''] : ['.L', '.R'], big = k => Math.max(...sides.map(s => span(k, s)));
    const [k, pos, neg] = JKEYS[id].reduce((a, b) => big(b[0]) > big(a[0]) ? b : a), dom = sides.reduce((a, b) => span(k, b) > span(k, a) ? b : a);
    const dos = sides.length > 1 && Math.abs(an[k + '.L'] - an[k + '.R']) > 10, d = Math.max(...GRUPO[id].map(m => pt[m]));
    for (const s of dos ? sides : [dom]) {
      const R = RANGO[k + s], sg = Math.abs(R.max) >= Math.abs(R.min) ? 1 : -1, lo = sg > 0 ? Math.max(0, R.min) : Math.max(0, -R.max), hi = sg > 0 ? R.max : -R.min;
      const j = dem.joints.find(x => x.id === id + s), j0 = dem0?.joints.find(x => x.id === id + s); let dif = '';
      if (j0 && j0.arm !== null && j.arm !== null) { const p = Math.round(100 * (j.arm - j0.arm) / Math.max(Math.abs(j0.arm), 0.02 * K())); if (Math.abs(p) > 3) dif = ` · ${p > 0 ? '+' : '−'}${Math.abs(p)} %`; }
      rows.push({ id, d, name: `${JNAME[id]}${dos ? (s === '.L' ? ' izq.' : ' dcha.') : ''} · ${sg > 0 ? pos : neg} ${Math.round(lo)}–${Math.round(hi)}°`,
        text: `${Math.round(sg * an[k + s])}°` + (state.lyNum && j.arm !== null ? ` · ${Math.round(j.arm * 100)} cm` : '') + dif });
    }
  }
  return rows;
}
const jHost = document.getElementById('joints'), jRows = [], repartoEl = document.getElementById('reparto');
function setJointRows(rows) {
  while (jRows.length < rows.length) { const n = document.createElement('div'); n.className = 'n'; const b = document.createElement('div'); b.className = 'bar'; const i = document.createElement('i'); b.appendChild(i); const v = document.createElement('div'); v.className = 'v'; v.style.whiteSpace = 'nowrap'; jHost.append(n, b, v); const r = { n, b, i, v, id: null }; jRows.push(r);
    for (const e of [n, b, v]) e.addEventListener('click', () => { state.joint = state.joint === r.id ? null : r.id; }); }   // elegir una articulación para trazarla (X03-17)
  jRows.forEach((r, k) => { const x = rows[k]; r.n.hidden = r.b.hidden = r.v.hidden = !x; if (!x) return; r.id = x.id; for (const e of [r.n, r.b, r.v]) e.classList.toggle('sel', state.joint === x.id); r.n.textContent = x.name; r.i.style.width = `${(x.d * 100).toFixed(1)}%`; r.v.textContent = x.text; });
}
const spark = document.getElementById('spark');
function computeCurve() {
  const R = repPeak(); PEAK = R.PEAK; RANGO = R.RANGO; ACC = R.ACC;
  pathLine.geometry.dispose(); pathLine.geometry = new THREE.BufferGeometry().setFromPoints(R.curve.map(c => c.path));
  if (!R.curve[0].raw) { spark.innerHTML = ''; document.getElementById('sparkLg').innerHTML = ''; return; }
  // la gráfica dibuja los dos primeros músculos principales del ejercicio (X03-19)
  const [m1, m2 = m1] = papelDe(state.exId).p, nom = m => MUSCLES.find(x => x[0] === m)[1];
  document.getElementById('sparkLg').innerHTML = `<span style="color:var(--heat-hi)">${nom(m1)}</span><span style="color:var(--accent)">${nom(m2)}</span>`;
  const curve = R.curve, pts = k => curve.map(c => `${(c.s * 300).toFixed(1)},${(72 - pinta(state.exId, c.raw, PEAK)[k] * 66).toFixed(1)}`).join(' ');
  spark.innerHTML = `<line x1="0" y1="72" x2="300" y2="72" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke"/><line x1="0" y1="39" x2="300" y2="39" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/><polyline points="${pts(m1)}" fill="none" stroke="var(--heat-hi)" stroke-width="2" vector-effect="non-scaling-stroke"/><polyline points="${pts(m2)}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/><line id="cursor" x1="0" y1="0" x2="0" y2="76" stroke="var(--ink)" stroke-width="1" vector-effect="non-scaling-stroke" opacity=".5"/>`;
}
const jsonEl = document.getElementById('json');
function renderJSON() { const r2 = v => Math.round(v * 100) / 100; jsonEl.textContent = JSON.stringify({ ejercicio: state.exId, pose: 'autorada (Blender)', ajustes: Object.fromEntries(Object.entries(PRM()).map(([k, v]) => [k, r2(v)])) }, null, 2); }
document.getElementById('copyBtn').addEventListener('click', async e => { const btn = e.currentTarget; try { await navigator.clipboard.writeText(jsonEl.textContent); btn.textContent = 'Copiado'; } catch { const r = document.createRange(); r.selectNodeContents(jsonEl); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); btn.textContent = 'Seleccionado'; } setTimeout(() => btn.textContent = 'Copiar JSON', 1500); });
let curveDirty = true;
const defNote = document.getElementById('defNote');
function changed() { curveDirty = true; renderJSON(); edSync(); defNote.textContent = isDefault() ? 'pose autorada exacta' : 'corregida por el solver'; }

/* ---- bucle ---- */
const readout = document.getElementById('readout'), phaseLbl = document.getElementById('phaseLbl'), demandAt = document.getElementById('demandAt');
function resize() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(canvas);
const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
let last = performance.now();
let edCurveS = -1;
function frameLoop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (curveDirty) { curveDirty = false; computeCurve(); }
  if (state.playing) { clock += dt; state.s = repS(clock); }
  scrub.value = Math.round(state.s * 1000);
  if (edCurveS !== state.s) { edCurveS = state.s; edCurves(); }   // la raya de «ahora» en las curvas del editor
  const r = evaluate(state.exId, state.s); window.__last = r;
  applyPose(POSE_OVERRIDE ? POSE_OVERRIDE() : r.pose, r.flat); placeProps(state.exId, r);
  const pt = r.dem ? pinta(state.exId, r.dem.raw, PEAK) : null;   // relativo al pico de la repetición y al papel de cada músculo (X03-16/19); sin demanda (libre sin apoyos): mapa apagado
  MU.uAct.value = MUSCLES.map(([m]) => pt ? pt[m] : 0); MU.uHeat.value = state.heat && pt ? 1 : 0; MU.uS.value = 1;
  midLine.visible = state.lyBal && r.mid !== null; if (r.mid !== null) midLine.position.z = r.mid; pathLine.visible = state.lyPath;
  drawLayers(r.dem, PRM(), r.pose);
  // referencia autorada
  refLines.visible = state.ref;
  if (state.ref) { const A = withBody(DEFAULT_BODY, () => authoredPose(state.exId, state.s)); const pts = []; for (const n of BN) { const P = PARENT[n]; if (P && !/FINGER|THUMB|PALM/.test(n)) pts.push(A[P].p, A[n].p); } refLines.geometry.dispose(); refLines.geometry = new THREE.BufferGeometry().setFromPoints(pts); }
  const k = K(); target.lerp(CAM_HOLD || (EX().base === 'seat' ? V(0, 0.75 * k, 0.3) : EX().base === 'hang' ? V(0, 1.6 * k, 0) : EX().base === 'cable' ? V(0, 0.7 * k, 0.45) : SOBRE_LIBRE.includes(EX().base) ? V(0, 0.55 * k, POSES.exercises[state.exId].start.bones['DEF-HIPS'].p[2] * k) : V(0, 0.8 * k, 0.03)), 0.2);
  orbit.th += (goal.th - orbit.th) * 0.12; orbit.ph += (goal.ph - orbit.ph) * 0.12; orbit.r += (goal.r - orbit.r) * 0.15;
  camera.position.set(target.x + orbit.r * Math.sin(orbit.ph) * Math.sin(orbit.th), target.y + orbit.r * Math.cos(orbit.ph), target.z + orbit.r * Math.sin(orbit.ph) * Math.cos(orbit.th));
  camera.lookAt(target); if (OUTLINE.base) OUTLINE.value = OUTLINE.base * clamp(orbit.r / 3.2, 0.3, 1.2);
  { const front = Math.abs(Math.atan2(Math.sin(orbit.th), Math.cos(orbit.th))) < 31 * DEG, [cb, co] = CBL.column.children;   // de frente la columna de la polea tapa al maniquí: translúcida (opacidad 0,2) y sin contorno (X03-27)
    if (cb.material.transparent !== front) { cb.material.transparent = front; cb.material.needsUpdate = true; } cb.material.opacity = front ? 0.2 : 1; cb.material.depthWrite = !front; co.visible = !front; }
  renderer.render(scene, camera);
  if (finNote) finNote.hidden = r.sFin === undefined;
  readout.innerHTML = r.readout.map(([l, v]) => `<span class="chip"><b>${l}</b>${v}</span>`).join('') + r.warns.map(w => `<span class="chip warn">${esc(w)}</span>`).join('');
  phaseLbl.textContent = `${Math.round(state.s * 100)}% · ${r.phase}`; demandAt.textContent = `en el ${Math.round(state.s * 100)}%`;
  const papel = pt && papelDe(state.exId);   // principales primero, secundarios con el nombre en gris, el resto oculto
  mRows.forEach((m, i) => { const v = pt ? pt[m.key] : 0, k = !papel ? 2 : papel.p.includes(m.key) ? 0 : papel.s.includes(m.key) ? 1 : 2;
    for (const e of [m.n, m.b, m.v]) { e.hidden = k === 2; e.style.order = k * 100 + i; } m.n.classList.toggle('sec', k === 1);
    m.i.style.width = `${(v * 100).toFixed(1)}%`; m.v.textContent = `${Math.round(v * 100)}`; });
  repartoEl.hidden = !r.dem?.reparto;
  if (r.dem?.reparto) { const g = r.dem.reparto, pies = g.filter(x => x.nombre.includes('pie')), m = pies.length === 1 ? pies[0] : g[0].ang >= g[1].ang ? g[0] : g[1];   // la dirección de la fuerza de los pies (X03-21) o, entre dos pies, la más inclinada
    repartoEl.textContent = (g.map(x => `${x.nombre} ${Math.round(x.pct)} %`).join(' · ') + (m.hacia && m.ang >= 3 ? ` (${Math.round(m.ang)}° ${m.hacia})` : '')).replace(/^./, c => c.toUpperCase()); }
  placeLabels(); setJointRows(r.dem ? jointRows(r.dem, isDefault() ? null : evaluateDefault(state.exId, state.s), pt, anatomia(r.pose)) : []);   // evaluateDefault solo desde aquí
  const cur = document.getElementById('cursor'); if (cur) { cur.setAttribute('x1', state.s * 300); cur.setAttribute('x2', state.s * 300); }
  requestAnimationFrame(frameLoop);
}
readTheme(); setPlaying(state.playing); resize();
const loading = document.getElementById('loading');
const bin = Uint8Array.from(atob(document.getElementById('model-b64').textContent.trim()), c => c.charCodeAt(0));
new THREE.GLTFLoader().parse(bin.buffer, '', gltf => { initRig(gltf); loading.hidden = true; buildExerciseUI(); window.__ready = true; requestAnimationFrame(frameLoop); },
  err => { loading.textContent = 'No se ha podido cargar el modelo 3D. Recarga la página para reintentarlo.'; console.error(err); });
window.__dbg = { sOfProg, progAt, keys3, camera, plates, state, RIG, THREE, setOverride: f => { POSE_OVERRIDE = f; }, camHold: (v, th, ph, r) => { CAM_HOLD = v; if (v) { goal.th = orbit.th = th; goal.ph = orbit.ph = ph; goal.r = orbit.r = r; } }, evaluate, authoredPose, POSES, REST, BN, withBody, DEFAULT_BODY, features, PRM, EXERCISES, demand, bodyParts, comOffset, midfootZ, evaluateDefault, MU, repPeak, anatomia, PAPEL, pinta, papelDe, PARAMS, pdef, prange, PSET, gripOf, solveLimb, poleOf, variantFor, VARIANT, pulleyAt, K, hollowAt, jalonData, sFin, evaluateRaw, psiOf, swivel, wrapA, ed, edCtx, edSet, edChanges, SAVED, buildExerciseUI, AJ, ajSet, actOf, fineAt, rangoOf, phide, elbowStable };
})();
