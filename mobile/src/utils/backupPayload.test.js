import { describe, it, expect } from 'vitest';
import { buildBackupPayload, buildBackupJson, BACKUP_STORAGE_KEY } from './backupPayload';

/** Un estado con todo lo que el backup lleva y todo lo que no debe llevar. */
const estado = () => ({
  profile:          { name: 'Ana', activeProgramId: 'p1' },
  workoutLog:       [{ id: 's1' }],
  clientLogs:       { cli_1: [{ id: 's2' }] },
  programs:         { p1: { id: 'p1' } },
  sessionTemplates: { t1: { id: 't1' } },
  customExercises:  { e1: { id: 'e1' } },
  clients:          { cli_1: { id: 'cli_1' } },
  // Datos del usuario, no configuración local: viajan (fallo 25).
  tagRegistry:      [{ id: 'tag_1', name: 'Lesionado' }],
  blockPresets:     [{ presetId: 'pre_1', format: 'amrap' }],

  // Nada de esto pertenece al formato.
  driveBackup:   { email: 'ana@gmail.com', folderId: 'carpeta_drive' },
  trainerSync:   { userId: 'u1', password: 'secreto' },
  clientSync:    { slotId: 'slot_1', clientCode: 'ABCD-1234' },
  activeSession: { templateId: 't1' },
  theme:         'formaFit',
});

describe('buildBackupPayload', () => {
  it('lleva los nueve campos de datos y la cabecera del formato', () => {
    const payload = buildBackupPayload(estado());

    expect(Object.keys(payload).sort()).toEqual([
      'appName', 'blockPresets', 'clientLogs', 'clients', 'customExercises',
      'exportDate', 'exportType', 'profile', 'programs', 'sessionTemplates',
      'tagRegistry', 'version', 'workoutLog',
    ]);
    expect(payload.version).toBe('4');
    expect(payload.exportType).toBe('full');
    expect(payload.programs).toEqual({ p1: { id: 'p1' } });
    expect(payload.clientLogs).toEqual({ cli_1: [{ id: 's2' }] });
  });

  it('lleva el registro de etiquetas y los presets de bloque', () => {
    // Cada cliente guarda IDs (`tag_a1b2c3d4`); el nombre vive sólo en el
    // registro. Sin él, restaurar devuelve etiquetas sin nombre (fallo 25).
    const payload = buildBackupPayload(estado());

    expect(payload.tagRegistry).toEqual([{ id: 'tag_1', name: 'Lesionado' }]);
    expect(payload.blockPresets).toEqual([{ presetId: 'pre_1', format: 'amrap' }]);
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
    expect(payload.tagRegistry).toEqual([]);
    expect(payload.blockPresets).toEqual([]);
  });

  it('sale del blob de zustand tal cual lo lee la tarea de fondo', () => {
    // Lo que hay bajo la clave de persistencia es `{ state, version }`.
    const blob = JSON.stringify({ state: estado(), version: 0 });

    const payload = buildBackupPayload(JSON.parse(blob).state);

    expect(payload.programs).toEqual({ p1: { id: 'p1' } });
    expect(BACKUP_STORAGE_KEY).toBe('fc_tracker_v1');
  });
});
