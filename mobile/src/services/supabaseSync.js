/**
 * Lo que entrenador y cliente se mandan por `trainer_clients` (C09).
 *
 * Toda ESCRITURA es una función del servidor (`supabase/schema.sql`) que
 * comprueba de quién es la fila y falla con un código si no la encuentra.
 * Antes eran `update`s directos: si la RLS filtraba la fila daban 0 filas y
 * ningún error, y la app daba por enviado lo que no había llegado.
 *
 * Las de entrenador van con `trainerSupabase`, las de cliente con
 * `clientSupabase`: cada papel con su sesión (C09 §2.1).
 *
 * Los errores llevan `err.code` y se ramifica por él, nunca por el texto:
 *   SLOT_GONE / NO_SEAT  el servidor CONTESTÓ que ese hueco no es tuyo o no
 *                        existe. Es definitivo.
 *   NETWORK              no hubo respuesta. No dice nada del hueco: se reintenta.
 */

import { trainerSupabase, clientSupabase, sessionsReady } from '../config/supabase';
import { userIdOf as myId } from './supabaseAuth';

const RPC_CODES = [
  'SLOT_OCCUPIED', 'CODE_NOT_FOUND', 'SLOT_GONE', 'NO_SEAT', 'SEAT_TAKEN', 'SEAT_LOCKED', 'BAD_TARGET',
  'NOT_A_TRAINER', 'NOT_AUTHENTICATED', 'NO_OFFER', 'CODE_GENERATION_FAILED', 'SLOT_CHANGED',
];

// Lo que dice supabase-js (fetch de RN y de Node) cuando no hay red.
const NETWORK_RE = /Failed to fetch|Network request failed|fetch failed|NetworkError/i;

export function syncError(error) {
  const msg = error?.message ?? 'Error de sincronización';
  const err = new Error(msg);
  err.code = RPC_CODES.find((c) => msg.includes(c)) ?? (NETWORK_RE.test(msg) ? 'NETWORK' : null);
  return err;
}

async function rpc(db, name, args) {
  await sessionsReady();   // la sesión de la versión anterior aún se está traspasando
  const { data, error } = await db.rpc(name, args);
  if (error) throw syncError(error);
  return data;
}

// ═══ Entrenador ═══════════════════════════════════════════════════════════════

/**
 * Hueco nuevo; el código lo genera el servidor, que sabe cuáles existen. Con
 * `localId` (el id de la ficha) repetir el alta devuelve el mismo hueco.
 */
export async function createClientSlot(clientName, localId = null) {
  const [row] = await rpc(trainerSupabase, 'trainer_create_slot', { p_client_name: clientName, p_local_id: localId });
  return { slotId: row.slot_id, clientCode: row.code };
}

export function uploadProgram(slotId, programJson, trainerName) {
  return rpc(trainerSupabase, 'trainer_upload_program', {
    p_slot_id: slotId, p_program: programJson, p_trainer_name: trainerName ?? null,
  });
}

/** El nombre que ven los clientes, en todos los huecos del entrenador. */
export function updateTrainerNameForSlots(trainerName) {
  return rpc(trainerSupabase, 'trainer_set_name', { p_trainer_name: trainerName ?? null });
}

/** Lo que el entrenador apuntó a un invitado (C20); suma a lo que hay. SLOT_OCCUPIED si ya entró. */
export function uploadTrainerLog(slotId, entries, customExercises = {}, progress = null) {
  return rpc(trainerSupabase, 'trainer_upload_log', {
    p_slot_id: slotId, p_history: { entries, customExercises, progress }, p_sessions: entries.length,
  });
}

/** Prescripciones de la próxima sesión, por `templateId`; `{}` las borra. */
export function uploadOverrides(slotId, overrides) {
  return rpc(trainerSupabase, 'trainer_upload_overrides', { p_slot_id: slotId, p_overrides: overrides ?? {} });
}

/** Devuelve si existía. Uno que ya no está no es un error. */
export function deleteClientSlot(slotId) {
  return rpc(trainerSupabase, 'trainer_delete_slot', { p_slot_id: slotId });
}

/** Código nuevo y asiento libre, sin tocar el historial. Devuelve el código. */
export function reissueClientCode(slotId) {
  return rpc(trainerSupabase, 'trainer_reissue_client_code', { p_slot_id: slotId });
}

/** Todos los huecos del entrenador, ligeros: sin programa ni historial. */
export async function getTrainerSlots() {
  const { data, error } = await trainerSupabase
    .from('trainer_clients')
    .select('id, client_name, client_code, client_id, history_updated_at, disconnected_at, sessions_count, progress:history_json->progress')
    .eq('trainer_id', await myId(trainerSupabase))
    .order('created_at', { ascending: true });
  if (error) throw syncError(error);
  return data ?? [];
}

/** Lee un hueco del entrenador; SLOT_GONE si ya no es suyo. */
async function trainerSlot(slotId, cols) {
  const { data, error } = await trainerSupabase.from('trainer_clients').select(cols)
    .eq('id', slotId).eq('trainer_id', await myId(trainerSupabase)).maybeSingle();
  if (error) throw syncError(error);
  if (!data) throw Object.assign(new Error('SLOT_GONE'), { code: 'SLOT_GONE' });
  return data;
}

/** El programa que hay en el hueco: para recuperarlo al reinstalar. */
export async function downloadSlotProgram(slotId) {
  return (await trainerSlot(slotId, 'program_json')).program_json ?? null;
}

/** Historial del cliente (formato nuevo `{ entries, customExercises, progress }` o lista vieja). */
export async function downloadHistory(slotId) {
  const data = await trainerSlot(slotId, 'history_json, history_updated_at');
  return { ...parseHistory(data.history_json), updatedAt: data.history_updated_at };
}

function parseHistory(raw) {
  const isNewFormat = raw && !Array.isArray(raw) && raw.entries !== undefined;
  return {
    history:         isNewFormat ? (raw.entries ?? []) : (raw ?? []),
    customExercises: isNewFormat ? (raw.customExercises ?? {}) : {},
    progress:        isNewFormat ? (raw.progress ?? null) : null,
  };
}

// ═══ Cliente ══════════════════════════════════════════════════════════════════

/**
 * Lo justo para confirmar un código, sin vincularse:
 * `{ client_name, program_name, trainer_name, is_linked, is_mine, locked_by,
 *    has_history }`.
 */
export async function getSlotByClientCode(clientCode) {
  return (await rpc(clientSupabase, 'get_slot_by_code', { p_code: clientCode }))?.[0] ?? null;
}

/**
 * Ocupa el asiento del código. Si había otro dentro, sale él (C09 §4.6), salvo
 * que entrara con Google/Apple: SEAT_LOCKED (§4.7). Suelta el que el cliente
 * tuviera en otro hueco: un cliente, un asiento.
 */
export function linkClientToSlot(clientCode) {
  return rpc(clientSupabase, 'link_client_to_slot', { p_code: clientCode });
}

const SEAT_COLS = 'id, program_json, program_updated_at, trainer_name, overrides_json, history_json, history_updated_at';

function seatShape(data) {
  return {
    slotId:      data.id,
    programJson: data.program_json ?? null,
    updatedAt:   data.program_updated_at ?? null,
    trainerName: data.trainer_name ?? null,
    overrides:   data.overrides_json ?? {},
    ...parseHistory(data.history_json),
    historyUpdatedAt: data.history_updated_at ?? null,
  };
}

/**
 * El asiento que ocupa la cuenta de `db`, o null si no ocupa ninguno. Null es
 * una RESPUESTA del servidor (te han desconectado), no un fallo de red: los
 * fallos lanzan.
 */
export async function seatOf(db = clientSupabase) {
  const me = await myId(db);
  if (!me) return null;
  const { data, error } = await db.from('trainer_clients').select(SEAT_COLS).eq('client_id', me).maybeSingle();
  if (error) throw syncError(error);
  return data ? seatShape(data) : null;
}

/** Por qué ya no tiene asiento: 'taken' (alguien entró con su código) o 'gone'. */
export function clientLostReason() {
  return rpc(clientSupabase, 'client_lost_reason', {});
}

/**
 * El cliente sube lo suyo al asiento `slotId`; el servidor SUMA a lo que hay (E28).
 * NO_SEAT si ya no tiene asiento; SLOT_CHANGED si ahora tiene otro (E37).
 */
export function uploadHistory(entries, customExercises = {}, progress = null, slotId = null) {
  return rpc(clientSupabase, 'client_upload_history', {
    p_history: { entries, customExercises, progress }, p_sessions: entries.length, p_slot_id: slotId,
  });
}

/** Suelta el asiento; el historial y lo demás se quedan en el hueco (R-B6). Devuelve cuántos (0 no es error). */
export async function releaseClientSlot(db = clientSupabase) {
  return (await rpc(db, 'release_client_slot', {})) ?? 0;
}

// ═══ Traspasos (E29) ══════════════════════════════════════════════════════════
// Dos pasos, cada uno con la sesión de su cuenta: la que cede OFRECE y la que
// recibe ACEPTA. Nadie planta nada en una cuenta que no lo acepta.

/**
 * La cuenta que cede ofrece sus huecos ('slots') o su asiento ('seat') a `toId`.
 * `db` es la sesión de quien cede (por omisión la del papel que corresponde).
 */
export function offerTransfer(kind, toId, db = kind === 'slots' ? trainerSupabase : clientSupabase) {
  return rpc(db, 'offer_transfer', { p_kind: kind, p_to: toId });
}

/**
 * La cuenta que recibe acepta lo que `fromId` le ofreció hace menos de 10
 * minutos (NO_OFFER si no hay). Devuelve las filas movidas; repetirlo tras un
 * corte devuelve 0, no falla. `db` es la sesión de quien recibe.
 */
export async function acceptTransfer(kind, fromId, db) {
  return (await rpc(db, 'accept_transfer', { p_kind: kind, p_from: fromId })) ?? 0;
}
