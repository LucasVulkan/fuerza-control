import { describe, it, expect } from 'vitest';
import { programSignature } from './programSignature';

const payload = (sets = 3, exportDate = '2026-09-23') => ({
  version: '4', exportDate,
  program: { id: 'p1', name: 'Fuerza' },
  sessionTemplates: { t1: { id: 't1', exercises: [{ exerciseId: 'squat', sets }] } },
});

describe('programSignature', () => {
  it('mismo contenido → misma firma', () => {
    expect(programSignature(payload())).toBe(programSignature(payload()));
  });

  it('cambia un ejercicio → firma distinta', () => {
    expect(programSignature(payload(4))).not.toBe(programSignature(payload(3)));
  });

  it('cambiar solo exportDate no cambia la firma', () => {
    expect(programSignature(payload(3, '2027-01-01'))).toBe(programSignature(payload(3)));
  });
});
