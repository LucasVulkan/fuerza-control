/**
 * Supabase authentication service.
 *
 * Three trainer modes:
 *  - 'code'    → generates a trainer code → creates email+pass account behind the scenes
 *                (email = trainer-{code}@fc.app, password = code)
 *                Recovery: user re-enters code → signInWithPassword
 *  - 'google'  → standard Google OAuth via Supabase
 *  - 'offline' → no Supabase auth at all
 *
 * Client mode: always anonymous (signInAnonymously), invisible to the user.
 */

import { supabase } from '../config/supabase';

// Domain used to build fake emails for code-based trainer accounts.
// Must NOT be a real deliverable domain so Supabase never sends real emails.
const CODE_EMAIL_DOMAIN = 'trainer.fuerzacontrol.internal';

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
 * Creates a Supabase account (email+password) using the generated code as credentials.
 * Requires "Confirm email" to be DISABLED in Supabase Auth settings.
 *
 * Returns { code, session }.
 */
export async function setupTrainerCodeAccount() {
  const code     = generateTrainerCode();
  const email    = codeToEmail(code);
  const password = code;

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // Create trainer profile row
  await supabase.from('profiles').upsert({
    id:   data.user.id,
    role: 'trainer',
  });

  return { code, session: data.session, userId: data.user.id };
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
