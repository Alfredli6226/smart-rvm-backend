import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

const WAAPI_URL = "https://waapi.app/api/v1/instances";
const WAAPI_ID = (process.env.WAAPI_INSTANCE_ID || '').replace('#', '').trim();
const WAAPI_TOKEN = (process.env.WAAPI_TOKEN || '').trim();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, phone, code } = req.body;

  try {
    if (action === 'send') {
      if (!phone) throw new Error("Phone number required");

      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      if (!WAAPI_ID || !WAAPI_TOKEN) {
        return res.status(500).json({ success: false, msg: "WhatsApp service not configured" });
      }

      await supabase.from('otp_codes').upsert({ 
        phone, code: generatedOtp, expires_at: expiresAt 
      }, { onConflict: 'phone' });

      const chatId = `${phone.replace('+', '')}@c.us`;

      try {
        const waRes = await axios.post(
          `${WAAPI_URL}/${WAAPI_ID}/client/action/send-message`,
          { chatId, message: `Your RVM Login Code is: *${generatedOtp}*\n\nValid for 5 minutes.` },
          { headers: { Authorization: `Bearer ${WAAPI_TOKEN}` } }
        );
      } catch (waErr: any) {
        console.error("WaAPI failed:", waErr.message);
        
        try {
          const bridgeRes = await axios.post('http://100.87.8.59:18790', {
            phone, otp: generatedOtp, token: 'rvm-otp-bridge-2026'
          }, { timeout: 3000 });
          if (bridgeRes.data.success) {
            return res.status(200).json({ success: true, msg: "OTP Sent", bridge: 'wacli' });
          }
        } catch (bridgeErr: any) {
          console.error("Bridge also failed:", bridgeErr.message);
        }

        return res.status(200).json({ 
          success: true, msg: "OTP generated (WhatsApp unavailable)",
          otp: generatedOtp, waFailed: true
        });
      }

      return res.status(200).json({ success: true, msg: "OTP Sent" });
    }

    if (action === 'verify') {
      if (!phone || !code) throw new Error("Phone and Code required");
      const { data: record, error } = await supabase
        .from('otp_codes').select('*').eq('phone', phone).single();

      if (error || !record) return res.status(400).json({ success: false, msg: "Invalid or Expired OTP" });
      if (new Date() > new Date(record.expires_at)) return res.status(400).json({ success: false, msg: "OTP Expired" });
      if (record.code !== code) return res.status(400).json({ success: false, msg: "Invalid Code" });

      await supabase.from('otp_codes').delete().eq('phone', phone);
      return res.status(200).json({ success: true, msg: "Verified" });
    }

    return res.status(400).json({ error: "Invalid Action" });
  } catch (err: any) {
    console.error("OTP Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
