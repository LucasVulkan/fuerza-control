import { describe, it, test, expect } from 'vitest';
import { getProgression, resolveProgressionConfig, progressionRule, progressionHistory, isTimed, LEGACY_TYPE_MAP } from './progression';
import { EXERCISE_LIBRARY as LIB } from '../data/exerciseLibrary';

// getProgression builds an i18n message via t(); we only assert chip.type,
// which is independent of the translated text, so a no-op stub is enough.
const t = () => '';
// Un ejercicio con carga: `{}` cuenta como peso corporal y «Peso» se lee como Reps (§5.3-bis).
const BB = { equipment: ['barbell'] };

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

// ── Descarga (docs/specs/P06-stage-planner.md §6) ───────────────────────────────

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
    expect(chip.reason).not.toBe('deload');
  });

  it('resolveProgressionConfig normalizes hold to null when absent', () => {
    expect(resolveProgressionConfig({}, null).hold).toBeNull();
    expect(resolveProgressionConfig({ progression: { type: 'double', hold: 'deload' } }, null).hold).toBe('deload');
  });
});

describe('progression.type = "effort" (P10-effort-progression.md §4.2)', () => {
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
    expect(chip).toMatchObject({ type: 'hold', suggestedWeight: 80, why: 'progression.why_effortNoRpe', noRpe: true });
  });
  it('reps + recámara > 12 → mantiene el peso', () => {
    const chip = getProgression(cfg({ minReps: 10, maxReps: 10, progression: { type: 'effort', targetRpe: 7 } }), lib, at('8', '60', '10'), tk);
    expect(chip).toMatchObject({ type: 'hold', suggestedWeight: 60, why: 'progression.why_effortUnreliable', noRpe: false });
  });
  it('sin peso (peso corporal) → sin número', () => {
    const chip = getProgression(cfg(), lib, at('8', ''), tk);
    expect(chip).toMatchObject({ type: 'hold', suggestedWeight: null });
  });
  it('descarga manda: mantener', () => {
    const chip = getProgression(cfg({ progression: { type: 'effort', targetRpe: 8, hold: 'deload' } }), lib, at('6'), tk);
    expect(chip).toMatchObject({ type: 'hold', reason: 'deload', suggestedWeight: 80 });
  });
  it('redondea al escalón de la librería, como mucho 2.5; 0 o sin él → 2.5', () => {
    // RPE 7 → 82.16: con paso 1 → 82; con paso 5 → 82.5 (a 5 se comía la subida, QA P54.3); con 0 o sin él → 82.5.
    expect(getProgression(cfg(), { weightStep: 1 }, at('7'), tk).suggestedWeight).toBe(82);
    expect(getProgression(cfg(), { weightStep: 5 }, at('7'), tk).suggestedWeight).toBe(82.5);
    expect(getProgression(cfg(), { weightStep: 0 }, at('7'), tk).suggestedWeight).toBe(82.5);
    expect(getProgression(cfg(), null, at('7'), tk).suggestedWeight).toBe(82.5);
  });
  it('QA P54.3: peso muerto (escalón 5) a 60 kg, 3×4 @7 o 3×5 @8 pidiendo 4 @8 → sube a 62.5', () => {
    const dl = { sets: 3, minReps: 4, maxReps: 4, progression: { type: 'effort', targetRpe: 8 } };
    const rows = (reps, rpe) => [1, 2, 3].map(() => ({ weight: '60', reps, rpe, done: true }));
    expect(getProgression(dl, { weightStep: 5 }, rows('4', '7'), tk)).toMatchObject({ type: 'up', suggestedWeight: 62.5 });
    expect(getProgression(dl, { weightStep: 5 }, rows('5', '8'), tk)).toMatchObject({ type: 'up', suggestedWeight: 62.5 });
  });
  it('el escalón del ejercicio (exConfig.weightStep) manda sobre el de la librería, también por encima de 2.5', () => {
    expect(getProgression(cfg({ weightStep: 5 }), { weightStep: 5 }, at('7'), tk).suggestedWeight).toBe(80);
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

  describe('Reps: la meta es el total hecho + 1 por serie (P18 §4.1)', () => {
    const cfg = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'reps' } };
    // P18 §4.1: meta = total + salto × series, repartida con el sobrante en las primeras
    it('11/10/9 = 30 → meta 33 en total, 11/11/11', () => {
      const c = getProgression(cfg, BB, done([['', '11'], ['', '10'], ['', '9']]), tk);
      expect(c).toMatchObject({ type: 'up', goal: { total: 33, misses: 0 }, perSet: [11, 11, 11] });
    });
    // P18 §4.1: sin tope en el máximo de la plantilla
    it('no se atasca: 13/13/13 = 39 → meta 42, no el máximo de la plantilla + salto', () => {
      expect(getProgression(cfg, BB, done([['', '13'], ['', '13'], ['', '13']]), tk))
        .toMatchObject({ goal: { total: 42, misses: 0 }, perSet: [14, 14, 14] });
    });
    it('el salto por defecto es 1 rep, no el weightStep', () => {
      expect(resolveProgressionConfig(cfg, { weightStep: 2.5 }).increment.value).toBe(1);
    });
  });

  describe('Tiempo: la meta es el total hecho + el salto (P18 §4.1)', () => {
    const cfg = { sets: 3, minTime: 20, maxTime: 40, inputType: 'time', progression: { type: 'time' } };
    // P18 §4.1: Tiempo, salto por defecto 5 s por serie; 3×45 = 135 → 150
    it('45 s ×3 con objetivo 20–40 → meta 150 s en total, 50 s por serie, nunca menos de lo hecho', () => {
      const c = getProgression(cfg, BB, done([['', '', '45'], ['', '', '45'], ['', '', '45']]), tk);
      expect(c).toMatchObject({ type: 'up', timed: true, goal: { total: 150, misses: 0 }, perSet: [50, 50, 50] });
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
      expect(getProgression(cfg(0.6), BB, sets2of3, tk).suggestedWeight).toBe(62.5);
    });
    it('2 de 3 al máximo con umbral 80 % → mantener', () => {
      expect(getProgression(cfg(0.8), BB, sets2of3, tk).type).toBe('hold');
    });
    it('«Todas ✓» sigue pidiendo todas', () => {
      const all = { ...cfg(0.6), progression: { type: 'double' } };
      expect(getProgression(all, BB, sets2of3, tk).type).toBe('hold');
    });
  });
});

describe('QA P52 — los textos dicen lo que pasó', () => {
  const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  const done = (rows) => rows.map(([weight, reps]) => ({ weight, reps, done: true }));
  it('«% mínimo» que sube sin todas al máximo: el motivo cuenta las que llegaron', () => {
    const cfg = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double', evaluation: { mode: 'pct', pctThreshold: 0.6 } } };
    const c = getProgression(cfg, BB, done([['60', '12'], ['60', '12'], ['60', '9']]), tk);
    // P18 §3.1/§6: la mayoría simple de 3 son 2 series; el motivo dice la meta para volver a subir
    expect(c).toMatchObject({ type: 'up', suggestedWeight: 62.5 });
    expect(c.why).toContain('seriesPart{\\"need\\":2,\\"count\\":3}');
  });
  it('todas al máximo: el motivo de siempre', () => {
    const cfg = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double' } };
    const c = getProgression(cfg, BB, done([['60', '12'], ['60', '12'], ['60', '12']]), tk);
    expect(c.why).toContain('seriesAll{\\"count\\":3}');
    expect(c.why).toContain('toUpAgain');
  });
  it('asistido: el chip va marcado para que la tarjeta no diga «Subir»', () => {
    const c = getProgression({ sets: 3, minReps: 6, maxReps: 10, progression: { type: 'double' } },
      { progressionDirection: 'decrease', weightStep: 2.5 }, done([['20', '10'], ['20', '10'], ['20', '10']]), tk);
    expect(c.assist).toBe(true);
    expect(c.suggestedWeight).toBe(17.5);
  });
});

describe('QA P52 — Reps y Tiempo llevan número, también al mantener (P18 §4.1)', () => {
  const done = (rows) => rows.map(([reps, time]) => ({ reps, time, done: true }));
  it('Reps sube: la meta, lo que se hizo y el motivo', () => {
    const c = getProgression({ sets: 3, minReps: 6, maxReps: 12, progression: { type: 'reps' } }, BB, done([['9'], ['8'], ['8']]), t);
    expect([c.type, c.goal.total, c.perSet, c.lastTotal, c.reason]).toEqual(['up', 28, [10, 9, 9], 25, 'first']);
  });
  it('Reps mantiene con la meta fija: 28 de meta, hace 26 (antes 25) → sigue 28', () => {
    const c = getProgression({ sets: 3, minReps: 6, maxReps: 12, progression: { type: 'reps' } }, BB, done([['9'], ['9'], ['8']]), t,
      { earlier: [done([['9'], ['8'], ['8']])], lastGoal: { total: 28, misses: 0 } });
    expect([c.type, c.goal.total, c.perSet, c.lastTotal]).toEqual(['hold', 28, [10, 9, 9], 26]);
  });
  it('Tiempo mantiene con la meta fija: 100 s de meta, hace 90 (antes 85) → sigue 100', () => {
    const c = getProgression({ sets: 3, minTime: 30, maxTime: 60, inputType: 'time', progression: { type: 'time' } }, BB, done([['', '30'], ['', '30'], ['', '30']]), t,
      { earlier: [done([['', '30'], ['', '30'], ['', '25']])], lastGoal: { total: 100, misses: 0 } });
    expect([c.type, c.goal.total, c.perSet, c.lastTotal]).toEqual(['hold', 100, [34, 33, 33], 90]);
  });
});

// ── P54 — el modelo nuevo (docs/specs/P12-progresion-clara.md §4) ───────────────

describe('P54 — «Peso · por reglas» (§4.2)', () => {
  const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  // n series con 60 kg y esas reps (y RPE si se da).
  const run = (cfg, reps, rpe = '') => getProgression(
    cfg, BB, reps.map((r) => ({ weight: '60', reps: String(r), rpe, done: true })), tk,
  );
  const cfg = (n, evaluation, extra = {}) => ({
    sets: n, minReps: 8, maxReps: 12,
    progression: { type: 'double', ...(evaluation ? { evaluation } : {}), ...extra },
  });

  describe('Todas, con 3 series', () => {
    const c = cfg(3);
    it('sube con todas a la meta', () => {
      const chip = run(c, [12, 12, 12]);
      expect(chip).toMatchObject({ type: 'up', suggestedWeight: 62.5 });
      expect(chip.why).toContain('seriesAll{\\"count\\":3}');
    });
    it('mantiene con todas en el rango', () => expect(run(c, [12, 10, 9])).toMatchObject({ type: 'hold', suggestedWeight: 60 }));
    it('mantiene con una sola bajo el suelo', () => expect(run(c, [12, 12, 7]).type).toBe('hold'));
    // P18 §3.3: 2 de 3 bajo el suelo ya no baja por sí solo: faltan 2 de 24 reps (8 %) = fallo leve, el primero
    it('con 2 de 3 bajo el suelo por poco mantiene (fallo leve)', () => expect(run(c, [9, 7, 7])).toMatchObject({ type: 'hold', suggestedWeight: 60, reason: 'fail' }));
    it('baja con un fallo grande (faltan 6 de 24 = 25 %): −10 % al escalón', () => expect(run(c, [9, 5, 5])).toMatchObject({ type: 'down', suggestedWeight: 55, reason: 'bigFail' }));
  });

  describe('Todas, con 5 series', () => {
    const c = cfg(5);
    it('sube con todas', () => expect(run(c, [12, 12, 12, 12, 12]).type).toBe('up'));
    it('mantiene con 2 bajo el suelo', () => expect(run(c, [12, 12, 12, 7, 7]).type).toBe('hold'));
    it('3 bajo el suelo por poco mantiene (faltan 3 de 40)', () => expect(run(c, [12, 12, 7, 7, 7]).type).toBe('hold'));
    it('baja con un fallo grande (faltan 9 de 40 = 22 %)', () => expect(run(c, [12, 12, 5, 5, 5]).type).toBe('down'));
  });

  describe('Parcial', () => {
    it('3 series, 2 de 3: sube con 2 a la meta y el motivo cuenta', () => {
      const chip = run(cfg(3, { mode: 'part', need: 2 }), [12, 12, 9]);
      expect(chip).toMatchObject({ type: 'up', suggestedWeight: 62.5 });
      expect(chip.why).toContain('seriesPart{\\"need\\":2,\\"count\\":3}');
      expect(chip.why).toMatch(/extraRange.*reps.*count.*8/);
    });
    it('3 series, 2 de 3: con 1 a la meta mantiene', () => {
      expect(run(cfg(3, { mode: 'part', need: 2 }), [12, 9, 9]).type).toBe('hold');
    });
    it('3 series, 2 de 3: con 2 bajo el suelo por poco mantiene; con un fallo grande baja', () => {
      expect(run(cfg(3, { mode: 'part', need: 2 }), [12, 7, 7]).type).toBe('hold');
      expect(run(cfg(3, { mode: 'part', need: 2 }), [12, 5, 5]).type).toBe('down');
    });
    it('con todas a la meta el motivo sigue diciendo la regla de la mayoría (§6: «como arriba»)', () => {
      const chip = run(cfg(3, { mode: 'part', need: 2 }), [12, 12, 12]);
      expect(chip.type).toBe('up');
      expect(chip.why).toContain('seriesPart{\\"need\\":2,\\"count\\":3}');
    });
    it('5 series, 3 de 5', () => {
      const c = cfg(5, { mode: 'part', need: 3 });
      expect(run(c, [12, 12, 12, 9, 9]).type).toBe('up');
      expect(run(c, [12, 12, 9, 9, 9]).type).toBe('hold');
      expect(run(c, [12, 12, 5, 5, 5]).type).toBe('down');
    });
    it('`need` se recorta a las series de la sesión', () => {
      expect(run(cfg(2, { mode: 'part', need: 5 }), [12, 12]).type).toBe('up');
    });
  });

  describe('RPE máx.', () => {
    const c = (n = 3) => cfg(n, { mode: 'rpe', maxRpe: 8 });
    it('todas a la meta con RPE medio ≤ máx → sube', () => expect(run(c(), [12, 12, 12], '7.5').type).toBe('up'));
    it('todas a la meta con RPE medio > máx → mantiene, y dice por qué', () => {
      expect(run(c(), [12, 12, 12], '8.5')).toMatchObject({ type: 'hold', suggestedWeight: 60, reason: 'rpe', why: 'progression.next.rpeOver{"rpe":8.5,"max":8}' });
    });
    it('sin RPE apuntado → como Todas', () => expect(run(c(), [12, 12, 12], '').type).toBe('up'));
    it('series malas con RPE 10 → no baja por RPE: mantiene', () => expect(run(c(), [12, 10, 9], '10').type).toBe('hold'));
    it('fallo grande con RPE 10 → baja por la regla, no por el RPE; fallo leve con RPE 10 → mantiene', () => {
      expect(run(c(), [9, 5, 5], '10').type).toBe('down');
      expect(run(c(), [9, 7, 7], '10').type).toBe('hold');
    });
    it('5 series', () => {
      expect(run(c(5), [12, 12, 12, 12, 12], '7').type).toBe('up');
      expect(run(c(5), [12, 12, 12, 12, 11], '7').type).toBe('hold');
    });
  });

  describe('Cuándo baja', () => {
    it('P18 §3.3: baja el tamaño del fallo, no cuántas series fallan: leve mantiene y grande baja, con 3, 4 y 5 series', () => {
      for (const n of [3, 4, 5]) {
        const bad = (reps) => [...Array(n - 2).fill(12), reps, reps];
        expect(run(cfg(n), bad(7)).type, `${n} series, leve`).toBe('hold');   // faltan 2 de 8n
        expect(run(cfg(n), bad(2)).type, `${n} series, grande`).toBe('down'); // faltan 12 de 8n
      }
    });
    it("'never' no baja nunca", () => {
      expect(run(cfg(3, undefined, { down: 'never' }), [7, 7, 7]).type).toBe('hold');
    });
    it('P18 §3.3: un `{ fails }` antiguo se ignora (baja por el tamaño del fallo)', () => {
      expect(run(cfg(3, undefined, { down: { fails: 1 } }), [12, 12, 7]).type).toBe('hold');
      expect(run(cfg(3, undefined, { down: { fails: 9 } }), [12, 5, 5]).type).toBe('down');
      expect(run(cfg(3, undefined, { down: { fails: 0 } }), [12, 12, 7]).type).toBe('hold');
    });
    it('sin peso no hay nada que bajar', () => {
      const c = getProgression(cfg(3), BB, [7, 7, 7].map((r) => ({ weight: '', reps: String(r), done: true })), tk);
      expect(c.type).toBe('hold');
    });
  });

  describe('Asistidas: el espejo', () => {
    const assisted = { progressionDirection: 'decrease', weightStep: 2.5 };
    const go = (c, reps, w = '20', rpe = '') => getProgression(c, assisted, reps.map((r) => ({ weight: w, reps: String(r), rpe, done: true })), tk);
    it('todas a la meta → menos ayuda', () => expect(go(cfg(3), [12, 12, 12])).toMatchObject({ type: 'up', suggestedWeight: 17.5, assist: true }));
    it('Parcial: 2 de 3 → menos ayuda, con el motivo', () => {
      const chip = go(cfg(3, { mode: 'part', need: 2 }), [12, 12, 9]);
      expect(chip).toMatchObject({ type: 'up', suggestedWeight: 17.5 });
      expect(chip.why).toContain('seriesPart{\\"need\\":2,\\"count\\":3}');
      expect(chip.why).toContain('toAssist');
    });
    it('RPE máx.: la puerta también aplica', () => {
      expect(go(cfg(3, { mode: 'rpe', maxRpe: 8 }), [12, 12, 12], '20', '9')).toMatchObject({ type: 'hold', reason: 'rpe', why: 'progression.next.rpeOver{"rpe":9,"max":8}' });
    });
    it('fallo grande → más ayuda (20 → 22,5); leve → mantiene', () => {
      expect(go(cfg(3), [9, 5, 5])).toMatchObject({ type: 'down', suggestedWeight: 22.5 });
      expect(go(cfg(3), [9, 7, 7]).type).toBe('hold');
    });
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
    expect(getProgression(c, BB, rows([4, 4, 4]), tk).type).toBe('up');
    // Como double de verdad (meta = 6), esas mismas series solo mantienen.
    expect(getProgression({ ...c, progression: { type: 'double' } }, BB, rows([4, 4, 4]), tk).type).toBe('hold');
  });
  it("`mode: 'pct'` + pctThreshold → 'part' con need = ceil(pct · series)", () => {
    const ev = (pctThreshold, sets) => resolveProgressionConfig({ sets, progression: { type: 'double', evaluation: { mode: 'pct', pctThreshold } } }, null).evaluation;
    expect(ev(0.6, 3)).toMatchObject({ mode: 'part', need: 2 });
    expect(ev(0.8, 3)).toMatchObject({ mode: 'part', need: 3 });
    expect(ev(0.7, 10)).toMatchObject({ mode: 'part', need: 7 });
  });
  it("'part' sin need → la mayoría simple ⌊n/2⌋+1 (P18 §3.1); un pctThreshold guardado se respeta", () => {
    const ev = (e, sets) => resolveProgressionConfig({ sets, progression: { type: 'double', evaluation: { mode: 'part', ...e } } }, null).evaluation.need;
    expect([ev({}, 3), ev({}, 4), ev({}, 5)]).toEqual([2, 3, 3]);
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
    expect(r.evaluation).toEqual({ mode: 'all_complete', need: 2, maxRpe: 8 });
  });
  it('step: el del ejercicio, si no el de la librería, si no 2,5; direction viene del def', () => {
    expect(resolveProgressionConfig({ weightStep: 1.25 }, { weightStep: 5 }).step).toBe(1.25);
    expect(resolveProgressionConfig({}, { weightStep: 5 }).step).toBe(5);
    expect(resolveProgressionConfig({ weightStep: 0 }, { weightStep: 0 }).step).toBe(2.5);
    expect(resolveProgressionConfig({}, null).step).toBe(2.5);
    expect(resolveProgressionConfig({}, { progressionDirection: 'decrease' }).direction).toBe('decrease');
  });
  it('P65: def.progression es el valor por defecto: exConfig.progression > def.progression > campos viejos', () => {
    const def = { progressionModel: 'time_progression', weightStep: 5, progression: { type: 'effort', targetRpe: 9, effortWhen: 'reach' } };
    // Sin progresión en la plantilla, manda la del def (por encima de progressionModel).
    expect(resolveProgressionConfig({}, def)).toMatchObject({ type: 'effort', targetRpe: 9, effortWhen: 'reach', step: 2.5 });
    // Con la suya, la de la plantilla.
    expect(resolveProgressionConfig({ progression: { type: 'reps' } }, def).type).toBe('reps');
    // Un `hold` suelto de una etapa (sin type) no tapa la del def.
    expect(resolveProgressionConfig({ progression: { hold: 'deload' } }, def).type).toBe('effort');
    // Exacto del def solo cuenta si la progresión viene del def.
    const exactDef = { weightStep: 'exact', progression: { type: 'effort' } };
    expect(resolveProgressionConfig({}, exactDef).exact).toBe(true);
    expect(resolveProgressionConfig({ weightStep: null, progression: { type: 'effort' } }, exactDef).exact).toBe(false);
    // Sin progression en el def, los campos viejos como siempre.
    expect(resolveProgressionConfig({}, { progressionModel: 'time_progression' }).type).toBe('time');
  });
  it('P65: la medida sale de def.inputType si la plantilla no la trae', () => {
    expect(isTimed({}, { inputType: 'weight_time', progressionModel: 'double_progression' })).toBe(true);
    expect(isTimed({ inputType: 'weight_reps' }, { inputType: 'weight_time' })).toBe(false);
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
  it('en Reps y Tiempo el escalón no aplica: salto entero por serie, mínimo 1', () => {
    const reps = { sets: 3, minReps: 8, progression: { type: 'reps', increment: { type: 'pct', pct: 20 } } };
    // 20 % de 11 = 2,2 → 2 por serie, no 5 (el escalón de la librería): 33 + 3×2 = 39
    expect(getProgression(reps, { weightStep: 5 }, rows('', [11, 11, 11]), tk).goal.total).toBe(39);
    const tiny = { ...reps, progression: { type: 'reps', increment: { type: 'pct', pct: 1 } } };
    // 1 % → 0,11 → mínimo 1 por serie: 33 + 3 = 36
    expect(getProgression(tiny, { weightStep: 5 }, rows('', [11, 11, 11]), tk).goal.total).toBe(36);
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
    expect(getProgression(cfg({}, { effortWhen: 'reach' }), BB, at('8', ['5', '5', '4']), tk)).toMatchObject({ type: 'hold', suggestedWeight: 80 });
  });
  it("'reach' no pisa lo que ya sube o baja", () => {
    expect(getProgression(cfg({}, { effortWhen: 'reach' }), BB, at('7'), tk)).toMatchObject({ type: 'up', why: 'progression.why_effortEasier' });
    expect(getProgression(cfg({}, { effortWhen: 'reach' }), BB, at('9'), tk)).toMatchObject({ type: 'down' });
  });
  it("'reach' sin RPE apuntado sigue pidiendo el RPE", () => {
    expect(getProgression(cfg({}, { effortWhen: 'reach' }), BB, at(''), tk)).toMatchObject({ type: 'hold', why: 'progression.why_effortNoRpe' });
  });
});

describe('P55 — lo típico del peso corporal solo decide el valor por defecto (§5.3-bis, QA P55.5)', () => {
  it('sin progresión guardada, un Doble de la librería sin lastre se lee como Reps; con lastre, no', () => {
    expect(resolveProgressionConfig({}, LIB.pull_up_supine).type).toBe('reps');
    expect(resolveProgressionConfig({}, LIB.pull_up_supine).increment.value).toBe(1);
    expect(resolveProgressionConfig({}, LIB.pull_up).type).toBe('double');
    expect(resolveProgressionConfig({}, null).type).toBe('double');
  });
  it('Peso elegido en la hoja se respeta, también sin lastre en la librería', () => {
    expect(resolveProgressionConfig({ progression: { type: 'double' } }, LIB.pull_up_supine).type).toBe('double');
  });
  it('los asistidos no cambian: Doble con decrease', () => {
    expect(resolveProgressionConfig({}, LIB.pull_up_assisted)).toMatchObject({ type: 'double', direction: 'decrease' });
  });
});

describe('P55 — Por esfuerzo: e1rm, raw y Exacto (§5.4-bis)', () => {
  const tk = (k) => k;
  const cfg = (extra = {}, progression = {}) => ({ sets: 3, minReps: 4, maxReps: 4, progression: { type: 'effort', targetRpe: 8, ...progression }, ...extra });
  const at = (rpe, weight = '60') => ['4', '4', '4'].map((r) => ({ weight, reps: r, rpe, done: true }));

  it('el chip trae el 1RM de la sesión y el peso sin redondear', () => {
    const c = getProgression(cfg(), { weightStep: 2.5 }, at('7'), tk);
    expect(c.e1rm).toBeCloseTo(74, 5);
    expect(c.raw).toBeCloseTo(74 / (1 + 6 / 30), 5);
  });
  it('sin cálculo (sin RPE, descarga) e1rm y raw son null', () => {
    expect(getProgression(cfg(), {}, at(''), tk)).toMatchObject({ e1rm: null, raw: null });
  });
  it('Exacto redondea a 0,1 donde el escalón da 62.5', () => {
    expect(getProgression(cfg(), { weightStep: 2.5 }, at('7'), tk).suggestedWeight).toBe(62.5);
    expect(getProgression(cfg({ weightStep: 'exact' }), { weightStep: 2.5 }, at('7'), tk).suggestedWeight).toBe(61.7);
  });
  it("Exacto ignora 'Al llegar' (el peso se mueve con cualquier cambio)", () => {
    const c = cfg({ weightStep: 'exact' }, { effortWhen: 'reach' });
    expect(getProgression(c, { weightStep: 2.5 }, at('7'), tk).why).not.toBe('progression.why_effortReached');
  });
  it('resolveProgressionConfig: step siempre numérico y exact solo en Por esfuerzo', () => {
    const eff = resolveProgressionConfig({ weightStep: 'exact', progression: { type: 'effort' } }, { weightStep: 5 });
    expect(eff).toMatchObject({ exact: true, step: 2.5 });
    const rules = resolveProgressionConfig({ weightStep: 'exact', progression: { type: 'double' } }, { weightStep: 5 });
    expect(rules).toMatchObject({ exact: false, step: 5 });
  });
});

describe('P55 — progressionRule (§5.2)', () => {
  const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  const bench = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double', increment: { type: 'fixed', value: 2.5 } } };

  it('Peso: con la cola de bajar por defecto (P18: sin números, la regla va en la clave)', () => {
    expect(progressionRule(bench, BB, tk)).toBe(
      'progression.rule.weightUp{"inc":"2.5 kg","when":"progression.rule.whenAll","goal":12}progression.rule.weightDown');
  });
  it("Con down: 'never' sin la cola", () => {
    expect(progressionRule({ ...bench, progression: { ...bench.progression, down: 'never' } }, BB, tk))
      .toBe('progression.rule.weightUp{"inc":"2.5 kg","when":"progression.rule.whenAll","goal":12}');
  });
  it('Parcial, RPE y porcentaje; la unidad es la que se pasa', () => {
    const part = { ...bench, progression: { ...bench.progression, evaluation: { mode: 'part', need: 2 }, down: 'never' } };
    expect(progressionRule(part, BB, tk)).toContain('whenPart{\\"need\\":2,\\"n\\":3}');
    const rpe = { ...bench, progression: { ...bench.progression, evaluation: { mode: 'rpe', maxRpe: 8 }, down: 'never' } };
    expect(progressionRule(rpe, BB, tk)).toContain('progression.rule.whenRpe');
    const pct = { ...bench, progression: { type: 'double', down: 'never', increment: { type: 'pct', pct: 5 } } };
    expect(progressionRule(pct, BB, tk, 'lb')).toContain('"inc":"5 %"');
    expect(progressionRule(bench, BB, tk, 'lb')).toContain('"inc":"2.5 lb"');
  });
  it('short (QA P64): una línea, sin el «cuándo» ni la cola de bajar', () => {
    const s = { short: true };
    expect(progressionRule(bench, BB, tk, 'kg', s)).toBe(
      'progression.rule.weightShort{"inc":"2.5 kg","goal":"progression.rule.incReps{\\"count\\":12}"}');
    expect(progressionRule({ sets: 3 }, LIB.pull_up_assisted, tk, 'kg', s)).toMatch(/^progression\.rule\.assistShort/);
    expect(progressionRule({ ...bench, progression: { type: 'none' } }, BB, tk, 'kg', s)).toBe('');
  });
  it('Asistido: «quita» y «más ayuda»', () => {
    expect(progressionRule({ sets: 3 }, LIB.pull_up_assisted, tk)).toMatch(/^progression\.rule\.assistUp.*assistDown/);
  });
  it('Reps y Tiempo, Por esfuerzo y Nada', () => {
    // P18 §4.1: «Tu total + el salto por serie»; sin mínimos ni «cuando todas»
    expect(progressionRule({ sets: 3, minReps: 6, maxReps: 6, progression: { type: 'reps' } }, BB, tk))
      .toBe('progression.rule.totalUp{"inc":"progression.rule.incReps{\\"count\\":1}"}');
    expect(progressionRule({ sets: 3, minTime: 30, maxTime: 30, progression: { type: 'time' } }, BB, tk))
      .toBe('progression.rule.totalUp{"inc":"5 s"}');
    expect(progressionRule({ sets: 3, minReps: 5, maxReps: 5, progression: { type: 'effort', targetRpe: 8 } }, BB, tk))
      .toBe('progression.rule.effortBeat{"reps":5,"rpe":8}');
    expect(progressionRule({ progression: { type: 'effort', effortWhen: 'reach' }, minReps: 5 }, BB, tk)).toContain('effortReach');
    expect(progressionRule({ progression: { type: 'none' } }, BB, tk)).toBe('progression.rule.none');
  });
});

describe('P56 — Por esfuerzo: el 1RM de las tres últimas sesiones (§6.5)', () => {
  const tk = (k) => k;
  const cfg = { sets: 3, minReps: 5, maxReps: 5, progression: { type: 'effort', targetRpe: 8 } };
  const lib = { weightStep: 2.5 };
  // 5 reps @8 = 7RM: 60 kg → 1RM 74; 57 → 70.3; 63 → 77.7 (su media es 74).
  const ses = (w, rpe = '8') => [1, 2, 3].map(() => ({ weight: String(w), reps: '5', rpe, done: true }));
  const ONE_RM = 1 + 7 / 30;

  it('con tres sesiones el 1RM es la media de las tres', () => {
    const c = getProgression(cfg, lib, ses(60), tk, { earlier: [ses(57), ses(63)] });
    expect(c.e1rm).toBeCloseTo(74, 5);
    expect(c.e1rmSessions).toBe(3);
    // El peso de partida sigue siendo el de la última sesión.
    expect(c.suggestedWeight).toBe(60);
  });
  it('solo cuenta la última y las dos anteriores', () => {
    const c = getProgression(cfg, lib, ses(60), tk, { earlier: [ses(57), ses(63), ses(100)] });
    expect(c.e1rm).toBeCloseTo(74, 5);
    expect(c.e1rmSessions).toBe(3);
  });
  it('una sesión anterior sin RPE no cuenta', () => {
    const c = getProgression(cfg, lib, ses(60), tk, { earlier: [ses(50, ''), ses(63)] });
    expect(c.e1rm).toBeCloseTo((60 + 63) / 2 * ONE_RM, 5);
    expect(c.e1rmSessions).toBe(2);
  });
  it('con una sola sesión, la de hoy', () => {
    const c = getProgression(cfg, lib, ses(60), tk);
    expect(c.e1rm).toBeCloseTo(60 * ONE_RM, 5);
    expect(c.e1rmSessions).toBe(1);
  });
  it('la última sin RPE sigue pidiendo el RPE, aunque haya anteriores con él', () => {
    const c = getProgression(cfg, lib, ses(60, ''), tk, { earlier: [ses(57), ses(63)] });
    expect(c).toMatchObject({ type: 'hold', suggestedWeight: 60, why: 'progression.why_effortNoRpe', e1rm: null });
  });
  it('última de descarga con RPE: el 1RM sale de las anteriores, sin pedir el RPE', () => {
    const c = getProgression(cfg, lib, ses(40), tk, { earlier: [ses(60), ses(63)], lastDeload: true });
    expect(c.why).not.toBe('progression.why_effortNoRpe');
    expect(c.e1rm).toBeCloseTo((60 + 63) / 2 * ONE_RM, 5);
    expect(c.e1rmSessions).toBe(2);
    // El peso de partida (flecha y delta) sigue siendo el de la última.
    expect(c.suggestedWeight).not.toBeNull();
  });
  it('última de descarga y ninguna anterior válida: why_effortNoRpe', () => {
    const c = getProgression(cfg, lib, ses(40), tk, { earlier: [], lastDeload: true });
    expect(c).toMatchObject({ type: 'hold', suggestedWeight: 40, why: 'progression.why_effortNoRpe', e1rm: null });
  });
  it('Por reglas ignora las opciones', () => {
    const rules = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double' } };
    const sets = [1, 2, 3].map(() => ({ weight: '60', reps: '12', done: true }));
    expect(getProgression(rules, BB, sets, tk, { earlier: [ses(57)], lastDeload: true }))
      .toEqual(getProgression(rules, BB, sets, tk));
  });
  it('progressionHistory: earlier sin las de descarga y lastDeload de la primera', () => {
    const a = { sets: ['a'], deload: true }, b = { sets: ['b'] }, c = { sets: ['c'], deload: true }, d = { sets: ['d'] };
    expect(progressionHistory([a, b, c, d])).toEqual({ earlier: [['b'], ['d']], lastDeload: true, lastGoal: null });
    expect(progressionHistory([b])).toEqual({ earlier: [], lastDeload: false, lastGoal: null });
    expect(progressionHistory([])).toEqual({ earlier: [], lastDeload: false, lastGoal: null });
    // P18 §4.2: el goal guardado en la última sesión viaja como lastGoal
    expect(progressionHistory([{ sets: ['a'], goal: { total: 34, misses: 1 } }, b]).lastGoal).toEqual({ total: 34, misses: 1 });
  });
});

// ── P61 — Tiempo con carga (docs/specs/P12-progresion-clara.md §8) ──────────────

describe('P61 — Tiempo + Peso: doble progresión en segundos (§8.2)', () => {
  const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  // Plancha 30–60 s con 5 kg: cada serie es [kg, segundos].
  const plank = (progression = {}, extra = {}) => ({
    sets: 3, minTime: 30, maxTime: 60, inputType: 'weight_time', progression: { type: 'double', ...progression }, ...extra,
  });
  const run = (cfg, secs, kg = '5', def = BB) => getProgression(
    cfg, def, secs.map((s) => ({ weight: kg, time: String(s), done: true })), tk,
  );

  it('todas al máximo: sube el peso (+2,5) y no dice nada de reps', () => {
    expect(run(plank(), [60, 60, 60])).toMatchObject({
      type: 'up', suggestedWeight: 7.5, suggestedTime: null,
    });
    // la meta se dice en segundos, no en reps
    expect(run(plank(), [60, 60, 60]).why).toContain('"goal":"60 s"');
  });
  it('una serie por debajo del máximo mantiene el peso', () => {
    expect(run(plank(), [60, 60, 50])).toMatchObject({ type: 'hold', suggestedWeight: 5, reason: 'range' });
  });
  it('tiempo fijo 45–45: 45/45/45 sube; 45/40/45 mantiene', () => {
    const c = plank({}, { minTime: 45, maxTime: 45 });
    expect(run(c, [45, 45, 45]).type).toBe('up');
    expect(run(c, [45, 40, 45])).toMatchObject({ type: 'hold', suggestedWeight: 5 });
  });
  it('baja con la regla: fallo grande de tiempo (faltan 20 s de 90) → −10 % al escalón, mínimo un escalón', () => {
    expect(run(plank(), [60, 20, 20])).toMatchObject({ type: 'down', suggestedWeight: 2.5, reason: 'bigFail' });
    // fallo leve (faltan 10 s de 90 = 11 %): mantiene
    expect(run(plank(), [60, 45, 20]).type).toBe('hold');
    expect(run(plank({ down: 'never' }), [20, 20, 20]).type).toBe('hold');
    // `{ fails }` antiguo se ignora (P18 §3.3)
    expect(run(plank({ down: { fails: 3 } }), [60, 20, 20]).type).toBe('down');
  });
  it('Parcial: 2 de 3 al máximo sube, y el motivo habla de segundos', () => {
    expect(run(plank({ evaluation: { mode: 'part', need: 2 } }), [60, 60, 40])).toMatchObject({
      type: 'up', suggestedWeight: 7.5,
    });
    expect(run(plank({ evaluation: { mode: 'part', need: 2 } }), [60, 60, 40]).why).toContain('"goal":"60 s"');
  });
  it('RPE máx.: con el RPE pasado mantiene', () => {
    const c = plank({ evaluation: { mode: 'rpe', maxRpe: 8 } });
    const go = (rpe) => getProgression(c, BB, [60, 60, 60].map((s) => ({ weight: '5', time: String(s), rpe, done: true })), tk);
    expect(go('7').type).toBe('up');
    expect(go('9')).toMatchObject({ type: 'hold', reason: 'rpe' });
  });
  it('porcentaje: redondea al escalón', () => {
    const c = plank({ increment: { type: 'pct', pct: 10 } });
    expect(run(c, [60, 60, 60], '40').suggestedWeight).toBe(45);
  });
  it('asistido (dominada asistida a tiempo): quita ayuda al llegar al máximo y pone ayuda si falla', () => {
    const assisted = { progressionDirection: 'decrease', weightStep: 2.5 };
    expect(run(plank(), [60, 60, 60], '20', assisted)).toMatchObject({ type: 'up', assist: true, suggestedWeight: 17.5 });
    expect(run(plank(), [20, 20, 60], '20', assisted)).toMatchObject({ type: 'down', assist: true, suggestedWeight: 22.5 });
  });
  it('sin peso apuntado y todas al máximo, sube desde 0 (como en reps)', () => {
    expect(run(plank(), [60, 60, 60], '').type).toBe('up');
  });
  it('el mismo ejercicio con medida Reps sigue evaluando reps', () => {
    const reps = { sets: 3, minReps: 8, maxReps: 12, inputType: 'weight_reps', progression: { type: 'double' } };
    expect(getProgression(reps, BB, [12, 12, 12].map((r) => ({ weight: '60', reps: String(r), done: true })), tk))
      .toMatchObject({ type: 'up', reason: 'up' });
  });
  it('Tiempo + Tiempo: pide segundos en total y no propone kilos', () => {
    const c = { sets: 3, minTime: 30, maxTime: 30, inputType: 'weight_time', progression: { type: 'time' } };
    // P18 §4.1: 130 s + 5 s × 3 = 145 s en total, repartido 49/48/48
    expect(run(c, [45, 45, 40])).toMatchObject({ type: 'up', goal: { total: 145, misses: 0 }, perSet: [49, 48, 48], suggestedWeight: null });
  });
  it('sin inputType, el modelo de tiempo de la librería también cuenta como Tiempo', () => {
    const c = { sets: 3, minTime: 30, maxTime: 60, progression: { type: 'double' } };
    expect(run(c, [60, 60, 60], '5', { progressionModel: 'time_progression' }).type).toBe('up');
    expect(run(c, [40, 40, 40], '5', { progressionModel: 'time_progression' }).type).toBe('hold');
  });
  it('progressionRule: «Sube 2.5 kg cuando todas las series lleguen a 60 s» + la cola de bajar sin números', () => {
    expect(progressionRule(plank({ increment: { type: 'fixed', value: 2.5 } }), BB, tk)).toBe(
      'progression.rule.weightUp{"inc":"2.5 kg","when":"progression.rule.whenAll","goal":"60 s"}progression.rule.weightDown');
  });
});

describe('P61 — la frase de la regla en palabras (es y en)', async () => {
  const { default: i18n } = await import('i18next');
  const es = (await import('../locales/es.json')).default;
  const en = (await import('../locales/en.json')).default;
  const cfg = { sets: 3, minTime: 30, maxTime: 60, inputType: 'weight_time', progression: { type: 'double', increment: { type: 'fixed', value: 2.5 } } };
  const tIn = (lng, res) => {
    const inst = i18n.createInstance();
    inst.init({ lng, resources: { [lng]: { translation: res } }, interpolation: { escapeValue: false } });
    return inst.t.bind(inst);
  };
  it('es', () => {
    expect(progressionRule(cfg, BB, tIn('es', es))).toBe('Sube 2.5 kg cuando todas las series lleguen a 60 s · baja un 10 % si fallas por mucho o dos días seguidos');
  });
  it('en', () => {
    expect(progressionRule(cfg, BB, tIn('en', en))).toBe('Adds 2.5 kg when all sets reach 60 s · drops 10 % if you miss by a lot or two days in a row');
  });
  it('en piezas, para la ficha del Workout (U10-04)', () => {
    const t = tIn('es', es);
    const bench = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double', increment: { type: 'fixed', value: 2.5 } } };
    expect(progressionRule(bench, BB, t, 'kg', { parts: true })).toEqual({
      action: 'Sube 2.5 kg', when: 'cuando todas las series lleguen a 12 reps', down: 'Baja un 10 % si fallas por mucho o dos días seguidos',
    });
    expect(progressionRule({ ...bench, progression: { ...bench.progression, down: 'never' } }, BB, t, 'kg', { parts: true }).down).toBeNull();
    expect(progressionRule({ sets: 3, minReps: 6, progression: { type: 'reps' } }, BB, t, 'kg', { parts: true })).toEqual({
      action: 'Tu total + 1 rep por serie',
      when: 'Se queda fija hasta que la alcances; si dos días seguidos haces menos, se ajusta a lo que hiciste',
    });
    expect(progressionRule({ progression: { type: 'none' } }, BB, t, 'kg', { parts: true })).toEqual({ action: 'Sin sugerencia de progreso' }); // P18 §7: la regla de Nada
  });
});

describe('I01-01 — huecos de mutación', () => {
  const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
  const cfg3 = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double' } };
  const rows = (n, row) => Array.from({ length: n }, () => ({ ...row }));

  // P12 §4.2: «alMeta = series con reps ≥ G (o marcadas sin reps)»
  // mata progression.js:247:12, 247:13, 245:24, 245:9 (series ✓ sin reps) y 498:43 (el filtro de doneSets)
  test('series marcadas ✓ sin reps cuentan como alcanzadas: sube', () => {
    expect(getProgression(cfg3, BB, rows(3, { weight: '60', reps: '', done: true }), tk))
      .toMatchObject({ type: 'up', suggestedWeight: 62.5 });
  });

  // P12 §4.2: «alMeta = series con reps ≥ G (o marcadas sin reps)» (sin marcar y sin reps no cuenta)
  // mata progression.js:247:12 / 247:13 (`!!s.done` → true)
  test('series sin ✓ y sin reps no cuentan como alcanzadas: no sube', () => {
    const chip = getProgression(cfg3, BB, rows(3, { weight: '60', reps: '', done: false }), tk);
    expect(chip.type).not.toBe('up');
  });

  // P12 §4.2 y §8.2 (mismo `verdict` en segundos): serie ✓ sin tiempo alcanza la meta
  // mata progression.js:244:9 (`&&` → `||`) y 244:24 (`time > 0` → true / `>= 0`)
  test('Tiempo + Peso: series ✓ sin tiempo cuentan como alcanzadas: sube', () => {
    const c = { sets: 3, minTime: 30, maxTime: 60, inputType: 'weight_time', progression: { type: 'double' } };
    expect(getProgression(c, BB, rows(3, { weight: '5', done: true }), tk))
      .toMatchObject({ type: 'up', suggestedWeight: 7.5 });
  });

  // P12 §4.2: «n = series de la plantilla»; §4.3: «con la n de la sesión»
  // mata progression.js:509:21 (`exConfig?.sets ?? def?.sets ?? …` → `&&`)
  test('n son las series de la plantilla, no las apuntadas: 4 de 5 a la meta mantiene', () => {
    const c = { ...cfg3, sets: 5 };
    expect(getProgression(c, BB, rows(4, { weight: '60', reps: '12', done: true }), tk))
      .toMatchObject({ type: 'hold', suggestedWeight: 60 });
  });

  // P12 §4.2: «sube = todas a la meta»; `chipDoubleDecrease` es «su espejo con la misma lógica»
  // mata progression.js:455:7 (`v.up && assistance === 0` → `v.up || assistance === 0`)
  // P18 §3.3: 7/7/7 con mínimo 8 es un fallo leve (3 de 24 reps), el primero → mantiene: ni sube ni baja
  test('asistido sin ayuda que no llega a la meta no sube: mantiene (fallo leve, el primero)', () => {
    const assisted = { progressionDirection: 'decrease', weightStep: 2.5 };
    const chip = getProgression(cfg3, assisted, [7, 7, 7].map((r) => ({ weight: '0', reps: String(r), done: true })), tk);
    expect(chip.type).toBe('hold');
  });

  // P12 §4.2: «RPE medio ≤ maxRpe» (un RPE medio igual al tope sube)
  // mata progression.js:280:34 (`rpe > maxRpe` → `>=`)
  test('RPE máx.: con RPE medio igual al tope sube', () => {
    const c = { ...cfg3, progression: { type: 'double', evaluation: { mode: 'rpe', maxRpe: 8 } } };
    expect(getProgression(c, BB, rows(3, { weight: '60', reps: '12', rpe: '8', done: true }), tk).type).toBe('up');
  });

  // P18 §4.1: Tiempo, meta = total + 5 s por serie (el mutante x >= start ya no existe: no hay inicio)
  test('Tiempo: 30/30/30 = 90 s → meta 105 s en total, 35 por serie', () => {
    const c = { sets: 3, minTime: 30, maxTime: 30, inputType: 'time', progression: { type: 'time' } };
    expect(getProgression(c, BB, rows(3, { time: '30', done: true }), tk))
      .toMatchObject({ type: 'up', goal: { total: 105, misses: 0 }, perSet: [35, 35, 35] });
  });

  // P12 §5.3-bis: «(los asistidos no cambian)» — una asistida sin escalón sigue siendo Doble y baja
  // mata progression.js:174:34 (`direction === 'increase'` → true)
  test('asistida de la librería sin escalón: sigue en Doble y la dirección es bajar', () => {
    expect(resolveProgressionConfig({}, LIB.pistol_squat_assisted)).toMatchObject({ type: 'double', direction: 'decrease' });
  });

  // P10 §3.1: «LEGACY_REVERSE_MAP gana `fixed:'none'` y conserva `submax:'none'`»
  // mata progression.js:88:23 (`fixed: 'none'` → "") y 89:23 (`submax: 'none'` → "")
  test.each(['fixed', 'submax'])("progressionModel '%s' es Nada y no da chip", (progressionModel) => {
    const d = { progressionModel };
    expect(resolveProgressionConfig({}, d).type).toBe('none');
    expect(getProgression({}, d, rows(3, { weight: '60', reps: '10', done: true }), tk)).toBeNull();
  });

  // P12 §3.1.4 (mantener = lo de la última vez) y §4.2 (espejo con la misma lógica)
  // mata progression.js:462:186 (`assistance || null` → true / false / `&&`)
  test('asistido que mantiene: el número es la ayuda de la última vez', () => {
    const assisted = { progressionDirection: 'decrease', weightStep: 2.5 };
    const r = [12, 10, 9].map((x) => ({ weight: '20', reps: String(x), done: true }));
    expect(getProgression(cfg3, assisted, r, tk)).toMatchObject({ type: 'hold', suggestedWeight: 20, assist: true });
  });

  // P12 §5.4-bis: «Exacto: se guarda `weightStep:'exact'`»; §12.2 (`def.progression` como valor por defecto)
  // mata progression.js:192:77 (`d.weightStep === 'exact'` → true)
  test('ejercicio propio en Por esfuerzo con escalón numérico no es Exacto', () => {
    expect(resolveProgressionConfig({}, { weightStep: 5, progression: { type: 'effort' } }).exact).toBe(false);
  });

  // P12 §4.5: «chip.effort → peso = suggestedWeight; reps = minReps»; P10 §5.2
  // mata progression.js:436:13 (`effort: true` → false) y 401:13 (idem, en `keep`)
  test('Por esfuerzo marca el chip como effort, también sin RPE', () => {
    const c = { sets: 3, minReps: 5, maxReps: 5, progression: { type: 'effort', targetRpe: 8 } };
    const at = (rpe) => rows(3, { weight: '80', reps: '5', rpe, done: true });
    expect(getProgression(c, { weightStep: 2.5 }, at('7'), tk).effort).toBe(true);
    expect(getProgression(c, { weightStep: 2.5 }, at(''), tk).effort).toBe(true);
  });

  // P10 §2.1 («LEGACY_TYPE_MAP.effort = double_progression»), §3.3 (Fija = 'fixed'); P12 §12.2
  // mata progression.js:74:32 y 76-80 (valores de LEGACY_TYPE_MAP)
  test('LEGACY_TYPE_MAP: de tipo de progresión a progressionModel', () => {
    expect(LEGACY_TYPE_MAP).toEqual({
      double: 'double_progression',
      weight: 'double_progression',
      reps: 'double_progression',
      time: 'time_progression',
      effort: 'double_progression',
      none: 'fixed',
    });
  });

  // P12 §4.2: `why_rpeAbove` = «llegó a la meta pero con RPE medio > maxRpe»
  // mata progression.js:283:14 (`reached && rpeOver` → `||`)
  test('RPE máx.: sin llegar a la meta no se dice que el RPE se pasó', () => {
    const c = { ...cfg3, progression: { type: 'double', evaluation: { mode: 'rpe', maxRpe: 8 } } };
    const r = [12, 10, 9].map((x) => ({ weight: '60', reps: String(x), rpe: '10', done: true }));
    const chip = getProgression(c, BB, r, tk);
    expect(chip).toMatchObject({ type: 'hold', reason: 'range' });
    expect(chip.why).not.toContain('rpeOver');
  });

  // P12 §5.2: «Sube 2.5 kg cuando todas las series lleguen a 12» (12 = el `maxReps`, aquí 10)
  // mata progression.js:579:19 (`exConfig?.maxReps ?? def?.maxReps` → `&&`)
  test('progressionRule: la meta es el maxReps del ejercicio', () => {
    const c = { sets: 3, minReps: 6, maxReps: 10, progression: { type: 'double' } };
    expect(progressionRule(c, BB, tk)).toBe(
      'progression.rule.weightUp{"inc":"2.5 kg","when":"progression.rule.whenAll","goal":10}progression.rule.weightDown');
  });

  // P12 §5.2 / P18 §3.1: n = las series de la plantilla; la mayoría simple de 5 son 3 de 5
  // mata progression.js:582:19 (`exConfig?.sets ?? def?.sets ?? 3` → `&&`)
  test('progressionRule: «La mayoría» usa las series del ejercicio (3 de 5)', () => {
    const c = { sets: 5, minReps: 8, maxReps: 12, progression: { type: 'double', evaluation: { mode: 'part' } } };
    expect(progressionRule(c, BB, tk)).toContain('whenPart{\\"need\\":3,\\"n\\":5}');
  });

  // P12 §4.1 («type 'weight' → double con meta = minReps»); §8.4 («la meta es el mínimo de tiempo»)
  // mata progression.js:618:18 y 618:50 (`legacy = type === 'weight'` → false / "")
  test("progressionRule: el 'weight' antiguo dice el mínimo como meta, en reps y en tiempo", () => {
    const reps = { sets: 3, minReps: 4, maxReps: 6, progression: { type: 'weight' } };
    expect(progressionRule(reps, BB, tk)).toBe(
      'progression.rule.weightUp{"inc":"2.5 kg","when":"progression.rule.whenAll","goal":4}progression.rule.weightDown');
    const time = { sets: 3, minTime: 20, maxTime: 40, inputType: 'weight_time', progression: { type: 'weight' } };
    expect(progressionRule(time, BB, tk)).toBe(
      'progression.rule.weightUp{"inc":"2.5 kg","when":"progression.rule.whenAll","goal":"20 s"}progression.rule.weightDown');
  });
});
