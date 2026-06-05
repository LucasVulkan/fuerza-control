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
 * Payload format: { entries: WorkoutEntry[], customExercises: Record<id, def> }
 * Backward-compat: old clients uploaded a plain array — downloadHistory handles both.
 */
export async function uploadHistory(slotId, entries, customExercises = {}) {
  const payload = { entries, customExercises };
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
 * Downloads the trainer's program JSON for a client slot.
 * Called by the client on startup to check for program updates.
 * Returns { programJson, updatedAt }.
 */
export async function downloadProgram(slotId) {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select('program_json, program_updated_at, trainer_name')
    .eq('id', slotId)
    .single();

  if (error) throw error;

  return {
    programJson:  data.program_json ?? null,
    updatedAt:    data.program_updated_at ?? null,
    trainerName:  data.trainer_name ?? null,
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
  // Support both new format { entries, customExercises } and legacy plain array
  const isNewFormat = raw && !Array.isArray(raw) && raw.entries !== undefined;
  return {
    history:         isNewFormat ? (raw.entries ?? []) : (raw ?? []),
    customExercises: isNewFormat ? (raw.customExercises ?? {}) : {},
    updatedAt:       data.history_updated_at,
  };
}

/**
 * Looks up a client slot by the client_code the client entered.
 * Returns the slot row or null if not found.
 */
export async function getSlotByClientCode(clientCode) {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select('id, client_name, trainer_id, program_json, program_updated_at, client_id, history_updated_at, trainer_name')
    .eq('client_code', clientCode.trim().toUpperCase())
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // no rows found
    throw error;
  }

  return data;
}

/**
 * Links (or re-links) a client userId to their slot.
 * The code acts as a permanent reconnect credential — no guard on client_id,
 * so a client can re-enter their code after reinstalling or switching devices.
 * If the trainer accidentally shares a code, they can reset the slot from ClientsScreen.
 */
export async function linkClientToSlot(slotId, clientUserId) {
  const { error } = await supabase
    .from('trainer_clients')
    .update({ client_id: clientUserId, disconnected_at: null })
    .eq('id', slotId);

  if (error) throw error;
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
 * Marks a slot as disconnected (client switched trainers or unlinked).
 */
export async function disconnectClientSlot(slotId) {
  const { error } = await supabase
    .from('trainer_clients')
    .update({ client_id: null, disconnected_at: new Date().toISOString() })
    .eq('id', slotId);

  if (error) throw error;
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
