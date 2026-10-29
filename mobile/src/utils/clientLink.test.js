import { describe, it, expect } from 'vitest';
import {
  linkOf, withApp, canSend, canSave, isReadOnly, clientLink, hasSlot,
  slotFacts, codeGiven, moveOwner, migrateClientLinks, assertFacts,
  CODE_CLEARED, NO_SLOT, SLOT_LOST, SEATED,
} from './clientLink';

const U = 'user_1';
const base = { id: 'c', name: 'Ana' };
const fichas = {
  local:    { ...base, ...NO_SLOT },
  none:     { ...base, ...slotFacts({ id: 's1' }, U) },
  invited:  { ...base, ...slotFacts({ id: 's1', client_code: 'K7QM-4XPA' }, U) },
  linked:   { ...base, ...slotFacts({ id: 's1', client_code: 'K7QM-4XPA', client_id: 'u9' }, U) },
  left:     { ...base, ...slotFacts({ id: 's1', client_code: 'K7QM-4XPA', disconnected_at: '2026-10-20T10:00:00Z' }, U) },
};

describe('linkOf — el estado se calcula de los hechos (C10 §3.2)', () => {
  it('una ficha de cada valor, en la cuenta que es suya', () => {
    expect(linkOf(fichas.local, U)).toBe('local');
    expect(linkOf(fichas.none, U)).toBe('none');
    expect(linkOf(fichas.invited, U)).toBe('invited');
    expect(linkOf(fichas.linked, U)).toBe('linked');
    expect(linkOf(fichas.left, U)).toBe('left');
    expect(linkOf({ ...fichas.invited, ...SLOT_LOST }, U)).toBe('otherAccount');
  });

  it('con otra cuenta, o sin cuenta, toda ficha con hueco es de otra cuenta; la sin hueco sigue local', () => {
    for (const noUser of ['user_2', null, undefined]) {
      expect(linkOf(fichas.local, noUser)).toBe('local');
      for (const k of ['none', 'invited', 'linked', 'left']) expect(linkOf(fichas[k], noUser)).toBe('otherAccount');
    }
  });

  it('una ficha vacía o sin hechos es local', () => {
    expect(linkOf({ id: 'c' }, U)).toBe('local');
    expect(linkOf(undefined, U)).toBe('local');
  });

  it('las lecturas: withApp, canSend, canSave, isReadOnly', () => {
    const all = ['local', 'none', 'invited', 'linked', 'left', 'otherAccount'];
    expect(all.filter(withApp)).toEqual(['invited', 'linked', 'left']);
    expect(all.filter(canSend)).toEqual(['invited', 'linked', 'left']);
    expect(all.filter(canSave)).toEqual(['none', 'invited', 'linked', 'left']);
    expect(all.filter(isReadOnly)).toEqual(['otherAccount']);
  });

  it('clientLink (la lectura de las pantallas): none · invited · linked', () => {
    const ts = { mode: 'code', userId: U };
    expect(clientLink(fichas.local, ts)).toBe('none');
    expect(clientLink(fichas.none, ts)).toBe('none');
    expect(clientLink(fichas.invited, ts)).toBe('invited');
    expect(clientLink(fichas.left, ts)).toBe('invited');
    expect(clientLink(fichas.linked, ts)).toBe('linked');
    expect(clientLink(fichas.linked, { mode: 'offline', userId: null })).toBe('none');
    expect(clientLink(fichas.linked, { mode: 'code', userId: 'otra' })).toBe('none');
    expect(clientLink(fichas.linked, undefined)).toBe('none');
  });

  it('hasSlot: hueco en una cuenta que conocemos', () => {
    expect(hasSlot(fichas.invited)).toBe(true);
    expect(hasSlot({ ...fichas.invited, ...SLOT_LOST })).toBe(false);
    expect(hasSlot(fichas.local)).toBe(false);
  });
});

describe('escritores — cada uno deja hechos que no se contradicen', () => {
  const apply = (c, facts) => { const out = { ...c, ...facts }; assertFacts(out); return out; };

  it('slotFacts acepta una fila parcial del servidor y la completa', () => {
    expect(apply(base, slotFacts({ id: 's1', client_code: 'AB' }, U))).toMatchObject({ slotId: 's1', slotOwner: U, code: 'AB', seated: false, leftAt: null });
    expect(apply(base, slotFacts({ id: 's1', client_code: 'AB', client_id: 'x', disconnected_at: '2026-10-20T10:00:00Z' }, U)))
      .toMatchObject({ seated: true, leftAt: null });   // sentado: lo de «se fue» no cuenta
    expect(apply(base, slotFacts({ id: 's1', client_code: 'AB', client_id: null, disconnected_at: '2026-10-20T10:00:00Z' }, U)))
      .toMatchObject({ seated: false, leftAt: '2026-10-20T10:00:00Z' });
    expect(apply(base, slotFacts({ id: 's1', client_code: null }, U)).code).toBeNull();
  });

  it('codeGiven, CODE_CLEARED, NO_SLOT, SLOT_LOST, SEATED desde cualquier estado', () => {
    for (const c of Object.values(fichas)) {
      if (c.slotId) {
        expect(linkOf(apply(c, codeGiven('NUEVO')), U)).toBe('invited');
        expect(apply(c, codeGiven('NUEVO')).code).toBe('NUEVO');
        expect(linkOf(apply(c, CODE_CLEARED), U)).toBe('none');
        expect(linkOf(apply(c, SLOT_LOST), U)).toBe('otherAccount');
      }
      expect(linkOf(apply(c, NO_SLOT), U)).toBe('local');
    }
    expect(linkOf(apply(fichas.invited, SEATED), U)).toBe('linked');
    expect(linkOf(apply(fichas.left, SEATED), U)).toBe('linked');
  });

  it('assertFacts lanza si se contradicen', () => {
    expect(() => assertFacts({ ...base, ...NO_SLOT, code: 'AB' })).toThrow();
    expect(() => assertFacts({ ...base, ...NO_SLOT, slotOwner: U })).toThrow();
    expect(() => assertFacts({ ...fichas.none, seated: true })).toThrow();                    // sentado sin código
    expect(() => assertFacts({ ...fichas.linked, leftAt: '2026-10-20T10:00:00Z' })).toThrow();   // se fue estando dentro
    expect(() => assertFacts({ id: 'c' })).toThrow();                                           // sin hechos
  });
});

describe('moveOwner — entrar en otra cuenta traspasa los huecos (C10 §3.2)', () => {
  it('solo cambia las fichas de la cuenta que se va; las demás, igual', () => {
    const clients = {
      a: fichas.invited,
      b: { ...fichas.linked, id: 'b' },
      c: { ...fichas.invited, id: 'c', ...slotFacts({ id: 's9', client_code: 'X' }, 'otra') },
      d: { ...fichas.local, id: 'd' },
    };
    const out = moveOwner(clients, U, 'user_2');
    expect(out.a.slotOwner).toBe('user_2');
    expect(out.b.slotOwner).toBe('user_2');
    expect(out.c).toBe(clients.c);
    expect(out.d).toBe(clients.d);
    Object.values(out).forEach(assertFacts);
    expect(linkOf(out.a, 'user_2')).toBe('invited');
    expect(linkOf(out.b, 'user_2')).toBe('linked');
    expect(linkOf(out.a, U)).toBe('otherAccount');
  });

  it('sin cambio devuelve el mismo objeto', () => {
    const clients = { a: fichas.local };
    expect(moveOwner(clients, U, 'user_2')).toBe(clients);
    expect(moveOwner(clients, null, 'user_2')).toBe(clients);
    expect(moveOwner(clients, U, U)).toBe(clients);
  });
});

// ── Migración (C10 §4.1) ─────────────────────────────────────────────────────

/** La lectura de antes de C10-01, tal cual, para comprobar que no cambia lo que se enseña. */
function clientLinkAntes(client, trainerSync) {
  if (!client?.syncSlotId || client.syncOrphan) return 'none';
  const mode = trainerSync?.mode;
  if (!mode || mode === 'offline') return 'none';
  return client.syncLinked ? 'linked' : 'invited';
}

// Fichas como las guardaba la versión anterior (formas de connection.sim / sync.audit.sim).
const viejo = {
  base: { name: 'Ana', createdAt: '2026-10-01', activeProgramId: null, fullName: '', phone: '', email: '', notes: '', bodyWeight: [], billing: [], status: 'active', color: 'var(--c1)' },
  sinApp:        (id) => ({ id, ...viejo.base, syncCode: null, syncSlotId: null }),
  sinAppTrasCancelar: (id) => ({ id, ...viejo.base, syncSlotId: null, syncCode: null, syncLinked: false, syncOrphan: false, programDirty: false, overridesDirty: false, programUploadedSig: null, remoteSessionsCount: 0 }),
  invitado:      (id) => ({ id, ...viejo.base, syncCode: 'K7QM-4XPA', syncSlotId: 'slot_1' }),
  invitadoRefrescado: (id) => ({ id, ...viejo.base, syncSlotId: 'slot_1', syncCode: 'K7QM-4XPA', syncOrphan: false, remoteSessionsCount: 0, syncLinked: false, syncLeftAt: null }),
  conectado:     (id) => ({ id, ...viejo.base, syncSlotId: 'slot_1', syncCode: 'K7QM-4XPA', syncOrphan: false, remoteSessionsCount: 2, syncLinked: true, syncLeftAt: null }),
  seFue:         (id) => ({ id, ...viejo.base, syncSlotId: 'slot_1', syncCode: 'K7QM-4XPA', syncOrphan: false, syncLinked: false, syncLeftAt: '2026-10-20T10:00:00.000Z' }),
  deOtraCuenta:  (id) => ({ id, ...viejo.base, syncSlotId: 'slot_1', syncCode: 'K7QM-4XPA', syncOrphan: true, syncLinked: false }),
  conAltaEnVuelo: (id) => ({ id, ...viejo.base, syncSlotId: null, syncCode: null, syncPending: true }),
  // recuperada por el refresco: nace con el hueco y esa misma pasada le pone el resto
  recuperado:    (id) => ({ id, ...viejo.base, syncSlotId: 'slot_2', syncCode: 'AB12-CD34', syncOrphan: false, remoteSessionsCount: 0, syncLinked: false, syncLeftAt: null, programMissing: true }),
};
const OLD_FLAGS = ['syncSlotId', 'syncCode', 'syncLinked', 'syncOrphan', 'syncLeftAt', 'syncPending'];

describe('migrateClientLinks — banderas de antes → hechos (C10 §4.1)', () => {
  const dentro = { mode: 'code', userId: U, code: 'X' };
  const fuera  = { mode: 'offline', userId: null, code: null };
  const clients = Object.fromEntries(Object.entries(viejo).filter(([k]) => k !== 'base').map(([k, mk]) => [k, mk(k)]));

  it('con la cuenta puesta: cada ficha se lee igual que la versión de antes', () => {
    const out = migrateClientLinks(clients, dentro);
    for (const [k, c] of Object.entries(out)) {
      assertFacts(c);
      expect(OLD_FLAGS.filter((f) => f in c), k).toEqual([]);
      expect(clientLink(c, dentro), k).toBe(clientLinkAntes(clients[k], dentro));
    }
    expect(linkOf(out.sinApp, U)).toBe('local');
    expect(linkOf(out.sinAppTrasCancelar, U)).toBe('local');
    expect(linkOf(out.invitado, U)).toBe('invited');
    expect(linkOf(out.invitadoRefrescado, U)).toBe('invited');
    expect(linkOf(out.conectado, U)).toBe('linked');
    expect(linkOf(out.seFue, U)).toBe('left');
    expect(linkOf(out.deOtraCuenta, U)).toBe('otherAccount');
    expect(linkOf(out.conAltaEnVuelo, U)).toBe('local');       // la reserva no se persiste
    expect(linkOf(out.recuperado, U)).toBe('invited');
    expect(out.invitado.code).toBe('K7QM-4XPA');
    expect(out.seFue.leftAt).toBe('2026-10-20T10:00:00.000Z');
  });

  it('con la cuenta sin userId (salió): las que tenían hueco son de otra cuenta, las demás locales', () => {
    const out = migrateClientLinks(clients, fuera);
    for (const [k, c] of Object.entries(out)) {
      assertFacts(c);
      expect(linkOf(c, null), k).toBe(clients[k].syncSlotId ? 'otherAccount' : 'local');
      expect(clientLink(c, fuera), k).toBe(clientLinkAntes(clients[k], fuera));
    }
    // ...y volver a entrar en la misma cuenta, tras el refresco, las devolverá; aquí no hay de quién fiarse.
    expect(out.invitado.slotOwner).toBeNull();
  });

  it('no cambia nada más de la ficha', () => {
    const out = migrateClientLinks(clients, dentro);
    expect(out.recuperado).toMatchObject({ programMissing: true, name: 'Ana', color: 'var(--c1)' });
    expect(out.conectado.remoteSessionsCount).toBe(2);
    expect(out.sinAppTrasCancelar).toMatchObject({ programDirty: false, remoteSessionsCount: 0 });
  });

  it('es idempotente: lo ya migrado no se toca, y migrar dos veces da lo mismo', () => {
    const once = migrateClientLinks(clients, dentro);
    expect(migrateClientLinks(once, dentro)).toBe(once);
    expect(migrateClientLinks(once, fuera)).toBe(once);
    expect(migrateClientLinks(migrateClientLinks(clients, dentro), dentro)).toEqual(once);
  });

  it('no muta la entrada y acepta vacío', () => {
    const copia = JSON.parse(JSON.stringify(clients));
    migrateClientLinks(clients, dentro);
    expect(clients).toEqual(copia);
    expect(migrateClientLinks(undefined, dentro)).toBeUndefined();
    expect(migrateClientLinks({}, dentro)).toEqual({});
  });
});
