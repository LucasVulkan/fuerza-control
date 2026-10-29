// Guarda de M03-01 §5.4: entrar, cambiar y salir de la cuenta del entrenador
// pasa solo por las acciones de CUENTA DE ENTRENADOR del store. Si algo de
// `src/` vuelve a hablar con Supabase para esto, la lógica se reparte otra vez.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));
const DEFINES_THEM = join(SRC, 'services', 'supabaseAuth.js');
const FORBIDDEN = /\b(trainerCandidateFromIdToken|trainerCandidateFromCode|trainerCandidateNewCode|adoptTrainer|signInTrainerWithCode|signOutTrainer|deleteTrainerUser)\b/;

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(jsx?|tsx?)$/.test(name) && !name.includes('.test.') ? [p] : [];
  });
}

const STORE = join(SRC, '..', 'store');
const CLIENT_LINK = join(SRC, 'utils', 'clientLink.js');

describe('cuenta de entrenador — una sola puerta', () => {
  it('fuera del store nadie entra ni sale de la cuenta por su cuenta', () => {
    const offenders = sources(SRC)
      .filter((p) => p !== DEFINES_THEM && FORBIDDEN.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });

  // C10-01: los hechos de conexión de la ficha solo los escribe `clientLink.js`.
  it('ninguna bandera sync* de antes de C10-01 fuera de migrateClientLinks', () => {
    const OLD = /\b(syncSlotId|syncLinked|syncOrphan|syncPending|syncLeftAt|syncCode)\b/;
    const migrate = readFileSync(CLIENT_LINK, 'utf8').match(/export function migrateClientLinks[\s\S]*?\n}\n/)?.[0] ?? '';
    expect(migrate).toContain('syncSlotId');   // la regla busca donde debe
    const offenders = [...sources(SRC), ...sources(STORE)].filter((p) => {
      const text = readFileSync(p, 'utf8');
      return OLD.test(p === CLIENT_LINK ? text.replace(migrate, '') : text);
    });
    expect(offenders).toEqual([]);
  });

  it('ningún `seated:` ni `slotOwner:` fuera de clientLink.js: los hechos se escriben con sus funciones', () => {
    const offenders = [...sources(SRC), ...sources(STORE)]
      .filter((p) => p !== CLIENT_LINK && /\b(seated|slotOwner)\s*:/.test(readFileSync(p, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
