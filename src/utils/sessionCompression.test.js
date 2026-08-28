import { describe, it, expect } from 'vitest';
import {
  compressSession, estimateSessionSec, includesWarmup, accessoriesAtFloor,
  DISCIPLINE_RULES, MAX_ACCESSORIES_AT_FLOOR, TIME_TOLERANCE, budgetSecFor,
} from './sessionCompression';

const ex = (exerciseId, tier, sets, restSec = 90) => ({ exerciseId, tier, isKey: tier === 1, sets, restSec });

/** El día de pierna del análisis: sentadilla 4×6, RDL 3×8, prensa 3×10,
 *  extensión 3×12, gemelo 3×15. */
const LEG_DAY = [
  ex('squat_barbell',       1, 4, 180),
  ex('romanian_deadlift',   1, 3, 120),
  ex('leg_press_standard',  2, 3, 90),
  ex('leg_extension',       3, 3, 60),
  ex('calf_raise_standing', 3, 3, 45),
];

const idsOf = (list) => list.map((e) => e.exerciseId);
const setsOf = (list, id) => list.find((e) => e.exerciseId === id)?.sets;

describe('compressSession — escalera', () => {
  it('sin presupuesto no toca nada', () => {
    const r = compressSession(LEG_DAY, {});
    expect(r.exercises).toBe(LEG_DAY);
    expect(r.overTime).toBe(false);
  });

  it('si ya cabe, no toca nada', () => {
    const mins = Math.ceil(estimateSessionSec(LEG_DAY) / 60) + 5;
    const r = compressSession(LEG_DAY, { sessionMinutes: mins });
    expect(r.exercises).toEqual(LEG_DAY);
    expect(r.overTime).toBe(false);
  });

  it('primero cae el accesorio redundante, no el primero que pilla', () => {
    // Presupuesto justo por debajo de la estimación una vez descontada la
    // tolerancia: dispara un peldaño y sólo uno.
    const est = estimateSessionSec(LEG_DAY, undefined, { includeWarmup: false }) / 60;
    const mins = Math.floor(est / (1 + TIME_TOLERANCE)) - 1;
    const { exercises } = compressSession(LEG_DAY, { sessionMinutes: mins });
    // `leg_extension` es el tercer ejercicio de quads del día; el gemelo es el
    // único de su grupo. Cae la redundancia.
    expect(idsOf(exercises)).not.toContain('leg_extension');
    expect(idsOf(exercises)).toContain('calf_raise_standing');
  });

  it('baja series antes de borrar el siguiente ejercicio', () => {
    const { exercises } = compressSession(LEG_DAY, { sessionMinutes: 40 });
    // Quedan los tres del suelo (1 principal + 2 accesorios) con series recortadas
    expect(exercises.length).toBeGreaterThanOrEqual(3);
    const reduced = exercises.some((e) => e.tier !== 1 && e.sets < 3);
    const removed = exercises.length < LEG_DAY.length;
    expect(reduced || removed).toBe(true);
  });

  it('los principales sobreviven al recorte agresivo', () => {
    const { exercises } = compressSession(LEG_DAY, { sessionMinutes: 20 });
    expect(idsOf(exercises)).toContain('squat_barbell');
    expect(idsOf(exercises)).toContain('romanian_deadlift');
  });

  it('nunca baja de 1 principal + 2 accesorios', () => {
    const { exercises } = compressSession(LEG_DAY, { sessionMinutes: 10 });
    expect(exercises.filter((e) => e.tier === 1).length).toBe(2);
    expect(exercises.filter((e) => e.tier !== 1).length).toBeGreaterThanOrEqual(2);
  });

  it('declara `overTime` en vez de forzar el presupuesto', () => {
    const r = compressSession(LEG_DAY, { sessionMinutes: 10 });
    expect(r.overTime).toBe(true);
    expect(estimateSessionSec(r.exercises)).toBeGreaterThan(10 * 60);
  });

  it('ningún accesorio baja de 2 series ni ningún principal de 3', () => {
    const { exercises } = compressSession(LEG_DAY, { sessionMinutes: 10 });
    exercises.forEach((e) => {
      expect(e.sets).toBeGreaterThanOrEqual(e.tier === 1 ? 3 : 2);
    });
  });

  it('sin `tier`, lo deriva de `isKey` (camino procedural)', () => {
    const legacy = LEG_DAY.map((e) => {
      const copy = { ...e };
      delete copy.tier;
      return copy;
    });
    const { exercises } = compressSession(legacy, { sessionMinutes: 40 });
    expect(exercises.filter((e) => e.isKey).length).toBe(2);
  });
});

describe('compressSession — énfasis de la plantilla', () => {
  // El día de glúteo: tres ejercicios del mismo grupo A PROPÓSITO.
  const GLUTE_DAY = [
    ex('hip_thrust',        1, 4, 120),
    ex('romanian_deadlift', 1, 4, 120),
    ex('leg_extension',     3, 3, 90),
    ex('cable_kickback',    3, 3, 60),
  ];

  it('sin énfasis, el tercer ejercicio del grupo es redundante y cae', () => {
    const mins = Math.floor(estimateSessionSec(GLUTE_DAY) / 60) - 1;
    const { exercises } = compressSession(GLUTE_DAY, { sessionMinutes: mins });
    expect(idsOf(exercises)).not.toContain('glute_kickback_cable');
  });

  it('con énfasis declarado, el grupo prioritario sobrevive al recorte', () => {
    const mins = Math.floor(estimateSessionSec(GLUTE_DAY) / 60) - 1;
    const { exercises } = compressSession(GLUTE_DAY, {
      sessionMinutes: mins, volumeEmphasis: ['glutes_hamstrings'],
    });
    expect(idsOf(exercises)).toContain('cable_kickback');
  });

  it('el énfasis se sacrifica el último, no nunca: con presupuesto imposible también cae', () => {
    const { exercises } = compressSession(GLUTE_DAY, {
      sessionMinutes: 10, volumeEmphasis: ['glutes_hamstrings'],
    });
    // El suelo manda por encima del énfasis (1 principal + 2 accesorios).
    expect(exercises.filter((e) => e.tier !== 1).length).toBeGreaterThanOrEqual(2);
  });
});

describe('estimateSessionSec — espejo de sessionStats', () => {
  it('los eslabones de una superserie no cuentan su descanso', () => {
    const plain = [ex('leg_extension', 3, 3, 60), ex('calf_raise_standing', 3, 3, 60)];
    const superset = [{ ...plain[0], supersetWithNext: true }, plain[1]];
    // 3 series × 60 s de descanso ahorrados
    expect(estimateSessionSec(plain) - estimateSessionSec(superset)).toBe(180);
  });

  it('sin calentamiento general descuenta 8 min, y sólo eso', () => {
    const withWarmup = estimateSessionSec(LEG_DAY);
    const without = estimateSessionSec(LEG_DAY, undefined, { includeWarmup: false });
    expect(withWarmup - without).toBe(480);
  });
});

describe('presupuesto de sesiones cortas', () => {
  it('por debajo de 60 min no se cuenta el calentamiento general', () => {
    expect(includesWarmup(30)).toBe(false);
    expect(includesWarmup(45)).toBe(false);
    expect(includesWarmup(60)).toBe(true);
    expect(includesWarmup(90)).toBe(true);
  });

  it('pedir más tiempo nunca entrega menos trabajo', () => {
    // La razón de conservar las transiciones bajo el umbral: sin ellas, 45 min
    // darían más trabajo que 60. Se comprueba sobre el trabajo real resultante.
    const workSec = (mins) => {
      const { exercises } = compressSession(LEG_DAY, { sessionMinutes: mins });
      return exercises.reduce((s, e) => s + e.sets * (35 + (e.supersetWithNext ? 0 : e.restSec)), 0);
    };
    expect(workSec(45)).toBeLessThanOrEqual(workSec(60));
    expect(workSec(60)).toBeLessThanOrEqual(workSec(90));
  });

  it('una sesión ligera ya cabe en 30 min — antes no cabía ninguna', () => {
    const light = [
      ex('bench_press_db',    1, 3, 90),
      ex('chest_fly_machine', 3, 3, 60),
      ex('cable_row',         3, 3, 60),
    ];
    const { overTime } = compressSession(light, { sessionMinutes: 30 });
    expect(overTime).toBe(false);
  });

  it('un día de básicos pesados ya cabe en 30, con los principales intactos', () => {
    // Con la transición en 2 min (antes 3) esta sesión pasó de irreducible a
    // caber: 47 min íntegra, y a 30 se queda en 4 ejercicios con los dos
    // principales dentro. Antes declaraba `overTime` hiciera lo que hiciera.
    const { overTime, exercises } = compressSession(LEG_DAY, { sessionMinutes: 30 });
    expect(overTime).toBe(false);
    expect(exercises.filter((e) => e.tier === 1)).toHaveLength(2);
    expect(exercises.every((e) => e.sets >= (e.tier === 1 ? 3 : 2))).toBe(true);
  });
});

describe('tolerancia del presupuesto', () => {
  // Sesión de ~52 min sin calentamiento; con 45 de presupuesto se pasa un 16%.
  const CASI = [
    ex('bench_press_db',    1, 4, 120),
    ex('chest_fly_machine', 3, 3, 60),
    ex('cable_row',         3, 3, 60),
    ex('lateral_raise_db',  3, 3, 60),
  ];

  it('pasarse por poco no cuesta un ejercicio', () => {
    const est = estimateSessionSec(CASI, undefined, { includeWarmup: false }) / 60;
    // Un presupuesto un 5% por debajo de la estimación: dentro de la tolerancia.
    const mins = Math.round(est / 1.05);
    const r = compressSession(CASI, { sessionMinutes: mins });

    expect(r.exercises).toEqual(CASI);
    expect(r.overTime).toBe(false);
  });

  it('pasarse de largo sí lo cuesta', () => {
    const est = estimateSessionSec(CASI, undefined, { includeWarmup: false }) / 60;
    // Un 40% por debajo: fuera de la tolerancia, hay que recortar.
    const mins = Math.round(est / 1.4);
    const r = compressSession(CASI, { sessionMinutes: mins });

    expect(r.exercises).not.toEqual(CASI);
  });

  it('la tolerancia es proporcional, no minutos fijos', () => {
    // +10 min sobre 30 sería un tercio más de sesión; sobre 90, calderilla.
    expect(budgetSecFor(30)).toBe(30 * 60 * (1 + TIME_TOLERANCE));
    expect(budgetSecFor(90) - 90 * 60).toBeGreaterThan(budgetSecFor(30) - 30 * 60);
  });
});

describe('tope de accesorios en el suelo de series', () => {
  it('nunca deja tres accesorios a 2 series, sea cual sea el presupuesto', () => {
    for (const sessionMinutes of [10, 20, 30, 40, 50, 60, 75, 90]) {
      for (const discipline of ['standard', 'strength', 'calisthenics']) {
        const { exercises } = compressSession(LEG_DAY, { sessionMinutes, discipline });
        expect(accessoriesAtFloor(exercises), `${sessionMinutes}min/${discipline}`)
          .toBeLessThanOrEqual(MAX_ACCESSORIES_AT_FLOOR);
      }
    }
  });

  it('al tercero quita un accesorio en vez de recortarlo', () => {
    // Tres accesorios de 3 series: recortarlos todos daría tres en el suelo.
    const tres = [
      ex('squat_barbell',       1, 4, 180),
      ex('leg_press_standard',  3, 3, 90),
      ex('leg_extension',       3, 3, 90),
      ex('calf_raise_standing', 3, 3, 90),
    ];
    const { exercises } = compressSession(tres, { sessionMinutes: 25 });

    expect(accessoriesAtFloor(exercises)).toBeLessThanOrEqual(MAX_ACCESSORIES_AT_FLOOR);
    expect(exercises.length).toBeLessThan(tres.length);   // se quitó uno
    // El principal sigue ahí. Sus series sí pueden bajar (en hipertrofia el
    // último peldaño lo permite), pero nunca por debajo de su suelo de 3.
    const key = exercises.find((e) => e.tier === 1);
    expect(key.exerciseId).toBe('squat_barbell');
    expect(key.sets).toBeGreaterThanOrEqual(3);
  });
});

describe('sesiones cortas — borrar antes que bajar series', () => {
  // Cinco grupos distintos y sin pares antagonistas contiguos: ni redundancia
  // que quitar ni superserie que montar, así que sólo se ve el efecto del orden.
  const MIXED = [
    ex('pulldown_pronated',      1, 5, 120),
    ex('bicep_curl_supination',  3, 5, 90),
    ex('leg_curl_lying',         3, 5, 90),
    ex('calf_raise_standing',    3, 5, 90),
    ex('plank',                  3, 5, 90),
  ];

  it('por debajo del umbral quita un ejercicio y respeta las series del resto', () => {
    const est = estimateSessionSec(MIXED, undefined, { includeWarmup: false }) / 60;
    const mins = Math.min(59, Math.floor(est / (1 + TIME_TOLERANCE)) - 1);
    const { exercises } = compressSession(MIXED, { sessionMinutes: mins });
    expect(exercises).toHaveLength(4);
    expect(exercises.every((e) => e.sets === 5)).toBe(true);
  });

  it('por encima, conserva los ejercicios y les baja series', () => {
    const { exercises } = compressSession(MIXED, { sessionMinutes: 62 });
    expect(exercises).toHaveLength(5);
    expect(exercises.some((e) => e.tier !== 1 && e.sets < 5)).toBe(true);
  });
});

describe('superserie de opuestos', () => {
  // Accesorios contiguos y antagonistas: apertura de pecho + remo.
  const PUSH_PULL_DAY = [
    ex('bench_press_db',   1, 4, 120),
    ex('chest_fly_machine', 3, 3, 60),
    ex('cable_row',         3, 3, 60),
  ];

  it('encadena dos accesorios opuestos antes que quitar nada', () => {
    // Por debajo de la estimación una vez descontada la tolerancia.
    const est = estimateSessionSec(PUSH_PULL_DAY, undefined, { includeWarmup: false }) / 60;
    const mins = Math.floor(est / (1 + TIME_TOLERANCE)) - 1;
    const { exercises } = compressSession(PUSH_PULL_DAY, { sessionMinutes: mins });
    expect(exercises).toHaveLength(3);
    expect(exercises.find((e) => e.exerciseId === 'chest_fly_machine').supersetWithNext).toBe(true);
  });

  it('no encadena dos ejercicios del mismo empuje', () => {
    const sameSide = [
      ex('bench_press_db',    1, 4, 120),
      ex('chest_fly_machine', 3, 3, 60),
      ex('tricep_pushdown',   3, 3, 60),
    ];
    const { exercises } = compressSession(sameSide, { sessionMinutes: 30 });
    expect(exercises.every((e) => !e.supersetWithNext)).toBe(true);
  });

  it('no encadena en sesiones largas — con 90 min no hay razón', () => {
    const { exercises } = compressSession(PUSH_PULL_DAY, { sessionMinutes: 90 });
    expect(exercises.every((e) => !e.supersetWithNext)).toBe(true);
  });

  it('nunca encadena más de dos: el último queda suelto', () => {
    const chain = [
      ex('bench_press_db',    1, 4, 120),
      ex('chest_fly_machine', 3, 3, 60),
      ex('cable_row',         3, 3, 60),
      ex('shoulder_press_db', 3, 3, 60),
    ];
    const { exercises } = compressSession(chain, { sessionMinutes: 20 });
    const marked = exercises.filter((e) => e.supersetWithNext);
    marked.forEach((e) => {
      const i = exercises.indexOf(e);
      expect(exercises[i - 1]?.supersetWithNext).toBeFalsy();
    });
    expect(exercises[exercises.length - 1].supersetWithNext).toBeFalsy();
  });
});

describe('compressSession — carácter por disciplina', () => {
  it('fuerza no recorta las series de los básicos; hipertrofia sí', () => {
    const strength    = compressSession(LEG_DAY, { sessionMinutes: 10, discipline: 'strength' });
    const hypertrophy = compressSession(LEG_DAY, { sessionMinutes: 10, discipline: 'standard' });

    expect(setsOf(strength.exercises, 'squat_barbell')).toBe(4);
    expect(setsOf(hypertrophy.exercises, 'squat_barbell')).toBe(3);
  });

  it('fuerza tira accesorios enteros antes de tocarles series', () => {
    // Con el mismo presupuesto, fuerza conserva menos ejercicios que hipertrofia
    // (que prefiere repartir el recorte en series).
    const strength    = compressSession(LEG_DAY, { sessionMinutes: 35, discipline: 'strength' });
    const hypertrophy = compressSession(LEG_DAY, { sessionMinutes: 35, discipline: 'standard' });
    expect(strength.exercises.length).toBeLessThanOrEqual(hypertrophy.exercises.length);
  });

  it('calistenia deja los tier 1 intactos — la skill no se negocia', () => {
    const r = compressSession(LEG_DAY, { sessionMinutes: 10, discipline: 'calisthenics' });
    expect(setsOf(r.exercises, 'squat_barbell')).toBe(4);
    expect(setsOf(r.exercises, 'romanian_deadlift')).toBe(3);
  });

  it('una disciplina desconocida usa las reglas de hipertrofia', () => {
    const unknown = compressSession(LEG_DAY, { sessionMinutes: 35, discipline: 'no_existe' });
    const standard = compressSession(LEG_DAY, { sessionMinutes: 35, discipline: 'standard' });
    expect(unknown.exercises).toEqual(standard.exercises);
  });

  it('cada disciplina declara su escalera y su escala de volumen', () => {
    Object.values(DISCIPLINE_RULES).forEach((rules) => {
      expect(rules.compression.length).toBeGreaterThan(0);
      expect(rules.volumeBandScale).toBeGreaterThan(0);
    });
  });
});

describe('adaptArchetype — el tier no sale del adaptador', () => {
  it('ningún exConfig del sessionTemplate lleva `tier`', async () => {
    const { adaptArchetype } = await import('./archetypeAdapter');
    const { ARCHETYPES } = await import('../data/archetypes');
    const { sessionTemplates } = adaptArchetype(ARCHETYPES[0], {
      level: 'intermediate', discipline: 'standard', goal: 'hypertrophy',
      equipment: ['dumbbells', 'machines', 'cables', 'barbell', 'pullup_bar'],
      limitations: ['none'], daysPerWeek: 3, sessionMinutes: 60,
    });
    Object.values(sessionTemplates).forEach((tpl) => {
      tpl.exercises.forEach((e) => expect(e).not.toHaveProperty('tier'));
    });
  });

  it('`overTime` nombra las sesiones que no caben', async () => {
    const { adaptArchetype } = await import('./archetypeAdapter');
    const { ARCHETYPES } = await import('../data/archetypes');
    const answers = {
      level: 'intermediate', discipline: 'standard', goal: 'hypertrophy',
      equipment: ['dumbbells', 'machines', 'cables', 'barbell', 'pullup_bar'],
      limitations: ['none'], daysPerWeek: 3,
    };
    expect(adaptArchetype(ARCHETYPES[0], { ...answers, sessionMinutes: 90 }).overTime).toEqual([]);
    expect(adaptArchetype(ARCHETYPES[0], { ...answers, sessionMinutes: 20 }).overTime.length).toBeGreaterThan(0);
  });
});
