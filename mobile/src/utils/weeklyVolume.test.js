import { describe, it, expect } from 'vitest';
import {
  weeklySetsByGroup, normalizeWeeklyVolume, ceilingFor,
  VOLUME_BANDS, CLAMPED_GROUPS, EMPHASIS_BONUS, GROUP_CEILING_FACTOR,
} from './weeklyVolume';
import { adaptArchetype } from './archetypeAdapter';
import { ARCHETYPES } from '../data/archetypes';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

const ex = (exerciseId, tier, sets) => ({ exerciseId, tier, isKey: tier === 1, sets, restSec: 90 });
const byId = (id) => ARCHETYPES.find((a) => a.id === id);

/** Sesión de espalda: 1 principal + 3 accesorios, todos del mismo grupo. */
const BACK_DAY = [
  ex('pulldown_pronated', 1, 4),
  ex('cable_row',         3, 3),
  ex('db_row_unilateral', 3, 3),
];

describe('weeklySetsByGroup — el ciclo por la frecuencia', () => {
  it('a un ciclo por semana, el volumen semanal es el del ciclo', () => {
    expect(weeklySetsByGroup([BACK_DAY], 1).back).toBe(10);
  });

  it('entrenar la misma sesión el doble de días dobla el volumen', () => {
    expect(weeklySetsByGroup([BACK_DAY], 2).back).toBe(20);
  });

  it('un ciclo más largo que la semana reparte, no acumula', () => {
    // 4 sesiones, 3 días: el ciclo tarda más de una semana en cerrarse
    const cycle = [BACK_DAY, [], [], []];
    expect(weeklySetsByGroup(cycle, 3).back).toBeCloseTo(10 * 0.75);
  });

  it('sin frecuencia declarada asume un ciclo por semana', () => {
    expect(weeklySetsByGroup([BACK_DAY], undefined).back).toBe(10);
  });
});

describe('ceilingFor — banda, disciplina y énfasis', () => {
  it('cada nivel tiene su techo', () => {
    expect(ceilingFor('back', { level: 'beginner' })).toBe(VOLUME_BANDS.beginner.hard);
    expect(ceilingFor('back', { level: 'advanced' })).toBe(VOLUME_BANDS.advanced.hard);
  });

  it('fuerza tolera menos volumen que hipertrofia', () => {
    expect(ceilingFor('back', { level: 'intermediate', discipline: 'strength' }))
      .toBeLessThan(ceilingFor('back', { level: 'intermediate', discipline: 'standard' }));
  });

  it('hombro y brazos tienen el techo directo más bajo', () => {
    // El contador solo ve series directas; hombro y triceps se llevan ademas
    // una parte de cada press, y el biceps de cada traccion.
    const opts = { level: 'intermediate' };
    expect(ceilingFor('shoulders', opts)).toBeLessThan(ceilingFor('chest', opts));
    expect(ceilingFor('arms', opts)).toBeLessThan(ceilingFor('back', opts));
    expect(ceilingFor('shoulders', opts))
      .toBe(VOLUME_BANDS.intermediate.hard * GROUP_CEILING_FACTOR.shoulders);
  });

  it('el factor se aplica en todos los niveles', () => {
    for (const level of ['beginner', 'intermediate', 'advanced']) {
      expect(ceilingFor('shoulders', { level }))
        .toBeLessThan(ceilingFor('quads', { level }));
    }
  });

  it('el énfasis sube el techo de su grupo, y sólo del suyo', () => {
    const opts = { level: 'intermediate', volumeEmphasis: ['glutes_hamstrings'] };
    expect(ceilingFor('glutes_hamstrings', opts)).toBe(VOLUME_BANDS.intermediate.hard + EMPHASIS_BONUS);
    expect(ceilingFor('back', opts)).toBe(VOLUME_BANDS.intermediate.hard);
  });
});

describe('normalizeWeeklyVolume', () => {
  it('no toca lo que ya está en banda', () => {
    const r = normalizeWeeklyVolume([BACK_DAY], { daysPerWeek: 1, level: 'intermediate' });
    expect(r.sessions[0]).toEqual(BACK_DAY);
    expect(r.overBudget).toEqual([]);
  });

  it('recorta cuando la frecuencia dispara el volumen', () => {
    // Día realista: la espalda convive con otro grupo, así que quitarle un
    // accesorio no rompe el suelo de sesión. 10/ciclo × 2 = 20; techo 14.
    const wide = [...BACK_DAY, ex('chest_fly_machine', 3, 3)];
    const r = normalizeWeeklyVolume([wide], { daysPerWeek: 2, level: 'beginner' });
    expect(r.weekly.back).toBeLessThanOrEqual(VOLUME_BANDS.beginner.hard);
    expect(r.overBudget).toEqual([]);
  });

  it('con los suelos de por medio, recorta lo que puede', () => {
    // 1 principal + 2 accesorios: los accesorios bajan a 2 series (quitar uno
    // rompería el suelo de sesión) y el principal a 3. 20 → 14, justo el techo.
    const r = normalizeWeeklyVolume([BACK_DAY], { daysPerWeek: 2, level: 'beginner' });
    expect(r.weekly.back).toBeLessThanOrEqual(VOLUME_BANDS.beginner.hard);
    expect(r.sessions[0].filter((e) => e.tier !== 1).every((e) => e.sets === 2)).toBe(true);
  });

  it('los accesorios se agotan antes de tocar un principal', () => {
    // Con margen en los accesorios, el principal se queda como estaba.
    const wide = [...BACK_DAY, ex('chest_fly_machine', 3, 3)];
    const r = normalizeWeeklyVolume([wide], { daysPerWeek: 2, level: 'beginner' });
    expect(r.sessions[0].find((e) => e.tier === 1).sets).toBe(4);
  });

  it('como último recurso baja un principal a 3 series, y nunca lo elimina', () => {
    const r = normalizeWeeklyVolume([BACK_DAY], { daysPerWeek: 2, level: 'beginner' });
    const key = r.sessions[0].find((e) => e.tier === 1);
    expect(key).toBeTruthy();
    expect(key.sets).toBe(3);
  });

  it('deja el grupo cubierto: no borra el último ejercicio de un grupo', () => {
    const r = normalizeWeeklyVolume([BACK_DAY], { daysPerWeek: 3, level: 'beginner' });
    const backCount = r.sessions[0].filter(
      (e) => EXERCISE_LIBRARY[e.exerciseId].primaryGroup === 'back',
    ).length;
    expect(backCount).toBeGreaterThanOrEqual(1);
  });

  it('declara `overBudget` cuando ni bajando los principales a su suelo llega', () => {
    const allKeys = [ex('pulldown_pronated', 1, 5), ex('cable_row', 1, 5), ex('barbell_row', 1, 5)];
    const r = normalizeWeeklyVolume([allKeys], { daysPerWeek: 2, level: 'beginner' });
    // 3 principales × 3 series × 2 ciclos = 18 semanales, techo 14: irreducible.
    expect(r.overBudget).toContain('back');
    expect(r.sessions[0]).toHaveLength(3);                      // ninguno eliminado
    expect(r.sessions[0].every((e) => e.sets === 3)).toBe(true); // todos en su suelo
  });

  it('el énfasis de la plantilla sobrevive al normalizador', () => {
    const glutes = [
      ex('hip_thrust', 1, 4),
      ex('romanian_deadlift', 1, 4),
      ex('cable_kickback', 3, 3),
      ex('leg_curl_lying', 3, 3),
    ];
    const plain = normalizeWeeklyVolume([glutes], { daysPerWeek: 1, level: 'intermediate' });
    const emph = normalizeWeeklyVolume([glutes], {
      daysPerWeek: 1, level: 'intermediate', volumeEmphasis: ['glutes_hamstrings'],
    });
    expect(emph.weekly.glutes_hamstrings).toBeGreaterThanOrEqual(plain.weekly.glutes_hamstrings);
  });

  it('core, gemelo y agarre no se recortan — no están en `CLAMPED_GROUPS`', () => {
    const core = [ex('plank', 3, 5), ex('crunch', 3, 5), ex('dead_bug', 3, 5), ex('leg_raise_lying', 3, 5)];
    const r = normalizeWeeklyVolume([core], { daysPerWeek: 3, level: 'beginner' });
    expect(r.sessions[0]).toEqual(core);
    expect(CLAMPED_GROUPS).not.toContain('core');
  });

  it('termina con un ciclo imposible en vez de colgarse', () => {
    const huge = Array.from({ length: 4 }, () => [
      ex('pulldown_pronated', 1, 6), ex('cable_row', 3, 6), ex('db_row_unilateral', 3, 6),
    ]);
    const r = normalizeWeeklyVolume(huge, { daysPerWeek: 7, level: 'beginner' });
    expect(r.sessions).toHaveLength(4);
  });
});

describe('integración — la plantilla de glúteo conserva su énfasis', () => {
  const answers = {
    level: 'intermediate', discipline: 'glutes_legs', goal: 'hypertrophy',
    daysPerWeek: 3, sessionMinutes: 90, limitations: ['none'],
    equipment: ['dumbbells', 'machines', 'cables', 'barbell', 'pullup_bar'],
  };

  it('sus 21 series de glúteo sobreviven al techo de intermedio (20)', () => {
    const { weekly } = adaptArchetype(byId('glutes_hypertrophy_intermediate'), answers);
    expect(weekly.glutes_hamstrings).toBeGreaterThan(VOLUME_BANDS.intermediate.hard);
  });

  it('el resto de grupos de esa misma plantilla sí respetan el techo', () => {
    const { weekly } = adaptArchetype(byId('glutes_hypertrophy_intermediate'), answers);
    CLAMPED_GROUPS.filter((g) => g !== 'glutes_hamstrings').forEach((g) => {
      expect(weekly[g] ?? 0).toBeLessThanOrEqual(VOLUME_BANDS.intermediate.hard);
    });
  });

  it('un principiante a 6 días recibe volumen de principiante', () => {
    const { weekly, overBudget } = adaptArchetype(byId('fullbody_hypertrophy_beginner'), {
      ...answers, level: 'beginner', discipline: 'standard', daysPerWeek: 6,
    });
    CLAMPED_GROUPS.forEach((g) => {
      if (overBudget.includes(g)) return; // declarado, no escondido
      expect(weekly[g] ?? 0).toBeLessThanOrEqual(VOLUME_BANDS.beginner.hard);
    });
  });
});

describe('tope de accesorios en el suelo — también al recortar volumen', () => {
  it('recortar volumen no deja tres accesorios a 2 series', async () => {
    const { accessoriesAtFloor, MAX_ACCESSORIES_AT_FLOOR } = await import('./sessionCompression');
    const cargada = [
      ex('pulldown_pronated', 1, 4),
      ex('cable_row',         3, 3),
      ex('db_row_unilateral', 3, 3),
      ex('face_pull',         3, 3),
      ex('bicep_curl_supination', 3, 3),
    ];
    for (const daysPerWeek of [2, 3, 4, 5, 6]) {
      const r = normalizeWeeklyVolume([cargada], { daysPerWeek, level: 'beginner' });
      expect(accessoriesAtFloor(r.sessions[0]), `${daysPerWeek} días`)
        .toBeLessThanOrEqual(MAX_ACCESSORIES_AT_FLOOR);
    }
  });
});
