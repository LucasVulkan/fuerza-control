// Casos del visor de carga semanal (27-oct-2026). Cinco personas, 10 semanas.
// Todo determinista: ni Math.random ni fechas de hoy. La semana 1 empieza el
// lunes 2026-08-31.
//
// Cada persona trae:
//   previstas   sesiones por semana que su programa espera
//   plan(w)     plantillas de la semana w (lo previsto, para plannedSetsByGroup)
//   sesiones(w) lo que HIZO en la semana w: [{ dia (0 = lunes), rpe, ejercicios }]
//               ejercicios = [{ id, rest, sets: [[peso, reps], ...] }]
//   notas[w-1]  qué pasa esa semana, en palabras
// El plan se asume escrito por el entrenador con el mesociclo ya dentro (Marta y
// Javi: sus semanas de descarga y de bloque duro están en lo previsto).

const rep = (n, v) => Array.from({ length: n }, () => v);
const plantilla = (ej) => ({ exercises: ej.map(([exerciseId, sets]) => ({ exerciseId, sets })) });
// La quinta serie de un ejercicio pierde una rep (cansancio normal).
const repsDe = (objetivo, n) => Array.from({ length: n }, (_, i) => objetivo - (i >= 4 ? 1 : 0));

// ── Ana y Luis: la misma sesión ───────────────────────────────────────────────
const SESION_MAQUINAS = ['chest_press_machine', 'leg_press_standard', 'shoulder_press_machine'];
const planMaquinas = (dias) => () => rep(dias, plantilla(SESION_MAQUINAS.map((id) => [id, 3])));
const maquinas = (pesos, reps) =>
  SESION_MAQUINAS.map((id, i) => ({ id, rest: 90, sets: reps.map((r) => [pesos[i], r]) }));

const ANA = {
  id: 'ana', nombre: 'Ana · principiante, dos días, sin sRPE',
  perfil: 'Lunes y jueves, máquinas, una sola sesión: pecho, pierna y hombro, 3×10-12. Sube 2,5 kg cada dos semanas. No apunta el esfuerzo.',
  conRpe: false, bodyWeight: 62, previstas: 2,
  plan: planMaquinas(2),
  sesiones(w) {
    const paso = Math.floor((w - 1) / 2) * 2.5;
    const pesos = [30 + paso, 60 + paso, 20 + paso];
    const reps = w === 1 ? [10, 10, 10] : w % 2 === 1 ? [10, 10, 9] : [12, 11, 11];
    const dias = w === 5 ? [0] : [0, 3];
    return dias.map((dia) => ({ dia, rpe: null, ejercicios: maquinas(pesos, reps) }));
  },
  notas: [
    'Primera semana: 30/60/20 kg, 10 reps en todo.',
    'Mismo peso, sube a 12/11/11.',
    'Peso nuevo (+2,5 kg): vuelve a 10/10/9.',
    'Mismo peso, 12/11/11.',
    'Solo va el lunes. Peso nuevo.',
    'Vuelve a los dos días; mismo peso que la anterior.',
    'Peso nuevo (+2,5 kg).',
    'Mismo peso, 12/11/11.',
    'Peso nuevo.',
    'Mismo peso, 12/11/11.',
  ],
};

const LUIS = {
  id: 'luis', nombre: 'Luis · entrena cuando puede, sin sRPE',
  perfil: 'Programa de martes y viernes (misma sesión que Ana). Semanas 1-4 va uno o dos días, 5-8 desaparece, vuelve en la 9 con menos peso.',
  conRpe: false, bodyWeight: 80, previstas: 2,
  plan: planMaquinas(2),
  sesiones(w) {
    const dias = { 1: [1, 4], 2: [1], 3: [1, 4], 4: [4], 9: [1, 4], 10: [1] }[w];
    if (!dias) return [];
    const pesos = w <= 2 ? [25, 70, 15] : w <= 4 ? [27.5, 75, 17.5] : [25, 67.5, 15];
    const reps = w === 9 ? [10, 10, 9] : [12, 11, 10];
    return dias.map((dia) => ({ dia, rpe: null, ejercicios: maquinas(pesos, reps) }));
  },
  notas: [
    'Va martes y viernes.',
    'Solo va el martes.',
    'Va los dos días; sube peso.',
    'Solo el viernes.',
    'No entrena.', 'No entrena.', 'No entrena.', 'No entrena.',
    'Vuelve los dos días con ~10 % menos de peso.',
    'Solo el martes, ya con las reps de siempre.',
  ],
};

// ── Marta: hipertrofia, torso/pierna ×2 ──────────────────────────────────────
// [id, reps objetivo, descanso, peso base, kg por escalón]; escalón = floor(w/3).
const MARTA_DIAS = [
  { dia: 0, ej: [['chest_press_machine', 10, 90, 40, 2.5], ['barbell_row', 10, 90, 40, 2.5], ['shoulder_press_machine', 10, 90, 30, 2.5], ['bicep_curl_barbell', 12, 60, 20, 0]] },
  { dia: 1, ej: [['squat_barbell', 8, 120, 60, 2.5], ['hip_thrust', 10, 90, 60, 2.5], ['leg_curl_lying', 12, 75, 30, 0]] },
  { dia: 3, ej: [['bench_press_barbell', 8, 120, 40, 2.5], ['pull_up', 8, 120, 0, 0], ['lateral_raise_db', 15, 60, 6, 0]] },
  { dia: 4, ej: [['leg_press_standard', 12, 90, 100, 5], ['deadlift_conventional', 8, 120, 70, 2.5], ['leg_curl_lying', 12, 75, 30, 0]] },
];
const MARTA_NIVEL = [3, 4, 5, 3, 3, 4, 5, 3, 4, 4]; // series por ejercicio y semana
const MARTA_RPE = [7, 7, 7, 5, 7, 7, 7, 5, 7, 7];

const MARTA = {
  id: 'marta', nombre: 'Marta · hipertrofia, cuatro días, con sRPE',
  perfil: 'Torso/pierna dos veces (lun, mar, jue, vie), sRPE 7. Acumulación +1 serie por ejercicio y semana, descarga (−40 % de series, sRPE 5) en las semanas 4 y 8. La fuerza sube poco a poco.',
  conRpe: true, bodyWeight: 63, previstas: 4,
  plan: (w) => MARTA_DIAS.map((d) => plantilla(d.ej.map(([id]) => [id, MARTA_NIVEL[w - 1]]))),
  sesiones(w) {
    const n = MARTA_NIVEL[w - 1];
    return MARTA_DIAS.map((d) => ({
      dia: d.dia, rpe: MARTA_RPE[w - 1],
      ejercicios: d.ej.map(([id, reps, rest, base, paso]) => ({
        id, rest, sets: repsDe(reps, n).map((r) => [base + paso * Math.floor(w / 3), r]),
      })),
    }));
  },
  notas: [
    'Acumulación: 3 series por ejercicio.',
    'Acumulación: 4 series.',
    'Acumulación: 5 series; sube peso en los básicos.',
    'Descarga: 3 series, sRPE 5.',
    'Segundo bloque, otra vez 3 series.',
    'Acumulación: 4 series.',
    'Acumulación: 5 series; sube peso.',
    'Descarga: 3 series, sRPE 5.',
    'Semana normal: 4 series; sube peso.',
    'Semana normal: 4 series.',
  ],
};

// ── Javi: fuerza, cuatro días ────────────────────────────────────────────────
// [id, series, reps, descanso, peso base, principal]
const JAVI_DIAS = [
  { dia: 0, ej: [['squat_barbell', 4, 5, 150, 100, 1], ['bench_press_barbell', 4, 5, 150, 70, 1]] },
  { dia: 2, ej: [['deadlift_conventional', 3, 5, 180, 120, 1], ['barbell_row', 4, 6, 120, 60, 1], ['pull_up', 3, 6, 120, 0, 0]] },
  { dia: 4, ej: [['shoulder_press_machine', 3, 8, 90, 40, 0], ['lateral_raise_db', 3, 12, 60, 8, 0], ['bicep_curl_barbell', 3, 10, 60, 25, 0]] },
  { dia: 5, ej: [['leg_press_standard', 3, 8, 120, 140, 0], ['leg_curl_lying', 3, 10, 75, 35, 0], ['hip_thrust', 3, 8, 90, 80, 0]] },
];
const JAVI_OFF = [0, 0, 2.5, 2.5, 5, 5, 7.5, 7.5, 7.5, 10]; // kg ganados en los básicos
const JAVI_RPE = [7, 7, 7, 7, 8, 8, 8, 9, 5, 7];
const javiSeries = (n, w) => (w >= 5 && w <= 8 ? Math.round(n * 1.35) : w === 9 ? Math.round(n * 0.6) : n);

const JAVI = {
  id: 'javi', nombre: 'Javi · fuerza, cuatro días, con sRPE',
  perfil: 'Lun, mié, vie y sáb. Semanas 1-4 normales (sRPE 7); 5-7 bloque duro (+35 % de trabajo, sRPE 8); la 8 repite el trabajo de la 7 con sRPE 9 y reps peores; la 9 descarga (−40 %, sRPE 5); la 10 vuelve y la fuerza sube.',
  conRpe: true, bodyWeight: 84, previstas: 4,
  plan: (w) => JAVI_DIAS.map((d) => plantilla(d.ej.map(([id, n]) => [id, javiSeries(n, w)]))),
  sesiones(w) {
    const off = JAVI_OFF[w - 1];
    return JAVI_DIAS.map((d) => ({
      dia: d.dia, rpe: JAVI_RPE[w - 1],
      ejercicios: d.ej.map(([id, n, reps, rest, base, principal]) => {
        const peso = base + (principal ? off : 2.5 * Math.floor(off / 5));
        const sets = repsDe(reps, javiSeries(n, w)).map((r) => [peso, w === 8 ? Math.max(1, r - 1) : r]);
        return { id, rest, sets };
      }),
    }));
  },
  notas: [
    'Semana normal.', 'Semana normal.', 'Sube 2,5 kg en los básicos.', 'Semana normal.',
    'Empieza el bloque duro: +35 % de series, sube 2,5 kg más.',
    'Bloque duro.',
    'Bloque duro; sube otros 2,5 kg.',
    'Mismo trabajo que la 7, sRPE 9 y una rep menos en cada serie: fatiga.',
    'Descarga: −40 % de series, sRPE 5.',
    'Vuelve a lo normal y gana 2,5 kg más.',
  ],
};

// ── Carlos: 5×5, tres días ───────────────────────────────────────────────────
// [id, peso base, descanso, cuántos fallos menos que la sentadilla]
const CARLOS_EJ = [['squat_barbell', 60, 180, 0], ['bench_press_barbell', 50, 180, 1], ['barbell_row', 45, 150, 2]];
const CARLOS_RPE = [7, 7, 7, 8, 8, 8, 7, 8, 8, 8];
const CARLOS_FALLOS = [0, 0, 0, 1, 2, 1, 2, 3, 2, 3]; // series a 4 reps en la sentadilla

const CARLOS = {
  id: 'carlos', nombre: 'Carlos · 5×5, tres días, con sRPE',
  perfil: 'Lun, mié y vie: sentadilla, press banca y remo 5×5 cada día. Semanas 1-3 sube 2,5 kg por sesión; desde la 4 se estanca (mismos pesos, series a 4 reps). En la 7 falta un día.',
  conRpe: true, bodyWeight: 78, previstas: 3,
  plan: () => rep(3, plantilla(CARLOS_EJ.map(([id]) => [id, 5]))),
  sesiones(w) {
    const dias = w === 7 ? [0, 2] : [0, 2, 4];
    return dias.map((dia, i) => {
      const sesionGlobal = w <= 3 ? (w - 1) * 3 + i : 8;
      return {
        dia, rpe: CARLOS_RPE[w - 1],
        ejercicios: CARLOS_EJ.map(([id, base, rest, desfase]) => {
          const fallos = Math.max(0, CARLOS_FALLOS[w - 1] - desfase);
          return { id, rest, sets: [...rep(5 - fallos, 5), ...rep(fallos, 4)].map((r) => [base + 2.5 * sesionGlobal, r]) };
        }),
      };
    });
  },
  notas: [
    'Sube 2,5 kg en cada sesión.', 'Sigue subiendo 2,5 kg por sesión.', 'Última semana de subidas: 20 kg más que al empezar.',
    'Se estanca: mismos pesos y una serie a 4 reps en la sentadilla.',
    'Dos series a 4 en la sentadilla, una en el press.',
    'Una serie a 4 en la sentadilla.',
    'Falta el viernes. Mismos pesos.',
    'Tres series a 4 reps en la sentadilla y dos en el press.',
    'Dos series a 4 reps.',
    'Tres series a 4 reps en la sentadilla.',
  ],
};

export const PERSONAS = [ANA, LUIS, MARTA, JAVI, CARLOS];
export const SEMANAS = 10;
