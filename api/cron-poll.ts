import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = 'https://rvm-merchant-platform.vercel.app';
const UCO_DEVICES = ['071582000007', '071582000009'];

export default async function handler(req: any, res: any) {
  
  if (req.query.key !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: machines, error } = await supabase
      .from('machines')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    let updatesCount = 0;
    let cleaningEvents = 0;

    for (const machine of machines) {
      try {
        const proxyRes = await fetch(`${APP_URL}/api/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: '/api/open/v1/device/position',
                method: 'GET',
                params: { deviceNo: machine.device_no }
            })
        });

        const apiRes = await proxyRes.json();
        const bins = (apiRes && apiRes.data) ? apiRes.data : [];

        // --- BIN 1 PROCESSING ---
        const bin1 = Array.isArray(bins) ? bins.find((b: any) => b.positionNo === 1) : null;
        if (bin1) {
          const wasCleaned = await processBin(machine, 1, bin1.weight, machine.current_bag_weight);
          if (wasCleaned) cleaningEvents++;
        }

        // --- BIN 2 PROCESSING ---
        const bin2 = Array.isArray(bins) ? bins.find((b: any) => b.positionNo === 2) : null;
        if (bin2) {
          const wasCleaned = await processBin(machine, 2, bin2.weight, machine.current_weight_2);
          if (wasCleaned) cleaningEvents++;
        }

        updatesCount++;

      } catch (innerErr) {
        console.error(`Error processing ${machine.device_no}:`, innerErr);
      }
    }

    return res.status(200).json({ 
      success: true, 
      machinesChecked: updatesCount, 
      cleaningEventsDetected: cleaningEvents 
    });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

// --- HELPER FUNCTION ---
async function processBin(machine: any, position: number, liveWeightStr: string, dbWeightNum: number): Promise<boolean> {
    const liveWeight = Number(liveWeightStr || 0);
    const dbWeight = Number(dbWeightNum || 0);
    const DROP_THRESHOLD = 2.0; 
    
    // ✅ NEW: UCO Glitch Safeguard for Live Poll
    // If it's a UCO machine and weight drops EXACTLY to 0 (or near 0) from a high number, ignore it.
    if (UCO_DEVICES.includes(machine.device_no) && liveWeight < 0.1 && dbWeight > 5.0) {
        console.log(`⚠️ Ignored UCO sensor glitch on ${machine.device_no}. DB: ${dbWeight}kg, Live: ${liveWeight}kg`);
        return false; 
    }

    const diff = dbWeight - liveWeight;
    let cleaningDetected = false;

    // 1. Detect Drop (Cleaning Event)
    if (diff > DROP_THRESHOLD) {
        
        const timeWindow = new Date(Date.now() - 45 * 60 * 1000).toISOString();
        const wasteType = position === 1 ? machine.config_bin_1 : machine.config_bin_2;

        const { data: recentLogs } = await supabase
            .from('cleaning_records')
            .select('id')
            .eq('device_no', machine.device_no)
            .eq('waste_type', wasteType)
            .gt('cleaned_at', timeWindow)
            .limit(1);

        if (!recentLogs || recentLogs.length === 0) {
            console.log(`🧹 Cleaning Detected: ${machine.device_no}. ${dbWeight}kg -> ${liveWeight}kg`);
            
            await supabase.from('cleaning_records').insert({
                device_no: machine.device_no,
                merchant_id: machine.merchant_id,
                waste_type: wasteType,
                bag_weight_collected: dbWeight,
                cleaned_at: new Date().toISOString(),
                cleaner_name: 'System Detected (Auto)',
                status: 'PENDING'
            });
            
            cleaningDetected = true; 
        }
    }

    // 2. Sync Logic (Gradual Increase)
    // This handles user recycling activity (e.g. 50kg -> 55kg)
    if (Math.abs(liveWeight - dbWeight) > 0.05) {
        
        if (liveWeight > dbWeight) {
             console.log(`📈 Weight Increased on ${machine.device_no}: ${dbWeight}kg -> ${liveWeight}kg`);
        }

        const updateField = position === 1 ? 'current_bag_weight' : 'current_weight_2';
        await supabase
          .from('machines')
          .update({ [updateField]: liveWeight })
          .eq('id', machine.id);
    }

    return cleaningDetected;
}