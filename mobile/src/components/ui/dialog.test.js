// Guarda de U33: las confirmaciones y avisos van por `showDialog` (DialogHost),
// nunca por el `Alert` nativo, que en Android no se puede estilar.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = join(__dirname, '..', '..');

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(jsx?|tsx?)$/.test(name) && !name.includes('.test.') ? [p] : [];
  });
}

describe('dialog', () => {
  it('no queda ningún Alert.alert en src', () => {
    const offenders = sources(SRC).filter((p) => readFileSync(p, 'utf8').includes('Alert.alert('));
    expect(offenders).toEqual([]);
  });
});
