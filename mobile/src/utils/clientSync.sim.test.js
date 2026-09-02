/**
 * Nivel 2 — Simulación del protocolo entrenador↔cliente.
 *
 * Toda la sincronización es un puñado de funciones sobre una sola tabla
 * (trainer_clients). Aquí montamos un fake en memoria de esa tabla, fiel a
 * src/services/supabaseSync.js, y dos "dispositivos" (entrenador y cliente)
 * que ejecutan el flujo real sin red:
 *
 *   entrenador crea cliente → sube programa → cliente conecta con código →
 *   hace sesiones → sube historial (filtrado por alcance) → entrenador descarga
 *
 * Las piezas con lógica de verdad son funciones puras reales:
 * scopeFilterForUpload (privacidad), mergeClientLog (append-only) y
 * reidProgramFile (programa compartido). El test las mueve de punta a punta y
 * comprueba ambos lados — justo la clase de bug que estuvimos persiguiendo
 * (logs cruzados, subida filtrada, programas compartidos).
 */

import { describe, test, expect } from 'vitest';
import {
  scopeFilterForUpload,
  mergeClientLog,
  reidProgramFile,
  programTemplateIds,
  splitClientLogEntries,
} from './clientLogs';
import { assignActiveProgram } from './programOwnership';
import { advanceCycle, progressBlob, progressFromBlob, mergeProgressOnImport } from './stageProgress';

const clone = (x) => JSON.parse(JSON.stringify(x));

const DAY     = 86400000;
const LINK_TS = Date.parse('2026-01-10T10:00:00Z');

// ── Fake en memoria de la tabla trainer_clients ──────────────────────────────
// Mismas operaciones y semántica que src/services/supabaseSync.js, sin Supabase.
class FakeTrainerClients {
  constructor() { this.rows = []; this.seq = 1; }

  createClientSlot(trainerId, clientName) {
    const clientCode = `CODE-${this.seq}`;
    const row = {
      id:                 `slot_${this.seq}`,
      trainer_id:         trainerId,
      client_name:        clientName,
      client_code:        clientCode,
      client_id:          null,
      program_json:       null,
      program_updated_at: null,
      history_json:       null,
      history_updated_at: null,
      trainer_name:       null,
      sessions_count:     0,
      disconnected_at:    null,
      created_at:         new Date().toISOString(),
    };
    this.seq += 1;
    this.rows.push(row);
    return { slotId: row.id, clientCode };
  }

  _byId(id) {
    const r = this.rows.find((x) => x.id === id);
    if (!r) throw new Error(`slot ${id} no encontrado`);
    return r;
  }

  uploadProgram(slotId, programJson, trainerName) {
    const r = this._byId(slotId);
    r.program_json = programJson;
    r.program_updated_at = new Date().toISOString();
    if (trainerName !== undefined) r.trainer_name = trainerName ?? null;
  }

  getSlotByClientCode(code) {
    return this.rows.find((x) => x.client_code === code) ?? null;
  }

  // El RPC vincula la fila a auth.uid(); aquí el llamante pasa su uid simulado.
  linkClientToSlot(code, callerUid) {
    const r = this.getSlotByClientCode(code);
    if (!r) throw new Error('código no encontrado');
    r.client_id = callerUid;
    r.disconnected_at = null;
    return r.id;
  }

  uploadHistory(slotId, entries, customExercises = {}, progress = null) {
    const r = this._byId(slotId);
    r.history_json = { entries, customExercises, progress };
    r.history_updated_at = new Date().toISOString();
    r.sessions_count = entries.length;
  }

  downloadHistory(slotId) {
    const r = this._byId(slotId);
    const raw = r.history_json;
    // Soporta formato nuevo { entries, customExercises, progress } y legacy (array plano).
    const isNew = raw && !Array.isArray(raw) && raw.entries !== undefined;
    return {
      history:         isNew ? (raw.entries ?? []) : (raw ?? []),
      customExercises: isNew ? (raw.customExercises ?? {}) : {},
      progress:        isNew ? (raw.progress ?? null) : null,
      updatedAt:       r.history_updated_at,
    };
  }

  downloadProgram(slotId) {
    const r = this._byId(slotId);
    return {
      programJson: r.program_json ?? null,
      updatedAt:   r.program_updated_at ?? null,
      trainerName: r.trainer_name ?? null,
    };
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
function programFile(programId, templateIds, name = 'Hipertrofia') {
  return {
    program: {
      id:   programId,
      name,
      days: templateIds.map((t) => ({ sessionTemplateId: t })),
    },
    sessionTemplates: Object.fromEntries(
      templateIds.map((t) => [t, { id: t, programId, name: `Sesión ${t}` }]),
    ),
    userPrograms: {},
    workoutLog:   [],
  };
}

const session = (id, sessionTemplateId, timestamp, exercises = []) =>
  ({ id, sessionTemplateId, timestamp, exercises });

// ── Roles ────────────────────────────────────────────────────────────────────
function makeTrainer(db, { userId = 'trainer-1', trainerName = 'Carlos' } = {}) {
  const state = { userId, trainerName, clients: {}, clientLogs: {}, personalLog: [], customExercises: {}, programs: {} };
  return {
    state,
    addClient(clientId, name) {
      const { slotId, clientCode } = db.createClientSlot(userId, name);
      state.clients[clientId] = { id: clientId, name, slotId };
      return clientCode;
    },
    pushProgram(clientId, file) {
      // El store estampa trainerName en cada plantilla antes de subir.
      const stamped = clone(file);
      Object.values(stamped.sessionTemplates ?? {}).forEach((tpl) => { tpl.trainerName = trainerName; });
      db.uploadProgram(state.clients[clientId].slotId, stamped, trainerName);
    },
    // Asigna un programa (modelo de un único activo): lo activa, archiva el
    // anterior y lo sube al slot. Usa la util real assignActiveProgram.
    assignProgram(clientId, file) {
      // El dueño se estampa al adoptar el archivo, como hacen el store y
      // `importForClient`: el fichero siempre viaja diciendo `owner: 'me'`.
      file.program.owner = clientId;
      state.programs[file.program.id] = file;
      state.clients[clientId] = assignActiveProgram(state.clients[clientId], file.program.id);
      this.pushProgram(clientId, file);
      return file.program.id;
    },
    // Importar un archivo al registro del cliente (mirror de importForClient):
    // 'replace' activa el entrante; 'replace_log' además fusiona su historial;
    // 'merge_log' solo añade sesiones sin tocar el programa.
    importProgram(clientId, file, mode) {
      if (mode === 'replace' || mode === 'replace_log') {
        file.program.owner = clientId;
        state.programs[file.program.id] = file;
        state.clients[clientId] = assignActiveProgram(state.clients[clientId], file.program.id);
        if (mode === 'replace_log' && file.workoutLog?.length) {
          state.clientLogs[clientId] = mergeClientLog(state.clientLogs[clientId] ?? [], file.workoutLog);
        }
      } else if (mode === 'merge_log') {
        state.clientLogs[clientId] = mergeClientLog(state.clientLogs[clientId] ?? [], file.workoutLog ?? []);
      }
    },
    // Los "anteriores" de un cliente: derivados de `owner`, ya no de una lista
    // guardada. No pueden contener ids muertos porque no contienen ids.
    archivedFor(clientId) {
      return Object.values(state.programs)
        .map((f) => f.program)
        .filter((p) => p.owner === clientId && p.id !== state.clients[clientId].activeProgramId)
        .map((p) => p.id);
    },
    // Descarga el historial del cliente y lo fusiona en SU log separado —
    // nunca en el workoutLog personal del entrenador. Append-only por id.
    pull(clientId) {
      const { history, customExercises, progress } = db.downloadHistory(state.clients[clientId].slotId);
      // La posición en el ciclo se ESPEJA, nunca se recalcula del historial
      // (spec stage-locks §3.1) — por eso borrar sesiones no la mueve.
      state.clients[clientId] = { ...state.clients[clientId], progress };
      if (Object.keys(customExercises).length) Object.assign(state.customExercises, customExercises);
      const existing = state.clientLogs[clientId] ?? [];
      const merged   = mergeClientLog(existing, history);
      state.clientLogs[clientId] = merged;
      return merged.length - existing.length;
    },
  };
}

function makeClient(db, { uid = 'client-uid-1' } = {}) {
  const state = { uid, programs: {}, sessionTemplates: {}, workoutLog: [], customExercises: {}, clientSync: {} };
  return {
    state,
    connect(code, { at, mergeHistory = false }) {
      const slot = db.getSlotByClientCode(code);
      if (!slot) throw new Error('código no encontrado');
      db.linkClientToSlot(code, uid);
      const { programJson } = db.downloadProgram(slot.id);
      const data = programJson;
      state.programs[data.program.id] = data.program;
      state.activeProgramId = data.program.id;
      Object.assign(state.sessionTemplates, data.sessionTemplates ?? {});
      state.clientSync = {
        slotId:            slot.id,
        trainerProgramIds: [data.program.id],
        linkedAt:          new Date(at).toISOString(),
      };
      // Restaurar lo propio desde el slot: contadores SIEMPRE, historial solo si
      // se acepta la fusión (spec stage-locks §6.4). Misma regla de merge que una
      // actualización en vivo: el blob gana salvo que el programa traiga un sello
      // de activación más nuevo que aquel bajo el que se calculó el blob.
      const { history, progress } = db.downloadHistory(slot.id);
      Object.assign(state.programs[data.program.id], mergeProgressOnImport({
        blob:           progress,
        program:        state.programs[data.program.id],
        lastActivation: progress?.appliedActivation ?? null,
      }));
      state.clientSync.lastAppliedStageActivation = data.program.stageActivatedAt ?? null;
      if (mergeHistory) {
        const localIds = new Set(state.workoutLog.map((e) => e.id));
        state.workoutLog.push(...history.filter((e) => !localIds.has(e.id)));
      }
    },
    // Guardar sesión: registra la entrada Y mueve los contadores del programa,
    // igual que saveSession en el store.
    logSession(entry) {
      state.workoutLog.push(entry);
      const program = state.programs[state.activeProgramId];
      const cycle   = (program?.days ?? []).map((d) => d.sessionTemplateId);
      if (cycle.includes(entry.sessionTemplateId)) {
        Object.assign(program, advanceCycle(program, entry.sessionTemplateId, cycle));
      }
    },
    deleteSession(id)   { state.workoutLog = state.workoutLog.filter((e) => e.id !== id); },
    // El entrenador cambió el programa: el cliente lo descarga y lo adopta.
    // trainerProgramIds ACUMULA (mirror del store) — las sesiones del programa
    // anterior siguen dentro del alcance de subida, no se quedan huérfanas.
    syncProgram() {
      const { programJson } = db.downloadProgram(state.clientSync.slotId);
      const data = programJson;
      state.programs[data.program.id] = data.program;
      Object.assign(state.sessionTemplates, data.sessionTemplates ?? {});
      state.clientSync.trainerProgramIds = [...new Set([
        ...(state.clientSync.trainerProgramIds ?? []),
        data.program.id,
      ])];
    },
    upload() {
      const { entries, customExercises } = scopeFilterForUpload({
        workoutLog:        state.workoutLog,
        programs:          state.programs,
        customExercises:   state.customExercises,
        trainerProgramIds: state.clientSync.trainerProgramIds,
        linkedAt:          state.clientSync.linkedAt,
      });
      db.uploadHistory(
        state.clientSync.slotId, entries, customExercises,
        progressBlob(state.programs[state.activeProgramId], state.clientSync.lastAppliedStageActivation ?? null),
      );
      return entries;
    },
  };
}

// Arranque común: entrenador con un cliente conectado y programa de 2 sesiones.
function linkedSetup() {
  const db      = new FakeTrainerClients();
  const trainer = makeTrainer(db);
  const client  = makeClient(db);
  const code    = trainer.addClient('ana', 'Ana');
  trainer.pushProgram('ana', programFile('prog_trainer', ['tplA', 'tplB']));
  client.connect(code, { at: LINK_TS });
  return { db, trainer, client };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('protocolo entrenador↔cliente — flujo enlazado completo', () => {
  test('el entrenador recibe las sesiones de su programa, no el historial personal', () => {
    const { trainer, client } = linkedSetup();

    client.logSession(session('s1', 'tplA', LINK_TS + DAY));
    client.logSession(session('s2', 'tplB', LINK_TS + 2 * DAY));
    client.logSession(session('p1', 'tplPersonal', LINK_TS + 3 * DAY)); // fuera de alcance

    client.upload();
    trainer.pull('ana');

    const ids = trainer.state.clientLogs.ana.map((e) => e.id);
    expect(ids).toEqual(['s1', 's2']);
    expect(ids).not.toContain('p1');
    expect(trainer.state.personalLog).toEqual([]); // log propio del entrenador intacto
  });

  test('la sesión libre anterior a conectar se queda en el cliente; la posterior se sube', () => {
    const { trainer, client } = linkedSetup();

    client.logSession(session('free-old', '__free__', LINK_TS - DAY));
    client.logSession(session('free-new', '__free__', LINK_TS + DAY));

    client.upload();
    trainer.pull('ana');

    const ids = trainer.state.clientLogs.ana.map((e) => e.id);
    expect(ids).toContain('free-new');
    expect(ids).not.toContain('free-old');
  });

  test('solo viajan las definiciones de ejercicio personalizado referenciadas', () => {
    const { trainer, client } = linkedSetup();
    client.state.customExercises = {
      custUsed:   { name: 'Press raro' },
      custUnused: { name: 'Otro que no uso' },
    };
    client.logSession(session('s1', 'tplA', LINK_TS + DAY, [{ exerciseId: 'custUsed' }]));

    client.upload();
    trainer.pull('ana');

    expect(trainer.state.customExercises).toHaveProperty('custUsed');
    expect(trainer.state.customExercises).not.toHaveProperty('custUnused');
  });

  test('si el cliente borra una sesión y vuelve a subir, el entrenador la conserva (append-only)', () => {
    const { trainer, client } = linkedSetup();
    client.logSession(session('s1', 'tplA', LINK_TS + DAY));
    client.logSession(session('s2', 'tplB', LINK_TS + 2 * DAY));
    client.upload();
    trainer.pull('ana');
    expect(trainer.state.clientLogs.ana.map((e) => e.id)).toEqual(['s1', 's2']);

    client.deleteSession('s1');   // el cliente borra en su dispositivo
    client.upload();
    trainer.pull('ana');

    // El registro del entrenador es un log: no pierde s1.
    expect(trainer.state.clientLogs.ana.map((e) => e.id)).toEqual(['s1', 's2']);
  });

  test('descargar dos veces no duplica (idempotente)', () => {
    const { trainer, client } = linkedSetup();
    client.logSession(session('s1', 'tplA', LINK_TS + DAY));
    client.upload();

    expect(trainer.pull('ana')).toBe(1); // primera descarga añade 1
    expect(trainer.pull('ana')).toBe(0); // segunda no añade nada
    expect(trainer.state.clientLogs.ana).toHaveLength(1);
  });

  test('las sesiones nuevas se acumulan en descargas sucesivas, ordenadas por fecha', () => {
    const { trainer, client } = linkedSetup();
    client.logSession(session('s1', 'tplA', LINK_TS + DAY));
    client.upload();
    trainer.pull('ana');

    client.logSession(session('s2', 'tplB', LINK_TS + 2 * DAY));
    client.upload();
    expect(trainer.pull('ana')).toBe(1);
    expect(trainer.state.clientLogs.ana.map((e) => e.id)).toEqual(['s1', 's2']);
  });
});

// El requisito duro de la spec de bloqueo de etapas: la posición del cliente en
// el ciclo y la que ve el entrenador NO pueden divergir, pase lo que pase.
describe('progresión espejada — cliente y entrenador nunca divergen', () => {
  // Las dos caras de lo mismo: lo que el cliente tiene en su programa y lo que
  // el entrenador guardó del último envío, normalizados a la misma forma.
  const enCliente   = (client, programId)  => progressFromBlob(progressBlob(client.state.programs[programId]), programId);
  const enEntrenador = (trainer, programId) => progressFromBlob(trainer.state.clients.ana.progress, programId);

  test('el entrenador ve la misma posición de ciclo que el cliente', () => {
    const { trainer, client } = linkedSetup();
    client.logSession(session('s1', 'tplA', LINK_TS + DAY));
    client.upload();
    trainer.pull('ana');

    expect(enEntrenador(trainer, 'prog_trainer')).toEqual(enCliente(client, 'prog_trainer'));
    expect(enEntrenador(trainer, 'prog_trainer').cycleCompletedIds).toEqual(['tplA']);
  });

  test('repetir una sesión no avanza el ciclo en ninguno de los dos lados', () => {
    const { trainer, client } = linkedSetup();
    client.logSession(session('s1', 'tplA', LINK_TS + DAY));
    client.logSession(session('s2', 'tplA', LINK_TS + 2 * DAY));
    client.logSession(session('s3', 'tplA', LINK_TS + 3 * DAY));
    client.upload();
    trainer.pull('ana');

    expect(enEntrenador(trainer, 'prog_trainer')).toEqual(enCliente(client, 'prog_trainer'));
    expect(enEntrenador(trainer, 'prog_trainer').totalWeeksCompleted).toBe(0);

    // Al hacer la que falta, el ciclo cierra en ambos.
    client.logSession(session('s4', 'tplB', LINK_TS + 4 * DAY));
    client.upload();
    trainer.pull('ana');
    expect(enEntrenador(trainer, 'prog_trainer').totalWeeksCompleted).toBe(1);
    expect(enEntrenador(trainer, 'prog_trainer').cycleCompletedIds).toEqual([]);
  });

  test('borrar sesiones del historial no hace retroceder el programa', () => {
    const { trainer, client } = linkedSetup();
    client.logSession(session('s1', 'tplA', LINK_TS + DAY));
    client.logSession(session('s2', 'tplB', LINK_TS + 2 * DAY));  // cierra ciclo
    client.upload();
    trainer.pull('ana');
    const antes = enEntrenador(trainer, 'prog_trainer');

    client.deleteSession('s1');
    client.deleteSession('s2');
    client.upload();
    trainer.pull('ana');

    expect(enCliente(client, 'prog_trainer')).toEqual(antes);
    expect(enEntrenador(trainer, 'prog_trainer')).toEqual(antes);
    expect(antes.totalWeeksCompleted).toBe(1);
  });

  test('reinstalar y reconectar devuelve al cliente donde lo dejó', () => {
    const { db, trainer, client } = linkedSetup();
    client.logSession(session('s1', 'tplA', LINK_TS + DAY));
    client.logSession(session('s2', 'tplB', LINK_TS + 2 * DAY));
    client.logSession(session('s3', 'tplA', LINK_TS + 3 * DAY));
    client.upload();
    const antes = enCliente(client, 'prog_trainer');

    // Móvil nuevo, sin nada local, mismo código.
    const nuevo = makeClient(db, { uid: 'client-uid-1' });
    nuevo.connect('CODE-1', { at: LINK_TS + 4 * DAY });

    expect(enCliente(nuevo, 'prog_trainer')).toEqual(antes);
    expect(nuevo.state.workoutLog).toEqual([]);          // rechazó fusionar historial…
    expect(antes.cycleCompletedIds).toEqual(['tplA']);   // …y aun así conserva el ciclo abierto
  });

  test('una activación enviada mientras el cliente estaba desconectado gana al blob al reconectar', () => {
    const { db, trainer, client } = linkedSetup();
    client.logSession(session('s1', 'tplA', LINK_TS + DAY));
    client.upload();   // el blob queda en el slot: etapa 0, ciclo abierto

    // Con el cliente sin la app, el entrenador activa la etapa 2 y la reenvía.
    const file = programFile('prog_trainer', ['tplA', 'tplB']);
    file.program.stages = [
      { id: 'st1', durationWeeks: 2, days: file.program.days },
      { id: 'st2', durationWeeks: 2, days: file.program.days },
    ];
    file.program.currentStageIndex = 1;
    file.program.stageActivatedAt  = '2026-02-01T10:00:00.000Z';
    trainer.pushProgram('ana', file);

    // Reinstala y reconecta: el sello es nuevo para este dispositivo → gana el
    // movimiento del entrenador, no la posición vieja del blob.
    const nuevo = makeClient(db, { uid: 'client-uid-1' });
    nuevo.connect('CODE-1', { at: LINK_TS + 5 * DAY });
    expect(nuevo.state.programs.prog_trainer.currentStageIndex).toBe(1);
    expect(nuevo.state.programs.prog_trainer.stageWeeksCompleted).toBe(0);
  });

  test('un blob de otro programa no se adopta', () => {
    const { trainer, client } = linkedSetup();
    client.logSession(session('s1', 'tplA', LINK_TS + DAY));
    client.upload();
    trainer.pull('ana');

    // El entrenador cambia de programa: el blob pendiente es del anterior.
    expect(progressFromBlob(trainer.state.clients.ana.progress, 'prog_otro')).toBeNull();
  });
});

describe('dos clientes del mismo entrenador no cruzan historiales', () => {
  test('cada cliente sube a su propio slot; los logs quedan separados por clientId', () => {
    const db      = new FakeTrainerClients();
    const trainer = makeTrainer(db);
    const ana     = makeClient(db, { uid: 'uid-ana' });
    const luis    = makeClient(db, { uid: 'uid-luis' });

    const codeAna  = trainer.addClient('ana',  'Ana');
    const codeLuis = trainer.addClient('luis', 'Luis');
    trainer.pushProgram('ana',  programFile('prog_ana',  ['tplA1', 'tplA2']));
    trainer.pushProgram('luis', programFile('prog_luis', ['tplL1', 'tplL2']));

    ana.connect(codeAna,   { at: LINK_TS });
    luis.connect(codeLuis, { at: LINK_TS });

    ana.logSession(session('a1', 'tplA1', LINK_TS + DAY));
    luis.logSession(session('l1', 'tplL1', LINK_TS + DAY));
    ana.upload();  trainer.pull('ana');
    luis.upload(); trainer.pull('luis');

    expect(trainer.state.clientLogs.ana.map((e) => e.id)).toEqual(['a1']);
    expect(trainer.state.clientLogs.luis.map((e) => e.id)).toEqual(['l1']);
  });
});

describe('programa compartido entre dos clientes (lado entrenador)', () => {
  // Mirrors importForClient: si el id del programa ya pertenece a OTRO cliente,
  // se re-IDifica todo para que dos clientes nunca compartan plantillas.
  test('reasignar el mismo archivo a un segundo cliente genera plantillas únicas', () => {
    const fileForA = programFile('prog_shared', ['tpl1', 'tpl2']);

    // El entrenador ya tiene prog_shared asignado al cliente A.
    const onTrainer = { prog_shared: { id: 'prog_shared', owner: 'A', kind: 'program' } };

    // Al asignar el MISMO archivo a B, la regla del store detecta colisión:
    // un campo, no dos que tienen que estar de acuerdo.
    const existing = onTrainer[fileForA.program.id];
    const collides = existing && existing.owner !== 'B';
    expect(collides).toBe(true);

    const fileForB = reidProgramFile(fileForA);
    expect(fileForB.program.id).not.toBe('prog_shared');

    const tplsA = [...programTemplateIds(fileForA.program)];
    const tplsB = [...programTemplateIds(fileForB.program)];
    expect(tplsB.some((t) => tplsA.includes(t))).toBe(false); // sin plantillas en común
  });

  test('con plantillas únicas, splitClientLogEntries enruta cada sesión a un solo cliente', () => {
    const fileA = programFile('prog_a', ['tplA1', 'tplA2']);
    const fileB = reidProgramFile(programFile('prog_b', ['tplA1', 'tplA2'])); // mismas plantillas → re-ID

    const programs = {
      prog_a:             { ...fileA.program, owner: 'A' },
      [fileB.program.id]: { ...fileB.program, owner: 'B' },
    };

    const [bTpl1] = [...programTemplateIds(fileB.program)];
    const mixedLog = [
      session('a1', 'tplA1', 1),    // de A
      session('b1', bTpl1,   2),    // de B (plantilla re-ID'd)
    ];

    const { clientEntries } = splitClientLogEntries(mixedLog, programs);
    expect(clientEntries.A.map((e) => e.id)).toEqual(['a1']);
    expect(clientEntries.B.map((e) => e.id)).toEqual(['b1']);
  });
});

describe('Fase 2 — reasignación de programa (un único activo)', () => {
  test('reasignar archiva el programa anterior y activa el nuevo (lado entrenador)', () => {
    const db      = new FakeTrainerClients();
    const trainer = makeTrainer(db);
    trainer.addClient('ana', 'Ana');

    trainer.assignProgram('ana', programFile('prog_v1', ['tplA', 'tplB']));
    expect(trainer.state.clients.ana.activeProgramId).toBe('prog_v1');

    trainer.assignProgram('ana', programFile('prog_v2', ['tplC', 'tplD']));
    const ana = trainer.state.clients.ana;
    expect(ana.activeProgramId).toBe('prog_v2');
    expect(trainer.archivedFor('ana')).toEqual(['prog_v1']);   // el anterior, archivado
    expect(Object.keys(trainer.state.programs))                // nada perdido
      .toEqual(['prog_v1', 'prog_v2']);
  });

  test('el cliente recibe el cambio de programa y conserva su historial', () => {
    const db      = new FakeTrainerClients();
    const trainer = makeTrainer(db);
    const client  = makeClient(db);
    const code    = trainer.addClient('ana', 'Ana');

    trainer.assignProgram('ana', programFile('prog_v1', ['tplA', 'tplB']));
    client.connect(code, { at: LINK_TS });
    expect(Object.keys(client.state.programs)).toEqual(['prog_v1']);

    // Entrena v1; el entrenador recibe sus sesiones.
    client.logSession(session('s1', 'tplA', LINK_TS + DAY));
    client.logSession(session('s2', 'tplB', LINK_TS + 2 * DAY));
    client.upload();
    trainer.pull('ana');
    expect(trainer.state.clientLogs.ana.map((e) => e.id)).toEqual(['s1', 's2']);

    // El entrenador reasigna a v2 y lo sube; el cliente lo adopta.
    trainer.assignProgram('ana', programFile('prog_v2', ['tplC', 'tplD']));
    client.syncProgram();
    expect(client.state.clientSync.trainerProgramIds).toEqual(['prog_v1', 'prog_v2']);

    // Entrena v2; el historial previo (v1) sigue en alcance, no se pierde.
    client.logSession(session('s3', 'tplC', LINK_TS + 5 * DAY));
    client.upload();
    expect(trainer.pull('ana')).toBe(1); // solo s3 es nuevo
    expect(trainer.state.clientLogs.ana.map((e) => e.id)).toEqual(['s1', 's2', 's3']);
  });
});

describe('Fase 2 — importar programa (replace / replace_log / merge_log)', () => {
  // Cliente con v1 asignado y una sesión ya en el historial del entrenador.
  function clientWithV1() {
    const db      = new FakeTrainerClients();
    const trainer = makeTrainer(db);
    trainer.addClient('ana', 'Ana');
    trainer.assignProgram('ana', programFile('prog_v1', ['tplA', 'tplB']));
    trainer.state.clientLogs.ana = [session('h1', 'tplA', LINK_TS + DAY)];
    return { trainer };
  }

  test('replace activa el programa entrante aunque su id difiera; el anterior se archiva', () => {
    const { trainer } = clientWithV1();
    trainer.importProgram('ana', programFile('prog_v2', ['tplC', 'tplD']), 'replace');
    const ana = trainer.state.clients.ana;
    expect(ana.activeProgramId).toBe('prog_v2');
    expect(trainer.archivedFor('ana')).toEqual(['prog_v1']);
    expect(trainer.state.clientLogs.ana.map((e) => e.id)).toEqual(['h1']); // historial intacto
  });

  test('replace_log activa el entrante y fusiona su historial', () => {
    const { trainer } = clientWithV1();
    const file = programFile('prog_v2', ['tplC', 'tplD']);
    file.workoutLog = [session('h2', 'tplC', LINK_TS + 3 * DAY)];
    trainer.importProgram('ana', file, 'replace_log');
    expect(trainer.state.clients.ana.activeProgramId).toBe('prog_v2');
    expect(trainer.state.clientLogs.ana.map((e) => e.id)).toEqual(['h1', 'h2']);
  });

  test('merge_log solo añade sesiones, sin cambiar el programa activo', () => {
    const { trainer } = clientWithV1();
    const file = programFile('prog_v2', ['tplC', 'tplD']);
    file.workoutLog = [session('h2', 'tplC', LINK_TS + 3 * DAY)];
    trainer.importProgram('ana', file, 'merge_log');
    expect(trainer.state.clients.ana.activeProgramId).toBe('prog_v1'); // sin cambios
    expect(trainer.state.clientLogs.ana.map((e) => e.id)).toEqual(['h1', 'h2']);
  });
});

describe('tabla trainer_clients en memoria — semántica fiel', () => {
  test('un código inexistente devuelve null', () => {
    const db = new FakeTrainerClients();
    expect(db.getSlotByClientCode('NOPE')).toBeNull();
  });

  test('linkClientToSlot vincula client_id al llamante', () => {
    const db = new FakeTrainerClients();
    const { clientCode, slotId } = db.createClientSlot('t1', 'Ana');
    db.linkClientToSlot(clientCode, 'uid-xyz');
    expect(db._byId(slotId).client_id).toBe('uid-xyz');
  });

  test('downloadHistory entiende el formato legacy (array plano)', () => {
    const db = new FakeTrainerClients();
    const { slotId } = db.createClientSlot('t1', 'Ana');
    db._byId(slotId).history_json = [session('x', 'tplA', 1)]; // formato viejo
    const { history, customExercises } = db.downloadHistory(slotId);
    expect(history).toHaveLength(1);
    expect(customExercises).toEqual({});
  });
});
