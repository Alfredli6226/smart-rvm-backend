import { createClient } from '@supabase/supabase-js';

const APP_URL = 'https://rvm-merchant-platform-main-6ttt4awvv-alfredli6226s-projects.vercel.app';
const UCO_DEVICES = ['071582000007', '071582000009'];
const DEFAULT_LATITUDE = 3.14;
const DEFAULT_LONGITUDE = 101.68;

async function fetchVendorMachineStatusMap() {
  try {
    console.log('Fetching vendor machine status from:', `${APP_URL}/api/proxy`);
    const proxyRes = await fetch(`${APP_URL}/api/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: '/api/open/video/v2/nearby',
        method: 'GET',
        params: { latitude: DEFAULT_LATITUDE, longitude: DEFAULT_LONGITUDE }
      })
    });

    console.log('Proxy response status:', proxyRes.status);
    const apiRes = await proxyRes.json();
    console.log('Proxy response data keys:', Object.keys(apiRes));
    
    const rows = Array.isArray(apiRes?.data) ? apiRes.data : [];
    console.log('Found', rows.length, 'machines from vendor API');
    
    return rows.reduce((acc: Record<string, any>, row: any) => {
      const key = String(row.deviceNo || '').trim();
      if (key) acc[key] = row;
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching vendor machine status:', error);
    return {};
  }
}

export default async function handler(req: any, res: any) {
  // ✅ All env vars read INSIDE handler
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cronSecret = process.env.CRON_SECRET;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return res.status(500).json({ error: 'Missing Supabase server credentials for cron-poll' });
  }

  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET missing' });
  }

  // Debug: Log cronSecret length and first few chars
  console.log('cronSecret length:', cronSecret?.length);
  console.log('cronSecret first 5 chars:', cronSecret?.substring(0, 5));
  console.log('req.query.key:', req.query.key);
  
  // Trim any whitespace/newline from cronSecret
  const trimmedCronSecret = cronSecret?.trim();
  console.log('trimmedCronSecret:', trimmedCronSecret);
  
  if (req.query.key !== trimmedCronSecret) {
    console.log('Key mismatch:', { received: req.query.key, expected: trimmedCronSecret });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ✅ Supabase client created INSIDE handler
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  console.log('Cron-poll started');
  
  // First, just test Supabase connection
  try {
    const { data: machines, error } = await supabase
      .from('machines')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    let updatesCount = 0;
    let cleaningEvents = 0;
    const vendorStatusMap = await fetchVendorMachineStatusMap();

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
        const vendorStatus = vendorStatusMap[String(machine.device_no)] || null;

        if (vendorStatus) {
          await supabase
            .from('machines')
            .update({
              is_online: Number(vendorStatus.isOnline) === 1,
              status: Number(vendorStatus.status)
            })
            .eq('id', machine.id);
        }

        const bin1 = Array.isArray(bins) ? bins.find((b: any) => b.positionNo === 1) : null;
        if (bin1) {
          const wasCleaned = await processBin(supabase, machine, 1, bin1.weight, machine.current_bag_weight);
          if (wasCleaned) cleaningEvents++;
        }

        const bin2 = Array.isArray(bins) ? bins.find((b: any) => b.positionNo === 2) : null;
        if (bin2) {
          const wasCleaned = await processBin(supabase, machine, 2, bin2.weight, machine.current_weight_2);
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

async function processBin(supabase: any, machine: any, position: number, liveWeightStr: string, dbWeightNum: number): Promise<boolean> {
    const liveWeight = Number(liveWeightStr || 0);
    const dbWeight = Number(dbWeightNum || 0);
    const DROP_THRESHOLD = 2.0; 
    
    if (UCO_DEVICES.includes(machine.device_no) && liveWeight < 0.1 && dbWeight > 5.0) {
        console.log(`⚠️ Ignored UCO sensor glitch on ${machine.device_no}. DB: ${dbWeight}kg, Live: ${liveWeight}kg`);
        return false; 
    }

    const diff = dbWeight - liveWeight;
    let cleaningDetected = false;

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
