import { createClient } from '@supabase/supabase-js';

let viteEnv: Record<string, string | undefined> | undefined;
try {
  viteEnv = new Function('return typeof import.meta !== "undefined" ? import.meta.env : undefined')();
} catch {
  viteEnv = undefined;
}
const processEnv = typeof process !== 'undefined' ? process.env : undefined;

const supabaseUrl = viteEnv?.VITE_SUPABASE_URL || processEnv?.VITE_SUPABASE_URL;
const supabaseAnonKey = viteEnv?.VITE_SUPABASE_ANON_KEY || processEnv?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Supabase URL or Key is missing. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
