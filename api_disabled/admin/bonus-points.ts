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
    console.error('[Bonus Points Stats] Missing env vars', { supabaseUrl, hasKey: !!supabaseServiceKey });
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  if (supabaseServiceKey === process.env.VITE_SUPABASE_ANON_KEY) {
    console.error('[Bonus Points Stats] FATAL: Using anon key - cannot perform admin operations');
    return res.status(500).json({ error: 'Server misconfigured: Missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { headers } = req;

  try {
    console.log('[Bonus Points Stats] Request:', req.method);

    const authHeader = headers.authorization;
    if (!authHeader) {
      console.warn('[Bonus Points Stats] No auth header');
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error('[Bonus Points Stats] Auth error:', authError);
      return res.status(401).json({ error: 'Invalid authorization' });
    }

    if (!authUser?.email) {
      console.warn('[Bonus Points Stats] No email in token');
      return res.status(401).json({ error: 'Invalid authorization' });
    }

    const { data: adminData, error: adminError } = await supabase
      .from('app_admins')
      .select('role')
      .eq('email', authUser.email)
      .single();

    if (adminError) {
      console.error('[Bonus Points Stats] Admin check error:', adminError);
    }

    if (!adminData || adminData.role !== 'SUPER_ADMIN') {
      console.warn('[Bonus Points Stats] Not super admin:', adminData);
      return res.status(403).json({ error: 'Access denied. Super Admin only.' });
    }

    console.log('[Bonus Points Stats] Authorized as SUPER_ADMIN');

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const baseRate = 0.5;

    const { data: submissions, error: submissionsError } = await supabase
      .from('submission_reviews')
      .select('id, user_id, calculated_value, total_weight, status, multiplier, created_at')
      .eq('status', 'VERIFIED');

    if (submissionsError) {
      console.error('[Bonus Points Stats] Submissions error:', submissionsError);
      return res.status(500).json({ error: 'Failed to fetch submissions' });
    }

    let totalBasePoints = 0;
    let totalBonusPoints = 0;
    const tierCounts: Record<string, number> = {
      '1x': 0,
      '1.5x': 0,
      '2x': 0,
      '3x': 0,
      '5x': 0
    };
    const userMultipliers: Record<string, string> = {};

    submissions?.forEach(sub => {
      const weight = sub.total_weight || 0;
      const basePoints = weight * baseRate;
      const actualPoints = sub.calculated_value || basePoints;
      const bonusPoints = actualPoints - basePoints;

      totalBasePoints += basePoints;
      totalBonusPoints += Math.max(0, bonusPoints);

      const multiplier = sub.multiplier || 1;
      const tierKey = multiplier >= 5 ? '5x' : multiplier >= 3 ? '3x' : multiplier >= 2 ? '2x' : multiplier >= 1.5 ? '1.5x' : '1x';
      tierCounts[tierKey]++;

      if (!userMultipliers[sub.user_id] || multiplier > parseFloat(userMultipliers[sub.user_id].replace('x', ''))) {
        userMultipliers[sub.user_id] = tierKey;
      }
    });

    const usersByTier: Record<string, number> = {
      '1x': 0,
      '1.5x': 0,
      '2x': 0,
      '3x': 0,
      '5x': 0
    };
    Object.values(userMultipliers).forEach(tier => {
      usersByTier[tier]++;
    });

    console.log('[Bonus Points Stats] Success');

    return res.status(200).json({
      success: true,
      data: {
        baseRate,
        totalBasePointsIssued: Math.round(totalBasePoints * 100) / 100,
        totalBonusPointsIssued: Math.round(totalBonusPoints * 100) / 100,
        totalPointsIssued: Math.round((totalBasePoints + totalBonusPoints) * 100) / 100,
        submissionsCount: submissions?.length || 0,
        tierCounts: {
          totalSubmissions: tierCounts,
          uniqueUsers: usersByTier
        }
      }
    });

  } catch (error: any) {
    console.error('[Bonus Points Stats API] Uncaught error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}