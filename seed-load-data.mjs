/**
 * seed-load-data — genera un historial de entrenamiento sintético fechado hacia
 * atrás, para poder probar el panel de Carga sin esperar tres meses.
 *
 *   node seed-load-data.mjs [semanas]      → fc-seed-carga.fitdata (por defecto 12)
 *
 * Se importa desde la app: menú ≡ → Importar → elegir el archivo → marcar SOLO
 * "Historial". `importData` deduplica por id, así que reimportar el mismo
 * archivo no duplica nada, y volver a generarlo produce exactamente los mismos
 * ids (todo es determinista, sin Math.random).
 *
 * Por qué hace falta: la carga se mide sobre DÍAS de calendario (medias móviles
 * de 7 y 28 días, monotonía semanal, días de descanso a 0). Varias sesiones
 * metidas hoy se suman en un único punto y no producen ninguna serie temporal.
 *
 * Todas las sesiones salen como sesión libre (`__free__`) a propósito: así no
 * cuelgan de plantillas que quizá no existan en el dispositivo, y se distinguen
 * de las reales de un vistazo por su nombre («… (semilla)»).
 */
import { writeFileSync } from 'node:fs';
import { EXERCISE_LIBRARY } from './src/data/exerciseLibrary.js';

const WEEKS = Number(process.argv[2]) || 12;
const OUT   = 'fc-seed-carga.fitdata';

// ── Plan ──────────────────────────────────────────────────────────────────────
// Mesociclo clásico 3:1 — tres semanas de acumulación y una de descarga. Es lo
// que hace que el gráfico enseñe algo: la media de 7d sube y cae contra la de
// 28d, la monotonía varía y el estado pasa por loading / steady / unloading.

const ROTATION = [
  { name: 'Empuje', exercises: [
    ['bench_press_barbell', 100, 5, 8],
    ['overhead_press_barbell', 45, 6, 10],
    ['push_up', null, 12, 20],            // peso corporal: ejercita esa rama
  ] },
  { name: 'Tirón', exercises: [
    ['pull_up_neutral', null, 6, 10],     // peso corporal
    ['barbell_row', 70, 6, 10],
    ['face_pull', 25, 12, 15],
  ] },
  { name: 'Pierna', exercises: [
    ['squat_barbell', 120, 5, 8],
    ['romanian_deadlift', 100, 8, 10],
    ['hip_thrust', 90, 8, 12],
  ] },
  { name: 'Completo', exercises: [
    ['deadlift_conventional', 140, 3, 5],
    ['bench_press_barbell', 95, 6, 8],
    ['pull_up_neutral', null, 6, 10],
  ] },
];

// Días de la semana (1 = lunes) por tipo de semana.
const DAYS_NORMAL  = [1, 2, 4, 6];
const DAYS_DELOAD  = [1, 4];

// ── Validación de ids contra la librería real ────────────────────────────────
const missing = [...new Set(ROTATION.flatMap((s) => s.exercises.map(([id]) => id)))]
  .filter((id) => !EXERCISE_LIBRARY[id]);
if (missing.length) {
  console.error(`Ejercicios inexistentes en la librería: ${missing.join(', ')}`);
  console.error('Corrige ROTATION en este script — un id inventado rompería la referencia de 1RM.');
  process.exit(1);
}

// ── Utilidades deterministas ─────────────────────────────────────────────────

/** Ruido reproducible en [-1, 1] a partir de un entero. */
function wobble(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

const round2p5 = (kg) => Math.round(kg / 2.5) * 2.5;

/**
 * Lunes de la primera semana, a las 18:30 local, de forma que la ÚLTIMA semana
 * generada sea la semana en curso: si el historial acabara hace ocho días, la
 * media de 7 días saldría a cero y el panel parecería roto.
 */
function firstMonday(weeks) {
  const d = new Date();
  d.setHours(18, 30, 0, 0);
  const dow = (d.getDay() + 6) % 7;       // 0 = lunes
  d.setDate(d.getDate() - dow - (weeks - 1) * 7);
  return d;
}

// ── Generación ────────────────────────────────────────────────────────────────

const start = firstMonday(WEEKS);
const log   = [];
let   n     = 0;

for (let w = 0; w < WEEKS; w++) {
  const isDeload = w % 4 === 3;
  const phase    = w % 4;                         // 0,1,2 acumulación · 3 descarga
  const days     = isDeload ? DAYS_DELOAD : DAYS_NORMAL;

  days.forEach((dow, di) => {
    const plan = ROTATION[(w * days.length + di) % ROTATION.length];

    const date = new Date(start);
    date.setDate(start.getDate() + w * 7 + (dow - 1));
    // La semana en curso está a medias: nada de sesiones en el futuro.
    if (date.getTime() > Date.now()) return;

    const setsPerEx = isDeload ? 2 : 3 + (phase === 2 ? 1 : 0);
    // Sobrecarga progresiva: +2.5 kg cada dos semanas; la descarga baja un 12%.
    const bump  = Math.floor(w / 2) * 2.5;
    const scale = isDeload ? 0.88 : 1;

    const exercises = plan.exercises.map(([exerciseId, baseKg, minReps, maxReps], ei) => {
      const sets = [];
      for (let s = 0; s < setsPerEx; s++) {
        const reps = Math.max(
          minReps,
          Math.min(maxReps, Math.round(minReps + (maxReps - minReps) * 0.6 + wobble(n + s * 7 + ei))),
        );
        sets.push({
          weight: baseKg == null ? '' : String(round2p5((baseKg + bump) * scale)),
          reps:   String(reps),
          time:   '',
          done:   true,
        });
      }
      return {
        exerciseId,
        sets,
        totalSets: setsPerEx,
        minReps,
        maxReps,
        restSec: 120,
      };
    });

    // sRPE sigue la forma del mesociclo: 6 → 7 → 8, y 5 en la descarga.
    const sessionRpe = isDeload ? 5 : Math.min(9, Math.max(5, 6 + phase + Math.round(wobble(n) * 0.5)));

    // Duración: ~60-75 min. La sesión marcada abajo se deja disparada a
    // propósito para que se vea actuar el acotado del reloj de pared.
    const minutes = 62 + Math.round(wobble(n + 99) * 8);

    const entry = {
      id:                `log_seed_w${String(w).padStart(2, '0')}_d${dow}`,
      sessionTemplateId: '__free__',
      sessionName:       `${plan.name} (semilla)`,
      timestamp:         date.getTime(),
      duration:          minutes * 60000,
      notes:             '',
      // El peso corporal no existe en las 3 primeras semanas: así se ve actuar
      // el fallback al último peso conocido sobre el histórico antiguo.
      bodyWeight:        w < 3 ? null : Math.round((78.5 - w * 0.08) * 10) / 10,
      plannedSets:       exercises.reduce((a, e) => a + e.totalSets, 0),
      sessionRpe,
      exercises,
    };

    // ── Casos borde deliberados, para que la UI los tenga que resolver ───────
    // 1. Una sesión sin sRPE → hueco en la línea interna, no un cero.
    if (w === 5 && di === 1) delete entry.sessionRpe;
    // 2. Un reloj de pared absurdo (sesión olvidada abierta) → clamp.
    if (w === 6 && di === 0) entry.duration = 5 * 60 * 60000;
    // 3. Una sesión con bloque de acondicionamiento → carga de bloque. Semana
    //    normal a propósito: las de descarga solo tienen dos días (di 0 y 1).
    if (w === 9 && di === 2) {
      entry.blocks = [{
        blockId: `blk_seed_w${w}`,
        format:  'amrap',
        name:    'AMRAP 12 (semilla)',
        capSec:  720,
        movements: [],
        result:  { rounds: 9, extraReps: 4 },
      }];
    }

    log.push(entry);
    n += 1;
  });
}

// ── Salida en formato de copia de seguridad ──────────────────────────────────

const payload = {
  version:    '2',
  exportType: 'full',
  exportDate: new Date().toISOString().split('T')[0],
  appName:    'Forma Fit',
  workoutLog: log,
};

writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');

const first = new Date(log[0].timestamp);
const last  = new Date(log[log.length - 1].timestamp);
const fmt   = (d) => d.toISOString().split('T')[0];
console.log(`${OUT} — ${log.length} sesiones · ${fmt(first)} → ${fmt(last)} (${WEEKS} semanas)`);
console.log('Importar desde la app: ≡ → Importar → marcar SOLO "Historial".');
