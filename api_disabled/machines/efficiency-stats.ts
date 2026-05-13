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
    console.error('[Efficiency Stats] Missing env vars', { supabaseUrl, hasKey: !!supabaseServiceKey });
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    console.log('[Efficiency Stats] Request:', req.method);

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all machines with their submissions in last 30 days
    const { data: submissions, error: submissionsError } = await supabase
      .from('submission_reviews')
      .select('id, device_no, api_weight, calculated_value, status, created_at')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .in('status', ['VERIFIED', 'APPROVED']);

    if (submissionsError) {
      console.error('[Efficiency Stats] Fetch error:', submissionsError);
      return res.status(500).json({ error: 'Failed to fetch submissions' });
    }

    // Get all machines for location data
    const { data: machines, error: machinesError } = await supabase
      .from('machines')
      .select('id, device_no, name, latitude, longitude');

    if (machinesError) {
      console.error('[Efficiency Stats] Machines fetch error:', machinesError);
      return res.status(500).json({ error: 'Failed to fetch machines' });
    }

    // Aggregate stats by machine
    const machineStats: Record<string, {
      deviceNo: string;
      name: string;
      lat: number;
      lng: number;
      totalWeight: number;
      totalPoints: number;
      submissionCount: number;
      efficiencyRatio: number;
    }> = {};

    // Initialize with all machines
    if (machines) {
      machines.forEach(m => {
        machineStats[m.device_no] = {
          deviceNo: m.device_no,
          name: m.name,
          lat: Number(m.latitude) || 0,
          lng: Number(m.longitude) || 0,
          totalWeight: 0,
          totalPoints: 0,
          submissionCount: 0,
          efficiencyRatio: 0
        };
      });
    }

    // Aggregate submissions
    if (submissions) {
      submissions.forEach(s => {
        const deviceNo = s.device_no;
        if (!machineStats[deviceNo]) {
          machineStats[deviceNo] = {
            deviceNo,
            name: '',
            lat: 0,
            lng: 0,
            totalWeight: 0,
            totalPoints: 0,
            submissionCount: 0,
            efficiencyRatio: 0
          };
        }

        const weight = Number(s.api_weight) || 0;
        const points = Number(s.calculated_value) || 0;

        machineStats[deviceNo].totalWeight += weight;
        machineStats[deviceNo].totalPoints += points;
        machineStats[deviceNo].submissionCount += 1;

        // Calculate efficiency ratio (points per kg) - lower is better
        if (weight > 0) {
          machineStats[deviceNo].efficiencyRatio = points / weight;
        }
      });
    }

    // Convert to array and sort by efficiency (best = lowest points per kg)
    const result = Object.values(machineStats)
      .filter(m => m.totalWeight > 0 || m.totalPoints > 0)
      .map(m => ({
        ...m,
        totalWeight: Math.round(m.totalWeight * 100) / 100,
        totalPoints: Math.round(m.totalPoints * 100) / 100,
        efficiencyRatio: Math.round(m.efficiencyRatio * 100) / 100,
        // Performance classification
        performance: m.totalWeight > 0 && m.efficiencyRatio < 5 ? 'gold' :
                      m.totalWeight > 0 && m.efficiencyRatio > 15 ? 'warning' : 'normal'
      }))
      .sort((a, b) => a.efficiencyRatio - b.efficiencyRatio);

    // Calculate global averages
    const avgEfficiency = result.length > 0
      ? result.reduce((sum, m) => sum + m.efficiencyRatio, 0) / result.length
      : 0;

    const totalVolume = result.reduce((sum, m) => sum + m.totalWeight, 0);
    const totalPointsPaid = result.reduce((sum, m) => sum + m.totalPoints, 0);

    console.log('[Efficiency Stats] Success:', result.length, 'machines');

    return res.status(200).json({
      success: true,
      period: '30_days',
      summary: {
        avgEfficiency: Math.round(avgEfficiency * 100) / 100,
        totalVolume: Math.round(totalVolume * 100) / 100,
        totalPointsPaid: Math.round(totalPointsPaid * 100) / 100,
        machineCount: result.length
      },
      machines: result
    });

  } catch (error: any) {
    console.error('[Efficiency Stats API] Uncaught error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}