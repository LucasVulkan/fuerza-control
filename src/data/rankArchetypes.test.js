import { describe, it, expect } from 'vitest';
import { rankArchetypes, ARCHETYPES } from './archetypes';

const FULL_GYM = ['dumbbells', 'machines', 'cables', 'barbell', 'pullup_bar', 'kettlebell'];

const ask = (over = {}) => ({
  level: 'intermediate', discipline: 'standard', goal: 'hypertrophy',
  daysPerWeek: 3, equipment: FULL_GYM, limitations: ['none'], ...over,
});

const winner = (over) => rankArchetypes(ask(over))[0];

describe('rankArchetypes — contrato', () => {
  it('nunca devuelve vacío, sean cuales sean las respuestas', () => {
    for (const level of ['beginner', 'intermediate', 'advanced']) {
      for (const discipline of ['standard', 'calisthenics', 'glutes_legs', 'strength']) {
        for (const daysPerWeek of [1, 2, 3, 4, 5, 6, 7]) {
          for (const equipment of [[], ['dumbbells'], FULL_GYM]) {
            const r = rankArchetypes(ask({ level, discipline, daysPerWeek, equipment }));
            expect(r.length, `${level}/${discipline}/${daysPerWeek}d`).toBe(ARCHETYPES.length);
            expect(r[0].archetype).toBeTruthy();
          }
        }
      }
    }
  });

  it('sin respuestas devuelve algo utilizable', () => {
    expect(rankArchetypes()[0].archetype).toBeTruthy();
  });

  it('es determinista', () => {
    const a = rankArchetypes(ask()).map((r) => r.archetype.id);
    const b = rankArchetypes(ask()).map((r) => r.archetype.id);
    expect(a).toEqual(b);
  });

  it('viene ordenado de mayor a menor puntuación', () => {
    const scores = rankArchetypes(ask({ daysPerWeek: 4 })).map((r) => r.score);
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);
  });
});

describe('rankArchetypes — qué gana y por qué', () => {
  it('la identidad manda: fuerza recibe una plantilla de fuerza', () => {
    expect(winner({ discipline: 'strength', goal: 'strength', level: 'advanced' })
      .archetype.discipline).toBe('strength');
  });

  it('glúteo recibe la de glúteo', () => {
    expect(winner({ discipline: 'glutes_legs' }).archetype.discipline).toBe('glutes_legs');
  });

  it('a 4 días gana un ciclo de 4 sesiones sobre uno de 3', () => {
    expect(winner({ daysPerWeek: 4 }).sessionsPerCycle).toBe(4);
  });

  it('a 3 días gana un ciclo de 3 sesiones sobre uno de 4', () => {
    expect(winner({ daysPerWeek: 3 }).sessionsPerCycle).toBe(3);
  });

  it('el nivel NO bloquea una distribución: nada veta a un principiante', () => {
    // Repartir los días en full body, U/L o PPL es organización, no dificultad.
    // Lo que cambia con el nivel es el volumen y la selección de ejercicios.
    // Antes había un −100 a las plantillas de >3 sesiones para principiantes:
    // era un veto, y el día que exista un PPL de 6 vetaría justo la respuesta
    // correcta para quien entrena 6 días.
    for (const daysPerWeek of [1, 2, 3, 4, 5, 6, 7]) {
      const ranked = rankArchetypes(ask({ level: 'beginner', daysPerWeek }));
      const grandes = ranked.filter((r) => r.sessionsPerCycle > 3);
      grandes.forEach((r) => {
        const equivalente = ranked.find((x) => x.sessionsPerCycle <= 3
          && x.archetype.discipline === r.archetype.discipline
          && x.cycleSpeed === r.cycleSpeed);
        // Sin plantilla equivalente no hay nada que comparar; lo que se
        // comprueba es que la diferencia nunca sea un abismo de veto.
        if (equivalente) expect(Math.abs(r.score - equivalente.score)).toBeLessThan(50);
      });
    }
  });

  it('el nivel pesa: un principiante prefiere la plantilla de principiante', () => {
    expect(winner({ level: 'beginner' }).archetype.level).toBe('beginner');
  });

  it('el material baja la puntuación de una plantilla, no la elimina', () => {
    // Una misma plantilla puntúa peor cuanto más haya que sustituir. Pero es un
    // término entre varios: acertar el nivel (+20) pesa más que tres
    // sustituciones (−9), y con razón — sustituir es justo lo que el adaptador
    // hace bien.
    const id = 'upperlower_hypertrophy_advanced';
    const rich = rankArchetypes(ask({ equipment: FULL_GYM })).find((r) => r.archetype.id === id);
    const poor = rankArchetypes(ask({ equipment: ['dumbbells'] })).find((r) => r.archetype.id === id);

    expect(poor.adaptationCost).toBeGreaterThan(rich.adaptationCost);
    expect(poor.score).toBeLessThan(rich.score);
  });

  it('el material ordena pero no excluye: todas siguen en la lista', () => {
    const r = rankArchetypes(ask({ equipment: [] }));
    expect(r).toHaveLength(ARCHETYPES.length);
    expect(r.some((x) => x.adaptationCost > 0)).toBe(true);
  });
});

describe('rankArchetypes — velocidad de ciclo', () => {
  it('calcula ciclos por semana', () => {
    const r = rankArchetypes(ask({ daysPerWeek: 6 }))
      .find((x) => x.archetype.id === 'fullbody_hypertrophy_intermediate');
    expect(r.cycleSpeed).toBe(2);
    expect(r.notes).toContain('rotates');
  });

  it('un ciclo que avanza demasiado despacio se penaliza y se marca', () => {
    const slow = rankArchetypes(ask({ daysPerWeek: 1 }))
      .find((x) => x.sessionsPerCycle === 4);
    expect(slow.notes).toContain('slowCycle');
  });

  it('fuerza es más exigente con la frecuencia que hipertrofia', () => {
    // Un ciclo de 3 sesiones a 2 días/semana: 0,67 ciclos/semana. Para
    // hipertrofia pasa; para fuerza no, porque no se practica el levantamiento.
    const strength = rankArchetypes(ask({ daysPerWeek: 2, discipline: 'strength' }))
      .find((x) => x.archetype.discipline === 'strength');
    const hyper = rankArchetypes(ask({ daysPerWeek: 2 }))
      .find((x) => x.archetype.id === 'fullbody_hypertrophy_intermediate');

    expect(strength.notes).toContain('slowCycle');
    expect(hyper.notes).not.toContain('slowCycle');
  });
});

describe('rankArchetypes — avisos para la pantalla de propuestas', () => {
  it('declara cuántos ejercicios habría que sustituir', () => {
    const r = rankArchetypes(ask({ equipment: ['dumbbells'] }))
      .find((x) => x.archetype.id === 'upperlower_hypertrophy_advanced');
    expect(r.adaptationCost).toBeGreaterThan(0);
    expect(r.notes).toContain('needsBarbell');
  });

  it('con el material completo no hay coste ni aviso', () => {
    const r = rankArchetypes(ask()).find((x) => x.archetype.id === 'fullbody_hypertrophy_intermediate');
    expect(r.adaptationCost).toBe(0);
    expect(r.notes).not.toContain('needsBarbell');
  });

  it('marca cuando la plantilla no es del nivel pedido', () => {
    const r = rankArchetypes(ask({ level: 'beginner' }))
      .find((x) => x.archetype.level === 'advanced');
    expect(r.notes).toContain('levelStretch');
  });
});
