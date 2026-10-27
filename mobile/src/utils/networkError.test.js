import { describe, it, expect } from 'vitest';
import { isNetworkError, sendFailure } from './networkError';

const t = (k) => k;

describe('isNetworkError', () => {
  it('fallo de fetch sin respuesta = red', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(Object.assign(new Error('x'), { code: 'NETWORK' }))).toBe(true);
  });
  it('respuesta con error o error local = no es red', () => {
    expect(isNetworkError(Object.assign(new Error('boom'), { code: 'SERVER' }))).toBe(false);
    expect(isNetworkError(new Error('Programa no encontrado.'))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe('sendFailure', () => {
  it('distingue red, servidor y mensaje propio', () => {
    expect(sendFailure(new TypeError('Network request failed'), t, 'k').msg).toBe('sync.offlineQueued');
    expect(sendFailure(Object.assign(new Error('x'), { code: 'SERVER' }), t, 'k').msg).toBe('sync.serverError');
    expect(sendFailure(new Error('Hueco borrado'), t, 'k').msg).toBe('Hueco borrado');
    expect(sendFailure({}, t, 'k').msg).toBe('k');
  });
});
