import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// 1. Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// UCO Device Identifiers
const UCO_DEVICES = ['071582000007', '071582000009'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.query.key !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log("🔍 [CRON] Starting Historical Cleaning Detection...");

    const { data: devices } = await supabase
        .from('machines')
        .select('device_no, merchant_id')
        .eq('is_active', true);

    if (!devices) return res.status(200).json({ msg: "No devices found" });

    let newCleaningEvents = 0;

    for (const machine of devices) {
        // Fetch submissions from the last 24 hours
        const { data: rawSubmissions } = await supabase
            .from('submission_reviews')
            .select('id, submitted_at, bin_weight_snapshot, api_weight, waste_type, photo_url')
            .eq('device_no', machine.device_no)
            .gte('submitted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) 
            .order('submitted_at', { ascending: true }); // Oldest -> Newest

        if (!rawSubmissions || rawSubmissions.length < 2) continue;

        // ---------------------------------------------------------
        // ✅ NEW: ROBUST SANITY FILTER (ALL MACHINES)
        // ---------------------------------------------------------
        const submissions = rawSubmissions.filter(sub => {
            // 🚨 FIX: Get the RAW value first. Do NOT use || 0 yet.
            const rawBin = sub.bin_weight_snapshot; 
            
            // 1. STRICT NULL CHECK
            // If sensor sent null/undefined, the data is invalid. Ignore strictly.
            // This prevents "null" becoming "0" and triggering false cleaning.
            if (rawBin === null || rawBin === undefined) return false;

            const binWeight = Number(rawBin);
            const userWeight = Number(sub.api_weight || 0);
            const isUCO = UCO_DEVICES.includes(machine.device_no) || sub.waste_type?.toUpperCase().includes('UCO');

            // 2. GLOBAL RULE: Impossible Physics
            // If user added weight (>0) but machine says empty (<0.1), 
            // it's a sensor failure. Ignore this snapshot.
            if (userWeight > 0 && binWeight < 0.1) return false;

            // 3. UCO SPECIFIC RULES
            if (isUCO) {
                // Ignore if user transaction failed (0 input) -> Machine reports 0 bin
                if (userWeight === 0) return false;
                // Ignore if UCO machine reports near zero (tare weight issues)
                if (binWeight < 0.1) return false;
            }
            return true;
        });

        if (submissions.length < 2) continue;

        // 3. Analyze the Sequence
        for (let i = 1; i < submissions.length; i++) {
            const prev = submissions[i - 1];
            const curr = submissions[i];

            const prevWeight = Number(prev.bin_weight_snapshot);
            const currWeight = Number(curr.bin_weight_snapshot);

            // --- DETECTION LOGIC ---
            // 1. Was it full? (> 0.5kg)
            const wasFull = prevWeight > 0.5;
            
            // 2. Is it now empty? (< 2.0kg)
            const nowEmpty = currWeight < 2.0; 

            // 3. Did weight drop significantly?
            if (wasFull && nowEmpty && currWeight < prevWeight) {
                
                // Check for duplicates
                const { data: existing } = await supabase
                    .from('cleaning_records')
                    .select('id')
                    .eq('device_no', machine.device_no)
                    .gte('cleaned_at', prev.submitted_at)
                    .lte('cleaned_at', curr.submitted_at)
                    .limit(1);

                if (!existing || existing.length === 0) {
                    console.log(`🧹 Detected Cleaning on ${machine.device_no}: ${prevWeight}kg -> ${currWeight}kg`);

                    await supabase.from('cleaning_records').insert({
                        device_no: machine.device_no,
                        merchant_id: machine.merchant_id,
                        waste_type: prev.waste_type || 'Unknown',
                        bag_weight_collected: prevWeight, 
                        cleaned_at: curr.submitted_at, 
                        photo_url: prev.photo_url, 
                        cleaner_name: 'System Detected (History)',
                        status: 'PENDING'
                    });

                    newCleaningEvents++;
                }
            }
        }
    }

    return res.status(200).json({ 
        success: true, 
        events_detected: newCleaningEvents
    });

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}