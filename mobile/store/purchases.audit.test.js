/**
 * I02-05 — auditoría de compra, restauración e identidad contra un doble de
 * react-native-purchases (`_getRC`).
 *
 * Formato: cada hallazgo que VIOLA una regla fija el comportamiento ACTUAL
 * («hoy:») y pasa hoy; al arreglarlo el test se pone rojo y se invierte (la
 * regla va en el nombre). Lo que ya cumple la regla la afirma tal cual. Antes
 * de la aserción final cada «hoy:» comprueba que el montaje funcionó, para que
 * un verde no venga de un montaje roto.
 *
 * Los `vi.mock` son los de `useStore.test.js`: se elevan por fichero.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RC_PRO_ENTITLEMENT } from '../src/config/revenuecat';
import { BACKUP_STORAGE_KEY, buildBackupPayload } from '../src/utils/backupPayload';
import { freeGates, needsClientChoice } from '../src/utils/freePlan';

const syncMock = {
  getTrainerSlots: vi.fn(async () => []),
  createClientSlot: vi.fn(), uploadProgram: vi.fn(), uploadTrainerLog: vi.fn(), downloadHistory: vi.fn(),
  downloadSlotProgram: vi.fn(async () => null), uploadOverrides: vi.fn(), deleteClientSlot: vi.fn(async () => true),
  updateTrainerNameForSlots: vi.fn(async () => 0), reissueClientCode: vi.fn(), transferMySlotsTo: vi.fn(async () => 0),
  getSlotByClientCode: vi.fn(), linkClientToSlot: vi.fn(), seatOf: vi.fn(), uploadHistory: vi.fn(),
  releaseClientSlot: vi.fn(async () => 0), transferMySeatTo: vi.fn(),
};
vi.mock('../src/services/supabaseSync', () => syncMock);

const authMock = {
  trainerCandidateFromIdToken: vi.fn(), trainerCandidateFromCode: vi.fn(), trainerCandidateNewCode: vi.fn(),
  adoptTrainer: vi.fn(async () => {}),
  trainerSessionUserId: vi.fn(async () => useStore.getState().trainerSync.userId),
  signInTrainerWithCode: vi.fn(), signOutTrainer: vi.fn(async () => {}),
  ensureClientSession: vi.fn(async () => 'anon_1'), clientSessionUserId: vi.fn(async () => 'anon_1'), clientProvider: vi.fn(async () => null),
  clientCandidateFromIdToken: vi.fn(), adoptClient: vi.fn(), signOutClient: vi.fn(async () => {}),
  deleteTrainerUser: vi.fn(), deleteClientUser: vi.fn(),
};
vi.mock('../src/services/supabaseAuth', () => authMock);

vi.mock('../src/config/supabase', () => ({ migrateLegacySession: async () => {} }));

const { useStore } = await import('./useStore.js');
const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

const DAY = 86_400_000;
const T0  = Date.parse('2026-10-01T10:00:00Z');

const info = ({ pro = false, lifetime = false, store = 'PLAY_STORE', at = Date.now(), expiresIn = 365 } = {}) => ({
  entitlements: { active: pro ? { [RC_PRO_ENTITLEMENT]: {
    identifier: RC_PRO_ENTITLEMENT, isActive: true, store,
    expirationDate: lifetime ? null : new Date(at + expiresIn * DAY).toISOString(),
  } } : {} },
  requestDate: new Date(at).toISOString(), managementURL: null,
});
// Forma real del SDK 10.14 (errorNormalizer.js): `code` numérico en string,
// `userCancelled` = (code === '1').
const rcError = (code, message) => Object.assign(new Error(message), { code, userCancelled: code === '1' });

/** Compras por usuario de RevenueCat y un recibo de la tienda que «restaurar» mueve. */
function makeRC({ user = '$RCAnonymousID:1', owners = {}, receipt = null } = {}) {
  const rc = { user, owners, receipt };
  // Cada respuesta del servidor trae un requestDate nuevo (E46: manda la más nueva); `tick` evita empates en el
  // mismo ms y los 10 s de margen, que el reloj del móvil no quede por debajo de la confirmación
  let tick = 0;
  const of = (id) => ({ ...(rc.owners[id] ?? info()), requestDate: new Date(Date.now() - 10_000 + ++tick).toISOString() });
  return Object.assign(rc, {
    PURCHASES_ERROR_CODE: { PRODUCT_ALREADY_PURCHASED_ERROR: '6', PAYMENT_PENDING_ERROR: '20', LOG_OUT_ANONYMOUS_USER_ERROR: '22' },
    isConfigured:     vi.fn(async () => true),
    getAppUserID:     vi.fn(async () => rc.user),
    getCustomerInfo:  vi.fn(async () => of(rc.user)),
    logIn:            vi.fn(async (id) => { rc.user = id; return { customerInfo: of(id), created: !rc.owners[id] }; }),
    logOut:           vi.fn(async () => {
      if (rc.user.startsWith('$RC')) throw rcError('22', 'LogOut was called but the current user is anonymous.');
      rc.user = '$RCAnonymousID:2'; return of(rc.user);
    }),
    restorePurchases: vi.fn(async () => {
      if (rc.receipt && rc.receipt !== rc.user) { rc.owners[rc.user] = rc.owners[rc.receipt]; delete rc.owners[rc.receipt]; rc.receipt = rc.user; }
      return of(rc.user);
    }),
    purchasePackage:  vi.fn(async () => { rc.owners[rc.user] = info({ pro: true }); rc.receipt = rc.user; return { customerInfo: of(rc.user) }; }),
  });
}

const isPro  = () => useStore.getState().profile.isPro;
const setPro = (v) => useStore.setState((s) => ({ profile: { ...s.profile, isPro: v } }));
let RC;
let getRC;
const useRC = (opts) => { RC = makeRC(opts); useStore.setState({ _getRC: () => RC }); return RC; };

describe('I02-05 — compra, restauración e identidad (doble de react-native-purchases)', () => {
  let saved;
  beforeEach(() => {
    vi.clearAllMocks();
    getRC = useStore.getState()._getRC;
    const s = useStore.getState();
    saved = { profile: s.profile, trainerSync: s.trainerSync, clients: s.clients, programs: s.programs, sessionTemplates: s.sessionTemplates, workoutLog: s.workoutLog };
    setPro(false);
  });
  afterEach(() => {
    useStore.setState({ _getRC: getRC, ...saved });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── F: compra ──
  it('F2 (cumple R-F2): cancelada no cambia nada, no es un error y no restaura', async () => {
    useRC();
    RC.purchasePackage.mockRejectedValueOnce(rcError('1', 'Purchase was cancelled.'));
    expect(await useStore.getState().purchasePackage({ identifier: '$rc_annual' })).toEqual({ ok: false, cancelled: true });
    expect(RC.purchasePackage).toHaveBeenCalledTimes(1);
    expect(isPro()).toBe(false);
    expect(RC.restorePurchases).not.toHaveBeenCalled();
  });

  it('F3 arreglado (E44, R-F3): «ya comprado» (code "6") restaura y devuelve {ok:true,isPro:true}', async () => {
    useRC({ owners: { '$RCAnonymousID:viejo': info({ pro: true, lifetime: true }) }, receipt: '$RCAnonymousID:viejo' });
    RC.purchasePackage.mockRejectedValueOnce(rcError('6', 'This product is already active for the user.'));
    const r = await useStore.getState().purchasePackage({ identifier: '$rc_lifetime' });
    expect(RC.purchasePackage).toHaveBeenCalledTimes(1);
    expect(RC.restorePurchases).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ ok: true, isPro: true });
    expect(isPro()).toBe(true);
  });

  it('F3b (E44): «ya comprado» y al restaurar no aparece el PRO devuelve {ok:false,error}, nunca ok:true', async () => {
    useRC();
    RC.purchasePackage.mockRejectedValueOnce(rcError('6', 'This product is already active for the user.'));
    const r = await useStore.getState().purchasePackage({ identifier: '$rc_lifetime' });
    expect(RC.restorePurchases).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ ok: false, error: 'This product is already active for the user.' });
    expect(isPro()).toBe(false);
  });

  it('F1 (cumple R-F1): la compra confirmada con PRO en la respuesta deja el móvil en PRO', async () => {
    useRC();
    RC.purchasePackage.mockResolvedValueOnce({ customerInfo: info({ pro: true }) });
    expect(await useStore.getState().purchasePackage({ identifier: '$rc_annual' })).toEqual({ ok: true, isPro: true });
    expect(isPro()).toBe(true);
  });

  it('F1b arreglado (E47, R-F1): cobrada y sin PRO en la respuesta devuelve {ok:false,pending:true}, sin segunda mirada ni «hecho»', async () => {
    useRC();
    RC.purchasePackage.mockResolvedValueOnce({ customerInfo: info() });
    expect(await useStore.getState().purchasePackage({ identifier: '$rc_annual' })).toEqual({ ok: false, pending: true });
    expect(RC.getCustomerInfo).not.toHaveBeenCalled();
    expect(isPro()).toBe(false);
  });

  it('F1c (E47): PAYMENT_PENDING_ERROR (code "20") devuelve {ok:false,pending:true}', async () => {
    useRC();
    RC.purchasePackage.mockRejectedValueOnce(rcError('20', 'Payment is pending.'));
    expect(await useStore.getState().purchasePackage({ identifier: '$rc_annual' })).toEqual({ ok: false, pending: true });
    expect(isPro()).toBe(false);
  });

  // ── D2: cambiar de forma de entrar ──
  it('D2-a arreglado (E45-a, R-D2): A→B con restore que falla deja la marca «PRO por traspasar» y el siguiente arranque reintenta en silencio', async () => {
    useRC({ user: 'uuid-A', owners: { 'uuid-A': info({ pro: true }) }, receipt: 'uuid-A' });
    setPro(true);
    RC.restorePurchases.mockRejectedValueOnce(rcError('10', 'Error performing request.'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await useStore.getState().syncPurchaserId('uuid-B', { switched: true });
    // montaje: entró B, se intentó restaurar una sola vez, la compra sigue en A
    expect(RC.logIn).toHaveBeenCalledWith('uuid-B');
    expect(RC.restorePurchases).toHaveBeenCalledTimes(1);
    expect(RC.user).toBe('uuid-B');
    expect(RC.owners['uuid-A']).toBeTruthy();
    expect(RC.receipt).toBe('uuid-A');
    expect(useStore.getState().profile).toMatchObject({ proTransferFrom: 'uuid-A', proTransferTries: 1 });
    // el arranque siguiente (App.js: configure con B + checkProStatus + reintento silencioso)
    expect(await useStore.getState().checkProStatus()).toBe(false);
    expect(useStore.getState().profile.proTransferFrom).toBe('uuid-A');   // sigue pendiente
    const toast = vi.spyOn(useStore.getState(), 'showToast');
    expect(await useStore.getState().restorePurchases({ silent: true })).toBe(true);
    expect(toast).not.toHaveBeenCalled();
    expect(RC.owners['uuid-B']).toBeTruthy();
    expect(isPro()).toBe(true);
    expect(useStore.getState().profile).toMatchObject({ proTransferFrom: null, proTransferTries: 0 });
  });

  it('D2-b arreglado (E45-b, R-D2): A→B con logIn que falla deja la marca antes del logIn y el arranque siguiente recupera el PRO restaurando', async () => {
    useRC({ user: 'uuid-A', owners: { 'uuid-A': info({ pro: true }) }, receipt: 'uuid-A' });
    setPro(true);
    RC.logIn.mockRejectedValueOnce(rcError('10', 'Error performing request.'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await useStore.getState().syncPurchaserId('uuid-B', { switched: true });
    // montaje: logIn se intentó y falló; RC sigue en A con su PRO; no hubo restore
    expect(RC.logIn).toHaveBeenCalledWith('uuid-B');
    expect(RC.user).toBe('uuid-A');
    expect(RC.restorePurchases).not.toHaveBeenCalled();
    expect(isPro()).toBe(true);
    expect(useStore.getState().profile.proTransferFrom).toBe('uuid-A');
    RC.user = 'uuid-B';                                     // App.js:185-186 configura ya con trainerSync.userId = B
    expect(await useStore.getState().checkProStatus()).toBe(false);
    expect(await useStore.getState().restorePurchases({ silent: true })).toBe(true);
    expect(isPro()).toBe(true);
    expect(useStore.getState().profile.proTransferFrom).toBeNull();
  });

  it('D2-c arreglado (E45-c, R-D2): el checkProStatus del arranque que resuelve tarde no pisa el true del logIn', async () => {
    useRC({ owners: { 'uuid-A': info({ pro: true }) } });   // arranca anónimo (instalación limpia)
    let late;
    RC.getCustomerInfo.mockImplementationOnce(() => new Promise((r) => { late = r; }));
    const boot = useStore.getState().checkProStatus();      // App.js:187, sin await
    await useStore.getState().syncPurchaserId('uuid-A', { switched: true });   // «Ya tengo cuenta»
    // montaje: el logIn dio PRO y el arranque sigue colgado
    expect(RC.logIn).toHaveBeenCalledWith('uuid-A');
    expect(late).toBeTypeOf('function');
    expect(isPro()).toBe(true);
    late(info({ at: Date.now() - 60_000 }));                // llega la respuesta del anónimo, de antes del logIn
    await boot;
    expect(isPro()).toBe(true);                             // E45-c: la respuesta vieja no pisa a la nueva
  });

  it('D2-d conocido (E45-d): PRO regalado (PROMOTIONAL) en A → B se pierde: restore no mueve regalos (regla R-D2: no se pierde)', async () => {
    useRC({ user: 'uuid-A', owners: { 'uuid-A': info({ pro: true, store: 'PROMOTIONAL' }) }, receipt: null });
    setPro(true);
    await useStore.getState().syncPurchaserId('uuid-B', { switched: true });
    // montaje: se intentó restaurar y el regalo sigue en A
    expect(RC.logIn).toHaveBeenCalledWith('uuid-B');
    expect(RC.restorePurchases).toHaveBeenCalledTimes(1);
    expect(RC.owners['uuid-A']).toBeTruthy();
    // conocido (E45-d): restaurar no lo arregla, hace falta que la cuenta no cambie de id (I02 §7)
    expect(RC.owners['uuid-B']).toBeUndefined();
    expect(isPro()).toBe(false);
  });

  it('D2 (cumple): A→B con compra de tienda mueve el recibo a B y A→B→A lo devuelve (ida y vuelta sin perder el PRO)', async () => {
    useRC({ user: 'uuid-A', owners: { 'uuid-A': info({ pro: true }) }, receipt: 'uuid-A' });
    setPro(true);
    await useStore.getState().syncPurchaserId('uuid-B', { switched: true });
    expect(isPro()).toBe(true);
    expect(RC.owners['uuid-A']).toBeUndefined();            // A queda sin PRO: el PRO sigue al móvil que restaura
    await useStore.getState().syncPurchaserId('uuid-A', { switched: true });
    expect(isPro()).toBe(true);
    expect(RC.owners['uuid-A']).toBeTruthy();
    expect(RC.restorePurchases).toHaveBeenCalledTimes(2);
  });

  // ── D3: borrar la cuenta sale de RevenueCat ──
  const deleteSetup = () => {
    useRC({ user: 'uuid-A', owners: { 'uuid-A': info({ pro: true }) }, receipt: 'uuid-A' });
    setPro(true);
    useStore.setState((s) => ({ trainerSync: { ...s.trainerSync, mode: 'code', code: 'AAAA-AAAA-AAAA', userId: 'uuid-A' } }));
    authMock.trainerSessionUserId.mockImplementation(async () => useStore.getState().trainerSync.userId);
  };

  it('D3 (cumple): borrar la cuenta con logOut correcto deja el móvil sin el PRO de la cuenta borrada', async () => {
    deleteSetup();
    await useStore.getState().deleteAccount();
    expect(RC.logOut).toHaveBeenCalledTimes(1);
    expect(authMock.deleteTrainerUser).toHaveBeenCalledTimes(1);
    expect(isPro()).toBe(false);
  });

  it('D3-b arreglado (E48, R-D3): borrar la cuenta con logOut caído por red deja el móvil en gratis aunque RevenueCat siga en la cuenta', async () => {
    deleteSetup();
    RC.logOut.mockRejectedValueOnce(rcError('10', 'Error performing request.'));
    const r = await useStore.getState().deleteAccount();
    // montaje: la cuenta se borró de verdad en el servidor y se intentó el logOut
    expect(authMock.deleteTrainerUser).toHaveBeenCalledTimes(1);
    expect(RC.logOut).toHaveBeenCalledTimes(1);
    expect(useStore.getState().trainerSync.userId).toBeNull();
    expect(r).toEqual({ ok: true });
    expect(RC.user).toBe('uuid-A');
    expect(isPro()).toBe(false);
  });

  // ── E5: días sin red ──
  describe('E5 — días sin red', () => {
    // La suscripción de estos casos acaba en la confirmación (expiresIn: 0): sin red cuentan los 20 días de margen
    const confirmAt = async (t, opts) => {
      vi.useFakeTimers(); vi.setSystemTime(t);
      RC.getCustomerInfo.mockResolvedValueOnce(info({ pro: true, at: t, expiresIn: 0, ...opts }));
      expect(await useStore.getState().checkProStatus()).toBe(true);
    };
    const offlineAt = async (t) => {
      vi.setSystemTime(t);
      RC.getCustomerInfo.mockRejectedValueOnce(rcError('10', 'Error performing request.'));
      return useStore.getState().checkProStatus();
    };
    beforeEach(() => { useRC({ user: 'uuid-A' }); });

    it('E5 (cumple): a los 19 días sin red sigue PRO', async () => {
      await confirmAt(T0);
      expect(await offlineAt(T0 + 19 * DAY)).toBe(true);
    });
    it('E5 arreglado (E46, R-E5): a los 21 días sin red pasa a gratis', async () => {
      await confirmAt(T0);
      const r = await offlineAt(T0 + 21 * DAY);
      expect(RC.getCustomerInfo).toHaveBeenCalledTimes(2);   // montaje: el segundo intento falló de verdad
      expect(r).toBe(false);
      expect(isPro()).toBe(false);
    });
    it('E5 arreglado (E46): 400 días sin red (suscripción) pasa a gratis', async () => {
      await confirmAt(T0);
      expect(await offlineAt(T0 + 400 * DAY)).toBe(false);
    });
    it('E5 (E46): dentro del periodo pagado (un año) sigue PRO a los 300 días sin red, y 21 días después de acabar ya no', async () => {
      await confirmAt(T0, { expiresIn: 365 });
      expect(await offlineAt(T0 + 300 * DAY)).toBe(true);
      expect(await offlineAt(T0 + 386 * DAY)).toBe(false);
    });
    it('E5 arreglado (E46): la caché del SDK con info de hace 21 días no mantiene el PRO (se mira requestDate)', async () => {
      await confirmAt(T0);
      vi.setSystemTime(T0 + 21 * DAY);
      RC.getCustomerInfo.mockResolvedValueOnce(info({ pro: true, at: T0 }));
      const stale = RC.getCustomerInfo.mock.calls.length;
      expect(await useStore.getState().checkProStatus()).toBe(false);
      expect(RC.getCustomerInfo.mock.calls.length).toBe(stale + 1);   // montaje: se leyó la caché
      expect(isPro()).toBe(false);
    });
    it('E5 arreglado (E46): reloj atrasado por debajo de la última confirmación (más de un día de margen) da el plazo por gastado', async () => {
      await confirmAt(T0);
      expect(await offlineAt(T0 - 2 * DAY)).toBe(false);
    });
    it('E5 aceptado (E46): sin RevenueCat (Expo Go, preview) a los 21 días sigue PRO: las versiones de prueba quedan fuera', async () => {
      await confirmAt(T0);
      useStore.setState({ _getRC: () => null });
      vi.setSystemTime(T0 + 21 * DAY);
      expect(await useStore.getState().checkProStatus()).toBe(true);
      expect(isPro()).toBe(true);
    });
    it('E46: una confirmación tardía (listener de App.js) pone el PRO, y una más vieja no lo quita', async () => {
      useStore.getState()._applyCustomerInfo(info({ pro: true, at: T0 }));
      expect(isPro()).toBe(true);
      useStore.getState()._applyCustomerInfo(info({ pro: false, at: T0 - 1000 }));   // llega tarde, es anterior
      expect(isPro()).toBe(true);
      useStore.getState()._applyCustomerInfo(info({ pro: false, at: T0 + 1000 }));   // más nueva: manda
      expect(isPro()).toBe(false);
    });
    it('E5 (cumple): el pago único no caduca sin red', async () => {
      await confirmAt(T0, { lifetime: true });
      expect(await offlineAt(T0 + 400 * DAY)).toBe(true);
    });
    it('E5 (cumple): al volver la red con la suscripción caducada, gratis ya', async () => {
      await confirmAt(T0);
      vi.setSystemTime(T0 + 25 * DAY);
      RC.getCustomerInfo.mockResolvedValueOnce(info({ pro: false, at: T0 + 25 * DAY }));
      expect(await useStore.getState().checkProStatus()).toBe(false);
    });
    it('E5 (cumple): al volver la red con la suscripción activa, PRO aunque el reloj del móvil vaya 21 días adelantado', async () => {
      await confirmAt(T0);
      vi.setSystemTime(T0 + 21 * DAY);
      RC.getCustomerInfo.mockResolvedValueOnce(info({ pro: true, at: T0 + 60_000 }));
      expect(await useStore.getState().checkProStatus()).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PARTE 2 — pasada adversaria (hallazgos NO listados en hallazgos-05.md)
  // ══════════════════════════════════════════════════════════════════════════
  describe('pasada adversaria', () => {
    const prog = (id, kind = 'template', owner = 'me') => ({
      id, name: id, owner, kind, status: 'active',
      stages: [{ id: `${id}_st`, name: 'E1', sessions: [], durationWeeks: null }],
    });
    const tpl = (id) => ({ id, name: id, owner: 'me', programId: null, kind: 'template', exercises: [], blocks: [] });
    const everything = { program: true, log: true, settings: true, customExercises: true, clients: true, templates: true };

    // ── X1: ¿puede un fichero escribir isPro / freeClientIds? ──
    it('X1 (cumple): importData de un backup completo con profile.isPro=true y freeClientIds NO los escribe (.fitdata / Drive)', () => {
      const p1 = prog('prog_x', 'program');
      const backup = {
        ...buildBackupPayload({
          profile: { isPro: true, freeClientIds: ['evil'], proTabsHidden: true, activeProgramId: 'prog_x', language: 'en' },
          programs: { prog_x: p1 },
          sessionTemplates: {},
          clients: {},
        }),
      };
      expect(backup.profile.isPro).toBe(true);                       // montaje: el fichero SÍ trae el PRO
      useStore.setState((s) => ({ profile: { ...s.profile, isPro: false, freeClientIds: ['mio'] } }));
      useStore.getState().importData(backup, everything, { silent: true });
      // montaje: el import corrió de verdad (el programa entró y se activó)
      expect(useStore.getState().programs.prog_x).toBeTruthy();
      expect(useStore.getState().profile.activeProgramId).toBe('prog_x');
      // regla
      expect(isPro()).toBe(false);
      expect(useStore.getState().profile.freeClientIds).toEqual(['mio']);
    });

    it('X1b (cumple): el backup de Drive/.fitdata de OTRO tampoco revoca el PRO de este móvil (profile.isPro=false en el fichero)', () => {
      const backup = buildBackupPayload({ profile: { isPro: false }, programs: { prog_y: prog('prog_y', 'program') }, sessionTemplates: {}, clients: {} });
      setPro(true);
      useStore.getState().importData(backup, everything, { silent: true });
      expect(useStore.getState().programs.prog_y).toBeTruthy();   // montaje
      expect(isPro()).toBe(true);
    });

    it('X1c (cumple): ni el programa suelto de un entrenador (data.profile.isPro) ni data.isPro llegan al perfil', () => {
      const data = { version: '4', program: prog('prog_z', 'program'), profile: { isPro: true, freeClientIds: ['x'] }, isPro: true };
      useStore.getState().importData(data, { program: true }, { silent: true });
      expect(useStore.getState().programs.prog_z).toBeTruthy();   // montaje
      expect(isPro()).toBe(false);
      expect(useStore.getState().profile.freeClientIds).toEqual(saved.profile.freeClientIds ?? []);
    });

    // ── X2: los topes del plan gratis no miran lo que entra por importData ──
    it('X2 hoy: importar plantillas con plan gratis salta el tope (1 plantilla de programa y 1 de sesión): entran todas (regla M01 §4: tope FREE.*Templates)', () => {
      useStore.setState((s) => ({ programs: {}, sessionTemplates: {}, profile: { ...s.profile, isPro: false } }));
      const data = {
        version: '4',
        programs: { t1: prog('t1'), t2: prog('t2'), t3: prog('t3') },
        sessionTemplates: { s1: tpl('s1'), s2: tpl('s2'), s3: tpl('s3') },
      };
      useStore.getState().importData(data, { templates: true, program: true }, { silent: true });
      const st = useStore.getState();
      // montaje: sin PRO, y la puerta de crear sí está cerrada con una sola plantilla
      expect(isPro()).toBe(false);
      expect(freeGates({ isPro: false, clients: {}, programs: { a: prog('a') }, sessionTemplates: {} }).newProgramTemplate).toBe('programTemplates');
      // hoy
      expect(Object.values(st.programs).filter((p) => p.kind === 'template')).toHaveLength(3);
      expect(Object.values(st.sessionTemplates).filter((t) => !t.programId && t.kind === 'template')).toHaveLength(3);
      expect(freeGates({ isPro: false, clients: st.clients, programs: st.programs, sessionTemplates: st.sessionTemplates }).newSessionTemplate).toBe('sessionTemplates');
    });

    it('X3 arreglado (E40, R-E4): importar clientes con plan gratis hasta pasar de 3 deja activos a los que ya tenías y congela solo los nuevos', () => {
      const mk = (id) => ({ id, name: id, status: 'active', syncSlotId: null });
      useStore.setState((s) => ({
        clients: { a: mk('a'), b: mk('b') }, programs: {}, sessionTemplates: {},
        profile: { ...s.profile, isPro: false, freeClientIds: [] },
      }));
      useStore.getState().importData({ version: '4', clients: { c: mk('c'), d: mk('d'), e: mk('e') } }, { clients: true }, { silent: true });
      const st = useStore.getState();
      expect(Object.keys(st.clients).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);   // montaje: entraron
      expect(needsClientChoice({ isPro: false, clients: st.clients, freeClientIds: st.profile.freeClientIds })).toBe(false);
      expect(st.isClientFrozen('a')).toBe(false);                                // el que ya era suyo sigue
      expect(st.isClientFrozen('c')).toBe(true);                                 // el que entra, congelado
    });

    // ── X4: el PRO persistido (reinstalar con copia de Android, allowBackup=true) ──
    describe('rehidratación del perfil persistido', () => {
      const blob = (isProValue) => JSON.stringify({
        state: { profile: { ...saved.profile, isPro: isProValue, freeClientIds: [] } },
        version: 0,
      });
      const stubStorage = (isProValue) => vi.spyOn(AsyncStorage, 'getItem').mockImplementation(async (k) => (k === BACKUP_STORAGE_KEY ? blob(isProValue) : null));

      it('X4 arreglado (E46, R-E5): un PRO restaurado del backup del SO sin fecha empieza a contar 20 días al abrir la versión nueva y sin red pasa a gratis', async () => {
        useRC({ user: 'uuid-A' });                       // en la instalación nueva, sin red
        vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(T0);
        stubStorage(true);
        await useStore.persist.rehydrate();
        // montaje: lo persistido llegó al store
        expect(AsyncStorage.getItem).toHaveBeenCalledWith(BACKUP_STORAGE_KEY);
        expect(isPro()).toBe(true);
        expect(useStore.getState().profile.proExpiresAt).toBe(T0);
        RC.getCustomerInfo.mockRejectedValue(rcError('10', 'Error performing request.'));
        vi.setSystemTime(T0 + 19 * DAY);
        expect(await useStore.getState().checkProStatus()).toBe(true);
        vi.setSystemTime(T0 + 21 * DAY);
        expect(await useStore.getState().checkProStatus()).toBe(false);
        expect(isPro()).toBe(false);
      });

      it('X4b (cumple): con red el mismo perfil restaurado se corrige a gratis (RevenueCat manda)', async () => {
        useRC({ user: 'uuid-A' });                       // sin compras
        stubStorage(true);
        await useStore.persist.rehydrate();
        expect(isPro()).toBe(true);                      // montaje
        expect(await useStore.getState().checkProStatus()).toBe(false);
        expect(isPro()).toBe(false);
      });

      it('X4c aceptado (E46): con perfil restaurado isPro=true y sin módulo nativo (_getRC=null, Expo Go / build sin clave) sigue PRO: las versiones de prueba quedan fuera de R-E5', async () => {
        useStore.setState({ _getRC: () => null });
        stubStorage(true);
        await useStore.persist.rehydrate();
        expect(isPro()).toBe(true);                      // montaje
        expect(await useStore.getState().checkProStatus()).toBe(true);
      });
    });

    // ── X5: borrar la cuenta a medias ──
    it('D3-c arreglado (E48, R-D3): borrar la cuenta con deleteClientUser caído tras borrar la del entrenador sale de RevenueCat, limpia el entrenador y lanza', async () => {
      deleteSetup();
      authMock.deleteClientUser.mockRejectedValueOnce(new Error('network'));
      await expect(useStore.getState().deleteAccount()).rejects.toThrow('network');
      // montaje: la cuenta de entrenador SÍ se borró en el servidor
      expect(authMock.deleteTrainerUser).toHaveBeenCalledTimes(1);
      expect(authMock.deleteClientUser).toHaveBeenCalledTimes(1);
      expect(RC.logOut).toHaveBeenCalledTimes(1);
      expect(useStore.getState().trainerSync.userId).toBeNull();
      expect(isPro()).toBe(false);
    });

    it('E33 (cumple R-D4): con el mismo usuario en los dos papeles delete-account se llama una sola vez', async () => {
      deleteSetup();
      authMock.clientSessionUserId.mockResolvedValueOnce('uuid-A');
      expect(await useStore.getState().deleteAccount()).toEqual({ ok: true });
      expect(authMock.deleteTrainerUser).toHaveBeenCalledTimes(1);
      expect(authMock.deleteClientUser).not.toHaveBeenCalled();
    });

    // ── X6: restaurar a mano revoca ──
    it('X6 (cumple): «Restaurar» sin compra encontrada deja gratis a quien tenía el true persistido (el motor es RevenueCat, no el flag)', async () => {
      useRC({ user: 'uuid-A' });
      setPro(true);
      expect(await useStore.getState().restorePurchases()).toBe(false);
      expect(RC.restorePurchases).toHaveBeenCalledTimes(1);
      expect(isPro()).toBe(false);
    });
  });
});
