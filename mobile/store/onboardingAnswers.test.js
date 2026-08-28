/**
 * El contrato entre el onboarding y el motor (`onboarding-proposals.md` §8).
 *
 * La pantalla dejó de elegir la plantilla por su cuenta: la elige el usuario en
 * la lista de propuestas y la pasa como `archetypeId`. Lo que aquí se vigila es
 * que esa elección se respete y que el snapshot que queda guardado siga
 * sirviendo para regenerar el programa — incluida la `distribution`, que ya no
 * se pregunta y viene de la plantilla elegida.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, normalizeOnboardingAnswers } from './useStore.js';
import { ARCHETYPES } from '../../src/data/archetypes.js';

// Lo que produce el flujo nuevo: seis respuestas más la progresión, y la
// `distribution` tomada de la plantilla elegida justo antes de guardar.
const ANSWERS = {
  level: 'intermediate',
  discipline: 'standard',
  goal: 'hypertrophy',
  daysPerWeek: 4,
  equipment: ['dumbbells', 'machines', 'barbell', 'pullup_bar'],
  sessionMinutes: 60,
  limitations: ['none'],
  progressionModel: 'double_progression',
  distribution: 'upper_lower',
};

describe('normalizeOnboardingAnswers', () => {
  it("'bodyweight' es un id de UI: se traduce a lista vacía", () => {
    const { equipment } = normalizeOnboardingAnswers({ equipment: ['bodyweight', 'dumbbells'] });
    expect(equipment).toEqual([]);
  });

  it('quien tiene máquinas tiene poleas', () => {
    const { equipment } = normalizeOnboardingAnswers({ equipment: ['machines'] });
    expect(equipment).toEqual(['machines', 'cables']);
  });

  it('es idempotente — la pantalla normaliza para su preview y el store repite', () => {
    const once  = normalizeOnboardingAnswers(ANSWERS);
    const twice = normalizeOnboardingAnswers(once);
    expect(twice).toEqual(once);
  });

  it('no pierde ninguna respuesta por el camino', () => {
    expect(Object.keys(normalizeOnboardingAnswers(ANSWERS)).sort())
      .toEqual(Object.keys(ANSWERS).sort());
  });
});

describe('generateAndActivateProgram', () => {
  beforeEach(() => {
    useStore.setState({ programs: {}, sessionTemplates: {} });
  });

  it('usa la plantilla que eligió el usuario, no la primera del ranking', async () => {
    // Una que con estas respuestas NO gana: 2 días frente a los 4 pedidos.
    const elegida = ARCHETYPES.find((a) => a.id === 'fullbody2_hypertrophy_intermediate');
    const { program } = await useStore.getState()
      .generateAndActivateProgram(ANSWERS, elegida.id);

    const dias = program.stages[0].days.length;
    expect(dias).toBe(elegida.days.length);
    expect(program.onboardingSnapshot.distribution).toBe('upper_lower');
  });

  it('sin `archetypeId` sigue mandando el ranking', async () => {
    const { program } = await useStore.getState().generateAndActivateProgram(ANSWERS);
    // 4 días por semana con plantillas de 4 sesiones: nunca la de 2 días.
    expect(program.stages[0].days.length).not.toBe(2);
  });

  it('el snapshot conserva todas las respuestas — se usa para regenerar', async () => {
    const { program } = await useStore.getState().generateAndActivateProgram(ANSWERS);
    for (const [campo, valor] of Object.entries(ANSWERS)) {
      if (campo === 'equipment') continue;   // normalizado aparte, ver abajo
      expect(program.onboardingSnapshot[campo]).toEqual(valor);
    }
    // Normalizado, no crudo: es lo que el motor sabe leer.
    expect(program.onboardingSnapshot.equipment)
      .toEqual(normalizeOnboardingAnswers(ANSWERS).equipment);
    expect(useStore.getState().profile.onboardingAnswers)
      .toEqual(program.onboardingSnapshot);
  });
});
