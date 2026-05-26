import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://jturfpwaimpwxkkpkgov.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_eQW9ZahiOsXxEu_X24VnpQ_T2-YHaZs';

/**
 * Supabase client configured for React Native / Expo.
 * Uses AsyncStorage for session persistence so the session survives app restarts.
 * detectSessionInUrl: false — required for React Native (no browser URL bar).
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage:            AsyncStorage,
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
});
