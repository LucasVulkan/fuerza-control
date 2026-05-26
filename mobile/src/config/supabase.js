import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://jturfpwaimpwxkkpkgov.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0dXJmcHdhaW1wd3hra3BrZ292Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NzIxNjgsImV4cCI6MjA5NTM0ODE2OH0.-jsMU-w44qAk5UIsLwI-X3OP-i_N0cTIKt1fj-aj3-c';

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
