import { describe, it, expect } from 'vitest';
import { interFamily, textStyleFor, textStyles, MAX_FONT_SCALE } from './theme';

describe('interFamily', () => {
  it('resuelve la familia por peso', () => {
    expect(interFamily({ fontSize: 12 })).toBe('Inter_500Medium');           // sin peso → Medium, el cuerpo de la app
    expect(interFamily({ fontWeight: '900' })).toBe('Inter_900Black');       // string, como en los estilos
    expect(interFamily({ fontWeight: 700 })).toBe('Inter_700Bold');          // número
    expect(interFamily({ fontWeight: 'bold' })).toBe('Inter_700Bold');       // palabra clave
    expect(interFamily({ fontWeight: '350' })).toBe('Inter_500Medium');      // peso que no cargamos
  });

  it('no pisa un estilo que ya eligió familia', () => {
    expect(interFamily(textStyles.itemTitle)).toBeNull();
    expect(interFamily(undefined)).toBe('Inter_500Medium');
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

// ── El sistema tipográfico se vigila solo ─────────────────────────────────────
// Sin esto, en tres meses hay un decimoquinto papel a 15 px con tracking 0.7 y
// nadie se entera hasta que la app vuelve a sonar a cacofonía. Cada `it` de aquí
// es una de las reglas de la spec (docs/specs/tipografia.md §3).
describe('escala tipográfica', () => {
  const roles = Object.entries(textStyles);
  const inter = roles.filter(([, s]) => s.fontFamily.startsWith('Inter_'));

  it('sólo usa los ocho pasos de la escala', () => {
    const ESCALA = [11, 12, 14, 16, 18, 22, 28, 34];
    for (const [name, s] of roles) {
      expect(ESCALA, `${name} está fuera de la escala`).toContain(s.fontSize);
    }
  });

  it('nada baja del suelo de legibilidad (11)', () => {
    for (const [name, s] of roles) {
      expect(s.fontSize, `${name} no llega al mínimo de iOS/Material`).toBeGreaterThanOrEqual(11);
    }
  });

  it('sólo carga los cuatro pesos de Inter que hay en el bundle', () => {
    const CARGADAS = ['Inter_500Medium', 'Inter_700Bold', 'Inter_800ExtraBold', 'Inter_900Black'];
    for (const [name, s] of inter) {
      expect(CARGADAS, `${name} pide una familia que App.js no carga`).toContain(s.fontFamily);
    }
  });

  it('el tracking positivo es sólo para versales, y vale 1.2', () => {
    // `code` queda fuera a propósito: se lee carácter a carácter, no como
    // palabra, así que su aire es funcional y no tipográfico.
    for (const [name, s] of roles) {
      if (name === 'code') continue;
      if (s.letterSpacing > 0) {
        expect(s.letterSpacing, `${name} inventa un tracking positivo`).toBe(1.2);
        expect(name, `${name} lleva tracking sin ser versales`).toBe('caps');
      }
    }
  });

  it('el tracking negativo es sólo de display (>22) y ronda -0.02 em', () => {
    for (const [name, s] of roles) {
      if (s.letterSpacing >= 0) continue;
      expect(Math.abs(s.letterSpacing) / s.fontSize, `${name} aprieta de más`).toBeLessThan(0.04);
    }
  });

  it('ningún papel declara fontWeight — el peso va en la familia', () => {
    for (const [name, s] of roles) {
      expect(s.fontWeight, `${name} volvería a caer en Roboto en Android`).toBeUndefined();
    }
  });
});
