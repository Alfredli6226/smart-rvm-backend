// ===== Reports API — Real-time from Vendor API =====
import { fetchAllIntegralRecords, fetchRecentIntegralRecords, integralToWeight, score, classifyWasteType, fetchVendorDevices } from './vendor-live.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Requested-With');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || 'overview';

  try {
    switch (action) {
      case 'overview':
        return await getOverview(res);
      case 'daily':
        return await getDaily(res);
      case 'weekly':
        return await getWeekly(res);
      case 'monthly':
        return await getMonthly(res);
      case 'user-engagement':
        return await getUserEngagement(res);
      case 'revenue-projections':
        return await getRevenueProjections(res);
      case 'machine-efficiency':
        return await getMachineEfficiency(res);
      default:
        return res.status(404).json({ error: `Unknown action: ${action}` });
    }
  } catch (error) {
    console.error('Reports error:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function getOverview(res) {
  try {
    const [records, devices, supabase] = await Promise.all([
      fetchAllIntegralRecords(70), // Get ALL records (~3250)
      fetchVendorDevices(),
      createClient(SUPABASE_URL, SUPABASE_KEY)
    ]);

    const [{ count: dbUsers }, { count: dbMachines }] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('machines').select('*', { count: 'exact', head: true })
    ]);

    const totalWeight = records.reduce((s, r) => s + integralToWeight(r.integralNum), 0);
    const totalPoints = records.reduce((s, r) => s + score(r.integralNum), 0);
    const todayRecords = records.filter(r => {
      const d = r.recordedTime || r.createTime || '';
      return d.startsWith(new Date().toISOString().slice(0, 10));
    });
    const todayWeight = todayRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0);

    const activeMachines = devices.filter(d => d.is_online).length;

    return res.json({
      totalUsers: dbUsers || 0,
      totalMachines: dbMachines || devices.length,
      activeMachines,
      recentSubmissions: records.length,
      totalWeight: totalWeight.toFixed(2),
      totalPoints: totalPoints.toFixed(2),
      todaySubmissions: todayRecords.length,
      todayWeight: todayWeight.toFixed(2),
      liveFromVendor: true,
      generatedAt: new Date().toISOString()
    });
  } catch (e) {
    return res.json({
      totalUsers: 0, totalMachines: 0, activeMachines: 0,
      recentSubmissions: 0, totalWeight: '0', totalPoints: '0',
      todaySubmissions: 0, todayWeight: '0',
      error: e.message, generatedAt: new Date().toISOString()
    });
  }
}

async function getDaily(res) {
  const today = new Date().toISOString().slice(0, 10);
  const records = await fetchRecentIntegralRecords(10);
  const todayRecords = records.filter(r => {
    const d = r.recordedTime || r.createTime || '';
    return d.startsWith(today);
  });

  const totalWeight = todayRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0);
  const totalPoints = todayRecords.reduce((s, r) => s + score(r.integralNum), 0);

  // Breakdown by machine
  const machineBreakdown = {};
  todayRecords.forEach(r => {
    const dn = r.deviceNo || 'Unknown';
    if (!machineBreakdown[dn]) machineBreakdown[dn] = { submissions: 0, weight: 0, points: 0 };
    machineBreakdown[dn].submissions++;
    machineBreakdown[dn].weight += integralToWeight(r.integralNum);
    machineBreakdown[dn].points += score(r.integralNum);
  });

  return res.json({
    date: today,
    submissions: todayRecords.length,
    totalWeight: totalWeight.toFixed(2),
    totalPoints: totalPoints.toFixed(2),
    uniqueUsers: new Set(todayRecords.map(r => r.userId)).size,
    machineBreakdown,
    liveFromVendor: true,
    generatedAt: new Date().toISOString()
  });
}

async function getWeekly(res) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStart = weekAgo.toISOString().slice(0, 10);

  const allRecords = await fetchAllIntegralRecords(70);
  const weekRecords = allRecords.filter(r => {
    const d = r.recordedTime || r.createTime || '';
    return d >= weekStart;
  });

  const totalWeight = weekRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0);
  const totalPoints = weekRecords.reduce((s, r) => s + score(r.integralNum), 0);

  // Daily breakdown
  const dailyBreakdown = {};
  weekRecords.forEach(r => {
    const day = (r.recordedTime || r.createTime || '').slice(0, 10);
    if (!dailyBreakdown[day]) dailyBreakdown[day] = { submissions: 0, weight: 0, points: 0 };
    dailyBreakdown[day].submissions++;
    dailyBreakdown[day].weight += integralToWeight(r.integralNum);
    dailyBreakdown[day].points += score(r.integralNum);
  });

  return res.json({
    period: { start: weekStart, end: new Date().toISOString().slice(0, 10) },
    totalSubmissions: weekRecords.length,
    totalWeight: totalWeight.toFixed(2),
    totalPoints: totalPoints.toFixed(2),
    uniqueUsers: new Set(weekRecords.map(r => r.userId)).size,
    dailyBreakdown,
    liveFromVendor: true,
    generatedAt: new Date().toISOString()
  });
}

async function getMonthly(res) {
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthStart = monthAgo.toISOString().slice(0, 10);

  const allRecords = await fetchAllIntegralRecords(70);
  const monthRecords = allRecords.filter(r => {
    const d = r.recordedTime || r.createTime || '';
    return d >= monthStart;
  });

  const totalWeight = monthRecords.reduce((s, r) => s + integralToWeight(r.integralNum), 0);
  const totalPoints = monthRecords.reduce((s, r) => s + score(r.integralNum), 0);

  const devices = await fetchVendorDevices();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });

  // Waste type breakdown
  const wasteBreakdown = {};
  monthRecords.forEach(r => {
    const type = classifyWasteType(r);
    wasteBreakdown[type] = (wasteBreakdown[type] || 0) + integralToWeight(r.integralNum);
  });

  return res.json({
    period: { start: monthStart, end: new Date().toISOString().slice(0, 10) },
    totalSubmissions: monthRecords.length,
    totalWeight: totalWeight.toFixed(2),
    totalPoints: totalPoints.toFixed(2),
    totalUsers: totalUsers || 0,
    activeMachines: devices.filter(d => d.is_online).length,
    uniqueUsersThisMonth: new Set(monthRecords.map(r => r.userId)).size,
    wasteBreakdown,
    liveFromVendor: true,
    generatedAt: new Date().toISOString()
  });
}

async function getUserEngagement(res) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const [allRecords, { data: dbUsers }] = await Promise.all([
    fetchAllIntegralRecords(70),
    supabase.from('users').select('*').limit(1000)
  ]);

  if (!dbUsers || dbUsers.length === 0) {
    return res.json({ totalUsers: 0, engagementDistribution: {}, topEngagedUsers: [], averageEngagementScore: '0', recommendations: [] });
  }

  // Calculate user stats from vendor integral data
  const userStats = {};
  allRecords.forEach(r => {
    const uid = r.userId;
    if (!userStats[uid]) userStats[uid] = { weight: 0, points: 0, count: 0, lastDate: '' };
    userStats[uid].weight += integralToWeight(r.integralNum);
    userStats[uid].points += score(r.integralNum);
    userStats[uid].count++;
    const dt = r.recordedTime || r.createTime || '';
    if (dt > userStats[uid].lastDate) userStats[uid].lastDate = dt;
  });

  const userEngagement = dbUsers.map(u => {
    const uid = u.user_id || u.vendor_user_id || u.id;
    const stats = userStats[uid] || { weight: 0, points: 0, count: 0, lastDate: '' };
    const daysSinceReg = Math.floor((new Date() - new Date(u.created_at || u.createTime)) / 86400000) || 1;
    const daysSinceActive = stats.lastDate ? Math.floor((new Date() - new Date(stats.lastDate)) / 86400000) : 999;

    let score = 0;
    score += Math.min(stats.weight / 10, 40);           // weight 40%
    score += Math.min(stats.points / 5, 20);             // points 20%
    score += Math.min((stats.count / daysSinceReg) * 100, 30); // frequency 30%
    if (daysSinceActive <= 7) score += 10;
    else if (daysSinceActive <= 30) score += 5;

    const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : score >= 20 ? 'low' : 'inactive';

    return {
      userId: uid,
      name: u.nick_name || u.full_name || u.email || `User ${uid}`,
      totalWeight: stats.weight.toFixed(2),
      totalPoints: stats.points.toFixed(2),
      submissions: stats.count,
      engagementScore: Math.round(score * 100) / 100,
      engagementLevel: level,
      lastActive: stats.lastDate
    };
  });

  userEngagement.sort((a, b) => b.engagementScore - a.engagementScore);

  const levels = { high: [], medium: [], low: [], inactive: [] };
  userEngagement.forEach(u => levels[u.engagementLevel].push(u));

  const recommendations = [];
  if (levels.high.length > 0) recommendations.push(`Reward ${levels.high.length} highly engaged users with bonus points`);
  if (levels.inactive.length > (levels.high.length + levels.medium.length + levels.low.length) * 0.3)
    recommendations.push(`Re-engage ${levels.inactive.length} inactive users with special offers`);

  // Cohort retention
  const cohorts = {};
  dbUsers.forEach(u => {
    const m = new Date(u.created_at || u.createTime).toISOString().slice(0, 7);
    if (!cohorts[m]) cohorts[m] = { total: 0, active: 0 };
    cohorts[m].total++;
    if (userStats[u.user_id || u.vendor_user_id || u.id]) cohorts[m].active++;
  });

  return res.json({
    totalUsers: userEngagement.length,
    engagementDistribution: { high: levels.high.length, medium: levels.medium.length, low: levels.low.length, inactive: levels.inactive.length },
    topEngagedUsers: userEngagement.slice(0, 20),
    cohortRetention: Object.entries(cohorts).map(([m, s]) => ({ month: m, totalUsers: s.total, activeUsers: s.active, retentionRate: s.total > 0 ? ((s.active / s.total) * 100).toFixed(1) : '0' })),
    averageEngagementScore: userEngagement.length > 0 ? (userEngagement.reduce((s, u) => s + u.engagementScore, 0) / userEngagement.length).toFixed(2) : '0',
    recommendations,
    liveFromVendor: true
  });
}

async function getRevenueProjections(res) {
  const allRecords = await fetchAllIntegralRecords(70);
  const monthlyData = {};
  const pricePerKg = { UCO: 2.5, Plastic: 0.8, Aluminum: 1.2, Paper: 0.3 };

  allRecords.forEach(r => {
    const month = (r.recordedTime || r.createTime || '').slice(0, 7);
    if (!month) return;
    if (!monthlyData[month]) monthlyData[month] = { weight: 0, submissions: 0, revenue: 0 };
    const w = integralToWeight(r.integralNum);
    monthlyData[month].weight += w;
    monthlyData[month].submissions++;
    const type = classifyWasteType(r);
    monthlyData[month].revenue += w * (pricePerKg[type] || 0.5);
  });

  const monthlyStats = Object.entries(monthlyData)
    .map(([month, d]) => ({ month, weight: d.weight.toFixed(2), submissions: d.submissions, revenue: d.revenue.toFixed(2) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  function calcGrowth(data) {
    if (data.length < 2) return 0;
    const rates = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i - 1] !== 0) rates.push((data[i] - data[i - 1]) / data[i - 1]);
    }
    return rates.length > 0 ? rates.reduce((s, r) => s + r, 0) / rates.length : 0;
  }

  const growthRates = {
    weight: calcGrowth(monthlyStats.map(m => parseFloat(m.weight))),
    submissions: calcGrowth(monthlyStats.map(m => m.submissions)),
    revenue: calcGrowth(monthlyStats.map(m => parseFloat(m.revenue)))
  };

  const projections = [];
  const last = monthlyStats[monthlyStats.length - 1];
  if (last) {
    for (let i = 1; i <= 3; i++) {
      const pm = new Date();
      pm.setMonth(pm.getMonth() + i);
      const conf = Math.max(0.3, 0.8 - 0.1 * i - (Math.abs(growthRates.revenue) > 0.3 ? 0.2 : 0));
      projections.push({
        month: pm.toISOString().slice(0, 7),
        projectedWeight: (parseFloat(last.weight) * Math.pow(1 + growthRates.weight, i)).toFixed(2),
        projectedSubmissions: Math.round(last.submissions * Math.pow(1 + growthRates.submissions, i)),
        projectedRevenue: (parseFloat(last.revenue) * Math.pow(1 + growthRates.revenue, i)).toFixed(2),
        confidence: conf
      });
    }
  }

  const monthlyCost = 5000; // 10 machines × RM500
  const monthlyRev = last ? parseFloat(last.revenue) : 0;
  const monthlyProfit = monthlyRev - monthlyCost;

  const recommendations = [];
  if (growthRates.revenue < 0.1) recommendations.push('Implement growth strategies to increase monthly revenue');
  if (monthlyRev > 0 && monthlyProfit / monthlyRev < 0.2) recommendations.push('Optimize operational costs to improve profit margin');
  if (monthlyRev < 1000) recommendations.push('Focus on increasing recycling volume');
  
  return res.json({
    historicalData: monthlyStats,
    growthRates,
    projections,
    annualProjection: last ? { weight: (parseFloat(last.weight) * 12).toFixed(2), submissions: last.submissions * 12, revenue: (parseFloat(last.revenue) * 12).toFixed(2) } : { weight: '0', submissions: 0, revenue: '0' },
    financialMetrics: {
      monthlyRevenue: monthlyRev.toFixed(2),
      monthlyCosts: monthlyCost.toFixed(2),
      monthlyProfit: monthlyProfit.toFixed(2),
      profitMargin: monthlyRev > 0 ? ((monthlyProfit / monthlyRev) * 100).toFixed(1) : '0',
      roiMonths: monthlyProfit > 0 ? ((15000 * 10) / monthlyProfit).toFixed(1) : '999',
      breakEvenDate: monthlyProfit > 0 ? new Date(Date.now() + ((15000 * 10) / monthlyProfit) * 30 * 86400000).toISOString().split('T')[0] : 'N/A'
    },
    recommendations,
    liveFromVendor: true
  });
}

async function getMachineEfficiency(res) {
  const [devices, allRecords] = await Promise.all([
    fetchVendorDevices(),
    fetchAllIntegralRecords(70)
  ]);

  const machineData = {};
  allRecords.forEach(r => {
    const dn = r.deviceNo || 'Unknown';
    if (!machineData[dn]) machineData[dn] = { submissions: 0, weight: 0, points: 0, count: 0, lastDate: '' };
    machineData[dn].submissions++;
    machineData[dn].weight += integralToWeight(r.integralNum);
    machineData[dn].points += score(r.integralNum);
    machineData[dn].count++;
    const dt = r.recordedTime || r.createTime || '';
    if (dt > machineData[dn].lastDate) machineData[dn].lastDate = dt;
  });

  const machineEfficiency = devices.map(d => {
    const dn = d.device_no;
    const stats = machineData[dn] || { submissions: 0, weight: 0, points: 0, count: 0, lastDate: '' };
    const uptime = d.is_online ? (stats.submissions > 0 ? 95 : 50) : 0;
    const daysActive = Math.max(1, Math.floor((new Date() - new Date(d.last_active_at || Date.now())) / 86400000));
    const submissionsPerDay = stats.submissions / daysActive;
    const revenue = stats.weight * 0.5;

    let effScore = uptime * 0.3 + Math.min(submissionsPerDay * 10, 30) + (stats.submissions > 0 ? 20 : 5) + (stats.weight < 80 ? 20 : 5);
    const level = effScore >= 80 ? 'High' : effScore >= 60 ? 'Medium' : 'Low';

    const recs = [];
    if (!d.is_online) recs.push('Machine offline — check connectivity');
    if (submissionsPerDay < 1) recs.push('Low usage — consider relocation or marketing');
    if (stats.weight > 80) recs.push('Near capacity — schedule collection');

    return {
      device: dn,
      name: d.name || dn,
      location: d.address || '',
      status: d.is_online ? 'Active' : 'Offline',
      uptime: `${uptime}%`,
      submissions: stats.submissions,
      submissionsPerDay: submissionsPerDay.toFixed(1),
      totalWeight: stats.weight.toFixed(2),
      revenue: revenue.toFixed(2),
      lastActive: stats.lastDate || 'Never',
      efficiencyScore: effScore.toFixed(1),
      efficiencyLevel: level,
      recommendations: recs
    };
  });

  machineEfficiency.sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  return res.json({
    machines: machineEfficiency,
    overallMetrics: {
      totalMachines: machineEfficiency.length,
      activeMachines: devices.filter(d => d.is_online).length,
      averageUptime: machineEfficiency.length > 0 ? (machineEfficiency.reduce((s, m) => s + parseFloat(m.uptime), 0) / machineEfficiency.length).toFixed(1) : '0',
      totalRevenue: machineEfficiency.reduce((s, m) => s + parseFloat(m.revenue), 0).toFixed(2),
      highEfficiency: machineEfficiency.filter(m => m.efficiencyLevel === 'High').length,
      mediumEfficiency: machineEfficiency.filter(m => m.efficiencyLevel === 'Medium').length,
      lowEfficiency: machineEfficiency.filter(m => m.efficiencyLevel === 'Low').length
    },
    topPerformers: machineEfficiency.slice(0, 5),
    needAttention: machineEfficiency.filter(m => m.efficiencyLevel === 'Low').slice(0, 5),
    liveFromVendor: true
  });
}
