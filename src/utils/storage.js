const EXT = '.fcdata';

export function downloadJSON(jsonString, name = 'fc-backup') {
  const safe = name.replace(/[^a-zA-Z0-9áéíóúñ\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safe}${EXT}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportFullBackup(storeState) {
  const { profile, workoutLog, programs, sessionTemplates, userPrograms, customExercises } = storeState;
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
  }, null, 2);
}

export function exportProgramOnly(storeState) {
  const { profile, programs, sessionTemplates, userPrograms, customExercises } = storeState;
  const activeProgramId = profile.activeProgramId;
  const program = programs[activeProgramId];
  if (!program) return JSON.stringify({ version: '2', exportType: 'program', appName: 'Fuerza & Control' });

  const relevantTemplates = {};
  const relevantUserPrograms = {};
  (program.days ?? []).forEach(({ sessionTemplateId }) => {
    if (sessionTemplates[sessionTemplateId]) relevantTemplates[sessionTemplateId] = sessionTemplates[sessionTemplateId];
    if (userPrograms[sessionTemplateId]) relevantUserPrograms[sessionTemplateId] = userPrograms[sessionTemplateId];
  });

  return JSON.stringify({
    version: '2',
    exportDate: new Date().toISOString().split('T')[0],
    exportType: 'program',
    appName: 'Fuerza & Control',
    program: { ...program, mode: 'personal', status: 'active' },
    sessionTemplates: relevantTemplates,
    userPrograms: relevantUserPrograms,
    customExercises: {},
    workoutLog: [],
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
