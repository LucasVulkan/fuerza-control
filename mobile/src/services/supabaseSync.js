/**
 * Supabase data sync service.
 *
 * Handles all reads/writes to the trainer_clients table:
 *  - createClientSlot   → trainer creates a new client slot (generates client_code)
 *  - uploadProgram      → trainer pushes active program to client slot
 *  - uploadHistory      → client pushes their workout log to their slot
 *  - downloadHistory    → trainer pulls client's workout log
 *  - getSlotByClientCode → client looks up their slot by entering the code
 *  - linkClientToSlot   → client links their anonymous userId to the slot
 */

import { supabase } from '../config/supabase';

/**
 * Las RPC del modelo de conexión lanzan códigos secos (`SLOT_OCCUPIED`,
 * `CODE_NOT_FOUND`…) en vez de frases. Postgres los entrega dentro del mensaje,
 * así que aquí se extraen a `err.code` y quien llama ramifica por el código, no
 * por una subcadena — misma lección que el §19 de la auditoría: un mensaje
 * reformulado no puede romper una decisión en silencio.
 *
 * Ver `supabase/connection_model.sql`.
 */
const RPC_CODES = [
  'SLOT_OCCUPIED',
  'CODE_NOT_FOUND',
  'SLOT_NOT_FOUND_OR_NOT_YOURS',
  'NEW_TRAINER_REQUIRED',
  'CODE_GENERATION_FAILED',
];

function rpcError(error) {
  const err = new Error(error?.message ?? 'Error de sincronización');
  err.code = RPC_CODES.find((c) => error?.message?.includes(c)) ?? null;
  return err;
}

/** Generates a short client code in the format XXXX-XXXX (easy to type). */
function generateClientCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code; // e.g. "XK7M-2P4T"
}

/**
 * Creates a new client slot for the trainer.
 * Returns { slotId, clientCode }.
 */
export async function createClientSlot(trainerId, clientName) {
  const clientCode = generateClientCode();

  const { data, error } = await supabase
    .from('trainer_clients')
    .insert({
      trainer_id:   trainerId,
      client_name:  clientName,
      client_code:  clientCode,
    })
    .select('id')
    .single();

  if (error) throw error;

  return { slotId: data.id, clientCode };
}

/**
 * Uploads the trainer's program JSON for a specific client slot.
 * Optionally updates trainer_name at the same time (avoids an extra round-trip).
 *
 * @param {string}      slotId
 * @param {object}      programJson
 * @param {string|null} [trainerName]  — pass to update the column; omit to leave unchanged
 */
export async function uploadProgram(slotId, programJson, trainerName) {
  const payload = {
    program_json:       programJson,
    program_updated_at: new Date().toISOString(),
  };
  if (trainerName !== undefined) payload.trainer_name = trainerName ?? null;

  const { error } = await supabase
    .from('trainer_clients')
    .update(payload)
    .eq('id', slotId);

  if (error) throw error;
}

/**
 * Updates trainer_name on ALL slots that belong to this trainer.
 * Called when the trainer changes their display name from the settings.
 *
 * @param {string}      trainerId   — trainer's Supabase user.id
 * @param {string|null} trainerName
 */
export async function updateTrainerNameForSlots(trainerId, trainerName) {
  const { error } = await supabase
    .from('trainer_clients')
    .update({ trainer_name: trainerName ?? null })
    .eq('trainer_id', trainerId);

  if (error) throw error;
}

/**
 * Uploads the client's workout history JSON to their slot.
 * Called by the client after each session save.
 */
/**
 * Payload format: { entries, customExercises, progress }
 *  - entries:         WorkoutEntry[] — pre-filtered by the client to trainer scope
 *  - customExercises: Record<id, def> — only defs referenced by entries
 *  - progress:        the client's cycle/stage counters — the trainer MIRRORS
 *                     these rather than recomputing them from `entries`, and the
 *                     client restores them from here after a reinstall.
 *                     See `docs/specs/stage-locks.md` §3.
 * Backward-compat: old clients uploaded a plain array — downloadHistory handles both.
 */
export async function uploadHistory(slotId, entries, customExercises = {}, progress = null) {
  const payload = { entries, customExercises, progress };
  const { error } = await supabase
    .from('trainer_clients')
    .update({
      history_json:       payload,
      history_updated_at: new Date().toISOString(),
      sessions_count:     entries.length,
    })
    .eq('id', slotId);

  if (error) throw error;
}

/**
 * Uploads the trainer's next-session overrides (one-off prescriptions) for a
 * client slot. Map keyed by templateId; {} clears them.
 */
export async function uploadOverrides(slotId, overrides) {
  const { error } = await supabase
    .from('trainer_clients')
    .update({
      overrides_json:       overrides ?? {},
      overrides_updated_at: new Date().toISOString(),
    })
    .eq('id', slotId);

  if (error) throw error;
}

/**
 * Downloads the trainer's program JSON for a client slot.
 * Called by the client on startup to check for program updates.
 * Returns { programJson, updatedAt, trainerName, overrides }.
 */
export async function downloadProgram(slotId) {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select('program_json, program_updated_at, trainer_name, overrides_json')
    .eq('id', slotId)
    .single();

  if (error) throw error;

  return {
    programJson:  data.program_json ?? null,
    updatedAt:    data.program_updated_at ?? null,
    trainerName:  data.trainer_name ?? null,
    overrides:    data.overrides_json ?? {},
  };
}

/**
 * Downloads the client's workout history JSON.
 * Called by the trainer when they tap "Actualizar".
 * Returns the raw history array (parsed from JSON).
 */
export async function downloadHistory(slotId) {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select('history_json, history_updated_at')
    .eq('id', slotId)
    .single();

  if (error) throw error;

  const raw = data.history_json;
  // Support both new format { entries, customExercises, progress } and legacy plain array
  const isNewFormat = raw && !Array.isArray(raw) && raw.entries !== undefined;
  return {
    history:         isNewFormat ? (raw.entries ?? []) : (raw ?? []),
    customExercises: isNewFormat ? (raw.customExercises ?? {}) : {},
    progress:        isNewFormat ? (raw.progress ?? null) : null,
    updatedAt:       data.history_updated_at,
  };
}

/**
 * Consulta el hueco que corresponde a un código, sin vincularse.
 *
 * Devuelve solo lo justo para pintar la pantalla de confirmación:
 * `{ id, client_name, program_name, program_updated_at, is_linked,
 *    history_updated_at, trainer_name }`.
 *
 * Ya NO devuelve `client_id` (era la mitad de los argumentos de
 * `transferClientSlot`, o sea una segunda puerta al asiento del cliente),
 * `trainer_id` (no lo usaba nadie) ni `program_json` (el programa entero a
 * quien supiera un código). El programa se descarga después de vincularse.
 */
export async function getSlotByClientCode(clientCode) {
  const { data, error } = await supabase.rpc('get_slot_by_code', { p_code: clientCode });
  if (error) throw rpcError(error);
  return data?.[0] ?? null;
}

/**
 * Ocupa el asiento del hueco que corresponde al código.
 *
 * El código **solo abre asientos vacíos**. Si el hueco está ocupado por otro,
 * lanza `SLOT_OCCUPIED` y el camino es que el entrenador reemita el código
 * (`reissueClientCode`), no desalojar: el servidor no puede distinguir "soy yo
 * otra vez tras reinstalar" de "soy otro con su código".
 *
 * Reintentar siendo ya el ocupante está permitido — es idempotente.
 * Ver `docs/specs/client-connection.md` §3.
 */
export async function linkClientToSlot(clientCode) {
  const { data, error } = await supabase.rpc('link_client_to_slot', { p_code: clientCode });
  if (error) throw rpcError(error);
  return data;
}

/**
 * El entrenador reemite el código de uno de sus clientes: código nuevo **y**
 * asiento liberado, sin tocar el historial.
 *
 * Las dos cosas van juntas a propósito: un código nuevo sobre un asiento
 * ocupado no serviría de nada. Sostiene la reconexión tras reinstalar, el
 * código perdido, y la revocación de un código filtrado.
 *
 * Devuelve el código nuevo.
 */
export async function reissueClientCode(slotId) {
  const { data, error } = await supabase.rpc('trainer_reissue_client_code', { p_slot_id: slotId });
  if (error) throw rpcError(error);
  return data;
}

/**
 * Cede TODOS los huecos del entrenador autenticado ahora mismo a otro usuario.
 *
 * Se llama estando autenticado como el dueño **viejo**: el `where trainer_id =
 * auth.uid()` del servidor es toda la autorización que hace falta, porque solo
 * puedes regalar lo que ya es tuyo. Sustituye a `claimTrainerSlots`, que hacía
 * lo contrario —reclamar por id, sin comprobar nada— y era el fallo 26.
 *
 * Devuelve cuántos huecos se movieron.
 */
export async function transferMySlotsTo(newTrainerId) {
  const { data, error } = await supabase.rpc('transfer_my_slots_to', { p_new_trainer_id: newTrainerId });
  if (error) throw rpcError(error);
  return data ?? 0;
}

/**
 * Transfers a list of slot IDs to the currently authenticated trainer.
 * Called after creating a new trainer code account so old slots are not lost.
 * Requires the `claim_trainer_slots` SQL function in Supabase (SECURITY DEFINER).
 */
export async function claimTrainerSlots(slotIds) {
  if (!slotIds?.length) return;
  const { error } = await supabase.rpc('claim_trainer_slots', { slot_ids: slotIds });
  if (error) throw error;
}

/**
 * Permanently deletes a client slot from Supabase.
 * Called when the trainer deletes a client — invalidates the client code entirely.
 */
export async function deleteClientSlot(slotId) {
  const { error } = await supabase
    .from('trainer_clients')
    .delete()
    .eq('id', slotId);

  if (error) throw error;
}

/**
 * El cliente suelta el hueco que ocupa y borra lo suyo (historial, overrides),
 * dejando el programa, el nombre y el código, que son del entrenador.
 *
 * Va por RPC y no por un update directo porque la política
 * "Client can update their slot" lleva `with check (auth.uid() = client_id)`:
 * poner `client_id = null` la incumple, así que el cliente no puede soltarse a
 * sí mismo con un update normal. Ver supabase/release_client_slot.sql.
 *
 * Devuelve cuántas filas se soltaron (0 si no había ninguna: no es un error).
 */
export async function releaseClientSlot() {
  const { data, error } = await supabase.rpc('release_client_slot');
  if (error) throw error;
  return data ?? 0;
}

/**
 * Looks up a client slot by the currently-authenticated Google user ID.
 * Used for auto-reconnect: after Google sign-in, check whether this user
 * already has a linked trainer_clients row.
 * Requires the RLS policy "client_can_read_own_slot" (client_id = auth.uid()).
 *
 * Returns the slot row or null if not found.
 */
export async function getClientSlotByUserId(userId) {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select('id, program_json, program_updated_at, history_updated_at, trainer_name')
    .eq('client_id', userId)
    .maybeSingle();   // returns null instead of throwing when no row found

  if (error) throw error;
  return data;        // null if no linked slot
}

/**
 * Transfers a trainer_clients row from one client user to another.
 * Called AFTER Google login (auth.uid() = new Google user ID).
 * The RPC verifies: caller == p_new_client_id AND current client_id == p_old_client_id.
 * Requires the transfer_client_slot SQL function (SECURITY DEFINER) in Supabase.
 */
export async function transferClientSlot(slotId, oldClientId, newClientId) {
  const { error } = await supabase.rpc('transfer_client_slot', {
    p_slot_id:        slotId,
    p_old_client_id:  oldClientId,
    p_new_client_id:  newClientId,
  });
  if (error) throw error;
}

/**
 * Fetches all client slots for a trainer.
 * Returns array of slot rows.
 */
export async function getTrainerSlots(trainerId) {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select('id, client_name, client_code, client_id, history_updated_at, disconnected_at, sessions_count')
    .eq('trainer_id', trainerId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data ?? [];
}
