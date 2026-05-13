import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { method, body } = req;

  try {
    // Broadcast endpoint - anyone can subscribe to this channel
    if (method === 'POST' && req.query.action === 'broadcast') {
      const { username, machine_id, material_type, weight, user_id } = body;
      
      if (!machine_id || !weight) {
        return res.status(400).json({ error: 'Missing required fields: machine_id, weight' });
      }

      const broadcastData = {
        username: username || 'Anonymous',
        machine_id,
        material_type: material_type || 'Unknown',
        weight: Number(weight),
        user_id: user_id || null,
        timestamp: new Date().toISOString()
      };

      // Store in a realtime_log table for subscribers
      const { data, error } = await supabase
        .from('realtime_logs')
        .insert({
          event_type: 'new-submission',
          payload: broadcastData,
          machine_id
        })
        .select()
        .single();

      if (error) {
        console.warn('[Broadcast] Log error:', error.message);
        // Continue anyway - the broadcast is the important part
      }

      console.log('[Broadcast] new-submission:', broadcastData);

      return res.status(200).json({
        success: true,
        event: 'new-submission',
        data: broadcastData
      });
    }

    // Subscribe endpoint - for clients to get latest events
    if (method === 'GET' && req.query.action === 'subscribe') {
      const limit = parseInt(req.query.limit as string) || 10;
      
      const { data, error } = await supabase
        .from('realtime_logs')
        .select('*')
        .eq('event_type', 'new-submission')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[Subscribe] Error:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({
        success: true,
        events: data?.map(d => ({
          ...d.payload,
          created_at: d.created_at
        })) || []
      });
    }

    return res.status(400).json({ error: 'Invalid action. Use ?action=broadcast or ?action=subscribe' });

  } catch (error: any) {
    console.error('[Realtime API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}