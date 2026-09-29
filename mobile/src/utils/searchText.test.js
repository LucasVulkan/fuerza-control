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

  it('busca por palabras sueltas, en cualquier orden', () => {
    const lib = [
      { name: 'Remo en polea', nameEn: 'Seated Cable Row' },
      { name: 'Remo polea alta', nameEn: 'High Cable Row' },
      { name: 'Dominadas supinas', nameEn: 'Chin-ups' },
      { name: 'Press de hombro en máquina', nameEn: 'Machine Shoulder Press' },
      { name: 'Curl bíceps supinación', nameEn: 'Supinated Biceps Curl' },
    ];
    const f = (q) => filterBySearch(lib, q, (e) => `${e.name} ${e.nameEn}`).map((e) => e.name);
    expect(f('remo polea')).toEqual(['Remo en polea', 'Remo polea alta']);
    expect(f('polea remo')).toEqual(['Remo en polea', 'Remo polea alta']);
    expect(f('dominada supina')).toEqual(['Dominadas supinas']);
    // Guiones como espacio, y la búsqueda pegada: sin caer en la subsecuencia
    // (que antes devolvía press en máquina y curls).
    expect(f('chin up')).toEqual(['Dominadas supinas']);
    expect(f('chin-up')).toEqual(['Dominadas supinas']);
    expect(f('chinup')).toEqual(['Dominadas supinas']);
  });

  it('devuelve vacío cuando no se parece a nada', () => {
    expect(find('dominadas')).toEqual([]);
  });
});
