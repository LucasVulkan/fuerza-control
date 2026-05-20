export function downloadJSON(jsonString, name = 'fc-backup') {
  const safe = name
    .replace(/\.json$|\.fcdata$/i, '')
    .replace(/[^a-zA-Z0-9áéíóúñ\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportFullBackup(storeState) {
  const { profile, workoutLog, programs, sessionTemplates, userPrograms, customExercises, clients } = storeState;
  return JSON.stringify({
    version: '2',
    exportDate: new Date().toISOString().split('T')[0],
    exportType: 'full',
    appName: 'Fuerza & Control',
    profile,
    programs,
    sessionTemplates,
    userPrograms,
    customExercises,
    workoutLog,
    clients: clients ?? {},
  }, null, 2);
}

// Exporta el programa activo + su historial (para que el cliente se lo devuelva al entrenador)
export function exportProgramWithLog(storeState) {
  const { profile, programs, sessionTemplates, userPrograms, customExercises, workoutLog } = storeState;
  const activeProgramId = profile.activeProgramId;
  const program = programs[activeProgramId];
  if (!program) return null;

  // Recoger template IDs de TODAS las etapas (no solo la etapa activa)
  const templateIds = new Set();
  if (program.stages?.length > 0) {
    program.stages.forEach((st) => st.days.forEach((d) => templateIds.add(d.sessionTemplateId)));
  } else {
    program.days.forEach((d) => templateIds.add(d.sessionTemplateId));
  }

  const relevantTemplates = {};
  const relevantUserPrograms = {};
  templateIds.forEach((id) => {
    if (sessionTemplates[id]) relevantTemplates[id] = sessionTemplates[id];
    if (userPrograms[id]) relevantUserPrograms[id] = userPrograms[id];
  });

  const usedExerciseIds = new Set(
    [...Object.values(relevantTemplates), ...Object.values(relevantUserPrograms)]
      .flatMap((t) => (t.exercises ?? []).map((e) => e.exerciseId))
  );
  const referencedCustom = {};
  Object.entries(customExercises ?? {}).forEach(([id, def]) => {
    if (usedExerciseIds.has(id)) referencedCustom[id] = def;
  });

  // El log incluye sesiones de TODAS las etapas del programa
  const relevantLog = workoutLog.filter((e) => templateIds.has(e.sessionTemplateId));

  return JSON.stringify({
    version: '2',
    exportDate: new Date().toISOString().split('T')[0],
    exportType: 'program_with_log',
    appName: 'Fuerza & Control',
    program: { ...program, mode: 'personal', status: 'active' },
    sessionTemplates: relevantTemplates,
    userPrograms: relevantUserPrograms,
    customExercises: referencedCustom,
    workoutLog: relevantLog,
  }, null, 2);
}

export function parseImportFile(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.version) return { ok: false, error: 'El archivo no tiene campo "version". No es un backup válido.' };
    if (!['1', '2'].includes(String(parsed.version))) return { ok: false, error: `Versión del backup (${parsed.version}) no compatible.` };
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsText(file);
  });
}
