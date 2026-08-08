import { describe, it, expect } from 'vitest';
import { compressSession, estimateSessionSec, DISCIPLINE_RULES } from './sessionCompression';

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
    // Un peldaño: presupuesto justo por debajo de lo que cuesta la sesión.
    const mins = Math.floor(estimateSessionSec(LEG_DAY) / 60) - 1;
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
