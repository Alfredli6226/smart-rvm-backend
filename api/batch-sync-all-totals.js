// ===== Batch Sync All User Totals from Vendor API =====
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { createHash } from 'crypto';

const API_BASE = "https://api.autogcm.com";

export default async function handler(req, res) {
  // CORS
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
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  async function callVendor(phone) {
    const timestamp = Date.now().toString();
    const sign = createHash('md5').update(MERCHANT_NO + SECRET + timestamp).digest('hex');
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
    } catch (e) {
      return { integral: 0, totalWeight: 0, error: e.message || 'API failed' };
    }
  }

  try {
    // Fetch ALL users with phone numbers
    const { data: allUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, user_id, phone, total_weight, total_points, nickname')
      .not('phone', 'is', null)
      .neq('phone', '');

    if (fetchError) return res.status(500).json({ error: fetchError.message });
    if (!allUsers || allUsers.length === 0) return res.json({ synced: 0, msg: 'No users found' });

    const results = [];
    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process in batches with delay to avoid rate limiting
    for (let i = 0; i < allUsers.length; i++) {
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
        : Number((vendorPoints / 0.2).toFixed(2));

      // Skip users with zero data in both DB and vendor
      const dbPoints = Number(user.total_points || 0);
      const dbWeight = Number(user.total_weight || 0);
      
      if (dbPoints === 0 && dbWeight === 0 && vendorPoints === 0) {
        skippedCount++;
        results.push({ phone: user.phone, status: 'SKIPPED', msg: 'No data in either system' });
        continue;
      }

      // Update the users table with vendor totals
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

      // Small delay every 5 users to avoid rate limiting
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

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
