import { describe, it, expect } from 'vitest';
import { formatCode } from './codeFormat';

describe('formatCode', () => {
  it('mete el guion solo y fuerza mayúsculas', () => {
    expect(formatCode('xk7m2p4t', 2)).toBe('XK7M-2P4T');
    expect(formatCode('xk7m', 2)).toBe('XK7M');
    expect(formatCode('xk7m2', 2)).toBe('XK7M-2');
  });

  it('acepta el código ya formateado, pegado con espacios o en minúscula', () => {
    expect(formatCode('XK7M-2P4T', 2)).toBe('XK7M-2P4T');
    expect(formatCode('  xk7m 2p4t \n', 2)).toBe('XK7M-2P4T');
  });

  it('corta al largo exacto del código', () => {
    expect(formatCode('XK7M2P4T9QR3EXTRA', 2)).toBe('XK7M-2P4T');
    expect(formatCode('XK7M2P4T9QR3EXTRA', 3)).toBe('XK7M-2P4T-9QR3');
  });

  it('descarta símbolos pero no las letras confusas (I, O, 0, 1)', () => {
    expect(formatCode('XK.7M/2P#4T', 2)).toBe('XK7M-2P4T');
    expect(formatCode('IO01IO01', 2)).toBe('IO01-IO01');
  });

  it('no revienta con vacío ni con null', () => {
    expect(formatCode('', 2)).toBe('');
    expect(formatCode(null, 2)).toBe('');
    expect(formatCode('---', 2)).toBe('');
  });
});
