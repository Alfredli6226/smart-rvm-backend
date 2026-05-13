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

  const { query } = req;
  const limit = parseInt(query.limit as string) || 20;

  try {
    console.log('[Collections History API] Fetching recent collections');

    if (req.method === 'GET') {
      const { data: collections, error } = await supabase
        .from('collection_reports')
        .select('id, device_no, machine_name, start_time, end_time, initial_weight, final_weight, status, collector_name, collector_phone')
        .in('status', ['Emptied', 'Completed'])
        .order('start_time', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[Collections] Error:', error);
        return res.status(500).json({ error: error.message });
      }

      const formatted = (collections || []).map(c => ({
        id: c.id,
        equipmentId: `Equipment ${c.device_no}`,
        materialType: 'Mixed Recyclables',
        collectedWeight: Math.round(((Number(c.final_weight) || 0) - (Number(c.initial_weight) || 0)) * 100) / 100,
        collectionTime: c.start_time,
        status: c.status,
        collectorName: c.collector_name || 'Unknown',
        collectorPhone: c.collector_phone ? maskPhone(c.collector_phone) : '****'
      }));

      return res.status(200).json({
        success: true,
        count: formatted.length,
        collections: formatted
      });
    }

    if (req.method === 'POST' && query.action === 'broadcast') {
      const { equipment_id, material_type, collected_weight, collector_name, collector_phone, device_no } = req.body;

      if (!device_no) {
        return res.status(400).json({ error: 'Missing device_no' });
      }

      const now = new Date().toISOString();
      const { data: newCollection, error } = await supabase
        .from('collection_reports')
        .insert({
          device_no,
          machine_name: equipment_id,
          start_time: now,
          end_time: now,
          initial_weight: 0,
          final_weight: collected_weight || 0,
          status: 'Emptied',
          collector_name: collector_name,
          collector_phone: collector_phone
        })
        .select()
        .single();

      if (error) {
        console.error('[Collections] Insert error:', error);
        return res.status(500).json({ error: error.message });
      }

      await supabase.from('realtime_logs').insert({
        event_type: 'new-collection',
        payload: {
          id: newCollection.id,
          equipmentId: `Equipment ${device_no}`,
          materialType: material_type || 'Mixed Recyclables',
          collectedWeight: collected_weight || 0,
          collectionTime: now,
          status: 'Emptied'
        },
        machine_id: device_no
      });

      return res.status(200).json({
        success: true,
        event: 'new-collection',
        collection: {
          id: newCollection.id,
          equipmentId: `Equipment ${device_no}`,
          materialType: material_type || 'Mixed Recyclables',
          collectedWeight: collected_weight || 0,
          collectionTime: now
        }
      });
    }

    return res.status(400).json({ error: 'Invalid action. Use GET or POST?action=broadcast' });

  } catch (error: any) {
    console.error('[Collections History API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

function maskPhone(phone: string | null): string {
  if (!phone) return '****';
  if (phone.length < 7) return '****';
  const start = phone.slice(0, 3);
  const end = phone.slice(-4);
  return `${start}****${end}`;
}
