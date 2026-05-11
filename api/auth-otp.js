import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase with SERVICE ROLE KEY (Bypasses RLS)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Strip # from instance ID if present (axios treats # as URL fragment)
const WAAPI_URL = "https://waapi.app/api/v1/instances";
const WAAPI_ID = (process.env.WAAPI_INSTANCE_ID || '').replace('#', '').trim();
const WAAPI_TOKEN = (process.env.WAAPI_TOKEN || '').trim();

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, phone, code } = req.body;

  try {
    // ---------------------------------------------------------
    // ACTION: SEND OTP
    // ---------------------------------------------------------
    if (action === 'send') {
      if (!phone) throw new Error("Phone number required");

      // 1. Generate 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 2. Calculate Expiry (5 Minutes from now)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      // 3. Check WaAPI credentials
      if (!WAAPI_ID || !WAAPI_TOKEN) {
        console.error("WaAPI credentials missing — set WAAPI_INSTANCE_ID and WAAPI_TOKEN in Vercel env");
        return res.status(500).json({ success: false, msg: "WhatsApp service not configured. Contact admin." });
      }

      // 4. Store in Supabase (Upsert: Update if exists, Insert if new)
      const { error: dbError } = await supabase
        .from('otp_codes')
        .upsert({ 
          phone: phone, 
          code: generatedOtp, 
          expires_at: expiresAt 
        }, { onConflict: 'phone' });

      if (dbError) {
        console.error("DB upsert error:", dbError);
        if (dbError.message?.includes('relation') && dbError.message?.includes('does not exist')) {
          return res.status(500).json({ success: false, msg: "Database setup incomplete. Run otp_codes.sql in Supabase." });
        }
        throw dbError;
      }

      // 5. Send via WaAPI
      const chatId = `${phone.replace('+', '')}@c.us`;
      
      try {
        const waRes = await axios.post(
          `${WAAPI_URL}/${WAAPI_ID}/client/action/send-message`,
          {
            chatId: chatId,
            message: `Your RVM Login Code is: *${generatedOtp}*\n\nValid for 5 minutes.`
          },
          { headers: { Authorization: `Bearer ${WAAPI_TOKEN}` } }
        );
        console.log("WaAPI response:", waRes.status, waRes.data);
      } catch (waErr) {
        const waDetail = waErr.response?.data || waErr.message;
        console.error("WaAPI send failed:", JSON.stringify(waDetail));
        
        // 🟢 FIX: Try backup WhatsApp bridge (Mac mini wacli via Tailscale)
        try {
          const bridgeRes = await axios.post('http://100.87.8.59:18790', {
            phone: phone,
            otp: generatedOtp,
            token: 'rvm-otp-bridge-2026'
          }, { timeout: 15000 });
          console.log("Bridge response:", bridgeRes.status, bridgeRes.data);
          if (bridgeRes.data.success) {
            return res.status(200).json({ success: true, msg: "OTP Sent", bridge: 'wacli' });
          }
          console.error("Bridge returned not success:", bridgeRes.data);
        } catch (bridgeErr) {
          console.error("Bridge also failed:", bridgeErr.message);
        }
        
        // If ALL send methods fail, show OTP on screen as last resort
        return res.status(200).json({ 
          success: true, 
          msg: "OTP generated (WhatsApp unavailable)",
          otp: generatedOtp,
          waFailed: true,
          waError: typeof waDetail === 'object' ? JSON.stringify(waDetail) : String(waDetail)
        });
      }

      return res.status(200).json({ success: true, msg: "OTP Sent" });
    }

    // ---------------------------------------------------------
    // ACTION: VERIFY OTP
    // ---------------------------------------------------------
    if (action === 'verify') {
      if (!phone || !code) throw new Error("Phone and Code required");

      // 1. Fetch OTP from DB
      const { data: record, error } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('phone', phone)
        .single();

      if (error || !record) return res.status(400).json({ success: false, msg: "Invalid or Expired OTP" });

      // 2. Check Expiry
      if (new Date() > new Date(record.expires_at)) {
        return res.status(400).json({ success: false, msg: "OTP Expired" });
      }

      // 3. Check Match
      if (record.code !== code) {
        return res.status(400).json({ success: false, msg: "Invalid Code" });
      }

      // 4. Cleanup (Delete used OTP)
      await supabase.from('otp_codes').delete().eq('phone', phone);

      return res.status(200).json({ success: true, msg: "Verified" });
    }

    return res.status(400).json({ error: "Invalid Action" });

  } catch (err) {
    console.error("OTP Error:", err);
    return res.status(500).json({ error: err.message });
  }
}