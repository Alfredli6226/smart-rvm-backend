import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("⚠️ Supabase Keys missing in .env file!");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let cachedPlatformId = null;

export async function getMerchantId() {
  if (cachedPlatformId) return cachedPlatformId;

  try {
    // ✅ Uses Secure RPC to get ID (Bypasses RLS)
    const { data, error } = await supabase.rpc('get_platform_id');

    if (error) throw error;
    
    if (data) {
        cachedPlatformId = data;
        return data;
    }
    return null;
  } catch (err) {
    console.error("Failed to fetch Platform ID:", err);
    return null;
  }
}

export async function getOrCreateUser(phone, nickname = '', avatar = '', email = null) {
  try {
    // ✅ Pass p_email to the secure RPC
    const { data, error } = await supabase.rpc('upsert_user_by_phone', {
      p_phone: phone,
      p_nickname: nickname || 'New User',
      p_avatar_url: avatar,
      p_email: email // Pass the email here
    });

    if (error) throw error;
    return data; 
  } catch (err) {
    console.error("User Sync Error:", err);
    return null;
  }
}