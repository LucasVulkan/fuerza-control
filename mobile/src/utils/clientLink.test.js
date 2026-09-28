import { describe, it, expect } from 'vitest';
import { clientLink } from './clientLink';

describe('clientLink — C28', () => {
  const cloud = { mode: 'code' };

  it('sin código es sin app', () => {
    expect(clientLink({ id: 'c' }, cloud)).toBe('none');
  });

  it('con código sin canjear es invitado, y canjeado es con app', () => {
    expect(clientLink({ syncSlotId: 's' }, cloud)).toBe('invited');
    expect(clientLink({ syncSlotId: 's', syncLinked: true }, cloud)).toBe('linked');
  });

  it('con el entrenador sin nube no viaja nada: todos sin app', () => {
    expect(clientLink({ syncSlotId: 's', syncLinked: true }, { mode: 'offline' })).toBe('none');
    expect(clientLink({ syncSlotId: 's' }, { mode: null })).toBe('none');
  });
});
