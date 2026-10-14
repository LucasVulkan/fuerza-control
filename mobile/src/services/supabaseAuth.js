/**
 * Las cuentas de Supabase, una por papel (C09 §2.1):
 *
 *  ENTRENADOR (`trainerSupabase`)
 *   - 'code'   → código XXXX-XXXX-XXXX; detrás, un usuario email+contraseña
 *                (email sintético sacado del código, contraseña = el código).
 *                Se recupera escribiendo el código: mismo código, mismo usuario.
 *   - 'google' / 'apple' → id_token del proveedor.
 *
 *  CLIENTE (`clientSupabase`)
 *   - anónimo, invisible para el usuario; o su Google/Apple si lo vincula.
 *
 * Entrar en una cuenta NUEVA (crear, cambiar de forma, «Ya tengo cuenta») se
 * hace en dos pasos para que nada quede a medias:
 *   1. `…Candidate()` entra en un cliente TEMPORAL y devuelve la candidata
 *      (`{ db, session, userId, … }`). La sesión viva no se toca.
 *   2. Quien llama decide (traspasa, comprueba) y solo entonces `adopt…()`
 *      instala la sesión de la candidata. Si algo falla antes, se tira y nada
 *      ha cambiado.
 *
 * Nadie fuera del store llama a esto para la cuenta de entrenador
 * (`src/accountBoundary.test.js`).
 */

import i18n from '../i18n';
import { trainerSupabase, clientSupabase, createTempSupabase } from '../config/supabase';

// Dominio de los correos sintéticos de las cuentas por código: no existe, así
// que Supabase nunca manda correo de verdad.
const CODE_EMAIL_DOMAIN = 'noreply.fuerzacontrol.com';

const normCode = (code) => code.trim().toUpperCase();

/** El código se convierte en un correo determinista. */
function codeToEmail(code) {
  return `trainer-${normCode(code).toLowerCase().replace(/-/g, '')}@${CODE_EMAIL_DOMAIN}`;
}

/** Código de entrenador XXXX-XXXX-XXXX, sin caracteres ambiguos (ni I, O, 0, 1). */
export function generateTrainerCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function coded(code, message) {
  return Object.assign(new Error(message), { code });
}

/**
 * El usuario de la sesión guardada, o null. Si el token caducó y no hay red
 * para renovarlo, LANZA: «sin red» no es «sin sesión», y confundirlos pediría
 * volver a entrar con Google a quien solo está en un ascensor.
 */
async function userIdOf(db) {
  const { data, error } = await db.auth.getSession();
  if (error?.name === 'AuthRetryableFetchError') throw error;
  return data.session?.user?.id ?? null;
}

// ─── Entrenador ───────────────────────────────────────────────────────────────

/** Entra con el código en `db` (temporal o la viva). */
async function passwordSignIn(db, code) {
  const { data, error } = await db.auth.signInWithPassword({ email: codeToEmail(code), password: normCode(code) });
  if (error) {
    if (error.message?.includes('Invalid login')) throw coded('TRAINER_CODE_NOT_FOUND', i18n.t('trainer.errCodeNotFound'));
    throw error;
  }
  return data;
}

/** ¿Este usuario ya es entrenador? Un cliente con ese Google tiene usuario, pero no perfil de entrenador. */
async function isTrainer(db, userId) {
  const { data, error } = await db.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.role === 'trainer';
}

/** Candidata con Google o Apple. `name`: el de la cuenta de Google (Apple lo da aparte). */
export async function trainerCandidateFromIdToken({ provider, idToken, accessToken }) {
  const db = createTempSupabase();
  const { data, error } = await db.auth.signInWithIdToken({ provider, token: idToken, access_token: accessToken });
  if (error) throw error;
  return {
    db,
    session: data.session,
    userId:  data.user.id,
    email:   data.user.email ?? null,
    name:    data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? null,
    existed: await isTrainer(db, data.user.id),
  };
}

/** Candidata con un código que ya existe. */
export async function trainerCandidateFromCode(code) {
  const db = createTempSupabase();
  const data = await passwordSignIn(db, code);
  return { db, session: data.session, userId: data.user.id, email: null, code: normCode(code), existed: true };
}

/**
 * Candidata con un código NUEVO. La Edge Function crea el usuario por la API
 * de administración (sin correo de confirmación ni límite de altas).
 */
export async function trainerCandidateNewCode() {
  const code = generateTrainerCode();
  const db = createTempSupabase();
  const { data, error } = await db.functions.invoke('create-trainer-account', { body: { code } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  const signed = await passwordSignIn(db, code);
  return { db, session: signed.session, userId: signed.user.id, email: null, code, existed: false };
}

/**
 * Instala la candidata como cuenta de entrenador del móvil. Una cuenta nueva
 * se marca como de entrenador ANTES de instalarla: si eso falla, no ha
 * cambiado nada.
 */
export async function adoptTrainer(candidate) {
  if (!candidate.existed) {
    const { error } = await candidate.db.from('profiles').upsert({ id: candidate.userId, role: 'trainer' });
    if (error) throw error;
  }
  const { error } = await trainerSupabase.auth.setSession({
    access_token:  candidate.session.access_token,
    refresh_token: candidate.session.refresh_token,
  });
  if (error) throw error;
}

/** El usuario de la sesión de entrenador de este móvil, o null. */
export const trainerSessionUserId = () => userIdOf(trainerSupabase);

/** Volver a entrar con el código en la sesión viva (sesión perdida, mismo usuario). */
export async function signInTrainerWithCode(code) {
  const data = await passwordSignIn(trainerSupabase, code);
  return data.user.id;
}

export async function signOutTrainer() {
  await trainerSupabase.auth.signOut({ scope: 'local' });
}

// ─── Cliente ──────────────────────────────────────────────────────────────────

/**
 * La identidad de cliente de este móvil: la que ya hay, o una anónima nueva.
 * NUNCA crea otra si ya hay una: antes cada consulta de código abría un
 * anónimo nuevo y el cliente perdía el asiento que ya tenía.
 */
export async function ensureClientSession() {
  const existing = await userIdOf(clientSupabase);
  if (existing) return existing;
  const { data, error } = await clientSupabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user.id;
}

export const clientSessionUserId = () => userIdOf(clientSupabase);

/** Candidata de cliente con Google o Apple (vincular, o reconectar en otro móvil). */
export async function clientCandidateFromIdToken({ provider, idToken, accessToken }) {
  const db = createTempSupabase();
  const { data, error } = await db.auth.signInWithIdToken({ provider, token: idToken, access_token: accessToken });
  if (error) throw error;
  return { db, session: data.session, userId: data.user.id };
}

export async function adoptClient(candidate) {
  const { error } = await clientSupabase.auth.setSession({
    access_token:  candidate.session.access_token,
    refresh_token: candidate.session.refresh_token,
  });
  if (error) throw error;
}

export async function signOutClient() {
  await clientSupabase.auth.signOut({ scope: 'local' });
}

// ─── Borrar cuenta ────────────────────────────────────────────────────────────

/**
 * Borra el usuario de la sesión de `db` (Requisito App Store 5.1.1(v)). La
 * Edge Function saca la identidad del JWT: solo puedes borrar el tuyo. Ver
 * supabase/functions/delete-account/index.ts.
 */
async function deleteUserOf(db) {
  const { data, error } = await db.functions.invoke('delete-account');
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export const deleteTrainerUser = () => deleteUserOf(trainerSupabase);
export const deleteClientUser  = () => deleteUserOf(clientSupabase);
