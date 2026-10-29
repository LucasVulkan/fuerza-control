/**
 * clientLink — el estado de la conexión de una ficha, en UN sitio
 * (docs/specs/C10-clientes-de-la-cuenta.md §3.2, N-15).
 *
 * La ficha guarda solo CINCO HECHOS de lo que el servidor dijo de su hueco:
 *
 *   slotId     el hueco; null = sin hueco
 *   slotOwner  user id de la cuenta donde estaba; null = ya no está en ninguna que conozcamos
 *   code       client_code
 *   seated     hay alguien dentro (client_id no es null)
 *   leftAt     disconnected_at, solo con el asiento vacío
 *
 * El estado (`linkOf`) se calcula siempre de ellos y nunca se guarda, así que
 * no puede contradecirlos. Los hechos solo se escriben con las funciones de
 * este archivo (`slotFacts`, `codeGiven`, `NO_SLOT`…), nunca campo a campo:
 * una regla de `accountBoundary.test.js` lo vigila. Puro: sin imports del store.
 */

/**
 * 'local'        sin hueco (sin cuenta, o con cuenta y aún por subir)
 * 'none'         hueco sin código: sin app, guardado en la cuenta
 * 'invited'      tiene código, nadie dentro
 * 'linked'       el cliente está dentro
 * 'left'         se fue él; el código le sirve para volver
 * 'otherAccount' su hueco no es de la cuenta puesta (o no hay cuenta puesta)
 */
export function linkOf(c, userId) {
  if (!c?.slotId) return 'local';
  if (!userId || c.slotOwner !== userId) return 'otherAccount';
  if (!c.code) return 'none';
  if (c.seated) return 'linked';
  return c.leftAt ? 'left' : 'invited';
}

export const withApp     = (link) => link === 'invited' || link === 'linked' || link === 'left';
export const canSend     = withApp;
export const canSave     = (link) => link === 'none' || withApp(link);
export const isReadOnly  = (link) => link === 'otherAccount';

/**
 * La lectura de las pantallas de hoy: 'none' | 'invited' | 'linked'. `left`
 * se enseña como invitado (el código le vuelve a servir); lo que no se puede
 * enviar, como 'none'.
 */
export function clientLink(c, trainerSync) {
  const link = linkOf(c, trainerSync?.userId);
  if (link === 'linked') return 'linked';
  return link === 'invited' || link === 'left' ? 'invited' : 'none';
}

/** ¿Tiene hueco en una cuenta que conocemos? (sea o no la puesta ahora) */
export const hasSlot = (c) => !!c?.slotId && !!c.slotOwner;

// ── Escritores: lo único que escribe hechos ──────────────────────────────────

/** Copia de una fila del servidor (puede venir parcial: `{ id, client_code }`). */
export const slotFacts = (slot, owner) => ({
  slotId:    slot.id,
  slotOwner: owner,
  code:      slot.client_code ?? null,
  seated:    !!slot.client_id,
  leftAt:    !slot.client_id && slot.disconnected_at ? slot.disconnected_at : null,
});

/** Invitar o reemitir: código nuevo y el asiento vacío. */
export const codeGiven = (code) => ({ code, seated: false, leftAt: null });

export const CODE_CLEARED = { code: null, seated: false, leftAt: null };
export const NO_SLOT      = { slotId: null, slotOwner: null, code: null, seated: false, leftAt: null };

/** El hueco falta y esta cuenta no lo borró (o el envío recibió SLOT_GONE). */
export const SLOT_LOST    = { slotOwner: null };

/** El servidor dijo `SLOT_OCCUPIED`: alguien ya está dentro. */
export const SEATED       = { seated: true, leftAt: null };

/** Entrar en otra cuenta sin salir: los huecos se traspasaron, las fichas van con ellos. */
export function moveOwner(clients, from, to) {
  if (!from || from === to) return clients;
  let out = clients;
  for (const [id, c] of Object.entries(clients ?? {})) {
    if (c?.slotOwner !== from) continue;
    if (out === clients) out = { ...clients };
    out[id] = { ...c, slotOwner: to };
  }
  return out;
}

// ── Migración (§4.1) ─────────────────────────────────────────────────────────

/**
 * Fichas con las banderas de antes → hechos. Idempotente: una ficha que ya
 * tiene `seated` no se toca. Es el ÚNICO sitio que nombra las banderas viejas.
 */
export function migrateClientLinks(clients, trainerSync) {
  const userId = trainerSync?.userId;
  let out = clients;
  for (const [id, c] of Object.entries(clients ?? {})) {
    if (!c || 'seated' in c || 'slotId' in c) continue;   // ya con hechos (aunque a medias): no se pisa
    const { syncSlotId, syncCode, syncLinked, syncOrphan, syncLeftAt, syncPending, ...rest } = c;   // eslint-disable-line no-unused-vars
    const facts = !syncSlotId ? NO_SLOT : {
      slotId:    syncSlotId,
      slotOwner: syncOrphan || !userId ? null : userId,
      code:      syncCode ?? null,
      seated:    !!syncLinked,
      leftAt:    syncLinked ? null : syncLeftAt ?? null,
    };
    if (out === clients) out = { ...clients };
    out[id] = { ...rest, ...facts };
  }
  return out;
}

/** Para los tests: lanza si los hechos de la ficha se contradicen. */
export function assertFacts(c) {
  const bad = (msg) => { throw new Error(`ficha ${c?.id}: ${msg} ${JSON.stringify({ slotId: c.slotId, slotOwner: c.slotOwner, code: c.code, seated: c.seated, leftAt: c.leftAt })}`); };
  if (!('seated' in c)) bad('sin hechos');
  if (!c.slotId && (c.slotOwner || c.code || c.seated || c.leftAt)) bad('hechos sin hueco');
  if (c.seated && !c.code) bad('sentado sin código');
  if (c.seated && c.leftAt) bad('se fue estando dentro');
}
