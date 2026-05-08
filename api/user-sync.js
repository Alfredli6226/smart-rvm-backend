// ===== User Name Sync API =====
// Merges Supabase user names with integral record data
import { createClient } from '@supabase/supabase-js';
import { fetchAllIntegralRecords, integralToWeight } from '../lib/vendor-live.js';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const VENDOR_MERCHANT = process.env.MERCHANT_NO || process.env.VITE_MERCHANT_NO || "";
const VENDOR_SECRET = process.env.API_SECRET || process.env.SECRET || process.env.VITE_API_SECRET || "";
const VENDOR_BASE = "https://api.autogcm.com";

function md5(s) { return require("crypto").createHash("md5").update(s, "utf8").digest("hex"); }
function vHeaders() { var ts = Date.now(); var sign = md5(VENDOR_MERCHANT + VENDOR_SECRET + ts); return { "merchant-no": VENDOR_MERCHANT, "timestamp": String(ts), "sign": sign }; }

async function fetchVendorUsersWithPoints() {
  try {
    var map = {};
    // Fetch multiple pages to cover more users
    for (var pg = 1; pg <= 15; pg++) {
      var res = await fetch(VENDOR_BASE + "/system/user/list?userType=11&pageNum=" + pg + "&pageSize=50", { headers: vHeaders() });
      var data = await res.json();
      var rows = data && data.rows || [];
      for (var ui = 0; ui < rows.length; ui++) {
        var u = rows[ui];
        var uid = String(u.userId || "");
        if (uid) { map[uid] = { nickName: u.nickName || "", phone: u.phonenumber || "", pointsBalance: parseFloat((u.userInfo && u.userInfo.pointsBalance) || 0) }; }
      }
      if (rows.length < 50) break;
    }
    return map;
  } catch (e) { console.warn("Vendor points fetch failed:", e.message); return {}; }
}
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Fetch users from Supabase
    let supabaseUsers = [];
    let supabaseWithdrawals = [];
    if (SUPABASE_URL && SUPABASE_KEY) {
      const authHeaders = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, Accept: 'application/json' };
      [supabaseUsers, supabaseWithdrawals] = await Promise.all([
        fetch(SUPABASE_URL + '/rest/v1/users?select=user_id,nickname,nickName,phone,total_weight,total_points&limit=10000&order=user_id.asc', { headers: authHeaders }).then(r => r.json()).catch(() => []),
        fetch(SUPABASE_URL + '/rest/v1/withdrawals?select=user_id,amount,status&limit=100000', { headers: authHeaders }).then(r => r.json()).catch(() => [])
      ]);
    }
    
    const [records, vendorUsers] = await Promise.all([
      fetchAllIntegralRecords(70),
      fetchVendorUsersWithPoints()
    ]);
    
    // Alias userRes for backward compatibility
    const userRes = supabaseUsers;
    const withdrawalRes = supabaseWithdrawals;

    // Build name lookup from Supabase
    const nameMap = {};
    const phoneMap = {};
    if (Array.isArray(userRes)) {
      for (const u of userRes) {
        if (u.user_id) nameMap[String(u.user_id)] = u.nickname || u.nickName || '';
        if (u.phone) phoneMap[u.phone] = u.nickname || u.nickName || '';
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
    
    // Calculate total withdrawn per user from Supabase withdrawals
    const withdrawalsByUser = {};
    if (Array.isArray(withdrawalRes)) {
      for (const w of withdrawalRes) {
        if (String(w.status || '').toUpperCase() === 'REJECTED') continue;
        const uid = String(w.user_id || '');
        if (!uid) continue;
        withdrawalsByUser[uid] = (withdrawalsByUser[uid] || 0) + parseFloat(w.amount || 0);
      }
    }
    
    // Add users from integral records (with vendor weights)
    for (const u of Object.values(userGroups)) {
      const name = nameMap[u.userId] || phoneMap[u.userId] || ('User ' + u.userId.slice(-6));
      const phone = userIdToPhone[u.userId] || '';
      const withdrawn = withdrawalsByUser[u.userId] || 0;
      // Use vendor pointsBalance when available (it's the authoritative source)
      const vp = vendorUsers && vendorUsers[u.userId];
      const actualBalance = vp && vp.pointsBalance > 0 ? vp.pointsBalance : +(u.totalPoints - withdrawn).toFixed(1);
      enrichedMap[u.userId] = {
        userId: u.userId, name: name, phone: phone,
        totalWeight: +u.totalWeight.toFixed(1),
        totalPoints: +u.totalPoints.toFixed(1),
        balance: actualBalance,
        totalWithdrawn: +withdrawn.toFixed(1),
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
          var vp = vendorUsers && vendorUsers[uid];
          var vBal = vp && vp.pointsBalance > 0 ? vp.pointsBalance : 0;
          // Use Supabase total_points as fallback when vendor pointsBalance not available
          var supaPts = parseFloat(u.total_points || 0);
          var totalPts = vBal > 0 ? vBal : supaPts;
          enrichedMap[uid] = {
            userId: uid,
            name: u.nickname || u.nickName || u.phone || 'User',
            phone: u.phone || '',
            totalWeight: parseFloat(u.total_weight || 0),
            totalPoints: totalPts,
            balance: totalPts,
            totalWithdrawn: 0,
            submissions: 0,
            lastSeen: '',
            source: vBal > 0 ? 'vendor' : (supaPts > 0 ? 'supabase' : 'empty')
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
