import { describe, it, test, expect } from 'vitest';
import { getProgression, resolveProgressionConfig } from './progression';

// getProgression builds an i18n message via t(); we only assert chip.type,
// which is independent of the translated text, so a no-op stub is enough.
const t = () => '';

const def = { progressionModel: 'double_progression', minReps: 4, maxReps: 6, weightStep: 2.5 };

function rpeConfig(maxRpe) {
  return {
    exerciseId: 'test', sets: 3, minReps: 4, maxReps: 6, inputType: 'weight_reps',
    progression: {
      type: 'double', direction: 'increase',
      evaluation: { mode: 'rpe', maxRpe },
      increment: { type: 'fixed', value: 2.5 },
    },
  };
}

const sets = (rpe, reps = '6') => [
  { weight: '100', reps, rpe, done: true },
  { weight: '100', reps, rpe, done: true },
  { weight: '100', reps, rpe, done: true },
];

describe('getProgression — RPE evaluation', () => {
  test('all sets at top reps, avg RPE below target → advance (up)', () => {
    expect(getProgression(rpeConfig(8), def, sets('7.5'), t)?.type).toBe('up');
  });

  test('grinding at RPE 10 → hold: ya no se baja por RPE, solo por la regla de bajar (§4.6)', () => {
    expect(getProgression(rpeConfig(8), def, sets('10'), t)?.type).toBe('hold');
  });

  test('completed but above RPE target → hold', () => {
    expect(getProgression(rpeConfig(8), def, sets('8.5'), t)?.type).toBe('hold');
  });

  test('top reps but RPE missing → previous behaviour (advance)', () => {
    expect(getProgression(rpeConfig(8), def, sets(''), t)?.type).toBe('up');
  });

  test('low RPE but reps below max → hold (not at top of range yet)', () => {
    expect(getProgression(rpeConfig(8), def, sets('7', '4'), t)?.type).toBe('hold');
  });
});

describe('getProgression — RPE does not leak into other modes', () => {
  test('all_complete ignores RPE data entirely', () => {
    const cfg = rpeConfig(8);
    cfg.progression.evaluation.mode = 'all_complete';
    // RPE 10 would force a retreat under rpe mode, but all_complete looks only at reps
    expect(getProgression(cfg, def, sets('10'), t)?.type).toBe('up');
  });
});

describe('getProgression — guards', () => {
  test('returns null with no sets', () => {
    expect(getProgression(rpeConfig(8), def, [], t)).toBeNull();
  });
});

// ── Descarga (docs/specs/stage-planner.md §6) ───────────────────────────────

describe('progression.hold = "deload"', () => {
  const t = (k, o) => (o ? `${k}:${JSON.stringify(o)}` : k);
  const deload = (extra = {}) => ({
    sets: 3, minReps: 8, maxReps: 12,
    progression: { type: 'double', hold: 'deload', increment: { type: 'fixed', value: 2.5 } },
    ...extra,
  });
  const perfect = [
    { weight: '60', reps: '12', done: true },
    { weight: '60', reps: '12', done: true },
    { weight: '60', reps: '12', done: true },
  ];
  const awful = [{ weight: '60', reps: '4', done: true }];

  it('never suggests going up, however perfect the session', () => {
    const chip = getProgression(deload(), null, perfect, t);
    expect(chip.type).toBe('hold');
    expect(chip.reason).toBe('deload');
  });

  it('never suggests going down either — the block asked for this', () => {
    expect(getProgression(deload(), null, awful, t).type).toBe('hold');
  });

  it('does NOT hide the chip: silence reads as "no progression" and the client adds weight', () => {
    const chip = getProgression(deload(), null, perfect, t);
    expect(chip).not.toBeNull();
    expect(chip.msg).toContain('progression.deload_hold');
  });

  it('keeps prefilling the working weight', () => {
    expect(getProgression(deload(), null, perfect, t).suggestedWeight).toBe(60);
  });

  it('applies to every progression type, not just double', () => {
    for (const type of ['double', 'weight', 'reps', 'time']) {
      const cfg = deload({ progression: { type, hold: 'deload', increment: { type: 'fixed', value: 2.5 } } });
      const chip = getProgression(cfg, null, perfect, t);
      expect(chip.reason, type).toBe('deload');
      expect(chip.type, type).toBe('hold');
    }
  });

  it('type "none" still wins — that exercise has no chip at all', () => {
    const cfg = deload({ progression: { type: 'none', hold: 'deload' } });
    expect(getProgression(cfg, null, perfect, t)).toBeNull();
  });

  it('leaves normal exercises untouched', () => {
    const normal = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double', increment: { type: 'fixed', value: 2.5 } } };
    const chip = getProgression(normal, null, perfect, t);
    expect(chip.type).toBe('up');
    expect(chip.reason).toBeUndefined();
  });

  it('resolveProgressionConfig normalizes hold to null when absent', () => {
    expect(resolveProgressionConfig({}, null).hold).toBeNull();
    expect(resolveProgressionConfig({ progression: { type: 'double', hold: 'deload' } }, null).hold).toBe('deload');
  });
});

describe('progression.type = "effort" (effort-progression.md §4.2)', () => {
  const tk = (k) => k;
  const cfg = (extra = {}) => ({
    sets: 3, minReps: 5, maxReps: 5,
    progression: { type: 'effort', targetRpe: 8 },
    ...extra,
  });
  const lib = { weightStep: 2.5 };
  const at = (rpe, weight = '80', reps = '5') => [1, 2, 3].map(() => ({ weight, reps, rpe, done: true }));

  it('RPE según lo previsto → mantener el mismo peso', () => {
    const chip = getProgression(cfg(), lib, at('8'), tk);
    expect(chip).toMatchObject({ type: 'hold', suggestedWeight: 80, why: 'progression.why_effortOnTarget' });
  });
  it('más fácil (RPE 7) → sube a 82.5', () => {
    const chip = getProgression(cfg(), lib, at('7'), tk);
    expect(chip).toMatchObject({ type: 'up', suggestedWeight: 82.5, why: 'progression.why_effortEasier' });
  });
  it('más duro (RPE 9) → baja a 77.5', () => {
    const chip = getProgression(cfg(), lib, at('9'), tk);
    expect(chip).toMatchObject({ type: 'down', suggestedWeight: 77.5, why: 'progression.why_effortHarder' });
  });
  it('sin RPE apuntado → mantiene el peso y pide el RPE', () => {
    const chip = getProgression(cfg(), lib, at(''), tk);
    expect(chip).toMatchObject({ type: 'hold', suggestedWeight: 80, why: 'progression.why_effortNoRpe' });
  });
  it('reps + recámara > 12 → mantiene el peso', () => {
    const chip = getProgression(cfg({ minReps: 10, maxReps: 10, progression: { type: 'effort', targetRpe: 7 } }), lib, at('8', '60', '10'), tk);
    expect(chip).toMatchObject({ type: 'hold', suggestedWeight: 60, why: 'progression.why_effortUnreliable' });
  });
  it('sin peso (peso corporal) → sin número', () => {
    const chip = getProgression(cfg(), lib, at('8', ''), tk);
    expect(chip).toMatchObject({ type: 'hold', suggestedWeight: null });
  });
  it('descarga manda: mantener', () => {
    const chip = getProgression(cfg({ progression: { type: 'effort', targetRpe: 8, hold: 'deload' } }), lib, at('6'), tk);
    expect(chip).toMatchObject({ type: 'hold', reason: 'deload', suggestedWeight: 80 });
  });
  it('redondea al escalón del ejercicio (§4.4); 0 o sin él → 2.5', () => {
    // RPE 7 → 82.16: con paso 1 → 82; con paso 5 → 80 (antes, como mucho 2.5); con 0 o sin él → 82.5.
    expect(getProgression(cfg(), { weightStep: 1 }, at('7'), tk).suggestedWeight).toBe(82);
    expect(getProgression(cfg(), { weightStep: 5 }, at('7'), tk).suggestedWeight).toBe(80);
    expect(getProgression(cfg(), { weightStep: 0 }, at('7'), tk).suggestedWeight).toBe(82.5);
    expect(getProgression(cfg(), null, at('7'), tk).suggestedWeight).toBe(82.5);
  });
  it('el escalón del ejercicio (exConfig.weightStep) manda sobre el de la librería', () => {
    expect(getProgression(cfg({ weightStep: 1 }), { weightStep: 5 }, at('7'), tk).suggestedWeight).toBe(82);
    expect(getProgression(cfg({ weightStep: 1.25 }), { weightStep: 5 }, at('7'), tk).suggestedWeight % 1.25).toBe(0);
  });
  it('RPE por debajo de 5 cuenta como 5: una serie fácil sube el peso, nunca lo baja (QA P48)', () => {
    // 70 × 5 @4 → como @5: e1RM 93.3 → 75.7 → 75. Antes, 66.2 → bajaba.
    for (const rpe of ['4', '2']) {
      expect(getProgression(cfg(), lib, at(rpe, '70'), tk)).toMatchObject({ type: 'up', suggestedWeight: 75 });
    }
  });

  it('reps + recámara de más cuentan como 12, no se descartan (QA P48)', () => {
    // Objetivo 8 @8. El cliente hace 47 kg con más reps y RPE bajo. Antes solo
    // contaba la serie de 8 @7 (47.5), y con todas fáciles salía «apunta el RPE».
    const c = cfg({ minReps: 8, maxReps: 8 });
    const mixed = [['10', '6'], ['9', '6'], ['8', '7']].map(([reps, rpe]) => ({ weight: '47', reps, rpe, done: true }));
    // 65.8, 65.8, 64.2 → 65.27 / (1 + 10/30) = 48.95 → 50
    expect(getProgression(c, lib, mixed, tk)).toMatchObject({ type: 'up', suggestedWeight: 50 });
    const easy = [1, 2, 3].map(() => ({ weight: '47', reps: '10', rpe: '5', done: true }));
    expect(getProgression(c, lib, easy, tk)).toMatchObject({ type: 'up', suggestedWeight: 50 });
  });

  it('series con pesos distintos: media de los e1RM', () => {
    const sets = [
      { weight: '85', reps: '5', rpe: '9', done: true },  // 85 × (1 + 6/30) = 102
      { weight: '75', reps: '5', rpe: '7', done: true },  // 75 × (1 + 8/30) = 95
    ];
    // media 98.5 → 98.5 / (1 + 7/30) = 79.86 → 80; el máximo apuntado era 85 → baja
    expect(getProgression(cfg(), lib, sets, tk)).toMatchObject({ type: 'down', suggestedWeight: 80 });
  });
  it('resolveProgressionConfig trae targetRpe (8 por defecto)', () => {
    expect(resolveProgressionConfig({ progression: { type: 'effort' } }, null).targetRpe).toBe(8);
    expect(resolveProgressionConfig({ progression: { type: 'effort', targetRpe: 9 } }, null).targetRpe).toBe(9);
  });
});

describe('P52 — los cuatro fallos del motor', () => {
  const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  const done = (rows) => rows.map(([weight, reps, time]) => ({ weight, reps, time, done: true }));

  describe('Reps: sube desde lo hecho, de 1 en 1', () => {
    const cfg = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'reps' } };
    it('serie más floja 9 → apunta a 10', () => {
      const c = getProgression(cfg, {}, done([['', '11'], ['', '10'], ['', '9']]), tk);
      expect(c.type).toBe('up');
      expect(c.msg).toContain('"next":10');
    });
    it('una serie bajo el mínimo → mantener, no subir', () => {
      expect(getProgression(cfg, {}, done([['', '9'], ['', '8'], ['', '6']]), tk).type).toBe('hold');
    });
    it('no se atasca: 13 hechas → 14, no el máximo de la plantilla + salto', () => {
      expect(getProgression(cfg, {}, done([['', '13'], ['', '13'], ['', '13']]), tk).msg).toContain('"next":14');
    });
    it('el salto por defecto es 1 rep, no el weightStep', () => {
      expect(resolveProgressionConfig(cfg, { weightStep: 2.5 }).increment.value).toBe(1);
    });
  });

  describe('Tiempo: sube desde lo hecho', () => {
    const cfg = { sets: 3, minTime: 20, maxTime: 40, inputType: 'time', progression: { type: 'time' } };
    it('45 s hechos con objetivo 20–40 → 50 s, nunca menos de lo hecho', () => {
      const c = getProgression(cfg, {}, done([['', '', '45'], ['', '', '45'], ['', '', '45']]), tk);
      expect(c.type).toBe('up');
      expect(c.suggestedTime).toBe(50);
      expect(c.from).toBe(45);
    });
    it('una serie bajo el mínimo → mantener', () => {
      expect(getProgression(cfg, {}, done([['', '', '30'], ['', '', '15'], ['', '', '30']]), tk).type).toBe('hold');
    });
  });

  describe('Asistidas: la dirección es del ejercicio', () => {
    const assisted = { progressionDirection: 'decrease', weightStep: 2.5 };
    const edited = { sets: 3, minReps: 6, maxReps: 10, progression: { type: 'double', direction: 'increase' } };
    it('aunque la plantilla diga increase (editor antiguo), baja la asistencia', () => {
      const c = getProgression(edited, assisted, done([['20', '10'], ['20', '10'], ['20', '10']]), tk);
      expect(c.suggestedWeight).toBe(17.5);
    });
    it('sin def (ejercicio borrado) cuenta la de la plantilla', () => {
      expect(resolveProgressionConfig({ progression: { type: 'double', direction: 'decrease' } }, null).direction).toBe('decrease');
    });
  });

  describe('Doble con «% mínimo»', () => {
    const cfg = (pct) => ({
      sets: 3, minReps: 8, maxReps: 12,
      progression: { type: 'double', evaluation: { mode: 'pct', pctThreshold: pct } },
    });
    const sets2of3 = done([['60', '12'], ['60', '12'], ['60', '9']]);
    it('2 de 3 al máximo con umbral 60 % → sube', () => {
      expect(getProgression(cfg(0.6), {}, sets2of3, tk).suggestedWeight).toBe(62.5);
    });
    it('2 de 3 al máximo con umbral 80 % → mantener', () => {
      expect(getProgression(cfg(0.8), {}, sets2of3, tk).type).toBe('hold');
    });
    it('«Todas ✓» sigue pidiendo todas', () => {
      const all = { ...cfg(0.6), progression: { type: 'double' } };
      expect(getProgression(all, {}, sets2of3, tk).type).toBe('hold');
    });
  });
});

describe('QA P52 — los textos dicen lo que pasó', () => {
  const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  const done = (rows) => rows.map(([weight, reps]) => ({ weight, reps, done: true }));
  it('«% mínimo» que sube sin todas al máximo: el motivo cuenta las que llegaron', () => {
    const cfg = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double', evaluation: { mode: 'pct', pctThreshold: 0.6 } } };
    const c = getProgression(cfg, {}, done([['60', '12'], ['60', '12'], ['60', '9']]), tk);
    expect(c.why).toBe('progression.why_partHit{"need":2,"n":3,"goal":12}');
  });
  it('todas al máximo: el motivo de siempre', () => {
    const cfg = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double' } };
    expect(getProgression(cfg, {}, done([['60', '12'], ['60', '12'], ['60', '12']]), tk).why).toBe('progression.why_allHit');
  });
  it('asistido: el chip va marcado para que la tarjeta no diga «Subir»', () => {
    const c = getProgression({ sets: 3, minReps: 6, maxReps: 10, progression: { type: 'double' } },
      { progressionDirection: 'decrease', weightStep: 2.5 }, done([['20', '10'], ['20', '10'], ['20', '10']]), tk);
    expect(c.assist).toBe(true);
    expect(c.suggestedWeight).toBe(17.5);
  });
});

describe('QA P52 — Reps y Tiempo llevan número, también al mantener', () => {
  const done = (rows) => rows.map(([reps, time]) => ({ reps, time, done: true }));
  it('Reps sube: cifra, desde dónde y motivo', () => {
    const c = getProgression({ sets: 3, minReps: 6, maxReps: 12, progression: { type: 'reps' } }, {}, done([['9'], ['8'], ['8']]), t);
    expect([c.type, c.suggestedReps, c.from]).toEqual(['up', 9, 8]);
  });
  it('Reps mantiene: la cifra es el mínimo', () => {
    const c = getProgression({ sets: 3, minReps: 6, maxReps: 12, progression: { type: 'reps' } }, {}, done([['7'], ['6'], ['5']]), t);
    expect([c.type, c.suggestedReps]).toEqual(['hold', 6]);
  });
  it('Tiempo mantiene: la cifra es el mínimo', () => {
    const c = getProgression({ sets: 3, minTime: 30, maxTime: 60, inputType: 'time', progression: { type: 'time' } }, {}, done([['', '35'], ['', '25'], ['', '30']]), t);
    expect([c.type, c.suggestedTime]).toEqual(['hold', 30]);
  });
});

// ── P54 — el modelo nuevo (docs/specs/progresion-clara.md §4) ───────────────

describe('P54 — «Peso · por reglas» (§4.2)', () => {
  const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  // n series con 60 kg y esas reps (y RPE si se da).
  const run = (cfg, reps, rpe = '') => getProgression(
    cfg, {}, reps.map((r) => ({ weight: '60', reps: String(r), rpe, done: true })), tk,
  );
  const cfg = (n, evaluation, extra = {}) => ({
    sets: n, minReps: 8, maxReps: 12,
    progression: { type: 'double', ...(evaluation ? { evaluation } : {}), ...extra },
  });

  describe('Todas, con 3 series', () => {
    const c = cfg(3);
    it('sube con todas a la meta', () => expect(run(c, [12, 12, 12])).toMatchObject({ type: 'up', suggestedWeight: 62.5, why: 'progression.why_allHit' }));
    it('mantiene con todas en el rango', () => expect(run(c, [12, 10, 9])).toMatchObject({ type: 'hold', suggestedWeight: 60 }));
    it('mantiene con una sola bajo el suelo', () => expect(run(c, [12, 12, 7]).type).toBe('hold'));
    it('baja con 2 de 3 bajo el suelo', () => expect(run(c, [9, 7, 7])).toMatchObject({ type: 'down', suggestedWeight: 57.5, why: 'progression.why_belowMin' }));
  });

  describe('Todas, con 5 series', () => {
    const c = cfg(5);
    it('sube con todas', () => expect(run(c, [12, 12, 12, 12, 12]).type).toBe('up'));
    it('mantiene con 2 bajo el suelo', () => expect(run(c, [12, 12, 12, 7, 7]).type).toBe('hold'));
    it('baja con 3 bajo el suelo', () => expect(run(c, [12, 12, 7, 7, 7]).type).toBe('down'));
  });

  describe('Parcial', () => {
    it('3 series, 2 de 3: sube con 2 a la meta y el motivo cuenta', () => {
      expect(run(cfg(3, { mode: 'part', need: 2 }), [12, 12, 9])).toMatchObject({
        type: 'up', suggestedWeight: 62.5, why: 'progression.why_partHit{"need":2,"n":3,"goal":12}',
      });
    });
    it('3 series, 2 de 3: con 1 a la meta mantiene', () => {
      expect(run(cfg(3, { mode: 'part', need: 2 }), [12, 9, 9]).type).toBe('hold');
    });
    it('3 series, 2 de 3: con 2 bajo el suelo baja', () => {
      expect(run(cfg(3, { mode: 'part', need: 2 }), [12, 7, 7]).type).toBe('down');
    });
    it('con todas a la meta el motivo es el de siempre', () => {
      expect(run(cfg(3, { mode: 'part', need: 2 }), [12, 12, 12]).why).toBe('progression.why_allHit');
    });
    it('5 series, 3 de 5', () => {
      const c = cfg(5, { mode: 'part', need: 3 });
      expect(run(c, [12, 12, 12, 9, 9]).type).toBe('up');
      expect(run(c, [12, 12, 9, 9, 9]).type).toBe('hold');
      expect(run(c, [12, 12, 7, 7, 7]).type).toBe('down');
    });
    it('`need` se recorta a las series de la sesión', () => {
      expect(run(cfg(2, { mode: 'part', need: 5 }), [12, 12]).type).toBe('up');
    });
  });

  describe('RPE máx.', () => {
    const c = (n = 3) => cfg(n, { mode: 'rpe', maxRpe: 8 });
    it('todas a la meta con RPE medio ≤ máx → sube', () => expect(run(c(), [12, 12, 12], '7.5').type).toBe('up'));
    it('todas a la meta con RPE medio > máx → mantiene, y dice por qué', () => {
      expect(run(c(), [12, 12, 12], '8.5')).toMatchObject({ type: 'hold', suggestedWeight: 60, why: 'progression.why_rpeAbove{"maxRpe":8}' });
    });
    it('sin RPE apuntado → como Todas', () => expect(run(c(), [12, 12, 12], '').type).toBe('up'));
    it('series malas con RPE 10 → no baja por RPE: mantiene', () => expect(run(c(), [12, 10, 9], '10').type).toBe('hold'));
    it('2 de 3 bajo el suelo con RPE 10 → baja por la regla, no por el RPE', () => expect(run(c(), [9, 7, 7], '10').type).toBe('down'));
    it('5 series', () => {
      expect(run(c(5), [12, 12, 12, 12, 12], '7').type).toBe('up');
      expect(run(c(5), [12, 12, 12, 12, 11], '7').type).toBe('hold');
    });
  });

  describe('Cuándo baja', () => {
    it('el valor por defecto es lo de hoy: ⌊n·0,4⌋+1 fallos (2 de 3, 2 de 4, 3 de 5)', () => {
      for (const [n, fails] of [[3, 2], [4, 2], [5, 3]]) {
        const bad = (k) => [...Array(n - k).fill(12), ...Array(k).fill(7)];
        expect(run(cfg(n), bad(fails)).type, `${n}: ${fails} fallos`).toBe('down');
        expect(run(cfg(n), bad(fails - 1)).type, `${n}: ${fails - 1} fallos`).toBe('hold');
      }
    });
    it("'never' no baja nunca", () => {
      expect(run(cfg(3, undefined, { down: 'never' }), [7, 7, 7]).type).toBe('hold');
    });
    it('{ fails: 1 } baja con un solo fallo', () => {
      expect(run(cfg(3, undefined, { down: { fails: 1 } }), [12, 12, 7]).type).toBe('down');
    });
    it('`fails` se recorta a [1, n]', () => {
      expect(run(cfg(3, undefined, { down: { fails: 9 } }), [12, 7, 7]).type).toBe('hold');
      expect(run(cfg(3, undefined, { down: { fails: 9 } }), [7, 7, 7]).type).toBe('down');
      expect(run(cfg(3, undefined, { down: { fails: 0 } }), [12, 12, 7]).type).toBe('down');
    });
    it('el defecto sale de las series de la sesión, no de las de la etapa base', () => {
      // Guardado sin `down` y con 5 series en la sesión: 3 fallos, no los 2 de n = 3.
      expect(run(cfg(5), [12, 12, 12, 7, 7]).type).toBe('hold');
    });
    it('sin peso no hay nada que bajar', () => {
      const c = getProgression(cfg(3), {}, [7, 7, 7].map((r) => ({ weight: '', reps: String(r), done: true })), tk);
      expect(c.type).toBe('hold');
    });
  });

  describe('Asistidas: el espejo', () => {
    const assisted = { progressionDirection: 'decrease', weightStep: 2.5 };
    const go = (c, reps, w = '20', rpe = '') => getProgression(c, assisted, reps.map((r) => ({ weight: w, reps: String(r), rpe, done: true })), tk);
    it('todas a la meta → menos ayuda', () => expect(go(cfg(3), [12, 12, 12])).toMatchObject({ type: 'up', suggestedWeight: 17.5, assist: true }));
    it('Parcial: 2 de 3 → menos ayuda, con el motivo', () => {
      expect(go(cfg(3, { mode: 'part', need: 2 }), [12, 12, 9])).toMatchObject({ type: 'up', suggestedWeight: 17.5, why: 'progression.why_partHit{"need":2,"n":3,"goal":12}' });
    });
    it('RPE máx.: la puerta también aplica', () => {
      expect(go(cfg(3, { mode: 'rpe', maxRpe: 8 }), [12, 12, 12], '20', '9')).toMatchObject({ type: 'hold', why: 'progression.why_rpeAbove{"maxRpe":8}' });
    });
    it('2 de 3 bajo el suelo → más ayuda', () => expect(go(cfg(3), [9, 7, 7])).toMatchObject({ type: 'down', suggestedWeight: 22.5 }));
    it("'never' no añade ayuda", () => expect(go(cfg(3, undefined, { down: 'never' }), [7, 7, 7]).type).toBe('hold'));
    it('sin ayuda y todas a la meta → versión lastrada', () => expect(go(cfg(3), [12, 12, 12], '0')).toMatchObject({ type: 'up', suggestedWeight: 0 }));
  });
});

describe('P54 — lectura de lo antiguo y escalón (§4.1)', () => {
  const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  const rows = (reps, weight = '60') => reps.map((r) => ({ weight, reps: String(r), done: true }));

  it("`type: 'weight'` se lee como double con la meta en minReps", () => {
    const c = { sets: 3, minReps: 4, maxReps: 6, progression: { type: 'weight' } };
    expect(resolveProgressionConfig(c, null).type).toBe('double');
    expect(getProgression(c, {}, rows([4, 4, 4]), tk).type).toBe('up');
    // Como double de verdad (meta = 6), esas mismas series solo mantienen.
    expect(getProgression({ ...c, progression: { type: 'double' } }, {}, rows([4, 4, 4]), tk).type).toBe('hold');
  });
  it("`mode: 'pct'` + pctThreshold → 'part' con need = ceil(pct · series)", () => {
    const ev = (pctThreshold, sets) => resolveProgressionConfig({ sets, progression: { type: 'double', evaluation: { mode: 'pct', pctThreshold } } }, null).evaluation;
    expect(ev(0.6, 3)).toMatchObject({ mode: 'part', need: 2 });
    expect(ev(0.8, 3)).toMatchObject({ mode: 'part', need: 3 });
    expect(ev(0.7, 10)).toMatchObject({ mode: 'part', need: 7 });
  });
  it("'part' sin need → ceil((pctThreshold ?? 0,8) · series)", () => {
    const ev = (e, sets) => resolveProgressionConfig({ sets, progression: { type: 'double', evaluation: { mode: 'part', ...e } } }, null).evaluation.need;
    expect(ev({}, 5)).toBe(4);
    expect(ev({ pctThreshold: 0.6 }, 5)).toBe(3);
    expect(ev({ need: 2 }, 5)).toBe(2);
  });
  it("modos desconocidos ('custom') se leen como Todas", () => {
    expect(resolveProgressionConfig({ progression: { type: 'double', evaluation: { mode: 'custom' } } }, null).evaluation.mode).toBe('all_complete');
  });
  it("'stepped' → 'fixed' con el primer escalón; minIncrement, seed, minRir y custom se ignoran", () => {
    const r = resolveProgressionConfig({ progression: {
      type: 'double', seed: { weight: 50 }, evaluation: { minRir: 2 },
      increment: { type: 'stepped', steps: [{ untilSession: 4, value: 5 }, { value: 2.5 }], minIncrement: 2.5 },
    } }, null);
    expect(r.increment).toEqual({ type: 'fixed', value: 5, pct: 5 });
    expect(r).not.toHaveProperty('seed');
    expect(r.evaluation).toEqual({ mode: 'all_complete', need: 3, maxRpe: 8 });
  });
  it('step: el del ejercicio, si no el de la librería, si no 2,5; direction viene del def', () => {
    expect(resolveProgressionConfig({ weightStep: 1.25 }, { weightStep: 5 }).step).toBe(1.25);
    expect(resolveProgressionConfig({}, { weightStep: 5 }).step).toBe(5);
    expect(resolveProgressionConfig({ weightStep: 0 }, { weightStep: 0 }).step).toBe(2.5);
    expect(resolveProgressionConfig({}, null).step).toBe(2.5);
    expect(resolveProgressionConfig({}, { progressionDirection: 'decrease' }).direction).toBe('decrease');
  });
  it('el salto por defecto de Peso es el escalón resuelto', () => {
    expect(resolveProgressionConfig({ weightStep: 1.25, progression: { type: 'double' } }, { weightStep: 5 }).increment.value).toBe(1.25);
  });
  it('`down` ausente se queda en null (el defecto lo pone el chip); effortWhen en beat', () => {
    const r = resolveProgressionConfig({ progression: { type: 'double' } }, null);
    expect(r.down).toBeNull();
    expect(r.effortWhen).toBe('beat');
    expect(resolveProgressionConfig({ progression: { type: 'double', down: 'never', effortWhen: 'reach' } }, null)).toMatchObject({ down: 'never', effortWhen: 'reach' });
  });
});

describe('P54 — el escalón en pct y en Por esfuerzo (§4.4)', () => {
  const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  const rows = (weight, reps) => reps.map((r) => ({ weight, reps: String(r), done: true }));
  const pct = (p, extra = {}) => ({ sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double', increment: { type: 'pct', pct: p } }, ...extra });

  it('pct redondea al múltiplo del escalón más cercano', () => {
    // 5 % de 60 = 3 → 2,5 · 7 % de 100 = 7 → 7,5
    expect(getProgression(pct(5), { weightStep: 2.5 }, rows('60', [12, 12, 12]), tk).suggestedWeight).toBe(62.5);
    expect(getProgression(pct(7), { weightStep: 2.5 }, rows('100', [12, 12, 12]), tk).suggestedWeight).toBe(107.5);
  });
  it('pct nunca queda por debajo del escalón', () => {
    expect(getProgression(pct(1), { weightStep: 2.5 }, rows('60', [12, 12, 12]), tk).suggestedWeight).toBe(62.5);
    expect(getProgression(pct(1), { weightStep: 5 }, rows('60', [12, 12, 12]), tk).suggestedWeight).toBe(65);
  });
  it('el escalón del ejercicio manda sobre el de la librería', () => {
    expect(getProgression(pct(7, { weightStep: 1 }), { weightStep: 5 }, rows('100', [12, 12, 12]), tk).suggestedWeight).toBe(107);
  });
  it('en Reps y Tiempo el escalón no aplica: entero, mínimo 1', () => {
    const reps = { sets: 3, minReps: 8, progression: { type: 'reps', increment: { type: 'pct', pct: 20 } } };
    // 20 % de 11 = 2,2 → 2, no 5 (el escalón de la librería)
    expect(getProgression(reps, { weightStep: 5 }, rows('', [11, 11, 11]), tk).suggestedReps).toBe(13);
    const tiny = { ...reps, progression: { type: 'reps', increment: { type: 'pct', pct: 1 } } };
    expect(getProgression(tiny, { weightStep: 5 }, rows('', [11, 11, 11]), tk).suggestedReps).toBe(12);
  });
});

describe("P54 — Por esfuerzo: effortWhen 'reach' (§4.4)", () => {
  const tk = (k) => k;
  const cfg = (extra = {}, progression = {}) => ({ sets: 3, minReps: 5, maxReps: 5, progression: { type: 'effort', targetRpe: 8, ...progression }, ...extra });
  const at = (rpe, reps = ['5', '5', '5'], weight = '80') => reps.map((r) => ({ weight, reps: r, rpe, done: true }));

  it("'beat' (por defecto): el RPE previsto mantiene", () => {
    expect(getProgression(cfg(), { weightStep: 2.5 }, at('8'), tk)).toMatchObject({ type: 'hold', suggestedWeight: 80 });
  });
  it("'reach': el RPE previsto con todas las reps sube un escalón", () => {
    expect(getProgression(cfg({}, { effortWhen: 'reach' }), { weightStep: 2.5 }, at('8'), tk))
      .toMatchObject({ type: 'up', suggestedWeight: 82.5, effort: true, why: 'progression.why_effortReached' });
  });
  it("'reach' sube un escalón del ejercicio, no 2,5", () => {
    expect(getProgression(cfg({ weightStep: 5 }, { effortWhen: 'reach' }), { weightStep: 2.5 }, at('8'), tk).suggestedWeight).toBe(85);
  });
  it("'reach': si alguna serie no llega a las reps objetivo, mantiene", () => {
    expect(getProgression(cfg({}, { effortWhen: 'reach' }), {}, at('8', ['5', '5', '4']), tk)).toMatchObject({ type: 'hold', suggestedWeight: 80 });
  });
  it("'reach' no pisa lo que ya sube o baja", () => {
    expect(getProgression(cfg({}, { effortWhen: 'reach' }), {}, at('7'), tk)).toMatchObject({ type: 'up', why: 'progression.why_effortEasier' });
    expect(getProgression(cfg({}, { effortWhen: 'reach' }), {}, at('9'), tk)).toMatchObject({ type: 'down' });
  });
  it("'reach' sin RPE apuntado sigue pidiendo el RPE", () => {
    expect(getProgression(cfg({}, { effortWhen: 'reach' }), {}, at(''), tk)).toMatchObject({ type: 'hold', why: 'progression.why_effortNoRpe' });
  });
});

describe('P54 — Reps y Tiempo: la meta es la última + el salto (§4.4)', () => {
  const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  const reps = (evaluation, extra = {}) => ({ sets: 3, minReps: 6, maxReps: 6, progression: { type: 'reps', ...(evaluation ? { evaluation } : {}) }, ...extra });
  const timed = (evaluation) => ({ sets: 3, minTime: 30, maxTime: 30, inputType: 'time', progression: { type: 'time', ...(evaluation ? { evaluation } : {}) } });
  const r = (list, rpe = '') => list.map((x) => ({ reps: String(x), rpe, done: true }));
  const s = (list) => list.map((x) => ({ time: String(x), done: true }));

  it('sube desde la serie más floja, no desde un máximo que ya no existe', () => {
    expect(getProgression(reps(), {}, r([9, 8, 8]), tk)).toMatchObject({ type: 'up', suggestedReps: 9, from: 8 });
  });
  it('si no se cumple, la meta es el inicio y mantiene', () => {
    expect(getProgression(reps(), {}, r([8, 7, 5]), tk)).toMatchObject({ type: 'hold', suggestedReps: 6 });
  });
  it('con un rango antiguo, el suelo es el mínimo', () => {
    expect(getProgression(reps(null, { minReps: 6, maxReps: 12 }), {}, r([7, 6, 6]), tk)).toMatchObject({ type: 'up', suggestedReps: 7 });
  });
  it('Parcial: sube con las que llegaron, desde la más floja de ellas', () => {
    const c = reps({ mode: 'part', need: 2 });
    expect(getProgression(c, {}, r([9, 9, 4]), tk)).toMatchObject({ type: 'up', suggestedReps: 10, from: 9 });
    expect(getProgression(c, {}, r([9, 4, 4]), tk)).toMatchObject({ type: 'hold', suggestedReps: 6 });
  });
  it('RPE máx.: con el RPE pasado mantiene y lo dice', () => {
    const c = reps({ mode: 'rpe', maxRpe: 8 });
    expect(getProgression(c, {}, r([9, 9, 9], '7'), tk).type).toBe('up');
    expect(getProgression(c, {}, r([9, 9, 9], '9'), tk)).toMatchObject({ type: 'hold', why: 'progression.why_rpeAbove{"maxRpe":8}' });
  });
  it('Tiempo: lo mismo, redondeado a segundos', () => {
    expect(getProgression(timed(), {}, s([45, 45, 40]), tk)).toMatchObject({ type: 'up', suggestedTime: 45, from: 40 });
    expect(getProgression(timed(), {}, s([45, 25, 40]), tk)).toMatchObject({ type: 'hold', suggestedTime: 30 });
    expect(getProgression(timed({ mode: 'part', need: 2 }), {}, s([45, 25, 40]), tk)).toMatchObject({ type: 'up', suggestedTime: 45, from: 40 });
  });
});
