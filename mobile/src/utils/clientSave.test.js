import { describe, it, expect } from 'vitest';
import { buildClientCard, buildClientPrograms, saveSig, applyClientCard, applyClientPrograms } from './clientSave';

const stage = (...tids) => ({ id: 'st', days: tids.map((t) => ({ sessionTemplateId: t })) });
const tpl = (id, exerciseId, extra = {}) => ({ id, exercises: [{ exerciseId }], ...extra });

function state() {
  return {
    clients: {
      ana: {
        id: 'ana', name: 'Ana', notes: 'rodilla', phone: '600', billing: [{ id: 'b1', amount: 40 }], bodyWeight: [{ date: '2026-10-01', kg: 60 }],
        status: 'active', color: '#abc', createdAt: '2026-09-01', activeProgramId: 'p2', tags: ['tag_1'],
        nextOverrides: { t2: { templateId: 't2' } },
        // Nada de esto va a la ficha guardada:
        slotId: 's1', slotOwner: 'u1', code: null, seated: false, leftAt: null, savedSig: 'viejo', programDirty: true, sendPending: { program: true },
      },
      berta: { id: 'berta', name: 'Berta', slotId: 's2', seated: false },
    },
    programs: {
      p1: { id: 'p1', owner: 'ana', kind: 'program', status: 'archived', stages: [stage('t1')] },
      p2: { id: 'p2', owner: 'ana', kind: 'program', status: 'active', stages: [stage('t2', 't3'), stage('t3')] },
      pb: { id: 'pb', owner: 'berta', kind: 'program', stages: [stage('tb')] },
      pm: { id: 'pm', owner: 'me', kind: 'template', stages: [stage('tm')] },
    },
    sessionTemplates: {
      t1: tpl('t1', 'ex_mia'), t2: tpl('t2', 'ex_lib'), t3: tpl('t3', 'ex_otra', { blocks: [{ movements: [{ exerciseId: 'ex_bloque' }] }] }),
      tb: tpl('tb', 'ex_berta'), tm: tpl('tm', 'ex_mia'),
      libre: tpl('libre', 'ex_libre', { owner: 'ana' }),
      libreBerta: tpl('libreBerta', 'ex_lib', { owner: 'berta' }),
    },
    customExercises: { ex_mia: { n: 1 }, ex_otra: { n: 2 }, ex_bloque: { n: 3 }, ex_libre: { n: 4 }, ex_berta: { n: 5 }, ex_ajena: { n: 6 } },
    clientLogs: { ana: [{ id: 'e1', updatedAt: 10 }, { id: 'e2' }] },
    tagRegistry: [{ id: 'tag_1', name: 'Rehab' }, { id: 'tag_2', name: 'Otra' }],
  };
}

const edit = (s, id, patch) => ({ ...s, clients: { ...s.clients, [id]: { ...s.clients[id], ...patch } } });

describe('buildClientCard', () => {
  it('lleva la ficha con las etiquetas por nombre y sus «cambios sin enviar», y nada de conexión, cola ni savedSig', () => {
    const card = buildClientCard(state(), 'ana');
    expect(card).toEqual({
      name: 'Ana', fullName: '', phone: '600', email: '', notes: 'rodilla', billing: [{ id: 'b1', amount: 40 }],
      bodyWeight: [{ date: '2026-10-01', kg: 60 }], status: 'active', color: '#abc', createdAt: '2026-09-01',
      activeProgramId: 'p2', nextOverrides: { t2: { templateId: 't2' } }, tags: [{ id: 'tag_1', name: 'Rehab' }],
      programDirty: true, overridesDirty: false,   // «Cambios sin enviar» sí viaja (N-06)
    });
    expect(Object.keys(card)).not.toContain('slotId');
    expect(Object.keys(card)).not.toContain('savedSig');
    expect(Object.keys(card)).not.toContain('sendPending');
  });
  it('un cliente que no existe da null', () => {
    expect(buildClientCard(state(), 'nadie')).toBeNull();
  });
});

describe('buildClientPrograms', () => {
  it('lleva los programas del cliente (activo y archivados), sus sesiones y solo los ejercicios propios que usan', () => {
    const pj = buildClientPrograms(state(), 'ana');
    expect(Object.keys(pj.programs).sort()).toEqual(['p1', 'p2']);
    expect(Object.keys(pj.sessionTemplates).sort()).toEqual(['libre', 't1', 't2', 't3']);
    expect(Object.keys(pj.customExercises).sort()).toEqual(['ex_bloque', 'ex_libre', 'ex_mia', 'ex_otra']);
  });
  it('sin programas, vacío', () => {
    expect(buildClientPrograms({ clients: { x: { id: 'x' } } }, 'x')).toEqual({ programs: {}, sessionTemplates: {}, customExercises: {} });
  });
});

describe('saveSig', () => {
  it('no cambia si nada cambia, ni con otro orden de claves', () => {
    const s = state();
    expect(saveSig(s, 'ana')).toBe(saveSig(state(), 'ana'));
    const reordered = { ...s, clients: { ana: Object.fromEntries(Object.entries(s.clients.ana).reverse()), berta: s.clients.berta } };
    expect(saveSig(reordered, 'ana')).toBe(saveSig(s, 'ana'));
  });
  it('no cambia con lo que no se guarda: conexión, cola de envíos ni lo de otro cliente', () => {
    const s = state();
    const sig = saveSig(s, 'ana');
    expect(saveSig(edit(s, 'ana', { savedSig: 'x', sendPending: undefined, code: 'ABCD', remoteSessionsCount: 3 }), 'ana')).toBe(sig);
    expect(saveSig(edit(s, 'berta', { notes: 'otra' }), 'ana')).toBe(sig);
  });
  it('cambia con «cambios sin enviar» (N-06)', () => {
    const s = state();
    expect(saveSig(edit(s, 'ana', { programDirty: false }), 'ana')).not.toBe(saveSig(s, 'ana'));
  });
  it('cambia con una nota', () => {
    const s = state();
    expect(saveSig(edit(s, 'ana', { notes: 'rodilla y hombro' }), 'ana')).not.toBe(saveSig(s, 'ana'));
  });
  it('cambia con una etiqueta renombrada', () => {
    const s = state();
    const renamed = { ...s, tagRegistry: s.tagRegistry.map((t) => (t.id === 'tag_1' ? { ...t, name: 'Rehabilitación' } : t)) };
    expect(saveSig(renamed, 'ana')).not.toBe(saveSig(s, 'ana'));
  });
  it('cambia con un programa editado (y con una sesión suya)', () => {
    const s = state();
    const prog = { ...s, programs: { ...s.programs, p2: { ...s.programs.p2, name: 'Nuevo' } } };
    expect(saveSig(prog, 'ana')).not.toBe(saveSig(s, 'ana'));
    const ses = { ...s, sessionTemplates: { ...s.sessionTemplates, t2: tpl('t2', 'ex_lib', { name: 'Pierna' }) } };
    expect(saveSig(ses, 'ana')).not.toBe(saveSig(s, 'ana'));
  });
  it('cambia con un entreno apuntado, o uno editado, mientras nadie esté dentro', () => {
    const s = state();
    const nuevo = { ...s, clientLogs: { ana: [...s.clientLogs.ana, { id: 'e3' }] } };
    expect(saveSig(nuevo, 'ana')).not.toBe(saveSig(s, 'ana'));
    const editado = { ...s, clientLogs: { ana: [{ id: 'e1', updatedAt: 11 }, s.clientLogs.ana[1]] } };
    expect(saveSig(editado, 'ana')).not.toBe(saveSig(s, 'ana'));
  });
  it('con alguien dentro lo apuntado no cuenta (no se sube)', () => {
    const s = edit(state(), 'ana', { seated: true });
    const nuevo = { ...s, clientLogs: { ana: [...s.clientLogs.ana, { id: 'e3' }] } };
    expect(saveSig(nuevo, 'ana')).toBe(saveSig(s, 'ana'));
  });
  it('un cliente que no existe da null', () => {
    expect(saveSig(state(), 'nadie')).toBeNull();
  });
});

describe('recuperar: applyClientCard + applyClientPrograms', () => {
  it('aplicar lo construido en un estado vacío y volver a construir da la misma firma', () => {
    const s = state();
    // Como viaja por el servidor: JSON.
    const card = JSON.parse(JSON.stringify(buildClientCard(s, 'ana')));
    const pj = JSON.parse(JSON.stringify(buildClientPrograms(s, 'ana')));

    let fresh = { clients: { ana: { id: 'ana', name: 'Cliente', seated: false } }, programs: {}, sessionTemplates: {}, customExercises: {}, tagRegistry: [], clientLogs: { ana: s.clientLogs.ana } };
    const { client, tagRegistry } = applyClientCard(fresh, 'ana', card);
    fresh = { ...fresh, clients: { ana: client }, tagRegistry, ...applyClientPrograms(fresh, pj) };

    expect(fresh.tagRegistry).toEqual([{ id: 'tag_1', name: 'Rehab' }]);
    expect(fresh.clients.ana.tags).toEqual(['tag_1']);
    expect(Object.keys(fresh.programs).sort()).toEqual(['p1', 'p2']);
    expect(saveSig(fresh, 'ana')).toBe(saveSig(s, 'ana'));
  });
  it('si un id ya existe en el móvil, se queda el del móvil (programas, sesiones, ejercicios y etiquetas)', () => {
    const pj = { programs: { p1: { id: 'p1', owner: 'ana', name: 'servidor' }, p9: { id: 'p9', owner: 'ana' } }, sessionTemplates: { t1: { id: 't1', n: 'servidor' } }, customExercises: { e: { n: 'servidor' } } };
    const s = { clients: { ana: { id: 'ana' } }, tagRegistry: [{ id: 'tag_1', name: 'Del móvil' }], programs: { p1: { id: 'p1', owner: 'ana', name: 'móvil' } }, sessionTemplates: { t1: { id: 't1', n: 'móvil' } }, customExercises: { e: { n: 'móvil' } } };
    const out = applyClientPrograms(s, pj);
    expect(out.programs.p1.name).toBe('móvil');
    expect(out.programs.p9).toBeDefined();
    expect(out.sessionTemplates.t1.n).toBe('móvil');
    expect(out.customExercises.e.n).toBe('móvil');
    const card = applyClientCard(s, 'ana', { name: 'Ana', tags: [{ id: 'tag_1', name: 'Del servidor' }, { id: 'tag_2', name: 'Nueva' }] });
    expect(card.tagRegistry).toEqual([{ id: 'tag_1', name: 'Del móvil' }, { id: 'tag_2', name: 'Nueva' }]);
    expect(card.client.tags).toEqual(['tag_1', 'tag_2']);
  });
  it('programs_json null (hueco sin programas) no rompe', () => {
    const s = { programs: { a: 1 }, sessionTemplates: {}, customExercises: {} };
    expect(applyClientPrograms(s, null)).toEqual(s);
  });
});
