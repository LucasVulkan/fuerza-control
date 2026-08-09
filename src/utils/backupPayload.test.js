import { describe, it, expect } from 'vitest';
import { buildBackupPayload, buildBackupJson, BACKUP_STORAGE_KEY } from './backupPayload';

/** Un estado con todo lo que el backup lleva y todo lo que no debe llevar. */
const estado = () => ({
  profile:          { name: 'Ana', activeProgramId: 'p1' },
  workoutLog:       [{ id: 's1' }],
  clientLogs:       { cli_1: [{ id: 's2' }] },
  userPrograms:     { up1: { id: 'up1' } },
  programs:         { p1: { id: 'p1' } },
  sessionTemplates: { t1: { id: 't1' } },
  customExercises:  { e1: { id: 'e1' } },
  clients:          { cli_1: { id: 'cli_1' } },

  // Nada de esto pertenece al formato.
  driveBackup:   { email: 'ana@gmail.com', folderId: 'carpeta_drive' },
  trainerSync:   { userId: 'u1', password: 'secreto' },
  clientSync:    { slotId: 'slot_1', clientCode: 'ABCD-1234' },
  activeSession: { templateId: 't1' },
  tagRegistry:   [{ id: 'tag_1', name: 'Lesionado' }],
  blockPresets:  { b1: {} },
  theme:         'formaFit',
});

describe('buildBackupPayload', () => {
  it('lleva los ocho campos de datos y la cabecera del formato', () => {
    const payload = buildBackupPayload(estado());

    expect(Object.keys(payload).sort()).toEqual([
      'appName', 'clientLogs', 'clients', 'customExercises', 'exportDate',
      'exportType', 'profile', 'programs', 'sessionTemplates', 'userPrograms',
      'version', 'workoutLog',
    ]);
    expect(payload.version).toBe('2');
    expect(payload.exportType).toBe('full');
    expect(payload.programs).toEqual({ p1: { id: 'p1' } });
    expect(payload.clientLogs).toEqual({ cli_1: [{ id: 's2' }] });
  });

  it('no filtra credenciales ni configuración local', () => {
    // Un .fitdata se comparte por WhatsApp: aquí no puede viajar la carpeta de
    // Drive del entrenador ni las credenciales de sincronización.
    const serializado = buildBackupJson(estado());

    expect(serializado).not.toContain('ana@gmail.com');
    expect(serializado).not.toContain('carpeta_drive');
    expect(serializado).not.toContain('secreto');
    expect(serializado).not.toContain('ABCD-1234');
  });

  it('tolera el estado persistido a medias que lee la tarea de fondo', () => {
    // Instalación recién estrenada: `clientLogs` y `clients` aún no existen.
    const payload = buildBackupPayload({ profile: { name: 'Ana' }, programs: {} });

    expect(payload.clientLogs).toEqual({});
    expect(payload.clients).toEqual({});
    expect(payload.workoutLog).toEqual([]);
  });

  it('sale del blob de zustand tal cual lo lee la tarea de fondo', () => {
    // Lo que hay bajo la clave de persistencia es `{ state, version }`.
    const blob = JSON.stringify({ state: estado(), version: 0 });

    const payload = buildBackupPayload(JSON.parse(blob).state);

    expect(payload.programs).toEqual({ p1: { id: 'p1' } });
    expect(BACKUP_STORAGE_KEY).toBe('fc_tracker_v1');
  });
});
