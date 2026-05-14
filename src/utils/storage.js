const EXPORT_VERSION = '2';

// ─── Exportadores ─────────────────────────────────────────────────────────────

/**
 * Exporta el backup completo: perfil + programa activo + custom exercises + historial.
 */
export function exportFullBackup(storeState) {
  const { profile, programs, sessionTemplates, userPrograms, customExercises, workoutLog } = storeState;
  const activeProgramId = profile.activeProgramId;
  const activeProgram = programs[activeProgramId];

  // Recoger solo los templates del programa activo
  const activeTemplateIds = activeProgram?.days.map((d) => d.sessionTemplateId) ?? [];
  const relevantTemplates = {};
  activeTemplateIds.forEach((id) => {
    if (sessionTemplates[id]) relevantTemplates[id] = sessionTemplates[id];
  });
  const relevantUserPrograms = {};
  activeTemplateIds.forEach((id) => {
    if (userPrograms[id]) relevantUserPrograms[id] = userPrograms[id];
  });

  // Recoger solo los custom exercises referenciados en el programa
  const allExerciseIds = new Set(
    activeTemplateIds.flatMap((tplId) => {
      const tpl = userPrograms[tplId] ?? sessionTemplates[tplId];
      return tpl?.exercises.map((e) => e.exerciseId) ?? [];
    })
  );
  const referencedCustom = {};
  Object.entries(customExercises ?? {}).forEach(([id, def]) => {
    if (allExerciseIds.has(id)) referencedCustom[id] = def;
  });

  return JSON.stringify({
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString().split('T')[0],
    exportType: 'full',
    appName: 'Fuerza & Control',
    profile,
    program: activeProgram ?? null,
    sessionTemplates: relevantTemplates,
    userPrograms: relevantUserPrograms,
    customExercises: referencedCustom,
    workoutLog,
  }, null, 2);
}

/**
 * Exporta solo el programa activo (sin historial personal).
 * Útil para que un entrenador comparta el programa con un cliente.
 */
export function exportProgramOnly(storeState) {
  const { profile, programs, sessionTemplates, userPrograms, customExercises } = storeState;
  const activeProgramId = profile.activeProgramId;
  const activeProgram = programs[activeProgramId];

  const activeTemplateIds = activeProgram?.days.map((d) => d.sessionTemplateId) ?? [];
  const relevantTemplates = {};
  activeTemplateIds.forEach((id) => {
    if (sessionTemplates[id]) relevantTemplates[id] = sessionTemplates[id];
  });
  const relevantUserPrograms = {};
  activeTemplateIds.forEach((id) => {
    if (userPrograms[id]) relevantUserPrograms[id] = userPrograms[id];
  });

  const allExerciseIds = new Set(
    activeTemplateIds.flatMap((tplId) => {
      const tpl = userPrograms[tplId] ?? sessionTemplates[tplId];
      return tpl?.exercises.map((e) => e.exerciseId) ?? [];
    })
  );
  const referencedCustom = {};
  Object.entries(customExercises ?? {}).forEach(([id, def]) => {
    if (allExerciseIds.has(id)) referencedCustom[id] = def;
  });

  return JSON.stringify({
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString().split('T')[0],
    exportType: 'program',
    appName: 'Fuerza & Control',
    program: activeProgram ?? null,
    sessionTemplates: relevantTemplates,
    userPrograms: relevantUserPrograms,
    customExercises: referencedCustom,
    workoutLog: [],
  }, null, 2);
}

// ─── Descarga ─────────────────────────────────────────────────────────────────

export function downloadJSON(jsonString, filename) {
  const date = new Date().toISOString().split('T')[0];
  const name = filename
    ? `${filename.replace(/[^a-zA-Z0-9áéíóúüñÁÉÍÓÚÜÑ\s-]/g, '').trim().replace(/\s+/g, '-')}-${date}.json`
    : `fc-backup-${date}.json`;

  const blob = new Blob([jsonString], { type: 'application/json' });

  // Web Share API si está disponible (móvil)
  if (navigator.share && navigator.canShare?.({ files: [new File([blob], name, { type: 'application/json' })] })) {
    const file = new File([blob], name, { type: 'application/json' });
    navigator.share({ files: [file], title: 'Fuerza & Control — Backup' }).catch(() => {
      // Fallback a descarga si el usuario cancela
      _downloadBlob(blob, name);
    });
    return;
  }

  _downloadBlob(blob, name);
}

function _downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Importador ───────────────────────────────────────────────────────────────

/**
 * Valida y parsea un archivo JSON exportado por la app.
 * @returns {{ ok: boolean, data?: object, error?: string }}
 */
export function parseImportFile(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.version) {
      return { ok: false, error: 'El archivo no tiene campo "version". No es un backup válido.' };
    }
    if (parsed.version !== EXPORT_VERSION) {
      // Intentar migrar desde v1
      if (parsed.version === '1') {
        return { ok: true, data: migrateV1(parsed) };
      }
      return { ok: false, error: `Versión del backup (${parsed.version}) no compatible.` };
    }
    if (!parsed.exportType) {
      return { ok: false, error: 'Formato de archivo no reconocido.' };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
}

/**
 * Migra un backup v1 (solo historial) al formato v2.
 */
function migrateV1(v1) {
  return {
    version: EXPORT_VERSION,
    exportDate: v1.exportDate,
    exportType: 'full',
    appName: 'Fuerza & Control',
    profile: v1.profile ?? null,
    program: null,
    sessionTemplates: {},
    userPrograms: {},
    customExercises: {},
    workoutLog: v1.workoutLog ?? [],
  };
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsText(file);
  });
}
