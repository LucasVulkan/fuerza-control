/**
 * Supabase authentication service.
 *
 * Three trainer modes:
 *  - 'code'    → generates a trainer code → creates email+pass account behind the scenes
 *                (email = trainer-{code}@fc.app, password = code)
 *                Recovery: user re-enters code → signInWithPassword
 *  - 'google'  → standard Google OAuth via Supabase
 *  - 'apple'   → Sign in with Apple (solo iOS), mismo id_token flow que Google
 *  - 'offline' → no Supabase auth at all
 *
 * Client mode: always anonymous (signInAnonymously), invisible to the user.
 */

import { supabase } from '../config/supabase';

// Domain used to build fake emails for code-based trainer accounts.
// Must NOT be a real deliverable domain so Supabase never sends real emails.
const CODE_EMAIL_DOMAIN = 'noreply.fuerzacontrol.com';

/** Turns a trainer code into a deterministic email. */
function codeToEmail(code) {
  return `trainer-${code.toLowerCase().replace(/-/g, '')}@${CODE_EMAIL_DOMAIN}`;
}

/**
 * Generates a random trainer code in the format XXXX-XXXX-XXXX.
 * Uses unambiguous characters (no I, O, 0, 1) to avoid confusion.
 */
export function generateTrainerCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code; // e.g. "XK7M-2P4T-9QR3"
}

/**
 * Sets up "code" mode for a trainer.
 * Calls the Edge Function to create the user via admin API (no email sent, no rate limit).
 * Then signs in with email+password to get a real session.
 *
 * Returns { code, session, userId }.
 */
export async function setupTrainerCodeAccount() {
  const code     = generateTrainerCode();
  const email    = codeToEmail(code);
  const password = code;

  // Create user via Edge Function (uses admin API — no email, no rate limit)
  const { data: fnData, error: fnError } = await supabase.functions.invoke(
    'create-trainer-account',
    { body: { code } },
  );
  if (fnError) throw fnError;
  if (fnData?.error) throw new Error(fnData.error);

  // Sign in to get a real session
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Create trainer profile row
  await supabase.from('profiles').upsert({
    id:   data.user.id,
    role: 'trainer',
  });

  return { code, session: data.session, userId: data.user.id };
}

/**
 * Signs a trainer in with an id_token from a social provider.
 *  - google → id_token del intercambio de código de expo-auth-session
 *  - apple  → identityToken de la hoja nativa (sin access_token, no lo hay)
 *
 * @param {{ provider: 'google'|'apple', idToken: string, accessToken?: string }} tokens
 * @returns {{ session, userId, email }}
 */
export async function loginTrainerWithIdToken({ provider = 'google', idToken, accessToken }) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider,
    token:        idToken,
    access_token: accessToken,
  });
  if (error) throw error;

  // Upsert trainer profile row (idempotent)
  await supabase.from('profiles').upsert({
    id:   data.user.id,
    role: 'trainer',
  });

  return {
    session: data.session,
    userId:  data.user.id,
    email:   data.user.email ?? null,
  };
}

/**
 * Recovers a trainer session after reinstall using their code.
 * Returns the Supabase session.
 */
export async function recoverWithTrainerCode(code) {
  const email    = codeToEmail(code.trim().toUpperCase());
  const password = code.trim().toUpperCase();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.includes('Invalid login')) {
      throw new Error('Código no encontrado. Comprueba que lo has escrito correctamente.');
    }
    throw error;
  }

  return { session: data.session, userId: data.user.id };
}

/**
 * Signs a client in with a social id_token (google | apple).
 * Unlike loginTrainerWithIdToken, this does NOT upsert a trainer profile row.
 * Used for client account linking and auto-reconnect on new devices.
 *
 * @param {{ provider: 'google'|'apple', idToken: string, accessToken?: string }} tokens
 * @returns {{ session, userId }}
 */
export async function loginClientWithIdToken({ provider = 'google', idToken, accessToken }) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider,
    token:        idToken,
    access_token: accessToken,
  });
  if (error) throw error;
  return { session: data.session, userId: data.user.id };
}

/**
 * Signs in anonymously (for clients).
 * Creates a persistent anonymous session in Supabase.
 */
export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return { session: data.session, userId: data.user.id };
}

/**
 * Returns the current active session, or null if not signed in.
 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/**
 * Signs out and clears the local session.
 */
export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * Borra la cuenta del usuario que tiene sesión ahora mismo.
 *
 * Requisito de la App Store 5.1.1(v). Va por Edge Function porque eliminar el
 * usuario de `auth.users` necesita admin API, que no puede vivir en el cliente.
 * La función saca la identidad del JWT, así que aquí no se manda ningún id:
 * solo puedes borrar tu propia cuenta.
 *
 * Ver supabase/functions/delete-account/index.ts para qué se borra y qué no.
 */
export async function deleteAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
