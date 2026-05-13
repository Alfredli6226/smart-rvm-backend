import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { method, body } = req;

  try {
    if (method === 'POST' && req.url?.includes('/validate-qr')) {
      const { machine_id, collector_id, collector_name, collector_phone } = body;

      if (!machine_id) {
        return res.status(400).json({ error: 'Missing machine_id' });
      }

      if (!collector_id) {
        return res.status(400).json({ error: 'Missing collector_id' });
      }

      // Try to find machine by ID first, then by device_no
      let machine;
      const { data: machineById, error: machineIdError } = await supabase
        .from('machines')
        .select('id, device_no, name, api_config, config_bin_1, config_bin_2')
        .eq('id', machine_id)
        .single();

      if (machineById && !machineIdError) {
        machine = machineById;
      } else {
        // Try by device_no (QR code typically contains device_no like RVM001)
        const { data: machineByDevice, error: machineDeviceError } = await supabase
          .from('machines')
          .select('id, device_no, name, api_config, config_bin_1, config_bin_2')
          .eq('device_no', machine_id)
          .single();

        if (machineByDevice && !machineDeviceError) {
          machine = machineByDevice;
        } else {
          console.error('[Validate QR] Machine not found:', machine_id, machineIdError, machineDeviceError);
          return res.status(404).json({ error: 'Machine not found', valid: false });
        }
      }

      // Parse bin weights from api_config
      let bin1Weight = 0;
      let bin2Weight = 0;
      let bin1Percent = 0;
      let bin2Percent = 0;
      
      try {
        const configs = typeof machine.api_config === 'string' 
          ? JSON.parse(machine.api_config) 
          : (machine.api_config || []);
        
        const bin1 = configs.find((c: any) => c.positionNo === 1);
        const bin2 = configs.find((c: any) => c.positionNo === 2);
        
        if (bin1) {
          bin1Weight = Number(bin1.weight) || 0;
          const maxWeight = Number(bin1.maxWeight) || 50;
          bin1Percent = Math.round((bin1Weight / maxWeight) * 100);
        }
        if (bin2) {
          bin2Weight = Number(bin2.weight) || 0;
          const maxWeight = Number(bin2.maxWeight) || 50;
          bin2Percent = Math.round((bin2Weight / maxWeight) * 100);
        }
      } catch (e) {
        console.warn('[Validate QR] Could not parse API config:', e);
      }

      const totalWeight = bin1Weight + bin2Weight;
      const avgPercent = Math.round((bin1Percent + bin2Percent) / 2);

      // Create collection log entry
      const startTime = new Date().toISOString();
      
      const { data: collectionLog, error: logError } = await supabase
        .from('collection_reports')
        .insert({
          collector_id,
          collector_name: collector_name || null,
          collector_phone: collector_phone || null,
          machine_id: machine.id,
          device_no: machine.device_no,
          machine_name: machine.name,
          start_time: startTime,
          initial_weight: totalWeight,
          status: 'In Progress'
        })
        .select()
        .single();

      if (logError) {
        console.error('[Validate QR] Log insert error:', logError);
        return res.status(500).json({ error: 'Failed to create collection log' });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        message: 'QR code validated successfully',
        data: {
          log_id: collectionLog.id,
          machine: {
            id: machine.id,
            device_no: machine.device_no,
            name: machine.name
          },
          collection: {
            collector_id,
            start_time: startTime,
            initial_weight: totalWeight
          },
          bins: {
            bin1: {
              weight: bin1Weight,
              fullness: bin1Percent
            },
            bin2: {
              weight: bin2Weight,
              fullness: bin2Percent
            },
            total_weight: totalWeight,
            avg_fullness: avgPercent
          }
        },
        transport_info: {
          estimated_weight: totalWeight,
          bin_status: avgPercent >= 90 ? 'Full' : avgPercent >= 70 ? 'Near Full' : 'Normal'
        }
      });
    }

    return res.status(404).json({ error: 'Endpoint not found' });

  } catch (error: any) {
    console.error('[Collector Validate QR] Uncaught error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}