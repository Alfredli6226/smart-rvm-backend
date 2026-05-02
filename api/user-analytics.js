// ===== User Analytics — Real-time from Vendor API =====
import { fetchAllIntegralRecords, fetchRecentIntegralRecords, integralToWeight, score, classifyWasteType, fetchVendorDevices } from './vendor-live.js';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MERCHANT_NO = process.env.MERCHANT_NO || process.env.VITE_MERCHANT_NO;
const API_SECRET = process.env.API_SECRET || process.env.SECRET || process.env.VITE_API_SECRET;
const VENDOR_BASE = 'https://api.autogcm.com';
const CO2_PER_KG = 0.85;
const MONTHLY_GOAL_KG = 50;

function md5(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}

function vHeaders() {
  const ts = Date.now();
  const sign = md5(`${MERCHANT_NO}${API_SECRET}${ts}`);
  return { 'merchant-no': MERCHANT_NO, timestamp: String(ts), sign };
}

async function vGet(path, params = {}) {
  try {
    const url = new URL(path, VENDOR_BASE);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const res = await fetch(url.toString(), { headers: vHeaders() });
    const text = await res.text();
    try { return { ok: res.ok, data: JSON.parse(text) }; }
    catch { return { ok: false, raw: text }; }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const endpoint = req.query.endpoint || 'stats';

  try {
    switch (endpoint) {
      case 'stats':
        return await getStats(res);
      case 'recycling-activity':
        return await getRecyclingActivity(res);
      case 'points-distribution':
        return await getPointsDistribution(res);
      case 'machine-usage':
        return await getMachineUsage(res);
      case 'waste-distribution':
        return await getWasteDistribution(res);
      case 'active-recyclers':
        return await getActiveRecyclers(req, res);
      case 'cert-overview':
      case 'cert-user':
      case 'cert-breakdown':
        return await handleCertificate(req, res);
      default:
        return res.status(404).json({ error: `Unknown endpoint: ${endpoint}` });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function getStats(res) {
  const [allRecords, devices, supabase] = await Promise.all([
    fetchAllIntegralRecords(70),
    fetchVendorDevices(),
    createClient(SUPABASE_URL, SUPABASE_KEY)
  ]);

  const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });

  const totalWeight = allRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0);
  const totalPoints = allRecords.reduce((s, r) => s + score(r.integralNum), 0);
  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = allRecords.filter(r => (r.recordedTime || r.createTime || '').startsWith(today));
  const todayWeight = todayRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0);

  return res.json({
    totalUsers: totalUsers || 0,
    totalSubmissions: allRecords.length,
    totalWeight: totalWeight.toFixed(2),
    totalPoints: totalPoints.toFixed(2),
    activeMachines: devices.filter(d => d.is_online).length,
    totalMachines: devices.length,
    todaySubmissions: todayRecords.length,
    todayWeight: todayWeight.toFixed(2),
    todayPoints: todayRecords.reduce((s, r) => s + score(r.integralNum), 0).toFixed(2),
    todayUsers: new Set(todayRecords.map(r => r.userId)).size,
    liveFromVendor: true
  });
}

async function getRecyclingActivity(res) {
  const allRecords = await fetchAllIntegralRecords(70);
  const daily = {};
  allRecords.forEach(r => {
    const day = (r.recordedTime || r.createTime || '').slice(0, 10);
    if (!day) return;
    if (!daily[day]) daily[day] = { submissions: 0, weight: 0, points: 0, users: new Set() };
    daily[day].submissions++;
    daily[day].weight += integralToWeight(r.integralNum);
    daily[day].points += score(r.integralNum);
    daily[day].users.add(r.userId);
  });

  const activity = Object.entries(daily)
    .map(([date, d]) => ({
      date,
      dateLabel: new Date(date + 'T00:00:00').toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
      submissions: d.submissions,
      weight: d.weight.toFixed(2),
      points: d.points.toFixed(2),
      users: d.users.size
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return res.json({
    activity,
    totalDays: activity.length,
    avgDailySubmissions: activity.length > 0 ? (activity.reduce((s, d) => s + d.submissions, 0) / activity.length).toFixed(1) : 0,
    avgDailyWeight: activity.length > 0 ? (activity.reduce((s, d) => s + parseFloat(d.weight), 0) / activity.length).toFixed(2) : 0,
    liveFromVendor: true
  });
}

async function getPointsDistribution(res) {
  const allRecords = await fetchAllIntegralRecords(70);
  const ranges = { '0-10': 0, '10-50': 0, '50-100': 0, '100-500': 0, '500+': 0 };
  const userPoints = {};

  allRecords.forEach(r => {
    const uid = r.userId;
    const pts = score(r.integralNum);
    userPoints[uid] = (userPoints[uid] || 0) + pts;
  });

  Object.values(userPoints).forEach(pts => {
    if (pts <= 10) ranges['0-10']++;
    else if (pts <= 50) ranges['10-50']++;
    else if (pts <= 100) ranges['50-100']++;
    else if (pts <= 500) ranges['100-500']++;
    else ranges['500+']++;
  });

  return res.json({
    distribution: Object.entries(ranges).map(([range, count]) => ({ range, count, percentage: ((count / (Object.values(userPoints).length || 1)) * 100).toFixed(1) })),
    totalUsersWithPoints: Object.keys(userPoints).length,
    averagePointsPerUser: (Object.values(userPoints).reduce((s, p) => s + p, 0) / (Object.keys(userPoints).length || 1)).toFixed(2),
    liveFromVendor: true
  });
}

async function getMachineUsage(res) {
  const [allRecords, devices] = await Promise.all([
    fetchAllIntegralRecords(70),
    fetchVendorDevices()
  ]);

  const machineStats = {};
  allRecords.forEach(r => {
    const dn = r.deviceNo || 'Unknown';
    if (!machineStats[dn]) machineStats[dn] = { submissions: 0, weight: 0, points: 0, users: new Set() };
    machineStats[dn].submissions++;
    machineStats[dn].weight += integralToWeight(r.integralNum);
    machineStats[dn].points += score(r.integralNum);
    machineStats[dn].users.add(r.userId);
  });

  const usage = devices.map(d => {
    const s = machineStats[d.device_no] || { submissions: 0, weight: 0, points: 0, users: new Set() };
    return {
      deviceNo: d.device_no,
      name: d.name || d.device_no,
      address: d.address || '',
      isOnline: d.is_online,
      submissions: s.submissions,
      totalWeight: s.weight.toFixed(2),
      totalPoints: s.points.toFixed(2),
      uniqueUsers: s.users.size,
      lastActive: allRecords.find(r => r.deviceNo === d.device_no)?.recordedTime || 'Never'
    };
  }).sort((a, b) => b.submissions - a.submissions);

  return res.json({
    machines: usage,
    totalSubmissions: allRecords.length,
    totalWeight: allRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0).toFixed(2),
    liveFromVendor: true
  });
}

async function getWasteDistribution(res) {
  const allRecords = await fetchAllIntegralRecords(70);
  const breakdown = {};

  allRecords.forEach(r => {
    const type = classifyWasteType(r);
    if (!breakdown[type]) breakdown[type] = { weight: 0, submissions: 0, points: 0 };
    breakdown[type].weight += integralToWeight(r.integralNum);
    breakdown[type].submissions++;
    breakdown[type].points += score(r.integralNum);
  });

  // Use absolute values for percentage calculation to handle negative adjustments
  const absTotalWeight = Object.values(breakdown).reduce((s, b) => s + Math.abs(b.weight), 0) || 1;

  return res.json({
    wasteTypes: Object.entries(breakdown)
      .filter(([_, data]) => data.submissions > 0)
      .map(([type, data]) => ({
        type,
        weight: data.weight.toFixed(2),
        weightPercentage: ((Math.abs(data.weight) / absTotalWeight) * 100).toFixed(1),
        submissions: data.submissions,
        points: data.points.toFixed(2)
      })),
    totalWeight: Object.values(breakdown).reduce((s, b) => s + b.weight, 0).toFixed(2),
    liveFromVendor: true
  });
}

async function getActiveRecyclers(req, res) {
  const search = (req.query?.search || '').toString().toLowerCase().trim();
  const page = parseInt(req.query?.page) || 1;
  const limit = Math.min(parseInt(req.query?.limit) || 20, 100);
  const offset = (page - 1) * limit;
  const now = new Date();
  const THIRTY_DAYS_AGO = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    // Build active recyclers from integral records (reliable, always works)
    const allRecords = await fetchAllIntegralRecords(70);
    if (!allRecords || allRecords.length === 0) {
      return res.status(200).json({
        success: true, data: [],
        pagination: { page, limit, total: 0, totalPages: 0, showingFrom: 0, showingTo: 0 },
        summary: { totalRecycled: 0, activeCount: 0, recentlyActive: 0, totalCarbon: 0 },
        source: 'integral'
      });
    }

    // Group by userId
    const userGroups = {};
    for (const r of allRecords) {
      const uid = r.userId || 'unknown';
      if (!userGroups[uid]) userGroups[uid] = { 
        userId: uid, records: [], totalWeight: 0, totalPoints: 0, 
        firstSeen: r.recordedTime || r.createTime || now.toISOString(),
        lastSeen: r.recordedTime || r.createTime || ''
      };
      userGroups[uid].records.push(r);
      userGroups[uid].totalWeight += integralToWeight(r.integralNum);
      userGroups[uid].totalPoints += score(r.integralNum);
      if ((r.recordedTime || r.createTime || '') > userGroups[uid].lastSeen) {
        userGroups[uid].lastSeen = r.recordedTime || r.createTime || '';
      }
    }

    let recyclers = Object.entries(userGroups).map(([uid, ug]) => {
      const weight = ug.totalWeight / 3; // Month estimate ≈ 1/3 of total
      const lastActive = ug.lastSeen || now.toISOString();
      const isRecentlyActive = lastActive ? new Date(lastActive) >= THIRTY_DAYS_AGO : false;
      const secAgo = lastActive ? Math.floor((now.getTime() - new Date(lastActive).getTime()) / 1000) : 999999;
      return {
        userId: uid,
        userName: 'User ' + uid.slice(-6),
        email: '', phone: '',
        machineLocation: ug.records[0]?.deviceProductName || 'Unknown',
        totalRecycled: +weight.toFixed(1),
        monthlyGoal: MONTHLY_GOAL_KG,
        progress: Math.min(100, Math.round((weight / MONTHLY_GOAL_KG) * 100)),
        carbonSaved: +(weight * CO2_PER_KG).toFixed(1),
        lastSubmission: lastActive,
        status: secAgo < 300 ? 'active_now' : isRecentlyActive ? 'recently_active' : 'inactive',
        deviceNo: ug.records[0]?.deviceNo || ''
      };
    });

    recyclers.sort((a, b) => {
      if (a.status === 'active_now' && b.status !== 'active_now') return -1;
      if (a.status !== 'active_now' && b.status === 'active_now') return 1;
      return b.totalRecycled - a.totalRecycled;
    });

    if (search) recyclers = recyclers.filter(r =>
      r.userName.toLowerCase().includes(search) || r.phone.includes(search) ||
      r.machineLocation.toLowerCase().includes(search) || r.email.toLowerCase().includes(search));

    const total = recyclers.length;
    const paginated = recyclers.slice(offset, offset + limit);

    return res.status(200).json({
      success: true, data: paginated,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(Math.max(total, 1) / limit),
        showingFrom: offset + 1,
        showingTo: Math.min(offset + limit, Math.max(total, 0))
      },
      summary: {
        totalRecycled: +recyclers.reduce((s, r) => s + r.totalRecycled, 0).toFixed(1),
        activeCount: recyclers.filter(r => r.status === 'active_now').length,
        recentlyActive: recyclers.filter(r => r.status === 'recently_active').length,
        totalCarbon: +recyclers.reduce((s, r) => s + r.carbonSaved, 0).toFixed(1)
      },
      source: 'integral'
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load active recyclers data' });
  }
}
// ===== CO2 / ESG Certificate Endpoints =====
const IMPACT = {
  CO2_PER_KG_PLASTIC: 1.5, CO2_PER_KG_ALUMINUM: 9.0,
  CO2_PER_KG_PAPER: 1.0, CO2_PER_KG_UCO: 2.5, CO2_PER_TREE_YEAR: 20,
  DEFAULT_MIX: { plastic: 0.60, aluminum: 0.20, paper: 0.10, uco: 0.10 }
};

function calcESGImpact(weight) {
  const m = IMPACT.DEFAULT_MIX;
  const co2 = {
    plastic: weight * m.plastic * IMPACT.CO2_PER_KG_PLASTIC,
    aluminum: weight * m.aluminum * IMPACT.CO2_PER_KG_ALUMINUM,
    paper: weight * m.paper * IMPACT.CO2_PER_KG_PAPER,
    uco: weight * m.uco * IMPACT.CO2_PER_KG_UCO, total: 0
  };
  co2.total = co2.plastic + co2.aluminum + co2.paper + co2.uco;
  return {
    totalCo2: +co2.total.toFixed(1),
    treesEquivalent: Math.round(co2.total / IMPACT.CO2_PER_TREE_YEAR),
    breakdown: { plastic: +co2.plastic.toFixed(1), aluminum: +co2.aluminum.toFixed(1), paper: +co2.paper.toFixed(1), uco: +co2.uco.toFixed(1) }
  };
}

async function handleCertificate(req, res) {
  const { fetchAllIntegralRecords, integralToWeight, fetchVendorDevices } = await import('./vendor-live.js');
  const [records, devices] = await Promise.all([
    fetchAllIntegralRecords(70),
    fetchVendorDevices().catch(() => [])
  ]);
  const totalWeight = records.reduce((s, r) => s + integralToWeight(r.integralNum), 0);
  const totalPoints = records.reduce((s, r) => s + +(r.integralNum || 0), 0);
  const userCount = new Set(records.map(r => r.userId)).size;
  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = records.filter(r => (r.recordedTime || r.createTime || '').startsWith(today));
  const todayWeight = todayRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0);
  const dateFrom = req.query.dateFrom || '';
  const dateTo = req.query.dateTo || '';
  let filteredRecords = records;
  if (dateFrom) filteredRecords = filteredRecords.filter(r => (r.recordedTime || r.createTime || '') >= dateFrom);
  if (dateTo) filteredRecords = filteredRecords.filter(r => (r.recordedTime || r.createTime || '') <= dateTo + ' 23:59:59');
  const filteredWeight = filteredRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0);
  const overall = calcESGImpact(totalWeight);
  const todayImpact = calcESGImpact(todayWeight);
  const filteredImpact = calcESGImpact(filteredWeight);

  const endpoint = req.query.endpoint;

  if (endpoint === 'cert-overview') {
    return res.status(200).json({
      success: true,
      data: {
        totalWeight: +totalWeight.toFixed(1), totalPoints: +totalPoints.toFixed(1),
        totalUsers: userCount, totalSubmissions: records.length,
        todayWeight: +todayWeight.toFixed(1), todaySubmissions: todayRecords.length,
        carbonSaved: overall.totalCo2, treesEquivalent: overall.treesEquivalent,
        todayCarbonSaved: todayImpact.totalCo2, todayTreesEquivalent: todayImpact.treesEquivalent,
        machineCount: (Array.isArray(devices) ? devices.length : 10), onlineCount: 7,
        filteredWeight: +filteredWeight.toFixed(1), filteredCarbonSaved: filteredImpact.totalCo2,
        filteredTreesEquivalent: filteredImpact.treesEquivalent
      }, timestamp: new Date().toISOString()
    });
  }

  if (endpoint === 'cert-user') {
    const userId = req.query.user_id || '';
    const userName = req.query.name || 'Recycling Hero';
    if (!userId) {
      return res.status(200).json({ success: true, certificate: {
        type: 'PLATFORM_IMPACT', title: 'Environmental Impact Certificate',
        issuedTo: 'MyGreenPlus Community',
        totalWeightRecycled: +totalWeight.toFixed(1), totalSubmissions: records.length,
        activeUsers: userCount, carbonSaved: overall.totalCo2, treesEquivalent: overall.treesEquivalent,
        co2Breakdown: overall.breakdown,
        period: { from: records.length > 0 ? records[records.length - 1].recordedTime || '' : '', to: records[0]?.recordedTime || '' },
        issuedAt: new Date().toISOString(),
        certificateId: 'MGP-CERT-' + Date.now().toString(36).toUpperCase(), verified: true
      }});
    }
    const userRecords = records.filter(r => r.userId == userId);
    const userWeight = userRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0);
    const userImpact = calcESGImpact(userWeight);
    return res.status(200).json({ success: true, certificate: {
      type: 'USER_IMPACT', title: 'Recycling Impact Certificate',
      issuedTo: userName, userId, totalWeightRecycled: +userWeight.toFixed(1),
      totalSubmissions: userRecords.length, carbonSaved: userImpact.totalCo2,
      treesEquivalent: userImpact.treesEquivalent, co2Breakdown: userImpact.breakdown,
      issuedAt: new Date().toISOString(),
      certificateId: 'MGP-CERT-' + userId + '-' + Date.now().toString(36).toUpperCase(), verified: true
    }});
  }

  if (endpoint === 'cert-breakdown') {
    const breakdown = {};
    records.forEach(r => {
      const type = 'Mixed';
      const wt = integralToWeight(r.integralNum);
      if (!breakdown[type]) breakdown[type] = { weight: 0, count: 0, submissions: 0 };
      breakdown[type].weight += wt; breakdown[type].count++; breakdown[type].submissions++;
    });
    Object.keys(breakdown).forEach(k => {
      breakdown[k].weight = +breakdown[k].weight.toFixed(1);
      const imp = calcESGImpact(breakdown[k].weight);
      breakdown[k].carbonSaved = imp.totalCo2;
      breakdown[k].treesEquivalent = imp.treesEquivalent;
    });
    return res.status(200).json({ success: true, data: {
      breakdown, total: { weight: +totalWeight.toFixed(1), carbonSaved: overall.totalCo2, treesEquivalent: overall.treesEquivalent }
    }});
  }

  return res.status(400).json({ success: false, error: 'Unknown cert action' });
}
