import { describe, it, expect } from 'vitest';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { compose, decompose, twinOf, canBeUnilateral } from './exerciseIdentity';
import { variantKey, sameVariant, cleanVariant } from './variants';

// Librería + lo que se vaya derivando, como `getEffectiveLibrary()`.
function libWith(...defs) {
  const lib = { ...EXERCISE_LIBRARY };
  for (const d of defs) if (d) lib[d.id] = d;
  return lib;
}

describe('variants', () => {
  it('el sufijo no depende del orden de las claves', () => {
    expect(variantKey({ width: 'wide', grip: 'pronated' })).toBe('pronated_wide');
    expect(variantKey({ grip: 'neutral' })).toBe('neutral');
  });

  it('sameVariant ignora las claves vacías', () => {
    expect(sameVariant({ grip: 'neutral', width: null }, { grip: 'neutral' })).toBe(true);
    expect(sameVariant({}, undefined)).toBe(true);
    expect(sameVariant({ grip: 'neutral' }, { grip: 'pronated' })).toBe(false);
  });

  it('cleanVariant quita lo que el ejercicio no declara', () => {
    const pullUp = EXERCISE_LIBRARY.pull_up;   // agarre: prono y neutro
    expect(cleanVariant({ grip: 'supinated', width: 'wide' }, pullUp)).toEqual({ width: 'wide' });
    expect(cleanVariant({ grip: 'neutral' }, EXERCISE_LIBRARY.bench_press_barbell)).toBeUndefined();
  });
});

describe('exerciseIdentity', () => {
  it('unilateral sin gemelo: se deriva con id fijo y sin anchura', () => {
    const { id, def } = compose({ root: 'pulldown', uni: true }, EXERCISE_LIBRARY);
    expect(id).toBe('pulldown__uni');
    expect(def.name).toBe('Jalón al pecho unilateral');
    expect(def.nameEn).toBe('Unilateral Lat Pulldown');
    expect(def.isUnilateral).toBe(true);
    expect(def.isCustom).toBe(false);
    expect(def.variants).toEqual({ grip: EXERCISE_LIBRARY.pulldown.variants.grip });
  });

  it('unilateral con gemelo: el de la librería, sin derivar nada', () => {
    expect(twinOf('cable_row', EXERCISE_LIBRARY)).toBe('single_arm_cable_row');
    expect(compose({ root: 'cable_row', uni: true }, EXERCISE_LIBRARY)).toEqual({ id: 'single_arm_cable_row', def: null });
  });

  it('ejercicio aparte: la variante pasa al nombre, sin paréntesis', () => {
    const { id, def } = compose({ root: 'pulldown', variant: { grip: 'pronated', width: 'wide' } }, EXERCISE_LIBRARY);
    expect(id).toBe('pulldown__pronated_wide');
    expect(def.name).toBe('Jalón al pecho · Prono · Ancho');
    expect(def.nameEn).toBe('Lat Pulldown · Pronated · Wide');
    expect(def.variants).toEqual({});
  });

  it('aparte sobre un unilateral, derivado o gemelo', () => {
    expect(compose({ root: 'pulldown', uni: true, variant: { grip: 'pronated' } }, EXERCISE_LIBRARY).def.name)
      .toBe('Jalón al pecho unilateral · Prono');
    const twin = compose({ root: 'cable_row', uni: true, variant: { grip: 'neutral' } }, EXERCISE_LIBRARY);
    expect(twin.id).toBe('single_arm_cable_row__neutral');
    expect(twin.def.name).toBe('Remo unilateral en polea · Neutro');
    expect(twin.def.unilateralOf).toBeUndefined();
  });

  it('un unilateral de por sí no se vuelve a derivar', () => {
    const { id } = compose({ root: 'db_row_unilateral', uni: true, variant: { grip: 'neutral' } }, EXERCISE_LIBRARY);
    expect(id).toBe('db_row_unilateral__neutral');
    expect(decompose('db_row_unilateral', EXERCISE_LIBRARY)).toMatchObject({ root: 'db_row_unilateral', uni: true, natural: true });
  });

  it('decompose deshace compose', () => {
    const cases = [
      { root: 'pulldown', uni: false, variant: null },
      { root: 'pulldown', uni: true,  variant: null },
      { root: 'pulldown', uni: false, variant: { grip: 'pronated', width: 'wide' } },
      { root: 'pulldown', uni: true,  variant: { grip: 'pronated' } },
      { root: 'cable_row', uni: true, variant: null },
      { root: 'cable_row', uni: true, variant: { grip: 'neutral' } },
    ];
    for (const c of cases) {
      const { id, def } = compose(c, EXERCISE_LIBRARY);
      expect(decompose(id, libWith(def))).toMatchObject(c);
    }
  });

  it('un derivado ya guardado no se vuelve a crear', () => {
    const first = compose({ root: 'pulldown', uni: true }, EXERCISE_LIBRARY);
    expect(compose({ root: 'pulldown', uni: true }, libWith(first.def))).toEqual({ id: 'pulldown__uni', def: null });
  });

  it('canBeUnilateral: por gemelo o por material', () => {
    expect(canBeUnilateral(EXERCISE_LIBRARY.pulldown, EXERCISE_LIBRARY)).toBe(true);
    expect(canBeUnilateral(EXERCISE_LIBRARY.hip_thrust, EXERCISE_LIBRARY)).toBe(true);
    expect(canBeUnilateral(EXERCISE_LIBRARY.barbell_row, EXERCISE_LIBRARY)).toBe(false);
    expect(canBeUnilateral(EXERCISE_LIBRARY.db_row_unilateral, EXERCISE_LIBRARY)).toBe(false);
  });
});
