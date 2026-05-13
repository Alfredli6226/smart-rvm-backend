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
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { query } = req;
  const period = (query.period as string) || 'day';

  const now = new Date();
  let currentStart: Date;
  let previousStart: Date;
  let previousEnd: Date;

  if (period === 'day') {
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    previousEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'week') {
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    currentStart = startOfWeek;
    previousStart = new Date(startOfWeek);
    previousStart.setDate(previousStart.getDate() - 7);
    previousEnd = startOfWeek;
  } else if (period === 'month') {
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    previousEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    return res.status(400).json({ error: 'Invalid period. Use day, week, or month' });
  }

  try {
    console.log('[Comparison API] Period:', period);

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { data: submissions, error: subsError } = await supabase
      .from('submission_reviews')
      .select('submitted_at, api_weight, calculated_value')
      .in('status', ['VERIFIED', 'APPROVED']);

    if (subsError) {
      console.error('[Comparison] Submissions error:', subsError);
      return res.status(500).json({ error: subsError.message });
    }

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('created_at');

    if (usersError) {
      console.error('[Comparison] Users error:', usersError);
      return res.status(500).json({ error: usersError.message });
    }

    const filterByPeriod = (data: any[], start: Date, end: Date) => {
      return data.filter(item => {
        const itemDate = new Date(item.created_at || item.submitted_at);
        return itemDate >= start && itemDate < end;
      });
    };

    const currentSubs = filterByPeriod(submissions || [], currentStart, now);
    const previousSubs = filterByPeriod(submissions || [], previousStart, previousEnd);

    const currentWeight = currentSubs.reduce((sum, s) => sum + (Number(s.api_weight) || 0), 0);
    const previousWeight = previousSubs.reduce((sum, s) => sum + (Number(s.api_weight) || 0), 0);

    const currentExpenses = currentSubs.reduce((sum, s) => sum + (Number(s.calculated_value) || 0), 0);
    const previousExpenses = previousSubs.reduce((sum, s) => sum + (Number(s.calculated_value) || 0), 0);

    const currentCount = currentSubs.length;
    const previousCount = previousSubs.length;

    const currentNewUsers = filterByPeriod(users || [], currentStart, now).length;
    const previousNewUsers = filterByPeriod(users || [], previousStart, previousEnd).length;

    return res.status(200).json({
      success: true,
      period,
      current: {
        deliveryVolume: Math.round(currentWeight * 100) / 100,
        totalExpenses: Math.round(currentExpenses * 100) / 100,
        submissionCount: currentCount,
        newUserCount: currentNewUsers
      },
      previous: {
        deliveryVolume: Math.round(previousWeight * 100) / 100,
        totalExpenses: Math.round(previousExpenses * 100) / 100,
        submissionCount: previousCount,
        newUserCount: previousNewUsers
      }
    });

  } catch (error: any) {
    console.error('[Comparison API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
