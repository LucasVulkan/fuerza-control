import { describe, it, expect } from 'vitest';
import { parseInviteUrl, inviteUrl } from './web';

describe('parseInviteUrl (M01-04)', () => {
  it('normaliza el código al formato de la app', () => {
    expect(parseInviteUrl('forma://join/XK7M-2P4T')).toBe('XK7M-2P4T');
    expect(parseInviteUrl('forma://join/xk7m2p4t')).toBe('XK7M-2P4T');
    expect(parseInviteUrl('FORMA://join/xk7m2p4t?x=1')).toBe('XK7M-2P4T');
  });
  it('invitación con código raro: null (se ignora)', () => {
    expect(parseInviteUrl('forma://join/ABC')).toBeNull();
    expect(parseInviteUrl('forma://join/')).toBeNull();
  });
  it('lo que no es invitación: undefined (sigue al filtro de ficheros)', () => {
    expect(parseInviteUrl('content://media/backup.fitdata')).toBeUndefined();
    expect(parseInviteUrl('forma://otra/cosa')).toBeUndefined();
    expect(parseInviteUrl(null)).toBeUndefined();
  });
  it('el enlace de invitar lleva el código', () => {
    expect(inviteUrl('XK7M-2P4T')).toBe('https://formafit-pro.github.io/join/?c=XK7M-2P4T');
  });
});
