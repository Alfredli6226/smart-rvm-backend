import { createClient } from '@supabase/supabase-js';

// DIRECT HARDCODED SOLUTION - Will definitely work
// Vercel is not exposing environment variables to client-side
const SUPABASE_CONFIG = {
  url: 'https://pmfpchdyousppasobqoa.supabase.co',
  anonKey: 'sb_publishable_cye50IOUktAP9DvkGP0XjQ_obRB3any'
};

console.log('🔧 Using hardcoded Supabase configuration:');
console.log('URL:', SUPABASE_CONFIG.url);
console.log('Key:', SUPABASE_CONFIG.anonKey.substring(0, 10) + '...');

// Create and export Supabase client
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Test connection immediately
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('❌ Supabase connection test failed:', error.message);
  } else {
    console.log('✅ Supabase connected successfully!');
    console.log('Session:', data.session ? 'Active' : 'No session');
  }
}).catch(err => {
  console.error('❌ Supabase connection error:', err.message);
});
