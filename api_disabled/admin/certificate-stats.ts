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
    console.error('[Certificate Stats] Missing env vars', { supabaseUrl, hasKey: !!supabaseServiceKey });
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  if (supabaseServiceKey === process.env.VITE_SUPABASE_ANON_KEY) {
    console.error('[Certificate Stats] FATAL: Using anon key - cannot perform admin operations');
    return res.status(500).json({ error: 'Server misconfigured: Missing SUPABASE_SERVICE_ROLE_KEY' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { method, url, headers } = req;

  try {
    console.log('[Certificate Stats] Request:', req.method);

    const authHeader = headers.authorization;
    if (!authHeader) {
      console.warn('[Certificate Stats] No auth header');
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.replace('Bearer ', '');

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      console.error('[Certificate Stats] Auth error:', authError);
      return res.status(401).json({ error: 'Invalid authorization' });
    }

    if (!authUser?.email) {
      console.warn('[Certificate Stats] No email in token');
      return res.status(401).json({ error: 'Invalid authorization' });
    }

    const { data: adminData, error: adminError } = await supabase
      .from('app_admins')
      .select('role')
      .eq('email', authUser.email)
      .single();

    if (adminError) {
      console.error('[Certificate Stats] Admin check error:', adminError);
    }

    if (!adminData || adminData.role !== 'SUPER_ADMIN') {
      console.warn('[Certificate Stats] Not super admin:', adminData);
      return res.status(403).json({ error: 'Access denied. Super Admin only.' });
    }

    console.log('[Certificate Stats] Authorized as SUPER_ADMIN');

    if (method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { count: totalCertificatesIssued, error: certCountError } = await supabase
      .from('user_certificates')
      .select('*', { count: 'exact', head: true });

    if (certCountError) {
      console.error('[Certificate Stats] Certificate count error:', certCountError);
      return res.status(500).json({ error: 'Failed to count certificates' });
    }

    const { data: uniqueUsersData, error: uniqueUsersError } = await supabase
      .from('user_certificates')
      .select('user_id');

    if (uniqueUsersError) {
      console.error('[Certificate Stats] Unique users error:', uniqueUsersError);
      return res.status(500).json({ error: 'Failed to get unique users' });
    }

    const uniqueUserIds = new Set(uniqueUsersData?.map(u => u.user_id) || []);
    const usersWhoCompleted = uniqueUserIds.size;

    const { count: totalUsers, error: usersCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (usersCountError) {
      console.error('[Certificate Stats] Users count error:', usersCountError);
      return res.status(500).json({ error: 'Failed to count users' });
    }

    const completionRate = totalUsers && totalUsers > 0 
      ? (usersWhoCompleted / totalUsers) * 100 
      : 0;

    const now = new Date();
    const monthlyBreakdown = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

      const { count: monthCount, error: monthError } = await supabase
        .from('user_certificates')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthDate.toISOString())
        .lt('created_at', nextMonthDate.toISOString());

      if (monthError) {
        console.warn('[Certificate Stats] Month count error:', monthError);
      }

      const monthLabel = monthDate.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthlyBreakdown.push({
        month: monthLabel,
        count: monthCount || 0
      });
    }

    console.log('[Certificate Stats] Success');

    return res.status(200).json({
      success: true,
      data: {
        totalCertificatesIssued: totalCertificatesIssued || 0,
        usersWhoCompleted,
        completionRate: Math.round(completionRate * 100) / 100,
        monthlyBreakdown
      }
    });

  } catch (error: any) {
    console.error('[Certificate Stats API] Uncaught error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}