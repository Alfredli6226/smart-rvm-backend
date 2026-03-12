import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Initialize Supabase with SERVICE ROLE KEY (Bypasses RLS)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const WAAPI_URL = "https://waapi.app/api/v1/instances";
const WAAPI_ID = process.env.WAAPI_INSTANCE_ID;
const WAAPI_TOKEN = process.env.WAAPI_TOKEN;

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

      // 3. Store in Supabase (Upsert: Update if exists, Insert if new)
      const { error: dbError } = await supabase
        .from('otp_codes')
        .upsert({ 
          phone: phone, 
          code: generatedOtp, 
          expires_at: expiresAt 
        }, { onConflict: 'phone' });

      if (dbError) throw dbError;

      // 4. Send via WaAPI
      // Note: WaAPI expects number in format "60123456789@c.us"
      // We strip '+' just in case, though your frontend sends clean numbers
      const chatId = `${phone.replace('+', '')}@c.us`;
      
      await axios.post(
        `${WAAPI_URL}/${WAAPI_ID}/client/action/send-message`,
        {
          chatId: chatId,
          message: `Your RVM Login Code is: *${generatedOtp}*\n\nValid for 5 minutes.`
        },
        { headers: { Authorization: `Bearer ${WAAPI_TOKEN}` } }
      );

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