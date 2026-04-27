import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildSupabase() {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey);
}

function dayKey(value) {
  return new Date(value).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short'
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabase = buildSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  try {
    const { endpoint } = req.query;

    switch (endpoint) {
      case 'stats':
        return await getStats(supabase, res);
      case 'users':
        return await getUsers(supabase, req, res);
      case 'recycling-activity':
        return await getRecyclingActivity(supabase, res);
      case 'points-distribution':
        return await getPointsDistribution(supabase, res);
      case 'machine-usage':
        return await getMachineUsage(supabase, res);
      case 'waste-distribution':
        return await getWasteDistribution(supabase, res);
      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('User analytics error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
}

async function getStats(supabase, res) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    usersResult,
    reviewsResult,
    machinesResult,
    todayReviewsResult,
    todayUsersResult
  ] = await Promise.all([
    supabase.from('users').select('id, user_id, status', { count: 'exact' }),
    supabase.from('submission_reviews').select('api_weight, calculated_value, status, submitted_at'),
    supabase.from('machines').select('is_active, is_manual_offline'),
    supabase.from('submission_reviews').select('api_weight, calculated_value, submitted_at').gte('submitted_at', todayStart.toISOString()),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString())
  ]);

  if (usersResult.error) throw usersResult.error;
  if (reviewsResult.error) throw reviewsResult.error;
  if (machinesResult.error) throw machinesResult.error;
  if (todayReviewsResult.error) throw todayReviewsResult.error;
  if (todayUsersResult.error) throw todayUsersResult.error;

  const reviews = (reviewsResult.data || []).filter((row) => String(row.status || '').toUpperCase() === 'VERIFIED');
  const todayReviews = todayReviewsResult.data || [];
  const machines = machinesResult.data || [];

  return res.status(200).json({
    totalUsers: usersResult.count || 0,
    totalSubmissions: reviews.length,
    totalPoints: Number(reviews.reduce((sum, row) => sum + num(row.calculated_value), 0).toFixed(2)),
    activeMachines: machines.filter((m) => m.is_active && !m.is_manual_offline).length,
    totalMachines: machines.length,
    todaySubmissions: todayReviews.length,
    todayPoints: Number(todayReviews.reduce((sum, row) => sum + num(row.calculated_value), 0).toFixed(2)),
    todayUsers: todayUsersResult.count || 0,
    totalWeight: Number(reviews.reduce((sum, row) => sum + num(row.api_weight), 0).toFixed(2)),
    todayWeight: Number(todayReviews.reduce((sum, row) => sum + num(row.api_weight), 0).toFixed(2))
  });
}

async function getUsers(supabase, req, res) {
  const limit = parseInt(req.query.limit || '10', 10);
  const page = parseInt(req.query.page || '1', 10);
  const offset = (page - 1) * limit;

  const { data: users, error, count } = await supabase
    .from('users')
    .select('*', { count: 'exact' })
    .order('total_weight', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const userIds = (users || []).map((user) => user.user_id || user.id).filter(Boolean);
  let reviewMap = new Map();

  if (userIds.length > 0) {
    const { data: reviews, error: reviewError } = await supabase
      .from('submission_reviews')
      .select('user_id, api_weight, calculated_value, submitted_at, status')
      .in('user_id', userIds);

    if (reviewError) throw reviewError;

    reviewMap = (reviews || []).reduce((map, review) => {
      const key = String(review.user_id || '');
      const current = map.get(key) || [];
      current.push(review);
      map.set(key, current);
      return map;
    }, new Map());
  }

  const usersWithStats = (users || []).map((user) => {
    const key = String(user.user_id || user.id || '');
    const reviews = (reviewMap.get(key) || []).filter((review) => String(review.status || '').toUpperCase() === 'VERIFIED');
    const totalRecycled = reviews.reduce((sum, review) => sum + num(review.api_weight), 0) || num(user.total_weight);
    const totalPoints = reviews.reduce((sum, review) => sum + num(review.calculated_value), 0) || num(user.total_points);
    const lastActivity = reviews
      .map((review) => review.submitted_at)
      .filter(Boolean)
      .sort()
      .pop();

    return {
      id: key,
      name: user.nickName || user.full_name || user.nickname || `User ${key}`,
      phone: user.phone || 'N/A',
      email: user.email || 'N/A',
      recycled: `${totalRecycled.toFixed(2)} kg`,
      points: Number(totalPoints.toFixed(2)),
      lastActivity: lastActivity ? new Date(lastActivity).toLocaleDateString() : 'Never',
      status: String(user.status) === '0' ? 'active' : 'inactive',
      department: user.deptName || 'N/A',
      registrationDate: user.createTime ? new Date(user.createTime).toLocaleDateString() : (user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A')
    };
  });

  return res.status(200).json({
    users: usersWithStats,
    page,
    limit,
    total: count || 0
  });
}

async function getRecyclingActivity(supabase, res) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: submissions, error } = await supabase
    .from('submission_reviews')
    .select('submitted_at, api_weight, status')
    .gte('submitted_at', sevenDaysAgo.toISOString())
    .order('submitted_at', { ascending: true });

  if (error) throw error;

  const dailyActivity = {};
  (submissions || [])
    .filter((submission) => String(submission.status || '').toUpperCase() === 'VERIFIED')
    .forEach((submission) => {
      const date = dayKey(submission.submitted_at);
      if (!dailyActivity[date]) dailyActivity[date] = { count: 0, weight: 0 };
      dailyActivity[date].count += 1;
      dailyActivity[date].weight += num(submission.api_weight);
    });

  const labels = Object.keys(dailyActivity);
  return res.status(200).json({
    labels,
    datasets: [
      {
        label: 'Submissions',
        data: labels.map((date) => dailyActivity[date].count),
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)'
      },
      {
        label: 'Weight (kg)',
        data: labels.map((date) => Number(dailyActivity[date].weight.toFixed(2))),
        borderColor: '#764ba2',
        backgroundColor: 'rgba(118, 75, 162, 0.1)',
        yAxisID: 'y1'
      }
    ]
  });
}

async function getPointsDistribution(supabase, res) {
  const { data: users, error } = await supabase.from('users').select('total_points');
  if (error) throw error;

  const categories = { '0-10': 0, '11-50': 0, '51-200': 0, '201-1000': 0, '1000+': 0 };
  (users || []).forEach((user) => {
    const points = num(user.total_points);
    if (points <= 10) categories['0-10'] += 1;
    else if (points <= 50) categories['11-50'] += 1;
    else if (points <= 200) categories['51-200'] += 1;
    else if (points <= 1000) categories['201-1000'] += 1;
    else categories['1000+'] += 1;
  });

  return res.status(200).json({
    labels: Object.keys(categories),
    datasets: [{
      data: Object.values(categories),
      backgroundColor: ['#667eea', '#764ba2', '#FFD700', '#FFA500', '#FF6347']
    }]
  });
}

async function getMachineUsage(supabase, res) {
  const { data: machines, error: machinesError } = await supabase
    .from('machines')
    .select('device_no, name, is_active');
  if (machinesError) throw machinesError;

  const deviceNos = (machines || []).map((machine) => machine.device_no).filter(Boolean);
  let reviewMap = new Map();

  if (deviceNos.length > 0) {
    const { data: reviews, error: reviewError } = await supabase
      .from('submission_reviews')
      .select('device_no, status')
      .in('device_no', deviceNos);
    if (reviewError) throw reviewError;

    reviewMap = (reviews || []).reduce((map, review) => {
      const key = String(review.device_no || '');
      map.set(key, (map.get(key) || 0) + (String(review.status || '').toUpperCase() === 'VERIFIED' ? 1 : 0));
      return map;
    }, new Map());
  }

  const machineUsage = (machines || []).map((machine) => ({
    device: machine.device_no,
    name: machine.name || `RVM ${machine.device_no}`,
    submissions: reviewMap.get(String(machine.device_no || '')) || 0,
    status: machine.is_active ? 'active' : 'inactive'
  })).sort((a, b) => b.submissions - a.submissions);

  return res.status(200).json({
    labels: machineUsage.map((machine) => machine.device),
    datasets: [{
      label: 'Submissions',
      data: machineUsage.map((machine) => machine.submissions),
      backgroundColor: machineUsage.map((machine) => machine.status === 'active' ? 'rgba(102, 126, 234, 0.8)' : 'rgba(200, 200, 200, 0.8)')
    }],
    machines: machineUsage
  });
}

async function getWasteDistribution(supabase, res) {
  const { data: submissions, error } = await supabase
    .from('submission_reviews')
    .select('waste_type, api_weight, status');
  if (error) throw error;

  const wasteDistribution = {};
  (submissions || [])
    .filter((submission) => String(submission.status || '').toUpperCase() === 'VERIFIED')
    .forEach((submission) => {
      const wasteType = submission.waste_type || 'Unknown';
      const weight = num(submission.api_weight);
      if (!wasteDistribution[wasteType]) wasteDistribution[wasteType] = { count: 0, weight: 0 };
      wasteDistribution[wasteType].count += 1;
      wasteDistribution[wasteType].weight += weight;
    });

  const labels = Object.keys(wasteDistribution);
  return res.status(200).json({
    labels,
    datasets: [
      {
        label: 'Count',
        data: labels.map((type) => wasteDistribution[type].count),
        backgroundColor: ['#667eea', '#764ba2', '#FFD700', '#FFA500', '#FF6347', '#4CAF50']
      },
      {
        label: 'Weight (kg)',
        data: labels.map((type) => Number(wasteDistribution[type].weight.toFixed(2))),
        backgroundColor: [
          'rgba(102, 126, 234, 0.6)',
          'rgba(118, 75, 162, 0.6)',
          'rgba(255, 215, 0, 0.6)',
          'rgba(255, 165, 0, 0.6)',
          'rgba(255, 99, 71, 0.6)',
          'rgba(76, 175, 80, 0.6)'
        ]
      }
    ],
    distribution: wasteDistribution
  });
}
