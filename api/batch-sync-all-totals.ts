import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import crypto from 'crypto';

const API_BASE = "https://api.autogcm.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const MERCHANT_NO = process.env.VITE_MERCHANT_NO;
  const SECRET = process.env.VITE_API_SECRET;

  if (!supabaseUrl || !supabaseKey || !MERCHANT_NO || !SECRET) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  async function callVendor(phone: string) {
    const timestamp = Date.now().toString();
    const sign = crypto.createHash('md5').update(MERCHANT_NO! + SECRET! + timestamp).digest('hex');
    try {
      const vendorRes = await axios.post(API_BASE + '/api/open/v1/user/account/sync', { phone }, {
        headers: {
          "merchant-no": MERCHANT_NO,
          "timestamp": timestamp,
          "sign": sign,
          "Content-Type": "application/json"
        },
        timeout: 8000
      });
      const data = vendorRes?.data?.data;
      return {
        integral: Number(data?.integral || 0),
        totalWeight: Number(data?.totalWeight || data?.totalRecycleWeight || data?.total_weight || 0),
        error: null
      };
    } catch (e: any) {
      return { integral: 0, totalWeight: 0, error: e.message || 'API failed' };
    }
  }

  try {
    // Fetch all users with phone numbers
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
    let batchSize = 0;

    for (let i = 0; i < allUsers.length; i++) {
      // Process in batches of 10, yield to Vercel timeout
      if (batchSize >= 10 || i === allUsers.length - 1) {
        batchSize = 0;
        // Small delay between batches to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      }

      const user = allUsers[i];
      const vendorData = await callVendor(user.phone);

      if (vendorData.error) {
        errorCount++;
        results.push({ phone: user.phone, status: 'ERROR', msg: vendorData.error });
        continue;
      }

      const vendorPoints = vendorData.integral;
      const vendorWeight = vendorData.totalWeight > 0
        ? vendorData.totalWeight
        : Number((vendorPoints / 0.2).toFixed(2)); // Fallback: weight = points / 0.2

      // Check if DB already has correct data
      const dbPoints = Number(user.total_points || 0);
      const dbWeight = Number(user.total_weight || 0);
      const hasExistingData = dbPoints > 0 || dbWeight > 0;

      if (!hasExistingData && vendorPoints === 0) {
        skippedCount++;
        results.push({ phone: user.phone, status: 'SKIPPED', msg: 'No data in vendor either' });
        continue;
      }

      // Update the users table with vendor data
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
          weight: vendorWeight,
          was_update: hasExistingData
        });
      }

      batchSize++;
    }

    return res.json({
      synced: syncedCount,
      skipped: skippedCount,
      errors: errorCount,
      total: allUsers.length,
      results
    });

  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
