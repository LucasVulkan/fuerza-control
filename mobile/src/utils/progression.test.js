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

  test('grinding at RPE 10 → back off (down)', () => {
    expect(getProgression(rpeConfig(8), def, sets('10'), t)?.type).toBe('down');
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
  it('redondea al weightStep; 0 o sin él → 2.5', () => {
    // RPE 7 → 82.16: con paso 1 → 82; con paso 0 → 82.5.
    expect(getProgression(cfg(), { weightStep: 1 }, at('7'), tk).suggestedWeight).toBe(82);
    expect(getProgression(cfg(), { weightStep: 0 }, at('7'), tk).suggestedWeight).toBe(82.5);
    expect(getProgression(cfg(), null, at('7'), tk).suggestedWeight).toBe(82.5);
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
