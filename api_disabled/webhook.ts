import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { detectVelocityFraud } from './velocity-fraud-middleware.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
// 🔴 WAS: const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
// 🟢 FIX: Use Service Role Key to bypass RLS policies
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

//  Define your Debug URL
const DEBUG_WEBHOOK_URL = "https://webhook.site/318f92d0-0e9f-4d44-a388-70c6d6a0c591";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS & Method Check
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const data = req.body;

  // ------------------------------------------------------------------
  // FAN-OUT: Forward to Webhook.site (Debugging)
  // ------------------------------------------------------------------
  if (DEBUG_WEBHOOK_URL) {
      axios.post(DEBUG_WEBHOOK_URL, data).catch(err => {
          console.error("⚠️ Failed to forward to debug webhook:", err.message);
      });
  }

  try {
    // ------------------------------------------------------------------
    // 🔥 STEP 0: RAW LOGGING
    // ------------------------------------------------------------------
    const { error: logError } = await supabase.from('machine_logs').insert({
        device_no: String(data.deviceNo || 'UNKNOWN'),
        type: data.type || 'UNKNOWN',
        vendor_user_no: data.userId ? String(data.userId) : null,
        payload: data
    });

    if (logError) console.error("⚠️ Failed to save raw log:", logError.message);

    // ------------------------------------------------------------------
    // MAIN LOGIC
    // ------------------------------------------------------------------
    if (data.type === 'PUT') {
      const { 
        userId, deviceNo, putId, totalWeight, integral, phone, imgUrl, 
        userRubbishPutDetailsVOList 
      } = data;

      // ------------------------------------------------------------------
      // 1. MACHINE & RATE LOOKUP
      // ------------------------------------------------------------------
      const { data: machineState, error: machineError } = await supabase
        .from('machines')
        .select('id, current_bag_weight, current_weight_2, merchant_id, rate_plastic, rate_can, rate_paper, rate_uco')
        .eq('device_no', String(deviceNo))
        .maybeSingle(); 

      if (machineError) console.warn("⚠️ Machine Lookup Error:", machineError.message);

      let merchantId = null;
      let rateConfig: any = {};

      if (machineState) {
        merchantId = machineState.merchant_id;
        rateConfig = machineState; 

        // --- BIN CLEANING LOGIC ---
        const items = userRubbishPutDetailsVOList || [];
        if (items.length === 0 && data.positionWeight) {
            items.push({ positionId: '1', rubbishName: 'UCO', positionWeight: data.positionWeight });
        }
        for (const item of items) {
            const binId = String(item.positionId || item.positionNo || '1');
            const currentLevel = Number(item.positionWeight || 0);
            const wasteType = item.rubbishName || 'Unknown';
            const CLEANING_THRESHOLD_KG = 0.5;

            if (binId === '1') {
                const lastWeight = Number(machineState.current_bag_weight || 0);
                if (lastWeight > CLEANING_THRESHOLD_KG && currentLevel < 1.0 && currentLevel < lastWeight) {
                    await logCleaning(deviceNo, wasteType, lastWeight, imgUrl);
                }
                await supabase.from('machines').update({ current_bag_weight: currentLevel }).eq('id', machineState.id);
            } else if (binId === '2') {
                const lastWeight = Number(machineState.current_weight_2 || 0);
                if (lastWeight > CLEANING_THRESHOLD_KG && currentLevel < 1.0 && currentLevel < lastWeight) {
                    await logCleaning(deviceNo, wasteType, lastWeight, imgUrl);
                }
                await supabase.from('machines').update({ current_weight_2: currentLevel }).eq('id', machineState.id);
            }
        }
      } else {
          console.warn(`⚠️ Machine not found in DB: ${deviceNo}`);
      }

      // ------------------------------------------------------------------
      // 2. USER SUBMISSION & REGISTRATION LOGIC
      // ------------------------------------------------------------------
      let internalUserId = null;
      const machineUserId = userId ? String(userId) : null;
      const userPhone = phone ? String(phone) : null;

      if (machineUserId || userPhone) {
          let existingUser = null;
          // A. Try Match by Vendor ID
          if (machineUserId) {
              const { data: vendorMatch } = await supabase.from('users').select('id, phone, vendor_user_no').eq('vendor_user_no', machineUserId).maybeSingle();
              if (vendorMatch) existingUser = vendorMatch;
          }
          // B. Try Match by Phone
          if (!existingUser && userPhone) {
               const { data: phoneMatch } = await supabase.from('users').select('id, phone, vendor_user_no').eq('phone', userPhone).maybeSingle();
               if (phoneMatch) existingUser = phoneMatch;
          }
          // C. Update or Create
          if (existingUser) {
              internalUserId = existingUser.id;
              const updates: any = {};
              if (!existingUser.vendor_user_no && machineUserId) updates.vendor_user_no = machineUserId;
              if (Object.keys(updates).length > 0) await supabase.from('users').update(updates).eq('id', internalUserId);
          } else {
              const { data: newUser } = await supabase.from('users').insert({
                    vendor_user_no: machineUserId,
                    phone: userPhone,
                    is_active: true,
                    nickname: 'New User'
                }).select('id').single();
              if (newUser) internalUserId = newUser.id;
          }

          // 🔥 THE MISSING PIECE: Create Wallet Link so User appears in Frontend 🔥
          if (internalUserId && merchantId) {
              // We use upsert to ensure we don't crash if wallet exists
              await supabase.from('merchant_wallets').upsert({
                  merchant_id: merchantId,
                  user_id: internalUserId,
                  current_balance: 0, // Default to 0, let verification add money
                  total_earnings: 0
              }, { onConflict: 'user_id, merchant_id' });
          }
      }

      // ------------------------------------------------------------------
      // 3. ROBUST VALUATION LOGIC
      // ------------------------------------------------------------------
      const primaryItem = userRubbishPutDetailsVOList?.[0] || {};
      const rawWasteName = (primaryItem.rubbishName || 'Unknown').toLowerCase();
      const weight = Number(totalWeight || 0);
      
      let detectedType = 'Plastic';
      let appliedRate = 0;

      if (rawWasteName.includes('paper') || rawWasteName.includes('kertas')) {
          detectedType = 'Paper';
          appliedRate = Number(rateConfig.rate_paper || 0);
      } else if (rawWasteName.includes('uco') || rawWasteName.includes('oil') || rawWasteName.includes('minyak')) {
          detectedType = 'UCO';
          appliedRate = Number(rateConfig.rate_uco || 0);
      } else if (rawWasteName.includes('can') || rawWasteName.includes('tin') || rawWasteName.includes('aluminium')) {
          detectedType = 'Can';
          appliedRate = Number(rateConfig.rate_can || 0);
      } else {
          detectedType = 'Plastic';
          appliedRate = Number(rateConfig.rate_plastic || 0);
      }

      const calculatedMoney = weight * appliedRate;
      const machinePoints = Number(integral || 0);

      // ------------------------------------------------------------------
      // 3.5 FRAUD DETECTION
      // ------------------------------------------------------------------
      const MAX_ITEM_WEIGHT = 500; // grams
      const MAX_DAILY_SUBMISSIONS = 50;

      let isSuspicious = false;
      let fraudReason: string | null = null;
      let submissionStatus = 'PENDING';

      // Check weight limit
      if (weight > MAX_ITEM_WEIGHT) {
        isSuspicious = true;
        fraudReason = 'Weight Limit Exceeded';
        submissionStatus = 'Flagged';
      }

      // Check daily submission count (only if not already flagged)
      if (!isSuspicious && internalUserId) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const { count } = await supabase
          .from('submission_reviews')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', internalUserId)
          .gte('submitted_at', today.toISOString())
          .lt('submitted_at', tomorrow.toISOString());

        if (count && count >= MAX_DAILY_SUBMISSIONS) {
          isSuspicious = true;
          fraudReason = 'High Frequency';
          submissionStatus = 'Flagged';
        }
      }

      // ------------------------------------------------------------------
      // SENSOR MISMATCH CHECK
      // Compare user reported weight with machine sensor delta
      // ------------------------------------------------------------------
      if (!isSuspicious && machineState) {
        // Get current bin weight from machine state (the sensor reading before this submission)
        const currentSensorWeight = Number(machineState.current_bag_weight || 0);
        
        if (currentSensorWeight > 0 && weight > 0) {
          // Calculate the difference percentage
          // Sensor delta = weight submitted (current sensor reading should be less after submission)
          // But we have the BEFORE value, so compare user weight to what machine recorded
          const difference = Math.abs(weight - currentSensorWeight);
          const percentDifference = (difference / Math.max(weight, currentSensorWeight)) * 100;
          
          if (percentDifference > 10) {
            isSuspicious = true;
            fraudReason = 'Sensor Mismatch';
            submissionStatus = 'Flagged';
            
            console.log(`⚠️ Sensor Mismatch detected: User=${weight}kg, Sensor=${currentSensorWeight}kg, Diff=${percentDifference.toFixed(1)}%`);
            
            // Alert Super Admin
            await alertSuperAdmin({
              type: 'SENSOR_MISMATCH',
              deviceNo: deviceNo,
              userPhone: userPhone,
              userWeight: weight,
              sensorWeight: currentSensorWeight,
              differencePercent: percentDifference,
              submittedAt: new Date().toISOString()
            });
          }
        }
      }

      // If flagged, no points for user
      const finalPoints = submissionStatus === 'Flagged' ? 0 : machinePoints;

      // ------------------------------------------------------------------
      // 4. VELOCITY FRAUD CHECK (High Frequency in last 5 mins)
      // ------------------------------------------------------------------
      if (internalUserId) {
        const velocityResult = await detectVelocityFraud(internalUserId);
        
        if (!velocityResult.allowed) {
          // Update the record as velocity fraud
          await supabase
            .from('submission_reviews')
            .upsert([
              {
                vendor_record_id: String(putId),
                user_id: internalUserId,
                phone: userPhone,
                merchant_id: merchantId, 
                device_no: deviceNo,
                waste_type: detectedType,
                api_weight: weight,
                confirmed_weight: 0, 
                calculated_value: 0,
                rate_per_kg: appliedRate,
                machine_given_points: 0,
                photo_url: imgUrl,
                status: 'Flagged',
                is_suspicious: true,
                fraud_reason: velocityResult.fraudType || 'Velocity Fraud',
                source: 'WEBHOOK',
                submitted_at: new Date().toISOString(),
                bin_weight_snapshot: Number(primaryItem.positionWeight || data.positionWeight || 0)
              }
            ], { onConflict: 'vendor_record_id' });

          return res.status(403).json({ 
            msg: "Submission received and pending verification",
            flagged: true,
            reason: velocityResult.fraudType
          });
        }
      }

      // ------------------------------------------------------------------
      // 5. SAVE RECORD
      // ------------------------------------------------------------------
      const { error: saveError } = await supabase
        .from('submission_reviews')
        .upsert([
          {
            vendor_record_id: String(putId),
            user_id: internalUserId,
            phone: userPhone,
            merchant_id: merchantId, 
            device_no: deviceNo,
            waste_type: detectedType,
            api_weight: weight,
            confirmed_weight: 0, 
            calculated_value: submissionStatus === 'Flagged' ? 0 : calculatedMoney, 
            rate_per_kg: appliedRate,
            machine_given_points: finalPoints,
            photo_url: imgUrl,
            status: submissionStatus,
            is_suspicious: isSuspicious,
            fraud_reason: fraudReason,
            source: 'WEBHOOK',
            submitted_at: new Date().toISOString(),
            bin_weight_snapshot: Number(primaryItem.positionWeight || data.positionWeight || 0)
          }
        ], { onConflict: 'vendor_record_id' });

      if (saveError) console.error("❌ Save Error:", saveError.message);

      // Return appropriate message based on fraud status
      if (submissionStatus === 'Flagged') {
        return res.status(200).json({ 
          msg: "Submission received and pending verification",
          flagged: true,
          reason: fraudReason
        });
      }
    }

    return res.status(200).json({ msg: "Success" });

  } catch (error: any) {
    console.error("Webhook Critical Error:", error.message);
    return res.status(200).json({ error: "Logged" });
  }
}

async function logCleaning(deviceNo: string, type: string, weight: number, url: string) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    // 🟢 FIX: Use Service Role Key here too!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from('cleaning_records').insert([{
        device_no: deviceNo, waste_type: type, bag_weight_collected: weight,
        cleaned_at: new Date().toISOString(), photo_url: url, status: 'PENDING' 
    }]);
}

interface AlertData {
    type: string;
    deviceNo: string;
    userPhone: string;
    userWeight: number;
    sensorWeight: number;
    differencePercent: number;
    submittedAt: string;
}

async function alertSuperAdmin(alertData: AlertData) {
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find Super Admin email(s)
    const { data: superAdmins } = await supabase
        .from('app_admins')
        .select('email')
        .eq('role', 'SUPER_ADMIN');

    if (superAdmins && superAdmins.length > 0) {
        // Insert notification for each Super Admin
        const notifications = superAdmins.map(admin => ({
            user_email: admin.email,
            title: '⚠️ Sensor Mismatch Detected',
            message: `Machine ${alertData.deviceNo}: User reported ${alertData.userWeight}kg but sensor shows ${alertData.sensorWeight}kg (${alertData.differencePercent.toFixed(1)}% difference). User: ${alertData.userPhone}`,
            type: 'ALERT',
            reference_id: null,
            reference_type: 'SENSOR_MISMATCH'
        }));

        await supabase.from('notifications').insert(notifications);
    }
}