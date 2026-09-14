import { describe, it, expect } from 'vitest';
import { THEMES } from './themes';

// ── Contraste del rojo de texto ───────────────────────────────────────────────
// El fallo que origina este test: la pill "En riesgo" de ClientsScreen pintaba
// su texto con `color/red` de formaFit (#ff0900), que es el tono de RELLENO. A
// 12 px sobre el fondo teñido daba 4.3:1 — por debajo de AA y, por ser un rojo
// sin nada de verde, a ojo casi ilegible. `redText` (#ff5e58, el mismo del que
// Figma deriva `tint/red-50`) es el tono legible.
//
// Se vigila formaFit porque es el tema por defecto y el del rediseño. Los otros
// cuatro no entran: en `earthy` el rojo da 3.9:1 sobre su fondo claro, pero eso
// es el mismo problema de paleta que ya tiene su accent (2.4:1) y se arregla
// con la paleta, no aquí.

const lin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** `hex` al `alpha` que pide, compuesto sobre `over` — lo que hace withOpacity. */
const over = (hex, alpha, bg) => {
  const mix = [1, 3, 5].map((i) =>
    Math.round(alpha * parseInt(hex.slice(i, i + 2), 16) + (1 - alpha) * parseInt(bg.slice(i, i + 2), 16)));
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

describe('formaFit — rojo legible', () => {
  const c = THEMES.formaFit.colors;

  it('el rojo de texto llega a AA sobre las dos superficies', () => {
    expect(contrast(c.redText, c.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.redText, c.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('llega a AA sobre la pill teñida y rellenando la pill activa', () => {
    expect(contrast(c.redText, over(c.red, 0.12, c.bg))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.bg, c.redText)).toBeGreaterThanOrEqual(4.5);
  });

  it('y el rojo de relleno NO llegaba — por eso hay dos tonos', () => {
    expect(contrast(c.red, c.surface)).toBeLessThan(4.5);
  });
});

// ── El gris de la meta ────────────────────────────────────────────────────────
// `mutedLight` es el color de 234 estilos de texto, todos a 12 px. Figma lo fijó
// en #818181 antes de que este tema subiera las superficies a #1f1f1f/#272727, y
// ahí daba 4.23:1 y 3.83:1 — por debajo de AA las dos. Este test es lo que evita
// que vuelva "por fidelidad" sin mirar el número.
describe('formaFit — el gris de la meta', () => {
  const c = THEMES.formaFit.colors;

  it('llega a AA sobre las tres superficies', () => {
    for (const s of [c.bg, c.surface, c.surface2]) {
      expect(contrast(c.mutedLight, s), `mutedLight sobre ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('sigue muy por debajo de `text`: la jerarquía de color no se aplana', () => {
    expect(contrast(c.text, c.surface) / contrast(c.mutedLight, c.surface)).toBeGreaterThan(2);
  });
});
