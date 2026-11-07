import { describe, it, expect } from 'vitest';
import { parseRich, plainText } from './richText';

describe('richText (U17-01)', () => {
  it('separa texto, botones, estados e iconos', () => {
    expect(parseRich('Pulsa <main>Guardar</main> o <handle/>, <red>Sin entrenar</red>.')).toEqual([
      { kind: 'text', value: 'Pulsa ' },
      { kind: 'main', value: 'Guardar' },
      { kind: 'text', value: ' o ' },
      { kind: 'icon', name: 'handle' },
      { kind: 'text', value: ', ' },
      { kind: 'red', value: 'Sin entrenar' },
      { kind: 'text', value: '.' },
    ]);
  });
  it('un texto sin marcas es un solo trozo', () => {
    expect(parseRich('Hola')).toEqual([{ kind: 'text', value: 'Hola' }]);
  });
  it('el texto plano nombra los iconos y junta los párrafos', () => {
    expect(plainText('Usa <handle/>.\nLuego <btn>Vale</btn>', (n) => `el ${n}`)).toBe('Usa el handle. Luego Vale');
  });
});
