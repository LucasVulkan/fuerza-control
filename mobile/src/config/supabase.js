import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://jturfpwaimpwxkkpkgov.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dXJmcHdhaW1wd3hra3BrZ292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzIxNjgsImV4cCI6MjA5NTM0ODE2OH0.-jsMU-w44qAk5UIsLwI-X3OP-i_N0cTIKt1fj-aj3-c';

/**
 * DOS sesiones de Supabase por móvil, una por papel, cada una en su sitio del
 * almacenamiento (C09 §2.1).
 *
 * Antes había una sola, y quien es entrenador Y cliente de otro (o simplemente
 * prueba las dos cosas) se la quitaba a sí mismo: conectarse como cliente
 * cerraba la cuenta de entrenador, y entrar como entrenador perdía para siempre
 * la identidad anónima del cliente. Con una sesión por papel, ninguna acción de
 * un papel puede tocar al otro.
 *
 *   trainerSupabase  la cuenta de entrenador (código, Google o Apple)
 *   clientSupabase   el cliente conectado a un entrenador (anónimo, o su Google/Apple)
 */
const persisted = (storageKey) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage:            AsyncStorage,
    storageKey,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,   // React Native: no hay barra de direcciones
  },
});

export const trainerSupabase = persisted('fc-trainer-auth');
export const clientSupabase  = persisted('fc-client-auth');

/**
 * Un cliente de usar y tirar, sin guardar nada: para ENTRAR en una cuenta
 * candidata (la nueva al cambiar de forma, la de «Ya tengo cuenta») sin tocar
 * la sesión viva. Solo si todo sale bien se adopta su sesión (`setSession`); si
 * no, se tira y nada ha cambiado.
 */
export function createTempSupabase() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * Una sola vez: la sesión que guardaba la versión anterior (una para todo, en
 * la clave por defecto de supabase-js) pasa al papel al que pertenece, según
 * de quién sea el usuario. Sin esto, los móviles que ya tenían la app
 * perderían la sesión de un papel al actualizar.
 * ponytail: se puede borrar cuando no quede ningún móvil con la versión de una sola sesión.
 */
const LEGACY_KEY = 'sb-jturfpwaimpwxkkpkgov-auth-token';
export async function migrateLegacySession({ trainerUserId, clientUserId }) {
  try {
    const raw = await AsyncStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const session = JSON.parse(raw);
    const owner = session?.user?.id;
    const target = owner && owner === trainerUserId ? trainerSupabase
      : owner && owner === clientUserId ? clientSupabase
      : null;
    if (target) {
      const { data } = await target.auth.getSession();
      if (!data.session) await target.auth.setSession(session);
    }
    await AsyncStorage.removeItem(LEGACY_KEY);
  } catch { /* una sesión que no se puede migrar se rehace entrando */ }
}
