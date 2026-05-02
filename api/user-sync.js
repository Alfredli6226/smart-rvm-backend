// ===== User Name Sync API =====
// Calls vendor account/sync for known user phones to get real names
import { fetchAllIntegralRecords, integralToWeight, fetchVendorDevices } from './vendor-live.js';
import crypto from 'crypto';

const MERCHANT_NO = process.env.MERCHANT_NO || process.env.VITE_MERCHANT_NO || '';
const API_SECRET = process.env.API_SECRET || process.env.SECRET || process.env.VITE_API_SECRET || '';
const VENDOR_BASE = 'https://api.autogcm.com';

function md5(s) { return crypto.createHash('md5').update(s, 'utf8').digest('hex'); }

function vHeaders() {
  const ts = Date.now();
  return {
    'merchant-no': MERCHANT_NO,
    'timestamp': String(ts),
    'sign': md5(`${MERCHANT_NO}${API_SECRET}${ts}`),
    'Content-Type': 'application/json'
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || 'list';

  try {
    const allRecords = await fetchAllIntegralRecords(70);
    if (!allRecords || allRecords.length === 0) {
      return res.status(200).json({ success: true, users: [], source: 'no-data' });
    }

    // Group by userId to get unique users
    const userMap = {};
    for (const r of allRecords) {
      const uid = r.userId || 'unknown';
      if (!userMap[uid]) {
        userMap[uid] = { 
          userId: uid, 
          records: [], 
          totalWeight: 0, 
          totalPoints: 0,
          firstSeen: r.recordedTime || r.createTime || '',
          lastSeen: r.recordedTime || r.createTime || ''
        };
      }
      userMap[uid].records.push(r);
      userMap[uid].totalWeight += integralToWeight(r.integralNum);
      userMap[uid].totalPoints += parseFloat(r.integralNum || 0);
      if ((r.recordedTime || r.createTime || '') > userMap[uid].lastSeen) {
        userMap[uid].lastSeen = r.recordedTime || r.createTime || '';
      }
    }

    if (action === 'list') {
      const users = Object.values(userMap).map((u: any) => ({
        userId: u.userId,
        totalWeight: +u.totalWeight.toFixed(1),
        totalPoints: +u.totalPoints.toFixed(1),
        totalSubmissions: u.records.length,
        firstSeen: u.firstSeen,
        lastSeen: u.lastSeen,
        status: u.lastSeen ? 'active' : 'inactive'
      }));
      return res.status(200).json({ success: true, total: users.length, users, source: 'integral' });
    }

    // Try to enrich with names from account/sync
    if (action === 'enrich') {
      const users = Object.values(userMap) as any[];
      const enriched = [];
      const batchSize = 3; // Max 3 at a time to avoid rate limit
      
      for (const u of users.slice(0, batchSize)) {
        try {
          // Try to look up by userId as phone fallback
          const res = await fetch(`${VENDOR_BASE}/api/open/v1/user/account/sync`, {
            method: 'POST',
            headers: vHeaders(),
            body: JSON.stringify({ phone: u.userId })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.code === 200 && data.data) {
              enriched.push({
                userId: u.userId,
                name: data.data.nikeName || u.userId,
                phone: data.data.phone || '',
                integral: data.data.integral || 0
              });
              continue;
            }
          }
        } catch(e) {}
        enriched.push({ userId: u.userId, name: 'User ' + u.userId.slice(-6), phone: '', integral: 0 });
      }
      
      return res.status(200).json({ success: true, total: enriched.length, users: enriched, source: 'enriched' });
    }

    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
