import { describe, it, expect } from 'vitest';
import { getProgression, progressionChip, stepDown, BIG_FAIL, splitTotal } from './progression';

// P18-01 (docs/specs/P18-motor-progresion.md §3 y §8, casos 1-11). Cada caso lleva
// sus literales y la cita de la spec. `t` devuelve clave + opciones: aquí solo se
// comprueban type, suggestedWeight, reason (y missing), no los textos.
const tk = (k, o) => `${k}${o ? JSON.stringify(o) : ''}`;
const BB = { equipment: ['barbell'], weightStep: 2.5 };
const ASSISTED = { progressionDirection: 'decrease', weightStep: 2.5 };

// Una sesión: todas las series con el mismo peso.
const ses = (weight, reps, rpe = '') => reps.map((r) => ({ weight: String(weight), reps: String(r), rpe, done: true }));
const cfg = (sets, minReps, maxReps, progression = {}) => ({ sets, minReps, maxReps, progression: { type: 'double', ...progression } });

describe('P18-01 — Peso por reglas: casos de la spec (§8)', () => {
  // P18 §8, caso 1
  it('caso 1: sube a 32,5 kg y hace 10/9/9 (mín. 10) → mantén 32,5, faltaron 2 reps', () => {
    const c = cfg(3, 10, 12);
    const chip = getProgression(c, BB, ses(32.5, [10, 9, 9]), tk, { earlier: [ses(30, [12, 12, 12])] });
    expect(chip).toMatchObject({ type: 'hold', suggestedWeight: 32.5, reason: 'fail', missing: 2 });
  });

  // P18 §8, caso 2
  it('caso 2: 3×12-15, 9,25 kg, 10/9/9 (faltan 8 de 36 = 22 %) → baja a 8 kg (escalón 1,25)', () => {
    const c = cfg(3, 12, 15);
    const chip = getProgression(c, { equipment: ['barbell'], weightStep: 1.25 }, ses(9.25, [10, 9, 9]), tk);
    expect(chip).toMatchObject({ type: 'down', suggestedWeight: 8, reason: 'bigFail', missing: 8 });
  });

  // P18 §8, caso 3
  it('caso 3: 5×5 a 95 kg, 5/5/5/4/4 y luego 5/5/5/5/4 → mantén 95 las dos veces; la segunda mejora', () => {
    const c = cfg(5, 5, 5);
    const first = ses(95, [5, 5, 5, 4, 4]);
    const second = ses(95, [5, 5, 5, 5, 4]);
    expect(getProgression(c, BB, first, tk)).toMatchObject({ type: 'hold', suggestedWeight: 95, reason: 'fail' });
    expect(getProgression(c, BB, second, tk, { earlier: [first] }))
      .toMatchObject({ type: 'hold', suggestedWeight: 95, reason: 'improving' });
  });

  // P18 §8, caso 4
  it('caso 4: 5×5 a 95 kg, 5/5/5/4/4 y luego 5/5/4/4/4 → baja a 85 kg (segundo fallo leve seguido)', () => {
    const c = cfg(5, 5, 5);
    const first = ses(95, [5, 5, 5, 4, 4]);
    const second = ses(95, [5, 5, 4, 4, 4]);
    expect(getProgression(c, BB, second, tk, { earlier: [first] }))
      .toMatchObject({ type: 'down', suggestedWeight: 85, reason: 'secondFail' });
    // Por el camino de la tarjeta: el log, de la más reciente a la más antigua.
    expect(progressionChip(c, BB, [{ sets: second }, { sets: first }], tk))
      .toMatchObject({ type: 'down', suggestedWeight: 85, reason: 'secondFail' });
  });

  // P18 §8, caso 5
  it('caso 5: 5×5 a 95 kg, 5/4/4/3/3 (24 %) → baja a 85 kg (fallo grande)', () => {
    const chip = getProgression(cfg(5, 5, 5), BB, ses(95, [5, 4, 4, 3, 3]), tk);
    expect(chip).toMatchObject({ type: 'down', suggestedWeight: 85, reason: 'bigFail' });
  });

  // P18 §8, caso 6
  it('caso 6: Parcial 2 de 3, 12-15: 15/15/11 → mantén (la tercera queda bajo el mínimo)', () => {
    const c = cfg(3, 12, 15, { evaluation: { mode: 'part', need: 2 } });
    expect(getProgression(c, BB, ses(60, [15, 15, 11]), tk)).toMatchObject({ type: 'hold', suggestedWeight: 60 });
  });

  // P18 §8, caso 7
  it('caso 7: Parcial 2 de 3, 12-15: 15/15/13 → sube', () => {
    const c = cfg(3, 12, 15, { evaluation: { mode: 'part', need: 2 } });
    expect(getProgression(c, BB, ses(60, [15, 15, 13]), tk)).toMatchObject({ type: 'up', suggestedWeight: 62.5 });
  });

  // P18 §8, caso 8
  it('caso 8: RPE máx. 8, 12/12/12 a RPE 8/9/9,5 → mantén, RPE medio 8,8', () => {
    const c = cfg(3, 10, 12, { evaluation: { mode: 'rpe', maxRpe: 8 } });
    const sets = [['12', '8'], ['12', '9'], ['12', '9.5']].map(([reps, rpe]) => ({ weight: '60', reps, rpe, done: true }));
    const chip = getProgression(c, BB, sets, tk);
    expect(chip).toMatchObject({ type: 'hold', suggestedWeight: 60, reason: 'rpe' });
    expect(chip.why).toContain('"rpe":8.8');
  });

  // P18 §8, caso 9
  it('caso 9: RPE máx. 8, 10/10/9 a RPE 8/8/9 → mantén (el RPE nunca baja el peso)', () => {
    const c = cfg(3, 8, 10, { evaluation: { mode: 'rpe', maxRpe: 8 } });
    const sets = [['10', '8'], ['10', '8'], ['9', '9']].map(([reps, rpe]) => ({ weight: '60', reps, rpe, done: true }));
    expect(getProgression(c, BB, sets, tk)).toMatchObject({ type: 'hold', suggestedWeight: 60 });
  });

  // P18 §8, caso 10
  it('caso 10: asistida 3×5-8, 27,5 kg de ayuda, 6/4/4 dos veces → añade ayuda: 30 kg', () => {
    const c = cfg(3, 5, 8);
    const first = ses(27.5, [6, 4, 4]);
    const second = ses(27.5, [6, 4, 4]);
    expect(getProgression(c, ASSISTED, first, tk)).toMatchObject({ type: 'hold', suggestedWeight: 27.5, assist: true });
    expect(getProgression(c, ASSISTED, second, tk, { earlier: [first] }))
      .toMatchObject({ type: 'down', suggestedWeight: 30, assist: true });
  });

  // P18 §8, caso 11
  it('caso 11: bajar con 100 · 60 · 39 · 10 kg (escalón 2,5) → 90 · 55 · 35 · 7,5', () => {
    expect([100, 60, 39, 10].map((w) => stepDown(w, 2.5))).toEqual([90, 55, 35, 7.5]);
  });

  // P18 §3.3: «en una asistida, +10 % de ayuda con la misma regla»
  it('caso 11 (asistida): +10 % de ayuda al escalón, 27,5 → 30', () => {
    expect(stepDown(27.5, 2.5, true)).toBe(30);
  });
});

describe('P18-01 — Peso por reglas: reglas sueltas (§3.2-3.4)', () => {
  const c5 = cfg(5, 5, 5);

  // P18 §3.3: «down: 'never' sigue mandando: mantener siempre»
  it("down: 'never' nunca baja, ni con un fallo grande", () => {
    const never = cfg(5, 5, 5, { down: 'never' });
    expect(getProgression(never, BB, ses(95, [5, 4, 4, 3, 3]), tk)).toMatchObject({ type: 'hold', suggestedWeight: 95 });
    const first = ses(95, [5, 5, 5, 4, 4]);
    expect(getProgression(never, BB, ses(95, [5, 5, 4, 4, 4]), tk, { earlier: [first] }).type).toBe('hold');
  });

  // P18 §3.3: «Con peso 0 no se baja»
  it('fallo grande con peso 0 no baja', () => {
    expect(getProgression(c5, BB, ses(0, [5, 4, 4, 3, 3]), tk).type).toBe('hold');
    expect(getProgression(c5, BB, ses('', [5, 4, 4, 3, 3]), tk).type).toBe('hold');
  });

  // P18 §3.3: `down: { fails }` antiguo se lee como ausente
  it('un `down: { fails }` antiguo se ignora: ni baja antes ni deja de bajar', () => {
    const old = cfg(3, 8, 12, { down: { fails: 1 } });
    expect(getProgression(old, BB, ses(60, [12, 12, 7]), tk).type).toBe('hold'); // fallo leve primero
    expect(getProgression(old, BB, ses(60, [12, 5, 5]), tk).type).toBe('down');  // fallo grande
    const late = cfg(3, 8, 12, { down: { fails: 3 } });
    expect(getProgression(late, BB, ses(60, [12, 5, 5]), tk).type).toBe('down');
  });

  // P18 §3.4: «la racha solo entre sesiones con el mismo peso: tras subir o bajar, empieza de cero»
  it('tras un fallo a otro peso la racha empieza de cero: segundo fallo leve con el anterior a otro peso → mantiene', () => {
    const cur = ses(60, [5, 5, 4, 4, 4]);
    const other = ses(57.5, [5, 5, 4, 4, 4]);
    expect(getProgression(c5, BB, cur, tk, { earlier: [other] }))
      .toMatchObject({ type: 'hold', suggestedWeight: 60, reason: 'fail' });
    // Con el mismo peso, el mismo par de sesiones sí baja.
    expect(getProgression(c5, BB, cur, tk, { earlier: [ses(60, [5, 5, 4, 4, 4])] }).type).toBe('down');
  });

  // P18 §3.2: «Mejorar no es fallo» también para la sesión anterior (§3.4: hasta la primera sin fallo)
  it('la sesión anterior que mejoró a la suya no cuenta como fallo: el fallo de hoy es el primero', () => {
    const prev2 = ses(60, [5, 5, 4, 4, 4]);          // 22
    const prev = ses(60, [5, 5, 5, 4, 4]);           // 23: mejora, sin fallo
    const cur = ses(60, [5, 5, 4, 4, 4]);            // 22: fallo leve
    expect(getProgression(c5, BB, cur, tk, { earlier: [prev, prev2] }))
      .toMatchObject({ type: 'hold', suggestedWeight: 60, reason: 'fail' });
  });

  // P18 §3.2: 15 % en BIG_FAIL, justo en el borde no es grande
  it('BIG_FAIL es 0,15 y «grande» es estrictamente mayor', () => {
    expect(BIG_FAIL).toBe(0.15);
    // 5×4 mínimo 4 → 20 reps; faltan 3 = 15 % exacto → leve (hold); faltan 4 = 20 % → grande
    expect(getProgression(cfg(5, 4, 4), BB, ses(80, [4, 4, 4, 3, 2]), tk).type).toBe('hold');
    expect(getProgression(cfg(5, 4, 4), BB, ses(80, [4, 4, 3, 3, 2]), tk).type).toBe('down');
  });

  // P18 §3.1: mayoría simple por defecto
  it('La mayoría sin `need`: 2 de 3, 3 de 4, 3 de 5', () => {
    const part = (n) => cfg(n, 12, 15, { evaluation: { mode: 'part' } });
    const run = (n, atGoal) => getProgression(part(n), BB, ses(60, [...Array(atGoal).fill(15), ...Array(n - atGoal).fill(13)]), tk).type;
    expect([run(3, 2), run(3, 1)]).toEqual(['up', 'hold']);
    expect([run(4, 3), run(4, 2)]).toEqual(['up', 'hold']);
    expect([run(5, 3), run(5, 2)]).toEqual(['up', 'hold']);
  });

  // P18 §3.1: «un `need` ya guardado se sigue respetando al leer»
  it('un `need` guardado se respeta', () => {
    const c = cfg(5, 12, 15, { evaluation: { mode: 'part', need: 4 } });
    expect(getProgression(c, BB, ses(60, [15, 15, 15, 13, 13]), tk).type).toBe('hold');
    expect(getProgression(c, BB, ses(60, [15, 15, 15, 15, 13]), tk).type).toBe('up');
  });

  // P18 §3.1: sin rango, la mayoría sube sin más condición
  it('La mayoría sin rango (mín = máx): 2 de 3 a la meta sube aunque la otra quede abajo', () => {
    const c = cfg(3, 10, 10, { evaluation: { mode: 'part', need: 2 } });
    expect(getProgression(c, BB, ses(60, [10, 10, 8]), tk)).toMatchObject({ type: 'up', suggestedWeight: 62.5 });
  });

  // P18 §3.1: el RPE solo frena
  it('el RPE solo frena: con fallo grande y RPE 10 baja por la regla, no por el RPE', () => {
    const c = cfg(3, 8, 12, { evaluation: { mode: 'rpe', maxRpe: 8 } });
    expect(getProgression(c, BB, ses(60, [12, 10, 9], '10'), tk).type).toBe('hold');
    expect(getProgression(c, BB, ses(60, [12, 5, 5], '10'), tk)).toMatchObject({ type: 'down', reason: 'bigFail' });
  });
});

// ── P18-02 — Reps y Tiempo: una meta por total (§4 y §8, casos 12-16) ───────────

// Series sin peso: `key` es 'reps' o 'time'.
const vol = (vals, key = 'reps') => vals.map((v) => ({ weight: '', reps: key === 'reps' ? String(v) : '', time: key === 'time' ? String(v) : '', rpe: '', done: true }));
const repsCfg = (extra = {}) => ({ sets: 3, minReps: 8, maxReps: 12, progression: { type: 'reps', ...extra } });
const timeCfg = (extra = {}) => ({ sets: 3, minTime: 20, maxTime: 40, progression: { type: 'time', ...extra } });
// Como la app: el `goal` del chip de una sesión es el `lastGoal` de la siguiente.
const next = (c, def, sets, earlier, lastGoal) => getProgression(c, def, sets, tk, { earlier, lastGoal });

describe('P18-02 — Reps y Tiempo por total: casos de la spec (§8)', () => {
  it('splitTotal reparte el sobrante en las primeras', () => {
    expect(splitTotal(34, 3)).toEqual([12, 11, 11]);
    expect(splitTotal(30, 3)).toEqual([10, 10, 10]);
    expect(splitTotal(7, 3)).toEqual([3, 2, 2]);
  });

  // P18 §8, caso 12
  it('caso 12: 12/12/7 = 31 reps, sin goal → meta 34 en total, 12/11/11', () => {
    const chip = next(repsCfg(), {}, vol([12, 12, 7]), []);
    expect(chip).toMatchObject({ type: 'up', reason: 'first', volume: true, lastTotal: 31, goal: { total: 34, misses: 0 }, perSet: [12, 11, 11] });
  });

  // P18 §8, caso 13
  it('caso 13: meta 34, hace 32 (antes 31) y luego 33 → la meta sigue en 34', () => {
    const c = repsCfg();
    const before = vol([11, 10, 10]);                       // 31
    const goal0 = { total: 34, misses: 0 };
    const a = next(c, {}, vol([11, 11, 10]), [before], goal0);   // 32
    expect(a).toMatchObject({ type: 'hold', reason: 'improving', goal: { total: 34, misses: 0 }, perSet: [12, 11, 11] });
    const b = next(c, {}, vol([11, 11, 11]), [vol([11, 11, 10]), before], a.goal);   // 33
    expect(b).toMatchObject({ type: 'hold', reason: 'improving', goal: { total: 34, misses: 0 }, perSet: [12, 11, 11] });
  });

  // P18 §8, caso 14 y 15
  it('casos 14-15: meta 37, hace 27 (antes 34) → sigue 37 con un fallo; luego 16 → meta 19 y 7/6/6', () => {
    const c = repsCfg();
    const antes = vol([12, 11, 11]);                        // 34
    const hoy = vol([9, 9, 9]);                             // 27
    const first = next(c, {}, hoy, [antes], { total: 37, misses: 0 });
    expect(first).toMatchObject({ type: 'hold', reason: 'fail', goal: { total: 37, misses: 1 }, perSet: [13, 12, 12] });
    const second = next(c, {}, vol([6, 5, 5]), [hoy, antes], first.goal);   // 16
    expect(second).toMatchObject({ type: 'down', reason: 'secondFail', goal: { total: 19, misses: 0 }, perSet: [7, 6, 6] });
  });

  // P18 §8, caso 16
  it('caso 16: Tiempo, salto 5 s, 45/40/30 = 115 s → meta 130 s, 44/43/43', () => {
    const chip = next(timeCfg({ increment: { value: 5 } }), {}, vol([45, 40, 30], 'time'), []);
    expect(chip).toMatchObject({ type: 'up', timed: true, lastTotal: 115, goal: { total: 130, misses: 0 }, perSet: [44, 43, 43] });
  });

  // P18 §4.1: Tiempo sin salto elegido usa 5 s por serie
  it('Tiempo sin salto: 5 s por serie por defecto', () => {
    expect(next(timeCfg(), {}, vol([45, 40, 30], 'time'), []).goal.total).toBe(130);
  });

  // P18 §4.1: el salto es de la hoja
  it('salto +2 reps por serie: 12/12/7 → 31 + 6 = 37', () => {
    const chip = next(repsCfg({ increment: { value: 2 } }), {}, vol([12, 12, 7]), []);
    expect(chip).toMatchObject({ goal: { total: 37, misses: 0 }, perSet: [13, 12, 12] });
  });

  // P18 §4.1: al alcanzar la meta se calcula la siguiente
  it('alcanzar la meta (total ≥ meta) pide una nueva: 34 hechas con meta 34 → 37', () => {
    const chip = next(repsCfg(), {}, vol([12, 11, 11]), [vol([11, 11, 10])], { total: 34, misses: 0 });
    expect(chip).toMatchObject({ type: 'up', reason: 'reached', goal: { total: 37, misses: 0 } });
  });

  // P18 §4.2: lo antiguo sin goal cuenta como la primera sesión
  it('una sesión sin goal (log antiguo) se trata como la primera: meta = su total + 1 por serie', () => {
    const viejo = [{ sets: vol([12, 12, 7]) }, { sets: vol([10, 10, 10]) }];   // sin goal
    const chip = progressionChip(repsCfg(), {}, viejo, tk);
    expect(chip).toMatchObject({ type: 'up', reason: 'first', goal: { total: 34, misses: 0 }, perSet: [12, 11, 11] });
  });

  // P18 §4.2: la cadena entera por el camino de la tarjeta (el log guarda el goal)
  it('por progressionChip: el goal guardado en el log se lee como lastGoal', () => {
    const c = repsCfg();
    const log = [{ sets: vol([9, 9, 9]), goal: { total: 37, misses: 0 } }, { sets: vol([12, 11, 11]) }];
    expect(progressionChip(c, {}, log, tk))
      .toMatchObject({ reason: 'fail', goal: { total: 37, misses: 1 } });
  });

  // P18 §4.1: la evaluación (Todas/Parcial/RPE) no afecta a Reps y Tiempo
  it('Parcial y RPE no cambian nada en Reps', () => {
    const base = next(repsCfg(), {}, vol([12, 12, 7]), []);
    const part = next(repsCfg({ evaluation: { mode: 'part', need: 2 } }), {}, vol([12, 12, 7]), []);
    const rpe = next(repsCfg({ evaluation: { mode: 'rpe', maxRpe: 6 } }), {}, vol([12, 12, 7]), []);
    expect([part.goal, rpe.goal]).toEqual([base.goal, base.goal]);
  });
});
