import { describe, it, expect } from 'vitest';
import { interFamily, textStyleFor, textStyles, MAX_FONT_SCALE } from './theme';

describe('interFamily', () => {
  it('resuelve la familia por peso', () => {
    expect(interFamily({ fontSize: 12 })).toBe('Inter_400Regular');          // sin peso → regular
    expect(interFamily({ fontWeight: '900' })).toBe('Inter_900Black');       // string, como en los estilos
    expect(interFamily({ fontWeight: 700 })).toBe('Inter_700Bold');          // número
    expect(interFamily({ fontWeight: 'bold' })).toBe('Inter_700Bold');       // palabra clave
    expect(interFamily({ fontWeight: '350' })).toBe('Inter_400Regular');     // peso que no cargamos
  });

  it('no pisa un estilo que ya eligió familia', () => {
    expect(interFamily(textStyles.cardTitle)).toBeNull();
    expect(interFamily(undefined)).toBe('Inter_400Regular');
  });
});

describe('textStyleFor', () => {
  it('quita fontWeight — es lo que rompía Android', () => {
    const s = textStyleFor({ fontFamily: 'Inter_900Black', fontSize: 24, fontWeight: '900' });
    expect(s.fontWeight).toBeUndefined();
    expect(s.fontFamily).toBe('Inter_900Black');   // la familia elegida se respeta
    expect(s.fontSize).toBe(24);                   // el resto del estilo pasa intacto
  });

  it('resuelve la familia por el peso antes de descartarlo', () => {
    expect(textStyleFor({ fontSize: 12, fontWeight: '700' }))
      .toEqual({ fontSize: 12, fontFamily: 'Inter_700Bold' });
  });

  it('no muta el estilo que recibe', () => {
    const src = { fontSize: 10, fontWeight: '800' };
    textStyleFor(src);
    expect(src.fontWeight).toBe('800');
  });
});

describe('MAX_FONT_SCALE', () => {
  // Se perdió una vez en una reescritura de theme.js y nadie se enteró: el
  // import roto da `undefined`, `Math.min(x, undefined)` da NaN, y FitLogo se
  // volvió invisible sin un error en consola. ESLint no ve exports que faltan.
  it('existe y es un techo razonable', () => {
    expect(typeof MAX_FONT_SCALE).toBe('number');
    expect(MAX_FONT_SCALE).toBeGreaterThan(1);
    expect(MAX_FONT_SCALE).toBeLessThanOrEqual(2);
  });
});
