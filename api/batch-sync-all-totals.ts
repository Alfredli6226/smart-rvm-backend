import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY; // Use anon key instead
  const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const debug = {
    url: url ? url.substring(0, 30) + '...' : 'missing',
    anonKey: key ? key.substring(0, 30) + '...' : 'missing',
    serviceKey: sKey ? sKey.substring(0, 30) + '...' : 'missing',
  };

  if (!url || !key) {
    return res.status(500).json({ error: 'Missing env vars', debug });
  }

  try {
    const supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await supabase
      .from('users')
      .select('id, phone, total_weight, total_points')
      .limit(3);

    if (error) {
      return res.status(500).json({ error: error.message, debug });
    }

    return res.json({ success: true, sample: data, debug });

  } catch (err: any) {
    return res.status(500).json({ error: err.message, debug });
  }
}
