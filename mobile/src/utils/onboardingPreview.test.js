import { describe, it, expect } from 'vitest';
import { previewSessions, learnCards } from './onboardingPreview';

const program = {
  stages: [{ days: [
    { sessionTemplateId: 'a', label: 'A' },
    { sessionTemplateId: 'x' },            // plantilla borrada: se salta
    { sessionTemplateId: 'b' },            // sin letra: la de su hueco
  ] }],
};
const templates = {
  a: { name: 'Empuje', exercises: [] },
  b: { name: 'Tracción', exercises: [] },
};

describe('previewSessions', () => {
  it('saca nombre y letra de las sesiones de la primera etapa, saltando las que no existen', () => {
    const out = previewSessions(program, templates);
    expect(out.map((s) => [s.marker, s.name])).toEqual([['A', 'Empuje'], ['C', 'Tracción']]);
  });

  it('respeta el máximo', () => {
    expect(previewSessions(program, templates, {}, 1)).toHaveLength(1);
  });

  it('sin programa no hay sesiones', () => {
    expect(previewSessions(null, templates)).toEqual([]);
  });
});

describe('learnCards', () => {
  it('por mi cuenta: hoy, cambiar y libre', () => {
    expect(learnCards({ role: 'self' })).toEqual(['today', 'edit', 'free']);
  });

  it('con entrenador sin conectar sigue pudiendo editar', () => {
    expect(learnCards({ role: 'coached', linked: null })).toEqual(['today', 'edit', 'free']);
  });

  it('con entrenador conectado no sale «Cambia lo que quieras»: sale que él ve los entrenos', () => {
    const cards = learnCards({ role: 'coached', linked: { trainerName: 'Marta', programName: 'P' } });
    expect(cards).toEqual(['today', 'sees', 'free']);
    expect(cards).not.toContain('edit');
  });

  it('entrenador que también entrena: sus clientes primero', () => {
    expect(learnCards({ role: 'trainer', alsoTrains: true })).toEqual(['clients', 'today', 'edit', 'free']);
  });

  it('entrenador que no entrena: sus tres, y una cuarta solo si le apunta él', () => {
    expect(learnCards({ role: 'trainer', alsoTrains: false, clientMode: 'app' })).toEqual(['clients', 'templates', 'next']);
    expect(learnCards({ role: 'trainer', alsoTrains: false, clientMode: 'self' })).toEqual(['clients', 'templates', 'next', 'log']);
  });
});
