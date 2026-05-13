// ===== Batch Sync All User Totals from Vendor API =====
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as crypto from 'crypto';

const API_BASE = "https://api.autogcm.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const MERCHANT_NO = process.env.VITE_MERCHANT_NO;
  const SECRET = process.env.VITE_API_SECRET;

  if (!supabaseUrl || !supabaseKey || !MERCHANT_NO || !SECRET) {
    return res.status(500).json({ 
      error: 'Missing env vars',
      env: {
        hasUrl: !!process.env.VITE_SUPABASE_URL,
        hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
        hasMerchant: !!process.env.VITE_MERCHANT_NO,
        hasApiSecret: !!process.env.VITE_API_SECRET,
      }
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Test connection
    const { error: testError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (testError) {
      // Try with anon key as fallback
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
      if (anonKey && supabaseKey !== anonKey) {
        const supabaseAnon = createClient(supabaseUrl, anonKey, {
          auth: { autoRefreshToken: false, persistSession: false }
        });
        const { error: testError2 } = await supabaseAnon
          .from('users')
          .select('id')
          .limit(1);
        
        if (!testError2) {
          // Use the anon key client instead
          const supabase = supabaseAnon;
        } else {
          return res.status(500).json({ 
            error: 'DB connection failed', 
            serviceKeyErr: testError.message,
            anonKeyErr: testError2.message 
          });
        }
      } else {
        return res.status(500).json({ error: 'DB connection failed', detail: testError.message });
      }
    }

    // Fetch ALL users with phone numbers
    const { data: allUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, user_id, phone, total_weight, total_points, nickname')
      .not('phone', 'is', null)
      .neq('phone', '');

    if (fetchError) return res.status(500).json({ error: fetchError.message });
    if (!allUsers || allUsers.length === 0) return res.json({ synced: 0, msg: 'No users found' });

    const results: any[] = [];
    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i] as any;

      const timestamp = Date.now().toString();
      const sign = crypto.createHash('md5').update(MERCHANT_NO + SECRET + timestamp).digest('hex');

      let vendorData = { integral: 0, totalWeight: 0 };
      try {
        const vendorRes = await axios.post(API_BASE + '/api/open/v1/user/account/sync', { phone: user.phone }, {
          headers: {
            "merchant-no": MERCHANT_NO,
            "timestamp": timestamp,
            "sign": sign,
            "Content-Type": "application/json"
          },
          timeout: 8000
        });
        const data = vendorRes?.data?.data;
        vendorData = {
          integral: Number(data?.integral || 0),
          totalWeight: Number(data?.totalWeight || data?.totalRecycleWeight || data?.total_weight || 0)
        };
      } catch (e: any) {
        errorCount++;
        results.push({ phone: user.phone, status: 'VENDOR_ERROR', msg: e.message });
        continue;
      }

      const vendorPoints = vendorData.integral;
      const vendorWeight = vendorData.totalWeight > 0
        ? vendorData.totalWeight
        : Number((vendorPoints / 0.2).toFixed(2));

      const dbPoints = Number(user.total_points || 0);
      const dbWeight = Number(user.total_weight || 0);

      if (dbPoints === 0 && dbWeight === 0 && vendorPoints === 0) {
        skippedCount++;
        results.push({ phone: user.phone, status: 'SKIPPED', msg: 'No data in either system' });
        continue;
      }

      const { error: updateErr } = await supabase
        .from('users')
        .update({
          total_points: vendorPoints,
          total_weight: vendorWeight,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateErr) {
        errorCount++;
        results.push({ phone: user.phone, status: 'DB_ERROR', msg: updateErr.message });
      } else {
        syncedCount++;
        results.push({
          phone: user.phone,
          status: 'SYNCED',
          points: vendorPoints,
          weight: vendorWeight
        });
      }

      if (i > 0 && i % 5 === 0) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    return res.json({
      synced: syncedCount,
      skipped: skippedCount,
      errors: errorCount,
      total: allUsers.length,
      results
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
