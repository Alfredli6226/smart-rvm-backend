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
  const pathParts = (url || '').replace('/api/maintenance', '').split('/').filter(Boolean);
  const pathId = pathParts[0] || null;

  try {
    // ==========================================
    // GET /api/maintenance/reports - Maintenance Reports with summary
    // ==========================================
    if (method === 'GET' && pathId === 'reports') {
      const startDate = query.start_date as string || '';
      const endDate = query.end_date as string || '';
      const status = query.status as string || ''; // PENDING, VERIFIED, REJECTED
      const machineId = query.machine_id as string || '';
      const limit = parseInt(query.limit as string) || 100;
      const offset = parseInt(query.offset as string) || 0;

      let queryBuilder = supabase
        .from('cleaning_records')
        .select('*', { count: 'exact' })
        .order('cleaned_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (startDate) {
        queryBuilder = queryBuilder.gte('cleaned_at', startDate);
      }
      if (endDate) {
        queryBuilder = queryBuilder.lte('cleaned_at', endDate + 'T23:59:59');
      }
      if (status) {
        queryBuilder = queryBuilder.eq('status', status);
      }
      if (machineId) {
        queryBuilder = queryBuilder.eq('device_no', machineId);
      }

      const { data: records, error, count } = await queryBuilder;

      if (error) throw error;

      // Get summary counts
      const { data: allRecords } = await supabase
        .from('cleaning_records')
        .select('status');

      const completedCount = (allRecords || []).filter(r => r.status === 'VERIFIED').length;
      const pendingCount = (allRecords || []).filter(r => r.status === 'PENDING').length;
      const rejectedCount = (allRecords || []).filter(r => r.status === 'REJECTED').length;

      // Transform records to maintenance format
      const maintenanceRecords = (records || []).map(r => ({
        id: r.id,
        machine_id: r.device_no,
        issue_description: r.waste_type || 'General maintenance',
        technician_name: r.cleaner_name || 'Unassigned',
        cost_of_repair: r.bag_weight_collected || 0, // Using bag_weight as cost proxy
        maintenance_date: r.cleaned_at,
        status: r.status,
        photo_url: r.photo_url,
        notes: r.admin_note
      }));

      return res.status(200).json({
        success: true,
        data: maintenanceRecords,
        summary: {
          completed: completedCount,
          pending: pendingCount,
          rejected: rejectedCount,
          total: (allRecords || []).length
        },
        pagination: { limit, offset, total: count }
      });
    }

    // ==========================================
    // GET /api/maintenance/summary - Quick summary stats
    // ==========================================
    if (method === 'GET' && pathId === 'summary') {
      const { data: allRecords } = await supabase
        .from('cleaning_records')
        .select('status, bag_weight_collected');

      const summary = {
        completed: (allRecords || []).filter(r => r.status === 'VERIFIED').length,
        pending: (allRecords || []).filter(r => r.status === 'PENDING').length,
        rejected: (allRecords || []).filter(r => r.status === 'REJECTED').length,
        total_repair_cost: (allRecords || []).reduce((sum, r) => sum + (Number(r.bag_weight_collected) || 0), 0)
      };

      return res.status(200).json({
        success: true,
        data: summary
      });
    }

    // ==========================================
    // GET /api/maintenance - Default: all records
    // ==========================================
    if (method === 'GET' && !pathId) {
      const { data, error } = await supabase
        .from('cleaning_records')
        .select('*')
        .order('cleaned_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || []
      });
    }

    // ==========================================
    // PATCH /api/maintenance/:id - Update maintenance record status
    // ==========================================
    if (method === 'PATCH' && pathId) {
      const { status, admin_note, cost_of_repair } = req.body || {};

      const updateData: Record<string, any> = {};
      if (status) updateData.status = status;
      if (admin_note) updateData.admin_note = admin_note;
      if (cost_of_repair !== undefined) updateData.bag_weight_collected = cost_of_repair;

      const { data, error } = await supabase
        .from('cleaning_records')
        .update(updateData)
        .eq('id', pathId)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data
      });
    }

    return res.status(404).json({ error: 'Endpoint not found' });

  } catch (error: any) {
    console.error('Maintenance API error:', error);
    return res.status(500).json({ error: error.message });
  }
}