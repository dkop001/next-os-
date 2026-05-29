import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_JKC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_JKC_SUPABASE_ANON_KEY;

function createDummyClient() {
  return {
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: new Error('Supabase not configured') }),
      signInWithPassword: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: {
      from: () => ({
        list: () => Promise.resolve({ data: [], error: null }),
        upload: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
        download: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
      }),
    },
  };
}

const hasVars = supabaseUrl && supabaseAnonKey;

if (!hasVars) {
  console.warn('[Supabase] Env vars missing! Using dummy client. Set VITE_JKC_SUPABASE_URL and VITE_JKC_SUPABASE_ANON_KEY.');
}

export const supabase = hasVars
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        storage: window.localStorage,
        autoRefreshToken: true,
      },
    })
  : createDummyClient();
