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

  try {
    if (req.method === 'POST' && req.query.action === 'generate-demo') {
      const { count = 1, device_no = 'RVM-001' } = req.body;

      const wasteTypes = ['PET Plastic', 'Aluminum', 'Glass', 'Paper', 'Tin'];
      const randomUsers = ['Ahmad R.', 'Sarah L.', 'Mike T.', 'Jenny K.', 'David W.', 'Lisa M.'];
      const randomWeights = [5.2, 8.5, 12.3, 6.8, 15.1, 9.4, 7.2, 11.5];

      const submissions = [];
      
      for (let i = 0; i < count; i++) {
        const weight = randomWeights[Math.floor(Math.random() * randomWeights.length)];
        const wasteType = wasteTypes[Math.floor(Math.random() * wasteTypes.length)];
        const user = randomUsers[Math.floor(Math.random() * randomUsers.length)];
        
        const { data, error } = await supabase
          .from('submission_reviews')
          .insert({
            user_id: '00000000-0000-0000-0000-000000000001',
            device_no: device_no,
            waste_type: wasteType,
            api_weight: weight,
            calculated_value: Math.round(weight * 10),
            status: 'VERIFIED',
            submitted_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          console.warn('[Demo] Insert error:', error.message);
        } else {
          await supabase.from('realtime_logs').insert({
            event_type: 'new-submission',
            payload: {
              username: user,
              machine_id: device_no,
              material_type: wasteType,
              weight: weight,
              timestamp: new Date().toISOString()
            },
            machine_id: device_no
          });
          submissions.push({ id: data.id, weight, wasteType, user });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Generated ${submissions.length} demo submissions`,
        submissions
      });
    }

    if (req.method === 'POST' && req.query.action === 'generate-collection') {
      const { device_no = 'RVM-001', weight = 50 } = req.body;
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('collection_reports')
        .insert({
          device_no,
          machine_name: `Machine ${device_no}`,
          start_time: now,
          end_time: now,
          initial_weight: 0,
          final_weight: weight,
          status: 'Emptied',
          collector_name: 'Demo Collector',
          collector_phone: '0123456789'
        })
        .select()
        .single();

      if (error) {
        console.error('[Demo] Collection insert error:', error);
        return res.status(500).json({ error: error.message });
      }

      await supabase.from('realtime_logs').insert({
        event_type: 'new-collection',
        payload: {
          id: data.id,
          equipmentId: `Equipment ${device_no}`,
          materialType: 'Mixed Recyclables',
          collectedWeight: weight,
          collectionTime: now,
          status: 'Emptied'
        },
        machine_id: device_no
      });

      return res.status(200).json({
        success: true,
        message: 'Generated demo collection',
        collection: data
      });
    }

    return res.status(400).json({ error: 'Invalid action. Use ?action=generate-demo or ?action=generate-collection' });

  } catch (error: any) {
    console.error('[Demo API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
