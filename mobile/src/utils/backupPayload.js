/**
 * El formato del backup completo, definido en un solo sitio.
 *
 * Lo construyen tres sitios distintos y hasta ago-2026 cada uno repetía el
 * objeto literal: exportar a archivo (`exportFullBackup`), subir a Drive
 * (`performDriveBackup`) y la tarea de fondo (`driveBackupTask`). Esta última
 * no podía: no tiene acceso al store, así que leía un snapshot que alguien
 * tenía que haber dejado preparado — y casi nunca estaba (fallo 3 de la
 * auditoría).
 *
 * De ahí que la entrada sea un objeto plano y no el store: sirve igual para el
 * estado en vivo (`get()`) que para el que zustand deja persistido en
 * AsyncStorage, que es lo único que la tarea de fondo puede leer. Como zustand
 * lo reescribe en cada cambio, la copia programada deja de subir una foto vieja.
 *
 * Lo que NO viaja es tan importante como lo que viaja: `driveBackup` lleva
 * carpeta y correo de Drive, y `trainerSync` / `clientSync` llevan credenciales
 * de sincronización. Un `.fitdata` se comparte por WhatsApp.
 */

/** Clave de zustand-persist. La tarea de fondo lee de aquí. */
export const BACKUP_STORAGE_KEY = 'fc_tracker_v1';

/**
 * @param {object} state Estado del store, en vivo o rehidratado de AsyncStorage.
 * @returns {object} El payload del backup, listo para `JSON.stringify`.
 */
export function buildBackupPayload(state = {}) {
  return {
    version:    '4',
    exportType: 'full',
    exportDate: new Date().toISOString().split('T')[0],
    appName:    'Forma Fit',

    profile:          state.profile,
    workoutLog:       state.workoutLog ?? [],
    clientLogs:       state.clientLogs ?? {},
    programs:         state.programs,
    sessionTemplates: state.sessionTemplates,
    customExercises:  state.customExercises,
    blockPresets:     state.blockPresets ?? [],
    clients:          state.clients ?? {},
    // Los clientes guardan IDs de etiqueta (`tag_a1b2c3d4`); el nombre vive sólo
    // aquí. Sin el registro, un backup restaurado devuelve clientes etiquetados
    // con códigos sin nombre (fallo 25).
    tagRegistry:      state.tagRegistry ?? [],
  };
}

/**
 * El backup como cadena, con el mismo formato en los tres sitios que lo
 * escriben. Separado de `buildBackupPayload` para que los tests miren el
 * objeto y no una cadena.
 */
export function buildBackupJson(state) {
  return JSON.stringify(buildBackupPayload(state), null, 2);
}
