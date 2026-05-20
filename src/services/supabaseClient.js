import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_JKC_SUPABASE_URL || 'https://mock.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_JKC_SUPABASE_ANON_KEY || 'mock-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'jkc_os_supabase_session',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
