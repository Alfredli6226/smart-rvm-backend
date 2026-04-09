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

  const { method, url, query } = req;
  const pathParts = (url || '').replace('/api/collections', '').split('/').filter(Boolean);
  const pathId = pathParts[0] || null;

  try {
    // ==========================================
    // GET /api/collections/reports - Collection Reports with aggregations
    // ==========================================
    if (method === 'GET' && pathId === 'reports') {
      console.log('[Collections API] Fetching reports with query:', query);
      
      const startDate = query.start_date as string || '';
      const endDate = query.end_date as string || '';
      const groupBy = query.group_by as string || 'collector';

      let baseQuery = supabase
        .from('submission_reviews')
        .select('*');

      if (startDate) {
        baseQuery = baseQuery.gte('submitted_at', startDate);
      }
      if (endDate) {
        baseQuery = baseQuery.lte('submitted_at', endDate + 'T23:59:59');
      }

      const { data: reviews, error } = await baseQuery;

      if (error) {
        console.error('[Collections API] Query error:', error);
        throw error;
      }
      
      console.log('[Collections API] Found', reviews?.length, 'submission reviews');

      // Group by Collector (user_id)
      const byCollector: Record<string, { collector_id: string, total_weight: number, total_quantity: number, total_value: number }> = {};
      // Group by Location (device_no)
      const byLocation: Record<string, { location: string, total_weight: number, total_quantity: number, total_value: number }> = {};

      if (reviews) {
        for (const r of reviews) {
          // By Collector
          const collectorId = r.user_id || 'unknown';
          if (!byCollector[collectorId]) {
            byCollector[collectorId] = { collector_id: collectorId, total_weight: 0, total_quantity: 0, total_value: 0 };
          }
          byCollector[collectorId].total_weight += Number(r.api_weight) || 0;
          byCollector[collectorId].total_quantity += 1;
          byCollector[collectorId].total_value += Number(r.calculated_value) || 0;

          // By Location
          const location = r.device_no || 'unknown';
          if (!byLocation[location]) {
            byLocation[location] = { location, total_weight: 0, total_quantity: 0, total_value: 0 };
          }
          byLocation[location].total_weight += Number(r.api_weight) || 0;
          byLocation[location].total_quantity += 1;
          byLocation[location].total_value += Number(r.calculated_value) || 0;
        }
      }

      // Calculate totals
      const totalWeight = Object.values(byCollector).reduce((sum, c) => sum + c.total_weight, 0);
      const totalQuantity = Object.values(byCollector).reduce((sum, c) => sum + c.total_quantity, 0);
      const totalValue = Object.values(byCollector).reduce((sum, c) => sum + c.total_value, 0);

      return res.status(200).json({
        success: true,
        data: {
          total_collected: {
            weight: totalWeight,
            quantity: totalQuantity,
            value: totalValue
          },
          by_collector: Object.values(byCollector),
          by_location: Object.values(byLocation)
        },
        filters: { start_date: startDate, end_date: endDate, group_by: groupBy }
      });
    }

    // ==========================================
    // GET /api/collections/logs - Collector Logs (every collection event)
    // ==========================================
    if (method === 'GET' && pathId === 'logs') {
      const startDate = query.start_date as string || '';
      const endDate = query.end_date as string || '';
      const collectorId = query.collector_id as string || '';
      const location = query.location as string || '';
      const limit = parseInt(query.limit as string) || 100;
      const offset = parseInt(query.offset as string) || 0;

      let queryBuilder = supabase
        .from('submission_reviews')
        .select('id, user_id, device_no, waste_type, api_weight, calculated_value, submitted_at, status', { count: 'exact' })
        .order('submitted_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (startDate) {
        queryBuilder = queryBuilder.gte('submitted_at', startDate);
      }
      if (endDate) {
        queryBuilder = queryBuilder.lte('submitted_at', endDate + 'T23:59:59');
      }
      if (collectorId) {
        queryBuilder = queryBuilder.eq('user_id', collectorId);
      }
      if (location) {
        queryBuilder = queryBuilder.eq('device_no', location);
      }

      const { data, error, count } = await queryBuilder;

      if (error) throw error;

      // Enrich with collector info
      const collectorIds = [...new Set((data || []).map(d => d.user_id).filter(Boolean))];
      let collectorMap: Record<string, any> = {};
      
      if (collectorIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, nickname, phone')
          .in('id', collectorIds);
        
        if (users) {
          for (const u of users) {
            collectorMap[u.id] = u;
          }
        }
      }

      const enrichedLogs = (data || []).map(log => ({
        id: log.id,
        collector_id: log.user_id,
        collector_info: collectorMap[log.user_id] || null,
        device_no: log.device_no,
        waste_type: log.waste_type,
        weight: log.api_weight,
        value: log.calculated_value,
        timestamp: log.submitted_at,
        status: log.status
      }));

      return res.status(200).json({
        success: true,
        data: enrichedLogs,
        pagination: { limit, offset, total: count }
      });
    }

    // ==========================================
    // GET /api/collections - Default: Summary stats
    // ==========================================
    if (method === 'GET' && !pathId) {
      const { data, error } = await supabase
        .from('submission_reviews')
        .select('api_weight, calculated_value')
        .limit(10000);

      if (error) throw error;

      const totalWeight = (data || []).reduce((sum, r) => sum + (Number(r.api_weight) || 0), 0);
      const totalValue = (data || []).reduce((sum, r) => sum + (Number(r.calculated_value) || 0), 0);

      return res.status(200).json({
        success: true,
        data: {
          total_collected: { weight: totalWeight, value: totalValue }
        }
      });
    }

    return res.status(404).json({ error: 'Endpoint not found' });

  } catch (error: any) {
    console.error('[Collections API] Uncaught error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}