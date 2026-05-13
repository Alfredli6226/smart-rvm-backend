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
  const type = query.type as string;

  try {
    console.log('[Rankings API] Request:', type);

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!['user', 'equipment'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Use "user" or "equipment"' });
    }

    if (type === 'user') {
      // Get top 10 users by total weight
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, nickname, phone, total_weight')
        .order('total_weight', { ascending: false })
        .limit(10);

      if (usersError) {
        console.error('[Rankings] Users error:', usersError);
        return res.status(500).json({ error: usersError.message });
      }

      const rankings = (users || []).map((user, index) => ({
        rank: index + 1,
        id: user.id,
        username: user.nickname || 'Anonymous',
        phone: maskPhone(user.phone),
        totalWeight: user.total_weight || 0
      }));

      return res.status(200).json({
        success: true,
        type: 'user',
        rankings
      });
    }

    if (type === 'equipment') {
      // Get top 10 machines by total weight (from submission_reviews)
      const { data: submissions, error: subsError } = await supabase
        .from('submission_reviews')
        .select('device_no, api_weight')
        .in('status', ['VERIFIED', 'APPROVED']);

      if (subsError) {
        console.error('[Rankings] Equipment error:', subsError);
        return res.status(500).json({ error: subsError.message });
      }

      // Aggregate by device_no
      const weightByDevice: Record<string, number> = {};
      (submissions || []).forEach(s => {
        const device = s.device_no;
        if (!weightByDevice[device]) weightByDevice[device] = 0;
        weightByDevice[device] += Number(s.api_weight) || 0;
      });

      // Sort and get top 10
      const sorted = Object.entries(weightByDevice)
        .map(([device_no, total_weight], index) => ({
          rank: index + 1,
          deviceNo: device_no,
          totalWeight: Math.round(total_weight * 100) / 100
        }))
        .sort((a, b) => b.totalWeight - a.totalWeight)
        .slice(0, 10)
        .map((item, index) => ({ ...item, rank: index + 1 }));

      return res.status(200).json({
        success: true,
        type: 'equipment',
        rankings: sorted
      });
    }

  } catch (error: any) {
    console.error('[Rankings API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

function maskPhone(phone: string | null): string {
  if (!phone) return '****';
  if (phone.length < 7) return '****';
  const start = phone.slice(0, 3);
  const end = phone.slice(-4);
  return `${start}****${end}`;
}