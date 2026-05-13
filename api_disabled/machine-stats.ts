import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Machine Stats] Missing env vars', { supabaseUrl, hasKey: !!supabaseServiceKey });
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { method, query, headers } = req;

  // Extract machine ID from the URL path: /api/machines/:id/stats
  // Vercel routing: /api/machine-stats?id=xxx or /api/machine-stats/xxx
  let machineId = query.id as string;
  
  // Handle both /api/machine-stats?id=xxx and /api/machine-stats/xxx
  if (!machineId && query.id === undefined) {
    // Try to get from the first path param if using /:id pattern
    const pathParts = (req.url || '').split('/');
    const statsIndex = pathParts.indexOf('machine-stats');
    if (statsIndex !== -1 && pathParts[statsIndex + 1]) {
      machineId = pathParts[statsIndex + 1];
    }
  }

  try {
    console.log('[Machine Stats] Request for machine:', machineId);

    // Validate machine_id
    if (!machineId) {
      return res.status(400).json({ error: 'Missing machine_id parameter' });
    }

    if (method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get machine details first
    const { data: machine, error: machineError } = await supabase
      .from('machines')
      .select('id, device_no, name, latitude, longitude')
      .eq('device_no', machineId)
      .single();

    if (machineError || !machine) {
      console.error('[Machine Stats] Machine not found:', machineId);
      return res.status(404).json({ error: 'Machine not found' });
    }

    // Calculate time ranges
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch stats for Day (Today)
    const { data: dayData, error: dayError } = await supabase
      .from('submission_reviews')
      .select('id, api_weight, calculated_value, user_id, status, created_at')
      .eq('device_no', machineId)
      .gte('created_at', todayStart.toISOString());

    // Fetch stats for Week
    const { data: weekData, error: weekError } = await supabase
      .from('submission_reviews')
      .select('id, api_weight, calculated_value, user_id, status, created_at')
      .eq('device_no', machineId)
      .gte('created_at', weekStart.toISOString());

    // Fetch stats for Month
    const { data: monthData, error: monthError } = await supabase
      .from('submission_reviews')
      .select('id, api_weight, calculated_value, user_id, status, created_at')
      .eq('device_no', machineId)
      .gte('created_at', monthStart.toISOString());

    // Helper function to calculate stats
    const calcStats = (data: any[]) => {
      if (!data || data.length === 0) {
        return { volume: 0, submissions: 0, newUsers: 0, points: 0 };
      }
      
      const volume = data.reduce((sum, r) => sum + (Number(r.api_weight) || 0), 0);
      const submissions = data.filter(r => r.status === 'VERIFIED' || r.status === 'APPROVED').length;
      const points = data.reduce((sum, r) => sum + (Number(r.calculated_value) || 0), 0);
      
      // Count unique users for newUsers (just total unique in period)
      const uniqueUsers = new Set(data.map(r => r.user_id).filter(Boolean));
      
      return {
        volume: Math.round(volume * 100) / 100,
        submissions,
        newUsers: uniqueUsers.size,
        points: Math.round(points * 100) / 100
      };
    };

    const dayStats = calcStats(dayData);
    const weekStats = calcStats(weekData);
    const monthStats = calcStats(monthData);

    // Fetch hourly breakdown for today (for chart)
    const hourlyData: Record<number, number> = {};
    if (dayData) {
      dayData.forEach((r: any) => {
        if (r.created_at) {
          const hour = new Date(r.created_at).getHours();
          hourlyData[hour] = (hourlyData[hour] || 0) + (Number(r.api_weight) || 0);
        }
      });
    }

    const hourlyBreakdown = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      weight: Math.round((hourlyData[i] || 0) * 100) / 100
    }));

    // Fetch daily breakdown for last 7 days
    const dailyData: Record<string, number> = {};
    if (weekData) {
      weekData.forEach((r: any) => {
        if (r.created_at) {
          const date = new Date(r.created_at).toISOString().split('T')[0];
          dailyData[date] = (dailyData[date] || 0) + (Number(r.api_weight) || 0);
        }
      });
    }

    const dailyBreakdown = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyBreakdown.push({
        date: dateStr,
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        weight: Math.round((dailyData[dateStr] || 0) * 100) / 100
      });
    }

    console.log('[Machine Stats] Success for machine:', machineId);

    return res.status(200).json({
      success: true,
      machine: {
        id: machine.id,
        device_no: machine.device_no,
        name: machine.name,
        lat: machine.latitude,
        lng: machine.longitude
      },
      stats: {
        day: dayStats,
        week: weekStats,
        month: monthStats,
        hourlyBreakdown,
        dailyBreakdown
      }
    });

  } catch (error: any) {
    console.error('[Machine Stats API] Uncaught error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}