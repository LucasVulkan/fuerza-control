import { describe, it, expect } from 'vitest';
import { ARCHETYPES } from '../../data/archetypes';
import { EXERCISE_LIBRARY } from '../../data/exerciseLibrary';
import { adaptArchetype } from '../../utils/archetypeAdapter';
import { DEFAULT_ANSWERS } from './proposalData';
import { cardModel, suggestedWeek } from './templateCards';

const answers = (patch = {}) => ({
  ...DEFAULT_ANSWERS, level: 'intermediate', discipline: 'standard', goal: 'hypertrophy', daysPerWeek: 3, ...patch,
});
const modelOf = (id, patch, extra = {}) => cardModel(
  adaptArchetype(ARCHETYPES.find((a) => a.id === id), answers(patch)),
  { allEx: EXERCISE_LIBRARY, days: 3, minutes: 60, ...extra },
);

describe('suggestedWeek', () => {
  it('reparte los días y no se sale de la semana', () => {
    expect(suggestedWeek(3)).toEqual([0, 2, 4]);
    expect(suggestedWeek(7)).toHaveLength(7);
    expect(suggestedWeek(0)).toEqual([0]);
    expect(suggestedWeek(12)).toHaveLength(7);
  });
});

describe('cardModel', () => {
  it('sesiones, minutos, series por sesión y semana de la plantilla ya ajustada', () => {
    const m = modelOf('fullbody_hypertrophy_intermediate');
    expect(m.sessions).toHaveLength(3);
    expect(m.sets).toBe(21);
    expect(m.minutes).toBeGreaterThan(30);
    expect(m.week).toEqual([0, 2, 4]);
  });

  it('las series por semana salen de mayor a menor, máximo cinco grupos y sin «cuerpo completo»', () => {
    const { groups } = modelOf('fullbody_hypertrophy_intermediate');
    expect(groups.length).toBeLessThanOrEqual(5);
    expect(groups.map((g) => g[1])).toEqual([...groups.map((g) => g[1])].sort((a, b) => b - a));
    expect(groups.some(([g]) => g === 'full_body')).toBe(false);
  });

  it('con menos tiempo la sesión tiene menos series (el recorte se nota en la tarjeta)', () => {
    const largo = modelOf('fullbody_hypertrophy_intermediate', { sessionMinutes: 90 }, { minutes: 90 });
    const corto = modelOf('fullbody_hypertrophy_intermediate', { sessionMinutes: 30 }, { minutes: 30 });
    expect(corto.sets).toBeLessThan(largo.sets);
    expect(corto.minutes).toBeLessThan(largo.minutes);
  });

  it('el volumen semanal escala con los días: 6 días con una plantilla de 3 sesiones duplican el del ciclo', () => {
    const tres = modelOf('fullbody_hypertrophy_intermediate', {}, { days: 3 });
    const seis = modelOf('fullbody_hypertrophy_intermediate', { daysPerWeek: 6 }, { days: 6 });
    expect(seis.groups[0][1]).toBeGreaterThan(tres.groups[0][1]);
  });
});
