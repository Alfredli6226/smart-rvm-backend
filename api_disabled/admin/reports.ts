import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server Configuration Error' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { query } = req;
  const reportType = (query.reportType as string) || 'collection';
  const startDate = (query.startDate as string) || '';
  const endDate = (query.endDate as string) || '';

  try {
    // ==========================================
    // Collection Report: Weights grouped by material
    // ==========================================
    if (reportType === 'collection') {
      let baseQuery = supabase
        .from('submission_reviews')
        .select('waste_type, api_weight, calculated_value, submitted_at');

      if (startDate) {
        baseQuery = baseQuery.gte('submitted_at', startDate);
      }
      if (endDate) {
        baseQuery = baseQuery.lte('submitted_at', endDate + 'T23:59:59');
      }

      const { data: reviews, error } = await baseQuery;

      if (error) throw error;

      // Group by material/waste_type
      const byMaterial: Record<string, { material: string; total_weight: number; total_items: number; total_value: number }> = {};

      if (reviews) {
        for (const r of reviews) {
          const material = r.waste_type || 'Unknown';
          if (!byMaterial[material]) {
            byMaterial[material] = { material, total_weight: 0, total_items: 0, total_value: 0 };
          }
          byMaterial[material].total_weight += Number(r.api_weight) || 0;
          byMaterial[material].total_items += 1;
          byMaterial[material].total_value += Number(r.calculated_value) || 0;
        }
      }

      const result = Object.values(byMaterial).map(m => ({
        ...m,
        total_weight: Math.round(m.total_weight * 100) / 100,
        total_value: Math.round(m.total_value * 100) / 100
      }));

      return res.status(200).json(result);
    }

    // ==========================================
    // Maintenance Report: Faulty vs Fixed counts
    // ==========================================
    if (reportType === 'maintenance') {
      let baseQuery = supabase
        .from('cleaning_logs')
        .select('status, cleaned_at, device_no, waste_type');

      if (startDate) {
        baseQuery = baseQuery.gte('cleaned_at', startDate);
      }
      if (endDate) {
        baseQuery = baseQuery.lte('cleaned_at', endDate + 'T23:59:59');
      }

      const { data: logs, error } = await baseQuery;

      if (error) throw error;

      // Count by status - consider PENDING/REJECTED as 'Faulty', VERIFIED as 'Fixed'
      let faulty = 0;
      let fixed = 0;

      if (logs) {
        for (const log of logs) {
          if (log.status === 'VERIFIED') {
            fixed++;
          } else {
            faulty++;
          }
        }
      }

      const result = [
        { status: 'Fixed', count: fixed, percentage: fixed + faulty > 0 ? Math.round((fixed / (fixed + faulty)) * 100) : 0 },
        { status: 'Faulty', count: faulty, percentage: fixed + faulty > 0 ? Math.round((faulty / (fixed + faulty)) * 100) : 0 }
      ];

      return res.status(200).json(result);
    }

    // ==========================================
    // Collector Report: Bin-emptying events with timestamps
    // ==========================================
    if (reportType === 'collector') {
      let baseQuery = supabase
        .from('submission_reviews')
        .select('id, user_id, device_no, waste_type, api_weight, submitted_at, status')
        .order('submitted_at', { ascending: false });

      if (startDate) {
        baseQuery = baseQuery.gte('submitted_at', startDate);
      }
      if (endDate) {
        baseQuery = baseQuery.lte('submitted_at', endDate + 'T23:59:59');
      }

      const limit = parseInt(query.limit as string) || 100;
      baseQuery = baseQuery.limit(limit);

      const { data: events, error } = await baseQuery;

      if (error) throw error;

      // Get collector info
      const collectorIds = [...new Set((events || []).map(e => e.user_id).filter(Boolean))];
      let collectorMap: Record<string, { name: string; phone: string }> = {};

      if (collectorIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, nickname, phone')
          .in('id', collectorIds);

        if (users) {
          for (const u of users) {
            collectorMap[u.id] = { name: u.nickname || u.id, phone: u.phone || 'N/A' };
          }
        }
      }

      const result = (events || []).map(event => ({
        id: event.id,
        collector_id: event.user_id,
        collector_name: collectorMap[event.user_id]?.name || 'Unknown',
        collector_phone: collectorMap[event.user_id]?.phone || 'N/A',
        machine_id: event.device_no,
        waste_type: event.waste_type,
        weight_kg: Math.round(Number(event.api_weight) * 100) / 100,
        timestamp: event.submitted_at,
        status: event.status
      }));

      return res.status(200).json(result);
    }

    // ==========================================
    // Financial Report: Points-to-RM conversion
    // ==========================================
    if (reportType === 'financial') {
      // Get transactions (withdrawals or submission values)
      let baseQuery = supabase
        .from('submission_reviews')
        .select('calculated_value, submitted_at');

      if (startDate) {
        baseQuery = baseQuery.gte('submitted_at', startDate);
      }
      if (endDate) {
        baseQuery = baseQuery.lte('submitted_at', endDate + 'T23:59:59');
      }

      const { data: transactions, error } = await baseQuery;

      if (error) throw error;

      // Calculate total points and convert to RM (assume 100 points = RM 1)
      const POINTS_TO_RM_RATE = 0.01; // 100 points = RM 1
      let totalPoints = 0;

      if (transactions) {
        totalPoints = transactions.reduce((sum, t) => sum + (Number(t.calculated_value) || 0), 0);
      }

      const totalRM = totalPoints * POINTS_TO_RM_RATE;

      // Also get withdrawal data if available
      const { data: withdrawals } = await supabase
        .from('withdrawal_requests')
        .select('amount, status, created_at')
        .gte('created_at', startDate || '1970-01-01')
        .lte('created_at', (endDate || new Date().toISOString()) + 'T23:59:59');

      const totalWithdrawn = (withdrawals || [])
        .filter(w => w.status === 'COMPLETED')
        .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      const result = [
        {
          metric: 'Total Points Generated',
          value: Math.round(totalPoints * 100) / 100,
          unit: 'points'
        },
        {
          metric: 'Conversion Rate',
          value: '100',
          unit: 'points = RM 1'
        },
        {
          metric: 'Total Value (RM)',
          value: Math.round(totalRM * 100) / 100,
          unit: 'RM'
        },
        {
          metric: 'Total Withdrawn',
          value: Math.round(totalWithdrawn * 100) / 100,
          unit: 'RM'
        },
        {
          metric: 'Available Balance',
          value: Math.round((totalRM - totalWithdrawn) * 100) / 100,
          unit: 'RM'
        }
      ];

      return res.status(200).json(result);
    }

    return res.status(400).json({ error: 'Invalid reportType. Use: collection, maintenance, collector, or financial' });

  } catch (error: any) {
    console.error('[Admin Reports API] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}