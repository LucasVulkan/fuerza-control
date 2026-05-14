const EXPORT_VERSION = '1';

export function exportToJSON(storeState) {
  return JSON.stringify({
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString().split('T')[0],
    appName: 'Fuerza & Control',
    profile: storeState.profile,
    workoutLog: storeState.workoutLog,
  }, null, 2);
}

export function downloadJSON(jsonString) {
  const date = new Date().toISOString().split('T')[0];
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fc-tracker-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importFromJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.version) return { ok: false, error: 'El archivo no tiene campo "version". No es un backup válido.' };
    if (parsed.version !== EXPORT_VERSION) return { ok: false, error: `Versión del backup (${parsed.version}) no compatible.` };
    if (!Array.isArray(parsed.workoutLog)) return { ok: false, error: 'El backup no contiene un historial válido.' };
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
