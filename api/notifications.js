// ===== Notifications & Alerts — Real-time from Vendor API =====
import { fetchAllIntegralRecords, fetchRecentIntegralRecords, integralToWeight, score, fetchVendorDevices } from './vendor-live.js';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MACHINE_CAPACITY = 600; // Default capacity in kg

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || 'check-alerts';
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    switch (action) {
      case 'check-alerts':
        return await checkAlerts(supabase, res);
      case 'get-notifications':
        return await getNotifications(supabase, req, res);
      case 'send-notification':
        return await sendNotification(supabase, req, res);
      case 'mark-read':
        return await markRead(supabase, req, res);
      default:
        return res.status(404).json({ error: 'Action not found' });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function checkAlerts(supabase, res) {
  const alerts = [];

  // 1. Check top recyclers from vendor integral data
  try {
    const allRecords = await fetchAllIntegralRecords(70);
    const userTotals = {};
    allRecords.forEach(r => {
      const uid = r.userId;
      if (!userTotals[uid]) userTotals[uid] = { weight: 0, points: 0, count: 0 };
      userTotals[uid].weight += integralToWeight(r.integralNum);
      userTotals[uid].points += score(r.integralNum);
      userTotals[uid].count++;
    });

    const topUsers = Object.entries(userTotals)
      .map(([uid, stats]) => ({ userId: uid, ...stats }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    topUsers.forEach(u => {
      alerts.push({
        type: 'info',
        title: '🏆 Top Recycler Alert',
        message: `User ${u.userId} has recycled ${u.weight.toFixed(2)}kg and earned ${u.points.toFixed(2)} points. Consider a reward!`,
        userId: u.userId,
        weight: u.weight,
        points: u.points,
        timestamp: new Date().toISOString(),
        action: 'send_reward_notification'
      });
    });
  } catch (e) {
    console.error('Top recycler check failed:', e.message);
  }

  // 2. Check machine status from vendor API
  try {
    const devices = await fetchVendorDevices();
    const offlineDevices = devices.filter(d => !d.is_online);
    offlineDevices.forEach(d => {
      alerts.push({
        type: 'warning',
        title: '🔴 Machine Offline',
        message: `Machine ${d.device_no} at ${d.address || 'Unknown location'} is offline!`,
        deviceNo: d.device_no,
        timestamp: new Date().toISOString(),
        action: 'check_maintenance'
      });
    });
  } catch (e) {
    console.error('Machine check failed:', e.message);
  }

  // 3. Check for very active machines (high throughput)
  try {
    const allRecords = await fetchRecentIntegralRecords(3);
    const recentCounts = {};
    allRecords.forEach(r => {
      const dn = r.deviceNo || 'Unknown';
      recentCounts[dn] = (recentCounts[dn] || 0) + 1;
    });
    Object.entries(recentCounts).forEach(([dn, count]) => {
      if (count > 20) {
        alerts.push({
          type: 'info',
          title: '⚡ High Activity Alert',
          message: `Machine ${dn} has ${count} submissions recently — consider scheduling collection`,
          deviceNo: dn,
          submissions: count,
          timestamp: new Date().toISOString(),
          action: 'schedule_collection'
        });
      }
    });
  } catch (e) {
    console.error('Activity check failed:', e.message);
  }

  return res.json({
    alerts,
    total: alerts.length,
    urgent: alerts.filter(a => a.type === 'critical').length,
    warnings: alerts.filter(a => a.type === 'warning').length,
    info: alerts.filter(a => a.type === 'info').length
  });
}

async function getNotifications(supabase, req, res) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ data: data || [] });
}

async function sendNotification(supabase, req, res) {
  const { title, message, type, user_email } = req.body || {};
  if (!title || !message) return res.status(400).json({ error: 'title and message required' });

  const { data, error } = await supabase.from('notifications').insert({
    title, message, type: type || 'INFO', user_email: user_email || 'admin@hmadigital.asia'
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ success: true, notification: data });
}

async function markRead(supabase, req, res) {
  const { id } = req.query || req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  const { error } = await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  return res.json({ success: true });
}
