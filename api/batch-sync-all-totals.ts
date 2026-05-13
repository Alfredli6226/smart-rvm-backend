// ===== Batch Sync User Totals =====
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

  try {
    const url = process.env.VITE_SUPABASE_URL;
    const merchantNo = process.env.VITE_MERCHANT_NO;
    const apiSecret = process.env.VITE_API_SECRET;
    let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) return res.status(500).json({ error: 'Missing DB credentials' });
    if (!merchantNo || !apiSecret) return res.status(500).json({ error: 'Missing vendor credentials' });

    // Test and fallback key
    let supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    let { error: testErr } = await supabase.from('users').select('id').limit(1);
    if (testErr && process.env.VITE_SUPABASE_ANON_KEY) {
      key = process.env.VITE_SUPABASE_ANON_KEY;
      supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
      testErr = (await supabase.from('users').select('id').limit(1)).error;
    }
    if (testErr) return res.status(500).json({ error: 'DB auth failed', msg: testErr.message });

    // Fetch users who need syncing (missing totals or zero totals with activity)
    const { data: allUsers, error: fetchErr } = await supabase
      .from('users')
      .select('id, phone, total_weight, total_points')
      .not('phone', 'is', null)
      .neq('phone', '')
      .limit(100); // Max 100 users per run

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });
    if (!allUsers || allUsers.length === 0) return res.json({ msg: 'No users to sync' });

    const results: any[] = [];
    let synced = 0, skipped = 0, failed = 0;

    // Helper: call vendor API
    async function callVendor(phone: string) {
      const ts = Date.now().toString();
      const sign = crypto.createHash('md5').update(merchantNo + apiSecret + ts).digest('hex');
      const resp = await axios.post(API_BASE + '/api/open/v1/user/account/sync', { phone }, {
        headers: { "merchant-no": merchantNo, "timestamp": ts, "sign": sign, "Content-Type": "application/json" },
        timeout: 5000
      });
      const d = resp?.data?.data;
      return {
        points: Number(d?.integral || 0),
        weight: Number(d?.totalWeight || d?.totalRecycleWeight || d?.total_weight || 0)
      };
    }

    for (const u of allUsers as any[]) {
      const dbPts = Number(u.total_points || 0);
      const dbWt = Number(u.total_weight || 0);

      // Skip users who already have data AND have been synced recently
      if (dbPts > 0 && dbWt > 0) {
        skipped++; continue;
      }

      try {
        const v = await callVendor(u.phone);
        if (v.weight <= 0 && v.points > 0) v.weight = Number((v.points / 0.2).toFixed(2));

        if (dbPts === 0 && dbWt === 0 && v.points === 0) {
          skipped++; continue;
        }

        const { error: uErr } = await supabase
          .from('users')
          .update({ total_points: v.points, total_weight: v.weight, updated_at: new Date().toISOString() })
          .eq('id', u.id);

        if (uErr) { failed++; results.push({ phone: u.phone, status: 'FAIL', msg: uErr.message }); }
        else { synced++; results.push({ phone: u.phone, status: 'OK', pts: v.points, wt: v.weight }); }
      } catch (e: any) {
        failed++; results.push({ phone: u.phone, status: 'VENDOR_FAIL', msg: e.message });
      }
    }

    return res.status(200).json({ ok: true, synced, skipped, failed, total: allUsers.length, results });

  } catch (err: any) {
    return res.status(500).json({ error: err.message, stack: err.stack?.substring(0, 200) });
  }
}
