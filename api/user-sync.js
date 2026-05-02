// ===== User Name Sync API =====
// Merges Supabase user names with integral record data
import { createClient } from '@supabase/supabase-js';
import { fetchAllIntegralRecords, integralToWeight } from './vendor-live.js';

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() || '';
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const [records, userRes] = await Promise.all([
      fetchAllIntegralRecords(70),
      SUPABASE_URL && SUPABASE_KEY 
        ? fetch(SUPABASE_URL + '/rest/v1/users?select=user_id,nickname,phone,total_weight&limit=10000&order=user_id.asc', {
            headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, Accept: 'application/json' }
          }).then(r => r.json()).catch(() => [])
        : []
    ]);

    // Build name lookup from Supabase
    const nameMap = {};
    const phoneMap = {};
    if (Array.isArray(userRes)) {
      for (const u of userRes) {
        if (u.user_id) nameMap[String(u.user_id)] = u.nickname || '';
        if (u.phone) phoneMap[u.phone] = u.nickname || '';
      }
    }

    // Group integral records by userId
    const userGroups = {};
    for (const r of (records || [])) {
      const uid = r.userId || 'unknown';
      if (!userGroups[uid]) userGroups[uid] = { userId: uid, totalWeight: 0, totalPoints: 0, submissions: 0, lastSeen: '' };
      userGroups[uid].totalWeight += integralToWeight(r.integralNum);
      userGroups[uid].totalPoints += parseFloat(r.integralNum || 0);
      userGroups[uid].submissions++;
      if ((r.recordedTime || r.createTime || '') > userGroups[uid].lastSeen) userGroups[uid].lastSeen = r.recordedTime || r.createTime || '';
    }

    const enrichedMap = {};
    
    // Build reverse lookup: userId -> phone from Supabase
    const userIdToPhone = {};
    if (Array.isArray(userRes)) {
      for (const u of userRes) {
        if (u.phone && u.user_id) userIdToPhone[String(u.user_id)] = u.phone;
      }
    }
    
    // Add users from integral records (with vendor weights)
    for (const u of Object.values(userGroups)) {
      const name = nameMap[u.userId] || phoneMap[u.userId] || ('User ' + u.userId.slice(-6));
      const phone = userIdToPhone[u.userId] || '';
      enrichedMap[u.userId] = {
        userId: u.userId, name: name, phone: phone,
        totalWeight: +u.totalWeight.toFixed(1),
        totalPoints: +u.totalPoints.toFixed(1),
        submissions: u.submissions,
        lastSeen: u.lastSeen,
        source: 'vendor'
      };
    }
    
    // Add users from Supabase (all registered users, even with 0 weight)
    if (Array.isArray(userRes)) {
      for (const u of userRes) {
        const uid = String(u.user_id);
        if (!enrichedMap[uid]) {
          enrichedMap[uid] = {
            userId: uid,
            name: u.nickname || u.phone || 'User',
            phone: u.phone || '',
            totalWeight: 0,
            totalPoints: 0,
            submissions: 0,
            lastSeen: '',
            source: 'supabase'
          };
        }
      }
    }
    
    const enriched = Object.values(enrichedMap);
    enriched.sort((a, b) => b.totalWeight - a.totalWeight);
    
    // Calculate totals
    const supabaseTotal = Array.isArray(userRes) 
      ? userRes.reduce((s, u) => s + (parseFloat(u.total_weight || 0)), 0)
      : 0;
    const vendorTotal = Object.values(userGroups).reduce((s, u) => s + (u.totalWeight || 0), 0);

    return res.status(200).json({
      success: true,
      total: enriched.length,
      source: 'merged',
      stats: {
        totalWeight: +supabaseTotal.toFixed(1),
        vendorWeight: +vendorTotal.toFixed(1),
        supabaseWeight: +supabaseTotal.toFixed(1),
        usersWithWeight: enriched.filter(u => u.totalWeight > 0).length,
        totalUsers: enriched.length
      },
      users: enriched
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
