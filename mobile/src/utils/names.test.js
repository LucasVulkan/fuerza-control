import { describe, it, expect } from 'vitest';

import { ARCHETYPES } from '../data/archetypes';
import { NAME_MAX, copyName } from './names';

describe('copyName', () => {
  it('deja el nombre entero cuando cabe', () => {
    expect(copyName('Empuje')).toBe('Empuje (copia)');
  });

  it('nunca pasa del límite', () => {
    expect(copyName('Full Body · Barra').length).toBeLessThanOrEqual(NAME_MAX);
    expect(copyName('x'.repeat(60)).length).toBeLessThanOrEqual(NAME_MAX);
  });

  it('recorta la base y conserva el sufijo, sin separador colgando', () => {
    expect(copyName('Full Body · Barra')).toBe('Full Body (copia)');
  });

  it('aguanta vacío y nulo', () => {
    expect(copyName('')).toBe('(copia)');
    expect(copyName(null)).toBe('(copia)');
  });
});

// El límite no sirve de nada si el generador reparte nombres más largos: el
// usuario abriría el lápiz y vería 43/20 sin haber escrito nada.
describe('nombres generados', () => {
  it('ningún arquetipo pasa de NAME_MAX', () => {
    const largos = [];
    for (const a of ARCHETYPES) {
      if (a.name.length > NAME_MAX) largos.push(a.name);
      for (const d of a.days) if (d.name.length > NAME_MAX) largos.push(d.name);
    }
    expect(largos).toEqual([]);
  });

  it('no hay dos arquetipos con el mismo nombre', () => {
    const nombres = ARCHETYPES.map((a) => a.name);
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});
