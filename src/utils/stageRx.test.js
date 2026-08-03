import { describe, it, expect } from 'vitest';
import { applyRx, isNoopRx, DEFAULT_RX, LADDERS, describeRx } from './stageRx';

// Ejercicios como los escribe `buildExConfig` / el editor.
const squat  = { exerciseId: 'squat_barbell', isKey: true,  sets: 4, restSec: 120, minReps: 5, maxReps: 8, order: 1 };
const curl   = { exerciseId: 'curl_dumbbell', isKey: false, sets: 3, restSec: 60,  minReps: 8, maxReps: 12, order: 2 };
// De tiempo: `buildExConfig` deja minReps/maxReps FUERA en time_progression.
const plank  = { exerciseId: 'plank', isKey: false, sets: 3, restSec: 45, minTime: 30, maxTime: 60, order: 3 };
const LIB = {
  squat_barbell: { id: 'squat_barbell', weightStep: 5 },
  curl_dumbbell: { id: 'curl_dumbbell', weightStep: 2.5 },
  plank:         { id: 'plank', progressionModel: 'time_progression' },
};
const SESSION = [squat, curl, plank];

describe('isNoopRx', () => {
  it('treats absent / default / all-zero rules as identity', () => {
    expect(isNoopRx(null)).toBe(true);
    expect(isNoopRx(DEFAULT_RX)).toBe(true);
    expect(isNoopRx({ scope: 'keys' })).toBe(true);   // el alcance solo no cambia nada
  });

  it('spots a real rule', () => {
    expect(isNoopRx({ setsDelta: 1 })).toBe(false);
    expect(isNoopRx({ progressionHold: 'deload' })).toBe(false);
  });
});

describe('applyRx — identidad', () => {
  it('returns the very same array when the rule changes nothing', () => {
    expect(applyRx(SESSION, null, LIB)).toBe(SESSION);
    expect(applyRx(SESSION, DEFAULT_RX, LIB)).toBe(SESSION);
  });

  it('never mutates the source exercises', () => {
    const before = JSON.stringify(SESSION);
    applyRx(SESSION, { setsDelta: 2, repsShift: -3, restPct: 50 }, LIB);
    expect(JSON.stringify(SESSION)).toBe(before);
  });
});

describe('applyRx — series, repeticiones y descanso', () => {
  it('adds sets', () => {
    const [s, c] = applyRx(SESSION, { setsDelta: 1 }, LIB);
    expect(s.sets).toBe(5);
    expect(c.sets).toBe(3 + 1);
  });

  it('never goes below one set, however negative the delta', () => {
    const [s] = applyRx([{ ...squat, sets: 1 }], { setsDelta: -2 }, LIB);
    expect(s.sets).toBe(1);
  });

  it('SHIFTS the rep range instead of replacing it', () => {
    const [s, c] = applyRx(SESSION, { repsShift: -3 }, LIB);
    expect([s.minReps, s.maxReps]).toEqual([2, 5]);    // 5-8  → 2-5
    expect([c.minReps, c.maxReps]).toEqual([5, 9]);    // 8-12 → 5-9
  });

  it('keeps min ≤ max and never drops below one rep', () => {
    const [s] = applyRx([{ ...squat, minReps: 2, maxReps: 3 }], { repsShift: -4 }, LIB);
    expect(s.minReps).toBe(1);
    expect(s.maxReps).toBeGreaterThanOrEqual(s.minReps);
  });

  it('leaves timed exercises out of the rep shift but still adjusts the rest', () => {
    const [, , p] = applyRx(SESSION, { repsShift: -3, restPct: 100 }, LIB);
    expect(p.minReps).toBeUndefined();
    expect(p.maxReps).toBeUndefined();
    expect(p.minTime).toBe(30);         // intacto
    expect(p.restSec).toBe(90);
  });

  it('scales the rest and floors it at 15s', () => {
    const [s] = applyRx(SESSION, { restPct: 25 }, LIB);
    expect(s.restSec).toBe(150);
    const [, , p] = applyRx(SESSION, { restPct: -90 }, LIB);
    expect(p.restSec).toBe(15);
  });
});

describe('applyRx — alcance', () => {
  it('touches only the keys', () => {
    const [s, c] = applyRx(SESSION, { scope: 'keys', setsDelta: 1 }, LIB);
    expect(s.sets).toBe(5);
    expect(c).toBe(curl);               // sin tocar, misma referencia
  });

  it('touches only the accessories', () => {
    const [s, c] = applyRx(SESSION, { scope: 'accessories', setsDelta: -1 }, LIB);
    expect(s).toBe(squat);
    expect(c.sets).toBe(2);
  });
});

describe('applyRx — progresión', () => {
  it('halves a fixed increment, resolving it from the library when absent', () => {
    const [s] = applyRx(SESSION, { incrementScale: 0.5 }, LIB);
    expect(s.progression.increment.value).toBe(2.5);   // weightStep 5 → 2.5
  });

  it('respects minIncrement when rounding', () => {
    const ex = { ...squat, progression: { type: 'double', increment: { type: 'fixed', value: 5, minIncrement: 2.5 } } };
    const [s] = applyRx([ex], { incrementScale: 0.5 }, LIB);
    expect(s.progression.increment.value).toBe(2.5);
  });

  it('scales pct and stepped increments too', () => {
    const pct = { ...curl, progression: { type: 'double', increment: { type: 'pct', pct: 10 } } };
    const [p] = applyRx([pct], { incrementScale: 0.5 }, LIB);
    expect(p.progression.increment.pct).toBe(5);

    const stepped = { ...curl, progression: { type: 'double', increment: { type: 'stepped', steps: [{ untilSession: 4, value: 5 }, { value: 2.5 }] } } };
    const [st] = applyRx([stepped], { incrementScale: 0.5 }, LIB);
    expect(st.progression.increment.steps.map((x) => x.value)).toEqual([2.5, 1.25]);
  });

  it('marks a deload without losing the rest of the progression config', () => {
    const [s] = applyRx(SESSION, { progressionHold: 'deload' }, LIB);
    expect(s.progression.hold).toBe('deload');
    expect(s.progression.type).toBe('double');          // resuelta, no vacía
    expect(s.progression.increment.value).toBe(5);      // el incremento no se toca
  });

  it('leaves progression alone when the rule does not mention it', () => {
    const [s] = applyRx(SESSION, { setsDelta: 1 }, LIB);
    expect(s.progression).toBeUndefined();
  });
});

describe('applyRx — lo que NUNCA puede tocar', () => {
  it('keeps every id and identity field', () => {
    const rich = [{
      ...squat, linkGroup: 'lnk_1', supersetWithNext: true, dropset: { drops: 2 },
      warmup: { mode: 'auto', sets: 2 }, trainerNote: 'ojo con la rodilla', limitationNote: 'x',
    }];
    const [s] = applyRx(rich, { setsDelta: 1, repsShift: -2, restPct: 50, incrementScale: 0.5 }, LIB);
    expect(s.exerciseId).toBe('squat_barbell');
    expect(s.order).toBe(1);
    expect(s.linkGroup).toBe('lnk_1');
    expect(s.supersetWithNext).toBe(true);
    expect(s.dropset).toEqual({ drops: 2 });
    expect(s.warmup).toEqual({ mode: 'auto', sets: 2 });
    expect(s.trainerNote).toBe('ojo con la rodilla');
    expect(s.limitationNote).toBe('x');
    expect(s.isKey).toBe(true);
  });

  it('survives an empty session', () => {
    expect(applyRx([], { setsDelta: 1 }, LIB)).toEqual([]);
  });
});

describe('applyRx — los peldaños derivan de la BASE, no del anterior', () => {
  // La regla que evita que un +1 se convierta en +3 sin querer y que una
  // descarga deje el incremento a la mitad para siempre.
  it('two rungs from the same base give absolute deltas', () => {
    const rung2 = applyRx(SESSION, { setsDelta: 1 }, LIB);
    const rung3 = applyRx(SESSION, { setsDelta: 2 }, LIB);
    expect(rung2[0].sets).toBe(5);
    expect(rung3[0].sets).toBe(6);
  });

  it('a deload rung does not inherit the halved increment of another rung', () => {
    const intense = applyRx(SESSION, { incrementScale: 0.5 }, LIB);
    const deload  = applyRx(SESSION, { setsDelta: -1, progressionHold: 'deload' }, LIB);
    expect(intense[0].progression.increment.value).toBe(2.5);
    expect(deload[0].progression.increment.value).toBe(5);   // desde la base
  });
});

describe('LADDERS', () => {
  const ids = LADDERS.map((l) => l.id);

  it('every rung is a real rule with a duration and a name key', () => {
    for (const l of LADDERS) {
      expect(l.rungs.length, l.id).toBeGreaterThan(0);
      for (const r of l.rungs) {
        expect(r.nameKey, l.id).toBeTruthy();
        expect(r.durationWeeks, l.id).toBeGreaterThan(0);
        expect(isNoopRx(r.rx), `${l.id}/${r.nameKey}`).toBe(false);
      }
    }
  });

  it('every ladder ends in a deload that stops the progression', () => {
    // Sin `progressionHold` la app seguiría sugiriendo subir peso durante la
    // descarga, y la descarga no ocurriría.
    for (const l of LADDERS) {
      const last = l.rungs[l.rungs.length - 1];
      expect(last.rx.progressionHold, l.id).toBe('deload');
    }
  });

  it('intensification only shortens the rep range of the KEY lifts', () => {
    // Los accesorios viven en rango de hipertrofia haga el bloque lo que haga:
    // es la misma regla que ya aplica el generador (uniarticulares siempre con
    // parámetros de hipertrofia).
    const l = LADDERS.find((x) => x.id === 'intensification');
    for (const r of l.rungs) {
      if (r.rx.repsShift) expect(r.rx.scope).toBe('keys');
    }
  });

  it('volume adds its sets to the accessories, not to the heavy basics', () => {
    const l = LADDERS.find((x) => x.id === 'volume');
    for (const r of l.rungs) {
      if ((r.rx.setsDelta ?? 0) > 0) expect(r.rx.scope).toBe('accessories');
    }
  });

  it('has unique ids', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('applied to a real session, every rung produces a valid one', () => {
    for (const l of LADDERS) {
      for (const r of l.rungs) {
        const out = applyRx(SESSION, r.rx, LIB);
        expect(out.length).toBe(SESSION.length);
        for (const ex of out) {
          expect(ex.sets, `${l.id}/${r.nameKey}`).toBeGreaterThanOrEqual(1);
          if (ex.minReps != null) expect(ex.minReps).toBeGreaterThanOrEqual(1);
          expect(ex.restSec).toBeGreaterThanOrEqual(15);
        }
      }
    }
  });
});

describe('describeRx', () => {
  const t = (k, o) => (o ? `${k}(${JSON.stringify(o)})` : k);

  it('says nothing about a rule that changes nothing', () => {
    expect(describeRx(null, t)).toEqual([]);
    expect(describeRx(DEFAULT_RX, t)).toEqual([]);
  });

  it('names the scope so "+1 serie" is never ambiguous', () => {
    expect(describeRx({ setsDelta: 1 }, t)[0]).toContain('rxParts.setsUp');
    expect(describeRx({ scope: 'accessories', setsDelta: 1 }, t)[0]).toContain('rxParts.setsUp_accessories');
    expect(describeRx({ scope: 'keys', repsShift: -3 }, t)[0]).toContain('rxParts.repsDown_keys');
  });

  it('lists every part of a compound rule', () => {
    const parts = describeRx({ scope: 'keys', repsShift: -5, restPct: 50, incrementScale: 0.5 }, t);
    expect(parts).toHaveLength(3);
  });

  it('reports the deload', () => {
    expect(describeRx({ progressionHold: 'deload' }, t)).toEqual(['planner.rxParts.deload']);
  });
});
