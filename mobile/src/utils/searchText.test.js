import { describe, it, expect } from 'vitest';

import { filterBySearch } from './searchText';

const EX = [
  { name: 'Press de banca' },
  { name: 'Sentadilla búlgara' },
  { name: 'Elevación lateral' },
  { name: 'Prensa de piernas' },
];
const find = (q) => filterBySearch(EX, q, (e) => e.name).map((e) => e.name);

describe('filterBySearch', () => {
  it('sin consulta devuelve todo', () => {
    expect(find('  ')).toHaveLength(4);
  });

  it('ignora acentos y mayúsculas en ambos sentidos', () => {
    expect(find('bulgara')).toEqual(['Sentadilla búlgara']);
    expect(find('ELEVACIÓN')).toEqual(['Elevación lateral']);
  });

  it('aguanta una letra comida o cambiada', () => {
    expect(find('sentdilla')).toEqual(['Sentadilla búlgara']);
    expect(find('sentadolla')).toEqual(['Sentadilla búlgara']);
    expect(find('pressbanca')).toEqual(['Press de banca']);
  });

  it('la subcadena manda: no mete ruido si ya hay resultados exactos', () => {
    expect(find('press')).toEqual(['Press de banca']);
  });

  it('devuelve vacío cuando no se parece a nada', () => {
    expect(find('dominadas')).toEqual([]);
  });
});
