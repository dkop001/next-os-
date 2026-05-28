import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_JKC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_JKC_SUPABASE_ANON_KEY;

// Defensive logging – will disappear in production because Vite strips console.log
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars missing! Check Vite/Vercel config.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // This enables automatic token refresh & localStorage persistence
  auth: {
    persistSession: true,
    storage: window.localStorage,
    autoRefreshToken: true,
    // Optional: set a custom cookie name if you ever need SSR support
    // detectSessionInUrl: true,
  },
});
