import { describe, it, expect, vi, beforeEach } from 'vitest';

// `react-native` es el stub de vitest (ver vite.config.js): aquí solo hace falta `Share`.
const share = vi.hoisted(() => vi.fn());
vi.mock('react-native', () => ({ Share: { share, sharedAction: 'sharedAction', dismissedAction: 'dismissedAction' } }));

import { shareAndContinue } from './shareAndContinue';

describe('shareAndContinue', () => {
  beforeEach(() => { share.mockReset(); });

  it('avanza si se compartió', async () => {
    share.mockResolvedValue({ action: 'sharedAction' });
    const next = vi.fn();
    await shareAndContinue('hola', next);
    expect(share).toHaveBeenCalledWith({ message: 'hola' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('se queda si se cerró la hoja sin compartir (iOS)', async () => {
    share.mockResolvedValue({ action: 'dismissedAction' });
    const next = vi.fn();
    await shareAndContinue('hola', next);
    expect(next).not.toHaveBeenCalled();
  });

  it('se queda si la hoja no se pudo abrir', async () => {
    share.mockRejectedValue(new Error('x'));
    const next = vi.fn();
    await shareAndContinue('hola', next);
    expect(next).not.toHaveBeenCalled();
  });
});
