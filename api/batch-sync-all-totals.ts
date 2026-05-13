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

  const url = process.env.VITE_SUPABASE_URL;
  const merchantNo = process.env.VITE_MERCHANT_NO;
  const secret = process.env.VITE_API_SECRET;

  // Try service key first, then anon key
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Missing DB credentials' });
  }
  if (!merchantNo || !secret) {
    return res.status(500).json({ error: 'Missing vendor credentials' });
  }

  try {
    // Test the key - if it fails, try anon key
    let supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    let { error: testErr } = await supabase.from('users').select('id').limit(1);
    
    if (testErr && process.env.VITE_SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_ANON_KEY !== key) {
      key = process.env.VITE_SUPABASE_ANON_KEY;
      supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
      testErr = (await supabase.from('users').select('id').limit(1)).error;
    }

    if (testErr) {
      return res.status(500).json({ error: 'DB auth failed', msg: testErr.message });
    }

    // Fetch ALL users
    const { data: allUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, user_id, phone, total_weight, total_points, nickname')
      .not('phone', 'is', null)
      .neq('phone', '');

    if (fetchError) return res.status(500).json({ error: fetchError.message });
    if (!allUsers || allUsers.length === 0) return res.json({ synced: 0, msg: 'No users found' });

    const results: any[] = [];
    let syncedCount = 0;
    let skipCount = 0;
    let errCount = 0;

    for (let i = 0; i < allUsers.length; i++) {
      const user = allUsers[i] as any;

      // Call vendor API for this user's totals
      const ts = Date.now().toString();
      const sign = crypto.createHash('md5').update(merchantNo + secret + ts).digest('hex');

      let vendorPoints = 0, vendorWeight = 0;
      try {
        const vr = await axios.post(API_BASE + '/api/open/v1/user/account/sync', { phone: user.phone }, {
          headers: { "merchant-no": merchantNo, "timestamp": ts, "sign": sign, "Content-Type": "application/json" },
          timeout: 8000
        });
        const d = vr?.data?.data;
        vendorPoints = Number(d?.integral || 0);
        vendorWeight = Number(d?.totalWeight || d?.totalRecycleWeight || d?.total_weight || 0);
        if (vendorWeight <= 0 && vendorPoints > 0) vendorWeight = Number((vendorPoints / 0.2).toFixed(2));
      } catch (e: any) {
        errCount++;
        results.push({ phone: user.phone, status: 'VENDOR_FAIL', msg: e.message });
        continue;
      }

      // Skip users with no data
      const dbPts = Number(user.total_points || 0);
      const dbWt = Number(user.total_weight || 0);
      if (dbPts === 0 && dbWt === 0 && vendorPoints === 0) {
        skipCount++;
        results.push({ phone: user.phone, status: 'SKIPPED' });
        continue;
      }

      // Try UPDATE — if it fails (anon key RLS), skip but track it
      const { error: uErr } = await supabase
        .from('users')
        .update({ total_points: vendorPoints, total_weight: vendorWeight, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (uErr) {
        errCount++;
        results.push({ phone: user.phone, status: 'UPDATE_FAIL', msg: uErr.message });
      } else {
        syncedCount++;
        results.push({ phone: user.phone, status: 'OK', pts: vendorPoints, wt: vendorWeight });
      }

      if (i > 0 && i % 5 === 0) await new Promise(r => setTimeout(r, 300));
    }

    return res.json({ synced: syncedCount, skipped: skipCount, errors: errCount, total: allUsers.length, results });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
