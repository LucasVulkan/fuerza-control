const EXPORT_VERSION = '2';
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
