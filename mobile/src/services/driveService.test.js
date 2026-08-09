/**
 * Lo comprobable sin red de `driveService`: el separador multipart y que todo
 * fallo HTTP salga con `err.status`, que es de lo que depende el refresco de
 * token en `_withDriveToken`.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  uploadBackup, downloadBackup, deleteFile, pruneOldBackups, findOrCreateFolder,
  refreshAccessToken, exchangeCodeForTokens,
} from './driveService';

/** `fetch` que responde siempre lo mismo y guarda con qué se le llamó. */
function stubFetch(response) {
  const calls = [];
  vi.stubGlobal('fetch', async (url, opts) => {
    calls.push({ url, opts });
    return response;
  });
  return calls;
}

const ok   = (json = {}) => ({ ok: true,  status: 200, json: async () => json });
const fail = (status)    => ({ ok: false, status, json: async () => ({}) });

afterEach(() => { vi.unstubAllGlobals(); });

describe('uploadBackup — separador multipart', () => {
  it('usa un separador distinto en cada subida', async () => {
    const calls = stubFetch(ok({ id: 'f1' }));

    await uploadBackup('tok', 'folder', 'a.json', '{}');
    await uploadBackup('tok', 'folder', 'b.json', '{}');

    const boundaryOf = (c) => c.opts.headers['Content-Type'].split('boundary=')[1];
    expect(boundaryOf(calls[0])).not.toBe(boundaryOf(calls[1]));
  });

  it('el separador no aparece dentro del contenido del usuario', async () => {
    // El caso que rompía: una nota con el separador fijo escrito a mano.
    const contenido = JSON.stringify({ nota: '--fc_backup_bound' });
    const calls = stubFetch(ok({ id: 'f1' }));

    await uploadBackup('tok', 'folder', 'a.json', contenido);

    const boundary = calls[0].opts.headers['Content-Type'].split('boundary=')[1];
    expect(contenido).not.toContain(boundary);
  });
});

describe('err.status en todos los fallos HTTP', () => {
  // Si alguno de estos se queda sin `status`, `_withDriveToken` deja de
  // refrescar el token por ese camino y no lo dice.
  const casos = [
    ['findOrCreateFolder',   () => findOrCreateFolder('tok')],
    ['uploadBackup',         () => uploadBackup('tok', 'f', 'a.json', '{}')],
    ['downloadBackup',       () => downloadBackup('tok', 'id')],
    ['deleteFile',           () => deleteFile('tok', 'id')],
    ['refreshAccessToken',   () => refreshAccessToken('rt', 'cid')],
    ['exchangeCodeForTokens', () => exchangeCodeForTokens({ code: 'c', codeVerifier: 'v', redirectUri: 'r', clientId: 'i' })],
  ];

  it.each(casos)('%s adjunta el código', async (_nombre, llamada) => {
    stubFetch(fail(401));

    await expect(llamada()).rejects.toMatchObject({ status: 401 });
  });
});

describe('pruneOldBackups', () => {
  it('no propaga el fallo de un borrado: es limpieza, no la copia', async () => {
    // Un 401 aquí llegaría después de que la subida ya hubiera terminado, y
    // haría que `_withDriveToken` reintentase el callback entero → doble subida.
    const files = Array.from({ length: 32 }, (_, i) => ({ id: `f${i}` }));
    vi.stubGlobal('fetch', async (url, opts) =>
      (opts?.method === 'DELETE' ? fail(401) : ok({ files })));

    await expect(pruneOldBackups('tok', 'folder')).resolves.toBeUndefined();
  });
});
